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
  // coding
  'c': 'C', 'c#': 'C#', 'c++': 'C++',
  'java': 'Java', 'js': 'JavaScript', 'php': 'PHP',
  'python': 'Python', 'r': 'R', 'sql': 'SQL',

  // human
  'eng': 'English',
  'indo': 'Indonesian',
  'rus': 'Russian (Русский)',

  // new grouped “languages”
  'goofy': 'Goofy',
  'fictional': 'Fictional'
};

const SUBSET_LABELS = {
  // Goofy
  '4chan': '4chan',
  'baby': 'Baby',
  'brainrot': 'Brainrot',
  'caveman': 'Caveman',
  'cat': 'Cat',
  'goose': 'Goose',
  'lolcat': 'LOLcat',
  'minecraft': 'Minecraft',
  'pirate': 'Pirate',
  'robot': 'Robot',
  'sarcasm': 'SaRcAsM',
  'snake': 'Snake',
  'teenager': 'Teenager',
  'uwu': 'uwu',
  'valley_girl': 'Valley Girl',
  'duck_duck_goose': 'Duck Duck Goose',
  'brainf': 'Brainf***',
  'faces': 'Faces',
  'ook': 'Ook!',
  'alien': 'Alien',
  'jewish': 'Jewish',
  'minion': 'Minion',
  'piglatin': 'Pig Latin',
  'smoke_alarm': 'Smoke Alarm',
  'binary': 'Binary',

  // English extras
  'finance_bro': 'Finance Bro',
  'geo': 'Geography',
  'nerd': 'Nerd',

  // Fictional (with sources)
  'black_speech': 'Black Speech (LOTR)',
  'galach': 'Galach (Dune)',
  'huttese': 'Huttese (Star Wars)',
  'jawaese': 'Jawaese (Star Wars)',
  'klingon': 'Klingon (Star Trek)',
  'matoran': 'Matoran (Bionicle)',
  'nadsat': 'Nadsat (Clockwork Orange)',
  'orcish': 'Orcish (Tolkien/Warcraft/Warhammer)',
  "rlyehian": "R'lyehian (Cthulhu)",
  'sangheili': 'Sangheili (Halo)',
  'valyrian': 'Valyrian (GoT)',
  'harry_potter': 'Harry Potter',
};

// Preferred default subset per “language” group
const PREFERRED_SUBSET_DEFAULTS = {
  goofy: 'alien',
  fictional: 'klingon'
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

  const hasSizes   = Array.isArray(conf.word_lists) && conf.word_lists.length > 0;
  const hasSubsets = conf.subsets && Object.keys(conf.subsets).length > 0;

  if (hasSizes || hasSubsets) {
    wordListSizeSettings?.classList.remove('hidden');

    if (wordListSizeSelector) {
      // Numeric sizes (e.g., 500/1000)
      if (hasSizes) {
        const og = document.createElement('optgroup');
        og.label = 'Word lists';
        conf.word_lists.forEach((size, index) => {
          const opt = document.createElement('option');
          opt.value = String(size); // e.g., "500"
          opt.textContent = `${size} most common words`;
          if (index === 0) opt.selected = true;
          og.appendChild(opt);
        });
        wordListSizeSelector.appendChild(og);
      }


      if (hasSubsets) {
        const og2 = document.createElement('optgroup');
        og2.label = 'Subsets';
        let firstOptionValue = null;

        Object.entries(conf.subsets).forEach(([key, file], idx) => {
          const value = `subset:${file}`;
          const opt = document.createElement('option');
          opt.value = value; // consumed by promptGenerator
          opt.textContent =
            SUBSET_LABELS[key] ||
            key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          if (idx === 0) firstOptionValue = value;
          og2.appendChild(opt);
        });

        wordListSizeSelector.appendChild(og2);

        // Preferred defaults for grouped languages
        const prefKey = PREFERRED_SUBSET_DEFAULTS[lang];
        if (prefKey && conf.subsets[prefKey]) {
          wordListSizeSelector.value = `subset:${conf.subsets[prefKey]}`;
        } else if (firstOptionValue && !wordListSizeSelector.value) {
          // Fallback: ensure *something* is selected
          wordListSizeSelector.value = firstOptionValue;
        }
      }

    }
  } else {
    wordListSizeSettings?.classList.add('hidden');
  }

  // Human vs code-language toggles
  const togglesSettings = document.getElementById('togglesSettings');
  if (conf.type === 'human') togglesSettings?.classList.remove('hidden');
  else                       togglesSettings?.classList.add('hidden');

  // Keyboard guide: disable for Russian only (your original rule)
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

