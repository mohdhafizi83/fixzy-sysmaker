// Starter Pack manifest validator.
//
// A manifest is a plain JSON object describing a pre-composed starter
// template. validateManifest() returns { valid, errors[], warnings[] }.
// The installer refuses anything with errors; warnings are informational.
//
// Shape (schema_version 1) — see src/presets/SCHEMA.md for full docs:
// {
//   schema_version: 1,
//   slug: 'leave-request', name: '...', tagline: '...', category: 'hr',
//   caveats: ['...'],
//   tables: [{ ref, table_name, module_name, menu_group?,
//              fields: [{ field_name, field_type, display_type?, required?,
//                        caption?, length?, options_list_values?, ... }],
//              table_settings?: { approval_enabled, approval_config, ... } }],
//   relationships: [{ parent_ref, child_ref, fk_field, parent_field? }],
//   custom_modules: [{ ref, base_table_ref, module_name, menu_icon?,
//                     filter_rules?, included_relations?, settings_override? }],
//   menu?: { groups: ['Leave', ...] }
// }
'use strict';

const { FIELD_TYPES, DISPLAY_TYPES, NAME_RE, TABLE_SETTINGS_KEYS, FIELD_SETTING_KEYS } = require('../presets/fieldTypes');

const SLUG_RE = /^[a-z][a-z0-9-]{1,62}$/;
const APPROVAL_COLORS = ['gray', 'info', 'warning', 'success', 'danger'];

