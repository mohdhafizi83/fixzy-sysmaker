// src/js/features/presetManager.js
//
// Starter Packs UI: renders pack cards in the Core Modules column and a
// preview modal (tables, workflow summary, caveats, conflicts) with the
// mandatory "not a complete business system" disclaimer. Install goes
// through the preset:install IPC (main-process transaction) and then
// reloads project data so the designer tree shows the new content.
'use strict';

import { showCustomDialog } from '../ui/modalHandlers.js';

let currentSlug = null;

function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function asObj(v) {
    if (v && typeof v === 'object') return v;
    if (typeof v === 'string') { try { return JSON.parse(v); } catch { return {}; } }
    return {};
}

function renderCards(presets) {
    const grid = document.getElementById('starter-packs-grid');
    if (!grid) return;
    grid.innerHTML = '';
    presets.forEach((p) => {
        const card = document.createElement('div');
        card.className = 'starter-pack-card';
        card.dataset.slug = p.slug;
        card.innerHTML = `
            <div class="pack-name">${esc(p.name)}</div>
            <div class="pack-tagline">${esc(p.tagline)}</div>
            <span class="pack-category">${esc(p.category)}</span>`;
        card.addEventListener('click', () => openPreview(p.slug));
        grid.appendChild(card);
    });
}

function workflowSummary(table) {
    const notes = [];
    const ts = table.table_settings || {};
    if (ts.approval_enabled) {
        const cfg = asObj(ts.approval_config);
        const statuses = (cfg.statuses || []).map((s) => s.label || s.key).join(' → ');
        if (statuses) notes.push(`Approval workflow: ${statuses}`);
    }
    if (ts.numbering_enabled) {
        const cfg = asObj(ts.numbering_config);
        if (cfg.field) notes.push(`Auto-numbering: ${cfg.prefix || ''}${cfg.date_token ? ' + date' : ''} → ${cfg.field}`);
    }
    return notes;
}

function moduleFeatureNote(mod) {
    const ov = asObj(mod.settings_override);
    if (ov.grid_calendar_enabled) return 'Calendar view';
    if (ov.grid_kanban_enabled) {
        const cfg = asObj(ov.grid_kanban_config);
        return `Kanban board (grouped by ${cfg.group_field || 'status'})`;
    }
    if (ov.grid_tree_enabled) return 'Tree view';
    return 'Filtered view';
}

function openPreview(slug) {
    window.electronAPI.previewPreset(slug).then((res) => {
        if (!res.success) { showCustomDialog({ title: 'Error', message: res.message }); return; }
        const m = res.manifest;
        currentSlug = slug;
        document.getElementById('preset-preview-title').textContent = m.name;
        document.getElementById('preset-preview-tagline').textContent = m.tagline;

        const caveatsEl = document.getElementById('preset-preview-caveats');
        if (m.caveats && m.caveats.length) {
            caveatsEl.classList.remove('hidden');
            caveatsEl.innerHTML = '<strong>Good to know:</strong><ul>' + m.caveats.map((c) => `<li>${esc(c)}</li>`).join('') + '</ul>';
        } else {
            caveatsEl.classList.add('hidden');
        }

        const conflictsEl = document.getElementById('preset-preview-conflicts');
        const conflicts = res.conflicts || { tables: [], modules: [] };
        const installBtn = document.getElementById('preset-install-btn');
        if (conflicts.tables.length || conflicts.modules.length) {
            conflictsEl.classList.remove('hidden');
            conflictsEl.innerHTML = '<strong>Cannot install:</strong> names clash with existing content — '
                + esc([...conflicts.tables.map((t) => `table "${t}"`), ...conflicts.modules.map((x) => `module "${x}"`)].join(', '))
                + '. Rename or remove them first.';
            installBtn.disabled = true;
        } else {
            conflictsEl.classList.add('hidden');
            installBtn.disabled = false;
        }

        const tablesEl = document.getElementById('preset-preview-tables');
        tablesEl.innerHTML = '';
        (m.tables || []).forEach((t) => {
            const block = document.createElement('details');
            block.className = 'preset-table-block';
            const fields = (t.fields || []).map((f) => `${esc(f.field_name)} <small>(${esc(f.field_type)})</small>${f.required ? ' *' : ''}`).join(', ');
            const notes = workflowSummary(t);
            block.innerHTML = `
                <summary>${esc(t.module_name)} <small>(${esc(t.table_name)}${t.menu_group ? ', group: ' + esc(t.menu_group) : ''})</small></summary>
                <div class="preset-fields">${fields}</div>
                ${notes.map((n) => `<div class="preset-workflow-note">${esc(n)}</div>`).join('')}`;
            tablesEl.appendChild(block);
        });

        const modulesEl = document.getElementById('preset-preview-modules');
        modulesEl.innerHTML = '';
        if (m.custom_modules && m.custom_modules.length) {
            const h = document.createElement('h4');
            h.style.cssText = 'margin: 12px 0 6px;';
            h.textContent = 'Custom Module Views';
            modulesEl.appendChild(h);
            m.custom_modules.forEach((mod) => {
                const div = document.createElement('div');
                div.className = 'preset-workflow-note';
                div.textContent = `${mod.module_name} — ${moduleFeatureNote(mod)} on ${mod.base_table_ref}`;
                modulesEl.appendChild(div);
            });
        }

        document.getElementById('preset-preview-modal').classList.remove('hidden');
    });
}

function closePreview() {
    document.getElementById('preset-preview-modal').classList.add('hidden');
    currentSlug = null;
}

function doInstall() {
    if (!currentSlug) return;
    const btn = document.getElementById('preset-install-btn');
    const original = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Installing...';
    btn.disabled = true;
    window.electronAPI.installPreset(currentSlug).then(async (res) => {
        if (res.success) {
            closePreview();
            // Full reload so tables tree, menu, and settings reflect the pack.
            const { appState } = await import('../state.js');
            const { loadProjectData } = await import('../../renderer.js');
            await loadProjectData(appState.activeProject, { refreshMode: 'full' });
            showCustomDialog({
                title: 'Starter Pack Installed',
                message: 'The pack is now part of your project as ordinary tables and modules — edit, extend, or remove anything to match your needs.',
            });
        } else {
            const conflicts = res.conflicts;
            let msg = res.message || 'Installation failed.';
            if (conflicts) {
                msg += ' Conflicting: ' + [...(conflicts.tables || []), ...(conflicts.modules || [])].join(', ');
            }
            showCustomDialog({ title: 'Install Failed', message: msg });
        }
    }).finally(() => {
        btn.innerHTML = original;
        btn.disabled = false;
    });
}

export function initStarterPacks() {
    if (!window.electronAPI || !window.electronAPI.listPresets) return;
    window.electronAPI.listPresets().then((res) => {
        if (res && res.success) renderCards(res.presets);
    });
    const closeBtn = document.getElementById('preset-preview-close');
    const cancelBtn = document.getElementById('preset-preview-cancel');
    const installBtn = document.getElementById('preset-install-btn');
    if (closeBtn) closeBtn.addEventListener('click', closePreview);
    if (cancelBtn) cancelBtn.addEventListener('click', closePreview);
    if (installBtn) installBtn.addEventListener('click', doInstall);
    const modal = document.getElementById('preset-preview-modal');
    if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closePreview(); });
}
