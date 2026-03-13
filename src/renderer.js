import { VALIDATION_RULES_CONFIG } from './js/validationRules.js';
import { generateSidebarMenu, initializeSidebarInteractivity, initializeSidebarButtons, setActiveSidebarLink, focusOnSidebarField } from './js/sidebar.js';
import { 
    updateActionButtonsState,  
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
initializeTableSaveHandlers,
    initializeFieldSaveHandlers,
    initializeModulesSetupTab,
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
	showImportErrorGuide,
	initializeCustomViews,
    initializeColumnGridHandlers,
    initializeUniqueFieldHandler,
    initializeConstraintsTabHandlers,
    initializeIndexCheckboxHandler,
    initializeDisplayTypeRules,
    initializeWrapTextRule,
    initializeMediaTypeDefaultRules,
    initializeDataTypeDefaultRules
} from './js/uiHandlers.js';

import { tenancyManager } from './js/features/tenancyManager.js';

import { initializeWorkflowBuilder } from './js/workflowBuilder.js';

import { openGeneralQueryBuilder } from './js/features/queryBuilder.js';

import { 
    initializeValidationInputHandlers, 
    toggleValidationInputs,
    saveValidationData 
} from './js/features/validation.js';

import { initializeRepeaterHandlers } from './js/features/repeater.js';

import { 
    populateTableSettings, 
    populateParentChildTab 
} from './js/pages/tableSettings.js';

import { 
    populateFieldSettings, 
    setupMediaTab 
} from './js/pages/fieldSettings.js';

import { showCustomDialog, initializeModalHandlers } from './js/ui/modalHandlers.js';
import { initializeTabSystems } from './js/ui/tabHandlers.js';
import { populateMainDashboard, initializeProjectSaveHandlers } from './js/pages/dashboard.js';

import { setElementValue, setRadioValue, applyFontSize } from './js/ui/formHelpers.js';

import { 
    appState, 
    setAwaitingMenuGroupSave, 
    setLastActiveChildTable, 
    setIsCoreLockingEnabled,
    setProjectData,
    setActiveProject
} from './js/state.js';
import { resolveVariables } from './js/utils.js';

import { SaveManager } from './js/saveManager.js';
export { SaveManager }; // Eksport semula supaya fail lain tak 'pecah'

window.VALIDATION_RULES_CONFIG = VALIDATION_RULES_CONFIG;
window.saveValidationData = saveValidationData;
window.toggleValidationInputs = toggleValidationInputs;
window.showCustomDialog = showCustomDialog;

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
        appState.isPopulatingData = true;

        appState.activeProject = data.project;
        appState.jsonData = data;
        appState.allTableNames = Object.keys(appState.jsonData.database.table || {});

        if (refreshMode === 'dataOnly') {
            appState.isPopulatingData = false;
            return;
        }
        
        if (refreshMode === 'full') {
            populateMainDashboard(appState.activeProject);  
            populateMenuManagement(appState.jsonData.database.unified_menu);
            document.getElementById('app-title').value = appState.activeProject.app_title || 'Project Name';
        }
        
        await generateSidebarMenu();
		
        if (itemToSelect && itemToSelect.field) {
            await focusOnSidebarField(itemToSelect.table, itemToSelect.field);
        } else if (tableToSelect) {
            setActiveSidebarLink(tableToSelect);
        }
        
        if (refreshMode === 'full') {
            // ▼▼▼ PERUBAHAN UTAMA DI SINI ▼▼▼
            const initialStatus = await window.electronAPI.getInitialProjectStatus(project.project_id);
            if (initialStatus && initialStatus.showTutorial) {
                document.getElementById('tutorial-modal')?.classList.remove('hidden');
            }
            // ▲▲▲ TAMAT PERUBAHAN ▲▲▲
        }

        appState.isPopulatingData = false;
    } else {
        console.error("Gagal memuatkan data skema dari backend.");
    }
    
// TAMBAH KOD INI: Pastikan UI Tenancy dipaparkan dengan betul mengikut projek aktif
        if (refreshMode === 'full' && typeof tenancyManager.refreshUIState === 'function') {
            tenancyManager.refreshUIState();
        }
	
    if (refreshMode === 'full') {
        await populateProjectDropdown();
    }
}

