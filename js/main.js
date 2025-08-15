// js/main.js
import { updateHighlight } from './highlight.js';
import { calculateAccuracy, getCurrentWord } from './utils.js';
import { updateHide } from './hide.js';
import { initializeTyping, appendTyping, chars, currentIndex, startTime, setCurrentIndex, setStartTime, originalLength, sanitizeExistingText } from './engine.js';
import { setupHide, watchHideRadios, watchHideSelector, getHideMode, getHighlightMode, watchHighlightSelector, watchHighlightRadios } from './settings.js';
import { bindThemeSelectors } from './theme.js';
import { handleChar } from './handlers/char.js';
import { handleSpace } from './handlers/space.js';
import { handleBackspace } from './handlers/backspace.js';
import { handleExtra } from './handlers/extra.js';
import { setupKeyboardDiagram, handleKeyboardState } from './keyboard.js';
import { startTimer, resetTimer, setupRestartButton, isGameEnded, endTimer, getTimerDuration, showInitialProgress, getWordLimit } from './timer.js';
import { setupGhost, startGhost, stopGhost } from './ghost.js';
import {
  resetMetrics, startMetrics, noteMetrics, renderRunGraph, getLiveWPM,
  setAvgOverrideForRun
} from './metrics.js';

import {
  resetHistory, logCorrect, logIncorrect, logExtra, logBackspace,
  logSpace, logEnter, logSkipped, renderTypingHistory,
  setTargetWordsForRun
} from './history.js';
import { setupCertificate } from './certificate.js';


const textDisplay = document.getElementById('textDisplay');

// Support new <select>s OR legacy radios for both settings
const hideControl =
  document.getElementById('hideWordsSelector') ||
  document.querySelectorAll('input[name="hideWords"]');

const highlightControl =
  document.getElementById('highlightAheadSelector') ||
  document.querySelectorAll('input[name="highlightAhead"]');

const themeSelector = document.getElementById('themeSelector');
const colorPickers = [...document.querySelectorAll('input[type="color"]')];
const wpmSpan = document.getElementById('wpm');
const accSpan = document.getElementById('accuracy');

const WARMUP_MS = 2000; // 2s warmup: hide WPM and ignore WPM threshold

// --- lock so post-finish keystrokes do nothing & WL bar stays gone ---
let gameLocked = false;

// — first-keystroke gating for the WPM graph —
let firstKeySeen = false;
let firstKeyMistake = false;

// Listen for focusMode's "unlock" (ESC at results or TAB restart)
window.addEventListener('capy:unlock', () => {
  // reset first-key flags for the next run
  firstKeySeen = false;
  firstKeyMistake = false;

  resetGameLock();                 // clears gameLocked + removes body.game-ended
  enforceWordLimitAvailability();  // re-show/hide the WL bar correctly
  enforceTimerVisibility();

  // scrub extras & correctness from the existing text so "same words" are clean
  sanitizeExistingText(textDisplay);
  setWordsForHistoryFromChars();

  // Re-apply hide/highlight for word 0 after the scrub
  const widx0 = getCurrentWord(chars, 0);
  updateHide(getHideMode(hideControl), widx0, chars, textDisplay);
  updateHighlight(getHighlightMode(highlightControl), widx0, chars);

  const stats = document.getElementById('stats');
  if (stats) {
    stats.classList.remove('hidden');
    stats.style.removeProperty('display');
    stats.style.removeProperty('visibility');
  }
  // If the keyboard diagram is ON, make sure it’s visible again.
  const kdToggle = document.getElementById('keyboardDiagramToggle');
  const kdPanel  = document.getElementById('keyboardDiagram');
  if (kdToggle?.checked) kdPanel?.classList.remove('hidden');

  // Put focus back on the game so the next key types.
  refocusToGame();
});

// Failsafe: whenever TAB is used to restart, scrub the DOM first.
// Capture=true so we run before other Tab handlers.
document.addEventListener('keydown', (e) => {
  if (e.key === 'Tab' && !document.body.classList.contains('focus-mode')) {
    e.preventDefault(); // don't let focused controls or the page swallow it

    // clean the existing DOM so "same words" are pristine
    sanitizeExistingText(textDisplay);
    setWordsForHistoryFromChars();

    // re-apply hide/highlight for word 0
    const widx0 = getCurrentWord(chars, 0);
    updateHide(getHideMode(hideControl), widx0, chars, textDisplay);
    updateHighlight(getHighlightMode(highlightControl), widx0, chars);

    // optional: reset HUD immediately
    resetMetrics();
    resetTimer();
    setTimerLabelToFull?.();
    wpmSpan.textContent = 'WPM: 0';
    accSpan.textContent = 'Accuracy: 100%';

    // let your existing restart logic continue (e.g., focus-mode unlock)
    window.dispatchEvent(new Event('capy:unlock'));
  }
}, true);


// when the engine regenerates text, reset graph data
window.addEventListener('capy:runReset', () => {
  resetMetrics();
  resetHistory();
  firstKeySeen = false;
  firstKeyMistake = false;
  setAvgOverrideForRun(null);      // <— clear any override between runs
  const host = document.getElementById('runGraph');
  if (host) host.innerHTML = '';   // clear old graph if any
});

// Anytime initializeTyping/appendTyping finishes, rebuild target words for history
window.addEventListener('capy:textReady', () => {
  setWordsForHistoryFromChars();
});



