const express = require("express");
const path = require("path");
const fs = require("fs");
const config = require("./config");
const poller = require("./src/poller");
const store = require("./src/store");
const schedule = require("./src/schedule");
const analytics = require("./src/analytics");
const drafts = require("./src/drafts");
const { listStations, listRoutes, getRouteDetail, buildStationSchedule } = schedule;

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public"), { etag: false, lastModified: false, cacheControl: false, setHeaders: (res) => { res.setHeader("Cache-Control", "no-store"); } }));

// ---- API ----

app.get("/api/status", (req, res) => {
  res.json(store.getStatus());
});

app.get("/api/stations", (req, res) => {
  res.json(listStations());
});

app.get("/api/stations/:id/schedule", (req, res) => {
  const dep = store.getDepartures();
  const fetchedAt = dep ? dep.fetchedAt : null;
  const cached = store.getScheduleCache(req.params.id, fetchedAt);
  if (cached) return res.json(cached);
  const result = buildStationSchedule(req.params.id);
  if (!result) return res.status(503).json({ error: "Данные ещё не получены от сервера MTR, подождите немного." });
  if (result.notFound) return res.status(404).json({ error: "Станция с таким id не найдена." });
  if (fetchedAt) store.setScheduleCache(req.params.id, result, fetchedAt);
  res.json(result);
});

app.get("/api/routes", (req, res) => {
  res.json(listRoutes());
});

app.get("/api/routes/:id", (req, res) => {
  const dep = store.getDepartures();
  const fetchedAt = dep ? dep.fetchedAt : null;
  const cached = store.getRouteCache(req.params.id, fetchedAt);
  if (cached) return res.json(cached);
  const result = getRouteDetail(req.params.id);
  if (!result) return res.status(503).json({ error: "Данные ещё не получены от сервера MTR, подождите немного." });
  if (result.notFound) return res.status(404).json({ error: "Маршрут с таким id не найден." });
  if (fetchedAt) store.setRouteCache(req.params.id, result, fetchedAt);
  res.json(result);
});

