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

  // Did we just commit something that can move us to a new line?
  const justTypedSpace = !!(prev && prev.textContent === ' ');
  const justTypedEnter = !!(prev && prev.textContent === '\n');
  const justTypedExtra = !!(prev && prev.classList && prev.classList.contains('extra'));
  if (!justTypedSpace && !justTypedEnter && !justTypedExtra) return;

  const pRect = textDisplay.getBoundingClientRect();
  const cRect = (cur.getClientRects()[0] || cur.getBoundingClientRect());
  const pr    = prev ? (prev.getClientRects()[0] || prev.getBoundingClientRect()) : null;

  // If it was an EXTRA, always re-center (wrap detection can be timing-sensitive)
  let crossedLine = justTypedExtra;

  if (!crossedLine && pr) {
    const lh = Math.max(
      cRect.height || 0,
      pr.height    || 0,
      parseFloat(getComputedStyle(cur).lineHeight) || 0
    );
    crossedLine = Math.abs(cRect.top - pr.top) > lh * 0.6;
  }

  if (!crossedLine) return;

  // Center current line (line 2 of 3) with smooth animation
  const caretY  = (cRect.top - pRect.top) + textDisplay.scrollTop;
  const desired = Math.max(0, caretY - (textDisplay.clientHeight / 2 - cRect.height / 2));
  const maxTop  = Math.max(0, textDisplay.scrollHeight - textDisplay.clientHeight);
  textDisplay.scrollTo({ top: Math.min(desired, maxTop), behavior: 'smooth' });
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
