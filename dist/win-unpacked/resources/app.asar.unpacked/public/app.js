const MS_PER_DAY = 86400000;

// ============================================================
// Локализация
// ============================================================
const I18N = {
  ru: {
    appTitle: "Расписание GeoRail (MTR)",
    statusConnecting: "Подключение...",
    statusSynced: "Синхронизировано: {st} ст., {rt} маршр.",
    statusErrorConn: "Ошибка подключения к серверу MTR",
    statusWaiting: "Ожидание первого опроса...",
    statusNoLocalServer: "Нет связи с локальным сервером",
    tabSchedule: "Расписание по станции",
    tabGraph: "График движения",
    tabRoutes: "Маршруты",
    tabAnalytics: "Аналитика опозданий",
    tabSettings: "Настройки",
    tabInstructions: "Инструкции",
    instructionsHint: "Список всех возможностей приложения — кликни по пункту, чтобы раскрыть подробное описание.",
    tabDrafts: "Пробные маршруты",
    draftsHint: "Создавайте пробные рейсы с теми же параметрами, что и у настоящих маршрутов. Время отправления с первой станции задаётся вручную. Пробные маршруты показываются пунктиром на дашборде и графике движения наравне с настоящими.",
    newDraftBtn: "+ Создать пробный маршрут",
    editDraftTitle: "Редактирование пробного маршрута",
    draftNameLabel: "Название",
    draftNumberLabel: "Номер",
    draftColorLabel: "Цвет",
    draftTypeLabel: "Тип",
    draftDepotLabel: "Депо (необязательно)",
    draftDepartureLabel: "Время отправления с первой станции",
    draftIntervalLabel: "Интервал (ЧЧ:ММ:СС, необязательно)",
    draftIntervalHint: "Если указать — на весь день автоматически создадутся дополнительные отправления с этим шагом (начиная с указанного выше времени). Дальше можно будет добавлять/убирать отдельные отправления прямо в карточке маршрута.",
    draftIntervalInvalid: "Интервал нужно указать в формате ЧЧ:ММ:СС, например 02:00:00.",
    draftStopsLabel: "Остановки",
    draftNoStopsYet: "Остановок пока нет — найдите станцию в поле ниже, чтобы добавить.",
    draftStopDwell: "стоянка, с",
    draftStopDuration: "до след., с",
    customPlatformOption: "Другое (ввести вручную)",
    saveBtn: "Сохранить",
    cancelBtn: "Отмена",
    draftNeedTwoStops: "Добавьте минимум 2 остановки.",
    draftNeedName: "Укажите название маршрута.",
    draftEmptyList: "Пробных маршрутов пока нет.",
    draftBadge: "ЧЕРНОВИК",
    draftTooltip: "Пробный маршрут",
    draftConfirmDelete: "Удалить этот пробный маршрут?",
    draftEdit: "Изменить",
    draftDelete: "Удалить",
    stationPlaceholder: "Начните вводить название станции...",
    platformHeader: "Платформа",
    dashboardEmptyDefault: "Выберите станцию, чтобы увидеть дашборд прибытий по платформам",
    dashboardEmptyNoTrips: "Нет активных рейсов через эту станцию прямо сейчас",
    scheduleMetaTemplate: "Станция: {name} · платформ: {pc} · рейсов за сутки: {ec} · обновлено {time}",
    zoomLabel: "Масштаб",
    zoomWheelHint: "Ctrl+колесо мыши над графиком — тоже масштабирует.",
    minIntervalLabel: "Мин. интервал для конфликта",
    minIntervalValue: "{m} мин",
    platformsFilterLabel: "Платформы",
    selectAll: "Все",
    selectNone: "Ничего",
    resetEdits: "Сбросить ручные правки",
    resetFilters: "Сбросить фильтры",
    dragHint: "Перетащите блок поезда по горизонтали мышкой, чтобы вручную сдвинуть его время — изменённый рейс станет пунктирным. Удерживайте Shift при перетаскивании, чтобы сдвинуть сразу ВСЕ отправления этого маршрута за день. Удерживайте Alt и тащите блок ВЕРТИКАЛЬНО (на всю высоту строки) — переносит рейс на другую платформу.",
    dragHintGraph: "Перетащите линию поезда по горизонтали мышкой, чтобы вручную сдвинуть её время — изменённый рейс станет пунктирным. Удерживайте Shift при перетаскивании, чтобы сдвинуть сразу ВСЕ рейсы этого маршрута за день.",
    platformLabel: "Платформа",
    arrivalLabel: "Прибытие",
    departureLabel: "Отправление",
    deviationLabel: "Отклонение",
    statusLabel: "Статус",
    statusOrigin: "начало",
    statusTerminus: "конечная",
    onSchedule: "по графику",
    editedLabel: "ред.",
    platformMovedLabel: "платф. изменена",
    editedNote: "Время изменено вручную",
    conflictLabel: "Конфликт на платформе",
    conflictWith: "с рейсом {route} в {time}",
    graphHint: "Выберите две граничные станции — система найдёт все маршруты, проходящие через обе, и построит график движения (станции по вертикали — на реальном расстоянии друг от друга, время по горизонтали; наклон линии = скорость поезда).",
    graphFromPlaceholder: "Станция А...",
    graphToPlaceholder: "Станция Б...",
    buildGraphBtn: "Построить график",
    showReverseLabel: "Показывать обратные рейсы",
    stationsFilterLabel: "Станции на графике",
    graphEmptyDefault: "Выберите обе станции и нажмите «Построить график»",
    graphBuilding: "Строим график...",
    graphSelectBoth: "Выберите обе станции из списка подсказок (кликните по варианту в выпадающем списке)",
    graphSameStation: "Выберите две разные станции",
    graphNoRoutes: "Нет маршрутов, проходящих через обе станции (или у них сейчас нет активных рейсов)",
    tripsPerDay: "рейсов/сутки",
    directionForward: "А → Б",
    directionBackward: "Б → А (обратный)",
    directionBackwardShort: "обр.",
    graphInactiveRoute: "Сейчас нет активных рейсов по этому маршруту",
    routeSearchPlaceholder: "Поиск маршрута...",
    colLine: "Линия", colNumber: "№", colType: "Тип", colStops: "Остановок",
    routesAnalyticsHint: "Список маршрутов вместе со статистикой опозданий (столбцы справа), накопленной локально с момента запуска приложения.",
    typeFilterAll: "Все типы",
    sourceFilterAll: "Все маршруты",
    sourceFilterReal: "Только настоящие",
    sourceFilterDraft: "Только пробные",
    analyticsHint: "Статистика отклонений от графика, накопленная локально с момента запуска приложения.",
    colRoute: "Маршрут", colSamples: "Образцов", colAvgDev: "Среднее отклонение", colMaxDev: "Макс. опоздание",
    analyticsEmptyNoHistory: "История ещё не накоплена. Оставьте приложение запущенным — данные появятся в течение нескольких минут.",
    analyticsEmptyNoMatch: "Ничего не найдено",
    languageLabel: "Язык интерфейса",
    timezoneLabel: "Часовой пояс",
    autoOption: "Авто (по настройкам системы)",
    settingsNote: "Все времена в приложении (расписания, графики, аналитика) автоматически пересчитываются под выбранный часовой пояс. Исходные данные сервер всегда хранит в UTC.",
    tzDetected: "Определено автоматически: {tz}",
    modalType: "Тип", modalCircular: "Циклический", modalDepots: "Депо",
    modalActiveTrips: "Активных рейсов", modalTotalDuration: "Общее время в пути",
    modalTotalDwell: "Суммарная стоянка", modalStops: "Остановки маршрута", ctxRouteInfo: "Информация о маршруте",
    modalDepotDepartures: "Время отправлений из депо",
    modalStationTimetable: "Время отправления из депо и расписание по каждой станции (все рейсы дня)",
    modalNoActiveTrips: "Сейчас по этому маршруту нет активных рейсов — расписание показать нельзя.",
    modalEditedHint: "Серым шрифтом и пунктирной рамкой отмечены ячейки, время в которых изменено вручную (перетаскиванием на дашборде или графике).",
    openGraphForRoute: "Открыть график движения для этого маршрута",
    openReverseRoute: "Обратный маршрут",
    routeActionsMenu: "Действия ▾",
    createDraftFromRoute: "Создать пробный маршрут на основе этого",
    draftTemplateCopySuffix: "копия",
    modalFormulas: "Формула расписания для вставки в игру",
    modalFormulasHint: "Формат D+X*I: D — время первого отправления, X — количество дополнительных отправлений (0 и далее), I — интервал. Значения всегда в UTC (как ожидает сервер), независимо от выбранного часового пояса отображения. Если конкретное отправление сдвинуто вручную на графике — оно показано отдельной строкой со своим временем, а не входит в формулу.",
    formulaDepartures: "отправлений",
    formulaMinutesShort: "мин",
    formulaExplain: "{count} отправлений каждые {iMin} мин, первое в {dLocal} (в выбранном часовом поясе)",
    removeColumn: "Удалить этот рейс",
    addColumn: "Добавить отправление",
    removeColumnConfirm: "Удалить этот рейс из расписания пробного маршрута?",
    removeColumnLastError: "Нельзя удалить последнее отправление — у маршрута должен остаться хотя бы один рейс.",
    addColumnPrompt: "Время отправления (ЧЧ:ММ) в выбранном часовом поясе:",
    addColumnInvalid: "Некорректный формат времени. Введите в формате ЧЧ:ММ, например 08:30.",
    colDepotDeparture: "Время отправления",
    colStation: "Станция", colPlatform: "Платформа", colDwell: "Стоянка", colNext: "До следующей", colCoords: "Координаты",
    copyBtn: "Копировать", copiedBtn: "Скопировано",
    errLoading: "Ошибка загрузки: {msg}",
    errNotFound: "Не найдено",
    notAvailableShort: "—",
    addFavorite: "Добавить в избранное",
    favFilterAll: "Показать все маршруты",
    favFilterActive: "Только избранные маршруты",
    removeFavorite: "Убрать из избранного",
    favoritesLabel: "Избранное:",
    clearFavorites: "Очистить избранное",
    nearestTrainLabel: "Ближайшие прибытия",
    nearestNow: "Сейчас",
    nearestMin: "мин",
    actualArrivalHint: "Фактическое время прибытия (с учётом отклонения)",
    copiedOverrideMsg: "Сдвиг скопирован",
    notifAllow: "Разрешить уведомления",
    notifOnlyFav: "Уведомлять только по избранному",
    favStationHint: "Избранная станция — кликни для быстрого перехода",
    favRouteHint: "Избранный маршрут — кликни для открытия карточки",
    conflictSuggestTitle: "Найден конфликт — предложение:",
    conflictSuggestShift: "Сдвинуть {name} на {mins} мин",
    conflictSuggestApply: "Применить",
    conflictSuggestSkip: "Пропустить",
    problemsTabTitle: "Проблемные места",
    problemsHint: "Маршруты и станции с наибольшим числом конфликтов или опозданий",
    problemsTitleConflicts: "Больше всего конфликтов",
    problemsTitleDelays: "Наибольшее среднее опоздание",
    problemsTitleRoutes: "Наиболее затронутые маршруты",
    delayReplayTitle: "Воспроизведение опозданий",
    delayReplayHint: "Двигайте слайдер, чтобы посмотреть, как менялись опоздания в течение дня. Данные накапливаются локально с момента запуска приложения.",
    delayReplayNoData: "Данных об опозданиях ещё нет — они накапливаются по мере опроса сервера.",
    delayReplayTimeLabel: "Время",
    delayReplaySpeed: "Скорость",
    resetRouteEdits: "Сбросить правки этого маршрута",
    notifPermissionDenied: "Уведомления заблокированы в вашем браузере. Разрешите их в настройках браузера.",
    notifSettingsTitle: "Уведомления",
    notifConflict: "Уведомлять о новых конфликтах платформ",
    notifBigDelay: "Уведомлять о больших опозданиях (>5 мин)",
    notifThreshold: "Порог опоздания (мин)",
  },
  en: {
    appTitle: "GeoRail Schedule (MTR)",
    statusConnecting: "Connecting...",
    statusSynced: "Synced: {st} stations, {rt} routes",
    statusErrorConn: "Failed to connect to the MTR server",
    statusWaiting: "Waiting for first poll...",
    statusNoLocalServer: "No connection to local server",
    tabSchedule: "Station schedule",
    tabGraph: "Train graph",
    tabRoutes: "Routes",
    tabAnalytics: "Delay analytics",
    tabSettings: "Settings",
    tabInstructions: "Instructions",
    instructionsHint: "List of all app features — click an item to expand a detailed description.",
    tabDrafts: "Draft routes",
    draftsHint: "Create draft trips with the same parameters as real routes. The departure time from the first station is set manually. Draft routes are shown dashed on the dashboard and the train graph, alongside real ones.",
    newDraftBtn: "+ New draft route",
    editDraftTitle: "Edit draft route",
    draftNameLabel: "Name",
    draftNumberLabel: "Number",
    draftColorLabel: "Color",
    draftTypeLabel: "Type",
    draftDepotLabel: "Depot (optional)",
    draftDepartureLabel: "Departure time from the first station",
    draftIntervalLabel: "Interval (HH:MM:SS, optional)",
    draftIntervalHint: "If set, additional departures will be generated automatically for the whole day at this interval (starting from the time above). You can add/remove individual departures later directly in the route card.",
    draftIntervalInvalid: "Enter the interval as HH:MM:SS, e.g. 02:00:00.",
    draftStopsLabel: "Stops",
    draftNoStopsYet: "No stops yet — find a station in the field below to add one.",
    draftStopDwell: "dwell, s",
    draftStopDuration: "to next, s",
    customPlatformOption: "Other (enter manually)",
    saveBtn: "Save",
    cancelBtn: "Cancel",
    draftNeedTwoStops: "Add at least 2 stops.",
    draftNeedName: "Enter a route name.",
    draftEmptyList: "No draft routes yet.",
    draftBadge: "DRAFT",
    draftTooltip: "Draft route",
    draftConfirmDelete: "Delete this draft route?",
    draftEdit: "Edit",
    draftDelete: "Delete",
    stationPlaceholder: "Start typing a station name...",
    platformHeader: "Platform",
    dashboardEmptyDefault: "Select a station to see the platform arrivals dashboard",
    dashboardEmptyNoTrips: "No active trips through this station right now",
    scheduleMetaTemplate: "Station: {name} · platforms: {pc} · trips/day: {ec} · updated {time}",
    zoomLabel: "Zoom",
    zoomWheelHint: "Ctrl+mouse wheel over the chart also zooms.",
    minIntervalLabel: "Min. interval for conflict",
    minIntervalValue: "{m} min",
    platformsFilterLabel: "Platforms",
    selectAll: "All",
    selectNone: "None",
    resetEdits: "Reset manual edits",
    resetFilters: "Reset filters",
    dragHint: "Drag a train block horizontally with the mouse to manually shift its time — the edited trip becomes dashed. Hold Shift while dragging to shift ALL departures of this route for the whole day at once. Hold Alt and drag a block VERTICALLY (a full row height) to move the trip to a different platform.",
    dragHintGraph: "Drag a train line horizontally with the mouse to manually shift its time — the edited trip becomes dashed. Hold Shift while dragging to shift ALL trips of this route for the whole day at once.",
    platformLabel: "Platform",
    arrivalLabel: "Arrival",
    departureLabel: "Departure",
    deviationLabel: "Deviation",
    statusLabel: "Status",
    statusOrigin: "origin",
    statusTerminus: "terminus",
    onSchedule: "on schedule",
    editedLabel: "edited",
    platformMovedLabel: "platform changed",
    editedNote: "Time was edited manually",
    conflictLabel: "Platform conflict",
    conflictWith: "with trip {route} at {time}",
    graphHint: "Select two boundary stations — the system will find all routes passing through both and build a train graph (stations on the vertical axis are spaced by real distance; time runs horizontally; the slope of a line is the train's speed).",
    graphFromPlaceholder: "Station A...",
    graphToPlaceholder: "Station B...",
    buildGraphBtn: "Build graph",
    showReverseLabel: "Show reverse trips",
    stationsFilterLabel: "Stations on graph",
    graphEmptyDefault: "Select both stations and click “Build graph”",
    graphBuilding: "Building graph...",
    graphSelectBoth: "Select both stations from the suggestion list (click an option in the dropdown)",
    graphSameStation: "Select two different stations",
    graphNoRoutes: "No routes pass through both stations (or they have no active trips right now)",
    tripsPerDay: "trips/day",
    directionForward: "A → B",
    directionBackward: "B → A (reverse)",
    directionBackwardShort: "rev.",
    graphInactiveRoute: "No active trips on this route right now",
    routeSearchPlaceholder: "Search route...",
    colLine: "Line", colNumber: "No.", colType: "Type", colStops: "Stops",
    routesAnalyticsHint: "Route list together with delay statistics (columns on the right) accumulated locally since the app was started.",
    typeFilterAll: "All types",
    sourceFilterAll: "All routes",
    sourceFilterReal: "Real only",
    sourceFilterDraft: "Drafts only",
    analyticsHint: "Schedule-deviation statistics accumulated locally since the app was started.",
    colRoute: "Route", colSamples: "Samples", colAvgDev: "Average deviation", colMaxDev: "Max delay",
    analyticsEmptyNoHistory: "No history yet. Leave the app running — data will appear within a few minutes.",
    analyticsEmptyNoMatch: "No matches",
    languageLabel: "Interface language",
    timezoneLabel: "Timezone",
    autoOption: "Auto (use system setting)",
    settingsNote: "All times in the app (schedules, graphs, analytics) are automatically recalculated for the selected timezone. The server always stores raw data in UTC.",
    tzDetected: "Auto-detected: {tz}",
    modalType: "Type", modalCircular: "Circular", modalDepots: "Depots",
    modalActiveTrips: "Active trips", modalTotalDuration: "Total travel time",
    modalTotalDwell: "Total dwell time", modalStops: "Route stops", ctxRouteInfo: "Route info",
    modalDepotDepartures: "Departures from depot",
    modalStationTimetable: "Depot departure time and per-station timetable (all trips of the day)",
    modalNoActiveTrips: "This route has no active trips right now — no timetable to show.",
    modalEditedHint: "Cells with gray text and a dashed border have a time that was edited manually (by dragging on the dashboard or the train graph).",
    openGraphForRoute: "Open the train graph for this route",
    openReverseRoute: "Reverse route",
    routeActionsMenu: "Actions ▾",
    createDraftFromRoute: "Create a draft route based on this one",
    draftTemplateCopySuffix: "copy",
    modalFormulas: "Schedule formula to paste into the game",
    modalFormulasHint: "Format D+X*I: D is the first departure time, X is the number of additional departures (0 and up), I is the interval. Values are always in UTC (as the server expects), regardless of the selected display timezone. If a specific departure was manually shifted on the graph, it's shown as its own line with its own time, separate from the formula.",
    formulaDepartures: "departures",
    formulaMinutesShort: "min",
    formulaExplain: "{count} departures every {iMin} min, first at {dLocal} (in the selected timezone)",
    removeColumn: "Remove this trip",
    addColumn: "Add a departure",
    removeColumnConfirm: "Remove this trip from the draft route's schedule?",
    removeColumnLastError: "Can't remove the last departure — the route must keep at least one trip.",
    addColumnPrompt: "Departure time (HH:MM) in the selected timezone:",
    addColumnInvalid: "Invalid time format. Use HH:MM, e.g. 08:30.",
    colDepotDeparture: "Departure time",
    colStation: "Station", colPlatform: "Platform", colDwell: "Dwell", colNext: "To next", colCoords: "Coordinates",
    copyBtn: "Copy", copiedBtn: "Copied",
    errLoading: "Failed to load: {msg}",
    errNotFound: "Not found",
    notAvailableShort: "—",
    addFavorite: "Add to favorites",
    favFilterAll: "Show all routes",
    favFilterActive: "Favorites only",
    removeFavorite: "Remove from favorites",
    favoritesLabel: "Favorites:",
    clearFavorites: "Clear all favorites",
    nearestTrainLabel: "Upcoming arrivals",
    nearestNow: "Now",
    nearestMin: "min",
    actualArrivalHint: "Actual arrival (with deviation from schedule)",
    copiedOverrideMsg: "Time shift copied",
    notifAllow: "Allow notifications",
    notifOnlyFav: "Notify only about favorites",
    favStationHint: "Favorite station — click to open",
    favRouteHint: "Favorite route — click to open card",
    conflictSuggestTitle: "Conflict found — suggested fix:",
    conflictSuggestShift: "Shift {name} by {mins} min",
    conflictSuggestApply: "Apply",
    conflictSuggestSkip: "Skip",
    problemsTabTitle: "Problem areas",
    problemsHint: "Routes and stations with the most conflicts or delays",
    problemsTitleConflicts: "Most conflicts",
    problemsTitleDelays: "Largest average delay",
    problemsTitleRoutes: "Most affected routes",
    delayReplayTitle: "Delay replay",
    delayReplayHint: "Move the slider to replay how delays evolved during the day. Data is accumulated locally since the app started.",
    delayReplayNoData: "No delay history yet — data accumulates as the app polls the server.",
    delayReplayTimeLabel: "Time",
    delayReplaySpeed: "Speed",
    resetRouteEdits: "Reset edits for this route",
    sourceFilterAll: "All routes", sourceFilterReal: "Real only", sourceFilterDraft: "Drafts only",
    notifPermissionDenied: "Notifications are blocked in your browser. Allow them in browser settings.",
    notifSettingsTitle: "Notifications",
    notifConflict: "Notify on new conflicts",
    notifBigDelay: "Notify on large delays (>5 min)",
    notifThreshold: "Delay threshold (min)",
  },
};

