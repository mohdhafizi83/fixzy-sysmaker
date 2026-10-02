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

/** True when the project's language_select is Malay (the localization toggle). @param {object} project @returns {boolean} */
function isLocalizationEnabled(project) {
    const sel = ((project && project.language_select) || '').toLowerCase();
    return sel.includes('malay') || sel === 'ms';
}

// Full language -> locale-code map for the Localization tab dropdown
// (src/index.html app-language-select, 43 options). Codes follow the
// Filament v5 / Laravel lang-directory convention shipped in the
// boilerplate vendor (64 locales). Every option maps to a real locale
// code; Filament chrome falls back to English where it has no bundled
// translation (af, si), which is still a valid Laravel locale.
const LANGUAGE_LOCALES = {
    'afrikaans': 'af',
    'albanian': 'sq',
    'arabic': 'ar',
    'bosnian': 'bs',
    'brazilian portuguese': 'pt_BR',
    'bulgarian': 'bg',
    'catalan': 'ca',
    'chinese simplified': 'zh_CN',
    'chinese traditional': 'zh_TW',
    'croatian': 'hr',
    'czech': 'cs',
    'danish': 'da',
    'dutch': 'nl',
    'english': 'en',
    'estonian': 'et',
    'farsi': 'fa',
    'finnish': 'fi',
    'french': 'fr',
    'georgian': 'ka',
    'german': 'de',
    'greek': 'el',
    'hebrew': 'he',
    'hungarian': 'hu',
    'italian': 'it',
    'japanese': 'ja',
    'korean': 'ko',
    'malay': 'ms',
    'norwegian bokmal': 'nb',
    'polish': 'pl',
    'portuguese': 'pt',
    'romanian': 'ro',
    'russian': 'ru',
    'serbian cyrillic': 'sr_Cyrl',
    'serbian latin': 'sr_Latn',
    'sinhala': 'si',
    'slovakian': 'sk',
    'slovenian': 'sl',
    'spanish': 'es',
    'swahili': 'sw',
    'swedish': 'sv',
    'turkish': 'tr',
    'ukrainian': 'uk',
    'urdu': 'ur',
};

/**
 * Map the project's language_select to a Laravel/Filament locale code.
 * Unknown or empty selections fall back to 'en' (never throws).
 * @param {object} project project row with language_select
 * @returns {string} locale code (e.g. 'fr', 'zh_CN', 'ms')
 */
function languageToLocale(project) {
    const sel = ((project && project.language_select) || '').trim().toLowerCase();
    return LANGUAGE_LOCALES[sel] || 'en';
}

/**
 * Validate an IANA timezone identifier via the ICU database (no deps).
 * @param {string} tz candidate timezone (e.g. 'Asia/Tokyo')
 * @returns {boolean} true when the host ICU accepts it
 */
function isValidTimezone(tz) {
    if (!tz || typeof tz !== 'string' || tz.length > 64) return false;
    try {
        new Intl.DateTimeFormat('en', { timeZone: tz });
        return true;
    } catch {
        return false;
    }
}

/** @param {object} project @returns {'ms'|'en'} default locale for the generated app */
function defaultLocale(project) {
    const sel = ((project && project.language_select) || '').toLowerCase();
    return sel.includes('malay') || sel === 'ms' ? 'ms' : 'en';
}

/** @returns {string[]} locales shipped by the generated app */
function supportedLocales() {
    return ['en', 'ms'];
}

// Collect every generated string that needs a translation entry.
// Returns { en: {key: val}, ms: {key: val} } with keys like
// "fixzy.<tableKey>.<field>" for captions and
// "fixzy.<tableKey>.__label" / ".__label_plural" for resource labels.
/** @param {object} fullSchema @returns {{en: object, ms: object}} translation maps keyed by fixzy.* keys */
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
/** @param {string} tableName @returns {string} sanitized key */
function tableKey(tableName) {
    return String(tableName).replace(/[^a-zA-Z0-9_]/g, '_');
}

// PHP label expression for a field. When localization is on and the
// field has a Malay caption, return a __('key') call; otherwise the
// literal English caption (byte-identical to the non-localized path).
// enLiteral is the already-computed English label for this call site
// (call sites differ: some title-case the caption, some don't).
/**
 * @param {string} enLiteral English label for this call site
 * @param {object} field field row (caption_ms checked)
 * @param {string} tableName owning table name
 * @param {boolean} localizationEnabled module toggle
 * @returns {string} PHP expression: __('key') call or quoted literal
 */
function labelPhp(enLiteral, field, tableName, localizationEnabled) {
    if (localizationEnabled && field && field.caption_ms && String(field.caption_ms).trim() !== '') {
        return `__('fixzy.${tableKey(tableName)}.${field.field_name}')`;
    }
    return `'${String(enLiteral).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/** Convert snake_case to Title Case. @param {string} s @returns {string} humanized title */
function titleCase(s) {
    return String(s || '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

module.exports = {
    isLocalizationEnabled,
    languageToLocale,
    isValidTimezone,
    defaultLocale,
    supportedLocales,
    collectLocalizationStrings,
    tableKey,
    labelPhp,
    titleCase,
};