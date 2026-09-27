// src/js/features/approvalManager.js
//
// Approvals tab logic: a small visual editor for the per-table approval
// workflow. Everything serialises into tables.approval_config (JSON):
//
//   {
//     "initial": "pending",
//     "statuses": [ { "key": "pending", "label": "Pending", "color": "warning", "final": false } ],
//     "transitions": [ { "from": "pending", "to": "approved", "label": "Approve",
//                       "roles": "manager", "require_comment": false, "notify": "submitter" } ]
//   }
//
// The checkbox (tbl-approval-enabled) is saved by the generic tbl-* autosave
// handler; this module owns approval_config only.

import { appState } from '../state.js';
import { SaveManager } from '../saveManager.js';

const COLORS = ['gray', 'info', 'warning', 'success', 'danger'];

const PRESETS = {
    simple: {
        statuses: [
            { key: 'pending', label: 'Pending', color: 'warning', final: false },
            { key: 'approved', label: 'Approved', color: 'success', final: true },
            { key: 'rejected', label: 'Rejected', color: 'danger', final: true },
        ],
        transitions: [
            { from: 'pending', to: 'approved', label: 'Approve', roles: '', require_comment: false, notify: 'submitter' },
            { from: 'pending', to: 'rejected', label: 'Reject', roles: '', require_comment: true, notify: 'submitter' },
        ],
    },
    review: {
        statuses: [
            { key: 'draft', label: 'Draft', color: 'gray', final: false },
            { key: 'in_review', label: 'In Review', color: 'info', final: false },
            { key: 'approved', label: 'Approved', color: 'success', final: true },
            { key: 'rejected', label: 'Rejected', color: 'danger', final: true },
        ],
        transitions: [
            { from: 'draft', to: 'in_review', label: 'Submit for review', roles: '', require_comment: false, notify: '' },
            { from: 'in_review', to: 'approved', label: 'Approve', roles: '', require_comment: false, notify: 'submitter' },
            { from: 'in_review', to: 'rejected', label: 'Reject', roles: '', require_comment: true, notify: 'submitter' },
        ],
    },
    two_step: {
        statuses: [
            { key: 'draft', label: 'Draft', color: 'gray', final: false },
            { key: 'pending', label: 'Pending', color: 'warning', final: false },
            { key: 'manager_review', label: 'Manager Review', color: 'info', final: false },
            { key: 'approved', label: 'Approved', color: 'success', final: true },
            { key: 'rejected', label: 'Rejected', color: 'danger', final: true },
        ],
        transitions: [
            { from: 'draft', to: 'pending', label: 'Submit', roles: '', require_comment: false, notify: '' },
            { from: 'pending', to: 'manager_review', label: 'Forward to manager', roles: '', require_comment: false, notify: '' },
            { from: 'manager_review', to: 'approved', label: 'Approve', roles: 'manager', require_comment: false, notify: 'submitter' },
            { from: 'manager_review', to: 'rejected', label: 'Reject', roles: 'manager', require_comment: true, notify: 'submitter' },
        ],
    },
};

/**
 * Converts a status label into a unique snake_case key, de-duplicating against existing keys.
 * @param {string} label Human-readable status label.
 * @param {string[]} existingKeys Keys already in use.
 * @returns {string} Unique status key (e.g. 'in_review', 'in_review_2').
 */