function detectSystemLang() {
  const l = (navigator.language || "en").toLowerCase();
  if (l.startsWith("ru")) return "ru";
  if (l.startsWith("de")) return "de";
  if (l.startsWith("fr")) return "fr";
  if (l.startsWith("pl")) return "pl";
  if (l.startsWith("pt")) return "pt";
  if (l.startsWith("cs")) return "cs";
  return "en";
}
function detectSystemTzOffsetMin() {
  return -new Date().getTimezoneOffset();
}
function detectSystemTzName() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

const settings = {
  langMode: localStorage.getItem("mtr_lang_mode") || "auto",
  tzMode: localStorage.getItem("mtr_tz_mode") || "auto",
};
function currentLang() {
  return settings.langMode === "auto" ? detectSystemLang() : settings.langMode;
}
function currentTzOffsetMin() {
  return settings.tzMode === "auto" ? detectSystemTzOffsetMin() : Number(settings.tzMode);
}
function t(key, vars) {
  const dict = I18N[currentLang()] || I18N.en;
  let str = dict[key] ?? I18N.en[key] ?? key;
  if (vars) {
    for (const k in vars) str = str.replace(`{${k}}`, vars[k]);
  }
  return str;
}

function applyI18n() {
  document.documentElement.lang = currentLang();
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
}

