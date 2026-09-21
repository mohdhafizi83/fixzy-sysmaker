// js/features/validation.js

/**
 * Initializes event listeners for validation inputs.
 * Example: automatically copies the 'Length' value to 'Max Length'.
 */
export function initializeValidationInputHandlers() {
    const lengthInput = document.getElementById('fld-length');
    const maxLengthInput = document.getElementById('fld-max-length');

    if (!lengthInput || !maxLengthInput) return;

    // This function copies the value from 'Length' to 'Max length'
    const syncLengthValue = () => {
        maxLengthInput.value = lengthInput.value;
    };

    lengthInput.addEventListener('input', syncLengthValue);
}

/**
 * [FIXED] Manages the UI display when a validation checkbox is ticked.
 * Name restored to the original: toggleValidationInputs
 * @param {string} ruleType - Rule type (e.g. 'unique', 'required')
 */
export function toggleValidationInputs(ruleType) {
    const checkbox = document.getElementById(`val_check_${ruleType}`);
    const collapseDiv = document.getElementById(`collapse_${ruleType}`);
    
    if (checkbox && collapseDiv) {
        if (checkbox.checked) {
            collapseDiv.classList.add('show'); 
            collapseDiv.classList.remove('hidden'); 
        } else {
            collapseDiv.classList.remove('show');
            collapseDiv.classList.add('hidden');
        }
    }
}

/**
 * Saves validation data to the database via the Electron API.
 * @param {string|number} columnId - ID of the column/field being edited.
 */
export async function saveValidationData(columnId) {
    const validationsToSave = [];
    // Find only the CHECKED checkboxes
    const checkboxes = document.querySelectorAll('.validation-checkbox:checked');

    checkboxes.forEach(cb => {
        const type = cb.getAttribute('data-type');
        const collapseDiv = document.getElementById(`collapse_${type}`);
        
        // Grab extra input values if present (e.g. min value, max value)
        const input1 = collapseDiv ? collapseDiv.querySelector(`.val-input-1`) : null;
        const input2 = collapseDiv ? collapseDiv.querySelector(`.val-input-2`) : null;

        validationsToSave.push({
            rule_type: type,
            value1: input1 ? input1.value : null,
            value2: input2 ? input2.value : null
        });
    });

    try {
        await window.electronAPI.saveFieldValidations({
            columnId: columnId,
            validations: validationsToSave
        });
        console.log('Validation saved successfully.');
    } catch (err) {
        console.error('Failed to save validations', err);
    }
}