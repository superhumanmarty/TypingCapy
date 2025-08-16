// js/app/events.js
export const EVT = {
  READY:            'capy:ready',
  UNLOCK:           'capy:unlock',
  RUN_RESET:        'capy:runReset',
  TEXT_READY:       'capy:textReady',
  TIME_UP:          'capy:timeup',
  RESULTS_PAINTED:  'capy:resultsPainted',
};

// Optional helpers (safe to keep even if unused)
export const emit = (name, detail) =>
  window.dispatchEvent(new CustomEvent(name, { detail }));

export const on = (name, handler, options) =>
  window.addEventListener(name, handler, options);