function slugify(label, existingKeys) {
    let base = String(label || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    if (!base || !/^[a-z]/.test(base)) base = 'status_' + base;
    let key = base, i = 2;
    while (existingKeys.includes(key)) { key = base + '_' + (i++); }
    return key;
}

/**
 * Resolves the table_id of the currently open workspace table.
 * @returns {string|number|null} The table id, or null in custom-module mode / unknown table.
 */
function currentTableId() {
    const badgeEl = document.getElementById('workspace-module-badge');
    const isCustomMode = badgeEl && badgeEl.classList.contains('badge-custom');
    if (isCustomMode) return null; // approvals not supported on custom modules yet
    const titleEl = document.getElementById('workspace-module-title');
    const tableName = titleEl && (titleEl.dataset.tableName || titleEl.textContent.trim());
    const data = tableName && appState.jsonData?.database?.table?.[tableName];
    return data ? data.table_id : null;
}

/**
 * Reads the full approval workflow (status field, statuses, transitions) from the editor rows.
 * @returns {Object} Config object shaped {statusField, initial, statuses, transitions}.
 */
function readConfigFromDom() {
    const statuses = [];
    document.querySelectorAll('#approval-status-rows tr').forEach((tr) => {
        const label = tr.querySelector('.ap-label')?.value?.trim() || '';
        if (!label) return;
        statuses.push({
            key: tr.dataset.key || slugify(label, statuses.map(s => s.key)),
            label,
            color: tr.querySelector('.ap-color')?.value || 'gray',
            final: tr.querySelector('.ap-final')?.checked || false,
        });
        tr.dataset.key = statuses[statuses.length - 1].key;
    });
    const initialRadio = document.querySelector('#approval-status-rows .ap-initial:checked');
    const initial = initialRadio ? initialRadio.closest('tr').dataset.key : (statuses[0]?.key || '');
    const statusField = document.getElementById('approval-status-field')?.value || '';

    const transitions = [];
    document.querySelectorAll('#approval-transition-rows tr').forEach((tr) => {
        const from = tr.querySelector('.ap-from')?.value || '';
        const to = tr.querySelector('.ap-to')?.value || '';
        if (!from || !to) return;
        transitions.push({
            from, to,
            label: tr.querySelector('.ap-tlabel')?.value?.trim() || '',
            roles: tr.querySelector('.ap-roles')?.value?.trim() || '',
            require_comment: tr.querySelector('.ap-req')?.checked || false,
            notify: tr.querySelector('.ap-notify')?.value?.trim() || '',
        });
    });
    return { statusField, initial, statuses, transitions };
}

/**
 * Checks an approval config for structural problems (missing statuses, dupes, bad transitions).
 * @param {Object} cfg Config from readConfigFromDom.
 * @returns {string[]} Human-readable error messages; empty when valid.
 */
function validateConfig(cfg) {
    const errors = [];
    if (!cfg.statusField) errors.push('Pick the status field that stores the current status.');
    if (cfg.statuses.length < 2) errors.push('Add at least 2 statuses.');
    if (!cfg.initial) errors.push('Mark one status as the first status.');
    if (cfg.statuses.every(s => s.final)) errors.push('At least one status must not be final (records need somewhere to start).');
    const keys = cfg.statuses.map(s => s.key);
    if (new Set(keys).size !== keys.length) errors.push('Duplicate status labels detected — make each label unique.');
    cfg.transitions.forEach((t, i) => {
        if (!keys.includes(t.from) || !keys.includes(t.to)) errors.push(`Transition #${i + 1} references a missing status.`);
        if (t.from === t.to) errors.push(`Transition #${i + 1} goes from a status to itself.`);
        const fromStatus = cfg.statuses.find(s => s.key === t.from);
        if (fromStatus && fromStatus.final) errors.push(`Transition #${i + 1} starts from final status "${fromStatus.label}" — final statuses cannot move.`);
    });
    if (cfg.transitions.length === 0) errors.push('Add at least one transition.');
    return errors;
}

/**
 * Builds a status editor table row (label, color, initial radio, final checkbox, delete).
 * @param {Object} s Status object {key, label, color, final, isInitial}.
 * @returns {HTMLTableRowElement} The constructed row.
 */
function renderStatusRow(s) {
    const tr = document.createElement('tr');
    tr.dataset.key = s.key || '';
    tr.innerHTML = `
        <td style="padding: 4px;"><input type="text" class="ap-label" value="${escapeAttr(s.label || '')}" placeholder="e.g. Pending" style="width: 100%;"></td>
        <td style="padding: 4px;"><select class="ap-color">${COLORS.map(c => `<option value="${c}" ${s.color === c ? 'selected' : ''}>${c}</option>`).join('')}</select></td>
        <td style="padding: 4px; text-align: center;"><input type="radio" name="ap-initial" class="ap-initial" ${s.isInitial ? 'checked' : ''}></td>
        <td style="padding: 4px; text-align: center;"><input type="checkbox" class="ap-final" ${s.final ? 'checked' : ''}></td>
        <td style="padding: 4px; text-align: right;"><button type="button" class="btn btn-small ap-del">✕</button></td>`;
    tr.querySelector('.ap-del').addEventListener('click', () => { tr.remove(); refreshTransitionOptions(); saveConfig(); });
    tr.querySelectorAll('input, select').forEach(el => el.addEventListener('change', () => { refreshTransitionOptions(); saveConfig(); }));
    return tr;
}

/**
 * Builds a transition editor row (from/to selects, label, roles, require-comment, notify).
 * @param {Object} t Transition object {from, to, label, roles, require_comment, notify}.
 * @param {Object[]} statuses Available statuses used to fill the from/to dropdowns.
 * @returns {HTMLTableRowElement} The constructed row.
 */
function renderTransitionRow(t, statuses) {
    const tr = document.createElement('tr');
    const opts = statuses.map(s => `<option value="${s.key}">${escapeHtml(s.label)}</option>`);
    tr.innerHTML = `
        <td style="padding: 4px;"><select class="ap-from">${opts.join('')}</select></td>
        <td style="padding: 4px;"><select class="ap-to">${opts.join('')}</select></td>
        <td style="padding: 4px;"><input type="text" class="ap-tlabel" value="${escapeAttr(t.label || '')}" placeholder="Approve" style="width: 100%;"></td>
        <td style="padding: 4px;"><input type="text" class="ap-roles" value="${escapeAttr(t.roles || '')}" placeholder="any user" style="width: 100%;"></td>
        <td style="padding: 4px; text-align: center;"><input type="checkbox" class="ap-req" ${t.require_comment ? 'checked' : ''}></td>
        <td style="padding: 4px;"><input type="text" class="ap-notify" value="${escapeAttr(t.notify || '')}" placeholder="none" style="width: 100%;"></td>
        <td style="padding: 4px; text-align: right;"><button type="button" class="btn btn-small ap-del">✕</button></td>`;
    tr.querySelector('.ap-from').value = t.from || '';
    tr.querySelector('.ap-to').value = t.to || '';
    tr.querySelector('.ap-del').addEventListener('click', () => { tr.remove(); saveConfig(); });
    tr.querySelectorAll('input, select').forEach(el => el.addEventListener('change', saveConfig));
    return tr;
}

/**
 * Rebuilds from/to dropdown options in transition rows after statuses change, preserving valid selections.
 * @returns {void}
 */
function refreshTransitionOptions() {
    const statuses = readConfigFromDom().statuses;
    document.querySelectorAll('#approval-transition-rows select').forEach(sel => {
        const cur = sel.value;
        sel.innerHTML = statuses.map(s => `<option value="${s.key}">${escapeHtml(s.label)}</option>`).join('');
        if (statuses.some(s => s.key === cur)) sel.value = cur;
    });
}

/** Escapes &, <, and > for safe HTML interpolation. @param {*} s Value. @returns {string} Escaped string. */
function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
/** Escapes HTML special chars plus double quotes for attribute interpolation. @param {*} s Value. @returns {string} Escaped string. */
function escapeAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }

