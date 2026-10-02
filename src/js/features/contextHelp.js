// Contextual help panel — AppGini-style right-side panel.
// Auto-opens on focus of any visible input/select/textarea and shows that
// control's explanation from helpContent.js. Stays open until the user
// closes it (× or Esc). Toggle lives in the topbar.
//
// Design rules:
// - Overlay panel (position: fixed) — no layout shift.
// - z-index below modals (10100+) so modals always win.
// - Never touches appState / autosave.
// - localStorage: fixzy-help-visible ('1' | '0'), fixzy-help-dismissed-hint

import { HELP_ENTRIES, HELP_TABS } from './helpContent.js';

const LS_VISIBLE = 'fixzy-help-visible';
const PANEL_WIDTH = 340;

let panel = null;
let toggleBtn = null;
let currentKey = null;

function isVisible(el) {
  if (!el) return false;
  // Disabled controls still deserve help (e.g. always-on core modules) —
  // they can't be focused but clicks still surface their explanation.
  // offsetParent is null for hidden elements (display:none ancestors included)
  if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return false;
  return true;
}

function activeTabId() {
  // Top-level tab strip: .tab-link.active with data-tab
  const links = document.querySelectorAll('.tab-link.active');
  let id = null;
  links.forEach((l) => {
    // Prefer the link that is actually visible
    if (isVisible(l)) id = l.getAttribute('data-tab') || id;
  });
  return id;
}

function labelFor(el) {
  // 1) explicit <label for=...>
  if (el.id) {
    const lab = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (lab && lab.textContent.trim()) return lab.textContent.trim();
  }
  // 2) wrapping label
  const wrap = el.closest('label');
  if (wrap) {
    const t = wrap.textContent.replace(/\s+/g, ' ').trim();
    if (t) return t;
  }
  // 3) nearest preceding label
  let node = el.previousElementSibling;
  while (node) {
    if (node.tagName === 'LABEL' && node.textContent.trim()) return node.textContent.trim();
    node = node.previousElementSibling;
  }
  return el.name || el.id || 'Field';
}

function lookup(el) {
  if (el.id && HELP_ENTRIES[el.id]) return HELP_ENTRIES[el.id];
  return null;
}

function tabFallback() {
  const tab = activeTabId();
  if (tab && HELP_TABS[tab]) return HELP_TABS[tab];
  if (tab) {
    // Nested/unknown tab: use its button label
    const btn = document.querySelector(`.tab-link[data-tab="${CSS.escape(tab)}"]`);
    const name = btn ? btn.textContent.trim() : tab;
    return { title: name, body: 'Focus any field to see what it does. This panel follows your selection.' };
  }
  return HELP_TABS['getting-started'];
}

function render(entry, controlLabel) {
  if (!panel) return;
  const titleEl = panel.querySelector('.fixzy-help-title');
  const labelEl = panel.querySelector('.fixzy-help-field-label');
  const bodyEl = panel.querySelector('.fixzy-help-body');
  const tipEl = panel.querySelector('.fixzy-help-tip');

  titleEl.textContent = entry.title || 'Help';
  labelEl.textContent = controlLabel || '';
  labelEl.style.display = controlLabel ? '' : 'none';
  bodyEl.textContent = entry.body || '';
  if (entry.tip) {
    tipEl.textContent = 'Tip: ' + entry.tip;
    tipEl.style.display = 'block';
  } else {
    tipEl.textContent = '';
    tipEl.style.display = 'none';
  }
}

function showPanel(show) {
  if (!panel || !toggleBtn) return;
  panel.classList.toggle('fixzy-help-open', show);
  toggleBtn.classList.toggle('active', show);
  // Reserve horizontal space while open: the panel is a fixed 340px overlay
  // on the right edge; without this it covers the right column of the
  // header/content (Auto >> button, checkboxes, tab buttons) and swallows
  // their clicks.
  document.body.classList.toggle('fixzy-help-open', show);
  try { localStorage.setItem(LS_VISIBLE, show ? '1' : '0'); } catch (e) { /* private mode */ }
}

function isPanelOpen() {
  return panel && panel.classList.contains('fixzy-help-open');
}

