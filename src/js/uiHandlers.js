// FIND AND EDIT THIS FUNCTION IN: uiHandlers.js

export function showNewProjectModal() {
    configureNewProjectModal('user-initiated'); // <-- TAMBAH BARIS INI

    const modal = document.getElementById('new-project-modal');
    const input = document.getElementById('new-project-name');

    if (modal && input) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            input.focus();
        }, 50);
    }
}

/**
 * Mengkonfigurasi modal 'New Project' berdasarkan senario.
 * @param {string} scenario - 'first-run' atau 'user-initiated'.
 */
export function configureNewProjectModal(scenario) {
    const modal = document.getElementById('new-project-modal');
    if (!modal) return;

    const titleEl = modal.querySelector('.modal-header h3');
    const closeBtn = modal.querySelector('#new-project-modal-close');

    if (scenario === 'first-run') {
        if (titleEl) titleEl.textContent = 'Selamat Datang! Sila Cipta Projek Pertama Anda';
        if (closeBtn) closeBtn.style.display = 'none'; // Sembunyikan butang X
    } else { // 'user-initiated'
        if (titleEl) titleEl.textContent = 'Cipta Projek Baharu';
        if (closeBtn) closeBtn.style.display = 'block'; // Paparkan butang X
    }
}

/**
 * Mengaplikasikan saiz fon pada elemen akar (<html>) aplikasi.
 * @param {string} size - Pilihan saiz ('small', 'medium', 'large').
 */
export function applyFontSize(size) {
    let fontSizeValue = '16px'; // Saiz lalai (medium)
    if (size === 'small') {
        fontSizeValue = '14px';
    } else if (size === 'large') {
        fontSizeValue = '18px';
    }
    document.documentElement.style.fontSize = fontSizeValue;
}

import { allTableNames, jsonData, loadProjectData, activeProject, SaveManager, setActiveSidebarItem, isAutoSaveEnabled, isPopulatingData, lastActiveChildTable, setLastActiveChildTable, setAwaitingMenuGroupSave } from './js.main.js';

// TAMBAH FUNGSI BAHARU INI DALAM uiHandlers.js

export async function saveRelationshipSettings() {
    const form = document.getElementById('tab-detail-parent-child');
    // Pastikan tab ini sedang dilihat sebelum cuba menyimpan
    if (!form || !form.classList.contains('active')) return;

    const gatherData = () => {
        const data = {};
        const inputs = form.querySelectorAll('input, select');
        inputs.forEach(input => {
            if (!input.id) return;
            const id = input.id.replace('parentchild-', '').replace(/-/g, '_');
            if (input.type === 'checkbox') {
                data[id] = input.checked ? 1 : 0;
            } else if (input.id) {
                data[id] = input.value;
            }
        });
        return data;
    };

    const dataToSave = gatherData();
    const parentTable = document.querySelector('#table-settings-page .table-name').textContent;
    const childTable = document.querySelector('#selected-child-table-name').textContent;

    if (!parentTable || !childTable || childTable === '...') {
        console.warn("Parent or child table not selected, skipping relationship save.");
        return;
    }

    const relationship = jsonData.database.relationships.find(
        r => r.parent_table_name === parentTable && r.child_table_name === childTable
    );

    if (!relationship) {
        console.error("Active relationship not found in jsonData.");
        return { success: false, message: 'Active relationship not found' };
    }

    dataToSave.relationship_id = relationship.relationship_id;
    return await window.electronAPI.updateRelationship(dataToSave);
}

// TAMBAH DUA FUNGSI BAHARU INI DALAM uiHandlers.js

/**
 * Mengemas kini imej di dalam kotak "Template preview" berdasarkan
 * pilihan semasa dropdown 'tbl-tv-template'.
 */
function updateTableViewTemplatePreview() {
    const templateSelect = document.getElementById('tbl-tv-template');
    const previewArea = document.querySelector('#tab-template .theme-preview-window');

    if (!templateSelect || !previewArea) {
        console.warn("Elemen untuk template preview tidak ditemui.");
        return;
    }

    const selectedValue = templateSelect.value;
    if (selectedValue) {
        const imagePath = `images/${selectedValue}.png`;
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

export async function saveProjectSettings() {
    const form = document.getElementById('main-dashboard-page');
    if (!form || !activeProject) return;

    const dataToSave = {};
    const inputs = form.querySelectorAll('input, select');
    inputs.forEach(input => {
        const id = input.id.replace('app-', '').replace(/-/g, '_');
        if (input.type === 'checkbox') dataToSave[id] = input.checked ? 1 : 0;
        else if (input.type === 'radio') { if (input.checked) dataToSave[input.name.replace('app-', '').replace(/-/g, '_')] = input.value; }
        else if (input.id) dataToSave[id] = input.value;
    });
    dataToSave.app_title = document.getElementById('app-title').value;
    dataToSave.project_id = activeProject.project_id;
    
    const result = await window.electronAPI.updateProject(dataToSave);

    // ▼▼▼ PEMBAIKAN: Muat semula data selepas simpanan berjaya ▼▼▼
    if (result.success) {
        await loadProjectData(activeProject);
    }
    return result;
    // ▲▲▲ TAMAT PEMBAIKAN ▲▲▲
}

export async function saveTableSettings() {
    const form = document.getElementById('table-settings-page');
    if (form.classList.contains('hidden')) return;

    const oldTableName = document.querySelector('#table-settings-page .table-name').textContent;
    const tableData = Object.values(jsonData.database.table).find(t => t.table_name === oldTableName);
    if (!tableData) return;

    const dataToSave = {};
    const inputs = form.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        const id = input.id.replace('tbl-', '').replace(/-/g, '_');
        if (input.type === 'checkbox') dataToSave[id] = input.checked ? 1 : 0;
        else if (input.id) dataToSave[id] = input.value;
    });
    dataToSave.table_id = tableData.table_id;

    const result = await window.electronAPI.updateTable(dataToSave);
    
    // ▼▼▼ PEMBAIKAN: Muat semula data selepas simpanan berjaya ▼▼▼
    if (result.success) {
        // Hantar nama jadual (mungkin baharu) untuk dipilih semula
        await loadProjectData(activeProject, dataToSave.table_name);
    }
    return result;
    // ▲▲▲ TAMAT PEMBAIKAN ▲▲▲
}

export async function saveFieldSettings() {
    const form = document.getElementById('field-settings-page');
    if (form.classList.contains('hidden')) return;

    const [tableName, oldFieldName] = document.querySelector('#field-settings-page .field-name').textContent.split('.');
    const fieldData = jsonData.database.table[tableName]?.fields[oldFieldName];
    if (!fieldData) return;

    const dataToSave = {};
    const inputs = form.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        if (!input.id) return;
        const id = input.id.replace('fld-', '').replace(/-/g, '_');
        if (input.type === 'checkbox') dataToSave[id] = input.checked ? 1 : 0;
        else if (input.type === 'radio') { if (input.checked) dataToSave[input.name.replace('fld-', '').replace(/-/g, '_')] = input.value; }
        else if (input.id) dataToSave[id] = input.value;
    });
    dataToSave.field_id = fieldData.field_id;

    const result = await window.electronAPI.updateField(dataToSave);

    // ▼▼▼ PEMBAIKAN: Muat semula data selepas simpanan berjaya ▼▼▼
    if (result.success) {
        // Hantar objek selector untuk memilih semula medan yang betul
        const itemToSelect = { table: tableName, field: dataToSave.field_name };
        await loadProjectData(activeProject, null, itemToSelect);
    }
    return result;
    // ▲▲▲ TAMAT PEMBAIKAN ▲▲▲
}

// GANTIKAN FUNGSI LAMA DENGAN VERSI BAHARU INI
export function initializeAlgorithmBuilder() {
    // 1. Kenal pasti semua elemen UI
    const modal = document.getElementById('algorithm-builder-modal');
    const openBtn = document.getElementById('open-algorithm-builder-btn');
    const closeBtn = document.getElementById('algorithm-builder-close');
    const cancelBtn = document.getElementById('algorithm-builder-cancel-btn');
    const doneBtn = document.getElementById('algorithm-builder-done-btn');
    const palette = modal.querySelector('.algorithm-palette');
    const canvas = modal.querySelector('#algorithm-canvas');
    const hiddenInput = document.getElementById('fld-algorithm-logic');
    const placeholder = modal.querySelector('.canvas-placeholder');

    if (!modal || !openBtn || !palette || !canvas) return;

    // Pembolehubah untuk menyimpan keadaan sementara semasa modal dibuka
    let modalCanvasState = '[]';

    // 2. Fungsi untuk menyimpan data ke DB (tidak berubah)
    const saveAlgorithmData = async () => {
        const saveStatus = document.getElementById('save-status');
        saveStatus.textContent = 'Saving...';
        saveStatus.className = 'saving';

        const [tableName, fieldName] = document.querySelector('#field-settings-page .field-name').textContent.split('.');
        const fieldData = jsonData.database.table[tableName]?.fields[fieldName];
        if (!fieldData) {
            saveStatus.textContent = 'Error: Active field not found!';
            saveStatus.className = 'error';
            return;
        }
        const dataToSave = {
            field_id: fieldData.field_id,
            algorithm_logic: hiddenInput.value
        };
        const result = await window.electronAPI.updateField(dataToSave);
        if (result.success) {
            saveStatus.textContent = 'All changes saved ✔';
            saveStatus.className = 'saved';
        } else {
            saveStatus.textContent = 'Save failed!';
            saveStatus.className = 'error';
        }
        setTimeout(() => saveStatus.textContent = '', 3000);
    };

    // 3. Fungsi baharu untuk mengemas kini keadaan SEMENTARA di dalam modal
    const updateModalCanvasState = () => {
        const items = Array.from(canvas.querySelectorAll('.dropped-item'));
        const logicArray = items.map(item => {
            const type = item.dataset.itemType;
            let itemData = { type };
            if (type === 'field') {
                itemData.table = item.querySelector('.table-select')?.value;
                itemData.field = item.querySelector('.field-select')?.value;
            } else if (type === 'operator') {
                itemData.value = item.querySelector('.operator-select')?.value;
            } else if (type === 'string' || type === 'number') {
                itemData.value = item.querySelector('input')?.value;
            } else {
                itemData.value = type;
            }
            return itemData;
        });
        // Data hanya disimpan di dalam pembolehubah ini, BUKAN di hiddenInput
        modalCanvasState = JSON.stringify(logicArray, null, 2);

        if (placeholder) {
            placeholder.style.display = items.length === 0 ? 'block' : 'none';
        }
    };
    
    // Fungsi mencipta elemen interaktif (tidak berubah)
    const createInteractiveElement = (type) => {
        const itemContainer = document.createElement('div');
        itemContainer.className = 'dropped-item';
        itemContainer.dataset.itemType = type;
        const itemLabel = document.createElement('span');
        itemLabel.textContent = `[${type.toUpperCase()}]`;
        itemContainer.appendChild(itemLabel);
        switch (type) {
            case 'field':
                const tableSelect = document.createElement('select');
                tableSelect.className = 'table-select';
                const [activeTable] = document.querySelector('#field-settings-page .field-name').textContent.split('.');
                const allTables = Object.keys(jsonData.database.table);
                allTables.forEach(tableName => {
                    const option = document.createElement('option');
                    option.value = tableName;
                    option.textContent = tableName;
                    if (tableName === activeTable) option.selected = true;
                    tableSelect.appendChild(option);
                });
                itemContainer.appendChild(tableSelect);
                const fieldSelect = document.createElement('select');
                fieldSelect.className = 'field-select';
                const populateFields = (tableName) => {
                    fieldSelect.innerHTML = '';
                    if (jsonData.database.table[tableName]) {
                        const fields = Object.keys(jsonData.database.table[tableName].fields);
                        fields.forEach(fieldName => {
                            const option = document.createElement('option');
                            option.value = fieldName;
                            option.textContent = fieldName;
                            fieldSelect.appendChild(option);
                        });
                    }
                };
                tableSelect.addEventListener('change', () => {
                    populateFields(tableSelect.value);
                    updateModalCanvasState();
                });
                populateFields(activeTable);
                itemContainer.appendChild(fieldSelect);
                fieldSelect.addEventListener('change', updateModalCanvasState);
                break;
            case 'operator':
                const operatorSelect = document.createElement('select');
                operatorSelect.className = 'operator-select';
                const operators = [ { value: '==', text: 'Equal' }, { value: '!=', text: 'Not Equal' }, { value: '>', text: 'Greater Than' }, { value: '<', text: 'Less Than' }, { value: '>=', text: 'Greater Than or Equal' }, { value: '<=', text: 'Less Than or Equal' }, { type: 'separator' }, { value: '&&', text: 'AND' }, { value: '||', text: 'OR' }, { type: 'separator' }, { value: '+', text: 'Plus' }, { value: '-', text: 'Minus' }, { value: '*', text: 'Times' }, { value: '/', text: 'Divide' } ];
                operators.forEach(op => {
                    if(op.type === 'separator'){
                         const option = document.createElement('option');
                         option.disabled = true; option.textContent = '──────────';
                         operatorSelect.appendChild(option);
                    } else {
                        const option = document.createElement('option');
                        option.value = op.value; option.textContent = op.text;
                        operatorSelect.appendChild(option);
                    }
                });
                itemContainer.appendChild(operatorSelect);
                operatorSelect.addEventListener('change', updateModalCanvasState);
                break;
            case 'string':
                const stringInput = document.createElement('input');
                stringInput.type = 'text'; stringInput.placeholder = 'Enter value...';
                stringInput.addEventListener('input', updateModalCanvasState);
                itemContainer.appendChild(stringInput);
                break;
            case 'number':
                const numberInput = document.createElement('input');
                numberInput.type = 'number'; numberInput.placeholder = '0';
                numberInput.addEventListener('input', updateModalCanvasState);
                itemContainer.appendChild(numberInput);
                break;
        }
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-algo-item';
        deleteBtn.innerHTML = '&times;';
        deleteBtn.title = 'Padam komponen ini';
        itemContainer.appendChild(deleteBtn);
        return itemContainer;
    };
    
    // Fungsi untuk memaparkan logik sedia ada dari hiddenInput ke dalam canvas
    const populateCanvasFromHiddenInput = () => {
        canvas.innerHTML = '';
        const currentLogicValue = hiddenInput.value || '[]';
        try {
            const logic = JSON.parse(currentLogicValue);
            if (logic.length === 0 && placeholder) {
                 canvas.appendChild(placeholder);
                 placeholder.style.display = 'block';
            } else {
                 if(placeholder) placeholder.style.display = 'none';
                 logic.forEach(itemData => {
                     const newItem = createInteractiveElement(itemData.type);
                     if (itemData.type === 'field') {
                         newItem.querySelector('.table-select').value = itemData.table;
                         newItem.querySelector('.table-select').dispatchEvent(new Event('change'));
                         newItem.querySelector('.field-select').value = itemData.field;
                     } else if (itemData.type === 'operator') {
                         newItem.querySelector('.operator-select').value = itemData.value;
                     } else if (itemData.type === 'string' || itemData.type === 'number') {
                         newItem.querySelector('input').value = itemData.value;
                     }
                     canvas.appendChild(newItem);
                 });
            }
        } catch (e) {
            console.error("Gagal memproses logik sedia ada:", e);
            if(placeholder) canvas.appendChild(placeholder);
        }
    };
    
    // 4. Pasang Event Listener untuk butang modal dan fungsi builder
    openBtn.addEventListener('click', () => {
        populateCanvasFromHiddenInput(); // Paparkan data dari hiddenInput
        modal.classList.remove('hidden');
    });

    closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
    cancelBtn.addEventListener('click', () => modal.classList.add('hidden'));

    doneBtn.addEventListener('click', async () => {
        // Hanya di sini data dari modal disalin ke hiddenInput
        hiddenInput.value = modalCanvasState;
        await saveAlgorithmData(); // Hantar ke DB
        modal.classList.add('hidden');
    });

    // Event listener untuk seret, lepas, dan padam (kini mengemas kini state sementara)
    palette.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('algo-component')) {
            e.dataTransfer.setData('text/plain', e.target.dataset.type);
        }
    });
    canvas.addEventListener('dragover', (e) => { e.preventDefault(); canvas.classList.add('dragging-over'); });
    canvas.addEventListener('dragleave', () => canvas.classList.remove('dragging-over'));
    canvas.addEventListener('drop', (e) => {
        e.preventDefault();
        canvas.classList.remove('dragging-over');
        if (placeholder) placeholder.style.display = 'none';
        const componentType = e.dataTransfer.getData('text/plain');
        const newItem = createInteractiveElement(componentType);
        canvas.appendChild(newItem);
        const newInpt = newItem.querySelector('input');
        if(newInpt) newInpt.focus();
        updateModalCanvasState(); // Kemas kini state sementara
    });
    canvas.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-algo-item')) {
            e.target.closest('.dropped-item')?.remove();
            updateModalCanvasState(); // Kemas kini state sementara
        }
    });
}