let saveTimer = null;
/**
 * Validates the DOM config and, if valid, debounces a save into tables.approval_config.
 * @returns {void}
 */
function saveConfig() {
    const cfg = readConfigFromDom();
    const errors = validateConfig(cfg);
    const msg = document.getElementById('approval-validation-msg');
    if (errors.length) {
        msg.classList.remove('hidden');
        msg.textContent = errors.join(' ');
        return; // don't persist invalid config
    }
    msg.classList.add('hidden');
    const tableId = currentTableId();
    if (!tableId) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        SaveManager.addToQueue('table', tableId, { approval_config: JSON.stringify(cfg) });
    }, 300);
}

/**
 * Replaces the editor with a named preset workflow (simple / review / two_step).
 * @param {string} name Preset key from PRESETS.
 * @returns {void}
 */
function loadPreset(name) {
    const preset = PRESETS[name];
    if (!preset) return;
    const tbody = document.getElementById('approval-status-rows');
    tbody.innerHTML = '';
    preset.statuses.forEach((s, idx) => {
        tbody.appendChild(renderStatusRow({ ...s, isInitial: idx === 0 }));
    });
    const tt = document.getElementById('approval-transition-rows');
    tt.innerHTML = '';
    preset.transitions.forEach(t => tt.appendChild(renderTransitionRow(t, preset.statuses)));
    saveConfig();
}

/**
 * Fills the status-field dropdown with text-like columns of the table.
 * @param {Object} tableData Table data whose fields populate the dropdown.
 * @param {string} selected Field name to preselect.
 * @returns {void}
 */
