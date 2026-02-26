import { showPage } from './pageManager.js';
// Import fungsi dari uiHandlers.js
import {   
updateActionButtonsState, 
applyFormLock 
  } from './uiHandlers.js'; 
  
import { showCustomDialog } from './ui/modalHandlers.js';
import { populateMainDashboard } from './pages/dashboard.js';
  
import { populateTableSettings, populateParentChildTab } from './pages/tableSettings.js';
import { populateFieldSettings, setupMediaTab } from './pages/fieldSettings.js';
import { appState } from './state.js'; 
import { loadProjectData } from '../renderer.js'; 

export function focusOnSidebarField(tableName, fieldName) {
    return new Promise(resolve => {
        const allLinks = document.querySelectorAll('#table-list a');
        const tableLinks = document.querySelectorAll('#table-list .has-submenu > a');
        const parentLink = Array.from(tableLinks).find(
            link => link.querySelector('span').textContent.trim() === tableName
        );

        if (!parentLink) {
            console.error(`Jadual '${tableName}' tidak ditemui di sidebar.`);
            resolve();
            return;
        }

        const selectAndPopulate = () => {
            const fieldLinks = parentLink.parentElement.querySelectorAll('.submenu-level-3 a');
            const targetFieldLink = Array.from(fieldLinks).find(
                link => link.querySelector('span').textContent.trim() === fieldName
            );

            if (targetFieldLink) {
                // 1. HIDUPKAN MOD POPULATE (PENTING!)
                appState.isPopulatingData = true;

                // Logik UI
                allLinks.forEach(l => l.classList.remove('active'));
                targetFieldLink.classList.add('active');
                updateActionButtonsState();

document.getElementById('table-settings-page').classList.add('hidden');
document.getElementById('field-settings-page').classList.remove('hidden');
                document.querySelector('#field-settings-page .field-name').textContent = `${tableName}.${fieldName}`;
                
                // Populate Data
                setupMediaTab(tableName, fieldName);
                populateFieldSettings(tableName, fieldName);
                
                // 2. MATIKAN MOD POPULATE SELEPAS SELESAI
                // Kita guna setTimeout untuk memastikan semua event 'change' palsu sudah reda
                setTimeout(() => {
                    appState.isPopulatingData = false;
                }, 200); 
            }
            resolve();
        };

        if (!parentLink.classList.contains('open')) {
            parentLink.classList.add('open');
            const submenu = parentLink.nextElementSibling;
            if (submenu) submenu.style.display = 'block';
            setTimeout(selectAndPopulate, 50); 
        } else {
            selectAndPopulate();
        }
    });
}

// Fungsi baharu untuk mengaktifkan pautan secara manual
export function setActiveSidebarLink(tableName) {
    if (!tableName) return;

    const allLinks = document.querySelectorAll('#table-list a');
    const tableLinks = document.querySelectorAll('#table-list .has-submenu > a');

    const targetLink = Array.from(tableLinks).find(
        link => link.querySelector('span').textContent.trim() === tableName
    );

    if (targetLink) {
        // Nyahaktifkan semua pautan lain
        allLinks.forEach(l => l.classList.remove('active'));
        // Aktifkan pautan sasaran
        targetLink.classList.add('active');
        
        // Paparkan halaman dan muatkan datanya
document.getElementById('field-settings-page').classList.add('hidden');
document.getElementById('table-settings-page').classList.remove('hidden');
        document.querySelector('#table-settings-page .table-name').textContent = tableName;
        populateTableSettings(tableName);
        populateParentChildTab(tableName);
		
		updateActionButtonsState();
    }
}

