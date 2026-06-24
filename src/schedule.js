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
  return { id: draft.id, departures: [{ deviation: 0, departures: expandDraftDepartureTimes(draft) }] };
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

    // Считаем смещение (в мс) от момента отправления с первой станции
    // маршрута до прибытия на нужную станцию.
    let arrivalOffset = 0;
    for (let i = 1; i <= idx; i++) {
      arrivalOffset += route.durations[i - 1] ?? 0;
      if (i < idx) {
        arrivalOffset += stops[i].dwellTime ?? 0;
      }
    }
    const isOrigin = idx === 0;
    const isTerminus = idx === stops.length - 1;
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
      for (const t0 of group.departures) {
        const arrivalMs = normalizeTimeOfDay(t0 + arrivalOffset + group.deviation);
        const departureMs =
          departureOffset === null
            ? null
            : normalizeTimeOfDay(t0 + departureOffset + group.deviation);

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

function listRoutes() {
  const topology = store.getTopology();
  if (!topology) return [];
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
  // Раньше ось Y строилась только по станциям САМОГО ДЛИННОГО маршрута —
  // если другой, более короткий маршрут проходил через станцию, которой
  // не было в "лучшем" списке, её гридлайн/подпись просто не появлялись,
  // и "ступенька" стоянки повисала в воздухе без своей линии станции.
  // Теперь собираем ОБЪЕДИНЕНИЕ станций со ВСЕХ подходящих маршрутов —
  // расстояние у каждой станции теперь единое (canonicalDistance), так
  // что объединять их корректно и просто.
  const stationUnion = new Map(); // stationId -> {stationId, name, platformName, distance}

  for (const route of allRoutes) {
    if (route.hidden) continue;
    const stops = route.stations || [];
    const idxFrom = stops.findIndex((s) => s.id === fromStationId);
    const idxTo = stops.findIndex((s) => s.id === toStationId);
    if (idxFrom === -1 || idxTo === -1 || idxFrom === idxTo) continue;

    const lo = Math.min(idxFrom, idxTo);
    const hi = Math.max(idxFrom, idxTo);
    const segment = stops.slice(lo, hi + 1);
    const fromIsAtLo = idxFrom === lo;


    // Дистанция на оси Y = 3D-расстояние от fromStation (canonicalDistance).
    // ВАЖНО: это единственный консистентный источник — если разные маршруты
    // обработают одну станцию в разном порядке своих сегментов, index-based
    // подход даст ей разные дистанции у разных маршрутов → зигзаги на графике.
    // canonicalDistance даёт одно и то же число для любой станции независимо
    // от того, какой маршрут добавил её в stationUnion первым.
    const distanceFromAnchor = segment.map((s) => canonicalDistance(s.id));
    const totalSegmentDistance = canonicalDistance(toStationId) || 1;

    segment.forEach((s, i) => {
      if (stationUnion.has(s.id)) return;
      const st = topology.stations.find((x) => x.id === s.id);
      stationUnion.set(s.id, {
        stationId: s.id,
        name: st ? st.name : s.id,
        platformName: normalizePlatformName(s.name, `#${i + 1}`),
        distance: distanceFromAnchor[i], // = canonicalDistance(s.id)
      });
    });

    const departureInfo = allDeparturesByRouteId.get(route.id);
    // Раньше при отсутствии активных рейсов маршрут полностью пропускался,
    // из-за чего длинные/редкие линии без поезда "прямо сейчас" в кадре
    // выглядели так, будто их вообще не существует. Теперь такой маршрут
    // всё равно попадает в список (с пустым tripCount), а решение
    // показывать ли его в легенде/на графике — за фронтендом.
    const trips = [];
    let baseArrivalOffset = 0;
    for (let i = 1; i <= lo; i++) {
      baseArrivalOffset += route.durations[i - 1] ?? 0;
      if (i < lo) baseArrivalOffset += stops[i].dwellTime ?? 0;
    }

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
        for (const t0 of group.departures) {
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
          const rawPoints = segment.map((s, k) => {
            let dist, arrivalMs, departureMs;
            if (fromIsAtLo) {
              // Прямой: k=0 начало, k=last конец
              dist = stationUnion.get(segment[k].id)?.distance ?? distanceFromAnchor[k];
              arrivalMs = t0 + arrivalOffsets[k] + group.deviation;
              departureMs = departureOffsets[k] === null ? null : t0 + departureOffsets[k] + group.deviation;
            } else {
              // Обратный: k=0 соответствует segment[last] (конец segment = начало движения)
              const sIdx = segment.length - 1 - k;
              dist = stationUnion.get(segment[sIdx].id)?.distance ?? distanceFromAnchor[sIdx];
              // Поезд прибывает в segment[sIdx] через arrivalOffsets[sIdx]
              // (offsets считаются в порядке lo→hi, sIdx = убывает при k=0..last)
              arrivalMs = t0 + arrivalOffsets[sIdx] + group.deviation;
              departureMs = departureOffsets[sIdx] === null ? null : t0 + departureOffsets[sIdx] + group.deviation;
            }
            return { distance: dist, arrivalMs, departureMs };
          });
          // Для обратного маршрута: отсортируем по времени (arrivalMs) чтобы
          // линия на графике шла слева направо (время всегда возрастает по X)
          if (!fromIsAtLo) rawPoints.sort((a, b) => a.arrivalMs - b.arrivalMs);
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
      isDraft: !!route.isDraft,
      hasActiveService: !!departureInfo,
      totalDistance: totalSegmentDistance,
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
  if (!topology) return null;

  const { allRoutes, allDeparturesByRouteId } = getMergedRoutesAndDepartures(topology, departuresCache);
  const route = allRoutes.find((r) => r.id === routeId);
  if (!route) return { notFound: true };

  const stops = route.stations || [];
  const departureInfo = allDeparturesByRouteId.get(routeId);

  const arrivalOffsets = [];
  const departureOffsets = [];
  let running = 0;
  for (let k = 0; k < stops.length; k++) {
    arrivalOffsets.push(running);
    const isLast = k === stops.length - 1;
    const dep = isLast ? null : running + (stops[k].dwellTime ?? 0);
    departureOffsets.push(dep);
    if (!isLast) running = dep + (route.durations[k] ?? 0);
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
      for (const t0 of group.departures) {
        const times = stops.map((s, k) => {
          const arrivalMs = normalizeTimeOfDay(t0 + arrivalOffsets[k] + group.deviation);
          const departureMs =
            departureOffsets[k] === null ? null : normalizeTimeOfDay(t0 + departureOffsets[k] + group.deviation);
          return { arrivalMs, departureMs };
        });
        trips.push({ tripOriginMs: t0, deviationMs: group.deviation, times });
        depotDepartures.push({
          tripOriginMs: t0,
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
 * Сканирует все станции сети и возвращает те, на которых есть конфликты платформ.
 * Ограничиваем обход: только станции с 2+ маршрутами (исключаем незначительные).
 */
function getAllConflictingStations(minIntervalMs) {
  const topology = store.getTopology();
  if (!topology) return [];
  const interval = minIntervalMs || 3 * 60000;

  // Строим карту: stationId → количество маршрутов
  const stationRouteCount = new Map();
  for (const route of topology.routes) {
    for (const s of route.stations || []) {
      stationRouteCount.set(s.id, (stationRouteCount.get(s.id) || 0) + 1);
    }
  }

  // Берём только 100 самых "занятых" станций (с наибольшим числом маршрутов)
  // чтобы не сканировать весь граф за один запрос
  const candidates = Array.from(stationRouteCount.entries())
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 120)
    .map(([id]) => id);

  const result = [];
  for (const stationId of candidates) {
    const sched = buildStationSchedule(stationId);
    if (!sched || !sched.entries.length) continue;
    const byPlatform = new Map();
    for (const e of sched.entries) {
      const pk = e.platformName || "—";
      if (!byPlatform.has(pk)) byPlatform.set(pk, []);
      byPlatform.get(pk).push(e);
    }
    let hasConflict = false;
    const conflictRouteIds = new Set();
    for (const list of byPlatform.values()) {
      const sorted = list.slice().sort((a, b) => a.effArrival - b.effArrival);
      for (let i = 0; i < sorted.length - 1; i++) {
        const cur = sorted[i], nxt = sorted[i + 1];
        const isTurn = (cur.isTerminus && nxt.isOrigin) || (nxt.isTerminus && cur.isOrigin);
        if (isTurn) continue;
        const dwellEnd = cur.effArrival + (cur.dwellTimeMs || 0);
        const curEnd = Math.max(cur.effDeparture ?? cur.effArrival, dwellEnd);
        const isPhysicalOverlap = nxt.effArrival < curEnd;
        const isTooClose = nxt.effArrival < curEnd + interval;
        if (isPhysicalOverlap || isTooClose) {
          hasConflict = true;
          conflictRouteIds.add(cur.routeId);
          conflictRouteIds.add(nxt.routeId);
        }
      }
    }
    if (hasConflict) {
      result.push({
        stationId,
        stationName: sched.stationName,
        conflictCount: conflictRouteIds.size,
        routeIds: Array.from(conflictRouteIds),
      });
    }
  }
  return result.sort((a, b) => b.conflictCount - a.conflictCount);
}

module.exports = {
  ...module.exports,
  getAllConflictingStations,
};
