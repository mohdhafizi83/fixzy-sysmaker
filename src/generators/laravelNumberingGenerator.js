// laravelNumberingGenerator.js — emits shared Auto-Numbering module
// files when any table enables numbering (tables.numbering_enabled +
// numbering_config JSON):
//   - app/Models/Concerns/HasNumbering.php  (race-safe trait)
//   - database/migrations/..._create_numbering_sequences_table.php
//
// Per-model wiring (trait use + numberingConfig() override) is done
// by the model generator via numbering_import / numbering_trait /
// numbering_config_php context vars.

const fs = require('fs');
const path = require('path');
const { renderTemplate } = require('../render/engine');
const { getFormattedTimestamp } = require('../utils');
const { anyNumberingEnabled } = require('./numberingConfig');

/**
 * Generate shared Auto-Numbering module files (HasNumbering trait +
 * sequences migration) when any table enables numbering.
 * @param {object} fullSchema assembled project schema
 * @param {string} outputDir generated app root
 * @returns {{success: boolean, files: string[], skipped?: boolean, error?: string}}
 */
function generateNumberingModule(fullSchema, outputDir) {
    try {
        if (!anyNumberingEnabled(fullSchema)) {
            return { success: true, files: [], skipped: true };
        }
        const written = [];
        /** Render a template to outputDir/relPath and track it. @param {string} relPath @param {string} template njk path @param {object} [context] @returns {void} */
        const emit = (relPath, template, context) => {
            const abs = path.join(outputDir, relPath);
            fs.mkdirSync(path.dirname(abs), { recursive: true });
            fs.writeFileSync(abs, renderTemplate(template, context || {}));
            written.push(relPath);
        };

        emit(path.join('app', 'Models', 'Concerns', 'HasNumbering.php'),
            'app/Models/Concerns/HasNumbering.php.njk', {});

        const ts = getFormattedTimestamp(new Date(), 2);
        emit(path.join('database', 'migrations', `${ts}_create_numbering_sequences_table.php`),
            'database/migrations/create_numbering_sequences_table.php.njk', {});

        return { success: true, files: written };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

module.exports = { generateNumberingModule };
