const fs = require('fs');
const path = require('path');
const {
    toSingularPascalCase,
    toPluralPascalCase,
    toPluralCamelCase,
} = require('../utils');
const { renderTemplate } = require('../render/engine');

// Layout override resolution (2026-09-26).
// Precedence: per-relation override > global child default > child table's own setting.
// '' / 0 = inherit. With no overrides anywhere the generated RelationManager
// is byte-identical to the pre-feature output (golden-safe).
const TV_TEMPLATES = ['horizontal', 'vertical_1', 'vertical_2', 'left_image', 'right_image', 'card'];
// 'conversational' is deliberately excluded: it needs per-table chat copy.
const REL_FORM_STYLES = ['default', 'grouped', 'accordion', 'inline', 'survey', 'checkout', 'modal'];

/**
 * [HELPER] Resolve the effective layout for one parent-child relation.
 * Returns { tv_template, card_columns, form_style } where each value is
 * either an explicit override or null (= inherit the child's own layout).
 */
function resolveRelationLayout(rel, childTableData, globalChildDefaults) {
    const g = globalChildDefaults || {};

    let tv = String(rel.tv_template || '').trim() || String(g.tv_template || '').trim();
    if (!TV_TEMPLATES.includes(tv)) tv = '';
    const ownTv = String((childTableData && childTableData.tv_template) || 'horizontal');
    const tvOverride = tv && tv !== ownTv ? tv : null;

    let cardCols = parseInt(rel.card_columns, 10);
    if (!Number.isInteger(cardCols) || cardCols <= 0) cardCols = parseInt(g.card_columns, 10);
    if (!Number.isInteger(cardCols) || cardCols <= 0) cardCols = 0;
    const ownCardCols = parseInt((childTableData && childTableData.card_columns), 10);
    const cardColsOverride = (cardCols > 0 && cardCols !== ownCardCols) ? Math.min(6, cardCols) : 0;

    let style = String(rel.form_style || '').trim() || String(g.form_style || '').trim();
    // Wizard-in-modal UX is poor: an explicit wizard override degrades to grouped.
    if (style === 'wizard') style = 'grouped';
    if (!REL_FORM_STYLES.includes(style)) style = '';
    let ownStyle = 'default';
    try {
        const cfg = JSON.parse((childTableData && childTableData.form_layout_config) || '');
        if (cfg && typeof cfg === 'object' && cfg.style) ownStyle = String(cfg.style);
    } catch (e) { /* no config = default */ }
    const styleOverride = style && style !== ownStyle ? style : null;

    return { tv_template: tvOverride, card_columns: cardColsOverride, form_style: styleOverride };
}

/**
 * [HELPER] Menjana satu fail Relation Manager.
 */
