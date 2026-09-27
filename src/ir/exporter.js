// IR exporter: converts the app's full-schema dump (SQLite shape) into the
// stack-neutral IR defined in docs/IR_SCHEMA.json.
//
// The IR is the ONLY structure Phase 2+ generators should consume.
// Maker/Filament vocabulary is normalized here; anything stack-specific that
// can't be normalized must be added to the presentation bag, never to core.

'use strict';

const { resolveTheme } = require('../core/theme');

// --- display_type (maker vocabulary) -> neutral input_kind -------------------
const INPUT_KIND_MAP = {
    text_input: 'text',
    text_area: 'textarea',
    textarea: 'textarea',
    number: 'number',
    integer: 'integer',
    decimal: 'decimal',
    currency: 'decimal',
    boolean: 'boolean',
    yes_no: 'boolean',
    toggle: 'boolean',
    options_list: 'select',
    select: 'select',
    multiple_select: 'multiselect',
    checkbox_list: 'multiselect',
    tags_input: 'multiselect',
    date: 'date',
    time: 'time',
    datetime: 'datetime',
    date_time: 'datetime',
    file_upload: 'file',
    image_upload: 'image',
    repeater: 'repeater',
    repeater_simple: 'repeater',
    calculated: 'calculated',
    lookup: 'lookup',
    email: 'email',
    url: 'url',
    password: 'password',
    hidden: 'hidden',
    color: 'color',
};

function toInputKind(displayType) {
    if (!displayType) return 'text';
    return INPUT_KIND_MAP[String(displayType).toLowerCase()] || 'other';
}

// --- tenancy / ownership ----------------------------------------------------
function mapOwnership(project, table) {
    const tenancy = (project.tenancy_type || 'standard').toLowerCase();
    const ownership = {
        model: tenancy === 'one_to_many' ? 'tenant_single'
             : tenancy === 'many_to_many' ? 'tenant_multi'
             : 'none',
        tenant_entity: project.tenant_table || null,
    };
    if (table && table.record_owner === 'current_user') {
        ownership.row_owner = 'authenticated_user';
    }
    return ownership;
}

function mapIntegrity(v) {
    const s = String(v || 'NO ACTION').toUpperCase().replace(/\s+/g, '_').toLowerCase();
    const known = ['cascade', 'set_null', 'restrict', 'no_action'];
    return known.includes(s) ? s : 'no_action';
}

