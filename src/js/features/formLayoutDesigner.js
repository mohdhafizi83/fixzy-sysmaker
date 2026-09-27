// src/js/features/formLayoutDesigner.js
//
// Form Design & Layout (phase E) — table-level designer.
// Serialises into tables.form_layout_config (JSON). The enable switch is
// the style dropdown itself: "default" + no groups + inherit columns +
// "above" labels == no config (legacy form).
//
// Field-level settings (label position, group assignment, conditional
// visibility/required) live in the field's Form Behavior tab
// (fieldBehaviorManager.js).

import { appState } from '../state.js';
import { SaveManager } from '../saveManager.js';

/**
 * Resolves the table name of the currently open workspace table.
 * @returns {string|null} Table name from the workspace title, or null.
 */
function currentTableName() {
    const titleEl = document.getElementById('workspace-module-title');
    return (titleEl && (titleEl.dataset.tableName || titleEl.textContent.trim())) || null;
}

// Custom-module context: when the workspace badge says "Custom", the form
// layout is edited per-module via settings_override.form_layout_config.
// Effective config = module override ?? main-module (table) config.
/**
 * Resolves the currently open custom module object, if in custom-module mode.
 * @returns {Object|null} The custom module, or null when not in custom mode.
 */
function currentCustomModule() {
    const badgeEl = document.getElementById('workspace-module-badge');
    const titleEl = document.getElementById('workspace-module-title');
    const isCustomMode = badgeEl && badgeEl.classList.contains('badge-custom');
    if (!isCustomMode || !titleEl || !titleEl.dataset.moduleId) return null;
    const tableName = titleEl.dataset.tableName;
    const tableData = tableName && appState.jsonData?.database?.table?.[tableName];
    if (!tableData || !Array.isArray(tableData.custom_modules)) return null;
    const modId = parseInt(titleEl.dataset.moduleId, 10);
    return tableData.custom_modules.find((m) => m.module_id === modId) || null;
}

/**
 * Parses a JSON string without throwing; passes objects through unchanged.
 * @param {*} raw JSON string, object, or falsy value.
 * @returns {Object|null} Parsed value or null on failure.
 */
function parseJsonSafe(raw) {
    if (!raw) return null;
    if (typeof raw === 'object') return raw;
    try { return JSON.parse(raw); } catch (e) { return null; }
}

// Returns { config, overridden } where config is the effective layout JSON
// (module override if present, else the table's own config) and overridden
// says whether the module carries its own copy.
/**
 * Returns the effective form layout config plus whether the custom module overrides it.
 * @returns {{config: Object|null, overridden: boolean, module: Object|null}} Effective layout info.
 */
function effectiveLayoutConfig() {
    const mod = currentCustomModule();
    if (mod) {
        const overrides = parseJsonSafe(mod.settings_override) || {};
        if (overrides.form_layout_config) {
            const cfg = parseJsonSafe(overrides.form_layout_config);
            if (cfg) return { config: cfg, overridden: true, module: mod };
        }
    }
    const tableData = currentTableData();
    return { config: tableData ? parseJsonSafe(tableData.form_layout_config) : null, overridden: false, module: mod };
}

/**
 * Resolves the table data object for the currently open workspace table.
 * @returns {Object|null} The table data from appState, or null when unknown.
 */
function currentTableData() {
    const tableName = currentTableName();
    return tableName && appState.jsonData?.database?.table?.[tableName]
        ? appState.jsonData.database.table[tableName]
        : null;
}

/** Escapes &, <, and > for safe HTML interpolation. @param {*} s Value. @returns {string} Escaped string. */
function escapeHtml(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
/** Escapes HTML special chars plus double quotes for attribute interpolation. @param {*} s Value. @returns {string} Escaped string. */
function escapeAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }

/**
 * Converts a group title into a unique snake_case key, de-duplicating against existing keys.
 * @param {string} title Human-readable group title.
 * @param {Set<string>} existingKeys Keys already in use.
 * @returns {string} Unique group key (e.g. 'your_info', 'your_info_2').
 */
