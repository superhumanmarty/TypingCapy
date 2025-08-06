// js/handlers/space.js
import { chars, setCurrentIndex } from '../engine.js';
import { getCurrentWord, scrollToCurrent } from '../utils.js';
import { updateHide } from '../hide.js';
import { playPentatonic, playBlip, playClick, playErrorBuzz, getSoundMode } from '../sound.js';
import { handleChar } from './char.js';

// Export skip-related variables so other modules can use them
export let skipFrom = null;
export let skipTo = null;
export let canSkip = true; // Keeping for compatibility, but not using in logic

// Export setters for these variables
export function setCanSkip(value) { canSkip = value; }
export function setSkipFrom(value) { skipFrom = value; }
export function setSkipTo(value) { skipTo = value; }

function getCurrent() {
  return import('../engine.js').then(m => m.currentIndex);
}

export async function handleSpace(textDisplay, hideRadios) {
  // get current char
  const currentIndex = await getCurrent();
  const current = chars[currentIndex];

  // proper space → delegate to handleChar with actual key ' '
  if (current.textContent === ' ') {
    return handleChar(' ', textDisplay, hideRadios); // Only for spaces; \n handled by Enter key
  }

  // premature space (or wrong key on \n) → always buzz and skip if in word
  if (getSoundMode() !== 'off') playErrorBuzz();

  // Skip word logic (always for premature, removed canSkip check and \n check)
  skipFrom = currentIndex;
  // Find the end of current word (stop at space or newline)
  let endOfWord = currentIndex;
  while (endOfWord < chars.length && chars[endOfWord].textContent !== ' ' && chars[endOfWord].textContent !== '\n') {
    endOfWord++;
  }
  // Mark characters as skipped (only if there's something to skip)
  if (endOfWord > currentIndex) {
    for (let i = currentIndex; i < endOfWord; i++) {
      chars[i].classList.remove('current', 'correct', 'incorrect');
      chars[i].classList.add('skipped');
    }
  }
  // Move past the space to the first letter of next word
  chars[currentIndex].classList.remove('current');
  let nextWordStart = endOfWord;
  // Skip the space/newline to get to the next word
  if (nextWordStart < chars.length && (chars[nextWordStart].textContent === ' ' || chars[nextWordStart].textContent === '\n')) {
    nextWordStart++;
  }
  setCurrentIndex(nextWordStart);
  if (nextWordStart < chars.length) {
    chars[nextWordStart].classList.add('current');
  }
  // No setCanSkip(false); to allow skipping even after skip
  skipTo = endOfWord;

  // Update hiding
  const updatedIndex = await getCurrent();
  const mode = [...hideRadios].find(r => r.checked).value;
  const w = getCurrentWord(chars, updatedIndex);
  updateHide(mode, w, chars, textDisplay);
  scrollToCurrent(textDisplay, chars, updatedIndex);
}