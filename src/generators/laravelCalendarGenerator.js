const fs = require('fs');
const path = require('path');
const { toSingularPascalCase, toPluralPascalCase } = require('../utils');
const { renderTemplate } = require('../render/engine');
const { collectFeatureSources } = require('./customModuleSources');

/**
 * [IR HELPER] Parse + validate grid_calendar_config. Returns null when the
 * feature is off or the config is unusable (missing/invalid start field).
 *
 * Config JSON: { start_field, end_field?, color_field?, title_field? }
 * start_field must exist on the table and be a date/datetime/timestamp type.
 */
function parseCalendarConfig(tableData) {
    if (Number(tableData.grid_calendar_enabled) !== 1) return null;
    let cfg;
    try {
        cfg = JSON.parse(tableData.grid_calendar_config || '{}');
    } catch {
        return null;
    }
    const fields = tableData.fields || {};
    const startField = String(cfg.start_field || '');
    if (!startField || !fields[startField]) return null;
    const st = String(fields[startField].data_type || '').toUpperCase();
    if (!['DATE', 'DATETIME', 'TIMESTAMP'].includes(st)) return null;

    const dateType = (f) => ['DATE', 'DATETIME', 'TIMESTAMP'].includes(String((fields[f] || {}).data_type || '').toUpperCase());
    const endField = cfg.end_field && fields[cfg.end_field] && dateType(cfg.end_field) ? String(cfg.end_field) : '';
    const colorField = cfg.color_field && fields[cfg.color_field] ? String(cfg.color_field) : '';
    const titleField = cfg.title_field && fields[cfg.title_field] ? String(cfg.title_field) : '';
    return { startField, endField, colorField, titleField };
}

/**
 * [UTAMA] Generate a standalone calendar page per table that opted in.
 * Read-only month grid (vanilla Blade + Livewire payload, no FullCalendar).
 * Custom modules with an overridden calendar config get their own page.
 */
async function generateCalendarPages(fullSchema, basePath) {
    const { database: { table: tables } } = fullSchema;
    let count = 0;
    for (const { nameSource, tableData } of collectFeatureSources(tables, parseCalendarConfig, 'grid_calendar_enabled')) {
        const cfg = parseCalendarConfig(tableData);
        const clean = nameSource.replace(/[^a-zA-Z0-9]/g, '');
        const modelSingular = toSingularPascalCase(clean);
        const resourceFolder = toPluralPascalCase(clean);
        const pageTitle = tableData.table_view_title || resourceFolder;

        const php = renderTemplate('app/Filament/Pages/CalendarPage.php.njk', {
            page_class: `${modelSingular}Calendar`,
            blade_name: `${modelSingular.toLowerCase()}-calendar`,
            model_class: modelSingular,
            resource_folder: resourceFolder,
            page_title: `${pageTitle} Calendar`,
            slug: `${resourceFolder.toLowerCase()}-calendar`,
            ...cfg,
        });
        const blade = renderTemplate('resources/views/filament/pages/calendar.blade.php.njk', {
            page_class: `${modelSingular}Calendar`,
        });

        const pagesDir = path.join(basePath, 'app', 'Filament', 'Pages');
        const viewsDir = path.join(basePath, 'resources', 'views', 'filament', 'pages');
        fs.mkdirSync(pagesDir, { recursive: true });
        fs.mkdirSync(viewsDir, { recursive: true });
        fs.writeFileSync(path.join(pagesDir, `${modelSingular}Calendar.php`), php);
        fs.writeFileSync(path.join(viewsDir, `${modelSingular.toLowerCase()}-calendar.blade.php`), blade);
        count++;
    }
    return { success: true, message: `${count} calendar pages generated.` };
}

module.exports = { generateCalendarPages, parseCalendarConfig };