// ============================================================
// Время / часовой пояс
// ============================================================
function normalizeMs(ms) {
  const m = ms % MS_PER_DAY;
  return m < 0 ? m + MS_PER_DAY : m;
}
function formatLocal(msUtc, withSeconds) {
  const offsetMin = currentTzOffsetMin();
  const total = normalizeMs(Math.round(msUtc) + offsetMin * 60000);
  const totalSec = Math.floor(total / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return withSeconds ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(h)}:${pad(m)}`;
}
function formatEpochLocal(ts) {
  const d = new Date(ts + currentTzOffsetMin() * 60000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

// ============================================================
// Общие хелперы
// ============================================================
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
/**
 * Оценка релевантности текста относительно поискового запроса.
 * Возвращает null, если совпадения нет вообще. Чем МЕНЬШЕ число — тем
 * релевантнее: точное совпадение с начала строки лучше, чем совпадение
 * где-то в середине длинной строки; совпадение целого слова — лучше,
 * чем совпадение внутри слова.
 */
/** Убирает знаки препинания для поиска ("Москва-Сити" ~ "москва сити"). */
function normalizeForSearch(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()'"«»№?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function fuzzySearchScore(text, query) {
  const t = normalizeForSearch(text);
  const q = normalizeForSearch(query);
  if (!q) return 0;
  const idx = t.indexOf(q);
  if (idx === -1) return null;
  const isWordStart = idx === 0 || t[idx - 1] === " ";
  let score = idx * 10 + t.length * 0.1;
  if (!isWordStart) score += 500; // совпадение не с начала слова — менее релевантно
  if (idx === 0) score -= 1000; // точное совпадение с начала строки — самое релевантное
  return score;
}
function fuzzyFilterAndSort(items, query, getText) {
  const q = (query || "").trim();
  if (!q) return items;
  return items
    .map((it) => ({ it, score: fuzzySearchScore(getText(it), q) }))
    .filter((x) => x.score !== null)
    .sort((a, b) => a.score - b.score)
    .map((x) => x.it);
}
function deviationClass(ms) {
  if (Math.abs(ms) <= 60000) return "dev-zero";
  return ms > 0 ? "dev-pos" : "dev-neg";
}
function formatDeviation(ms) {
  if (Math.abs(ms) <= 60000) return t("onSchedule");
  const sign = ms > 0 ? "+" : "−";
  const totalSec = Math.round(Math.abs(ms) / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const unit = currentLang() === "ru" ? `${m}м ${s}с` : `${m}m ${s}s`;
  return `${sign}${unit}`;
}
/** Локализованное "N мин" / "N min" — переиспользуется везде, где нужно
 * показать длительность в минутах (правки, перегоны и т.п.). */
/** Парсит строку "ЧЧ:ММ:СС" (или "Ч:ММ:СС") в миллисекунды. null, если формат некорректный. */
function parseHmsToMs(str) {
  const m = (str || "").trim().match(/^(\d{1,2}):([0-5]\d):([0-5]\d)$/);
  if (!m) return null;
  const h = Number(m[1]);
  if (h > 47) return null; // разумный потолок, чтобы не вводили совсем бессмысленные значения
  return (h * 3600 + Number(m[2]) * 60 + Number(m[3])) * 1000;
}
/** Форматирует миллисекунды в строку "ЧЧ:ММ:СС". */
function formatMsToHms(ms) {
  const totalSec = Math.round(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
/**
 * Округляет миллисекунды до ближайших 30 секунд:
 * <15с → 0, 15..44с → 30, 45+с → 60 (т.е. следующая минута).
 * Используется при формировании формул D+X*I чтобы добиться
 * корректной группировки отправлений.
 */
function roundMsTo30s(ms) {
  const sec = Math.round(ms / 1000);
  const remainder = sec % 60;
  let rounded;
  if (remainder < 15) rounded = sec - remainder;          // → 0
  else if (remainder < 45) rounded = sec - remainder + 30; // → 30
  else rounded = sec - remainder + 60;                    // → 60 (следующая мин)
  return rounded * 1000;
}
function formatMsToHmsRounded(ms) {
  return formatMsToHms(roundMsTo30s(ms));
}
/** Маска ввода "только цифры -> ЧЧ:ММ:СС" для текстовых полей времени. */
function attachHmsInputMask(inputEl) {
  inputEl.addEventListener("input", () => {
    let digits = inputEl.value.replace(/\D/g, "").slice(0, 6);
    let out = "";
    if (digits.length <= 2) {
      out = digits;
    } else if (digits.length <= 4) {
      out = `${digits.slice(0, 2)}:${digits.slice(2)}`;
    } else {
      out = `${digits.slice(0, 2)}:${digits.slice(2, 4)}:${digits.slice(4)}`;
    }
    inputEl.value = out;
  });
}

function formatMinutesShort(mins) {
  return currentLang() === "ru" ? `${mins} мин` : `${mins} min`;
}
function formatSecondsShort(sec) {
  return currentLang() === "ru" ? `${sec}с` : `${sec}s`;
}
/** Маленький значок "!" с подсказкой при наведении — отмечает пробные маршруты везде в приложении. */
function draftFlagHtml() {
  return `<span class="draft-flag" title="${escapeHtml(t("draftTooltip"))}">!</span>`;
}

// ============================================================
// Хранилище ручных правок (drag), общее для дашборда и графика
//
// ВАЖНО: раньше правка привязывалась к ТОЧНОМУ значению tripOriginMs (t0).
// Если сервер MTR между опросами не возвращает строго одно и то же t0
// для одного и того же рейса (например, из-за пересчёта окна отправлений
// в реальном времени), точное совпадение переставало находиться и правка
// "слетала" при следующем автообновлении дашборда. Чтобы это исправить,
// поиск правки теперь идёт по БЛИЖАЙШЕМУ t0 в пределах допуска, а не по
// точному равенству.
// ============================================================
const OVERRIDE_MATCH_TOLERANCE_MS = 90000; // 90 секунд

let overridesList = JSON.parse(localStorage.getItem("mtr_overrides_v2") || "[]");

function circularDiff(a, b) {
  const raw = Math.abs(a - b) % MS_PER_DAY;
  return Math.min(raw, MS_PER_DAY - raw);
}
function findOverrideIndex(routeId, tripOriginMs) {
  let bestIdx = -1, bestDiff = Infinity;
  overridesList.forEach((o, i) => {
    if (o.routeId !== routeId) return;
    const diff = circularDiff(o.t0, tripOriginMs);
    if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
  });
  return bestIdx !== -1 && bestDiff <= OVERRIDE_MATCH_TOLERANCE_MS ? bestIdx : -1;
}
function getOverride(routeId, tripOriginMs) {
  const idx = findOverrideIndex(routeId, tripOriginMs);
  const tripDelta = idx === -1 ? 0 : overridesList[idx].deltaMs;
  return tripDelta + getRouteOverride(routeId);
}
function setOverride(routeId, tripOriginMs, deltaMs) {
  const idx = findOverrideIndex(routeId, tripOriginMs);
  if (idx === -1) overridesList.push({ routeId, t0: tripOriginMs, deltaMs });
  // Обновляем и "якорь" t0 на актуальный — если значение реально немного
  // сдвинулось, следующий поиск будет ещё точнее.
  else overridesList[idx] = { routeId, t0: tripOriginMs, deltaMs };
  persistOverrides();
}
function clearOverrides() {
  overridesList = [];
  persistOverrides();
}
function persistOverrides() {
  localStorage.setItem("mtr_overrides_v2", JSON.stringify(overridesList));
}

// Отдельный слой: сдвиг ВСЕГО маршрута целиком (Shift+перетаскивание).
// Складывается с индивидуальной правкой конкретного рейса.
let routeOverridesMap = JSON.parse(localStorage.getItem("mtr_route_overrides") || "{}");
function getRouteOverride(routeId) { return routeOverridesMap[routeId] || 0; }
function bumpRouteOverride(routeId, deltaMs) {
  routeOverridesMap[routeId] = getRouteOverride(routeId) + deltaMs;
  localStorage.setItem("mtr_route_overrides", JSON.stringify(routeOverridesMap));
}
function clearAllOverrides() {
  overridesList = [];
  routeOverridesMap = {};
  platformOverridesMap = {};
  persistOverrides();
  localStorage.setItem("mtr_route_overrides", JSON.stringify(routeOverridesMap));
  localStorage.setItem("mtr_platform_overrides", JSON.stringify(platformOverridesMap));
}
/** Очищает правки только одного маршрута, не трогая остальные. */
function clearOverridesForRoute(routeId) {
  pushUndoSnapshot();
  overridesList = overridesList.filter((o) => o.routeId !== routeId);
  delete routeOverridesMap[routeId];
  persistOverrides();
  localStorage.setItem("mtr_route_overrides", JSON.stringify(routeOverridesMap));
  localStorage.setItem("mtr_platform_overrides", JSON.stringify(platformOverridesMap));
  renderDashboardFromCache();
  renderGraphFromCache();
}

// Отдельный слой: ручной перенос рейса на другую платформу (вертикальное
// перетаскивание на дашборде, см. ниже). Тоже привязан к (routeId, t0).
let platformOverridesMap = JSON.parse(localStorage.getItem("mtr_platform_overrides") || "{}");
function getPlatformOverride(routeId, tripOriginMs) {
  return platformOverridesMap[`${routeId}:${tripOriginMs}`] || null;
}
function setPlatformOverride(routeId, tripOriginMs, platformName) {
  platformOverridesMap[`${routeId}:${tripOriginMs}`] = platformName;
  localStorage.setItem("mtr_platform_overrides", JSON.stringify(platformOverridesMap));
}

// ============================================================
// Undo / Redo (Ctrl+Z / Ctrl+Y) для ручных правок (drag-редактирование)
// ============================================================
const undoStack = [];
const redoStack = [];
const UNDO_STACK_LIMIT = 100;

function snapshotOverridesState() {
  return {
    overridesList: JSON.parse(JSON.stringify(overridesList)),
    routeOverridesMap: JSON.parse(JSON.stringify(routeOverridesMap)),
    platformOverridesMap: JSON.parse(JSON.stringify(platformOverridesMap)),
  };
}
/** Вызывать ПЕРЕД любым изменением правок — запоминает состояние "до". */
function pushUndoSnapshot() {
  undoStack.push(snapshotOverridesState());
  if (undoStack.length > UNDO_STACK_LIMIT) undoStack.shift();
  redoStack.length = 0; // новое действие обнуляет историю "вперёд"
}
function applyOverridesSnapshot(snap) {
  overridesList = snap.overridesList;
  routeOverridesMap = snap.routeOverridesMap;
  platformOverridesMap = snap.platformOverridesMap || {};
  persistOverrides();
  localStorage.setItem("mtr_route_overrides", JSON.stringify(routeOverridesMap));
  localStorage.setItem("mtr_platform_overrides", JSON.stringify(platformOverridesMap));
  renderDashboardFromCache();
  renderGraphFromCache();
}
function undoLastEdit() {
  if (undoStack.length === 0) return;
  redoStack.push(snapshotOverridesState());
  applyOverridesSnapshot(undoStack.pop());
}
function redoLastEdit() {
  if (redoStack.length === 0) return;
  undoStack.push(snapshotOverridesState());
  applyOverridesSnapshot(redoStack.pop());
}
document.addEventListener("keydown", (e) => {
  // Не перехватываем горячие клавиши, если фокус в текстовом поле —
  // иначе сломаем нативный undo/redo при наборе текста в формах.
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
  if (!(e.ctrlKey || e.metaKey)) return;
  // Используем e.code (физическое положение клавиши), а не e.key —
  // e.key зависит от текущей раскладки клавиатуры (например, на
  // немецкой/русской раскладке "та же" физическая клавиша может выдавать
  // другой символ), из-за чего Ctrl+Z/Ctrl+Y могли не срабатывать.
  if (e.code === "KeyZ" && !e.shiftKey) {
    e.preventDefault();
    undoLastEdit();
  } else if (e.code === "KeyY" || (e.code === "KeyZ" && e.shiftKey)) {
    e.preventDefault();
    redoLastEdit();
  }
});

// ============================================================
// Состояние приложения
// ============================================================
const state = {
  stations: [],
  routes: [],
  routesById: new Map(),
  currentStationId: null,
  lastScheduleData: null,
  lastGraphData: null,
  lastAnalytics: [],
  lastRouteDetail: null,
  drafts: [],

  dashPxPerHour: 110,
  minIntervalMin: 3,
  platformFilter: new Set(),
  platformFilterStationId: null,

  graphPxPerHour: 110,
  showReverse: false,
  graphStationFilter: new Set(),
  graphFilterKey: null,
  graphRouteOverrides: new Map(),

  currentDashboardEntries: [],
  currentDashboardPlatforms: [],
  routeSort: { key: null, dir: 1 },
  currentGraphRoutes: [],
  conflictDetails: new Map(),
};

// ============================================================
// Автокомплит
// ============================================================
function makeAutocomplete({ inputEl, listEl, getItems, onSelect }) {
  let selectedId = null;
  function render(filterText) {
    const items = getItems();
    const q = filterText.trim();
    const filtered = (q ? fuzzyFilterAndSort(items, q, (it) => it.name) : items).slice(0, 60);
    listEl.innerHTML = filtered.length
      ? filtered.map((it) => `<div class="autocomplete-item" data-id="${escapeHtml(it.id)}">${escapeHtml(it.name)}</div>`).join("")
      : `<div class="autocomplete-item ac-empty">${escapeHtml(t("analyticsEmptyNoMatch"))}</div>`;
    listEl.classList.add("open");
  }
  listEl.addEventListener("mousedown", (e) => {
    const item = e.target.closest(".autocomplete-item[data-id]");
    if (!item) return;
    e.preventDefault();
    const id = item.dataset.id;
    const found = getItems().find((it) => it.id === id);
    if (!found) return;
    selectedId = id;
    inputEl.value = found.name;
    listEl.classList.remove("open");
    onSelect(id, found);
  });
  inputEl.addEventListener("input", () => { selectedId = null; render(inputEl.value); });
  inputEl.addEventListener("focus", () => render(inputEl.value));
  inputEl.addEventListener("blur", () => setTimeout(() => listEl.classList.remove("open"), 150));
  return {
    getSelectedId: () => selectedId,
    setSelected: (id, name) => { selectedId = id; inputEl.value = name; },
  };
}
// Подстраховка: закрываем ВСЕ открытые подсказки при клике где угодно
// вне соответствующего поля (blur не всегда срабатывает вовремя при
// клике по другим элементам интерфейса — кнопкам, сайдбару и т.д.).
document.addEventListener("click", (e) => {
  if (e.target.closest(".autocomplete")) return;
  document.querySelectorAll(".autocomplete-list.open").forEach((el) => el.classList.remove("open"));
});

// ============================================================
// Вкладки
// ============================================================
// ============================================================
// Проблемные места — коллапсируемые секции, избранные первыми
// ============================================================
function renderProblems() {
  const el = document.getElementById("problemsContent");
  if (!el) return;

  const favRouteIds = new Set(favoriteRoutes.map((r) => r.id));
  const favStationIds = new Set(favorites.map((s) => s.id));

  // Используем накопленные конфликты (собираются по мере открытия станций на дашборде)
  const allStationConflicts = Array.from((state._conflictedStations || new Map()).values());
  const conflictsByRoute = new Map();
  for (const st of allStationConflicts) {
    for (const rid of st.routeIds || []) {
      if (!conflictsByRoute.has(rid)) conflictsByRoute.set(rid, []);
      conflictsByRoute.get(rid).push(st.stationId);
    }
  }

  const byDelay = state.lastAnalytics
    .filter((a) => a.sampleCount >= 3 && a.avgDeviationMs > 0)
    .sort((a, b) => {
      const fa = favRouteIds.has(a.routeId) ? 0 : 1, fb = favRouteIds.has(b.routeId) ? 0 : 1;
      if (fa !== fb) return fa - fb;
      return b.avgDeviationMs - a.avgDeviationMs;
    })
    .slice(0, 20);

  const makeSection = (id, title, count, innerHtml) => `
    <div class="problems-section" id="ps-${id}">
      <div class="problems-section-header" data-toggle="ps-${id}">
        <span>${escapeHtml(title)}</span>
        ${count > 0 ? `<span class="problems-count-badge">${count}</span>` : ""}
        <span class="problems-chevron">▼</span>
      </div>
      <div class="problems-section-body">
        ${innerHtml || `<p class="hint small">${escapeHtml(t("analyticsEmptyNoHistory"))}</p>`}
      </div>
    </div>`;

  const stItems = allStationConflicts
    .sort((a, b) => (favStationIds.has(b.stationId) ? 1 : 0) - (favStationIds.has(a.stationId) ? 1 : 0));
  const stHtml = stItems.length
    ? `<div class="problems-grid">${stItems.slice(0, 30).map((st) =>
        `<div class="problem-card" data-goto-station="${escapeHtml(st.stationId)}" style="cursor:pointer;">
          <div class="problem-card-name">${favStationIds.has(st.stationId) ? "★ " : ""}${escapeHtml(st.stationName)}</div>
          <div class="problem-card-sub">${st.conflictCount} ${escapeHtml(t("conflictLabel")).toLowerCase()}</div>
        </div>`).join("")}</div>`
    : "";

  const rtItems = Array.from(conflictsByRoute.entries())
    .sort(([aId, aSt], [bId, bSt]) => {
      const fa = favRouteIds.has(aId) ? 0 : 1, fb = favRouteIds.has(bId) ? 0 : 1;
      if (fa !== fb) return fa - fb;
      return bSt.length - aSt.length;
    });
  const rtHtml = rtItems.length
    ? `<div class="problems-grid">${rtItems.slice(0, 20).map(([rid, sts]) => {
        const r = state.routesById.get(rid);
        const label = r ? (r.name + (r.number ? ` · ${r.number}` : "")) : rid;
        return `<div class="problem-card clickable-row" data-route-id="${escapeHtml(rid)}" style="border-left:3px solid ${r?.color || "#888"}">
          <div class="problem-card-name">${favRouteIds.has(rid) ? "★ " : ""}${escapeHtml(label)}</div>
          <div class="problem-card-sub">${sts.length} ${escapeHtml(t("colStation")).toLowerCase()}</div>
        </div>`;
      }).join("")}</div>`
    : "";

  const delayHtml = byDelay.length
    ? `<div class="problems-grid">${byDelay.map((a) => {
        const r = state.routesById.get(a.routeId);
        const label = r ? (r.name + (r.number ? ` · ${r.number}` : "")) : a.routeId;
        return `<div class="problem-card clickable-row" data-route-id="${escapeHtml(a.routeId)}" style="border-left:3px solid ${r?.color || "#888"}">
          <div class="problem-card-name">${favRouteIds.has(a.routeId) ? "★ " : ""}${escapeHtml(label)}</div>
          <div class="problem-card-sub ${deviationClass(a.avgDeviationMs)}">${formatDeviation(a.avgDeviationMs)} · ${a.sampleCount} ${escapeHtml(t("colSamples")).toLowerCase()}</div>
        </div>`;
      }).join("")}</div>`
    : "";

  el.innerHTML =
    makeSection("conflicts-st", t("problemsTitleConflicts") + " — " + t("colStation"), stItems.length, stHtml) +
    makeSection("conflicts-rt", t("problemsTitleConflicts") + " — " + t("tabRoutes"), rtItems.length, rtHtml) +
    makeSection("delays", t("problemsTitleDelays"), byDelay.length, delayHtml);

  el.querySelectorAll(".problems-section-header").forEach((h) => {
    h.addEventListener("click", () => document.getElementById(h.dataset.toggle)?.classList.toggle("open"));
  });
  el.querySelectorAll("[data-goto-station]").forEach((card) => {
    card.addEventListener("click", (ev) => {
      if (ev.target.closest("[data-route-id]")) return;
      const sid = card.dataset.gotoStation;
      const st = state.stations.find((s) => s.id === sid);
      if (!st) return;
      switchToTab("schedule");
      scheduleAC.setSelected(st.id, st.name);
      state.currentStationId = st.id;
      state._dashboardScrolled = false;
      renderFavoritesBar(); updateFavoriteBtn(); updateUrlHash(); loadSchedule();
    });
  });
  el.querySelectorAll("[data-route-id]").forEach((card) => {
    card.addEventListener("click", () => openRouteModal(card.dataset.routeId));
  });
  el.querySelector(".problems-section")?.classList.add("open");
}

function switchToTab(tabName) {
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
  document.querySelector(`.tab-btn[data-tab="${tabName}"]`).classList.add("active");
  document.getElementById(`tab-${tabName}`).classList.add("active");
  if (tabName === "routes") loadRoutes();
  if (tabName === "problems") renderProblems();
}
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => switchToTab(btn.dataset.tab));
});

// ============================================================
// Статус
// ============================================================
async function refreshStatus() {
  const badge = document.getElementById("statusBadge");
  try {
    const res = await fetch("/api/status");
    const data = await res.json();
    const hasErrors = data.topology.lastError || data.departures.lastError;
    const hasData = data.topology.fetchedAt && data.departures.fetchedAt;
    if (hasErrors && !hasData) {
      badge.textContent = t("statusErrorConn");
      badge.className = "status-badge error";
    } else if (hasData) {
      badge.textContent = t("statusSynced", { st: data.topology.stationCount, rt: data.topology.routeCount });
      badge.className = "status-badge ok";
    } else {
      badge.textContent = t("statusWaiting");
      badge.className = "status-badge";
    }
  } catch {
    badge.textContent = t("statusNoLocalServer");
    badge.className = "status-badge error";
  }
}

// ============================================================
// Станции
// ============================================================
async function loadStations() {
  const MAX = 8;
  for (let attempt = 1; attempt <= MAX; attempt++) {
    try {
      const res = await fetch("/api/stations");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) throw new Error("empty");
      state.stations = data;
      renderFavoritesBar();
      updateFavoriteBtn();
      return;
    } catch (err) {
      if (attempt === MAX) { console.error("loadStations: все попытки исчерпаны:", err); return; }
      await new Promise((r) => setTimeout(r, attempt * 300));
    }
  }
}

const scheduleAC = makeAutocomplete({
  inputEl: document.getElementById("stationInput"),
  listEl: document.getElementById("stationACList"),
  getItems: () => state.stations,
  onSelect: (id) => {
    state.currentStationId = id;
    state._dashboardScrolled = false; // сброс при смене станции
    renderFavoritesBar(); // перерисовываем подсветку сразу при смене станции
    loadSchedule();
  },
});
const graphFromAC = makeAutocomplete({
  inputEl: document.getElementById("graphFromInput"),
  listEl: document.getElementById("graphFromACList"),
  getItems: () => state.stations,
  onSelect: () => {},
});
const graphToAC = makeAutocomplete({
  inputEl: document.getElementById("graphToInput"),
  listEl: document.getElementById("graphToACList"),
  getItems: () => state.stations,
  onSelect: () => {},
});

// ============================================================
// Конфликты на платформе
// ============================================================
function computeConflicts(entries, minIntervalMs) {
  const byPlatform = new Map();
  for (const e of entries) {
    const key = e.platformName || "—";
    if (!byPlatform.has(key)) byPlatform.set(key, []);
    byPlatform.get(key).push(e);
  }
  const conflictKeys = new Set();
  const details = new Map();
  const addDetail = (key, partner) => {
    if (!details.has(key)) details.set(key, []);
    // Не дублируем одного и того же партнёра
    if (!details.get(key).some((p) => p.entryKey === partner.entryKey)) {
      details.get(key).push(partner);
    }
  };
  for (const list of byPlatform.values()) {
    const sorted = list.slice().sort((a, b) => a.effArrival - b.effArrival);
    for (let i = 0; i < sorted.length; i++) {
      const cur = sorted[i];
      // Платформа занята до max(effDeparture, effArrival + dwellTimeMs).
      // Для конечных станций effDeparture=null, но стоянка всё равно занимает платформу.
      const curDwellEnd = cur.effArrival + (cur.dwellTimeMs || 0);
      const curEnd = Math.max(cur.effDeparture ?? cur.effArrival, curDwellEnd);

      for (let j = i + 1; j < sorted.length; j++) {
        const next = sorted[j];
        // Ранний выход: следующий поезд приедет так поздно, что у него уже не будет
        // конфликта с curEnd + minIntervalMs. НО нужно учитывать dwellTime cur:
        // курсор = curEnd (уже включает dwell), а не просто effArrival.
        if (next.effArrival >= curEnd + minIntervalMs) break;
        const isTurnaround = (cur.isTerminus && next.isOrigin) || (next.isTerminus && cur.isOrigin);
        if (isTurnaround) continue;
        // Два случая конфликта:
        // 1. Физическое перекрытие стоянки: next приезжает пока cur ещё стоит
        //    → ВСЕГДА конфликт, независимо от minIntervalMs
        // 2. Минимальный интервал: next приезжает слишком скоро после отправления cur
        //    → конфликт только если gap < minIntervalMs
        const isPhysicalOverlap = next.effArrival < curEnd;
        const isTooClose = next.effArrival < curEnd + minIntervalMs;
        if (isPhysicalOverlap || isTooClose) {
          conflictKeys.add(cur.entryKey);
          conflictKeys.add(next.entryKey);
          addDetail(cur.entryKey, next);
          addDetail(next.entryKey, cur);
        }
      }
    }
  }
  return { conflictKeys, details };
}

// ============================================================
// Дашборд расписания по станции
// ============================================================
const dashboardEmpty = document.getElementById("dashboardEmpty");
const dashboardEl = document.getElementById("dashboard");
const dashboardRuler = document.getElementById("dashboardRuler");
const dashboardPlatforms = document.getElementById("dashboardPlatforms");
const dashboardGrid = document.getElementById("dashboardGrid");
const rulerScroll = document.getElementById("rulerScroll");
const gridScroll = document.getElementById("gridScroll");
const scheduleMeta = document.getElementById("scheduleMeta");
const entryTooltip = document.getElementById("entryTooltip");

gridScroll.addEventListener("scroll", () => {
  rulerScroll.scrollLeft = gridScroll.scrollLeft;
});

function dashTimelineWidth() { return state.dashPxPerHour * 24; }

/**
 * Шаг делений шкалы времени (в минутах) в зависимости от текущего
 * масштаба: чем крупнее зум, тем мельче деления — вплоть до минут.
 * tick — шаг самих засечек, label — шаг, с которым на них подписывается
 * время (засечки чаще подписей, чтобы текст не накладывался друг на друга).
 */
function getTickSteps(pxPerHour) {
  if (pxPerHour < 60) return { tick: 120, label: 120 };
  if (pxPerHour < 150) return { tick: 60, label: 60 };
  if (pxPerHour < 300) return { tick: 30, label: 30 };
  if (pxPerHour < 500) return { tick: 10, label: 10 };
  if (pxPerHour < 700) return { tick: 5, label: 5 };
  return { tick: 1, label: 5 };
}

function buildRulerHtml(pxPerHour) {
  const { tick, label } = getTickSteps(pxPerHour);
  const pxPerMin = pxPerHour / 60;
  let html = "";
  for (let m = 0; m <= 24 * 60; m += tick) {
    const hasLabel = m % label === 0;
    const isHour = m % 60 === 0;
    html += `<div class="tick ${isHour ? "tick-hour" : "tick-minor"}" style="left:${m * pxPerMin}px">${hasLabel ? formatLocal(m * 60000) : ""}</div>`;
  }
  return html;
}

function renderPlatformFilterList() {
  const data = state.lastScheduleData;
  const container = document.getElementById("platformFilterList");
  if (!data || !data.platforms || data.platforms.length === 0) {
    container.innerHTML = "";
    return;
  }
  if (state.platformFilterStationId !== data.stationId) {
    state.platformFilter = new Set(data.platforms);
    state.platformFilterStationId = data.stationId;
  }
  container.innerHTML = data.platforms
    .map(
      (p) => `<label><input type="checkbox" data-platform="${escapeHtml(p)}" ${state.platformFilter.has(p) ? "checked" : ""}> ${escapeHtml(p)}</label>`
    )
    .join("");
  container.querySelectorAll("input[type=checkbox]").forEach((cb) => {
    cb.addEventListener("change", () => {
      const p = cb.dataset.platform;
      if (cb.checked) state.platformFilter.add(p);
      else state.platformFilter.delete(p);
      renderDashboardFromCache();
    });
  });
}

document.getElementById("platformsSelectAll").addEventListener("click", () => {
  if (state.lastScheduleData) state.platformFilter = new Set(state.lastScheduleData.platforms);
  renderPlatformFilterList();
  renderDashboardFromCache();
});
document.getElementById("platformsSelectNone").addEventListener("click", () => {
  state.platformFilter = new Set();
  renderPlatformFilterList();
  renderDashboardFromCache();
});
document.getElementById("resetDashOverridesBtn").addEventListener("click", () => {
  pushUndoSnapshot();
  clearAllOverrides();
  renderDashboardFromCache();
  renderGraphFromCache();
});
document.getElementById("resetGraphOverridesBtn").addEventListener("click", () => {
  pushUndoSnapshot();
  clearAllOverrides();
  renderDashboardFromCache();
  renderGraphFromCache();
});
document.getElementById("resetDashFiltersBtn").addEventListener("click", () => {
  if (state.lastScheduleData) state.platformFilter = new Set(state.lastScheduleData.platforms);
  state.minIntervalMin = 3;
  minIntervalSlider.value = "3";
  document.getElementById("minIntervalValue").textContent = t("minIntervalValue", { m: state.minIntervalMin });
  state.dashPxPerHour = 110;
  document.getElementById("dashZoomValue").textContent = "100%";
  renderPlatformFilterList();
  renderDashboardFromCache();
});
document.getElementById("resetGraphFiltersBtn").addEventListener("click", () => {
  if (state.lastGraphData) state.graphStationFilter = new Set(state.lastGraphData.stations.map((s) => s.stationId));
  state.showReverse = false;
  state.graphRouteOverrides = new Map();
  document.getElementById("showReverseToggle").checked = false;
  state.graphPxPerHour = 110;
  document.getElementById("graphZoomValue").textContent = "100%";
  renderGraphStationFilterList(state.lastGraphData || { stations: [], fromStationId: "", toStationId: "" });
  renderGraphFromCache();
});

const minIntervalSlider = document.getElementById("minIntervalSlider");
minIntervalSlider.addEventListener("input", () => {
  state.minIntervalMin = Number(minIntervalSlider.value);
  document.getElementById("minIntervalValue").textContent = t("minIntervalValue", { m: state.minIntervalMin });
  renderDashboardFromCache();
});

const ZOOM_BASE_PX_PER_HOUR = 110; // соответствует 100%

function makeZoomController({ get, set, valueId, outBtnId, inBtnId, scrollEl, min = 20, max = 1100, step = 20 }) {
  const valueEl = document.getElementById(valueId);
  function apply(newVal) {
    const clamped = Math.max(min, Math.min(max, Math.round(newVal)));
    set(clamped);
    valueEl.textContent = `${Math.round((clamped / ZOOM_BASE_PX_PER_HOUR) * 100)}%`;
  }
  document.getElementById(outBtnId).addEventListener("click", () => apply(get() - step));
  document.getElementById(inBtnId).addEventListener("click", () => apply(get() + step));
  // Ctrl + колесо мыши над графиком — масштабирование без отдельного слайдера.
  scrollEl.addEventListener(
    "wheel",
    (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      apply(get() + (e.deltaY < 0 ? step : -step));
    },
    { passive: false }
  );
  valueEl.textContent = `${Math.round((get() / ZOOM_BASE_PX_PER_HOUR) * 100)}%`;
}
// Сами вызовы (привязка к gridScroll/graphWrap) — ниже по файлу, после
// объявления соответствующих DOM-констант (см. initZoomControllers()).

function renderDashboardFromCache() {
  if (state.lastScheduleData) renderDashboard(state.lastScheduleData);
}

function renderDashboard(data) {
  if (!data || !data.entries || data.entries.length === 0) {
    dashboardEl.style.display = "none";
    dashboardEmpty.style.display = "block";
    dashboardEmpty.textContent = data && data.entries ? t("dashboardEmptyNoTrips") : t("dashboardEmptyDefault");
    return;
  }

  renderPlatformFilterList();

  const TIMELINE_WIDTH = dashTimelineWidth();
  const visiblePlatforms = data.platforms.filter((p) => state.platformFilter.has(p));

  if (visiblePlatforms.length === 0) {
    dashboardEl.style.display = "none";
    dashboardEmpty.style.display = "block";
    dashboardEmpty.textContent = t("dashboardEmptyNoTrips");
    return;
  }

  dashboardEmpty.style.display = "none";
  dashboardEl.style.display = "grid";
  dashboardRuler.style.width = TIMELINE_WIDTH + "px";
  dashboardRuler.innerHTML = buildRulerHtml(state.dashPxPerHour);

  const minIntervalMs = state.minIntervalMin * 60000;

  // Применяем ручные правки и считаем эффективные времена.
  const processed = data.entries
    .map((e) => {
      const delta = getOverride(e.routeId, e.tripOriginMs);
      const effArrival = normalizeMs(e.arrivalMs + delta);
      const effDeparture = e.departureMs === null ? null : normalizeMs(e.departureMs + delta);
      const platformOverride = getPlatformOverride(e.routeId, e.tripOriginMs);
      const effPlatform = platformOverride && data.platforms.includes(platformOverride) ? platformOverride : e.platformName;
      return {
        ...e,
        entryKey: `${e.routeId}:${e.tripOriginMs}:${e.platformName}`,
        delta,
        isEdited: delta !== 0,
        effArrival,
        effDeparture,
        effPlatform,
        isPlatformMoved: effPlatform !== e.platformName,
      };
    })
    .filter((e) => visiblePlatforms.includes(e.effPlatform));

  const { conflictKeys, details } = computeConflicts(processed, minIntervalMs);
  state.conflictDetails = details;
  state.currentDashboardEntries = processed;
  state.currentDashboardPlatforms = visiblePlatforms;

  // Накапливаем конфликтные станции/маршруты глобально для вкладки "Проблемные места"
  if (conflictKeys.size > 0 && state.currentStationId) {
    const sId = state.currentStationId;
    const sName = data.stationName;
    if (!state._conflictedStations) state._conflictedStations = new Map();
    if (!state._conflictedRoutes) state._conflictedRoutes = new Map();

    const routeIds = new Set();
    for (const e of processed) {
      if (conflictKeys.has(e.entryKey)) routeIds.add(e.routeId);
    }
    state._conflictedStations.set(sId, { stationId: sId, stationName: sName, conflictCount: conflictKeys.size, routeIds: Array.from(routeIds) });
    for (const rid of routeIds) {
      if (!state._conflictedRoutes.has(rid)) state._conflictedRoutes.set(rid, new Set());
      state._conflictedRoutes.get(rid).add(sId);
    }
  }

  const byPlatform = new Map(visiblePlatforms.map((p) => [p, []]));
  for (const e of processed) byPlatform.get(e.effPlatform).push(e);

  let platformsHtml = "";
  let rowsHtml = "";
  for (const p of visiblePlatforms) {
    platformsHtml += `<div class="platform-label">${escapeHtml(p)}</div>`;
    const list = byPlatform.get(p) || [];
    const blocks = list
      .map((e) => {
        const idx = state.currentDashboardEntries.indexOf(e);
        const leftPx = (e.effArrival / MS_PER_DAY) * TIMELINE_WIDTH - 28;
        const devClass = Math.abs(e.deviationMs) <= 60000 ? "" : e.deviationMs > 0 ? "dev-late" : "dev-early";
        const conflictClass = conflictKeys.has(e.entryKey) ? "has-conflict" : "";
        const editedClass = e.isEdited ? "is-edited" : "";
        const draftClass = e.isDraft ? "is-draft" : "";
        const movedClass = e.isPlatformMoved ? "is-platform-moved" : "";
        const warnIcon = conflictKeys.has(e.entryKey) ? '<span class="eb-warning">!</span>' : "";
        const editedTag = e.isEdited
          ? `<span class="eb-edited-tag">${escapeHtml(t("editedLabel"))}</span>`
          : e.isDraft
          ? `<span class="eb-edited-tag">${escapeHtml(t("draftBadge"))}</span>`
          : e.isPlatformMoved
          ? `<span class="eb-edited-tag">${escapeHtml(t("platformMovedLabel"))}</span>`
          : "";
        // Выступ над левым верхним углом блока: ширина соответствует
        // реальному времени стоянки В МАСШТАБЕ ТЕКУЩЕГО ЗУМА (растёт при
        // увеличении масштаба, как и положено времени на временной оси),
        // но не меньше минимального видимого размера. Высота — ФИКСИРОВАНА
        // (раньше тоже зависела от длительности, из-за чего в разных
        // строках выступы казались "вразнобой" по размеру — длительность
        // и так видна по ширине, дублировать её в высоте не нужно).
        // Позиционируем БЕЗ захода на сам блок (стык встык, а не поверх).
        const dwellSec = (e.dwellTimeMs || 0) / 1000;
        const MIN_NUB_WIDTH = 6;
        const nubWidthAtScale = (dwellSec / 3600) * state.dashPxPerHour;
        const nubWidth = Math.max(MIN_NUB_WIDTH, nubWidthAtScale);
        const nubHeight = dwellSec > 0 ? 5 : 0;
        const dwellNub = nubHeight > 0
          ? `<span class="eb-dwell-nub" style="height:${nubHeight}px;width:${nubWidth}px;top:-${nubHeight}px" title="${formatSecondsShort(Math.round(dwellSec))}"></span>`
          : "";
        return `<div class="entry-block ${devClass} ${conflictClass} ${editedClass} ${draftClass} ${movedClass}" style="left:${leftPx}px;background:${e.color}" data-eidx="${idx}" data-route-id="${escapeHtml(e.routeId)}">
          ${dwellNub}
          <span class="eb-num">${escapeHtml(e.routeNumber || "•")}</span>
          <span class="eb-time">${formatLocal(e.effArrival)}</span>
          ${Math.abs(e.deviationMs) > 60000
            ? `<span class="eb-actual-time" title="${escapeHtml(t("actualArrivalHint"))}">${e.deviationMs > 0 ? "▲" : "▼"}${formatLocal(normalizeMs(e.effArrival + e.deviationMs))}</span>`
            : ""}
          ${warnIcon}${editedTag}
        </div>`;
      })
      .join("");
    rowsHtml += `<div class="grid-row" style="width:${TIMELINE_WIDTH}px">${blocks}</div>`;
  }

  dashboardPlatforms.innerHTML = platformsHtml;
  dashboardGrid.style.width = TIMELINE_WIDTH + "px";
  dashboardGrid.innerHTML = rowsHtml + `<div class="now-line" id="dashNowLine" style="height:${visiblePlatforms.length * PLATFORM_ROW_HEIGHT}px"></div>`;
  dashboardGrid.classList.remove("fade-update");
  void dashboardGrid.offsetWidth;
  dashboardGrid.classList.add("fade-update");
  positionNowLines();
  renderNearestTrains();
  // Прокручиваем к текущему времени только при первом рендере
  if (!state._dashboardScrolled) {
    state._dashboardScrolled = true;
    setTimeout(scrollToNow, 0);
  }
}

/** Текущее время (мс от полуночи UTC) — игровое время сервера синхронизировано с UTC 1:1. */
function getNowMsOfDay() { return Date.now() % MS_PER_DAY; }

/** Двигает линию "сейчас" на дашборде и графике движения без полной перерисовки. */
function positionNowLines() {
  const nowMs = getNowMsOfDay();
  const dashLine = document.getElementById("dashNowLine");
  if (dashLine) dashLine.style.left = (nowMs / MS_PER_DAY) * dashTimelineWidth() + "px";
  const graphLine = document.getElementById("graphNowLine");
  if (graphLine && state.lastGraphData) {
    const x = (nowMs / MS_PER_DAY) * (state.graphPxPerHour * 24);
    graphLine.setAttribute("x1", x);
    graphLine.setAttribute("x2", x);
  }
}
setInterval(positionNowLines, 30000);

/** Скроллирует дашборд/граф к текущему серверному времени, оставляя 30 мин слева для контекста. */
function scrollToNow() {
  const nowMs = getNowMsOfDay();
  const MARGIN_MS = 30 * 60000; // 30 мин слева для контекста
  const pxPerMs = state.dashPxPerHour / 3600000;
  const targetPx = Math.max(0, (nowMs - MARGIN_MS) * pxPerMs);
  const gs = document.getElementById("gridScroll");
  if (gs) gs.scrollLeft = targetPx;
  const rs = document.getElementById("rulerScroll");
  if (rs) rs.scrollLeft = targetPx;
}
function scrollGraphToNow() {
  const nowMs = getNowMsOfDay();
  const MARGIN_MS = 30 * 60000;
  const pxPerMs = state.graphPxPerHour / 3600000;
  const targetPx = Math.max(0, (nowMs - MARGIN_MS) * pxPerMs);
  const gw = document.getElementById("graphWrap");
  if (gw) gw.scrollLeft = targetPx;
}

/**
 * Строит список "формул" D+X*I (и отдельных индивидуальных отправлений)
 * для копирования в игру — см. карточку пробного маршрута. Если внутри
 * группы какое-то конкретное отправление было вручную сдвинуто (drag на
 * дашборде/графике), оно "выпадает" из формулы и показывается отдельной
 * строкой со своим эффективным временем — а оставшаяся часть группы
 * по-прежнему описывается компактной формулой (одной или несколькими
 * непрерывными подряд идущими частями, если правка пришлась на середину).
 */
function buildFormulaLines(rawDraft, routeId) {
  const lines = [];
  for (const g of rawDraft.departureGroups || []) {
    const total = g.additionalCount + 1;
    const overriddenAt = [];
    for (let x = 0; x < total; x++) {
      const t0 = normalizeMs(g.firstTimeMs + x * g.intervalMs);
      overriddenAt.push(getOverride(routeId, t0) !== 0 ? t0 : null);
    }
    let runStart = null;
    for (let x = 0; x <= total; x++) {
      const isOverridden = x < total ? overriddenAt[x] !== null : true;
      if (!isOverridden) {
        if (runStart === null) runStart = x;
      } else {
        if (runStart !== null) {
          const runLen = x - runStart;
          if (runLen === 1) {
            // Один-единственный неприкосновенный рейс в обрезке — просто
            // строка, а не вырожденная "формула" с X=0.
            lines.push({ type: "single", timeMs: normalizeMs(g.firstTimeMs + runStart * g.intervalMs), edited: false });
          } else {
            lines.push({
              type: "formula",
              dMs: normalizeMs(g.firstTimeMs + runStart * g.intervalMs),
              x: runLen - 1,
              iMs: g.intervalMs,
              count: runLen,
            });
          }
          runStart = null;
        }
        if (x < total && overriddenAt[x] !== null) {
          const t0 = overriddenAt[x];
          const delta = getOverride(routeId, t0);
          lines.push({ type: "single", timeMs: normalizeMs(t0 + delta), edited: true });
        }
      }
    }
  }
  for (const t0 of rawDraft.departureTimesOfDayMs || []) {
    const delta = getOverride(routeId, t0);
    lines.push({ type: "single", timeMs: normalizeMs(t0 + delta), edited: delta !== 0 });
  }
  return lines;
}

/**
 * Строит строки формул для НАСТОЯЩИХ маршрутов. Отделяет равномерный сдвиг
 * всего маршрута (Shift+drag → routeOverridesMap) от точечных правок
 * отдельных рейсов. Это позволяет после Shift+drag всё равно показывать
 * красивую формулу D+X*I со сдвинутым временем начала, а не 24 отдельные строки.
 */
function buildFormulaLinesFromTimes(t0List, routeId) {
  const routeOffset = getRouteOverride(routeId); // равномерный сдвиг всего маршрута
  const sorted = Array.from(new Set(t0List)).sort((a, b) => a - b);
  const lines = [];
  let i = 0;
  const INTERVAL_TOLERANCE_MS = 30000;

  while (i < sorted.length) {
    const t0 = sorted[i];
    const totalDelta = getOverride(routeId, t0);
    const tripDelta = totalDelta - routeOffset; // индивидуальная правка (без общего сдвига)

    if (tripDelta !== 0) {
      // Этот рейс сдвинут индивидуально — показываем отдельной строкой
      lines.push({ type: "single", timeMs: normalizeMs(t0 + totalDelta), edited: true });
      i++;
      continue;
    }

    // Группируем неизменённые (или равномерно сдвинутые) рейсы по интервалу
    let j = i;
    let interval = null;
    while (j + 1 < sorted.length) {
      const next = sorted[j + 1];
      const nextTripDelta = getOverride(routeId, next) - routeOffset;
      if (nextTripDelta !== 0) break; // следующий рейс изменён индивидуально
      const diff = next - sorted[j];
      if (interval === null) interval = diff;
      else if (Math.abs(diff - interval) > INTERVAL_TOLERANCE_MS) break;
      j++;
    }
    const runLen = j - i + 1;
    // Эффективное начальное время с учётом равномерного сдвига
    const effT0 = normalizeMs(t0 + routeOffset);
    if (runLen >= 2 && interval !== null) {
      const roundedInterval = roundMsTo30s(interval);
      lines.push({ type: "formula", dMs: effT0, x: runLen - 1, iMs: roundedInterval, count: runLen });
    } else {
      lines.push({ type: "single", timeMs: effT0, edited: routeOffset !== 0 });
    }
    i = j + 1;
  }
  return lines;
}

/** Есть ли хоть одна активная ручная правка (рейс или весь маршрут) у данного маршрута. */
function hasAnyOverrideForRoute(routeId) {
  if (getRouteOverride(routeId) !== 0) return true;
  return overridesList.some((o) => o.routeId === routeId);
}

/** Рендерит готовый HTML секции формул по списку строк (формула/одиночное отправление). */
function renderFormulaLines(lines) {
  const rows = lines
    .map((line) => {
      if (line.type === "formula") {
        // Сама формула — ВСЕГДА в UTC (как ожидает игра/сервер),
        // независимо от выбранного в настройках часового пояса
        // отображения. Расшифровка под ней — уже в выбранном поясе,
        // просто для удобства чтения.
        const dUtc = formatMsToHmsRounded(line.dMs);
        const iUtc = formatMsToHmsRounded(line.iMs);
        const formulaText = `${dUtc}+${line.x}*${iUtc}`;
        const dLocal = formatLocal(roundMsTo30s(line.dMs), true);
        const explain = t("formulaExplain", { count: line.count, dLocal, iMin: Math.round(roundMsTo30s(line.iMs) / 60000) });
        return `<div class="formula-row">
          <div>
            <span class="formula-text">${escapeHtml(formulaText)}</span>
            <div class="formula-explain">${escapeHtml(explain)}</div>
          </div>
          <button class="copy-icon-btn" data-copy-formula="${escapeHtml(formulaText)}" title="${escapeHtml(t("copyBtn"))}">⧉</button>
        </div>`;
      }
      const tUtc = formatMsToHmsRounded(line.timeMs);
      return `<div class="formula-row">
        <span class="formula-text">${tUtc}${line.edited ? ` <span class="cell-edited-label" style="position:static;display:inline;">${escapeHtml(t("editedLabel"))}</span>` : ""}</span>
        <button class="copy-icon-btn" data-copy-formula="${escapeHtml(tUtc)}" title="${escapeHtml(t("copyBtn"))}">⧉</button>
      </div>`;
    })
    .join("");
  return `
    <h4>${t("modalFormulas")}</h4>
    <p class="hint small">${escapeHtml(t("modalFormulasHint"))}</p>
    <div class="formula-list">${rows || `<p class="hint small">${escapeHtml(t("modalNoActiveTrips"))}</p>`}</div>
  `;
}

function buildEntryTooltipHtml(e) {
  const dev = e.deviationMs;
  let html = `<b>${e.isDraft ? draftFlagHtml() + " " : ""}${escapeHtml(e.routeName)}${e.routeNumber ? " · " + escapeHtml(e.routeNumber) : ""}</b>
    ${t("platformLabel")}: ${escapeHtml(e.platformName)}<br>
    ${t("arrivalLabel")}: ${formatLocal(e.effArrival)}${e.effDeparture !== null ? " · " + t("departureLabel") + ": " + formatLocal(e.effDeparture) : ""}<br>
    ${t("deviationLabel")}: <span class="${deviationClass(dev)}">${formatDeviation(dev)}</span>`;
  if (e.isOrigin || e.isTerminus) {
    html += `<br>${t("statusLabel")}: ${e.isOrigin ? t("statusOrigin") : t("statusTerminus")}`;
  }
  if (e.isEdited) {
    const sign = e.delta > 0 ? "+" : "−";
    const mins = Math.round(Math.abs(e.delta) / 60000);
    html += `<br><i>${escapeHtml(t("editedNote"))} (${sign}${formatMinutesShort(mins)})</i>`;
  }
  const conf = state.conflictDetails.get(e.entryKey);
  if (conf && conf.length) {
    html += `<br><span class="dev-pos">⚠ ${escapeHtml(t("conflictLabel"))}: ${conf
      .map((c) => {
        const routeLabel = c.routeNumber || c.routeName;
        return t("conflictWith", { route: escapeHtml(routeLabel), time: formatLocal(c.effArrival) });
      })
      .join(", ")}</span>`;
    // Текстовый совет вместо кнопки — применяется через ПКМ → контекстное меню
    const minIntervalMs = state.minIntervalMin * 60000;
    const allShifts = [];
    for (const other of conf) {
      const gap = e.effArrival - other.effArrival;
      if (Math.abs(gap) < minIntervalMs) {
        const shiftMs = gap >= 0 ? (minIntervalMs - gap) : -(minIntervalMs + gap);
        const shiftMin = Math.ceil(Math.abs(shiftMs) / 60000);
        const dir = shiftMs > 0 ? "+" : "−";
        allShifts.push(`${dir}${shiftMin} ${t("nearestMin")}`);
      }
    }
    if (allShifts.length > 0) {
      const tipLabel = currentLang() === "ru" ? "Совет: ПКМ → сдвинуть" : "Tip: right-click → shift";
      html += `<br><span class="tooltip-conflict-tip">💡 ${escapeHtml(tipLabel)} ${allShifts.join(" / ")}</span>`;
    }
  }
  return html;
}

dashboardGrid.addEventListener("mousemove", (e) => {
  if (dragState.active) return;
  const target = e.target.closest(".entry-block");
  if (!target) { entryTooltip.style.display = "none"; return; }
  const idx = Number(target.dataset.eidx);
  const entry = state.currentDashboardEntries[idx];
  if (!entry) return;
  entryTooltip.style.display = "block";
  entryTooltip.style.left = e.clientX + 16 + "px";
  entryTooltip.style.top = e.clientY + 16 + "px";
  entryTooltip.innerHTML = buildEntryTooltipHtml(entry);
});
dashboardGrid.addEventListener("mouseleave", () => { entryTooltip.style.display = "none"; });

// ---- Drag для блоков дашборда (по горизонтали — время; Alt + вертикаль — платформа) ----
const dragState = { active: false };
const PLATFORM_ROW_HEIGHT = 64; // должно совпадать с высотой .grid-row в CSS

dashboardGrid.addEventListener("mousedown", (e) => {
  if (e.button !== 0) return; // ПКМ и средняя кнопка не запускают drag
  const target = e.target.closest(".entry-block");
  if (!target) return;
  e.preventDefault();
  const idx = Number(target.dataset.eidx);
  const entry = state.currentDashboardEntries[idx];
  if (!entry) return;
  dragState.active = true;
  dragState.kind = "dashboard";
  dragState.entry = entry;
  dragState.startX = e.clientX;
  dragState.startY = e.clientY;
  dragState.moved = 0;
  dragState.movedY = 0;
  dragState.shiftMode = e.shiftKey;
  dragState.platformIndex = state.currentDashboardPlatforms.indexOf(entry.effPlatform);
  dragState.groupEls = dragState.shiftMode
    ? Array.from(dashboardGrid.querySelectorAll(`.entry-block[data-route-id="${CSS.escape(entry.routeId)}"]`))
    : [target];
  entryTooltip.style.display = "none";
});

document.addEventListener("mousemove", (e) => {
  if (!dragState.active) return;
  const dx = e.clientX - dragState.startX;
  dragState.moved = dx;
  if (dragState.kind === "dashboard") {
    // Вертикальное перемещение (смена платформы) — только для одиночного
    // перетаскивания (не Shift-группы) и только пока зажат Alt, иначе
    // случайное небольшое дрожание мышки по вертикали могло бы случайно
    // переключить платформу.
    const dy = !dragState.shiftMode && e.altKey ? e.clientY - dragState.startY : 0;
    dragState.movedY = dy;
    dragState.groupEls.forEach((el) => { el.style.transform = `translate(${dx}px, ${dy}px)`; });
  } else if (dragState.kind === "graph") {
    dragState.groupEls.forEach((el) => { el.style.transform = `translateX(${dx}px)`; });
  }
});

document.addEventListener("mouseup", (e) => {
  if (!dragState.active) return;
  const dx = dragState.moved;
  const dy = dragState.movedY || 0;
  // Полный шаг строки нужен, чтобы платформа поменялась только при явном,
  // намеренном перетаскивании, а не от случайного дрожания руки.
  const rowDelta = Math.abs(dy) >= PLATFORM_ROW_HEIGHT ? Math.round(dy / PLATFORM_ROW_HEIGHT) : 0;
  const wasClick = Math.abs(dx) < 4 && rowDelta === 0;
  if (dragState.kind === "dashboard") {
    dragState.groupEls.forEach((el) => { el.style.transform = ""; });
    if (wasClick) {
      openRouteModal(dragState.entry.routeId);
    } else {
      pushUndoSnapshot();
      if (rowDelta !== 0) {
        const platforms = state.currentDashboardPlatforms;
        const targetIdx = Math.max(0, Math.min(platforms.length - 1, dragState.platformIndex + rowDelta));
        const targetPlatform = platforms[targetIdx];
        if (targetPlatform && targetPlatform !== dragState.entry.effPlatform) {
          setPlatformOverride(dragState.entry.routeId, dragState.entry.tripOriginMs, targetPlatform);
        }
      }
      if (dx !== 0) {
        const TIMELINE_WIDTH = dashTimelineWidth();
        const deltaMs = (dx / TIMELINE_WIDTH) * MS_PER_DAY;
        if (dragState.shiftMode) {
          bumpRouteOverride(dragState.entry.routeId, deltaMs);
        } else {
          const prev = getOverride(dragState.entry.routeId, dragState.entry.tripOriginMs);
          setOverride(dragState.entry.routeId, dragState.entry.tripOriginMs, prev + deltaMs);
        }
      }
      renderDashboardFromCache();
      renderGraphFromCache();
    }
  } else if (dragState.kind === "graph") {
    dragState.groupEls.forEach((el) => { el.style.transform = ""; });
    if (wasClick) {
      openRouteModal(dragState.routeId);
    } else {
      const TIMELINE_WIDTH = state.graphPxPerHour * 24;
      const deltaMs = (dx / TIMELINE_WIDTH) * MS_PER_DAY;
      pushUndoSnapshot();
      if (dragState.shiftMode) {
        bumpRouteOverride(dragState.routeId, deltaMs);
      } else {
        const prev = getOverride(dragState.routeId, dragState.tripOriginMs);
        setOverride(dragState.routeId, dragState.tripOriginMs, prev + deltaMs);
      }
      renderGraphFromCache();
      renderDashboardFromCache();
    }
  }
  dragState.active = false;
});

async function loadSchedule() {
  const stationId = state.currentStationId;
  if (!stationId) {
    state.lastScheduleData = null;
    renderDashboard(null);
    scheduleMeta.textContent = "";
    return;
  }
  try {
    const res = await fetch(`/api/stations/${encodeURIComponent(stationId)}/schedule`);
    const data = await res.json();
    if (!res.ok) { scheduleMeta.textContent = data.error || "Error"; return; }
    state.lastScheduleData = data;
    updateScheduleMeta();
    renderDashboard(data);
    updateFavoriteBtn();
    updateUrlHash();
  } catch (err) {
    scheduleMeta.textContent = t("errLoading", { msg: err.message });
  }
}
function updateScheduleMeta() {
  const data = state.lastScheduleData;
  if (!data) { scheduleMeta.textContent = ""; return; }
  scheduleMeta.textContent = t("scheduleMetaTemplate", {
    name: data.stationName,
    pc: data.platforms.length,
    ec: data.entries.length,
    time: formatEpochLocal(data.departuresFetchedAt),
  });
}

// ============================================================
// График движения поездов
// ============================================================
const graphWrap = document.getElementById("graphWrap");
const graphLegend = document.getElementById("graphLegend");

makeZoomController({
  get: () => state.dashPxPerHour,
  set: (v) => { state.dashPxPerHour = v; renderDashboardFromCache(); },
  valueId: "dashZoomValue", outBtnId: "dashZoomOut", inBtnId: "dashZoomIn",
  scrollEl: gridScroll,
});
makeZoomController({
  get: () => state.graphPxPerHour,
  set: (v) => { state.graphPxPerHour = v; renderGraphFromCache(); },
  valueId: "graphZoomValue", outBtnId: "graphZoomOut", inBtnId: "graphZoomIn",
  scrollEl: graphWrap,
});

document.getElementById("buildGraphBtn").addEventListener("click", buildGraph);
document.getElementById("swapStationsBtn").addEventListener("click", () => {
  const fromId = graphFromAC.getSelectedId();
  const toId = graphToAC.getSelectedId();
  const fromName = document.getElementById("graphFromInput").value;
  const toName = document.getElementById("graphToInput").value;
  if (fromId) graphToAC.setSelected(fromId, fromName);
  else { document.getElementById("graphToInput").value = ""; }
  if (toId) graphFromAC.setSelected(toId, toName);
  else { document.getElementById("graphFromInput").value = ""; }
  if (fromId && toId) buildGraph();
});
document.getElementById("showReverseToggle").addEventListener("change", (e) => {
  state.showReverse = e.target.checked;
  renderGraphFromCache();
});

async function buildGraph() {
  const fromId = graphFromAC.getSelectedId();
  const toId = graphToAC.getSelectedId();
  state._graphScrolled = false; // новый граф — нужно прокрутить к текущему времени
  if (!fromId || !toId) {
    graphWrap.innerHTML = `<div class="dashboard-empty">${escapeHtml(t("graphSelectBoth"))}</div>`;
    graphLegend.innerHTML = "";
    return;
  }
  if (fromId === toId) {
    graphWrap.innerHTML = `<div class="dashboard-empty">${escapeHtml(t("graphSameStation"))}</div>`;
    return;
  }
  graphWrap.innerHTML = `<div class="dashboard-empty">${escapeHtml(t("graphBuilding"))}</div>`;
  graphLegend.innerHTML = "";
  try {
    const res = await fetch(`/api/route-graph?from=${encodeURIComponent(fromId)}&to=${encodeURIComponent(toId)}`);
    const data = await res.json();
    if (!res.ok) { graphWrap.innerHTML = `<div class="dashboard-empty">${escapeHtml(data.error)}</div>`; return; }
    if (!data.routes || data.routes.length === 0) {
      graphWrap.innerHTML = `<div class="dashboard-empty">${escapeHtml(t("graphNoRoutes"))}</div>`;
      return;
    }
    state.lastGraphData = data;
    state.graphFilterKey = null; // заставит сбросить фильтр станций под новые данные
    state.graphRouteOverrides = new Map(); // сбрасываем индивидуальный выбор маршрутов для новой пары станций
    renderGraph(data);
  } catch (err) {
    graphWrap.innerHTML = `<div class="dashboard-empty">${t("errLoading", { msg: err.message })}</div>`;
  }
}

function renderGraphFromCache() {
  if (state.lastGraphData) renderGraph(state.lastGraphData);
}

function renderGraphStationFilterList(data) {
  const container = document.getElementById("graphStationFilterList");
  const key = data.fromStationId + "|" + data.toStationId;
  if (state.graphFilterKey !== key) {
    state.graphStationFilter = new Set(data.stations.map((s) => s.stationId));
    state.graphFilterKey = key;
  }
  container.innerHTML = data.stations
    .map(
      (s) => `<label><input type="checkbox" data-st="${escapeHtml(s.stationId)}" ${state.graphStationFilter.has(s.stationId) ? "checked" : ""}> ${escapeHtml(s.name)}</label>`
    )
    .join("");
  container.querySelectorAll("input[type=checkbox]").forEach((cb) => {
    cb.addEventListener("change", () => {
      if (cb.checked) state.graphStationFilter.add(cb.dataset.st);
      else state.graphStationFilter.delete(cb.dataset.st);
      renderGraphFromCache();
    });
  });
}
document.getElementById("graphStationsSelectAll").addEventListener("click", () => {
  if (state.lastGraphData) state.graphStationFilter = new Set(state.lastGraphData.stations.map((s) => s.stationId));
  renderGraphStationFilterList(state.lastGraphData);
  renderGraphFromCache();
});
document.getElementById("graphStationsSelectNone").addEventListener("click", () => {
  state.graphStationFilter = new Set();
  renderGraphStationFilterList(state.lastGraphData);
  renderGraphFromCache();
});

function isGraphRouteVisible(route) {
  if (state.graphRouteOverrides.has(route.routeId)) return state.graphRouteOverrides.get(route.routeId);
  return state.showReverse || route.direction === "forward";
}

function renderGraph(data) {
  renderGraphStationFilterList(data);

  const leftMargin = 170;
  const topMargin = 30;
  const bottomMargin = 20;
  const visibleStations = data.stations.filter((s) => state.graphStationFilter.has(s.stationId));
  const stationsForAxis = visibleStations.length ? visibleStations : data.stations;
  const height = Math.max(420, stationsForAxis.length * 46) + topMargin + bottomMargin;
  const totalDistance = data.stations[data.stations.length - 1].distance || 1;
  const TIMELINE_WIDTH = state.graphPxPerHour * 24;

  const yScale = (dist) => topMargin + (dist / totalDistance) * (height - topMargin - bottomMargin);
  // Подписи станций теперь в graphYPanel (отдельный DOM-элемент слева),
  // поэтому xScale начинается с x=0 (без leftMargin-смещения)
  const xScale = (ms) => (ms / MS_PER_DAY) * TIMELINE_WIDTH;

  const routesToShow = data.routes.filter((r) => isGraphRouteVisible(r) && r.tripCount > 0);
  state.currentGraphRoutes = routesToShow;

  const parts = [];
  parts.push(`<svg class="graph-svg-host" width="${TIMELINE_WIDTH + 20}" height="${height}" xmlns="http://www.w3.org/2000/svg">`);
  const clipId = "graphPlotClip";
  parts.push(
    `<defs><clipPath id="${clipId}"><rect x="0" y="${topMargin - 12}" width="${TIMELINE_WIDTH}" height="${height - topMargin - bottomMargin + 22}"></rect></clipPath></defs>`
  );

  // Если станции расположены физически близко друг к другу, их подписи
  // на оси могут накладываться. Раздвигаем подписи по вертикали так,
  // чтобы между ними был минимальный зазор, а тонкая линия-выноска
  // показывает, к какой именно гридлинии относится подпись.
  const MIN_LABEL_GAP = 13;
  let prevLabelY = -Infinity;
  const labelEntries = stationsForAxis.map((s) => {
    const trueY = yScale(s.distance);
    let labelY = trueY;
    if (labelY < prevLabelY + MIN_LABEL_GAP) labelY = prevLabelY + MIN_LABEL_GAP;
    prevLabelY = labelY;
    return { s, trueY, labelY };
  });

  for (const s of stationsForAxis) {
    const y = yScale(s.distance);
    parts.push(`<line class="graph-station-line" x1="0" y1="${y}" x2="${TIMELINE_WIDTH}" y2="${y}"></line>`);
  }
  // (подписи станций теперь рисуются в graphYPanel — отдельный DOM-элемент слева)

  // Группа подписей времени — закрепляется по Y при вертикальном скролле
  parts.push(`<g id="graphXAxisLabels">`);
  const { tick: tickMin, label: labelMin } = getTickSteps(state.graphPxPerHour);
  const pxPerMinGraph = state.graphPxPerHour / 60;
  for (let m = 0; m <= 24 * 60; m += tickMin) {
    const x = m * pxPerMinGraph;
    const isHour = m % 60 === 0;
    parts.push(`<line class="graph-gridline ${isHour ? "" : "graph-gridline-minor"}" x1="${x}" y1="${topMargin - 10}" x2="${x}" y2="${height - bottomMargin}"></line>`);
    if (m % labelMin === 0) {
      parts.push(`<text class="graph-time-label" x="${x}" y="${topMargin - 14}" text-anchor="middle">${formatLocal(m * 60000)}</text>`);
    }
  }
  parts.push(`</g>`);

  parts.push(`<g clip-path="url(#${clipId})">`);
  const tripRefs = []; // index -> {routeId, route, trip}
  for (const route of routesToShow) {
    for (const trip of route.trips) {
      const delta = getOverride(route.routeId, trip.tripOriginMs);
      const isEdited = delta !== 0;
      const effPoints = trip.points.map((p) => ({
        distance: p.distance,
        // Сырое (не "завёрнутое" в сутки) время — см. комментарий в
        // schedule.js: это исправляет огромную "телепортирующую" линию у
        // маршрутов, чьё расписание физически пересекает полночь.
        // Для отображения (тултипы, подписи) formatLocal() сама делает
        // нормализацию — здесь она не нужна и даже вредна.
        arrivalMs: p.arrivalMs + delta,
        departureMs: p.departureMs === null ? null : p.departureMs + delta,
      }));
      // ВАЖНО: точки в trip.points идут в порядке ВОЗРАСТАНИЯ РАССТОЯНИЯ
      // (так нужно для оси Y), но для обратных маршрутов это НЕ совпадает
      // с хронологическим порядком движения поезда (он едет от станции
      // с большим расстоянием к станции с меньшим). Если рисовать путь
      // просто по порядку массива, "ступенька" стоянки на каждой
      // промежуточной станции получается развёрнутой не в ту сторону —
      // отсюда эффект "молнии". Чтобы это исправить раз и навсегда (и для
      // Строим путь через effPoints в их физическом порядке (arrival → departure для каждой станции).
      // НЕ сортируем по времени — порядок точек уже отражает направление движения:
      //   прямой маршрут: dist 0→total, время растёт
      //   обратный: dist total→0, время тоже растёт (линия bottom→top)
      const events = [];
      effPoints.forEach((p, pidx) => {
        events.push({ ms: p.arrivalMs, distance: p.distance });
        // Горизонтальная "ступенька" стоянки: добавляем departure даже для
        // последней станции — там departureMs может быть null (конечная).
        // В этом случае берём arrival + dwellTimeMs из данных маршрута.
        const depMs = p.departureMs;
        const dwellMs = route.stops?.[pidx]?.dwellTimeMs ?? 0;
        // p.arrivalMs уже содержит delta (из effPoints), поэтому не добавляем её снова
        const effDepMs = depMs !== null ? depMs : (dwellMs > 0 ? p.arrivalMs + dwellMs : null);
        if (effDepMs !== null && effDepMs !== p.arrivalMs) {
          events.push({ ms: effDepMs, distance: p.distance });
        }
      });
      let d = "";
      events.forEach((ev, i) => {
        d += (i === 0 ? "M" : "L") + `${xScale(ev.ms)},${yScale(ev.distance)} `;
      });
      const refIdx = tripRefs.length;
      tripRefs.push({ route, trip, effPoints, delta, isEdited, isDraft: !!route.isDraft });
      const dirClass = route.direction === "backward" ? "backward" : "";
      const editedClass = isEdited ? "is-edited" : "";
      const draftClass = route.isDraft ? "is-draft" : "";
      parts.push(`<path class="graph-trip-hit" d="${d}" data-tref="${refIdx}" data-route-id="${escapeHtml(route.routeId)}"></path>`);
      parts.push(`<path class="graph-trip-path ${dirClass} ${editedClass} ${draftClass}" d="${d}" stroke="${route.color}" data-tref="${refIdx}" data-route-id="${escapeHtml(route.routeId)}"></path>`);
      if (events[events.length - 1].ms >= MS_PER_DAY) {
        let dYesterday = "";
        events.forEach((ev, i) => {
          dYesterday += (i === 0 ? "M" : "L") + `${xScale(ev.ms - MS_PER_DAY)},${yScale(ev.distance)} `;
        });
        parts.push(`<path class="graph-trip-hit" d="${dYesterday}" data-tref="${refIdx}" data-route-id="${escapeHtml(route.routeId)}"></path>`);
        parts.push(`<path class="graph-trip-path ${dirClass} ${editedClass} ${draftClass}" d="${dYesterday}" stroke="${route.color}" data-tref="${refIdx}" data-route-id="${escapeHtml(route.routeId)}"></path>`);
      }
      if (isEdited || route.isDraft) {
        const midX = xScale(effPoints[0].arrivalMs);
        const midY = yScale(effPoints[0].distance) - 6;
        parts.push(`<text class="graph-edited-tag" x="${midX}" y="${midY}">${escapeHtml(route.isDraft ? t("draftBadge") : t("editedLabel"))}</text>`);
      }
    }
  }
  parts.push("</g>");

  {
    const nowMs = getNowMsOfDay();
    const nowX = xScale(nowMs);
    parts.push(`<line id="graphNowLine" class="graph-now-line" x1="${nowX}" y1="${topMargin - 10}" x2="${nowX}" y2="${height - bottomMargin}"></line>`);
  }

  parts.push("</svg>");
  graphWrap.innerHTML = parts.join("");
  state.graphTripRefs = tripRefs;
  if (!state._graphScrolled) {
    state._graphScrolled = true;
    setTimeout(scrollGraphToNow, 0);
  }

  // Рендерим левую панель с подписями станций
  const graphYPanel = document.getElementById("graphYPanel");
  if (graphYPanel) {
    const PANEL_W = leftMargin;
    const yPanelParts = [`<svg width="${PANEL_W}" height="${height}" xmlns="http://www.w3.org/2000/svg" style="display:block;overflow:visible">`];
    for (const { s, trueY, labelY } of labelEntries) {
      if (Math.abs(labelY - trueY) > 1) {
        yPanelParts.push(`<line class="graph-label-leader" x1="${PANEL_W - 4}" y1="${trueY}" x2="${PANEL_W - 4}" y2="${labelY}"></line>`);
      }
      yPanelParts.push(`<text class="graph-station-label" x="${PANEL_W - 8}" y="${labelY + 4}" text-anchor="end">${escapeHtml(s.name)}</text>`);
    }
    yPanelParts.push("</svg>");
    graphYPanel.innerHTML = yPanelParts.join("");
    graphYPanel.style.width = PANEL_W + "px";
    graphYPanel.style.minWidth = PANEL_W + "px";
    // Синхронизация вертикального скролла Y-панели и основного графика
    let _ySync = false;
    graphWrap.addEventListener("scroll", () => {
      if (_ySync) return; _ySync = true;
      graphYPanel.scrollTop = graphWrap.scrollTop; _ySync = false;
    }, { passive: true });
    graphYPanel.addEventListener("scroll", () => {
      if (_ySync) return; _ySync = true;
      graphWrap.scrollTop = graphYPanel.scrollTop; _ySync = false;
    }, { passive: true });
  }

  // Закрепление X-оси (времени) при вертикальном скролле
  const _xLabels = graphWrap.querySelector("#graphXAxisLabels");
  const _applyXTransform = () => {
    if (_xLabels) _xLabels.setAttribute("transform", `translate(0,${graphWrap.scrollTop})`);
  };
  _applyXTransform();
  let _xRaf = false;
  graphWrap.addEventListener("scroll", () => {
    if (_xRaf) return; _xRaf = true;
    requestAnimationFrame(() => { _xRaf = false; _applyXTransform(); });
  }, { passive: true });

  graphLegend.innerHTML = data.routes
    .filter((r) => {
      if (r.direction !== "backward") return true;
      return state.showReverse; // показываем все обратные только когда галочка включена
    })
    .map((r) => {
      const visible = isGraphRouteVisible(r);
      const inactive = r.tripCount === 0;
      return `<div class="graph-legend-item ${visible ? "" : "dim"} ${inactive ? "inactive" : ""}" data-route="${r.routeId}" data-dir="${r.direction}" title="${inactive ? escapeHtml(t("graphInactiveRoute")) : ""}">
        <span class="dot" style="background:${r.color}"></span>
        ${escapeHtml(r.routeName)}${r.routeNumber ? " · " + escapeHtml(r.routeNumber) : ""}
        ${r.direction === "backward" ? `<span class="dir-tag">${escapeHtml(t("directionBackwardShort"))}</span>` : ""}
        (${r.tripCount} ${escapeHtml(t("tripsPerDay"))})
        <span class="info-btn" data-route-info="${r.routeId}" title="${escapeHtml(t("modalStops"))}">ⓘ</span>
      </div>`;
    })
    .join("");

  graphLegend.querySelectorAll(".graph-legend-item").forEach((item) => {
    item.addEventListener("click", (e) => {
      if (e.target.closest(".info-btn")) return;
      const routeId = item.dataset.route;
      const route = data.routes.find((r) => r.routeId === routeId);
      if (!route) return;
      state.graphRouteOverrides.set(routeId, !isGraphRouteVisible(route));
      renderGraph(data);
    });
  });
  graphLegend.querySelectorAll(".info-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openRouteModal(btn.dataset.routeInfo);
    });
  });
}

graphWrap.addEventListener("mousedown", (e) => {
  const target = e.target.closest(".graph-trip-hit");
  if (!target) return;
  e.preventDefault();
  const refIdx = Number(target.dataset.tref);
  const ref = state.graphTripRefs[refIdx];
  if (!ref) return;
  dragState.active = true;
  dragState.kind = "graph";
  dragState.routeId = ref.route.routeId;
  dragState.tripOriginMs = ref.trip.tripOriginMs;
  dragState.startX = e.clientX;
  dragState.moved = 0;
  dragState.shiftMode = e.shiftKey;
  dragState.groupEls = dragState.shiftMode
    ? Array.from(graphWrap.querySelectorAll(`[data-route-id="${CSS.escape(ref.route.routeId)}"]`))
    : Array.from(graphWrap.querySelectorAll(`[data-tref="${refIdx}"]`));
  entryTooltip.style.display = "none";
});

// ============================================================
// Маршруты
// ============================================================
async function loadRoutes() {
  const [routesRes, analyticsRes] = await Promise.all([
    fetch("/api/routes"),
    fetch("/api/analytics/overview"),
  ]);
  const routes = await routesRes.json();
  state.lastAnalytics = analyticsRes.ok ? await analyticsRes.json() : [];
  const analyticsByRouteId = new Map(state.lastAnalytics.map((a) => [a.routeId, a]));
  state.routes = routes.map((r) => ({ ...r, analytics: analyticsByRouteId.get(r.id) || null }));
  state.routesById = new Map(state.routes.map((r) => [r.id, r]));
  populateRouteTypeFilter();
  applyRouteFilters();
}

function populateRouteTypeFilter() {
  const select = document.getElementById("routeTypeFilter");
  const prevValue = select.value || "all";
  const types = Array.from(new Set(state.routes.map((r) => r.type).filter(Boolean))).sort();
  select.innerHTML =
    `<option value="all">${escapeHtml(t("typeFilterAll"))}</option>` +
    types.map((ty) => `<option value="${escapeHtml(ty)}">${escapeHtml(ty)}</option>`).join("");
  select.value = types.includes(prevValue) || prevValue === "all" ? prevValue : "all";
}

function getSortValue(r, key) {
  if (key === "sampleCount") return r.analytics ? r.analytics.sampleCount : -Infinity;
  if (key === "avgDeviationMs") return r.analytics ? r.analytics.avgDeviationMs : -Infinity;
  if (key === "maxDeviationMs") return r.analytics ? r.analytics.maxDeviationMs : -Infinity;
  const v = r[key];
  return typeof v === "string" ? v.toLowerCase() : v ?? -Infinity;
}

function applyRouteFilters() {
  const query = document.getElementById("routeSearch").value;
  const typeFilter = document.getElementById("routeTypeFilter").value;
  const sourceFilter = document.getElementById("routeSourceFilter").value;
  let filtered = state.routes;
  if (typeFilter !== "all") filtered = filtered.filter((r) => r.type === typeFilter);
  if (sourceFilter === "real") filtered = filtered.filter((r) => !r.isDraft);
  if (sourceFilter === "draft") filtered = filtered.filter((r) => r.isDraft);
  filtered = fuzzyFilterAndSort(filtered, query, (r) => `${r.name} ${r.number || ""}`);
  if (state.routeSort.key) {
    const { key, dir } = state.routeSort;
    filtered = filtered.slice().sort((a, b) => {
      const va = getSortValue(a, key), vb = getSortValue(b, key);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }
  // Избранные маршруты всегда в начале, независимо от фильтров
  const favSet = new Set(favoriteRoutes.map((r) => r.id));
  filtered = [
    ...filtered.filter((r) => favSet.has(r.id)),
    ...filtered.filter((r) => !favSet.has(r.id)),
  ];
  renderRouteList(filtered);
}

function renderRouteList(routes) {
  const body = document.getElementById("routeListBody");
  if (routes.length === 0) { body.innerHTML = `<tr><td colspan="8" class="empty">${escapeHtml(t("analyticsEmptyNoMatch"))}</td></tr>`; return; }
  body.innerHTML = routes
    .map((r) => {
      const a = r.analytics;
      const isFav = isFavoriteRoute(r.id);
      return `<tr class="clickable-row" data-route-id="${r.id}">
        <td>
          <span class="route-pill"><span class="dot" style="background:${r.color}"></span>${isFav ? "<span style='color:#fbbf24;margin-right:3px;'>★</span>" : ""}${escapeHtml(r.name)}${r.isDraft ? " " + draftFlagHtml() : ""}</span>
        </td>
        <td>${escapeHtml(r.number || t("notAvailableShort"))}</td>
        <td>${escapeHtml(r.type || t("notAvailableShort"))}</td>
        <td>${r.stopCount}</td>
        <td class="col-sep">${a ? a.sampleCount : "—"}</td>
        <td class="col-sep ${a ? deviationClass(a.avgDeviationMs) : ""}">${a ? formatDeviation(a.avgDeviationMs) : "—"}</td>
        <td class="${a ? deviationClass(a.maxDeviationMs) : ""}">${a ? formatDeviation(a.maxDeviationMs) : "—"}</td>
        <td class="row-actions">
          <button class="icon-btn fav-inline-btn" data-fav-route-toggle="${r.id}" title="${isFav ? t("removeFavorite") : t("addFavorite")}" style="color:${isFav ? "#fbbf24" : ""};">${isFav ? "★" : "☆"}</button>
          ${r.isDraft ? `
            <button class="icon-btn" data-edit-draft="${r.id}" title="${escapeHtml(t("draftEdit"))}">✎</button>
            <button class="icon-btn" data-delete-draft="${r.id}" title="${escapeHtml(t("draftDelete"))}">🗑</button>
          ` : ""}
        </td>
      </tr>`;
    })
    .join("");
  body.querySelectorAll("tr[data-route-id]").forEach((row) => {
    row.addEventListener("click", () => openRouteModal(row.dataset.routeId));
  });
  body.querySelectorAll("[data-fav-route-toggle]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFavoriteRoute(btn.dataset.favRouteToggle);
      applyRouteFilters();
    });
  });
  body.querySelectorAll("[data-edit-draft]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const res = await fetch(`/api/drafts/${btn.dataset.editDraft}`);
      const d = await res.json();
      openDraftForm(d);
    });
  });
  body.querySelectorAll("[data-delete-draft]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm(t("draftConfirmDelete"))) return;
      await fetch(`/api/drafts/${btn.dataset.deleteDraft}`, { method: "DELETE" });
      await loadRoutes();
      renderDashboardFromCache();
      renderGraphFromCache();
    });
  });
}
document.getElementById("routeSearch").addEventListener("input", applyRouteFilters);
document.getElementById("routeTypeFilter").addEventListener("change", applyRouteFilters);
document.getElementById("routeSourceFilter").addEventListener("change", applyRouteFilters);
// (routeFavFilter removed)
document.querySelectorAll(".sortable-th").forEach((th) => {
  th.addEventListener("click", () => {
    const key = th.dataset.sortKey;
    if (state.routeSort.key === key) {
      state.routeSort.dir = -state.routeSort.dir;
    } else {
      state.routeSort = { key, dir: 1 };
    }
    document.querySelectorAll(".sortable-th").forEach((el) => el.removeAttribute("data-sort-dir"));
    th.setAttribute("data-sort-dir", state.routeSort.dir === 1 ? "asc" : "desc");
    applyRouteFilters();
  });
});


// ============================================================
// Модальное окно маршрута
// ============================================================
const routeModalOverlay = document.getElementById("routeModalOverlay");
document.getElementById("routeModalClose").addEventListener("click", closeRouteModal);
routeModalOverlay.addEventListener("click", (e) => { if (e.target === routeModalOverlay) closeRouteModal(); });
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeRouteModal();
    closeDraftForm();
  }
});

function closeRouteModal() { routeModalOverlay.style.display = "none"; }

async function openRouteModal(routeId) {
  routeModalOverlay.style.display = "flex";
  document.getElementById("routeModalBody").innerHTML = `<p class="hint">...</p>`;
  try {
    const minMin = state.minIntervalMin || 3;
    const [detailRes, timetableRes] = await Promise.all([
      fetch(`/api/routes/${encodeURIComponent(routeId)}`),
      fetch(`/api/routes/${encodeURIComponent(routeId)}/timetable`),
    ]);
    const detail = await detailRes.json();
    if (!detailRes.ok) { document.getElementById("routeModalBody").innerHTML = `<p>${escapeHtml(detail.error)}</p>`; return; }
    const timetable = timetableRes.ok ? await timetableRes.json() : null;
    // Вычисляем конфликты с учётом ручных правок (overrides):
    // серверный endpoint не знает о drag-сдвигах, поэтому считаем на фронтенде.
    // Для каждой станции маршрута загружаем её расписание и ищем конфликты.
    const conflictMap = new Map(); // tripOriginMs -> Set<stationId>

    if (detail && detail.stops && detail.stops.length > 0) {
      const minIntervalMs = state.minIntervalMin * 60000;
      // Загружаем расписания всех станций маршрута параллельно
      const stationIds = detail.stops.map((s) => s.stationId);
      const schedResults = await Promise.all(
        stationIds.map((sid) =>
          fetch(`/api/stations/${encodeURIComponent(sid)}/schedule`)
            .then((r) => r.ok ? r.json() : null)
            .catch(() => null)
        )
      );
      for (let si = 0; si < stationIds.length; si++) {
        const schedData = schedResults[si];
        if (!schedData || !schedData.entries) continue;
        const stationId = stationIds[si];
        // Применяем override к entry для корректного effArrival
        const processed = schedData.entries.map((e) => {
          const delta = getOverride(e.routeId, e.tripOriginMs);
          const effArrival = normalizeMs(e.arrivalMs + delta);
          const effDeparture = e.departureMs === null ? null : normalizeMs(e.departureMs + delta);
          return { ...e, effArrival, effDeparture, delta };
        });
        const { conflictKeys } = computeConflicts(processed, minIntervalMs);
        // Из найденных конфликтных ключей берём те, что относятся к нашему маршруту.
        // Ключ формата "routeId:tripOriginMs:platformName" — используем startsWith для фильтрации.
        for (const key of conflictKeys) {
          if (typeof key !== "string" || !key.startsWith(routeId + ":")) continue;
          const parts = key.split(":");
          if (parts.length < 2) continue;
          const t0 = Number(parts[1]);
          if (isNaN(t0)) continue;
          if (!conflictMap.has(t0)) conflictMap.set(t0, new Set());
          conflictMap.get(t0).add(stationId);
        }
      }
    }
    // conflictedTrips — итоговый Map<tripOriginMs, Set<stationId>> для renderRouteModal
    const conflictedTrips = conflictMap;
    let rawDraft = null;
    if (detail.isDraft) {
      try {
        const r = await fetch(`/api/drafts/${encodeURIComponent(routeId)}`);
        if (r.ok) rawDraft = await r.json();
      } catch { /* формулы расписания просто не покажутся, не критично */ }
    }
    state.lastRouteDetail = detail;
    state.lastRouteTimetable = timetable;
    state.lastRouteRawDraft = rawDraft;
    state.lastRouteConflictedTrips = conflictedTrips;
    renderRouteModal(detail, timetable, rawDraft, conflictedTrips);
  } catch (err) {
    document.getElementById("routeModalBody").innerHTML = `<p>${escapeHtml(t("errLoading", { msg: err.message }))}</p>`;
  }
}

function renderRouteModal(data, timetable, rawDraft, conflictedTrips) {
  // conflictedTrips: Map<tripOriginMs, Set<stationId>>
  conflictedTrips = conflictedTrips || state.lastRouteConflictedTrips || new Map();
  const stopsRows = data.stops
    .map((s, i) => {
      const coords = `${Math.round(s.x)} ${Math.round(s.y)} ${Math.round(s.z)}`;
      return `<tr class="clickable-row" data-goto-station="${escapeHtml(s.stationId)}">
        <td>${i + 1}</td>
        <td>${escapeHtml(s.stationName)}</td>
        <td>${escapeHtml(s.platformName)}</td>
        <td>${formatSecondsShort((s.dwellTimeMs / 1000).toFixed(0))}</td>
        <td>${s.durationToNextMs ? formatMinutesShort((s.durationToNextMs / 60000).toFixed(1)) : t("notAvailableShort")}</td>
        <td><span class="coord-cell">${coords} <button class="copy-icon-btn" data-coords="${coords}" title="${escapeHtml(t("copyBtn"))}">⧉</button></span></td>
      </tr>`;
    })
    .join("");

  const metaList = `
    <ul class="modal-meta-list">
      <li><span class="meta-label">${t("modalType")}:</span> ${escapeHtml(data.type || "—")}</li>
      <li><span class="meta-label">${t("modalDepots")}:</span> ${escapeHtml((data.depots || []).join(", ") || "—")}</li>
      <li><span class="meta-label">${t("modalActiveTrips")}:</span> ${data.activeTripCount}</li>
      <li><span class="meta-label">${t("modalTotalDuration")}:</span> ${formatMinutesShort((data.totalDurationMs / 60000).toFixed(1))}</li>
      <li><span class="meta-label">${t("modalTotalDwell")}:</span> ${formatMinutesShort((data.totalDwellMs / 60000).toFixed(1))}</li>
    </ul>`;

  // ---- Объединённая таблица: отправление из депо (T0, шапка колонок +
  // строка отклонения) и расписание по каждой станции для каждого рейса ----
  let stationTimetableHtml = `<p class="hint small">${escapeHtml(t("modalNoActiveTrips"))}</p>`;
  if (timetable && timetable.trips.length) {
    const headerCols = timetable.trips
      .map((trip, i) => {
        const delta = getOverride(data.id, trip.tripOriginMs);
        const edited = delta !== 0;
        const effMs = normalizeMs(trip.tripOriginMs + delta);
        const tripConflictStations = conflictedTrips.get ? conflictedTrips.get(trip.tripOriginMs) : null;
        const hasAnyConflict = tripConflictStations && tripConflictStations.size > 0;
        const removeBtn = data.isDraft
          ? `<button class="col-remove-btn" data-remove-departure="${trip.tripOriginMs}" title="${escapeHtml(t("removeColumn"))}">×</button>`
          : "";
        return `<th class="${edited ? "timetable-cell-edited" : ""}${hasAnyConflict ? " tt-has-conflict" : ""}">${removeBtn}#${i + 1}<br>${formatLocal(effMs, true)}${edited ? `<span class="cell-edited-label">${escapeHtml(t("editedLabel"))}</span>` : ""}</th>`;
      })
      .join("");
    const addColHeader = data.isDraft
      ? `<th><button class="col-add-btn" id="addDepartureColBtn" title="${escapeHtml(t("addColumn"))}">+</button></th>`
      : "";
    const deviationRow = timetable.trips
      .map((trip) => {
        const edited = getOverride(data.id, trip.tripOriginMs) !== 0;
        return `<td class="${deviationClass(trip.deviationMs)} ${edited ? "timetable-cell-edited" : ""}">${formatDeviation(trip.deviationMs)}</td>`;
      })
      .join("");
    const bodyRows = timetable.stations
      .map((st, stIdx) => {
        const cells = timetable.trips
          .map((trip) => {
            const delta = getOverride(data.id, trip.tripOriginMs);
            const edited = delta !== 0;
            const raw = trip.times[stIdx];
            const baseMs = raw.departureMs !== null ? raw.departureMs : raw.arrivalMs;
            const effMs = normalizeMs(baseMs + delta);
            const cellHasConflict = conflictedTrips.get ? conflictedTrips.get(trip.tripOriginMs)?.has(st.stationId) : false;
            const cellIcon = cellHasConflict ? `<span class="tt-conflict-icon" title="${escapeHtml(t("conflictLabel"))}">!</span>` : "";
            return `<td class="${edited ? "timetable-cell-edited" : ""}${cellHasConflict ? " tt-has-conflict" : ""}">${cellIcon}${formatLocal(effMs)}${edited ? `<span class="cell-edited-label">${escapeHtml(t("editedLabel"))}</span>` : ""}</td>`;
          })
          .join("");
        return `<tr><td class="station-col" data-goto-station="${escapeHtml(st.stationId)}">${escapeHtml(st.stationName)}</td>${cells}</tr>`;
      })
      .join("");
    stationTimetableHtml = `
      <div class="timetable-scroll">
        <table class="timetable-matrix">
          <thead><tr><th class="station-col">${t("colDepotDeparture")}</th>${headerCols}${addColHeader}</tr></thead>
          <tbody>
            <tr class="timetable-deviation-row"><td class="station-col">${t("deviationLabel")}</td>${deviationRow}</tr>
            ${bodyRows}
          </tbody>
        </table>
      </div>`;
  }

  let formulaHtml = "";
  const showFormulasForReal = !data.isDraft && timetable && hasAnyOverrideForRoute(data.id);
  if (data.isDraft && rawDraft) {
    const lines = buildFormulaLines(rawDraft, data.id);
    formulaHtml = renderFormulaLines(lines);
  } else if (showFormulasForReal) {
    const t0List = timetable.trips.map((tr) => tr.tripOriginMs);
    const lines = buildFormulaLinesFromTimes(t0List, data.id);
    formulaHtml = renderFormulaLines(lines);
  }

  document.getElementById("routeModalBody").innerHTML = `
    <h2><span class="dot" style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${data.color};"></span>${escapeHtml(data.name)} ${data.number ? "(" + escapeHtml(data.number) + ")" : ""}${data.isDraft ? " " + draftFlagHtml() : ""}</h2>
    <div class="modal-toolbar">
      <div class="modal-toolbar-left">
        ${data.isDraft ? `
          <button class="secondary-btn" id="editDraftInModalBtn" data-i18n="draftEdit">Изменить</button>
          <button class="secondary-btn danger-btn" id="deleteDraftInModalBtn" data-i18n="draftDelete">Удалить</button>
        ` : `
          ${hasAnyOverrideForRoute(data.id) ? `<button class="secondary-btn danger-btn" id="resetRouteEditsBtn" data-i18n="resetRouteEdits">Сбросить правки</button>` : ""}
        `}
        <button class="icon-btn" id="toggleFavoriteRouteBtn" style="font-size:18px;" title="">☆</button>
        <button class="secondary-btn" id="reverseRouteBtn" data-i18n="openReverseRoute">Обратный маршрут</button>
      </div>
      <div class="modal-toolbar-right">
        <div class="dropdown-wrap">
          <button class="secondary-btn" id="routeActionsBtn" data-i18n="routeActionsMenu">Действия ▾</button>
          <div class="dropdown-menu" id="routeActionsMenu" style="display:none;">
            <button class="dropdown-item" id="openGraphForRouteBtn" data-i18n="openGraphForRoute">Открыть график движения</button>
            <button class="dropdown-item" id="createDraftFromRouteBtn" data-i18n="createDraftFromRoute">Создать пробный маршрут</button>
          </div>
        </div>
      </div>
    </div>
    ${metaList}
    <h4>${t("modalStops")}</h4>
    <table>
      <thead><tr><th>#</th><th>${t("colStation")}</th><th>${t("colPlatform")}</th><th>${t("colDwell")}</th><th>${t("colNext")}</th><th>${t("colCoords")}</th></tr></thead>
      <tbody>${stopsRows}</tbody>
    </table>
    <h4>${t("modalStationTimetable")}</h4>
    <p class="hint small">${escapeHtml(t("modalEditedHint"))}</p>
    ${stationTimetableHtml}
    ${formulaHtml}
  `;

  document.querySelectorAll(".copy-icon-btn[data-coords]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(btn.dataset.coords);
        const original = btn.textContent;
        btn.textContent = "✓";
        btn.classList.add("copied");
        setTimeout(() => { btn.textContent = original; btn.classList.remove("copied"); }, 1200);
      } catch {
        /* буфер обмена недоступен (например, не https) — молча игнорируем */
      }
    });
  });

  document.querySelectorAll(".copy-icon-btn[data-copy-formula]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(btn.dataset.copyFormula);
        btn.textContent = "✓";
        btn.classList.add("copied");
        setTimeout(() => { btn.textContent = "⧉"; btn.classList.remove("copied"); }, 1200);
      } catch {
        /* буфер обмена недоступен — молча игнорируем */
      }
    });
  });

  // Закрепление шапки, строки отклонений и первого столбца таблицы
  // расписания при скролле: делаем вручную через transform, а не
  // полагаемся на CSS position:sticky у ячеек таблицы — на практике это
  // надёжнее в разных браузерах. Обновление синхронизировано с кадром
  // отрисовки (requestAnimationFrame), чтобы не было визуального "рывка"
  // между нативной прокруткой и transform.
  const timetableScrollEl = document.querySelector(".timetable-scroll");
  if (timetableScrollEl) {
    const cornerCell = timetableScrollEl.querySelector("thead th.station-col");
    const headerOtherCells = Array.from(timetableScrollEl.querySelectorAll("thead th")).filter((el) => el !== cornerCell);
    const deviationRow = timetableScrollEl.querySelector(".timetable-deviation-row");
    const deviationStationCell = deviationRow ? deviationRow.querySelector("td.station-col") : null;
    const deviationOtherCells = deviationRow
      ? Array.from(deviationRow.querySelectorAll("td")).filter((el) => el !== deviationStationCell)
      : [];
    const bodyFirstColCells = Array.from(timetableScrollEl.querySelectorAll("tbody td.station-col")).filter(
      (el) => el !== deviationStationCell
    );

    let rafPending = false;
    const applyStickyTransform = () => {
      if (rafPending) return;
      rafPending = true;
      requestAnimationFrame(() => {
        rafPending = false;
        const sx = timetableScrollEl.scrollLeft;
        const sy = timetableScrollEl.scrollTop;
        headerOtherCells.forEach((el) => { el.style.transform = `translateY(${sy}px)`; });
        if (cornerCell) cornerCell.style.transform = `translate(${sx}px, ${sy}px)`;
        // Строка отклонений "приклеена" сразу под шапкой — у неё тот же
        // вертикальный сдвиг sy (её естественный отступ от верха таблицы
        // под шапкой уже заложен в обычной раскладке, его трогать не надо).
        deviationOtherCells.forEach((el) => { el.style.transform = `translateY(${sy}px)`; });
        if (deviationStationCell) deviationStationCell.style.transform = `translate(${sx}px, ${sy}px)`;
        bodyFirstColCells.forEach((el) => { el.style.transform = `translateX(${sx}px)`; });
      });
    };
    timetableScrollEl.addEventListener("scroll", applyStickyTransform, { passive: true });
    applyStickyTransform();
  }

  // #8: клик по станции в списке остановок -> расписание этой станции
  document.querySelectorAll("[data-goto-station]").forEach((el) => {
    el.addEventListener("click", () => {
      const stationId = el.dataset.gotoStation;
      const station = state.stations.find((s) => s.id === stationId);
      closeRouteModal();
      switchToTab("schedule");
      state.currentStationId = stationId;
      scheduleAC.setSelected(stationId, station ? station.name : stationId);
      renderFavoritesBar();
      updateFavoriteBtn();
      loadSchedule();
    });
  });

  // #9: открыть график движения для этого маршрута (А = первая, Б = последняя остановка)
  const favRouteBtn = document.getElementById("toggleFavoriteRouteBtn");
  if (favRouteBtn) {
    const isFav = isFavoriteRoute(data.id);
    favRouteBtn.textContent = isFav ? "★" : "☆";
    favRouteBtn.style.color = isFav ? "#fbbf24" : "";
    favRouteBtn.title = isFav ? t("removeFavorite") : t("addFavorite");
    favRouteBtn.addEventListener("click", () => {
      toggleFavoriteRoute(data.id);
      const nowFav = isFavoriteRoute(data.id);
      favRouteBtn.textContent = nowFav ? "★" : "☆";
      favRouteBtn.style.color = nowFav ? "#fbbf24" : "";
      favRouteBtn.title = nowFav ? t("removeFavorite") : t("addFavorite");
    });
  }

  const resetEditsBtn = document.getElementById("resetRouteEditsBtn");
  if (resetEditsBtn) {
    resetEditsBtn.addEventListener("click", () => {
      clearOverridesForRoute(data.id);
      openRouteModal(data.id);
    });
  }

  // Dropdown "Действия"
  const actionsBtn = document.getElementById("routeActionsBtn");
  const actionsMenu = document.getElementById("routeActionsMenu");
  if (actionsBtn && actionsMenu) {
    actionsBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      actionsMenu.style.display = actionsMenu.style.display === "block" ? "none" : "block";
    });
    document.addEventListener("click", () => { actionsMenu.style.display = "none"; }, { once: true });
  }

  const openGraphBtn = document.getElementById("openGraphForRouteBtn");
  if (openGraphBtn) {
    if (data.stops.length < 2) {
      openGraphBtn.disabled = true;
    } else {
      openGraphBtn.addEventListener("click", () => {
        const first = data.stops[0];
        const last = data.stops[data.stops.length - 1];
        closeRouteModal();
        switchToTab("graph");
        graphFromAC.setSelected(first.stationId, first.stationName);
        graphToAC.setSelected(last.stationId, last.stationName);
        buildGraph();
      });
    }
  }

  // Кнопка "Обратный маршрут" — ищем по депо, затем по цвету/номеру
  const reverseBtn = document.getElementById("reverseRouteBtn");
  if (reverseBtn) {
    const myDepots = new Set(data.depots || []);
    const score = (r) => {
      let s = 0;
      if ((r.depots||[]).some((d) => myDepots.has(d))) s += 10;
      if (data.number && r.number === data.number) s += 4;
      if (data.color && r.color === data.color) s += 2;
      if (r.name === data.name) s += 1;
      return s;
    };
    const reverseRoute = state.routes
      .filter((r) => r.id !== data.id && !r.isDraft && score(r) > 0)
      .sort((a, b) => score(b) - score(a))[0] || null;
    if (reverseRoute) {
      reverseBtn.addEventListener("click", () => openRouteModal(reverseRoute.id));
    } else {
      reverseBtn.disabled = true;
      reverseBtn.style.opacity = "0.4";
    }
  }

  // Редактирование/удаление пробного маршрута прямо из карточки
  const editBtn = document.getElementById("editDraftInModalBtn");
  if (editBtn) {
    editBtn.addEventListener("click", async () => {
      const res = await fetch(`/api/drafts/${data.id}`);
      const d = await res.json();
      closeRouteModal();
      openDraftForm(d);
    });
  }
  const deleteBtn = document.getElementById("deleteDraftInModalBtn");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", async () => {
      if (!confirm(t("draftConfirmDelete"))) return;
      await fetch(`/api/drafts/${data.id}`, { method: "DELETE" });
      closeRouteModal();
      await loadRoutes();
      renderDashboardFromCache();
      renderGraphFromCache();
    });
  }
  const templateBtn = document.getElementById("createDraftFromRouteBtn");
  if (templateBtn) {
    templateBtn.addEventListener("click", () => {
      const pseudo = {
        id: null,
        name: `${data.name} (${t("draftTemplateCopySuffix")})`,
        number: data.number,
        color: data.colorRaw ?? 0x9ca3af,
        type: data.type,
        depotLabel: (data.depots || [])[0] || "",
        stops: data.stops.map((s) => ({ stationId: s.stationId, platformName: s.platformName, dwellTimeMs: s.dwellTimeMs })),
        durationsMs: data.stops.slice(0, -1).map((s) => s.durationToNextMs || 60000),
        departureTimesOfDayMs: [8 * 3600000],
        departureGroups: [],
      };
      closeRouteModal();
      openDraftForm(pseudo);
    });
  }

  // Управление столбцами отправлений (только у пробных маршрутов):
  // добавить новый рейс или удалить конкретный, прямо в таблице.
  document.querySelectorAll("[data-remove-departure]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm(t("removeColumnConfirm"))) return;
      const tripOriginMs = Number(btn.dataset.removeDeparture);
      const fullDraft = await (await fetch(`/api/drafts/${data.id}`)).json();
      let newTimes = fullDraft.departureTimesOfDayMs || [];
      let newGroups = fullDraft.departureGroups || [];

      if (newTimes.includes(tripOriginMs)) {
        newTimes = newTimes.filter((v) => v !== tripOriginMs);
      } else {
        // Удаляемое отправление могло быть частью группы с интервалом
        // (D+X*I). В этом случае группу нужно не "взрывать" целиком в
        // отдельные времена, а АККУРАТНО РАЗБИТЬ на 1-2 подгруппы вокруг
        // удаляемого индекса — так у маршрута с 24 отправлениями после
        // удаления одного в середине останется 2 формулы, а не 23
        // отдельные строки.
        const remainingGroups = [];
        let found = false;
        for (const g of newGroups) {
          if (found) { remainingGroups.push(g); continue; }
          const total = g.additionalCount + 1;
          let removedX = -1;
          for (let x = 0; x < total; x++) {
            if (normalizeMs(g.firstTimeMs + x * g.intervalMs) === tripOriginMs) { removedX = x; break; }
          }
          if (removedX === -1) { remainingGroups.push(g); continue; }
          found = true;
          if (removedX > 0) {
            // Часть ДО удаляемого индекса: 0..removedX-1
            remainingGroups.push({ firstTimeMs: g.firstTimeMs, intervalMs: g.intervalMs, additionalCount: removedX - 1 });
          }
          if (removedX < total - 1) {
            // Часть ПОСЛЕ удаляемого индекса: removedX+1..total-1
            const newFirst = normalizeMs(g.firstTimeMs + (removedX + 1) * g.intervalMs);
            remainingGroups.push({ firstTimeMs: newFirst, intervalMs: g.intervalMs, additionalCount: total - 1 - (removedX + 1) });
          }
        }
        newGroups = remainingGroups;
      }

      const totalRemaining = newTimes.length + newGroups.reduce((s, g) => s + g.additionalCount + 1, 0);
      if (totalRemaining === 0) { alert(t("removeColumnLastError")); return; }
      const res = await fetch(`/api/drafts/${data.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...fullDraft, departureTimesOfDayMs: newTimes, departureGroups: newGroups }),
      });
      if (res.ok) openRouteModal(data.id);
    });
  });
  const addColBtn = document.getElementById("addDepartureColBtn");
  if (addColBtn) {
    addColBtn.addEventListener("click", async () => {
      const input = prompt(t("addColumnPrompt"), "08:00");
      if (!input) return;
      const m = input.trim().match(/^(\d{1,2}):(\d{2})$/);
      if (!m) { alert(t("addColumnInvalid")); return; }
      const hh = Number(m[1]), mm = Number(m[2]);
      if (hh > 23 || mm > 59) { alert(t("addColumnInvalid")); return; }
      const localMs = (hh * 60 + mm) * 60000;
      const newTimeMs = normalizeMs(localMs - currentTzOffsetMin() * 60000);
      const fullDraft = await (await fetch(`/api/drafts/${data.id}`)).json();
      const updated = [...fullDraft.departureTimesOfDayMs, newTimeMs];
      const res = await fetch(`/api/drafts/${data.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...fullDraft, departureTimesOfDayMs: updated }),
      });
      if (res.ok) openRouteModal(data.id);
    });
  }
  // Применяем переводы к кнопкам которые были созданы динамически через innerHTML
  // (applyI18n работает только с элементами которые уже существуют в DOM)
  applyI18n();
}

