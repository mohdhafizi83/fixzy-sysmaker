/**
 * Setup Wizard (GUI-first installation).
 *
 * Target user: semi-technical to non-technical. The wizard:
 *   1. Checks the environment (Node, PHP, Composer, preview env)
 *   2. Offers a one-click "Run Setup" that provisions what's missing
 *      (same engine as `npm run setup:binaries` — see src/core/setupRunner.js)
 *   3. Streams live log output so the user can see progress
 *
 * Shown automatically on first run when the environment is not ready.
 * Can be reopened any time via the "Setup" button in the header.
 */

const STATUS_ICONS = {
    ok: '<i class="fas fa-check-circle" style="color:#22c55e;"></i>',
    bad: '<i class="fas fa-times-circle" style="color:#ef4444;"></i>',
    warn: '<i class="fas fa-exclamation-triangle" style="color:#f59e0b;"></i>',
    pending: '<i class="fas fa-circle-notch fa-spin" style="color:#3b82f6;"></i>',
};

let logEl = null;
let subscribed = false;

function $(id) { return document.getElementById(id); }

function setRow(id, state, detail) {
    const icon = $('wiz-' + id + '-icon');
    const detailEl = $('wiz-' + id + '-detail');
    if (icon) icon.innerHTML = STATUS_ICONS[state] || '';
    if (detailEl && detail != null) detailEl.textContent = detail;
}

function appendLog(line) {
    if (!logEl) return;
    const div = document.createElement('div');
    div.textContent = line;
    logEl.appendChild(div);
    logEl.scrollTop = logEl.scrollHeight;
}

function renderCheck(status) {
    setRow('node', status.node.ok ? 'ok' : 'bad', 'Node.js ' + status.node.detail + (status.node.ok ? ' (OK)' : ' — 20+ required'));
    setRow('php', status.php.ok ? 'ok' : 'warn', status.php.ok ? 'PHP ' + status.php.detail : (status.php.detail + ' — needed for live preview only'));
    setRow('composer', status.composer.ok ? 'ok' : 'warn', status.composer.ok ? 'Ready' : 'Will be downloaded during setup');
    setRow('preview', status.previewEnv.ok ? 'ok' : 'warn', status.previewEnv.ok ? 'Ready' : 'Will be prepared during setup');

    const runBtn = $('wiz-run-btn');
    const doneNote = $('wiz-done-note');
    if (status.ready) {
        if (runBtn) { runBtn.disabled = true; runBtn.innerHTML = '<i class="fas fa-check"></i> Environment Ready'; }
        if (doneNote) doneNote.classList.remove('hidden');
    } else {
        if (runBtn) { runBtn.disabled = false; runBtn.innerHTML = '<i class="fas fa-download"></i> Run Setup Now'; }
        if (doneNote) doneNote.classList.add('hidden');
    }
    return status.ready;
}

async function refreshStatus() {
    const status = await window.electronAPI.setupCheck();
    if (!status || status.error) {
        setRow('node', 'bad', 'Check failed: ' + (status && status.error));
        return false;
    }
    return renderCheck(status);
}

async function runSetup() {
    const runBtn = $('wiz-run-btn');
    if (runBtn) { runBtn.disabled = true; runBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Setting up...'; }
    if (logEl) logEl.innerHTML = '';
    appendLog('Starting setup...');
    const result = await window.electronAPI.setupRun();
    if (result && result.success) {
        appendLog('Setup complete.');
        await refreshStatus();
    } else {
        const failed = (result && result.failed || []).join(', ') || 'unknown';
        appendLog('Setup finished with issues: ' + failed);
        const runBtn2 = $('wiz-run-btn');
        if (runBtn2) { runBtn2.disabled = false; runBtn2.innerHTML = '<i class="fas fa-redo"></i> Retry Setup'; }
        await refreshStatus();
    }
}

export function openSetupWizard() {
    const modal = $('setup-wizard-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    if (!subscribed && window.electronAPI && typeof window.electronAPI.onSetupLog === 'function') {
        window.electronAPI.onSetupLog(appendLog);
        subscribed = true;
    }
    setRow('node', 'pending', 'checking...');
    setRow('php', 'pending', 'checking...');
    setRow('composer', 'pending', 'checking...');
    setRow('preview', 'pending', 'checking...');
    refreshStatus();
}

export function closeSetupWizard() {
    const modal = $('setup-wizard-modal');
    if (modal) modal.classList.add('hidden');
}

export function initSetupWizard() {
    logEl = $('wiz-log');
    const openBtn = $('setup-wizard-open-btn');
    if (openBtn) openBtn.addEventListener('click', openSetupWizard);
    const closeBtn = $('setup-wizard-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', closeSetupWizard);
    const skipBtn = $('wiz-skip-btn');
    if (skipBtn) skipBtn.addEventListener('click', closeSetupWizard);
    const runBtn = $('wiz-run-btn');
    if (runBtn) runBtn.addEventListener('click', runSetup);
}

/**
 * Call after app boot: if the environment is not ready on first run,
 * show the wizard automatically. Users who skip can reopen via the
 * header "Setup" button.
 */
export async function maybeShowSetupWizard() {
    if (!window.electronAPI || typeof window.electronAPI.setupCheck !== 'function') return;
    try {
        const ready = await refreshStatus();
        if (!ready) {
            // Only auto-open once per install (remembered in localStorage).
            if (!localStorage.getItem('fixzy_setup_seen')) {
                localStorage.setItem('fixzy_setup_seen', '1');
                openSetupWizard();
            }
        }
    } catch { /* non-fatal: wizard remains available via button */ }
}
