// Builds the showcase generated app into a PERSISTENT dir for screenshots.
// Usage: node test/boot_showcase_app.js   -> /tmp/fsm-showcase-app (served separately)
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = path.join(__dirname, '..');
const work = '/tmp/fsm-showcase-build';
const genDir = path.join(work, 'gen');
const appDir = '/tmp/fsm-showcase-app';

function run(cmd, opts = {}) {
  console.log('$ ' + cmd);
  return execSync(cmd, { encoding: 'utf8', cwd: work, ...opts });
}

fs.rmSync(work, { recursive: true, force: true });
fs.rmSync(appDir, { recursive: true, force: true });
fs.mkdirSync(genDir, { recursive: true });

(async () => {
  const schema = JSON.parse(fs.readFileSync(path.join(REPO, 'test', 'fixtures', 'showcase_demo.json'), 'utf8'));
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
  if (!res.success) throw new Error('generate failed: ' + res.message);
  console.log('generated OK');

  run(`cp -a ${path.join(REPO, 'resources/preview_env')} ${appDir}`);
  run(`cp -a ${genDir}/. ${appDir}/`);

  // Register feature providers from the manifest (mirror e2e_smoke: insert after `return [`)
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
  // Screenshots should look production-clean: no debugbar, no debug traces.
  const envFile = path.join(appDir, '.env');
  if (fs.existsSync(envFile)) {
    let env = fs.readFileSync(envFile, 'utf8');
    env = env.replace(/^APP_DEBUG=.*/m, 'APP_DEBUG=false');
    env = env.replace(/^DEBUGBAR_ENABLED=.*/m, 'DEBUGBAR_ENABLED=false');
    if (!/^DEBUGBAR_ENABLED=/m.test(env)) env += '\nDEBUGBAR_ENABLED=false\n';
    fs.writeFileSync(envFile, env);
    console.log('APP_DEBUG=false for clean screenshots');
  }
  fs.rmSync(path.join(appDir, 'bootstrap', 'cache', 'filament'), { recursive: true, force: true });
  fs.writeFileSync(path.join(appDir, 'database', 'database.sqlite'), '');
  run('php artisan migrate:fresh --seed --force', { cwd: appDir, timeout: 300000 });
  console.log('app ready at', appDir);
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
