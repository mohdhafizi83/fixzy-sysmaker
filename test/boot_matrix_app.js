// Boots the form-matrix generated app into /tmp/fsm-matrix-app for browser testing.
// Usage: node test/boot_matrix_app.js
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = path.join(__dirname, '..');
const appDir = '/tmp/fsm-matrix-app';

function run(cmd, opts = {}) {
    console.log('$ ' + cmd);
    return execSync(cmd, { encoding: 'utf8', cwd: opts.cwd || REPO, ...opts });
}

fs.rmSync(appDir, { recursive: true, force: true });

(async () => {
    const schema = JSON.parse(fs.readFileSync(path.join(REPO, 'test', 'fixtures', 'form_matrix.json'), 'utf8'));
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
    const genDir = '/tmp/fsm-matrix-gen';
    fs.rmSync(genDir, { recursive: true, force: true });
    fs.mkdirSync(genDir, { recursive: true });
    const { generateLaravelFilamentStack } = require('../src/generators/laravelFilamentStack');
    const res = await generateLaravelFilamentStack(fullSchema, genDir);
    if (!res.success) throw new Error('generate failed: ' + res.message);
    console.log('generated OK');

    run(`cp -a ${path.join(REPO, 'resources/preview_env')} ${appDir}`);
    run(`cp -a ${genDir}/. ${appDir}/`);
    // preview_env ships a stale Filament panel-discovery cache from the last
    // app that was built in it — must be cleared or it references resources
    // that don't exist in THIS app (fatal class-not-found at boot).
    fs.rmSync(path.join(appDir, 'bootstrap', 'cache', 'filament'), { recursive: true, force: true });
    run(`rm -f ${appDir}/bootstrap/cache/*.php`);

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
                }
            }
            fs.writeFileSync(providersFile, contents);
        }
    }
    run(`php ${path.join(REPO, 'bin', 'composer.phar')} dump-autoload --no-scripts -q`, { cwd: appDir });
    run('php artisan migrate:fresh --seed --force', { cwd: appDir });
    run('php artisan storage:link', { cwd: appDir });
    console.log('matrix app ready at ' + appDir);
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
