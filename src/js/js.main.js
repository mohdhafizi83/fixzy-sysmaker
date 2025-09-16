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
	initializeStackSelectorHandlers,
	initializeAuthRadioLogic,
	showImportErrorGuide
} from './uiHandlers.js';
import { initializeWorkflowBuilder } from './workflowBuilder.js';

// FIND AND REPLACE THIS ENTIRE OBJECT IN: js.main.js

export const SaveManager = {
    saveQueue: {
        project: {}, tables: {}, fields: {}, relationships: {}, upserts: [], relationshipDeletes: []
    },
    debounceTimer: null,
    isProcessing: false,

    addToQueue(type, id, data) {
        if (type === 'upsertRelationship') {
            this.saveQueue.upserts.push(data);
        } else if (type === 'deleteRelationship') {
            this.saveQueue.relationshipDeletes.push(data);
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
            
            // Semak jika terdapat perubahan nama SEBELUM menyimpan
            const isRename = (this.saveQueue.tables && Object.values(this.saveQueue.tables).some(t => t.hasOwnProperty('table_name'))) ||
                             (this.saveQueue.fields && Object.values(this.saveQueue.fields).some(f => f.hasOwnProperty('field_name')));

            const result = await window.electronAPI.batchUpdate(this.saveQueue);

            if (result.success) {
                console.log("[SaveManager] Kemas kini berkelompok berjaya.");

                if (isRename) {
                    // JIKA ADA PERUBAHAN NAMA: Muat semula sidebar sahaja
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
                            
                            const tableId = jsonData.database.table[originalTableName].table_id;
                            const tableNameToFocus = this.saveQueue.tables[tableId]?.table_name || originalTableName;

                            itemToSelect = { table: tableNameToFocus, field: fieldNameToFocus };
                        }
                    }
                    
                    this.clearQueue();
                    // ▼▼▼ MULA PEMBETULAN ▼▼▼
                    // Panggil loadProjectData dengan parameter yang betul
                    await loadProjectData(activeProject, { tableToSelect: tableToFocus, itemToSelect, refreshMode: 'sidebarOnly' });
                    // ▲▲▲ TAMAT PEMBETULAN ▲▲▲

                } else {
                    // JIKA TIADA PERUBAHAN NAMA: Hanya bersihkan queue, tiada muat semula UI
                    this.clearQueue();
                }

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
            
            if (isAwaitingMenuGroupSave) {
                const overlay = document.getElementById('loading-overlay');
                if (overlay) {
                    overlay.classList.add('loading-overlay-hidden');
                }
                setAwaitingMenuGroupSave(false);
            }

            setLastActiveChildTable(null); 
            setTimeout(() => {
                if (saveStatus.textContent === 'All changes saved ✔' || saveStatus.textContent === 'Save failed!') {
                    saveStatus.textContent = '';
                }
            }, 3000);

            if (!this.isQueueEmpty()) {
                setTimeout(() => this.processQueue(), 50);
            }
        }
    },

    clearQueue() {
        this.saveQueue = { project: {}, tables: {}, fields: {}, relationships: {}, upserts: [], relationshipDeletes: [] };
    },

    isQueueEmpty() {
        return (
            Object.keys(this.saveQueue.project).length === 0 &&
            Object.keys(this.saveQueue.tables).length === 0 &&
            Object.keys(this.saveQueue.fields).length === 0 &&
            Object.keys(this.saveQueue.relationships).length === 0 &&
            this.saveQueue.upserts.length === 0 &&
            this.saveQueue.relationshipDeletes.length === 0
        );
    }
};

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
export async function loadProjectData(project, options = {}) {
    const { tableToSelect = null, itemToSelect = null, refreshMode = 'full' } = options;

    if (!project || !project.project_id) {
        configureNewProjectModal('first-run');
        document.getElementById('new-project-modal')?.classList.remove('hidden');
        setTimeout(() => document.getElementById('new-project-name')?.focus(), 100);
        return;
    }
    
    const data = await window.electronAPI.getFullSchema(project.project_id);

    if (data && data.project && data.database) {
        console.log(`LOG 1: Bendera 'isPopulatingData' dinaikkan kepada TRUE. Mod: ${refreshMode}`);
        isPopulatingData = true;

        activeProject = data.project;
        jsonData = data;
        allTableNames = Object.keys(jsonData.database.table || {});
        
        // Hanya populate borang utama jika dalam mod 'full'
        if (refreshMode === 'full') {
            populateMainDashboard(activeProject);  
            populateMenuManagement(jsonData.database.unified_menu);
            document.getElementById('app-title').value = activeProject.app_title || 'Project Name';
        }
        
        // Sidebar sentiasa dijana semula untuk memastikan ia terkini
        await generateSidebarMenu();
		
        // Logik pemilihan semula item di sidebar sentiasa berjalan
        if (itemToSelect && itemToSelect.field) {
            await focusOnSidebarField(itemToSelect.table, itemToSelect.field);
        } else if (tableToSelect) {
            setActiveSidebarLink(tableToSelect);
        }
        
        // Hanya tunjuk modal tutorial pada muat penuh kali pertama
        if (refreshMode === 'full') {
            const tablesExistResult = await window.electronAPI.checkTablesExist(project.project_id);
            if (tablesExistResult && tablesExistResult.count === 0) {
                document.getElementById('tutorial-modal')?.classList.remove('hidden');
            }
        }

        isPopulatingData = false;
        console.log("LOG 3: Bendera 'isPopulatingData' diturunkan kepada FALSE.");

    } else {
        console.error("Gagal memuatkan data skema dari backend.");
    }
	
    // Hanya populate dropdown projek pada muat penuh
    if (refreshMode === 'full') {
        await populateProjectDropdown();
    }
}

