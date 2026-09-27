// Stack-neutral theme resolution (Fixzy SysMaker theme system v1).
//
// The project stores a theme_config JSON string:
//   { mode: 'preset'|'custom', preset: 'fixzy-amber'|'fixzy-emerald'|
//     'fixzy-slate', primary: '#rrggbb' (custom only), name: '...' }
//
// This module normalizes whatever is stored (including empty/legacy/invalid
// values) into a guaranteed-valid neutral theme object. Generators consume
// the neutral object and map it to their own stack's theming mechanism;
// they must NOT parse theme_config themselves.
'use strict';

const PRESETS = {
    'fixzy-amber': '#f59e0b',
    'fixzy-emerald': '#10b981',
    'fixzy-slate': '#475569',
};

const DEFAULT_PRESET = 'fixzy-amber';
const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * Normalize a raw theme_config (JSON string or object) into a neutral theme.
 * Never throws: invalid input falls back to the default preset.
 *
 * @param {string|Object|null|undefined} raw
 * @returns {{mode: 'preset'|'custom', preset: string, primary: string, name: string}}
 */
function resolveTheme(raw) {
    let cfg = raw;
    if (typeof cfg === 'string') {
        if (!cfg.trim()) cfg = {};
        else {
            try { cfg = JSON.parse(cfg); } catch { cfg = {}; }
        }
    }
    if (!cfg || typeof cfg !== 'object') cfg = {};

    if (cfg.mode === 'custom' && HEX_RE.test(String(cfg.primary || ''))) {
        return {
            mode: 'custom',
            preset: DEFAULT_PRESET,
            primary: String(cfg.primary).toLowerCase(),
            name: String(cfg.name || 'custom').slice(0, 64),
        };
    }
    const preset = PRESETS[cfg.preset] ? cfg.preset : DEFAULT_PRESET;
    return {
        mode: 'preset',
        preset,
        primary: PRESETS[preset],
        name: preset,
    };
}

module.exports = { resolveTheme, PRESETS, DEFAULT_PRESET };
