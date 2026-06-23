// Диагностика: почему конкретный маршрут не появляется в расписании
// станции / графике движения, хотя он точно есть в игре и едет.
//
// Запуск: node diagnose-missing-route.js "часть названия маршрута"
// Пример: node diagnose-missing-route.js "Inselburg"
//
// Скрипт делает живой опрос сервера (как и сам app), ищет маршрут по
// подстроке в названии и подробно печатает всё, что о нём известно:
// есть ли он в топологии, есть ли для него активные отправления, и не
// расходится ли что-то в его данных.

const BASE_URL = process.env.MTR_BASE_URL || "https://system.georail.eu";
const DIMENSION = 0;
const fs = require("fs");

const query = process.argv[2];
if (!query) {
  console.error('Укажи часть названия маршрута: node diagnose-missing-route.js "название"');
  process.exit(1);
}

async function getJson(path) {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status} для ${path}`);
  return res.json();
}

(async () => {
  console.log("Опрашиваю сервер...");
  const stationsRoutesResp = await getJson(`/mtr/api/map/stations-and-routes?dimension=${DIMENSION}`);
  const departuresResp = await getJson(`/mtr/api/map/departures?dimension=${DIMENSION}`);

  const routes = stationsRoutesResp.data.routes;
  const stations = stationsRoutesResp.data.stations;
  const departures = departuresResp.data.departures;
  const currentTime = departuresResp.currentTime;

  console.log(`Всего маршрутов в топологии: ${routes.length}`);
  console.log(`Маршрутов с активными отправлениями (departures): ${departures.length}`);
  console.log(`currentTime сервера: ${currentTime} (${new Date(currentTime).toISOString()})\n`);

  const matches = routes.filter((r) => (r.name || "").toLowerCase().includes(query.toLowerCase()));
  if (matches.length === 0) {
    console.log(`Маршрутов с "${query}" в названии не найдено вообще (даже без активных рейсов).`);
    console.log("Это значит, что сервер прямо сейчас не отдаёт такой маршрут в /stations-and-routes.");
    process.exit(0);
  }

  console.log(`Найдено ${matches.length} маршрут(ов) с "${query}" в названии:\n`);

  for (const route of matches) {
    console.log("=".repeat(60));
    console.log("ID:", route.id);
    console.log("Название (raw):", route.name);
    console.log("hidden:", route.hidden);
    console.log("Остановок:", (route.stations || []).length);
    console.log("Первая остановка:", route.stations?.[0]);
    console.log("Последняя остановка:", route.stations?.[route.stations.length - 1]);

    const departureEntry = departures.find((d) => d.id === route.id);
    if (departureEntry) {
      console.log("✅ ЕСТЬ запись в departures. Групп (поездов/сайдингов):", departureEntry.departures.length);
      departureEntry.departures.forEach((g, i) => {
        console.log(`   Группа ${i}: deviation=${g.deviation}, отправлений=${g.departures.length}, первые 3:`, g.departures.slice(0, 3));
      });
    } else {
      console.log("❌ НЕТ записи в departures для этого route.id — вот причина, почему маршрут не появляется в расписании/графике.");
      console.log("   Возможные причины:");
      console.log("   1) Прямо сейчас по маршруту физически нет поезда (он мог уехать в депо/на обслуживание).");
      console.log("   2) Маршрут был недавно создан/изменён в игре и сервер ещё не обновил кэш отправлений.");
      console.log("   3) ID маршрута мог измениться между опросами (например, после редактирования в игре).");
    }
    console.log();
  }

  fs.writeFileSync("diagnose-output.json", JSON.stringify({ matches, departuresForMatches: matches.map(r => departures.find(d => d.id === r.id) || null) }, null, 2));
  console.log("Полный JSON сохранён в diagnose-output.json — пришли мне этот файл, если маршрут всё ещё не находится.");
})();