// --- fields -----------------------------------------------------------------
function exportField(f) {
    const out = {
        id: f.field_id,
        name: f.field_name,
        caption: f.caption ?? null,
        description: f.description ?? null,
        input_kind: toInputKind(f.display_type),
        data_type: f.data_type || 'VARCHAR',
        length: f.length ?? null,
        precision: f.precision ?? null,
        required: !!f.required,
        primary_key: !!f.primary_key,
        auto_increment: !!f.auto_increment,
        unique: !!f.unique,
        not_null: !!f.not_null,
        unsigned: !!f.unsigned,
        binary: !!f.binary,
        indexed: !!f.is_indexed,
        read_only: !!f.read_only,
        default_value: f.default_value ?? null,
        helper_text: f.helper_text ?? null,
        placeholder: f.placeholder ?? null,
        min_length: f.min_length ?? null,
        max_length: f.max_length ?? null,
        min_value: f.min_value ?? null,
        max_value: f.max_value ?? null,
    };

    if (f.options_list_values != null || f.boolean_label_true != null) {
        out.options = {
            values: f.options_list_values ?? null,
            display: f.options_display ?? null,
            true_label: f.boolean_label_true ?? null,
            false_label: f.boolean_label_false ?? null,
        };
    }
    if (f.format_as || f.format_mask || f.prefix || f.suffix || f.tv_currency_code) {
        out.format = {
            as: f.format_as ?? null,
            mask: f.format_mask ?? null,
            prefix: f.prefix ?? null,
            suffix: f.suffix ?? null,
            currency: f.tv_currency_code ?? null,
        };
    }
    if (f.calculated_enable || f.algorithm_enable) {
        out.calculation = {
            query: f.calculated_query ?? null,
            algorithm: f.algorithm_logic ?? null,
            builder_state: f.calculation_builder_state ?? null,
        };
    }
    if (f.lookup_parent_table) {
        out.lookup = {
            parent_entity: f.lookup_parent_table,
            caption_fields: [f.lookup_caption_1, f.lookup_caption_2].filter(Boolean),
            separator: f.lookup_separator ?? null,
            searchable: !!f.lookup_searchable,
            preload: !!f.lookup_preload,
            custom_query: f.lookup_custom_query ?? null,
        };
    }
    if (f.allow_image_uploads || f.allow_file_uploads) {
        out.media = {
            kind: f.allow_image_uploads ? 'image' : 'file',
            storage: f.image_storage_provider || f.file_storage_provider || 'local',
            max_size_kb: f.max_file_size ?? f.file_max_size ?? null,
            allowed_types: f.file_types ?? null,
            delete_on_remove: !!(f.delete_image_server || f.delete_file_server),
            keep_original_name: !!(f.dont_rename_image || f.dont_rename_file),
        };
    }

    // Presentation bag: maker display hints, stack-ignorable.
    const pres = {};
    for (const [k, v] of Object.entries(f)) {
        if (/^(tv_|dv_)/.test(k) || ['alignment', 'zero_fill', 'show_sum', 'show_avg_summary',
            'show_count_summary', 'show_range_summary', 'allow_sorting', 'column_span_full',
            'media_type', 'media_link_behavior', 'media_link_display_as', 'media_link_other_field',
            'file_behavior', 'file_display_as', 'file_other_field', 'display_gmap', 'gmap_type',
            'gmap_tv_width', 'gmap_tv_height', 'gmap_dv_height', 'accept_video_url',
            'youtube_tv_width', 'youtube_tv_height', 'youtube_dv_width', 'youtube_dv_height',
            'off_autocomplete', 'suffix_icon', 'suffix_icon_color',
            'repeater_simple_display_as', 'repeater_simple_format_as', 'repeater_simple_list_values',
            'repeater_1_display_as', 'repeater_1_format_as', 'repeater_1_list_values',
            'repeater_2_display_as', 'repeater_2_format_as', 'repeater_2_list_values',
            'repeater_3_display_as', 'repeater_3_format_as', 'repeater_3_list_values',
            'repeater_simple_required', 'repeater_1_required', 'repeater_2_required',
            'repeater_3_required'].includes(k)) {
            pres[k] = v;
        }
    }
    if (Object.keys(pres).length) out.presentation = pres;
    return out;
}

// --- entities ---------------------------------------------------------------
function exportEntity(name, t) {
    const fields = Object.values(t.fields || {})
        .sort((a, b) => (a.field_order ?? 0) - (b.field_order ?? 0))
        .map(exportField);

    const ent = {
        id: t.table_id,
        name,
        display_name: t.module_name ?? null,
        titles: {
            list: t.table_view_title ?? null,
            detail: t.detail_view_title ?? null,
            description: t.table_description ?? null,
        },
        capabilities: {
            search: !!t.show_quick_search,
            pagination: t.allow_pagination ? (t.pagination_type || 'standard') : false,
            import: !!t.allow_csv_import,
            export: !!t.allow_csv_export,
            print: !!t.allow_print_view,
            bulk_delete: !!t.allow_mass_delete,
            detail_view: !!t.enable_detail_view,
        },
        default_sort: t.default_sort_by
            ? { field: t.default_sort_by, direction: t.sort_descending ? 'desc' : 'asc' }
            : null,
        cascade: { delete_children: !!t.delete_with_children },
        ownership: {
            row_owner: t.record_owner === 'current_user' ? 'authenticated_user' : null,
            owner_fk_value: t.owner_fk_value ?? null,
        },
        constraints: (t.constraints || []).map((c) => ({
            name: c.constraint_name ?? null,
            type: String(c.constraint_type || 'UNIQUE').toLowerCase() === 'primary key' ? 'primary' : 'unique',
            columns: typeof c.columns === 'string' ? JSON.parse(c.columns) : (c.columns || []),
        })),
        fields,
    };

    const pres = {};
    for (const k of ['tv_template', 'column_grid_type', 'static_grid_columns',
        'hide_field_captions', 'use_first_field_as_title', 'table_view_classes_input',
        'detail_view_classes_input', 'default_focus', 'redirect_after_insert',
        'dv_separate_page', 'dv_hide_save_as_copy', 'dv_sticky_buttons',
        'dv_allow_add_from_homepage', 'show_edit_button', 'show_delete_button',
        'table_order']) {
        if (t[k] !== undefined) pres[k] = t[k];
    }
    if (Object.keys(pres).length) ent.presentation = pres;
    return ent;
}

