// ============================================================
// Мост между приложением и встроенным MURScheme (vendor/murscheme).
// ============================================================
// Этот файл НЕ подключается в index.html: networkScheme.js вставляет его
// <script>-ом внутрь iframe с MURScheme.html после загрузки. Классические
// скрипты одной страницы делят глобальную лексическую область, поэтому
// отсюда видны const STATE / I18N и функции MURScheme (refreshCanvas,
// pushHistory, ...). Сам MURScheme.html лежит в репозитории БЕЗ правок —
// обновление апстрима = замена одного файла.
//
// Наружу отдаётся window.__mtrBridge (iframe одного origin с приложением,
// родитель зовёт его напрямую через contentWindow).
(function () {
  "use strict";

  // Поля STATE, которые описывают текущее действие мыши/выделение, а не
  // проект — в prefs.json их сохранять незачем.
  const TRANSIENT = [
    "isPanning", "startPanX", "startPanY",
    "draggingVertex", "draggingStation", "draggingTerminal", "draggingLegend", "draggingTerrainLabel",
    "legendDragOffset", "tempPoints", "transferSelection", "forceNewBranch",
    "activeLineId", "activeDecorId", "selectedStationId", "selectedTransferId",
    "selectedTerrainLabelId", "selectedTerminalId",
  ];

  let changeCb = null;
  function notifyChange() {
    if (changeCb) { try { changeCb(); } catch (e) {} }
  }

  // Любое изменение проекта в MURScheme начинается с pushHistory() — это
  // единственная общая точка, обёртываем её. Сама функция вызывается ДО
  // мутации, но родитель всё равно сохраняет с задержкой (debounce).
  const origPushHistory = pushHistory;
  pushHistory = function () {
    const r = origPushHistory.apply(this, arguments);
    notifyChange();
    return r;
  };
  // Перетаскивания, правки полей и зум/пан идут мимо pushHistory —
  // ловим их по событиям ввода.
  ["mouseup", "keyup", "change", "wheel"].forEach((ev) =>
    document.addEventListener(ev, notifyChange, { capture: true, passive: true }));

  function getProject() {
    const out = {};
    for (const k of Object.keys(STATE)) {
      if (TRANSIENT.includes(k)) continue;
      out[k] = STATE[k];
    }
    out.palette = getUsedPalette();
    out.deletedAutoKeys = Array.from(STATE.deletedAutoKeys || []);
    // Глубокая копия: родитель мутирует результат при слиянии с данными MTR
    return JSON.parse(JSON.stringify(out));
  }

  // Та же логика, что у кнопки «Загрузить .json» в MURScheme
  function loadProject(parsed, opts) {
    opts = opts || {};
    if (!parsed || typeof parsed !== "object") return;
    if (opts.undoable) pushHistory();
    parsed = JSON.parse(JSON.stringify(parsed));
    if (parsed.terminalsSettings) parsed.terminalsSettings = Object.assign({}, STATE.terminalsSettings, parsed.terminalsSettings);
    if (parsed.globalStyles) parsed.globalStyles = Object.assign({}, STATE.globalStyles, parsed.globalStyles);
    if (parsed.legend) parsed.legend = Object.assign({}, STATE.legend, parsed.legend);
    Object.assign(STATE, parsed);
    STATE.deletedAutoKeys = new Set(Array.isArray(parsed.deletedAutoKeys) ? parsed.deletedAutoKeys : []);
    for (const k of ["activeLineId", "activeDecorId", "selectedStationId", "selectedTransferId", "selectedTerrainLabelId", "selectedTerminalId"]) STATE[k] = null;
    STATE.tempPoints = [];
    STATE.transferSelection = [];
    syncLegendFormUI();
    syncTerminalsFormUI();
    if (opts.fit) fitView(); else applyTransform();
    refreshCanvas();
  }

  // Вписать все станции и линии в видимую область
  function fitView() {
    const pts = [];
    (STATE.stations || []).forEach((s) => pts.push(s));
    (STATE.lines || []).forEach((l) => getLineAllPaths(l).forEach((p) => pts.push(...p)));
    if (!pts.length) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    }
    const rect = svg.getBoundingClientRect();
    const pad = 80;
    const w = Math.max(1, maxX - minX), h = Math.max(1, maxY - minY);
    const zoom = Math.max(0.05, Math.min(3, Math.min((rect.width - pad * 2) / w, (rect.height - pad * 2) / h)));
    STATE.zoom = zoom;
    STATE.panX = rect.width / 2 - ((minX + maxX) / 2) * zoom;
    STATE.panY = rect.height / 2 - ((minY + maxY) / 2) * zoom;
    applyTransform();
    if (typeof renderGrid === "function") renderGrid();
  }

  function setLang(code) {
    const lang = code === "ru" ? "ru" : "en"; // у MURScheme только ru/en
    if (I18N.currentLang !== lang) I18N.setLanguage(lang);
  }

  window.__mtrBridge = {
    getProject,
    loadProject,
    fitView,
    setLang,
    gridStep: () => STATE.gridStep,
    onChange(cb) { changeCb = cb; },
  };
  try { window.dispatchEvent(new Event("mtr-bridge-ready")); } catch (e) {}
})();
