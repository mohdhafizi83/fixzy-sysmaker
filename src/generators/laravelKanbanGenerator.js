const fs = require('fs');
const path = require('path');
const { toSingularPascalCase, toPluralPascalCase } = require('../utils');
const { renderTemplate } = require('../render/engine');

/**
 * [IR HELPER] Parse + validate grid_kanban_config. Returns null when the
 * feature is off or the config is unusable.
 *
 * Config JSON: { group_field, card_fields: string[], allowed_transitions:
 *   { "<from>": ["<to>", ...], ... }  (empty/absent = any transition) }
 * - group_field must exist and be options_list-like (enum values known).
 * - card_fields must all exist on the table.
 */
function parseKanbanConfig(tableData) {
    if (Number(tableData.grid_kanban_enabled) !== 1) return null;
    let cfg;
    try {
        cfg = JSON.parse(tableData.grid_kanban_config || '{}');
    } catch {
        return null;
    }
    const fields = tableData.fields || {};
    const groupField = String(cfg.group_field || '');
    const gf = fields[groupField];
    if (!gf) return null;
    // Group field must be an options_list with known values (enum-like).
    if (gf.display_type !== 'options_list' || !gf.options_list_values) return null;
    const options = String(gf.options_list_values)
        .split(';;')
        .map((s) => s.trim())
        .filter((s) => s !== '');
    if (options.length < 2) return null;

    const cardFields = Array.isArray(cfg.card_fields) ? cfg.card_fields.filter((f) => fields[f]) : [];
    if (cardFields.length === 0) return null;

    let transitions = {};
    if (cfg.allowed_transitions && typeof cfg.allowed_transitions === 'object') {
        for (const [from, toList] of Object.entries(cfg.allowed_transitions)) {
            if (!options.includes(from)) continue;
            if (!Array.isArray(toList)) continue;
            const allowed = toList.filter((t) => options.includes(t) && t !== from);
            if (allowed.length) transitions[from] = allowed;
        }
    }
    return { groupField, options, cardFields, transitions };
}

/**
 * [UTAMA] Generate a standalone Kanban board page per opted-in table.
 * Drag-and-drop uses vanilla HTML5 DnD calling a Livewire method that
 * guards with Resource::canEdit() + allowed-transition validation.
 */
async function generateKanbanPages(fullSchema, basePath) {
    const { database: { table: tables } } = fullSchema;
    let count = 0;
    for (const tableName in tables) {
        if (tableName === 'users') continue;
        const tableData = tables[tableName];
        const cfg = parseKanbanConfig(tableData);
        if (!cfg) continue;

        const nameSource = (tableData.module_name && tableData.module_name.trim() !== '')
            ? tableData.module_name : tableName;
        const modelSingular = toSingularPascalCase(nameSource);
        const resourceFolder = toPluralPascalCase(nameSource);
        const pageTitle = tableData.table_view_title || resourceFolder;

        const phpLiteral = (v) => `'${String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
        const php = renderTemplate('app/Filament/Pages/KanbanPage.php.njk', {
            page_class: `${modelSingular}Board`,
            blade_name: `${modelSingular.toLowerCase()}-board`,
            model_class: modelSingular,
            resource_class: `${modelSingular}Resource`,
            resource_folder: resourceFolder,
            page_title: `${pageTitle} Board`,
            slug: `${resourceFolder.toLowerCase()}-board`,
            groupField: cfg.groupField,
            transitions_php: `[${Object.entries(cfg.transitions).map(([f, tos]) => `${phpLiteral(f)} => [${tos.map(phpLiteral).join(', ')}]`).join(', ')}]`,
            column_order_php: `[${cfg.options.map(phpLiteral).join(', ')}]`,
            card_fields_php: `[${cfg.cardFields.map(phpLiteral).join(', ')}]`,
        });
        const blade = renderTemplate('resources/views/filament/pages/kanban.blade.php.njk', {
            options: cfg.options,
            cardFields: cfg.cardFields,
        });

        const pagesDir = path.join(basePath, 'app', 'Filament', 'Pages');
        const viewsDir = path.join(basePath, 'resources', 'views', 'filament', 'pages');
        fs.mkdirSync(pagesDir, { recursive: true });
        fs.mkdirSync(viewsDir, { recursive: true });
        fs.writeFileSync(path.join(pagesDir, `${modelSingular}Board.php`), php);
        fs.writeFileSync(path.join(viewsDir, `${modelSingular.toLowerCase()}-board.blade.php`), blade);
        count++;
    }
    return { success: true, message: `${count} kanban board pages generated.` };
}

module.exports = { generateKanbanPages, parseKanbanConfig };
