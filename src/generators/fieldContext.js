// Per-field schema context builder (Phase 2.4).
//
// Replaces the inline <<PLACEHOLDER>> string-replacement chain in
// laravelSchemasGenerator with a plain context object consumed by
// schemas/FormField.php.njk. Each key maps 1:1 to a former placeholder;
// empty string means "no modifier" (the template drops the line).
//
// NOTE: values are raw PHP fragments — autoescape is off in the engine.

'use strict';

const { toTitleCase, toSingularCamelCase } = require('../utils');

/**
 * Build the render context for one standard (non-repeater) form field.
 *
 * @param {object} field      field schema
 * @param {string} elementType resolved Filament component (TextInput, Select, ...)
 * @param {object} opts       { parentTableData, parentRelation, parentResourceSingular, relationshipName }
 * @returns {object} context for FormField.php.njk
 */
function buildFormFieldContext(field, elementType, opts = {}) {
    const ctx = {
        element_type: elementType,
        field_name: field.field_name,
        is_email: '',
        is_numeric: '',
        is_integer: '',
        is_password: '',
        is_phone: '',
        is_url: '',
        is_readonly: '',
        is_min_length: '',
        is_max_length: '',
        is_fixed_length: '',
        is_min_value: '',
        is_max_value: '',
        is_required: '',
        is_off_autocomplete: '',
        is_prefix: '',
        is_suffix: '',
        suffix_icon_text: '',
        suffix_coloricon_text: '',
        is_mask: '',
        is_placeholder: '',
        is_column_span_full: '',
        is_unique: '',
        is_autofocus: '',
        is_helper_text: '',
        is_default_value: '',
        is_caption: '',
        is_searchable: '',
        is_preload: '',
        options_list_dropdown: '',
        disabled_edit_dropdown_relationship: '',
        is_relationship_normal: '',
        parent_fields_caption: '',
        is_relationship_self_ref: '',
        link_to_parent_record: '',
        multiple_validation: '',
        is_inline_label: '',
        is_hidden_label_placeholder: '',
        is_visible_if: '',
        is_required_if: '',
        keep_trim: true,
    };

    // Format modifiers (legacy: only display_type === 'text_input')
    if (field.display_type === 'text_input') {
        if (field.format_as === 'email') ctx.is_email = '->email()';
        else if (field.format_as === 'password') ctx.is_password = '->password()->revealable()';
        else if (field.format_as === 'tel') ctx.is_phone = "->tel()->telRegex('/^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\\s\\.\\/0-9]*$/')";
        else if (field.format_as === 'url') ctx.is_url = '->url()';
        else if (field.format_as === 'custom' && field.format_mask) ctx.is_mask = `->mask('${field.format_mask}')`;
    }

    // Length modifiers (legacy: only text-ish components)
    if (['TextInput', 'Textarea', 'RichEditor'].includes(elementType)) {
        if (field.min_length && field.min_length === field.length) {
            ctx.is_fixed_length = `->length(${field.min_length})`;
        } else {
            if (field.min_length) ctx.is_min_length = `->minLength(${field.min_length})`;
            if (field.length) ctx.is_max_length = `->maxLength(${field.length})`;
        }
    }

    if (field.display_type === 'text_input') {
        if (field.min_value) ctx.is_min_value = `->minValue(${field.min_value})`;
        if (field.max_value) ctx.is_max_value = `->maxValue(${field.max_value})`;
    }

    if (field.display_type === 'text_input') {
        if (field.read_only === 1) ctx.is_readonly = '->readOnly()';
        if (field.required === 1) ctx.is_required = '->required()->markAsRequired()';
        if (['INT', 'BIGINT'].includes(field.data_type)) ctx.is_integer = '->integer()';
        if (field.data_type === 'DECIMAL') ctx.is_numeric = '->numeric()';
        if (field.off_autocomplete === 1) ctx.is_off_autocomplete = '->autocomplete(false)';
    }

    if (field.helper_text) ctx.is_helper_text = `->helperText('${field.helper_text}')`;
    if (['text_input', 'text_area', 'rich_html'].includes(field.display_type) && field.placeholder) {
        ctx.is_placeholder = `->placeholder('${field.placeholder}')`;
    }
    if (['text_area', 'rich_html'].includes(field.display_type) && field.column_span_full === 1) {
        ctx.is_column_span_full = '->columnSpanFull()';
    }
    if (field.unique === 1) ctx.is_unique = '->unique(ignoreRecord: true)';
    if (field.default_value) ctx.is_default_value = `->default('${field.default_value}')`;
    ctx.is_caption = `->label(${require('./localizationConfig').labelPhp(field.caption || toTitleCase(field.field_name), field, opts.tableName, opts.localizationEnabled)})`;

    // Options list
    if (field.display_type === 'options_list' && field.data_type !== 'BOOLEAN') {
        let optionsCode = '';
        if (field.options_display === 'multi') optionsCode += '->multiple()\n';
        if (field.options_list_values) {
            const optionsArr = field.options_list_values
                .split(';;')
                .map(opt => `'${opt}' => '${toTitleCase(opt)}'`)
                .join(', ');
            optionsCode += `->options([${optionsArr}])`;
        } else {
            optionsCode += '->options([])';
        }
        ctx.options_list_dropdown = optionsCode;
    }

    // Relationship (lookup) fields
    if (field.lookup_parent_table) {
        const caption1 = field.lookup_caption_1;
        const relationshipName = opts.relationshipName || '';

        if (opts.isSelfRef) {
            const parentIdField = 'id';
            ctx.is_relationship_self_ref = `->relationship(\n    name: 'parent',\n    titleAttribute: '${caption1}',\n    modifyQueryUsing: fn (Builder $query, ?Model $record) => $query->where('${parentIdField}', '!=', $record?->${parentIdField})\n)`;
        } else {
            ctx.is_relationship_normal = `->relationship('${relationshipName}', '${caption1}')`;
        }

        if (field.lookup_caption_2) {
            const caption2 = field.lookup_caption_2;
            const separator = field.lookup_separator || ' ';
            ctx.parent_fields_caption = `->getOptionLabelFromRecordUsing(fn (Model $record) => "{$record->${caption1}} ${separator} {$record->${caption2}}")`;
        }

        if (opts.parentRelation && opts.parentRelation.show_count_in_tv === 1) {
            ctx.disabled_edit_dropdown_relationship = `->disabled(session('foreignkey') === '${field.field_name}')`;
        }

        if (field.lookup_searchable === 1) ctx.is_searchable = '->searchable()';
        if (field.lookup_preload === 1) ctx.is_preload = '->preload()';

        if (field.lookup_link_behavior === 'modal' && opts.parentResourceSingular) {
            const res = opts.parentResourceSingular;
            ctx.link_to_parent_record = `->suffixActions([\n    Action::make('view_${opts.parentTable}')\n        ->icon('heroicon-o-eye')\n        ->modalContent(fn (Get $get): ?View => $get('${field.field_name}') ? view('filament.components.modal-iframe', ['src' => ${res}Resource::getUrl('edit', ['record' => $get('${field.field_name}')]) . '?iframe=1']) : null)\n        ->modalWidth('6xl')\n        ->modalSubmitAction(false)\n        ->hidden(fn (Get $get): bool => !$get('${field.field_name}')),\n\n    Action::make('create_${opts.parentTable}')\n        ->icon('heroicon-o-plus')\n        ->modalContent(fn (): View => view('filament.components.modal-iframe', ['src' => ${res}Resource::getUrl('create') . '?iframe=1']))\n        ->modalWidth('6xl')\n        ->modalSubmitAction(false),\n])`;
        }
    }

    // Text input prefix/suffix
    if (field.display_type === 'text_input') {
        if (field.prefix) ctx.is_prefix = `->prefix('${field.prefix}')`;
        if (field.suffix) ctx.is_suffix = `->suffix('${field.suffix}')`;
        if (field.suffix_icon) ctx.suffix_icon_text = `->suffixIcon('heroicon-o-${field.suffix_icon}')`;
        if (field.suffix_icon_color) ctx.suffix_coloricon_text = `->suffixIconColor('${field.suffix_icon_color}')`;
    }

    // Multiple validation rules
    if (field.validations && Array.isArray(field.validations)) {
        // Convert a comma-separated string into a PHP array literal of strings.
        /** @param {string} str comma-separated rule names @returns {string} PHP array literal like ['a', 'b'] */
        const toPhpArray = (str) => {
            if (!str) return '[]';
            const items = str.split(',').map(s => `'${s.trim()}'`).join(', ');
            return `[${items}]`;
        };
        let multiValCode = '';
        field.validations.forEach(val => {
            const type = val.rule_type;
            const v1 = val.rule_value_1;
            const v2 = val.rule_value_2;
            if (type === 'min') multiValCode += `->min(${v1})`;
            else if (type === 'max') multiValCode += `->max(${v1})`;
            else if (type === 'between') multiValCode += `->between(${v1}, ${v2})`;
            else if (type === 'in') multiValCode += `->in(${toPhpArray(v1)})`;
            else if (type === 'not_in') multiValCode += `->notIn(${toPhpArray(v1)})`;
            else if (type === 'starts_with') multiValCode += `->startsWith(${toPhpArray(v1)})`;
            else if (type === 'doesnt_start_with') multiValCode += `->doesntStartWith(${toPhpArray(v1)})`;
            else if (type === 'ends_with') multiValCode += `->endsWith(${toPhpArray(v1)})`;
            else if (type === 'doesnt_end_with') multiValCode += `->doesntEndWith(${toPhpArray(v1)})`;
            else if (type === 'regex') multiValCode += `->regex('${v1}')`;
            else if (type === 'not_regex') multiValCode += `->notRegex('${v1}')`;
            else if (type === 'multiple_of') multiValCode += `->multipleOf('${v1}')`;
            else if (type === 'required_if') multiValCode += `->requiredIf('${v1}', '${v2}')`;
            else if (type === 'required_unless') multiValCode += `->requiredUnless('${v1}', '${v2}')`;
            else if (type === 'required_with') multiValCode += `->requiredWith('${v1}')`;
            else if (type === 'required_with_all') multiValCode += `->requiredWithAll('${v1}')`;
            else if (type === 'required_without') multiValCode += `->requiredWithout('${v1}')`;
            else if (type === 'required_without_all') multiValCode += `->requiredWithoutAll('${v1}')`;
            else if (type === 'required_if_accepted') multiValCode += `->requiredIfAccepted('${v1}')`;
            else if (type === 'prohibited') multiValCode += '->prohibited()';
            else if (type === 'prohibited_if') multiValCode += `->prohibitedIf('${v1}', '${v2}')`;
            else if (type === 'prohibited_unless') multiValCode += `->prohibitedUnless('${v1}', '${v2}')`;
            else if (type === 'prohibits') multiValCode += `->prohibits(${toPhpArray(v1)})`;
            else if (type === 'exists') multiValCode += '->exists()';
        });
        ctx.multiple_validation = multiValCode;
    }

    // Non-text elements don't get ->trim()
    if (['Select', 'Checkbox', 'Radio', 'CheckboxList', 'DatePicker', 'RichEditor'].includes(elementType)) {
        ctx.keep_trim = false;
    }

    // Select never carries ->integer() (legacy post-processing)
    if (elementType === 'Select') {
        ctx.is_integer = '';
    }

    // --- Form Design & Layout (phase E) ---
    // Per-field settings (already normalised by formLayoutConfig.parseFieldFormSettings)
    // with a table-level label default fallback via opts.defaultLabelDisplay.
    const fs_ = opts.formSettings || {};
    const labelMode = fs_.label_display || opts.defaultLabelDisplay || '';
    const labelKeepsOwnLabel = ['Checkbox', 'Radio'].includes(elementType);

    if (labelMode === 'inline' && !labelKeepsOwnLabel) {
        ctx.is_inline_label = '->inlineLabel()';
    } else if (labelMode === 'hidden_placeholder' && !labelKeepsOwnLabel) {
        ctx.is_hidden_label_placeholder = '->hiddenLabel()';
        // Fall back to the caption as placeholder when none was set explicitly.
        if (!ctx.is_placeholder) {
            const ph = String(field.placeholder || field.caption || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            if (ph) ctx.is_placeholder = `->placeholder('${ph}')`;
        }
    }

    // Conditional visibility: ->visible(fn (Get $get) => ...)
    if (fs_.visible_if) {
        ctx.is_visible_if = buildConditionClosure(fs_.visible_if, 'visible');
    }
    // Conditional required
    if (fs_.required_if) {
        ctx.is_required_if = buildConditionClosure(fs_.required_if, 'required');
    }

    // Dependent dropdown (E5): filter this Select's relationship query by
    // another field's value (e.g. room slots filtered by room_number),
    // optionally surfacing a remaining-count helper text.
    if (fs_.depends_on && field.lookup_parent_table && elementType === 'Select') {
        const dep = fs_.depends_on;
        const depField = phpStr(dep.field);
        const filterCol = phpStr(dep.filter_column);
        // Append a modifyQueryUsing closure to the existing relationship() call.
        if (ctx.is_relationship_normal) {
            ctx.is_relationship_normal = ctx.is_relationship_normal.replace(
                /\)$/,
                `, fn (Builder $query, Get $get) => filled($get('${depField}')) ? $query->where('${filterCol}', $get('${depField}')) : $query)`
            );
        }
        if (dep.count_column && dep.model_class) {
            const countCol = phpStr(dep.count_column);
            const helperPrefix = field.helper_text ? `'${phpStr(field.helper_text)} — ' . ` : '';
            ctx.is_helper_text = `->helperText(fn (Get $get) => filled($get('${depField}')) ? (${helperPrefix}\\App\\Models\\${dep.model_class}::find($get('${depField}'))?->${countCol} . ' available') : (${field.helper_text ? `'${phpStr(field.helper_text)}'` : 'null'}))`;
        }
    }

    return ctx;
}

