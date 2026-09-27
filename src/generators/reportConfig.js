// reportConfig.js — IR helpers for the Reports & Charts module.
//
// Source: project_widgets rows (Dashboard Builder), surfaced in the IR
// as fullSchema.database.widgets. Each widget:
//   {
//     id, title, widget_type: 'stats'|'chart_bar'|'chart_pie'|'table_latest',
//     target_table, target_field, aggregate_type: 'count'|'sum'|'avg',
//     width_span: '1'|'2'|'full', color, icon,
//     chart_label_column,            // X-axis group-by (charts)
//     filter_field, filter_operator, filter_value,   // basic filter
//     timeframe_range: 'all'|'today'|'this_month'|'this_year',
//     advanced_query                 // JSON state from Query Builder
//   }
//
// The module compiles these into a static registry baked into a
// ReportsPage (no runtime IR lookup), executed with Laravel query
// builder against the real tables.

const NUMERIC_TYPES = ['INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'DECIMAL', 'FLOAT', 'DOUBLE', 'NUMBER', 'NUMERIC'];
const DATE_TYPES = ['DATE', 'DATETIME', 'TIMESTAMP'];
const AGGREGATES = ['count', 'sum', 'avg'];
const TIMEFRAMES = ['all', 'today', 'this_month', 'this_year'];
const OPERATORS = ['=', '!=', '>', '<', '>=', '<=', 'LIKE'];
const WIDGET_TYPES = [
    'stats', 'table_latest',
    'chart_bar', 'chart_pie', 'chart_doughnut', 'chart_polar',
    'chart_line', 'chart_area', 'chart_combo',
    'chart_radar', 'chart_scatter', 'chart_bubble',
];
// Grouped charts: label column (group-by) + aggregate over value field.
const GROUPED_CHARTS = ['chart_bar', 'chart_pie', 'chart_doughnut', 'chart_polar', 'chart_line', 'chart_area', 'chart_radar'];
// Charts needing a second numeric field (target_field = X, chart_series_field = Y).
const XY_CHARTS = ['chart_scatter', 'chart_bubble'];

/** True when a SQL data type is numeric (INT/DECIMAL/FLOAT/...). @param {string} t data_type string @returns {boolean} */
function isNumericType(t) {
    return NUMERIC_TYPES.includes((t || '').toUpperCase());
}
/** True when a SQL data type is date-like (DATE/DATETIME/TIMESTAMP). @param {string} t data_type string @returns {boolean} */
function isDateType(t) {
    return DATE_TYPES.includes((t || '').toUpperCase());
}

// Validate one widget row against the schema. Returns a cleaned config
// or null when the widget references something that doesn't exist
// (stale widget after a table/field delete — skip, don't crash).
/**
 * @param {object} widget project_widgets row
 * @param {object} tables schema tables map (for field validation)
 * @returns {object|null} cleaned widget config or null when invalid/stale
 */
function parseReportWidget(widget, tables) {
    if (!widget || !WIDGET_TYPES.includes(widget.widget_type)) return null;
    const tableName = widget.target_table;
    const table = tables && tables[tableName];
    if (!table) return null;
    const fields = table.fields || {};

    const cfg = {
        id: widget.id,
        title: String(widget.title || 'Report').slice(0, 120),
        type: widget.widget_type,
        table: tableName,
        width: ['1', '2', 'full'].includes(String(widget.width_span)) ? String(widget.width_span) : '1',
        color: ['primary', 'success', 'danger', 'warning', 'info', 'gray'].includes(widget.color) ? widget.color : 'primary',
        icon: String(widget.icon || '').startsWith('heroicon-') ? widget.icon : '',
        aggregate: AGGREGATES.includes(widget.aggregate_type) ? widget.aggregate_type : 'count',
        labelField: '',
        valueField: '',
        seriesField: '',
        sizeField: '',
        seriesAggregate: 'sum',
        filterField: '',
        filterOperator: '',
        filterValue: '',
        timeframe: TIMEFRAMES.includes(widget.timeframe_range) ? widget.timeframe_range : 'all',
        refreshMode: ['static', 'poll', 'live'].includes(widget.refresh_mode) ? widget.refresh_mode : 'static',
        refreshInterval: Math.min(300, Math.max(2, parseInt(widget.refresh_interval, 10) || 10)),
        advanced: null,
    };

    if (XY_CHARTS.includes(cfg.type)) {
        // Scatter/bubble: raw numeric X/Y pairs (no aggregation).
        const xf = fields[widget.target_field];
        const yf = fields[widget.chart_series_field];
        if (!xf || !isNumericType(xf.data_type)) return null;
        if (!yf || !isNumericType(yf.data_type)) return null;
        cfg.valueField = widget.target_field;   // X axis
        cfg.seriesField = widget.chart_series_field; // Y axis
        if (cfg.type === 'chart_bubble') {
            const sf = fields[widget.chart_size_field];
            if (!sf || !isNumericType(sf.data_type)) return null;
            cfg.sizeField = widget.chart_size_field;
        }
    } else {
        // Value field (sum/avg) must be numeric.
        if (cfg.aggregate === 'sum' || cfg.aggregate === 'avg') {
            const vf = fields[widget.target_field];
            if (!vf || !isNumericType(vf.data_type)) return null;
            cfg.valueField = widget.target_field;
        }
        // Grouped charts need a group-by label column.
        if (GROUPED_CHARTS.includes(cfg.type)) {
            const lf = fields[widget.chart_label_column];
            if (!lf) return null;
            cfg.labelField = widget.chart_label_column;
        }
        // Combo: bar series (aggregate over value field) + line overlay
        // (aggregate over the second numeric field).
        if (cfg.type === 'chart_combo') {
            const lf = fields[widget.chart_label_column];
            if (!lf) return null;
            cfg.labelField = widget.chart_label_column;
            const sf = fields[widget.chart_series_field];
            if (!sf || !isNumericType(sf.data_type)) return null;
            cfg.seriesField = widget.chart_series_field;
            cfg.seriesAggregate = AGGREGATES.includes(widget.series_aggregate_type) ? widget.series_aggregate_type : 'sum';
            if (cfg.seriesAggregate === 'count') cfg.seriesAggregate = 'sum'; // count makes no sense per-series
        }
    }

    // Basic filter (optional).
    if (widget.filter_field && fields[widget.filter_field] && OPERATORS.includes(widget.filter_operator)) {
        cfg.filterField = widget.filter_field;
        cfg.filterOperator = widget.filter_operator;
        cfg.filterValue = String(widget.filter_value ?? '').slice(0, 200);
    }

    // Advanced query state (optional). Only keep the filters group —
    // selected fields/sorting from the builder are irrelevant here.
    if (widget.advanced_query) {
        try {
            const st = JSON.parse(widget.advanced_query);
            if (st && st.filters && Array.isArray(st.filters.rules) && st.filters.rules.length > 0) {
                cfg.advanced = st.filters;
            }
        } catch (e) { /* malformed → ignore advanced, keep basic */ }
    }

    return cfg;
}

// Collect all valid report widgets from the IR.
/** @param {object} fullSchema @returns {object[]} valid widget configs */
function collectReportWidgets(fullSchema) {
    const widgets = (fullSchema && fullSchema.database && fullSchema.database.widgets) || [];
    const tables = (fullSchema && fullSchema.database && fullSchema.database.table) || {};
    return widgets.map((w) => parseReportWidget(w, tables)).filter(Boolean);
}

/** @param {object} fullSchema @returns {boolean} true if any valid report widget exists */
function anyReportsEnabled(fullSchema) {
    return collectReportWidgets(fullSchema).length > 0;
}

// PHP literal for the compiled registry (one entry per widget).
/** @param {object[]} cfgs cleaned widget configs @returns {string} PHP array literal of registry entries */
function reportRegistryPhp(cfgs) {
    const entries = cfgs.map((c) => {
        const parts = [];
        parts.push(`'id' => ${JSON.stringify(String(c.id))}`);
        parts.push(`'title' => ${JSON.stringify(c.title)}`);
        parts.push(`'type' => ${JSON.stringify(c.type)}`);
        parts.push(`'table' => ${JSON.stringify(c.table)}`);
        parts.push(`'width' => ${JSON.stringify(c.width)}`);
        parts.push(`'color' => ${JSON.stringify(c.color)}`);
        parts.push(`'icon' => ${JSON.stringify(c.icon)}`);
        parts.push(`'aggregate' => ${JSON.stringify(c.aggregate)}`);
        parts.push(`'label_field' => ${JSON.stringify(c.labelField)}`);
        parts.push(`'value_field' => ${JSON.stringify(c.valueField)}`);
        parts.push(`'series_field' => ${JSON.stringify(c.seriesField)}`);
        parts.push(`'size_field' => ${JSON.stringify(c.sizeField)}`);
        parts.push(`'series_aggregate' => ${JSON.stringify(c.seriesAggregate)}`);
        parts.push(`'filter_field' => ${JSON.stringify(c.filterField)}`);
        parts.push(`'filter_operator' => ${JSON.stringify(c.filterOperator)}`);
        parts.push(`'filter_value' => ${JSON.stringify(c.filterValue)}`);
        parts.push(`'timeframe' => ${JSON.stringify(c.timeframe)}`);
        parts.push(`'refresh_mode' => ${JSON.stringify(c.refreshMode)}`);
        parts.push(`'refresh_interval' => ${JSON.stringify(String(c.refreshInterval))}`);
        parts.push(`'advanced' => ${c.advanced ? JSON.stringify(c.advanced) : 'null'}`);
        return '        [' + parts.join(', ') + '],';
    });
    return "[\n" + entries.join('\n') + "\n    ]";
}

module.exports = {
    parseReportWidget,
    collectReportWidgets,
    anyReportsEnabled,
    reportRegistryPhp,
    isNumericType,
    isDateType,
};
