// laravelApprovalGenerator.js — emits shared Approvals-module files when
// any table in the schema has approvals enabled:
//   - app/Models/Concerns/HasApproval.php   (state-machine trait)
//   - app/Models/ApprovalHistory.php        (trail model)
//   - app/Notifications/ApprovalTransitioned.php
//   - database/migrations/xxxx_create_approval_histories_table.php
//   - app/Filament/RelationManagers/ApprovalHistoryRelationManager.php
//
// Per-table pieces (constants, trait use, actions, badge) are injected by
// the model/table/resource generators via approvalConfig.js.

const fs = require('fs');
const path = require('path');
const { renderTemplate } = require('../render/engine');
const { getFormattedTimestamp } = require('../utils');
const { anyApprovalsEnabled } = require('./approvalConfig');

function generateApprovalModule(fullSchema, outputDir) {
    try {
        if (!anyApprovalsEnabled(fullSchema)) {
            return { success: true, files: [], skipped: true };
        }

        const written = [];

        const emit = (relPath, template, context) => {
            const abs = path.join(outputDir, relPath);
            fs.mkdirSync(path.dirname(abs), { recursive: true });
            // Idempotent: skip when the file already exists (re-generation
            // over an already-generated app must not duplicate migrations).
            if (fs.existsSync(abs)) return;
            fs.writeFileSync(abs, renderTemplate(template, context || {}));
            written.push(relPath);
        };

        emit(path.join('app', 'Models', 'Concerns', 'HasApproval.php'),
            'app/Models/Concerns/HasApproval.php.njk');
        emit(path.join('app', 'Models', 'ApprovalHistory.php'),
            'app/Models/ApprovalHistory.php.njk');
        emit(path.join('app', 'Notifications', 'ApprovalTransitioned.php'),
            'app/Notifications/ApprovalTransitioned.php.njk');
        emit(path.join('app', 'Filament', 'RelationManagers', 'ApprovalHistoryRelationManager.php'),
            'app/Filament/RelationManagers/ApprovalHistoryRelationManager.php.njk');

        // Migration — timestamped name, same convention as other module
        // migrations (sequence keeps ordering deterministic).
        const ts = getFormattedTimestamp(new Date(), 1);
        emit(path.join('database', 'migrations', `${ts}_create_approval_histories_table.php`),
            'database/migrations/create_approval_histories_table.php.njk');

        return { success: true, files: written };
    } catch (err) {
        return { success: false, message: err.message };
    }
}

module.exports = { generateApprovalModule };
