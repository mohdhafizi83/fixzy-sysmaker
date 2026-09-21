// src/js/saveManager.js (FINAL & STABLE VERSION)

import { appState, setAwaitingMenuGroupSave } from './state.js';
import { showToast } from './ui/toast.js';

let _refreshProjectDataCallback = null;

export const SaveManager = {
    queue: {},
    timeouts: {},

    init(loadDataFunction) {
        _refreshProjectDataCallback = loadDataFunction;
    },

async refreshState() {
        if (_refreshProjectDataCallback) {
            console.log("[SaveManager] Reloading project data...");
            await _refreshProjectDataCallback();
        } else {
            console.warn("[SaveManager] Refresh callback not initialized yet.");
        }
    },
    
    addToQueue(type, id, data) {
        if (!id) {
            console.error("[SaveManager] ERROR: Invalid ID.");
            return;
        }
        if (appState.isPopulatingData && type !== 'force_save') return;
        if (!appState.isAutoSaveEnabled && type !== 'force_save') return;

        // Auto-fix: Convert 'relationships' -> 'relationship'
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
            console.log(`[SaveManager] Processing: ${item.type} (ID: ${item.id})`);
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
// ▼▼▼ DIAGNOSTIC LOG (ADDED) ▼▼▼
                console.log("[SaveManager-DEBUG] Data received:", item.data);
                console.log("[SaveManager-DEBUG] Key list:", Object.keys(item.data));
                // ▲▲▲ END DIAGNOSTIC LOG ▲▲▲                
                result = await window.electronAPI.updateField({ 
                    field_id: item.id, 
                    ...item.data 
                });
console.log(item.data.hasOwnProperty('lookup_parent_table'));
// ▼▼▼ IMPROVED INTERCEPTOR (Single-Trigger) ▼▼▼
                const dataKeys = Object.keys(item.data);
                
                // WE ONLY MONITOR THIS ONE FIELD NOW
                const triggers = ['lookup_parent_table']; 
                
                const isRelationshipUpdate = dataKeys.some(key => triggers.includes(key));

                if (result && result.success && isRelationshipUpdate) {
                    console.log("[SaveManager] Parent Table change detected. Updating Relationship...");
                    
                    const fieldId = item.id;
                    const tables = appState.jsonData.database.table;
                    let childTableName = null;
                    let fkFieldName = null;
                    let currentFieldData = null;

                    for (const tName in tables) {
                        const fields = tables[tName].fields;
                        const targetField = Object.values(fields).find(f => f.field_id == fieldId);
                        if (targetField) {
                            childTableName = tName;
                            fkFieldName = targetField.field_name;
                            currentFieldData = targetField;
                            break;
                        }
                    }

                    if (childTableName && fkFieldName && currentFieldData) {
                        
                        // Take the value directly from item.data since we know the trigger is lookup_parent_table
                        const parentTable = item.data.lookup_parent_table;

                        console.log(`[SaveManager] Data -> Parent: ${parentTable}, Child: ${childTableName}.${fkFieldName}`);

                        if (parentTable) {
                            // UPSERT
                            console.log(`[SaveManager] Sending IPC Upsert...`);
                            const upsertResult = await window.electronAPI.upsertRelationship({
                                parentTableName: parentTable,
                                childTableName: childTableName,
                                fk_child_field: fkFieldName
                            });

                            if (upsertResult && upsertResult.success) {
                                console.log("[SaveManager] ✅ Upsert Relationship SUCCEEDED.");
                                showToast('Relationship updated successfully', 'success');
                            } else {
                                console.error("[SaveManager] ❌ Upsert FAILED:", upsertResult);
                                showToast('Failed to update relationship', 'error');
                            }

                        } else {
                            // DELETE (if the value is empty)
                            console.log(`[SaveManager] Trigger Delete...`);
                            await window.electronAPI.deleteRelationship({
                                childTableName: childTableName,
                                fk_child_field: fkFieldName
                            });
                        }
                    }
                }
                // ▲▲▲ END INTERCEPTOR ▲▲▲
            } 
            // 4. MENU GROUP
            else if (item.type === 'menu_group') {
                setAwaitingMenuGroupSave(true);
                result = await window.electronAPI.updateMenuGroup(item.id, item.data);
                setAwaitingMenuGroupSave(false);
            }
            // 5. RELATIONSHIP (accepts singular & plural)
            else if (item.type === 'relationship' || item.type === 'relationships') {
                // Make sure this function exists in preload.js!
                if (!window.electronAPI.updateRelationship) {
                    console.error("[SaveManager] Error: window.electronAPI.updateRelationship is missing!");
                    throw new Error("Missing preload bridge for relationship");
                }

                result = await window.electronAPI.updateRelationship({ 
                    relationship_id: item.id, 
                    ...item.data 
                });
            }
// 6. UPSERT RELATIONSHIP (Create or Update Parent Table)
            else if (item.type === 'upsertRelationship') {
                 result = await window.electronAPI.upsertRelationship(item.data);
            }

            // 7. DELETE RELATIONSHIP (Remove Lookup)
            else if (item.type === 'deleteRelationship') {
                 result = await window.electronAPI.deleteRelationship(item.data);
            }
            
            // ▲▲▲ END ADDITIONS ▲▲▲

            // 8. IF NOTHING MATCHES (original else converted to the final else)
            else {
                console.error(`[SaveManager] UNKNOWN TYPE: ${item.type}`);
                showToast(`Error: Unknown save type '${item.type}'`, 'error');
                return;
            }

            // UPDATE STATE (Without reload)
            if (result && result.success) {
                console.log(`[SaveManager] ✅ Saved: ${key}`);
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
                // Detailed error log
                console.error(`[SaveManager] ❌ Failed to save ${key}. Result:`, result);
                if (result === undefined) {
                    console.warn("TIP: Result is 'undefined'. Please check your 'src/preload.js' file. Did you forget a 'return'?");
                }
                showToast('Failed to save changes', 'error');
            }

        } catch (error) {
            console.error(`[SaveManager] System Error:`, error);
            showToast('System Error', 'error');
        }
    }
};