// ============================================================
// NetworkScheme — редактор схемы сети (вкладка «Редактор» → «Схема сети»)
// ============================================================
// Модель и отрисовка — в schemeCore.js (общие с map.html, страницей
// просмотра опубликованной схемы). Здесь: интерфейс редактора, построение
// схемы из данных MTR со слиянием, живые данные, экспорт и публикация.
//
// Связь с app.js — как у BoardEditor: getPersistedState()/
// applyPersistedState() кладут проект в общий prefs.json; для перехода к
// расписанию станции / карточке маршрута используются глобальные
// gotoStationSchedule() и openRouteModal() из app.js.
//
// Построение из MTR (buildFromMtr):
//  - маршрут + его обратный = одна линия; укороченные варианты (те же цвет
//    и номер, станции — непрерывный кусок более длинного маршрута)
//    вливаются в длинный;
//  - станции раскладываются по мировым координатам (x/z), масштаб
//    подбирается так, чтобы медианный перегон ≈ 3 клетки сетки; позиции
//    привязаны к сетке, совпадения разводятся по спирали;
//  - перегоны не под 0/45/90° получают один излом, выбранный ОДИН раз на
//    пару станций — линии на общем перегоне идут одной трассой;
//  - станция, в которой линия поворачивает, сдвигается на прямой участок,
//    излом остаётся на старом месте (slideOffBends);
//  - линии на общих перегонах разводятся offset'ом (он считается от
//    направления полилинии, поэтому сравнивается offset × направление);
//  - станции MTR с connections → пересадки.
// Слияние: объекты MTR помечены префиксом id (mtr-line-/mtr-st-/mtr-tr-).
// Повторное построение сохраняет позиции/стили/переименования, добавляет
// новое, удаляет исчезнувшее из выборки; нарисованное вручную не трогает.

