// js/handlers/extra.js
import { chars, setCurrentIndex } from '../engine.js';
import { getCurrentWord, scrollToCurrent, clearTypedErrorBubble } from '../utils.js';
import { updateHide } from '../hide.js';
import { playErrorBuzz, getSoundMode } from '../sound.js';
import { getHideMode } from '../settings.js';


function getCurrent() {
  return import('../engine.js').then(m => m.currentIndex);
}

export async function handleExtra(k, textDisplay, hideControl) {
  clearTypedErrorBubble();
  if (getSoundMode() !== 'off') playErrorBuzz();

  const currentIndex = await getCurrent();
  const extraSpan = document.createElement('span');
  extraSpan.textContent = k;
  extraSpan.className = 'char incorrect extra';

  const currentChar = chars[currentIndex];
  const nextChar = chars[currentIndex + 1];

  if (currentChar) {
    if (nextChar && nextChar.textContent === '\n') {
      currentChar.parentNode.insertBefore(extraSpan, currentChar.nextSibling);
      chars.splice(currentIndex + 1, 0, extraSpan);
      setCurrentIndex(currentIndex + 1);
    } else {
      currentChar.parentNode.insertBefore(extraSpan, currentChar);
      chars.splice(currentIndex, 0, extraSpan);
      setCurrentIndex(currentIndex + 1);
    }
  } else {
    textDisplay.appendChild(extraSpan);
    chars.push(extraSpan);
    setCurrentIndex(chars.length - 1);
  }

  chars.forEach(c => c.classList.remove('current'));
  chars[await getCurrent()]?.classList.add('current');

  const updatedIndex = await getCurrent();
  const mode = getHideMode(hideControl);
  updateHide(mode, getCurrentWord(chars, updatedIndex), chars, textDisplay);
  scrollToCurrent(textDisplay, chars, updatedIndex);
}