// --- RESULTS: show active settings in the Time's Up box --------------------
function buildResultsSettingsSummary() {
  const rs = document.getElementById('resultsScreen');
  if (!rs) return;

  // current language + whether it’s a human language
  const langKey  = document.getElementById('languageSelector')?.value;
  const langConf = window.configs?.[langKey];
  const isHuman  = langConf?.type === 'human';

  // create/locate the container just under the stats row
  let wrap = rs.querySelector('#runSettings');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'runSettings';
    wrap.className = 'run-settings';
    const after = rs.querySelector('.results-stats');
    (after?.parentNode)?.insertBefore(wrap, after.nextSibling);
  }
  wrap.innerHTML = '';

  const add = (label) => {
    const chip = document.createElement('span');
    chip.className = 'badge';
    chip.textContent = label;
    wrap.appendChild(chip);
  };

  // Language (always)
  const langLabel = document.querySelector('#languageSelector option:checked')?.textContent?.trim();
  if (langLabel) add(`Language: ${langLabel}`);

  // Word list size / paragraphs — ONLY for human languages
  const wls = document.getElementById('wordListSizeSelector');
  if (isHuman && wls && wls.options?.length > 0) {
    if (wls.value === 'paragraphs') add('Real paragraphs');
    else if (wls.value && !isNaN(parseInt(wls.value, 10))) add(`${wls.value} words`);
  }

  // Toggles: 123, !?, +=, @#& — ONLY for human languages (and only if that row is visible)
  const togglesVisible = isHuman && !document.getElementById('togglesSettings')?.classList.contains('hidden');
  if (togglesVisible) {
    if (document.getElementById('numbersToggle')?.checked)      add('123');
    if (document.getElementById('numbersExprToggle')?.checked)  add('+=');
    if (document.getElementById('punctuationToggle')?.checked)  add('!?');
    if (document.getElementById('symbolsToggle')?.checked)      add('@#&');
  }

  // Timer vs Word limit (these are game limits, keep showing if set)
  const tSel = document.getElementById('timerSelector');
  if (tSel && tSel.value !== 'off') {
    const sec = parseInt(tSel.value, 10);
    const label = Number.isFinite(sec) ? (sec % 60 ? `${sec}s` : `${sec/60} min`) : tSel.value;
    add(`Timer: ${label}`);
  }
  const wlSel = document.getElementById('wordLimitSelector');
  if (wlSel && wlSel.value !== 'off') add(`Word limit: ${wlSel.value}`);

  // Keyboard diagram
  if (document.getElementById('keyboardDiagramToggle')?.checked) add('Keyboard guide');

  // Hide
  const hideVal = document.getElementById('hideWordsSelector')?.value;
  if (hideVal === 'current')     add('Hide: current');
  if (hideVal === 'currentNext') add('Hide: current & next');

  // Highlight
  const hlVal = document.getElementById('highlightAheadSelector')?.value;
  if (hlVal === 'next')  add('Highlight: next');
  if (hlVal === 'next2') add('Highlight: 2nd');

  // End-if rules
  if (document.getElementById('endWpmToggle')?.checked) {
    const v = document.getElementById('endWpmValue')?.value;
    if (v) add(`End if WPM < ${v}`);
  }
  if (document.getElementById('endAccToggle')?.checked) {
    const v = document.getElementById('endAccValue')?.value;
    if (v) add(`End if Accuracy < ${v}%`);
  }
  if (document.getElementById('endOnMistakeCheckbox')?.checked) add('End on any mistake');

  // ---- render speed graph ----
  const host = document.getElementById('runGraph');
  if (host) {
    host.innerHTML = ''; // always clear first

  // Pipe the exact Final WPM from the UI straight into the graph
  const finalWpm = readFinalWpm();
  setAvgOverrideForRun(Number.isFinite(finalWpm) ? finalWpm : null);

  // Always show the graph. Let metrics use the last sample time so the X-axis
  // stops where the run actually ended (early cutoffs included).
  renderRunGraph(host, null);
  }

}

// --- Remove legacy ESC/TAB lines in the results screen (old copy) ---
function removeLegacyResultsHints() {
  const rs = document.getElementById('resultsScreen');
  if (!rs) return;

  // Old DOM hooks from previous builds
  rs.querySelectorAll(
    '#resultsEscTip, #resultsTabTip, .results-esc-hint, .results-tab-hint, .legacy-results-hint, .esc-tip, .tab-tip'
  ).forEach(n => n.remove());

  // Text-node fallback: match the exact old sentences
  const patterns = [
    /ESC\s+to\s+go\s+back\s+to\s+settings\s+and\s+change\s+stuff/i,
    /TAB\s+to\s+play\s+the\s+same\s+game/i
  ];
  const walker = document.createTreeWalker(rs, NodeFilter.SHOW_TEXT);
  const toRemove = [];
  while (walker.nextNode()) {
    const txt = walker.currentNode.nodeValue || '';
    if (patterns.some(re => re.test(txt))) toRemove.push(walker.currentNode);
  }
  toRemove.forEach(node => {
    const p = node.parentNode;
    if (!p) return;
    p.removeChild(node);
    // If that wrapper is now empty, remove it too
    if (!p.textContent.trim() && !p.children.length) p.remove();
  });
}


function endGame() {
  gameLocked = true;
  document.body.classList.add('game-ended');

  const wlBar = document.getElementById('wordProgress');
  if (wlBar) wlBar.classList.add('hidden');

  // NEW: nuke any remaining fill + stop ghost
  const wlFill = document.getElementById('wordProgressFill');
  if (wlFill) wlFill.style.width = '0%';
  stopGhost?.();

  buildResultsSettingsSummary();
  renderTypingHistory();
  endTimer();

  // === CERTIFICATE: guaranteed button ===
  if (!document.getElementById('downloadCertificateButton')) {
    const inlineHost =
      document.querySelector('.results-actions') ||
      document.querySelector('.results-buttons') ||
      document.querySelector('.results-stats')?.parentElement;

    const btn = document.createElement('button');
    btn.id = 'downloadCertificateButton';
    btn.type = 'button';
    btn.className = 'btn btn-primary certificate-btn';
    btn.textContent = 'CERTIFICATE';
    (inlineHost || document.body).appendChild(btn);

    if (!inlineHost) {
      // make it a floating FAB if no obvious inline host
      btn.setAttribute('style',
        'position:fixed;right:16px;bottom:16px;z-index:99999;padding:12px 16px;' +
        'border-radius:12px;border:none;font-weight:700;cursor:pointer;' +
        'box-shadow:0 6px 18px rgba(0,0,0,.25);background:#1f63ff;color:#fff;'
      );
    }

    btn.addEventListener('click', async () => {
      const fullName = (window.prompt('Enter your first and last name for the certificate:', '') || '').trim();
      if (!fullName) return;
      const gen = window.capyGenerateCertificate;
      if (typeof gen === 'function') await gen(fullName);
      else {
        // ESM fallback (shouldn’t be needed, but safe)
        const { generateCertificate } = await import('./certificate.js');
        await generateCertificate(fullName);
      }
    });
  }

  // Let listeners know results just painted
  window.dispatchEvent(new Event('capy:resultsPainted'));
  removeLegacyResultsHints();

}


function resetGameLock() {
  gameLocked = false;
  document.body.classList.remove('game-ended');

  // NEW: ensure no stale fill on a fresh run
  const wlFill = document.getElementById('wordProgressFill');
  if (wlFill) wlFill.style.width = '0%';

  enforceWordLimitAvailability();
}



// Overlay the keyboard diagram just under #textDisplay (no layout shift)
function positionKeyboardDiagram() {
  const panel = document.querySelector('.typing-panel');
  const text  = document.getElementById('textDisplay');
  const kd    = document.getElementById('keyboardDiagram');
  if (!panel || !text || !kd || kd.classList.contains('hidden')) return;

  const panelRect = panel.getBoundingClientRect();
  const textRect  = text.getBoundingClientRect();
  const top = (textRect.bottom - panelRect.top) + 12; // 12px gap
  kd.style.top = `${top}px`;
}

