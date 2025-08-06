// js/old_settings.js — wires the “Hide Words” radios to hide.js’s updateHide

import { getCurrentWord } from './utils.js';
import { updateHide }     from './hide.js';   // ← fixed import

/**
 * Recomputes which words to hide based on the selected mode and cursor.
 */
export function setupHide(hideRadios, chars, textDisplay, currentIndex) {
  const mode = [...hideRadios].find(r => r.checked).value;
  const w    = getCurrentWord(chars, currentIndex);
  updateHide(mode, w, chars, textDisplay);
}

/**
 * Calls setupHide() whenever the user switches the radio button.
 */
export function watchHideRadios(hideRadios, onChange) {
  hideRadios.forEach(r => r.addEventListener('change', onChange));
}