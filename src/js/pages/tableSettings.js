// js/pages/tableSettings.js

import { setElementValue, setRadioValue } from '../ui/formHelpers.js'; 
import { renderApprovalTab } from '../features/approvalManager.js';
import { renderAutomationTab } from '../features/schedulerManager.js';
import { renderPublicFormTab } from '../features/publicFormManager.js';
import { renderFormLayoutTab } from '../features/formLayoutDesigner.js';
import { renderNumberingSection } from '../features/numberingManager.js';
import { renderImportSection } from '../features/importManager.js';
import { renderApiSection } from '../features/apiManager.js';
import { appState, setLastActiveChildTable } from '../state.js';
import { loadProjectData, SaveManager } from '../../renderer.js';
import { 
    populateSortByDropdown,
    populateFocusFieldDropdown,
    populateRecordOwnerDropdown,
    populateCustomViewsTab,
    populateConstraintsTab,
    updateTableViewTemplatePreview,
    toggleCardSizeGroup,
    populateGridGroupByDropdown,
    renderGridSummaryRows,
    renderGridColumnGroupRows,
    populateCalendarFieldDropdowns,
    populateTreeFieldDropdowns,
    populateKanbanDropdowns
} from '../uiHandlers.js';

/**
 * Populates every tab of the table settings page for the given table.
 * @param {string} tableName Table whose settings are loaded.
 * @returns {void}
 */
