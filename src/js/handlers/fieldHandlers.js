// src/js/handlers/fieldHandlers.js

import { appState } from '../state.js';
import { SaveManager } from '../saveManager.js';
import { showCustomDialog } from '../ui/modalHandlers.js';

// --- FIELD SAVE HANDLER ---
/**
 * Wires the generic autosave for all fld-* inputs in both field-settings containers,
 * routing saves to the main fields table or the custom module's settings_override.
 * @returns {void}
 */
export function initializeFieldSaveHandlers() {
    // 1. Watch both the old and the new container
    const containers = [
        document.getElementById('field-settings-page'),
        document.getElementById('module-field-settings')
    ];

    // --- HELPER FUNCTION: UPDATE THE UI & SAVE TO THE DATABASE AT ONCE ---
    /**
     * Sets a UI input's value and queues the matching field column update in one step.
     * @param {string|number} fieldId Field id to save.
     * @param {string} elementId DOM id of the input to update.
     * @param {*} value New value (booleans coerced to 1/0 for the DB).
     * @param {string|null} dbColumnName DB column name; derived from elementId when null.
     * @param {string|null} tableName Table name (context only).
     * @returns {void}
     */
    const updateAndSave = (fieldId, elementId, value, dbColumnName = null, tableName = null) => {
        const el = document.getElementById(elementId);
        if (el) {
            if (el.type === 'checkbox') el.checked = (value === 1 || value === true);
            else el.value = value;
        }

        const key = dbColumnName || elementId.replace('fld-', '').replace(/-/g, '_');
        let dbValue = typeof value === 'boolean' ? (value ? 1 : 0) : value;

        console.log(`[Auto-Fix] Updating & Saving: ${key} = ${dbValue}`);
        SaveManager.addToQueue('field', fieldId, { [key]: dbValue });
    };

    containers.forEach(container => {
        if (!container) return;

        ['change', 'focusout'].forEach(eventType => {
            container.addEventListener(eventType, (e) => {
                if (appState.isPopulatingData || !appState.isAutoSaveEnabled) return;
                const input = e.target;

                if (eventType === 'focusout' && !['text', 'textarea', 'number'].includes(input.type)) return;
                if (eventType === 'change' && ['text', 'textarea', 'number'].includes(input.type)) return;
                if (!['INPUT', 'SELECT', 'TEXTAREA'].includes(input.tagName)) return;

                

                // =========================================================
                // IDENTIFY THE CONTEXT (currently active table & field)
                // =========================================================
                let tableName = '';
                let fieldNameText = '';
                const workspaceFieldEl = document.getElementById('current-module-field-name');
                // Route from the explicit workspace context (see state.js), not
                // panel visibility — same cross-table misroute class as Bug 1.
                const ws = appState.moduleWorkspace;
                const isWorkspaceActive = !!(ws && ws.tableName);

                if (isWorkspaceActive) {
                    tableName = ws.tableName;
                    fieldNameText = workspaceFieldEl.textContent.trim();
                } else {
                    const titleEl = container.querySelector('.field-name');
                    if (!titleEl) return;
                    const parts = titleEl.textContent.trim().split('.');
                    if (parts.length < 2) return;
                    tableName = parts[0];
                    fieldNameText = parts[1];
                }

                const tableData = appState.jsonData.database.table[tableName];
                if (!tableData || !tableData.fields[fieldNameText]) return;
                const fieldId = tableData.fields[fieldNameText].field_id;

                let key = '';
                if (input.id === 'fld-lookup-parent-table') key = 'lookup_parent_table';
                else if (input.type === 'radio') key = input.name.replace('fld-', '').replace(/-/g, '_');
                else key = input.id.replace('fld-', '').replace(/-/g, '_');

                let value;
                if (input.type === 'checkbox') value = input.checked ? 1 : 0;
                else if (input.type === 'radio') {
                    if (!input.checked) return;
                    value = input.value;
                } else value = input.value;

                // =========================================================
                // DATA SAVE ROUTING (Default vs Custom)
                // =========================================================
                const isCustomModule = isWorkspaceActive && ws.mode === 'custom';

                if (isCustomModule) {
                    const moduleId = ws.moduleId;
                    
                    // 1. Get the module data from AppState
                    const tableData = appState.jsonData.database.table[tableName];
                    const moduleIndex = tableData.custom_modules.findIndex(m => m.module_id === moduleId);
                    
                    if (moduleIndex === -1) {
                        console.error("Module not found in AppState");
                        return;
                    }

                    // 2. Look for an existing record for this field in 'custom_module_fields'
                    // Note: we store the fields array inside the module object in AppState
                    if (!tableData.custom_modules[moduleIndex].fields) {
                        tableData.custom_modules[moduleIndex].fields = [];
                    }
                    
                    let fieldRecord = tableData.custom_modules[moduleIndex].fields.find(f => f.field_id === fieldId);
                    
                    // If none exists yet, create a new object for this field
                    if (!fieldRecord) {
                        fieldRecord = {
                            field_id: fieldId,
                            module_id: moduleId,
                            settings_override: "{}" // Initially empty JSON string
                        };
                        tableData.custom_modules[moduleIndex].fields.push(fieldRecord);
                    }

                    // 3. Parse the existing JSON, update the value, and Stringify again
                    let currentSettings = {};
                    try {
                        currentSettings = JSON.parse(fieldRecord.settings_override || "{}");
                    } catch (e) {
                        currentSettings = {};
                    }

                    // Update the value (Override)
                    currentSettings[key] = value;
                    const jsonString = JSON.stringify(currentSettings);
                    
                    // Save back to AppState (RAM)
                    fieldRecord.settings_override = jsonString;

                    console.log(`[CUSTOM MODULE] Saving Override -> Field ID: ${fieldId} | ${key}: ${value}`);
                    console.log("Updated JSON:", jsonString);

                    // 4. Send to the backend (database)
                    window.electronAPI.saveCustomFieldOverride({
                        module_id: moduleId,
                        field_id: fieldId,
                        settings_override: jsonString
                    }).then(res => {
                        if(res.success) {
                            // Optional: show a small save indicator if needed
                        } else {
                            console.error("Failed to save override:", res.message);
                        }
                    });

                    return; // Stop it from saving to the main table DB
                    } else {
                    console.log(`[DEFAULT MODULE FIELD] Saving -> Table: ${tableName}, Field: ${fieldNameText} | ${key}: ${value}`);
                    SaveManager.addToQueue('field', fieldId, { [key]: value });

// ▼▼▼ MEMORY & UI SYNCHRONIZATION (SILENT RELOAD) ▼▼▼
                    // FIX: use 'focusout' for text inputs
                    if (eventType === 'focusout' && key === 'field_name') {
                        const oldFieldName = fieldNameText;
                        const newFieldName = value;
                        
                        console.log(`[Silent Reload] Updating Field: ${oldFieldName} -> ${newFieldName} (ID: ${fieldId})`);

                        // 1. Update the key in AppState
                        const tData = appState.jsonData.database.table[tableName];
                        if (tData && tData.fields[oldFieldName]) {
                            tData.fields[newFieldName] = tData.fields[oldFieldName];
                            tData.fields[newFieldName].field_name = newFieldName;
                            delete tData.fields[oldFieldName];
                        }

                        // 2. Update the Sidebar UI precisely using data-field-id
                        const fieldSpan = document.querySelector(`li[data-field-id="${fieldId}"] > a > span`);
                        if (fieldSpan) {
                            fieldSpan.textContent = newFieldName;
                            fieldSpan.parentElement.title = `Field Name: ${newFieldName}`;
                        }

                        // 3. Update the breadcrumb
                        const titleField = container.querySelector('.field-name');
                        if (titleField) titleField.textContent = `${tableName}.${newFieldName}`;
                        
                        const workspaceField = document.getElementById('current-module-field-name');
                        if (workspaceField) workspaceField.textContent = newFieldName;
                    }
                    // ▲▲▲ END SYNCHRONIZATION ▲▲▲
                }

                // =========================================================
                // LOGIK AUTOMATIK (SIDE EFFECTS)
                // =========================================================
                if (eventType === 'change') {
                    if (input.id === 'fld-data-type') {
                        const newType = input.value.toUpperCase();
                        if (newType === 'JSON') updateAndSave(fieldId, 'fld-tv-wrap-text', 1, 'tv_wrap_text', tableName);
                        
                        const dateTypes = ['DATE', 'DATETIME', 'TIMESTAMP'];
                        if (dateTypes.includes(newType)) {
                            updateAndSave(fieldId, 'fld-enable-range-filter', 1, 'enable_range_filter', tableName);
                            const formatEl = document.getElementById('fld-tv-date-time-format');
                            if (formatEl && !formatEl.value) {
                                const defaultFormat = newType === 'DATE' ? 'd/m/Y' : 'd/m/Y H:i';
                                updateAndSave(fieldId, 'fld-tv-date-time-format', defaultFormat, 'tv_date_time_format', tableName);
                            }
                        }
                    }

                    if (input.id === 'fld-display-type' || input.id === 'fld-edit-display-as') {
                        if (input.value === 'image') updateAndSave(fieldId, 'fld-allow-image-uploads', 1, 'allow_image_uploads', tableName);
                        if (input.value === 'file') updateAndSave(fieldId, 'fld-allow-file-uploads', 1, 'allow_file_uploads', tableName);
                    }
                }
            });
        });
    });
}

