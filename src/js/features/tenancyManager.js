// src/js/features/tenancyManager.js
import { appState } from '../state.js';
import { SaveManager, loadProjectData } from '../../renderer.js'; 
import { showCustomDialog } from '../ui/modalHandlers.js';

class TenancyManager {
    constructor() {
        this.initialized = false;
        this.currentTenancyType = 'standard';
        // Modal DOM references
        this.modal = document.getElementById('tenancy-wizard-modal');
        this.closeBtn = document.getElementById('tenancy-wizard-close');
        this.cancelBtn = document.getElementById('tenancy-wizard-cancel');
        this.saveBtn = document.getElementById('tenancy-wizard-save');
        
        // UI DOM references
        this.radioHasTable = document.querySelectorAll('input[name="wizard_has_table"]');
        this.groupExistingTable = document.getElementById('wizard-existing-table-group');
        this.groupNewTable = document.getElementById('wizard-new-table-group');
        
        // Dashboard DOM references
        this.btnConfigure = document.getElementById('btn-configure-tenancy');
        this.btnEdit = document.getElementById('btn-edit-tenancy');
        this.summaryContainer = document.getElementById('tenancy-summary-container');
    }

    init() {
        if (this.initialized) return;
// Sync the internal tracker with the database when opened
        this.currentTenancyType = appState.activeProject?.tenancy_type || 'standard';
        
        this.attachEventListeners();
        this.initialized = true;
        console.log("TenancyManager initialized.");
    }

    attachEventListeners() {
        
// Use event delegation on document.body so it survives refreshes
        document.body.addEventListener('change', (e) => {
            if (e.target && e.target.name === 'app-tenancy_type') {
                this.handleTenancyTypeChange(e);
            }
        });
        // Toggle table type (Existing vs New)
        this.radioHasTable.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.value === 'yes') {
                    this.groupExistingTable.classList.remove('hidden');
                    this.groupNewTable.classList.add('hidden');
                } else {
                    this.groupExistingTable.classList.add('hidden');
                    this.groupNewTable.classList.remove('hidden');
                }
            });
        });

        // Open the modal
        if (this.btnConfigure) this.btnConfigure.addEventListener('click', () => this.openWizard());
        if (this.btnEdit) this.btnEdit.addEventListener('click', () => this.openWizard());

        // Close the modal
        if (this.closeBtn) this.closeBtn.addEventListener('click', () => this.closeWizard());
        if (this.cancelBtn) this.cancelBtn.addEventListener('click', () => this.closeWizard());

        // Save data
        if (this.saveBtn) this.saveBtn.addEventListener('click', () => this.processTenancySetup());
    }
        
    // Function to make sure the summary box (read-only) shows when the project first loads
    refreshUIState() {
        const tenantTable = appState.activeProject?.tenant_table;
        const tenancyType = appState.activeProject?.tenancy_type;

        if (tenantTable && tenancyType !== 'standard') {
            // Get the list of privacy tables dynamically
            const securedTables = Object.keys(appState.jsonData?.database?.table || {}).filter(tableName => {
                const fields = appState.jsonData.database.table[tableName].fields || {};
                return fields[`${tenantTable}_id`] !== undefined;
            });
            this.updateDashboardSummary(tenantTable, securedTables);
        } else {
            // Show the large Configure button
            this.summaryContainer.classList.add('hidden');
            this.btnConfigure.classList.remove('hidden');
        }
    }

openWizard() {
        const allTables = Object.keys(appState.jsonData?.database?.table || {}).filter(t => t !== 'users');
        const dropdownExisting = document.getElementById('wizard-existing-table');
        const privacyContainer = document.getElementById('wizard-privacy-tables-container');
        
        // Read the existing settings from the database/state
        const currentTenant = appState.activeProject?.tenant_table;
        const fkFieldName = currentTenant ? `${currentTenant}_id` : null;

        dropdownExisting.innerHTML = '<option value="">-- Please Select --</option>';
        privacyContainer.innerHTML = '';

        if (allTables.length === 0) {
            privacyContainer.innerHTML = '<p style="color: #888; text-align: center; margin: 10px 0;">No tables available in your project yet.</p>';
        } else {
            allTables.forEach(tableName => {
                // Tenant dropdown
                const option = document.createElement('option');
                option.value = tableName;
                option.textContent = tableName;
                if (tableName === currentTenant) option.selected = true; // Auto-select the previous choice
                dropdownExisting.appendChild(option);

                // Check if this table was previously marked (has a tenant_id FK)
                const tableData = appState.jsonData.database.table[tableName];
                const hasPrivacy = fkFieldName && tableData.fields && tableData.fields[fkFieldName];
                const isChecked = hasPrivacy ? 'checked' : '';

                const checkboxHtml = `
                    <label class="checkbox-label" style="display: block; margin-bottom: 8px; padding: 5px; background: #fdfdfd; border: 1px solid #eee; border-radius: 4px;">
                        <input type="checkbox" name="wizard_privacy_tables" value="${tableName}" ${isChecked}> 
                        ${tableName}
                    </label>
                `;
                privacyContainer.insertAdjacentHTML('beforeend', checkboxHtml);
            });
        }

        // Auto-toggle the radio button if the user already has a tenant
        if (currentTenant) {
            document.querySelector('input[name="wizard_has_table"][value="yes"]').checked = true;
            this.groupExistingTable.classList.remove('hidden');
            this.groupNewTable.classList.add('hidden');
        }

        this.modal.classList.remove('hidden');
    }
    
