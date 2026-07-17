const store = require("./store");
const drafts = require("./drafts");
const { formatTimeOfDay, formatTimeOfDayShort, normalizeTimeOfDay } = require("./time");

/**
 * Названия маршрутов могут быть многоязычными/составными через "||",
 * например "Metro A||M1". Берём первую часть как читаемое имя.
 */
function splitRouteName(rawName) {
  const parts = (rawName || "").split("||");
  return {
    displayName: parts[0] || rawName || "",
    shortCode: parts[1] || "",
  };
}

function colorToHex(intColor) {
  if (intColor === undefined || intColor === null) return "#6366f1";
  return "#" + (intColor & 0xffffff).toString(16).padStart(6, "0");
}

/**
 * Названия платформ у MTR иногда тоже составные/многоязычные через "|"
 * (как и названия станций/маршрутов). Берём первую часть и убираем
 * пробелы по краям — иначе одна и та же платформа может "размножиться"
 * на несколько строк в дашборде из-за разного форматирования строки.
 */
function normalizePlatformName(rawName, fallbackKey) {
  const raw = (rawName || "").split("|")[0].trim();
  return raw || fallbackKey;
}

/**
 * Координаты у остановок пробного маршрута не заданы пользователем
 * (он выбирает только существующую станцию), поэтому берём реальные
 * координаты этой станции из любого настоящего маршрута, где она
 * встречается — это нужно, чтобы пробный маршрут корректно ложился
 * на график движения (ось расстояния).
 */
function findStationCoords(topology, stationId) {
  for (const route of topology.routes) {
    const stop = (route.stations || []).find((s) => s.id === stationId);
    if (stop) return { x: stop.x, y: stop.y, z: stop.z };
  }
  return { x: 0, y: 0, z: 0 };
}

/**
 * Превращает сохранённый пробный маршрут в объект той же формы, что и
 * настоящий route из MTR API — это позволяет переиспользовать всю
 * логику buildStationSchedule/buildRouteGraph без дублирования кода.
 */
function draftToRouteShape(draft, topology) {
  const stations = draft.stops.map((s) => {
    const coords = findStationCoords(topology, s.stationId);
    return { id: s.stationId, x: coords.x, y: coords.y, z: coords.z, name: s.platformName, dwellTime: s.dwellTimeMs };
  });
  return {
    id: draft.id,
    name: draft.name,
    number: draft.number,
    color: draft.color,
    type: draft.type,
    circularState: "NONE",
    hidden: false,
    stations,
    durations: draft.durationsMs,
    depots: draft.depotLabel ? [draft.depotLabel] : [],
    isDraft: true,
  };
}
/**
 * Превращает группы отправлений по формуле (D + X*I) и индивидуальные
 * отправления пробного маршрута в единый плоский список времён.
 */
function expandDraftDepartureTimes(draft) {
  const times = [...(draft.departureTimesOfDayMs || [])];
  for (const g of draft.departureGroups || []) {
    for (let x = 0; x <= g.additionalCount; x++) {
      const raw = g.firstTimeMs + x * g.intervalMs;
      times.push(((raw % 86400000) + 86400000) % 86400000);
    }
  }
  return times;
}
function draftDepartureEntry(draft) {
  return { id: draft.id, isDraftEntry: true, departures: [{ deviation: 0, departures: expandDraftDepartureTimes(draft) }] };
}
function getMergedRoutesAndDepartures(topology, departuresCache) {
  const draftList = drafts.list();
  const draftRoutes = draftList.map((d) => draftToRouteShape(d, topology));
  const draftDepartureEntries = draftList.map(draftDepartureEntry);
  const allRoutes = [...topology.routes, ...draftRoutes];
  const allDeparturesByRouteId = new Map(
    [...(departuresCache ? departuresCache.departures : []), ...draftDepartureEntries].map((d) => [d.id, d])
  );
  return { allRoutes, allDeparturesByRouteId };
}

/**
 * Карта обратных маршрутов: routeId → reverseRouteId. Пара = станции идут
 * строго в обратном порядке + совпадает цвет (защита от случайных совпадений).
 * Расчёт O(n²) по маршрутам, поэтому кешируется по (fetchedAt топологии +
 * число маршрутов) — раньше этот цикл выполнялся на каждый buildStationSchedule.
 */
let _revMapCache = null;
let _revMapCacheKey = "";
function getReverseRouteMap(allRoutes, topologyFetchedAt) {
  const key = (topologyFetchedAt || 0) + ":" + allRoutes.length;
  if (_revMapCache && _revMapCacheKey === key) return _revMapCache;
  const reverseRouteMap = new Map();
  for (const route of allRoutes) {
    if (reverseRouteMap.has(route.id)) continue;
    const myStops = (route.stations || []).map((s) => s.id);
    if (myStops.length < 2) continue;
    for (const other of allRoutes) {
      if (other.id === route.id || reverseRouteMap.has(other.id)) continue;
      const otherStops = (other.stations || []).map((s) => s.id);
      if (otherStops.length !== myStops.length) continue;
      const isReverse = myStops.every((id, i) => otherStops[myStops.length - 1 - i] === id);
      if (!isReverse) continue;
      if (route.color !== other.color) continue;
      reverseRouteMap.set(route.id, other.id);
      reverseRouteMap.set(other.id, route.id);
      break;
    }
  }
  _revMapCache = reverseRouteMap;
  _revMapCacheKey = key;
  return reverseRouteMap;
}

/**
 * Строит расписание прибытий/отправлений по конкретной станции,
 * объединяя все маршруты, проходящие через неё.
 *
 * Возвращает { stationId, stationName, generatedAt, entries: [...] }
 * либо null, если данных ещё нет (поллер не успел опросить сервер).
 */