function readFinalWpm() {
  const rs = document.getElementById('resultsScreen');
  if (!rs) return null;

  // Prefer explicit hooks if you have them:
  const el =
    rs.querySelector('[data-final-wpm]') ||
    rs.querySelector('#finalWpmValue, #finalWpm, .final-wpm .value, .result-wpm .value');

  if (el) {
    const n = parseInt((el.textContent || '').replace(/[^\d]/g, ''), 10);
    if (Number.isFinite(n)) return n;
  }

  // Fallback: parse "Final WPM: 72" style text
  const m = (rs.textContent || '').match(/Final\s*WPM:\s*(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}


window.addEventListener('DOMContentLoaded', async () => {
  const configs = await fetch('./data/language_configs.json').then(res => res.json());
  window.configs = configs;

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

  // Smaller selects inside the Text Generation hero pill
  ['languageSelector','wordListSizeSelector'].forEach(id =>
    enhanceSelect(id, { small: true })
  );
  // Leave Theme as the larger pill
  enhanceSelect('themeSelector');


  ['timerSelector','wordLimitSelector','soundSelector','hideWordsSelector','highlightAheadSelector']
    .forEach(id => enhanceSelect(id, { small: true })); // compact pills

  Object.keys(configs).sort().forEach(lang => {
    const opt = document.createElement('option');
    opt.value = lang;
    opt.textContent = languageNames[lang] || lang.toUpperCase();
    languageSelector.appendChild(opt);
  });
  languageSelector.value = 'eng';

  function updateUIForLanguage() {
    const lang = languageSelector.value;
    const conf = configs[lang];
    const wordListSizeSettings = document.getElementById('wordListSizeSettings');
    const wordListSizeSelector = document.getElementById('wordListSizeSelector');
    wordListSizeSelector.innerHTML = '';
    
    if (conf.word_lists.length > 0 || conf.paragraphs) {
      wordListSizeSettings.classList.remove('hidden');
      conf.word_lists.forEach((size, index) => {
        const option = document.createElement('option');
        option.value = size;
        option.textContent = `${size} words`;
        if (index === 0) option.selected = true;
        wordListSizeSelector.appendChild(option);
      });
      if (conf.paragraphs) {
        const option = document.createElement('option');
        option.value = 'paragraphs';
        option.textContent = 'Real Paragraphs';
        wordListSizeSelector.appendChild(option);
      }
    } else {
      wordListSizeSettings.classList.add('hidden');
    }

    // Toggle punctuation/number/symbol controls only for human langs
    const togglesSettings = document.getElementById('togglesSettings');
    if (conf.type === 'human') {
      togglesSettings.classList.remove('hidden');
    } else {
      togglesSettings.classList.add('hidden');
    }

    // Russian disables keyboard guide (checkbox version)
    const keyboardSettings = document.getElementById('keyboardDiagramSettings');
    const keyboardToggle = document.getElementById('keyboardDiagramToggle');
    if (lang === 'rus') {
      if (keyboardToggle) {
        keyboardToggle.checked = false;
        keyboardToggle.disabled = true;
      }
      keyboardSettings?.classList.add('disabled');
    } else {
      if (keyboardToggle) {
        keyboardToggle.disabled = false;
      }
      keyboardSettings?.classList.remove('disabled');
    }

    // Reflect current toggle state in the UI
    const kbPanel = document.getElementById('keyboardDiagram');
    if (kbPanel && keyboardToggle) {
      kbPanel.classList.toggle('hidden', !keyboardToggle.checked);
    }
}


function watchResultsScreenForSettings() {
  const rs = document.getElementById('resultsScreen');
  if (!rs) return;

  const renderIfShown = () => {
    // Wait a tick so the box/values finish painting, then rebuild chips + history
    requestAnimationFrame(() => {
      buildResultsSettingsSummary();
      renderTypingHistory();                 // keep history fresh
      tagTargetTextBoxForCertificate();
      removeLegacyResultsHints();            // <-- kill the old ESC/TAB lines
    });

  };

  // Rebuild whenever the hidden class toggles off
  const mo = new MutationObserver(() => {
    if (!rs.classList.contains('hidden')) renderIfShown();
  });
  mo.observe(rs, { attributes: true, attributeFilter: ['class', 'style'] });

  // Timer “time’s up” → render settings AND history
  window.addEventListener('capy:timeup', renderIfShown);
}


// call it once during init (after the DOM exists)
watchResultsScreenForSettings();
setupCertificate();

updateUIForLanguage();
enforceWordLimitAvailability(); // <-- add this line
// Mouse-only selects: block key handling & refocus to the game
wireMouseOnlySelects();


// Wire once: auto-unselect settings so typing goes to the game immediately
const settingsRoot = document.querySelector('.settings-panel');
if (settingsRoot && !settingsRoot.dataset.refocusWired) {
  settingsRoot.dataset.refocusWired = '1';

  settingsRoot.addEventListener('change', (e) => {
    const t = e.target;
    if (t.matches('select') || t.matches('input[type="checkbox"]')) {
      refocusToGame();
    }
  });

  settingsRoot.addEventListener('click', (e) => {
    if (e.target.closest('#ghostWpmWrapper, #endWpmWrapper, #endAccWrapper')) return;
    if (e.target.closest('.select-pill')) return;
    if (e.target.closest('.btn-dropdown')) return;
    if (e.target.closest('button, [role="button"], .pill.option, .split-half, #hidePill, #highlightPill, #typedErrorsPill, #ghostCursorSettings')) {
      refocusToGame();
    }
  });
}



  languageSelector.addEventListener('change', async () => {
    updateUIForLanguage();
    enforceWordLimitAvailability();
    await initializeTyping(textDisplay, hideControl);
    setWordsForHistoryFromChars();
    positionKeyboardDiagram();
    showInitialProgress();


    // Re-apply highlight for the new text based on current selection
    const widx = getCurrentWord(chars, 0);
    updateHighlight(getHighlightMode(highlightControl), widx, chars);

    resetGameLock();
  });

  const wordListSizeSelector = document.getElementById('wordListSizeSelector');
  if (wordListSizeSelector) {
    wordListSizeSelector.addEventListener('change', async () => {
      enforceWordLimitAvailability();
      
      await initializeTyping(textDisplay, hideControl);
      setWordsForHistoryFromChars();
      positionKeyboardDiagram();
      showInitialProgress();
      const widx = getCurrentWord(chars, 0);
      updateHighlight(getHighlightMode(highlightControl), widx, chars);
      resetGameLock();
    });
  }


  ['punctuationToggle','numbersToggle','numbersExprToggle','symbolsToggle'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', async () => {
        // Keep the subtoggles visibility in sync
        setupSubtoggleVisibility();

        await initializeTyping(textDisplay, hideControl);
        setWordsForHistoryFromChars();
        positionKeyboardDiagram();
        showInitialProgress();
        const widx = getCurrentWord(chars, 0);
        updateHighlight(getHighlightMode(highlightControl), widx, chars);
        resetGameLock();
      });
    }
  });


  // Initial setup
  await initializeTyping(textDisplay, hideControl);
  setWordsForHistoryFromChars();
  positionKeyboardDiagram();
  setupHide(hideControl, chars, textDisplay, currentIndex);
  resetGameLock();


  // Wire hide mode watcher (select or radios)
  if (hideControl && typeof hideControl.value === 'string') {
    watchHideSelector(hideControl, () => setupHide(hideControl, chars, textDisplay, currentIndex));
  } else {
    watchHideRadios(hideControl, () => setupHide(hideControl, chars, textDisplay, currentIndex));
  }

  // Wire highlight mode watcher (select or radios)
  const applyHighlight = () => {
    const widx = getCurrentWord(chars, currentIndex);
    updateHighlight(getHighlightMode(highlightControl), widx, chars);
  };
  if (highlightControl && typeof highlightControl.value === 'string') {
    watchHighlightSelector(highlightControl, applyHighlight);
  } else {
    watchHighlightRadios(highlightControl, applyHighlight);
  }

  // Apply initial highlight state
  applyHighlight();

  bindThemeSelectors(themeSelector, colorPickers);
  document.body.className = `theme-${themeSelector.value}`;

  setupKeyboardDiagram(); // keep any diagram initialization you already have

  // Helper so we can re-apply after a restart/re-init
  function applyKeyboardVisibility() {
    const keyboardToggle = document.getElementById('keyboardDiagramToggle');
    const keyboardPanel  = document.getElementById('keyboardDiagram');
    if (!keyboardToggle || !keyboardPanel) return;

    const show = keyboardToggle.checked;
    keyboardPanel.classList.toggle('hidden', !show);
    if (show) {
      // place it right under the typing box
      positionKeyboardDiagram();
    }
  }


  // wire checkbox -> visibility
  const keyboardToggle = document.getElementById('keyboardDiagramToggle');
  if (keyboardToggle) {
    keyboardToggle.addEventListener('change', applyKeyboardVisibility);
  }
  applyKeyboardVisibility();
  window.addEventListener('resize', positionKeyboardDiagram);


  // NEW: checkbox handling for typed errors visibility
  const showTypedErrorsToggle = document.getElementById('showTypedErrorsToggle');
  const typedErrorDisplay     = document.getElementById('typedErrorDisplay');
  const typedLetterBox        = document.getElementById('typedLetter');

  if (showTypedErrorsToggle && typedErrorDisplay && typedLetterBox) {
    const applyTypedErrorsVisibility = () => {
      if (!showTypedErrorsToggle.checked) {
        // Turning OFF -> hide bubble + clear
        typedErrorDisplay.classList.add('hidden');
        typedLetterBox.textContent = '';
      } else {
        // Turning ON -> keep hidden until the next incorrect key
        typedErrorDisplay.classList.add('hidden');
        typedLetterBox.textContent = '';
      }
    };
    showTypedErrorsToggle.addEventListener('change', applyTypedErrorsVisibility);
    applyTypedErrorsVisibility(); // initialize
  }


  setupRestartButton(initializeTyping, hideControl);

  document.getElementById('restartButton')?.addEventListener('click', () => {
    resetHistory(); // <— keep history scoped to each run
    firstKeySeen = false;
    firstKeyMistake = false;
    setAvgOverrideForRun(null); // <— clear any prior avg override


    // Hide "You typed" bubble and clear last letter
    const ted = document.getElementById('typedErrorDisplay');
    if (ted) ted.classList.add('hidden');
    const tl = document.getElementById('typedLetter');
    if (tl) tl.textContent = '';

    resetGameLock();

    // ⬇️ scrub extras so "same words" are clean
    sanitizeExistingText(textDisplay);
    setWordsForHistoryFromChars();

    // re-apply hide/highlight for word 0
    const widx0 = getCurrentWord(chars, 0);
    updateHide(getHideMode(hideControl), widx0, chars, textDisplay);
    updateHighlight(getHighlightMode(highlightControl), widx0, chars);

    // optional HUD reset
    resetMetrics();
    resetTimer();
    setTimerLabelToFull?.();
    wpmSpan.textContent = 'WPM: 0';
    accSpan.textContent = 'Accuracy: 100%';

    // let initializeTyping finish first then restore keyboard guide
    setTimeout(applyKeyboardVisibility, 0);
  });



  setupGhost();
  showInitialProgress();
  setupSubtoggleVisibility();
  setupToggleWithNumber('endWpmToggle', 'endWpmWrapper', 50);
  setupToggleWithNumber('endAccToggle', 'endAccWrapper', 95);
  wireSplitPill('minWPMSettings', 'endWpmToggle', 'endWpmWrapper');
  wireSplitPill('minAccuracySettings', 'endAccToggle', 'endAccWrapper');
  wireSinglePill('strictModeSettings', 'endOnMistakeCheckbox');
  wireSinglePill('keyboardDiagramSettings', 'keyboardDiagramToggle');
  wirePillToggle('typedErrorsPill', 'showTypedErrorsToggle');
  wireGhostPill();

  // === GAME LIMITS — 3-button UI wiring ============================
  (function setupGameLimitsButtons() {
    const btnEndless = document.getElementById('btnEndless');
    const btnTimer   = document.getElementById('btnTimer');
    const btnWord    = document.getElementById('btnWord');

    const timerInline = document.getElementById('timerInline');
    const wordInline  = document.getElementById('wordInline');

    const timerInlineSelect = document.getElementById('timerInlineSelect');
    const wordInlineSelect  = document.getElementById('wordLimitInlineSelect');

    const timerSel = document.getElementById('timerSelector');        // hidden mirror
    const wordSel  = document.getElementById('wordLimitSelector');    // hidden mirror

    if (!btnEndless || !btnTimer || !btnWord || !timerSel || !wordSel) return;

    // add this helper near the top of setupGameLimitsButtons()
    function isParagraphsMode() {
      const wlsSel = document.getElementById('wordListSizeSelector');
      return !!wlsSel && wlsSel.value === 'paragraphs';
    }

  async function setActive(mode) {
    // Normalize first: Real Paragraphs cannot use Word limit
    if (mode === 'word' && isParagraphsMode()) {
      mode = 'endless';
    }

    const isEndless = mode === 'endless';
    const isTimer   = mode === 'timer';
    const isWord    = mode === 'word';

    // visual state
    btnEndless.classList.toggle('active', isEndless);
    btnTimer.classList.toggle('active',   isTimer);
    btnWord.classList.toggle('active',    isWord);

    btnEndless.setAttribute('aria-pressed', String(isEndless));
    btnTimer.setAttribute('aria-pressed',   String(isTimer));
    btnWord.setAttribute('aria-pressed',    String(isWord));

    // dropdown visibility + spacing
    timerInline.classList.toggle('hidden', !isTimer);
    wordInline.classList.toggle('hidden',  !isWord);
    btnTimer.classList.toggle('show-dropdown', isTimer);
    btnWord.classList.toggle('show-dropdown',  isWord);

    // ---- set hidden mirrors WITHOUT dispatching change events ----
    if (isEndless) {
      timerSel.value = 'off';
      wordSel.value  = 'off';
    } else if (isTimer) {
      wordSel.value  = 'off';
      timerSel.value = timerInlineSelect.value;   // e.g. "60"
    } else if (isWord) {
      timerSel.value = 'off';
      wordSel.value  = wordInlineSelect.value;    // e.g. "5"
    }

    // NEW: make the HUD’s timer visibility/label match the chosen mode
    enforceTimerVisibility();
    setTimerLabelToFull?.();

    // keep the progress bar / availability in sync
    enforceWordLimitAvailability();

    // full reset & re-render exactly once (no races)
    resetTimer();
    setStartTime(0);
    setCurrentIndex(0);
    await initializeTyping(textDisplay, hideControl);
    setWordsForHistoryFromChars();
    positionKeyboardDiagram();
    showInitialProgress();

    resetGameLock();

    // reset HUD + effects
    const widx = getCurrentWord(chars, 0);
    updateHide(getHideMode(hideControl), widx, chars, textDisplay);
    updateHighlight(getHighlightMode(highlightControl), widx, chars);
    document.getElementById('wpm').textContent = 'WPM: 0';
    document.getElementById('accuracy').textContent = 'Accuracy: 100%';
  }




  // button clicks
  btnEndless.addEventListener('click', () => setActive('endless'));
  btnTimer  .addEventListener('click', () => setActive('timer'));
  btnWord   .addEventListener('click', () => {
    if (btnWord.disabled || btnWord.getAttribute('aria-disabled') === 'true' || isParagraphsMode()) return;
    setActive('word');
  });

  // dropdown changes
  timerInlineSelect.addEventListener('change', () => {
    setActive('timer');   // always route through setActive
  });
  wordInlineSelect.addEventListener('change', () => {
    if (btnWord.disabled || btnWord.getAttribute('aria-disabled') === 'true' || isParagraphsMode()) return;
    setActive('word');    // always route through setActive
  });



    // default to Endless on load
    setActive('endless');
  })();

  function wireSplitDependency({
    mainBtnId, extraBtnId,
    mainToggleId, extraToggleId
  }) {
    const mainBtn  = document.getElementById(mainBtnId);
    const extraBtn = document.getElementById(extraBtnId);
    const mainT    = document.getElementById(mainToggleId);
    const extraT   = document.getElementById(extraToggleId);
    if (!mainBtn || !extraBtn || !mainT || !extraT) return;

    // Reflect checkboxes -> UI
    const sync = () => {
      // main
      mainBtn.classList.toggle('is-on', !!mainT.checked);

      // extra depends on main
      const enabled = !!mainT.checked;
      extraBtn.setAttribute('aria-disabled', enabled ? 'false' : 'true');
      extraBtn.classList.toggle('is-on', !!extraT.checked && enabled);
    };

    // Toggle main
    mainBtn.addEventListener('click', () => {
      mainT.checked = !mainT.checked;
      mainT.dispatchEvent(new Event('change'));

      // If main turned OFF, force extra OFF
      if (!mainT.checked && extraT.checked) {
        extraT.checked = false;
        extraT.dispatchEvent(new Event('change'));
      }
      sync();
    });

    // Toggle extra (only when main is on)
    extraBtn.addEventListener('click', () => {
      if (!mainT.checked) return; // safety (also blocked by aria-disabled)
      extraT.checked = !extraT.checked;
      extraT.dispatchEvent(new Event('change'));
      sync();
    });

    // If your code updates the checkboxes elsewhere, keep UI in sync:
    mainT.addEventListener('change', sync);
    extraT.addEventListener('change', sync);

    // initial paint
    sync();
  }

  // Numbers: 123 -> enables/disables +=
  wireSplitDependency({
    mainBtnId:  'numMain',
    extraBtnId: 'numExtra',
    mainToggleId:  'numbersToggle',
    extraToggleId: 'numbersExprToggle'
  });

  // Punctuation: !? -> enables/disables @#&
  wireSplitDependency({
    mainBtnId:  'punctMain',
    extraBtnId: 'punctExtra',
    mainToggleId:  'punctuationToggle',
    extraToggleId: 'symbolsToggle'
  });


  // === Hide pill ===
  const hidePill = document.getElementById('hidePill');
  const hideOpts = document.getElementById('hideOptions');

  hidePill?.addEventListener('click', () => {
    // open hide options in-place; close highlight options
    const willOpen = hideOpts.classList.contains('hidden');
    closeAllOptionRows();
    if (willOpen) {
      hidePill.classList.add('hidden');   // <— hide big pill
      hideOpts.classList.remove('hidden'); // <— show 3 options in its place
    }
  });

  document.getElementById('hideOff')?.addEventListener('click', () => {
    setHideModeUI('off');
  });

  document.getElementById('hideCurrent')?.addEventListener('click', () => {
    // exclusivity: turn highlight off when hide is on
    turnHighlightOff();
    setHideModeUI('current');
  });

  document.getElementById('hideCurrentNext')?.addEventListener('click', () => {
    // exclusivity: turn highlight off when hide is on
    turnHighlightOff();
    setHideModeUI('currentNext');
  });

  // === Highlight pill ===
  const hlPill = document.getElementById('highlightPill');
  const hlOpts = document.getElementById('highlightOptions');

  hlPill?.addEventListener('click', () => {
    const willOpen = hlOpts.classList.contains('hidden');
    closeAllOptionRows();
    if (willOpen) {
      hlPill.classList.add('hidden');     // <— hide big pill
      hlOpts.classList.remove('hidden');  // <— show options
    }
  });


  document.getElementById('hlOff')?.addEventListener('click', () => {
    setHighlightModeUI('off');
  });

  document.getElementById('hlNext')?.addEventListener('click', () => {
    // exclusivity: turn hide off when highlight is on
    turnHideOff();
    setHighlightModeUI('next');
  });

  document.getElementById('hlNext2')?.addEventListener('click', () => {
    // exclusivity: turn hide off when highlight is on
    turnHideOff();
    setHighlightModeUI('next2');
  });

  // Initial state: both off
  turnHideOff();
  turnHighlightOff();




  window.dispatchEvent(new Event('capy:ready'));
  document.body.tabIndex = 0;
  document.body.focus();
});

