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
  const LANE_GAP = 1.5;
  const CORNER_R = 18;
  const FONT = '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  const DASHES = ["solid", "dashed", "dotted", "double"];
  const STATION_STYLES = ["auto", "tick", "circle", "pill"];
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
      },
      lines: (Array.isArray(src.lines) ? src.lines : []).slice(0, 2000).map((l) => {
        const line = {
          id: str(l.id, 80) || "line-" + Math.random().toString(36).slice(2, 9),
          name: str(l.name),
          number: str(l.number, 24),
          color: color(l.color, "#6366f1"),
          width: l.width == null || l.width === "" ? null : Math.max(1, Math.min(30, num(l.width, 6))),
          dash: oneOf(l.dash, DASHES, "solid"),
          offset: Math.max(-8, Math.min(8, Math.round(num(l.offset, 0)))),
          points: (Array.isArray(l.points) ? l.points : []).slice(0, 5000).map(pt),
        };
        // полосы по отрезкам (генератор): длина = points − 1, шаг 0.5
        if (Array.isArray(l.lanes) && l.lanes.length === line.points.length - 1) {
          line.lanes = l.lanes.map((v) => Math.max(-8, Math.min(8, Math.round(num(v, 0) * 2) / 2)));
        }
        if (l.mtrRouteIds) line.mtrRouteIds = idList(l.mtrRouteIds);
        if (l.mtrStationIds) line.mtrStationIds = idList(l.mtrStationIds);
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
    }
    return p;
  }

  // ------------------------------------------------------------
  // Публикация: компактная форма для ссылки (без служебных полей MTR)
  // ------------------------------------------------------------
  function toPublished(p) {
    const r = (v) => Math.round(v);
    return {
      v: VERSION,
      t: p.title,
      s: [p.style.lineWidth, p.style.labelSize, p.style.bg, p.style.labelColor],
      l: p.lines.map((l) => [l.id, l.name, l.number, l.color, l.width, l.dash, l.offset, l.points.flatMap((q) => [r(q.x), r(q.y)]), l.lanes || null]),
      st: p.stations.map((s) => [s.id, s.name, s.sub, r(s.x), r(s.y), s.style, s.label.pos, s.label.angle, s.lineIds]),
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
      style: { lineWidth: s[0], labelSize: s[1], bg: s[2], labelColor: s[3] },
      lines: arr(c.l).map((l) => {
        l = arr(l);
        const flat = arr(l[7]);
        const points = [];
        for (let i = 0; i + 1 < flat.length; i += 2) points.push({ x: flat[i], y: flat[i + 1] });
        return { id: l[0], name: l[1], number: l[2], color: l[3], width: l[4], dash: l[5], offset: l[6], points, lanes: l[8] };
      }),
      stations: arr(c.st).map((x) => {
        x = arr(x);
        return { id: x[0], name: x[1], sub: x[2], x: x[3], y: x[4], style: x[5], label: { pos: x[6], angle: x[7] }, lineIds: x[8] };
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
   */
  function offsetPolylineVar(ptsIn, offsIn) {
    // нулевые отрезки выкидываем вместе с их смещениями
    const pts = [], offs = [];
    ptsIn.forEach((p, i) => {
      if (pts.length && pts[pts.length - 1].x === p.x && pts[pts.length - 1].y === p.y) return;
      if (pts.length) offs.push(offsIn[i - 1] || 0);
      pts.push(p);
    });
    if (pts.length < 2) return pts.map((p) => ({ x: p.x, y: p.y }));
    const n = pts.length - 1;
    const dir = [], nrm = [], segLen = [];
    for (let i = 0; i < n; i++) {
      const d = sub(pts[i + 1], pts[i]);
      segLen.push(len(d));
      dir.push(unit(d));
      nrm.push(leftNormal(dir[i]));
    }
    const at = (p, i, o) => ({ x: p.x + nrm[i].x * o, y: p.y + nrm[i].y * o });
    const out = [at(pts[0], 0, offs[0])];
    for (let j = 1; j < n; j++) {
      const o1 = offs[j - 1], o2 = offs[j];
      const v = pts[j];
      if (!o1 && !o2) { out.push({ x: v.x, y: v.y }); continue; }
      const c = cross(dir[j - 1], dir[j]);
      const dot = dir[j - 1].x * dir[j].x + dir[j - 1].y * dir[j].y;
      if (Math.abs(c) < 1e-6) {
        if (dot > 0 && o1 !== o2) {
          // смена полосы на прямой — косой переход
          const t = Math.min(Math.abs(o2 - o1), segLen[j - 1] / 2, segLen[j] / 2);
          const a = at(v, j - 1, o1), b = at(v, j, o2);
          out.push({ x: a.x - dir[j].x * t, y: a.y - dir[j].y * t }, { x: b.x + dir[j].x * t, y: b.y + dir[j].y * t });
        } else if (dot > 0) {
          out.push(at(v, j, o2));
        } else {
          out.push(at(v, j - 1, o1), at(v, j, o2));
        }
        continue;
      }
      const A = at(v, j - 1, o1), B = at(v, j, o2);
      const s = cross(sub(B, A), dir[j]) / c;
      const X = { x: A.x + dir[j - 1].x * s, y: A.y + dir[j - 1].y * s };
      if (len(sub(X, v)) > 4 * Math.max(Math.abs(o1), Math.abs(o2)) + 1) out.push(A, B);
      else out.push(X);
    }
    out.push(at(pts[n], n - 1, offs[n - 1]));
    return out;
  }

  function roundedPath(pts, r) {
    if (pts.length < 2) return "";
    const f = (v) => Math.round(v * 100) / 100;
    let d = `M${f(pts[0].x)} ${f(pts[0].y)}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const a = pts[i - 1], v = pts[i], b = pts[i + 1];
      const la = len(sub(a, v)), lb = len(sub(b, v));
      const rr = Math.min(r, la / 2, lb / 2);
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
  const segOffset = (p, l, i) => (((l.lanes && l.lanes[i]) || 0) + (l.offset || 0)) * (lineWidthOf(p, l) + LANE_GAP);
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
    const d = roundedPath(pts, CORNER_R);
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
  function cornerShift(pts, k) {
    if (k <= 0 || k >= pts.length - 1) return { x: 0, y: 0 };
    const a = pts[k - 1], v = pts[k], b = pts[k + 1];
    const ua = unit(sub(a, v)), ub = unit(sub(b, v));
    if (Math.abs(cross(ua, ub)) < 1e-6) return { x: 0, y: 0 };
    const rr = Math.min(CORNER_R, len(sub(a, v)) / 2, len(sub(b, v)) / 2);
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
        const sh = cornerShift(pts, k);
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
      const sh = cornerShift(pts, k);
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

  function resolveStyle(st, geo) {
    if (st.style !== "auto") return st.style;
    if (geo.items.length > 1 || geo.inTransfer) return "pill";
    if (geo.ends.length) return "circle";
    return "tick";
  }

  function labelDir(st, geo) {
    if (st.label.pos !== "auto") return DIRS[st.label.pos];
    // перпендикулярно линии, предпочитая верх/право
    let n = geo.nrm;
    if (n.y > 0.01 || (Math.abs(n.y) <= 0.01 && n.x < 0)) n = { x: -n.x, y: -n.y };
    return [Math.round(n.x), Math.round(n.y)];
  }

  function drawStation(gMarks, gLabels, p, st, geo) {
    const style = resolveStyle(st, geo);
    const c = geo.c;
    const n = geo.nrm;
    const ang = Math.atan2(n.y, n.x) * 180 / Math.PI;
    const g = el("g", { "data-kind": "station", "data-id": st.id, class: "sc-station" }, gMarks);
    const primary = geo.items[0];
    const lineColor = primary ? primary.line.color : "#64748b";
    let reach = Math.max(Math.abs(geo.lo), Math.abs(geo.hi));

    if (style === "pill") {
      // Одна капсула поперёк ОСНОВНОГО пучка (направление с наибольшим
      // числом полос), расширенная так, чтобы накрыть и полосы примыкающих
      // под углом линий: на Т-образных и угловых станциях овал становится
      // шире, а не поворачивается по диагонали и не раздувается в круг.
      const pts = geo.items.flatMap((it) => it.pts);
      if (!pts.length) pts.push({ x: c.x, y: c.y, w: geo.maxW, n });
      const canon = (m) => (m.x < -1e-6 || (Math.abs(m.x) <= 1e-6 && m.y < 0) ? { x: -m.x, y: -m.y } : m);
      const axisKey = (v) => { const m = canon(v); return Math.round(Math.atan2(m.y, m.x) * 8 / Math.PI); };
      // все линии идут одинаково (прямо или вместе поворачивают) — обычная
      // капсула поперёк пучка (на повороте — по биссектрисе)
      const sig = (it) => [...new Set(it.pts.map((q) => axisKey(q.n || n)))].sort().join(",");
      const simple = geo.items.length && geo.items.every((it) => sig(it) === sig(geo.items[0]));
      const groups = new Map();
      for (const q of pts) {
        const k = axisKey(q.n || n);
        if (!groups.has(k)) groups.set(k, { m: canon(q.n || n), count: 0 });
        groups.get(k).count++;
      }
      const m = simple ? n : [...groups.values()].sort((a, b) => b.count - a.count)[0].m;
      const along = { x: -m.y, y: m.x };
      let tLo = Infinity, tHi = -Infinity, sLo = Infinity, sHi = -Infinity;
      for (const q of pts) {
        const t = (q.x - c.x) * m.x + (q.y - c.y) * m.y;
        const s = (q.x - c.x) * along.x + (q.y - c.y) * along.y;
        tLo = Math.min(tLo, t - q.w / 2); tHi = Math.max(tHi, t + q.w / 2);
        // вдоль основного направления полосы основного пучка — точки, а
        // примыкающие под углом занимают свою ширину
        const crossing = !simple && Math.abs((q.n || m).x * m.x + (q.n || m).y * m.y) < 0.9;
        sLo = Math.min(sLo, s - (crossing ? q.w / 2 : 0)); sHi = Math.max(sHi, s + (crossing ? q.w / 2 : 0));
      }
      const pad = geo.maxW * 0.55;
      const half = (tHi - tLo) / 2 + pad;
      const thick = Math.max(geo.maxW * 1.7, sHi - sLo + pad * 2);
      const mid = { x: c.x + m.x * (tLo + tHi) / 2 + along.x * (sLo + sHi) / 2, y: c.y + m.y * (tLo + tHi) / 2 + along.y * (sLo + sHi) / 2 };
      el("rect", {
        x: -half, y: -thick / 2, width: half * 2, height: thick, rx: Math.min(thick, half * 2) / 2,
        fill: "#ffffff", stroke: "#111827", "stroke-width": Math.max(1.2, geo.maxW * 0.28),
        transform: `translate(${mid.x} ${mid.y}) rotate(${Math.atan2(m.y, m.x) * 180 / Math.PI})`,
      }, g);
      reach = len(sub(mid, c)) + Math.max(half, thick / 2);
    } else if (style === "circle") {
      const pos = primary ? primary.pos : 0;
      const r = geo.maxW * 0.95;
      el("circle", {
        cx: c.x + n.x * pos, cy: c.y + n.y * pos, r,
        fill: "#ffffff", stroke: lineColor, "stroke-width": Math.max(1.2, geo.maxW * 0.45),
      }, g);
      reach = Math.abs(pos) + r;
    } else {
      // засечка наружу, в сторону подписи
      const ld = labelDir(st, geo);
      const side = ld[0] * n.x + ld[1] * n.y >= 0 ? 1 : -1;
      const from = side > 0 ? geo.hi : -geo.lo;
      const tick = geo.maxW * 0.95;
      el("rect", {
        x: from - 0.5, y: -geo.maxW * 0.45, width: tick + 0.5, height: geo.maxW * 0.9,
        fill: lineColor,
        transform: `translate(${c.x} ${c.y}) rotate(${side > 0 ? ang : ang + 180})`,
      }, g);
      reach = from + tick;
    }
    // невидимая зона попадания для мыши
    el("circle", { cx: c.x, cy: c.y, r: Math.max(8, reach + 2), fill: "transparent" }, g);

    // Подпись
    if (!st.name && !st.sub) return;
    const ld = labelDir(st, geo);
    const dl = Math.hypot(ld[0], ld[1]) || 1;
    const gap = reach + 5;
    const ax = c.x + (ld[0] / dl) * gap, ay = c.y + (ld[1] / dl) * gap;
    const size = p.style.labelSize;
    const lines = [st.name, st.sub].filter(Boolean);
    const lh = size * 1.15;
    const anchor = st.label.angle !== 0 ? (ld[0] < 0 ? "end" : "start") : ld[0] > 0 ? "start" : ld[0] < 0 ? "end" : "middle";
    // вертикально: блок над/под/по центру точки привязки
    const blockH = lh * (lines.length - 1);
    const baseY = ld[1] < 0 ? -blockH - size * 0.25 : ld[1] > 0 ? size * 0.8 : size * 0.35 - blockH / 2;
    const tg = el("g", {
      class: "sc-label", "data-kind": "station", "data-id": st.id,
      transform: `translate(${ax} ${ay})${st.label.angle ? ` rotate(${st.label.angle})` : ""}`,
    }, gLabels);
    lines.forEach((txt, i) => {
      const isSub = i === 1;
      const t = el("text", {
        x: 0, y: baseY + lh * i,
        "text-anchor": anchor,
        "font-size": isSub ? size * 0.85 : size,
        "font-weight": isSub ? 400 : 600,
        fill: isSub ? "#6b7280" : p.style.labelColor,
        stroke: p.style.bg, "stroke-width": Math.max(2, size * 0.25), "paint-order": "stroke",
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
   * поперёк, по центру под/над станцией.
   */
  function drawEndBadges(g, p, st, geo) {
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
    if (!list.length) return;
    let out = unit({ x: ox, y: oy });
    if (!out.x && !out.y) out = geo.nrm;
    const h = size * 1.5;
    const ws = list.map((l) => badgeWidth(l.number, size));
    const c = geo.c;
    const reach = Math.max(Math.abs(geo.lo), Math.abs(geo.hi), geo.maxW) + size;
    if (Math.abs(out.x) >= Math.abs(out.y)) {
      // ряд вдоль линии наружу
      let d = reach;
      list.forEach((l, i) => {
        d += ws[i] / 2;
        drawBadge(g, c.x + out.x * d, c.y + out.y * d, l, size);
        d += ws[i] / 2 + gap;
      });
    } else {
      // ряд поперёк, по центру
      const total = ws.reduce((s, w) => s + w, 0) + gap * (ws.length - 1);
      const cy = c.y + out.y * (reach + h / 2);
      const cx0 = c.x + out.x * (reach + h / 2);
      let x = cx0 - total / 2;
      list.forEach((l, i) => {
        drawBadge(g, x + ws[i] / 2, cy, l, size);
        x += ws[i] + gap;
      });
    }
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
    const w = p.style.lineWidth * 1.4;
    const tg = el("g", { "data-kind": "transfer", "data-id": tr.id, class: "sc-transfer" }, g);
    el("path", { d, fill: "none", stroke: "#111827", "stroke-width": w + 3, "stroke-linecap": "round" }, tg);
    el("path", { d, fill: "none", stroke: "#ffffff", "stroke-width": w, "stroke-linecap": "round" }, tg);
  }

  function drawLegend(g, p) {
    if (!p.legend.show) return;
    const rows = p.lines.filter((l) => l.points.length >= 2);
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
      if (l.number) {
        drawBadge(lg, x + Math.max(size * 1.5, l.number.length * size * 0.62 + size * 0.8) / 2, cy, l, size * 0.8);
        x += Math.max(size * 1.5, l.number.length * size * 0.62 + size * 0.8) + size * 0.5;
      }
      const t = el("text", { x, y: cy + size * 0.35, "font-size": size, fill: "#111827" }, lg);
      t.textContent = l.name || "";
      maxW = Math.max(maxW, x + (l.name || "").length * size * 0.56 + pad);
      y += rowH;
    }
    box.setAttribute("width", String(maxW));
    box.setAttribute("height", String(y + pad * 0.5));
  }

  /**
   * Рисует схему в группу root (очищает её). opts.live — живые данные
   * (только редактор): { conflictStations: Map(mtrStationId→count),
   * delayedRoutes: Map(routeId→ms) }. Возвращает индекс для редактора.
   */
  function render(root, p, opts) {
    opts = opts || {};
    while (root.firstChild) root.removeChild(root.firstChild);
    root.setAttribute("font-family", FONT);
    const linesById = new Map(p.lines.map((l) => [l.id, l]));
    const stById = new Map(p.stations.map((s) => [s.id, s]));
    const transferStations = new Set(p.transfers.flatMap((t) => t.stationIds));

    const gLive = el("g", { class: "sc-live" }, root);
    const gLines = el("g", { class: "sc-lines" }, root);
    const gTransfers = el("g", { class: "sc-transfers" }, root);
    const gMarks = el("g", { class: "sc-stations" }, root);
    const gBadges = el("g", { class: "sc-badges" }, root);
    const gLabels = el("g", { class: "sc-labels" }, root);
    const gLegend = el("g", { class: "sc-legend-layer" }, root);

    const live = opts.live || null;
    const offsetPts = new Map();
    for (const line of p.lines) {
      if (line.points.length < 2) continue;
      const pts = offsetPolylineVar(line.points, lineOffsets(p, line));
      offsetPts.set(line.id, pts);
      const g = el("g", { "data-kind": "line", "data-id": line.id, class: "sc-line" }, gLines);
      // широкая прозрачная зона попадания
      el("path", { d: roundedPath(pts, CORNER_R), fill: "none", stroke: "transparent", "stroke-width": lineWidthOf(p, line) + 10, "stroke-linecap": "round" }, g);
      drawLinePath(g, p, line, pts);
      if (live && live.delayedRoutes && (line.mtrRouteIds || []).some((r) => live.delayedRoutes.has(r))) {
        const ms = Math.max(...line.mtrRouteIds.map((r) => live.delayedRoutes.get(r) || 0));
        const lg = el("g", { "data-kind": "line", "data-id": line.id }, gLive);
        el("path", {
          d: roundedPath(pts, CORNER_R), fill: "none", stroke: "#ef4444", "stroke-opacity": 0.35,
          "stroke-width": lineWidthOf(p, line) + 10, "stroke-linecap": "round", "stroke-linejoin": "round",
          class: "sc-live-delay",
        }, lg);
        el("title", null, lg).textContent = `+${Math.round(ms / 60000)} min`;
      }
    }

    for (const tr of p.transfers) drawTransfer(gTransfers, p, tr, stById);

    const drawn = { transferStations };
    const geos = new Map();
    for (const st of p.stations) {
      const geo = stationGeometry(p, st, linesById, drawn);
      geos.set(st.id, geo);
      drawStation(gMarks, gLabels, p, st, geo);
      if (geo.ends.length) drawEndBadges(gBadges, p, st, geo);
      if (live && live.conflictStations && st.mtrStationId && live.conflictStations.has(st.mtrStationId)) {
        const cg = el("g", { "data-kind": "station", "data-id": st.id, class: "sc-live-conflict" }, gLive);
        el("circle", { cx: st.x, cy: st.y, r: geo.maxW * 2.4, fill: "#ef4444", "fill-opacity": 0.22, stroke: "#ef4444", "stroke-width": 2 }, cg);
        el("title", null, cg).textContent = `⚠ ${live.conflictStations.get(st.mtrStationId)}`;
      }
    }
    drawLegend(gLegend, p);
    return { geos, offsetPts };
  }

  // Габариты содержимого (для «вписать в экран» и экспорта)
  function bounds(p) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const add = (x, y) => { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; };
    p.stations.forEach((s) => add(s.x, s.y));
    p.lines.forEach((l) => l.points.forEach((q) => add(q.x, q.y)));
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
    VERSION, NS, STATION_STYLES, LABEL_POS, LABEL_ANGLES, DASHES,
    normalize, emptyProject, toPublished, fromPublished,
    render, bounds, toSvgElement, toSvgString, toPngBlob,
    nearestOnPolyline, offsetPolylineVar, vertexDisplayPoints, el,
  };
})();

if (typeof window !== "undefined") window.SchemeCore = SchemeCore;
