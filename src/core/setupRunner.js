/**
 * Setup runner (shared by CLI `npm run setup:binaries` and the GUI Setup Wizard).
 *
 * Provisions the PHP runtime + composer.phar used for preview/deploy OUTSIDE git,
 * and prepares resources/preview_env (.env + APP_KEY). All functions are safe to
 * re-run: existing artifacts are left untouched.
 *
 *   checkSetup({binDir, rootDir})        -> { node, php, composer, previewEnv }
 *   runSetup({binDir, rootDir, onLog})  -> Promise<{ ok, failed: [...] }>
 *
 * Override with FSM_PHP_BIN=<path> to skip PHP provisioning entirely.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const { resolvePhpBinary } = require('./phpResolver');

const PHP_VERSION = '8.4.12';
const PHP_WIN_URL = `https://windows.php.net/downloads/releases/php-${PHP_VERSION}-Win32-vs17-x64.zip`;
const COMPOSER_URL = 'https://getcomposer.org/download/2.8.8/composer.phar';

function defaultDirs() {
    // Packaged (Electron asar): resources live under process.resourcesPath.
    if (process.resourcesPath && fs.existsSync(path.join(process.resourcesPath, 'preview_env'))) {
        return {
            binDir: path.join(process.resourcesPath, 'app.asar.unpacked', 'bin'),
            rootDir: process.resourcesPath,
        };
    }
    // Dev checkout: src/core -> repo root.
    const rootDir = path.join(__dirname, '..', '..');
    return { binDir: path.join(rootDir, 'bin'), rootDir };
}

function systemPhpOk() {
    try {
        const out = execFileSync('php', ['-r', 'echo PHP_VERSION;'], { encoding: 'utf8' });
        const [maj, min] = out.split('.').map(Number);
        return maj > 8 || (maj === 8 && min >= 2);
    } catch {
        return false;
    }
}

/**
 * Fast, side-effect-free environment probe. Each entry: { ok, detail }.
 */
function checkSetup(opts = {}) {
    const { binDir, rootDir } = { ...defaultDirs(), ...opts };
    const nodeMajor = parseInt(process.versions.node, 10);

    let php = { ok: false, detail: 'not found', path: null };
    const phpBin = resolvePhpBinary(binDir);
    try {
        const v = execFileSync(phpBin, ['-r', 'echo PHP_VERSION;'], { encoding: 'utf8' });
        const [maj, min] = v.split('.').map(Number);
        if (maj > 8 || (maj === 8 && min >= 2)) {
            php = { ok: true, detail: v, path: phpBin };
        } else {
            php = { ok: false, detail: `found ${v} but >= 8.2 required`, path: phpBin };
        }
    } catch {
        php = { ok: false, detail: 'not found', path: null };
    }

    const composerPath = path.join(binDir, 'composer.phar');
    const composer = fs.existsSync(composerPath)
        ? { ok: true, detail: composerPath }
        : { ok: false, detail: 'missing (bin/composer.phar)' };

    const previewEnvFile = path.join(rootDir, 'resources', 'preview_env', '.env');
    let previewEnv;
    if (!fs.existsSync(previewEnvFile)) {
        previewEnv = { ok: false, detail: 'resources/preview_env/.env missing' };
    } else {
        const env = fs.readFileSync(previewEnvFile, 'utf8');
        const keyLine = (env.match(/^APP_KEY=(.*)$/m) || [])[1] || '';
        previewEnv = keyLine.trim()
            ? { ok: true, detail: 'APP_KEY set' }
            : { ok: false, detail: 'APP_KEY empty — needs key:generate' };
    }

    return {
        node: { ok: nodeMajor >= 20, detail: process.versions.node },
        php,
        composer,
        previewEnv,
        ready: nodeMajor >= 20 && php.ok && composer.ok && previewEnv.ok,
    };
}

function run(cmd, args, { onLog = () => {}, ...spawnOpts } = {}) {
    return new Promise((resolve) => {
        let child;
        try {
            child = spawn(cmd, args, { windowsHide: true, ...spawnOpts });
        } catch (e) {
            onLog(`ERROR: ${e.message}`);
            resolve(-1);
            return;
        }
        child.stdout.on('data', (d) => onLog(d.toString()));
        child.stderr.on('data', (d) => onLog(d.toString()));
        child.on('error', (e) => { onLog(`ERROR: ${e.message}`); resolve(-1); });
        child.on('close', (code) => resolve(code === null ? -1 : code));
    });
}

/**
 * Provision everything that is missing. Streams progress through onLog(line).
 * Never destructive: existing PHP/composer/.env are left as-is.
 */