// --- DATA TYPE & DISPLAY RULES ---

/**
 * Binds display-type radios to the data-type rules and the format-as select to mask-group visibility.
 * @returns {void}
 */
export function initializeDisplayTypeRules() {
    const displayTypeRadios = document.querySelectorAll('input[name="fld-display-type"]');
    const formatAsSelect = document.getElementById('fld-format-as');
    const formatMaskGroup = document.getElementById('format-mask-group');

    if (displayTypeRadios.length === 0 || !formatAsSelect || !formatMaskGroup) return;

    // Shows the format-mask input only when format-as is 'custom'.
    const toggleMaskVisibility = () => {
        formatMaskGroup.classList.toggle('hidden', formatAsSelect.value !== 'custom');
    };

    displayTypeRadios.forEach(radio => {
        radio.addEventListener('change', applyDataTypeRules);
    });

    formatAsSelect.addEventListener('change', toggleMaskVisibility);
}

/**
 * Guards against non-integer data types on auto-increment fields and applies data-type UI rules on change.
 * @returns {void}
 */
export function initializeDataTypeRules() {
    const dataTypeSelect = document.getElementById('fld-data-type');
    if (!dataTypeSelect) return;

    let previousDataType = ''; 

    dataTypeSelect.addEventListener('focus', () => {
        previousDataType = dataTypeSelect.value;
    });

    dataTypeSelect.addEventListener('change', () => {
        const autoIncrementCheckbox = document.getElementById('fld-auto-increment');
        
        if (autoIncrementCheckbox && autoIncrementCheckbox.checked) {
            const newDataType = dataTypeSelect.value.toUpperCase();
            const integerTypes = ['TINYINT', 'SMALLINT', 'MEDIUMINT', 'INT', 'BIGINT'];

            if (!integerTypes.includes(newDataType)) {
                showCustomDialog({
                    title: "Validation Rule",
                    message: "An 'Auto Increment' field must have an Integer data type (e.g., INT, BIGINT)."
                });
                dataTypeSelect.value = previousDataType;
                return;
            }
        }
        applyDataTypeRules();

        // Auto-unsigned for INT must PERSIST. This lives in the user-driven
        // change handler (NOT applyDataTypeRules, which also runs during
        // field populate) so opening a field never overwrites a deliberate
        // unsigned=0. A silent `.checked = true` never fires 'change', so
        // the save handler never ran and the DB kept unsigned=0 while the
        // UI showed a tick (UI/DB divergence). Dispatch change to queue it.
        if (dataTypeSelect.value.toUpperCase() === 'INT') {
            const unsignedEl = document.getElementById('fld-unsigned');
            if (unsignedEl && !unsignedEl.checked) {
                unsignedEl.checked = true;
                unsignedEl.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    });
}

/**
 * Shows/hides/disables field-setting controls (length, precision, unsigned, summaries, media, etc.)
 * based on the currently selected data type.
 * @returns {void}
 */
export function applyDataTypeRules() {
    const dataTypeSelect = document.getElementById('fld-data-type');
    if (!dataTypeSelect) return;

    const selectedType = dataTypeSelect.value.toUpperCase();

    const elements = {
        length: document.getElementById('fld-length'),
        precision: document.getElementById('fld-precision'),
        minValueGroup: document.getElementById('fld-min-value-group'),
        maxValueGroup: document.getElementById('fld-max-value-group'),
        columnSpanFullGroup: document.getElementById('fld-column-span-full-group'),
        textInputAddonsGroup: document.getElementById('fld-text-input-addons-group'),
        repeaterOptionsGroup: document.getElementById('fld-repeater-options-group'),
        repeaterSimpleOptionsGroup: document.getElementById('fld-repeater-simple-options-group'),
        autoIncrement: document.getElementById('fld-auto-increment'),
        unsigned: document.getElementById('fld-unsigned'),
        zeroFill: document.getElementById('fld-zero-fill'),
        binary: document.getElementById('fld-binary'),
        defaultValue: document.getElementById('fld-default-value'),
        dbPropertiesFieldset: document.querySelector('#tab-field-general .fieldset-grid fieldset:nth-child(1)'),
        mediaRadios: document.querySelectorAll('input[name="fld-media-type"]'),
        behaviorOptions: document.querySelectorAll('#fld-media-link-behavior option[value="web_link"], #fld-media-link-behavior option[value="email_link"]'),
        showSum: document.getElementById('fld-show-sum'),
        showAvg: document.getElementById('fld-show-avg-summary'),
        showCount: document.getElementById('fld-show-count-summary'),
        showRange: document.getElementById('fld-show-range-summary'),
        displayTypeRadios: document.querySelectorAll('input[name="fld-display-type"]'),
        checkBoxRadio: document.querySelector('input[name="fld-display-type"][value="check_box"]'),
        repeaterRadio: document.querySelector('input[name="fld-display-type"][value="repeater"]'),
        wrapTextCheckbox: document.getElementById('fld-tv-wrap-text'),
        dateTimeFormatGroup: document.getElementById('date-time-format-group'),
        dateOnlyRadio: document.querySelector('input[name="fld-tv-date-time-format"][value="date_only"]'),
        dateAndTimeRadio: document.querySelector('input[name="fld-tv-date-time-format"][value="date_and_time"]'),
        rangeFilterCheckbox: document.getElementById('fld-enable-range-filter'),
        currencyCodeGroup: document.getElementById('currency-code-group'),
        multiSelectRadio: document.querySelector('input[name="fld-options-display"][value="multi"]'),
        dropdownRadio: document.querySelector('input[name="fld-options-display"][value="dropdown"]'),
    };

    const numericTypes = ['TINYINT', 'SMALLINT', 'MEDIUMINT', 'INT', 'BIGINT', 'DECIMAL', 'FLOAT', 'DOUBLE'];
    const integerTypes = ['TINYINT', 'SMALLINT', 'MEDIUMINT', 'INT', 'BIGINT'];
    const floatTypes = ['DECIMAL', 'FLOAT', 'DOUBLE'];
    const textTypes = ['CHAR', 'VARCHAR', 'TINYTEXT', 'TEXT', 'MEDIUMTEXT', 'LONGTEXT'];
    const dateTypes = ['DATE', 'DATETIME', 'TIMESTAMP', 'TIME', 'YEAR'];
    const binaryTypes = ['CHAR', 'VARCHAR', 'TINYBLOB', 'BLOB', 'MEDIUMBLOB', 'LONGBLOB'];
    const typesWithoutLength = ['TEXT', 'TINYTEXT', 'MEDIUMTEXT', 'LONGTEXT', 'DATE', 'DATETIME', 'TIMESTAMP', 'TIME', 'BLOB', 'TINYBLOB', 'MEDIUMBLOB', 'LONGBLOB', 'BOOLEAN', 'JSON'];
    
    const isNumeric = numericTypes.includes(selectedType);
    const isText = textTypes.includes(selectedType);
    const isDate = dateTypes.includes(selectedType);
    const isBoolean = selectedType === 'BOOLEAN';
    
    const isIntegerOnly = integerTypes.includes(selectedType);
    const isFloatOnly = floatTypes.includes(selectedType);

    if (elements.minValueGroup) elements.minValueGroup.classList.toggle('hidden', !isNumeric);
    if (elements.maxValueGroup) elements.maxValueGroup.classList.toggle('hidden', !isNumeric);

    Object.values(elements).forEach(el => {
        if (el && el.forEach) el.forEach(item => { if(item) item.disabled = false; });
        else if (el) el.disabled = false;
    });
    if (elements.dbPropertiesFieldset) elements.dbPropertiesFieldset.classList.remove('fieldset-disabled');

    if (elements.showSum) elements.showSum.disabled = !isNumeric;
    if (elements.showAvg) elements.showAvg.disabled = !isNumeric;
    if (elements.showCount) elements.showCount.disabled = !(isNumeric || isText || isBoolean);
    if (elements.showRange) elements.showRange.disabled = !(isNumeric || isText || isDate);

    if (elements.checkBoxRadio && elements.repeaterRadio) {
        if (isBoolean) {
            if (!elements.checkBoxRadio.checked && !document.querySelector('input[name="fld-display-type"][value="options_list"]').checked) {
                elements.checkBoxRadio.checked = true;
            }
            elements.displayTypeRadios.forEach(radio => {
                radio.disabled = !(radio.value === 'check_box' || radio.value === 'options_list');
            });
            document.getElementById('fld-standard-list-values-group')?.classList.add('hidden');
            document.getElementById('fld-boolean-labels-group')?.classList.remove('hidden');
            document.getElementById('fld-options-display-multi-label')?.classList.add('hidden');
            document.getElementById('fld-options-display-checkboxes-label')?.classList.add('hidden');

        } else if (selectedType === 'JSON') {
            const repeaterRadio = document.querySelector('input[name="fld-display-type"][value="repeater"]');
            const repeaterSimpleRadio = document.querySelector('input[name="fld-display-type"][value="repeater_simple"]');
            
            if (repeaterRadio && repeaterSimpleRadio && !repeaterRadio.checked && !repeaterSimpleRadio.checked) {
                repeaterSimpleRadio.checked = true; 
            }
            elements.displayTypeRadios.forEach(radio => {
                radio.disabled = !(radio.value === 'repeater' || radio.value === 'repeater_simple');
            });
        } else if (selectedType === 'TEXT' || selectedType === 'LONGTEXT') {
            const textAreaRadio = document.querySelector('input[name="fld-display-type"][value="text_area"]');
            const richHtmlRadio = document.querySelector('input[name="fld-display-type"][value="rich_html"]');
            
            if (!textAreaRadio.checked && !richHtmlRadio.checked) textAreaRadio.checked = true;

            elements.displayTypeRadios.forEach(radio => {
                radio.disabled = !(radio.value === 'text_area' || radio.value === 'rich_html');
            });  
        } else if (isDate) {
            const datetimeInputRadio = document.querySelector('input[name="fld-display-type"][value="datetime_input"]');
            if (datetimeInputRadio) {
                datetimeInputRadio.checked = true;
                elements.displayTypeRadios.forEach(radio => {
                    radio.disabled = radio.value !== 'datetime_input';
                });
            }
        } else {
            document.getElementById('fld-standard-list-values-group')?.classList.remove('hidden');
            document.getElementById('fld-boolean-labels-group')?.classList.add('hidden');
            document.getElementById('fld-options-display-multi-label')?.classList.remove('hidden');
            document.getElementById('fld-options-display-checkboxes-label')?.classList.remove('hidden');
            
            const currentlyChecked = document.querySelector('input[name="fld-display-type"]:checked');
            const disallowedValues = ['check_box', 'repeater', 'repeater_simple', 'datetime_input'];

            if (elements.checkBoxRadio) elements.checkBoxRadio.disabled = true;
            if (elements.repeaterRadio) elements.repeaterRadio.disabled = true;
            const repeaterSimpleRadio = document.querySelector('input[name="fld-display-type"][value="repeater_simple"]');
            if (repeaterSimpleRadio) repeaterSimpleRadio.disabled = true;
            const datetimeInputRadio = document.querySelector('input[name="fld-display-type"][value="datetime_input"]');
            if (datetimeInputRadio) datetimeInputRadio.disabled = true;

            if (currentlyChecked && disallowedValues.includes(currentlyChecked.value)) {
                const defaultRadio = document.querySelector('input[name="fld-display-type"][value="text_input"]');
                if (defaultRadio) defaultRadio.checked = true;
            }
        }
    }

    if (elements.wrapTextCheckbox) {
        if (selectedType === 'JSON' && !elements.wrapTextCheckbox.checked) {
            elements.wrapTextCheckbox.checked = true;
        }
    }

    if (elements.dateTimeFormatGroup && elements.dateOnlyRadio && elements.dateAndTimeRadio) {
        elements.dateTimeFormatGroup.classList.toggle('hidden', !isDate);
        if (isDate) {
            elements.dateAndTimeRadio.disabled = (selectedType === 'DATE');
            if (selectedType === 'DATE') elements.dateOnlyRadio.checked = true;
        }
    }

    if (elements.rangeFilterCheckbox) {
        elements.rangeFilterCheckbox.disabled = !isDate;
        if (!isDate) elements.rangeFilterCheckbox.checked = false;
    }

    if (elements.currencyCodeGroup) {
        elements.currencyCodeGroup.classList.toggle('hidden', !isNumeric);
    }
    
    if (elements.length && typesWithoutLength.includes(selectedType)) {
        elements.length.disabled = true;
        elements.length.value = '';
    }
    if (elements.precision) {
        elements.precision.disabled = !isFloatOnly;
    }

    if (elements.autoIncrement && elements.defaultValue) {
        if (elements.autoIncrement.checked) {
            elements.defaultValue.disabled = true;
            elements.defaultValue.value = '';
        }
        elements.autoIncrement.disabled = !isIntegerOnly;
    }

    if(elements.unsigned) elements.unsigned.disabled = !isNumeric;
    if(elements.zeroFill) elements.zeroFill.disabled = !isIntegerOnly;
    if(elements.binary) elements.binary.disabled = !binaryTypes.includes(selectedType);
    
    if ([...numericTypes, ...dateTypes, 'JSON', 'BOOLEAN'].includes(selectedType)) {
        elements.mediaRadios.forEach(radio => { if (radio.value !== 'link') radio.disabled = true; });
        elements.behaviorOptions.forEach(opt => opt.hidden = true);
    }

    if (['TEXT', 'TINYTEXT', 'MEDIUMTEXT', 'LONGTEXT', 'BLOB', 'TINYBLOB', 'MEDIUMBLOB', 'LONGBLOB', 'JSON'].includes(selectedType)) {
        if (elements.dbPropertiesFieldset) elements.dbPropertiesFieldset.classList.add('fieldset-disabled');
    }

    if (selectedType === 'VARCHAR' && !elements.length.value) elements.length.value = 255;
    if (selectedType === 'DECIMAL') {
        if (!elements.length.value) elements.length.value = 10;
        if (!elements.precision.value) elements.precision.value = 2;
    }

    if (elements.multiSelectRadio && elements.multiSelectRadio.checked) {
        if (!['TEXT', 'TINYTEXT', 'MEDIUMTEXT', 'LONGTEXT', 'BLOB', 'TINYBLOB', 'MEDIUMBLOB', 'LONGBLOB'].includes(selectedType)) {
            if(elements.dropdownRadio) elements.dropdownRadio.checked = true;
        }
    }
    
    const finalSelectedRadio = document.querySelector('input[name="fld-display-type"]:checked');
    if (finalSelectedRadio) {
        const finalValue = finalSelectedRadio.value;
        const formatAsGroup = document.getElementById('format-as-group');
        if (formatAsGroup) {
            const selectedMediaRadio = document.querySelector('input[name="fld-media-type"]:checked');
            const selectedMediaType = selectedMediaRadio ? selectedMediaRadio.value : 'link';
            const parentTableSelect = document.getElementById('fld-lookup-parent-table');
            const isForeignKey = parentTableSelect ? parentTableSelect.value !== '' : false;
            formatAsGroup.classList.toggle('hidden', finalValue !== 'text_input' || selectedMediaType !== 'link' || isForeignKey);
        }

        const optionsListGroup = document.getElementById('options-list-settings-group');
        if (optionsListGroup) {
            optionsListGroup.classList.toggle('hidden', finalValue !== 'options_list');
        }
        
        if (elements.columnSpanFullGroup) {
            const isVisible = (finalValue === 'text_area' || finalValue === 'rich_html');
            elements.columnSpanFullGroup.classList.toggle('hidden', !isVisible);
        }
        
        if (elements.textInputAddonsGroup) {
            elements.textInputAddonsGroup.classList.toggle('hidden', finalValue !== 'text_input');
        }
        
        if (elements.repeaterOptionsGroup) {
            elements.repeaterOptionsGroup.classList.toggle('hidden', finalValue !== 'repeater');
        }
        if (elements.repeaterSimpleOptionsGroup) {
            elements.repeaterSimpleOptionsGroup.classList.toggle('hidden', finalValue !== 'repeater_simple');
        }
    }
}

// --- MEDIA & OPTIONS ---

/**
 * Switches the visible media-options panel per media-type radio and auto-sets the table-view icon.
 * @returns {void}
 */
export function initializeMediaTabHandlers() {
    const mediaRadios = document.querySelectorAll('input[name="fld-media-type"]');
    const allPanels = document.querySelectorAll('.media-options-panel');

    if (mediaRadios.length === 0) return;

    mediaRadios.forEach(radio => {
        radio.addEventListener('click', () => {
            allPanels.forEach(panel => panel.classList.add('hidden'));
            const radioValue = radio.value;
            let targetPanelId = (radioValue === 'upload') ? 'file-upload-options-panel' : `${radioValue}-options-panel`;
            const targetPanel = document.getElementById(targetPanelId);
            if (targetPanel) {
                targetPanel.classList.remove('hidden');
            }

            const iconInput = document.getElementById('fld-tv-icon');
            if (iconInput) {
                let iconToSet = '';
                if (radio.value === 'upload') iconToSet = 'document-arrow-down';
                else if (radio.value === 'gmap') iconToSet = 'map-pin';
                else if (radio.value === 'youtube') iconToSet = 'video-camera';
                
                iconInput.value = iconToSet;
                iconInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });
    });
}

/**
 * Copies a chosen quick-list preset from the dropdown into the options-list values textarea.
 * @returns {void}
 */
export function initializeOptionsListHandlers() {
    const quickListSelect = document.getElementById('options-quick-list');
    const valuesInput = document.getElementById('fld-options-list-values');

    if (quickListSelect && valuesInput) {
        quickListSelect.addEventListener('change', () => {
            valuesInput.value = quickListSelect.value;
            valuesInput.dispatchEvent(new Event('input', { bubbles: true }));
        });
    }
}

/**
 * Opens the auto-default picker modal and copies the chosen value into the default-value input.
 * @returns {void}
 */
export function initializeAutoDefaultHandlers() {
    const autoDefaultBtn = document.getElementById('auto-default-btn');
    const autoDefaultModal = document.getElementById('auto-default-modal');
    const defaultValueInput = document.getElementById('fld-default-value');
    
    const selectValue = document.getElementById('auto-default-select');
    const btnOk = document.getElementById('auto-default-ok');
    const btnCancel = document.getElementById('auto-default-cancel');
    const btnClose = document.getElementById('auto-default-close');

    if (!autoDefaultBtn || !autoDefaultModal || !defaultValueInput || !selectValue || !btnOk || !btnCancel || !btnClose) return;

    // Hides the auto-default picker modal.
    const closeModal = () => autoDefaultModal.classList.add('hidden');

    autoDefaultBtn.addEventListener('click', () => {
        autoDefaultModal.classList.remove('hidden');
    });

    btnOk.addEventListener('click', () => {
        defaultValueInput.value = selectValue.value;
        defaultValueInput.dispatchEvent(new Event('input', { bubbles: true }));
        closeModal();
    });

    btnCancel.addEventListener('click', closeModal);
    btnClose.addEventListener('click', closeModal);
}

/**
 * Toggles link display-as and other-field groups based on the media link behavior selection.
 * @returns {void}
 */
export function initializeLinkOptionsHandlers() {
    const behaviorSelect = document.getElementById('fld-media-link-behavior');
    const displayAsGroup = document.getElementById('link-display-as-group');
    const displayAsSelect = document.getElementById('fld-media-link-display-as');
    const otherFieldGroup = document.getElementById('link-other-field-group');

    if (!behaviorSelect || !displayAsGroup || !displayAsSelect || !otherFieldGroup) return;

    behaviorSelect.addEventListener('change', () => {
        const value = behaviorSelect.value;
        if (value === 'web_link' || value === 'email_link') {
            displayAsGroup.classList.remove('hidden');
        } else {
            displayAsGroup.classList.add('hidden');
        }
        displayAsSelect.dispatchEvent(new Event('change'));
    });

    displayAsSelect.addEventListener('change', () => {
        if (!displayAsGroup.classList.contains('hidden') && displayAsSelect.value === 'other_field') {
            otherFieldGroup.classList.remove('hidden');
        } else {
            otherFieldGroup.classList.add('hidden');
        }
    });
}

/**
 * Fills the media-link 'other field' dropdown with the table's fields except the current one.
 * @param {string} tableName Table whose fields populate the dropdown.
 * @param {string} currentFieldName Field excluded from the list.
 * @returns {void}
 */
export function populateOtherFieldDropdown(tableName, currentFieldName) {
    const otherFieldSelect = document.getElementById('fld-media-link-other-field');
    if (!otherFieldSelect || !appState.jsonData) return;

    otherFieldSelect.innerHTML = '';
    const table = appState.jsonData.database.table[tableName];
    if (table && table.fields) {
        const otherFields = Object.keys(table.fields).filter(f => f !== currentFieldName);
        otherFields.forEach(fieldName => {
            const option = document.createElement('option');
            option.value = fieldName;
            option.textContent = fieldName;
            otherFieldSelect.appendChild(option);
        });
    }
}

/**
 * Enables/disables image upload option controls with the main allow-image checkbox and wires zoom dependencies.
 * @returns {void}
 */
export function initializeImageOptionsHandlers() {
    const mainCheckbox = document.getElementById('fld-allow-image-uploads');
    const imageOptionsTabs = document.getElementById('image-options-tabs');

    const dependentControls = [
        document.getElementById('fld-max-file-size'),
        document.getElementById('fld-delete-image-server'),
        document.getElementById('fld-dont-rename-image'),
        document.getElementById('fld-tv-thumb-width'),
        document.getElementById('fld-tv-thumb-height'),
        document.getElementById('fld-tv-enable-zooming'),
        document.getElementById('fld-tv-show-full-size'),
        document.getElementById('fld-dv-thumb-width'),
        document.getElementById('fld-dv-thumb-height'),
        document.getElementById('fld-dv-enable-zooming'),
        document.getElementById('fld-dv-show-full-size')
    ];

    const tvShowFullSize = document.getElementById('fld-tv-show-full-size');
    const tvEnableZooming = document.getElementById('fld-tv-enable-zooming');
    const dvShowFullSize = document.getElementById('fld-dv-show-full-size');
    const dvEnableZooming = document.getElementById('fld-dv-enable-zooming');

    // Reveals/hides the image options tabs with the allow-image-uploads checkbox.
    const toggleImageOptions = () => {
        const isEnabled = mainCheckbox.checked;
        imageOptionsTabs.classList.toggle('hidden', !isEnabled);
        dependentControls.forEach(control => {
            if (control) control.disabled = !isEnabled;
        });
        if(isEnabled) {
             handleZoomDependency();
        }
    };

    // 'Show full size' and 'enable zooming' are mutually exclusive in TV and DV.
    const handleZoomDependency = () => {
        if (tvShowFullSize && tvEnableZooming) {
            const isDisabled = tvShowFullSize.checked;
            tvEnableZooming.disabled = isDisabled;
            if (isDisabled) tvEnableZooming.checked = false;
        }
        if (dvShowFullSize && dvEnableZooming) {
            const isDisabled = dvShowFullSize.checked;
            dvEnableZooming.disabled = isDisabled;
            if (isDisabled) dvEnableZooming.checked = false;
        }
    };

    if (mainCheckbox) mainCheckbox.addEventListener('change', toggleImageOptions);
    if (tvShowFullSize) tvShowFullSize.addEventListener('change', handleZoomDependency);
    if (dvShowFullSize) dvShowFullSize.addEventListener('change', handleZoomDependency);
    
    if(mainCheckbox) toggleImageOptions();
}

/**
 * Fills the file-upload 'other field' dropdown with the table's fields except the current one.
 * @param {string} tableName Table whose fields populate the dropdown.
 * @param {string} currentFieldName Field excluded from the list.
 * @returns {void}
 */
export function populateFileOtherFieldDropdown(tableName, currentFieldName) {
    const otherFieldSelect = document.getElementById('fld-file-other-field');
    if (!otherFieldSelect || !appState.jsonData) return;

    otherFieldSelect.innerHTML = '';
    const table = appState.jsonData.database.table[tableName];
    if (table && table.fields) {
        const otherFields = Object.keys(table.fields).filter(f => f !== currentFieldName);
        otherFields.forEach(fieldName => {
            const option = document.createElement('option');
            option.value = fieldName;
            option.textContent = fieldName;
            otherFieldSelect.appendChild(option);
        });
    }
}

/**
 * Enables/disables file upload option controls with the main checkbox and cascades behavior/display-as groups.
 * @returns {void}
 */
export function initializeFileUploadOptionsHandlers() {
    const mainCheckbox = document.getElementById('fld-allow-file-uploads');
    const dependentControls = [
        document.getElementById('fld-file-types'),
        document.getElementById('fld-file-max-size'),
        document.getElementById('fld-delete-file-server'),
        document.getElementById('fld-dont-rename-file'),
        document.getElementById('fld-file-behavior'),
        document.getElementById('fld-file-display-as'),
        document.getElementById('fld-file-other-field')
    ];

    const behaviorSelect = document.getElementById('fld-file-behavior');
    if (behaviorSelect) behaviorSelect.value = 'download_link';
    
    const displayAsGroup = document.getElementById('fld-file-display-as-group');
    const displayAsSelect = document.getElementById('fld-file-display-as');
    const otherFieldGroup = document.getElementById('fld-file-other-field-group');

    // Enables/disables all file upload option controls with the main checkbox.
    const toggleAllOptions = () => {
        const isEnabled = mainCheckbox.checked;
        dependentControls.forEach(control => {
            if (control) control.disabled = !isEnabled;
        });
        if (behaviorSelect) behaviorSelect.dispatchEvent(new Event('change'));
    };

    if (mainCheckbox) mainCheckbox.addEventListener('change', toggleAllOptions);

    if (behaviorSelect) {
        behaviorSelect.addEventListener('change', () => {
            if (behaviorSelect.value === 'download_link') {
                displayAsGroup.classList.remove('hidden');
            } else {
                displayAsGroup.classList.add('hidden');
            }
            if (displayAsSelect) displayAsSelect.dispatchEvent(new Event('change'));
        });
    }

    if (displayAsSelect) {
        displayAsSelect.addEventListener('change', () => {
            if (!displayAsGroup.classList.contains('hidden') && displayAsSelect.value === 'other_field') {
                otherFieldGroup.classList.remove('hidden');
            } else {
                otherFieldGroup.classList.add('hidden');
            }
        });
    }

    if (mainCheckbox) toggleAllOptions();
}

/**
 * Shows/hides the Google Maps and YouTube detail groups with their respective checkboxes.
 * @returns {void}
 */
export function initializeMediaVisibilityHandlers() {
    const gmapCheckbox = document.getElementById('fld-display-gmap');
    const gmapDetails = document.getElementById('gmap-details');

    if (gmapCheckbox && gmapDetails) {
        gmapCheckbox.addEventListener('change', () => {
            gmapDetails.classList.toggle('hidden', !gmapCheckbox.checked);
        });
    }

    const youtubeCheckbox = document.getElementById('fld-accept-video-url');
    const youtubeDetails = document.getElementById('youtube-details');

    if (youtubeCheckbox && youtubeDetails) {
        youtubeCheckbox.addEventListener('change', () => {
            youtubeDetails.classList.toggle('hidden', !youtubeCheckbox.checked);
        });
    }
}

// --- LOOKUP & DATABASE PROPERTIES ---

/**
 * Fills the lookup parent-table dropdown with all project tables except the current one.
 * @param {string} currentTableName Child table excluded from the parent options.
 * @returns {void}
 */
export function populateParentTableDropdown(currentTableName) {
    const parentTableSelect = document.getElementById('fld-lookup-parent-table');
    parentTableSelect.innerHTML = '<option value=""></option>';

    const selfOption = document.createElement('option');
    selfOption.value = currentTableName;
    selfOption.textContent = `${currentTableName} (self-referencing relationship)`;
    parentTableSelect.appendChild(selfOption);

    const otherTables = appState.allTableNames.filter(name => name !== currentTableName);
    otherTables.forEach(tableName => {
        const option = document.createElement('option');
        option.value = tableName;
        option.textContent = tableName;
        parentTableSelect.appendChild(option);
    });
}

/**
 * Fills both lookup caption dropdowns with the parent table's field names.
 * @param {string} tableName Parent table whose fields populate the caption selects.
 * @returns {void}
 */
export function populateParentCaptionDropdowns(tableName) {
    const caption1Select = document.getElementById('fld-lookup-caption-1');
    const caption2Select = document.getElementById('fld-lookup-caption-2');

    if (!caption1Select || !caption2Select) return;

    caption1Select.innerHTML = '';
    caption2Select.innerHTML = '';

    if (tableName && appState.jsonData && appState.jsonData.database && appState.jsonData.database.table[tableName]) {
        const fields = appState.jsonData.database.table[tableName].fields;
        Object.keys(fields).forEach(fieldName => {
            const option1 = document.createElement('option');
            option1.value = fieldName;
            option1.textContent = fieldName;
            caption1Select.appendChild(option1);

            const option2 = document.createElement('option');
            option2.value = fieldName;
            option2.textContent = fieldName;
            caption2Select.appendChild(option2);
        });
    }
}

/**
 * Wires lookup field selects: parent-table change triggers a manual save, and display-as radios toggle dropdown options.
 * @returns {void}
 */
export function initializeLookupFieldHandlers() {
    const parentTableSelect = document.getElementById('fld-lookup-parent-table');
    const caption1Select = document.getElementById('fld-lookup-caption-1');
    const displayAsRadios = document.querySelectorAll('input[name="fld-lookup-display-as"]');
    const dropdownOptions = document.getElementById('fld-lookup-dropdown-options');

    if (!parentTableSelect || !caption1Select) return;

    // Function to send data manually to SaveManager
    /**
     * Resolves the current field from the page title and queues a single-column field save.
     * @param {string} fieldName DB column name to save.
     * @param {*} value Value to store.
     * @returns {void}
     */
    const triggerManualSave = (fieldName, value) => {
        if (appState.isPopulatingData || !appState.isAutoSaveEnabled) return;

        const titleEl = document.querySelector('#field-settings-page .field-name');
        if (!titleEl) return;

        const parts = titleEl.textContent.trim().split('.');
        if (parts.length < 2) return;

        const tableName = parts[0];
        const fieldNameText = parts[1];
        const tableData = appState.jsonData.database.table[tableName];

        if (tableData && tableData.fields[fieldNameText]) {
            const fieldId = tableData.fields[fieldNameText].field_id;
            
            console.log(`[LookupHandler] Manual trigger for '${fieldName}': ${value}`);
            
            SaveManager.addToQueue('field', fieldId, { 
                [fieldName]: value 
            });
        }
    };

    // 1. LISTENER: PARENT TABLE ONLY (this alone triggers the Upsert Relationship)
    parentTableSelect.addEventListener('change', () => {
        const selectedTable = parentTableSelect.value;
        
        // Logik UI (Populate Caption)
        populateParentCaptionDropdowns(selectedTable);
        
        // Auto-select caption (UI logic)
        if (selectedTable && appState.jsonData.database.table[selectedTable]) {
             // ... (your auto-select caption code stays the same) ...
             const parentFields = appState.jsonData.database.table[selectedTable].fields;
             const fieldNames = Object.keys(parentFields);
             const integerTypes = ['TINYINT', 'SMALLINT', 'MEDIUMINT', 'INT', 'BIGINT'];
             let defaultCaptionField = null;
             const firstNonIntegerField = fieldNames.find(name => !integerTypes.includes(parentFields[name].data_type.toUpperCase()));
             
             if (firstNonIntegerField) defaultCaptionField = firstNonIntegerField;
             else if (fieldNames.length > 1) defaultCaptionField = fieldNames[1];
 
             if (defaultCaptionField) {
                 caption1Select.value = defaultCaptionField;
                 caption1Select.dispatchEvent(new Event('change', { bubbles: true }));
             }
        }

        // Send the 'lookup_parent_table' change to SaveManager
        triggerManualSave('lookup_parent_table', selectedTable);
    });

    // NOTE: Listeners for Caption 1 & 2 were REMOVED from here.
    // They are handled by 'initializeFieldSaveHandlers' (generic handler) 
    // to save data to the 'fields' table only, without triggering an upsert relationship.

    // Shows the lookup dropdown options only when display-as is 'dropdown'.
    const toggleDropdownOptions = () => {
        const selectedRadio = document.querySelector('input[name="fld-lookup-display-as"]:checked');
        if (selectedRadio && dropdownOptions) {
            dropdownOptions.classList.toggle('hidden', selectedRadio.value !== 'dropdown');
        }
    };
    displayAsRadios.forEach(radio => radio.addEventListener('change', toggleDropdownOptions));
}

/**
 * Builds the default lookup SELECT from parent table, captions, separator, and the parent's primary key.
 * @returns {string} SQL query string, or '' when parent/caption missing.
 */
function generateDefaultLookupQuery() {
    const parentTable = document.getElementById('fld-lookup-parent-table').value;
    const caption1 = document.getElementById('fld-lookup-caption-1').value;
    const caption2 = document.getElementById('fld-lookup-caption-2').value;
    const separator = document.getElementById('fld-lookup-separator').value;

    if (!parentTable || !caption1) return '';

    let captionFields = `\`${parentTable}\`.\`${caption1}\``;
    if (caption2 && separator) {
        captionFields = `CONCAT(${captionFields}, '${separator}', \`${parentTable}\`.\`${caption2}\`)`;
    }

    const parentTableData = appState.jsonData.database.table[parentTable];
    const pkField = Object.keys(parentTableData.fields).find(f => parentTableData.fields[f].primary_key) || 'id';

    return `SELECT \`${parentTable}\`.\`${pkField}\`, ${captionFields} FROM \`${parentTable}\` ORDER BY 2`;
}

/**
 * Opens the advanced lookup modal with the current (or default-generated) custom query and saves it on OK.
 * @returns {void}
 */
export function initializeAdvancedLookupHandlers() {
    const modal = document.getElementById('advanced-lookup-modal');
    const openBtn = document.getElementById('fld-lookup-advanced-btn');
    const closeBtn = document.getElementById('advanced-lookup-modal-close');
    const okBtn = document.getElementById('advanced-lookup-ok-btn');
    const cancelBtn = document.getElementById('advanced-lookup-cancel-btn');
    const resetBtn = document.getElementById('advanced-lookup-reset-btn');
    const queryTextarea = document.getElementById('fld-lookup-custom-query');
    const hiddenQueryInput = document.getElementById('fld-lookup-custom-query-hidden');

    // Opens the modal with the current query, generating a default one when empty.
    const openModal = () => {
        let currentQuery = hiddenQueryInput.value;
        if (!currentQuery) {
            currentQuery = generateDefaultLookupQuery();
        }
        queryTextarea.value = currentQuery;
        modal.classList.remove('hidden');
    };

    // Hides the advanced lookup modal.
    const closeModal = () => modal.classList.add('hidden');

    // Persists the textarea contents into the hidden query input, then closes.
    const saveAndClose = () => {
        hiddenQueryInput.value = queryTextarea.value;
        closeModal();
    };

    openBtn.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    okBtn.addEventListener('click', saveAndClose);
    resetBtn.addEventListener('click', () => {
        queryTextarea.value = generateDefaultLookupQuery();
    });
}

/**
 * Disables the calculated-field checkbox with an explanation when conflicting options are set.
 * @returns {void}
 */
export function initializeCalculatedFieldRules() {
    const enableCheckbox = document.getElementById('fld-calculated-enable');

    if (!enableCheckbox) return;

    // Collects validation errors for the calculated field configuration.
    //
    // IMPORTANT: several conflicting controls (read-only, required,
    // options-list-values, format-as) live in the Modules Setup workspace
    // (#module-field-settings), which is HIDDEN while the user works in
    // Models Design. Reading their DOM state there returns a stale value
    // from whichever field the module workspace last loaded — so the guard
    // blocked valid fields and fired spurious modals. Validate against the
    // actual field record in appState instead; fall back to the DOM only
    // when the record is unavailable.
    const currentFieldRecord = () => {
        const titleEl = document.querySelector('#field-settings-page .field-name');
        if (!titleEl) return null;
        const parts = titleEl.textContent.trim().split('.');
        if (parts.length < 2) return null;
        return appState.jsonData?.database?.table?.[parts[0]]?.fields?.[parts[1]] || null;
    };

    const validateConditions = () => {
        const rec = currentFieldRecord();
        const getEl = (id) => document.getElementById(id); // shorthand element lookup
        // Read a checkbox: appState record first, DOM as fallback.
        const isChecked = (key, domId) => {
            if (rec && rec[key] !== undefined && rec[key] !== null) return rec[key] === 1 || rec[key] === true;
            return !!getEl(domId)?.checked;
        };
        // Read a value: appState record first, DOM as fallback.
        const getValue = (key, domId) => {
            if (rec && rec[key] !== undefined) return rec[key];
            return getEl(domId)?.value;
        };
        const errors = [];

        if (!isChecked('read_only', 'fld-read-only')) errors.push("Field must be set as 'Read Only'.");
        if (isChecked('primary_key', 'fld-primary-key')) errors.push("Field cannot be a 'Primary Key'.");
        if (isChecked('required', 'fld-required')) errors.push("Field cannot be 'Required'.");
        const displayType = (getValue('display_type', 'fld-display-type') || '').toString();
        if (displayType === 'text_area' || displayType === 'rich_html') errors.push("Field cannot be a 'Text area' or 'Rich (HTML) area'.");
        if (isChecked('auto_increment', 'fld-auto-increment')) errors.push("Field cannot be 'Auto Increment'.");
        if (isChecked('unique', 'fld-unique')) errors.push("Field cannot be 'Unique'.");
        const mediaLinkBehavior = getValue('media_link_behavior', 'fld-media-link-behavior');
        if (mediaLinkBehavior === 'web_link' || mediaLinkBehavior === 'email_link') errors.push("Field cannot be a 'Web/email link'.");
        const mediaType = getValue('media_type', null)
            || document.querySelector('input[name="fld-media-type"]:checked')?.value;
        if (['image', 'upload'].includes(mediaType)) errors.push("Field cannot be an 'Image/file upload' type.");
        if (['gmap', 'youtube'].includes(mediaType)) errors.push("Field cannot be a 'Map/video' type.");
        if (getValue('lookup_parent_table', 'fld-lookup-parent-table')) errors.push("Field cannot be a 'Lookup field'.");
        if (getValue('options_list_values', 'fld-options-list-values')) errors.push("Field cannot be an 'Options list' field.");
        const formatAs = getValue('format_as', 'fld-format-as');
        if (formatAs && formatAs !== 'default') errors.push("Field cannot have a 'Data format' specified.");
        if (getValue('default_value', 'fld-default-value')) errors.push("Field cannot have a 'Default value'.");

        return errors;
    };

    enableCheckbox.addEventListener('click', (event) => {
        if (appState.isPopulatingData) return;
        if (enableCheckbox.checked) {
            const validationErrors = validateConditions();
            if (validationErrors.length > 0) {
                event.preventDefault();
                let alertMessage = "This field cannot be set as a calculated field for the following reasons:\n\n";
                validationErrors.forEach(error => {
                    alertMessage += `- ${error}\n`;
                });
                showCustomDialog({ title: "Validation Error", message: alertMessage });
                enableCheckbox.checked = false;
            }
        }
    });

    // Reverts the calculated checkbox with a dialog when validation fails.
    // Skipped while populating: fieldSettings dispatches synthetic 'change'
    // events on the conflicting controls during load, which used to raise a
    // modal on every field selection and freeze the toolbar behind it.
    const checkAndDisableCalculatedField = () => {
        if (appState.isPopulatingData) return;
        if (!enableCheckbox.checked) return;
        const validationErrors = validateConditions();
        if (validationErrors.length > 0) {
            showCustomDialog({
                title: "Validation Rule",
                message: "Calculated field has been disabled for the following reason:\n\n" +
                         `- ${validationErrors[0]}`
            });
            enableCheckbox.checked = false;
        }
    };

    const conflictingElementIds = [
        'fld-read-only', 'fld-primary-key', 'fld-required', 'fld-text-area',
        'fld-rich-html', 'fld-auto-increment', 'fld-unique',
        'fld-media-link-behavior', 'fld-lookup-parent-table',
        'fld-options-list-values', 'fld-format-as', 'fld-default-value',
        'fld-media-image', 'fld-media-upload', 'fld-media-gmap', 'fld-media-youtube'
    ];

    conflictingElementIds.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', checkAndDisableCalculatedField);
        }
    });
}