async handleTenancyTypeChange(event) {
        const newType = event.target.value;
        const currentTenant = appState.activeProject?.tenant_table;

        // Compare against OUR internal tracker to avoid conflicts with dashboard.js
        if (newType === this.currentTenancyType) return;

        if (newType === 'standard') {
            if (currentTenant) {
                // USE THE CUSTOM MODAL
                const isConfirm = await showCustomDialog({
                    title: "Schema Deletion Warning",
                    message: "Switching to 'Standard' mode will delete the Pivot table and remove all Foreign Key (privacy) columns from your project.\n\nAre you sure you want to proceed with this cleanup?",
                    showCancelButton: true
                });

                if (isConfirm) {
                    await this.rollbackTenancy(currentTenant);
                } else {
                    // If the user cancels, revert the UI to its original state
                    this.revertRadioToCurrentState();
                }
            } else {
                this.currentTenancyType = 'standard';
                this.summaryContainer.classList.add('hidden');
                this.btnConfigure.classList.remove('hidden');
            }
        } else {
            // If One-to-Many or Many-to-Many is chosen, open the wizard right away
            this.openWizard();
        }
    }

    // NEW FUNCTION: Force the interface and the queue back to the starting point
    revertRadioToCurrentState() {
        const correctRadio = document.querySelector(`input[name="app-tenancy_type"][value="${this.currentTenancyType}"]`);
        if (correctRadio) correctRadio.checked = true;
        
        // Overwrite any accidental changes made by other scripts
        appState.activeProject.tenancy_type = this.currentTenancyType;
        SaveManager.addToQueue('project', appState.activeProject.project_id, { tenancy_type: this.currentTenancyType });
    }

    closeWizard() {
        this.modal.classList.add('hidden');
        // If the wizard is closed (cancelled), make sure the UI radio reverts
        this.revertRadioToCurrentState();
    }

