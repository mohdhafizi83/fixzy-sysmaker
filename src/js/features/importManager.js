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

function readConfigFromDom() {
    return {
        match_field: document.getElementById('imp-match-field')?.value || '',
        mode: document.getElementById('imp-mode')?.value || 'update',
        dry_run: !!document.getElementById('imp-dry-run')?.checked,
    };
}

function saveConfig() {
    const tableData = currentTableData();
    if (!tableData || !tableData.table_id) return;
    const cfg = readConfigFromDom();
    SaveManager.addToQueue('table', tableData.table_id, { import_config: JSON.stringify(cfg) });
}

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

function togglePanel() {
    const enabled = !!document.getElementById('tbl-import-enabled')?.checked;
    const panel = document.getElementById('import-panel');
    if (panel) panel.classList.toggle('hidden', !enabled);
}

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
