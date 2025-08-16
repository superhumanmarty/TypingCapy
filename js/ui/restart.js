// js/ui/restart.js
export function wireRestartButtonUI({
  textDisplay,
  hideControl,
  resetHistory,
  setAvgOverrideForRun,
  sanitizeExistingText,
  setWordsForHistoryFromChars,
  getCurrentWord,
  updateHide,
  getHideMode,
  updateHighlight,
  getHighlightMode,
  resetMetrics,
  resetTimer,
  setTimerLabelToFull,
  resetGameLock,
  applyKeyboardVisibility
}) {
  const btn = document.getElementById('restartButton');
  if (!btn) return;

  btn.addEventListener('click', () => {
    window.capyErrors = 0;
    window.dispatchEvent(new Event('capy:runReset'));
    resetHistory?.();
    setAvgOverrideForRun?.(null);

    const ted = document.getElementById('typedErrorDisplay');
    if (ted) ted.classList.add('hidden');
    const tl = document.getElementById('typedLetter');
    if (tl) tl.textContent = '';

    resetGameLock();

    sanitizeExistingText(textDisplay);
    setWordsForHistoryFromChars();

    const widx0 = getCurrentWord(window.chars || [], 0); // engine exports chars; window fallback
    updateHide(getHideMode(hideControl), widx0, window.chars, textDisplay);
    updateHighlight(getHighlightMode(hideControl ? document.getElementById('highlightAheadSelector') : null) || getHighlightMode(document.getElementById('highlightAheadSelector')), widx0, window.chars);

    resetMetrics?.();
    resetTimer?.();
    setTimerLabelToFull?.();
    const wpmSpan = document.getElementById('wpm');
    const accSpan = document.getElementById('accuracy');
    if (wpmSpan) wpmSpan.textContent = 'WPM: 0';
    if (accSpan) accSpan.textContent = 'Accuracy: 100%';

    setTimeout(applyKeyboardVisibility, 0);
  });
}