function renderStatusFieldSelect(tableData, selected) {
    const sel = document.getElementById('approval-status-field');
    if (!sel) return;
    const fields = tableData.fields || {};
    const options = Object.entries(fields)
        .filter(([, f]) => {
            const dt = (f.data_type || '').toUpperCase();
            return ['VARCHAR', 'TEXT', 'STRING', 'CHAR'].includes(dt) || dt.startsWith('VARCHAR');
        })
        .map(([name, f]) => ({ name, label: f.caption || name }));
    sel.innerHTML = '<option value="">-- pick a text column --</option>' +
        options.map(o => `<option value="${o.name}">${escapeHtml(o.label)} (${o.name})</option>`).join('');
    if (selected && options.some(o => o.name === selected)) sel.value = selected;
}

/**
 * Shows/hides the approval panel and seeds the editor from table data (simple preset on first enable).
 * @param {Object} tableData Table data with approval_enabled/approval_config fields.
 * @returns {void}
 */
function renderApprovalTab(tableData) {
    const enabled = Number(tableData.approval_enabled) === 1;
    const panel = document.getElementById('approval-config-panel');
    if (!panel) return;
    panel.classList.toggle('hidden', !enabled);
    if (!enabled) return;

    let cfg = null;
    try { cfg = tableData.approval_config ? JSON.parse(tableData.approval_config) : null; } catch (e) { cfg = null; }
    if (!cfg || !Array.isArray(cfg.statuses) || cfg.statuses.length === 0) {
        cfg = { statusField: '', initial: '', statuses: [], transitions: [] };
    }

    renderStatusFieldSelect(tableData, cfg.statusField);

    const tbody = document.getElementById('approval-status-rows');
    tbody.innerHTML = '';
    if (cfg.statuses.length === 0) {
        // First time enabling: seed with the simple preset.
        PRESETS.simple.statuses.forEach((s, idx) => {
            tbody.appendChild(renderStatusRow({ ...s, isInitial: idx === 0 }));
        });
        const tt = document.getElementById('approval-transition-rows');
        tt.innerHTML = '';
        PRESETS.simple.transitions.forEach(t => tt.appendChild(renderTransitionRow(t, PRESETS.simple.statuses)));
    } else {
        cfg.statuses.forEach(s => {
            tbody.appendChild(renderStatusRow({ ...s, isInitial: s.key === cfg.initial }));
        });
        const tt = document.getElementById('approval-transition-rows');
        tt.innerHTML = '';
        (cfg.transitions || []).forEach(t => tt.appendChild(renderTransitionRow(t, cfg.statuses)));
    }
}

/**
 * Registers all Approval tab listeners: enable switch, preset picker, status field, add-status/transition buttons.
 * @returns {void}
 */
export function initApprovalTab() {
    const enabledBox = document.getElementById('tbl-approval-enabled');
    if (enabledBox) {
        enabledBox.addEventListener('change', () => {
            const panel = document.getElementById('approval-config-panel');
            panel.classList.toggle('hidden', !enabledBox.checked);
            if (enabledBox.checked && document.querySelectorAll('#approval-status-rows tr').length === 0) {
                loadPreset('simple'); // sensible starting point
            }
        });
    }
    const presetSel = document.getElementById('approval-preset');
    if (presetSel) presetSel.addEventListener('change', () => { loadPreset(presetSel.value); presetSel.value = ''; });
    const statusFieldSel = document.getElementById('approval-status-field');
    if (statusFieldSel) statusFieldSel.addEventListener('change', saveConfig);
    const addStatus = document.getElementById('approval-add-status');
    if (addStatus) addStatus.addEventListener('click', () => {
        const tbody = document.getElementById('approval-status-rows');
        tbody.appendChild(renderStatusRow({ label: '', color: 'gray', final: false }));
        tbody.lastElementChild.querySelector('.ap-label').focus();
    });
    const addTransition = document.getElementById('approval-add-transition');
    if (addTransition) addTransition.addEventListener('click', () => {
        const statuses = readConfigFromDom().statuses;
        if (statuses.length < 2) return;
        const tt = document.getElementById('approval-transition-rows');
        tt.appendChild(renderTransitionRow({ from: statuses[0].key, to: statuses[1].key }, statuses));
    });
}

export { renderApprovalTab, validateConfig, slugify, PRESETS };
