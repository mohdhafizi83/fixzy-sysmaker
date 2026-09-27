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

/**
 * Sets the flag that the next menu save is for a newly created group.
 * @param {boolean} value New flag value.
 * @returns {void}
 */
export function setAwaitingMenuGroupSave(value) {
    appState.isAwaitingMenuGroupSave = value;
}

/**
 * Remembers the last active child table name in the sidebar.
 * @param {string} tableName Child table name.
 * @returns {void}
 */
export function setLastActiveChildTable(tableName) {
    appState.lastActiveChildTable = tableName;
}

/**
 * Enables or disables the core-structure locking guard in the app state.
 * @param {boolean} value Whether core locking is enabled.
 * @returns {void}
 */
export function setIsCoreLockingEnabled(value) {
    appState.isCoreLockingEnabled = value;
}

// Helper function to update the main data (useful for debugging later)
/**
 * Replaces the loaded project JSON and refreshes the cached table-name list.
 * @param {Object} data Full project data object with database.table map.
 * @returns {void}
 */
export function setProjectData(data) {
    appState.jsonData = data;
    if (data && data.database && data.database.table) {
        appState.allTableNames = Object.keys(data.database.table);
    }
}

/**
 * Stores the currently active project in the app state.
 * @param {Object} project Project record to mark active.
 * @returns {void}
 */
export function setActiveProject(project) {
    appState.activeProject = project;
}