// Fungsi untuk menguruskan import SQL
async function handleSqlImport(importFunction, dialect) {
    const overlay = document.getElementById('loading-overlay');
    try {
        if (!appState.activeProject) {
            showCustomDialog({ title: "Error", message: "Please create or select a project first." });
            return;
        }

        // Terus panggil fungsi import. Backend akan menguruskan dialog pengesahan.
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
                SaveManager.addToQueue('project', appState.activeProject.project_id, {
                    stack_database: dbValue
                });
                await SaveManager.processQueue(); 
            }

            showCustomDialog({ title: "Success", message: result.message });
            await loadProjectData(appState.activeProject);
        } else if (result.message !== "Import cancelled by user.") {
            // Hanya tunjukkan panduan ralat jika ia bukan pembatalan oleh pengguna
            console.error("Import Failed:", result.message);
            showImportErrorGuide(); 
        }
    } catch (error) {
        console.error("An unexpected error occurred during SQL import:", error);
        showImportErrorGuide();
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

// FUNGSI BUTANG SHOW PREVIEW
const btnShowPreview = document.getElementById('btn-show-preview');
if (btnShowPreview) {
    btnShowPreview.addEventListener('click', async () => {
        const overlay = document.getElementById('loading-overlay');
        const loadingText = overlay ? overlay.querySelector('.loading-text') || { textContent: '' } : null;

        if (overlay) overlay.classList.remove('loading-overlay-hidden');
        if (loadingText) loadingText.textContent = "Menjana skrip dan menyediakan Persekitaran Pralihat...";

        // Panggil API Instant Preview dari main.js
        const result = await window.electronAPI.runInstantPreview();

        if (overlay) overlay.classList.add('loading-overlay-hidden');
        if (loadingText) loadingText.textContent = "Loading...";

        if (result.success) {
            // =========================================================
            // MULA: LOGIK MODAL IFRAME (Gantikan pelayar luar)
            // =========================================================
            const previewModal = document.getElementById('app-preview-modal');
            const previewIframe = document.getElementById('app-preview-iframe');
            const previewLoading = document.getElementById('app-preview-loading');
            const externalBtn = document.getElementById('app-preview-external-btn');
            const refreshBtn = document.getElementById('app-preview-refresh-btn');
            const closeBtn = document.getElementById('app-preview-modal-close');
            
            const backBtn = document.getElementById('app-preview-back-btn');
            const forwardBtn = document.getElementById('app-preview-forward-btn');

            if (previewModal && previewIframe) {
                // Paparkan modal gergasi dan tunjuk animasi loading putih
                previewModal.classList.remove('hidden');
                previewIframe.style.display = 'none';
                if (previewLoading) previewLoading.style.display = 'flex';
                
                // Semak URL terakhir webview sebelum ini
                let currentUrl = "";
                try {
                    currentUrl = previewIframe.getURL();
                } catch (e) {}

                // Jika webview sudah ada URL projek (contoh: sedang edit rekod), muat semula sahaja!
                if (currentUrl && currentUrl.includes('127.0.0.1')) {
                    previewIframe.reload(); 
                } else {
                    // Jika webview kosong (baru pertama kali buka), muatkan URL lalai (Dashboard)
                    previewIframe.src = result.url;
                }

// ==========================================
                // PENGESAN STATUS LOADING WEBVIEW
                // ==========================================
                
                // 1. Apabila Webview MULA memuatkan halaman (Klik link / Refresh / Back / Forward)
                previewIframe.addEventListener('did-start-loading', () => {
                    if (previewLoading) previewLoading.style.display = 'flex';
                });

                // 2. Apabila Webview SELESAI memuatkan halaman
                previewIframe.addEventListener('did-stop-loading', () => {
                    if (previewLoading) previewLoading.style.display = 'none';
                    // Pastikan webview dipaparkan
                    previewIframe.style.display = 'flex'; 
                });

                if (externalBtn) {
                    externalBtn.onclick = () => window.electronAPI.openUrl(result.url);
                }
                
                if (refreshBtn) {
                    refreshBtn.onclick = () => {
                        previewIframe.style.display = 'none';
                        if (previewLoading) previewLoading.style.display = 'flex';
                        // [UBAH SUAI 2]: Webview ada fungsi .reload() yang sebenar!
                        previewIframe.reload(); 
                    };
                }
                
// Logik Butang Undur (Back)
                if (backBtn) {
                    backBtn.onclick = () => {
                        if (previewIframe.canGoBack()) previewIframe.goBack();
                    };
                }

                // Logik Butang Maju (Forward)
                if (forwardBtn) {
                    forwardBtn.onclick = () => {
                        if (previewIframe.canGoForward()) previewIframe.goForward();
                    };
                }

                    if (closeBtn) {
                    closeBtn.onclick = () => {
                        // 1. Sembunyikan modal
                        previewModal.classList.add('hidden');
                        
                        // 2. Hentikan webview daripada berjalan di latar belakang
                        //previewIframe.src = "about:blank"; 
                        
                        // 3. BUNUH PELAYAN PHP!
                        //if (window.electronAPI.stopPreviewServer) {
                        //    window.electronAPI.stopPreviewServer();
                        //}
                    };
                }
            } else {
                console.error("Elemen Modal Iframe tidak dijumpai di index.html!");
            }
            // =========================================================
            // TAMAT: LOGIK MODAL IFRAME
            // =========================================================
            
        } else {
            showCustomDialog({
                title: "Ralat Pralihat",
                message: `Gagal memulakan pelayan: ${result.message}`
            });
        }
    });
}
    
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
        // KOD BARU:
        if (settings && settings.lock_core_components) {
            // Kita panggil fungsi setter yang diimport dari state.js
            setIsCoreLockingEnabled(settings.lock_core_components === '1'); 
        }
    } catch (error) {
        console.error("Gagal memuatkan tetapan awal:", error);
    }

    // Inisialisasi semua sistem UI
    initializeTabSystems();
    initializeModalHandlers();
    initializeMediaTabHandlers();
    initializeDisplayTypeRules();

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
	initializeUniqueFieldHandler();
    initializeValidationInputHandlers();
    initializeConstraintsTabHandlers();
    initializeRepeaterHandlers();
    initializeIndexCheckboxHandler();
	
	
	initializeProjectSaveHandlers();
