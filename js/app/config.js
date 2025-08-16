// js/app/config.js

// Centralized paths
export const PATHS = {
  languageConfig: './data/language_configs.json',
};

// Centralized defaults (so you don’t hardcode “magic numbers” around)
export const DEFAULTS = {
  WARMUP_MS: 2000,  // 2s warmup
};

// Loader for language configs. Also stores on window for legacy code.
export async function loadConfigs() {
  const res = await fetch(PATHS.languageConfig);
  const configs = await res.json();
  window.configs = configs;
  return configs;
}
