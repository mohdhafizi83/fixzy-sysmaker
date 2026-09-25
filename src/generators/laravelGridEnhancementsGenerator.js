/**
 * Grid Enhancements Generator (Fixzy SysMaker, grid expansion 2026-09-25).
 *
 * Emits the shared CSS asset + service provider that power the opt-in
 * grid features which have no native Filament v5 API:
 *   - Sticky column headers (table.grid_sticky_header = 1)
 *   - Row density compact/comfortable (table.grid_row_density)
 *
 * The per-table classes are applied by laravelTablesGenerator via
 * ->extraAttributes(['class' => 'fixzy-...']) on the Table, which lands
 * on the table's root .fi-ta element. This provider registers the CSS
 * through the panels::styles.after render hook (same pattern as the
 * Vite theme registration in AdminPanelProvider) so no Vite build is
 * required — the file is a plain static asset in public/.
 *
 * Files are only generated when at least one table actually uses a
 * non-default grid style, so untouched apps stay byte-identical.
 */
const fs = require('fs');
const path = require('path');

const PROVIDER_CLASS = 'App\\Providers\\FixzyGridServiceProvider';

/**
 * [IR HELPER] True when any table in the schema uses a grid style that
 * needs the shared CSS asset (sticky header, density, striping, border
 * variant, contained width, sticky toolbar/footer).
 */
function anyGridCssNeeded(fullSchema) {
    const tables = (fullSchema && fullSchema.database && fullSchema.database.table) || {};
    return Object.values(tables).some((t) =>
        Number(t.grid_sticky_header) === 1 ||
        Number(t.grid_row_striping) === 1 ||
        Number(t.grid_sticky_toolbar) === 1 ||
        Number(t.grid_sticky_footer) === 1 ||
        ['compact', 'comfortable'].includes(String(t.grid_row_density || 'normal')) ||
        ['minimal', 'none'].includes(String(t.grid_border_style || 'default')) ||
        ['contained_1280', 'contained_1600'].includes(String(t.grid_content_width || 'full'))
    );
}

const GRID_CSS = `/* Fixzy SysMaker generated grid styles (sticky header + row density). */
.fixzy-sticky-header .fi-ta-header-cell,
.fixzy-sticky-header th.fi-ta-header-cell {
    position: sticky;
    top: 0;
    z-index: 20;
    background-color: #fff;
    box-shadow: 0 1px 0 rgba(0, 0, 0, 0.08);
}
.dark .fixzy-sticky-header .fi-ta-header-cell,
.dark .fixzy-sticky-header th.fi-ta-header-cell {
    background-color: #1c1c1d;
    box-shadow: 0 1px 0 rgba(255, 255, 255, 0.08);
}
.fixzy-grid-compact .fi-ta-cell {
    padding-top: 0.25rem !important;
    padding-bottom: 0.25rem !important;
}
.fixzy-grid-compact .fi-ta-header-cell {
    padding-top: 0.375rem !important;
    padding-bottom: 0.375rem !important;
}
.fixzy-grid-comfortable .fi-ta-cell {
    padding-top: 1rem !important;
    padding-bottom: 1rem !important;
}
.fixzy-grid-comfortable .fi-ta-header-cell {
    padding-top: 1.25rem !important;
    padding-bottom: 1.25rem !important;
}

/* B1: Zebra striping. Targets tbody rows only (skips summary/group rows). */
.fixzy-grid-striped .fi-ta-table > tbody > tr.fi-ta-row:nth-child(even) {
    background-color: rgba(0, 0, 0, 0.025);
}
.dark .fixzy-grid-striped .fi-ta-table > tbody > tr.fi-ta-row:nth-child(even) {
    background-color: rgba(255, 255, 255, 0.03);
}

/* B1: Border style variants. 'minimal' = lighter dividers, 'none' = no dividers. */
.fixzy-border-minimal.fi-ta .fi-ta-content-ctn {
    --fixzy-divider: rgba(0, 0, 0, 0.045);
}
.fixzy-border-minimal.fi-ta .fi-ta-content-ctn,
.fixzy-border-minimal.fi-ta .fi-ta-table > tbody > tr > td,
.fixzy-border-minimal.fi-ta .fi-ta-table > thead > tr > th {
    border-color: var(--fixzy-divider, rgba(0, 0, 0, 0.045)) !important;
    box-shadow: none !important;
}
.dark .fixzy-border-minimal.fi-ta .fi-ta-content-ctn,
.dark .fixzy-border-minimal.fi-ta .fi-ta-table > tbody > tr > td,
.dark .fixzy-border-minimal.fi-ta .fi-ta-table > thead > tr > th {
    border-color: rgba(255, 255, 255, 0.05) !important;
}
.fixzy-border-none.fi-ta .fi-ta-content-ctn {
    border-top: none !important;
}
.fixzy-border-none.fi-ta .fi-ta-table > tbody > tr > td,
.fixzy-border-none.fi-ta .fi-ta-table > thead > tr > th {
    border-top: none !important;
    border-bottom: none !important;
    box-shadow: none !important;
}
/* The row dividers come from divide-y on the content container. */
.fixzy-border-none.fi-ta .fi-ta-content-ctn > *,
.fixzy-border-none.fi-ta .fi-ta-table > tbody > tr {
    border-top-width: 0 !important;
}

/* B2: Contained content width (centered). */
.fixzy-grid-contained_1280.fi-ta {
    max-width: 1280px;
    margin-inline: auto;
}
.fixzy-grid-contained_1600.fi-ta {
    max-width: 1600px;
    margin-inline: auto;
}

/* B3: Sticky toolbar (header) — z-index 30 so it stacks above a sticky
   header row (z-index 20) when both are enabled. */
.fixzy-sticky-toolbar.fi-ta .fi-ta-header {
    position: sticky;
    top: 0;
    z-index: 30;
    background-color: #fff;
}
.dark .fixzy-sticky-toolbar.fi-ta .fi-ta-header {
    background-color: #1c1c1d;
}
/* B3: Sticky pagination footer pinned to the bottom of the viewport while
   the table is on screen. */
.fixzy-sticky-footer.fi-ta .fi-pagination {
    position: sticky;
    bottom: 0;
    z-index: 25;
    background-color: #fff;
    border-top: 1px solid rgba(0, 0, 0, 0.08);
    padding: 0.5rem 0.75rem;
}
.dark .fixzy-sticky-footer.fi-ta .fi-pagination {
    background-color: #1c1c1d;
    border-top-color: rgba(255, 255, 255, 0.08);
}
`;

