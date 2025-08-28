// js/main.js (Proses Renderer)
import { generateSidebarMenu, initializeSidebarInteractivity, initializeSidebarButtons, setActiveSidebarLink, focusOnSidebarField } from './sidebar.js';
import { 
	applyFontSize,
	showCustomDialog,
    updateActionButtonsState, 
    initializeTabSystems, 
    initializeModalHandlers, 
    initializeMediaTabHandlers,
    initializeOptionsListHandlers,
    initializeLocalizationHandlers,
	initializeThemeHandlers,
    initializeMenuManagementHandlers,
    initializeSecurityTabHandlers,
    initializeClassSelectorHandlers,
    initializeAutoDefaultHandlers,
    initializeLinkOptionsHandlers,
    initializeImageOptionsHandlers,
    initializeFileUploadOptionsHandlers,
    initializeMediaVisibilityHandlers,
	populateMainDashboard,
    initializeLookupFieldHandlers,
    populateMenuManagement,
    initializeAdvancedLookupHandlers,
    initializeHomepageMenuHandlers,
    initializeDataTypeRules,
    initializeFormDisplayRules,
	initializeDatabasePropertiesHandlers,
    initializeRealtimeValidation,
    initializeOptionsListRules,
    initializeCalculatedFieldRules,
	initializeTemplatePreviewHandlers,
    populateProjectDropdown,
    initializeProjectSaveHandlers,
    initializeTableSaveHandlers,
    initializeFieldSaveHandlers,
    initializeRelationshipSaveHandlers,
    initializeLookupFieldSaveHandler,
	initializeAlgorithmBuilder,
    saveProjectSettings,
    saveTableSettings, 
    saveFieldSettings,
    saveRelationshipSettings   	
} from './uiHandlers.js';

// GANTIKAN KESELURUHAN OBJEK SAVEMANAGER SEDIA ADA DENGAN VERSI INI

// GANTIKAN KESELURUHAN OBJEK SAVEMANAGER SEDIA ADA DENGAN VERSI INI

export const SaveManager = {
    saveQueue: {
        project: {}, tables: {}, fields: {}, relationships: {}, menus: null
    },
    debounceTimer: null,
    isProcessing: false,

    addToQueue(type, id, data) {
        if (type === 'menus') {
            this.saveQueue.menus = data;
        } else if (type === 'project') {
            this.saveQueue.project = { ...this.saveQueue.project, ...data };
        } else {
            this.saveQueue[type][id] = { ...(this.saveQueue[type][id] || {}), ...data };
        }
        
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => this.processQueue(), 2500);
    },

    async processQueue() {
        if (this.isProcessing || this.isQueueEmpty()) {
            return;
        }
        
        console.log("--- [SaveManager] Memproses & Menghantar Queue ke Backend ---", this.saveQueue);
        this.isProcessing = true;
        const saveStatus = document.getElementById('save-status');
        saveStatus.textContent = 'Saving...';
        saveStatus.className = 'saving';

        try {
            const result = await window.electronAPI.batchUpdate(this.saveQueue);

            if (result.success) {
                console.log("[SaveManager] Kemas kini berkelompok berjaya.");
                this.clearQueue();
                
                // ▼▼▼ PENAMBAHBAIKAN BERMULA DI SINI ▼▼▼
                // 1. Dapatkan konteks halaman (nama jadual) DAN child table yang sedang aktif
                let activeTableName = null;
                const tablePage = document.getElementById('table-settings-page');
                const fieldPage = document.getElementById('field-settings-page');

                if (tablePage && !tablePage.classList.contains('hidden')) {
                    activeTableName = tablePage.querySelector('.table-name')?.textContent;
                    
                    // Ambil juga child table yang aktif jika berada di tab yang betul
                    const activeChildElement = tablePage.querySelector('#tab-detail-parent-child .item-list li.active');
                    if (activeChildElement) {
                        setLastActiveChildTable(activeChildElement.dataset.childName);
                    }
                } else if (fieldPage && !fieldPage.classList.contains('hidden')) {
                    activeTableName = fieldPage.querySelector('.field-name')?.textContent.split('.')[0];
                }
                
                // 2. Muat semula semua data DAN pilih semula jadual/fokus yang betul
                await loadProjectData(activeProject, activeTableName);
                // ▲▲▲ TAMAT PENAMBAHBAIKAN ▲▲▲

                saveStatus.textContent = 'All changes saved ✔';
                saveStatus.className = 'saved';
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error("[SaveManager] Kemas kini berkelompok gagal:", error);
            showCustomDialog({ title: "Save Failed", message: `Error during batch save: ${error.message}` });
            saveStatus.textContent = 'Save failed!';
            saveStatus.className = 'error';
        } finally {
            this.isProcessing = false;
            // 3. Reset state di sini untuk kepastian selepas semua operasi selesai
            setLastActiveChildTable(null); 
            setTimeout(() => saveStatus.textContent = '', 3000);
        }
    },

    clearQueue() {
        this.saveQueue = { project: {}, tables: {}, fields: {}, relationships: {}, menus: null };
    },

    isQueueEmpty() {
        return (
            Object.keys(this.saveQueue.project).length === 0 &&
            Object.keys(this.saveQueue.tables).length === 0 &&
            Object.keys(this.saveQueue.fields).length === 0 &&
            Object.keys(this.saveQueue.relationships).length === 0 &&
            !this.saveQueue.menus
        );
    }
};

