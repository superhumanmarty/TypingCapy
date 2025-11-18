// js/focusMode.js
// Focus Mode controller
// - Enters on first real typing key
// - Ctrl/Cmd+L: quit to settings/ad layout and regenerate new text immediately
// - Ctrl/Cmd+K: restart same text, same settings, scroll to top instantly and show pre-game look
// - Ctrl/Cmd+J: regenerate new text with the current settings
// - Also: replaces the "Start New Session" button in results with shortcut pills (CSS injected here)

import { chars, setCurrentIndex, setStartTime, initializeTyping, sanitizeExistingText } from './engine.js';
import { resetHistory } from './history.js';
import { updateHide, resetRevealedWords } from './hide.js';
import { updateHighlight } from './highlight.js';
import { stopGhost } from './ghost.js';
import { getHideMode, getHighlightMode } from './settings.js';
import { resetTimer, showInitialProgress } from './timer.js';

let inFocusMode = false;
/* snapshot of the starting DOM for the current run */
let lastRunHTML = '';

const SHORTCUTS = {
  NEW_MODE: 'newMode',
  RETRY: 'retry',
  NEW_WORDS: 'newWords'
};

const SHORTCUT_KEYS = {
  [SHORTCUTS.NEW_MODE]: 'l',
  [SHORTCUTS.RETRY]: 'k',
  [SHORTCUTS.NEW_WORDS]: 'j'
};

const SHORTCUT_LABELS = {
  [SHORTCUTS.NEW_MODE]: 'Settings (Ctrl/Cmd+L)',
  [SHORTCUTS.RETRY]: 'Retry (Ctrl/Cmd+K)',
  [SHORTCUTS.NEW_WORDS]: 'New words (Ctrl/Cmd+J)'
};

const RESULTS_SHORTCUT_ORDER = [
  SHORTCUTS.NEW_MODE,
  SHORTCUTS.RETRY,
  SHORTCUTS.NEW_WORDS
];

/* small helpers */
const textDisplayEl = () => document.getElementById('textDisplay');
const resultsEl     = () => document.getElementById('resultsScreen');
const nextFrame     = () => new Promise(r => requestAnimationFrame(r));

const hideCtl = () =>
  document.getElementById('hideWordsSelector') ||
  document.querySelectorAll('input[name="hideWords"]');

const hlCtl = () =>
  document.getElementById('highlightAheadSelector') ||
  document.querySelectorAll('input[name="highlightAhead"]');

function hasCtrlCmdOnly(e) {
  if (!e) return false;
  const hasCtrlOrMeta = e.metaKey || e.ctrlKey;
  if (!hasCtrlOrMeta) return false;
  if (e.altKey || e.shiftKey) return false;
  return true;
}

function isShortcutCombo(e, action) {
  if (!SHORTCUT_KEYS[action]) return false;
  const key = e.key?.toLowerCase();
  return hasCtrlCmdOnly(e) && key === SHORTCUT_KEYS[action];
}

function ensureResultsHintsButtons(container) {
  if (!container) return;
  for (const action of RESULTS_SHORTCUT_ORDER) {
    let btn = container.querySelector(`[data-shortcut-action="${action}"]`);
    if (!btn) {
      btn = document.createElement('button');
      btn.dataset.shortcutAction = action;
      btn.classList.add('hint');
      container.appendChild(btn);
    } else {
      btn.dataset.shortcutAction = action;
      btn.classList.add('hint');
    }
  }
  wireShortcutButtons(container);
}

function wireShortcutButtons(root = document) {
  if (!root) return;
  const buttons = root.querySelectorAll('[data-shortcut-action]');
  buttons.forEach((btn) => {
    const action = btn.dataset.shortcutAction;
    if (!action || !SHORTCUT_LABELS[action]) return;

    if (btn.tagName === 'BUTTON') {
      btn.type = 'button';
    }
    btn.classList.add('shortcut-button');
    btn.textContent = SHORTCUT_LABELS[action];

    if (btn.dataset.shortcutWired === '1') return;
    btn.addEventListener('click', onShortcutButtonClick);
    btn.dataset.shortcutWired = '1';
  });
}

async function onShortcutButtonClick(e) {
  e.preventDefault();
  e.stopPropagation();
  const action = e.currentTarget?.dataset?.shortcutAction;
  if (!action) return;
  await runShortcutAction(action);
}

