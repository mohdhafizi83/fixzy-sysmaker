// src/js/handlers/tableHandlers.js

import { appState } from '../state.js';
import { SaveManager } from '../saveManager.js';
import { showCustomDialog } from '../ui/modalHandlers.js';
import { setElementValue, setRadioValue } from '../ui/formHelpers.js';
//import { populateCustomViewsTab } from './tableHandlers.js';

// src/js/handlers/tableHandlers.js

// --- 1. TABLE SAVE HANDLER (DIPERBAIKI) ---
export function initializeTableSaveHandlers() {
    const container = document.getElementById('table-settings-page');
    if (!container) return;

    ['change', 'focusout'].forEach(eventType => {
        container.addEventListener(eventType, (e) => {
            const input = e.target;
            
            // --- PEMBAIKAN UTAMA: ABAIKAN INPUT PARENT-CHILD ---
            // Jika input berada dalam kawasan parent-child, jangan proses sebagai Table Update
            if (input.closest('#parent-child-settings')) return;
            if (input.id && input.id.startsWith('parentchild-')) return;
            // ----------------------------------------------------

            if (eventType === 'focusout' && !['text', 'textarea', 'number'].includes(input.type) && input.tagName !== 'TEXTAREA') return;
            if (eventType === 'change' && ['text', 'textarea', 'number'].includes(input.type) && input.tagName !== 'TEXTAREA') return;
            if (!['INPUT', 'SELECT', 'TEXTAREA'].includes(input.tagName)) return;
            if (input.type === 'search') return;

            if (appState.isPopulatingData) return;
            if (!appState.isAutoSaveEnabled) return;

            const tableNameEl = container.querySelector('.table-name');
            const tableName = tableNameEl ? tableNameEl.textContent.trim() : null;
            if (!tableName) return;

            const tableData = appState.jsonData.database.table[tableName];
            if (!tableData) return;

            let key = '';
            if (input.type === 'radio') {
                key = input.name.replace('tbl-', '').replace(/-/g, '_');
            } else {
                key = input.id.replace('tbl-', '').replace(/-/g, '_');
            }

            const keyMappings = {
                'hook_logic': 'table_hook_workflow',
                'table_view_classes_input': 'table_view_classes_input',
                'detail_view_classes_input': 'detail_view_classes_input',
                'static_grid_columns': 'static_grid_columns',
                'pagination_type': 'pagination_type', 
                'column_grid_type': 'column_grid_type'
            };

            if (keyMappings[key]) key = keyMappings[key];

            let value;
            if (input.type === 'checkbox') value = input.checked ? 1 : 0;
            else if (input.type === 'radio') {
                if (!input.checked) return;
                value = input.value;
            } else value = input.value;

            SaveManager.addToQueue('table', tableData.table_id, { [key]: value });
        });
    });
}

// src/js/handlers/tableHandlers.js

// src/js/handlers/tableHandlers.js