/** True for non-null, non-array plain objects. @param {*} v @returns {boolean} */
function isPlainObject(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** Coerce a value to a plain object, accepting a JSON string encoding one. @param {*} v object or JSON string @returns {object|null} parsed object or null */
function asObject(v) {
    // Accept either an object or a JSON string encoding one.
    if (isPlainObject(v)) return v;
    if (typeof v === 'string') {
        try { const p = JSON.parse(v); return isPlainObject(p) ? p : null; } catch { return null; }
    }
    return null;
}

/** Validate an approval_config object (statuses, transitions, initial state); pushes messages into errors. @param {object} cfg approval config @param {string} where dotted path for error messages @param {string[]} errors accumulator @returns {void} */
function validateApprovalConfig(cfg, where, errors) {
    if (!isPlainObject(cfg)) { errors.push(`${where}: approval_config must be an object`); return; }
    if (!cfg.statusField || typeof cfg.statusField !== 'string') errors.push(`${where}: approval_config.statusField is required`);
    if (!Array.isArray(cfg.statuses) || cfg.statuses.length < 2) errors.push(`${where}: approval_config needs at least 2 statuses`);
    if (!cfg.initial) errors.push(`${where}: approval_config.initial is required`);
    const keys = [];
    (cfg.statuses || []).forEach((s, i) => {
        const w = `${where}.statuses[${i}]`;
        if (!isPlainObject(s) || !s.key || !NAME_RE.test(s.key)) errors.push(`${w}: status key must be snake_case`);
        if (!s.label) errors.push(`${w}: status label is required`);
        if (s.color !== undefined && !APPROVAL_COLORS.includes(s.color)) errors.push(`${w}: color must be one of ${APPROVAL_COLORS.join(', ')}`);
        if (keys.includes(s.key)) errors.push(`${w}: duplicate status key '${s.key}'`);
        keys.push(s.key);
    });
    if (cfg.initial && keys.length && !keys.includes(cfg.initial)) errors.push(`${where}: initial status '${cfg.initial}' not found in statuses`);
    if ((cfg.statuses || []).length && cfg.statuses.every((s) => s.final)) errors.push(`${where}: at least one status must be non-final`);
    if (!Array.isArray(cfg.transitions) || cfg.transitions.length === 0) errors.push(`${where}: approval_config needs at least 1 transition`);
    (cfg.transitions || []).forEach((t, i) => {
        const w = `${where}.transitions[${i}]`;
        if (!isPlainObject(t)) { errors.push(`${w}: transition must be an object`); return; }
        if (!keys.includes(t.from)) errors.push(`${w}: 'from' status '${t.from}' not declared`);
        if (!keys.includes(t.to)) errors.push(`${w}: 'to' status '${t.to}' not declared`);
    });
}

/**
 * Validate a Starter Pack manifest (schema_version 1): slug/name/category
 * metadata, tables + fields, relationships, custom modules, and menu.
 * @param {object} manifest parsed preset JSON
 * @returns {{valid: boolean, errors: string[], warnings: string[]}}
 */
function validateManifest(manifest) {
    const errors = [];
    const warnings = [];
    if (!isPlainObject(manifest)) return { valid: false, errors: ['manifest must be a JSON object'], warnings };

    if (manifest.schema_version !== 1) errors.push('schema_version must be 1');
    if (!manifest.slug || !SLUG_RE.test(manifest.slug)) errors.push('slug must be kebab-case (^[a-z][a-z0-9-]{1,62}$)');
    if (!manifest.name || typeof manifest.name !== 'string') errors.push('name is required');
    if (!manifest.tagline || typeof manifest.tagline !== 'string') errors.push('tagline is required');
    if (!manifest.category || typeof manifest.category !== 'string') errors.push('category is required');
    if (manifest.caveats !== undefined && !Array.isArray(manifest.caveats)) errors.push('caveats must be an array of strings');
    if (Array.isArray(manifest.caveats) && manifest.caveats.some((c) => typeof c !== 'string')) errors.push('caveats entries must be strings');

    if (!Array.isArray(manifest.tables) || manifest.tables.length === 0) {
        errors.push('tables must be a non-empty array');
        return { valid: false, errors, warnings };
    }

    const refs = new Set();
    const tableNames = new Set();

    manifest.tables.forEach((t, ti) => {
        const w = `tables[${ti}]`;
        if (!isPlainObject(t)) { errors.push(`${w}: entry must be an object`); return; }
        if (!t.ref || !NAME_RE.test(t.ref)) errors.push(`${w}.ref must be snake_case`);
        if (refs.has(t.ref)) errors.push(`${w}.ref '${t.ref}' duplicated`);
        refs.add(t.ref);
        if (!t.table_name || !NAME_RE.test(t.table_name)) errors.push(`${w}.table_name must be snake_case`);
        if (tableNames.has(t.table_name)) errors.push(`${w}.table_name '${t.table_name}' duplicated`);
        tableNames.add(t.table_name);
        if (!t.module_name || typeof t.module_name !== 'string') errors.push(`${w}.module_name is required`);

        if (!Array.isArray(t.fields) || t.fields.length === 0) { errors.push(`${w}.fields must be a non-empty array`); return; }
        const fieldNames = new Set(['id', 'created_at', 'updated_at', 'deleted_at', 'created_by', 'updated_by', 'deleted_by']);
        t.fields.forEach((f, fi) => {
            const fw = `${w}.fields[${fi}]`;
            if (!isPlainObject(f)) { errors.push(`${fw}: entry must be an object`); return; }
            if (!f.field_name || !NAME_RE.test(f.field_name)) errors.push(`${fw}.field_name must be snake_case`);
            if (fieldNames.has(f.field_name)) errors.push(`${fw}.field_name '${f.field_name}' is reserved (system columns added automatically)`);
            fieldNames.add(f.field_name);
            if (!FIELD_TYPES.includes(f.field_type)) errors.push(`${fw}.field_type '${f.field_type}' not in allowed types (${FIELD_TYPES.join(', ')})`);
            if (f.display_type !== undefined && !DISPLAY_TYPES.includes(f.display_type)) errors.push(`${fw}.display_type '${f.display_type}' not allowed`);
            if (f.field_type === 'DECIMAL' && f.precision === undefined) warnings.push(`${fw}: DECIMAL without precision — generator default applies`);
            if (f.display_type === 'options_list' && !f.options_list_values) errors.push(`${fw}: options_list display requires options_list_values`);
            Object.keys(f).forEach((k) => {
                if (['field_name', 'field_type'].includes(k)) return;
                if (!FIELD_SETTING_KEYS.has(k)) errors.push(`${fw}: unknown field setting '${k}'`);
            });
        });

        if (t.table_settings !== undefined) {
            if (!isPlainObject(t.table_settings)) { errors.push(`${w}.table_settings must be an object`); return; }
            Object.keys(t.table_settings).forEach((k) => {
                if (!TABLE_SETTINGS_KEYS.has(k)) errors.push(`${w}.table_settings: unknown key '${k}'`);
            });
            if (t.table_settings.approval_enabled) {
                const cfg = asObject(t.table_settings.approval_config);
                if (!cfg) errors.push(`${w}: approval_enabled requires a valid approval_config`);
                else {
                    validateApprovalConfig(cfg, `${w}.approval_config`, errors);
                    const declared = new Set(t.fields.map((f) => f.field_name));
                    if (cfg.statusField && !declared.has(cfg.statusField)) errors.push(`${w}.approval_config.statusField '${cfg.statusField}' is not a declared field`);
                }
            }
        }
    });

    if (Array.isArray(manifest.relationships)) {
        manifest.relationships.forEach((r, ri) => {
            const w = `relationships[${ri}]`;
            if (!isPlainObject(r)) { errors.push(`${w}: entry must be an object`); return; }
            if (!refs.has(r.parent_ref)) errors.push(`${w}.parent_ref '${r.parent_ref}' not a declared table ref`);
            if (!refs.has(r.child_ref)) errors.push(`${w}.child_ref '${r.child_ref}' not a declared table ref`);
            if (r.parent_ref === r.child_ref) errors.push(`${w}: parent and child cannot be the same ref`);
            if (!r.fk_field || !NAME_RE.test(r.fk_field)) errors.push(`${w}.fk_field must be snake_case`);
            const child = manifest.tables.find((t) => t.ref === r.child_ref);
            if (child && Array.isArray(child.fields) && !child.fields.some((f) => f.field_name === r.fk_field)) {
                errors.push(`${w}.fk_field '${r.fk_field}' not found in child table '${r.child_ref}' fields`);
            }
        });
    }

    const moduleRefs = new Set();
    if (Array.isArray(manifest.custom_modules)) {
        manifest.custom_modules.forEach((m, mi) => {
            const w = `custom_modules[${mi}]`;
            if (!isPlainObject(m)) { errors.push(`${w}: entry must be an object`); return; }
            if (!m.ref || !NAME_RE.test(m.ref)) errors.push(`${w}.ref must be snake_case`);
            if (moduleRefs.has(m.ref)) errors.push(`${w}.ref '${m.ref}' duplicated`);
            moduleRefs.add(m.ref);
            if (!refs.has(m.base_table_ref)) errors.push(`${w}.base_table_ref '${m.base_table_ref}' not a declared table ref`);
            if (!m.module_name || typeof m.module_name !== 'string') errors.push(`${w}.module_name is required`);
            const ov = asObject(m.settings_override);
            if (!ov) { errors.push(`${w}.settings_override must be an object or JSON string`); return; }
            Object.keys(ov).forEach((k) => {
                if (!TABLE_SETTINGS_KEYS.has(k)) errors.push(`${w}.settings_override: unknown key '${k}'`);
            });
            // Feature-flag convention: a module opting into calendar/kanban/tree
            // must carry the enabled flag AND its config in its OWN override.
            [['grid_calendar_enabled', 'grid_calendar_config'],
             ['grid_kanban_enabled', 'grid_kanban_config'],
             ['grid_tree_enabled', 'grid_tree_config']].forEach(([flag, cfgKey]) => {
                if (ov[flag] && !ov[cfgKey]) errors.push(`${w}: ${flag} set without ${cfgKey}`);
            });
            if (ov.approval_enabled) {
                const cfg = asObject(ov.approval_config);
                if (!cfg) errors.push(`${w}: approval_enabled requires a valid approval_config`);
                else validateApprovalConfig(cfg, `${w}.settings_override`, errors);
            }
        });
    }

    if (manifest.menu !== undefined) {
        if (!isPlainObject(manifest.menu) || !Array.isArray(manifest.menu.groups)) errors.push('menu.groups must be an array of strings');
        else if (manifest.menu.groups.some((g) => typeof g !== 'string' || !g.trim())) errors.push('menu.groups entries must be non-empty strings');
    }

    return { valid: errors.length === 0, errors, warnings };
}

module.exports = { validateManifest };
