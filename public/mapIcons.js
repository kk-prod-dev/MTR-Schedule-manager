// ============================================================
// MapIcons — значки для схем сети (парки, музеи, вокзалы и т.д.)
// ============================================================
// Нарисованы вручную, сетка 24×24, без внешних ресурсов. У каждой категории
// 3 варианта рисунка; поверх любого варианта можно выбрать «плашку»: без
// плашки / круг / скруглённый квадрат (белый рисунок на цветной плашке).
//
// Глиф — список элементов [тег, атрибуты]. Цвета — токены: "c" (цвет
// рисунка) и "b" (цвет «выреза» — фон схемы или плашки). Рисуется только
// через DOM API (createElementNS/setAttribute), никакого innerHTML.

const MapIcons = (function () {
  const NS = "http://www.w3.org/2000/svg";

  // короткие конструкторы элементов
  const P = (d, o) => ["path", Object.assign({ d, fill: "c" }, o)];          // заливка цветом рисунка
  const Pb = (d, o) => ["path", Object.assign({ d, fill: "b" }, o)];         // вырез
  const S = (d, w, o) => ["path", Object.assign({ d, fill: "none", stroke: "c", "stroke-width": w, "stroke-linecap": "round", "stroke-linejoin": "round" }, o)];
  const Sb = (d, w, o) => ["path", Object.assign({ d, fill: "none", stroke: "b", "stroke-width": w, "stroke-linecap": "round", "stroke-linejoin": "round" }, o)];
  const C = (cx, cy, r, o) => ["circle", Object.assign({ cx, cy, r, fill: "c" }, o)];
  const Cb = (cx, cy, r, o) => ["circle", Object.assign({ cx, cy, r, fill: "b" }, o)];
  const R = (x, y, width, height, rx, o) => ["rect", Object.assign({ x, y, width, height, rx: rx || 0, fill: "c" }, o)];
  const Rb = (x, y, width, height, rx, o) => ["rect", Object.assign({ x, y, width, height, rx: rx || 0, fill: "b" }, o)];
  const E = (cx, cy, rx, ry, o) => ["ellipse", Object.assign({ cx, cy, rx, ry, fill: "c" }, o)];
  const Eb = (cx, cy, rx, ry, o) => ["ellipse", Object.assign({ cx, cy, rx, ry, fill: "b" }, o)];

  const CATALOG = [
    { id: "park", color: "#16a34a", ru: "Парк", en: "Park", de: "Park", fr: "Parc", pl: "Park", pt: "Parque", cs: "Park", glyphs: [
      // лиственное дерево
      [C(12, 8, 5.6), C(7.4, 11.5, 4), C(16.6, 11.5, 4), R(10.8, 12, 2.4, 9.5, 1)],
      // ель
      [P("M12 1.5 L17.5 9 H14.5 L19 15.5 H5 L9.5 9 H6.5Z"), R(10.8, 15, 2.4, 6.5, 0.6)],
      // лист
      [P("M4.5 19.5 C4 10 10 4 20 4 C20.5 13.5 14.5 19.8 4.5 19.5Z"), Sb("M5 19.2 L15 9.2", 1.5), Sb("M10 14.2 L10.2 9.8 M12.5 11.7 L17 11.6", 1.2)],
    ] },
    { id: "museum", color: "#9333ea", ru: "Музей", en: "Museum", de: "Museum", fr: "Musée", pl: "Muzeum", pt: "Museu", cs: "Muzeum", glyphs: [
      // здание с колоннами
      [P("M2 9 L12 3 L22 9Z"), R(4, 10.5, 2.4, 7.5), R(8.9, 10.5, 2.4, 7.5), R(13.7, 10.5, 2.4, 7.5), R(18.6, 10.5, 2.4, 7.5), R(2, 19, 20, 2.5, 0.6)],
      // амфора
      [P("M9 2.5 H15 V4.5 C15 5.8 14 6.2 14 7.6 C17 8.6 19 11 19 14.2 C19 18 15.8 21.5 12 21.5 C8.2 21.5 5 18 5 14.2 C5 11 7 8.6 10 7.6 C10 6.2 9 5.8 9 4.5Z"), Sb("M6.2 13.5 H17.8", 1.4), Sb("M6.6 16.5 H17.4", 1.4)],
      // картина в раме
      [R(2.5, 4, 19, 16, 2.2), Rb(5, 6.5, 14, 11, 0.8), P("M6.5 15.5 L10.6 10 L13.4 13.4 L15.2 11.4 L17.5 15.5Z"), C(15.8, 8.6, 1.5)],
    ] },
    { id: "station", color: "#2563eb", ru: "Вокзал", en: "Railway station", de: "Bahnhof", fr: "Gare", pl: "Dworzec kolejowy", pt: "Estação ferroviária", cs: "Nádraží", glyphs: [
      // поезд спереди
      [R(5.5, 2.5, 13, 14.5, 3.5), Rb(7.5, 5, 9, 5.5, 1), Cb(9.3, 13.8, 1.3), Cb(14.7, 13.8, 1.3), S("M8.5 17.5 L6 21.5 M15.5 17.5 L18 21.5", 2)],
      // здание вокзала с часами
      [P("M2.5 10.5 L12 3 L21.5 10.5Z"), R(4, 10.5, 16, 10.5, 0.8), Cb(12, 7.6, 1.9), Sb("M12 6.6 V7.7 L12.9 8.1", 0.9), Rb(10.2, 15, 3.6, 6, 0.6), Rb(5.6, 12.8, 2.8, 3, 0.4), Rb(15.6, 12.8, 2.8, 3, 0.4)],
      // рельсы со шпалами
      [S("M7.4 21.5 L10.2 2.5 M16.6 21.5 L13.8 2.5", 1.9), S("M7.9 19.5 H16.1 M8.5 15 H15.5 M9.2 10.4 H14.8 M9.8 6.2 H14.2", 1.7)],
    ] },
    { id: "airport", color: "#0891b2", ru: "Аэропорт", en: "Airport", de: "Flughafen", fr: "Aéroport", pl: "Lotnisko", pt: "Aeroporto", cs: "Letiště", glyphs: [
      // самолёт сверху
      [R(10.6, 2, 2.8, 19.5, 1.4), P("M12 9 L22 15 V17.2 L12 13.8 L2 17.2 V15Z"), P("M12 18.2 L16.2 20.8 V22 L12 20.8 L7.8 22 V20.8Z")],
      // диспетчерская вышка
      [P("M9.2 21.5 L10.6 11.5 H13.4 L14.8 21.5Z"), P("M6.8 5 H17.2 L19.4 9.6 Q19.4 11 18 11 H6 Q4.6 11 4.6 9.6Z"), Rb(7.4, 6.2, 9.2, 2.2, 0.5), R(8, 21, 8, 1.6, 0.5)],
      // взлётная полоса
      [R(7, 2, 10, 20, 1.2), Rb(11.2, 3.6, 1.6, 3), Rb(11.2, 8.4, 1.6, 3), Rb(11.2, 13.2, 1.6, 3), Rb(11.2, 18, 1.6, 2.4), Rb(8.4, 3.2, 1.2, 1.6), Rb(14.4, 3.2, 1.2, 1.6)],
    ] },
    { id: "hospital", color: "#dc2626", ru: "Больница", en: "Hospital", de: "Krankenhaus", fr: "Hôpital", pl: "Szpital", pt: "Hospital", cs: "Nemocnice", glyphs: [
      // крест
      [P("M9 2.5 H15 V9 H21.5 V15 H15 V21.5 H9 V15 H2.5 V9 H9Z")],
      // «H» в квадрате
      [R(2.5, 2.5, 19, 19, 3.5), Rb(6.6, 6.4, 2.6, 11.2), Rb(14.8, 6.4, 2.6, 11.2), Rb(6.6, 10.7, 10.8, 2.6)],
      // сердце с крестом
      [P("M12 21.5 C4.5 15.8 2 12 2 8.6 A5.1 5.1 0 0 1 12 6.4 A5.1 5.1 0 0 1 22 8.6 C22 12 19.5 15.8 12 21.5Z"), Rb(10.9, 8.2, 2.2, 7), Rb(8.5, 10.6, 7, 2.2)],
    ] },
    { id: "university", color: "#7c3aed", ru: "Университет", en: "University", de: "Universität", fr: "Université", pl: "Uniwersytet", pt: "Universidade", cs: "Univerzita", glyphs: [
      // академическая шапка
      [P("M12 3.5 L23 9 L12 14.5 L1 9Z"), P("M5.8 12.6 V17 C5.8 19.4 18.2 19.4 18.2 17 V12.6 L12 15.7Z"), S("M21.6 10 V16", 1.6), C(21.6, 17.2, 1.2)],
      // раскрытая книга
      [P("M12 6.2 C9 4 5 3.8 2 4.8 V19 C5 18 9 18.2 12 20.4 C15 18.2 19 18 22 19 V4.8 C19 3.8 15 4 12 6.2Z"), Sb("M12 7.5 V19", 1.4)],
      // атом
      [C(12, 12, 2.2), ["ellipse", { cx: 12, cy: 12, rx: 9.5, ry: 3.8, fill: "none", stroke: "c", "stroke-width": 1.5 }], ["ellipse", { cx: 12, cy: 12, rx: 9.5, ry: 3.8, fill: "none", stroke: "c", "stroke-width": 1.5, transform: "rotate(60 12 12)" }], ["ellipse", { cx: 12, cy: 12, rx: 9.5, ry: 3.8, fill: "none", stroke: "c", "stroke-width": 1.5, transform: "rotate(120 12 12)" }]],
    ] },
    { id: "stadium", color: "#ea580c", ru: "Стадион", en: "Stadium", de: "Stadion", fr: "Stade", pl: "Stadion", pt: "Estádio", cs: "Stadion", glyphs: [
      // чаша стадиона
      [E(12, 12, 10.5, 7.5), Eb(12, 12, 7, 4.2), Sb("M12 7.8 V16.2", 1), ["ellipse", { cx: 12, cy: 12, rx: 1.8, ry: 1.2, fill: "none", stroke: "b", "stroke-width": 0.9 }]],
      // мяч
      [C(12, 12, 9.6), Pb("M12 7.6 L15.6 10.2 L14.2 14.4 H9.8 L8.4 10.2Z"), Sb("M12 7.6 V3 M15.6 10.2 L20 8.8 M14.2 14.4 L17 18.2 M9.8 14.4 L7 18.2 M8.4 10.2 L4 8.8", 1.2)],
      // кубок
      [P("M6.5 3 H17.5 V9 A5.5 5.5 0 0 1 6.5 9Z"), S("M6.5 5 H3.2 V7 C3.2 9.4 4.8 10.6 7 10.8 M17.5 5 H20.8 V7 C20.8 9.4 19.2 10.6 17 10.8", 1.5), R(10.8, 13.8, 2.4, 4), R(7.2, 17.6, 9.6, 3.4, 1)],
    ] },
    { id: "theatre", color: "#be185d", ru: "Театр", en: "Theatre", de: "Theater", fr: "Théâtre", pl: "Teatr", pt: "Teatro", cs: "Divadlo", glyphs: [
      // маска
      [P("M3.5 3.5 H20.5 V11.5 A8.5 8.5 0 0 1 3.5 11.5Z"), Eb(8.5, 9.4, 2, 1.4), Eb(15.5, 9.4, 2, 1.4), Sb("M7.8 14.2 Q12 18.4 16.2 14.2", 1.6)],
      // занавес
      [R(2.5, 2.5, 19, 3, 1), P("M3.5 5.5 C9.5 7 9 15 4.2 21.5 L3.5 21.5Z"), P("M20.5 5.5 C14.5 7 15 15 19.8 21.5 L20.5 21.5Z"), P("M7 5.5 C11 8 10.5 14 8.4 21.5 L12 21.5 L12 5.5Z", { opacity: 0.55 }), P("M17 5.5 C13 8 13.5 14 15.6 21.5 L12 21.5 L12 5.5Z", { opacity: 0.55 })],
      // билет
      [P("M2.5 6.5 H21.5 V10.2 A1.8 1.8 0 0 0 21.5 13.8 V17.5 H2.5 V13.8 A1.8 1.8 0 0 0 2.5 10.2Z"), Pb("M12 8 L13.1 10.7 L16 10.9 L13.8 12.8 L14.5 15.6 L12 14.1 L9.5 15.6 L10.2 12.8 L8 10.9 L10.9 10.7Z")],
    ] },
    { id: "church", color: "#b45309", ru: "Храм", en: "Place of worship", de: "Gotteshaus", fr: "Lieu de culte", pl: "Miejsce kultu", pt: "Local de culto", cs: "Místo uctívání", glyphs: [
      // церковь с крестом
      [P("M12 1.5 V6 M9.8 3.4 H14.2", { fill: "none", stroke: "c", "stroke-width": 1.6, "stroke-linecap": "round" }), P("M12 6.5 L19.5 12.5 H4.5Z"), R(5.5, 12.5, 13, 9), Rb(10.2, 16, 3.6, 5.5, 1.8)],
      // купол-луковица
      [S("M12 1.4 V4.6 M10.3 2.8 H13.7", 1.4), P("M12 4.8 C15.4 7.6 18 9.6 18 12.4 C18 14.2 15.4 14.6 12 14.6 C8.6 14.6 6 14.2 6 12.4 C6 9.6 8.6 7.6 12 4.8Z"), R(8.8, 14.6, 6.4, 2.2), R(5.6, 16.8, 12.8, 4.7, 0.6), Rb(10.4, 17.8, 3.2, 3.7, 1.6)],
      // полумесяц
      [C(11, 12, 8.6), Cb(14.6, 10.2, 7.4), P("M18.4 13.2 L19.3 15.2 L21.5 15.4 L19.8 16.8 L20.4 19 L18.4 17.8 L16.4 19 L17 16.8 L15.3 15.4 L17.5 15.2Z")],
    ] },
    { id: "shopping", color: "#0d9488", ru: "Торговый центр", en: "Shopping", de: "Einkaufszentrum", fr: "Centre commercial", pl: "Centrum handlowe", pt: "Centro comercial", cs: "Obchodní centrum", glyphs: [
      // тележка
      [S("M2.5 3.5 H5.2 L7.6 15 H18.6 L20.8 6.8 H6", 2), C(9.2, 19, 1.7), C(17, 19, 1.7)],
      // пакет
      [R(4, 8, 16, 13.5, 1.6), S("M8.6 8 V6.8 A3.4 3.4 0 0 1 15.4 6.8 V8", 1.8), Cb(9, 11.5, 1), Cb(15, 11.5, 1)],
      // ценник
      [P("M2.8 12.6 V4 A1.2 1.2 0 0 1 4 2.8 H12.6 L21.4 11.6 L11.6 21.4Z"), Cb(7.4, 7.4, 1.8)],
    ] },
    { id: "port", color: "#1d4ed8", ru: "Порт", en: "Port", de: "Hafen", fr: "Port", pl: "Port", pt: "Porto", cs: "Přístav", glyphs: [
      // якорь
      [S("M12 6.2 V21", 2), ["circle", { cx: 12, cy: 4.2, r: 2.1, fill: "none", stroke: "c", "stroke-width": 1.8 }], S("M7.5 10.2 H16.5", 2), S("M3.6 14 C4 18 8 20.8 12 20.8 C16 20.8 20 18 20.4 14", 2), S("M3.2 14.2 L5.6 12.4 M20.8 14.2 L18.4 12.4", 1.8)],
      // судно
      [P("M3 14 H21 L18.2 20 H5.8Z"), R(6.5, 9, 9, 5), R(9.2, 5.2, 3.6, 3.8, 0.4), Rb(8, 10.4, 2, 1.8), Rb(11, 10.4, 2, 1.8)],
      // маяк
      [P("M8.8 21.5 L10.2 9 H13.8 L15.2 21.5Z"), R(9.2, 6.2, 5.6, 2.8, 0.4), P("M12 1.8 L15.6 6.2 H8.4Z"), R(6.5, 21, 11, 1.8, 0.6), Rb(10.6, 12, 2.8, 1.8), Rb(10.2, 15.4, 3.6, 1.8), S("M3.2 7.4 H6.4 M17.6 7.4 H20.8", 1.4)],
    ] },
    { id: "monument", color: "#475569", ru: "Памятник", en: "Monument", de: "Denkmal", fr: "Monument", pl: "Pomnik", pt: "Monumento", cs: "Pomník", glyphs: [
      // обелиск
      [P("M12 1.8 L14.2 6 L14.8 17.5 H9.2 L9.8 6Z"), R(7.4, 17.5, 9.2, 2.2), R(5.6, 19.7, 12.8, 2.2, 0.4)],
      // статуя на постаменте
      [C(12, 5.2, 2.6), P("M7.8 16 C7.8 10.4 9.8 8.6 12 8.6 C14.2 8.6 16.2 10.4 16.2 16Z"), R(5.6, 16, 12.8, 2.6, 0.5), R(4, 18.6, 16, 3.2, 0.6)],
      // звезда
      [P("M12 2.2 L14.9 8.7 L22 9.4 L16.7 14.2 L18.3 21.2 L12 17.5 L5.7 21.2 L7.3 14.2 L2 9.4 L9.1 8.7Z")],
    ] },
    { id: "busstation", color: "#0369a1", ru: "Автовокзал", en: "Bus station", de: "Busbahnhof", fr: "Gare routière", pl: "Dworzec autobusowy", pt: "Rodoviária", cs: "Autobusové nádraží", glyphs: [
      // автобус спереди
      [R(4, 3, 16, 15, 3), Rb(6.2, 5.4, 11.6, 5.2, 1), Cb(8.2, 14, 1.4), Cb(15.8, 14, 1.4), R(5.5, 18, 3, 3.5, 0.8), R(15.5, 18, 3, 3.5, 0.8)],
      // автобус сбоку
      [R(2, 5.5, 20, 11.5, 2.6), Rb(4, 7.6, 3.8, 4), Rb(9, 7.6, 3.8, 4), Rb(14, 7.6, 3.8, 4), Rb(18.6, 7.6, 1.6, 7.6, 0.6), C(7, 17.4, 2.7), Cb(7, 17.4, 1), C(17, 17.4, 2.7), Cb(17, 17.4, 1)],
      // знак остановки
      [R(11, 9, 2, 12.5, 0.6), R(4.5, 2, 15, 9, 2.4), Rb(7, 4.2, 10, 4.6, 1)],
    ] },
    { id: "riverstation", color: "#0e7490", ru: "Речной вокзал", en: "River station", de: "Flusshafen", fr: "Gare fluviale", pl: "Dworzec rzeczny", pt: "Terminal fluvial", cs: "Říční nádraží", glyphs: [
      // пассажирский теплоход
      [P("M2.5 14.5 H21.5 L18.6 19.6 H5.4Z"), R(6, 8.6, 12, 5.9, 1), R(10.4, 4.8, 3.2, 3.8, 0.5), Rb(7.8, 10.4, 2, 2), Rb(11, 10.4, 2, 2), Rb(14.2, 10.4, 2, 2), S("M2 22.4 Q4.5 20.9 7 22.4 T12 22.4 T17 22.4 T22 22.4", 1.4)],
      // штурвал
      [["circle", { cx: 12, cy: 12, r: 6.6, fill: "none", stroke: "c", "stroke-width": 2.2 }], C(12, 12, 2.3), S("M12 2 V9.7 M12 14.3 V22 M2 12 H9.7 M14.3 12 H22 M4.9 4.9 L9.9 9.9 M14.1 14.1 L19.1 19.1 M19.1 4.9 L14.1 9.9 M9.9 14.1 L4.9 19.1", 1.8)],
      // парусник у воды
      [P("M11.2 2.5 V14.8 H4.5Z"), P("M12.8 5 V14.8 H19.5Z"), P("M3.5 16.2 H20.5 L18 19.6 H6Z"), S("M2 22.4 Q4.5 20.9 7 22.4 T12 22.4 T17 22.4 T22 22.4", 1.4)],
    ] },
    { id: "cablecar", color: "#65a30d", ru: "Канатная дорога", en: "Cable car", de: "Seilbahn", fr: "Téléphérique", pl: "Kolejka linowa", pt: "Teleférico", cs: "Lanovka", glyphs: [
      // кабина на тросе
      [S("M1.5 5 L22.5 3.2", 1.5), S("M12 4.1 V8", 1.8), R(5.5, 8, 13, 11, 2.4), Rb(7.6, 10.2, 3.8, 4.2, 0.6), Rb(12.6, 10.2, 3.8, 4.2, 0.6)],
      // две кабины под наклоном
      [S("M1.5 9.5 L22.5 2.5", 1.5), S("M7 7.6 V11.2 M17 4.3 V7.9", 1.6), R(3.2, 11.2, 7.6, 6.6, 1.6), Rb(4.8, 12.8, 4.4, 2.2, 0.4), R(13.2, 7.9, 7.6, 6.6, 1.6), Rb(14.8, 9.5, 4.4, 2.2, 0.4)],
      // опора с тросом
      [S("M1.5 7.5 H22.5", 1.6), S("M12 4 L6.8 21.5 M12 4 L17.2 21.5 M9.6 12.5 H14.4 M8.2 17 H15.8", 1.8), C(12, 4, 2)],
    ] },
    { id: "townhall", color: "#a16207", ru: "Ратуша", en: "Town hall", de: "Rathaus", fr: "Hôtel de ville", pl: "Ratusz", pt: "Prefeitura", cs: "Radnice", glyphs: [
      // здание с часами
      [P("M8.2 4.8 L12 1.5 L15.8 4.8Z"), R(9.2, 4.8, 5.6, 6.4), R(3.5, 11, 17, 10.5, 0.8), Cb(12, 8, 1.8), Sb("M12 6.9 V8.1 L12.9 8.6", 0.9), Rb(10.4, 16, 3.2, 5.5, 1.5), Rb(5.6, 13.6, 2.8, 3.2, 0.4), Rb(15.6, 13.6, 2.8, 3.2, 0.4)],
      // здание с флагом
      [S("M12 6 V1.6", 1.2), P("M12 1.6 H17 V4.2 H12Z"), P("M2.2 10.2 L12 5.6 L21.8 10.2Z"), R(3.5, 10.6, 17, 10.9, 0.6), Rb(10.2, 15.6, 3.6, 5.9, 0.6), Rb(5.4, 13, 2.8, 3.2, 0.4), Rb(15.8, 13, 2.8, 3.2, 0.4)],
      // часовая башня
      [P("M7.4 7.8 L12 1.8 L16.6 7.8Z"), R(8.6, 7.6, 6.8, 13.4, 0.5), Cb(12, 11.8, 2.5), Sb("M12 10.2 V11.9 L13.3 12.6", 1), Rb(10.9, 16, 2.2, 5, 1), R(6.4, 20, 11.2, 2, 0.5)],
    ] },
    { id: "spawn", color: "#e11d48", ru: "Спавн", en: "Spawn", de: "Spawn", fr: "Spawn", pl: "Spawn", pt: "Spawn", cs: "Spawn", glyphs: [
      // метка на карте
      [P("M12 22 C6 15.4 4.4 12 4.4 9 A7.6 7.6 0 0 1 19.6 9 C19.6 12 18 15.4 12 22Z"), Cb(12, 9, 3.1)],
      // флаг
      [R(4.6, 2.2, 2.2, 19.6, 1), P("M6.8 3.4 H20.6 L17 8 L20.6 12.6 H6.8Z")],
      // портал
      [R(3.8, 2.4, 16.4, 19.2, 1.6), Rb(7.4, 5.8, 9.2, 12.4, 0.6), P("M12 7.6 L15 12 L12 16.4 L9 12Z")],
    ] },
    { id: "tram", color: "#c2410c", ru: "Трамвай", en: "Tram", de: "Straßenbahn", fr: "Tramway", pl: "Tramwaj", pt: "Elétrico", cs: "Tramvaj", glyphs: [
      // трамвай спереди с токоприёмником
      [S("M9 3 L12 0.8 L15 3", 1.4), R(5, 3.2, 14, 14.8, 3.6), Rb(7.2, 5.6, 9.6, 5.6, 1), Cb(8.6, 14.4, 1.3), Cb(15.4, 14.4, 1.3), R(6.5, 18, 3, 2.6, 0.8), R(14.5, 18, 3, 2.6, 0.8), S("M3 22.4 H21", 1.6)],
      // трамвай сбоку
      [S("M3 2.8 H21", 1.2), S("M9.4 7 L12 3.4 L14.6 7", 1.4), R(1.5, 7, 21, 10, 2.4), Rb(3.4, 9, 3.2, 3.8), Rb(8, 9, 3.2, 3.8), Rb(12.6, 9, 3.2, 3.8), Rb(17.2, 9, 3.2, 3.8), C(6.5, 18, 1.9), C(17.5, 18, 1.9), S("M1.5 21.6 H22.5", 1.6)],
      // знак остановки трамвая
      [["circle", { cx: 12, cy: 8.6, r: 6.8, fill: "none", stroke: "c", "stroke-width": 1.9 }], R(8.8, 5.2, 6.4, 7, 1.6), Rb(9.9, 6.4, 4.2, 2.6, 0.5), Cb(10.6, 10.6, 0.7), Cb(13.4, 10.6, 0.7), R(11, 15.4, 2, 6.6, 0.6), S("M7 22 H17", 1.6)],
    ] },
  ];

  const BY_ID = new Map(CATALOG.map((c) => [c.id, c]));
  const PLATES = ["none", "circle", "square"];
  const VARIANTS = 3;

  const hex = (v, d) => (typeof v === "string" && /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : d);
  const set = (el, attrs, c, b) => {
    for (const k of Object.keys(attrs)) {
      let v = attrs[k];
      if (v === "c") v = c;
      else if (v === "b") v = b;
      el.setAttribute(k, String(v));
    }
    return el;
  };

  /**
   * Рисует значок в группу g с центром (cx, cy) и размером size (px).
   * opts: { color, plate: none|circle|square, plateColor, bg }
   * Без плашки вырезы красятся цветом фона схемы (bg), на плашке — цветом плашки.
   */
  function draw(g, id, variant, cx, cy, size, opts) {
    opts = opts || {};
    const item = BY_ID.get(id) || CATALOG[0];
    const v = Math.max(0, Math.min(VARIANTS - 1, Math.round(Number(variant) || 0)));
    const plate = PLATES.includes(opts.plate) ? opts.plate : "none";
    const color = hex(opts.color, "#334155");
    const plateColor = hex(opts.plateColor, color);
    const bg = hex(opts.bg, "#ffffff");
    const s = Number.isFinite(Number(size)) ? Math.max(4, Math.min(400, Number(size))) : 24;
    const grp = document.createElementNS(NS, "g");
    const glyphScale = plate === "none" ? 1 : 0.62;
    const k = (s / 24);
    grp.setAttribute("transform", `translate(${cx - s / 2} ${cy - s / 2}) scale(${k})`);
    if (plate === "circle") {
      const r = document.createElementNS(NS, "circle");
      set(r, { cx: 12, cy: 12, r: 12, fill: plateColor }, color, bg);
      grp.appendChild(r);
    } else if (plate === "square") {
      const r = document.createElementNS(NS, "rect");
      set(r, { x: 0, y: 0, width: 24, height: 24, rx: 5.5, fill: plateColor }, color, bg);
      grp.appendChild(r);
    }
    const inner = document.createElementNS(NS, "g");
    const gc = plate === "none" ? color : "#ffffff";
    const gb = plate === "none" ? bg : plateColor;
    inner.setAttribute("transform", `translate(${12 - 12 * glyphScale} ${12 - 12 * glyphScale}) scale(${glyphScale})`);
    for (const [tag, attrs] of item.glyphs[v] || item.glyphs[0]) {
      inner.appendChild(set(document.createElementNS(NS, tag), attrs, gc, gb));
    }
    grp.appendChild(inner);
    g.appendChild(grp);
    return grp;
  }

  return { CATALOG, PLATES, VARIANTS, draw, has: (id) => BY_ID.has(id), colorOf: (id) => (BY_ID.get(id) || {}).color || "#334155" };
})();

if (typeof window !== "undefined") window.MapIcons = MapIcons;