export function initializeSidebarButtons() {
    const newTableBtn = document.getElementById('btn-new-table');
	const newFieldBtn = document.getElementById('btn-new-field');
	const deleteBtn = document.getElementById('btn-delete');
    const moveUpBtn = document.getElementById('btn-move-up');
    const moveDownBtn = document.getElementById('btn-move-down');

    const handleMove = async (direction) => {
        const activeLink = document.querySelector('#table-list a.active');
        if (!activeLink) return;

        const isField = activeLink.closest('ul.submenu-level-3');
        const isTable = activeLink.parentElement.classList.contains('has-submenu');

        let itemLi, sibling;

        if (isField) {
            itemLi = activeLink.parentElement;
            sibling = direction === 'up' ? itemLi.previousElementSibling : itemLi.nextElementSibling;
        } else if (isTable) {
            itemLi = activeLink.parentElement;
            sibling = direction === 'up' ? itemLi.previousElementSibling : itemLi.nextElementSibling;
        } else {
            return; // Bukan medan atau jadual
        }

        if (sibling) {
            // Gerakkan item dalam DOM
            itemLi.parentElement.insertBefore(
                itemLi,
                direction === 'up' ? sibling : sibling.nextElementSibling
            );

            // Kumpul susunan baharu dan hantar ke backend
            if (isField) {
                const allFieldLis = itemLi.parentElement.querySelectorAll('li');
                const orderData = Array.from(allFieldLis).map((li, index) => ({
                    field_id: li.dataset.fieldId,
                    order: index
                }));
                await window.electronAPI.updateFieldOrder(orderData);
            } else if (isTable) {
                const allTableLis = itemLi.parentElement.querySelectorAll('li');
                const orderData = Array.from(allTableLis).map((li, index) => ({
                    table_id: li.dataset.tableId,
                    order: index
                }));
                await window.electronAPI.updateTableOrder(orderData);
            }
        }
    };

    if (moveUpBtn) moveUpBtn.addEventListener('click', () => handleMove('up'));
    if (moveDownBtn) moveDownBtn.addEventListener('click', () => handleMove('down'));
	
    if (newTableBtn) {
        newTableBtn.addEventListener('click', async () => {
            if (!appState.activeProject) {
                // Mungkin perlu paparkan notifikasi
                console.error("Tiada projek aktif untuk menambah jadual.");
                return;
            }

            // Panggil backend untuk cipta jadual
            const newTable = await window.electronAPI.createTable(appState.activeProject.project_id);

            if (newTable) {
    // Muat semula data DAN hantar nama jadual baharu untuk dipilih
    await loadProjectData(appState.activeProject, newTable.table_name);
            }
        });
    }
	
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            const activeLink = document.querySelector('#table-list a.active');
            if (!activeLink) return;

            const isFieldLink = activeLink.closest('ul.submenu-level-3');
            const isTableLink = activeLink.parentElement.classList.contains('has-submenu');

            if (isFieldLink) {
                // --- LOGIK PADAM MEDAN ---
                const tableName = activeLink.closest('.has-submenu').querySelector('a > span').textContent.trim(); 
                const fieldName = activeLink.querySelector('span').textContent.trim();
                const fieldObject = appState.jsonData.database.table[tableName].fields[fieldName];

                let message = `Are you sure you want to permanently delete the field '${fieldName}'?`;
                
                // Semak jika ia adalah foreign key
                const relationship = appState.jsonData.database.relationships.find(r => r.child_table_name === tableName && r.fk_child_field === fieldName);
                if (relationship) {
                    message += `\n\nThis will also remove its parent/child relationship with the '${relationship.parent_table_name}' table.`;
                }

                showCustomDialog({
                    title: "Confirm Field Deletion",
                    message: message,
                    showCancelButton: true,
                    onOk: async () => {
        const result = await window.electronAPI.deleteField({
            fieldId: fieldObject.field_id,
            tableName: tableName,
            fieldName: fieldName
        });
                        if (result.success) {
                            showCustomDialog({ title: "Success", message: `'${fieldName}' has been deleted.` });
            // Selepas memuat semula data, aktifkan jadual induk
            await loadProjectData(appState.activeProject);
            setActiveSidebarLink(tableName);
                        } else {
                            showCustomDialog({ title: "Error", message: `Failed to delete field: ${result.message}` });
                        }
                    }
                });

            } else if (isTableLink) {
            const tableNameToDelete = activeLink.querySelector('span').textContent.trim();

            // Semak jika jadual ini adalah induk kepada jadual lain
            const childTables = appState.jsonData.database.relationships
                .filter(r => r.parent_table_name === tableNameToDelete)
                .map(r => r.child_table_name);

const performDelete = async (tablesToDelete) => {
    const result = await window.electronAPI.deleteTables({
        projectId: appState.activeProject.project_id,
        tableNamesToDelete: tablesToDelete
    });
    if (result.success) {
        showCustomDialog({ title: "Success", message: `${tablesToDelete.join(', ')} has been deleted.` });
        await loadProjectData(appState.activeProject);

        // ▼▼▼ TAMBAHAN BAHARU DI SINI ▼▼▼
        // Cari pautan 'Project Setup' dan aktifkannya
        const projectSetupLink = document.querySelector('.sidebar .nav-list > li > a');
        if (projectSetupLink) {
            // Buang 'active' dari semua pautan lain
            document.querySelectorAll('#table-list a.active').forEach(l => l.classList.remove('active'));
            
            // Aktifkan pautan 'Project Setup'
            projectSetupLink.classList.add('active');
            
            // Paparkan halaman utama dan kemas kini keadaan butang
            showPage('main-dashboard');
            updateActionButtonsState();
        }
        // ▲▲▲ TAMAT TAMBAHAN ▲▲▲
        
    } else {
        showCustomDialog({ title: "Error", message: `Failed to delete tables: ${result.message}` });
    }
};

            if (childTables.length > 0) {
                // KES 1: Jadual adalah induk
                const message = `Warning: '${tableNameToDelete}' is a parent table for the following child tables:\n\n` +
                              `- ${childTables.join('\n- ')}\n\n` +
                              `Deleting '${tableNameToDelete}' will also permanently delete these child tables and all their data. Are you sure you want to proceed?`;
                
                showCustomDialog({
                    title: "Confirm Deletion of Parent Table",
                    message: message,
                    showCancelButton: true,
                    onOk: () => {
                        const allTablesToDelete = [tableNameToDelete, ...childTables];
                        performDelete(allTablesToDelete);
                    }
                });

            } else {
                // KES 2: Jadual bukan induk
                const message = `Are you sure you want to permanently delete the table '${tableNameToDelete}' and all its fields?`;
                showCustomDialog({
                    title: "Confirm Deletion",
                    message: message,
                    showCancelButton: true,
                    onOk: () => {
                        performDelete([tableNameToDelete]);
                    }
                });
            }
			
			
            } else {
                showCustomDialog({ title: "Info", message: "Please select a table or field to delete." });
            }			
			
        });
    }

    if (newFieldBtn) {
        newFieldBtn.addEventListener('click', async () => {
            const activeLink = document.querySelector('#table-list a.active');
            if (!activeLink || !appState.activeProject) return;

            const tableLink = activeLink.closest('.has-submenu').querySelector('a');
            const tableName = tableLink.querySelector('span').textContent.trim();
            const tableData = appState.jsonData.database.table[tableName];

            if (tableData) {
                const newField = await window.electronAPI.createField(tableData.table_id);
                if (newField) {
                    // 1. Muat semula data dahulu
                    await loadProjectData(appState.activeProject);
                    // 2. Selepas UI dikemas kini, panggil fungsi fokus
                    focusOnSidebarField(tableName, newField.field_name);
                }
            }
        });
    }
	
}