// --- relations --------------------------------------------------------------
function exportRelation(r, tableNameById) {
    const kindMap = { 'one-to-one': 'one_to_one', 'one-to-many': 'one_to_many', 'many-to-many': 'many_to_many' };
    return {
        id: r.relationship_id,
        parent: tableNameById[r.parent_table_id] || r.parent_table_name,
        child: tableNameById[r.child_table_id] || r.child_table_name,
        fk: r.fk_child_field,
        owner_key: r.parent_field,
        kind: kindMap[r.relationship_type] || 'one_to_many',
        integrity: {
            on_delete: mapIntegrity(r.on_delete),
            on_update: mapIntegrity(r.on_update),
        },
        metrics: { count_in_list: !!r.show_count_in_tv },
        replication: { copy_related: !!r.copy_records },
        presentation: {
            show_tab: !!r.show_tab,
            show_icon: !!r.show_icon,
            tab_title: r.tab_title ?? null,
            autoclose_modal: !!r.autoclose_modal,
            show_link_above: !!r.show_link_above,
            allow_add_from_tv: !!r.allow_add_from_tv,
        },
    };
}

// --- navigation ---------------------------------------------------------------
// unified_menu may contain flat items AND nested groups ({type:'group', items:[...]}).
// IR navigation is a flat list: groups + items referencing group by id.
function exportNavigation(unifiedMenu) {
    const out = [];
    const mapItem = (m) => {
        if (m.type === 'group') {
            out.push({
                type: 'group',
                id: m.id ?? m.menu_group_id ?? null,
                group: null,
                target: null,
                label: m.name ?? m.group_name ?? null,
                detail: null,
                order: m.order ?? m.group_order ?? null,
                show_record_count: false,
            });
            (m.items || []).forEach(mapItem);
            return;
        }
        out.push({
            type: m.type === 'table_item' ? 'entity'
                : (m.type === 'module_item' || m.type === 'custom_view_item') ? 'module'
                : 'url',
            id: m.item_id ?? null,
            group: m.menu_group_id ?? null,
            target: m.table_name ?? m.module_name ?? m.url ?? null,
            label: m.item_label ?? null,
            detail: m.item_detail ?? null,
            order: m.item_order ?? null,
            show_record_count: !!m.show_record_count,
        });
    };
    (unifiedMenu || []).forEach(mapItem);
    return out;
}

// --- modules ------------------------------------------------------------------
function parseJsonMaybe(v, fallback) {
    if (v == null) return fallback;
    if (typeof v === 'object') return v;
    try { return JSON.parse(v); } catch (e) { return fallback; }
}

function exportModule(m, fieldNameById) {
    return {
        id: m.module_id,
        name: m.module_name,
        base_entity: m.base_entity ?? m.table_name ?? null,
        order: m.module_order ?? null,
        filter_rules: parseJsonMaybe(m.filter_rules, null),
        included_relations: parseJsonMaybe(m.included_relations, []),
        entity_override: parseJsonMaybe(m.settings_override, null),
        field_selection: (m.fields || []).map((mf) => ({
            field: mf.field_name ?? fieldNameById[mf.field_id] ?? String(mf.field_id),
            readonly: !!mf.is_readonly,
            order: mf.display_order ?? null,
            overrides: parseJsonMaybe(mf.settings_override, null),
        })),
    };
}

// --- widgets -------------------------------------------------------------------
function exportWidget(w) {
    return {
        id: w.id,
        title: w.title,
        type: w.widget_type,
        target_entity: w.target_table,
        target_field: w.target_field ?? null,
        aggregate: w.aggregate_type ?? null,
        filter: {
            field: w.filter_field ?? null,
            operator: w.filter_operator ?? null,
            value: w.filter_value ?? null,
            timeframe: w.timeframe_range ?? null,
        },
        advanced_query: parseJsonMaybe(w.advanced_query, null),
        presentation: {
            width_span: w.width_span ?? '1',
            icon: w.icon ?? null,
            color: w.color ?? 'primary',
            sort_order: w.sort_order ?? 0,
            chart_label_column: w.chart_label_column ?? null,
        },
    };
}

