const fs = require("fs");
const path = require("path");
const readline = require("readline");
const config = require("../config");

const TOPOLOGY_FILE = path.join(config.DATA_DIR, "topology.json");
const DEPARTURES_CACHE_FILE = path.join(config.DATA_DIR, "departures-cache.json");
const DELAY_HISTORY_FILE = path.join(config.DATA_DIR, "delay-history.jsonl");

// In-memory состояние — то, что реально используется при ответах API.
// Дублируется на диск, чтобы при перезапуске сервера не ждать
// заново первого опроса.
const state = {
  topology: null, // { stations: [...], routes: [...], dimensions: [...], fetchedAt }
  departures: null, // { currentTime, cachedResponseTime, departures: [...], fetchedAt }
  lastTopologyError: null,
  lastDeparturesError: null,
};

function ensureDataDir() {
  fs.mkdirSync(config.DATA_DIR, { recursive: true });
}

function loadFromDisk() {
  ensureDataDir();
  try {
    if (fs.existsSync(TOPOLOGY_FILE)) {
      state.topology = JSON.parse(fs.readFileSync(TOPOLOGY_FILE, "utf8"));
    }
  } catch (err) {
    console.warn("Не удалось прочитать сохранённую топологию:", err.message);
  }
  try {
    if (fs.existsSync(DEPARTURES_CACHE_FILE)) {
      state.departures = JSON.parse(
        fs.readFileSync(DEPARTURES_CACHE_FILE, "utf8")
      );
    }
  } catch (err) {
    console.warn("Не удалось прочитать сохранённые отправления:", err.message);
  }
}

function setTopology(data) {
  state.topology = { ...data, fetchedAt: Date.now() };
  state.lastTopologyError = null;
  ensureDataDir();
  fs.writeFile(TOPOLOGY_FILE, JSON.stringify(state.topology), () => {});
}

function setTopologyError(message) {
  state.lastTopologyError = { message, at: Date.now() };
}

function setDepartures(data) {
  state.departures = { ...data, fetchedAt: Date.now() };
  state.lastDeparturesError = null;
  ensureDataDir();
  fs.writeFile(DEPARTURES_CACHE_FILE, JSON.stringify(state.departures), () => {});
}

function setDeparturesError(message) {
  state.lastDeparturesError = { message, at: Date.now() };
}

function getTopology() {
  return state.topology;
}

function getDepartures() {
  return state.departures;
}

function getStatus() {
  return {
    topology: {
      fetchedAt: state.topology ? state.topology.fetchedAt : null,
      stationCount: state.topology ? state.topology.stations.length : 0,
      routeCount: state.topology ? state.topology.routes.length : 0,
      lastError: state.lastTopologyError,
    },
    departures: {
      fetchedAt: state.departures ? state.departures.fetchedAt : null,
      routeCount: state.departures ? state.departures.departures.length : 0,
      lastError: state.lastDeparturesError,
    },
  };
}

/**
 * Добавляет в журнал истории отклонений по одной строке на каждую
 * группу (маршрут + конкретный поезд/deviation), снятую во время опроса.
 * Используется потом для аналитики опозданий.
 */
function appendDelayHistory(rows) {
  if (!rows.length) return;
  ensureDataDir();
  const lines = rows.map((r) => JSON.stringify(r)).join("\n") + "\n";
  fs.appendFile(DELAY_HISTORY_FILE, lines, (err) => {
    if (err) console.warn("Не удалось записать историю отклонений:", err.message);
  });
}

/**
 * Читает всю историю отклонений построчно, опционально фильтруя.
 * Возвращает Promise<Array<{ts, routeId, deviation}>>.
 */
async function readDelayHistory({ routeId, fromTs, toTs } = {}) {
  if (!fs.existsSync(DELAY_HISTORY_FILE)) return [];

  const results = [];
  const rl = readline.createInterface({
    input: fs.createReadStream(DELAY_HISTORY_FILE),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    if (routeId && row.routeId !== routeId) continue;
    if (fromTs && row.ts < fromTs) continue;
    if (toTs && row.ts > toTs) continue;
    results.push(row);
  }
  return results;
}

/**
 * Удаляет из файла истории записи старше DELAY_HISTORY_RETENTION_MS,
 * чтобы файл не рос бесконечно. Перезаписывает файл целиком —
 * нормально для локального однопользовательского приложения с
 * умеренным объёмом данных; вызывается редко (раз в час).
 */
async function pruneDelayHistory() {
  if (!fs.existsSync(DELAY_HISTORY_FILE)) return;
  const cutoff = Date.now() - config.DELAY_HISTORY_RETENTION_MS;
  const all = await readDelayHistory({});
  const kept = all.filter((r) => r.ts >= cutoff);
  if (kept.length === all.length) return; // нечего удалять
  const lines = kept.map((r) => JSON.stringify(r)).join("\n") + (kept.length ? "\n" : "");
  fs.writeFile(DELAY_HISTORY_FILE, lines, (err) => {
    if (err) console.warn("Не удалось очистить историю отклонений:", err.message);
  });
}

module.exports = {
  loadFromDisk,
  setTopology,
  setTopologyError,
  setDepartures,
  setDeparturesError,
  getTopology,
  getDepartures,
  getStatus,
  appendDelayHistory,
  readDelayHistory,
  pruneDelayHistory,
};