let _allConflictsCache = null;
let _allConflictsCacheAt = 0;
app.get("/api/analytics/all-conflicts", (req, res) => {
  const minMs = (Number(req.query.minIntervalMin) || 3) * 60000;
  const now = Date.now();
  if (_allConflictsCache && now - _allConflictsCacheAt < 60000) {
    return res.json(_allConflictsCache);
  }
  try {
    const stations = schedule.getAllConflictingStations(minMs);
    _allConflictsCache = stations;
    _allConflictsCacheAt = now;
    res.json(stations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/routes/:id/conflicts", (req, res) => {
  const minMs = (Number(req.query.minIntervalMin) || 3) * 60000;
  try {
    const pairs = schedule.getRouteConflictedTrips(req.params.id, minMs);
    res.json({ conflictPairs: pairs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/routes/:id/timetable", (req, res) => {
  const result = schedule.buildRouteTimetable(req.params.id);
  if (!result) {
    return res
      .status(503)
      .json({ error: "Данные ещё не получены от сервера MTR, подождите немного." });
  }
  if (result.notFound) {
    return res.status(404).json({ error: "Маршрут с таким id не найден." });
  }
  res.json(result);
});

app.get("/api/route-graph", (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) {
    return res.status(400).json({ error: "Нужны параметры from и to (id станций)." });
  }
  const result = schedule.buildRouteGraph(from, to);
  if (!result) {
    return res
      .status(503)
      .json({ error: "Данные ещё не получены от сервера MTR, подождите немного." });
  }
  if (result.notFound) {
    return res.status(404).json({ error: "Одна из станций не найдена." });
  }
  res.json(result);
});

app.get("/api/analytics/route/:id", async (req, res) => {
  const fromTs = req.query.fromTs ? Number(req.query.fromTs) : undefined;
  const toTs = req.query.toTs ? Number(req.query.toTs) : undefined;
  const result = await analytics.getRouteDelayStats(req.params.id, { fromTs, toTs });
  res.json(result);
});

app.get("/api/analytics/overview", async (req, res) => {
  const fromTs = req.query.fromTs ? Number(req.query.fromTs) : undefined;
  const toTs = req.query.toTs ? Number(req.query.toTs) : undefined;
  const result = await analytics.getAllRoutesDelayStats({ fromTs, toTs });
  res.json(result);
});

app.get("/api/analytics/history-snapshot", async (req, res) => {
  // Читаем JSONL-историю опозданий и группируем по 5-минутным срезам времени
  const histFile = path.join(config.DATA_DIR, "delay-history.jsonl");
  if (!fs.existsSync(histFile)) return res.json([]);
  const lines = fs.readFileSync(histFile, "utf8")
    .split("\n").filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);
  if (!lines.length) return res.json([]);
  // Группируем записи по 5-минутным интервалам
  const BUCKET_MS = 5 * 60 * 1000;
  const buckets = new Map();
  for (const entry of lines) {
    const bkey = Math.floor(entry.ts / BUCKET_MS) * BUCKET_MS;
    if (!buckets.has(bkey)) buckets.set(bkey, []);
    buckets.get(bkey).push(entry);
  }
  const snapshots = [];
  for (const [btime, entries] of Array.from(buckets.entries()).sort((a, b) => a[0] - b[0])) {
    const byRoute = new Map();
    for (const e of entries) {
      if (!byRoute.has(e.routeId)) byRoute.set(e.routeId, []);
      byRoute.get(e.routeId).push(e.deviationMs);
    }
    const routes = [];
    for (const [routeId, devs] of byRoute) {
      const avg = devs.reduce((a, b) => a + b, 0) / devs.length;
      routes.push({ routeId, avgMs: Math.round(avg) });
    }
    snapshots.push({ time: btime, routes });
  }
  res.json(snapshots.slice(-288)); // максимум 24ч × 12 срезов = 288 точек
});

// ---- Пробные (черновые) маршруты ----

app.get("/api/draft-helper/suggest", (req, res) => {
  const { type, fromStationId, toStationId } = req.query;
  if (!toStationId) {
    return res.status(400).json({ error: "Нужен параметр toStationId." });
  }
  const result = schedule.suggestDraftLeg({ type: type || null, fromStationId: fromStationId || null, toStationId });
  if (!result) {
    return res.status(503).json({ error: "Данные ещё не получены от сервера MTR, подождите немного." });
  }
  res.json(result);
});

app.get("/api/drafts", (req, res) => {
  res.json(drafts.list());
});

app.get("/api/drafts/:id", (req, res) => {
  const d = drafts.get(req.params.id);
  if (!d) return res.status(404).json({ error: "Пробный маршрут не найден." });
  res.json(d);
});

app.post("/api/drafts", (req, res) => {
  try {
    const created = drafts.create(req.body);
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put("/api/drafts/:id", (req, res) => {
  try {
    const updated = drafts.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: "Пробный маршрут не найден." });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});



// ── Живые прибытия для конкретной станции (прокси к MTR arrivals API) ──
// MTR arrivals принимает platformId (signed int64 decimal), а не stationId.
// Мы накапливаем platformId из успешных ответов и переиспользуем их.
// Карта: stationId hex → Set<platformId signed decimal string>
const _platformIdCache = new Map();

async function fetchArrivalsFromMTR(ids) {
  const url = `${config.BASE_URL}/mtr/api/map/arrivals?dimension=${config.DIMENSION}`;
  const body = JSON.stringify({ stationIdsHex: ids, maxCountPerPlatform: 10 });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body,
  });
  if (!res.ok) throw new Error(`MTR API error: ${res.status}`);
  const data = await res.json();
  return data.data || { arrivals: [] };
}

app.get("/api/stations/:id/arrivals", async (req, res) => {
  try {
    const hexId = req.params.id.toUpperCase();

    // MTR arrivals принимает stationIdsHex как HEX-строки (не decimal).
    // Исходный код: parseHexId() → Long.parseUnsignedLong(id, 16)
    // Собираем: stationId hex + известные platformId (тоже как hex)
    const knownPlatforms = _platformIdCache.get(hexId) || new Set();
    // platformId из arrivals храним как signed decimal → конвертируем в hex для запроса
    const platformHexIds = [...knownPlatforms].map(id => {
      let n = BigInt(id);
      if (n < 0n) n = n + (1n << 64n);
      return n.toString(16).toUpperCase();
    });
    const idsToQuery = [hexId, ...platformHexIds];
    const uniqueIds = [...new Set(idsToQuery)];
    const data = await fetchArrivalsFromMTR(uniqueIds);

    // Накапливаем platformId из ответа
    if (data.arrivals && data.arrivals.length > 0) {
      if (!_platformIdCache.has(hexId)) _platformIdCache.set(hexId, new Set());
      const cache = _platformIdCache.get(hexId);
      for (const a of data.arrivals) {
        if (a.platformId != null) {
          cache.add(String(a.platformId));
        }
      }
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Эндпоинт для просмотра накопленных platformId (для отладки)
app.get("/api/stations/:id/platforms", (req, res) => {
  const hexId = req.params.id.toUpperCase();
  const platforms = _platformIdCache.get(hexId);
  res.json({ stationId: hexId, platformIds: platforms ? [...platforms] : [] });
});

// Seed: принимаем список platformId снаружи (например из arrivals ответа в браузере)
// POST /api/platforms/seed { stationId: "hex", platformIds: ["123", "-456"] }
app.post("/api/platforms/seed", (req, res) => {
  const { stationId, platformIds } = req.body;
  if (!stationId || !Array.isArray(platformIds)) {
    return res.status(400).json({ error: "stationId и platformIds обязательны" });
  }
  const hexId = stationId.toUpperCase();
  if (!_platformIdCache.has(hexId)) _platformIdCache.set(hexId, new Set());
  const cache = _platformIdCache.get(hexId);
  platformIds.forEach(id => cache.add(String(id)));
  res.json({ ok: true, stationId: hexId, total: cache.size });
});

// Все накопленные платформы
app.get("/api/platforms/all", (req, res) => {
  const result = {};
  for (const [stationId, platforms] of _platformIdCache) {
    result[stationId] = [...platforms];
  }
  res.json(result);
});

// ── Пользовательские настройки (избранное, язык, часовой пояс, overrides) ──
// Хранятся в DATA_DIR/prefs.json, переживают перезапуск Electron.
const PREFS_FILE = path.join(config.DATA_DIR, "prefs.json");
function loadPrefs() {
  try {
    if (fs.existsSync(PREFS_FILE)) return JSON.parse(fs.readFileSync(PREFS_FILE, "utf8"));
  } catch {}
  return {};
}
function savePrefs(data) {
  fs.mkdirSync(config.DATA_DIR, { recursive: true });
  fs.writeFileSync(PREFS_FILE, JSON.stringify(data, null, 2));
}
app.get("/api/prefs", (req, res) => res.json(loadPrefs()));
app.post("/api/prefs", (req, res) => {
  try { savePrefs(req.body); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/drafts/:id", (req, res) => {
  const ok = drafts.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: "Пробный маршрут не найден." });
  res.json({ deleted: true });
});

const server = app.listen(config.PORT, () => {
  const actualPort = server.address().port;
  console.log(`MTR Schedule Manager запущен: http://localhost:${actualPort}`);
  // Если запущены как дочерний процесс (например, из Electron) — сообщаем
  // родителю реальный порт. В обычном `node server.js` process.send нет.
  if (typeof process.send === "function") {
    process.send({ type: "server-ready", port: actualPort });
  }
  poller.start();
});

// Экспортируем для Electron, который поднимает сервер внутри своего процесса.
module.exports = { app, server };
