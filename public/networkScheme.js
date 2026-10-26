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
  const SAVE_DELAY = 1500;
  const HISTORY_LIMIT = 60;
  const LIVE_REFRESH_MS = 90000;
  const PALETTE = ["#e11d48", "#2563eb", "#16a34a", "#f59e0b", "#9333ea", "#0891b2", "#ea580c", "#4b5563"];
  // Страница просмотра опубликованных схем (GitHub Pages репозитория,
  // публикуется из корня ветки main — public/map.html)
  const PUBLISH_BASE = "https://kk-prod-dev.github.io/MTR-Schedule-manager/public/map.html";

  const C = () => window.SchemeCore;
  let project = null;
  // alignTol — допуск выравнивания перегонов при построении, градусы (0 = выкл)
  let ui = { mode: "timetable", types: null, live: false, alignTol: 15 };
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

  const pkey = (p) => p.x + "," + p.y;

  function placeFree(raw, grid, occ) {
    const sn = (v) => Math.round(v / grid) * grid;
    const base = { x: sn(raw.x), y: sn(raw.y) };
    if (!occ.has(pkey(base))) return base;
    for (let r = 1; r <= 12; r++) {
      let best = null, bestD = Infinity;
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const c = { x: base.x + dx * grid, y: base.y + dy * grid };
          if (occ.has(pkey(c))) continue;
          const d = Math.hypot(c.x - raw.x, c.y - raw.y);
          if (d < bestD) { bestD = d; best = c; }
        }
      }
      if (best) return best;
    }
    return base;
  }

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
          const score = (c) => (occ.has(pkey(c)) ? 10 : 0) + (prevDir && dirOf(a, c) !== prevDir ? 1 : 0);
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
            if (occ.has(pkey(c))) continue;
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
   * Полосы в пучках: на КАЖДОМ перегоне линии, идущие по нему, собираются
   * по центру (без пустых полос), а порядок выбирается так, чтобы линии не
   * перекрещивались: для пары линий идём назад (потом вперёд) по общему
   * пути до точки расхождения — та, что уходит левее, идёт левой полосой.
   * Полоса > 0 = слева от направления полилинии.
   */
  function assignLanes(lines, pos) {
    const hops = new Map(); // hopKey -> { a, b, entries: [{ line, seq, idx }] }
    lines.forEach((line, order) => {
      const ids = line.mtrStationIds.filter((id, i, arr) => i === 0 || id !== arr[i - 1]);
      line._hopLanes = [];
      for (let i = 0; i + 1 < ids.length; i++) {
        const a = ids[i], b = ids[i + 1];
        const k = hopKey(a, b);
        if (!hops.has(k)) hops.set(k, { a: a < b ? a : b, b: a < b ? b : a, entries: [] });
        const h = hops.get(k);
        // последовательность в ориентации перегона a→b
        const fwd = ids[i] === h.a;
        const seq = fwd ? ids : [...ids].reverse();
        const idx = fwd ? i : ids.length - 2 - i;
        // и в обратной ориентации (для сравнения в системе хода другой линии)
        const seqR = fwd ? [...ids].reverse() : ids;
        const idxR = seq.length - 2 - idx;
        h.entries.push({ line, order, seq, idx, seqR, idxR, dir: fwd ? 1 : -1, hopIdx: i });
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
    for (const h of hops.values()) {
      const list = h.entries.slice().sort(cmp);
      const n = list.length;
      list.forEach((e, k) => { e.line._hopLanes[e.hopIdx] = ((n - 1) / 2 - k) * e.dir; });
    }
    // полосы перегонов → полосы отрезков полилинии (между станциями бывают изломы)
    for (const line of lines) {
      const ids = line.mtrStationIds.filter((id, i, arr) => i === 0 || id !== arr[i - 1]);
      const lanes = [];
      let h = 0;
      for (let i = 0; i + 1 < line.points.length; i++) {
        lanes.push(line._hopLanes[Math.min(h, line._hopLanes.length - 1)] || 0);
        const q = line.points[i + 1], next = P(ids[h + 1]);
        if (next && q.x === next.x && q.y === next.y) h++;
      }
      line.lanes = lanes;
      delete line._hopLanes;
    }
  }

  function buildFromMtr(data, types, prevIn, opts) {
    opts = opts || {};
    const prev = C().normalize(prevIn);
    const grid = prev.grid;
    const stById = new Map(data.stations.map((s) => [s.id, s]));
    const groups = groupRoutes(data.routes, types);

    const prevLines = prev.lines;
    const prevStations = new Map(prev.stations.filter((s) => isMtr(s.id, P_ST)).map((s) => [s.mtrStationId, s]));
    const prevTransfers = new Map(prev.transfers.filter((t) => isMtr(t.id, P_TR)).map((t) => [t.id, t]));
    const hadMtr = prevLines.some((l) => isMtr(l.id, P_LINE));
    const meta = prev.mtrMeta && prev.mtrMeta.grid === grid ? prev.mtrMeta : computeMeta(groups, stById, grid);

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
    for (const id of stLines.keys()) {
      const s = stById.get(id);
      raw.set(id, pos.has(id) ? { ...pos.get(id) } : { x: (s.x - meta.cx) * meta.scale, y: (s.z - meta.cz) * meta.scale });
    }
    const hopSeen = new Set(), allHops = [];
    for (const g of groups) {
      for (const [a, b] of hopsOf(g.main.stationIds.filter((s) => stById.has(s)))) {
        const k = hopKey(a, b);
        if (!hopSeen.has(k)) { hopSeen.add(k); allHops.push([a, b]); }
      }
    }
    const alignable = straighten(raw, allHops, new Set(pos.keys()), opts.alignTol);
    for (const id of fresh) {
      const p = placeFree(raw.get(id), grid, occ);
      pos.set(id, p);
      occ.add(pkey(p));
    }
    const freshSet = new Set(fresh);
    gridAlign(pos, allHops, alignable, freshSet, occ, grid);

    const elbows = new Map();
    const usedPrev = new Set();
    const lines = groups.map((g) => {
      const id = lineIdOf(g);
      const old = prevLines.find((l) => l.id === id)
        || prevLines.find((l) => isMtr(l.id, P_LINE) && !usedPrev.has(l) && (l.mtrRouteIds || []).some((r) => g.routeIds.includes(r)));
      if (old) usedPrev.add(old);
      const ids = g.main.stationIds.filter((s) => stById.has(s));
      const nm = splitName(g.main.name);
      const sameRoute = old && JSON.stringify(old.mtrStationIds) === JSON.stringify(ids)
        && !ids.some((s) => freshSet.has(s)) && old.points.length >= 2;
      const line = Object.assign(
        { name: nm.name, number: g.main.number || "", color: g.main.color, width: null, dash: /_bus$/.test(g.main.type) ? "dashed" : "solid", offset: 0 },
        old || {},
        { id, mtrRouteIds: g.routeIds, mtrStationIds: ids, mtrType: g.main.type, points: sameRoute ? old.points : buildPath(ids, pos, occ, elbows) });
      // проекты до полос по перегонам хранили авто-сдвиг в offset — сбрасываем
      if (old && !old.lanes) line.offset = 0;
      return line;
    });
    assignLanes(lines, pos);
    const lineIds = new Set(lines.map((l) => l.id));
    const userLines = prevLines.filter((l) => !isMtr(l.id, P_LINE));

    const stations = [];
    for (const [id, lset] of stLines) {
      const s = stById.get(id);
      const nm = splitName(s.name);
      const old = prevStations.get(id);
      const myLines = [...lset];
      if (old) {
        const keepUser = old.lineIds.filter((l) => !isMtr(l, P_LINE));
        const st = Object.assign({}, old, { lineIds: [...myLines, ...keepUser], mtrName: s.name });
        // переименование в MTR доходит до схемы, если имя не правили вручную
        const oldNm = splitName(old.mtrName);
        if (old.name === oldNm.name) st.name = nm.name;
        if ((old.sub || "") === oldNm.sub) st.sub = nm.sub;
        stations.push(st);
      } else {
        const p = pos.get(id);
        stations.push({
          id: P_ST + id, mtrStationId: id, mtrName: s.name, name: nm.name, sub: nm.sub,
          x: p.x, y: p.y, style: "auto", label: { pos: "auto", angle: 0 }, lineIds: myLines,
        });
      }
    }
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
    sel = null;
    changed();
  }
  function redo() {
    if (!redoStack.length) return;
    undoStack.push(JSON.stringify(project));
    project = C().normalize(JSON.parse(redoStack.pop()));
    sel = null;
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
    C().render(el.scene, project, { live: ui.live ? liveData : null });
    applyView();
    renderOverlay();
  }

  function renderOverlay() {
    const g = el.overlay;
    while (g.firstChild) g.removeChild(g.firstChild);
    const mk = C().el;
    const z = project.view.zoom;
    if (sel && sel.kind === "station") {
      const st = project.stations.find((s) => s.id === sel.id);
      if (st) mk("circle", { cx: st.x, cy: st.y, r: project.style.lineWidth * 2.2, class: "sc-sel-ring" }, g);
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
        const active = sel && sel.kind === "node" && sel.x === n.x && sel.y === n.y;
        mk("rect", {
          x: n.x - s / 2, y: n.y - s / 2, width: s, height: s, rx: 1.5 / z,
          class: "sc-handle" + (active ? " active" : ""),
          "data-kind": "node", "data-x": n.x, "data-y": n.y, "stroke-width": 1.5 / z,
        }, g);
      }
    }
    if (sel && sel.kind === "transfer") {
      const tr = project.transfers.find((x) => x.id === sel.id);
      if (tr) tr.stationIds.forEach((id) => {
        const st = project.stations.find((s) => s.id === id);
        if (st) mk("circle", { cx: st.x, cy: st.y, r: project.style.lineWidth * 2.2, class: "sc-sel-ring" }, g);
      });
    }
    if (transferFirst) {
      const st = project.stations.find((s) => s.id === transferFirst);
      if (st) mk("circle", { cx: st.x, cy: st.y, r: project.style.lineWidth * 2.2, class: "sc-sel-ring pending" }, g);
    }
    if (drawing && drawing.points.length) {
      const pts = hoverPt ? [...drawing.points, hoverPt] : drawing.points;
      mk("polyline", {
        points: pts.map((p) => `${p.x},${p.y}`).join(" "), class: "sc-draw-preview",
        "stroke-width": project.style.lineWidth, stroke: drawing.color,
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
      x: Number(node.getAttribute("data-x")), y: Number(node.getAttribute("data-y")),
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
  function onMouseDown(e) {
    if (e.button === 1 || (e.button === 0 && e.shiftKey && tool === "select" && !hitOf(e))) {
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

    // select
    if (!hit) { sel = null; renderOverlay(); renderProps(); startPan(e); return; }
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
    sel = { kind: hit.kind, id: hit.id };
    renderOverlay();
    renderProps();
    if (hit.kind === "station") startDrag(e, "station", hit.id);
    else if (hit.kind === "legend") startDrag(e, "legend", "legend");
  }

  function startPan(e) {
    drag = { type: "pan", sx: e.clientX, sy: e.clientY, vx: project.view.x, vy: project.view.y };
    el.svg.classList.add("panning");
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

  function startDrag(e, type, id) {
    const w = toWorld(e);
    let orig;
    if (type === "station") { const s = project.stations.find((x) => x.id === id); orig = { x: s.x, y: s.y }; }
    else if (type === "node") orig = { x: sel.x, y: sel.y };
    else if (type === "vertex") { const q = project.lines.find((l) => l.id === id).points[sel.vidx]; orig = { x: q.x, y: q.y }; }
    else orig = { x: project.legend.x, y: project.legend.y };
    drag = { type, id, start: w, orig, last: orig, snapshot: JSON.stringify(project), moved: false };
  }

  // Угол линий: все вершины всех линий в этой точке двигаются вместе
  function moveNode(from, to) {
    for (const l of project.lines) {
      l.points.forEach((p, i) => { if (p.x === from.x && p.y === from.y) l.points[i] = { x: to.x, y: to.y }; });
    }
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
      const raw = { x: drag.orig.x + (w.x - drag.start.x), y: drag.orig.y + (w.y - drag.start.y) };
      const np = drag.type === "legend" ? { x: Math.round(raw.x), y: Math.round(raw.y) } : { x: snap(raw.x), y: snap(raw.y) };
      if (np.x === drag.last.x && np.y === drag.last.y) return;
      if (!drag.moved) {
        undoStack.push(drag.snapshot);
        redoStack = [];
        drag.moved = true;
        if (drag.type === "station") anchorStation(project.stations.find((x) => x.id === drag.id));
      }
      if (drag.type === "station") moveStation(drag.id, drag.last, np);
      else if (drag.type === "node") { moveNode(drag.last, np); sel = { kind: "node", x: np.x, y: np.y }; }
      else if (drag.type === "vertex") { project.lines.find((l) => l.id === drag.id).points[sel.vidx] = np; }
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
    const wasMoved = drag.moved || drag.type === "pan";
    drag = null;
    el.svg.classList.remove("panning");
    if (wasMoved) { renderProps(); scheduleSave(); }
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

  function onDblClick(e) {
    const hit = hitOf(e);
    if (tool === "line") { finishLine(); return; }
    if (!hit || tool !== "select") return;
    if (hit.kind === "station") {
      const st = project.stations.find((s) => s.id === hit.id);
      if (st && st.mtrStationId) openStation(st.mtrStationId);
      return;
    }
    if (hit.kind === "line") insertVertex(hit.id, toWorld(e));
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
    if (!sel) return;
    pushHistory();
    if (sel.kind === "station") {
      project.stations = project.stations.filter((s) => s.id !== sel.id);
      project.transfers.forEach((t) => { t.stationIds = t.stationIds.filter((id) => id !== sel.id); });
      project.transfers = project.transfers.filter((t) => t.stationIds.length >= 2);
    } else if (sel.kind === "line" && sel.vidx != null) {
      // выбрана точка линии — удаляем точку, а не линию
      const l = project.lines.find((x) => x.id === sel.id);
      if (l && l.points.length > 2) removePoint(l, sel.vidx);
      sel = { kind: "line", id: sel.id };
      changed();
      return;
    } else if (sel.kind === "line") {
      project.lines = project.lines.filter((l) => l.id !== sel.id);
      project.stations.forEach((s) => { s.lineIds = s.lineIds.filter((id) => id !== sel.id); });
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

  function setTool(name) {
    if (tool === "line" && name !== "line") { drawing = null; }
    tool = name;
    transferFirst = null;
    hoverPt = null;
    el.toolBtns.forEach((b) => b.classList.toggle("active", b.dataset.tool === name));
    el.svg.dataset.tool = name;
    el.toolHint.textContent = tt("schemeToolHint_" + name);
    renderOverlay();
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

  function renderProps() {
    const box = el.props;
    if (!box) return;
    box.replaceChildren();
    const title = (key) => h("div", { class: "scheme-props-title", text: tt(key) });

    if (sel && sel.kind === "station") {
      const st = project.stations.find((s) => s.id === sel.id);
      if (!st) { sel = null; return renderProps(); }
      box.append(
        title("schemePropStation"),
        field("schemeFieldName", textInput(st.name, (v) => { st.name = v; })),
        field("schemeFieldSub", textInput(st.sub, (v) => { st.sub = v; })),
        field("schemeFieldStationStyle", selectInput(st.style, C().STATION_STYLES.map((s) => [s, tt("schemeStStyle_" + s)]), (v) => { st.style = v; })),
        field("schemeFieldLabelPos", selectInput(st.label.pos, C().LABEL_POS.map((s) => [s, tt("schemeLabelPos_" + s)]), (v) => { st.label.pos = v; })),
        field("schemeFieldLabelAngle", selectInput(st.label.angle, C().LABEL_ANGLES.map((a) => [a, a + "°"]), (v) => { st.label.angle = Number(v); })),
      );
      if (st.mtrStationId) box.append(button("schemeOpenSchedule", () => openStation(st.mtrStationId)));
      box.append(button("schemeDelete", deleteSelection, "secondary-btn danger"));
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
      const bump = (d) => () => { pushHistory(); line.offset = Math.max(-8, Math.min(8, line.offset + d)); offsetVal.textContent = String(line.offset); render(); scheduleSave(); };
      box.append(
        title("schemePropLine"),
        field("schemeFieldName", textInput(line.name, (v) => { line.name = v; })),
        field("schemeFieldNumber", textInput(line.number, (v) => { line.number = v; })),
        field("schemeFieldColor", colorInput(line.color, (v) => { line.color = v; })),
        field("schemeFieldWidth", numInput(line.width, 1, 30, (v) => { line.width = v === "" ? null : Math.max(1, Math.min(30, Number(v) || 1)); }, String(project.style.lineWidth))),
        field("schemeFieldDash", selectInput(line.dash, C().DASHES.map((d) => [d, tt("schemeDash_" + d)]), (v) => { line.dash = v; })),
        field("schemeFieldOffset", h("span", { class: "scheme-offset" }, [
          h("button", { type: "button", class: "icon-btn", text: "−", onclick: bump(-1) }), offsetVal,
          h("button", { type: "button", class: "icon-btn", text: "+", onclick: bump(1) }),
        ])),
        h("p", { class: "hint small", text: tt("schemeLineEditHint") }),
      );
      if (sel.vidx != null) box.append(button("schemeDeleteVertex", deleteSelection));
      if (line.mtrRouteIds && line.mtrRouteIds.length) box.append(button("schemeOpenRoute", () => openRoute(line.mtrRouteIds[0])));
      box.append(button("schemeDeleteLine", () => { sel = { kind: "line", id: line.id }; deleteSelection(); }, "secondary-btn danger"));
      return;
    }
    if (sel && sel.kind === "transfer") {
      const tr = project.transfers.find((x) => x.id === sel.id);
      if (!tr) { sel = null; return renderProps(); }
      box.append(title("schemePropTransfer"));
      tr.stationIds.forEach((id) => {
        const st = project.stations.find((s) => s.id === id);
        if (st) box.append(h("div", { class: "scheme-props-item", text: st.name || id }));
      });
      box.append(button("schemeDelete", deleteSelection, "secondary-btn danger"));
      return;
    }
    // Ничего не выбрано / легенда — общие настройки схемы
    box.append(
      title("schemePropScheme"),
      field("schemeFieldTitle", textInput(project.title, (v) => { project.title = v; })),
      field("schemeFieldLineWidth", numInput(project.style.lineWidth, 1, 30, (v) => { project.style.lineWidth = Math.max(1, Math.min(30, Number(v) || 6)); })),
      field("schemeFieldLabelSize", numInput(project.style.labelSize, 6, 48, (v) => { project.style.labelSize = Math.max(6, Math.min(48, Number(v) || 12)); })),
      field("schemeFieldBg", colorInput(project.style.bg, (v) => { project.style.bg = v; })),
      field("schemeFieldLabelColor", colorInput(project.style.labelColor, (v) => { project.style.labelColor = v; })),
      title("schemePropLegend"),
      field("schemeFieldShowLegend", checkInput(project.legend.show, (v) => { project.legend.show = v; })),
      field("schemeFieldLegendTitle", textInput(project.legend.title, (v) => { project.legend.title = v; })),
      h("p", { class: "hint small", text: tt("schemeStats", { lines: project.lines.length, stations: project.stations.length, transfers: project.transfers.length }) }),
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

  async function generate() {
    try {
      setStatus(tt("schemeGenerating"));
      const data = await loadSchemeData(true);
      renderTypes();
      const types = new Set(ui.types || []);
      if (!types.size) { setStatus(tt("schemeNoTypes")); return; }
      pushHistory();
      const res = buildFromMtr(data, types, project, { alignTol: ui.alignTol });
      project = res.project;
      sel = null;
      changed();
      if (!res.stats.hadMtr) fitView();
      setStatus(tt(res.stats.hadMtr ? "schemeUpdated" : "schemeGenerated", res.stats));
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
    sel = null;
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

  function publishUrl() {
    const packed = LZString.compressToEncodedURIComponent(JSON.stringify(C().toPublished(project)));
    return `${PUBLISH_BASE}#m=${packed}`;
  }
  function openPublish() {
    if (!project.stations.length && !project.lines.length) { setStatus(tt("schemePublishEmpty")); return; }
    const url = publishUrl();
    el.publishUrl.value = url;
    el.publishSize.textContent = tt("schemePublishSize", { kb: Math.ceil(url.length / 1024) });
    el.publishOverlay.style.display = "flex";
    el.publishUrl.focus();
    el.publishUrl.select();
  }
  function closePublish() { el.publishOverlay.style.display = "none"; }

  // ------------------------------------------------------------
  // Режимы вкладки и инициализация
  // ------------------------------------------------------------
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
    if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === "z" && !e.shiftKey) { e.preventDefault(); undo(); return; }
    if ((e.ctrlKey || e.metaKey) && (k === "y" || (k === "z" && e.shiftKey))) { e.preventDefault(); redo(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (k === "delete" || k === "backspace") { e.preventDefault(); deleteSelection(); return; }
    if (k === "escape") {
      if (drawing) { drawing = null; renderOverlay(); return; }
      sel = null; transferFirst = null; setTool("select"); renderProps(); return;
    }
    if (k === "enter" && drawing) { finishLine(); return; }
    const tools = { v: "select", l: "line", s: "station", t: "transfer" };
    if (tools[k]) setTool(tools[k]);
  }

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
    el.publishUrl = $("schemePublishUrl");
    el.publishSize = $("schemePublishSize");
    if (!el.scheme || !el.svg || !window.SchemeCore) return;
    initialized = true;
    if (!project) project = C().emptyProject();

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
    $("schemePublishClose").addEventListener("click", closePublish);
    el.publishOverlay.addEventListener("click", (e) => { if (e.target === el.publishOverlay) closePublish(); });
    $("schemePublishCopy").addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(el.publishUrl.value); setStatus(tt("schemePublishCopied")); }
      catch (e) { el.publishUrl.select(); document.execCommand("copy"); setStatus(tt("schemePublishCopied")); }
      closePublish();
    });
    // в Electron window.open уходит в системный браузер (setWindowOpenHandler)
    $("schemePublishOpen").addEventListener("click", () => window.open(el.publishUrl.value, "_blank"));
    $("schemePublishLocal").addEventListener("click", () => {
      window.open(el.publishUrl.value.replace(PUBLISH_BASE, location.origin + "/map.html"), "_blank");
    });

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
    return { project, ui: { mode: ui.mode, types: ui.types, live: ui.live, alignTol: ui.alignTol } };
  }

  function applyPersistedState(s) {
    if (!s) return;
    // проект без версии формата не загружаем
    if (s.project && typeof s.project === "object" && s.project.v === 1) project = window.SchemeCore.normalize(s.project);
    if (s.ui && typeof s.ui === "object") {
      if (s.ui.mode) ui.mode = s.ui.mode;
      if (Array.isArray(s.ui.types)) ui.types = s.ui.types;
      ui.live = !!s.ui.live;
      if ([0, 10, 15, 20].includes(s.ui.alignTol)) ui.alignTol = s.ui.alignTol;
    }
    if (el.alignTol) el.alignTol.value = String(ui.alignTol);
    if (initialized) { undoStack = []; redoStack = []; setMode(ui.mode); setLive(ui.live); }
  }

  return { init, getPersistedState, applyPersistedState, onLanguageChange, buildFromMtr };
})();

window.NetworkScheme = NetworkScheme;
