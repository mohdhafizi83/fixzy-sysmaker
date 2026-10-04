// Fasa 20 — boot the DEEP-AUDIT-001 generated app for runtime-semantics tests.
//
// Reads the schema built by deep_audit_build.js (deep_audit_schema.json in the
// FSM_DATA_DIR), generates the Laravel+Filament stack, overlays it on the
// preview_env skeleton, migrates + seeds, links storage, and (with --serve)
// leaves `php artisan serve` running on APP_PORT (default 8911).
//
// Usage: FSM_DATA_DIR=/tmp/fsm-deep-store node test/deep_audit_boot.js [--serve]
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

const REPO = path.join(__dirname, '..');
const DATA = process.env.FSM_DATA_DIR || '/tmp/fsm-deep-store';
const work = '/tmp/fsm-deep-build';
const genDir = path.join(work, 'gen');
const appDir = '/tmp/fsm-deep-app';
const PORT = process.env.APP_PORT || '8911';

function run(cmd, opts = {}) {
    console.log('$ ' + cmd);
    return execSync(cmd, { encoding: 'utf8', cwd: work, ...opts });
}

(async () => {
    const schemaPath = path.join(DATA, 'deep_audit_schema.json');
    if (!fs.existsSync(schemaPath)) throw new Error('schema not built — run deep_audit_build.js first: ' + schemaPath);
    const fullSchema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

    fs.rmSync(work, { recursive: true, force: true });
    fs.rmSync(appDir, { recursive: true, force: true });
    fs.mkdirSync(genDir, { recursive: true });

    const { generateLaravelFilamentStack } = require('../src/generators/laravelFilamentStack');
    const res = await generateLaravelFilamentStack(fullSchema, genDir);
    if (!res.success) throw new Error('generate failed: ' + res.message);
    console.log('generated OK');

    run(`cp -a ${path.join(REPO, 'resources/preview_env')} ${appDir}`);
    run(`cp -a ${genDir}/. ${appDir}/`);

    // Register feature providers from the manifest (mirror e2e_smoke).
    const manifestPath = path.join(genDir, 'fixzy-manifest.json');
    if (fs.existsSync(manifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        const providersFile = path.join(appDir, 'bootstrap', 'providers.php');
        if (Array.isArray(manifest.providers) && manifest.providers.length && fs.existsSync(providersFile)) {
            let contents = fs.readFileSync(providersFile, 'utf8');
            for (const prov of manifest.providers) {
                const shortName = prov.split('\\').pop();
                if (!contents.includes(shortName)) {
                    contents = contents.replace(/return\s*\[/, `return [\n    ${prov}::class,`);
                    console.log('registered provider:', prov);
                }
            }
            fs.writeFileSync(providersFile, contents);
        }
    }
    run(`php ${path.join(REPO, 'bin', 'composer.phar')} dump-autoload --no-scripts -q`, { cwd: appDir });
    fs.rmSync(path.join(appDir, 'bootstrap', 'cache', 'filament'), { recursive: true, force: true });

    // .env: fresh key, sqlite, log mail driver (hard evidence for later phases).
    const envFile = path.join(appDir, '.env');
    if (!fs.existsSync(envFile)) fs.copyFileSync(path.join(appDir, '.env.example'), envFile);
    let env = fs.readFileSync(envFile, 'utf8');
    const setEnv = (k, v) => {
        if (new RegExp('^' + k + '=.*$', 'm').test(env)) env = env.replace(new RegExp('^' + k + '=.*$', 'm'), k + '=' + v);
        else env += '\n' + k + '=' + v + '\n';
    };
    setEnv('DB_CONNECTION', 'sqlite');
    setEnv('MAIL_MAILER', 'log');
    setEnv('APP_DEBUG', 'true'); // validation-error inspection; tests assert on responses, not traces
    fs.writeFileSync(envFile, env);
    run(`php ${path.join(appDir, 'artisan')} key:generate --force -q`, { cwd: appDir });

    fs.writeFileSync(path.join(appDir, 'database', 'database.sqlite'), '');
    run('php artisan migrate:fresh --seed --force', { cwd: appDir, timeout: 300000 });
    run('php artisan storage:link', { cwd: appDir });
    console.log('app ready at', appDir);

    if (process.argv.includes('--serve')) {
        const srv = spawn('php', ['artisan', 'serve', '--port=' + PORT], { cwd: appDir, stdio: 'ignore', detached: true });
        fs.writeFileSync(path.join(work, 'serve.pid'), String(srv.pid));
        let code = '000';
        for (let i = 0; i < 20; i++) {
            await new Promise((r) => setTimeout(r, 1500));
            try {
                code = execSync(`curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:${PORT}/admin/login`, { encoding: 'utf8', timeout: 15000 });
            } catch (e) { /* not up yet */ }
            if (code === '200') break;
        }
        if (code !== '200') throw new Error('serve did not come up (HTTP ' + code + ')');
        console.log('SERVING http://127.0.0.1:' + PORT + ' (pid ' + srv.pid + ')');
    }
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