function groupKeyify(title, existingKeys) {
    let base = String(title || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    if (!base || /^[0-9]/.test(base)) base = 'group_' + base;
    let key = base, i = 2;
    while (existingKeys.has(key)) { key = `${base}_${i++}`; }
    return key;
}

// In-memory working copy of groups (rendered list). Rebuilt on render.
let workingGroups = [];

/**
 * Reads the full form layout config (style, columns, labels, groups, wizard, chat) from the form inputs.
 * @returns {Object} Config object matching the form_layout_config JSON shape.
 */
function readConfigFromDom() {
    const style = document.getElementById('fl-style')?.value || 'default';
    const columns = parseInt(document.getElementById('fl-columns')?.value || '0', 10) || 0;
    const labelDisplay = document.getElementById('fl-label-display')?.value || 'above';
    const ungroupedTitle = document.getElementById('fl-ungrouped-title')?.value || 'Additional Info';
    const startStep = parseInt(document.getElementById('fl-wizard-start')?.value || '1', 10) || 1;
    const skippable = !!document.getElementById('fl-wizard-skippable')?.checked;
    const chatSlug = (document.getElementById('fl-chat-slug')?.value || '').trim();
    const chatGreeting = (document.getElementById('fl-chat-greeting')?.value || '').trim();
    const chatFarewell = (document.getElementById('fl-chat-farewell')?.value || '').trim();

    const groups = workingGroups.map((g) => ({
        key: g.key,
        title: g.title,
        description: g.description || '',
        collapsible: !!g.collapsible,
        collapsed: !!g.collapsed && !!g.collapsible,
    }));

    const cfg = { style, columns, label_display: labelDisplay, groups, ungrouped_title: ungroupedTitle, wizard: { start_step: startStep, skippable } };
    if (style === 'conversational') {
        if (chatSlug) cfg.slug = chatSlug;
        if (chatGreeting || chatFarewell) {
            cfg.chat = { greeting: chatGreeting, farewell: chatFarewell };
        }
    }
    return cfg;
}

/**
 * True when the config equals the legacy default (no groups, inherited columns, labels above).
 * @param {Object} cfg Layout config to test.
 * @returns {boolean} Whether the config can be treated as empty.
 */
function isConfigEmpty(cfg) {
    return cfg.style === 'default' && cfg.columns === 0 && cfg.groups.length === 0 && cfg.label_display === 'above';
}

/**
 * Saves the layout: into the custom module's settings_override in custom mode, else into tables.form_layout_config.
 * @returns {void}
 */
function saveConfig() {
    const cfg = readConfigFromDom();
    const mod = currentCustomModule();
    if (mod) {
        // Custom module: store the layout inside the module's settings_override
        // JSON so the main table config stays untouched.
        const overrides = parseJsonSafe(mod.settings_override) || {};
        if (isConfigEmpty(cfg)) {
            delete overrides.form_layout_config; // fall back to inherited
        } else {
            overrides.form_layout_config = JSON.stringify(cfg);
        }
        const jsonString = JSON.stringify(overrides);
        mod.settings_override = jsonString; // RAM
        if (window.electronAPI && window.electronAPI.saveCustomTableOverride) {
            window.electronAPI.saveCustomTableOverride({
                module_id: mod.module_id,
                settings_override: jsonString
            }).then((res) => {
                if (!res || !res.success) console.error('Failed to save module form layout:', res && res.message);
            });
        }
        updateLayoutSourceBadge();
        return;
    }
    const tableData = currentTableData();
    if (!tableData || !tableData.table_id) return;
    SaveManager.addToQueue('table', tableData.table_id, {
        form_layout_config: isConfigEmpty(cfg) ? '' : JSON.stringify(cfg),
    });
}

// Small indicator: is this layout overridden per-module or inherited?
/**
 * Updates the badge showing whether the current module overrides or inherits the form layout.
 * @returns {void}
 */
function updateLayoutSourceBadge() {
    const badge = document.getElementById('fl-source-badge');
    if (!badge) return;
    const mod = currentCustomModule();
    if (!mod) { badge.classList.add('hidden'); return; }
    const { overridden } = effectiveLayoutConfig();
    badge.classList.remove('hidden');
    badge.textContent = overridden ? 'Overridden for this module' : 'Inherited from main module';
    badge.style.color = overridden ? '#10b981' : '#888';
    badge.title = overridden
        ? 'This module has its own form layout. Reset to follow the main module again.'
        : 'This module follows the main module form layout until you change something here.';
    const resetBtn = document.getElementById('fl-reset-to-main');
    if (resetBtn) resetBtn.classList.toggle('hidden', !overridden);
}

/**
 * Deletes the custom module's layout override so it inherits the main module layout again.
 * @returns {void}
 */
function resetLayoutToMain() {
    const mod = currentCustomModule();
    if (!mod) return;
    const overrides = parseJsonSafe(mod.settings_override) || {};
    delete overrides.form_layout_config;
    const jsonString = JSON.stringify(overrides);
    mod.settings_override = jsonString;
    if (window.electronAPI && window.electronAPI.saveCustomTableOverride) {
        window.electronAPI.saveCustomTableOverride({ module_id: mod.module_id, settings_override: jsonString });
    }
    renderFormLayoutTab(currentTableData());
}

/**
 * Builds the DOM row for one layout group (title, description, collapsible options, remove button).
 * @param {Object} g Group object {key, title, description, collapsible, collapsed}.
 * @param {number} index Index of the group in workingGroups.
 * @returns {HTMLDivElement} The constructed row.
 */
function renderGroupRow(g, index) {
    const row = document.createElement('div');
    row.style.cssText = 'border:1px solid var(--border-color); border-radius:8px; padding:8px; display:grid; grid-template-columns: 1fr 1fr auto; gap:8px; align-items:start;';
    row.innerHTML = `
        <div>
            <input type="text" class="form-control fl-g-title" placeholder="Group title (e.g. Your Info)" value="${escapeAttr(g.title)}" data-idx="${index}">
            <input type="hidden" class="fl-g-key" value="${escapeAttr(g.key)}">
        </div>
        <div>
            <input type="text" class="form-control fl-g-desc" placeholder="Description (optional)" value="${escapeAttr(g.description || '')}" data-idx="${index}">
            <label class="checkbox-label" style="margin-top:4px;"><input type="checkbox" class="fl-g-collapsible" ${g.collapsible ? 'checked' : ''} data-idx="${index}"> Collapsible</label>
            <label class="checkbox-label" style="margin-top:2px;"><input type="checkbox" class="fl-g-collapsed" ${g.collapsed ? 'checked' : ''} data-idx="${index}" ${g.collapsible ? '' : 'disabled'}> Start collapsed</label>
        </div>
        <div>
            <button type="button" class="btn btn-small fl-g-remove" data-idx="${index}" title="Remove group">✕</button>
        </div>`;
    return row;
}

/**
 * Re-renders the groups list from workingGroups and wires each row's edit/remove handlers.
 * @returns {void}
 */
function renderGroupsList() {
    const list = document.getElementById('fl-groups-list');
    if (!list) return;
    list.innerHTML = '';
    workingGroups.forEach((g, i) => {
        const row = renderGroupRow(g, i);
        row.querySelector('.fl-g-title').addEventListener('input', (e) => {
            workingGroups[i].title = e.target.value;
            saveConfig();
        });
        row.querySelector('.fl-g-desc').addEventListener('input', (e) => {
            workingGroups[i].description = e.target.value;
            saveConfig();
        });
        row.querySelector('.fl-g-collapsible').addEventListener('change', (e) => {
            workingGroups[i].collapsible = e.target.checked;
            if (!e.target.checked) {
                workingGroups[i].collapsed = false;
                row.querySelector('.fl-g-collapsed').checked = false;
                row.querySelector('.fl-g-collapsed').disabled = true;
            } else {
                row.querySelector('.fl-g-collapsed').disabled = false;
            }
            saveConfig();
        });
        row.querySelector('.fl-g-collapsed').addEventListener('change', (e) => {
            workingGroups[i].collapsed = e.target.checked;
            saveConfig();
        });
        row.querySelector('.fl-g-remove').addEventListener('click', () => {
            workingGroups.splice(i, 1);
            renderGroupsList();
            saveConfig();
        });
        list.appendChild(row);
    });
}

/**
 * Shows/hides the groups, wizard, and chat panels according to the selected form style.
 * @returns {void}
 */
function updatePanelVisibility() {
    const style = document.getElementById('fl-style')?.value || 'default';
    const groupsPanel = document.getElementById('fl-groups-panel');
    const wizardPanel = document.getElementById('fl-wizard-panel');
    const chatPanel = document.getElementById('fl-chat-panel');
    const needsGroups = ['grouped', 'wizard', 'accordion', 'survey', 'checkout'].includes(style);
    if (groupsPanel) groupsPanel.classList.toggle('hidden', !needsGroups);
    if (wizardPanel) wizardPanel.classList.toggle('hidden', style !== 'wizard');
    if (chatPanel) chatPanel.classList.toggle('hidden', style !== 'conversational');
}

/**
 * Populates the Form Layout tab inputs from the effective layout config (module override or table config).
 * @param {Object} tableData Table data being edited.
 * @returns {void}
 */
function renderFormLayoutTab(tableData) {
    const styleEl = document.getElementById('fl-style');
    if (!styleEl) return;

    // In custom-module mode the effective config comes from the module's
    // settings_override (falling back to the table config); in default mode
    // it is the table config itself.
    let cfg = effectiveLayoutConfig().config;
    if (!cfg || typeof cfg !== 'object') {
        cfg = { style: 'default', columns: 0, label_display: 'above', groups: [], ungrouped_title: 'Additional Info', wizard: { start_step: 1, skippable: false } };
    }

    styleEl.value = cfg.style || 'default';
    document.getElementById('fl-columns').value = String(cfg.columns ?? 0);
    document.getElementById('fl-label-display').value = cfg.label_display || 'above';
    document.getElementById('fl-ungrouped-title').value = cfg.ungrouped_title || 'Additional Info';
    document.getElementById('fl-wizard-start').value = cfg.wizard?.start_step ?? 1;
    document.getElementById('fl-wizard-skippable').checked = !!cfg.wizard?.skippable;
    const chatSlugEl = document.getElementById('fl-chat-slug');
    const chatGreetEl = document.getElementById('fl-chat-greeting');
    const chatFareEl = document.getElementById('fl-chat-farewell');
    if (chatSlugEl) chatSlugEl.value = cfg.slug || '';
    if (chatGreetEl) chatGreetEl.value = cfg.chat?.greeting || '';
    if (chatFareEl) chatFareEl.value = cfg.chat?.farewell || '';

    workingGroups = (Array.isArray(cfg.groups) ? cfg.groups : []).map((g) => ({
        key: g.key, title: g.title || g.key, description: g.description || '',
        collapsible: !!g.collapsible, collapsed: !!g.collapsed,
    }));
    renderGroupsList();
    updatePanelVisibility();
    updateLayoutSourceBadge();
}

/**
 * Registers change listeners on all layout inputs plus the add-group and reset-to-main buttons.
 * @returns {void}
 */
function initFormLayoutTab() {
    ['fl-style', 'fl-columns', 'fl-label-display', 'fl-ungrouped-title', 'fl-wizard-start', 'fl-wizard-skippable', 'fl-chat-slug', 'fl-chat-greeting', 'fl-chat-farewell'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', () => { updatePanelVisibility(); saveConfig(); });
    });
    const addBtn = document.getElementById('fl-add-group');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            const keys = new Set(workingGroups.map((g) => g.key));
            const key = groupKeyify('New Group', keys);
            workingGroups.push({ key, title: 'New Group', description: '', collapsible: false, collapsed: false });
            renderGroupsList();
            saveConfig();
        });
    }
    const resetBtn = document.getElementById('fl-reset-to-main');
    if (resetBtn && !resetBtn.dataset.wired) {
        resetBtn.dataset.wired = '1';
        resetBtn.addEventListener('click', resetLayoutToMain);
    }
}

export { renderFormLayoutTab, initFormLayoutTab };
