// js/handlers/extra.js

import { chars, setCurrentIndex } from '../engine.js';
import { getCurrentWord, scrollToCurrent } from '../utils.js';
import { updateHide } from '../hide.js';
import {
  playPentatonic,
  playBlip,
  playClick,
  playErrorBuzz,
  getSoundMode
} from '../sound.js';

function getCurrent() {
  return import('../engine.js').then(m => m.currentIndex);
}

export async function handleExtra(k, textDisplay, hideRadios) {
  // play error buzz
  if (getSoundMode() !== 'off') playErrorBuzz();

  // figure out where we are
  const currentIndex = await getCurrent();

  // build the extra span
  const extraSpan = document.createElement('span');
  extraSpan.textContent = k;
  extraSpan.className = 'char incorrect extra';

  // see what the next real char is
  const currentChar = chars[currentIndex];
  const nextChar = chars[currentIndex + 1];

  if (currentChar) {
    // if we're right before a newline, insert after this char
    if (nextChar && nextChar.textContent === '\n') {
      currentChar.parentNode.insertBefore(extraSpan, currentChar.nextSibling);
      chars.splice(currentIndex + 1, 0, extraSpan);
      setCurrentIndex(currentIndex + 1);
    } else {
      // otherwise insert before the currentChar
      currentChar.parentNode.insertBefore(extraSpan, currentChar);
      chars.splice(currentIndex, 0, extraSpan);
      setCurrentIndex(currentIndex + 1);
    }
  } else {
    // if somehow past the end entirely, just append
    textDisplay.appendChild(extraSpan);
    chars.push(extraSpan);
    setCurrentIndex(chars.length - 1);
  }

  // update the .current class to the new extra span
  // (remove it from everywhere else, just to be safe)
  chars.forEach(c => c.classList.remove('current'));
  chars[await getCurrent()]?.classList.add('current');

  // now reapply hide-words & scroll into view
  const updatedIndex = await getCurrent();
  const mode = [...hideRadios].find(r => r.checked).value;
  updateHide(mode, getCurrentWord(chars, updatedIndex), chars, textDisplay);
  scrollToCurrent(textDisplay, chars, updatedIndex);
}