/**
 * Setup runner (shared by CLI `npm run setup:binaries` and the GUI Setup Wizard).
 *
 * Provisions the PHP runtime + composer.phar used for preview/deploy OUTSIDE git,
 * and prepares the preview environment template (.env + APP_KEY). All functions
 * are safe to re-run: existing artifacts are left untouched.
 *
 *   checkSetup({binDir, rootDir})        -> { node, php, composer, previewEnv }
 *   runSetup({binDir, rootDir, onLog})  -> Promise<{ ok, failed: [...] }>
 *
 * Preview environment (download-on-first-run):
 *   The Laravel+Filament base template is NOT bundled with the app anymore.
 *   It is downloaded from the GitHub release below, SHA-256 verified, and
 *   extracted to ~/.fixzy/preview_env (override: FSM_PREVIEW_TEMPLATE).
 *   The repo is private until publish; supply a token via FSM_PREVIEW_TOKEN
 *   or GITHUB_TOKEN (classic token with `repo` scope) while private.
 *
 * Override with FSM_PHP_BIN=<path> to skip PHP provisioning entirely.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const { spawn, execFileSync } = require('child_process');
const { resolvePhpBinary } = require('./phpResolver');

const PHP_VERSION = '8.4.12';
const PHP_WIN_URL = `https://windows.php.net/downloads/releases/php-${PHP_VERSION}-Win32-vs17-x64.zip`;
const COMPOSER_URL = 'https://getcomposer.org/download/2.8.8/composer.phar';

// ---- Preview environment template (download-on-first-run) -----------------
const PREVIEW_ENV_VERSION = 'preview-env-v1';
const PREVIEW_ENV_REPO = 'mohdhafizi83/FiziSysMaker-Laravel-Filament-Boilerplate';
const PREVIEW_ENV_ASSET = 'preview-env-v1.tar.gz';
const PREVIEW_ENV_SHA256 = '3dabf4fa06328f726894a57a357ddf75eb77762fc23fb71c3d44b558bc30beab';
const PREVIEW_ENV_URL = `https://github.com/${PREVIEW_ENV_REPO}/releases/download/${PREVIEW_ENV_VERSION}/${PREVIEW_ENV_ASSET}`;

/**
 * Runtime location of the downloaded preview template. Shared between GUI and
 * CLI (single copy per machine). The tarball extracts a `preview_env/` dir,
 * so we extract into its parent.
 */
function previewTemplateDir() {
    if (process.env.FSM_PREVIEW_TEMPLATE) return process.env.FSM_PREVIEW_TEMPLATE;
    return path.join(os.homedir(), '.fixzy', 'preview_env');
}

/**
 * Resolve the preview template for consumers (preview server, deploy):
 *   1. FSM_PREVIEW_TEMPLATE override
 *   2. Bundled dev checkout (resources/preview_env) — dev/tests only
 *   3. Downloaded template (~/.fixzy/preview_env)
 * Returns the first existing path, or the downloaded path (so callers can
 * report "run setup" with a useful location).
 */
function resolvePreviewTemplate(rootDir) {
    if (process.env.FSM_PREVIEW_TEMPLATE) return process.env.FSM_PREVIEW_TEMPLATE;
    const bundled = path.join(rootDir || '', 'resources', 'preview_env');
    if (rootDir && fs.existsSync(path.join(bundled, 'artisan'))) return bundled;
    return previewTemplateDir();
}

function previewToken() {
    return process.env.FSM_PREVIEW_TOKEN || process.env.GITHUB_TOKEN || null;
}

/**
 * HTTPS GET to file with redirect following. Token is sent only to github.com
 * (never forwarded to the CDN redirect target).
 */
function downloadToFile(url, dest, { redirects = 0 } = {}) {
    return new Promise((resolve, reject) => {
        if (redirects > 6) return reject(new Error('Too many redirects'));
        const u = new URL(url);
        const headers = { 'User-Agent': 'fixzy-sysmaker-setup' };
        const token = previewToken();
        if (token && (u.hostname === 'github.com' || u.hostname === 'api.github.com')) {
            headers['Authorization'] = 'token ' + token;
        }
        if (u.hostname === 'api.github.com') headers['Accept'] = 'application/octet-stream';
        https.get(url, { headers }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                res.resume();
                return resolve(downloadToFile(res.headers.location, dest, { redirects: redirects + 1 }));
            }
            if (res.statusCode !== 200) {
                res.resume();
                return reject(new Error(`Download failed (HTTP ${res.statusCode})`));
            }
            const out = fs.createWriteStream(dest);
            res.pipe(out);
            out.on('finish', () => out.close(() => resolve(true)));
            out.on('error', reject);
        }).on('error', reject);
    });
}

