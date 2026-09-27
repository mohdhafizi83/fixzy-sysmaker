// src/js/features/numberingManager.js
//
// Auto Numbering editor: per-table race-safe reference codes.
// Serialises into tables.numbering_config (JSON):
//   { "field": "invoice_no", "prefix": "INV", "date_token": "YYYYMM",
//     "width": 4, "reset": "monthly" }
//
// The enable switch is tbl-numbering-enabled (generic tbl-* autosave);
// this module owns numbering_config only.

import { appState } from '../state.js';
import { SaveManager } from '../saveManager.js';

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
 * Escapes &, <, and > for safe HTML interpolation.
 * @param {*} s Value to escape.
 * @returns {string} HTML-escaped string.
 */
function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

/**
 * Maps a date token to its counter reset period.
 * @param {string} token Date token ('YYYY', 'YYYYMM', 'YYYYMMDD', or '').
 * @returns {string} Reset period: 'daily', 'monthly', 'yearly', or 'never'.
 */
function resetForToken(token) {
    if (token === 'YYYYMMDD') return 'daily';
    if (token === 'YYYYMM') return 'monthly';
    if (token === 'YYYY') return 'yearly';
    return 'never';
}

/**
 * Reads the numbering profile (target field, prefix, date token, width) from the form inputs.
 * @returns {Object} Config object shaped {field, prefix, date_token, width, reset}.
 */
function readConfigFromDom() {
    const field = document.getElementById('num-field')?.value || '';
    const prefix = (document.getElementById('num-prefix')?.value || '').toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 12);
    const token = document.getElementById('num-token')?.value || '';
    let width = parseInt(document.getElementById('num-width')?.value, 10);
    if (!Number.isFinite(width)) width = 4;
    width = Math.min(8, Math.max(1, width));
    return { field, prefix, date_token: token, width, reset: resetForToken(token) };
}

/**
 * Refreshes the sample preview and serialises the config into tables.numbering_config via the autosave queue.
 * @returns {void}
 */
function saveConfig() {
    const tableData = currentTableData();
    if (!tableData || !tableData.table_id) return;
    const cfg = readConfigFromDom();
    updatePreview();
    SaveManager.addToQueue('table', tableData.table_id, { numbering_config: JSON.stringify(cfg) });
}

/**
 * Builds an example reference code from the config using today's date and a placeholder counter.
 * @param {Object} cfg Numbering config {prefix, date_token, width}.
 * @returns {string} Sample code like 'INV-202609-0001'.
 */
function sampleNumber(cfg) {
    const now = new Date();
    const y = now.getFullYear();
    const mo = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    let token = '';
    if (cfg.date_token === 'YYYY') token = String(y);
    else if (cfg.date_token === 'YYYYMM') token = `${y}${mo}`;
    else if (cfg.date_token === 'YYYYMMDD') token = `${y}${mo}${d}`;
    const parts = [];
    if (cfg.prefix) parts.push(cfg.prefix);
    if (token) parts.push(token);
    parts.push('1'.padStart(cfg.width, '0'));
    return parts.join('-');
}

/**
 * Updates the #num-preview text with a sample code for the current config.
 * @returns {void}
 */
function updatePreview() {
    const el = document.getElementById('num-preview');
    if (!el) return;
    const cfg = readConfigFromDom();
    if (!cfg.field) { el.textContent = ''; return; }
    el.textContent = `Sample: ${sampleNumber(cfg)} (counter resets ${cfg.reset})`;
}

/**
 * Fills the target-field dropdown with the table's columns, selecting the saved one.
 * @param {Object} tableData Table data whose fields populate the dropdown.
 * @param {string} selected Field name to preselect.
 * @returns {void}
 */
function renderFieldSelect(tableData, selected) {
    const sel = document.getElementById('num-field');
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
 * Shows/hides the numbering panel and populates its inputs from table data.
 * @param {Object} tableData Table data with numbering_enabled/numbering_config fields.
 * @returns {void}
 */
function renderNumberingSection(tableData) {
    const enabled = Number(tableData?.numbering_enabled) === 1;
    const panel = document.getElementById('numbering-panel');
    if (!panel) return;
    panel.classList.toggle('hidden', !enabled);
    if (!enabled) return;

    let cfg = null;
    try { cfg = tableData.numbering_config ? JSON.parse(tableData.numbering_config) : null; } catch (e) { cfg = null; }
    if (!cfg || typeof cfg !== 'object') {
        cfg = { field: '', prefix: '', date_token: 'YYYYMM', width: 4, reset: 'monthly' };
    }
    renderFieldSelect(tableData, cfg.field || '');
    const p = document.getElementById('num-prefix');
    if (p) p.value = cfg.prefix || '';
    const t = document.getElementById('num-token');
    if (t) t.value = cfg.date_token || 'YYYYMM';
    const w = document.getElementById('num-width');
    if (w) w.value = cfg.width || 4;
    updatePreview();
}

/**
 * Registers change listeners for the numbering enable switch and config inputs.
 * @returns {void}
 */
function initNumberingSection() {
    const enabledBox = document.getElementById('tbl-numbering-enabled');
    if (enabledBox) {
        enabledBox.addEventListener('change', () => {
            const panel = document.getElementById('numbering-panel');
            if (panel) panel.classList.toggle('hidden', !enabledBox.checked);
        });
    }
    ['num-field', 'num-prefix', 'num-token', 'num-width'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', saveConfig);
    });
}

export { renderNumberingSection, initNumberingSection };
