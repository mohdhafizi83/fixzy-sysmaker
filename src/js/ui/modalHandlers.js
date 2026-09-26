// js/ui/modalHandlers.js

import { setIsCoreLockingEnabled, appState } from '../state.js';
import { applyFontSize } from './formHelpers.js';
import { showToast } from './toast.js';

/**
 * Displays a custom dialog (Alert/Confirm).
 * Supports Promises (await) and legacy callbacks.
 */
export function showCustomDialog({ title, message, onOk, onCancel, showCancelButton = false }) {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-alert-modal');
        const titleEl = document.getElementById('custom-alert-title');
        const messageEl = document.getElementById('custom-alert-message');
        const okBtn = document.getElementById('custom-alert-ok-btn');
        const cancelBtn = document.getElementById('custom-alert-cancel-btn');
        const closeBtn = document.getElementById('custom-alert-close');

        titleEl.textContent = title || 'Notification';
        messageEl.textContent = message;
        cancelBtn.style.display = showCancelButton ? 'inline-block' : 'none';

        // Clone buttons to ensure old event listeners are removed
        const newOkBtn = okBtn.cloneNode(true);
        okBtn.parentNode.replaceChild(newOkBtn, okBtn);
        const newCancelBtn = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
        const newCloseBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);

        const closeModalAndResolve = (result) => {
            modal.classList.add('hidden');
            
            // 1. Resolve the promise for new asynchronous code
            resolve(result);

            // 2. Execute old callbacks for backward compatibility
            if (result && typeof onOk === 'function') {
                onOk();
            }
            if (!result && typeof onCancel === 'function') {
                onCancel();
            }
        };

        newOkBtn.addEventListener('click', () => closeModalAndResolve(true), { once: true });
        newCancelBtn.addEventListener('click', () => closeModalAndResolve(false), { once: true });
        newCloseBtn.addEventListener('click', () => closeModalAndResolve(false), { once: true });

        modal.classList.remove('hidden');
    });
}

/**
 * Manages the Configuration (Preferences) modal.
 */
