'use strict';
/**
 * Resolve a Chromium executable for the screenshot/verify scripts.
 *
 * Resolution order:
 *   1. FSM_CHROME env var (explicit override)
 *   2. playwright-core's own registry (chromium.executablePath()) when it
 *      points at an existing file
 *   3. Scan the standard Playwright cache (~/.cache/ms-playwright/) for a
 *      chromium build: chrome-linux64/chrome on Linux, Chromium.app on
 *      macOS, chrome.exe on Windows.
 *
 * Throws a helpful error when nothing is found.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

/** @returns {string} absolute path to a Chromium/Chrome binary */
function resolveChrome() {
    if (process.env.FSM_CHROME && fs.existsSync(process.env.FSM_CHROME)) {
        return process.env.FSM_CHROME;
    }
    try {
        const { chromium } = require('playwright-core');
        const p = chromium.executablePath();
        if (p && fs.existsSync(p)) return p;
    } catch { /* not installed / no registry entry */ }

    const cache = path.join(os.homedir(), '.cache', 'ms-playwright');
    if (fs.existsSync(cache)) {
        const candidates = [];
        for (const dir of fs.readdirSync(cache)) {
            if (!/^chromium(-headless_shell)?-/.test(dir)) continue;
            candidates.push(
                path.join(cache, dir, 'chrome-linux64', 'chrome'),
                path.join(cache, dir, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'),
                path.join(cache, dir, 'chrome-win64', 'chrome.exe'),
                path.join(cache, dir, 'chrome-linux', 'chrome')
            );
        }
        const found = candidates.find((c) => fs.existsSync(c));
        if (found) return found;
    }
    throw new Error(
        'No Chromium found. Install one with `npx playwright install chromium` ' +
        'or set FSM_CHROME=/path/to/chrome.');
}

module.exports = { resolveChrome };
