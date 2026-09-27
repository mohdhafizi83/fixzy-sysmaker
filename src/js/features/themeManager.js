// Theme tab controller (Fixzy SysMaker theme system v1).
//
// Replaces the old Bootswatch image-preview tab (which was cosmetic only).
// Model:
//   - 3 built-in presets: fixzy-amber / fixzy-emerald / fixzy-slate
//   - Custom: user picks any hex + name; auto-saved to the project's
//     theme_config; "Save as theme" persists it to the global saved_themes
//     store so other projects can reuse it.
//   - Live swatch preview rendered with CSS (no images).
//
// The project's theme_config JSON is the single source of truth; the IR
// exporter (src/core/theme.js resolveTheme) normalizes it for generators.
'use strict';

import { appState } from '../state.js';
import { SaveManager } from '../../renderer.js';
import { showToast } from '../ui/toast.js';

const PRESETS = {
    'fixzy-amber': '#f59e0b',
    'fixzy-emerald': '#10b981',
    'fixzy-slate': '#475569',
};
const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

let savedThemes = [];

/** Parse the project's theme_config into a neutral object (never throws). */
function parseTheme(raw) {
    let cfg = raw;
    if (typeof cfg === 'string') {
        if (!cfg.trim()) cfg = {};
        else { try { cfg = JSON.parse(cfg); } catch { cfg = {}; } }
    }
    if (!cfg || typeof cfg !== 'object') cfg = {};
    if (cfg.mode === 'custom' && HEX_RE.test(String(cfg.primary || ''))) {
        return { mode: 'custom', primary: String(cfg.primary).toLowerCase(), name: String(cfg.name || 'custom') };
    }
    const preset = PRESETS[cfg.preset] ? cfg.preset : 'fixzy-amber';
    return { mode: 'preset', preset, primary: PRESETS[preset], name: preset };
}

/** Push the current theme to the project record (autosave queue). */
function persistThemeToProject(theme) {
    if (!appState.activeProject) return;
    const cfg = theme.mode === 'custom'
        ? { mode: 'custom', primary: theme.primary, name: theme.name }
        : { mode: 'preset', preset: theme.preset };
    SaveManager.addToQueue('project', appState.activeProject.project_id, {
        theme_config: JSON.stringify(cfg),
    });
}

/** Paint the swatch preview with the given primary color. */
function renderSwatch(primary) {
    const box = document.getElementById('theme-swatch-preview');
    if (!box) return;
    box.style.setProperty('--tp', primary);
    box.style.display = 'block';
}

/** Rebuild the preset <select> with presets + saved custom themes. */
function renderThemeSelect(selected) {
    const sel = document.getElementById('app-theme-preset');
    if (!sel) return;
    sel.innerHTML = '';
    for (const [key, hex] of Object.entries(PRESETS)) {
        const opt = document.createElement('option');
        opt.value = `preset:${key}`;
        opt.textContent = key.replace('fixzy-', '').replace(/^\w/, c => c.toUpperCase());
        sel.appendChild(opt);
    }
    for (const t of savedThemes) {
        const opt = document.createElement('option');
        opt.value = `saved:${t.id}`;
        opt.textContent = `${t.name} (custom)`;
        sel.appendChild(opt);
    }
    const customOpt = document.createElement('option');
    customOpt.value = 'custom';
    customOpt.textContent = 'Custom…';
    sel.appendChild(customOpt);
    sel.value = selected || 'preset:fixzy-amber';
    if (!sel.value) sel.value = 'preset:fixzy-amber';
}

/** Show/hide the custom editor + delete button per current selection. */
function syncCustomPanel(mode) {
    const panel = document.getElementById('theme-custom-panel');
    const delBtn = document.getElementById('btn-theme-delete');
    if (panel) panel.style.display = (mode === 'custom' || mode === 'custom-new') ? 'block' : 'none';
    if (delBtn) delBtn.style.display = mode.startsWith('saved:') ? 'inline-block' : 'none';
}

/** Map a select value to a theme object (or null for 'custom' new-entry). */
function themeFromSelectValue(value) {
    if (value.startsWith('preset:')) {
        const key = value.slice(7);
        return { mode: 'preset', preset: key, primary: PRESETS[key], name: key };
    }
    if (value.startsWith('saved:')) {
        const t = savedThemes.find(x => String(x.id) === value.slice(6));
        if (t) return { mode: 'custom', primary: String(t.primary_hex).toLowerCase(), name: t.name, savedId: t.id };
    }
    return null;
}

