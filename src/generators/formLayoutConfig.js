// formLayoutConfig.js — IR helpers for the Form Design & Layout module (phase E).
//
// Per-table config (tables.form_layout_config JSON):
//   {
//     "style": "default|grouped|wizard|accordion|inline|survey|checkout|modal|conversational",
//     "columns": 1|2|3,                      // form column count (0 = inherit table grid)
//     "label_display": "above|inline|hidden_placeholder", // table-level default
//     "groups": [
//       { "key": "your_info", "title": "Your Info",
//         "description": "", "collapsible": false, "collapsed": false }
//     ],
//     "ungrouped_title": "Additional Info",   // section title for ungrouped fields
//     "wizard": { "start_step": 1, "skippable": false }
//   }
//
// Per-field settings (fields.* columns):
//   label_display     '' (inherit) | above | inline | hidden_placeholder
//   form_group        group key ('' = ungrouped)
//   visible_if        JSON {field, op, value}  op: equals|not_equals|in|filled|empty|checked|unchecked
//   required_if_state JSON {field, op, value}  op: equals|not_equals|in|filled|checked
//   depends_on        JSON {field, filter_column, count_column}  (dependent dropdown, E5)
//
// Design contract: ANY invalid/missing config normalises to the default
// (style "default", no groups) so existing projects generate exactly as
// before. Generation must never crash on bad JSON.

'use strict';

const FORM_STYLES = ['default', 'grouped', 'wizard', 'accordion', 'inline', 'survey', 'checkout', 'modal', 'conversational'];
const LABEL_MODES = ['above', 'inline', 'hidden_placeholder'];
const VISIBLE_OPS = ['equals', 'not_equals', 'in', 'filled', 'empty', 'checked', 'unchecked'];
const REQUIRED_OPS = ['equals', 'not_equals', 'in', 'filled', 'checked'];
const GROUP_KEY_RE = /^[a-z][a-z0-9_]*$/;
const FIELD_NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/** True for boolean-true, 1, or '1'. @param {*} v @returns {boolean} */
function truthy(v) {
    return v === true || v === 1 || v === '1';
}

/** Parse a JSON string without throwing; pass through objects; null on failure. @param {*} raw @returns {object|null} */
function parseJson(raw) {
    if (!raw) return null;
    if (typeof raw === 'object') return raw;
    try { return JSON.parse(raw); } catch (e) { return null; }
}

/**
 * Normalise the per-table form layout config.
 * Returns null when there is nothing to change (default form).
 */
function parseFormLayoutConfig(tableData) {
    if (!tableData) return null;
    const cfg = parseJson(tableData.form_layout_config);
    if (!cfg || typeof cfg !== 'object') return null;

    let style = String(cfg.style || 'default');
    if (!FORM_STYLES.includes(style)) style = 'default';

    let columns = parseInt(cfg.columns, 10);
    if (!Number.isInteger(columns) || columns < 0 || columns > 3) columns = 0;

    let labelDisplay = String(cfg.label_display || 'above');
    if (!LABEL_MODES.includes(labelDisplay)) labelDisplay = 'above';

    const groups = [];
    const seenKeys = new Set();
    if (Array.isArray(cfg.groups)) {
        for (const g of cfg.groups) {
            if (!g || typeof g !== 'object') continue;
            const key = String(g.key || '');
            if (!GROUP_KEY_RE.test(key) || seenKeys.has(key)) continue;
            seenKeys.add(key);
            groups.push({
                key,
                title: String(g.title || key).slice(0, 120),
                description: String(g.description || '').slice(0, 500),
                collapsible: truthy(g.collapsible),
                collapsed: truthy(g.collapsed) && truthy(g.collapsible),
            });
        }
    }

    const wizardCfg = cfg.wizard && typeof cfg.wizard === 'object' ? cfg.wizard : {};
    let startStep = parseInt(wizardCfg.start_step, 10);
    if (!Number.isInteger(startStep) || startStep < 1) startStep = 1;

    const result = {
        style,
        columns,
        label_display: labelDisplay,
        groups,
        ungrouped_title: String(cfg.ungrouped_title || 'Additional Info').slice(0, 120),
        wizard: { start_step: startStep, skippable: truthy(wizardCfg.skippable) },
        // Conversational (E6): chat copy + optional URL slug.
        chat: cfg.chat && typeof cfg.chat === 'object' ? {
            greeting: String(cfg.chat.greeting || '').slice(0, 500),
            farewell: String(cfg.chat.farewell || '').slice(0, 500),
        } : null,
        slug: String(cfg.slug || '').toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '') || null,
    };

    // "Nothing configured" => null so callers keep the legacy single-section form.
    if (style === 'default' && columns === 0 && groups.length === 0 && labelDisplay === 'above') {
        return null;
    }
    return result;
}

