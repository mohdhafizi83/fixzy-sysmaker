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

    // Approvals module: run against the approval_multistep fixture.
    const apSchemaRaw = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'approval_multistep.json'), 'utf8'));
    const apSchema = {
        project: apSchemaRaw.project,
        database: {
            table: apSchemaRaw.database.table || {},
            relationships: apSchemaRaw.database.relationships || {},
        },
    };
    const apOut = path.join(outDir, '_approvals_on');
    await tryGen('generateApprovalModule (on)', () =>
        require('../src/generators/laravelApprovalGenerator').generateApprovalModule(apSchema, apOut));
    await tryGen('generateFilamentModels (approvals)', () =>
        require('../src/generators/laravelDatabaseGenerator').generateFilamentModels(apSchema, apOut));
    await tryGen('generateFilamentTablesTable (approvals)', () =>
        require('../src/generators/laravelTablesGenerator').generateFilamentTablesTable(apSchema, apOut));
    // Guard: fixture with approvals OFF must emit no approval files.
    const apOffRaw = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'approval_off.json'), 'utf8'));
    const apOffSchema = {
        project: apOffRaw.project,
        database: { table: apOffRaw.database.table || {}, relationships: apOffRaw.database.relationships || {} },
    };
    const apOffOut = path.join(outDir, '_approvals_off');
    await tryGen('generateApprovalModule (off)', () =>
        require('../src/generators/laravelApprovalGenerator').generateApprovalModule(apOffSchema, apOffOut));
    const apOffFiles = fs.existsSync(apOffOut) ? fs.readdirSync(apOffOut) : [];
    if (apOffFiles.length > 0) {
        results.push(['approvals off-guard', 'FAIL', 'files emitted with approvals off']);
        console.log('FAIL approvals off-guard: files emitted with approvals off');
    } else {
        results.push(['approvals off-guard', 'OK', 0]);
        console.log('OK   approvals off-guard (no files emitted)');
    }

    // Scheduler module: run against the scheduler_reminder fixture.
    const schSchemaRaw = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'scheduler_reminder.json'), 'utf8'));
    const schSchema = {
        project: schSchemaRaw.project,
        database: { table: schSchemaRaw.database.table || {}, relationships: schSchemaRaw.database.relationships || {} },
    };
    const schOut = path.join(outDir, '_scheduler_on');
    await tryGen('generateSchedulerModule (on)', () =>
        require('../src/generators/laravelSchedulerGenerator').generateSchedulerModule(schSchema, schOut));
    const schCmd = path.join(schOut, 'app', 'Console', 'Commands', 'ScheduleRunnerCommand.php');
    if (fs.existsSync(schCmd)) {
        const cmdBody = fs.readFileSync(schCmd, 'utf8');
        if (cmdBody.includes("'field' => 'due_date'") && cmdBody.includes("'offset_days' => 3")) {
            results.push(['scheduler compiled-entry check', 'OK', 1]);
            console.log('OK   scheduler compiled-entry check (due_date/3 compiled in)');
        } else {
            results.push(['scheduler compiled-entry check', 'FAIL', 'reminder entry missing from command']);
            console.log('FAIL scheduler compiled-entry check');
        }
    } else {
        results.push(['scheduler compiled-entry check', 'FAIL', 'command not emitted']);
        console.log('FAIL scheduler command not emitted');
    }
    // Guard: module OFF must emit no scheduler files even with rules present.
    const schOffRaw = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'scheduler_off.json'), 'utf8'));
    const schOffSchema = {
        project: schOffRaw.project,
        database: { table: schOffRaw.database.table || {}, relationships: schOffRaw.database.relationships || {} },
    };
    const schOffOut = path.join(outDir, '_scheduler_off');
    await tryGen('generateSchedulerModule (off)', () =>
        require('../src/generators/laravelSchedulerGenerator').generateSchedulerModule(schOffSchema, schOffOut));
    const schOffFiles = fs.existsSync(schOffOut) ? fs.readdirSync(schOffOut) : [];
    if (schOffFiles.length > 0) {
        results.push(['scheduler off-guard', 'FAIL', 'files emitted with scheduler off']);
        console.log('FAIL scheduler off-guard: files emitted with scheduler off');
    } else {
        results.push(['scheduler off-guard', 'OK', 0]);
        console.log('OK   scheduler off-guard (no files emitted)');
    }

    // Backup config: project-level backup_config compiles into BACKUPS.
    const bkRaw = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'scheduler_backup.json'), 'utf8'));
    const bkSchema = {
        project: bkRaw.project,
        database: { table: bkRaw.database.table || {}, relationships: bkRaw.database.relationships || {} },
    };
    const bkEntries = require('../src/generators/schedulerConfig').collectSchedules(bkSchema);
    const bk = bkEntries.find((e) => e.kind === 'backup');
    if (bk && bk.frequency === 'weekly' && bk.weekday === 3 && bk.retention === 5) {
        results.push(['backup config parse', 'OK', 'weekly/3/5']);
        console.log('OK   backup config parse (weekly weekday=3 retention=5)');
    } else {
        results.push(['backup config parse', 'FAIL', JSON.stringify(bk)]);
        console.log('FAIL backup config parse');
    }
    const bkOut = path.join(outDir, '_backup_on');
    await tryGen('generateSchedulerModule (backup only)', () =>
        require('../src/generators/laravelSchedulerGenerator').generateSchedulerModule(bkSchema, bkOut));
    const bkCmd = path.join(bkOut, 'app', 'Console', 'Commands', 'ScheduleRunnerCommand.php');
    if (fs.existsSync(bkCmd)) {
        const body = fs.readFileSync(bkCmd, 'utf8');
        const m = body.match(/public const BACKUPS = \[\n(\s*\[.*\],)\n\s*\];/);
        if (m && m[1].includes("'retention' => 5") && !m[1].includes("'retention' => '5'")) {
            results.push(['backup compiled-entry check', 'OK', 1]);
            console.log('OK   backup compiled-entry check (retention int compiled)');
        } else {
            results.push(['backup compiled-entry check', 'FAIL', m ? m[1] : 'no BACKUPS entry']);
            console.log('FAIL backup compiled-entry check');
        }
    } else {
        results.push(['backup compiled-entry check', 'FAIL', 'command not emitted']);
        console.log('FAIL backup command not emitted for backup-only project');
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
