// laravelAttachmentGenerator.js — emits shared Attachments-module files
// when any table in the schema enables attachments (table-level flag or
// a field with media_type 'attachments'):
//   - app/Models/Attachment.php                       (polymorphic model)
//   - app/Http/Controllers/AttachmentDownloadController.php (signed stream)
//   - app/Providers/AttachmentServiceProvider.php     (route registration)
//   - app/Filament/RelationManagers/AttachmentsRelationManager.php
//   - database/migrations/xxxx_create_attachments_table.php
//
// Per-table pieces (attachments() relation, manager injection) are
// wired by the model/resource generators via attachmentConfig.js.
//
// Security model: files live on the private `local` disk (never
// web-served). Downloads require a temporary signed URL minted inside
// the admin panel, so an attacker cannot enumerate or hotlink files.

const fs = require('fs');
const path = require('path');
const { renderTemplate } = require('../render/engine');
const { getFormattedTimestamp } = require('../utils');
const { anyAttachmentsEnabled, attachmentOptions } = require('./attachmentConfig');

function generateAttachmentModule(fullSchema, outputDir) {
    try {
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

        // The signed-download plumbing (provider + controller + route) is
        // needed whenever ANY private attachment exists — field-level
        // private FileUpload fields call temporaryUrl() on the local
        // disk, which our provider backs with the signed route.
        const anyAt = anyAttachmentsEnabled(fullSchema);
        const anyFieldLevel = Object.values((fullSchema.database && fullSchema.database.table) || {})
            .some((t) => Object.values((t && t.fields) || {}).some((f) => f.media_type === 'attachments'));
        if (!anyAt && !anyFieldLevel) {
            return { success: true, files: [], skipped: true };
        }

        emit(path.join('app', 'Http', 'Controllers', 'AttachmentDownloadController.php'),
            'app/Http/Controllers/AttachmentDownloadController.php.njk');
        emit(path.join('app', 'Providers', 'AttachmentServiceProvider.php'),
            'app/Providers/AttachmentServiceProvider.php.njk');

        // Generic table-level manager pieces only when the flag is used.
        if (anyAt) {
            emit(path.join('app', 'Models', 'Attachment.php'),
                'app/Models/Attachment.php.njk');

        // Relation manager — compiled options = most permissive across
        // all attachment-enabled tables (single shared manager class).
        const tables = (fullSchema.database && fullSchema.database.table) || {};
        let maxFiles = 10;
        let maxSizeKb = 10240;
        let types = new Set();
        Object.values(tables).forEach((t) => {
            const opts = attachmentOptions(t);
            maxFiles = Math.max(maxFiles, opts.maxFiles);
            maxSizeKb = Math.max(maxSizeKb, opts.maxSizeKb);
            opts.allowedTypes.forEach((x) => types.add(x));
        });
        emit(path.join('app', 'Filament', 'RelationManagers', 'AttachmentsRelationManager.php'),
            'app/Filament/RelationManagers/AttachmentsRelationManager.php.njk',
            { max_files: maxFiles, max_size_kb: maxSizeKb, allowed_types: Array.from(types) });

        // Migration — timestamped name, same convention as other module
        // migrations.
        const ts = getFormattedTimestamp(new Date(), 2);
        emit(path.join('database', 'migrations', `${ts}_create_attachments_table.php`),
            'database/migrations/create_attachments_table.php.njk');
        }

        // Register provider in bootstrap/providers.php when generating
        // into a full app (same pattern as ActivityLogServiceProvider).
        const providersFile = path.join(outputDir, 'bootstrap', 'providers.php');
        if (fs.existsSync(providersFile)) {
            let contents = fs.readFileSync(providersFile, 'utf8');
            if (!contents.includes('AttachmentServiceProvider')) {
                contents = contents.replace(
                    /return\s*\[/,
                    'return [\n    App\\Providers\\AttachmentServiceProvider::class,'
                );
                fs.writeFileSync(providersFile, contents);
            }
        }

        // Manifest: the deploy/preview flow registers providers from
        // fixzy-manifest.json into the staging app's bootstrap/providers.php.
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
        const providerClass = 'App\\Providers\\AttachmentServiceProvider';
        if (!manifest.providers.includes(providerClass)) {
            manifest.providers.push(providerClass);
        }
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

        return { success: true, files: written };
    } catch (err) {
        return { success: false, message: err.message };
    }
}

module.exports = { generateAttachmentModule };
