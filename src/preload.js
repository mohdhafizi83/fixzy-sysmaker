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
  updateFieldIndex: (data) => ipcRenderer.invoke('field:update-index', data),
  updateRelationship: (data) => ipcRenderer.invoke('relationship:update', data),
  upsertRelationship: (data) => ipcRenderer.invoke('relationship:upsert', data),
  
  saveAllSettings: (data) => ipcRenderer.invoke('settings:save-all', data),
  saveMenuStructure: (data) => ipcRenderer.invoke('menu:save-structure', data),
  batchUpdate: (queueData) => ipcRenderer.invoke('database:batch-update', queueData),
  saveUnifiedMenu: (data) => ipcRenderer.invoke('menu:save-unified-structure', data),
  menuCreateGroup: (data) => ipcRenderer.invoke('menu:create-group', data),
  menuDeleteGroup: (data) => ipcRenderer.invoke('menu:delete-group', data),
saveCustomMenuItem: (data) => ipcRenderer.invoke('menu:save-custom-item', data),
updateIndividualMenuOrder: (data) => ipcRenderer.invoke('menu:update-individual-order', data),
  updateMenuOrder: (data) => ipcRenderer.invoke('menu:update-order', data),
  getAllSettings: () => ipcRenderer.invoke('settings:get-all'),
// --- VALIDATION HANDLERS ---
  getFieldValidations: (columnId) => ipcRenderer.invoke('get-field-validations', columnId),
  saveFieldValidations: (data) => ipcRenderer.invoke('save-field-validations', data),
  getFullSchema: (projectId) => ipcRenderer.invoke('project:get-full-schema', projectId),
  // Fungsi sedia ada
  getTablesByProject: (projectId) => ipcRenderer.invoke('tables:get-by-project', projectId),
  importSqlFile: (data) => ipcRenderer.invoke('sql:import-file', data),
  importSqlText: (data) => ipcRenderer.invoke('sql:import-text', data),
  getInitialProjectStatus: (projectId) => ipcRenderer.invoke('project:get-initial-status', projectId),
  deleteProjectSchema: (projectId) => ipcRenderer.invoke('project:delete-schema', projectId),
  onShowOverlay: (callback) => ipcRenderer.on('show-overlay', (event) => callback()),
  parseCalculationQuery: (sql) => ipcRenderer.invoke('sql:parse-calculation-query', sql),

  saveCustomView: (data) => ipcRenderer.invoke('custom-view:save', data),
  deleteCustomView: (viewId) => ipcRenderer.invoke('custom-view:delete', viewId),

  saveTableConstraint: (data) => ipcRenderer.invoke('table:save-constraint', data),
  deleteTableConstraint: (data) => ipcRenderer.invoke('table:delete-constraint', data),

  onShowCustomDialog: (callback) => ipcRenderer.on('show-custom-dialog', (event, options) => callback(options)),
  sendCustomDialogResponse: (response) => ipcRenderer.send('custom-dialog-response', response),

// =================================================================
// Generator functions will be put here
// =================================================================  
    generateApp: () => ipcRenderer.invoke('generate-app'),
    openFolder: (path) => ipcRenderer.send('open-folder', path),
	runComposer: (projectPath) => ipcRenderer.invoke('run-composer', projectPath)
});