// ============================================================
// Пробные (черновые) маршруты
// ============================================================
let draftFormStops = [];
let editingDraftId = null;
let editingDraftExtraDepartures = []; // отправления, кроме первого (если их добавили в карточке маршрута)
let editingDraftExtraGroups = []; // группы D+X*I, кроме первой (если их добавили в карточке маршрута)

/**
 * Типы маршрутов на сервере зависят от установленных аддонов (помимо
 * стандартных train_normal/train_light_rail/train_high_speed их может
 * быть гораздо больше) — поэтому список в форме строим из РЕАЛЬНО
 * встречающихся в топологии типов, а не из жёстко заданного списка.
 */
function populateDraftTypeOptions() {
  const fallback = ["train_normal", "train_light_rail", "train_high_speed"];
  const types = Array.from(new Set(state.routes.filter((r) => !r.isDraft && r.type).map((r) => r.type))).sort();
  const finalList = types.length ? types : fallback;
  const select = document.getElementById("draftType");
  select.innerHTML = finalList.map((ty) => `<option value="${escapeHtml(ty)}">${escapeHtml(ty)}</option>`).join("");
}

async function openDraftForm(existing) {
  editingDraftId = existing ? existing.id : null;
  if (state.routes.length === 0) {
    try {
      const res = await fetch("/api/routes");
      state.routes = await res.json();
      state.routesById = new Map(state.routes.map((r) => [r.id, r]));
    } catch {
      /* используем запасной список типов, если запрос не удался */
    }
  }
  populateDraftTypeOptions();
  document.getElementById("draftModalOverlay").style.display = "flex";
  document.getElementById("draftFormTitle").textContent = existing ? t("editDraftTitle") : t("newDraftBtn");
  document.getElementById("draftName").value = existing ? existing.name : "";
  document.getElementById("draftNumber").value = existing ? existing.number : "";
  document.getElementById("draftColor").value = existing
    ? "#" + (existing.color & 0xffffff).toString(16).padStart(6, "0")
    : "#9ca3af";
  document.getElementById("draftType").value = existing ? existing.type : document.getElementById("draftType").options[0]?.value;
  document.getElementById("draftDepot").value = existing ? existing.depotLabel : "";

  if (existing) {
    // "Первое отправление"/"интервал" в форме всегда отражают ОДНУ
    // главную запись: либо первую группу D+X*I (если она есть), либо
    // первое индивидуальное отправление. Всё остальное (другие группы,
    // другие отдельные отправления — например, добавленные прямо в
    // карточке маршрута) сохраняем как есть и просто прикладываем
    // обратно при сохранении формы.
    let primaryTimeMs;
    if (existing.departureGroups && existing.departureGroups.length > 0) {
      const [primaryGroup, ...restGroups] = existing.departureGroups;
      primaryTimeMs = primaryGroup.firstTimeMs;
      document.getElementById("draftInterval").value = formatMsToHms(primaryGroup.intervalMs);
      editingDraftExtraGroups = restGroups;
      editingDraftExtraDepartures = existing.departureTimesOfDayMs || [];
    } else {
      const [primaryMs, ...restTimes] = existing.departureTimesOfDayMs || [0];
      primaryTimeMs = primaryMs;
      document.getElementById("draftInterval").value = "";
      editingDraftExtraGroups = [];
      editingDraftExtraDepartures = restTimes;
    }
    const localMs = normalizeMs(primaryTimeMs + currentTzOffsetMin() * 60000);
    const hh = String(Math.floor(localMs / 3600000)).padStart(2, "0");
    const mm = String(Math.floor((localMs % 3600000) / 60000)).padStart(2, "0");
    document.getElementById("draftDeparture").value = `${hh}:${mm}`;
    draftFormStops = existing.stops.map((s, i) => ({
      stationId: s.stationId,
      stationName: (state.stations.find((st) => st.id === s.stationId) || {}).name || s.stationId,
      platformName: s.platformName,
      dwellTimeSec: Math.round(s.dwellTimeMs / 1000),
      durationToNextSec: i < existing.durationsMs.length ? Math.round(existing.durationsMs[i] / 1000) : null,
      platformOptions: [],
    }));
    renderDraftStopsList();
    // Подгружаем реальные варианты платформ для каждой остановки (не
    // блокирует открытие формы — список просто появится чуть позже).
    draftFormStops.forEach((stop) => {
      fetch(`/api/draft-helper/suggest?toStationId=${encodeURIComponent(stop.stationId)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((sug) => {
          if (sug && sug.platformOptions && sug.platformOptions.length) {
            stop.platformOptions = sug.platformOptions;
            renderDraftStopsList();
          }
        })
        .catch(() => {});
    });
  } else {
    document.getElementById("draftDeparture").value = "08:00";
    document.getElementById("draftInterval").value = "";
    draftFormStops = [];
    editingDraftExtraDepartures = [];
    editingDraftExtraGroups = [];
    renderDraftStopsList();
  }
}

function closeDraftForm() {
  document.getElementById("draftModalOverlay").style.display = "none";
  editingDraftId = null;
  draftFormStops = [];
}

function readStopsFromDom() {
  const rows = document.querySelectorAll("#draftStopsList .draft-stop-row");
  rows.forEach((row, i) => {
    if (!draftFormStops[i]) return;
    const platformSelect = row.querySelector("select.stop-platform");
    if (platformSelect) {
      const customInput = row.querySelector(".stop-platform-custom");
      draftFormStops[i].platformName = platformSelect.value === "__custom__" ? customInput.value : platformSelect.value;
    } else {
      draftFormStops[i].platformName = row.querySelector("input.stop-platform").value;
    }
    draftFormStops[i].dwellTimeSec = Number(row.querySelector(".stop-dwell").value) || 0;
    const durEl = row.querySelector(".stop-duration");
    if (durEl) draftFormStops[i].durationToNextSec = Number(durEl.value) || 0;
  });
}

function renderDraftStopsList() {
  const container = document.getElementById("draftStopsList");
  if (draftFormStops.length === 0) {
    container.innerHTML = `<p class="hint small">${escapeHtml(t("draftNoStopsYet"))}</p>`;
    return;
  }
  container.innerHTML = draftFormStops
    .map((s, i) => {
      const hasOptions = s.platformOptions && s.platformOptions.length > 0;
      const isCustom = hasOptions && !s.platformOptions.includes(s.platformName);
      const platformField = hasOptions
        ? `<select class="stop-platform">
            ${s.platformOptions.map((p) => `<option value="${escapeHtml(p)}" ${!isCustom && p === s.platformName ? "selected" : ""}>${escapeHtml(p)}</option>`).join("")}
            <option value="__custom__" ${isCustom ? "selected" : ""}>${escapeHtml(t("customPlatformOption"))}</option>
          </select>
          <input type="text" class="stop-platform-custom" style="display:${isCustom ? "inline-block" : "none"};width:50px;" value="${escapeHtml(isCustom ? s.platformName : "")}" placeholder="${escapeHtml(t("colPlatform"))}">`
        : `<input type="text" class="stop-platform" value="${escapeHtml(s.platformName || "")}" placeholder="${escapeHtml(t("colPlatform"))}">`;
      return `
      <div class="draft-stop-row" data-idx="${i}">
        <span>${i + 1}.</span>
        <span class="stop-name">${escapeHtml(s.stationName)}</span>
        ${platformField}
        <span class="stop-unit">${escapeHtml(t("draftStopDwell"))}</span>
        <input type="number" class="stop-dwell" value="${s.dwellTimeSec ?? 30}" min="0" step="5">
        ${i < draftFormStops.length - 1
          ? `<span class="stop-unit">${escapeHtml(t("draftStopDuration"))}</span><input type="number" class="stop-duration" value="${s.durationToNextSec ?? 60}" min="1" step="5">`
          : ""}
        <button class="icon-btn" data-up="${i}" ${i === 0 ? "disabled" : ""}>↑</button>
        <button class="icon-btn" data-down="${i}" ${i === draftFormStops.length - 1 ? "disabled" : ""}>↓</button>
        <button class="icon-btn" data-remove="${i}">×</button>
      </div>`;
    })
    .join("");

  container.querySelectorAll("select.stop-platform").forEach((sel) => {
    sel.addEventListener("change", () => {
      const customInput = sel.parentElement.querySelector(".stop-platform-custom");
      if (sel.value === "__custom__") {
        customInput.style.display = "inline-block";
        customInput.focus();
      } else {
        customInput.style.display = "none";
      }
    });
  });

  container.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      readStopsFromDom();
      draftFormStops.splice(Number(btn.dataset.remove), 1);
      renderDraftStopsList();
    });
  });
  container.querySelectorAll("[data-up]").forEach((btn) => {
    btn.addEventListener("click", () => {
      readStopsFromDom();
      const i = Number(btn.dataset.up);
      [draftFormStops[i - 1], draftFormStops[i]] = [draftFormStops[i], draftFormStops[i - 1]];
      renderDraftStopsList();
    });
  });
  container.querySelectorAll("[data-down]").forEach((btn) => {
    btn.addEventListener("click", () => {
      readStopsFromDom();
      const i = Number(btn.dataset.down);
      [draftFormStops[i + 1], draftFormStops[i]] = [draftFormStops[i], draftFormStops[i + 1]];
      renderDraftStopsList();
    });
  });
}

const draftStationAC = makeAutocomplete({
  inputEl: document.getElementById("draftStationInput"),
  listEl: document.getElementById("draftStationACList"),
  getItems: () => state.stations,
  onSelect: async (id, item) => {
    readStopsFromDom();
    const prevStop = draftFormStops[draftFormStops.length - 1];
    const newStop = { stationId: id, stationName: item.name, platformName: "1", dwellTimeSec: 30, durationToNextSec: 60, platformOptions: [] };
    draftFormStops.push(newStop);
    renderDraftStopsList();
    document.getElementById("draftStationInput").value = "";

    // Автоподбор: время перегона (от предыдущей станции) и время
    // стоянки/реальные названия платформ — на основе данных похожих
    // (по типу) реальных поездов сервера. Значения остаются доступны
    // для ручного редактирования после подстановки.
    try {
      const type = document.getElementById("draftType").value;
      const params = new URLSearchParams({ toStationId: id });
      if (type) params.set("type", type);
      if (prevStop) params.set("fromStationId", prevStop.stationId);
      const res = await fetch(`/api/draft-helper/suggest?${params}`);
      if (!res.ok) return;
      const sug = await res.json();
      if (prevStop && sug.durationMs) prevStop.durationToNextSec = Math.round(sug.durationMs / 1000);
      if (sug.toDwellMs) newStop.dwellTimeSec = Math.round(sug.toDwellMs / 1000);
      if (sug.platformOptions && sug.platformOptions.length) {
        newStop.platformOptions = sug.platformOptions;
        newStop.platformName = sug.platformOptions[0];
      }
      renderDraftStopsList();
    } catch {
      /* автоподбор не критичен — оставляем значения по умолчанию */
    }
  },
});

attachHmsInputMask(document.getElementById("draftInterval"));
document.getElementById("newDraftBtn").addEventListener("click", () => openDraftForm(null));
document.getElementById("cancelDraftBtn").addEventListener("click", closeDraftForm);
document.getElementById("draftModalClose").addEventListener("click", closeDraftForm);
document.getElementById("draftModalOverlay").addEventListener("click", (e) => {
  if (e.target === document.getElementById("draftModalOverlay")) closeDraftForm();
});
document.getElementById("newDraftBtnSchedule").addEventListener("click", () => openDraftForm(null));
document.getElementById("newDraftBtnGraph").addEventListener("click", () => openDraftForm(null));

document.getElementById("saveDraftBtn").addEventListener("click", async () => {
  readStopsFromDom();
  if (draftFormStops.length < 2) { alert(t("draftNeedTwoStops")); return; }
  const name = document.getElementById("draftName").value.trim();
  if (!name) { alert(t("draftNeedName")); return; }

  const colorInt = parseInt(document.getElementById("draftColor").value.replace("#", ""), 16);
  const [hh, mm] = document.getElementById("draftDeparture").value.split(":").map(Number);
  const localMs = (hh * 60 + mm) * 60000;
  const firstDepartureMs = normalizeMs(localMs - currentTzOffsetMin() * 60000);
  const intervalRaw = document.getElementById("draftInterval").value.trim();
  let intervalMs = 0;
  if (intervalRaw) {
    const parsed = parseHmsToMs(intervalRaw);
    if (parsed === null || parsed <= 0) { alert(t("draftIntervalInvalid")); return; }
    intervalMs = parsed;
  }

  // Если задан интервал — самое первое отправление формы становится
  // началом группы "D + X*I", автоматически заполняющей весь день.
  // Если интервал не задан — это просто одно отдельное отправление (как
  // раньше). В обоих случаях сохраняем то, что уже было добавлено прямо
  // в карточке маршрута (доп. группы/отдельные отправления) —
  // форма управляет только самым первым отправлением/группой.
  let departureTimesOfDayMs = [...editingDraftExtraDepartures];
  let departureGroups = [...editingDraftExtraGroups];
  if (intervalMs > 0) {
    const additionalCount = Math.ceil(MS_PER_DAY / intervalMs) - 1;
    departureGroups = [{ firstTimeMs: firstDepartureMs, intervalMs, additionalCount }, ...departureGroups];
  } else {
    departureTimesOfDayMs = [firstDepartureMs, ...departureTimesOfDayMs];
  }

  const payload = {
    name,
    number: document.getElementById("draftNumber").value.trim(),
    color: colorInt,
    type: document.getElementById("draftType").value,
    depotLabel: document.getElementById("draftDepot").value.trim(),
    stops: draftFormStops.map((s) => ({ stationId: s.stationId, platformName: s.platformName, dwellTimeMs: s.dwellTimeSec * 1000 })),
    durationsMs: draftFormStops.slice(0, -1).map((s) => (s.durationToNextSec || 0) * 1000),
    departureTimesOfDayMs,
    departureGroups,
  };

  try {
    const url = editingDraftId ? `/api/drafts/${editingDraftId}` : "/api/drafts";
    const method = editingDraftId ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok) { alert(data.error || "Error"); return; }
    closeDraftForm();
    await loadRoutes();
    renderDashboardFromCache();
    renderGraphFromCache();
  } catch (err) {
    alert(t("errLoading", { msg: err.message }));
  }
});

// ============================================================
// Аналитика опозданий
// ============================================================
// ============================================================
// Настройки
// ============================================================
function buildTzOptions() {
  const opts = [];
  for (let m = -12 * 60; m <= 14 * 60; m += 30) {
    const sign = m >= 0 ? "+" : "-";
    const abs = Math.abs(m);
    const hh = Math.floor(abs / 60);
    const mm = abs % 60;
    const label = mm === 0 ? `UTC${sign}${hh}` : `UTC${sign}${hh}:${String(mm).padStart(2, "0")}`;
    opts.push({ value: String(m), label });
  }
  return opts;
}

function initSettingsUI() {
  const langSelect = document.getElementById("languageSelect");
  const tzSelect = document.getElementById("timezoneSelect");

  langSelect.value = settings.langMode;
  tzSelect.innerHTML =
    `<option value="auto">${escapeHtml(t("autoOption"))}</option>` +
    buildTzOptions().map((o) => `<option value="${o.value}">${o.label}</option>`).join("");
  tzSelect.value = settings.tzMode;

  document.getElementById("tzDetectedHint").textContent = t("tzDetected", {
    tz: `${detectSystemTzName()} (UTC${detectSystemTzOffsetMin() >= 0 ? "+" : ""}${(detectSystemTzOffsetMin() / 60).toFixed(1).replace(".0", "")})`,
  });

  langSelect.addEventListener("change", () => {
    settings.langMode = langSelect.value;
    localStorage.setItem("mtr_lang_mode", settings.langMode);
    refreshAllViews();
  });
  tzSelect.addEventListener("change", () => {
    settings.tzMode = tzSelect.value;
    localStorage.setItem("mtr_tz_mode", settings.tzMode);
    refreshAllViews();
  });
}

function refreshAllViews() {
  applyI18n();
  initSettingsUI(); // переотрисовать подписи селектов на новом языке
  renderInstructions();
  refreshStatus();
  document.getElementById("minIntervalValue").textContent = t("minIntervalValue", { m: state.minIntervalMin });
  renderDashboardFromCache();
  updateScheduleMeta();
  renderGraphFromCache();
  if (state.routes.length) { populateRouteTypeFilter(); applyRouteFilters(); }
  if (state.lastRouteDetail && routeModalOverlay.style.display !== "none") {
    renderRouteModal(state.lastRouteDetail, state.lastRouteTimetable, state.lastRouteRawDraft, state.lastRouteConflictedTrips);
  }
}

// ============================================================
// Инструкции
// ============================================================
const INSTRUCTIONS = [
  {
    id: "schedule-basics",
    titleRu: "Расписание по станции", titleEn: "Station schedule",
    bodyRu: `<p>Начните вводить название станции в поле поиска — появится список подсказок, кликните по нужной. Дашборд покажет все платформы станции и прибытия поездов на временной шкале. Рядом с полем поиска — значок ☆: кликните, чтобы добавить станцию в <b>Избранное</b> (появится быстрая панель доступа снизу).</p>
      <p>Жёлтая рамка вокруг блока — отклонение от графика более минуты. Янтарный «!» — конфликт: два поезда слишком близко на одной платформе. <b>Виджет «Ближайшие прибытия»</b> в сайдбаре показывает 6 ближайших поездов и автоматически обновляется каждые 30 секунд.</p>`,
    bodyEn: `<p>Start typing a station name in the search field — a list of suggestions appears, click the one you need. The dashboard shows all platforms and train arrivals on a timeline. The ☆ button next to the search field adds the station to <b>Favorites</b> (a quick-access bar appears below).</p>
      <p>A bright border means a schedule deviation of more than a minute. An amber "!" icon means a conflict: two trains too close on the same platform. The <b>"Upcoming arrivals"</b> sidebar widget shows the 6 nearest trains and refreshes every 30 seconds.</p>`,
  },
  {
    id: "drag-edit",
    titleRu: "Ручное редактирование (перетаскивание)", titleEn: "Manual editing (drag)",
    bodyRu: `<p>Перетащите блок поезда (на дашборде) или линию поезда (на графике движения) по горизонтали — время сдвинется, рейс станет пунктирным.</p>
      <p><code>Shift</code> + перетаскивание — сдвигает <b>все</b> рейсы маршрута сразу. <code>Alt</code> + вертикальное перетаскивание (≥ полная высота строки) — переносит поезд на другую платформу.</p>
      <p><code>Ctrl+Z</code> — отменить, <code>Ctrl+Y</code> — вернуть. <code>Ctrl+C</code> по блоку — скопировать сдвиг, <code>Ctrl+V</code> — применить его к выбранному маршруту.</p>
      <p>Кнопка «Сбросить ручные правки» в сайдбаре — сбрасывает все сдвиги. В карточке маршрута — кнопка «Сбросить правки этого маршрута» (появляется только при наличии изменений).</p>`,
    bodyEn: `<p>Drag a train block (dashboard) or line (graph) horizontally — its time shifts and the trip becomes dashed.</p>
      <p><code>Shift</code>+drag shifts <b>all</b> trips of that route at once. <code>Alt</code>+vertical drag (≥ full row height) moves the train to another platform.</p>
      <p><code>Ctrl+Z</code> — undo, <code>Ctrl+Y</code> — redo. <code>Ctrl+C</code> on a block copies the time offset, <code>Ctrl+V</code> pastes it onto the selected route.</p>
      <p>The "Reset manual edits" sidebar button clears all shifts. In the route card, a "Reset edits for this route" button appears if that route has been changed.</p>`,
  },
  {
    id: "favorites",
    titleRu: "Избранное", titleEn: "Favorites",
    bodyRu: `<p><b>Станции</b> — кнопка ☆ рядом с полем поиска. <b>Маршруты</b> — кнопка ☆ в карточке маршрута, в строке таблицы маршрутов, или везде, где рядом с маршрутом есть этот значок.</p>
      <p>В нижней части поиска станций появляется панель быстрого доступа: клик по станции сразу открывает её расписание, клик по маршруту — карточку маршрута.</p>
      <p>В таблице маршрутов — кнопка ☆ в панели управления фильтрует список, оставляя только избранные. Уведомления тоже можно ограничить только избранными маршрутами (настройка в разделе «Настройки»).</p>`,
    bodyEn: `<p><b>Stations</b> — the ☆ button next to the search field. <b>Routes</b> — the ☆ button in the route card, in the routes table row, or anywhere the icon appears next to a route.</p>
      <p>A quick-access bar appears below the station search: clicking a station opens its schedule, clicking a route opens the route card.</p>
      <p>In the routes table, the ☆ button in the toolbar filters the list to favorites only. Notifications can also be limited to favorite routes only (see Settings).</p>`,
  },
  {
    id: "filters-zoom",
    titleRu: "Фильтры и масштаб", titleEn: "Filters and zoom",
    bodyRu: `<p>В сайдбаре слева — фильтр платформ, слайдер минимального интервала для конфликтов (по умолчанию 3 мин), масштаб времени.</p>
      <p>Масштаб: кнопки +/− или <code>Ctrl</code>+колесо мыши над графиком. При увеличении деления шкалы мельчают вплоть до минут.</p>
      <p>В таблице маршрутов — фильтр по типу, источнику (настоящие/пробные), избранным, и поиск. Заголовки столбцов кликабельны для сортировки.</p>`,
    bodyEn: `<p>The left sidebar has a platform filter, a minimum-interval slider for conflicts (default 3 min), and zoom.</p>
      <p>Zoom: +/− buttons or <code>Ctrl</code>+mouse wheel over the chart. As you zoom in, the time axis gets finer down to minutes.</p>
      <p>In the routes table — filters for type, source (real/draft), favorites, and search. Column headers are clickable to sort.</p>`,
  },
  {
    id: "train-graph",
    titleRu: "График движения поездов", titleEn: "Train graph",
    bodyRu: `<p>Выберите станцию А и Б — приложение строит граф: станции по вертикали на реальном расстоянии, время по горизонтали, наклон = скорость.</p>
      <p>Кнопка ⇄ меняет А и Б местами. Тумблер «Показывать обратные рейсы» добавляет маршруты Б→А в легенду — по умолчанию они скрыты. Каждый маршрут в легенде включается/выключается кликом по нему. Значок ⓘ открывает карточку маршрута.</p>
      <p>Маршруты, пересекающие полночь, показывают продолжение/начало на противоположной стороне графика (обрезанные хвосты).</p>`,
    bodyEn: `<p>Pick station A and B — the app builds a graph: stations on the vertical axis spaced by real distance, time on horizontal axis, slope = train speed.</p>
      <p>The ⇄ button swaps A and B. "Show reverse trips" adds B→A routes to the legend — hidden by default. Each legend item can be toggled individually by clicking. The ⓘ icon opens the route card.</p>
      <p>Routes crossing midnight show their continuation/beginning on the opposite side of the chart.</p>`,
  },
  {
    id: "route-card",
    titleRu: "Карточка маршрута", titleEn: "Route card",
    bodyRu: `<p>Клик по маршруту в любой вкладке открывает карточку: метаданные, список остановок с координатами (иконка ⧉ копирует в буфер), таблица расписания на весь день. Шапка и первый столбец таблицы закреплены при прокрутке.</p>
      <p>Ячейки с жёлтым «!» — конфликт платформы в это время (если станция с конфликтом открыта на дашборде). Пунктирная рамка — ячейка изменена вручную.</p>
      <p>Для пробных маршрутов — секция «Формула расписания» (D+X*I) для вставки в игру. Если конкретный рейс сдвинут вручную, он выпадает из формулы в отдельную строку.</p>`,
    bodyEn: `<p>Clicking a route anywhere opens the card: metadata, stop list with coordinates (⧉ copies to clipboard), and a full-day timetable. The header and first column are sticky when scrolling.</p>
      <p>Cells with a yellow "!" indicate a platform conflict at that time (if a conflicting station is open on the dashboard). Dashed border = manually edited.</p>
      <p>For draft routes — a "Schedule formula" (D+X*I) section for pasting into the game. Manually shifted trips are shown as separate lines.</p>`,
  },
  {
    id: "drafts",
    titleRu: "Пробные маршруты", titleEn: "Draft routes",
    bodyRu: `<p>«+ Создать пробный маршрут» открывает форму: название, остановки через поиск станций, время стоянки и перегона (подбираются автоматически на основе реальных данных похожих маршрутов), время отправления и интервал.</p>
      <p>Если указать <b>интервал (ЧЧ:ММ:СС)</b>, на весь день автоматически создадутся отправления с этим шагом. В карточке маршрута можно добавлять/удалять отдельные рейсы — при удалении из группы с интервалом группа корректно разбивается на 1-2 подгруппы.</p>
      <p>Кнопка «Создать пробный маршрут на основе этого» в карточке настоящего маршрута копирует все остановки и перегоны как стартовую точку.</p>`,
    bodyEn: `<p>"+ New draft route" opens a form: name, stops via station search, dwell/leg times (auto-suggested from similar real routes), departure time, and interval.</p>
      <p>If you set an <b>interval (HH:MM:SS)</b>, departures are auto-generated for the whole day at that interval. In the route card you can add/remove individual trips — removing one from an interval group correctly splits it into 1-2 sub-groups.</p>
      <p>The "Create draft route based on this" button in a real route's card copies all stops and leg times as a starting point.</p>`,
  },
  {
    id: "problems",
    titleRu: "Проблемные места", titleEn: "Problem areas",
    bodyRu: `<p>Вкладка «Проблемные места» показывает три коллапсируемые секции: конфликты по станциям, конфликты по маршрутам, и маршруты с наибольшим средним опозданием. Избранные элементы показываются первыми со значком ★.</p>
      <p>Клик по станции → переходит в «Расписание по станции». Клик по маршруту → открывает карточку маршрута.</p>`,
    bodyEn: `<p>The "Problem areas" tab shows three collapsible sections: conflicts by station, conflicts by route, and routes with the largest average delay. Favorites appear first with a ★ icon.</p>
      <p>Clicking a station → opens Station schedule. Clicking a route → opens its route card.</p>`,
  },
  {
    id: "notifications",
    titleRu: "Уведомления", titleEn: "Notifications",
    bodyRu: `<p>В разделе «Настройки» можно включить браузерные уведомления о новых конфликтах платформ и/или больших опозданиях (порог в минутах задаётся отдельно). Галочка «Только избранные» ограничивает уведомления маршрутами из избранного.</p>`,
    bodyEn: `<p>In Settings you can enable browser notifications for new platform conflicts and/or large delays (threshold in minutes is configurable separately). The "Favorites only" toggle limits notifications to favorite routes.</p>`,
  },
  {
    id: "settings",
    titleRu: "Настройки и permalink", titleEn: "Settings and permalink",
    bodyRu: `<p>Язык и часовой пояс определяются автоматически, но переключаются вручную — все времена пересчитываются мгновенно. Поддерживаемые языки: RU, EN, DE, FR, PL, PT, CS.</p>
      <p>Текущая вкладка + выбранная станция/пара станций сохраняются в URL-адресе страницы (#tab=…). Вы можете скопировать ссылку из адресной строки и поделиться ей — получатель откроется сразу на нужном виде.</p>`,
    bodyEn: `<p>Language and timezone default to auto-detected values but can be switched manually — all times recalculate instantly. Supported languages: RU, EN, DE, FR, PL, PT, CS.</p>
      <p>The current tab + selected station/station pair are saved in the page URL (#tab=…). Copy the URL from the address bar and share it — the recipient will open directly to the same view.</p>`,
  },
];

function renderInstructions() {
  const container = document.getElementById("instructionsList");
  if (!container) return;
  const lang = currentLang();
  const openIds = new Set(
    Array.from(container.querySelectorAll(".instruction-item.open")).map((el) => el.dataset.id)
  );
  container.innerHTML = INSTRUCTIONS.map(
    (item) => `
    <div class="instruction-item ${openIds.has(item.id) ? "open" : ""}" data-id="${item.id}">
      <div class="instruction-header">
        <span>${escapeHtml(lang === "ru" ? item.titleRu : item.titleEn)}</span>
        <span class="chevron">▶</span>
      </div>
      <div class="instruction-body">${lang === "ru" ? item.bodyRu : item.bodyEn}</div>
    </div>`
  ).join("");
  container.querySelectorAll(".instruction-header").forEach((header) => {
    header.addEventListener("click", () => {
      header.closest(".instruction-item").classList.toggle("open");
    });
  });
}

// ============================================================
// Инициализация
// ============================================================
(async function init() {
  try { applyI18n(); } catch (e) { console.error("applyI18n failed:", e); }
  try { initSettingsUI(); } catch (e) { console.error("initSettingsUI failed:", e); }
  try { initNotifSettings(); } catch (e) { console.warn("initNotifSettings failed (non-critical):", e); }
  try { renderInstructions(); } catch (e) { console.error("renderInstructions failed:", e); }
  try {
    document.getElementById("minIntervalValue").textContent = t("minIntervalValue", { m: state.minIntervalMin });
  } catch (e) {}
  await refreshStatus();
  await loadStations();
  try { await restoreFromUrlHash(); } catch (e) { console.error("restoreFromUrlHash failed:", e); }

  setInterval(refreshStatus, 15000);
  setInterval(() => { if (state.currentStationId) loadSchedule(); }, 20000);
})();

// ============================================================
// URL-permalink: синхронизация состояния с хэшем адресной строки
// Позволяет делиться прямой ссылкой на конкретную станцию/граф
// ============================================================
function updateUrlHash() {
  const activeBtn = document.querySelector(".tab-btn.active");
  const hash = {};
  if (activeBtn) hash.tab = activeBtn.dataset.tab;
  if (hash.tab === "schedule" && state.currentStationId) hash.station = state.currentStationId;
  if (hash.tab === "graph" && state.lastGraphData) {
    hash.from = state.lastGraphData.fromStationId;
    hash.to   = state.lastGraphData.toStationId;
  }
  const encoded = Object.entries(hash)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");
  history.replaceState(null, "", encoded ? `#${encoded}` : " ");
}

function parseUrlHash() {
  const raw = location.hash.slice(1);
  if (!raw.trim()) return {};
  return Object.fromEntries(
    raw.split("&").map((pair) => {
      const eq = pair.indexOf("=");
      return [pair.slice(0, eq), decodeURIComponent(pair.slice(eq + 1))];
    })
  );
}

async function restoreFromUrlHash() {
  const h = parseUrlHash();
  if (!h.tab) return;
  // Переключаем вкладку напрямую (не через обёртку, чтобы не перезаписать хэш раньше времени)
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
  const tabBtn = document.querySelector(`.tab-btn[data-tab="${h.tab}"]`);
  const tabPanel = document.getElementById(`tab-${h.tab}`);
  if (tabBtn) tabBtn.classList.add("active");
  if (tabPanel) tabPanel.classList.add("active");

  if (h.tab === "schedule" && h.station) {
    const st = state.stations.find((s) => s.id === h.station);
    if (st) {
      scheduleAC.setSelected(st.id, st.name);
      state.currentStationId = st.id;
      renderFavoritesBar();
      updateFavoriteBtn();
      await loadSchedule();
    }
  } else if (h.tab === "graph" && h.from && h.to) {
    const from = state.stations.find((s) => s.id === h.from);
    const to   = state.stations.find((s) => s.id === h.to);
    if (from && to) {
      graphFromAC.setSelected(from.id, from.name);
      graphToAC.setSelected(to.id,   to.name);
      await buildGraph();
    }
  } else if (h.tab === "routes") {
    await loadRoutes();
  }
}

// Обновляем хэш при действиях пользователя
document.addEventListener("click", (e) => {
  if (e.target.closest(".tab-btn")) setTimeout(updateUrlHash, 50);
});


// ============================================================
// Избранное: быстрый доступ к часто используемым станциям
// ============================================================
// ============================================================
// Избранное: станции И маршруты, раздельные уведомления
// ============================================================
let favorites = JSON.parse(localStorage.getItem("mtr_favorites") || "[]");
let favoriteRoutes = JSON.parse(localStorage.getItem("mtr_favorite_routes") || "[]");

function saveFavorites() {
  localStorage.setItem("mtr_favorites", JSON.stringify(favorites));
  localStorage.setItem("mtr_favorite_routes", JSON.stringify(favoriteRoutes));
}

// ---- Станции ----
function isFavorite(stationId) {
  return favorites.some((f) => f.id === stationId);
}
function toggleFavorite(stationId) {
  if (isFavorite(stationId)) {
    favorites = favorites.filter((f) => f.id !== stationId);
  } else {
    const st = state.stations.find((s) => s.id === stationId);
    if (st) favorites.push({ id: st.id, name: st.name });
  }
  saveFavorites();
  renderFavoritesBar();
  updateFavoriteBtn();
}

// ---- Маршруты ----
function isFavoriteRoute(routeId) {
  return favoriteRoutes.some((r) => r.id === routeId);
}
function toggleFavoriteRoute(routeId) {
  if (isFavoriteRoute(routeId)) {
    favoriteRoutes = favoriteRoutes.filter((r) => r.id !== routeId);
  } else {
    const route = state.routesById.get(routeId);
    if (route) favoriteRoutes.push({ id: route.id, name: route.name, color: route.color, number: route.number });
  }
  saveFavorites();
  renderFavoritesBar();
}

function updateFavoriteBtn() {
  const btn = document.getElementById("toggleFavoriteStationBtn");
  if (!btn) return;
  const active = state.currentStationId && isFavorite(state.currentStationId);
  btn.textContent = active ? "★" : "☆";
  btn.style.color = active ? "#fbbf24" : "";
  btn.title = active ? t("removeFavorite") : t("addFavorite");
  btn.style.display = state.currentStationId ? "" : "none";
}

function renderFavoritesBar() {
  const bar = document.getElementById("favoritesBar");
  if (!bar) return;
  // В панели над расписанием показываем ТОЛЬКО станции
  if (favorites.length === 0) { bar.style.display = "none"; return; }
  bar.style.display = "flex";

  const stationChips = favorites.map((f) => {
    const active = f.id === state.currentStationId;
    return `<button class="fav-chip ${active ? "fav-active" : ""}" data-fav-id="${escapeHtml(f.id)}" title="${escapeHtml(t("favStationHint"))}">${escapeHtml(f.name)}</button>`;
  }).join("");

  bar.innerHTML =
    `<span class="fav-label">${escapeHtml(t("favoritesLabel"))}</span>` +
    stationChips +
    `<button class="fav-chip fav-clear" id="clearFavoritesBtn" title="${escapeHtml(t("clearFavorites"))}">✕</button>`;

  bar.querySelectorAll("[data-fav-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const st = state.stations.find((s) => s.id === btn.dataset.favId);
      if (!st) return;
      scheduleAC.setSelected(st.id, st.name);
      state.currentStationId = st.id;
      renderFavoritesBar();
      updateFavoriteBtn();
      loadSchedule();
      updateUrlHash();
    });
  });

  const clearBtn = document.getElementById("clearFavoritesBtn");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      favorites = [];
      saveFavorites();
      renderFavoritesBar();
      updateFavoriteBtn();
    });
  }
}

