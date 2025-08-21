// js/main.js (Proses Renderer)
import { generateSidebarMenu, initializeSidebarInteractivity } from './sidebar.js';
import { 
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
	populateMainDashboard 	
} from './uiHandlers.js';

// Pembolehubah global untuk menyimpan data projek semasa dan pengurusan UI
export let jsonData = null;
export let allTableNames = [];
let activeProject = null;

// =================================================================
// ▼▼▼ FUNGSI UTAMA BAHARU UNTUK MEMUATKAN DATA PROJEK ▼▼▼
// =================================================================
async function loadProjectData(project) {
    if (!project || !project.project_id) {
        console.log("Tiada projek aktif, memaparkan modal projek baharu.");
        document.getElementById('new-project-modal')?.classList.remove('hidden');
        return;
    }
    
    activeProject = project;
    console.log(`Memuatkan data untuk projek: ${project.app_title} (ID: ${project.project_id})`);
	populateMainDashboard(activeProject);

    // Gantikan pembacaan data.json dengan panggilan ke backend SQLite
    const data = await window.electronAPI.getFullSchema(project.project_id);

    if (data && data.database) {
        jsonData = data;

        console.log('Data Skema Penuh Diterima:', jsonData);
        allTableNames = Object.keys(jsonData.database.table || {});

        // Kemas kini UI dengan data yang diterima
        document.getElementById('app-title').value = jsonData.database.name || 'Project Name';
        
        // Jana semula menu sisi dan fungsikan interaktiviti
        await generateSidebarMenu();
        initializeSidebarInteractivity();
        
        // Semak jika projek ini kosong untuk tunjukkan tutorial
        const tablesExistResult = await window.electronAPI.checkTablesExist(project.project_id);
        if (tablesExistResult && tablesExistResult.count === 0) {
            document.getElementById('tutorial-modal')?.classList.remove('hidden');
        }

    } else {
        console.error("Gagal memuatkan data skema dari backend.");
        // Mungkin boleh paparkan mesej ralat kepada pengguna di sini
    }
}

// Fungsi untuk menguruskan import SQL
async function handleSqlImport(importFunction) {
    if (!activeProject) {
        alert("Sila cipta atau pilih projek terlebih dahulu.");
        return;
    }

    // Semak jika sudah ada jadual
    const tablesExistResult = await window.electronAPI.checkTablesExist(activeProject.project_id);
    if (tablesExistResult && tablesExistResult.count > 0) {
        const userConfirmed = confirm("Projek ini sudah mempunyai jadual. Mengimport skema baharu akan MEMADAM SEMUA jadual dan medan sedia ada. Teruskan?");
        if (!userConfirmed) {
            return;
        }
        // Padam skema lama
        await window.electronAPI.deleteProjectSchema(activeProject.project_id);
    }
    
    // Laksanakan fungsi import
    const result = await importFunction();

    if (result.success) {
        alert(result.message);
        // Muat semula data projek untuk memaparkan jadual baharu
        await loadProjectData(activeProject);
    } else {
        alert(`Import gagal: ${result.message}`);
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
            alert("Sila masukkan nama projek.");
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
            alert("Sila tampal arahan SQL.");
        }
    });

    // Mulakan aplikasi dengan cuba mendapatkan projek aktif dari DB
    const project = await window.electronAPI.getActiveProject();
    await loadProjectData(project);
});