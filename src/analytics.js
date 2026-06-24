const store = require("./store");

/**
 * Сводная статистика по опозданиям для одного маршрута за период.
 * deviation хранится в мс (как отдаёт MTR API): >0 — опоздание,
 * <0 — поезд идёт с опережением графика.
 */
async function getRouteDelayStats(routeId, { fromTs, toTs } = {}) {
  const rows = await store.readDelayHistory({ routeId, fromTs, toTs });
  if (rows.length === 0) {
    return {
      routeId,
      sampleCount: 0,
      avgDeviationMs: 0,
      maxDeviationMs: 0,
      minDeviationMs: 0,
      onTimeShare: null,
    };
  }

  const deviations = rows.map((r) => r.deviation);
  const sum = deviations.reduce((a, b) => a + b, 0);
  const avg = sum / deviations.length;
  const max = Math.max(...deviations);
  const min = Math.min(...deviations);

  // "Вовремя" считаем отклонение в пределах ±60 секунд — порог можно
  // будет вынести в настройки, если потребуется точнее.
  const ON_TIME_THRESHOLD_MS = 60000;
  const onTimeCount = deviations.filter(
    (d) => Math.abs(d) <= ON_TIME_THRESHOLD_MS
  ).length;

  return {
    routeId,
    sampleCount: rows.length,
    avgDeviationMs: Math.round(avg),
    maxDeviationMs: max,
    minDeviationMs: min,
    onTimeShare: onTimeCount / rows.length,
  };
}

/**
 * Сводная статистика по всем маршрутам сразу за период — для общего
 * обзора (например, "топ опаздывающих линий").
 */
async function getAllRoutesDelayStats({ fromTs, toTs } = {}) {
  const rows = await store.readDelayHistory({ fromTs, toTs });
  const byRoute = new Map();

  for (const r of rows) {
    if (!byRoute.has(r.routeId)) byRoute.set(r.routeId, []);
    byRoute.get(r.routeId).push(r.deviation);
  }

  const result = [];
  for (const [routeId, deviations] of byRoute.entries()) {
    const sum = deviations.reduce((a, b) => a + b, 0);
    result.push({
      routeId,
      sampleCount: deviations.length,
      avgDeviationMs: Math.round(sum / deviations.length),
      maxDeviationMs: Math.max(...deviations),
    });
  }

  result.sort((a, b) => b.avgDeviationMs - a.avgDeviationMs);
  return result;
}

module.exports = { getRouteDelayStats, getAllRoutesDelayStats };