initializeTableSaveHandlers();
    initializeFieldSaveHandlers();
    initializeModulesSetupTab();

	initializeRelationshipSaveHandlers();
	initializeLookupFieldSaveHandler();	
	
	initializeCustomViews();
    initializeColumnGridHandlers();
    initializeWrapTextRule();
    initializeMediaTypeDefaultRules();
    initializeDataTypeDefaultRules();

    tenancyManager.init();    
    
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
            handleSqlImport(() => window.electronAPI.importSqlFile({ projectId: appState.activeProject.project_id, dialect }), dialect);
        } else {
            const sqlText = document.getElementById('sql-paste-area').value;
            if (sqlText.trim()) {
                handleSqlImport(() => window.electronAPI.importSqlText({ sql: sqlText, projectId: appState.activeProject.project_id, dialect }), dialect);
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
	
// =================================================================
// Generator functions will be put here
// =================================================================
const generateAppBtn = document.getElementById('app-generate_app');
    const loadingOverlay = document.getElementById('loading-overlay');

    if (generateAppBtn) {
        generateAppBtn.addEventListener('click', async () => {
            if (loadingOverlay) {
                loadingOverlay.classList.remove('loading-overlay-hidden');
            }
            try {
                // Panggil backend
                const result = await window.electronAPI.generateApp();
                
                if (result.success) {
                    // Papar dialog kejayaan yang ringkas
                    // Pastikan guna 'result.folderPath' untuk elak 'undefined'
                    showCustomDialog({
                        title: "Success",
                        message: `Aplikasi berjaya dijana!\n\nLokasi fail:\n${result.folderPath}`
                    });

                    // Buka folder secara automatik
                    if (result.folderPath) {
                        window.electronAPI.openFolder(result.folderPath);
                    }

                } else {
                    // Papar ralat jika gagal
                    showCustomDialog({
                        title: "Error",
                        message: `Gagal menjana aplikasi: ${result.message}`
                    });
                }
            } catch (error) {
                console.error("Ralat IPC semasa menjana aplikasi:", error);
                showCustomDialog({
                    title: "System Error",
                    message: `Ralat tidak dijangka: ${error.message}`
                });
            } finally {
                if (loadingOverlay) {
                    loadingOverlay.classList.add('loading-overlay-hidden');
                }
            }
        });
    }
// =================================================================	
	
    // Mulakan aplikasi dengan cuba mendapatkan projek aktif dari DB
    const project = await window.electronAPI.getActiveProject();
    SaveManager.init(loadProjectData);
    await loadProjectData(project);
	initializeWorkflowBuilder();
    initializeFullscreenHandlers();

// Pasang pendengar untuk mesej 'show-overlay' dari proses utama
    if (window.electronAPI && typeof window.electronAPI.onShowOverlay === 'function') {
        window.electronAPI.onShowOverlay((data) => {
            const overlay = document.getElementById('loading-overlay');
            if (overlay) {
                overlay.classList.remove('loading-overlay-hidden');
                
                const textEl = document.getElementById('loading-text');
                const progContainer = document.getElementById('loading-progress-container');
                const progFill = document.getElementById('loading-progress-fill');
                const progText = document.getElementById('loading-progress-text'); // Tangkap elemen teks peratusan
                
                // Kemas kini teks dinamik
                if (textEl) {
                    textEl.textContent = (data && data.message) ? data.message : "Loading...";
                }
                
                // Papar dan gerakkan Progress Bar serta Teks Peratusan
                if (data && data.progress !== undefined && data.progress !== null) {
                    if (progContainer) progContainer.style.display = 'block';
                    if (progFill) progFill.style.width = data.progress + '%';
                    
                    if (progText) {
                        progText.style.display = 'block';
                        progText.textContent = data.progress + '%'; // Masukkan nilai peratusan (cth: "45%")
                    }
                } else {
                    // Sembunyikan bar dan teks peratusan jika operasi biasa
                    if (progContainer) progContainer.style.display = 'none';
                    if (progFill) progFill.style.width = '0%';
                    if (progText) progText.style.display = 'none';
                }
            }
        });
    }
    
    // Pasang pendengar untuk menutup overlay
    if (window.electronAPI && typeof window.electronAPI.onHideOverlay === 'function') {
        window.electronAPI.onHideOverlay(() => {
            const overlay = document.getElementById('loading-overlay');
            if (overlay) overlay.classList.add('loading-overlay-hidden');
        });
    }
    
// ADD THIS ENTIRE BLOCK in src/renderer.js inside the DOMContentLoaded listener

    // Listener for custom dialog requests from the main process
    window.electronAPI.onShowCustomDialog(async (options) => {
        const result = await showCustomDialog({
            title: options.message, // Map native 'message' to our modal's 'title'
            message: options.detail,  // Map native 'detail' to our modal's 'message'
            showCancelButton: (options.buttons && options.buttons.length > 1),
        });
        window.electronAPI.sendCustomDialogResponse(result);
    });
});

