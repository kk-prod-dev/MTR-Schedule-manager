// ============================================================
// NetworkScheme — схема сети (режим «Схема сети» вкладки «Редактор»)
// ============================================================
// Встраивает MURScheme (vendor/murscheme/MURScheme.html, GPL-3.0, автор
// tringoli — https://github.com/tringoli/MURStack) в iframe и генерирует
// для него проект из данных MTR (GET /api/scheme-data).
//
// Связь с MURScheme — через murscheme-bridge.js, который вставляется в
// iframe после загрузки (сам MURScheme.html не правится).
// Связь с app.js — как у BoardEditor: getPersistedState()/
// applyPersistedState() кладут проект в общий prefs.json.
//
// Генерация (buildProject):
//  - маршрут + его обратный = одна линия; укороченные варианты (те же цвет
//    и номер, станции — непрерывный кусок более длинного маршрута)
//    вливаются в длинный;
//  - станции раскладываются по мировым координатам (x/z), масштаб
//    подбирается так, чтобы медианный перегон ≈ 3 клетки сетки; позиции
//    привязаны к сетке, совпадения разводятся по спирали;
//  - перегоны, не лежащие на 0/45/90°, получают один излом (как в метро);
//    излом выбирается на перегон один раз — линии на общем участке идут
//    одной трассой;
//  - линии на общих перегонах разводятся offset'ом MURScheme (знак offset
//    зависит от направления полилинии — учитывается);
//  - станции MTR с connections → пересадки.
// Слияние: объекты MTR помечены префиксом id (mtr-line-/mtr-st-/mtr-tr-).
// При повторной генерации позиции и стили существующих объектов
// сохраняются, новые добавляются, исчезнувшие из выборки удаляются;
// объекты, нарисованные пользователем вручную, не трогаются.

