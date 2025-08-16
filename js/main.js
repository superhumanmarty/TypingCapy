// js/main.js
import { enhancePillSelects } from './ui/enhancedSelect.js'; // <-- fix path
import { loadConfigs } from './app/config.js';
import { boot } from './app/boot.js';
import { EVT } from './app/events.js';

window.addEventListener('DOMContentLoaded', async () => {
  const configs = await loadConfigs();
  window.configs = configs;
  await boot({ configs });       // make sure selects are populated first

  enhancePillSelects();          // then enhance them

  window.dispatchEvent(new Event(EVT.READY));
  document.body.tabIndex = 0;
  document.body.focus();
});
