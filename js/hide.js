// js/hide.js
// Pre-typing: first word (or first two) blink by opacity (visible/invisible).
// When you switch from "current" -> "currentNext" before typing, both targets
// are hard-restarted together so they blink in sync.

let hideSet = new Set();
let revealedWords = new Set(); // words that should stay revealed due to errors/backspace

/* ---------- helpers: pre-typing blink (opacity-based, synced) ---------- */

// remove pre-typing blink markers from ALL chars
function clearPreBlink(chars) {
  chars.forEach(n => n.classList.remove('blink-invis', 'pre-hide-target'));
}

// add blink to given word indices; restart ALL targets in-phase
function syncBlinkForTargets(chars, wordTargets, textDisplay) {
  const nodes = [];
  for (const n of chars) {
    const w = Number(n.dataset.word);
    if (wordTargets.has(w)) nodes.push(n);
  }

  // mark + drop any existing blink so we can restart them together
  nodes.forEach(n => {
    n.classList.add('pre-hide-target');
    n.classList.remove('blink-invis');
  });

  // Force a reflow ONCE so all targets restart on the same tick
  void (textDisplay || document.body).offsetWidth;

  // Start both animations at the same instant
  nodes.forEach(n => n.classList.add('blink-invis'));
}

export function updateHide(mode, widx, chars, textDisplay) {
  // Always clear old hiding classes each run
  chars.forEach(c => c.classList.remove('hidden-word'));

  // If hide=off, reset and quit
  if (mode === 'off') {
    revealedWords.clear();
    clearPreBlink(chars);
    return;
  }

  // Have we started typing this run?
  const anyTyped = chars.some(c =>
    c.classList.contains('correct') ||
    c.classList.contains('incorrect') ||
    c.classList.contains('skipped')
  );

  // BEFORE typing: blink the first word(s) by opacity (visible/invisible)
  if (!anyTyped) {
    if (mode === 'current' || mode === 'currentNext') {
      const targets = new Set([widx]);
      if (mode === 'currentNext') targets.add(widx + 1);
      syncBlinkForTargets(chars, targets, textDisplay);
    } else {
      clearPreBlink(chars);
    }
    return; // no actual hiding until typing starts
  }

  // Once typing begins, remove the pre-typing blink entirely
  clearPreBlink(chars);

  // --- PERMA-REVEAL SOURCES --------------------------------------------
  // Any word that was space-skipped or flagged by a "backspace-before-typing"
  // becomes permanently revealed for this run. In Current & Next mode,
  // also reveal the immediately following word.
  const flaggedWords = new Set();
  for (const n of chars) {
    const w = Number(n.dataset.word);
    if (!Number.isFinite(w) || w < 0) continue;
    if (
      n.classList.contains('skipped') ||
      n.dataset.spaceSkipped === '1' ||
      n.dataset.backspaceReveal === '1'
    ) {
      flaggedWords.add(w);
    }
  }
  for (const w of flaggedWords) {
    revealedWords.add(w);          // always keep the skipped/flagged word visible
    if (mode === 'currentNext') {
      revealedWords.add(w + 1);    // and also the next word in Current & Next
    }
  }
  // ----------------------------------------------------------------------

  // ---------- Normal hide logic ----------
  const currentWordHasError = chars.some(c => {
    const w = Number(c.dataset.word);
    return w === widx && c.classList.contains('incorrect');
  });

  const nextWordHasError = mode === 'currentNext' && chars.some(c => {
    const w = Number(c.dataset.word);
    return w === widx + 1 && c.classList.contains('incorrect');
  });

  if (currentWordHasError) {
    revealedWords.add(widx);
    if (mode === 'currentNext') revealedWords.add(widx + 1);
  }
  if (nextWordHasError) revealedWords.add(widx + 1);

  // Build the set of word-indices to hide
  hideSet.clear();
  if (mode === 'current') {
    if (!revealedWords.has(widx)) hideSet.add(widx);
  } else { // currentNext
    if (!revealedWords.has(widx))     hideSet.add(widx);
    if (!revealedWords.has(widx + 1)) hideSet.add(widx + 1);
  }

  // Apply hiding - hide untyped characters in hidden words
  chars.forEach(c => {
    const w = Number(c.dataset.word);
    const typed =
      c.classList.contains('correct') ||
      c.classList.contains('incorrect') ||
      c.classList.contains('skipped');

    if (hideSet.has(w) && !typed) c.classList.add('hidden-word');
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
