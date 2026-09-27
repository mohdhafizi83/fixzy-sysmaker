// src/js/features/fieldBehaviorManager.js
//
// Field-level Form Behavior tab (phase E): label position, group
// assignment, conditional visibility and conditional required.
// Saves to fields.label_display / form_group / visible_if /
// required_if_state via SaveManager.

import { appState } from '../state.js';
import { SaveManager } from '../saveManager.js';

const VALUELESS_OPS = ['filled', 'empty', 'checked', 'unchecked'];

// Custom-module context (mirrors formLayoutDesigner.js). In custom mode the
// field-level form behavior must NOT be written to the main table field —
// fieldHandlers.js already routes fld-* changes into the module's
// custom_module_fields.settings_override. Writing via SaveManager here too
// would leak the override into the main module.
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

// Effective form layout config: module override ?? table config.
/**
 * Returns the form layout config, preferring the custom module's settings_override over the table's own.
 * @param {string} tableName Table whose layout is resolved.
 * @returns {Object|null} Parsed layout config or null.
 */
function effectiveLayoutConfig(tableName) {
    const parse = (raw) => { if (!raw) return null; if (typeof raw === 'object') return raw; try { return JSON.parse(raw); } catch (e) { return null; } };
    const mod = currentCustomModule();
    if (mod) {
        const overrides = parse(mod.settings_override) || {};
        if (overrides.form_layout_config) {
            const cfg = parse(overrides.form_layout_config);
            if (cfg) return cfg;
        }
    }
    const t = appState.jsonData?.database?.table?.[tableName];
    return t ? parse(t.form_layout_config) : null;
}

// Last field rendered in the Form Behavior tab (set by renderFieldBehaviorTab).
let lastContext = null;

/**
 * Lists sibling fields of a table (excluding the current one) ordered by field_order.
 * @param {string} tableName Table whose fields are listed.
 * @param {string} excludeFieldName Field to omit.
 * @returns {Array<{name: string, label: string}>} Sibling field descriptors.
 */
function siblingFields(tableName, excludeFieldName) {
    const fields = appState.jsonData?.database?.table?.[tableName]?.fields || {};
    return Object.values(fields)
        .filter((f) => f.field_name !== excludeFieldName)
        .sort((a, b) => (a.field_order ?? 999) - (b.field_order ?? 999))
        .map((f) => ({ name: f.field_name, label: f.caption || f.field_name }));
}

/**
 * Populates a field <select> with sibling options plus a placeholder, preselecting the saved value.
 * @param {HTMLSelectElement|null} selectEl Target select element.
 * @param {Array<{name: string, label: string}>} siblings Options to add.
 * @param {string} selected Value to preselect.
 * @param {string} placeholder Placeholder option text.
 * @returns {void}
 */
function fillFieldDropdown(selectEl, siblings, selected, placeholder) {
    if (!selectEl) return;
    selectEl.innerHTML = `<option value="">${placeholder}</option>`;
    siblings.forEach((f) => {
        const opt = document.createElement('option');
        opt.value = f.name;
        opt.textContent = f.label;
        if (f.name === selected) opt.selected = true;
        selectEl.appendChild(opt);
    });
}

/**
 * Loads a saved condition rule's value into the value input (blank when no rule).
 * @param {Object|null} rule Rule object {field, op, value} or null.
 * @param {string} valueInputId DOM id of the value input.
 * @param {string[]} [valueGroupIds] Unused group ids kept for call-site compatibility.
 * @returns {void}
 */
function ruleToForm(rule, valueInputId, valueGroupIds) {
    // Populate value input; hide value group for valueless ops.
    const valueEl = document.getElementById(valueInputId);
    if (!rule) { if (valueEl) valueEl.value = ''; return; }
    if (valueEl) valueEl.value = Array.isArray(rule.value) ? rule.value.join(', ') : (rule.value ?? '');
}

/**
 * Reads field/op/value selects into a condition rule object, or null when incomplete.
 * @param {string} fieldSelId DOM id of the field select.
 * @param {string} opSelId DOM id of the operator select.
 * @param {string} valueInputId DOM id of the value input.
 * @returns {Object|null} Rule {field, op[, value]} or null.
 */
function formToRule(fieldSelId, opSelId, valueInputId) {
    const field = document.getElementById(fieldSelId)?.value || '';
    const op = document.getElementById(opSelId)?.value || '';
    if (!field || !op) return null;
    if (VALUELESS_OPS.includes(op)) return { field, op };
    const raw = (document.getElementById(valueInputId)?.value || '').trim();
    if (!raw) return null;
    if (op === 'in') {
        const values = raw.split(',').map((s) => s.trim()).filter(Boolean);
        if (!values.length) return null;
        return { field, op, value: values };
    }
    return { field, op, value: raw };
}

/**
 * Dims/disables the value input when the chosen operator needs no value (filled/empty/checked/unchecked).
 * @param {string} opPrefix ID prefix ('fld-vis' or 'fld-req').
 * @returns {void}
 */
function updateValueVisibility(opPrefix) {
    const op = document.getElementById(`${opPrefix}-op`)?.value || '';
    const group = document.getElementById(`${opPrefix}-value-group`);
    if (group) group.style.opacity = VALUELESS_OPS.includes(op) ? '0.4' : '1';
    const val = document.getElementById(`${opPrefix}-value`);
    if (val) val.disabled = VALUELESS_OPS.includes(op);
}

