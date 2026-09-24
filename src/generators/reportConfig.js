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
const WIDGET_TYPES = ['stats', 'chart_bar', 'chart_pie', 'table_latest'];

function isNumericType(t) {
    return NUMERIC_TYPES.includes((t || '').toUpperCase());
}
function isDateType(t) {
    return DATE_TYPES.includes((t || '').toUpperCase());
}

// Validate one widget row against the schema. Returns a cleaned config
// or null when the widget references something that doesn't exist
// (stale widget after a table/field delete — skip, don't crash).
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
        filterField: '',
        filterOperator: '',
        filterValue: '',
        timeframe: TIMEFRAMES.includes(widget.timeframe_range) ? widget.timeframe_range : 'all',
        advanced: null,
    };

    // Value field (sum/avg) must be numeric.
    if (cfg.aggregate === 'sum' || cfg.aggregate === 'avg') {
        const vf = fields[widget.target_field];
        if (!vf || !isNumericType(vf.data_type)) return null;
        cfg.valueField = widget.target_field;
    }

    // Chart group-by label column must exist.
    if (cfg.type === 'chart_bar' || cfg.type === 'chart_pie') {
        const lf = fields[widget.chart_label_column];
        if (!lf) return null;
        cfg.labelField = widget.chart_label_column;
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
function collectReportWidgets(fullSchema) {
    const widgets = (fullSchema && fullSchema.database && fullSchema.database.widgets) || [];
    const tables = (fullSchema && fullSchema.database && fullSchema.database.table) || {};
    return widgets.map((w) => parseReportWidget(w, tables)).filter(Boolean);
}

function anyReportsEnabled(fullSchema) {
    return collectReportWidgets(fullSchema).length > 0;
}

// PHP literal for the compiled registry (one entry per widget).
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
        parts.push(`'filter_field' => ${JSON.stringify(c.filterField)}`);
        parts.push(`'filter_operator' => ${JSON.stringify(c.filterOperator)}`);
        parts.push(`'filter_value' => ${JSON.stringify(c.filterValue)}`);
        parts.push(`'timeframe' => ${JSON.stringify(c.timeframe)}`);
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