function setTimerLabelToFull() {
  const tSel = document.getElementById('timerSelector');
  const tr   = document.getElementById('timeRemaining');
  if (!tSel || !tr) return;

  const sec = parseInt(tSel.value, 10);
  if (!sec || isNaN(sec) || tSel.value === 'off') {
    tr.textContent = '';
    return;
  }
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  tr.textContent = `${m}:${String(s).padStart(2, '0')}`;
}

function forceTimerVisibleIfOn() {
  const tSel = document.getElementById('timerSelector');
  const td   = document.getElementById('timerDisplay');
  if (tSel?.value !== 'off') {
    td?.classList.remove('hidden');
    setTimerLabelToFull(); // <- ensure 0:15 instead of 0:00 pre-start
  }
}

function unlockGame() {
  window.dispatchEvent(new CustomEvent('capy:unlock'));
}

function snapshotRunBaseline() {
  const el = textDisplayEl();
  if (!el) return;
  lastRunHTML = el.innerHTML || '';
}

function rebuildCharsFromDOM() {
  const el = textDisplayEl();
  if (!el) return;
  const newChars = Array.from(el.querySelectorAll('.char'));
  // mutate in-place so other modules see the update
  chars.splice(0, chars.length, ...newChars);
}

function ensureResultsHidden() {
  resultsEl()?.classList.add('hidden');
  document.body.classList.remove('game-ended');
  forceTextVisible();
  forceStatsVisible();
}

function restoreSnapshot() {
  const el = textDisplayEl();
  if (!el) return;
  el.innerHTML = lastRunHTML || '';
  rebuildCharsFromDOM();
}

function isTypingKey(e) {
  const k = e.key;
  if (k === 'Shift' || k === 'Alt' || k === 'Meta' || k === 'Control') return false;
  if (k.startsWith('Arrow')) return false;
  if (k === 'CapsLock' || k === 'Escape' || k === 'Tab') return false;
  return k.length === 1 || k === 'Backspace' || k === ' ' || k === 'Enter';
}

function enterFocusMode() {
  if (inFocusMode || isEditingThreshold()) return; // <-- added guard
  inFocusMode = true;
  document.body.classList.add('focus-mode');
  snapshotRunBaseline();
}


function scrollTextToTop() {
  const el = textDisplayEl();
  if (!el) return;
  el.scrollTop = 0; // immediate jump (no smooth)
}

function clearCharState() {
  for (const c of chars) {
    c.classList.remove(
      'correct','incorrect','skipped','current','ghost',
      'ahead1','ahead2','blink','hidden-word'   // ← keep 'extra' intact
    );
  }
}

function forceTextVisible() {
  const el = textDisplayEl();
  if (!el) return;
  el.classList.remove('hidden');
  el.style.removeProperty('display');
  el.style.removeProperty('visibility');
}

function forceStatsVisible() {
  const s = document.getElementById('stats');
  if (!s) return;
  s.classList.remove('hidden');
  s.style.removeProperty('display');
  s.style.removeProperty('visibility');
}

function isEditingThreshold() {
  return document.body.classList.contains('editing-threshold');
}



function observeTextBaseline() {
  const el = textDisplayEl();
  if (!el) return;
  // Anytime chars appear/refresh, keep a fresh baseline
  const mo = new MutationObserver(() => {
    // Only capture when NOT in a run; ignore mid-run mutations (.extra, correctness, etc.)
    if (inFocusMode) return;
    if (el.querySelector('.char')) snapshotRunBaseline();
  });
  mo.observe(el, { childList: true, subtree: true });
}


function resetStatsUI() {
  const wpm = document.getElementById('wpm');
  const acc = document.getElementById('accuracy');
  if (wpm) wpm.textContent = 'WPM: 0';
  if (acc) acc.textContent = 'Accuracy: 100%';

  document.getElementById('typedErrorDisplay')?.classList.add('hidden');
  ensureResultsHidden();

  const fill = document.getElementById('wordProgressFill');
  if (fill) fill.style.width = '0%';
}

function placeCaretAtStart() {
  const first = chars[0];
  if (!first) return;
  first.classList.add('current');
  setCurrentIndex(0);
  setStartTime(0);
}

function reapplyHideHighlightPreGame() {
  const el = textDisplayEl();
  const hideMode = getHideMode?.(hideCtl()) ?? 'off';
  const hlMode   = getHighlightMode?.(hlCtl()) ?? 'off';
  resetRevealedWords();
  updateHide(hideMode, 0, chars, el);
  updateHighlight(hlMode, 0, chars);
}


