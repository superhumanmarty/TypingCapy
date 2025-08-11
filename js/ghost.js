// js/ghost.js - Handles ghost cursor logic (checkbox + custom WPM)
import { chars } from './engine.js';

let ghostIndex = 0;
let ghostAnimationFrame = null;
let ghostStartTime = 0;
let ghostWPM = 0;

export function setupGhost() {
  // Keep WPM field visibility in sync on load (main.js also handles this)
  const toggle  = document.getElementById('ghostModeToggle');
  const wrapper = document.getElementById('ghostWpmWrapper');

  const apply = () => {
    wrapper?.classList.toggle('hidden', !toggle?.checked);
  };

  apply();
  toggle?.addEventListener('change', apply);
}

export function startGhost() {
  // Only run ghost if the checkbox is on
  if (!document.getElementById('ghostModeToggle')?.checked) return;

  ghostIndex = 0;
  ghostStartTime = Date.now();

  // Read WPM, clamp to a sensible range
  const raw = parseInt(document.getElementById('customGhostWPM')?.value || '60', 10);
  ghostWPM = Number.isFinite(raw) ? Math.max(10, Math.min(300, raw)) : 60;

  // Reset any prior loop and start a new one
  if (ghostAnimationFrame) cancelAnimationFrame(ghostAnimationFrame);
  ghostAnimationFrame = requestAnimationFrame(updateGhostCursor);
}

function updateGhostCursor() {
  // Clear prior ghost highlight
  chars.forEach(c => c.classList.remove('ghost'));

  // If ghost was turned off mid-run, stop cleanly
  if (!document.getElementById('ghostModeToggle')?.checked) {
    ghostAnimationFrame = null;
    return;
  }

  if (ghostIndex >= chars.length) {
    ghostAnimationFrame = null;
    return;
  }

  // Progress based on time and target WPM (5 chars/word)
  const elapsedMinutes = (Date.now() - ghostStartTime) / 1000 / 60;
  const targetChars = ghostWPM * 5 * elapsedMinutes;
  ghostIndex = Math.min(Math.floor(targetChars), chars.length - 1);

  chars[ghostIndex]?.classList.add('ghost');

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