function watchWordLimitRadios() {
  const wlSel = document.getElementById('wordLimitSelector');
  const wlRadios = document.querySelectorAll('input[name="wordLimit"]');

  const onChange = async (value) => {
    // If word limit turned on, force Timer → Off (mutually exclusive)
    if (value !== 'off') {
      const tSel = document.getElementById('timerSelector');
      if (tSel) tSel.value = 'off';
      const tRadios = document.querySelectorAll('input[name="timer"]');
      tRadios.forEach(r => { if (r.value === 'off') r.checked = true; });
    }

    await initializeTyping(textDisplay, hideControl);
    setWordsForHistoryFromChars();
    positionKeyboardDiagram();
    resetTimer();
    setStartTime(0);
    setCurrentIndex(0);

    const widx = getCurrentWord(chars, 0);
    updateHide(getHideMode(hideControl), widx, chars, textDisplay);
    updateHighlight(getHighlightMode(
      document.getElementById('highlightAheadSelector') || document.querySelectorAll('input[name="highlightAhead"]')
    ), widx, chars);

    document.getElementById('wpm').textContent = 'WPM: 0';
    document.getElementById('accuracy').textContent = 'Accuracy: 100%';
    showInitialProgress();
    resetGameLock();
  };

  if (wlSel) {
    wlSel.addEventListener('change', () => onChange(wlSel.value));
  } else {
    wlRadios.forEach(r => r.addEventListener('change', () => onChange(r.value)));
  }
}

