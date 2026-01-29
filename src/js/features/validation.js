// js/features/validation.js

/**
 * Menginisialisasi pendengar acara untuk input validasi.
 * Contoh: Menyalin nilai 'Length' ke 'Max Length' secara automatik.
 */
export function initializeValidationInputHandlers() {
    const lengthInput = document.getElementById('fld-length');
    const maxLengthInput = document.getElementById('fld-max-length');

    if (!lengthInput || !maxLengthInput) return;

    // Fungsi ini menyalin nilai dari 'Length' ke 'Max length'
    const syncLengthValue = () => {
        maxLengthInput.value = lengthInput.value;
    };

    lengthInput.addEventListener('input', syncLengthValue);
}

/**
 * [DIPERBETULKAN] Menguruskan paparan UI apabila checkbox validasi ditanda.
 * Nama dikembalikan kepada asal: toggleValidationInputs
 * @param {string} ruleType - Jenis peraturan (cth: 'unique', 'required')
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
 * Menyimpan data validasi ke pangkalan data melalui API Electron.
 * @param {string|number} columnId - ID lajur/medan yang sedang diedit.
 */
export async function saveValidationData(columnId) {
    const validationsToSave = [];
    // Cari semua checkbox yang DITANDA sahaja
    const checkboxes = document.querySelectorAll('.validation-checkbox:checked');

    checkboxes.forEach(cb => {
        const type = cb.getAttribute('data-type');
        const collapseDiv = document.getElementById(`collapse_${type}`);
        
        // Ambil nilai input tambahan jika wujud (cth: min value, max value)
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