function buildStationSchedule(stationId) {
  const topology = store.getTopology();
  const departuresCache = store.getDepartures();

  if (!topology || !departuresCache) {
    return null;
  }

  // t0 в departures API = scheduledDepartureTime - currentMillis (исходный код MTR).
  // Это относительное время: сколько мс до отправления от момента запроса.
  // currentTime из API = System.currentTimeMillis() — реальный epoch ms сервера.
  // Правильная конвертация: realEpoch = currentTime + t0
  // msOfDay = (currentTime + t0) % 86400000
  const _mtrCurrent = departuresCache.currentTime || Date.now();
  function t0ToUtcMs(t0) {
    return ((_mtrCurrent + t0) % 86400000 + 86400000) % 86400000;
  }

  const station = topology.stations.find((s) => s.id === stationId);
  if (!station) {
    return { notFound: true };
  }

  const { allRoutes, allDeparturesByRouteId } = getMergedRoutesAndDepartures(topology, departuresCache);

  const entries = [];

  for (const route of allRoutes) {
    if (route.hidden) continue;
    const stops = route.stations || [];
    const idx = stops.findIndex((s) => s.id === stationId);
    if (idx === -1) continue;

    const departureInfo = allDeparturesByRouteId.get(route.id);
    if (!departureInfo) continue; // у маршрута сейчас нет активных рейсов

    // t0 = scheduledDepartureTime на последней остановке.
    // scheduledDepartureTime = scheduledArrivalTime + dwellTime последней остановки.
    // Поэтому offset для последней остановки = -dwellTime_last (убираем стоянку).
    // Для остальных: вычитаем dwellTime текущей + duration до следующей и т.д.
    const lastIdx = stops.length - 1;
    // Сначала считаем offset для каждой остановки от начала (0..lastIdx)
    // затем перестраиваем относительно t0:
    // forward[k] = сумма (duration[k-1] + dwellTime[k]) от 0 до k
    // t0 соответствует forward[lastIdx] = полному времени от прибытия на первую до отправления с последней
    let forward = 0;
    const forwardOffsets = [0];
    for (let i = 0; i < lastIdx; i++) {
      forward += (stops[i].dwellTime ?? 0) + (route.durations[i] ?? 0);
      forwardOffsets.push(forward);
    }
    // t0 = forwardOffsets[lastIdx] + dwellTime_last
    const t0Offset = forward + (stops[lastIdx].dwellTime ?? 0);
    // arrivalOffset[idx] = forwardOffsets[idx] - t0Offset (всегда ≤ 0)
    const arrivalOffset = forwardOffsets[idx] - t0Offset;
    const isOrigin = idx === 0;
    const isTerminus = idx === lastIdx;
    const departureOffset = isTerminus
      ? null
      : arrivalOffset + (stops[idx].dwellTime ?? 0);


    const { displayName, shortCode } = splitRouteName(route.name);
    const color = colorToHex(route.color);
    // Если у платформы нет имени — даём ей стабильный, уникальный для
    // этого маршрута ключ, чтобы её рейсы не "слипались" в одну строку
    // с рейсами совершенно других маршрутов без имени платформы.
    const platformName = normalizePlatformName(stops[idx].name, `Платформа (${route.id.slice(0, 4)})`);

    for (const group of departureInfo.departures) {
      for (const t0raw of group.departures) {
        const t0 = departureInfo.isDraftEntry ? t0raw : t0ToUtcMs(t0raw);
        // Для черновиков t0 = время отправления с первой остановки (пользователь задаёт)
        // Для реальных — t0 = время отправления с последней остановки
        const draftShift = departureInfo.isDraftEntry ? t0Offset : 0;
        const arrivalMs = normalizeTimeOfDay(t0 + arrivalOffset + draftShift + group.deviation);
        const departureMs =
          departureOffset === null
            ? null
            : normalizeTimeOfDay(t0 + departureOffset + draftShift + group.deviation);

        entries.push({
          routeId: route.id,
          routeName: displayName,
          routeNumber: route.number || shortCode,
          routeType: route.type,
          color,
          platformName,
          isOrigin,
          isTerminus,
          isDraft: !!route.isDraft,
          // Время стоянки на ЭТОЙ платформе берём напрямую из данных
          // остановки, а не вычисляем из (departureMs - arrivalMs) — для
          // конечной станции departureMs всегда null (дальше маршрут не
          // едет), но физическое время стоянки у неё всё равно задано.
          dwellTimeMs: stops[idx].dwellTime ?? 0,
          deviationMs: group.deviation,
          tripOriginMs: t0,
          arrivalMs,
          arrivalTime: formatTimeOfDay(arrivalMs),
          arrivalTimeShort: formatTimeOfDayShort(arrivalMs),
          departureMs,
          departureTime: departureMs === null ? null : formatTimeOfDay(departureMs),
          departureTimeShort:
            departureMs === null ? null : formatTimeOfDayShort(departureMs),
        });
      }
    }
  }

  entries.sort((a, b) => a.arrivalMs - b.arrivalMs);

  // ── Определяем пары прямой/обратный маршрут ──────────────────────────
  // Если поезд прямого маршрута A приезжает на станцию и через короткое время
  // поезд обратного маршрута B уезжает с той же платформы — это один состав.
  // Прямой маршрут помечаем hiddenByReverse: true, обратный показываем.
  //
  // Условия пары: одинаковое депо + станции B = reverse(A) + платформа совпадает
  // + время отправления A ≈ время прибытия B (в пределах dwellTime конечной).
  // Карта обратных маршрутов — общая кешируемая (см. getReverseRouteMap)
  const reverseRouteMap = getReverseRouteMap(allRoutes, topology.fetchedAt);

  // Находим пары прямой/обратный и скрываем прямой (тот у которого есть departureMs).
  // Обратный (конечная, departureMs === null) показываем — он содержит время прибытия
  // которое актуально для пассажира.
  // Обрабатываем каждую пару только один раз через Set уже обработанных.
  const PAIR_TOLERANCE_MS = 5 * 60 * 1000;
  const pairedEntries = new Set();
  for (const entry of entries) {
    if (pairedEntries.has(entry)) continue;
    const revId = reverseRouteMap.get(entry.routeId);
    if (!revId) continue;
    const depMs = entry.departureMs ?? entry.arrivalMs;
    const partner = entries.find(e =>
      e.routeId === revId &&
      e.platformName === entry.platformName &&
      !pairedEntries.has(e) &&
      Math.abs(e.arrivalMs - depMs) <= PAIR_TOLERANCE_MS
    );
    if (!partner) continue;
    pairedEntries.add(entry);
    pairedEntries.add(partner);
    // Прячем того у кого есть departureMs (ещё едет дальше = прямой на этой станции)
    // Показываем того у кого departureMs === null (конечная = обратный начинается здесь)
    // Скрываем конечную (depMs === null), показываем начальную (depMs !== null)
    const [hide, show] = entry.departureMs === null ? [entry, partner] : [partner, entry];
    hide.hiddenByReverse = true;
    hide.reverseRouteId = show.routeId;
    hide.reverseTripOriginMs = show.tripOriginMs;
    show.pairedForwardRouteId = hide.routeId;
    show.pairedForwardTripOriginMs = hide.tripOriginMs;
  }

  // Список уникальных платформ станции.
  // Если на одной и той же «платформе» (по имени) едут маршруты, которые
  // НИКОГДА не пересекаются по времени (разница всегда > 1 час), считаем,
  // что это физически разные пути с одинаковым номером — разделяем их,
  // добавляя суффикс "/A", "/B" и т.д.
  const rawPlatformSet = Array.from(new Set(entries.map((e) => e.platformName || "—")))
    .sort((a, b) => a.localeCompare(b, "ru", { numeric: true }));

  // Для каждой платформы: если у неё встречаются записи более чем от 2 разных
  // маршрутов — проверяем, не нужно ли разделить.
  const splitMap = new Map(); // originalName -> [subgroupName, ...]
  for (const plat of rawPlatformSet) {
    const platEntries = entries.filter((e) => (e.platformName || "—") === plat);
    const routeIds = Array.from(new Set(platEntries.map((e) => e.routeId)));
    if (routeIds.length <= 2) {
      splitMap.set(plat, [plat]);
      continue;
    }
    // Строим граф "конкуренции": два маршрута в одной группе, если их поезда
    // бывают в пределах 30 минут друг от друга хотя бы раз.
    const groups = [];
    for (const rid of routeIds) {
      const times = platEntries.filter((e) => e.routeId === rid).map((e) => e.arrivalMs);
      let placed = false;
      for (const g of groups) {
        const gTimes = platEntries.filter((e) => g.includes(e.routeId)).map((e) => e.arrivalMs);
        const near = times.some((t) => gTimes.some((gt) => Math.abs(t - gt) < 30 * 60000));
        if (near) { g.push(rid); placed = true; break; }
      }
      if (!placed) groups.push([rid]);
    }
    if (groups.length <= 1) {
      splitMap.set(plat, [plat]);
    } else {
      const SUFFIXES = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
      const subNames = groups.map((_, i) => `${plat}/${SUFFIXES[i]}`);
      splitMap.set(plat, subNames);
      // Переименовываем entries
      groups.forEach((g, i) => {
        for (const e of platEntries) {
          if (g.includes(e.routeId)) e.platformName = subNames[i];
        }
      });
    }
  }
  const platforms = Array.from(new Set(entries.map((e) => e.platformName || "—")))
    .sort((a, b) => a.localeCompare(b, "ru", { numeric: true }));

  return {
    stationId,
    stationName: station.name,
    generatedAt: Date.now(),
    departuresFetchedAt: departuresCache.fetchedAt,
    topologyFetchedAt: topology.fetchedAt,
    platforms,
    entries,
  };
}