// KOD PENUH: Gantikan keseluruhan fungsi ini.
export function initializeLookupFieldSaveHandler() {
    const parentTableSelect = document.getElementById('fld-lookup-parent-table');
    if (!parentTableSelect) return;

    parentTableSelect.addEventListener('change', () => {
		if (isPopulatingData) return;
		if (!isAutoSaveEnabled) return;
        
        const parentTableName = parentTableSelect.value;
        const [childTableName, fk_child_field] = document.querySelector('#field-settings-page .field-name').textContent.split('.');
        
        // Hantar tugasan "upsert" ke queue
        SaveManager.addToQueue('upsertRelationship', null, {
            parentTableName,
            childTableName,
            fk_child_field
        });
    });
}

// GANTIKAN FUNGSI SEDIA ADA INI DALAM: uiHandlers.js

export function initializeRelationshipSaveHandlers() {
    const form = document.getElementById('tab-detail-parent-child');
    if (!form) return;

    const handleInputChange = (event) => {
        if (isPopulatingData) return;
        if (!isAutoSaveEnabled) return;

        // Dapatkan ID hubungan (relationship) yang sedang aktif
        const parentTable = document.querySelector('#table-settings-page .table-name').textContent;
        const childTableElement = form.querySelector('.item-list li.active');
        if (!childTableElement) return; // Keluar jika tiada child table dipilih
        const childTable = childTableElement.dataset.childName;

        const relationship = jsonData.database.relationships.find(
            r => r.parent_table_name === parentTable && r.child_table_name === childTable
        );
        if (!relationship) return; // Keluar jika hubungan tidak ditemui
        const relationshipId = relationship.relationship_id;

        // Dapatkan perubahan spesifik yang dibuat
        const input = event.target;
        const key = input.id.replace('parentchild-', '').replace(/-/g, '_');
        const value = (input.type === 'checkbox') ? (input.checked ? 1 : 0) : input.value;
        const dataToSave = { [key]: value };

        // Hantar perubahan ke queue di bawah 'relationships'
        SaveManager.addToQueue('relationships', relationshipId, dataToSave);
    };

    form.querySelectorAll('input, select').forEach(input => {
        input.addEventListener('change', handleInputChange);
        if (input.type === 'text') {
            input.addEventListener('input', handleInputChange);
        }
    });
}

// Fungsi untuk mengumpul data menu semasa dari UI
function gatherMenuData() {
    const menuGroupList = document.querySelector('.menu-group-list');
    const groupElements = menuGroupList.querySelectorAll('.menu-group-item');
    
    const menuData = Array.from(groupElements).map(groupEl => {
        const groupName = groupEl.querySelector('.group-name-input').value;
        const itemElements = groupEl.querySelectorAll('.menu-selector .tag');
        const items = Array.from(itemElements).map(itemEl => ({
            // Ambil nama jadual dari teks tag
            table_name: itemEl.childNodes[0].textContent.trim()
        }));

        return { group_name: groupName, items: items };
    });

    return menuData;
}

// Fungsi untuk mencetuskan proses simpanan
// js/uiHandlers.js

async function saveMenuStructure() {
    const saveStatus = document.getElementById('save-status');
    if (saveStatus) {
        saveStatus.textContent = 'Saving...';
        saveStatus.className = 'saving';
    }

    const menuData = gatherMenuData();
    const result = await window.electronAPI.saveMenuStructure({
        projectId: activeProject.project_id,
        menuData: menuData
    });

    if (saveStatus) {
        if (result.success) {
            saveStatus.textContent = 'All changes saved ✔';
            saveStatus.className = 'saved';
        } else {
            saveStatus.textContent = 'Save failed!';
            saveStatus.className = 'error';
            // Paparkan mesej ralat yang lebih terperinci juga
            showCustomDialog({ title: "Error", message: `Failed to save menu structure: ${result.message}` });
        }
        
        // Sembunyikan mesej status selepas 3 saat
        setTimeout(() => {
            saveStatus.textContent = '';
        }, 3000);
    }
}

// GANTIKAN FUNGSI SEDIA ADA INI DALAM: uiHandlers.js

export function initializeProjectSaveHandlers() {
    const form = document.getElementById('main-dashboard-page');
    // 'app-title' berada di luar 'main-dashboard-page', jadi kita perlu sasarkannya secara berasingan
    const header = document.querySelector('.main-header'); 
    if (!form || !header) return;

    const handleInputChange = (event) => {
        if (isPopulatingData) return;
        if (!isAutoSaveEnabled) return;

        const input = event.target;
        let key = (input.type === 'radio')
            ? input.name.replace('app-', '').replace(/-/g, '_')
            : input.id.replace('app-', '').replace(/-/g, '_');
        
        // ▼▼▼ PENAMBAHBAIKAN: KES KHAS UNTUK 'app-title' ▼▼▼
        // Betulkan nama kunci supaya sepadan dengan lajur pangkalan data 'app_title'
        if (key === 'title') {
            key = 'app_title';
        }
        // ▲▲▲ TAMAT PENAMBAHBAIKAN ▲▲▲
        
        let value;
        if (input.type === 'checkbox') {
            value = input.checked ? 1 : 0;
        } else if (input.type === 'radio') {
            if (!input.checked) return;
            value = input.value;
        } else {
            value = input.value;
        }

        const dataToSave = { [key]: value };
        
        // Guna project_id dari activeProject yang sudah ada dalam memori
        SaveManager.addToQueue('project', activeProject.project_id, dataToSave);
    };

    // Pasang event listener pada semua elemen borang di papan pemuka utama DAN di header
    header.querySelectorAll('input, select').forEach(input => {
        if (input.id === 'app-title') {
            input.addEventListener('input', handleInputChange);
        } else {
            input.addEventListener('change', handleInputChange);
        }
    });

    form.querySelectorAll('input, select').forEach(input => {
        input.addEventListener('change', handleInputChange);
    });
}

// GANTIKAN FUNGSI SEDIA ADA INI DALAM: uiHandlers.js

export function initializeTableSaveHandlers() {
    const form = document.getElementById('table-settings-page');
    if (!form) return;

    const handleInputChange = (event) => {
        if (isPopulatingData) return;
        if (!isAutoSaveEnabled) return;

        const input = event.target;

        // ▼▼▼ PENAMBAHBAIKAN: Guard Clause ▼▼▼
        // Hanya proses event dari elemen yang mempunyai ID bermula dengan 'tbl-'
        if (!input.id || !input.id.startsWith('tbl-')) {
            return;
        }
        // ▲▲▲ TAMAT PENAMBAHBAIKAN ▲▲▲

        const tableName = document.querySelector('#table-settings-page .table-name').textContent;
        const tableData = jsonData.database.table[tableName];
        if (!tableData) return;
        const tableId = tableData.table_id;
        
        const key = input.id.replace('tbl-', '').replace(/-/g, '_');
        const value = (input.type === 'checkbox') ? (input.checked ? 1 : 0) : input.value;
        const dataToSave = { [key]: value };

        SaveManager.addToQueue('tables', tableId, dataToSave);
    };

    form.querySelectorAll('input, select, textarea').forEach(input => {
        input.addEventListener('change', handleInputChange);
        if (input.type === 'text' || input.type === 'number' || input.tagName.toLowerCase() === 'textarea') {
            input.addEventListener('input', handleInputChange);
        }
    });
}

// GANTIKAN FUNGSI SEDIA ADA INI DALAM: uiHandlers.js

export function initializeFieldSaveHandlers() {
    const form = document.getElementById('field-settings-page');
    if (!form) return;

    const handleInputChange = (event) => {
        if (isPopulatingData) return;
        if (!isAutoSaveEnabled) return;

        // Dapatkan ID medan yang sedang diubah suai
        const [tableName, fieldName] = document.querySelector('#field-settings-page .field-name').textContent.split('.');
        const fieldData = jsonData.database.table[tableName]?.fields[fieldName];
        if (!fieldData) return; // Keluar jika data medan tidak ditemui
        const fieldId = fieldData.field_id;

        const input = event.target;
        const key = (input.type === 'radio')
            ? input.name.replace('fld-', '').replace(/-/g, '_')
            : input.id.replace('fld-', '').replace(/-/g, '_');

        let value;
        if (input.type === 'checkbox') {
            value = input.checked ? 1 : 0;
        } else if (input.type === 'radio') {
            if (!input.checked) return;
            value = input.value;
        } else {
            value = input.value;
        }

        const dataToSave = { [key]: value };

        // Hantar perubahan ke queue di bawah 'fields' dengan fieldId sebagai kunci
        SaveManager.addToQueue('fields', fieldId, dataToSave);
    };

    form.querySelectorAll('input, select, textarea').forEach(input => {
        input.addEventListener('change', handleInputChange);
        if (input.type === 'text' || input.type === 'number' || input.tagName.toLowerCase() === 'textarea') {
            input.addEventListener('input', handleInputChange);
        }
    });
}

// FIND AND REPLACE THIS ENTIRE FUNCTION IN: uiHandlers.js

export async function populateProjectDropdown() {
    const projectListContainer = document.getElementById('project-menu-list');
    let newProjectBtn = document.getElementById('new-project-btn-dropdown');
    const newProjectModal = document.getElementById('new-project-modal');

    if (!projectListContainer || !newProjectBtn || !newProjectModal) return;

    projectListContainer.querySelectorAll('.project-item').forEach(item => item.remove());

    const projects = await window.electronAPI.getAllProjects();

    projects.forEach(project => {
        const projectLink = document.createElement('a');
        projectLink.href = '#';
        projectLink.textContent = project.app_title;
        projectLink.className = 'project-item';
        if (project.is_active) {
            projectLink.classList.add('active-project');
        }
        
        projectLink.addEventListener('click', async (e) => {
            e.preventDefault();
            const overlay = document.getElementById('loading-overlay');
            try {
                if (overlay) overlay.classList.remove('loading-overlay-hidden');

                const newActiveProject = await window.electronAPI.setActiveProject(project.project_id);
                if (newActiveProject) {
                    await loadProjectData(newActiveProject);
                }
            } catch (error) {
                console.error("Gagal menukar projek:", error);
                showCustomDialog({ title: "Error", message: `Gagal menukar projek: ${error.message}` });
            } finally {
                if (overlay) overlay.classList.add('loading-overlay-hidden');
            }
        });

        projectListContainer.appendChild(projectLink);
    });

    // Guna kaedah cloneNode untuk membuang semua event listener lama dari butang
    // sebelum menambah event listener yang baharu dan terkini.
    const newProjectBtnClone = newProjectBtn.cloneNode(true);
    newProjectBtn.parentNode.replaceChild(newProjectBtnClone, newProjectBtn);
    newProjectBtn = newProjectBtnClone; // Sasarkan semula pembolehubah kepada klon yang baharu

    newProjectBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showNewProjectModal();
    });
}

