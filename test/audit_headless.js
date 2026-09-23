// Headless audit: run Fixzy SysMaker generators against the fixture schema
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
    await tryGen('generateGoogleSheetsModule (off)', () =>
        require('../src/generators/laravelGoogleSheetsGenerator').generateGoogleSheetsModule(fullSchema, outDir));

    // Google Sheets ON: enable module + opt in two custom tables (one must
    // be rejected logic-wise if feature-generated; fixture has none).
    const gsSchema = JSON.parse(JSON.stringify(fullSchema));
    gsSchema.project.module_google_sheets = 1;
    const gsTables = Object.keys(gsSchema.database.table).filter((t) => t !== 'users');
    if (gsTables[0]) gsSchema.database.table[gsTables[0]].google_sync_enabled = 1;
    if (gsTables[1]) gsSchema.database.table[gsTables[1]].google_sync_enabled = 1;
    const gsOut = path.join(outDir, '_gsheets_on');
    await tryGen('generateGoogleSheetsModule (on)', () =>
        require('../src/generators/laravelGoogleSheetsGenerator').generateGoogleSheetsModule(gsSchema, gsOut));
    // Sabotage: users table must never be picked up even if flag set.
    const sabSchema = JSON.parse(JSON.stringify(gsSchema));
    sabSchema.database.table['users'].google_sync_enabled = 1;
    const picked = require('../src/generators/laravelGoogleSheetsGenerator').collectSyncedTables(sabSchema)
        .map((s) => s.tableName);
    if (picked.includes('users')) {
        results.push(['gsheets users-guard', 'FAIL', 'users table was collected for sync']);
        console.log('FAIL gsheets users-guard: users table was collected');
    } else {
        results.push(['gsheets users-guard', 'OK', picked.length]);
        console.log(`OK   gsheets users-guard (synced: ${picked.join(', ')})`);
    }

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
