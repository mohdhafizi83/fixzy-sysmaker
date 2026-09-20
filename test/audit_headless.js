// Headless audit: run FiziSysMaker generators against the fixture schema
const fs = require('fs');
const path = require('path');

const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'debug_schema_output.json'), 'utf8'));
// Generators expect: { project, database: { table: {name: {...}}, relationships } }
const fullSchema = {
    project: schema.project,
    database: {
        table: schema.database.table || {},
        relationships: schema.database.relationships || {},
    },
};
console.log('Tables in fixture:', Object.keys(fullSchema.database.table).join(', '));

const results = [];
async function tryGen(name, fn) {
    try {
        const out = await fn();
        const size = typeof out === 'string' ? out.length : (out ? JSON.stringify(out).length : 0);
        results.push([name, 'OK', size]);
        console.log(`OK   ${name} (${size})`);
    } catch (e) {
        results.push([name, 'FAIL', String(e.message).slice(0, 120)]);
        console.log(`FAIL ${name}: ${String(e.message).slice(0, 120)}`);
    }
}

(async () => {
    const outDir = path.join(__dirname, 'audit_output');
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });

    await tryGen('generateAdminPanelProvider', () =>
        require('../src/generators/laravelAdminPanelGenerator').generateAdminPanelProvider(fullSchema, outDir));
    await tryGen('generateFilamentModels', () =>
        require('../src/generators/laravelDatabaseGenerator').generateFilamentModels(fullSchema, outDir));
    await tryGen('generateLaravelMigrations', () =>
        require('../src/generators/laravelDatabaseGenerator').generateLaravelMigrations(fullSchema, outDir));
    await tryGen('generateFilamentResources', () =>
        require('../src/generators/laravelResourceGenerator').generateFilamentResources(fullSchema, outDir));
    await tryGen('generateFilamentTablesTable', () =>
        require('../src/generators/laravelTablesGenerator').generateFilamentTablesTable(fullSchema, outDir));
    await tryGen('generateFilamentSchemasForm', () =>
        require('../src/generators/laravelSchemasGenerator').generateFilamentSchemasForm(fullSchema, outDir));

    // Count files produced
    let count = 0;
    (function walk(d) {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            if (e.isDirectory()) walk(path.join(d, e.name)); else count++;
        }
    })(outDir);
    console.log(`\nFiles generated: ${count}`);
    const ok = results.filter(r => r[1] === 'OK').length;
    console.log(`${ok}/${results.length} generators completed without throwing`);
    for (const [n, s, d] of results) if (s === 'FAIL') console.log(`  FAIL ${n}: ${d}`);
})();
