// js/handlers/space.js
import { chars, setCurrentIndex } from '../engine.js';
import { getCurrentWord, scrollToCurrent } from '../utils.js';
import { updateHide } from '../hide.js';
import { playErrorBuzz, getSoundMode } from '../sound.js';
import { handleChar } from './char.js';
import { getHideMode } from '../settings.js';

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

  // If the expected char is a real space, type it as normal
  if (current && current.textContent === ' ') {
    return handleChar(' ', textDisplay, hideControl);
  }

  // Otherwise: skip the rest of the word
  if (getSoundMode() !== 'off') playErrorBuzz();

  skipFrom = currentIndex;
  let endOfWord = currentIndex;
  while (endOfWord < chars.length && chars[endOfWord].textContent !== ' ' && chars[endOfWord].textContent !== '\n') {
    chars[endOfWord].classList.remove('current', 'correct', 'incorrect');
    chars[endOfWord].classList.add('skipped');
    endOfWord++;
  }

  chars[currentIndex]?.classList.remove('current');

  let nextWordStart = endOfWord;
  if (nextWordStart < chars.length && (chars[nextWordStart].textContent === ' ' || chars[nextWordStart].textContent === '\n')) {
    nextWordStart++;
  }
  setCurrentIndex(nextWordStart);
  if (nextWordStart < chars.length) {
    chars[nextWordStart].classList.add('current');
  }
  skipTo = endOfWord;

  const updatedIndex = await getCurrent();
  const mode = getHideMode(hideControl);
  const w = getCurrentWord(chars, updatedIndex);
  updateHide(mode, w, chars, textDisplay);
  scrollToCurrent(textDisplay, chars, updatedIndex);
}
