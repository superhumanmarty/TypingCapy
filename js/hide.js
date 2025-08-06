// js/hide.js: updateHide(mode, wordIdx, chars, textDisplay) — applies .hidden-word to the right word‑indices

import { getCurrentWord } from './utils.js';

let hideSet = new Set();
let revealedWords = new Set(); // Words that should stay revealed due to errors/backspace

export function updateHide(mode, widx, chars, textDisplay) {
  // always clear old hiding…
  chars.forEach(c => c.classList.remove('hidden-word'));

  // if hide=off, reset and quit
  if (mode === 'off') {
    revealedWords.clear();
    return;
  }

  // don't start hiding until you've typed or skipped something
  const anyTyped = chars.some(c =>
    c.classList.contains('correct') ||
    c.classList.contains('incorrect') ||
    c.classList.contains('skipped')
  );
  if (!anyTyped) {
    // nothing typed yet → leave everything visible
    return;
  }

  // Check if current word should be revealed (has any errors)
  const currentWordHasError = chars.some(c => {
    const w = Number(c.dataset.word);
    return w === widx && c.classList.contains('incorrect');
  });

  // Check if next word should be revealed (for currentNext mode)
  const nextWordHasError = mode === 'currentNext' && chars.some(c => {
    const w = Number(c.dataset.word);
    return w === widx + 1 && c.classList.contains('incorrect');
  });

  // Reveal logic: always reveal current, and in currentNext mode also reveal next
  if (currentWordHasError) {
    revealedWords.add(widx);
    if (mode === 'currentNext') {
      revealedWords.add(widx + 1);
    }
  }

  // If the next word itself has an error, reveal it too
  if (nextWordHasError) {
    revealedWords.add(widx + 1);
  }

  // Build the set of word-indices to hide
  hideSet.clear();
  if (mode === 'current') {
    if (!revealedWords.has(widx)) {
      hideSet.add(widx);
    }
  } else { // currentNext
    if (!revealedWords.has(widx)) {
      hideSet.add(widx);
    }
    if (!revealedWords.has(widx + 1)) {
      hideSet.add(widx + 1);
    }
  }

  // Apply hiding - hide untyped characters in hidden words
  chars.forEach(c => {
    const w = Number(c.dataset.word);
    const typed = c.classList.contains('correct') || 
                  c.classList.contains('incorrect') || 
                  c.classList.contains('skipped');
    // Note: removed 'current' from typed check - cursor position should be hidden too

    // Hide if: word is in hideSet AND character is not typed
    if (hideSet.has(w) && !typed) {
      c.classList.add('hidden-word');
    }
  });
}

// Clear a word from the revealed set when it's completed successfully
export function clearRevealedWord(wordIdx) {
  revealedWords.delete(wordIdx);
}

// Reset revealed words when starting a new word cleanly
export function resetRevealedWords() {
  revealedWords.clear();
}