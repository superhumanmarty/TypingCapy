// js/settings.js — unified helpers for Hide & Highlight (select OR radios)

import { getCurrentWord } from './utils.js';
import { updateHide }     from './hide.js';

/* ===== Hide Words ===== */

export function getHideMode(control) {
  if (control) {
    if (typeof control.value === 'string') return control.value; // <select>
    if (typeof control.forEach === 'function' || Array.isArray(control)) {
      const checked = [...control].find(r => r.checked);
      return checked ? checked.value : 'off';
    }
  }
  const sel = document.getElementById('hideWordsSelector');
  if (sel) return sel.value;
  const radios = document.querySelectorAll('input[name="hideWords"]');
  const checked = [...radios].find(r => r.checked);
  return checked ? checked.value : 'off';
}

export function setupHide(hideControl, chars, textDisplay, currentIndex) {
  const mode = getHideMode(hideControl);
  const w    = getCurrentWord(chars, currentIndex);
  updateHide(mode, w, chars, textDisplay);
}

export function watchHideSelector(hideSelector, onChange) {
  hideSelector.addEventListener('change', onChange);
}

export function watchHideRadios(hideRadios, onChange) {
  hideRadios.forEach(r => r.addEventListener('change', onChange));
}

/* ===== Highlight Ahead ===== */

export function getHighlightMode(control) {
  if (control) {
    if (typeof control.value === 'string') return control.value; // <select>
    if (typeof control.forEach === 'function' || Array.isArray(control)) {
      const checked = [...control].find(r => r.checked);
      return checked ? checked.value : 'off';
    }
  }
  const sel = document.getElementById('highlightAheadSelector');
  if (sel) return sel.value;
  const radios = document.querySelectorAll('input[name="highlightAhead"]');
  const checked = [...radios].find(r => r.checked);
  return checked ? checked.value : 'off';
}

export function watchHighlightSelector(ctrl, onChange) {
  ctrl.addEventListener('change', onChange);
}

export function watchHighlightRadios(radios, onChange) {
  radios.forEach(r => r.addEventListener('change', onChange));
}
