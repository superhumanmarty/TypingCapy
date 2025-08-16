// js/ui/hide-highlight-watchers.js
import { watchHideSelector, watchHideRadios, getHideMode,
         watchHighlightSelector, watchHighlightRadios, getHighlightMode } from '../settings.js';
import { getCurrentWord } from '../utils.js';
import { chars, currentIndex } from '../engine.js';
import { updateHide } from '../hide.js';
import { updateHighlight } from '../highlight.js';

export function initHideHighlightWatchers(hideControl, highlightControl, textDisplay) {
  // Hide watchers
  const applyHide = () => {
    const widx = getCurrentWord(chars, currentIndex);
    updateHide(getHideMode(hideControl), widx, chars, textDisplay);
  };
  if (hideControl && typeof hideControl.value === 'string') {
    watchHideSelector(hideControl, applyHide);
  } else {
    watchHideRadios(hideControl, applyHide);
  }

  // Highlight watchers
  const applyHighlight = () => {
    const widx = getCurrentWord(chars, currentIndex);
    updateHighlight(getHighlightMode(highlightControl), widx, chars);
  };
  if (highlightControl && typeof highlightControl.value === 'string') {
    watchHighlightSelector(highlightControl, applyHighlight);
  } else {
    watchHighlightRadios(highlightControl, applyHighlight);
  }

  // Initial apply
  applyHide();
  applyHighlight();
}
