#!/usr/bin/env node
/**
 * setup:binaries (Phase 6.2)
 *
 * Provisions the PHP runtime used for preview/deploy OUTSIDE git.
 *   - Windows: downloads the Zend Server thread-safe PHP 8.4 zip into
 *     bin/php-8.4.12/php.exe
 *   - macOS/Linux: checks for a system php >= 8.2 and links it into
 *     bin/php-8.4.12/php (or tells the user to install one)
 *
 * Override with FSM_PHP_BIN=<path> to skip entirely.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const BIN_DIR = path.join(__dirname, '..', 'bin');
const PHP_DIR = path.join(BIN_DIR, 'php-8.4.12');

function log(m) { console.log('[setup:binaries] ' + m); }

function systemPhpOk() {
    try {
        const out = execFileSync('php', ['-r', 'echo PHP_VERSION;'], { encoding: 'utf8' });
        const [maj, min] = out.split('.').map(Number);
        return maj > 8 || (maj === 8 && min >= 2);
    } catch {
        return false;
    }
}

function setupUnix() {
    if (!systemPhpOk()) {
        log('No system PHP >= 8.2 found on PATH.');
        log('Install one (e.g. `brew install php` on macOS, `apt install php-cli` on Debian/Ubuntu),');
        log('or set FSM_PHP_BIN=/path/to/php. Preview/deploy features need PHP; generators do NOT.');
        process.exit(1);
    }
    const php = execFileSync('which', ['php'], { encoding: 'utf8' }).trim();
    fs.mkdirSync(PHP_DIR, { recursive: true });
    const link = path.join(PHP_DIR, 'php');
    if (fs.existsSync(link) || fs.existsSync(path.join(PHP_DIR, 'php.exe'))) {
        log('bin/php-8.4.12 already present — leaving as is.');
        return;
    }
    fs.symlinkSync(php, link);
    log(`Linked ${link} -> ${php}`);
}

function setupWindows() {
    const url = 'https://windows.php.net/downloads/releases/php-8.4.12-Win32-vs17-x64.zip';
    log('Downloading PHP 8.4.12 (Windows x64)...');
    const tmpZip = path.join(os.tmpdir(), 'fsm-php.zip');
    try {
        execFileSync('powershell', ['-NoProfile', '-Command',
            `Invoke-WebRequest -Uri '${url}' -OutFile '${tmpZip}'`], { stdio: 'inherit' });
    } catch (e) {
        log('Download failed: ' + e.message);
        log('Download manually from windows.php.net and extract into bin/php-8.4.12/,');
        log('or set FSM_PHP_BIN=C:\\path\\to\\php.exe');
        process.exit(1);
    }
    fs.mkdirSync(PHP_DIR, { recursive: true });
    execFileSync('powershell', ['-NoProfile', '-Command',
        `Expand-Archive -Force '${tmpZip}' '${PHP_DIR}'`], { stdio: 'inherit' });
    fs.rmSync(tmpZip, { force: true });
    log('PHP installed to ' + PHP_DIR);
}

if (process.env.FSM_PHP_BIN) {
    log('FSM_PHP_BIN is set (' + process.env.FSM_PHP_BIN + ') — nothing to do.');
} else if (process.platform === 'win32') {
    setupWindows();
} else {
    setupUnix();
}

// composer.phar (small, cross-platform) — download if missing
const composerPhar = path.join(BIN_DIR, 'composer.phar');
if (!fs.existsSync(composerPhar)) {
    log('Downloading composer.phar...');
    try {
        execFileSync('php', ['-r',
            "copy('https://getcomposer.org/download/2.8.8/composer.phar', process.argv[1]);",
            composerPhar]);
        fs.chmodSync(composerPhar, 0o755);
        log('composer.phar ready at ' + composerPhar);
    } catch (e) {
        log('composer.phar download failed: ' + e.message);
        log('Get it manually from getcomposer.org into bin/composer.phar');
        process.exit(1);
    }
} else {
    log('bin/composer.phar already present.');
}

// Preview env: fresh clones have no .env (untracked). Copy the example,
// then generate a local APP_KEY so live preview works out of the box.
const previewDir = path.join(__dirname, '..', 'resources', 'preview_env');
const previewEnv = path.join(previewDir, '.env');
const previewExample = path.join(previewDir, '.env.example');
if (!fs.existsSync(previewEnv) && fs.existsSync(previewExample)) {
    fs.copyFileSync(previewExample, previewEnv);
    log('Copied .env.example -> .env for resources/preview_env');
}
if (fs.existsSync(previewEnv)) {
    const env = fs.readFileSync(previewEnv, 'utf8');
    if (/^APP_KEY=$/m.test(env)) {
        log('Generating APP_KEY for resources/preview_env ...');
        try {
            execFileSync('php', [path.join(previewDir, 'artisan'), 'key:generate', '--force'],
                { cwd: previewDir, stdio: 'inherit' });
        } catch (e) {
            log('key:generate failed (preview needs a key): ' + e.message);
            log('Run manually: cd resources/preview_env && php artisan key:generate');
        }
    } else {
        log('preview_env APP_KEY already set.');
    }
}
log('Done.');
