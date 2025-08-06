// main.js
// hi this is a change
import { updateHighlight } from './highlight.js';
import { calculateWPM, calculateAccuracy, getCurrentWord } from './utils.js';
import { updateHide } from './hide.js';
import { initializeTyping, appendTyping, chars, currentIndex, startTime, setCurrentIndex, setStartTime, originalLength } from './engine.js';
import { setupHide, watchHideRadios } from './settings.js';
import { bindThemeSelectors } from './theme.js';
import { handleChar } from './handlers/char.js';
import { handleSpace } from './handlers/space.js';
import { handleBackspace } from './handlers/backspace.js';
import { handleExtra } from './handlers/extra.js';
import { setupKeyboardDiagram, watchKeyboardRadios, handleKeyboardState } from './keyboard.js';
import { startTimer, resetTimer, setupRestartButton, watchTimerRadios, isGameEnded, endTimer, getTimerDuration, showInitialTimer } from './timer.js';
import { setupGhost, startGhost, stopGhost, saveSpeed } from './ghost.js';

const textDisplay = document.getElementById('textDisplay');
const hideRadios = document.querySelectorAll('input[name="hideWords"]');
const themeSelector = document.getElementById('themeSelector');
const colorPickers = [...document.querySelectorAll('input[type="color"]')];
const wpmSpan = document.getElementById('wpm');
const accSpan = document.getElementById('accuracy');

window.addEventListener('DOMContentLoaded', async () => {
  const configs = await fetch('./data/language_configs.json').then(res => res.json());
  window.configs = configs; // Make configs global for access

  const languageNames = {
    'c': 'C',
    'c#': 'C#',
    'c++': 'C++',
    'eng': 'English',
    'indo': 'Indonesian',
    'java': 'Java',
    'js': 'JavaScript',
    'php': 'PHP',
    'python': 'Python',
    'r': 'R',
    'rus': 'Russian (Русский)',
    'sql': 'SQL'
  };

  // Populate language selector
  const languageSelector = document.getElementById('languageSelector');
  Object.keys(configs).sort().forEach(lang => {
    const opt = document.createElement('option');
    opt.value = lang;
    opt.textContent = languageNames[lang] || lang.toUpperCase(); // Fallback to uppercase code if not mapped
    languageSelector.appendChild(opt);
  });
  languageSelector.value = 'eng'; // Default to English

  // Function to update UI based on selected language
  function updateUIForLanguage() {
    const lang = languageSelector.value;
    const conf = configs[lang];

    const wordListSizeSettings = document.getElementById('wordListSizeSettings');
    wordListSizeSettings.innerHTML = '<span>Word List Size:</span>';
    if (conf.word_lists.length > 0) {
      wordListSizeSettings.classList.remove('hidden');
      conf.word_lists.forEach(size => {
        const label = document.createElement('label');
        label.innerHTML = `<input type="radio" name="wordListSize" value="${size}" ${size === conf.word_lists[0] ? 'checked' : ''}> ${size}`;
        wordListSizeSettings.appendChild(label);
      });
    } else {
      wordListSizeSettings.classList.add('hidden');
    }

    const togglesSettings = document.getElementById('togglesSettings');
    if (conf.type === 'human') {
      togglesSettings.classList.remove('hidden');
    } else {
      togglesSettings.classList.add('hidden');
    }

    const modeSettings = document.getElementById('modeSettings');
    const paragraphsRadio = modeSettings.querySelector('input[value="paragraphs"]');
    if (conf.paragraphs) {
      paragraphsRadio.disabled = false;
    } else {
      paragraphsRadio.disabled = true;
      modeSettings.querySelector('input[value="random"]').checked = true;
    }

    // Disable keyboard guide for Russian
    const keyboardSettings = document.getElementById('keyboardDiagramSettings');
    const keyboardOff = document.querySelector('input[name="keyboardDiagram"][value="off"]');
    const keyboardOn = document.querySelector('input[name="keyboardDiagram"][value="on"]');
    if (lang === 'rus') {
      keyboardOff.checked = true;
      keyboardOn.disabled = true;
      keyboardSettings.classList.add('disabled'); // Optional: add CSS class for gray out
      setupKeyboardDiagram(); // Apply off
    } else {
      keyboardOn.disabled = false;
      keyboardSettings.classList.remove('disabled');
    }
  }

  updateUIForLanguage();

  // Add listeners for changes that trigger reinitialization
  languageSelector.addEventListener('change', async () => {
    updateUIForLanguage();
    await initializeTyping(textDisplay, hideRadios);
    showInitialTimer();
  });

  document.querySelectorAll('input[name="mode"]').forEach(r => r.addEventListener('change', async () => await initializeTyping(textDisplay, hideRadios)));

  document.getElementById('wordListSizeSettings').addEventListener('change', async () => await initializeTyping(textDisplay, hideRadios));

  document.getElementById('punctuationToggle').addEventListener('change', async () => await initializeTyping(textDisplay, hideRadios));

  document.getElementById('numbersToggle').addEventListener('change', async () => await initializeTyping(textDisplay, hideRadios));

  document.getElementById('advancedSymbolsToggle').addEventListener('change', async () => await initializeTyping(textDisplay, hideRadios));

  // Initial setup
  await initializeTyping(textDisplay, hideRadios);
  showInitialTimer(); // Added here to show timer initially on load
  setupHide(hideRadios, chars, textDisplay, currentIndex);
  watchHideRadios(hideRadios, () => setupHide(hideRadios, chars, textDisplay, currentIndex));

  const highlightRadios = document.querySelectorAll('input[name="highlightAhead"]');
  const currentWordIdx = getCurrentWord(chars, currentIndex);
  updateHighlight([...highlightRadios].find(r => r.checked).value, currentWordIdx, chars);
  highlightRadios.forEach(r => r.addEventListener('change', () => {
    const wordIdx = getCurrentWord(chars, currentIndex);
    updateHighlight([...highlightRadios].find(x => x.checked).value, wordIdx, chars);
  }));

  bindThemeSelectors(themeSelector, colorPickers);
  document.body.className = `theme-${themeSelector.value}`;

  setupKeyboardDiagram();
  watchKeyboardRadios();

  watchTimerRadios();
  setupRestartButton(initializeTyping, hideRadios);

  watchWordLimitRadios();

  setupGhost();

  document.body.tabIndex = 0;
  document.body.focus();
});