export function setActiveSidebarItem(tableName, fieldName = null) {
    // Beri sedikit masa untuk DOM "tenang" selepas dijana semula
    setTimeout(() => {
        const tableLinks = document.querySelectorAll('.sidebar .nav-list .has-submenu > a');
        const parentLink = Array.from(tableLinks).find(
            link => link.querySelector('span').textContent.trim() === tableName
        );

        if (!parentLink) {
            console.error(`Jadual '${tableName}' tidak ditemui di sidebar.`);
            return;
        }

        // Jika sasarannya adalah medan, buka menu induknya dahulu
        if (fieldName) {
            // Buka submenu secara terus (lebih stabil daripada .click())
            if (!parentLink.classList.contains('open')) {
                parentLink.classList.add('open');
                const submenu = parentLink.nextElementSibling;
                if (submenu) submenu.style.display = 'block';
            }
            // Gunakan fungsi sedia ada untuk fokus pada medan
            focusOnSidebarField(tableName, fieldName);
        } else {
            // Jika sasarannya adalah jadual, gunakan fungsi sedia ada
            setActiveSidebarLink(tableName);
        }
    }, 100); // Kelewatan minimum untuk memastikan DOM sedia
}

function showConfirmationDialog(title, message) {
    return new Promise((resolve) => {
        showCustomDialog({
            title: title,
            message: message,
            showCancelButton: true,
            onOk: () => resolve(true),      // Jika OK, kembalikan 'true'
            onCancel: () => resolve(false)  // Jika Cancel, kembalikan 'false'
        });
    });
}

// Pembolehubah global untuk menyimpan data projek semasa dan pengurusan UI
export let jsonData = null;
export let allTableNames = [];
export let activeProject = null;
export let isAutoSaveEnabled = true;
export let isPopulatingData = false;
export let lastActiveChildTable = null;
// =================================================================
// ▼▼▼ FUNGSI UTAMA BAHARU UNTUK MEMUATKAN DATA PROJEK ▼▼▼
// =================================================================

/**
 * Menetapkan nama child table yang aktif.
 * @param {string | null} tableName - Nama jadual atau null untuk reset.
 */
export function setLastActiveChildTable(tableName) {
    lastActiveChildTable = tableName;
}