/**
 * Enforces mutual-exclusion rules among primary key, auto-increment, required, and read-only checkboxes.
 * @returns {void}
 */
export function initializeDatabasePropertiesHandlers() {
    const primaryKeyCheckbox = document.getElementById('fld-primary-key');
    const autoIncrementCheckbox = document.getElementById('fld-auto-increment');
    const requiredCheckbox = document.getElementById('fld-required');
    const readOnlyCheckbox = document.getElementById('fld-read-only');

    if (!primaryKeyCheckbox || !autoIncrementCheckbox || !requiredCheckbox || !readOnlyCheckbox) return;

    autoIncrementCheckbox.addEventListener('change', () => {
        if (autoIncrementCheckbox.checked) {
            if (!primaryKeyCheckbox.checked) {
                showCustomDialog({
                    title: "Validation Rule",
                    message: "'Auto Increment' can only be enabled for a 'Primary Key' field."
                });
                autoIncrementCheckbox.checked = false;
                return;
            }
            requiredCheckbox.checked = false;
            readOnlyCheckbox.checked = true;
        } else {
            const message = "Warning: Disabling Auto Increment on a key field requires you to manage unique values manually, which can lead to data errors.\n\nAre you sure you want to disable it?";
            showCustomDialog({
                title: "Warning!",
                message: message,
                showCancelButton: true,
                onCancel: () => {
                    autoIncrementCheckbox.checked = true; 
                }
            });
        }
    });

    primaryKeyCheckbox.addEventListener('change', () => {
        if (!primaryKeyCheckbox.checked) {
            const message = "Warning: Changing a Primary Key can affect table relationships and data integrity.\n\nAre you sure you want to proceed?";
            showCustomDialog({
                title: "Warning!",
                message: message,
                showCancelButton: true,
                onCancel: () => {
                    primaryKeyCheckbox.checked = true;
                }
            });
        }
    });
    
    requiredCheckbox.addEventListener('change', () => {
        if (requiredCheckbox.checked && autoIncrementCheckbox.checked) {
            let message = "Changing this option will disable 'Auto Increment'.\n\n- Auto Increment: The value is provided automatically by the database.\n- Required: The value must be provided manually by the user.\n\n";
            const isPrimaryKey = primaryKeyCheckbox.checked;
            if (isPrimaryKey) {
                message += "Recommendation: A Primary Key field should remain 'Auto Increment'.\n\n";
            }
            message += "Are you sure you want to switch to 'Required'?";
            showCustomDialog({
                title: "Confirmation", message: message, showCancelButton: true,
                onOk: () => { autoIncrementCheckbox.checked = false; },
                onCancel: () => { requiredCheckbox.checked = false; }
            });
        }
    });

    readOnlyCheckbox.addEventListener('change', () => {
        if (!readOnlyCheckbox.checked && autoIncrementCheckbox.checked) {
            readOnlyCheckbox.checked = true;
            showCustomDialog({
                title: "Validation Rule",
                message: "A field with 'Auto Increment' must remain 'Read Only'."
            });
        }
    });
}

