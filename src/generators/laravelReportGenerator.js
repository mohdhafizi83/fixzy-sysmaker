// laravelReportGenerator.js — emits the Reports & Charts module when the
// Dashboard Builder contains at least one valid widget
// (fullSchema.database.widgets):
//   - app/Filament/Widgets/ReportQuery.php        (shared filter compiler)
//   - app/Filament/Widgets/BaseReportChart.php    (chart base)
//   - app/Filament/Widgets/BaseReportStats.php    (stat card base)
//   - app/Filament/Widgets/BaseReportTable.php    (latest-records base)
//   - app/Filament/Widgets/Report_<id>.php        (one per widget, compiled cfg)
//   - app/Filament/Pages/FixzyDashboard.php       (renders the widgets)
//
// The AdminPanelProvider swaps the stock Dashboard for FixzyDashboard
// (see laravelAdminPanelGenerator dashboard_class).
//
// Security model: each widget's compiled config is baked into a
// protected static PHP property at generation time — it never travels
// in the Livewire payload, so a tampered browser cannot change which
// table/column a report reads. Identifiers are additionally validated
// against the live schema at query time (ReportQuery).

const fs = require('fs');
const path = require('path');
const { renderTemplate } = require('../render/engine');
const { collectReportWidgets } = require('./reportConfig');

const BASE_BY_TYPE = {
    stats: 'BaseReportStats',
    table_latest: 'BaseReportTable',
    chart_bar: 'BaseReportChart',
    chart_pie: 'BaseReportChart',
    chart_doughnut: 'BaseReportChart',
    chart_polar: 'BaseReportChart',
    chart_line: 'BaseReportChart',
    chart_area: 'BaseReportChart',
    chart_combo: 'BaseReportChart',
    chart_radar: 'BaseReportChart',
    chart_scatter: 'BaseReportChart',
    chart_bubble: 'BaseReportChart',
};

// PHP literal for any JSON-safe value (scalars + nested arrays/objects).
function phpLiteral(v) {
    if (v === null || v === undefined) return 'null';
    if (Array.isArray(v)) {
        return '[' + v.map(phpLiteral).join(', ') + ']';
    }
    if (typeof v === 'object') {
        const parts = Object.keys(v).map((k) => `${JSON.stringify(String(k))} => ${phpLiteral(v[k])}`);
        return '[' + parts.join(', ') + ']';
    }
    return JSON.stringify(v);
}

// PHP literal for one widget's compiled config (pretty-printed array).
// reportConfig.js uses camelCase keys; the generated PHP registry uses
// snake_case (consumed by ReportQuery / widget bases). `tables` is the
// IR table map, used to bake the Eloquent model class name for the
// latest-records widget (Filament TableWidget requires Eloquent).
function cfgPhp(cfg, tables) {
    const { getModelClassName } = require('./laravelDatabaseGenerator');
    const map = {
        id: cfg.id,
        title: cfg.title,
        type: cfg.type,
        table: cfg.table,
        model: cfg.table && tables[cfg.table] ? 'App\\Models\\' + getModelClassName(cfg.table, tables) : null,
        width: cfg.width,
        color: cfg.color,
        icon: cfg.icon,
        aggregate: cfg.aggregate,
        label_field: cfg.labelField,
        value_field: cfg.valueField,
        series_field: cfg.seriesField,
        size_field: cfg.sizeField,
        series_aggregate: cfg.seriesAggregate,
        filter_field: cfg.filterField,
        filter_operator: cfg.filterOperator,
        filter_value: cfg.filterValue,
        timeframe: cfg.timeframe,
        refresh_mode: cfg.refreshMode,
        refresh_interval: String(cfg.refreshInterval),
        advanced: cfg.advanced,
    };
    const lines = Object.keys(map).map((k) => {
        const v = map[k] === null || map[k] === undefined ? 'null' : phpLiteral(map[k]);
        return `        '${k}' => ${v},`;
    });
    return "[\n" + lines.join('\n') + "\n    ]";
}

function widgetClassName(cfg) {
    // Deterministic, valid PHP class name derived from the widget id.
    const id = String(cfg.id || '').replace(/[^A-Za-z0-9]/g, '');
    return `Report_${id || 'Widget'}`;
}

