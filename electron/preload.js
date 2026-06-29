"use strict";

const { contextBridge, ipcRenderer } = require("electron");

// Экспортируем минимальный API для renderer процесса
contextBridge.exposeInMainWorld("electronAPI", {
  // Синхронная отправка prefs при закрытии окна
  savePrefsSync: (payload) => ipcRenderer.send("save-prefs-sync", payload),
  onChangelog: (cb) => ipcRenderer.on("show-changelog", (_, data) => cb(data)),
});