export function initializeRelationshipSaveHandlers() {
    console.log("🛠️ Relationship Handlers: Init dipanggil."); 

    // Kita pasang 'telinga' pada keseluruhan halaman settings
    const container = document.getElementById('table-settings-page'); 
    
    if (!container) {
        console.error("❌ Ralat Kritikal: Container #table-settings-page tiada!");
        return;
    }

    ['change', 'focusout'].forEach(eventType => {
        container.addEventListener(eventType, (e) => {
            const input = e.target;
            const inputId = input.id || '';

            // --- PERUBAHAN UTAMA DI SINI ---
            // Kita tidak lagi bergantung pada ID container bapa.
            // Kita terus cam input berdasarkan prefix ID-nya.
            if (!inputId.startsWith('parentchild-')) return;
            // -------------------------------

            console.log(`🔥 Event '${eventType}' dikesan pada input Relationship: ${inputId}`);

            // Filter Event Standard (elak double fire)
            if (eventType === 'focusout' && !['text', 'textarea', 'number'].includes(input.type)) return;
            if (eventType === 'change' && ['text', 'textarea', 'number'].includes(input.type)) return;
            
            if (appState.isPopulatingData) {
                console.warn("Save dihalang: isPopulatingData = true");
                return;
            }

            // 1. DAPATKAN CONTEXT (Parent & Child Table)
            const currentTableName = document.querySelector('#table-settings-page .table-name')?.textContent.trim();
            
            // Logik mencari Child Table (Cuba pelbagai cara untuk pastikan jumpa)
            let childTableName = null;
            
            // Cara A: Cari tab yang active (class 'active')
            const activeTab = document.querySelector('#child-table-list li.active');
            if (activeTab) {
                childTableName = activeTab.dataset.childName || activeTab.getAttribute('data-child-name');
            }
            
            // Cara B: Cari input hidden khas (jika ada)
            if (!childTableName) {
                const hiddenChildInput = document.getElementById('current-active-child-table');
                if (hiddenChildInput) childTableName = hiddenChildInput.value;
            }

            console.log(`Info: Parent=[${currentTableName}], Child=[${childTableName}]`);

            if (!currentTableName || !childTableName) {
                console.error("❌ Gagal mengesan Table Induk atau Child Table yang aktif.");
                return;
            }

            // 2. CARI RELATIONSHIP ID
            const relData = appState.jsonData.database.relationships.find(
                r => r.parent_table_name === currentTableName && r.child_table_name === childTableName
            );

            if (!relData) {
                console.error("❌ Data Relationship tiada dalam AppState untuk pasangan ini.");
                return;
            }

            // 3. SEDIAKAN DATA
            let key = inputId.replace('parentchild-', '').replace(/-/g, '_');
            
            // Mapping Manual (Contoh: input ID 'parentchild-display-type-select' -> DB 'display_type')
            if (key === 'display_type_select') key = 'display_type';

            let value;
            if (input.type === 'checkbox') value = input.checked ? 1 : 0;
            else value = input.value;

            // 4. HANTAR
            console.log(`🚀 Menghantar ke SaveManager: RelID=${relData.relationship_id}, Key=${key}, Val=${value}`);
            
            SaveManager.addToQueue('relationship', relData.relationship_id, { [key]: value });
        });
    });

    console.log("✅ Relationship Handlers berjaya dipasang (Mode: Prefix Detection).");
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
    defaultOption.value = ''; // Nilai kosong untuk 'Current user'
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
 * Mengisi kandungan tab "Custom Views" dengan senarai view yang telah dicipta.
 * @param {string} tableName - Nama jadual semasa.
 */
export function populateCustomViewsTab(tableName) {
    const container = document.getElementById('custom-views-list-container');
    if (!container) return;

    const views = appState.jsonData.database.table[tableName]?.custom_views || [];

    if (views.length === 0) {
        container.innerHTML = `
            <div class="empty-state-label">
                <p>No Custom Views created yet.</p>
                <span>Click the button above to create one.</span>
            </div>`;
        return;
    }

    container.innerHTML = views.map(view => `
        <div class="cv-list-item">
            <div class="cv-info">
                <i class="fas ${view.menu_icon || 'fa-eye'}"></i>
                <span>${view.view_name}</span>
            </div>
            <div class="cv-actions">
                <button class="btn btn-secondary cv-edit-btn" data-view-id="${view.custom_view_id}">
                    <i class="fas fa-pencil-alt"></i> Edit
                </button>
                <button class="btn cv-delete-btn" data-view-id="${view.custom_view_id}">
                    <i class="fas fa-trash-alt"></i> Delete
                </button>
            </div>
        </div>
    `).join('');
}

/**
 * Fungsi utama untuk memasang semua event listener untuk ciri Custom Views.
 */
export function initializeCustomViews() {
    const tableSettingsPage = document.getElementById('table-settings-page');
    if (!tableSettingsPage) return;

    // Pasang listener untuk modal SEKALI SAHAJA
    initializeCustomViewModalLogic();

    // Event delegation untuk butang "Add", "Edit", dan "Delete" di dalam tab
    tableSettingsPage.addEventListener('click', e => {
        const currentTableName = document.querySelector('#table-settings-page .table-name').textContent;
        if (!currentTableName) return;

        if (e.target.closest('#btn-add-custom-view')) {
            openCustomViewModal(currentTableName);
        }

        const editBtn = e.target.closest('.cv-edit-btn');
        if (editBtn) {
            const viewId = parseInt(editBtn.dataset.viewId, 10);
            const viewData = appState.jsonData.database.table[currentTableName]?.custom_views.find(v => v.custom_view_id === viewId);
            if (viewData) {
                openCustomViewModal(currentTableName, viewData);
            }
        }

        const deleteBtn = e.target.closest('.cv-delete-btn');
        if (deleteBtn) {
            const viewId = parseInt(deleteBtn.dataset.viewId, 10);
            showCustomDialog({
                title: "Confirm Deletion",
                message: "Are you sure you want to permanently delete this Custom View? This action cannot be undone.",
                showCancelButton: true,
                onOk: async () => {
                    const result = await window.electronAPI.deleteCustomView(viewId);
                    if (result.success) {
                        await loadProjectData(appState.activeProject);
                        populateCustomViewsTab(currentTableName);
                    } else {
                        showCustomDialog({ title: "Error", message: `Failed to delete view: ${result.message}`});
                    }
                }
            });
        }
    });
}

// src/js/handlers/tableHandlers.js (Tambah di bahagian bawah fail)

export function initializeCustomViewModalLogic() {
    const modal = document.getElementById('custom-view-modal');
    const saveBtn = document.getElementById('btn-save-custom-view');
    const cancelBtn = document.getElementById('btn-cancel-custom-view');
    const closeBtn = document.getElementById('custom-view-modal-close'); // Jika ada tombol X

    if (!modal || !saveBtn) return;

    const closeModal = () => {
        modal.classList.add('hidden');
        // Reset form jika perlu
        const form = modal.querySelector('form');
        if (form) form.reset();
        // Buang attribut data-editing-id
        saveBtn.removeAttribute('data-editing-id');
    };

    // Event Listeners untuk Tutup Modal
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    // Event Listener Save
    // Kita guna replaceWith untuk elak duplicate listener jika fungsi dipanggil berkali-kali
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);

    newSaveBtn.addEventListener('click', async () => {
        const viewNameInput = document.getElementById('cv-view-name');
        const viewTypeSelect = document.getElementById('cv-view-type');
        const isPublicCheck = document.getElementById('cv-is-public');
        
        if (!viewNameInput || !viewNameInput.value.trim()) {
            showCustomDialog({ title: "Validation Error", message: "View Name is required." });
            return;
        }

        const tableName = document.querySelector('#table-settings-page .table-name').textContent.trim();
        const editingId = newSaveBtn.getAttribute('data-editing-id');
        
        const payload = {
            table_name: tableName,
            view_name: viewNameInput.value.trim(),
            view_type: viewTypeSelect ? viewTypeSelect.value : 'list',
            is_public: isPublicCheck ? (isPublicCheck.checked ? 1 : 0) : 0,
            // Tambah field lain jika ada (filter_config, sort_config dll)
        };

        if (editingId) {
            // Update Existing
            SaveManager.addToQueue('custom_view', editingId, payload); 
            // Nota: Pastikan backend support 'custom_view' update, atau guna API khusus
        } else {
            // Create New
            // Anda mungkin perlu panggil API createCustomView secara direct atau guna SaveManager jika support create
            const result = await window.electronAPI.createCustomView(payload);
            if (result && result.success) {
                // Refresh list
                populateCustomViewsTab(tableName);
            }
        }
        
        closeModal();
    });
}

