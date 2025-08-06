// js/highlight.js — controls look-ahead coloring of words
export function updateHighlight(mode, widx, chars) {
  // clear old highlights
  chars.forEach(c => c.classList.remove('ahead1', 'ahead2', 'blink'));
  if (mode === 'off') return;

  // detect if user has started typing/skipping
  const anyTyped = chars.some(c =>
    c.classList.contains('correct') ||
    c.classList.contains('incorrect') ||
    c.classList.contains('skipped')
  );

  if (!anyTyped) {
    // pre-game behavior
    if (mode === 'next') {
      // color first word
      chars
        .filter(c => Number(c.dataset.word) === 0)
        .forEach(c => c.classList.add('ahead1'));
    } else if (mode === 'next2') {
      // before start: blink first word & color second word
      chars
        .filter(c => Number(c.dataset.word) === 0)
        .forEach(c => {
          c.classList.add('ahead1');
          c.classList.add('blink');
        });
      chars
        .filter(c => Number(c.dataset.word) === 1)
        .forEach(c => c.classList.add('ahead2'));
    }
    return;
  }

  // after game start: highlight based on mode
  if (mode === 'next') {
    // color next word only
    chars
      .filter(c => Number(c.dataset.word) === widx + 1)
      .forEach(c => c.classList.add('ahead1'));
  } else if (mode === 'next2') {
    // color only the second-next word
    chars
      .filter(c => Number(c.dataset.word) === widx + 2)
      .forEach(c => c.classList.add('ahead2'));
  }
}