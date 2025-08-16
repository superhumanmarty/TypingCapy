// js/ui/language.js

import { setupSubtoggleVisibility } from './pills.js';
import { getCurrentWord } from '../utils.js';
import { chars } from '../engine.js';
import { updateHighlight } from '../highlight.js';
import { getHighlightMode } from '../settings.js';

export function initLanguageListeners(configs, {
  textDisplay,
  hideControl,
  highlightControl,
  initializeTyping,
  positionKeyboardDiagram,
  showInitialProgress,
  resetGameLock,
  setWordsForHistoryFromChars,
  enforceWordLimitAvailability
}) {
  const languageSelector   = document.getElementById('languageSelector');
  const wordListSizeSelect = document.getElementById('wordListSizeSelector');

  languageSelector?.addEventListener('change', async () => {
    updateUIForLanguage(configs);
    enforceWordLimitAvailability();
    await initializeTyping(textDisplay, hideControl);
    setWordsForHistoryFromChars();
    positionKeyboardDiagram();
    showInitialProgress();
    const widx = getCurrentWord(chars, 0);
    updateHighlight(getHighlightMode(highlightControl), widx, chars);
    resetGameLock();
  });

  wordListSizeSelect?.addEventListener('change', async () => {
    enforceWordLimitAvailability();
    await initializeTyping(textDisplay, hideControl);
    setWordsForHistoryFromChars();
    positionKeyboardDiagram();
    showInitialProgress();
    const widx = getCurrentWord(chars, 0);
    updateHighlight(getHighlightMode(highlightControl), widx, chars);
    resetGameLock();
  });

  ['punctuationToggle','numbersToggle','numbersExprToggle','symbolsToggle']
    .forEach(id => {
      const el = document.getElementById(id);
      el?.addEventListener('change', async () => {
        setupSubtoggleVisibility();
        await initializeTyping(textDisplay, hideControl);
        setWordsForHistoryFromChars();
        positionKeyboardDiagram();
        showInitialProgress();
        const widx = getCurrentWord(chars, 0);
        updateHighlight(getHighlightMode(highlightControl), widx, chars);
        resetGameLock();
      });
    });
}


// Map codes to friendly names (kept here to declutter main.js)
const LANGUAGE_NAMES = {
  'c': 'C', 'c#': 'C#', 'c++': 'C++', 'eng': 'English', 'indo': 'Indonesian',
  'java': 'Java', 'js': 'JavaScript', 'php': 'PHP', 'python': 'Python',
  'r': 'R', 'rus': 'Russian (Русский)', 'sql': 'SQL'
};

export function populateLanguageOptions(configs) {
  const languageSelector = document.getElementById('languageSelector');
  if (!languageSelector) return;
  languageSelector.innerHTML = '';
  Object.keys(configs).sort().forEach(lang => {
    const opt = document.createElement('option');
    opt.value = lang;
    opt.textContent = LANGUAGE_NAMES[lang] || lang.toUpperCase();
    languageSelector.appendChild(opt);
  });
  // set default
  languageSelector.value = 'eng';
}

export function updateUIForLanguage(configs) {
  const languageSelector = document.getElementById('languageSelector');
  if (!languageSelector) return;

  const lang = languageSelector.value;
  const conf = configs[lang];

  const wordListSizeSettings = document.getElementById('wordListSizeSettings');
  const wordListSizeSelector = document.getElementById('wordListSizeSelector');
  if (wordListSizeSelector) wordListSizeSelector.innerHTML = '';

  // Show word list sizes for human word-list modes only
  if (Array.isArray(conf.word_lists) && conf.word_lists.length > 0) {
    wordListSizeSettings?.classList.remove('hidden');
    conf.word_lists.forEach((size, index) => {
      const option = document.createElement('option');
      option.value = size;
      option.textContent = `${size} words`;
      if (index === 0) option.selected = true;
      wordListSizeSelector?.appendChild(option);
    });
  } else {
    wordListSizeSettings?.classList.add('hidden');
  }

  // Human vs code-language toggles
  const togglesSettings = document.getElementById('togglesSettings');
  if (conf.type === 'human') togglesSettings?.classList.remove('hidden');
  else                       togglesSettings?.classList.add('hidden');

  // Keyboard guide: disable for Russian
  const keyboardSettings = document.getElementById('keyboardDiagramSettings');
  const keyboardToggle   = document.getElementById('keyboardDiagramToggle');
  if (lang === 'rus') {
    if (keyboardToggle) {
      keyboardToggle.checked = false;
      keyboardToggle.disabled = true;
    }
    keyboardSettings?.classList.add('disabled');
  } else {
    if (keyboardToggle) keyboardToggle.disabled = false;
    keyboardSettings?.classList.remove('disabled');
  }

  // Reflect keyboard toggle into panel
  const kbPanel = document.getElementById('keyboardDiagram');
  if (kbPanel && keyboardToggle) {
    kbPanel.classList.toggle('hidden', !keyboardToggle.checked);
  }
}
