const config = require("../config");
const mtrApi = require("./mtrApi");
const store = require("./store");

async function pollTopology() {
  try {
    const data = await mtrApi.fetchStationsAndRoutes();
    store.setTopology(data);
    console.log(
      `[topology] OK: ${data.stations.length} станций, ${data.routes.length} маршрутов`
    );
  } catch (err) {
    store.setTopologyError(err.message);
    console.error("[topology] Ошибка:", err.message);
  }
}

async function pollDepartures() {
  try {
    const data = await mtrApi.fetchDepartures();
    store.setDepartures(data);

    // Складываем снимок отклонений в историю для аналитики.
    // Одна строка = один маршрут + одна группа поезда (deviation) на этот опрос.
    const ts = Date.now();
    const rows = [];
    for (const entry of data.departures) {
      for (const group of entry.departures) {
        rows.push({
          ts,
          routeId: entry.id,
          deviation: group.deviation,
          // берём ближайшее отправление группы как метку для отладки/контекста
          sampleDeparture: group.departures[0] ?? null,
        });
      }
    }
    store.appendDelayHistory(rows);

    console.log(
      `[departures] OK: расписание по ${data.departures.length} маршрутам ` +
        `(${rows.length} записей отклонений)`
    );
  } catch (err) {
    store.setDeparturesError(err.message);
    console.error("[departures] Ошибка:", err.message);
  }
}

function start() {
  store.loadFromDisk();

  // Первый опрос — сразу при старте, не дожидаясь интервала.
  pollTopology();
  pollDepartures();

  setInterval(pollTopology, config.TOPOLOGY_POLL_MS);
  setInterval(pollDepartures, config.DEPARTURES_POLL_MS);

  // Раз в час подчищаем старую историю отклонений.
  setInterval(() => store.pruneDelayHistory(), 60 * 60 * 1000);
}

module.exports = { start };
