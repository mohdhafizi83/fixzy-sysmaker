// Starter Pack installer (main process).
//
// installPreset(db, projectId, manifest) applies a validated manifest to a
// project inside ONE transaction: tables (+ system fields), user fields,
// parent/child relationships, menu groups/items, and custom modules with
// their field overrides. Everything lands as ordinary designer content —
// fully editable/deletable afterwards. No locked state.
//
// Mirrors the insert shapes of table:create / field:create /
// relationship:upsert / custom-module:save in src/handlers/register.js so
// installed content is byte-identical to hand-created content.
'use strict';

const { validateManifest } = require('./presetSchema');

/** Convert snake_case to Title Case, e.g. 'leave_request' -> 'Leave Request'. @param {string} name raw identifier @returns {string} humanized title */
function titleCase(name) {
    return String(name).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Serialize a value to a JSON string, passing through strings and substituting fallback for null/undefined. @param {*} v value to encode @param {string} fallback JSON used when v is null/undefined @returns {string} JSON string */
function jsonOr(v, fallback) {
    if (v === undefined || v === null) return fallback;
    if (typeof v === 'string') return v; // already JSON string
    return JSON.stringify(v);
}

/**
 * Check for name collisions against the project's current content.
 * @returns {{conflicts: {tables: string[], modules: string[]}}}
 */
function checkCollisions(db, projectId, manifest) {
    const conflicts = { tables: [], modules: [] };
    const tableExists = db.prepare('SELECT 1 FROM tables WHERE project_id = ? AND table_name = ?');
    const moduleExists = db.prepare('SELECT 1 FROM custom_modules WHERE project_id = ? AND module_name = ?');
    (manifest.tables || []).forEach((t) => {
        if (tableExists.get(projectId, t.table_name)) conflicts.tables.push(t.table_name);
    });
    (manifest.custom_modules || []).forEach((m) => {
        if (moduleExists.get(projectId, m.module_name)) conflicts.modules.push(m.module_name);
    });
    return conflicts;
}

/**
 * Install a Starter Pack manifest into a project.
 * @param {import('better-sqlite3').Database} db
 * @param {number} projectId
 * @param {object} manifest
 * @param {{skipValidation?: boolean}} [opts]
 * @returns {{success: boolean, message?: string, conflicts?: object, installed?: object}}
 */
function installPreset(db, projectId, manifest, opts = {}) {
    if (!opts.skipValidation) {
        const v = validateManifest(manifest);
        if (!v.valid) return { success: false, message: 'Invalid manifest: ' + v.errors.join('; ') };
    }

    const project = db.prepare('SELECT project_id FROM projects WHERE project_id = ?').get(projectId);
    if (!project) return { success: false, message: `Project ${projectId} not found` };

    const conflicts = checkCollisions(db, projectId, manifest);
    if (conflicts.tables.length || conflicts.modules.length) {
        return { success: false, message: 'Name collision with existing content', conflicts };
    }

    const installed = { tables: {}, modules: {}, menuGroups: {} };

    const tx = db.transaction(() => {
        // ---- helpers -----------------------------------------------------
        /** Next free table_order for this project (MAX+1). @returns {number} */
        const nextTableOrder = () => {
            const r = db.prepare('SELECT MAX(table_order) AS m FROM tables WHERE project_id = ?').get(projectId);
            return (r && r.m !== null ? r.m : 0) + 1;
        };
        /** Next free menu item order within a group (null group = top-level). @param {number|null} groupId menu group id or null @returns {number} */
        const nextMenuOrder = (groupId) => {
            const r = groupId === null || groupId === undefined
                ? db.prepare('SELECT MAX(item_order) AS m FROM menu_items WHERE project_id = ? AND menu_group_id IS NULL').get(projectId)
                : db.prepare('SELECT MAX(item_order) AS m FROM menu_items WHERE menu_group_id = ?').get(groupId);
            return (r && r.m !== null ? r.m : -1) + 1;
        };
        /** Find or create a menu group by name; returns its id (null when no name). @param {string} [groupName] @returns {number|null} menu_group_id */
        const ensureMenuGroup = (groupName) => {
            if (!groupName) return null;
            const existing = db.prepare('SELECT menu_group_id FROM menu_groups WHERE project_id = ? AND group_name = ?').get(projectId, groupName);
            if (existing) return existing.menu_group_id;
            const maxR = db.prepare('SELECT MAX(group_order) AS m FROM menu_groups WHERE project_id = ?').get(projectId);
            const order = (maxR && maxR.m !== null ? maxR.m : 0) + 1;
            return db.prepare('INSERT INTO menu_groups (project_id, group_name, group_order) VALUES (?, ?, ?)').run(projectId, groupName, order).lastInsertRowid;
        };

        const insertTable = db.prepare(
            'INSERT INTO tables (project_id, table_name, module_name, table_view_title, table_order) VALUES (?, ?, ?, ?, ?)'
        );
        const insertField = db.prepare(`
            INSERT INTO fields (table_id, field_name, caption, data_type, length, field_order,
                              enable_global_filter, enable_individual_filter, enable_range_filter, allow_sorting)
            VALUES (@table_id, @field_name, @caption, @data_type, @length, @field_order,
                    1, 0, @enable_range_filter, 1)
        `);
        const updateField = db.prepare('UPDATE fields SET "unique" = @u, not_null = @nn WHERE field_id = @field_id');

        // ---- tables + fields --------------------------------------------
        const DATE_TYPES = ['DATE', 'DATETIME', 'TIMESTAMP', 'TIME', 'YEAR'];
        const SYSTEM_FIELDS = [
            { name: 'id', caption: 'ID', type: 'INT', length: 11, pk: 1, ai: 1, unsigned: 1, ro: 1 },
            { name: 'created_at', caption: 'Created At', type: 'DATETIME', length: null, pk: 0, ai: 0, unsigned: 0, ro: 1 },
            { name: 'updated_at', caption: 'Updated At', type: 'DATETIME', length: null, pk: 0, ai: 0, unsigned: 0, ro: 1 },
            { name: 'deleted_at', caption: 'Deleted At', type: 'DATETIME', length: null, pk: 0, ai: 0, unsigned: 0, ro: 1 },
            { name: 'created_by', caption: 'Created By', type: 'BIGINT', length: 20, pk: 0, ai: 0, unsigned: 1, ro: 1 },
            { name: 'updated_by', caption: 'Updated By', type: 'BIGINT', length: 20, pk: 0, ai: 0, unsigned: 1, ro: 1 },
            { name: 'deleted_by', caption: 'Deleted By', type: 'BIGINT', length: 20, pk: 0, ai: 0, unsigned: 1, ro: 1 },
        ];

        for (const t of manifest.tables) {
            const tableId = insertTable.run(projectId, t.table_name, t.module_name, t.module_name, nextTableOrder()).lastInsertRowid;
            installed.tables[t.ref] = tableId;

            SYSTEM_FIELDS.forEach((sys, idx) => {
                insertField.run({
                    table_id: tableId, field_name: sys.name, caption: sys.caption,
                    data_type: sys.type, length: sys.length, field_order: idx,
                    enable_range_filter: 0,
                });
                if (sys.pk || sys.ai || sys.ro) {
                    const fid = db.prepare('SELECT field_id FROM fields WHERE table_id = ? AND field_name = ?').get(tableId, sys.name).field_id;
                    if (sys.pk) db.prepare('UPDATE fields SET primary_key = 1 WHERE field_id = ?').run(fid);
                    if (sys.ai) db.prepare('UPDATE fields SET auto_increment = 1 WHERE field_id = ?').run(fid);
                    if (sys.unsigned) db.prepare('UPDATE fields SET unsigned = 1 WHERE field_id = ?').run(fid);
                    if (sys.ro) db.prepare('UPDATE fields SET read_only = 1 WHERE field_id = ?').run(fid);
                }
            });

            let order = SYSTEM_FIELDS.length;
            for (const f of t.fields) {
                const fieldId = insertField.run({
                    table_id: tableId,
                    field_name: f.field_name,
                    caption: f.caption || titleCase(f.field_name),
                    data_type: f.field_type,
                    length: f.length !== undefined ? f.length : (f.field_type === 'VARCHAR' ? 255 : null),
                    field_order: order++,
                    enable_range_filter: DATE_TYPES.includes(f.field_type) ? 1 : 0,
                }).lastInsertRowid;

                // Remaining declarative settings (everything except what the
                // INSERT already handled).
                const handled = new Set(['field_name', 'field_type', 'caption', 'length']);
                const sets = [];
                const vals = [];
                Object.keys(f).forEach((k) => {
                    if (handled.has(k)) return;
                    let v = f[k];
                    if (typeof v === 'boolean') v = v ? 1 : 0;
                    sets.push(`"${k}" = ?`);
                    vals.push(v);
                });
                if (sets.length) {
                    db.prepare(`UPDATE fields SET ${sets.join(', ')} WHERE field_id = ?`).run(...vals, fieldId);
                }
            }

            // Table-level settings.
            if (t.table_settings && Object.keys(t.table_settings).length) {
                const sets = [];
                const vals = [];
                Object.entries(t.table_settings).forEach(([k, v]) => {
                    let out = v;
                    if (typeof v === 'boolean') out = v ? 1 : 0;
                    else if (v !== null && typeof v === 'object') out = JSON.stringify(v);
                    sets.push(`"${k}" = ?`);
                    vals.push(out);
                });
                db.prepare(`UPDATE tables SET ${sets.join(', ')} WHERE table_id = ?`).run(...vals, tableId);
            }

            // Menu placement: grouped or top-level.
            const groupId = t.menu_group ? ensureMenuGroup(t.menu_group) : null;
            if (groupId) installed.menuGroups[t.menu_group] = groupId;
            db.prepare(
                'INSERT INTO menu_items (project_id, table_id, item_label, item_detail, item_order, menu_group_id) VALUES (?, ?, ?, ?, ?, ?)'
            ).run(projectId, tableId, t.module_name, `${t.table_name} Module`, nextMenuOrder(groupId), groupId);
        }

        // ---- relationships ----------------------------------------------
        for (const r of manifest.relationships || []) {
            db.prepare(
                `INSERT INTO parent_child_relationships (parent_table_id, child_table_id, fk_child_field, parent_field)
                 VALUES (?, ?, ?, ?)`
            ).run(installed.tables[r.parent_ref], installed.tables[r.child_ref], r.fk_field, r.parent_field || 'id');
        }

        // ---- custom modules ----------------------------------------------
        (manifest.custom_modules || []).forEach((m) => {
            const baseTableId = installed.tables[m.base_table_ref];
            const maxR = db.prepare('SELECT MAX(module_order) AS m FROM custom_modules WHERE table_id = ?').get(baseTableId);
            const modOrder = (maxR && maxR.m !== null ? maxR.m : -1) + 1;
            const moduleId = db.prepare(
                `INSERT INTO custom_modules (project_id, table_id, module_name, module_order, menu_icon, filter_rules, included_relations, settings_override)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            ).run(
                projectId, baseTableId, m.module_name, modOrder,
                m.menu_icon || 'fas fa-box',
                jsonOr(m.filter_rules, '{"condition":"AND","rules":[]}'),
                jsonOr(m.included_relations, '[]'),
                jsonOr(m.settings_override, '{}')
            ).lastInsertRowid;
            installed.modules[m.ref] = moduleId;

            // Optional per-field overrides declared by the manifest.
            (m.fields || []).forEach((mf, idx) => {
                const fid = db.prepare('SELECT field_id FROM fields WHERE table_id = ? AND field_name = ?').get(baseTableId, mf.field_name);
                if (!fid) return;
                db.prepare(
                    `INSERT INTO custom_module_fields (module_id, field_id, is_readonly, settings_override, display_order)
                     VALUES (?, ?, ?, ?, ?)`
                ).run(moduleId, fid.field_id, mf.is_readonly ? 1 : 0, jsonOr(mf.settings_override, '{}'), idx);
            });

            // Menu item linked by module_id (mirrors custom-module:save).
            const groupId = m.menu_group ? ensureMenuGroup(m.menu_group) : null;
            db.prepare(
                'INSERT INTO menu_items (project_id, module_id, item_label, item_detail, item_order, menu_group_id) VALUES (?, ?, ?, ?, ?, ?)'
            ).run(projectId, moduleId, m.module_name, `${m.module_name} Custom Module`, nextMenuOrder(groupId), groupId);
        });

        return installed;
    });

    try {
        tx();
        return { success: true, installed };
    } catch (err) {
        return { success: false, message: err.message };
    }
}

/**
 * Load all bundled manifests from a presets directory (skips non-JSON and
 * helper files). Returns [{manifest, file}] sorted by slug.
 */
function loadBundledPresets(presetsDir, fs = require('fs'), path = require('path')) {
    if (!fs.existsSync(presetsDir)) return [];
    const out = [];
    for (const entry of fs.readdirSync(presetsDir).sort()) {
        if (!entry.endsWith('.json')) continue;
        const file = path.join(presetsDir, entry);
        try {
            const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
            if (manifest && manifest.slug) out.push({ manifest, file });
        } catch (e) {
            console.warn(`Skipping unreadable preset ${file}: ${e.message}`);
        }
    }
    return out;
}

/** Compact metadata for the picker UI (no full manifest). */
function presetSummary(manifest) {
    return {
        slug: manifest.slug,
        name: manifest.name,
        tagline: manifest.tagline,
        category: manifest.category,
        caveats: manifest.caveats || [],
        tables: (manifest.tables || []).map((t) => ({
            table_name: t.table_name,
            module_name: t.module_name,
            field_count: (t.fields || []).length,
            menu_group: t.menu_group || null,
            approval_enabled: !!(t.table_settings && t.table_settings.approval_enabled),
        })),
        custom_modules: (manifest.custom_modules || []).map((m) => ({
            module_name: m.module_name,
            base_table: m.base_table_ref,
        })),
    };
}

module.exports = { installPreset, checkCollisions, loadBundledPresets, presetSummary };
