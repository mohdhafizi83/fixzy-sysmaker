// Nunjucks render engine (Phase 2).
//
// Replaces the <<PLACEHOLDER>> string-replacement machinery with real
// templates: logic lives IN the template, JS only supplies data.
//
// Conventions:
//  - Templates live under src/templates/php/filament/ with .njk extension
//    (e.g. 'app/Filament/Pages/DeploymentGuide.php.njk').
//  - autoescape OFF: output is PHP/Blade/markdown, not HTML from user input.
//    Generators are responsible for escaping identifiers at context-build
//    time (they already sanitize table/field names upstream).
//  - trimBlocks + lstripBlocks: {% %} control lines don't emit blank lines,
//    keeping generated code clean without manual newline gymnastics.

'use strict';

const path = require('path');
const nunjucks = require('nunjucks');

const utils = require('../utils');

const TEMPLATE_ROOT = path.join(__dirname, '..', 'templates', 'php', 'filament');

const env = new nunjucks.Environment(
    new nunjucks.FileSystemLoader(TEMPLATE_ROOT, { watch: false, noCache: false }),
    {
        autoescape: false,
        // trimBlocks/lstripBlocks intentionally OFF: they merge content lines
        // around inline {% endraw %}...{% raw %} boundaries (byte-level
        // corruption in mixed Blade templates) and would change whitespace in
        // migrated templates. Templates control their own whitespace instead.
        trimBlocks: false,
        lstripBlocks: false,
        throwOnUndefined: true,
    }
);

// Case-conversion helpers (same functions the generators use today).
env.addFilter('pascal', utils.toPascalCase);
env.addFilter('camel', utils.toCamelCase);
env.addFilter('plural_pascal', utils.toPluralPascalCase);
env.addFilter('plural_camel', utils.toPluralCamelCase);
env.addFilter('singular_pascal', utils.toSingularPascalCase);
env.addFilter('singular_camel', utils.toSingularCamelCase);
env.addFilter('flat', utils.toFlatCase);
env.addFilter('title', utils.toTitleCase);

// Data helpers usable from templates.
env.addFilter('migration_def', utils.getFieldDefinitionForMigration);
env.addFilter('faker_formatter', utils.getFakerFormatter);
env.addFilter('php_date_format', utils.convertDateFormatToPhp);
env.addFilter('eloquent_rules', utils.buildEloquentQueryFromRules);

// Generic filters.
env.addFilter('json', (v, indent) => JSON.stringify(v, null, indent || 0));
env.addFilter('snake', (s) => String(s || '').replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase());

/**
 * Render a template (path relative to src/templates/php/filament) with context.
 * @param {string} templateName e.g. 'app/Filament/Pages/DeploymentGuide.php.njk'
 * @param {object} context
 * @returns {string} rendered output
 */
function renderTemplate(templateName, context) {
    return env.render(templateName, context || {});
}

/** Render a template string directly (for tests / dynamic templates). */
function renderString(src, context) {
    return env.renderString(src, context || {});
}

module.exports = { env, renderTemplate, renderString, TEMPLATE_ROOT };
