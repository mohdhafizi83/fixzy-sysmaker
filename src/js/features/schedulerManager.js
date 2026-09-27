// src/js/features/schedulerManager.js
//
// Automation tab logic: a small editor for per-table scheduler rules.
// Everything serialises into tables.scheduler_config (JSON):
//
//   {
//     "reminders": [ { "field": "due_date", "offsetDays": 3, "notify": "admin" } ],
//     "recurring": { "recurrence": "monthly", "day": 1, "weekday": 1, "notify": "" }
//   }
//
// The project-level master switch is app-module-scheduler (generic
// app-* autosave); this module owns scheduler_config only. Rules are
// still saved when the master switch is off (with a visible warning) so
// the design isn't lost — the generator ignores them until it's on.

import { appState } from '../state.js';
import { SaveManager } from '../saveManager.js';

const DATE_TYPES = ['DATE', 'DATETIME', 'TIMESTAMP', 'TIMESTAMPTZ'];

/**
 * Resolves the table name of the currently open workspace table.
 * @returns {string|null} Table name, or null in custom-module mode.
 */
function currentTableName() {
    const badgeEl = document.getElementById('workspace-module-badge');
    const isCustomMode = badgeEl && badgeEl.classList.contains('badge-custom');
    if (isCustomMode) return null; // scheduler rules not supported on custom modules yet
    const titleEl = document.getElementById('workspace-module-title');
    return (titleEl && (titleEl.dataset.tableName || titleEl.textContent.trim())) || null;
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

/**
 * True when the field's data type is a date-like type (DATE/DATETIME/TIMESTAMP).
 * @param {Object} fieldData Field definition to check.
 * @returns {boolean} Whether the field can drive reminders.
 */
function isDateField(fieldData) {
    const dt = String((fieldData && fieldData.data_type) || '').toUpperCase();
    return DATE_TYPES.some((d) => dt === d || dt.startsWith(d));
}

/**
 * Lists the table's date-like fields usable as reminder anchors.
 * @param {Object} tableData Table data whose fields are filtered.
 * @returns {Array<{name: string, label: string}>} Date field descriptors.
 */
function dateFieldOptions(tableData) {
    const fields = tableData?.fields || {};
    return Object.entries(fields)
        .filter(([, f]) => isDateField(f))
        .map(([name, f]) => ({ name, label: f.caption || name }));
}

/** Escapes &, <, and > for safe HTML interpolation. @param {*} s Value. @returns {string} Escaped string. */
function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
/** Escapes HTML special chars plus double quotes for attribute interpolation. @param {*} s Value. @returns {string} Escaped string. */
function escapeAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }

/**
 * Reads the scheduler profile (reminder rows + recurring cycle) from the editor inputs.
 * @returns {Object} Config object shaped {reminders, recurring|null}.
 */
function readConfigFromDom() {
    const reminders = [];
    document.querySelectorAll('#scheduler-reminder-rows tr').forEach((tr) => {
        const field = tr.querySelector('.sch-field')?.value || '';
        if (!field) return;
        let offset = parseInt(tr.querySelector('.sch-offset')?.value, 10);
        if (!Number.isFinite(offset)) offset = 0;
        offset = Math.min(365, Math.max(0, offset));
        reminders.push({
            field,
            offsetDays: offset,
            notify: tr.querySelector('.sch-notify')?.value?.trim() || '',
        });
    });

    let recurring = null;
    const rec = document.getElementById('scheduler-recurring-enabled')?.value || '';
    if (rec) {
        recurring = {
            recurrence: rec,
            day: Math.min(31, Math.max(1, parseInt(document.getElementById('scheduler-recurring-day')?.value, 10) || 1)),
            weekday: Math.min(7, Math.max(1, parseInt(document.getElementById('scheduler-recurring-weekday')?.value, 10) || 1)),
            notify: document.getElementById('scheduler-recurring-notify')?.value?.trim() || '',
        };
    }

    return { reminders, recurring };
}

/**
 * Checks the scheduler config for duplicate reminder fields and invalid recurrence values.
 * @param {Object} cfg Config from readConfigFromDom.
 * @returns {string[]} Human-readable error messages; empty when valid.
 */
function validateConfig(cfg) {
    const errors = [];
    const seen = new Set();
    cfg.reminders.forEach((r, i) => {
        if (seen.has(r.field)) errors.push(`Duplicate reminder on field "${r.field}".`);
        seen.add(r.field);
    });
    if (cfg.recurring && !['daily', 'weekly', 'monthly'].includes(cfg.recurring.recurrence)) {
        errors.push('Recurring cycle must be daily, weekly, or monthly.');
    }
    return errors;
}

let saveTimer = null;
/**
 * Validates the DOM config and, if valid, debounces a save into tables.scheduler_config (null when empty).
 * @returns {void}
 */