function getWordSizeOrMode() {
  const el = document.getElementById('wordListSizeSelector');
  return el && typeof el.value === 'string' ? el.value : null;
}

function setupThresholdToggle(groupId, radioName, wrapperId, defaultValue) {
  const group = document.getElementById(groupId);
  if (!group) return;

  const wrapper = document.getElementById(wrapperId);
  const radios = [...document.querySelectorAll(`input[name="${radioName}"]`)];
  if (!wrapper || radios.length === 0) return;

  const apply = () => {
    const mode = radios.find(r => r.checked)?.value || 'off';
    wrapper.style.display = (mode === 'on') ? 'inline' : 'none';
    // If turning on and input is empty, set a sensible default
    if (mode === 'on') {
      const input = wrapper.querySelector('input[type="number"]');
      if (input && (input.value === '' || input.value == null)) input.value = defaultValue;
    }
  };

  radios.forEach(r => r.addEventListener('change', apply));
  // initial state
  apply();
}

function setupSubtoggleVisibility() {
  const numbers = document.getElementById('numbersToggle');
  const numbersExprWrap = document.getElementById('numbersExprWrapper');
  const punct = document.getElementById('punctuationToggle');
  const symbolsWrap = document.getElementById('symbolsWrapper');

  const apply = () => {
    if (numbers && numbersExprWrap) {
      numbersExprWrap.classList.toggle('hidden', !numbers.checked);
    }
    if (punct && symbolsWrap) {
      symbolsWrap.classList.toggle('hidden', !punct.checked);
    }
  };

  // Initial
  apply();

  // Watchers
  numbers?.addEventListener('change', apply);
  punct?.addEventListener('change', apply);
}

