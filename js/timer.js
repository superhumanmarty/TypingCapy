// js/timer.js - Handles timer and word progress functionality
import { stopGhost, saveSpeed } from './ghost.js';
import { initializeTyping } from './engine.js';

let timerInterval = null;
let timeRemaining = 0;
let timerStarted = false;
let timerDuration = 0;
let gameEnded = false;

const timerDisplay = document.getElementById('timerDisplay');
const timeRemainingSpan = document.getElementById('timeRemaining');
const wordProgress = document.getElementById('wordProgress');
const wordProgressFill = document.getElementById('wordProgressFill');
const resultsScreen = document.getElementById('resultsScreen');
const textDisplay = document.getElementById('textDisplay');
const statsDiv = document.getElementById('stats');
const keyboardDiagram = document.getElementById('keyboardDiagram');
const restartButton = document.getElementById('restartButton');

// Helpers that work with either a <select> or legacy radios
export function getTimerDuration() {
  const sel = document.getElementById('timerSelector');
  if (sel) {
    return sel.value === 'off' ? 0 : parseInt(sel.value);
  }
  const radios = document.querySelectorAll('input[name="timer"]');
  const selected = [...radios].find(r => r.checked)?.value ?? 'off';
  return selected === 'off' ? 0 : parseInt(selected);
}

export function getWordLimit() {
  const sel = document.getElementById('wordLimitSelector');
  if (sel) {
    return sel.value === 'off' ? 0 : parseInt(sel.value);
  }
  const radios = document.querySelectorAll('input[name="wordLimit"]');
  const selected = [...radios].find(r => r.checked)?.value ?? 'off';
  return selected === 'off' ? 0 : parseInt(selected);
}

// Format time for display
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function updateTimerDisplay() {
  timeRemainingSpan.textContent = `Time: ${formatTime(timeRemaining)}`;
}

// Show initial progress (timer or word bar based on settings)
export function showInitialProgress() {
  // If results overlay is up, never show either bar.
  if (document.body.classList.contains('game-ended')) {
    timerDisplay.classList.add('hidden');
    wordProgress.classList.add('hidden');
    wordProgressFill.style.width = '0%';
    return;
  }
  const timerOn = getTimerDuration() > 0;
  const wordLimitOn = getWordLimit() > 0;

  timerDisplay.classList.add('hidden');
  wordProgress.classList.add('hidden');

  if (timerOn) {
    timeRemaining = getTimerDuration();
    updateTimerDisplay();
    timerDisplay.classList.remove('hidden');
    wordProgressFill.style.width = '0%';
  } else if (wordLimitOn) {
    wordProgress.classList.remove('hidden');
    wordProgressFill.style.width = '0%';
    timeRemaining = 0;
  }
}

export function isGameEnded() { return gameEnded; }

export function startTimer() {
  if (timerStarted || gameEnded) return;
  timerDuration = getTimerDuration();
  if (timerDuration === 0) return;
  timerStarted = true;
  timeRemaining = timerDuration;
  timerInterval = setInterval(() => {
    timeRemaining--;
    updateTimerDisplay();
    if (timeRemaining <= 0) endTimer();
  }, 1000);
}

export function endTimer() {
  // ⬇ Hide "You typed" bubble if it's visible
  const ted = document.getElementById('typedErrorDisplay');
  if (ted) ted.classList.add('hidden');
  const tl = document.getElementById('typedLetter');
  if (tl) tl.textContent = '';

  clearInterval(timerInterval);
  timerInterval = null;
  gameEnded = true;

  document.body.classList.add('game-ended');               // ← add this
  const wlBar  = document.getElementById('wordProgress');
  const wlFill = document.getElementById('wordProgressFill');
  wlBar?.classList.add('hidden');                          // ← belt
  if (wlFill) wlFill.style.width = '0%';                   // ← suspenders

  stopGhost();

  // Hide game elements
  textDisplay.classList.add('hidden');
  statsDiv.classList.add('hidden');
  timerDisplay.classList.add('hidden');
  wordProgress.classList.add('hidden');
  keyboardDiagram.classList.add('hidden');

  // Final stats
  const finalWPM = document.getElementById('wpm').textContent.replace('WPM: ', '');
  const finalAccuracy = document.getElementById('accuracy').textContent.replace('Accuracy: ', '');
  saveSpeed(parseInt(finalWPM));
  document.getElementById('finalWPM').textContent = finalWPM;
  document.getElementById('finalAccuracy').textContent = finalAccuracy;
  resultsScreen.classList.remove('hidden');
}


export function resetTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  timerStarted = false;
  timeRemaining = 0;
  gameEnded = false;
  stopGhost();
  wordProgressFill.style.width = '0%';
}

// Handle restart
export function setupRestartButton(initializeTypingFn, hideControl) {
  restartButton.addEventListener('click', async () => {
    document.body.classList.remove('game-ended');   // <-- add this
    resultsScreen.classList.add('hidden');

    textDisplay.classList.remove('hidden');
    statsDiv.classList.remove('hidden');
    const keyboardEnabled = document.querySelector('input[name="keyboardDiagram"]:checked')?.value === 'on';
    if (keyboardEnabled) keyboardDiagram.classList.remove('hidden');

    resetTimer();
    await initializeTypingFn(textDisplay, hideControl);

    textDisplay.scrollTop = 0;
    window.scrollTo(0, 0);
    document.body.focus();
    showInitialProgress();
  });
}

/**
 * Watch for timer changes (works with <select> or radios).
 * When timer is on, force Word Limit to Off (mutually exclusive).
 */
export function watchTimerControl(hideControl) {
  const timerSel = document.getElementById('timerSelector');
  const timerRadios = document.querySelectorAll('input[name="timer"]');

  const onChange = async () => {
    resetTimer();

    // If timer turned on, force Word Limit → Off
    const wlSel = document.getElementById('wordLimitSelector');
    if (getTimerDuration() > 0) {
      if (wlSel) wlSel.value = 'off';
      const wlRadios = document.querySelectorAll('input[name="wordLimit"]');
      wlRadios.forEach(r => { if (r.value === 'off') r.checked = true; });
    }

    await initializeTyping(textDisplay, hideControl);
    showInitialProgress();

    document.getElementById('wpm').textContent = 'WPM: 0';
    document.getElementById('accuracy').textContent = 'Accuracy: 100%';
  };

  if (timerSel) {
    timerSel.addEventListener('change', onChange);
  } else {
    timerRadios.forEach(r => r.addEventListener('change', onChange));
  }
}
