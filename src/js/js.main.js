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
    initializeTableHookBuilder,
    initializeProjectHookBuilder,
    initializeLookupFieldSaveHandler,
	initializeAlgorithmBuilder,
	configureNewProjectModal,
    showNewProjectModal,
initializeCalculationBuilder,
initializeQueryBuilder,
} from './uiHandlers.js';

// KOD PENUH: Gantikan keseluruhan objek SaveManager sedia ada dengan yang ini.
// FIND AND REPLACE THIS ENTIRE OBJECT IN: js.main.js

export const SaveManager = {
    // 1. Tambah 'upserts: []' pada barisan simpanan
    saveQueue: {
        project: {}, tables: {}, fields: {}, relationships: {}, menus: null, upserts: []
    },
    debounceTimer: null,
    isProcessing: false,

    // 2. Kemas kini addToQueue untuk mengendalikan jenis 'upsertRelationship'
    addToQueue(type, id, data) {
        if (type === 'upsertRelationship') {
            this.saveQueue.upserts.push(data);
        } else if (type === 'menus') {
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
        
        this.isProcessing = true;
        const saveStatus = document.getElementById('save-status');
        saveStatus.textContent = 'Saving...';
        saveStatus.className = 'saving';

        try {
            const activeElementId = document.activeElement ? document.activeElement.id : null;
            const result = await window.electronAPI.batchUpdate(this.saveQueue);

            if (result.success) {
                console.log("[SaveManager] Kemas kini berkelompok berjaya.");

                let tableToFocus = null;
                let itemToSelect = null;

                const tablePage = document.getElementById('table-settings-page');
                const fieldPage = document.getElementById('field-settings-page');

                if (tablePage && !tablePage.classList.contains('hidden')) {
                    const originalTableName = tablePage.querySelector('.table-name')?.textContent;
                    if (originalTableName && jsonData.database.table[originalTableName]) {
                        const tableId = jsonData.database.table[originalTableName].table_id;
                        tableToFocus = this.saveQueue.tables[tableId]?.table_name || originalTableName;
                    }
                } else if (fieldPage && !fieldPage.classList.contains('hidden')) {
                    const nameParts = fieldPage.querySelector('.field-name')?.textContent.split('.');
                    const originalTableName = nameParts[0];
                    const originalFieldName = nameParts[1];
                    
                    if (originalTableName && originalFieldName && jsonData.database.table[originalTableName]?.fields[originalFieldName]) {
                        const fieldId = jsonData.database.table[originalTableName].fields[originalFieldName].field_id;
                        const fieldNameToFocus = this.saveQueue.fields[fieldId]?.field_name || originalFieldName;
                        
                        tableToFocus = originalTableName;
                        itemToSelect = { table: originalTableName, field: fieldNameToFocus };
                    }
                }

                const activeChildElement = document.querySelector('#tab-detail-parent-child .item-list li.active');
                if (activeChildElement) {
                    setLastActiveChildTable(activeChildElement.dataset.childName);
                }
                
                this.clearQueue();
                await loadProjectData(activeProject, tableToFocus, itemToSelect);

                if (activeElementId) {
                    const elementToFocus = document.getElementById(activeElementId);
                    if (elementToFocus) {
                        elementToFocus.focus();
                        if (typeof elementToFocus.selectionStart == "number") {
                            elementToFocus.selectionStart = elementToFocus.selectionEnd = elementToFocus.value.length;
                        }
                    }
                }

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
            setLastActiveChildTable(null); 
            setTimeout(() => saveStatus.textContent = '', 3000);
        }
    },

    // 3. Kemas kini clearQueue untuk reset 'upserts'
    clearQueue() {
        this.saveQueue = { project: {}, tables: {}, fields: {}, relationships: {}, menus: null, upserts: [] };
    },

    // 4. Kemas kini isQueueEmpty untuk memeriksa 'upserts'
    isQueueEmpty() {
        return (
            Object.keys(this.saveQueue.project).length === 0 &&
            Object.keys(this.saveQueue.tables).length === 0 &&
            Object.keys(this.saveQueue.fields).length === 0 &&
            Object.keys(this.saveQueue.relationships).length === 0 &&
            !this.saveQueue.menus &&
            this.saveQueue.upserts.length === 0
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
export let isAwaitingMenuGroupSave = false;
export function setAwaitingMenuGroupSave(value) {
    isAwaitingMenuGroupSave = value;
}
/**
 * Menetapkan nama child table yang aktif.
 * @param {string | null} tableName - Nama jadual atau null untuk reset.
 */
export function setLastActiveChildTable(tableName) {
    lastActiveChildTable = tableName;
}

// KOD PENUH: Gantikan fungsi loadProjectData sedia ada dengan yang ini.
export async function loadProjectData(project, tableToSelect = null, itemToSelect = null) {
    if (!project || !project.project_id) {
        configureNewProjectModal('first-run');
        document.getElementById('new-project-modal')?.classList.remove('hidden');
        // Pastikan input difokuskan juga dalam senario ini
        setTimeout(() => document.getElementById('new-project-name')?.focus(), 100);
        return;
    }
    
    const data = await window.electronAPI.getFullSchema(project.project_id);

    if (data && data.project && data.database) {
        console.log("%cLOG 1: Bendera 'isPopulatingData' dinaikkan kepada TRUE.", "color: blue; font-weight: bold;");
        isPopulatingData = true;

        activeProject = data.project;
        jsonData = data;
        
        allTableNames = Object.keys(jsonData.database.table || {});
        
        populateMainDashboard(activeProject);  
        populateMenuManagement(jsonData.database.menu_groups);
        document.getElementById('app-title').value = activeProject.app_title || 'Project Name';
        
        await generateSidebarMenu();
		
        if (itemToSelect && itemToSelect.field) {
            await focusOnSidebarField(itemToSelect.table, itemToSelect.field);
        } else if (tableToSelect) {
            setActiveSidebarLink(tableToSelect);
        }
        
        const tablesExistResult = await window.electronAPI.checkTablesExist(project.project_id);
        if (tablesExistResult && tablesExistResult.count === 0) {
            document.getElementById('tutorial-modal')?.classList.remove('hidden');
        }

        isPopulatingData = false;
        console.log("%cLOG 3: Bendera 'isPopulatingData' diturunkan kepada FALSE.", "color: blue; font-weight: bold;");

    } else {
        console.error("Gagal memuatkan data skema dari backend.");
    }
	
    await populateProjectDropdown();
}

// Fungsi untuk menguruskan import SQL
async function handleSqlImport(importFunction) {
    // NOTA: Arahan untuk memaparkan overlay telah dibuang dari sini.
    const overlay = document.getElementById('loading-overlay');
    try {
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
    } catch (error) {
        console.error("An unexpected error occurred during SQL import:", error);
        showCustomDialog({ title: "Error", message: `An unexpected error occurred: ${error.message}` });
    } finally {
        // Logik untuk menutup overlay ini masih betul dan dikekalkan.
        if (overlay) overlay.classList.add('loading-overlay-hidden');
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
initializeQueryBuilder();
    initializeTableHookBuilder();
    initializeProjectHookBuilder();
    initializeCalculationBuilder();
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

    if (newProjectBtn) {
        newProjectBtn.addEventListener('click', () => {
            const modal = document.getElementById('new-project-modal');
            const input = document.getElementById('new-project-name');
            if (modal && input) {
                modal.classList.remove('hidden');
                setTimeout(() => input.focus(), 50); // Tambah fokus selepas modal dipaparkan
            }
        });
    }

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
            
            // ▼▼▼ KEMAS KINI DI SINI ▼▼▼
            // Paparkan overlay sejurus sebelum proses import bermula
            const overlay = document.getElementById('loading-overlay');
            if (overlay) overlay.classList.remove('loading-overlay-hidden');
            // ▲▲▲ TAMAT KEMAS KINI ▲▲▲

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

    // Pasang pendengar untuk mesej 'show-overlay' dari proses utama
    if (window.electronAPI && typeof window.electronAPI.onShowOverlay === 'function') {
        window.electronAPI.onShowOverlay(() => {
            const overlay = document.getElementById('loading-overlay');
            if (overlay) {
                overlay.classList.remove('loading-overlay-hidden');
            }
        });
    }
});