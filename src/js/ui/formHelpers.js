// js/ui/formHelpers.js

/**
 * Helper function to set the value of various form elements.
 * It can handle regular inputs, checkboxes, radios, and multi-select dropdowns.
 * @param {string} id - The ID of the element to update.
 * @param {any} value - The value to set.
 */
export function setElementValue(id, value) {
    const element = document.getElementById(id);
    if (element) {
        if (element.type === 'checkbox' || element.type === 'radio') {
            element.checked = !!value;
        } else if (element.multiple) {
            // Mengendalikan dropdown multi-select
            if (typeof value === 'string' && value) {
                const selectedValues = new Set(value.split(','));
                for (const option of element.options) {
                    option.selected = selectedValues.has(option.value);
                }
            } else {
                // Nyahpilih semua jika tiada nilai
                for (const option of element.options) {
                    option.selected = false;
                }
            }
        } else {
            // Mengendalikan semua elemen lain
            element.value = value || '';
        }
    }
}

/**
 * Helper untuk mendapatkan nilai dari elemen borang (Get Value).
 * Anda mungkin perlukan ini juga nanti.
 */
export function getElementValue(id) {
    const element = document.getElementById(id);
    if (!element) return null;

    if (element.type === 'checkbox') {
        return element.checked; // Return boolean for checkbox
    } 
    return element.value;
}