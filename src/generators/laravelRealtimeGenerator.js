// Real-time notifications & chat codegen (plug & play).
//
// Driven by project flags module_realtime / realtime_backend:
//
//   Native first (no extra composer package needed for the core):
//     - Filament v5 ->databaseNotifications() (live bell, wired in
//       AdminPanelProvider template)
//     - Laravel native broadcasting facade + private channels
//     - notifications table already ships with the boilerplate
//
//   Third-party ONLY for the WebSocket transport (no native alternative):
//     reverb -> laravel/reverb  (first-party Laravel WebSocket server)
//     pusher -> pusher/pusher-php-server (official Pusher PHP SDK)
//
//   Frontend (no npm build in the generated app):
//     pusher-js + laravel-echo pinned CDN builds with SRI integrity,
//     injected via a panel render hook by RealtimeServiceProvider.
//
// Credentials are NEVER baked into code: the generated app ships a
// "Real-time" settings page; values live in fixzy_settings at runtime.
//
// A fixzy-manifest-<name>.json fragment is merged into fixzy-manifest.json
// by the orchestrator so deploy auto-installs the right packages.

'use strict';

const fs = require('fs');
const path = require('path');
const { renderTemplate } = require('../render/engine');

function isRealtimeEnabled(fullSchema) {
    return Number((fullSchema.project || {}).module_realtime) === 1;
}

function backendOf(fullSchema) {
    const b = String((fullSchema.project || {}).realtime_backend || 'reverb');
    return b === 'pusher' ? 'pusher' : 'reverb';
}

function writeIf(dir, file, content) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, file), content);
}

function generateRealtimeModule(fullSchema, outputDir) {
    try {
        if (!isRealtimeEnabled(fullSchema)) {
            return { success: true, composerPackages: [], npmPackages: [], backend: null };
        }

        const backend = backendOf(fullSchema);
        const composerPackages = [];
        const npmPackages = ['pusher-js@8.6.0', 'laravel-echo@2.5.0'];

        if (backend === 'reverb') {
            composerPackages.push('laravel/reverb');
        } else {
            composerPackages.push('pusher/pusher-php-server');
        }

        // Settings store (idempotent — same fixed filenames as the auth
        // integrations / workflow generators).
        const settingsModel = path.join(outputDir, 'app', 'Models', 'FixzySetting.php');
        if (!fs.existsSync(settingsModel)) {
            writeIf(
                path.join(outputDir, 'app', 'Models'),
                'FixzySetting.php',
                renderTemplate('app/Models/FixzySetting.php.njk', {})
            );
            const migDir = path.join(outputDir, 'database', 'migrations');
            const migFile = path.join(migDir, '2026_09_22_000001_create_fixzy_settings_table.php');
            if (!fs.existsSync(migFile)) {
                writeIf(
                    migDir,
                    '2026_09_22_000001_create_fixzy_settings_table.php',
                    renderTemplate('database/migrations/create_fixzy_settings_table.php.njk', {})
                );
            }
        }

        // Chat module: model + migration + event + Filament page.
        writeIf(
            path.join(outputDir, 'database', 'migrations'),
            '2026_09_23_000001_create_chat_messages_table.php',
            renderTemplate('database/migrations/create_chat_messages_table.php.njk', {})
        );
        writeIf(
            path.join(outputDir, 'app', 'Models'),
            'ChatMessage.php',
            renderTemplate('app/Models/ChatMessage.php.njk', {})
        );
        writeIf(
            path.join(outputDir, 'app', 'Events'),
            'ChatMessageCreated.php',
            renderTemplate('app/Events/ChatMessageCreated.php.njk', {})
        );
        writeIf(
            path.join(outputDir, 'app', 'Filament', 'Pages'),
            'Chat.php',
            renderTemplate('app/Filament/Pages/Chat.php.njk', {})
        );
        writeIf(
            path.join(outputDir, 'resources', 'views', 'filament', 'pages'),
            'chat.blade.php',
            renderTemplate('resources/views/filament/pages/chat.blade.php.njk', {})
        );

        // Admin settings page for broadcast credentials.
        writeIf(
            path.join(outputDir, 'app', 'Filament', 'Pages'),
            'RealtimeSettings.php',
            renderTemplate('app/Filament/Pages/RealtimeSettings.php.njk', { backend })
        );
        writeIf(
            path.join(outputDir, 'resources', 'views', 'filament', 'pages'),
            'realtime-settings.blade.php',
            renderTemplate('resources/views/filament/pages/realtime-settings.blade.php.njk', { backend })
        );

        // Provider: runtime broadcast config + channel auth + Echo client.
        writeIf(
            path.join(outputDir, 'app', 'Providers'),
            'RealtimeServiceProvider.php',
            renderTemplate('app/Providers/RealtimeServiceProvider.php.njk', { backend })
        );

        // Register in bootstrap/providers.php when generating into a full app.
        const providersFile = path.join(outputDir, 'bootstrap', 'providers.php');
        if (fs.existsSync(providersFile)) {
            let contents = fs.readFileSync(providersFile, 'utf8');
            if (!contents.includes('RealtimeServiceProvider')) {
                contents = contents.replace(
                    /return\s*\[/,
                    'return [\n    App\\Providers\\RealtimeServiceProvider::class,'
                );
                fs.writeFileSync(providersFile, contents);
            }
        }

        // Manifest fragment for the deploy flow (auto composer require).
        // Merge-friendly: the orchestrator merges with the auth manifest if
        // both generators ran.
        const manifestPath = path.join(outputDir, 'fixzy-manifest.json');
        let manifest = { composer: [], php_extensions: [], npm: [], providers: [] };
        if (fs.existsSync(manifestPath)) {
            try {
                const existing = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                // Older manifests may lack newer arrays — normalize.
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
        for (const pkg of composerPackages) {
            if (!manifest.composer.includes(pkg)) manifest.composer.push(pkg);
        }
        for (const pkg of npmPackages) {
            if (!manifest.npm.includes(pkg)) manifest.npm.push(pkg);
        }
        // Providers the deploy flow must register in bootstrap/providers.php
        // (the staging folder has no providers.php of its own).
        for (const prov of ['App\\Providers\\RealtimeServiceProvider']) {
            if (!manifest.providers.includes(prov)) manifest.providers.push(prov);
        }
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

        return { success: true, composerPackages, npmPackages, backend };
    } catch (error) {
        console.error('Failed to generate real-time module:', error);
        return { success: false, message: error.message };
    }
}

module.exports = { generateRealtimeModule, isRealtimeEnabled, backendOf };
