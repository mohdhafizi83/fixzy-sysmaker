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
        if (!cols.includes('module_scheduler')) {
            db.exec("ALTER TABLE projects ADD COLUMN module_scheduler INTEGER DEFAULT 0");
        }
        if (!cols.includes('backup_config')) {
            db.exec("ALTER TABLE projects ADD COLUMN backup_config TEXT");
        }
        if (!cols.includes('auth_2fa_mode')) {
            db.exec("ALTER TABLE projects ADD COLUMN auth_2fa_mode TEXT DEFAULT 'basic'");
        }
        if (!cols.includes('auth_captcha_mode')) {
            db.exec("ALTER TABLE projects ADD COLUMN auth_captcha_mode TEXT DEFAULT 'basic'");
        }
        const tableCols = db.prepare("PRAGMA table_info(tables)").all().map((c) => c.name);
        if (!tableCols.includes('scheduler_config')) {
            db.exec("ALTER TABLE tables ADD COLUMN scheduler_config TEXT");
        }
        if (!tableCols.includes('attachments_enabled')) {
            db.exec("ALTER TABLE tables ADD COLUMN attachments_enabled INTEGER DEFAULT 0");
        }
        if (!tableCols.includes('public_form_enabled')) {
            db.exec("ALTER TABLE tables ADD COLUMN public_form_enabled INTEGER DEFAULT 0");
        }
        if (!tableCols.includes('public_form_config')) {
            db.exec("ALTER TABLE tables ADD COLUMN public_form_config TEXT");
        }
        if (!tableCols.includes('numbering_enabled')) {
            db.exec("ALTER TABLE tables ADD COLUMN numbering_enabled INTEGER DEFAULT 0");
        }
        if (!tableCols.includes('numbering_config')) {
            db.exec("ALTER TABLE tables ADD COLUMN numbering_config TEXT");
        }
        if (!tableCols.includes('import_enabled')) {
            db.exec("ALTER TABLE tables ADD COLUMN import_enabled INTEGER DEFAULT 0");
        }
        if (!tableCols.includes('import_config')) {
            db.exec("ALTER TABLE tables ADD COLUMN import_config TEXT");
        }
        if (!tableCols.includes('api_enabled')) {
            db.exec("ALTER TABLE tables ADD COLUMN api_enabled INTEGER DEFAULT 0");
        }
        if (!tableCols.includes('api_config')) {
            db.exec("ALTER TABLE tables ADD COLUMN api_config TEXT");
        }
        if (!tableCols.includes('table_view_title_ms')) {
            db.exec("ALTER TABLE tables ADD COLUMN table_view_title_ms TEXT");
        }
        const fieldCols = db.prepare("PRAGMA table_info(fields)").all().map((c) => c.name);
        if (!fieldCols.includes('caption_ms')) {
            db.exec("ALTER TABLE fields ADD COLUMN caption_ms TEXT");
        }
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
        // Grid expansion (2026-09-25): opt-in grid/table-view features
        const gridCols = {
            grid_column_manager: "INTEGER DEFAULT 1",
            grid_sticky_header: "INTEGER DEFAULT 0",
            grid_row_density: "TEXT DEFAULT 'normal'",
            grid_inline_edit: "INTEGER DEFAULT 0",
            grid_default_per_page: "INTEGER DEFAULT 10",
            grid_per_page_options: "TEXT DEFAULT '5,10,25,50'",
            // Grid layout expansion phase A (2026-09-25)
            grid_group_by: "TEXT DEFAULT ''",
            grid_group_direction: "TEXT DEFAULT 'asc'",
            grid_summaries: "TEXT DEFAULT ''",
            grid_row_click: "TEXT DEFAULT 'page'",
            grid_empty_heading: "TEXT DEFAULT ''",
            grid_empty_icon: "TEXT DEFAULT ''",
            grid_empty_description: "TEXT DEFAULT ''",
            // Grid layout expansion phase B (2026-09-25)
            grid_row_striping: "INTEGER DEFAULT 0",
            grid_border_style: "TEXT DEFAULT 'default'",
            grid_content_width: "TEXT DEFAULT 'full'",
            grid_sticky_toolbar: "INTEGER DEFAULT 0",
            grid_sticky_footer: "INTEGER DEFAULT 0",
            grid_column_groups: "TEXT DEFAULT ''",
        };
        for (const [col, def] of Object.entries(gridCols)) {
            if (!tableCols.includes(col)) {
                db.exec(`ALTER TABLE tables ADD COLUMN ${col} ${def}`);
            }
        }
    }
    return db;
}

module.exports = { openStore, defaultDataDir };
