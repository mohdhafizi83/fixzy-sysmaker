// src/js/handlers/menuHandlers.js

import { appState } from '../state.js';
import { SaveManager } from '../saveManager.js';
import { showCustomDialog } from '../ui/modalHandlers.js';
import { resolveVariables } from '../utils.js';
import { loadProjectData } from '../../renderer.js';

export function populateMenuManagement(unifiedMenu) {
    const unifiedMenuList = document.getElementById('unified-menu-list');
    if (!unifiedMenu || unifiedMenu.length === 0) {
        unifiedMenuList.innerHTML = `<div class="empty-state-label"><p>No menus or groups created.</p><span>Click a button above to start.</span></div>`;
        return;
    }

    const createGroupElement = (group) => {
        const groupEl = document.createElement('div');
        groupEl.className = 'menu-group-item';
        groupEl.dataset.type = 'group';
        groupEl.dataset.groupId = group.id;

        const itemsHtml = group.items.map(item => {
            const itemType = item.table_id ? 'table_item' : (item.module_id ? 'custom_view_item' : 'custom_item');
            const icon = itemType === 'table_item' ? 'fa-table' : (itemType === 'custom_view_item' ? 'fa-eye' : 'fa-link');
            const tableNameAttribute = itemType === 'table_item' ? `data-table-name="${item.table_name}"` : '';

            return `
            <div class="nested-menu-item" 
                 data-item-id="${item.item_id}" 
                 data-label="${item.item_label || ''}" 
                 data-url="${item.item_detail || ''}"
                 data-type="${itemType}"
                 ${tableNameAttribute}>
                <i class="fas ${icon} nested-item-icon"></i>
                <span class="nested-item-label" title="${item.item_label}">${item.item_label}</span>
                <span class="nested-item-url" title="URL: ${item.item_detail || 'N/A'}">${item.item_detail || '(Not a link)'}</span>
                <div class="nested-item-actions">
                    <button class="btn-sidebar-icon nested-menu-move-up-btn" title="Move Up"><i class="fas fa-arrow-up"></i></button>
                    <button class="btn-sidebar-icon nested-menu-move-down-btn" title="Move Down"><i class="fas fa-arrow-down"></i></button>
                    <button class="btn-sidebar-icon nested-menu-edit-btn" title="Edit Item"><i class="fas fa-pencil-alt"></i></button>
                    <button class="btn-sidebar-icon nested-menu-delete-btn" title="Delete Item"><i class="fas fa-trash-alt"></i></button>
                </div>
            </div>`;
        }).join('');

        groupEl.innerHTML = `
            <div class="menu-group-header">
                <input type="text" class="group-name-input" value="${group.name}">
                <div class="group-actions">
                    <button class="btn-sidebar-icon menu-move-up-btn" title="Move Up"><i class="fas fa-arrow-up"></i></button>
                    <button class="btn-sidebar-icon menu-move-down-btn" title="Move Down"><i class="fas fa-arrow-down"></i></button>
                    <button class="btn-sidebar-icon group-delete-btn" title="Delete group"><i class="fas fa-trash-alt"></i></button>
                </div>
            </div>
            <div class="menu-selector">${itemsHtml}</div>`;
        return groupEl;
    };

const createItemElement = (item) => {
        const itemEl = document.createElement('div');
        itemEl.className = 'custom-menu-item';
        
        // ▼▼▼ LOGIC IMPROVEMENT: Determine the menu type from the database ▼▼▼
        const computedType = item.table_id ? 'table_item' : (item.module_id ? 'custom_view_item' : 'custom_item');
        
        itemEl.dataset.type = computedType;
        itemEl.dataset.itemId = item.item_id;
        itemEl.dataset.label = item.item_label;
        itemEl.dataset.url = item.item_detail || '';

        // Store the table name if it's a table or custom module
        if (computedType === 'table_item' || computedType === 'custom_view_item') {
            itemEl.dataset.tableName = item.table_name || '';
        }

        // Determine the correct icon
        const icon = computedType === 'table_item' ? 'fa-table' : (computedType === 'custom_view_item' ? 'fa-eye' : 'fa-link');
        // ▲▲▲ END IMPROVEMENT ▲▲▲
        
        itemEl.innerHTML = `
            <i class="fas ${icon}" style="margin: 0 0.5rem; color: var(--secondary-color);"></i>
            <div class="form-group" style="flex: 1;">
                <input type="text" readonly value="${item.item_label}" title="Label: ${item.item_label}">
            </div>
            <div class="form-group" style="flex: 2;">
                <input type="text" readonly value="${item.item_detail || '(Not a link)'}" title="URL: ${item.item_detail || 'N/A'}">
            </div>
            <div class="group-actions">
                <button class="btn-sidebar-icon menu-move-up-btn" title="Move Up"><i class="fas fa-arrow-up"></i></button>
                <button class="btn-sidebar-icon menu-move-down-btn" title="Move Down"><i class="fas fa-arrow-down"></i></button>
                <button class="btn-sidebar-icon custom-menu-edit-btn" title="Edit Item"><i class="fas fa-pencil-alt"></i></button>
                <button class="btn-sidebar-icon custom-menu-delete-btn" title="Delete Item"><i class="fas fa-trash-alt"></i></button>
            </div>
        `;
        return itemEl;
    };
    
    unifiedMenuList.innerHTML = ''; 

    unifiedMenu.forEach(item => {
        if (item.type === 'group') {
            const groupEl = createGroupElement(item);
            unifiedMenuList.appendChild(groupEl);
            updateNestedMoveButtonStates(groupEl.querySelector('.menu-selector'));
        } else {
            unifiedMenuList.appendChild(createItemElement(item));
        }
    });

    const menuItems = unifiedMenuList.children;
    if (menuItems.length > 0) {
        if (menuItems[0].querySelector('.menu-move-up-btn')) {
            menuItems[0].querySelector('.menu-move-up-btn').disabled = true;
        }
        if (menuItems[menuItems.length - 1].querySelector('.menu-move-down-btn')) {
            menuItems[menuItems.length - 1].querySelector('.menu-move-down-btn').disabled = true;
        }
    }
}

