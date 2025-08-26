// app/persist-state.js
// Persist ONLY the selected theme across refreshes and future visits.

const THEME_KEY = 'kb:theme:v1';

const $ = (id) => document.getElementById(id);

function getThemeSelect() {
  // Support either id just in case
  return $('themeSelector') || $('themeSelect') || null;
}

function optionExists(sel, val) {
  return Array.from(sel.options).some(o => String(o.value) === String(val));
}

function applyThemeValue(sel, val) {
  if (!sel || val == null) return;
  const v = String(val);
  if (!optionExists(sel, v)) return;

  if (String(sel.value) !== v) {
    sel.value = v;
  }
  // Fire change so whatever applies classes/styles runs
  sel.dispatchEvent(new Event('change', { bubbles: true }));
}

function readSavedTheme() {
  try { return localStorage.getItem(THEME_KEY) || null; } catch { return null; }
}

function saveTheme(val) {
  try { if (val != null) localStorage.setItem(THEME_KEY, String(val)); } catch {}
}

/**
 * Call once after your selects are populated (after boot + enhance).
 * - Restores saved theme immediately.
 * - Re-applies next frame and shortly after to beat any "default theme" scripts.
 * - Saves new selection on any change.
 */
export function initThemePersistence() {
  const sel = getThemeSelect();
  if (!sel) return;

  const saved = readSavedTheme();

  if (saved) {
    // Strongly assert the saved theme
    applyThemeValue(sel, saved);
    requestAnimationFrame(() => applyThemeValue(sel, saved));
    setTimeout(() => applyThemeValue(sel, saved), 60);
  } else {
    // No saved theme yet—remember the current one for the next visit
    if (sel.value) saveTheme(sel.value);
  }

  // Keep it up-to-date whenever user changes the theme
  sel.addEventListener('change', () => saveTheme(sel.value));
}