/**
 * Strips invalid characters as the user types in numeric and identifier (table/module/field name) inputs.
 * @returns {void}
 */
export function initializeRealtimeValidation() {
    const numericInputs = [
        document.getElementById('fld-length'),
        document.getElementById('fld-precision')
    ];

    numericInputs.forEach(input => {
        if (input) {
            input.addEventListener('input', () => {
                input.value = input.value.replace(/[^0-9]/g, '');
            });
        }
    });

    const tableNameInput = document.getElementById('tbl-table-name');
    const moduleNameInput = document.getElementById('tbl-module-name');
    const fieldNameInput = document.getElementById('fld-field-name');

    // Restricts an identifier input to letters/underscore and restores the last valid value on empty blur.
    const setupNameValidation = (inputElement) => {
        if (!inputElement) return;
        let previousValidValue = '';
        inputElement.addEventListener('focus', () => {
            previousValidValue = inputElement.value;
        });
        inputElement.addEventListener('input', () => {
            inputElement.value = inputElement.value.replace(/[^a-zA-Z_]/g, '');
        });
        inputElement.addEventListener('blur', () => {
            if (inputElement.value.trim() === '') {
                inputElement.value = previousValidValue;
            }
        });
    };

    setupNameValidation(tableNameInput);
    setupNameValidation(moduleNameInput);
    setupNameValidation(fieldNameInput);
}

