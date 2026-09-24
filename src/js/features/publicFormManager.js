// src/js/features/publicFormManager.js
//
// Public Form tab logic: per-table public intake form editor.
// Everything serialises into tables.public_form_config (JSON):
//
//   {
//     "slug": "complaints",
//     "allowed_fields": ["perihal", "email_pengadu"],
//     "intro_text": "...",
//     "success_text": "...",
//     "captcha_required": true,
//     "status_field_default": "pending",
//     "lookup_enabled": true
//   }
//
// The enable switch is tbl-public-form-enabled (generic tbl-* autosave
// via the existing table-settings save path); this module owns
// public_form_config only.

import { appState } from '../state.js';
import { SaveManager } from '../saveManager.js';

function currentTableName() {
    const badgeEl = document.getElementById('workspace-module-badge');
    const isCustomMode = badgeEl && badgeEl.classList.contains('badge-custom');
    if (isCustomMode) return null;
    const titleEl = document.getElementById('workspace-module-title');
    return (titleEl && (titleEl.dataset.tableName || titleEl.textContent.trim())) || null;
}

function currentTableData() {
    const tableName = currentTableName();
    return tableName && appState.jsonData?.database?.table?.[tableName]
        ? appState.jsonData.database.table[tableName]
        : null;
}

function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function escapeAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }

function slugify(s) {
    return String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

// Fields eligible to be public: skip system/audit columns and the PK.
function publicEligibleFields(tableData) {
    const fields = tableData?.fields || {};
    const skip = ['created_at', 'updated_at', 'deleted_at', 'public_reference'];
    return Object.entries(fields)
        .filter(([name, f]) => !skip.includes(name) && f.primary_key !== 1 && f.read_only !== 1)
        .map(([name, f]) => ({ name, label: f.caption || name }));
}

function readConfigFromDom() {
    const allowed = [];
    document.querySelectorAll('#pf-field-picker input[type=checkbox]:checked').forEach((cb) => {
        allowed.push(cb.value);
    });
    return {
        slug: slugify(document.getElementById('pf-slug')?.value || ''),
        allowed_fields: allowed,
        intro_text: document.getElementById('pf-intro')?.value || '',
        success_text: document.getElementById('pf-success')?.value || '',
        captcha_required: !!document.getElementById('pf-captcha')?.checked,
        status_field_default: (document.getElementById('pf-status-default')?.value || '').trim(),
        lookup_enabled: !!document.getElementById('pf-lookup')?.checked,
    };
}

function saveConfig() {
    const tableData = currentTableData();
    if (!tableData || !tableData.table_id) return;
    const cfg = readConfigFromDom();
    updateUrlPreview();
    SaveManager.addToQueue('table', tableData.table_id, { public_form_config: JSON.stringify(cfg) });
}

function updateUrlPreview() {
    const slug = slugify(document.getElementById('pf-slug')?.value || '');
    const el = document.getElementById('pf-url-preview');
    if (!el) return;
    el.textContent = slug ? `Public URL: /f/${slug}` : '';
}

function renderFieldPicker(tableData, selected) {
    const picker = document.getElementById('pf-field-picker');
    if (!picker) return;
    picker.innerHTML = '';
    const fields = publicEligibleFields(tableData);
    if (fields.length === 0) {
        picker.innerHTML = '<em style="color: var(--secondary-color);">No eligible fields.</em>';
        return;
    }
    fields.forEach((f) => {
        const label = document.createElement('label');
        label.className = 'checkbox-label';
        const checked = selected.includes(f.name) ? 'checked' : '';
        label.innerHTML = `<input type="checkbox" value="${escapeAttr(f.name)}" ${checked}> ${escapeHtml(f.label)}`;
        picker.appendChild(label);
    });
    picker.querySelectorAll('input[type=checkbox]').forEach((cb) => cb.addEventListener('change', saveConfig));
}

function renderPublicFormTab(tableData) {
    const enabled = Number(tableData?.public_form_enabled) === 1;
    const panel = document.getElementById('public-form-panel');
    if (!panel) return;
    panel.classList.toggle('hidden', !enabled);
    if (!enabled) return;

    let cfg = null;
    try { cfg = tableData.public_form_config ? JSON.parse(tableData.public_form_config) : null; } catch (e) { cfg = null; }
    if (!cfg || typeof cfg !== 'object') {
        cfg = { slug: slugify(currentTableName() || ''), allowed_fields: [], intro_text: '', success_text: '', captcha_required: false, status_field_default: 'pending', lookup_enabled: false };
    }

    const slugEl = document.getElementById('pf-slug');
    if (slugEl) slugEl.value = cfg.slug || '';
    const introEl = document.getElementById('pf-intro');
    if (introEl) introEl.value = cfg.intro_text || '';
    const succEl = document.getElementById('pf-success');
    if (succEl) succEl.value = cfg.success_text || '';
    const statusEl = document.getElementById('pf-status-default');
    if (statusEl) statusEl.value = cfg.status_field_default || '';
    const capEl = document.getElementById('pf-captcha');
    if (capEl) capEl.checked = cfg.captcha_required === true || cfg.captcha_required === 1 || cfg.captcha_required === '1';
    const lookEl = document.getElementById('pf-lookup');
    if (lookEl) lookEl.checked = cfg.lookup_enabled === true || cfg.lookup_enabled === 1 || cfg.lookup_enabled === '1';

    renderFieldPicker(tableData, Array.isArray(cfg.allowed_fields) ? cfg.allowed_fields : []);
    updateUrlPreview();
}

function initPublicFormTab() {
    const enabledBox = document.getElementById('tbl-public-form-enabled');
    if (enabledBox) {
        enabledBox.addEventListener('change', () => {
            const panel = document.getElementById('public-form-panel');
            if (panel) panel.classList.toggle('hidden', !enabledBox.checked);
        });
    }
    ['pf-slug', 'pf-intro', 'pf-success', 'pf-status-default'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', saveConfig);
    });
    ['pf-captcha', 'pf-lookup'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', saveConfig);
    });
    const slugEl = document.getElementById('pf-slug');
    if (slugEl) slugEl.addEventListener('input', updateUrlPreview);
}

export { renderPublicFormTab, initPublicFormTab, slugify };
