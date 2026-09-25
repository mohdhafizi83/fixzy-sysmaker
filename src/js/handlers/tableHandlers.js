// src/js/handlers/tableHandlers.js

import { appState } from '../state.js';
import { SaveManager } from '../saveManager.js';
import { showCustomDialog } from '../ui/modalHandlers.js';
import { showToast } from '../ui/toast.js';
import { setElementValue, setRadioValue } from '../ui/formHelpers.js';
import { populateTableSettings } from '../pages/tableSettings.js';
import { populateFieldSettings } from '../pages/fieldSettings.js';
import { populateMenuManagement } from './menuHandlers.js';
import { loadProjectData } from '../../renderer.js';

export function initializeTableSaveHandlers() {
    // Collect both the old and new containers
    const containers = [
        document.getElementById('table-settings-page'),
        document.getElementById('module-global-settings') // NEW PHASE 3A SITE
    ];

    containers.forEach(container => {
        if (!container) return;

        ['change', 'focusout'].forEach(eventType => {
            container.addEventListener(eventType, (e) => {
                const input = e.target;
                
                // Ignore parent-child inputs
                if (input.closest('#parent-child-settings')) return;
                if (input.id && input.id.startsWith('parentchild-')) return;
                
// ▼▼▼ MAJOR BUG FIX: PREVENT OVERWRITE WHEN IN CUSTOM/CREATE MODE ▼▼▼
                const badgeEl = document.getElementById('workspace-module-badge');
                const titleEl = document.getElementById('workspace-module-title');
                const isCustomMode = badgeEl && badgeEl.classList.contains('badge-custom');
                const isCreateMode = titleEl && titleEl.textContent === "Create New Module";
                
                if (isCustomMode || isCreateMode) {
                    // If this is a Custom Module, do NOT save to the original table!
                    // The Custom Module auto-save system will handle it.
                    return; 
                }
                // ▲▲▲ END FIX ▲▲▲

                if (eventType === 'focusout' && !['text', 'textarea', 'number'].includes(input.type) && input.tagName !== 'TEXTAREA') return;
                if (eventType === 'change' && ['text', 'textarea', 'number'].includes(input.type) && input.tagName !== 'TEXTAREA') return;
                if (!['INPUT', 'SELECT', 'TEXTAREA'].includes(input.tagName)) return;
                if (input.type === 'search') return;

                if (appState.isPopulatingData || !appState.isAutoSaveEnabled) return;

                // ==========================================
                // IDENTIFY THE CONTEXT (DEFAULT OR CUSTOM)
                // ==========================================
                let tableName = '';
                const titleElWorkspace = document.getElementById('workspace-module-title');
                const isWorkspaceActive = !document.getElementById('module-global-settings').classList.contains('hidden');
                
                if (isWorkspaceActive) {
                    // If editing from Modules Setup
                    tableName = titleElWorkspace.dataset.tableName;
                } else {
                    // If editing from the old Models Design
                    const titleElTable = document.querySelector('#table-settings-page .table-name');
                    if (!titleElTable) return;
                    tableName = titleElTable.textContent.trim();
                }

                const tableData = appState.jsonData.database.table[tableName];
                if (!tableData) return;
                const tableId = tableData.table_id;

                let key = '';
                if (input.type === 'radio') {
                    key = input.name.replace('tbl-', '').replace(/-/g, '_');
                } else {
                    key = input.id.replace('tbl-', '').replace(/-/g, '_');
                }

                let value;
                if (input.type === 'checkbox') value = input.checked ? 1 : 0;
                else if (input.type === 'radio') {
                    if (!input.checked) return;
                    value = input.value;
                } else value = input.value;

                // ==========================================
                // DATA SAVE ROUTING
                // ==========================================
                const badgeText = document.getElementById('workspace-module-badge')?.textContent;
                const isCustomModule = isWorkspaceActive && badgeText === 'Custom';

if (isCustomModule) {
                    const moduleId = parseInt(titleElWorkspace.dataset.moduleId);
                    
                    // 1. Get the module data from AppState
                    const tableData = appState.jsonData.database.table[tableName];
                    const moduleIndex = tableData.custom_modules.findIndex(m => m.module_id === moduleId);
                    
                    if (moduleIndex === -1) return;

                    // 2. Parse the existing override JSON (table level)
                    let currentSettings = {};
                    try {
                        // Make sure settings_override exists in the object, otherwise leave it empty
                        const existingJson = tableData.custom_modules[moduleIndex].settings_override || "{}";
                        currentSettings = JSON.parse(existingJson);
                    } catch (e) {
                        currentSettings = {};
                    }

                    // 3. Update the value
                    currentSettings[key] = value;
                    const jsonString = JSON.stringify(currentSettings);

                    // 4. Save to AppState (RAM) so the UI stays responsive
                    tableData.custom_modules[moduleIndex].settings_override = jsonString;

                    console.log(`[CUSTOM MODULE] Saving Table Override -> Module ID: ${moduleId} | ${key}: ${value}`);

                    // 5. Send to the backend (database)
                    window.electronAPI.saveCustomTableOverride({
                        module_id: moduleId,
                        settings_override: jsonString
                    }).then(res => {
                        if (!res.success) {
                            console.error("Failed to save table override:", res.message);
                            // Optional: show an error toast
                        }
                    });

                    } else {
                    // ... (the original Default Module code stays here) ...
                    console.log(`[DEFAULT MODULE] Saving -> Table: ${tableName} | ${key}: ${value}`);
                    SaveManager.addToQueue('table', tableId, { [key]: value });

// ▼▼▼ MEMORY & UI SYNCHRONIZATION (SILENT RELOAD) ▼▼▼
                    // FIX: use 'focusout' because text inputs are ignored on 'change'
                    if (eventType === 'focusout' && key === 'table_name') {
                        const oldName = tableName;
                        const newName = value;
                        
                        console.log(`[Silent Reload] Updating Table: ${oldName} -> ${newName} (ID: ${tableId})`);
                        
                        // 1. Update the key in AppState
                        if (appState.jsonData.database.table[oldName]) {
                            appState.jsonData.database.table[newName] = appState.jsonData.database.table[oldName];
                            appState.jsonData.database.table[newName].table_name = newName;
                            delete appState.jsonData.database.table[oldName];
                        }
                        
                        // Update the allTableNames array
                        const tIdx = appState.allTableNames?.indexOf(oldName);
                        if (tIdx !== -1 && tIdx !== undefined) appState.allTableNames[tIdx] = newName;

                        // 2. Update the Sidebar UI precisely using data-table-id
                        const tableSpan = document.querySelector(`li[data-table-id="${tableId}"] > a > span`);
                        if (tableSpan) {
                            tableSpan.textContent = newName;
                            tableSpan.parentElement.title = `Table Name: ${newName}`; 
                        }

                        // 3. Update the breadcrumb & workspace title
                        const titleTable = document.querySelector('#table-settings-page .table-name');
                        if (titleTable) titleTable.textContent = newName;
                        
                        if (titleElWorkspace && titleElWorkspace.dataset.tableName === oldName) {
                            titleElWorkspace.textContent = newName;
                            titleElWorkspace.dataset.tableName = newName;
                        }
                    }
                    // ▲▲▲ END SYNCHRONIZATION ▲▲▲
                }
            });
        });
    });
}

export function initializeRelationshipSaveHandlers() {
    console.log("🛠️ Relationship Handlers: Init called."); 

    // ▼▼▼ UPDATE 1: Listen in both UI areas ▼▼▼
    const containers = [
        document.getElementById('table-settings-page'),
        document.getElementById('module-global-settings') // NEW PHASE 3A UI
    ];
    
    containers.forEach(container => {
        if (!container) return;

        ['change', 'focusout'].forEach(eventType => {
            container.addEventListener(eventType, (e) => {
                const input = e.target;
                const inputId = input.id || '';

                if (!inputId.startsWith('parentchild-')) return;

                console.log(`🔥 '${eventType}' event detected on Relationship input: ${inputId}`);

                if (eventType === 'focusout' && !['text', 'textarea', 'number'].includes(input.type)) return;
                if (eventType === 'change' && ['text', 'textarea', 'number'].includes(input.type)) return;
                
                if (appState.isPopulatingData) {
                    console.warn("Save blocked: isPopulatingData = true");
                    return;
                }

                // ▼▼▼ UPDATE 2: Get the Parent Table Name from the correct DOM ▼▼▼
                let currentTableName = '';
                const titleElWorkspace = document.getElementById('workspace-module-title');
                const isWorkspaceActive = !document.getElementById('module-global-settings').classList.contains('hidden');
                
                if (isWorkspaceActive && titleElWorkspace) {
                    currentTableName = titleElWorkspace.dataset.tableName;
                } else {
                    currentTableName = document.querySelector('#table-settings-page .table-name')?.textContent.trim();
                }
                // ▲▲▲ END UPDATE 2 ▲▲▲
                
                let childTableName = null;
                const activeTab = document.querySelector('#child-table-list li.active');
                if (activeTab) {
                    childTableName = activeTab.dataset.childName || activeTab.getAttribute('data-child-name');
                }
                
                if (!childTableName) {
                    const hiddenChildInput = document.getElementById('current-active-child-table');
                    if (hiddenChildInput) childTableName = hiddenChildInput.value;
                }

                console.log(`Info: Parent=[${currentTableName}], Child=[${childTableName}]`);

                if (!currentTableName || !childTableName) {
                    console.error("❌ Failed to detect the active parent or child table.");
                    return;
                }

                const relData = appState.jsonData.database.relationships.find(
                    r => r.parent_table_name === currentTableName && r.child_table_name === childTableName
                );

                if (!relData) {
                    console.error("❌ No Relationship data in AppState for this pair.");
                    return;
                }

              let key = inputId.replace('parentchild-', '').replace(/-/g, '_');
                if (key === 'display_type_select') key = 'display_type';

                let value;
                if (input.type === 'checkbox') value = input.checked ? 1 : 0;
                else value = input.value;

                // ▼▼▼ ROUTING: CUSTOM MODULE VS DEFAULT MODULE ▼▼▼
                const badgeText = document.getElementById('workspace-module-badge')?.textContent;
                const isCustomModule = isWorkspaceActive && badgeText === 'Custom';
                const isCreateMode = isWorkspaceActive && titleElWorkspace.textContent === "Create New Module";

                if (isCreateMode) {
                    showCustomDialog({ title: "Info", message: "Please save (Create) the module first before assigning Relation Managers." });
                    if (input.type === 'checkbox') input.checked = !input.checked;
                    return;
                }

                if (isCustomModule) {
                    if (key === 'show_tab') {
                        const moduleId = parseInt(titleElWorkspace.dataset.moduleId, 10);
                        const tableData = appState.jsonData.database.table[currentTableName];
                        const modIndex = tableData.custom_modules.findIndex(m => m.module_id === moduleId);

                        if (modIndex > -1) {
                            const modData = tableData.custom_modules[modIndex];
                            let includedRels = [];
                            try { includedRels = JSON.parse(modData.included_relations || "[]"); } catch(e) {}

                            // Add to or remove from the JSON array
                            if (value === 1 && !includedRels.includes(childTableName)) {
                                includedRels.push(childTableName);
                            } else if (value === 0) {
                                includedRels = includedRels.filter(t => t !== childTableName);
                            }

                            const jsonString = JSON.stringify(includedRels);
                            modData.included_relations = jsonString; // Store in RAM

                            console.log(`[CUSTOM MODULE] Saving included_relations -> ${jsonString}`);

                            // Send the full payload to the backend for the update
                            const payload = {
                                module_id: modData.module_id,
                                table_id: tableData.table_id,
                                module_name: modData.module_name,
                                menu_icon: modData.menu_icon,
                                fields: modData.fields,
                                filter_rules: modData.filter_rules,
                                settings_override: modData.settings_override,
                                included_relations: modData.included_relations || "[]"
                            };

                            window.electronAPI.saveCustomModule(payload).then(res => {
                                if (!res.success) console.error("Failed to save relations:", res.message);
                            });
                        }
                    } else {
                        // Prevent other settings from being changed
                        showCustomDialog({ title: "Global Setting", message: "Only 'Show Tab' (Include/Exclude) can be customized per Custom Module. Other settings are shared globally."});
                        if (input.type === 'checkbox') input.checked = !input.checked;
                    }
                    return; // End of the process for Custom Modules
                }
                // ▲▲▲ END ROUTING ▲▲▲

                // --- GLOBAL SAVE FOR DEFAULT MODULES ---
                console.log(`🚀 Sending to SaveManager: RelID=${relData.relationship_id}, Key=${key}, Val=${value}`);
                SaveManager.addToQueue('relationship', relData.relationship_id, { [key]: value });
            });
        });
    });

    console.log("✅ Relationship Handlers installed successfully (Mode: Phase 3A Dual Container).");
}