/**
 * Export the app's full-schema dump into the neutral IR.
 * @param {object} fullSchema { project, database: { table, relationships, unified_menu, custom_modules?, widgets? } }
 * @returns {object} IR object (validate against docs/IR_SCHEMA.json)
 */
function exportIR(fullSchema) {
    const p = fullSchema.project || {};
    const db = fullSchema.database || {};
    const tables = db.table || {};

    const tableNameById = {};
    for (const [name, t] of Object.entries(tables)) tableNameById[t.table_id] = name;

    const entities = Object.entries(tables).map(([name, t]) => exportEntity(name, t));

    const relationships = Array.isArray(db.relationships) ? db.relationships : Object.values(db.relationships || {});
    const relations = relationships.map((r) => exportRelation(r, tableNameById));

    // Project-level ownership default; per-entity row_owner merged into features
    // for convenience (generators may also read entity-level via table dump).
    const projectOwnership = mapOwnership(p, null);

    const ir = {
        ir_version: 1,
        // _source: reserved lossless copy of the pre-IR fullSchema dump.
        // The adapter (src/ir/adapter.js) uses it to reconstruct the legacy
        // shape during the staged Phase 2 migration. Generators must NOT read
        // _source directly; it is removed from IR consumers other than the
        // adapter. Do not add new semantics here.
        _source: fullSchema,
        meta: {
            id: p.project_id ?? null,
            app_name: p.app_title || 'Untitled',
            target_stack: p.stack_base || 'laravel_filament',
            database_engine: p.stack_database || 'mysql_mariadb',
            formats: { date: p.date_format ?? null, time: p.time_format ?? null },
            locale: p.language_select ?? null,
            timezone: p.timezone_select ?? null,
            base_url: p.url ?? null,
        },
        features: {
            auth: {
                login_enabled: !p.hide_login,
                email: !!p.module_auth_email,
                email_2fa: !!p.module_auth_email_2fa,
                // 'basic' = email one-time code, 'totp' = Google Authenticator.
                two_fa_mode: p.module_auth_email_2fa ? (p.auth_2fa_mode || 'basic') : null,
                email_captcha: !!p.module_auth_email_captcha,
                // 'basic' = arithmetic check, 'recaptcha_v2' = Google reCAPTCHA v2.
                captcha_mode: p.module_auth_email_captcha ? (p.auth_captcha_mode || 'basic') : null,
                ldap: !!p.module_auth_ldap,
                google_sso: !!p.module_auth_google_sso,
            },
            authorization: !!p.module_authorization,
            auditing: !!p.module_log_audit,
            seeders: !!p.module_fake_data,
            realtime: {
                enabled: !!p.module_realtime,
                backend: p.realtime_backend === 'pusher' ? 'pusher' : 'reverb',
            },
            google_sheets_sync: {
                enabled: !!p.module_google_sheets,
            },
            soft_delete: {
                mode: p.data_delete_type === 'soft' ? 'soft' : 'hard',
                restore_allowed: true,
                force_delete_allowed: true,
            },
            ownership: projectOwnership,
            tools: {
                sql_tool: !!p.allow_sql_tool,
                server_status: !!p.allow_server_status,
            },
            replication: { copy_children_async: !!p.copy_children_async },
            // Theme system v1: neutral presentation tokens. Generators map
            // {mode, preset, primary} to their stack's theming mechanism.
            theme: resolveTheme(p.theme_config),
        },
        entities,
        relations,
        navigation: exportNavigation(db.unified_menu),
        modules: (db.custom_modules || []).map((m) => exportModule(m, {})),
        widgets: (db.widgets || []).map(exportWidget),
        workflows: parseJsonMaybe(p.project_hook_workflow, null),
    };

    return ir;
}

module.exports = { exportIR, toInputKind, mapOwnership, INPUT_KIND_MAP };