/**
 * Download a release asset by name. Tries the public release URL first
 * (works once the repo is public), then falls back to the GitHub API
 * octet-stream endpoint (required while the repo is private).
 */
async function downloadReleaseAsset(dest) {
    const tmpTgz = dest;
    try {
        await downloadToFile(PREVIEW_ENV_URL, tmpTgz);
        return;
    } catch (e) {
        if (!previewToken()) {
            throw new Error(e.message + ' — if the repo is private, set FSM_PREVIEW_TOKEN (or GITHUB_TOKEN) with repo scope.');
        }
    }
    // API fallback: resolve asset id by tag, then stream it.
    const tagUrl = `https://api.github.com/repos/${PREVIEW_ENV_REPO}/releases/tags/${PREVIEW_ENV_VERSION}`;
    const asset = await new Promise((resolve, reject) => {
        https.get(tagUrl, {
            headers: {
                'User-Agent': 'fixzy-sysmaker-setup',
                'Accept': 'application/vnd.github+json',
                'Authorization': 'token ' + previewToken(),
            },
        }, (res) => {
            let body = '';
            res.on('data', (d) => body += d);
            res.on('end', () => {
                if (res.statusCode !== 200) return reject(new Error(`API tag lookup failed (HTTP ${res.statusCode})`));
                try {
                    const j = JSON.parse(body);
                    const a = (j.assets || []).find((x) => x.name === PREVIEW_ENV_ASSET);
                    if (!a) return reject(new Error(`Asset ${PREVIEW_ENV_ASSET} not found on release ${PREVIEW_ENV_VERSION}`));
                    resolve(a);
                } catch (e) { reject(e); }
            });
        }).on('error', reject);
    });
    await downloadToFile(`https://api.github.com/repos/${PREVIEW_ENV_REPO}/releases/assets/${asset.id}`, tmpTgz);
}

function sha256File(file) {
    return new Promise((resolve, reject) => {
        const h = crypto.createHash('sha256');
        fs.createReadStream(file)
            .on('data', (d) => h.update(d))
            .on('end', () => resolve(h.digest('hex')))
            .on('error', reject);
    });
}

/**
 * Ensure the preview template exists at previewTemplateDir().
 * Downloads + verifies + extracts if missing. Idempotent.
 */
async function ensurePreviewTemplate({ onLog = () => {} } = {}) {
    const dir = previewTemplateDir();
    if (fs.existsSync(path.join(dir, 'artisan'))) {
        onLog('Preview template already present at ' + dir);
        return { ok: true, source: dir };
    }
    const token = previewToken();
    onLog(`Downloading preview template (${PREVIEW_ENV_VERSION})${token ? ' [authenticated]' : ''} ...`);
    const tmpTgz = path.join(os.tmpdir(), PREVIEW_ENV_ASSET);
    try {
        await downloadReleaseAsset(tmpTgz);
    } catch (e) {
        onLog('Preview template download failed: ' + e.message);
        return { ok: false, error: e.message };
    }
    const actual = await sha256File(tmpTgz);
    if (actual !== PREVIEW_ENV_SHA256) {
        fs.rmSync(tmpTgz, { force: true });
        const msg = `Preview template checksum mismatch (expected ${PREVIEW_ENV_SHA256.slice(0, 12)}…, got ${actual.slice(0, 12)}…). Refusing to install.`;
        onLog(msg);
        return { ok: false, error: msg };
    }
    onLog('Checksum verified. Extracting to ' + path.dirname(dir) + ' ...');
    fs.mkdirSync(path.dirname(dir), { recursive: true });
    const code = await run('tar', ['-xzf', tmpTgz, '-C', path.dirname(dir)], { onLog });
    fs.rmSync(tmpTgz, { force: true });
    if (code !== 0 || !fs.existsSync(path.join(dir, 'artisan'))) {
        onLog('Extraction failed (tar exit ' + code + ').');
        return { ok: false, error: 'extract-failed' };
    }
    onLog('Preview template installed at ' + dir);
    return { ok: true, source: dir };
}

