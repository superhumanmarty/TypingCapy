// js/controller/game-controller.js
import { updateHighlight } from '../highlight.js';
import { calculateAccuracy, getCurrentWord } from '../utils.js';
import { updateHide } from '../hide.js';
import {
  appendTyping, chars, currentIndex, startTime,
  setCurrentIndex, setStartTime, originalLength,
  maybePrune, pruneLeadingText
} from '../engine.js';

import { getHideMode, getHighlightMode } from '../settings.js';
import { handleChar } from '../handlers/char.js';
import { handleSpace } from '../handlers/space.js';
import { handleBackspace } from '../handlers/backspace.js';
import { handleExtra } from '../handlers/extra.js';
import { handleKeyboardState } from '../keyboard.js';
import { startTimer, isGameEnded, endTimer, getTimerDuration, getWordLimit } from '../timer.js';
import { setupGhost, startGhost, stopGhost } from '../ghost.js';
import {
  resetHistory, logCorrect, logIncorrect, logExtra, logBackspace,
  logSpace, logEnter, logSkipped, setTargetWordsForRun, renderTypingHistory
} from '../history.js';
import {
  resetMetrics, startMetrics, getLiveWPM
} from '../metrics.js';
import { buildResultsSettingsSummary, removeLegacyResultsHints } from '../ui/results.js';
import { enforceWordLimitAvailability } from '../ui/limits.js';
import { AppState, initWordProgress, resetTally, Tally } from '../app/state.js';
import { scheduleHUD } from '../ui/hud.js';


const WARMUP_MS = 2000;

// measured monospace line width & off-screen trigger
const LINE_CHARS = 44;          // characters per line you measured
const TRIGGER_AHEAD_LINES = 2;  // append when 2 lines remain (keeps new text off-screen)


function maybeHitErrorCap() {
  const on = document.getElementById('endErrToggle')?.checked;
  if (!on) return;
  const cap = parseInt(document.getElementById('endErrValue')?.value, 10);
  if (!Number.isFinite(cap) || cap <= 0) return;
  if ((window.capyErrors || 0) >= cap) endGame();
}

// module-scoped UI refs (set by initController)
let refs = {
  textDisplay: null,
  hideControl: null,
  highlightControl: null
};

// local run-state
let gameLocked = false;


// ============ public API ============
export function initController({ textDisplay, hideControl, highlightControl }) {
  refs.textDisplay      = textDisplay;
  refs.hideControl      = hideControl;
  refs.highlightControl = highlightControl;

  // one-time: ensure ghost module is initialized (no-op if already)
  setupGhost();
}

export function resetGameLock() {
  gameLocked = false;
  document.body.classList.remove('game-ended');
  document.getElementById('textDisplay')?.classList.remove('hidden');
  document.getElementById('resultsScreen')?.classList.add('hidden');
  document.getElementById('typedErrorDisplay')?.classList.add('hidden');

  // fresh run: reset error cap counter
  window.capyErrors = 0;
  window.dispatchEvent(new Event('capy:runReset'));

  // clear any stale WL fill
  const wlFill = document.getElementById('wordProgressFill');
  if (wlFill) wlFill.style.width = '0%';

  resetTally();

  enforceWordLimitAvailability();
}


export function endGame() {
  gameLocked = true;
  document.body.classList.add('game-ended');

   // Hide the live text + HUD; show results
   document.getElementById('textDisplay')?.classList.add('hidden');
   document.getElementById('stats')?.classList.add('hidden');
   document.getElementById('typedErrorDisplay')?.classList.add('hidden');
   document.getElementById('resultsScreen')?.classList.remove('hidden');
   window.dispatchEvent(new Event('capy:timeup'));

  const wlBar = document.getElementById('wordProgress');
  if (wlBar) wlBar.classList.add('hidden');

  const wlFill = document.getElementById('wordProgressFill');
  if (wlFill) wlFill.style.width = '0%';

  stopGhost?.();

  buildResultsSettingsSummary();
  renderTypingHistory();
  endTimer();

  // CERTIFICATE: guaranteed button
  if (!document.getElementById('downloadCertificateButton')) {
    const inlineHost =
      document.querySelector('.results-actions') ||
      document.querySelector('.results-buttons') ||
      document.querySelector('.results-stats')?.parentElement;

    const btn = document.createElement('button');
    btn.id = 'downloadCertificateButton';
    btn.type = 'button';
    btn.className = 'btn btn-primary certificate-btn';
    btn.textContent = 'CERTIFICATE';
    (inlineHost || document.body).appendChild(btn);

    if (!inlineHost) {
      btn.setAttribute('style',
        'position:fixed;right:16px;bottom:16px;z-index:99999;padding:12px 16px;' +
        'border-radius:12px;border:none;font-weight:700;cursor:pointer;' +
        'box-shadow:0 6px 18px rgba(0,0,0,.25);background:#1f63ff;color:#fff;'
      );
    }

    btn.addEventListener('click', async () => {
      const fullName = (window.prompt('Enter your first and last name for the certificate:', '') || '').trim();
      if (!fullName) return;
      const gen = window.capyGenerateCertificate;
      if (typeof gen === 'function') await gen(fullName);
      else {
        const { generateCertificate } = await import('../certificate.js');
        await generateCertificate(fullName);
      }
    });
  }

  window.dispatchEvent(new Event('capy:resultsPainted'));
  removeLegacyResultsHints();
}

export function setWordsForHistoryFromChars() {
  const out = [];
  let buf = '';

  for (const n of chars) {
    const ch = n.textContent;
    if (ch === ' ' || ch === '\n') {
      if (buf) { out.push(buf); buf = ''; }
      continue;
    }
    if (n?.dataset?.required === '1') buf += ch;
  }
  if (buf) out.push(buf);
  setTargetWordsForRun(out);

  // NEW: precompute required nodes & clear per-node flags
  initWordProgress(chars);
}