// Escape a literal for single-quoted PHP.
/** @param {*} s value to stringify @returns {string} escaped for single-quoted PHP literals */
function phpStr(s) {
    return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// Build a ->visible()/->required() closure from a normalised {field, op, value} rule.
/**
 * Compile a conditional rule into a Filament closure fragment.
 * @param {{field: string, op: string, value?: *}} rule normalised rule from formLayoutConfig
 * @param {'visible'|'required'} kind which Filament modifier to emit
 * @returns {string} PHP closure fragment ('' for unsupported ops)
 */
function buildConditionClosure(rule, kind) {
    const g = `$get('${phpStr(rule.field)}')`;
    let expr = '';
    switch (rule.op) {
        case 'equals':   expr = `${g} == '${phpStr(rule.value)}'`; break;
        case 'not_equals': expr = `${g} != '${phpStr(rule.value)}'`; break;
        case 'in':       expr = `in_array(${g}, [${rule.value.map(phpStr).map(v => `'${v}'`).join(', ')}], true)`; break;
        case 'filled':   expr = `filled(${g})`; break;
        case 'empty':    expr = `blank(${g})`; break;
        case 'checked':  expr = `${g} == 1 || ${g} === true || ${g} === '1'`; break;
        case 'unchecked': expr = `blank(${g}) || ${g} == 0 || ${g} === false || ${g} === '0'`; break;
        default: return '';
    }
    return `->${kind}(fn (Get $get) => (${expr}))`;
}

module.exports = { buildFormFieldContext, buildConditionClosure };
