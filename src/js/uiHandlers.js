export * from './handlers/fieldHandlers.js';
export * from './handlers/tableHandlers.js';
export * from './handlers/menuHandlers.js';
export * from './handlers/projectHandlers.js';
export * from './handlers/logicBuilderHandlers.js';
import { setElementValue, setRadioValue } from './ui/formHelpers.js';
import { resolveVariables } from './utils.js';
import { SaveManager } from './saveManager.js';
import { 
    appState, 
    setAwaitingMenuGroupSave, 
    setLastActiveChildTable, 
    setIsCoreLockingEnabled 
} from './state.js';
import { showCustomDialog } from './ui/modalHandlers.js';

export function initializeFormDisplayRules() {
    const displayTypeRadios = document.querySelectorAll('input[name="fld-display-type"]');
    const dataTypeSelect = document.getElementById('fld-data-type');
    if (displayTypeRadios.length === 0 || !dataTypeSelect) return;

    // Helper function to check compatibility with TEXT data types
    const checkTextCompatibility = () => {
        const selectedRadio = document.querySelector('input[name="fld-display-type"]:checked');
        if (!selectedRadio) return;

        const selectedType = selectedRadio.value;
        const currentDataType = dataTypeSelect.value.toUpperCase();
        const suitableTypes = ['TEXT', 'TINYTEXT', 'MEDIUMTEXT', 'LONGTEXT'];
        
        if (selectedType === 'rich_html' && !suitableTypes.includes(currentDataType)) {
            showCustomDialog({ title: "Warning!", message: "To enable this field to behave as a rich (HTML) box, you should change its data type to 'TEXT', 'MEDIUMTEXT' or 'LONGTEXT'." });
        } else if (selectedType === 'text_area' && !suitableTypes.includes(currentDataType)) {
            showCustomDialog({ title: "Warning!", message: "This field can only be set as a Text area if its data type is one of the 'TEXT' family data types." });
        }
    };
    
    // Attach a listener to each radio button
    displayTypeRadios.forEach(radio => {
        radio.addEventListener('change', checkTextCompatibility);
    });
}

export function initializeOptionsListRules() {
    const multiSelectRadio = document.querySelector('input[name="fld-options-display"][value="multi"]');
    const checkboxesRadio = document.querySelector('input[name="fld-options-display"][value="checkboxes"]');
    const dropdownRadio = document.querySelector('input[name="fld-options-display"][value="dropdown"]');
    const dataTypeSelect = document.getElementById('fld-data-type');

    if (!multiSelectRadio || !checkboxesRadio || !dataTypeSelect || !dropdownRadio) return;

    const checkCompatibility = (event) => {
        const currentDataType = dataTypeSelect.value.toUpperCase();
        
        // Data types allowed for multiple-choice options
        const allowedTypes = ['TEXT', 'LONGTEXT'];
        const isAllowed = allowedTypes.some(type => currentDataType.includes(type));

        if (!isAllowed) {
            event.preventDefault();
            const message = "Multiple-choice options (list box or checkboxes) can only work with Text or Longtext data types.\n\nPlease change the data type of the field first.";
            showCustomDialog({ title: "Warning!", message: message });
            dropdownRadio.checked = true;
        }
    };

    multiSelectRadio.addEventListener('click', checkCompatibility);
    checkboxesRadio.addEventListener('click', checkCompatibility);
}

