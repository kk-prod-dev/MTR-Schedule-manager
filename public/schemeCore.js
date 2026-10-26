// ============================================================
// SchemeCore — модель и отрисовка схемы сети
// ============================================================
// Общий код редактора схемы (networkScheme.js, вкладка «Редактор» →
// «Схема сети») и страницы просмотра опубликованной схемы (map.html).
// Без зависимостей от app.js: map.html открывается сам по себе на
// GitHub Pages, а в нём схема приходит из адреса ссылки — то есть от
// кого угодно. Поэтому:
//  - normalize() приводит любой вход к ожидаемой форме (числа, строки
//    ограниченной длины, цвета только #hex);
//  - отрисовка только через createElementNS/setAttribute/textContent,
//    никакого innerHTML с данными схемы.
//
// Модель (version 1):
//  { v, title, grid, view:{x,y,zoom},
//    style:{ lineWidth, labelSize, bg, labelColor },
//    lines:[{ id, name, number, color, width, dash, offset, points:[{x,y}],
//             mtrRouteIds?, mtrStationIds?, mtrType? }],
//    stations:[{ id, name, sub, x, y, style, label:{pos,angle}, lineIds,
//                mtrStationId?, mtrName? }],
//    transfers:[{ id, stationIds }],
//    legend:{ show, x, y, title },
//    mtrMeta? }
// offset линии — номер «дорожки» в пучке: смещение в пикселях =
// offset × (ширина + зазор) влево от НАПРАВЛЕНИЯ полилинии.