// key handlers (wire these in main.js after initController)
export async function handleKeyDown(e) {
  if (document.body.classList.contains('editing-threshold')) return; 
  if (document.body.classList.contains('game-ended') || isGameEnded() || gameLocked) return;

  // Ignore when a real control is focused (mouse-only <select> is allowed)
  const ae = document.activeElement;
  const aeIsMouseOnlySelect =
    ae && ae.tagName === 'SELECT' && ae.dataset.mouseOnlyWired === '1';

  if (
    ae && !aeIsMouseOnlySelect &&
    (ae.tagName === 'INPUT' ||
     ae.tagName === 'SELECT' ||
     ae.tagName === 'TEXTAREA' ||
     ae.tagName === 'BUTTON' ||
     ae.closest('[role="button"]') ||
     (ae.tagName === 'A' && ae.hasAttribute('href')) ||
     ae.isContentEditable)
  ) return;

  handleKeyboardState(e);
  if (isGameEnded()) return;

  // Block Alt/Option+Enter so Enter-as-Space never runs here
  if (e.key === 'Enter' && e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
    e.preventDefault();
    e.stopImmediatePropagation();
    return;
  }

  const k = e.key;

  if (k !== 'Backspace' && k !== ' ' && k !== 'Enter' && k.length !== 1) return;
  e.preventDefault();

  if (!startTime) {
    resetHistory();                 // Start fresh buffer for this run
    setWordsForHistoryFromChars();  // Build _targetWords for this run
    const now = Date.now();
    setStartTime(now);
    if (document.getElementById('ghostModeToggle')?.checked) startGhost();
    startMetrics(now);
  }

  if (getTimerDuration() > 0) startTimer();

  const { textDisplay, hideControl, highlightControl } = refs;

  if (k === 'Backspace') {
    logBackspace();
    await handleBackspace(textDisplay, hideControl);
  } else if (k === 'Enter') {
    logEnter();
    const cur = chars[currentIndex];
    const nxt = chars[currentIndex + 1];

    if (cur?.textContent === '\n') {
      await handleChar('\n', textDisplay, hideControl);
    } else if (cur?.classList.contains('correct') && nxt?.textContent === '\n') {
      setCurrentIndex(currentIndex + 1);
      await handleChar('\n', textDisplay, hideControl);
    } else {
      // Enter behaves like Space when not on a newline
      await handleSpace(textDisplay, hideControl);
    }

  } else if (k === ' ') {
    logSpace();
    await handleSpace(textDisplay, hideControl);
    maybeHitErrorCap();
  } else {
    const idx = currentIndex;
    const cur = idx < chars.length ? chars[idx] : null;
    if (!cur || cur.textContent === ' ' || cur.textContent === '\n' || cur.classList.contains('correct')) {
      logExtra(k);
      // Typing when nothing is required here = one extra-char error
      window.capyErrors = (window.capyErrors || 0) + 1;
      maybeHitErrorCap();
      await handleExtra(k, textDisplay, hideControl);
    } else {
      if (k === cur.textContent) logCorrect(k);
      else                        logIncorrect(k);
      await handleChar(k, textDisplay, hideControl);
    }
  }

  // Batch HUD paint (1x per frame)
  scheduleHUD(startTime);

  // End if WPM < (after warmup only)
  const elapsedMs = startTime ? (Date.now() - startTime) : 0;
  if (document.getElementById('endWpmToggle')?.checked && elapsedMs >= WARMUP_MS) {
    const minWPM = parseInt(document.getElementById('endWpmValue').value, 10);
    const currentWPM = getLiveWPM(2000);
    if (!isNaN(minWPM) && currentWPM < minWPM) endGame();
  }

  // End if Accuracy <
  if (document.getElementById('endAccToggle')?.checked) {
    const attempted = Tally.correct + Tally.incorrect + Tally.skipped + Tally.extra;
    if (attempted > 0) {
      const minAccuracy = parseFloat(document.getElementById('endAccValue')?.value);
      const currentAccuracy = calculateAccuracy(attempted, Tally.correct);
      if (!isNaN(minAccuracy) && currentAccuracy < minAccuracy) endGame();
    }
  }

  // Word-limit finish (progress bar is painted by markAttemptedOnce)
  const wordLimit = getWordLimit();
  if (wordLimit > 0 && AppState.attemptedRequired >= AppState.totalRequired) {
    endGame();
  }


  // Endless/timer: append when ~2 lines (88 chars) remain so the new text is off-screen
  const remainingAhead = originalLength - currentIndex; // in chars (nodes)
  if (wordLimit === 0 && remainingAhead <= LINE_CHARS * TRIGGER_AHEAD_LINES) {
    await appendTyping(textDisplay, hideControl);
    setWordsForHistoryFromChars();
    maybePrune(refs.textDisplay, 80);   // keep ~80 words behind the caret
  }




  // Re-apply highlight & hide
  const widx = getCurrentWord(chars, currentIndex);
  updateHighlight(getHighlightMode(highlightControl), widx, chars);
  updateHide(getHideMode(hideControl), widx, chars, refs.textDisplay);

  // If the DOM has grown large for any reason, prune it down
  maybePrune(refs.textDisplay, 80);

}

export function handleKeyUp(e) {
  if (document.body.classList.contains('editing-threshold')) return;
  if (document.body.classList.contains('game-ended') || isGameEnded()) return;
  handleKeyboardState(e);
}

// Optional: expose lock state
export function isGameLocked() { return gameLocked; }
