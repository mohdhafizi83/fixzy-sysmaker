// src/js/handlers/tableHandlers.js

import { appState } from '../state.js';
import { SaveManager } from '../saveManager.js';
import { showCustomDialog } from '../ui/modalHandlers.js';
import { setElementValue, setRadioValue } from '../ui/formHelpers.js';
import { openCustomViewModal } from './logicBuilderHandlers.js';
//import { populateCustomViewsTab } from './tableHandlers.js';

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
    const tableSettingsPage = document.getElementById('table-settings-page');
    if (!tableSettingsPage) return;

    // Pasang listener untuk butang di dalam Modal Custom Module
    initializeCustomModuleModalLogic();

    // Event delegation untuk butang "Add", "Edit", dan "Delete" di dalam tab
    tableSettingsPage.addEventListener('click', e => {
        const tableNameElement = document.querySelector('#table-settings-page .table-name');
        const currentTableName = tableNameElement ? tableNameElement.textContent.trim() : null;
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
        const tableNameElement = document.querySelector('#table-settings-page .table-name');
        const currentTableName = tableNameElement ? tableNameElement.textContent.trim() : null;
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
            console.group("🔍 DEBUG: Delete Custom Module (Local Update Strategy)");
            try {
                // 1. Dapatkan nama jadual DARI DOM (sebelum apa-apa berlaku)
                const tableNameElement = document.querySelector('#table-settings-page .table-name');
                const tableName = tableNameElement ? tableNameElement.textContent.trim() : null;
                
                if (!tableName) {
                    console.error("❌ Nama jadual tidak ditemui dalam DOM.");
                    return;
                }

                // 2. Panggil API Delete Backend
                const result = await window.electronAPI.deleteCustomView(viewId);
                
                if (result && result.success) {
                    console.log("✅ Delete Berjaya di Backend.");

                    // 3. KEMAS KINI STATE TEMPATAN (Tanpa Refresh App!)
                    // Kita cari array custom_modules dalam appState dan buang item yang ID-nya sama
                    if (appState.jsonData.database.table[tableName]?.custom_modules) {
                        const currentViews = appState.jsonData.database.table[tableName].custom_modules;
                        
                        // Tapis keluar view yang hendak dipadam
                        appState.jsonData.database.table[tableName].custom_modules = currentViews.filter(v => v.module_id !== viewId);
                        
                        console.log("✅ AppState dikemaskini secara manual (Item dibuang dari array).");
                    }

                    // 4. Render Semula Tab Custom Module Sahaja
                    // (Kerana fungsi ini berada dalam fail yang sama, kita boleh panggil terus)
                    populateCustomViewsTab(tableName);
                    
                    // Pilihan: Boleh tambah toast notification di sini jika mahu

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