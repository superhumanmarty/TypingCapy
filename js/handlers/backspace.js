// js/handlers/backspace.js
import { chars, setCurrentIndex } from '../engine.js';
import { getCurrentWord, scrollToCurrent, clearTypedErrorBubble } from '../utils.js';
import { updateHide } from '../hide.js';
import { getHideMode } from '../settings.js';
import { setState } from '../app/state.js';

function getCurrent() {
  return import('../engine.js').then(m => m.currentIndex);
}

export async function handleBackspace(textDisplay, hideControl) {
  const currentIndex = await getCurrent();
  if (currentIndex <= 0) return;

  const prev = currentIndex > 0 ? chars[currentIndex - 1] : null;

  // If we're deleting the SAME wrong char that triggered the bubble, hide immediately.
  if (prev && prev.classList.contains('incorrect') && !prev.classList.contains('extra')) {
    if (window.capyLastErrorIndex === currentIndex - 1) {
      clearTypedErrorBubble();
      window.capyLastErrorIndex = -1;
    }
  }

  // Remove "extra" char if present
  if (currentIndex > 0 && chars[currentIndex - 1].classList.contains('extra')) {
    setState(chars[currentIndex - 1], null);
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
  (function markBackspaceRevealIfAtWordStart() {
    const idx  = currentIndex;
    const prv  = idx > 0 ? chars[idx - 1] : null;
    const cur  = idx < chars.length ? chars[idx] : null;
    if (!prv || !cur) return;
    if (prv.textContent !== ' ' && prv.textContent !== '\n') return;

    const w = Number(cur.dataset.word);
    if (!Number.isFinite(w) || w < 0) return;

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
        setState(chars[i], null);
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
      setState(chars[i], null);
    }
    chars[currentIndex - 1].classList.remove('correct', 'incorrect');
    chars[currentIndex]?.classList.remove('current');
    setCurrentIndex(s);
    chars[s].classList.add('current');
  } else {
    chars[currentIndex]?.classList.remove('current');
    setCurrentIndex(currentIndex - 1);
    // Remove correctness marks from the char we moved onto
    chars[currentIndex - 1].classList.remove('correct', 'incorrect');
    setState(chars[currentIndex - 1], null);
    chars[currentIndex - 1].classList.add('current');

    // NOTE: we intentionally DO NOT hide the error bubble here for normal backspaces
    // over correct chars or spaces. That preserves the linger behavior.
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