export function showCustomDialog({ title, message, onOk, onCancel, showCancelButton = false }) {
    const modal = document.getElementById('custom-alert-modal');
    const titleEl = document.getElementById('custom-alert-title');
    const messageEl = document.getElementById('custom-alert-message');
    const okBtn = document.getElementById('custom-alert-ok-btn');
    const cancelBtn = document.getElementById('custom-alert-cancel-btn');
    const closeBtn = document.getElementById('custom-alert-close');

    titleEl.textContent = title || 'Notification';
    messageEl.textContent = message;

    // Tunjukkan atau sembunyikan butang Cancel
    cancelBtn.style.display = showCancelButton ? 'inline-block' : 'none';

    // Fungsi untuk menutup modal dan membuang listener
    const closeModal = () => {
        modal.classList.add('hidden');
        // Buang listener lama untuk elak panggilan berganda
        okBtn.replaceWith(okBtn.cloneNode(true));
        cancelBtn.replaceWith(cancelBtn.cloneNode(true));
        closeBtn.replaceWith(closeBtn.cloneNode(true));
    };

    // Tambah listener baharu
    document.getElementById('custom-alert-ok-btn').addEventListener('click', () => {
        if (typeof onOk === 'function') {
            onOk();
        }
        closeModal();
    });

    document.getElementById('custom-alert-cancel-btn').addEventListener('click', () => {
        if (typeof onCancel === 'function') {
            onCancel();
        }
        closeModal();
    });

    document.getElementById('custom-alert-close').addEventListener('click', closeModal);

    modal.classList.remove('hidden');
}

// (Pastikan helper ini wujud di skop yang boleh diakses)
const setElementValue = (id, value) => {
    const element = document.getElementById(id);
    if (element) {
        if (element.type === 'checkbox' || element.type === 'radio') {
            element.checked = value === 1 || value === true;
        } else {
            element.value = value;
            // Secara paksa aktifkan elemen apabila datanya diisi
            element.disabled = false;
        }
    }
};

const setRadioValue = (name, value) => {
    const selector = `input[name="${name}"][value="${value}"]`;
    const element = document.querySelector(selector);
    if (element) {
        element.checked = true;
    }
};

// Pembolehubah untuk menjejaki kumpulan mana yang sedang diubah suai
let currentTargetMenuSelector = null;

/**
 * Mendapatkan senarai nama menu (jadual) yang telah digunakan dalam semua kumpulan.
 * @returns {string[]} Senarai nama menu yang telah digunakan.
 */
function getUsedMenuNames() {
    const usedTags = document.querySelectorAll('.menu-group-item .tag');
    // Ambil teks dari setiap tag dan buang butang 'x'
    return [...usedTags].map(tag => tag.childNodes[0].textContent.trim());
}

// GANTIKAN KESELURUHAN FUNGSI SEDIA ADA INI DALAM: uiHandlers.js

export function initializeMenuManagementHandlers() {
    const addGroupBtn = document.getElementById('app-add_menu_group');
    const menuGroupList = document.querySelector('.menu-group-list');
    const addMenuModal = document.getElementById('add-menu-modal');
    const availableMenusList = document.getElementById('available-menus-list');
    const modalCloseBtn = addMenuModal.querySelector('.modal-close');

    if (!addGroupBtn || !menuGroupList || !addMenuModal || !availableMenusList || !modalCloseBtn) {
        return;
    }

    let draggedItem = null;
    let currentTargetMenuSelector = null;

    // ▼▼▼ KEMAS KINI: triggerSave kini menggunakan SaveManager ▼▼▼
    const triggerSave = () => {
        // Hanya hantar isyarat ke queue bahawa susunan menu perlu disimpan.
        const menuData = gatherMenuData();
        SaveManager.addToQueue('menus', null, menuData);
    };
    // ▲▲▲ TAMAT KEMAS KINI ▲▲▲

    const gatherMenuData = () => {
        const groupElements = menuGroupList.querySelectorAll('.menu-group-item');
        const menuData = Array.from(groupElements).map((groupEl, groupIndex) => {
            const groupName = groupEl.querySelector('.group-name-input').value;
            const itemElements = groupEl.querySelectorAll('.menu-selector .tag');
            const items = Array.from(itemElements).map((itemEl, itemIndex) => ({
                table_name: itemEl.childNodes[0].textContent.trim(),
                item_order: itemIndex
            }));
            return { 
                group_name: groupName, 
                items: items,
                group_order: groupIndex
            };
        });
        return menuData;
    };
	
    function getUsedMenuNames() {
        const usedTags = menuGroupList.querySelectorAll('.tag');
        return Array.from(usedTags).map(tag => tag.childNodes[0].textContent.trim());
    }

    addGroupBtn.addEventListener('click', () => {
        // Logik asal untuk menambah kumpulan baharu
        const newGroup = document.createElement('div');
        newGroup.className = 'menu-group-item';
        newGroup.setAttribute('draggable', 'true');
        newGroup.innerHTML = `
            <i class="fas fa-grip-vertical drag-handle"></i>
            <input type="text" class="group-name-input" value="New Group">
            <div class="menu-selector">
                <button class="add-menu-btn" title="Add menu to this group">+</button>
            </div>
            <div class="group-actions">
                <button class="btn-sidebar-icon" title="Delete group">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        `;
        menuGroupList.appendChild(newGroup);
        newGroup.querySelector('.group-name-input').addEventListener('input', triggerSave);

        // Logik baharu untuk overlay
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.remove('loading-overlay-hidden');
        }
        
        // Tetapkan flag dan cetuskan simpanan
        setAwaitingMenuGroupSave(true);
        triggerSave();
    });

    menuGroupList.addEventListener('click', (e) => {
        const target = e.target;
        if (target.classList.contains('add-menu-btn')) {
            const usedNames = getUsedMenuNames();
            const availableTables = allTableNames.filter(name => !usedNames.includes(name));

            availableMenusList.innerHTML = '';
            availableTables.forEach(tableName => {
                const li = document.createElement('li');
                li.textContent = tableName;
                li.dataset.menuName = tableName;
                availableMenusList.appendChild(li);
            });
            
            currentTargetMenuSelector = target.closest('.menu-selector');
            addMenuModal.classList.remove('hidden');
        } 
        else if (target.classList.contains('remove-tag')) {
            target.closest('.tag')?.remove();
            triggerSave();
        } else if (target.closest('.group-actions button')) {
            const groupToRemove = target.closest('.menu-group-item');
            if (groupToRemove) {
                showCustomDialog({
                    title: "Confirm Deletion",
                    message: "Are you sure you want to delete this menu group?",
                    showCancelButton: true,
                    onOk: () => {
                        groupToRemove.remove();
                        triggerSave();
                    }
                });
            }
        }
    });

    // Event listener untuk perubahan pada nama group yang sedia ada
    menuGroupList.addEventListener('input', (e) => {
        if (e.target.classList.contains('group-name-input')) {
            triggerSave();
        }
    });

    menuGroupList.addEventListener('dragstart', (e) => {
        draggedItem = e.target.closest('.menu-group-item, .tag');
        if (draggedItem) {
            setTimeout(() => draggedItem.classList.add('dragging'), 0);
        } else {
            e.preventDefault();
        }
    });

    menuGroupList.addEventListener('dragend', () => {
        if (draggedItem) {
            draggedItem.classList.remove('dragging');
            draggedItem = null;
            triggerSave(); // Simpan selepas operasi drag-and-drop selesai
        }
    });

    menuGroupList.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (!draggedItem) return;

        if (draggedItem.classList.contains('tag')) {
            const container = e.target.closest('.menu-selector');
            if (container) {
                const afterElement = getDragAfterElement(container, e.clientX, '.tag');
                if (afterElement == null) {
                    container.insertBefore(draggedItem, container.querySelector('.add-menu-btn'));
                } else {
                    container.insertBefore(draggedItem, afterElement);
                }
            }
        } else if (draggedItem.classList.contains('menu-group-item')) {
            const container = e.target.closest('.menu-group-list');
             if (container) {
                const afterElement = getDragAfterElement(container, e.clientY, '.menu-group-item');
                if (afterElement == null) {
                    container.appendChild(draggedItem);
                } else {
                    container.insertBefore(draggedItem, afterElement);
                }
            }
        }
    });

    function getDragAfterElement(container, y, selector) {
        const draggableElements = [...container.querySelectorAll(`${selector}:not(.dragging)`)];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = (selector === '.tag' ? y - box.left - box.width / 2 : y - box.top - box.height / 2);
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    availableMenusList.addEventListener('click', (e) => {
        if (e.target.tagName === 'LI') {
            const menuName = e.target.dataset.menuName;
            if (menuName && currentTargetMenuSelector) {
                const newTag = document.createElement('span');
                newTag.className = 'tag';
                newTag.setAttribute('draggable', 'true');
                newTag.innerHTML = `${menuName} <button class="remove-tag">&times;</button>`;
                
                const addBtn = currentTargetMenuSelector.querySelector('.add-menu-btn');
                currentTargetMenuSelector.insertBefore(newTag, addBtn);
                
                addMenuModal.classList.add('hidden');
                currentTargetMenuSelector = null;
                triggerSave();
            }
        }
    });
    
    modalCloseBtn.addEventListener('click', () => addMenuModal.classList.add('hidden'));
}

// =================================================================
// ▼▼▼ FUNGSI UNTUK MENGISI MODAL TETAPAN ▼▼▼
// =================================================================
async function populateSettingsModal() {
    const settings = await window.electronAPI.getAllSettings();
    if (!settings) {
        console.error("Tidak dapat memuatkan tetapan.");
        return;
    }

    const setValue = (id, value) => {
        const element = document.getElementById(id);
        if (element) {
            if (element.type === 'checkbox') {
                element.checked = value === '1';
            } else {
                element.value = value;
            }
        }
    };
    
    // General
    setValue('fizisys-check-updates', settings.check_updates);
    setValue('fizisys-autosave-interval', settings.autosave_interval);
    setValue('fizisys-show-begin-box', settings.show_begin_box);
    const fontSizeRadio = document.querySelector(`input[name="fizisys-font-size"][value="${settings.font_size}"]`);
    if (fontSizeRadio) fontSizeRadio.checked = true;
    setValue('fizisys-doc-root', settings.doc_root);
    setValue('fizisys-base-url', settings.base_url);
    // Field defaults
    setValue('fizisys-field-default-type', settings.field_default_type);
    setValue('fizisys-field-default-length', settings.field_default_length);
    // Table defaults
    setValue('fizisys-table-suggest-icon', settings.table_suggest_icon);
    setValue('fizisys-table-allow-csv', settings.table_allow_csv);
    setValue('fizisys-table-dv-separate-page', settings.table_dv_separate_page);
    setValue('fizisys-table-hide-save-as-copy', settings.table_hide_save_as_copy);
    setValue('fizisys-table-allow-add-from-homepage', settings.table_allow_add_from_homepage);
    setValue('fizisys-table-show-record-count', settings.table_show_record_count);
    // Project defaults
    setValue('fizisys-project-encoding', settings.project_encoding);
    setValue('fizisys-project-rtl', settings.project_rtl);
    setValue('fizisys-project-doxygen', settings.project_doxygen);
    setValue('fizisys-project-hide-footer', settings.project_hide_footer);
    setValue('fizisys-max-entries', settings.max_entries);
    setValue('fizisys-project-no-trim', settings.project_no_trim);
}


// =================================================================
// ▼▼▼ FUNGSI-FUNGSI UI YANG DIEKSPORT ▼▼▼
// =================================================================

export function updateActionButtonsState() {
    const activeLink = document.querySelector('.sidebar .nav-list a.active');
    const newFieldBtn = document.getElementById('btn-new-field');
    const moveUpBtn = document.getElementById('btn-move-up');
    const moveDownBtn = document.getElementById('btn-move-down');
    const deleteBtn = document.getElementById('btn-delete');
    const isDisabled = !(activeLink && activeLink.closest('.submenu'));
    if (newFieldBtn) newFieldBtn.disabled = isDisabled;
    if (moveUpBtn) moveUpBtn.disabled = isDisabled;
    if (moveDownBtn) moveDownBtn.disabled = isDisabled;
    if (deleteBtn) deleteBtn.disabled = isDisabled;
}

export function initializeTabSystems() {
    // Cari semua bekas tab dalam dokumen
    const allTabContainers = document.querySelectorAll('.tabs-container');

    allTabContainers.forEach(container => {
        // :scope memastikan kita hanya memilih anak-anak terus dari bekas ini
        const tabLinks = container.querySelectorAll(':scope > .tabs-nav > .tab-link');
        
        tabLinks.forEach(link => {
            link.addEventListener('click', () => {
                const tabId = link.dataset.tab;
                const contentContainer = container.querySelector(':scope > .tabs-content');
                const targetPane = contentContainer.querySelector(`#${tabId}`);

                // Nyahaktifkan semua link dan pane pada tahap yang sama
                link.closest('.tabs-nav').querySelectorAll('.tab-link').forEach(l => l.classList.remove('active'));
                contentContainer.querySelectorAll(':scope > .tab-pane').forEach(p => p.classList.remove('active'));

                // Aktifkan link yang diklik dan panel sasarannya
                link.classList.add('active');
                if (targetPane) {
                    targetPane.classList.add('active');

                    // ▼▼▼ KEMAS KINI UTAMA ADA DI SINI ▼▼▼
                    // Selepas mengaktifkan panel utama, semak jika ia mempunyai sub-tab.
                    const nestedTabs = targetPane.querySelector('.tabs-container');
                    if (nestedTabs) {
                        // Jika ada, cari pautan tab pertama dalam sub-tab itu.
                        const firstSubTabLink = nestedTabs.querySelector('.tabs-nav .tab-link');
                        if (firstSubTabLink) {
                            // Cetuskan klik pada pautan sub-tab pertama untuk mengaktifkannya.
                            firstSubTabLink.click();
                        }
                    }
                }
            });
        });

        // Pastikan tab pertama sentiasa aktif semasa permulaan
        if (tabLinks.length > 0 && !container.querySelector('.tabs-nav > .tab-link.active')) {
            tabLinks[0].click();
        }
    });
}

