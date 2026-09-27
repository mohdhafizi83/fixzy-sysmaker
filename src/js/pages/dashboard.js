// js/pages/dashboard.js

// Import UI helpers
import { setElementValue, setRadioValue } from '../ui/formHelpers.js';
import { appState } from '../state.js';
import { loadProjectData, SaveManager } from '../../renderer.js';
import { loadThemeSettings } from '../features/themeManager.js';

// Show the 2FA / Captcha advanced-option groups only while the matching
// parent radio (app-module-auth-extra) is checked.
/**
 * Shows/hides the 2FA and Captcha advanced-option groups with their parent radio selection.
 * @returns {void}
 */
export function toggleAuthModeGroups() {
    const is2fa = document.getElementById('app-module-auth-email-2fa')?.checked;
    const isCaptcha = document.getElementById('app-module-auth-email-captcha')?.checked;
    const fg2fa = document.getElementById('fg-2fa-mode');
    const fgCaptcha = document.getElementById('fg-captcha-mode');
    if (fg2fa) fg2fa.style.display = is2fa ? 'block' : 'none';
    if (fgCaptcha) fgCaptcha.style.display = isCaptcha ? 'block' : 'none';
}

/**
 * Fills every project-settings input on the dashboard from the saved project data.
 * @param {Object} projectData Active project record.
 * @returns {void}
 */