/**
 * Validates unique-checkbox changes against field type/population state and reverts invalid toggles.
 * @returns {void}
 */
export function initializeUniqueFieldHandler() {
    const uniqueCheckbox = document.getElementById('fld-unique');
    if (!uniqueCheckbox) return;

    let previousValue = uniqueCheckbox.checked;

    uniqueCheckbox.addEventListener('focus', () => {
        previousValue = uniqueCheckbox.checked;
    });

    uniqueCheckbox.addEventListener('change', () => {
        if (appState.isPopulatingData) return;

        const [tableName, fieldName] = document.querySelector('#field-settings-page .field-name').textContent.split('.');
        const tableData = appState.jsonData.database.table[tableName];
        if (!tableData) return;
        
        const isNowChecked = uniqueCheckbox.checked;

        const relationship = appState.jsonData.database.relationships.find(
            rel => rel.child_table_name === tableName && rel.fk_child_field === fieldName
        );

        const relevantConstraints = (tableData.constraints || []).filter(
            c => c.constraint_type === 'UNIQUE' && JSON.parse(c.columns).includes(fieldName)
        );

        const singleUniqueConstraint = relevantConstraints.find(c => JSON.parse(c.columns).length === 1);

        let action = 'doNothing';
        let message = '';
        let newType = '';

        if (isNowChecked) { 
            if (singleUniqueConstraint) {
                action = 'doNothing';
            } else if (relevantConstraints.length > 0) {
                action = 'revert';
                message = `This field is already part of a composite unique constraint. Making it individually unique may be unnecessary.\n\nChange reverted.`;
            } else if (relationship) {
                action = 'confirmAndUpdate';
                newType = 'one-to-one';
                message = `Are you sure you want to change the relationship with the '${relationship.parent_table_name}' table to 'one-to-one'?`;
            }
        } else { 
            if (singleUniqueConstraint && relationship) {
                action = 'confirmAndUpdate';
                newType = 'one-to-many';
                message = `Are you sure you want to change the relationship with the '${relationship.parent_table_name}' table to 'one-to-many'?`;
            } else if (relevantConstraints.length > 0) {
                action = 'revert';
                message = `This field is part of a composite unique constraint. To remove its unique status, you need to modify the table definition.\n\nChange reverted.`;
            }
        }

        switch (action) {
            case 'confirmAndUpdate':
                showCustomDialog({
                    title: "Confirm Relationship Change",
                    message: message,
                    showCancelButton: true,
                    onOk: () => {
                        SaveManager.addToQueue('relationships', relationship.relationship_id, {
                            relationship_type: newType
                        });
                        previousValue = isNowChecked;
                    },
                    onCancel: () => {
                        uniqueCheckbox.checked = previousValue;
                    }
                });
                break;
            case 'revert':
                showCustomDialog({ title: "Notice", message: message });
                uniqueCheckbox.checked = previousValue; 
                break;
            case 'doNothing':
            default:
                previousValue = isNowChecked; 
                break;
        }
    });
}

