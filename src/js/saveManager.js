// src/js/saveManager.js

import { appState, setAwaitingMenuGroupSave } from './state.js';
// ▼▼▼ IMPORT BAHARU ▼▼▼
import { showToast } from './ui/toast.js'; 

let _refreshProjectDataCallback = null;

export const SaveManager = {
    queue: {},
    timeouts: {},

    init(loadDataFunction) {
        // console.log("[SaveManager] Init dipanggil.");
        _refreshProjectDataCallback = loadDataFunction;
    },

    addToQueue(type, id, data) {
        // Semakan Keselamatan
        if (!id) {
            console.error("[SaveManager] RALAT: ID tidak sah.");
            return;
        }
        if (appState.isPopulatingData && type !== 'force_save') return;
        if (!appState.isAutoSaveEnabled && type !== 'force_save') return;

        const key = `${type}_${id}`;

        if (!this.queue[key]) {
            this.queue[key] = { type, id, data: {} };
        }

        Object.assign(this.queue[key].data, data);

        if (this.timeouts[key]) {
            clearTimeout(this.timeouts[key]);
        }

        // Delay debounce
        const delay = 500;

        this.timeouts[key] = setTimeout(() => {
            this.processQueue(key);
        }, delay);
    },

    async processQueue(key) {
        const item = this.queue[key];
        if (!item) return;

        delete this.queue[key];
        delete this.timeouts[key];

        // Opsyenal: Tunjuk toast "Saving..." jika mahu
        // showToast('Saving...', 'info');

        try {
            let result;

            // 1. PROJECT
            if (item.type === 'project' || item.type === 'projects') {
                result = await window.electronAPI.updateProject({ 
                    project_id: item.id, 
                    ...item.data 
                });
            } 
            // 2. TABLE
            else if (item.type === 'table' || item.type === 'tables') {
                result = await window.electronAPI.updateTable({ 
                    table_id: item.id, 
                    ...item.data 
                });
            } 
            // 3. FIELD
            else if (item.type === 'field' || item.type === 'fields') {
                result = await window.electronAPI.updateField({ 
                    field_id: item.id, 
                    ...item.data 
                });
            } 
            // 4. MENU GROUP
            else if (item.type === 'menu_group') {
                setAwaitingMenuGroupSave(true);
                result = await window.electronAPI.updateMenuGroup(item.id, item.data);
                setAwaitingMenuGroupSave(false);
            }

            // KEMAS KINI STATE & NOTIFIKASI
            if (result && result.success) {
                console.log(`[SaveManager] Disimpan: ${key}`);

                // ▼▼▼ PANGGIL NOTIFIKASI KEJAYAAN ▼▼▼
                showToast('Changes saved successfully', 'success');

                // Update Local State (Logik Fasa 2)
                if (item.type === 'table' || item.type === 'tables') {
                    const tables = appState.jsonData.database.table;
                    const tableName = Object.keys(tables).find(name => tables[name].table_id == item.id);
                    if (tableName) Object.assign(tables[tableName], item.data);
                }
                else if (item.type === 'field' || item.type === 'fields') {
                    const tables = appState.jsonData.database.table;
                    for (const tName in tables) {
                        const fields = tables[tName].fields;
                        const fieldName = Object.keys(fields).find(fName => fields[fName].field_id == item.id);
                        if (fieldName) {
                            Object.assign(fields[fieldName], item.data);
                            break; 
                        }
                    }
                }
                else if (item.type === 'project' || item.type === 'projects') {
                   if (appState.activeProject && appState.activeProject.project_id == item.id) {
                       Object.assign(appState.activeProject, item.data);
                   }
                }

            } else {
                console.error(`[SaveManager] Gagal:`, result ? result.message : 'Unknown Error');
                
                // ▼▼▼ PANGGIL NOTIFIKASI RALAT ▼▼▼
                showToast('Failed to save changes', 'error');
            }

        } catch (error) {
            console.error(`[SaveManager] Ralat Sistem:`, error);
            // ▼▼▼ PANGGIL NOTIFIKASI RALAT SISTEM ▼▼▼
            showToast('System Error: Could not save', 'error');
        }
    }
};