// ==========================================================================
// INSTRUCTION: MOVE THE FOLLOWING FUNCTIONS FROM uiHandlers.js TO HERE
// ==========================================================================
// Cut & paste these long UI functions 
// from your original uiHandlers.js to the bottom of this file.
//
// List of functions to move:
// 
export function populateSortByDropdown(tableName, elementId = 'tbl-default-sort-by') {
    const sortByDropdown = document.getElementById(elementId);
    if (!sortByDropdown || !appState.jsonData) return;
    
    // Clear the existing list
    sortByDropdown.innerHTML = (elementId === 'tbl-default-sort-by') ? '<option value="">None</option>' : '';
    
    const table = appState.jsonData.database.table[tableName];
    if (table && table.fields) {
        for (const fieldName in table.fields) {
            const option = document.createElement('option');
            option.value = fieldName;
            option.textContent = fieldName;
            sortByDropdown.appendChild(option);
        }
    }
}

// =====================================================================
// GRID LAYOUT EXPANSION PHASE A (2026-09-25)
// Group-by dropdown, summary-row repeater, row-click + empty-state inputs.
// =====================================================================

const GRID_SUMMARY_MAX = 5;
const GRID_SUMMARY_AGGS = ['sum', 'avg', 'count', 'min', 'max'];

/**
 * [HELPER] Numeric field names of a table (summary-capable columns).
 */
function getNumericFieldNames(tableName) {
    const table = appState.jsonData && appState.jsonData.database.table[tableName];
    if (!table || !table.fields) return [];
    const numericTypes = ['TINYINT', 'SMALLINT', 'MEDIUMINT', 'INT', 'BIGINT', 'DECIMAL', 'FLOAT', 'DOUBLE'];
    return Object.values(table.fields)
        .filter((f) => numericTypes.includes(String(f.data_type || '').toUpperCase()))
        .map((f) => f.field_name);
}

/**
 * Populates the "Group rows by" dropdown with the table's own fields.
 */
export function populateGridGroupByDropdown(tableName) {
    const sel = document.getElementById('tbl-grid-group-by');
    if (!sel || !appState.jsonData) return;
    const table = appState.jsonData.database.table[tableName];
    sel.innerHTML = '<option value="">— no grouping —</option>';
    if (table && table.fields) {
        for (const fieldName in table.fields) {
            const opt = document.createElement('option');
            opt.value = fieldName;
            opt.textContent = fieldName;
            sel.appendChild(opt);
        }
    }
}

/**
 * Renders the summary-row repeater rows from the current hidden JSON value.
 * Each row: [field select] [aggregate select] [remove].
 */
export function renderGridSummaryRows() {
    const container = document.getElementById('grid-summaries-rows');
    if (!container) return;
    let map = {};
    try { map = JSON.parse(document.getElementById('tbl-grid-summaries').value || '{}') || {}; } catch (e) { map = {}; }
    container.innerHTML = '';
    for (const [field, agg] of Object.entries(map)) {
        container.appendChild(buildSummaryRow(field, agg));
    }
}

function buildSummaryRow(field, agg) {
    const row = document.createElement('div');
    row.className = 'input-group';
    row.style.marginTop = '.3rem';
    const fieldSel = document.createElement('select');
    fieldSel.className = 'grid-summary-field';
    const numericFields = getNumericFieldNames(currentGridTableName());
    const allFieldNames = getAllFieldNames(currentGridTableName());
    const options = allFieldNames.includes(field) ? allFieldNames : [field, ...numericFields];
    options.forEach((fn) => {
        const o = document.createElement('option');
        o.value = fn;
        o.textContent = fn + (numericFields.includes(fn) ? '' : ' (not numeric — will be ignored)');
        if (fn === field) o.selected = true;
        fieldSel.appendChild(o);
    });
    const aggSel = document.createElement('select');
    aggSel.className = 'grid-summary-agg';
    aggSel.style.marginLeft = '.4rem';
    GRID_SUMMARY_AGGS.forEach((a) => {
        const o = document.createElement('option');
        o.value = a;
        o.textContent = a === 'avg' ? 'average' : a;
        if (a === agg) o.selected = true;
        aggSel.appendChild(o);
    });
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn btn-small';
    removeBtn.style.marginLeft = '.4rem';
    removeBtn.textContent = '×';
    removeBtn.title = 'Remove this summary';
    const sync = () => commitGridSummaries();
    fieldSel.addEventListener('change', sync);
    aggSel.addEventListener('change', sync);
    removeBtn.addEventListener('click', () => { row.remove(); sync(); });
    row.appendChild(fieldSel);
    row.appendChild(aggSel);
    row.appendChild(removeBtn);
    return row;
}

function currentGridTableName() {
    const titleEl = document.querySelector('#table-settings-page .table-name');
    if (titleEl) return titleEl.textContent.trim();
    const ws = document.getElementById('workspace-module-title');
    return ws ? ws.dataset.tableName : '';
}

function getAllFieldNames(tableName) {
    const table = appState.jsonData && appState.jsonData.database.table[tableName];
    return table && table.fields ? Object.keys(table.fields) : [];
}

/**
 * Serializes the repeater rows into the hidden tbl-grid-summaries input and
 * fires a change event so the generic autosave picks it up.
 */