const NetworkScheme = (function () {
  const P_LINE = "mtr-line-", P_ST = "mtr-st-", P_TR = "mtr-tr-";
  const DEFAULT_TYPES = ["train_metro", "train_sbahn", "train_light_rail", "train_tram"];
  const SPACING_CELLS = 3;
  // «Мин. расстояние» между станциями, клеток (0 — без ограничения)
  const MIN_GAPS = [0, 2, 3, 4, 5, 6];
  const SAVE_DELAY = 1500;
  const HISTORY_LIMIT = 60;
  const LIVE_REFRESH_MS = 90000;
  const PALETTE = ["#e11d48", "#2563eb", "#16a34a", "#f59e0b", "#9333ea", "#0891b2", "#ea580c", "#4b5563"];
  // Пауза перед отправкой правок во вкладку браузера (map.html#v=…)
  const VIEW_PUSH_DELAY = 600;

  const C = () => window.SchemeCore;
  let project = null;
  // alignTol — допуск выравнивания перегонов при построении, градусы (0 = выкл)
  let ui = { mode: "timetable", types: null, live: false, alignTol: 15, compress: 5, minGap: 0, customIcons: [] };
  // что ставит инструмент «Значок»: категория, вариант, плашка, цвет или свой рисунок
  const iconPick = { icon: "park", variant: 0, plate: "circle", plateColor: "", fill: "#16a34a", img: "" };
  const ICON_PX = 512, ICON_LIB_MAX = 30;
  let schemeData = null;
  let initialized = false;
  const el = {};

  // Редактор
  let tool = "select";
  let sel = null;            // { kind: "station"|"line"|"transfer"|"legend", id } | { kind: "node", x, y }
  let drawing = null;        // { points: [] } — инструмент «линия»
  let transferFirst = null;  // id станции — инструмент «пересадка»
  let drag = null;
  let hoverPt = null;
  let undoStack = [], redoStack = [];
  let saveTimer = null;
  let liveData = null, liveTimer = null;
  let schemes = [];          // [{ id, name, project, types }] — несколько схем
  let activeId = null;
  let group = null;          // { stations:Set, nodes:Set<ключ позиции>, shapes:Set } — выделение рамкой
  let styleClip = null;      // скопированный стиль { kind, props }
  let marquee = null;        // { x0, y0, x1, y1, add }
  let guides = [];           // направляющие привязки при перетаскивании [{ x1, y1, x2, y2 }]
  let lastDrawn = null;      // результат последнего C().render (позиции подписей)

  function tt(key, vars) { return typeof t === "function" ? t(key, vars) : key; }
  const isMtr = (id, p) => typeof id === "string" && id.startsWith(p);
  const visible = () => !!(el.scheme && el.scheme.offsetParent !== null);
  const snap = (v) => Math.round(v / project.grid) * project.grid;

  // ------------------------------------------------------------
  // Построение из MTR (чистые функции)
  // ------------------------------------------------------------
  function splitName(raw) {
    const s = String(raw || "").trim();
    let parts = s.split("|").map((x) => x.trim()).filter(Boolean);
    if (parts.length < 2) parts = s.split(/\s+\/\s+/).map((x) => x.trim()).filter(Boolean);
    return { name: parts[0] || s, sub: parts.slice(1).join(" ") };
  }

  function containsPath(big, small) {
    const s = "," + small.join(",") + ",";
    return ("," + big.join(",") + ",").includes(s) || ("," + [...big].reverse().join(",") + ",").includes(s);
  }

  // Маршрут с номером вливается в линию с тем же номером и типом, если его
  // станции — непрерывный кусок её пути (обратное направление без
  // reverseRouteId, укороченный вариант); цвет при этом не важен. Без номера —
  // как раньше, только при совпадении цвета. first — первый по порядку MTR
  // маршрут линии: цвет и название берутся из него
  function groupRoutes(routes, types) {
    const order = new Map(routes.map((r, i) => [r.id, i]));
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
      const host = groups.find((g) => (g.main.number || "") === (r.number || "") && g.main.type === r.type
        && (r.number || g.main.color === r.color) && containsPath(g.main.stationIds, r.stationIds));
      if (host) { host.routeIds.push(...ids); continue; }
      groups.push({ main: r, routeIds: ids });
    }
    const byId = new Map(sel.map((r) => [r.id, r]));
    for (const g of groups) {
      g.first = g.routeIds.map((id) => byId.get(id)).sort((a, b) => order.get(a.id) - order.get(b.id))[0];
    }
    return groups;
  }

  // Ключ «одинакового номера»: такие линии (ветки, которые одной
  // полилинией не нарисовать) объединяются группой — одна полоса, общий цвет
  const numberKey = (r) => (r.number ? r.type + "|" + r.number : "");

  // Шаг между станциями в клетках: 3, а для плотных сетей больше — чтобы
  // типичный широкий пучок (90-й перцентиль числа линий на перегоне)
  // помещался между станциями вместе со значками. Иначе у автобусов (9–14
  // линий в коридоре) пучок шире перегона и значки/подписи слипаются.
  function spacingCells(groups, grid, style) {
    const cnt = new Map();
    for (const g of groups) {
      for (const [a, b] of hopsOf(g.fullIds || g.main.stationIds)) {
        const k = hopKey(a, b);
        cnt.set(k, (cnt.get(k) || 0) + 1);
      }
    }
    const v = [...cnt.values()].sort((a, b) => a - b);
    if (!v.length) return SPACING_CELLS;
    const p90 = v[Math.floor(v.length * 0.9)];
    const bundle = p90 * ((style.lineWidth || 6) + (style.laneGap == null ? 1.5 : style.laneGap));
    return Math.max(SPACING_CELLS, Math.min(8, Math.ceil((bundle * 1.2) / grid)));
  }

  function computeMeta(groups, stById, grid, style, minGap) {
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
    // при заданном минимальном расстоянии типичный перегон — на клетку
    // длиннее него: иначе станции расталкиваются по спирали далеко от своих
    // мест, а станцию в изломе некуда сдвинуть на прямой участок
    const cells = Math.max(spacingCells(groups, grid, style || {}), minGap > 1 ? minGap + 1 : 0);
    return { scale: (cells * grid) / median, cx: n ? sx / n : 0, cz: n ? sz / n : 0, grid };
  }

  const pkey = (p) => p.x + "," + p.y;

  // Можно ли поставить станцию в клетку c: клетка не занята и (если задано
  // минимальное расстояние occ.minGap) ближе minGap клеток по каждой оси нет
  // другой станции. occ — Set занятых клеток; occ.pos/occ.grid/occ.minGap
  // задаёт buildFromMtr, self — id двигаемой станции
  function cellFree(occ, c, self) {
    if (occ.has(pkey(c))) return false;
    if (!(occ.minGap > 1) || !occ.pos) return true;
    const lim = (occ.minGap - 0.5) * occ.grid;
    for (const [id, q] of occ.pos) {
      if (id === self || id[0] === "~") continue;
      if (Math.abs(q.x - c.x) < lim && Math.abs(q.y - c.y) < lim) return false;
    }
    return true;
  }

  function placeFree(raw, grid, occ, self) {
    const sn = (v) => Math.round(v / grid) * grid;
    const base = { x: sn(raw.x), y: sn(raw.y) };
    if (cellFree(occ, base, self)) return base;
    for (let r = 1; r <= 12; r++) {
      let best = null, bestD = Infinity;
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const c = { x: base.x + dx * grid, y: base.y + dy * grid };
          if (!cellFree(occ, c, self)) continue;
          const d = Math.hypot(c.x - raw.x, c.y - raw.y);
          if (d < bestD) { bestD = d; best = c; }
        }
      }
      if (best) return best;
    }
    return base;
  }

  // Узлы сетки строго между p и q на октилинейном отрезке (без концов);
  // не по сетке / не октилинейно — пусто
  function gridCellsBetween(p, q, grid) {
    const dx = q.x - p.x, dy = q.y - p.y;
    if (dx && dy && Math.abs(dx) !== Math.abs(dy)) return [];
    const steps = Math.max(Math.abs(dx), Math.abs(dy)) / grid;
    if (!Number.isInteger(steps)) return [];
    const out = [];
    for (let k = 1; k < steps; k++) out.push({ x: p.x + (dx / steps) * k, y: p.y + (dy / steps) * k });
    return out;
  }
  // Варианты трассы перегона: прямой — один; иначе два излома (диагональ
  // первой или в конце). Каждый — список промежуточных узлов, включая излом
  function hopRoutes(a, b, grid) {
    const dx = b.x - a.x, dy = b.y - a.y;
    if (!dx || !dy || Math.abs(dx) === Math.abs(dy)) return [gridCellsBetween(a, b, grid)];
    const m = Math.min(Math.abs(dx), Math.abs(dy)), sx = Math.sign(dx), sy = Math.sign(dy);
    return [{ x: a.x + sx * m, y: a.y + sy * m }, { x: b.x - sx * m, y: b.y - sy * m }]
      .map((e) => [...gridCellsBetween(a, e, grid), e, ...gridCellsBetween(e, b, grid)]);
  }

  // via: hopKey -> точки трассы перегона, заданные заранее (от станции с
  // меньшим id); так slideOffBends оставляет излом там, откуда ушла станция
  function buildPath(ids, pos, occ, elbows, grid, via) {
    const pts = [];
    let prevDir = null;
    const sgn = Math.sign;
    // излом, у которого трасса проходит через чужую станцию, — хуже
    const through = (a, e, b) => [...gridCellsBetween(a, e, grid), e, ...gridCellsBetween(e, b, grid)]
      .filter((q) => occ.has(pkey(q))).length;
    for (let i = 0; i < ids.length; i++) {
      const b = pos.get(ids[i]);
      if (!b) continue;
      if (!pts.length) { pts.push(b); continue; }
      const a = pts[pts.length - 1];
      const dx = b.x - a.x, dy = b.y - a.y;
      if (!dx && !dy) continue;
      const fixed = via && via.get(hopKey(ids[i - 1], ids[i]));
      if (fixed && fixed.length) {
        const list = ids[i - 1] < ids[i] ? fixed : fixed.slice().reverse();
        for (const q of list) pts.push({ x: q.x, y: q.y });
        const e = list[list.length - 1];
        prevDir = sgn(b.x - e.x) + ":" + sgn(b.y - e.y);
      } else if (dx && dy && Math.abs(dx) !== Math.abs(dy)) {
        const segKey = [ids[i - 1], ids[i]].sort().join("|");
        let e = elbows.get(segKey);
        if (!e) {
          const m = Math.min(Math.abs(dx), Math.abs(dy));
          const eDiag = { x: a.x + sgn(dx) * m, y: a.y + sgn(dy) * m };
          const eStraight = { x: b.x - sgn(dx) * m, y: b.y - sgn(dy) * m };
          const dirOf = (p, q) => sgn(q.x - p.x) + ":" + sgn(q.y - p.y);
          // и дальше: если следующий перегон ровный, в станцию лучше
          // приходить в его направлении — иначе станция окажется в изломе
          const c2 = i + 1 < ids.length ? pos.get(ids[i + 1]) : null;
          const ox = c2 && c2.x - b.x, oy = c2 && c2.y - b.y;
          const nextDir = c2 && (ox || oy) && (!ox || !oy || Math.abs(ox) === Math.abs(oy)) ? dirOf(b, c2) : null;
          const score = (c) => through(a, c, b) * 10 + (prevDir && dirOf(a, c) !== prevDir ? 1 : 0)
            + (nextDir && dirOf(c, b) !== nextDir ? 1 : 0);
          e = score(eDiag) < score(eStraight) ? eDiag : eStraight;
          elbows.set(segKey, e);
        }
        pts.push({ x: e.x, y: e.y });
        prevDir = sgn(b.x - e.x) + ":" + sgn(b.y - e.y);
      } else {
        prevDir = sgn(dx) + ":" + sgn(dy);
      }
      pts.push(b);
    }
    // лишние точки на прямой убираем, но вершины в станциях оставляем —
    // перетаскивание станции двигает именно совпадающие с ней вершины
    const stationKeys = new Set(ids.map((id) => pos.get(id)).filter(Boolean).map(pkey));
    const out = [];
    for (const p of pts) {
      if (out.length && out[out.length - 1].x === p.x && out[out.length - 1].y === p.y) continue;
      if (out.length >= 2) {
        const a = out[out.length - 2], m = out[out.length - 1];
        if (!stationKeys.has(pkey(m)) && (m.x - a.x) * (p.y - m.y) === (m.y - a.y) * (p.x - m.x)
          && Math.sign(m.x - a.x) === Math.sign(p.x - m.x) && Math.sign(m.y - a.y) === Math.sign(p.y - m.y)) {
          out[out.length - 1] = { x: p.x, y: p.y };
          continue;
        }
      }
      out.push({ x: p.x, y: p.y });
    }
    return out;
  }

  /**
   * Станция не должна стоять в изломе: на повороте линия идёт дугой, и
   * значок оказывается на кривой. Если хоть одна линия поворачивает в
   * станции, станция сдвигается вдоль общего для всех её линий плеча на
   * k клеток (сколько нужно, чтобы дуга самой широкой полосы пучка не
   * доставала до значка, но не ближе клетки к следующей вершине), а излом
   * остаётся на старом месте — внутри функции это узел "~<id станции>" в
   * последовательности линий (полосам его потом даёт withJunctions).
   * Двигаются только новые станции; клетка-излом остаётся занятой, чтобы
   * туда не встала другая станция. Возвращает пути групп (fixed[i] — путь,
   * который уже задан и не перестраивается).
   */
  function slideOffBends(groups, fixed, pos, occ, movable, elbows, grid, style) {
    const via = new Map();
    const idsOf = groups.map((gr) => gr.fullIds.filter((id) => pos.has(id)).filter((id, i, arr) => i === 0 || id !== arr[i - 1]));
    const build = (gi) => buildPath(idsOf[gi], pos, occ, elbows, grid, via);
    const paths = groups.map((_, gi) => fixed[gi] || build(gi));
    const byStation = new Map();
    groups.forEach((_, gi) => {
      if (fixed[gi]) return;
      for (const id of new Set(idsOf[gi])) {
        if (!movable.has(id)) continue;
        if (!byStation.has(id)) byStation.set(id, []);
        byStation.get(id).push(gi);
      }
    });
    // индексы точек пути, в которых стоят станции ids (−1 — не нашли)
    const stationIdx = (pts, ids) => {
      const out = [];
      let k = 0;
      for (const id of ids) {
        const p = pos.get(id);
        while (k < pts.length && (pts[k].x !== p.x || pts[k].y !== p.y)) k++;
        out.push(k < pts.length ? k : -1);
        if (k >= pts.length) k = 0;
      }
      return out;
    };
    const onSeg = (p, a, b) => (b.x - a.x) * (p.y - a.y) === (b.y - a.y) * (p.x - a.x)
      && p.x >= Math.min(a.x, b.x) && p.x <= Math.max(a.x, b.x) && p.y >= Math.min(a.y, b.y) && p.y <= Math.max(a.y, b.y);
    const lw = style.lineWidth, step = lw + style.laneGap;
    const order = [...byStation.keys()].sort((a, b) => byStation.get(b).length - byStation.get(a).length);
    for (const sid of order) {
      const gis = byStation.get(sid);
      const p0 = pos.get(sid);
      const occs = [];
      let broken = false;
      for (const gi of gis) {
        const pts = paths[gi], ids = idsOf[gi], sIdx = stationIdx(pts, ids);
        ids.forEach((id, j) => {
          if (id !== sid) return;
          const k = sIdx[j];
          if (k < 0) { broken = true; return; }
          const arms = [];
          for (const [nj, nk] of [[j - 1, k - 1], [j + 1, k + 1]]) {
            if (nj < 0 || nj >= ids.length) continue;
            const q = pts[nk], end = sIdx[nj];
            if (!q || end < 0) { broken = true; continue; }
            const between = nj < j ? pts.slice(end + 1, k).reverse() : pts.slice(k + 1, end);
            arms.push({ dx: Math.sign(q.x - p0.x), dy: Math.sign(q.y - p0.y), len: Math.max(Math.abs(q.x - p0.x), Math.abs(q.y - p0.y)) / grid, nb: ids[nj], before: nj < j, between });
          }
          occs.push({ gi, j, arms });
        });
      }
      if (broken || !occs.length) continue;
      // поворот = два плеча не на одной прямой; разворот назад не трогаем
      let turn = 0;
      for (const { arms } of occs) {
        if (arms.length < 2) continue;
        const [a, b] = arms;
        if (a.dx === b.dx && a.dy === b.dy) { turn = -1; break; }
        if (a.dx === -b.dx && a.dy === -b.dy) continue;
        const ang = Math.acos(Math.max(-1, Math.min(1, -(a.dx * b.dx + a.dy * b.dy) / Math.hypot(a.dx, a.dy) / Math.hypot(b.dx, b.dy))));
        turn = Math.max(turn, ang);
      }
      if (turn <= 0) continue;
      // сколько пикселей нужно от значка до излома: внутренняя полоса пучка
      // поворачивает раньше на off·tan(θ/2), затем дуга радиуса R, затем
      // половина значка
      const maxOff = ((gis.length - 1) / 2) * step + lw / 2;
      const needPx = maxOff * Math.tan(turn / 2) + style.cornerRadius + lw;
      let best = null;
      for (let ux = -1; ux <= 1; ux++) {
        for (let uy = -1; uy <= 1; uy++) {
          if (!ux && !uy) continue;
          let minLen = Infinity;
          for (const { arms } of occs) {
            const a = arms.find((x) => x.dx === ux && x.dy === uy);
            minLen = a ? Math.min(minLen, a.len) : -1;
            if (minLen < 0) break;
          }
          // до следующей вершины плеча остаётся не меньше половины его
          // длины — иначе станция прилипает к соседней
          const maxK = Math.floor(minLen) - Math.max(1, Math.ceil(minLen / 2));
          if (maxK < 1) continue;
          const cell = grid * Math.hypot(ux, uy);
          const k = Math.min(maxK, Math.max(1, Math.ceil(needPx / cell)));
          const np = { x: p0.x + ux * k * grid, y: p0.y + uy * k * grid };
          if (!cellFree(occ, np, sid)) continue;
          // в новой клетке не должно быть чужих линий
          const foreign = paths.some((pts, gi) => !gis.includes(gi) && pts.some((q, i) => i > 0 && onSeg(np, pts[i - 1], q)));
          if (foreign) continue;
          const score = Math.min(k * cell, needPx) * 100 + minLen;
          if (!best || score > best.score) best = { ux, uy, np, score };
        }
      }
      if (!best) continue;
      // плечо вдоль сдвига сохраняет свою трассу; остальные плечи идут
      // станция → излом (прямо) → прежняя трасса до соседа
      const vid = "~" + sid;
      const ins = new Map(); // gi -> индексы вставки излома
      for (const { gi, j, arms } of occs) {
        for (const a of arms) {
          const setVia = (x, list) => via.set(hopKey(x, a.nb), x < a.nb ? list : list.slice().reverse());
          if (a.dx === best.ux && a.dy === best.uy) { setVia(sid, a.between); continue; }
          setVia(vid, a.between);
          if (!ins.has(gi)) ins.set(gi, []);
          ins.get(gi).push(a.before ? j : j + 1);
        }
      }
      for (const [gi, at] of ins) at.sort((a, b) => b - a).forEach((k) => idsOf[gi].splice(k, 0, vid));
      // старая клетка остаётся занятой изломом
      pos.set(vid, p0);
      pos.set(sid, best.np);
      occ.add(pkey(best.np));
      for (const gi of gis) paths[gi] = build(gi);
    }
    for (const id of [...pos.keys()]) if (id[0] === "~") pos.delete(id);
    return paths;
  }

  /**
   * Последовательность узлов линии для assignLanes: станции плюс
   * вершины-развилки — не станция, но линии через неё уходят в разные
   * стороны (излом, с которого slideOffBends увёл станцию). Отрезок до
   * развилки общий для всех этих линий, и пучок на нём должен быть один;
   * если считать его частью разных перегонов, полосы на нём наложатся.
   * Выводится из геометрии, поэтому пересборка с сохранёнными точками
   * даёт те же полосы. Развилки добавляются в pos как "~x,y".
   */
  // Отрезки разных линий, совпадающие на части длины (изгиб одной линии
  // лежит на прямом отрезке другой): полосы считаются по перегонам, и такие
  // куски были бы РАЗНЫМИ перегонами на одной трассе — линия рисовалась
  // посреди чужого пучка, пересекая его. Чужая вершина, от которой линии
  // идут вместе, вставляется в отрезок (через ins — со сдвигом lanes), и
  // withJunctions делает её развилкой
  function splitOverlaps(lines, ins) {
    const onSeg = (p, a, b) => (b.x - a.x) * (p.y - a.y) === (b.y - a.y) * (p.x - a.x)
      && Math.min(a.x, b.x) <= p.x && p.x <= Math.max(a.x, b.x) && Math.min(a.y, b.y) <= p.y && p.y <= Math.max(a.y, b.y)
      && !(p.x === a.x && p.y === a.y) && !(p.x === b.x && p.y === b.y);
    const par = (a, b, c, d) => (b.x - a.x) * (d.y - c.y) === (b.y - a.y) * (d.x - c.x);
    for (let pass = 0; pass < 4; pass++) {
      let changed = false;
      for (const l of lines) {
        for (let i = 0; i + 1 < l.points.length; i++) {
          const a = l.points[i], b = l.points[i + 1];
          let hit = null;
          for (const o of lines) {
            if (o === l) continue;
            for (let j = 0; j < o.points.length && !hit; j++) {
              const v = o.points[j];
              if (!onSeg(v, a, b)) continue;
              // совпадение, а не просто пересечение: соседний отрезок o
              // идёт вдоль a→b
              const nb = [o.points[j - 1], o.points[j + 1]].filter(Boolean);
              if (nb.some((q) => par(a, b, v, q) && (q.x !== v.x || q.y !== v.y))) hit = v;
            }
            if (hit) break;
          }
          if (hit) { ins(l, i + 1, { x: hit.x, y: hit.y }); changed = true; }
        }
      }
      if (!changed) break;
    }
  }

  function withJunctions(lines, stationIds, pos) {
    const stKeys = new Set(stationIds.map((id) => pos.get(id)).filter(Boolean).map(pkey));
    const dir = (v, q) => Math.sign(q.x - v.x) + ":" + Math.sign(q.y - v.y);
    const arms = new Map();
    for (const l of lines) {
      for (let i = 1; i + 1 < l.points.length; i++) {
        const v = l.points[i], k = pkey(v);
        if (stKeys.has(k)) continue;
        if (!arms.has(k)) arms.set(k, new Set());
        arms.get(k).add([dir(v, l.points[i - 1]), dir(v, l.points[i + 1])].sort().join("|"));
      }
    }
    const junction = new Set([...arms].filter(([, s]) => s.size > 1).map(([k]) => k));
    for (const l of lines) {
      const ids = l._fullIds.filter((id) => pos.has(id)).filter((id, i, arr) => i === 0 || id !== arr[i - 1]);
      const out = [];
      let k = 0, ok = true;
      for (const id of ids) {
        const p = pos.get(id);
        const from = k;
        while (k < l.points.length && (l.points[k].x !== p.x || l.points[k].y !== p.y)) k++;
        if (k >= l.points.length) { ok = false; break; }
        if (out.length) {
          for (let i = from + 1; i < k; i++) {
            const q = l.points[i], key = pkey(q);
            if (!junction.has(key)) continue;
            pos.set("~" + key, { x: q.x, y: q.y });
            out.push("~" + key);
          }
        }
        out.push(id);
      }
      if (ok) l._fullIds = out;
    }
  }

  // Перегоны линии: пары соседних РАЗНЫХ станций по порядку
  function hopsOf(ids) {
    const out = [];
    for (let i = 1; i < ids.length; i++) if (ids[i] !== ids[i - 1]) out.push([ids[i - 1], ids[i]]);
    return out;
  }
  const hopKey = (a, b) => (a < b ? a + "|" + b : b + "|" + a);

  // Ближайшее октилинейное направление и отклонение от него (радианы)
  function octi(dx, dy) {
    const ang = Math.atan2(dy, dx);
    const k = Math.round(ang / (Math.PI / 4));
    return { ang: k * Math.PI / 4, dev: Math.abs(ang - k * Math.PI / 4) };
  }

  /**
   * Выпрямление: перегоны, отклонённые от 0/45/90° не больше чем на tolDeg,
   * подтягиваются до ровных (итеративно, ошибка делится между концами;
   * закреплённые станции не двигаются). Работает в «сырых» координатах,
   * до привязки к сетке. Возвращает множество выравниваемых перегонов.
   */
  function straighten(raw, hops, locked, tolDeg) {
    const alignable = new Set();
    if (!tolDeg) return alignable;
    const tol = (tolDeg * Math.PI) / 180;
    for (const [a, b] of hops) {
      const pa = raw.get(a), pb = raw.get(b);
      if (octi(pb.x - pa.x, pb.y - pa.y).dev <= tol) alignable.add(hopKey(a, b));
    }
    for (let pass = 0; pass < 40; pass++) {
      for (const [a, b] of hops) {
        if (!alignable.has(hopKey(a, b))) continue;
        const ma = locked.has(a) ? 0 : 1, mb = locked.has(b) ? 0 : 1;
        if (!ma && !mb) continue;
        const pa = raw.get(a), pb = raw.get(b);
        const dx = pb.x - pa.x, dy = pb.y - pa.y;
        if (!dx && !dy) continue;
        const { ang } = octi(dx, dy);
        const ux = Math.cos(ang), uy = Math.sin(ang);
        const proj = dx * ux + dy * uy;
        const ex = dx - ux * proj, ey = dy - uy * proj; // поперечная ошибка
        const wa = ma / (ma + mb), wb = mb / (ma + mb);
        pa.x += ex * wa; pa.y += ey * wa;
        pb.x -= ex * wb; pb.y -= ey * wb;
      }
    }
    return alignable;
  }

  // После привязки к сетке ровный перегон может съехать на клетку —
  // двигаем новые станции на соседние клетки, пока растёт число ровных
  function gridAlign(pos, hops, alignable, movable, occ, grid) {
    const adj = new Map();
    for (const [a, b] of hops) {
      if (!alignable.has(hopKey(a, b))) continue;
      if (!adj.has(a)) adj.set(a, []);
      if (!adj.has(b)) adj.set(b, []);
      adj.get(a).push(b);
      adj.get(b).push(a);
    }
    const exact = (p, q) => { const dx = q.x - p.x, dy = q.y - p.y; return (dx || dy) && (!dx || !dy || Math.abs(dx) === Math.abs(dy)); };
    const score = (id, p) => adj.get(id).reduce((s, o) => s + (exact(p, pos.get(o)) ? 1 : 0), 0);
    for (let pass = 0; pass < 8; pass++) {
      let changed = false;
      for (const id of movable) {
        if (!adj.has(id)) continue;
        const cur = pos.get(id);
        let best = cur, bestS = score(id, cur);
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            if (!dx && !dy) continue;
            const c = { x: cur.x + dx * grid, y: cur.y + dy * grid };
            if (!cellFree(occ, c, id)) continue;
            const s = score(id, c);
            if (s > bestS) { best = c; bestS = s; }
          }
        }
        if (best !== cur) {
          occ.delete(pkey(cur));
          occ.add(pkey(best));
          pos.set(id, best);
          changed = true;
        }
      }
      if (!changed) break;
    }
  }

  /**
   * Перегон, трасса которого проходит через узел с чужой станцией, рисуется
   * «сквозь» неё — выглядит как остановка, которой нет, или как линия поверх
   * значка. Такие узлы разводим: новые станции (концы перегона или та, что
   * на пути) сдвигаются на соседнюю свободную клетку, если это уменьшает
   * число проходов сквозь станции, не ломая ровные перегоны. Перегон с
   * изломом засчитывается по лучшему из двух вариантов (buildPath потом
   * выберет именно его).
   */
  function untangle(pos, hops, alignable, movable, occ, grid) {
    const at = new Map();
    for (const [id, p] of pos) at.set(pkey(p), id);
    const hopCost = (a, b) => {
      const pa = pos.get(a), pb = pos.get(b);
      let best = Infinity;
      for (const r of hopRoutes(pa, pb, grid)) {
        let n = 0;
        for (const q of r) { const k = pkey(q); if (occ.has(k) && at.get(k) !== a && at.get(k) !== b) n++; }
        best = Math.min(best, n);
      }
      return best;
    };
    const exact = (p, q) => { const dx = q.x - p.x, dy = q.y - p.y; return (dx || dy) && (!dx || !dy || Math.abs(dx) === Math.abs(dy)); };
    const inc = new Map();
    for (const h of hops) for (const id of h) { if (!inc.has(id)) inc.set(id, []); inc.get(id).push(h); }
    const aligned = (id) => (inc.get(id) || []).reduce((s, [a, b]) => s + (alignable.has(hopKey(a, b)) && exact(pos.get(a), pos.get(b)) ? 1 : 0), 0);
    const total = () => hops.reduce((s, [a, b]) => s + hopCost(a, b), 0);
    const moveTo = (id, c) => {
      const cur = pos.get(id);
      occ.delete(pkey(cur)); at.delete(pkey(cur));
      pos.set(id, c); occ.add(pkey(c)); at.set(pkey(c), id);
    };
    for (let pass = 0; pass < 6; pass++) {
      const involved = new Set();
      for (const [a, b] of hops) {
        if (!hopCost(a, b)) continue;
        involved.add(a); involved.add(b);
        for (const r of hopRoutes(pos.get(a), pos.get(b), grid)) for (const q of r) { const id = at.get(pkey(q)); if (id) involved.add(id); }
      }
      let changed = false;
      for (const id of involved) {
        if (!movable.has(id)) continue;
        const cur = pos.get(id);
        let best = cur, bestS = total() * 10 - aligned(id);
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            if (!dx && !dy) continue;
            const c = { x: cur.x + dx * grid, y: cur.y + dy * grid };
            if (!cellFree(occ, c, id)) continue;
            moveTo(id, c);
            const s = total() * 10 - aligned(id);
            if (s < bestS) { best = c; bestS = s; }
            moveTo(id, cur);
          }
        }
        if (best !== cur) { moveTo(id, best); changed = true; }
      }
      if (!changed) break;
    }
  }

  /**
   * Станция на клетку в стороне от прямой соседей (коридор идёт по x=1, а
   * станция на x=0) даёт V-образный крюк всех её линий: два излома рядом со
   * станцией и станция в изломе. Локальный поиск: новая станция переходит
   * на соседнюю свободную клетку, если от этого у её линий меньше изломов —
   * в перегонах, в самой станции и в соседних станциях (их следующий
   * перегон берётся, если он ровный). Проход трассы через чужую станцию —
   * штраф ×10, как в untangle.
   */
  function unbend(pos, groups, movable, occ, grid) {
    const seqs = groups.map((g) => g.fullIds.filter((id) => pos.has(id)).filter((id, i, a) => i === 0 || id !== a[i - 1]));
    const occBy = new Map();
    seqs.forEach((s, si) => s.forEach((id, i) => {
      if (!movable.has(id)) return;
      if (!occBy.has(id)) occBy.set(id, []);
      occBy.get(id).push([si, i]);
    }));
    const at = new Map();
    for (const [id, p] of pos) at.set(pkey(p), id);
    const allHops = [];
    const seenHop = new Set();
    for (const s of seqs) for (const [a, b] of hopsOf(s)) { const k = hopKey(a, b); if (!seenHop.has(k)) { seenHop.add(k); allHops.push([a, b]); } }
    const dirOf = (p, q) => Math.sign(q.x - p.x) + ":" + Math.sign(q.y - p.y);
    const octiHop = (p, q) => { const dx = q.x - p.x, dy = q.y - p.y; return (dx || dy) && (!dx || !dy || Math.abs(dx) === Math.abs(dy)); };
    // варианты трассы a→b: первый/последний шаг, излом, проходы сквозь станции
    const variants = (aId, bId) => {
      const a = pos.get(aId), b = pos.get(bId);
      const rs = hopRoutes(a, b, grid);
      return rs.map((r) => ({
        first: dirOf(a, r[0] || b), last: dirOf(r[r.length - 1] || a, b), elbow: rs.length > 1 ? 1 : 0,
        through: r.filter((q) => { const id = at.get(pkey(q)); return id && id !== aId && id !== bId; }).length,
      }));
    };
    // сколько чужих перегонов неизбежно (во всех вариантах) идёт через клетку
    const forcedThrough = (c, self) => {
      let n = 0;
      for (const [a, b] of allHops) {
        if (a === self || b === self) continue;
        const pa = pos.get(a), pb = pos.get(b);
        // трасса не выходит из габарита концов — дальние перегоны не считаем
        if (c.x < Math.min(pa.x, pb.x) || c.x > Math.max(pa.x, pb.x) || c.y < Math.min(pa.y, pb.y) || c.y > Math.max(pa.y, pb.y)) continue;
        const rs = hopRoutes(pa, pb, grid);
        if (rs.every((r) => r.some((q) => q.x === c.x && q.y === c.y))) n++;
      }
      return n;
    };
    const localCost = (id) => {
      let cost = 0;
      for (const [si, i] of occBy.get(id)) {
        const s = seqs[si];
        const vin = i > 0 ? variants(s[i - 1], id) : [null];
        const vout = i + 1 < s.length ? variants(id, s[i + 1]) : [null];
        const before = i > 1 && octiHop(pos.get(s[i - 2]), pos.get(s[i - 1])) ? dirOf(pos.get(s[i - 2]), pos.get(s[i - 1])) : null;
        const after = i + 2 < s.length && octiHop(pos.get(s[i + 1]), pos.get(s[i + 2])) ? dirOf(pos.get(s[i + 1]), pos.get(s[i + 2])) : null;
        let best = Infinity;
        for (const a of vin) {
          for (const b of vout) {
            let c = 0;
            if (a) c += a.elbow + 10 * a.through + (before && a.first !== before ? 3 : 0);
            if (b) c += b.elbow + 10 * b.through + (after && b.last !== after ? 3 : 0);
            if (a && b && a.last !== b.first) c += 3;
            best = Math.min(best, c);
          }
        }
        cost += best;
      }
      return cost;
    };
    const moveTo = (id, c) => {
      const cur = pos.get(id);
      occ.delete(pkey(cur)); at.delete(pkey(cur));
      pos.set(id, c); occ.add(pkey(c)); at.set(pkey(c), id);
    };
    for (let pass = 0; pass < 4; pass++) {
      let changed = false;
      // сначала самые «изломанные»: иначе сосед успевает подстроиться под
      // станцию с крюком, и коридор съезжает на клетку вместе с ней
      const ordered = [...occBy.keys()].map((id) => [id, localCost(id)]).sort((a, b) => b[1] - a[1]).map((x) => x[0]);
      for (const id of ordered) {
        const cur = pos.get(id);
        const base = localCost(id) + 10 * forcedThrough(cur, id);
        if (!base) continue;
        let best = null, bestS = base;
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            if (!dx && !dy) continue;
            const c = { x: cur.x + dx * grid, y: cur.y + dy * grid };
            if (!cellFree(occ, c, id)) continue;
            moveTo(id, c);
            const s = localCost(id) + 10 * forcedThrough(c, id);
            moveTo(id, cur);
            if (s < bestS) { best = c; bestS = s; }
          }
        }
        if (best) { moveTo(id, best); changed = true; }
      }
      if (!changed) break;
    }
  }

  /**
   * Полосы в пучках: на КАЖДОМ перегоне линии, идущие по нему, собираются
   * по центру (без пустых полос), а порядок выбирается так, чтобы линии не
   * перекрещивались: для пары линий идём назад (потом вперёд) по общему
   * пути до точки расхождения — та, что уходит левее, идёт левой полосой.
   * Полоса > 0 = слева от направления полилинии.
   */
  function assignLanes(lines, pos) {
    const hops = new Map(); // hopKey -> { a, b, entries: [{ line, seq, idx }] }
    // сквозные проезды: "g>h" -> { g, h, v, keys:Set } — линии, идущие по
    // перегону g и сразу по h через общую станцию v
    const through = new Map();
    const laneKey = (line) => (line.group ? "g:" + line.group : line.id);
    lines.forEach((line, order) => {
      const ids = (line._fullIds || line.mtrStationIds).filter((id, i, arr) => i === 0 || id !== arr[i - 1]);
      line._hopLanes = [];
      for (let i = 0; i + 1 < ids.length; i++) {
        const a = ids[i], b = ids[i + 1];
        const k = hopKey(a, b);
        if (!hops.has(k)) hops.set(k, { a: a < b ? a : b, b: a < b ? b : a, entries: [] });
        if (i > 0) {
          const g = hopKey(ids[i - 1], a);
          for (const [x, y] of [[g, k], [k, g]]) {
            const tk = x + ">" + y;
            if (!through.has(tk)) through.set(tk, { g: x, h: y, v: a, keys: new Set() });
            through.get(tk).keys.add(laneKey(line));
          }
        }
        const h = hops.get(k);
        // последовательность в ориентации перегона a→b
        const fwd = ids[i] === h.a;
        const seq = fwd ? ids : [...ids].reverse();
        const idx = fwd ? i : ids.length - 2 - i;
        // и в обратной ориентации (для сравнения в системе хода другой линии)
        const seqR = fwd ? [...ids].reverse() : ids;
        const idxR = seq.length - 2 - idx;
        const entry = { line, order, seq, idx, seqR, idxR, dir: fwd ? 1 : -1, hopIdx: i };
        // объединённые линии (и повторный проезд одной линии по тому же перегону) — одной полосой
        // (раньше проверялась только группа — линия с разворотом по тому же
        // пути занимала две полосы и рисовалась узкой петлёй)
        const twin = h.entries.find((x) => x.line === line || (line.group && x.line.group === line.group));
        if (twin) (twin.dups || (twin.dups = [])).push(entry); else h.entries.push(entry);
      }
    });
    const P = (id) => pos.get(id);
    const vsub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
    const leftness = (v, t) => Math.atan2(v.x * t.y - v.y * t.x, v.x * t.x + v.y * t.y);
    // Идём по общему пути от станции (i1 в s1, i2 в s2) шагом step, пока линии
    // совпадают. Если одна линия пропускает остановки, а через 1–4 станции
    // пути снова сходятся — это не расхождение, идём дальше (иначе порядок
    // решала бы почти нулевая разница углов и линии «переплетались»).
    // Возвращает последнюю общую станцию перед настоящим расхождением или
    // null, если одна из линий закончилась.
    function walk(s1, i1, s2, i2, step) {
      const inside = (s, i) => i >= 0 && i < s.length;
      for (;;) {
        const n1 = i1 + step, n2 = i2 + step;
        if (!inside(s1, n1) || !inside(s2, n2)) return null;
        if (s1[n1] === s2[n2]) { i1 = n1; i2 = n2; continue; }
        let rejoin = null;
        for (let k1 = 1; k1 <= 4 && !rejoin; k1++) {
          for (let k2 = 1; k2 <= 4; k2++) {
            const a = i1 + step * k1, b = i2 + step * k2;
            if (inside(s1, a) && inside(s2, b) && s1[a] === s2[b]) { rejoin = [a, b]; break; }
          }
        }
        if (!rejoin) return { i1, i2 };
        [i1, i2] = rejoin;
      }
    }
    const MIN_ANGLE = 0.05; // ~3°: меньше — шум раскладки, а не сторона
    // Сравнение пары ведётся в системе ХОДА опорной линии (раньше по
    // порядку), а не в системе перегона (отсортированные id): та
    // переворачивается от перегона к перегону, и «назад» означало то один
    // конец общего коридора, то другой — если концы противоречат друг другу,
    // линии менялись сторонами на каждой станции. В системе опорной линии
    // решение для пары одно на весь коридор, и пересечение — одно, на конце.
    function cmp(e1, e2) {
      const ref = e1.order < e2.order ? e1 : e2;
      const flip = ref.dir === -1;
      const s1 = flip ? e1.seqR : e1.seq, s2 = flip ? e2.seqR : e2.seq;
      const i1 = flip ? e1.idxR : e1.idx, i2 = flip ? e2.idxR : e2.idx;
      const inRef = (r) => r * ref.dir; // результат в системе ref → в системе перегона
      // назад: та линия, что приходит левее (относительно хода ref), — левее
      const rb = walk(s1, i1, s2, i2, -1);
      if (rb) {
        const v = P(s1[rb.i1]), t = vsub(P(s1[rb.i1 + 1]), v);
        const back = { x: -t.x, y: -t.y };
        const l1 = -leftness(vsub(P(s1[rb.i1 - 1]), v), back), l2 = -leftness(vsub(P(s2[rb.i2 - 1]), v), back);
        if (Math.abs(l1 - l2) > MIN_ANGLE) return inRef(l2 - l1);
      }
      // вперёд: та, что уходит левее, — левее
      const rf = walk(s1, i1 + 1, s2, i2 + 1, 1);
      if (rf) {
        const w = P(s1[rf.i1]), t = vsub(w, P(s1[rf.i1 - 1]));
        const l1 = leftness(vsub(P(s1[rf.i1 + 1]), w), t), l2 = leftness(vsub(P(s2[rf.i2 + 1]), w), t);
        if (Math.abs(l1 - l2) > MIN_ANGLE) return inRef(l2 - l1);
      }
      // расхождения нет (общий путь целиком) — по номеру линии
      return inRef(e1.order - e2.order);
    }
    // Порядок на перегоне. Раньше каждый перегон сортировался сам по себе
    // через cmp, а cmp для трёх и более линий не транзитивен: при другом
    // составе пучка (линия ушла / добавилась) порядок остальных менялся, и
    // в плотных автобусных коридорах линии менялись местами на каждой
    // станции. Теперь перегоны обрабатываются от самого загруженного по
    // связям: каждый следующий наследует взаимный порядок общих с уже
    // упорядоченными соседями линий (вес 3), cmp решает остальное (вес 1),
    // итог — по числу «побед» (Копленд), устойчиво к нетранзитивности.
    const byH = new Map(), byG = new Map();
    for (const r of through.values()) {
      if (!byH.has(r.h)) byH.set(r.h, []);
      byH.get(r.h).push(r);
      if (!byG.has(r.g)) byG.set(r.g, []);
      byG.get(r.g).push(r);
    }
    const posIn = new Map(); // hopKey -> Map(laneKey -> позиция; больше = левее в системе перегона a→b)
    const sIn = (hk, v) => (hops.get(hk).b === v ? 1 : -1); // приезд в v по перегону: совпадает с a→b?
    const sOut = (hk, v) => (hops.get(hk).a === v ? 1 : -1); // отъезд из v
    const assign = (m, e, base) => {
      m.set(laneKey(e.line), base);
      e.line._hopLanes[e.hopIdx] = base * e.dir;
      (e.dups || []).forEach((d) => { d.line._hopLanes[d.hopIdx] = base * d.dir; });
    };
    // Перегон, ВСЕ линии которого приходят через узел v с одного уже
    // упорядоченного соседнего перегона g (пучок только теряет линии или
    // идёт целиком), берёт порядок g — иначе линии меняются местами в узле.
    // В развилке вне станции (узел "~", её не прикрывает значок) берутся и
    // сами позиции: пересчёт к центру давал ступеньку у оставшихся линий.
    // Если ушедшая линия была в середине, до следующей станции остаётся
    // пустая полоса — к центру пучок вернётся под значком станции
    function inheritFrom(hk) {
      const list = hops.get(hk).entries;
      for (const r of byH.get(hk) || []) {
        if (r.g === hk || !posIn.has(r.g) || !list.every((e) => r.keys.has(laneKey(e.line)))) continue;
        const pg = posIn.get(r.g), sg = sIn(r.g, r.v) * sOut(hk, r.v);
        const val = (e) => pg.get(laneKey(e.line)) * sg; // больше = левее в системе hk
        if (list.some((e) => val(e) == null || Number.isNaN(val(e)))) continue;
        const sorted = list.slice().sort((a, b) => val(b) - val(a));
        const vals = sorted.map(val);
        // в станции — тоже, если пучок без дыр и смещён от оси не больше
        // чем на полосу: одиночная линия после развилки иначе делала
        // ступеньку прямо у тонкого значка
        const tight = vals.every((v, i) => !i || Math.abs(vals[i - 1] - v - 1) < 1e-6);
        const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
        const keep = r.v[0] === "~" || (tight && Math.abs(mean) <= 1);
        const n = list.length, m = new Map();
        sorted.forEach((e, k) => assign(m, e, keep ? vals[k] : (n - 1) / 2 - k));
        posIn.set(hk, m);
        return true;
      }
      return false;
    }
    function orderHop(hk) {
      if (inheritFrom(hk)) return;
      const list = hops.get(hk).entries;
      const n = list.length;
      const score = new Array(n).fill(0);
      const nb = (byH.get(hk) || []).filter((r) => posIn.has(r.g));
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const ki = laneKey(list[i].line), kj = laneKey(list[j].line);
          let pref = -Math.sign(cmp(list[i], list[j])); // > 0 — i левее j
          for (const r of nb) {
            if (!r.keys.has(ki) || !r.keys.has(kj)) continue;
            const pg = posIn.get(r.g);
            pref += 3 * Math.sign(pg.get(ki) - pg.get(kj)) * sIn(r.g, r.v) * sOut(hk, r.v);
          }
          score[i] += Math.sign(pref);
          score[j] -= Math.sign(pref);
        }
      }
      const idx = list.map((_, i) => i).sort((i, j) => score[j] - score[i] || cmp(list[i], list[j]));
      const m = new Map();
      idx.forEach((i, k) => assign(m, list[i], (n - 1) / 2 - k));
      posIn.set(hk, m);
    }
    const frontier = new Map();
    const allHops = [...hops.keys()];
    for (let step = 0; step < allHops.length; step++) {
      let best = null, bf = -1, bn = -1;
      for (const k of allHops) {
        if (posIn.has(k)) continue;
        const f = frontier.get(k) || 0, n = hops.get(k).entries.length;
        if (f > bf || (f === bf && n > bn)) { best = k; bf = f; bn = n; }
      }
      orderHop(best);
      for (const r of byG.get(best) || []) frontier.set(r.h, (frontier.get(r.h) || 0) + r.keys.size);
    }
    // Развилки вне станций (узлы "~"): линии, продолжающие путь с соседнего
    // перегона g, сохраняют на перегоне свои позиции с g, а новые (пришли
    // с другой стороны) встают С КРАЮ — следом за крайней продолжающей.
    // Иначе пучок пересчитывался к центру и все линии делали ступеньку;
    // так бывает и при «стволе», упорядоченном позже ветки, и когда в одном
    // узле линии и приходят, и уходят. Если новая линия по порядку попала
    // между продолжающими или порядок продолжающих не совпал — не трогаем
    for (let pass = 0; pass < 3; pass++) {
      for (const hk of allHops) {
        const list = hops.get(hk).entries, cur = posIn.get(hk);
        const byCur = list.slice().sort((a, b) => cur.get(laneKey(b.line)) - cur.get(laneKey(a.line)));
        let best = null;
        for (const r of byH.get(hk) || []) {
          if (r.v[0] !== "~" || r.g === hk || !posIn.has(r.g)) continue;
          const cont = byCur.filter((e) => r.keys.has(laneKey(e.line)));
          if (cont.length && (!best || cont.length > best.cont.length)) best = { r, cont };
        }
        if (!best) continue;
        const { r, cont } = best;
        const pg = posIn.get(r.g), sg = sIn(r.g, r.v) * sOut(hk, r.v);
        const val = (e) => pg.get(laneKey(e.line)) * sg;
        if (cont.some((e, i) => i && !(val(cont[i - 1]) > val(e)))) continue;
        const first = byCur.indexOf(cont[0]), last = byCur.indexOf(cont[cont.length - 1]);
        if (last - first + 1 !== cont.length) continue;
        const m = new Map();
        byCur.forEach((e, k) => assign(m, e, k < first ? val(cont[0]) + (first - k)
          : k > last ? val(cont[cont.length - 1]) - (k - last) : val(e)));
        posIn.set(hk, m);
      }
    }
    // полосы перегонов → полосы отрезков полилинии (между станциями бывают изломы)
    for (const line of lines) {
      const ids = (line._fullIds || line.mtrStationIds).filter((id, i, arr) => i === 0 || id !== arr[i - 1]);
      const lanes = [];
      let h = 0;
      for (let i = 0; i + 1 < line.points.length; i++) {
        lanes.push(line._hopLanes[Math.min(h, line._hopLanes.length - 1)] || 0);
        const q = line.points[i + 1], next = P(ids[h + 1]);
        if (next && q.x === next.x && q.y === next.y) h++;
      }
      line.lanes = lanes;
      delete line._hopLanes;
      delete line._fullIds;
    }
  }

  /**
   * Уплотнение пучков: если на отрезке между полосами нет ни одной линии (дыра —
   * соседей по пучку здесь нет, они присоединяются дальше), полосы сдвигаются
   * вплотную вокруг прежней середины. Линии идут рядом сразу после поворота и
   * расходятся к своим местам в пучке только там, где присоединяются остальные.
   * Порядок линий не меняется, равные полосы (общая группа) остаются равными.
   */
  function compactLanes(lines) {
    const segs = new Map();
    for (const l of lines) {
      if (!l.lanes) continue;
      for (let i = 0; i + 1 < l.points.length; i++) {
        const a = l.points[i], b = l.points[i + 1];
        const fwd = a.x < b.x || (a.x === b.x && a.y < b.y);
        const key = (fwd ? [a, b] : [b, a]).map(pkey).join(">");
        if (!segs.has(key)) segs.set(key, []);
        segs.get(key).push({ l, i, sign: fwd ? 1 : -1 });
      }
    }
    // предложение: новые полосы отрезков, где есть дыры
    const prop = new Map(); // key → [{e, lane}]
    for (const [key, arr] of segs) {
      if (arr.length < 2) continue;
      const val = (e) => Math.round((e.l.lanes[e.i] || 0) * e.sign * 100) / 100;
      const vs = [...new Set(arr.map(val))].sort((x, y) => x - y);
      if (vs.length < 2 || !vs.some((v, j) => j && v - vs[j - 1] > 1.01)) continue;
      const m = [0];
      for (let j = 1; j < vs.length; j++) m.push(m[j - 1] + Math.min(1, vs[j] - vs[j - 1]));
      const shift = (vs[0] + vs[vs.length - 1]) / 2 - (m[0] + m[m.length - 1]) / 2;
      prop.set(key, arr.map((e) => ({ e, lane: e.sign * (m[vs.indexOf(val(e))] + shift) })));
    }
    // Полоса меняется только на повороте: смена на прямом участке давала бы
    // ступеньку-зигзаг рядом со станцией. Такие предложения отбрасываем.
    const bend = (l, i) => {
      const pts = l.points;
      const u = unitV(pts[i - 1], pts[i]), w = unitV(pts[i], pts[i + 1]);
      return Math.abs(u.x * w.y - u.y * w.x) > 1e-3;
    };
    const unitV = (a, b) => { const d = Math.hypot(b.x - a.x, b.y - a.y) || 1; return { x: (b.x - a.x) / d, y: (b.y - a.y) / d }; };
    const cur = (e) => e.l.__nl && e.l.__nl.has(e.i) ? e.l.__nl.get(e.i) : e.l.lanes[e.i];
    for (const arr of prop.values()) for (const { e, lane } of arr) { (e.l.__nl = e.l.__nl || new Map()).set(e.i, lane); }
    for (let pass = 0; pass < 6; pass++) {
      const reject = new Set();
      for (const [key, arr] of prop) {
        for (const { e } of arr) {
          const n = e.l.points.length - 1;
          const bad = (j) => j >= 0 && j < n && e.l.lanes[e.i] === e.l.lanes[j] && cur(e) !== (e.l.__nl.has(j) ? e.l.__nl.get(j) : e.l.lanes[j]);
          if ((e.i > 0 && bad(e.i - 1) && !bend(e.l, e.i)) || (e.i + 1 < n && bad(e.i + 1) && !bend(e.l, e.i + 1))) { reject.add(key); break; }
        }
      }
      if (!reject.size) break;
      for (const key of reject) {
        for (const { e } of prop.get(key)) e.l.__nl.delete(e.i);
        prop.delete(key);
      }
    }
    for (const l of lines) {
      if (l.__nl) { for (const [i, v] of l.__nl) l.lanes[i] = v; delete l.__nl; }
    }
  }

  /**
   * Экспресс-линии: если участок линии A→C пропускает станции, по которым
   * проходит другая линия (A…B…C подряд), экспресс рисуется по её трассе и
   * идёт в пучке рядом с остальными, а B помечается как «проходит без
   * остановки». g.fullIds — путь со всеми проходимыми станциями, g.pass —
   * только пропущенные.
   */
  // Цепочка a…c другой линии годится как трасса экспресса a→c, только если
  // это действительно тот же коридор: промежуточные станции не являются
  // остановками самого экспресса (иначе это его же петля/разворот), идут
  // по порядку вдоль a→c, недалеко от прямой, а путь по цепочке не длиннее
  // прямого перегона больше чем на четверть. Без этой проверки линия
  // «уходила» через 10+ чужих станций — петли на пол-схемы.
  function expressChainOk(seg, stops, stById) {
    const P = seg.map((id) => stById.get(id));
    const a = P[0], c = P[P.length - 1];
    const dx = c.x - a.x, dz = c.z - a.z, d = Math.hypot(dx, dz);
    if (!d) return false;
    let path = 0, prevT = 0;
    for (let k = 1; k < P.length; k++) {
      path += Math.hypot(P[k].x - P[k - 1].x, P[k].z - P[k - 1].z);
      if (k === P.length - 1) break;
      if (stops.has(seg[k])) return false;
      const t = ((P[k].x - a.x) * dx + (P[k].z - a.z) * dz) / (d * d);
      const off = Math.abs((P[k].x - a.x) * dz - (P[k].z - a.z) * dx) / d;
      if (t <= prevT || t >= 1 || off > d * 0.2) return false;
      prevT = t;
    }
    return path <= d * 1.25;
  }

  function expandExpress(groups, stById) {
    for (const g of groups) {
      const ids = g.main.stationIds.filter((s) => stById.has(s));
      const stops = new Set(ids);
      const full = [], pass = new Set();
      ids.forEach((c, i) => {
        if (!i) { full.push(c); return; }
        const a = ids[i - 1];
        let best = null;
        for (const h of groups) {
          if (h === g) continue;
          const hid = h.main.stationIds;
          const ia = hid.indexOf(a), ic = hid.indexOf(c);
          if (ia < 0 || ic < 0 || Math.abs(ic - ia) < 2 || Math.abs(ic - ia) > 14) continue;
          const seg = ia < ic ? hid.slice(ia, ic + 1) : hid.slice(ic, ia + 1).reverse();
          if (!seg.every((x) => stById.has(x))) continue;
          if (!expressChainOk(seg, stops, stById)) continue;
          if (!best || seg.length < best.length) best = seg;
        }
        if (best) {
          best.slice(1, -1).forEach((x) => { if (!stops.has(x)) pass.add(x); });
          full.push(...best.slice(1));
        } else full.push(c);
      });
      g.fullIds = full.filter((x, i, arr) => i === 0 || x !== arr[i - 1]);
      g.pass = [...pass];
    }
  }

  // Сжатие пустот по одной оси: промежутки между соседними значениями
  // длиннее maxGap сокращаются до maxGap (порядок сохраняется). Карта
  // {xs, ys} хранится в mtrMeta.cmp: при повторном построении новые станции
  // проходят то же преобразование, что и старые (иначе они слипаются).
  function makeCmp(vals, maxGap) {
    const xs = [...new Set(vals.map((v) => Math.round(v * 100) / 100))].sort((p, q) => p - q);
    const ys = [xs[0]];
    for (let i = 1; i < xs.length; i++) ys.push(ys[i - 1] + Math.min(xs[i] - xs[i - 1], maxGap));
    return { xs, ys };
  }
  function applyCmp(m, v) {
    const { xs, ys } = m;
    if (!xs || xs.length < 2) return v;
    if (v <= xs[0]) return ys[0] + (v - xs[0]);
    if (v >= xs[xs.length - 1]) return ys[ys.length - 1] + (v - xs[xs.length - 1]);
    let lo = 0, hi = xs.length - 1;
    while (hi - lo > 1) { const k = (lo + hi) >> 1; if (xs[k] <= v) lo = k; else hi = k; }
    const u = (v - xs[lo]) / ((xs[hi] - xs[lo]) || 1);
    return ys[lo] + (ys[hi] - ys[lo]) * u;
  }

  function buildFromMtr(data, types, prevIn, opts) {
    opts = opts || {};
    const prev = C().normalize(prevIn);
    const grid = prev.grid;
    const stById = new Map(data.stations.map((s) => [s.id, s]));
    const groups = groupRoutes(data.routes, types);
    expandExpress(groups, stById);

    const prevLines = prev.lines;
    const prevStations = new Map(prev.stations.filter((s) => isMtr(s.id, P_ST)).map((s) => [s.mtrStationId, s]));
    const prevTransfers = new Map(prev.transfers.filter((t) => isMtr(t.id, P_TR)).map((t) => [t.id, t]));
    const hadMtr = prevLines.some((l) => isMtr(l.id, P_LINE));
    let meta = prev.mtrMeta && prev.mtrMeta.grid === grid ? prev.mtrMeta : computeMeta(groups, stById, grid, prev.style, opts.minGap);

    const lineIdOf = (g) => P_LINE + g.main.id;
    const stLines = new Map();
    for (const g of groups) {
      for (const id of g.main.stationIds) {
        if (!stById.has(id)) continue;
        if (!stLines.has(id)) stLines.set(id, new Set());
        stLines.get(id).add(lineIdOf(g));
      }
    }

    const pos = new Map(), occ = new Set();
    Object.assign(occ, { pos, grid, minGap: MIN_GAPS.includes(opts.minGap) ? opts.minGap : 0 });
    for (const id of stLines.keys()) {
      const p = prevStations.get(id);
      if (p) { pos.set(id, { x: p.x, y: p.y }); occ.add(pkey(p)); }
    }
    // пользовательские станции тоже занимают клетки
    prev.stations.filter((s) => !isMtr(s.id, P_ST)).forEach((s) => occ.add(pkey(s)));
    const fresh = [...stLines.keys()].filter((id) => !pos.has(id))
      .sort((a, b) => stLines.get(b).size - stLines.get(a).size);
    // «сырые» позиции: существующие станции — на своих местах (закреплены)
    const raw = new Map();
    const world = (s) => ({ x: (s.x - meta.cx) * meta.scale, y: (s.z - meta.cz) * meta.scale });
    // сжатие задаётся один раз — при первом построении; дальше действует
    // сохранённая карта, чтобы старые и новые станции лежали в одной системе
    if (!meta.cmp && !hadMtr && opts.compress > 0 && stLines.size > 1) {
      // карта строится по ВСЕМ станциям сервера, а не по выбранным типам:
      // иначе при добавлении типов позже её опорных точек не хватает и
      // станции между ними слипаются
      const used = new Set(data.routes.flatMap((r) => r.stationIds));
      const all = [...used].filter((id) => stById.has(id)).map((id) => world(stById.get(id)));
      meta = Object.assign({}, meta, {
        cmp: { x: makeCmp(all.map((q) => q.x), opts.compress * grid), y: makeCmp(all.map((q) => q.y), opts.compress * grid) },
      });
    }
    const fx = (v) => (meta.cmp ? applyCmp(meta.cmp.x, v) : v);
    const fy = (v) => (meta.cmp ? applyCmp(meta.cmp.y, v) : v);
    for (const id of stLines.keys()) {
      const w = world(stById.get(id));
      raw.set(id, pos.has(id) ? { ...pos.get(id) } : { x: fx(w.x), y: fy(w.y) });
    }
    const hopSeen = new Set(), allHops = [];
    for (const g of groups) {
      for (const [a, b] of hopsOf(g.fullIds)) {
        const k = hopKey(a, b);
        if (!hopSeen.has(k)) { hopSeen.add(k); allHops.push([a, b]); }
      }
    }
    const alignable = straighten(raw, allHops, new Set(pos.keys()), opts.alignTol);
    for (const id of fresh) {
      const p = placeFree(raw.get(id), grid, occ, id);
      pos.set(id, p);
      occ.add(pkey(p));
    }
    const freshSet = new Set(fresh);
    gridAlign(pos, allHops, alignable, freshSet, occ, grid);
    untangle(pos, allHops, alignable, freshSet, occ, grid);
    unbend(pos, groups, freshSet, occ, grid);

    const usedPrev = new Set();
    const plan = groups.map((g) => {
      const id = lineIdOf(g);
      const old = prevLines.find((l) => l.id === id)
        || prevLines.find((l) => isMtr(l.id, P_LINE) && !usedPrev.has(l) && (l.mtrRouteIds || []).some((r) => g.routeIds.includes(r)));
      if (old) usedPrev.add(old);
      const ids = g.main.stationIds.filter((s) => stById.has(s));
      const sameRoute = old && JSON.stringify(old.mtrStationIds) === JSON.stringify(ids)
        && JSON.stringify(old.mtrPassIds || []) === JSON.stringify(g.pass)
        && !g.fullIds.some((s) => freshSet.has(s)) && old.points.length >= 2;
      return { id, old, ids, sameRoute };
    });
    const paths = slideOffBends(groups, plan.map((x) => (x.sameRoute ? x.old.points : null)), pos, occ, freshSet, new Map(), grid, prev.style);
    // первый по порядку MTR маршрут каждого номера — его цвет и название
    const firstOfNumber = new Map();
    for (const g of groups) {
      const k = numberKey(g.first);
      const cur = firstOfNumber.get(k);
      if (k && (!cur || data.routes.indexOf(g.first) < data.routes.indexOf(cur))) firstOfNumber.set(k, g.first);
    }
    const numberCount = new Map();
    for (const g of groups) { const k = numberKey(g.first); if (k) numberCount.set(k, (numberCount.get(k) || 0) + 1); }
    const lines = groups.map((g, gi) => {
      const { id, old, ids } = plan[gi];
      const nk = numberKey(g.first);
      const src = firstOfNumber.get(nk) || g.first;
      const nm = splitName(src.name);
      const line = Object.assign(
        { name: nm.name, number: g.first.number || "", color: src.color, width: null, dash: "solid", offset: 0 },
        old || {},
        { id, mtrRouteIds: g.routeIds, mtrStationIds: ids, mtrPassIds: g.pass, mtrType: g.main.type, points: paths[gi] });
      // несколько линий с одним номером — группа (одна полоса на общих
      // перегонах, одна строка легенды). Ручную группу не трогаем; цвет и
      // название — только при первом объединении, дальше их можно править
      if (numberCount.get(nk) > 1 && !line.group) {
        line.group = "n:" + nk;
        line.color = src.color;
        line.name = nm.name;
      }
      line._fullIds = g.fullIds;
      // проекты до полос по перегонам хранили авто-сдвиг в offset — сбрасываем
      if (old && !old.lanes) line.offset = 0;
      return line;
    });
    // скрытые линии полос не занимают (как в relayoutLanes): иначе после
    // пересборки в пучках видимых линий оставались дыры под скрытых соседей
    const visible = lines.filter((l) => !l.hidden);
    splitOverlaps(visible, insertPoint);
    withJunctions(visible, [...stLines.keys()], pos);
    assignLanes(visible, pos);
    compactLanes(visible);
    lines.forEach((l) => { if (l.hidden) { delete l.lanes; delete l._fullIds; } });
    const lineIds = new Set(lines.map((l) => l.id));
    const userLines = prevLines.filter((l) => !isMtr(l.id, P_LINE));

    const passMap = new Map();
    for (const g of groups) for (const sid of g.pass) {
      if (!passMap.has(sid)) passMap.set(sid, []);
      passMap.get(sid).push(lineIdOf(g));
    }
    const stations = [];
    for (const [id, lset] of stLines) {
      const s = stById.get(id);
      const nm = splitName(s.name);
      const old = prevStations.get(id);
      const myLines = [...lset];
      if (old) {
        const keepUser = old.lineIds.filter((l) => !isMtr(l, P_LINE));
        const st = Object.assign({}, old, { lineIds: [...myLines, ...keepUser], passLineIds: passMap.get(id) || [], mtrName: s.name });
        // переименование в MTR доходит до схемы, если имя не правили вручную
        const oldNm = splitName(old.mtrName);
        if (old.name === oldNm.name) st.name = nm.name;
        if ((old.sub || "") === oldNm.sub) st.sub = nm.sub;
        stations.push(st);
      } else {
        const p = pos.get(id);
        stations.push({
          id: P_ST + id, mtrStationId: id, mtrName: s.name, name: nm.name, sub: nm.sub,
          x: p.x, y: p.y, style: "auto", label: { pos: "auto", angle: 0 }, lineIds: myLines, passLineIds: passMap.get(id) || [],
        });
      }
    }
    stations.forEach((st) => { st.passLineIds = (st.passLineIds || []).filter((l) => lineIds.has(l)); });
    const userStations = prev.stations.filter((s) => !isMtr(s.id, P_ST))
      .map((s) => Object.assign({}, s, { lineIds: s.lineIds.filter((l) => !isMtr(l, P_LINE) || lineIds.has(l)) }));

    // Пересадки: компоненты связности по connections
    const parent = new Map();
    const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
    for (const id of stLines.keys()) parent.set(id, id);
    for (const id of stLines.keys()) {
      for (const c of stById.get(id).connections || []) if (parent.has(c)) parent.set(find(id), find(c));
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
      transfers.push(Object.assign({}, prevTransfers.get(id) || {}, { id, stationIds: ids.map((s) => P_ST + s) }));
    }
    const allStationIds = new Set([...stations, ...userStations].map((s) => s.id));
    const userTransfers = prev.transfers.filter((t) => !isMtr(t.id, P_TR) && t.stationIds.filter((s) => allStationIds.has(s)).length >= 2);

    const result = Object.assign({}, prev, {
      lines: [...lines, ...userLines],
      stations: [...stations, ...userStations],
      transfers: [...transfers, ...userTransfers],
      mtrMeta: meta,
    });
    if (!hadMtr) {
      const b = C().bounds(result);
      if (b) result.legend = Object.assign({}, result.legend, { x: b.maxX + grid * 4, y: b.minY });
    }
    return {
      project: C().normalize(result),
      stats: {
        lines: lines.length,
        stations: stations.length,
        transfers: transfers.length,
        newStations: fresh.length,
        removedLines: prevLines.filter((l) => isMtr(l.id, P_LINE)).length - usedPrev.size,
        hadMtr,
        // старая схема строилась без сохранённой карты сжатия — новые станции не сжимаем
        compressSkipped: !!(hadMtr && !meta.cmp && opts.compress > 0),
      },
    };
  }

  // ------------------------------------------------------------
  // История и сохранение
  // ------------------------------------------------------------
  function pushHistory() {
    undoStack.push(JSON.stringify(project));
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    redoStack = [];
  }
  function undo() {
    if (!undoStack.length) return;
    redoStack.push(JSON.stringify(project));
    project = C().normalize(JSON.parse(undoStack.pop()));
    sel = null; group = null;
    changed();
  }
  function redo() {
    if (!redoStack.length) return;
    undoStack.push(JSON.stringify(project));
    project = C().normalize(JSON.parse(redoStack.pop()));
    sel = null; group = null;
    changed();
  }
  function changed() {
    render();
    renderProps();
    scheduleSave();
  }
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { if (typeof savePrefsToServer === "function") savePrefsToServer(); } catch (e) {}
    }, SAVE_DELAY);
    scheduleViewPush();
  }

  // ------------------------------------------------------------
  // Отрисовка редактора
  // ------------------------------------------------------------
  function applyView() {
    const v = project.view;
    el.world.setAttribute("transform", `translate(${v.x} ${v.y}) scale(${v.zoom})`);
    el.zoomLabel.textContent = Math.round(v.zoom * 100) + "%";
    const r = el.svg.getBoundingClientRect();
    // сетка — прямоугольник с паттерном на видимую область
    el.gridPattern.setAttribute("width", project.grid);
    el.gridPattern.setAttribute("height", project.grid);
    el.gridDot.setAttribute("r", String(Math.max(0.6, 1 / v.zoom)));
    const x0 = -v.x / v.zoom, y0 = -v.y / v.zoom;
    el.gridRect.setAttribute("x", x0 - project.grid);
    el.gridRect.setAttribute("y", y0 - project.grid);
    el.gridRect.setAttribute("width", r.width / v.zoom + project.grid * 2);
    el.gridRect.setAttribute("height", r.height / v.zoom + project.grid * 2);
    el.gridRect.style.display = v.zoom * project.grid >= 6 ? "" : "none";
  }

  function render() {
    if (!el.svg) return;
    el.svg.style.background = project.style.bg;
    lastDrawn = C().render(el.scene, project, { live: ui.live ? liveData : null, highlight: highlightSet() });
    applyView();
    renderOverlay();
  }

  // ------------------------------------------------------------
  // Overlay: выделение, точки правки, фигуры
  // ------------------------------------------------------------
  function rotPt(p, c, deg) {
    const a = (deg * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
    const dx = p.x - c.x, dy = p.y - c.y;
    return { x: c.x + dx * ca - dy * sa, y: c.y + dx * sa + dy * ca };
  }

  const SHAPE_TOOLS = { rect: "rect", ellipse: "ellipse", shapeline: "line", text: "text", icon: "icon" };

  // Рамка, ручки изменения размера и ручка поворота выбранной фигуры
  function drawShapeHandles(g, sh) {
    const mk = C().el;
    const z = project.view.zoom;
    const s = 8 / z;
    const b = C().shapeBox(sh);
    const c = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    const rot = sh.type === "line" ? 0 : sh.rot;
    if (sh.type === "line") {
      [["p1", sh.x, sh.y], ["p2", sh.x + sh.w, sh.y + sh.h]].forEach(([hn, x, y]) => {
        mk("rect", { x: x - s / 2, y: y - s / 2, width: s, height: s, rx: 1.5 / z, class: "sc-handle mine", "data-kind": "shandle", "data-h": hn, "stroke-width": 1.5 / z }, g);
      });
      return;
    }
    const corners = [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]].map(([x, y]) => rotPt({ x, y }, c, rot));
    mk("polygon", { points: corners.map((q) => `${q.x},${q.y}`).join(" "), class: "sc-shape-box", "stroke-width": 1.5 / z }, g);
    if (sh.type === "text") return;
    const pts = {
      nw: [b.x, b.y], n: [c.x, b.y], ne: [b.x + b.w, b.y], e: [b.x + b.w, c.y],
      se: [b.x + b.w, b.y + b.h], s: [c.x, b.y + b.h], sw: [b.x, b.y + b.h], w: [b.x, c.y],
    };
    for (const hn of Object.keys(pts)) {
      const q = rotPt({ x: pts[hn][0], y: pts[hn][1] }, c, rot);
      mk("rect", { x: q.x - s / 2, y: q.y - s / 2, width: s, height: s, rx: 1.5 / z, class: "sc-handle mine", "data-kind": "shandle", "data-h": hn, "stroke-width": 1.5 / z }, g);
    }
    const top = rotPt({ x: c.x, y: b.y }, c, rot);
    const knob = rotPt({ x: c.x, y: b.y - 24 / z }, c, rot);
    mk("line", { x1: top.x, y1: top.y, x2: knob.x, y2: knob.y, class: "sc-shape-box", "stroke-width": 1.5 / z }, g);
    mk("circle", { cx: knob.x, cy: knob.y, r: s * 0.65, class: "sc-handle mine", "data-kind": "shandle", "data-h": "rot", "stroke-width": 1.5 / z }, g);
  }

  // Где реально нарисован значок станции (он может стоять не в вершине, а за изломом)
  function markPos(st) {
    const geo = lastDrawn && lastDrawn.geos && lastDrawn.geos.get(st.id);
    return geo ? geo.c : st;
  }

  // выделенная линия вместе с объединёнными с ней — для подсветки
  function highlightSet() {
    if (!sel || sel.kind !== "line") return null;
    const ln = project.lines.find((l) => l.id === sel.id);
    if (!ln) return null;
    return new Set(project.lines.filter((l) => l === ln || (ln.group && l.group === ln.group)).map((l) => l.id));
  }

  function renderOverlay() {
    const g = el.overlay;
    while (g.firstChild) g.removeChild(g.firstChild);
    const mk = C().el;
    const z = project.view.zoom;
    const ringR = project.style.lineWidth * 2.2;
    if (sel && sel.kind === "station") {
      const st = project.stations.find((s) => s.id === sel.id);
      if (st) mk("circle", { cx: markPos(st).x, cy: markPos(st).y, r: ringR, class: "sc-sel-ring" }, g);
    }
    // Точки редактирования на каждом угле линий. Угол пучка — общая вершина
    // нескольких линий, одна точка двигает их все (moveNode). Вершины в
    // станциях не показываем — там тянется сама станция.
    // Выделена линия — точки только её, там, где она нарисована в пучке, и
    // двигают только её (kind "vertex"). Иначе — общие точки углов.
    const s = 8 / z;
    const stKeys = new Set(project.stations.map((st) => pkey(st)));
    const selLine = sel && sel.kind === "line" ? project.lines.find((l) => l.id === sel.id) : null;
    if (tool === "select" && selLine) {
      const disp = C().vertexDisplayPoints(project, selLine);
      selLine.points.forEach((q, i) => {
        if (stKeys.has(pkey(q))) return;
        const d = disp[i];
        mk("rect", {
          x: d.x - s / 2, y: d.y - s / 2, width: s, height: s, rx: 1.5 / z,
          class: "sc-handle mine" + (sel.vidx === i ? " active" : ""),
          "data-kind": "vertex", "data-id": selLine.id, "data-idx": i, "stroke-width": 1.5 / z,
        }, g);
      });
    } else if (tool === "select" && z * project.grid >= 9) {
      const nodes = new Map();
      for (const l of project.lines) {
        for (const p of l.points) {
          const k = pkey(p);
          if (!stKeys.has(k) && !nodes.has(k)) nodes.set(k, { x: p.x, y: p.y });
        }
      }
      for (const n of nodes.values()) {
        const active = (sel && sel.kind === "node" && sel.x === n.x && sel.y === n.y) || (group && group.nodes.has(pkey(n)));
        mk("rect", {
          x: n.x - s / 2, y: n.y - s / 2, width: s, height: s, rx: 1.5 / z,
          class: "sc-handle" + (active ? " active" : ""),
          "data-kind": "node", "data-x": n.x, "data-y": n.y, "stroke-width": 1.5 / z,
        }, g);
      }
    }
    if (group) {
      group.stations.forEach((id) => {
        const st = project.stations.find((x) => x.id === id);
        if (st) mk("circle", { cx: markPos(st).x, cy: markPos(st).y, r: ringR, class: "sc-sel-ring" }, g);
      });
      group.shapes.forEach((id) => {
        const sh = project.shapes.find((x) => x.id === id);
        if (!sh) return;
        const b = C().shapeBox(sh);
        mk("rect", { x: b.x, y: b.y, width: b.w, height: b.h, class: "sc-shape-box", "stroke-width": 1.5 / z }, g);
      });
    }
    if (sel && sel.kind === "shape") {
      const sh = project.shapes.find((x) => x.id === sel.id);
      if (sh && tool === "select") drawShapeHandles(g, sh);
    }
    if (sel && sel.kind === "transfer") {
      const tr = project.transfers.find((x) => x.id === sel.id);
      if (tr) tr.stationIds.forEach((id) => {
        const st = project.stations.find((x) => x.id === id);
        if (st) mk("circle", { cx: markPos(st).x, cy: markPos(st).y, r: ringR, class: "sc-sel-ring" }, g);
      });
    }
    if (transferFirst) {
      const st = project.stations.find((x) => x.id === transferFirst);
      if (st) mk("circle", { cx: markPos(st).x, cy: markPos(st).y, r: ringR, class: "sc-sel-ring pending" }, g);
    }
    if (drawing && drawing.points.length) {
      const pts = hoverPt ? [...drawing.points, hoverPt] : drawing.points;
      mk("polyline", {
        points: pts.map((p) => `${p.x},${p.y}`).join(" "), class: "sc-draw-preview",
        "stroke-width": project.style.lineWidth, stroke: drawing.color,
      }, g);
    }
    for (const gd of guides) mk("line", { x1: gd.x1, y1: gd.y1, x2: gd.x2, y2: gd.y2, class: "sc-guide", "stroke-width": 1 / z }, g);
    if (marquee) {
      mk("rect", {
        x: Math.min(marquee.x0, marquee.x1), y: Math.min(marquee.y0, marquee.y1),
        width: Math.abs(marquee.x1 - marquee.x0), height: Math.abs(marquee.y1 - marquee.y0),
        class: "sc-marquee", "stroke-width": 1 / z,
      }, g);
    }
    if (hoverPt && (tool === "line" || tool === "station")) {
      mk("circle", { cx: hoverPt.x, cy: hoverPt.y, r: 4 / z, class: "sc-cursor" }, g);
    }
  }

  // ------------------------------------------------------------
  // Координаты и попадания
  // ------------------------------------------------------------
  function toWorld(evt) {
    const r = el.svg.getBoundingClientRect();
    const v = project.view;
    return { x: (evt.clientX - r.left - v.x) / v.zoom, y: (evt.clientY - r.top - v.y) / v.zoom };
  }
  function hitOf(evt) {
    const node = evt.target && evt.target.closest ? evt.target.closest("[data-kind]") : null;
    if (!node) return null;
    return {
      kind: node.getAttribute("data-kind"), id: node.getAttribute("data-id"), idx: Number(node.getAttribute("data-idx")),
      x: Number(node.getAttribute("data-x")), y: Number(node.getAttribute("data-y")), h: node.getAttribute("data-h"),
    };
  }
  const stationAt = (p, tol) => project.stations.find((s) => Math.hypot(s.x - p.x, s.y - p.y) <= tol);

  // Точка на сетке с привязкой к 45° от предыдущей точки и к станциям
  function drawPoint(w) {
    const st = stationAt(w, project.grid * 0.6);
    if (st) return { x: st.x, y: st.y };
    let p = { x: snap(w.x), y: snap(w.y) };
    const prev = drawing && drawing.points[drawing.points.length - 1];
    if (prev) {
      const dx = w.x - prev.x, dy = w.y - prev.y;
      const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
      const ux = Math.round(Math.cos(ang)), uy = Math.round(Math.sin(ang));
      const k = Math.max(1, Math.round((ux && uy ? Math.max(Math.abs(dx), Math.abs(dy)) : Math.hypot(dx, dy)) / project.grid));
      p = { x: prev.x + ux * k * project.grid, y: prev.y + uy * k * project.grid };
    }
    return p;
  }

  // ------------------------------------------------------------
  // Мышь
  // ------------------------------------------------------------
  let spaceDown = false;

  function clearSelection() { sel = null; group = null; }

  function onMouseDown(e) {
    // сдвиг: средняя/правая кнопка или пробел
    if (e.button === 1 || e.button === 2 || (e.button === 0 && spaceDown)) {
      e.preventDefault();
      startPan(e);
      return;
    }
    if (e.button !== 0) return;
    const w = toWorld(e);
    const hit = hitOf(e);

    if (tool === "line") {
      const p = drawPoint(w);
      if (!drawing) drawing = { points: [], color: PALETTE[project.lines.length % PALETTE.length] };
      const last = drawing.points[drawing.points.length - 1];
      if (!last || last.x !== p.x || last.y !== p.y) drawing.points.push(p);
      renderOverlay();
      return;
    }
    if (tool === "station") { addStationAt(w); return; }
    if (tool === "transfer") {
      if (!hit || hit.kind !== "station") return;
      if (!transferFirst) { transferFirst = hit.id; renderOverlay(); return; }
      if (transferFirst !== hit.id) addTransfer(transferFirst, hit.id);
      transferFirst = null;
      changed();
      return;
    }
    if (SHAPE_TOOLS[tool]) { startShapeCreate(w); return; }

    // select
    if (hit && hit.kind === "shandle") { startShapeHandle(hit); return; }
    // подпись в выделении группы / с Shift — как станция
    if (hit && hit.kind === "label" && (e.shiftKey || (group && group.stations.has(hit.id)))) hit.kind = "station";
    if (!hit) {
      // пустое место: рамка выделения (Shift — добавить к выделенному)
      if (!e.shiftKey) clearSelection();
      marquee = { x0: w.x, y0: w.y, x1: w.x, y1: w.y, add: e.shiftKey };
      drag = { type: "marquee" };
      renderOverlay();
      renderProps();
      return;
    }
    if (e.shiftKey && (hit.kind === "station" || hit.kind === "shape")) {
      toggleInGroup(hit.kind, hit.id);
      return;
    }
    if (group && ((hit.kind === "station" && group.stations.has(hit.id)) || (hit.kind === "shape" && group.shapes.has(hit.id)))) {
      startGroupDrag(e);
      return;
    }
    group = null;
    if (hit.kind === "node") {
      sel = { kind: "node", x: hit.x, y: hit.y };
      startDrag(e, "node");
      renderOverlay();
      renderProps();
      return;
    }
    if (hit.kind === "vertex") {
      sel = { kind: "line", id: hit.id, vidx: hit.idx };
      startDrag(e, "vertex", hit.id);
      renderOverlay();
      renderProps();
      return;
    }
    if (hit.kind === "label" || hit.kind === "badge") {
      // подпись и блок номеров двигаются сами по себе, выделяется станция
      sel = { kind: "station", id: hit.id };
      renderOverlay();
      renderProps();
      startDrag(e, hit.kind, hit.id);
      return;
    }
    sel = { kind: hit.kind, id: hit.id };
    renderOverlay();
    renderProps();
    if (hit.kind === "station") startDrag(e, "station", hit.id);
    else if (hit.kind === "legend") startDrag(e, "legend", "legend");
    else if (hit.kind === "shape") startDrag(e, "shape", hit.id);
  }

  function startPan(e) {
    drag = { type: "pan", sx: e.clientX, sy: e.clientY, vx: project.view.x, vy: project.view.y };
    el.svg.classList.add("panning");
  }

  // ---- Группа (выделение рамкой / Shift+клик) ----
  function groupSize(g) { return g ? g.stations.size + g.nodes.size + g.shapes.size : 0; }

  function toggleInGroup(kind, id) {
    if (!group) {
      group = { stations: new Set(), nodes: new Set(), shapes: new Set() };
      if (sel && sel.kind === "station") group.stations.add(sel.id);
      else if (sel && sel.kind === "shape") group.shapes.add(sel.id);
    }
    const set = kind === "station" ? group.stations : group.shapes;
    if (set.has(id)) set.delete(id); else set.add(id);
    sel = groupSize(group) ? { kind: "group" } : null;
    if (!groupSize(group)) group = null;
    renderOverlay();
    renderProps();
  }

  function finishMarquee() {
    const m = marquee;
    marquee = null;
    const x0 = Math.min(m.x0, m.x1), x1 = Math.max(m.x0, m.x1), y0 = Math.min(m.y0, m.y1), y1 = Math.max(m.y0, m.y1);
    if ((x1 - x0) * project.view.zoom < 4 && (y1 - y0) * project.view.zoom < 4) {
      renderOverlay();
      renderProps();
      return;
    }
    const g = { stations: new Set(), nodes: new Set(), shapes: new Set() };
    if (m.add) {
      if (group) { group.stations.forEach((i) => g.stations.add(i)); group.nodes.forEach((i) => g.nodes.add(i)); group.shapes.forEach((i) => g.shapes.add(i)); }
      else if (sel && sel.kind === "station") g.stations.add(sel.id);
      else if (sel && sel.kind === "shape") g.shapes.add(sel.id);
    }
    const inside = (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
    const stKeys = new Set();
    for (const st of project.stations) { stKeys.add(pkey(st)); if (inside(st.x, st.y)) g.stations.add(st.id); }
    for (const l of project.lines) for (const q of l.points) if (!stKeys.has(pkey(q)) && inside(q.x, q.y)) g.nodes.add(pkey(q));
    for (const sh of project.shapes) {
      const b = C().shapeBox(sh);
      if (inside(b.x + b.w / 2, b.y + b.h / 2)) g.shapes.add(sh.id);
    }
    if (g.stations.size === 1 && !g.nodes.size && !g.shapes.size) { sel = { kind: "station", id: [...g.stations][0] }; group = null; }
    else if (g.shapes.size === 1 && !g.nodes.size && !g.stations.size) { sel = { kind: "shape", id: [...g.shapes][0] }; group = null; }
    else if (groupSize(g)) { group = g; sel = { kind: "group" }; }
    else { group = null; sel = null; }
    renderOverlay();
    renderProps();
  }

  function startGroupDrag(e) {
    drag = {
      type: "group", start: toWorld(e), snapshot: JSON.stringify(project), moved: false, dx: 0, dy: 0,
      stations: new Set(group.stations), nodes: new Set(group.nodes), shapes: new Set(group.shapes),
    };
  }

  // Сдвиг группы от исходного состояния (снимок) на (dx, dy)
  function applyGroupMove(d, dx, dy) {
    project = C().normalize(JSON.parse(d.snapshot));
    const moves = new Map(); // ключ позиции → множество линий (null = все)
    for (const id of d.stations) {
      const st = project.stations.find((x) => x.id === id);
      if (!st) continue;
      moves.set(pkey(st), new Set([...st.lineIds, ...(st.passLineIds || [])]));
    }
    for (const k of d.nodes) moves.set(k, null);
    for (const l of project.lines) {
      const idx = [];
      l.points.forEach((q, i) => {
        const ls = moves.get(pkey(q));
        if (ls === undefined) return;
        if (ls === null || ls.has(l.id)) idx.push(i);
      });
      idx.forEach((i) => { l.points[i] = { x: l.points[i].x + dx, y: l.points[i].y + dy }; });
    }
    for (const id of d.stations) {
      const st = project.stations.find((x) => x.id === id);
      if (st) { st.x += dx; st.y += dy; }
    }
    for (const id of d.shapes) {
      const sh = project.shapes.find((x) => x.id === id);
      if (sh) { sh.x += dx; sh.y += dy; }
    }
    group.nodes = new Set([...d.nodes].map((k) => { const [x, y] = k.split(",").map(Number); return pkey({ x: x + dx, y: y + dy }); }));
  }

  // ---- Фигуры ----
  function defaultShape(type, x, y) {
    const base = { id: "sh-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), type, x, y };
    if (type === "rect" || type === "ellipse") return C().normalizeShape(Object.assign(base, { w: 2, h: 2, fill: "#dbeafe", stroke: "#2563eb", strokeW: 2 }));
    if (type === "line") return C().normalizeShape(Object.assign(base, { w: 0, h: 0, stroke: "#111827", strokeW: 3, fill: "none" }));
    if (type === "icon") {
      const size = project.grid * 2;
      return C().normalizeShape(Object.assign(base, { x: x - size / 2, y: y - size / 2, w: size, h: size, layer: "front" }, iconPick));
    }
    return C().normalizeShape(Object.assign(base, { text: tt("schemeNewText"), fill: "#111827", stroke: "none", fontSize: 18 }));
  }

  function startShapeCreate(w) {
    const type = SHAPE_TOOLS[tool];
    const snapshot = JSON.stringify(project);
    const sh = defaultShape(type, Math.round(w.x), Math.round(w.y));
    undoStack.push(snapshot);
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    redoStack = [];
    project.shapes.push(sh);
    clearSelection();
    sel = { kind: "shape", id: sh.id };
    if (type === "icon") {
      setTool("select");
      changed();
      return;
    }
    if (type === "text") {
      setTool("select");
      changed();
      askText(tt("schemeAskText"), sh.text, (v) => { sh.text = v; changed(); }, true);
      return;
    }
    drag = { type: "shapeCreate", id: sh.id, start: { x: sh.x, y: sh.y }, moved: false };
    render();
  }

  function updateShapeCreate(d, w, e) {
    const sh = project.shapes.find((x) => x.id === d.id);
    if (!sh) return;
    let dx = w.x - d.start.x, dy = w.y - d.start.y;
    if (sh.type === "line") {
      if (e.shiftKey) {
        const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4), l = Math.hypot(dx, dy);
        dx = Math.cos(ang) * l; dy = Math.sin(ang) * l;
      }
      sh.w = Math.round(dx); sh.h = Math.round(dy);
    } else {
      if (e.shiftKey) { const m = Math.max(Math.abs(dx), Math.abs(dy)); dx = Math.sign(dx || 1) * m; dy = Math.sign(dy || 1) * m; }
      sh.x = Math.round(Math.min(d.start.x, d.start.x + dx));
      sh.y = Math.round(Math.min(d.start.y, d.start.y + dy));
      sh.w = Math.max(2, Math.round(Math.abs(dx)));
      sh.h = Math.max(2, Math.round(Math.abs(dy)));
    }
    d.moved = true;
    render();
  }

  function finishShapeCreate(d) {
    const sh = project.shapes.find((x) => x.id === d.id);
    if (sh) {
      const tiny = sh.type === "line" ? Math.hypot(sh.w, sh.h) < 6 : sh.w < 6 && sh.h < 6;
      if (tiny) {
        if (sh.type === "line") { sh.w = 120; sh.h = 0; } else { sh.w = 140; sh.h = 80; }
      }
    }
    setTool("select");
    changed();
  }

  function startShapeHandle(hit) {
    const sh = project.shapes.find((x) => x.id === (sel && sel.id));
    if (!sh) return;
    drag = {
      type: "shapeHandle", id: sh.id, h: hit.h, snapshot: JSON.stringify(project), moved: false,
      box0: { x: sh.x, y: sh.y, w: sh.w, h: sh.h }, rot: sh.rot,
    };
  }

  function applyShapeHandle(d, w, e) {
    const sh = project.shapes.find((x) => x.id === d.id);
    if (!sh) return;
    const b0 = d.box0;
    if (sh.type === "line") {
      if (d.h === "p1") { const ex = b0.x + b0.w, ey = b0.y + b0.h; sh.x = Math.round(w.x); sh.y = Math.round(w.y); sh.w = ex - sh.x; sh.h = ey - sh.y; }
      else { sh.w = Math.round(w.x) - b0.x; sh.h = Math.round(w.y) - b0.y; }
      return;
    }
    const c0 = { x: b0.x + b0.w / 2, y: b0.y + b0.h / 2 };
    if (d.h === "rot") {
      let a = (Math.atan2(w.y - c0.y, w.x - c0.x) * 180) / Math.PI + 90;
      if (e.shiftKey) a = Math.round(a / 15) * 15;
      sh.rot = Math.round(((a + 540) % 360) - 180);
      return;
    }
    const q = rotPt(w, c0, -d.rot);
    let x1 = b0.x, y1 = b0.y, x2 = b0.x + b0.w, y2 = b0.y + b0.h;
    if (d.h.includes("w")) x1 = Math.min(q.x, x2 - 4);
    if (d.h.includes("e")) x2 = Math.max(q.x, x1 + 4);
    if (d.h.includes("n")) y1 = Math.min(q.y, y2 - 4);
    if (d.h.includes("s")) y2 = Math.max(q.y, y1 + 4);
    const nc = rotPt({ x: (x1 + x2) / 2, y: (y1 + y2) / 2 }, c0, d.rot);
    sh.w = Math.round(x2 - x1);
    sh.h = Math.round(y2 - y1);
    sh.x = Math.round(nc.x - sh.w / 2);
    sh.y = Math.round(nc.y - sh.h / 2);
  }

  // Станция, лежащая на отрезке своей линии (а не в вершине), встраивается
  // в неё вершиной — иначе при перетаскивании линия за ней не пойдёт
  function anchorStation(s) {
    for (const l of project.lines) {
      if (!s.lineIds.includes(l.id) || l.points.some((q) => q.x === s.x && q.y === s.y)) continue;
      const near = C().nearestOnPolyline(l.points, s);
      if (near && near.dist < 1) insertPoint(l, near.seg + 1, { x: s.x, y: s.y });
    }
  }

  // Вставка/удаление вершины с поддержкой полос по отрезкам (lanes):
  // новый отрезок наследует полосу разбитого, при удалении остаётся левая
  function insertPoint(line, idx, p) {
    line.points.splice(idx, 0, p);
    if (line.lanes && line.lanes.length) {
      const d = Math.max(0, Math.min(idx - 1, line.lanes.length - 1));
      line.lanes.splice(d, 0, line.lanes[d]);
    }
  }
  function removePoint(line, idx) {
    line.points.splice(idx, 1);
    if (line.lanes && line.lanes.length) line.lanes.splice(Math.min(idx, line.lanes.length - 1), 1);
  }

  // Автоподпись → ручная: направление, которое выбрал авторазмещатель, и
  // его «дальний» отступ как сдвиг — подпись остаётся на месте
  function freezeLabel(st) {
    const lay = lastDrawn && lastDrawn.labels && lastDrawn.labels.get(st.id);
    const geo = lastDrawn && lastDrawn.geos && lastDrawn.geos.get(st.id);
    if (!lay || !geo) { st.label.pos = "e"; return; }
    const vx = lay.ax - geo.c.x, vy = lay.ay - geo.c.y;
    let best = "e", bd = -Infinity;
    for (const k of C().LABEL_POS) {
      if (k === "auto") continue;
      const d = C().DIRS[k], l = Math.hypot(d[0], d[1]) || 1;
      const dot = (vx * d[0] + vy * d[1]) / l;
      if (dot > bd) { bd = dot; best = k; }
    }
    const d = C().DIRS[best], l = Math.hypot(d[0], d[1]) || 1;
    st.label.pos = best;
    st.label.angle = lay.angle || 0;
    st.label.dx = Math.round((d[0] / l) * (lay.far || 0));
    st.label.dy = Math.round((d[1] / l) * (lay.far || 0));
  }

  /**
   * Привязка при перетаскивании, как в графических редакторах: координата
   * x или y «прилипает» к другой станции / углу линии в кадре (порог 8 px
   * экрана), а станция и угол — ещё и к диагонали 45° от соседних по линии
   * вершин, чтобы перегон получался ровным. Направляющие (guides) рисует
   * overlay. Alt — без привязки (только сетка).
   */
  function smartSnap(raw, d, e) {
    guides = [];
    const gridObj = d.type === "station" || d.type === "node" || d.type === "vertex";
    const p = gridObj ? { x: snap(raw.x), y: snap(raw.y) } : { x: Math.round(raw.x), y: Math.round(raw.y) };
    if ((e && e.altKey) || !(gridObj || d.type === "shape" || d.type === "legend")) return p;
    const v = project.view, z = v.zoom, T = 8 / z;
    const r = el.svg.getBoundingClientRect();
    const vx0 = -v.x / z, vy0 = -v.y / z, vx1 = vx0 + r.width / z, vy1 = vy0 + r.height / z;
    const self = d.last ? pkey(d.last) : "";
    const pts = new Map();
    const take = (q) => {
      const k = pkey(q);
      if (k !== self && q.x >= vx0 && q.x <= vx1 && q.y >= vy0 && q.y <= vy1) pts.set(k, q);
    };
    project.stations.forEach(take);
    project.lines.forEach((l) => l.points.forEach(take));
    let bx = null, by = null;
    for (const q of pts.values()) {
      if (Math.abs(raw.x - q.x) < T && (!bx || Math.abs(raw.x - q.x) < Math.abs(raw.x - bx.x))) bx = q;
      if (Math.abs(raw.y - q.y) < T && (!by || Math.abs(raw.y - q.y) < Math.abs(raw.y - by.y))) by = q;
    }
    if (bx) p.x = bx.x;
    if (by) p.y = by.y;
    // соседи по линиям — для диагонали
    const nbs = [];
    if (gridObj && d.last) {
      for (const l of project.lines) {
        l.points.forEach((q, i) => {
          if (q.x !== d.last.x || q.y !== d.last.y) return;
          if (d.type === "vertex" && (l.id !== d.id || i !== (sel && sel.vidx))) return;
          for (const n of [l.points[i - 1], l.points[i + 1]]) if (n && (n.x !== q.x || n.y !== q.y)) nbs.push(n);
        });
      }
    }
    let diag = null;
    if (!(bx && by)) {
      for (const n of nbs) {
        for (const sg of [1, -1]) {
          const dist = Math.abs((raw.y - n.y) - sg * (raw.x - n.x)) / Math.SQRT2;
          if (dist >= T || (diag && dist >= diag.dist)) continue;
          let q;
          if (bx) q = { x: p.x, y: n.y + sg * (p.x - n.x) };
          else if (by) q = { x: n.x + sg * (p.y - n.y), y: p.y };
          else {
            const t = Math.round(((raw.x - n.x) + sg * (raw.y - n.y)) / 2 / project.grid) * project.grid;
            q = { x: n.x + t, y: n.y + sg * t };
          }
          diag = { dist, n, q };
        }
      }
    }
    if (diag) { p.x = diag.q.x; p.y = diag.q.y; guides.push({ x1: diag.n.x, y1: diag.n.y, x2: p.x, y2: p.y }); }
    if (bx) guides.push({ x1: bx.x, y1: bx.y, x2: p.x, y2: p.y });
    if (by) guides.push({ x1: by.x, y1: by.y, x2: p.x, y2: p.y });
    return p;
  }

  /**
   * Масштаб схемы (раздвинуть / сжать): все координаты и ШАГ СЕТКИ
   * умножаются на f — станции остаются в узлах (новой) сетки, прямые и 45°
   * остаются точными, толщина линий и подписи не меняются. Вид сдвигается
   * так, чтобы центр схемы остался на месте экрана. mtrMeta (масштаб,
   * сетка, карта сжатия) — на тот же множитель, чтобы пересборка клала новые
   * станции в ту же систему.
   */
  function scaleMap(f) {
    // Сетка остаётся прежней: карта растягивается / сжимается ОТНОСИТЕЛЬНО неё
    // (плотную схему можно «раздвинуть» на холсте; ширина линий и подписи не меняются)
    const b = C().bounds(project);
    const v = project.view;
    // Только целые кратные: тогда всё остаётся в узлах сетки, а прямые и 45° —
    // точными. Дробный масштаб с округлением к сетке превращал диагонали в
    // ступеньки и добавлял лишние узлы.
    const g = project.grid;
    const cells = [];
    project.stations.forEach((s) => cells.push(s.x / g, s.y / g));
    project.lines.forEach((l) => l.points.forEach((q) => cells.push(q.x / g, q.y / g)));
    const exact = cells.every((c) => Math.abs(c * f - Math.round(c * f)) < 1e-6);
    if (!exact) { setStatus(tt("schemeMapScaleLimit")); return; }
    pushHistory();
    project.stations.forEach((s) => { s.x = Math.round(s.x * f / g) * g; s.y = Math.round(s.y * f / g) * g; });
    project.lines.forEach((l) => { l.points = l.points.map((q) => ({ x: Math.round(q.x * f / g) * g, y: Math.round(q.y * f / g) * g })); });
    project.shapes.forEach((sh) => { sh.x *= f; sh.y *= f; sh.w *= f; sh.h *= f; });
    project.legend.x *= f; project.legend.y *= f;
    const m = project.mtrMeta;
    if (m) {
      m.scale *= f;
      if (m.cmp) for (const ax of [m.cmp.x, m.cmp.y]) { ax.xs = ax.xs.map((x) => x * f); ax.ys = ax.ys.map((y) => y * f); }
    }
    if (b) {
      const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
      v.x -= cx * (f - 1) * v.zoom;
      v.y -= cy * (f - 1) * v.zoom;
    }
    clearSelection();
    changed();
    applyView();
  }

  function startDrag(e, type, id) {
    const w = toWorld(e);
    let orig;
    if (type === "station") { const s = project.stations.find((x) => x.id === id); orig = { x: s.x, y: s.y }; }
    else if (type === "node") orig = { x: sel.x, y: sel.y };
    else if (type === "vertex") { const q = project.lines.find((l) => l.id === id).points[sel.vidx]; orig = { x: q.x, y: q.y }; }
    else if (type === "shape") { const s = project.shapes.find((x) => x.id === id); orig = { x: s.x, y: s.y }; }
    else if (type === "label") { const s = project.stations.find((x) => x.id === id); orig = { x: s.label.dx, y: s.label.dy }; }
    else if (type === "badge") { const s = project.stations.find((x) => x.id === id); orig = { x: s.badge.dx, y: s.badge.dy }; }
    else orig = { x: project.legend.x, y: project.legend.y };
    drag = { type, id, start: w, orig, last: orig, snapshot: JSON.stringify(project), moved: false };
  }

  // Угол линий: все вершины всех линий в этой точке двигаются вместе
  function moveNode(from, to) {
    for (const l of project.lines) {
      l.points.forEach((p, i) => { if (p.x === from.x && p.y === from.y) l.points[i] = { x: to.x, y: to.y }; });
    }
  }

  function pushDragHistory(d) {
    undoStack.push(d.snapshot);
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    redoStack = [];
    d.moved = true;
  }

  function onMouseMove(e) {
    if (drag && drag.type === "pan") {
      project.view.x = drag.vx + (e.clientX - drag.sx);
      project.view.y = drag.vy + (e.clientY - drag.sy);
      applyView();
      return;
    }
    const w = toWorld(e);
    if (drag) {
      if (drag.type === "marquee") { marquee.x1 = w.x; marquee.y1 = w.y; renderOverlay(); return; }
      if (drag.type === "shapeCreate") { updateShapeCreate(drag, w, e); return; }
      if (drag.type === "shapeHandle") {
        if (!drag.moved) pushDragHistory(drag);
        applyShapeHandle(drag, w, e);
        render();
        return;
      }
      if (drag.type === "group") {
        const onlyShapes = !drag.stations.size && !drag.nodes.size;
        const step = onlyShapes ? 1 : project.grid;
        const dx = Math.round((w.x - drag.start.x) / step) * step, dy = Math.round((w.y - drag.start.y) / step) * step;
        if (dx === drag.dx && dy === drag.dy) return;
        if (!drag.moved) pushDragHistory(drag);
        drag.dx = dx; drag.dy = dy;
        applyGroupMove(drag, dx, dy);
        render();
        return;
      }
      if (!drag.moved && drag.type === "label") {
        // автоподпись при первом сдвиге фиксируется в том положении, где стоит
        const st = project.stations.find((x) => x.id === drag.id);
        if (st.label.pos === "auto") {
          pushDragHistory(drag);
          freezeLabel(st);
          drag.orig = { x: st.label.dx, y: st.label.dy };
          drag.last = drag.orig;
        }
      }
      const raw = { x: drag.orig.x + (w.x - drag.start.x), y: drag.orig.y + (w.y - drag.start.y) };
      const np = smartSnap(raw, drag, e);
      if (np.x === drag.last.x && np.y === drag.last.y) { renderOverlay(); return; }
      if (!drag.moved) {
        pushDragHistory(drag);
        if (drag.type === "station") anchorStation(project.stations.find((x) => x.id === drag.id));
      }
      if (drag.type === "station") moveStation(drag.id, drag.last, np);
      else if (drag.type === "node") { moveNode(drag.last, np); sel = { kind: "node", x: np.x, y: np.y }; }
      else if (drag.type === "vertex") {
        // у объединённой группы геометрия одна: вершина двигается во всех её линиях сразу
        const ln = project.lines.find((l) => l.id === drag.id);
        const from = ln.points[sel.vidx];
        ln.points[sel.vidx] = np;
        if (ln.group) {
          project.lines.forEach((l) => {
            if (l === ln || l.group !== ln.group) return;
            l.points.forEach((q, i) => { if (q.x === from.x && q.y === from.y) l.points[i] = { x: np.x, y: np.y }; });
          });
        }
      }
      else if (drag.type === "shape") { const sh = project.shapes.find((x) => x.id === drag.id); sh.x = np.x; sh.y = np.y; }
      else if (drag.type === "label") { const st = project.stations.find((x) => x.id === drag.id); st.label.dx = np.x; st.label.dy = np.y; }
      else if (drag.type === "badge") { const st = project.stations.find((x) => x.id === drag.id); st.badge.dx = np.x; st.badge.dy = np.y; }
      else { project.legend.x = np.x; project.legend.y = np.y; }
      drag.last = np;
      render();
      return;
    }
    if (tool === "line" || tool === "station") {
      hoverPt = tool === "line" ? drawPoint(w) : { x: snap(w.x), y: snap(w.y) };
      renderOverlay();
    }
  }

  function onMouseUp() {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (guides.length) { guides = []; renderOverlay(); }
    el.svg.classList.remove("panning");
    if (d.type === "marquee") { finishMarquee(); return; }
    if (d.type === "shapeCreate") { finishShapeCreate(d); return; }
    if (d.moved || d.type === "pan") { renderProps(); scheduleSave(); }
  }

  function onWheel(e) {
    e.preventDefault();
    const r = el.svg.getBoundingClientRect();
    const v = project.view;
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const k = Math.exp(-e.deltaY * 0.0015);
    const z = Math.max(0.03, Math.min(8, v.zoom * k));
    v.x = mx - ((mx - v.x) / v.zoom) * z;
    v.y = my - ((my - v.y) / v.zoom) * z;
    v.zoom = z;
    applyView();
    renderOverlay();
    scheduleSave();
  }

  // Небольшое окно ввода поверх холста (prompt() в Electron недоступен)
  let askBox = null;
  function askText(label, value, apply, multiline) {
    if (askBox) askBox.remove();
    const input = multiline ? h("textarea", { rows: "4" }) : h("input", { type: "text" });
    input.value = value || "";
    const close = () => { if (askBox) { askBox.remove(); askBox = null; } };
    const ok = () => { const v = input.value; close(); apply(v); };
    askBox = h("div", { class: "scheme-ask" }, [
      h("div", { class: "scheme-ask-label", text: label }),
      input,
      h("div", { class: "scheme-ask-btns" }, [
        h("button", { type: "button", text: tt("schemeAskOk"), onclick: ok }),
        h("button", { type: "button", class: "secondary-btn", text: tt("schemeAskCancel"), onclick: close }),
      ]),
    ]);
    input.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Escape") close();
      else if (e.key === "Enter" && (!multiline || e.ctrlKey)) { e.preventDefault(); ok(); }
    });
    el.canvasBox.appendChild(askBox);
    // Фокус — после текущего события: инструмент «Текст» открывает окно прямо в
    // mousedown, и стандартное действие мыши сразу уводило фокус с поля
    const focusIt = () => { if (askBox && askBox.contains(input)) { input.focus(); input.select(); } };
    focusIt();
    setTimeout(focusIt, 0);
    setTimeout(focusIt, 60);
  }

  function renameSelection() {
    if (sel && sel.kind === "station") {
      const st = project.stations.find((s) => s.id === sel.id);
      if (st) askText(tt("schemeAskStation"), st.name, (v) => { pushHistory(); st.name = v; changed(); });
    } else if (sel && sel.kind === "line") {
      const l = project.lines.find((x) => x.id === sel.id);
      if (l) askText(tt("schemeAskLine"), l.name, (v) => { pushHistory(); l.name = v; changed(); });
    } else if (sel && sel.kind === "shape") {
      const sh = project.shapes.find((x) => x.id === sel.id);
      if (sh && sh.type === "text") askText(tt("schemeAskText"), sh.text, (v) => { pushHistory(); sh.text = v; changed(); }, true);
    }
  }

  function onDblClick(e) {
    const hit = hitOf(e);
    if (tool === "line") { finishLine(); return; }
    if (!hit || tool !== "select") return;
    if (hit.kind === "label") { sel = { kind: "station", id: hit.id }; group = null; renameSelection(); return; }
    if (hit.kind === "station") {
      const st = project.stations.find((s) => s.id === hit.id);
      if (!st) return;
      const onLabel = e.target.closest && e.target.closest(".sc-label");
      // двойной клик по подписи (или по станции без данных MTR) — переименование,
      // по значку станции MTR — её расписание
      if (onLabel || !st.mtrStationId) { sel = { kind: "station", id: st.id }; group = null; renameSelection(); }
      else openStation(st.mtrStationId);
      return;
    }
    if (hit.kind === "shape") {
      const sh = project.shapes.find((x) => x.id === hit.id);
      if (sh && sh.type === "text") { sel = { kind: "shape", id: sh.id }; group = null; renameSelection(); }
      return;
    }
    if (hit.kind === "line") insertVertex(hit.id, toWorld(e));
  }

  // ---- Копирование стиля ----
  const STYLE_KEYS = {
    station: ["style", "fill", "stroke", "strokeW", "size", "labelSize", "labelColor"],
    line: ["color", "width", "dash", "offset"],
    shape: ["fill", "stroke", "strokeW", "opacity", "dash", "rx", "fontSize", "bold", "align"],
  };
  function selectedObject() {
    if (!sel) return null;
    if (sel.kind === "station") { const o = project.stations.find((s) => s.id === sel.id); return o && { kind: "station", o }; }
    if (sel.kind === "line") { const o = project.lines.find((s) => s.id === sel.id); return o && { kind: "line", o }; }
    if (sel.kind === "shape") { const o = project.shapes.find((s) => s.id === sel.id); return o && { kind: "shape", o }; }
    return null;
  }
  function copyStyle() {
    let src = selectedObject();
    if (!src && group) {
      const id = [...group.stations][0];
      if (id) src = { kind: "station", o: project.stations.find((s) => s.id === id) };
    }
    if (!src) return;
    styleClip = { kind: src.kind, props: {} };
    STYLE_KEYS[src.kind].forEach((k) => { styleClip.props[k] = src.o[k]; });
    setStatus(tt("schemeStyleCopied"));
    renderProps();
  }
  function pasteStyle() {
    if (!styleClip) return;
    const targets = [];
    const one = selectedObject();
    if (one && one.kind === styleClip.kind) targets.push(one.o);
    if (group) {
      if (styleClip.kind === "station") group.stations.forEach((id) => { const o = project.stations.find((s) => s.id === id); if (o) targets.push(o); });
      if (styleClip.kind === "shape") group.shapes.forEach((id) => { const o = project.shapes.find((s) => s.id === id); if (o) targets.push(o); });
    }
    if (!targets.length) { setStatus(tt("schemeStyleNoTarget")); return; }
    pushHistory();
    targets.forEach((o) => { Object.assign(o, JSON.parse(JSON.stringify(styleClip.props))); if (styleClip.kind === "line") shareGroupProps(o); });
    changed();
    setStatus(tt("schemeStylePasted", { n: targets.length }));
  }

  // ------------------------------------------------------------
  // Правки
  // ------------------------------------------------------------
  function moveStation(id, from, to) {
    const st = project.stations.find((s) => s.id === id);
    if (!st) return;
    for (const l of project.lines) {
      if (!st.lineIds.includes(l.id)) continue;
      l.points.forEach((p, i) => { if (p.x === from.x && p.y === from.y) l.points[i] = { x: to.x, y: to.y }; });
    }
    st.x = to.x;
    st.y = to.y;
  }

  // Выстроить выделенные станции по прямой между двумя крайними: остальные
  // проецируются на неё, а точки излома линий между такими станциями удаляются
  function alignGroupInLine() {
    if (!group || group.stations.size < 2) return;
    const sts = [...group.stations].map((id) => project.stations.find((s) => s.id === id)).filter(Boolean);
    if (sts.length < 2) return;
    let A = sts[0], B = sts[1], best = -1;
    for (let i = 0; i < sts.length; i++) {
      for (let j = i + 1; j < sts.length; j++) {
        const d = Math.hypot(sts[i].x - sts[j].x, sts[i].y - sts[j].y);
        if (d > best) { best = d; A = sts[i]; B = sts[j]; }
      }
    }
    if (best <= 0) return;
    pushHistory();
    const dx = B.x - A.x, dy = B.y - A.y, l2 = dx * dx + dy * dy;
    const ax = A.x, ay = A.y;
    for (const s of sts) {
      if (s === A || s === B) continue;
      const t = ((s.x - ax) * dx + (s.y - ay) * dy) / l2;
      const to = { x: Math.round((ax + dx * t) * 100) / 100, y: Math.round((ay + dy * t) * 100) / 100 };
      moveStation(s.id, { x: s.x, y: s.y }, to);
    }
    // линии: между вершинами выделенных станций убираем все вершины, не являющиеся станциями
    const anyStation = new Set(project.stations.map((s) => pkey(s)));
    const selPos = new Set(sts.map((s) => pkey(s)));
    for (const l of project.lines) {
      const idx = [];
      l.points.forEach((q, i) => { if (selPos.has(pkey(q))) idx.push(i); });
      for (let k = idx.length - 1; k >= 1; k--) {
        for (let m = idx[k] - 1; m > idx[k - 1]; m--) {
          if (!anyStation.has(pkey(l.points[m]))) removePoint(l, m);
        }
      }
    }
    relayoutLanes();
    changed();
    setStatus(tt("schemeAlignDone", { n: sts.length }));
  }

  // Точка на отрезке, кратная шагу сетки (для октилинейных отрезков — на сетке)
  function snapOnSegment(a, b, w) {
    const steps = Math.max(1, Math.round(Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) / project.grid));
    const ab = { x: b.x - a.x, y: b.y - a.y };
    const l2 = ab.x * ab.x + ab.y * ab.y || 1;
    const tt0 = Math.max(0, Math.min(1, ((w.x - a.x) * ab.x + (w.y - a.y) * ab.y) / l2));
    const k = Math.round(tt0 * steps);
    return { k, steps, p: { x: Math.round(a.x + (ab.x * k) / steps), y: Math.round(a.y + (ab.y * k) / steps) } };
  }

  function insertVertex(lineId, w) {
    const line = project.lines.find((l) => l.id === lineId);
    if (!line) return;
    const near = C().nearestOnPolyline(line.points, w);
    if (!near) return;
    const a = line.points[near.seg], b = line.points[near.seg + 1];
    const s = snapOnSegment(a, b, w);
    if (s.k <= 0 || s.k >= s.steps) return;
    pushHistory();
    insertPoint(line, near.seg + 1, s.p);
    sel = { kind: "node", x: s.p.x, y: s.p.y };
    changed();
  }

  function addStationAt(w) {
    pushHistory();
    let p = { x: snap(w.x), y: snap(w.y) };
    const onLines = [];
    // ставим на ближайшую линию, если щёлкнули рядом с ней
    let best = null;
    for (const l of project.lines) {
      const near = C().nearestOnPolyline(l.points, w);
      if (near && near.dist <= project.grid * 0.5 && (!best || near.dist < best.near.dist)) best = { line: l, near };
    }
    if (best) {
      const a = best.line.points[best.near.seg], b = best.line.points[best.near.seg + 1];
      const s = snapOnSegment(a, b, w);
      p = s.p;
      if (s.k > 0 && s.k < s.steps) insertPoint(best.line, best.near.seg + 1, { x: p.x, y: p.y });
      for (const l of project.lines) {
        const n = C().nearestOnPolyline(l.points, p);
        if (n && n.dist < 1) {
          onLines.push(l.id);
          if (l !== best.line && !l.points.some((q) => q.x === p.x && q.y === p.y)) insertPoint(l, n.seg + 1, { x: p.x, y: p.y });
        }
      }
    }
    const nStations = project.stations.length + 1;
    const st = {
      id: "st-" + Date.now().toString(36), name: tt("schemeNewStation", { n: nStations }), sub: "",
      x: p.x, y: p.y, style: "auto", label: { pos: "auto", angle: 0 }, lineIds: onLines,
    };
    project.stations.push(st);
    sel = { kind: "station", id: st.id };
    changed();
  }

  function finishLine() {
    if (!drawing) return;
    const pts = drawing.points;
    if (pts.length >= 2) {
      pushHistory();
      const n = project.lines.length + 1;
      const line = {
        id: "line-" + Date.now().toString(36), name: tt("schemeNewLine", { n }), number: String(n),
        color: drawing.color, width: null, dash: "solid", offset: 0, points: pts,
      };
      project.lines.push(line);
      for (const st of project.stations) {
        if (pts.some((q) => q.x === st.x && q.y === st.y) && !st.lineIds.includes(line.id)) st.lineIds.push(line.id);
      }
      sel = { kind: "line", id: line.id };
    }
    drawing = null;
    hoverPt = null;
    setTool("select");
    changed();
  }

  function addTransfer(a, b) {
    pushHistory();
    const ta = project.transfers.find((x) => x.stationIds.includes(a));
    const tb = project.transfers.find((x) => x.stationIds.includes(b));
    if (ta && tb && ta === tb) return;
    if (ta && tb) {
      ta.stationIds = [...new Set([...ta.stationIds, ...tb.stationIds])];
      project.transfers = project.transfers.filter((x) => x !== tb);
    } else if (ta || tb) {
      const tr = ta || tb;
      tr.stationIds = [...new Set([...tr.stationIds, a, b])];
    } else {
      project.transfers.push({ id: "tr-" + Date.now().toString(36), stationIds: [a, b] });
    }
  }

  function deleteSelection() {
    if (group) {
      pushHistory();
      project.stations = project.stations.filter((s) => !group.stations.has(s.id));
      project.transfers.forEach((t) => { t.stationIds = t.stationIds.filter((id) => !group.stations.has(id)); });
      project.transfers = project.transfers.filter((t) => t.stationIds.length >= 2);
      project.shapes = project.shapes.filter((s) => !group.shapes.has(s.id));
      for (const l of project.lines) {
        for (let i = l.points.length - 1; i >= 0; i--) {
          if (group.nodes.has(pkey(l.points[i])) && l.points.length > 2) removePoint(l, i);
        }
      }
      clearSelection();
      changed();
      return;
    }
    if (!sel) return;
    pushHistory();
    if (sel.kind === "station") {
      project.stations = project.stations.filter((s) => s.id !== sel.id);
      project.transfers.forEach((t) => { t.stationIds = t.stationIds.filter((id) => id !== sel.id); });
      project.transfers = project.transfers.filter((t) => t.stationIds.length >= 2);
    } else if (sel.kind === "shape") {
      project.shapes = project.shapes.filter((s) => s.id !== sel.id);
    } else if (sel.kind === "line" && sel.vidx != null) {
      // выбрана точка линии — удаляем точку, а не линию
      const l = project.lines.find((x) => x.id === sel.id);
      if (l && l.points.length > 2) removePoint(l, sel.vidx);
      sel = { kind: "line", id: sel.id };
      changed();
      return;
    } else if (sel.kind === "line") {
      project.lines = project.lines.filter((l) => l.id !== sel.id);
      project.stations.forEach((s) => {
        s.lineIds = s.lineIds.filter((id) => id !== sel.id);
        s.passLineIds = (s.passLineIds || []).filter((id) => id !== sel.id);
      });
    } else if (sel.kind === "transfer") {
      project.transfers = project.transfers.filter((t) => t.id !== sel.id);
    } else if (sel.kind === "node") {
      // угол убирается у всех линий, которые через него проходят
      for (const l of project.lines) {
        const i = l.points.findIndex((q) => q.x === sel.x && q.y === sel.y);
        if (i >= 0 && l.points.length > 2) removePoint(l, i);
      }
    } else if (sel.kind === "legend") {
      project.legend.show = false;
    }
    sel = null;
    changed();
  }

  // Слой/порядок фигуры и дублирование
  function moveShapeOrder(sh, toFront) {
    pushHistory();
    project.shapes = project.shapes.filter((x) => x !== sh);
    if (toFront) project.shapes.push(sh); else project.shapes.unshift(sh);
    changed();
  }
  function duplicateShape(sh) {
    pushHistory();
    const copy = C().normalizeShape(Object.assign({}, sh, { id: "sh-" + Date.now().toString(36), x: sh.x + 20, y: sh.y + 20 }));
    project.shapes.push(copy);
    sel = { kind: "shape", id: copy.id };
    changed();
  }

  function setTool(name) {
    if (tool === "line" && name !== "line") { drawing = null; }
    tool = name;
    transferFirst = null;
    hoverPt = null;
    el.toolBtns.forEach((b) => b.classList.toggle("active", b.dataset.tool === name));
    el.svg.dataset.tool = name;
    el.toolHint.textContent = tt("schemeToolHint_" + name);
    renderOverlay();
    renderProps();
  }

  function fitView() {
    const b = C().bounds(project);
    if (!b) return;
    const r = el.svg.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const pad = 60;
    const w = Math.max(1, b.maxX - b.minX), h = Math.max(1, b.maxY - b.minY);
    const z = Math.max(0.03, Math.min(3, Math.min((r.width - pad * 2) / w, (r.height - pad * 2) / h)));
    project.view = { zoom: z, x: r.width / 2 - ((b.minX + b.maxX) / 2) * z, y: r.height / 2 - ((b.minY + b.maxY) / 2) * z };
    applyView();
    renderOverlay();
    scheduleSave();
  }

  function zoomBy(k) {
    const r = el.svg.getBoundingClientRect();
    const v = project.view;
    const cx = r.width / 2, cy = r.height / 2;
    const z = Math.max(0.03, Math.min(8, v.zoom * k));
    v.x = cx - ((cx - v.x) / v.zoom) * z;
    v.y = cy - ((cy - v.y) / v.zoom) * z;
    v.zoom = z;
    applyView();
    renderOverlay();
    scheduleSave();
  }

  // ------------------------------------------------------------
  // Связь с остальным приложением
  // ------------------------------------------------------------
  function openStation(mtrStationId) {
    if (typeof gotoStationSchedule === "function") gotoStationSchedule(mtrStationId);
  }
  function openRoute(routeId) {
    if (typeof openRouteModal === "function") openRouteModal(routeId);
  }

  // ------------------------------------------------------------
  // Панель свойств (только DOM-API, без innerHTML с данными)
  // ------------------------------------------------------------
  function h(tag, attrs, children) {
    const e = document.createElement(tag);
    if (attrs) for (const k of Object.keys(attrs)) {
      if (k === "text") e.textContent = attrs[k];
      else if (k === "class") e.className = attrs[k];
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null && attrs[k] !== false) e.setAttribute(k, attrs[k] === true ? "" : attrs[k]);
    }
    (children || []).forEach((c) => c && e.appendChild(c));
    return e;
  }
  function field(labelKey, input) {
    return h("label", { class: "scheme-field" }, [h("span", { text: tt(labelKey) }), input]);
  }
  // Поле, правка которого кладёт ОДИН снимок в историю на серию нажатий
  function bindEdit(input, apply, evt) {
    let pushed = false;
    input.addEventListener("focus", () => { pushed = false; });
    input.addEventListener(evt || "input", () => {
      if (!pushed) { pushHistory(); pushed = true; }
      apply(input.type === "checkbox" ? input.checked : input.value);
      render();
      scheduleSave();
    });
    return input;
  }
  function textInput(value, apply) { return bindEdit(h("input", { type: "text", value: value || "" }), apply); }
  function numInput(value, min, max, apply, placeholder) {
    return bindEdit(h("input", { type: "number", min, max, value: value == null ? "" : value, placeholder }), apply);
  }
  function colorInput(value, apply) { return bindEdit(h("input", { type: "color", value }), apply); }
  function selectInput(value, options, apply) {
    const s = h("select", null, options.map(([v, label]) => h("option", { value: v, text: label })));
    s.value = String(value);
    return bindEdit(s, apply, "change");
  }
  function checkInput(value, apply) { return bindEdit(h("input", { type: "checkbox", checked: !!value }), apply, "change"); }
  function button(labelKey, onclick, cls) {
    return h("button", { type: "button", class: cls || "secondary-btn", text: tt(labelKey), onclick });
  }

  // Цвет с возможностью сбросить на значение по умолчанию (value = "")
  function optColor(value, fallback, apply) {
    const inp = bindEdit(h("input", { type: "color", value: value || fallback }), apply);
    const reset = h("button", {
      type: "button", class: "icon-btn", text: "×", title: tt("schemeReset"),
      onclick: () => { pushHistory(); apply(""); render(); renderProps(); scheduleSave(); },
    });
    return h("span", { class: "scheme-optcolor" + (value ? "" : " is-default") }, [inp, reset]);
  }
  // Цвет фигуры: значение или «нет» (none)
  function noneColor(value, apply) {
    const inp = bindEdit(h("input", { type: "color", value: value && value !== "none" ? value : "#ffffff" }), apply);
    const none = h("button", {
      type: "button", class: "icon-btn" + (value === "none" ? " active" : ""), text: "∅", title: tt("schemeNone"),
      onclick: () => { pushHistory(); apply("none"); render(); renderProps(); scheduleSave(); },
    });
    return h("span", { class: "scheme-optcolor" + (value === "none" ? " is-default" : "") }, [inp, none]);
  }
  // Число или пусто (= по умолчанию)
  function optNum(value, min, max, step, apply, placeholder) {
    const inp = h("input", { type: "number", min, max, step, value: value == null ? "" : value, placeholder });
    return bindEdit(inp, (v) => apply(v === "" ? null : Math.max(min, Math.min(max, Number(v) || min))));
  }
  // Контрастные цвета обводки групп объединённых линий
  const RING_COLORS = ["#f59e0b", "#22d3ee", "#a3e635", "#f472b6", "#a78bfa", "#fb7185", "#2dd4bf", "#facc15", "#60a5fa", "#fb923c"];
  // Глаз (открыт / перечёркнут) — SVG через DOM-API
  function eyeIcon(off) {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    [["width", "16"], ["height", "16"], ["viewBox", "0 0 24 24"], ["fill", "none"], ["stroke", "currentColor"],
      ["stroke-width", "2"], ["stroke-linecap", "round"], ["stroke-linejoin", "round"]].forEach(([a, v]) => svg.setAttribute(a, v));
    const add = (tag, attrs) => { const n = document.createElementNS(NS, tag); Object.keys(attrs).forEach((a) => n.setAttribute(a, attrs[a])); svg.appendChild(n); };
    add("path", { d: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" });
    add("circle", { cx: "12", cy: "12", r: "3" });
    if (off) add("path", { d: "M3 3l18 18" });
    return svg;
  }
  function slider(value, min, max, step, apply) {
    const out = h("span", { class: "scheme-offset-val", text: String(value) });
    const inp = h("input", { type: "range", min, max, step, value });
    inp.addEventListener("input", () => { out.textContent = inp.value; });
    bindEdit(inp, (v) => apply(Number(v)));
    return h("span", { class: "scheme-slider" }, [inp, out]);
  }

  function stationFields(st) {
    return [
      field("schemeFieldStationStyle", selectInput(st.style, C().STATION_STYLES.map((s) => [s, tt("schemeStStyle_" + s)]), (v) => { st.style = v; })),
      field("schemeFieldTransferStyle", selectInput(st.transferStyle || "", [["", tt("schemeTrStyle_default")], ...C().TRANSFER_STYLES.map((x) => [x, tt("schemeTrStyle_" + x)])], (v) => { st.transferStyle = v; })),
      field("schemeFieldFill", optColor(st.fill, project.style.stationFill, (v) => { st.fill = v; })),
      field("schemeFieldStroke", optColor(st.stroke, project.style.stationStroke, (v) => { st.stroke = v; })),
      field("schemeFieldStrokeW", optNum(st.strokeW, 0, 20, 0.5, (v) => { st.strokeW = v; }, "auto")),
      field("schemeFieldSize", slider(st.size, 0.3, 4, 0.1, (v) => { st.size = v; })),
      field("schemeFieldLabelPos", selectInput(st.label.pos, C().LABEL_POS.map((s) => [s, tt("schemeLabelPos_" + s)]), (v) => { st.label.pos = v; })),
      field("schemeFieldLabelAngle", selectInput(st.label.angle, C().LABEL_ANGLES.map((a) => [a, a + "°"]), (v) => { st.label.angle = Number(v); })),
      field("schemeFieldLabelSize", optNum(st.labelSize, 6, 48, 1, (v) => { st.labelSize = v; }, String(project.style.labelSize))),
      field("schemeFieldLabelColor", optColor(st.labelColor, project.style.labelColor, (v) => { st.labelColor = v; })),
      ...stationExtraFields(st),
    ];
  }

  // Подпись и блок номеров маршрутов двигаются мышью; здесь — сброс сдвига
  // и «показывать номера» (блок есть только у станций, где кончаются линии)
  function stationExtraFields(st) {
    const rows = [];
    const reset = (key, fn) => button(key, () => { pushHistory(); fn(); changed(); });
    if (st.label.dx || st.label.dy) rows.push(h("div", { class: "scheme-btn-row" }, [reset("schemeLabelReset", () => { st.label.dx = 0; st.label.dy = 0; })]));
    const isEnd = project.lines.some((l) => st.lineIds.includes(l.id) && l.points.length > 1
      && [l.points[0], l.points[l.points.length - 1]].some((q) => q.x === st.x && q.y === st.y));
    if (isEnd) {
      rows.push(field("schemeFieldBadgeShow", checkInput(!st.badge.hide, (v) => { st.badge.hide = !v; })));
      if (st.badge.dx || st.badge.dy) rows.push(h("div", { class: "scheme-btn-row" }, [reset("schemeBadgeReset", () => { st.badge.dx = 0; st.badge.dy = 0; })]));
    }
    return rows;
  }

  // ---- Значки: выбор рисунка, плашки, импорт своих картинок ----
  function iconName(it) { return it[typeof currentLang === "function" ? currentLang() : "en"] || it.en; }
  function iconThumb(id, variant, color, plate, px) {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("width", px); svg.setAttribute("height", px); svg.setAttribute("viewBox", `0 0 ${px} ${px}`);
    window.MapIcons.draw(svg, id, variant, px / 2, px / 2, px - 2, { color, plate, plateColor: color, bg: "#ffffff" });
    return svg;
  }
  function imgThumb(src, px) {
    return h("img", { src, width: px, height: px, class: "scheme-icon-img", alt: "" });
  }
  // target — значок на схеме (применить сразу) или iconPick (для следующего)
  function iconFields(target, isPick) {
    const MI = window.MapIcons;
    const sync = () => { if (!isPick) Object.assign(iconPick, { icon: target.icon, variant: target.variant, plate: target.plate, plateColor: target.plateColor, img: target.img, fill: target.fill }); };
    const commit = (fn) => {
      pushHistory();
      fn();
      sync();
      if (isPick) renderProps(); else changed();
      scheduleSave();
    };
    const rows = [];
    if (!MI) return rows;
    const isImg = !!target.img;
    rows.push(field("schemeFieldIconCategory", selectInput(isImg ? "" : target.icon, [...(isImg ? [["", tt("schemeIconCustom")]] : []), ...MI.CATALOG.map((it) => [it.id, iconName(it)])], (v) => {
      if (!v) return;
      target.icon = v; target.img = "";
      sync();
      renderProps();
    })));
    const col = target.fill && target.fill !== "none" ? target.fill : "#334155";
    if (!isImg) {
      const vr = h("div", { class: "scheme-icon-variants" });
      for (let v = 0; v < MI.VARIANTS; v++) {
        vr.append(h("button", {
          type: "button", class: "scheme-icon-btn" + (target.variant === v ? " active" : ""), title: tt("schemeFieldIconVariant") + " " + (v + 1),
          onclick: () => commit(() => { target.variant = v; }),
        }, [iconThumb(target.icon, v, col, "none", 34)]));
      }
      rows.push(field("schemeFieldIconVariant", vr));
    }
    rows.push(field("schemeFieldPlate", selectInput(target.plate, MI.PLATES.map((p) => [p, tt("schemePlate_" + p)]), (v) => { target.plate = v; sync(); renderProps(); })));
    if (!isImg || target.plate !== "none") rows.push(field("schemeFieldColor", colorInput(col, (v) => { target.fill = v; sync(); })));
    if (target.plate !== "none") rows.push(field("schemeFieldPlateColor", optColor(target.plateColor, col, (v) => { target.plateColor = v; sync(); })));
    if (!isPick) {
      rows.push(field("schemeFieldIconSize", numInput(Math.round(Math.min(target.w, target.h)), 8, 800, (v) => {
        const size = Math.max(8, Math.min(800, Number(v) || 48)), cx = target.x + target.w / 2, cy = target.y + target.h / 2;
        target.w = target.h = size; target.x = cx - size / 2; target.y = cy - size / 2;
      })));
    }
    // импорт своих картинок
    const file = h("input", { type: "file", accept: "image/png,image/jpeg,image/gif,image/webp,image/svg+xml,.svg", style: "display:none" });
    file.addEventListener("change", () => {
      const f = file.files && file.files[0];
      file.value = "";
      if (f) importIconFile(f, (img) => commit(() => { target.img = img; target.icon = "img"; }));
    });
    rows.push(h("div", { class: "scheme-btn-row" }, [h("button", { type: "button", class: "secondary-btn", text: tt("schemeIconImport"), onclick: () => file.click() }), file]));
    if (ui.customIcons.length) {
      const lib = h("div", { class: "scheme-icon-lib" });
      ui.customIcons.forEach((it) => {
        lib.append(h("span", { class: "scheme-icon-libitem" }, [
          h("button", { type: "button", class: "scheme-icon-btn" + (target.img === it.img ? " active" : ""), title: it.name, onclick: () => commit(() => { target.img = it.img; target.icon = "img"; }) }, [imgThumb(it.img, 34)]),
          h("button", { type: "button", class: "icon-btn scheme-icon-del", text: "×", title: tt("schemeIconDelete"), onclick: () => { ui.customIcons = ui.customIcons.filter((x) => x !== it); renderProps(); scheduleSave(); } }),
        ]));
      });
      rows.push(h("div", { class: "scheme-props-title", text: tt("schemeIconLibrary") }), lib);
    }
    return rows;
  }

  // Файл (PNG/JPG/GIF/WebP/SVG) → data-URL: растр уменьшается до ICON_PX по большей стороне,
  // SVG кладётся как есть (в <image> скрипты не выполняются); результат ≤ лимита schemeCore
  function importIconFile(file, done) {
    const isSvg = file.type === "image/svg+xml" || /\.svg$/i.test(file.name);
    if (!isSvg && !/^image\/(png|jpeg|gif|webp)$/.test(file.type)) { setStatus(tt("schemeIconBadType")); return; }
    if (file.size > 8 * 1024 * 1024) { setStatus(tt("schemeIconTooBig")); return; }
    const name = file.name.replace(/\.[^.]+$/, "").slice(0, 40) || "icon";
    const finish = (img) => {
      if (!img || img.length > 600000) { setStatus(tt("schemeIconTooBig")); return; }
      if (!ui.customIcons.some((x) => x.img === img)) ui.customIcons = [{ id: uid(), name, img }, ...ui.customIcons].slice(0, ICON_LIB_MAX);
      setStatus(tt("schemeIconImported", { name }));
      done(img);
    };
    const reader = new FileReader();
    if (isSvg) {
      reader.onload = () => {
        const text = String(reader.result || "");
        if (!/<svg[\s>]/i.test(text)) { setStatus(tt("schemeIconBadType")); return; }
        finish("data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(text))));
      };
      reader.readAsText(file);
    } else {
      reader.onload = () => {
        const im = new Image();
        im.onload = () => {
          const k = Math.min(1, ICON_PX / Math.max(im.naturalWidth, im.naturalHeight));
          const cv = document.createElement("canvas");
          cv.width = Math.max(1, Math.round(im.naturalWidth * k)); cv.height = Math.max(1, Math.round(im.naturalHeight * k));
          cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height);
          finish(cv.toDataURL("image/png"));
        };
        im.onerror = () => setStatus(tt("schemeIconBadType"));
        im.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    }
  }

  function shapeFields(sh) {
    const rows = [];
    if (sh.type === "icon") {
      rows.push(...iconFields(sh, false));
    } else if (sh.type === "text") {
      const ta = bindEdit(h("textarea", { rows: "3" }), (v) => { sh.text = v; });
      ta.value = sh.text;
      rows.push(field("schemeFieldText", ta));
      rows.push(field("schemeFieldFontSize", numInput(sh.fontSize, 6, 200, (v) => { sh.fontSize = Math.max(6, Math.min(200, Number(v) || 16)); })));
      rows.push(field("schemeFieldColor", noneColor(sh.fill, (v) => { sh.fill = v; })));
      rows.push(field("schemeFieldBold", checkInput(sh.bold, (v) => { sh.bold = v; })));
      rows.push(field("schemeFieldAlign", selectInput(sh.align, [["start", tt("schemeAlign_start")], ["middle", tt("schemeAlign_middle")], ["end", tt("schemeAlign_end")]], (v) => { sh.align = v; })));
    } else {
      if (sh.type !== "line") rows.push(field("schemeFieldFill", noneColor(sh.fill, (v) => { sh.fill = v; })));
      rows.push(field(sh.type === "line" ? "schemeFieldColor" : "schemeFieldStroke", noneColor(sh.stroke, (v) => { sh.stroke = v; })));
      rows.push(field("schemeFieldStrokeW", numInput(sh.strokeW, 0, 60, (v) => { sh.strokeW = Math.max(0, Math.min(60, Number(v) || 0)); })));
      rows.push(field("schemeFieldDash", selectInput(sh.dash, C().SHAPE_DASHES.map((d) => [d, tt("schemeDash_" + d)]), (v) => { sh.dash = v; })));
      if (sh.type === "rect") rows.push(field("schemeFieldRadius", numInput(sh.rx, 0, 500, (v) => { sh.rx = Math.max(0, Number(v) || 0); })));
    }
    rows.push(field("schemeFieldOpacity", slider(sh.opacity, 0.1, 1, 0.05, (v) => { sh.opacity = v; })));
    if (sh.type !== "line") rows.push(field("schemeFieldRotation", numInput(sh.rot, -180, 180, (v) => { sh.rot = Math.max(-180, Math.min(180, Number(v) || 0)); })));
    rows.push(field("schemeFieldLayer", selectInput(sh.layer, [["back", tt("schemeLayer_back")], ["front", tt("schemeLayer_front")]], (v) => { sh.layer = v; })));
    return rows;
  }

  function styleButtons() {
    const row = h("div", { class: "scheme-btn-row" }, [button("schemeCopyStyle", copyStyle)]);
    if (styleClip) row.append(button("schemePasteStyle", pasteStyle));
    return row;
  }

  // Списки для быстрого переименования линий и станций
  function renameLists() {
    const wrap = h("div", { class: "scheme-lists" });
    const lines = project.lines.filter((l) => l.points.length >= 2);
    if (lines.length) {
      wrap.append(h("div", { class: "scheme-props-title", text: tt("schemeListLines") }));
      // показ линий по типам (например, скрыть автобусы, не удаляя их)
      const typeCount = new Map();
      lines.forEach((l) => { if (l.mtrType) typeCount.set(l.mtrType, (typeCount.get(l.mtrType) || 0) + 1); });
      if (typeCount.size > 1) {
        wrap.append(h("div", { class: "scheme-type-chips" }, [...typeCount.keys()].sort().map((type) => {
          const of = lines.filter((l) => l.mtrType === type);
          const shown = of.some((l) => !l.hidden);
          return h("button", {
            type: "button", class: "scheme-chip" + (shown ? " on" : ""), title: tt("schemeToggleType"),
            text: typeLabel(type) + " " + of.length,
            onclick: () => { pushHistory(); of.forEach((l) => { l.hidden = shown; }); relayoutLanes(); changed(); },
          });
        })));
      }
      // у каждой объединённой группы своя обводка — чтобы группы различались
      const groupIds = [...new Set(lines.filter((l) => l.group).map((l) => l.group))].sort();
      const groupColor = (g) => RING_COLORS[groupIds.indexOf(g) % RING_COLORS.length];
      lines.forEach((l) => {
        const pick = h("input", { type: "checkbox", class: "scheme-list-pick", title: tt("schemeMergePick") });
        pick.checked = mergePick.has(l.id);
        pick.addEventListener("change", () => { if (pick.checked) mergePick.add(l.id); else mergePick.delete(l.id); });
        const eye = h("button", {
          type: "button", class: "icon-btn scheme-eye" + (l.hidden ? " off" : ""), title: tt("schemeToggleLine"),
          onclick: () => { pushHistory(); l.hidden = !l.hidden; relayoutLanes(); changed(); },
        }, [eyeIcon(!!l.hidden)]);
        const colorInp = bindEdit(h("input", { type: "color", value: l.color, class: "scheme-list-color" }), (v) => { l.color = v; shareGroupProps(l); });
        if (l.group) colorInp.style.outline = "2px solid " + groupColor(l.group);
        wrap.append(h("div", { class: "scheme-list-row" + (l.group ? " is-merged" : "") + (l.hidden ? " is-hidden" : "") }, [
          eye,
          pick,
          colorInp,
          bindEdit(h("input", { type: "text", value: l.number, class: "scheme-list-num", title: tt("schemeFieldNumber") }), (v) => { l.number = v.slice(0, 24); }),
          bindEdit(h("input", { type: "text", value: l.name, class: "scheme-list-name", title: tt("schemeFieldName") }), (v) => { l.name = v; }),
          h("button", { type: "button", class: "icon-btn", text: "◎", title: tt("schemeSelectLine"), onclick: () => { clearSelection(); sel = { kind: "line", id: l.id }; renderOverlay(); renderProps(); } }),
        ]));
      });
    }
    if (lines.length > 1) {
      wrap.append(
        h("p", { class: "hint small", text: tt("schemeMergeHint") }),
        h("div", { class: "scheme-btn-row" }, [
          button("schemeMergeBtn", mergeLines),
          button("schemeUnmergeBtn", () => { unmergeLines(new Set(mergePick)); mergePick.clear(); renderProps(); }),
        ]),
      );
    }
    wrap.append(h("div", { class: "scheme-props-title", text: tt("schemeListStations") }));
    const search = h("input", { type: "text", placeholder: tt("schemeSearchStations") });
    const box = h("div", { class: "scheme-station-list" });
    const fill = () => {
      const q = search.value.trim().toLowerCase();
      const hits = project.stations.filter((s) => !q || (s.name + " " + s.sub).toLowerCase().includes(q)).slice(0, 40);
      box.replaceChildren(...hits.map((s) => h("div", { class: "scheme-list-row" }, [
        bindEdit(h("input", { type: "text", value: s.name, class: "scheme-list-name" }), (v) => { s.name = v; }),
        h("button", { type: "button", class: "icon-btn", text: "◎", title: tt("schemeFindStation"), onclick: () => focusStation(s.id) }),
      ])));
    };
    search.addEventListener("input", fill);
    fill();
    wrap.append(search, box);
    return wrap;
  }

  function focusStation(id) {
    const st = project.stations.find((s) => s.id === id);
    if (!st) return;
    const r = el.svg.getBoundingClientRect();
    const v = project.view;
    v.zoom = Math.max(v.zoom, 1);
    v.x = r.width / 2 - st.x * v.zoom;
    v.y = r.height / 2 - st.y * v.zoom;
    clearSelection();
    sel = { kind: "station", id };
    applyView();
    renderOverlay();
    renderProps();
    scheduleSave();
  }

  function renderProps() {
    const box = el.props;
    if (!box) return;
    box.replaceChildren();
    const title = (key) => h("div", { class: "scheme-props-title", text: tt(key) });

    if (group) {
      const n = group.stations.size, m = group.shapes.size, k = group.nodes.size;
      box.append(title("schemePropGroup"), h("p", { class: "hint small", text: tt("schemeGroupInfo", { s: n, f: m, n: k }) }));
      if (n) {
        // общие правки применяются ко всем станциям группы
        const firstId = [...group.stations][0];
        const first = project.stations.find((s) => s.id === firstId);
        const proxy = Object.assign({}, first, { label: Object.assign({}, first && first.label) });
        const applyAll = (fn) => (v) => { project.stations.forEach((s) => { if (group.stations.has(s.id)) fn(s, v); }); };
        box.append(
          field("schemeFieldStationStyle", selectInput(proxy.style, C().STATION_STYLES.map((s) => [s, tt("schemeStStyle_" + s)]), applyAll((s, v) => { s.style = v; }))),
          field("schemeFieldFill", optColor(proxy.fill, project.style.stationFill, applyAll((s, v) => { s.fill = v; }))),
          field("schemeFieldStroke", optColor(proxy.stroke, project.style.stationStroke, applyAll((s, v) => { s.stroke = v; }))),
          field("schemeFieldTransferStyle", selectInput(proxy.transferStyle || "", [["", tt("schemeTrStyle_default")], ...C().TRANSFER_STYLES.map((x) => [x, tt("schemeTrStyle_" + x)])], applyAll((s, v) => { s.transferStyle = v; }))),
          field("schemeFieldSize", slider(proxy.size, 0.3, 4, 0.1, applyAll((s, v) => { s.size = v; }))),
          field("schemeFieldLabelPos", selectInput(proxy.label.pos, C().LABEL_POS.map((s) => [s, tt("schemeLabelPos_" + s)]), applyAll((s, v) => { s.label.pos = v; }))),
        );
      }
      if (n >= 2) box.append(button("schemeAlignLine", alignGroupInLine), h("p", { class: "hint small", text: tt("schemeAlignHint") }));
      box.append(h("p", { class: "hint small", text: tt("schemeGroupHint") }), styleButtons(), button("schemeDeleteGroup", deleteSelection, "secondary-btn danger"));
      return;
    }
    if (sel && sel.kind === "station") {
      const st = project.stations.find((s) => s.id === sel.id);
      if (!st) { sel = null; return renderProps(); }
      box.append(
        title("schemePropStation"),
        field("schemeFieldName", textInput(st.name, (v) => { st.name = v; })),
        field("schemeFieldSub", textInput(st.sub, (v) => { st.sub = v; })),
        ...stationFields(st),
        styleButtons(),
      );
      if (st.passLineIds && st.passLineIds.length) {
        box.append(h("p", { class: "hint small", text: tt("schemePassInfo", { n: st.passLineIds.length }) }));
      }
      if (st.mtrStationId) box.append(button("schemeOpenSchedule", () => openStation(st.mtrStationId)));
      box.append(button("schemeDelete", deleteSelection, "secondary-btn danger"));
      return;
    }
    if (tool === "icon" && !sel && !group) {
      box.append(title("schemePropShape_icon"), h("p", { class: "hint small", text: tt("schemeToolHint_icon") }), ...iconFields(iconPick, true));
      return;
    }
    if (sel && sel.kind === "shape") {
      const sh = project.shapes.find((s) => s.id === sel.id);
      if (!sh) { sel = null; return renderProps(); }
      box.append(
        title("schemePropShape_" + sh.type),
        ...shapeFields(sh),
        styleButtons(),
        h("div", { class: "scheme-btn-row" }, [
          button("schemeToFront", () => moveShapeOrder(sh, true)),
          button("schemeToBack", () => moveShapeOrder(sh, false)),
          button("schemeDuplicate", () => duplicateShape(sh)),
        ]),
        button("schemeDelete", deleteSelection, "secondary-btn danger"),
      );
      return;
    }
    if (sel && sel.kind === "node") {
      const n = project.lines.filter((l) => l.points.some((q) => q.x === sel.x && q.y === sel.y)).length;
      box.append(
        title("schemePropNode"),
        h("p", { class: "hint small", text: tt("schemeNodeHint", { n }) }),
        button("schemeDeleteVertex", deleteSelection, "secondary-btn danger"),
      );
      return;
    }
    if (sel && sel.kind === "line") {
      const line = project.lines.find((l) => l.id === sel.id);
      if (!line) { sel = null; return renderProps(); }
      const offsetVal = h("span", { class: "scheme-offset-val", text: String(line.offset) });
      const bump = (d) => () => { pushHistory(); line.offset = Math.max(-8, Math.min(8, line.offset + d)); shareGroupProps(line); offsetVal.textContent = String(line.offset); render(); scheduleSave(); };
      box.append(
        title("schemePropLine"),
        field("schemeFieldName", textInput(line.name, (v) => { line.name = v; })),
        field("schemeFieldNumber", textInput(line.number, (v) => { line.number = v; })),
        field("schemeFieldColor", colorInput(line.color, (v) => { line.color = v; shareGroupProps(line); })),
        field("schemeFieldWidth", numInput(line.width, 1, 30, (v) => { line.width = v === "" ? null : Math.max(1, Math.min(30, Number(v) || 1)); shareGroupProps(line); }, String(project.style.lineWidth))),
        field("schemeFieldDash", selectInput(line.dash, C().DASHES.map((d) => [d, tt("schemeDash_" + d)]), (v) => { line.dash = v; shareGroupProps(line); })),
        field("schemeFieldOffset", h("span", { class: "scheme-offset" }, [
          h("button", { type: "button", class: "icon-btn", text: "−", onclick: bump(-1) }), offsetVal,
          h("button", { type: "button", class: "icon-btn", text: "+", onclick: bump(1) }),
        ])),
        h("p", { class: "hint small", text: tt("schemeLineEditHint") }),
        styleButtons(),
      );
      if (line.group) {
        const n = project.lines.filter((l) => l.group === line.group).length;
        box.append(
          h("p", { class: "hint small", text: tt("schemeMergedInfo", { n }) }),
          button("schemeUnmergeOne", () => unmergeLines(new Set([line.id]))),
        );
      }
      if (sel.vidx != null) box.append(button("schemeDeleteVertex", deleteSelection));
      if (line.mtrRouteIds && line.mtrRouteIds.length) box.append(button("schemeOpenRoute", () => openRoute(line.mtrRouteIds[0])));
      box.append(button("schemeDeleteLine", () => { sel = { kind: "line", id: line.id }; deleteSelection(); }, "secondary-btn danger"));
      return;
    }
    if (sel && sel.kind === "transfer") {
      const tr = project.transfers.find((x) => x.id === sel.id);
      if (!tr) { sel = null; return renderProps(); }
      box.append(title("schemePropTransfer"));
      box.append(field("schemeFieldTransferStyle", selectInput(tr.style || "", [["", tt("schemeTrStyle_default")], ...C().TRANSFER_STYLES.map((x) => [x, tt("schemeTrStyle_" + x)])], (v) => { tr.style = v; })));
      tr.stationIds.forEach((id) => {
        const st = project.stations.find((s) => s.id === id);
        if (st) box.append(h("div", { class: "scheme-props-item", text: st.name || id }));
      });
      box.append(button("schemeDelete", deleteSelection, "secondary-btn danger"));
      return;
    }
    // Ничего не выбрано / легенда — общие настройки схемы
    const st = project.style;
    box.append(
      title("schemePropScheme"),
      field("schemeFieldTitle", textInput(project.title, (v) => { project.title = v; })),
      field("schemeFieldMapScale", h("span", { class: "scheme-btn-row" }, [
        h("button", { type: "button", class: "secondary-btn", text: "−", title: tt("schemeMapScaleDown"), onclick: () => scaleMap(0.5) }),
        h("button", { type: "button", class: "secondary-btn", text: "+", title: tt("schemeMapScaleUp"), onclick: () => scaleMap(2) }),
      ])),
      title("schemePropLook"),
      field("schemeFieldLineWidth", slider(st.lineWidth, 1, 24, 1, (v) => { st.lineWidth = v; })),
      field("schemeFieldLaneGap", slider(st.laneGap, 0, 8, 0.5, (v) => { st.laneGap = v; })),
      field("schemeFieldCorner", slider(st.cornerRadius, 0, 60, 1, (v) => { st.cornerRadius = v; })),
      field("schemeFieldStationScale", slider(st.stationScale, 0.3, 3, 0.1, (v) => { st.stationScale = v; })),
      field("schemeFieldTransferStyle", selectInput(st.transferStyle, C().TRANSFER_STYLES.map((x) => [x, tt("schemeTrStyle_" + x)]), (v) => { st.transferStyle = v; })),
      field("schemeFieldTransferScale", slider(st.transferScale, 0.2, 3, 0.1, (v) => { st.transferScale = v; })),
      field("schemeFieldStationFill", colorInput(st.stationFill, (v) => { st.stationFill = v; })),
      field("schemeFieldStationStroke", colorInput(st.stationStroke, (v) => { st.stationStroke = v; })),
      field("schemeFieldLabelSize", numInput(st.labelSize, 6, 48, (v) => { st.labelSize = Math.max(6, Math.min(48, Number(v) || 12)); })),
      field("schemeFieldLabelColor", colorInput(st.labelColor, (v) => { st.labelColor = v; })),
      field("schemeFieldLabelAuto", checkInput(st.labelAuto, (v) => { st.labelAuto = v; })),
      field("schemeFieldBg", colorInput(st.bg, (v) => { st.bg = v; })),
      title("schemePropLegend"),
      field("schemeFieldShowLegend", checkInput(project.legend.show, (v) => { project.legend.show = v; })),
      field("schemeFieldLegendTitle", textInput(project.legend.title, (v) => { project.legend.title = v; })),
      h("p", { class: "hint small", text: tt("schemeStats", { lines: project.lines.length, stations: project.stations.length, transfers: project.transfers.length }) }),
      renameLists(),
    );
  }

  // ------------------------------------------------------------
  // Живые данные: конфликты на станциях и опоздания линий
  // ------------------------------------------------------------
  async function refreshLive() {
    if (!ui.live) return;
    const ids = [...new Set(project.stations.map((s) => s.mtrStationId).filter(Boolean))];
    const minInt = (typeof state !== "undefined" && state.minIntervalMin) || 3;
    const thr = (typeof settings !== "undefined" && settings.delayThresholdMin) || 3;
    const conflictStations = new Map();
    try {
      for (let i = 0; i < ids.length; i += 60) {
        const part = ids.slice(i, i + 60);
        const res = await fetch(`/api/analytics/conflict-scan?minIntervalMin=${minInt}&limit=200&ids=${encodeURIComponent(part.join(","))}`);
        if (!res.ok) continue;
        const body = await res.json();
        (body.conflicts || []).forEach((c) => conflictStations.set(c.stationId, c.conflictCount));
      }
      const delays = await fetch(`/api/analytics/live-delays?thresholdMin=${thr}`).then((r) => (r.ok ? r.json() : []));
      const delayedRoutes = new Map((Array.isArray(delays) ? delays : []).map((d) => [d.routeId, d.maxDeviationMs]));
      liveData = { conflictStations, delayedRoutes };
      if (ui.live) render();
      setStatus(tt("schemeLiveStatus", { c: conflictStations.size, d: delayedRoutes.size }));
    } catch (e) {
      setStatus(tt("schemeLiveError") + ": " + e.message);
    }
  }
  function setLive(on) {
    ui.live = !!on;
    if (el.liveToggle) el.liveToggle.checked = ui.live;
    clearInterval(liveTimer);
    liveTimer = null;
    if (ui.live) {
      refreshLive();
      liveTimer = setInterval(() => { if (visible()) refreshLive(); }, LIVE_REFRESH_MS);
    } else {
      liveData = null;
      render();
    }
  }

  // ------------------------------------------------------------
  // Построение, экспорт, публикация
  // ------------------------------------------------------------
  function setStatus(msg) { if (el.status) el.status.textContent = msg || ""; }

  function typeLabel(type) {
    // единые названия типов из приложения (Ship, Cable car, Airplane…), без эмодзи:
    // раньше boat_normal и cable_car_normal оба превращались в «Trains»
    if (typeof window.routeTypeName === "function") return window.routeTypeName(type);
    const m = /^(?:train|boat|cable_car|airplane)_(.+)$/.exec(type || "");
    return m ? m[1] : type;
  }

  async function loadSchemeData(force) {
    if (schemeData && !force) return schemeData;
    const res = await fetch("/api/scheme-data");
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || res.status);
    schemeData = body;
    return body;
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
    const selTypes = new Set(ui.types);
    el.typesPanel.replaceChildren(...all.map((type) => {
      const cb = h("input", { type: "checkbox", checked: selTypes.has(type) });
      cb.addEventListener("change", () => {
        const s = new Set(ui.types);
        if (cb.checked) s.add(type); else s.delete(type);
        ui.types = [...s];
        el.typesCount.textContent = `(${ui.types.length})`;
        scheduleSave();
      });
      return h("label", null, [cb, h("span", { text: " " + typeLabel(type) + " " }), h("span", { class: "hint small", text: `(${counts.get(type)})` })]);
    }));
    el.typesCount.textContent = `(${ui.types.length})`;
  }

  // Что изменит пересборка из MTR: объекты MTR (по префиксу id) добавятся,
  // исчезнут или будут переименованы (имя MTR изменилось, а вручную не правилось)
  function diffProjects(oldP, newP) {
    const cmp = (olds, news, prefix) => {
      const o = new Map(olds.filter((x) => isMtr(x.id, prefix)).map((x) => [x.id, x]));
      const n = new Map(news.filter((x) => isMtr(x.id, prefix)).map((x) => [x.id, x]));
      const r = { added: [], removed: [], renamed: [] };
      for (const [id, x] of n) {
        if (!o.has(id)) r.added.push(x.name);
        else if ((o.get(id).name || "") !== (x.name || "")) r.renamed.push(`${o.get(id).name || "—"} → ${x.name || "—"}`);
      }
      for (const [id, x] of o) if (!n.has(id)) r.removed.push(x.name);
      return r;
    };
    const lines = cmp(oldP.lines, newP.lines, P_LINE);
    const stations = cmp(oldP.stations, newP.stations, P_ST);
    const trOld = new Set(oldP.transfers.filter((t) => isMtr(t.id, P_TR)).map((t) => t.id));
    const trNew = new Set(newP.transfers.filter((t) => isMtr(t.id, P_TR)).map((t) => t.id));
    const transfers = { added: [...trNew].filter((id) => !trOld.has(id)).length, removed: [...trOld].filter((id) => !trNew.has(id)).length };
    const cnt = (r) => r.added.length + r.removed.length + r.renamed.length;
    return { lines, stations, transfers, total: cnt(lines) + cnt(stations) + transfers.added + transfers.removed };
  }

  function confirmRebuild(diff) {
    return new Promise((resolve) => {
      if (askBox) askBox.remove();
      const MAX = 14;
      const section = (titleKey, r) => {
        const nodes = [];
        const part = (cls, labelKey, arr) => {
          if (!arr.length) return;
          nodes.push(h("div", { class: "scheme-diff-head " + cls, text: tt(labelKey, { n: arr.length }) }));
          const ul = h("ul", { class: "scheme-diff-list " + cls });
          arr.slice(0, MAX).forEach((x) => ul.append(h("li", { text: x || "—" })));
          if (arr.length > MAX) ul.append(h("li", { class: "more", text: tt("schemeRebuildMore", { n: arr.length - MAX }) }));
          nodes.push(ul);
        };
        part("add", "schemeRebuildAdded", r.added);
        part("del", "schemeRebuildRemoved", r.removed);
        part("ren", "schemeRebuildRenamed", r.renamed);
        return nodes.length ? [h("div", { class: "scheme-diff-title", text: tt(titleKey) }), ...nodes] : [];
      };
      const done = (v) => { if (askBox) { askBox.remove(); askBox = null; } resolve(v); };
      const trLine = diff.transfers.added || diff.transfers.removed
        ? [h("div", { class: "scheme-diff-title", text: tt("schemeRebuildTransfers", { a: diff.transfers.added, r: diff.transfers.removed }) })] : [];
      askBox = h("div", { class: "scheme-ask scheme-diff" }, [
        h("div", { class: "scheme-ask-label", text: tt("schemeRebuildTitle", { n: diff.total }) }),
        h("div", { class: "scheme-diff-body" }, [...section("schemeListLines", diff.lines), ...section("schemeListStations", diff.stations), ...trLine]),
        h("div", { class: "scheme-ask-btns" }, [
          h("button", { type: "button", text: tt("schemeRebuildApply"), onclick: () => done(true) }),
          h("button", { type: "button", class: "secondary-btn", text: tt("schemeAskCancel"), onclick: () => done(false) }),
        ]),
      ]);
      el.canvasBox.appendChild(askBox);
    });
  }

  async function generate() {
    try {
      setStatus(tt("schemeGenerating"));
      const data = await loadSchemeData(true);
      renderTypes();
      const types = new Set(ui.types || []);
      if (!types.size) { setStatus(tt("schemeNoTypes")); return; }
      const res = buildFromMtr(data, types, project, { alignTol: ui.alignTol, compress: ui.compress, minGap: ui.minGap });
      // пересборка уже построенной схемы: сначала показываем, что изменится
      if (res.stats.hadMtr) {
        const diff = diffProjects(project, res.project);
        if (diff.total && !(await confirmRebuild(diff))) { setStatus(tt("schemeRebuildCancelled")); return; }
      }
      pushHistory();
      project = res.project;
      sel = null; group = null;
      changed();
      if (!res.stats.hadMtr) fitView();
      setStatus(tt(res.stats.hadMtr ? "schemeUpdated" : "schemeGenerated", res.stats) + (res.stats.compressSkipped ? " " + tt("schemeCompressSkipped") : ""));
      if (ui.live) refreshLive();
    } catch (e) {
      console.error("NetworkScheme.generate failed:", e);
      setStatus(tt("schemeGenerateError") + ": " + e.message);
    }
  }

  function resetScheme() {
    if (!confirm(tt("schemeResetConfirm"))) return;
    pushHistory();
    const view = project.view;
    project = C().emptyProject();
    project.view = view;
    sel = null; group = null;
    changed();
    setStatus("");
  }

  function download(blob, name) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  function exportSvg() {
    download(new Blob([C().toSvgString(project)], { type: "image/svg+xml" }), `network-map-${Date.now()}.svg`);
  }
  async function exportPng() {
    try {
      download(await C().toPngBlob(project, 2), `network-map-${Date.now()}.png`);
    } catch (e) {
      setStatus(tt("schemeExportError") + ": " + e.message);
    }
  }

  // ------------------------------------------------------------
  // «Поделиться»: автономный HTML-файл и просмотр в системном браузере
  // ------------------------------------------------------------
  function isEmpty() { return !project.stations.length && !project.lines.length; }
  function fileBaseName() {
    const name = (activeScheme() && activeScheme().name) || project.title || "network-map";
    return name.replace(/[\\/:*?"<>|\x00-\x1f]+/g, "_").trim().slice(0, 80) || "network-map";
  }
  // map.html + schemeCore.js + данные схемы в одном файле: открывается в любом
  // браузере (и на телефоне) без интернета, приложения и хостинга
  async function buildStandaloneHtml() {
    const get = async (u) => {
      const r = await fetch(u, { cache: "no-store" });
      if (!r.ok) throw new Error(`${u}: ${r.status}`);
      return r.text();
    };
    const [page, core, icons] = await Promise.all([get("map.html"), get("schemeCore.js"), get("mapIcons.js")]);
    const ICON_TAG = '<script src="mapIcons.js"></script>';
    const LZ_TAG = '<script src="vendor/lz-string.min.js"></script>';
    const CORE_TAG = '<script src="schemeCore.js"></script>';
    if (!page.includes(LZ_TAG) || !page.includes(CORE_TAG)) throw new Error("map.html");
    // JSON внутри <script>: «<» экранируем, чтобы данные не закрыли тег
    const data = JSON.stringify(C().toPublished(project)).replace(/</g, "\\u003c");
    const code = (icons + "\n" + core).replace(/<\/script/gi, "<\\/script");
    // функции-замены: в коде и данных могут встретиться «$&» и т.п.
    return page
      .replace(LZ_TAG, () => "")
      .replace(ICON_TAG, () => "")
      .replace(CORE_TAG, () => `<script type="application/json" id="mapData">${data}</script>\n<script>\n${code}\n</script>`);
  }
  async function saveHtml() {
    try {
      const html = await buildStandaloneHtml();
      download(new Blob([html], { type: "text/html" }), fileBaseName() + ".html");
      el.shareStatus.textContent = tt("schemeHtmlSaved", { kb: Math.ceil(html.length / 1024) });
    } catch (e) {
      el.shareStatus.textContent = tt("schemeExportError") + ": " + e.message;
    }
  }

  // Вкладка браузера с map.html#v=<id схемы> опрашивает /api/scheme-view/<id>;
  // после «Открыть в браузере» каждая правка схемы уходит туда сама.
  const viewOpened = new Set();
  let viewPushTimer = 0;
  async function pushView(id) {
    const r = await fetch("/api/scheme-view", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, data: C().toPublished(project) }),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.status);
  }
  function scheduleViewPush() {
    if (!viewOpened.has(activeId)) return;
    clearTimeout(viewPushTimer);
    const id = activeId;
    viewPushTimer = setTimeout(() => {
      if (id === activeId) pushView(id).catch((e) => console.warn("scheme view push:", e.message));
    }, VIEW_PUSH_DELAY);
  }
  async function openInBrowser() {
    try {
      await pushView(activeId);
      viewOpened.add(activeId);
      // в Electron window.open уходит в системный браузер (setWindowOpenHandler)
      window.open(`${location.origin}/map.html#v=${encodeURIComponent(activeId)}`, "_blank");
      el.shareStatus.textContent = tt("schemeBrowserOpened");
    } catch (e) {
      el.shareStatus.textContent = tt("schemeExportError") + ": " + e.message;
    }
  }

  function openPublish() {
    if (isEmpty()) { setStatus(tt("schemePublishEmpty")); return; }
    el.shareStatus.textContent = "";
    el.publishOverlay.style.display = "flex";
  }
  function closePublish() { el.publishOverlay.style.display = "none"; }

  // ------------------------------------------------------------
  // Режимы вкладки и инициализация
  // ------------------------------------------------------------
  // ------------------------------------------------------------
  // Объединение линий
  // ------------------------------------------------------------
  // Полосы в пучках заново — по геометрии (вершины = «станции» для
  // assignLanes). Применяются к линиям из MTR и объединённым; нарисованные
  // вручную остаются как есть.
  function relayoutLanes() {
    const pos = new Map();
    // вершина без станции — узел "~": в развилке там полосы сохраняют
    // позиции (без ступеньки), как в buildFromMtr
    const stKeys = new Set(project.stations.map(pkey));
    splitOverlaps(project.lines.filter((l) => l.points.length >= 2 && !l.hidden), insertPoint);
    const tmp = project.lines.filter((l) => l.points.length >= 2 && !l.hidden).map((l) => {
      const ids = [];
      l.points.forEach((q) => {
        const k = (stKeys.has(pkey(q)) ? "" : "~") + pkey(q);
        pos.set(k, { x: q.x, y: q.y });
        if (!ids.length || ids[ids.length - 1] !== k) ids.push(k);
      });
      return { ref: l, id: l.id, group: l.group, points: l.points, mtrStationIds: ids };
    });
    assignLanes(tmp, pos);
    compactLanes(tmp);
    tmp.forEach((t) => { if (isMtr(t.ref.id, P_LINE) || t.ref.group) t.ref.lanes = t.lanes; });
  }

  const mergePick = new Set();
  // Спокойные, но контрастные цвета для объединённых линий
  const GROUP_COLORS = ["#4e79a7", "#e15759", "#59a14f", "#f28e2b", "#b07aa1", "#76b7b2", "#edc948", "#9c755f", "#d37295", "#8c8c3a", "#5778a4", "#a0a0a0"];
  const rgb = (hex) => {
    const h6 = hex.replace("#", "");
    const f6 = h6.length === 3 ? h6.split("").map((ch) => ch + ch).join("") : h6.slice(0, 6);
    const n = parseInt(f6, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const colorDist = (a, b) => { const p = rgb(a), q = rgb(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
  // цвет из палитры, максимально далёкий от уже используемых другими линиями
  function pickGroupColor(exceptLines) {
    const used = project.lines.filter((l) => !exceptLines.includes(l)).map((l) => l.color);
    let best = GROUP_COLORS[0], bestD = -1;
    for (const col of GROUP_COLORS) {
      const d = used.length ? Math.min(...used.map((u) => colorDist(col, u))) : 999;
      if (d > bestD) { bestD = d; best = col; }
    }
    return best;
  }
  // Линия вместе со всей своей группой: цвет, вид, толщина и сдвиг — общие
  const groupOf = (line) => (line.group ? project.lines.filter((l) => l.group === line.group) : [line]);
  const GROUP_SHARED = ["color", "width", "dash", "offset"];
  function shareGroupProps(line) {
    if (!line.group) return;
    groupOf(line).forEach((l) => { if (l !== line) GROUP_SHARED.forEach((k) => { l[k] = line[k]; }); });
  }
  // Чтобы общие участки совпадали по перегонам, вершины одного маршрута
  // группы, лежащие на отрезке другого, вставляются и в него
  function splitAtMemberVertices(members) {
    for (const l of members) {
      for (const o of members) {
        if (o === l) continue;
        for (const q of o.points.slice()) {
          if (l.points.some((p) => p.x === q.x && p.y === q.y)) continue;
          const near = C().nearestOnPolyline(l.points, q);
          if (near && near.dist < 0.5) insertPoint(l, near.seg + 1, { x: q.x, y: q.y });
        }
      }
    }
  }

  function mergeLines() {
    const picked = project.lines.filter((l) => mergePick.has(l.id));
    // вместе с теми, кто уже в одной группе с выбранными
    const groups = new Set(picked.map((l) => l.group).filter(Boolean));
    const members = project.lines.filter((l) => mergePick.has(l.id) || (l.group && groups.has(l.group)));
    if (members.length < 2) { setStatus(tt("schemeMergeNeed")); return; }
    pushHistory();
    // цвет и параметры группы — от ПЕРВОЙ отмеченной пользователем линии
    const first = [...mergePick].map((id) => project.lines.find((l) => l.id === id)).find(Boolean);
    const master = first || members[0];
    const gid = master.group || members.map((l) => l.group).find(Boolean) || "g" + Date.now().toString(36);
    const color = master.color;
    members.forEach((l) => { l.group = gid; l.color = color; l.width = master.width; l.dash = master.dash; l.offset = master.offset; });
    splitAtMemberVertices(members);
    relayoutLanes();
    mergePick.clear();
    changed();
    setStatus(tt("schemeMerged", { n: members.length }));
  }

  function unmergeLines(ids) {
    const lines = project.lines.filter((l) => ids.has(l.id) && l.group);
    if (!lines.length) return;
    pushHistory();
    lines.forEach((l) => { l.group = ""; });
    relayoutLanes();
    changed();
    setStatus(tt("schemeUnmerged", { n: lines.length }));
  }

  // ------------------------------------------------------------
  // Несколько схем
  // ------------------------------------------------------------
  const uid = () => "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const activeScheme = () => schemes.find((s) => s.id === activeId);

  function ensureSchemes() {
    if (!project) project = C().emptyProject();
    if (!schemes.length) {
      activeId = uid();
      schemes = [{ id: activeId, name: tt("schemeDefaultName", { n: 1 }), project, types: ui.types }];
    }
    if (!activeScheme()) activeId = schemes[0].id;
  }
  // Текущее рабочее состояние → запись активной схемы
  function syncActive() {
    const e = activeScheme();
    if (!e) return;
    e.project = project;
    e.types = ui.types;
  }
  function refreshSchemeSelect() {
    if (!el.schemeSelect) return;
    el.schemeSelect.replaceChildren(...schemes.map((s) => h("option", { value: s.id, text: s.name })));
    el.schemeSelect.value = activeId;
    if (el.schemeDelBtn) el.schemeDelBtn.disabled = schemes.length < 2;
  }
  function switchScheme(id) {
    if (id === activeId) return;
    const e = schemes.find((s) => s.id === id);
    if (!e) return;
    syncActive();
    activeId = id;
    project = e.project;
    ui.types = e.types || null;
    undoStack = []; redoStack = [];
    clearSelection();
    liveData = null;
    refreshSchemeSelect();
    if (schemeData) renderTypes();
    changed();
    if (ui.live) refreshLive();
    setStatus("");
  }
  function newScheme() {
    askText(tt("schemeAskNewScheme"), tt("schemeDefaultName", { n: schemes.length + 1 }), (name) => {
      syncActive();
      const e = { id: uid(), name: name.trim() || tt("schemeDefaultName", { n: schemes.length + 1 }), project: C().emptyProject(), types: null };
      schemes.push(e);
      switchScheme(e.id);
      scheduleSave();
    });
  }
  // Схема станции из генератора табло: все маршруты через станцию, всех типов,
  // как новая схема; пользователь дорабатывает её здесь и жмёт «В табло»
  async function createStationScheme(stationId) {
    const data = await loadSchemeData(true);
    const routes = data.routes.filter((r) => (r.stationIds || []).includes(stationId));
    if (!routes.length) return false;
    const types = new Set(routes.map((r) => r.type));
    const st = data.stations.find((s) => s.id === stationId);
    syncActive();
    const e = { id: uid(), name: (st && st.name) || tt("schemeDefaultName", { n: schemes.length + 1 }), project: C().emptyProject(), types: [...types] };
    schemes.push(e);
    switchScheme(e.id);
    const res = buildFromMtr({ stations: data.stations, routes }, types, project, { alignTol: ui.alignTol, compress: ui.compress, minGap: ui.minGap });
    project = res.project;
    e.project = project;
    sel = null; group = null;
    renderTypes();
    changed();
    scheduleSave();
    const btn = document.getElementById("boardModeSchemeBtn");
    if (btn) btn.click(); else setMode("scheme");
    setTimeout(() => { fitView(); if (typeof updateNextPageTitle === "function") updateNextPageTitle(); }, 120);
    return true;
  }
  function duplicateScheme() {
    syncActive();
    const cur = activeScheme();
    const copy = { id: uid(), name: cur.name + " (2)", project: C().normalize(JSON.parse(JSON.stringify(cur.project))), types: cur.types ? [...cur.types] : null };
    schemes.push(copy);
    switchScheme(copy.id);
    scheduleSave();
  }
  function renameScheme() {
    const cur = activeScheme();
    askText(tt("schemeAskRenameScheme"), cur.name, (name) => {
      if (name.trim()) { cur.name = name.trim(); refreshSchemeSelect(); scheduleSave(); }
    });
  }
  function deleteScheme() {
    if (schemes.length < 2) return;
    if (!confirm(tt("schemeDeleteConfirm", { name: activeScheme().name }))) return;
    const i = schemes.findIndex((s) => s.id === activeId);
    schemes.splice(i, 1);
    const next = schemes[Math.max(0, i - 1)];
    activeId = null;
    activeId = next.id;
    project = next.project;
    ui.types = next.types || null;
    undoStack = []; redoStack = [];
    clearSelection();
    refreshSchemeSelect();
    if (schemeData) renderTypes();
    changed();
    scheduleSave();
  }

  // ------------------------------------------------------------
  // Вставка в «Табло»
  // ------------------------------------------------------------
  async function sendToBoard() {
    if (!window.BoardEditor || typeof window.BoardEditor.insertImageDataUrl !== "function") return;
    if (!project.stations.length && !project.lines.length) { setStatus(tt("schemePublishEmpty")); return; }
    try {
      const blob = await C().toPngBlob(project, 2);
      const url = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => reject(r.error);
        r.readAsDataURL(blob);
      });
      setMode("timetable");
      scheduleSave();
      // холст табло живёт в соседнем режиме — даём ему показаться
      setTimeout(() => {
        const ok = window.BoardEditor.insertImageDataUrl(url);
        setStatus(tt(ok ? "schemeToBoardDone" : "schemeToBoardFail"));
      }, 50);
    } catch (e) {
      setStatus(tt("schemeExportError") + ": " + e.message);
    }
  }

  function setMode(mode) {
    ui.mode = mode === "scheme" ? "scheme" : "timetable";
    const scheme = ui.mode === "scheme";
    el.timetable.style.display = scheme ? "none" : "";
    el.scheme.style.display = scheme ? "" : "none";
    el.btnTimetable.classList.toggle("active", !scheme);
    el.btnScheme.classList.toggle("active", scheme);
    if (scheme) {
      // SVG скрыт до показа режима — размеры известны только после кадра
      requestAnimationFrame(() => { render(); renderProps(); });
      if (!schemeData) loadSchemeData().then(renderTypes).catch((e) => setStatus(e.message));
      if (ui.live) refreshLive();
    }
  }

  function onKey(e) {
    if (!visible()) return;
    const tag = (e.target && e.target.tagName) || "";
    if (/INPUT|TEXTAREA|SELECT/.test(tag)) {
      // Esc в поле правой панели: снять фокус и дальше — снять выделение
      if (e.key === "Escape" && el.props && el.props.contains(e.target)) e.target.blur();
      else return;
    }
    // Горячие клавиши по физической клавише (e.code): с русской раскладкой e.key = «я», «н»…
    const code = e.code || "";
    let k = e.key.toLowerCase();
    if (/^Key[A-Z]$/.test(code)) k = code.slice(3).toLowerCase();
    else if (code === "Delete") k = "delete";
    if (e.code === "Space") { spaceDown = true; e.preventDefault(); return; }
    if ((e.ctrlKey || e.metaKey) && k === "z" && !e.shiftKey) { e.preventDefault(); undo(); return; }
    if ((e.ctrlKey || e.metaKey) && (k === "y" || (k === "z" && e.shiftKey))) { e.preventDefault(); redo(); return; }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === "KeyC") { e.preventDefault(); copyStyle(); return; }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === "KeyV") { e.preventDefault(); pasteStyle(); return; }
    if ((e.ctrlKey || e.metaKey) && e.code === "KeyA") {
      e.preventDefault();
      group = { stations: new Set(project.stations.map((s) => s.id)), nodes: new Set(), shapes: new Set(project.shapes.map((s) => s.id)) };
      sel = { kind: "group" };
      renderOverlay(); renderProps();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (k === "delete" || k === "backspace") { e.preventDefault(); deleteSelection(); return; }
    if (k === "f2") { e.preventDefault(); renameSelection(); return; }
    if (k === "escape") {
      if (drawing) { drawing = null; renderOverlay(); return; }
      clearSelection(); transferFirst = null; setTool("select"); renderOverlay(); renderProps(); return;
    }
    if (k === "enter" && drawing) { finishLine(); return; }
    const tools = { v: "select", l: "line", s: "station", t: "transfer", r: "rect", o: "ellipse", d: "shapeline", a: "text", i: "icon" };
    if (tools[k]) setTool(tools[k]);
  }

  function onKeyUp(e) { if (e.code === "Space") spaceDown = false; }

  function init() {
    if (initialized) return;
    const $ = (id) => document.getElementById(id);
    el.timetable = $("boardModeTimetable");
    el.scheme = $("boardModeScheme");
    el.btnTimetable = $("boardModeTimetableBtn");
    el.btnScheme = $("boardModeSchemeBtn");
    el.svg = $("schemeSvg");
    el.props = $("schemeProps");
    el.status = $("schemeStatus");
    el.toolHint = $("schemeToolHint");
    el.typesBtn = $("schemeTypesBtn");
    el.typesPanel = $("schemeTypesPanel");
    el.typesCount = $("schemeTypesCount");
    el.liveToggle = $("schemeLiveToggle");
    el.zoomLabel = $("schemeZoomLabel");
    el.publishOverlay = $("schemePublishOverlay");
    el.shareStatus = $("schemeShareStatus");
    el.schemeSelect = $("schemeSelect");
    el.schemeDelBtn = $("schemeDelBtn");
    if (!el.scheme || !el.svg || !window.SchemeCore) return;
    initialized = true;
    if (!project) project = C().emptyProject();
    ensureSchemes();
    el.canvasBox = el.svg.parentElement;

    // Слои SVG: сетка → схема → оверлей редактора
    const mk = C().el;
    const defs = mk("defs", null, el.svg);
    el.gridPattern = mk("pattern", { id: "schemeGridPattern", patternUnits: "userSpaceOnUse", width: 24, height: 24 }, defs);
    el.gridDot = mk("circle", { cx: 0.5, cy: 0.5, r: 1, fill: "#cbd5e1" }, el.gridPattern);
    el.world = mk("g", null, el.svg);
    el.gridRect = mk("rect", { fill: "url(#schemeGridPattern)", "pointer-events": "none" }, el.world);
    el.scene = mk("g", null, el.world);
    el.overlay = mk("g", { class: "sc-overlay" }, el.world);

    el.svg.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    el.svg.addEventListener("wheel", onWheel, { passive: false });
    el.svg.addEventListener("dblclick", onDblClick);
    el.svg.addEventListener("mouseleave", () => { hoverPt = null; renderOverlay(); });
    document.addEventListener("keydown", onKey);
    document.addEventListener("keyup", onKeyUp);
    el.svg.addEventListener("contextmenu", (e) => e.preventDefault());
    window.addEventListener("resize", () => { if (visible()) applyView(); });

    el.toolBtns = Array.from(document.querySelectorAll("#schemeTools [data-tool]"));
    el.toolBtns.forEach((b) => b.addEventListener("click", () => setTool(b.dataset.tool)));
    el.btnTimetable.addEventListener("click", () => { setMode("timetable"); scheduleSave(); });
    el.btnScheme.addEventListener("click", () => { setMode("scheme"); scheduleSave(); });
    el.typesBtn.addEventListener("click", (e) => { e.stopPropagation(); el.typesPanel.classList.toggle("open"); });
    document.addEventListener("click", (e) => {
      if (!el.typesPanel.contains(e.target) && !el.typesBtn.contains(e.target)) el.typesPanel.classList.remove("open");
    });
    $("schemeGenerateBtn").addEventListener("click", generate);
    $("schemeFitBtn").addEventListener("click", fitView);
    $("schemeZoomIn").addEventListener("click", () => zoomBy(1.25));
    $("schemeZoomOut").addEventListener("click", () => zoomBy(0.8));
    $("schemeUndoBtn").addEventListener("click", undo);
    $("schemeRedoBtn").addEventListener("click", redo);
    $("schemeExportPngBtn").addEventListener("click", exportPng);
    $("schemeExportSvgBtn").addEventListener("click", exportSvg);
    $("schemePublishBtn").addEventListener("click", openPublish);
    $("schemeResetBtn").addEventListener("click", resetScheme);
    el.liveToggle.addEventListener("change", () => { setLive(el.liveToggle.checked); scheduleSave(); });
    el.alignTol = $("schemeAlignTol");
    el.alignTol.value = String(ui.alignTol);
    el.alignTol.addEventListener("change", () => { ui.alignTol = Number(el.alignTol.value) || 0; scheduleSave(); });
    refreshSchemeSelect();
    el.schemeSelect.addEventListener("change", () => switchScheme(el.schemeSelect.value));
    $("schemeNewBtn").addEventListener("click", newScheme);
    $("schemeRenameBtn").addEventListener("click", renameScheme);
    $("schemeDupBtn").addEventListener("click", duplicateScheme);
    el.schemeDelBtn.addEventListener("click", deleteScheme);
    el.compress = $("schemeCompress");
    el.compress.value = String(ui.compress);
    el.compress.addEventListener("change", () => { ui.compress = Number(el.compress.value) || 0; scheduleSave(); });
    el.minGap = $("schemeMinGap");
    el.minGap.value = String(ui.minGap);
    el.minGap.addEventListener("change", () => { ui.minGap = Number(el.minGap.value) || 0; scheduleSave(); });
    $("schemeToBoardBtn").addEventListener("click", sendToBoard);
    $("schemePublishClose").addEventListener("click", closePublish);
    el.publishOverlay.addEventListener("click", (e) => { if (e.target === el.publishOverlay) closePublish(); });
    $("schemeHtmlSave").addEventListener("click", saveHtml);
    $("schemeBrowserOpen").addEventListener("click", openInBrowser);

    setTool("select");
    setMode(ui.mode);
    if (ui.live) setLive(true);
  }

  function onLanguageChange() {
    if (!initialized) return;
    if (schemeData) renderTypes();
    el.toolHint.textContent = tt("schemeToolHint_" + tool);
    renderProps();
  }

  function getPersistedState() {
    ensureSchemes();
    syncActive();
    return {
      project,
      ui: { mode: ui.mode, types: ui.types, live: ui.live, alignTol: ui.alignTol, compress: ui.compress, minGap: ui.minGap, customIcons: ui.customIcons },
      schemes: schemes.map((e) => ({ id: e.id, name: e.name, project: e.project, types: e.types })),
      activeId,
    };
  }

  function applyPersistedState(s) {
    if (!s) return;
    const valid = (p) => p && typeof p === "object" && p.v === 1;
    if (Array.isArray(s.schemes) && s.schemes.some((e) => e && valid(e.project))) {
      schemes = s.schemes.filter((e) => e && valid(e.project)).map((e) => ({
        id: String(e.id || uid()).slice(0, 40), name: String(e.name || "").slice(0, 80) || tt("schemeDefaultName", { n: 1 }),
        project: window.SchemeCore.normalize(e.project), types: Array.isArray(e.types) ? e.types : null,
      }));
      activeId = schemes.some((e) => e.id === s.activeId) ? s.activeId : schemes[0].id;
      project = activeScheme().project;
    } else if (valid(s.project)) {
      // проект без версии формата не загружаем
      project = window.SchemeCore.normalize(s.project);
      schemes = [];
    }
    if (s.ui && typeof s.ui === "object") {
      if (s.ui.mode) ui.mode = s.ui.mode;
      if (Array.isArray(s.ui.types)) ui.types = s.ui.types;
      ui.live = !!s.ui.live;
      if ([0, 10, 15, 20].includes(s.ui.alignTol)) ui.alignTol = s.ui.alignTol;
      if ([0, 3, 5, 8].includes(s.ui.compress)) ui.compress = s.ui.compress;
      if (MIN_GAPS.includes(s.ui.minGap)) ui.minGap = s.ui.minGap;
      if (Array.isArray(s.ui.customIcons)) {
        ui.customIcons = s.ui.customIcons.slice(0, ICON_LIB_MAX).map((it) => ({
          id: String((it && it.id) || uid()).slice(0, 40), name: String((it && it.name) || "icon").slice(0, 40),
          img: window.SchemeCore.normalizeShape({ type: "icon", img: it && it.img }).img,
        })).filter((it) => it.img);
      }
    }
    ensureSchemes();
    // типы маршрутов — свойство схемы: у активной они перекрывают общие
    const act = activeScheme();
    if (act.types) ui.types = act.types; else act.types = ui.types;
    if (el.alignTol) el.alignTol.value = String(ui.alignTol);
    if (el.compress) el.compress.value = String(ui.compress);
    if (el.minGap) el.minGap.value = String(ui.minGap);
    if (initialized) {
      undoStack = []; redoStack = []; clearSelection();
      refreshSchemeSelect();
      if (schemeData) renderTypes();
      setMode(ui.mode); setLive(ui.live);
    }
  }

  return { init, getPersistedState, applyPersistedState, onLanguageChange, buildFromMtr, createStationScheme };
})();

window.NetworkScheme = NetworkScheme;