// Nunjucks autoescape is OFF (templates emit code), so any user-supplied
// string interpolated into Blade/HTML must be escaped here at generation.
function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function generateReportModule(fullSchema, outputDir) {
    try {
        const written = [];
        const widgets = collectReportWidgets(fullSchema);
        if (widgets.length === 0) {
            return { success: true, files: [], skipped: true };
        }

        const emit = (relPath, template, context) => {
            const abs = path.join(outputDir, relPath);
            fs.mkdirSync(path.dirname(abs), { recursive: true });
            if (fs.existsSync(abs)) return; // idempotent re-generation
            fs.writeFileSync(abs, renderTemplate(template, context || {}));
            written.push(relPath);
        };

        const wdir = path.join('app', 'Filament', 'Widgets');
        emit(path.join(wdir, 'ReportQuery.php'), 'app/Filament/Widgets/ReportQuery.php.njk');
        emit(path.join(wdir, 'BaseReportChart.php'), 'app/Filament/Widgets/BaseReportChart.php.njk');
        emit(path.join(wdir, 'BaseReportStats.php'), 'app/Filament/Widgets/BaseReportStats.php.njk');
        emit(path.join(wdir, 'BaseReportTable.php'), 'app/Filament/Widgets/BaseReportTable.php.njk');

        const LIVE_VIEW_BY_BASE = {
            BaseReportChart: 'live-chart',
            BaseReportStats: 'live-stats',
            BaseReportTable: 'live-table',
        };
        const tables = (fullSchema.database && fullSchema.database.table) || {};
        const liveTables = new Set();

        const classNames = [];
        widgets.forEach((cfg) => {
            const base = BASE_BY_TYPE[cfg.type] || 'BaseReportStats';
            const cls = widgetClassName(cfg);
            classNames.push(cls);
            const isLive = cfg.refreshMode === 'live';
            if (isLive) liveTables.add(cfg.table);
            emit(path.join(wdir, `${cls}.php`), 'app/Filament/Widgets/ReportWidget.php.njk', {
                widget: {
                    title: cfg.title,
                    class: cls,
                    base,
                    cfg: cfgPhp(cfg, tables),
                    live_view: isLive ? LIVE_VIEW_BY_BASE[base] : '',
                },
            });
        });

        // Live widgets need the real-time transport: auto-enable the
        // module_realtime flag so the realtime generator (running later
        // in the stack) emits the Echo client + channel auth. The flag
        // lives on the shared fullSchema object.
        if (liveTables.size > 0) {
            fullSchema.project = fullSchema.project || {};
            fullSchema.project.module_realtime = 1;

            // Broadcast event + debounced observer + provider that
            // attaches the observer to each live source table's model.
            emit(path.join('app', 'Events', 'DataChanged.php'), 'app/Events/DataChanged.php.njk');
            emit(path.join('app', 'Observers', 'FixzyLiveObserver.php'), 'app/Observers/FixzyLiveObserver.php.njk');
            const { getModelClassName } = require('./laravelDatabaseGenerator');
            const modelClasses = [...liveTables]
                .filter((t) => tables[t])
                .map((t) => `'${t}' => \\App\\Models\\${getModelClassName(t, tables)}::class,`);
            emit(
                path.join('app', 'Providers', 'LiveDashboardServiceProvider.php'),
                'app/Providers/LiveDashboardServiceProvider.php.njk',
                { model_map: modelClasses.join('\n        ') }
            );

            // Wrapper views (Echo subscription layer) — written once.
            const vdir = path.join('resources', 'views', 'filament', 'widgets');
            emit(path.join(vdir, 'live-chart.blade.php'), 'resources/views/filament/widgets/live-chart.blade.php.njk');
            emit(path.join(vdir, 'live-stats.blade.php'), 'resources/views/filament/widgets/live-stats.blade.php.njk');
            emit(path.join(vdir, 'live-table.blade.php'), 'resources/views/filament/widgets/live-table.blade.php.njk');

            // Register the provider in bootstrap/providers.php (full app).
            const providersFile = path.join(outputDir, 'bootstrap', 'providers.php');
            if (fs.existsSync(providersFile)) {
                let contents = fs.readFileSync(providersFile, 'utf8');
                if (!contents.includes('LiveDashboardServiceProvider')) {
                    contents = contents.replace(
                        /return\s*\[/,
                        'return [\n    App\\Providers\\LiveDashboardServiceProvider::class,'
                    );
                    fs.writeFileSync(providersFile, contents);
                }
            }

            // Manifest: deploy flow must register the provider too.
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
                } catch (e) { /* fresh */ }
            }
            const liveProv = 'App\\Providers\\LiveDashboardServiceProvider';
            if (!manifest.providers.includes(liveProv)) manifest.providers.push(liveProv);
            fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        }

        // Dashboard page listing all widget classes.
        emit(path.join('app', 'Filament', 'Pages', 'FixzyDashboard.php'),
            'app/Filament/Pages/FixzyDashboard.php.njk', {
                widget_classes: classNames.map((c) => `            \\App\\Filament\\Widgets\\${c}::class,`).join('\n'),
                grid_columns: 2,
            });

        // Kiosk display mode: wall/TV presentation of the same widgets.
        const kioskEnabled = Number((fullSchema.project || {}).kiosk_enabled) === 1;
        if (kioskEnabled) {
            emit(path.join('app', 'Filament', 'Pages', 'KioskDashboard.php'),
                'app/Filament/Pages/KioskDashboard.php.njk', {
                    widget_classes: classNames.map((c) => `            \\App\\Filament\\Widgets\\${c}::class,`).join('\n'),
                });
            const rotate = Math.max(5, parseInt(fullSchema.project.kiosk_rotate_seconds, 10) || 15);
            const pageSize = Math.max(1, Math.min(12, parseInt(fullSchema.project.kiosk_page_size, 10) || 4));
            emit(path.join('resources', 'views', 'filament', 'pages', 'kiosk.blade.php'),
                'resources/views/filament/pages/kiosk.blade.php.njk', {
                    app_title: escapeHtml(String((fullSchema.project && fullSchema.project.app_title) || 'Dashboard')),
                    kiosk_rotate_seconds: rotate,
                    kiosk_page_size: pageSize,
                });
        }

        return { success: true, files: written };
    } catch (err) {
        return { success: false, message: err.message };
    }
}

module.exports = { generateReportModule, widgetClassName, cfgPhp };
