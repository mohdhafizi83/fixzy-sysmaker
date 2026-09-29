'use strict';
/**
 * MCP tool registry (Fixzy SysMaker MCP server).
 *
 * Pure registry: every tool is { name, description, inputSchema, gate, handler }.
 * No transport code lives here — see src/mcp/server.js.
 *
 * Handlers reuse the exact IPC handler registry the GUI uses
 * (src/handlers/register.js, via a shimmed ipcMain), so MCP and the GUI share
 * ONE code path. MCP never re-implements schema logic; whatever validation the
 * GUI enforces, agents get for free.
 *
 * Gating model (security-by-default):
 *   gate: null        — always exposed (read-only tools)
 *   gate: 'write'     — exposed only when allowWrite (FSM_MCP_ALLOW_WRITE=1)
 *   gate: 'generate'  — exposed only when allowGenerate (FSM_MCP_ALLOW_GENERATE=1)
 *
 * app:deploy / app:update / run-composer / preview:* are intentionally NOT
 * exposed over MCP at all: remote mutation of live deployments must stay a
 * human-initiated action.
 */

const fs = require('fs');
const path = require('path');

const TABLE_NAME_RE = /^[a-z][a-z0-9_]{1,60}$/;
const FIELD_NAME_RE = /^[a-zA-Z_]{1,64}$/;
const FIXTURE_NAME_RE = /^[A-Za-z0-9_.-]+$/;

/** Title-case a module name for relationship tab titles (mirrors register.js). */
function toTitleCase(str) {
    return String(str || '')
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .trim();
}

/** Recursively count files under a directory. */
function countFiles(dir) {
    let n = 0;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) n += countFiles(path.join(dir, entry.name));
        else n += 1;
    }
    return n;
}

/**
 * Build the tool registry bound to a live context.
 * @param {object} ctx
 * @param {import('better-sqlite3').Database} ctx.db         open Fixzy store
 * @param {(name:string, ...args:any[])=>Promise<any>} ctx.callHandler  invoke an IPC handler
 * @param {boolean} ctx.allowWrite
 * @param {boolean} ctx.allowGenerate
 * @returns {Array<{name:string,description:string,inputSchema:object,gate:?string,handler:Function}>}
 */
