// ============================================================
// BoardEditor — конструктор бумажных расписаний (Aushangfahrplan)
// ============================================================
// Отдельный фронтовый модуль, связанный с остальным приложением ровно
// в двух точках:
//  1) REST-эндпоинты, которые уже отдают готовый результат schedule.js
//     (GET /api/stations/:id/schedule, GET /api/routes, GET /api/stations) —
//     никакой логики расписаний здесь не дублируется.
//  2) getPersistedState()/applyPersistedState(), через которые app.js
//     кладёт пресеты/автосохранение холста в общий prefs.json (см.
//     buildPrefsPayload/savePrefsToServer/loadPrefsFromServer в app.js).
// Внутреннее состояние (canvas, история undo/redo, кеш станций/маршрутов)
// не выходит за пределы этого файла.
//
// Использует vendor/fabric.min.js (fabric 5.5.2, UMD-сборка) и
// vendor/lz-string.min.js (lz-string 1.5.0) — подключены как обычные
// <script> в index.html, глобальные fabric/LZString.

const BoardEditor = (function () {
  const FORMAT_VERSION = 1;
  const HISTORY_LIMIT = 50;
  const PAGE_SIZES = { a4p: [794, 1123], a4l: [1123, 794] };
  const DEFAULT_W = 794, DEFAULT_H = 1123;

  // ── Система столбцов расписания ─────────────────────────────
  // Жёстко заданный набор столбцов; юзер галочками выбирает какие из них
  // вставлять. Каждый столбец на холсте — ЕДИНАЯ fabric.Group (двигается/
  // удаляется целиком), помеченная метаданными beRole/beCol/beSection.
  const COL_DEFS = [
    { key: "arrival",   labelKey: "boardColArrival",   width: 66 },
    { key: "departure", labelKey: "boardColDeparture", width: 66 },
    { key: "line",      labelKey: "boardColLine",      width: 88 },
    { key: "dest",      labelKey: "boardColDest",      width: 170 },
    { key: "platform",  labelKey: "boardColPlatform",  width: 74 },
  ];
  // Кастомные поля групп, которые обязаны переживать toJSON/loadFromJSON
  // (иначе undo/redo/пресеты/автосейв потеряют привязку данных к столбцам).
  const BE_PROPS = ["beRole", "beCol", "beSection", "beStyle", "beLineStyle"];
  const ROW_H = 22, HEADER_H = 30, COL_GAP = 10, SECTION_GAP = 28, PAGE_MARGIN = 40;

  // Шрифты, доступные в комбобоксе (плюс системные после запроса).
  const BASE_FONTS = ["Arial", "Georgia", "Courier New", "Impact", "Verdana", "Minecraft", "Times New Roman", "Tahoma", "Segoe UI"];

  // lineColor — подопция столбца "line": цветной квадратик маршрута.
  let colConfig = { arrival: true, departure: true, line: true, lineColor: true, dest: true, platform: true };
  let sectionsMode = "auto"; // "auto" | "1".."10" — на сколько мини-колонок делить холст
  let tableFontSize = 12;    // размер шрифта ячеек вставленного расписания (метрики масштабируются)
  let tableFontFamily = "Arial"; // шрифт вставленного расписания — переживает перестройки и рестарт
  let autoCanvasSize = false; // галочка: подгонять размер холста под вставленное расписание
  let hourGapEnabled = false; // галочка: пробел в столбцах между рейсами соседних часов
  let hourGapPct = 60;        // размер пробела между часами в % от высоты строки
  let favoriteFonts = [];     // избранные шрифты — закрепляются вверху списка
  let currentLineStyle = "solid"; // выбранный вид линии в кастомном выпадающем списке
  let systemFonts = [];       // шрифты с ПК (queryLocalFonts), только на время сессии
  // Логический размер листа отделён от размера элемента canvas: элемент =
  // pageW×zoomLevel — иначе зум ломал бы всю разметку таблицы и экспорт.
  let pageW = DEFAULT_W, pageH = DEFAULT_H;
  let zoomLevel = 1;
  // Язык СОДЕРЖИМОГО холста (заголовки таблицы, текст по умолчанию) —
  // независим от языка интерфейса: "auto" = как интерфейс, либо код языка.
  let canvasLang = "auto";
  let lastSchedule = null;   // { stationId, stationName, entries } — кеш последней вставки для перестроений
  let filterStationId = null; // станция, по которой построены опции фильтров
  let filterOptions = { platforms: [], types: [], routes: [], flows: [] };  // [{value,label}]
  let filterChecked = { platforms: null, types: null, routes: null, flows: null }; // null = все разрешены

  let canvas = null;
  let initialized = false;

  // DOM
  let el = {};

  // История
  let undoStack = [];
  let redoStack = [];
  let restoring = false;
  let histTimer = null;
  let autosaveTimer = null;

  // Данные
  let stationsCache = null; // [{id,name,color}]
  let routesCache = null; // Map(routeId -> route)
  let selectedStationId = null;

  // Пресеты + автосохранение (пришедшие из prefs.json, ждут инициализации canvas)
  let presets = [];
  let pendingLastCanvas = null;
  let pendingLastSchedule = null; // восстановленный кеш расписания (до init canvas)

  // Пользовательские правки вставленного расписания — переживают перестройки
  // таблицы (смена столбцов/фильтров/шрифта) и рестарт приложения:
  //  cellText[colKey][origText] = newText  — переименования ячеек (станция/платформа/номер)
  //  header[colKey]             = newText  — переименование заголовка столбца
  //  cellStyle[colKey]          = {..}     — стиль ячеек столбца (шрифт/размер/цвет)
  //  headerStyle                = {..}     — общий стиль заголовков (шрифт/размер)
  let tableEdits = { cellText: {}, header: {}, cellStyle: {}, headerStyle: {} };

  // ------------------------------------------------------------
  // Утилиты
  // ------------------------------------------------------------
  function tt(key, vars) {
    // t()/I18N — глобальные утилиты из app.js (как это уже делает i18n-extra.js).
    if (typeof t === "function") return t(key, vars);
    return key;
  }
  function esc(s) {
    return typeof escapeHtml === "function" ? escapeHtml(s) : String(s ?? "");
  }
  // Перевод для СОДЕРЖИМОГО холста — уважает независимый язык холста.
  function ct(key) {
    if (canvasLang === "auto") return tt(key);
    try {
      const dict = (typeof I18N !== "undefined" && I18N[canvasLang]) || {};
      return dict[key] ?? (I18N.en && I18N.en[key]) ?? tt(key);
    } catch (e) { return tt(key); }
  }
  function fmtStationTime(ms) {
    const m = ((ms % 86400000) + 86400000) % 86400000;
    const h = Math.floor(m / 3600000);
    const mi = Math.floor((m % 3600000) / 60000);
    return String(h).padStart(2, "0") + ":" + String(mi).padStart(2, "0");
  }
  function setStatus(msg) {
    if (el.statusHint) el.statusHint.textContent = msg || "";
  }

  // ------------------------------------------------------------
  // Сериализация холста (JSON + размеры страницы — fabric не хранит
  // width/height в toJSON() сам по себе)
  // ------------------------------------------------------------
  function serializeCanvas() {
    const json = canvas.toJSON(BE_PROPS);
    // Сохраняем логический размер листа, а не размер элемента (он умножен на зум)
    json.width = pageW;
    json.height = pageH;
    return json;
  }

  // ── Зум холста ────────────────────────────────────────────────
  // Элемент canvas масштабируется вместе с fabric-вьюпортом; вся математика
  // таблицы и экспорт работают в логических координатах листа (pageW/pageH).
  function applyZoomDims() {
    canvas.setZoom(zoomLevel);
    canvas.setDimensions({ width: Math.round(pageW * zoomLevel), height: Math.round(pageH * zoomLevel) });
    if (el.zoomLabel) el.zoomLabel.textContent = Math.round(zoomLevel * 100) + "%";
    canvas.requestRenderAll();
    if (initialized) updateSizeIndicator();
  }
  function setPageSize(w, h) {
    pageW = w;
    pageH = h;
    applyZoomDims();
  }
  function setCanvasZoom(z) {
    zoomLevel = Math.max(0.2, Math.min(4, z));
    applyZoomDims();
  }

  function syncPageControlsToDims(w, h) {
    let matched = "custom";
    for (const key of Object.keys(PAGE_SIZES)) {
      const [pw, ph] = PAGE_SIZES[key];
      if (pw === w && ph === h) { matched = key; break; }
    }
    if (el.pageSize) el.pageSize.value = matched;
    if (el.pageW) el.pageW.value = w;
    if (el.pageH) el.pageH.value = h;
    const showCustom = matched === "custom";
    if (el.pageW) el.pageW.style.display = showCustom ? "" : "none";
    if (el.pageH) el.pageH.style.display = showCustom ? "" : "none";
  }

  function loadSerializedCanvas(data, opts) {
    opts = opts || {};
    if (!data) return;
    restoring = true;
    canvas.loadFromJSON(data, () => {
      const w = data.width || DEFAULT_W;
      const h = data.height || DEFAULT_H;
      setPageSize(w, h);
      syncPageControlsToDims(w, h);
      if (el.bgColor) {
        const bg = canvas.backgroundColor;
        if (typeof bg === "string" && /^#[0-9a-f]{6}$/i.test(bg)) el.bgColor.value = bg;
      }
      // subTargetCheck не сериализуется — включаем для групп расписания,
      // чтобы двойной клик по ячейке работал и после загрузки холста.
      canvas.getObjects().forEach((o) => { if (o.beRole && o.type === "group") o.subTargetCheck = true; });
      updateContextToolbar();
      canvas.requestRenderAll();
      restoring = false;
      if (opts.resetHist !== false) resetHistory();
      if (opts.onDone) opts.onDone();
    });
  }

  // ------------------------------------------------------------
  // История (undo/redo) — снимки JSON, без command-pattern: масштаб фичи
  // этого не требует.
  // ------------------------------------------------------------
  function resetHistory() {
    undoStack = [JSON.stringify(serializeCanvas())];
    redoStack = [];
  }
  function pushHistory() {
    if (restoring || !canvas) return;
    const snap = JSON.stringify(serializeCanvas());
    if (undoStack.length && undoStack[undoStack.length - 1] === snap) return;
    undoStack.push(snap);
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    redoStack = [];
    scheduleAutosave();
  }
  function requestHistoryPush() {
    if (restoring) return;
    clearTimeout(histTimer);
    histTimer = setTimeout(pushHistory, 200);
  }
  function undo() {
    if (undoStack.length < 2) return;
    redoStack.push(undoStack.pop());
    loadSerializedCanvas(JSON.parse(undoStack[undoStack.length - 1]), { resetHist: false });
  }
  function redo() {
    if (!redoStack.length) return;
    const snap = redoStack.pop();
    undoStack.push(snap);
    loadSerializedCanvas(JSON.parse(snap), { resetHist: false });
  }

  function scheduleAutosave() {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      try { if (typeof savePrefsToServer === "function") savePrefsToServer(); } catch (e) {}
    }, 1500);
  }

  // ------------------------------------------------------------
  // Данные со станций/маршрутов — единственная точка соприкосновения
  // с бэкендом/schedule.js: обычные REST-запросы, никакой связи с
  // глобальным state.* из app.js.
  // ------------------------------------------------------------
  async function fetchStationsCached() {
    if (stationsCache) return stationsCache;
    try {
      const res = await fetch("/api/stations");
      stationsCache = res.ok ? await res.json() : [];
    } catch (e) { stationsCache = []; }
    return stationsCache;
  }
  async function fetchRoutesCached() {
    if (routesCache) return routesCache;
    try {
      const res = await fetch("/api/routes");
      const list = res.ok ? await res.json() : [];
      routesCache = new Map(list.map((r) => [r.id, r]));
    } catch (e) { routesCache = new Map(); }
    return routesCache;
  }
  // Принудительное обновление кешей: юзер мог переключить MTR-сервер в
  // настройках — иначе автокомплит станций и конечные в расписании
  // оставались от старого сервера. Дёргается при фокусе на поле станции.
  async function refreshDataCaches() {
    try {
      const [stRes, rtRes] = await Promise.all([fetch("/api/stations"), fetch("/api/routes")]);
      if (stRes.ok) stationsCache = await stRes.json();
      if (rtRes.ok) {
        const list = await rtRes.json();
        routesCache = new Map(list.map((r) => [r.id, r]));
      }
    } catch (e) {}
  }

  // ------------------------------------------------------------
  // Столбцы расписания: заголовки + данные, каждый столбец — группа.
  // Схема работы: юзер выбирает столбцы галочками → "Вставить столбцы"
  // (блок заголовков появляется на холсте) → выбирает станцию/фильтры →
  // "Вставить расписание станции" — данные встают под свои заголовки.
  // При смене размеров холста/фильтров/набора столбцов таблица
  // перестраивается по кешу lastSchedule.
  // ------------------------------------------------------------
  function activeCols() {
    return COL_DEFS.filter((c) => colConfig[c.key]);
  }
  // Все метрики таблицы (ширины столбцов, высота строки/заголовка, зазоры)
  // заданы под шрифт 12px и масштабируются под выбранный размер шрифта.
  function S(v) {
    return v * (tableFontSize / 12);
  }
  function sectionWidth(cols) {
    return S(cols.reduce((s, c) => s + c.width, 0) + COL_GAP * Math.max(0, cols.length - 1));
  }
  // Объект относится к вставленному расписанию, если помечен сам или содержит
  // помеченные объекты внутри (например юзер сгруппировал таблицу с чем-то
  // ещё) — иначе перестройка не находила старую таблицу и клала копию поверх.
  function containsBoardMeta(o) {
    if (o.beRole) return true;
    if (o.type === "group" && o._objects) return o._objects.some(containsBoardMeta);
    return false;
  }
  function boardObjects() {
    return canvas.getObjects().filter(containsBoardMeta);
  }
  // Текст, который сейчас в inline-редактировании. Отслеживаем отдельно от
  // активного объекта: после canvas.clear()/remove() активный объект уже
  // потерян, а скрытая textarea fabric'а продолжает воровать фокус — из-за
  // этого поле поиска станции «не печатало» после очистки холста.
  let editingText = null;

  // Если прямо сейчас редактируется текст (столбец расписания в этот момент
  // временно распущен на отдельные объекты) — завершаем редактирование:
  // обработчик соберёт группу обратно, и перестройка корректно её удалит.
  function finishActiveTextEditing() {
    const t = editingText || canvas.getActiveObject();
    if (t && t.isEditing && t.exitEditing) {
      try { t.exitEditing(); } catch (e) {}
    }
    editingText = null;
    purgeOrphanFabricTextareas();
  }

  // Подстраховка: осиротевшие textarea fabric'а (объект удалили, пока он
  // редактировался) перехватывают весь клавиатурный ввод — сносим их, когда
  // никакое редактирование не активно.
  function purgeOrphanFabricTextareas() {
    const t = editingText || (canvas && canvas.getActiveObject && canvas.getActiveObject());
    if (t && t.isEditing) return;
    document.querySelectorAll("textarea[data-fabric-hiddentextarea]").forEach((n) => n.remove());
  }
  // Якорь таблицы — позиция заголовка первой секции (если юзер его двигал,
  // таблица перестраивается от нового места), иначе отступ страницы.
  function findAnchor() {
    const h = canvas.getObjects().find((o) => o.beRole === "header" && (o.beSection | 0) === 0);
    if (h) return { left: h.left, top: h.top, style: h.beStyle || null };
    return { left: PAGE_MARGIN, top: PAGE_MARGIN, style: null };
  }

  // Переопределение текста ячейки: применяем сохранённое переименование
  // (station_1_hbf → station), чтобы правки переживали перестройку таблицы.
  function ovCellText(colKey, text) {
    const m = tableEdits.cellText[colKey];
    return (m && Object.prototype.hasOwnProperty.call(m, text)) ? m[text] : text;
  }

  function buildHeaderGroup(cols, section, style) {
    const fill = (style && style.fill) || "#111111";
    const hs = tableEdits.headerStyle || {};
    const items = [];
    let x = 0;
    for (const c of cols) {
      const label = (tableEdits.header && tableEdits.header[c.key] != null) ? tableEdits.header[c.key] : ct(c.labelKey);
      const tb = new fabric.Textbox(label, {
        left: x, top: 0, width: S(c.width),
        fontSize: Math.round(hs.fontSize != null ? hs.fontSize : S(13)),
        fontWeight: hs.fontWeight || "bold", fill,
        fontFamily: hs.fontFamily || tableFontFamily,
        fontStyle: hs.fontStyle || "normal", underline: !!hs.underline, linethrough: !!hs.linethrough,
      });
      tb.beCol = c.key; // чтобы правка заголовка синхронизировалась по секциям
      items.push(tb);
      x += S(c.width + COL_GAP);
    }
    const g = new fabric.Group(items, { subTargetCheck: true });
    g.beRole = "header";
    g.beSection = section;
    g.beStyle = { fill };
    return g;
  }

  function cellObjects(colKey, e, routes, y) {
    const cs = tableEdits.cellStyle[colKey] || {};
    const cellFont = {
      fontSize: Math.round(cs.fontSize != null ? cs.fontSize : tableFontSize),
      fill: cs.fill || "#111111",
      fontFamily: cs.fontFamily || tableFontFamily,
      fontStyle: cs.fontStyle || "normal",
      underline: !!cs.underline,
      linethrough: !!cs.linethrough,
      ...(cs.textAlign ? { textAlign: cs.textAlign } : {}),
    };
    const boldIf = (dflt) => ({ fontWeight: cs.fontWeight || dflt });
    const mk = (text, extra) => new fabric.Textbox(ovCellText(colKey, text), extra);
    switch (colKey) {
      case "arrival":
        return [mk(fmtStationTime(e.plannedArrivalMs), { left: 0, top: y, width: S(62), ...cellFont, ...boldIf("normal") })];
      case "departure":
        return [mk(e.plannedDepartureMs == null ? "—" : fmtStationTime(e.plannedDepartureMs), { left: 0, top: y, width: S(62), ...cellFont, ...boldIf("normal") })];
      case "line": {
        const objs = [];
        let tx = 0;
        if (colConfig.lineColor) {
          objs.push(new fabric.Rect({ left: 0, top: y + S(3), width: S(10), height: S(10), fill: e.color || "#888888" }));
          tx = S(14);
        }
        objs.push(mk(e.routeNumber || e.routeName || "", { left: tx, top: y, width: S(84) - tx, ...cellFont, ...boldIf("bold") }));
        return objs;
      }
      case "dest": {
        const route = routes.get(e.routeId);
        return [mk((route && route.terminus) || "—", { left: 0, top: y, width: S(166), ...cellFont, ...boldIf("normal") })];
      }
      case "platform":
        return [mk(e.platformName || "", { left: 0, top: y, width: S(70), ...cellFont, ...boldIf("normal") })];
      default:
        return [];
    }
  }

  // "Тип остановки": у начальных рейсов нет прибытия, у конечных — отправления.
  function entryFlow(e) {
    return e.isTerminus ? "terminus" : e.isOrigin ? "origin" : "through";
  }
  const FLOW_LABEL_KEYS = { through: "boardFlowThrough", origin: "boardFlowOrigin", terminus: "boardFlowTerminus" };

  function applyEntryFilters(entries) {
    return entries.filter((e) => {
      if (filterChecked.platforms && !filterChecked.platforms.has(e.platformName || "—")) return false;
      if (filterChecked.types && !filterChecked.types.has(e.routeType || "—")) return false;
      if (filterChecked.routes && !filterChecked.routes.has(String(e.routeId))) return false;
      if (filterChecked.flows && !filterChecked.flows.has(entryFlow(e))) return false;
      return true;
    });
  }

  // Полная перестройка таблицы на холсте из кеша lastSchedule: делит рейсы
  // на секции (мини-колонки) по размерам холста, для каждой секции ставит
  // блок заголовков и группы-столбцы под ним. Заголовки автоматически
  // переезжают при смене ориентации/размера холста.
  function rebuildTimetable() {
    if (!lastSchedule || !canvas) return;
    fetchRoutesCached().then((routes) => {
      const cols = activeCols();
      if (!cols.length) { setStatus(tt("boardNoColumnsSelected")); return; }
      finishActiveTextEditing();
      const anchor = findAnchor();
      boardObjects().forEach((o) => canvas.remove(o));
      canvas.discardActiveObject();

      const entries = applyEntryFilters(lastSchedule.entries);
      if (!entries.length) {
        setStatus(tt("boardFilteredOutAll"));
        canvas.requestRenderAll();
        requestHistoryPush();
        return;
      }

      // Сортировка и почасовая группировка — по «главному» отображаемому
      // ПЛАНОВОМУ времени: прибытие, а если столбца прибытия нет —
      // отправление. Иначе рейс с отклонением или отправлением в следующем
      // часе попадал не в свой почасовой блок.
      const useDeparture = !colConfig.arrival && colConfig.departure;
      const primaryMs = (e) => (useDeparture && e.plannedDepartureMs != null) ? e.plannedDepartureMs : e.plannedArrivalMs;
      entries.sort((a, b) => primaryMs(a) - primaryMs(b));

      const secW = sectionWidth(cols);
      const headerH = S(HEADER_H), rowH = S(ROW_H);
      const hourGap = Math.round(rowH * (hourGapPct / 100));
      const hourOf = (e) => Math.floor(primaryMs(e) / 3600000);
      let originX, originY;
      if (autoCanvasSize) {
        // Холст подгоняется под таблицу — якорь не клампим по текущим размерам
        originX = Math.max(0, anchor.left);
        originY = Math.max(0, anchor.top);
      } else {
        // Якорь не должен выталкивать таблицу за страницу при сужении холста
        const maxLeft = Math.max(PAGE_MARGIN, pageW - secW - PAGE_MARGIN);
        originX = Math.min(anchor.left, maxLeft);
        originY = Math.min(anchor.top, Math.max(PAGE_MARGIN, pageH - headerH - rowH * 3));
      }
      const availW = Math.max(secW, pageW - originX - PAGE_MARGIN);
      const availH = Math.max(headerH + rowH, pageH - originY - PAGE_MARGIN);
      const maxRows = Math.max(1, Math.floor((availH - headerH) / rowH));
      const maxFit = Math.max(1, Math.floor((availW + SECTION_GAP) / (secW + SECTION_GAP)));
      // Почасовые пробелы «утяжеляют» строки — учитываем в оценке числа секций
      let hourBreaks = 0;
      for (let i = 1; i < entries.length; i++) {
        if (hourOf(entries[i]) !== hourOf(entries[i - 1])) hourBreaks++;
      }
      const virtualRows = entries.length + (hourGapEnabled ? (hourBreaks * hourGap) / rowH : 0);
      const nSec = sectionsMode === "auto"
        ? Math.min(maxFit, Math.max(1, Math.ceil(virtualRows / maxRows)))
        : Math.max(1, Math.min(10, Number(sectionsMode) || 1));
      const rowsPer = Math.ceil(entries.length / nSec);

      // Раскладка секций заранее: позиции строк с почасовыми пробелами
      const sections = [];
      for (let s = 0; s < nSec; s++) {
        const chunk = entries.slice(s * rowsPer, (s + 1) * rowsPer);
        if (!chunk.length) break;
        const ys = [];
        let y = 0;
        for (let i = 0; i < chunk.length; i++) {
          if (i > 0 && hourGapEnabled && hourOf(chunk[i]) !== hourOf(chunk[i - 1])) y += hourGap;
          ys.push(y);
          y += rowH;
        }
        sections.push({ chunk, ys, contentH: y });
      }
      const maxContentH = Math.max(...sections.map((x) => x.contentH));

      if (autoCanvasSize) {
        // Точно подгоняем холст под таблицу (+ поля страницы)
        const newW = Math.round(originX + sections.length * secW + (sections.length - 1) * SECTION_GAP + PAGE_MARGIN);
        const newH = Math.round(originY + headerH + maxContentH + PAGE_MARGIN);
        if (newW !== pageW || newH !== pageH) {
          setPageSize(newW, newH);
          syncPageControlsToDims(newW, newH);
        }
      }

      // Рейсы, не влезшие по высоте, canvas молча обрезает при экспорте —
      // считаем такие строки точно и предупреждаем. При автоподгонке холста
      // обрезки не бывает по построению.
      let clipped = 0;
      sections.forEach((sec, s) => {
        const secX = originX + s * (secW + SECTION_GAP);
        const header = buildHeaderGroup(cols, s, anchor.style);
        header.set({ left: secX, top: originY });
        header.setCoords();
        canvas.add(header);
        let colX = secX;
        for (const c of cols) {
          const cellItems = [];
          sec.chunk.forEach((e, i) => cellItems.push(...cellObjects(c.key, e, routes, sec.ys[i])));
          const g = new fabric.Group(cellItems, { subTargetCheck: true });
          g.beRole = "col";
          g.beCol = c.key;
          g.beSection = s;
          g.set({ left: colX, top: originY + headerH });
          g.setCoords();
          canvas.add(g);
          colX += S(c.width + COL_GAP);
        }
        if (!autoCanvasSize) {
          clipped += sec.ys.filter((y) => originY + headerH + y + rowH > pageH - PAGE_MARGIN + 0.5).length;
        }
      });
      canvas.requestRenderAll();
      requestHistoryPush();
      setStatus(clipped > 0
        ? tt("boardScheduleOverflow", { total: entries.length, count: clipped })
        : tt("boardScheduleInserted", { name: lastSchedule.stationName, count: entries.length }));
    });
  }

  // Разовая подгонка размера листа под содержимое расписания (кнопка «Лист
  // под таблицу»). В отличие от прежней галочки — не автоматическая: считает
  // общий bounding box вставленных объектов и выставляет размер листа один раз.
  function fitCanvasToTable() {
    const objs = boardObjects();
    if (!objs.length) { setStatus(tt("boardNoColumnsSelected")); return; }
    let maxRight = 0, maxBottom = 0;
    objs.forEach((o) => {
      o.setCoords();
      const r = o.getBoundingRect(true);
      maxRight = Math.max(maxRight, r.left + r.width);
      maxBottom = Math.max(maxBottom, r.top + r.height);
    });
    const newW = Math.max(100, Math.round(maxRight + PAGE_MARGIN));
    const newH = Math.max(100, Math.round(maxBottom + PAGE_MARGIN));
    if (newW !== pageW || newH !== pageH) {
      setPageSize(newW, newH);
      syncPageControlsToDims(newW, newH);
      requestHistoryPush();
    }
  }

  // "Вставить столбцы": ставит на холст блок заголовков выбранных столбцов
  // (без данных). Существующая таблица убирается — начинаем разметку заново.
  function insertColumnHeaders() {
    const cols = activeCols();
    if (!cols.length) { setStatus(tt("boardNoColumnsSelected")); return; }
    finishActiveTextEditing();
    const anchor = findAnchor();
    boardObjects().forEach((o) => canvas.remove(o));
    canvas.discardActiveObject();
    lastSchedule = null;
    const header = buildHeaderGroup(cols, 0, anchor.style);
    header.set({ left: anchor.left, top: anchor.top });
    header.setCoords();
    canvas.add(header);
    canvas.setActiveObject(header);
    canvas.requestRenderAll();
    requestHistoryPush();
    setStatus(tt("boardColumnsInserted"));
  }

  async function insertStationSchedule(stationId) {
    setStatus(tt("boardLoadingSchedule"));
    try {
      const [schedRes] = await Promise.all([
        fetch(`/api/stations/${stationId}/schedule`),
        fetchRoutesCached(),
      ]);
      const data = await schedRes.json();
      if (!schedRes.ok) throw new Error(data.error || ("HTTP " + schedRes.status));

      const norm = (ms) => ((ms % 86400000) + 86400000) % 86400000;
      const entries = (data.entries || [])
        .filter((e) => !e.hiddenByReverse)
        .map((e) => ({
          ...e,
          // На бумажный постер идёт ПЛАНОВОЕ время: arrivalMs/departureMs из
          // API уже включают фактическое отклонение (deviation) — вычитаем.
          plannedArrivalMs: norm(e.arrivalMs - (e.deviationMs || 0)),
          plannedDepartureMs: e.departureMs == null ? null : norm(e.departureMs - (e.deviationMs || 0)),
        }));
      if (!entries.length) { setStatus(tt("boardNoDepartures")); return; }

      if (filterStationId !== stationId) {
        deriveFilterOptions(entries);
        filterStationId = stationId;
        renderFiltersPanel();
      }
      lastSchedule = { stationId, stationName: data.stationName, entries };
      rebuildTimetable();
    } catch (err) {
      setStatus(tt("boardScheduleError") + ": " + err.message);
    }
  }

  // ── Схема станции ───────────────────────────────────────────────────────
  // Строится движком «Схемы сети» только из маршрутов через выбранную станцию
  // и открывается там как новая схема: пользователь правит видимость маршрутов,
  // цвета и т.д., а кнопка «В табло» возвращает её сюда картинкой.
  async function insertStationScheme() {
    if (!selectedStationId) { setStatus(tt("boardSelectStationFirst")); return; }
    if (!window.NetworkScheme || typeof window.NetworkScheme.createStationScheme !== "function") {
      setStatus(tt("boardSchemeError"));
      return;
    }
    setStatus(tt("boardLoadingSchedule"));
    try {
      const ok = await window.NetworkScheme.createStationScheme(selectedStationId);
      setStatus(ok ? "" : tt("boardSchemeError"));
    } catch (err) {
      setStatus(tt("boardSchemeError") + ": " + err.message);
    }
  }

  // Смена набора столбцов галочками: если данные уже вставлены —
  // перестраиваем целиком; если на холсте только заголовки — обновляем их.
  // Восстановленный из сохранения холст без кеша не трогаем.
  function onColConfigChanged() {
    scheduleAutosave();
    if (!canvas) return;
    if (lastSchedule) { rebuildTimetable(); return; }
    const objs = boardObjects();
    if (objs.length && objs.every((o) => o.beRole === "header")) insertColumnHeaders();
  }

  // Реакция на смену размеров/ориентации холста: с кешем — полная
  // перестройка (секции и заголовки встают по-новому), без кеша —
  // просто задвигаем таблицу обратно в пределы страницы единым блоком.
  function onCanvasResized() {
    if (lastSchedule) { rebuildTimetable(); return; }
    const objs = boardObjects();
    if (!objs.length) return;
    const hdr = objs.find((o) => o.beRole === "header" && (o.beSection | 0) === 0) || objs[0];
    const W = pageW, H = pageH;
    const r = hdr.getBoundingRect(true);
    let dx = 0, dy = 0;
    if (r.left + r.width > W - PAGE_MARGIN) dx = (W - PAGE_MARGIN) - (r.left + r.width);
    if (r.left + dx < PAGE_MARGIN) dx = PAGE_MARGIN - r.left;
    if (r.top > H - PAGE_MARGIN - S(HEADER_H)) dy = (H - PAGE_MARGIN - S(HEADER_H)) - r.top;
    if (r.top + dy < PAGE_MARGIN) dy = PAGE_MARGIN - r.top;
    if (dx || dy) {
      objs.forEach((o) => { o.set({ left: o.left + dx, top: o.top + dy }); o.setCoords(); });
      canvas.requestRenderAll();
      requestHistoryPush();
    }
  }

  // ------------------------------------------------------------
  // Фильтры: платформы / типы поездов / маршруты. Опции строятся из
  // реальных рейсов выбранной станции, по умолчанию всё включено.
  // ------------------------------------------------------------
  function deriveFilterOptions(entries) {
    const plats = new Set(), types = new Set(), routesM = new Map(), flows = new Set();
    for (const e of entries) {
      plats.add(e.platformName || "—");
      types.add(e.routeType || "—");
      flows.add(entryFlow(e));
      const rid = String(e.routeId);
      if (!routesM.has(rid)) {
        routesM.set(rid, (((e.routeNumber ? e.routeNumber + " " : "") + (e.routeName || "")).trim()) || rid);
      }
    }
    const cmp = new Intl.Collator(undefined, { numeric: true }).compare;
    filterOptions = {
      platforms: [...plats].sort(cmp).map((v) => ({ value: v, label: v })),
      types: [...types].sort().map((v) => ({ value: v, label: v })),
      routes: [...routesM.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => cmp(a.label, b.label)),
      flows: ["through", "origin", "terminus"].filter((v) => flows.has(v)).map((v) => ({ value: v, label: tt(FLOW_LABEL_KEYS[v]) })),
    };
    filterChecked = { platforms: null, types: null, routes: null, flows: null };
  }

  async function loadFilterOptionsForStation(stationId) {
    if (filterStationId === stationId) return;
    try {
      const res = await fetch(`/api/stations/${stationId}/schedule`);
      if (!res.ok) return;
      const data = await res.json();
      const entries = (data.entries || []).filter((e) => !e.hiddenByReverse);
      deriveFilterOptions(entries);
      filterStationId = stationId;
      renderFiltersPanel();
    } catch (e) {}
  }

  function renderFiltersPanel() {
    if (!el.filtersPanel) return;
    if (!filterOptions.platforms.length && !filterOptions.types.length && !filterOptions.routes.length) {
      el.filtersPanel.innerHTML = `<div class="board-filter-empty">${esc(tt("boardFilterEmpty"))}</div>`;
      return;
    }
    const group = (kind, titleKey, items) => {
      if (!items.length) return "";
      const checkedSet = filterChecked[kind];
      const rows = items.map((it) => {
        const checked = !checkedSet || checkedSet.has(it.value);
        return `<label class="board-filter-item"><input type="checkbox" data-fkind="${kind}" value="${esc(it.value)}"${checked ? " checked" : ""}> <span>${esc(it.label)}</span></label>`;
      }).join("");
      return `<div class="board-filter-group"><div class="board-filter-group-title">${esc(tt(titleKey))}<a href="#" class="board-filter-all" data-fkind="${kind}">${esc(tt("boardFilterAll"))}</a></div>${rows}</div>`;
    };
    el.filtersPanel.innerHTML =
      group("flows", "boardFilterFlow", filterOptions.flows) +
      group("platforms", "boardFilterPlatforms", filterOptions.platforms) +
      group("types", "boardFilterTypes", filterOptions.types) +
      group("routes", "boardFilterRoutes", filterOptions.routes);
  }

  function readFilterGroup(kind) {
    const boxes = [...el.filtersPanel.querySelectorAll(`input[data-fkind="${kind}"]`)];
    const checked = boxes.filter((b) => b.checked).map((b) => b.value);
    filterChecked[kind] = checked.length === boxes.length ? null : new Set(checked);
  }

  function confirmReplaceIfNotEmpty() {
    if (canvas.getObjects().length === 0) return true;
    return confirm(tt("boardConfirmClear"));
  }

  // ------------------------------------------------------------
  // Объекты / манипуляции
  // ------------------------------------------------------------
  function addText() {
    const obj = new fabric.Textbox(ct("boardDefaultText"), {
      left: 60, top: 60, width: 220,
      fontSize: Number(el.fontSize.value) || 24,
      fill: el.fontColor.value || "#111111",
      fontFamily: el.fontFamily.value || "Arial",
    });
    canvas.add(obj);
    canvas.setActiveObject(obj);
    canvas.requestRenderAll();
    requestHistoryPush();
  }
  function addShape(type) {
    type = type || "square";
    const common = { left: 60, top: 60, fill: "#ffffff", stroke: "#111111", strokeWidth: 1 };
    let obj;
    if (type === "circle") obj = new fabric.Circle({ ...common, radius: 60 });
    else if (type === "triangle") obj = new fabric.Triangle({ ...common, width: 130, height: 112 });
    else obj = new fabric.Rect({ ...common, width: 120, height: 120 }); // квадрат
    canvas.add(obj);
    canvas.setActiveObject(obj);
    canvas.requestRenderAll();
    requestHistoryPush();
  }
  function addLine() {
    // Новая линия — с текущими видом и толщиной из панели «Объект»
    const style = currentLineStyle || "solid";
    const w = Math.max(1, Math.min(30, Number(el.strokeWidth && el.strokeWidth.value) || 2));
    const obj = makeLineOfStyle(style, { left: 50, top: 50, angle: 0, len: 200, stroke: "#111111", strokeWidth: w });
    canvas.add(obj);
    canvas.setActiveObject(obj);
    canvas.requestRenderAll();
    requestHistoryPush();
  }
  function addImageFromFile(file) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      fabric.Image.fromURL(ev.target.result, (img) => {
        img.scaleToWidth(220);
        img.set({ left: 60, top: 60 });
        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.requestRenderAll();
        requestHistoryPush();
      });
    };
    reader.readAsDataURL(file);
  }

  // Вставка готовой картинки (схема сети из соседнего режима «Редактора»):
  // по центру листа, вписывается в него с полями. Возвращает false, если
  // холст ещё не создан.
  function insertImageDataUrl(url) {
    if (!canvas) return false;
    fabric.Image.fromURL(url, (img) => {
      const maxW = pageW - PAGE_MARGIN * 2, maxH = pageH - PAGE_MARGIN * 2;
      img.scale(Math.min(maxW / img.width, maxH / img.height, 1));
      img.set({ left: (pageW - img.getScaledWidth()) / 2, top: (pageH - img.getScaledHeight()) / 2 });
      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.requestRenderAll();
      requestHistoryPush();
    });
    return true;
  }

  // Собирает все текстовые объекты выделения, включая вложенные в группы
  // (столбцы расписания, прямоугольники с текстом) — чтобы шрифт/жирность/
  // выравнивание применялись и к ним, а не только к «голому» тексту.
  function collectTexts(o, acc) {
    if (o.type === "group") (o._objects || []).forEach((ch) => collectTexts(ch, acc));
    else if (o.isType && o.isType("textbox", "i-text", "text")) acc.push(o);
  }
  function applyToActiveText(fn) {
    const acc = [];
    canvas.getActiveObjects().forEach((o) => collectTexts(o, acc));
    if (!acc.length) return;
    acc.forEach(fn);
    canvas.getActiveObjects().forEach((o) => { if (o.type === "group") o.dirty = true; });
    syncColumnStylesFromSelection(); // копируем стиль на аналогичные столбцы
    updateContextToolbar();          // сразу отражаем B/I/U/S в панели
    canvas.requestRenderAll();
    requestHistoryPush();
  }

  // Красит выделенные объекты: текст и фигуры — заливка, линии — обводка.
  // Внутри групп красит текст и линии; прямоугольники внутри групп не
  // трогаем — это цветные квадратики маршрутов вставленного расписания.
  function applyColorToSelection(color) {
    const objs = canvas.getActiveObjects();
    if (!objs.length) return;
    const paint = (o, topLevel) => {
      if (o.type === "group") {
        (o._objects || []).forEach((ch) => paint(ch, false));
        if (o.beRole === "header" && o.beStyle) o.beStyle = { ...o.beStyle, fill: color };
        o.dirty = true;
      } else if (isLineLike(o)) {
        o.set("stroke", color);
      } else if (o.isType("textbox", "i-text", "text")) {
        o.set("fill", color);
      } else if (o.isType("image")) {
        // картинки не красим
      } else if (topLevel) {
        o.set("fill", color); // прямоугольники и прочие фигуры
      }
    };
    objs.forEach((o) => paint(o, true));
    syncColumnStylesFromSelection(); // копируем цвет на аналогичные столбцы
    canvas.requestRenderAll();
    requestHistoryPush();
  }

  // ------------------------------------------------------------
  // Шрифты: комбобокс с поиском по набору текста и избранным (★ вверху).
  // Системные шрифты — через Local Font Access API (Chromium), как в
  // PowerPoint/Figma: установленные шрифты доступны canvas по имени,
  // API нужен только чтобы получить их список.
  // ------------------------------------------------------------
  let fontFilter = ""; // текущий фильтр списка (пусто при фокусе = весь список)

  function allFonts() {
    return [...new Set([...favoriteFonts, ...BASE_FONTS, ...systemFonts])];
  }

  function renderFontList() {
    if (!el.fontListEl) return;
    const q = fontFilter.trim().toLowerCase();
    const fams = allFonts().filter((f) => !q || f.toLowerCase().includes(q));
    const cmp = (a, b) => a.localeCompare(b);
    const fav = fams.filter((f) => favoriteFonts.includes(f)).sort(cmp);
    const rest = fams.filter((f) => !favoriteFonts.includes(f)).sort(cmp);
    const row = (f) => {
      const isFav = favoriteFonts.includes(f);
      return `<div class="board-font-item" data-font="${esc(f)}">` +
        `<span class="board-font-star${isFav ? " fav" : ""}" data-star="${esc(f)}">${isFav ? "★" : "☆"}</span>` +
        `<span class="board-font-name" style="font-family:'${esc(f)}'">${esc(f)}</span></div>`;
    };
    el.fontListEl.innerHTML = [...fav, ...rest].map(row).join("") ||
      `<div class="autocomplete-item ac-empty">—</div>`;
    el.fontListEl.classList.add("open");
  }

  function applyFontFamily(fam) {
    if (!fam) return;
    const apply = () => {
      applyToActiveText((o) => {
        o.set("fontFamily", fam);
        if (o.initDimensions) o.initDimensions();
      });
      // Если шрифт применён к частям вставленного расписания — запоминаем
      // его как шрифт таблицы, чтобы перестройки/рестарт его не сбрасывали.
      if (canvas.getActiveObjects().some(containsBoardMeta)) {
        tableFontFamily = fam;
        scheduleAutosave();
      }
    };
    // Дожидаемся загрузки шрифта (важно для webfont Minecraft), иначе
    // canvas отрисует фолбэк и закеширует неверные размеры текста.
    try { document.fonts.load(`16px ${fam}`).then(apply, apply); } catch (e) { apply(); }
  }

  async function loadSystemFonts() {
    try {
      if (typeof window.queryLocalFonts !== "function") throw new Error("API unavailable");
      const fonts = await window.queryLocalFonts();
      const fams = [...new Set(fonts.map((f) => f.family))];
      if (!fams.length) throw new Error("empty");
      systemFonts = fams;
      renderFontList();
      setStatus(tt("boardSystemFontsLoaded", { count: fams.length }));
    } catch (e) {
      setStatus(tt("boardSystemFontsError"));
    }
  }

  // Столбцы, где правка одной ячейки распространяется на все одинаковые:
  // направление (название станции), платформа и линия (номер поезда).
  // Время (arrival/departure) не трогаем — совпадения там случайны.
  const PROPAGATE_COLS = new Set(["dest", "platform", "line"]);

  // Заменяет oldText на newText во ВСЕХ ячейках столбцов того же типа
  // (все секции). Так правка «station_1_hbf» → «station» подхватывается
  // везде, где встречается та же станция/платформа/номер.
  function propagateCellEdit(beCol, oldText, newText, exceptObj) {
    if (!PROPAGATE_COLS.has(beCol) || !oldText || oldText === newText) return;
    canvas.getObjects().forEach((o) => {
      if (o.type !== "group" || o.beRole !== "col" || o.beCol !== beCol) return;
      let touched = false;
      (o._objects || []).forEach((ch) => {
        if (ch === exceptObj) return;
        if (ch.isType && ch.isType("textbox", "i-text", "text") && ch.text === oldText) {
          ch.set("text", newText);
          if (ch.initDimensions) ch.initDimensions();
          touched = true;
        }
      });
      if (touched) o.dirty = true;
    });
    canvas.requestRenderAll();
  }

  // Синхронизирует переименование заголовка на тот же столбец во всех секциях.
  function propagateHeaderEdit(colKey, newText, exceptObj) {
    canvas.getObjects().forEach((o) => {
      if (o.type !== "group" || o.beRole !== "header") return;
      let touched = false;
      (o._objects || []).forEach((ch) => {
        if (ch === exceptObj) return;
        if (ch.beCol === colKey && ch.isType && ch.isType("textbox", "i-text", "text")) {
          ch.set("text", newText);
          if (ch.initDimensions) ch.initDimensions();
          touched = true;
        }
      });
      if (touched) o.dirty = true;
    });
    canvas.requestRenderAll();
  }

  // ── Синхронизация стилей столбцов между секциями (update: убрать дубли) ──
  function firstGroupText(group) {
    return (group._objects || []).find((o) => o.isType && o.isType("textbox", "i-text", "text"));
  }
  function readTextStyle(tb) {
    return {
      fontFamily: tb.fontFamily, fontSize: tb.fontSize, fill: tb.fill,
      fontWeight: tb.fontWeight, textAlign: tb.textAlign,
      fontStyle: tb.fontStyle, underline: !!tb.underline, linethrough: !!tb.linethrough,
    };
  }
  function applyTextStyle(tb, st) {
    tb.set({
      fontFamily: st.fontFamily, fontSize: st.fontSize, fill: st.fill,
      fontWeight: st.fontWeight, textAlign: st.textAlign,
      fontStyle: st.fontStyle || "normal", underline: !!st.underline, linethrough: !!st.linethrough,
    });
    if (tb.initDimensions) tb.initDimensions();
  }
  // После смены стиля через панель: если затронуты столбцы/заголовки таблицы —
  // запоминаем их стиль и копируем на все аналогичные столбцы других секций.
  function syncColumnStylesFromSelection() {
    if (!canvas) return;
    const objs = canvas.getActiveObjects();
    let changed = false;
    // Ячейки: стиль на каждый beCol, копируем во все секции
    objs.filter((o) => o.type === "group" && o.beRole === "col").forEach((g) => {
      const rep = firstGroupText(g);
      if (!rep) return;
      const st = readTextStyle(rep);
      tableEdits.cellStyle[g.beCol] = st;
      canvas.getObjects().forEach((o2) => {
        if (o2.type !== "group" || o2.beRole !== "col" || o2.beCol !== g.beCol || o2 === g) return;
        (o2._objects || []).forEach((ch) => { if (ch.isType && ch.isType("textbox", "i-text", "text")) applyTextStyle(ch, st); });
        o2.dirty = true;
        changed = true;
      });
    });
    // Заголовки: общий стиль (шрифт/размер/жирность), копируем на все секции
    const hdrs = objs.filter((o) => o.type === "group" && o.beRole === "header");
    if (hdrs.length) {
      const rep = firstGroupText(hdrs[0]);
      if (rep) {
        const hs = {
          fontFamily: rep.fontFamily, fontSize: rep.fontSize, fontWeight: rep.fontWeight,
          fontStyle: rep.fontStyle, underline: !!rep.underline, linethrough: !!rep.linethrough,
        };
        tableEdits.headerStyle = hs;
        canvas.getObjects().forEach((o2) => {
          if (o2.type !== "group" || o2.beRole !== "header") return;
          (o2._objects || []).forEach((ch) => {
            if (ch.isType && ch.isType("textbox", "i-text", "text")) { ch.set(hs); if (ch.initDimensions) ch.initDimensions(); }
          });
          o2.dirty = true;
          changed = true;
        });
      }
    }
    if (changed) { canvas.requestRenderAll(); scheduleAutosave(); }
  }

  // Fabric не умеет редактировать текст внутри группы, поэтому временно
  // распускаем группу, даём отредактировать текст и по выходу собираем её
  // обратно (с метаданными расписания, если они были).
  function editTextInGroup(g, sub) {
    const meta = { beRole: g.beRole, beCol: g.beCol, beSection: g.beSection, beStyle: g.beStyle };
    const originalText = sub.text; // до правки — для распространения на копии
    canvas.setActiveObject(g);
    const sel = g.toActiveSelection();
    const items = (sel._objects || []).slice();
    canvas.discardActiveObject();
    canvas.setActiveObject(sub);
    sub.enterEditing();
    if (sub.selectAll) sub.selectAll();
    const regroup = () => {
      sub.off("editing:exited", regroup);
      const newText = sub.text;
      canvas.discardActiveObject();
      const sel2 = new fabric.ActiveSelection(items, { canvas });
      canvas.setActiveObject(sel2);
      const g2 = sel2.toGroup();
      if (meta.beRole) {
        g2.beRole = meta.beRole;
        g2.beCol = meta.beCol;
        g2.beSection = meta.beSection;
        g2.beStyle = meta.beStyle;
      }
      g2.subTargetCheck = true;
      canvas.discardActiveObject();
      // Восстанавливаем метку колонки на дочернем тексте (для заголовков)
      if (meta.beRole === "header" && sub.beCol == null && meta.beCol == null) { /* уже есть на sub */ }
      if (newText !== originalText) {
        if (meta.beRole === "header") {
          // Заголовок: синхронизируем на тот же столбец во ВСЕХ секциях
          const colKey = sub.beCol;
          if (colKey) {
            tableEdits.header[colKey] = newText;
            propagateHeaderEdit(colKey, newText, sub);
          }
        } else if (PROPAGATE_COLS.has(meta.beCol) && originalText) {
          // Ячейка данных: запоминаем переименование и распространяем на копии
          tableEdits.cellText[meta.beCol] = tableEdits.cellText[meta.beCol] || {};
          tableEdits.cellText[meta.beCol][originalText] = newText;
          propagateCellEdit(meta.beCol, originalText, newText, sub);
        }
        scheduleAutosave();
      }
      canvas.requestRenderAll();
      requestHistoryPush();
    };
    sub.on("editing:exited", regroup);
  }

  // Двойной клик по прямоугольнику: создаём текст по его центру, а по
  // завершении редактирования группируем с прямоугольником — дальше текст
  // двигается вместе с фигурой и редактируется двойным кликом по группе.
  function addTextToRect(rect) {
    const r = rect.getBoundingRect(true);
    const fontSize = Math.max(6, Math.min(120, Number(el.fontSize && el.fontSize.value) || 16));
    const pad = Math.min(10, r.width * 0.1);
    const tb = new fabric.Textbox(ct("boardDefaultText"), {
      left: r.left + pad,
      top: r.top + r.height / 2 - fontSize * 0.65,
      width: Math.max(20, r.width - pad * 2),
      fontSize,
      fill: "#111111",
      fontFamily: (el.fontFamily && el.fontFamily.value) || "Arial",
      textAlign: "center",
    });
    canvas.add(tb);
    canvas.setActiveObject(tb);
    tb.enterEditing();
    if (tb.selectAll) tb.selectAll();
    const groupUp = () => {
      tb.off("editing:exited", groupUp);
      canvas.discardActiveObject();
      const sel = new fabric.ActiveSelection([rect, tb], { canvas });
      canvas.setActiveObject(sel);
      const g = sel.toGroup();
      g.subTargetCheck = true;
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      requestHistoryPush();
    };
    tb.on("editing:exited", groupUp);
  }

  // ── Линии: толщина и вид ──────────────────────────────────────
  // «Линией» считаем и fabric.Line, и path с меткой beLineStyle (волнистая/
  // зигзаг — это перегенерированные path той же длины и угла).
  function isLineLike(o) {
    return o.type === "line" || (o.type === "path" && o.beLineStyle);
  }
  function dashFor(style, w) {
    switch (style) {
      case "dashed": return [w * 4, w * 3];
      case "dotted": return [1, w * 2.5];
      case "dashdot": return [w * 4, w * 2.5, 1, w * 2.5];
      default: return null;
    }
  }
  function wavyPathString(length, amp, period, zigzag) {
    let d = "M 0 0", x = 0, sign = -1;
    while (x < length - 0.5) {
      const half = Math.min(period / 2, length - x);
      const midX = x + half / 2, endX = x + half;
      d += zigzag
        ? ` L ${midX} ${sign * amp} L ${endX} 0`
        : ` Q ${midX} ${sign * amp * 2} ${endX} 0`;
      x = endX;
      sign = -sign;
    }
    return d;
  }
  // Двойные линии: две параллельные линии (path из двух подпутей на ±gap
  // от центра). Стиль штриха берётся из под-вида после "double_".
  function doubleSubStyle(style) {
    return style === "double" ? "solid" : style.slice("double_".length);
  }
  function makeLineOfStyle(style, geo) {
    let obj;
    if (style === "wavy" || style === "zigzag") {
      const amp = Math.max(2, geo.strokeWidth * 1.2 + 1);
      const period = Math.max(10, amp * 4);
      obj = new fabric.Path(wavyPathString(geo.len, amp, period, style === "zigzag"), {
        fill: "", stroke: geo.stroke, strokeWidth: geo.strokeWidth,
        left: geo.left, top: geo.top, angle: geo.angle,
      });
    } else if (style === "double" || style.indexOf("double_") === 0) {
      const sub = doubleSubStyle(style);
      const gap = Math.max(2, geo.strokeWidth * 0.9 + 1.5);
      const d = `M 0 ${-gap} L ${geo.len} ${-gap} M 0 ${gap} L ${geo.len} ${gap}`;
      obj = new fabric.Path(d, {
        fill: "", stroke: geo.stroke, strokeWidth: geo.strokeWidth,
        strokeDashArray: dashFor(sub, geo.strokeWidth),
        strokeLineCap: sub === "dotted" ? "round" : "butt",
        left: geo.left, top: geo.top, angle: geo.angle,
      });
    } else {
      obj = new fabric.Line([0, 0, geo.len, 0], {
        stroke: geo.stroke, strokeWidth: geo.strokeWidth,
        strokeDashArray: dashFor(style, geo.strokeWidth),
        strokeLineCap: style === "dotted" ? "round" : "butt",
        left: geo.left, top: geo.top, angle: geo.angle,
      });
    }
    obj.beLineStyle = style;
    return obj;
  }
  // Смена вида/толщины пересоздаёт линию той же длины/угла/позиции —
  // так волнистая и зигзаг (это path-геометрия) масштабируются корректно.
  function restyleSelectedLines(newStyle, newWidth) {
    const targets = canvas.getActiveObjects().filter(isLineLike);
    if (!targets.length) return;
    canvas.discardActiveObject(); // вернуть детям выделения абсолютные координаты
    const out = targets.map((o) => {
      const style = newStyle || o.beLineStyle || "solid";
      const geo = {
        left: o.left, top: o.top, angle: o.angle || 0,
        len: Math.max(10, (o.width || 10) * (o.scaleX || 1)),
        stroke: o.stroke || "#111111",
        strokeWidth: newWidth || o.strokeWidth || 2,
      };
      const idx = canvas.getObjects().indexOf(o);
      canvas.remove(o);
      const n = makeLineOfStyle(style, geo);
      canvas.insertAt(n, idx, false);
      return n;
    });
    canvas.setActiveObject(out.length === 1 ? out[0] : new fabric.ActiveSelection(out, { canvas }));
    canvas.requestRenderAll();
    requestHistoryPush();
  }

  // ── Кастомный выпадающий список видов линии с рисунками-примерами ──
  // Нативный <select> не умеет рисовать SVG в опциях, поэтому рисуем сами.
  const LINE_STYLES = [
    "solid", "dashed", "dotted", "dashdot", "wavy", "zigzag",
    "double", "double_dashed", "double_dotted", "double_dashdot",
  ];
  const DASH_PREVIEW = { solid: "", dashed: "8 5", dotted: "1 4", dashdot: "8 4 1 4" };
  function lineStylePreviewSvg(style) {
    const w = 56, h = 14, y = 7;
    let inner;
    if (style === "wavy") {
      inner = `<path d="${wavyPathString(w, 3, 12, false)}" transform="translate(0,${y})" fill="none" stroke="currentColor" stroke-width="1.6"/>`;
    } else if (style === "zigzag") {
      inner = `<path d="${wavyPathString(w, 3, 10, true)}" transform="translate(0,${y})" fill="none" stroke="currentColor" stroke-width="1.6"/>`;
    } else if (style === "double" || style.indexOf("double_") === 0) {
      const sub = doubleSubStyle(style);
      const dash = DASH_PREVIEW[sub] || "";
      const attrs = `stroke="currentColor" stroke-width="1.3"` +
        (sub === "dotted" ? ` stroke-linecap="round"` : ``) +
        (dash ? ` stroke-dasharray="${dash}"` : ``);
      inner = `<line x1="1" y1="${y - 2}" x2="${w - 1}" y2="${y - 2}" ${attrs}/>` +
        `<line x1="1" y1="${y + 2}" x2="${w - 1}" y2="${y + 2}" ${attrs}/>`;
    } else {
      const dash = DASH_PREVIEW[style] || "";
      inner = `<line x1="1" y1="${y}" x2="${w - 1}" y2="${y}" stroke="currentColor" stroke-width="1.6"` +
        (style === "dotted" ? ` stroke-linecap="round"` : ``) +
        (dash ? ` stroke-dasharray="${dash}"` : ``) + `/>`;
    }
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${inner}</svg>`;
  }
  function renderLineStyleButton() {
    if (el.lineStyleCurrent) el.lineStyleCurrent.innerHTML = lineStylePreviewSvg(currentLineStyle);
  }
  function renderLineStylePanel() {
    if (!el.lineStylePanel) return;
    el.lineStylePanel.innerHTML = LINE_STYLES.map((s) =>
      `<div class="board-line-opt${s === currentLineStyle ? " active" : ""}" data-line-style="${s}">${lineStylePreviewSvg(s)}</div>`
    ).join("");
  }
  function setLineStyle(style) {
    currentLineStyle = style;
    renderLineStyleButton();
    renderLineStylePanel();
    restyleSelectedLines(style, 0);
  }

  // Граница (stroke) — только для фигур верхнего уровня: у текста и линий
  // своя логика цвета, у квадратиков маршрутов внутри групп границы не нужны.
  function isStrokableShape(o) {
    return o.type !== "group" && !isLineLike(o) && o.isType && !o.isType("line", "textbox", "i-text", "text", "image");
  }
  function applyStrokeToSelection(fn) {
    const objs = canvas.getActiveObjects().filter(isStrokableShape);
    if (!objs.length) return;
    objs.forEach(fn);
    canvas.requestRenderAll();
    requestHistoryPush();
  }

  const HEX6 = /^#[0-9a-f]{6}$/i;
  // Реакция на смену выделения: отражаем ВСЕ настройки выделенного объекта в
  // панели инструментов (шрифт, размер, цвета, толщина/вид линии, жирность) —
  // чтобы было видно, что именно задано в этой фигуре.
  function updateContextToolbar() {
    const act = canvas ? canvas.getActiveObject() : null;
    const objs = canvas ? canvas.getActiveObjects() : [];
    const texts = [];
    objs.forEach((o) => collectTexts(o, texts));

    // Текстовые свойства из первого текстового объекта выделения
    if (texts.length) {
      const t0 = texts[0];
      if (el.fontFamily && document.activeElement !== el.fontFamily) el.fontFamily.value = t0.fontFamily || "";
      if (el.fontSize && document.activeElement !== el.fontSize && t0.fontSize) el.fontSize.value = Math.round(t0.fontSize);
      if (el.boldBtn) el.boldBtn.classList.toggle("active", t0.fontWeight === "bold" || Number(t0.fontWeight) >= 700);
      if (el.italicBtn) el.italicBtn.classList.toggle("active", t0.fontStyle === "italic");
      if (el.underlineBtn) el.underlineBtn.classList.toggle("active", !!t0.underline);
      if (el.strikeBtn) el.strikeBtn.classList.toggle("active", !!t0.linethrough);
    } else {
      [el.boldBtn, el.italicBtn, el.underlineBtn, el.strikeBtn].forEach((b) => b && b.classList.remove("active"));
    }

    if (act) {
      // Прозрачность выделенного объекта
      if (el.opacity && document.activeElement !== el.opacity) {
        el.opacity.value = Math.round((act.opacity == null ? 1 : act.opacity) * 100);
      }
      // Цвет заливки (текст/фигура) или обводки (линия) в «Цвет объектов»
      let fillColor = texts.length ? texts[0].fill
        : isLineLike(act) ? act.stroke
        : (typeof act.fill === "string" ? act.fill : null);
      if (fillColor && HEX6.test(fillColor) && el.fontColor && document.activeElement !== el.fontColor) {
        el.fontColor.value = fillColor;
      }
      // Обводка (цвет/толщина) для линий и фигур с границей
      if (isLineLike(act) || isStrokableShape(act)) {
        if (el.strokeColor && document.activeElement !== el.strokeColor && typeof act.stroke === "string" && HEX6.test(act.stroke)) {
          el.strokeColor.value = act.stroke;
        }
        if (el.strokeWidth && document.activeElement !== el.strokeWidth) {
          el.strokeWidth.value = Math.round(act.strokeWidth || 0);
        }
      }
      // Вид линии → превью в выпадающем списке
      if (isLineLike(act) && act.beLineStyle) {
        currentLineStyle = act.beLineStyle;
        renderLineStyleButton();
        renderLineStylePanel();
      }
    }
    updateSizeIndicator();
  }

  // Плашка "h: XXX w: YYY" у правого нижнего угла выделения (для линии —
  // только длина). Размеры в логических пикселях листа, зум не влияет.
  function updateSizeIndicator() {
    const box = el.sizeIndicator;
    if (!box || !canvas) return;
    const act = canvas.getActiveObject();
    if (!act) { box.style.display = "none"; return; }
    const r = act.getBoundingRect(true, true);
    const isLine = isLineLike(act);
    const w = Math.round(isLine ? act.width * (act.scaleX || 1) : r.width);
    const h = Math.round(r.height);
    box.textContent = isLine ? `w: ${w}` : `h: ${h} w: ${w}`;
    const outer = document.querySelector(".board-canvas-outer");
    if (!outer || !canvas.upperCanvasEl) { box.style.display = "none"; return; }
    const cRect = canvas.upperCanvasEl.getBoundingClientRect();
    const oRect = outer.getBoundingClientRect();
    box.style.left = Math.round(cRect.left - oRect.left + (r.left + r.width) * zoomLevel + 8) + "px";
    box.style.top = Math.round(cRect.top - oRect.top + (r.top + r.height) * zoomLevel + 8) + "px";
    box.style.display = "";
  }

  // Выравнивание: один выделенный объект — относительно всего холста;
  // несколько выделенных (ActiveSelection) — относительно общей рамки
  // выделения (т.е. относительно друг друга).
  function alignObjects(axis, mode) {
    const active = canvas.getActiveObject();
    if (!active) return;
    const isMulti = active.type === "activeSelection" && active._objects && active._objects.length > 1;
    const targets = isMulti ? active._objects.slice() : [active];

    // Discard первым делом — у ActiveSelection дети хранят left/top в
    // локальных координатах выделения, а не холста. Discard возвращает
    // им абсолютные координаты, после чего пересобираем выделение заново.
    if (isMulti) canvas.discardActiveObject();

    let boxLeft, boxTop, boxWidth, boxHeight;
    if (isMulti) {
      const rects = targets.map((o) => o.getBoundingRect(true));
      boxLeft = Math.min(...rects.map((r) => r.left));
      boxTop = Math.min(...rects.map((r) => r.top));
      boxWidth = Math.max(...rects.map((r) => r.left + r.width)) - boxLeft;
      boxHeight = Math.max(...rects.map((r) => r.top + r.height)) - boxTop;
    } else {
      boxLeft = 0; boxTop = 0; boxWidth = pageW; boxHeight = pageH;
    }

    targets.forEach((obj) => {
      const rect = obj.getBoundingRect(true);
      if (axis === "h") {
        const targetLeft = mode === "start" ? boxLeft
          : mode === "center" ? boxLeft + boxWidth / 2 - rect.width / 2
          : boxLeft + boxWidth - rect.width;
        obj.set({ left: obj.left + (targetLeft - rect.left) });
      } else {
        const targetTop = mode === "start" ? boxTop
          : mode === "center" ? boxTop + boxHeight / 2 - rect.height / 2
          : boxTop + boxHeight - rect.height;
        obj.set({ top: obj.top + (targetTop - rect.top) });
      }
      obj.setCoords();
    });

    if (isMulti) {
      const sel = new fabric.ActiveSelection(targets, { canvas });
      canvas.setActiveObject(sel);
    }
    canvas.requestRenderAll();
    requestHistoryPush();
  }

  function bringFront() {
    canvas.getActiveObjects().forEach((o) => o.bringToFront());
    canvas.requestRenderAll();
    requestHistoryPush();
  }
  function sendBack() {
    canvas.getActiveObjects().slice().reverse().forEach((o) => o.sendToBack());
    canvas.requestRenderAll();
    requestHistoryPush();
  }
  function groupSelected() {
    const active = canvas.getActiveObject();
    if (!active || active.type !== "activeSelection") return;
    const group = active.toGroup();
    canvas.setActiveObject(group);
    canvas.requestRenderAll();
    requestHistoryPush();
  }
  function ungroupSelected() {
    const active = canvas.getActiveObject();
    if (!active || active.type !== "group") return;
    active.toActiveSelection();
    canvas.requestRenderAll();
    requestHistoryPush();
  }
  function duplicateSelected() {
    const active = canvas.getActiveObject();
    if (!active) return;
    active.clone((cloned) => {
      canvas.discardActiveObject();
      cloned.set({ left: (cloned.left || 0) + 20, top: (cloned.top || 0) + 20 });
      if (cloned.type === "activeSelection") {
        cloned.canvas = canvas;
        cloned.forEachObject((o) => canvas.add(o));
        cloned.setCoords();
      } else {
        canvas.add(cloned);
      }
      canvas.setActiveObject(cloned);
      canvas.requestRenderAll();
      requestHistoryPush();
    });
  }
  function selectAllObjects() {
    canvas.discardActiveObject();
    const objs = canvas.getObjects();
    if (!objs.length) return;
    const sel = new fabric.ActiveSelection(objs, { canvas });
    canvas.setActiveObject(sel);
    canvas.requestRenderAll();
  }

  // ── Буфер обмена холста (Ctrl+C / Ctrl+X / Ctrl+V) ─────────────────────
  // Внутренний буфер fabric-объектов (клонов), с сохранением метаданных
  // расписания. Системный буфер ОС не используем — копируем объекты холста.
  let clipboard = null;
  function copySelected() {
    const active = canvas.getActiveObject();
    if (!active) return;
    active.clone((cloned) => { clipboard = cloned; }, BE_PROPS);
  }
  function pasteClipboard() {
    if (!clipboard) return;
    clipboard.clone((cloned) => {
      canvas.discardActiveObject();
      cloned.set({ left: (cloned.left || 0) + 20, top: (cloned.top || 0) + 20, evented: true });
      if (cloned.type === "activeSelection") {
        cloned.canvas = canvas;
        cloned.forEachObject((o) => canvas.add(o));
        cloned.setCoords();
      } else {
        canvas.add(cloned);
      }
      canvas.setActiveObject(cloned);
      canvas.requestRenderAll();
      requestHistoryPush();
    }, BE_PROPS);
  }
  function cutSelected() {
    copySelected();
    deleteSelected();
  }

  // ── Контекстное меню ПКМ (как в PowerPoint) ───────────────────────────
  let boardCtxMenuEl = null;
  function setupBoardContextMenu() {
    const menu = document.createElement("div");
    menu.className = "board-ctx-menu";
    menu.style.display = "none";
    document.body.appendChild(menu);
    boardCtxMenuEl = menu;
    const hide = () => { menu.style.display = "none"; };
    const items = [
      { key: "boardCut", act: cutSelected, needSel: true },
      { key: "boardCopy", act: copySelected, needSel: true },
      { key: "boardPaste", act: pasteClipboard, needClip: true },
      { key: "boardDuplicate", act: duplicateSelected, needSel: true },
      { divider: true },
      { key: "boardGroup", act: groupSelected, needMulti: true },
      { key: "boardUngroup", act: ungroupSelected, needGroup: true },
      { divider: true },
      { key: "boardBringFront", act: bringFront, needSel: true },
      { key: "boardSendBack", act: sendBack, needSel: true },
      { divider: true },
      { key: "boardDelete", act: deleteSelected, needSel: true, danger: true },
    ];
    function render() {
      const active = canvas.getActiveObject();
      const hasSel = !!active;
      const isMulti = active && active.type === "activeSelection";
      const isGroup = active && active.type === "group";
      menu.innerHTML = items.map((it) => {
        if (it.divider) return `<div class="board-ctx-divider"></div>`;
        let disabled = false;
        if (it.needSel && !hasSel) disabled = true;
        if (it.needClip && !clipboard) disabled = true;
        if (it.needMulti && !isMulti) disabled = true;
        if (it.needGroup && !isGroup) disabled = true;
        return `<div class="board-ctx-item${disabled ? " disabled" : ""}${it.danger ? " danger" : ""}" data-key="${esc(it.key)}">${esc(tt(it.key))}</div>`;
      }).join("");
      menu.querySelectorAll(".board-ctx-item:not(.disabled)").forEach((row) => {
        row.addEventListener("click", (ev) => {
          ev.stopPropagation();
          hide();
          const it = items.find((x) => x.key === row.dataset.key);
          if (it && it.act) it.act();
        });
      });
    }
    const target = canvas.upperCanvasEl || document.querySelector(".board-canvas-wrap");
    if (target) {
      target.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        // Выделяем объект под курсором, если кликнули по невыделенному
        const hit = canvas.findTarget(e);
        if (hit && hit !== canvas.getActiveObject()) {
          canvas.setActiveObject(hit);
          canvas.requestRenderAll();
        } else if (!hit) {
          canvas.discardActiveObject();
          canvas.requestRenderAll();
        }
        render();
        menu.style.display = "block";
        menu.style.left = Math.min(e.clientX, window.innerWidth - 210) + "px";
        menu.style.top = e.clientY + "px";
        requestAnimationFrame(() => {
          const r = menu.getBoundingClientRect();
          if (r.bottom > window.innerHeight - 4) menu.style.top = Math.max(4, e.clientY - r.height) + "px";
        });
      });
    }
    document.addEventListener("click", hide);
    document.addEventListener("scroll", hide, true);
    window.addEventListener("blur", hide);
  }
  function deleteSelected() {
    const objs = canvas.getActiveObjects();
    if (!objs.length) return;
    objs.forEach((o) => canvas.remove(o));
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    requestHistoryPush();
  }

  // ------------------------------------------------------------
  // Экспорт
  // ------------------------------------------------------------
  function exportPng() {
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    const scale = Number(el.exportScale.value) || 1;
    // multiplier применяется к текущему вьюпорту, где уже сидит зум —
    // компенсируем, чтобы экспорт всегда был в логическом размере листа
    const dataUrl = canvas.toDataURL({ format: "png", multiplier: scale / zoomLevel });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `msm-export-${Date.now()}.png`;
    a.click();
  }
  async function copyToClipboard() {
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    const scale = Number(el.exportScale.value) || 1;
    const dataUrl = canvas.toDataURL({ format: "png", multiplier: scale / zoomLevel });
    try {
      const blob = await (await fetch(dataUrl)).blob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setStatus(tt("boardCopiedToClipboard"));
    } catch (err) {
      setStatus(tt("boardCopyError") + ": " + err.message);
    }
  }

  // ------------------------------------------------------------
  // Пресеты (хранятся в prefs.json через app.js, см. getPersistedState)
  // ------------------------------------------------------------
  function renderPresetSelect() {
    if (!el.presetSelect) return;
    el.presetSelect.innerHTML = presets.length
      ? presets.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("")
      : `<option value="">${esc(tt("boardNoPresets"))}</option>`;
  }
  function savePreset() {
    const name = (el.presetName.value || "").trim();
    if (!name) { setStatus(tt("boardPresetNameRequired")); return; }
    const preset = {
      id: "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name,
      createdAt: Date.now(),
      formatVersion: FORMAT_VERSION,
      json: serializeCanvas(),
    };
    presets = [...presets.filter((p) => p.name !== name), preset];
    renderPresetSelect();
    el.presetSelect.value = preset.id;
    el.presetName.value = "";
    scheduleAutosave();
    setStatus(tt("boardPresetSaved", { name }));
  }
  function loadPreset() {
    const preset = presets.find((p) => p.id === el.presetSelect.value);
    if (!preset) return;
    if (!confirmReplaceIfNotEmpty()) return;
    loadSerializedCanvas(preset.json);
    scheduleAutosave();
  }
  function deletePreset() {
    const id = el.presetSelect.value;
    if (!id) return;
    presets = presets.filter((p) => p.id !== id);
    renderPresetSelect();
    scheduleAutosave();
  }

  // ------------------------------------------------------------
  // Share-код: JSON -> LZString.compressToBase64. Версионирование +
  // валидация формы ДО loadFromJSON, ничего не исполняется из строки.
  // Картинки (data: URL) включаются в код целиком — код получается
  // длиннее, но холст переносится без потерь. При импорте пропускаем
  // только встроенные data:image/* — image-объекты с внешними URL
  // заменяются серым плейсхолдером (чужой код не должен заставлять
  // приложение ходить на сторонние серверы).
  // ------------------------------------------------------------
  function sanitizeImagesForImport(data) {
    const objects = (data.objects || []).map((o) => {
      if (o && o.type === "image" && !(typeof o.src === "string" && /^data:image\//i.test(o.src))) {
        const { src, crossOrigin, filters, ...rest } = o;
        return { ...rest, type: "rect", fill: "#cccccc", stroke: "#999999", strokeWidth: 1 };
      }
      return o;
    });
    return { ...data, objects };
  }

  function showShareModal() { if (el.shareOverlay) el.shareOverlay.style.display = "flex"; }
  function hideShareModal() { if (el.shareOverlay) el.shareOverlay.style.display = "none"; }

  function openShareExportModal() {
    const raw = serializeCanvas();
    const hasImages = (raw.objects || []).some((o) => o && o.type === "image");
    const payload = { v: FORMAT_VERSION, canvas: raw };
    const code = LZString.compressToBase64(JSON.stringify(payload));
    el.shareTitle.textContent = tt("boardShareExportTitle");
    el.shareHint.textContent = hasImages ? tt("boardShareImagesIncluded") : tt("boardShareExportHint");
    el.shareTextarea.value = code;
    el.shareTextarea.readOnly = true;
    el.shareAction.textContent = tt("boardShareCopyBtn");
    el.shareAction.onclick = () => {
      navigator.clipboard.writeText(code).then(() => setStatus(tt("boardCopiedToClipboard"))).catch(() => {});
    };
    showShareModal();
  }

  function openShareImportModal() {
    el.shareTitle.textContent = tt("boardShareImportTitle");
    el.shareHint.textContent = tt("boardShareImportHint");
    el.shareTextarea.value = "";
    el.shareTextarea.readOnly = false;
    el.shareAction.textContent = tt("boardShareImportBtnAction");
    el.shareAction.onclick = () => {
      const code = (el.shareTextarea.value || "").trim();
      if (!code) return;
      let payload;
      try {
        const json = LZString.decompressFromBase64(code);
        if (!json) throw new Error("empty");
        payload = JSON.parse(json);
      } catch (e) {
        setStatus(tt("boardShareInvalidCode"));
        return;
      }
      const valid =
        payload && typeof payload === "object" &&
        typeof payload.v === "number" && payload.v <= FORMAT_VERSION &&
        payload.canvas && typeof payload.canvas === "object" &&
        Array.isArray(payload.canvas.objects);
      if (!valid) { setStatus(tt("boardShareInvalidCode")); return; }
      if (!confirmReplaceIfNotEmpty()) return;
      loadSerializedCanvas(sanitizeImagesForImport(payload.canvas));
      scheduleAutosave();
      hideShareModal();
      setStatus(tt("boardShareImported"));
    };
    showShareModal();
  }

  // ------------------------------------------------------------
  // Toolbar wiring
  // ------------------------------------------------------------
  function cacheDom() {
    el = {
      canvasEl: document.getElementById("boardCanvas"),
      pageSize: document.getElementById("boardPageSize"),
      pageW: document.getElementById("boardPageW"),
      pageH: document.getElementById("boardPageH"),
      bgColor: document.getElementById("boardBgColor"),
      addText: document.getElementById("boardAddText"),
      addSquare: document.getElementById("boardAddSquare"),
      addCircle: document.getElementById("boardAddCircle"),
      addTriangle: document.getElementById("boardAddTriangle"),
      addLine: document.getElementById("boardAddLine"),
      addImage: document.getElementById("boardAddImage"),
      insertSchemeBtn: document.getElementById("boardInsertSchemeBtn"),
      imageInput: document.getElementById("boardImageInput"),
      fontFamily: document.getElementById("boardFontInput"),
      fontListEl: document.getElementById("boardFontACList"),
      sysFontsBtn: document.getElementById("boardSysFontsBtn"),
      objectTools: document.getElementById("boardObjectTools"),
      textTools: document.getElementById("boardTextTools"),
      lineStyleDD: document.getElementById("boardLineStyleDD"),
      lineStyleBtn: document.getElementById("boardLineStyleBtn"),
      lineStyleCurrent: document.getElementById("boardLineStyleCurrent"),
      lineStylePanel: document.getElementById("boardLineStylePanel"),
      hourGapCb: document.getElementById("boardHourGap"),
      hourGapSize: document.getElementById("boardHourGapSize"),
      canvasLangSel: document.getElementById("boardCanvasLang"),
      zoomInBtn: document.getElementById("boardZoomIn"),
      zoomOutBtn: document.getElementById("boardZoomOut"),
      zoomLabel: document.getElementById("boardZoomLabel"),
      sizeIndicator: document.getElementById("boardSizeIndicator"),
      fontSize: document.getElementById("boardFontSize"),
      fontColor: document.getElementById("boardFontColor"),
      strokeColor: document.getElementById("boardStrokeColor"),
      strokeWidth: document.getElementById("boardStrokeWidth"),
      opacity: document.getElementById("boardOpacity"),
      boldBtn: document.getElementById("boardBoldBtn"),
      italicBtn: document.getElementById("boardItalicBtn"),
      underlineBtn: document.getElementById("boardUnderlineBtn"),
      strikeBtn: document.getElementById("boardStrikeBtn"),
      alignLeft: document.getElementById("boardAlignLeft"),
      alignCenter: document.getElementById("boardAlignCenter"),
      alignRight: document.getElementById("boardAlignRight"),
      objAlignLeft: document.getElementById("boardObjAlignLeft"),
      objAlignCenterH: document.getElementById("boardObjAlignCenterH"),
      objAlignRight: document.getElementById("boardObjAlignRight"),
      objAlignTop: document.getElementById("boardObjAlignTop"),
      objAlignMiddleV: document.getElementById("boardObjAlignMiddleV"),
      objAlignBottom: document.getElementById("boardObjAlignBottom"),
      bringFront: document.getElementById("boardBringFront"),
      sendBack: document.getElementById("boardSendBack"),
      groupBtn: document.getElementById("boardGroupBtn"),
      ungroupBtn: document.getElementById("boardUngroupBtn"),
      duplicateBtn: document.getElementById("boardDuplicateBtn"),
      deleteBtn: document.getElementById("boardDeleteBtn"),
      undoBtn: document.getElementById("boardUndoBtn"),
      redoBtn: document.getElementById("boardRedoBtn"),
      clearBtn: document.getElementById("boardClearBtn"),
      tableFontSize: document.getElementById("boardTableFontSize"),
      fitCanvasBtn: document.getElementById("boardFitCanvasBtn"),
      stationInput: document.getElementById("boardStationInput"),
      stationList: document.getElementById("boardStationACList"),
      insertScheduleBtn: document.getElementById("boardInsertScheduleBtn"),
      columnsBtn: document.getElementById("boardColumnsBtn"),
      columnsPanel: document.getElementById("boardColumnsPanel"),
      insertColumnsBtn: document.getElementById("boardInsertColumnsBtn"),
      filtersBtn: document.getElementById("boardFiltersBtn"),
      filtersPanel: document.getElementById("boardFiltersPanel"),
      sectionsSel: document.getElementById("boardSections"),
      exportScale: document.getElementById("boardExportScale"),
      exportPngBtn: document.getElementById("boardExportPngBtn"),
      copyClipboardBtn: document.getElementById("boardCopyClipboardBtn"),
      presetName: document.getElementById("boardPresetName"),
      presetSaveBtn: document.getElementById("boardPresetSaveBtn"),
      presetSelect: document.getElementById("boardPresetSelect"),
      presetLoadBtn: document.getElementById("boardPresetLoadBtn"),
      presetDeleteBtn: document.getElementById("boardPresetDeleteBtn"),
      shareExportBtn: document.getElementById("boardShareExportBtn"),
      shareImportBtn: document.getElementById("boardShareImportBtn"),
      statusHint: document.getElementById("boardStatusHint"),
      shareOverlay: document.getElementById("boardShareModalOverlay"),
      shareModal: document.getElementById("boardShareModal"),
      shareClose: document.getElementById("boardShareModalClose"),
      shareTitle: document.getElementById("boardShareModalTitle"),
      shareHint: document.getElementById("boardShareModalHint"),
      shareTextarea: document.getElementById("boardShareTextarea"),
      shareAction: document.getElementById("boardShareModalActionBtn"),
      shareCancel: document.getElementById("boardShareModalCancelBtn"),
    };
  }

  function wireToolbar() {
    el.pageSize.addEventListener("change", () => {
      const val = el.pageSize.value;
      if (val === "custom") {
        el.pageW.style.display = "";
        el.pageH.style.display = "";
        el.pageW.value = pageW;
        el.pageH.value = pageH;
        return;
      }
      el.pageW.style.display = "none";
      el.pageH.style.display = "none";
      const [w, h] = PAGE_SIZES[val];
      setPageSize(w, h);
      onCanvasResized();
      requestHistoryPush();
    });
    function applyCustomSize() {
      const w = Math.max(100, Math.min(5000, Number(el.pageW.value) || pageW));
      const h = Math.max(100, Math.min(5000, Number(el.pageH.value) || pageH));
      setPageSize(w, h);
      onCanvasResized();
      requestHistoryPush();
    }
    el.pageW.addEventListener("change", applyCustomSize);
    el.pageH.addEventListener("change", applyCustomSize);

    el.bgColor.addEventListener("input", () => {
      canvas.setBackgroundColor(el.bgColor.value, () => canvas.requestRenderAll());
    });
    el.bgColor.addEventListener("change", requestHistoryPush);

    el.addText.addEventListener("click", addText);
    if (el.addSquare) el.addSquare.addEventListener("click", () => addShape("square"));
    if (el.addCircle) el.addCircle.addEventListener("click", () => addShape("circle"));
    if (el.addTriangle) el.addTriangle.addEventListener("click", () => addShape("triangle"));
    el.addLine.addEventListener("click", addLine);
    if (el.insertSchemeBtn) el.insertSchemeBtn.addEventListener("click", insertStationScheme);
    el.addImage.addEventListener("click", () => el.imageInput.click());
    el.imageInput.addEventListener("change", () => {
      const file = el.imageInput.files[0];
      if (file) addImageFromFile(file);
      el.imageInput.value = "";
    });

    // Комбобокс шрифтов: фокус показывает весь список, набор текста фильтрует,
    // клик по имени применяет шрифт, клик по звёздочке — избранное (вверху).
    el.fontFamily.addEventListener("focus", () => {
      fontFilter = "";
      el.fontFamily.select();
      renderFontList();
    });
    el.fontFamily.addEventListener("input", () => {
      fontFilter = el.fontFamily.value;
      renderFontList();
    });
    el.fontFamily.addEventListener("blur", () => {
      setTimeout(() => { if (el.fontListEl) el.fontListEl.classList.remove("open"); }, 150);
    });
    el.fontFamily.addEventListener("change", () => applyFontFamily(el.fontFamily.value.trim()));
    if (el.fontListEl) {
      el.fontListEl.addEventListener("mousedown", (e) => {
        const star = e.target.closest("[data-star]");
        if (star) {
          e.preventDefault();
          e.stopPropagation();
          const f = star.dataset.star;
          favoriteFonts = favoriteFonts.includes(f)
            ? favoriteFonts.filter((x) => x !== f)
            : [...favoriteFonts, f];
          scheduleAutosave();
          renderFontList();
          return;
        }
        const item = e.target.closest(".board-font-item[data-font]");
        if (!item) return;
        e.preventDefault();
        const f = item.dataset.font;
        el.fontFamily.value = f;
        el.fontListEl.classList.remove("open");
        applyFontFamily(f);
      });
    }
    if (el.sysFontsBtn) el.sysFontsBtn.addEventListener("click", loadSystemFonts);
    el.fontSize.addEventListener("change", () => applyToActiveText((o) => o.set("fontSize", Number(el.fontSize.value) || 24)));
    el.fontColor.addEventListener("input", () => applyColorToSelection(el.fontColor.value));
    if (el.strokeColor) {
      el.strokeColor.addEventListener("input", () => applyStrokeToSelection((o) => {
        // Выбор цвета границы при нулевой толщине автоматически делает её видимой
        o.set({ stroke: el.strokeColor.value, strokeWidth: o.strokeWidth > 0 ? o.strokeWidth : Math.max(1, Number(el.strokeWidth && el.strokeWidth.value) || 1) });
      }));
    }
    if (el.strokeWidth) {
      // Единая толщина: границы фигур (0 = без границы) и линий (минимум 1)
      el.strokeWidth.addEventListener("change", () => {
        const w = Math.max(0, Math.min(30, Number(el.strokeWidth.value) || 0));
        el.strokeWidth.value = w;
        applyStrokeToSelection((o) => o.set({ strokeWidth: w, stroke: o.stroke || el.strokeColor.value }));
        restyleSelectedLines(null, Math.max(1, w));
      });
    }
    if (el.lineStyleBtn && el.lineStylePanel) {
      renderLineStyleButton();
      renderLineStylePanel();
      el.lineStyleBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        el.lineStylePanel.classList.toggle("open");
      });
      el.lineStylePanel.addEventListener("click", (e) => {
        const opt = e.target.closest(".board-line-opt[data-line-style]");
        if (!opt) return;
        e.stopPropagation();
        setLineStyle(opt.dataset.lineStyle);
        el.lineStylePanel.classList.remove("open");
      });
    }
    el.boldBtn.addEventListener("click", () => applyToActiveText((o) => o.set("fontWeight", o.fontWeight === "bold" ? "normal" : "bold")));
    if (el.italicBtn) el.italicBtn.addEventListener("click", () => applyToActiveText((o) => o.set("fontStyle", o.fontStyle === "italic" ? "normal" : "italic")));
    if (el.underlineBtn) el.underlineBtn.addEventListener("click", () => applyToActiveText((o) => o.set("underline", !o.underline)));
    if (el.strikeBtn) el.strikeBtn.addEventListener("click", () => applyToActiveText((o) => o.set("linethrough", !o.linethrough)));
    if (el.opacity) {
      el.opacity.addEventListener("change", () => {
        const objs = canvas.getActiveObjects();
        const pct = Math.max(0, Math.min(100, Math.round(Number(el.opacity.value) || 0)));
        el.opacity.value = pct; // нормализуем ввод (всегда целые проценты)
        if (!objs.length) return;
        objs.forEach((o) => o.set("opacity", pct / 100));
        canvas.requestRenderAll();
        requestHistoryPush();
      });
    }
    el.alignLeft.addEventListener("click", () => applyToActiveText((o) => o.set("textAlign", "left")));
    el.alignCenter.addEventListener("click", () => applyToActiveText((o) => o.set("textAlign", "center")));
    el.alignRight.addEventListener("click", () => applyToActiveText((o) => o.set("textAlign", "right")));

    el.objAlignLeft.addEventListener("click", () => alignObjects("h", "start"));
    el.objAlignCenterH.addEventListener("click", () => alignObjects("h", "center"));
    el.objAlignRight.addEventListener("click", () => alignObjects("h", "end"));
    el.objAlignTop.addEventListener("click", () => alignObjects("v", "start"));
    el.objAlignMiddleV.addEventListener("click", () => alignObjects("v", "center"));
    el.objAlignBottom.addEventListener("click", () => alignObjects("v", "end"));

    el.bringFront.addEventListener("click", bringFront);
    el.sendBack.addEventListener("click", sendBack);
    el.groupBtn.addEventListener("click", groupSelected);
    el.ungroupBtn.addEventListener("click", ungroupSelected);
    el.duplicateBtn.addEventListener("click", duplicateSelected);
    el.deleteBtn.addEventListener("click", deleteSelected);
    el.undoBtn.addEventListener("click", undo);
    el.redoBtn.addEventListener("click", redo);

    el.clearBtn.addEventListener("click", () => {
      if (!confirmReplaceIfNotEmpty()) return;
      // Завершаем возможное редактирование текста ДО очистки — иначе его
      // скрытая textarea оставалась в DOM и блокировала ввод в поля.
      finishActiveTextEditing();
      canvas.clear();
      purgeOrphanFabricTextareas();
      lastSchedule = null;
      pendingLastSchedule = null;
      tableEdits = { cellText: {}, header: {}, cellStyle: {}, headerStyle: {} };
      canvas.setBackgroundColor("#ffffff", () => canvas.requestRenderAll());
      resetHistory();
      scheduleAutosave();
    });

    el.insertScheduleBtn.addEventListener("click", () => {
      if (!selectedStationId) { setStatus(tt("boardSelectStationFirst")); return; }
      insertStationSchedule(selectedStationId);
    });

    // Выпадающие панели "Столбцы" и "Фильтры"
    function setupDropdown(btn, panel) {
      if (!btn || !panel) return;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const willOpen = !panel.classList.contains("open");
        el.columnsPanel.classList.remove("open");
        el.filtersPanel.classList.remove("open");
        if (willOpen) panel.classList.add("open");
      });
      panel.addEventListener("click", (e) => e.stopPropagation());
    }
    setupDropdown(el.columnsBtn, el.columnsPanel);
    setupDropdown(el.filtersBtn, el.filtersPanel);
    document.addEventListener("click", () => {
      if (el.columnsPanel) el.columnsPanel.classList.remove("open");
      if (el.filtersPanel) el.filtersPanel.classList.remove("open");
      if (el.lineStylePanel) el.lineStylePanel.classList.remove("open");
    });

    if (el.columnsPanel) {
      el.columnsPanel.querySelectorAll("input[data-col]").forEach((chk) => {
        chk.addEventListener("change", () => {
          colConfig[chk.dataset.col] = chk.checked;
          onColConfigChanged();
        });
      });
    }
    if (el.insertColumnsBtn) el.insertColumnsBtn.addEventListener("click", insertColumnHeaders);

    if (el.sectionsSel) {
      el.sectionsSel.addEventListener("change", () => {
        sectionsMode = el.sectionsSel.value;
        scheduleAutosave();
        if (lastSchedule) rebuildTimetable();
      });
    }

    if (el.tableFontSize) {
      el.tableFontSize.addEventListener("change", () => {
        tableFontSize = Math.max(4, Math.min(40, Number(el.tableFontSize.value) || 12));
        el.tableFontSize.value = tableFontSize;
        scheduleAutosave();
        if (lastSchedule) { rebuildTimetable(); return; }
        // На холсте только заголовки — перерисовываем их с новым размером
        const objs = boardObjects();
        if (objs.length && objs.every((o) => o.beRole === "header")) insertColumnHeaders();
      });
    }
    if (el.fitCanvasBtn) el.fitCanvasBtn.addEventListener("click", fitCanvasToTable);
    if (el.hourGapCb) {
      el.hourGapCb.addEventListener("change", () => {
        hourGapEnabled = el.hourGapCb.checked;
        scheduleAutosave();
        if (lastSchedule) rebuildTimetable();
      });
    }
    if (el.hourGapSize) {
      el.hourGapSize.addEventListener("change", () => {
        hourGapPct = Math.max(0, Math.min(300, Number(el.hourGapSize.value) || 0));
        el.hourGapSize.value = hourGapPct;
        scheduleAutosave();
        if (hourGapEnabled && lastSchedule) rebuildTimetable();
      });
    }
    if (el.canvasLangSel) {
      el.canvasLangSel.addEventListener("change", () => {
        canvasLang = el.canvasLangSel.value;
        scheduleAutosave();
        if (lastSchedule) { rebuildTimetable(); return; }
        // На холсте только заголовки — перерисовываем их на новом языке
        const objs = boardObjects();
        if (objs.length && objs.every((o) => o.beRole === "header")) insertColumnHeaders();
      });
    }


    // Масштаб холста: Ctrl+колесо над холстом и полупрозрачные кнопки в углу
    const canvasWrap = document.querySelector(".board-canvas-wrap");
    if (canvasWrap) {
      canvasWrap.addEventListener("wheel", (e) => {
        if (!e.ctrlKey) return;
        e.preventDefault();
        setCanvasZoom(zoomLevel * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
      }, { passive: false });
    }
    if (el.zoomInBtn) el.zoomInBtn.addEventListener("click", () => setCanvasZoom(zoomLevel * 1.25));
    if (el.zoomOutBtn) el.zoomOutBtn.addEventListener("click", () => setCanvasZoom(zoomLevel / 1.25));

    if (el.filtersPanel) {
      el.filtersPanel.addEventListener("change", (e) => {
        const inp = e.target.closest("input[data-fkind]");
        if (!inp) return;
        readFilterGroup(inp.dataset.fkind);
        if (lastSchedule) rebuildTimetable();
      });
      el.filtersPanel.addEventListener("click", (e) => {
        const link = e.target.closest("a.board-filter-all");
        if (!link) return;
        e.preventDefault();
        el.filtersPanel.querySelectorAll(`input[data-fkind="${link.dataset.fkind}"]`).forEach((b) => { b.checked = true; });
        filterChecked[link.dataset.fkind] = null;
        if (lastSchedule) rebuildTimetable();
      });
    }

    el.exportPngBtn.addEventListener("click", exportPng);
    el.copyClipboardBtn.addEventListener("click", copyToClipboard);

    el.presetSaveBtn.addEventListener("click", savePreset);
    el.presetLoadBtn.addEventListener("click", loadPreset);
    el.presetDeleteBtn.addEventListener("click", deletePreset);

    el.shareExportBtn.addEventListener("click", openShareExportModal);
    el.shareImportBtn.addEventListener("click", openShareImportModal);
    el.shareClose.addEventListener("click", hideShareModal);
    el.shareCancel.addEventListener("click", hideShareModal);
    el.shareOverlay.addEventListener("click", (e) => { if (e.target === el.shareOverlay) hideShareModal(); });

    if (typeof makeAutocomplete === "function") {
      makeAutocomplete({
        inputEl: el.stationInput,
        listEl: el.stationList,
        getItems: () => stationsCache || [],
        onSelect: (id) => {
          selectedStationId = id;
          loadFilterOptionsForStation(id);
        },
      });
      // Синхронизация с актуальным MTR-сервером (мог смениться в настройках)
      el.stationInput.addEventListener("focus", refreshDataCaches);
    }

    const ARROW_KEYS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    document.addEventListener("keydown", (e) => {
      const tab = document.getElementById("tab-board");
      if (!tab || !tab.classList.contains("active") || !canvas) return;
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || e.target.isContentEditable) return;
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); deleteSelected(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) { e.preventDefault(); redo(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "g" && !e.shiftKey) { e.preventDefault(); groupSelected(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "g" && e.shiftKey) { e.preventDefault(); ungroupSelected(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") { e.preventDefault(); duplicateSelected(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") { e.preventDefault(); copySelected(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "x") { e.preventDefault(); cutSelected(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") { e.preventDefault(); pasteClipboard(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") { e.preventDefault(); selectAllObjects(); }
      else if ((e.ctrlKey || e.metaKey) && e.key === "]") { e.preventDefault(); bringFront(); }
      else if ((e.ctrlKey || e.metaKey) && e.key === "[") { e.preventDefault(); sendBack(); }
      else if (e.key === "Escape") { canvas.discardActiveObject(); canvas.requestRenderAll(); }
      else if (ARROW_KEYS[e.key]) {
        const act = canvas.getActiveObject();
        if (!act) return;
        e.preventDefault();
        const [dx, dy] = ARROW_KEYS[e.key];
        const step = e.shiftKey ? 10 : 1;
        act.set({ left: act.left + dx * step, top: act.top + dy * step });
        act.setCoords();
        canvas.requestRenderAll();
        requestHistoryPush();
      }
    });

    // Fabric во время inline-редактирования текста на холсте постоянно
    // возвращает фокус своей скрытой textarea (для мигающего курсора) —
    // из-за этого поля приложения (поиск станции и т.д.) переставали
    // принимать ввод, пока редактирование не завершено. При фокусе на любом
    // поле приложения принудительно выходим из режима редактирования.
    document.addEventListener("focusin", (e) => {
      if (!canvas || !e.target || !e.target.closest) return;
      if (!e.target.closest("main, .modal-overlay")) return;
      const t = editingText || canvas.getActiveObject();
      if (t && t.isEditing) {
        finishActiveTextEditing();
        canvas.discardActiveObject();
        canvas.requestRenderAll();
      } else {
        purgeOrphanFabricTextareas();
      }
    });
  }

  // ------------------------------------------------------------
  // Публичный API
  // ------------------------------------------------------------
  function syncColumnControls() {
    if (el.columnsPanel) {
      el.columnsPanel.querySelectorAll("input[data-col]").forEach((chk) => {
        chk.checked = !!colConfig[chk.dataset.col];
      });
    }
    if (el.sectionsSel) el.sectionsSel.value = sectionsMode;
    if (el.tableFontSize) el.tableFontSize.value = tableFontSize;
    if (el.hourGapCb) el.hourGapCb.checked = hourGapEnabled;
    if (el.hourGapSize) el.hourGapSize.value = hourGapPct;
    if (el.canvasLangSel) el.canvasLangSel.value = canvasLang;
  }

  function init() {
    if (initialized) return;
    if (typeof fabric === "undefined") { console.error("BoardEditor: fabric.js не загружен (public/vendor/fabric.min.js)"); return; }
    if (!document.getElementById("boardCanvas")) return; // вкладки нет в разметке
    initialized = true;

    // Fabric кеширует каждый объект на offscreen-канвасе с дефолтными
    // лимитами (сторона ≤4096px, площадь ≤2МП). Высокая группа-столбец
    // расписания с сотней рейсов их превышает — кеш рисуется уменьшенным
    // и растягивается, текст выглядит размазанным. Поднимаем лимиты.
    fabric.perfLimitSizeTotal = 33554432; // 32 МП
    fabric.maxCacheSideLimit = 16384;

    // Прогреваем встроенный Minecraft-шрифт (vendor/Monocraft.ttf), чтобы
    // canvas сразу рисовал им, а не системным фолбэком.
    try {
      document.fonts.load("16px Minecraft");
      document.fonts.load("bold 16px Minecraft");
    } catch (e) {}

    cacheDom();
    // uniformScaling:false — по умолчанию угол тянет свободно (растяжение),
    // а с зажатым Shift масштаб сохраняет пропорции (как в Figma/PowerPoint).
    canvas = new fabric.Canvas("boardCanvas", { preserveObjectStacking: true, uniformScaling: false });
    // Выбор по видимым пикселям, а не по прямоугольной рамке: иначе клик по
    // прозрачной части верхней фигуры «проваливался» и выделял фигуру под ней.
    canvas.perPixelTargetFind = true;
    canvas.targetFindTolerance = 4;
    wireToolbar();
    setupBoardContextMenu();
    fetchStationsCached();

    canvas.on("object:added", requestHistoryPush);
    canvas.on("object:removed", requestHistoryPush);
    canvas.on("object:modified", requestHistoryPush);
    canvas.on("text:editing:exited", requestHistoryPush);
    canvas.on("text:editing:entered", (e) => { editingText = (e && e.target) || canvas.getActiveObject(); });
    canvas.on("text:editing:exited", () => { editingText = null; });
    canvas.on("selection:created", updateContextToolbar);
    canvas.on("selection:updated", updateContextToolbar);
    canvas.on("selection:cleared", updateContextToolbar);
    // Живое обновление плашки размеров при перемещении/ресайзе/повороте
    canvas.on("object:moving", updateSizeIndicator);
    canvas.on("object:scaling", updateSizeIndicator);
    // Поворот: с зажатым Shift — шаг 45°. Используем rotate() (а не
    // set("angle")): rotate() крутит вокруг центра объекта, тогда как
    // прямой set("angle") пивотит вокруг верхнего-левого угла — из-за чего
    // при снапе фигура «улетала» за пределы холста.
    canvas.on("object:rotating", (opt) => {
      if (opt && opt.e && opt.e.shiftKey && opt.target) {
        opt.target.rotate(Math.round(opt.target.angle / 45) * 45);
      }
      updateSizeIndicator();
    });
    canvas.on("object:modified", updateSizeIndicator);

    // Двойной клик: по текстовой ячейке любой группы (столбцы расписания,
    // прямоугольники с текстом) — редактирование текста внутри группы;
    // по "пустому" прямоугольнику — вписываем в него новый текст.
    canvas.on("mouse:dblclick", (opt) => {
      const t = opt.target;
      if (!t) return;
      if (t.type === "group") {
        const sub = (opt.subTargets || []).find((o) => o.isType && o.isType("textbox", "i-text", "text"));
        if (sub) editTextInGroup(t, sub);
      } else if (t.isType && t.isType("rect") && !t.beRole) {
        addTextToRect(t);
      }
    });

    // Восстанавливаем кеш расписания: система должна «помнить», что таблица
    // уже вставлена (иначе смена столбцов/шрифта затирала восстановленную
    // таблицу как будто расписания нет).
    if (pendingLastSchedule) lastSchedule = pendingLastSchedule;
    if (pendingLastCanvas) {
      loadSerializedCanvas(pendingLastCanvas);
    } else {
      setPageSize(DEFAULT_W, DEFAULT_H);
      canvas.setBackgroundColor("#ffffff", () => canvas.requestRenderAll());
      syncPageControlsToDims(DEFAULT_W, DEFAULT_H);
      resetHistory();
    }
    renderPresetSelect();
    syncColumnControls();
    renderFiltersPanel();
    updateContextToolbar();

    // Когда все webfonts догрузились — пересчитываем и перерисовываем текст:
    // иначе восстановленный при старте холст остаётся отрисованным фолбэком
    // (это и выглядело как «шрифт откатился после перезапуска»).
    try {
      document.fonts.ready.then(() => {
        if (!canvas) return;
        const walk = (o) => {
          o.dirty = true;
          if (o.initDimensions) o.initDimensions();
          if (o._objects) o._objects.forEach(walk);
        };
        canvas.getObjects().forEach(walk);
        canvas.requestRenderAll();
      });
    } catch (e) {}
  }

  function applyPersistedState(data) {
    if (data && Array.isArray(data.presets)) presets = data.presets;
    if (data && data.lastCanvas && typeof data.lastCanvas === "object") pendingLastCanvas = data.lastCanvas;
    if (data && data.lastSchedule && typeof data.lastSchedule === "object") pendingLastSchedule = data.lastSchedule;
    if (data && data.tableEdits && typeof data.tableEdits === "object") {
      tableEdits = {
        cellText: data.tableEdits.cellText || {},
        header: data.tableEdits.header || {},
        cellStyle: data.tableEdits.cellStyle || {},
        headerStyle: data.tableEdits.headerStyle || {},
      };
    }
    if (data && data.ui && typeof data.ui === "object") {
      if (data.ui.colConfig && typeof data.ui.colConfig === "object") colConfig = { ...colConfig, ...data.ui.colConfig };
      if (data.ui.sectionsMode != null) sectionsMode = String(data.ui.sectionsMode);
      if (Number.isFinite(Number(data.ui.tableFontSize))) tableFontSize = Math.max(4, Math.min(40, Number(data.ui.tableFontSize)));
      if (typeof data.ui.tableFontFamily === "string" && data.ui.tableFontFamily) tableFontFamily = data.ui.tableFontFamily;
      // autoCanvasSize (прежняя галочка) заменён разовой кнопкой — не восстанавливаем.
      if (typeof data.ui.hourGapEnabled === "boolean") hourGapEnabled = data.ui.hourGapEnabled;
      if (Number.isFinite(Number(data.ui.hourGapPct))) hourGapPct = Math.max(0, Math.min(300, Number(data.ui.hourGapPct)));
      if (Array.isArray(data.ui.favoriteFonts)) favoriteFonts = data.ui.favoriteFonts.filter((f) => typeof f === "string");
      if (typeof data.ui.canvasLang === "string" && data.ui.canvasLang) canvasLang = data.ui.canvasLang;
    }
    if (canvas) {
      renderPresetSelect();
      syncColumnControls();
    }
  }

  function getPersistedState() {
    return {
      presets,
      lastCanvas: canvas ? serializeCanvas() : pendingLastCanvas,
      // Кеш вставленного расписания и правки — чтобы после рестарта система
      // «помнила», что расписание есть, и не сбрасывала правки при перестройке.
      lastSchedule: lastSchedule || pendingLastSchedule,
      tableEdits,
      ui: { colConfig, sectionsMode, tableFontSize, tableFontFamily, hourGapEnabled, hourGapPct, favoriteFonts, canvasLang },
    };
  }

  return { init, applyPersistedState, getPersistedState, insertImageDataUrl };
})();

window.BoardEditor = BoardEditor;
