const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const config = require("../config");

const DRAFTS_FILE = path.join(config.DATA_DIR, "draft-routes.json");

function ensureDataDir() {
  fs.mkdirSync(config.DATA_DIR, { recursive: true });
}

function loadAll() {
  ensureDataDir();
  if (!fs.existsSync(DRAFTS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(DRAFTS_FILE, "utf8"));
  } catch {
    return [];
  }
}

function saveAll(list) {
  ensureDataDir();
  fs.writeFileSync(DRAFTS_FILE, JSON.stringify(list, null, 2));
}

function list() {
  return loadAll();
}

function get(id) {
  return loadAll().find((d) => d.id === id) || null;
}

/**
 * Проверяет и нормализует тело запроса на создание/изменение пробного
 * маршрута. Бросает Error с понятным сообщением при некорректных данных.
 */
function validateAndNormalize(body) {
  if (!body || typeof body !== "object") throw new Error("Пустое тело запроса.");
  const name = String(body.name || "").trim();
  if (!name) throw new Error("Укажите название маршрута.");

  const stops = Array.isArray(body.stops) ? body.stops : [];
  if (stops.length < 2) throw new Error("Нужно минимум 2 остановки.");
  for (const s of stops) {
    if (!s || !s.stationId) throw new Error("У каждой остановки должна быть выбрана станция.");
  }

  const durationsMs = Array.isArray(body.durationsMs) ? body.durationsMs.map(Number) : [];
  if (durationsMs.length !== stops.length - 1) {
    throw new Error("Количество перегонов (durationsMs) должно быть на 1 меньше числа остановок.");
  }
  if (durationsMs.some((d) => !Number.isFinite(d) || d < 0)) {
    throw new Error("Время перегона должно быть положительным числом (мс).");
  }

  // Группы отправлений по формуле D + X*I (X = 0..additionalCount).
  // Может быть несколько групп — например, разные интервалы в час пик
  // и вне его. Каждая группа хранится отдельно (а не "развёрнутой" в
  // список времён), чтобы потом можно было показать саму формулу в
  // карточке маршрута для вставки в игру.
  const rawGroups = Array.isArray(body.departureGroups) ? body.departureGroups : [];
  const departureGroups = rawGroups.map((g, i) => {
    const firstTimeMs = Number(g.firstTimeMs);
    const intervalMs = Number(g.intervalMs);
    const additionalCount = Number(g.additionalCount);
    if (!Number.isFinite(firstTimeMs) || firstTimeMs < 0 || firstTimeMs >= 86400000) {
      throw new Error(`Группа отправлений №${i + 1}: некорректное время первого отправления.`);
    }
    if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
      throw new Error(`Группа отправлений №${i + 1}: интервал должен быть положительным числом.`);
    }
    if (!Number.isInteger(additionalCount) || additionalCount < 0) {
      throw new Error(`Группа отправлений №${i + 1}: количество доп. отправлений должно быть целым числом ≥ 0.`);
    }
    return { id: g.id || ("grp-" + crypto.randomUUID()), firstTimeMs, intervalMs, additionalCount };
  });

  // Индивидуальные отправления (старый формат с одним временем — со
  // страницы создания, либо массив — управление столбцами прямо в
  // карточке маршрута).
  let departureTimesOfDayMs = Array.isArray(body.departureTimesOfDayMs) ? body.departureTimesOfDayMs.map(Number) : [];
  if (departureTimesOfDayMs.length === 0 && departureGroups.length === 0) {
    if (Number.isFinite(Number(body.departureTimeOfDayMs))) {
      departureTimesOfDayMs = [Number(body.departureTimeOfDayMs)];
    } else {
      throw new Error("Нужно указать хотя бы одно время отправления (вручную или через группу с интервалом).");
    }
  }
  for (const v of departureTimesOfDayMs) {
    if (!Number.isFinite(v) || v < 0 || v >= 86400000) {
      throw new Error("Некорректное время отправления (ожидается мс от полуночи UTC, 0..86399999).");
    }
  }

  return {
    name,
    number: String(body.number || "").trim(),
    color: Number.isFinite(Number(body.color)) ? Number(body.color) : 0x9ca3af,
    type: String(body.type || "train_normal"),
    depotLabel: String(body.depotLabel || "").trim(),
    stops: stops.map((s) => ({
      stationId: String(s.stationId),
      platformName: String(s.platformName || "").trim() || "Draft",
      dwellTimeMs: Number.isFinite(Number(s.dwellTimeMs)) ? Number(s.dwellTimeMs) : 0,
    })),
    durationsMs,
    departureTimesOfDayMs,
    departureGroups,
  };
}

function create(body) {
  const normalized = validateAndNormalize(body);
  const draft = {
    id: "draft-" + crypto.randomUUID(),
    ...normalized,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const all = loadAll();
  all.push(draft);
  saveAll(all);
  return draft;
}

function update(id, body) {
  const normalized = validateAndNormalize(body);
  const all = loadAll();
  const idx = all.findIndex((d) => d.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...normalized, updatedAt: Date.now() };
  saveAll(all);
  return all[idx];
}

function remove(id) {
  const all = loadAll();
  const next = all.filter((d) => d.id !== id);
  if (next.length === all.length) return false;
  saveAll(next);
  return true;
}

module.exports = { list, get, create, update, remove };
