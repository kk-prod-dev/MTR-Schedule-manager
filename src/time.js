const MS_PER_DAY = 86400000;

/** Приводит произвольное число мс к диапазону [0, MS_PER_DAY). */
function normalizeTimeOfDay(ms) {
  const m = ms % MS_PER_DAY;
  return m < 0 ? m + MS_PER_DAY : m;
}

/** Переводит мс-от-полуночи в строку "ЧЧ:ММ:СС" (UTC). */
function formatTimeOfDay(ms) {
  const normalized = normalizeTimeOfDay(Math.round(ms));
  const totalSeconds = Math.floor(normalized / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** Переводит мс-от-полуночи в строку "ЧЧ:ММ" (UTC), без секунд. */
function formatTimeOfDayShort(ms) {
  return formatTimeOfDay(ms).slice(0, 5);
}

module.exports = {
  MS_PER_DAY,
  normalizeTimeOfDay,
  formatTimeOfDay,
  formatTimeOfDayShort,
};