function handleFocus(el) {
  if (!isVisible(el)) return;
  // Ignore controls inside modal overlays — modals own the screen
  if (el.closest('.modal-overlay')) return;
  const entry = lookup(el);
  if (entry) {
    currentKey = el.id;
    render(entry, labelFor(el));
    if (!isPanelOpen()) showPanel(true);
  } else {
    // Unknown control: show tab-level context so the panel is never silent
    currentKey = null;
    render(tabFallback(), labelFor(el));
    if (!isPanelOpen()) showPanel(true);
  }
}

function buildPanel() {
  if (panel) return;
  panel = document.createElement('aside');
  panel.id = 'fixzy-help-panel';
  panel.setAttribute('aria-label', 'Contextual help');
  panel.innerHTML = `
    <div class="fixzy-help-header">
      <span class="fixzy-help-icon"><i class="fas fa-book-open"></i></span>
      <span class="fixzy-help-title">Help</span>
      <button class="fixzy-help-close" title="Close help (Esc)" aria-label="Close help">&times;</button>
    </div>
    <div class="fixzy-help-field-label"></div>
    <div class="fixzy-help-body"></div>
    <div class="fixzy-help-tip"></div>
    <div class="fixzy-help-footer">Click any field or option — its explanation appears here.</div>
  `;
  document.body.appendChild(panel);

  panel.querySelector('.fixzy-help-close').addEventListener('click', () => showPanel(false));
}

function buildToggle() {
  if (toggleBtn) return;
  const actions = document.querySelector('.header-actions');
  if (!actions) return;
  toggleBtn = document.createElement('button');
  toggleBtn.id = 'context-help-toggle';
  toggleBtn.type = 'button';
  toggleBtn.title = 'Toggle help panel';
  toggleBtn.setAttribute('aria-label', 'Toggle help panel');
  toggleBtn.innerHTML = '<i class="fas fa-book-open"></i>';
  // Insert before the buttons group so it sits at the right edge of the header
  const btnGroup = actions.querySelector('div[style*="grid-area"]');
  if (btnGroup) actions.insertBefore(toggleBtn, btnGroup);
  else actions.appendChild(toggleBtn);

  toggleBtn.addEventListener('click', () => {
    if (isPanelOpen()) {
      showPanel(false);
    } else {
      showPanel(true);
      render(tabFallback(), null);
    }
  });
}

export function initContextHelp() {
  buildPanel();
  buildToggle();

  // Restore persisted visibility
  let visible = true;
  try { visible = localStorage.getItem(LS_VISIBLE) !== '0'; } catch (e) { /* default open */ }
  if (panel) panel.classList.toggle('fixzy-help-open', visible);
  if (toggleBtn) toggleBtn.classList.toggle('active', visible);
  document.body.classList.toggle('fixzy-help-open', visible);
  if (visible) render(tabFallback(), null);

  // Focus tracking (capture phase so we see it before other handlers)
  document.addEventListener('focusin', (e) => {
    const el = e.target;
    if (el.matches('input, select, textarea')) handleFocus(el);
  }, true);

  // Clicks on checkboxes/radios may not fire focus reliably in all browsers.
  // Disabled controls fire no events themselves — catch them via the wrapping label.
  document.addEventListener('click', (e) => {
    let el = e.target.closest('input[type="checkbox"], input[type="radio"]');
    if (!el || el.disabled) {
      const lab = e.target.closest('label');
      if (lab) {
        const inner = lab.querySelector('input[type="checkbox"], input[type="radio"]');
        if (inner) el = inner;
      }
    }
    if (el) handleFocus(el);
  }, true);

  // Esc closes the panel (only when no modal is open — modals handle Esc themselves)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isPanelOpen()) {
      const openModal = document.querySelector('.modal-overlay:not(.hidden)');
      if (!openModal) showPanel(false);
    }
  });

  // When a tab changes, refresh the panel with the new tab's overview
  document.addEventListener('click', (e) => {
    const tabLink = e.target.closest('.tab-link');
    if (tabLink && isPanelOpen()) {
      // Let the tab switch happen first
      setTimeout(() => render(tabFallback(), null), 50);
    }
  });
}