function listStations() {
  const topology = store.getTopology();
  if (!topology) return [];
  return topology.stations
    .map((s) => ({ id: s.id, name: s.name, color: colorToHex(s.color) }))
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

/** buildStationSchedule с использованием серверного кеша расписаний. */
function buildStationScheduleCached(stationId) {
  const dep = store.getDepartures();
  const fetchedAt = dep ? dep.fetchedAt : null;
  if (fetchedAt) {
    const cached = store.getScheduleCache(stationId, fetchedAt);
    if (cached) return cached;
  }
  const result = buildStationSchedule(stationId);
  if (result && !result.notFound && fetchedAt) store.setScheduleCache(stationId, result, fetchedAt);
  return result;
}

/**
 * Цепочка оборота для рейса: прямой рейс на конечной становится обратным
 * (время прибытия ≈ времени отправления — пары уже находит
 * buildStationSchedule на каждой конечной), обратный на другой конечной —
 * следующим прямым и т.д. Маршруты типа S19 не заезжают в депо и катаются
 * туда-сюда весь день — их цепочка охватывает все рейсы и может замыкаться
 * в кольцо (обход защищён от циклов). Возвращает { chain: [{routeId,
 * tripOriginMs}], reverseRouteId } — все рейсы, которые должны двигаться
 * вместе при ручном сдвиге любого из них.
 */
function getTurnaroundChain(routeId, tripOriginMs) {
  const topology = store.getTopology();
  const departuresCache = store.getDepartures();
  if (!topology || !departuresCache) return null;

  const route = topology.routes.find((r) => r.id === routeId);
  if (!route) return { notFound: true };

  const { allRoutes } = getMergedRoutesAndDepartures(topology, departuresCache);
  const reverseRouteId = getReverseRouteMap(allRoutes, topology.fetchedAt).get(routeId) || null;
  const self = { routeId, tripOriginMs };
  if (!reverseRouteId) return { chain: [self], reverseRouteId: null };

  // Пары оборота живут в расписаниях ОБЕИХ конечных станций маршрута
  const stops = route.stations || [];
  const termini = [...new Set([stops[0] && stops[0].id, stops[stops.length - 1] && stops[stops.length - 1].id].filter(Boolean))];
  const key = (r, t) => r + ":" + t;
  const next = new Map(); // прибывший рейс → отправляющийся (оборот состава)
  const prev = new Map();
  for (const stId of termini) {
    const sched = buildStationScheduleCached(stId);
    if (!sched || !sched.entries) continue;
    for (const e of sched.entries) {
      if (e.pairedForwardRouteId == null || e.pairedForwardTripOriginMs == null) continue;
      // e — отправляющийся рейс, e.pairedForward* — прибывший состав
      next.set(key(e.pairedForwardRouteId, e.pairedForwardTripOriginMs), { routeId: e.routeId, tripOriginMs: e.tripOriginMs });
      prev.set(key(e.routeId, e.tripOriginMs), { routeId: e.pairedForwardRouteId, tripOriginMs: e.pairedForwardTripOriginMs });
    }
  }

  const seen = new Set([key(routeId, tripOriginMs)]);
  const chain = [self];
  let cur = key(routeId, tripOriginMs);
  while (next.has(cur)) {
    const n = next.get(cur);
    const k = key(n.routeId, n.tripOriginMs);
    if (seen.has(k)) break; // кольцо (S19) — цепочка замкнулась
    seen.add(k);
    chain.push(n);
    cur = k;
  }
  cur = key(routeId, tripOriginMs);
  while (prev.has(cur)) {
    const n = prev.get(cur);
    const k = key(n.routeId, n.tripOriginMs);
    if (seen.has(k)) break;
    seen.add(k);
    chain.unshift(n);
    cur = k;
  }
  return { chain, reverseRouteId };
}

function listRoutes() {
  const topology = store.getTopology();
  if (!topology) return [];
  const revMap = getReverseRouteMap(topology.routes, topology.fetchedAt);
  const real = topology.routes
    .filter((r) => !r.hidden)
    .map((r) => {
      const { displayName, shortCode } = splitRouteName(r.name);
      return {
        id: r.id,
        name: displayName,
        number: r.number || shortCode,
        color: colorToHex(r.color),
        type: r.type,
        stopCount: (r.stations || []).length,
        // Упорядоченный список станций — нужен фронту для построения
        // линейной схемы маршрутов станции (editor) без запроса деталей
        stationIds: (r.stations || []).map((s) => s.id),
        // Обратный маршрут (станции в обратном порядке, тот же цвет) —
        // фронт синхронно сдвигает его при сдвиге всего маршрута
        reverseRouteId: revMap.get(r.id) || null,
        depots: r.depots || [],
        firstStationId: (r.stations || [])[0] ? r.stations[0].id : null,
        lastStationId: (r.stations || []).slice(-1)[0] ? r.stations.slice(-1)[0].id : null,
        terminus: (() => {
          const last = (r.stations || []).slice(-1)[0];
          if (!last) return null;
          const st = topology.stations.find((s) => s.id === last.id);
          return st ? st.name : null;
        })(),
        isDraft: false,
      };
    });
  const draftRows = drafts.list().map((d) => ({
    id: d.id,
    name: d.name,
    number: d.number,
    color: colorToHex(d.color),
    type: d.type,
    stopCount: d.stops.length,
    stationIds: (d.stops || []).map((s) => s.stationId),
    isDraft: true,
  }));
  return [...real, ...draftRows].sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

function getRouteDetail(routeId) {
  const topology = store.getTopology();
  const departuresCache = store.getDepartures();
  if (!topology) return null;

  const { allRoutes, allDeparturesByRouteId } = getMergedRoutesAndDepartures(topology, departuresCache);
  const route = allRoutes.find((r) => r.id === routeId);
  if (!route) return { notFound: true };

  const { displayName, shortCode } = splitRouteName(route.name);
  const stops = (route.stations || []).map((stop, i) => {
    const station = topology.stations.find((s) => s.id === stop.id);
    return {
      stationId: stop.id,
      stationName: station ? station.name : stop.id,
      platformName: normalizePlatformName(stop.name, `#${i + 1}`),
      platformNameRaw: stop.name,
      dwellTimeMs: stop.dwellTime,
      durationToNextMs: route.durations ? route.durations[i] ?? null : null,
      x: stop.x,
      y: stop.y,
      z: stop.z,
    };
  });

  const departureInfo = allDeparturesByRouteId.get(routeId);

  const totalDurationMs = (route.durations || []).reduce((a, b) => a + (b || 0), 0);
  const totalDwellMs = stops.reduce((a, s) => a + (s.dwellTimeMs || 0), 0);

  return {
    id: route.id,
    nameRaw: route.name,
    name: displayName,
    number: route.number || shortCode,
    color: colorToHex(route.color),
    colorRaw: route.color,
    type: route.type,
    circularState: route.circularState,
    hidden: !!route.hidden,
    isDraft: !!route.isDraft,
    // Обратный маршрут (станции в обратном порядке + тот же цвет) — фронт
    // использует для кнопки «Обратный маршрут» вместо клиентского скоринга
    reverseRouteId: getReverseRouteMap(allRoutes, topology.fetchedAt).get(routeId) || null,
    depots: route.depots || [],
    stops,
    durationsMs: route.durations || [],
    totalDurationMs,
    totalDwellMs,
    departureGroups: departureInfo ? departureInfo.departures : [],
    activeTripCount: departureInfo
      ? departureInfo.departures.reduce((sum, g) => sum + g.departures.length, 0)
      : 0,
  };
}

function distance3D(a, b) {
  const dx = (a.x ?? 0) - (b.x ?? 0);
  const dy = (a.y ?? 0) - (b.y ?? 0);
  const dz = (a.z ?? 0) - (b.z ?? 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Строит классический "график движения поездов" (станции по оси Y,
 * время по оси X, наклон линии = скорость) для всех маршрутов,
 * проходящих через обе выбранные граничные станции.
 *
 * Позиция станции по оси Y — это накопленное РЕАЛЬНОЕ расстояние
 * (по координатам x/y/z), а не просто порядковый номер остановки —
 * так наклон линии действительно соответствует скорости поезда.
 */
function buildRouteGraph(fromStationId, toStationId) {
  const topology = store.getTopology();
  const departuresCache = store.getDepartures();
  if (!topology || !departuresCache) return null;
  const _mtrCurG = departuresCache.currentTime || Date.now();
  function t0ToUtcMs(t0) { return ((_mtrCurG + t0) % 86400000 + 86400000) % 86400000; }


  const fromStation = topology.stations.find((s) => s.id === fromStationId);
  const toStation = topology.stations.find((s) => s.id === toStationId);
  if (!fromStation || !toStation) return { notFound: true };

  const { allRoutes, allDeparturesByRouteId } = getMergedRoutesAndDepartures(topology, departuresCache);

  // ВАЖНО: расстояние каждой станции считаем НАПРЯМУЮ от координат
  // станции А (по прямой), а НЕ накоплением расстояний вдоль конкретного
  // маршрута. Раньше для одной и той же физической станции расстояние
  // получалось РАЗНЫМ у разных маршрутов (если они идут к ней разными
  // путями/с разным числом промежуточных остановок) — из-за этого
  // "ступеньки" стоянки у разных линий на одной и той же станции
  // оказывались на разной высоте графика. Теперь расстояние — это
  // свойство САМОЙ СТАНЦИИ относительно А, а не пути конкретного поезда,
  // поэтому одна станция = всегда одна и та же позиция по оси Y.
  const fromCoords = findStationCoords(topology, fromStationId);
  const stationDistanceCache = new Map();
  function canonicalDistance(stationId) {
    if (stationDistanceCache.has(stationId)) return stationDistanceCache.get(stationId);
    const d = distance3D(fromCoords, findStationCoords(topology, stationId));
    stationDistanceCache.set(stationId, d);
    return d;
  }

  const routesOut = [];

  // Шаг 1: собираем validSegments — все маршруты через А и Б с сегментами А→Б
  const validSegments = [];
  for (const route of allRoutes) {
    if (route.hidden) continue;
    const stops = route.stations || [];
    const idxFrom = stops.findIndex(s => s.id === fromStationId);
    const idxTo = stops.findIndex(s => s.id === toStationId);
    if (idxFrom === -1 || idxTo === -1 || idxFrom === idxTo) continue;
    const lo = Math.min(idxFrom, idxTo);
    const hi = Math.max(idxFrom, idxTo);
    const segment = stops.slice(lo, hi + 1);
    const fromIsAtLo = idxFrom === lo;
    const segAtoB = fromIsAtLo ? segment : [...segment].reverse();
    validSegments.push({ route, stops, segment, segAtoB, lo, hi, fromIsAtLo, overlap: "full" });
  }

  // Шаг 2: глобальный порядок станций по маршруту с наибольшим числом станций А→Б
  const stationUnion = new Map(); // stationId → {stationId, name, platformName, distance}
  const longestSeg = validSegments.slice().sort((a, b) => b.segAtoB.length - a.segAtoB.length)[0];
  if (longestSeg) {
    let t = 0;
    longestSeg.segAtoB.forEach((s, i) => {
      const st = topology.stations.find(x => x.id === s.id);
      if (i > 0) {
        const origIdx = longestSeg.fromIsAtLo ? longestSeg.lo + i - 1 : longestSeg.hi - i;
        t += (longestSeg.segAtoB[i-1].dwellTime ?? 0) + (longestSeg.route.durations[origIdx] ?? 60000);
      }
      stationUnion.set(s.id, {
        stationId: s.id,
        name: st ? st.name : s.id,
        platformName: normalizePlatformName(s.name, `#${i+1}`),
        distance: t,
      });
    });
  }

  // Шаг 2.5: маршруты-«соседи», совпадающие с коридором ЧАСТИЧНО — они не
  // проходят через А и/или Б, но едут по каким-то промежуточным станциям
  // коридора (например коридор A-B-C-D и маршрут, идущий только B→C).
  // Берём их кусок от первой до последней станции, лежащей на коридоре.
  // Требуем ≥2 общих станции: одна общая — это просто пересадка, а не
  // совместный участок пути.
  if (stationUnion.size) {
    const corridorIds = new Set(stationUnion.keys());
    const usedRouteIds = new Set(validSegments.map(v => v.route.id));
    for (const route of allRoutes) {
      if (route.hidden || usedRouteIds.has(route.id)) continue;
      const stops = route.stations || [];
      const onCorridor = [];
      stops.forEach((s, i) => { if (corridorIds.has(s.id)) onCorridor.push(i); });
      if (onCorridor.length < 2) continue;
      const lo = onCorridor[0];
      const hi = onCorridor[onCorridor.length - 1];
      if (lo === hi) continue;
      const segment = stops.slice(lo, hi + 1);
      // Направление вдоль коридора: если расстояние (ось Y) растёт от lo к hi —
      // маршрут едет в ту же сторону, что А→Б.
      const dLo = stationUnion.get(stops[lo].id).distance;
      const dHi = stationUnion.get(stops[hi].id).distance;
      const fromIsAtLo = dLo <= dHi;
      const segAtoB = fromIsAtLo ? segment : [...segment].reverse();
      validSegments.push({ route, stops, segment, segAtoB, lo, hi, fromIsAtLo, overlap: "partial" });
    }
  }

  // Шаг 3: добавляем пропущенные станции из других маршрутов — вставляем между соседями.
  // ТОЛЬКО из полных маршрутов (через А и Б): ось Y — это станции коридора.
  // Свои станции маршрутов-соседей на ось не добавляем, иначе график зарастает
  // чужими остановками; линия соседа рисуется сразу до следующей ОБЩЕЙ станции
  // (точки вне коридора отбрасываются в шаге 4).
  for (const { segAtoB, overlap } of validSegments) {
    if (overlap === "partial") continue;
    for (let i = 0; i < segAtoB.length; i++) {
      const s = segAtoB[i];
      if (stationUnion.has(s.id)) continue;
      const prevKnown = segAtoB.slice(0, i).reverse().find(x => stationUnion.has(x.id));
      const nextKnown = segAtoB.slice(i + 1).find(x => stationUnion.has(x.id));
      const prevDist = prevKnown ? stationUnion.get(prevKnown.id).distance : 0;
      const nextDist = nextKnown ? stationUnion.get(nextKnown.id).distance : (prevDist + 60000);
      const prevIdx = prevKnown ? segAtoB.findIndex(x => x.id === prevKnown.id) : -1;
      const nextIdx = nextKnown ? segAtoB.findIndex(x => x.id === nextKnown.id) : segAtoB.length;
      const span = nextIdx - prevIdx;
      const frac = span > 1 ? (i - prevIdx) / span : 0.5;
      const st = topology.stations.find(x => x.id === s.id);
      stationUnion.set(s.id, {
        stationId: s.id,
        name: st ? st.name : s.id,
        platformName: normalizePlatformName(s.name, `#${i+1}`),
        distance: prevDist + (nextDist - prevDist) * frac,
      });
    }
  }

  // Шаг 4: основной цикл — строим trips для каждого маршрута
  for (const { route, stops, segment, segAtoB, lo, hi, fromIsAtLo, overlap } of validSegments) {
    const totalSegmentDistance = stationUnion.get(toStationId)?.distance || 1;

    const departureInfo = allDeparturesByRouteId.get(route.id);
    // Раньше при отсутствии активных рейсов маршрут полностью пропускался,
    // из-за чего длинные/редкие линии без поезда "прямо сейчас" в кадре
    // выглядели так, будто их вообще не существует. Теперь такой маршрут
    // всё равно попадает в список (с пустым tripCount), а решение
    // показывать ли его в легенде/на графике — за фронтендом.
    const trips = [];
    // t0 = scheduledDepartureTime на последней остановке = arrival_last + dwellTime_last
    let _fwd2 = 0;
    const _fwdArr2 = [0];
    for (let i = 0; i < stops.length - 1; i++) {
      _fwd2 += (stops[i].dwellTime ?? 0) + (route.durations[i] ?? 0);
      _fwdArr2.push(_fwd2);
    }
    const _t0Off2 = _fwd2 + (stops[stops.length - 1].dwellTime ?? 0);
    let baseArrivalOffset = _fwdArr2[lo] - _t0Off2;

    // Смещения прибытия/отправления для каждой станции сегмента,
    // считая по индексам маршрута lo -> hi (так считаются durations/dwell).
    const arrivalOffsets = [];
    const departureOffsets = [];
    let running = baseArrivalOffset;
    for (let k = 0; k < segment.length; k++) {
      arrivalOffsets.push(running);
      const globalIdx = lo + k;
      const isLastOfRoute = globalIdx === stops.length - 1;
      const isLastOfSegment = k === segment.length - 1;
      const dep = isLastOfRoute ? null : running + (segment[k].dwellTime ?? 0);
      // ВАЖНО: "ступенька" стоянки (departureOffset) должна быть видна на
      // ПОСЛЕДНЕЙ станции графика тоже, даже если физически маршрут едет
      // дальше за пределы выбранного сегмента А-Б — раньше она тут
      // принудительно обнулялась (isLastOfSegment ? null : dep), из-за
      // чего на графике пропадала стоянка именно на граничной станции.
      departureOffsets.push(dep);
      if (!isLastOfSegment) {
        running = dep + (route.durations[globalIdx] ?? 0);
      }
    }

    const { displayName, shortCode } = splitRouteName(route.name);
    const color = colorToHex(route.color);
    // "forward" — маршрут едет от А к Б в хронологическом порядке (т.е.
    // в его собственном массиве остановок индекс А меньше индекса Б).
    // "backward" — едет от Б к А (это и есть "обратный" рейс).
    const direction = fromIsAtLo ? "forward" : "backward";

    if (departureInfo) {
      for (const group of departureInfo.departures) {
        for (const t0raw of group.departures) {
          const t0 = departureInfo.isDraftEntry ? t0raw : t0ToUtcMs(t0raw);
          // Строим points в порядке движения поезда (первая остановка → последняя).
          // Для FORWARD (fromIsAtLo=true): поезд идёт segment[0]→segment[last]
          //   - arrivalOffsets[k] уже в правильном порядке (возрастает)
          //   - дистанция segment[k] тоже возрастает → линия top→bottom ✓
          // Для BACKWARD (fromIsAtLo=false): поезд идёт segment[last]→segment[0]
          //   - нужно: k=0 = segment[last] (большая дистанция, раннее время)
          //             k=last = segment[0] (малая дистанция, позднее время)
          //   - arrivalOffsets[k] идут в порядке lo→hi (A→B), т.е. reversed в
          //     порядке движения: arrivalOffsets[last] = время прибытия в segment[last]
          //   - поэтому для backward мы переворачиваем оба: offsets И sIdx
          // Строим points в порядке движения поезда.
          // stationUnion.distance всегда в порядке А→Б.
          // arrivalOffsets[k] = offset для segment[lo+k] (порядок lo→hi).
          // Для forward: segment идёт от А(lo) к Б(hi) — порядок совпадает.
          // Для backward: segment идёт от Б(lo) к А(hi), движение А(hi)→Б(lo).
          //   sIdx = hi - k → убывает от hi до lo по мере движения поезда.
          const rawPoints = [];
          for (let k = 0; k < segment.length; k++) {
            const sIdx = fromIsAtLo ? k : segment.length - 1 - k;
            const st = segment[sIdx];
            // Маршрут-сосед: рисуем только по ОБЩИМ с коридором станциям —
            // его собственных остановок на оси Y нет, линия идёт сразу к
            // следующей совпадающей станции.
            if (overlap === "partial" && !stationUnion.has(st.id)) continue;
            const dist = stationUnion.get(st.id)?.distance ?? 0;
            const _draftShift2 = departureInfo.isDraftEntry ? _t0Off2 : 0;
            const arrivalMs = t0 + arrivalOffsets[sIdx] + _draftShift2 + group.deviation;
            const dep = departureOffsets[sIdx];
            const departureMs = dep === null ? null : t0 + dep + _draftShift2 + group.deviation;
            // stationId/platformName нужны фронту для соединителей оборота
            // и маркеров конфликтов прямо на графике движения
            rawPoints.push({
              distance: dist, arrivalMs, departureMs,
              stationId: st.id,
              platformName: normalizePlatformName(st.name, `#${sIdx + 1}`),
            });
          }
          // У соседа после отбрасывания «чужих» станций может остаться <2
          // точек — рисовать нечего
          if (rawPoints.length < 2) continue;
          // Сортируем по времени чтобы линия шла слева→направо
          rawPoints.sort((a, b) => a.arrivalMs - b.arrivalMs);
          const points = rawPoints;
          trips.push({
            deviationMs: group.deviation,
            // T0 (момент отправления с самого начала маршрута) — пригодится
            // как стабильный идентификатор рейса для drag-редактирования.
            tripOriginMs: t0,
            points,
          });
        }
      }
    }

    routesOut.push({
      routeId: route.id,
      routeName: displayName,
      routeNumber: route.number || shortCode,
      color,
      direction,
      // "full" — маршрут идёт через обе выбранные станции; "partial" — только
      // по части коридора (маршрут-сосед на промежуточном участке)
      overlap: overlap || "full",
      type: route.type, // для фильтра типов поездов на графике
      isDraft: !!route.isDraft,
      hasActiveService: !!departureInfo,
      // Для соединителей оборота прямой↔обратный на графике движения
      reverseRouteId: getReverseRouteMap(allRoutes, topology.fetchedAt).get(route.id) || null,
      totalDistance: totalSegmentDistance, // в мс времени пути
      tripCount: trips.length,
      trips,
    });
  }

  const sortedStationLabels = Array.from(stationUnion.values()).sort((a, b) => a.distance - b.distance);

  return {
    fromStationId,
    fromStationName: fromStation.name,
    toStationId,
    toStationName: toStation.name,
    stations: sortedStationLabels,
    routes: routesOut,
  };
}

/**
 * Полное расписание ОДНОГО маршрута: время на КАЖДОЙ его станции для
 * КАЖДОГО рейса дня (для "карточки поезда"), плюс отдельный список
 * "отправлений из депо" — это исходные T0 (отправления с самого начала
 * маршрута), которые отдаёт MTR API.
 */
function buildRouteTimetable(routeId) {
  const topology = store.getTopology();
  const departuresCache = store.getDepartures();
  const _mtrCurT = departuresCache?.currentTime || Date.now();
  function t0ToUtcMs(t0) { return ((_mtrCurT + t0) % 86400000 + 86400000) % 86400000; }

  if (!topology) return null;

  const { allRoutes, allDeparturesByRouteId } = getMergedRoutesAndDepartures(topology, departuresCache);
  const route = allRoutes.find((r) => r.id === routeId);
  if (!route) return { notFound: true };

  const stops = route.stations || [];
  const departureInfo = allDeparturesByRouteId.get(routeId);

  // t0 = scheduledDepartureTime на последней остановке = arrival_last + dwellTime_last
  const arrivalOffsets = [];
  const departureOffsets = [];
  let _fwdT = 0;
  const _fwdArrT = [0];
  for (let k = 0; k < stops.length - 1; k++) {
    _fwdT += (stops[k].dwellTime ?? 0) + (route.durations[k] ?? 0);
    _fwdArrT.push(_fwdT);
  }
  const _t0OffT = _fwdT + (stops[stops.length - 1].dwellTime ?? 0);
  for (let k = 0; k < stops.length; k++) {
    const arr = _fwdArrT[k] - _t0OffT;
    arrivalOffsets.push(arr);
    const isLast = k === stops.length - 1;
    departureOffsets.push(isLast ? null : arr + (stops[k].dwellTime ?? 0));
  }

  const stationsOut = stops.map((s, i) => {
    const st = topology.stations.find((x) => x.id === s.id);
    return {
      stationId: s.id,
      stationName: st ? st.name : s.id,
      platformName: normalizePlatformName(s.name, `#${i + 1}`),
    };
  });

  const trips = [];
  const depotDepartures = [];
  if (departureInfo) {
    for (const group of departureInfo.departures) {
      for (const t0raw of group.departures) {
        const t0 = departureInfo.isDraftEntry ? t0raw : t0ToUtcMs(t0raw);
        const _draftShiftT = departureInfo.isDraftEntry ? _t0OffT : 0;
        const times = stops.map((s, k) => {
          const arrivalMs = normalizeTimeOfDay(t0 + arrivalOffsets[k] + _draftShiftT + group.deviation);
          const departureMs =
            departureOffsets[k] === null ? null : normalizeTimeOfDay(t0 + departureOffsets[k] + _draftShiftT + group.deviation);
          return { arrivalMs, departureMs };
        });
        trips.push({ tripOriginMs: t0, originalDepartureMs: t0raw, deviationMs: group.deviation, times });
        depotDepartures.push({
          tripOriginMs: t0,
          originalDepartureMs: t0raw,
          deviationMs: group.deviation,
          scheduledTimeOfDayMs: t0,
          effectiveTimeOfDayMs: normalizeTimeOfDay(t0 + group.deviation),
        });
      }
    }
  }
  trips.sort((a, b) => a.tripOriginMs - b.tripOriginMs);
  depotDepartures.sort((a, b) => a.tripOriginMs - b.tripOriginMs);

  const { displayName, shortCode } = splitRouteName(route.name);

  return {
    id: route.id,
    name: displayName,
    number: route.number || shortCode,
    isDraft: !!route.isDraft,
    depots: route.depots || [],
    stations: stationsOut,
    depotDepartures,
    trips,
  };
}

/**
 * Собирает выборку "скоростей" (блоков в мс) по перегонам реальных
 * маршрутов заданного типа — используется для автоподбора времени
 * перегона у пробных маршрутов. Если маршрутов нужного типа мало,
 * можно передать type=null, чтобы взять выборку по ВСЕМ типам.
 */
function collectSpeedSamples(topology, type) {
  const speeds = [];
  for (const route of topology.routes) {
    if (route.hidden) continue;
    if (type && route.type !== type) continue;
    const stops = route.stations || [];
    const durations = route.durations || [];
    for (let i = 0; i < durations.length && i + 1 < stops.length; i++) {
      const d = durations[i];
      if (!d || d <= 0) continue;
      const dist = distance3D(stops[i], stops[i + 1]);
      if (dist <= 0) continue;
      speeds.push(dist / d); // блоков в мс
    }
  }
  return speeds;
}

/** Среднее время стоянки на конкретной станции у реальных маршрутов (по возможности — нужного типа). */
function averageDwellAtStation(topology, stationId, type) {
  function avgFor(filterType) {
    let sum = 0, count = 0;
    for (const route of topology.routes) {
      if (route.hidden) continue;
      if (filterType && route.type !== filterType) continue;
      for (const s of route.stations || []) {
        if (s.id === stationId && s.dwellTime) {
          sum += s.dwellTime;
          count++;
        }
      }
    }
    return count > 0 ? Math.round(sum / count) : null;
  }
  return avgFor(type) ?? avgFor(null) ?? 30000;
}

/** Список реально встречающихся названий платформ на станции (для выпадающего списка в форме пробного маршрута). */
function platformOptionsAtStation(topology, stationId) {
  const counts = new Map();
  for (const route of topology.routes) {
    for (const s of route.stations || []) {
      if (s.id !== stationId) continue;
      const name = normalizePlatformName(s.name, null);
      if (!name) continue;
      counts.set(name, (counts.get(name) || 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);
}

/**
 * Автоподбор параметров для формы создания пробного маршрута: время
 * перегона от fromStationId до toStationId (на основе скорости поездов
 * похожего типа на похожих перегонах) и время стоянки/список реальных
 * платформ на toStationId.
 */
function suggestDraftLeg({ type, fromStationId, toStationId }) {
  const topology = store.getTopology();
  if (!topology) return null;

  const toCoords = findStationCoords(topology, toStationId);
  const result = {
    toDwellMs: averageDwellAtStation(topology, toStationId, type),
    platformOptions: platformOptionsAtStation(topology, toStationId),
    durationMs: null,
    distance: null,
  };

  if (fromStationId) {
    const fromCoords = findStationCoords(topology, fromStationId);
    const dist = distance3D(fromCoords, toCoords);
    let speeds = collectSpeedSamples(topology, type);
    if (speeds.length < 5) speeds = collectSpeedSamples(topology, null); // мало данных по этому типу — берём по всем
    const avgSpeed = speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : null;
    result.distance = dist;
    result.durationMs = avgSpeed ? Math.max(5000, Math.round(dist / avgSpeed)) : 60000;
    result.sampleCount = speeds.length;
  }

  return result;
}

module.exports = {
  buildStationSchedule,
  listStations,
  listRoutes,
  getRouteDetail,
  buildRouteGraph,
  buildRouteTimetable,
  suggestDraftLeg,
  getTurnaroundChain,
};

/**
 * Возвращает Set<tripOriginMs> для рейсов данного маршрута, у которых
 * обнаружен конфликт платформы хотя бы на одной из станций маршрута.
 * Конфликт = два поезда на одной платформе одной станции с разницей < minIntervalMs.
 */
function getRouteConflictedTrips(routeId, minIntervalMs) {
  const timetable = buildRouteTimetable(routeId);
  if (!timetable || !timetable.trips.length) return [];
  const interval = minIntervalMs || 3 * 60000;
  // Возвращаем пары {tripOriginMs, stationId} для точного указания конфликтных ячеек
  const conflicted = new Map(); // "tripOriginMs:stationId" -> {tripOriginMs, stationId, conflictingRoutes}

  for (const station of timetable.stations) {
    const sched = buildStationSchedule(station.stationId);
    if (!sched || !sched.entries.length) continue;

    const mine = sched.entries.filter((e) => e.routeId === routeId);
    const others = sched.entries.filter((e) => e.routeId !== routeId);

    for (const me of mine) {
      for (const other of others) {
        if (me.platformName !== other.platformName) continue;
        // Платформа me занята от me.effArrival до me.curEnd (с учётом стоянки)
        const meDwellEnd = me.effArrival + (me.dwellTimeMs || 0);
        const meCurEnd = Math.max(me.effDeparture ?? me.effArrival, meDwellEnd);
        // Конфликт = физическое перекрытие (other приезжает пока me стоит)
        // ИЛИ слишком маленький интервал между освобождением и прибытием
        const isOverlap = other.effArrival < meCurEnd || me.effArrival < (other.effDeparture ?? other.effArrival + (other.dwellTimeMs || 0));
        const isTooClose = Math.abs(me.effArrival - other.effArrival) < interval;
        if (isOverlap || isTooClose) {
          const key = `${me.tripOriginMs}:${station.stationId}`;
          if (!conflicted.has(key)) {
            conflicted.set(key, {
              tripOriginMs: me.tripOriginMs,
              stationId: station.stationId,
              conflictingRoutes: [],
            });
          }
          conflicted.get(key).conflictingRoutes.push({
            routeId: other.routeId,
            routeName: other.routeName,
            routeNumber: other.routeNumber,
          });
        }
      }
    }
  }
  return Array.from(conflicted.values());
}

module.exports = {
  ...module.exports,
  getRouteConflictedTrips,
};

/**
 * Порядок обхода станций сети для поиска конфликтов: ВСЕ станции сети,
 * но «занятые» (по числу проходящих маршрутов) идут первыми — там конфликты
 * вероятнее, и при чанковом сканировании они находятся раньше.
 * Порядок детерминирован в пределах одной топологии, поэтому чанки по
 * offset/limit стабильны между запросами.
 */
function conflictCandidateIds() {
  const topology = store.getTopology();
  if (!topology) return [];
  const routeCount = new Map();
  for (const route of topology.routes) {
    for (const s of route.stations || []) {
      routeCount.set(s.id, (routeCount.get(s.id) || 0) + 1);
    }
  }
  return topology.stations
    .map((s) => s.id)
    .sort((a, b) => (routeCount.get(b) || 0) - (routeCount.get(a) || 0));
}

/**
 * Проверяет одну станцию на конфликты платформ. Возвращает
 * { stationId, stationName, conflictCount, routeIds } либо null.
 * Планируем по arrivalMs/departureMs (реальное расписание сервера);
 * ручные правки пользователя существуют только на клиенте и здесь не видны.
 */
function stationConflictInfo(stationId, intervalMs) {
  const sched = buildStationSchedule(stationId);
  if (!sched || !sched.entries || !sched.entries.length) return null;

  const byPlatform = new Map();
  for (const e of sched.entries) {
    if (e.hiddenByReverse) continue; // оборотную половину пары не считаем
    const pk = e.platformName || "—";
    if (!byPlatform.has(pk)) byPlatform.set(pk, []);
    byPlatform.get(pk).push(e);
  }

  const conflictRouteIds = new Set();
  // Считаем ЧИСЛО КОНФЛИКТНЫХ РЕЙСОВ (блоков), а не число задействованных
  // маршрутов — так же, как клиент на вкладке станции (conflictKeys.size).
  // Иначе при «слипании» рейсов одного маршрута сервер схлопывал бы счётчик
  // до 1, и на «Проблемных местах» показывалось неверное число, которое
  // «исправлялось» только после открытия самой станции.
  const conflictEntries = new Set();
  for (const list of byPlatform.values()) {
    const sorted = list.slice().sort((a, b) => a.arrivalMs - b.arrivalMs);
    for (let i = 0; i < sorted.length - 1; i++) {
      const cur = sorted[i], nxt = sorted[i + 1];
      const isTurn = (cur.isTerminus && nxt.isOrigin) || (nxt.isTerminus && cur.isOrigin);
      if (isTurn) continue;
      const dwellEnd = cur.arrivalMs + (cur.dwellTimeMs || 0);
      const curEnd = Math.max(cur.departureMs ?? cur.arrivalMs, dwellEnd);
      const isPhysicalOverlap = nxt.arrivalMs < curEnd;
      const isTooClose = nxt.arrivalMs < curEnd + intervalMs;
      if (isPhysicalOverlap || isTooClose) {
        conflictEntries.add(cur);
        conflictEntries.add(nxt);
        conflictRouteIds.add(cur.routeId);
        conflictRouteIds.add(nxt.routeId);
      }
    }
  }
  if (!conflictEntries.size) return null;
  return {
    stationId,
    stationName: sched.stationName,
    conflictCount: conflictEntries.size,
    routeIds: Array.from(conflictRouteIds),
  };
}

/** Сканирует заданный список станций (чанк) и возвращает конфликтные. */
function scanStationsForConflicts(stationIds, minIntervalMs) {
  const interval = minIntervalMs || 3 * 60000;
  const result = [];
  for (const stationId of stationIds || []) {
    const info = stationConflictInfo(stationId, interval);
    if (info) result.push(info);
  }
  return result;
}

/** Полный обход всей сети (для обратной совместимости/фоновых уведомлений). */
function getAllConflictingStations(minIntervalMs) {
  return scanStationsForConflicts(conflictCandidateIds(), minIntervalMs)
    .sort((a, b) => b.conflictCount - a.conflictCount);
}

/**
 * Маршруты, которые ПРЯМО СЕЙЧАС опаздывают больше порога. deviation берём
 * из свежих отправлений (departures cache), название/номер — из топологии.
 */
function getLiveDelays(minDeviationMs) {
  const topology = store.getTopology();
  const departuresCache = store.getDepartures();
  if (!topology || !departuresCache) return [];
  const threshold = minDeviationMs || 3 * 60000;
  const routeById = new Map(topology.routes.map((r) => [r.id, r]));
  const out = [];
  for (const entry of departuresCache.departures || []) {
    let maxDev = -Infinity;
    for (const g of entry.departures || []) {
      if (typeof g.deviation === "number" && g.deviation > maxDev) maxDev = g.deviation;
    }
    if (!Number.isFinite(maxDev) || maxDev < threshold) continue;
    const route = routeById.get(entry.id);
    if (!route || route.hidden) continue;
    const { displayName, shortCode } = splitRouteName(route.name);
    out.push({
      routeId: entry.id,
      routeName: displayName,
      routeNumber: route.number || shortCode,
      maxDeviationMs: maxDev,
    });
  }
  return out.sort((a, b) => b.maxDeviationMs - a.maxDeviationMs);
}

module.exports = {
  ...module.exports,
  getAllConflictingStations,
  conflictCandidateIds,
  scanStationsForConflicts,
  getLiveDelays,
};
