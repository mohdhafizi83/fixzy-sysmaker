/**
 * Membuka Query Builder dalam mod 'general'.
 * Fungsi ini boleh dieksport dan dipanggil dari mana-mana, terutamanya dari Algorithm Builder.
 */
export function openGeneralQueryBuilder(targetTextarea) {
    let tableName;
    const fieldPage = document.getElementById('field-settings-page');
    const tablePage = document.getElementById('table-settings-page');

    // Tentukan konteks jadual berdasarkan halaman yang sedang aktif
    if (fieldPage && !fieldPage.classList.contains('hidden')) {
        [tableName] = fieldPage.querySelector('.field-name')?.textContent.split('.') || [];
    } else if (tablePage && !tablePage.classList.contains('hidden')) {
        tableName = tablePage.querySelector('.table-name')?.textContent;
    }

    if (!tableName) {
        showCustomDialog({ title: "Error", message: "Please select a table or a field first to open the Query Builder." });
        return;
    }

    let initialState = null;
    if (targetTextarea) {
        const stateInput = targetTextarea.parentElement.querySelector('.query-builder-state');
        if (stateInput) {
            initialState = stateInput.value || null;
        }
    }

    showConfigurableQueryBuilder({
        mode: 'general',
        tableName: tableName,
        initialState: initialState,
        onComplete: (sql, state) => {
            if (targetTextarea) {
                targetTextarea.value = sql;
                const stateInput = targetTextarea.parentElement.querySelector('.query-builder-state');
                if (stateInput) stateInput.value = state;
                targetTextarea.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
    });
}