function commitGridSummaries() {
    const hidden = document.getElementById('tbl-grid-summaries');
    if (!hidden) return;
    const map = {};
    const rows = document.querySelectorAll('#grid-summaries-rows .input-group');
    rows.forEach((row) => {
        const f = row.querySelector('.grid-summary-field');
        const a = row.querySelector('.grid-summary-agg');
        if (f && a && f.value && !map[f.value]) map[f.value] = a.value;
    });
    hidden.value = Object.keys(map).length ? JSON.stringify(map) : '';
    hidden.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * B4: Column-group repeater. Each row: [label input] [multi-select of
 * visible columns] [remove]. Serializes to JSON array in the hidden
 * tbl-grid-column-groups input and fires change for the generic autosave.
 */
const GRID_COL_GROUP_MAX = 5;

export function renderGridColumnGroupRows() {
    const container = document.getElementById('grid-col-group-rows');
    if (!container) return;
    let groups = [];
    try { groups = JSON.parse(document.getElementById('tbl-grid-column-groups').value || '[]'); } catch (e) { groups = []; }
    if (!Array.isArray(groups)) groups = [];
    container.innerHTML = '';
    groups.forEach((g) => container.appendChild(buildColGroupRow(g)));
}

function buildColGroupRow(group) {
    const row = document.createElement('div');
    row.className = 'input-group';
    row.style.marginTop = '.3rem';
    const labelInput = document.createElement('input');
    labelInput.type = 'text';
    labelInput.className = 'grid-col-group-label';
    labelInput.placeholder = 'Group label, e.g. Contact';
    labelInput.value = (group && group.label) || '';
    const colSel = document.createElement('select');
    colSel.className = 'grid-col-group-cols';
    colSel.multiple = true;
    colSel.size = 3;
    colSel.style.marginLeft = '.4rem';
    colSel.style.minWidth = '140px';
    const selected = new Set(Array.isArray(group && group.columns) ? group.columns : []);
    getAllFieldNames(currentGridTableName()).forEach((fn) => {
        const o = document.createElement('option');
        o.value = fn;
        o.textContent = fn;
        if (selected.has(fn)) o.selected = true;
        colSel.appendChild(o);
    });
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn btn-small';
    removeBtn.style.marginLeft = '.4rem';
    removeBtn.textContent = '×';
    removeBtn.title = 'Remove this group';
    const sync = () => commitGridColumnGroups();
    labelInput.addEventListener('change', sync);
    colSel.addEventListener('change', sync);
    removeBtn.addEventListener('click', () => { row.remove(); sync(); });
    row.appendChild(labelInput);
    row.appendChild(colSel);
    row.appendChild(removeBtn);
    return row;
}

/**
 * Serializes the column-group repeater rows into the hidden input.
 * Enforces: max 5 groups, a column only in one group (first wins).
 */
function commitGridColumnGroups() {
    const hidden = document.getElementById('tbl-grid-column-groups');
    if (!hidden) return;
    const used = new Set();
    const groups = [];
    const rows = document.querySelectorAll('#grid-col-group-rows .input-group');
    rows.forEach((row) => {
        if (groups.length >= GRID_COL_GROUP_MAX) return;
        const labelEl = row.querySelector('.grid-col-group-label');
        const colsEl = row.querySelector('.grid-col-group-cols');
        const label = labelEl ? labelEl.value.trim() : '';
        const cols = colsEl ? Array.from(colsEl.selectedOptions).map((o) => o.value).filter((c) => !used.has(c)) : [];
        if (!label || cols.length === 0) return;
        cols.forEach((c) => used.add(c));
        groups.push({ label, columns: cols });
    });
    hidden.value = groups.length ? JSON.stringify(groups) : '';
    hidden.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Wires the "+ Add summary" button (once). Called from renderer init.
 */
export function initializeGridSummaryEditor() {
    const addBtn = document.getElementById('btn-add-summary');
    if (!addBtn || addBtn.dataset.wired === '1') return;
    addBtn.dataset.wired = '1';
    addBtn.addEventListener('click', () => {
        const count = document.querySelectorAll('#grid-summaries-rows .input-group').length;
        if (count >= GRID_SUMMARY_MAX) {
            showToast(`Maximum ${GRID_SUMMARY_MAX} summaries per table`, 'warning');
            return;
        }
        const numeric = getNumericFieldNames(currentGridTableName());
        const first = numeric[0] || '';
        if (!first) {
            showToast('This table has no numeric columns to summarize', 'warning');
            return;
        }
        document.getElementById('grid-summaries-rows').appendChild(buildSummaryRow(first, 'sum'));
        commitGridSummaries();
    });

    // B4: "+ Add column group" button (same once-only wiring pattern).
    const addGroupBtn = document.getElementById('btn-add-col-group');
    if (addGroupBtn && addGroupBtn.dataset.wired !== '1') {
        addGroupBtn.dataset.wired = '1';
        addGroupBtn.addEventListener('click', () => {
            const count = document.querySelectorAll('#grid-col-group-rows .input-group').length;
            if (count >= GRID_COL_GROUP_MAX) {
                showToast(`Maximum ${GRID_COL_GROUP_MAX} column groups per table`, 'warning');
                return;
            }
            document.getElementById('grid-col-group-rows').appendChild(buildColGroupRow({ label: '', columns: [] }));
        });
    }
}

export function populateFocusFieldDropdown(tableName) {
    const defaultFocusDropdown = document.getElementById('tbl-default-focus');
    if (!defaultFocusDropdown || !appState.jsonData) return;

    defaultFocusDropdown.innerHTML = ''; // Clear the list
    const table = appState.jsonData.database.table[tableName];
    if (table && table.fields) {
        // ▼▼▼ MAIN UPDATE HERE ▼▼▼
        // 1. Get all field names
        const allFieldNames = Object.keys(table.fields);

        // 2. Filter to keep only editable fields
        const editableFields = allFieldNames.filter(fieldName => {
            return table.fields[fieldName].read_only !== 1;
        });
        // ▲▲▲ END UPDATE ▲▲▲

        const firstEditableField = editableFields.length > 0 ? editableFields[0] : '';
        
        defaultFocusDropdown.innerHTML = `<option value="${firstEditableField}">First editable field (${firstEditableField})</option><option value="__none__">Don't focus any field</option>`;
        
        // 3. Use the filtered list to generate the options
        editableFields.forEach(fieldName => {
            const option = document.createElement('option');
            option.value = fieldName;
            option.textContent = fieldName;
            defaultFocusDropdown.appendChild(option);
        });
    }
}

export function populateRecordOwnerDropdown(tableName) {
    const recordOwnerDropdown = document.getElementById('tbl-record-owner');
    if (!recordOwnerDropdown || !appState.jsonData) return;

    // Clear the existing options (including the static ones from HTML)
    recordOwnerDropdown.innerHTML = '';

    // 1. Add the first default option (Anybody / All - no restrictions)
    const anybodyOption = document.createElement('option');
    anybodyOption.value = ''; // The empty value we want
    anybodyOption.textContent = 'Anybody (with auth)';
    recordOwnerDropdown.appendChild(anybodyOption);

    // 2. Add the second static option (Current User Only)
    const currentUserOption = document.createElement('option');
    currentUserOption.value = 'current_user'; 
    currentUserOption.textContent = 'Current User Only';
    recordOwnerDropdown.appendChild(currentUserOption);

    // ▼▼▼ DYNAMIC LOGIC ▼▼▼
    // 3. Find and add all foreign key fields based on the relationship data
    const relationships = appState.jsonData.database.relationships || [];
    
    relationships.forEach(rel => {
        // Find relationships where the current table is the CHILD table
        if (rel.child_table_name === tableName) {
            const fkFieldName = rel.fk_child_field;
            
            const lookupOption = document.createElement('option');
            lookupOption.value = fkFieldName;
            lookupOption.textContent = fkFieldName; // You can add toTitleCase(fkFieldName) if you want it tidier
            recordOwnerDropdown.appendChild(lookupOption);
        }
    });
    // ▲▲▲ END DYNAMIC LOGIC ▲▲▲
}

/**
 * Updates the image inside the "Template preview" box based on
 * the current selection of the 'tbl-tv-template' dropdown.
 *
 * For the 'card' template we render a LIVE mock grid that reflects the
 * configured card size (cards per row on tablet/desktop) instead of a
 * static image, so the user sees the real proportions.
 */
export function updateTableViewTemplatePreview() {
    const templateSelect = document.getElementById('tbl-tv-template');
    const previewArea = document.querySelector('#tab-template .theme-preview-window');

    if (!templateSelect || !previewArea) {
        console.warn("Elements for the template preview not found.");
        return;
    }

    const selectedValue = templateSelect.value;
    if (!selectedValue) {
        // If nothing is selected, show the default text
        previewArea.innerHTML = '<p style="text-align: center; color: var(--secondary-color);">Template preview area</p>';
        return;
    }

    if (selectedValue === 'card') {
        previewArea.innerHTML = buildCardSizePreviewHtml() + buildGridFeaturePreviewHtml();
        return;
    }

    const imagePath = `../assets/images/${selectedValue}.png`;
    previewArea.innerHTML = `<img src="${imagePath}" alt="Preview for the ${selectedValue} template" style="width: 100%; object-fit: contain;">` + buildGridFeaturePreviewHtml();
}

/**
 * [HELPER] Builds a live mock of the horizontal table grid reflecting the
 * grid expansion options: sticky header, row density, inline edit, and the
 * column chooser. Rendered for every template (sticky/density apply to all;
 * column chooser badge notes it only works on the Horizontal template).
 */
function buildGridFeaturePreviewHtml() {
    const checked = (id) => {
        const el = document.getElementById(id);
        return !!(el && el.checked);
    };
    const densityEl = document.getElementById('tbl-grid-row-density');
    const density = densityEl ? densityEl.value : 'normal';

    const sticky = checked('tbl-grid-sticky-header');
    const inlineEdit = checked('tbl-grid-inline-edit');
    const chooser = checked('tbl-grid-column-manager');
    const groupBy = (() => { const el = document.getElementById('tbl-grid-group-by'); return el ? el.value : ''; })();
    const rowClick = (() => { const el = document.getElementById('tbl-grid-row-click'); return el ? el.value : 'page'; })();
    const emptyHeading = (() => { const el = document.getElementById('tbl-grid-empty-heading'); return el ? el.value.trim() : ''; })();
    let summaries = {};
    try { summaries = JSON.parse((document.getElementById('tbl-grid-summaries') || {}).value || '{}') || {}; } catch (e) { summaries = {}; }

    const rowPad = density === 'compact' ? '2px' : (density === 'comfortable' ? '12px' : '6px');
    const headerStyle = `padding:${rowPad} 8px; background:#EEF2FF; font-weight:600; font-size:0.75em; border-bottom:2px solid #C7D2FE;`
        + (sticky ? ' position:sticky; top:0; box-shadow:0 1px 0 rgba(0,0,0,.1);' : '');
    const cellStyle = `padding:${rowPad} 8px; font-size:0.75em; border-bottom:1px solid #eee;`;
    const editCellStyle = cellStyle + ' background:#FFFBEB; outline:1px dashed #F59E0B; outline-offset:-1px;';

    const headers = ['Name', 'Status', 'Date'];
    const rows = [
        ['Sample record A', 'Active', '25/09/2026'],
        ['Sample record B', 'Pending', '24/09/2026'],
        ['Sample record C', 'Active', '23/09/2026'],
    ];

    const groupRowHtml = groupBy
        ? `<tr><td colspan="3" style="padding:3px 8px; background:#F1F5F9; font-size:0.7em; font-weight:600; color:#334155; border-bottom:1px solid #CBD5E1;">▾ ${groupBy}: Active (2)</td></tr>`
        : '';
    const summaryRowHtml = Object.keys(summaries).length
        ? `<tr style="background:#F8FAFC; font-weight:600;"><td colspan="3" style="padding:4px 8px; font-size:0.7em; color:#475569; border-top:2px solid #CBD5E1;">Summary: ${Object.entries(summaries).map(([f, a]) => `${a}(${f})`).join(' · ')}</td></tr>`
        : '';

    const tableHtml = `
        <div style="margin-top:10px; max-height:150px; overflow-y:auto; border:1px solid #ddd; border-radius:6px; background:#fff;">
            <table style="width:100%; border-collapse:collapse;">
                <thead><tr>${headers.map(h => `<th style="${headerStyle}">${h}</th>`).join('')}</tr></thead>
                <tbody>
                    ${groupRowHtml}
                    ${rows.map(r => `<tr>${r.map((c, i) => `<td style="${inlineEdit && i === 0 ? editCellStyle : cellStyle}">${c}</td>`).join('')}</tr>`).join('')}
                    ${summaryRowHtml}
                </tbody>
            </table>
        </div>`;

    const badges = [];
    if (sticky) badges.push('<span style="background:#DBEAFE;color:#1E40AF;border-radius:10px;padding:1px 8px;font-size:0.7em;">sticky header</span>');
    if (density !== 'normal') badges.push(`<span style="background:#F3E8FF;color:#6B21A8;border-radius:10px;padding:1px 8px;font-size:0.7em;">${density} rows</span>`);
    if (inlineEdit) badges.push('<span style="background:#FEF3C7;color:#92400E;border-radius:10px;padding:1px 8px;font-size:0.7em;">inline edit</span>');
    if (chooser) badges.push('<span style="background:#D1FAE5;color:#065F46;border-radius:10px;padding:1px 8px;font-size:0.7em;">column chooser</span>');
    if (groupBy) badges.push(`<span style="background:#CFFAFE;color:#155E75;border-radius:10px;padding:1px 8px;font-size:0.7em;">grouped by ${groupBy}</span>`);
    if (Object.keys(summaries).length) badges.push(`<span style="background:#FFE4E6;color:#9F1239;border-radius:10px;padding:1px 8px;font-size:0.7em;">summary row (${Object.keys(summaries).length})</span>`);
    if (rowClick === 'slideover') badges.push('<span style="background:#E0E7FF;color:#3730A3;border-radius:10px;padding:1px 8px;font-size:0.7em;">row → slide-over</span>');
    else if (rowClick === 'none') badges.push('<span style="background:#F1F5F9;color:#475569;border-radius:10px;padding:1px 8px;font-size:0.7em;">row click off</span>');
    if (emptyHeading) badges.push(`<span style="background:#FEF9C3;color:#854D0E;border-radius:10px;padding:1px 8px;font-size:0.7em;">custom empty state</span>`);
    // Phase B badges
    const striping = checked('tbl-grid-row-striping');
    const borderStyle = (() => { const el = document.getElementById('tbl-grid-border-style'); return el ? el.value : 'default'; })();
    const contentWidth = (() => { const el = document.getElementById('tbl-grid-content-width'); return el ? el.value : 'full'; })();
    const stickyToolbar = checked('tbl-grid-sticky-toolbar');
    const stickyFooter = checked('tbl-grid-sticky-footer');
    const colGroupCount = (() => { try { const g = JSON.parse((document.getElementById('tbl-grid-column-groups') || {}).value || '[]'); return Array.isArray(g) ? g.length : 0; } catch (e) { return 0; } })();
    if (striping) badges.push('<span style="background:#FCE7F3;color:#9D174D;border-radius:10px;padding:1px 8px;font-size:0.7em;">zebra rows</span>');
    if (borderStyle !== 'default') badges.push(`<span style="background:#F1F5F9;color:#334155;border-radius:10px;padding:1px 8px;font-size:0.7em;">${borderStyle} borders</span>`);
    if (contentWidth !== 'full') badges.push(`<span style="background:#ECFCCB;color:#3F6212;border-radius:10px;padding:1px 8px;font-size:0.7em;">${contentWidth.replace('contained_', 'max ')}px</span>`);
    if (stickyToolbar) badges.push('<span style="background:#DBEAFE;color:#1E3A8A;border-radius:10px;padding:1px 8px;font-size:0.7em;">sticky toolbar</span>');
    if (stickyFooter) badges.push('<span style="background:#DBEAFE;color:#1E3A8A;border-radius:10px;padding:1px 8px;font-size:0.7em;">sticky pagination</span>');
    if (colGroupCount) badges.push(`<span style="background:#FFEDD5;color:#9A3412;border-radius:10px;padding:1px 8px;font-size:0.7em;">${colGroupCount} column group${colGroupCount > 1 ? 's' : ''}</span>`);

    if (badges.length === 0) return '';
    return `
        <div style="font-size:0.8em; color:var(--secondary-color); margin:10px 0 4px;">Grid options preview</div>
        ${tableHtml}
        <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:6px;">${badges.join('')}</div>
    `;
}

/**
 * [HELPER] Builds a live HTML mock of the card grid using the currently
 * selected card size values. Shows two mini-grids: tablet width and
 * desktop width, each with sample cards (image block + text lines).
 */
function buildCardSizePreviewHtml() {
    const clamp = (sel, min, max, dflt) => {
        const el = document.getElementById(sel);
        const n = el ? parseInt(el.value, 10) : NaN;
        return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt;
    };
    const tabletCols = clamp('tbl-card-columns-tablet', 1, 2, 2);
    const desktopCols = clamp('tbl-card-columns', 1, 6, 3);

    const cardHtml = () => `
        <div style="border:1px solid #ddd; border-radius:8px; background:#fff; overflow:hidden; box-shadow:0 1px 2px rgba(0,0,0,0.06);">
            <div style="height:46px; background:linear-gradient(135deg,#E0E7FF,#C7D2FE); display:flex; align-items:center; justify-content:center; color:#6366F1; font-size:0.7em;">image</div>
            <div style="padding:6px 8px;">
                <div style="height:7px; width:70%; background:#D1D5DB; border-radius:3px; margin-bottom:5px;"></div>
                <div style="height:6px; width:90%; background:#E5E7EB; border-radius:3px; margin-bottom:4px;"></div>
                <div style="height:6px; width:55%; background:#E5E7EB; border-radius:3px;"></div>
            </div>
        </div>`;

    const gridHtml = (cols, count) => `
        <div style="display:grid; grid-template-columns:repeat(${cols}, 1fr); gap:8px;">
            ${Array.from({ length: count }, () => cardHtml()).join('')}
        </div>`;

    return `
        <div style="font-size:0.8em; color:var(--secondary-color); margin-bottom:4px;">Tablet (${tabletCols} card${tabletCols > 1 ? 's' : ''} per row)</div>
        ${gridHtml(tabletCols, Math.min(tabletCols + 1, 3))}
        <div style="font-size:0.8em; color:var(--secondary-color); margin:10px 0 4px;">Desktop (${desktopCols} card${desktopCols > 1 ? 's' : ''} per row)</div>
        ${gridHtml(desktopCols, Math.min(desktopCols + 2, 8))}
        <div style="font-size:0.75em; color:var(--secondary-color); margin-top:8px; text-align:center;">Phone: 1 full-width card per row</div>
    `;
}

/**
 * Shows the "Card size" settings group only when the selected Table List
 * template is 'card'. Called on populate and on template change.
 */
export function toggleCardSizeGroup() {
    const templateSelect = document.getElementById('tbl-tv-template');
    const cardSizeGroup = document.getElementById('tbl-card-size-group');
    if (!templateSelect || !cardSizeGroup) return;
    cardSizeGroup.style.display = templateSelect.value === 'card' ? '' : 'none';
}

/**
 * Attaches an event listener to the 'tbl-tv-template' dropdown
 * so it updates the image every time the selection changes.
 */
export function initializeTemplatePreviewHandlers() {
    const templateSelect = document.getElementById('tbl-tv-template');
    if (templateSelect) {
        templateSelect.addEventListener('change', updateTableViewTemplatePreview);
        templateSelect.addEventListener('change', toggleCardSizeGroup);
    }
    // Live preview: card size dropdowns redraw the mock grid immediately.
    ['tbl-card-columns', 'tbl-card-columns-tablet', 'tbl-grid-sticky-header', 'tbl-grid-row-density', 'tbl-grid-inline-edit', 'tbl-grid-column-manager', 'tbl-grid-group-by', 'tbl-grid-row-click', 'tbl-grid-empty-heading', 'tbl-grid-summaries', 'tbl-grid-row-striping', 'tbl-grid-border-style', 'tbl-grid-content-width', 'tbl-grid-sticky-toolbar', 'tbl-grid-sticky-footer', 'tbl-grid-column-groups'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', updateTableViewTemplatePreview);
    });
}

export function initializeColumnGridHandlers() {
    const radioGroup = document.querySelectorAll('input[name="tbl-column-grid-type"]');
    const staticColumnsGroup = document.getElementById('tbl-static-grid-columns-group');

    if (radioGroup.length === 0 || !staticColumnsGroup) return;

    const toggleStaticInput = () => {
        const staticRadio = document.getElementById('tbl-column-grid-static');
        if (staticRadio) {
            staticColumnsGroup.style.opacity = staticRadio.checked ? '1' : '0.5';
            staticColumnsGroup.querySelector('input').disabled = !staticRadio.checked;
        }
    };

    radioGroup.forEach(radio => {
        radio.addEventListener('change', toggleStaticInput);
    });

    // Call once for the initial setting
    toggleStaticInput();
}

/**
 * Fills the "Constraints" tab with the list of existing constraints.
 * @param {string} tableName - Name of the current table.
 */
export function populateConstraintsTab(tableName) {
    const container = document.getElementById('constraints-list-container');
    if (!container) return;

    // Now this includes both UNIQUE and INDEX types
    const constraints = appState.jsonData.database.table[tableName]?.constraints || [];

    if (constraints.length === 0) {
        container.innerHTML = `<div class="empty-state-label"><p>No composite rules defined for this table.</p><span>Use the field settings for individual rules.</span></div>`;
        return;
    }

    container.innerHTML = constraints.map(constraint => {
        const columns = JSON.parse(constraint.columns).join(', ');
        const isUnique = constraint.constraint_type === 'UNIQUE';
        return `
        <div class="cv-list-item">
            <div class="cv-info">
                <i class="fas ${isUnique ? 'fa-key' : 'fa-list-ol'}"></i>
                <span><strong>${constraint.constraint_type}</strong> (${columns})</span>
            </div>
            <div class="cv-actions">
                <button class="btn cv-delete-btn delete-constraint-btn" data-constraint-id="${constraint.constraint_id}">
                    <i class="fas fa-trash-alt"></i> Delete
                </button>
            </div>
        </div>
        `;
    }).join('');
}

/**
 * Installs all event listeners for the constraint management feature.
 */
export function initializeConstraintsTabHandlers() {
    const tableSettingsPage = document.getElementById('table-settings-page');
    const modal = document.getElementById('add-constraint-modal');
    if (!tableSettingsPage || !modal) return;
    
    const elements = {
        typeSelect: document.getElementById('constraint-type-select'),
        fieldsSelect: document.getElementById('constraint-fields-select'),
        okBtn: document.getElementById('add-constraint-modal-ok'),
        cancelBtn: document.getElementById('add-constraint-modal-cancel'),
        closeBtn: document.getElementById('add-constraint-modal-close'),
    };

    const closeModal = () => modal.classList.add('hidden');
    
    tableSettingsPage.addEventListener('click', e => {
        const currentTableName = document.querySelector('#table-settings-page .table-name').textContent;
        if (!currentTableName) return;

        if (e.target.closest('#btn-add-constraint')) {
            elements.fieldsSelect.innerHTML = '';
            const fields = appState.jsonData.database.table[currentTableName]?.fields || {};
            for (const fieldName in fields) {
                elements.fieldsSelect.add(new Option(fieldName, fieldName));
            }
            elements.okBtn.disabled = true; // Disable OK button initially
            modal.classList.remove('hidden');
        }

        const deleteBtn = e.target.closest('.delete-constraint-btn');
        if (deleteBtn) {
            const constraintId = deleteBtn.dataset.constraintId;
            showCustomDialog({
                title: "Confirm Deletion",
                message: "Are you sure you want to delete this composite rule?",
                showCancelButton: true,
                onOk: async () => {
                    const result = await window.electronAPI.deleteTableConstraint({ constraint_id: constraintId });
                    if (result.success) {
                        await loadProjectData(appState.activeProject);
                        populateConstraintsTab(currentTableName);
                    } else {
                        showCustomDialog({ title: "Error", message: `Failed to delete rule: ${result.message}` });
                    }
                }
            });
        }
    });

    elements.closeBtn.addEventListener('click', closeModal);
    elements.cancelBtn.addEventListener('click', closeModal);

    // Validation Rule: Enable OK button only if 2 or more fields are selected
    elements.fieldsSelect.addEventListener('change', () => {
        elements.okBtn.disabled = elements.fieldsSelect.selectedOptions.length < 2;
    });

    elements.okBtn.addEventListener('click', async () => {
        const selectedFields = Array.from(elements.fieldsSelect.selectedOptions).map(opt => opt.value);
        
        // This check is a safeguard, but the disabled state should prevent this.
        if (selectedFields.length < 2) {
            showCustomDialog({ title: "Input Required", message: "Please select at least two fields for a composite rule." });
            return;
        }

        const tableName = document.querySelector('#table-settings-page .table-name').textContent;
        const tableId = appState.jsonData.database.table[tableName]?.table_id;
        
        const result = await window.electronAPI.saveTableConstraint({
            table_id: tableId,
            constraint_type: elements.typeSelect.value, // Now sends UNIQUE or INDEX
            columns: selectedFields
        });

        if (result.success) {
            closeModal();
            await loadProjectData(appState.activeProject);
            populateConstraintsTab(tableName);
        } else {
            showCustomDialog({ title: "Error", message: `Failed to save rule: ${result.message}` });
        }
    });
}

/**
 * Fills the "Custom Modules" tab with the list of views that have been created.
 * @param {string} tableName - Name of the current table.
 */
export function populateCustomViewsTab(tableName) {
    const container = document.getElementById('custom-modules-list-container');
    if (!container) return;

    const views = appState.jsonData.database.table[tableName]?.custom_modules || [];

    if (views.length === 0) {
        container.innerHTML = `
            <div class="empty-state-label">
                <p>No Custom Modules created yet.</p>
                <span>Click the button above to create one.</span>
            </div>`;
        return;
    }

    container.innerHTML = views.map(view => `
        <div class="cv-list-item">
            <div class="cv-info">
                <i class="fas ${view.menu_icon || 'fa-eye'}"></i>
                <span>${view.module_name}</span>
            </div>
            <div class="cv-actions">
                <button class="btn btn-secondary cv-edit-btn" data-view-id="${view.module_id}">
                    <i class="fas fa-pencil-alt"></i> Edit
                </button>
                <button class="btn cv-delete-btn" data-view-id="${view.module_id}">
                    <i class="fas fa-trash-alt"></i> Delete
                </button>
            </div>
        </div>
    `).join('');
}
window.populateCustomViewsTab = populateCustomViewsTab;

/**
 * Main function to install all event listeners for the Custom Modules feature.
 */
export function initializeCustomViews() {
    const modulesSetupWorkspace = document.getElementById('modules-setup-workspace');
    if (!modulesSetupWorkspace) return;

    // Attach listeners for the buttons inside the Custom Module modal
    initializeCustomModuleModalLogic();

    // Event delegation for the "Add", "Edit", and "Delete" buttons inside the tab
    modulesSetupWorkspace.addEventListener('click', e => {
const currentTableName = document.getElementById('modules-setup-table-select').value;
        if (!currentTableName) return;

        // Add New button
        if (e.target.closest('#btn-add-custom-module')) {
            populateCustomModuleModal(currentTableName);
        }

        // Edit button
        const editBtn = e.target.closest('.cv-edit-btn');
        if (editBtn) {
            const viewId = parseInt(editBtn.dataset.viewId, 10);
            const viewData = appState.jsonData.database.table[currentTableName]?.custom_modules.find(v => v.module_id === viewId);
            if (viewData) populateCustomModuleModal(currentTableName, viewData);
        }

        // Delete button
        const deleteBtn = e.target.closest('.cv-delete-btn');
        if (deleteBtn) {
            const viewId = parseInt(deleteBtn.dataset.viewId, 10);
            deleteCustomView(viewId); // This function stays as-is below
        }
    });
}

/**
 * Displays the Custom Module modal with the correct data.
 */
export function populateCustomModuleModal(tableName, viewData = null) {
    const modal = document.getElementById('custom-module-config-modal');
    const title = document.getElementById('cv-modal-title');
    const saveBtn = document.getElementById('cv-modal-save');
    const nextBtn = document.getElementById('cv-modal-next');
    
    // Step 1 elements
    const nameInput = document.getElementById('cv-view-name');
    const iconInput = document.getElementById('cv-menu-icon');
    const ownerOnlyCheck = document.getElementById('cv-owner-only-checkbox'); // ID UPDATED
    const ownerFieldSelect = document.getElementById('cv-owner-field-select'); // ID UPDATED
    const ownerFieldContainer = document.getElementById('cv-owner-field-container');

    // Step 2 elements
    const availableFieldsList = document.getElementById('cv-available-fields-list');
    const formLayoutPanel = document.getElementById('cv-form-layout-panel');

    if (!modal || !appState.jsonData.database.table[tableName]) return;
    const tableData = appState.jsonData.database.table[tableName];

    // Reset UI navigation (back to Step 1)
    document.getElementById('cv-step-1').classList.remove('hidden');
    document.getElementById('cv-step-2').classList.add('hidden');
    document.getElementById('cv-modal-back').classList.add('hidden');
    saveBtn.classList.add('hidden');
    nextBtn.classList.remove('hidden');

    // Reset Fields UI
    availableFieldsList.innerHTML = '';
    formLayoutPanel.innerHTML = '';

    // 1. SET BASIC INFO & OWNER (Step 1)
    if (viewData) {
        title.textContent = "Edit Custom Module";
        saveBtn.setAttribute('data-editing-id', viewData.module_id);
        nameInput.value = viewData.module_name || '';
        iconInput.value = viewData.menu_icon || '';
        ownerOnlyCheck.checked = (viewData.owner_only == 1);
    } else {
        title.textContent = "Create Custom Module";
        saveBtn.removeAttribute('data-editing-id');
        nameInput.value = '';
        iconInput.value = '';
        ownerOnlyCheck.checked = false;
    }

    // Populate Owner Field Dropdown
    ownerFieldSelect.innerHTML = '<option value="">-- Select Owner Field --</option>';
    Object.keys(tableData.fields).forEach(fieldName => {
        const option = document.createElement('option');
        option.value = fieldName;
        option.textContent = fieldName;
        ownerFieldSelect.appendChild(option);
    });
    
    if (viewData && viewData.owner_field) {
        ownerFieldSelect.value = viewData.owner_field;
    }

    // Toggle logic for Owner Field visibility
    const toggleOwnerField = () => {
        if(ownerOnlyCheck.checked) ownerFieldContainer.classList.remove('hidden');
        else ownerFieldContainer.classList.add('hidden');
    };
    ownerOnlyCheck.removeEventListener('change', toggleOwnerField); // Avoid duplicate listeners
    ownerOnlyCheck.addEventListener('change', toggleOwnerField);
    toggleOwnerField();

    // 2. BUILD THE FIELD LIST FOR THE FORM LAYOUT (Step 2)
    const template = document.getElementById('cv-form-field-template');
    
    Object.values(tableData.fields).forEach(field => {
        const clone = template.content.cloneNode(true);
        const itemDiv = clone.querySelector('.form-field-item');
        
        itemDiv.dataset.sourceName = field.field_name;
        itemDiv.querySelector('.field-label').textContent = field.field_name;
        itemDiv.querySelector('.field-source').textContent = `Type: ${field.data_type}`;

        // Check if this field is already selected (for Edit Mode)
        let isSelected = false;
        if (viewData && viewData.fields) {
            const savedField = viewData.fields.find(f => (f.sourceName || f.field_source_name) === field.field_name);
            if (savedField) {
                isSelected = true;
                itemDiv.querySelector('.is-readonly-checkbox').checked = (savedField.isReadonly == 1 || savedField.is_readonly == 1);
                
                // Extract the label override (JSON settings override)
                if (savedField.settings_override) {
                    try {
                        const overrides = JSON.parse(savedField.settings_override);
                        if (overrides.caption) {
                            itemDiv.querySelector('.field-label-override-input').value = overrides.caption;
                        }
                    } catch(e) {}
                }
            }
        }

        // Place it in the correct area
        if (isSelected) {
            formLayoutPanel.appendChild(clone);
        } else {
            availableFieldsList.appendChild(clone);
        }
    });

    modal.classList.remove('hidden');
}

/**
 * Modal navigation logic and module data saving.
 */
export function initializeCustomModuleModalLogic() {
    const modal = document.getElementById('custom-module-config-modal');
    const step1 = document.getElementById('cv-step-1');
    const step2 = document.getElementById('cv-step-2');
    const btnNext = document.getElementById('cv-modal-next');
    const btnBack = document.getElementById('cv-modal-back');
    const btnSave = document.getElementById('cv-modal-save');
    const btnCancel = document.getElementById('cv-modal-cancel');
    const btnClose = document.getElementById('cv-modal-close');

    if (!modal) return;

    // --- TAB NAVIGATION LOGIC ---
    btnNext.addEventListener('click', () => {
        const nameInput = document.getElementById('cv-view-name');
        if (!nameInput.value.trim()) {
            showCustomDialog({ title: "Required", message: "Please provide a View Name." });
            return;
        }
        step1.classList.add('hidden');
        step2.classList.remove('hidden');
        btnNext.classList.add('hidden');
        btnBack.classList.remove('hidden');
        btnSave.classList.remove('hidden');
    });

    btnBack.addEventListener('click', () => {
        step2.classList.add('hidden');
        step1.classList.remove('hidden');
        btnBack.classList.add('hidden');
        btnSave.classList.add('hidden');
        btnNext.classList.remove('hidden');
    });

    const closeMyModal = () => modal.classList.add('hidden');
    btnCancel.addEventListener('click', closeMyModal);
    btnClose.addEventListener('click', closeMyModal);

    // --- DRAG / MOVE FIELD LOGIC ---
    const addSelectedBtn = document.getElementById('cv-add-field-btn');
    const removeSelectedBtn = document.getElementById('cv-remove-field-btn');
    
    // (You could add click-selection or drag-and-drop logic here if your UI supports selection.
    // As a simple alternative, we move whatever is clicked to the other side).
    document.getElementById('cv-available-fields-list').addEventListener('click', (e) => {
        const item = e.target.closest('.form-field-item');
        if (item) document.getElementById('cv-form-layout-panel').appendChild(item);
    });

    document.getElementById('cv-form-layout-panel').addEventListener('click', (e) => {
        // Remove logic (delete button)
        if (e.target.closest('.delete-form-field-btn')) {
            const item = e.target.closest('.form-field-item');
            if (item) document.getElementById('cv-available-fields-list').appendChild(item);
        }
    });

    // --- SAVE-TO-BACKEND LOGIC ---
    const newSaveBtn = btnSave.cloneNode(true); // Replace the button to avoid duplicate listeners
    btnSave.parentNode.replaceChild(newSaveBtn, btnSave);

    newSaveBtn.addEventListener('click', async () => {
const currentTableName = document.getElementById('modules-setup-table-select').value;
        const tableData = appState.jsonData.database.table[currentTableName];
        if (!tableData) return;

        // Collect fields from the form layout
        const selectedFields = [];
        const layoutItems = document.querySelectorAll('#cv-form-layout-panel .form-field-item');
        layoutItems.forEach((item, index) => {
            const labelInput = item.querySelector('.field-label-override-input');
            const readOnlyCheck = item.querySelector('.is-readonly-checkbox');
            
            selectedFields.push({
                sourceName: item.dataset.sourceName,
                label: labelInput ? labelInput.value.trim() : '',     // Will be converted to JSON settings_override on the backend
                isReadonly: readOnlyCheck ? readOnlyCheck.checked : false,
                displayOrder: index
            });
        });

        // Build the final payload
        const payload = {
            table_id: tableData.table_id,
            module_name: document.getElementById('cv-view-name').value.trim(),
            menu_icon: document.getElementById('cv-menu-icon').value.trim(),
            owner_only: document.getElementById('cv-owner-only-checkbox').checked ? 1 : 0,
            owner_field: document.getElementById('cv-owner-field-select').value,
            fields: selectedFields
            // You can add filter_rules & included_relations here later
        };

        const editingId = newSaveBtn.getAttribute('data-editing-id');
        if (editingId) payload.module_id = editingId; // Provide the ID for the update

        // Send to the backend
        try {
            // Call the backend IPC directly for stability with these complex modules
            // Make sure your preload.js has the api: saveCustomModule
            let result;
            if (window.electronAPI.saveCustomModule) {
                result = await window.electronAPI.saveCustomModule(payload);
            } else {
                // Fall back to the old invoke if missing
                result = await window.electronAPI.createCustomView(payload); 
            }

            if (result && result.success) {
                showCustomDialog({ title: "Success", message: "Custom Module saved successfully!" });
                closeMyModal();
                // Reload data and refresh the tab (if a refresh function exists)
                if (typeof window.populateCustomViewsTab === 'function') {
                    // Update state manually or re-fetch the data from the DB
                    // (Depends on how your app reloads data)
                }
            } else {
                showCustomDialog({ title: "Error", message: result.message || "Failed to save Module." });
            }
        } catch (error) {
            console.error("Save Error:", error);
        }
    });
}

export async function deleteCustomView(viewId) {
    showCustomDialog({
        title: "Delete View",
        message: "Are you sure you want to delete this custom view? This action cannot be undone.",
        showCancelButton: true,
        onOk: async () => {
            console.group("🔍 DEBUG: Delete Custom Module");
            try {
                // 1. Get the table name FROM the DOM
                const tableNameElement = document.querySelector('#table-settings-page .table-name');
                const tableName = tableNameElement ? tableNameElement.textContent.trim() : null;
                
                // 2. Call the backend delete API
                const result = await window.electronAPI.deleteCustomView(viewId);
                
                if (result && result.success) {
                    console.log("✅ Delete succeeded on the backend.");

                    // Reload all data
                    await loadProjectData(appState.activeProject);
                    
                    // ▼▼▼ IMPROVEMENT: Keep the Dashboard view (card grid) ▼▼▼
                    // Make sure the workspace is hidden and the Dashboard is shown
                    const workspace = document.getElementById('module-workspace');
                    if (workspace) workspace.style.display = 'none';
                    
                    const header = document.getElementById('modules-dashboard-header');
                    if (header) header.style.display = 'flex';
                    
                    const grid = document.getElementById('modules-dashboard-grid');
                    if (grid) grid.style.display = 'grid';

                    // Redraw the cards without calling openModuleWorkspace
                    renderModulesDashboard();
                    // ▲▲▲ END IMPROVEMENT ▲▲▲

                } else {
                    console.error("❌ Backend error:", result.message);
                    showCustomDialog({ title: "Error", message: result.message || "Failed to delete custom view." });
                }

            } catch (error) {
                console.error("❌ Delete Error:", error);
                showCustomDialog({ title: "System Error", message: "An error occurred while deleting." });
            } finally {
                console.groupEnd();
            }
        }
    });
}

/**
 * PHASE 1 & 2: Controls the Dashboard and Modules Setup workspace
 */
export function initializeModulesSetupTab() {
    const tabBtn = document.getElementById('tab-modules-setup-btn');
    if (tabBtn) tabBtn.addEventListener('click', renderModulesDashboard);

    const workspaceContainer = document.getElementById('modules-setup-content');
    
    // BUG 3 FIX: Event listener for the 'Back' button (uses ID & style.display)
    const btnBack = document.getElementById('btn-back-to-modules');
    if (btnBack) {
        btnBack.addEventListener('click', () => {
            const workspace = document.getElementById('module-workspace');
            if (workspace) workspace.style.display = 'none'; // Hide the workspace
            
            const header = document.getElementById('modules-dashboard-header');
            if (header) header.style.display = 'flex'; // Restore the header
            
            const grid = document.getElementById('modules-dashboard-grid');
            if (grid) grid.style.display = 'grid'; // Restore the grid
            
            renderModulesDashboard(); // Refresh the dashboard
        });
    }

// ▼▼▼ GLOBAL LOGIC: UP / DOWN SORT BUTTONS ▼▼▼
    const btnMoveUp = document.getElementById('module-btn-move-up');
    const btnMoveDown = document.getElementById('module-btn-move-down');

    if (btnMoveUp && btnMoveDown) {
        // Movement helper function
        const moveItem = (direction) => {
            // Find the currently 'active' / clicked element
            const activeLink = document.querySelector('#module-field-list a.active');
            if (!activeLink) return;

            const currentLi = activeLink.closest('li');
            if (!currentLi || !currentLi.dataset.fieldId) {
                // Ignore if the active item is "Module Settings" (no fieldId)
                return; 
            }

            const titleEl = document.getElementById('workspace-module-title');
            const tableName = titleEl.dataset.tableName;
            const moduleId = titleEl.dataset.moduleId;

            if (direction === 'up') {
                const prevLi = currentLi.previousElementSibling;
                // Make sure it doesn't jump over "Module Settings"
                if (prevLi && prevLi.dataset.fieldId) {
                    currentLi.parentNode.insertBefore(currentLi, prevLi);
                    saveFieldOrder(tableName, moduleId);
                    highlightLi(currentLi);
                }
            } else if (direction === 'down') {
                const nextLi = currentLi.nextElementSibling;
                if (nextLi) {
                    currentLi.parentNode.insertBefore(nextLi, currentLi);
                    saveFieldOrder(tableName, moduleId);
                    highlightLi(currentLi);
                }
            }
        };

        // Replace with a clone to avoid duplicate event listeners (SPA standard practice)
        const newBtnMoveUp = btnMoveUp.cloneNode(true);
        btnMoveUp.parentNode.replaceChild(newBtnMoveUp, btnMoveUp);
        newBtnMoveUp.addEventListener('click', () => moveItem('up'));

        const newBtnMoveDown = btnMoveDown.cloneNode(true);
        btnMoveDown.parentNode.replaceChild(newBtnMoveDown, btnMoveDown);
        newBtnMoveDown.addEventListener('click', () => moveItem('down'));
    }
    // ▲▲▲ END GLOBAL LOGIC ▲▲▲
    
    if (workspaceContainer) {
        workspaceContainer.addEventListener('click', (e) => {
            // Edit Default Module button
            const btnEditDefault = e.target.closest('.btn-edit-default');
            if (btnEditDefault) {
                const tableName = btnEditDefault.dataset.tableName;
                openModuleWorkspace('default', tableName);
            }
            
            // Edit Custom Module button
            const btnEditCustom = e.target.closest('.btn-edit-custom');
            if (btnEditCustom) {
                const tableName = btnEditCustom.dataset.tableName;
                const moduleId = btnEditCustom.dataset.moduleId;
                openModuleWorkspace('custom', tableName, moduleId);
            }
            
            // Delete Custom Module button
            const btnDeleteCustom = e.target.closest('.btn-delete-custom');
            if (btnDeleteCustom) {
                const viewId = parseInt(btnDeleteCustom.dataset.moduleId, 10);
                deleteCustomView(viewId);
            }
            
// Create New Custom Module button (opens the workspace)
            const btnCreateGlobal = e.target.closest('#btn-add-custom-module-global');
            if (btnCreateGlobal) openModuleWorkspace('create');

            const btnSaveNew = e.target.closest('#btn-save-new-module');
            if (btnSaveNew) {
                const baseTable = document.getElementById('workspace-base-table-select').value;
                const moduleName = document.getElementById('workspace-new-module-name').value.trim();

                if (!baseTable || !moduleName) {
                    showCustomDialog({ title: "Error", message: "Please select a base table and provide a module name." });
                    return;
                }

// ▼▼▼ READ NESTED FILTER RULES IF PRESENT ▼▼▼
                let finalFilterRules = '{"condition":"AND", "rules":[]}';
                const filterContainer = document.getElementById('workspace-filter-builder-container');
                if (filterContainer && !document.getElementById('custom-module-specific-settings').classList.contains('hidden')) {
                    const rootGroup = filterContainer.querySelector('.cm-filter-group');
                    if (rootGroup) {
                        finalFilterRules = JSON.stringify(extractGroupData(rootGroup));
                    }
                }

const tableData = appState.jsonData.database.table[baseTable];
// Build the final payload (100% accurate based on the log)
                const tableOverrides = { table_view_title: document.getElementById('tbl-table-view-title')?.value || '' };
                
                const payload = {
                    project_id: tableData.project_id,
                    table_id: tableData.table_id,
                    module_name: moduleName,
                    menu_icon: 'fas fa-box',
                    filter_rules: finalFilterRules, 
                    settings_override: JSON.stringify(tableOverrides),
                    included_relations: "[]",
                    fields: [] 
                };

            const originalBtnText = btnSaveNew.innerHTML;
            btnSaveNew.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
            btnSaveNew.disabled = true;

            window.electronAPI.saveCustomModule(payload).then(async (res) => { // Make sure 'async' is here
                if (res.success) {
                    
                    // ▼▼▼ THE PERFECT WAY (FULL DATA RELOAD) ▼▼▼
                    // This function fetches the latest data from the database and 
                    // re-renders ALL tabs including Menu Management & Dashboard
                    await loadProjectData(appState.activeProject);
                    // ▲▲▲ END RELOAD ▲▲▲

                    // After the fresh data, reopen the workspace for this newly created module
                    openModuleWorkspace('custom', baseTable, res.view.module_id);
                    
                    showCustomDialog({ title: "Success", message: "New Custom Module created successfully!" });
                } else {
                    showCustomDialog({ title: "Error", message: res.message });
                }
            }).finally(() => {
                btnSaveNew.innerHTML = originalBtnText;
                btnSaveNew.disabled = false;
            });
        }
        // ▲▲▲ END CREATE LOGIC ▲▲▲
        
        });
    }
}

/**
 * Opens the workspace based on the mode (default / custom / create)
 */
export function openModuleWorkspace(mode, tableName = null, moduleId = null) {
    // Safely hide the Dashboard
    const header = document.getElementById('modules-dashboard-header');
    if (header) header.style.display = 'none';
    
    const grid = document.getElementById('modules-dashboard-grid');
    if (grid) grid.style.display = 'none';
    
    const workspace = document.getElementById('module-workspace');
    if (workspace) workspace.style.display = 'flex'; // Show the workspace

    // Workspace UI elements
    const titleEl = document.getElementById('workspace-module-title');
    const badgeEl = document.getElementById('workspace-module-badge');
    const createControls = document.getElementById('workspace-create-controls');
    const baseTableSelect = document.getElementById('workspace-base-table-select');
    const fieldList = document.getElementById('module-field-list');
    
    // ▼▼▼ GLOBAL SORT BUTTON CONTROL (From Phase 3) ▼▼▼
    const sortControls = document.getElementById('module-sort-controls');
    if (sortControls) {
        if (mode === 'custom') sortControls.classList.remove('hidden');
        else sortControls.classList.add('hidden');
    }

    // Reset the field list
    if (fieldList) fieldList.innerHTML = '';
    if (createControls) createControls.classList.add('hidden');

    const tables = appState.jsonData?.database?.table || {};

    // ==========================================
    // MODE-BASED LOGIC (CREATE / DEFAULT / CUSTOM)
    // ==========================================
    
    if (mode === 'create') {
        if (titleEl) {
            titleEl.textContent = "Create New Module";
            // CLEAR THE INITIAL CONTEXT
            titleEl.dataset.tableName = ""; 
            titleEl.dataset.moduleId = "";
        }
        if (badgeEl) { badgeEl.className = "module-badge"; badgeEl.textContent = ""; }
        
        // Show the Base Table and Name inputs
        if (createControls) createControls.classList.remove('hidden');
        const nameInput = document.getElementById('workspace-new-module-name');
        if (nameInput) nameInput.value = '';
        
        // Populate the Base Table dropdown
        if (baseTableSelect) {
            baseTableSelect.innerHTML = '<option value="">-- Select Base Table --</option>';
            Object.keys(tables).forEach(tName => {
                baseTableSelect.appendChild(new Option(tName, tName));
            });

            // ▼▼▼ IMPROVEMENT: When a table is selected, store the table-name context ▼▼▼
            baseTableSelect.onchange = (e) => {
                const selectedTable = e.target.value;
                if (selectedTable && tables[selectedTable]) {
                    // PROVIDE CONTEXT so field settings aren't empty/undefined
                    if (titleEl) titleEl.dataset.tableName = selectedTable;
                    renderWorkspaceFields(tables[selectedTable].fields, 'create', null, selectedTable);
                } else {
                    if (fieldList) fieldList.innerHTML = '';
                    if (titleEl) titleEl.dataset.tableName = "";
                }
            };
        }

    } else if (mode === 'default') {
        if (titleEl) {
            titleEl.textContent = tableName;
            titleEl.dataset.tableName = tableName; // SAVE CONTEXT
            titleEl.dataset.moduleId = '';         // CLEAR ID
        }
        if (badgeEl) { badgeEl.className = "module-badge badge-default"; badgeEl.textContent = "Default"; }
        
        // Draw the field list
        if (tables[tableName]) {
            renderWorkspaceFields(tables[tableName].fields, 'default', null, tableName);
        }

    } else if (mode === 'custom') {
        const tableData = tables[tableName];
        const moduleData = tableData?.custom_modules?.find(m => m.module_id == moduleId);
        
        if (titleEl) {
            titleEl.textContent = moduleData ? moduleData.module_name : "Unknown Module";
            titleEl.dataset.tableName = tableName; // SAVE CONTEXT
            titleEl.dataset.moduleId = moduleId;   // SAVE ID
        }
        if (badgeEl) { badgeEl.className = "module-badge badge-custom"; badgeEl.textContent = "Custom"; }

        // Draw the field list
        if (tableData) {
            renderWorkspaceFields(tableData.fields, 'custom', moduleData, tableName);
        }
    }
}

/**
 * Helper function to draw the field list on the left side of the workspace
 */
function renderWorkspaceFields(fieldsObj, mode = 'default', moduleData = null, tableName = '') {
    const fieldList = document.getElementById('module-field-list');
    if (!fieldList) return;
    fieldList.innerHTML = '';
    
    // 1. Add the "Master" button for overall module settings
    const masterLi = document.createElement('li');
    masterLi.innerHTML = `<a href="#" class="active" style="font-weight:600; color:var(--primary-color); border-bottom: 2px solid #eee; margin-bottom: 10px; padding-bottom: 12px;"><i class="fas fa-cogs" style="margin-right: 8px;"></i> Module Settings</a>`;
    
masterLi.addEventListener('click', (e) => {
        e.preventDefault();
        fieldList.querySelectorAll('a').forEach(link => link.classList.remove('active'));
        masterLi.querySelector('a').classList.add('active');
        
        document.getElementById('module-settings-empty').classList.add('hidden');
        document.getElementById('module-field-settings').classList.add('hidden');
        document.getElementById('module-global-settings').classList.remove('hidden');
        
        const currentTable = document.getElementById('workspace-module-title').dataset.tableName;
        if (currentTable) populateTableSettings(currentTable);
        
        const moduleId = document.getElementById('workspace-module-title').dataset.moduleId;
        
        if (moduleId) {
            // EDIT CUSTOM MODULE
            setTimeout(() => { 
                applyTableOverrides(currentTable, moduleId); 
                setupCustomModuleSpecificSettings(currentTable, moduleId, 'edit');
            }, 50);
        } else if (currentTable && mode === 'create') {
            // CREATE NEW CUSTOM MODULE
            setTimeout(() => { 
                setupCustomModuleSpecificSettings(currentTable, null, 'create');
            }, 50);
        } else {
            // DEFAULT MODULE
            setupCustomModuleSpecificSettings(currentTable, null, 'default');
        }
    });
    fieldList.appendChild(masterLi);
    
    // 2. Build the field array & sort it
    let fieldsArray = Object.keys(fieldsObj).map(fieldName => {
        const field = fieldsObj[fieldName];
        let order = 999; 
        if (mode === 'custom' && moduleData && moduleData.fields) {
            const modField = moduleData.fields.find(f => f.field_id === field.field_id);
            if (modField && modField.display_order !== undefined) {
                order = parseInt(modField.display_order);
            }
        }
        return { fieldName, field, order };
    });

    fieldsArray.sort((a, b) => a.order - b.order);

    // 3. Loop the sorted field list (WITHOUT INLINE BUTTONS)
    fieldsArray.forEach((item) => {
        const fieldName = item.fieldName;
        const fieldId = item.field.field_id;

        const li = document.createElement('li');
        li.dataset.fieldName = fieldName;
        li.dataset.fieldId = fieldId; // IMPORTANT FOR SAVE
        li.style.display = 'flex';
        li.style.alignItems = 'center';

        const a = document.createElement('a');
        a.href = "#";
        a.style.flexGrow = '1';
        a.innerHTML = `<i class="fas fa-columns" style="color: #888; margin-right: 8px;"></i> ${fieldName}`;
        
        a.addEventListener('click', (e) => {
            e.preventDefault();
            fieldList.querySelectorAll('a').forEach(link => link.classList.remove('active'));
            a.classList.add('active'); // Focus this item (visual & for sorting)
            
            document.getElementById('module-settings-empty').classList.add('hidden');
            document.getElementById('module-global-settings').classList.add('hidden');
            document.getElementById('module-field-settings').classList.remove('hidden');
            document.getElementById('current-module-field-name').textContent = fieldName;
            
            const currentTable = document.getElementById('workspace-module-title').dataset.tableName;
            if (currentTable) populateFieldSettings(currentTable, fieldName);
            
            const titleEl = document.getElementById('workspace-module-title');
            if (titleEl.dataset.moduleId) {
                setTimeout(() => { applyFieldOverrides(currentTable, fieldName, titleEl.dataset.moduleId); }, 50); 
            }
        });
        
        li.appendChild(a);
        fieldList.appendChild(li);
    });

    setTimeout(() => masterLi.click(), 50);
}

/**
 * Draws the cards for Default Modules and Custom Modules
 */
export function renderModulesDashboard() {
    const grid = document.getElementById('modules-dashboard-grid');
    if (!grid) return;
    
    const tables = appState.jsonData?.database?.table || {};
    let html = '';
    
    Object.keys(tables).forEach(tableName => {
        const tableData = tables[tableName];
        
        // 1. DRAW THE DEFAULT MODULE CARD (one per table)
        html += `
        <div class="module-card">
            <div class="module-card-header">
                <div>
                    <div class="module-title"><i class="fas fa-table" style="color:#aaa; margin-right:8px;"></i>${tableName}</div>
                    <div style="font-size: 0.85em; color: #888;">Base Table: ${tableName}</div>
                </div>
                <span class="module-badge badge-default">Default</span>
            </div>
            <div class="module-card-body">
                Standard module automatically generated from your database schema.
            </div>
            <div class="module-card-actions">
                <button class="btn btn-sm btn-secondary btn-edit-default" data-table-name="${tableName}"><i class="fas fa-paint-brush"></i> UI Setup</button>
            </div>
        </div>
        `;
        
        // 2. DRAW THE CUSTOM MODULE CARDS (if this table has custom modules)
        const customModules = tableData.custom_modules || [];
        customModules.forEach(mod => {
            html += `
            <div class="module-card" style="border-left: 4px solid var(--primary-color);">
                <div class="module-card-header">
                    <div>
                        <div class="module-title"><i class="fas ${mod.menu_icon || 'fa-eye'}" style="color:var(--primary-color); margin-right:8px;"></i>${mod.module_name}</div>
                        <div style="font-size: 0.85em; color: #888;">Base Table: ${tableName}</div>
                    </div>
                    <span class="module-badge badge-custom">Custom</span>
                </div>
                <div class="module-card-body">
                    Specialized module with custom constraints, record owners, and specific form layouts.
                </div>
                <div class="module-card-actions">
                    <button class="btn btn-sm btn-secondary btn-edit-custom" data-table-name="${tableName}" data-module-id="${mod.module_id}"><i class="fas fa-paint-brush"></i> UI Setup</button>
                    <button class="btn btn-sm btn-danger btn-delete-custom" data-module-id="${mod.module_id}"><i class="fas fa-trash-alt"></i></button>
                </div>
            </div>
            `;
        });
    });
    
    if (Object.keys(tables).length === 0) {
        grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #888;">No tables found. Please design your models first.</div>`;
    } else {
        grid.innerHTML = html;
    }
}

/**
 * MAGIC FUNCTION: Reads the override JSON and pastes it onto the UI
 */
function applyFieldOverrides(tableName, fieldName, moduleId) {
    const tableData = appState.jsonData.database.table[tableName];
    if (!tableData) return;

    // Find the module
    const moduleData = tableData.custom_modules?.find(m => m.module_id == moduleId);
    if (!moduleData || !moduleData.fields) return;

    // Find the field ID
    const originalField = tableData.fields[fieldName];
    if (!originalField) return;
    const fieldId = originalField.field_id;

    // Find the override for this field
    const overrideRecord = moduleData.fields.find(f => f.field_id === fieldId);
    if (!overrideRecord || !overrideRecord.settings_override) return;

    try {
        const settings = JSON.parse(overrideRecord.settings_override);
        
        console.log(`Applying Overrides for ${fieldName}:`, settings);

        // Loop every key in the JSON and update the UI
        Object.keys(settings).forEach(key => {
            const value = settings[key];
            
            // Find the input element by ID (convention: fld-setting_name -> fld-setting-name)
            // We need to convert underscores (_) to dashes (-) because HTML IDs use dashes
            const elementId = 'fld-' + key.replace(/_/g, '-');
            
            const el = document.getElementById(elementId);
            if (el) {
                // Update the UI visually without triggering the 'change' event (so it doesn't loop back into a save)
                if (el.type === 'checkbox') {
                    el.checked = (value === 1 || value === true);
                } else {
                    el.value = value;
                }
                
                // Visual feedback: give the border a yellow/green tint to show it's overridden
                el.style.borderColor = "#10b981"; // Green
                el.title = "This setting is overridden by Custom Module";
            }
        });

    } catch (e) {
        console.error("Error applying overrides:", e);
    }
}

/**
 * MAGIC FUNCTION 2: Reads the table override JSON and pastes it onto the UI
 */
function applyTableOverrides(tableName, moduleId) {
    const tableData = appState.jsonData.database.table[tableName];
    if (!tableData) return;

    // Find the module
    // Make sure moduleId is a number (integer) because in the dataset it's a string
    const modIdInt = parseInt(moduleId, 10);
    const moduleData = tableData.custom_modules?.find(m => m.module_id === modIdInt);
    
    if (!moduleData || !moduleData.settings_override) return;

    try {
        const settings = JSON.parse(moduleData.settings_override);
        console.log(`Applying Table Overrides for Module ${modIdInt}:`, settings);

        Object.keys(settings).forEach(key => {
            const value = settings[key];
            
            // ID convention: tbl-setting_name -> tbl-setting-name
            const dashedKey = key.replace(/_/g, '-');
            const elementId = 'tbl-' + dashedKey;
            
            // Try to find the standard element (input / select / checkbox)
            const el = document.getElementById(elementId);
            
            if (el) {
                // Update the visual UI
                if (el.type === 'checkbox') {
                    el.checked = (value === 1 || value === true);
                } else {
                    el.value = value;
                }
                
                // Visual feedback (green)
                el.style.borderColor = "#10b981"; 
                el.title = "This setting is overridden by Custom Module";
            
            } else {
                // Try to find the radio button (radios don't have unique IDs in the same format)
                // Radio names usually follow: tbl-setting-name
                const radioName = 'tbl-' + dashedKey;
                const radioSelector = `input[name="${radioName}"][value="${value}"]`;
                const radioBtn = document.querySelector(radioSelector);
                
                if (radioBtn) {
                    radioBtn.checked = true;
                    // For radios, we could mark the parent label if possible, or just leave it
                }
            }
        });

        // Card-size overrides change which controls are relevant and how the
        // live preview looks — refresh both after applying the JSON.
        toggleCardSizeGroup();
        updateTableViewTemplatePreview();

    } catch (e) {
        console.error("Error applying table overrides:", e);
    }
}

/**
 * UX HELPER FUNCTION: Gives a visual effect (green highlight) on the changed row
 */
function highlightLi(li) {
    li.style.transition = 'background-color 0.3s';
    li.style.backgroundColor = '#e8f5e9'; // Soft green
    setTimeout(() => li.style.backgroundColor = 'transparent', 300);
}

/**
 * PHASE 3: Saves the new field order to the database
 */
async function saveFieldOrder(tableName, moduleId) {
    const tableData = appState.jsonData.database.table[tableName];
    
    // Make sure moduleId is read as an integer (number)
    const modIdInt = parseInt(moduleId, 10);
    const moduleIndex = tableData.custom_modules.findIndex(m => m.module_id === modIdInt);
    
    if (moduleIndex === -1) {
        console.error("❌ Module not found in AppState.");
        return;
    }

    const modData = tableData.custom_modules[moduleIndex];
    
    // We look for the LI elements that have a field name
    const listItems = document.querySelectorAll('#module-field-list li[data-field-name]'); 
    
    const updatedFields = [];
    
    listItems.forEach((li, index) => {
        const fieldName = li.dataset.fieldName;
        let fieldId = li.dataset.fieldId ? parseInt(li.dataset.fieldId, 10) : null;
        if (isNaN(fieldId)) fieldId = null;
        
        // Data preservation: find the original settings by ID or name
        const existingFieldData = modData.fields.find(f => 
            (fieldId && f.field_id === fieldId) || 
            f.sourceName === fieldName || 
            f.field_source_name === fieldName ||
            f.field_name === fieldName
        ) || {
            is_readonly: 0,
            settings_override: "{}"
        };
        
        // BUILD THE COMPLETE PAYLOAD FOR THE BACKEND
        updatedFields.push({
            ...existingFieldData,
            field_id: fieldId,             
            sourceName: fieldName,         // Must be sent to avoid "undefined" errors
            field_name: fieldName,         // Alternative name if the backend uses this key
            displayOrder: index + 1,       // camelCase format for fallback
            display_order: index + 1       // snake_case format (Phase 3 standard)
        });
    });

    // 1. Save to AppState (RAM)
    modData.fields = updatedFields;

    // 2. Build the full payload for the API
    const payload = {
        module_id: modData.module_id,
        table_id: tableData.table_id,
        module_name: modData.module_name,
        menu_icon: modData.menu_icon,
        fields: updatedFields // Send the complete field list
    };

    // 3. Send to the backend
    if (window.electronAPI.saveCustomModule) {
        try {
            const result = await window.electronAPI.saveCustomModule(payload);
            if (result.success) {
                console.log("✅ Field order saved successfully!");
            } else {
                console.error("❌ Failed to save field order:", result.message);
            }
        } catch (err) {
            console.error("❌ Execution error in saveCustomModule API:", err);
        }
    }
}

// --- HELPER TO EXTRACT NESTED DATA ---
export function extractGroupData(groupEl) {
    const condition = groupEl.querySelector(':scope > .group-header .group-condition').value;
    const rules = [];
    const container = groupEl.querySelector(':scope > .group-rules-container');
    
    Array.from(container.children).forEach(child => {
        if (child.classList.contains('cm-filter-rule-row')) {
            const col = child.querySelector('.rule-col').value;
            if (col) {
                rules.push({
                    column: col,
                    operator: child.querySelector('.rule-op').value,
                    value: child.querySelector('.rule-val').value
                });
            }
        } else if (child.classList.contains('cm-filter-group')) {
            const subGroup = extractGroupData(child);
            if (subGroup.rules.length > 0) rules.push(subGroup);
        }
    });
    return { condition, rules };
}

/**
 * PHASE 3: Nested query builder + dynamic auto-save system
 */
export function setupCustomModuleSpecificSettings(tableName, moduleId, mode = 'edit') {
    const specificSettingsDiv = document.getElementById('custom-module-specific-settings');
    if (!specificSettingsDiv) return;

    if (mode === 'default' || !tableName) {
        specificSettingsDiv.classList.add('hidden');
        return;
    }

    const tableData = appState.jsonData.database.table[tableName];
    if (!tableData) return;

    let modData = { filter_rules: '{"condition":"AND", "rules":[]}' }; 
    if (mode === 'edit' && moduleId) {
        const found = tableData.custom_modules?.find(m => m.module_id == moduleId);
        if (found) modData = found; else return;
    }

    specificSettingsDiv.classList.remove('hidden');

    const filterContainer = document.getElementById('workspace-filter-builder-container');
    if (filterContainer) {
        let rootData = { condition: 'AND', rules: [] };
        try { 
            const parsed = typeof modData.filter_rules === 'string' ? JSON.parse(modData.filter_rules) : (modData.filter_rules || []); 
            if (Array.isArray(parsed)) rootData.rules = parsed; 
            else if (parsed && parsed.rules) rootData = parsed;
        } catch(e){}

        // Basic UI skeleton (no manual Save button)
        filterContainer.innerHTML = `
            <div id="cm-filter-rules-root"></div>
            <div id="cm-save-rules-wrapper" style="margin-top: 20px; border-top: 1px solid #eee; padding-top: 15px; display: flex; gap: 10px; align-items: center;">
                <span id="cm-specifics-save-status" style="color: #10b981; font-weight: bold; opacity: 0; transition: opacity 0.3s;"><i class="fas fa-check-circle"></i> Auto-saved!</span>
                <small style="color:#888; margin-left: auto; font-style: italic;">Changes are saved automatically.</small>
            </div>
        `;

        if (mode === 'create') document.getElementById('cm-save-rules-wrapper').style.display = 'none';

        const rootContainer = document.getElementById('cm-filter-rules-root');
        const cols = Object.keys(tableData.fields);

        // --- DEBOUNCED AUTO-SAVE SYSTEM ---
        let autoSaveTimeout;
        const triggerAutoSave = async () => {
            // Don't save in create-module mode (wait for the Create button)
            if (mode === 'create') return; 

            const rootGroup = rootContainer.querySelector('.cm-filter-group');
            if (!rootGroup) return;
            const finalData = extractGroupData(rootGroup);

            modData.filter_rules = JSON.stringify(finalData);
            
            // ▼▼▼ READ TABLE-LEVEL OVERRIDES FOR AUTO-SAVE ▼▼▼
            const tableOverrides = { table_view_title: document.getElementById('tbl-table-view-title')?.value || '' };
            modData.settings_override = JSON.stringify(tableOverrides);

            const payload = {
                module_id: modData.module_id,
                table_id: tableData.table_id,
                module_name: modData.module_name,
                menu_icon: modData.menu_icon,
                owner_only: modData.owner_only,
                owner_field: modData.owner_field,
                fields: modData.fields,
                filter_rules: modData.filter_rules,
                settings_override: modData.settings_override // <--- SEND TO BACKEND
            };

            if (window.electronAPI.saveCustomModule) {
                const res = await window.electronAPI.saveCustomModule(payload);
                if (res.success) {
                    const status = document.getElementById('cm-specifics-save-status');
                    status.style.opacity = '1';
                    setTimeout(() => status.style.opacity = '0', 2000);
                }
            }
        };

        const debounceAutoSave = () => {
            clearTimeout(autoSaveTimeout);
            autoSaveTimeout = setTimeout(() => {
                triggerAutoSave();
            }, 600); // Wait 600ms after the user stops interacting
        };

        // Event delegation for inputs & dropdowns
        rootContainer.addEventListener('change', (e) => {
            if (e.target.tagName === 'SELECT' || e.target.type === 'radio' || e.target.type === 'checkbox') debounceAutoSave();
        });
        rootContainer.addEventListener('keyup', (e) => {
            if (e.target.tagName === 'INPUT' && e.target.type === 'text') debounceAutoSave();
        });


        // RECURSIVE RENDER FUNCTION
        const renderRuleGroup = (groupData, container, isRoot = false) => {
            const groupEl = document.createElement('div');
            groupEl.className = 'cm-filter-group';
            groupEl.style.cssText = `border: 1px solid ${isRoot ? '#ddd' : '#2196f3'}; padding: 12px; margin-top: 10px; border-radius: 6px; background: ${isRoot ? '#fdfdfd' : '#f0f8ff'};`;

            const header = document.createElement('div');
            header.className = 'group-header';
            header.style.cssText = 'display: flex; gap: 10px; margin-bottom: 10px; align-items: center;';
            
            const condSelect = document.createElement('select');
            condSelect.className = 'form-control group-condition';
            condSelect.style.width = '80px';
            condSelect.innerHTML = `<option value="AND" ${groupData.condition === 'AND' ? 'selected' : ''}>AND</option><option value="OR" ${groupData.condition === 'OR' ? 'selected' : ''}>OR</option>`;
            
            const btnAddRule = document.createElement('button');
            btnAddRule.className = 'btn btn-sm btn-secondary';
            btnAddRule.innerHTML = '<i class="fas fa-plus"></i> Rule';
            
            const btnAddGroup = document.createElement('button');
            btnAddGroup.className = 'btn btn-sm btn-info';
            btnAddGroup.innerHTML = '<i class="fas fa-folder-plus"></i> Group';

            header.appendChild(condSelect);
            header.appendChild(btnAddRule);
            header.appendChild(btnAddGroup);

            if (!isRoot) {
                const btnRemoveGroup = document.createElement('button');
                btnRemoveGroup.className = 'btn btn-sm btn-danger';
                btnRemoveGroup.style.marginLeft = 'auto';
                btnRemoveGroup.innerHTML = '<i class="fas fa-trash"></i> Delete Group';
                // Trigger auto-save when a group is removed
                btnRemoveGroup.onclick = () => { groupEl.remove(); debounceAutoSave(); };
                header.appendChild(btnRemoveGroup);
            }

            const rulesContainer = document.createElement('div');
            rulesContainer.className = 'group-rules-container';
            rulesContainer.style.cssText = 'display: flex; flex-direction: column; gap: 8px; margin-left: 10px; border-left: 2px solid #ccc; padding-left: 15px;';

            groupEl.appendChild(header);
            groupEl.appendChild(rulesContainer);

            if (groupData.rules && groupData.rules.length > 0) {
                groupData.rules.forEach(rule => {
                    if (rule.condition !== undefined) renderRuleGroup(rule, rulesContainer);
                    else renderRuleItem(rule, rulesContainer);
                });
            } else {
                if (isRoot) renderRuleItem({}, rulesContainer);
            }

            // Trigger auto-save when a rule/group is added
            btnAddRule.onclick = () => { renderRuleItem({}, rulesContainer); debounceAutoSave(); };
            btnAddGroup.onclick = () => { renderRuleGroup({ condition: 'AND', rules: [{}] }, rulesContainer); debounceAutoSave(); };

            container.appendChild(groupEl);
        };

        // RULE ITEM RENDER FUNCTION
        const renderRuleItem = (ruleData, container) => {
            const row = document.createElement('div');
            row.className = 'cm-filter-rule-row';
            row.style.cssText = 'display: flex; gap: 10px; align-items: center;';
            row.innerHTML = `
                <select class="form-control rule-col" style="flex: 1;">
                    <option value="">-- Select Field --</option>
                    ${cols.map(c => `<option value="${c}" ${c === ruleData.column ? 'selected' : ''}>${c}</option>`).join('')}
                </select>
                <select class="form-control rule-op" style="width: 120px;">
                    ${['=', '!=', '>', '<', '>=', '<=', 'LIKE', 'NOT LIKE'].map(op => `<option value="${op}" ${op === ruleData.operator ? 'selected' : ''}>${op}</option>`).join('')}
                </select>
                <input type="text" class="form-control rule-val" placeholder="Value (e.g. active, 1, NULL)" style="flex: 1;" value="${ruleData.value || ''}">
                <button class="btn btn-danger btn-sm rule-del"><i class="fas fa-times"></i></button>
            `;
            // Trigger auto-save when an individual rule is removed
            row.querySelector('.rule-del').onclick = () => { row.remove(); debounceAutoSave(); };
            container.appendChild(row);
        };

        // Start drawing the root
        renderRuleGroup(rootData, rootContainer, true);

        // ▼▼▼ BIND AUTO-SAVE TO THE TABLE TITLE BOX ▼▼▼
        const globalSettingsBox = document.getElementById('module-global-settings');
        if (globalSettingsBox && !globalSettingsBox.dataset.cmBound) {
            const handleGlobalChange = (e) => {
                if (document.getElementById('workspace-module-badge')?.classList.contains('badge-custom')) {
                    if (e.target.id && e.target.id.startsWith('tbl-')) debounceAutoSave();
                }
            };
            globalSettingsBox.addEventListener('change', handleGlobalChange);
            globalSettingsBox.addEventListener('keyup', handleGlobalChange);
            globalSettingsBox.dataset.cmBound = "true"; 
        }
    }
}