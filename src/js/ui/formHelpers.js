// js/ui/formHelpers.js

/* export function setRadioValue(name, value) {
    const selector = `input[name="${name}"][value="${value}"]`;
    const element = document.querySelector(selector);
    if (element) element.checked = true;
}; */

/**
 * Helper to set the value of a radio input.
 * @param {string} name - The 'name' attribute of the radio group.
 * @param {any} value - The value to select.
 */
export function setRadioValue(name, value) {
    const radios = document.querySelectorAll(`input[name="${name}"]`);
    radios.forEach(radio => {
        // Compare as strings for safety
        radio.checked = (radio.value === String(value));
    });
}

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
            // Handle multi-select dropdowns
            if (typeof value === 'string' && value) {
                const selectedValues = new Set(value.split(','));
                for (const option of element.options) {
                    option.selected = selectedValues.has(option.value);
                }
            } else {
                // Deselect all if there is no value
                for (const option of element.options) {
                    option.selected = false;
                }
            }
        } else {
            // Handle all other elements
            element.value = value || '';
        }
    }
}

/**
 * Helper to get the value of a form element (Get Value).
 * You may need this later too.
 */
export function getElementValue(id) {
    const element = document.getElementById(id);
    if (!element) return null;

    if (element.type === 'checkbox') {
        return element.checked; // Return boolean for checkbox
    } 
    return element.value;
}

/**
 * Applies the font size to the root element (<html>).
 * Moved from uiHandlers.js to avoid a circular dependency.
 * @param {string} size - Size choice ('small', 'medium', 'large').
 */
export function applyFontSize(size) {
    let fontSizeValue = '16px';
    if (size === 'small') fontSizeValue = '14px';
    else if (size === 'large') fontSizeValue = '18px';
    document.documentElement.style.fontSize = fontSizeValue;
}