export function populateTableSettings(tableName) {

    populateSortByDropdown(tableName);
    populateFocusFieldDropdown(tableName);
    populateRecordOwnerDropdown(tableName);
    populateGridGroupByDropdown(tableName);
	populateCustomViewsTab(tableName);
    populateConstraintsTab(tableName);
    
    populateParentChildTab(tableName);
		
    const tableData = appState.jsonData.database.table[tableName];
    if (!tableData) {
        console.error(`No data found for table: ${tableName}`);
        return;
    }
	//console.log(tableData);
    setElementValue('tbl-table-name', tableData.table_name);
    setElementValue('tbl-module-name', tableData.module_name);
    // Tab: Table view -> General
    setElementValue('tbl-table-view-title', tableData.table_view_title);
    setElementValue('tbl-table-description', tableData.table_description);

// Tab: Table view -> Features
    setElementValue('tbl-show-quick-search', tableData.show_quick_search);
    setElementValue('tbl-allow-pagination', tableData.allow_pagination);
    setRadioValue('tbl-pagination-type', tableData.pagination_type);
    setElementValue('tbl-default-sort-by', tableData.default_sort_by);
    setElementValue('tbl-sort-descending', tableData.sort_descending);
    setElementValue('tbl-allow-csv-export', tableData.allow_csv_export);
    setElementValue('tbl-allow-print-view', tableData.allow_print_view);
    setElementValue('tbl-allow-mass-delete', tableData.allow_mass_delete);

    // ▼▼▼ NEW LOGIC: DISABLE IMPORT FOR CUSTOM MODULES ▼▼▼
    const importCheckbox = document.getElementById('tbl-allow-csv-import');
    if (importCheckbox) {
        // Check whether we are currently in Custom Module mode
        const isWorkspaceActive = !document.getElementById('module-global-settings')?.classList.contains('hidden');
        const badgeEl = document.getElementById('workspace-module-badge');
        const isCustomModule = isWorkspaceActive && badgeEl && badgeEl.classList.contains('badge-custom');

        if (isCustomModule) {
            importCheckbox.checked = false; // Untick
            importCheckbox.disabled = true; // Freeze it
            if (importCheckbox.parentElement) {
                importCheckbox.parentElement.title = "Import is disabled for Custom Modules to preserve the integrity of the filter rules data.";
            }
        } else {
            importCheckbox.disabled = false; // Re-enable for Default Modules
            if (importCheckbox.parentElement) importCheckbox.parentElement.title = "";
            setElementValue('tbl-allow-csv-import', tableData.allow_csv_import);
        }
    }
    // ▲▲▲ END IMPORT LOGIC ▲▲▲

    // ▼▼▼ GOOGLE SHEETS SYNC: custom tables only, module must be enabled ▼▼▼
    const gsyncCheckbox = document.getElementById('tbl-google-sync-enabled');
    if (gsyncCheckbox) {
        const moduleEnabled = Number(appState.activeProject.module_google_sheets) === 1;
        const isCoreTable = tableData.table_name === 'users'
            || (tableData.feature_source && String(tableData.feature_source).trim() !== '');
        const labelEl = document.getElementById('lbl-tbl-google-sync');

        if (!moduleEnabled) {
            gsyncCheckbox.checked = false;
            gsyncCheckbox.disabled = true;
            if (labelEl) labelEl.title = "Enable the Google Sheets Sync module in the project's Core Features tab first.";
        } else if (isCoreTable) {
            gsyncCheckbox.checked = false;
            gsyncCheckbox.disabled = true;
            if (labelEl) labelEl.title = "Google Sheets sync is only available for custom tables (not core or feature-generated tables).";
        } else {
            gsyncCheckbox.disabled = false;
            if (labelEl) labelEl.title = "";
            setElementValue('tbl-google-sync-enabled', tableData.google_sync_enabled);
        }
    }
    // ▲▲▲ END GOOGLE SHEETS SYNC LOGIC ▲▲▲
    
    setElementValue('tbl-show-edit-button', tableData.show_edit_button);
    setElementValue('tbl-show-delete-button', tableData.show_delete_button);
    setElementValue('tbl-allow-restore-delete', tableData.allow_restore_delete);
    setElementValue('tbl-allow-force-delete', tableData.allow_force_delete);

    // Grid expansion options (2026-09-25)
    setElementValue('tbl-grid-column-manager', tableData.grid_column_manager ?? 1);
    setElementValue('tbl-grid-sticky-header', tableData.grid_sticky_header ?? 0);
    setElementValue('tbl-grid-row-density', tableData.grid_row_density || 'normal');
    setElementValue('tbl-grid-inline-edit', tableData.grid_inline_edit ?? 0);
    setElementValue('tbl-grid-default-per-page', tableData.grid_default_per_page || 10);
    setElementValue('tbl-grid-per-page-options', tableData.grid_per_page_options || '5,10,25,50');

    // Grid layout expansion phase A (2026-09-25)
    setElementValue('tbl-grid-group-by', tableData.grid_group_by || '');
    setElementValue('tbl-grid-group-direction', tableData.grid_group_direction || 'asc');
    setElementValue('tbl-grid-summaries', tableData.grid_summaries || '');
    renderGridSummaryRows();
    setElementValue('tbl-grid-row-click', tableData.grid_row_click || 'page');
    setElementValue('tbl-grid-empty-heading', tableData.grid_empty_heading || '');
    setElementValue('tbl-grid-empty-icon', tableData.grid_empty_icon || '');
    setElementValue('tbl-grid-empty-description', tableData.grid_empty_description || '');
    // Phase B (2026-09-25): striping, borders, width, sticky chrome, column groups
    setElementValue('tbl-grid-row-striping', tableData.grid_row_striping ?? 0);
    setElementValue('tbl-grid-border-style', tableData.grid_border_style || 'default');
    setElementValue('tbl-grid-content-width', tableData.grid_content_width || 'full');
    setElementValue('tbl-grid-sticky-toolbar', tableData.grid_sticky_toolbar ?? 0);
    setElementValue('tbl-grid-sticky-footer', tableData.grid_sticky_footer ?? 0);
    setElementValue('tbl-grid-column-groups', tableData.grid_column_groups || '');
    renderGridColumnGroupRows();
    // Phase C (2026-09-25): multi-view switcher
    setElementValue('tbl-grid-multi-view', tableData.grid_multi_view ?? 0);
    setElementValue('tbl-grid-view-default', tableData.grid_view_default || 'table');
    // Phase D1 (2026-09-25): split view
    setElementValue('tbl-grid-split-view', tableData.grid_split_view ?? 0);
    // Phase D2 (2026-09-25): calendar view
    setElementValue('tbl-grid-calendar-enabled', tableData.grid_calendar_enabled ?? 0);
    setElementValue('tbl-grid-calendar-config', tableData.grid_calendar_config || '');
    populateCalendarFieldDropdowns(tableName);
    // Phase D3 (2026-09-25): tree view
    setElementValue('tbl-grid-tree-enabled', tableData.grid_tree_enabled ?? 0);
    setElementValue('tbl-grid-tree-config', tableData.grid_tree_config || '');
    populateTreeFieldDropdowns(tableName);
    // Phase D4 (2026-09-25): kanban board
    setElementValue('tbl-grid-kanban-enabled', tableData.grid_kanban_enabled ?? 0);
    setElementValue('tbl-grid-kanban-config', tableData.grid_kanban_config || '');
    populateKanbanDropdowns(tableName);

    // Logic to disable soft-delete features if the project uses hard delete
    const isHardDelete = appState.activeProject.data_delete_type === 'hard';
    const restoreCheckbox = document.getElementById('tbl-allow-restore-delete');
    const forceDeleteCheckbox = document.getElementById('tbl-allow-force-delete');

    if (restoreCheckbox) restoreCheckbox.disabled = isHardDelete;
    if (forceDeleteCheckbox) forceDeleteCheckbox.disabled = isHardDelete;
    
    const paginationCheckbox = document.getElementById('tbl-allow-pagination');
    const recordsPerPageGroup = document.getElementById('records-per-page-group');

    if (paginationCheckbox && recordsPerPageGroup) {
        // Hides the per-page input groups until pagination is enabled.
        const toggleVisibility = () => {
            recordsPerPageGroup.classList.toggle('hidden', !paginationCheckbox.checked);
            // Grid per-page choices only make sense when pagination is on
            const gridPerPageGroup = document.getElementById('grid-per-page-group');
            if (gridPerPageGroup) gridPerPageGroup.classList.toggle('hidden', !paginationCheckbox.checked);
        };

        // Attach the listener ONLY if it hasn't been attached yet
        if (!paginationCheckbox.dataset.listenerAttached) {
            paginationCheckbox.addEventListener('change', toggleVisibility);
            paginationCheckbox.dataset.listenerAttached = 'true';
        }
        
        // Run the logic once to set the correct initial state
        toggleVisibility();
    }

    // ▼▼▼ CUSTOM MODULE: features not generated per custom module are
    // disabled with an explicit reason (silent-hide would look like a bug).
    const cmWsActive = !document.getElementById('module-global-settings')?.classList.contains('hidden');
    const cmBadge = document.getElementById('workspace-module-badge');
    const cmIsCustom = cmWsActive && cmBadge && cmBadge.classList.contains('badge-custom');
    const unsupportedInCustom = {
        'tbl-approval-enabled': 'Approvals run per table (main module) and are not generated for Custom Modules.',
        'tbl-api-enabled': 'REST API is generated per table (main module), not per Custom Module.',
        'tbl-public-form-enabled': 'Public forms are generated per table (main module), not per Custom Module.',
        'tbl-numbering-enabled': 'Auto numbering is a table-level (main module) feature.',
    };
    Object.entries(unsupportedInCustom).forEach(([id, reason]) => {
        const cb = document.getElementById(id);
        if (!cb) return;
        if (cmIsCustom) {
            if (cb.dataset.cmPrevDisabled === undefined) cb.dataset.cmPrevDisabled = cb.disabled ? '1' : '0';
            cb.disabled = true;
            if (cb.parentElement) cb.parentElement.title = reason;
        } else if (cb.dataset.cmPrevDisabled !== undefined) {
            cb.disabled = cb.dataset.cmPrevDisabled === '1';
            delete cb.dataset.cmPrevDisabled;
            if (cb.parentElement && cb.parentElement.title === reason) cb.parentElement.title = '';
        }
    });
    // ▲▲▲ END CUSTOM MODULE feature gating ▲▲▲

    // Tab: Table view -> Template
    setElementValue('tbl-tv-template', tableData.tv_template);
    setElementValue('tbl-card-columns', tableData.card_columns);
    setElementValue('tbl-card-columns-tablet', tableData.card_columns_tablet);
    toggleCardSizeGroup();
    setElementValue('tbl-hide-field-captions', tableData.hide_field_captions);
    setElementValue('tbl-use-first-field-as-title', tableData.use_first_field_as_title);
    setElementValue('tbl-table-view-classes-input', tableData.table_view_classes_input);
    setElementValue('tbl-detail-view-classes-input', tableData.detail_view_classes_input);
    
    // Tab: Detail View -> General
    setElementValue('tbl-detail-view-title', tableData.detail_view_title);
    setElementValue('tbl-record-owner', tableData.record_owner);
    setElementValue('tbl-default-focus', tableData.default_focus);
    setElementValue('tbl-redirect-after-insert', tableData.redirect_after_insert);

    // Tab: Detail View -> Permissions
    setElementValue('tbl-enable-detail-view', tableData.enable_detail_view);
    setElementValue('tbl-delete-with-children', tableData.delete_with_children);
    setElementValue('tbl-dv-allow-print-view', tableData.dv_allow_print_view);
    setElementValue('tbl-dv-separate-page', tableData.dv_separate_page);
    setElementValue('tbl-dv-hide-save-as-copy', tableData.dv_hide_save_as_copy);
    setElementValue('tbl-dv-sticky-buttons', tableData.dv_sticky_buttons);
    setElementValue('tbl-dv-allow-add-from-homepage', tableData.dv_allow_add_from_homepage);
    
    setRadioValue('tbl-column-grid-type', tableData.column_grid_type || 'dynamic');
    setElementValue('tbl-static-grid-columns', tableData.static_grid_columns);
    
    // Fire an event to make sure the disabled/enabled state is correct on load
    const gridRadios = document.querySelectorAll('input[name="tbl-column-grid-type"]');
    if (gridRadios.length > 0) {
        gridRadios[0].dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    setElementValue('tbl-hook-logic', tableData.table_hook_workflow); // Populate workflow data
    setElementValue('tbl-approval-enabled', tableData.approval_enabled);
    setElementValue('tbl-attachments-enabled', tableData.attachments_enabled);
    setElementValue('tbl-numbering-enabled', tableData.numbering_enabled);
    renderApprovalTab(tableData);
    renderAutomationTab(tableData);
    renderPublicFormTab(tableData);
    renderFormLayoutTab(tableData);
    renderNumberingSection(tableData);
    renderImportSection(tableData);
    renderApiSection(tableData);
	
    const tvClassesInput = document.getElementById('tbl-table-view-classes-input');
    const tvClassesSelect = document.getElementById('table-view-classes-select');
    if (tvClassesInput && tvClassesSelect) {
        tvClassesSelect.value = tvClassesInput.value;
    }

    const dvClassesInput = document.getElementById('tbl-detail-view-classes-input');
    const dvClassesSelect = document.getElementById('detail-view-classes-select');
    if (dvClassesInput && dvClassesSelect) {
        dvClassesSelect.value = dvClassesInput.value;
	}
	
	updateTableViewTemplatePreview();
}

/**
 * Renders the Parent-Child tab: child table list and per-relationship display options form.
 * @param {string} currentTableName Parent table whose child relationships are shown.
 * @returns {void}
 */
export function populateParentChildTab(currentTableName) {
    const childList = document.getElementById('child-table-list');
    const listPanel = childList.parentElement; 
    const optionsPanel = listPanel.nextElementSibling;
    const optionsTitle = document.getElementById('selected-child-table-name');
    const formElements = {
        showTab: document.getElementById('parentchild-show-tab'),
        showIcon: document.getElementById('parentchild-show-icon'),
        autocloseModal: document.getElementById('parentchild-autoclose-modal'),
        tabTitle: document.getElementById('parentchild-tab-title'),
        copyRecords: document.getElementById('parentchild-copy-records'),
        showLinkAbove: document.getElementById('parentchild-show-link-above'),
        showCount: document.getElementById('parentchild-show-count-in-tv'),
        allowAdd: document.getElementById('parentchild-allow-add-from-tv'),
        tvTemplate: document.getElementById('parentchild-tv-template'),
        cardColumns: document.getElementById('parentchild-card-columns'),
        formStyle: document.getElementById('parentchild-form-style')
    };
    
    if (!childList || !appState.jsonData.database.relationships || !optionsPanel) return;

    const children = appState.jsonData.database.relationships.filter(
        rel => rel.parent_table_name === currentTableName
    );

    childList.innerHTML = '';

    if (children.length === 0) {
        optionsPanel.classList.add('hidden');
        const emptyMessage = `
            <div class="empty-state-label" style="padding: 1rem; text-align: left;">
                <p style="text-align: center; font-weight: 500;">This table has no child tables.</p>
                <span style="display: block; text-align: center; margin-top: 0.5rem; font-size: 0.85em;">
                    To create a relationship, select the foreign key field in the side menu and set the 'Parent table' in the 'Lookup field' tab.
                </span>
            </div>
        `;
        childList.innerHTML = emptyMessage;
    } else {
        optionsPanel.classList.remove('hidden');
        Object.values(formElements).forEach(el => el.type === 'checkbox' ? el.checked = false : el.value = '');
        optionsTitle.textContent = '...';

        children.forEach(child => {
            const li = document.createElement('li');
            li.textContent = child.child_table_name;
            li.dataset.childName = child.child_table_name; // Make sure this dataset exists
            childList.appendChild(li);
        });
        
// Fills the relationship options form for the selected child table.
const populateForm = (childName) => {
            const relationData = children.find(c => c.child_table_name === childName);
            if (!relationData) return;
            optionsTitle.textContent = childName;

            // ▼▼▼ MODULE CONTEXT CHECK (CUSTOM OR DEFAULT?) ▼▼▼
            const isWorkspaceActive = !document.getElementById('module-global-settings')?.classList.contains('hidden');
            const badgeEl = document.getElementById('workspace-module-badge');
            const isCustomModule = isWorkspaceActive && badgeEl && badgeEl.classList.contains('badge-custom');
            
            let isIncluded = relationData.show_tab === 1; // Default value from Global

            if (isCustomModule) {
                const moduleIdStr = document.getElementById('workspace-module-title')?.dataset.moduleId;
                if (moduleIdStr) {
                    const moduleId = parseInt(moduleIdStr, 10);
                    const modData = appState.jsonData.database.table[currentTableName]?.custom_modules?.find(m => m.module_id === moduleId);
                    if (modData) {
                        let includedRels = [];
                        try { includedRels = JSON.parse(modData.included_relations || "[]"); } catch(e){}
                        // Tick the checkbox if this table name is in the included_relations array
                        isIncluded = includedRels.includes(childName);
                    }
                }
            }
            // ▲▲▲ END CHECK ▲▲▲

            formElements.showTab.checked = isIncluded;
            formElements.showIcon.checked = relationData.show_icon === 1;
            formElements.autocloseModal.checked = relationData.autoclose_modal === 1;
            formElements.tabTitle.value = relationData.tab_title || '';
            formElements.copyRecords.checked = relationData.copy_records === 1;
            formElements.showLinkAbove.checked = relationData.show_link_above === 1;
            formElements.showCount.checked = relationData.show_count_in_tv === 1;
            formElements.allowAdd.checked = relationData.allow_add_from_tv === 1;
            // Child relation layout overrides (2026-09-26). '' / 0 = inherit.
            if (formElements.tvTemplate) formElements.tvTemplate.value = relationData.tv_template || '';
            if (formElements.cardColumns) formElements.cardColumns.value = String(relationData.card_columns || 0);
            if (formElements.formStyle) formElements.formStyle.value = relationData.form_style || '';
            const cardGroup = document.getElementById('parentchild-card-columns-group');
            if (cardGroup) cardGroup.style.display = (formElements.tvTemplate && formElements.tvTemplate.value === 'card') ? '' : 'none';

            // Lock (disable) the other inputs so the user understands these are Global settings
            const inputsToDisable = [formElements.showIcon, formElements.autocloseModal, formElements.tabTitle, formElements.copyRecords, formElements.showLinkAbove, formElements.showCount, formElements.allowAdd, formElements.tvTemplate, formElements.cardColumns, formElements.formStyle];
            inputsToDisable.forEach(input => {
                if (input) {
                    input.disabled = isCustomModule;
                    if (isCustomModule) input.parentElement.title = "This visual setting is shared globally across modules.";
                    else input.parentElement.title = ""; // Reset
                }
            });
        };
        
        // Avoid adding event listeners repeatedly
        const newChildList = childList.cloneNode(true);
        childList.parentNode.replaceChild(newChildList, childList);

        newChildList.addEventListener('click', (event) => {
            if (event.target.tagName === 'LI') {
                newChildList.querySelectorAll('li').forEach(li => li.classList.remove('active'));
                event.target.classList.add('active');
                populateForm(event.target.dataset.childName);
            }
        });

        const itemToSelect = newChildList.querySelector(`li[data-child-name="${appState.lastActiveChildTable}"]`);

        if (itemToSelect) {
            itemToSelect.click();
        } else if (newChildList.firstChild && newChildList.firstChild.tagName === 'LI') {
            newChildList.firstChild.click();
        }
        
        // ▼▼▼ UPDATE: The code line below was removed ▼▼▼
        // setLastActiveChildTable(null); 
        // ▲▲▲ END UPDATE ▲▲▲
    }
}