export async function generateSidebarMenu() {
    try {
        const tables = appState.jsonData.database.table;
        const menuListContainer = document.getElementById('table-list');
        if (!menuListContainer) return;
        menuListContainer.innerHTML = '';
        for (const tableName in tables) {
            const fields = tables[tableName].fields;
            const tableLi = document.createElement('li');
            tableLi.className = 'has-submenu';
			tableLi.dataset.tableId = tables[tableName].table_id;
			
            const tableLink = document.createElement('a');
            tableLink.href = "#";
            tableLink.title = `Table Name: ${tableName}`;
            tableLink.innerHTML = `<i class="fas fa-table"></i> <span>${tableName}</span> <i class="fas fa-chevron-down toggle-icon"></i>`;
            const fieldsUl = document.createElement('ul');
            fieldsUl.className = 'submenu submenu-level-3';
            let isFirstField = true;
            for (const fieldName in fields) {
                const fieldLi = document.createElement('li');
				fieldLi.dataset.fieldId = fields[fieldName].field_id;
				
                const fieldLink = document.createElement('a');
                fieldLink.href = "#";
                fieldLink.title = `Field Name: ${fieldName}`;
                const iconClass = isFirstField ? 'fas fa-key' : 'fas fa-table-columns';
                fieldLink.innerHTML = `<i class="${iconClass}"></i> <span>${fieldName}</span>`;
                isFirstField = false;
                fieldLi.appendChild(fieldLink);
                fieldsUl.appendChild(fieldLi);
            }
            tableLi.appendChild(tableLink);
            tableLi.appendChild(fieldsUl);
            menuListContainer.appendChild(tableLi);
        }
    } catch (error) {
        console.error("Gagal menjana menu:", error);
    }
}

