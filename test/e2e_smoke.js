// End-to-end smoke test: generate fixture -> overlay onto Laravel skeleton ->
// migrate:fresh --seed -> boot panel classes. Proves generated code RUNS, not
// just php -l. Usage: node test/e2e_smoke.js [fixture]
//
// Requires: system php with pdo_sqlite, and resources/preview_env (vendor deps).
// Uses a throwaway copy under /tmp so the repo skeleton is never mutated.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const REPO = path.join(__dirname, '..');
const fixture = process.argv[2] || 'base_simple';
const fixturePath = path.join(REPO, 'test', 'fixtures', `${fixture}.json`);
if (!fs.existsSync(fixturePath)) {
    console.error(`Fixture not found: ${fixturePath}`);
    process.exit(1);
}

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'fsm-e2e-'));
const genDir = path.join(work, 'gen');
const appDir = path.join(work, 'app');
fs.mkdirSync(genDir, { recursive: true });

function run(cmd, opts = {}) {
    console.log(`$ ${cmd}`);
    return execSync(cmd, { encoding: 'utf8', cwd: work, ...opts });
}

(async () => {
    // 1. Generate
    const schema = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const fullSchema = {
        project: schema.project,
        database: {
            name: schema.database.name,
            table: schema.database.table || {},
            relationships: schema.database.relationships || [],
            unified_menu: schema.database.unified_menu || [],
        },
    };
    const { generateLaravelFilamentStack } = require('../src/generators/laravelFilamentStack');
    const res = await generateLaravelFilamentStack(fullSchema, genDir);
    if (!res.success) throw new Error(`generate failed: ${res.message}`);
    console.log('generated OK ->', genDir);

    // 2. Fresh skeleton copy (plain cp: hardlinks fail across filesystems)
    fs.rmSync(appDir, { recursive: true, force: true });
    run(`cp -a ${path.join(REPO, 'resources/preview_env')} ${appDir}`);
    // Fresh clones have no .env (untracked since Phase 7 secret hygiene)
    if (!fs.existsSync(path.join(appDir, '.env'))) {
        fs.copyFileSync(path.join(appDir, '.env.example'), path.join(appDir, '.env'));
        run(`php ${path.join(appDir, 'artisan')} key:generate --force -q`, { cwd: appDir });
        console.log('.env created from example + APP_KEY generated');
    }
    console.log('skeleton copied');

    // 3. Overlay generated files onto skeleton
    run(`cp -a ${genDir}/. ${appDir}/`);
    console.log('generated overlay applied');

    // 3b. Rebuild composer autoload: the bundled preview_env vendor was built on
    // Windows and its classmap contains absolute D:\ paths, which break on Linux.
    run(`php ${path.join(REPO, 'bin', 'composer.phar')} dump-autoload --no-scripts -q`, { cwd: appDir });
    console.log('composer dump-autoload done');

    // 3c. Clear Filament's cached component discovery (bootstrap/cache/filament):
    // it is baked from a previous preview run and references stale resource classes.
    fs.rmSync(path.join(appDir, 'bootstrap', 'cache', 'filament'), { recursive: true, force: true });
    console.log('filament component cache cleared');

    // 4. sqlite db file
    const dbFile = path.join(appDir, 'database', 'database.sqlite');
    if (!fs.existsSync(dbFile)) fs.writeFileSync(dbFile, '');

    // 5. migrate:fresh --seed
    try {
        const out = execSync('php artisan migrate:fresh --seed --force', {
            cwd: appDir, encoding: 'utf8', stdio: 'pipe', timeout: 240000,
        });
        console.log(out.split('\n').slice(-6).join('\n'));
    } catch (e) {
        const msg = `${e.stdout || ''}${e.stderr || ''}`;
        const fatal = msg.match(/PHP Fatal error: [^\n]+/);
        const sql = msg.match(/SQLSTATE\[[^\]]+\][^\n]*/);
        console.error('MIGRATE FAILED:');
        if (fatal) console.error(' ', fatal[0]);
        if (sql) console.error(' ', sql[0]);
        throw new Error('migrate:fresh failed');
    }

    // 6. Boot check: panel + resources discoverable via artisan
    const out = execSync('php artisan about --only=drivers 2>/dev/null || php artisan about', {
        cwd: appDir, encoding: 'utf8', timeout: 120000,
    });
    if (!out.includes('Filament') && !out.includes('sqlite')) {
        throw new Error('artisan about output unexpected');
    }
    console.log('artisan boots OK');

    // 7. Table check: generated tables exist in sqlite
    const tables = execSync(
        `php -r 'echo implode(",", (new PDO("sqlite:${dbFile}"))->query("SELECT name FROM sqlite_master WHERE type=\\"table\\"")->fetchAll(PDO::FETCH_COLUMN));'`,
        { encoding: 'utf8' }
    ).trim().split(',');
    const expected = Object.keys(fullSchema.database.table);
    const missing = expected.filter((t) => !tables.includes(t));
    if (missing.length) throw new Error(`tables missing in DB: ${missing.join(', ')}`);
    console.log(`all ${expected.length} fixture tables present in sqlite`);

    // 8. HTTP check: boot php artisan serve and hit /admin/login (expect 200)
    const port = 8899;
    const srv = require('child_process').spawn('php', ['artisan', 'serve', `--port=${port}`], {
        cwd: appDir, stdio: 'ignore', detached: true,
    });
    try {
        let code = '000';
        for (let i = 0; i < 15; i++) {
            await new Promise((r) => setTimeout(r, 2000));
            try {
                code = execSync(
                    `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:${port}/admin/login`,
                    { encoding: 'utf8', timeout: 15000 }
                );
            } catch (e) { /* server not up yet */ }
            if (code === '200') break;
        }
        if (code !== '200') {
            const log = fs.existsSync(path.join(appDir, 'storage/logs/laravel.log'))
                ? fs.readFileSync(path.join(appDir, 'storage/logs/laravel.log'), 'utf8').split('\n').pop()
                : '(no log)';
            throw new Error(`/admin/login returned HTTP ${code}. Last log: ${log.slice(0, 300)}`);
        }
        console.log('HTTP /admin/login -> 200 OK');
    } finally {
        try { process.kill(-srv.pid); } catch (e) { /* already dead */ }
    }

    console.log(`\nE2E SMOKE PASS (${fixture}) — workdir ${work}`);
})().catch((e) => {
    console.error('E2E SMOKE FAIL:', e.message);
    console.error(`workdir kept for inspection: ${work}`);
    process.exit(1);
});