function setupToggleWithNumber(toggleId, wrapperId, defaultValue) {
  const toggle  = document.getElementById(toggleId);
  const wrapper = document.getElementById(wrapperId);
  const pill    = toggle ? toggle.closest('.pill') : null;
  if (!toggle || !wrapper || !pill) return;

  const apply = () => {
    const on = toggle.checked;
    wrapper.classList.toggle('hidden', !on);
    pill.classList.toggle('active', on);
    if (on) {
      const input = wrapper.querySelector('input[type="number"]');
      if (input && (input.value === '' || input.value == null)) {
        input.value = defaultValue;
      }
    }
  };

  toggle.addEventListener('change', apply);
  apply(); // initialize on load
}

// Make the whole pill clickable + keyboard toggle (Enter/Space)
function wireSplitPill(pillId, checkboxId, wrapperId) {
  const pill     = document.getElementById(pillId);
  const checkbox = document.getElementById(checkboxId);
  const wrapper  = document.getElementById(wrapperId);
  if (!pill || !checkbox) return;

  const sync = () => {
    pill.classList.toggle('active', checkbox.checked);
    if (wrapper) wrapper.classList.toggle('hidden', !checkbox.checked);
  };

  const toggle = () => {
    checkbox.checked = !checkbox.checked;
    checkbox.dispatchEvent(new Event('change'));
  };

  // Mouse-only: ignore clicks inside the right/number half
  pill.addEventListener('click', (e) => {
    if (wrapper && wrapper.contains(e.target)) return;
    toggle();
  });

  checkbox.addEventListener('change', sync);
  sync(); // initial
}



function wireSinglePill(pillId, checkboxId) {
  const pill   = document.getElementById(pillId);
  const toggle = document.getElementById(checkboxId);
  if (!pill || !toggle) return;

  const sync = () => pill.classList.toggle('active', toggle.checked);
  const activate = () => {
    toggle.checked = !toggle.checked;
    toggle.dispatchEvent(new Event('change'));
  };

  // Mouse only
  pill.addEventListener('click', () => { activate(); });
  toggle.addEventListener('change', sync);
  sync(); // initial
}




function enforceWordLimitAvailability() {

  // If results overlay is up, always hide progress and bail
  if (document.body.classList.contains('game-ended')) {
    document.getElementById('wordProgress')?.classList.add('hidden');
    return;
  }

  const wlsSel    = document.getElementById('wordListSizeSelector');
  const wlSel     = document.getElementById('wordLimitSelector');
  const progress  = document.getElementById('wordProgress');

  // 3-button UI bits
  const btnEndless        = document.getElementById('btnEndless');
  const btnTimer          = document.getElementById('btnTimer');
  const btnWord           = document.getElementById('btnWord');
  const wordInline        = document.getElementById('wordInline');
  const wordInlineSelect  = document.getElementById('wordLimitInlineSelect');

  const isParagraphs = wlsSel && wlsSel.value === 'paragraphs';

  if (isParagraphs) {
    // Force Word Limit OFF & disable the selector
    if (wlSel) {
      wlSel.value = 'off';
      wlSel.disabled = true;
    }

    // Hide the progress bar (WL bar is irrelevant)
    progress?.classList.add('hidden');

    // Disable the "Word" button & inline dropdown
    if (btnWord) {
      btnWord.setAttribute('aria-disabled', 'true');
      btnWord.disabled = true;
      btnWord.classList.remove('active', 'show-dropdown');
      btnWord.setAttribute('aria-pressed', 'false');
    }
    if (wordInline) wordInline.classList.add('hidden');
    if (wordInlineSelect) wordInlineSelect.disabled = true;

  } else {
    // Re-enable Word Limit controls outside of paragraphs mode
    if (wlSel) wlSel.disabled = false;

    if (btnWord) {
      btnWord.removeAttribute('aria-disabled');
      btnWord.disabled = false;
    }
    if (wordInlineSelect) wordInlineSelect.disabled = false;

    // Show/hide WL progress bar only when Word Limit is actually on
    if (progress) {
      if (wlSel && wlSel.value === 'off') progress.classList.add('hidden');
      else progress.classList.remove('hidden');
    }
  }
}


// Build the exact target words from the current run's required chars
function setWordsForHistoryFromChars() {
  const out = [];
  let buf = '';

  for (const n of chars) {
    const ch = n.textContent;

    // treat actual spaces/newlines as separators even though they aren't "required"
    if (ch === ' ' || ch === '\n') {
      if (buf) { out.push(buf); buf = ''; }
      continue;
    }

    // only add characters that are original/required (ignore any extras the player might add later)
    if (n?.dataset?.required === '1') {
      buf += ch;
    }
  }

  if (buf) out.push(buf);
  setTargetWordsForRun(out);
}



function setHideOff() {
  const sel = document.getElementById('hideWordsSelector');
  if (sel) sel.value = 'off';
  const widx = getCurrentWord(chars, currentIndex);
  updateHide('off', widx, chars, textDisplay);
}

function setHighlightOff() {
  const sel = document.getElementById('highlightAheadSelector');
  if (sel) sel.value = 'off';
  const widx = getCurrentWord(chars, currentIndex);
  updateHighlight('off', widx, chars);
}

function setChoiceText(pillId, labelId, text) {
  const pill = document.getElementById(pillId);
  if (!pill) return;
  let label = document.getElementById(labelId);
  if (!label) {
    label = document.createElement('div');
    label.id = labelId;
    label.className = 'pill-value';
    pill.appendChild(label);           // append on the right side
  }
  label.textContent = text || '';
}

// === Hide/Highlight pill helpers ===
function setHideModeUI(mode) {
  const sel = document.getElementById('hideWordsSelector');
  if (sel) sel.value = mode;

  const pill = document.getElementById('hidePill');
  const opts = document.getElementById('hideOptions');

  if (mode === 'off') {
    pill.classList.remove('active');
    setChoiceText('hidePill', 'hideChoiceLabel', '');
  } else {
    pill.classList.add('active');
    setChoiceText('hidePill', 'hideChoiceLabel',
      mode === 'current' ? 'current' : 'current & next'
    );
  }

  // Bring big pill back and hide its options
  pill.classList.remove('hidden');
  opts.classList.add('hidden');

  // Apply behavior
  const widx = getCurrentWord(chars, currentIndex);
  updateHide(mode, widx, chars, textDisplay);
}