export function initializeModalHandlers() {
    const configBtn = document.getElementById('config-btn');
    const configModal = document.getElementById('config-modal');
    const configModalClose = document.getElementById('config-modal-close');
    const configModalCancel = document.getElementById('config-modal-cancel');
    const configModalOk = document.getElementById('config-modal-ok');
    
    // Logik checkbox lock core components
    const lockCoreCheckbox = document.getElementById('fixzy-lock-core-components');
    if (lockCoreCheckbox) {
        lockCoreCheckbox.addEventListener('click', () => {
            if (!lockCoreCheckbox.checked) {
                showCustomDialog({
                    title: "Are you sure?",
                    message: "This is highly discouraged and there is no guarantee the final generated application will work properly.",
                    showCancelButton: true,
                    onOk: () => { /* User agreed */ },
                    onCancel: () => { lockCoreCheckbox.checked = true; }
                });
            }
        });
    }

    const gatherFixzySettings = () => {
        const settings = {};
        const settingIds = [
            'check-updates', 'autosave-interval', 'show-begin-box', 'doc-root',
            'base-url', 'field-default-type', 'field-default-length', 'table-suggest-icon',
            'table-allow-csv', 'table-dv-separate-page', 'table-hide-save-as-copy',
            'table-allow-add-from-homepage', 'table-show-record-count', 'project-encoding',
            'project-rtl', 'project-doxygen', 'project-hide-footer', 'max-entries', 'project-no-trim',
            'lock-core-components'
        ];

        settingIds.forEach(id => {
            const element = document.getElementById(`fixzy-${id}`);
            if (element) {
                const settingKey = id.replace(/-/g, '_');
                if (element.type === 'checkbox') {
                    settings[settingKey] = element.checked ? '1' : '0';
                } else {
                    settings[settingKey] = element.value;
                }
            }
        });
        
        const fontSize = document.querySelector('input[name="fixzy-font-size"]:checked');
        if (fontSize) {
            settings.font_size = fontSize.value;
        }

        // Global layout defaults (Layout defaults tab). The form layout is
        // stored as a compact JSON {style, columns}; empty string = no
        // global form layout (tables keep the legacy default form).
        settings.global_tv_template = document.getElementById('fixzy-global-tv-template')?.value || 'horizontal';
        settings.global_card_columns = document.getElementById('fixzy-global-card-columns')?.value || '3';
        const gStyle = document.getElementById('fixzy-global-form-style')?.value || 'default';
        const gCols = parseInt(document.getElementById('fixzy-global-form-columns')?.value, 10) || 0;
        settings.global_form_layout_config = (gStyle === 'default' && gCols === 0) ? '' : JSON.stringify({ style: gStyle, columns: gCols });

        // Child relation layout defaults (2026-09-26). '' = inherit the
        // child table's own layout (legacy behaviour).
        settings.global_child_tv_template = document.getElementById('fixzy-global-child-tv-template')?.value || '';
        settings.global_child_card_columns = document.getElementById('fixzy-global-child-card-columns')?.value || '';
        settings.global_child_form_style = document.getElementById('fixzy-global-child-form-style')?.value || '';

        return settings;
    };
    
    // Internal helper to populate settings (originally populateSettingsModal)
    const populateSettingsModalInternal = async () => {
        const settings = await window.electronAPI.getAllSettings();
        if (!settings) return;

        const setValue = (id, value) => {
            const element = document.getElementById(id);
            if (element) {
                if (element.type === 'checkbox') element.checked = value === '1';
                else element.value = value;
            }
        };
        
        // Simple loop to fill the data (refer to the original code for the full list if needed)
        // Summarized here for readability; you can copy the full logic from uiHandlers.js
        const settingIds = [
            'check-updates', 'autosave-interval', 'show-begin-box', 'lock-core-components',
            'doc-root', 'base-url', 'field-default-type', 'field-default-length', 
            'table-suggest-icon', 'table-allow-csv', 'table-dv-separate-page', 
            'table-hide-save-as-copy', 'table-allow-add-from-homepage', 'table-show-record-count',
            'project-encoding', 'project-rtl', 'project-doxygen', 'project-hide-footer', 
            'max-entries', 'project-no-trim'
        ];
        
        settingIds.forEach(id => setValue(`fixzy-${id}`, settings[id.replace(/-/g, '_')]));

        const fontSizeRadio = document.querySelector(`input[name="fixzy-font-size"][value="${settings.font_size}"]`);
        if (fontSizeRadio) fontSizeRadio.checked = true;

        // Layout defaults tab
        setValue('fixzy-global-tv-template', settings.global_tv_template || 'horizontal');
        setValue('fixzy-global-card-columns', settings.global_card_columns || '3');
        let gStyle = 'default', gCols = 0;
        if (settings.global_form_layout_config) {
            try {
                const cfg = JSON.parse(settings.global_form_layout_config);
                if (cfg && typeof cfg === 'object') {
                    gStyle = cfg.style || 'default';
                    gCols = Number.isInteger(cfg.columns) ? cfg.columns : 0;
                }
            } catch (e) { /* treat as unset */ }
        }
        setValue('fixzy-global-form-style', gStyle);
        setValue('fixzy-global-form-columns', String(gCols));
        toggleGlobalCardColumnsGroup();

        // Child relation layout defaults tab section
        setValue('fixzy-global-child-tv-template', settings.global_child_tv_template || '');
        setValue('fixzy-global-child-card-columns', settings.global_child_card_columns || '');
        setValue('fixzy-global-child-form-style', settings.global_child_form_style || '');
        toggleGlobalChildCardColumnsGroup();
    };

    // Card-columns selector only makes sense when the template is Card grid.
    const toggleGlobalCardColumnsGroup = () => {
        const group = document.getElementById('fixzy-global-card-columns-group');
        const tpl = document.getElementById('fixzy-global-tv-template');
        if (group && tpl) group.style.display = tpl.value === 'card' ? '' : 'none';
    };
    const globalTplSelect = document.getElementById('fixzy-global-tv-template');
    if (globalTplSelect) globalTplSelect.addEventListener('change', toggleGlobalCardColumnsGroup);

    // Child card-columns selector only makes sense when the child template is Card grid.
    const toggleGlobalChildCardColumnsGroup = () => {
        const group = document.getElementById('fixzy-global-child-card-columns-group');
        const tpl = document.getElementById('fixzy-global-child-tv-template');
        if (group && tpl) group.style.display = tpl.value === 'card' ? '' : 'none';
    };
    const globalChildTplSelect = document.getElementById('fixzy-global-child-tv-template');
    if (globalChildTplSelect) globalChildTplSelect.addEventListener('change', toggleGlobalChildCardColumnsGroup);

    // "Apply to Existing Tables" — pushes the saved global defaults onto
    // every eligible table in the active project (destructive: confirm first).
    const applyBtn = document.getElementById('btn-apply-global-layout');
    if (applyBtn) {
        applyBtn.addEventListener('click', async () => {
            const applyView = document.getElementById('fixzy-apply-view')?.checked;
            const applyForm = document.getElementById('fixzy-apply-form')?.checked;
            const applyChild = document.getElementById('fixzy-apply-child')?.checked;
            if (!applyView && !applyForm && !applyChild) {
                showToast('Tick at least one "Apply" option first.', 'warning');
                return;
            }
            if (!appState.activeProject || !appState.activeProject.project_id) {
                showToast('No active project — open a project first.', 'error');
                return;
            }
            const confirmed = await showCustomDialog({
                title: 'Apply global layout defaults?',
                message: 'This overwrites the Table List template and/or Record Form layout of every non-core table in the current project. Per-module overrides are kept. This cannot be undone from here.',
                showCancelButton: true
            });
            if (!confirmed) return;

            // Persist the current modal values first so we apply what the user sees.
            const saveRes = await window.electronAPI.saveAllSettings(gatherFixzySettings());
            if (!saveRes || !saveRes.success) {
                showToast(`Failed to save settings: ${saveRes && saveRes.message}`, 'error');
                return;
            }

            const res = await window.electronAPI.applyGlobalLayout({
                projectId: appState.activeProject.project_id,
                applyTableView: !!applyView,
                applyFormLayout: !!applyForm,
                applyChildLayout: !!applyChild
            });
            if (res && res.success) {
                showToast(`Applied to ${res.updated} table(s); ${res.skipped} core/feature table(s) skipped.`, 'success');
            } else {
                showToast(`Apply failed: ${res && res.message}`, 'error');
            }
        });
    }
    
    if (configBtn) {
        configBtn.addEventListener('click', async () => {
            await populateSettingsModalInternal();
            configModal?.classList.remove('hidden');
        });
    }

    const closeModal = () => configModal?.classList.add('hidden');

    if (configModalClose) configModalClose.addEventListener('click', closeModal);
    if (configModalCancel) configModalCancel.addEventListener('click', closeModal);

    if (configModalOk) {
        configModalOk.addEventListener('click', async () => {
            const settingsData = gatherFixzySettings();
            const result = await window.electronAPI.saveAllSettings(settingsData);
            
            if (result.success) {
                applyFontSize(settingsData.font_size); 
                setIsCoreLockingEnabled(settingsData.lock_core_components === '1');
                showCustomDialog({ title: "Success", message: "Preferences have been saved." });
            } else {
                showCustomDialog({ title: "Error", message: `Failed to save preferences: ${result.message}` });
            }
            
            closeModal();
        });
    }
}

