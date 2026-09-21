// js/state.js

// Single object that holds all application data
export const appState = {
    isCoreLockingEnabled: true,
    jsonData: null,          // Critical project schema data
    allTableNames: [],       // List of table names
    activeProject: null,     // Current project info
    isAutoSaveEnabled: true,
    isPopulatingData: false, // Flag to prevent auto-save while loading
    lastActiveChildTable: null,
    isAwaitingMenuGroupSave: false
};

// --- Helper functions for setting values (Setters) ---

export function setAwaitingMenuGroupSave(value) {
    appState.isAwaitingMenuGroupSave = value;
}

export function setLastActiveChildTable(tableName) {
    appState.lastActiveChildTable = tableName;
}

export function setIsCoreLockingEnabled(value) {
    appState.isCoreLockingEnabled = value;
}

// Helper function to update the main data (useful for debugging later)
export function setProjectData(data) {
    appState.jsonData = data;
    if (data && data.database && data.database.table) {
        appState.allTableNames = Object.keys(data.database.table);
    }
}

export function setActiveProject(project) {
    appState.activeProject = project;
}