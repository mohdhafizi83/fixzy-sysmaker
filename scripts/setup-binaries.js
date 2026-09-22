#!/usr/bin/env node
/**
 * setup:binaries — thin CLI wrapper around src/core/setupRunner.js.
 *
 * The GUI Setup Wizard uses the same runner, so provisioning logic lives in
 * exactly one place. See src/core/setupRunner.js for details.
 *
 * Override with FSM_PHP_BIN=<path> to skip PHP provisioning entirely.
 */
'use strict';

const { runSetup } = require('../src/core/setupRunner');

runSetup({ onLog: (m) => console.log('[setup:binaries] ' + m.trim()) })
    .then(({ ok, failed }) => {
        if (!ok) {
            console.error('[setup:binaries] incomplete — failed: ' + failed.join(', '));
            process.exit(1);
        }
        console.log('[setup:binaries] Done.');
    })
    .catch((e) => {
        console.error('[setup:binaries] ' + e.message);
        process.exit(1);
    });
