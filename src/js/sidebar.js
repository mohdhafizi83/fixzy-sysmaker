import { showPage } from './pageManager.js';
// Import fungsi dari uiHandlers.js
import { 
populateFieldSettings, 
populateTableSettings, 
populateMainDashboard, 
updateActionButtonsState, 
populateSortByDropdown, 
populateFocusFieldDropdown, 
setupMediaTab, 
populateParentChildTab,
showCustomDialog
  } from './uiHandlers.js'; 
import { jsonData, activeProject, loadProjectData   } from './js.main.js';

export function initializeSidebarButtons() {
    const newTableBtn = document.getElementById('btn-new-table');
	const newFieldBtn = document.getElementById('btn-new-field');
	const deleteBtn = document.getElementById('btn-delete');

    if (newTableBtn) {
        newTableBtn.addEventListener('click', async () => {
            if (!activeProject) {
                // Mungkin perlu paparkan notifikasi
                console.error("Tiada projek aktif untuk menambah jadual.");
                return;
            }

            // Panggil backend untuk cipta jadual
            const newTable = await window.electronAPI.createTable(activeProject.project_id);

            if (newTable) {
                // Muat semula semua data dan UI untuk memaparkan jadual baharu
                await loadProjectData(activeProject);
            }
        });
    }
	
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            const activeLink = document.querySelector('.sidebar .nav-list a.active');
            if (!activeLink) return;

            const isFieldLink = activeLink.closest('ul.submenu-level-3');
            const isTableLink = activeLink.parentElement.classList.contains('has-submenu');

            if (isFieldLink) {
                // --- LOGIK PADAM MEDAN ---
                const tableName = activeLink.closest('.has-submenu').querySelector('a > span').textContent.trim();
                const fieldName = activeLink.querySelector('span').textContent.trim();
                const fieldObject = jsonData.database.table[tableName].fields[fieldName];

                let message = `Are you sure you want to permanently delete the field '${fieldName}'?`;
                
                // Semak jika ia adalah foreign key
                const relationship = jsonData.database.relationships.find(r => r.child_table_name === tableName && r.fk_child_field === fieldName);
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
                            await loadProjectData(activeProject);
                        } else {
                            showCustomDialog({ title: "Error", message: `Failed to delete field: ${result.message}` });
                        }
                    }
                });

            } else if (isTableLink) {
            const tableNameToDelete = activeLink.querySelector('span').textContent.trim();

            // Semak jika jadual ini adalah induk kepada jadual lain
            const childTables = jsonData.database.relationships
                .filter(r => r.parent_table_name === tableNameToDelete)
                .map(r => r.child_table_name);

            const performDelete = async (tablesToDelete) => {
                const result = await window.electronAPI.deleteTables({
                    projectId: activeProject.project_id,
                    tableNamesToDelete: tablesToDelete
                });
                if (result.success) {
                    showCustomDialog({ title: "Success", message: `${tablesToDelete.join(', ')} has been deleted.` });
                    await loadProjectData(activeProject); // Muat semula UI
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
            const activeLink = document.querySelector('.sidebar .nav-list a.active');
            if (!activeLink || !activeProject) return;

            const tableLink = activeLink.closest('.has-submenu').querySelector('a');
            const tableName = tableLink.querySelector('span').textContent.trim();
            const tableData = jsonData.database.table[tableName];

            if (tableData) {
                const newField = await window.electronAPI.createField(tableData.table_id);
                if (newField) {
                    await loadProjectData(activeProject);
                }
            }
        });
    }
	
}

export async function generateSidebarMenu() {
    try {
        const tables = jsonData.database.table;
        const menuListContainer = document.getElementById('table-menu-list');
        if (!menuListContainer) return;
        menuListContainer.innerHTML = '';
        for (const tableName in tables) {
            const fields = tables[tableName].fields;
            const tableLi = document.createElement('li');
            tableLi.className = 'has-submenu';
            const tableLink = document.createElement('a');
            tableLink.href = "#";
            tableLink.title = `Table Name: ${tableName}`;
            tableLink.innerHTML = `<i class="fas fa-table"></i> <span>${tableName}</span> <i class="fas fa-chevron-down toggle-icon"></i>`;
            const fieldsUl = document.createElement('ul');
            fieldsUl.className = 'submenu submenu-level-3';
            let isFirstField = true;
            for (const fieldName in fields) {
                const fieldLi = document.createElement('li');
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
    const sidebarList = document.querySelector('.sidebar .nav-list');
    if (!sidebarList) return;

    // Fungsi bantuan untuk menutup semua submenu
    const closeAllSubmenus = (exceptThisLink = null) => {
        const allTableLinks = sidebarList.querySelectorAll('.has-submenu > a');
        allTableLinks.forEach(link => {
            if (link === exceptThisLink) return;
            link.classList.remove('open');
            const submenu = link.nextElementSibling;
            if (submenu) submenu.style.display = 'none';
        });
    };

    // SATU event listener utama untuk semua klik
    sidebarList.addEventListener('click', function(event) {
        const link = event.target.closest('a');
        if (!link) return;
        event.preventDefault();

        // --- 1. URUSKAN STATUS AKTIF (SENTIASA JALAN DAHULU) ---
        sidebarList.querySelectorAll('a.active').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        updateActionButtonsState();

        // --- 2. TENTUKAN JENIS KLIK & LAKSANAKAN LOGIK ---
        const isFieldLink = link.closest('ul.submenu-level-3');
        const isTableLink = link.parentElement.classList.contains('has-submenu');
        let tableName;

        if (isFieldLink) {
            // ▼▼▼ PEMBETULAN UTAMA: Baris "closeAllSubmenus();" telah dipadam dari sini. ▼▼▼
            
            showPage('field-settings');
            tableName = link.closest('li.has-submenu').querySelector('a > span').textContent.trim();
            const fieldName = link.querySelector('span').textContent.trim();
            document.querySelector('#field-settings-page .field-name').textContent = `${tableName}.${fieldName}`;
            setupMediaTab(tableName, fieldName);
            populateFieldSettings(tableName, fieldName);

        } else if (isTableLink) {
            const isToggleClick = event.target.classList.contains('toggle-icon');
            closeAllSubmenus(link);
            
            if (isToggleClick) {
                link.classList.toggle('open');
                link.nextElementSibling.style.display = link.classList.contains('open') ? 'block' : 'none';
            } else {
                link.classList.remove('open');
                link.nextElementSibling.style.display = 'none';
            }

            showPage('table-settings');
            tableName = link.querySelector('span').textContent.trim();
            document.querySelector('#table-settings-page .table-name').textContent = tableName;
            populateTableSettings(tableName);
            populateParentChildTab(tableName);

        } else {
            showPage('main-dashboard');
            populateMainDashboard(activeProject);
            closeAllSubmenus();
        }

        if (tableName) {
            populateSortByDropdown(tableName);
            populateFocusFieldDropdown(tableName);
        }
    });
}