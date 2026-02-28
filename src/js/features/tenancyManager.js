// src/js/features/tenancyManager.js
import { appState } from '../state.js';
import { SaveManager, loadProjectData } from '../../renderer.js'; 
import { showCustomDialog } from '../ui/modalHandlers.js';

class TenancyManager {
    constructor() {
        this.initialized = false;
        // Rujukan DOM Modal
        this.modal = document.getElementById('tenancy-wizard-modal');
        this.closeBtn = document.getElementById('tenancy-wizard-close');
        this.cancelBtn = document.getElementById('tenancy-wizard-cancel');
        this.saveBtn = document.getElementById('tenancy-wizard-save');
        
        // Rujukan DOM UI
        this.radioHasTable = document.querySelectorAll('input[name="wizard_has_table"]');
        this.groupExistingTable = document.getElementById('wizard-existing-table-group');
        this.groupNewTable = document.getElementById('wizard-new-table-group');
        
        // Rujukan DOM Dashboard
        this.btnConfigure = document.getElementById('btn-configure-tenancy');
        this.btnEdit = document.getElementById('btn-edit-tenancy');
        this.summaryContainer = document.getElementById('tenancy-summary-container');
    }

    init() {
        if (this.initialized) return;

        this.attachEventListeners();
        this.initialized = true;
        console.log("TenancyManager initialized.");
    }

    attachEventListeners() {
        
// Dengar perubahan pada radio button Tenancy Type
        const tenancyRadios = document.querySelectorAll('input[name="app-tenancy_type"]');
        tenancyRadios.forEach(radio => {
            radio.addEventListener('change', (e) => this.handleTenancyTypeChange(e));
        });
        // Togol jenis jadual (Existing vs New)
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

        // Buka Modal
        if (this.btnConfigure) this.btnConfigure.addEventListener('click', () => this.openWizard());
        if (this.btnEdit) this.btnEdit.addEventListener('click', () => this.openWizard());

        // Tutup Modal
        if (this.closeBtn) this.closeBtn.addEventListener('click', () => this.closeWizard());
        if (this.cancelBtn) this.cancelBtn.addEventListener('click', () => this.closeWizard());

        // Simpan Data
        if (this.saveBtn) this.saveBtn.addEventListener('click', () => this.processTenancySetup());
    }
    
async handleTenancyTypeChange(event) {
        const newType = event.target.value;
        const currentTenant = appState.activeProject?.tenant_table;

        if (newType === 'standard') {
            if (currentTenant) {
                // Minta pengesahan pengguna sebelum cuci pangkalan data
                const isConfirm = confirm("AMARAN: Menukar ke 'Standard' akan memadamkan jadual Pivot dan semua lajur Foreign Key (Tenant) dari skema anda. Teruskan?");
                if (isConfirm) {
                    await this.rollbackTenancy(currentTenant);
                } else {
                    // Jika pengguna batal, kembalikan radio button ke nilai asal
                    const oldType = appState.activeProject?.tenancy_type || 'standard';
                    const oldRadio = document.querySelector(`input[name="app-tenancy_type"][value="${oldType}"]`);
                    if (oldRadio) oldRadio.checked = true;
                    
                    // Kemas kini semula SaveManager supaya pangkalan data tidak tersalah simpan
                    SaveManager.addToQueue('project', appState.activeProject.project_id, { tenancy_type: oldType });
                    SaveManager.processQueue();
                }
            } else {
                // Jika projek memang kosong/standard, hanya pastikan UI betul
                this.summaryContainer.classList.add('hidden');
                this.btnConfigure.classList.remove('hidden');
            }
        } else {
            // Jika tukar ke one_to_many atau many_to_many, terus buka wizard!
            this.openWizard();
        }
    }

