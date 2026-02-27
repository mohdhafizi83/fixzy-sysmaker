// src/js/handlers/tableHandlers.js

import { appState } from '../state.js';
import { SaveManager } from '../saveManager.js';
import { showCustomDialog } from '../ui/modalHandlers.js';
import { setElementValue, setRadioValue } from '../ui/formHelpers.js';
import { populateTableSettings } from '../pages/tableSettings.js';
import { populateFieldSettings } from '../pages/fieldSettings.js';
import { populateMenuManagement } from './menuHandlers.js';
import { loadProjectData } from '../../renderer.js';

export function initializeTableSaveHandlers() {
    // Kumpul kedua-dua container lama dan baharu
    const containers = [
        document.getElementById('table-settings-page'),
        document.getElementById('module-global-settings') // TAPAK BAHARU FASA 3A
    ];

    containers.forEach(container => {
        if (!container) return;

        ['change', 'focusout'].forEach(eventType => {
            container.addEventListener(eventType, (e) => {
                const input = e.target;
                
                // Abaikan input parent-child
                if (input.closest('#parent-child-settings')) return;
                if (input.id && input.id.startsWith('parentchild-')) return;
                
// ▼▼▼ PEMBAIKAN BUG MAJOR: HALANG OVERWRITE JIKA DALAM MOD CUSTOM/CREATE ▼▼▼
                const badgeEl = document.getElementById('workspace-module-badge');
                const titleEl = document.getElementById('workspace-module-title');
                const isCustomMode = badgeEl && badgeEl.classList.contains('badge-custom');
                const isCreateMode = titleEl && titleEl.textContent === "Create New Module";
                
                if (isCustomMode || isCreateMode) {
                    // Jika ini Mod Custom, JANGAN simpan ke jadual asal!
                    // Sistem Auto-Save Custom Module akan menguruskannya.
                    return; 
                }
                // ▲▲▲ TAMAT PEMBAIKAN ▲▲▲

                if (eventType === 'focusout' && !['text', 'textarea', 'number'].includes(input.type) && input.tagName !== 'TEXTAREA') return;
                if (eventType === 'change' && ['text', 'textarea', 'number'].includes(input.type) && input.tagName !== 'TEXTAREA') return;
                if (!['INPUT', 'SELECT', 'TEXTAREA'].includes(input.tagName)) return;
                if (input.type === 'search') return;

                if (appState.isPopulatingData || !appState.isAutoSaveEnabled) return;

                // ==========================================
                // MENGENAL PASTI KONTEKS (DEFAULT ATAU CUSTOM)
                // ==========================================
                let tableName = '';
                const titleElWorkspace = document.getElementById('workspace-module-title');
                const isWorkspaceActive = !document.getElementById('module-global-settings').classList.contains('hidden');
                
                if (isWorkspaceActive) {
                    // Jika sedang mengedit dari Modules Setup
                    tableName = titleElWorkspace.dataset.tableName;
                } else {
                    // Jika sedang mengedit dari Models Design lama
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
                // ROUTING PENYIMPANAN DATA
                // ==========================================
                const badgeText = document.getElementById('workspace-module-badge')?.textContent;
                const isCustomModule = isWorkspaceActive && badgeText === 'Custom';

if (isCustomModule) {
                    const moduleId = parseInt(titleElWorkspace.dataset.moduleId);
                    
                    // 1. Dapatkan Data Modul dari AppState
                    const tableData = appState.jsonData.database.table[tableName];
                    const moduleIndex = tableData.custom_modules.findIndex(m => m.module_id === moduleId);
                    
                    if (moduleIndex === -1) return;

                    // 2. Parse JSON Override Sedia Ada (Table Level)
                    let currentSettings = {};
                    try {
                        // Pastikan settings_override wujud dalam objek, jika tidak kosongkan
                        const existingJson = tableData.custom_modules[moduleIndex].settings_override || "{}";
                        currentSettings = JSON.parse(existingJson);
                    } catch (e) {
                        currentSettings = {};
                    }

                    // 3. Kemas kini nilai
                    currentSettings[key] = value;
                    const jsonString = JSON.stringify(currentSettings);

                    // 4. Simpan ke AppState (RAM) supaya UI responsif
                    tableData.custom_modules[moduleIndex].settings_override = jsonString;

                    console.log(`[CUSTOM MODULE] Menyimpan Table Override -> Modul ID: ${moduleId} | ${key}: ${value}`);

                    // 5. Hantar ke Backend (Database)
                    window.electronAPI.saveCustomTableOverride({
                        module_id: moduleId,
                        settings_override: jsonString
                    }).then(res => {
                        if (!res.success) {
                            console.error("Gagal menyimpan table override:", res.message);
                            // Pilihan: Tunjuk toast error
                        }
                    });

                    } else {
                    // ... (Kod Default Module asal kekal di sini) ...
                    console.log(`[DEFAULT MODULE] Menyimpan -> Jadual: ${tableName} | ${key}: ${value}`);
                    SaveManager.addToQueue('table', tableId, { [key]: value });

// ▼▼▼ PENYEGERAKAN MEMORI & UI (SILENT RELOAD) ▼▼▼
                    // PEMBETULAN: Gunakan 'focusout' kerana input teks diabaikan pada 'change'
                    if (eventType === 'focusout' && key === 'table_name') {
                        const oldName = tableName;
                        const newName = value;
                        
                        console.log(`[Silent Reload] Mengemas kini Jadual: ${oldName} -> ${newName} (ID: ${tableId})`);
                        
                        // 1. Kemas kini Kunci (Key) di dalam AppState
                        if (appState.jsonData.database.table[oldName]) {
                            appState.jsonData.database.table[newName] = appState.jsonData.database.table[oldName];
                            appState.jsonData.database.table[newName].table_name = newName;
                            delete appState.jsonData.database.table[oldName];
                        }
                        
                        // Kemas kini array allTableNames
                        const tIdx = appState.allTableNames?.indexOf(oldName);
                        if (tIdx !== -1 && tIdx !== undefined) appState.allTableNames[tIdx] = newName;

                        // 2. Kemas kini UI Sidebar secara TEPAT menggunakan data-table-id
                        const tableSpan = document.querySelector(`li[data-table-id="${tableId}"] > a > span`);
                        if (tableSpan) {
                            tableSpan.textContent = newName;
                            tableSpan.parentElement.title = `Table Name: ${newName}`; 
                        }

                        // 3. Kemas kini Breadcrumb & Tajuk Workspace
                        const titleTable = document.querySelector('#table-settings-page .table-name');
                        if (titleTable) titleTable.textContent = newName;
                        
                        if (titleElWorkspace && titleElWorkspace.dataset.tableName === oldName) {
                            titleElWorkspace.textContent = newName;
                            titleElWorkspace.dataset.tableName = newName;
                        }
                    }
                    // ▲▲▲ TAMAT PENYEGERAKAN ▲▲▲
                }
            });
        });
    });
}

export function initializeRelationshipSaveHandlers() {
    console.log("🛠️ Relationship Handlers: Init dipanggil."); 

    // ▼▼▼ KEMAS KINI 1: Pasang telinga pada kedua-dua kawasan UI ▼▼▼
    const containers = [
        document.getElementById('table-settings-page'),
        document.getElementById('module-global-settings') // UI BAHARU FASA 3A
    ];
    
    containers.forEach(container => {
        if (!container) return;

        ['change', 'focusout'].forEach(eventType => {
            container.addEventListener(eventType, (e) => {
                const input = e.target;
                const inputId = input.id || '';

                if (!inputId.startsWith('parentchild-')) return;

                console.log(`🔥 Event '${eventType}' dikesan pada input Relationship: ${inputId}`);

                if (eventType === 'focusout' && !['text', 'textarea', 'number'].includes(input.type)) return;
                if (eventType === 'change' && ['text', 'textarea', 'number'].includes(input.type)) return;
                
                if (appState.isPopulatingData) {
                    console.warn("Save dihalang: isPopulatingData = true");
                    return;
                }

                // ▼▼▼ KEMAS KINI 2: Dapatkan Parent Table Name dari DOM yang tepat ▼▼▼
                let currentTableName = '';
                const titleElWorkspace = document.getElementById('workspace-module-title');
                const isWorkspaceActive = !document.getElementById('module-global-settings').classList.contains('hidden');
                
                if (isWorkspaceActive && titleElWorkspace) {
                    currentTableName = titleElWorkspace.dataset.tableName;
                } else {
                    currentTableName = document.querySelector('#table-settings-page .table-name')?.textContent.trim();
                }
                // ▲▲▲ TAMAT KEMAS KINI 2 ▲▲▲
                
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
                    console.error("❌ Gagal mengesan Table Induk atau Child Table yang aktif.");
                    return;
                }

                const relData = appState.jsonData.database.relationships.find(
                    r => r.parent_table_name === currentTableName && r.child_table_name === childTableName
                );

                if (!relData) {
                    console.error("❌ Data Relationship tiada dalam AppState untuk pasangan ini.");
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

                            // Tambah atau buang dari Array JSON
                            if (value === 1 && !includedRels.includes(childTableName)) {
                                includedRels.push(childTableName);
                            } else if (value === 0) {
                                includedRels = includedRels.filter(t => t !== childTableName);
                            }

                            const jsonString = JSON.stringify(includedRels);
                            modData.included_relations = jsonString; // Simpan di RAM

                            console.log(`[CUSTOM MODULE] Menyimpan included_relations -> ${jsonString}`);

                            // Hantar payload penuh ke Backend untuk Update
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
                                if (!res.success) console.error("Gagal simpan relations:", res.message);
                            });
                        }
                    } else {
                        // Halang tetapan lain diubah
                        showCustomDialog({ title: "Global Setting", message: "Only 'Show Tab' (Include/Exclude) can be customized per Custom Module. Other settings are shared globally."});
                        if (input.type === 'checkbox') input.checked = !input.checked;
                    }
                    return; // Tamat proses untuk Custom Module
                }
                // ▲▲▲ TAMAT ROUTING ▲▲▲

                // --- GLOBAL SAVE UNTUK DEFAULT MODULE ---
                console.log(`🚀 Menghantar ke SaveManager: RelID=${relData.relationship_id}, Key=${key}, Val=${value}`);
                SaveManager.addToQueue('relationship', relData.relationship_id, { [key]: value });
            });
        });
    });

    console.log("✅ Relationship Handlers berjaya dipasang (Mode: Dual Container Fasa 3A).");
}