/**
 * Pushes index on/off changes for the current field straight to the backend via updateFieldIndex.
 * @returns {void}
 */
export function initializeIndexCheckboxHandler() {
    const indexCheckbox = document.getElementById('fld-is-indexed');
    if (!indexCheckbox) return;

    indexCheckbox.addEventListener('change', () => {
        if (appState.isPopulatingData) return;

        const [tableName, fieldName] = document.querySelector('#field-settings-page .field-name').textContent.split('.');
        const fieldData = appState.jsonData.database.table[tableName]?.fields[fieldName];
        if (!fieldData) return;

        window.electronAPI.updateFieldIndex({
            field_id: fieldData.field_id,
            is_indexed: indexCheckbox.checked
        });
    });
}

/**
 * Blocks unchecking 'wrap text' on JSON fields so table-view stays readable.
 * @returns {void}
 */
export function initializeWrapTextRule() {
    const wrapTextCheckbox = document.getElementById('fld-tv-wrap-text');
    if (!wrapTextCheckbox) return;

    wrapTextCheckbox.addEventListener('click', (event) => {
        const dataTypeSelect = document.getElementById('fld-data-type');
        const currentDataType = dataTypeSelect.value.toUpperCase();

        if (currentDataType === 'JSON' && !wrapTextCheckbox.checked) {
            event.preventDefault(); 
            showCustomDialog({
                title: "Validation Rule",
                message: "The 'Enable wrap text' option must remain checked for the JSON data type to ensure readability in table view."
            });
        }
    });
}

