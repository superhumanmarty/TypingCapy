// js/ghost.js - Ghost cursor should ignore user-added "extra" characters
// and characters that were "spaced over" (marked .skipped)

import { chars } from './engine.js';

let ghostIndex = 0;
let ghostAnimationFrame = null;
let ghostStartTime = 0;
let ghostWPM = 0;

// Follow only the base typing path, skipping .extra (user-added)
// and .skipped (prematurely spaced-over) characters.
function getGhostTrack() {
  return chars.filter(c =>
    !c.classList.contains('extra') &&
    !c.classList.contains('skipped')
  );
}

export function setupGhost() {
  const toggle  = document.getElementById('ghostModeToggle');
  const wrapper = document.getElementById('ghostWpmWrapper');
  const apply = () => wrapper?.classList.toggle('hidden', !toggle?.checked);
  apply();
  toggle?.addEventListener('change', apply);
}

export function startGhost() {
  if (!document.getElementById('ghostModeToggle')?.checked) return;

  ghostIndex = 0;
  ghostStartTime = Date.now();

  const raw = parseInt(document.getElementById('customGhostWPM')?.value || '60', 10);
  ghostWPM = Number.isFinite(raw) ? Math.max(10, Math.min(300, raw)) : 60;

  if (ghostAnimationFrame) cancelAnimationFrame(ghostAnimationFrame);
  ghostAnimationFrame = requestAnimationFrame(updateGhostCursor);
}

function updateGhostCursor() {
  // Clear previous ghost marker
  chars.forEach(c => c.classList.remove('ghost'));

  // If ghost was turned off mid-run, stop cleanly
  if (!document.getElementById('ghostModeToggle')?.checked) {
    ghostAnimationFrame = null;
    return;
  }

  const track = getGhostTrack(); // excludes .extra and .skipped
  if (track.length === 0) {
    ghostAnimationFrame = null;
    return;
  }

  // Progress based on time and target WPM (5 chars/word)
  const elapsedMinutes = (Date.now() - ghostStartTime) / 60000;
  const targetChars    = ghostWPM * 5 * elapsedMinutes;
  const nextIndex      = Math.floor(targetChars);

  // If we've moved past the last required char, stop and leave no ghost visible
  if (nextIndex >= track.length) {
    stopGhost();           // <-- clears lingering .ghost and cancels RAF
    return;
  }

  // Otherwise place the ghost caret and continue
  ghostIndex = nextIndex;
  track[ghostIndex].classList.add('ghost');
  ghostAnimationFrame = requestAnimationFrame(updateGhostCursor);
}


export function stopGhost() {
  if (ghostAnimationFrame) cancelAnimationFrame(ghostAnimationFrame);
  ghostAnimationFrame = null;
  chars.forEach(c => c.classList.remove('ghost'));
}

// Keep saveSpeed (used by timer/results)
export function saveSpeed(wpm) {
  localStorage.setItem('lastWPM', wpm);
  const highest = parseInt(localStorage.getItem('highestWPM') || '0', 10);
  if (wpm > highest) {
    localStorage.setItem('highestWPM', wpm);
  }
}