/**
 * Normalise one field's conditional rule ({field, op, value}).
 * Returns null when invalid or empty.
 */
function parseFieldRule(raw, allowedOps) {
    const rule = parseJson(raw);
    if (!rule || typeof rule !== 'object') return null;
    const field = String(rule.field || '');
    const op = String(rule.op || '');
    if (!FIELD_NAME_RE.test(field) || !allowedOps.includes(op)) return null;
    if (['filled', 'empty', 'checked', 'unchecked'].includes(op)) {
        return { field, op };
    }
    if (op === 'in') {
        const values = Array.isArray(rule.value)
            ? rule.value.map((v) => String(v)).filter((v) => v !== '')
            : [];
        if (values.length === 0) return null;
        return { field, op, value: values };
    }
    // equals / not_equals
    if (rule.value === undefined || rule.value === null || String(rule.value) === '') return null;
    return { field, op, value: String(rule.value) };
}

/**
 * Normalise per-field form settings into a plain object.
 * Always returns an object (possibly all-empty) for uniform consumption.
 */
function parseFieldFormSettings(field) {
    return {
        label_display: LABEL_MODES.includes(field.label_display) ? field.label_display : '',
        form_group: GROUP_KEY_RE.test(String(field.form_group || '')) ? String(field.form_group) : '',
        visible_if: parseFieldRule(field.visible_if, VISIBLE_OPS),
        required_if: parseFieldRule(field.required_if_state, REQUIRED_OPS),
        depends_on: parseDependsOn(field.depends_on),
    };
}

/**
 * depends_on: {field, filter_column, count_column}
 * - field:         the "parent" field in the same form (e.g. 'country_id')
 * - filter_column: column on THIS field's lookup table matching the parent's
 *                  stored value (e.g. 'country_id')
 * - count_column:  optional numeric column on the lookup table surfaced as
 *                  remaining-slots helper text (e.g. 'available_slots')
 */
function parseDependsOn(raw) {
    const dep = parseJson(raw);
    if (!dep || typeof dep !== 'object') return null;
    const field = String(dep.field || '');
    const filterColumn = String(dep.filter_column || '');
    if (!FIELD_NAME_RE.test(field) || !FIELD_NAME_RE.test(filterColumn)) return null;
    const countColumn = FIELD_NAME_RE.test(String(dep.count_column || '')) ? String(dep.count_column) : '';
    return { field, filter_column: filterColumn, count_column: countColumn };
}

/**
 * True when any table in the schema has a non-default form layout config.
 */
function anyFormLayoutEnabled(fullSchema) {
    const tables = (fullSchema && fullSchema.database && fullSchema.database.table) || {};
    return Object.values(tables).some((t) => parseFormLayoutConfig(t) !== null);
}

module.exports = {
    FORM_STYLES,
    LABEL_MODES,
    VISIBLE_OPS,
    REQUIRED_OPS,
    parseFormLayoutConfig,
    parseFieldRule,
    parseFieldFormSettings,
    parseDependsOn,
    anyFormLayoutEnabled,
};
