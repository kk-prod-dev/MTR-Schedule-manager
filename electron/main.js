"use strict";

const path = require("path");
const { app, BrowserWindow, Menu, shell, dialog } = require("electron");

// ---------------------------------------------------------------------------
// Подготовка окружения ДО запуска сервера.
// Сервер (../server.js) читает config.js, который смотрит на эти переменные.
// ---------------------------------------------------------------------------

// Данные пишем в userData (это writable-каталог пользователя), а не рядом с
// кодом — внутри установленного приложения исходники доступны только на чтение.
const dataDir = path.join(app.getPath("userData"), "data");
process.env.MTR_DATA_DIR = dataDir;

// PORT=0 → ОС сама выберет свободный порт, конфликтов с чужими процессами нет.
if (process.env.PORT === undefined) {
  process.env.PORT = "0";
}

const isDev = !app.isPackaged;

let mainWindow = null;
let serverPort = null;
let serverInstance = null;

// ---------------------------------------------------------------------------
// Один экземпляр приложения. Повторный запуск просто поднимает существующее окно.
// ---------------------------------------------------------------------------
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  app.whenReady().then(onReady).catch(fatal);
}

// ---------------------------------------------------------------------------
// Запуск
// ---------------------------------------------------------------------------
function onReady() {
  Menu.setApplicationMenu(null); // убрано по запросу (пункт 3)
  createWindow();
  startServer();
  if (!isDev) {
    // Проверка обновлений не должна ронять приложение, если что-то не настроено.
    setTimeout(() => initAutoUpdate(), 3000);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 940,
    minHeight: 600,
    backgroundColor: "#0f1419",
    show: false,
    icon: resolveIcon(),
    title: "MTR Schedule Manager",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());
  // Временно: открыть DevTools по F12
  mainWindow.webContents.on("before-input-event", (event, input) => {
  if (input.key === "F12") mainWindow.webContents.openDevTools();
  });

  // Пока сервер поднимается — показываем заставку.
  mainWindow.loadFile(path.join(__dirname, "loading.html"));

  // Внешние ссылки открываем в системном браузере, а не внутри окна.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Поднимаем Express-сервер прямо внутри процесса Electron (Node встроен).
function startServer() {
  try {
    const mod = require("../server");
    serverInstance = mod.server;

    const onListening = () => {
      serverPort = serverInstance.address().port;
      loadApp();
    };

    if (serverInstance.listening) {
      onListening();
    } else {
      serverInstance.once("listening", onListening);
    }

    serverInstance.on("error", (err) => {
      showError("Не удалось запустить локальный сервер", err.message);
    });
  } catch (err) {
    showError("Ошибка при инициализации сервера", err.stack || err.message);
  }
}

async function loadApp() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const url = `http://127.0.0.1:${serverPort}/`;
  // Ждём реального ответа от сервера (до 10 сек) вместо слепой задержки.
  // Так страница открывается только когда Express точно готов отдавать данные.
  const http = require("http");
  const ready = await new Promise((resolve) => {
    let attempts = 0;
    const check = () => {
      if (!mainWindow || mainWindow.isDestroyed()) { resolve(false); return; }
      http.get(`http://127.0.0.1:${serverPort}/api/status`, (res) => {
        res.resume();
        if (res.statusCode === 200) { resolve(true); }
        else { retry(); }
      }).on("error", retry);
    };
    const retry = () => {
      attempts++;
      if (attempts >= 20) { resolve(false); return; } // таймаут 10 сек
      setTimeout(check, 500);
    };
    check();
  });
  if (!mainWindow || mainWindow.isDestroyed()) return;
  // Минимальная пауза чтобы пользователь увидел заставку
  if (ready) await new Promise((r) => setTimeout(r, 200));
  mainWindow.loadURL(url);
}

// ---------------------------------------------------------------------------
// Авто-обновление (electron-updater + GitHub Releases).
// Активно только в собранном приложении и при наличии настроенного publish.
// ---------------------------------------------------------------------------
function initAutoUpdate() {
  let autoUpdater;
  try {
    ({ autoUpdater } = require("electron-updater"));
  } catch {
    return; // зависимость не установлена — тихо пропускаем
  }

  autoUpdater.autoDownload = true;
  autoUpdater.on("update-downloaded", (info) => {
    const res = dialog.showMessageBoxSync(mainWindow, {
      type: "info",
      buttons: ["Перезапустить сейчас", "Позже"],
      defaultId: 0,
      title: "Доступно обновление",
      message: `Загружена новая версия ${info.version}.`,
      detail: "Перезапустите приложение, чтобы установить обновление.",
    });
    if (res === 0) autoUpdater.quitAndInstall();
  });
  autoUpdater.on("error", (err) => {
    // Молча логируем: отсутствие релизов/сети не должно мешать работе.
    console.warn("[updater]", err == null ? "unknown" : err.message);
  });

  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    console.warn("[updater] check failed:", err.message);
  });
}

// ---------------------------------------------------------------------------
// Меню
// ---------------------------------------------------------------------------
function buildMenu() {
  const template = [
    {
      label: "Файл",
      submenu: [{ role: "quit", label: "Выход" }],
    },
    {
      label: "Вид",
      submenu: [
        { role: "reload", label: "Обновить" },
        { role: "forceReload", label: "Принудительно обновить" },
        { type: "separator" },
        { role: "resetZoom", label: "Сбросить масштаб" },
        { role: "zoomIn", label: "Увеличить" },
        { role: "zoomOut", label: "Уменьшить" },
        { type: "separator" },
        { role: "togglefullscreen", label: "Полный экран" },
        ...(isDev ? [{ role: "toggleDevTools", label: "Инструменты разработчика" }] : []),
      ],
    },
    {
      label: "Справка",
      submenu: [
        {
          label: "Проверить обновления",
          click: () => initAutoUpdate(),
        },
        {
          label: "Папка с данными",
          click: () => shell.openPath(dataDir),
        },
        { type: "separator" },
        {
          label: "О приложении",
          click: () =>
            dialog.showMessageBox(mainWindow, {
              type: "info",
              title: "О приложении",
              message: "GeoRail — управление расписанием",
              detail: `Версия ${app.getVersion()}\nElectron ${process.versions.electron}\nNode ${process.versions.node}`,
            }),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------------------------------------------------------------------------
// Вспомогательное
// ---------------------------------------------------------------------------
function resolveIcon() {
  // .ico на Windows, .png на Linux. На macOS иконку берёт сборщик из icns.
  const file = process.platform === "win32" ? "icon.ico" : "icon.png";
  return path.join(__dirname, "..", "build", file);
}

function showError(title, detail) {
  console.error(title, detail);
  if (mainWindow && !mainWindow.isDestroyed()) {
    dialog.showMessageBox(mainWindow, { type: "error", title, message: title, detail });
  } else {
    dialog.showErrorBox(title, detail || "");
  }
}

function fatal(err) {
  dialog.showErrorBox("Критическая ошибка", (err && (err.stack || err.message)) || String(err));
  app.quit();
}

// ---------------------------------------------------------------------------
// Жизненный цикл окна
// ---------------------------------------------------------------------------
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
    if (serverPort) loadApp();
  }
});
