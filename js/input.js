// js/input.js: handleChar, handleSpace, handleBackspace, handleExtra — your entire keydown logic

import { chars, setCurrentIndex } from './engine.js';
import { getCurrentWord, scrollToCurrent } from './utils.js';
import { updateHide } from './hide.js';
import { playPentatonic, playBlip, playClick, playErrorBuzz } from './sound.js';

// helper to read the radio buttons
function getSoundMode() {
  return [...document.querySelectorAll('input[name="soundMode"]')]
    .find(r => r.checked).value;
}

// convenience for playing the “correct‐type” sound
function playTypeSound() {
  const mode = getSoundMode();
  if (mode === 'pentatonic') playPentatonic();
  else if (mode === 'blip')       playBlip();
  else if (mode === 'click')      playClick();
}

// Use a getter function to always get fresh currentIndex
function getCurrent() {
  return import('./engine.js').then(m => m.currentIndex);
}

let skipFrom = null, skipTo = null, canSkip = true;