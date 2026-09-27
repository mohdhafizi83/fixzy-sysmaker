// DB engine e2e harness (Fixzy SysMaker DB support Tier 1+2).
//
// Proves the generated app actually migrates + boots against engines other
// than SQLite. Uses local test servers (Docker containers created by
// test/db_engines_up.sh):
//   MySQL  -> 127.0.0.1:5434 (root/rootpass)
//   PG     -> 127.0.0.1:5433 (postgres/pgpass)
//
// Usage:
//   node test/e2e_engine.js db_mysql      # engine from fixture stack_database
//   node test/e2e_engine.js db_pgsql
//   node test/e2e_engine.js db_supabase   # pgsql engine, supabase preset
//
// Skips (exit 0, prints SKIP) when the test server is unreachable so CI
// without Docker stays green.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync, spawn } = require('child_process');

const REPO = path.resolve(__dirname, '..');
const fixtureName = process.argv[2];
if (!fixtureName) {
    console.error('usage: node test/e2e_engine.js <fixture>');
    process.exit(2);
}
const fixturePath = path.join(REPO, 'test', 'fixtures', `${fixtureName}.json`);
if (!fs.existsSync(fixturePath)) {
    console.error(`fixture not found: ${fixturePath}`);
    process.exit(2);
}

const { normalizeEngine } = require('../src/core/dbSupport');
const schema = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const engine = normalizeEngine(schema.project.stack_database);

const SERVERS = {
    mysql: { host: '127.0.0.1', port: 3306, super: 'fsmtest', pass: 'fsmpass123', lib: 'mysql2/promise' },
    pgsql: { host: '127.0.0.1', port: 5433, super: 'postgres', pass: 'pgpass', lib: 'pg' },
};

function serverReachable(srv) {
    const net = require('net');
    return new Promise((resolve) => {
        const sock = new net.Socket();
        sock.setTimeout(2500);
        sock.once('connect', () => { sock.destroy(); resolve(true); });
        sock.once('error', () => resolve(false));
        sock.once('timeout', () => { sock.destroy(); resolve(false); });
        sock.connect(srv.port, srv.host);
    });
}

async function createDb(srv, dbName) {
    if (srv.lib === 'mysql2/promise') {
        const mysql = require(srv.lib);
        const c = await mysql.createConnection({ host: srv.host, port: srv.port, user: srv.super, password: srv.pass });
        await c.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
        await c.end();
    } else {
        const { Client } = require(srv.lib);
        const c = new Client({ host: srv.host, port: srv.port, user: srv.super, password: srv.pass, database: 'postgres' });
        await c.connect();
        const ex = await c.query('SELECT 1 FROM pg_database WHERE datname=$1', [dbName]);
        if (ex.rowCount === 0) await c.query(`CREATE DATABASE "${dbName}"`);
        await c.end();
    }
}

async function listTables(srv, dbName) {
    if (srv.lib === 'mysql2/promise') {
        const mysql = require(srv.lib);
        const c = await mysql.createConnection({ host: srv.host, port: srv.port, user: srv.super, password: srv.pass, database: dbName });
        const [rows] = await c.query('SHOW TABLES');
        await c.end();
        return rows.map((r) => Object.values(r)[0]);
    }
    const { Client } = require(srv.lib);
    const c = new Client({ host: srv.host, port: srv.port, user: srv.super, password: srv.pass, database: dbName });
    await c.connect();
    const r = await c.query("SELECT tablename FROM pg_tables WHERE schemaname='public'");
    await c.end();
    return r.rows.map((x) => x.tablename);
}