const PROVIDER_PHP = `<?php

namespace App\\Providers;

use Filament\\Support\\Facades\\FilamentView;
use Illuminate\\Support\\Facades\\Blade;
use Illuminate\\Support\\ServiceProvider;

/**
 * Fixzy SysMaker generated grid styles provider.
 *
 * Registers the static grid CSS (sticky header + row density) on every
 * Filament panel via the panels::styles.after render hook. Generated only
 * when at least one table enables a non-default grid style.
 */
class FixzyGridServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        FilamentView::registerRenderHook(
            'panels::styles.after',
            fn () => Blade::render('<link rel="stylesheet" href="' . asset('css/fixzy-grid.css') . '?v=1">'),
        );
    }
}
`;

/**
 * [MODULE GENERATOR] Write the CSS asset and service provider into the
 * generated app, register the provider in bootstrap/providers.php and in
 * fixzy-manifest.json (same pattern as the Activity Log module).
 */
function generateGridEnhancements(fullSchema, outputDir) {
    try {
        if (!anyGridCssNeeded(fullSchema)) {
            return { success: true, skipped: true, message: 'No grid styles needed.' };
        }

        // 1. Static CSS asset
        const cssDir = path.join(outputDir, 'public', 'css');
        fs.mkdirSync(cssDir, { recursive: true });
        fs.writeFileSync(path.join(cssDir, 'fixzy-grid.css'), GRID_CSS);

        // 2. Service provider
        const providersDir = path.join(outputDir, 'app', 'Providers');
        fs.mkdirSync(providersDir, { recursive: true });
        fs.writeFileSync(path.join(providersDir, 'FixzyGridServiceProvider.php'), PROVIDER_PHP);

        // 3. Register in bootstrap/providers.php (full-app target)
        const providersFile = path.join(outputDir, 'bootstrap', 'providers.php');
        if (fs.existsSync(providersFile)) {
            let contents = fs.readFileSync(providersFile, 'utf8');
            if (!contents.includes('FixzyGridServiceProvider')) {
                contents = contents.replace(
                    /return\s*\[/,
                    'return [\n    App\\Providers\\FixzyGridServiceProvider::class,'
                );
                fs.writeFileSync(providersFile, contents);
            }
        }

        // 4. Manifest (preview/deploy flow registers providers from here)
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
        if (!manifest.providers.includes(PROVIDER_CLASS)) manifest.providers.push(PROVIDER_CLASS);
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

        return { success: true, message: 'Grid enhancements (sticky/density CSS) generated.' };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

module.exports = { generateGridEnhancements, anyGridCssNeeded };
