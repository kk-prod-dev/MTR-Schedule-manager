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
  const DASHES = ["solid", "dashed", "dotted", "double", "rail", "dashdot"];
  const SHAPE_DASHES = ["solid", "dashed", "dotted"];
  const SHAPE_TYPES = ["rect", "ellipse", "line", "text", "icon"];
  const PLATES = ["none", "circle", "square"];
  // свой значок: только растр/SVG в data-URL (в <image> скрипты не выполняются)
  const IMG_RE = /^data:image\/(png|jpeg|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/;
  const IMG_MAX = 600000;
  const TRANSFER_STYLES = ["bar", "capsule", "dumbbell", "dumbbell2", "curve", "dashed", "none", "london", "moscow", "square", "hub"];
  // стили, где значки станций пересадки рисует сама пересадка
  const OWN_MARKER_TRANSFERS = ["capsule", "hub"];
  const STATION_STYLES = ["auto", "tick", "circle", "pill", "square", "diamond", "stump"];
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
      icon: str(s.icon, 24),
      variant: Math.max(0, Math.min(2, Math.round(num(s.variant, 0)))),
      plate: oneOf(s.plate, PLATES, "none"),
      plateColor: colorOpt(s.plateColor),
      img: typeof s.img === "string" && s.img.length <= IMG_MAX && IMG_RE.test(s.img) ? s.img : "",
    };
    if (type === "icon") { sh.fill = colorNone(s.fill, "#334155"); sh.stroke = "none"; if (!sh.icon) sh.icon = sh.img ? "img" : "park"; }
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
        transferStyle: oneOf(style.transferStyle, TRANSFER_STYLES, "bar"),
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
          // dx/dy — ручной сдвиг подписи (перетаскивание), в пикселях схемы
          label: {
            pos: oneOf(label.pos, LABEL_POS, "auto"), angle: oneOf(num(label.angle, 0), LABEL_ANGLES, 0),
            dx: clamp(label.dx, -2000, 2000, 0), dy: clamp(label.dy, -2000, 2000, 0),
          },
          // блок номеров маршрутов на конечной: сдвиг и «не показывать»
          badge: { dx: clamp(s.badge && s.badge.dx, -2000, 2000, 0), dy: clamp(s.badge && s.badge.dy, -2000, 2000, 0), hide: !!(s.badge && s.badge.hide) },
          lineIds: idList(s.lineIds),
          passLineIds: idList(s.passLineIds),
          fill: colorOpt(s.fill),
          stroke: colorOpt(s.stroke),
          strokeW: s.strokeW == null || s.strokeW === "" ? null : clamp(s.strokeW, 0, 20, 2),
          size: clamp(s.size, 0.3, 5, 1),
          labelSize: s.labelSize == null || s.labelSize === "" ? null : clamp(s.labelSize, 6, 48, 12),
          labelColor: colorOpt(s.labelColor),
          // вид пересадки именно у этой станции ("" = как задано для всей схемы)
          transferStyle: TRANSFER_STYLES.includes(s.transferStyle) ? s.transferStyle : "",
        };
        if (s.mtrStationId) st.mtrStationId = str(s.mtrStationId, 80);
        if (s.mtrName != null) st.mtrName = str(s.mtrName);
        return st;
      }),
      transfers: (Array.isArray(src.transfers) ? src.transfers : []).slice(0, 5000)
        .map((t) => ({ id: str(t.id, 80) || "tr-" + Math.random().toString(36).slice(2, 9), stationIds: idList(t.stationIds), style: TRANSFER_STYLES.includes(t.style) ? t.style : "" }))
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
        p.style.stationScale, p.style.stationFill, p.style.stationStroke, p.style.labelAuto ? 1 : 0, p.style.transferScale, p.style.transferStyle],
      l: p.lines.map((l) => [l.id, l.name, l.number, l.color, l.width, l.dash, l.offset, l.points.flatMap((q) => [r(q.x), r(q.y)]), l.lanes || null, l.group || ""]),
      st: p.stations.map((s) => [s.id, s.name, s.sub, r(s.x), r(s.y), s.style, s.label.pos, s.label.angle, s.lineIds,
        s.passLineIds, s.fill, s.stroke, s.strokeW, s.size, s.labelSize, s.labelColor,
        r(s.label.dx), r(s.label.dy), r(s.badge.dx), r(s.badge.dy), s.badge.hide ? 1 : 0, s.transferStyle || ""]),
      sh: p.shapes.map((x) => [x.type, x.x, x.y, x.w, x.h, x.fill, x.stroke, x.strokeW, x.opacity, x.dash, x.rx, x.rot, x.layer, x.text, x.fontSize, x.bold ? 1 : 0, x.align, x.icon || "", x.variant || 0, x.plate || "none", x.plateColor || "", x.img || ""]),
      tr: p.transfers.map((t) => (t.style ? [t.stationIds, t.style] : t.stationIds)),
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
        stationScale: s[6], stationFill: s[7], stationStroke: s[8], labelAuto: s[9] !== 0, transferScale: s[10], transferStyle: s[11],
      },
      shapes: arr(c.sh).map((x, i) => {
        x = arr(x);
        return {
          id: "sh-" + i, type: x[0], x: x[1], y: x[2], w: x[3], h: x[4], fill: x[5], stroke: x[6], strokeW: x[7], opacity: x[8],
          dash: x[9], rx: x[10], rot: x[11], layer: x[12], text: x[13], fontSize: x[14], bold: x[15] === 1, align: x[16], icon: x[17], variant: x[18], plate: x[19], plateColor: x[20], img: x[21],
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
          id: x[0], name: x[1], sub: x[2], x: x[3], y: x[4], style: x[5], label: { pos: x[6], angle: x[7], dx: x[16], dy: x[17] }, lineIds: x[8],
          passLineIds: x[9], fill: x[10], stroke: x[11], strokeW: x[12], size: x[13], labelSize: x[14], labelColor: x[15],
          badge: { dx: x[18], dy: x[19], hide: x[20] === 1 }, transferStyle: x[21],
        };
      }),
      transfers: arr(c.tr).map((x, i) => (Array.isArray(x[0]) ? { id: "tr-" + i, stationIds: x[0], style: x[1] } : { id: "tr-" + i, stationIds: x })),
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
  // steep — Set ключей «x,y» вершин, где смена полосы на прямой должна быть
  // крутой (станции: значок-«пилюля» прикрывает её целиком, а пологая
  // ступенька торчала из-под него «микро-зигзагом»); steepLen — её длина
  function offsetPolylineVar(ptsIn, offsIn, R, steep, steepLen) {
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
      segs.push({ i, d, o, L: len(dv), a: pts[i], b: pts[i + 1], q: { x: pts[i].x + nm.x * o, y: pts[i].y + nm.y * o } });
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
          // смена полосы на прямой — косой переход (в станции — крутой, под значком)
          const atSt = steep && steep.has(s.b.x + "," + s.b.y);
          const tt = Math.min(atSt ? Math.min(gap, steepLen || gap) : gap, s.L / 2, u.L / 2);
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
    // Радиусы скругления (окружности) — null = по умолчанию из R. Углы
    // описаны в corners: полосы пучка на одном углу должны идти по дугам с
    // ОБЩИМ центром (снаружи радиус больше на смещение, внутри меньше), это
    // согласует shareCornerRadii по всем линиям сразу
    const radii = [0], corners = [];
    joins.forEach((jn, k) => {
      const s = keep[k], u = keep[k + 1];
      if (jn.one) {
        out.push(P(s, jn.t1));
        radii.push(null);
        // c > 0 — поворот направо (y вниз): слева снаружи, справа внутри;
        // угол привязан к вершине осевой линии, если отрезки соседние
        if (jn.c && u.i === s.i + 1) {
          const v = pts[u.i];
          const th = Math.acos(Math.max(-1, Math.min(1, s.d.x * u.d.x + s.d.y * u.d.y)));
          corners.push({
            idx: out.length - 1, th, oo: ((s.o + u.o) / 2) * Math.sign(jn.c),
            key: `${v.x},${v.y}|${Math.round(s.d.x * 8)},${Math.round(s.d.y * 8)}|${Math.round(u.d.x * 8)},${Math.round(u.d.y * 8)}`,
          });
        }
      } else {
        out.push(P(s, jn.t1), P(u, jn.t0));
        radii.push(null, null);
      }
    });
    out.push(P(last, endT == null ? last.L : endT));
    radii.push(0);
    out.radii = radii;
    out.corners = corners;
    return out;
  }

  /**
   * Концентрические углы пучков. Для каждого угла (вершина осевой линии +
   * направления) берётся общий радиус оси Rc: не меньше обычного (R —
   * отступ касания, как раньше: радиус R / tan(θ/2)) и такой, чтобы у самой
   * внутренней полосы оставался видимый радиус rMin; но не больше, чем
   * позволяют длины отрезков. Полоса получает Rc + своё смещение наружу —
   * все дуги с одним центром, без дыр и без квадратных углов внутри.
   */
  function shareCornerRadii(polys, R, rMin) {
    const groups = new Map();
    for (const op of polys) {
      for (const cn of op.corners || []) {
        const i = cn.idx;
        const la = len(sub(op[i], op[i - 1])), lb = len(sub(op[i + 1], op[i]));
        if (!groups.has(cn.key)) groups.set(cn.key, []);
        groups.get(cn.key).push({ op, i, oo: cn.oo, th: cn.th, room: Math.min(la, lb) / 2 });
      }
    }
    for (const list of groups.values()) {
      const tn = Math.tan(list[0].th / 2);
      if (tn < 1e-3) continue;
      let want = R / tn, cap = Infinity, inner = Infinity;
      for (const e of list) {
        want = Math.max(want, rMin - e.oo);
        cap = Math.min(cap, e.room / tn - e.oo);
        inner = Math.min(inner, e.oo);
      }
      // тесно (короткие отрезки) — внешние полосы ужимаются сами в
      // roundedPath, но внутренняя не становится квадратной
      // Места мало, и внутренняя полоса при общем центре получила бы
      // радиус < 0: тогда внешние полосы остались бы дугами, а внутренняя —
      // острым углом, и между ними открывался просвет (заметно на толстых
      // линиях). Все полосы угла в этом случае делаются острыми одинаково
      const rc = Math.min(want, cap);
      if (rc + inner < 0.5) { for (const e of list) e.op.radii[e.i] = 0.5; continue; }
      for (const e of list) e.op.radii[e.i] = rc + e.oo;
    }
  }

  // Углы — дуги окружностей (A), а не квадратичные кривые: у концентрических
  // полос пучка зазор по всей дуге одинаковый. r — отступ касания по
  // умолчанию (радиус r / tan(θ/2)), pts.radii[i] — радиус окружности
  function roundedPath(pts, r) {
    if (pts.length < 2) return "";
    const f = (v) => Math.round(v * 100) / 100;
    let d = `M${f(pts[0].x)} ${f(pts[0].y)}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const a = pts[i - 1], v = pts[i], b = pts[i + 1];
      const la = len(sub(a, v)), lb = len(sub(b, v));
      const ua = unit(sub(a, v)), ub = unit(sub(b, v));
      const th = Math.acos(Math.max(-1, Math.min(1, -(ua.x * ub.x + ua.y * ub.y)))); // угол поворота
      const tn = Math.tan(th / 2);
      const rad = pts.radii && pts.radii[i] != null ? pts.radii[i] : r / (tn || 1);
      const tt = Math.min(rad * tn, la / 2, lb / 2);
      if (tt < 0.5 || tn < 1e-3 || th > Math.PI - 1e-3) { d += ` L${f(v.x)} ${f(v.y)}`; continue; }
      const sweep = cross(ua, ub) < 0 ? 1 : 0;
      const rr = tt / tn;
      d += ` L${f(v.x + ua.x * tt)} ${f(v.y + ua.y * tt)} A${f(rr)} ${f(rr)} 0 0 ${sweep} ${f(v.x + ub.x * tt)} ${f(v.y + ub.y * tt)}`;
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
  // Шаг полос — ОДИН на всю схему (по самой толстой линии): с шагом по ширине
  // каждой линии разной толщины полосы соседей налезали друг на друга
  // при зазоре < 1 соседние линии перекрываются на 0.4 px: края двух вплотную
  // стоящих обводок давали просвет-«шов» (особенно на поворотах)
  const computePitch = (p) => Math.max(p.style.lineWidth, ...p.lines.map((l) => l.width || 0)) + p.style.laneGap - (p.style.laneGap < 1 ? 0.4 : 0);
  const pitchOf = (p) => (p._pitch != null ? p._pitch : computePitch(p));
  // эффективные полосы: сглаженные smoothLanes (p._lanes) или записанные в линии
  const lanesOf = (p, l) => (p._lanes && p._lanes.get(l.id)) || l.lanes;
  // Объединённые линии ведут себя как одна: ручной сдвиг «в пучке» у линии,
  // идущей по тому же пути в обратную сторону, откладывается с другой
  // стороны от СВОЕГО хода — иначе общий offset разводил члены группы в
  // разные стороны. Знак — относительно первой линии группы.
  function groupSignOf(p, l) {
    if (!l.group) return 1;
    if (p._gs && p._gs.has(l.id)) return p._gs.get(l.id);
    const ref = p.lines.find((o) => o.group === l.group);
    if (!ref || ref === l) return 1;
    const key = (a, b) => (a.x < b.x || (a.x === b.x && a.y < b.y) ? a.x + "," + a.y + ">" + b.x + "," + b.y : b.x + "," + b.y + ">" + a.x + "," + a.y);
    const dirOf = (a, b) => (a.x < b.x || (a.x === b.x && a.y < b.y) ? 1 : -1);
    const refSeg = new Map();
    for (let i = 0; i + 1 < ref.points.length; i++) refSeg.set(key(ref.points[i], ref.points[i + 1]), dirOf(ref.points[i], ref.points[i + 1]));
    let sum = 0;
    for (let i = 0; i + 1 < l.points.length; i++) {
      const r = refSeg.get(key(l.points[i], l.points[i + 1]));
      if (r) sum += r * dirOf(l.points[i], l.points[i + 1]);
    }
    if (!sum) {
      // общих отрезков нет — по общему направлению от начала к концу
      const v = (q) => ({ x: q.points[q.points.length - 1].x - q.points[0].x, y: q.points[q.points.length - 1].y - q.points[0].y });
      const a = v(ref), b = v(l);
      sum = a.x * b.x + a.y * b.y;
    }
    return sum < 0 ? -1 : 1;
  }
  const segOffset = (p, l, i) => (((lanesOf(p, l) && lanesOf(p, l)[i]) || 0) + (l.offset || 0) * groupSignOf(p, l)) * pitchOf(p);

  /**
   * Сглаживание зигзагов в пучках. Полоса отрезка меняется вверх-вниз на
   * коротком участке (0 → 0.5 → 0 или 1 → 0 → -1 между соседними отрезками):
   * линия рисуется буквой Z / S из двух ступенек подряд. Короткий кусок
   * (меньше SMOOTH_LEN полос шага) ставится на полосу соседа — но только если
   * эта полоса на каждом отрезке куска свободна (другие линии её не заняли),
   * поэтому наложений не появляется. Работает над копией: в модели lanes
   * не меняются. Возвращает Map(lineId → lanes).
   */
  const SMOOTH_LEN = 20;
  function smoothLanes(p) {
    const out = new Map();
    const own = (l) => (l.group ? "g:" + l.group : l.id);
    const R2 = (v) => Math.round(v * 100) / 100;
    const lanesMap = new Map();
    // Работаем над линиями без отрезков нулевой длины (повторная вершина в
    // одной точке — бывает в станции после правок): такой отрезок рвал цепочки
    // соседних отрезков, и ступенька смены полосы в этой точке не
    // исправлялась. В конце полосы разворачиваются обратно на исходные индексы
    const lines = [], keep = new Map();
    for (const l of p.lines) {
      const ix = [];
      for (let i = 0; i + 1 < l.points.length; i++) if (l.points[i].x !== l.points[i + 1].x || l.points[i].y !== l.points[i + 1].y) ix.push(i);
      keep.set(l.id, ix);
      const points = ix.length ? [l.points[ix[0]], ...ix.map((i) => l.points[i + 1])] : l.points.slice(0, 1);
      const okLanes = l.lanes && l.lanes.length === l.points.length - 1;
      lines.push({ id: l.id, group: l.group, points, lanes: okLanes ? ix.map((i) => l.lanes[i]) : null });
    }
    for (const l of lines) {
      if (!l.lanes || l.points.length < 3) continue;
      lanesMap.set(l.id, l.lanes.slice());
    }
    if (!lanesMap.size) return out;
    // Пучки — геометрически: отрезки всех линий раскладываются по «коридорам»
    // (общая опорная прямая), у каждого — интервал вдоль неё и полоса в общем
    // (каноническом) кадре. Сравнивать отрезки по одинаковым концам нельзя:
    // если у соседки на том же участке лишняя вершина, её отрезок «не виден»,
    // и линию ставило на полполосы поверх неё
    const corr = new Map(), recsOf = new Map();
    for (const l of lines) {
      const ln = lanesMap.get(l.id) || l.lanes || [];
      const recs = [];
      for (let i = 0; i + 1 < l.points.length; i++) {
        const a = l.points[i], b = l.points[i + 1];
        const fwd = a.x < b.x || (a.x === b.x && a.y < b.y);
        const A = fwd ? a : b, B = fwd ? b : a;
        const L = len(sub(B, A));
        if (!L) { recs.push(null); continue; }
        const u = { x: (B.x - A.x) / L, y: (B.y - A.y) / L };
        const key = Math.round(u.x * 1000) + "," + Math.round(u.y * 1000) + "|" + Math.round((A.x * -u.y + A.y * u.x) * 10) / 10;
        const rec = { key, u, sign: fwd ? 1 : -1, t0: A.x * u.x + A.y * u.y, t1: B.x * u.x + B.y * u.y, c: R2((ln[i] || 0) * (fwd ? 1 : -1)), o: own(l) };
        if (!corr.has(key)) corr.set(key, []);
        corr.get(key).push(rec);
        recs.push(rec);
      }
      recsOf.set(l.id, recs);
    }
    // Можно ли поставить отрезок на полосу target: ни одна чужая линия на
    // перекрывающемся куске коридора не ближе целой полосы (иначе наложение),
    // и пучок там остаётся сплошным (без дыры между линиями)
    function laneOk(rec, target) {
      if (!rec) return true;
      const tc = R2(target * rec.sign);
      const near = corr.get(rec.key).filter((r) => r !== rec && r.t1 > rec.t0 + 0.5 && r.t0 < rec.t1 - 0.5);
      // объединённая линия (та же группа) рядом должна остаться в той же полосе
      // или не ближе целой — иначе члены группы расходятся на полполосы
      if (near.some((r) => r.o === rec.o && r.c !== tc && Math.abs(r.c - tc) < 0.99)) return false;
      const others = near.filter((r) => r.o !== rec.o);
      if (!others.length) return true;
      const cuts = [...new Set([rec.t0, rec.t1, ...others.flatMap((r) => [r.t0, r.t1]).filter((t) => t > rec.t0 && t < rec.t1)])].sort((x, y) => x - y);
      for (let j = 0; j + 1 < cuts.length; j++) {
        if (cuts[j + 1] - cuts[j] < 0.5) continue;
        const m = (cuts[j] + cuts[j + 1]) / 2;
        const here = others.filter((r) => r.t0 <= m && m <= r.t1).map((r) => r.c);
        if (here.some((c) => Math.abs(c - tc) < 0.99)) return false;
        const v = [...new Set([...here, tc])].sort((x, y) => x - y);
        for (let t = 1; t < v.length; t++) if (v[t] - v[t - 1] > 1.01) return false;
      }
      return true;
    }
    const runOk = (l, from, to, target) => {
      const recs = recsOf.get(l.id);
      for (let k = from; k <= to; k++) if (!laneOk(recs[k], target)) return false;
      return true;
    };
    const setRun = (l, ln, from, to, target) => {
      const recs = recsOf.get(l.id);
      for (let k = from; k <= to; k++) {
        ln[k] = target;
        if (recs[k]) recs[k].c = R2(target * recs[k].sign);
      }
    };
    const pitch = pitchOf(p);
    const maxLen = SMOOTH_LEN * pitch;
    let changed = false;
    // 1) Короткие «горбы» (0 → 0.5 → 0) и ступеньки (a → b → c) — на полосу соседа
    for (let pass = 0; pass < 4; pass++) {
      let any = false;
      for (const l of lines) {
        const ln = lanesMap.get(l.id);
        if (!ln) continue;
        const n = ln.length;
        const segLen = (i) => len(sub(l.points[i + 1], l.points[i]));
        let i = 1;
        while (i < n - 1) {
          if (ln[i] === ln[i - 1]) { i++; continue; }
          let j = i, run = segLen(i);
          while (j + 1 < n - 1 && ln[j + 1] === ln[i] && run < maxLen) { j++; run += segLen(j); }
          if (j + 1 >= n) break;
          const before = ln[i - 1], after = ln[j + 1];
          const between = ln[i] > Math.min(before, after) && ln[i] < Math.max(before, after);
          if (run < maxLen && (before === after || between) && ln[j + 1] !== ln[i]) {
            const cands = before === after ? [before] : [after, before];
            for (const target of cands) {
              if (!runOk(l, i, j, target)) continue;
              setRun(l, ln, i, j, target);
              any = changed = true;
              break;
            }
          }
          i = j + 1;
        }
      }
      if (!any) break;
    }
    // 2) Смена полосы на ПРЯМОМ участке (обычно в станции, где соседи ушли)
    // рисуется маленькой ступенькой-«микро-зигзагом». Лучше свернуть на нужную
    // полосу сразу на ближайшем повороте: там смещённые линии просто
    // пересекаются. Переносим смену на поворот (назад или вперёд — что ближе),
    // если на этом пути полоса свободна и пучок не рвётся
    const bendAt = (l, v) => {
      const a = sub(l.points[v], l.points[v - 1]), b = sub(l.points[v + 1], l.points[v]);
      return Math.abs(cross(unit(a), unit(b))) > 0.02 || a.x * b.x + a.y * b.y < 0;
    };
    for (let pass = 0; pass < 4; pass++) {
      let any = false;
      for (const l of lines) {
        const ln = lanesMap.get(l.id);
        if (!ln) continue;
        const n = ln.length;
        const runLen = (a, b) => { let t = 0; for (let k = a; k <= b; k++) t += len(sub(l.points[k + 1], l.points[k])); return t; };
        for (let v = 1; v < n; v++) {
          if (ln[v - 1] === ln[v] || bendAt(l, v)) continue;
          let f = v + 1;
          while (f < n && !bendAt(l, f)) f++;
          let fwd = null, back = null;
          if (f < n) {
            let ok = true;
            for (let k = v; k < f && ok; k++) if (ln[k] !== ln[v]) ok = false;
            if (ok && runOk(l, v, f - 1, ln[v - 1])) fwd = { a: v, b: f - 1, to: ln[v - 1], d: runLen(v, f - 1) };
          }
          let b = v - 1;
          while (b >= 1 && !bendAt(l, b)) b--;
          if (b >= 1) {
            let ok = true;
            for (let k = b; k < v && ok; k++) if (ln[k] !== ln[v - 1]) ok = false;
            if (ok && runOk(l, b, v - 1, ln[v])) back = { a: b, b: v - 1, to: ln[v], d: runLen(b, v - 1) };
          }
          const pick = fwd && back ? (fwd.d <= back.d ? fwd : back) : fwd || back;
          if (pick) { setRun(l, ln, pick.a, pick.b, pick.to); any = changed = true; }
        }
      }
      if (!any) break;
    }
    // 3) Пучок перецентровывается в станции на прямой (одна линия ушла или
    // пришла — остальные сдвигаются на полполосы), и по одной линии это не
    // исправить: мешают соседки. Сдвигаем ВЕСЬ пучок по одну сторону от точки
    // (все линии коридора до их ближайшего поворота, включая примкнувшие) на
    // величину ступеньки; итог проверяем и откатываем, если появились
    // наложения или дыры
    const ptKey = (q) => q.x + "," + q.y;
    const jogsAt = new Map();
    for (const l of lines) {
      const ln = lanesMap.get(l.id);
      if (!ln) continue;
      for (let v = 1; v < ln.length; v++) {
        if (ln[v - 1] === ln[v] || bendAt(l, v)) continue;
        const k = ptKey(l.points[v]);
        if (!jogsAt.has(k)) jogsAt.set(k, []);
        jogsAt.get(k).push({ l, v });
      }
    }
    // В вершине v меняется состав пучка (на этом коридоре какая-то линия
    // начинается или кончается): сдвиг пучка дальше неё задел бы соседей,
    // поэтому пробег до поворота останавливается и здесь
    const compAt = (l, v, key) => {
      const Q = l.points[v], list = corr.get(key);
      if (!list) return false;
      const u = list[0].u, tQ = Q.x * u.x + Q.y * u.y;
      const at = (t) => [...new Set(list.filter((r) => r.t0 <= t && t <= r.t1).map((r) => r.o))].sort().join("|");
      return at(tQ - 0.5) !== at(tQ + 0.5);
    };
    const straightJogs = (l) => {
      const ln = lanesMap.get(l.id);
      let c = 0;
      for (let v = 1; v < ln.length; v++) if (ln[v - 1] !== ln[v] && !bendAt(l, v)) c++;
      return c;
    };
    for (const list of jogsAt.values()) {
      const P = list[0].l.points[list[0].v];
      // все ступеньки в точке — на одной прямой и одной величины (в общем кадре)
      const r0 = recsOf.get(list[0].l.id)[list[0].v];
      if (!r0) continue;
      const tP = P.x * r0.u.x + P.y * r0.u.y;
      const afterSign = Math.sign((r0.t0 + r0.t1) / 2 - tP);
      // ступенька = полоса «после» − «до», где «после» — сторона r0 (линии
      // могут идти через точку в разные стороны, порядок индексов разный)
      const deltas = list.map(({ l, v }) => {
        const recs = recsOf.get(l.id), ra = recs[v], rb = recs[v - 1];
        if (!ra || !rb || ra.key !== r0.key || rb.key !== r0.key) return null;
        const aAfter = Math.sign((ra.t0 + ra.t1) / 2 - tP) === afterSign;
        return R2(aAfter ? ra.c - rb.c : rb.c - ra.c);
      });
      if (deltas.some((d) => d == null || d !== deltas[0])) continue;
      const delta = deltas[0];
      for (const side of [1, -1]) {
        // side = 1: отрезки «после» ступеньки получают полосы «до» (c − delta);
        // side = −1: отрезки «до» получают полосы «после» (c + delta)
        const want = afterSign * side, d = side > 0 ? -delta : delta;
        const plan = [];
        let bad = false;
        for (const l of lines) {
          const ln = lanesMap.get(l.id);
          if (!ln || bad) continue;
          const recs = recsOf.get(l.id);
          for (let w = 0; w < l.points.length && !bad; w++) {
            if (l.points[w].x !== P.x || l.points[w].y !== P.y) continue;
            for (const [k, step] of [[w, 1], [w - 1, -1]]) {
              const rec = recs[k];
              if (!rec || rec.key !== r0.key || Math.sign((rec.t0 + rec.t1) / 2 - tP) !== want) continue;
              // пробег до ближайшего поворота линии, в сторону от P
              let a = k, b = k;
              // пробег до поворота (через другие ступеньки тоже — они сдвигаются
              // вместе и остаются, но принимаем сдвиг, только если ступенек
              // в итоге стало меньше)
              if (step > 0) {
                let f = k + 1;
                while (f < ln.length && !bendAt(l, f) && !compAt(l, f, r0.key)) f++;
                if (f >= ln.length) { bad = true; break; }
                b = f - 1;
              } else {
                let g = k;
                while (g >= 1 && !bendAt(l, g) && !compAt(l, g, r0.key)) g--;
                if (g < 1) { bad = true; break; }
                a = g;
              }
              plan.push({ l, ln, a, b, vals: ln.slice(a, b + 1) });
            }
          }
        }
        if (bad || !plan.length) continue;
        const touched = [...new Set(plan.map((x) => x.l))];
        const before = touched.reduce((t, l) => t + straightJogs(l), 0);
        for (const x of plan) {
          const recs = recsOf.get(x.l.id);
          for (let k = x.a; k <= x.b; k++) if (recs[k]) setRun(x.l, x.ln, k, k, R2((recs[k].c + d) * recs[k].sign));
        }
        const ok = plan.every((x) => {
          const recs = recsOf.get(x.l.id);
          for (let k = x.a; k <= x.b; k++) if (!laneOk(recs[k], x.ln[k])) return false;
          return true;
        });
        if (ok && touched.reduce((t, l) => t + straightJogs(l), 0) < before) { changed = true; break; }
        for (const x of plan) x.vals.forEach((val, t) => setRun(x.l, x.ln, x.a + t, x.a + t, val));
      }
    }
    if (changed) {
      for (const l of p.lines) {
        const ln = lanesMap.get(l.id);
        if (!ln) continue;
        // отрезок нулевой длины берёт полосу предыдущего настоящего
        const full = l.lanes.slice(), ix = keep.get(l.id);
        ix.forEach((i, j) => { full[i] = ln[j]; });
        for (let i = 0, last = null; i < full.length; i++) { if (ix.includes(i)) last = full[i]; else if (last != null) full[i] = last; }
        out.set(l.id, full);
      }
    }
    return out;
  }
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
    if (line.dash === "rail") {
      // железнодорожная: сплошные кромки по краям, пунктир посередине
      el("path", Object.assign({}, base, { stroke: line.color, "stroke-width": w * 1.4, "stroke-linecap": "butt", "stroke-linejoin": "round" }, extraAttrs), g);
      el("path", Object.assign({}, base, { stroke: p.style.bg, "stroke-width": w * 0.85, "stroke-linecap": "butt", "stroke-linejoin": "round" }), g);
      el("path", Object.assign({}, base, { stroke: line.color, "stroke-width": w * 0.85, "stroke-linecap": "butt", "stroke-linejoin": "round", "stroke-dasharray": `${w * 1.1} ${w * 0.9}` }), g);
      return;
    }
    const dash = line.dash === "dashdot" ? `${w * 2.2} ${w * 0.9} ${w * 0.5} ${w * 0.9}` : line.dash === "dashed" ? `${w * 1.8} ${w * 1.2}` : line.dash === "dotted" ? `0.1 ${w * 1.6}` : null;
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
  /**
   * Станцию не рисуют на повороте: если в вершине st ВСЕ её линии поворачивают
   * одинаково (одни и те же два плеча), значок сдвигается по длинному плечу на
   * конец скругления (+ запас на ширину линий) — там линия уже прямая.
   * На развилках и в конечных точках сдвига нет (там плечи разные).
   */
  function offBend(p, st, linesById, drawn) {
    const v = { x: st.x, y: st.y };
    if (drawn.transferStations.has(st.id)) return v;
    let arms = null, maxOff = 0, turn = 0;
    for (const id of st.lineIds) {
      const line = linesById.get(id);
      if (!line || line.points.length < 2) continue;
      const pts = line.points, k = vertexAt(pts, v);
      if (k <= 0 || k >= pts.length - 1) return v;
      const ua = unit(sub(pts[k - 1], v)), ub = unit(sub(pts[k + 1], v));
      if (Math.abs(cross(ua, ub)) < 1e-3) return v;
      const la = len(sub(pts[k - 1], v)), lb = len(sub(pts[k + 1], v));
      const cur = [{ u: ua, l: la }, { u: ub, l: lb }];
      // внешние полосы пучка огибают угол по дуге большего радиуса: их скругление
      // заканчивается дальше — значок должен стоять за ним
      maxOff = Math.max(maxOff, Math.abs(segOffset(p, line, k - 1)), Math.abs(segOffset(p, line, k)));
      turn = Math.acos(Math.max(-1, Math.min(1, -(ua.x * ub.x + ua.y * ub.y))));
      if (!arms) arms = cur;
      else {
        const same = (x, y) => Math.abs(x.u.x - y.u.x) < 1e-3 && Math.abs(x.u.y - y.u.y) < 1e-3;
        if (!((same(cur[0], arms[0]) && same(cur[1], arms[1])) || (same(cur[0], arms[1]) && same(cur[1], arms[0])))) return v;
        arms = [{ u: arms[0].u, l: Math.min(arms[0].l, cur[same(cur[0], arms[0]) ? 0 : 1].l) },
          { u: arms[1].u, l: Math.min(arms[1].l, cur[same(cur[0], arms[0]) ? 1 : 0].l) }];
      }
    }
    if (!arms) return v;
    const R = Math.min(p.style.cornerRadius, arms[0].l / 2, arms[1].l / 2);
    const arm = arms[0].l >= arms[1].l ? arms[0] : arms[1];
    const tn = Math.tan(turn / 2);
    const d = Math.min(R + (maxOff + p.style.lineWidth / 2) * Math.min(tn, 4) + p.style.lineWidth * 1.2, arm.l * 0.8);
    return { x: v.x + arm.u.x * d, y: v.y + arm.u.y * d };
  }

  function stationGeometry(p, st, linesById, drawn) {
    const here = offBend(p, st, linesById, drawn);
    const items = [];
    for (const id of st.lineIds) {
      const line = linesById.get(id);
      if (!line || line.points.length < 2) continue;
      const near = nearestOnPolyline(line.points, here);
      if (!near || near.dist > p.grid * 0.75) continue;
      items.push({ line, near, lanes: lanesOf(p, line) });
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
      // линия меняет полосу прямо в станции — значок должен прикрыть ступеньку
      it.jog = k > 0 && k < pts.length - 1 && !!it.lanes && (it.lanes[k - 1] || 0) !== (it.lanes[k] || 0);
      it.pts = segs.map((s) => {
        const n = leftNormal(unit(sub(pts[s + 1], pts[s])));
        const o = segOffset(p, it.line, s);
        // arm — куда уходит линия от станции по этому отрезку (null, если
        // станция не вершина линии и сторону не определить)
        const arm = k >= 0 ? unit(sub(s === k - 1 ? pts[k - 1] : pts[s + 1], pts[k])) : null;
        return { x: base.x + n.x * o, y: base.y + n.y * o, w, n, arm };
      });
      // плюс точка там, где линия реально нарисована (смещённая полилиния):
      // конец конечной линии стоит на своей полосе, а не в центре станции,
      // и значок должен его накрывать
      // (только если станция — вершина линии и точка не дальше её полосы:
      // иначе цеплялась соседняя ветка той же линии, и значок вытягивался)
      const op = k >= 0 && drawn.offsetPts && drawn.offsetPts.get(it.line.id);
      const dn = op && op.length > 1 ? nearestOnPolyline(op, here) : null;
      const oMax = Math.max(0, ...segs.map((s) => Math.abs(segOffset(p, it.line, s))));
      if (dn && dn.dist <= oMax + w) it.pts.push({ x: dn.point.x, y: dn.point.y, w, n: leftNormal(dn.dir) });
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
    return { c, items, dir, nrm, lo, hi, maxW, ends, offsetPts: drawn.offsetPts, inTransfer: drawn.transferStations.has(st.id), bare: !!(drawn.bareStations && drawn.bareStations.has(st.id)) };
  }

  // Авто: пересадка, конечная и развилка — скруглённый прямоугольник поперёк
  // пучка (размер зависит только от числа линий с каждой стороны, см. pillMetrics).
  // Обычная станция, где все линии идут вместе (одни и те же соседи по обе
  // стороны), — «пеньки»: у каждой линии свой, они накладываются друг на друга
  // Значок станции для каждого вида пересадки — и на одиночном узле (несколько
  // линий в одной станции), и на станциях объекта-пересадки (там к нему
  // добавляется переход, см. drawTransfer). Раньше несколько видов сводились
  // к одному значку (кольца / узел = круг, квадраты = капсула), и смена вида
  // почти ничего не меняла
  const NODE_STYLES = { capsule: "pill2", dumbbell: "ring", dumbbell2: "ring2", curve: "circ", dashed: "pilld", london: "ringw", moscow: "ringm", square: "ringq", hub: "hub", none: "stump" };
  function resolveStyle(st, geo, seq, minRun, mode, trMode) {
    // станция объекта-пересадки (capsule / hub рисуют её сами — "bare")
    if (trMode && st.style === "auto" && geo && geo.items.length && !OWN_MARKER_TRANSFERS.includes(trMode)) {
      const s = NODE_STYLES[trMode];
      return s && s !== "stump" ? s : "pill";
    }
    const r = resolveBase(st, geo, seq, minRun);
    // пересадочный узел из нескольких линий в ОДНОЙ станции: вид задаёт style.transferStyle
    if (r === "pill" && st.style === "auto" && geo && geo.items.length >= 2 && !geo.inTransfer && NODE_STYLES[mode]) {
      // пеньки — только на параллельном пучке: на развилке они торчат
      // обломками в разные стороны
      if (mode === "none" && !parallelBundle(geo)) return r;
      return NODE_STYLES[mode];
    }
    return r;
  }
  // все линии станции идут по одной оси (без поворотов и примыканий)
  function parallelBundle(geo) {
    const key = (q) => { const m = q.n || geo.nrm; return Math.round(((Math.atan2(m.y, m.x) * 180 / Math.PI) % 180 + 180) % 180); };
    const keys = new Set(geo.items.flatMap((it) => it.pts.map(key)).map((a) => a % 180));
    return keys.size <= 1;
  }
  function resolveBase(st, geo, seq, minRun) {
    if (st.style !== "auto") return st.style;
    if (geo && geo.bare) return "bare";
    if (!geo || geo.inTransfer || geo.ends.length || !geo.items.length) return "pill";
    let key = null;
    for (const it of geo.items) {
      // зигзаг / S-образный перегиб рядом: пенёк нужен на ровном участке, а не
      // между двумя изгибами — до ближайшего поворота в обе стороны должно быть
      // место на скругление
      if (!straightAround(it.line.points, geo.c, minRun, it.lanes)) return "pill";
      const ids = seq && seq.get(it.line.id);
      const k = ids ? ids.indexOf(st.id) : -1;
      if (k <= 0 || k >= ids.length - 1) return "pill";
      const nb = [ids[k - 1], ids[k + 1]].sort().join("|");
      if (key === null) key = nb; else if (key !== nb) return "pill";
    }
    return "stump";
  }

  // Длина ровного участка от точки c до ближайшего излома в обе стороны ≥ minRun
  function straightAround(pts, c, minRun, lanes) {
    const near = nearestOnPolyline(pts, c);
    if (!near) return false;
    // излом линии ИЛИ смена полосы (ступенька-«jog») тоже обрывают ровный участок
    const bend = (i) => Math.abs(cross(unit(sub(pts[i], pts[i - 1])), unit(sub(pts[i + 1], pts[i])))) > 1e-3
      || (lanes && (lanes[i - 1] || 0) !== (lanes[i] || 0));
    const n = pts.length;
    let fwd = len(sub(pts[near.seg + 1], c)), i = near.seg + 1;
    while (i < n - 1 && !bend(i)) { fwd += len(sub(pts[i + 1], pts[i])); i++; }
    let bwd = len(sub(c, pts[near.seg])); i = near.seg;
    while (i > 0 && !bend(i)) { bwd += len(sub(pts[i], pts[i - 1])); i--; }
    return Math.min(fwd, bwd) >= minRun;
  }

  // Порядок станций вдоль каждой линии (по положению на полилинии)
  function stationSequences(p, linesById) {
    const seq = new Map();
    for (const line of linesById.values()) {
      if (line.points.length < 2) continue;
      const list = [];
      for (const st of p.stations) {
        if (!st.lineIds.includes(line.id)) continue;
        const near = nearestOnPolyline(line.points, st);
        if (near && near.dist <= p.grid * 0.75) list.push({ id: st.id, pos: near.seg + near.t });
      }
      list.sort((a, b) => a.pos - b.pos);
      seq.set(line.id, list.map((q) => q.id));
    }
    return seq;
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
    // смещение — в общей (канонической) системе: в системе самой линии у
    // встречных направлений одного маршрута полосы +2.5 и −2.5 давали одно
    // и то же число, и значок не доставал до крайних линий пучка
    const off = (q) => { const qn = canon(q.n || n); return (q.x - c.x) * qn.x + (q.y - c.y) * qn.y; };
    const ext = (arr) => {
      let lo = Infinity, hi = -Infinity;
      for (const q of arr) { const o = off(q); lo = Math.min(lo, o - q.w / 2); hi = Math.max(hi, o + q.w / 2); }
      return { lo, hi };
    };
    const pad = geo.maxW * 0.6 * k, thin = geo.maxW * 0.9 * k;
    if (!simple) {
      // Т-образная / пересекающаяся станция: габарит — рамка вокруг ВСЕХ
      // точек полос в той из систем координат (оси линий и 0/90°), где
      // площадь рамки минимальна. Раньше брались «основное направление» и
      // «остальные» в системе каждой линии, и при трёх линиях в одну сторону
      // под разными углами и одной в другую выходила длинная косая палка
      const angs = new Set([0, 90]);
      for (const q of pts) {
        const mm = canon(q.n || n);
        angs.add(((Math.round(Math.atan2(mm.y, mm.x) * 180 / Math.PI) % 180) + 180) % 180);
      }
      let best = null;
      for (const a of angs) {
        const r = a * Math.PI / 180, u = { x: Math.cos(r), y: Math.sin(r) }, v = { x: -u.y, y: u.x };
        let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
        for (const q of pts) {
          const pu = (q.x - c.x) * u.x + (q.y - c.y) * u.y, pv = (q.x - c.x) * v.x + (q.y - c.y) * v.y, h = q.w / 2;
          u0 = Math.min(u0, pu - h); u1 = Math.max(u1, pu + h);
          v0 = Math.min(v0, pv - h); v1 = Math.max(v1, pv + h);
        }
        const minS = geo.items.some((it) => it.jog) ? geo.maxW * 1.4 * k : 0;
        const du = Math.max(minS, u1 - u0 + 2 * pad), dv = Math.max(thin, minS, v1 - v0 + 2 * pad);
        const score = du * dv * (a % 90 === 0 ? 1 : 1.15);
        if (!best || score < best.score) best = { a, u, v, u0, u1, v0, v1, du, dv, score };
      }
      const { a, u, v } = best;
      const tu = (best.u0 + best.u1) / 2, tv = (best.v0 + best.v1) / 2;
      const mid = { x: c.x + u.x * tu + v.x * tv, y: c.y + u.y * tu + v.y * tv };
      const half = best.du / 2, thick = best.dv;
      const rx = Math.min(thick / 2, half, Math.max(geo.maxW * 0.45 * k, Math.min(thick, half * 2) * 0.28));
      return { mid, half, thick, rx, rot: a, reach: len(sub(mid, c)) + Math.max(half, thick / 2) };
    }
    const m = canon(n), main = pts;
    const mainE = ext(main);
    const half = (mainE.hi - mainE.lo) / 2 + pad;
    // ступенька смены полосы в станции крутая, но с толщиной линии торчит на
    // ~0.65 толщины в обе стороны — такой значок делаем чуть толще
    const thick = geo.items.some((it) => it.jog) ? Math.max(thin, geo.maxW * 1.4 * k) : thin;
    const tMid = (mainE.lo + mainE.hi) / 2;
    const mid = { x: c.x + m.x * tMid, y: c.y + m.y * tMid };
    const rx = Math.min(thick / 2, half, Math.max(geo.maxW * 0.45 * k, Math.min(thick, half * 2) * 0.28));
    return { mid, half, thick, rx, rot: Math.atan2(m.y, m.x) * 180 / Math.PI, reach: len(sub(mid, c)) + Math.max(half, thick / 2) };
  }

  // Узел из кружков (гантель / кольца / квадраты): по кружку на каждую ВИДИМУЮ
  // линию станции, в порядке линий поперёк пучка. Кружок один на маршрут:
  // оба направления и ветки одного номера (line.group), а также линии,
  // нарисованные на одной полосе друг поверх друга, — один кружок (раньше
  // их сравнивали только по соседству после сортировки, и у линии, которая
  // в станции поворачивает, получалось два кружка).
  // Фигура всегда симметричная: кружки на равном шаге вокруг середины
  // пучка; если полосы стоят ровно и достаточно широко — каждый кружок точно
  // над своей линией. Если ряд кружков сильно вылезает за пучок, берётся
  // компактная раскладка: 3 — треугольник 2+1, 4 — квадрат 2×2, больше —
  // два ряда («соты» при нечётном числе, сетка при чётном). hull — контур
  // мостика под кружками.
  // small («гантель на линиях», ring2) — мелкие кружки размером с шаг полос,
  // всегда в один ряд и точно над своими линиями; разводятся на равный шаг,
  // только если линии сходятся в одну точку
  function ringMetrics(p, st, geo, small) {
    const k = stScale(p, st);
    const pm = pillMetrics(p, st, geo);
    const ra = pm.rot * Math.PI / 180, axis = { x: Math.cos(ra), y: Math.sin(ra) }, along = { x: -axis.y, y: axis.x };
    const c = pm.mid, pitch = pitchOf(p);
    const proj = (q) => (q.x - c.x) * axis.x + (q.y - c.y) * axis.y;
    const groups = new Map();
    for (const it of geo.items) {
      const pts = it.pts && it.pts.length ? it.pts : [geo.c];
      const key = it.line.group || it.line.id;
      if (!groups.has(key)) groups.set(key, { color: it.line.color, pts: [] });
      groups.get(key).pts.push(...pts);
    }
    // одна и та же линия, нарисованная дважды (тот же цвет на той же полосе
    // того же плеча) — один кружок; на развилке точки разных линий тоже
    // бывают рядом (на противоположных плечах одной оси) — это разные линии
    const ents = [...groups.values()];
    const sameArm = (q, w) => q.arm && w.arm && q.arm.x * w.arm.x + q.arm.y * w.arm.y > 0.9;
    const close = (u, v) => u.color === v.color && u.pts.some((q) => v.pts.some((w) => sameArm(q, w) && Math.hypot(q.x - w.x, q.y - w.y) < pitch * 0.45));
    for (let i = 0; i < ents.length; i++) {
      for (let j = i + 1; j < ents.length; j++) {
        if (!close(ents[i], ents[j])) continue;
        ents[i].pts.push(...ents[j].pts);
        ents.splice(j, 1);
        j = i;
      }
    }
    const lanes = ents.map((e) => ({ color: e.color, t: e.pts.reduce((a, q) => a + proj(q), 0) / e.pts.length })).sort((u, v) => u.t - v.t);
    if (!lanes.length) lanes.push({ color: p.style.stationStroke, t: 0 });
    const n = lanes.length;
    const ring = Math.max(1.8, geo.maxW * 0.4 * k);
    const rc = Math.max(1.5, pitch * 0.5) * k;
    const r = small ? rc + ring : geo.maxW * 0.6 * k + ring; // радиус кружка вместе с обводкой
    const t0 = lanes[0].t, t1 = lanes[n - 1].t, tc = (t0 + t1) / 2;
    const natural = n > 1 ? (t1 - t0) / (n - 1) : 0;
    const step = Math.max(natural, 2 * r + ring * 0.6);
    const even = n > 1 && lanes.every((q, i) => Math.abs(q.t - (t0 + i * natural)) < natural * 0.2);
    // ряд вылезает за пучок больше чем на ~0.6 радиуса с каждой стороны —
    // компактнее (треугольник / квадрат / два ряда)
    const overhang = ((n - 1) * step - (t1 - t0) + 2 * r - geo.maxW) / 2;
    const rows = small || n <= 2 || (n <= 4 && overhang <= r * 0.6) ? 1 : 2;
    const minGap = lanes.reduce((m, q, i) => (i ? Math.min(m, q.t - lanes[i - 1].t) : m), Infinity);
    const loc = lanes.map((q, i) => {
      if (small) return { u: minGap >= rc * 1.2 ? q.t : tc + (i - (n - 1) / 2) * rc * 1.8, v: 0 };
      if (rows === 1) return { u: even && natural >= step ? q.t : tc + (i - (n - 1) / 2) * step, v: 0 };
      if (n % 2) return { u: tc + (i - (n - 1) / 2) * step / 2, v: (i % 2 ? 0.5 : -0.5) * step * 0.866 };
      return { u: tc + (Math.floor(i / 2) - (n / 2 - 1) / 2) * step, v: (i % 2 ? 0.5 : -0.5) * step };
    });
    const at = (o) => ({ x: c.x + axis.x * o.u + along.x * o.v, y: c.y + axis.y * o.u + along.y * o.v });
    const dots = loc.map((o, i) => Object.assign(at(o), { color: lanes[i].color }));
    let hull;
    if (rows === 1) hull = n > 1 ? [loc[0], loc[n - 1]] : [];
    else {
      const top = loc.filter((o) => o.v < 0), bot = loc.filter((o) => o.v > 0);
      hull = [top[0], top[top.length - 1], bot[bot.length - 1], bot[0]];
    }
    const cc = at({ u: tc, v: 0 });
    const hw = Math.max(...loc.map((o) => Math.abs(o.u - tc))) + r;
    const hh = Math.max(...loc.map((o) => Math.abs(o.v))) + r;
    return { dots, hull: hull.map(at), r, ring, bw: r * 0.8, rot: pm.rot, cx: cc.x, cy: cc.y, hw, hh, rows };
  }

  // Круг, накрывающий весь пучок линий станции
  function circMetrics(p, st, geo) {
    const k = stScale(p, st), n = geo.nrm;
    const t = (geo.lo + geo.hi) / 2;
    const r = Math.max((geo.hi - geo.lo) / 2 + geo.maxW * 0.9 * k, geo.maxW * 1.4 * k);
    return { cx: geo.c.x + n.x * t, cy: geo.c.y + n.y * t, r };
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
    if (style === "circ" || style === "hub") {
      const cm = circMetrics(p, st, geo);
      box = { cx: cm.cx, cy: cm.cy, ca: 1, sa: 0, hw: cm.r, hh: cm.r, rx: cm.r };
    } else if (RING_STYLES.includes(style)) {
      const rg = ringMetrics(p, st, geo, style === "ring2");
      const ra = rg.rot * Math.PI / 180;
      box = { cx: rg.cx, cy: rg.cy, ca: Math.cos(ra), sa: Math.sin(ra), hw: rg.hw, hh: rg.hh, rx: rg.r };
    } else if (style === "pill" || style === "pill2" || style === "pilld") {
      const pm = pillMetrics(p, st, geo);
      const a = pm.rot * Math.PI / 180;
      box = { cx: pm.mid.x, cy: pm.mid.y, ca: Math.cos(a), sa: Math.sin(a), hw: pm.half, hh: pm.thick / 2, rx: pm.rx };
    } else if (style === "bare") {
      const r = geo.maxW * 1.4 * k;
      box = { cx: c.x, cy: c.y, ca: 1, sa: 0, hw: r, hh: r, rx: r };
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

  // Узел из кружков, раскладка — ringMetrics. kind:
  // ring  — «гантель»: кружки цвета линий в тёмной обводке, светлый мостик;
  // ring2 — «гантель на линиях»: то же мелкими кружками точно над линиями;
  // ringw — «белые кольца»: белые кружки с тёмным кольцом, тёмная перемычка;
  // ringm — «цветные кольца»: белые кружки с кольцом цвета линии, светлый мостик;
  // ringq — «квадраты»: как белые кольца, но скруглёнными квадратами
  function drawRingDots(g, p, rg, kind, ringW, fill, stroke) {
    fill = fill || p.style.stationFill;
    stroke = stroke || p.style.stationStroke;
    const ring = ringW != null ? ringW : rg.ring;
    const closed = rg.hull.length > 2;
    const d = rg.hull.length > 1 ? rg.hull.map((q, i) => `${i ? "L" : "M"}${q.x} ${q.y}`).join(" ") + (closed ? " Z" : "") : null;
    // plate = false: только перемычки по контуру (кольца / квадраты), без
    // сплошной тёмной заливки между рядами
    const bridge = (color, w, plate = true) => {
      if (d) el("path", { d, fill: closed && plate ? color : "none", stroke: color, "stroke-width": w, "stroke-linecap": "round", "stroke-linejoin": "round" }, g);
    };
    if (kind === "ring" || kind === "ring2" || kind === "ringm") {
      // тёмный контур мостика, поверх — светлая заливка
      bridge(stroke, rg.bw + ring * 2);
      bridge(fill, rg.bw);
    } else {
      bridge(stroke, rg.bw * 0.75, false);
    }
    if (kind === "ring2") {
      // мелкие кружки соприкасаются: сначала все тёмные подложки, потом все
      // цветные — иначе обводка следующего кружка резала предыдущий
      for (const q of rg.dots) el("circle", { cx: q.x, cy: q.y, r: rg.r, fill: stroke }, g);
      for (const q of rg.dots) el("circle", { cx: q.x, cy: q.y, r: Math.max(1, rg.r - ring), fill: q.color }, g);
      return;
    }
    for (const q of rg.dots) {
      if (kind === "ring") {
        el("circle", { cx: q.x, cy: q.y, r: rg.r, fill: stroke }, g);
        el("circle", { cx: q.x, cy: q.y, r: Math.max(1, rg.r - ring), fill: q.color }, g);
      } else if (kind === "ringm") {
        el("circle", { cx: q.x, cy: q.y, r: Math.max(1, rg.r - ring * 0.65), fill, stroke: q.color, "stroke-width": ring * 1.3 }, g);
      } else if (kind === "ringq") {
        const side = 2 * (rg.r - ring / 2) * 0.92;
        el("rect", {
          x: -side / 2, y: -side / 2, width: side, height: side, rx: side * 0.18, fill, stroke, "stroke-width": ring,
          transform: `translate(${q.x} ${q.y}) rotate(${rg.rot})`,
        }, g);
      } else {
        el("circle", { cx: q.x, cy: q.y, r: Math.max(1, rg.r - ring / 2), fill, stroke, "stroke-width": ring }, g);
      }
    }
  }

  // «Узел»: круг, разделённый на сектора цветов линий, с белой серединой
  function drawHub(g, cx, cy, R, colors, ring, fill, stroke) {
    el("circle", { cx, cy, r: R + ring / 2, fill: stroke }, g);
    if (colors.length <= 1) {
      el("circle", { cx, cy, r: R - ring / 2, fill: colors[0] || fill }, g);
    } else {
      colors.forEach((col, i) => {
        const a0 = -Math.PI / 2 + (i * 2 * Math.PI) / colors.length, a1 = -Math.PI / 2 + ((i + 1) * 2 * Math.PI) / colors.length;
        const rr = R - ring / 2, f2 = (v) => Math.round(v * 100) / 100;
        el("path", {
          d: `M${f2(cx)} ${f2(cy)} L${f2(cx + rr * Math.cos(a0))} ${f2(cy + rr * Math.sin(a0))} A${f2(rr)} ${f2(rr)} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${f2(cx + rr * Math.cos(a1))} ${f2(cy + rr * Math.sin(a1))} Z`,
          fill: col, stroke: fill, "stroke-width": Math.max(0.8, ring * 0.35), "stroke-linejoin": "round",
        }, g);
      });
    }
    el("circle", { cx, cy, r: R * 0.36, fill, stroke, "stroke-width": ring * 0.7 }, g);
  }
  const RING_STYLES = ["ring", "ring2", "ringw", "ringm", "ringq"];

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

    if (style === "bare") {
      // значок рисует сама пересадка (капсула / «гантель»)
      reach = geo.maxW * 1.4 * k;
    } else if (style === "circ") {
      const cm = circMetrics(p, st, geo);
      el("circle", { cx: cm.cx, cy: cm.cy, r: cm.r, fill, stroke, "stroke-width": sw != null ? sw : Math.max(2, geo.maxW * 0.4 * k) }, g);
      reach = Math.hypot(cm.cx - c.x, cm.cy - c.y) + cm.r;
    } else if (style === "hub") {
      const cm = circMetrics(p, st, geo);
      const colors = [...new Set(geo.items.map((it) => it.line.color))];
      drawHub(g, cm.cx, cm.cy, cm.r, colors, sw != null ? sw : Math.max(2, geo.maxW * 0.4 * k), fill, stroke);
      reach = Math.hypot(cm.cx - c.x, cm.cy - c.y) + cm.r;
    } else if (RING_STYLES.includes(style)) {
      const rg = ringMetrics(p, st, geo, style === "ring2");
      drawRingDots(g, p, rg, style, sw, st.fill, st.stroke);
      reach = Math.hypot(rg.cx - c.x, rg.cy - c.y) + Math.max(rg.hw, rg.hh);
    } else if (style === "pill" || style === "pill2" || style === "pilld") {
      const pm = pillMetrics(p, st, geo);
      el("rect", {
        x: -pm.half, y: -pm.thick / 2, width: pm.half * 2, height: pm.thick, rx: pm.rx,
        fill, stroke, "stroke-width": sw != null ? sw : Math.max(style === "pill2" ? 2.4 : 1.1, geo.maxW * (style === "pill2" ? 0.45 : 0.2) * k),
        "stroke-dasharray": style === "pilld" ? `${geo.maxW * 0.7 * k} ${geo.maxW * 0.5 * k}` : null,
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
    } else if (style === "stump") {
      // пенёк у каждой линии: от её полосы наружу, в сторону подписи; все пеньки
      // кончаются на одном краю и накладываются, дальняя от подписи линия — сверху
      const side = ld[0] * n.x + ld[1] * n.y >= 0 ? 1 : -1;
      const edge = side > 0 ? geo.hi : -geo.lo;
      const tick = geo.maxW * 0.92 * k; // вылет за край линии ≈ её толщина
      const items = geo.items.slice().sort((a, b) => side * (b.pos - a.pos));
      // Сначала места всех пеньков, потом длины: пенёк кончается на середине
      // между своей осью и осью соседней линии в сторону подписи — полоски
      // получаются одной толщины, и средняя линия не кажется тоньше крайних;
      // у самой ближней к подписи пенёк вылетает за край на ≈ толщину линии
      const placed = items.map((it) => {
        const th = lineWidthOf(p, it.line);
        // пенёк стоит там, где линия реально нарисована (на её смещённой полилинии),
        // а не на «идеальной» полосе: у границ изломов и ступенек они расходятся
        const guess = { x: c.x + n.x * it.pos, y: c.y + n.y * it.pos };
        const op = geo.offsetPts && geo.offsetPts.get(it.line.id);
        const near = op && op.length > 1 ? nearestOnPolyline(op, guess) : null;
        const q = near && near.dist <= th * 2 ? near.point : guess;
        return { it, th, q, d0: side * ((q.x - c.x) * n.x + (q.y - c.y) * n.y) };
      });
      // порядок — по реальному положению нарисованных линий (а не по расчётной
      // полосе pos): на ступеньках и изломах они расходятся, и тогда пенёк
      // «не находил соседа» и вылезал на всю длину поверх средней линии
      placed.sort((u, v) => v.d0 - u.d0);
      const lens = [];
      placed.forEach((pl, i) => {
        const cap = pl.th / 2 + pl.th * 0.92 * k;
        let tip = edge + tick, len = Math.min(tip - pl.d0, cap);
        const nxt = placed[i - 1];
        if (nxt) {
          const gap = nxt.d0 - pl.d0;
          if (gap <= 0.01) { len = lens[i - 1] + (nxt.d0 - pl.d0); }
          // соседняя линия рядом — пенёк перекрывает её ровно на её толщину
          // (до дальнего края); далеко (между ними проходит другая линия) —
          // не лезем через неё, только свою полосу и немного сверху
          else if (gap <= pitchOf(p) * 1.5) len = gap + nxt.th / 2;
          else len = pl.th / 2 + Math.min(pl.th * 0.5, gap / 2);
        }
        lens.push(len);
        el("rect", {
          x: 0, y: -pl.th / 2, width: Math.max(pl.th / 2 + 0.5, len), height: pl.th,
          fill: st.fill || pl.it.line.color,
          transform: `translate(${pl.q.x} ${pl.q.y}) rotate(${side > 0 ? ang : ang + 180})`,
        }, g);
      });
      reach = edge + tick;
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
    const ax = c.x + u.x * gap + (st.label.dx || 0), ay = c.y + u.y * gap + (st.label.dy || 0);
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
      ax, ay, anchor, baseY, angle, lines, size, lh, far: far || 0,
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
      class: "sc-label", "data-kind": "label", "data-id": st.id,
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
  // Отрезок a–b задевает прямоугольник box (по осям, hw/hh) — Лианг–Барски
  function segHitsBox(a, b, box, pad) {
    const x0 = box.cx - box.hw - pad, x1 = box.cx + box.hw + pad, y0 = box.cy - box.hh - pad, y1 = box.cy + box.hh + pad;
    let t0 = 0, t1 = 1;
    const dx = b.x - a.x, dy = b.y - a.y;
    for (const [pp, q] of [[-dx, a.x - x0], [dx, x1 - a.x], [-dy, a.y - y0], [dy, y1 - a.y]]) {
      if (pp === 0) { if (q < 0) return false; continue; }
      const r = q / pp;
      if (pp < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
    }
    return true;
  }

  /**
   * Блок номеров маршрутов на конечной. Сторона выбирается из четырёх
   * (наружу от конца линии, поперёк в обе стороны, внутрь) — первая, где
   * номера не ложатся на линии: раньше блок всегда шёл «наружу», и если
   * концы линий смотрели в разные стороны, он ложился поверх пучка и соседних
   * станций. st.badge: ручной сдвиг (перетаскивание) и «не показывать»
   */
  function layoutEndBadges(p, st, geo, mk, offsetPts) {
    const res = [];
    if (st.badge && st.badge.hide) return res;
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
    let out0 = unit({ x: ox, y: oy });
    if (!out0.x && !out0.y) out0 = geo.nrm;
    const h = size * 1.5;
    const ws = list.map((l) => badgeWidth(l.number, size));
    const c = geo.c;
    const place = (out) => {
      const r = [];
      const reach = Math.max(mk.reach(out), geo.maxW) + size * 0.5;
      const add = (x, y, l, w) => r.push({ x, y, line: l, size, stId: st.id, box: { cx: x, cy: y, ca: 1, sa: 0, hw: w / 2, hh: h / 2 } });
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
        const total = ws.reduce((sm, w) => sm + w, 0) + gap * (ws.length - 1);
        const cy = c.y + out.y * (reach + h / 2);
        const cx0 = c.x + out.x * (reach + h / 2);
        let x = cx0 - total / 2;
        list.forEach((l, i) => {
          add(x + ws[i] / 2, cy, l, ws[i]);
          x += ws[i] + gap;
        });
      }
      return r;
    };
    const hits = (r) => {
      if (!offsetPts) return 0;
      let n = 0;
      for (const line of p.lines) {
        const pts = offsetPts.get(line.id);
        if (!pts) continue;
        const pad = lineWidthOf(p, line) / 2 + 1;
        for (const b of r) {
          for (let i = 0; i + 1 < pts.length; i++) if (segHitsBox(pts[i], pts[i + 1], b.box, pad)) { n++; break; }
        }
      }
      return n;
    };
    const nrm = geo.nrm;
    const cands = [out0, nrm, { x: -nrm.x, y: -nrm.y }, { x: -out0.x, y: -out0.y }];
    // первая сторона без линий под номерами; если такой нет — где задето меньше
    let best = null;
    for (const o of cands) {
      const r = place(o), n = hits(r);
      if (!best || n < best.n) best = { n, r };
      if (!n) break;
    }
    const dx = (st.badge && st.badge.dx) || 0, dy = (st.badge && st.badge.dy) || 0;
    for (const b of best.r) { b.x += dx; b.y += dy; b.box.cx += dx; b.box.cy += dy; res.push(b); }
    return res;
  }

  function drawBadge(g, x, y, line, size, stId) {
    const label = line.number || "";
    if (!label) return;
    const h = size * 1.5;
    const w = badgeWidth(label, size);
    const bg = el("g", { class: "sc-badge", "data-kind": stId ? "badge" : null, "data-id": stId || null }, g);
    el("rect", { x: x - w / 2, y: y - h / 2, width: w, height: h, rx: h * 0.3, fill: line.color }, bg);
    const t = el("text", {
      x, y: y + size * 0.36, "text-anchor": "middle", "font-size": size, "font-weight": 700, fill: textColorOn(line.color),
    }, bg);
    t.textContent = label;
  }

  // Пересадка: способ обозначения (style.transferStyle или свой у каждой).
  // Значки станций рисуют сами станции (NODE_STYLES в resolveStyle), здесь —
  // только переход между ними, под значками:
  // bar — белая перемычка; capsule — толстая капсула с обводкой через все
  // станции (значки — сама капсула); dumbbell / moscow — светлый мостик в
  // тёмной обводке; london / square — тёмная перемычка; hub — один круг с
  // секторами цветов на всю пересадку; curve — тонкий изогнутый переход;
  // dashed — пунктирный переход; none — без соединения
  const transferStyleOf = (p, tr) => tr.style || p.style.transferStyle;
  function drawTransfer(g, p, tr, stById, anchors, geos) {
    const sts = tr.stationIds.map((id) => stById.get(id)).filter(Boolean);
    if (sts.length < 2) return;
    const mode = transferStyleOf(p, tr);
    if (mode === "none") return;
    // соединяем цепочкой ближайших соседей; точка станции — середина её значка
    const at = (s) => (anchors && anchors.get(s.id)) || s;
    const chain = [sts[0]];
    const rest = sts.slice(1);
    while (rest.length) {
      const lastSt = at(chain[chain.length - 1]);
      let bi = 0, bd = Infinity;
      rest.forEach((s, i) => { const q = at(s); const d = Math.hypot(q.x - lastSt.x, q.y - lastSt.y); if (d < bd) { bd = d; bi = i; } });
      chain.push(rest.splice(bi, 1)[0]);
    }
    const k = p.style.transferScale, lw = p.style.lineWidth;
    const stroke = p.style.stationStroke, fill = p.style.stationFill;
    const tg = el("g", { "data-kind": "transfer", "data-id": tr.id, class: "sc-transfer" }, g);
    const pts = chain.map(at);
    const straight = pts.map((q, i) => `${i ? "L" : "M"}${q.x} ${q.y}`).join(" ");
    const link = (color, w) => el("path", { d: straight, fill: "none", stroke: color, "stroke-width": w, "stroke-linecap": "round", "stroke-linejoin": "round" }, tg);
    if (mode === "capsule") {
      const w = lw * 2.4 * k, ring = Math.max(2, lw * 0.5);
      link(stroke, w);
      link(fill, Math.max(1, w - ring * 2));
    } else if (mode === "dumbbell" || mode === "dumbbell2" || mode === "moscow") {
      // ширина как у мостика внутри узла (ringMetrics: bw = 0.8 радиуса)
      const ring = Math.max(1.8, lw * 0.4 * k), bw = (lw * 0.6 * k + ring) * 0.8;
      link(stroke, bw + ring * 2);
      link(fill, bw);
    } else if (mode === "london" || mode === "square") {
      const ring = Math.max(1.8, lw * 0.4 * k);
      link(stroke, (lw * 0.6 * k + ring) * 0.8 * 0.75);
    } else if (mode === "hub") {
      // «Узел»: один круг на всю пересадку, разделённый на сектора цветов линий
      const geoList = chain.map((s) => geos && geos.get(s.id)).filter(Boolean);
      const cx = pts.reduce((a, q) => a + q.x, 0) / pts.length, cy = pts.reduce((a, q) => a + q.y, 0) / pts.length;
      const colors = [...new Set(geoList.flatMap((geo) => geo.items.map((it) => it.line.color)))];
      const ring = Math.max(2, lw * 0.4 * k);
      const R = Math.max(lw * 2.2 * k, ...geoList.map((geo) => Math.hypot(geo.c.x - cx, geo.c.y - cy) * 0.5 + lw * 1.2 * k));
      for (const q of pts) {
        el("path", { d: `M${q.x} ${q.y} L${cx} ${cy}`, fill: "none", stroke, "stroke-width": lw * 0.5 * k + ring, "stroke-linecap": "round" }, tg);
      }
      drawHub(tg, cx, cy, R, colors, ring, fill, stroke);
      for (const q of pts) el("circle", { cx: q.x, cy: q.y, r: Math.max(2, lw * 0.6 * k), fill, stroke, "stroke-width": Math.max(1.2, ring * 0.6) }, tg);
    } else if (mode === "curve" || mode === "dashed") {
      let d = straight;
      if (mode === "curve" && pts.length === 2) {
        const a = pts[0], b = pts[1];
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y;
        d = `M${a.x} ${a.y} Q${mx - dy * 0.22} ${my + dx * 0.22} ${b.x} ${b.y}`;
      }
      const w = Math.max(2, lw * 0.5 * k);
      el("path", { d, fill: "none", stroke: fill, "stroke-width": w + 3, "stroke-linecap": "round", opacity: 0.9 }, tg);
      el("path", { d, fill: "none", stroke, "stroke-width": w, "stroke-linecap": mode === "dashed" ? "butt" : "round", "stroke-dasharray": mode === "dashed" ? `${w * 1.6} ${w * 1.2}` : null }, tg);
    } else {
      const w = lw * 1.1 * k;
      el("path", { d: straight, fill: "none", stroke, "stroke-width": w + 2.5, "stroke-linecap": "round" }, tg);
      el("path", { d: straight, fill: "none", stroke: fill, "stroke-width": w, "stroke-linecap": "round" }, tg);
    }
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
    } else if (sh.type === "icon") {
      const size = Math.max(2, Math.min(sh.w, sh.h)), cx = sh.x + sh.w / 2, cy = sh.y + sh.h / 2;
      el("rect", { x: sh.x, y: sh.y, width: sh.w, height: sh.h, fill: "transparent" }, root);
      const col = sh.fill === "none" ? "#334155" : sh.fill;
      const plateCol = sh.plateColor || col;
      if (sh.img) {
        // свой значок: плашка (если есть) + картинка с сохранением пропорций
        let inner = size;
        if (sh.plate === "circle") { el("circle", { cx, cy, r: size / 2, fill: plateCol }, root); inner = size * 0.68; }
        else if (sh.plate === "square") { el("rect", { x: cx - size / 2, y: cy - size / 2, width: size, height: size, rx: size * 0.23, fill: plateCol }, root); inner = size * 0.68; }
        el("image", { href: sh.img, x: cx - inner / 2, y: cy - inner / 2, width: inner, height: inner, preserveAspectRatio: "xMidYMid meet" }, root);
      } else if (typeof MapIcons !== "undefined") {
        MapIcons.draw(root, sh.icon, sh.variant, cx, cy, size, { color: col, plate: sh.plate, plateColor: plateCol, bg: p.style.bg });
      }
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
    Object.defineProperty(p, "_pitch", { value: computePitch(p), writable: true, configurable: true, enumerable: false });
    Object.defineProperty(p, "_lanes", { value: smoothLanes(p), writable: true, configurable: true, enumerable: false });
    Object.defineProperty(p, "_gs", { value: new Map(), writable: true, configurable: true, enumerable: false });
    for (const l of p.lines) if (l.group) p._gs.set(l.id, groupSignOf(p, l));
    while (root.firstChild) root.removeChild(root.firstChild);
    root.setAttribute("font-family", FONT);
    const linesById = new Map(p.lines.map((l) => [l.id, l]));
    const stById = new Map(p.stations.map((s) => [s.id, s]));
    const transferStations = new Set(p.transfers.flatMap((t) => t.stationIds));
    const bareStations = new Set(p.transfers.filter((t) => OWN_MARKER_TRANSFERS.includes(transferStyleOf(p, t))).flatMap((t) => t.stationIds));
    // вид пересадки, в которую входит станция (её значок зависит от него)
    const trModeOf = new Map();
    for (const t of p.transfers) if (t.stationIds.length > 1) for (const id of t.stationIds) trModeOf.set(id, transferStyleOf(p, t));

    const gShapesBack = el("g", { class: "sc-shapes-back" }, root);
    const gLive = el("g", { class: "sc-live" }, root);
    const gGlow = el("g", { class: "sc-glow", "pointer-events": "none" }, root);
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
    const stKeys = new Set(p.stations.map((st) => st.x + "," + st.y));
    for (const line of p.lines) {
      if (line.points.length >= 2) offsetPts.set(line.id, offsetPolylineVar(line.points, lineOffsets(p, line), p.style.cornerRadius, stKeys, p.style.lineWidth * 0.15));
    }
    shareCornerRadii([...offsetPts.values()], p.style.cornerRadius, Math.max(p.style.lineWidth, p.style.cornerRadius * 0.35));
    const drawnPaths = new Set();
    for (const line of p.lines) {
      const pts = offsetPts.get(line.id);
      if (!pts) continue;
      const g = el("g", { "data-kind": "line", "data-id": line.id, class: "sc-line" }, gLines);
      const d = roundedPath(pts, p.style.cornerRadius);
      // слабая подсветка выделенной линии по краям (как у выделенных поездов
      // на табло): два полупрозрачных слоя разной ширины под самой линией
      if (opts.highlight && opts.highlight.has(line.id)) {
        const gw = lineWidthOf(p, line);
        const hb = { d, fill: "none", stroke: "#38bdf8", "stroke-linecap": "round", "stroke-linejoin": "round" };
        el("path", Object.assign({}, hb, { "stroke-width": gw + 7, "stroke-opacity": 0.18 }), gGlow);
        el("path", Object.assign({}, hb, { "stroke-width": gw + 3.5, "stroke-opacity": 0.38 }), gGlow);
      }
      // широкая прозрачная зона попадания
      el("path", { d, fill: "none", stroke: "transparent", "stroke-width": lineWidthOf(p, line) + 10, "stroke-linecap": "round" }, g);
      // объединённые линии с одной трассой рисуются один раз, без слоёв друг на друге
      const dup = line.group ? line.group + "|" + line.color + "|" + line.width + "|" + line.dash + "|" + d : "";
      if (!dup || !drawnPaths.has(dup)) drawLinePath(g, p, line, pts);
      if (dup) drawnPaths.add(dup);
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

    const drawn = { transferStations, offsetPts, bareStations };
    const geos = new Map();
    const entries = [];
    const seqs = stationSequences(p, linesById);
    for (const st of p.stations) {
      const geo = stationGeometry(p, st, linesById, drawn);
      geos.set(st.id, geo);
      const style = resolveStyle(st, geo, seqs, p.style.cornerRadius * 1.3, st.transferStyle || p.style.transferStyle, trModeOf.get(st.id));
      entries.push({ st, geo, style, mk: markerBox(p, st, geo, style) });
    }
    const badges = new Map();
    for (const e of entries) if (e.geo.ends.length) badges.set(e.st.id, layoutEndBadges(p, e.st, e.geo, e.mk, offsetPts));
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
      const pass = style === "stump" || style === "tick" ? [] : (st.passLineIds || []).filter((lid) => offsetPts.has(lid) && linesById.has(lid));
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
      for (const b of badges.get(st.id) || []) drawBadge(gBadges, b.x, b.y, b.line, b.size, st.id);
      if (live && live.conflictStations && st.mtrStationId && live.conflictStations.has(st.mtrStationId)) {
        const cg = el("g", { "data-kind": "station", "data-id": st.id, class: "sc-live-conflict" }, gLive);
        el("circle", { cx: geo.c.x, cy: geo.c.y, r: geo.maxW * 2.4, fill: "#ef4444", "fill-opacity": 0.22, stroke: "#ef4444", "stroke-width": 2 }, cg);
        el("title", null, cg).textContent = `⚠ ${live.conflictStations.get(st.mtrStationId)}`;
      }
    });
    const anchors = new Map(entries.map((e) => [e.st.id, { x: e.mk.box.cx, y: e.mk.box.cy }]));
    for (const tr of p.transfers) drawTransfer(gTransfers, p, tr, stById, anchors, geos);
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
    VERSION, NS, STATION_STYLES, TRANSFER_STYLES, LABEL_POS, LABEL_ANGLES, DASHES, SHAPE_DASHES, SHAPE_TYPES, DIRS,
    normalize, emptyProject, toPublished, fromPublished,
    render, bounds, toSvgElement, toSvgString, toPngBlob,
    nearestOnPolyline, offsetPolylineVar, smoothLanes, shareCornerRadii, roundedPath, computePitch, visibleProject, vertexDisplayPoints, el, normalizeShape, shapeBox,
  };
})();

if (typeof window !== "undefined") window.SchemeCore = SchemeCore;
