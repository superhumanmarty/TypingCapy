// js/main.js
import { loadConfigs } from './app/config.js';
import { boot } from './app/boot.js';
import { EVT } from './app/events.js';

window.addEventListener('DOMContentLoaded', async () => {
  const configs = await loadConfigs();
  window.configs = configs; // keep if other modules read it
  await boot({ configs });
  window.dispatchEvent(new Event(EVT.READY));
  document.body.tabIndex = 0;
  document.body.focus();
});