/** Strong restore: if text is missing for any reason, bring it back. */
async function ensureWordsPresentOrRegenerate({ allowRegenerate = false } = {}) {
  const el = textDisplayEl();
  if (!el) return;

  // If there's no characters, try snapshot first
  if (!el.querySelector('.char')) {
    if (lastRunHTML) {
      restoreSnapshot();
    } else if (allowRegenerate) {
        // Only regenerate once main.js has loaded configs
        if (!window.configs) return;
        await initializeTyping(el, hideCtl());
        rebuildCharsFromDOM();
        snapshotRunBaseline();
      }
  }
}

/** Restart same text within focus mode, and make the screen look like the initial state */
async function softResetSameText() {
  stopGhost();
  resetTimer();
  showInitialProgress();

  ensureResultsHidden();

  resetHistory();

  // Always go back to the pristine baseline if we have it.
  if (lastRunHTML) {
    restoreSnapshot();                 // <- puts back the original DOM (no .extra nodes)
  } else {
    await ensureWordsPresentOrRegenerate({ allowRegenerate: true });
  }
  // Drop .char.extra nodes *before* we clear classes so they don't get baked in
  sanitizeExistingText(textDisplayEl());
  clearCharState();                    // now only clears classes on baseline nodes
  resetStatsUI();
  placeCaretAtStart();
  reapplyHideHighlightPreGame();
  scrollTextToTop();
  forceTimerVisibleIfOn();
  forceTextVisible();
  forceStatsVisible();
  unlockGame();
}

/** Ctrl/Cmd+J: same settings, brand-new text; remain in focus mode */
async function restartNewTextSameSettings() {
  stopGhost();
  resetTimer();
  showInitialProgress();
  ensureResultsHidden();
  resetHistory();

  const el = textDisplayEl();
  await initializeTyping(el, hideCtl());   // fresh text based on current controls
  await nextFrame();

  rebuildCharsFromDOM();
  snapshotRunBaseline();                   // new baseline for future TAB retries
  sanitizeExistingText(el);

  resetStatsUI();
  reapplyHideHighlightPreGame();
  placeCaretAtStart();
  scrollTextToTop();
  forceTimerVisibleIfOn();
  forceTextVisible();
  forceStatsVisible();
  unlockGame();
}

/** Quit to settings and immediately regenerate fresh text (based on current controls) */
async function regenerateNewTextAndExitFocus() {
  // return to settings/ad first
  document.body.classList.remove('focus-mode');
  inFocusMode = false;

  stopGhost();
  resetTimer();
  showInitialProgress();
  ensureResultsHidden();
  resetHistory();

  const el = textDisplayEl();
  await initializeTyping(el, hideCtl());       // generates brand-new text
  await nextFrame();                // let DOM commit once
  if (!el.querySelector('.char')) { // ultra-guard: try one more time if needed
    await initializeTyping(el, hideCtl());
  }

  rebuildCharsFromDOM();
  snapshotRunBaseline();            // snapshot the new baseline

  resetStatsUI();
  scrollTextToTop();
  reapplyHideHighlightPreGame();
  placeCaretAtStart();
  forceTimerVisibleIfOn();
  forceTextVisible();
  forceStatsVisible();
  unlockGame();
}

async function exitFocusMode({ quit = false } = {}) {
  if (!inFocusMode && !quit) return;
  if (quit) { await regenerateNewTextAndExitFocus(); return; }
  document.body.classList.remove('focus-mode');
  inFocusMode = false;
}

async function restartSameGame() {
  // Stay in focus mode; same text/settings; reset the run and jump to top
  await softResetSameText();
}

async function runShortcutAction(action) {
  switch (action) {
    case SHORTCUTS.NEW_MODE:
      await exitFocusMode({ quit: true });
      break;
    case SHORTCUTS.NEW_WORDS:
      await restartNewTextSameSettings();
      break;
    case SHORTCUTS.RETRY:
      await restartSameGame();
      break;
    default:
      break;
  }
}

/* ---------------- Results Screen: replace button with keyboard hints ---------------- */