const NetworkScheme = (function () {
  const P_LINE = "mtr-line-", P_ST = "mtr-st-", P_TR = "mtr-tr-";
  const DEFAULT_TYPES = ["train_metro", "train_sbahn", "train_light_rail", "train_tram"];
  const SPACING_CELLS = 3;
  const SAVE_DELAY = 1500;

  let project = null;        // последний известный проект (из prefs или из iframe)
  let ui = { mode: "timetable", types: null };
  let schemeData = null;     // кеш /api/scheme-data
  let iframe = null, bridge = null, loadPromise = null;
  let saveTimer = null;
  let initialized = false;
  const el = {};

  function tt(key, vars) { return typeof t === "function" ? t(key, vars) : key; }
  function esc(s) { return typeof escapeHtml === "function" ? escapeHtml(s) : String(s ?? ""); }
  const isMtr = (id, p) => typeof id === "string" && id.startsWith(p);

  // ------------------------------------------------------------
  // Генератор (чистые функции, без DOM)
  // ------------------------------------------------------------
  function splitName(raw) {
    const s = String(raw || "").trim();
    let parts = s.split("|").map((x) => x.trim()).filter(Boolean);
    if (parts.length < 2) parts = s.split(/\s+\/\s+/).map((x) => x.trim()).filter(Boolean);
    return { name: parts[0] || s, subname: parts.slice(1).join(" ") };
  }

  function containsPath(big, small) {
    const s = "," + small.join(",") + ",";
    return ("," + big.join(",") + ",").includes(s) || ("," + [...big].reverse().join(",") + ",").includes(s);
  }

  function groupRoutes(routes, types) {
    const sel = routes.filter((r) => types.has(r.type) && r.stationIds.length >= 2);
    const selIds = new Set(sel.map((r) => r.id));
    sel.sort((a, b) => b.stationIds.length - a.stationIds.length || (a.id < b.id ? -1 : 1));
    const groups = [];
    const used = new Set();
    for (const r of sel) {
      if (used.has(r.id)) continue;
      used.add(r.id);
      const ids = [r.id];
      if (r.reverseRouteId && selIds.has(r.reverseRouteId) && !used.has(r.reverseRouteId)) {
        used.add(r.reverseRouteId);
        ids.push(r.reverseRouteId);
      }
      const host = groups.find((g) => g.main.color === r.color && (g.main.number || "") === (r.number || "")
        && containsPath(g.main.stationIds, r.stationIds));
      if (host) { host.routeIds.push(...ids); continue; }
      groups.push({ main: r, routeIds: ids });
    }
    return groups;
  }

  function computeMeta(groups, stById, grid) {
    const ds = [];
    let sx = 0, sz = 0, n = 0;
    const seen = new Set();
    for (const g of groups) {
      const ids = g.main.stationIds;
      for (let i = 0; i < ids.length; i++) {
        const s = stById.get(ids[i]);
        if (!s) continue;
        if (!seen.has(s.id)) { seen.add(s.id); sx += s.x; sz += s.z; n++; }
        const p = i > 0 ? stById.get(ids[i - 1]) : null;
        if (p) { const d = Math.hypot(s.x - p.x, s.z - p.z); if (d > 0) ds.push(d); }
      }
    }
    ds.sort((a, b) => a - b);
    const median = ds.length ? ds[Math.floor(ds.length / 2)] : 100;
    return { scale: (SPACING_CELLS * grid) / median, cx: n ? sx / n : 0, cz: n ? sz / n : 0, grid };
  }

  const key = (p) => p.x + "," + p.y;

  function placeFree(raw, grid, occ) {
    const snap = (v) => Math.round(v / grid) * grid;
    const base = { x: snap(raw.x), y: snap(raw.y) };
    if (!occ.has(key(base))) return base;
    for (let r = 1; r <= 12; r++) {
      let best = null, bestD = Infinity;
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const c = { x: base.x + dx * grid, y: base.y + dy * grid };
          if (occ.has(key(c))) continue;
          const d = Math.hypot(c.x - raw.x, c.y - raw.y);
          if (d < bestD) { bestD = d; best = c; }
        }
      }
      if (best) return best;
    }
    return base;
  }

  // Полилиния линии через станции; неоктилинейный перегон → один излом.
  function buildPath(ids, pos, occ, elbows) {
    const pts = [];
    let prevDir = null;
    const sgn = Math.sign;
    for (let i = 0; i < ids.length; i++) {
      const b = pos.get(ids[i]);
      if (!b) continue;
      if (!pts.length) { pts.push(b); continue; }
      const a = pts[pts.length - 1];
      const dx = b.x - a.x, dy = b.y - a.y;
      if (!dx && !dy) continue;
      if (dx && dy && Math.abs(dx) !== Math.abs(dy)) {
        const segKey = [ids[i - 1], ids[i]].sort().join("|");
        let e = elbows.get(segKey);
        if (!e) {
          const m = Math.min(Math.abs(dx), Math.abs(dy));
          const eDiag = { x: a.x + sgn(dx) * m, y: a.y + sgn(dy) * m };
          const eStraight = { x: b.x - sgn(dx) * m, y: b.y - sgn(dy) * m };
          const dirOf = (p, q) => sgn(q.x - p.x) + ":" + sgn(q.y - p.y);
          const score = (c) => (occ.has(key(c)) ? 10 : 0) + (prevDir && dirOf(a, c) !== prevDir ? 1 : 0);
          e = score(eDiag) < score(eStraight) ? eDiag : eStraight;
          elbows.set(segKey, e);
        }
        pts.push({ x: e.x, y: e.y });
        prevDir = Math.sign(b.x - e.x) + ":" + Math.sign(b.y - e.y);
      } else {
        prevDir = sgn(dx) + ":" + sgn(dy);
      }
      pts.push(b);
    }
    // убираем промежуточные точки на прямой (станции проецируются на путь сами)
    const out = [];
    for (const p of pts) {
      if (out.length && out[out.length - 1].x === p.x && out[out.length - 1].y === p.y) continue;
      if (out.length >= 2) {
        const a = out[out.length - 2], m = out[out.length - 1];
        if ((m.x - a.x) * (p.y - m.y) === (m.y - a.y) * (p.x - m.x)
          && Math.sign(m.x - a.x) === Math.sign(p.x - m.x) && Math.sign(m.y - a.y) === Math.sign(p.y - m.y)) {
          out[out.length - 1] = p;
          continue;
        }
      }
      out.push({ x: p.x, y: p.y });
    }
    return out;
  }

  // Разводка линий на общих перегонах. offset у MURScheme считается от
  // направления полилинии, поэтому на общем перегоне сравниваем «сторону»
  // = offset × направление.
  function assignOffsets(lines, fixed) {
    const segs = new Map(); // segKey -> [{line, dir}]
    for (const l of lines) {
      const ids = l.mtrStationIds;
      for (let i = 1; i < ids.length; i++) {
        if (ids[i] === ids[i - 1]) continue;
        const k = ids[i - 1] < ids[i] ? ids[i - 1] + "|" + ids[i] : ids[i] + "|" + ids[i - 1];
        const dir = ids[i - 1] < ids[i] ? 1 : -1;
        if (!segs.has(k)) segs.set(k, []);
        segs.get(k).push({ line: l, dir });
      }
    }
    const done = new Set(lines.filter((l) => fixed.has(l.id)));
    const cand = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5];
    for (const l of lines) {
      if (done.has(l)) continue;
      const mine = [];
      for (const list of segs.values()) {
        const me = list.find((x) => x.line === l);
        if (!me) continue;
        for (const o of list) if (o.line !== l && done.has(o.line)) mine.push({ dir: me.dir, odir: o.dir, other: o.line });
      }
      l.offset = cand.find((c) => !mine.some((m) => c * m.dir === (m.other.offset || 0) * m.odir)) ?? 0;
      done.add(l);
    }
  }

  function buildProject(data, opts, prev) {
    prev = prev || {};
    const grid = Number(prev.gridStep) || 24;
    const stById = new Map(data.stations.map((s) => [s.id, s]));
    const groups = groupRoutes(data.routes, opts.types);

    const prevLines = (prev.lines || []);
    const prevStations = new Map((prev.stations || []).filter((s) => isMtr(s.id, P_ST)).map((s) => [s.mtrStationId, s]));
    const prevTransfers = new Map((prev.transfers || []).filter((t) => isMtr(t.id, P_TR)).map((t) => [t.id, t]));
    const meta = (prev.mtrMeta && prev.mtrMeta.grid === grid) ? prev.mtrMeta : computeMeta(groups, stById, grid);

    // Станции, через которые идут выбранные линии
    const lineIdOf = (g) => P_LINE + g.main.id;
    const stLines = new Map(); // stationId -> Set(lineId)
    for (const g of groups) {
      for (const id of g.main.stationIds) {
        if (!stById.has(id)) continue;
        if (!stLines.has(id)) stLines.set(id, new Set());
        stLines.get(id).add(lineIdOf(g));
      }
    }

    // Позиции: существующие станции остаются на месте
    const pos = new Map(), occ = new Set();
    for (const id of stLines.keys()) {
      const p = prevStations.get(id);
      if (p) { pos.set(id, { x: p.x, y: p.y }); occ.add(key(p)); }
    }
    const fresh = [...stLines.keys()].filter((id) => !pos.has(id))
      .sort((a, b) => stLines.get(b).size - stLines.get(a).size);
    for (const id of fresh) {
      const s = stById.get(id);
      const p = placeFree({ x: (s.x - meta.cx) * meta.scale, y: (s.z - meta.cz) * meta.scale }, grid, occ);
      pos.set(id, p);
      occ.add(key(p));
    }
    const freshSet = new Set(fresh);

    // Линии
    const elbows = new Map();
    const fixedOffsets = new Set();
    const usedPrevLines = new Set();
    const lines = groups.map((g) => {
      const id = lineIdOf(g);
      const old = prevLines.find((l) => l.id === id)
        || prevLines.find((l) => isMtr(l.id, P_LINE) && !usedPrevLines.has(l) && (l.mtrRouteIds || []).some((r) => g.routeIds.includes(r)));
      if (old) usedPrevLines.add(old);
      const ids = g.main.stationIds.filter((s) => stById.has(s));
      const nm = splitName(g.main.name);
      const sameRoute = old && JSON.stringify(old.mtrStationIds) === JSON.stringify(ids)
        && !ids.some((s) => freshSet.has(s)) && Array.isArray(old.points) && old.points.length >= 2;
      const base = {
        id,
        name: nm.name,
        subname: nm.subname,
        color: g.main.color,
        width: (prev.globalStyles && prev.globalStyles.lineWidth) || 6.5,
        opacity: 1,
        shadow: false,
        offset: 0,
        dashStyle: /_bus$/.test(g.main.type) ? "dashed" : "solid",
        badgeText: g.main.number || "",
      };
      const line = Object.assign(base, old || {}, {
        id,
        mtrRouteIds: g.routeIds,
        mtrStationIds: ids,
        mtrType: g.main.type,
        points: sameRoute ? old.points : buildPath(ids, pos, occ, elbows),
      });
      if (old) fixedOffsets.add(id);
      return line;
    });
    assignOffsets(lines, fixedOffsets);
    const lineIds = new Set(lines.map((l) => l.id));
    const userLines = prevLines.filter((l) => !isMtr(l.id, P_LINE));

    // Станции
    const defaults = {
      colorMode: "line", tickShift: "auto", customColor: "#ffffff",
      labelPos: (prev.globalStyles && prev.globalStyles.labelPos) || "top-right",
      labelAngle: (prev.globalStyles && prev.globalStyles.labelAngle) || 315,
      tickLen: 9, isTerminal: false, showBadges: false,
    };
    const stations = [];
    for (const [id, lset] of stLines) {
      const s = stById.get(id);
      const nm = splitName(s.name);
      const old = prevStations.get(id);
      const p = pos.get(id);
      const myLines = [...lset];
      if (old) {
        // ручные привязки к пользовательским линиям сохраняем
        const keepUser = (old.lineIds || []).filter((l) => !isMtr(l, P_LINE) && !lineIds.has(l));
        const st = Object.assign({}, old, { lineIds: [...myLines, ...keepUser], mtrName: s.name });
        // переименование в MTR доходит до схемы, если имя не правили вручную
        const oldNm = splitName(old.mtrName);
        if (old.name === oldNm.name) st.name = nm.name;
        if ((old.subname || "") === oldNm.subname) st.subname = nm.subname;
        stations.push(st);
      } else {
        stations.push(Object.assign({}, defaults, {
          id: P_ST + id,
          mtrStationId: id,
          mtrName: s.name,
          name: nm.name,
          subname: nm.subname,
          x: p.x, y: p.y,
          style: myLines.length > 1 ? "interchange-borderless" : "metro-tick",
          lineIds: myLines,
        }));
      }
    }
    const userStations = (prev.stations || []).filter((s) => !isMtr(s.id, P_ST))
      .map((s) => Object.assign({}, s, { lineIds: (s.lineIds || []).filter((l) => !isMtr(l, P_LINE) || lineIds.has(l)) }));

    // Пересадки: компоненты связности по connections
    const parent = new Map();
    const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
    for (const id of stLines.keys()) parent.set(id, id);
    for (const id of stLines.keys()) {
      for (const c of stById.get(id).connections || []) {
        if (parent.has(c)) parent.set(find(id), find(c));
      }
    }
    const comps = new Map();
    for (const id of stLines.keys()) {
      const r = find(id);
      if (!comps.has(r)) comps.set(r, []);
      comps.get(r).push(id);
    }
    const transfers = [];
    for (const ids of comps.values()) {
      if (ids.length < 2) continue;
      ids.sort();
      const id = P_TR + ids[0];
      const old = prevTransfers.get(id);
      transfers.push(Object.assign(
        { style: "radial-arc", curvature: 25, dashLength: 5, dashGap: 4, dashWidth: 3.5, dashColor: "#0f172a" },
        old || {},
        { id, stationIds: ids.map((s) => P_ST + s) }));
    }
    const allStationIds = new Set([...stations, ...userStations].map((s) => s.id));
    const userTransfers = (prev.transfers || []).filter((t) => !isMtr(t.id, P_TR))
      .filter((t) => (t.stationIds || []).filter((s) => allStationIds.has(s)).length >= 2);

    const prevMtrLines = prevLines.filter((l) => isMtr(l.id, P_LINE)).length;
    const result = Object.assign({}, prev, {
      lines: [...lines, ...userLines],
      stations: [...stations, ...userStations],
      transfers: [...transfers, ...userTransfers],
      mtrMeta: meta,
    });
    return {
      project: result,
      stats: {
        lines: lines.length,
        stations: stations.length,
        transfers: transfers.length,
        newStations: fresh.length,
        removedLines: Math.max(0, prevMtrLines - usedPrevLines.size),
        hadMtr: prevMtrLines > 0,
      },
    };
  }

  // ------------------------------------------------------------
  // iframe + мост
  // ------------------------------------------------------------
  function ensureFrame() {
    if (loadPromise) return loadPromise;
    loadPromise = new Promise((resolve, reject) => {
      iframe = document.createElement("iframe");
      iframe.className = "scheme-frame";
      iframe.title = "MURScheme";
      iframe.addEventListener("load", () => {
        try {
          const w = iframe.contentWindow, d = iframe.contentDocument;
          const s = d.createElement("script");
          s.src = "/murscheme-bridge.js";
          s.onload = () => {
            bridge = w.__mtrBridge;
            if (!bridge) { reject(new Error("bridge not available")); return; }
            bridge.setLang(typeof currentLang === "function" ? currentLang() : "ru");
            if (project) bridge.loadProject(project, { fit: false });
            bridge.onChange(scheduleSave);
            resolve(bridge);
          };
          s.onerror = () => reject(new Error("murscheme-bridge.js failed to load"));
          d.body.appendChild(s);
        } catch (e) { reject(e); }
      }, { once: true });
      iframe.src = "vendor/murscheme/MURScheme.html";
      el.frameHost.appendChild(iframe);
    });
    loadPromise.catch((e) => {
      console.error("NetworkScheme: MURScheme load failed:", e);
      setStatus(tt("schemeLoadError") + ": " + e.message);
      loadPromise = null;
    });
    return loadPromise;
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { if (bridge) project = bridge.getProject(); } catch (e) {}
      try { if (typeof savePrefsToServer === "function") savePrefsToServer(); } catch (e) {}
    }, SAVE_DELAY);
  }

  function setStatus(msg) { if (el.status) el.status.textContent = msg || ""; }

  // ------------------------------------------------------------
  // UI
  // ------------------------------------------------------------
  function typeLabel(type) {
    const m = /^(train|boat|cable_car|airplane)_(.+)$/.exec(type || "");
    if (!m) return type;
    const icon = { train: "", boat: "⛴ ", cable_car: "🚡 ", airplane: "✈ " }[m[1]];
    const k = "schemeType_" + m[2];
    const label = tt(k);
    return icon + (label === k ? m[2] : label);
  }

  async function loadSchemeData(force) {
    if (schemeData && !force) return schemeData;
    const res = await fetch("/api/scheme-data");
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || res.status);
    schemeData = body;
    return body;
  }

  function selectedTypes() {
    return new Set(ui.types || []);
  }

  function renderTypes() {
    if (!el.typesPanel || !schemeData) return;
    const counts = new Map();
    for (const r of schemeData.routes) counts.set(r.type, (counts.get(r.type) || 0) + 1);
    const all = [...counts.keys()].sort();
    if (!ui.types) {
      const def = all.filter((x) => DEFAULT_TYPES.includes(x));
      ui.types = def.length ? def : all;
    }
    const sel = selectedTypes();
    el.typesPanel.innerHTML = all.map((type) =>
      `<label><input type="checkbox" data-type="${esc(type)}"${sel.has(type) ? " checked" : ""}> ${esc(typeLabel(type))} <span class="hint small">(${counts.get(type)})</span></label>`).join("");
    el.typesPanel.querySelectorAll("input[data-type]").forEach((cb) => {
      cb.addEventListener("change", () => {
        const s = selectedTypes();
        if (cb.checked) s.add(cb.dataset.type); else s.delete(cb.dataset.type);
        ui.types = [...s];
        updateTypesBtn();
        scheduleSave();
      });
    });
    updateTypesBtn();
  }

  function updateTypesBtn() {
    if (el.typesCount) el.typesCount.textContent = ui.types ? `(${ui.types.length})` : "";
  }

  async function generate() {
    try {
      setStatus(tt("schemeGenerating"));
      const data = await loadSchemeData(true);
      renderTypes();
      const types = selectedTypes();
      if (!types.size) { setStatus(tt("schemeNoTypes")); return; }
      const b = await ensureFrame();
      const res = buildProject(data, { types }, b.getProject());
      b.loadProject(res.project, { undoable: true, fit: !res.stats.hadMtr });
      project = b.getProject();
      scheduleSave();
      setStatus(tt(res.stats.hadMtr ? "schemeUpdated" : "schemeGenerated", res.stats));
    } catch (e) {
      console.error("NetworkScheme.generate failed:", e);
      setStatus(tt("schemeGenerateError") + ": " + e.message);
    }
  }

  async function resetScheme() {
    if (!confirm(tt("schemeResetConfirm"))) return;
    project = null;
    bridge = null;
    loadPromise = null;
    if (iframe) iframe.remove();
    iframe = null;
    await ensureFrame();
    project = bridge.getProject();
    scheduleSave();
    setStatus("");
  }

  function setMode(mode) {
    ui.mode = mode === "scheme" ? "scheme" : "timetable";
    const scheme = ui.mode === "scheme";
    if (el.timetable) el.timetable.style.display = scheme ? "none" : "";
    if (el.scheme) el.scheme.style.display = scheme ? "" : "none";
    if (el.btnTimetable) el.btnTimetable.classList.toggle("active", !scheme);
    if (el.btnScheme) el.btnScheme.classList.toggle("active", scheme);
    if (scheme) {
      ensureFrame().then((b) => b.setLang(typeof currentLang === "function" ? currentLang() : "ru")).catch(() => {});
      if (!schemeData) loadSchemeData().then(renderTypes).catch((e) => setStatus(e.message));
    }
  }

  function init() {
    if (initialized) return;
    initialized = true;
    el.timetable = document.getElementById("boardModeTimetable");
    el.scheme = document.getElementById("boardModeScheme");
    el.btnTimetable = document.getElementById("boardModeTimetableBtn");
    el.btnScheme = document.getElementById("boardModeSchemeBtn");
    el.frameHost = document.getElementById("schemeFrameHost");
    el.status = document.getElementById("schemeStatus");
    el.typesBtn = document.getElementById("schemeTypesBtn");
    el.typesPanel = document.getElementById("schemeTypesPanel");
    el.typesCount = document.getElementById("schemeTypesCount");
    if (!el.scheme || !el.frameHost) return;

    el.btnTimetable.addEventListener("click", () => { setMode("timetable"); scheduleSave(); });
    el.btnScheme.addEventListener("click", () => { setMode("scheme"); scheduleSave(); });
    el.typesBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      el.typesPanel.classList.toggle("open");
    });
    document.addEventListener("click", (e) => {
      if (!el.typesPanel.contains(e.target) && e.target !== el.typesBtn) el.typesPanel.classList.remove("open");
    });
    document.getElementById("schemeGenerateBtn").addEventListener("click", generate);
    document.getElementById("schemeFitBtn").addEventListener("click", () => { if (bridge) bridge.fitView(); });
    document.getElementById("schemeResetBtn").addEventListener("click", resetScheme);
    setMode(ui.mode);
  }

  // Язык интерфейса сменился (applyI18n в app.js)
  function onLanguageChange() {
    if (bridge) bridge.setLang(typeof currentLang === "function" ? currentLang() : "ru");
    if (schemeData) renderTypes();
  }

  function getPersistedState() {
    try { if (bridge) project = bridge.getProject(); } catch (e) {}
    return { project, ui: { mode: ui.mode, types: ui.types } };
  }

  function applyPersistedState(s) {
    if (!s) return;
    if (s.project && typeof s.project === "object") project = s.project;
    if (s.ui && typeof s.ui === "object") {
      if (s.ui.mode) ui.mode = s.ui.mode;
      if (Array.isArray(s.ui.types)) ui.types = s.ui.types;
    }
    if (bridge && project) bridge.loadProject(project, { fit: false });
    if (initialized) setMode(ui.mode);
  }

  return { init, getPersistedState, applyPersistedState, onLanguageChange, buildProject };
})();

window.NetworkScheme = NetworkScheme;