// Fungsi untuk menguruskan import SQL
async function handleSqlImport(importFunction, dialect) {
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
            const dialectToDbValueMap = {
                'MySQL': 'mysql_mariadb',
                'PostgreSQL': 'postgresql',
                'TSQL': 'sql_server',
                'SQLite': 'sqlite'
            };
            const dbValue = dialectToDbValueMap[dialect];

            if (dbValue) {
                SaveManager.addToQueue('project', activeProject.project_id, {
                    stack_database: dbValue
                });
                await SaveManager.processQueue(); 
            }

            showCustomDialog({ title: "Success", message: result.message });
            await loadProjectData(activeProject);
        } else {
            // ▼▼▼ PERUBAHAN UTAMA DI SINI ▼▼▼
            // Jika import gagal, paparkan modal panduan dan bukannya dialog biasa.
            console.error("Import Failed:", result.message); // Simpan log ralat teknikal untuk debug
            showImportErrorGuide(); 
            // ▲▲▲ TAMAT PERUBAHAN ▲▲▲
        }
    } catch (error) {
        console.error("An unexpected error occurred during SQL import:", error);
        showImportErrorGuide(); // Paparkan panduan juga jika terdapat ralat tidak dijangka
    } finally {
        if (overlay) overlay.classList.add('loading-overlay-hidden');
    }
}