function setHighlightModeUI(mode) {
  const sel = document.getElementById('highlightAheadSelector');
  if (sel) sel.value = mode;

  const pill = document.getElementById('highlightPill');
  const opts = document.getElementById('highlightOptions');

  if (mode === 'off') {
    pill.classList.remove('active');
    setChoiceText('highlightPill', 'highlightChoiceLabel', '');
  } else {
    pill.classList.add('active');
    setChoiceText('highlightPill', 'highlightChoiceLabel',
      mode === 'next' ? 'next' : '2nd'
    );
  }

  // Bring big pill back and hide its options
  pill.classList.remove('hidden');
  opts.classList.add('hidden');

  // Apply behavior
  const widx = getCurrentWord(chars, currentIndex);
  updateHighlight(mode, widx, chars);
}


function turnHideOff() { setHideModeUI('off'); }
function turnHighlightOff() { setHighlightModeUI('off'); }

// Collapse both option rows (small UX helper)
function closeAllOptionRows() {
  // Hide option rows
  document.getElementById('hideOptions')?.classList.add('hidden');
  document.getElementById('highlightOptions')?.classList.add('hidden');
  // Always make sure the big pills are visible again
  document.getElementById('hidePill')?.classList.remove('hidden');
  document.getElementById('highlightPill')?.classList.remove('hidden');
}


function wirePillToggle(pillId, checkboxId) {
  const pill = document.getElementById(pillId);
  const cb   = document.getElementById(checkboxId);
  if (!pill || !cb) return;

  const sync = () => pill.classList.toggle('active', cb.checked);

  // Mouse-only toggle so typing Space in the game won't flip it
  pill.addEventListener('click', () => {
    cb.checked = !cb.checked;
    cb.dispatchEvent(new Event('change'));
  });

  cb.addEventListener('change', sync);
  sync(); // initial
}

function wireGhostPill() {
  const pill  = document.getElementById('ghostCursorSettings');
  const cb    = document.getElementById('ghostModeToggle');
  const wrap  = document.getElementById('ghostWpmWrapper');
  const input = document.getElementById('customGhostWPM');
  if (!pill || !cb || !wrap) return;

  const sync = () => {
    pill.classList.toggle('active', cb.checked);
    wrap.classList.toggle('hidden', !cb.checked);
    if (cb.checked && input && (input.value === '' || input.value == null)) input.value = 60;
  };

  // Mouse-only toggle, but NOT when the click is inside the number wrapper
  pill.addEventListener('click', (e) => {
    if (wrap.contains(e.target)) return;      // ← ignore clicks on the input area
    cb.checked = !cb.checked;
    cb.dispatchEvent(new Event('change'));
  });

  // Kill bubbling from the input so it never toggles the pill
  ['click','mousedown','mouseup'].forEach(evt =>
    wrap.addEventListener(evt, (e) => e.stopPropagation())
  );

  // Prevent game key handler from seeing keystrokes while editing the number
  ['keydown','keyup','keypress'].forEach(evt =>
    input.addEventListener(evt, (e) => e.stopPropagation())
  );

  cb.addEventListener('change', sync);
  sync(); // initial
}

function enhanceSelect(id, { small = false } = {}) {
  const sel = document.getElementById(id);
  if (!sel || sel.classList.contains('ui-select')) return;

  sel.classList.add('ui-select');          // styling hook

  // Wrap the <select> in a themed pill container
  const wrap = document.createElement('div');
  wrap.className = 'select-pill' + (small ? ' small' : '');
  sel.parentNode.insertBefore(wrap, sel);
  wrap.appendChild(sel);

  // Make the entire pill clickable to open the native menu
  wrap.addEventListener('click', (e) => {
    if (sel.disabled) return;
    // Don't steal clicks if the user actually clicked the select itself
    if (e.target === sel) return;

    sel.focus();
    // Best effort to open the native picker across browsers
    if (typeof sel.showPicker === 'function') {
      sel.showPicker();
    } else {
      // Safari/macOS fallback: synthesize a click on the select
      sel.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      sel.click();
    }
  });
}

// === Settings: force mouse-only on SELECTs & bounce focus back to the game ===
const SETTINGS_SELECTS = [
  '#limitsHero .btn-dropdown select',
  '.select-pill select.ui-select',
  '#languageSelector',
  '#wordListSizeSelector',
  '#timerInlineSelect',
  '#wordLimitInlineSelect',
  '#timerSelector',
  '#wordLimitSelector',
  '#themeSelector',
  '#soundSelector',
  '#hideWordsSelector',
  '#highlightAheadSelector'
].join(', ');

function wireMouseOnlySelects(root = document) {
  root.querySelectorAll(SETTINGS_SELECTS).forEach(sel => {
    if (sel.dataset.mouseOnlyWired) return;
    sel.dataset.mouseOnlyWired = '1';

    // keep selects out of tab order (mouse only)
    sel.setAttribute('tabindex', '-1');

    // when a value is chosen or the menu closes, return focus to the game
    ['change','blur'].forEach(evt =>
      sel.addEventListener(evt, () => setTimeout(refocusToGame, 0))
    );

    // if user types while a select is focused, hijack it and replay for the game
    sel.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return; // allow OS shortcuts
      // Block the select's own keyboard behavior, but let the event bubble
      e.preventDefault();
      // Hand focus back to the game for the *next* keystroke
      requestAnimationFrame(refocusToGame);
    });
  });
}


// Put keyboard focus back on the game immediately after a settings action
function refocusToGame() {
  // let the UI toggle/paint first, then steal focus back
  requestAnimationFrame(() => {
    const ae = document.activeElement;
    if (ae && ae !== document.body && typeof ae.blur === 'function') ae.blur();
    document.body.focus({ preventScroll: true });
  });
}

function enforceTimerVisibility() {
  const td = document.getElementById('timerDisplay');
  const tSel = document.getElementById('timerSelector');
  if (!td || !tSel) return;

  if (tSel.value !== 'off') {
    td.classList.remove('hidden');
    // If a new run (no start time yet), show full duration instead of 0:00
    if (!startTime) setTimerLabelToFull();
  } else {
    td.classList.add('hidden');
  }
}


function setTimerLabelToFull() {
  const tSel = document.getElementById('timerSelector');
  const td   = document.getElementById('timerDisplay');
  const tr   = document.getElementById('timeRemaining');
  if (!tSel || !td || !tr) return;

  const sec = parseInt(tSel.value, 10);
  if (!sec || isNaN(sec) || tSel.value === 'off') {
    tr.textContent = '';
    return;
  }
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  tr.textContent = `Time: ${m}:${String(s).padStart(2, '0')}`;  // e.g., 0:15
}

function tagTargetTextBoxForCertificate() {
  const el = document.querySelector(
    '[data-cert-capture="target"], ' +
    '#supposedText, ' +                       // ⬅ include the pill we render
    '[data-target-text], ' +
    '#resultsTargetText, #targetTextBlock, #targetText, #targetTextDisplay, ' +
    '.target-text, .targetText, .target-words, .results-target'
  );
  if (el && !el.hasAttribute('data-cert-capture')) {
    el.setAttribute('data-cert-capture', 'target');
  }
}



