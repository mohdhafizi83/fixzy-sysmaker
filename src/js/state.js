// js/state.js

// Objek tunggal untuk menyimpan semua data aplikasi
export const appState = {
    isCoreLockingEnabled: true,
    jsonData: null,          // Data skema projek yang sangat penting
    allTableNames: [],       // Senarai nama jadual
    activeProject: null,     // Maklumat projek semasa
    isAutoSaveEnabled: true,
    isPopulatingData: false, // Flag untuk elak auto-save semasa loading
    lastActiveChildTable: null,
    isAwaitingMenuGroupSave: false
};

// --- Helper Functions untuk menetapkan nilai (Setters) ---

export function setAwaitingMenuGroupSave(value) {
    appState.isAwaitingMenuGroupSave = value;
}

export function setLastActiveChildTable(tableName) {
    appState.lastActiveChildTable = tableName;
}

export function setIsCoreLockingEnabled(value) {
    appState.isCoreLockingEnabled = value;
}

// Fungsi helper untuk kemas kini data utama (berguna untuk debug nanti)
export function setProjectData(data) {
    appState.jsonData = data;
    if (data && data.database && data.database.table) {
        appState.allTableNames = Object.keys(data.database.table);
    }
}

export function setActiveProject(project) {
    appState.activeProject = project;
}