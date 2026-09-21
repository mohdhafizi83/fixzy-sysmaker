/**
 * Platform-aware binary resolution (Phase 6.2).
 *
 * PHP used to be a Windows-only bundle committed to git (bin/php-8.4.12/php.exe).
 * Binaries now live OUTSIDE git; `npm run setup:binaries` provisions them per
 * platform. Resolution order:
 *   1. FSM_PHP_BIN env override (any platform)
 *   2. Bundled: <bin>/php-8.4.12/php.exe (win) or /php (unix), if present
 *   3. System `php` on PATH (unix/mac; on Windows fall back to bundled only)
 */
'use strict';

const fs = require('fs');
const path = require('path');

function bundledPhpPath(baseBinPath) {
    const exe = process.platform === 'win32' ? 'php.exe' : 'php';
    return path.join(baseBinPath, 'php-8.4.12', exe);
}

/**
 * @param {string} baseBinPath directory containing php-8.4.12/ (repo bin/ or
 *        process.resourcesPath/app.asar.unpacked/bin when packaged)
 * @returns {string} absolute path or bare 'php' for PATH lookup
 */
function resolvePhpBinary(baseBinPath) {
    if (process.env.FSM_PHP_BIN && fs.existsSync(process.env.FSM_PHP_BIN)) {
        return process.env.FSM_PHP_BIN;
    }
    const bundled = bundledPhpPath(baseBinPath);
    if (fs.existsSync(bundled)) return bundled;
    if (process.platform === 'win32') {
        // Windows has no guaranteed system PHP; return bundled path anyway so
        // the spawn error message points at the setup script.
        return bundled;
    }
    return 'php';
}

module.exports = { resolvePhpBinary, bundledPhpPath };