/**
 * Fills the Form Behavior tab (label display, group, visible-if, required-if, dependency) for one field.
 * @param {string} tableName Table containing the field.
 * @param {string} fieldName Field being edited.
 * @returns {void}
 */
function renderFieldBehaviorTab(tableName, fieldName) {
    const fieldData = appState.jsonData?.database?.table?.[tableName]?.fields?.[fieldName];
    if (!fieldData) return;
    lastContext = { tableName, fieldName };
    const siblings = siblingFields(tableName, fieldName);

    const labelEl = document.getElementById('fld-label-display');
    if (labelEl) labelEl.value = fieldData.label_display || '';

    // Group dropdown from the effective form layout config
    // (custom module override ?? table config).
    const groupEl = document.getElementById('fld-form-group');
    if (groupEl) {
        const cfg = effectiveLayoutConfig(tableName);
        const groups = cfg && Array.isArray(cfg.groups) ? cfg.groups : [];
        groupEl.innerHTML = '<option value="">Ungrouped</option>';
        groups.forEach((g) => {
            const opt = document.createElement('option');
            opt.value = g.key;
            opt.textContent = g.title || g.key;
            if (g.key === fieldData.form_group) opt.selected = true;
            groupEl.appendChild(opt);
        });
    }

    fillFieldDropdown(document.getElementById('fld-vis-field'), siblings, fieldData.visible_if?.field || '', '— never condition —');
    const visOp = document.getElementById('fld-vis-op');
    if (visOp) visOp.value = fieldData.visible_if?.op || 'equals';
    ruleToForm(fieldData.visible_if, 'fld-vis-value');

    fillFieldDropdown(document.getElementById('fld-req-field'), siblings, fieldData.required_if_state?.field || '', '— no condition —');
    const reqOp = document.getElementById('fld-req-op');
    if (reqOp) reqOp.value = fieldData.required_if_state?.op || 'equals';
    ruleToForm(fieldData.required_if_state, 'fld-req-value');

    // Dependent dropdown (E5)
    let dep = null;
    try { dep = fieldData.depends_on ? JSON.parse(fieldData.depends_on) : null; } catch (e) { dep = null; }
    fillFieldDropdown(document.getElementById('fld-dep-field'), siblings, dep?.field || '', '— no dependency —');
    const depFilter = document.getElementById('fld-dep-filter');
    const depCount = document.getElementById('fld-dep-count');
    if (depFilter) depFilter.value = dep?.filter_column || '';
    if (depCount) depCount.value = dep?.count_column || '';
    const isLookup = !!(fieldData.lookup_parent_table);
    const depFieldset = document.getElementById('fld-dep-field')?.closest('fieldset');
    if (depFieldset) depFieldset.style.display = isLookup ? '' : 'none';

    updateValueVisibility('fld-vis');
    updateValueVisibility('fld-req');
}

/**
 * Persists the Form Behavior tab inputs (label, group, visible_if, required_if, depends_on) for the field.
 * Skipped in custom-module mode, where fieldHandlers.js owns the override routing.
 * @param {string} tableName Table containing the field.
 * @param {string} fieldName Field being saved.
 * @returns {void}
 */
function saveBehavior(tableName, fieldName) {
    const fieldData = appState.jsonData?.database?.table?.[tableName]?.fields?.[fieldName];
    if (!fieldData || !fieldData.field_id) return;
    // Custom module mode: fieldHandlers.js routes every fld-* change into the
    // module's custom_module_fields.settings_override. A SaveManager write
    // here would leak the override into the MAIN table field — skip it.
    if (currentCustomModule()) return;
    const vis = formToRule('fld-vis-field', 'fld-vis-op', 'fld-vis-value');
    const req = formToRule('fld-req-field', 'fld-req-op', 'fld-req-value');
    const depField = document.getElementById('fld-dep-field')?.value || '';
    const depFilter = (document.getElementById('fld-dep-filter')?.value || '').trim();
    const depCount = (document.getElementById('fld-dep-count')?.value || '').trim();
    const dep = depField && depFilter ? { field: depField, filter_column: depFilter, count_column: depCount } : null;
    SaveManager.addToQueue('field', fieldData.field_id, {
        label_display: document.getElementById('fld-label-display')?.value || '',
        form_group: document.getElementById('fld-form-group')?.value || '',
        visible_if: vis ? JSON.stringify(vis) : '',
        required_if_state: req ? JSON.stringify(req) : '',
        depends_on: dep ? JSON.stringify(dep) : '',
    });
}

/**
 * Wires change listeners on all Form Behavior inputs; saves resolve table/field from lastContext.
 * @returns {void}
 */
function initFieldBehaviorTab() {
    // Wire saves lazily: the current table/field is resolved at save time
    // from the workspace title (same pattern as publicFormManager).
    const ids = ['fld-label-display', 'fld-form-group', 'fld-vis-field', 'fld-vis-op', 'fld-vis-value', 'fld-req-field', 'fld-req-op', 'fld-req-value', 'fld-dep-field', 'fld-dep-filter', 'fld-dep-count'];
    ids.forEach((id) => {
        const el = document.getElementById(id);
        if (!el || el.dataset.behaviorWired) return;
        el.dataset.behaviorWired = '1';
        el.addEventListener('change', () => {
            if (id.startsWith('fld-vis')) updateValueVisibility('fld-vis');
            if (id.startsWith('fld-req')) updateValueVisibility('fld-req');
            const ctx = lastContext;
            if (ctx) saveBehavior(ctx.tableName, ctx.fieldName);
        });
    });
}

export { renderFieldBehaviorTab, initFieldBehaviorTab };
