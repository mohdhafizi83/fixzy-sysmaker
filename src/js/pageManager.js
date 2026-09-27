// src/js/pageManager.js
//
// Switches between the three top-level renderer pages: dashboard, table settings, field settings.

const mainDashboardPage = document.getElementById('main-dashboard-page');
const tableSettingsPage = document.getElementById('table-settings-page');
const fieldSettingsPage = document.getElementById('field-settings-page');

/**
 * Shows exactly one top-level page and hides the other two.
 * @param {('main-dashboard'|'table-settings'|'field-settings')} pageName Page to display.
 * @returns {void}
 */
export function showPage(pageName) {
    if (!mainDashboardPage || !tableSettingsPage || !fieldSettingsPage) return;
    
    mainDashboardPage.classList.add('hidden');
    tableSettingsPage.classList.add('hidden');
    fieldSettingsPage.classList.add('hidden');

    if (pageName === 'main-dashboard') {
        mainDashboardPage.classList.remove('hidden');
    } else if (pageName === 'table-settings') {
        tableSettingsPage.classList.remove('hidden');
    } else if (pageName === 'field-settings') {
        fieldSettingsPage.classList.remove('hidden');
    }
}