export function initializeSidebarInteractivity() {
    const sidebarList = document.getElementById('table-list');
    if (!sidebarList) return;

    // Mesej kunci (Lock Message)
    const fieldLockMessage = "This core system field cannot be modified.\n\nTo proceed, you can disable this protection in Configuration. This is highly discouraged and there is no guarantee the final generated application will work properly.";
    const tableLockMessage = "The 'users' table is a core system component and cannot be modified.\n\nTo proceed, you can disable this protection in Configuration. This is highly discouraged and there is no guarantee the final generated application will work properly.";

    const closeAllSubmenus = (exceptThisLink = null) => {
        const allTableLinks = sidebarList.querySelectorAll('.has-submenu > a');
        allTableLinks.forEach(link => {
            if (link === exceptThisLink) return;
            link.classList.remove('open');
            const submenu = link.nextElementSibling;
            if (submenu) submenu.style.display = 'none';
        });
    };

    sidebarList.addEventListener('click', function(event) {
        const link = event.target.closest('a');
        if (!link) return;
        event.preventDefault();

        sidebarList.querySelectorAll('a.active').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        updateActionButtonsState();

        const isFieldLink = link.closest('ul.submenu-level-3');
        const isTableLink = link.parentElement.classList.contains('has-submenu');
        
        if (isFieldLink) {
            appState.isPopulatingData = true; // Block auto-save
            const tableName = link.closest('li.has-submenu').querySelector('a > span').textContent.trim();
            const fieldName = link.querySelector('span').textContent.trim();
            const protectedFields = ['id', 'created_at', 'updated_at', 'deleted_at', 'created_by', 'updated_by', 'deleted_by'];

            // PEMBETULAN DI SINI: Guna appState.isCoreLockingEnabled
            if (appState.isCoreLockingEnabled && (tableName === 'users' || protectedFields.includes(fieldName))) {
                document.querySelector('.main-content').scrollTop = 0;
                applyFormLock('field', true, fieldLockMessage); 
            } else {
                applyFormLock('field', false);
            }

document.getElementById('table-settings-page').classList.add('hidden');
document.getElementById('field-settings-page').classList.remove('hidden');
            document.querySelector('#field-settings-page .field-name').textContent = `${tableName}.${fieldName}`;
            setupMediaTab(tableName, fieldName);
            populateFieldSettings(tableName, fieldName);
            setTimeout(() => { appState.isPopulatingData = false; }, 200);
            
        } else if (isTableLink) {
            
            appState.isPopulatingData = true;
            const tableName = link.querySelector('span').textContent.trim();
            
            // PEMBETULAN DI SINI: Guna appState.isCoreLockingEnabled
            if (appState.isCoreLockingEnabled && tableName === 'users') {
                document.querySelector('.main-content').scrollTop = 0;
                applyFormLock('table', true, tableLockMessage);
            } else {
                applyFormLock('table', false);
            }

            const isToggleClick = event.target.classList.contains('toggle-icon');
            closeAllSubmenus(link);
            
            if (isToggleClick) {
                link.classList.toggle('open');
                link.nextElementSibling.style.display = link.classList.contains('open') ? 'block' : 'none';
            } else {
                link.classList.remove('open');
                link.nextElementSibling.style.display = 'none';
            }

document.getElementById('field-settings-page').classList.add('hidden');
document.getElementById('table-settings-page').classList.remove('hidden');
            document.querySelector('#table-settings-page .table-name').textContent = tableName;
            populateTableSettings(tableName);
            populateParentChildTab(tableName);

            setTimeout(() => { appState.isPopulatingData = false; }, 200); 
        } else { // Project Setup Link
            appState.isPopulatingData = true;
            
            applyFormLock('table', false);
            applyFormLock('field', false);
            
            showPage('main-dashboard');
            populateMainDashboard(appState.activeProject);
            closeAllSubmenus();
            setTimeout(() => { appState.isPopulatingData = false; }, 200);
        }
    });
}