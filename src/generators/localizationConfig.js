// localizationConfig.js — IR helpers for the Localization module.
//
// Trigger: projects.language_select === "Malay" (the existing project
// setting IS the toggle — English projects emit no localization files,
// byte-identical to before). When Malay is selected the generated app
// ships BOTH locales (en + ms) with a switcher; default locale = ms.
// Filament v5 ships native ms translations for its own chrome, so we
// only generate: lang/{en,ms}.json (generated captions), a locale
// middleware, and a switcher in the user menu.
//
// Per-field: fields.caption_ms (optional Malay caption). When the
// module is ON and a field has a caption_ms, generated labels use
// __('fixzy.<tableKey>.<field>') so they switch with the locale;
// otherwise the literal English caption is emitted unchanged.

function isLocalizationEnabled(project) {
    const sel = ((project && project.language_select) || '').toLowerCase();
    return sel.includes('malay') || sel === 'ms';
}

function defaultLocale(project) {
    const sel = ((project && project.language_select) || '').toLowerCase();
    return sel.includes('malay') || sel === 'ms' ? 'ms' : 'en';
}

function supportedLocales() {
    return ['en', 'ms'];
}

// Collect every generated string that needs a translation entry.
// Returns { en: {key: val}, ms: {key: val} } with keys like
// "fixzy.<tableKey>.<field>" for captions and
// "fixzy.<tableKey>.__label" / ".__label_plural" for resource labels.
function collectLocalizationStrings(fullSchema) {
    const en = {};
    const ms = {};
    const tables = (fullSchema && fullSchema.database && fullSchema.database.table) || {};
    for (const [tableName, t] of Object.entries(tables)) {
        const key = tableKey(tableName);
        const fields = t.fields || {};
        for (const [fieldName, f] of Object.entries(fields)) {
            const enCap = f.caption || titleCase(fieldName);
            const msCap = f.caption_ms;
            if (msCap && String(msCap).trim() !== '') {
                const k = `fixzy.${key}.${fieldName}`;
                en[k] = enCap;
                ms[k] = String(msCap).trim();
            }
        }
    }
    return { en, ms };
}

// snake_case table name -> safe JSON key (already snake; keep as-is).
function tableKey(tableName) {
    return String(tableName).replace(/[^a-zA-Z0-9_]/g, '_');
}

// PHP label expression for a field. When localization is on and the
// field has a Malay caption, return a __('key') call; otherwise the
// literal English caption (byte-identical to the non-localized path).
// enLiteral is the already-computed English label for this call site
// (call sites differ: some title-case the caption, some don't).
function labelPhp(enLiteral, field, tableName, localizationEnabled) {
    if (localizationEnabled && field && field.caption_ms && String(field.caption_ms).trim() !== '') {
        return `__('fixzy.${tableKey(tableName)}.${field.field_name}')`;
    }
    return `'${String(enLiteral).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function titleCase(s) {
    return String(s || '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

module.exports = {
    isLocalizationEnabled,
    defaultLocale,
    supportedLocales,
    collectLocalizationStrings,
    tableKey,
    labelPhp,
    titleCase,
};