// ▼▼▼ FUNGSI-FUNGSI YANG HILANG SEBELUM INI KINI TELAH DIKEMBALIKAN ▼▼▼
export function populateSortByDropdown(tableName, elementId = 'tbl-default-sort-by') {
    const sortByDropdown = document.getElementById(elementId);
    if (!sortByDropdown || !jsonData) return;
    
    // Kosongkan senarai sedia ada
    sortByDropdown.innerHTML = (elementId === 'tbl-default-sort-by') ? '<option value="">None</option>' : '';
    
    const table = jsonData.database.table[tableName];
    if (table && table.fields) {
        for (const fieldName in table.fields) {
            const option = document.createElement('option');
            option.value = fieldName;
            option.textContent = fieldName;
            sortByDropdown.appendChild(option);
        }
    }
}

// js/uiHandlers.js

export function populateFocusFieldDropdown(tableName) {
    const defaultFocusDropdown = document.getElementById('tbl-default-focus');
    if (!defaultFocusDropdown || !jsonData) return;

    defaultFocusDropdown.innerHTML = ''; // Kosongkan senarai

    const table = jsonData.database.table[tableName];
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

export function initializeModalHandlers() {
    const configBtn = document.getElementById('config-btn');
    const configModal = document.getElementById('config-modal');
    const configModalClose = document.getElementById('config-modal-close');
    const configModalCancel = document.getElementById('config-modal-cancel');
    const configModalOk = document.getElementById('config-modal-ok');
    
    // Fungsi untuk mengumpul semua data dari modal FiziSysMaker Preferences
    const gatherFizisysSettings = () => {
        const settings = {};
        // Gunakan ID sebenar dari HTML (dengan sempang)
        const settingIds = [
            'check-updates', 'autosave-interval', 'show-begin-box', 'doc-root',
            'base-url', 'field-default-type', 'field-default-length', 'table-suggest-icon',
            'table-allow-csv', 'table-dv-separate-page', 'table-hide-save-as-copy',
            'table-allow-add-from-homepage', 'table-show-record-count', 'project-encoding',
            'project-rtl', 'project-doxygen', 'project-hide-footer', 'max-entries', 'project-no-trim'
        ];

        settingIds.forEach(id => {
            const element = document.getElementById(`fizisys-${id}`);
            if (element) {
                // Tukar ID kepada nama lajur DB (dengan garis bawah)
                const settingKey = id.replace(/-/g, '_');
                if (element.type === 'checkbox') {
                    settings[settingKey] = element.checked ? '1' : '0';
                } else {
                    settings[settingKey] = element.value;
                }
            }
        });
        
        const fontSize = document.querySelector('input[name="fizisys-font-size"]:checked');
        if (fontSize) {
            settings.font_size = fontSize.value;
        }
        
        return settings;
    };
    
    if (configBtn) {
        configBtn.addEventListener('click', async () => {
            await populateSettingsModal();
            configModal?.classList.remove('hidden');
        });
    }

    const closeModal = () => configModal?.classList.add('hidden');

    if (configModalClose) configModalClose.addEventListener('click', closeModal);
    if (configModalCancel) configModalCancel.addEventListener('click', closeModal);

    if (configModalOk) {
        configModalOk.addEventListener('click', async () => {
            const settingsData = gatherFizisysSettings();
            const result = await window.electronAPI.saveAllSettings(settingsData);
            
            if (result.success) {
                applyFontSize(settingsData.font_size); 
                showCustomDialog({ title: "Success", message: "Preferences have been saved." });
            } else {
                showCustomDialog({ title: "Error", message: `Failed to save preferences: ${result.message}` });
            }
            
            closeModal();
        });
    }
}

export function initializeMediaTabHandlers() {
    const mediaRadios = document.querySelectorAll('input[name="fld-media-type"]');
    const allPanels = document.querySelectorAll('.media-options-panel');

    if (mediaRadios.length === 0) return;

    mediaRadios.forEach(radio => {
        radio.addEventListener('click', () => {
            // 1. Sembunyikan semua panel terlebih dahulu
            allPanels.forEach(panel => panel.classList.add('hidden'));

            // 2. Tentukan ID panel yang sepadan
            const radioValue = radio.value; // cth: "link", "image", "upload"
            let targetPanelId;

            // Kendalikan kes khas untuk 'File upload'
            if (radioValue === 'upload') {
                targetPanelId = 'file-upload-options-panel';
            } else {
                targetPanelId = `${radioValue}-options-panel`;
            }

            // 3. Cari dan paparkan panel sasaran
            const targetPanel = document.getElementById(targetPanelId);
            if (targetPanel) {
                targetPanel.classList.remove('hidden');
            }
        });
    });
}

/**
 * Memastikan tab Media mempunyai keadaan lalai yang bersih apabila dibuka.
 * Fungsi ini dipanggil dari sidebar.js apabila pengguna mengklik pada medan.
 */
export function setupMediaTab(tableName, fieldName) {
    // Isi dropdown 'The other field' untuk kedua-dua panel Link dan File
    populateOtherFieldDropdown(tableName, fieldName);
    populateFileOtherFieldDropdown(tableName, fieldName);

    // Sembunyikan panel bersyarat secara lalai
    const gmapDetails = document.getElementById('gmap-details');
    const youtubeDetails = document.getElementById('youtube-details');
    if (gmapDetails) gmapDetails.classList.add('hidden');
    if (youtubeDetails) youtubeDetails.classList.add('hidden');

}

export function initializeOptionsListHandlers() {
    const quickListSelect = document.getElementById('options-quick-list');
    const valuesInput = document.getElementById('fld-options-list-values');

    if (quickListSelect && valuesInput) {
        quickListSelect.addEventListener('change', () => {
            if (quickListSelect.value) {
                // 1. Tetapkan nilai textbox seperti biasa
                valuesInput.value = quickListSelect.value;
                
                // 2. ▼▼▼ BARIS KOD KRITIKAL ▼▼▼
                // Cetuskan acara 'input' secara manual untuk memaklumkan SaveManager
                valuesInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });
    }
}

export function initializeLocalizationHandlers() {
    const dateOrderSelect = document.getElementById('app-date-order');
    const separatorSelect = document.getElementById('app-separator');
    const use24hrCheckbox = document.getElementById('app-use-24hr-format');
    const previewInput = document.getElementById('app-date-preview');

    // Pastikan semua elemen wujud sebelum meneruskan
    if (!dateOrderSelect || !separatorSelect || !use24hrCheckbox || !previewInput) {
        console.warn("Localization handler elements not found. Skipping initialization.");
        return;
    }

    const updateDateTimePreview = () => {
        const order = dateOrderSelect.value;
        const separator = separatorSelect.value;
        const is24hr = use24hrCheckbox.checked;

        // Gunakan tarikh dan masa yang tetap untuk pratonton
        const year = "2022";
        const month = "12";
        const day = "31";
        const time = is24hr ? "22:15" : "10:15 PM";

        let dateString;
        switch (order) {
            case 'ymd':
                dateString = `${year}${separator}${month}${separator}${day}`;
                break;
            case 'dmy':
                dateString = `${day}${separator}${month}${separator}${year}`;
                break;
            case 'mdy':
            default:
                dateString = `${month}${separator}${day}${separator}${year}`;
                break;
        }

        // Kemas kini nilai medan pratonton
        previewInput.value = `${dateString} ${time}`;
    };

    // Panggil fungsi apabila mana-mana kawalan diubah
    dateOrderSelect.addEventListener('change', updateDateTimePreview);
    separatorSelect.addEventListener('change', updateDateTimePreview);
    use24hrCheckbox.addEventListener('change', updateDateTimePreview);

    // Panggil sekali semasa muat untuk menetapkan nilai awal
    updateDateTimePreview();
}

export function updatePreviewImage() {
    const themeSelect = document.getElementById('app-theme-select');
    const previewImage = document.getElementById('theme-preview-image');
    const selectedViewRadio = document.querySelector('input[name="view_mode"]:checked');

    // Pastikan semua elemen wujud
    if (!themeSelect || !previewImage || !selectedViewRadio) {
        console.warn("Theme preview elements not found.");
        return;
    }

    const theme = themeSelect.value; // cth: "bootstrap", "darkly"
    const viewMode = selectedViewRadio.value === 'table_view' ? 'TV' : 'DV'; // Tukar kepada 'TV' atau 'DV'

    // Bina nama fail imej yang baharu
    previewImage.src = `images/northwind-${theme}-${viewMode}.png`;
}

export function initializeThemeHandlers() {
    const themeSelect = document.getElementById('app-theme-select');
    const viewModeRadios = document.querySelectorAll('input[name="view_mode"]');

    if (themeSelect) {
        themeSelect.addEventListener('change', updatePreviewImage);
    }

    viewModeRadios.forEach(radio => {
        radio.addEventListener('change', updatePreviewImage);
    });

    // Panggil sekali untuk tetapkan imej yang betul semasa aplikasi dimuatkan
    updatePreviewImage();
}

export function initializeSecurityTabHandlers() {
    const openBrowserBtn = document.getElementById('open-browser-btn');
    const appUrlInput = document.getElementById('app-url');

    const hideLoginCheckbox = document.getElementById('app-hide_login');

    if (hideLoginCheckbox) {
        hideLoginCheckbox.addEventListener('change', () => {
            if (hideLoginCheckbox.checked) {
                const message = "This will hide the 'Sign in' links and any membership features from visitors. " +
                    "However, you might still need to log in to the admin area to set the desired " +
                    "permissions for anonymous users. This is necessary sometimes when visitors " +
                    "are unable to access some tables.";
                showCustomDialog({ title: "Important Note!", message: message });
            }
        });
    }
	
    if (!openBrowserBtn || !appUrlInput) {
        console.warn("Security tab elements not found. Skipping initialization.");
        return;
    }

    openBrowserBtn.addEventListener('click', () => {
        const url = appUrlInput.value.trim();

        // Pastikan URL tidak kosong sebelum cuba membukanya
        if (url) {
            // Panggil fungsi yang didedahkan oleh preload.js
            window.electronAPI.openUrl(url);
        } else {
                showCustomDialog({
                    title: "Input Error",
                    message: "Application URL is empty."
                });
        }
    });
}

export function initializeClassSelectorHandlers() {
    // Kumpulan untuk Table View
    const tvSelect = document.getElementById('table-view-classes-select');
    const tvInput = document.getElementById('tbl-table-view-classes-input');

    // Kumpulan untuk Detail View
    const dvSelect = document.getElementById('detail-view-classes-select');
    const dvInput = document.getElementById('tbl-detail-view-classes-input');

    if (tvSelect && tvInput) {
        tvSelect.addEventListener('change', () => {
            tvInput.value = tvSelect.value;
            // ▼▼▼ KEMAS KINI: Cetuskan event 'input' secara manual ▼▼▼
            tvInput.dispatchEvent(new Event('input', { bubbles: true }));
            // ▲▲▲ TAMAT KEMAS KINI ▲▲▲
        });
    }

    if (dvSelect && dvInput) {
        dvSelect.addEventListener('change', () => {
            dvInput.value = dvSelect.value;
            // ▼▼▼ KEMAS KINI: Cetuskan event 'input' secara manual ▼▼▼
            dvInput.dispatchEvent(new Event('input', { bubbles: true }));
            // ▲▲▲ TAMAT KEMAS KINI ▲▲▲
        });
    }
}

// FIND AND REPLACE THIS ENTIRE FUNCTION IN: uiHandlers.js

export function initializeAutoDefaultHandlers() {
    const autoDefaultBtn = document.getElementById('auto-default-btn');
    const autoDefaultModal = document.getElementById('auto-default-modal');
    const defaultValueInput = document.getElementById('fld-default-value');
    
    // Elemen di dalam modal
    const selectValue = document.getElementById('auto-default-select');
    const btnOk = document.getElementById('auto-default-ok');
    const btnCancel = document.getElementById('auto-default-cancel');
    const btnClose = document.getElementById('auto-default-close');

    if (!autoDefaultBtn || !autoDefaultModal || !defaultValueInput || !selectValue || !btnOk || !btnCancel || !btnClose) {
        console.warn("Auto-default handler elements not found. Skipping initialization.");
        return;
    }

    const closeModal = () => autoDefaultModal.classList.add('hidden');

    autoDefaultBtn.addEventListener('click', () => {
        autoDefaultModal.classList.remove('hidden');
    });

    btnOk.addEventListener('click', () => {
        // 1. Salin nilai dari dropdown modal ke textbox 'Default'
        defaultValueInput.value = selectValue.value;

        // 2. ▼▼▼ BARIS KOD TAMBAHAN (PEMBETULAN) ▼▼▼
        // Cetuskan acara 'input' untuk memaklumkan SaveManager tentang perubahan
        defaultValueInput.dispatchEvent(new Event('input', { bubbles: true }));

        // 3. Tutup modal
        closeModal();
    });

    btnCancel.addEventListener('click', closeModal);
    btnClose.addEventListener('click', closeModal);
}

export function initializeLinkOptionsHandlers() {
    const behaviorSelect = document.getElementById('fld-media-link-behavior');
    const displayAsGroup = document.getElementById('link-display-as-group');
    const displayAsSelect = document.getElementById('fld-media-link-display-as');
    const otherFieldGroup = document.getElementById('link-other-field-group');

    if (!behaviorSelect || !displayAsGroup || !displayAsSelect || !otherFieldGroup) {
        console.warn("Link options handler elements not found. Skipping initialization.");
        return;
    }

    // Listener untuk dropdown pertama: "Behavior..."
    behaviorSelect.addEventListener('change', () => {
        const value = behaviorSelect.value;
        if (value === 'web_link' || value === 'email_link') {
            displayAsGroup.classList.remove('hidden');
        } else {
            displayAsGroup.classList.add('hidden');
        }
        // Cetuskan 'change' pada dropdown kedua untuk memastikan keadaannya betul
        displayAsSelect.dispatchEvent(new Event('change'));
    });

    // Listener untuk dropdown kedua: "Display the link..."
    displayAsSelect.addEventListener('change', () => {
        // Hanya paparkan jika dropdown pertama membenarkannya
        if (!displayAsGroup.classList.contains('hidden') && displayAsSelect.value === 'other_field') {
            otherFieldGroup.classList.remove('hidden');
        } else {
            otherFieldGroup.classList.add('hidden');
        }
    });
}

function populateOtherFieldDropdown(tableName, currentFieldName) {
    const otherFieldSelect = document.getElementById('fld-media-link-other-field');
    if (!otherFieldSelect || !jsonData) return;

    // Kosongkan senarai sedia ada
    otherFieldSelect.innerHTML = '';

    const table = jsonData.database.table[tableName];
    if (table && table.fields) {
        // Dapatkan semua nama medan dan tapis keluar medan semasa
        const otherFields = Object.keys(table.fields).filter(f => f !== currentFieldName);

        otherFields.forEach(fieldName => {
            const option = document.createElement('option');
            option.value = fieldName;
            option.textContent = fieldName;
            otherFieldSelect.appendChild(option);
        });
    }
}

export function initializeImageOptionsHandlers() {
    const mainCheckbox = document.getElementById('fld-allow-image-uploads');
    const imageOptionsTabs = document.getElementById('image-options-tabs');

    const dependentControls = [
        document.getElementById('fld-max-file-size'),
        document.getElementById('fld-delete-image-server'),
        document.getElementById('fld-dont-rename-image'),
        document.getElementById('fld-tv-thumb-width'),
        document.getElementById('fld-tv-thumb-height'),
        document.getElementById('fld-tv-enable-zooming'),
        document.getElementById('fld-tv-show-full-size'),
        document.getElementById('fld-dv-thumb-width'),
        document.getElementById('fld-dv-thumb-height'),
        document.getElementById('fld-dv-enable-zooming'),
        document.getElementById('fld-dv-show-full-size')
    ];

    const tvShowFullSize = document.getElementById('fld-tv-show-full-size');
    const tvEnableZooming = document.getElementById('fld-tv-enable-zooming');
    const dvShowFullSize = document.getElementById('fld-dv-show-full-size');
    const dvEnableZooming = document.getElementById('fld-dv-enable-zooming');

    const toggleImageOptions = () => {
        const isEnabled = mainCheckbox.checked;
        imageOptionsTabs.classList.toggle('hidden', !isEnabled);
        dependentControls.forEach(control => {
            if (control) control.disabled = !isEnabled;
        });
        if(isEnabled) {
             handleZoomDependency();
        }
    };

    // ▼▼▼ KEMAS KINI FUNGSI INI ▼▼▼
    const handleZoomDependency = () => {
        if (tvShowFullSize && tvEnableZooming) {
            const isDisabled = tvShowFullSize.checked;
            tvEnableZooming.disabled = isDisabled;
            // Jika ia dinyahaktifkan, pastikan ia juga dinyah-tanda
            if (isDisabled) {
                tvEnableZooming.checked = false;
            }
        }
        if (dvShowFullSize && dvEnableZooming) {
            const isDisabled = dvShowFullSize.checked;
            dvEnableZooming.disabled = isDisabled;
            // Jika ia dinyahaktifkan, pastikan ia juga dinyah-tanda
            if (isDisabled) {
                dvEnableZooming.checked = false;
            }
        }
    };

    if (mainCheckbox) {
        mainCheckbox.addEventListener('change', toggleImageOptions);
    }
    if (tvShowFullSize) {
        tvShowFullSize.addEventListener('change', handleZoomDependency);
    }
    if (dvShowFullSize) {
        dvShowFullSize.addEventListener('change', handleZoomDependency);
    }
    
    if(mainCheckbox) {
        toggleImageOptions();
    }
}
function populateFileOtherFieldDropdown(tableName, currentFieldName) {
    const otherFieldSelect = document.getElementById('fld-file-other-field');
    if (!otherFieldSelect || !jsonData) return;

    otherFieldSelect.innerHTML = '';
    const table = jsonData.database.table[tableName];
    if (table && table.fields) {
        const otherFields = Object.keys(table.fields).filter(f => f !== currentFieldName);
        otherFields.forEach(fieldName => {
            const option = document.createElement('option');
            option.value = fieldName;
            option.textContent = fieldName;
            otherFieldSelect.appendChild(option);
        });
    }
}

export function initializeFileUploadOptionsHandlers() {
    // --- Bahagian 1: Logik Checkbox Utama ---
    const mainCheckbox = document.getElementById('fld-allow-file-uploads');
    const dependentControls = [
        document.getElementById('fld-file-types'),
        document.getElementById('fld-file-max-size'),
        document.getElementById('fld-delete-file-server'),
        document.getElementById('fld-dont-rename-file'),
        document.getElementById('fld-file-behavior'),
        document.getElementById('fld-file-display-as'),
        document.getElementById('fld-file-other-field')
    ];

    // --- Bahagian 2: Logik Dropdown Bersyarat ---
    const behaviorSelect = document.getElementById('fld-file-behavior');
    // Tetapkan 'Download link' sebagai nilai lalai
    if (behaviorSelect) {
        behaviorSelect.value = 'download_link';
    }
    const displayAsGroup = document.getElementById('fld-file-display-as-group');
    const displayAsSelect = document.getElementById('fld-file-display-as');
    const otherFieldGroup = document.getElementById('fld-file-other-field-group');

    const toggleAllOptions = () => {
        const isEnabled = mainCheckbox.checked;
        dependentControls.forEach(control => {
            if (control) control.disabled = !isEnabled;
        });
        // Cetuskan event pada dropdown untuk reset keadaan paparannya
        if (behaviorSelect) behaviorSelect.dispatchEvent(new Event('change'));
    };

    if (mainCheckbox) {
        mainCheckbox.addEventListener('change', toggleAllOptions);
    }

    // Pasang listener untuk dropdown bersyarat
    if (behaviorSelect) {
        behaviorSelect.addEventListener('change', () => {
            if (behaviorSelect.value === 'download_link') {
                displayAsGroup.classList.remove('hidden');
            } else {
                displayAsGroup.classList.add('hidden');
            }
            if (displayAsSelect) displayAsSelect.dispatchEvent(new Event('change'));
        });
    }

    if (displayAsSelect) {
        displayAsSelect.addEventListener('change', () => {
            if (!displayAsGroup.classList.contains('hidden') && displayAsSelect.value === 'other_field') {
                otherFieldGroup.classList.remove('hidden');
            } else {
                otherFieldGroup.classList.add('hidden');
            }
        });
    }

    // Tetapkan keadaan awal semasa muat
    if (mainCheckbox) {
        toggleAllOptions();
    }
}

export function initializeMediaVisibilityHandlers() {
    // --- Pengendali untuk Google Map ---
    const gmapCheckbox = document.getElementById('fld-display-gmap');
    const gmapDetails = document.getElementById('gmap-details');

    if (gmapCheckbox && gmapDetails) {
        gmapCheckbox.addEventListener('change', () => {
            gmapDetails.classList.toggle('hidden', !gmapCheckbox.checked);
        });
    }

    // --- Pengendali untuk YouTube Video ---
    const youtubeCheckbox = document.getElementById('fld-accept-video-url');
    const youtubeDetails = document.getElementById('youtube-details');

    if (youtubeCheckbox && youtubeDetails) {
        youtubeCheckbox.addEventListener('change', () => {
            youtubeDetails.classList.toggle('hidden', !youtubeCheckbox.checked);
        });
    }
}

export function populateParentChildTab(currentTableName) {
    const childList = document.getElementById('child-table-list');
    const listPanel = childList.parentElement; 
    const optionsPanel = listPanel.nextElementSibling;
    const optionsTitle = document.getElementById('selected-child-table-name');
    const formElements = {
        showTab: document.getElementById('parentchild-show-tab'),
        showIcon: document.getElementById('parentchild-show-icon'),
        autocloseModal: document.getElementById('parentchild-autoclose-modal'),
        tabTitle: document.getElementById('parentchild-tab-title'),
        copyRecords: document.getElementById('parentchild-copy-records'),
        showLinkAbove: document.getElementById('parentchild-show-link-above'),
        showCount: document.getElementById('parentchild-show-count-in-tv'),
        allowAdd: document.getElementById('parentchild-allow-add-from-tv')
    };
    
    if (!childList || !jsonData.database.relationships || !optionsPanel) return;

    const children = jsonData.database.relationships.filter(
        rel => rel.parent_table_name === currentTableName
    );

    childList.innerHTML = '';

    if (children.length === 0) {
        optionsPanel.classList.add('hidden');
        const emptyMessage = `
            <div class="empty-state-label" style="padding: 1rem; text-align: left;">
                <p style="text-align: center; font-weight: 500;">This table has no child tables.</p>
                <span style="display: block; text-align: center; margin-top: 0.5rem; font-size: 0.85em;">
                    To create a relationship, select the foreign key field in the side menu and set the 'Parent table' in the 'Lookup field' tab.
                </span>
            </div>
        `;
        childList.innerHTML = emptyMessage;
    } else {
        optionsPanel.classList.remove('hidden');
        Object.values(formElements).forEach(el => el.type === 'checkbox' ? el.checked = false : el.value = '');
        optionsTitle.textContent = '...';

        children.forEach(child => {
            const li = document.createElement('li');
            li.textContent = child.child_table_name;
            li.dataset.childName = child.child_table_name; // Pastikan dataset ini wujud
            childList.appendChild(li);
        });
        
        const populateForm = (childName) => {
            const relationData = children.find(c => c.child_table_name === childName);
            if (!relationData) return;
            optionsTitle.textContent = childName;
            formElements.showTab.checked = relationData.show_tab === 1;
            formElements.showIcon.checked = relationData.show_icon === 1;
            formElements.autocloseModal.checked = relationData.autoclose_modal === 1;
            formElements.tabTitle.value = relationData.tab_title || '';
            formElements.copyRecords.checked = relationData.copy_records === 1;
            formElements.showLinkAbove.checked = relationData.show_link_above === 1;
            formElements.showCount.checked = relationData.show_count_in_tv === 1;
            formElements.allowAdd.checked = relationData.allow_add_from_tv === 1;
        };

        // Elakkan menambah event listener berulang kali
        const newChildList = childList.cloneNode(true);
        childList.parentNode.replaceChild(newChildList, childList);

        newChildList.addEventListener('click', (event) => {
            if (event.target.tagName === 'LI') {
                newChildList.querySelectorAll('li').forEach(li => li.classList.remove('active'));
                event.target.classList.add('active');
                populateForm(event.target.dataset.childName);
            }
        });

        const itemToSelect = newChildList.querySelector(`li[data-child-name="${lastActiveChildTable}"]`);

        if (itemToSelect) {
            itemToSelect.click();
        } else if (newChildList.firstChild && newChildList.firstChild.tagName === 'LI') {
            newChildList.firstChild.click();
        }
        
        // ▼▼▼ KEMAS KINI: Baris kod di bawah ini telah dibuang ▼▼▼
        // setLastActiveChildTable(null); 
        // ▲▲▲ TAMAT KEMAS KINI ▲▲▲
    }
}

export function populateMainDashboard(projectData) {
    if (!projectData) {
        console.warn("Tiada data projek untuk dipaparkan di papan pemuka.");
        return;
    }

    // Tab: Localization
    setElementValue('app-title', projectData.app_title);
    setElementValue('app-date-order', projectData.date_order);
    setElementValue('app-separator', projectData.separator);
    setElementValue('app-char-encoding', projectData.char_encoding);
    setElementValue('app-language-select', projectData.language_select);
    setElementValue('app-timezone-select', projectData.timezone_select);
    setElementValue('app-use-24hr-format', projectData.use_24hr_format);
    setElementValue('app-enforce_mysql_encoding', projectData.enforce_mysql_encoding);
    
    // Tab: Theme
    setElementValue('app-theme-select', projectData.theme_select);
    setElementValue('app-use_3d_effects', projectData.use_3d_effects);
    setElementValue('app-rtl', projectData.rtl);
    setElementValue('app-compact', projectData.compact);
    
    // Tab: Menu management
    setRadioValue('app-menu_orientation', projectData.menu_orientation);
    setElementValue('app-menu_at_homepage', projectData.menu_at_homepage);
    setElementValue('app-tables-per-row', projectData.tables_per_row);
    setRadioValue('app-extra-wide', projectData.extra_wide);
    setElementValue('app-panel-height', projectData.panel_height);
    
    // Tab: Security & technical
    setElementValue('app-hide_login', projectData.hide_login);
    setElementValue('app-allow_sql_tool', projectData.allow_sql_tool);
    setElementValue('app-allow_server_status', projectData.allow_server_status);
    setElementValue('app-admins_group_access', projectData.admins_group_access);
    setElementValue('app-allow_table_view_sql', projectData.allow_table_view_sql);
    setElementValue('app-copy_children_async', projectData.copy_children_async);
    setElementValue('app-allow_pwa_install', projectData.allow_pwa_install);
    setElementValue('app-url', projectData.url);
    
    // Cetuskan event untuk kemas kini pratonton yang bergantung pada nilai ini
    document.getElementById('app-date-order')?.dispatchEvent(new Event('change'));
    document.getElementById('app-theme-select')?.dispatchEvent(new Event('change'));
	
    const menuCheckbox = document.getElementById('app-menu_at_homepage');
    if (menuCheckbox) {
        menuCheckbox.dispatchEvent(new Event('change'));
    }
}

export function populateTableSettings(tableName) {

    populateSortByDropdown(tableName);
    populateFocusFieldDropdown(tableName);
    populateRecordOwnerDropdown(tableName);
		
    const tableData = jsonData.database.table[tableName];
    if (!tableData) {
        console.error(`Tiada data ditemui untuk jadual: ${tableName}`);
        return;
    }
	
    setElementValue('tbl-table-name', tableData.table_name);
    // Tab: Table view -> General
    setElementValue('tbl-table-view-title', tableData.table_view_title);
    setElementValue('tbl-table-description', tableData.table_description);

    // Tab: Table view -> Display & Data
    setElementValue('tbl-show-quick-search', tableData.show_quick_search);
    setElementValue('tbl-records-per-page', tableData.records_per_page);
    setElementValue('tbl-default-sort-by', tableData.default_sort_by);
    setElementValue('tbl-sort-descending', tableData.sort_descending);

    // Tab: Table view -> Permissions
    setElementValue('tbl-allow-sorting', tableData.allow_sorting);
    setElementValue('tbl-allow-filters', tableData.allow_filters);
    setElementValue('tbl-allow-csv-export', tableData.allow_csv_export);
    setElementValue('tbl-allow-print-view', tableData.allow_print_view);
    setElementValue('tbl-allow-user-save-filters', tableData.allow_user_save_filters);
    setElementValue('tbl-hide-homepage-link', tableData.hide_homepage_link);
    setElementValue('tbl-allow-mass-delete', tableData.allow_mass_delete);
    setElementValue('tbl-filter-before-view', tableData.filter_before_view);
    setElementValue('tbl-hide-nav-menu-link', tableData.hide_nav_menu_link);
    setElementValue('tbl-show-record-count', tableData.show_record_count);

    // Tab: Table view -> Template
    setElementValue('tbl-tv-template', tableData.tv_template);
    setElementValue('tbl-hide-field-captions', tableData.hide_field_captions);
    setElementValue('tbl-use-first-field-as-title', tableData.use_first_field_as_title);
    setElementValue('tbl-table-view-classes-input', tableData.table_view_classes_input);
    setElementValue('tbl-detail-view-classes-input', tableData.detail_view_classes_input);
    
    // Tab: Detail View -> General
    setElementValue('tbl-detail-view-title', tableData.detail_view_title);
    setElementValue('tbl-record-owner', tableData.record_owner);
    setElementValue('tbl-default-focus', tableData.default_focus);
    setElementValue('tbl-redirect-after-insert', tableData.redirect_after_insert);

    // Tab: Detail View -> Permissions
    setElementValue('tbl-enable-detail-view', tableData.enable_detail_view);
    setElementValue('tbl-delete-with-children', tableData.delete_with_children);
    setElementValue('tbl-dv-allow-print-view', tableData.dv_allow_print_view);
    setElementValue('tbl-dv-separate-page', tableData.dv_separate_page);
    setElementValue('tbl-dv-hide-save-as-copy', tableData.dv_hide_save_as_copy);
    setElementValue('tbl-dv-sticky-buttons', tableData.dv_sticky_buttons);
    setElementValue('tbl-dv-allow-add-from-homepage', tableData.dv_allow_add_from_homepage);
	
    const tvClassesInput = document.getElementById('tbl-table-view-classes-input');
    const tvClassesSelect = document.getElementById('table-view-classes-select');
    if (tvClassesInput && tvClassesSelect) {
        tvClassesSelect.value = tvClassesInput.value;
    }

    const dvClassesInput = document.getElementById('tbl-detail-view-classes-input');
    const dvClassesSelect = document.getElementById('detail-view-classes-select');
    if (dvClassesInput && dvClassesSelect) {
        dvClassesSelect.value = dvClassesInput.value;
	}
	
	updateTableViewTemplatePreview();
}

/**
 * Mengisi dropdown 'Parent table' dengan semua jadual lain dalam projek.
 * @param {string} currentTableName - Nama jadual semasa, untuk dikecualikan.
 */
function populateParentTableDropdown(currentTableName) {
    const parentTableSelect = document.getElementById('fld-lookup-parent-table');
    parentTableSelect.innerHTML = '<option value=""></option>'; // Kosongkan dan tambah opsyen lalai

    const otherTables = allTableNames.filter(name => name !== currentTableName);
    otherTables.forEach(tableName => {
        const option = document.createElement('option');
        option.value = tableName;
        option.textContent = tableName;
        parentTableSelect.appendChild(option);
    });
}

export function populateFieldSettings(tableName, fieldName) {
	
    const allFieldPageControls = document.querySelectorAll(
        '#field-settings-page input, #field-settings-page select, #field-settings-page textarea, #field-settings-page button'
    );
    allFieldPageControls.forEach(control => {
        control.disabled = false;
    });
	
    const fieldData = jsonData.database.table[tableName]?.fields[fieldName];
     // ▼▼▼ CHECKPOINT #3: DATA SELEPAS DITERIMA DI FRONTEND ▼▼▼
    //console.log(`--- CHECKPOINT 3 (uiHandlers.js): Data Untuk Medan ${tableName}.${fieldName} ---`);
    //console.log(fieldData);
    // ▲▲▲ TAMAT CHECKPOINT #3 ▲▲▲   
    //console.log(`Mempaparkan data untuk medan: ${tableName}.${fieldName}`, fieldData);

    if (!fieldData) {
        console.error(`Tiada data ditemui untuk medan: ${tableName}.${fieldName}`);
        return;
    }
    populateParentTableDropdown(tableName);
	
	setElementValue('fld-field-name', fieldData.field_name);
    // Tab: General
    setElementValue('fld-caption', fieldData.caption);
    setElementValue('fld-description', fieldData.description);
    setElementValue('fld-data-type', fieldData.data_type);
    setElementValue('fld-length', fieldData.length);
	setElementValue('fld-precision', fieldData.precision);
    setElementValue('fld-max-chars-in-tv', fieldData.max_chars_in_tv);
    setElementValue('fld-alignment', fieldData.alignment);
    setElementValue('fld-default-value', fieldData.default_value);
    setElementValue('fld-read-only', fieldData.read_only);
    setElementValue('fld-primary-key', fieldData.primary_key);
    setElementValue('fld-zero-fill', fieldData.zero_fill);
    setElementValue('fld-required', fieldData.required);
    setElementValue('fld-rich-html', fieldData.rich_html);
    setElementValue('fld-auto-increment', fieldData.auto_increment);
    setElementValue('fld-unique', fieldData.unique);
    setElementValue('fld-show-sum', fieldData.show_sum);
    setElementValue('fld-text-area', fieldData.text_area);
    setElementValue('fld-unsigned', fieldData.unsigned);
    setElementValue('fld-no-filter', fieldData.no_filter);
    setElementValue('fld-binary', fieldData.binary);
    setElementValue('fld-check-box', fieldData.check_box);
    setElementValue('fld-hide-in-tv', fieldData.hide_in_tv);
    setElementValue('fld-hide-in-dv', fieldData.hide_in_dv);
    setElementValue('fld-enable-column-width', fieldData.enable_column_width);
    setElementValue('fld-column-width', fieldData.column_width);

    // Tab: Media
    const mediaType = fieldData.media_type || 'link';
    setRadioValue('fld-media-type', mediaType);
    document.getElementById(`fld-media-${mediaType}`)?.dispatchEvent(new Event('click'));
    setElementValue('fld-media-link-behavior', fieldData.media_link_behavior);
    setElementValue('fld-media-link-display-as', fieldData.media_link_display_as);
    setElementValue('fld-media-link-other-field', fieldData.media_link_other_field);
    setElementValue('fld-allow-image-uploads', fieldData.allow_image_uploads);
    setElementValue('fld-max-file-size', fieldData.max_file_size);
    setElementValue('fld-delete-image-server', fieldData.delete_image_server);
    setElementValue('fld-dont-rename-image', fieldData.dont_rename_image);
    setElementValue('fld-tv-thumb-width', fieldData.tv_thumb_width);
    setElementValue('fld-tv-thumb-height', fieldData.tv_thumb_height);
    setElementValue('fld-tv-enable-zooming', fieldData.tv_enable_zooming);
    setElementValue('fld-tv-show-full-size', fieldData.tv_show_full_size);
    setElementValue('fld-dv-thumb-width', fieldData.dv_thumb_width);
    setElementValue('fld-dv-thumb-height', fieldData.dv_thumb_height);
    setElementValue('fld-dv-enable-zooming', fieldData.dv_enable_zooming);
    setElementValue('fld-dv-show-full-size', fieldData.dv_show_full_size);
    document.getElementById('fld-allow-image-uploads')?.dispatchEvent(new Event('change'));
    setElementValue('fld-allow-file-uploads', fieldData.allow_file_uploads);
    setElementValue('fld-file-types', fieldData.file_types);
    setElementValue('fld-file-max-size', fieldData.file_max_size);
    setElementValue('fld-delete-file-server', fieldData.delete_file_server);
    setElementValue('fld-dont-rename-file', fieldData.dont_rename_file);
    setElementValue('fld-file-behavior', fieldData.file_behavior);
    setElementValue('fld-file-display-as', fieldData.file_display_as);
    setElementValue('fld-file-other-field', fieldData.file_other_field);
    document.getElementById('fld-allow-file-uploads')?.dispatchEvent(new Event('change'));
    setElementValue('fld-display-gmap', fieldData.display_gmap);
    setRadioValue('fld-gmap-type', fieldData.gmap_type);
    setElementValue('fld-gmap-tv-width', fieldData.gmap_tv_width);
    setElementValue('fld-gmap-tv-height', fieldData.gmap_tv_height);
    setElementValue('fld-gmap-dv-height', fieldData.gmap_dv_height);
    document.getElementById('fld-display-gmap')?.dispatchEvent(new Event('change'));
    setElementValue('fld-accept-video-url', fieldData.accept_video_url);
    setElementValue('fld-youtube-tv-width', fieldData.youtube_tv_width);
    setElementValue('fld-youtube-tv-height', fieldData.youtube_tv_height);
    setElementValue('fld-youtube-dv-width', fieldData.youtube_dv_width);
    setElementValue('fld-youtube-dv-height', fieldData.youtube_dv_height);
    document.getElementById('fld-accept-video-url')?.dispatchEvent(new Event('change'));

    // Tab: Lookup field
    setElementValue('fld-lookup-parent-table', fieldData.lookup_parent_table);
    const parentTableSelect = document.getElementById('fld-lookup-parent-table');
    if (parentTableSelect) {
        parentTableSelect.dispatchEvent(new Event('change'));
    }
    setElementValue('fld-lookup-caption-1', fieldData.lookup_caption_1);
    setElementValue('fld-lookup-separator', fieldData.lookup_separator);
    setElementValue('fld-lookup-caption-2', fieldData.lookup_caption_2);
    setRadioValue('fld-lookup-display-as', fieldData.lookup_display_as);
    setElementValue('fld-lookup-inherit-permissions', fieldData.lookup_inherit_permissions);
    setElementValue('fld-lookup-link-behavior', fieldData.lookup_link_behavior);
    setElementValue('fld-lookup-custom-query-hidden', fieldData.lookup_custom_query);

    if (parentTableSelect && !parentTableSelect.value) {
        const relationship = jsonData.database.relationships.find(rel =>
            rel.child_table_name === tableName && rel.fk_child_field === fieldName
        );
        if (relationship) {
            const parentTable = relationship.parent_table_name;
            const parentPKField = relationship.parent_field;
            setElementValue('fld-lookup-parent-table', parentTable);
            parentTableSelect.dispatchEvent(new Event('change'));
            const parentTableFields = jsonData.database.table[parentTable]?.fields;
            if (parentTableFields) {
                const fieldNames = Object.keys(parentTableFields);
                const pkIndex = fieldNames.indexOf(parentPKField);
                if (pkIndex > -1 && pkIndex < fieldNames.length - 1) {
                    const nextFieldName = fieldNames[pkIndex + 1];
                    setElementValue('fld-lookup-caption-1', nextFieldName);
                }
            }
        }
    }

    // Tab: Options list
    setElementValue('fld-options-list-values', fieldData.options_list_values);
    setRadioValue('fld-options-display', fieldData.options_display);

    // ▼▼▼ KOD PEMBAIKAN BUG ADA DI SINI ▼▼▼
    const quickListSelect = document.getElementById('options-quick-list');
    if (quickListSelect) {
        const currentValue = fieldData.options_list_values || '';
        let matchFound = false;
        // Cari jika nilai semasa sepadan dengan mana-mana opsyen dalam "Quick List!"
        for (const option of quickListSelect.options) {
            if (option.value === currentValue) {
                option.selected = true;
                matchFound = true;
                break;
            }
        }
        // Jika tiada padanan, pastikan opsyen lalai "Quick List!" dipilih
        if (!matchFound) {
            quickListSelect.value = '';
        }
    }
    // ▲▲▲ TAMAT PEMBAIKAN BUG ▲▲▲

    // Tab: Data format
    setElementValue('fld-format-as', fieldData.format_as);

    // Tab: Calculated field
    setElementValue('fld-calculated-enable', fieldData.calculated_enable);
    setElementValue('fld-calculated-query', fieldData.calculated_query);
	
	// Tab: Algorithm field
	setElementValue('fld-algorithm-enable', fieldData.algorithm_enable);
	setElementValue('fld-algorithm-logic', fieldData.algorithm_logic);
	setElementValue('fld-hook-functions', fieldData.hook_functions);
	
	applyDataTypeRules();
	
    setTimeout(() => {
        const queryTextarea = document.getElementById('fld-calculated-query');
        if (queryTextarea) {
            queryTextarea.disabled = false;
        }
    }, 50);


    const behaviorSelect = document.getElementById('fld-media-link-behavior');
    if (behaviorSelect) {
        behaviorSelect.dispatchEvent(new Event('change'));
    }

}

/**
 * Mengisi dropdown Parent Caption (Part 1 & 2) dengan senarai medan
 * dari jadual induk yang dipilih.
 * @param {string} parentTableName - Nama jadual induk yang dipilih.
 */
function populateParentCaptionDropdowns(parentTableName) {
    const caption1Select = document.getElementById('fld-lookup-caption-1');
    const caption2Select = document.getElementById('fld-lookup-caption-2');

    // Kosongkan kedua-dua dropdown
    caption1Select.innerHTML = '<option value=""></option>';
    caption2Select.innerHTML = '<option value=""></option>';

    if (parentTableName && jsonData.database.table[parentTableName]) {
        const parentFields = Object.keys(jsonData.database.table[parentTableName].fields);
        parentFields.forEach(fieldName => {
            const option1 = document.createElement('option');
            option1.value = fieldName;
            option1.textContent = fieldName;
            caption1Select.appendChild(option1);

            const option2 = document.createElement('option');
            option2.value = fieldName;
            option2.textContent = fieldName;
            caption2Select.appendChild(option2);
        });
    }
}

export function initializeLookupFieldHandlers() {
    const parentTableSelect = document.getElementById('fld-lookup-parent-table');
    const caption1Select = document.getElementById('fld-lookup-caption-1');

    if (parentTableSelect && caption1Select) {
        parentTableSelect.addEventListener('change', () => {
            const selectedTable = parentTableSelect.value;
            
            // 1. Isi dropdown caption dengan semua medan seperti biasa
            populateParentCaptionDropdowns(selectedTable);

            // ▼▼▼ LOGIK BAHARU YANG LEBIH PINTAR ▼▼▼
            if (selectedTable && jsonData.database.table[selectedTable]) {
                const parentFields = jsonData.database.table[selectedTable].fields;
                const fieldNames = Object.keys(parentFields);
                const integerTypes = ['TINYINT', 'SMALLINT', 'MEDIUMINT', 'INT', 'BIGINT'];

                let defaultCaptionField = null;

                // 1. Cuba cari medan BUKAN integer yang pertama
                const firstNonIntegerField = fieldNames.find(name => 
                    !integerTypes.includes(parentFields[name].data_type.toUpperCase())
                );

                if (firstNonIntegerField) {
                    defaultCaptionField = firstNonIntegerField;
                } else if (fieldNames.length > 1) {
                    // 2. Jika tiada, kembali kepada logik lama (pilih medan kedua)
                    defaultCaptionField = fieldNames[1];
                }

                // Tetapkan nilai dropdown jika medan lalai ditemui
                if (defaultCaptionField) {
                    caption1Select.value = defaultCaptionField;
                }
            }
            // ▲▲▲ TAMAT LOGIK BAHARU ▲▲▲
        });
    }
}

export function populateMenuManagement(menuGroupsData) {
    const menuGroupList = document.querySelector('.menu-group-list');
    if (!menuGroupList) return;

    // Kosongkan senarai sedia ada
    menuGroupList.innerHTML = '';

    if (!menuGroupsData || menuGroupsData.length === 0) {
        // Jika tiada data, paparkan mesej
        const emptyMessage = `
            <div class="empty-state-label">
                <p>Tiada kumpulan menu dicipta.</p>
                <span>Klik butang 'Add Menu Group' untuk bermula.</span>
            </div>
        `;
        menuGroupList.innerHTML = emptyMessage;
        return;
    }

    // Bina setiap baris kumpulan menu
    menuGroupsData.forEach(group => {
        const tagsHtml = group.items.map(item => `
            <span class="tag" draggable="true" data-item-id="${item.item_id}">
                ${item.table_name} <button class="remove-tag">&times;</button>
            </span>
        `).join('');

        const groupElement = document.createElement('div');
        groupElement.className = 'menu-group-item';
        groupElement.setAttribute('draggable', 'true');
        groupElement.dataset.groupId = group.menu_group_id;
        
        groupElement.innerHTML = `
            <i class="fas fa-grip-vertical drag-handle"></i>
            <input type="text" class="group-name-input" value="${group.group_name}">
            <div class="menu-selector">
                ${tagsHtml}
                <button class="add-menu-btn" title="Add menu to this group">+</button>
            </div>
            <div class="group-actions">
                <button class="btn-sidebar-icon" title="Delete group">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        `;
        menuGroupList.appendChild(groupElement);
    });
}

// js/uiHandlers.js

// Fungsi bantuan untuk menjana query lalai
function generateDefaultLookupQuery() {
    const parentTable = document.getElementById('fld-lookup-parent-table').value;
    const caption1 = document.getElementById('fld-lookup-caption-1').value;
    const caption2 = document.getElementById('fld-lookup-caption-2').value;
    const separator = document.getElementById('fld-lookup-separator').value;

    if (!parentTable || !caption1) return '';

    let captionFields = `\`${parentTable}\`.\`${caption1}\``;
    if (caption2 && separator) {
        captionFields = `CONCAT(${captionFields}, '${separator}', \`${parentTable}\`.\`${caption2}\`)`;
    }

    // Dapatkan Primary Key dari jadual induk
    const parentTableData = jsonData.database.table[parentTable];
    const pkField = Object.keys(parentTableData.fields).find(f => parentTableData.fields[f].primary_key) || 'id';

    return `SELECT \`${parentTable}\`.\`${pkField}\`, ${captionFields} FROM \`${parentTable}\` ORDER BY 2`;
}

export function initializeAdvancedLookupHandlers() {
    const modal = document.getElementById('advanced-lookup-modal');
    const openBtn = document.getElementById('fld-lookup-advanced-btn');
    const closeBtn = document.getElementById('advanced-lookup-modal-close');
    const okBtn = document.getElementById('advanced-lookup-ok-btn');
    const cancelBtn = document.getElementById('advanced-lookup-cancel-btn');
    const resetBtn = document.getElementById('advanced-lookup-reset-btn');
    const queryTextarea = document.getElementById('fld-lookup-custom-query');
    const hiddenQueryInput = document.getElementById('fld-lookup-custom-query-hidden');

    const openModal = () => {
        let currentQuery = hiddenQueryInput.value;
        if (!currentQuery) {
            currentQuery = generateDefaultLookupQuery();
        }
        queryTextarea.value = currentQuery;
        modal.classList.remove('hidden');
    };

    const closeModal = () => modal.classList.add('hidden');

    const saveAndClose = () => {
        hiddenQueryInput.value = queryTextarea.value;
        closeModal();
    };

    openBtn.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    okBtn.addEventListener('click', saveAndClose);
    resetBtn.addEventListener('click', () => {
        queryTextarea.value = generateDefaultLookupQuery();
    });
}

export function initializeHomepageMenuHandlers() {
    const menuAtHomepageCheckbox = document.getElementById('app-menu_at_homepage');
    const dependentOptions = document.querySelectorAll('.homepage-menu-option');

    if (!menuAtHomepageCheckbox || dependentOptions.length === 0) return;

    const toggleOptionsVisibility = () => {
        const isChecked = menuAtHomepageCheckbox.checked;
        dependentOptions.forEach(option => {
            // Gunakan style.display untuk kawalan terus
            option.style.display = isChecked ? '' : 'none';
        });
    };

    // Tambah listener pada checkbox
    menuAtHomepageCheckbox.addEventListener('change', toggleOptionsVisibility);

    // Panggil sekali semasa muat untuk menetapkan keadaan awal yang betul
    toggleOptionsVisibility();
}

// js/uiHandlers.js

// Fungsi ini akan dipanggil dari populateFieldSettings juga, jadi kita letakkan di luar
function applyDataTypeRules() {
    const dataTypeSelect = document.getElementById('fld-data-type');
    if (!dataTypeSelect) return;

    const selectedType = dataTypeSelect.value;

    // Kumpulkan semua elemen yang akan dikawal
    const elements = {
		length: document.getElementById('fld-length'),
        precision: document.getElementById('fld-precision'),
        autoIncrement: document.getElementById('fld-auto-increment'),
        unsigned: document.getElementById('fld-unsigned'),
        zeroFill: document.getElementById('fld-zero-fill'),
        showSum: document.getElementById('fld-show-sum'),
        binary: document.getElementById('fld-binary'),
        mediaRadios: document.querySelectorAll('input[name="fld-media-type"]'),
        behaviorOptions: document.querySelectorAll('#fld-media-link-behavior option[value="web_link"], #fld-media-link-behavior option[value="email_link"]'),
		dbPropertiesFieldset: document.querySelector('#tab-field-general .fieldset-grid fieldset:nth-child(1)'),
        formBehaviorFieldset: document.querySelector('#tab-field-general .fieldset-grid fieldset:nth-child(2)'),
        defaultValue: document.getElementById('fld-default-value') // Tambah elemen Default Value
    };

    // 1. Reset: Aktifkan semua elemen secara lalai
    Object.values(elements).forEach(el => {
        if (el && el.forEach) {
            el.forEach(item => { item.disabled = false; item.hidden = false; });
        } else if (el) {
            el.disabled = false;
        }
    });
    elements.dbPropertiesFieldset.classList.remove('fieldset-disabled');
    elements.formBehaviorFieldset.classList.remove('fieldset-disabled');
	
    // ▼▼▼ MULA LOGIK TAMBAHAN ▼▼▼
    // Peraturan 1: Nyahaktifkan 'Length' untuk jenis data tertentu
    const typesWithoutLength = ['TEXT', 'TINYTEXT', 'MEDIUMTEXT', 'LONGTEXT', 'DATE', 'DATETIME', 'TIMESTAMP', 'TIME', 'BLOB', 'TINYBLOB', 'MEDIUMBLOB', 'LONGBLOB'];
    if (typesWithoutLength.includes(selectedType.toUpperCase())) {
        if (elements.length) {
            elements.length.disabled = true;
            elements.length.value = ''; // Kosongkan nilai jika ada
        }
    }

    // Peraturan 2: Nyahaktifkan 'Default Value' jika 'Auto Increment' aktif
    if (elements.autoIncrement && elements.defaultValue) {
        if (elements.autoIncrement.checked) {
            elements.defaultValue.disabled = true;
            elements.defaultValue.value = ''; // Kosongkan nilai jika ada
        }
    }
    // ▲▲▲ TAMAT LOGIK TAMBAHAN ▲▲▲
	
    // 2. Kumpulan Data Type
    const numericAndDate = ['TINYINT', 'SMALLINT', 'MEDIUMINT', 'INT', 'BIGINT', 'FLOAT', 'DOUBLE', 'DECIMAL', 'DATE', 'DATETIME', 'TIMESTAMP', 'TIME', 'YEAR'];
    const integerOnly = ['TINYINT', 'SMALLINT', 'MEDIUMINT', 'INT', 'BIGINT'];
    const floatOnly = ['FLOAT', 'DOUBLE', 'DECIMAL'];
    const dateOnly = ['DATE', 'DATETIME', 'TIMESTAMP', 'TIME', 'YEAR'];
    const binaryString = ['CHAR', 'VARCHAR', 'TINYBLOB', 'BLOB', 'MEDIUMBLOB', 'LONGBLOB'];
    const textOnly = ['TINYTEXT', 'TEXT', 'MEDIUMTEXT', 'LONGTEXT'];

    // 3. Laksanakan Peraturan
    if (numericAndDate.includes(selectedType)) {
        elements.mediaRadios.forEach(radio => { if (radio.value !== 'link') radio.disabled = true; });
        elements.behaviorOptions.forEach(opt => opt.hidden = true);
    }
    if (integerOnly.includes(selectedType)) {
        if (elements.binary) elements.binary.disabled = true;
        if (elements.precision) elements.precision.disabled = true;
    }
    if (floatOnly.includes(selectedType)) {
        if (elements.binary) elements.binary.disabled = true;
        if (elements.autoIncrement) elements.autoIncrement.disabled = true;
        if (elements.precision) elements.precision.disabled = false; // Pastikan ia enabled
    }
    if (dateOnly.includes(selectedType)) {
        if (elements.autoIncrement) elements.autoIncrement.disabled = true;
        if (elements.unsigned) elements.unsigned.disabled = true;
        if (elements.zeroFill) elements.zeroFill.disabled = true;
        if (elements.showSum) elements.showSum.disabled = true;
        if (elements.binary) elements.binary.disabled = true;
        if (elements.precision) elements.precision.disabled = true;
    }
    if (binaryString.includes(selectedType) || textOnly.includes(selectedType)) {
        if (elements.autoIncrement) elements.autoIncrement.disabled = true;
        if (elements.unsigned) elements.unsigned.disabled = true;
        if (elements.zeroFill) elements.zeroFill.disabled = true;
        if (elements.showSum) elements.showSum.disabled = true;
        if (elements.precision) elements.precision.disabled = true;
    }
     if (binaryString.includes(selectedType)) {
         if (elements.binary) elements.binary.disabled = true;
     }
	 
    if (selectedType === 'VARCHAR') {
        if (!elements.length.value) elements.length.value = 255;
    }
    if (selectedType === 'INT') {
        elements.unsigned.checked = true;
    }
    if (selectedType === 'DECIMAL') {
        if (!elements.length.value) elements.length.value = 10;
        if (!elements.precision.value) elements.precision.value = 2;
    }
	
    // Logik untuk menyahaktifkan fieldset
    if (textOnly.includes(selectedType) || binaryString.includes(selectedType)) {
        if(selectedType !== 'CHAR' && selectedType !== 'VARCHAR') {
             elements.dbPropertiesFieldset.classList.add('fieldset-disabled');
        }
    }
	
    const multiSelectRadio = document.querySelector('input[name="fld-options-display"][value="multi"]');
    const dropdownRadio = document.querySelector('input[name="fld-options-display"][value="dropdown"]');

    // Semak jika 'Multiple-choice' sedang dipilih
    if (multiSelectRadio && multiSelectRadio.checked) {
        const selectedType = document.getElementById('fld-data-type').value.toUpperCase();
        const allowedTypes = ['TEXT', 'BLOB'];
        const isAllowed = allowedTypes.some(type => selectedType.includes(type));

        // Jika Data Type yang baru dipilih tidak serasi
        if (!isAllowed) {
            // Tukar pilihan kembali kepada default (Drop-down list)
            dropdownRadio.checked = true;
        }
    }
}

export function initializeDataTypeRules() {
    const dataTypeSelect = document.getElementById('fld-data-type');
    if (!dataTypeSelect) return;

    let previousDataType = ''; // Pembolehubah untuk simpan nilai sebelumnya

    dataTypeSelect.addEventListener('focus', () => {
        // Simpan nilai semasa setiap kali dropdown difokuskan
        previousDataType = dataTypeSelect.value;
    });

    dataTypeSelect.addEventListener('change', () => {
        const autoIncrementCheckbox = document.getElementById('fld-auto-increment');
        
        // Semak jika Auto Increment aktif
        if (autoIncrementCheckbox && autoIncrementCheckbox.checked) {
            const newDataType = dataTypeSelect.value.toUpperCase();
            const integerTypes = ['TINYINT', 'SMALLINT', 'MEDIUMINT', 'INT', 'BIGINT'];

            // Jika jenis data baharu BUKAN jenis integer
            if (!integerTypes.includes(newDataType)) {
                showCustomDialog({
                    title: "Validation Rule",
                    message: "An 'Auto Increment' field must have an Integer data type (e.g., INT, BIGINT)."
                });
                // Kembalikan kepada nilai sebelumnya
                dataTypeSelect.value = previousDataType;
                return; // Hentikan proses
            }
        }
        
        // Jika lulus pengesahan, jalankan peraturan sedia ada
        applyDataTypeRules();
    });
}

// js/uiHandlers.js

function populateRecordOwnerDropdown(tableName) {
    const recordOwnerDropdown = document.getElementById('tbl-record-owner');
    if (!recordOwnerDropdown || !jsonData) return;

    // Kosongkan opsyen sedia ada
    recordOwnerDropdown.innerHTML = '';

    // 1. Tambah opsyen lalai
    const defaultOption = document.createElement('option');
    defaultOption.value = ''; // Nilai kosong untuk 'Current user'
    defaultOption.textContent = 'Current user (default)';
    recordOwnerDropdown.appendChild(defaultOption);

    // ▼▼▼ LOGIK YANG DIPERBAIKI ▼▼▼
    // 2. Cari dan tambah semua medan kunci asing (foreign key) berdasarkan data hubungan
    const relationships = jsonData.database.relationships || [];
    
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

// js/uiHandlers.js

export function initializeFormDisplayRules() {
    const dataTypeSelect = document.getElementById('fld-data-type');

    // --- Bahagian 1: Logik Checkbox Eksklusif ---
    const exclusiveCheckboxIds = ['fld-text-area', 'fld-rich-html', 'fld-check-box'];
    const checkboxElements = exclusiveCheckboxIds.map(id => document.getElementById(id));

    checkboxElements.forEach(checkbox => {
        if (!checkbox) return;
        checkbox.addEventListener('change', (event) => {
            const currentCheckbox = event.target;
            if (currentCheckbox.checked) {
                checkboxElements.forEach(otherCheckbox => {
                    if (otherCheckbox !== currentCheckbox) {
                        otherCheckbox.checked = false;
                    }
                });
            }
        });
    });

    // --- Bahagian 2: Logik Amaran untuk Data Type ---
    const richHtmlCheckbox = document.getElementById('fld-rich-html');
    const textAreaCheckbox = document.getElementById('fld-text-area');

    // Fungsi bantuan untuk menyemak keserasian dengan jenis data TEXT
    const checkTextCompatibility = (checkbox, warningMessage) => {
        if (!checkbox || !dataTypeSelect) return;

        checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
                const currentDataType = dataTypeSelect.value.toUpperCase();
                const suitableTypes = ['TEXT', 'TINYTEXT', 'MEDIUMTEXT', 'LONGTEXT'];

                if (!suitableTypes.includes(currentDataType)) {
                    showCustomDialog({ title: "Warning!", message: warningMessage });
                }
            }
        });
    };

    // Laksanakan semakan untuk kedua-dua checkbox
    checkTextCompatibility(
        richHtmlCheckbox,
        "To enable this field to behave as a rich (HTML) box, you should change its data type to 'TEXT', 'MEDIUMTEXT' or 'LONGTEXT'."
    );

    checkTextCompatibility(
        textAreaCheckbox,
        "This field can only be set as a Text area if its data type is one of the 'TEXT' family data types."
    );
}

