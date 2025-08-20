// js/handlers/backspace.js
import { chars, setCurrentIndex } from '../engine.js';
import { getCurrentWord, scrollToCurrent } from '../utils.js';
import { updateHide } from '../hide.js';
import { getHideMode } from '../settings.js';

function getCurrent() {
  return import('../engine.js').then(m => m.currentIndex);
}

export async function handleBackspace(textDisplay, hideControl) {
  const currentIndex = await getCurrent();
  if (currentIndex <= 0) return;

  // Remove "extra" char if present
  if (currentIndex > 0 && chars[currentIndex - 1].classList.contains('extra')) {
    chars[currentIndex - 1].remove();
    chars.splice(currentIndex - 1, 1);
    setCurrentIndex(currentIndex - 1);
    if (currentIndex - 1 < chars.length) {
      chars[currentIndex - 1].classList.add('current');
    }
    return;
  }

  // NEW: if caret is at the first char of an untyped word and user backspaces
  // the separating space (or newline), permanently reveal that word.
  // In "Current & Next", also reveal the following word forever.
  (function markBackspaceRevealIfAtWordStart() {
    const idx  = currentIndex;
    const prev = idx > 0 ? chars[idx - 1] : null;
    const cur  = idx < chars.length ? chars[idx] : null;
    if (!prev || !cur) return;

    // Only when the previous char is a separator and we are truly at a word start
    if (prev.textContent !== ' ' && prev.textContent !== '\n') return;
    const w = Number(cur.dataset.word);
    if (!Number.isFinite(w) || w < 0) return;

    // Ensure this word hasn't been typed/skipped yet
    let hasTyped = false;
    for (const n of chars) {
      if (Number(n.dataset.word) === w) {
        const cl = n.classList;
        if (cl.contains('correct') || cl.contains('incorrect') || cl.contains('skipped')) {
          hasTyped = true; break;
        }
      }
    }
    if (hasTyped) return;

    // Flag every char in this word. hide.js will convert this flag into a
    // permanent reveal (and also reveal w+1 in Current & Next).
    for (const n of chars) {
      if (Number(n.dataset.word) === w) {
        n.dataset.backspaceReveal = '1';
      }
    }
  })();
  
  // Detect skipped block just before
  let foundSkipped = false;
  let skipStart = -1;
  for (let i = currentIndex - 1; i >= 0; i--) {
    if (chars[i].classList.contains('skipped')) {
      foundSkipped = true;
      skipStart = i;
      while (skipStart > 0 && chars[skipStart - 1].classList.contains('skipped')) {
        skipStart--;
      }
      break;
    }
    if (chars[i].textContent !== ' ' && chars[i].textContent !== '\n' &&
        (chars[i].classList.contains('correct') || chars[i].classList.contains('incorrect'))) {
      break;
    }
  }
  
  if (foundSkipped && skipStart !== -1) {
    const atWordStart = currentIndex === 0 || 
                       (currentIndex > 0 && (chars[currentIndex - 1].textContent === ' ' || 
                                           chars[currentIndex - 1].textContent === '\n'));
    if (atWordStart) {
      for (let i = skipStart; i < chars.length && chars[i].classList.contains('skipped'); i++) {
        chars[i].classList.remove('skipped');
      }
      if (currentIndex > 0) {
        chars[currentIndex - 1].classList.remove('correct', 'incorrect');
      }
      chars[currentIndex]?.classList.remove('current');
      setCurrentIndex(skipStart);
      chars[skipStart].classList.add('current');
      
      const modeA = getHideMode(hideControl);
      const wA = getCurrentWord(chars, skipStart);
      updateHide(modeA, wA, chars, textDisplay);
      scrollToCurrent(textDisplay, chars, skipStart);
      return;
    }
  }
  
  if (currentIndex > 0 && 
      chars[currentIndex - 1].textContent === ' ' &&
      currentIndex > 1 &&
      chars[currentIndex - 2].classList.contains('skipped')) {
    let s = currentIndex - 2;
    while (s > 0 && chars[s - 1].classList.contains('skipped')) s--;
    for (let i = s; i <= currentIndex - 2; i++) {
      chars[i].classList.remove('skipped');
    }
    chars[currentIndex - 1].classList.remove('correct', 'incorrect');
    chars[currentIndex]?.classList.remove('current');
    setCurrentIndex(s);
    chars[s].classList.add('current');
  } else {
    chars[currentIndex]?.classList.remove('current');
    setCurrentIndex(currentIndex - 1);
    chars[currentIndex - 1].classList.remove('correct', 'incorrect');
    chars[currentIndex - 1].classList.add('current');

    const errorDisplay = document.getElementById('typedErrorDisplay');
    if (errorDisplay) errorDisplay.classList.add('hidden');

    // Reveal current word if backspacing inside a hidden word
    const modeTmp = getHideMode(hideControl);
    if (modeTmp !== 'off') {
      const wTmp = getCurrentWord(chars, currentIndex - 1);
      chars[currentIndex - 1].classList.add('incorrect');
      updateHide(modeTmp, wTmp, chars, textDisplay);
      chars[currentIndex - 1].classList.remove('incorrect');
    }
  }
  
  const newIndex = await getCurrent();
  for (let i = newIndex + 1; i < chars.length; i++) {
    if (!chars[i].classList.contains('correct') && !chars[i].classList.contains('skipped')) {
      chars[i].classList.remove('incorrect');
    }
  }
  
  const mode = getHideMode(hideControl);
  const w = getCurrentWord(chars, newIndex);
  updateHide(mode, w, chars, textDisplay);
  scrollToCurrent(textDisplay, chars, newIndex);
}
