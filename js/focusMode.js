// js/focusMode.js
// Focus Mode controller
// - Enters on first real typing key
// - ESC: quit mid-game (no results), return to settings/ad layout and regenerate new text immediately
// - TAB: restart same text, same settings, scroll to top instantly and show pre-game look
// - Also: replaces "Start New Session" button in results screen with big ESC/TAB hints (CSS injected here)

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

/** SHIFT+TAB: same settings, brand-new text; remain in focus mode */
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

    /* style only the JS fallback block */
    .results-shortcuts {
      display: flex;
      flex-direction: column;
      gap: .6rem;
      margin-top: 1rem;
    }
    .results-shortcuts .primary {
      font-size: 1.25rem;
      font-weight: 800;
      color: var(--correct-color);
    }
    .results-shortcuts .secondary,
    .results-shortcuts .tertiary {
      font-size: 1.05rem;
      color: var(--untyped-color);
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
    const hints = staticHints.querySelectorAll('.hint');
    if (hints[0]) hints[0].innerHTML = '<span class="keycap esc">ESC</span> for new game mode';
    if (hints[1]) hints[1].innerHTML = '<span class="keycap tab">TAB</span> to retry';
    if (hints[2]) hints[2].innerHTML = '<span class="keycap shift">SHIFT</span> <span class="keycap tab">TAB</span> for new game';
    return;
  }

  // Fallback: inject our own block with the same copy
  if (rs.querySelector('.results-shortcuts')) return;

  const wrap = document.createElement('div');
  wrap.className = 'results-shortcuts';

  const primary = document.createElement('div');
  primary.className = 'primary';
  primary.textContent = 'ESC for new game mode';

  const secondary = document.createElement('div');
  secondary.className = 'secondary';
  secondary.textContent = 'TAB to retry';

  const tertiary = document.createElement('div');
  tertiary.className = 'tertiary';
  tertiary.textContent = 'SHIFT TAB for new game';

  wrap.append(primary, secondary, tertiary);
  rs.appendChild(wrap);
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
async function onKeydown(e) {
  if (isEditingThreshold()) return;

  // Allow SHIFT+TAB on the pre-game/settings screen to generate new text (same settings)
  if (!inFocusMode && e.key === 'Tab' && e.shiftKey) {
    e.preventDefault();
    e.stopImmediatePropagation();
    await restartNewTextSameSettings();
    return;
  }

  // Enter focus mode on first meaningful typing key
  if (!inFocusMode && isTypingKey(e)) {
    enterFocusMode();
    return; // let the keystroke flow
  }

  // Allow shortcuts if we're in focus mode OR the results screen is visible
  const resultsVisible = !!(resultsEl() && !resultsEl().classList.contains('hidden'));
  if (!inFocusMode && !resultsVisible && e.key !== 'Escape') return;

  // ESC: quit to settings + fresh text
  if (e.key === 'Escape') {
    e.preventDefault();
    await exitFocusMode({ quit: true });
    return;
  }

  // SHIFT+TAB: same settings, NEW text (works in focus mode and on results)
  if (e.key === 'Tab' && e.shiftKey) {
    e.preventDefault();
    e.stopImmediatePropagation();
    await restartNewTextSameSettings();
    return;
  }

  // TAB: same settings, SAME text (soft reset)
  if (e.key === 'Tab') {
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
  observeResultsScreen();
});

// After main.js signals ready, do snapshot/restore wiring (no key hooking here).
window.addEventListener('capy:ready', async () => {
  if (!lastRunHTML) snapshotRunBaseline();
  await ensureWordsPresentOrRegenerate({ allowRegenerate: false });
  observeTextBaseline();
});
