// js/pages/dashboard.js

// Import Helpers UI
import { setElementValue, setRadioValue } from '../ui/formHelpers.js';
import { appState } from '../state.js';
import { loadProjectData, SaveManager } from '../../renderer.js';

export function populateMainDashboard(projectData) {
    if (!projectData) {
        console.warn("Tiada data projek untuk dipaparkan di papan pemuka.");
        return;
    }

    // Tab: Web Development Stack
    setElementValue('app-stack_base', projectData.stack_base || 'core_php');
    // Trigger change to show correct dependent fields
    const stackSelect = document.getElementById('app-stack_base');
    if (stackSelect) {
        stackSelect.dispatchEvent(new Event('change'));
    }
    // Now set the values for the visible selects
    const dbSelect = document.getElementById('app-stack-database');
    const themeSelect = document.getElementById('app-stack-theme');
    if(dbSelect) setElementValue('app-stack-database', projectData.stack_database);
    if(themeSelect) setElementValue('app-stack-theme', projectData.stack_theme);
	
	setElementValue('app-module-auth-email-2fa', projectData.module_auth_email_2fa);
    setElementValue('app-module-auth-email-captcha', projectData.module_auth_email_captcha);
    setElementValue('app-module-auth-ldap', projectData.module_auth_ldap);
    setElementValue('app-module-auth-google-sso', projectData.module_auth_google_sso);
    setElementValue('app-module-authorization', projectData.module_authorization);
    setElementValue('app-module-log-audit', projectData.module_log_audit);
    setElementValue('app-module-fake-data', projectData.module_fake_data); 
    setElementValue('app-debug-mode', projectData.debug_mode);
	setRadioValue('app-data_delete_type', projectData.data_delete_type || 'hard');
	
    // ▼▼▼ MULA: LOGIK ARCHITECTURE & TENANCY ▼▼▼
    setRadioValue('app-tenancy_type', projectData.tenancy_type || 'standard');

    // 1. Bina pilihan dropdown untuk Tenant Table berdasarkan senarai jadual semasa
    const tenantTableSelect = document.getElementById('app-tenant_table');
    if (tenantTableSelect && appState.jsonData?.database?.table) {
        tenantTableSelect.innerHTML = '<option value="">-- Please Select --</option>';
        Object.keys(appState.jsonData.database.table).forEach(tableName => {
            const option = document.createElement('option');
            option.value = tableName;
            option.textContent = tableName;
            tenantTableSelect.appendChild(option);
        });
        // Tetapkan nilai yang telah disimpan di DB
        setElementValue('app-tenant_table', projectData.tenant_table || '');
    }

    // 2. Logik untuk paparkan/sembunyikan dropdown Tenant Table
    const toggleTenantTableVisibility = () => {
        const fgTenant = document.getElementById('fg-tenant-table');
        const selectedTenancy = document.querySelector('input[name="app-tenancy_type"]:checked')?.value;
        
        if (fgTenant) {
            if (selectedTenancy === 'one_to_many' || selectedTenancy === 'many_to_many') {
                fgTenant.classList.remove('hidden');
            } else {
                fgTenant.classList.add('hidden');
            }
        }
    };

    // 3. Pasang event listener pada butang radio Tenancy Type
    document.querySelectorAll('input[name="app-tenancy_type"]').forEach(radio => {
        radio.removeEventListener('change', toggleTenantTableVisibility); // Elak duplicate listener
        radio.addEventListener('change', toggleTenantTableVisibility);
    });

    // 4. Panggil sekali semasa memuatkan halaman
    toggleTenantTableVisibility();
    // ▲▲▲ TAMAT: LOGIK ARCHITECTURE & TENANCY ▲▲▲

    // Tab: Localization
    setElementValue('app-title', projectData.app_title);
    setElementValue('app-date-format', projectData.date_format);
    setElementValue('app-time-format', projectData.time_format);
    setElementValue('app-language-select', projectData.language_select);
    setElementValue('app-timezone-select', projectData.timezone_select);

    // Kemas kini pratonton tarikh (Safe addition)
    const dateFormatSelect = document.getElementById('app-date-format');
    const timeFormatSelect = document.getElementById('app-time-format');
    const previewInput = document.getElementById('app-date-preview');
    if (dateFormatSelect && timeFormatSelect && previewInput) {
        previewInput.value = `${dateFormatSelect.value} ${timeFormatSelect.value}`;
    }
    
    // Tab: Theme
    setElementValue('app-theme-select', projectData.theme_select);
    setElementValue('app-use_3d_effects', projectData.use_3d_effects);
    setElementValue('app-rtl', projectData.rtl);
    setElementValue('app-compact', projectData.compact);
    
    // Tab: Menu management
    setRadioValue('app-menu_orientation', projectData.menu_orientation);
    setElementValue('app-menu_at_homepage', projectData.menu_at_homepage);
    setElementValue('app-tables-per-row', projectData.tables_per_row);
    setRadioValue('app-extra-wide', projectData.extra_wide);
    setElementValue('app-panel-height', projectData.panel_height);
    
    // Tab: Security & technical
    setElementValue('app-hide_login', projectData.hide_login);
    setElementValue('app-allow_sql_tool', projectData.allow_sql_tool);
    setElementValue('app-allow_server_status', projectData.allow_server_status);
    setElementValue('app-admins_group_access', projectData.admins_group_access);
    setElementValue('app-allow_table_view_sql', projectData.allow_table_view_sql);
    setElementValue('app-copy_children_async', projectData.copy_children_async);
    setElementValue('app-allow_pwa_install', projectData.allow_pwa_install);
    setElementValue('app-url', projectData.url);
    setElementValue('app-hook-logic', projectData.project_hook_workflow); 
    
    // Cetuskan event
    document.getElementById('app-date-order')?.dispatchEvent(new Event('change'));
    document.getElementById('app-theme-select')?.dispatchEvent(new Event('change'));
	
    const menuCheckbox = document.getElementById('app-menu_at_homepage');
    if (menuCheckbox) {
        menuCheckbox.dispatchEvent(new Event('change'));
    }
}