export function populateCustomViewModal(viewId = null) {
    const modal = document.getElementById('custom-view-modal');
    const title = document.getElementById('custom-view-modal-title');
    const saveBtn = document.getElementById('btn-save-custom-view');
    const nameInput = document.getElementById('cv-view-name');
    const typeSelect = document.getElementById('cv-view-type');
    const publicCheck = document.getElementById('cv-is-public');

    if (!modal) return;

    if (viewId) {
        // Mode Edit: Cari data view dari appState
        // Anda perlu cari view ini dalam appState.jsonData.database.custom_views (atau lokasi yang sesuai)
        // Contoh:
        // const view = appState.jsonData.database.custom_views.find(v => v.id == viewId);
        // if (view) { ... set values ... }
        
        title.textContent = "Edit Custom View";
        saveBtn.setAttribute('data-editing-id', viewId);
    } else {
        // Mode New
        title.textContent = "Create New View";
        saveBtn.removeAttribute('data-editing-id');
        if (nameInput) nameInput.value = '';
        if (typeSelect) typeSelect.value = 'list';
        if (publicCheck) publicCheck.checked = false;
    }

    modal.classList.remove('hidden');
}

export async function deleteCustomView(viewId) {
    showCustomDialog({
        title: "Delete View",
        message: "Are you sure you want to delete this custom view?",
        showCancelButton: true,
        onOk: async () => {
            await window.electronAPI.deleteCustomView(viewId);
            const tableName = document.querySelector('#table-settings-page .table-name').textContent.trim();
            populateCustomViewsTab(tableName);
        }
    });
}