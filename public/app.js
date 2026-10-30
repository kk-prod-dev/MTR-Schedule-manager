const MS_PER_DAY = 86400000;

// ============================================================
// Журнал диагностики: кольцевой буфер последних логов/ошибок для
// отчёта баг-репорта (кнопка в настройках). Ставим В САМОМ НАЧАЛЕ, до
// остального кода, чтобы поймать ошибки инициализации.
// ============================================================
const _diagLog = [];
const _DIAG_LOG_MAX = 300;
function _pushDiag(level, args) {
  try {
    const msg = Array.from(args).map((a) => {
      if (a instanceof Error) return (a.stack || a.message || String(a));
      if (typeof a === "object") { try { return JSON.stringify(a); } catch { return String(a); } }
      return String(a);
    }).join(" ");
    _diagLog.push(`${new Date().toISOString()} [${level}] ${msg.slice(0, 1000)}`);
    if (_diagLog.length > _DIAG_LOG_MAX) _diagLog.shift();
  } catch (e) { /* журнал не должен ничего ломать */ }
}
["error", "warn"].forEach((lvl) => {
  const orig = console[lvl] ? console[lvl].bind(console) : function () {};
  console[lvl] = function (...a) { _pushDiag(lvl, a); orig(...a); };
});
window.addEventListener("error", (e) => {
  _pushDiag("uncaught", [`${e.message} @ ${e.filename}:${e.lineno}:${e.colno}`, e.error]);
});
window.addEventListener("unhandledrejection", (e) => {
  _pushDiag("promise", [e.reason]);
});

// ============================================================
// Локализация
// ============================================================
const I18N = {
  ru: {
    appTitle: "MTR Schedule Manager",
    statusConnecting: "Подключение...",
    statusCached: "Нет связи с сервером MTR (показаны кешированные данные: {st} ст., {rt} маршр.)",
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
    routesFilterLabel: "Маршруты",
    ctxHighlightChain: "Подсветить цепочку оборота",
    chainHighlightHint: "Esc — снять подсветку цепочки",
    gcStationProblem: "{r1} ({t1}) и {r2} ({t2}) на одной платформе, интервал {gap} мин",
    gcStationSolution: "Развести не меньше чем на {need} мин",
    gcOvertakeProblem: "{r1} обгоняет {r2} на перегоне (≈{tm}) — задний упрётся в хвост переднему",
    gcOvertakeSolution: "Увеличить интервал между поездами на перегоне",
    gcOvertakeLabel: "Обгон на перегоне",
    gcProblemLabel: "Проблема",
    gcSolutionLabel: "Решение",
    problemsTitleDelayed: "Опаздывают сейчас",
    problemsFixConflict: "Устранить сдвигом",
    problemsFixDone: "Сдвинуто рейсов: {n}",
    problemsFixNone: "Нечего сдвигать",
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
    showPartialLabel: "Показывать маршруты-соседи",
    showConflictsLabel: "Показывать конфликты",
    graphConflictsHint: "Красные точки конфликтов и обгонов на графике",
    graphTypesFilterLabel: "Типы поездов",
    graphPartialHint: "Маршруты, которые едут только по части выбранного участка",
    graphPartialShort: "участок",
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
    errRouteNotFound: "Маршрут с таким id не найден.",
    errStationNotFound: "Станция с таким id не найдена.",
    errDataNotReady: "Данные ещё не получены от сервера MTR, подождите немного.",
    errDraftNotFound: "Пробный маршрут не найден.",
    errStationsNotFound: "Одна из станций не найдена.",
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
    checkUpdateBtn: "Проверить обновления",
    supportBtn: "Поддержка",
    updatesSectionLabel: "Обновления",
    betaUpdatesLabel: "Получать бета-версии",
    diagSectionLabel: "Диагностика",
    diagReportBtn: "Отчёт для баг-репорта",
    diagReportHint: "Сохранит текстовый файл с версией, статусом сервера, настройками и последними ошибками — приложите его к сообщению об ошибке. Паролей и личных данных в файле нет.",
    diagReportSaved: "Отчёт сохранён: {path}",
    diagReportError: "Не удалось сохранить отчёт",
    betaUpdatesHint: "Приложение будет обновляться на пре-релизы — новые функции раньше всех, но возможны ошибки. Выключите, чтобы вернуться к стабильным версиям (обновление придёт, когда стабильная станет новее беты).",
    interfaceSectionLabel: "Интерфейс",
    experimentalUiLabel: "Экспериментальный интерфейс",
    experimentalUiHint: "Новый вид приложения: боковое меню, тёмная палитра и шрифты нового логотипа. Логика и данные те же — выключите, чтобы вернуть классический вид.",
    routeMarkersLabel: "Метки маршрутов",
    routeMarkersHint: "Как отмечать маршруты каждого типа в списках, карточках и табло: форма метки и что внутри.",
    routeMarkerShape: "Форма",
    routeMarkerContent: "Внутри",
    rmShape_circle: "Круг",
    rmShape_parallelogram: "Параллелограмм",
    rmShape_plaque: "Плашка",
    rmShape_capsule: "Капсула",
    rmShape_square: "Квадрат",
    rmShape_diamond: "Ромб",
    rmShape_hexagon: "Шестиугольник",
    rmShape_triangle: "Треугольник",
    rmContent_none: "Пусто",
    rmContent_number: "Номер маршрута",
    rmContent_icon_train: "Значок: поезд",
    rmContent_icon_metro: "Значок: метро",
    rmContent_icon_tram: "Значок: трамвай",
    rmContent_icon_bus: "Значок: автобус",
    rmContent_icon_cable: "Значок: канатная дорога",
    rmContent_icon_ship: "Значок: судно",
    rmContent_icon_plane: "Значок: самолёт",
    rmContent_icon_fast: "Значок: скоростной",
    rtype_train_normal: "Поезд",
    rtype_train_light_rail: "Лёгкое метро",
    rtype_train_high_speed: "Скоростной поезд",
    rtype_train_metro: "Метро",
    rtype_train_tram: "Трамвай",
    rtype_train_bus: "Автобус",
    rtype_train_sbahn: "S-Bahn",
    rtype_train_intercity: "InterCity",
    rtype_train_regional: "Regional",
    rtype_cable_car_normal: "Канатная дорога",
    rtype_boat_normal: "Судно",
    rtype_boat_light_rail: "Паром",
    rtype_boat_high_speed: "Скоростное судно",
    rtype_airplane_normal: "Самолёт",
    nextGroupSchedules: "Расписания",
    nextNavSchedule: "Табло станции",
    nextNavRoutes: "Станции и маршруты",
    nextNavProblems: "Задержки и проблемы",
    nextNavHelp: "Справка",
    nextStatusOnline: "MTR онлайн",
    nextStatusCached: "MTR недоступен · данные из кэша",
    nextStatusOffline: "Нет связи с MTR",
    nextHome: "Главная",
    nextProblemsLead: "Где сеть буксует прямо сейчас и что накопилось за период",
    nextSettingsLead: "Изменения сохраняются сразу",
    nextFilters: "Фильтры",
    nextCollapse: "Свернуть / развернуть",
    nextClose: "Закрыть",
    nextDragHint: "Тяните блок поезда, чтобы сдвинуть рейс. Shift — весь маршрут, Ctrl+клик — цепочка оборота.",
    nextDay: "Сутки",
    nextHours: "{n} ч",
    nextNow: "Сейчас",
    nextLgConflict: "конфликт",
    nextLgLate: "опоздание",
    nextLgEdited: "сдвинут вручную",
    nextLgEarly: "раньше графика",
    nxcOnLine: "в движении · {n}",
    nxcEdits: "правок: {n}",
    nxcGraph: "График движения",
    nxcCopyDraft: "Копия как пробный",
    nxcTabTimetable: "Расписание",
    nxcTabStops: "Остановки",
    nxcTabLive: "Сейчас на линии",
    nxcTabConflicts: "Конфликты",
    nxcTrains: "поездов: {n}",
    nxcConsist: "Состав",
    nxcCars: "{n} ваг.",
    nxcPassport: "Паспорт",
    nxcStopsN: "Остановок",
    nxcCarsLabel: "Вагонов в составе",
    nxcColTrip: "Рейс",
    nxcColWhere: "Где сейчас",
    nxcColNext: "Следующая",
    nxcColArrival: "Прибытие",
    nxcNoTrains: "Сейчас поездов на линии нет",
    nxcTtHint: "Плановое время; в скобках — живое отклонение там, куда поезд ещё не доехал. Клик по ячейке — табло станции.",
    nxcNow: "Сейчас",
    nxcLgCurrent: "текущий рейс",
    nxcLgPassed: "серым — станции, которые поезд уже прошёл",
    nxcShiftBy: "Сдвинуть на {n} мин",
    nxcWith: "с {r}",
    nextLgDraft: "пробный",
    nextConflicts: "Конфликты",
    nextResolveAll: "Решить все",
    nextTurnLinks: "Связки оборота",
    nextTrip: "Рейс",
    nextScopeAll: "Вся сеть",
    nextScopeFav: "Избранное",
    nextRescan: "Пересчитать",
    nextLgStationConflict: "конфликт на станции",
    nextLgLineLate: "линия опаздывает",
    nextNavBoards: "Генераторы табло",
    nextSortSamples: "Больше замеров сначала",
    nextNewDraft: "+ Пробный маршрут",
    nextBuild: "Построить",
    nextChipConflicts: "{n} конфл.",
    nextChipLate: "{n} опаздывают",
    nextChipDrafts: "{n} пробный",
    nextLocalTime: "Время локальное, {tz}",
    nextNoConflicts: "Конфликтов нет",
    nextOverlap: "перекрытие",
    nextGap: "интервал {gap}",
    nextPlatformN: "платформа {p}",
    nextConflictText: "{r1} и {r2} ближе {min} мин друг к другу",
    nextShiftBy: "Сдвинуть {r} на +{n} мин",
    nextShow: "Показать",
    nextAfter: "после {time}",
    nextGraphLead: "{s} станций · {r} маршрутов на участке",
    nextGraphChip: "{c} конфл. · {o} обгон.",
    nextTripGone: "Рейс скрыт фильтрами или пропал после перестройки графика",
    nextTripHint: "Нажмите на линию поезда, чтобы увидеть рейс: остановки, время в пути и конфликты.",
    nextShiftShort: "{r} {n} мин",
    nextShiftTrip: "Рейс {n} мин",
    nextConflictAtStation: "Конфликт на станции",
    nextOvertake: "Обгон",
    nextDepShort: "отпр. {t}",
    nextTravel: "{n} мин в пути",
    nextRouteCard: "Карточка маршрута",
    nextChain: "Цепочка оборота",
    nextTripConflicts: "Конфликты рейса",
    nextRoutesLead: "Всё, что есть на сервере: {s} станций, {r} маршрутов, {d} пробных",
    nextColConflicts: "Конфл.",
    nextDraftRoutes: "Пробные маршруты",
    nextOtherRoutes: "Другие",
    nextConflictsN: "{n} конфл.",
    nextDepot: "депо «{d}»",
    nextKpiInterval: "Интервал",
    nextKpiTravel: "В пути",
    nextKpiTrips: "Рейсов / сутки",
    nextKpiAvgDev: "Ср. отклонение",
    nextRouteConflicts: "Конфликты маршрута",
    nextOpen: "Открыть",
    nextKpiConflictsNow: "Конфликтов сейчас",
    nextKpiOnStations: "на {n} станциях",
    nextKpiLateNow: "Опаздывают сейчас",
    nextKpiLateNote: "пар маршрутов",
    nextKpiNetAvg: "Среднее опоздание сети",
    nextKpiSamples: "{n} замеров",
    nextKpiOnTime: "Идёт по графику",
    nextKpiOnTimeNote: "замеров у маршрутов<br>со средним в ±1 мин",
    nextOnTime: "по графику",
    nextMinInterval: "Мин. интервал",
    nextStationRoutes: "{n} маршрутов",
    nextColRoutes: "Маршрутов",
    nextStationsGroup: "Станции и остановки",
    nextStationsWithConflicts: "{n} с конфликтами",
    nextPsStations: "Станции с конфликтами",
    nextPsRoutes: "Маршруты с конфликтами",
    nextPsLateNow: "Сейчас опаздывают",
    nextPsAvg: "Среднее опоздание",
    liveDotHint: "Автообновление активно",
    swapStationsHint: "Поменять местами А и Б",
    boardHourGapTitle: "% высоты строки",
    serverListLabel: "Серверы MTR",
    serverUrlLabel: "URL сервера MTR",
    serverUrlHint: "Адрес карты системы MTR-сервера. Например: http://localhost:8888",
    serverUrlSaved: "URL сохранён, данные перезагружаются...",
    serverUrlError: "Ошибка сохранения URL",
    serverTzLabel: "Часовой пояс сервера MTR",
    serverTzHint: "Если времена поездов отображаются со сдвигом — выберите часовой пояс сервера.",
    favStationHint: "Избранная станция — кликни для быстрого перехода",
    favMissingHint: "Этой станции нет на текущем сервере — уберите её крестиком",
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
    ctxResetTrip: "↩ Сбросить правки этого рейса",
    ctxResetRoute: "↩ Сбросить правки маршрута",
    notifPermissionDenied: "Уведомления заблокированы в вашем браузере. Разрешите их в настройках браузера.",
    notifSettingsTitle: "Уведомления",
    notifConflict: "Уведомлять о новых конфликтах платформ",
    notifDelay: "Уведомлять о новых опозданиях",
    notifDelayThresholdLabel: "Порог опоздания",
    notifSectionLabel: "Уведомления",
    notifCooldownLabel: "Пауза между уведомлениями",
    notifConflictTitle: "Конфликты на платформах",
    notifConflictBodyOne: "Обнаружен конфликт на станции «{station}». Откройте вкладку «Проблемные места».",
    notifConflictBodyMany: "Найдено конфликтов на {count} станциях. Откройте вкладку «Проблемные места».",
    notifDelayTitle: "Опоздание",
    notifDelayBody: "Маршрут {route} опаздывает на {min} мин.",
    notifDelayBodyMany: "Опаздывают маршрутов: {count}. Наибольшее опоздание — {route} ({min} мин).",
    problemsStationsWord: "ст.",
    notifPermissionDenied: "Система или браузер запретили уведомления для приложения — разрешите их в настройках ОС.",
    problemsScanStart: "Анализ сети…",
    problemsScanProgress: "Анализ сети: просмотрено {done}/{total} станций…",
    notifBigDelay: "Уведомлять о больших опозданиях (>5 мин)",
    notifThreshold: "Порог опоздания (мин)",
    'instr_title_schedule-basics': 'Расписание по станции',
    'instr_body_schedule-basics': '<p>Начните вводить название станции — выберите из подсказок. Дашборд: платформы по вертикали, время UTC 00:00–24:00 по горизонтали. Блок поезда: название маршрута и время прибытия; ! = конфликт; треугольник = live-задержка. Клик на блок — карточка рейса, клик на название маршрута — карточка маршрута.</p>',
    'instr_title_drag-edit': 'Ручное редактирование (перетаскивание)',
    'instr_body_drag-edit': '<p>Перетащите блок поезда (на дашборде) или линию поезда (на графике движения) по горизонтали — время сдвинется, рейс станет пунктирным.</p><p><code>Shift</code> + перетаскивание — сдвигает <b>все</b> рейсы маршрута сразу. <code>Alt</code> + вертикальное перетаскивание (≥ полная высота строки) — переносит поезд на другую платформу.</p><p><code>Ctrl+Z</code> — отменить, <code>Ctrl+Y</code> — вернуть.</p><p>Кнопка «Сбросить ручные правки» в сайдбаре — сбрасывает все сдвиги. В карточке маршрута — «Сбросить правки этого маршрута» (появляется только при наличии изменений).</p>',
    'instr_title_favorites': 'Избранное',
    'instr_body_favorites': '<p><b>Станции</b> — кнопка ☆ рядом с полем поиска. <b>Маршруты</b> — кнопка ☆ в карточке маршрута или в строке таблицы маршрутов.</p><p>Панель быстрого доступа появляется снизу: клик по станции открывает расписание, клик по маршруту — карточку.</p><p>В таблице маршрутов кнопка ☆ в панели управления оставляет только избранные. Уведомления тоже можно ограничить только избранными (см. Настройки).</p>',
    'instr_title_filters-zoom': 'Фильтры и масштаб',
    'instr_body_filters-zoom': '<p>Сайдбар: фильтр платформ, слайдер минимального интервала конфликта, источник (реальные/черновики), фильтр избранных. Zoom: +/− или Ctrl+колесо над графиком.</p><p>Конфликт = два поезда на одной платформе с интервалом меньше заданного. Оборотные пары одного маршрута конфликтами не считаются.</p>',
    'instr_title_train-graph': 'График движения поездов',
    'instr_body_train-graph': '<p>Выберите станцию А и Б — граф: станции по вертикали (в порядке маршрута), время UTC 00:00–24:00 горизонтально. Наклон = скорость. «Обратные рейсы» добавляет рейсы в обратном направлении. Фильтр станций скрывает промежуточные. Ctrl+колесо или +/− для масштаба. Клик на линию — карточка маршрута.</p>',
    'instr_title_route-card': 'Карточка маршрута',
    'instr_body_route-card': '<p>Клик по маршруту открывает карточку: метаданные, схема состава поезда (по live-данным), список остановок с координатами (⧉ копирует), таблица расписания UTC 00:00–24:00 (! = конфликт, пунктир = ручная правка). ☆ — в избранное, «Действия» — создать черновик, удалить рейс. При редактировании появляется «Формула расписания».</p>',
    'instr_title_drafts': 'Пробные маршруты',
    'instr_body_drafts': '<p>«+ Создать пробный маршрут» открывает форму: название, остановки через поиск станций, время стоянки и перегона (подбираются автоматически), время отправления и интервал.</p><p>Если указать <b>интервал (ЧЧ:ММ:СС)</b>, на весь день автоматически создадутся отправления с этим шагом. В карточке маршрута можно добавлять/удалять отдельные рейсы.</p><p>Кнопка «Создать пробный маршрут на основе этого» в карточке настоящего маршрута копирует все остановки и перегоны.</p>',
    'instr_title_problems': 'Проблемные места',
    'instr_body_problems': '<p>Вкладка «Проблемные места»: конфликты по станциям, маршрутам и черновики. Данные накапливаются при просмотре станций. Клик — открывает станцию или карточку маршрута.</p>',
    'instr_title_schedule_formula': 'Формула расписания',
    'instr_body_schedule_formula': '<p>При редактировании маршрута в карточке появляется блок «Формула расписания». Он показывает паттерн отправлений на основе ваших ручных правок: интервал между рейсами и смещение первого рейса от полуночи UTC.</p><p>Формула автоматически обновляется при каждом изменении расписания и помогает убедиться что правки образуют равномерный интервал. Скопируйте формулу кнопкой ⧉ чтобы передать расписание другому игроку.</p>',
    'instr_title_settings': 'Настройки',
    'instr_body_settings': '<p>Язык и часовой пояс определяются автоматически. Языки: RU, EN, DE, FR, PL, PT, CS.</p><p><b>Серверы MTR</b> — список серверов; выберите активный из выпадающего, + добавляет URL, − удаляет; при смене данные перезагружаются; localhost:8888 доступен всегда.</p><p><b>Часовой пояс</b> — только на время поездов; таблицы и графики всегда UTC 00:00–24:00.</p><p>Настройки сохраняются автоматически. Внизу — версия и кнопка обновлений.</p>',
    instr_title_notifications: "Уведомления",
    instr_body_notifications: "<p>В настройках можно включить уведомления браузера о новых конфликтах на платформах и/или больших опозданиях (порог в минутах настраивается). Переключатель «Только избранное» ограничивает уведомления избранными маршрутами.</p>",
    'instr_title_board-editor': 'Редактор (бумажное расписание)',
    'instr_body_board-editor': '<p>Вкладка <b>Редактор</b> — холст для вёрстки бумажного расписания станции (Aushangfahrplan): свободно расставляйте элементы, а живое расписание вставляйте кнопкой.</p><p><b>Вставка</b> — отдельные кнопки со значками: текст, квадрат, круг, треугольник, линия, картинка, схема станции. Каждый объект добавляется на холст и редактируется вручную.</p><p><b>Объект</b> — цвет, выравнивание, порядок слоёв, группировка (<code>Ctrl+G</code>), дублирование (<code>Ctrl+D</code>), удаление, цвет и толщина границы, а также выпадающий список <b>видов линии</b> — сплошная, пунктир, точки, штрих-пунктир, волнистая, зигзаг — с наглядными рисунками-примерами прямо в списке.</p><p>Объекты можно вращать за угловой маркер; с зажатым <code>Shift</code> поворот идёт шагом 45°.</p><p><b>Текст</b> — комбобокс шрифтов с поиском и избранным (★), кнопка «Шрифты с ПК», размер, жирность, выравнивание.</p><p>Нижняя панель: <b>Столбцы</b> (прибытие, отправление, линия, цвет маршрута, направление, платформа) → «Вставить столбцы»; <b>Фильтры</b>; число секций; шрифт расписания; «Холст под расписание»; пробел между часами; язык холста; поиск станции → «Вставить расписание станции».</p><p>Готовый холст можно сохранить в PNG, скопировать в буфер, сохранить как пресет или обменяться кодом (Экспорт/Импорт). Масштаб — <code>Ctrl</code>+колесо или кнопки +/−.</p>',
    tabBoard: "Редактор",
    boardHint: "Редактор-холст для оформления бумажного расписания станции: свободно расставляйте текст, фигуры и картинки, а расписание вставляйте кнопкой ниже — редактировать вручную можно всё.",
    boardPageA4P: "A4 портрет",
    boardPageA4L: "A4 альбом",
    boardPageCustom: "Свой размер",
    boardAddText: "+ Текст",
    boardAddRect: "+ Прямоугольник",
    boardAddShape: "+ Фигура",
    boardShapeSquare: "Квадрат",
    boardShapeCircle: "Круг",
    boardShapeTriangle: "Треугольник",
    boardShapeTypeTitle: "Тип фигуры",
    boardInsertSchemeBtn: "+ Схема станции",
    boardSchemeInserted: "Схема станции «{name}» добавлена.",
    boardSchemeError: "Не удалось построить схему",
    boardAddLine: "+ Линия",
    boardAddImage: "+ Картинка",
    boardBringFront: "На передний план",
    boardSendBack: "На задний план",
    boardGroup: "Сгруппировать",
    boardUngroup: "Разгруппировать",
    boardObjAlignLeft: "Выровнять по левому краю",
    boardObjAlignCenterH: "Выровнять по центру (по горизонтали)",
    boardObjAlignRight: "Выровнять по правому краю",
    boardObjAlignTop: "Выровнять по верхнему краю",
    boardObjAlignMiddleV: "Выровнять по центру (по вертикали)",
    boardObjAlignBottom: "Выровнять по нижнему краю",
    boardDuplicate: "Дублировать",
    boardCut: "Вырезать",
    boardCopy: "Копировать",
    boardPaste: "Вставить",
    boardDelete: "Удалить",
    boardClearBtn: "Очистить холст",
    boardInsertScheduleBtn: "Вставить расписание станции",
    boardExportPngBtn: "Экспорт PNG",
    boardCopyClipboardBtn: "Скопировать в буфер",
    boardPresetNamePlaceholder: "Название пресета",
    boardPresetSaveBtn: "Сохранить пресет",
    boardPresetLoadBtn: "Загрузить",
    boardShareExportBtn: "Код для шаринга",
    boardShareImportBtn: "Импорт кода",
    boardDefaultText: "Текст",
    boardColTime: "Время",
    boardColLine: "Линия",
    boardColDest: "Направление",
    boardColPlatform: "Платформа",
    boardColArrival: "Прибытие",
    boardColDeparture: "Отправление",
    boardColRouteColor: "Квадрат с цветом маршрута",
    boardColumnsBtn: "Столбцы",
    boardInsertColumnsBtn: "Вставить столбцы",
    boardFiltersBtn: "Фильтры",
    boardFilterPlatforms: "Платформы",
    boardFilterTypes: "Типы поездов",
    boardFilterRoutes: "Маршруты",
    boardFilterAll: "все",
    boardFilterEmpty: "Сначала выберите станцию — фильтры строятся по её рейсам.",
    boardSectionsLabel: "Секции",
    boardSectionsAuto: "авто",
    boardNoColumnsSelected: "Выберите хотя бы один столбец.",
    boardColumnsInserted: "Заголовки столбцов вставлены — теперь вставьте расписание станции.",
    boardFilteredOutAll: "Все рейсы скрыты фильтрами — ослабьте фильтры.",
    boardTableFontLabel: "Шрифт расписания",
    boardAutoSizeLabel: "Холст под расписание",
    boardFitCanvasBtn: "Лист под таблицу",
    boardFitCanvasHint: "Подогнать размер листа под таблицу (разово)",
    boardHourGapLabel: "Пробел между часами",
    boardCanvasLangLabel: "Язык холста",
    boardCanvasLangAuto: "как интерфейс",
    boardModeTimetable: "Табло",
    boardModeScheme: "Схема сети",
    schemeHint: "Схема сети: «Построить из MTR» раскладывает выбранные линии по реальным координатам станций; повторное построение сохраняет ваши ручные правки и добавляет новое из MTR.",
    schemeAlignLabel: "Выравнивание",
    schemeAlignOff: "выкл",
    schemeAlignTitle: "Перегоны, отклонённые от 0/45/90° не больше чем на этот угол, выравниваются при построении. Уже стоящие станции не двигаются — чтобы перестроить схему целиком, начните с пустой.",
    schemePropNode: "Точка излома",
    schemeNodeHint: "Общая точка {n} лин. Тяните её, чтобы изменить трассу; Delete удаляет излом.",
    schemeTypesBtn: "Типы маршрутов",
    schemeGenerateBtn: "Построить из MTR",
    schemeFitBtn: "Вписать в экран",
    schemeResetBtn: "Новая пустая схема",
    schemeLiveLabel: "Живые данные",
    schemeLiveTitle: "Конфликты на станциях и опоздания линий прямо на схеме",
    schemeExportPng: "Экспорт PNG",
    schemeExportSvg: "Экспорт SVG",
    schemePublishBtn: "Поделиться",
    schemeToolSelect: "Выбор и перемещение",
    schemeToolLine: "Нарисовать линию",
    schemeToolStation: "Поставить станцию",
    schemeToolTransfer: "Пересадка между станциями",
    schemeToolHint_select: "Тяните станции и точки на углах · рамка по пустому месту выделяет группу (Shift — добавить) · двойной клик: по линии — новая точка, по подписи — переименовать, по станции — её расписание · F2 — переименовать · колесо — масштаб, пробел/правая кнопка — сдвиг",
    schemeToolHint_line: "Кликайте точки линии (углы по 45°, прилипает к станциям) · Enter или двойной клик — готово · Esc — отмена",
    schemeToolHint_station: "Клик по линии — станция на ней, клик в пустоте — отдельная станция",
    schemeToolHint_transfer: "Кликните две станции, чтобы связать их пересадкой",
    schemeGenerating: "Строим схему из данных MTR…",
    schemeGenerated: "Схема построена: линий {lines}, станций {stations}, пересадок {transfers}. Отменить — Ctrl+Z.",
    schemeUpdated: "Схема обновлена из MTR: линий {lines}, новых станций {newStations}, удалено линий {removedLines}. Ручные правки сохранены.",
    schemeNoTypes: "Выберите хотя бы один тип маршрутов.",
    schemeGenerateError: "Не удалось построить схему",
    schemeExportError: "Не удалось экспортировать схему",
    schemeResetConfirm: "Удалить текущую схему и начать с пустой? Отменить можно через Ctrl+Z.",
    schemeLiveStatus: "Живые данные: станций с конфликтами {c}, опаздывающих маршрутов {d}.",
    schemeLiveError: "Не удалось получить живые данные",
    schemePublishTitle: "Поделиться схемой",
    schemePublishHint: "Один файл со всей схемой: открывается в любом браузере, в том числе на телефоне, без интернета и без приложения. Отправьте его кому угодно или выложите на любой хостинг. После правок сохраните файл заново.",
    schemePublishOpen: "Открыть в браузере",
    schemePublishEmpty: "Схема пуста — делиться нечем.",
    schemeHtmlTitle: "HTML-файл",
    schemeHtmlSave: "Сохранить HTML-файл",
    schemeHtmlSaved: "Файл сохранён ({kb} КБ).",
    schemeBrowserTitle: "В браузере",
    schemeBrowserHint: "Открывает схему в системном браузере. Пока приложение запущено, вкладка обновляется сама после каждой правки.",
    schemeBrowserOpened: "Схема открыта в браузере — правки появятся там автоматически.",
    schemeNewStation: "Станция {n}",
    schemeNewLine: "Линия {n}",
    schemePropStation: "Станция",
    schemePropLine: "Линия",
    schemePropTransfer: "Пересадка",
    schemePropScheme: "Схема",
    schemePropLegend: "Легенда",
    schemeFieldName: "Название",
    schemeFieldSub: "Второй язык / подпись",
    schemeFieldStationStyle: "Значок",
    schemeFieldLabelPos: "Положение подписи",
    schemeFieldLabelAngle: "Наклон подписи",
    schemeFieldNumber: "Номер",
    schemeFieldColor: "Цвет",
    schemeFieldWidth: "Толщина (пусто — как у схемы)",
    schemeFieldDash: "Вид линии",
    schemeFieldOffset: "Сдвиг в пучке",
    schemeFieldTitle: "Заголовок схемы",
    schemeFieldLineWidth: "Толщина линий",
    schemeFieldLabelSize: "Размер подписей",
    schemeFieldBg: "Фон",
    schemeFieldLabelColor: "Цвет подписей",
    schemeFieldShowLegend: "Показывать легенду",
    schemeFieldLegendTitle: "Заголовок легенды",
    schemeStats: "Линий {lines}, станций {stations}, пересадок {transfers}.",
    schemeStStyle_auto: "Авто",
    schemeStStyle_tick: "Засечка",
    schemeStStyle_circle: "Кружок",
    schemeStStyle_pill: "Пересадочная",
    schemeNewText: "Текст",
    schemeAskText: "Текст надписи",
    schemeAskOk: "OK",
    schemeAskCancel: "Отмена",
    schemeAskStation: "Название станции",
    schemeAskLine: "Название линии",
    schemeStyleCopied: "Стиль скопирован — выберите другой объект и нажмите «Вставить стиль»",
    schemeStyleNoTarget: "Нечего менять: выберите объект того же типа",
    schemeStylePasted: "Стиль применён: {n}",
    schemeReset: "Сбросить на стандартный",
    schemeNone: "Нет",
    schemeAlign_start: "Слева",
    schemeAlign_middle: "По центру",
    schemeAlign_end: "Справа",
    schemeLayer_back: "Под линиями",
    schemeLayer_front: "Над линиями",
    schemeListLines: "Линии (названия)",
    schemeSelectLine: "Выделить линию",
    schemeListStations: "Станции (названия)",
    schemeSearchStations: "Найти станцию…",
    schemeFindStation: "Показать на схеме",
    schemeGroupInfo: "Станции: {s}, фигуры: {f}, углы: {n}",
    schemeGroupHint: "Тяните любую выделенную станцию — сдвинется вся группа. Shift+клик добавляет/убирает объект.",
    schemePassInfo: "Линий проходит без остановки: {n}",
    schemeDefaultName: "Схема {n}",
    schemeAskNewScheme: "Название новой схемы",
    schemeAskRenameScheme: "Название схемы",
    schemeDeleteConfirm: "Удалить схему «{name}»? Это нельзя отменить.",
    schemeSwitchTitle: "Несколько схем: метро, трамваи, вся сеть…",
    schemeSwitchLabel: "Схема",
    schemeNewTitle: "Добавить схему",
    schemeRenameTitle: "Переименовать схему",
    schemeDupTitle: "Дублировать схему",
    schemeDelTitle: "Удалить схему",
    schemeCompressTitle: "Длинные перегоны без станций (между городами) сокращаются до этого числа клеток — действует на новые станции при построении",
    schemeCompressLabel: "Сжатие пустот",
    schemeMinGapLabel: "Мин. расстояние",
    schemeFieldMapScale: "Масштаб схемы",
    schemeMapScaleDown: "Сжать схему относительно центра (линии и подписи прежнего размера)",
    schemeMapScaleUp: "Раздвинуть схему относительно центра (линии и подписи прежнего размера)",
    schemeMapScaleLimit: "Сжать нельзя: не все станции и узлы лежат на чётных клетках сетки (масштаб — ×2 / ÷2, чтобы всё осталось по сетке и диагонали не ломались)",
    schemeLabelReset: "Вернуть подпись на место",
    schemeBadgeReset: "Вернуть номера на место",
    schemeFieldBadgeShow: "Номера маршрутов",
    schemeMinGapAuto: "авто",
    schemeMinGapTitle: "Новые станции ставятся не ближе этого числа клеток друг к другу (по каждой оси); при первом построении на это растягивается и масштаб схемы. Уже стоящие станции не двигаются — чтобы применить ко всей схеме, начните с пустой.",
    schemeToBoard: "В табло",
    schemeToBoardTitle: "Вставить схему картинкой на холст табло",
    schemeToBoardDone: "Схема вставлена в табло",
    schemeToBoardFail: "Холст табло ещё не готов — откройте вкладку «Табло» и повторите",
    schemeToolRect: "Прямоугольник (R)",
    schemeToolEllipse: "Эллипс (O)",
    schemeToolShapeLine: "Отрезок (D)",
    schemeToolText: "Текст (A)",
    schemeToolHint_rect: "Тяните на холсте — прямоугольник (Shift — квадрат). Клик — стандартный размер",
    schemeToolHint_ellipse: "Тяните на холсте — эллипс (Shift — круг). Клик — стандартный размер",
    schemeToolHint_shapeline: "Тяните — отрезок (Shift — под 45°). Клик — стандартная длина",
    schemeToolHint_text: "Клик по холсту — добавить надпись",
    schemeStaticPubTitle: "Статичная ссылка (схема целиком в адресе)",
    schemeStStyle_square: "Квадрат",
    schemeCompressSkipped: "Сжатие пустот не применено: схема уже построена без него. Чтобы сжать, нажмите «Новая пустая схема» и постройте заново.",
    schemeToggleLine: "Показать / скрыть линию", schemeToggleType: "Показать / скрыть все линии этого типа",
    schemeMergePick: "Отметить для объединения",
    schemeMergeBtn: "Объединить отмеченные",
    schemeUnmergeBtn: "Разъединить отмеченные",
    schemeMergeHint: "Отметьте несколько маршрутов галочками — они станут одной линией: общие цвет (подбирается автоматически), вид и толщина, одна полоса в пучке, одна строка легенды. Номера и названия остаются у каждого маршрута.",
    schemeMergeNeed: "Отметьте минимум две линии",
    schemeMerged: "Объединено линий: {n}",
    schemeUnmerged: "Разъединено линий: {n}",
    schemeMergedInfo: "Объединена с другими маршрутами: {n} в группе",
    schemeUnmergeOne: "Выйти из объединения",
    schemeStStyle_diamond: "Ромб",
    schemeFieldFill: "Заливка",
    schemeFieldStroke: "Обводка",
    schemeFieldStrokeW: "Толщина обводки",
    schemeFieldSize: "Размер значка",
    schemeFieldText: "Текст",
    schemeFieldFontSize: "Размер шрифта",
    schemeFieldBold: "Жирный",
    schemeFieldAlign: "Выравнивание",
    schemeFieldRadius: "Скругление",
    schemeFieldOpacity: "Прозрачность",
    schemeFieldRotation: "Поворот, °",
    schemeFieldLayer: "Слой",
    schemeFieldLaneGap: "Расстояние между линиями",
    schemeFieldCorner: "Радиус углов",
    schemeFieldStationScale: "Размер станций",
    schemeFieldTransferScale: "Толщина пересадок",
    schemeFieldTransferStyle: "Вид пересадок",
    schemeTrStyle_default: "Как в схеме (по умолчанию — перемычка)",
    schemeTrStyle_bar: "Перемычка",
    schemeTrStyle_capsule: "Капсула",
    schemeTrStyle_dumbbell: "Гантель",

    schemeTrStyle_dumbbell2: "Гантель на линиях (мелкие кружки)",
    schemeTrStyle_curve: "Кривой переход",
    schemeTrStyle_dashed: "Пунктирный переход",
    schemeTrStyle_none: "Без соединения",
    schemeTrStyle_london: "Белые кольца",
    schemeTrStyle_moscow: "Цветные кольца с мостиком",
    schemeTrStyle_square: "Квадраты",
    schemeTrStyle_hub: "Узел (сектора цветов)",
    schemeToolIcon: "Значок (I)",
    schemeToolHint_icon: "Клик по холсту — поставить значок; категорию, плашку и свою картинку выберите справа",
    schemePropShape_icon: "Значок",
    schemeFieldIconCategory: "Категория",
    schemeFieldIconVariant: "Рисунок",
    schemeFieldPlate: "Плашка",
    schemePlate_none: "Без плашки",
    schemePlate_circle: "Круг",
    schemePlate_square: "Квадрат",
    schemeFieldPlateColor: "Цвет плашки",
    schemeFieldIconSize: "Размер",
    schemeIconImport: "Добавить картинку",
    schemeIconCustom: "Своя картинка",
    schemeIconBadType: "Нужен файл PNG, JPG, GIF, WebP или SVG",
    schemeIconTooBig: "Файл слишком большой",
    schemeIconImported: "Значок «{name}» загружен",
    schemeIconLibrary: "Мои значки",
    schemeIconDelete: "Удалить из списка",
    schemeAlignLine: "Выстроить в линию",
    schemeAlignHint: "Станции встанут на прямую между двумя крайними, точки излома линий между ними удалятся.",
    schemeAlignDone: "Выстроено станций: {n}",
    schemeRebuildTitle: "Пересборка из MTR: изменений — {n}. Применить?",
    schemeRebuildAdded: "Добавится: {n}",
    schemeRebuildRemoved: "Удалится: {n}",
    schemeRebuildRenamed: "Переименуется: {n}",
    schemeRebuildMore: "…и ещё {n}",
    schemeRebuildTransfers: "Пересадки: +{a} / −{r}",
    schemeRebuildApply: "Применить",
    schemeRebuildCancelled: "Пересборка отменена",
    schemeFieldStationFill: "Заливка станций",
    schemeFieldStationStroke: "Обводка станций",
    schemeFieldLabelAuto: "Подписи без наложений (авто)",
    schemePropGroup: "Выделено несколько",
    schemePropLook: "Внешний вид",
    schemePropShape_rect: "Прямоугольник",
    schemePropShape_ellipse: "Эллипс",
    schemePropShape_line: "Отрезок",
    schemePropShape_text: "Текст",
    schemeCopyStyle: "Копировать стиль",
    schemePasteStyle: "Вставить стиль",
    schemeDeleteGroup: "Удалить выделенное",
    schemeToFront: "Наверх",
    schemeToBack: "Вниз",
    schemeDuplicate: "Дублировать",
    schemeLabelPos_auto: "Авто",
    schemeLabelPos_n: "Сверху",
    schemeLabelPos_ne: "Сверху справа",
    schemeLabelPos_e: "Справа",
    schemeLabelPos_se: "Снизу справа",
    schemeLabelPos_s: "Снизу",
    schemeLabelPos_sw: "Снизу слева",
    schemeLabelPos_w: "Слева",
    schemeLabelPos_nw: "Сверху слева",
    schemeDash_solid: "Сплошная",
    schemeDash_dashed: "Пунктир",
    schemeDash_dotted: "Точки",
    schemeDash_double: "Двойная",
    schemeDash_rail: "Железная дорога",
    schemeDash_dashdot: "Штрих-пунктир",
    schemeStStyle_stump: "Пенёк",
    schemeLineEditHint: "Квадратные точки на углах тянутся мышью, двойной клик по линии добавляет новую точку.",
    schemeDeleteVertex: "Удалить точку",
    schemeOpenRoute: "Открыть карточку маршрута",
    schemeOpenSchedule: "Открыть расписание станции",
    schemeDelete: "Удалить",
    schemeDeleteLine: "Удалить линию",
    schemeType_normal: "Поезда",
    schemeType_light_rail: "Лёгкое метро",
    schemeType_high_speed: "Скоростные",
    schemeType_metro: "Метро",
    schemeType_sbahn: "S-Bahn",
    schemeType_tram: "Трамвай",
    schemeType_bus: "Автобус",
    boardTabCanvas: "Холст",
    boardTabInsert: "Вставка",
    boardTabObject: "Объект",
    boardTabText: "Текст",
    boardLineStyleTitle: "Вид линии",
    boardLineSolid: "Сплошная",
    boardLineDashed: "Пунктир",
    boardLineDotted: "Точки",
    boardLineDashDot: "Штрих-пунктир",
    boardLineWavy: "Волнистая",
    boardLineZigzag: "Зигзаг",
    boardFilterFlow: "Тип остановки",
    boardFlowThrough: "Проходящие",
    boardFlowOrigin: "Начальные (без прибытия)",
    boardFlowTerminus: "Конечные (без отправления)",
    boardColorTitle: "Цвет выделенных объектов",
    boardStrokeColorTitle: "Цвет границы фигуры",
    boardStrokeWidthTitle: "Толщина линии и границы (0 — граница выключена)",
    boardOpacityTitle: "Прозрачность объекта",
    boardUndo: "Отменить",
    boardRedo: "Повторить",
    boardSystemFontsBtn: "Шрифты с ПК",
    boardSystemFontsGroup: "Системные шрифты",
    boardSystemFontsLoaded: "Загружено системных шрифтов: {count}",
    boardSystemFontsError: "Не удалось получить шрифты с ПК — система или браузер не разрешили доступ.",
    boardLoadingSchedule: "Загружаем расписание...",
    boardNoDepartures: "У этой станции сейчас нет активных рейсов.",
    boardScheduleInserted: "Вставлено расписание станции «{name}»: {count} рейсов.",
    boardScheduleOverflow: "Вставлено {total} рейсов, но {count} из них не помещаются на листе — увеличьте холст, уберите лишние столбцы или отфильтруйте рейсы.",
    boardScheduleError: "Не удалось загрузить расписание",
    boardSelectStationFirst: "Сначала выберите станцию из списка подсказок.",
    boardConfirmClear: "Текущий холст будет заменён. Продолжить?",
    boardCopiedToClipboard: "Скопировано в буфер обмена.",
    boardCopyError: "Не удалось скопировать",
    boardNoPresets: "Пресетов пока нет",
    boardPresetNameRequired: "Укажите название пресета.",
    boardPresetSaved: "Пресет «{name}» сохранён.",
    boardShareExportTitle: "Код для шаринга",
    boardShareExportHint: "Скопируйте код и отправьте его в чат — получатель сможет импортировать этот холст кнопкой «Импорт кода».",
    boardShareImagesIncluded: "Картинки включены в код — с ними он может получиться очень длинным.",
    boardShareCopyBtn: "Скопировать",
    boardShareImportTitle: "Импорт кода",
    boardShareImportHint: "Вставьте код, полученный от другого игрока, и нажмите «Импортировать».",
    boardShareImportBtnAction: "Импортировать",
    boardShareInvalidCode: "Код повреждён или в неподдерживаемом формате.",
    boardShareImported: "Холст импортирован.",
  },
  en: {
    appTitle: "MTR Schedule Manager",
    statusConnecting: "Connecting...",
    statusCached: "No connection to MTR server (showing cached data: {st} stations, {rt} routes)",
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
    routesFilterLabel: "Routes",
    ctxHighlightChain: "Highlight turnaround chain",
    chainHighlightHint: "Esc — clear chain highlight",
    gcStationProblem: "{r1} ({t1}) and {r2} ({t2}) share a platform, gap {gap} min",
    gcStationSolution: "Separate by at least {need} min",
    gcOvertakeProblem: "{r1} overtakes {r2} on the segment (≈{tm}) — the rear train bumps into the tail of the front one",
    gcOvertakeSolution: "Increase the headway between the trains on the segment",
    gcOvertakeLabel: "Overtake on the segment",
    gcProblemLabel: "Problem",
    gcSolutionLabel: "Solution",
    problemsTitleDelayed: "Currently delayed",
    problemsFixConflict: "Resolve by shifting",
    problemsFixDone: "Trips shifted: {n}",
    problemsFixNone: "Nothing to shift",
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
    showPartialLabel: "Show neighbouring routes",
    showConflictsLabel: "Show conflicts",
    graphConflictsHint: "Red conflict and overtake markers on the graph",
    graphTypesFilterLabel: "Train types",
    graphPartialHint: "Routes that run along only part of the selected section",
    graphPartialShort: "section",
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
    errRouteNotFound: "No route found with this id.",
    errStationNotFound: "No station found with this id.",
    errDataNotReady: "Data not yet received from the MTR server, please wait.",
    errDraftNotFound: "Draft route not found.",
    errStationsNotFound: "One of the stations was not found.",
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
    serverTzLabel: "MTR server timezone",
    serverTzHint: "If train times appear shifted — select the server's timezone.",
    favStationHint: "Favorite station — click to open",
    favMissingHint: "This station is not on the current server — remove it with ×",
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
    ctxResetTrip: "↩ Reset this trip\'s edits",
    ctxResetRoute: "↩ Reset route edits",
    sourceFilterAll: "All routes", sourceFilterReal: "Real only", sourceFilterDraft: "Drafts only",
    notifPermissionDenied: "Notifications are blocked in your browser. Allow them in browser settings.",
    notifSettingsTitle: "Notifications",
    notifConflict: "Notify on new conflicts",
    notifDelay: "Notify on new delays",
    notifBigDelay: "Notify on large delays (>5 min)",
    notifThreshold: "Delay threshold (min)",
    notifDelayThresholdLabel: "Delay threshold",
    notifSectionLabel: "Notifications",
    notifCooldownLabel: "Pause between notifications",
    notifConflictTitle: "Platform conflicts",
    notifConflictBodyOne: "Conflict detected at station “{station}”. Open the Problem areas tab.",
    notifConflictBodyMany: "Conflicts found at {count} stations. Open the Problem areas tab.",
    notifDelayTitle: "Delay",
    notifDelayBody: "Route {route} is running {min} min late.",
    notifDelayBodyMany: "{count} routes are delayed. Biggest: {route} ({min} min).",
    problemsStationsWord: "stations",
    notifPermissionDenied: "The system or browser blocked notifications for this app — allow them in OS settings.",
    problemsScanStart: "Analyzing the network…",
    problemsScanProgress: "Analyzing the network: scanned {done}/{total} stations…",
    'instr_title_schedule-basics': 'Station schedule',
    'instr_body_schedule-basics': '<p>Start typing a station name in the search field — a list of suggestions appears, click the one you need. The dashboard shows all platforms and train arrivals on a timeline. The ☆ button next to the search adds the station to <b>Favorites</b> (a quick-access bar appears below).</p><p>A bright border = deviation over 1 min. Amber "!" = conflict: two trains too close on the same platform. The <b>"Upcoming arrivals"</b> sidebar widget shows the 6 nearest trains and refreshes every 30 seconds.</p>',
    'instr_title_drag-edit': 'Manual editing (drag)',
    'instr_body_drag-edit': '<p>Drag a train block (dashboard) or line (graph) horizontally — its time shifts and the trip becomes dashed.</p><p><code>Shift</code>+drag shifts <b>all</b> trips of that route at once. <code>Alt</code>+vertical drag moves the train to another platform.</p><p><code>Ctrl+Z</code> — undo, <code>Ctrl+Y</code> — redo.</p><p>The "Reset manual edits" sidebar button clears all shifts. In the route card, "Reset edits for this route" appears if the route has changes.</p>',
    'instr_title_favorites': 'Favorites',
    'instr_body_favorites': '<p><b>Stations</b> — ☆ next to the search field. <b>Routes</b> — ☆ in the route card or table row.</p><p>A quick-access bar appears below the search: clicking a station opens its schedule, clicking a route opens its card.</p><p>In the routes table, ☆ in the toolbar filters to favorites only. Notifications can also be limited to favorites (see Settings).</p>',
    'instr_title_filters-zoom': 'Filters and zoom',
    'instr_body_filters-zoom': '<p>The left sidebar has a platform filter, a minimum-interval slider for conflicts (default 3 min), and zoom controls.</p><p>Zoom: +/− buttons or <code>Ctrl</code>+mouse wheel over the chart.</p><p>In the routes table — filters for type, source (real/draft), favorites, and a search box. Column headers are sortable.</p>',
    'instr_title_train-graph': 'Train graph',
    'instr_body_train-graph': '<p>Pick station A and B — the app builds a graph: stations on the vertical axis spaced by real distance, time on horizontal, slope = speed.</p><p>⇄ swaps A and B. "Show reverse trips" adds B→A routes to the legend. Each legend item toggles by clicking. ⓘ opens the route card.</p><p>Routes crossing midnight show their continuation on the opposite side of the chart.</p>',
    'instr_title_route-card': 'Route card',
    'instr_body_route-card': '<p>Clicking a route opens the card: metadata, stop list with coordinates (⧉ copies), and a full-day timetable. Header and first column are sticky.</p><p>Yellow "!" = platform conflict. Dashed border = manually edited cell.</p><p>For draft routes — a "Schedule formula" (D+X*I) section for pasting into the game.</p>',
    'instr_title_drafts': 'Draft routes',
    'instr_body_drafts': '<p>"+ New draft route" opens a form: name, stops via station search, dwell/leg times (auto-suggested), departure time, and interval.</p><p>Setting an <b>interval (HH:MM:SS)</b> auto-generates departures for the whole day. In the route card you can add/remove individual trips.</p><p>"Create draft route based on this" in a real route\'s card copies all stops and leg times as a starting point.</p>',
    'instr_title_problems': 'Problem areas',
    'instr_body_problems': '<p>The "Problem areas" tab shows three sections: conflicts by station, conflicts by route, and routes with the largest average delay. Favorites appear first with a ★.</p><p>Clicking a station → opens its schedule. Clicking a route → opens its card.</p>',
    'instr_title_notifications': 'Notifications',
    'instr_body_notifications': '<p>In Settings you can enable browser notifications for new platform conflicts and/or large delays (threshold in minutes is configurable). The "Favorites only" toggle limits notifications to favorite routes.</p>',
    'instr_title_settings': 'Settings',
    checkUpdateBtn: "Check for updates",
    supportBtn: "Support",
    updatesSectionLabel: "Updates",
    betaUpdatesLabel: "Receive beta versions",
    diagSectionLabel: "Diagnostics",
    diagReportBtn: "Bug-report diagnostic file",
    diagReportHint: "Saves a text file with the version, server status, settings and recent errors — attach it to your bug report. It contains no passwords or personal data.",
    diagReportSaved: "Report saved: {path}",
    diagReportError: "Couldn't save the report",
    betaUpdatesHint: "The app will update to pre-releases — new features first, but bugs are possible. Turn this off to go back to stable builds (you'll get an update once a stable release is newer than the beta).",
    interfaceSectionLabel: "Interface",
    experimentalUiLabel: "Experimental interface",
    experimentalUiHint: "New look of the app: sidebar navigation, dark palette and the new logo fonts. Same features and data — turn it off to return to the classic look.",
    routeMarkersLabel: "Route markers",
    routeMarkersHint: "How routes of each type are marked in lists, cards and boards: marker shape and what goes inside.",
    routeMarkerShape: "Shape",
    routeMarkerContent: "Inside",
    rmShape_circle: "Circle",
    rmShape_parallelogram: "Parallelogram",
    rmShape_plaque: "Plate",
    rmShape_capsule: "Capsule",
    rmShape_square: "Square",
    rmShape_diamond: "Diamond",
    rmShape_hexagon: "Hexagon",
    rmShape_triangle: "Triangle",
    rmContent_none: "Empty",
    rmContent_number: "Route number",
    rmContent_icon_train: "Icon: train",
    rmContent_icon_metro: "Icon: metro",
    rmContent_icon_tram: "Icon: tram",
    rmContent_icon_bus: "Icon: bus",
    rmContent_icon_cable: "Icon: cable car",
    rmContent_icon_ship: "Icon: ship",
    rmContent_icon_plane: "Icon: plane",
    rmContent_icon_fast: "Icon: high-speed",
    rtype_train_normal: "Train",
    rtype_train_light_rail: "Light rail",
    rtype_train_high_speed: "High-speed train",
    rtype_train_metro: "Metro",
    rtype_train_tram: "Tram",
    rtype_train_bus: "Bus",
    rtype_train_sbahn: "S-Bahn",
    rtype_train_intercity: "InterCity",
    rtype_train_regional: "Regional",
    rtype_cable_car_normal: "Cable car",
    rtype_boat_normal: "Ship",
    rtype_boat_light_rail: "Ferry",
    rtype_boat_high_speed: "High-speed boat",
    rtype_airplane_normal: "Airplane",
    nextGroupSchedules: "Schedules",
    nextNavSchedule: "Station board",
    nextNavRoutes: "Stations and routes",
    nextNavProblems: "Delays and issues",
    nextNavHelp: "Help",
    nextStatusOnline: "MTR online",
    nextStatusCached: "MTR unreachable · cached data",
    nextStatusOffline: "No connection to MTR",
    nextHome: "Home",
    nextProblemsLead: "Where the network is struggling right now and what has piled up",
    nextSettingsLead: "Changes are saved immediately",
    nextFilters: "Filters",
    nextCollapse: "Collapse / expand",
    nextClose: "Close",
    nextDragHint: "Drag a train block to shift the trip. Shift moves the whole route, Ctrl+click highlights the turnaround chain.",
    nextDay: "Day",
    nextHours: "{n} h",
    nextNow: "Now",
    nextLgConflict: "conflict",
    nextLgLate: "delay",
    nextLgEdited: "moved by hand",
    nextLgEarly: "ahead of schedule",
    nxcOnLine: "running · {n}",
    nxcEdits: "edits: {n}",
    nxcGraph: "Train graph",
    nxcCopyDraft: "Copy as draft",
    nxcTabTimetable: "Timetable",
    nxcTabStops: "Stops",
    nxcTabLive: "On the line now",
    nxcTabConflicts: "Conflicts",
    nxcTrains: "trains: {n}",
    nxcConsist: "Consist",
    nxcCars: "{n} cars",
    nxcPassport: "Details",
    nxcStopsN: "Stops",
    nxcCarsLabel: "Cars per train",
    nxcColTrip: "Trip",
    nxcColWhere: "Where now",
    nxcColNext: "Next",
    nxcColArrival: "Arrival",
    nxcNoTrains: "No trains on the line right now",
    nxcTtHint: "Planned time; live deviation in brackets where the train has not arrived yet. Click a cell to open the station board.",
    nxcNow: "Now",
    nxcLgCurrent: "current trip",
    nxcLgPassed: "grey — stations the train has already passed",
    nxcShiftBy: "Shift by {n} min",
    nxcWith: "with {r}",
    nextLgDraft: "draft",
    nextConflicts: "Conflicts",
    nextResolveAll: "Resolve all",
    nextTurnLinks: "Turnaround links",
    nextTrip: "Trip",
    nextScopeAll: "Whole network",
    nextScopeFav: "Favorites",
    nextRescan: "Recalculate",
    nextLgStationConflict: "station conflict",
    nextLgLineLate: "line is late",
    nextNavBoards: "Board generators",
    nextSortSamples: "Most samples first",
    nextNewDraft: "+ Draft route",
    nextBuild: "Build",
    nextChipConflicts: "{n} conflicts",
    nextChipLate: "{n} late",
    nextChipDrafts: "{n} draft",
    nextLocalTime: "Local time, {tz}",
    nextNoConflicts: "No conflicts",
    nextOverlap: "overlap",
    nextGap: "gap {gap}",
    nextPlatformN: "platform {p}",
    nextConflictText: "{r1} and {r2} are closer than {min} min",
    nextShiftBy: "Shift {r} by +{n} min",
    nextShow: "Show",
    nextAfter: "after {time}",
    nextGraphLead: "{s} stations · {r} routes on the section",
    nextGraphChip: "{c} conflicts · {o} overtakes",
    nextTripGone: "The trip is hidden by filters or gone after the graph was rebuilt",
    nextTripHint: "Click a train line to see the trip: stops, travel time and conflicts.",
    nextShiftShort: "{r} {n} min",
    nextShiftTrip: "Trip {n} min",
    nextConflictAtStation: "Station conflict",
    nextOvertake: "Overtake",
    nextDepShort: "dep. {t}",
    nextTravel: "{n} min travel",
    nextRouteCard: "Route card",
    nextChain: "Turnaround chain",
    nextTripConflicts: "Trip conflicts",
    nextRoutesLead: "Everything on the server: {s} stations, {r} routes, {d} drafts",
    nextColConflicts: "Confl.",
    nextDraftRoutes: "Draft routes",
    nextOtherRoutes: "Other",
    nextConflictsN: "{n} conflicts",
    nextDepot: "depot “{d}”",
    nextKpiInterval: "Headway",
    nextKpiTravel: "Travel time",
    nextKpiTrips: "Trips / day",
    nextKpiAvgDev: "Avg. deviation",
    nextRouteConflicts: "Route conflicts",
    nextOpen: "Open",
    nextKpiConflictsNow: "Conflicts now",
    nextKpiOnStations: "at {n} stations",
    nextKpiLateNow: "Late right now",
    nextKpiLateNote: "route pairs",
    nextKpiNetAvg: "Network average delay",
    nextKpiSamples: "{n} samples",
    nextKpiOnTime: "On schedule",
    nextKpiOnTimeNote: "samples of routes<br>averaging within ±1 min",
    nextOnTime: "on time",
    nextMinInterval: "Min. interval",
    nextStationRoutes: "{n} routes",
    nextColRoutes: "Routes",
    nextStationsGroup: "Stations and stops",
    nextStationsWithConflicts: "{n} with conflicts",
    nextPsStations: "Stations with conflicts",
    nextPsRoutes: "Routes with conflicts",
    nextPsLateNow: "Late right now",
    nextPsAvg: "Average delay",
    liveDotHint: "Auto-refresh is active",
    swapStationsHint: "Swap A and B",
    boardHourGapTitle: "% of row height",
    serverListLabel: "MTR Servers",
    serverUrlLabel: "MTR Server URL",
    serverUrlHint: "System map address of your MTR server. E.g.: http://localhost:8888",
    serverUrlSaved: "URL saved, reloading...",
    serverUrlError: "Error saving URL",
    'instr_body_settings': "<p>Language and timezone default to auto-detected values but can be switched manually — all times recalculate instantly. Supported languages: RU, EN, DE, FR, PL, PT, CS.</p><p><b>MTR server timezone</b> — if trains appear shifted, select your MTR server's timezone here. Settings and favorites persist across restarts.</p><p>The current tab + selected station are saved in the URL (#tab=…).</p>",
    'instr_title_schedule_formula': 'Schedule formula',
    'instr_body_schedule_formula': '<p>When editing a route, a "Schedule formula" block appears in the card. It shows the departure pattern derived from your manual edits: the interval between trips and the offset of the first trip from UTC midnight.</p><p>The formula updates automatically on every schedule change and helps confirm the edits form an even interval. Copy it with the ⧉ button to share the schedule with another player.</p>',
    'instr_title_board-editor': 'Editor (paper schedule)',
    'instr_body_board-editor': '<p>The <b>Editor</b> tab is a canvas for laying out a printable station schedule (Aushangfahrplan): place elements freely and insert the live timetable with a button.</p><p><b>Insert</b> — separate icon buttons: text, square, circle, triangle, line, image, station scheme. Each object is added to the canvas and fully editable by hand.</p><p><b>Object</b> — color, alignment, layer order, grouping (<code>Ctrl+G</code>), duplicate (<code>Ctrl+D</code>), delete, border color/width, and a <b>line-style</b> dropdown — solid, dashed, dotted, dash-dot, wavy, zigzag — showing an actual preview drawing of each style right in the list.</p><p>Rotate objects via the corner handle; hold <code>Shift</code> to snap rotation to 45° steps.</p><p><b>Text</b> — a font combobox with search and favorites (★), a "PC fonts" button, size, bold, alignment.</p><p>Bottom bar: <b>Columns</b> (arrival, departure, line, route color, destination, platform) → "Insert columns"; <b>Filters</b>; section count; schedule font size; "Fit canvas to schedule"; hour gap; canvas language; station search → "Insert station schedule".</p><p>Export the finished canvas to PNG, copy it to the clipboard, save it as a preset, or exchange it via a share code (Export/Import). Zoom with <code>Ctrl</code>+wheel or the +/− buttons.</p>',
    tabBoard: "Editor",
    boardHint: "A free-form canvas editor for a printable station timetable poster: place text, shapes and images anywhere, then insert the real schedule with the button below — everything stays manually editable afterwards.",
    boardPageA4P: "A4 portrait",
    boardPageA4L: "A4 landscape",
    boardPageCustom: "Custom size",
    boardAddText: "+ Text",
    boardAddRect: "+ Rectangle",
    boardAddShape: "+ Shape",
    boardShapeSquare: "Square",
    boardShapeCircle: "Circle",
    boardShapeTriangle: "Triangle",
    boardShapeTypeTitle: "Shape type",
    boardInsertSchemeBtn: "+ Station scheme",
    boardSchemeInserted: "Scheme for station “{name}” added.",
    boardSchemeError: "Couldn't build the scheme",
    boardAddLine: "+ Line",
    boardAddImage: "+ Image",
    boardBringFront: "Bring to front",
    boardSendBack: "Send to back",
    boardGroup: "Group",
    boardUngroup: "Ungroup",
    boardObjAlignLeft: "Align left",
    boardObjAlignCenterH: "Align center (horizontal)",
    boardObjAlignRight: "Align right",
    boardObjAlignTop: "Align top",
    boardObjAlignMiddleV: "Align middle (vertical)",
    boardObjAlignBottom: "Align bottom",
    boardDuplicate: "Duplicate",
    boardCut: "Cut",
    boardCopy: "Copy",
    boardPaste: "Paste",
    boardDelete: "Delete",
    boardClearBtn: "Clear canvas",
    boardInsertScheduleBtn: "Insert station schedule",
    boardExportPngBtn: "Export PNG",
    boardCopyClipboardBtn: "Copy to clipboard",
    boardPresetNamePlaceholder: "Preset name",
    boardPresetSaveBtn: "Save preset",
    boardPresetLoadBtn: "Load",
    boardShareExportBtn: "Share code",
    boardShareImportBtn: "Import code",
    boardDefaultText: "Text",
    boardColTime: "Time",
    boardColLine: "Line",
    boardColDest: "Destination",
    boardColPlatform: "Platform",
    boardColArrival: "Arrival",
    boardColDeparture: "Departure",
    boardColRouteColor: "Route colour square",
    boardColumnsBtn: "Columns",
    boardInsertColumnsBtn: "Insert columns",
    boardFiltersBtn: "Filters",
    boardFilterPlatforms: "Platforms",
    boardFilterTypes: "Train types",
    boardFilterRoutes: "Routes",
    boardFilterAll: "all",
    boardFilterEmpty: "Select a station first — filters are built from its departures.",
    boardSectionsLabel: "Sections",
    boardSectionsAuto: "auto",
    boardNoColumnsSelected: "Select at least one column.",
    boardColumnsInserted: "Column headers inserted — now insert a station schedule.",
    boardFilteredOutAll: "All departures are hidden by the filters — relax the filters.",
    boardTableFontLabel: "Timetable font",
    boardAutoSizeLabel: "Fit canvas to timetable",
    boardFitCanvasBtn: "Fit sheet to table",
    boardFitCanvasHint: "Resize the sheet to fit the timetable (once)",
    boardHourGapLabel: "Gap between hours",
    boardCanvasLangLabel: "Canvas language",
    boardCanvasLangAuto: "same as UI",
    boardModeTimetable: "Timetable",
    boardModeScheme: "Network map",
    schemeHint: "Network map: “Build from MTR” lays out the selected lines by the real station coordinates; building again keeps your manual edits and adds what is new in MTR.",
    schemeAlignLabel: "Straighten",
    schemeAlignOff: "off",
    schemeAlignTitle: "Hops within this angle of 0/45/90° are straightened when building. Stations already placed don't move — start from an empty map to rebuild everything.",
    schemePropNode: "Bend point",
    schemeNodeHint: "Shared by {n} line(s). Drag it to reshape the route; Delete removes the bend.",
    schemeTypesBtn: "Route types",
    schemeGenerateBtn: "Build from MTR",
    schemeFitBtn: "Fit to screen",
    schemeResetBtn: "New empty map",
    schemeLiveLabel: "Live data",
    schemeLiveTitle: "Station conflicts and line delays right on the map",
    schemeExportPng: "Export PNG",
    schemeExportSvg: "Export SVG",
    schemePublishBtn: "Share",
    schemeToolSelect: "Select and move",
    schemeToolLine: "Draw a line",
    schemeToolStation: "Place a station",
    schemeToolTransfer: "Transfer between stations",
    schemeToolHint_select: "Drag stations and corner points · drag on empty space to box-select (Shift adds) · double-click: a line adds a point, a label renames, a station opens its timetable · F2 renames · wheel zooms, Space/right-drag pans",
    schemeToolHint_line: "Click line points (45° angles, snaps to stations) · Enter or double-click to finish · Esc to cancel",
    schemeToolHint_station: "Click a line to put a station on it, or empty space for a standalone station",
    schemeToolHint_transfer: "Click two stations to link them with a transfer",
    schemeGenerating: "Building the map from MTR data…",
    schemeGenerated: "Map built: {lines} lines, {stations} stations, {transfers} transfers. Undo with Ctrl+Z.",
    schemeUpdated: "Map updated from MTR: {lines} lines, {newStations} new stations, {removedLines} lines removed. Manual edits kept.",
    schemeNoTypes: "Select at least one route type.",
    schemeGenerateError: "Could not build the map",
    schemeExportError: "Could not export the map",
    schemeResetConfirm: "Delete the current map and start from an empty one? You can undo with Ctrl+Z.",
    schemeLiveStatus: "Live data: {c} stations with conflicts, {d} delayed routes.",
    schemeLiveError: "Could not load live data",
    schemePublishTitle: "Share map",
    schemePublishHint: "One file with the whole map: opens in any browser, phones included, with no internet and no app. Send it to anyone or put it on any web host. Save the file again after editing.",
    schemePublishOpen: "Open in browser",
    schemePublishEmpty: "The map is empty — nothing to share.",
    schemeHtmlTitle: "HTML file",
    schemeHtmlSave: "Save HTML file",
    schemeHtmlSaved: "File saved ({kb} KB).",
    schemeBrowserTitle: "In the browser",
    schemeBrowserHint: "Opens the map in your system browser. While the app is running, the tab updates itself after every edit.",
    schemeBrowserOpened: "Map opened in the browser — edits will show up there automatically.",
    schemeNewStation: "Station {n}",
    schemeNewLine: "Line {n}",
    schemePropStation: "Station",
    schemePropLine: "Line",
    schemePropTransfer: "Transfer",
    schemePropScheme: "Map",
    schemePropLegend: "Legend",
    schemeFieldName: "Name",
    schemeFieldSub: "Second language / caption",
    schemeFieldStationStyle: "Marker",
    schemeFieldLabelPos: "Label position",
    schemeFieldLabelAngle: "Label angle",
    schemeFieldNumber: "Number",
    schemeFieldColor: "Color",
    schemeFieldWidth: "Width (empty = map default)",
    schemeFieldDash: "Line style",
    schemeFieldOffset: "Bundle offset",
    schemeFieldTitle: "Map title",
    schemeFieldLineWidth: "Line width",
    schemeFieldLabelSize: "Label size",
    schemeFieldBg: "Background",
    schemeFieldLabelColor: "Label color",
    schemeFieldShowLegend: "Show legend",
    schemeFieldLegendTitle: "Legend title",
    schemeStats: "{lines} lines, {stations} stations, {transfers} transfers.",
    schemeStStyle_auto: "Auto",
    schemeStStyle_tick: "Tick",
    schemeStStyle_circle: "Circle",
    schemeStStyle_pill: "Interchange",
    schemeNewText: "Text",
    schemeAskText: "Label text",
    schemeAskOk: "OK",
    schemeAskCancel: "Cancel",
    schemeAskStation: "Station name",
    schemeAskLine: "Line name",
    schemeStyleCopied: "Style copied — select another object and press “Paste style”",
    schemeStyleNoTarget: "Nothing to change: select an object of the same kind",
    schemeStylePasted: "Style applied: {n}",
    schemeReset: "Reset to default",
    schemeNone: "None",
    schemeAlign_start: "Left",
    schemeAlign_middle: "Center",
    schemeAlign_end: "Right",
    schemeLayer_back: "Below lines",
    schemeLayer_front: "Above lines",
    schemeListLines: "Lines (names)",
    schemeSelectLine: "Select line",
    schemeListStations: "Stations (names)",
    schemeSearchStations: "Find a station…",
    schemeFindStation: "Show on map",
    schemeGroupInfo: "Stations: {s}, shapes: {f}, corners: {n}",
    schemeGroupHint: "Drag any selected station to move the whole group. Shift+click adds/removes an object.",
    schemePassInfo: "Lines passing without stopping: {n}",
    schemeDefaultName: "Map {n}",
    schemeAskNewScheme: "Name of the new map",
    schemeAskRenameScheme: "Map name",
    schemeDeleteConfirm: "Delete the map “{name}”? This cannot be undone.",
    schemeSwitchTitle: "Several maps: metro, trams, whole network…",
    schemeSwitchLabel: "Map",
    schemeNewTitle: "Add a map",
    schemeRenameTitle: "Rename map",
    schemeDupTitle: "Duplicate map",
    schemeDelTitle: "Delete map",
    schemeCompressTitle: "Long hops without stations (between cities) are shortened to this many cells — applies to new stations when building",
    schemeCompressLabel: "Compress gaps",
    schemeMinGapLabel: "Min. spacing",
    schemeFieldMapScale: "Map scale",
    schemeMapScaleDown: "Shrink the map around its centre (lines and labels keep their size)",
    schemeMapScaleUp: "Spread the map around its centre (lines and labels keep their size)",
    schemeMapScaleLimit: "Can't shrink: not every station and node sits on an even grid cell (scale is ×2 / ÷2 so everything stays on the grid and diagonals stay intact)",
    schemeLabelReset: "Reset label position",
    schemeBadgeReset: "Reset route numbers position",
    schemeFieldBadgeShow: "Route numbers",
    schemeMinGapAuto: "auto",
    schemeMinGapTitle: "New stations are placed at least this many cells apart (on each axis); on the first build the map scale grows to match. Stations already placed don't move — start from an empty map to apply it everywhere.",
    schemeToBoard: "To board",
    schemeToBoardTitle: "Insert the map as an image on the timetable canvas",
    schemeToBoardDone: "Map inserted into the board",
    schemeToBoardFail: "The board canvas is not ready — open the Board tab and retry",
    schemeToolRect: "Rectangle (R)",
    schemeToolEllipse: "Ellipse (O)",
    schemeToolShapeLine: "Line segment (D)",
    schemeToolText: "Text (A)",
    schemeToolHint_rect: "Drag on the canvas for a rectangle (Shift — square). Click for default size",
    schemeToolHint_ellipse: "Drag on the canvas for an ellipse (Shift — circle). Click for default size",
    schemeToolHint_shapeline: "Drag for a segment (Shift — 45° steps). Click for default length",
    schemeToolHint_text: "Click the canvas to add a label",
    schemeStaticPubTitle: "Static link (whole map in the address)",
    schemeStStyle_square: "Square",
    schemeCompressSkipped: "Gap compression not applied: this map was built without it. To compress, press “New empty map” and build again.",
    schemeToggleLine: "Show / hide the line", schemeToggleType: "Show / hide all lines of this type",
    schemeMergePick: "Tick to merge",
    schemeMergeBtn: "Merge ticked",
    schemeUnmergeBtn: "Unmerge ticked",
    schemeMergeHint: "Tick several routes to turn them into one line: shared colour (picked automatically), style and width, one lane in bundles, one legend row. Each route keeps its own number and name.",
    schemeMergeNeed: "Tick at least two lines",
    schemeMerged: "Lines merged: {n}",
    schemeUnmerged: "Lines unmerged: {n}",
    schemeMergedInfo: "Merged with other routes: {n} in the group",
    schemeUnmergeOne: "Leave the merge",
    schemeStStyle_diamond: "Diamond",
    schemeFieldFill: "Fill",
    schemeFieldStroke: "Stroke",
    schemeFieldStrokeW: "Stroke width",
    schemeFieldSize: "Marker size",
    schemeFieldText: "Text",
    schemeFieldFontSize: "Font size",
    schemeFieldBold: "Bold",
    schemeFieldAlign: "Alignment",
    schemeFieldRadius: "Corner radius",
    schemeFieldOpacity: "Opacity",
    schemeFieldRotation: "Rotation, °",
    schemeFieldLayer: "Layer",
    schemeFieldLaneGap: "Gap between lines",
    schemeFieldCorner: "Corner radius",
    schemeFieldStationScale: "Station size",
    schemeFieldTransferScale: "Interchange width",
    schemeFieldTransferStyle: "Interchange style",
    schemeTrStyle_default: "Same as map (default: bar)",
    schemeTrStyle_bar: "Bar",
    schemeTrStyle_capsule: "Capsule",
    schemeTrStyle_dumbbell: "Dumbbell",

    schemeTrStyle_dumbbell2: "Dumbbell on lines (small dots)",
    schemeTrStyle_curve: "Curved link",
    schemeTrStyle_dashed: "Dashed link",
    schemeTrStyle_none: "No connector",
    schemeTrStyle_london: "White rings",
    schemeTrStyle_moscow: "Coloured rings + bridge",
    schemeTrStyle_square: "Squares",
    schemeTrStyle_hub: "Hub (colour sectors)",
    schemeToolIcon: "Icon (I)",
    schemeToolHint_icon: "Click the canvas to place an icon; pick the category, plate and your own image on the right",
    schemePropShape_icon: "Icon",
    schemeFieldIconCategory: "Category",
    schemeFieldIconVariant: "Design",
    schemeFieldPlate: "Plate",
    schemePlate_none: "No plate",
    schemePlate_circle: "Circle",
    schemePlate_square: "Square",
    schemeFieldPlateColor: "Plate colour",
    schemeFieldIconSize: "Size",
    schemeIconImport: "Add image",
    schemeIconCustom: "Custom image",
    schemeIconBadType: "A PNG, JPG, GIF, WebP or SVG file is required",
    schemeIconTooBig: "The file is too large",
    schemeIconImported: "Icon «{name}» imported",
    schemeIconLibrary: "My icons",
    schemeIconDelete: "Remove from list",
    schemeAlignLine: "Align in a line",
    schemeAlignHint: "Stations are placed on a straight line between the two outermost ones; line bends between them are removed.",
    schemeAlignDone: "Stations aligned: {n}",
    schemeRebuildTitle: "Rebuild from MTR: {n} changes. Apply?",
    schemeRebuildAdded: "To be added: {n}",
    schemeRebuildRemoved: "To be removed: {n}",
    schemeRebuildRenamed: "To be renamed: {n}",
    schemeRebuildMore: "…and {n} more",
    schemeRebuildTransfers: "Transfers: +{a} / −{r}",
    schemeRebuildApply: "Apply",
    schemeRebuildCancelled: "Rebuild cancelled",
    schemeFieldStationFill: "Station fill",
    schemeFieldStationStroke: "Station outline",
    schemeFieldLabelAuto: "Auto-avoid label overlaps",
    schemePropGroup: "Multiple selected",
    schemePropLook: "Appearance",
    schemePropShape_rect: "Rectangle",
    schemePropShape_ellipse: "Ellipse",
    schemePropShape_line: "Segment",
    schemePropShape_text: "Text",
    schemeCopyStyle: "Copy style",
    schemePasteStyle: "Paste style",
    schemeDeleteGroup: "Delete selected",
    schemeToFront: "To front",
    schemeToBack: "To back",
    schemeDuplicate: "Duplicate",
    schemeLabelPos_auto: "Auto",
    schemeLabelPos_n: "Top",
    schemeLabelPos_ne: "Top right",
    schemeLabelPos_e: "Right",
    schemeLabelPos_se: "Bottom right",
    schemeLabelPos_s: "Bottom",
    schemeLabelPos_sw: "Bottom left",
    schemeLabelPos_w: "Left",
    schemeLabelPos_nw: "Top left",
    schemeDash_solid: "Solid",
    schemeDash_dashed: "Dashed",
    schemeDash_dotted: "Dotted",
    schemeDash_double: "Double",
    schemeDash_rail: "Railway",
    schemeDash_dashdot: "Dash-dot",
    schemeStStyle_stump: "Stump",
    schemeLineEditHint: "Drag the square points at the corners, double-click the line to add a new point.",
    schemeDeleteVertex: "Delete point",
    schemeOpenRoute: "Open route card",
    schemeOpenSchedule: "Open station timetable",
    schemeDelete: "Delete",
    schemeDeleteLine: "Delete line",
    schemeType_normal: "Trains",
    schemeType_light_rail: "Light rail",
    schemeType_high_speed: "High-speed",
    schemeType_metro: "Metro",
    schemeType_sbahn: "S-Bahn",
    schemeType_tram: "Tram",
    schemeType_bus: "Bus",
    boardTabCanvas: "Canvas",
    boardTabInsert: "Insert",
    boardTabObject: "Object",
    boardTabText: "Text",
    boardLineStyleTitle: "Line style",
    boardLineSolid: "Solid",
    boardLineDashed: "Dashed",
    boardLineDotted: "Dotted",
    boardLineDashDot: "Dash-dot",
    boardLineWavy: "Wavy",
    boardLineZigzag: "Zigzag",
    boardFilterFlow: "Stop type",
    boardFlowThrough: "Passing through",
    boardFlowOrigin: "Originating (no arrival)",
    boardFlowTerminus: "Terminating (no departure)",
    boardColorTitle: "Colour of selected objects",
    boardStrokeColorTitle: "Shape border colour",
    boardStrokeWidthTitle: "Line and border width (0 = border off)",
    boardOpacityTitle: "Object opacity",
    boardUndo: "Undo",
    boardRedo: "Redo",
    boardSystemFontsBtn: "PC fonts",
    boardSystemFontsGroup: "System fonts",
    boardSystemFontsLoaded: "Loaded {count} system fonts",
    boardSystemFontsError: "Couldn't get fonts from this PC — access was not allowed.",
    boardLoadingSchedule: "Loading schedule...",
    boardNoDepartures: "This station has no active trips right now.",
    boardScheduleInserted: "Inserted schedule for station “{name}”: {count} trips.",
    boardScheduleOverflow: "Inserted {total} trips, but {count} of them don't fit on the sheet — enlarge the canvas, remove columns or filter the trips.",
    boardScheduleError: "Failed to load schedule",
    boardSelectStationFirst: "Select a station from the suggestion list first.",
    boardConfirmClear: "The current canvas will be replaced. Continue?",
    boardCopiedToClipboard: "Copied to clipboard.",
    boardCopyError: "Failed to copy",
    boardNoPresets: "No presets yet",
    boardPresetNameRequired: "Enter a preset name.",
    boardPresetSaved: "Preset “{name}” saved.",
    boardShareExportTitle: "Share code",
    boardShareExportHint: "Copy this code and send it in chat — the recipient can import this canvas with the “Import code” button.",
    boardShareImagesIncluded: "Images are included in the code — it can get very long with them.",
    boardShareCopyBtn: "Copy",
    boardShareImportTitle: "Import code",
    boardShareImportHint: "Paste the code you got from another player and click “Import”.",
    boardShareImportBtnAction: "Import",
    boardShareInvalidCode: "The code is corrupted or in an unsupported format.",
    boardShareImported: "Canvas imported.",
  }
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
  langMode: "auto",
  tzMode: "auto",
  serverTzOffsetMin: 0, // часовой пояс сервера MTR (вычитается из времён API)
  serverUrl: "", // URL MTR-сервера (пустая строка = дефолтный)
  serverList: [], // список серверов пользователя
  notifConflict: false,   // десктоп-уведомления о новых конфликтах платформ
  notifDelay: false,      // десктоп-уведомления о новых опозданиях маршрутов
  notifOnlyFav: false,    // уведомлять только по избранным станциям/маршрутам
  notifCooldownMin: 5,    // пауза между уведомлениями, минут
  delayThresholdMin: 5,   // порог опоздания для уведомления, минут
  betaUpdates: false,     // ставить бета-версии (пре-релизы GitHub) автообновлением
  experimentalUi: false,  // новый интерфейс (класс ui-next на <html>, стили в ui-next.css)
  routeMarkers: {},       // метки маршрутов по типам: { [type]: { shape, content } }, см. routeMarkers.js
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

// Ошибки приходят с сервера на русском (server.js). Переводим известные
// сообщения в язык интерфейса; незнакомые показываем как есть.
const SERVER_ERR_MAP = {
  "Маршрут с таким id не найден.": "errRouteNotFound",
  "Станция с таким id не найдена.": "errStationNotFound",
  "Данные ещё не получены от сервера MTR, подождите немного.": "errDataNotReady",
  "Пробный маршрут не найден.": "errDraftNotFound",
  "Одна из станций не найдена.": "errStationsNotFound",
};
function tServerError(msg) {
  const key = SERVER_ERR_MAP[(msg || "").trim()];
  return key ? t(key) : (msg || "");
}

// ── Множественное число с учётом языка ──────────────────────────────────
// Славянские языки (ru/pl/cs) требуют 3 формы (1 / 2–4 / 5+ с исключениями),
// остальные — 2 (единственное / множественное).
function _pluralSlavic(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
function _pluralCs(n, one, few, many) {
  if (n === 1) return one;
  if (n >= 2 && n <= 4) return few;
  return many;
}
const PLURAL_FORMS = {
  station: {
    en: (n) => (n === 1 ? "station" : "stations"),
    ru: (n) => _pluralSlavic(n, "станция", "станции", "станций"),
    de: (n) => (n === 1 ? "Bahnhof" : "Bahnhöfe"),
    fr: (n) => (n === 1 ? "gare" : "gares"),
    pl: (n) => _pluralSlavic(n, "stacja", "stacje", "stacji"),
    pt: (n) => (n === 1 ? "estação" : "estações"),
    cs: (n) => _pluralCs(n, "stanice", "stanice", "stanic"),
  },
  conflict: {
    en: (n) => (n === 1 ? "conflict" : "conflicts"),
    ru: (n) => _pluralSlavic(n, "конфликт", "конфликта", "конфликтов"),
    de: (n) => (n === 1 ? "Konflikt" : "Konflikte"),
    fr: (n) => (n === 1 ? "conflit" : "conflits"),
    pl: (n) => _pluralSlavic(n, "konflikt", "konflikty", "konfliktów"),
    pt: (n) => (n === 1 ? "conflito" : "conflitos"),
    cs: (n) => _pluralCs(n, "konflikt", "konflikty", "konfliktů"),
  },
};
function pluralWord(count, kind) {
  const table = PLURAL_FORMS[kind];
  if (!table) return "";
  const fn = table[currentLang()] || table.en;
  return fn(Number(count) || 0);
}

function applyI18n() {
  document.documentElement.lang = currentLang();
  // data-i18n-next — подпись в экспериментальном UI (там разделы названы как в макетах)
  const uiNext = document.documentElement.classList.contains("ui-next");
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(uiNext && el.dataset.i18nNext ? el.dataset.i18nNext : el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    // data-hotkey — подсказка горячей клавиши, не переводится
    const base = t(el.dataset.i18nTitle), hk = el.dataset.hotkey;
    // в самом переводе буква может уже стоять в скобках — не дублируем
    el.title = base + (hk && !base.includes(`(${hk})`) ? ` (${hk})` : "");
  });
  try { window.NetworkScheme && window.NetworkScheme.onLanguageChange(); } catch (e) {}
  updateNextPageTitle();
}

// ============================================================
// Время / часовой пояс
// ============================================================
function normalizeMs(ms) {
  const m = ms % MS_PER_DAY;
  return m < 0 ? m + MS_PER_DAY : m;
}
function formatUtc(msUtc, withSeconds) {
  const ms = ((msUtc % 86400000) + 86400000) % 86400000;
  const h = String(Math.floor(ms / 3600000)).padStart(2, '0');
  const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0');
  if (withSeconds) {
    const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
    return h + ':' + m + ':' + s;
  }
  return h + ':' + m;
}

function formatLocal(msUtc, withSeconds) {
  // msUtc здесь — время от MTR API, которое на самом деле в локальном
  // времени сервера (serverTzOffsetMin). Вычитаем его, чтобы получить
  // настоящий UTC, потом прибавляем выбранный пользователем пояс.
  const serverOffset = (typeof settings !== "undefined") ? (settings.serverTzOffsetMin || 0) : 0;
  const msUtc_real = normalizeMs(msUtc - serverOffset * 60000);
  const offsetMin = currentTzOffsetMin();
  const total = normalizeMs(Math.round(msUtc_real) + offsetMin * 60000);
  const totalSec = Math.floor(total / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return withSeconds ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(h)}:${pad(m)}`;
}
/**
 * Сдвиг (мс), переводящий «сырое» время расписания в отображаемое локальное
 * время суток. Графики рендерятся от локальной полуночи до полуночи:
 * этим сдвигом позиционируются блоки дашборда, линии рейсов на графике
 * движения и линия «сейчас». Совпадает с преобразованием formatLocal(),
 * поэтому подпись оси под поездом всегда равна его локальному времени.
 */
function displayShiftMs() {
  const serverOffset = (typeof settings !== "undefined") ? (settings.serverTzOffsetMin || 0) : 0;
  return (currentTzOffsetMin() - serverOffset) * 60000;
}
/** «Сырое» время расписания → отображаемое время суток (0..24 ч). */
function toDisplayMs(ms) { return normalizeMs(ms + displayShiftMs()); }

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
// Компактное отклонение в скобках для ячеек расписания: "(+5)" / "(−2)".
// Пусто, если поезд идёт по графику (в пределах ±1 мин). Минуты округляются.
function formatDeviationParen(ms) {
  if (ms == null || Math.abs(ms) <= 60000) return "";
  const mins = Math.round(ms / 60000);
  return `(${mins > 0 ? "+" : "−"}${Math.abs(mins)})`;
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

// Пересечение двух отрезков в осях (t = X, d = Y). Возвращает {t, d} в точке
// СТРОГО внутреннего пересечения (общие концы на станциях не считаются —
// это норма, не обгон) либо null. Используется для маркеров обгона на графике.
function segIntersect(ax1, ay1, ax2, ay2, bx1, by1, bx2, by2) {
  const d1x = ax2 - ax1, d1y = ay2 - ay1;
  const d2x = bx2 - bx1, d2y = by2 - by1;
  const denom = d1x * d2y - d1y * d2x;
  if (denom === 0) return null; // параллельны/коллинеарны
  const ux = bx1 - ax1, uy = by1 - ay1;
  const s = (ux * d2y - uy * d2x) / denom; // параметр на отрезке A
  const r = (ux * d1y - uy * d1x) / denom; // параметр на отрезке B
  const EPS = 0.001; // отсекаем совпадения ровно в концах (станциях)
  if (s <= EPS || s >= 1 - EPS || r <= EPS || r >= 1 - EPS) return null;
  return { t: ax1 + s * d1x, d: ay1 + s * d1y };
}

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
// Распространяет сдвиг рейса на ВСЮ цепочку оборота: прямой рейс на конечной
// становится обратным, обратный на другой конечной — следующим прямым и т.д.
// Маршруты типа S19 не заезжают в депо и катаются туда-сюда весь день — у них
// связаны все рейсы, и сдвиг одного блока двигает все остальные. Цепочку
// считает сервер (/api/turnaround-chain) по парам оборота на обеих конечных;
// каждому рейсу цепочки ставится ТО ЖЕ абсолютное значение правки, что и
// сдвинутому (лесенка сохраняется, как раньше у пары). Если сервер недоступен —
// fallback на старую связь только с парным рейсом на открытой станции.
async function applyReverseShift(routeId, tripOriginMs, deltaMs) {
  try {
    const res = await fetch(`/api/turnaround-chain?routeId=${encodeURIComponent(routeId)}&t0=${encodeURIComponent(tripOriginMs)}`);
    if (res.ok) {
      const data = await res.json();
      let changed = false;
      for (const n of (data && data.chain) || []) {
        if (n.routeId === routeId && n.tripOriginMs === tripOriginMs) continue;
        setOverride(n.routeId, n.tripOriginMs, deltaMs, true);
        changed = true;
      }
      if (changed) {
        persistOverrides();
        // Вызывающий код уже перерисовал вид с правкой самого рейса —
        // после прихода цепочки перерисовываем ещё раз с остальными
        renderDashboardFromCache();
        renderGraphFromCache();
      }
      return;
    }
  } catch (e) { /* оффлайн/ошибка — используем fallback ниже */ }
  if (!state.lastScheduleData) return;
  const entry = state.lastScheduleData.entries.find(
    e => e.routeId === routeId && e.tripOriginMs === tripOriginMs
  );
  if (!entry) return;
  if (entry.reverseRouteId != null && entry.reverseTripOriginMs != null) {
    setOverride(entry.reverseRouteId, entry.reverseTripOriginMs, deltaMs);
  } else if (entry.pairedForwardRouteId != null && entry.pairedForwardTripOriginMs != null) {
    setOverride(entry.pairedForwardRouteId, entry.pairedForwardTripOriginMs, deltaMs);
  }
}

// ── Подсветка цепочки оборота ────────────────────────────────────────
// Ctrl+клик по блоку дашборда / линии графика (или пункт контекстного меню)
// подсвечивает все рейсы, связанные оборотами на конечных, — именно они
// двигаются вместе при ручной правке. Повторный Ctrl+клик или Esc снимает.
async function toggleChainHighlight(routeId, tripOriginMs) {
  const key = `${routeId}:${tripOriginMs}`;
  if (state.chainHl && state.chainHl.has(key)) { clearChainHighlight(); return; }
  try {
    const res = await fetch(`/api/turnaround-chain?routeId=${encodeURIComponent(routeId)}&t0=${encodeURIComponent(tripOriginMs)}`);
    if (!res.ok) return;
    const data = await res.json();
    const keys = ((data && data.chain) || []).map((n) => `${n.routeId}:${n.tripOriginMs}`);
    state.chainHl = new Set(keys.length ? keys : [key]);
    renderDashboardFromCache();
    renderGraphFromCache();
  } catch (e) { /* сервер недоступен — просто не подсвечиваем */ }
}
function clearChainHighlight() {
  if (!state.chainHl) return;
  state.chainHl = null;
  renderDashboardFromCache();
  renderGraphFromCache();
}
document.addEventListener("keydown", (e) => { if (e.key === "Escape") clearChainHighlight(); });

function setOverride(routeId, tripOriginMs, deltaMs, skipPersist) {
  const idx = findOverrideIndex(routeId, tripOriginMs);
  if (idx === -1) overridesList.push({ routeId, t0: tripOriginMs, deltaMs });
  // Обновляем и "якорь" t0 на актуальный — если значение реально немного
  // сдвинулось, следующий поиск будет ещё точнее.
  else overridesList[idx] = { routeId, t0: tripOriginMs, deltaMs };
  // skipPersist: при массовой правке (цепочка оборота) сохраняем один раз в конце
  if (!skipPersist) persistOverrides();
}
function clearOverrides() {
  overridesList = [];
  persistOverrides();
}
// Сброс правки конкретного рейса
function removeOverride(routeId, tripOriginMs) {
  const idx = findOverrideIndex(routeId, tripOriginMs);
  if (idx !== -1) overridesList.splice(idx, 1);
  persistOverrides();
}
// Сброс правок всего маршрута (routeOverridesMap + все рейсы)
function removeRouteOverride(routeId) {
  overridesList = overridesList.filter(o => o.routeId !== routeId);
  delete routeOverridesMap[routeId];
  persistOverrides();
}
// Есть ли какие-то правки для маршрута
function hasRouteOverride(routeId) {
  return routeOverridesMap[routeId] !== undefined ||
    overridesList.some(o => o.routeId === routeId);
}
function persistOverrides() {
  savePrefsToServer();
}

// Отдельный слой: сдвиг ВСЕГО маршрута целиком (Shift+перетаскивание).
// Складывается с индивидуальной правкой конкретного рейса.
let routeOverridesMap = JSON.parse(localStorage.getItem("mtr_route_overrides") || "{}");
function getRouteOverride(routeId) { return routeOverridesMap[routeId] || 0; }
function bumpRouteOverride(routeId, deltaMs) {
  routeOverridesMap[routeId] = getRouteOverride(routeId) + deltaMs;
  // persisted via savePrefsToServer
}
// Сдвиг всего маршрута + синхронный сдвиг его обратного маршрута:
// прямой и обратный связаны оборотами на конечных, двигаются вместе.
async function bumpRouteOverrideWithReverse(routeId, deltaMs) {
  bumpRouteOverride(routeId, deltaMs);
  let revId = (state.routes || []).find((r) => r.id === routeId)?.reverseRouteId;
  if (revId === undefined) {
    // Список маршрутов ещё не загружен (свежий запуск) — reverseRouteId
    // отдаёт и endpoint цепочки (t0 не важен, нужен только сам маршрут)
    try {
      const res = await fetch(`/api/turnaround-chain?routeId=${encodeURIComponent(routeId)}&t0=0`);
      if (res.ok) revId = (await res.json()).reverseRouteId;
    } catch (e) { /* оффлайн — обратный не сдвигаем */ }
  }
  if (revId) {
    bumpRouteOverride(revId, deltaMs);
    renderDashboardFromCache();
    renderGraphFromCache();
  }
}
function clearAllOverrides() {
  overridesList = [];
  routeOverridesMap = {};
  platformOverridesMap = {};
  persistOverrides();
  // persisted via savePrefsToServer
  // persisted via savePrefsToServer
}
/** Очищает правки только одного маршрута, не трогая остальные. */
function clearOverridesForRoute(routeId) {
  pushUndoSnapshot();
  overridesList = overridesList.filter((o) => o.routeId !== routeId);
  delete routeOverridesMap[routeId];
  persistOverrides();
  // persisted via savePrefsToServer
  // persisted via savePrefsToServer
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
  // persisted via savePrefsToServer
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
  // persisted via savePrefsToServer
  // persisted via savePrefsToServer
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
  showPartial: true, // маршруты-соседи, совпадающие с коридором частично
  showGraphConflicts: true, // маркеры конфликтов/обгонов на графике движения
  graphTypeFilter: null,    // Set типов поездов на графике (null = ещё не построен)
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
// Обход всей сети чанками через /api/analytics/conflict-scan. Результат
// кешируется на CONFLICT_SCAN_TTL, чтобы фоновые уведомления и повторное
// открытие вкладки не сканировали сеть заново каждый раз.
const CONFLICT_SCAN_TTL = 120000;
let _conflictScan = { at: 0, stations: [], running: null };
async function runFullConflictScan(onProgress) {
  const fresh = _conflictScan.stations.length && Date.now() - _conflictScan.at < CONFLICT_SCAN_TTL;
  if (fresh && !onProgress) return _conflictScan.stations;
  if (_conflictScan.running) return _conflictScan.running;
  const minIntervalMin = state.minIntervalMin || 3;
  const LIMIT = 60;
  const run = (async () => {
    const all = [];
    let offset = 0, total = 0;
    do {
      let data;
      try {
        const res = await fetch(`/api/analytics/conflict-scan?offset=${offset}&limit=${LIMIT}&minIntervalMin=${minIntervalMin}`);
        if (!res.ok) break;
        data = await res.json();
      } catch (e) { break; }
      total = data.total || 0;
      if (Array.isArray(data.conflicts)) all.push(...data.conflicts);
      offset += data.scanned || LIMIT;
      if (onProgress) { try { onProgress(Math.min(offset, total), total, all.length); } catch (e) {} }
    } while (offset < total && total > 0);
    _conflictScan = { at: Date.now(), stations: all, running: null };
    return all;
  })();
  _conflictScan.running = run;
  return run;
}

async function renderProblems() {
  const el = document.getElementById("problemsContent");
  if (!el) return;

  // Если данных обхода нет или они устарели — показываем прогресс анализа.
  const fresh = _conflictScan.stations.length && Date.now() - _conflictScan.at < CONFLICT_SCAN_TTL;
  if (!fresh) {
    el.innerHTML = `<p class="hint" id="problemsScanProgress">${escapeHtml(t("problemsScanStart"))}</p>`;
    const prog = document.getElementById("problemsScanProgress");
    await runFullConflictScan((done, total) => {
      if (prog) prog.textContent = t("problemsScanProgress", { done, total });
    });
    // Пользователь мог уйти с вкладки — но перерисовка скрытого блока безвредна
  }
  // Текущие опаздывающие поезда (live) — обновляем перед рендером секций
  try {
    const res = await fetch(`/api/analytics/live-delays?thresholdMin=1`);
    state._liveDelays = res.ok ? await res.json() : [];
  } catch (e) { state._liveDelays = []; }
  renderProblemsSections(el);
}

// ── Пары маршрутов в «Проблемных местах» ────────────────────────────────
// Прямой и обратный — один состав по обороту: если один опаздывает, второй
// опаздывает так же. Показывать их двумя строками — шум, поэтому в списках
// они схлопываются в одну запись «ICE330/ICE332» (или просто «ICE330»,
// если номер у обоих одинаковый).
function routePairKey(routeId) {
  const rev = state.routesById.get(routeId)?.reverseRouteId;
  if (!rev) return routeId;
  return [routeId, rev].sort().join("+");
}
/** Все существующие id пары (1 или 2 шт.) в стабильном порядке. */
function routePairMemberIds(routeId) {
  const rev = state.routesById.get(routeId)?.reverseRouteId;
  const ids = rev && state.routesById.has(rev) ? [routeId, rev].sort() : [routeId];
  return ids;
}
/** Подпись пары: «Имя · ICE330/ICE332». Одинаковые номера не дублируем. */
function routePairLabel(routeId) {
  const ids = routePairMemberIds(routeId);
  const routes = ids.map((id) => state.routesById.get(id)).filter(Boolean);
  if (!routes.length) return routeId;
  const nums = [...new Set(routes.map((r) => r.number).filter(Boolean))];
  const name = routes[0].name;
  return name + (nums.length ? ` · ${nums.join("/")}` : "");
}

function renderProblemsSections(el) {
  const favRouteIds = new Set(favoriteRoutes.map((r) => r.id));
  const favStationIds = new Set(favorites.map((s) => s.id));

  // Обход всей сети + накопленные при просмотре станции конфликты (последние
  // отражают ручные правки пользователя и имеют приоритет по stationId).
  const merged = new Map();
  for (const s of _conflictScan.stations) merged.set(s.stationId, s);
  for (const s of (state._conflictedStations || new Map()).values()) merged.set(s.stationId, s);
  // Новый вид, охват «Избранное»: только избранные станции и маршруты
  const favOnly = isNextUi() && state.nxProblemsScope === "fav";
  const favRoute = (rid) => routePairMemberIds(rid).some((id) => favRouteIds.has(id));
  const allStationConflicts = Array.from(merged.values()).filter((s) => !favOnly || favStationIds.has(s.stationId));
  const conflictsByRoute = new Map();
  for (const st of allStationConflicts) {
    for (const rid of st.routeIds || []) {
      if (!conflictsByRoute.has(rid)) conflictsByRoute.set(rid, []);
      conflictsByRoute.get(rid).push(st.stationId);
    }
  }

  // Только реально опаздывающие маршруты (среднее опоздание > 1 мин — вне
  // «в графике ±60с»), и только те, что существуют на текущем сервере
  // (в истории опозданий могут остаться ID с других серверов).
  const byDelay = state.lastAnalytics
    .filter((a) => a.sampleCount >= 3 && a.avgDeviationMs > 60000 && state.routesById.has(a.routeId))
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

  // Избранные станции — первыми, затем по числу конфликтов (по убыванию).
  const stItems = allStationConflicts
    .slice()
    .sort((a, b) => {
      const fa = favStationIds.has(a.stationId) ? 0 : 1, fb = favStationIds.has(b.stationId) ? 0 : 1;
      if (fa !== fb) return fa - fb;
      return (b.conflictCount || 0) - (a.conflictCount || 0);
    });
  const stHtml = stItems.length
    ? `<div class="problems-grid">${stItems.slice(0, 300).map((st) =>
        `<div class="problem-card" data-goto-station="${escapeHtml(st.stationId)}" style="cursor:pointer;">
          <div class="problem-card-name">${favStationIds.has(st.stationId) ? "★ " : ""}${escapeHtml(st.stationName)}</div>
          <div class="problem-card-sub">${st.conflictCount} ${escapeHtml(pluralWord(st.conflictCount, "conflict"))}</div>
          <div class="nx-pbtns"><button class="problem-fix-btn" data-fix-station="${escapeHtml(st.stationId)}">${escapeHtml(t("problemsFixConflict"))}</button><button type="button" class="next-only nx-ghost">${escapeHtml(t("nextOpen"))}</button></div>
        </div>`).join("")}</div>`
    : "";

  // Маршруты с других серверов (ID нет в текущей топологии) не показываем.
  // Прямой и обратный схлопываем в одну карточку-пару, станции объединяем.
  const rtPairs = new Map(); // pairKey → { rid, stations:Set }
  for (const [rid, sts] of conflictsByRoute.entries()) {
    if (!state.routesById.has(rid)) continue;
    if (favOnly && !favRoute(rid)) continue;
    const key = routePairKey(rid);
    if (!rtPairs.has(key)) rtPairs.set(key, { rid, stations: new Set() });
    for (const s of sts) rtPairs.get(key).stations.add(s);
  }
  const rtItems = Array.from(rtPairs.values())
    .sort((a, b) => {
      const fa = routePairMemberIds(a.rid).some((id) => favRouteIds.has(id)) ? 0 : 1;
      const fb = routePairMemberIds(b.rid).some((id) => favRouteIds.has(id)) ? 0 : 1;
      if (fa !== fb) return fa - fb;
      return b.stations.size - a.stations.size;
    });
  const rtHtml = rtItems.length
    ? `<div class="problems-grid">${rtItems.slice(0, 20).map(({ rid, stations }) => {
        const r = state.routesById.get(rid);
        const label = routePairLabel(rid);
        const isFav = routePairMemberIds(rid).some((id) => favRouteIds.has(id));
        return `<div class="problem-card clickable-row" data-route-id="${escapeHtml(rid)}" style="border-left:3px solid ${r?.color || "#888"}">
          <div class="problem-card-name">${r ? routeMarker(r.type, r.color, r.number, "md") : ""}${isFav ? "★ " : ""}${escapeHtml(label)}</div>
          <div class="problem-card-sub">${stations.size} ${escapeHtml(pluralWord(stations.size, "station"))}</div>
        </div>`;
      }).join("")}</div>`
    : "";

  // Текущие опаздывающие (live-отклонение прямо сейчас). Та же логика
  // отображения, что у остальных блоков: избранные — первыми, затем по
  // убыванию задержки; маршруты с других серверов отфильтрованы.
  // Схлопывает список маршрутов в пары (прямой+обратный): берём максимум по
  // указанному полю — по обороту оба направления опаздывают одинаково, и
  // максимум = то самое общее опоздание.
  const groupByPair = (list, getId, pickMax) => {
    const byPair = new Map();
    for (const item of list) {
      const key = routePairKey(getId(item));
      const prev = byPair.get(key);
      if (!prev || pickMax(item) > pickMax(prev)) byPair.set(key, item);
    }
    return Array.from(byPair.values());
  };
  const isFavPair = (rid) => routePairMemberIds(rid).some((id) => favRouteIds.has(id));

  const liveDelayed = groupByPair(
    (state._liveDelays || []).filter((d) => state.routesById.has(d.routeId) && (!favOnly || favRoute(d.routeId))),
    (d) => d.routeId,
    (d) => d.maxDeviationMs,
  )
    .sort((a, b) => {
      const fa = isFavPair(a.routeId) ? 0 : 1, fb = isFavPair(b.routeId) ? 0 : 1;
      if (fa !== fb) return fa - fb;
      return b.maxDeviationMs - a.maxDeviationMs;
    })
    .slice(0, 40);
  const liveDelayedHtml = liveDelayed.length
    ? `<div class="problems-grid">${liveDelayed.map((d) => {
        const r = state.routesById.get(d.routeId);
        return `<div class="problem-card clickable-row" data-route-id="${escapeHtml(d.routeId)}" style="border-left:3px solid ${r?.color || "#888"}">
          <div class="problem-card-name">${r ? routeMarker(r.type, r.color, r.number, "md") : ""}${isFavPair(d.routeId) ? "★ " : ""}${escapeHtml(routePairLabel(d.routeId))}</div>
          <div class="problem-card-sub ${deviationClass(d.maxDeviationMs)}">${formatDeviation(d.maxDeviationMs)}</div>
        </div>`;
      }).join("")}</div>`
    : "";

  const byDelayPaired = groupByPair(byDelay.filter((a) => !favOnly || favRoute(a.routeId)), (a) => a.routeId, (a) => a.avgDeviationMs);
  const delayHtml = byDelayPaired.length
    ? `<div class="problems-grid">${byDelayPaired.map((a) => {
        const r = state.routesById.get(a.routeId);
        return `<div class="problem-card clickable-row" data-route-id="${escapeHtml(a.routeId)}" style="border-left:3px solid ${r?.color || "#888"}">
          <div class="problem-card-name">${r ? routeMarker(r.type, r.color, r.number, "md") : ""}${isFavPair(a.routeId) ? "★ " : ""}${escapeHtml(routePairLabel(a.routeId))}</div>
          <div class="problem-card-sub ${deviationClass(a.avgDeviationMs)}">${formatDeviation(a.avgDeviationMs)} · ${a.sampleCount} ${escapeHtml(t("colSamples")).toLowerCase()}</div>
        </div>`;
      }).join("")}</div>`
    : "";

  nextSyncProblemsScope();
  el.innerHTML = nextProblemsKpis(stItems, liveDelayed) +
    makeSection("conflicts-st", isNextUi() ? t("nextPsStations") : t("problemsTitleConflicts") + " — " + t("colStation"), stItems.length, stHtml) +
    makeSection("conflicts-rt", isNextUi() ? t("nextPsRoutes") : t("problemsTitleConflicts") + " — " + t("tabRoutes"), rtItems.length, rtHtml) +
    makeSection("delayed-now", isNextUi() ? t("nextPsLateNow") : t("problemsTitleDelayed"), liveDelayed.length, liveDelayedHtml) +
    makeSection("delays", isNextUi() ? t("nextPsAvg") : t("problemsTitleDelays"), byDelayPaired.length, delayHtml);

  el.querySelectorAll(".problems-section-header").forEach((h) => {
    h.addEventListener("click", () => document.getElementById(h.dataset.toggle)?.classList.toggle("open"));
  });
  el.querySelectorAll("[data-goto-station]").forEach((card) => {
    card.addEventListener("click", (ev) => {
      if (ev.target.closest("[data-route-id]") || ev.target.closest("[data-fix-station]")) return;
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
  // Кнопка «Применить сдвиг»: автоустранение конфликтов станции
  el.querySelectorAll("[data-fix-station]").forEach((btn) => {
    btn.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      const sid = btn.dataset.fixStation;
      btn.disabled = true;
      const prevText = btn.textContent;
      btn.textContent = "…";
      try {
        const { shifted } = await autoResolveStation(sid);
        btn.textContent = shifted > 0 ? t("problemsFixDone", { n: shifted }) : t("problemsFixNone");
        // Пересканируем сеть, чтобы счётчики обновились
        _conflictScan.at = 0;
        setTimeout(() => renderProblems(), 400);
      } catch (e) {
        btn.textContent = t("problemsFixNone");
        btn.disabled = false;
      }
    });
  });
  el.querySelectorAll("[data-route-id]").forEach((card) => {
    card.addEventListener("click", () => openRouteModal(card.dataset.routeId));
  });
  // Все секции стартуют свёрнутыми — в свёрнутом виде видна первая строка
  // (первая карточка), при раскрытии показываются остальные.
}

// ============================================================
// Десктоп-уведомления: конфликты платформ (по всей сети) и опоздания
// ============================================================
function _notifCooldownMs() {
  return Math.max(1, Number(settings.notifCooldownMin) || 5) * 60000;
}
// Разрешение на уведомления. При отсутствии — тихо запрашиваем один раз.
function _notifPermReady() {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "default") { Notification.requestPermission().catch(() => {}); return false; }
  return Notification.permission === "granted";
}
// Клик по уведомлению разворачивает приложение (в Electron — через IPC,
// т.к. window.focus() из renderer не поднимает окно поверх других).
function _focusAppWindow() {
  try {
    if (window.electronAPI && typeof window.electronAPI.focusWindow === "function") {
      window.electronAPI.focusWindow();
      return;
    }
  } catch (e) {}
  try { window.focus(); } catch (e) {}
}
function _sendNotification(title, body) {
  try {
    const n = new Notification(title, { body });
    n.onclick = () => { _focusAppWindow(); try { n.close(); } catch (e) {} };
  } catch (e) {}
}

// Состояние уведомлений. Единый интервал (notifCooldownMin) управляет и
// конфликтами, и опозданиями — в один тик могут прийти оба уведомления.
let _lastNotifAt = 0;
let _notifiedConflictStations = new Set();   // станции, о которых уже уведомили
let _delayNotifiedDev = new Map();           // routeId → опоздание (мс) на момент последнего уведомления
const _DELAY_REINCREASE_MS = 60000;          // повторно уведомляем, если опоздание выросло на ≥1 мин

// Готовит текст уведомления о конфликтах (или null, если нового нет).
function _buildConflictNotif(stations) {
  const favStationIds = new Set(favorites.map((f) => f.id));
  let relevant = Array.isArray(stations) ? stations : [];
  if (settings.notifOnlyFav) relevant = relevant.filter((s) => favStationIds.has(s.stationId)); // только избранные станции
  const currentIds = new Set(relevant.map((s) => s.stationId));
  // Разрешившиеся станции забываем — если конфликт вернётся, он снова «новый»
  _notifiedConflictStations = new Set([..._notifiedConflictStations].filter((id) => currentIds.has(id)));
  const newOnes = relevant.filter((s) => !_notifiedConflictStations.has(s.stationId));
  if (!newOnes.length) return null;
  newOnes.forEach((s) => _notifiedConflictStations.add(s.stationId));
  const count = relevant.length;
  return {
    title: t("notifConflictTitle"),
    body: count === 1 ? t("notifConflictBodyOne", { station: relevant[0].stationName })
                      : t("notifConflictBodyMany", { count }),
  };
}

// Готовит текст уведомления об опозданиях (или null). «Новым» считается
// маршрут, о котором ещё не уведомляли ЛИБО чьё опоздание выросло с прошлого
// уведомления на ≥1 мин.
async function _buildDelayNotif() {
  const thr = Math.max(1, Number(settings.delayThresholdMin) || 5);
  let delays;
  try {
    const res = await fetch(`/api/analytics/live-delays?thresholdMin=${thr}`);
    if (!res.ok) return null;
    delays = await res.json();
  } catch (e) { return null; }
  if (!Array.isArray(delays)) return null;
  const favRouteIds = new Set(favoriteRoutes.map((r) => r.id));
  let relevant = settings.notifOnlyFav ? delays.filter((d) => favRouteIds.has(d.routeId)) : delays;
  const currentIds = new Set(relevant.map((d) => String(d.routeId)));
  for (const rid of [..._delayNotifiedDev.keys()]) if (!currentIds.has(rid)) _delayNotifiedDev.delete(rid);
  const worthy = relevant.filter((d) => {
    const prev = _delayNotifiedDev.get(String(d.routeId));
    return prev === undefined || d.maxDeviationMs >= prev + _DELAY_REINCREASE_MS;
  });
  if (!worthy.length) return null;
  relevant.forEach((d) => _delayNotifiedDev.set(String(d.routeId), d.maxDeviationMs));
  const worst = relevant.slice().sort((a, b) => b.maxDeviationMs - a.maxDeviationMs)[0];
  const worstMin = Math.round(worst.maxDeviationMs / 60000);
  return {
    title: t("notifDelayTitle"),
    body: relevant.length === 1
      ? t("notifDelayBody", { route: worst.routeNumber || worst.routeName, min: worstMin })
      : t("notifDelayBodyMany", { count: relevant.length, route: worst.routeNumber || worst.routeName, min: worstMin }),
  };
}

// Фоновая проверка: единый интервал; при срабатывании шлём до 2 уведомлений
// (конфликты и/или опоздания) одновременно.
async function runNotificationChecks() {
  if (!settings.notifConflict && !settings.notifDelay) return;
  if (!_notifPermReady()) return;
  if (Date.now() - _lastNotifAt < _notifCooldownMs()) return;

  let conflictNotif = null, delayNotif = null;
  if (settings.notifConflict) {
    try { conflictNotif = _buildConflictNotif(await runFullConflictScan()); } catch (e) {}
  }
  if (settings.notifDelay) {
    try { delayNotif = await _buildDelayNotif(); } catch (e) {}
  }
  if (!conflictNotif && !delayNotif) return;
  _lastNotifAt = Date.now();
  if (conflictNotif) _sendNotification(conflictNotif.title, conflictNotif.body);
  if (delayNotif) _sendNotification(delayNotif.title, delayNotif.body);
}

// Блок «Уведомления» на вкладке настроек. Вызывается один раз из init().
function initNotifSettings() {
  const conflictCb = document.getElementById("notifConflictCb");
  const delayCb = document.getElementById("notifDelayCb");
  const onlyFavCb = document.getElementById("notifOnlyFavCb");
  const cooldownSel = document.getElementById("notifCooldownSelect");
  const delayThrSel = document.getElementById("notifDelayThreshold");
  const permHint = document.getElementById("notifPermissionHint");

  // Бета-обновления. Инициализируем ДО раннего return ниже: галочка живёт в
  // своём блоке настроек и не должна пропадать, если разметки уведомлений нет.
  const betaCb = document.getElementById("betaUpdatesToggle");
  if (betaCb) {
    betaCb.checked = !!settings.betaUpdates;
    if (!betaCb._hasListener) {
      betaCb._hasListener = true;
      betaCb.addEventListener("change", () => {
        settings.betaUpdates = betaCb.checked;
        savePrefsToServer();
        // Применяем сразу, без перезапуска: main-процесс переключает
        // allowPrerelease у electron-updater и проверяет обновления заново.
        try { window.electronAPI?.setBetaUpdates?.(betaCb.checked); } catch (e) {}
      });
    }
  }

  // Экспериментальный интерфейс — тоже до раннего return, по той же причине.
  const uiNextCb = document.getElementById("experimentalUiToggle");
  if (uiNextCb) {
    uiNextCb.checked = !!settings.experimentalUi;
    if (!uiNextCb._hasListener) {
      uiNextCb._hasListener = true;
      uiNextCb.addEventListener("change", () => {
        settings.experimentalUi = uiNextCb.checked;
        applyExperimentalUi();
        savePrefsToServer();
      });
    }
  }

  if (!conflictCb || !onlyFavCb || !cooldownSel) return;

  conflictCb.checked = !!settings.notifConflict;
  if (delayCb) delayCb.checked = !!settings.notifDelay;
  onlyFavCb.checked = !!settings.notifOnlyFav;
  cooldownSel.value = String(settings.notifCooldownMin || 5);
  if (delayThrSel) {
    // Старое сохранённое значение может не быть в новом списке — приводим к
    // ближайшему допустимому (иначе селект отобразился бы пустым).
    const allowed = [...delayThrSel.options].map((o) => o.value);
    let v = String(settings.delayThresholdMin || 5);
    if (!allowed.includes(v)) { v = "5"; settings.delayThresholdMin = 5; }
    delayThrSel.value = v;
  }

  function updatePermHint() {
    if (!permHint) return;
    const wantNotif = settings.notifConflict || settings.notifDelay;
    if (wantNotif && typeof Notification !== "undefined" && Notification.permission === "denied") {
      permHint.textContent = t("notifPermissionDenied");
    } else {
      permHint.textContent = "";
    }
  }
  function requestPermIfNeeded() {
    if ((settings.notifConflict || settings.notifDelay) && typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().then(updatePermHint).catch(() => {});
    }
  }

  if (!conflictCb._hasListener) {
    conflictCb._hasListener = true;
    conflictCb.addEventListener("change", () => {
      settings.notifConflict = conflictCb.checked;
      requestPermIfNeeded();
      updatePermHint();
      savePrefsToServer();
    });
  }
  if (delayCb && !delayCb._hasListener) {
    delayCb._hasListener = true;
    delayCb.addEventListener("change", () => {
      settings.notifDelay = delayCb.checked;
      requestPermIfNeeded();
      updatePermHint();
      savePrefsToServer();
    });
  }
  if (!onlyFavCb._hasListener) {
    onlyFavCb._hasListener = true;
    onlyFavCb.addEventListener("change", () => {
      settings.notifOnlyFav = onlyFavCb.checked;
      savePrefsToServer();
    });
  }
  if (!cooldownSel._hasListener) {
    cooldownSel._hasListener = true;
    cooldownSel.addEventListener("change", () => {
      settings.notifCooldownMin = Number(cooldownSel.value) || 5;
      savePrefsToServer();
    });
  }
  if (delayThrSel && !delayThrSel._hasListener) {
    delayThrSel._hasListener = true;
    delayThrSel.addEventListener("change", () => {
      settings.delayThresholdMin = Number(delayThrSel.value) || 3;
      savePrefsToServer();
    });
  }
  updatePermHint();
}

// Экспериментальный UI — только оформление: класс ui-next на <html> включает
// ui-next.css (боковое меню, новая палитра, шрифты). DOM и логика те же, что
// в классическом виде. При запуске класс ставит скрипт в <head> index.html,
// чтобы не мелькал старый вид; здесь — переключение из настроек и после загрузки prefs.
function applyExperimentalUi() {
  document.documentElement.classList.toggle("ui-next", !!settings.experimentalUi);
  const cb = document.getElementById("experimentalUiToggle");
  if (cb) cb.checked = !!settings.experimentalUi;
  applyI18n(); // подписи меню различаются между видами (data-i18n-next); внутри — updateNextPageTitle
  renderNextFavorites();
  // метки маршрутов по умолчанию, табло, списки — в новом виде другие
  try { rerenderRouteMarkers(); } catch (e) {}
}
// Шапка нового UI: крошки «Главная → (Расписания →) Раздел», заголовок, подзаголовок.
// Заголовок — подпись раздела, у табло станции — имя станции (как в макете).
function updateNextPageTitle() {
  const titleEl = document.getElementById("nextPageTitle");
  const panel = document.querySelector(".tab-panel.active");
  if (!titleEl || !panel) return;
  syncNextLayout();
  const tab = document.body.dataset.nxTab || "";
  const btn = tab === "scheme"
    ? document.getElementById("nextNavScheme")
    : document.querySelector(`.tab-btn[data-tab="${panel.id.slice(4)}"]:not([data-board-mode])`);
  const label = btn ? (btn.querySelector(".tab-label") || btn).textContent.trim() : "";
  let title = label;
  if (tab === "schedule" && state.currentStationId) {
    const st = state.stations.find((s) => s.id === state.currentStationId);
    if (st) title = st.name;
  }
  titleEl.textContent = title;

  const crumbs = document.getElementById("nextCrumbs");
  if (crumbs) {
    crumbs.innerHTML = "";
    const add = (text, goto) => {
      if (crumbs.childNodes.length) {
        const sep = document.createElement("span");
        sep.setAttribute("aria-hidden", "true");
        sep.textContent = "→";
        crumbs.appendChild(sep);
      }
      const el = document.createElement(goto ? "button" : "span");
      el.textContent = text;
      if (goto) { el.type = "button"; el.addEventListener("click", () => switchToTab(goto)); }
      else el.className = "cur";
      crumbs.appendChild(el);
    };
    add(t("nextHome"), "schedule");
    if (tab === "schedule" || tab === "graph") add(t("nextGroupSchedules"), "schedule");
    add(label, null);
  }

  const leadEl = document.getElementById("nextPageLead");
  if (leadEl) {
    let lead = "";
    if (tab === "schedule") lead = (document.getElementById("scheduleMeta")?.textContent || "").trim();
    else if (tab === "graph") lead = nextGraphLead();
    else if (tab === "routes") lead = nextRoutesLead();
    else if (tab === "problems") lead = t("nextProblemsLead");
    else if (tab === "settings") lead = t("nextSettingsLead");
    else if (tab === "scheme" || tab === "boards") {
      const mode = document.getElementById(tab === "scheme" ? "boardModeScheme" : "boardModeTimetable");
      lead = (mode?.querySelector(":scope > p.hint:first-child")?.textContent || "").trim();
    } else lead = (panel.querySelector(":scope > p.hint:first-child")?.textContent || "").trim();
    leadEl.textContent = lead;
    leadEl.title = lead;
    // длинный подзаголовок прячется в «?» рядом с инструментами шапки
    const help = document.getElementById("nextHelp");
    if (help) {
      document.getElementById("nextHelpPop").textContent = lead;
      help.hidden = !lead;
    }
  }
  updateNextProblemsCount();
  nextLocalizeSegments();
}
// Переключатель «Табло / Схема сети» меняет вводную подсказку редактора
document.addEventListener("click", (e) => {
  if (e.target.closest && e.target.closest(".board-mode-btn")) setTimeout(updateNextPageTitle, 0);
});
// Строку о станции пишет loadSchedule — следим за ней, чтобы подзаголовок шапки не отставал
{
  const meta = document.getElementById("scheduleMeta");
  if (meta) new MutationObserver(updateNextPageTitle).observe(meta, { childList: true, characterData: true, subtree: true });
}

// ============================================================
// Новый интерфейс (ui-next): каркас и экраны по макетам Claude Design.
// Спецификация — docs/ui-next-spec.md. Всё здесь срабатывает только при
// html.ui-next; классический вид не меняется.
// ============================================================
function isNextUi() { return document.documentElement.classList.contains("ui-next"); }

// Инструменты разделов живут в своих вкладках (классика), а в новом виде
// переезжают в шапку и панели. Узел переносится целиком (с обработчиками),
// на старом месте остаётся метка-комментарий, по ней он возвращается.
const _nxMoved = [];
function nxMove(node, target) {
  if (!node || !target || node.parentNode === target) return;
  const mark = document.createComment("nx");
  node.parentNode.insertBefore(mark, node);
  _nxMoved.push({ node, mark });
  target.appendChild(node);
}
function nxRestoreAll() {
  while (_nxMoved.length) {
    const { node, mark } = _nxMoved.pop();
    if (mark.parentNode) { mark.parentNode.insertBefore(node, mark); mark.remove(); }
  }
}
// Мелкие пояснения карточек настроек прячутся в «?» в углу карточки: кнопка
// ставится перед абзацем, а CSS показывает абзац всплывашкой по наведению
// (текст остаётся в самом абзаце, так что перевод интерфейса продолжает работать)
const NX_FOLD_HINTS = ["#serverUrlHint", '[data-i18n="settingsNote"]', '[data-i18n="experimentalUiHint"]',
  '[data-i18n="routeMarkersHint"]', '[data-i18n="betaUpdatesHint"]', '[data-i18n="diagReportHint"]'];
function nxFoldHints() {
  document.querySelectorAll(NX_FOLD_HINTS.map((s) => ".settings-block > " + s).join(",")).forEach((p) => {
    if (p._nxFolded) return;
    p._nxFolded = true;
    p.classList.add("nx-help-src");
    const b = document.createElement("button");
    b.type = "button";
    b.className = "nx-help-btn nx-help-abs";
    b.textContent = "?";
    p.parentNode.insertBefore(b, p);
  });
}
function syncNextLayout() {
  nxRestoreAll();
  const panel = document.querySelector(".tab-panel.active");
  const tab = panel ? panel.id.slice(4) : "";
  const schemeMode = tab === "board" && document.getElementById("boardModeScheme")?.style.display !== "none";
  document.body.dataset.nxTab = tab === "board" ? (schemeMode ? "scheme" : "boards") : tab;
  const next = isNextUi();
  // «Генераторы табло» и «Схема сети» — два пункта меню одной вкладки «Редактор»
  const boardBtn = document.querySelector('.tab-btn[data-tab="board"]:not([data-board-mode])');
  const schemeBtn = document.getElementById("nextNavScheme");
  if (boardBtn) boardBtn.classList.toggle("active", tab === "board" && (!next || !schemeMode));
  if (schemeBtn) schemeBtn.classList.toggle("active", next && schemeMode);
  if (!next) return;
  nxFoldHints();
  nxMove(panel && panel.querySelector(":scope > .controls"), document.getElementById("nextHeadTools"));
  if (tab === "schedule") nxMove(document.getElementById("toggleFavoriteStationBtn"), document.getElementById("nextTitleExtra"));
  const zoom = document.getElementById("nextDashZoom");
  ["dashZoomOut", "dashZoomValue", "dashZoomIn"].forEach((id) => nxMove(document.getElementById(id), zoom));
  nxMove(document.getElementById("resetDashOverridesBtn"), document.getElementById("nextDashReset"));
  nxMove(document.getElementById("graphLegend"), document.getElementById("nextGraphLegendSlot"));
  // без полосы окна Electron (браузер) статус MTR — внизу меню, а не в шапке
  if (!document.documentElement.classList.contains("has-titlebar")) nxMove(document.getElementById("statusBadge"), document.querySelector("nav.tabs"));
  document.querySelectorAll("[data-next-goto]").forEach((b) => b.classList.toggle("on", b.dataset.nextGoto === tab));
  // карточка маршрута пристыкована справа под шапкой — её верх = низ шапки
  const top = document.querySelector(".topbar");
  if (top) document.documentElement.style.setProperty("--nx-top", Math.round(top.getBoundingClientRect().bottom + 8) + "px");
}
window.addEventListener("resize", () => { if (isNextUi()) syncNextLayout(); });

// Подписи окон времени («3 ч», «Сутки») — по языку
function nextLocalizeSegments() {
  document.querySelectorAll("#nextDashWindow [data-hours], #nextGraphWindow [data-hours]").forEach((b) => {
    const h = Number(b.dataset.hours);
    b.textContent = h === 24 ? t("nextDay") : t("nextHours", { n: h });
  });
  const ac = document.getElementById("graphFromAC"), bc = document.getElementById("graphToAC");
  if (ac) ac.dataset.tag = "A";
  if (bc) bc.dataset.tag = currentLang() === "ru" ? "Б" : "B";
}

// Пункт меню «Схема сети» и «Генераторы табло» включают нужный режим редактора
document.querySelectorAll('.tab-btn[data-tab="board"]').forEach((btn) => {
  btn.addEventListener("click", () => {
    if (!isNextUi()) return;
    const id = btn.dataset.boardMode === "scheme" ? "boardModeSchemeBtn" : "boardModeTimetableBtn";
    document.getElementById(id)?.click();
    setTimeout(updateNextPageTitle, 0);
  });
});
// Сегмент «Табло станции / График движения» в шапке
document.querySelectorAll("[data-next-goto]").forEach((b) => b.addEventListener("click", () => switchToTab(b.dataset.nextGoto)));
// Свернуть / развернуть панель фильтров
document.querySelectorAll("[data-nx-collapse]").forEach((b) => {
  b.addEventListener("click", () => document.getElementById(b.dataset.nxCollapse)?.classList.toggle("nx-collapsed"));
});
// Ctrl+K — в поле поиска текущего раздела
document.addEventListener("keydown", (e) => {
  // по физической клавише: с русской раскладкой e.key = «л»
  if (!isNextUi() || !(e.ctrlKey || e.metaKey) || e.altKey || (e.code !== "KeyK" && e.key.toLowerCase() !== "k")) return;
  const input = document.querySelector('#nextHeadTools input[type="text"]')
    || document.querySelector(".tab-panel.active input[type='text'], .tab-panel.active input[type='search']");
  if (!input) return;
  e.preventDefault();
  input.focus();
  input.select();
});

// Счётчик у пункта «Задержки и проблемы» — станции с конфликтами (обход сети + просмотренные)
function updateNextProblemsCount() {
  const el = document.getElementById("nextProblemsCount");
  if (!el) return;
  let n = 0;
  try {
    const ids = new Set(_conflictScan.stations.map((s) => s.stationId));
    for (const s of (state._conflictedStations || new Map()).values()) if (s.conflictCount > 0) ids.add(s.stationId);
    n = ids.size;
  } catch (e) {}
  el.textContent = n > 0 ? String(n) : "";
}

// Короткие бейджи линий (мотив «срез 60°» из макета) — для избранного и групп маршрутов
function nxBadge(color, number, extraCls, title) {
  const c = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(String(color || "")) ? color : "#8b8f9a";
  const ink = window.RouteMarkers && RouteMarkers.inkFor ? RouteMarkers.inkFor(c) : "#fff";
  const tip = title ? ` title="${escapeHtml(title)}"` : "";
  return `<span class="nx-rb${extraCls ? " " + extraCls : ""}" style="background:${c};color:${ink}"${tip}>${escapeHtml(String(number || "•"))}</span>`;
}
// Подпись бейджа: номер, а у маршрута без номера — первое слово названия; не длиннее 7 знаков
// (полное название вроде «БТВ1 - ММС кроме ЛГ БО ТР» раздувало бейдж и залезало на соседние колонки)
function nxShortLabel(number, name) {
  const w = number ? String(number).trim() : String(name || "").trim().split(/[\s|]+/)[0] || "";
  return w.length > 7 ? w.slice(0, 6) + "…" : w;
}
// Для стопки бейджей: маршруты с одинаковой видимой подписью и цветом («БТВ1 …» ×3) — один бейдж
function nxUniqBadges(routes) {
  const seen = new Set();
  return routes.filter((r) => { const k = nxShortLabel(r.number, r.name) + r.color; if (seen.has(k)) return false; seen.add(k); return true; });
}
function nxRouteBadge(r) {
  const full = [r.number, r.name].filter(Boolean).join(" · ");
  return nxBadge(r.color, nxShortLabel(r.number, r.name), "", full);
}
function nxMoreBadge(n) { return `<span class="nx-rb more">+${n}</span>`; }
// Маршруты, проходящие через станцию (уникальные по номеру+цвету — прямой и обратный один бейдж)
function nxRoutesAtStation(stationId) {
  const seen = new Set(), out = [];
  for (const r of state.routes || []) {
    if (r.isDraft || !Array.isArray(r.stationIds) || !r.stationIds.includes(stationId)) continue;
    const key = (r.number || r.name) + "|" + r.color;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

// ---------- Табло станции ----------
// Окно времени: масштаб, при котором N часов помещаются в видимую ширину табло
function nextSetDashWindow(hours) {
  const gs = document.getElementById("gridScroll");
  if (!gs || !gs.clientWidth) return;
  state.dashPxPerHour = Math.max(20, Math.min(1100, Math.round(gs.clientWidth / hours)));
  const v = document.getElementById("dashZoomValue");
  if (v) v.textContent = `${Math.round((state.dashPxPerHour / ZOOM_BASE_PX_PER_HOUR) * 100)}%`;
  renderDashboardFromCache();
  scrollToNow();
}
function nextSetGraphWindow(hours) {
  const gw = document.getElementById("graphWrap");
  if (!gw || !gw.clientWidth) return;
  state.graphPxPerHour = Math.max(20, Math.min(1100, Math.round(gw.clientWidth / hours)));
  const v = document.getElementById("graphZoomValue");
  if (v) v.textContent = `${Math.round((state.graphPxPerHour / ZOOM_BASE_PX_PER_HOUR) * 100)}%`;
  renderGraphFromCache();
  scrollGraphToNow();
}
// Подсветка сегмента окна, если текущий масштаб ему соответствует
function nextMarkWindow(segId, scrollId, pxPerHour) {
  const seg = document.getElementById(segId), sc = document.getElementById(scrollId);
  if (!seg || !sc || !sc.clientWidth) return;
  const hoursVisible = sc.clientWidth / pxPerHour;
  seg.querySelectorAll("[data-hours]").forEach((b) => {
    b.classList.toggle("on", Math.abs(hoursVisible - Number(b.dataset.hours)) / Number(b.dataset.hours) < 0.12);
  });
}
document.querySelectorAll("#nextDashWindow [data-hours]").forEach((b) => b.addEventListener("click", () => nextSetDashWindow(Number(b.dataset.hours))));
document.querySelectorAll("#nextGraphWindow [data-hours]").forEach((b) => b.addEventListener("click", () => nextSetGraphWindow(Number(b.dataset.hours))));
document.getElementById("nextDashNow")?.addEventListener("click", () => scrollToNow());
document.getElementById("nextGraphNow")?.addEventListener("click", () => scrollGraphToNow());

// Пары конфликтов на табло: из state.conflictDetails (ключ записи → партнёры)
function nextDashConflictPairs() {
  const entries = state.currentDashboardEntries || [];
  const byKey = new Map(entries.map((e) => [e.entryKey, e]));
  const pairs = [], seen = new Set();
  for (const [key, partners] of state.conflictDetails || new Map()) {
    const a0 = byKey.get(key);
    if (!a0) continue;
    for (const p of partners) {
      const b0 = byKey.get(p.entryKey) || p;
      const [a, b] = a0.effArrival <= b0.effArrival ? [a0, b0] : [b0, a0];
      const id = a.entryKey + "|" + b.entryKey;
      if (seen.has(id)) continue;
      seen.add(id);
      pairs.push({ a, b });
    }
  }
  // ближайшие к «сейчас» — первыми (по кругу суток)
  const now = getNowMsOfDay();
  const ahead = (ms) => ((ms - now + 3600000) % MS_PER_DAY + MS_PER_DAY) % MS_PER_DAY;
  return pairs.sort((x, y) => ahead(x.a.effArrival) - ahead(y.a.effArrival));
}
function nextRenderBoardBar() {
  if (!isNextUi()) return;
  const entries = state.currentDashboardEntries || [];
  const pairs = nextDashConflictPairs();
  const late = entries.filter((e) => e.deviationMs > 60000).length;
  const drafts = new Set(entries.filter((e) => e.isDraft).map((e) => e.routeId)).size;
  const set = (id, n, key) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = n > 0 ? t(key, { n }) : "";
  };
  set("nextDashConflicts", pairs.length, "nextChipConflicts");
  set("nextDashLate", late, "nextChipLate");
  set("nextDashDrafts", drafts, "nextChipDrafts");
  // сетка часов на строках платформ (фон .dashboard-grid в ui-next.css)
  document.getElementById("dashboardGrid")?.style.setProperty("--nx-hour", state.dashPxPerHour + "px");
  const off = currentTzOffsetMin();
  const tz = document.getElementById("nextBoardTz");
  if (tz) tz.textContent = t("nextLocalTime", { tz: "UTC" + (off >= 0 ? "+" : "−") + Math.abs(off / 60) });
  nextMarkWindow("nextDashWindow", "gridScroll", state.dashPxPerHour);
  nextRenderConflicts(pairs);
}
// Панель «Конфликты» справа от табло: время, платформа, интервал, сдвиг одной кнопкой
function nextRenderConflicts(pairs) {
  const list = document.getElementById("nextConflictList");
  const cnt = document.getElementById("nextConflictsCount");
  if (!list) return;
  if (cnt) cnt.textContent = pairs.length ? String(pairs.length) : "";
  const minMs = (state.minIntervalMin || 0) * 60000;
  if (!pairs.length) {
    list.innerHTML = `<p class="nx-empty">${escapeHtml(t("nextNoConflicts"))}</p>`;
    return;
  }
  list.innerHTML = pairs.slice(0, 40).map(({ a, b }, i) => {
    const aEnd = Math.max(a.effDeparture ?? a.effArrival, a.effArrival + (a.dwellTimeMs || 0));
    const gapMs = b.effArrival - aEnd;
    const needMin = Math.max(1, Math.ceil((minMs - gapMs) / 60000));
    const gap = gapMs <= 0 ? t("nextOverlap") : t("nextGap", { gap: formatSecondsShort(Math.round(gapMs / 1000)) });
    const r1 = a.routeNumber || a.routeName || "?", r2 = b.routeNumber || b.routeName || "?";
    return `<div class="nx-ccard">
      <div class="nx-ccard-top"><span><i class="nx-dot bad"></i><b class="mono">${formatLocal(a.effArrival)}</b> ${escapeHtml(t("nextPlatformN", { p: a.effPlatform }))}</span><span class="mono nx-gap">${escapeHtml(gap)}</span></div>
      <div class="nx-ccard-text">${escapeHtml(t("nextConflictText", { r1, r2, min: state.minIntervalMin }))}</div>
      <div class="nx-ccard-btns"><button type="button" class="nx-raised" data-nx-shift="${i}" data-min="${needMin}">${escapeHtml(t("nextShiftBy", { r: r2, n: needMin }))}</button><button type="button" class="nx-ghost" data-nx-show="${i}">${escapeHtml(t("nextShow"))}</button></div>
    </div>`;
  }).join("");
  list.querySelectorAll("[data-nx-shift]").forEach((btn) => btn.addEventListener("click", () => {
    const { b } = pairs[Number(btn.dataset.nxShift)];
    pushUndoSnapshot();
    setOverride(b.routeId, b.tripOriginMs, getOverride(b.routeId, b.tripOriginMs) + Number(btn.dataset.min) * 60000);
    renderDashboardFromCache();
    renderGraphFromCache();
  }));
  list.querySelectorAll("[data-nx-show]").forEach((btn) => btn.addEventListener("click", () => {
    const { a, b } = pairs[Number(btn.dataset.nxShow)];
    state.chainHl = new Set([`${a.routeId}:${a.tripOriginMs}`, `${b.routeId}:${b.tripOriginMs}`]);
    renderDashboardFromCache();
    const gs = document.getElementById("gridScroll");
    if (gs) {
      const x = (toDisplayMs(a.effArrival) / MS_PER_DAY) * dashTimelineWidth() - gs.clientWidth / 3;
      gs.scrollLeft = Math.max(0, x);
      const rs = document.getElementById("rulerScroll");
      if (rs) rs.scrollLeft = gs.scrollLeft;
    }
  }));
}
document.getElementById("nextResolveAll")?.addEventListener("click", async (e) => {
  if (!state.currentStationId) return;
  const btn = e.currentTarget;
  btn.disabled = true;
  try {
    await autoResolveStation(state.currentStationId);
    renderDashboardFromCache();
    renderGraphFromCache();
  } finally { btn.disabled = false; }
});
// Подпись строки платформы: тип транспорта и главное направление по рейсам платформы
function nextPlatformMeta(list) {
  if (!list || !list.length) return { kind: "", dest: "" };
  const top = (arr) => {
    const m = new Map();
    arr.filter(Boolean).forEach((v) => m.set(v, (m.get(v) || 0) + 1));
    return [...m.entries()].sort((x, y) => y[1] - x[1]).map((x) => x[0]);
  };
  const kinds = top(list.map((e) => e.routeType)).map(routeTypeName);
  const dests = top(list.map((e) => {
    const r = state.routesById.get(e.routeId) || {};
    return r.terminus || (r.lastStationId && state.stations.find((s) => s.id === r.lastStationId)?.name) || "";
  }));
  return { kind: kinds.slice(0, 2).join(", "), dest: dests.length > 1 ? `${dests[0]} +${dests.length - 1}` : (dests[0] || "") };
}
// Флажок текущего времени на линейке (мятный, срез 60°)
function nextPositionNowFlag() {
  const ruler = document.getElementById("dashboardRuler");
  if (!ruler) return;
  let flag = document.getElementById("dashNowFlag");
  if (!flag || flag.parentNode !== ruler) {
    flag = document.createElement("span");
    flag.id = "dashNowFlag";
    flag.className = "next-only nx-now-flag";
    ruler.appendChild(flag);
  }
  const nowMs = getNowMsOfDay();
  flag.textContent = formatLocal(nowMs);
  flag.style.left = (toDisplayMs(nowMs) / MS_PER_DAY) * dashTimelineWidth() + "px";
  const after = document.getElementById("nextNearestAfter");
  if (after) after.textContent = t("nextAfter", { time: formatLocal(nowMs) });
}
setInterval(() => { if (isNextUi()) nextPositionNowFlag(); }, 30000);

// ---------- График движения ----------
function nextGraphLead() {
  const d = state.lastGraphData;
  if (!d || !Array.isArray(d.routes)) return (document.querySelector("#tab-graph > p.hint:first-child")?.textContent || "").trim();
  const stations = new Set();
  d.routes.forEach((r) => (r.trips || []).forEach((tr) => (tr.points || []).forEach((p) => p.stationId && stations.add(p.stationId))));
  return t("nextGraphLead", { s: stations.size, r: d.routes.length });
}
function nextRenderGraphBar() {
  if (!isNextUi()) return;
  const cs = state._graphConflicts || [];
  const st = cs.filter((c) => c.kind === "station").length, ov = cs.length - st;
  const el = document.getElementById("nextGraphConflicts");
  if (el) el.textContent = cs.length ? t("nextGraphChip", { c: st, o: ov }) : "";
  nextMarkWindow("nextGraphWindow", "graphWrap", state.graphPxPerHour);
  const lead = document.getElementById("nextPageLead");
  if (lead && document.body.dataset.nxTab === "graph") lead.textContent = nextGraphLead();
  if (state._nxTrip) nextShowTrip(state._nxTrip, true);
}
document.getElementById("nextShowTurnLinks")?.addEventListener("change", (e) => {
  document.getElementById("graphWrap")?.classList.toggle("nx-hide-turn", !e.target.checked);
});
document.getElementById("nextTripClose")?.addEventListener("click", () => { state._nxTrip = null; nextShowTrip(null); });
// Панель «Рейс»: выбранная линия поезда — остановки, время в пути, конфликты и решения.
// sel = { routeId, t0 }; ищем рейс заново в state.graphTripRefs (после перерисовки индексы другие)
function nextShowTrip(sel, quiet) {
  const body = document.getElementById("nextTripBody");
  if (!body) return;
  const ref = sel && (state.graphTripRefs || []).find((r) => r.route.routeId === sel.routeId && r.trip.tripOriginMs === sel.t0);
  if (!ref) {
    body.innerHTML = `<p class="nx-empty">${escapeHtml(t(quiet && sel ? "nextTripGone" : "nextTripHint"))}</p>`;
    return;
  }
  const route = ref.route;
  const pts = (ref.effPoints || []).slice().sort((a, b) => a.arrivalMs - b.arrivalMs);
  const first = pts[0], last = pts[pts.length - 1];
  const dep = first ? (first.departureMs ?? first.arrivalMs) : null;
  const travelMin = first && last ? Math.round((last.arrivalMs - dep) / 60000) : 0;
  const nameOf = (p) => p.stationName || state.stations.find((s) => s.id === p.stationId)?.name || p.stationId || "—";
  const nowMs = getNowMsOfDay();
  const dir = first && last ? `${nameOf(first)} → ${nameOf(last)}` : "";
  const stops = pts.map((p) => {
    const passed = normalizeMs(p.arrivalMs) < nowMs;
    return `<div class="nx-stop${passed ? " passed" : ""}" style="--c:${/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(String(route.color || "")) ? route.color : "#8b8f9a"}"><i></i><span>${escapeHtml(nameOf(p))}</span><span class="mono">${formatLocal(normalizeMs(p.arrivalMs))}</span></div>`;
  }).join("");
  const mine = (x) => x && x.routeId === route.routeId && x.t0 === ref.trip.tripOriginMs;
  const cs = (state._graphConflicts || []).filter((c) => mine(c.a) || mine(c.b));
  const minMs = (state.minIntervalMin || 0) * 60000;
  const conflicts = cs.map((c, i) => {
    const other = mine(c.a) ? c.b : c.a;
    let btns = "";
    if (c.kind === "station" && c.a.end != null) {
      const need = Math.max(1, Math.ceil((minMs - (c.b.arr - c.a.end)) / 60000));
      btns = `<div class="nx-ccard-btns"><button type="button" class="nx-raised" data-nx-tshift="${i}" data-who="other" data-min="${need}">${escapeHtml(t("nextShiftShort", { r: other.routeNumber || "?", n: "+" + need }))}</button><button type="button" class="nx-ghost" data-nx-tshift="${i}" data-who="me" data-min="${-need}">${escapeHtml(t("nextShiftTrip", { n: "−" + need }))}</button></div>`;
    }
    return `<div class="nx-ccard"><div class="nx-ccard-top"><span><i class="nx-dot ${c.kind === "station" ? "bad" : "warn diamond"}"></i><b>${escapeHtml(c.kind === "station" ? t("nextConflictAtStation") : t("nextOvertake"))}</b></span></div>
      <div class="nx-ccard-text">${escapeHtml(c.problem || "")}</div><div class="nx-ccard-fix">${escapeHtml(c.solution || "")}</div>${btns}</div>`;
  }).join("");
  body.innerHTML = `
    <div class="nx-sec">
      <div class="nx-trip-head">${nxBadge(route.color, nxShortLabel(route.routeNumber, route.routeName), "lg", route.routeName)}<span><b>${escapeHtml(dir)}</b><small>${escapeHtml(routeTypeName(route.type))} · ${escapeHtml(t("nextDepShort", { t: dep != null ? formatLocal(normalizeMs(dep)) : "—" }))} · ${escapeHtml(t("nextTravel", { n: travelMin }))}</small></span></div>
      <div class="nx-row-btns"><button type="button" class="nx-raised" id="nextTripCard">${escapeHtml(t("nextRouteCard"))}</button><button type="button" class="nx-raised" id="nextTripChain">${escapeHtml(t("nextChain"))}</button></div>
    </div>
    <div class="nx-sec"><h4>${escapeHtml(t("modalStops"))}</h4><div class="nx-stops">${stops}</div></div>
    <div class="nx-sec last"><h4>${escapeHtml(t("nextTripConflicts"))} <span class="bad">${cs.length || ""}</span></h4>${conflicts || `<p class="nx-empty">${escapeHtml(t("nextNoConflicts"))}</p>`}</div>`;
  body.querySelector("#nextTripCard").addEventListener("click", () => openRouteModal(route.routeId));
  body.querySelector("#nextTripChain").addEventListener("click", () => toggleChainHighlight(route.routeId, ref.trip.tripOriginMs));
  body.querySelectorAll("[data-nx-tshift]").forEach((b) => b.addEventListener("click", () => {
    const c = cs[Number(b.dataset.nxTshift)];
    const who = b.dataset.who === "me" ? { routeId: route.routeId, t0: ref.trip.tripOriginMs } : (mine(c.a) ? c.b : c.a);
    pushUndoSnapshot();
    setOverride(who.routeId, who.t0, getOverride(who.routeId, who.t0) + Number(b.dataset.min) * 60000);
    renderGraphFromCache();
    renderDashboardFromCache();
  }));
}

// ---------- Станции и маршруты ----------
function nextRoutesLead() {
  const drafts = (state.routes || []).filter((r) => r.isDraft).length;
  return t("nextRoutesLead", { s: state.stations.length, r: (state.routes || []).length - drafts, d: drafts });
}
// Конфликты по маршрутам: обход сети + просмотренные станции (число станций с конфликтом)
function nextRouteConflictCounts() {
  const by = new Map();
  try {
    const merged = new Map();
    for (const s of _conflictScan.stations) merged.set(s.stationId, s);
    for (const s of (state._conflictedStations || new Map()).values()) merged.set(s.stationId, s);
    for (const s of merged.values()) for (const rid of s.routeIds || []) by.set(rid, (by.get(rid) || 0) + 1);
  } catch (e) {}
  return by;
}
if (!state.nxOpenGroups) state.nxOpenGroups = null; // null = раскрыта первая группа маршрутов
function nextRenderRouteGroups(routes) {
  const box = document.getElementById("nextRouteGroups");
  if (!box || !isNextUi()) return;
  const conf = nextRouteConflictCounts();
  const stName = (id) => state.stations.find((s) => s.id === id)?.name || "";
  const sel = state.lastRouteDetail && document.getElementById("routeModalOverlay")?.style.display !== "none" ? state.lastRouteDetail.id : null;
  const groups = new Map();
  for (const r of routes) {
    const key = r.isDraft ? "~draft" : (r.type || "~other");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  const order = [...groups.keys()].sort((a, b) => {
    if (a === "~draft") return 1;
    if (b === "~draft") return -1;
    const ka = RouteMarkers.KNOWN_TYPES.indexOf(a), kb = RouteMarkers.KNOWN_TYPES.indexOf(b);
    return (ka < 0 ? 99 : ka) - (kb < 0 ? 99 : kb) || a.localeCompare(b);
  });
  if (!state.nxOpenGroups) state.nxOpenGroups = new Set(order.slice(0, 1));
  const iconFor = (key) => key === "~draft" ? "draft" : /bus/.test(key) ? "bus" : /tram|light_rail/.test(key) ? "tram" : /metro/.test(key) ? "metro" : /boat/.test(key) ? "ship" : /cable/.test(key) ? "cable" : /airplane/.test(key) ? "plane" : "rail";
  const devColor = (ms) => ms == null ? "var(--muted)" : Math.abs(ms) >= 90000 ? "#FF97A6" : Math.abs(ms) >= 40000 ? "#FFD08A" : "#D6FFF6";
  const row = (r) => {
    const a = r.analytics;
    const ends = r.firstStationId && r.lastStationId ? `${stName(r.firstStationId)} → ${stName(r.lastStationId)}` : "";
    const c = conf.get(r.id) || 0;
    const avg = a ? a.avgDeviationMs : null;
    const bar = avg == null ? 0 : Math.min(100, (Math.abs(avg) / 150000) * 100);
    return `<div class="nx-item${r.id === sel ? " sel" : ""}" data-route-id="${escapeHtml(r.id)}" tabindex="0">
      <span class="nx-item-name">${routeMarker(r.type, r.color, r.number, "md")}<span><b>${escapeHtml(r.name)}${isFavoriteRoute(r.id) ? ' <i class="nx-star"></i>' : ""}</b><small>${escapeHtml(ends)}</small></span></span>
      <span class="mono r">${r.stopCount ?? "—"}</span>
      <span class="mono" style="color:${devColor(avg)}">${a ? escapeHtml(formatDeviation(avg)) : "—"}</span>
      <span class="nx-bar"><span style="width:${bar.toFixed(0)}%;background:${devColor(avg)}"></span></span>
      <span class="mono r" style="color:${c ? "#FF97A6" : "var(--muted)"}">${c || "—"}</span>
      <i class="nx-chev-r"></i>
    </div>`;
  };
  const head = `<div class="nx-colh"><span>${escapeHtml(t("colLine"))}</span><span class="r">${escapeHtml(t("colStops"))}</span><span>${escapeHtml(t("colAvgDev"))}</span><span></span><span class="r">${escapeHtml(t("nextColConflicts"))}</span><span></span></div>`;
  const stationsHtml = nextStationsGroup(conf);
  box.innerHTML = stationsHtml + order.map((key) => {
    const list = groups.get(key);
    const open = state.nxOpenGroups.has(key);
    const issues = list.reduce((s, r) => s + (conf.get(r.id) || 0), 0);
    const peek = nxUniqBadges(list);
    const title = key === "~draft" ? t("nextDraftRoutes") : key === "~other" ? t("nextOtherRoutes") : routeTypeName(key);
    return `<div class="nx-acc${open ? " open" : ""}">
      <button type="button" class="nx-acch" data-group="${escapeHtml(key)}" aria-expanded="${open}">
        <i class="nx-gi" data-icon="${iconFor(key)}"></i><span>${escapeHtml(title)}</span><span class="n">${list.length}</span>
        <span class="nx-stack">${peek.slice(0, 3).map((r) => nxRouteBadge(r)).join("")}${peek.length > 3 ? nxMoreBadge(peek.length - 3) : ""}</span>
        <span class="nx-fill"></span>${issues ? `<span class="mono nx-issues">${escapeHtml(t("nextConflictsN", { n: issues }))}</span>` : ""}<i class="nx-chev"></i>
      </button>
      ${open ? `<div class="nx-acc-body">${head}${list.map(row).join("")}</div>` : ""}
    </div>`;
  }).join("") || `<p class="nx-empty">${escapeHtml(t("analyticsEmptyNoMatch"))}</p>`;
  box.querySelectorAll("[data-nx-station]").forEach((el) => {
    const open = () => gotoStationSchedule(el.dataset.nxStation);
    el.addEventListener("click", open);
    el.addEventListener("keydown", (e) => { if (e.key === "Enter") open(); });
  });
  box.querySelectorAll(".nx-acch").forEach((b) => b.addEventListener("click", () => {
    const k = b.dataset.group;
    if (state.nxOpenGroups.has(k)) state.nxOpenGroups.delete(k); else state.nxOpenGroups.add(k);
    nextRenderRouteGroups(routes);
  }));
  box.querySelectorAll(".nx-item[data-route-id]").forEach((el) => {
    const open = () => openRouteModal(el.dataset.routeId);
    el.addEventListener("click", open);
    el.addEventListener("keydown", (e) => { if (e.key === "Enter") open(); });
  });
}
// Группа «Станции и остановки»: станции по числу маршрутов, конфликты — из обхода сети
function nextStationsGroup(routeConf) {
  const q = (document.getElementById("routeSearch")?.value || "").trim().toLowerCase();
  const byStation = new Map();
  for (const r of state.routes || []) {
    if (r.isDraft) continue;
    for (const id of r.stationIds || []) {
      if (!byStation.has(id)) byStation.set(id, []);
      byStation.get(id).push(r);
    }
  }
  const stConf = new Map();
  try {
    for (const s of _conflictScan.stations) stConf.set(s.stationId, s.conflictCount || 0);
    for (const s of (state._conflictedStations || new Map()).values()) stConf.set(s.stationId, s.conflictCount || 0);
  } catch (e) {}
  const list = state.stations
    .filter((s) => !q || s.name.toLowerCase().includes(q))
    .map((s) => ({ s, routes: byStation.get(s.id) || [] }))
    .sort((a, b) => b.routes.length - a.routes.length || a.s.name.localeCompare(b.s.name));
  if (!list.length) return "";
  const key = "~stations";
  const open = state.nxOpenGroups.has(key);
  const issues = list.filter((x) => stConf.get(x.s.id) > 0).length;
  const uniq = (routes) => {
    const seen = new Set();
    return routes.filter((r) => { const k = (r.number || r.name) + r.color; if (seen.has(k)) return false; seen.add(k); return true; });
  };
  const peek = nxUniqBadges(list.slice(0, 3).flatMap((x) => x.routes)).slice(0, 3);
  const rows = open ? list.slice(0, 300).map(({ s, routes }) => {
    const u = uniq(routes);
    const ub = nxUniqBadges(u);
    const c = stConf.get(s.id) || 0;
    return `<div class="nx-item" data-nx-station="${escapeHtml(s.id)}" tabindex="0">
      <span class="nx-item-name"><span class="nx-rb more">${escapeHtml(s.name.slice(0, 3))}</span><span><b>${escapeHtml(s.name)}</b><small>${escapeHtml(t("nextStationRoutes", { n: u.length }))}</small></span></span>
      <span class="mono r">${u.length}</span>
      <span class="nx-stack nx-stack-wide">${ub.slice(0, 3).map((r) => nxRouteBadge(r)).join("")}${ub.length > 3 ? nxMoreBadge(ub.length - 3) : ""}</span>
      <span class="nx-cell-skip"></span>
      <span class="mono r" style="color:${c ? "#FF97A6" : "var(--muted)"}">${c || "—"}</span>
      <i class="nx-chev-r"></i>
    </div>`;
  }).join("") : "";
  const head = `<div class="nx-colh"><span>${escapeHtml(t("colStation"))}</span><span class="r">${escapeHtml(t("nextColRoutes"))}</span><span></span><span></span><span class="r">${escapeHtml(t("nextColConflicts"))}</span><span></span></div>`;
  return `<div class="nx-acc${open ? " open" : ""}">
    <button type="button" class="nx-acch" data-group="${key}" aria-expanded="${open}">
      <i class="nx-gi" data-icon="station"></i><span>${escapeHtml(t("nextStationsGroup"))}</span><span class="n">${list.length}</span>
      <span class="nx-stack">${peek.map((r) => nxRouteBadge(r)).join("")}</span>
      <span class="nx-fill"></span>${issues ? `<span class="mono nx-issues">${escapeHtml(t("nextStationsWithConflicts", { n: issues }))}</span>` : ""}<i class="nx-chev"></i>
    </button>
    ${open ? `<div class="nx-acc-body">${head}${rows}</div>` : ""}
  </div>`;
}
document.getElementById("nextRoutesSort")?.addEventListener("click", () => {
  const on = state.routeSort.key === "sampleCount" && state.routeSort.dir === -1;
  state.routeSort = on ? { key: null, dir: 1 } : { key: "sampleCount", dir: -1 };
  document.getElementById("nextRoutesSort").classList.toggle("on", !on);
  applyRouteFilters();
});

// ---------- Карточка маршрута: подзаголовок, KPI, конфликты (только в новом виде) ----------
function nextRouteCardExtras(data, timetable, conflictedTrips) {
  const stops = data.stops || [];
  const from = stops[0]?.stationName || "", to = stops[stops.length - 1]?.stationName || "";
  const depots = (data.depots || []).filter(Boolean);
  const sub = [from && to ? `${from} → ${to}` : "", routeTypeName(data.type), depots.length ? t("nextDepot", { d: depots.join(", ") }) : ""]
    .filter(Boolean).join(" · ");
  const trips = timetable && timetable.trips ? timetable.trips.map((tr) => tr.tripOriginMs).sort((a, b) => a - b) : [];
  const gaps = trips.slice(1).map((v, i) => v - trips[i]).filter((g) => g > 0).sort((a, b) => a - b);
  const interval = gaps.length ? gaps[Math.floor(gaps.length / 2)] : null;
  const an = (state.lastAnalytics || []).find((a) => a.routeId === data.id);
  const kpi = (label, value, color) => `<div class="nx-kpi"><span>${escapeHtml(label)}</span><b${color ? ` style="color:${color}"` : ""}>${escapeHtml(value)}</b></div>`;
  const devCol = an ? (Math.abs(an.avgDeviationMs) >= 90000 ? "#FF97A6" : Math.abs(an.avgDeviationMs) >= 40000 ? "#FFD08A" : "#D6FFF6") : null;
  const kpis = `<div class="next-only nx-kpis4">
    ${kpi(t("nextKpiInterval"), interval ? formatSecondsShort(Math.round(interval / 1000)) : "—")}
    ${kpi(t("nextKpiTravel"), data.totalDurationMs ? formatMinutesShort((data.totalDurationMs / 60000).toFixed(0)) : "—")}
    ${kpi(t("nextKpiTrips"), trips.length ? String(trips.length) : "—")}
    ${kpi(t("nextKpiAvgDev"), an ? formatDeviation(an.avgDeviationMs) : "—", devCol)}
  </div>`;
  const items = [];
  if (conflictedTrips && conflictedTrips.forEach && timetable) {
    conflictedTrips.forEach((stationIds, t0) => {
      const trip = timetable.trips.find((tr) => tr.tripOriginMs === t0);
      (stationIds instanceof Set ? [...stationIds] : []).forEach((sid) => {
        const idx = timetable.stations.findIndex((s) => (s.stationId || s.id) === sid);
        const cell = trip && idx >= 0 ? trip.times[idx] : null;
        const name = (idx >= 0 && (timetable.stations[idx].stationName || timetable.stations[idx].name)) || state.stations.find((s) => s.id === sid)?.name || sid;
        items.push({ sid, t0, name, time: cell ? formatUtc(normalizeMs(cell.arrivalMs - (trip.deviationMs || 0)), false) : "", fix: routeConflictFix(t0, sid) });
      });
    });
  }
  const conflicts = `<div class="next-only nx-card-conflicts"><h4>${escapeHtml(t("nextRouteConflicts"))} <span class="bad">${items.length || ""}</span></h4>${
    items.length ? items.slice(0, 30).map((c) => {
      const f = c.fix;
      const info = f ? ` · ${t("nxcWith", { r: f.partner })} · ${f.gapMs <= 0 ? t("nextOverlap") : t("nextGap", { gap: formatSecondsShort(Math.round(f.gapMs / 1000)) })}` : "";
      const shiftBtn = f ? `<button type="button" class="nx-raised" data-nxc-shift="${escapeHtml(String(c.t0))}" data-ms="${f.shiftMs}">${escapeHtml(t("nxcShiftBy", { n: (f.shiftMs > 0 ? "+" : "−") + Math.abs(f.shiftMs / 60000) }))}</button>` : "";
      return `<div class="nx-crow"><span><i class="nx-dot bad"></i><b>${escapeHtml(c.name)}</b><span class="muted">${escapeHtml(c.time + info)}</span></span><span class="nx-crow-btns">${shiftBtn}<button type="button" class="nx-ghost" data-nx-goto="${escapeHtml(c.sid)}">${escapeHtml(t("nextOpen"))}</button></span></div>`;
    }).join("")
      : `<p class="nx-empty">${escapeHtml(t("nextNoConflicts"))}</p>`}</div>`;
  return { sub: `<div class="next-only nx-card-sub">${escapeHtml(sub)}</div>`, kpis, conflicts, conflictCount: items.length };
}

// Карточка маршрута в новом виде — вставляется после nextRouteCardExtras (см. patch.py)

// Насколько сдвинуть НАШ рейс, чтобы на станции sid разойтись со всеми партнёрами по конфликту.
// Если мы приезжаем позже партнёра — сдвигаем позже, до его отправления + мин. интервал;
// если раньше — сдвигаем раньше, чтобы наше отправление + интервал было до его прибытия.
// Берём самого «тяжёлого» партнёра, округляем модуль вверх до минуты (не меньше 1).
function routeConflictFix(t0, sid) {
  const p = state.lastRouteConflictPairs && state.lastRouteConflictPairs.get(`${t0}|${sid}`);
  if (!p || !p.partners.length) return null;
  const minMs = (state.minIntervalMin || 0) * 60000;
  const end = (e) => Math.max(e.effDeparture ?? e.effArrival, e.effArrival + (e.dwellTimeMs || 0));
  let best = null;
  for (const o of p.partners) {
    const later = p.me.effArrival >= o.effArrival;
    const gapMs = later ? p.me.effArrival - end(o) : o.effArrival - end(p.me);
    const need = later ? end(o) + minMs - p.me.effArrival : o.effArrival - minMs - end(p.me);
    if (!best || Math.abs(need) > Math.abs(best.need)) best = { need, gapMs, partner: o.routeNumber || o.routeName || "?" };
  }
  const min = Math.max(1, Math.ceil(Math.abs(best.need) / 60000));
  return { shiftMs: (best.need < 0 ? -1 : 1) * min * 60000, gapMs: best.gapMs, partner: best.partner };
}
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest("[data-nxc-shift]");
  const route = state.lastRouteDetail;
  if (!b || !route) return;
  const t0 = Number(b.dataset.nxcShift);
  pushUndoSnapshot();
  setOverride(route.id, t0, getOverride(route.id, t0) + Number(b.dataset.ms));
  try { renderDashboardFromCache(); } catch (err) {}
  try { renderGraphFromCache(); } catch (err) {}
  openRouteModal(route.id); // пересчитать конфликты карточки с новой правкой
});

// Какие рейсы маршрута сейчас в пути (по расписанию с живым отклонением и ручными правками)
// и какой рейс «текущий» для таблицы: идущий сейчас, иначе ближайший следующий.
// frac — доля пройденного пути по ВРЕМЕНИ; станции на полосе стоят по той же шкале (stationFrac),
// поэтому поезд между ними оказывается в правильном месте без пересчёта расстояний.
function routeTripsNow(data, timetable) {
  const res = { curIdx: -1, onLine: [], stationFrac: [] };
  const trips = timetable && timetable.trips ? timetable.trips : [];
  if (!trips.length) return res;
  const now = getNowMsOfDay();
  const t0 = trips[0].times || [];
  const len0 = t0.length > 1 ? normalizeMs(t0[t0.length - 1].arrivalMs - t0[0].arrivalMs) : 0;
  res.stationFrac = t0.map((x) => (len0 ? normalizeMs(x.arrivalMs - t0[0].arrivalMs) / len0 : 0));
  let wait = Infinity;
  trips.forEach((trip, i) => {
    const times = trip.times || [];
    if (times.length < 2) return;
    const delta = getOverride(data.id, trip.tripOriginMs);
    const start = times[0].arrivalMs + delta;
    const len = normalizeMs(times[times.length - 1].arrivalMs - times[0].arrivalMs);
    const rel = normalizeMs(now - start);
    if (len > 0 && rel <= len) {
      let k = 0;
      for (let j = 0; j < times.length; j++) if (normalizeMs(times[j].arrivalMs - times[0].arrivalMs) <= rel) k = j;
      const dep = times[k].departureMs != null ? times[k].departureMs : times[k].arrivalMs;
      const atStation = normalizeMs(dep - times[0].arrivalMs) >= rel;
      res.onLine.push({ idx: i, trip, delta, frac: rel / len, k, atStation, dev: trip.deviationMs || 0 });
      if (wait > 0) { wait = 0; res.curIdx = i; }
    } else if (wait > 0) {
      const w = normalizeMs(start - now);
      if (w < wait) { wait = w; res.curIdx = i; }
    }
  });
  return res;
}

// Карточка маршрута в новом виде: всплывающее окно — шапка с действиями, слева «паспорт»
// (KPI, поезда на линии, состав, сведения), справа вкладки. Кнопки сохраняют id классической
// карточки, поэтому обработчики renderRouteModal работают без изменений.
function nextRouteCardHtml({ data, timetable, nx, tripNow, stopsTableHtml, stationTimetableHtml, formulaHtml }) {
  const tab = state.nxCardTab || "tt";
  const color = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(String(data.color || "")) ? data.color : "#8b8f9a";
  const devColor = (ms) => Math.abs(ms) >= 90000 ? "#FF97A6" : Math.abs(ms) >= 40000 ? "#FFD08A" : "#D6FFF6";
  // на полосе места мало: «+1:10» / «0:00» вместо «+1 мин 10 с» / «по графику» (полная форма — в подсказке)
  const devShort = (ms) => {
    const sec = Math.round(Math.abs(ms) / 1000);
    return (ms > 0 && sec ? "+" : ms < 0 && sec ? "−" : "") + Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0");
  };
  const onLine = tripNow.onLine;
  const stations = timetable && timetable.stations ? timetable.stations : [];
  const stName = (k) => (stations[k] && (stations[k].stationName || stations[k].name)) || (data.stops[k] && data.stops[k].stationName) || "";
  const edits = timetable ? timetable.trips.filter((tr) => getOverride(data.id, tr.tripOriginMs) !== 0).length : 0;
  const chips = [
    onLine.length ? `<span class="nxc-chip live">${escapeHtml(t("nxcOnLine", { n: onLine.length }))}</span>` : "",
    edits ? `<span class="nxc-chip edit">${escapeHtml(t("nxcEdits", { n: edits }))}</span>` : "",
    data.isDraft ? `<span class="nxc-chip draft">${escapeHtml(t("draftBadge"))}</span>` : "",
  ].join("");

  // вагонов в составе: живые данные, иначе кеш состава
  const depTrips = _depIdxCache.get(data.id);
  let carCounts = depTrips ? [...new Set(depTrips.filter((x) => x.carCount != null).map((x) => x.carCount))] : [];
  const cars = _carsCache.get(data.number) || null;
  if (!carCounts.length && Array.isArray(cars) && cars.length) carCounts = [cars.length];
  const diagram = cars && cars.length ? buildTrainDiagramSvg(data.number || data.name, data.type, cars.length, "#ffffff", cars) : "";

  // полоса линии: станции по времени хода, поезда — по доле пройденного времени
  const ends = data.stops.length ? [data.stops[0].stationName, data.stops[data.stops.length - 1].stationName] : ["", ""];
  const dots = tripNow.stationFrac.map((f, k) =>
    `<span class="nxc-st" style="left:${(f * 100).toFixed(2)}%" title="${escapeHtml(stName(k))}"></span>`).join("");
  const trainsHtml = onLine.map((o) => {
    const where = o.atStation ? stName(o.k) : `${stName(o.k)} → ${stName(o.k + 1)}`;
    return `<span class="nxc-train" style="left:${(o.frac * 100).toFixed(2)}%;--c:${devColor(o.dev)}" title="${escapeHtml(`#${o.idx + 1} · ${where} · ${formatDeviation(o.dev)}`)}"><b>${devShort(o.dev)}</b></span>`;
  }).join("");
  const strip = tripNow.stationFrac.length > 1
    ? `<div class="nxc-strip" style="--line:${color}"><span class="nxc-rail"></span><span class="nxc-track">${dots}${trainsHtml}</span><span class="nxc-end l">${escapeHtml(ends[0])}</span><span class="nxc-end r">${escapeHtml(ends[1])}</span></div>`
    : `<p class="nx-empty">${escapeHtml(t("nxcNoTrains"))}</p>`;

  const meta = [
    [t("modalType"), routeTypeName(data.type)],
    [t("modalDepots"), (data.depots || []).filter(Boolean).join(", ") || "—"],
    [t("nxcStopsN"), String(data.stops.length)],
    [t("modalActiveTrips"), String(data.activeTripCount ?? "—")],
    [t("nxcCarsLabel"), carCounts.length ? carCounts.join(" / ") : "—"],
    [t("modalTotalDuration"), formatMinutesShort((data.totalDurationMs / 60000).toFixed(1))],
    [t("modalTotalDwell"), formatMinutesShort((data.totalDwellMs / 60000).toFixed(1))],
  ].map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`).join("");

  // вкладка «Сейчас на линии»: где каждый поезд и когда он будет на следующей станции
  const liveRows = onLine.map((o) => {
    const next = o.trip.times[o.k + 1];
    const where = o.atStation ? stName(o.k) : `${stName(o.k)} → ${stName(o.k + 1)}`;
    return `<tr><td>#${o.idx + 1}</td><td class="nxc-tl">${escapeHtml(where)}</td><td class="nxc-tl">${escapeHtml(next ? stName(o.k + 1) : "—")}</td>` +
      `<td>${next ? formatUtc(normalizeMs(next.arrivalMs - o.dev + o.delta)) : "—"}</td><td style="color:${devColor(o.dev)}" title="${escapeHtml(formatDeviation(o.dev))}">${devShort(o.dev)}</td></tr>`;
  }).join("");
  const liveHtml = onLine.length
    ? `<div class="nxc-tbl"><table><thead><tr><th>${escapeHtml(t("nxcColTrip"))}</th><th class="nxc-tl">${escapeHtml(t("nxcColWhere"))}</th><th class="nxc-tl">${escapeHtml(t("nxcColNext"))}</th><th>${escapeHtml(t("nxcColArrival"))}</th><th>${escapeHtml(t("deviationLabel"))}</th></tr></thead><tbody>${liveRows}</tbody></table></div>`
    : `<p class="nx-empty">${escapeHtml(t("nxcNoTrains"))}</p>`;

  const tabBtn = (key, label, n, bad) =>
    `<button type="button" class="nxc-tab${key === tab ? " on" : ""}" role="tab" aria-selected="${key === tab}" data-nxc-tab="${key}">${escapeHtml(label)}${n ? `<span class="n${bad ? " bad" : ""}">${n}</span>` : ""}</button>`;

  return `<div class="nxc" data-tab="${escapeHtml(tab)}">
    <header class="nxc-hd">
      ${routeMarker(data.type, data.color, data.number, "lg")}
      <div class="nxc-title">
        <div class="nxc-title-row"><h2>${escapeHtml(data.name)}${data.isDraft ? " " + draftFlagHtml() : ""}</h2>${chips}</div>
        ${nx.sub}
        <div class="nxc-actions">
          ${data.isDraft ? `<button class="secondary-btn" id="editDraftInModalBtn">${escapeHtml(t("draftEdit"))}</button><button class="secondary-btn danger-btn" id="deleteDraftInModalBtn">${escapeHtml(t("draftDelete"))}</button>` : ""}
          <button class="secondary-btn" id="reverseRouteBtn">${escapeHtml(t("openReverseRoute"))}</button>
          <button class="secondary-btn" id="openGraphForRouteBtn">${escapeHtml(t("nxcGraph"))}</button>
          <button class="secondary-btn" id="createDraftFromRouteBtn">${escapeHtml(t("nxcCopyDraft"))}</button>
          <span class="nxc-fill"></span>
          ${!data.isDraft && hasAnyOverrideForRoute(data.id) ? `<button class="secondary-btn danger-btn" id="resetRouteEditsBtn">${escapeHtml(t("resetRouteEdits"))}</button>` : ""}
        </div>
      </div>
      <button class="icon-btn" id="toggleFavoriteRouteBtn" title="">☆</button>
    </header>
    <div class="nxc-body">
      <aside class="nxc-side">
        ${nx.kpis}
        <div class="nxc-block"><p class="nxc-cap">${escapeHtml(t("nxcTabLive"))}<span class="live">${onLine.length ? escapeHtml(t("nxcTrains", { n: onLine.length })) : ""}</span></p>${strip}</div>
        <div class="nxc-block"${diagram ? "" : " hidden"}><p class="nxc-cap">${escapeHtml(t("nxcConsist"))}<span class="nxc-cars">${diagram ? escapeHtml(t("nxcCars", { n: cars.length })) : ""}</span></p><div id="nxcConsist">${diagram}</div></div>
        <div class="nxc-block"><p class="nxc-cap">${escapeHtml(t("nxcPassport"))}</p><dl class="nxc-meta">${meta}</dl></div>
      </aside>
      <div class="nxc-main">
        <nav class="nxc-tabs" role="tablist">
          ${tabBtn("tt", t("nxcTabTimetable"), timetable ? timetable.trips.length : 0)}
          ${tabBtn("stops", t("nxcTabStops"), data.stops.length)}
          ${tabBtn("live", t("nxcTabLive"), onLine.length)}
          ${tabBtn("conf", t("nxcTabConflicts"), nx.conflictCount, true)}
        </nav>
        <div class="nxc-pane" data-pane="tt">
          <div class="nxc-tt-head"><span>${escapeHtml(t("nxcTtHint"))}</span>${tripNow.curIdx >= 0 ? `<button type="button" class="secondary-btn" data-nxc-now>${escapeHtml(t("nxcNow"))}</button>` : ""}</div>
          ${stationTimetableHtml}
          <div class="nxc-legend"${timetable && timetable.trips.length ? "" : " hidden"}>
            <span><i class="sw conflict"></i>${escapeHtml(t("nextLgConflict"))}</span>
            <span><i class="sw edited"></i>${escapeHtml(t("nextLgEdited"))}</span>
            <span><i class="sw cur"></i>${escapeHtml(t("nxcLgCurrent"))}</span>
            <span class="muted">${escapeHtml(t("nxcLgPassed"))}</span>
          </div>
          ${formulaHtml}
        </div>
        <div class="nxc-pane" data-pane="stops"><div class="nxc-tbl">${stopsTableHtml}</div></div>
        <div class="nxc-pane" data-pane="live">${liveHtml}${buildLiveTripsSection(data.id, currentLang())}</div>
        <div class="nxc-pane" data-pane="conf">${nx.conflicts}</div>
      </div>
    </div>
  </div>`;
}
// Прокрутить таблицу расписания к текущему рейсу
function nxcScrollToNow(smooth) {
  const sc = document.querySelector("#routeModalBody .nxc .timetable-scroll");
  const th = sc && sc.querySelector("thead th.tt-cur");
  if (!th) return;
  const first = sc.querySelector("thead th.station-col");
  // offsetLeft тут считается от позиционированного предка окна, а не от таблицы — берём экранные координаты
  const x = sc.scrollLeft + th.getBoundingClientRect().left - sc.getBoundingClientRect().left;
  sc.scrollTo({ left: Math.max(0, x - (first ? first.offsetWidth : 0) - 8), behavior: smooth ? "smooth" : "auto" });
}
document.addEventListener("click", (e) => {
  const tb = e.target.closest && e.target.closest("[data-nxc-tab]");
  if (tb) {
    state.nxCardTab = tb.dataset.nxcTab;
    const root = tb.closest(".nxc");
    if (!root) return;
    root.dataset.tab = state.nxCardTab;
    root.querySelectorAll("[data-nxc-tab]").forEach((b) => { b.classList.toggle("on", b === tb); b.setAttribute("aria-selected", String(b === tb)); });
    if (state.nxCardTab === "tt") requestAnimationFrame(() => nxcScrollToNow(false));
    return;
  }
  if (e.target.closest && e.target.closest("[data-nxc-now]")) nxcScrollToNow(true);
});
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest("[data-nx-goto]");
  if (b) gotoStationSchedule(b.dataset.nxGoto);
});

// ---------- Задержки и проблемы ----------
if (!state.nxProblemsScope) state.nxProblemsScope = "all";
document.querySelectorAll("#nextProblemsScope [data-scope]").forEach((b) => b.addEventListener("click", () => {
  state.nxProblemsScope = b.dataset.scope;
  renderProblems();
}));
document.getElementById("nextProblemsRescan")?.addEventListener("click", () => {
  _conflictScan.at = 0;
  renderProblems();
});
function nextSyncProblemsScope() {
  document.querySelectorAll("#nextProblemsScope [data-scope]").forEach((b) => b.classList.toggle("on", b.dataset.scope === state.nxProblemsScope));
}
// KPI над колонками: конфликты сейчас, опаздывают сейчас, среднее опоздание сети, доля в графике
function nextProblemsKpis(stItems, liveDelayed) {
  const conflicts = stItems.reduce((s, x) => s + (x.conflictCount || 0), 0);
  const an = (state.lastAnalytics || []).filter((a) => a.sampleCount > 0 && state.routesById.has(a.routeId));
  const samples = an.reduce((s, a) => s + a.sampleCount, 0);
  const avg = samples ? an.reduce((s, a) => s + a.avgDeviationMs * a.sampleCount, 0) / samples : null;
  const onTime = samples ? an.filter((a) => Math.abs(a.avgDeviationMs) <= 60000).reduce((s, a) => s + a.sampleCount, 0) / samples : null;
  const kpi = (label, value, color, note) => `<div class="nx-pkpi"><div><span>${escapeHtml(label)}</span><b style="color:${color}">${escapeHtml(value)}</b></div><small>${note}</small></div>`;
  return `<div class="next-only nx-pkpis">
    ${kpi(t("nextKpiConflictsNow"), String(conflicts), "#FF97A6", escapeHtml(t("nextKpiOnStations", { n: stItems.length })))}
    ${kpi(t("nextKpiLateNow"), String(liveDelayed.length), "#FFD08A", escapeHtml(t("nextKpiLateNote")))}
    ${kpi(t("nextKpiNetAvg"), avg == null ? "—" : formatDeviation(avg), "var(--text)", escapeHtml(t("nextKpiSamples", { n: samples.toLocaleString(currentLang()) })))}
    ${kpi(t("nextKpiOnTime"), onTime == null ? "—" : Math.round(onTime * 100) + "%", "#D6FFF6", escapeHtml(t("nextKpiOnTimeNote")).replace(/&lt;br&gt;/g, "<br>"))}
  </div>`;
}

// ============================================================
// Метки маршрутов (routeMarkers.js): форма и содержимое по типу транспорта
// ============================================================
// В новом виде тип без своей настройки рисуется параллелограммом с номером (мотив макетов)
const NEXT_MARKER_DEFAULT = { shape: "parallelogram", content: "number" };
function routeMarkerDefault() {
  return document.documentElement.classList.contains("ui-next") ? NEXT_MARKER_DEFAULT : null;
}
function routeMarker(type, color, number, size, title) {
  return window.RouteMarkers
    ? RouteMarkers.html({ type, color, number, size, title, cfg: settings.routeMarkers, def: routeMarkerDefault() })
    : `<span class="dot" style="background:${color}"></span>`;
}
// Номер уже нарисован внутри метки — рядом его не повторяем
function routeMarkerShowsNumber(type) {
  return !!window.RouteMarkers && RouteMarkers.configFor(settings.routeMarkers, type, routeMarkerDefault()).content === "number";
}
// Человеческое название типа MTR; неизвестный тип показываем кодом как есть
function routeTypeName(type) {
  const key = "rtype_" + type;
  const s = t(key);
  return s === key ? String(type || "") : s;
}
// Перерисовать всё, где стоят метки (после смены настройки)
function rerenderRouteMarkers() {
  try { renderDashboardFromCache(); } catch (e) {}
  try { renderGraphFromCache(); } catch (e) {}
  if (state.routes.length) { populateRouteTypeFilter(); applyRouteFilters(); }
  if (state.lastRouteDetail && routeModalOverlay.style.display !== "none") {
    renderRouteModal(state.lastRouteDetail, state.lastRouteTimetable, state.lastRouteRawDraft, state.lastRouteConflictedTrips);
  }
  if (document.getElementById("tab-problems")?.classList.contains("active")) renderProblems();
}
// Блок «Метки маршрутов» в настройках: по строке на тип (типы этого сервера, иначе стандартные MTR)
function renderRouteMarkersSettings() {
  const list = document.getElementById("routeMarkersList");
  if (!list || !window.RouteMarkers) return;
  const present = Array.from(new Set(state.routes.map((r) => r.type).filter(Boolean)));
  const types = Array.from(new Set([...(present.length ? present : RouteMarkers.KNOWN_TYPES), ...Object.keys(settings.routeMarkers || {})]))
    .sort((a, b) => {
      const ia = RouteMarkers.KNOWN_TYPES.indexOf(a), ib = RouteMarkers.KNOWN_TYPES.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
    });
  // пример маршрута этого типа — для превью (цвет и номер)
  const sampleFor = (ty) => state.routes.find((r) => r.type === ty && r.color) || { color: "#ef4444", number: "1" };
  const shapeOpts = (sel) => RouteMarkers.SHAPES.map((s) =>
    `<option value="${s}" ${s === sel ? "selected" : ""}>${escapeHtml(t("rmShape_" + s))}</option>`).join("");
  const contentOpts = (sel) => RouteMarkers.CONTENTS.map((c) =>
    `<option value="${c}" ${c === sel ? "selected" : ""}>${escapeHtml(t("rmContent_" + c.replace(":", "_")))}</option>`).join("");
  list.innerHTML = types.map((ty) => {
    const c = RouteMarkers.configFor(settings.routeMarkers, ty, routeMarkerDefault());
    const sm = sampleFor(ty);
    return `<div class="rm-row" data-type="${escapeHtml(ty)}">
      <span class="rm-name">${escapeHtml(routeTypeName(ty))}<span class="rm-code">${escapeHtml(ty)}</span></span>
      <select data-rm="shape" aria-label="${escapeHtml(t("routeMarkerShape"))}">${shapeOpts(c.shape)}</select>
      <select data-rm="content" aria-label="${escapeHtml(t("routeMarkerContent"))}">${contentOpts(c.content)}</select>
      <span class="rm-preview">${routeMarker(ty, sm.color, sm.number || "1", "lg")}</span>
    </div>`;
  }).join("");
  list.querySelectorAll(".rm-row select").forEach((sel) => {
    sel.addEventListener("change", () => {
      const row = sel.closest(".rm-row");
      const ty = row.dataset.type;
      settings.routeMarkers = { ...(settings.routeMarkers || {}) };
      settings.routeMarkers[ty] = {
        shape: row.querySelector('[data-rm="shape"]').value,
        content: row.querySelector('[data-rm="content"]').value,
      };
      savePrefsToServer();
      const sm = sampleFor(ty);
      row.querySelector(".rm-preview").innerHTML = routeMarker(ty, sm.color, sm.number || "1", "lg");
      rerenderRouteMarkers();
    });
  });
}

function switchToTab(tabName) {
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
  document.querySelector(`.tab-btn[data-tab="${tabName}"]`).classList.add("active");
  document.getElementById(`tab-${tabName}`).classList.add("active");
  updateNextPageTitle();
  if (tabName === "routes") loadRoutes();
  if (tabName === "problems") {
    // Если маршруты ещё не загружены — загружаем сначала
    if (state.routesById.size === 0) {
      loadRoutes().then(() => renderProblems());
    } else {
      renderProblems();
    }
  }
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
    if (hasErrors && hasData) {
      // Есть ошибки подключения, но данные загружены из кеша
      badge.textContent = t("statusCached", { st: data.topology.stationCount, rt: data.topology.routeCount });
      badge.className = "status-badge warn";
    } else if (hasErrors && !hasData) {
      badge.textContent = t("statusErrorConn");
      badge.className = "status-badge error";
    } else if (hasData) {
      badge.textContent = t("statusSynced", { st: data.topology.stationCount, rt: data.topology.routeCount });
      badge.className = "status-badge ok";
    } else {
      badge.textContent = t("statusWaiting");
      badge.className = "status-badge";
    }
    // короткая строка для полосы окна в новом виде: «MTR онлайн» (без счётчика секунд — он дёргался каждую секунду)
    badge.dataset.next = hasErrors
      ? (hasData ? t("nextStatusCached") : t("nextStatusOffline"))
      : data.departures.fetchedAt ? t("nextStatusOnline") : t("statusWaiting");
  } catch {
    badge.textContent = t("statusNoLocalServer");
    badge.className = "status-badge error";
    badge.dataset.next = t("statusNoLocalServer");
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
        // Пропускаем: конечная + начальная = оборотный поезд (один физический состав).
        // Определяем по reverseRouteMap: если routeId одного — это reverseRouteId другого.
        const isTurnaround =
          (cur.isTerminus && next.isOrigin) || (next.isTerminus && cur.isOrigin);
        if (isTurnaround) {
          // Проверяем что это именно пара (один является обратным другого)
          const isReversePair =
            cur.reverseRouteId === next.routeId ||
            next.reverseRouteId === cur.routeId ||
            cur.pairedForwardRouteId === next.routeId ||
            next.pairedForwardRouteId === cur.routeId;
          if (isReversePair) continue;
        }
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

// ── Автоустранение конфликтов на станции ────────────────────────────────
// Простой жадный солвер: пока есть конфликты, берём самую раннюю пару и
// сдвигаем ПОЗЖНИЙ поезд ровно настолько, чтобы интервал стал = minInterval
// (перебор округляем до минуты). Ограничения: не больше MAX_ITER итераций и
// сдвиг одного рейса не больше MAX_SHIFT (мега-хабы с сотнями конфликтов не
// «расшатываем» до бесконечности). Возвращает Map<routeId:t0 → доп.сдвиг мс>.
// Сдвиг на конечных распространяется по цепочке оборота при применении.
function solveStationConflicts(rawEntries, minIntervalMs) {
  const MAX_ITER = 300, MAX_SHIFT = 20 * 60000;
  // Начальный эффективный сдвиг каждого рейса = уже существующий override
  const extra = new Map();  // key → добавленный солвером сдвиг
  const baseDelta = new Map();
  const keyOf = (e) => `${e.routeId}:${e.tripOriginMs}`;
  for (const e of rawEntries) {
    const k = keyOf(e);
    if (!baseDelta.has(k)) baseDelta.set(k, getOverride(e.routeId, e.tripOriginMs));
    if (!extra.has(k)) extra.set(k, 0);
  }
  const buildEff = () => rawEntries.map((e) => {
    const k = keyOf(e);
    const d = baseDelta.get(k) + extra.get(k);
    return {
      routeId: e.routeId, tripOriginMs: e.tripOriginMs, platformName: e.platformName,
      dwellTimeMs: e.dwellTimeMs, isOrigin: e.isOrigin, isTerminus: e.isTerminus,
      reverseRouteId: e.reverseRouteId, pairedForwardRouteId: e.pairedForwardRouteId,
      entryKey: `${e.routeId}:${e.tripOriginMs}:${e.platformName}`,
      effArrival: normalizeMs(e.arrivalMs + d),
      effDeparture: e.departureMs == null ? null : normalizeMs(e.departureMs + d),
      _key: k,
    };
  });

  let resolved = 0;
  const frozen = new Set(); // пары, которые нельзя устранить в пределах MAX_SHIFT
  for (let iter = 0; iter < MAX_ITER; iter++) {
    const eff = buildEff();
    // Ищем первую (ещё не «замороженную») конфликтную пару на платформе
    const byPlatform = new Map();
    for (const e of eff) {
      const p = e.platformName || "—";
      if (!byPlatform.has(p)) byPlatform.set(p, []);
      byPlatform.get(p).push(e);
    }
    let pair = null;
    for (const list of byPlatform.values()) {
      list.sort((a, b) => a.effArrival - b.effArrival);
      for (let i = 0; i < list.length && !pair; i++) {
        const cur = list[i];
        const curEnd = Math.max(cur.effDeparture ?? cur.effArrival, cur.effArrival + (cur.dwellTimeMs || 0));
        for (let j = i + 1; j < list.length; j++) {
          const nx = list[j];
          if (nx.effArrival >= curEnd + minIntervalMs) break;
          const isTurn = (cur.isTerminus && nx.isOrigin) || (nx.isTerminus && cur.isOrigin);
          const isRevPair = cur.reverseRouteId === nx.routeId || nx.reverseRouteId === cur.routeId ||
            cur.pairedForwardRouteId === nx.routeId || nx.pairedForwardRouteId === cur.routeId;
          if (isTurn && isRevPair) continue;
          const pk = cur._key + "|" + nx._key;
          if (frozen.has(pk)) continue;
          pair = { earlier: cur, later: nx, curEnd, pk };
          break;
        }
      }
      if (pair) break;
    }
    if (!pair) break; // устранимых конфликтов больше нет
    // Минимальный сдвиг позднего поезда вправо до интервала = minInterval
    const need = Math.ceil((pair.curEnd + minIntervalMs - pair.later.effArrival) / 60000) * 60000;
    const k = pair.later._key;
    if (need <= 0 || extra.get(k) + need > MAX_SHIFT) {
      frozen.add(pair.pk); // не устранить в пределах допуска — пропускаем, идём дальше
      continue;
    }
    extra.set(k, extra.get(k) + need);
    resolved++;
  }
  // Возвращаем только реально сдвинутые рейсы (routeId, t0, итоговый абсолютный override)
  const plan = [];
  for (const e of rawEntries) {
    const k = keyOf(e);
    const add = extra.get(k) || 0;
    if (add !== 0 && !plan.some((p) => p.key === k)) {
      plan.push({ key: k, routeId: e.routeId, tripOriginMs: e.tripOriginMs, absDelta: baseDelta.get(k) + add });
    }
  }
  return { plan, iterations: resolved };
}

// Загружает расписание станции, прогоняет солвер и применяет сдвиги
// (с распространением по цепочке оборота). Возвращает число сдвинутых рейсов.
async function autoResolveStation(stationId) {
  const res = await fetch(`/api/stations/${encodeURIComponent(stationId)}/schedule`);
  if (!res.ok) return { shifted: 0 };
  const data = await res.json();
  const entries = (data.entries || []);
  if (!entries.length) return { shifted: 0 };
  const minIntervalMs = state.minIntervalMin * 60000;
  const { plan } = solveStationConflicts(entries, minIntervalMs);
  if (!plan.length) return { shifted: 0 };
  pushUndoSnapshot();
  // Применяем сдвиги ПОРЕЙСНО (без выравнивания всей цепочки оборота: у S19
  // вся линия — одна цепочка, и общий сдвиг перетёр бы независимые правки
  // солвера). Небольшие сдвиги укладываются в запас оборота на конечной.
  for (const p of plan) setOverride(p.routeId, p.tripOriginMs, p.absDelta, true);
  persistOverrides();
  if (state.currentStationId === stationId) { renderDashboardFromCache(); renderGraphFromCache(); }
  return { shifted: plan.length };
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
// Тултип общий для дашборда И графика движения — выносим в body: внутри
// секции расписания он невидим на других вкладках (родитель display:none)
document.body.appendChild(entryTooltip);

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
    // Ось 00:00–24:00 в ЛОКАЛЬНОМ времени пользователя: блоки сдвигаются
    // на displayShiftMs(), поэтому подпись под поездом совпадает с formatLocal.
    const utcM = m % (24 * 60);
    const hh = String(Math.floor(utcM / 60)).padStart(2, "0");
    const mm2 = String(utcM % 60).padStart(2, "0");
    const tickLabel = hasLabel ? (utcM % 60 === 0 ? hh + ":00" : hh + ":" + mm2) : "";
    html += `<div class="tick ${isHour ? "tick-hour" : "tick-minor"}" style="left:${m * pxPerMin}px">${tickLabel}</div>`;
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

// ── Фильтр дашборда по маршрутам ─────────────────────────────────────
// Пункт списка = конкретный routeId, а прямой и обратный — это разные
// routeId, поэтому фильтр работает и «по маршруту», и «по направлению».
function renderRouteFilterList() {
  const data = state.lastScheduleData;
  const container = document.getElementById("routeFilterList");
  if (!container) return;
  if (!data || !data.entries || data.entries.length === 0) {
    container.innerHTML = "";
    return;
  }
  if (state.routeFilterStationId !== data.stationId) {
    // Новая станция — по умолчанию включены все маршруты (включая скрытые
    // оборотные половины пар, чтобы конфликты считались как раньше)
    state.routeFilter = new Set(data.entries.map((e) => e.routeId));
    state.routeFilterStationId = data.stationId;
  }
  const uniq = new Map();
  for (const e of data.entries) {
    if (e.hiddenByReverse) continue;
    if (!uniq.has(e.routeId)) uniq.set(e.routeId, e);
  }
  const items = [...uniq.values()].sort((a, b) =>
    String(a.routeNumber || a.routeName).localeCompare(String(b.routeNumber || b.routeName), "ru", { numeric: true }));
  container.innerHTML = items
    .map((e) => `<label title="${escapeHtml(e.routeName || "")}"><input type="checkbox" data-route-id="${escapeHtml(e.routeId)}" ${state.routeFilter.has(e.routeId) ? "checked" : ""}> ${routeMarker(e.routeType, e.color, e.routeNumber, "sm")} ${escapeHtml(e.routeNumber || e.routeName || "?")}</label>`)
    .join("");
  container.querySelectorAll("input[type=checkbox]").forEach((cb) => {
    cb.addEventListener("change", () => {
      const id = cb.dataset.routeId;
      if (cb.checked) state.routeFilter.add(id);
      else state.routeFilter.delete(id);
      renderDashboardFromCache();
    });
  });
}
document.getElementById("routesFilterSelectAll")?.addEventListener("click", () => {
  if (state.lastScheduleData) state.routeFilter = new Set(state.lastScheduleData.entries.map((e) => e.routeId));
  renderRouteFilterList();
  renderDashboardFromCache();
});
document.getElementById("routesFilterSelectNone")?.addEventListener("click", () => {
  state.routeFilter = new Set();
  renderRouteFilterList();
  renderDashboardFromCache();
});

// ── Фильтр дашборда по типам поездов ─────────────────────────────────
function renderDashTypeFilterList() {
  const data = state.lastScheduleData;
  const container = document.getElementById("dashTypeFilterList");
  if (!container) return;
  if (!data || !data.entries || data.entries.length === 0) {
    container.innerHTML = "";
    return;
  }
  const types = Array.from(new Set(data.entries.map((e) => e.routeType).filter(Boolean))).sort();
  // Новая станция — включаем все типы заново
  if (state.dashTypeFilterStationId !== data.stationId) {
    state.dashTypeFilter = new Set(types);
    state.dashTypeFilterStationId = data.stationId;
  }
  container.innerHTML = types
    .map((ty) => `<label title="${escapeHtml(ty)}"><input type="checkbox" data-ty="${escapeHtml(ty)}" ${state.dashTypeFilter.has(ty) ? "checked" : ""}> ${routeMarker(ty, "#8b8f9a", "", "md")} ${escapeHtml(routeTypeName(ty))}</label>`)
    .join("");
  container.querySelectorAll("input[type=checkbox]").forEach((cb) => {
    cb.addEventListener("change", () => {
      if (cb.checked) state.dashTypeFilter.add(cb.dataset.ty);
      else state.dashTypeFilter.delete(cb.dataset.ty);
      renderDashboardFromCache();
    });
  });
}
document.getElementById("dashTypesSelectAll")?.addEventListener("click", () => {
  if (state.lastScheduleData) state.dashTypeFilter = new Set(state.lastScheduleData.entries.map((e) => e.routeType).filter(Boolean));
  renderDashTypeFilterList();
  renderDashboardFromCache();
});
document.getElementById("dashTypesSelectNone")?.addEventListener("click", () => {
  state.dashTypeFilter = new Set();
  renderDashTypeFilterList();
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
  if (state.lastScheduleData) state.routeFilter = new Set(state.lastScheduleData.entries.map((e) => e.routeId));
  if (state.lastScheduleData) state.dashTypeFilter = new Set(state.lastScheduleData.entries.map((e) => e.routeType).filter(Boolean));
  renderRouteFilterList();
  renderDashTypeFilterList();
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
  state.showPartial = true;
  state.showGraphConflicts = true;
  state.graphRouteOverrides = new Map();
  document.getElementById("showReverseToggle").checked = false;
  const partialCb = document.getElementById("showPartialToggle");
  if (partialCb) partialCb.checked = true;
  const conflictsCb = document.getElementById("showGraphConflictsToggle");
  if (conflictsCb) conflictsCb.checked = true;
  if (state.lastGraphData) {
    state.graphTypeFilter = new Set((state.lastGraphData.routes || []).map((r) => r.type).filter(Boolean));
    renderGraphTypeFilterList(state.lastGraphData);
  }
  state.graphPxPerHour = 110;
  document.getElementById("graphZoomValue").textContent = "100%";
  renderGraphStationFilterList(state.lastGraphData || { stations: [], fromStationId: "", toStationId: "" });
  renderGraphFromCache();
});

const minIntervalSlider = document.getElementById("minIntervalSlider");
minIntervalSlider.addEventListener("input", () => {
  state.minIntervalMin = Number(minIntervalSlider.value);
  document.getElementById("minIntervalValue").textContent = t("minIntervalValue", { m: state.minIntervalMin });
  savePrefsToServer();
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
  renderRouteFilterList();
  renderDashTypeFilterList();

  const TIMELINE_WIDTH = dashTimelineWidth();
  const visiblePlatforms = data.platforms.filter((p) => state.platformFilter.has(p));
  const routeVisible = (rid) => !state.routeFilter || state.routeFilter.has(rid);
  const typeVisible = (ty) => !state.dashTypeFilter || !ty || state.dashTypeFilter.has(ty);

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
  // allProcessed — все записи включая скрытые (нужны для расчёта конфликтов)
  // processed — только видимые (для отображения блоков)
  const _seenKeys = new Set();
  const allProcessed = data.entries
    .filter((e) => {
      const k = `${e.routeId}:${e.tripOriginMs}:${e.arrivalMs}`;
      if (_seenKeys.has(k)) return false;
      _seenKeys.add(k);
      return true;
    })
  // .map() продолжается ниже
    .map((e) => {
      const delta = getOverride(e.routeId, e.tripOriginMs);
      const effArrival = normalizeMs(e.arrivalMs + delta);
      const effDeparture = e.departureMs === null ? null : normalizeMs(e.departureMs + delta);
      const platformOverride = getPlatformOverride(e.routeId, e.tripOriginMs);
      const effPlatform = platformOverride && data.platforms.includes(platformOverride) ? platformOverride : e.platformName;
      // Ищем точное совпадение рейса в _depIdxCache по tripOriginMs.
      // Сопоставляем через tripOriginApproxMs (= a.arrival % 86400000).
      // Если нашли запись с realtime=true — берём реальные arrival/departure.
      const depTrips = _depIdxCache.get(e.routeId);
      let liveTrip = null;
      if (depTrips && depTrips.length > 0) {
        const TOLERANCE = 5 * 60 * 1000;
        let bestDiff = Infinity;
        for (const t of depTrips) {
          let diff = Math.abs(t.tripOriginApproxMs - e.arrivalMs);
          if (diff > 43200000) diff = 86400000 - diff;
          if (diff < bestDiff && diff <= TOLERANCE) { bestDiff = diff; liveTrip = t; }
        }
        // Только если realtime — иначе плановые данные не хуже
        if (liveTrip && !liveTrip.realtime) liveTrip = null;
      }
      // Если нашли живой рейс — подменяем arrivalMs и deviationMs
      const liveArrivalMs = liveTrip ? liveTrip.tripOriginApproxMs : null;
      const effectiveArrivalMs = liveArrivalMs !== null ? liveArrivalMs : e.arrivalMs;
      const effectiveDepartureMs = (liveTrip?.departureMs != null)
        ? liveTrip.departureMs
        : e.departureMs;
      const effectiveDeviationMs = liveTrip ? liveTrip.deviation : e.deviationMs;
      const isLiveData = !!liveTrip;
      // effArrival/effDeparture пересчитываем с live-данными + ручной правкой
      const effArrivalFinal = normalizeMs(effectiveArrivalMs + delta);
      const effDepartureFinal = effectiveDepartureMs === null
        ? null : normalizeMs(effectiveDepartureMs + delta);
      return {
        ...e,
        entryKey: `${e.routeId}:${e.tripOriginMs}:${e.platformName}`,
        delta,
        isEdited: delta !== 0,
        effArrival: effArrivalFinal,
        effDeparture: effDepartureFinal,
        effPlatform,
        isPlatformMoved: effPlatform !== e.platformName,
        deviationMs: effectiveDeviationMs,
        isLiveData,
      };
    })
    .filter((e) => visiblePlatforms.includes(e.effPlatform) && routeVisible(e.routeId) && typeVisible(e.routeType));

  // Видимые блоки — без скрытых обратных маршрутов
  const processed = allProcessed.filter(e => !e.hiddenByReverse);

  // Конфликты считаем по ВСЕМ записям (включая скрытые) чтобы
  // конечная S19 учитывалась при расчёте интервала
  const allForConflicts = allProcessed.filter(e => visiblePlatforms.includes(e.effPlatform));
  const { conflictKeys, details } = computeConflicts(allForConflicts, minIntervalMs);
  // Переносим conflictKeys со скрытых записей на их видимых партнёров
  for (const e of allProcessed) {
    if (!e.hiddenByReverse) continue;
    if (!conflictKeys.has(e.entryKey)) continue;
    // Ищем видимого партнёра
    const partner = processed.find(p =>
      p.routeId === e.pairedForwardRouteId &&
      p.tripOriginMs === e.pairedForwardTripOriginMs
    );
    if (partner) {
      conflictKeys.add(partner.entryKey);
      if (details.has(e.entryKey)) details.set(partner.entryKey, details.get(e.entryKey));
    }
  }
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
    // Уведомления о конфликтах теперь строятся по фоновому обходу всей сети
    // (см. runNotificationChecks), а не по одной открытой станции.
  }

  const byPlatform = new Map(visiblePlatforms.map((p) => [p, []]));
  for (const e of processed) byPlatform.get(e.effPlatform).push(e);

  let platformsHtml = "";
  let rowsHtml = "";
  for (const p of visiblePlatforms) {
    const list = byPlatform.get(p) || [];
    const pm = nextPlatformMeta(list);
    platformsHtml += `<div class="platform-label"><span class="pl-name">${escapeHtml(p)}</span><span class="next-only pl-meta"><b>${escapeHtml(pm.kind)}</b><small>${pm.dest ? "→ " + escapeHtml(pm.dest) : ""}</small></span></div>`;
    const blocks = list
      .map((e) => {
        const idx = state.currentDashboardEntries.indexOf(e);
        const leftPx = (toDisplayMs(e.effArrival) / MS_PER_DAY) * TIMELINE_WIDTH - 28;
        const devClass = Math.abs(e.deviationMs) <= 60000 ? "" : e.deviationMs > 0 ? "dev-late" : "dev-early";
        const liveClass = e.isLiveData ? "is-live" : "";
        const conflictClass = conflictKeys.has(e.entryKey) ? "has-conflict" : "";
        const editedClass = e.isEdited ? "is-edited" : "";
        const draftClass = e.isDraft ? "is-draft" : "";
        const movedClass = e.isPlatformMoved ? "is-platform-moved" : "";
        const chainClass = state.chainHl
          ? (state.chainHl.has(`${e.routeId}:${e.tripOriginMs}`) ? "chain-hl" : "chain-dim")
          : "";
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
        return `<div class="entry-block ${devClass} ${conflictClass} ${editedClass} ${draftClass} ${movedClass} ${liveClass} ${chainClass}" style="left:${leftPx}px;background:${e.color}" data-eidx="${idx}" data-entry-key="${escapeHtml(e.entryKey)}" data-route-id="${escapeHtml(e.routeId)}">
          ${dwellNub}
          <span class="eb-num">${escapeHtml(e.routeNumber || "•")}</span>
          <span class="eb-time">${formatLocal(normalizeMs(e.effArrival - e.deviationMs))}</span>
          ${Math.abs(e.deviationMs) > 60000
            ? `<span class="eb-actual-time" title="${escapeHtml(t("actualArrivalHint"))}">${e.deviationMs > 0 ? "▲" : "▼"}${formatLocal(e.effArrival)}</span>`
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
  nextPositionNowFlag();
  nextRenderBoardBar();
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
  const nowMs = toDisplayMs(getNowMsOfDay());
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
  const nowMs = toDisplayMs(getNowMsOfDay());
  const MARGIN_MS = 30 * 60000; // 30 мин слева для контекста
  const pxPerMs = state.dashPxPerHour / 3600000;
  const targetPx = Math.max(0, (nowMs - MARGIN_MS) * pxPerMs);
  const gs = document.getElementById("gridScroll");
  if (gs) gs.scrollLeft = targetPx;
  const rs = document.getElementById("rulerScroll");
  if (rs) rs.scrollLeft = targetPx;
}
function scrollGraphToNow() {
  const nowMs = toDisplayMs(getNowMsOfDay());
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
// Смещение от планового t0 (= отправление с ПОСЛЕДНЕЙ остановки у настоящих
// маршрутов) к отправлению ИЗ ДЕПО (первая остановка), считается так же, как
// колонка «отправление из депо» в шапке таблицы: плановое прибытие на первую
// станцию минус минута. Постоянно для всего маршрута.
function computeDepotOffsetMs(timetable) {
  const tr = timetable && timetable.trips && timetable.trips[0];
  const fs = tr && tr.times && tr.times[0];
  if (!fs) return 0;
  const plannedFirstArr = normalizeMs(fs.arrivalMs - (tr.deviationMs || 0));
  const depotDepart = normalizeMs(plannedFirstArr - 60000);
  let off = depotDepart - tr.tripOriginMs;
  off = ((off % MS_PER_DAY) + MS_PER_DAY) % MS_PER_DAY;
  if (off > MS_PER_DAY / 2) off -= MS_PER_DAY;
  return off;
}

function buildFormulaLinesFromTimes(t0List, routeId, depotOffset) {
  depotOffset = depotOffset || 0;
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
      lines.push({ type: "single", timeMs: normalizeMs(t0 + totalDelta + depotOffset), edited: true });
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
    // Эффективное начальное время с учётом равномерного сдвига и смещения депо
    const effT0 = normalizeMs(t0 + routeOffset + depotOffset);
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

// Приоритетная подсветка при наведении: наведённый блок и его конфликтные
// партнёры поднимаются наверх (z-index) и обводятся, чтобы пара читалась
// сразу — даже когда поезда идут плотно и прячутся друг за другом.
let _hoverHlEls = [];
function clearHoverHighlight() {
  for (const el of _hoverHlEls) el.classList.remove("eb-hover-focus", "eb-hover-pair");
  _hoverHlEls = [];
}
function setHoverHighlight(target, entry) {
  clearHoverHighlight();
  target.classList.add("eb-hover-focus");
  _hoverHlEls.push(target);
  // Партнёры по конфликту — из накопленных деталей текущего дашборда
  const partners = state.conflictDetails.get(entry.entryKey) || [];
  for (const p of partners) {
    const el = dashboardGrid.querySelector(`.entry-block[data-entry-key="${CSS.escape(p.entryKey)}"]`);
    if (el && el !== target) { el.classList.add("eb-hover-pair"); _hoverHlEls.push(el); }
  }
}

dashboardGrid.addEventListener("mousemove", (e) => {
  if (dragState.active) return;
  const target = e.target.closest(".entry-block");
  if (!target) { entryTooltip.style.display = "none"; clearHoverHighlight(); return; }
  const idx = Number(target.dataset.eidx);
  const entry = state.currentDashboardEntries[idx];
  if (!entry) return;
  // Приоритет наведения переключается СРАЗУ на текущий блок (не ждём ухода
  // курсора с предыдущего) — важно для плотно стоящих блоков.
  if (_hoverHlEls[0] !== target) setHoverHighlight(target, entry);
  entryTooltip.style.display = "block";
  entryTooltip.style.left = e.clientX + 16 + "px";
  entryTooltip.style.top = e.clientY + 16 + "px";
  entryTooltip.innerHTML = buildEntryTooltipHtml(entry);
});
dashboardGrid.addEventListener("mouseleave", () => { entryTooltip.style.display = "none"; clearHoverHighlight(); });

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
  dragState.ctrlAtStart = e.ctrlKey || e.metaKey;
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
      // Ctrl+клик — подсветка цепочки оборота вместо карточки маршрута
      if (dragState.ctrlAtStart) toggleChainHighlight(dragState.entry.routeId, dragState.entry.tripOriginMs);
      else openRouteModal(dragState.entry.routeId);
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
          bumpRouteOverrideWithReverse(dragState.entry.routeId, deltaMs);
        } else {
          const prev = getOverride(dragState.entry.routeId, dragState.entry.tripOriginMs);
          const nd = prev + deltaMs;
          setOverride(dragState.entry.routeId, dragState.entry.tripOriginMs, nd);
          applyReverseShift(dragState.entry.routeId, dragState.entry.tripOriginMs, nd);
        }
      }
      renderDashboardFromCache();
      renderGraphFromCache();
    }
  } else if (dragState.kind === "graph") {
    dragState.groupEls.forEach((el) => { el.style.transform = ""; });
    if (wasClick) {
      if (dragState.ctrlAtStart) toggleChainHighlight(dragState.routeId, dragState.tripOriginMs);
      else if (isNextUi()) {
        state._nxTrip = { routeId: dragState.routeId, t0: dragState.tripOriginMs };
        nextShowTrip(state._nxTrip);
      } else openRouteModal(dragState.routeId);
    } else {
      const TIMELINE_WIDTH = state.graphPxPerHour * 24;
      const deltaMs = (dx / TIMELINE_WIDTH) * MS_PER_DAY;
      pushUndoSnapshot();
      if (dragState.shiftMode) {
        bumpRouteOverrideWithReverse(dragState.routeId, deltaMs);
      } else {
        const prev = getOverride(dragState.routeId, dragState.tripOriginMs);
        const nd2 = prev + deltaMs;
        setOverride(dragState.routeId, dragState.tripOriginMs, nd2);
        applyReverseShift(dragState.routeId, dragState.tripOriginMs, nd2);
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
    if (!res.ok) { scheduleMeta.textContent = tServerError(data.error) || "Error"; return; }
    loadArrivals(stationId).catch(() => {});
    state.lastScheduleData = data;
    // Диагностика пар прямой/обратный
    const hidden = data.entries.filter(e => e.hiddenByReverse);
    const paired = data.entries.filter(e => e.pairedForwardRouteId);
    if (hidden.length || paired.length)
      console.log('[reverse] скрыто прямых:', hidden.length, '| обратных с парой:', paired.length);
    else
      console.log('[reverse] пар не найдено. Уникальных маршрутов:', new Set(data.entries.map(e=>e.routeId)).size);
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
document.getElementById("showPartialToggle")?.addEventListener("change", (e) => {
  state.showPartial = e.target.checked;
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
    if (!res.ok) { graphWrap.innerHTML = `<div class="dashboard-empty">${escapeHtml(tServerError(data.error))}</div>`; return; }
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

// После создания/изменения/удаления пробного маршрута кешей дашборда и
// графика уже недостаточно — они всё ещё содержат старые рейсы. Заново
// запрашиваем данные с сервера (там черновик уже добавлен/удалён).
async function refreshDataViews() {
  const tasks = [];
  if (state.currentStationId) tasks.push(loadSchedule().catch(() => {}));
  if (state.lastGraphData) tasks.push(buildGraph().catch(() => {}));
  await Promise.all(tasks);
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
  // Фильтр типов действует всегда — даже на маршруты, включённые вручную
  // кликом по легенде (иначе скрытый тип возвращался бы через override).
  if (state.graphTypeFilter && route.type && !state.graphTypeFilter.has(route.type)) return false;
  if (state.graphRouteOverrides.has(route.routeId)) return state.graphRouteOverrides.get(route.routeId);
  // Маршрут-сосед (совпадает с коридором лишь частично) — только если включён фильтр
  if (route.overlap === "partial" && !state.showPartial) return false;
  return state.showReverse || route.direction === "forward";
}

// Фильтр типов поездов на графике: список строится из типов текущего графика
function renderGraphTypeFilterList(data) {
  const container = document.getElementById("graphTypeFilterList");
  if (!container || !data) return;
  const types = Array.from(new Set((data.routes || []).map((r) => r.type).filter(Boolean))).sort();
  // Новый график (другая пара станций) — включаем все типы заново
  if (state.graphTypeFilterKey !== state.graphFilterKey || !state.graphTypeFilter) {
    state.graphTypeFilter = new Set(types);
    state.graphTypeFilterKey = state.graphFilterKey;
  }
  container.innerHTML = types
    .map((ty) => `<label title="${escapeHtml(ty)}"><input type="checkbox" data-ty="${escapeHtml(ty)}" ${state.graphTypeFilter.has(ty) ? "checked" : ""}> ${routeMarker(ty, "#8b8f9a", "", "md")} ${escapeHtml(routeTypeName(ty))}</label>`)
    .join("");
  container.querySelectorAll("input[type=checkbox]").forEach((cb) => {
    cb.addEventListener("change", () => {
      if (cb.checked) state.graphTypeFilter.add(cb.dataset.ty);
      else state.graphTypeFilter.delete(cb.dataset.ty);
      renderGraphFromCache();
    });
  });
}
document.getElementById("graphTypesSelectAll")?.addEventListener("click", () => {
  const d = state.lastGraphData;
  if (d) state.graphTypeFilter = new Set((d.routes || []).map((r) => r.type).filter(Boolean));
  renderGraphTypeFilterList(d);
  renderGraphFromCache();
});
document.getElementById("graphTypesSelectNone")?.addEventListener("click", () => {
  state.graphTypeFilter = new Set();
  renderGraphTypeFilterList(state.lastGraphData);
  renderGraphFromCache();
});
document.getElementById("showGraphConflictsToggle")?.addEventListener("change", (e) => {
  state.showGraphConflicts = e.target.checked;
  renderGraphFromCache();
});

function renderGraph(data) {
  renderGraphStationFilterList(data);
  renderGraphTypeFilterList(data);

  const leftMargin = 170;
  const topMargin = 30;
  const bottomMargin = 20;

  // Маршруты, которые реально будут нарисованы (showReverse/showPartial,
  // фильтр типов, ручные оверрайды легенды) — считаем ДО построения оси Y,
  // чтобы убрать с неё станции, которые сейчас не обслуживает НИ ОДИН
  // видимый маршрут (например все линии этого типа/направления скрыты).
  const routesToShow = data.routes.filter((r) => isGraphRouteVisible(r) && r.tripCount > 0);
  state.currentGraphRoutes = routesToShow;
  const stationIdsFromVisibleRoutes = new Set();
  for (const r of routesToShow) {
    for (const trip of r.trips) {
      for (const p of trip.points) stationIdsFromVisibleRoutes.add(p.stationId);
    }
  }

  const manualStationSelection = data.stations.filter((s) => state.graphStationFilter.has(s.stationId));
  const byManualFilter = manualStationSelection.length ? manualStationSelection : data.stations;
  const byRouteVisibility = byManualFilter.filter((s) => stationIdsFromVisibleRoutes.has(s.stationId));
  // Если фильтр маршрутов срезал вообще всё (например сняли все типы) — не
  // оставляем пустую ось без причины, показываем корридор как есть, чтобы
  // было видно "рисовать нечего", а не что график сломался.
  const stationsForAxis = byRouteVisibility.length ? byRouteVisibility : byManualFilter;
  const height = Math.max(420, stationsForAxis.length * 46) + topMargin + bottomMargin;
  const totalDistance = data.stations[data.stations.length - 1].distance || 1;
  const TIMELINE_WIDTH = state.graphPxPerHour * 24;

  // Минимальное расстояние между соседними станциями на графике
  const MIN_STATION_GAP_PX = 32;
  // Вычисляем сырые Y-позиции пропорционально дистанции
  const rawYPositions = stationsForAxis.map(s =>
    topMargin + (s.distance / totalDistance) * (height - topMargin - bottomMargin)
  );
  // Корректируем: раздвигаем станции если они слишком близко
  const adjY = [...rawYPositions];
  for (let i = 1; i < adjY.length; i++) {
    if (adjY[i] - adjY[i - 1] < MIN_STATION_GAP_PX) {
      adjY[i] = adjY[i - 1] + MIN_STATION_GAP_PX;
    }
  }
  // yScale теперь ищет позицию станции по дистанции через скорректированный массив
  const yScale = (dist) => {
    // Ищем ближайшую станцию по дистанции и берём её скорректированную Y
    let closest = 0;
    let minDiff = Infinity;
    for (let i = 0; i < stationsForAxis.length; i++) {
      const diff = Math.abs(stationsForAxis[i].distance - dist);
      if (diff < minDiff) { minDiff = diff; closest = i; }
    }
    return adjY[closest];
  };
  // Подписи станций теперь в graphYPanel (отдельный DOM-элемент слева),
  // поэтому xScale начинается с x=0 (без leftMargin-смещения).
  // tzShift переводит сырое время в локальное: график рендерится от
  // локальной полуночи до полуночи. Сдвиг НЕ нормализуется внутри xScale,
  // чтобы линия рейса оставалась монотонной — перенос через полночь
  // рисуется отдельной копией пути (см. ниже).
  const tzShiftMs = displayShiftMs();
  const xScale = (ms) => ((ms + tzShiftMs) / MS_PER_DAY) * TIMELINE_WIDTH;

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

  // Карта «Y → станция» для тултипа при наведении на линию рейса
  state._graphYMap = stationsForAxis.map((s, i) => ({ y: adjY[i], name: s.name, distance: s.distance }));

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
    // Ось 00:00–24:00 в ЛОКАЛЬНОМ времени: линии рейсов сдвинуты на tzShiftMs.
    const x = m * pxPerMinGraph;
    const isHour = m % 60 === 0;
    parts.push(`<line class="graph-gridline ${isHour ? "" : "graph-gridline-minor"}" x1="${x}" y1="${topMargin - 10}" x2="${x}" y2="${height - bottomMargin}"></line>`);
    if (m % labelMin === 0) {
      parts.push(`<text class="graph-time-label" x="${x}" y="${topMargin - 14}" text-anchor="middle">${formatUtc(m * 60000)}</text>`);
    }
  }
  parts.push(`</g>`);

  parts.push(`<g clip-path="url(#${clipId})">`);
  const tripRefs = []; // index -> {routeId, route, trip}
  // Начала/концы рейсов (для соединителей оборота) и остановки по
  // платформам (для маркеров конфликтов) — собираются в основном цикле
  const tripStarts = [];
  const tripEnds = [];
  const conflictEvents = [];
  const tripsGeo = []; // геометрия рейсов (движущиеся перегоны) — для детекта обгонов
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
        stationId: p.stationId,
        platformName: p.platformName,
      }));
      // points отсортированы по времени: [0] — начало рейса, [last] — конец
      const pFirst = effPoints[0], pLast = effPoints[effPoints.length - 1];
      if (pFirst && pFirst.stationId) {
        tripStarts.push({ routeId: route.routeId, t0: trip.tripOriginMs, stationId: pFirst.stationId, dist: pFirst.distance, effMs: pFirst.arrivalMs, baseMs: pFirst.arrivalMs - delta });
        tripEnds.push({ routeId: route.routeId, revId: route.reverseRouteId, color: route.color, t0: trip.tripOriginMs, stationId: pLast.stationId, dist: pLast.distance, effMs: pLast.arrivalMs, baseMs: pLast.arrivalMs - delta });
        for (const p of effPoints) {
          conflictEvents.push({
            key: p.stationId + "|" + (p.platformName || "?"),
            routeId: route.routeId, routeNumber: route.routeNumber || route.routeName, t0: trip.tripOriginMs,
            arr: p.arrivalMs, end: Math.max(p.departureMs ?? p.arrivalMs, p.arrivalMs), dist: p.distance,
            stationId: p.stationId, // нужен контекстному меню графика: где именно конфликт
          });
        }
        // Геометрия движущихся перегонов рейса (для детекта обгонов через
        // пересечение линий, а НЕ через совпадение ключа станций — у
        // маршрутов разный набор промежуточных остановок).
        // Отрезки в осях (t = сырое ms, y = ПИКСЕЛЬ через yScale) — так
        // пересечение совпадает с нарисованными линиями (yScale нелинейна).
        const dir = Math.sign((pLast.distance - pFirst.distance) || 1);
        const movingSegs = [];
        let yLo = Infinity, yHi = -Infinity;
        for (let pi = 0; pi < effPoints.length - 1; pi++) {
          const a = effPoints[pi], b = effPoints[pi + 1];
          if (a.distance === b.distance) continue; // стоянка — не перегон
          const ya = yScale(a.distance), yb = yScale(b.distance);
          movingSegs.push({
            t1: a.departureMs !== null ? a.departureMs : a.arrivalMs, y1: ya,
            t2: b.arrivalMs, y2: yb,
          });
          yLo = Math.min(yLo, ya, yb); yHi = Math.max(yHi, ya, yb);
        }
        if (movingSegs.length) {
          tripsGeo.push({
            routeId: route.routeId, routeNumber: route.routeNumber || route.routeName, t0: trip.tripOriginMs,
            dir, movingSegs,
            tMin: Math.min(effPoints[0].arrivalMs, pLast.arrivalMs),
            tMax: Math.max(effPoints[0].arrivalMs, pLast.arrivalMs),
            yMin: yLo, yMax: yHi,
          });
        }
      }
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
      const chainClass = state.chainHl
        ? (state.chainHl.has(`${route.routeId}:${trip.tripOriginMs}`) ? "chain-hl" : "chain-dim")
        : "";
      parts.push(`<path class="graph-trip-hit" d="${d}" data-tref="${refIdx}" data-route-id="${escapeHtml(route.routeId)}"></path>`);
      parts.push(`<path class="graph-trip-path ${dirClass} ${editedClass} ${draftClass} ${chainClass}" d="${d}" stroke="${route.color}" data-tref="${refIdx}" data-route-id="${escapeHtml(route.routeId)}"></path>`);
      // Перенос через полночь В ЛОКАЛЬНОМ времени: если рейс (со сдвигом
      // tzShiftMs) выходит за правый край — рисуем копию на сутки раньше,
      // если за левый — копию на сутки позже. Основной путь клипается.
      if (events[events.length - 1].ms + tzShiftMs >= MS_PER_DAY) {
        let dYesterday = "";
        events.forEach((ev, i) => {
          dYesterday += (i === 0 ? "M" : "L") + `${xScale(ev.ms - MS_PER_DAY)},${yScale(ev.distance)} `;
        });
        parts.push(`<path class="graph-trip-hit" d="${dYesterday}" data-tref="${refIdx}" data-route-id="${escapeHtml(route.routeId)}"></path>`);
        parts.push(`<path class="graph-trip-path ${dirClass} ${editedClass} ${draftClass} ${chainClass}" d="${dYesterday}" stroke="${route.color}" data-tref="${refIdx}" data-route-id="${escapeHtml(route.routeId)}"></path>`);
      }
      if (events[0].ms + tzShiftMs < 0) {
        let dTomorrow = "";
        events.forEach((ev, i) => {
          dTomorrow += (i === 0 ? "M" : "L") + `${xScale(ev.ms + MS_PER_DAY)},${yScale(ev.distance)} `;
        });
        parts.push(`<path class="graph-trip-hit" d="${dTomorrow}" data-tref="${refIdx}" data-route-id="${escapeHtml(route.routeId)}"></path>`);
        parts.push(`<path class="graph-trip-path ${dirClass} ${editedClass} ${draftClass} ${chainClass}" d="${dTomorrow}" stroke="${route.color}" data-tref="${refIdx}" data-route-id="${escapeHtml(route.routeId)}"></path>`);
      }
      if (isEdited || route.isDraft) {
        const midX = (toDisplayMs(effPoints[0].arrivalMs) / MS_PER_DAY) * TIMELINE_WIDTH;
        const midY = yScale(effPoints[0].distance) - 6;
        parts.push(`<text class="graph-edited-tag" x="${midX}" y="${midY}">${escapeHtml(route.isDraft ? t("draftBadge") : t("editedLabel"))}</text>`);
      }
    }
  }

  // ── Соединители оборота: конец прямого рейса стыкуется с началом
  // обратного на конечной (тот же состав) — рисуем перемычку, чтобы
  // линии читались как один непрерывный путь поезда ──
  // Заодно запоминаем такие пары: для маркеров конфликтов оборот — не конфликт.
  const linkedPairs = new Set();
  {
    const TURN_TOL = 6 * 60000;
    const startsByStation = new Map();
    for (const s of tripStarts) {
      if (!startsByStation.has(s.stationId)) startsByStation.set(s.stationId, []);
      startsByStation.get(s.stationId).push(s);
    }
    // Сегмент короткий (минуты) — при выходе за края суток в локальном
    // времени переносим его целиком на ±сутки
    const daySnap = (ms) => {
      const disp = ms + tzShiftMs;
      return disp >= MS_PER_DAY ? -MS_PER_DAY : disp < 0 ? MS_PER_DAY : 0;
    };
    for (const en of tripEnds) {
      if (!en.revId) continue;
      let best = null, bestDiff = Infinity;
      for (const st of (startsByStation.get(en.stationId) || [])) {
        if (st.routeId !== en.revId) continue;
        const diff = st.baseMs - en.baseMs;
        if (diff < -60000 || diff > TURN_TOL) continue;
        if (Math.abs(diff) < bestDiff) { bestDiff = Math.abs(diff); best = st; }
      }
      if (!best) continue;
      linkedPairs.add(en.routeId + ":" + en.t0 + "|" + best.routeId + ":" + best.t0);
      linkedPairs.add(best.routeId + ":" + best.t0 + "|" + en.routeId + ":" + en.t0);
      const ds = daySnap((en.effMs + best.effMs) / 2);
      const y = yScale(en.dist);
      const chainCls = state.chainHl
        ? (state.chainHl.has(`${en.routeId}:${en.t0}`) ? "chain-hl" : "chain-dim")
        : "";
      parts.push(`<line class="graph-turnaround-link ${chainCls}" x1="${xScale(en.effMs + ds)}" y1="${y}" x2="${xScale(best.effMs + ds)}" y2="${y}" stroke="${en.color}"></line>`);
    }

    // Собираем конфликты в state._graphConflicts — по ним рисуем маркеры
    // (с data-cidx), слабо-прозрачные пунктирные связи между линиями и
    // интерактивный тултип (проблема + решение) при наведении.
    const conflicts = [];
    const minIntervalMs = state.minIntervalMin * 60000;

    // ── (1) Станционные конфликты: два поезда на одной платформе одной
    // станции ближе минимального интервала (обороты состава пропускаем) ──
    const groupsCf = new Map();
    for (const ev of conflictEvents) {
      if (!groupsCf.has(ev.key)) groupsCf.set(ev.key, []);
      groupsCf.get(ev.key).push(ev);
    }
    for (const evs of groupsCf.values()) {
      evs.sort((a, b) => a.arr - b.arr);
      for (let i = 0; i < evs.length; i++) {
        const cur = evs[i];
        for (let j = i + 1; j < evs.length; j++) {
          const nx = evs[j];
          if (nx.arr >= cur.end + minIntervalMs) break;
          if (cur.routeId === nx.routeId && cur.t0 === nx.t0) continue;
          if (linkedPairs.has(cur.routeId + ":" + cur.t0 + "|" + nx.routeId + ":" + nx.t0)) continue;
          const gapMin = Math.round((nx.arr - cur.end) / 60000);
          const needMin = Math.ceil((minIntervalMs - (nx.arr - cur.end)) / 60000);
          conflicts.push({
            kind: "station",
            x1: xScale(cur.arr + daySnap(cur.arr)), x2: xScale(nx.arr + daySnap(nx.arr)),
            y1: yScale(cur.dist), y2: yScale(cur.dist),
            mx: (cur.arr + nx.arr) / 2, my: yScale(cur.dist),
            a: cur, b: nx,
            problem: t("gcStationProblem", { r1: cur.routeNumber, t1: formatLocal(normalizeMs(cur.arr)), r2: nx.routeNumber, t2: formatLocal(normalizeMs(nx.arr)), gap: gapMin }),
            solution: t("gcStationSolution", { need: Math.max(1, needMin) }),
          });
        }
      }
    }

    // ── (2) Обгоны: два рейса В ОДНУ сторону, чьи линии ПЕРЕСЕКАЮТСЯ на
    // перегоне — задний догнал переднего и «проехал сквозь» (физически
    // встал бы ему в хвост). Считаем пересечением отрезков в осях (t,d),
    // поэтому разный набор промежуточных станций не мешает. Максимум один
    // маркер на пару рейсов (первое пересечение), встречные — не конфликт ──
    const seenPair = new Set();
    for (let ia = 0; ia < tripsGeo.length; ia++) {
      const A = tripsGeo[ia];
      for (let ib = ia + 1; ib < tripsGeo.length; ib++) {
        const B = tripsGeo[ib];
        if (A.dir !== B.dir) continue;                                 // встречные — норма
        if (A.tMax <= B.tMin || B.tMax <= A.tMin) continue;            // не пересекаются по времени
        if (A.yMax <= B.yMin || B.yMax <= A.yMin) continue;            // не пересекаются по вертикали
        const pairKey = A.routeId + ":" + A.t0 + "|" + B.routeId + ":" + B.t0;
        if (seenPair.has(pairKey)) continue;
        let hit = null;
        for (const sa of A.movingSegs) {
          for (const sb of B.movingSegs) {
            const x = segIntersect(sa.t1, sa.y1, sa.t2, sa.y2, sb.t1, sb.y1, sb.t2, sb.y2);
            if (x) { hit = x; break; }
          }
          if (hit) break;
        }
        if (!hit) continue;
        seenPair.add(pairKey);
        conflicts.push({
          kind: "overtake",
          mx: hit.t, my: hit.d,
          a: { routeId: A.routeId, routeNumber: A.routeNumber, t0: A.t0 },
          b: { routeId: B.routeId, routeNumber: B.routeNumber, t0: B.t0 },
          problem: t("gcOvertakeProblem", { r1: A.routeNumber, r2: B.routeNumber, tm: formatLocal(normalizeMs(hit.t)) }),
          solution: t("gcOvertakeSolution"),
        });
      }
    }

    // Конфликты считаем всегда (нужны контекстному меню и тултипам),
    // а рисуем — только если включён фильтр «Показывать конфликты»
    state._graphConflicts = conflicts;
    setTimeout(nextRenderGraphBar, 0);
    if (state.showGraphConflicts) {
      conflicts.forEach((c, ci) => {
        // Слабо-прозрачная пунктирная связь между линиями конфликтующих поездов
        if (c.kind === "station") {
          parts.push(`<line class="graph-conflict-link" x1="${c.x1}" y1="${c.y1}" x2="${c.x2}" y2="${c.y2}"></line>`);
        }
        const cx = xScale(c.mx + daySnap(c.mx));
        // новый вид: обгон — жёлтый ромб, конфликт на станции — красный круг (как в макете)
        if (c.kind === "overtake" && isNextUi()) {
          parts.push(`<rect class="graph-conflict-marker overtake" data-cidx="${ci}" x="${cx - 5}" y="${c.my - 5}" width="10" height="10" transform="rotate(45 ${cx} ${c.my})"></rect>`);
        } else {
          parts.push(`<circle class="graph-conflict-marker ${c.kind}" data-cidx="${ci}" cx="${cx}" cy="${c.my}" r="5"></circle>`);
        }
      });
    }
  }
  parts.push("</g>");

  {
    const nowMs = getNowMsOfDay();
    const nowX = (toDisplayMs(nowMs) / MS_PER_DAY) * TIMELINE_WIDTH;
    parts.push(`<line id="graphNowLine" class="graph-now-line" x1="${nowX}" y1="${topMargin - 10}" x2="${nowX}" y2="${height - bottomMargin}"></line>`);
  }

  parts.push("</svg>");
  graphWrap.innerHTML = parts.join("");
  // Ограничиваем высоту graphWrap высотой SVG чтобы скролл не уходил дальше
  graphWrap.style.maxHeight = height + "px";
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
    graphYPanel.style.maxHeight = height + "px";
    // #graphWrap имеет и вертикальный, И горизонтальный скроллбар (24 часа
    // по времени шире контейнера) — горизонтальный съедает несколько px
    // clientHeight снизу, поэтому его МАКСИМАЛЬНЫЙ scrollTop больше, чем у
    // graphYPanel (там только вертикальный скролл). При скролле до упора
    // расхождение срезалось браузером — линии станций и подписи слева
    // расходились у нижнего края. Меряем разницу предельных scrollTop
    // напрямую и добавляем панели ровно такой запас снизу, чтобы её
    // максимальный scrollTop совпал с графиком (устойчиво к под-пикселям
    // и рамкам, в отличие от вычисления по высоте скроллбара).
    graphYPanel.style.paddingBottom = "";
    const graphMaxScroll = graphWrap.scrollHeight - graphWrap.clientHeight;
    const panelMaxScroll = graphYPanel.scrollHeight - graphYPanel.clientHeight;
    const extra = graphMaxScroll - panelMaxScroll;
    if (extra > 0) graphYPanel.style.paddingBottom = extra + "px";
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
      if (state.graphTypeFilter && r.type && !state.graphTypeFilter.has(r.type)) return false; // фильтр типов
      if (r.overlap === "partial" && !state.showPartial) return false; // соседи — по галочке
      if (r.direction !== "backward") return true;
      return state.showReverse; // показываем все обратные только когда галочка включена
    })
    .map((r) => {
      const visible = isGraphRouteVisible(r);
      const inactive = r.tripCount === 0;
      return `<div class="graph-legend-item ${visible ? "" : "dim"} ${inactive ? "inactive" : ""}" data-route="${r.routeId}" data-dir="${r.direction}" title="${inactive ? escapeHtml(t("graphInactiveRoute")) : ""}">
        ${routeMarker(r.type, r.color, r.routeNumber, "sm")}
        ${escapeHtml(r.routeName)}${r.routeNumber ? " · " + escapeHtml(r.routeNumber) : ""}
        ${r.overlap === "partial" ? `<span class="dir-tag" title="${escapeHtml(t("graphPartialHint"))}">${escapeHtml(t("graphPartialShort"))}</span>` : ""}
        ${r.direction === "backward" ? `<span class="dir-tag">${escapeHtml(t("directionBackwardShort"))}</span>` : ""}
        (${r.tripCount} ${escapeHtml(t("tripsPerDay", {n: r.tripCount}))})
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

// ── Тултип при наведении на линию рейса (как у блока на дашборде) ────
graphWrap.addEventListener("mousemove", (e) => {
  if (dragState.active) { entryTooltip.style.display = "none"; return; }
  // Приоритет — маркер конфликта: показываем проблему и решение
  const cMark = e.target.closest(".graph-conflict-marker");
  if (cMark) {
    const c = (state._graphConflicts || [])[Number(cMark.dataset.cidx)];
    if (c) {
      entryTooltip.style.display = "block";
      entryTooltip.style.left = e.clientX + 16 + "px";
      entryTooltip.style.top = e.clientY + 16 + "px";
      const hdr = c.kind === "overtake" ? t("gcOvertakeLabel") : t("conflictLabel");
      entryTooltip.innerHTML =
        `<b>⚠ ${escapeHtml(hdr)}</b>` +
        `<div><span class="dev-pos">${escapeHtml(t("gcProblemLabel"))}:</span> ${escapeHtml(c.problem)}</div>` +
        `<div><span class="dev-early">${escapeHtml(t("gcSolutionLabel"))}:</span> ${escapeHtml(c.solution)}</div>`;
      return;
    }
  }
  const target = e.target.closest("[data-tref]");
  if (!target) { entryTooltip.style.display = "none"; return; }
  const ref = state.graphTripRefs[Number(target.dataset.tref)];
  if (!ref) return;
  // Ближайшая станция по вертикали курсора
  const rect = graphWrap.getBoundingClientRect();
  const yIn = e.clientY - rect.top + graphWrap.scrollTop;
  let stn = null, bestDy = Infinity;
  for (const m of state._graphYMap || []) {
    const dy = Math.abs(m.y - yIn);
    if (dy < bestDy) { bestDy = dy; stn = m; }
  }
  // Точка рейса на этой станции (по дистанции оси Y)
  let pt = null, bestDd = Infinity;
  for (const p of ref.effPoints) {
    const dd = Math.abs(p.distance - (stn ? stn.distance : 0));
    if (dd < bestDd) { bestDd = dd; pt = p; }
  }
  const r = ref.route;
  let html = `<b>${r.isDraft ? draftFlagHtml() + " " : ""}${escapeHtml(r.routeName)}${r.routeNumber ? " · " + escapeHtml(r.routeNumber) : ""}</b>`;
  if (stn) html += `<br>${escapeHtml(stn.name)}`;
  if (pt) {
    html += `<br>${t("arrivalLabel")}: ${formatLocal(normalizeMs(pt.arrivalMs))}` +
      (pt.departureMs !== null ? " · " + t("departureLabel") + ": " + formatLocal(normalizeMs(pt.departureMs)) : "");
  }
  html += `<br>${t("deviationLabel")}: <span class="${deviationClass(ref.trip.deviationMs)}">${formatDeviation(ref.trip.deviationMs)}</span>`;
  if (ref.isEdited) {
    const sign = ref.delta > 0 ? "+" : "−";
    html += `<br><i>${escapeHtml(t("editedNote"))} (${sign}${formatMinutesShort(Math.round(Math.abs(ref.delta) / 60000))})</i>`;
  }
  entryTooltip.style.display = "block";
  entryTooltip.style.left = e.clientX + 16 + "px";
  entryTooltip.style.top = e.clientY + 16 + "px";
  entryTooltip.innerHTML = html;
});
graphWrap.addEventListener("mouseleave", () => { entryTooltip.style.display = "none"; });

graphWrap.addEventListener("mousedown", (e) => {
  if (e.button !== 0) return; // ПКМ и средняя кнопка не запускают drag — иначе
  // правый клик засчитывался как "клик без сдвига" на mouseup и открывал
  // карточку маршрута вместо контекстного меню
  const target = e.target.closest(".graph-trip-hit");
  if (!target) return;
  const refIdx = Number(target.dataset.tref);
  const ref = state.graphTripRefs[refIdx];
  if (!ref) return;
  dragState.active = true;
  dragState.kind = "graph";
  dragState.refIdx = refIdx;
  dragState.routeId = ref.route.routeId;
  dragState.tripOriginMs = ref.trip.tripOriginMs;
  dragState.startX = e.clientX;
  dragState.moved = 0;
  dragState.shiftMode = e.shiftKey;
  dragState.ctrlAtStart = e.ctrlKey || e.metaKey;
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
    types.map((ty) => `<option value="${escapeHtml(ty)}">${escapeHtml(routeTypeName(ty))}</option>`).join("");
  renderRouteMarkersSettings(); // маршруты загружены — в настройках появляются типы этого сервера
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
  // Скрываем черновики у которых ни одна остановка не найдена на текущем сервере
  if (state.stations.length > 0) {
    const stationIds = new Set(state.stations.map(s => s.id));
    filtered = filtered.filter(r => {
      if (!r.isDraft) return true; // реальные маршруты всегда показываем
      if (!r.stops || r.stops.length === 0) return true; // черновик без остановок — показываем
      return r.stops.some(s => stationIds.has(s.stationId));
    });
  }
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
  nextRenderRouteGroups(routes);
  const body = document.getElementById("routeListBody");
  if (routes.length === 0) { body.innerHTML = `<tr><td colspan="8" class="empty">${escapeHtml(t("analyticsEmptyNoMatch"))}</td></tr>`; return; }
  body.innerHTML = routes
    .map((r) => {
      const a = r.analytics;
      const isFav = isFavoriteRoute(r.id);
      return `<tr class="clickable-row" data-route-id="${r.id}">
        <td>
          <span class="route-pill">${routeMarker(r.type, r.color, r.number, "md")}${isFav ? "<span style='color:#fbbf24;margin-right:3px;'>★</span>" : ""}${escapeHtml(r.name)}${r.isDraft ? " " + draftFlagHtml() : ""}</span>
        </td>
        <td>${escapeHtml(r.number || t("notAvailableShort"))}</td>
        <td>${escapeHtml(r.type ? routeTypeName(r.type) : t("notAvailableShort"))}</td>
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
      closeRouteModal();
      openDraftForm(d);
    });
  });
  body.querySelectorAll("[data-delete-draft]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm(t("draftConfirmDelete"))) return;
      await fetch(`/api/drafts/${btn.dataset.deleteDraft}`, { method: "DELETE" });
      await loadRoutes();
      await refreshDataViews();
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

// Переход на вкладку «Расписание по станции» с выбранной станцией
// (карточка маршрута, схема сети)
function gotoStationSchedule(stationId) {
  const station = state.stations.find((s) => s.id === stationId);
  switchToTab("schedule");
  state.currentStationId = stationId;
  scheduleAC.setSelected(stationId, station ? station.name : stationId);
  renderFavoritesBar();
  updateFavoriteBtn();
  return loadSchedule();
}

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
    if (!detailRes.ok) { document.getElementById("routeModalBody").innerHTML = `<p>${escapeHtml(tServerError(detail.error))}</p>`; return; }
    const timetable = timetableRes.ok ? await timetableRes.json() : null;
    // Загружаем arrivals для схемы состава (async, не блокируем рендер)
    if (detail?.stops?.length > 0) {
      const firstStId = detail.stops[0].stationId;
      loadArrivals(firstStId).then(() => {
        const diagramWrap = document.querySelector("#routeModalBody .train-diagram-wrap");
        const slot = document.getElementById("nxcConsist");
        if (!diagramWrap && slot) {
          const cars2 = _carsCache.get(detail.number);
          if (cars2 && cars2.length) {
            slot.innerHTML = buildTrainDiagramSvg(detail.number || detail.name, detail.type, cars2.length, "#ffffff", cars2);
            slot.closest(".nxc-block")?.removeAttribute("hidden");
            const n = slot.closest(".nxc-block")?.querySelector(".nxc-cars");
            if (n) n.textContent = t("nxcCars", { n: cars2.length });
          }
        } else if (!diagramWrap) {
          const cars2 = _carsCache.get(detail.number);
          const n = cars2 ? cars2.length : null;
          if (n) {
            const svgHtml = buildTrainDiagramSvg(detail.number || detail.name, detail.type, n, "#ffffff", cars2);
            const h4stops = document.querySelector("#routeModalBody h4[data-stops-header]") ||
              Array.from(document.querySelectorAll("#routeModalBody h4"))[0];
            if (h4stops && svgHtml) {
              const div = document.createElement("div");
              div.innerHTML = svgHtml;
              h4stops.parentNode.insertBefore(div.firstChild, h4stops);
            }
          }
        }
      }).catch(() => {});
    }
    // Вычисляем конфликты с учётом ручных правок (overrides):
    // серверный endpoint не знает о drag-сдвигах, поэтому считаем на фронтенде.
    // Для каждой станции маршрута загружаем её расписание и ищем конфликты.
    const conflictMap = new Map(); // tripOriginMs -> Set<stationId>
    // Для кнопки «Сдвинуть» в новой карточке: наш рейс и его партнёры по каждому конфликту
    const conflictPairs = new Map(); // "t0|stationId" -> { me, partners[] }

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
          // entryKey нужен для computeConflicts
          const entryKey = `${e.routeId}:${e.tripOriginMs}:${e.platformName}`;
          return { ...e, effArrival, effDeparture, delta, entryKey };
        });
        const { conflictKeys, details } = computeConflicts(processed, minIntervalMs);
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
          const me = processed.find((e) => e.entryKey === key);
          if (me) conflictPairs.set(`${t0}|${stationId}`, { me, partners: (details && details.get(key)) || [] });
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
    state.lastRouteConflictPairs = conflictPairs;
    renderRouteModal(detail, timetable, rawDraft, conflictedTrips);
  } catch (err) {
    document.getElementById("routeModalBody").innerHTML = `<p>${escapeHtml(t("errLoading", { msg: err.message }))}</p>`;
  }
}

// Строит HTML-секцию "Активные поезда" из _arrivalsCache для данного маршрута
function buildLiveTripsSection(routeId, lang) {
  const trips = _depIdxCache.get(routeId);
  if (!trips || trips.length === 0) return "";
  // Только realtime
  const live = trips.filter(t => t.realtime);
  if (live.length === 0) return "";

  const rows = live.map(t => {
    const devMs = t.deviation || 0;
    const devMin = Math.round(devMs / 60000);
    const devHtml = Math.abs(devMs) < 60000
      ? `<span style="color:var(--green)">●</span>`
      : `<span style="color:${devMs > 0 ? "var(--red)" : "var(--green)"}">
          ${devMs > 0 ? "+" : ""}${devMin} ${lang === "ru" ? "мин" : "min"}
         </span>`;
    // arrival — epoch ms → мс от полуночи → formatLocal
    const arrivalOfDay = t.tripOriginApproxMs;
    const carHtml = t.carCount != null
      ? `<span title="${lang === "ru" ? "Вагонов" : "Cars"}">${"🚃".repeat(Math.min(t.carCount, 8))} ${t.carCount}</span>`
      : "—";
    return `<tr>
      <td><b>#${t.departureIndex}</b></td>
      <td>${formatUtc(arrivalOfDay)}</td>
      <td>${escapeHtml(t.platformName || "—")}</td>
      <td>${carHtml}</td>
      <td>${devHtml}</td>
    </tr>`;
  }).join("");

  const h = lang === "ru" ? "Активные поезда (live)" : "Active trains (live)";
  const cols = lang === "ru"
    ? ["Рейс", "Прибытие", "Платформа", "Состав", "Задержка"]
    : ["Trip", "Arrival", "Platform", "Consist", "Delay"];
  return `
    <h4>🔴 ${h}</h4>
    <div class="timetable-scroll-wrap">
      <table class="live-trips-table">
        <thead><tr>${cols.map(c => `<th>${c}</th>`).join("")}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}


// Генерирует SVG-схему состава поезда (минималистичный стиль)
// Значки нерельсовых/особых видов транспорта. Тип маршрута MTR может
// содержать в названии bus/tram/boat/cable_car — тогда в карточке рисуем
// соответствующий значок вместо схемы поезда. Стиль монохромный, в тон
// схеме состава (нейтральный акцент, не цвет маршрута).
function buildVehicleIconSvg(mode) {
  const fill = "#e8e8e8", stroke = "#bbb", win = "#2a3a4a", winStroke = "#1a2a3a", accent = "#9aa4b0";
  const W = 96, H = 48;
  const p = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block">`];
  if (mode === "boat") {
    p.push(`<path d="M4 38 q6 -4 12 0 t12 0 t12 0 t12 0 t12 0 t12 0" fill="none" stroke="#4a90d9" stroke-width="1.6"/>`);
    p.push(`<path d="M14 25 L82 25 L74 37 L22 37 Z" fill="${fill}" stroke="${stroke}" stroke-width="1.2"/>`);
    p.push(`<rect x="14" y="25" width="68" height="4" fill="${accent}"/>`);
    p.push(`<rect x="34" y="11" width="28" height="14" rx="2" fill="${fill}" stroke="${stroke}" stroke-width="1.2"/>`);
    for (let i = 0; i < 2; i++) p.push(`<rect x="${39 + i * 12}" y="15" width="8" height="6" rx="1" fill="${win}" stroke="${winStroke}" stroke-width="0.5"/>`);
    p.push(`<rect x="52" y="5" width="5" height="7" fill="${accent}"/>`);
  } else if (mode === "cable_car") {
    p.push(`<line x1="4" y1="8" x2="92" y2="16" stroke="#888" stroke-width="1.6"/>`);
    p.push(`<rect x="42" y="10" width="12" height="4" rx="1.5" fill="#999" stroke="#777"/>`);
    p.push(`<path d="M48 14 L44 24 M48 14 L52 24" stroke="#888" stroke-width="1.3" fill="none"/>`);
    p.push(`<rect x="34" y="24" width="28" height="18" rx="4" fill="${fill}" stroke="${stroke}" stroke-width="1.2"/>`);
    p.push(`<path d="M38 24 h20 a4 4 0 0 1 4 4 v0 h-28 v0 a4 4 0 0 1 4 -4 z" fill="${accent}"/>`);
    p.push(`<rect x="39" y="31" width="18" height="8" rx="1.5" fill="${win}" stroke="${winStroke}" stroke-width="0.5"/>`);
  }
  p.push(`</svg>`);
  return '<div class="train-diagram-wrap">' + p.join("") + '</div>';
}

function detectVehicleMode(routeType) {
  const rt = (routeType || "").toLowerCase();
  // Отдельные значки-«модели» трамваев и автобусов убраны: трамваи рисуются
  // детальной схемой вагонов (см. isTram в buildTrainDiagramSvg). Особыми
  // значками остаются только паром и канатная дорога.
  if (rt.includes("cable")) return "cable_car";
  if (rt.includes("boat")) return "boat";
  return null;
}

function buildTrainDiagramSvg(routeName, routeType, carCount, color, cars) {
  if (!carCount || carCount < 1) return "";

  // Тип отрисовки: трамвай / автобус / троллейбус (автобус с «рогами»,
  // определяется по "trol" в vehicleId). Всё остальное — схема поездов ниже.
  const _rt = (routeType || "").toLowerCase();
  const isTram = _rt.includes("tram");
  const isBus = _rt.includes("bus");
  const isTrolley = isBus && (cars || []).some(c => ((c.vehicleId || "") + "").toLowerCase().includes("trol"));
  if (isTram) return buildTramDiagramSvg(carCount);
  if (isBus) return buildBusDiagramSvg(carCount, isTrolley);

  // Паром/канатка — рисуем значок вида транспорта, не поезд.
  const mode = detectVehicleMode(routeType);
  if (mode) return buildVehicleIconSvg(mode);

  function getBaseCarType(idx) {
    if (cars && cars[idx]) {
      const vid = (cars[idx].vehicleId || "").toLowerCase();
      // Локомотив
      if (vid.includes("locomotive")) return "loco";
      // Головной: cab_foward (опечатка в MTR API), cab_forward, cab_1, cab_cab_1
      if (vid.includes("cab_foward") || vid.includes("cab_forward") ||
          vid.endsWith("_cab_1") || vid.endsWith("_cab_foward") ||
          vid.endsWith("_cab_open_1") || vid.includes("head_front")) return "head";
      // Хвостовой: cab_backward, cab_2, cab_open_2
      if (vid.includes("cab_backward") ||
          vid.endsWith("_cab_2") || vid.endsWith("_cab_backward") ||
          vid.endsWith("_cab_open_2") || vid.includes("head_rear")) return "tail";
      // Кабина без явного направления (просто "cab" в id)
      if (vid.includes("cab")) return "cab";
      // Промежуточные: carriage, trailer, scarriage, panto и т.д.
      return "middle";
    }
    // Fallback по имени маршрута
    const n = (routeName || "").toLowerCase();
    const isICE = /ice/i.test(routeName || "");
    const isEMU = /s[0-9]|s-bahn|sbahn|metro|u-bahn|ubahn|stadtbahn|tram/i.test(n);
    const hasLoco = !isICE && !isEMU && /\bic\b|\brb\b|\bre\b|flixtrain|flx|irex|jnr/i.test(routeName || "");
    if (idx === 0 && hasLoco) return "loco";
    return "middle";
  }

  // Итоговые типы вагонов: не у всех поездов в id вагонов есть "cab",
  // поэтому первый/последний вагоны по умолчанию рисуем со скосом (если это
  // не локомотив), а пару соседних кабин в середине состава (две сцепленные
  // секции) — скосами друг к другу.
  const carTypes = [];
  for (let ci = 0; ci < carCount; ci++) carTypes.push(getBaseCarType(ci));
  const isCabish = (t) => t === "head" || t === "tail" || t === "cab";
  if (carTypes[0] !== "loco") carTypes[0] = "head";
  if (carCount > 1 && carTypes[carCount - 1] !== "loco") carTypes[carCount - 1] = "tail";
  for (let ci = 1; ci < carCount - 2; ci++) {
    if (isCabish(carTypes[ci]) && isCabish(carTypes[ci + 1])) {
      carTypes[ci] = "tail";     // скос вправо — «нос» к соседу
      carTypes[ci + 1] = "head"; // скос влево — «нос» навстречу
      ci++;
    }
  }
  // Одиночная кабина без направления в середине — рисуем обычным вагоном
  for (let ci = 1; ci < carCount - 1; ci++) {
    if (carTypes[ci] === "cab") carTypes[ci] = "middle";
  }

  const W = 44, H = 22, GAP = 2, NOSE = 10, PAD = 12;
  const totalW = carCount * W + (carCount - 1) * GAP + PAD * 2;
  const PANTO_H = 14; // высота пантографа над крышей
  const totalH = PANTO_H + H + 14; // сверху место для пантографа
  const p = [];

  p.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + totalW + '" height="' + totalH + '" style="display:block">');

  for (let i = 0; i < carCount; i++) {
    const x = PAD + i * (W + GAP), y = PANTO_H + 2; // сдвиг вниз под пантограф
    const type = carTypes[i];

    if (type === "loco") {
      // Локомотив: 6-угольник — верх скошен (NOSE), нижние скосы у самого дна
      const BN = 5; // нижний скос
      const CUT = Math.round(H * 0.78); // где начинаются нижние скосы (78% высоты)
      const lpath =
        "M" + (x+NOSE) + " " + y +
        " L" + (x+W-NOSE) + " " + y +
        " L" + (x+W) + " " + (y+CUT) +
        " L" + (x+W-BN) + " " + (y+H) +
        " L" + (x+BN) + " " + (y+H) +
        " L" + x + " " + (y+CUT) +
        " Z";
      p.push('<path d="' + lpath + '" fill="#e8e8e8" stroke="#bbb" stroke-width="1"/>');
      // Полоса крыши как у обычных вагонов
      p.push('<line x1="' + (x+NOSE) + '" y1="' + (y+1) + '" x2="' + (x+W-NOSE) + '" y2="' + (y+1) + '" stroke="#aaa" stroke-width="2"/>');
      // Вент-блок (вместо окон)
      const vx = x+NOSE+2, vw = W-NOSE*2-4, vy = y+6, vh = 8;
      if (vw > 4) {
        p.push('<rect x="' + vx + '" y="' + vy + '" width="' + vw + '" height="' + vh + '" rx="1" fill="#b0b4b8" stroke="#8a9099" stroke-width="0.6"/>');
        const vm = vy + Math.round(vh/2);
        p.push('<line x1="' + vx + '" y1="' + vm + '" x2="' + (vx+vw) + '" y2="' + vm + '" stroke="#8a9099" stroke-width="0.5"/>');
        if (vw > 16) {
          p.push('<line x1="' + (vx+Math.round(vw/3)) + '" y1="' + vy + '" x2="' + (vx+Math.round(vw/3)) + '" y2="' + (vy+vh) + '" stroke="#9098a0" stroke-width="0.4"/>');
          p.push('<line x1="' + (vx+Math.round(vw*2/3)) + '" y1="' + vy + '" x2="' + (vx+Math.round(vw*2/3)) + '" y2="' + (vy+vh) + '" stroke="#9098a0" stroke-width="0.4"/>');
        }
      }
      // Ромб-пантограф: правильный ромб (вариант А)
      const pmx = x + W/2;
      const pmBot = y - 1;   // нижний угол
      const pmTop = pmBot - 10; // верхний (меньше высота)
      const pmMid = pmBot - 5;  // середина (плоский ромб)
      const pmW = 8;            // полуширина
      p.push('<polygon points="' + pmx + ',' + pmTop + ' ' + (pmx+pmW) + ',' + pmMid + ' ' + pmx + ',' + pmBot + ' ' + (pmx-pmW) + ',' + pmMid + '" fill="none" stroke="#888" stroke-width="1.4" stroke-linejoin="round"/>');
      p.push('<line x1="' + pmx + '" y1="' + pmBot + '" x2="' + pmx + '" y2="' + y + '" stroke="#888" stroke-width="1" stroke-linecap="round"/>');
    } else {
      // Обычные вагоны: head/tail/middle
      let path;
      if (type === "head") {
        path = "M" + (x+NOSE) + " " + y + " L" + (x+W) + " " + y + " L" + (x+W) + " " + (y+H) + " L" + x + " " + (y+H) + " Z";
      } else if (type === "tail") {
        path = "M" + x + " " + y + " L" + (x+W-NOSE) + " " + y + " L" + (x+W) + " " + (y+H) + " L" + x + " " + (y+H) + " Z";
      } else {
        path = "M" + x + " " + y + " L" + (x+W) + " " + y + " L" + (x+W) + " " + (y+H) + " L" + x + " " + (y+H) + " Z";
      }
      p.push('<path d="' + path + '" fill="#e8e8e8" stroke="#bbb" stroke-width="1"/>');
      // Полоса крыши
      const rx1 = type === "head" ? x+NOSE : x+1;
      const rx2 = type === "tail" ? x+W-NOSE : x+W-1;
      p.push('<line x1="' + rx1 + '" y1="' + (y+1) + '" x2="' + rx2 + '" y2="' + (y+1) + '" stroke="#aaa" stroke-width="2"/>');
      // Окна
      const winH = 7, winY = y + 7;
      const bStart = type === "head" ? x+NOSE+2 : x+2;
      const bEnd = type === "tail" ? x+W-NOSE-2 : x+W-2;
      const bW = bEnd - bStart;
      const wCount = Math.max(1, Math.floor(bW / 12));
      const twW = wCount * 9 + (wCount - 1) * 3;
      const wStartX = bStart + (bW - twW) / 2;
      for (let w = 0; w < wCount; w++) {
        const wx = wStartX + w * 12;
        p.push('<rect x="' + wx + '" y="' + winY + '" width="9" height="' + winH + '" rx="1.5" fill="#2a3a4a" stroke="#1a2a3a" stroke-width="0.5"/>');
      }
      // Пантограф для вагонов с panto в vehicleId
      const hasPanto = cars && cars[i] && (cars[i].vehicleId || "").toLowerCase().includes("panto");
      if (hasPanto) {
        const pmx2 = x + W/2;
        const pb2 = y - 1, pt2 = pb2 - 10, pm2 = pb2 - 5, pw2 = 7;
        p.push('<polygon points="' + pmx2 + ',' + pt2 + ' ' + (pmx2+pw2) + ',' + pm2 + ' ' + pmx2 + ',' + pb2 + ' ' + (pmx2-pw2) + ',' + pm2 + '" fill="none" stroke="#888" stroke-width="1.4" stroke-linejoin="round"/>');
        p.push('<line x1="' + pmx2 + '" y1="' + pb2 + '" x2="' + pmx2 + '" y2="' + y + '" stroke="#888" stroke-width="1" stroke-linecap="round"/>');
      }
    }
  }

  // Одна линия рельса
  const railY = PANTO_H + 2 + H + 5;
  p.push('<line x1="' + (PAD-4) + '" y1="' + railY + '" x2="' + (totalW-PAD+4) + '" y2="' + railY + '" stroke="#555" stroke-width="2" stroke-linecap="round"/>');
  p.push('</svg>');
  return '<div class="train-diagram-wrap">' + p.join("") + '</div>';
}

// Схема трамвая: сетка как у поезда (W=46), пантографы только над первым
// (разложенный ромб) и последним (сложенный) вагонами. Дверь у вагона i
// (1-индексация, всего n) есть, если min(i, n+1-i) нечётное.
function buildTramDiagramSvg(carCount) {
  const W = 46, H = 22, GAP = 2, PAD = 12, PANTO_H = 14;
  const totalW = carCount * W + (carCount - 1) * GAP + PAD * 2;
  const totalH = PANTO_H + H + 14;
  const p = [];
  p.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + totalW + '" height="' + totalH + '" style="display:block">');

  const winRect = (wx, wy) => '<rect x="' + wx + '" y="' + wy + '" width="9" height="9" rx="1.5" fill="#2a3a4a" stroke="#1a2a3a" stroke-width="0.5"/>';
  const doorRect = (dx, dy) => '<rect x="' + dx + '" y="' + dy + '" width="9" height="18" rx="1" fill="#1a2a3a"/>';

  for (let i = 0; i < carCount; i++) {
    const x = PAD + i * (W + GAP), y = PANTO_H + 2;
    const isFirst = i === 0, isLast = i === carCount - 1 && carCount > 1;
    const hasDoor = Math.min(i + 1, carCount - i) % 2 === 1;

    // Кузов: у головного скруглён верхний ЛЕВЫЙ угол (R=20), у хвостового —
    // верхний ПРАВЫЙ, промежуточные — прямоугольник
    if (isFirst) {
      p.push('<path d="M ' + (x+20) + ' ' + y + ' L ' + (x+W) + ' ' + y +
        ' L ' + (x+W) + ' ' + (y+H) + ' L ' + x + ' ' + (y+H) +
        ' Q ' + x + ' ' + y + ' ' + (x+20) + ' ' + y + ' Z" fill="#e8e8e8" stroke="#bbb" stroke-width="1"/>');
    } else if (isLast) {
      p.push('<path d="M ' + x + ' ' + y + ' L ' + (x+W-20) + ' ' + y +
        ' Q ' + (x+W) + ' ' + y + ' ' + (x+W) + ' ' + (y+H) +
        ' L ' + x + ' ' + (y+H) + ' Z" fill="#e8e8e8" stroke="#bbb" stroke-width="1"/>');
    } else {
      p.push('<rect x="' + x + '" y="' + y + '" width="' + W + '" height="' + H + '" fill="#e8e8e8" stroke="#bbb" stroke-width="1"/>');
    }

    // Окна и двери
    if (isFirst) {
      // Кабинное окно: левый верхний угол с большим радиусом (параллельно кузову)
      p.push('<path d="M ' + (x+10) + ' ' + (y+6.5) + ' Q ' + (x+4) + ' ' + (y+7) + ' ' + (x+4) + ' ' + (y+13) +
        ' Q ' + (x+4) + ' ' + (y+15.5) + ' ' + (x+6) + ' ' + (y+15.5) +
        ' L ' + (x+11.5) + ' ' + (y+15.5) + ' Q ' + (x+13) + ' ' + (y+15.5) + ' ' + (x+13) + ' ' + (y+14) +
        ' L ' + (x+13) + ' ' + (y+8) + ' Q ' + (x+13) + ' ' + (y+6.5) + ' ' + (x+11.5) + ' ' + (y+6.5) +
        ' Z" fill="#2a3a4a" stroke="#1a2a3a" stroke-width="0.5"/>');
      p.push(doorRect(x+17, y+2));
      p.push(winRect(x+30, y+6.5));
    } else if (isLast) {
      p.push(winRect(x+5, y+6.5));
      p.push(doorRect(x+18.5, y+2));
      // Кабинное окно: большой радиус в правом верхнем углу (зеркально первому)
      p.push('<path d="M ' + (x+35) + ' ' + (y+6.5) + ' Q ' + (x+41) + ' ' + (y+7) + ' ' + (x+41) + ' ' + (y+13) +
        ' Q ' + (x+41) + ' ' + (y+15.5) + ' ' + (x+39) + ' ' + (y+15.5) +
        ' L ' + (x+33.5) + ' ' + (y+15.5) + ' Q ' + (x+32) + ' ' + (y+15.5) + ' ' + (x+32) + ' ' + (y+14) +
        ' L ' + (x+32) + ' ' + (y+8) + ' Q ' + (x+32) + ' ' + (y+6.5) + ' ' + (x+33.5) + ' ' + (y+6.5) +
        ' Z" fill="#2a3a4a" stroke="#1a2a3a" stroke-width="0.5"/>');
    } else if (hasDoor) {
      p.push(winRect(x+5, y+6.5));
      p.push(doorRect(x+18.5, y+2));
      p.push(winRect(x+32, y+6.5));
    } else {
      p.push(winRect(x+5, y+6.5));
      p.push(winRect(x+18.5, y+6.5));
      p.push(winRect(x+32, y+6.5));
    }

    // Пантографы: разложенный ромб над первым вагоном, сложенный над последним
    const cx = x + W / 2;
    if (isFirst) {
      p.push('<polygon points="' + cx + ',' + (y-1) + ' ' + (cx+7) + ',' + (y-6) + ' ' + cx + ',' + (y-11) + ' ' + (cx-7) + ',' + (y-6) + '" fill="none" stroke="#888" stroke-width="1.4" stroke-linejoin="round"/>');
    } else if (isLast) {
      p.push('<polygon points="' + cx + ',' + (y-1) + ' ' + (cx+7) + ',' + (y-3) + ' ' + cx + ',' + (y-5) + ' ' + (cx-7) + ',' + (y-3) + '" fill="none" stroke="#888" stroke-width="1.4" stroke-linejoin="round"/>');
    }
  }

  const railY = PANTO_H + 2 + H + 5;
  p.push('<line x1="' + (PAD-4) + '" y1="' + railY + '" x2="' + (totalW-PAD+4) + '" y2="' + railY + '" stroke="#555" stroke-width="2" stroke-linecap="round"/>');
  p.push('</svg>');
  return '<div class="train-diagram-wrap">' + p.join("") + '</div>';
}

// Схема автобуса/троллейбуса: секций столько, сколько «вагонов» у маршрута
// (1 — одиночный, 2 — сочленённый, 3+ — многосекционный), между секциями
// гармошка, нос справа, внизу колёса и линия дороги вместо рельса.
// У троллейбуса — две штанги над задней секцией.
function buildBusDiagramSvg(sectionCount, isTrolley) {
  const H = 28, ACC = 12, PAD = 12;
  const y = 20; // сверху место под штанги троллейбуса
  const single = sectionCount === 1;
  const midCount = single ? 0 : Math.max(0, sectionCount - 2);
  const busW = single ? 107 : 68 + 85 + midCount * 58 + (midCount + 1) * ACC;
  const totalW = busW + PAD * 2;
  const totalH = y + H + 12;
  const p = [];
  p.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + totalW + '" height="' + totalH + '" style="display:block">');

  const body = '#e8e8e8', bodyStroke = '#bbb', winFill = '#2a3a4a', winStroke = '#1a2a3a';
  const winRect = (wx) => '<rect x="' + wx + '" y="' + (y+3) + '" width="13" height="12" rx="1" fill="' + winFill + '" stroke="' + winStroke + '" stroke-width="0.5"/>';
  const doorRect = (dx, dw) => '<rect x="' + dx + '" y="' + (y+3) + '" width="' + (dw || 13) + '" height="23" rx="1" fill="' + winFill + '"/>';
  const wheel = (cx) => '<circle cx="' + cx + '" cy="' + (y+H) + '" r="6.5" fill="#222"/><circle cx="' + cx + '" cy="' + (y+H) + '" r="2.2" fill="#777"/>';
  // Лобовое стекло: левый край fx, наклонная передняя кромка справа
  const windshield = (fx) => '<path d="M ' + (fx+1) + ' ' + (y+3) + ' Q ' + (fx+5) + ' ' + (y+3) + ' ' + (fx+6) + ' ' + (y+9) +
    ' L ' + (fx+6) + ' ' + (y+17) + ' L ' + fx + ' ' + (y+17) + ' L ' + fx + ' ' + (y+4) +
    ' Q ' + fx + ' ' + (y+3) + ' ' + (fx+1) + ' ' + (y+3) + ' Z" fill="' + winFill + '" stroke="' + winStroke + '" stroke-width="0.5"/>';
  // Штанги троллейбуса: пологий наклон назад-вверх, выходят за задний край
  const poles = (px) => '<line x1="' + (px+42) + '" y1="' + y + '" x2="' + (px-6) + '" y2="' + (y-18) + '" stroke="#888" stroke-width="1.3" stroke-linecap="round"/>' +
    '<line x1="' + (px+48) + '" y1="' + y + '" x2="' + px + '" y2="' + (y-18) + '" stroke="#888" stroke-width="1.3" stroke-linecap="round"/>';

  let x = PAD;
  if (single) {
    // Одиночный автобус, ширина 107
    p.push('<path d="M ' + (x+4) + ' ' + y + ' L ' + (x+98) + ' ' + y +
      ' Q ' + (x+106) + ' ' + y + ' ' + (x+107) + ' ' + (y+8) +
      ' L ' + (x+107) + ' ' + (y+28) + ' L ' + (x+2) + ' ' + (y+28) +
      ' Q ' + x + ' ' + (y+28) + ' ' + x + ' ' + (y+26) +
      ' L ' + x + ' ' + (y+6) + ' Q ' + x + ' ' + y + ' ' + (x+4) + ' ' + y + ' Z" fill="' + body + '" stroke="' + bodyStroke + '" stroke-width="1"/>');
    p.push(winRect(x+4));
    p.push(winRect(x+18));
    p.push(doorRect(x+33));
    p.push(winRect(x+50));
    p.push(winRect(x+66));
    p.push(doorRect(x+84, 10));
    p.push(windshield(x+97));
    p.push(wheel(x+20));
    p.push(wheel(x+72));
    if (isTrolley) p.push(poles(x));
  } else {
    // Задняя секция (слева), ширина 68
    p.push('<path d="M ' + (x+4) + ' ' + y + ' L ' + (x+68) + ' ' + y +
      ' L ' + (x+68) + ' ' + (y+28) + ' L ' + (x+2) + ' ' + (y+28) +
      ' Q ' + x + ' ' + (y+28) + ' ' + x + ' ' + (y+26) +
      ' L ' + x + ' ' + (y+6) + ' Q ' + x + ' ' + y + ' ' + (x+4) + ' ' + y + ' Z" fill="' + body + '" stroke="' + bodyStroke + '" stroke-width="1"/>');
    p.push(winRect(x+5));
    p.push(winRect(x+21));
    p.push(winRect(x+37));
    p.push(doorRect(x+53));
    p.push(wheel(x+27));
    if (isTrolley) p.push(poles(x));
    x += 68;

    // Гармошка + средние секции (58) + гармошка перед передней
    const accordion = (ax) => {
      p.push('<rect x="' + ax + '" y="' + (y+1) + '" width="12" height="26" fill="#2a2f35"/>');
      [2, 4.5, 7, 9.5].forEach((off) => {
        p.push('<line x1="' + (ax+off) + '" y1="' + (y+1) + '" x2="' + (ax+off) + '" y2="' + (y+27) + '" stroke="#555" stroke-width="0.8"/>');
      });
    };
    for (let m = 0; m < midCount; m++) {
      accordion(x); x += ACC;
      p.push('<rect x="' + x + '" y="' + y + '" width="58" height="' + H + '" fill="' + body + '" stroke="' + bodyStroke + '" stroke-width="1"/>');
      p.push(winRect(x+4));
      p.push(winRect(x+21));
      p.push(doorRect(x+41));
      p.push(wheel(x+27));
      x += 58;
    }
    accordion(x); x += ACC;

    // Передняя секция (справа), ширина 85, нос со скруглением
    p.push('<path d="M ' + x + ' ' + y + ' L ' + (x+76) + ' ' + y +
      ' Q ' + (x+84) + ' ' + y + ' ' + (x+85) + ' ' + (y+8) +
      ' L ' + (x+85) + ' ' + (y+28) + ' L ' + x + ' ' + (y+28) + ' Z" fill="' + body + '" stroke="' + bodyStroke + '" stroke-width="1"/>');
    p.push(winRect(x+8));
    p.push(doorRect(x+25));
    p.push(winRect(x+45));
    p.push(doorRect(x+61));
    p.push(windshield(x+76));
    p.push(wheel(x+14));
    p.push(wheel(x+51));
  }

  // Линия дороги вместо рельса
  const roadY = y + H + 8;
  p.push('<line x1="' + (PAD-4) + '" y1="' + roadY + '" x2="' + (totalW-PAD+4) + '" y2="' + roadY + '" stroke="#555" stroke-width="2" stroke-linecap="round"/>');
  p.push('</svg>');
  return '<div class="train-diagram-wrap">' + p.join("") + '</div>';
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
      <li><span class="meta-label">${t("modalType")}:</span> ${escapeHtml(data.type ? routeTypeName(data.type) : "—")}</li>
      <li><span class="meta-label">${t("modalDepots")}:</span> ${escapeHtml((data.depots || []).join(", ") || "—")}</li>
      <li><span class="meta-label">${t("modalActiveTrips")}:</span> ${data.activeTripCount}</li>
      ${(() => {
        const trips = _depIdxCache.get(data.id);
        let counts = trips ? [...new Set(trips.filter(t=>t.carCount!=null).map(t=>t.carCount))] : [];
        // Fallback на кешированный состав, если live-данных сейчас нет.
        if (counts.length === 0) {
          const cars = _carsCache.get(data.number);
          if (Array.isArray(cars) && cars.length) counts = [cars.length];
        }
        if (counts.length === 0) return "";
        const label = currentLang() === "ru" ? "Вагонов в составе" : "Cars per train";
        const val = counts.length === 1 ? counts[0] : counts.join(" / ");
        return `<li><span class="meta-label">${label}:</span> ${val}</li>`;
      })()}
      <li><span class="meta-label">${t("modalTotalDuration")}:</span> ${formatMinutesShort((data.totalDurationMs / 60000).toFixed(1))}</li>
      <li><span class="meta-label">${t("modalTotalDwell")}:</span> ${formatMinutesShort((data.totalDwellMs / 60000).toFixed(1))}</li>
    </ul>`;

  // ---- Объединённая таблица: отправление из депо (T0, шапка колонок +
  // строка отклонения) и расписание по каждой станции для каждого рейса ----
  let stationTimetableHtml = `<p class="hint small">${escapeHtml(t("modalNoActiveTrips"))}</p>`;
  const tripNow = routeTripsNow(data, timetable);
  if (timetable && timetable.trips.length) {
    const headerCols = timetable.trips
      .map((trip, i) => {
        const delta = getOverride(data.id, trip.tripOriginMs);
        const edited = delta !== 0;
        const effMs = normalizeMs(trip.tripOriginMs + delta);
        const tripConflictStations = conflictedTrips.get ? conflictedTrips.get(trip.tripOriginMs) : null;
        const hasAnyConflict = tripConflictStations && tripConflictStations.size > 0;
        const removeBtn = data.isDraft
          ? `<button class="col-remove-btn" data-remove-departure="${trip.originalDepartureMs ?? trip.tripOriginMs}" title="${escapeHtml(t("removeColumn"))}">×</button>`
          : "";
        // departureIndex = порядковый номер рейса за сутки UTC, начиная с 0.
        // trips[] уже отсортированы по tripOriginMs (мс от полуночи UTC),
        // поэтому i напрямую соответствует departureIndex из MTR.
        const tripLabel = `#${i + 1}`;
        // Расчётное время отправления из депо: arrival_first - dwell_first - 1мин.
        // trip.times уже включают live-отклонение — вычитаем его, чтобы в таблице
        // стояло ПЛАНОВОЕ время, а отклонение показываем отдельно в скобках.
        const firstStop = trip.times && trip.times[0];
        const depotDepartMs = firstStop
          ? normalizeMs(firstStop.arrivalMs - (firstStop.dwellTimeMs || 0) - 60000 - (trip.deviationMs || 0) + delta)
          : effMs;
        // В строке отправления из депо отклонение НЕ показываем (только плановое).
        return `<th class="${edited ? "timetable-cell-edited" : ""}${hasAnyConflict ? " tt-has-conflict" : ""}${i === tripNow.curIdx ? " tt-cur" : ""}">${removeBtn}${tripLabel}<br>${formatUtc(depotDepartMs, true)}${edited ? `<span class="cell-edited-label">${escapeHtml(t("editedLabel"))}</span>` : ""}</th>`;
      })
      .join("");
    const addColHeader = data.isDraft
      ? `<th><button class="col-add-btn" id="addDepartureColBtn" title="${escapeHtml(t("addColumn"))}">+</button></th>`
      : "";
    const deviationRow = timetable.trips
      .map((trip, ti) => {
        const edited = getOverride(data.id, trip.tripOriginMs) !== 0;
        return `<td class="${deviationClass(trip.deviationMs)} ${edited ? "timetable-cell-edited" : ""}${ti === tripNow.curIdx ? " tt-cur" : ""}">${formatDeviation(trip.deviationMs)}</td>`;
      })
      .join("");
    // Сколько прошло с момента опроса MTR — на столько «уехали» относительные
    // времена relArrivalMs. Так определяем, какие станции поезд уже проехал.
    // ВАЖНО: логика имеет смысл только на СВЕЖИХ данных. Если связи с MTR нет
    // и показан кеш (он может быть многодневным), все станции выглядели бы
    // пройденными и отклонения исчезли бы вовсе — тогда ведём себя как раньше
    // и показываем отклонение везде. Поллер опрашивает раз в минуту.
    const LIVE_FRESH_MS = 5 * 60000;
    const elapsedSincePoll = timetable.polledAt ? Date.now() - timetable.polledAt : Infinity;
    const liveFresh = elapsedSincePoll >= 0 && elapsedSincePoll < LIVE_FRESH_MS;
    const bodyRows = timetable.stations
      .map((st, stIdx) => {
        const cells = timetable.trips
          .map((trip, ti) => {
            const delta = getOverride(data.id, trip.tripOriginMs);
            const edited = delta !== 0;
            const raw = trip.times[stIdx];
            // Опоздание показываем ТОЛЬКО там, куда поезд ещё не доехал: на
            // пройденных станциях время уже состоялось, и «(+5)» там врёт.
            // relArrivalMs отсчитывается от опроса MTR, поэтому сравниваем с
            // временем, прошедшим с опроса. У черновиков relArrivalMs = null —
            // у них нет живых отклонений, ведём себя как раньше.
            const rel = raw.relArrivalMs;
            const reached = liveFresh && rel != null && rel < elapsedSincePoll;
            // ВАЖНО: dev остаётся настоящим — из него считается ПЛАНОВОЕ время
            // (base − dev). Скрываем только показ отклонения в скобках.
            const dev = trip.deviationMs || 0;
            const devShown = reached ? 0 : dev;
            // baseMs уже включает live-отклонение (см. buildRouteTimetable).
            // Показываем ПЛАНОВОЕ время (base − dev) + ручную правку, а отклонение
            // выносим в скобки. Для перехода на дашборд используем фактическое время.
            const baseMs = raw.departureMs !== null ? raw.departureMs : raw.arrivalMs;
            const plannedMs = normalizeMs(baseMs - dev + delta);
            const actualMs = normalizeMs(baseMs + delta);
            const cellHasConflict = conflictedTrips.get ? conflictedTrips.get(trip.tripOriginMs)?.has(st.stationId) : false;
            const cellIcon = cellHasConflict ? `<span class="tt-conflict-icon" title="${escapeHtml(t("conflictLabel"))}">!</span>` : "";
            const devParen = formatDeviationParen(devShown);
            const devSpan = devParen ? ` <span class="${deviationClass(devShown)} tt-dev">${devParen}</span>` : "";
            const curCls = (ti === tripNow.curIdx ? " tt-cur" : "") + (reached ? " tt-passed" : "");
            return `<td class="${edited ? "timetable-cell-edited" : ""}${cellHasConflict ? " tt-has-conflict" : ""}${curCls}" data-goto-station="${escapeHtml(st.stationId)}" data-goto-time="${actualMs}" style="cursor:pointer">${cellIcon}${formatUtc(plannedMs)}${devSpan}${edited ? `<span class="cell-edited-label">${escapeHtml(t("editedLabel"))}</span>` : ""}</td>`;
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
    const depotOffset = computeDepotOffsetMs(timetable);
    const lines = buildFormulaLinesFromTimes(t0List, data.id, depotOffset);
    formulaHtml = renderFormulaLines(lines);
  }

  const nx = nextRouteCardExtras(data, timetable, conflictedTrips);
  const stopsTableHtml = `<table>
      <thead><tr><th>#</th><th>${t("colStation")}</th><th>${t("colPlatform")}</th><th>${t("colDwell")}</th><th>${t("colNext")}</th><th>${t("colCoords")}</th></tr></thead>
      <tbody>${stopsRows}</tbody>
    </table>`;
  const routeModalBodyEl = document.getElementById("routeModalBody");
  routeModalBodyEl.classList.toggle("nxc-on", isNextUi());
  if (isNextUi()) {
    routeModalBodyEl.innerHTML = nextRouteCardHtml({ data, timetable, nx, tripNow, stopsTableHtml, stationTimetableHtml, formulaHtml });
    requestAnimationFrame(() => nxcScrollToNow(false));
  } else routeModalBodyEl.innerHTML = `
    <h2>${routeMarker(data.type, data.color, data.number, "lg")}${escapeHtml(data.name)} ${data.number ? "(" + escapeHtml(data.number) + ")" : ""}${data.isDraft ? " " + draftFlagHtml() : ""}</h2>
    ${nx.sub}
    <div class="modal-toolbar">
      <div class="modal-toolbar-left">
        ${data.isDraft ? `
          <button class="secondary-btn" id="editDraftInModalBtn" data-i18n="draftEdit">Изменить</button>
          <button class="secondary-btn danger-btn" id="deleteDraftInModalBtn" data-i18n="draftDelete">Удалить</button>
        ` : `
          ${hasAnyOverrideForRoute(data.id) ? `<button class="secondary-btn danger-btn" id="resetRouteEditsBtn" data-i18n="resetRouteEdits">Сбросить правки</button>` : ""}
        `}
        <button class="icon-btn" id="toggleFavoriteRouteBtn" style="font-size:18px;" title="">☆</button>
        <button class="secondary-btn" id="reverseRouteBtn">${t("openReverseRoute")}</button>
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
    ${nx.kpis}
    ${metaList}
    ${buildLiveTripsSection(data.id, currentLang())}
    ${(() => {
      const cars = _carsCache.get(data.number) || null;
      const n = cars ? cars.length : null;
      return buildTrainDiagramSvg(data.number || data.name, data.type, n, "#ffffff", cars);
    })()}
    <h4 data-stops-header="1">${t("modalStops")}</h4>
    ${stopsTableHtml}
    <h4>${t("modalStationTimetable")}</h4>
    <p class="hint small">${escapeHtml(t("modalEditedHint"))}</p>
    ${stationTimetableHtml}
    ${formulaHtml}
    ${nx.conflicts}
  `;

  // Переводим data-i18n элементы модалки СРАЗУ после вставки разметки —
  // не полагаемся только на applyI18n() в конце функции: если любой код
  // ниже выйдет раньше или упадёт, кнопки карточки («Действия» и т.п.)
  // остались бы с русским текстом-заглушкой из шаблона.
  applyI18n();

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
      const gotoTimeMs = el.dataset.gotoTime ? Number(el.dataset.gotoTime) : null;
      closeRouteModal();
      gotoStationSchedule(stationId).then(() => {
        if (gotoTimeMs == null) return;
        // Прокручиваем дашборд к нужному времени
        const pxPerHour = state.dashPxPerHour;
        const scrollPx = (gotoTimeMs / 3600000) * pxPerHour - window.innerWidth / 3;
        const scrollEl = document.getElementById("gridScroll");
        if (scrollEl) scrollEl.scrollLeft = Math.max(0, scrollPx);
      });
    });
  });

  // #9: открыть график движения для этого маршрута (А = первая, Б = последняя остановка)
  const favRouteBtn = document.getElementById("toggleFavoriteRouteBtn");
  if (favRouteBtn) {
    const isFav = isFavoriteRoute(data.id);
    favRouteBtn.textContent = isFav ? "★" : "☆";
    favRouteBtn.style.color = isFav ? "#fbbf24" : "";
    favRouteBtn.title = isFav ? t("removeFavorite") : t("addFavorite");
    if (!favRouteBtn._hasListener) {
      favRouteBtn._hasListener = true;
      favRouteBtn.addEventListener("click", () => {
      toggleFavoriteRoute(data.id);
      const nowFav = isFavoriteRoute(data.id);
      favRouteBtn.textContent = nowFav ? "★" : "☆";
      favRouteBtn.style.color = nowFav ? "#fbbf24" : "";
      favRouteBtn.title = nowFav ? t("removeFavorite") : t("addFavorite");
      });
    }
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

  // Кнопка «Обратный маршрут»
  // Основной путь: сервер уже вычислил reverseRouteId (станции строго в
  // обратном порядке + тот же цвет) — используем его сразу, без запросов.
  // Фолбэк — старый клиентский скоринг по депо/конечным/общим станциям
  // (ловит пары, где порядок станций не строго зеркальный).
  // ВАЖНО: фолбэк обёрнут в IIFE, чтобы его ранние return НЕ выходили из
  // всего renderRouteModal — раньше они пропускали навешивание обработчиков
  // ниже и финальный applyI18n(), из-за чего у части маршрутов (без
  // кандидатов на обратный: пустой state.routes, уникальный тип/депо)
  // кнопка «Действия» и подменю оставались на русском при любом языке.
  const reverseBtn = document.getElementById("reverseRouteBtn");
  if (reverseBtn && data.reverseRouteId) {
    reverseBtn.disabled = false;
    reverseBtn.style.opacity = "";
    reverseBtn.onclick = () => openRouteModal(data.reverseRouteId);
  } else if (reverseBtn) (() => {
    reverseBtn.disabled = true;
    reverseBtn.style.opacity = "0.4";
    const myStations = (data.stops || []).map(s => s.stationId);
    if (myStations.length < 2) return;
    const myFirst = myStations[0];
    const myLast = myStations[myStations.length - 1];
    const mySet = new Set(myStations);

    // Депо ТЕКУЩЕГО маршрута. Обратный маршрут должен обслуживаться из депо
    // с абсолютно тем же названием — это главный (жёсткий) критерий.
    const myDepots = (data.depots || []).filter(Boolean);
    const REQUIRE_DEPOT = myDepots.length > 0;

    // Кандидаты: тот же тип, другой маршрут, не черновик.
    // Если у маршрута есть депо — сразу сужаем до маршрутов с ТЕМ ЖЕ депо
    // (listRoutes теперь отдаёт depots), иначе не пришлось бы грузить детали
    // сотен маршрутов и можно было бы пропустить нужный из-за лимита.
    let candidates = state.routes
      .filter(r => r.id !== data.id && !r.isDraft && r.type === data.type);
    if (REQUIRE_DEPOT) {
      candidates = candidates.filter(r => (r.depots || []).some(d => myDepots.includes(d)));
    } else {
      candidates = candidates.slice(0, 20);
    }
    if (candidates.length === 0) return;

    (async () => {
      // Собираем баллы для каждого кандидата
      const scored = [];
      for (const cand of candidates) {
        try {
          const det = await fetch(`/api/routes/${cand.id}`).then(r => r.json());
          const cs = (det.stops || []).map(s => s.stationId);
          if (cs.length < 2) continue;

          // Жёсткое требование: то же депо (совпадение по названию 1-в-1).
          const candDepots = (det.depots || []).filter(Boolean);
          const depotMatch = myDepots.some(d => candDepots.includes(d));
          if (REQUIRE_DEPOT && !depotMatch) continue;

          let score = 0;
          // Разворот направления: первая и последняя станции поменялись местами
          if (cs[0] === myLast && cs[cs.length - 1] === myFirst) score += 100;
          else if (cs[0] === myLast || cs[cs.length - 1] === myFirst) score += 30;
          // Без депо (у маршрута его нет) требуем хотя бы разворот направления
          if (!REQUIRE_DEPOT && score === 0) continue;

          // То же депо — определяющий вес
          if (depotMatch) score += 1000;

          // Бонус: общие станции (в любом порядке)
          const csSet = new Set(cs);
          const commonCount = [...mySet].filter(s => csSet.has(s)).length;
          score += commonCount * 2;

          // Штраф: цвет не совпадает (но не блокируем)
          if (data.color && det.color && det.color !== data.color) score -= 10;

          scored.push({ id: cand.id, score });
        } catch {}
      }

      if (scored.length === 0) return;
      scored.sort((a, b) => b.score - a.score);
      const best = scored[0];
      const threshold = REQUIRE_DEPOT ? 1000 : 30;
      if (best.score >= threshold) {
        reverseBtn.disabled = false;
        reverseBtn.style.opacity = "";
        reverseBtn.onclick = () => openRouteModal(best.id);
      }
    })();
  })();

  // Редактирование/удаление пробного маршрута прямо из карточки
  const editBtn = document.getElementById("editDraftInModalBtn");
  if (editBtn && !editBtn._hasListener) {
    editBtn._hasListener = true;
    editBtn.addEventListener("click", async () => {
      const res = await fetch(`/api/drafts/${data.id}`);
      const d = await res.json();
      closeRouteModal();
      openDraftForm(d);
    });
  }
  const deleteBtn = document.getElementById("deleteDraftInModalBtn");
  if (deleteBtn && !deleteBtn._hasListener) {
    deleteBtn._hasListener = true;
    deleteBtn.addEventListener("click", async () => {
      if (!confirm(t("draftConfirmDelete"))) return;
      await fetch(`/api/drafts/${data.id}`, { method: "DELETE" });
      closeRouteModal();
      await loadRoutes();
      await refreshDataViews();
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
    addColBtn.addEventListener("click", () => {
      // Добавляем inline-столбец в таблицу расписания (timetable-matrix)
      const timetableTable = document.querySelector("#routeModalBody .timetable-matrix");
      const thead = timetableTable?.querySelector("thead tr");
      const tbody = timetableTable?.querySelector("tbody");
      if (!thead || !tbody) return;

      // Создаём заголовок с полем ввода
      const newTh = document.createElement("th");
      newTh.style.minWidth = "80px";
      newTh.innerHTML = '<input type="time" id="newDepartureInput" style="width:72px;font-size:12px;background:var(--input);border:1px solid var(--accent);border-radius:4px;color:var(--fg);padding:2px 4px;" placeholder="HH:MM" autofocus>';
      // Вставляем перед последним th (кнопка +)
      thead.insertBefore(newTh, thead.lastElementChild);

      // В каждую строку tbody добавляем пустую ячейку
      for (const tr of tbody.rows) {
        const td = document.createElement("td");
        td.style.color = "var(--muted)";
        td.textContent = "—";
        tr.insertBefore(td, tr.lastElementChild);
      }

      const input = newTh.querySelector("input");
      input.focus();

      async function commitNewDeparture() {
        const val = input.value;
        if (!val) {
          // Отмена — убираем добавленные ячейки
          newTh.remove();
          for (const tr of tbody.rows) tr.cells[tr.cells.length - 2]?.remove();
          return;
        }
        const m = val.match(/^(\d{1,2}):(\d{2})$/);
        if (!m) return;
        const hh = Number(m[1]), mm = Number(m[2]);
        if (hh > 23 || mm > 59) return;
        // Время в таблице показывается как UTC — сохраняем напрямую без смещения
        const newTimeMs = (hh * 60 + mm) * 60000;
        const fullDraft = await (await fetch(`/api/drafts/${data.id}`)).json();
        const updated = [...(fullDraft.departureTimesOfDayMs || []), newTimeMs].sort((a, b) => a - b);
        const res = await fetch(`/api/drafts/${data.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...fullDraft, departureTimesOfDayMs: updated }),
        });
        if (res.ok) openRouteModal(data.id);
      }

      input.addEventListener("change", commitNewDeparture);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { input.blur(); commitNewDeparture(); }
        if (e.key === "Escape") {
          newTh.remove();
          for (const tr of tbody.rows) tr.cells[tr.cells.length - 2]?.remove();
        }
      });
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
    if (!res.ok) { alert(tServerError(data.error) || "Error"); return; }
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

const DEFAULT_SERVER = "http://localhost:8888";

function getServerList() {
  const list = settings.serverList || [];
  return list.includes(DEFAULT_SERVER) ? list : [DEFAULT_SERVER, ...list];
}

function renderServerList() {
  const sel = document.getElementById("serverListSelect");
  if (!sel) return;
  const list = getServerList();
  const active = settings.serverUrl || DEFAULT_SERVER;
  sel.innerHTML = list.map(url =>
    '<option value="' + escapeHtml(url) + '" ' + (url === active ? 'selected' : '') + '>' + escapeHtml(url) + '</option>'
  ).join("");
}

function initSettingsUI() {
  renderRouteMarkersSettings();
  // ── Список серверов MTR ─────────────────────────────────────────────
  const serverListSelect = document.getElementById("serverListSelect");
  const serverUrlInput = document.getElementById("serverUrlInput");
  const serverUrlAddBtn = document.getElementById("serverUrlAddBtn");
  const serverUrlRemoveBtn = document.getElementById("serverUrlRemoveBtn");
  const serverUrlHint = document.getElementById("serverUrlHint");

  // renderServerList и getServerList определены глобально

  async function applyServerUrl(url) {
    try {
      const res = await fetch("/api/server-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      settings.serverUrl = url;
      savePrefsToServer();
      if (serverUrlHint) { serverUrlHint.textContent = t("serverUrlSaved"); serverUrlHint.style.color = "var(--green)"; }
      // POST /api/server-url уже дождался первого опроса нового сервера
      // (см. server.js/poller.restart), поэтому данные готовы — сбрасываем
      // ВСЕ клиентские кеши и перезагружаем и станции, и маршруты.
      state.stations = [];
      state.routes = [];
      state.routesById = new Map();
      state.lastScheduleData = null;
      state.lastGraphData = null;
      state.currentStationId = null;
      state.lastAnalytics = [];
      state._conflictedStations = new Map();
      state._conflictedRoutes = new Map();
      _conflictScan = { at: 0, stations: [], running: null };
      loadCarsCacheFromStorage(); // кеш составов — свой на каждый сервер
      // Старый выбранный текст в полях больше не соответствует новому серверу
      ["stationInput", "graphFromInput", "graphToInput"].forEach((id) => {
        const inp = document.getElementById(id);
        if (inp) inp.value = "";
      });
      await Promise.all([loadStations(), loadRoutes()]);
      renderFavoritesBar();
      refreshAllViews();
      if (serverUrlHint) { serverUrlHint.textContent = ""; serverUrlHint.style.color = ""; }
    } catch (e) {
      if (serverUrlHint) { serverUrlHint.textContent = t("serverUrlError") + ": " + e.message; serverUrlHint.style.color = "var(--red)"; }
    }
  }

  renderServerList();

  if (serverListSelect && !serverListSelect._hasListener) {
    serverListSelect._hasListener = true;
    serverListSelect.addEventListener("change", () => { applyServerUrl(serverListSelect.value); });
  }
  if (serverUrlAddBtn && !serverUrlAddBtn._hasListener) {
    serverUrlAddBtn._hasListener = true;
    serverUrlAddBtn.addEventListener("click", async () => {
      const url = serverUrlInput?.value?.trim();
      if (!url) return;
      const list = settings.serverList || [];
      if (!list.includes(url) && url !== DEFAULT_SERVER) settings.serverList = [...list, url];
      await applyServerUrl(url);
      renderServerList();
      if (serverUrlInput) serverUrlInput.value = "";
    });
  }
  if (serverUrlRemoveBtn && !serverUrlRemoveBtn._hasListener) {
    serverUrlRemoveBtn._hasListener = true;
    serverUrlRemoveBtn.addEventListener("click", () => {
      const selected = serverListSelect?.value;
      if (!selected || selected === DEFAULT_SERVER) return;
      settings.serverList = (settings.serverList || []).filter(u => u !== selected);
      applyServerUrl(DEFAULT_SERVER);
      renderServerList();
      savePrefsToServer();
    });
  }

  // ── Версия приложения ────────────────────────────────────────────
  const appVersionEl = document.getElementById("appVersionLabel");
  if (appVersionEl) {
    fetch("/api/status").then(r => r.json()).then(d => {
      appVersionEl.textContent = d.version ? `v${d.version}` : "";
    }).catch(() => {});
  }
  const checkUpdateBtn = document.getElementById("checkUpdateBtn");
  if (checkUpdateBtn && !checkUpdateBtn._hasListener) {
    checkUpdateBtn._hasListener = true;
    checkUpdateBtn.addEventListener("click", () => {
      if (window.electronAPI?.checkForUpdates) {
        window.electronAPI.checkForUpdates();
      }
  const supportBtn = document.getElementById("supportBtn");
  if (supportBtn && !supportBtn._hasListener) {
    supportBtn._hasListener = true;
    supportBtn.addEventListener("click", () => {
      if (window.electronAPI?.openExternal) window.electronAPI.openExternal("https://discord.gg/qEuc7xCfwe");
      else window.open("https://discord.gg/qEuc7xCfwe", "_blank");
    });
  }
 else {
        window.open("https://github.com/kk-prod-dev/MTR-Schedule-manager/releases/latest", "_blank");
      }
    });
  }

  const diagBtn = document.getElementById("diagReportBtn");
  if (diagBtn && !diagBtn._hasListener) {
    diagBtn._hasListener = true;
    diagBtn.addEventListener("click", () => { downloadDiagnosticReport(); });
  }

  const langSelect = document.getElementById("languageSelect");
  const tzSelect = document.getElementById("timezoneSelect");

  langSelect.value = settings.langMode;
  tzSelect.innerHTML =
    `<option value="auto">${escapeHtml(t("autoOption"))}</option>` +
    buildTzOptions().map((o) => `<option value="${o.value}">${o.label}</option>`).join("");
  tzSelect.value = settings.tzMode;

  // Server timezone select
  const serverTzSelect = document.getElementById("serverTimezoneSelect");
  if (serverTzSelect) {
    serverTzSelect.innerHTML =
      buildTzOptions().map((o) => `<option value="${o.value}">${o.label}</option>`).join("");
    serverTzSelect.value = String(settings.serverTzOffsetMin || 0);
    serverTzSelect.addEventListener("change", () => {
      settings.serverTzOffsetMin = Number(serverTzSelect.value);
      savePrefsToServer();
      refreshAllViews();
    });
  }

  document.getElementById("tzDetectedHint").textContent = t("tzDetected", {
    tz: `${detectSystemTzName()} (UTC${detectSystemTzOffsetMin() >= 0 ? "+" : ""}${(detectSystemTzOffsetMin() / 60).toFixed(1).replace(".0", "")})`,
  });

  langSelect.addEventListener("change", () => {
    settings.langMode = langSelect.value;
    savePrefsToServer();
    refreshAllViews();
  });
  tzSelect.addEventListener("change", () => {
    settings.tzMode = tzSelect.value;
    savePrefsToServer();
    refreshAllViews();
  });
}

function refreshAllViews() {
  applyI18n();
  if (document.getElementById("serverListSelect")) renderServerList();
  initSettingsUI();
  renderInstructions();
  refreshStatus();
  document.getElementById("minIntervalValue").textContent = t("minIntervalValue", { m: state.minIntervalMin });
  // Тяжёлые операции — откладываем чтобы не блокировать UI
  setTimeout(() => {
    renderDashboardFromCache();
    updateScheduleMeta();
    renderGraphFromCache();
    if (state.routes.length) { populateRouteTypeFilter(); applyRouteFilters(); }
    if (state.lastRouteDetail && routeModalOverlay.style.display !== "none") {
      renderRouteModal(state.lastRouteDetail, state.lastRouteTimetable, state.lastRouteRawDraft, state.lastRouteConflictedTrips);
    }
  }, 0);
}

// ============================================================
// Инструкции
// ============================================================
const INSTRUCTIONS = [
  { id: "schedule-basics" },
  { id: "drag-edit" },
  { id: "favorites" },
  { id: "filters-zoom" },
  { id: "train-graph" },
  { id: "route-card" },
  { id: "drafts" },
  { id: "problems" },
  { id: "settings" },
  { id: "schedule_formula" },
  { id: "board-editor" },
];

function renderInstructions() {
  const container = document.getElementById("instructionsList");
  if (!container) return;
  const openIds = new Set(
    Array.from(container.querySelectorAll(".instruction-item.open")).map((el) => el.dataset.id)
  );
  container.innerHTML = INSTRUCTIONS.map(
    (item) => `
    <div class="instruction-item ${openIds.has(item.id) ? "open" : ""}" data-id="${item.id}">
      <div class="instruction-header">
        <span>${escapeHtml(t("instr_title_" + item.id))}</span>
        <span class="chevron">▶</span>
      </div>
      <div class="instruction-body">${t("instr_body_" + item.id)}</div>
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
// Умная пауза — не опрашиваем сервер если приложение не используется
let _pollPaused = false;
document.addEventListener("visibilitychange", () => {
  _pollPaused = document.hidden;
});
// Также приостанавливаем если пользователь не на вкладке расписания
function _shouldPoll() {
  if (_pollPaused) return false;
  // Опрашиваем всегда — данные нужны для уведомлений и фоновых вкладок тоже
  // Но arrivals — только если открыта станция и вкладка видима
  return true;
}
function _shouldPollArrivals() {
  return !_pollPaused && !!state.currentStationId;
}

// Сохраняем настройки при закрытии окна (sendBeacon работает даже при выгрузке страницы)
// Сохранение при закрытии через ipcRenderer (Electron) или XHR sync (браузер)
// BoardEditor (вкладка "Aushangfahrplan") хранит свои пресеты и последний
// холст внутри общего prefs.json — отдельного бэкенда/файла для этого нет,
// POST /api/prefs перезаписывает файл целиком, так что эти поля обязаны
// попадать в КАЖДЫЙ payload наравне с остальными настройками.
function boardEditorPrefsFields() {
  try {
    if (window.BoardEditor && typeof window.BoardEditor.getPersistedState === "function") {
      const s = window.BoardEditor.getPersistedState();
      return { boardEditorPresets: s.presets || [], boardEditorLastCanvas: s.lastCanvas || null, boardEditorUi: s.ui || null };
    }
  } catch (e) {}
  return {};
}
// Схема сети (режим «Схема сети» вкладки «Редактор») — так же живёт в
// prefs.json и обязана попадать в каждый payload.
function networkSchemePrefsFields() {
  try {
    if (window.NetworkScheme && typeof window.NetworkScheme.getPersistedState === "function") {
      const s = window.NetworkScheme.getPersistedState();
      return { networkSchemeProject: s.project || null, networkSchemeUi: s.ui || null, networkSchemes: s.schemes || null, networkSchemeActive: s.activeId || null };
    }
  } catch (e) {}
  return {};
}

function buildPrefsPayload() {
  return JSON.stringify({
    favorites, favoriteRoutes,
    langMode: settings.langMode,
    tzMode: settings.tzMode,
    serverTzOffsetMin: settings.serverTzOffsetMin,
    minIntervalMin: state.minIntervalMin,
    overridesV2: overridesList,
    routeOverrides: routeOverridesMap,
    platformOverrides: platformOverridesMap,
    notifConflict: settings.notifConflict,
    notifDelay: settings.notifDelay,
    notifOnlyFav: settings.notifOnlyFav,
    notifCooldownMin: settings.notifCooldownMin,
    delayThresholdMin: settings.delayThresholdMin,
    betaUpdates: settings.betaUpdates,
    experimentalUi: settings.experimentalUi,
    routeMarkers: settings.routeMarkers,
    serverUrl: settings.serverUrl,
    serverList: settings.serverList || [],
    ...boardEditorPrefsFields(),
    ...networkSchemePrefsFields(),
  });
}
// ============================================================
// Диагностический отчёт (кнопка «Отчёт для баг-репорта» в настройках).
// Собирает состояние приложения в читаемый текст, который пользователь
// сохраняет файлом и прикладывает к баг-репорту. Секретов не содержит:
// только версия, статус сервера, настройки, счётчики и последние логи.
// ============================================================
async function buildDiagnosticReport() {
  const L = [];
  const line = (k, v) => L.push(`${k}: ${v}`);
  const section = (name) => { L.push(""); L.push(`===== ${name} =====`); };

  section("MTR Schedule Manager — diagnostic report");
  line("Generated", new Date().toISOString());

  // Статус сервера/данных
  let status = null;
  try { status = await fetch("/api/status").then((r) => r.json()); } catch (e) { status = { error: String(e) }; }
  section("App / server");
  line("App version", status && status.version ? status.version : "?");
  if (status && status.topology) {
    line("Topology", `${status.topology.stationCount} stations, ${status.topology.routeCount} routes; fetchedAt ${status.topology.fetchedAt ? new Date(status.topology.fetchedAt).toISOString() : "—"}`);
    if (status.topology.lastError) line("Topology last error", `${status.topology.lastError.message} @ ${status.topology.lastError.at ? new Date(status.topology.lastError.at).toISOString() : "?"}`);
  }
  if (status && status.departures) {
    line("Departures", `${status.departures.routeCount} routes; fetchedAt ${status.departures.fetchedAt ? new Date(status.departures.fetchedAt).toISOString() : "—"}`);
    if (status.departures.lastError) line("Departures last error", `${status.departures.lastError.message} @ ${status.departures.lastError.at ? new Date(status.departures.lastError.at).toISOString() : "?"}`);
  }

  // Окружение
  section("Environment");
  line("User agent", navigator.userAgent);
  line("Platform", navigator.platform);
  line("Languages", (navigator.languages || []).join(", "));
  line("Online", navigator.onLine);
  line("Window size", `${window.innerWidth}x${window.innerHeight} (dpr ${window.devicePixelRatio})`);
  line("In Electron", !!window.electronAPI);
  line("System TZ offset (min)", -new Date().getTimezoneOffset());

  // Настройки (без секретов)
  section("Settings");
  line("Language mode", settings.langMode);
  line("Effective language", currentLang());
  line("TZ mode", settings.tzMode);
  line("Server TZ offset (min)", settings.serverTzOffsetMin);
  line("MTR server URL", settings.serverUrl || "(default)");
  line("Server list", JSON.stringify(settings.serverList || []));
  line("Min interval (min)", state.minIntervalMin);
  line("Beta updates", settings.betaUpdates);
  line("Experimental UI", settings.experimentalUi);
  line("Notifications", `conflict=${settings.notifConflict} delay=${settings.notifDelay} onlyFav=${settings.notifOnlyFav} cooldown=${settings.notifCooldownMin} threshold=${settings.delayThresholdMin}`);

  // Состояние приложения
  section("State");
  const activeTab = document.querySelector(".tab-btn.active");
  line("Active tab", activeTab ? activeTab.dataset.tab : "?");
  line("Current station", state.currentStationId || "—");
  line("Last graph", state.lastGraphData ? `${state.lastGraphData.fromStationName} → ${state.lastGraphData.toStationName} (${(state.lastGraphData.routes || []).length} routes)` : "—");
  line("Overrides", `trip=${overridesList.length} route=${Object.keys(routeOverridesMap).length} platform=${Object.keys(platformOverridesMap).length}`);
  line("Favorites", `stations=${favorites.length} routes=${favoriteRoutes.length}`);
  line("Analytics rows", (state.lastAnalytics || []).length);

  // Логи и ошибки
  section(`Recent console logs / errors (${_diagLog.length})`);
  if (_diagLog.length) L.push(..._diagLog);
  else L.push("(none captured)");

  return L.join("\n");
}

async function downloadDiagnosticReport() {
  const content = await buildDiagnosticReport();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `mtr-diagnostic-${stamp}.txt`;
  // В Electron — нативный диалог «Сохранить как» (пользователь выбирает путь).
  if (window.electronAPI?.saveDiagnostic) {
    try {
      const res = await window.electronAPI.saveDiagnostic(filename, content);
      if (res && res.saved) { setStatusToast(t("diagReportSaved", { path: res.path })); return; }
      if (res && res.canceled) return;
      // ошибка → падаем в браузерный фолбэк ниже
    } catch (e) { /* фолбэк */ }
  }
  // Браузерный фолбэк: скачивание через Blob
  try {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
    setStatusToast(t("diagReportSaved", { path: filename }));
  } catch (e) {
    setStatusToast(t("diagReportError"));
  }
}

// Мини-тост в статус-бейдже (нет отдельной системы тостов)
function setStatusToast(msg) {
  const badge = document.getElementById("statusBadge");
  if (!badge) return;
  const prev = badge.textContent, prevClass = badge.className;
  badge.textContent = msg; badge.className = "status-badge ok";
  setTimeout(() => { badge.textContent = prev; badge.className = prevClass; }, 4000);
}

window.addEventListener("beforeunload", () => {
  const payload = buildPrefsPayload();
  // В Electron — через contextBridge API (надёжнее)
  if (window.electronAPI?.savePrefsSync) {
    try { window.electronAPI.savePrefsSync(payload); } catch {}
  }
  // Fallback: синхронный XHR
  try {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/prefs", false);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.send(payload);
  } catch {}
});


// Показ changelog при обновлении
function showChangelogModal(version, notes) {
  var lang = currentLang();
  var text = (typeof notes === "object" ? notes[lang] || notes["en"] || notes["ru"] : notes) || "";
  var overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:24px";
  var modal = document.createElement("div");
  modal.style.cssText = "background:var(--panel);border:1px solid var(--border);border-radius:12px;max-width:560px;width:100%;max-height:80vh;overflow-y:auto;padding:28px;position:relative";
  var html = text.split("\n").map(function(line) {
    if (line.startsWith("## ")) return "<h2 style=\"margin:0 0 12px;font-size:17px\">" + line.slice(3) + "</h2>";
    if (line.startsWith("### ")) return "<h3 style=\"margin:10px 0 4px;font-size:13px;color:var(--accent)\">" + line.slice(4) + "</h3>";
    if (line.startsWith("**") && line.endsWith("**") && line.length > 4) return "<p style=\"margin:8px 0 2px;font-weight:600;font-size:13px\">" + line.slice(2,-2) + "</p>";
    if (line.trim() === "") return "<br>";
    return "<p style=\"margin:0 0 3px;font-size:12px;color:var(--muted)\">" + line + "</p>";
  }).join("");
  modal.innerHTML = "<button onclick=\"this.closest(\'[data-cl]\').remove()\" style=\"position:absolute;top:12px;right:12px;background:none;border:none;color:var(--muted);font-size:20px;cursor:pointer\">\u2715</button>"
    + "<div style=\"font-size:11px;color:var(--accent);font-weight:700;margin-bottom:8px;letter-spacing:1px\">v" + version + "</div>"
    + "<div>" + html + "</div>"
    + "<div style=\"margin-top:20px;text-align:right\"><button onclick=\"this.closest(\'[data-cl]\').remove()\" style=\"background:var(--accent);color:#fff;border:none;border-radius:6px;padding:8px 20px;font-size:13px;cursor:pointer\">OK</button></div>";
  overlay.setAttribute("data-cl","1");
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  overlay.addEventListener("click", function(e) { if (e.target === overlay) overlay.remove(); });
}
if (window.electronAPI && window.electronAPI.onChangelog) {
  window.electronAPI.onChangelog(function(d) { showChangelogModal(d.version, d.notes); });
}


(async function init() {
  // Сначала загружаем сохранённые настройки (язык, часовой пояс и т.д.),
  // затем применяем i18n — иначе язык сбрасывается на системный при каждом запуске.
  // Проверяем pending-changelog
  try {
    var _clr = await fetch("/api/pending-changelog");
    if (_clr.ok) { var _cl = await _clr.json(); if (_cl && _cl.version) setTimeout(function(){ showChangelogModal(_cl.version, _cl.translations || _cl.notes); }, 800); }
  } catch(_cle) {}
  await loadPrefsFromServer();
  try { loadCarsCacheFromStorage(); } catch (e) {}
  try { applyI18n(); } catch (e) { console.error("applyI18n failed:", e); }
  try { initSettingsUI(); } catch (e) { console.error("initSettingsUI failed:", e); }
  try { initNotifSettings(); } catch (e) { console.warn("initNotifSettings failed (non-critical):", e); }
  try { renderInstructions(); } catch (e) { console.error("renderInstructions failed:", e); }
  try { window.BoardEditor && window.BoardEditor.init(); } catch (e) { console.error("BoardEditor.init failed:", e); }
  try { window.NetworkScheme && window.NetworkScheme.init(); } catch (e) { console.error("NetworkScheme.init failed:", e); }
  try {
    document.getElementById("minIntervalValue").textContent = t("minIntervalValue", { m: state.minIntervalMin });
  } catch (e) {}
  await refreshStatus();
  await loadStations();
  try { await restoreFromUrlHash(); } catch (e) { console.error("restoreFromUrlHash failed:", e); }

  setInterval(refreshStatus, 15000);
  setInterval(() => { if (_shouldPoll() && state.currentStationId) loadSchedule(); }, 60000);
  setInterval(() => { if (_shouldPollArrivals()) loadArrivals(state.currentStationId).catch(()=>{}); }, 60000);
  // Фоновые уведомления о конфликтах/опозданиях (проверяет флаги внутри).
  setInterval(() => { runNotificationChecks().catch(() => {}); }, 90000);
  setTimeout(() => { runNotificationChecks().catch(() => {}); }, 8000);
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
  updateNextPageTitle();

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
let favorites = [];
let favoriteRoutes = [];

// Сохраняем все пользовательские настройки на сервер (файл prefs.json в DATA_DIR)
// чтобы они переживали перезапуск Electron-приложения.
async function savePrefsToServer() {
  try {
    await fetch("/api/prefs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        favorites,
        favoriteRoutes,
        langMode: settings.langMode,
        tzMode: settings.tzMode,
        serverTzOffsetMin: settings.serverTzOffsetMin,
        minIntervalMin: state.minIntervalMin,
        overridesV2: overridesList,
        routeOverrides: routeOverridesMap,
        platformOverrides: platformOverridesMap,
        serverUrl: settings.serverUrl,
        serverList: settings.serverList || [],
        // Настройки уведомлений: раньше их тут не было — POST /api/prefs
        // перезаписывает файл целиком, и галочки «слетали» при обычном
        // сохранении (см. гочу про buildPrefsPayload в CLAUDE.md).
        notifConflict: settings.notifConflict,
        notifDelay: settings.notifDelay,
        notifOnlyFav: settings.notifOnlyFav,
        notifCooldownMin: settings.notifCooldownMin,
        delayThresholdMin: settings.delayThresholdMin,
        betaUpdates: settings.betaUpdates,
        experimentalUi: settings.experimentalUi,
        routeMarkers: settings.routeMarkers,
        ...boardEditorPrefsFields(),
        ...networkSchemePrefsFields(),
      }),
    });
  } catch (e) { console.warn("savePrefsToServer failed:", e.message); }
}
async function loadPrefsFromServer() {
  try {
    const res = await fetch("/api/prefs");
    if (!res.ok) return;
    const p = await res.json();
    if (Array.isArray(p.favorites)) favorites = p.favorites;
    if (Array.isArray(p.favoriteRoutes)) favoriteRoutes = p.favoriteRoutes;
    if (p.langMode) settings.langMode = p.langMode;
    if (p.tzMode !== undefined) settings.tzMode = p.tzMode;
    if (p.serverTzOffsetMin !== undefined) settings.serverTzOffsetMin = Number(p.serverTzOffsetMin);
    if (Number.isFinite(p.minIntervalMin)) state.minIntervalMin = p.minIntervalMin;
    if (Array.isArray(p.overridesV2)) { overridesList = p.overridesV2; }
    if (p.routeOverrides) routeOverridesMap = p.routeOverrides;
    if (p.platformOverrides) platformOverridesMap = p.platformOverrides;
    if (p.serverUrl) settings.serverUrl = p.serverUrl;
    if (Array.isArray(p.serverList)) settings.serverList = p.serverList;
    if (typeof p.notifConflict === "boolean") settings.notifConflict = p.notifConflict;
    if (typeof p.notifDelay === "boolean") settings.notifDelay = p.notifDelay;
    if (typeof p.notifOnlyFav === "boolean") settings.notifOnlyFav = p.notifOnlyFav;
    if (Number.isFinite(Number(p.notifCooldownMin))) settings.notifCooldownMin = Number(p.notifCooldownMin);
    if (Number.isFinite(Number(p.delayThresholdMin))) settings.delayThresholdMin = Number(p.delayThresholdMin);
    if (typeof p.betaUpdates === "boolean") settings.betaUpdates = p.betaUpdates;
    if (typeof p.experimentalUi === "boolean") settings.experimentalUi = p.experimentalUi;
    if (p.routeMarkers && typeof p.routeMarkers === "object" && !Array.isArray(p.routeMarkers)) settings.routeMarkers = p.routeMarkers;
    applyExperimentalUi();
    try {
      if (window.BoardEditor && typeof window.BoardEditor.applyPersistedState === "function") {
        window.BoardEditor.applyPersistedState({
          presets: Array.isArray(p.boardEditorPresets) ? p.boardEditorPresets : [],
          lastCanvas: p.boardEditorLastCanvas || null,
          ui: p.boardEditorUi || null,
        });
      }
    } catch (e) {}
    try {
      if (window.NetworkScheme && typeof window.NetworkScheme.applyPersistedState === "function") {
        window.NetworkScheme.applyPersistedState({
          project: p.networkSchemeProject || null,
          ui: p.networkSchemeUi || null,
          schemes: p.networkSchemes || null,
          activeId: p.networkSchemeActive || null,
        });
      }
    } catch (e) {}
  } catch (e) { console.warn("loadPrefsFromServer failed:", e.message); }
}

function saveFavorites() {
  // Persist to server so favorites survive Electron restarts
  savePrefsToServer();
}

// Избранное привязано к MTR-серверу (поле server): станции другого сервера
// здесь не выбрать, а значит и не снять ☆. Старые записи без server
// привязываются к текущему серверу, как только станция на нём нашлась.
function currentServerKey() {
  return settings.serverUrl || DEFAULT_SERVER;
}
function isFavOnThisServer(f) {
  return !f.server || f.server === currentServerKey();
}

// ---- Станции ----
function isFavorite(stationId) {
  return favorites.some((f) => f.id === stationId && isFavOnThisServer(f));
}
function toggleFavorite(stationId) {
  if (isFavorite(stationId)) {
    favorites = favorites.filter((f) => !(f.id === stationId && isFavOnThisServer(f)));
  } else {
    const st = state.stations.find((s) => s.id === stationId);
    if (st) favorites.push({ id: st.id, name: st.name, server: currentServerKey() });
  }
  saveFavorites();
  renderFavoritesBar();
  updateFavoriteBtn();
}

// ---- Маршруты ----
function isFavoriteRoute(routeId) {
  return favoriteRoutes.some((r) => r.id === routeId);
}
// В избранное маршрут добавляется ПАРОЙ с обратным (и убирается тоже парой):
// прямой и обратный — это одна линия для пользователя, держать в избранном
// только одно направление смысла нет. Пару даёт сервер (reverseRouteId).
function favoriteRoutePairIds(routeId) {
  const ids = [routeId];
  const rev = state.routesById.get(routeId)?.reverseRouteId;
  if (rev && rev !== routeId) ids.push(rev);
  return ids;
}
function toggleFavoriteRoute(routeId) {
  const ids = favoriteRoutePairIds(routeId);
  if (isFavoriteRoute(routeId)) {
    favoriteRoutes = favoriteRoutes.filter((r) => !ids.includes(r.id));
  } else {
    for (const id of ids) {
      if (favoriteRoutes.some((r) => r.id === id)) continue;
      const route = state.routesById.get(id);
      if (route) favoriteRoutes.push({ id: route.id, name: route.name, color: route.color, number: route.number, server: currentServerKey() });
    }
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

function openFavoriteStation(stationId) {
  const st = state.stations.find((s) => s.id === stationId);
  if (!st) return;
  scheduleAC.setSelected(st.id, st.name);
  state.currentStationId = st.id;
  renderFavoritesBar();
  updateFavoriteBtn();
  loadSchedule();
  updateUrlHash();
}

// Избранные станции в боковом меню нового UI (там полоса избранного над расписанием скрыта)
function renderNextFavorites() {
  const box = document.getElementById("nextFavs");
  if (!box) return;
  // те же станции, что в полосе избранного: только этого сервера
  const shown = favorites.filter(isFavOnThisServer);
  const loaded = state.stations.length > 0;
  const known = new Set(state.stations.map((s) => s.id));
  box.classList.toggle("is-empty", shown.length === 0);
  const xTitle = escapeHtml(t("removeFavorite"));
  box.innerHTML =
    `<div class="next-favs-cap">${escapeHtml(t("favoritesLabel").replace(/:\s*$/, ""))}</div>` +
    shown.map((f) => {
      // станции нет на этом сервере — открыть нельзя, только убрать (как .fav-missing в полосе)
      const missing = loaded && !known.has(f.id);
      const cls = `next-fav${f.id === state.currentStationId ? " active" : ""}${missing ? " missing" : ""}`;
      const title = escapeHtml(missing ? t("favMissingHint") : f.name);
      // стопка бейджей линий станции (две + «+N»), как в макете
      const lines = missing ? [] : nxUniqBadges(nxRoutesAtStation(f.id));
      const stack = lines.length
        ? `<span class="nx-stack">${lines.slice(0, 2).map((r) => nxRouteBadge(r)).join("")}${lines.length > 2 ? nxMoreBadge(lines.length - 2) : ""}</span>`
        : "";
      return `<div class="${cls}" data-fav-id="${escapeHtml(f.id)}">` +
        `<button class="next-fav-open" title="${title}"><span class="nx-fav-name">${escapeHtml(f.name)}</span>${stack}</button>` +
        `<button class="next-fav-x" data-fav-remove title="${xTitle}" aria-label="${xTitle}">×</button></div>`;
    }).join("");
  box.querySelectorAll("[data-fav-id]").forEach((row) => {
    const id = row.dataset.favId;
    row.querySelector(".next-fav-open").addEventListener("click", () => {
      if (row.classList.contains("missing")) return;
      switchToTab("schedule");
      openFavoriteStation(id);
    });
    row.querySelector("[data-fav-remove]").addEventListener("click", () => {
      favorites = favorites.filter((f) => !(f.id === id && isFavOnThisServer(f)));
      saveFavorites();
      renderFavoritesBar();
      updateFavoriteBtn();
    });
  });
}

function renderFavoritesBar() {
  renderNextFavorites();
  const bar = document.getElementById("favoritesBar");
  if (!bar) return;
  // В панели над расписанием показываем ТОЛЬКО станции и только этого сервера
  const loaded = state.stations.length > 0;
  const known = new Set(state.stations.map((s) => s.id));
  let adopted = false;
  if (loaded) {
    for (const f of favorites) {
      if (!f.server && known.has(f.id)) { f.server = currentServerKey(); adopted = true; }
    }
    if (adopted) saveFavorites();
  }
  const shown = favorites.filter(isFavOnThisServer);
  if (shown.length === 0) { bar.style.display = "none"; return; }
  bar.style.display = "flex";

  const xTitle = escapeHtml(t("removeFavorite"));
  const stationChips = shown.map((f) => {
    // нет на сервере: запись без привязки с другого сервера или удалённая станция
    const missing = loaded && !known.has(f.id);
    const active = f.id === state.currentStationId;
    const cls = `fav-chip${active ? " fav-active" : ""}${missing ? " fav-missing" : ""}`;
    const title = escapeHtml(t(missing ? "favMissingHint" : "favStationHint"));
    return `<button class="${cls}" data-fav-id="${escapeHtml(f.id)}" title="${title}">${escapeHtml(f.name)}<span class="fav-x" data-fav-remove title="${xTitle}">×</span></button>`;
  }).join("");

  // Крестик "очистить всё избранное" убран по запросу — отдельные станции
  // снимаются с избранного кнопкой ☆ рядом с полем поиска.
  bar.innerHTML =
    `<span class="fav-label">${escapeHtml(t("favoritesLabel"))}</span>` +
    stationChips;

  bar.querySelectorAll("[data-fav-id]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      if (e.target.closest("[data-fav-remove]")) {
        const id = btn.dataset.favId;
        favorites = favorites.filter((f) => !(f.id === id && isFavOnThisServer(f)));
        saveFavorites();
        renderFavoritesBar();
        updateFavoriteBtn();
        return;
      }
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
    const effectiveDev = getEffectiveDeviation(e.routeId, e.deviationMs);
    const isLive = _arrivalsCache.get(e.routeId)?.realtime === true;
    // effArrival УЖЕ содержит отклонение (времена из API приходят с учётом
    // задержки). Заменяем вшитое e.deviationMs на актуальное effectiveDev,
    // а не прибавляем поверх — иначе опоздание учитывается дважды.
    const actualMs = normalizeMs(e.effArrival - (e.deviationMs || 0) + effectiveDev);
    const hasDelay = Math.abs(effectiveDev) > 60000;
    const delayHtml = hasDelay
      ? `<span class="${effectiveDev > 0 ? "dev-pos" : "dev-neg"}">${effectiveDev > 0 ? "+" : ""}${Math.round(effectiveDev / 60000)} ${t("nearestMin")}${isLive ? " 🔴" : ""}</span>`
      : `<span class="nb-ontime"><span class="nb-dot">${isLive ? "🟢" : "●"}</span><span class="next-only">${escapeHtml(t("nextOnTime"))}</span></span>`;
    // Конечная станция (последняя в маршруте из routesById)
    const route = state.routesById.get(e.routeId);
    const routeFull = state.routes?.find(r => r.id === e.routeId);
    const lastStop = routeFull?.stations?.[routeFull.stations.length - 1];
    const lastStName = lastStop ? state.stations?.find(s => s.id === lastStop.id)?.name : null;
    const terminus = route?.terminus || lastStName || "—";
    // Платформа: берём из arrivals (точнее) если есть, иначе из расписания
    const liveEntry = _arrivalsCache.get(e.routeId);
    const livePlatform = liveEntry?.platformName;
    const platformLabel = livePlatform || e.platformName || "—";
    // Отправление показываем ПЛАНОВОЕ: времена (и depData.departureMs, и
    // e.effDeparture) приходят с уже вшитым отклонением — вычитаем его.
    const depData = getDepartureData(e.routeId, e.arrivalMs);
    const depTimeHtml = depData?.departureMs != null
      ? formatLocal(normalizeMs(depData.departureMs - (depData.deviation || 0)))
      : (e.effDeparture !== null ? formatLocal(normalizeMs(e.effDeparture - (e.deviationMs || 0))) : `<span class="nb-muted">—</span>`);
    return `<tr class="nb-row" data-route-id="${escapeHtml(e.routeId)}">
      <td>${routeMarker(e.routeType, e.color, e.routeNumber, "md")}${routeMarkerShowsNumber(e.routeType) && e.routeNumber ? "" : `<b>${escapeHtml(e.routeNumber || e.routeName)}</b>`}</td>
      <td class="nb-terminus">${escapeHtml(terminus)}</td>
      <td class="nb-platform">${escapeHtml(platformLabel)}</td>
      <td>${formatLocal(hasDelay ? actualMs : e.effArrival)}</td>
      <td>${depTimeHtml}</td>
      <td>${etaHtml}</td>
      <td>${delayHtml}</td>
    </tr>`;
  }).join("");

  const colPlatform = lang === "ru" ? "Платф." : "Platf.";
  const colDep = lang === "ru" ? "Отпр." : "Dep.";
  list.innerHTML = `<thead><tr class="nb-head">
    <th>${colNum}</th><th>${lang === "ru" ? "Конечная" : "Terminus"}</th>
    <th>${colPlatform}</th>
    <th>${colTime}</th><th>${colDep}</th><th>${colEta}</th><th>${colDelay}</th>
  </tr></thead><tbody>${rows}</tbody>`;

  list.querySelectorAll("tr[data-route-id]").forEach((row) => {
    row.addEventListener("click", () => openRouteModal(row.dataset.routeId));
  });
}

setInterval(renderNearestTrains, 30000);

// ── Живые данные arrivals (реальные отклонения по каждому поезду) ────
// Кеш: Map<routeId hex, {deviationMs, realtime, arrival}> — обновляется при смене станции.
// routeId в arrivals — signed int64 decimal, в topology — hex без ведущих нулей.
const _arrivalsCache = new Map();
// Индекс для поиска departureIndex по tripOriginMs:
// Map<routeIdHex, Array<{tripOriginMs, departureIndex, deviation, realtime, platformName}>>
const _depIdxCache = new Map();
const _carsCache = new Map(); // routeNumber → cars[] из arrivals

// Составность (cars[]) приходит только из live-arrivals. Чтобы схема поезда
// в карточке маршрута показывалась и без активного подключения, кешируем
// последний известный состав в localStorage (по каждому серверу отдельно —
// номера маршрутов на разных серверах разные).
function _carsCacheStorageKey() {
  return "mtrCarsCache:" + (settings.serverUrl || "default");
}
function loadCarsCacheFromStorage() {
  _carsCache.clear();
  try {
    const raw = localStorage.getItem(_carsCacheStorageKey());
    if (!raw) return;
    const obj = JSON.parse(raw);
    for (const k in obj) if (Array.isArray(obj[k])) _carsCache.set(k, obj[k]);
  } catch (e) {}
}
let _carsCacheSaveTimer = null;
function saveCarsCacheToStorage() {
  clearTimeout(_carsCacheSaveTimer);
  _carsCacheSaveTimer = setTimeout(() => {
    try {
      const obj = {};
      for (const [k, v] of _carsCache) obj[k] = v;
      localStorage.setItem(_carsCacheStorageKey(), JSON.stringify(obj));
    } catch (e) {}
  }, 800);
}

function _int64DecimalToHex(decStr) {
  let n = BigInt(decStr);
  if (n < 0n) n = n + (1n << 64n);
  return n.toString(16).toUpperCase();
}

async function loadArrivals(stationId) {
  try {
    const res = await fetch(`/api/stations/${encodeURIComponent(stationId)}/arrivals`);
    if (!res.ok) return;
    const data = await res.json();
    _arrivalsCache.clear();
    _depIdxCache.clear();
    for (const a of (data.arrivals || [])) {
      const hexId = _int64DecimalToHex(String(a.routeId));
      if (Array.isArray(a.cars) && a.cars.length > 0 && a.routeNumber) {
        _carsCache.set(a.routeNumber, a.cars);
        saveCarsCacheToStorage();
      }
      // _arrivalsCache: только ближайший рейс (для виджета и дашборда)
      const existing = _arrivalsCache.get(hexId);
      if (!existing || a.arrival < existing.arrival) {
        _arrivalsCache.set(hexId, {
          deviationMs: a.deviation || 0,
          realtime: a.realtime || false,
          arrival: a.arrival,
          platformName: a.platformName || null,
        });
      }
      // _depIdxCache: все рейсы маршрута для сопоставления с tripOriginMs
      if (!_depIdxCache.has(hexId)) _depIdxCache.set(hexId, []);
      _depIdxCache.get(hexId).push({
        // arrival — epoch ms, переводим в мс от полуночи для сопоставления с tripOriginMs
        tripOriginApproxMs: a.arrival % 86400000,
        departureMs: a.departure ? a.departure % 86400000 : null,
        departureIndex: a.departureIndex,
        deviation: a.deviation || 0,
        realtime: a.realtime || false,
        platformName: a.platformName || null,
        carCount: Array.isArray(a.cars) ? a.cars.length : null,
      });
    }
  } catch (e) {
    console.warn("[arrivals] fetch failed:", e.message);
  }
}

// Возвращает departureIndex из arrivals для конкретного рейса маршрута.
// Сопоставляет tripOriginMs (мс от полуночи) с arrival из arrivals
// в пределах погрешности ±5 минут (учитывает deviation и сдвиги).
// Возвращает полный объект рейса из _depIdxCache по tripOriginMs
function getDepartureData(routeId, tripOriginMs) {
  const trips = _depIdxCache.get(routeId);
  if (!trips || trips.length === 0) return null;
  const TOLERANCE = 5 * 60 * 1000;
  let best = null;
  let bestDiff = Infinity;
  for (const t of trips) {
    let diff = Math.abs(t.tripOriginApproxMs - tripOriginMs);
    if (diff > 43200000) diff = 86400000 - diff;
    if (diff < bestDiff && diff <= TOLERANCE) { bestDiff = diff; best = t; }
  }
  return best;
}

function getDepartureIndex(routeId, tripOriginMs) {
  const d = getDepartureData(routeId, tripOriginMs);
  return d ? d.departureIndex : null;
}

function getEffectiveDeviation(routeId, plannedDeviationMs) {
  const live = _arrivalsCache.get(routeId);
  if (live && live.realtime) return live.deviationMs;
  return plannedDeviationMs;
}





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

  // Конфликты рейса на ГРАФИКЕ движения приводим к тому же виду, что даёт
  // дашборд (state.conflictDetails): нужны effArrival/effDeparture/dwell,
  // чтобы посчитать сдвиг той же формулой. У станционных конфликтов графика
  // есть arr/end — их и переиспользуем (dwell уже внутри end).
  function graphConflictPartners(routeId, t0) {
    const out = [];
    const stName = new Map((state.lastGraphData?.stations || []).map((s) => [s.stationId, s.name]));
    for (const c of state._graphConflicts || []) {
      if (c.kind !== "station") continue; // обгон сдвигом «на N минут» не лечится
      let me = null, other = null;
      if (c.a.routeId === routeId && c.a.t0 === t0) { me = c.a; other = c.b; }
      else if (c.b.routeId === routeId && c.b.t0 === t0) { me = c.b; other = c.a; }
      if (!me || !other) continue;
      out.push({
        routeId: other.routeId, routeNumber: other.routeNumber, routeName: other.routeNumber,
        tripOriginMs: other.t0,
        effArrival: normalizeMs(other.arr), effDeparture: normalizeMs(other.end), dwellTimeMs: 0,
        // Времена САМОГО рейса именно на этой станции: на графике один рейс
        // конфликтует на разных станциях, и сдвиг для каждого конфликта надо
        // считать по его собственным временам, а не по первой остановке.
        _meArrival: normalizeMs(me.arr), _meEnd: normalizeMs(me.end),
        _stationName: stName.get(me.stationId) || "",
      });
    }
    return out;
  }

  document.addEventListener("contextmenu", (e) => {
    const block = e.target.closest(".entry-block[data-eidx]");
    const graphLine = e.target.closest("[data-tref]");
    if (!block && !graphLine) {
      // Скрываем меню если ПКМ не по блоку и не по линии рейса
      if (isVisible()) hideMenu();
      return;
    }
    e.preventDefault();
    e.stopPropagation();

    let conflicts;
    if (block) {
      const idx = Number(block.dataset.eidx);
      const entries = state.currentDashboardEntries;
      if (!entries || !entries[idx]) return;
      ctxEntry = entries[idx];
      conflicts = state.conflictDetails.get(ctxEntry.entryKey) || [];
    } else {
      // ПКМ по линии рейса на графике движения: собираем entry той же формы,
      // что и блок дашборда, — дальше меню строится одним и тем же кодом.
      const ref = state.graphTripRefs?.[Number(graphLine.dataset.tref)];
      if (!ref) return;
      const pts = ref.effPoints || [];
      const first = pts[0] || {};
      ctxEntry = {
        routeId: ref.route.routeId,
        routeName: ref.route.routeName,
        routeNumber: ref.route.routeNumber,
        tripOriginMs: ref.trip.tripOriginMs,
        isDraft: !!ref.route.isDraft,
        effArrival: normalizeMs(first.arrivalMs ?? 0),
        effDeparture: first.departureMs == null ? null : normalizeMs(first.departureMs),
        dwellTimeMs: 0,
        delta: ref.delta,
        isEdited: ref.isEdited,
      };
      conflicts = graphConflictPartners(ctxEntry.routeId, ctxEntry.tripOriginMs);
    }

    const isFav = isFavoriteRoute(ctxEntry.routeId);
    const copyLabel = currentLang() === "ru" ? "Скопировать сдвиг" : "Copy time shift";

    const items = [
      { label: `<b>${escapeHtml(ctxEntry.routeNumber ? `${ctxEntry.routeNumber} — ${ctxEntry.routeName}` : ctxEntry.routeName)}</b>`, header: true },
      { divider: true },
      { label: `${isFav ? "★ " + t("removeFavorite") : "☆ " + t("addFavorite")}`, action: "toggleFav" },
      { label: `ⓘ  ${t("ctxRouteInfo")}`, action: "openCard" },
      { label: `⛓  ${t("ctxHighlightChain")}`, action: "highlightChain" },
      // copyShift removed
      ...(getOverride(ctxEntry.routeId, ctxEntry.tripOriginMs) !== 0 ||
          getRouteOverride(ctxEntry.routeId) !== 0 ? [
        { divider: true },
        { label: t("ctxResetTrip"), action: "resetTrip" },
      ] : []),
      ...(hasRouteOverride(ctxEntry.routeId) ? [
        { label: t("ctxResetRoute"), action: "resetRoute" },
      ] : []),
    ];

    if (conflicts.length) {
      const MAX_SUGGESTIONS = 6; // на графике рейс конфликтует на многих станциях
      const suggestions = [];
      for (const other of conflicts) {
        const minIntervalMs = state.minIntervalMin * 60000;
        const BUFFER = 1000; // чтобы после сдвига интервал был строго > minIntervalMs
        // Конец занятости платформы = max(отправление, прибытие + стоянка) —
        // так же, как в computeConflicts.
        const endOf = (e) => Math.max(e.effDeparture ?? e.effArrival, e.effArrival + (e.dwellTimeMs || 0));
        // Времена САМОГО рейса в точке конфликта. На дашборде это всегда одна
        // станция (=ctxEntry), на графике у каждого конфликта своя — тогда
        // партнёр приносит их в _meArrival/_meEnd.
        const meArrival = other._meArrival ?? ctxEntry.effArrival;
        const meEnd = other._meEnd ?? endOf(ctxEntry);
        let shiftMs;
        if (other.effArrival <= meArrival) {
          // other идёт ПЕРЕД текущим → двигаем текущий ВПРАВО (позже),
          // увеличивая интервал между концом other и прибытием текущего.
          const gap = meArrival - endOf(other);
          shiftMs = Math.ceil((minIntervalMs - gap + BUFFER) / 60000) * 60000;
        } else {
          // other идёт ПОСЛЕ текущего → двигаем текущий ВЛЕВО (раньше),
          // увеличивая интервал между концом текущего и прибытием other.
          // Раньше здесь использовались неверные точки отсчёта, из-за чего
          // сдвиг «− X мин» не устранял конфликт (та же бага, что чинили для «+»).
          const gap = other.effArrival - meEnd;
          shiftMs = -Math.ceil((minIntervalMs - gap + BUFFER) / 60000) * 60000;
        }
        if (Math.abs(shiftMs) < 60000) continue; // «сдвинуть на 0 минут» — не подсказка
        const shiftMin = Math.abs(shiftMs) / 60000;
        const dir = shiftMs > 0 ? "+" : "−";
        const where = other._stationName ? ` · ${escapeHtml(other._stationName)}` : "";
        suggestions.push({
          label: `↕  ${escapeHtml(t("conflictSuggestShift", { name: ctxEntry.routeNumber || ctxEntry.routeName, mins: `${dir}${shiftMin}` }))}${where}`,
          action: "fixConflict",
          shiftMs,
        });
      }
      if (suggestions.length) {
        items.push({ divider: true });
        items.push({ label: `⚠ ${t("conflictLabel")}`, header: true });
        items.push(...suggestions.slice(0, MAX_SUGGESTIONS));
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
        else if (action === "highlightChain") toggleChainHighlight(saved.routeId, saved.tripOriginMs);
        else if (action === "copyShift") {
          state.lastCopiedRouteId = saved.routeId;
          try { clipboardRouteId = saved.routeId; clipboardDeltaMs = getRouteOverride(saved.routeId); } catch {}
        }
        else if (action === "fixConflict") {
          const delta = Number(el.dataset.shift);
          pushUndoSnapshot();
          const _nd3 = (getOverride(saved.routeId, saved.tripOriginMs) || 0) + delta;
          setOverride(saved.routeId, saved.tripOriginMs, _nd3);
          applyReverseShift(saved.routeId, saved.tripOriginMs, _nd3);
          renderDashboardFromCache();
          renderGraphFromCache();
        }
        else if (action === "resetTrip") {
          pushUndoSnapshot();
          const routeDelta = getRouteOverride(saved.routeId);
          if (routeDelta !== 0) {
            // Маршрут сдвинут целиком — компенсируем для этого рейса
            // setOverride(tripDelta = -routeDelta) → эффективный сдвиг = 0
            setOverride(saved.routeId, saved.tripOriginMs, -routeDelta);
          } else {
            removeOverride(saved.routeId, saved.tripOriginMs);
          }
          renderDashboardFromCache();
          renderGraphFromCache();
          savePrefsToServer();
        }
        else if (action === "resetRoute") {
          pushUndoSnapshot();
          removeRouteOverride(saved.routeId);
          renderDashboardFromCache();
          renderGraphFromCache();
          savePrefsToServer();
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

