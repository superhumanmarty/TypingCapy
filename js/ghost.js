// js/ghost.js - Handles ghost cursor logic
import { chars } from './engine.js';

let ghostIndex = 0;
let ghostAnimationFrame = null;
let ghostStartTime = 0;
let ghostWPM = 0;

export function setupGhost() {
  const ghostRadios = document.querySelectorAll('input[name="ghostMode"]');
  const customInput = document.getElementById('customGhostWPM');
  const updateGhostVisibility = () => {
    customInput.style.display = [...ghostRadios].find(r => r.checked).value === 'custom' ? 'inline' : 'none';
  };
  updateGhostVisibility();
  ghostRadios.forEach(r => r.addEventListener('change', updateGhostVisibility));
}

export function startGhost() {
  const mode = document.querySelector('input[name="ghostMode"]:checked').value;
  if (mode === 'off') return;

  ghostIndex = 0;
  ghostStartTime = Date.now();

  if (mode === 'last') {
    ghostWPM = parseInt(localStorage.getItem('lastWPM') || '0');
  } else if (mode === 'highest') {
    ghostWPM = parseInt(localStorage.getItem('highestWPM') || '0');
  } else if (mode === 'custom') {
    ghostWPM = parseInt(document.getElementById('customGhostWPM').value) || 60;
  }

  if (ghostWPM <= 0) ghostWPM = 60; // Default to 60 if no saved speed

  updateGhostCursor();
}

function updateGhostCursor() {
  // Remove old ghost
  chars.forEach(c => c.classList.remove('ghost'));

  if (ghostIndex >= chars.length) {
    cancelAnimationFrame(ghostAnimationFrame);
    return;
  }

  // Calculate progress
  const elapsed = (Date.now() - ghostStartTime) / 1000 / 60; // minutes
  const targetChars = ghostWPM * 5 * elapsed;
  ghostIndex = Math.min(Math.floor(targetChars), chars.length - 1);

  // Add ghost class
  chars[ghostIndex]?.classList.add('ghost');

  ghostAnimationFrame = requestAnimationFrame(updateGhostCursor);
}

export function stopGhost() {
  cancelAnimationFrame(ghostAnimationFrame);
  chars.forEach(c => c.classList.remove('ghost'));
}

export function saveSpeed(wpm) {
  localStorage.setItem('lastWPM', wpm);
  const highest = parseInt(localStorage.getItem('highestWPM') || '0');
  if (wpm > highest) {
    localStorage.setItem('highestWPM', wpm);
  }
}