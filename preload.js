// preload.js

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openUrl: (url) => ipcRenderer.invoke('open-url', url),
  getActiveProject: () => ipcRenderer.invoke('project:get-active'),
  createProject: (projectName) => ipcRenderer.invoke('project:create', projectName),
  createTable: (projectId) => ipcRenderer.invoke('table:create', projectId),
  createField: (tableId) => ipcRenderer.invoke('field:create', tableId),
  deleteTables: (data) => ipcRenderer.invoke('table:delete', data),
  deleteField: (data) => ipcRenderer.invoke('field:delete', data),
  
	updateFieldOrder: (orderData) => ipcRenderer.invoke('field:update-order', orderData),
	updateTableOrder: (orderData) => ipcRenderer.invoke('table:update-order', orderData),
	
  getAllProjects: () => ipcRenderer.invoke('projects:get-all'),
  setActiveProject: (projectId) => ipcRenderer.invoke('project:set-active', projectId),
  updateProject: (data) => ipcRenderer.invoke('project:update', data),
  updateTable: (data) => ipcRenderer.invoke('table:update', data),
  updateField: (data) => ipcRenderer.invoke('field:update', data),
  updateRelationship: (data) => ipcRenderer.invoke('relationship:update', data),
  upsertRelationship: (data) => ipcRenderer.invoke('relationship:upsert', data),
  
  saveAllSettings: (data) => ipcRenderer.invoke('settings:save-all', data),
  saveMenuStructure: (data) => ipcRenderer.invoke('menu:save-structure', data),
  batchUpdate: (queueData) => ipcRenderer.invoke('database:batch-update', queueData),

  updateMenuOrder: (data) => ipcRenderer.invoke('menu:update-order', data),
  getAllSettings: () => ipcRenderer.invoke('settings:get-all'),
  getFullSchema: (projectId) => ipcRenderer.invoke('project:get-full-schema', projectId),
  // Fungsi sedia ada
  getTablesByProject: (projectId) => ipcRenderer.invoke('tables:get-by-project', projectId),
  importSqlFile: (projectId) => ipcRenderer.invoke('sql:import-file', projectId),
  importSqlText: (data) => ipcRenderer.invoke('sql:import-text', data),
  checkTablesExist: (projectId) => ipcRenderer.invoke('tables:check-exists', projectId),
  deleteProjectSchema: (projectId) => ipcRenderer.invoke('project:delete-schema', projectId),
  onShowOverlay: (callback) => ipcRenderer.on('show-overlay', (event) => callback()),
  parseCalculationQuery: (sql) => ipcRenderer.invoke('sql:parse-calculation-query', sql),
});