function buildToolRegistry(ctx) {
    const { db, callHandler } = ctx;

    /** Resolve a project ref (id or exact app_title) to its row, or throw. */
    function resolveProject(ref) {
        let project = null;
        if (/^\d+$/.test(String(ref))) {
            project = db.prepare('SELECT * FROM projects WHERE project_id = ?').get(Number(ref));
        }
        if (!project) {
            project = db.prepare('SELECT * FROM projects WHERE app_title = ?').get(String(ref));
        }
        if (!project) throw new Error(`Project not found: ${ref}`);
        return project;
    }

    /** Resolve a table row by name within a project, or throw. */
    function resolveTable(projectId, tableName) {
        const t = db.prepare('SELECT * FROM tables WHERE project_id = ? AND table_name = ?')
            .get(projectId, String(tableName));
        if (!t) throw new Error(`Table '${tableName}' not found in project ${projectId}.`);
        return t;
    }

    /** Load full schema for a project ref (same assembly the GUI uses). */
    async function loadFullSchema(projectId) {
        const fullSchema = await callHandler('project:get-full-schema', projectId);
        if (!fullSchema) throw new Error(`Failed to load full schema for project ${projectId}.`);
        return fullSchema;
    }

    const tools = [
        // ── READ (always exposed) ─────────────────────────────────────────
        {
            name: 'fixzy_capabilities',
            gate: null,
            description:
                'Describe what this Fixzy SysMaker instance can do: supported stacks, ' +
                'database engines, theme presets, widget types, and which tool groups ' +
                '(write / generate) are currently enabled. Call this first.',
            inputSchema: { type: 'object', properties: {} },
            handler: async () => {
                const dbSupport = require('../core/dbSupport');
                const theme = require('../core/theme');
                let widgetTypes = [];
                try {
                    const rc = require('../generators/reportConfig');
                    widgetTypes = rc.WIDGET_TYPES || [];
                } catch { /* reportConfig optional in slim installs */ }
                const pkg = require('../../package.json');
                return {
                    name: 'Fixzy SysMaker',
                    version: pkg.version,
                    description: 'Multi-stack admin system generator (IR-driven). ' +
                        'Design schemas here; generators emit plain readable app code.',
                    stacks: [
                        { id: 'laravel_filament', status: 'production',
                          note: 'Laravel + Filament admin panel (migrations, models, ' +
                              'resources, forms, tables, import/export, realtime, etc.)' },
                    ],
                    database_engines: dbSupport.SUPPORTED_UI_VALUES,
                    engine_driver_map: dbSupport.ENGINE_BY_UI,
                    theme_presets: Object.keys(theme.PRESETS || {}),
                    widget_types: widgetTypes,
                    gating: {
                        write_enabled: !!ctx.allowWrite,
                        generate_enabled: !!ctx.allowGenerate,
                        hint: 'Set FSM_MCP_ALLOW_WRITE=1 / FSM_MCP_ALLOW_GENERATE=1 ' +
                            '(or --allow-write / --allow-generate) to expose those tools.',
                    },
                    never_exposed: ['app:deploy', 'app:update', 'run-composer', 'preview:*'],
                };
            },
        },
        {
            name: 'fixzy_list_projects',
            gate: null,
            description: 'List all projects in the Fixzy SysMaker store (id, title, active flag).',
            inputSchema: { type: 'object', properties: {} },
            handler: async () => {
                const rows = await callHandler('projects:get-all');
                return { projects: rows || [] };
            },
        },
        {
            name: 'fixzy_get_schema',
            gate: null,
            description:
                'Return the full schema of a project: project settings, tables with ' +
                'fields, relationships, menu structure, widgets, custom modules. ' +
                'Accepts a project id or exact app_title.',
            inputSchema: {
                type: 'object',
                properties: {
                    project: { type: ['string', 'integer'], description: 'Project id or exact app_title.' },
                },
                required: ['project'],
            },
            handler: async (args) => {
                const project = resolveProject(args.project);
                return await loadFullSchema(project.project_id);
            },
        },
        {
            name: 'fixzy_validate_schema',
            gate: null,
            description:
                'Validate a project schema through the IR gate (exportIR + validateIR). ' +
                'Returns { valid, errors: [{path, message}] }. Run this before generating ' +
                'to catch structural problems early.',
            inputSchema: {
                type: 'object',
                properties: {
                    project: { type: ['string', 'integer'], description: 'Project id or exact app_title.' },
                },
                required: ['project'],
            },
            handler: async (args) => {
                const project = resolveProject(args.project);
                const fullSchema = await loadFullSchema(project.project_id);
                const { exportIR } = require('../ir/exporter');
                const { validateIR } = require('../ir/validate');
                try {
                    const { valid, errors } = validateIR(exportIR(fullSchema));
                    return { valid, errors: errors || [] };
                } catch (e) {
                    return { valid: false, errors: [{ path: '$', message: `IR export failed: ${e.message}` }] };
                }
            },
        },

        // ── WRITE (gated: FSM_MCP_ALLOW_WRITE=1) ─────────────────────────
        {
            name: 'fixzy_create_project',
            gate: 'write',
            description:
                'Create a new project (also seeds the core `users` table and marks the ' +
                'new project active). Returns the created project row.',
            inputSchema: {
                type: 'object',
                properties: {
                    name: { type: 'string', minLength: 1, maxLength: 120, description: 'App title for the new project.' },
                },
                required: ['name'],
            },
            handler: async (args) => {
                const created = await callHandler('project:create', String(args.name).trim());
                if (!created) throw new Error('Project creation failed (see server log).');
                return { success: true, project: created };
            },
        },
        {
            name: 'fixzy_add_table',
            gate: 'write',
            description:
                'Add a table to a project. The table gets the standard system fields ' +
                '(id, timestamps, userstamps) and a menu entry, exactly like the GUI. ' +
                'table_name must be snake_case (lowercase letters, digits, underscores).',
            inputSchema: {
                type: 'object',
                properties: {
                    project: { type: ['string', 'integer'], description: 'Project id or exact app_title.' },
                    table_name: { type: 'string', description: 'Snake_case table name, e.g. "books".' },
                    module_name: { type: 'string', description: 'Optional module name (defaults to table_name).' },
                    view_title: { type: 'string', description: 'Optional table-view title (defaults to table_name).' },
                },
                required: ['project', 'table_name'],
            },
            handler: async (args) => {
                const project = resolveProject(args.project);
                const tableName = String(args.table_name);
                if (!TABLE_NAME_RE.test(tableName)) {
                    throw new Error(`Invalid table_name "${tableName}": use snake_case, 2-61 chars, start with a letter.`);
                }
                const existing = db.prepare('SELECT table_id FROM tables WHERE project_id = ? AND table_name = ?')
                    .get(project.project_id, tableName);
                if (existing) throw new Error(`Table '${tableName}' already exists in this project.`);

                const created = await callHandler('table:create', project.project_id);
                if (!created) throw new Error('Table creation failed (see server log).');

                // table:create seeds random placeholder names; rename to the
                // requested name and keep module/view titles consistent
                // (the GUI renames all three together).
                const updates = {
                    table_id: created.table_id,
                    table_name: tableName,
                    module_name: args.module_name ? String(args.module_name) : tableName,
                    table_view_title: args.view_title ? String(args.view_title) : tableName,
                };
                const upd = await callHandler('table:update', updates);
                if (upd && upd.success === false) {
                    throw new Error(`Table rename failed: ${upd.message || 'unknown error'}`);
                }
                return { success: true, table: db.prepare('SELECT * FROM tables WHERE table_id = ?').get(created.table_id) };
            },
        },
        {
            name: 'fixzy_add_field',
            gate: 'write',
            description:
                'Add a field to an existing table. Common options: data_type (VARCHAR, ' +
                'INT, BIGINT, TEXT, DATE, DATETIME, DECIMAL, BOOLEAN...), length, ' +
                'required, unique, default_value, caption. Field names: letters and ' +
                'underscores only.',
            inputSchema: {
                type: 'object',
                properties: {
                    project: { type: ['string', 'integer'], description: 'Project id or exact app_title.' },
                    table_name: { type: 'string', description: 'Existing table in the project.' },
                    field_name: { type: 'string', description: 'Field name (letters/underscores).' },
                    data_type: { type: 'string', description: 'SQL-ish type, e.g. VARCHAR, INT, DATETIME.' },
                    length: { type: 'integer', minimum: 1, maximum: 4294967295 },
                    caption: { type: 'string' },
                    required: { type: 'boolean' },
                    unique: { type: 'boolean' },
                    not_null: { type: 'boolean' },
                    default_value: { type: 'string' },
                    unsigned: { type: 'boolean' },
                    helper_text: { type: 'string' },
                },
                required: ['project', 'table_name', 'field_name', 'data_type'],
            },
            handler: async (args) => {
                const project = resolveProject(args.project);
                const table = resolveTable(project.project_id, args.table_name);
                const fieldName = String(args.field_name).trim();
                if (!FIELD_NAME_RE.test(fieldName)) {
                    throw new Error(`Invalid field_name "${fieldName}": letters and underscores only.`);
                }
                const dupe = db.prepare('SELECT field_id FROM fields WHERE table_id = ? AND field_name = ?')
                    .get(table.table_id, fieldName);
                if (dupe) throw new Error(`Field '${fieldName}' already exists in table '${args.table_name}'.`);

                const created = await callHandler('field:create', table.table_id);
                if (!created) throw new Error('Field creation failed (see server log).');

                const updates = { field_id: created.field_id, field_name: fieldName, data_type: String(args.data_type).toUpperCase() };
                for (const k of ['length', 'caption', 'required', 'unique', 'not_null', 'default_value', 'unsigned', 'helper_text']) {
                    if (args[k] !== undefined) {
                        // SQLite binds only numbers/strings/null — the GUI sends
                        // 1/0 for boolean flags, so coerce true/false here.
                        updates[k] = typeof args[k] === 'boolean' ? (args[k] ? 1 : 0) : args[k];
                    }
                }
                const upd = await callHandler('field:update', updates);
                if (upd && upd.success === false) {
                    throw new Error(`Field update failed: ${upd.message || 'unknown error'}`);
                }
                return { success: true, field: db.prepare('SELECT * FROM fields WHERE field_id = ?').get(created.field_id) };
            },
        },
        {
            name: 'fixzy_set_relationship',
            gate: 'write',
            description:
                'Declare a one-to-many relationship: parent table ← child table via the ' +
                'child\'s foreign-key field (the fk field must already exist on the ' +
                'child table). Upserts: re-declaring updates the parent binding.',
            inputSchema: {
                type: 'object',
                properties: {
                    project: { type: ['string', 'integer'], description: 'Project id or exact app_title.' },
                    parent_table: { type: 'string', description: 'Parent table name.' },
                    child_table: { type: 'string', description: 'Child table name.' },
                    fk_field: { type: 'string', description: 'Foreign-key field on the child table, e.g. "book_id".' },
                },
                required: ['project', 'parent_table', 'child_table', 'fk_field'],
            },
            handler: async (args) => {
                const project = resolveProject(args.project);
                const parent = resolveTable(project.project_id, args.parent_table);
                const child = resolveTable(project.project_id, args.child_table);
                const fk = db.prepare('SELECT * FROM fields WHERE table_id = ? AND field_name = ?')
                    .get(child.table_id, String(args.fk_field));
                if (!fk) {
                    throw new Error(
                        `Foreign-key field '${args.fk_field}' does not exist on table '${args.child_table}'. ` +
                        `Create it first with fixzy_add_field.`);
                }
                const pkField = db.prepare('SELECT field_name FROM fields WHERE table_id = ? AND primary_key = 1 LIMIT 1')
                    .get(parent.table_id);
                const parentFieldName = pkField ? pkField.field_name : 'id';

                // NOTE: deliberately NOT delegating to the 'relationship:upsert'
                // IPC handler — that handler resolves tables by name GLOBALLY
                // (no project scope), which can bind same-named tables across
                // different projects. The MCP layer keeps the same row shape but
                // resolves everything project-scoped.
                const existing = db.prepare(
                    'SELECT * FROM parent_child_relationships WHERE fk_child_field = ? AND child_table_id = ?'
                ).get(String(args.fk_field), child.table_id);
                if (existing) {
                    db.prepare('UPDATE parent_child_relationships SET parent_table_id = ? WHERE relationship_id = ?')
                        .run(parent.table_id, existing.relationship_id);
                    return { success: true, updated: true,
                        relationship: db.prepare('SELECT * FROM parent_child_relationships WHERE relationship_id = ?')
                            .get(existing.relationship_id) };
                }
                const info = db.prepare(
                    'INSERT INTO parent_child_relationships ' +
                    '(parent_table_id, child_table_id, fk_child_field, parent_field, relationship_type, tab_title) ' +
                    "VALUES (?, ?, ?, ?, 'one-to-many', ?)"
                ).run(parent.table_id, child.table_id, String(args.fk_field), parentFieldName,
                    toTitleCase(child.module_name || child.table_name));
                return { success: true, created: true,
                    relationship: db.prepare('SELECT * FROM parent_child_relationships WHERE relationship_id = ?')
                        .get(info.lastInsertRowid) };
            },
        },
        {
            name: 'fixzy_update_project_settings',
            gate: 'write',
            description:
                'Update project-level settings (same allowlist the GUI enforces — ' +
                'unknown keys are silently dropped by the handler). Examples: ' +
                'stack_database, theme_config, module_realtime, kiosk_enabled, ' +
                'debug_mode, app_title. Returns the list of keys actually applied.',
            inputSchema: {
                type: 'object',
                properties: {
                    project: { type: ['string', 'integer'], description: 'Project id or exact app_title.' },
                    settings: { type: 'object', description: 'Key/value map of project columns to update.' },
                },
                required: ['project', 'settings'],
            },
            handler: async (args) => {
                const project = resolveProject(args.project);
                const settings = { ...(args.settings || {}) };
                // SQLite binds only numbers/strings/null — coerce booleans to 1/0
                // (the GUI sends integers for all flag columns) and JSON-encode
                // object/array values (theme_config etc. store JSON text).
                for (const [k, v] of Object.entries(settings)) {
                    if (typeof v === 'boolean') settings[k] = v ? 1 : 0;
                    else if (v !== null && typeof v === 'object') settings[k] = JSON.stringify(v);
                }
                const payload = { project_id: project.project_id, ...settings };
                const res = await callHandler('project:update', payload);
                if (res && res.success === false) throw new Error(`Update failed: ${res.message || 'unknown'}`);
                const applied = { ...payload };
                delete applied.project_id;
                return { success: true, requested: applied, note: 'Keys outside the server allowlist were dropped.' };
            },
        },

        // ── GENERATE (gated: FSM_MCP_ALLOW_GENERATE=1) ───────────────────
        {
            name: 'fixzy_generate',
            gate: 'generate',
            description:
                'Generate the Laravel + Filament application for a stored project (or a ' +
                'bundled fixture) into an output directory. The destination is checked ' +
                'against the output allowlist (FSM_OUTPUT_ROOTS; default ~/projects and ' +
                '$HOME) — paths outside the roots or containing ".." are rejected. ' +
                'Returns the target directory and generated file count.',
            inputSchema: {
                type: 'object',
                properties: {
                    project: { type: ['string', 'integer'], description: 'Project id or exact app_title (mutually exclusive with fixture).' },
                    fixture: { type: 'string', description: 'Bundled fixture name, e.g. "base_simple" (mutually exclusive with project).' },
                    out: { type: 'string', description: 'Output directory (must be inside allowed roots).' },
                },
                required: ['out'],
            },
            handler: async (args) => {
                if (args.project && args.fixture) {
                    throw new Error('Provide either "project" or "fixture", not both.');
                }
                if (!args.project && !args.fixture) {
                    throw new Error('Provide "project" or "fixture".');
                }
                const { validateOutputPath } = require('../core/pathGuard');
                const { generateLaravelFilamentStack } = require('../generators/laravelFilamentStack');

                // Guard the RAW argument first (before resolve() erases `..`),
                // then re-check the resolved form — same order as the CLI.
                const guardRaw = validateOutputPath(String(args.out));
                if (!guardRaw.ok) throw new Error(`Output path rejected: ${guardRaw.reason}`);
                const outDir = path.resolve(String(args.out));
                const guard = validateOutputPath(outDir);
                if (!guard.ok) throw new Error(`Output path rejected: ${guard.reason}`);

                let fullSchema = null;
                let projectName = null;
                if (args.fixture) {
                    const fixtureName = String(args.fixture).replace(/\.json$/, '');
                    if (!FIXTURE_NAME_RE.test(fixtureName)) {
                        throw new Error(`Invalid fixture name: ${args.fixture}`);
                    }
                    const fixturePath = path.join(__dirname, '..', '..', 'test', 'fixtures', fixtureName + '.json');
                    if (!fs.existsSync(fixturePath)) throw new Error(`Fixture not found: ${fixtureName}`);
                    fullSchema = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
                    projectName = (fullSchema.project && fullSchema.project.app_title) || fixtureName;
                } else {
                    const project = resolveProject(args.project);
                    projectName = project.app_title;
                    fullSchema = await loadFullSchema(project.project_id);
                }

                // IR gate (mirrors GUI/CLI behaviour — warn-only).
                let irIssues = [];
                try {
                    const { exportIR } = require('../ir/exporter');
                    const { validateIR } = require('../ir/validate');
                    const { valid, errors } = validateIR(exportIR(fullSchema));
                    if (!valid) irIssues = errors || [];
                } catch (e) {
                    irIssues = [{ path: '$', message: `IR validation skipped: ${e.message}` }];
                }

                const target = path.join(guard.resolved,
                    String(projectName).replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase());
                fs.mkdirSync(target, { recursive: true });
                const result = await generateLaravelFilamentStack(fullSchema, target);
                if (!result || !result.success) {
                    throw new Error(`Generation failed: ${(result && result.message) || 'unknown error'}`);
                }
                return {
                    success: true,
                    target,
                    files: countFiles(target),
                    ir_issues: irIssues,
                };
            },
        },
    ];

    return tools;
}

module.exports = { buildToolRegistry, TABLE_NAME_RE, FIELD_NAME_RE };
