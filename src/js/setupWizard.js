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
let lastCheckStatus = null;

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
    gatePreviewButton(status);

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
    lastCheckStatus = status;
    return renderCheck(status);
}

// ---------------------------------------------------------------------
// PREVIEW BUTTON GATE
// When PHP is missing/broken, the "Show Preview" button is disabled with a
// hover tooltip, and an info icon appears next to it that opens full
// per-OS install instructions. Generation still works without PHP.
// ---------------------------------------------------------------------
const PHP_HELP = {
    win32: `
        <p><strong>Windows</strong> — easiest options:</p>
        <ol>
            <li>Click <strong>Run Setup Now</strong> in the Setup Wizard (header
                <i class="fas fa-tools"></i> Setup button) — Fixzy SysMaker downloads
                PHP 8.4 automatically into its own <code>bin/</code> folder.</li>
            <li>Or install manually: download the <em>VS16 x64 Thread Safe</em> zip from
                <strong>windows.php.net/downloads.php</strong>, extract to
                <code>C:\\php</code>, then add <code>C:\\php</code> to your PATH.</li>
            <li>Or via package manager: <code>winget install PHP.PHP.8.3</code></li>
        </ol>`,
    darwin: `
        <p><strong>macOS</strong> — install PHP with Homebrew:</p>
        <ol>
            <li>Install Homebrew (brew.sh) if you don't have it.</li>
            <li>Run in Terminal: <code>brew install php</code></li>
            <li>Verify: <code>php -v</code> should show 8.2 or newer.</li>
        </ol>
        <p>No Homebrew? You can also point Fixzy SysMaker at any PHP with the
        <code>FSM_PHP_BIN</code> environment variable, e.g.
        <code>FSM_PHP_BIN=/usr/local/bin/php</code>.</p>`,
    linux: `
        <p><strong>Linux</strong> — install PHP with your package manager:</p>
        <ol>
            <li>Debian/Ubuntu: <code>sudo apt update &amp;&amp; sudo apt install php-cli php-xml php-mbstring php-sqlite3 php-curl</code></li>
            <li>Fedora: <code>sudo dnf install php-cli php-xml php-mbstring php-pdo php-curl</code></li>
            <li>Arch: <code>sudo pacman -S php</code></li>
            <li>Verify: <code>php -v</code> should show 8.2 or newer.</li>
        </ol>
        <p>Any PHP location works via the <code>FSM_PHP_BIN</code> environment
        variable, e.g. <code>FSM_PHP_BIN=/opt/php/bin/php</code>.</p>`,
};

function phpHelpHtml(platform) {
    if (platform === 'win32') return PHP_HELP.win32;
    if (platform === 'darwin') return PHP_HELP.darwin;
    return PHP_HELP.linux;
}

function gatePreviewButton(status) {
    const btn = $('btn-show-preview');
    if (!btn) return;
    const helpBtn = $('preview-help-btn');
    const group = btn.parentElement;
    if (status.php && status.php.ok) {
        btn.disabled = false;
        btn.title = 'Generate and open the live preview';
        if (group) group.removeAttribute('title');
        if (helpBtn) helpBtn.classList.add('hidden');
    } else {
        btn.disabled = true;
        // Chromium shows no tooltip on disabled buttons themselves —
        // put the hover message on the wrapper span instead.
        const msg = 'Live preview unavailable: PHP 8.2+ not found. Click the info icon for install instructions.';
        btn.title = msg;
        if (group) group.title = msg;
        if (helpBtn) {
            helpBtn.classList.remove('hidden');
            helpBtn.title = 'PHP not found — click for full install instructions';
        }
    }
}

function openPhpHelp(platform) {
    const modal = $('php-help-modal');
    const body = $('php-help-body');
    if (!modal) return;
    if (body) body.innerHTML = phpHelpHtml(platform);
    modal.classList.remove('hidden');
}

function initPhpHelp() {
    const close = () => {
        const modal = $('php-help-modal');
        if (modal) modal.classList.add('hidden');
    };
    const closeBtn = $('php-help-close-btn');
    const closeBtn2 = $('php-help-close-btn2');
    if (closeBtn) closeBtn.addEventListener('click', close);
    if (closeBtn2) closeBtn2.addEventListener('click', close);
    const recheck = $('php-help-recheck-btn');
    if (recheck) recheck.addEventListener('click', async () => {
        recheck.disabled = true;
        await refreshStatus();
        recheck.disabled = false;
        const status = lastCheckStatus;
        if (status && status.php && status.php.ok) close();
    });
    const helpBtn = $('preview-help-btn');
    if (helpBtn) helpBtn.addEventListener('click', async () => {
        let platform = 'linux';
        try {
            const status = await window.electronAPI.setupCheck();
            platform = (status && status.platform) || 'linux';
        } catch { /* default instructions */ }
        openPhpHelp(platform);
    });
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
    initPhpHelp();
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