export function populateMainDashboard(projectData) {
    if (!projectData) {
        console.warn("No project data to display on the dashboard.");
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
	// Advanced option (b): 'basic' (a) or 'totp' (Google Authenticator) /
	// 'recaptcha_v2' (Google reCAPTCHA v2). Default 'basic' for old projects.
	setRadioValue('app-auth-2fa-mode', projectData.auth_2fa_mode || 'basic');
	setRadioValue('app-auth-captcha-mode', projectData.auth_captcha_mode || 'basic');
	toggleAuthModeGroups();
	document.querySelectorAll('input[name="app-module-auth-extra"]').forEach((r) => {
	    r.removeEventListener('change', toggleAuthModeGroups);
	    r.addEventListener('change', toggleAuthModeGroups);
	});
	setElementValue('app-module-auth-ldap', projectData.module_auth_ldap);
    setElementValue('app-module-auth-google-sso', projectData.module_auth_google_sso);
    setElementValue('app-module-authorization', projectData.module_authorization);
    setElementValue('app-module-log-audit', projectData.module_log_audit);
    setElementValue('app-module-log-activity', projectData.module_log_activity);
    setElementValue('app-module-fake-data', projectData.module_fake_data); 
    setElementValue('app-debug-mode', projectData.debug_mode);
	setRadioValue('app-data_delete_type', projectData.data_delete_type || 'hard');

    // Real-time module: checkbox + backend selector (shown only when enabled)
    setElementValue('app-module-realtime', projectData.module_realtime);
    setElementValue('app-module-google-sheets', projectData.module_google_sheets);
    setElementValue('app-module-scheduler', projectData.module_scheduler);
    loadBackupSettings(projectData);
    setElementValue('app-realtime_backend', projectData.realtime_backend || 'reverb');
    // Realtime backend selector is only meaningful when the realtime module is on.
    const toggleRealtimeBackendVisibility = () => {
        const fgBackend = document.getElementById('fg-realtime-backend');
        const realtimeChecked = document.getElementById('app-module-realtime')?.checked;
        if (fgBackend) {
            fgBackend.classList.toggle('hidden', !realtimeChecked);
        }
    };
    const realtimeCheckbox = document.getElementById('app-module-realtime');
    if (realtimeCheckbox) {
        realtimeCheckbox.removeEventListener('change', toggleRealtimeBackendVisibility);
        realtimeCheckbox.addEventListener('change', toggleRealtimeBackendVisibility);
    }
    toggleRealtimeBackendVisibility();
	
    // ▼▼▼ START: ARCHITECTURE & TENANCY LOGIC ▼▼▼
    setRadioValue('app-tenancy_type', projectData.tenancy_type || 'standard');

    // 1. Build the Tenant Table dropdown options based on the current table list
    const tenantTableSelect = document.getElementById('app-tenant_table');
    if (tenantTableSelect && appState.jsonData?.database?.table) {
        tenantTableSelect.innerHTML = '<option value="">-- Please Select --</option>';
        Object.keys(appState.jsonData.database.table).forEach(tableName => {
            const option = document.createElement('option');
            option.value = tableName;
            option.textContent = tableName;
            tenantTableSelect.appendChild(option);
        });
        // Set the value already stored in the DB
        setElementValue('app-tenant_table', projectData.tenant_table || '');
    }

    // 2. Logic to show/hide the Tenant Table dropdown
    // Tenant-table selector only shows for multi-tenant projects.
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

    // 3. Attach event listeners to the Tenancy Type radio buttons
    document.querySelectorAll('input[name="app-tenancy_type"]').forEach(radio => {
        radio.removeEventListener('change', toggleTenantTableVisibility); // Avoid duplicate listeners
        radio.addEventListener('change', toggleTenantTableVisibility);
    });

    // 4. Call once when the page loads
    toggleTenantTableVisibility();
    // ▲▲▲ END: ARCHITECTURE & TENANCY LOGIC ▲▲▲

    // Tab: Localization
    setElementValue('app-title', projectData.app_title);
    setElementValue('app-date-format', projectData.date_format);
    setElementValue('app-time-format', projectData.time_format);
    setElementValue('app-language-select', projectData.language_select);
    setElementValue('app-timezone-select', projectData.timezone_select);

    // Update the date preview (safe addition)
    const dateFormatSelect = document.getElementById('app-date-format');
    const timeFormatSelect = document.getElementById('app-time-format');
    const previewInput = document.getElementById('app-date-preview');
    if (dateFormatSelect && timeFormatSelect && previewInput) {
        previewInput.value = `${dateFormatSelect.value} ${timeFormatSelect.value}`;
    }
    
    // Tab: Theme (system v1: presets + custom, theme_config JSON)
    loadThemeSettings(projectData);
    
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
    
    // Fire events
    document.getElementById('app-date-order')?.dispatchEvent(new Event('change'));
	
    const menuCheckbox = document.getElementById('app-menu_at_homepage');
    if (menuCheckbox) {
        menuCheckbox.dispatchEvent(new Event('change'));
    }
}

/**
 * Attaches autosave listeners to all project inputs in the header and dashboard form.
 * @returns {void}
 */
export function initializeProjectSaveHandlers() {
    const form = document.getElementById('main-dashboard-page');
    // 'app-title' sits outside 'main-dashboard-page', so we need to target it separately
    const header = document.querySelector('.main-header'); 
    if (!form || !header) return;

    /**
     * Maps a changed app-* input to its project column and queues the save (special-casing
     * title, hook logic, backup settings, and the auth radio pairs).
     * @param {Event} event Change/input event from a project setting input.
     * @returns {void}
     */
    const handleInputChange = (event) => {
        if (appState.isPopulatingData) return;
        if (!appState.isAutoSaveEnabled) return;

        const input = event.target;

        // Backup settings: several inputs serialise into one backup_config JSON.
        if (input.id && input.id.startsWith('app-backup-')) {
            saveBackupSettings();
            return;
        }

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
            // The 2FA/Captcha pair is a deselectable radio group mapped to two
            // integer columns. Persist BOTH columns explicitly on every change:
            // checking one must zero the other (the browser only fires 'change'
            // on the newly-checked radio), and deselecting must save 0.
            if (input.name === 'app-module-auth-extra') {
                const is2fa = input.id === 'app-module-auth-email-2fa';
                SaveManager.addToQueue('project', appState.activeProject.project_id, {
                    [is2fa ? 'module_auth_email_2fa' : 'module_auth_email_captcha']: input.checked ? 1 : 0,
                    [is2fa ? 'module_auth_email_captcha' : 'module_auth_email_2fa']: 0
                });
                return;
            }
            // Advanced-option radios: each group maps to its own TEXT column.
            if (input.name === 'app-auth-2fa-mode' || input.name === 'app-auth-captcha-mode') {
                if (!input.checked) return;
                const modeKey = input.name === 'app-auth-2fa-mode' ? 'auth_2fa_mode' : 'auth_captcha_mode';
                const mode = input.value === 'totp' || input.value === 'recaptcha_v2' ? input.value : 'basic';
                SaveManager.addToQueue('project', appState.activeProject.project_id, { [modeKey]: mode });
                return;
            }
            if (!input.checked) return;
            value = input.value;
        } else {
            value = input.value;
        }

        // Use the imported SaveManager
        SaveManager.addToQueue('project', appState.activeProject.project_id, { [key]: value });
    };

    // Attach event listeners
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

// --- Backup settings (project-level backup_config JSON) -----------------

/**
 * Loads the project's backup_config JSON into the backup settings inputs.
 * @param {Object} projectData Active project record.
 * @returns {void}
 */
export function loadBackupSettings(projectData) {
    let cfg = {};
    try {
        cfg = JSON.parse(projectData.backup_config || '{}') || {};
    } catch (e) {
        cfg = {};
    }
    setElementValue('app-backup-enabled', Number(cfg.enabled) === 1 ? 1 : 0);
    setElementValue('app-backup-frequency', cfg.frequency === 'weekly' ? 'weekly' : 'daily');
    setElementValue('app-backup-weekday', String(cfg.weekday || 1));
    setElementValue('app-backup-retention', String(cfg.retention || 10));
    setElementValue('app-backup-notify', cfg.notify || '');
    toggleBackupWeekdayVisibility();
    const freq = document.getElementById('app-backup-frequency');
    if (freq && !freq.dataset.wired) {
        freq.dataset.wired = '1';
        freq.addEventListener('change', toggleBackupWeekdayVisibility);
    }
}

/**
 * Shows the weekday checkboxes only when the backup schedule is set to weekly.
 * @returns {void}
 */
function toggleBackupWeekdayVisibility() {
    const freq = document.getElementById('app-backup-frequency');
    const wrap = document.getElementById('app-backup-weekday-wrap');
    if (freq && wrap) {
        wrap.style.display = freq.value === 'weekly' ? '' : 'none';
    }
}

/**
 * Serializes the backup settings inputs into backup_config JSON and queues the project save.
 * @returns {void}
 */
export function saveBackupSettings() {
    if (!appState.activeProject) return;
    const enabled = document.getElementById('app-backup-enabled');
    const freq = document.getElementById('app-backup-frequency');
    const weekday = document.getElementById('app-backup-weekday');
    const retention = document.getElementById('app-backup-retention');
    const notify = document.getElementById('app-backup-notify');
    const cfg = {
        enabled: enabled && enabled.checked ? 1 : 0,
        frequency: freq ? freq.value : 'daily',
        weekday: Math.min(7, Math.max(1, parseInt(weekday ? weekday.value : '1', 10) || 1)),
        retention: Math.min(60, Math.max(1, parseInt(retention ? retention.value : '10', 10) || 10)),
        notify: notify ? String(notify.value || '').trim() : '',
    };
    SaveManager.addToQueue('project', appState.activeProject.project_id, {
        backup_config: JSON.stringify(cfg),
    });
}