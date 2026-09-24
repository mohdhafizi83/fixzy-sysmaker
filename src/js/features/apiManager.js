// src/js/features/apiManager.js
//
// REST API editor: per-table API profile.
// Serialises into tables.api_config (JSON):
//   { "read_roles": ["admin"], "write_roles": ["admin"],
//     "fields": ["nama"], "rate_limit": 60 }
//
// The enable switch is tbl-api-enabled (generic tbl-* autosave);
// this module owns api_config only.

import { appState } from '../state.js';
import { SaveManager } from '../saveManager.js';

let bound = false;

const SENSITIVE_RE = /(password|passwd|secret|token|api_key|apikey|private_key|otp|pin$)/i;

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

function parseRoles(str) {
    return (str || '')
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
}

function readConfigFromDom() {
    const fields = [];
    document.querySelectorAll('#api-fields-list input[type="checkbox"]:checked').forEach((cb) => {
        fields.push(cb.value);
    });
    return {
        read_roles: parseRoles(document.getElementById('api-read-roles')?.value),
        write_roles: parseRoles(document.getElementById('api-write-roles')?.value),
        fields,
        rate_limit: parseInt(document.getElementById('api-rate-limit')?.value, 10) || 60,
    };
}

function saveConfig() {
    const tableData = currentTableData();
    if (!tableData || !tableData.table_id) return;
    const cfg = readConfigFromDom();
    SaveManager.addToQueue('table', tableData.table_id, { api_config: JSON.stringify(cfg) });
}

function renderFieldsList(tableData, selectedFields) {
    const box = document.getElementById('api-fields-list');
    if (!box) return;
    box.innerHTML = '';
    const fields = Object.entries(tableData?.fields || {})
        .map(([name, f]) => ({ name, label: f.caption || name, sensitive: SENSITIVE_RE.test(name) }))
        .filter((f) => !['created_at', 'updated_at', 'deleted_at'].includes(f.name));
    if (fields.length === 0) {
        box.innerHTML = '<span class="helper-text">(no columns)</span>';
        return;
    }
    fields.forEach((f) => {
        const label = document.createElement('label');
        label.className = 'checkbox-label';
        if (f.sensitive) label.style.opacity = '0.45';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = f.name;
        cb.checked = selectedFields.includes(f.name) && !f.sensitive;
        cb.disabled = f.sensitive;
        cb.addEventListener('change', saveConfig);
        label.appendChild(cb);
        label.appendChild(document.createTextNode(' ' + f.label + (f.sensitive ? ' (sensitive — never exposed)' : '')));
        box.appendChild(label);
    });
}

function togglePanel() {
    const enabled = !!document.getElementById('tbl-api-enabled')?.checked;
    const panel = document.getElementById('api-panel');
    if (panel) panel.classList.toggle('hidden', !enabled);
}

export function renderApiSection(tableData) {
    if (!tableData) return;

    const enabled = Number(tableData.api_enabled) === 1;
    const cb = document.getElementById('tbl-api-enabled');
    if (cb) cb.checked = enabled;

    let cfg = {};
    if (tableData.api_config) {
        try {
            cfg = typeof tableData.api_config === 'string'
                ? JSON.parse(tableData.api_config)
                : tableData.api_config;
        } catch (e) {
            cfg = {};
        }
    }

    const rr = document.getElementById('api-read-roles');
    if (rr) rr.value = (cfg.read_roles || []).join(', ');
    const wr = document.getElementById('api-write-roles');
    if (wr) wr.value = (cfg.write_roles || []).join(', ');
    const rl = document.getElementById('api-rate-limit');
    if (rl) rl.value = Number(cfg.rate_limit) > 0 ? cfg.rate_limit : 60;

    renderFieldsList(tableData, Array.isArray(cfg.fields) ? cfg.fields : []);
    togglePanel();
}

export function initApiSection() {
    if (bound) return;
    bound = true;

    document.getElementById('tbl-api-enabled')?.addEventListener('change', () => {
        togglePanel();
        saveConfig();
    });
    ['api-read-roles', 'api-write-roles', 'api-rate-limit'].forEach((id) => {
        document.getElementById(id)?.addEventListener('change', saveConfig);
    });
}