function generateSingleRelationManager(rel, basePath, fullSchema) {
    const { database: { table: tables } } = fullSchema;

    // Original logic: skip if 'one-to-one' or involves 'users'
    if (rel.relationship_type === 'one-to-one' || rel.parent_table_name === 'users' || rel.child_table_name === 'users') {
        return;
    }

    // --- 1. DAPATKAN MODULE NAME UNTUK PARENT & CHILD ---
    const parentTableData = tables[rel.parent_table_name];
    const childTableData = tables[rel.child_table_name];

    const parentNameSource = (parentTableData && parentTableData.module_name && parentTableData.module_name.trim() !== '')
                            ? parentTableData.module_name
                            : rel.parent_table_name;

    const childNameSource = (childTableData && childTableData.module_name && childTableData.module_name.trim() !== '')
                            ? childTableData.module_name
                            : rel.child_table_name;

    // Sediakan variasi nama (Berasaskan MODULE NAME)
    const parentTablePlural = toPluralPascalCase(parentNameSource);
    const childTablePlural = toPluralPascalCase(childNameSource);
    const childTableSingular = toSingularPascalCase(childNameSource);

    // --- 2. TENTUKAN NAMA FUNGSI HUBUNGAN (RELATIONSHIP NAME) ---
    // If self-referencing (Parent -> Children), use 'children'
    const relationshipName = rel.parent_table_name === rel.child_table_name
        ? 'children'
        : toPluralCamelCase(childNameSource);

    // --- 2b. LAYOUT OVERRIDE RESOLUTION (2026-09-26) ---
    // The RM table() hook runs AFTER the related Resource's configureTable(),
    // so emitting ->columns()/->contentGrid() here overrides the child's own
    // table layout for this relation only.
    const layout = resolveRelationLayout(rel, childTableData, fullSchema.project && fullSchema.project.fixzy_global_child_layout);
    let tableOverrideLines = '';
    let layoutImports = [];
    let formOverride = false;
    let formSchemaCode = '';

    if (childTableData && (layout.tv_template || layout.form_style)) {
        const projectSettings = fullSchema.project || {};
        const relationships = (fullSchema.database && fullSchema.database.relationships) || [];

        if (layout.tv_template) {
            const { generateTableColumnsParts, buildColumnsLayout } = require('./laravelTablesGenerator');
            const childModelSingular = toSingularPascalCase(childNameSource);
            const parts = generateTableColumnsParts(childTableData, relationships, rel.child_table_name, projectSettings, childModelSingular);
            const tvLayout = buildColumnsLayout(layout.tv_template, parts);
            const colsCode = tvLayout.usesLayout
                ? tvLayout.code
                : parts.all.join(',\n                ');
            if (colsCode) {
                tableOverrideLines = `\n            ->columns([\n                ${colsCode}\n            ])`;
                layoutImports = tvLayout.layoutImports || [];
            }
            // Card grid effect needs contentGrid (same rule as the main Table generator).
            if (layout.tv_template === 'card') {
                const xl = Math.min(6, Math.max(1, layout.card_columns || 3));
                const md = Math.min(2, Math.max(1, parseInt(childTableData.card_columns_tablet, 10) || 2));
                tableOverrideLines += `\n            ->contentGrid(['md' => ${md}, 'xl' => ${xl}])`;
            }
        }

        if (layout.form_style) {
            const { generateFormSchemaString } = require('./laravelSchemasGenerator');
            // Clone the child tableData with the overridden form config so the
            // shared IR helper renders the alternative layout. Preserve the
            // child's own groups/ungrouped_title; if the child has no config
            // but its fields carry form_group values, synthesise groups from
            // them so grouped/accordion styles don't drop those fields.
            let childCfg = null;
            try {
                const parsed = JSON.parse((childTableData.form_layout_config || '').trim() || 'null');
                if (parsed && typeof parsed === 'object') childCfg = parsed;
            } catch (e) { childCfg = null; }
            const overriddenCfg = Object.assign({}, childCfg || {}, { style: layout.form_style });
            if (!Array.isArray(overriddenCfg.groups) || overriddenCfg.groups.length === 0) {
                const groupKeys = [];
                Object.values(childTableData.fields || {}).forEach((f) => {
                    const g = String(f.form_group || '');
                    if (g && !groupKeys.includes(g)) groupKeys.push(g);
                });
                if (groupKeys.length > 0) {
                    overriddenCfg.groups = groupKeys.map((k) => ({
                        key: k,
                        title: k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
                    }));
                }
            }
            const overridden = Object.assign({}, childTableData, {
                form_layout_config: JSON.stringify(overriddenCfg)
            });
            const overriddenCode = generateFormSchemaString(overridden, relationships, rel.child_table_name, fullSchema);
            const ownCode = generateFormSchemaString(childTableData, relationships, rel.child_table_name, fullSchema);
            // Only emit an override when it actually differs from the child's
            // own form (a style change with no groups configured renders the
            // same plain list — emitting it would be dead code).
            if (overriddenCode && overriddenCode.trim() !== '' && overriddenCode !== ownCode) {
                formOverride = true;
                // Re-indent the shared form schema block to sit inside the
                // RM's components([...]) literal (12 spaces base indent).
                formSchemaCode = overriddenCode.split('\n').map((l) => (l.trim() === '' ? l : '            ' + l)).join('\n');
            }
        }
    }

    // --- 3. RENDER TEMPLATE (context object; template owns layout) ---
    const managerContent = renderTemplate('app/Filament/Resources/RelationManagers.php.njk', {
        parent_plural: parentTablePlural,
        child_plural: childTablePlural,
        child_singular: childTableSingular,
        relationship_name: relationshipName,
        table_override_lines: tableOverrideLines,
        layout_imports: layoutImports.map((i) => `use ${i};`).join('\n'),
        form_override: formOverride,
        form_schema: formSchemaCode,
    });

    // --- 4. SIMPAN FAIL ---
    const outputFolderPath = path.join(basePath, 'app', 'Filament', 'Resources', parentTablePlural, 'RelationManagers');
    fs.mkdirSync(outputFolderPath, { recursive: true });

    const outputFilePath = path.join(outputFolderPath, `${childTableSingular}RelationManager.php`);
    fs.writeFileSync(outputFilePath, managerContent);
    console.log(`Relation Manager generated: ${outputFilePath}`);
}

/**
 * [MAIN] Generates all standard Relation Managers.
 */
async function generateFilamentRelationManagers(fullSchema, basePath) {
    try {
        const { database: { relationships } } = fullSchema;

        // Loop through every existing relationship
        for (const rel of relationships) {
            generateSingleRelationManager(rel, basePath, fullSchema);
        }

        return { success: true, message: 'Filament Relation Managers generated successfully.' };

    } catch (error) {
        console.error('Failed to generate Filament Relation Managers:', error);
        return { success: false, message: error.message };
    }
}

module.exports = {
    generateFilamentRelationManagers,
    generateSingleRelationManager,
    resolveRelationLayout
};
