import { showPage } from './pageManager.js';
// Import fungsi baru dari uiHandlers.js
import { updateActionButtonsState, populateSortByDropdown, populateFocusFieldDropdown, setupMediaTab, populateParentChildTab  } from './uiHandlers.js'; 
import { jsonData } from './js.main.js';

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
    const allLinks = document.querySelectorAll('.sidebar .nav-list a');
    const submenuTriggers = document.querySelectorAll('.sidebar .has-submenu > a');

    submenuTriggers.forEach(trigger => {
        trigger.addEventListener('click', function(event) {
            event.preventDefault();
            const submenu = this.nextElementSibling;
            this.classList.toggle('open');
            if (submenu.style.display === 'block') { submenu.style.display = 'none'; }
            else { submenu.style.display = 'block'; }
        });
    });

    allLinks.forEach(link => {
        link.addEventListener('click', function() {
            allLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
            updateActionButtonsState();

            // ▼▼▼ LOGIK YANG DIPERBAIKI BERMULA DI SINI ▼▼▼
            const isFieldLink = this.closest('ul.submenu-level-3');
            let tableName;

            if (isFieldLink) {
                // INI ADALAH KLIK PADA 'MENU FIELD' (cth: id_pelajar)
                showPage('field-settings');
                // Dapatkan nama jadual dari induknya
                tableName = this.closest('li.has-submenu').querySelector('a > span').textContent.trim();
                const fieldName = this.querySelector('span').textContent.trim();
                const fieldSettingsTitle = document.querySelector('#field-settings-page .field-name');
                if (fieldSettingsTitle) {
                    fieldSettingsTitle.textContent = `${tableName}.${fieldName}`;
                }
                setupMediaTab(tableName, fieldName);

            } else if (this.parentElement.classList.contains('has-submenu')) {
                // INI ADALAH KLIK PADA 'MENU TABLE' (cth: pelajar)
                showPage('table-settings');
                tableName = this.querySelector('span').textContent.trim();
                const tableSettingsTitle = document.querySelector('#table-settings-page .table-name');
                if (tableSettingsTitle) {
                    tableSettingsTitle.textContent = tableName;
                }
                // HANYA PANGGIL FUNGSI INI APABILA 'MENU TABLE' DIKLIK
                populateParentChildTab(tableName);

            } else {
                // Ini adalah klik pada item menu utama seperti 'Project Core'
                showPage('main-dashboard');
            }

            // Kemas kini dropdown yang berkaitan jika tableName wujud
            if (tableName) {
                populateSortByDropdown(tableName);
                populateFocusFieldDropdown(tableName);
            }
            // ▲▲▲ LOGIK YANG DIPERBAIKI TAMAT DI SINI ▲▲▲
        });
    });
}