/**
 * Applies sensible display defaults (center alignment, danger icon, description) for YouTube/gmap media.
 * @returns {void}
 */
export function initializeMediaTypeDefaultRules() {
    const mediaRadios = document.querySelectorAll('input[name="fld-media-type"]');
    if (!mediaRadios.length) return;

    mediaRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            const selectedValue = radio.value;
            
            if (selectedValue === 'youtube' || selectedValue === 'gmap') {
                const alignmentSelect = document.getElementById('fld-tv-alignment');
                const iconColorSelect = document.getElementById('fld-tv-icon-color');
                const descriptionTextarea = document.getElementById('fld-description');

                if (alignmentSelect) {
                    alignmentSelect.value = 'center';
                    alignmentSelect.dispatchEvent(new Event('change', { bubbles: true }));
                }
                if (iconColorSelect) {
                    iconColorSelect.value = 'danger';
                    iconColorSelect.dispatchEvent(new Event('change', { bubbles: true }));
                }
                if (descriptionTextarea) {
                    descriptionTextarea.value = 'Show youtube video/google maps location';
                    descriptionTextarea.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }
        });
    });
}

/**
 * Auto-checks 'wrap text' when the data type changes to TEXT/LONGTEXT.
 * @returns {void}
 */
export function initializeDataTypeDefaultRules() {
    const dataTypeSelect = document.getElementById('fld-data-type');
    if (!dataTypeSelect) return;

    dataTypeSelect.addEventListener('change', () => {
        const selectedType = dataTypeSelect.value.toUpperCase();
        
        if (selectedType === 'TEXT' || selectedType === 'LONGTEXT') {
            const wrapTextCheckbox = document.getElementById('fld-tv-wrap-text');
            if (wrapTextCheckbox && !wrapTextCheckbox.checked) {
                wrapTextCheckbox.checked = true;
                wrapTextCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    });
}

/**
 * Queues an upsert or delete of the FK relationship when the lookup parent table is set or cleared.
 * @returns {void}
 */
export function initializeLookupFieldSaveHandler() {
    const parentTableSelect = document.getElementById('fld-lookup-parent-table');
    if (!parentTableSelect) return;

    parentTableSelect.addEventListener('change', () => {
		if (appState.isPopulatingData) return;
		if (!appState.isAutoSaveEnabled) return;
        
        const parentTableName = parentTableSelect.value;
        const [childTableName, fk_child_field] = document.querySelector('#field-settings-page .field-name').textContent.split('.');
        
        if (parentTableName) {
            SaveManager.addToQueue('upsertRelationship', null, {
                parentTableName,
                childTableName,
                fk_child_field
            });
        } else {
            SaveManager.addToQueue('deleteRelationship', null, {
                childTableName,
                fk_child_field
            });
        }
    });
}