async processTenancySetup() {
        const typeRadios = document.querySelector('input[name="app-tenancy_type"]:checked');
        const tenancyType = typeRadios ? typeRadios.value : 'standard';

if (tenancyType === 'standard') {
            const oldTenant = appState.activeProject.tenant_table;
            if (oldTenant) {
                // If the user has old settings, perform the cleanup (rollback)
                await this.rollbackTenancy(oldTenant);
                this.closeWizard();
            } else {
                showCustomDialog({ title: "Info", message: "Your project is already in Standard mode." });
            }
            return;
        }

        const hasTable = document.querySelector('input[name="wizard_has_table"]:checked').value === 'yes';
        let tenantTable = '';
        let tenantTableId = null; // Needed to register the Relationship
        const rawName = document.getElementById('wizard-new-table-name').value.trim();
        
        if (hasTable) {
            tenantTable = document.getElementById('wizard-existing-table').value;
        } else {
            tenantTable = rawName.toLowerCase().replace(/\s+/g, '_');
            if (!tenantTable) {
                showCustomDialog({ title: "Error", message: "Please enter a valid Tenant Entity name." });
                return;
            }
        }

        if (!tenantTable) {
            showCustomDialog({ title: "Error", message: "Please select or enter a Tenant Table." });
            return;
        }

        // --- START DATA PROVISIONING PROCESS ---
        try {
            const overlay = document.getElementById('loading-overlay');
            if (overlay) overlay.classList.remove('loading-overlay-hidden');

            const projectId = appState.activeProject.project_id;
            const fkFieldName = `${tenantTable}_id`;

            // A. Save the tenancy type settings
            appState.activeProject.tenancy_type = tenancyType;
            appState.activeProject.tenant_table = tenantTable;
            SaveManager.addToQueue('project', projectId, {
                tenancy_type: tenancyType,
                tenant_table: tenantTable
            });
            await SaveManager.processQueue();

            const createAndSetupField = async (tableId, fieldConfig) => {
                const newField = await window.electronAPI.createField(tableId);
                const updatedField = { ...newField, ...fieldConfig };
                await window.electronAPI.updateField(updatedField);
            };

            // B. Get or create the Tenant Table
            if (!hasTable && !appState.jsonData.database.table[tenantTable]) {
                const newTable = await window.electronAPI.createTable(projectId);
                newTable.table_name = tenantTable;
                newTable.module_name = rawName;
                newTable.feature_source = 'multi_tenancy';
                await window.electronAPI.updateTable(newTable);
                tenantTableId = newTable.table_id;
                
                await createAndSetupField(newTable.table_id, {
                    field_name: 'name', data_type: 'VARCHAR', length: 255, not_null: 1, caption: 'Name'
                });
            } else {
                tenantTableId = appState.jsonData.database.table[tenantTable].table_id;
            }

            // C. Inject the FK into the privacy tables (hidden from the UI)
            const checkboxes = document.querySelectorAll('input[name="wizard_privacy_tables"]:checked');
            const securedTables = Array.from(checkboxes).map(cb => cb.value);

            for (const tableName of securedTables) {
                const tData = appState.jsonData.database.table[tableName];
                if (tData && !tData.fields[fkFieldName]) {
                    await createAndSetupField(tData.table_id, {
                        field_name: fkFieldName,
                        data_type: 'BIGINT',
                        unsigned: 1,
                        is_indexed: 1,
                        caption: `${tenantTable.charAt(0).toUpperCase() + tenantTable.slice(1)} ID`,
                        hide_in_tv: 1, // <--- IMPROVEMENT 1: Hide in Table View
                        hide_in_dv: 1  // <--- IMPROVEMENT 1: Hide in Record Form
                    });
                }
            }

            // D. Fulfill the user's requirements (Users / Pivot Table)
            if (tenancyType === 'one_to_many') {
                const usersTable = appState.jsonData.database.table['users'];
                if (usersTable && !usersTable.fields[fkFieldName]) {
                    await createAndSetupField(usersTable.table_id, {
                        field_name: fkFieldName, data_type: 'BIGINT', unsigned: 1, is_indexed: 1,
                        hide_in_tv: 1, hide_in_dv: 1 // The FK in the Users table is hidden too
                    });
                }
            } else if (tenancyType === 'many_to_many') {
                const pivotTableName = `${tenantTable}_user`;
                if (!appState.jsonData.database.table[pivotTableName]) {
                    const pivotTable = await window.electronAPI.createTable(projectId);
                    pivotTable.table_name = pivotTableName;
                    pivotTable.module_name = pivotTableName;
                    pivotTable.feature_source = 'multi_tenancy';
                    await window.electronAPI.updateTable(pivotTable);

                    // FK to the Tenant (hidden)
                    await createAndSetupField(pivotTable.table_id, { 
                        field_name: fkFieldName, data_type: 'BIGINT', unsigned: 1, is_indexed: 1, hide_in_tv: 1, hide_in_dv: 1 
                    });
                    
                    // FK to the User (shown with a lookup dropdown)
                    await createAndSetupField(pivotTable.table_id, { 
                        field_name: 'user_id', data_type: 'BIGINT', unsigned: 1, is_indexed: 1,
                        lookup_parent_table: 'users',
                        lookup_caption_1: 'name',
                        display_type: 'options_list',
                        options_display: 'dropdown'
                    });

                    // <--- IMPROVEMENT 2: Register the Relationship for the Pivot Table --->
                    if (window.electronAPI.upsertRelationship) {
                        await window.electronAPI.upsertRelationship({
                            parent_table_id: tenantTableId,
                            child_table_id: pivotTable.table_id,
                            fk_child_field: fkFieldName,
                            show_tab: 1, // Show the tab under the Parent form
                            show_icon: 1,
                            tab_title: 'User List',
                            allow_add_from_tv: 1
                        });
                        console.log(`[Auto-Inject] Relationship registered: ${tenantTable} -> ${pivotTableName}`);
                    }
                }
            }

            // E. Reload the app (refresh state & UI)
            this.currentTenancyType = tenancyType;
            await loadProjectData(appState.activeProject, { refreshMode: 'full' });
            this.closeWizard();
            this.updateDashboardSummary(tenantTable, securedTables);

            if (overlay) overlay.classList.add('loading-overlay-hidden');

            showCustomDialog({
                title: "Configuration Successful",
                message: `Enterprise-grade Multi-Tenancy settings have been injected into the schema.\n\nThe system has hidden the privacy field (${fkFieldName}) and managed the pivot relationship automatically.`
            });

        } catch (error) {
            console.error("Error saving tenancy:", error);
            const overlay = document.getElementById('loading-overlay');
            if (overlay) overlay.classList.add('loading-overlay-hidden');
            
            showCustomDialog({ title: "Database Error", message: "Failed to save configuration: " + error.message });
        }
    }

