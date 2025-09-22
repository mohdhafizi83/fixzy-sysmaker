const mainDashboardPage = document.getElementById('main-dashboard-page');
const tableSettingsPage = document.getElementById('table-settings-page');
const fieldSettingsPage = document.getElementById('field-settings-page');

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