function defaultDirs() {
    // Packaged (Electron asar): resources live under process.resourcesPath.
    if (process.resourcesPath && fs.existsSync(path.join(process.resourcesPath, 'app.asar.unpacked', 'bin'))) {
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

    const templateDir = resolvePreviewTemplate(rootDir);
    const previewEnvFile = path.join(templateDir, '.env');
    let previewEnv;
    if (!fs.existsSync(path.join(templateDir, 'artisan'))) {
        previewEnv = { ok: false, detail: `preview template missing (${templateDir}) — run setup to download` };
    } else if (!fs.existsSync(previewEnvFile)) {
        previewEnv = { ok: false, detail: `${templateDir}/.env missing` };
    } else {
        const env = fs.readFileSync(previewEnvFile, 'utf8');
        const keyLine = (env.match(/^APP_KEY=(.*)$/m) || [])[1] || '';
        previewEnv = keyLine.trim()
            ? { ok: true, detail: 'APP_KEY set (' + templateDir + ')' }
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
 * Never destructive: existing PHP/composer/template/.env are left as-is.
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

    // 3. preview template (download-on-first-run) -------------------------
    const templateRes = await ensurePreviewTemplate({ onLog });
    if (!templateRes.ok) {
        failed.push('preview-template');
    }

    // 3b. template vendor deps (composer install inside the template).
    // The release tarball ships without vendor/ (gitignored); the preview
    // working copy is cloned from this template, so vendor must exist here.
    const previewDir = resolvePreviewTemplate(rootDir);
    if (fs.existsSync(path.join(previewDir, 'composer.json')) && !fs.existsSync(path.join(previewDir, 'vendor', 'autoload.php'))) {
        if (fs.existsSync(composerPhar)) {
            onLog('Installing preview template dependencies (composer install) — this takes 1-2 minutes...');
            const phpBin = resolvePhpBinary(binDir);
            const code = await run(phpBin, [composerPhar, 'install', '--no-interaction', '--ignore-platform-req=php'],
                { cwd: previewDir, onLog });
            if (code !== 0 || !fs.existsSync(path.join(previewDir, 'vendor', 'autoload.php'))) {
                onLog('composer install failed. Run manually: cd ' + previewDir + ' && php ' + composerPhar + ' install');
                failed.push('preview-composer');
            }
        } else {
            onLog('Cannot install preview deps: composer.phar missing (fix composer step first).');
            failed.push('preview-composer');
        }
    } else if (fs.existsSync(path.join(previewDir, 'vendor', 'autoload.php'))) {
        onLog('Preview template vendor already installed.');
    }

    // 4. preview env (.env + APP_KEY) ------------------------------------
    // Operates on the resolved template (bundled dev copy or downloaded).
    const previewEnv = path.join(previewDir, '.env');
    const previewExample = path.join(previewDir, '.env.example');
    if (!fs.existsSync(previewEnv) && fs.existsSync(previewExample)) {
        fs.copyFileSync(previewExample, previewEnv);
        onLog('Copied .env.example -> .env for ' + previewDir);
    }
    if (fs.existsSync(previewEnv)) {
        const env = fs.readFileSync(previewEnv, 'utf8');
        if (/^APP_KEY=$/m.test(env)) {
            onLog('Generating APP_KEY for ' + previewDir + ' ...');
            const phpBin = resolvePhpBinary(binDir);
            const code = await run(phpBin, [path.join(previewDir, 'artisan'), 'key:generate', '--force'],
                { cwd: previewDir, onLog });
            if (code !== 0) {
                onLog('key:generate failed (preview needs a key). Run manually: cd ' + previewDir + ' && php artisan key:generate');
                failed.push('app-key');
            }
        } else {
            onLog('preview_env APP_KEY already set.');
        }
    } else if (templateRes.ok) {
        failed.push('preview-env');
    }

    return { ok: failed.length === 0, failed };
}

module.exports = { checkSetup, runSetup, defaultDirs, ensurePreviewTemplate, resolvePreviewTemplate, previewTemplateDir, PREVIEW_ENV_VERSION };