async rollbackTenancy(tenantTableName) {
        try {
            const overlay = document.getElementById('loading-overlay');
            if (overlay) overlay.classList.remove('loading-overlay-hidden');

            const fkFieldName = `${tenantTableName}_id`;
            const pivotTableName = `${tenantTableName}_user`;
            const projectId = appState.activeProject.project_id;

            console.log(`[Rollback] Removing Multi-Tenancy traces for entity: ${tenantTableName}`);

            const tablesToDelete = [];

            // 1. Check the Pivot Table
            const pivotTableData = appState.jsonData.database.table[pivotTableName];
            if (pivotTableData) {
                tablesToDelete.push(pivotTableName);
            }

// 2. Check the Tenant Table (is it auto-generated?)
            const tenantTableData = appState.jsonData.database.table[tenantTableName];
            if (tenantTableData && tenantTableData.feature_source === 'multi_tenancy') {
                if (overlay) overlay.classList.add('loading-overlay-hidden');
                
                // USE THE CUSTOM MODAL TO DELETE THE TENANT TABLE
                const isConfirm = await showCustomDialog({
                    title: "Delete Main Entity Table?",
                    message: `The '${tenantTableName}' table was built automatically by the system earlier.\n\nDo you want to delete this table completely (including its records)?\n\n- Click YES to DELETE this table.\n- Click CANCEL to KEEP it in the database.`,
                    showCancelButton: true
                });
                
                if (isConfirm) {
                    tablesToDelete.push(tenantTableName);
                }
                
                if (overlay) overlay.classList.remove('loading-overlay-hidden');
            }

            // 3. Delete the collected tables
            if (tablesToDelete.length > 0) {
                await window.electronAPI.deleteTables({
                    projectId: projectId,
                    tableNamesToDelete: tablesToDelete
                });
                console.log(`[Rollback] Tables deleted: ${tablesToDelete.join(', ')}`);
            }

            // 4. Remove the FK column (e.g. company_id) from all privacy tables and the users table
            for (const tableName in appState.jsonData.database.table) {
                const tableData = appState.jsonData.database.table[tableName];
                
                if (tableData.fields && tableData.fields[fkFieldName]) {
                    const fieldId = tableData.fields[fkFieldName].field_id;
                    
                    await window.electronAPI.deleteField({ 
                        fieldId: fieldId, 
                        tableName: tableName, 
                        fieldName: fkFieldName 
                    });
                    console.log(`[Rollback] Column ${fkFieldName} deleted from table: ${tableName}`);
                }
            }

            // 5. Update the project status to 'standard'
            this.currentTenancyType = 'standard';
            appState.activeProject.tenancy_type = 'standard';
            appState.activeProject.tenant_table = '';
            SaveManager.addToQueue('project', projectId, {
                tenancy_type: 'standard',
                tenant_table: ''
            });
            await SaveManager.processQueue();

            // 6. Reload the app and UI
            await loadProjectData(appState.activeProject, { refreshMode: 'full' });
            
            this.summaryContainer.classList.add('hidden');
            this.btnConfigure.classList.remove('hidden');

            if (overlay) overlay.classList.add('loading-overlay-hidden');

            showCustomDialog({
                title: "Rollback Successful",
                message: `The project has been returned to Standard mode.\n\nAll schema automation was safely unwound according to your choice.`
            });

        } catch (error) {
            console.error("Failed to roll back tenancy:", error);
            showCustomDialog({ title: "System Error", message: "Failed to revert changes: " + error.message });
            const overlay = document.getElementById('loading-overlay');
            if (overlay) overlay.classList.add('loading-overlay-hidden');
        }
    }
    
    // Updates the summary display UI in the Architecture tab
    updateDashboardSummary(tenantName, securedTables) {
        const typeRadios = document.querySelector('input[name="app-tenancy_type"]:checked');
        const tenancyType = typeRadios ? typeRadios.value : 'Unknown';

        this.btnConfigure.classList.add('hidden');
        this.summaryContainer.classList.remove('hidden');

        document.getElementById('summary-tenant-entity').textContent = tenantName;
        document.getElementById('summary-tenant-type').textContent = tenancyType === 'one_to_many' ? 'One-to-Many' : 'Many-to-Many (SaaS)';
        document.getElementById('summary-secured-tables').innerHTML = securedTables.map(t => `<span style="display:inline-block; background:#e9ecef; padding:2px 8px; border-radius:12px; margin:2px; font-size:0.85em;">${t}</span>`).join('');
    }
}

export const tenancyManager = new TenancyManager();