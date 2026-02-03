// src/js/saveManager.js (VERSI FINAL & STABIL)

import { appState, setAwaitingMenuGroupSave } from './state.js';
import { showToast } from './ui/toast.js';

let _refreshProjectDataCallback = null;

export const SaveManager = {
    queue: {},
    timeouts: {},

    init(loadDataFunction) {
        _refreshProjectDataCallback = loadDataFunction;
    },

    addToQueue(type, id, data) {
        if (!id) {
            console.error("[SaveManager] RALAT: ID tidak sah.");
            return;
        }
        if (appState.isPopulatingData && type !== 'force_save') return;
        if (!appState.isAutoSaveEnabled && type !== 'force_save') return;

        // Auto-fix: Tukar 'relationships' -> 'relationship'
        if (type === 'relationships') type = 'relationship';
        
        const key = `${type}_${id}`;

        if (!this.queue[key]) {
            this.queue[key] = { type, id, data: {} };
        }

        Object.assign(this.queue[key].data, data);

        if (this.timeouts[key]) {
            clearTimeout(this.timeouts[key]);
        }

        this.timeouts[key] = setTimeout(() => {
            this.processQueue(key);
        }, 500);
    },

    async processQueue(key) {
        const item = this.queue[key];
        if (!item) return;

        delete this.queue[key];
        delete this.timeouts[key];

        try {
            console.log(`[SaveManager] Memproses: ${item.type} (ID: ${item.id})`);
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
            // 5. RELATIONSHIP (Terima singular & plural)
            else if (item.type === 'relationship' || item.type === 'relationships') {
                // Pastikan fungsi ini wujud dalam preload.js!
                if (!window.electronAPI.updateRelationship) {
                    console.error("[SaveManager] Ralat: window.electronAPI.updateRelationship tiada!");
                    throw new Error("Missing preload bridge for relationship");
                }

                result = await window.electronAPI.updateRelationship({ 
                    relationship_id: item.id, 
                    ...item.data 
                });
            }
            // 6. JIKA TIADA YANG PADAN
            else {
                console.error(`[SaveManager] JENIS TIDAK DIKENALI: ${item.type}`);
                showToast(`Error: Unknown save type '${item.type}'`, 'error');
                return;
            }

            // KEMAS KINI STATE (Tanpa Reload)
            if (result && result.success) {
                console.log(`[SaveManager] ✅ Disimpan: ${key}`);
                showToast('Changes saved successfully', 'success');

                // Update Local State Logic
                if (item.type.includes('table')) {
                    const tables = appState.jsonData.database.table;
                    const tableName = Object.keys(tables).find(name => tables[name].table_id == item.id);
                    if (tableName) Object.assign(tables[tableName], item.data);
                }
                else if (item.type.includes('field')) {
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
                else if (item.type.includes('relationship')) {
                     if (appState.jsonData.database.relationships) {
                         const targetRel = appState.jsonData.database.relationships.find(r => r.relationship_id == item.id);
                         if (targetRel) Object.assign(targetRel, item.data);
                     }
                }

            } else {
                // Log Ralat Terperinci
                console.error(`[SaveManager] ❌ Gagal Simpan ${key}. Result:`, result);
                if (result === undefined) {
                    console.warn("TIP: Result adalah 'undefined'. Sila semak fail 'src/preload.js' anda. Adakah anda tertinggal 'return'?");
                }
                showToast('Failed to save changes', 'error');
            }

        } catch (error) {
            console.error(`[SaveManager] Ralat Sistem:`, error);
            showToast('System Error', 'error');
        }
    }
};