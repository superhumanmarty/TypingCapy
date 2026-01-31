// js/defaultSelects.js
// Pick defaults for language + word list size when options exist,
// then dispatch 'change' so pill labels update.

const setDefaultWhenReady = (selectId, preferValues = [], preferTextContains = []) => {
  const sel = document.getElementById(selectId);
  if (!sel) return;

  const tryPick = () => {
    // already has a selection?
    if (sel.selectedIndex >= 0 && sel.options[sel.selectedIndex]) return true;

    const opts = Array.from(sel.options || []);
    if (!opts.length) return false;

    const toLower = (s) => String(s || '').trim().toLowerCase();

    const byValue = opts.find(o => preferValues.map(toLower).includes(toLower(o.value)));
    const byText  = opts.find(o => preferTextContains.some(t => toLower(o.text).includes(toLower(t))));

    const choice = byValue || byText || opts[0];
    if (choice) {
      choice.selected = true;
      // fire normal change so any listeners + pill UI update their label
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    return false;
  };

  if (tryPick()) return; // options already there

  // Wait for options to be inserted (your main.js likely populates later)
  const mo = new MutationObserver(() => {
    if (tryPick()) mo.disconnect();
  });
  mo.observe(sel, { childList: true, subtree: true });
};

// Defaults you asked for (force even if something is already selected)
document.addEventListener('DOMContentLoaded', () => {
  const tl = s => String(s || '').trim().toLowerCase();

  // Force-select by value/text (tries multiple possible IDs)
  const forceSelect = (idCandidates, preferValues = [], preferTextContains = []) => {
    const sel = idCandidates.map(id => document.getElementById(id)).find(Boolean);
    if (!sel || !sel.options || !sel.options.length) return;

    const opts = Array.from(sel.options);
    const byValue = opts.find(o => preferValues.map(tl).includes(tl(o.value)));
    const byText  = opts.find(o => preferTextContains.some(t => tl(o.text).includes(tl(t))));
    const choice = byValue || byText;
    if (!choice) return;

    sel.value = choice.value; // force it even if something was preselected
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  };

  // Language: English
  forceSelect(
    ['languageSelector', 'languageSelect'],
    ['eng', 'en', 'en-us', 'english'],
    ['english']
  );

  // Word list size: English "100 most common words"
  forceSelect(
    ['wordListSizeSelector', 'wordListSelector', 'wordCountSelector'],
    ['100', 'subset:eng:top100'],
    ['100 most', '100 words', 'top 100', 'most common']
  );

  // Theme: if "Random" is selected, pick a random actual theme on load
  const themeIds = ['themeSelector', 'themeSelect'];
  const resolveThemeSelect = () => themeIds.map(id => document.getElementById(id)).find(Boolean);

  const setRandomOptionLabel = (themeSel) => {
    const randomOpt = themeSel?.querySelector('option[value="random"]');
    if (randomOpt) randomOpt.textContent = 'Random';
  };

  const applyRandomTheme = () => {
    const themeSel = resolveThemeSelect();
    if (!themeSel || !themeSel.options?.length) return false;

    const opts = Array.from(themeSel.options).filter(o => o && o.value && o.value !== 'random');
    if (!opts.length) return false;

    const randomOption = opts[Math.floor(Math.random() * opts.length)];

    themeSel.dataset.randomResolved = randomOption.value;
    themeSel.dataset.randomApply = '1';
    themeSel.value = randomOption.value;
    themeSel.dispatchEvent(new Event('change', { bubbles: true }));
    themeSel.dataset.randomApply = '';

    setRandomOptionLabel(themeSel);
    themeSel.value = 'random';
    return randomOption.value;
  };

  const initTheme = () => {
    const themeSel = resolveThemeSelect();
    if (!themeSel) return;

    const onChange = () => {
      if (themeSel.dataset.randomApply === '1') return;
      if (themeSel.value === 'random') {
        applyRandomTheme();
      } else {
        themeSel.dataset.randomResolved = '';
        setRandomOptionLabel(themeSel);
      }
    };

    themeSel.addEventListener('change', onChange);

    if (themeSel.value === 'random') {
      applyRandomTheme();
    } else if (!themeSel.value) {
      themeSel.value = 'minimalist';
      themeSel.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  const themeSelImmediate = resolveThemeSelect();
  if (themeSelImmediate) {
    initTheme();
  } else {
    const mo = new MutationObserver(() => {
      if (resolveThemeSelect()) {
        initTheme();
        mo.disconnect();
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }
});

