// backspace.js

import { chars, setCurrentIndex } from '../engine.js';
import { getCurrentWord, scrollToCurrent } from '../utils.js';
import { updateHide } from '../hide.js';
import { playPentatonic, playBlip, playClick, playErrorBuzz, getSoundMode } from '../sound.js';
import { canSkip, setCanSkip, skipFrom, skipTo, setSkipFrom, setSkipTo } from './space.js';

function getCurrent() {
  return import('../engine.js').then(m => m.currentIndex);
}

export async function handleBackspace(textDisplay, hideRadios) {
  const currentIndex = await getCurrent();
  if (currentIndex <= 0) return;

  // No error buzz on backspace anymore (creative decision change)
 
  // Check if the previous character is an extra character
  if (currentIndex > 0 && chars[currentIndex - 1].classList.contains('extra')) {
    // Remove the extra character from DOM and array
    chars[currentIndex - 1].remove();
    chars.splice(currentIndex - 1, 1);
    
    // Move cursor back
    setCurrentIndex(currentIndex - 1);
    
    // Re-add current class to the character we're now at
    if (currentIndex - 1 < chars.length) {
      chars[currentIndex - 1].classList.add('current');
    }
    
    return; // Exit early, no need to update hiding etc.
  }
  
  // Check if we're at the start of a word after skipped content
  // This handles both spaces and newlines after skipped words
  let foundSkipped = false;
  let skipStart = -1;
  
  // Look backwards to see if we just came from skipped content
  for (let i = currentIndex - 1; i >= 0; i--) {
    if (chars[i].classList.contains('skipped')) {
      foundSkipped = true;
      // Keep going back to find the start of the skip
      skipStart = i;
      while (skipStart > 0 && chars[skipStart - 1].classList.contains('skipped')) {
        skipStart--;
      }
      break;
    }
    // Stop looking if we hit a typed character (not space/newline)
    if (chars[i].textContent !== ' ' && chars[i].textContent !== '\n' &&
        (chars[i].classList.contains('correct') || chars[i].classList.contains('incorrect'))) {
      break;
    }
  }
  
  // If we found skipped content and we're at the start of a new word
  if (foundSkipped && skipStart !== -1) {
    // Check if cursor is at word start (beginning of text or after space/newline)
    const atWordStart = currentIndex === 0 || 
                       (currentIndex > 0 && (chars[currentIndex - 1].textContent === ' ' || 
                                           chars[currentIndex - 1].textContent === '\n'));
    
    if (atWordStart) {
      // Clear all skipped markers
      for (let i = skipStart; i < chars.length && chars[i].classList.contains('skipped'); i++) {
        chars[i].classList.remove('skipped');
      }
      
      // Clear any space/newline we might have typed after the skip
      if (currentIndex > 0) {
        chars[currentIndex - 1].classList.remove('correct', 'incorrect');
      }
      
      // Move cursor back to start of skip
      chars[currentIndex]?.classList.remove('current');
      setCurrentIndex(skipStart);
      chars[skipStart].classList.add('current');
      
      setCanSkip(true);
      setSkipFrom(null);
      setSkipTo(null);
      
      // Update hiding and scroll
      const mode = [...hideRadios].find(r => r.checked).value;
      const w = getCurrentWord(chars, skipStart);
      updateHide(mode, w, chars, textDisplay);
      scrollToCurrent(textDisplay, chars, skipStart);
      return; // Exit early
    }
  }
  
  // Old check for backwards compatibility - if we're directly after a space following skipped words
  if (currentIndex > 0 && 
      chars[currentIndex - 1].textContent === ' ' &&
      currentIndex > 1 &&
      chars[currentIndex - 2].classList.contains('skipped')) {
    
    // Find start of skipped section
    let skipStart = currentIndex - 2;
    while (skipStart > 0 && chars[skipStart - 1].classList.contains('skipped')) {
      skipStart--;
    }
    
    // Clear all skipped markers
    for (let i = skipStart; i <= currentIndex - 2; i++) {
      chars[i].classList.remove('skipped');
    }
    
    // Also clear the space we typed
    chars[currentIndex - 1].classList.remove('correct', 'incorrect');
    
    // Move cursor to start of skip
    chars[currentIndex]?.classList.remove('current');
    setCurrentIndex(skipStart);
    chars[skipStart].classList.add('current');
    
    setCanSkip(true);
    setSkipFrom(null);
    setSkipTo(null);
  } else {
    // Normal backspace - just go back one
    chars[currentIndex]?.classList.remove('current');
    setCurrentIndex(currentIndex - 1);
    
    chars[currentIndex - 1].classList.remove('correct', 'incorrect');
    chars[currentIndex - 1].classList.add('current');
    
    // Hide the typed error display
    const errorDisplay = document.getElementById('typedErrorDisplay');
    if (errorDisplay) errorDisplay.classList.add('hidden');
    
    // Allow skipping again if at word start
    if (currentIndex - 1 === 0 || (currentIndex - 2 >= 0 && chars[currentIndex - 2]?.textContent === ' ')) {
      setCanSkip(true);
    }
    
    // If we backspaced in a hidden word, reveal it
    const mode = [...hideRadios].find(r => r.checked).value;
    if (mode !== 'off') {
      const w = getCurrentWord(chars, currentIndex - 1);
      // Manually reveal the word by marking it as having an error temporarily
      chars[currentIndex - 1].classList.add('incorrect');
      updateHide(mode, w, chars, textDisplay);
      chars[currentIndex - 1].classList.remove('incorrect');
    }
  }
  
  // Clear any incorrect markings ahead
  const newIndex = await getCurrent();
  for (let i = newIndex + 1; i < chars.length; i++) {
    if (!chars[i].classList.contains('correct') && !chars[i].classList.contains('skipped')) {
      chars[i].classList.remove('incorrect');
    }
  }
  
  // Update hiding
  const mode = [...hideRadios].find(r => r.checked).value;
  const w = getCurrentWord(chars, newIndex);
  updateHide(mode, w, chars, textDisplay);
  
  scrollToCurrent(textDisplay, chars, newIndex);
}