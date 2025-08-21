// js/handlers/char.js
import { chars, setCurrentIndex } from '../engine.js';
import {
  getCurrentWord,
  scrollToCurrent,
  showTypedErrorBubble,
  scheduleTypedErrorHide
} from '../utils.js';
import { updateHide, clearRevealedWord } from '../hide.js';
import { playPentatonic, playBlip, playClick, playErrorBuzz, getSoundMode } from '../sound.js';
import { getHideMode } from '../settings.js';
import { endGame } from '../controller/game-controller.js';

import { setState, markAttemptedOnce } from '../app/state.js';
import { noteMetrics } from '../metrics.js';

// Global-ish counter that resets on each fresh run
window.capyErrors = 0;
window.addEventListener('capy:runReset', () => { window.capyErrors = 0; });

// Track which char index last triggered the error bubble (non-extra)
window.capyLastErrorIndex = -1;

function checkErrorCapAfterIncrement() {
  const on  = document.getElementById('endErrToggle')?.checked;
  if (!on) return;
  const cap = parseInt(document.getElementById('endErrValue')?.value, 10);
  if (!Number.isFinite(cap) || cap <= 0) return;
  if ((window.capyErrors || 0) >= cap) endGame();
}

function getCurrent() {
  return import('../engine.js').then(m => m.currentIndex);
}

function playTypeSound() {
  const mode = getSoundMode();
  if (mode === 'pentatonic') playPentatonic();
  else if (mode === 'blip')  playBlip();
  else if (mode === 'click') playClick();
}

export async function handleChar(k, textDisplay, hideControl) {
  // first, clear the single previous caret (O(1) instead of O(N))
  const prevCur = document.querySelector('.char.current');
  if (prevCur) prevCur.classList.remove('current');
  const currentIndex = await getCurrent();
  if (currentIndex >= chars.length) return;
  const current = chars[currentIndex];
  const expected = current.textContent;

  // --- Correct key ---
  if (k === expected) {
    if (k !== ' ' && k !== '\n') playTypeSound();
    current.classList.remove('current', 'incorrect');
    current.classList.add('correct');

    setState(current, 'correct');
    markAttemptedOnce(current);
    noteMetrics(Date.now(), 1, false);

    // user did "other stuff" → start ~1s linger (do not restart if already running)
    scheduleTypedErrorHide(1000);

    if (
      currentIndex + 1 < chars.length &&
      (chars[currentIndex + 1].textContent === ' ' || chars[currentIndex + 1].textContent === '\n')
    ) {
      clearRevealedWord(getCurrentWord(chars, currentIndex));
    }
    setCurrentIndex(currentIndex + 1);
    const nxt = chars[currentIndex + 1] || current;
    nxt.classList.add('current');
  } else {
    // --- Wrong key ---
    if (getSoundMode() !== 'off') playErrorBuzz();
    current.classList.remove('current');
    current.classList.add('incorrect');

    setState(current, 'incorrect');
    markAttemptedOnce(current);
    noteMetrics(Date.now(), 0, true);

    const showErrors = !!document.getElementById('showTypedErrorsToggle')?.checked;
    if (showErrors) {
      // Show/update bubble and CANCEL any pending hide so it stays until next "other" action
      showTypedErrorBubble(k);
      window.capyLastErrorIndex = currentIndex; // remember the char we just marked incorrect
    }

    // Count one error for a wrong key
    window.capyErrors = (window.capyErrors || 0) + 1;
    checkErrorCapAfterIncrement();

    setCurrentIndex(currentIndex + 1);
    const nxt = chars[currentIndex + 1];
    if (nxt) nxt.classList.add('current');
  }

  const idxAfter = await getCurrent();
  for (let i = idxAfter + 1; i < chars.length; i++) {
    if ( !chars[i].classList.contains('correct') && !chars[i].classList.contains('skipped') ) {
      chars[i].classList.remove('incorrect');
    }
  }

  const mode = getHideMode(hideControl);
  updateHide(mode, getCurrentWord(chars, idxAfter), chars, textDisplay);

  scrollToCurrent(textDisplay, chars, idxAfter);
}