export function initializeRealtimeValidation() {
    const numericInputs = [
        document.getElementById('fld-length'),
        document.getElementById('fld-precision')
    ];

    numericInputs.forEach(input => {
        if (input) {
            input.addEventListener('input', () => {
                // Buang semua aksara yang bukan nombor
                input.value = input.value.replace(/[^0-9]/g, '');
            });
        }
    });

    // 1. Dapatkan elemen input untuk nama jadual dan medan
    const tableNameInput = document.getElementById('tbl-table-name');
    const fieldNameInput = document.getElementById('fld-field-name');

    // 2. Cipta fungsi bantuan untuk memasang logik validasi
    const setupNameValidation = (inputElement) => {
        if (!inputElement) return;

        let previousValidValue = '';

        // Simpan nilai sah terakhir apabila input difokuskan
        inputElement.addEventListener('focus', () => {
            previousValidValue = inputElement.value;
        });

        // Tapis aksara pada setiap ketikan
        inputElement.addEventListener('input', () => {
            // Hanya benarkan abjad dan garis bawah
            inputElement.value = inputElement.value.replace(/[^a-zA-Z_]/g, '');
        });

        // Semak jika kosong apabila pengguna meninggalkan input
        inputElement.addEventListener('blur', () => {
            if (inputElement.value.trim() === '') {
                // Kembalikan ke nilai sah sebelumnya jika kosong
                inputElement.value = previousValidValue;
            }
        });
    };

    // 3. Pasang validasi pada kedua-dua input
    setupNameValidation(tableNameInput);
    setupNameValidation(fieldNameInput);
}

