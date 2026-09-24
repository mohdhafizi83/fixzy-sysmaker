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
    chart_bar: 'BaseReportChart',
    chart_pie: 'BaseReportChart',
    table_latest: 'BaseReportTable',
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
        filter_field: cfg.filterField,
        filter_operator: cfg.filterOperator,
        filter_value: cfg.filterValue,
        timeframe: cfg.timeframe,
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

        const classNames = [];
        const tables = (fullSchema.database && fullSchema.database.table) || {};
        widgets.forEach((cfg) => {
            const base = BASE_BY_TYPE[cfg.type] || 'BaseReportStats';
            const cls = widgetClassName(cfg);
            classNames.push(cls);
            emit(path.join(wdir, `${cls}.php`), 'app/Filament/Widgets/ReportWidget.php.njk', {
                widget: {
                    title: cfg.title,
                    class: cls,
                    base,
                    cfg: cfgPhp(cfg, tables),
                },
            });
        });

        // Dashboard page listing all widget classes.
        emit(path.join('app', 'Filament', 'Pages', 'FixzyDashboard.php'),
            'app/Filament/Pages/FixzyDashboard.php.njk', {
                widget_classes: classNames.map((c) => `            \\App\\Filament\\Widgets\\${c}::class,`).join('\n'),
                grid_columns: 2,
            });

        return { success: true, files: written };
    } catch (err) {
        return { success: false, message: err.message };
    }
}

module.exports = { generateReportModule, widgetClassName, cfgPhp };
