/**
 * Core database accessor (Phase 5.1).
 *
 * Electron keeps its userData path; the headless/web mode uses
 * FSM_DATA_DIR (default: ~/.fizisysmaker). Same schema, same better-sqlite3.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

function defaultDataDir() {
    return process.env.FSM_DATA_DIR || path.join(os.homedir(), '.fizisysmaker');
}

/**
 * Open (and bootstrap if needed) the FiziSysMaker SQLite store.
 * @param {string} [dbPath] explicit path; defaults to <dataDir>/FiziSysMaker.db
 * @returns {import('better-sqlite3').Database}
 */
function openStore(dbPath) {
    const file = dbPath || path.join(defaultDataDir(), 'FiziSysMaker.db');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const existed = fs.existsSync(file);
    const db = new Database(file);
    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 5000');
    if (!existed) {
        const schemaSql = fs.readFileSync(
            path.join(__dirname, '..', '..', 'resources', 'schema.sql'),
            'utf8'
        );
        db.exec(schemaSql);
    }
    return db;
}

module.exports = { openStore, defaultDataDir };