export function initializeMenuManagementHandlers() {
    const menuManagementTab = document.getElementById('tab-menu-appearance');
    if (!menuManagementTab) return;

    // References to the UI elements
    const addGroupBtn = document.getElementById('app-add_menu_group');
    const addCustomMenuBtn = document.getElementById('app-add_custom_menu');
    const unifiedMenuList = document.getElementById('unified-menu-list');

function openCustomMenuModal(itemEl = null) {
    const modal = document.getElementById('custom-menu-modal');
    if (!modal) return;

    const modalBody = modal.querySelector('.modal-body');
    modalBody.innerHTML = `
        <div id="menu-type-selector" class="form-group">
            <label>Menu Type</label>
            <div class="radio-group-horizontal" style="margin-top: 0.5rem;">
                <label class="checkbox-label"><input type="radio" name="menu-item-type" value="custom" checked> Custom Menu</label>
                <label class="checkbox-label"><input type="radio" name="menu-item-type" value="table"> Table Menu</label>
                <label class="checkbox-label"><input type="radio" name="menu-item-type" value="custom_view"> Custom Module Menu</label>
            </div>
        </div>
        <div id="custom-menu-fields-container">
            <div class="form-group"><label for="custom-menu-label-input">Menu Label</label><input type="text" id="custom-menu-label-input" placeholder="e.g., Customer Support"></div>
            <div class="form-group"><label for="custom-menu-url-input">URL</label><input type="text" id="custom-menu-url-input" placeholder="e.g., support.php"></div>
        </div>
        <div id="table-menu-fields-container" class="hidden">
            <div class="form-group"><label for="table-menu-label-input">Menu Label</label><input type="text" id="table-menu-label-input" placeholder="Enter menu label"></div>
            <div class="form-group"><label>Available Tables</label><ul id="modal-available-tables-list" class="item-list" style="max-height: 150px; overflow-y: auto; margin-top: 0.5rem;"></ul></div>
        </div>
        <div id="custom-module-menu-fields-container" class="hidden">
            <div class="form-group"><label for="cv-menu-label-input">Menu Label</label><input type="text" id="cv-menu-label-input" placeholder="Enter menu label"></div>
            <div class="form-group"><label>Available Custom Modules</label><ul id="modal-available-cv-list" class="item-list" style="max-height: 150px; overflow-y: auto; margin-top: 0.5rem;"></ul></div>
        </div>
        <div class="form-group shared-menu-options"><label class="checkbox-label"><input type="checkbox" id="menu-show-record-count"> Show record count in homepage</label></div>
        <div class="form-group"><label for="custom-menu-group-select">Parent Group</label><select id="custom-menu-group-select"></select></div>
        <input type="hidden" id="custom-menu-item-id">
    `;

    const elements = {
        title: modal.querySelector('#custom-menu-modal-title'), okBtn: modal.querySelector('#custom-menu-modal-ok'),
        cancelBtn: modal.querySelector('#custom-menu-modal-cancel'), closeBtn: modal.querySelector('#custom-menu-modal-close'),
        itemIdInput: modal.querySelector('#custom-menu-item-id'), groupSelect: modal.querySelector('#custom-menu-group-select'),
        recordCountCheckbox: modal.querySelector('#menu-show-record-count'), sharedOptions: modal.querySelector('.shared-menu-options'),
        radios: modal.querySelectorAll('input[name="menu-item-type"]'),
        customFieldsContainer: modal.querySelector('#custom-menu-fields-container'), labelInput: modal.querySelector('#custom-menu-label-input'),
        urlInput: modal.querySelector('#custom-menu-url-input'), tableFieldsContainer: modal.querySelector('#table-menu-fields-container'),
        tableLabelInput: modal.querySelector('#table-menu-label-input'), tableListUl: modal.querySelector('#modal-available-tables-list'),
        cvFieldsContainer: modal.querySelector('#custom-module-menu-fields-container'), cvLabelInput: modal.querySelector('#cv-menu-label-input'),
        cvListUl: modal.querySelector('#modal-available-cv-list'),
    };

    const newOkBtn = elements.okBtn.cloneNode(true);
    elements.okBtn.parentNode.replaceChild(newOkBtn, elements.okBtn);
    const closeModal = () => modal.classList.add('hidden');
    elements.cancelBtn.addEventListener('click', closeModal, { once: true });
    elements.closeBtn.addEventListener('click', closeModal, { once: true });

    elements.radios.forEach(radio => {
        radio.addEventListener('change', () => {
            const selectedType = radio.value;
            elements.customFieldsContainer.classList.toggle('hidden', selectedType !== 'custom');
            elements.tableFieldsContainer.classList.toggle('hidden', selectedType !== 'table');
            elements.cvFieldsContainer.classList.toggle('hidden', selectedType !== 'custom_view');
            elements.sharedOptions.classList.toggle('hidden', selectedType === 'custom');
        });
    });

    const getUsedIds = () => {
        const ids = { tableIds: new Set(), cvIds: new Set() };
        appState.jsonData.database.unified_menu.forEach(item => {
            const items = item.type === 'group' ? item.items : [item];
            items.forEach(i => {
                if (i.table_id) ids.tableIds.add(i.table_id);
                if (i.module_id) ids.cvIds.add(i.module_id);
            });
        });
        return ids;
    };
    const { tableIds: usedTableIds, cvIds: usedCvIds } = getUsedIds();

    const availableTables = Object.values(appState.jsonData.database.table).filter(t => !usedTableIds.has(t.table_id));
    elements.tableListUl.innerHTML = availableTables.length > 0 ? availableTables.filter(t => t && t.table_name).map(t => `<li data-table-name="${t.table_name}">${t.table_name}</li>`).join('') : '<li>No unassigned tables available.</li>';

    const availableCustomViews = [];
    Object.values(appState.jsonData.database.table).forEach(table => {
        (table.custom_modules || []).forEach(view => {
            if (!usedCvIds.has(view.module_id)) {
                availableCustomViews.push({ ...view, table_name: table.table_name });
            }
        });
    });
    elements.cvListUl.innerHTML = availableCustomViews.length > 0 ? availableCustomViews.map(v => `<li data-cv-id="${v.module_id}">${v.table_name} - ${v.module_name}</li>`).join('') : '<li>No unassigned Custom Modules available.</li>';
    
    const allCustomViews = [];
    Object.values(appState.jsonData.database.table).forEach(table => {
        (table.custom_modules || []).forEach(view => {
            allCustomViews.push({ ...view, table_name: table.table_name });
        });
    });

    elements.groupSelect.innerHTML = '<option value="">None (Top Level)</option>';
    appState.jsonData.database.unified_menu.filter(item => item.type === 'group').forEach(group => { elements.groupSelect.innerHTML += `<option value="${group.id}">${group.name}</option>`; });

    if (itemEl) {
        elements.title.textContent = 'Edit Menu Item';
        elements.itemIdInput.value = itemEl.dataset.itemId;
        elements.radios.forEach(radio => radio.disabled = true);
        const itemType = itemEl.dataset.type;
        const allItems = [...appState.jsonData.database.unified_menu.flatMap(i => i.type === 'group' ? i.items : i)];
        
        // ▼▼▼ FULLY FIXED SEARCH CODE ▼▼▼
        const itemIdToFind = parseInt(itemEl.dataset.itemId, 10);
        const itemData = allItems.find(i => (i.item_id || i.id) === itemIdToFind);
        // ▲▲▲ END IMPROVEMENT ▲▲▲

        const radioValueMap = { 'custom_item': 'custom', 'table_item': 'table', 'custom_view_item': 'custom_view' };
        const radioToSelect = document.querySelector(`input[name="menu-item-type"][value="${radioValueMap[itemType]}"]`);
        if (radioToSelect) { radioToSelect.checked = true; radioToSelect.dispatchEvent(new Event('change')); }
        if (itemType === 'table_item') {
            elements.tableLabelInput.value = itemEl.dataset.label;
            elements.tableListUl.innerHTML = `<li class="active">${itemEl.dataset.tableName}</li>`;
            elements.tableListUl.style.pointerEvents = 'none';
        } else if (itemType === 'custom_view_item') {
            elements.cvLabelInput.value = itemEl.dataset.label;

            // ▼▼▼ DEBUGGING BLOCK ADDED HERE ▼▼▼
            console.log("--- DEBUGGING CUSTOM VIEW EDIT ---");
            console.log("1. Menu item data (from appState.jsonData):", itemData);
            console.log("2. ID being searched:", itemData?.module_id, "(type:", typeof itemData?.module_id, ")");
            console.log("3. Searching inside this list (allCustomViews):", allCustomViews);
            
            const cvData = allCustomViews.find(v => {
                console.log(`- Comparing: Menu item CV ID ${itemData?.module_id} (type: ${typeof itemData?.module_id}) with View ID ${v.module_id} (type: ${typeof v.module_id})`);
                return v.module_id == itemData?.module_id;
            }) || { table_name: 'Unknown', module_name: 'View' };
            
            console.log("4. Search result (cvData):", cvData);
            console.log("--- END DEBUGGING ---");
            // ▲▲▲ END DEBUGGING BLOCK ▲▲▲
            
            elements.cvListUl.innerHTML = `<li class="active" data-cv-id="${cvData.module_id}">${cvData.table_name} - ${cvData.module_name}</li>`;
            elements.cvListUl.style.pointerEvents = 'none';
        } else {
            elements.labelInput.value = itemEl.dataset.label;
            elements.urlInput.value = itemEl.dataset.url || '';
        }
        if (itemData) { elements.recordCountCheckbox.checked = itemData.show_record_count === 1; }
        const parentGroup = itemEl.closest('.menu-group-item');
        elements.groupSelect.value = parentGroup ? parentGroup.dataset.groupId : '';
    } else {
        elements.title.textContent = 'Add New Menu Item';
    }

    let selectedTableName = null, selectedCvId = null;
    elements.tableListUl.addEventListener('click', e => {
        if (e.target.tagName === 'LI' && e.target.dataset.tableName) {
            elements.tableListUl.querySelectorAll('li').forEach(li => li.classList.remove('active'));
            e.target.classList.add('active');
            selectedTableName = e.target.dataset.tableName;
            elements.tableLabelInput.value = selectedTableName;
        }
    });
    elements.cvListUl.addEventListener('click', e => {
        if (e.target.tagName === 'LI' && e.target.dataset.cvId) {
            elements.cvListUl.querySelectorAll('li').forEach(li => li.classList.remove('active'));
            e.target.classList.add('active');
            selectedCvId = e.target.dataset.cvId;
            elements.cvLabelInput.value = e.target.textContent;
        }
    });

// FIND AND REPLACE THIS ENTIRE 'newOkBtn.addEventListener' BLOCK IN: uiHandlers.js
// It is located inside the openCustomMenuModal function

    newOkBtn.addEventListener('click', async () => {
        const selectedType = modal.querySelector('input[name="menu-item-type"]:checked').value;
        const itemId = elements.itemIdInput.value || null;
        let dataToSave = { project_id: appState.activeProject.project_id, item_id: itemId, menu_group_id: elements.groupSelect.value || null };

        if (selectedType === 'table') {
            const tableLabel = elements.tableLabelInput.value.trim();
            if (!tableLabel) { showCustomDialog({ title: "Input Required", message: "Menu Label is required." }); return; }
            
            let tableNameForSave;
            if (itemId) { // Edit mode
                tableNameForSave = itemEl.dataset.tableName;
            } else { // Add-new mode
                const activeLi = elements.tableListUl.querySelector('li.active');
                tableNameForSave = activeLi ? activeLi.dataset.tableName : null;
            }

            if (!tableNameForSave) { showCustomDialog({ title: "Input Required", message: "Please select a table." }); return; }
            const tableData = appState.jsonData.database.table[tableNameForSave];
            if (!tableData) { showCustomDialog({ title: "Error", message: "Table data not found." }); return; }
            dataToSave = { ...dataToSave, label: tableLabel, url: `${tableNameForSave} Module`, table_id: tableData.table_id, module_id: null, show_record_count: elements.recordCountCheckbox.checked };
        
        } else if (selectedType === 'custom_view') {
            const cvLabel = elements.cvLabelInput.value.trim();
            if (!cvLabel) { showCustomDialog({ title: "Input Required", message: "Menu Label is required." }); return; }

            // ▼▼▼ MAIN IMPROVEMENT BLOCK ▼▼▼
            // Get the ID directly from the active list element.
            // This logic works for both add-new mode (after clicking) and edit mode (already active).
            const activeLi = elements.cvListUl.querySelector('li.active');
            const cvIdForSave = activeLi ? activeLi.dataset.cvId : null;

            if (!cvIdForSave) {
                showCustomDialog({ title: "Input Required", message: "Please select a Custom Module." });
                return;
            }
            // ▲▲▲ END IMPROVEMENT BLOCK ▲▲▲

            const cvData = allCustomViews.find(v => v.module_id == cvIdForSave);
            if (!cvData) { showCustomDialog({ title: "Error", message: "Custom Module data not found." }); return; }
            dataToSave = { ...dataToSave, label: cvLabel, url: `${cvData.table_name} - ${cvData.module_name}`, table_id: null, module_id: cvIdForSave, show_record_count: elements.recordCountCheckbox.checked };
            
        } else { // custom
            const customLabel = elements.labelInput.value.trim();
            if (!customLabel) { showCustomDialog({ title: "Input Required", message: "Menu Label is required." }); return; }
            dataToSave = { ...dataToSave, label: customLabel, url: elements.urlInput.value.trim(), table_id: null, module_id: null, show_record_count: false };
        }

        const result = await window.electronAPI.saveCustomMenuItem(dataToSave);
        if (result.success) { closeModal(); await loadProjectData(appState.activeProject); }
        else { showCustomDialog({ title: "Error", message: `Failed to save menu item: ${result.message}` }); }
    }, { once: true });
    modal.classList.remove('hidden');
}

    const saveUnifiedStructure = async () => {
        if (!unifiedMenuList) return;
        
        const structure = Array.from(unifiedMenuList.childNodes).map(node => {
            if (node.matches('.menu-group-item')) {
                return {
                    type: 'group',
                    id: node.dataset.groupId,
                    name: node.querySelector('.group-name-input').value,
                    items: Array.from(node.querySelectorAll('.nested-menu-item')).map(item => ({
                        id: item.dataset.itemId
                    }))
                };
            } else if (node.matches('.custom-menu-item')) {
                return {
                    type: node.dataset.type,
                    id: node.dataset.itemId
                };
            }
            return null;
        }).filter(Boolean);
        
        const result = await window.electronAPI.saveUnifiedMenu({ projectId: appState.activeProject.project_id, menuStructure: structure });
        if (!result.success) {
            showCustomDialog({ title: "Save Error", message: "Failed to save menu structure: " + result.message });
        }
    };
    // Event handlers for the buttons
    addCustomMenuBtn.addEventListener('click', () => openCustomMenuModal());
    addGroupBtn.addEventListener('click', async () => {
        const result = await window.electronAPI.menuCreateGroup({ projectId: appState.activeProject.project_id, groupName: "New Group" });
        if (result.success) {
            await loadProjectData(appState.activeProject);
        } else {
            showCustomDialog({ title: "Error", message: "Failed to create new group: " + result.message });
        }
    });

    let currentTargetMenuSelector = null;
    menuManagementTab.addEventListener('click', (e) => {
        const target = e.target;
        // ▼▼▼ START CHANGE: Add references to nested items ▼▼▼
        const customItem = target.closest('.custom-menu-item');
        const groupItem = target.closest('.menu-group-item');
        const nestedItem = target.closest('.nested-menu-item');
        // ▲▲▲ END CHANGE ▲▲▲

        // ▼▼▼ START CHANGE: Add logic for buttons on nested items ▼▼▼
        if (target.closest('.nested-menu-delete-btn') && nestedItem) {
            showCustomDialog({
                title: "Confirm Deletion",
                message: "Are you sure you want to delete this menu item?",
                showCancelButton: true,
                onOk: async () => {
                    await window.electronAPI.saveCustomMenuItem({ item_id: nestedItem.dataset.itemId, project_id: appState.activeProject.project_id, label: 'DELETE', url: 'DELETE' });
                    await loadProjectData(appState.activeProject);
                }
            });
        }
        // ▲▲▲ END CHANGE ▲▲▲
        if (target.closest('.group-delete-btn') && groupItem) {
            showCustomDialog({
                title: "Confirm Group Deletion",
                message: `Are you sure you want to permanently delete the group "${groupItem.querySelector('.group-name-input').value}" and all items within it?`,
                showCancelButton: true,
                onOk: async () => {
                    await window.electronAPI.menuDeleteGroup({ groupId: groupItem.dataset.groupId });
                    await loadProjectData(appState.activeProject);
                }
            });
        } 
        else if (target.closest('.custom-menu-delete-btn') && customItem) {
             showCustomDialog({
                title: "Confirm Deletion",
                message: "Are you sure you want to delete this menu item?",
                showCancelButton: true,
                onOk: async () => {
                    await window.electronAPI.saveCustomMenuItem({ item_id: customItem.dataset.itemId, project_id: appState.activeProject.project_id, label: 'DELETE', url: 'DELETE' });
                    await loadProjectData(appState.activeProject);
                }
            });
        } 
        // ▼▼▼ START CHANGE: Add logic for buttons on nested items ▼▼▼
        else if (target.closest('.nested-menu-edit-btn') && nestedItem) {
            openCustomMenuModal(nestedItem);
        }
        // ▲▲▲ END CHANGE ▲▲▲
        else if (target.closest('.custom-menu-edit-btn') && customItem) {
            openCustomMenuModal(customItem);
        }
    });

    // Save the group name immediately
    let debounceTimer;
    menuManagementTab.addEventListener('input', (e) => {
        if (e.target.matches('.group-name-input')) {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(saveUnifiedStructure, 750);
        }
    });

    // ▼▼▼ NEW SYSTEM: ORDER MANAGEMENT USING UP/DOWN BUTTONS ▼▼▼
    const updateMoveButtonStates = () => {
        const items = unifiedMenuList.querySelectorAll('.menu-group-item, .custom-menu-item');
        items.forEach((item, index) => {
            const upBtn = item.querySelector('.menu-move-up-btn');
            const downBtn = item.querySelector('.menu-move-down-btn');
            if (upBtn) upBtn.disabled = (index === 0);
            if (downBtn) downBtn.disabled = (index === items.length - 1);
        });
    };

    unifiedMenuList.addEventListener('click', async (e) => {
        // ▼▼▼ START NEW LOGIC: Up/down buttons for items inside groups ▼▼▼
        const nestedUpBtn = e.target.closest('.nested-menu-move-up-btn');
        const nestedDownBtn = e.target.closest('.nested-menu-move-down-btn');

        if (nestedUpBtn || nestedDownBtn) {
            const currentItem = e.target.closest('.nested-menu-item');
            const container = currentItem.parentElement; // This is the .menu-selector
            if (!currentItem || !container) return;

            if (nestedUpBtn) {
                const prevItem = currentItem.previousElementSibling;
                if (prevItem) container.insertBefore(currentItem, prevItem);
            } else if (nestedDownBtn) {
                const nextItem = currentItem.nextElementSibling;
                if (nextItem) container.insertBefore(currentItem, nextItem.nextElementSibling);
            }

            updateNestedMoveButtonStates(container);
            await saveUnifiedStructure();
            return; // Stop further processing for this click
        }
        // ▲▲▲ END NEW LOGIC ▲▲▲

        const upBtn = e.target.closest('.menu-move-up-btn');
        const downBtn = e.target.closest('.menu-move-down-btn');

        if (!upBtn && !downBtn) return;

        const currentItem = e.target.closest('.menu-group-item, .custom-menu-item');
        if (!currentItem) return;

        if (upBtn) {
            const prevItem = currentItem.previousElementSibling;
            if (prevItem) {
                unifiedMenuList.insertBefore(currentItem, prevItem);
            }
        } else if (downBtn) {
            const nextItem = currentItem.nextElementSibling;
            if (nextItem) {
                unifiedMenuList.insertBefore(currentItem, nextItem.nextElementSibling);
            }
        }

        // Update button states after the move
        updateMoveButtonStates();

        // Save the new structure
        await saveUnifiedStructure();
    });
    // ▲▲▲ END NEW SYSTEM ▲▲▲
}

export function initializeHomepageMenuHandlers() {
    const menuAtHomepageCheckbox = document.getElementById('app-menu_at_homepage');
    const dependentOptions = document.querySelectorAll('.homepage-menu-option');

    if (!menuAtHomepageCheckbox || dependentOptions.length === 0) return;

    const toggleOptionsVisibility = () => {
        const isChecked = menuAtHomepageCheckbox.checked;
        dependentOptions.forEach(option => {
            // Use style.display for direct control
            option.style.display = isChecked ? '' : 'none';
        });
    };

    // Add a listener to the checkbox
    menuAtHomepageCheckbox.addEventListener('change', toggleOptionsVisibility);

    // Call once on load to set the correct initial state
    toggleOptionsVisibility();
}

function updateNestedMoveButtonStates(container) {
    if (!container) return;
    const items = container.querySelectorAll('.nested-menu-item');
    items.forEach((item, index) => {
        const upBtn = item.querySelector('.nested-menu-move-up-btn');
        const downBtn = item.querySelector('.nested-menu-move-down-btn');
        if (upBtn) upBtn.disabled = (index === 0);
        if (downBtn) downBtn.disabled = (index === items.length - 1);
    });
}

