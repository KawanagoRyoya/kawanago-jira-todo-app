const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
  store: { get: key => ipcRenderer.sendSync('electron-store-get', key), set: (k,v) => ipcRenderer.send('electron-store-set', k, v) },
  fetchSprint: sprintId => ipcRenderer.invoke('fetch-jira-sprint', sprintId),
  syncToJira: changes => ipcRenderer.invoke('sync-to-jira', changes),
  generateReport: (type, todos) => ipcRenderer.invoke('generate-report', type, todos)
});