async function finalizeGeneratedApp(pathKeProjekBaharu) {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.remove('loading-overlay-hidden');
    
    // Tukar teks loading supaya pengguna tahu status terkini
    const loadingText = overlay.querySelector('.loading-text') || { textContent: '' };
    loadingText.textContent = "Memasang dependensi Composer (Ini mungkin mengambil masa)...";
    
    const success = await window.electronAPI.runComposer(pathKeProjekBaharu);
    
    if (success) {
        if (overlay) overlay.classList.add('loading-overlay-hidden');
        loadingText.textContent = "Loading..."; // Reset teks
        
        // Tanya pengguna jika mereka mahu terus membuat paparan (Preview)
        const isPreview = await showCustomDialog({
            title: "Janaan Berjaya!",
            message: "Aplikasi Filament anda telah siap dibina berserta dependensi.\n\nAdakah anda mahu melancarkan 'Preview Server' sekarang untuk menguji aplikasi ini?",
            showCancelButton: true
        });

        if (isPreview) {
            if (overlay) {
                overlay.classList.remove('loading-overlay-hidden');
                loadingText.textContent = "Menyediakan Pangkalan Data & Menghidupkan Pelayan...";
            }
            
            const serverResult = await window.electronAPI.startPreview(pathKeProjekBaharu);
            
            if (overlay) overlay.classList.add('loading-overlay-hidden');
            loadingText.textContent = "Loading...";

            if (serverResult.success) {
                // Tunjuk mesej beritahu kredensial log masuk
                await showCustomDialog({
                    title: "Server Sedang Berjalan",
                    message: "Aplikasi anda akan dibuka di pelayar (browser) sekarang.\n\nSila log masuk menggunakan:\nE-mel: admin@admin.com\nKatalaluan: password",
                });
                // Buka url di Chrome/Edge pengguna
                window.electronAPI.openUrl(serverResult.url);
            } else {
                showCustomDialog({
                    title: "Ralat Server",
                    message: `Gagal menghidupkan preview: ${serverResult.message}`
                });
            }
        }
    } else {
        if (overlay) overlay.classList.add('loading-overlay-hidden');
        showCustomDialog({
            title: "Ralat Composer",
            message: "Gagal memasang dependensi. Sila semak konsol untuk maklumat lanjut."
        });
    }
}