function saveConfig() {
    const cfg = readConfigFromDom();
    const msg = document.getElementById('scheduler-validation-msg');
    const errors = validateConfig(cfg);
    if (errors.length) {
        if (msg) { msg.classList.remove('hidden'); msg.textContent = errors.join(' '); }
        return; // don't persist invalid config
    }
    if (msg) msg.classList.add('hidden');
    const tableData = currentTableData();
    if (!tableData || !tableData.table_id) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        const payload = (cfg.reminders.length === 0 && !cfg.recurring)
            ? null
            : JSON.stringify(cfg);
        SaveManager.addToQueue('table', tableData.table_id, { scheduler_config: payload });
    }, 300);
}

/**
 * Builds a reminder editor row (date-field select, offset days, notify target, delete).
 * @param {Object} r Reminder object {field, offsetDays, notify}.
 * @param {Array<{name: string, label: string}>} dateOptions Date fields for the dropdown.
 * @returns {HTMLTableRowElement} The constructed row.
 */
function renderReminderRow(r, dateOptions) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td style="padding: 4px;"><select class="sch-field" style="width: 100%;">
            <option value="">-- pick a date field --</option>
            ${dateOptions.map(o => `<option value="${o.name}">${escapeHtml(o.label)} (${o.name})</option>`).join('')}
        </select></td>
        <td style="padding: 4px;"><input type="number" class="sch-offset" min="0" max="365" value="${Number.isFinite(r.offsetDays) ? r.offsetDays : 0}" style="width: 80px;"></td>
        <td style="padding: 4px;"><input type="text" class="sch-notify" value="${escapeAttr(r.notify || '')}" placeholder="e.g. admin" style="width: 100%;"></td>
        <td style="padding: 4px; text-align: right;"><button type="button" class="btn btn-small sch-del">✕</button></td>`;
    if (r.field) tr.querySelector('.sch-field').value = r.field;
    tr.querySelector('.sch-del').addEventListener('click', () => { tr.remove(); saveConfig(); });
    tr.querySelectorAll('input, select').forEach(el => el.addEventListener('change', saveConfig));
    return tr;
}

/**
 * Shows the day input for monthly recurrence and the weekday input for weekly recurrence.
 * @returns {void}
 */
function toggleRecurringGroups() {
    const rec = document.getElementById('scheduler-recurring-enabled')?.value || '';
    const dayGroup = document.getElementById('scheduler-recurring-day-group');
    const wdGroup = document.getElementById('scheduler-recurring-weekday-group');
    if (dayGroup) dayGroup.style.display = rec === 'monthly' ? '' : 'none';
    if (wdGroup) wdGroup.style.display = rec === 'weekly' ? '' : 'none';
}

/**
 * Populates the Automation tab: master-switch warning, reminder rows, and recurring-cycle inputs.
 * @param {Object} tableData Table data with scheduler_config field.
 * @returns {void}
 */
function renderAutomationTab(tableData) {
    const tbody = document.getElementById('scheduler-reminder-rows');
    if (!tbody || !tableData) return;

    // Master-switch warning (rules still editable; generator gates on it).
    const schedulerOn = Number(appState.jsonData?.project?.module_scheduler) === 1;
    const note = document.getElementById('scheduler-disabled-note');
    if (note) note.classList.toggle('hidden', schedulerOn);

    let cfg = null;
    try { cfg = tableData.scheduler_config ? JSON.parse(tableData.scheduler_config) : null; } catch (e) { cfg = null; }
    if (!cfg || typeof cfg !== 'object') cfg = { reminders: [], recurring: null };

    const dateOptions = dateFieldOptions(tableData);
    tbody.innerHTML = '';
    (Array.isArray(cfg.reminders) ? cfg.reminders : []).forEach(r => {
        tbody.appendChild(renderReminderRow(r, dateOptions));
    });

    const recSel = document.getElementById('scheduler-recurring-enabled');
    if (recSel) recSel.value = cfg.recurring?.recurrence || '';
    const dayEl = document.getElementById('scheduler-recurring-day');
    if (dayEl && cfg.recurring?.day) dayEl.value = cfg.recurring.day;
    const wdEl = document.getElementById('scheduler-recurring-weekday');
    if (wdEl && cfg.recurring?.weekday) wdEl.value = cfg.recurring.weekday;
    const notifyEl = document.getElementById('scheduler-recurring-notify');
    if (notifyEl) notifyEl.value = cfg.recurring?.notify || '';
    toggleRecurringGroups();
}

/**
 * Registers listeners for the add-reminder button and recurring-cycle inputs.
 * @returns {void}
 */
export function initSchedulerTab() {
    const addBtn = document.getElementById('scheduler-add-reminder');
    if (addBtn) addBtn.addEventListener('click', () => {
        const tbody = document.getElementById('scheduler-reminder-rows');
        const tableData = currentTableData();
        tbody.appendChild(renderReminderRow({ offsetDays: 1 }, dateFieldOptions(tableData)));
    });
    const recSel = document.getElementById('scheduler-recurring-enabled');
    if (recSel) recSel.addEventListener('change', () => { toggleRecurringGroups(); saveConfig(); });
    ['scheduler-recurring-day', 'scheduler-recurring-weekday', 'scheduler-recurring-notify'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', saveConfig);
    });
}

export { renderAutomationTab, validateConfig };