export function initializeOptionsListRules() {
    const multiSelectRadio = document.querySelector('input[name="fld-options-display"][value="multi"]');
    const dropdownRadio = document.querySelector('input[name="fld-options-display"][value="dropdown"]');
    const dataTypeSelect = document.getElementById('fld-data-type');

    if (!multiSelectRadio || !dataTypeSelect || !dropdownRadio) return;

    multiSelectRadio.addEventListener('click', (event) => {
        const currentDataType = dataTypeSelect.value.toUpperCase();
        
        // Senarai jenis data yang dibenarkan (keluarga TEXT dan BLOB)
        const allowedTypes = ['TEXT', 'BLOB'];

        // Semak jika jenis data semasa adalah salah satu dari yang dibenarkan
        const isAllowed = allowedTypes.some(type => currentDataType.includes(type));
        if (!isAllowed) {
            event.preventDefault();
            const message = "Multiple-selection list box can only work with Text or Blob data types.\n\n" +
                          "Please change the data type of the field first.";
            showCustomDialog({ title: "Warning!", message: message });
            dropdownRadio.checked = true;
        }
    });
}

export function initializeCalculatedFieldRules() {
    const enableCheckbox = document.getElementById('fld-calculated-enable');
    const queryTextarea = document.getElementById('fld-calculated-query');

    if (!enableCheckbox || !queryTextarea) return;

    const validateConditions = () => {
        const getEl = (id) => document.getElementById(id);
        const getValue = (id) => getEl(id)?.value;
        const isChecked = (id) => getEl(id)?.checked;
        const errors = [];

        if (!isChecked('fld-read-only')) errors.push("Field must be set as 'Read Only'.");
        if (isChecked('fld-primary-key')) errors.push("Field cannot be a 'Primary Key'.");
        if (isChecked('fld-required')) errors.push("Field cannot be 'Required'.");
        if (isChecked('fld-text-area') || isChecked('fld-rich-html')) errors.push("Field cannot be a 'Text area' or 'Rich (HTML) area'.");
        if (isChecked('fld-auto-increment')) errors.push("Field cannot be 'Auto Increment'.");
        if (isChecked('fld-unique')) errors.push("Field cannot be 'Unique'.");
        const mediaLinkBehavior = getValue('fld-media-link-behavior');
        if (mediaLinkBehavior === 'web_link' || mediaLinkBehavior === 'email_link') errors.push("Field cannot be a 'Web/email link'.");
        const mediaType = document.querySelector('input[name="fld-media-type"]:checked')?.value;
        if (['image', 'upload'].includes(mediaType)) errors.push("Field cannot be an 'Image/file upload' type.");
        if (['gmap', 'youtube'].includes(mediaType)) errors.push("Field cannot be a 'Map/video' type.");
        if (getValue('fld-lookup-parent-table')) errors.push("Field cannot be a 'Lookup field'.");
        if (getValue('fld-options-list-values')) errors.push("Field cannot be an 'Options list' field.");
        if (getValue('fld-format-as') !== 'default') errors.push("Field cannot have a 'Data format' specified.");
        if (getValue('fld-default-value')) errors.push("Field cannot have a 'Default value'.");

        return errors;
    };

    enableCheckbox.addEventListener('click', (event) => {
        if (enableCheckbox.checked) {
            const validationErrors = validateConditions();
            if (validationErrors.length > 0) {
                event.preventDefault();
                let alertMessage = "This field cannot be set as a calculated field for the following reasons:\n\n";
                validationErrors.forEach(error => {
                    alertMessage += `- ${error}\n`;
                });
                showCustomDialog({ title: "Validation Error", message: alertMessage });
                enableCheckbox.checked = false;
            }
        }
    });

    const checkAndDisableCalculatedField = () => {
        if (!enableCheckbox.checked) return;
        const validationErrors = validateConditions();
        if (validationErrors.length > 0) {
            showCustomDialog({
                title: "Validation Rule",
                message: "Calculated field has been disabled for the following reason:\n\n" +
                         `- ${validationErrors[0]}`
            });
            enableCheckbox.checked = false;
        }
    };

    const conflictingElementIds = [
        'fld-read-only', 'fld-primary-key', 'fld-required', 'fld-text-area',
        'fld-rich-html', 'fld-auto-increment', 'fld-unique',
        'fld-media-link-behavior', 'fld-lookup-parent-table',
        'fld-options-list-values', 'fld-format-as', 'fld-default-value',
        'fld-media-image', 'fld-media-upload', 'fld-media-gmap', 'fld-media-youtube'
    ];

    conflictingElementIds.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', checkAndDisableCalculatedField);
        }
    });
    // Pastikan textarea sentiasa aktif (enabled) dari mula
    //queryTextarea.disabled = false;
}