export async function loadProjectData(project, tableToSelect = null, itemToSelect = null) {
    if (!project || !project.project_id) {
        //console.log("Tiada projek aktif, memaparkan modal projek baharu.");
        document.getElementById('new-project-modal')?.classList.remove('hidden');
        return;
    }
    
    //console.log(`Memuatkan data untuk projek: ${project.app_title} (ID: ${project.project_id})`);

    // Fetch the single, consolidated data package from the backend.
    const data = await window.electronAPI.getFullSchema(project.project_id);

    if (data && data.project && data.database) {
        isPopulatingData = true; // <-- SET BENDERA KEPADA TRUE SEBELUM POPULASI

        activeProject = data.project;
        jsonData = data;
        
        allTableNames = Object.keys(jsonData.database.table || {});

        // Now, this function will use the complete project data.
        populateMainDashboard(activeProject);  
        populateMenuManagement(jsonData.database.menu_groups);
        document.getElementById('app-title').value = activeProject.app_title || 'Project Name';
        
        await generateSidebarMenu();
		
        if (itemToSelect) {
            setTimeout(() => {
                let linkToClick = null;
                if (itemToSelect.field) {
                    const tableLinks = document.querySelectorAll('.sidebar .nav-list .has-submenu > a');
                    const parentLink = Array.from(tableLinks).find(
                        link => link.querySelector('span').textContent.trim() === itemToSelect.table
                    );
                    if (parentLink) {
                        if (!parentLink.classList.contains('open')) {
                            parentLink.querySelector('.toggle-icon').click();
                        }
                        const fieldLinks = parentLink.parentElement.querySelectorAll('.submenu-level-3 a');
                        linkToClick = Array.from(fieldLinks).find(
                            link => link.querySelector('span').textContent.trim() === itemToSelect.field
                        );
                    }
                } else if (itemToSelect.table) {
                    const tableLinks = document.querySelectorAll('.sidebar .nav-list .has-submenu > a');
                    linkToClick = Array.from(tableLinks).find(
                        link => link.querySelector('span').textContent.trim() === itemToSelect.table
                    );
                }

                if (linkToClick) {
                    linkToClick.click();
                }
            }, 100);
        }

        if (tableToSelect) {
            setActiveSidebarLink(tableToSelect);
        }
        
        const tablesExistResult = await window.electronAPI.checkTablesExist(project.project_id);
        if (tablesExistResult && tablesExistResult.count === 0) {
            document.getElementById('tutorial-modal')?.classList.remove('hidden');
        }

        isPopulatingData = false; // <-- SET SEMULA BENDERA KEPADA FALSE SELEPAS SELESAI

    } else {
        console.error("Gagal memuatkan data skema dari backend.");
    }
	
    await populateProjectDropdown();
}

// Fungsi untuk menguruskan import SQL
// js/js.main.js

async function handleSqlImport(importFunction) {
    if (!activeProject) {
        showCustomDialog({ title: "Error", message: "Please create or select a project first." });
        return;
    }

    const tablesExistResult = await window.electronAPI.checkTablesExist(activeProject.project_id);
    if (tablesExistResult && tablesExistResult.count > 0) {
        
        
        const message = "This project already has tables. Importing a new schema will DELETE ALL existing tables and fields. Continue?";
        const userConfirmed = await showConfirmationDialog("Warning", message);
        
        if (!userConfirmed) {
            return;
        }
        

        await window.electronAPI.deleteProjectSchema(activeProject.project_id);
    }
    
    const result = await importFunction();

    if (result.success) {
        showCustomDialog({ title: "Success", message: result.message });
        await loadProjectData(activeProject);
    } else {
        showCustomDialog({ title: "Import Failed", message: `Error: ${result.message}` });
    }
}


