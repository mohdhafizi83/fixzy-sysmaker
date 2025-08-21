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
populateParentChildTab
  } from './uiHandlers.js'; 
import { jsonData, activeProject  } from './js.main.js';

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

// GANTIKAN KESELURUHAN FUNGSI LAMA DENGAN INI
export function initializeSidebarInteractivity() {
    const allLinks = document.querySelectorAll('.sidebar .nav-list a');
    const menuListContainer = document.getElementById('table-menu-list');
    
    // Fungsi bantuan ini adalah betul dan akan kita gunakan
    const closeAllSubmenus = (exceptThisLink = null) => {
        if (!menuListContainer) return;
        const allMenuLinks = menuListContainer.querySelectorAll('.has-submenu > a');
        allMenuLinks.forEach(link => {
            if (link === exceptThisLink) return; 

            link.classList.remove('open');
            const submenu = link.nextElementSibling;
            if (submenu) {
                submenu.style.display = 'none';
            }
        });
    };
    
    allLinks.forEach(link => {
        link.addEventListener('click', function(event) {
            
            if (event.target.classList.contains('toggle-icon')) {
                event.preventDefault();
                event.stopPropagation();

                // PERUBAHAN 1: Panggil fungsi tutup-auto di sini
                closeAllSubmenus(this); 
                
                // Logik asal anda untuk toggle dikekalkan
                const submenu = this.nextElementSibling;
                this.classList.toggle('open');
                if (submenu) {
                    submenu.style.display = submenu.style.display === 'block' ? 'none' : 'block';
                }
                return;
            }

            // Logik pemilihan asal anda dikekalkan
            allLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
            updateActionButtonsState();

            const isFieldLink = this.closest('ul.submenu-level-3');
            let tableName;

            if (isFieldLink) {
                showPage('field-settings');
                tableName = this.closest('li.has-submenu').querySelector('a > span').textContent.trim();
                const fieldName = this.querySelector('span').textContent.trim();
                document.querySelector('#field-settings-page .field-name').textContent = `${tableName}.${fieldName}`;
                setupMediaTab(tableName, fieldName);
                populateFieldSettings(tableName, fieldName);

            } else if (this.parentElement.classList.contains('has-submenu')) {
                showPage('table-settings');
                tableName = this.querySelector('span').textContent.trim();
                document.querySelector('#table-settings-page .table-name').textContent = tableName;
                populateTableSettings(tableName);
                populateParentChildTab(tableName);

            } else {
                showPage('main-dashboard');
                populateMainDashboard(activeProject);
                
                // PERUBAHAN 2: Pastikan panggilan ini ada di sini
                closeAllSubmenus();
            }

            if (tableName) {
                populateSortByDropdown(tableName);
                populateFocusFieldDropdown(tableName);
            }
        });
    });
}