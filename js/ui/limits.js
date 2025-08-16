// js/ui/limits.js
import { resetTimer, showInitialProgress } from '../timer.js';
import { initializeTyping, setCurrentIndex, setStartTime, chars, currentIndex, originalLength } from '../engine.js';
import { getHideMode, getHighlightMode } from '../settings.js';
import { updateHide } from '../hide.js';
import { updateHighlight } from '../highlight.js';

export function enforceWordLimitAvailability() {
  if (document.body.classList.contains('game-ended')) {
    document.getElementById('wordProgress')?.classList.add('hidden');
    return;
  }

  const wlSel    = document.getElementById('wordLimitSelector');
  const progress = document.getElementById('wordProgress');

  const btnWord          = document.getElementById('btnWord');
  const wordInlineSelect = document.getElementById('wordLimitInlineSelect');

  if (btnWord) {
    btnWord.removeAttribute('aria-disabled');
    btnWord.disabled = false;
  }
  if (wordInlineSelect) wordInlineSelect.disabled = false;

  if (progress) {
    if (wlSel && wlSel.value === 'off') progress.classList.add('hidden');
    else progress.classList.remove('hidden');
  }
}

/**
 * Wire the 3-mode Game Limits switch.
 * You MUST pass these concrete functions so we don’t circularly import your main.
 */
export function setupGameLimitsButtons({
  textDisplay,
  hideControl,
  highlightControl,
  enforceTimerVisibility,
  setTimerLabelToFull,
  resetGameLock,
  positionKeyboardDiagram
}) {
  const btnEndless = document.getElementById('btnEndless');
  const btnTimer   = document.getElementById('btnTimer');
  const btnWord    = document.getElementById('btnWord');

  const timerInline = document.getElementById('timerInline');
  const wordInline  = document.getElementById('wordInline');

  [timerInline, wordInline].forEach(el => {
    if (!el) return;
    el.classList.remove('hidden');      // kills display:none !important
    el.classList.add('btn-dropdown');   // required for the slide CSS to target
  });

  const timerInlineSelect = document.getElementById('timerInlineSelect');
  const wordInlineSelect  = document.getElementById('wordLimitInlineSelect');

  const timerSel = document.getElementById('timerSelector');        // hidden mirror
  const wordSel  = document.getElementById('wordLimitSelector');    // hidden mirror

  if (!btnEndless || !btnTimer || !btnWord || !timerSel || !wordSel) return;

  async function setActive(mode) {
    const isEndless = mode === 'endless';
    const isTimer   = mode === 'timer';
    const isWord    = mode === 'word';

    btnEndless.classList.toggle('active', isEndless);
    btnTimer.classList.toggle('active',   isTimer);
    btnWord.classList.toggle('active',    isWord);

    btnEndless.setAttribute('aria-pressed', String(isEndless));
    btnTimer.setAttribute('aria-pressed',   String(isTimer));
    btnWord.setAttribute('aria-pressed',    String(isWord));

    btnTimer.classList.toggle('show-dropdown', isTimer);
    btnWord.classList.toggle('show-dropdown',  isWord);

    if (isEndless) {
      timerSel.value = 'off';
      wordSel.value  = 'off';
    } else if (isTimer) {
      wordSel.value  = 'off';
      timerSel.value = timerInlineSelect.value;
    } else if (isWord) {
      timerSel.value = 'off';
      wordSel.value  = wordInlineSelect.value;
    }

    enforceTimerVisibility();
    setTimerLabelToFull?.();
    enforceWordLimitAvailability();

    resetTimer();
    setStartTime(0);
    setCurrentIndex(0);
    await initializeTyping(textDisplay, hideControl);
    positionKeyboardDiagram();
    showInitialProgress();

    resetGameLock();

    const widx = (document.getElementById('textDisplay') && chars.length)
      ? (() => {
          let i = currentIndex;
          while (i < chars.length && (chars[i].textContent === ' ' || chars[i].textContent === '\n')) i++;
          return i;
        })()
      : 0;

    updateHide(getHideMode(hideControl), widx, chars, textDisplay);
    updateHighlight(getHighlightMode(highlightControl), widx, chars);
    document.getElementById('wpm').textContent = 'WPM: 0';
    document.getElementById('accuracy').textContent = 'Accuracy: 100%';
  }

  btnEndless.addEventListener('click', () => setActive('endless'));
  btnTimer  .addEventListener('click', () => setActive('timer'));
  btnWord   .addEventListener('click', () => setActive('word'));

  timerInlineSelect.addEventListener('change', () => setActive('timer'));
  wordInlineSelect.addEventListener('change', () => setActive('word'));

  // default to Endless on load
  setActive('endless');
}
