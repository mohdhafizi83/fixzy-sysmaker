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
import { initApprovalTab } from './js/features/approvalManager.js';
import { initSchedulerTab } from './js/features/schedulerManager.js';
import { initPublicFormTab } from './js/features/publicFormManager.js';
import { initNumberingSection } from './js/features/numberingManager.js';
import { initImportSection } from './js/features/importManager.js';
import { initApiSection } from './js/features/apiManager.js';

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
import { initSetupWizard, maybeShowSetupWizard } from './js/setupWizard.js';
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

import { initDashboardBuilder } from './js/pages/dashboardBuilder.js';

import { SaveManager } from './js/saveManager.js';
export { SaveManager }; // Re-export so other files don't 'break'

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
            onOk: () => resolve(true),      // If OK, return 'true'
            onCancel: () => resolve(false)  // If Cancel, return 'false'
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
            initDashboardBuilder();
            document.getElementById('app-title').value = appState.activeProject.app_title || 'Project Name';
        }
        
        await generateSidebarMenu();
		
        if (itemToSelect && itemToSelect.field) {
            await focusOnSidebarField(itemToSelect.table, itemToSelect.field);
        } else if (tableToSelect) {
            setActiveSidebarLink(tableToSelect);
        }
        
        if (refreshMode === 'full') {
            // ▼▼▼ MAIN CHANGE HERE ▼▼▼
            const initialStatus = await window.electronAPI.getInitialProjectStatus(project.project_id);
            if (initialStatus && initialStatus.showTutorial) {
                document.getElementById('tutorial-modal')?.classList.remove('hidden');
            }
            // ▲▲▲ END CHANGE ▲▲▲
        }

        appState.isPopulatingData = false;
    } else {
        console.error("Failed to load schema data from backend.");
    }
    
// ADD THIS CODE: Make sure the Tenancy UI displays correctly according to the active project
        if (refreshMode === 'full' && typeof tenancyManager.refreshUIState === 'function') {
            tenancyManager.refreshUIState();
        }
	
    if (refreshMode === 'full') {
        await populateProjectDropdown();
    }
}