// ==========================================================================
// ARAHAN: SILA PINDAHKAN FUNGSI-FUNGSI BERIKUT DARI uiHandlers.js KE SINI
// ==========================================================================
// Sila Cut (Potong) & Paste (Tampal) fungsi-fungsi UI yang panjang ini 
// dari uiHandlers.js asal anda ke bahagian bawah fail ini.
//
// Senarai fungsi yang perlu dipindahkan:
// 
export function populateSortByDropdown(tableName, elementId = 'tbl-default-sort-by') {
    const sortByDropdown = document.getElementById(elementId);
    if (!sortByDropdown || !appState.jsonData) return;
    
    // Kosongkan senarai sedia ada
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

export function populateFocusFieldDropdown(tableName) {
    const defaultFocusDropdown = document.getElementById('tbl-default-focus');
    if (!defaultFocusDropdown || !appState.jsonData) return;

    defaultFocusDropdown.innerHTML = ''; // Kosongkan senarai

    const table = appState.jsonData.database.table[tableName];
    if (table && table.fields) {
        // ▼▼▼ KEMAS KINI UTAMA DI SINI ▼▼▼
        // 1. Dapatkan semua nama medan
        const allFieldNames = Object.keys(table.fields);

        // 2. Tapis untuk mendapatkan medan yang boleh disunting sahaja
        const editableFields = allFieldNames.filter(fieldName => {
            return table.fields[fieldName].read_only !== 1;
        });
        // ▲▲▲ TAMAT KEMAS KINI ▲▲▲

        const firstEditableField = editableFields.length > 0 ? editableFields[0] : '';
        
        defaultFocusDropdown.innerHTML = `<option value="${firstEditableField}">First editable field (${firstEditableField})</option><option value="__none__">Don't focus any field</option>`;
        
        // 3. Gunakan senarai yang telah ditapis untuk menjana opsyen
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

    // Kosongkan opsyen sedia ada
    recordOwnerDropdown.innerHTML = '';

    // 1. Tambah opsyen lalai
    const defaultOption = document.createElement('option');
    defaultOption.value = 'current_user'; // Nilai kosong untuk 'Current user'
    defaultOption.textContent = 'Current user (default)';
    recordOwnerDropdown.appendChild(defaultOption);

    // ▼▼▼ LOGIK YANG DIPERBAIKI ▼▼▼
    // 2. Cari dan tambah semua medan kunci asing (foreign key) berdasarkan data hubungan
    const relationships = appState.jsonData.database.relationships || [];
    
    relationships.forEach(rel => {
        // Cari hubungan di mana jadual semasa adalah JADUAL ANAK (child)
        if (rel.child_table_name === tableName) {
            const fkFieldName = rel.fk_child_field;
            
            const lookupOption = document.createElement('option');
            lookupOption.value = fkFieldName;
            lookupOption.textContent = fkFieldName;
            recordOwnerDropdown.appendChild(lookupOption);
        }
    });
    // ▲▲▲ TAMAT LOGIK YANG DIPERBAIKI ▲▲▲
}

/**
 * Mengemas kini imej di dalam kotak "Template preview" berdasarkan
 * pilihan semasa dropdown 'tbl-tv-template'.
 */
export function updateTableViewTemplatePreview() {
    const templateSelect = document.getElementById('tbl-tv-template');
    const previewArea = document.querySelector('#tab-template .theme-preview-window');

    if (!templateSelect || !previewArea) {
        console.warn("Elemen untuk template preview tidak ditemui.");
        return;
    }

    const selectedValue = templateSelect.value;
    if (selectedValue) {
        const imagePath = `../assets/images/${selectedValue}.png`;
        previewArea.innerHTML = `<img src="${imagePath}" alt="Preview untuk template ${selectedValue}" style="width: 100%; object-fit: contain;">`;
    } else {
        // Jika tiada pilihan, paparkan teks lalai
        previewArea.innerHTML = '<p style="text-align: center; color: var(--secondary-color);">Template preview area</p>';
    }
}

/**
 * Memasang event listener pada dropdown 'tbl-tv-template'
 * supaya ia mengemas kini imej setiap kali pilihan ditukar.
 */
export function initializeTemplatePreviewHandlers() {
    const templateSelect = document.getElementById('tbl-tv-template');
    if (templateSelect) {
        templateSelect.addEventListener('change', updateTableViewTemplatePreview);
    }
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

    // Panggil sekali untuk tetapan awal
    toggleStaticInput();
}

/**
 * Mengisi kandungan tab "Constraints" dengan senarai kekangan sedia ada.
 * @param {string} tableName - Nama jadual semasa.
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
 * Memasang semua event listener untuk ciri pengurusan kekangan.
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
 * Mengisi kandungan tab "Custom Modules" dengan senarai view yang telah dicipta.
 * @param {string} tableName - Nama jadual semasa.
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
 * Fungsi utama untuk memasang semua event listener untuk ciri Custom Modules.
 */
export function initializeCustomViews() {
    const modulesSetupWorkspace = document.getElementById('modules-setup-workspace');
    if (!modulesSetupWorkspace) return;

    // Pasang listener untuk butang di dalam Modal Custom Module
    initializeCustomModuleModalLogic();

    // Event delegation untuk butang "Add", "Edit", dan "Delete" di dalam tab
    modulesSetupWorkspace.addEventListener('click', e => {
const currentTableName = document.getElementById('modules-setup-table-select').value;
        if (!currentTableName) return;

        // Butang Add Baru
        if (e.target.closest('#btn-add-custom-module')) {
            populateCustomModuleModal(currentTableName);
        }

        // Butang Edit
        const editBtn = e.target.closest('.cv-edit-btn');
        if (editBtn) {
            const viewId = parseInt(editBtn.dataset.viewId, 10);
            const viewData = appState.jsonData.database.table[currentTableName]?.custom_modules.find(v => v.module_id === viewId);
            if (viewData) populateCustomModuleModal(currentTableName, viewData);
        }

        // Butang Delete
        const deleteBtn = e.target.closest('.cv-delete-btn');
        if (deleteBtn) {
            const viewId = parseInt(deleteBtn.dataset.viewId, 10);
            deleteCustomView(viewId); // Fungsi ini kekal seperti sedia ada di bawah
        }
    });
}

/**
 * Memaparkan modal Custom Module dengan data yang betul.
 */
export function populateCustomModuleModal(tableName, viewData = null) {
    const modal = document.getElementById('custom-module-config-modal');
    const title = document.getElementById('cv-modal-title');
    const saveBtn = document.getElementById('cv-modal-save');
    const nextBtn = document.getElementById('cv-modal-next');
    
    // Langkah 1 Elements
    const nameInput = document.getElementById('cv-view-name');
    const iconInput = document.getElementById('cv-menu-icon');
    const ownerOnlyCheck = document.getElementById('cv-owner-only-checkbox'); // ID DIKEMASKINI
    const ownerFieldSelect = document.getElementById('cv-owner-field-select'); // ID DIKEMASKINI
    const ownerFieldContainer = document.getElementById('cv-owner-field-container');

    // Langkah 2 Elements
    const availableFieldsList = document.getElementById('cv-available-fields-list');
    const formLayoutPanel = document.getElementById('cv-form-layout-panel');

    if (!modal || !appState.jsonData.database.table[tableName]) return;
    const tableData = appState.jsonData.database.table[tableName];

    // Reset UI Navigation (Kembali ke Langkah 1)
    document.getElementById('cv-step-1').classList.remove('hidden');
    document.getElementById('cv-step-2').classList.add('hidden');
    document.getElementById('cv-modal-back').classList.add('hidden');
    saveBtn.classList.add('hidden');
    nextBtn.classList.remove('hidden');

    // Reset Fields UI
    availableFieldsList.innerHTML = '';
    formLayoutPanel.innerHTML = '';

    // 1. SET MAKLUMAT ASAS & OWNER (Langkah 1)
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
    ownerOnlyCheck.removeEventListener('change', toggleOwnerField); // Elak duplicate listener
    ownerOnlyCheck.addEventListener('change', toggleOwnerField);
    toggleOwnerField();

    // 2. BINA SENARAI MEDAN UNTUK FORM LAYOUT (Langkah 2)
    const template = document.getElementById('cv-form-field-template');
    
    Object.values(tableData.fields).forEach(field => {
        const clone = template.content.cloneNode(true);
        const itemDiv = clone.querySelector('.form-field-item');
        
        itemDiv.dataset.sourceName = field.field_name;
        itemDiv.querySelector('.field-label').textContent = field.field_name;
        itemDiv.querySelector('.field-source').textContent = `Type: ${field.data_type}`;

        // Semak jika medan ini sudah dipilih (untuk Edit Mode)
        let isSelected = false;
        if (viewData && viewData.fields) {
            const savedField = viewData.fields.find(f => (f.sourceName || f.field_source_name) === field.field_name);
            if (savedField) {
                isSelected = true;
                itemDiv.querySelector('.is-readonly-checkbox').checked = (savedField.isReadonly == 1 || savedField.is_readonly == 1);
                
                // Ekstrak Label Override (JSON Settings Override)
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

        // Masukkan ke ruangan yang sepatutnya
        if (isSelected) {
            formLayoutPanel.appendChild(clone);
        } else {
            availableFieldsList.appendChild(clone);
        }
    });

    modal.classList.remove('hidden');
}

/**
 * Logik navigasi modal dan menyimpan data Modul.
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

    // --- LOGIK NAVIGATION TAB ---
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

    // --- LOGIK DRAG / PINDAH MEDAN ---
    const addSelectedBtn = document.getElementById('cv-add-field-btn');
    const removeSelectedBtn = document.getElementById('cv-remove-field-btn');
    
    // (Boleh tambah logik pemilihan klik atau drag-and-drop di sini jika UI anda menyokong selection.
    // Sebagai alternatif ringkas, kita pindahkan semua yang di-klik ke ruang sebelah).
    document.getElementById('cv-available-fields-list').addEventListener('click', (e) => {
        const item = e.target.closest('.form-field-item');
        if (item) document.getElementById('cv-form-layout-panel').appendChild(item);
    });

    document.getElementById('cv-form-layout-panel').addEventListener('click', (e) => {
        // Logik buang (delete butang)
        if (e.target.closest('.delete-form-field-btn')) {
            const item = e.target.closest('.form-field-item');
            if (item) document.getElementById('cv-available-fields-list').appendChild(item);
        }
    });

    // --- LOGIK PENYIMPANAN KE BACKEND ---
    const newSaveBtn = btnSave.cloneNode(true); // Ganti butang untuk elak duplicate listener
    btnSave.parentNode.replaceChild(newSaveBtn, btnSave);

    newSaveBtn.addEventListener('click', async () => {
const currentTableName = document.getElementById('modules-setup-table-select').value;
        const tableData = appState.jsonData.database.table[currentTableName];
        if (!tableData) return;

        // Kumpul Fields dari Form Layout
        const selectedFields = [];
        const layoutItems = document.querySelectorAll('#cv-form-layout-panel .form-field-item');
        layoutItems.forEach((item, index) => {
            const labelInput = item.querySelector('.field-label-override-input');
            const readOnlyCheck = item.querySelector('.is-readonly-checkbox');
            
            selectedFields.push({
                sourceName: item.dataset.sourceName,
                label: labelInput ? labelInput.value.trim() : '',     // Akan ditukar ke JSON settings_override di backend
                isReadonly: readOnlyCheck ? readOnlyCheck.checked : false,
                displayOrder: index
            });
        });

        // Bina Payload Akhir
        const payload = {
            table_id: tableData.table_id,
            module_name: document.getElementById('cv-view-name').value.trim(),
            menu_icon: document.getElementById('cv-menu-icon').value.trim(),
            owner_only: document.getElementById('cv-owner-only-checkbox').checked ? 1 : 0,
            owner_field: document.getElementById('cv-owner-field-select').value,
            fields: selectedFields
            // Anda boleh tambah filter_rules & included_relations di sini kemudian
        };

        const editingId = newSaveBtn.getAttribute('data-editing-id');
        if (editingId) payload.module_id = editingId; // Berikan ID untuk update

        // Hantar ke Backend
        try {
            // Memanggil Backend IPC secara terus untuk kestabilan modul kompleks ini
            // Pastikan preload.js anda mempunyai api: saveCustomModule
            let result;
            if (window.electronAPI.saveCustomModule) {
                result = await window.electronAPI.saveCustomModule(payload);
            } else {
                // Fallback kepada invoke lama jika tiada
                result = await window.electronAPI.createCustomView(payload); 
            }

            if (result && result.success) {
                showCustomDialog({ title: "Success", message: "Custom Module saved successfully!" });
                closeMyModal();
                // Reload data dan refresh tab (jika ada fungsi refresh)
                if (typeof window.populateCustomViewsTab === 'function') {
                    // Update state secara manual atau fetch data semula dari DB
                    // (Bergantung pada cara aplikasi anda memuat semula data)
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
                // 1. Dapatkan nama jadual DARI DOM
                const tableNameElement = document.querySelector('#table-settings-page .table-name');
                const tableName = tableNameElement ? tableNameElement.textContent.trim() : null;
                
                // 2. Panggil API Delete Backend
                const result = await window.electronAPI.deleteCustomView(viewId);
                
                if (result && result.success) {
                    console.log("✅ Delete Berjaya di Backend.");

                    // Reload Keseluruhan Data
                    await loadProjectData(appState.activeProject);
                    
                    // ▼▼▼ PEMBAIKAN: Kekalkan paparan Dashboard (Grid Kad) ▼▼▼
                    // Pastikan workspace disembunyikan dan Dashboard dipaparkan
                    const workspace = document.getElementById('module-workspace');
                    if (workspace) workspace.style.display = 'none';
                    
                    const header = document.getElementById('modules-dashboard-header');
                    if (header) header.style.display = 'flex';
                    
                    const grid = document.getElementById('modules-dashboard-grid');
                    if (grid) grid.style.display = 'grid';

                    // Lukis semula kad tanpa memanggil openModuleWorkspace
                    renderModulesDashboard();
                    // ▲▲▲ TAMAT PEMBAIKAN ▲▲▲

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
 * FASA 1 & 2: Mengawal Dashboard dan Workspace Modules Setup
 */
export function initializeModulesSetupTab() {
    const tabBtn = document.getElementById('tab-modules-setup-btn');
    if (tabBtn) tabBtn.addEventListener('click', renderModulesDashboard);

    const workspaceContainer = document.getElementById('modules-setup-content');
    
    // BUG 3 FIX: Event listener untuk butang 'Back' (Guna ID & Style.display)
    const btnBack = document.getElementById('btn-back-to-modules');
    if (btnBack) {
        btnBack.addEventListener('click', () => {
            const workspace = document.getElementById('module-workspace');
            if (workspace) workspace.style.display = 'none'; // Sembunyikan workspace
            
            const header = document.getElementById('modules-dashboard-header');
            if (header) header.style.display = 'flex'; // Kembalikan header
            
            const grid = document.getElementById('modules-dashboard-grid');
            if (grid) grid.style.display = 'grid'; // Kembalikan grid
            
            renderModulesDashboard(); // Refresh dashboard
        });
    }

// ▼▼▼ LOGIK GLOBAL: BUTANG SORT UP / DOWN ▼▼▼
    const btnMoveUp = document.getElementById('module-btn-move-up');
    const btnMoveDown = document.getElementById('module-btn-move-down');

    if (btnMoveUp && btnMoveDown) {
        // Fungsi Bantuan Pergerakan
        const moveItem = (direction) => {
            // Cari elemen yang sedang 'Aktif' / di-klik
            const activeLink = document.querySelector('#module-field-list a.active');
            if (!activeLink) return;

            const currentLi = activeLink.closest('li');
            if (!currentLi || !currentLi.dataset.fieldId) {
                // Ignore jika yang aktif adalah "Module Settings" (tiada fieldId)
                return; 
            }

            const titleEl = document.getElementById('workspace-module-title');
            const tableName = titleEl.dataset.tableName;
            const moduleId = titleEl.dataset.moduleId;

            if (direction === 'up') {
                const prevLi = currentLi.previousElementSibling;
                // Pastikan tidak melompat atas "Module Settings"
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

        // Ganti klon untuk elakkan duplicate event listener (SPA standard practice)
        const newBtnMoveUp = btnMoveUp.cloneNode(true);
        btnMoveUp.parentNode.replaceChild(newBtnMoveUp, btnMoveUp);
        newBtnMoveUp.addEventListener('click', () => moveItem('up'));

        const newBtnMoveDown = btnMoveDown.cloneNode(true);
        btnMoveDown.parentNode.replaceChild(newBtnMoveDown, btnMoveDown);
        newBtnMoveDown.addEventListener('click', () => moveItem('down'));
    }
    // ▲▲▲ TAMAT LOGIK GLOBAL ▲▲▲
    
    if (workspaceContainer) {
        workspaceContainer.addEventListener('click', (e) => {
            // Butang Edit Default Module
            const btnEditDefault = e.target.closest('.btn-edit-default');
            if (btnEditDefault) {
                const tableName = btnEditDefault.dataset.tableName;
                openModuleWorkspace('default', tableName);
            }
            
            // Butang Edit Custom Module
            const btnEditCustom = e.target.closest('.btn-edit-custom');
            if (btnEditCustom) {
                const tableName = btnEditCustom.dataset.tableName;
                const moduleId = btnEditCustom.dataset.moduleId;
                openModuleWorkspace('custom', tableName, moduleId);
            }
            
            // Butang Delete Custom Module
            const btnDeleteCustom = e.target.closest('.btn-delete-custom');
            if (btnDeleteCustom) {
                const viewId = parseInt(btnDeleteCustom.dataset.moduleId, 10);
                deleteCustomView(viewId);
            }
            
// Butang Create New Custom Module (buka workspace)
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

// ▼▼▼ BACA NESTED FILTER RULES JIKA ADA ▼▼▼
                let finalFilterRules = '{"condition":"AND", "rules":[]}';
                const filterContainer = document.getElementById('workspace-filter-builder-container');
                if (filterContainer && !document.getElementById('custom-module-specific-settings').classList.contains('hidden')) {
                    const rootGroup = filterContainer.querySelector('.cm-filter-group');
                    if (rootGroup) {
                        finalFilterRules = JSON.stringify(extractGroupData(rootGroup));
                    }
                }

const tableData = appState.jsonData.database.table[baseTable];
// Bina Payload Akhir (100% Tepat Berdasarkan Log)
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

            window.electronAPI.saveCustomModule(payload).then(async (res) => { // Pastikan ada 'async' di sini
                if (res.success) {
                    
                    // ▼▼▼ CARA PALING SEMPURNA (RELOAD KESELURUHAN DATA) ▼▼▼
                    // Fungsi ini akan mengambil data terbaru dari database dan 
                    // me-render semula SEMUA tab termasuk Menu Management & Dashboard
                    await loadProjectData(appState.activeProject);
                    // ▲▲▲ TAMAT RELOAD ▲▲▲

                    // Selepas data segar, buka semula workspace untuk modul yang baru dicipta ini
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
        // ▲▲▲ TAMAT LOGIK CREATE ▲▲▲
        
        });
    }
}

/**
 * Membuka Ruang Kerja (Workspace) berdasarkan mod (default / custom / create)
 */
export function openModuleWorkspace(mode, tableName = null, moduleId = null) {
    // Sembunyikan Dashboard secara selamat
    const header = document.getElementById('modules-dashboard-header');
    if (header) header.style.display = 'none';
    
    const grid = document.getElementById('modules-dashboard-grid');
    if (grid) grid.style.display = 'none';
    
    const workspace = document.getElementById('module-workspace');
    if (workspace) workspace.style.display = 'flex'; // Paparkan Workspace

    // Elemen UI Workspace
    const titleEl = document.getElementById('workspace-module-title');
    const badgeEl = document.getElementById('workspace-module-badge');
    const createControls = document.getElementById('workspace-create-controls');
    const baseTableSelect = document.getElementById('workspace-base-table-select');
    const fieldList = document.getElementById('module-field-list');
    
    // ▼▼▼ KAWALAN BUTANG SORT GLOBAL (Dari Fasa 3) ▼▼▼
    const sortControls = document.getElementById('module-sort-controls');
    if (sortControls) {
        if (mode === 'custom') sortControls.classList.remove('hidden');
        else sortControls.classList.add('hidden');
    }

    // Reset Senarai Medan
    if (fieldList) fieldList.innerHTML = '';
    if (createControls) createControls.classList.add('hidden');

    const tables = appState.jsonData?.database?.table || {};

    // ==========================================
    // LOGIK BERDASARKAN MOD (CREATE / DEFAULT / CUSTOM)
    // ==========================================
    
    if (mode === 'create') {
        if (titleEl) {
            titleEl.textContent = "Create New Module";
            // KOSONGKAN KONTEKS AWAL
            titleEl.dataset.tableName = ""; 
            titleEl.dataset.moduleId = "";
        }
        if (badgeEl) { badgeEl.className = "module-badge"; badgeEl.textContent = ""; }
        
        // Paparkan input Base Table dan Nama
        if (createControls) createControls.classList.remove('hidden');
        const nameInput = document.getElementById('workspace-new-module-name');
        if (nameInput) nameInput.value = '';
        
        // Isi dropdown Base Table
        if (baseTableSelect) {
            baseTableSelect.innerHTML = '<option value="">-- Select Base Table --</option>';
            Object.keys(tables).forEach(tName => {
                baseTableSelect.appendChild(new Option(tName, tName));
            });

            // ▼▼▼ PEMBAIKAN: Apabila jadual dipilih, simpan konteks nama jadual ▼▼▼
            baseTableSelect.onchange = (e) => {
                const selectedTable = e.target.value;
                if (selectedTable && tables[selectedTable]) {
                    // BERIKAN KONTEKS supaya field settings tidak kosong/undefined
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
            titleEl.dataset.tableName = tableName; // SIMPAN KONTEKS
            titleEl.dataset.moduleId = '';         // KOSONGKAN ID
        }
        if (badgeEl) { badgeEl.className = "module-badge badge-default"; badgeEl.textContent = "Default"; }
        
        // Lukis senarai medan
        if (tables[tableName]) {
            renderWorkspaceFields(tables[tableName].fields, 'default', null, tableName);
        }

    } else if (mode === 'custom') {
        const tableData = tables[tableName];
        const moduleData = tableData?.custom_modules?.find(m => m.module_id == moduleId);
        
        if (titleEl) {
            titleEl.textContent = moduleData ? moduleData.module_name : "Unknown Module";
            titleEl.dataset.tableName = tableName; // SIMPAN KONTEKS
            titleEl.dataset.moduleId = moduleId;   // SIMPAN ID
        }
        if (badgeEl) { badgeEl.className = "module-badge badge-custom"; badgeEl.textContent = "Custom"; }

        // Lukis senarai medan
        if (tableData) {
            renderWorkspaceFields(tableData.fields, 'custom', moduleData, tableName);
        }
    }
}

/**
 * Fungsi bantuan untuk melukis senarai medan di sebelah kiri ruang kerja
 */
function renderWorkspaceFields(fieldsObj, mode = 'default', moduleData = null, tableName = '') {
    const fieldList = document.getElementById('module-field-list');
    if (!fieldList) return;
    fieldList.innerHTML = '';
    
    // 1. Tambah butang "Master" untuk Tetapan Modul Keseluruhan
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
    
    // 2. Bina Array Medan & Susun (Sort)
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

    // 3. Loop senarai medan yang telah disusun (TANPA BUTANG INLINE)
    fieldsArray.forEach((item) => {
        const fieldName = item.fieldName;
        const fieldId = item.field.field_id;

        const li = document.createElement('li');
        li.dataset.fieldName = fieldName;
        li.dataset.fieldId = fieldId; // PENTING UNTUK SAVE
        li.style.display = 'flex';
        li.style.alignItems = 'center';

        const a = document.createElement('a');
        a.href = "#";
        a.style.flexGrow = '1';
        a.innerHTML = `<i class="fas fa-columns" style="color: #888; margin-right: 8px;"></i> ${fieldName}`;
        
        a.addEventListener('click', (e) => {
            e.preventDefault();
            fieldList.querySelectorAll('a').forEach(link => link.classList.remove('active'));
            a.classList.add('active'); // Fokuskan item ini (Visual & Untuk Sort)
            
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
 * Melukis kad untuk Default Modules dan Custom Modules
 */
export function renderModulesDashboard() {
    const grid = document.getElementById('modules-dashboard-grid');
    if (!grid) return;
    
    const tables = appState.jsonData?.database?.table || {};
    let html = '';
    
    Object.keys(tables).forEach(tableName => {
        const tableData = tables[tableName];
        
        // 1. LUKIS KAD DEFAULT MODULE (Satu untuk setiap jadual)
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
        
        // 2. LUKIS KAD CUSTOM MODULES (Jika jadual ini ada custom module)
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
 * FUNGSI AJAIB: Membaca JSON Override dan menampalnya ke atas UI
 */
function applyFieldOverrides(tableName, fieldName, moduleId) {
    const tableData = appState.jsonData.database.table[tableName];
    if (!tableData) return;

    // Cari Modul
    const moduleData = tableData.custom_modules?.find(m => m.module_id == moduleId);
    if (!moduleData || !moduleData.fields) return;

    // Cari Field ID
    const originalField = tableData.fields[fieldName];
    if (!originalField) return;
    const fieldId = originalField.field_id;

    // Cari Override untuk Field ini
    const overrideRecord = moduleData.fields.find(f => f.field_id === fieldId);
    if (!overrideRecord || !overrideRecord.settings_override) return;

    try {
        const settings = JSON.parse(overrideRecord.settings_override);
        
        console.log(`Applying Overrides for ${fieldName}:`, settings);

        // Loop setiap kunci dalam JSON dan update UI
        Object.keys(settings).forEach(key => {
            const value = settings[key];
            
            // Cari elemen input berdasarkan ID (Convention: fld-nama_setting -> fld-nama-setting)
            // Kita perlu tukar underscore (_) ke dash (-) kerana ID HTML guna dash
            const elementId = 'fld-' + key.replace(/_/g, '-');
            
            const el = document.getElementById(elementId);
            if (el) {
                // Update UI secara visual tanpa trigger event 'change' (supaya tak loop save balik)
                if (el.type === 'checkbox') {
                    el.checked = (value === 1 || value === true);
                } else {
                    el.value = value;
                }
                
                // Visual feedback: Berikan sedikit warna border kuning/hijau untuk tunjuk ia di-override
                el.style.borderColor = "#10b981"; // Hijau
                el.title = "This setting is overridden by Custom Module";
            }
        });

    } catch (e) {
        console.error("Error applying overrides:", e);
    }
}

/**
 * FUNGSI AJAIB 2: Membaca JSON Override Jadual dan menampalnya ke atas UI
 */
function applyTableOverrides(tableName, moduleId) {
    const tableData = appState.jsonData.database.table[tableName];
    if (!tableData) return;

    // Cari Modul
    // Pastikan moduleId adalah nombor (integer) kerana dalam dataset ia string
    const modIdInt = parseInt(moduleId, 10);
    const moduleData = tableData.custom_modules?.find(m => m.module_id === modIdInt);
    
    if (!moduleData || !moduleData.settings_override) return;

    try {
        const settings = JSON.parse(moduleData.settings_override);
        console.log(`Applying Table Overrides for Module ${modIdInt}:`, settings);

        Object.keys(settings).forEach(key => {
            const value = settings[key];
            
            // Konvensyen ID: tbl-nama_setting -> tbl-nama-setting
            const dashedKey = key.replace(/_/g, '-');
            const elementId = 'tbl-' + dashedKey;
            
            // Cuba cari elemen standard (Input / Select / Checkbox)
            const el = document.getElementById(elementId);
            
            if (el) {
                // Update UI Visual
                if (el.type === 'checkbox') {
                    el.checked = (value === 1 || value === true);
                } else {
                    el.value = value;
                }
                
                // Visual feedback (Hijau)
                el.style.borderColor = "#10b981"; 
                el.title = "This setting is overridden by Custom Module";
            
            } else {
                // Cuba cari Radio Button (kerana radio tiada ID unik yang sama format)
                // Format nama radio biasanya: tbl-nama-setting
                const radioName = 'tbl-' + dashedKey;
                const radioSelector = `input[name="${radioName}"][value="${value}"]`;
                const radioBtn = document.querySelector(radioSelector);
                
                if (radioBtn) {
                    radioBtn.checked = true;
                    // Untuk radio, kita tandakan label induknya jika boleh, atau biarkan sahaja
                }
            }
        });

    } catch (e) {
        console.error("Error applying table overrides:", e);
    }
}

/**
 * FUNGSI BANTUAN UX: Memberi kesan visual (highlight hijau) pada baris yang diubah
 */
function highlightLi(li) {
    li.style.transition = 'background-color 0.3s';
    li.style.backgroundColor = '#e8f5e9'; // Hijau lembut
    setTimeout(() => li.style.backgroundColor = 'transparent', 300);
}

/**
 * FASA 3: Menyimpan susunan baharu medan ke pangkalan data
 */
async function saveFieldOrder(tableName, moduleId) {
    const tableData = appState.jsonData.database.table[tableName];
    
    // Pastikan moduleId dibaca sebagai integer (nombor)
    const modIdInt = parseInt(moduleId, 10);
    const moduleIndex = tableData.custom_modules.findIndex(m => m.module_id === modIdInt);
    
    if (moduleIndex === -1) {
        console.error("❌ Modul tidak ditemui dalam AppState.");
        return;
    }

    const modData = tableData.custom_modules[moduleIndex];
    
    // Kita cari elemen LI yang mempunyai nama medan
    const listItems = document.querySelectorAll('#module-field-list li[data-field-name]'); 
    
    const updatedFields = [];
    
    listItems.forEach((li, index) => {
        const fieldName = li.dataset.fieldName;
        let fieldId = li.dataset.fieldId ? parseInt(li.dataset.fieldId, 10) : null;
        if (isNaN(fieldId)) fieldId = null;
        
        // Pengekalan Data: Cari tetapan asal berdasarkan ID atau Nama
        const existingFieldData = modData.fields.find(f => 
            (fieldId && f.field_id === fieldId) || 
            f.sourceName === fieldName || 
            f.field_source_name === fieldName ||
            f.field_name === fieldName
        ) || {
            is_readonly: 0,
            settings_override: "{}"
        };
        
        // BINA PAYLOAD YANG LENGKAP UNTUK BACKEND
        updatedFields.push({
            ...existingFieldData,
            field_id: fieldId,             
            sourceName: fieldName,         // Mesti dihantar untuk elak ralat "undefined"
            field_name: fieldName,         // Nama alternatif jika backend guna key ini
            displayOrder: index + 1,       // Format camelCase untuk fallback
            display_order: index + 1       // Format snake_case (Standard Fasa 3)
        });
    });

    // 1. Simpan ke AppState (RAM)
    modData.fields = updatedFields;

    // 2. Bina Payload penuh untuk API
    const payload = {
        module_id: modData.module_id,
        table_id: tableData.table_id,
        module_name: modData.module_name,
        menu_icon: modData.menu_icon,
        fields: updatedFields // Hantar senarai medan yang lengkap
    };

    // 3. Hantar ke Backend
    if (window.electronAPI.saveCustomModule) {
        try {
            const result = await window.electronAPI.saveCustomModule(payload);
            if (result.success) {
                console.log("✅ Susunan medan berjaya disimpan!");
            } else {
                console.error("❌ Gagal menyimpan susunan medan:", result.message);
            }
        } catch (err) {
            console.error("❌ Ralat Pelaksanaan API saveCustomModule:", err);
        }
    }
}

// --- HELPER MENGELUARKAN DATA BERSARANG ---
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
 * FASA 3: Nested Query Builder + Sistem Auto-Save Dinamik
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

        // Rangka asas UI (Tanpa butang Save Manual)
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

        // --- SISTEM AUTO-SAVE DEBOUNCE ---
        let autoSaveTimeout;
        const triggerAutoSave = async () => {
            // Jangan save jika mod mencipta modul baru (tunggu butang Create)
            if (mode === 'create') return; 

            const rootGroup = rootContainer.querySelector('.cm-filter-group');
            if (!rootGroup) return;
            const finalData = extractGroupData(rootGroup);

            modData.filter_rules = JSON.stringify(finalData);
            
            // ▼▼▼ BACA TABLE-LEVEL OVERRIDES UNTUK AUTO-SAVE ▼▼▼
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
                settings_override: modData.settings_override // <--- HANTAR KE BACKEND
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
            }, 600); // Tunggu 600ms selepas pengguna berhenti berinteraksi
        };

        // Delegasi Acara (Event Delegation) untuk Input & Dropdown
        rootContainer.addEventListener('change', (e) => {
            if (e.target.tagName === 'SELECT' || e.target.type === 'radio' || e.target.type === 'checkbox') debounceAutoSave();
        });
        rootContainer.addEventListener('keyup', (e) => {
            if (e.target.tagName === 'INPUT' && e.target.type === 'text') debounceAutoSave();
        });


        // FUNGSI RENDER REKURSIF
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
                // Trigger auto-save bila buang group
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

            // Trigger auto-save bila tambah rule/group
            btnAddRule.onclick = () => { renderRuleItem({}, rulesContainer); debounceAutoSave(); };
            btnAddGroup.onclick = () => { renderRuleGroup({ condition: 'AND', rules: [{}] }, rulesContainer); debounceAutoSave(); };

            container.appendChild(groupEl);
        };

        // FUNGSI RENDER RULE ITEM
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
            // Trigger auto-save bila buang rule individu
            row.querySelector('.rule-del').onclick = () => { row.remove(); debounceAutoSave(); };
            container.appendChild(row);
        };

        // Mulakan lukisan root
        renderRuleGroup(rootData, rootContainer, true);

        // ▼▼▼ BIND AUTO-SAVE KEPADA KOTAK TABLE TITLE ▼▼▼
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