document.getElementById("toggleFavoriteStationBtn").addEventListener("click", () => {
  if (state.currentStationId) toggleFavorite(state.currentStationId);
});
// Скрываем кнопку избранного пока не выбрана станция
document.getElementById("toggleFavoriteStationBtn").style.display = "none";
renderFavoritesBar();


// ============================================================
// Виджет «Ближайший поезд» — в сайдбаре дашборда показывает
// 5 ближайших прибытий на выбранной станции в реальном времени
// ============================================================
function renderNearestTrains() {
  const section = document.getElementById("nearestTrainSection");
  const list = document.getElementById("nearestTrainList");
  if (!section || !list) return;
  const entries = state.currentDashboardEntries;
  if (!entries || entries.length === 0) { section.style.display = "none"; return; }

  const nowMs = getNowMsOfDay();
  const upcoming = entries
    .map((e) => {
      let diff = e.effArrival - nowMs;
      if (diff < -3 * 60 * 60 * 1000) diff += MS_PER_DAY;
      return { ...e, diffMs: diff };
    })
    .filter((e) => e.diffMs >= -120000) // показываем ещё 2 минуты после отправления
    .sort((a, b) => a.diffMs - b.diffMs)
    .slice(0, 10);

  if (upcoming.length === 0) { section.style.display = "none"; return; }
  section.style.display = "";

  const lang = currentLang();
  const colNum   = lang === "ru" ? "Поезд"    : "Train";
  const colTime  = lang === "ru" ? "Прибытие" : "Arrival";
  const colEta   = lang === "ru" ? "Через"    : "ETA";
  const colDelay = lang === "ru" ? "Задержка" : "Delay";

  const rows = upcoming.map((e) => {
    const minsAway = Math.round(e.diffMs / 60000);
    let etaHtml;
    if (minsAway <= 0) {
      etaHtml = `<span class="nb-now">${t("nearestNow")}</span>`;
    } else {
      etaHtml = `<span class="nb-eta">${minsAway} ${t("nearestMin")}</span>`;
    }
    const actualMs = normalizeMs(e.effArrival + e.deviationMs);
    const hasDelay = Math.abs(e.deviationMs) > 60000;
    const delayHtml = hasDelay
      ? `<span class="${e.deviationMs > 0 ? "dev-pos" : "dev-neg"}">${e.deviationMs > 0 ? "+" : ""}${Math.round(e.deviationMs / 60000)} ${t("nearestMin")}</span>`
      : `<span class="nb-ontime">●</span>`;
    // Конечная станция (последняя в маршруте из routesById)
    const route = state.routesById.get(e.routeId);
    const terminus = route?.terminus || "—";
    return `<tr class="nb-row" data-route-id="${escapeHtml(e.routeId)}">
      <td><span class="dot nb-dot" style="background:${e.color}"></span><b>${escapeHtml(e.routeNumber || e.routeName)}</b></td>
      <td class="nb-terminus">${escapeHtml(terminus)}</td>
      <td>${formatLocal(hasDelay ? actualMs : e.effArrival)}</td>
      <td>${etaHtml}</td>
      <td>${delayHtml}</td>
    </tr>`;
  }).join("");

  list.innerHTML = `<thead><tr class="nb-head">
    <th>${colNum}</th><th>${lang === "ru" ? "Конечная" : "Terminus"}</th>
    <th>${colTime}</th><th>${colEta}</th><th>${colDelay}</th>
  </tr></thead><tbody>${rows}</tbody>`;

  list.querySelectorAll("tr[data-route-id]").forEach((row) => {
    row.addEventListener("click", () => openRouteModal(row.dataset.routeId));
  });
}