function injectResultsShortcutsStyles() {
  const id = 'results-shortcuts-style';
  if (document.getElementById(id)) return;

  const css = `
    /* always hide the legacy restart button */
    #resultsScreen .restart-button,
    .results-screen .restart-button,
    #resultsScreen #restartButton,
    .results-screen #restartButton { display: none !important; }

    /* fallback block matches the standard results-hints layout */
    .results-shortcuts {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 1.25rem;
      flex-wrap: wrap;
      margin-top: 1rem;
    }
    .results-shortcuts .shortcut-button {
      color: var(--correct-color);
      font-weight: 700;
      font-size: 1.05rem;
      border: 1px solid var(--box-border);
      border-radius: 9999px;
      padding: .45rem 1rem;
      background: color-mix(in srgb, var(--box-bg) 85%, transparent);
      box-shadow: 0 2px 8px rgba(0,0,0,0.35);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: .35rem;
      transition: transform 160ms ease, box-shadow 160ms ease, background 160ms ease;
    }
    .results-shortcuts .shortcut-button:hover,
    .results-shortcuts .shortcut-button:focus-visible {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.45);
      background: color-mix(in srgb, var(--box-bg) 92%, transparent);
    }
  `;

  const style = document.createElement('style');
  style.id = id;
  style.textContent = css;
  document.head.appendChild(style);
}


function ensureResultsShortcuts() {
  const rs = resultsEl();
  if (!rs) return;

  // If your static block exists, make sure the copy matches the new phrasing
  const staticHints = rs.querySelector('#resultsHints');
  if (staticHints) {
    ensureResultsHintsButtons(staticHints);
    return;
  }

  // Fallback: inject our own block with the same copy
  if (rs.querySelector('.results-shortcuts')) return;

  const wrap = document.createElement('div');
  wrap.className = 'results-shortcuts results-hints';

  for (const action of RESULTS_SHORTCUT_ORDER) {
    const btn = document.createElement('button');
    btn.dataset.shortcutAction = action;
    btn.className = 'hint';
    wrap.appendChild(btn);
  }

  rs.appendChild(wrap);
  wireShortcutButtons(wrap);
}





function observeResultsScreen() {
  const rs = resultsEl();
  if (!rs) return;
  const obs = new MutationObserver(() => {
    ensureResultsShortcuts();
  });
  obs.observe(rs, { childList: true });
}

/* ----------------- Key handling ----------------- */
/* ----------------- Key handling ----------------- */
async function onKeydown(e) {
  if (isEditingThreshold()) return;

  const wantsNewMode  = isShortcutCombo(e, SHORTCUTS.NEW_MODE);
  const wantsRetry    = isShortcutCombo(e, SHORTCUTS.RETRY);
  const wantsNewWords = isShortcutCombo(e, SHORTCUTS.NEW_WORDS);

  if (wantsNewMode) {
    e.preventDefault();
    e.stopImmediatePropagation();
    await exitFocusMode({ quit: true });
    return;
  }

  // Allow new words on the pre-game/settings screen
  if (!inFocusMode && wantsNewWords) {
    e.preventDefault();
    e.stopImmediatePropagation();
    await restartNewTextSameSettings();
    return;
  }

  // Enter focus mode on first meaningful typing key
  if (!inFocusMode && isTypingKey(e)) {
    enterFocusMode();
    // let the keystroke flow
  }

  // Allow shortcuts if we're in focus mode OR the results screen is visible
  const resultsVisible = !!(resultsEl() && !resultsEl().classList.contains('hidden'));
  if (!inFocusMode && !resultsVisible) return;

  if (wantsNewWords) {
    e.preventDefault();
    e.stopImmediatePropagation();
    await restartNewTextSameSettings();
    return;
  }

  if (wantsRetry) {
    e.preventDefault();
    e.stopImmediatePropagation();
    await restartSameGame();
    return;
  }
}




// Always wire the focus-mode key handler first.
window.addEventListener('keydown', onKeydown, { capture: true, passive: false });

// Cosmetic bits can wait for DOM.
window.addEventListener('DOMContentLoaded', () => {
  injectResultsShortcutsStyles();
  ensureResultsShortcuts();
  wireShortcutButtons();
  observeResultsScreen();
});

// After main.js signals ready, do snapshot/restore wiring (no key hooking here).
window.addEventListener('capy:ready', async () => {
  if (!lastRunHTML) snapshotRunBaseline();
  await ensureWordsPresentOrRegenerate({ allowRegenerate: false });
  observeTextBaseline();
});
