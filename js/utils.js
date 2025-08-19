// js/utils.js
// returns the word-index of the current cursor
export function getCurrentWord(chars, currentIndex) {
  let idx = Number(chars[currentIndex]?.dataset.word);
  if (isNaN(idx) || idx < 0) {
    for (let i = currentIndex - 1; i >= 0; i--) {
      const w = Number(chars[i].dataset.word);
      if (!isNaN(w) && w >= 0) {
        idx = w;
        break;
      }
    }
  }
  return idx;
}

export function scrollToCurrent(textDisplay, chars, index){
  if (!textDisplay || !chars || !chars.length) return;

  const i = Math.max(0, Math.min(index, chars.length - 1));
  const cur  = chars[i];
  const prev = i > 0 ? chars[i - 1] : null;

  // only consider Space/Enter as scroll triggers
  const triggerIsSpace  = !!(prev && prev.textContent === ' ');
  const triggerIsEnter  = !!(prev && prev.textContent === '\n');
  if (!triggerIsSpace && !triggerIsEnter) return;

  const pRect = textDisplay.getBoundingClientRect();
  const cRect = (cur.getClientRects()[0] || cur.getBoundingClientRect());
  const pr    = prev ? (prev.getClientRects()[0] || prev.getBoundingClientRect()) : null;

  // detect a new visual line (vertical jump bigger than ~0.6 of line height)
  let crossedLine = false;
  if (pr) {
    const lh = Math.max(
      cRect.height || 0,
      pr.height    || 0,
      parseFloat(getComputedStyle(cur).lineHeight) || 0
    );
    crossedLine = Math.abs(cRect.top - pr.top) > lh * 0.6;
  }

  if (!crossedLine) return;

  // center the current line in the panel
  const caretY   = (cRect.top - pRect.top) + textDisplay.scrollTop;
  const desired  = Math.max(0, caretY - (textDisplay.clientHeight / 2 - cRect.height / 2));
  const maxTop   = Math.max(0, textDisplay.scrollHeight - textDisplay.clientHeight);
  textDisplay.scrollTo({ top: Math.min(desired, maxTop), behavior: 'auto' });
}


// WPM = (correctChars / 5) / minutes
export function calculateWPM(startTime, correctChars) {
  if (!startTime || startTime === 0) return 0;
  const mins = (Date.now() - startTime) / 1000 / 60;
  return mins > 0 ? Math.round((correctChars / 5) / mins) : 0;
}

// accuracy percentage = (correct / totalAttempted) * 100
// totalAttempted includes: correct, incorrect, skipped, and extra characters
export function calculateAccuracy(totalAttempted, correctChars) {
  return totalAttempted > 0 ? Math.round((correctChars / totalAttempted) * 100) : 100;
}

export function clearTypedErrorBubble() {
  const ted = document.getElementById('typedErrorDisplay');
  const tl  = document.getElementById('typedLetter');
  if (ted) ted.classList.add('hidden');
  if (tl)  tl.textContent = '';
}