setInterval(renderNearestTrains, 30000);




// ============================================================
// Контекстное меню на блоке поезда (правая кнопка мыши)
// ============================================================
(function setupContextMenu() {
  const menu = document.createElement("div");
  menu.id = "trainContextMenu";
  menu.className = "ctx-menu";
  menu.style.display = "none";
  document.body.appendChild(menu);

  let ctxEntry = null;

  function hideMenu() { menu.style.display = "none"; ctxEntry = null; }
  function isVisible() { return menu.style.display !== "none"; }

  // Закрываем меню только на ЛЕВЫЙ клик вне меню, и по Escape
  document.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return; // игнорируем правую/среднюю кнопку
    if (!menu.contains(e.target)) hideMenu();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") hideMenu(); });

  document.addEventListener("contextmenu", (e) => {
    const block = e.target.closest(".entry-block[data-eidx]");
    if (!block) {
      // Скрываем меню если ПКМ не по блоку
      if (isVisible()) hideMenu();
      return;
    }
    e.preventDefault();
    e.stopPropagation();

    const idx = Number(block.dataset.eidx);
    const entries = state.currentDashboardEntries;
    if (!entries || !entries[idx]) return;
    ctxEntry = entries[idx];

    const isFav = isFavoriteRoute(ctxEntry.routeId);
    const conflicts = state.conflictDetails.get(ctxEntry.entryKey) || [];
    const copyLabel = currentLang() === "ru" ? "Скопировать сдвиг" : "Copy time shift";

    const items = [
      { label: `<b>${escapeHtml(ctxEntry.routeNumber ? `${ctxEntry.routeNumber} — ${ctxEntry.routeName}` : ctxEntry.routeName)}</b>`, header: true },
      { divider: true },
      { label: `${isFav ? "★ " + t("removeFavorite") : "☆ " + t("addFavorite")}`, action: "toggleFav" },
      { label: `ⓘ  ${t("ctxRouteInfo")}`, action: "openCard" },
      { label: `📋  ${copyLabel}`, action: "copyShift" },
    ];

    if (conflicts.length) {
      items.push({ divider: true });
      items.push({ label: `⚠ ${t("conflictLabel")}`, header: true });
      for (const other of conflicts) {
        const minIntervalMs = state.minIntervalMin * 60000;
        const gap = ctxEntry.effArrival - other.effArrival;
        const shiftMs = gap >= 0 ? (minIntervalMs - gap) : -(minIntervalMs + gap);
        const shiftMin = Math.ceil(Math.abs(shiftMs) / 60000);
        const dir = shiftMs > 0 ? "+" : "−";
        items.push({
          label: `↕  ${escapeHtml(t("conflictSuggestShift", { name: ctxEntry.routeNumber || ctxEntry.routeName, mins: `${dir}${shiftMin}` }))}`,
          action: "fixConflict",
          shiftMs,
        });
      }
    }

    menu.innerHTML = items.map((item) => {
      if (item.divider) return `<div class="ctx-divider"></div>`;
      if (item.header) return `<div class="ctx-item ctx-header">${item.label}</div>`;
      return `<div class="ctx-item" data-action="${item.action || ""}" data-shift="${item.shiftMs || 0}">${item.label}</div>`;
    }).join("");

    menu.querySelectorAll(".ctx-item[data-action]").forEach((el) => {
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const saved = ctxEntry;
        hideMenu();
        if (!saved) return;
        const action = el.dataset.action;
        if (action === "toggleFav") { toggleFavoriteRoute(saved.routeId); applyRouteFilters(); }
        else if (action === "openCard") openRouteModal(saved.routeId);
        else if (action === "copyShift") {
          state.lastCopiedRouteId = saved.routeId;
          try { clipboardRouteId = saved.routeId; clipboardDeltaMs = getRouteOverride(saved.routeId); } catch {}
        }
        else if (action === "fixConflict") {
          const delta = Number(el.dataset.shift);
          pushUndoSnapshot();
          setOverride(saved.routeId, saved.tripOriginMs,
            (getOverride(saved.routeId, saved.tripOriginMs) || 0) + delta);
          renderDashboardFromCache();
          renderGraphFromCache();
        }
      });
    });

    const x = Math.min(e.clientX + 2, window.innerWidth - 240);
    menu.style.left = x + "px";
    menu.style.top = e.clientY + "px";
    menu.style.display = "block";
    requestAnimationFrame(() => {
      const rect = menu.getBoundingClientRect();
      if (rect.bottom > window.innerHeight - 4)
        menu.style.top = Math.max(4, e.clientY - rect.height) + "px";
    });
  });
})();

