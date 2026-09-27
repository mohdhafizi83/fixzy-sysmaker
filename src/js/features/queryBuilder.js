// js/features/queryBuilder.js
//
// Thin entry point that opens the shared configurable Query Builder in 'general' mode.

import { showConfigurableQueryBuilder } from '../handlers/logicBuilderHandlers.js';
/**
 * Opens the Query Builder in 'general' mode.
 * Now supports custom parameters for the Dashboard Builder.
 * @param {HTMLTextAreaElement|null} targetTextarea Textarea receiving the generated SQL.
 * @param {string|null} overrideTableName Table to query, bypassing UI detection.
 * @param {Function|null} customCallback Called with (sql, state) instead of writing to the textarea.
 * @returns {void}
 */
export function openGeneralQueryBuilder(targetTextarea, overrideTableName = null, customCallback = null) {
    let tableName = overrideTableName; // Use the passed-in table if provided
    
    const fieldPage = document.getElementById('field-settings-page');
    const tablePage = document.getElementById('table-settings-page');

    // If no overrideTableName, use the original logic to find it in the UI
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
        // Original logic: look for the hidden state input
        const stateInput = targetTextarea.parentElement ? targetTextarea.parentElement.querySelector('.query-builder-state') : null;
        if (stateInput) {
            initialState = stateInput.value || null;
        } else {
            // New logic for Dashboard: read directly from the input itself
            initialState = targetTextarea.value || null;
        }
    }

    showConfigurableQueryBuilder({
        mode: 'general',
        tableName: tableName,
        initialState: initialState,
        onComplete: (sql, state) => {
            if (customCallback) {
                // If there's a callback (for Dashboard), use it
                customCallback(sql, state);
            } else if (targetTextarea) {
                // Original logic
                targetTextarea.value = sql;
                const stateInput = targetTextarea.parentElement ? targetTextarea.parentElement.querySelector('.query-builder-state') : null;
                if (stateInput) stateInput.value = state;
                targetTextarea.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
    });
}