/**
 * Load the active project's theme into the tab (called from loadProjectData).
 * @param {Object} projectData Active project record.
 * @returns {Promise<void>}
 */
export async function loadThemeSettings(projectData) {
    try {
        savedThemes = (await window.electronAPI.listThemes()) || [];
    } catch (e) {
        savedThemes = [];
    }
    const theme = parseTheme(projectData.theme_config);
    let selectValue;
    if (theme.mode === 'preset') {
        selectValue = `preset:${theme.preset}`;
    } else {
        const match = savedThemes.find(t => t.name === theme.name && String(t.primary_hex).toLowerCase() === theme.primary);
        selectValue = match ? `saved:${match.id}` : 'custom';
    }
    renderThemeSelect(selectValue);
    syncCustomPanel(selectValue);
    const colorInput = document.getElementById('app-theme-custom-color');
    const nameInput = document.getElementById('app-theme-custom-name');
    if (colorInput) colorInput.value = theme.primary;
    if (nameInput && theme.mode === 'custom') nameInput.value = theme.name;
    renderSwatch(theme.primary);
}

/** Wire the theme tab controls. Safe to call once at startup. */
export function initThemeTab() {
    const sel = document.getElementById('app-theme-preset');
    const colorInput = document.getElementById('app-theme-custom-color');
    const nameInput = document.getElementById('app-theme-custom-name');
    const saveBtn = document.getElementById('btn-theme-save-custom');
    const delBtn = document.getElementById('btn-theme-delete');
    if (!sel) return;

    sel.addEventListener('change', () => {
        const theme = themeFromSelectValue(sel.value);
        syncCustomPanel(sel.value);
        if (theme) {
            if (colorInput) colorInput.value = theme.primary;
            if (nameInput && theme.mode === 'custom') nameInput.value = theme.name;
            renderSwatch(theme.primary);
            persistThemeToProject(theme);
        }
        // 'custom' (new entry): project keeps its current theme until the
        // user edits the color, so nothing is persisted yet.
    });

    const onCustomEdit = () => {
        const hex = String(colorInput.value || '').toLowerCase();
        if (!HEX_RE.test(hex)) return;
        const name = String(nameInput.value || '').trim() || 'custom';
        renderSwatch(hex);
        persistThemeToProject({ mode: 'custom', primary: hex, name });
    };
    if (colorInput) colorInput.addEventListener('input', onCustomEdit);
    if (nameInput) nameInput.addEventListener('change', onCustomEdit);

    if (saveBtn) saveBtn.addEventListener('click', async () => {
        const hex = String(colorInput.value || '').toLowerCase();
        const name = String(nameInput.value || '').trim();
        if (!HEX_RE.test(hex)) { showToast('Pick a valid color first.', 'error'); return; }
        if (!name) { showToast('Give the theme a name first.', 'error'); return; }
        const res = await window.electronAPI.saveTheme({ name, primaryHex: hex });
        if (res && res.success) {
            showToast(`Theme "${name}" saved. Reusable in any project.`, 'success');
            await loadThemeSettings({ theme_config: JSON.stringify({ mode: 'custom', primary: hex, name }) });
            const sel2 = document.getElementById('app-theme-preset');
            const match = savedThemes.find(t => t.name === name);
            if (sel2 && match) { sel2.value = `saved:${match.id}`; syncCustomPanel(sel2.value); }
        } else {
            showToast((res && res.error) || 'Failed to save theme.', 'error');
        }
    });

    if (delBtn) delBtn.addEventListener('click', async () => {
        const theme = themeFromSelectValue(sel.value);
        if (!theme || !theme.savedId) return;
        const res = await window.electronAPI.deleteTheme({ themeId: theme.savedId });
        if (res && res.success) {
            showToast(`Theme "${theme.name}" deleted.`, 'success');
            sel.value = 'preset:fixzy-amber';
            syncCustomPanel(sel.value);
            renderSwatch(PRESETS['fixzy-amber']);
            persistThemeToProject({ mode: 'preset', preset: 'fixzy-amber', primary: PRESETS['fixzy-amber'], name: 'fixzy-amber' });
            savedThemes = (await window.electronAPI.listThemes()) || [];
            renderThemeSelect('preset:fixzy-amber');
        }
    });
}
