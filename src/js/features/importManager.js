// src/js/features/importManager.js
//
// Smart Import editor: per-table CSV import profile.
// Serialises into tables.import_config (JSON):
//   { "match_field": "email", "mode": "update", "dry_run": false }
//
// The enable switch is tbl-import-enabled (generic tbl-* autosave);
// this module owns import_config only.
//
// The generated Importer bakes this profile into resolveRecord():
//   update → match found → update; else insert
//   skip   → match found → skip row; else insert
//   insert → always insert

import { appState } from '../state.js';
import { SaveManager } from '../saveManager.js';

let bound = false;

/**
 * Resolves the table data object for the currently open workspace table.
 * @returns {Object|null} The table data from appState, or null in custom-module mode / unknown table.
 */
function currentTableData() {
    const badgeEl = document.getElementById('workspace-module-badge');
    const isCustomMode = badgeEl && badgeEl.classList.contains('badge-custom');
    if (isCustomMode) return null;
    const titleEl = document.getElementById('workspace-module-title');
    const tableName = (titleEl && (titleEl.dataset.tableName || titleEl.textContent.trim())) || null;
    return tableName && appState.jsonData?.database?.table?.[tableName]
        ? appState.jsonData.database.table[tableName]
        : null;
}

/**
 * Reads the current import profile (match field, mode, dry-run flag) from the form inputs.
 * @returns {Object} Config object shaped {match_field, mode, dry_run}.
 */
function readConfigFromDom() {
    return {
        match_field: document.getElementById('imp-match-field')?.value || '',
        mode: document.getElementById('imp-mode')?.value || 'update',
        dry_run: !!document.getElementById('imp-dry-run')?.checked,
    };
}

/**
 * Serialises the DOM-read import profile into tables.import_config via the autosave queue.
 * @returns {void}
 */
function saveConfig() {
    const tableData = currentTableData();
    if (!tableData || !tableData.table_id) return;
    const cfg = readConfigFromDom();
    SaveManager.addToQueue('table', tableData.table_id, { import_config: JSON.stringify(cfg) });
}

/**
 * Fills the match-field dropdown with the table's columns, selecting the saved one.
 * @param {Object} tableData Table data whose fields populate the dropdown.
 * @param {string} selected Field name to preselect.
 * @returns {void}
 */
function renderFieldSelect(tableData, selected) {
    const sel = document.getElementById('imp-match-field');
    if (!sel) return;
    sel.innerHTML = '';
    const fields = Object.entries(tableData?.fields || {})
        .filter(([, f]) => !['created_at', 'updated_at', 'deleted_at'].includes(f.field_name))
        .map(([name, f]) => ({ name, label: f.caption || name }));
    if (fields.length === 0) {
        sel.innerHTML = '<option value="">(no columns)</option>';
        return;
    }
    fields.forEach((f) => {
        const opt = document.createElement('option');
        opt.value = f.name;
        opt.textContent = f.label;
        if (f.name === selected) opt.selected = true;
        sel.appendChild(opt);
    });
}

/**
 * Shows or hides the import config panel based on the tbl-import-enabled checkbox.
 * @returns {void}
 */
function togglePanel() {
    const enabled = !!document.getElementById('tbl-import-enabled')?.checked;
    const panel = document.getElementById('import-panel');
    if (panel) panel.classList.toggle('hidden', !enabled);
}

/**
 * Populates the Import section UI (enable switch, match field, mode, dry-run) from table data.
 * @param {Object} tableData Table data with import_enabled/import_config fields.
 * @returns {void}
 */
export function renderImportSection(tableData) {
    if (!tableData) return;

    const enabled = Number(tableData.import_enabled) === 1;
    const cb = document.getElementById('tbl-import-enabled');
    if (cb) cb.checked = enabled;

    let cfg = {};
    if (tableData.import_config) {
        try {
            cfg = typeof tableData.import_config === 'string'
                ? JSON.parse(tableData.import_config)
                : tableData.import_config;
        } catch (e) {
            cfg = {};
        }
    }

    renderFieldSelect(tableData, cfg.match_field || '');
    const modeSel = document.getElementById('imp-mode');
    if (modeSel) modeSel.value = ['update', 'skip', 'insert'].includes(cfg.mode) ? cfg.mode : 'update';
    const dryRun = document.getElementById('imp-dry-run');
    if (dryRun) dryRun.checked = cfg.dry_run === true || cfg.dry_run === 'true';

    togglePanel();
}

/**
 * Registers change listeners for the Import section inputs (runs once).
 * @returns {void}
 */
export function initImportSection() {
    if (bound) return;
    bound = true;

    document.getElementById('tbl-import-enabled')?.addEventListener('change', () => {
        togglePanel();
        saveConfig();
    });
    ['imp-match-field', 'imp-mode', 'imp-dry-run'].forEach((id) => {
        document.getElementById(id)?.addEventListener('change', saveConfig);
    });
}
