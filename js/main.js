// js/main.js
import { updateHighlight } from './highlight.js';
import { calculateWPM, calculateAccuracy, getCurrentWord } from './utils.js';
import { updateHide } from './hide.js';
import { initializeTyping, appendTyping, chars, currentIndex, startTime, setCurrentIndex, setStartTime, originalLength } from './engine.js';
import { setupHide, watchHideRadios, watchHideSelector, getHideMode, getHighlightMode, watchHighlightSelector, watchHighlightRadios } from './settings.js';
import { bindThemeSelectors } from './theme.js';
import { handleChar } from './handlers/char.js';
import { handleSpace } from './handlers/space.js';
import { handleBackspace } from './handlers/backspace.js';
import { handleExtra } from './handlers/extra.js';
import { setupKeyboardDiagram, handleKeyboardState } from './keyboard.js';
import { startTimer, resetTimer, setupRestartButton, watchTimerControl, isGameEnded, endTimer, getTimerDuration, showInitialProgress, getWordLimit } from './timer.js';
import { setupGhost, startGhost, stopGhost, saveSpeed } from './ghost.js';

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


  updateUIForLanguage();
  enforceWordLimitAvailability(); // <-- add this line



  languageSelector.addEventListener('change', async () => {
    updateUIForLanguage();
    enforceWordLimitAvailability();
    await initializeTyping(textDisplay, hideControl);
    showInitialProgress();

    // Re-apply highlight for the new text based on current selection
    const widx = getCurrentWord(chars, 0);
    updateHighlight(getHighlightMode(highlightControl), widx, chars);
  });

  const wordListSizeSelector = document.getElementById('wordListSizeSelector');
  if (wordListSizeSelector) {
    wordListSizeSelector.addEventListener('change', async () => {
      enforceWordLimitAvailability();
      
      await initializeTyping(textDisplay, hideControl);
      showInitialProgress();
      const widx = getCurrentWord(chars, 0);
      updateHighlight(getHighlightMode(highlightControl), widx, chars);
    });
  }


  ['punctuationToggle','numbersToggle','numbersExprToggle','symbolsToggle'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', async () => {
        // Keep the subtoggles visibility in sync
        setupSubtoggleVisibility();

        await initializeTyping(textDisplay, hideControl);
        showInitialProgress();
        const widx = getCurrentWord(chars, 0);
        updateHighlight(getHighlightMode(highlightControl), widx, chars);
      });
    }
  });


  // Initial setup
  await initializeTyping(textDisplay, hideControl);
  setupHide(hideControl, chars, textDisplay, currentIndex);

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
    if (keyboardToggle && keyboardPanel) {
      keyboardPanel.classList.toggle('hidden', !keyboardToggle.checked);
    }
  }

  // wire checkbox -> visibility
  const keyboardToggle = document.getElementById('keyboardDiagramToggle');
  if (keyboardToggle) {
    keyboardToggle.addEventListener('change', applyKeyboardVisibility);
  }
  applyKeyboardVisibility();

  // NEW: checkbox handling for typed errors visibility
  const showTypedErrorsToggle = document.getElementById('showTypedErrorsToggle');
  const typedErrorDisplay     = document.getElementById('typedErrorDisplay');
  if (showTypedErrorsToggle && typedErrorDisplay) {
    const applyTypedErrorsVisibility = () => {
      typedErrorDisplay.classList.toggle('hidden', !showTypedErrorsToggle.checked);
    };
    showTypedErrorsToggle.addEventListener('change', applyTypedErrorsVisibility);
    applyTypedErrorsVisibility(); // set initial state
  }

  watchTimerControl(hideControl);
  setupRestartButton(initializeTyping, hideControl);

  // Re-apply keyboard guide visibility after a restart
  document.getElementById('restartButton')?.addEventListener('click', () => {
    // Hide "You typed" bubble and clear last letter
    const ted = document.getElementById('typedErrorDisplay');
    if (ted) ted.classList.add('hidden');
    const tl = document.getElementById('typedLetter');
    if (tl) tl.textContent = '';

    // let initializeTyping finish first
    setTimeout(applyKeyboardVisibility, 0);
  });


  watchWordLimitRadios();
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

    async function setActive(mode) {
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

      // keep the progress bar / availability in sync
      enforceWordLimitAvailability();

      // full reset & re-render exactly once (no races)
      resetTimer();
      setStartTime(0);
      setCurrentIndex(0);
      await initializeTyping(textDisplay, hideControl);
      showInitialProgress();

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
    btnWord   .addEventListener('click', () => setActive('word'));

    timerInlineSelect.addEventListener('change', () => {
      setActive('timer');   // always route through setActive
    });

    wordInlineSelect.addEventListener('change', () => {
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
  const wlsSel = document.getElementById('wordListSizeSelector');
  const wlSel  = document.getElementById('wordLimitSelector');
  const progress = document.getElementById('wordProgress');

  const isParagraphs = wlsSel && wlsSel.value === 'paragraphs';

  if (wlSel) {
    if (isParagraphs) {
      wlSel.value = 'off';
      wlSel.disabled = true;
      progress?.classList.add('hidden');
    } else {
      wlSel.disabled = false;
      // only show progress bar when WL is not off
      if (progress) {
        if (wlSel.value === 'off') progress.classList.add('hidden');
        else progress.classList.remove('hidden');
      }
    }
  }
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


// Unified key handler
async function onKey(e) {

  // Ignore typing while user is editing a control
  const ae = document.activeElement;
  if (
    ae &&
    (ae.tagName === 'INPUT' ||
     ae.tagName === 'SELECT' ||
     ae.tagName === 'TEXTAREA' ||
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
    setStartTime(Date.now());
    if (document.getElementById('ghostModeToggle')?.checked) startGhost();
  }

  if (getTimerDuration() > 0) startTimer();

  const oldErrors = document.querySelectorAll('.char.incorrect, .char.skipped, .char.extra').length;

  if (k === 'Backspace') {
    await handleBackspace(textDisplay, hideControl);
  } else if (k === 'Enter') {
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
  } else if (k === ' ') {
    await handleSpace(textDisplay, hideControl);
  } else {
    const idx = currentIndex;
    const cur = idx < chars.length ? chars[idx] : null;
    if (!cur || cur.textContent === ' ' || cur.textContent === '\n' || cur.classList.contains('correct')) {
      await handleExtra(k, textDisplay, hideControl);
    } else {
      await handleChar(k, textDisplay, hideControl);
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
  const strictMode = document.getElementById('endOnMistakeCheckbox')?.checked === true;

  if (strictMode && newErrors > oldErrors) endTimer();

  // End if WPM <
  if (document.getElementById('endWpmToggle')?.checked && totalAttempted > 0) {
    const minWPM = parseInt(document.getElementById('endWpmValue').value, 10);
    const currentWPM = parseInt(wpmSpan.textContent.replace('WPM: ', ''), 10);
    if (!isNaN(minWPM) && currentWPM < minWPM) endTimer();
  }

  // End if Accuracy <
  if (document.getElementById('endAccToggle')?.checked && totalAttempted > 0) {
    const minAccuracy = parseFloat(document.getElementById('endAccValue').value);
    const currentAccuracy = parseFloat(accSpan.textContent.replace('Accuracy: ', '').replace('%', ''));
    if (!isNaN(minAccuracy) && currentAccuracy < minAccuracy) endTimer();
  }

  const wordLimit = getWordLimit();
  if (wordLimit > 0) {
    // Only consider originally generated characters
    const totalAll = originalLength || chars.length;

    // Find the last *required* index (ignore trailing space/newline/sentinels)
    let lastRequiredIndex = -1;
    for (let i = totalAll - 1; i >= 0; i--) {
      const node = chars[i];
      if (!node) continue;
      const t = node.textContent;
      // skip trailing whitespace and hidden newline placeholders
      const isHiddenNewline = node.classList.contains('newline');
      if (t === ' ' || t === '\n' || isHiddenNewline) continue;
      lastRequiredIndex = i;
      break;
    }
    const totalRequired = (lastRequiredIndex >= 0) ? (lastRequiredIndex + 1) : 0;

    // Count required chars that have been attempted in any way
    let attemptedRequired = 0;
    for (let i = 0; i < totalRequired; i++) {
      const cl = chars[i].classList;
      if (cl.contains('correct') || cl.contains('incorrect') || cl.contains('skipped')) {
        attemptedRequired++;
      }
    }

    // Progress bar based on attempts, capped at 100%
    const progress = totalRequired ? (attemptedRequired / totalRequired) : 0;
    document.getElementById('wordProgressFill').style.width =
      Math.min(progress * 100, 100) + '%';

    // Finish if ALL required are attempted OR caret moved past the last required char
    if (attemptedRequired >= totalRequired || currentIndex > lastRequiredIndex) {
      endTimer();
    }
  }




  // Append more text near end
  const selectedOption = getWordSizeOrMode();
  const isParagraphs = selectedOption === 'paragraphs';
  if (isParagraphs) {
    if (currentIndex >= originalLength - 50) {
      await appendTyping(textDisplay, hideControl);
    }
  } else {
    if (wordLimit === 0 && currentIndex >= originalLength - 50) {
      await appendTyping(textDisplay, hideControl);
    }
  }

  // Re-apply highlight & hide based on current modes
  const widx = getCurrentWord(chars, currentIndex);
  updateHighlight(getHighlightMode(highlightControl), widx, chars);
  updateHide(getHideMode(hideControl), widx, chars, textDisplay);
}

document.addEventListener('keydown', onKey);
document.addEventListener('keyup', (e) => handleKeyboardState(e));