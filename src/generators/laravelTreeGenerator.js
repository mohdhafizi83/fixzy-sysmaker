// Hierarchical tree view generator (Fixzy SysMaker).
// Emits a nested-set/parent-child tree page per table that opts in via
// tree_config (parent_id self-reference).
const fs = require('fs');
const path = require('path');
const { toSingularPascalCase, toPluralPascalCase } = require('../utils');
const { renderTemplate } = require('../render/engine');
const { collectFeatureSources } = require('./customModuleSources');

/**
 * [IR HELPER] Parse + validate grid_tree_config. Returns null when the
 * feature is off or the config is unusable.
 *
 * Config JSON: { parent_field, label_field }
 * - parent_field must exist on the table and be an integer type
 *   (self-referencing FK column, e.g. parent_id).
 * - label_field must exist on the table.
 */
function parseTreeConfig(tableData) {
    if (Number(tableData.grid_tree_enabled) !== 1) return null;
    let cfg;
    try {
        cfg = JSON.parse(tableData.grid_tree_config || '{}');
    } catch {
        return null;
    }
    const fields = tableData.fields || {};
    const parentField = String(cfg.parent_field || '');
    const labelField = String(cfg.label_field || '');
    if (!parentField || !fields[parentField]) return null;
    if (!labelField || !fields[labelField]) return null;
    const pt = String(fields[parentField].data_type || '').toUpperCase();
    if (!['INTEGER', 'INT', 'BIGINT', 'SMALLINT', 'TINYINT', 'DECIMAL', 'NUMERIC'].includes(pt)) return null;
    return { parentField, labelField };
}

/**
 * [UTAMA] Generate a standalone tree page per table that opted in.
 * Read-only expandable hierarchy (server-rendered, flattened with depth —
 * no recursive includes, no JS tree library).
 */
async function generateTreePages(fullSchema, basePath) {
    const { database: { table: tables } } = fullSchema;
    let count = 0;
    for (const { nameSource, tableData } of collectFeatureSources(tables, parseTreeConfig, 'grid_tree_enabled')) {
        const cfg = parseTreeConfig(tableData);
        const clean = nameSource.replace(/[^a-zA-Z0-9]/g, '');
        const modelSingular = toSingularPascalCase(clean);
        const resourceFolder = toPluralPascalCase(clean);
        const pageTitle = tableData.table_view_title || resourceFolder;

        const php = renderTemplate('app/Filament/Pages/TreePage.php.njk', {
            page_class: `${modelSingular}Tree`,
            blade_name: `${modelSingular.toLowerCase()}-tree`,
            model_class: modelSingular,
            page_title: `${pageTitle} Hierarchy`,
            slug: `${resourceFolder.toLowerCase()}-tree`,
            ...cfg,
        });
        const blade = renderTemplate('resources/views/filament/pages/tree.blade.php.njk', {});

        const pagesDir = path.join(basePath, 'app', 'Filament', 'Pages');
        const viewsDir = path.join(basePath, 'resources', 'views', 'filament', 'pages');
        fs.mkdirSync(pagesDir, { recursive: true });
        fs.mkdirSync(viewsDir, { recursive: true });
        fs.writeFileSync(path.join(pagesDir, `${modelSingular}Tree.php`), php);
        fs.writeFileSync(path.join(viewsDir, `${modelSingular.toLowerCase()}-tree.blade.php`), blade);
        count++;
    }
    return { success: true, message: `${count} tree pages generated.` };
}

module.exports = { generateTreePages, parseTreeConfig };