// Inisialisasi Aplikasi
document.addEventListener('DOMContentLoaded', async () => {

// Jaring keselamatan untuk menghalang kehilangan data semasa reload/tutup
window.addEventListener('beforeunload', (event) => {
    // Periksa jika ada sebarang perubahan yang sedang menunggu di dalam queue
    if (!SaveManager.isQueueEmpty()) {
        // Baris ini akan menyebabkan pelayar memaparkan dialog pengesahan
        event.preventDefault();
        event.returnValue = ''; // Diperlukan untuk sesetengah pelayar
    }
});
	
    try {
        const settings = await window.electronAPI.getAllSettings();
        if (settings && settings.font_size) {
            applyFontSize(settings.font_size);
        }
    } catch (error) {
        console.error("Gagal memuatkan tetapan awal:", error);
    }

    // Inisialisasi semua sistem UI
    initializeTabSystems();
    initializeModalHandlers();
    initializeMediaTabHandlers();
    initializeOptionsListHandlers();
    updateActionButtonsState();
	initializeLocalizationHandlers();
	initializeThemeHandlers();
	initializeMenuManagementHandlers();

	initializeSecurityTabHandlers();
	initializeClassSelectorHandlers();
	initializeAutoDefaultHandlers();
	initializeLinkOptionsHandlers();
	initializeImageOptionsHandlers();
	initializeFileUploadOptionsHandlers();
	initializeMediaVisibilityHandlers();
	initializeLookupFieldHandlers();
	initializeAdvancedLookupHandlers();
	initializeHomepageMenuHandlers();
    initializeDataTypeRules();
	initializeFormDisplayRules();
	initializeDatabasePropertiesHandlers();
	initializeRealtimeValidation();
	initializeOptionsListRules();
	initializeCalculatedFieldRules();
	initializeTemplatePreviewHandlers();
	
	initializeAlgorithmBuilder();
	
	initializeProjectSaveHandlers();
	initializeTableSaveHandlers();
	initializeFieldSaveHandlers();

	initializeRelationshipSaveHandlers();
	initializeLookupFieldSaveHandler();	
	
    // Setup Event Listeners
    const newProjectBtn = document.getElementById('new-project-btn');
    const saveNewProjectBtn = document.getElementById('save-new-project-btn');
    const newProjectNameInput = document.getElementById('new-project-name');
    const newProjectModal = document.getElementById('new-project-modal');
	const newProjectModalCloseBtn = document.getElementById('new-project-modal-close');
	
    const tutorialModal = document.getElementById('tutorial-modal');
    const closeTutorialBtn = document.getElementById('close-tutorial-modal-btn');
    const importSqlFileBtn = document.getElementById('import-sql-file-btn');
    const importSqlPasteBtn = document.getElementById('import-sql-paste-btn');
    const pasteSqlModal = document.getElementById('paste-sql-modal');
    const pasteSqlCloseBtn = document.getElementById('paste-sql-modal-close');
    const pasteSqlCancelBtn = document.getElementById('paste-sql-modal-cancel');
    const pasteSqlImportBtn = document.getElementById('paste-sql-modal-import-btn');

    if (newProjectBtn) newProjectBtn.addEventListener('click', () => newProjectModal.classList.remove('hidden'));

    if (newProjectModalCloseBtn) {
        newProjectModalCloseBtn.addEventListener('click', () => {
            newProjectModal.classList.add('hidden');
        });
    }
    
    if (saveNewProjectBtn) saveNewProjectBtn.addEventListener('click', async () => {
        const projectName = newProjectNameInput.value.trim();
        if (projectName) {
            const newProject = await window.electronAPI.createProject(projectName);
            if (newProject) {
                newProjectModal.classList.add('hidden');
                await loadProjectData(newProject);
            }
        } else {
            showCustomDialog({
                title: "Input Required",
                message: "Please enter a project name."
            });
        }
    });

    if (closeTutorialBtn) closeTutorialBtn.addEventListener('click', () => tutorialModal.classList.add('hidden'));

    if (importSqlFileBtn) importSqlFileBtn.addEventListener('click', () => {
        handleSqlImport(() => window.electronAPI.importSqlFile(activeProject.project_id));
    });

    if (importSqlPasteBtn) importSqlPasteBtn.addEventListener('click', () => pasteSqlModal.classList.remove('hidden'));
    if (pasteSqlCloseBtn) pasteSqlCloseBtn.addEventListener('click', () => pasteSqlModal.classList.add('hidden'));
    if (pasteSqlCancelBtn) pasteSqlCancelBtn.addEventListener('click', () => pasteSqlModal.classList.add('hidden'));

    if (pasteSqlImportBtn) pasteSqlImportBtn.addEventListener('click', () => {
        const sqlText = document.getElementById('sql-paste-area').value;
        if (sqlText.trim()) {
            pasteSqlModal.classList.add('hidden');
            handleSqlImport(() => window.electronAPI.importSqlText({ sql: sqlText, projectId: activeProject.project_id }));
        } else {
            showCustomDialog({
                title: "Input Required",
                message: "Please paste the SQL commands."
            });
        }
    });

	    // Aktifkan butang sidebar
    initializeSidebarButtons(); // <-- TAMBAH PANGGILAN INI	
    initializeSidebarInteractivity(); // PASTIKAN PANGGILAN INI WUJUD DI SINI
    // Mulakan aplikasi dengan cuba mendapatkan projek aktif dari DB
    const project = await window.electronAPI.getActiveProject();
    await loadProjectData(project);

});