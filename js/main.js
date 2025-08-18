// js/main.js
import { enhancePillSelects } from './ui/enhancedSelect.js'; // <-- fix path
import { loadConfigs } from './app/config.js';
import { boot } from './app/boot.js';
import { EVT } from './app/events.js';
import { initSmoothCaret } from './smooth-caret.js';

window.addEventListener('DOMContentLoaded', async () => {
  const configs = await loadConfigs();
  window.configs = configs;
  await boot({ configs });       // make sure selects are populated first

  enhancePillSelects();          // then enhance them

  window.dispatchEvent(new Event(EVT.READY));
  document.body.tabIndex = 0;
  document.body.focus();

  const textDisplay = document.getElementById('textDisplay');
  initSmoothCaret({
    textDisplay,
    // optional tweaks:
    // color: '#1f63ff',
    // width: 2,
    // transitionMs: 120,
    // blink: true,
  });
});
