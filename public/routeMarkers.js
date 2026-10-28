// Метки маршрутов: цветная фигура с номером или значком внутри, своя для каждого типа
// транспорта (Настройки → «Метки маршрутов», settings.routeMarkers). Чистый модуль без
// зависимостей от app.js: конфиг и номер маршрута передаются в html().
// По умолчанию — кружок без содержимого, то есть прежний вид «цветная точка».
(function () {
  const SHAPES = ["circle", "parallelogram", "plaque", "capsule", "square", "diamond", "hexagon", "triangle"];

  // Значки 24×24, рисуются обводкой currentColor (цвет текста метки — контрастный к цвету маршрута)
  const ICONS = {
    train: "M7 3h10a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z M4 11h16 M8 14.5h.01 M16 14.5h.01 M8 21l2-3 M16 21l-2-3",
    metro: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M8 16V8l4 5 4-5v8",
    tram: "M9 2.5h6 M12 2.5V6 M7 6h10a2 2 0 0 1 2 2v8a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V8a2 2 0 0 1 2-2z M5 12h14 M9 21.5l1.5-2.5 M15 21.5l-1.5-2.5",
    bus: "M6 3h12a2 2 0 0 1 2 2v12H4V5a2 2 0 0 1 2-2z M4 11h16 M7 20.5V17 M17 20.5V17 M8 14h.01 M16 14h.01",
    cable: "M3 3.5l18 5 M12 6v4 M7 10h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2z M5 15h14",
    ship: "M3 16.5l2.5 4h13l2.5-4z M5 16.5V11h14v5.5 M9 11V7h6v4 M12 3v4",
    plane: "M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z",
    fast: "M2.5 15.5c3-6.5 8.5-8.5 16.5-8.5a2 2 0 0 1 2 2v4.5a2 2 0 0 1-2 2z M6 19.5h14 M13.5 10.5h4",
  };
  const CONTENTS = ["none", "number"].concat(Object.keys(ICONS).map((k) => "icon:" + k));
  const DEFAULT = { shape: "circle", content: "none" };

  // Стандартные типы MTR и те, что встречаются на серверах; порядок — для списка в настройках
  const KNOWN_TYPES = [
    "train_normal", "train_light_rail", "train_high_speed", "train_metro", "train_tram", "train_bus",
    "cable_car_normal", "boat_normal", "boat_light_rail", "boat_high_speed", "airplane_normal",
  ];

  // def — умолчание для типов без своей настройки (новый интерфейс рисует параллелограмм с номером)
  function configFor(cfg, type, def) {
    const c = (cfg && type && cfg[type]) || {};
    const d = def && SHAPES.includes(def.shape) && CONTENTS.includes(def.content) ? def : DEFAULT;
    return {
      shape: SHAPES.includes(c.shape) ? c.shape : d.shape,
      content: CONTENTS.includes(c.content) ? c.content : d.content,
    };
  }

  // Цвет маршрута приходит с сервера MTR — пропускаем только #hex
  function safeColor(color) {
    return /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(String(color || "")) ? color : "#8b8f9a";
  }

  // Текст/значок внутри: светлый на тёмном цвете маршрута, тёмный на светлом
  function inkFor(hex) {
    let h = hex.slice(1);
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const ch = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
    const lum = 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
    return lum > 0.35 ? "#17141f" : "#ffffff";
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function iconSvg(name) {
    const d = ICONS[name];
    if (!d) return "";
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
  }

  /**
   * HTML метки.
   * opts: { type, color, number, size: "sm"|"md"|"lg", cfg, def, title, forceContent }
   * sm — легенды и списки-фильтры: только фигура, без номера и значка (не поместятся).
   */
  function html(opts) {
    const o = opts || {};
    const c = configFor(o.cfg, o.type, o.def);
    const size = o.size === "sm" || o.size === "lg" ? o.size : "md";
    let content = o.forceContent || c.content;
    if (size === "sm") content = "none";
    const color = safeColor(o.color);
    let inner = "";
    if (content === "number") {
      const num = String(o.number == null ? "" : o.number).trim();
      if (num) inner = `<b>${esc(num)}</b>`;
    } else if (content.startsWith("icon:")) {
      inner = iconSvg(content.slice(5));
    }
    const kind = inner ? (content === "number" ? "rmk-num" : "rmk-icon") : "rmk-empty";
    const title = o.title ? ` title="${esc(o.title)}"` : "";
    return `<span class="rmk rmk-${c.shape} rmk-${size} ${kind}" style="--rmk:${color};color:${inkFor(color)}"${title}>${inner}</span>`;
  }

  window.RouteMarkers = { SHAPES, ICONS, CONTENTS, DEFAULT, KNOWN_TYPES, configFor, html, inkFor: (c) => inkFor(safeColor(c)) };
})();