    // Fungsi untuk memastikan kotak rumusan (Read-only) dipaparkan bila projek mula-mula dimuatkan
    refreshUIState() {
        const tenantTable = appState.activeProject?.tenant_table;
        const tenancyType = appState.activeProject?.tenancy_type;

        if (tenantTable && tenancyType !== 'standard') {
            // Dapatkan senarai jadual privasi secara dinamik
            const securedTables = Object.keys(appState.jsonData?.database?.table || {}).filter(tableName => {
                const fields = appState.jsonData.database.table[tableName].fields || {};
                return fields[`${tenantTable}_id`] !== undefined;
            });
            this.updateDashboardSummary(tenantTable, securedTables);
        } else {
            // Paparkan butang Configure yang besar
            this.summaryContainer.classList.add('hidden');
            this.btnConfigure.classList.remove('hidden');
        }
    }

openWizard() {
        const allTables = Object.keys(appState.jsonData?.database?.table || {}).filter(t => t !== 'users');
        const dropdownExisting = document.getElementById('wizard-existing-table');
        const privacyContainer = document.getElementById('wizard-privacy-tables-container');
        
        // Baca tetapan sedia ada dari database/state
        const currentTenant = appState.activeProject?.tenant_table;
        const fkFieldName = currentTenant ? `${currentTenant}_id` : null;

        dropdownExisting.innerHTML = '<option value="">-- Please Select --</option>';
        privacyContainer.innerHTML = '';

        if (allTables.length === 0) {
            privacyContainer.innerHTML = '<p style="color: #888; text-align: center; margin: 10px 0;">No tables available in your project yet.</p>';
        } else {
            allTables.forEach(tableName => {
                // Dropdown Tenant
                const option = document.createElement('option');
                option.value = tableName;
                option.textContent = tableName;
                if (tableName === currentTenant) option.selected = true; // Auto-select pilihan lama
                dropdownExisting.appendChild(option);

                // Semak jika jadual ini pernah ditanda (mempunyai FK tenant_id)
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

        // Auto-Togol Radio Button jika pengguna sudah ada tenant
        if (currentTenant) {
            document.querySelector('input[name="wizard_has_table"][value="yes"]').checked = true;
            this.groupExistingTable.classList.remove('hidden');
            this.groupNewTable.classList.add('hidden');
        }

        this.modal.classList.remove('hidden');
    }
    
    closeWizard() {
        this.modal.classList.add('hidden');
    }

async processTenancySetup() {
        const typeRadios = document.querySelector('input[name="app-tenancy_type"]:checked');
        const tenancyType = typeRadios ? typeRadios.value : 'standard';

if (tenancyType === 'standard') {
            const oldTenant = appState.activeProject.tenant_table;
            if (oldTenant) {
                // Jika pengguna ada tetapan lama, lakukan pembersihan (Rollback)
                await this.rollbackTenancy(oldTenant);
                this.closeWizard();
            } else {
                showCustomDialog({ title: "Info", message: "Projek anda sudah berada dalam mod Standard." });
            }
            return;
        }

        const hasTable = document.querySelector('input[name="wizard_has_table"]:checked').value === 'yes';
        let tenantTable = '';
        let tenantTableId = null; // Diperlukan untuk daftar Relationship
        const rawName = document.getElementById('wizard-new-table-name').value.trim();
        
        if (hasTable) {
            tenantTable = document.getElementById('wizard-existing-table').value;
        } else {
            tenantTable = rawName.toLowerCase().replace(/\s+/g, '_');
            if (!tenantTable) {
                showCustomDialog({ title: "Ralat", message: "Sila masukkan nama Entiti Tenant yang sah." });
                return;
            }
        }

        if (!tenantTable) {
            showCustomDialog({ title: "Ralat", message: "Sila pilih atau masukkan Jadual Tenant." });
            return;
        }

        // --- MULA PROSES PANGKALAN DATA ---
        try {
            const overlay = document.getElementById('loading-overlay');
            if (overlay) overlay.classList.remove('loading-overlay-hidden');

            const projectId = appState.activeProject.project_id;
            const fkFieldName = `${tenantTable}_id`;

            // A. Simpan tetapan jenis tenancy
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

            // B. Dapatkan atau Cipta Jadual Tenant
            if (!hasTable && !appState.jsonData.database.table[tenantTable]) {
                const newTable = await window.electronAPI.createTable(projectId);
                newTable.table_name = tenantTable;
                newTable.module_name = rawName;
                await window.electronAPI.updateTable(newTable);
                tenantTableId = newTable.table_id;
                
                await createAndSetupField(newTable.table_id, {
                    field_name: 'name', data_type: 'VARCHAR', length: 255, not_null: 1, caption: 'Name'
                });
            } else {
                tenantTableId = appState.jsonData.database.table[tenantTable].table_id;
            }

            // C. Suntik FK ke dalam Jadual Privasi (Sembunyikan dari UI)
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
                        hide_in_tv: 1, // <--- PENAMBAHBAIKAN 1: Sorok di Table View
                        hide_in_dv: 1  // <--- PENAMBAHBAIKAN 1: Sorok di Record Form
                    });
                }
            }

            // D. Selesaikan Keperluan Pengguna (Users / Pivot Table)
            if (tenancyType === 'one_to_many') {
                const usersTable = appState.jsonData.database.table['users'];
                if (usersTable && !usersTable.fields[fkFieldName]) {
                    await createAndSetupField(usersTable.table_id, {
                        field_name: fkFieldName, data_type: 'BIGINT', unsigned: 1, is_indexed: 1,
                        hide_in_tv: 1, hide_in_dv: 1 // FK dalam jadual Users juga disorok
                    });
                }
            } else if (tenancyType === 'many_to_many') {
                const pivotTableName = `${tenantTable}_user`;
                if (!appState.jsonData.database.table[pivotTableName]) {
                    const pivotTable = await window.electronAPI.createTable(projectId);
                    pivotTable.table_name = pivotTableName;
                    pivotTable.module_name = pivotTableName;
                    await window.electronAPI.updateTable(pivotTable);

                    // FK ke Tenant (Disorok)
                    await createAndSetupField(pivotTable.table_id, { 
                        field_name: fkFieldName, data_type: 'BIGINT', unsigned: 1, is_indexed: 1, hide_in_tv: 1, hide_in_dv: 1 
                    });
                    
                    // FK ke User (Dipaparkan dengan Dropdown Lookup)
                    await createAndSetupField(pivotTable.table_id, { 
                        field_name: 'user_id', data_type: 'BIGINT', unsigned: 1, is_indexed: 1,
                        lookup_parent_table: 'users',
                        lookup_caption_1: 'name',
                        display_type: 'options_list',
                        options_display: 'dropdown'
                    });

                    // <--- PENAMBAHBAIKAN 2: Daftar Relationship untuk Pivot Table --->
                    if (window.electronAPI.upsertRelationship) {
                        await window.electronAPI.upsertRelationship({
                            parent_table_id: tenantTableId,
                            child_table_id: pivotTable.table_id,
                            fk_child_field: fkFieldName,
                            show_tab: 1, // Tunjuk tab di bawah borang Parent
                            show_icon: 1,
                            tab_title: 'Senarai Pengguna',
                            allow_add_from_tv: 1
                        });
                        console.log(`[Auto-Inject] Relationship didaftar: ${tenantTable} -> ${pivotTableName}`);
                    }
                }
            }

            // E. Muat semula aplikasi (Refresh State & UI)
            await loadProjectData(appState.activeProject, { refreshMode: 'full' });
            this.closeWizard();
            this.updateDashboardSummary(tenantTable, securedTables);

            if (overlay) overlay.classList.add('loading-overlay-hidden');

            showCustomDialog({
                title: "Konfigurasi Berjaya",
                message: `Tetapan Multi-Tenancy (Gred Perusahaan) telah disuntik ke dalam skema.\n\nSistem telah menyorokkan medan privasi (${fkFieldName}) dan menguruskan relationship pivot secara automatik.`
            });

        } catch (error) {
            console.error("Ralat menyimpan Tenancy:", error);
            const overlay = document.getElementById('loading-overlay');
            if (overlay) overlay.classList.add('loading-overlay-hidden');
            
            showCustomDialog({ title: "Ralat Pangkalan Data", message: "Gagal menyimpan konfigurasi: " + error.message });
        }
    }