// Function to load the Validation tab (Auto-Save & jQuery-free version)
export async function loadValidationTab(columnId, tableName) {
    const container = document.getElementById('validationRulesContainer');
    if (!container) return;
    
    // Show the loading spinner
    container.innerHTML = '<div class="text-center p-3"><i class="fas fa-spinner fa-spin"></i> Loading rules...</div>';

    try {
        // 1. Get data from the database
        const existingValidations = await window.electronAPI.getFieldValidations(columnId);
        
        // 2. Get the column list (for the dropdown)
        const tableData = appState.jsonData.database.table[tableName];
        const allCols = [];
        const dateCols = [];

        if (tableData && tableData.fields) {
            Object.values(tableData.fields).forEach(field => {
                if (field.field_id !== columnId) {
                    allCols.push({ column_name: field.field_name });
                    if (['DATE', 'DATETIME', 'TIMESTAMP'].includes(field.data_type.toUpperCase())) {
                        dateCols.push({ column_name: field.field_name });
                    }
                }
            });
        }

        // 3. Build the HTML (no inline event handlers to avoid CSP issues)
        let html = '<div class="accordion" id="accordionValidation">';
        
        window.VALIDATION_RULES_CONFIG.forEach((rule, index) => {
            const savedRule = existingValidations.find(v => v.rule_type === rule.type);
            const isChecked = savedRule ? 'checked' : '';
            const val1 = savedRule ? savedRule.rule_value_1 : '';
            const val2 = savedRule ? savedRule.rule_value_2 : '';

            const inputHtml = renderValidationInputs(rule, allCols, dateCols, val1, val2);

            html += `
            <div class="card mb-2" style="border: 1px solid #dee2e6;">
                <div class="card-header p-2 d-flex align-items-center" id="heading${index}" style="background-color: #f8f9fa;">
                    <div class="custom-control custom-checkbox">
                        <input type="checkbox" class="custom-control-input validation-checkbox" 
                            id="val_check_${rule.type}" 
                            data-type="${rule.type}" 
                            ${isChecked}>
                        <label class="custom-control-label font-weight-bold" for="val_check_${rule.type}" style="cursor:pointer;">
                            ${rule.label}
                        </label>
                    </div>
                    <small class="text-muted ml-auto">${rule.desc}</small>
                </div>

                <div id="collapse_${rule.type}" class="collapse ${isChecked ? 'show' : ''}" style="background: #fff;">
                    <div class="card-body p-2 pl-4">
                        ${inputHtml}
                    </div>
                </div>
            </div>
            `;
        });

        html += '</div>';
        
        // Add a status indicator (to show "Saving...")
        html += `<div id="val-save-status" class="text-right mt-2 text-muted small" style="min-height:20px;"></div>`;

        container.innerHTML = html;

        // 4. ATTACH EVENT LISTENERS FOR AUTO-SAVE
        
        // Helper function to trigger save
        const triggerAutoSave = async () => {
            const statusEl = document.getElementById('val-save-status');
            if (statusEl) statusEl.innerHTML = '<span class="text-info"><i class="fas fa-sync fa-spin"></i> Saving...</span>';
            
            await window.saveValidationData(columnId);
            
            if (statusEl) {
                statusEl.innerHTML = '<span class="text-success"><i class="fas fa-check"></i> Saved</span>';
                setTimeout(() => { if(statusEl) statusEl.innerHTML = ''; }, 2000);
            }
        };

        // A. Listener for checkboxes (click = toggle UI + save)
        const checkboxes = container.querySelectorAll('.validation-checkbox');
        checkboxes.forEach(cb => {
            cb.addEventListener('change', async (e) => {
                const type = e.target.getAttribute('data-type');
                
                // 1. Toggle the UI (open/close accordion)
                window.toggleValidationInputs(type);
                
                // 2. Save to the database
                await triggerAutoSave();
            });
        });

        // B. Listener for inputs (value change = save)
        // We use 'change' so the save happens when the user finishes editing (blur/enter)
        const inputs = container.querySelectorAll('.val-input-1, .val-input-2, select');
        inputs.forEach(input => {
            input.addEventListener('change', async () => {
                await triggerAutoSave();
            });
        });

    } catch (error) {
        console.error("Error loading validations:", error);
        container.innerHTML = `<div class="text-danger p-3">Error loading rules: ${error.message}</div>`;
    }
}

// Helper to build input HTML based on the config
function renderValidationInputs(rule, allCols, dateCols, savedVal1, savedVal2) {
    if (rule.inputs === 'none') return '';

    let inputHtml = '';

    // 1. Date dropdown (date columns only)
    if (rule.inputs === 'dropdown_date') {
        inputHtml += `<select class="form-control form-control-sm val-input-1" data-rule="${rule.type}">
            <option value="">-- Select Date Field --</option>
            ${dateCols.map(c => `<option value="${c.column_name}" ${c.column_name === savedVal1 ? 'selected' : ''}>${c.column_name}</option>`).join('')}
        </select>`;
    } 
    // 2. Field dropdown (all columns) - THIS WAS ADDED
    else if (rule.inputs === 'dropdown_field') {
        inputHtml += `<select class="form-control form-control-sm val-input-1" data-rule="${rule.type}">
            <option value="">-- Select Field --</option>
            ${allCols.map(c => `<option value="${c.column_name}" ${c.column_name === savedVal1 ? 'selected' : ''}>${c.column_name}</option>`).join('')}
        </select>`;
    }
    // 3. Field dropdown + textbox (e.g. required_if)
    else if (rule.inputs === 'dropdown_field_text') {
        inputHtml += `<div class="row">
            <div class="col-6">
                <select class="form-control form-control-sm val-input-1" data-rule="${rule.type}">
                    <option value="">-- Select Field --</option>
                    ${allCols.map(c => `<option value="${c.column_name}" ${c.column_name === savedVal1 ? 'selected' : ''}>${c.column_name}</option>`).join('')}
                </select>
            </div>
            <div class="col-6">
                <input type="text" class="form-control form-control-sm val-input-2" data-rule="${rule.type}" placeholder="Value" value="${savedVal2}">
            </div>
        </div>`;
    }
    // 4. Plain textbox
    else if (rule.inputs === 'textbox') {
        inputHtml += `<input type="text" class="form-control form-control-sm val-input-1" data-rule="${rule.type}" placeholder="${rule.placeholder || ''}" value="${savedVal1}">`;
    }

    return inputHtml;
}