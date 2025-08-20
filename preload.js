// preload.js

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openUrl: (url) => ipcRenderer.invoke('open-url', url),
  getActiveProject: () => ipcRenderer.invoke('project:get-active'),
  createProject: (projectName) => ipcRenderer.invoke('project:create', projectName),
  // ▼▼▼ TAMBAH FUNGSI BAHARU INI ▼▼▼
  getAllSettings: () => ipcRenderer.invoke('settings:get-all'),
  getFullSchema: (projectId) => ipcRenderer.invoke('project:get-full-schema', projectId),
  // Fungsi sedia ada
  getTablesByProject: (projectId) => ipcRenderer.invoke('tables:get-by-project', projectId),
  importSqlFile: (projectId) => ipcRenderer.invoke('sql:import-file', projectId),
  importSqlText: (data) => ipcRenderer.invoke('sql:import-text', data),
  checkTablesExist: (projectId) => ipcRenderer.invoke('tables:check-exists', projectId),
  deleteProjectSchema: (projectId) => ipcRenderer.invoke('project:delete-schema', projectId),
});