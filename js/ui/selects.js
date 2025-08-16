// js/ui/selects.js

// Make a native <select> look/behave like your pill and open on click
export function enhanceSelect(id, { small = false } = {}) {
  const sel = document.getElementById(id);
  if (!sel || sel.classList.contains('ui-select')) return;

  sel.classList.add('ui-select');

  const wrap = document.createElement('div');
  wrap.className = 'select-pill' + (small ? ' small' : '');
  sel.parentNode.insertBefore(wrap, sel);
  wrap.appendChild(sel);

  wrap.addEventListener('click', (e) => {
    if (sel.disabled) return;
    if (e.target === sel) return;
    sel.focus();
    if (typeof sel.showPicker === 'function') sel.showPicker();
    else {
      sel.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      sel.click();
    }
  });
}

// selectors that should be mouse-only
const SETTINGS_SELECTS = [
  '#limitsHero .btn-dropdown select',
  '.select-pill select.ui-select',
  '#languageSelector',
  '#wordListSizeSelector',
  '#timerInlineSelect',
  '#wordLimitInlineSelect',
  '#timerSelector',
  '#wordLimitSelector',
  '#themeSelector',
  '#soundSelector',
  '#hideWordsSelector',
  '#highlightAheadSelector'
].join(', ');

// force mouse-only on SELECTs & bounce focus back to the game
export function wireMouseOnlySelects(root = document) {
  root.querySelectorAll(SETTINGS_SELECTS).forEach(sel => {
    if (sel.dataset.mouseOnlyWired) return;
    sel.dataset.mouseOnlyWired = '1';

    sel.setAttribute('tabindex', '-1');

    ['change','blur'].forEach(evt =>
      sel.addEventListener(evt, () => setTimeout(refocusToGame, 0))
    );

    sel.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      requestAnimationFrame(refocusToGame);
    });
  });
}

// Put keyboard focus back on the game immediately after a settings action
export function refocusToGame() {
  requestAnimationFrame(() => {
    const ae = document.activeElement;
    if (ae && ae !== document.body && typeof ae.blur === 'function') ae.blur();
    document.body.focus({ preventScroll: true });
  });
}

export function wireSettingsRefocus(refocusToGame) {
  const settingsRoot = document.querySelector('.settings-panel');
  if (!settingsRoot || settingsRoot.dataset.refocusWired) return;
  settingsRoot.dataset.refocusWired = '1';

  settingsRoot.addEventListener('change', (e) => {
    const t = e.target;
    if (t.matches('select') || t.matches('input[type="checkbox"]')) {
      refocusToGame();
    }
  });

  settingsRoot.addEventListener('click', (e) => {
    if (e.target.closest('#ghostWpmWrapper, #endWpmWrapper, #endAccWrapper')) return;
    if (e.target.closest('.select-pill')) return;
    if (e.target.closest('.btn-dropdown')) return;
    if (e.target.closest('button, [role="button"], .pill.option, .split-half, #hidePill, #highlightPill, #typedErrorsPill, #ghostCursorSettings')) {
      refocusToGame();
    }
  });
}

