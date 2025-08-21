// js/handlers/space.js
import { chars, setCurrentIndex } from '../engine.js';
import { getCurrentWord, scrollToCurrent, scheduleTypedErrorHide } from '../utils.js';
import { updateHide } from '../hide.js';
import { playErrorBuzz, getSoundMode } from '../sound.js';
import { handleChar } from './char.js';
import { getHideMode } from '../settings.js';
import { setState, markAttemptedOnce } from '../app/state.js';
import { noteMetrics } from '../metrics.js';

// Exported for compatibility with other modules (even if not used here)
export let skipFrom = null;
export let skipTo = null;
export let canSkip = true;
export function setCanSkip(value) { canSkip = value; }
export function setSkipFrom(value) { skipFrom = value; }
export function setSkipTo(value) { skipTo = value; }

function getCurrent() {
  return import('../engine.js').then(m => m.currentIndex);
}

export async function handleSpace(textDisplay, hideControl) {
  const currentIndex = await getCurrent();
  const current = chars[currentIndex];

  // If space was pressed when a space/newline was NOT expected, count one error.
  const cur = chars[currentIndex];
  const expectingSpace = !!cur && (cur.textContent === ' ' || cur.textContent === '\n');
  if (!expectingSpace) {
    window.capyErrors = (window.capyErrors || 0) + 1;
  }

  // If the expected char is a real space, type it as normal.
  if (current && current.textContent === ' ') {
    return handleChar(' ', textDisplay, hideControl);
  }

  // Otherwise: skip the rest of the word and log them directly.
  if (getSoundMode() !== 'off') playErrorBuzz();

  const skippedNow = [];         // NEW: capture exactly what we skip
  let endOfWord = currentIndex;
  while (endOfWord < chars.length && chars[endOfWord].textContent !== ' ' && chars[endOfWord].textContent !== '\n') {
    const n = chars[endOfWord];
    n.classList.remove('current', 'correct', 'incorrect');
    n.classList.add('skipped');
    n.dataset.spaceSkipped = '1';
    setState(n, 'skipped');
    markAttemptedOnce(n);
    skippedNow.push(n.textContent);
    endOfWord++;
  }

  // Move caret to next word start (or stay if at end)
  if (chars[currentIndex]) chars[currentIndex].classList.remove('current');
  let nextWordStart = endOfWord;
  if (nextWordStart < chars.length && (chars[nextWordStart].textContent === ' ' || chars[nextWordStart].textContent === '\n')) {
    nextWordStart++;
  }
  setCurrentIndex(nextWordStart);
  if (nextWordStart < chars.length) chars[nextWordStart].classList.add('current');

  // Start the ~1s countdown (idempotent)
  scheduleTypedErrorHide(1000);

  noteMetrics(Date.now(), 0, true);

  // Directly log the chars we skipped (no DOM scan)
  if (skippedNow.length) {
    const { logSkipped } = await import('../history.js');
    logSkipped(skippedNow);
  }

  const updatedIndex = await getCurrent();
  const mode = getHideMode(hideControl);
  const w = getCurrentWord(chars, updatedIndex);
  updateHide(mode, w, chars, textDisplay);
  scrollToCurrent(textDisplay, chars, updatedIndex);
}