export function initializeProjectSaveHandlers() {
    const form = document.getElementById('main-dashboard-page');
    // 'app-title' berada di luar 'main-dashboard-page', jadi kita perlu sasarkannya secara berasingan
    const header = document.querySelector('.main-header'); 
    if (!form || !header) return;

    const handleInputChange = (event) => {
        if (appState.isPopulatingData) return;
        if (!appState.isAutoSaveEnabled) return;

        const input = event.target;
        let key = (input.type === 'radio')
            ? input.name.replace('app-', '').replace(/-/g, '_')
            : input.id.replace('app-', '').replace(/-/g, '_');
        
        if (key === 'title') {
            key = 'app_title';
        } else if (input.id === 'app-hook-logic') {
            key = 'project_hook_workflow';
        }
        
        let value;
        if (input.type === 'checkbox') {
            value = input.checked ? 1 : 0;
        } else if (input.type === 'radio') {
            if (!input.checked) return;
            value = input.value;
        } else {
            value = input.value;
        }

        // Guna SaveManager yang diimport
        SaveManager.addToQueue('project', appState.activeProject.project_id, { [key]: value });
    };

    // Pasang event listener
    header.querySelectorAll('input, select').forEach(input => {
        if (input.id === 'app-title') {
            input.addEventListener('input', handleInputChange);
        } else {
            input.addEventListener('change', handleInputChange);
        }
    });

    form.querySelectorAll('input, select').forEach(input => {
        input.addEventListener('change', handleInputChange);
    });

    const projectHookInput = document.getElementById('app-hook-logic');
    if (projectHookInput) {
        projectHookInput.addEventListener('input', handleInputChange);
    }
}