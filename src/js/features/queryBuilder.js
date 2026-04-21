import { showConfigurableQueryBuilder } from '../handlers/logicBuilderHandlers.js';
/**
 * Membuka Query Builder dalam mod 'general'.
 * Kini menyokong parameter khusus untuk Dashboard Builder.
 */
export function openGeneralQueryBuilder(targetTextarea, overrideTableName = null, customCallback = null) {
    let tableName = overrideTableName; // Guna jadual yang dihantar jika ada
    
    const fieldPage = document.getElementById('field-settings-page');
    const tablePage = document.getElementById('table-settings-page');

    // Jika tiada overrideTableName, guna logik asal untuk cari di UI
    if (!tableName) {
        if (fieldPage && !fieldPage.classList.contains('hidden')) {
            [tableName] = fieldPage.querySelector('.field-name')?.textContent.split('.') || [];
        } else if (tablePage && !tablePage.classList.contains('hidden')) {
            tableName = tablePage.querySelector('.table-name')?.textContent;
        }
    }

    if (!tableName) {
        showCustomDialog({ title: "Error", message: "Please select a table or a field first to open the Query Builder." });
        return;
    }

    let initialState = null;
    if (targetTextarea) {
        // Logik asal: Cari input state tersembunyi
        const stateInput = targetTextarea.parentElement ? targetTextarea.parentElement.querySelector('.query-builder-state') : null;
        if (stateInput) {
            initialState = stateInput.value || null;
        } else {
            // Logik baharu untuk Dashboard: Baca terus dari input itu sendiri
            initialState = targetTextarea.value || null;
        }
    }

    showConfigurableQueryBuilder({
        mode: 'general',
        tableName: tableName,
        initialState: initialState,
        onComplete: (sql, state) => {
            if (customCallback) {
                // Jika ada callback (untuk Dashboard), gunakan ini
                customCallback(sql, state);
            } else if (targetTextarea) {
                // Logik asal
                targetTextarea.value = sql;
                const stateInput = targetTextarea.parentElement ? targetTextarea.parentElement.querySelector('.query-builder-state') : null;
                if (stateInput) stateInput.value = state;
                targetTextarea.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
    });
}