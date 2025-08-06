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

// scrolls the display so the current span is visible
export function scrollToCurrent(textDisplay, chars, currentIndex) {
  const box = textDisplay, c = chars[currentIndex];
  if (!c) return;
  const lh = parseFloat(getComputedStyle(box).lineHeight);
  // Add a small delay to allow browser reflow time
  setTimeout(() => {
    const top = c.offsetTop;
    box.scrollTop = Math.max(0, top - lh);
  }, 50); // 50ms delay for reflow
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