// Function to handle SQL imports
async function handleSqlImport(importFunction, dialect) {
    const overlay = document.getElementById('loading-overlay');
    try {
        if (!appState.activeProject) {
            showCustomDialog({ title: "Error", message: "Please create or select a project first." });
            return;
        }

        // Call the import function directly. The backend will handle the confirmation dialog.
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
            // Only show the error guide if it wasn't cancelled by the user
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
    // Helper function to handle button clicks, unchanged.
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

    // A SINGLE listener that handles ALL fullscreen logic.
    document.addEventListener('fullscreenchange', () => {
        const fullscreenEl = document.fullscreenElement;
        
        // ▼▼▼ START MODAL MOVEMENT LOGIC (MAIN IMPROVEMENT) ▼▼▼
        // Get references to ALL modals that may need to be displayed.
        const modalsToManage = [
            document.getElementById('algorithm-builder-modal'),
            document.getElementById('custom-alert-modal'),
            document.getElementById('query-helper-modal')
            // Add other modal IDs here if needed in the future
        ];

        if (fullscreenEl) {
            // When entering fullscreen, move all modals into the fullscreen element.
            modalsToManage.forEach(modal => {
                if (modal) {
                    fullscreenEl.appendChild(modal);
                }
            });
        } else {
            // When exiting fullscreen, return all modals to the body.
            modalsToManage.forEach(modal => {
                if (modal) {
                    document.body.appendChild(modal);
                }
            });
        }
        // ▲▲▲ END MODAL MOVEMENT LOGIC ▲▲▲

        // --- Existing logic for swapping the icon (now works correctly) ---
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

// Initialize the app
document.addEventListener('DOMContentLoaded', async () => {

// SHOW PREVIEW BUTTON FUNCTION
const btnShowPreview = document.getElementById('btn-show-preview');
if (btnShowPreview) {
    btnShowPreview.addEventListener('click', async () => {
        const overlay = document.getElementById('loading-overlay');
        const loadingText = overlay ? overlay.querySelector('.loading-text') || { textContent: '' } : null;

        if (overlay) overlay.classList.remove('loading-overlay-hidden');
        if (loadingText) loadingText.textContent = "Generating scripts and preparing the Preview environment...";

        // Call the Instant Preview API from main.js
        const result = await window.electronAPI.runInstantPreview();

        if (overlay) overlay.classList.add('loading-overlay-hidden');
        if (loadingText) loadingText.textContent = "Loading...";

        if (result.success) {
            // =========================================================
            // START: IFRAME MODAL LOGIC (replaces the external browser)
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
                // Show the giant modal and display the white loading animation
                previewModal.classList.remove('hidden');
                previewIframe.style.display = 'none';
                if (previewLoading) previewLoading.style.display = 'flex';
                
                // Check the webview's last URL
                let currentUrl = "";
                try {
                    currentUrl = previewIframe.getURL();
                } catch (e) {}

                // If the webview already has a project URL (e.g. editing a record), just reload it!
                if (currentUrl && currentUrl.includes('127.0.0.1')) {
                    previewIframe.reload(); 
                } else {
                    // If the webview is empty (first time opening), load the default URL (Dashboard)
                    previewIframe.src = result.url;
                }

// ==========================================
                // WEBVIEW LOADING STATUS TRACKER
                // ==========================================
                
                // 1. When the webview STARTS loading a page (link click / refresh / back / forward)
                previewIframe.addEventListener('did-start-loading', () => {
                    if (previewLoading) previewLoading.style.display = 'flex';
                });

                // 2. When the webview FINISHES loading a page
                previewIframe.addEventListener('did-stop-loading', () => {
                    if (previewLoading) previewLoading.style.display = 'none';
                    // Make sure the webview is displayed
                    previewIframe.style.display = 'flex'; 
                });

                if (externalBtn) {
                    externalBtn.onclick = () => window.electronAPI.openUrl(result.url);
                }
                
                if (refreshBtn) {
                    refreshBtn.onclick = () => {
                        previewIframe.style.display = 'none';
                        if (previewLoading) previewLoading.style.display = 'flex';
                        // [CUSTOMIZATION 2]: The webview has a real .reload() function!
                        previewIframe.reload(); 
                    };
                }
                
// Back button logic
                if (backBtn) {
                    backBtn.onclick = () => {
                        if (previewIframe.canGoBack()) previewIframe.goBack();
                    };
                }

                // Forward button logic
                if (forwardBtn) {
                    forwardBtn.onclick = () => {
                        if (previewIframe.canGoForward()) previewIframe.goForward();
                    };
                }

                    if (closeBtn) {
                    closeBtn.onclick = () => {
                        // 1. Hide the modal
                        previewModal.classList.add('hidden');
                        
                        // 2. Stop the webview from running in the background
                        //previewIframe.src = "about:blank"; 
                        
                        // 3. KILL THE PHP SERVER!
                        //if (window.electronAPI.stopPreviewServer) {
                        //    window.electronAPI.stopPreviewServer();
                        //}
                    };
                }
            } else {
                console.error("Iframe modal element not found in index.html!");
            }
            // =========================================================
            // END: IFRAME MODAL LOGIC
            // =========================================================
            
        } else {
            showCustomDialog({
                title: "Preview Error",
                message: `Failed to start the server: ${result.message}`
            });
        }
    });
}
    
// Safety net to prevent data loss on reload/close
window.addEventListener('beforeunload', (event) => {
    // Check if there are any changes waiting in the queue
    if (!SaveManager.isQueueEmpty()) {
        // This line makes the browser show a confirmation dialog
        event.preventDefault();
        event.returnValue = ''; // Required for some browsers
    }
});
	
    try {
        const settings = await window.electronAPI.getAllSettings();
        if (settings && settings.font_size) {
            applyFontSize(settings.font_size);
        }
        // NEW CODE:
        if (settings && settings.lock_core_components) {
            // We call the setter function imported from state.js
            setIsCoreLockingEnabled(settings.lock_core_components === '1'); 
        }
    } catch (error) {
        console.error("Failed to load initial settings:", error);
    }

    // Initialize all UI systems
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
	initApprovalTab();
	initSchedulerTab();
	initPublicFormTab();
	initNumberingSection();
	initImportSection();
	initApiSection();
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
                setTimeout(() => input.focus(), 50); // Add focus after the modal is shown
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

    // Updated SQL import handler
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

	    // Enable the sidebar buttons
    initializeSidebarButtons(); // <-- ADD THIS CALL	
    initializeSidebarInteractivity(); // MAKE SURE THIS CALL EXISTS HERE
	
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
                // Call the backend
                const result = await window.electronAPI.generateApp();
                
                if (result.success) {
                    // Show a simple success dialog
                    // Make sure to use 'result.folderPath' to avoid 'undefined'
                    showCustomDialog({
                        title: "Success",
                        message: `Application generated successfully!\n\nFile location:\n${result.folderPath}`
                    });

                    // Open the folder automatically
                    if (result.folderPath) {
                        window.electronAPI.openFolder(result.folderPath);
                    }

                } else {
                    // Show an error if it failed
                    showCustomDialog({
                        title: "Error",
                        message: `Failed to generate the application: ${result.message}`
                    });
                }
            } catch (error) {
                console.error("IPC error while generating the application:", error);
                showCustomDialog({
                    title: "System Error",
                    message: `Unexpected error: ${error.message}`
                });
            } finally {
                if (loadingOverlay) {
                    loadingOverlay.classList.add('loading-overlay-hidden');
                }
            }
        });
    }

    // "View files" button: open the most recently generated app folder.
    const viewFilesBtn = document.getElementById('app-view_files');
    if (viewFilesBtn) {
        viewFilesBtn.addEventListener('click', async () => {
            try {
                const result = await window.electronAPI.openLatestGenerated();
                if (result.success) {
                    showCustomDialog({
                        title: "Generated files",
                        message: `Latest generated application:\n${result.folderPath}`
                    });
                } else {
                    showCustomDialog({ title: "View files", message: result.message });
                }
            } catch (error) {
                showCustomDialog({ title: "Error", message: `Could not open generated folder: ${error.message}` });
            }
        });
    }
// =================================================================
	
    // Start the app by trying to get the active project from the DB
    const project = await window.electronAPI.getActiveProject();
    SaveManager.init(loadProjectData);
    await loadProjectData(project);
	initializeWorkflowBuilder();
    initializeFullscreenHandlers();

    // Setup Wizard: init the header button, then auto-open on first run
    // if the environment (PHP/Composer/preview env) is not ready yet.
    initSetupWizard();
    maybeShowSetupWizard();

// Attach a listener for 'show-overlay' messages from the main process
    if (window.electronAPI && typeof window.electronAPI.onShowOverlay === 'function') {
        window.electronAPI.onShowOverlay((data) => {
            const overlay = document.getElementById('loading-overlay');
            if (overlay) {
                overlay.classList.remove('loading-overlay-hidden');
                
                const textEl = document.getElementById('loading-text');
                const progContainer = document.getElementById('loading-progress-container');
                const progFill = document.getElementById('loading-progress-fill');
                const progText = document.getElementById('loading-progress-text'); // Capture the percentage text element
                
                // Update the dynamic text
                if (textEl) {
                    textEl.textContent = (data && data.message) ? data.message : "Loading...";
                }
                
                // Show and animate the progress bar and percentage text
                if (data && data.progress !== undefined && data.progress !== null) {
                    if (progContainer) progContainer.style.display = 'block';
                    if (progFill) progFill.style.width = data.progress + '%';
                    
                    if (progText) {
                        progText.style.display = 'block';
                        progText.textContent = data.progress + '%'; // Insert the percentage value (e.g. "45%")
                    }
                } else {
                    // Hide the bar and percentage text for regular operations
                    if (progContainer) progContainer.style.display = 'none';
                    if (progFill) progFill.style.width = '0%';
                    if (progText) progText.style.display = 'none';
                }
            }
        });
    }
    
    // Attach a listener to close the overlay
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
    
    // Change the loading text so the user knows the current status
    const loadingText = overlay.querySelector('.loading-text') || { textContent: '' };
    loadingText.textContent = "Installing Composer dependencies (this may take a while)...";
    
    const success = await window.electronAPI.runComposer(pathKeProjekBaharu);
    
    if (success) {
        if (overlay) overlay.classList.add('loading-overlay-hidden');
        loadingText.textContent = "Loading..."; // Reset the text
        
        // Ask the user if they want to go straight to the Preview
        const isPreview = await showCustomDialog({
            title: "Generation Successful!",
            message: "Your Filament app has been built with its dependencies.\n\nWould you like to launch the 'Preview Server' now to test this app?",
            showCancelButton: true
        });

        if (isPreview) {
            if (overlay) {
                overlay.classList.remove('loading-overlay-hidden');
                loadingText.textContent = "Preparing the Database & Starting the Server...";
            }
            
            const serverResult = await window.electronAPI.startPreview(pathKeProjekBaharu);
            
            if (overlay) overlay.classList.add('loading-overlay-hidden');
            loadingText.textContent = "Loading...";

            if (serverResult.success) {
                // Show a message with the login credentials
                await showCustomDialog({
                    title: "Server Running",
                    message: "Your app will now open in the browser.\n\nPlease log in using:\nEmail: admin@admin.com\nPassword: password",
                });
                // Open the URL in the user's Chrome/Edge
                window.electronAPI.openUrl(serverResult.url);
            } else {
                showCustomDialog({
                    title: "Server Error",
                    message: `Failed to start the preview: ${serverResult.message}`
                });
            }
        }
    } else {
        if (overlay) overlay.classList.add('loading-overlay-hidden');
        showCustomDialog({
            title: "Composer Error",
            message: "Failed to install dependencies. Please check the console for more information."
        });
    }
}