async function runSetup(opts = {}) {
    const { binDir, rootDir } = { ...defaultDirs(), ...opts };
    const onLog = opts.onLog || ((m) => console.log('[setup] ' + m));
    const failed = [];

    // 1. PHP runtime -----------------------------------------------------
    if (process.env.FSM_PHP_BIN) {
        onLog('FSM_PHP_BIN is set (' + process.env.FSM_PHP_BIN + ') — skipping PHP provisioning.');
    } else if (process.platform === 'win32') {
        const phpExe = path.join(binDir, 'php-' + PHP_VERSION, 'php.exe');
        if (fs.existsSync(phpExe)) {
            onLog('PHP already present at ' + phpExe);
        } else {
            onLog('Downloading PHP ' + PHP_VERSION + ' (Windows x64)...');
            const tmpZip = path.join(os.tmpdir(), 'fixzy-php.zip');
            const dl = await run('powershell', ['-NoProfile', '-Command',
                `Invoke-WebRequest -Uri '${PHP_WIN_URL}' -OutFile '${tmpZip}'`], { onLog });
            if (dl === 0) {
                fs.mkdirSync(binDir, { recursive: true });
                const ex = await run('powershell', ['-NoProfile', '-Command',
                    `Expand-Archive -Force '${tmpZip}' '${binDir}'`], { onLog });
                fs.rmSync(tmpZip, { force: true });
                if (ex !== 0) failed.push('php-extract');
            } else {
                onLog('PHP download failed. Download manually from windows.php.net and extract into bin/php-' + PHP_VERSION + '/, or set FSM_PHP_BIN.');
                failed.push('php-download');
            }
        }
    } else {
        const link = path.join(binDir, 'php-' + PHP_VERSION, 'php');
        if (fs.existsSync(link) || fs.existsSync(path.join(path.dirname(link), 'php.exe'))) {
            onLog('bin/php-' + PHP_VERSION + ' already present — leaving as is.');
        } else if (!systemPhpOk()) {
            onLog('No system PHP >= 8.2 found on PATH.');
            onLog('Install one (e.g. `brew install php` on macOS, `apt install php-cli` on Debian/Ubuntu), or set FSM_PHP_BIN=/path/to/php.');
            onLog('Note: generators work WITHOUT PHP — only live preview/deploy need it.');
            failed.push('php-system');
        } else {
            const php = execFileSync('which', ['php'], { encoding: 'utf8' }).trim();
            fs.mkdirSync(path.dirname(link), { recursive: true });
            fs.symlinkSync(php, link);
            onLog('Linked ' + link + ' -> ' + php);
        }
    }

    // 2. composer.phar ---------------------------------------------------
    const composerPhar = path.join(binDir, 'composer.phar');
    if (fs.existsSync(composerPhar)) {
        onLog('bin/composer.phar already present.');
    } else {
        onLog('Downloading composer.phar...');
        const phpBin = resolvePhpBinary(binDir);
        const code = await run(phpBin, ['-r',
            `copy('${COMPOSER_URL}', process.argv[1]);`, composerPhar], { onLog });
        if (code === 0 && fs.existsSync(composerPhar)) {
            fs.chmodSync(composerPhar, 0o755);
            onLog('composer.phar ready at ' + composerPhar);
        } else {
            onLog('composer.phar download failed. Get it manually from getcomposer.org into bin/composer.phar');
            failed.push('composer');
        }
    }

    // 3. preview env (.env + APP_KEY) -------------------------------------
    const previewDir = path.join(rootDir, 'resources', 'preview_env');
    const previewEnv = path.join(previewDir, '.env');
    const previewExample = path.join(previewDir, '.env.example');
    if (!fs.existsSync(previewEnv) && fs.existsSync(previewExample)) {
        fs.copyFileSync(previewExample, previewEnv);
        onLog('Copied .env.example -> .env for resources/preview_env');
    }
    if (fs.existsSync(previewEnv)) {
        const env = fs.readFileSync(previewEnv, 'utf8');
        if (/^APP_KEY=$/m.test(env)) {
            onLog('Generating APP_KEY for resources/preview_env ...');
            const phpBin = resolvePhpBinary(binDir);
            const code = await run(phpBin, [path.join(previewDir, 'artisan'), 'key:generate', '--force'],
                { cwd: previewDir, onLog });
            if (code !== 0) {
                onLog('key:generate failed (preview needs a key). Run manually: cd resources/preview_env && php artisan key:generate');
                failed.push('app-key');
            }
        } else {
            onLog('preview_env APP_KEY already set.');
        }
    } else {
        failed.push('preview-env');
    }

    return { ok: failed.length === 0, failed };
}

module.exports = { checkSetup, runSetup, defaultDirs };