export function initializeDatabasePropertiesHandlers() {
    const primaryKeyCheckbox = document.getElementById('fld-primary-key');
    const autoIncrementCheckbox = document.getElementById('fld-auto-increment');
    const requiredCheckbox = document.getElementById('fld-required');
    const readOnlyCheckbox = document.getElementById('fld-read-only');

    if (!primaryKeyCheckbox || !autoIncrementCheckbox || !requiredCheckbox || !readOnlyCheckbox) return;

    // --- Listener untuk Auto Increment ---
    autoIncrementCheckbox.addEventListener('change', () => {
        if (autoIncrementCheckbox.checked) {
            // Logik apabila MENANDA 'Auto Increment'
            if (!primaryKeyCheckbox.checked) {
                showCustomDialog({
                    title: "Validation Rule",
                    message: "'Auto Increment' can only be enabled for a 'Primary Key' field."
                });
                autoIncrementCheckbox.checked = false;
                return;
            }
            requiredCheckbox.checked = false;
            readOnlyCheckbox.checked = true;
        } else {
            // Logik apabila MENYAH-TANDA 'Auto Increment'
            const message = "Warning: Disabling Auto Increment on a key field requires you to manage unique values manually, which can lead to data errors.\n\nAre you sure you want to disable it?";
            showCustomDialog({
                title: "Warning!",
                message: message,
                showCancelButton: true,
                onCancel: () => {
                    autoIncrementCheckbox.checked = true; // Tandakan semula jika batal
                }
            });
        }
    });

    // --- Listener untuk Primary Key (Hanya untuk menyah-tanda) ---
    primaryKeyCheckbox.addEventListener('change', () => {
        if (!primaryKeyCheckbox.checked) {
            const message = "Warning: Changing a Primary Key can affect table relationships and data integrity.\n\nAre you sure you want to proceed?";
            showCustomDialog({
                title: "Warning!",
                message: message,
                showCancelButton: true,
                onCancel: () => {
                    primaryKeyCheckbox.checked = true;
                }
            });
        }
    });
    
    // --- Listener untuk Required (Tidak berubah) ---
    requiredCheckbox.addEventListener('change', () => {
        if (requiredCheckbox.checked && autoIncrementCheckbox.checked) {
            let message = "Changing this option will disable 'Auto Increment'.\n\n- Auto Increment: The value is provided automatically by the database.\n- Required: The value must be provided manually by the user.\n\n";
            const isPrimaryKey = primaryKeyCheckbox.checked;
            if (isPrimaryKey) {
                message += "Recommendation: A Primary Key field should remain 'Auto Increment'.\n\n";
            }
            message += "Are you sure you want to switch to 'Required'?";
            showCustomDialog({
                title: "Confirmation", message: message, showCancelButton: true,
                onOk: () => { autoIncrementCheckbox.checked = false; },
                onCancel: () => { requiredCheckbox.checked = false; }
            });
        }
    });

    // --- Listener untuk Read Only (Tidak berubah) ---
    readOnlyCheckbox.addEventListener('change', () => {
        if (!readOnlyCheckbox.checked && autoIncrementCheckbox.checked) {
            readOnlyCheckbox.checked = true;
            showCustomDialog({
                title: "Validation Rule",
                message: "A field with 'Auto Increment' must remain 'Read Only'."
            });
        }
    });
}