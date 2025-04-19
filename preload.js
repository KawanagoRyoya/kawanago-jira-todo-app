const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  fetchSprint: (sprintId) => ipcRenderer.invoke('fetch-jira-sprint', sprintId),
  syncToJira: (changes) => ipcRenderer.invoke('sync-to-jira', changes),
  generateReport: (type, todos) => ipcRenderer.invoke('generate-report', type, todos)
});