const config = require("../config");

/**
 * Выполняет GET-запрос к MTR API и возвращает разобранный JSON.
 * Бросает исключение с понятным сообщением при сетевой ошибке или
 * неожиданном HTTP-статусе.
 */
async function getJson(pathName) {
  const url = `${config.BASE_URL}${pathName}`;
  let res;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/json" },
    });
  } catch (err) {
    throw new Error(`Не удалось подключиться к ${url}: ${err.message}`);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `MTR API вернул статус ${res.status} ${res.statusText} для ${url}. ` +
        `Тело ответа (первые 300 символов): ${body.slice(0, 300)}`
    );
  }

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `Ответ от ${url} не является валидным JSON (возможно, эндпоинт изменился). ` +
        `Первые 300 символов: ${text.slice(0, 300)}`
    );
  }
}

/**
 * Топология сети: список станций и маршрутов.
 */
async function fetchStationsAndRoutes() {
  const json = await getJson(
    `/mtr/api/map/stations-and-routes?dimension=${config.DIMENSION}`
  );
  if (!json || !json.data) {
    throw new Error("Неожиданный формат ответа stations-and-routes");
  }
  return json.data; // { stations, routes, dimensions }
}

/**
 * Расписание отправлений по маршрутам (включая отклонения от графика).
 */
async function fetchDepartures() {
  const json = await getJson(
    `/mtr/api/map/departures?dimension=${config.DIMENSION}`
  );
  if (!json || !json.data) {
    throw new Error("Неожиданный формат ответа departures");
  }
  return { currentTime: json.currentTime, ...json.data }; // { currentTime, cachedResponseTime, departures }
}

module.exports = { fetchStationsAndRoutes, fetchDepartures };
