"use strict";

const { contextBridge, ipcRenderer } = require("electron");

// Экспортируем минимальный API для renderer процесса
contextBridge.exposeInMainWorld("electronAPI", {
  // Синхронная отправка prefs при закрытии окна
  savePrefsSync: (payload) => ipcRenderer.send("save-prefs-sync", payload),
  onChangelog: (cb) => ipcRenderer.on("show-changelog", (_, data) => cb(data)),
  // Развернуть/сфокусировать окно приложения (клик по уведомлению)
  focusWindow: () => ipcRenderer.send("focus-window"),
  // Переключить канал обновлений (бета/стабильный) без перезапуска
  setBetaUpdates: (enabled) => ipcRenderer.send("set-beta-updates", !!enabled),
  // Сохранить диагностический отчёт через нативный диалог «Сохранить как».
  // Возвращает { saved:true, path } | { canceled:true } | { error }.
  saveDiagnostic: (filename, content) => ipcRenderer.invoke("save-diagnostic", { filename, content }),
  // Цвета своей панели заголовка окна { bg, fg, muted, accent } (#hex)
  setTitlebarTheme: (theme) => ipcRenderer.send("set-titlebar-theme", theme),
});