(async () => {
    if (engine === 'sqlite') {
        console.log('SKIP: sqlite engine — covered by test/e2e_smoke.js');
        return;
    }
    const srv = SERVERS[engine];
    if (!(await serverReachable(srv))) {
        console.log(`SKIP: ${engine} test server at ${srv.host}:${srv.port} unreachable (run test/db_engines_up.sh)`);
        return;
    }

    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'fsm-e2e-eng-'));
    const genDir = path.join(work, 'gen');
    const appDir = path.join(work, 'app');
    fs.mkdirSync(genDir, { recursive: true });
    const dbName = `e2e_${fixtureName.replace(/[^a-z0-9]/gi, '_')}`;

    // 1. Generate
    const fullSchema = {
        project: schema.project,
        database: {
            name: schema.database.name,
            table: schema.database.table || {},
            relationships: schema.database.relationships || [],
            unified_menu: schema.database.unified_menu || [],
            widgets: schema.database.widgets || [],
        },
    };
    const { generateLaravelFilamentStack } = require('../src/generators/laravelFilamentStack');
    const res = await generateLaravelFilamentStack(fullSchema, genDir);
    if (!res.success) throw new Error(`generate failed: ${res.message}`);
    console.log('generated OK');

    // 2. Skeleton + overlay (same recipe as e2e_smoke)
    execSync(`cp -a ${path.join(REPO, 'resources/preview_env')} ${appDir}`);
    if (!fs.existsSync(path.join(appDir, '.env'))) {
        fs.copyFileSync(path.join(appDir, '.env.example'), path.join(appDir, '.env'));
    }
    execSync(`cp -a ${genDir}/. ${appDir}/`);
    const manifestFile = path.join(genDir, 'fixzy-manifest.json');
    if (fs.existsSync(manifestFile)) {
        const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
        const providersFile = path.join(appDir, 'bootstrap', 'providers.php');
        if (Array.isArray(manifest.providers) && manifest.providers.length && fs.existsSync(providersFile)) {
            let contents = fs.readFileSync(providersFile, 'utf8');
            for (const prov of manifest.providers) {
                const short = prov.split('\\').pop();
                if (!contents.includes(short)) {
                    contents = contents.replace(/return\s*\[/, `return [\n    ${prov}::class,`);
                }
            }
            fs.writeFileSync(providersFile, contents);
        }
    }
    execSync(`php ${path.join(REPO, 'bin', 'composer.phar')} dump-autoload --no-scripts -q`, { cwd: appDir });
    fs.rmSync(path.join(appDir, 'bootstrap', 'cache', 'filament'), { recursive: true, force: true });

    // 3. Point .env at the test server (engine-aware, via dbSupport)
    const { envLines } = require('../src/core/dbSupport');
    let env = fs.readFileSync(path.join(appDir, '.env'), 'utf8');
    const setEnv = (k, v) => {
        const re = new RegExp(`^${k}=.*$`, 'm');
        if (re.test(env)) env = env.replace(re, `${k}=${v}`); else env += `\n${k}=${v}`;
    };
    for (const line of envLines(schema.project.stack_database, {
        dbName, user: srv.super, password: srv.pass, host: srv.host, port: String(srv.port),
    })) {
        if (line.startsWith('#')) continue;
        const [k, ...rest] = line.split('=');
        setEnv(k, rest.join('='));
    }
    fs.writeFileSync(path.join(appDir, '.env'), env);
    execSync(`php ${path.join(appDir, 'artisan')} key:generate --force -q`, { cwd: appDir });
    console.log(`.env -> ${engine} @ ${srv.host}:${srv.port} db=${dbName}`);

    // 4. Create DB + migrate:fresh --seed
    await createDb(srv, dbName);
    console.log('database created');
    try {
        execSync('php artisan migrate:fresh --seed --force', { cwd: appDir, stdio: 'pipe', timeout: 300000 });
        console.log('migrate:fresh --seed OK');
    } catch (e) {
        const msg = `${e.stdout || ''}${e.stderr || ''}`;
        const sql = msg.match(/SQLSTATE\[[^\]]+\][^\n]*/);
        console.error('MIGRATE FAILED:', sql ? sql[0] : msg.slice(-500));
        throw new Error('migrate failed on ' + engine);
    }

    // 5. Table presence check
    const tables = await listTables(srv, dbName);
    const expected = Object.keys(fullSchema.database.table);
    const missing = expected.filter((t) => !tables.includes(t));
    if (missing.length) throw new Error(`tables missing in ${engine}: ${missing.join(', ')}`);
    console.log(`all ${expected.length} fixture tables present in ${engine}`);

    // 6. HTTP boot check
    const port = 8901;
    const srvProc = spawn('php', ['artisan', 'serve', `--port=${port}`], { cwd: appDir, stdio: 'ignore', detached: true });
    try {
        let code = '000';
        for (let i = 0; i < 15; i++) {
            await new Promise((r) => setTimeout(r, 2000));
            try {
                code = execSync(`curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:${port}/admin/login`, { encoding: 'utf8', timeout: 15000 });
            } catch (e) { /* not up yet */ }
            if (code === '200') break;
        }
        if (code !== '200') throw new Error(`/admin/login returned HTTP ${code} on ${engine}`);
        console.log('HTTP /admin/login -> 200 OK');
    } finally {
        try { process.kill(-srvProc.pid); } catch (e) { /* dead */ }
    }

    console.log(`\nE2E ENGINE PASS (${fixtureName} -> ${engine})`);
    fs.rmSync(work, { recursive: true, force: true });
})().catch((e) => {
    console.error('E2E ENGINE FAIL:', e.message);
    process.exit(1);
});
