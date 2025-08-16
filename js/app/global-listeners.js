// js/app/global-listeners.js
import { EVT } from './events.js';
import { chars, currentIndex, startTime, sanitizeExistingText } from '../engine.js';
import { getCurrentWord } from '../utils.js';
import { updateHide } from '../hide.js';
import { getHideMode, getHighlightMode } from '../settings.js';
import { updateHighlight } from '../highlight.js';
import { resetMetrics, setAvgOverrideForRun } from '../metrics.js';
import { resetHistory } from '../history.js';
import { resetTimer } from '../timer.js';
import { setWordsForHistoryFromChars, resetGameLock } from '../controller/game-controller.js';
import { enforceWordLimitAvailability } from '../ui/limits.js';

export function wireGlobalListeners({
  textDisplay,
  hideControl,
  highlightControl,
  wpmSpan,
  accSpan,
  setTimerLabelToFull,
  refocusToGame
}) {
  // Focus-mode unlock
  window.addEventListener(EVT.UNLOCK, () => {
    resetGameLock();
    enforceWordLimitAvailability();

    // Timer HUD visibility (matches your main.js helper)
    const tSel = document.getElementById('timerSelector');
    const td   = document.getElementById('timerDisplay');
    if (td && tSel) {
      if (tSel.value !== 'off') {
        td.classList.remove('hidden');
        if (!startTime) setTimerLabelToFull?.();
      } else {
        td.classList.add('hidden');
      }
    }

    sanitizeExistingText(textDisplay);
    setWordsForHistoryFromChars();

    const widx0 = getCurrentWord(chars, 0);
    updateHide(getHideMode(hideControl), widx0, chars, textDisplay);
    updateHighlight(getHighlightMode(highlightControl), widx0, chars);

    const stats = document.getElementById('stats');
    if (stats) {
      stats.classList.remove('hidden');
      stats.style.removeProperty('display');
      stats.style.removeProperty('visibility');
    }
    const kdToggle = document.getElementById('keyboardDiagramToggle');
    const kdPanel  = document.getElementById('keyboardDiagram');
    if (kdToggle?.checked) kdPanel?.classList.remove('hidden');

    refocusToGame?.();
  });

  // TAB failsafe
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && !document.body.classList.contains('focus-mode')) {
      e.preventDefault();

      sanitizeExistingText(textDisplay);
      setWordsForHistoryFromChars();

      const widx0 = getCurrentWord(chars, 0);
      updateHide(getHideMode(hideControl), widx0, chars, textDisplay);
      updateHighlight(getHighlightMode(highlightControl), widx0, chars);

      resetMetrics();
      resetTimer();
      setTimerLabelToFull?.();
      if (wpmSpan) wpmSpan.textContent = 'WPM: 0';
      if (accSpan) accSpan.textContent = 'Accuracy: 100%';

      window.dispatchEvent(new Event(EVT.UNLOCK));
    }
  }, true);

  // Engine run reset -> clear graph
  window.addEventListener(EVT.RUN_RESET, () => {
    resetMetrics();
    resetHistory();
    setAvgOverrideForRun(null);
    const host = document.getElementById('runGraph');
    if (host) host.innerHTML = '';
  });

  // Text ready -> rebuild target words for history
  window.addEventListener(EVT.TEXT_READY, () => {
    setWordsForHistoryFromChars();
  });
}