function initializeFullscreenHandlers() {
    // Fungsi bantuan untuk mengendalikan klik butang, ia kekal sama.
    const setupClickListener = (buttonId, containerId) => {
        const button = document.getElementById(buttonId);
        const container = document.getElementById(containerId);
        if (!button || !container) return;
        
        button.addEventListener('click', () => {
            if (!document.fullscreenElement) {
                container.requestFullscreen().catch(err => {
                    alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
                });
            } else {
                document.exitFullscreen();
            }
        });
    };

    setupClickListener('project-fullscreen-btn', 'project-workflow-container');
    setupClickListener('table-fullscreen-btn', 'table-workflow-container');

    // SATU listener tunggal yang menguruskan SEMUA logik fullscreen.
    document.addEventListener('fullscreenchange', () => {
        const fullscreenEl = document.fullscreenElement;
        
        // ▼▼▼ MULA LOGIK PEMINDAHAN MODAL (PEMBAIKAN UTAMA) ▼▼▼
        // Dapatkan rujukan kepada SEMUA modal yang mungkin perlu dipaparkan.
        const modalsToManage = [
            document.getElementById('algorithm-builder-modal'),
            document.getElementById('custom-alert-modal'),
            document.getElementById('query-helper-modal')
            // Tambah ID modal lain di sini jika perlu pada masa hadapan
        ];

        if (fullscreenEl) {
            // Apabila masuk fullscreen, pindahkan semua modal ke dalam elemen fullscreen.
            modalsToManage.forEach(modal => {
                if (modal) {
                    fullscreenEl.appendChild(modal);
                }
            });
        } else {
            // Apabila keluar fullscreen, kembalikan semua modal ke body.
            modalsToManage.forEach(modal => {
                if (modal) {
                    document.body.appendChild(modal);
                }
            });
        }
        // ▲▲▲ TAMAT LOGIK PEMINDAHAN MODAL ▲▲▲

        // --- Logik sedia ada untuk menukar ikon (kini akan berfungsi dengan betul) ---
        const project = {
            container: document.getElementById('project-workflow-container'),
            icon: document.querySelector('#project-fullscreen-btn i')
        };
        const table = {
            container: document.getElementById('table-workflow-container'),
            icon: document.querySelector('#table-fullscreen-btn i')
        };
        
        const setIconState = (iconEl, isFullscreen) => {
            if (!iconEl) return;
            if (isFullscreen) {
                iconEl.classList.remove('fa-expand-arrows-alt');
                iconEl.classList.add('fa-compress-arrows-alt');
            } else {
                iconEl.classList.remove('fa-expand-arrows-alt');
                iconEl.classList.add('fa-compress-arrows-alt');
            }
        };

        setIconState(project.icon, fullscreenEl === project.container);
        setIconState(table.icon, fullscreenEl === table.container);
    });
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
	initializeStackSelectorHandlers();
	initializeAuthRadioLogic();
	
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

    // Pengendali Import SQL yang diperbaharui
    const importSqlModal = document.getElementById('import-sql-modal');
    const importSqlModalTitle = document.getElementById('import-sql-modal-title');
    const importSqlCloseBtn = document.getElementById('import-sql-modal-close');
    const importSqlCancelBtn = document.getElementById('import-sql-modal-cancel');
    const importSqlImportBtn = document.getElementById('import-sql-modal-import-btn');
    const importSqlDialectSelect = document.getElementById('import-sql-dialect');
    const importSqlTextGroup = document.getElementById('import-sql-text-group');
    const importSqlFileGroup = document.getElementById('import-sql-file-group');

    const openImportModal = (mode) => {
        importSqlModal.dataset.mode = mode;
        if (mode === 'file') {
            importSqlModalTitle.textContent = 'Import SQL from File';
            importSqlTextGroup.classList.add('hidden');
            importSqlFileGroup.classList.remove('hidden');
        } else {
            importSqlModalTitle.textContent = 'Import SQL via Copy/Paste';
            importSqlTextGroup.classList.remove('hidden');
            importSqlFileGroup.classList.add('hidden');
        }
        importSqlModal.classList.remove('hidden');
    };

    if (importSqlFileBtn) importSqlFileBtn.addEventListener('click', () => openImportModal('file'));
    if (importSqlPasteBtn) importSqlPasteBtn.addEventListener('click', () => openImportModal('text'));

    const closeImportModal = () => importSqlModal.classList.add('hidden');
    if (importSqlCloseBtn) importSqlCloseBtn.addEventListener('click', closeImportModal);
    if (importSqlCancelBtn) importSqlCancelBtn.addEventListener('click', closeImportModal);

if (importSqlImportBtn) {
    importSqlImportBtn.addEventListener('click', () => {
        const mode = importSqlModal.dataset.mode;
        const dialect = importSqlDialectSelect.value;
        const overlay = document.getElementById('loading-overlay');

        if (overlay) overlay.classList.remove('loading-overlay-hidden');
        closeImportModal();

        if (mode === 'file') {
            handleSqlImport(() => window.electronAPI.importSqlFile({ projectId: activeProject.project_id, dialect }), dialect);
        } else {
            const sqlText = document.getElementById('sql-paste-area').value;
            if (sqlText.trim()) {
                handleSqlImport(() => window.electronAPI.importSqlText({ sql: sqlText, projectId: activeProject.project_id, dialect }), dialect);
            } else {
                if (overlay) overlay.classList.add('loading-overlay-hidden');
                showCustomDialog({ title: "Input Required", message: "Please paste the SQL commands." });
            }
        }
    });
}

	    // Aktifkan butang sidebar
    initializeSidebarButtons(); // <-- TAMBAH PANGGILAN INI	
    initializeSidebarInteractivity(); // PASTIKAN PANGGILAN INI WUJUD DI SINI
    // Mulakan aplikasi dengan cuba mendapatkan projek aktif dari DB
    const project = await window.electronAPI.getActiveProject();
    await loadProjectData(project);
	initializeWorkflowBuilder();
    initializeFullscreenHandlers();
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

/**
 * Mencari dan menggantikan semua placeholder '##variable.nama##' dalam satu rentetan
 * dengan nilai sebenar daripada objek skop.
 * @param {string} configString - Rentetan JSON konfigurasi untuk blok Action atau Condition.
 * @param {object} variableScope - Objek yang menyimpan nilai-nilai pembolehubah, cth: { nama_anda: 'Ali', umur: 30 }.
 * @returns {string} Rentetan JSON baharu dengan semua pembolehubah telah digantikan.
 */
function resolveVariables(configString, variableScope) {
    if (!configString || !variableScope) {
        return configString;
    }

    // Regular Expression untuk mencari corak ##variable.namaPembolehubah##
    // (\w+) menangkap nama pembolehubah (hanya huruf, nombor, dan garis bawah)
    const variableRegex = /##variable\.(\w+)##/g;

    return configString.replace(variableRegex, (match, variableName) => {
        // 'match' adalah keseluruhan rentetan, cth: "##variable.kuota_kursus##"
        // 'variableName' adalah bahagian yang ditangkap, cth: "kuota_kursus"

        // Semak jika pembolehubah wujud dalam skop kita
        if (Object.prototype.hasOwnProperty.call(variableScope, variableName)) {
            // Gantikan dengan nilai sebenar. 
            // Kita JSON.stringify nilai itu untuk memastikan ia dimasukkan sebagai rentetan JSON yang sah,
            // ini penting jika nilainya adalah objek atau rentetan yang mengandungi petikan.
            // Kita buang petikan luar jika ia adalah rentetan mudah.
            const value = variableScope[variableName];
            if (typeof value === 'string') {
                return value.replace(/'/g, "\\'"); // Escape single quotes for SQL safety
            }
            return value;
        }

        // Jika pembolehubah tidak ditemui, kembalikan placeholder asal supaya mudah dinyahtralat.
        console.warn(`Pembolehubah tidak ditemui dalam skop: ${variableName}`);
        return match;
    });
}