const SchemeCore = (function () {
  const VERSION = 1;
  const NS = "http://www.w3.org/2000/svg";
  const LANE_GAP = 1.5;   // значения по умолчанию; реальные — p.style.laneGap / cornerRadius
  const CORNER_R = 18;
  // предел номера полосы: в плотном пучке автобусов бывает 30+ линий, а
  // прежний ±8 сваливал крайние линии на одну полосу
  const MAX_LANE = 40;
  const FONT = '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  const DASHES = ["solid", "dashed", "dotted", "double"];
  const SHAPE_DASHES = ["solid", "dashed", "dotted"];
  const SHAPE_TYPES = ["rect", "ellipse", "line", "text"];
  const STATION_STYLES = ["auto", "tick", "circle", "pill", "square", "diamond"];
  const LABEL_POS = ["auto", "n", "ne", "e", "se", "s", "sw", "w", "nw"];
  const LABEL_ANGLES = [0, -45, 45, -90, 90];
  const DIRS = {
    n: [0, -1], ne: [1, -1], e: [1, 0], se: [1, 1],
    s: [0, 1], sw: [-1, 1], w: [-1, 0], nw: [-1, -1],
  };

  // ------------------------------------------------------------
  // Нормализация
  // ------------------------------------------------------------
  const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
  const str = (v, max) => (v == null ? "" : String(v)).slice(0, max || 160);
  const color = (v, d) => (typeof v === "string" && /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : d);
  const oneOf = (v, list, d) => (list.includes(v) ? v : d);
  const idList = (v) => (Array.isArray(v) ? v.map((x) => str(x, 80)).filter(Boolean) : []);
  const pt = (p) => (Array.isArray(p) ? { x: num(p[0], 0), y: num(p[1], 0) } : { x: num(p && p.x, 0), y: num(p && p.y, 0) });
  const clamp = (v, lo, hi, d) => Math.max(lo, Math.min(hi, num(v, d)));
  // цвет или "" (= по умолчанию)
  const colorOpt = (v) => (typeof v === "string" && /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : "");
  // цвет заливки/обводки фигуры: "none" = без заливки
  const colorNone = (v, d) => (v === "none" || v === "" ? "none" : color(v, d));

  function normalizeShape(s) {
    s = s && typeof s === "object" ? s : {};
    const type = oneOf(s.type, SHAPE_TYPES, "rect");
    const sh = {
      id: str(s.id, 80) || "sh-" + Math.random().toString(36).slice(2, 9),
      type,
      x: num(s.x, 0), y: num(s.y, 0),
      w: clamp(s.w, -20000, 20000, 100), h: clamp(s.h, -20000, 20000, 60),
      fill: colorNone(s.fill, type === "text" ? "#111827" : "#dbeafe"),
      stroke: colorNone(s.stroke, type === "line" ? "#111827" : "none"),
      strokeW: clamp(s.strokeW, 0, 60, 2),
      opacity: clamp(s.opacity, 0.05, 1, 1),
      dash: oneOf(s.dash, SHAPE_DASHES, "solid"),
      rx: clamp(s.rx, 0, 500, 0),
      rot: clamp(s.rot, -360, 360, 0),
      layer: oneOf(s.layer, ["back", "front"], "back"),
      text: str(s.text, 500),
      fontSize: clamp(s.fontSize, 6, 200, 16),
      bold: !!s.bold,
      align: oneOf(s.align, ["start", "middle", "end"], "start"),
    };
    if (type !== "line" && type !== "text") { sh.w = Math.max(2, Math.abs(sh.w)); sh.h = Math.max(2, Math.abs(sh.h)); }
    return sh;
  }

  function emptyProject() {
    return normalize({});
  }

  function normalize(src) {
    src = src && typeof src === "object" ? src : {};
    const style = src.style || {};
    const view = src.view || {};
    const legend = src.legend || {};
    const p = {
      v: VERSION,
      title: str(src.title, 120),
      grid: Math.max(8, Math.min(96, num(src.grid, 24))),
      view: { x: num(view.x, 300), y: num(view.y, 200), zoom: Math.max(0.03, Math.min(8, num(view.zoom, 1))) },
      style: {
        lineWidth: Math.max(1, Math.min(30, num(style.lineWidth, 6))),
        labelSize: Math.max(6, Math.min(48, num(style.labelSize, 12))),
        bg: color(style.bg, "#ffffff"),
        labelColor: color(style.labelColor, "#111827"),
        cornerRadius: clamp(style.cornerRadius, 0, 80, CORNER_R),
        laneGap: clamp(style.laneGap, 0, 12, LANE_GAP),
        stationScale: clamp(style.stationScale, 0.3, 4, 1),
        stationFill: color(style.stationFill, "#ffffff"),
        stationStroke: color(style.stationStroke, "#111827"),
        labelAuto: style.labelAuto !== false,
        transferScale: clamp(style.transferScale, 0.2, 4, 1),
      },
      shapes: (Array.isArray(src.shapes) ? src.shapes : []).slice(0, 3000).map(normalizeShape),
      lines: (Array.isArray(src.lines) ? src.lines : []).slice(0, 2000).map((l) => {
        const line = {
          id: str(l.id, 80) || "line-" + Math.random().toString(36).slice(2, 9),
          name: str(l.name),
          number: str(l.number, 24),
          color: color(l.color, "#6366f1"),
          width: l.width == null || l.width === "" ? null : Math.max(1, Math.min(30, num(l.width, 6))),
          dash: oneOf(l.dash, DASHES, "solid"),
          group: str(l.group, 40),
          hidden: !!l.hidden,
          offset: Math.max(-MAX_LANE, Math.min(MAX_LANE, Math.round(num(l.offset, 0)))),
          points: (Array.isArray(l.points) ? l.points : []).slice(0, 5000).map(pt),
        };
        // полосы по отрезкам (генератор): длина = points − 1, шаг 0.5
        if (Array.isArray(l.lanes) && l.lanes.length === line.points.length - 1) {
          line.lanes = l.lanes.map((v) => Math.max(-MAX_LANE, Math.min(MAX_LANE, Math.round(num(v, 0) * 2) / 2)));
        }
        if (l.mtrRouteIds) line.mtrRouteIds = idList(l.mtrRouteIds);
        if (l.mtrStationIds) line.mtrStationIds = idList(l.mtrStationIds);
        if (l.mtrPassIds) line.mtrPassIds = idList(l.mtrPassIds);
        if (l.mtrType) line.mtrType = str(l.mtrType, 40);
        return line;
      }),
      stations: (Array.isArray(src.stations) ? src.stations : []).slice(0, 10000).map((s) => {
        const label = s.label || {};
        const st = {
          id: str(s.id, 80) || "st-" + Math.random().toString(36).slice(2, 9),
          name: str(s.name),
          sub: str(s.sub),
          x: num(s.x, 0),
          y: num(s.y, 0),
          style: oneOf(s.style, STATION_STYLES, "auto"),
          label: { pos: oneOf(label.pos, LABEL_POS, "auto"), angle: oneOf(num(label.angle, 0), LABEL_ANGLES, 0) },
          lineIds: idList(s.lineIds),
          passLineIds: idList(s.passLineIds),
          fill: colorOpt(s.fill),
          stroke: colorOpt(s.stroke),
          strokeW: s.strokeW == null || s.strokeW === "" ? null : clamp(s.strokeW, 0, 20, 2),
          size: clamp(s.size, 0.3, 5, 1),
          labelSize: s.labelSize == null || s.labelSize === "" ? null : clamp(s.labelSize, 6, 48, 12),
          labelColor: colorOpt(s.labelColor),
        };
        if (s.mtrStationId) st.mtrStationId = str(s.mtrStationId, 80);
        if (s.mtrName != null) st.mtrName = str(s.mtrName);
        return st;
      }),
      transfers: (Array.isArray(src.transfers) ? src.transfers : []).slice(0, 5000)
        .map((t) => ({ id: str(t.id, 80) || "tr-" + Math.random().toString(36).slice(2, 9), stationIds: idList(t.stationIds) }))
        .filter((t) => t.stationIds.length >= 2),
      legend: {
        show: legend.show !== false,
        x: num(legend.x, 0),
        y: num(legend.y, 0),
        title: str(legend.title, 120),
      },
    };
    if (src.mtrMeta && typeof src.mtrMeta === "object") {
      p.mtrMeta = { scale: num(src.mtrMeta.scale, 1), cx: num(src.mtrMeta.cx, 0), cz: num(src.mtrMeta.cz, 0), grid: num(src.mtrMeta.grid, p.grid) };
      const cm = src.mtrMeta.cmp;
      const axis = (a) => (a && Array.isArray(a.xs) && Array.isArray(a.ys) && a.xs.length === a.ys.length && a.xs.length >= 2 && a.xs.length <= 5000
        ? { xs: a.xs.map((v) => num(v, 0)), ys: a.ys.map((v) => num(v, 0)) } : null);
      if (cm && axis(cm.x) && axis(cm.y)) p.mtrMeta.cmp = { x: axis(cm.x), y: axis(cm.y) };
    }
    return p;
  }

  // ------------------------------------------------------------
  // Публикация: компактная форма для ссылки (без служебных полей MTR)
  // ------------------------------------------------------------
  function toPublished(p) {
    p = visibleProject(p);
    const r = (v) => Math.round(v);
    return {
      v: VERSION,
      t: p.title,
      s: [p.style.lineWidth, p.style.labelSize, p.style.bg, p.style.labelColor, p.style.cornerRadius, p.style.laneGap,
        p.style.stationScale, p.style.stationFill, p.style.stationStroke, p.style.labelAuto ? 1 : 0, p.style.transferScale],
      l: p.lines.map((l) => [l.id, l.name, l.number, l.color, l.width, l.dash, l.offset, l.points.flatMap((q) => [r(q.x), r(q.y)]), l.lanes || null, l.group || ""]),
      st: p.stations.map((s) => [s.id, s.name, s.sub, r(s.x), r(s.y), s.style, s.label.pos, s.label.angle, s.lineIds,
        s.passLineIds, s.fill, s.stroke, s.strokeW, s.size, s.labelSize, s.labelColor]),
      sh: p.shapes.map((x) => [x.type, x.x, x.y, x.w, x.h, x.fill, x.stroke, x.strokeW, x.opacity, x.dash, x.rx, x.rot, x.layer, x.text, x.fontSize, x.bold ? 1 : 0, x.align]),
      tr: p.transfers.map((t) => t.stationIds),
      lg: [p.legend.show ? 1 : 0, r(p.legend.x), r(p.legend.y), p.legend.title],
    };
  }

  function fromPublished(c) {
    if (!c || typeof c !== "object" || c.v !== VERSION) throw new Error("unsupported map format");
    const arr = (v) => (Array.isArray(v) ? v : []);
    const s = arr(c.s);
    const lg = arr(c.lg);
    return normalize({
      title: c.t,
      style: {
        lineWidth: s[0], labelSize: s[1], bg: s[2], labelColor: s[3], cornerRadius: s[4], laneGap: s[5],
        stationScale: s[6], stationFill: s[7], stationStroke: s[8], labelAuto: s[9] !== 0, transferScale: s[10],
      },
      shapes: arr(c.sh).map((x, i) => {
        x = arr(x);
        return {
          id: "sh-" + i, type: x[0], x: x[1], y: x[2], w: x[3], h: x[4], fill: x[5], stroke: x[6], strokeW: x[7], opacity: x[8],
          dash: x[9], rx: x[10], rot: x[11], layer: x[12], text: x[13], fontSize: x[14], bold: x[15] === 1, align: x[16],
        };
      }),
      lines: arr(c.l).map((l) => {
        l = arr(l);
        const flat = arr(l[7]);
        const points = [];
        for (let i = 0; i + 1 < flat.length; i += 2) points.push({ x: flat[i], y: flat[i + 1] });
        return { id: l[0], name: l[1], number: l[2], color: l[3], width: l[4], dash: l[5], offset: l[6], points, lanes: l[8], group: l[9] };
      }),
      stations: arr(c.st).map((x) => {
        x = arr(x);
        return {
          id: x[0], name: x[1], sub: x[2], x: x[3], y: x[4], style: x[5], label: { pos: x[6], angle: x[7] }, lineIds: x[8],
          passLineIds: x[9], fill: x[10], stroke: x[11], strokeW: x[12], size: x[13], labelSize: x[14], labelColor: x[15],
        };
      }),
      transfers: arr(c.tr).map((ids, i) => ({ id: "tr-" + i, stationIds: ids })),
      legend: { show: lg[0] !== 0, x: lg[1], y: lg[2], title: lg[3] },
    });
  }

  // ------------------------------------------------------------
  // Геометрия
  // ------------------------------------------------------------
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
  const len = (v) => Math.hypot(v.x, v.y);
  const unit = (v) => { const l = len(v) || 1; return { x: v.x / l, y: v.y / l }; };
  const leftNormal = (d) => ({ x: d.y, y: -d.x }); // «влево» в экранных координатах (y вниз)

  const cross = (a, b) => a.x * b.y - a.y * b.x;

  /**
   * Смещённая полилиния с РАЗНЫМ смещением на каждом отрезке (offs[i] —
   * для отрезка i). Стык двух отрезков — пересечение их смещённых прямых;
   * на прямой со сменой полосы — короткий косой переход.
   *
   * Широкий пучок на коротком отрезке: с внутренней стороны поворота точка
   * стыка уходит ЗА конец смещённого отрезка, и он «выворачивается» —
   * линия шла вперёд, назад и снова вперёд, это и были петли на плотных
   * схемах. Такие отрезки выкидываются (соседи стыкуются напрямую), пока
   * вывернутых не останется.
   */
  function offsetPolylineVar(ptsIn, offsIn, R) {
    if (R == null) R = CORNER_R;
    // нулевые отрезки выкидываем вместе с их смещениями
    const pts = [], offs = [];
    ptsIn.forEach((p, i) => {
      if (pts.length && pts[pts.length - 1].x === p.x && pts[pts.length - 1].y === p.y) return;
      if (pts.length) offs.push(offsIn[i - 1] || 0);
      pts.push(p);
    });
    if (pts.length < 2) return pts.map((p) => ({ x: p.x, y: p.y }));
    const segs = [];
    for (let i = 0; i + 1 < pts.length; i++) {
      const dv = sub(pts[i + 1], pts[i]), d = unit(dv), nm = leftNormal(d), o = offs[i] || 0;
      // q — начало смещённой прямой, параметр t — расстояние вдоль d
      segs.push({ d, o, L: len(dv), a: pts[i], b: pts[i + 1], q: { x: pts[i].x + nm.x * o, y: pts[i].y + nm.y * o } });
    }
    const P = (s, t) => ({ x: s.q.x + s.d.x * t, y: s.q.y + s.d.y * t });
    // Стык отрезков s → u: t1 — где кончается s, t0 — где начинается u;
    // one = одна общая точка (пересечение), иначе две точки
    function join(s, u) {
      const c = cross(s.d, u.d), dot = s.d.x * u.d.x + s.d.y * u.d.y;
      if (Math.abs(c) < 1e-6) {
        if (dot > 0) {
          const gap = Math.abs(cross(sub(u.q, s.q), s.d));
          if (gap < 0.01) return { one: true, t1: (u.q.x - s.q.x) * s.d.x + (u.q.y - s.q.y) * s.d.y, t0: 0, c: 0 };
          // смена полосы на прямой — косой переход
          const tt = Math.min(gap, s.L / 2, u.L / 2);
          return { one: false, t1: s.L - tt, t0: tt };
        }
        return { one: false, t1: s.L, t0: 0 }; // разворот
      }
      const t1 = cross(sub(u.q, s.q), u.d) / c;
      const X = P(s, t1);
      const t0 = (X.x - u.q.x) * u.d.x + (X.y - u.q.y) * u.d.y;
      // слишком острый угол — срез вместо длинного «уса»
      const lim = 4 * Math.max(Math.abs(s.o), Math.abs(u.o)) + 1 + len(sub(s.b, u.a));
      if (len(sub(X, s.b)) > lim) return { one: false, t1: s.L, t0: 0 };
      return { one: true, t1, t0, c };
    }
    let keep = segs.slice(), joins = [];
    let startT = 0, endT = null;
    for (let guard = 0; guard <= segs.length; guard++) {
      joins = [];
      for (let k = 0; k + 1 < keep.length; k++) joins.push(join(keep[k], keep[k + 1]));
      if (keep.length < 2) break;
      let bad = -1;
      for (let k = 0; k < keep.length && bad < 0; k++) {
        const t0 = k ? joins[k - 1].t0 : startT;
        const t1 = k < keep.length - 1 ? joins[k].t1 : endT == null ? keep[k].L : endT;
        if (t1 < t0 - 0.01) bad = k;
      }
      if (bad < 0) break;
      // крайний отрезок: линия начинается/кончается сразу на соседнем
      if (bad === 0) startT = joins[0].t0;
      else if (bad === keep.length - 1) endT = joins[bad - 1].t1;
      keep.splice(bad, 1);
    }
    const first = keep[0], last = keep[keep.length - 1];
    const out = [P(first, startT)];
    // Радиус скругления в каждой вершине своей смещённой линии: полосы в
    // пучке идут по концентрическим дугам (снаружи поворота радиус больше,
    // внутри меньше на величину смещения), иначе соседние линии на углу
    // пересекаются и сплетаются в узлы
    const radii = [0];
    joins.forEach((jn, k) => {
      const s = keep[k], u = keep[k + 1];
      if (jn.one) {
        out.push(P(s, jn.t1));
        // c > 0 — поворот направо (y вниз): слева снаружи, справа внутри
        const base = Math.min(R, s.L / 2, u.L / 2);
        radii.push(jn.c ? Math.max(1, base + ((s.o + u.o) / 2) * Math.sign(jn.c)) : R);
      } else {
        out.push(P(s, jn.t1), P(u, jn.t0));
        radii.push(R, R);
      }
    });
    out.push(P(last, endT == null ? last.L : endT));
    radii.push(0);
    out.radii = radii;
    return out;
  }

  function roundedPath(pts, r) {
    if (pts.length < 2) return "";
    const f = (v) => Math.round(v * 100) / 100;
    let d = `M${f(pts[0].x)} ${f(pts[0].y)}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const a = pts[i - 1], v = pts[i], b = pts[i + 1];
      const la = len(sub(a, v)), lb = len(sub(b, v));
      const rr = Math.min(pts.radii ? pts.radii[i] : r, la / 2, lb / 2);
      if (rr < 0.5) { d += ` L${f(v.x)} ${f(v.y)}`; continue; }
      const ua = unit(sub(a, v)), ub = unit(sub(b, v));
      d += ` L${f(v.x + ua.x * rr)} ${f(v.y + ua.y * rr)} Q${f(v.x)} ${f(v.y)} ${f(v.x + ub.x * rr)} ${f(v.y + ub.y * rr)}`;
    }
    const last = pts[pts.length - 1];
    return d + ` L${f(last.x)} ${f(last.y)}`;
  }

  // Ближайшая точка полилинии и направление сегмента в ней
  function nearestOnPolyline(pts, p) {
    let best = null;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const ab = sub(b, a), l2 = ab.x * ab.x + ab.y * ab.y;
      if (!l2) continue;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / l2));
      const q = { x: a.x + ab.x * t, y: a.y + ab.y * t };
      const dist = len(sub(p, q));
      if (!best || dist < best.dist) best = { point: q, dir: unit(ab), dist, seg: i, t };
    }
    return best;
  }

  const lineWidthOf = (p, l) => l.width || p.style.lineWidth;
  // смещение отрезка i в пикселях: полоса генератора + ручной сдвиг линии
  const segOffset = (p, l, i) => (((l.lanes && l.lanes[i]) || 0) + (l.offset || 0)) * (lineWidthOf(p, l) + p.style.laneGap);
  const lineOffsets = (p, l) => l.points.slice(1).map((_, i) => segOffset(p, l, i));

  // Видимая позиция каждой вершины линии с учётом её полосы (там, где линия
  // реально нарисована в пучке) — для точек редактирования выделенной линии
  function vertexDisplayPoints(p, l) {
    const pts = l.points, n = pts.length - 1;
    if (n < 1) return pts.map((q) => ({ x: q.x, y: q.y }));
    const dirs = [], offs = [];
    for (let i = 0; i < n; i++) { dirs.push(unit(sub(pts[i + 1], pts[i]))); offs.push(segOffset(p, l, i)); }
    const at = (v, i) => { const m = leftNormal(dirs[i]); return { x: v.x + m.x * offs[i], y: v.y + m.y * offs[i] }; };
    return pts.map((v, j) => {
      if (j === 0) return at(v, 0);
      if (j === n) return at(v, n - 1);
      const A = at(v, j - 1), B = at(v, j);
      const c = cross(dirs[j - 1], dirs[j]);
      if (Math.abs(c) < 1e-6) return { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
      const s = cross(sub(B, A), dirs[j]) / c;
      const X = { x: A.x + dirs[j - 1].x * s, y: A.y + dirs[j - 1].y * s };
      return len(sub(X, v)) > 4 * Math.max(Math.abs(offs[j - 1]), Math.abs(offs[j])) + 1 ? { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 } : X;
    });
  }

  // ------------------------------------------------------------
  // Отрисовка
  // ------------------------------------------------------------
  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k of Object.keys(attrs)) if (attrs[k] != null) e.setAttribute(k, String(attrs[k]));
    if (parent) parent.appendChild(e);
    return e;
  }

  function textColorOn(bg) {
    const h = bg.replace("#", "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
    const n = parseInt(full, 16);
    const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    return lum > 0.6 ? "#111827" : "#ffffff";
  }

  function drawLinePath(g, p, line, pts, extraAttrs) {
    const w = lineWidthOf(p, line);
    const d = roundedPath(pts, p.style.cornerRadius);
    const base = { d, fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" };
    if (line.dash === "double") {
      el("path", Object.assign({}, base, { stroke: line.color, "stroke-width": w * 1.3 }, extraAttrs), g);
      el("path", Object.assign({}, base, { stroke: p.style.bg, "stroke-width": Math.max(1, w * 0.35) }), g);
      return;
    }
    const dash = line.dash === "dashed" ? `${w * 1.8} ${w * 1.2}` : line.dash === "dotted" ? `0.1 ${w * 1.6}` : null;
    el("path", Object.assign({}, base, { stroke: line.color, "stroke-width": w, "stroke-dasharray": dash }, extraAttrs), g);
  }

  const vertexAt = (pts, q) => pts.findIndex((v) => v.x === q.x && v.y === q.y);

  // Сдвиг от вершины-излома k к середине её скругления (roundedPath): линия
  // на углу идёт по дуге внутри угла, и значок станции должен стоять на ней
  function cornerShift(pts, k, R) {
    if (k <= 0 || k >= pts.length - 1) return { x: 0, y: 0 };
    const a = pts[k - 1], v = pts[k], b = pts[k + 1];
    const ua = unit(sub(a, v)), ub = unit(sub(b, v));
    if (Math.abs(cross(ua, ub)) < 1e-6) return { x: 0, y: 0 };
    const rr = Math.min(R, len(sub(a, v)) / 2, len(sub(b, v)) / 2);
    return { x: (ua.x + ub.x) * rr * 0.25, y: (ua.y + ub.y) * rr * 0.25 };
  }

  /**
   * Геометрия станции. c — точка значка (на дуге, если станция в изломе
   * основной линии); dir/nrm — направление основной линии и нормаль;
   * lanePts — центры полос ВСЕХ линий в станции (в изломе — с обоих
   * отрезков, с нормалью отрезка n), по ним строится пересадочный значок —
   * капсула на каждое направление; lo/hi — охват полос вдоль nrm.
   */
  function stationGeometry(p, st, linesById, drawn) {
    const here = { x: st.x, y: st.y };
    const items = [];
    for (const id of st.lineIds) {
      const line = linesById.get(id);
      if (!line || line.points.length < 2) continue;
      const near = nearestOnPolyline(line.points, here);
      if (!near || near.dist > p.grid * 0.75) continue;
      items.push({ line, near });
    }
    let c = { x: here.x, y: here.y };
    let dir = items.length ? items[0].near.dir : { x: 1, y: 0 };
    if (items.length) {
      const pts = items[0].line.points;
      const k = vertexAt(pts, here);
      if (k > 0 && k < pts.length - 1) {
        const sh = cornerShift(pts, k, p.style.cornerRadius);
        c = { x: here.x + sh.x, y: here.y + sh.y };
        const ua = unit(sub(pts[k], pts[k - 1])), ub = unit(sub(pts[k + 1], pts[k]));
        if (Math.abs(cross(ua, ub)) > 1e-6) dir = unit({ x: ua.x + ub.x, y: ua.y + ub.y });
      }
    }
    const nrm = leftNormal(dir);
    let maxW = p.style.lineWidth;
    const lanePts = [];
    for (const it of items) {
      const w = lineWidthOf(p, it.line);
      maxW = Math.max(maxW, w);
      const pts = it.line.points;
      const k = vertexAt(pts, here);
      const segs = k >= 0 ? [k - 1, k].filter((s) => s >= 0 && s < pts.length - 1) : [it.near.seg];
      const sh = cornerShift(pts, k, p.style.cornerRadius);
      const base = { x: here.x + sh.x, y: here.y + sh.y };
      it.pts = segs.map((s) => {
        const n = leftNormal(unit(sub(pts[s + 1], pts[s])));
        const o = segOffset(p, it.line, s);
        return { x: base.x + n.x * o, y: base.y + n.y * o, w, n };
      });
      lanePts.push(...it.pts);
      const q0 = it.pts[0] || base;
      it.pos = (q0.x - c.x) * nrm.x + (q0.y - c.y) * nrm.y;
    }
    if (!lanePts.length) lanePts.push({ x: c.x, y: c.y, w: maxW });
    let lo = Infinity, hi = -Infinity;
    for (const q of lanePts) {
      const t = (q.x - c.x) * nrm.x + (q.y - c.y) * nrm.y;
      lo = Math.min(lo, t - q.w / 2);
      hi = Math.max(hi, t + q.w / 2);
    }
    const ends = items.filter((it) => {
      const pts = it.line.points;
      const a = pts[0], b = pts[pts.length - 1];
      return (a.x === st.x && a.y === st.y) || (b.x === st.x && b.y === st.y);
    });
    return { c, items, dir, nrm, lo, hi, maxW, ends, inTransfer: drawn.transferStations.has(st.id) };
  }

  // Авто: любая станция — скруглённый прямоугольник поперёк пучка
  // (размер зависит только от числа линий с каждой стороны, см. pillMetrics)
  function resolveStyle(st) {
    return st.style !== "auto" ? st.style : "pill";
  }

  function labelDir(st, geo) {
    if (st.label.pos !== "auto") return DIRS[st.label.pos];
    // перпендикулярно линии, предпочитая верх/право
    let n = geo.nrm;
    if (n.y > 0.01 || (Math.abs(n.y) <= 0.01 && n.x < 0)) n = { x: -n.x, y: -n.y };
    return [Math.round(n.x), Math.round(n.y)];
  }

  // ------------------------------------------------------------
  // Значок станции
  // ------------------------------------------------------------
  const stScale = (p, st) => p.style.stationScale * (st.size || 1);

  /**
   * Размер значка-прямоугольника. Простая станция (все линии идут одинаково,
   * в том числе поворачивают вместе) — тонкая «палка» поперёк пучка: длина =
   * ширина пучка (число полос) + запас, толщина стандартная. Т-образная /
   * пересекающаяся — ширина по числу полос основного направления, высота по
   * числу полос примыкающих линий. Полосы считаются в системе самой линии
   * (смещение от оси), поэтому угол подхода размер не раздувает.
   */
  function pillMetrics(p, st, geo) {
    const c = geo.c, n = geo.nrm, k = stScale(p, st);
    const pts = geo.items.flatMap((it) => it.pts);
    if (!pts.length) pts.push({ x: c.x, y: c.y, w: geo.maxW, n });
    const canon = (m) => (m.x < -1e-6 || (Math.abs(m.x) <= 1e-6 && m.y < 0) ? { x: -m.x, y: -m.y } : m);
    const axisKey = (v) => { const m = canon(v); return Math.round(Math.atan2(m.y, m.x) * 8 / Math.PI); };
    const sig = (it) => [...new Set(it.pts.map((q) => axisKey(q.n || n)))].sort().join(",");
    const simple = geo.items.length && geo.items.every((it) => sig(it) === sig(geo.items[0]));
    const off = (q) => { const qn = q.n || n; return (q.x - c.x) * qn.x + (q.y - c.y) * qn.y; };
    const ext = (arr) => {
      let lo = Infinity, hi = -Infinity;
      for (const q of arr) { const o = off(q); lo = Math.min(lo, o - q.w / 2); hi = Math.max(hi, o + q.w / 2); }
      return { lo, hi };
    };
    let m = n, main = pts, others = [];
    if (!simple) {
      const groups = new Map();
      for (const q of pts) {
        const key = axisKey(q.n || n);
        if (!groups.has(key)) groups.set(key, { m: canon(q.n || n), pts: [] });
        groups.get(key).pts.push(q);
      }
      const sorted = [...groups.values()].sort((a, b) => b.pts.length - a.pts.length);
      m = sorted[0].m;
      main = sorted[0].pts;
      others = sorted.slice(1).flatMap((g) => g.pts);
    }
    const along = { x: -m.y, y: m.x };
    const mainE = ext(main);
    const pad = geo.maxW * 0.6 * k, thin = geo.maxW * 0.9 * k;
    const half = (mainE.hi - mainE.lo) / 2 + pad;
    let thick = thin, sMid = 0;
    if (others.length) {
      const oE = ext(others);
      thick = Math.max(thin, oE.hi - oE.lo + pad);
      const sp = others.map((q) => (q.x - c.x) * along.x + (q.y - c.y) * along.y);
      sMid = (Math.min(...sp) + Math.max(...sp)) / 2;
    }
    const tMid = (mainE.lo + mainE.hi) / 2;
    const mid = { x: c.x + m.x * tMid + along.x * sMid, y: c.y + m.y * tMid + along.y * sMid };
    const rx = Math.min(thick / 2, half, Math.max(geo.maxW * 0.45 * k, Math.min(thick, half * 2) * 0.28));
    return { mid, half, thick, rx, rot: Math.atan2(m.y, m.x) * 180 / Math.PI, reach: len(sub(mid, c)) + Math.max(half, thick / 2) };
  }

  /**
   * Габарит значка без рисования: повёрнутый прямоугольник (для подписей —
   * препятствие) и reach(u) — насколько значок выступает от c в сторону u.
   * Раньше отступ подписи был один на все стороны (по длинной стороне
   * значка), и у длинной «палки» поперёк пучка подпись сбоку улетала далеко.
   */
  function markerBox(p, st, geo, style) {
    const c = geo.c, n = geo.nrm, k = stScale(p, st);
    let box;
    if (style === "pill") {
      const pm = pillMetrics(p, st, geo);
      const a = pm.rot * Math.PI / 180;
      box = { cx: pm.mid.x, cy: pm.mid.y, ca: Math.cos(a), sa: Math.sin(a), hw: pm.half, hh: pm.thick / 2, rx: pm.rx };
    } else if (style === "circle" || style === "square" || style === "diamond") {
      const pos = geo.items[0] ? geo.items[0].pos : 0;
      const r = geo.maxW * 0.8 * k * (style === "circle" ? 1 : style === "square" ? 1.05 : 1.3);
      box = { cx: c.x + n.x * pos, cy: c.y + n.y * pos, ca: n.x, sa: n.y, hw: r, hh: r, rx: style === "circle" ? r : 0 };
    } else {
      const ext = Math.max(Math.abs(geo.lo), Math.abs(geo.hi)) + geo.maxW * 0.85 * k;
      box = { cx: c.x, cy: c.y, ca: n.x, sa: n.y, hw: ext, hh: geo.maxW * 0.4 * k };
    }
    const reach = (u) => (box.cx - c.x) * u.x + (box.cy - c.y) * u.y
      + box.hw * Math.abs(u.x * box.ca + u.y * box.sa) + box.hh * Math.abs(-u.x * box.sa + u.y * box.ca);
    return { box, reach, maxReach: len({ x: box.cx - c.x, y: box.cy - c.y }) + Math.hypot(box.hw, box.hh) };
  }

  function drawMarker(gMarks, p, st, geo, style, ld) {
    const c = geo.c;
    const n = geo.nrm;
    const k = stScale(p, st);
    const ang = Math.atan2(n.y, n.x) * 180 / Math.PI;
    const g = el("g", { "data-kind": "station", "data-id": st.id, class: "sc-station" }, gMarks);
    const primary = geo.items[0];
    const lineColor = primary ? primary.line.color : "#64748b";
    const fill = st.fill || p.style.stationFill;
    const stroke = st.stroke || p.style.stationStroke;
    const sw = st.strokeW != null ? st.strokeW : null;
    let reach = Math.max(Math.abs(geo.lo), Math.abs(geo.hi));

    if (style === "pill") {
      const pm = pillMetrics(p, st, geo);
      el("rect", {
        x: -pm.half, y: -pm.thick / 2, width: pm.half * 2, height: pm.thick, rx: pm.rx,
        fill, stroke, "stroke-width": sw != null ? sw : Math.max(1.1, geo.maxW * 0.2 * k),
        transform: `translate(${pm.mid.x} ${pm.mid.y}) rotate(${pm.rot})`,
      }, g);
      reach = pm.reach;
    } else if (style === "circle" || style === "square" || style === "diamond") {
      const pos = primary ? primary.pos : 0;
      const r = geo.maxW * 0.8 * k;
      const cx = c.x + n.x * pos, cy = c.y + n.y * pos;
      const common = { fill, stroke: st.stroke || lineColor, "stroke-width": sw != null ? sw : Math.max(1.1, geo.maxW * 0.38 * k) };
      if (style === "circle") el("circle", Object.assign({ cx, cy, r }, common), g);
      else {
        const side = r * (style === "square" ? 1.9 : 1.7);
        el("rect", Object.assign({
          x: -side / 2, y: -side / 2, width: side, height: side, rx: style === "square" ? side * 0.12 : 0,
          transform: `translate(${cx} ${cy}) rotate(${style === "diamond" ? ang + 45 : ang})`,
        }, common), g);
      }
      reach = Math.abs(pos) + r * (style === "circle" ? 1 : style === "square" ? 1.05 : 1.3);
    } else {
      // засечка наружу, в сторону подписи
      const side = ld[0] * n.x + ld[1] * n.y >= 0 ? 1 : -1;
      const from = side > 0 ? geo.hi : -geo.lo;
      const tick = geo.maxW * 0.85 * k;
      const th = sw != null ? Math.max(1, sw * 2) : geo.maxW * 0.8 * k;
      el("rect", {
        x: from - 0.5, y: -th / 2, width: tick + 0.5, height: th,
        fill: st.fill || lineColor,
        transform: `translate(${c.x} ${c.y}) rotate(${side > 0 ? ang : ang + 180})`,
      }, g);
      reach = from + tick;
    }
    // невидимая зона попадания для мыши
    el("circle", { cx: c.x, cy: c.y, r: Math.max(8, reach + 2), fill: "transparent" }, g);
    return reach;
  }

  // ------------------------------------------------------------
  // Подписи станций: геометрия, автоподбор положения
  // ------------------------------------------------------------
  const CAND_DIRS = ["e", "w", "n", "s", "ne", "se", "nw", "sw"];
  const CAND_TILT = [["ne", -45], ["sw", -45], ["se", 45], ["nw", 45]];

  // Ширина текста. В браузере — по-настоящему (canvas measureText тем же
  // шрифтом); прежняя оценка «0.58 × кегль на символ» занижала кириллицу
  // полужирным, и подписи, «не пересекающиеся» по расчёту, налезали.
  let measureCtx = null;
  const measureCache = new Map();
  function textW(s, size, weight) {
    if (!s) return 0;
    const key = weight + "|" + size + "|" + s;
    let w = measureCache.get(key);
    if (w != null) return w;
    if (measureCtx === null) {
      try { measureCtx = (typeof document !== "undefined" && document.createElement("canvas").getContext("2d")) || false; } catch (e) { measureCtx = false; }
    }
    if (measureCtx) { measureCtx.font = `${weight} ${size}px ${FONT}`; w = measureCtx.measureText(s).width; }
    else w = s.length * size * (weight >= 600 ? 0.62 : 0.55);
    if (measureCache.size > 20000) measureCache.clear();
    measureCache.set(key, w);
    return w;
  }

  // Раскладка подписи: якорь, наклон и габарит в виде повёрнутого
  // прямоугольника. reach(u) — вынос значка в сторону u, far — доп. отступ
  function labelLayout(p, st, geo, reach, ld, angle, far) {
    const size = st.labelSize || p.style.labelSize;
    const lines = [st.name, st.sub].filter(Boolean);
    const lh = size * 1.15;
    const dl = Math.hypot(ld[0], ld[1]) || 1;
    const u = { x: ld[0] / dl, y: ld[1] / dl };
    const gap = reach(u) + size * 0.3 + (far || 0);
    const c = geo.c;
    const ax = c.x + u.x * gap, ay = c.y + u.y * gap;
    const anchor = angle !== 0 ? (ld[0] < 0 ? "end" : "start") : ld[0] > 0 ? "start" : ld[0] < 0 ? "end" : "middle";
    const blockH = lh * (lines.length - 1);
    const baseY = ld[1] < 0 ? -blockH - size * 0.25 : ld[1] > 0 ? size * 0.8 : size * 0.35 - blockH / 2;
    const halo = Math.max(2, size * 0.25) / 2;
    const w = Math.max(textW(st.name, size, 600), textW(st.sub, size * 0.85, 400)) + halo * 2;
    const x0 = anchor === "start" ? -halo : anchor === "end" ? -w + halo : -w / 2;
    const y0 = baseY - size * 0.85, y1 = baseY + blockH + size * 0.25;
    const lcx = x0 + w / 2, lcy = (y0 + y1) / 2;
    const a = angle * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    return {
      ax, ay, anchor, baseY, angle, lines, size, lh,
      box: { cx: ax + lcx * ca - lcy * sa, cy: ay + lcx * sa + lcy * ca, ca, sa, hw: w / 2, hh: (y1 - y0) / 2 },
    };
  }

  function obbCorners(b) {
    const out = [];
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      out.push({ x: b.cx + sx * b.hw * b.ca - sy * b.hh * b.sa, y: b.cy + sx * b.hw * b.sa + sy * b.hh * b.ca });
    }
    return out;
  }
  function obbOverlap(a, b) {
    const axes = [{ x: a.ca, y: a.sa }, { x: -a.sa, y: a.ca }, { x: b.ca, y: b.sa }, { x: -b.sa, y: b.ca }];
    const ca = obbCorners(a), cb = obbCorners(b);
    for (const ax of axes) {
      let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
      for (const q of ca) { const d = q.x * ax.x + q.y * ax.y; if (d < a0) a0 = d; if (d > a1) a1 = d; }
      for (const q of cb) { const d = q.x * ax.x + q.y * ax.y; if (d < b0) b0 = d; if (d > b1) b1 = d; }
      if (a1 < b0 || b1 < a0) return false;
    }
    return true;
  }
  // круг (x,y,r) пересекает повёрнутый прямоугольник
  function obbHitsCircle(b, x, y, r) {
    const dx = x - b.cx, dy = y - b.cy;
    const lx = Math.abs(dx * b.ca + dy * b.sa), ly = Math.abs(-dx * b.sa + dy * b.ca);
    const ex = Math.max(0, lx - b.hw), ey = Math.max(0, ly - b.hh);
    return ex * ex + ey * ey <= r * r;
  }

  // Пространственный индекс прямоугольников (подписи, значки, номера
  // линий) и точек линий: ячейка — список объектов, попавших в неё габаритом
  const CELL = 48;
  function aabb(b) {
    const cs = obbCorners(b);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const q of cs) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
    return { x0, y0, x1, y1 };
  }
  class Hash {
    constructor() { this.m = new Map(); this.stamp = 0; }
    put(o, x0, y0, x1, y1) {
      for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++) {
        for (let cy = Math.floor(y0 / CELL); cy <= Math.floor(y1 / CELL); cy++) {
          const key = cx + "," + cy;
          let a = this.m.get(key);
          if (!a) this.m.set(key, (a = []));
          a.push(o);
        }
      }
    }
    addPoint(x, y, r, tag) { this.put({ x, y, r, tag }, x - r, y - r, x + r, y + r); }
    addBox(box, w, tag) { const o = { box, w, tag, dead: false }; const r = aabb(box); this.put(o, r.x0, r.y0, r.x1, r.y1); return o; }
    // каждый объект — один раз за запрос, даже если лежит в нескольких ячейках
    query(b, fn) {
      const r = aabb(b), s = ++this.stamp;
      for (let cx = Math.floor(r.x0 / CELL); cx <= Math.floor(r.x1 / CELL); cx++) {
        for (let cy = Math.floor(r.y0 / CELL); cy <= Math.floor(r.y1 / CELL); cy++) {
          const a = this.m.get(cx + "," + cy);
          if (a) for (const o of a) { if (o._s === s || o.dead) continue; o._s = s; fn(o); }
        }
      }
    }
  }

  // Штрафы раскладки подписей
  const W_LABEL = 1000, W_MARK = 700, W_BADGE = 500, W_LINE = 60, W_FAR = 30, W_TILT = 250;

  /**
   * Выбирает положение и наклон каждой подписи. Ручные (label.pos ≠ auto)
   * остаются как есть и служат препятствиями. Остальные — жадно, начиная с
   * самых «занятых» станций: 8 направлений вплотную и чуть дальше, затем
   * наклон ±45°; штраф — за наложение на подписи, значки станций, номера
   * линий и за каждую пересечённую ЛИНИЮ (не за каждую её точку: раньше
   * пучок из 6 линий «стоил» дороже чужой подписи, и подписи ложились друг
   * на друга). Затем второй проход для тех, кому досталось неудачное место.
   */
  function placeLabels(p, entries, offsetPts, badges) {
    const lines = new Hash(), boxes = new Hash();
    for (const line of p.lines) {
      const pts = offsetPts.get(line.id);
      if (!pts) continue;
      const r = lineWidthOf(p, line) / 2 + 1;
      const step = Math.max(3, r * 1.5);
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        const n = Math.max(1, Math.ceil(len(sub(b, a)) / step));
        for (let k = 0; k <= n; k++) lines.addPoint(a.x + ((b.x - a.x) * k) / n, a.y + ((b.y - a.y) * k) / n, r, line.id);
      }
    }
    for (const e of entries) boxes.addBox(e.mk.box, W_MARK, e.st.id);
    for (const b of badges) boxes.addBox(b.box, W_BADGE, "badge");
    const result = new Map(), placedObj = new Map(), costOf = new Map();
    const fixed = (e) => e.st.label.pos !== "auto";
    const dirs = (e) => (fixed(e) ? DIRS[e.st.label.pos] : labelDir(e.st, e.geo));
    const put = (e, lay) => { result.set(e.st.id, lay); placedObj.set(e.st.id, boxes.addBox(lay.box, W_LABEL, "L")); };
    for (const e of entries) {
      if (!(e.st.name || e.st.sub)) continue;
      if (fixed(e) || !p.style.labelAuto) put(e, labelLayout(p, e.st, e.geo, e.mk.reach, dirs(e), e.st.label.angle));
    }
    const cost = (e, box) => {
      let c = 0;
      boxes.query(box, (o) => {
        if (o.tag === e.st.id) return; // собственный значок
        if (obbOverlap(box, o.box)) c += o.w;
      });
      const hit = new Set();
      lines.query(box, (o) => { if (!hit.has(o.tag) && obbHitsCircle(box, o.x, o.y, o.r)) hit.add(o.tag); });
      return c + hit.size * W_LINE;
    };
    const choose = (e) => {
      const userAng = e.st.label.angle;
      const far = (st) => (st.labelSize || p.style.labelSize) * 0.9;
      const cands = [[dirs(e), userAng, 0, 0]];
      for (const d of CAND_DIRS) cands.push([DIRS[d], userAng, 0, 4]);
      for (const d of CAND_DIRS) cands.push([DIRS[d], userAng, far(e.st), W_FAR]);
      if (!userAng) for (const [d, a] of CAND_TILT) cands.push([DIRS[d], a, 0, W_TILT]);
      let best = null;
      for (const [ld, ang, f, pen] of cands) {
        if (best && pen >= best.cst) continue;
        const lay = labelLayout(p, e.st, e.geo, e.mk.reach, ld, ang, f);
        const cst = cost(e, lay.box) + pen;
        if (!best || cst < best.cst) best = { cst, lay };
        if (cst === 0) break;
      }
      return best;
    };
    const todo = entries.filter((e) => (e.st.name || e.st.sub) && !result.has(e.st.id))
      .sort((a, b) => b.geo.items.length - a.geo.items.length || (b.st.name || "").length - (a.st.name || "").length);
    for (const e of todo) {
      const best = choose(e);
      put(e, best.lay);
      costOf.set(e.st.id, best.cst);
    }
    // второй проход: теперь известны все соседи, в том числе размещённые позже
    for (const e of todo) {
      if (costOf.get(e.st.id) < W_LINE) continue;
      placedObj.get(e.st.id).dead = true;
      put(e, choose(e).lay);
    }
    return result;
  }

  function drawLabel(gLabels, p, st, lay) {
    const tg = el("g", {
      class: "sc-label", "data-kind": "station", "data-id": st.id,
      transform: `translate(${lay.ax} ${lay.ay})${lay.angle ? ` rotate(${lay.angle})` : ""}`,
    }, gLabels);
    lay.lines.forEach((txt, i) => {
      const isSub = i === 1;
      const t = el("text", {
        x: 0, y: lay.baseY + lay.lh * i,
        "text-anchor": lay.anchor,
        "font-size": isSub ? lay.size * 0.85 : lay.size,
        "font-weight": isSub ? 400 : 600,
        fill: isSub ? "#6b7280" : (st.labelColor || p.style.labelColor),
        stroke: p.style.bg, "stroke-width": Math.max(2, lay.size * 0.25), "paint-order": "stroke",
        "stroke-linejoin": "round",
      }, tg);
      t.textContent = txt;
    });
  }

  const badgeWidth = (label, size) => Math.max(size * 1.5, label.length * size * 0.62 + size * 0.8);

  /**
   * Номера линий у конечной: все линии, заканчивающиеся на станции, — одним
   * рядом за концом линии (одинаковые номер+цвет — один раз). Конец
   * горизонтальный — ряд продолжает линию наружу, вертикальный — ряд
   * поперёк, по центру под/над станцией. Только раскладка (для подписей
   * номера — препятствия), рисует drawBadge. Отступ — от габарита значка
   * в сторону выноса, иначе номера налезали на большой значок пересадки.
   */
  function layoutEndBadges(p, st, geo, mk) {
    const res = [];
    const size = p.style.labelSize * 0.85;
    const gap = size * 0.35;
    const seen = new Set();
    const list = [];
    let ox = 0, oy = 0;
    for (const it of geo.ends) {
      const pts = it.line.points;
      const atStart = pts[0].x === st.x && pts[0].y === st.y;
      const out = unit(sub(atStart ? pts[0] : pts[pts.length - 1], atStart ? pts[1] : pts[pts.length - 2]));
      ox += out.x; oy += out.y;
      const key = (it.line.number || "") + "|" + it.line.color;
      if (!it.line.number || seen.has(key)) continue;
      seen.add(key);
      list.push(it.line);
    }
    if (!list.length) return res;
    let out = unit({ x: ox, y: oy });
    if (!out.x && !out.y) out = geo.nrm;
    const h = size * 1.5;
    const ws = list.map((l) => badgeWidth(l.number, size));
    const c = geo.c;
    const reach = Math.max(mk.reach(out), geo.maxW) + size * 0.5;
    const add = (x, y, l, w) => res.push({ x, y, line: l, size, box: { cx: x, cy: y, ca: 1, sa: 0, hw: w / 2, hh: h / 2 } });
    if (Math.abs(out.x) >= Math.abs(out.y)) {
      // ряд вдоль линии наружу
      let d = reach;
      list.forEach((l, i) => {
        d += ws[i] / 2;
        add(c.x + out.x * d, c.y + out.y * d, l, ws[i]);
        d += ws[i] / 2 + gap;
      });
    } else {
      // ряд поперёк, по центру
      const total = ws.reduce((s, w) => s + w, 0) + gap * (ws.length - 1);
      const cy = c.y + out.y * (reach + h / 2);
      const cx0 = c.x + out.x * (reach + h / 2);
      let x = cx0 - total / 2;
      list.forEach((l, i) => {
        add(x + ws[i] / 2, cy, l, ws[i]);
        x += ws[i] + gap;
      });
    }
    return res;
  }

  function drawBadge(g, x, y, line, size) {
    const label = line.number || "";
    if (!label) return;
    const h = size * 1.5;
    const w = badgeWidth(label, size);
    const bg = el("g", { class: "sc-badge" }, g);
    el("rect", { x: x - w / 2, y: y - h / 2, width: w, height: h, rx: h * 0.3, fill: line.color }, bg);
    const t = el("text", {
      x, y: y + size * 0.36, "text-anchor": "middle", "font-size": size, "font-weight": 700, fill: textColorOn(line.color),
    }, bg);
    t.textContent = label;
  }

  function drawTransfer(g, p, tr, stById) {
    const sts = tr.stationIds.map((id) => stById.get(id)).filter(Boolean);
    if (sts.length < 2) return;
    // соединяем цепочкой ближайших соседей
    const chain = [sts[0]];
    const rest = sts.slice(1);
    while (rest.length) {
      const lastSt = chain[chain.length - 1];
      let bi = 0, bd = Infinity;
      rest.forEach((s, i) => { const d = Math.hypot(s.x - lastSt.x, s.y - lastSt.y); if (d < bd) { bd = d; bi = i; } });
      chain.push(rest.splice(bi, 1)[0]);
    }
    const d = chain.map((s, i) => `${i ? "L" : "M"}${s.x} ${s.y}`).join(" ");
    const w = p.style.lineWidth * 1.1 * p.style.transferScale;
    const tg = el("g", { "data-kind": "transfer", "data-id": tr.id, class: "sc-transfer" }, g);
    el("path", { d, fill: "none", stroke: p.style.stationStroke, "stroke-width": w + 2.5, "stroke-linecap": "round" }, tg);
    el("path", { d, fill: "none", stroke: p.style.stationFill, "stroke-width": w, "stroke-linecap": "round" }, tg);
  }

  function drawLegend(g, p) {
    if (!p.legend.show) return;
    // объединённые линии — одна строка легенды
    const seenGroups = new Set();
    const rows = p.lines.filter((l) => {
      if (l.points.length < 2) return false;
      if (!l.group) return true;
      if (seenGroups.has(l.group)) return false;
      seenGroups.add(l.group);
      return true;
    });
    if (!rows.length) return;
    const size = p.style.labelSize;
    const rowH = size * 2;
    const pad = size;
    const lg = el("g", { "data-kind": "legend", "data-id": "legend", class: "sc-legend", transform: `translate(${p.legend.x} ${p.legend.y})` }, g);
    const box = el("rect", { x: 0, y: 0, width: 10, height: 10, rx: 6, fill: "#ffffff", stroke: "#d1d5db", "stroke-width": 1 }, lg);
    let y = pad;
    let maxW = 120;
    if (p.legend.title) {
      const t = el("text", { x: pad, y: y + size * 1.1, "font-size": size * 1.25, "font-weight": 700, fill: "#111827" }, lg);
      t.textContent = p.legend.title;
      maxW = Math.max(maxW, p.legend.title.length * size * 0.7 + pad * 2);
      y += size * 2.2;
    }
    for (const l of rows) {
      const cy = y + rowH / 2;
      el("line", { x1: pad, y1: cy, x2: pad + size * 2.6, y2: cy, stroke: l.color, "stroke-width": Math.min(rowH * 0.5, lineWidthOf(p, l)), "stroke-linecap": "round" }, lg);
      let x = pad + size * 3.2;
      // объединённая линия: номера всех маршрутов группы (не больше 4)
      const nums = [...new Set(p.lines.filter((m) => (l.group ? m.group === l.group : m === l)).map((m) => m.number).filter(Boolean))].slice(0, 4);
      for (const nm of nums) {
        const bw = Math.max(size * 1.5, nm.length * size * 0.62 + size * 0.8);
        drawBadge(lg, x + bw / 2, cy, { number: nm, color: l.color }, size * 0.8);
        x += bw + size * 0.4;
      }
      if (nums.length) x += size * 0.1;
      const t = el("text", { x, y: cy + size * 0.35, "font-size": size, fill: "#111827" }, lg);
      t.textContent = l.name || "";
      maxW = Math.max(maxW, x + (l.name || "").length * size * 0.56 + pad);
      y += rowH;
    }
    box.setAttribute("width", String(maxW));
    box.setAttribute("height", String(y + pad * 0.5));
  }

  // ------------------------------------------------------------
  // Фигуры (прямоугольник, эллипс, линия, текст)
  // ------------------------------------------------------------
  // Габарит фигуры в её собственной (не повёрнутой) системе. Для текста —
  // оценка по длине строк.
  function shapeBox(sh) {
    if (sh.type === "text") {
      const lines = (sh.text || " ").split("\n");
      const w = Math.max(...lines.map((l) => l.length), 1) * sh.fontSize * 0.58;
      const h = lines.length * sh.fontSize * 1.2;
      const x = sh.align === "middle" ? sh.x - w / 2 : sh.align === "end" ? sh.x - w : sh.x;
      return { x, y: sh.y, w, h };
    }
    if (sh.type === "line") {
      return { x: Math.min(sh.x, sh.x + sh.w), y: Math.min(sh.y, sh.y + sh.h), w: Math.abs(sh.w), h: Math.abs(sh.h) };
    }
    return { x: sh.x, y: sh.y, w: sh.w, h: sh.h };
  }

  function drawShape(g, p, sh) {
    const b = shapeBox(sh);
    const rot = sh.rot ? ` rotate(${sh.rot} ${b.x + b.w / 2} ${b.y + b.h / 2})` : "";
    const root = el("g", { "data-kind": "shape", "data-id": sh.id, class: "sc-shape", transform: rot.trim() || null, opacity: sh.opacity < 1 ? sh.opacity : null }, g);
    const dash = sh.dash === "dashed" ? `${sh.strokeW * 3} ${sh.strokeW * 2}` : sh.dash === "dotted" ? `0.1 ${sh.strokeW * 2}` : null;
    const common = {
      fill: sh.fill, stroke: sh.stroke, "stroke-width": sh.stroke === "none" ? 0 : sh.strokeW,
      "stroke-dasharray": dash, "stroke-linecap": "round", "stroke-linejoin": "round",
    };
    if (sh.type === "rect") {
      el("rect", Object.assign({ x: sh.x, y: sh.y, width: sh.w, height: sh.h, rx: Math.min(sh.rx, sh.w / 2, sh.h / 2) }, common), root);
    } else if (sh.type === "ellipse") {
      el("ellipse", Object.assign({ cx: sh.x + sh.w / 2, cy: sh.y + sh.h / 2, rx: sh.w / 2, ry: sh.h / 2 }, common), root);
    } else if (sh.type === "line") {
      // широкая прозрачная зона попадания
      el("line", { x1: sh.x, y1: sh.y, x2: sh.x + sh.w, y2: sh.y + sh.h, stroke: "transparent", "stroke-width": Math.max(10, sh.strokeW + 8), "stroke-linecap": "round" }, root);
      el("line", Object.assign({ x1: sh.x, y1: sh.y, x2: sh.x + sh.w, y2: sh.y + sh.h }, common, { fill: "none", stroke: sh.stroke === "none" ? "#111827" : sh.stroke, "stroke-width": Math.max(1, sh.strokeW) }), root);
    } else {
      el("rect", { x: b.x, y: b.y, width: b.w, height: b.h, fill: "transparent" }, root);
      const lines = (sh.text || "").split("\n");
      lines.forEach((ln, i) => {
        const t = el("text", {
          x: sh.x, y: sh.y + sh.fontSize * (0.95 + 1.2 * i), "text-anchor": sh.align, "font-size": sh.fontSize,
          "font-weight": sh.bold ? 700 : 400, fill: sh.fill === "none" ? "#111827" : sh.fill,
          stroke: sh.stroke === "none" ? null : sh.stroke, "stroke-width": sh.stroke === "none" ? null : sh.strokeW,
          "paint-order": "stroke", "stroke-linejoin": "round",
        }, root);
        t.textContent = ln;
      });
    }
  }

  // Часть полилинии в радиусе R (вдоль линии) от ближайшей к c точки
  function slicePolyline(pts, c, R) {
    const near = nearestOnPolyline(pts, c);
    if (!near) return [];
    const out = [near.point];
    let rem = R;
    for (let i = near.seg + 1; i < pts.length && rem > 0; i++) {
      const prev = out[out.length - 1];
      const d = len(sub(pts[i], prev));
      if (d >= rem) { out.push({ x: prev.x + ((pts[i].x - prev.x) / d) * rem, y: prev.y + ((pts[i].y - prev.y) / d) * rem }); rem = 0; }
      else { out.push(pts[i]); rem -= d; }
    }
    const back = [];
    rem = R;
    let cur = near.point;
    for (let i = near.seg; i >= 0 && rem > 0; i--) {
      const d = len(sub(pts[i], cur));
      if (d >= rem) { back.push({ x: cur.x + ((pts[i].x - cur.x) / d) * rem, y: cur.y + ((pts[i].y - cur.y) / d) * rem }); rem = 0; }
      else { back.push(pts[i]); rem -= d; cur = pts[i]; }
    }
    return back.reverse().concat(out);
  }

  /**
   * Рисует схему в группу root (очищает её). opts.live — живые данные
   * (только редактор): { conflictStations: Map(mtrStationId→count),
   * delayedRoutes: Map(routeId→ms) }. Возвращает индекс для редактора.
   */
  // Схема без скрытых линий: станции, у которых все линии скрыты, и
  // пересадки, потерявшие пару, тоже скрываются
  function visibleProject(p) {
    const hid = new Set(p.lines.filter((l) => l.hidden).map((l) => l.id));
    if (!hid.size) return p;
    const stations = p.stations.filter((s) => !(s.lineIds.length && s.lineIds.every((id) => hid.has(id))));
    const vis = new Set(stations.map((s) => s.id));
    const transfers = p.transfers.map((t) => Object.assign({}, t, { stationIds: t.stationIds.filter((id) => vis.has(id)) })).filter((t) => t.stationIds.length >= 2);
    return Object.assign({}, p, { lines: p.lines.filter((l) => !l.hidden), stations, transfers });
  }

  // номер отрисовки — для уникальных id clipPath (редактор и экспорт живут
  // в одном документе)
  let renderSeq = 0;
  function render(root, p, opts) {
    opts = opts || {};
    p = visibleProject(p);
    while (root.firstChild) root.removeChild(root.firstChild);
    root.setAttribute("font-family", FONT);
    const linesById = new Map(p.lines.map((l) => [l.id, l]));
    const stById = new Map(p.stations.map((s) => [s.id, s]));
    const transferStations = new Set(p.transfers.flatMap((t) => t.stationIds));

    const gShapesBack = el("g", { class: "sc-shapes-back" }, root);
    const gLive = el("g", { class: "sc-live" }, root);
    const gLines = el("g", { class: "sc-lines" }, root);
    const gTransfers = el("g", { class: "sc-transfers" }, root);
    const gMarks = el("g", { class: "sc-stations" }, root);
    const gThrough = el("g", { class: "sc-through", "pointer-events": "none" }, root);
    const gBadges = el("g", { class: "sc-badges" }, root);
    const gShapesFront = el("g", { class: "sc-shapes-front" }, root);
    const gLabels = el("g", { class: "sc-labels" }, root);
    const gLegend = el("g", { class: "sc-legend-layer" }, root);

    for (const sh of p.shapes) drawShape(sh.layer === "front" ? gShapesFront : gShapesBack, p, sh);

    const live = opts.live || null;
    const offsetPts = new Map();
    for (const line of p.lines) {
      if (line.points.length < 2) continue;
      const pts = offsetPolylineVar(line.points, lineOffsets(p, line), p.style.cornerRadius);
      offsetPts.set(line.id, pts);
      const g = el("g", { "data-kind": "line", "data-id": line.id, class: "sc-line" }, gLines);
      // широкая прозрачная зона попадания
      el("path", { d: roundedPath(pts, p.style.cornerRadius), fill: "none", stroke: "transparent", "stroke-width": lineWidthOf(p, line) + 10, "stroke-linecap": "round" }, g);
      drawLinePath(g, p, line, pts);
      if (live && live.delayedRoutes && (line.mtrRouteIds || []).some((r) => live.delayedRoutes.has(r))) {
        const ms = Math.max(...line.mtrRouteIds.map((r) => live.delayedRoutes.get(r) || 0));
        const lg = el("g", { "data-kind": "line", "data-id": line.id }, gLive);
        el("path", {
          d: roundedPath(pts, p.style.cornerRadius), fill: "none", stroke: "#ef4444", "stroke-opacity": 0.35,
          "stroke-width": lineWidthOf(p, line) + 10, "stroke-linecap": "round", "stroke-linejoin": "round",
          class: "sc-live-delay",
        }, lg);
        el("title", null, lg).textContent = `+${Math.round(ms / 60000)} min`;
      }
    }

    for (const tr of p.transfers) drawTransfer(gTransfers, p, tr, stById);

    const drawn = { transferStations };
    const geos = new Map();
    const entries = [];
    for (const st of p.stations) {
      const geo = stationGeometry(p, st, linesById, drawn);
      geos.set(st.id, geo);
      const style = resolveStyle(st);
      entries.push({ st, geo, style, mk: markerBox(p, st, geo, style) });
    }
    const badges = new Map();
    for (const e of entries) if (e.geo.ends.length) badges.set(e.st.id, layoutEndBadges(p, e.st, e.geo, e.mk));
    const labels = placeLabels(p, entries, offsetPts, [...badges.values()].flat());
    const clipBase = "sc-pass-" + (++renderSeq) + "-";
    entries.forEach(({ st, geo, style, mk }, si) => {
      const lay = labels.get(st.id);
      // засечка смотрит в сторону выбранной подписи
      const ld = lay ? [lay.ax - geo.c.x, lay.ay - geo.c.y] : labelDir(st, geo);
      drawMarker(gMarks, p, st, geo, style, ld);
      if (lay) drawLabel(gLabels, p, st, lay);
      // Линии, проходящие станцию без остановки (экспресс), — поверх значка,
      // но строго в его контуре (чуть внутри обводки): раньше кусок брался
      // с запасом и торчал за край, а на большом значке пересадки виднелись
      // изгибы полос — «линии поверх станций»
      const pass = (st.passLineIds || []).filter((lid) => offsetPts.has(lid) && linesById.has(lid));
      if (pass.length) {
        const b = mk.box, inset = Math.max(1.1, geo.maxW * 0.2);
        const cg = el("clipPath", { id: clipBase + si }, gThrough);
        el("rect", {
          x: -b.hw + inset, y: -b.hh + inset, width: Math.max(0, 2 * (b.hw - inset)), height: Math.max(0, 2 * (b.hh - inset)), rx: Math.max(0, (b.rx || 0) - inset),
          transform: `translate(${b.cx} ${b.cy}) rotate(${Math.atan2(b.sa, b.ca) * 180 / Math.PI})`,
        }, cg);
        const pg = el("g", { "clip-path": `url(#${clipBase + si})` }, gThrough);
        for (const lid of pass) {
          const line = linesById.get(lid);
          const part = slicePolyline(offsetPts.get(lid), geo.c, mk.maxReach + lineWidthOf(p, line) * 2);
          if (part.length > 1) drawLinePath(pg, p, line, part);
        }
      }
      for (const b of badges.get(st.id) || []) drawBadge(gBadges, b.x, b.y, b.line, b.size);
      if (live && live.conflictStations && st.mtrStationId && live.conflictStations.has(st.mtrStationId)) {
        const cg = el("g", { "data-kind": "station", "data-id": st.id, class: "sc-live-conflict" }, gLive);
        el("circle", { cx: st.x, cy: st.y, r: geo.maxW * 2.4, fill: "#ef4444", "fill-opacity": 0.22, stroke: "#ef4444", "stroke-width": 2 }, cg);
        el("title", null, cg).textContent = `⚠ ${live.conflictStations.get(st.mtrStationId)}`;
      }
    });
    drawLegend(gLegend, p);
    return { geos, offsetPts, labels };
  }

  // Габариты содержимого (для «вписать в экран» и экспорта)
  function bounds(p) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const add = (x, y) => { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; };
    p.stations.forEach((s) => add(s.x, s.y));
    p.lines.forEach((l) => l.points.forEach((q) => add(q.x, q.y)));
    p.shapes.forEach((sh) => { const b = shapeBox(sh); add(b.x, b.y); add(b.x + b.w, b.y + b.h); });
    if (minX === Infinity) return null;
    return { minX, minY, maxX, maxY };
  }

  // Самостоятельный SVG (экспорт / просмотрщик)
  function toSvgElement(p) {
    const svg = el("svg", { xmlns: NS });
    const root = el("g", null, svg);
    render(root, p);
    // временно в документ, чтобы getBBox учёл подписи и легенду
    svg.style.position = "absolute";
    svg.style.visibility = "hidden";
    document.body.appendChild(svg);
    let bb;
    try { bb = root.getBBox(); } catch (e) { bb = null; }
    document.body.removeChild(svg);
    svg.style.position = "";
    svg.style.visibility = "";
    const pad = 40;
    const b = bb && bb.width ? bb : { x: 0, y: 0, width: 100, height: 100 };
    const x = b.x - pad, y = b.y - pad, w = b.width + pad * 2, h = b.height + pad * 2;
    svg.setAttribute("viewBox", `${x} ${y} ${w} ${h}`);
    svg.setAttribute("width", String(Math.ceil(w)));
    svg.setAttribute("height", String(Math.ceil(h)));
    const bg = el("rect", { x, y, width: w, height: h, fill: p.style.bg });
    svg.insertBefore(bg, root);
    return svg;
  }

  function toSvgString(p) {
    return new XMLSerializer().serializeToString(toSvgElement(p));
  }

  function toPngBlob(p, scale) {
    return new Promise((resolve, reject) => {
      const svg = toSvgElement(p);
      const w = Number(svg.getAttribute("width")), h = Number(svg.getAttribute("height"));
      const s = Math.max(0.25, Math.min(scale || 2, 16000 / Math.max(w, h)));
      const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" }));
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = Math.ceil(w * s);
        c.height = Math.ceil(h * s);
        const ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png");
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("svg render failed")); };
      img.src = url;
    });
  }

  return {
    VERSION, NS, STATION_STYLES, LABEL_POS, LABEL_ANGLES, DASHES, SHAPE_DASHES, SHAPE_TYPES, DIRS,
    normalize, emptyProject, toPublished, fromPublished,
    render, bounds, toSvgElement, toSvgString, toPngBlob,
    nearestOnPolyline, offsetPolylineVar, visibleProject, vertexDisplayPoints, el, normalizeShape, shapeBox,
  };
})();

if (typeof window !== "undefined") window.SchemeCore = SchemeCore;