async rollbackTenancy(tenantTableName) {
        try {
            const overlay = document.getElementById('loading-overlay');
            if (overlay) overlay.classList.remove('loading-overlay-hidden');

            const fkFieldName = `${tenantTableName}_id`;
            const pivotTableName = `${tenantTableName}_user`;
            const projectId = appState.activeProject.project_id;

            console.log(`[Rollback] Membuang kesan Multi-Tenancy untuk entiti: ${tenantTableName}`);

            // 1. Buang Pivot Table sepenuhnya (jika ada)
            const pivotTableData = appState.jsonData.database.table[pivotTableName];
            if (pivotTableData) {
                // KEMAS KINI: Hantar parameter yang betul ke backend
                await window.electronAPI.deleteTables({
                    projectId: projectId,
                    tableNamesToDelete: [pivotTableName]
                });
                console.log(`[Rollback] Pivot table dipadam: ${pivotTableName}`);
            }

            // 2. Buang lajur FK (syarikat_id) dari semua jadual lain (termasuk users)
            for (const tableName in appState.jsonData.database.table) {
                const tableData = appState.jsonData.database.table[tableName];
                
                // JANGAN padam jadual Tenant itu sendiri! Kita hanya buang FK di dalamnya (jika ada)
                if (tableData.fields && tableData.fields[fkFieldName]) {
                    const fieldId = tableData.fields[fkFieldName].field_id;
                    
                    // KEMAS KINI: Hantar parameter yang betul mengikut main.js
                    await window.electronAPI.deleteField({ 
                        fieldId: fieldId, 
                        tableName: tableName, 
                        fieldName: fkFieldName 
                    });
                    console.log(`[Rollback] Lajur ${fkFieldName} dipadam dari jadual: ${tableName}`);
                }
            }

            // 3. Kemas kini status Projek ke 'standard'
            appState.activeProject.tenancy_type = 'standard';
            appState.activeProject.tenant_table = '';
            SaveManager.addToQueue('project', projectId, {
                tenancy_type: 'standard',
                tenant_table: ''
            });
            await SaveManager.processQueue();

            // 4. Muat semula aplikasi dan UI
            await loadProjectData(appState.activeProject, { refreshMode: 'full' });
            
            // Sembunyikan summary box, tunjukkan balik butang utama
            this.summaryContainer.classList.add('hidden');
            this.btnConfigure.classList.remove('hidden');

            if (overlay) overlay.classList.add('loading-overlay-hidden');

            showCustomDialog({
                title: "Rollback Berjaya",
                message: `Projek dikembalikan ke mod Standard.\n\nSemua jadual persilangan (Pivot) dan lajur carian (${fkFieldName}) yang dijana oleh sistem telah dipadam dengan selamat.`
            });

        } catch (error) {
            console.error("Gagal melakukan rollback tenancy:", error);
            showCustomDialog({ title: "Ralat Sistem", message: "Gagal mengundurkan perubahan: " + error.message });
            const overlay = document.getElementById('loading-overlay');
            if (overlay) overlay.classList.add('loading-overlay-hidden');
        }
    }
    
    // Mengemas kini UI paparan rumusan di tab Architecture
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