// js/main.js (Proses Renderer)
import { generateSidebarMenu, initializeSidebarInteractivity, initializeSidebarButtons, setActiveSidebarLink } from './sidebar.js';
import { 
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
    populateProjectDropdown,
    initializeProjectSaveHandlers,
    initializeTableSaveHandlers,
    initializeFieldSaveHandlers,
    initializeRelationshipSaveHandlers,
    initializeLookupFieldSaveHandler  	
} from './uiHandlers.js';

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

// =================================================================
// ▼▼▼ FUNGSI UTAMA BAHARU UNTUK MEMUATKAN DATA PROJEK ▼▼▼
// =================================================================
export async function loadProjectData(project, tableToSelect = null) {
    if (!project || !project.project_id) {
        console.log("Tiada projek aktif, memaparkan modal projek baharu.");
        document.getElementById('new-project-modal')?.classList.remove('hidden');
        return;
    }
    
    activeProject = project;
    console.log(`Memuatkan data untuk projek: ${project.app_title} (ID: ${project.project_id})`);
	

    // Gantikan pembacaan data.json dengan panggilan ke backend SQLite
    const data = await window.electronAPI.getFullSchema(project.project_id);

    if (data && data.database) {
        jsonData = data;

        console.log('Data Skema Penuh Diterima:', jsonData);
        allTableNames = Object.keys(jsonData.database.table || {});

        // Panggil fungsi untuk mengisi Papan Pemuka Utama
        populateMainDashboard(activeProject);

        populateMenuManagement(jsonData.database.menu_groups);
		
        // Kemas kini UI dengan data yang diterima
        document.getElementById('app-title').value = jsonData.database.name || 'Project Name';
        
        // Jana semula menu sisi dan fungsikan interaktiviti
        await generateSidebarMenu();

        // Selepas menu dijana, cari dan klik pautan yang betul
        if (tableToSelect) {
setActiveSidebarLink(tableToSelect);
        }
        
        // Semak jika projek ini kosong untuk tunjukkan tutorial
        const tablesExistResult = await window.electronAPI.checkTablesExist(project.project_id);
        if (tablesExistResult && tablesExistResult.count === 0) {
            document.getElementById('tutorial-modal')?.classList.remove('hidden');
        }

    } else {
        console.error("Gagal memuatkan data skema dari backend.");
        // Mungkin boleh paparkan mesej ralat kepada pengguna di sini
    }
	
    // Panggil fungsi untuk kemas kini senarai projek dalam dropdown
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
    const tutorialModal = document.getElementById('tutorial-modal');
    const closeTutorialBtn = document.getElementById('close-tutorial-modal-btn');
    const importSqlFileBtn = document.getElementById('import-sql-file-btn');
    const importSqlPasteBtn = document.getElementById('import-sql-paste-btn');
    const pasteSqlModal = document.getElementById('paste-sql-modal');
    const pasteSqlCloseBtn = document.getElementById('paste-sql-modal-close');
    const pasteSqlCancelBtn = document.getElementById('paste-sql-modal-cancel');
    const pasteSqlImportBtn = document.getElementById('paste-sql-modal-import-btn');

    if (newProjectBtn) newProjectBtn.addEventListener('click', () => newProjectModal.classList.remove('hidden'));
    
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