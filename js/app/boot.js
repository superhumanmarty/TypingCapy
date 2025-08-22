// js/app/boot.js
import { startApp } from './start.js';
import { wireGlobalListeners } from './global-listeners.js';
import { setupMusic } from '../music.js';

import {
  enhanceSelect,
  wireMouseOnlySelects,
  refocusToGame,
  wireSettingsRefocus,
} from '../ui/selects.js';

import {
  populateLanguageOptions,
  updateUIForLanguage,
  initLanguageListeners,
} from '../ui/language.js';

import { watchResultsScreenForSettings } from '../ui/results.js';
import { setupCertificate } from '../certificate.js';
import { enforceWordLimitAvailability, setupGameLimitsButtons } from '../ui/limits.js';

import {
  initializeTyping,
  chars,
  currentIndex,
  sanitizeExistingText,
} from '../engine.js';

import {
  setupHide,
  getHideMode,
  getHighlightMode,
} from '../settings.js';

import {
  positionKeyboardDiagram,
  setupKeyboardDiagram,
} from '../keyboard.js';

import { bindThemeSelectors } from '../theme.js';
import { setupTypedErrorsToggle } from '../ui/typed-errors.js';
import { setupRestartButton, showInitialProgress, resetTimer } from '../timer.js';
import { wireRestartButtonUI } from '../ui/restart.js';

import { resetGameLock, setWordsForHistoryFromChars } from '../controller/game-controller.js';
import { getCurrentWord } from '../utils.js';
import { updateHide } from '../hide.js';
import { updateHighlight } from '../highlight.js';
import { resetMetrics, setAvgOverrideForRun, getLiveWPM } from '../metrics.js';
import { resetHistory } from '../history.js';

import { wireKeyboardVisibility } from '../ui/keyboard-visibility.js';
import { setupGhost } from '../ghost.js';
import { enforceTimerVisibility, setTimerLabelToFull } from '../ui/timer-hud.js';
import { initHideHighlightWatchers } from '../ui/hide-highlight-watchers.js';
import { initPills } from '../ui/pills-init.js';
import { setupHUD } from '../ui/hud.js';

export async function boot({ configs }) {
  // --- DOM refs ---
  const textDisplay = document.getElementById('textDisplay');
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

  setupHUD({ wpmSpan, accSpan, getLiveWPM, warmupMs: 2000 });

  // --- Start base layer ---
  startApp({ textDisplay, hideControl, highlightControl });

  // --- Enhance selects + populate language ---
  ['languageSelector','wordListSizeSelector'].forEach(id => enhanceSelect(id, { small: true }));
  enhanceSelect('themeSelector');
  enhanceSelect('musicSelector');   // ensure the new music dropdown is wired like others
  ['timerSelector','wordLimitSelector','musicSelector','soundSelector','hideWordsSelector','highlightAheadSelector']
    .forEach(id => enhanceSelect(id, { small: true }));

  setupMusic();

  populateLanguageOptions(configs);
  updateUIForLanguage(configs);

  // --- Results & certificate ---
  watchResultsScreenForSettings();
  setupCertificate();

  // --- Global UI wiring ---
  enforceWordLimitAvailability();
  wireMouseOnlySelects();
  wireSettingsRefocus(refocusToGame);

  // Make the music volume slider "mouse-only": blur on release so typing works immediately
  {
    const vol = document.getElementById('musicVolume'); // <- use your slider's id
    if (vol) {
      const blurBack = () => { try { vol.blur(); } catch(_) {} refocusToGame?.(); };
      vol.addEventListener('pointerup', blurBack);
      vol.addEventListener('touchend', blurBack, { passive: true });
      vol.addEventListener('change', blurBack); // keyboard or programmatic changes
    }
  }

  wireGlobalListeners({
    textDisplay,
    hideControl,
    highlightControl,
    wpmSpan,
    accSpan,
    setTimerLabelToFull,
    refocusToGame,
  });

  // --- Language listeners (changes rebuild text, etc.) ---
  initLanguageListeners(configs, {
    textDisplay,
    hideControl,
    highlightControl,
    initializeTyping,
    positionKeyboardDiagram,
    showInitialProgress,
    resetGameLock,
    setWordsForHistoryFromChars,
    enforceWordLimitAvailability,
  });

  // --- Initial run setup ---
  await initializeTyping(textDisplay, hideControl);
  setWordsForHistoryFromChars();
  positionKeyboardDiagram();
  setupHide(hideControl, chars, textDisplay, currentIndex);
  resetGameLock();

  // Hide/Highlight watchers
  initHideHighlightWatchers(hideControl, highlightControl, textDisplay);

  // Theme + keyboard diagram
  bindThemeSelectors(themeSelector, colorPickers);
  document.body.className = `theme-${themeSelector.value}`;
  setupKeyboardDiagram();
  wireKeyboardVisibility(positionKeyboardDiagram);

  // Typed errors pill
  setupTypedErrorsToggle();

  // Restart button wiring (reuses a bunch of helpers)
  setupRestartButton(initializeTyping, hideControl);
  wireRestartButtonUI({
    textDisplay,
    hideControl,
    resetHistory,
    setAvgOverrideForRun,
    sanitizeExistingText,
    setWordsForHistoryFromChars,
    getCurrentWord,
    updateHide,
    getHideMode,
    updateHighlight,
    getHighlightMode,
    resetMetrics,
    resetTimer,
    setTimerLabelToFull,
    resetGameLock,
    applyKeyboardVisibility: () => {
      const toggle = document.getElementById('keyboardDiagramToggle');
      const panel  = document.getElementById('keyboardDiagram');
      if (!toggle || !panel) return;
      const show = toggle.checked;
      panel.classList.toggle('hidden', !show);
      if (show) positionKeyboardDiagram();
    },
  });

  // Feature inits
  setupGhost();
  showInitialProgress();
  initPills({ textDisplay });

  // Game Limits (3-button)
  setupGameLimitsButtons({
    textDisplay,
    hideControl,
    highlightControl,
    enforceTimerVisibility,
    setTimerLabelToFull,
    resetGameLock,
    positionKeyboardDiagram,
  });
}