// Unified key handler
async function onKey(e) {

  // Hard stop if overlay is up or game is ended/locked
  if (document.body.classList.contains('game-ended') || isGameEnded() || gameLocked) return;



  // Ignore typing while user is editing a control
  const ae = document.activeElement;
  const aeIsMouseOnlySelect =
    ae && ae.tagName === 'SELECT' && ae.dataset.mouseOnlyWired === '1';

  if (
    ae && !aeIsMouseOnlySelect &&
    (ae.tagName === 'INPUT' ||
    ae.tagName === 'SELECT' ||
    ae.tagName === 'TEXTAREA' ||
    ae.tagName === 'BUTTON' ||
    ae.closest('[role="button"]') ||
    (ae.tagName === 'A' && ae.hasAttribute('href')) ||
    ae.isContentEditable)
  ) {
    return;
  }


  handleKeyboardState(e);
  if (isGameEnded()) return;

  const k = e.key;
  if (k !== 'Backspace' && k !== ' ' && k !== 'Enter' && k.length !== 1) return;
  e.preventDefault();

  if (!startTime) {
    resetHistory(); // <-- start a fresh buffer for this run
    setWordsForHistoryFromChars(); // ensure _targetWords is populated for this run
    const now = Date.now();
    setStartTime(now);
    if (document.getElementById('ghostModeToggle')?.checked) startGhost();
    startMetrics(now);
  }



  if (getTimerDuration() > 0) startTimer();

  const prevCorrect = document.querySelectorAll('.char.correct').length;
  const prevErrors  = document.querySelectorAll('.char.incorrect, .char.skipped, .char.extra').length;

  if (k === 'Backspace') {
    logBackspace();
    await handleBackspace(textDisplay, hideControl);
  } else if (k === 'Enter') {
    const prevSkipped = new Set([...document.querySelectorAll('.char.skipped')]);
    logEnter();
    const cur = chars[currentIndex];
    const nxt = chars[currentIndex + 1];
    if (cur?.textContent === '\n') {
      await handleChar('\n', textDisplay, hideControl);
    } else if (cur?.classList.contains('correct') && nxt?.textContent === '\n') {
      setCurrentIndex(currentIndex + 1);
      await handleChar('\n', textDisplay, hideControl);
    } else {
      await handleSpace(textDisplay, hideControl);
    }
    const justSkipped = [...document.querySelectorAll('.char.skipped')].filter(n => !prevSkipped.has(n));
    if (justSkipped.length) logSkipped(justSkipped.map(n => n.textContent));
  } else if (k === ' ') {
    const prevSkipped = new Set([...document.querySelectorAll('.char.skipped')]);
    logSpace();
    await handleSpace(textDisplay, hideControl);
    const justSkipped = [...document.querySelectorAll('.char.skipped')].filter(n => !prevSkipped.has(n));
    if (justSkipped.length) logSkipped(justSkipped.map(n => n.textContent));
  } else {
    const idx = currentIndex;
    const cur = idx < chars.length ? chars[idx] : null;
    if (!cur || cur.textContent === ' ' || cur.textContent === '\n' || cur.classList.contains('correct')) {
      logExtra(k);
      await handleExtra(k, textDisplay, hideControl);
    } else {
      if (k === cur.textContent) logCorrect(k);
      else                        logIncorrect(k);
      await handleChar(k, textDisplay, hideControl);
    }
  }

  const correctCount = document.querySelectorAll('.char.correct').length;
  const incorrectCount = document.querySelectorAll('.char.incorrect').length;
  const skippedCount = document.querySelectorAll('.char.skipped').length;
  const extraCount = document.querySelectorAll('.char.extra').length;
  const totalErrors = incorrectCount + skippedCount + extraCount;
  const totalAttempted = correctCount + totalErrors;

  const newErrors    = document.querySelectorAll('.char.incorrect, .char.skipped, .char.extra').length;
  const strictMode   = document.getElementById('endOnMistakeCheckbox')?.checked === true;
  const addedCorrect = Math.max(0, correctCount - prevCorrect);
  const addedError   = newErrors > prevErrors;
  noteMetrics(Date.now(), addedCorrect, addedError);

  // --- live WPM (time-gated) ---
  const elapsedMs = startTime ? (Date.now() - startTime) : 0;

  let liveWpm = null;
  if (elapsedMs < WARMUP_MS) {
    wpmSpan.textContent = 'WPM: ...';
  } else {
    liveWpm = getLiveWPM(2000); // 2s rolling window
    wpmSpan.textContent = `WPM: ${liveWpm}`;
  }

  // accuracy stays live as before
  accSpan.textContent = `Accuracy: ${calculateAccuracy(totalAttempted, correctCount)}%`;
  
  // latch the very-first key outcome for this run
  if (!firstKeySeen) {
    firstKeyMistake = addedError && addedCorrect === 0;
    firstKeySeen = true;
  }

  if (strictMode && newErrors > prevErrors) endGame();

  // --- End if WPM < (time-gated) ---
  if (document.getElementById('endWpmToggle')?.checked && elapsedMs >= WARMUP_MS) {
    const minWPM = parseInt(document.getElementById('endWpmValue').value, 10);
    const currentWPM = liveWpm ?? getLiveWPM(2000);
    if (!isNaN(minWPM) && currentWPM < minWPM) endGame();
  }



  // End if Accuracy <
  if (document.getElementById('endAccToggle')?.checked && totalAttempted > 0) {
    const minAccuracy = parseFloat(document.getElementById('endAccValue').value);
    const currentAccuracy = parseFloat(accSpan.textContent.replace('Accuracy: ', '').replace('%', ''));
    if (!isNaN(minAccuracy) && currentAccuracy < minAccuracy) endGame();
  }

  const wordLimit = getWordLimit();
  if (wordLimit > 0) {
    // Only original, required chars (letters/punct in words), not spaces/newlines/extras
    const requiredNodes = chars.filter(n => n?.dataset?.required === '1');
    const totalRequired = requiredNodes.length;

    let attemptedRequired = 0;
    for (const n of requiredNodes) {
      const cl = n.classList;
      if (cl.contains('correct') || cl.contains('incorrect') || cl.contains('skipped')) {
        attemptedRequired++;
      }
    }

    // Progress bar
    const progress = totalRequired ? (attemptedRequired / totalRequired) : 0;
    const fill = document.getElementById('wordProgressFill');
    if (fill) {
      fill.style.width = Math.min(progress * 100, 100) + '%';
    }


    // Finish only when all required chars are attempted (extras don't help)
    if (attemptedRequired >= totalRequired) {
      endGame();
    }
  }





  // Append more text near end
  const selectedOption = getWordSizeOrMode();
  const isParagraphs = selectedOption === 'paragraphs';
  if (isParagraphs) {
    if (currentIndex >= originalLength - 50) {
      await appendTyping(textDisplay, hideControl);
      setWordsForHistoryFromChars();
    }
  } else {
    if (wordLimit === 0 && currentIndex >= originalLength - 50) {
      await appendTyping(textDisplay, hideControl);
      setWordsForHistoryFromChars();
    }
  }

  // Re-apply highlight & hide based on current modes
  const widx = getCurrentWord(chars, currentIndex);
  updateHighlight(getHighlightMode(highlightControl), widx, chars);
  updateHide(getHideMode(hideControl), widx, chars, textDisplay);
}

document.addEventListener('keydown', onKey);
document.addEventListener('keyup', (e) => {
  if (document.body.classList.contains('game-ended') || isGameEnded()) return;
  handleKeyboardState(e);
});
