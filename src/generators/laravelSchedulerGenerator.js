// laravelSchedulerGenerator.js — emits shared Scheduler-module files when
// the project enables module_scheduler AND at least one table declares a
// valid schedule (reminders / recurring / backup):
//   - app/Console/Commands/ScheduleRunnerCommand.php  (compiled schedule table)
//   - app/Models/ScheduleRun.php                     (fire-once bookkeeping)
//   - app/Notifications/SchedulerReminder.php
//   - app/Filament/Pages/SchedulerStatus.php         (admin visibility page)
//   - database/migrations/xxxx_create_schedule_runs_table.php
//   - resources/views/filament/pages/scheduler-status.blade.php
//
// The schedule entries are compiled into the command as a constant at
// generation time (same model as the Approvals constants), so design
// changes take effect on the next generate/deploy.
//
// The runner is registered with Laravel's scheduler from
// SchedulerServiceProvider (one everyMinute tick for ALL schedules —
// per-schedule due checks happen inside the command, no per-schedule
// cron entries).

const fs = require('fs');
const path = require('path');
const { renderTemplate } = require('../render/engine');
const { getFormattedTimestamp } = require('../utils');
const { collectSchedules, anySchedulesEnabled } = require('./schedulerConfig');

/**
 * Generate the Scheduler module (run model, reminder notification,
 * runner command, status page, provider, migration) when any schedule
 * is configured.
 * @param {object} fullSchema assembled project schema
 * @param {string} outputDir generated app root
 * @returns {{success: boolean, files: string[], skipped?: boolean, schedules?: number, message?: string}}
 */
function generateSchedulerModule(fullSchema, outputDir) {
    try {
        if (!anySchedulesEnabled(fullSchema)) {
            return { success: true, files: [], skipped: true };
        }

        const written = [];
        const entries = collectSchedules(fullSchema);

        /** Render a template to outputDir/relPath once (idempotent: skips existing files). @param {string} relPath @param {string} template njk path @param {object} [context] @returns {void} */
        const emit = (relPath, template, context) => {
            const abs = path.join(outputDir, relPath);
            fs.mkdirSync(path.dirname(abs), { recursive: true });
            // Idempotent: skip when the file already exists (re-generation
            // over an already-generated app must not duplicate migrations).
            if (fs.existsSync(abs)) return;
            fs.writeFileSync(abs, renderTemplate(template, context || {}));
            written.push(relPath);
        };

        // Compiled schedule entries (PHP literal lines).
        const { scheduleEntryPhp, recurringEntryPhp, backupEntryPhp } = require('./schedulerConfig');
        const reminderLines = entries
            .filter((e) => e.kind === 'reminder')
            .map(scheduleEntryPhp)
            .join('\n');
        const recurringLines = entries
            .filter((e) => e.kind === 'recurring')
            .map(recurringEntryPhp)
            .join('\n');
        const backupEntries = entries.filter((e) => e.kind === 'backup');
        const backupLines = backupEntries.map(backupEntryPhp).join('\n');

        emit(path.join('app', 'Models', 'ScheduleRun.php'),
            'app/Models/ScheduleRun.php.njk');
        emit(path.join('app', 'Notifications', 'SchedulerReminder.php'),
            'app/Notifications/SchedulerReminder.php.njk');
        emit(path.join('app', 'Console', 'Commands', 'ScheduleRunnerCommand.php'),
            'app/Console/Commands/ScheduleRunnerCommand.php.njk',
            { reminderLines, recurringLines, backupLines, hasBackup: backupEntries.length > 0 });
        emit(path.join('app', 'Filament', 'Pages', 'SchedulerStatus.php'),
            'app/Filament/Pages/SchedulerStatus.php.njk');
        emit(path.join('app', 'Providers', 'SchedulerServiceProvider.php'),
            'app/Providers/SchedulerServiceProvider.php.njk');
        emit(path.join('resources', 'views', 'filament', 'pages', 'scheduler-status.blade.php'),
            'resources/views/filament/pages/scheduler-status.blade.php.njk');

        // Migration — timestamped name, same convention as other modules.
        const ts = getFormattedTimestamp(new Date(), 2);
        emit(path.join('database', 'migrations', `${ts}_create_schedule_runs_table.php`),
            'database/migrations/create_schedule_runs_table.php.njk');

        // Provider registration (idempotent) + deploy manifest.
        registerProvider(outputDir);

        return {
            success: true,
            files: written,
            schedules: entries.length,
        };
    } catch (err) {
        return { success: false, message: err.message };
    }
}

/** Escape a value for a single-quoted PHP string literal. @param {*} v @returns {string} */
function phpLit(v) {
    return String(v === null || v === undefined ? '' : v)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'");
}

/**
 * Register SchedulerServiceProvider in bootstrap/providers.php and the
 * fixzy-manifest.json (both idempotent).
 * @param {string} outputDir generated app root
 * @returns {void}
 */
function registerProvider(outputDir) {
    const providerClass = 'App\\Providers\\SchedulerServiceProvider';
    const providersFile = path.join(outputDir, 'bootstrap', 'providers.php');
    if (fs.existsSync(providersFile)) {
        let contents = fs.readFileSync(providersFile, 'utf8');
        if (!contents.includes('SchedulerServiceProvider')) {
            contents = contents.replace(/return\s*\[/, `return [\n    ${providerClass}::class,`);
            fs.writeFileSync(providersFile, contents);
        }
    }
    const manifestPath = path.join(outputDir, 'fixzy-manifest.json');
    let manifest = { composer: [], php_extensions: [], npm: [], providers: [] };
    if (fs.existsSync(manifestPath)) {
        try {
            const existing = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            manifest = {
                composer: Array.isArray(existing.composer) ? existing.composer : [],
                php_extensions: Array.isArray(existing.php_extensions) ? existing.php_extensions : [],
                npm: Array.isArray(existing.npm) ? existing.npm : [],
                providers: Array.isArray(existing.providers) ? existing.providers : [],
            };
        } catch (e) {
            // Corrupt manifest: start fresh rather than crash the build.
        }
    }
    if (!manifest.providers.includes(providerClass)) manifest.providers.push(providerClass);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

module.exports = { generateSchedulerModule };
