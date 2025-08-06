// js/timer.js - Handles timer functionality
import { stopGhost, saveSpeed } from './ghost.js';
let timerInterval = null;
let timeRemaining = 0;
let timerStarted = false;
let timerDuration = 0;
let gameEnded = false;
const timerDisplay = document.getElementById('timerDisplay');
const timeRemainingSpan = document.getElementById('timeRemaining');
const resultsScreen = document.getElementById('resultsScreen');
const textDisplay = document.getElementById('textDisplay');
const statsDiv = document.getElementById('stats');
const keyboardDiagram = document.getElementById('keyboardDiagram');
const restartButton = document.getElementById('restartButton');
// Get timer duration from radio selection
export function getTimerDuration() {
const timerRadios = document.querySelectorAll('input[name="timer"]');
const selected = [...timerRadios].find(r => r.checked).value;
return selected === 'off' ? 0 : parseInt(selected);
}
// Format time for display (e.g., "1:30" for 90 seconds)
function formatTime(seconds) {
const mins = Math.floor(seconds / 60);
const secs = seconds % 60;
return `${mins}:${secs.toString().padStart(2, '0')}`;
}
// Update timer display
function updateTimerDisplay() {
  timeRemainingSpan.textContent = `Time: ${formatTime(timeRemaining)}`;
}
// Show initial timer value without starting countdown
export function showInitialTimer() {
  const duration = getTimerDuration();
  if (duration > 0) {
    timeRemaining = duration;
    updateTimerDisplay();
    timerDisplay.classList.remove('hidden');
  } else {
    timerDisplay.classList.add('hidden');
  }
}
// Check if game has ended
export function isGameEnded() {
return gameEnded;
}
// Start the timer
export function startTimer() {
if (timerStarted || gameEnded) return;
  timerDuration = getTimerDuration();
if (timerDuration === 0) return; // No timer if off
  timerStarted = true;
  // Timer display is already shown via showInitialTimer
  timerInterval = setInterval(() => {
    timeRemaining--;
    updateTimerDisplay();
if (timeRemaining <= 0) {
      endTimer();
    }
  }, 1000);
}
// End the timer and show results
export function endTimer() {
clearInterval(timerInterval);
  timerInterval = null;
  gameEnded = true;
  stopGhost();
// Hide game elements
  textDisplay.classList.add('hidden');
  statsDiv.classList.add('hidden');
  timerDisplay.classList.add('hidden');
  keyboardDiagram.classList.add('hidden');
// Get final stats
const finalWPM = document.getElementById('wpm').textContent.replace('WPM: ', '');
const finalAccuracy = document.getElementById('accuracy').textContent.replace('Accuracy: ', '');
// Save speed
  saveSpeed(parseInt(finalWPM));
// Update results screen
document.getElementById('finalWPM').textContent = finalWPM;
document.getElementById('finalAccuracy').textContent = finalAccuracy;
// Show results
  resultsScreen.classList.remove('hidden');
}
// Reset timer
export function resetTimer() {
clearInterval(timerInterval);
  timerInterval = null;
  timerStarted = false;
  timeRemaining = 0;
  gameEnded = false;
  timerDisplay.classList.add('hidden');
  stopGhost();
}
// Handle restart
export function setupRestartButton(initializeTyping, hideRadios) {
  restartButton.addEventListener('click', () => {
// Hide results screen
    resultsScreen.classList.add('hidden');
// Show game elements
    textDisplay.classList.remove('hidden');
    statsDiv.classList.remove('hidden');
// Show keyboard if it was enabled
const keyboardEnabled = document.querySelector('input[name="keyboardDiagram"]:checked').value === 'on';
if (keyboardEnabled) {
      keyboardDiagram.classList.remove('hidden');
    }
// Reset timer state
    resetTimer();
// Reinitialize the game
    initializeTyping(textDisplay, hideRadios);
// Scroll to top
    textDisplay.scrollTop = 0;
window.scrollTo(0, 0);
// Refocus
document.body.focus();
// Show initial timer if applicable
    showInitialTimer();
  });
}
// Watch timer radio changes
export function watchTimerRadios() {
const timerRadios = document.querySelectorAll('input[name="timer"]');
  timerRadios.forEach(r => {
    r.addEventListener('change', () => {
// Reset timer if duration changes
if (timerStarted) {
        resetTimer();
      }
// Show initial timer
      showInitialTimer();
    });
  });
}