function watchWordLimitRadios() {
  const wordLimitRadios = document.querySelectorAll('input[name="wordLimit"]');
  wordLimitRadios.forEach(r => {
    r.addEventListener('change', async () => {
      await initializeTyping(textDisplay, hideRadios);
      resetTimer();
      setStartTime(0);
      setCurrentIndex(0);
      const hideMode = [...hideRadios].find(x => x.checked).value;
      const widx = getCurrentWord(chars, 0);
      updateHide(hideMode, widx, chars, textDisplay);
      const highlightRadios = document.querySelectorAll('input[name="highlightAhead"]');
      const hmode = [...highlightRadios].find(x => x.checked).value;
      updateHighlight(hmode, widx, chars);
      wpmSpan.textContent = 'WPM: 0';
      accSpan.textContent = 'Accuracy: 100%';
    });
  });
}

// Unified key handler
async function onKey(e) {
  handleKeyboardState(e);
  if (isGameEnded()) return;
  const k = e.key;
  if (k !== 'Backspace' && k !== ' ' && k !== 'Enter' && k.length !== 1) return;
  e.preventDefault();
  if (!startTime) {
    setStartTime(Date.now());
    startGhost();
  }
  startTimer();
  const oldErrors = document.querySelectorAll('.char.incorrect, .char.skipped, .char.extra').length;
  if (k === 'Backspace') {
    await handleBackspace(textDisplay, hideRadios);
  } else if (k === 'Enter') {
    const cur = chars[currentIndex];
    const nxt = chars[currentIndex + 1];
    if (cur?.textContent === '\n') {
      await handleChar('\n', textDisplay, hideRadios);
    } else if (cur?.classList.contains('correct') && nxt?.textContent === '\n') {
      setCurrentIndex(currentIndex + 1);
      await handleChar('\n', textDisplay, hideRadios);
    } else {
      await handleSpace(textDisplay, hideRadios);
    }
  } else if (k === ' ') {
    await handleSpace(textDisplay, hideRadios);
  } else {
    const idx = currentIndex;
    const cur = idx < chars.length ? chars[idx] : null;
    if (!cur || cur.textContent === ' ' || cur.textContent === '\n' || cur.classList.contains('correct')) {
      await handleExtra(k, textDisplay, hideRadios);
    } else {
      await handleChar(k, textDisplay, hideRadios);
    }
  }
  const correctCount = document.querySelectorAll('.char.correct').length;
  const incorrectCount = document.querySelectorAll('.char.incorrect').length;
  const skippedCount = document.querySelectorAll('.char.skipped').length;
  const extraCount = document.querySelectorAll('.char.extra').length;
  const totalErrors = incorrectCount + skippedCount + extraCount;
  const totalAttempted = correctCount + totalErrors;
  wpmSpan.textContent = `WPM: ${calculateWPM(startTime, correctCount)}`;
  accSpan.textContent = `Accuracy: ${calculateAccuracy(totalAttempted, correctCount)}%`;
  const newErrors = document.querySelectorAll('.char.incorrect, .char.skipped, .char.extra').length;
  const strictMode = document.querySelector('input[name="strictMode"]:checked').value === 'on';
  if (strictMode && newErrors > oldErrors) endTimer();
  const minWPMMode = document.querySelector('input[name="minWPM"]:checked').value === 'on';
  if (minWPMMode && totalAttempted > 0) {
    const minWPM = parseInt(document.getElementById('minWPMThreshold').value);
    const currentWPM = parseInt(wpmSpan.textContent.replace('WPM: ', ''));
    if (currentWPM < minWPM) endTimer();
  }
  const minAccuracyMode = document.querySelector('input[name="minAccuracy"]:checked').value === 'on';
  if (minAccuracyMode && totalAttempted > 0) {
    const minAccuracy = parseInt(document.getElementById('minAccuracyThreshold').value);
    const currentAccuracy = parseFloat(accSpan.textContent.replace('Accuracy: ', '').replace('%', ''));
    if (currentAccuracy < minAccuracy) endTimer();
  }
  const wordLimitStr = document.querySelector('input[name="wordLimit"]:checked').value;
  const wordLimit = wordLimitStr === 'off' ? 0 : parseInt(wordLimitStr);
  if (wordLimit > 0) {
    const wordStatus = {};
    chars.forEach(c => {
      const w = Number(c.dataset.word);
      if (w >= 0) {
        if (!wordStatus[w]) wordStatus[w] = true;
        if (!(c.classList.contains('correct') || c.classList.contains('incorrect') || c.classList.contains('skipped'))) {
          wordStatus[w] = false;
        }
      }
    });
    const completedCount = Object.values(wordStatus).filter(s => s).length;
    if (completedCount >= wordLimit) endTimer();
  }
  // Append new paragraph if near end in paragraphs mode (always, to provide text until limits hit)
  const mode = document.querySelector('input[name="mode"]:checked').value;
  if (mode === 'paragraphs') {
    if (currentIndex >= originalLength - 50) {  // Append when near end, regardless of limits
      await appendTyping(textDisplay, hideRadios);
    }
  } else {
    // For random mode, end if no timer/word limit and at end
    if (getTimerDuration() === 0 && wordLimit === 0 && currentIndex >= originalLength) endTimer();
  }
  // Separate check for no-text end (but since we append, it shouldn't trigger in paragraphs)
  if (getTimerDuration() === 0 && wordLimit === 0 && currentIndex >= originalLength) endTimer();
  const hmode = [...document.querySelectorAll('input[name="highlightAhead"]')].find(r => r.checked).value;
  const widx = getCurrentWord(chars, currentIndex);
  updateHighlight(hmode, widx, chars);
  const hideMode = [...document.querySelectorAll('input[name="hideWords"]')].find(r => r.checked).value;
  const w = getCurrentWord(chars, currentIndex);
  updateHide(hideMode, w, chars, textDisplay);
}

document.addEventListener('keydown', onKey);
document.addEventListener('keyup', (e) => handleKeyboardState(e));