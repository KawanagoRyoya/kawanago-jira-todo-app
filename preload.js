const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
  store: {
  get: (key) => ipcRenderer.invoke('electron-store-get', key),
  set: (key, v) => ipcRenderer.invoke('electron-store-set', key, v)
},
  fetchSprint:   (id) => ipcRenderer.invoke('fetch-jira-sprint', id),
  syncToJira:    (data) => ipcRenderer.invoke('sync-to-jira', data),
  generateReport:(type,todos) => ipcRenderer.invoke('generate-report', type, todos),
  copyText:      (text) => ipcRenderer.invoke('copy-to-clipboard', text) // ★追加
});