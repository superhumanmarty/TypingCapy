// js/handlers/char.js
import { chars, setCurrentIndex } from '../engine.js';
import { getCurrentWord, scrollToCurrent } from '../utils.js';
import { updateHide, clearRevealedWord } from '../hide.js';
import { playPentatonic, playBlip, playClick, playErrorBuzz, getSoundMode } from '../sound.js';
import { setCanSkip } from './space.js';

function getCurrent() {
  return import('../engine.js').then(m => m.currentIndex);
}

function playTypeSound() {
  const mode = getSoundMode();
  if (mode === 'pentatonic') playPentatonic();
  else if (mode === 'blip') playBlip();
  else if (mode === 'click') playClick();
}

export async function handleChar(k, textDisplay, hideRadios) {
  // first, clear any leftover carets
  chars.forEach(c => c.classList.remove('current'));
  const currentIndex = await getCurrent();
  if (currentIndex >= chars.length) return;
  const current = chars[currentIndex];
  const expected = current.textContent;

  // --- Correct key ---
  if (k === expected) {
    if (k !== ' ' && k !== '\n') playTypeSound();
    // mark correct, clear old cursor
    current.classList.remove('current', 'incorrect');
    current.classList.add('correct');
    // hide error UI
    document.getElementById('typedErrorDisplay').classList.add('hidden');
    // clear revealed-word if we just hit a word boundary
    if ( currentIndex + 1 < chars.length && (chars[currentIndex + 1].textContent === ' ' || chars[currentIndex + 1].textContent === '\n') ) {
      clearRevealedWord(getCurrentWord(chars, currentIndex));
    }
    // always advance cursor
    setCurrentIndex(currentIndex + 1);
    const nxt = chars[currentIndex + 1] || current;
    nxt.classList.add('current');
    setCanSkip(true);
  } else {
    // --- Incorrect key (unchanged) ---
    if (getSoundMode() !== 'off') playErrorBuzz();
    current.classList.remove('current');
    current.classList.add('incorrect');
    const showErrors = document.querySelector('input[name="showTypedErrors"]:checked')
      .value === 'on';
    if (showErrors) {
      document.getElementById('typedLetter').textContent = k;
      document.getElementById('typedErrorDisplay').classList.remove('hidden');
    }
    setCurrentIndex(currentIndex + 1);
    const nxt = chars[currentIndex + 1];
    if (nxt) nxt.classList.add('current');
  }

  // cleanup any stray .incorrect ahead
  const idxAfter = await getCurrent();
  for (let i = idxAfter + 1; i < chars.length; i++) {
    if ( !chars[i].classList.contains('correct') && !chars[i].classList.contains('skipped') ) {
      chars[i].classList.remove('incorrect');
    }
  }

  // reapply hide-words & scroll
  const mode = [...hideRadios].find(r => r.checked).value;
  updateHide(mode, getCurrentWord(chars, idxAfter), chars, textDisplay);
  scrollToCurrent(textDisplay, chars, idxAfter);
}