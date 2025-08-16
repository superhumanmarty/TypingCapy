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

// Defaults you asked for:
document.addEventListener('DOMContentLoaded', () => {
  // Language: prefer eng/en/English
  setDefaultWhenReady('languageSelector',
  ['eng','en','en-US','english'],
  ['english']
  );


  // Word list size: prefer 500 (or “500 words”)
  setDefaultWhenReady('wordListSizeSelector',
    ['500'],
    ['500']
  );
});
