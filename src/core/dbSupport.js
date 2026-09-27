// Stack-neutral database support (Fixzy SysMaker DB support Tier 1+2).
//
// Single source of truth for which engines the generated app supports and
// how each maps to Laravel's DB_* env contract. Tier 1 = sqlite, mysql,
// pgsql. Tier 2 = cloud Postgres providers (Supabase, Neon, RDS, ...) —
// same pgsql engine, different connection presets.
//
// Anything outside this module's knowledge must NOT be silently defaulted:
// normalizeEngine() throws on unknown values so bad UI state fails loud.

'use strict';

// UI value -> Laravel connection driver
const ENGINE_BY_UI = {
    sqlite: 'sqlite',
    mysql_mariadb: 'mysql',
    postgresql: 'pgsql',
    // Tier 2 cloud presets (all speak PostgreSQL wire protocol)
    supabase: 'pgsql',
    neon: 'pgsql',
    cloud_postgres: 'pgsql',
};

// Cloud preset metadata surfaced in docs / deployment guide.
const CLOUD_PRESETS = {
    supabase: {
        label: 'Supabase (PostgreSQL)',
        defaultPort: 5432,
        poolerNote: 'Use the SESSION-mode pooler (port 5432) or direct '
            + 'connection. Transaction-mode pooling (port 6543) breaks '
            + 'prepared statements/advisory locks used by Laravel. Set '
            + 'DB_SSLMODE=require for hosted connections.',
    },
    neon: {
        label: 'Neon (PostgreSQL)',
        defaultPort: 5432,
        poolerNote: 'Use pooled connection with -pooler suffix for '
            + 'high-concurrency reads; direct endpoint for migrations. '
            + 'Set DB_SSLMODE=require.',
    },
    cloud_postgres: {
        label: 'Managed PostgreSQL (RDS / Cloud SQL / DigitalOcean)',
        defaultPort: 5432,
        poolerNote: 'Standard Postgres wire protocol. Enable SSL '
            + '(DB_SSLMODE=require) for hosted endpoints.',
    },
};

const SUPPORTED_UI_VALUES = Object.keys(ENGINE_BY_UI);

/**
 * Normalize a stored/UI database value to a Laravel driver name.
 * Empty/absent -> 'sqlite' (our zero-config default). Unknown -> throw.
 * @param {string|undefined|null} uiValue
 * @returns {'sqlite'|'mysql'|'pgsql'}
 */
function normalizeEngine(uiValue) {
    if (uiValue === undefined || uiValue === null || uiValue === '') {
        return 'sqlite';
    }
    const driver = ENGINE_BY_UI[uiValue];
    if (!driver) {
        throw new Error(
            `Unsupported database engine '${uiValue}'. Supported: `
            + SUPPORTED_UI_VALUES.join(', '));
    }
    return driver;
}

/**
 * Build the DB_* env lines for a generated app's .env.
 * @param {string} uiValue stored stack_database value
 * @param {{dbName?:string,user?:string,password?:string,host?:string,
 *          port?:string,sslmode?:string}} [cfg]
 * @returns {string[]} lines like 'DB_CONNECTION=pgsql'
 */
function envLines(uiValue, cfg = {}) {
    const driver = normalizeEngine(uiValue);
    if (driver === 'sqlite') {
        return [
            'DB_CONNECTION=sqlite',
            '# SQLite needs no server; the database file path is resolved '
            + 'relative to database/ by Laravel.',
        ];
    }
    const isPg = driver === 'pgsql';
    const lines = [
        `DB_CONNECTION=${driver}`,
        `DB_HOST=${cfg.host || '127.0.0.1'}`,
        `DB_PORT=${cfg.port || (isPg ? '5432' : '3306')}`,
        `DB_DATABASE=${cfg.dbName || 'laravel'}`,
        `DB_USERNAME=${cfg.user || 'root'}`,
        `DB_PASSWORD=${cfg.password || ''}`,
    ];
    if (isPg && cfg.sslmode) {
        lines.push(`DB_SSLMODE=${cfg.sslmode}`);
    }
    return lines;
}

/**
 * Human-readable guidance for the chosen engine (deployment guide).
 * @param {string} uiValue
 * @returns {{driver:string, label:string, notes:string[]}}
 */
function engineGuide(uiValue) {
    const driver = normalizeEngine(uiValue);
    const cloud = CLOUD_PRESETS[uiValue];
    if (driver === 'sqlite') {
        return {
            driver,
            label: 'SQLite',
            notes: ['No database server required — the app ships with a '
                + 'file-based database at database/database.sqlite.'],
        };
    }
    if (driver === 'mysql') {
        return {
            driver,
            label: 'MySQL / MariaDB',
            notes: ['Create the database and user before running '
                + 'migrations (port 3306).'],
        };
    }
    return {
        driver,
        label: cloud ? cloud.label : 'PostgreSQL',
        notes: cloud
            ? [cloud.poolerNote]
            : ['Create the database and user before running migrations '
                + '(port 5432).'],
    };
}

module.exports = {
    ENGINE_BY_UI,
    CLOUD_PRESETS,
    SUPPORTED_UI_VALUES,
    normalizeEngine,
    envLines,
    engineGuide,
};