async function populateSettingsModal() {
    const settings = await window.electronAPI.getAllSettings();
    if (!settings) {
        console.error("Could not load settings.");
        return;
    }

    const setValue = (id, value) => {
        const element = document.getElementById(id);
        if (element) {
            if (element.type === 'checkbox') {
                element.checked = value === '1';
            } else {
                element.value = value;
            }
        }
    };
    
    // General
    setValue('fixzy-check-updates', settings.check_updates);
    setValue('fixzy-autosave-interval', settings.autosave_interval);
    setValue('fixzy-show-begin-box', settings.show_begin_box);
	setValue('fixzy-lock-core-components', settings.lock_core_components);
    const fontSizeRadio = document.querySelector(`input[name="fixzy-font-size"][value="${settings.font_size}"]`);
    if (fontSizeRadio) fontSizeRadio.checked = true;
    setValue('fixzy-doc-root', settings.doc_root);
    setValue('fixzy-base-url', settings.base_url);
    // Field defaults
    setValue('fixzy-field-default-type', settings.field_default_type);
    setValue('fixzy-field-default-length', settings.field_default_length);
    // Table defaults
    setValue('fixzy-table-suggest-icon', settings.table_suggest_icon);
    setValue('fixzy-table-allow-csv', settings.table_allow_csv);
    setValue('fixzy-table-dv-separate-page', settings.table_dv_separate_page);
    setValue('fixzy-table-hide-save-as-copy', settings.table_hide_save_as_copy);
    setValue('fixzy-table-allow-add-from-homepage', settings.table_allow_add_from_homepage);
    setValue('fixzy-table-show-record-count', settings.table_show_record_count);
    // Project defaults
    setValue('fixzy-project-encoding', settings.project_encoding);
    setValue('fixzy-project-rtl', settings.project_rtl);
    setValue('fixzy-project-doxygen', settings.project_doxygen);
    setValue('fixzy-project-hide-footer', settings.project_hide_footer);
    setValue('fixzy-max-entries', settings.max_entries);
    setValue('fixzy-project-no-trim', settings.project_no_trim);
}
