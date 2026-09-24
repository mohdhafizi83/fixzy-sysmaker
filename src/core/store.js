/**
 * Core database accessor (Phase 5.1).
 *
 * Electron keeps its userData path; the headless/web mode uses
 * FSM_DATA_DIR (default: ~/.fixzy). Same schema, same better-sqlite3.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

function defaultDataDir() {
    return process.env.FSM_DATA_DIR || path.join(os.homedir(), '.fixzy');
}

/**
 * Open (and bootstrap if needed) the Fixzy SysMaker SQLite store.
 * @param {string} [dbPath] explicit path; defaults to <dataDir>/Fixzy SysMaker.db
 * @returns {import('better-sqlite3').Database}
 */
function openStore(dbPath) {
    const file = dbPath || path.join(defaultDataDir(), 'Fixzy SysMaker.db');
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
    } else {
        // Incremental column migrations for databases created before newer
        // feature flags existed. SQLite-safe: check, then ALTER.
        const cols = db.prepare("PRAGMA table_info(projects)").all().map((c) => c.name);
        if (!cols.includes('module_realtime')) {
            db.exec("ALTER TABLE projects ADD COLUMN module_realtime INTEGER DEFAULT 0");
        }
        if (!cols.includes('realtime_backend')) {
            db.exec("ALTER TABLE projects ADD COLUMN realtime_backend TEXT DEFAULT 'reverb'");
        }
        if (!cols.includes('module_google_sheets')) {
            db.exec("ALTER TABLE projects ADD COLUMN module_google_sheets INTEGER DEFAULT 0");
        }
        if (!cols.includes('module_log_activity')) {
            db.exec("ALTER TABLE projects ADD COLUMN module_log_activity INTEGER DEFAULT 0");
        }
        const tableCols = db.prepare("PRAGMA table_info(tables)").all().map((c) => c.name);
        if (!tableCols.includes('google_sync_enabled')) {
            db.exec("ALTER TABLE tables ADD COLUMN google_sync_enabled INTEGER DEFAULT 0");
        }
        if (!tableCols.includes('card_columns')) {
            db.exec("ALTER TABLE tables ADD COLUMN card_columns INTEGER DEFAULT 3");
        }
        if (!tableCols.includes('card_columns_tablet')) {
            db.exec("ALTER TABLE tables ADD COLUMN card_columns_tablet INTEGER DEFAULT 2");
        }
        if (!tableCols.includes('approval_enabled')) {
            db.exec("ALTER TABLE tables ADD COLUMN approval_enabled INTEGER DEFAULT 0");
        }
        if (!tableCols.includes('approval_config')) {
            db.exec("ALTER TABLE tables ADD COLUMN approval_config TEXT");
        }
    }
    return db;
}

module.exports = { openStore, defaultDataDir };
