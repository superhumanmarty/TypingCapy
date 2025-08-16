// js/controller/game-controller.js
import { updateHighlight } from '../highlight.js';
import { calculateAccuracy, getCurrentWord } from '../utils.js';
import { updateHide } from '../hide.js';
import {
  appendTyping, chars, currentIndex, startTime,
  setCurrentIndex, setStartTime, originalLength
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
  resetMetrics, startMetrics, noteMetrics, getLiveWPM
} from '../metrics.js';
import { buildResultsSettingsSummary, removeLegacyResultsHints } from '../ui/results.js';
import { enforceWordLimitAvailability } from '../ui/limits.js';

const WARMUP_MS = 2000;

// module-scoped UI refs (set by initController)
let refs = {
  textDisplay: null,
  hideControl: null,
  highlightControl: null
};

// local run-state
let gameLocked = false;
let firstKeySeen = false;
let firstKeyMistake = false;

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

  // clear any stale WL fill
  const wlFill = document.getElementById('wordProgressFill');
  if (wlFill) wlFill.style.width = '0%';

  enforceWordLimitAvailability();
  firstKeySeen = false;
  firstKeyMistake = false;
}

export function endGame() {
  gameLocked = true;
  document.body.classList.add('game-ended');

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

// Rebuild _targetWords from required chars (used by main too)
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
}

// key handlers (wire these in main.js after initController)
export async function handleKeyDown(e) {
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

  const prevCorrect = document.querySelectorAll('.char.correct').length;
  const prevErrors  = document.querySelectorAll('.char.incorrect, .char.skipped, .char.extra').length;

  if (k === 'Backspace') {
    logBackspace();
    await handleBackspace(textDisplay, hideControl);
  } else if (k === 'Enter') {
    const prevSkipped = new Set([...document.querySelectorAll('.char.skipped')]);
    logEnter();
    const cur = chars[currentIndex];
    const nxt = chars[currentIndex + 1];
    if (cur?.textContent === '\n') {
      await handleChar('\n', textDisplay, hideControl);
    } else if (cur?.classList.contains('correct') && nxt?.textContent === '\n') {
      setCurrentIndex(currentIndex + 1);
      await handleChar('\n', textDisplay, hideControl);
    } else {
      await handleSpace(textDisplay, hideControl);
    }
    const justSkipped = [...document.querySelectorAll('.char.skipped')].filter(n => !prevSkipped.has(n));
    if (justSkipped.length) logSkipped(justSkipped.map(n => n.textContent));
  } else if (k === ' ') {
    const prevSkipped = new Set([...document.querySelectorAll('.char.skipped')]);
    logSpace();
    await handleSpace(textDisplay, hideControl);
    const justSkipped = [...document.querySelectorAll('.char.skipped')].filter(n => !prevSkipped.has(n));
    if (justSkipped.length) logSkipped(justSkipped.map(n => n.textContent));
  } else {
    const idx = currentIndex;
    const cur = idx < chars.length ? chars[idx] : null;
    if (!cur || cur.textContent === ' ' || cur.textContent === '\n' || cur.classList.contains('correct')) {
      logExtra(k);
      await handleExtra(k, textDisplay, hideControl);
    } else {
      if (k === cur.textContent) logCorrect(k);
      else                        logIncorrect(k);
      await handleChar(k, textDisplay, hideControl);
    }
  }

  const correctCount   = document.querySelectorAll('.char.correct').length;
  const incorrectCount = document.querySelectorAll('.char.incorrect').length;
  const skippedCount   = document.querySelectorAll('.char.skipped').length;
  const extraCount     = document.querySelectorAll('.char.extra').length;
  const totalErrors    = incorrectCount + skippedCount + extraCount;
  const totalAttempted = correctCount + totalErrors;

  const newErrors    = document.querySelectorAll('.char.incorrect, .char.skipped, .char.extra').length;
  const strictMode   = document.getElementById('endOnMistakeCheckbox')?.checked === true;
  const addedCorrect = Math.max(0, correctCount - prevCorrect);
  const addedError   = newErrors > prevErrors;

  // feed metrics stream
  noteMetrics(Date.now(), addedCorrect, addedError);

  // live HUD
  const wpmSpan = document.getElementById('wpm');
  const accSpan = document.getElementById('accuracy');

  const elapsedMs = startTime ? (Date.now() - startTime) : 0;
  if (elapsedMs < WARMUP_MS) {
    if (wpmSpan) wpmSpan.textContent = 'WPM: ...';
  } else {
    const liveWpm = getLiveWPM(2000);
    if (wpmSpan) wpmSpan.textContent = `WPM: ${liveWpm}`;
  }

  if (accSpan) {
    accSpan.textContent = `Accuracy: ${calculateAccuracy(totalAttempted, correctCount)}%`;
  }

  if (!firstKeySeen) {
    firstKeyMistake = addedError && addedCorrect === 0;
    firstKeySeen = true;
  }

  if (strictMode && newErrors > prevErrors) endGame();

  // End if WPM < (after warmup only)
  if (document.getElementById('endWpmToggle')?.checked && elapsedMs >= WARMUP_MS) {
    const minWPM = parseInt(document.getElementById('endWpmValue').value, 10);
    const currentWPM = getLiveWPM(2000);
    if (!isNaN(minWPM) && currentWPM < minWPM) endGame();
  }

  // End if Accuracy <
  if (document.getElementById('endAccToggle')?.checked && totalAttempted > 0) {
    const minAccuracy = parseFloat(document.getElementById('endAccValue').value);
    const currentAccuracy = parseFloat((accSpan?.textContent || '').replace('Accuracy: ', '').replace('%', ''));
    if (!isNaN(minAccuracy) && currentAccuracy < minAccuracy) endGame();
  }

  // Word-limit progress + finish condition
  const wordLimit = getWordLimit();
  if (wordLimit > 0) {
    const requiredNodes = chars.filter(n => n?.dataset?.required === '1');
    const totalRequired = requiredNodes.length;

    let attemptedRequired = 0;
    for (const n of requiredNodes) {
      const cl = n.classList;
      if (cl.contains('correct') || cl.contains('incorrect') || cl.contains('skipped')) {
        attemptedRequired++;
      }
    }

    const progress = totalRequired ? (attemptedRequired / totalRequired) : 0;
    const fill = document.getElementById('wordProgressFill');
    if (fill) fill.style.width = Math.min(progress * 100, 100) + '%';

    if (attemptedRequired >= totalRequired) endGame();
  }

  // Endless append near end
  if (wordLimit === 0 && currentIndex >= originalLength - 50) {
    await appendTyping(textDisplay, hideControl);
    setWordsForHistoryFromChars();
  }

  // Re-apply highlight & hide
  const widx = getCurrentWord(chars, currentIndex);
  updateHighlight(getHighlightMode(highlightControl), widx, chars);
  updateHide(getHideMode(hideControl), widx, chars, refs.textDisplay);
}

export function handleKeyUp(e) {
  if (document.body.classList.contains('game-ended') || isGameEnded()) return;
  handleKeyboardState(e);
}

// Optional: expose lock state
export function isGameLocked() { return gameLocked; }
