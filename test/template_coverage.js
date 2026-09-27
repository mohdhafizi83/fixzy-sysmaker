// Template coverage probe: which .njk templates are actually rendered across
// all golden fixtures? Run: node test/template_coverage.js
//
// Instruments render/engine.js BEFORE the generators are required, so the
// generators' destructured `renderTemplate` binding picks up the wrapper.

'use strict';

const fs = require('fs');
const path = require('path');

const engine = require('../src/render/engine');
const rendered = new Set();
const origRender = engine.renderTemplate;
engine.renderTemplate = function (name, ctx) {
    rendered.add(name);
    return origRender.call(engine, name, ctx);
};

const TPL_ROOT = path.join(__dirname, '..', 'src', 'templates', 'php', 'filament');
function listTemplates(dir, base = dir, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) listTemplates(full, base, out);
        else if (e.name.endsWith('.njk')) out.push(path.relative(base, full).split(path.sep).join('/'));
    }
    return out.sort();
}

const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const fixtures = fs.readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.json')).sort();

// Patched engine must be in require cache before generators load.
const { generateLaravelFilamentStack } = require('../src/generators/laravelFilamentStack');
const { asLegacyFullSchema } = require('../src/ir/adapter');

function loadFullSchema(schema) {
    // IR-shaped fixtures ({ ir_version, _source }) must go through the IR
    // adapter, same as the app's import path.
    if (schema && schema.ir_version) return asLegacyFullSchema(schema);
    return {
        project: schema.project,
        database: {
            name: schema.database.name,
            table: (schema.database && schema.database.table) || {},
            relationships: (schema.database && schema.database.relationships) || [],
            unified_menu: (schema.database && schema.database.unified_menu) || [],
            widgets: (schema.database && schema.database.widgets) || [],
        },
    };
}

(async () => {
    const perFixture = {};
    for (const fx of fixtures) {
        const schema = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, fx), 'utf8'));
        const before = new Set(rendered);
        const outDir = path.join(__dirname, 'cov_tmp', fx.replace(/\.json$/, ''));
        fs.rmSync(outDir, { recursive: true, force: true });
        fs.mkdirSync(outDir, { recursive: true });
        try {
            const res = await generateLaravelFilamentStack(loadFullSchema(schema), outDir);
            if (!res || !res.success) throw new Error(res && res.message);
        } catch (e) {
            console.error(`[FAIL] ${fx}: ${e.message}`);
            process.exitCode = 1;
            continue;
        }
        perFixture[fx] = [...rendered].filter((t) => !before.has(t));
    }

    const templates = listTemplates(TPL_ROOT);
    const covered = new Set();
    for (const list of Object.values(perFixture)) for (const t of list) covered.add(t);

    console.log('\n=== TEMPLATE COVERAGE ===');
    console.log(`templates: ${templates.length} | covered: ${covered.size} | uncovered: ${templates.length - covered.size}\n`);
    for (const t of templates) {
        const fx = Object.entries(perFixture).filter(([, l]) => l.includes(t)).map(([f]) => f);
        console.log(`${covered.has(t) ? '[COVERED]  ' : '[UNCOVERED]'} ${t}${fx.length ? `  (${fx.length} fixtures)` : ''}`);
    }
    fs.rmSync(path.join(__dirname, 'cov_tmp'), { recursive: true, force: true });
})();
