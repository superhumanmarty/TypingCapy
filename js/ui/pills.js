// js/ui/pills.js
import { getCurrentWord } from '../utils.js';
import { updateHide } from '../hide.js';
import { updateHighlight } from '../highlight.js';
import { chars, currentIndex } from '../engine.js';


// ------- shared helpers -------
function guardEditingThreshold(e) {
  if (!document.body.classList.contains('editing-threshold')) return false;
  // swallow the event so no toggling occurs while editing a number
  e?.preventDefault?.();
  e?.stopImmediatePropagation?.();

  // If a number input is focused, blur it to exit the mode
  const focused = document.activeElement;
  if (focused && focused.matches?.('#endWpmWrapper input[type="number"], #endErrWrapper input[type="number"], #ghostWpmWrapper input[type="number"]')) {
    focused.blur(); // your blur listener will clear classes & unblur the UI
  } else {
    document.body.classList.remove('editing-threshold','editing-wpm','editing-err','editing-ghost');
  }
  return true;
}

export function setupToggleWithNumber(toggleId, wrapperId, defaultValue) {
  const toggle  = document.getElementById(toggleId);
  const wrapper = document.getElementById(wrapperId);
  const pill    = toggle ? toggle.closest('.pill') : null;
  if (!toggle || !wrapper || !pill) return;

  const apply = () => {
    const on = toggle.checked;

    if (wrapperId !== 'ghostWpmWrapper') {
      wrapper.classList.toggle('hidden', !on);
    } else {
      on ? slideOpen(wrapper) : slideClose(wrapper);
    }

    // Drive the pill “open/closed” state (Ghost animation uses this)
    pill.classList.toggle('active', on);

    if (on) {
      const input = wrapper.querySelector('input[type="number"]');
      if (input && (input.value === '' || input.value == null)) input.value = defaultValue;
    }
  };

  toggle.addEventListener('change', apply);
  apply();
}

export function wireSplitPill(pillId, checkboxId, wrapperId) {
  const pill     = document.getElementById(pillId);
  const checkbox = document.getElementById(checkboxId);
  const wrapper  = document.getElementById(wrapperId);
  if (!pill || !checkbox) return;

  const sync = () => {
    pill.classList.toggle('active', checkbox.checked);
    if (wrapper) wrapper.classList.toggle('hidden', !checkbox.checked);
  };

  const toggle = () => {
    checkbox.checked = !checkbox.checked;
    checkbox.dispatchEvent(new Event('change'));
  };

  pill.addEventListener('click', (e) => {
    // If we just exited the ghost number editor on this click, don't toggle ghost
    if (pill.id === 'ghostCursorSettings' && window.__suppressGhostToggleOnce) {
      window.__suppressGhostToggleOnce = false;
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    if (guardEditingThreshold(e)) return;
    if (wrapper && wrapper.contains(e.target)) return;
    if (checkbox.disabled) return;            // <- ignore while editing/locked
    toggle();
  });

  checkbox.addEventListener('change', sync);
  sync();
}

export function wireSinglePill(pillId, checkboxId) {
  const pill   = document.getElementById(pillId);
  const toggle = document.getElementById(checkboxId);
  if (!pill || !toggle) return;

  const sync = () => pill.classList.toggle('active', toggle.checked);
  const activate = () => {
    if (toggle.disabled) return;            // <- guard
    toggle.checked = !toggle.checked;
    toggle.dispatchEvent(new Event('change'));
  };

  pill.addEventListener('click', (e) => {
    if (guardEditingThreshold(e)) return;
    activate();
  });
  toggle.addEventListener('change', sync);
  sync();
}

export function wirePillToggle(pillId, checkboxId) {
  const pill = document.getElementById(pillId);
  const cb   = document.getElementById(checkboxId);
  if (!pill || !cb) return;

  const sync = () => pill.classList.toggle('active', cb.checked);
  pill.addEventListener('click', (e) => {
    if (guardEditingThreshold(e)) return;
    if (cb.disabled) return;
    cb.checked = !cb.checked;
    cb.dispatchEvent(new Event('change'));
  });
  cb.addEventListener('change', sync);
  sync();
}

function _forceReflow(el) { void el.offsetHeight; }

function slideOpen(el) {
  if (el.classList.contains('is-open')) return; // already open
  el.classList.add('is-open');
  el.style.overflow = 'hidden';
  el.style.height = '0px';
  _forceReflow(el);
  const end = el.scrollHeight;
  el.style.height = end + 'px';
  const done = (ev) => {
    if (ev.propertyName !== 'height') return;
    el.style.height = 'auto';                // <-- keep it open
    el.removeEventListener('transitionend', done);
  };
  el.addEventListener('transitionend', done);
}

function slideClose(el) {
  if (!el.classList.contains('is-open')) return; // already closed
  el.style.overflow = 'hidden';
  const start = el.scrollHeight;
  el.style.height = start + 'px';
  _forceReflow(el);
  el.classList.remove('is-open');
  el.style.height = '0px';
  const done = (ev) => {
    if (ev.propertyName !== 'height') return;
    el.style.height = '';                     // back to CSS baseline
    el.removeEventListener('transitionend', done);
  };
  el.addEventListener('transitionend', done);
}


export function wireGhostPill() {
  const pill  = document.getElementById('ghostCursorSettings');
  const cb    = document.getElementById('ghostModeToggle');
  const wrap  = document.getElementById('ghostWpmWrapper');
  const input = document.getElementById('customGhostWPM');
  if (!pill || !cb || !wrap) return;

  // safety: clear any old inline styles from the height-based version
  wrap.style.removeProperty('height');
  wrap.style.removeProperty('overflow');

  const sync = () => {
    const on = !!cb.checked;
    pill.classList.toggle('active', on);       // drives CSS max-height animation
    wrap.classList.toggle('is-open', on);      // optional; keeps it explicit
    if (on && input && (input.value === '' || input.value == null)) input.value = 60;
  };

  // While editing ghost WPM, pill-surface clicks should just exit edit mode (not toggle)
  const stopIfEditingGhost = (e) => {
    if (!document.body.classList.contains('editing-threshold') ||
        !document.body.classList.contains('editing-ghost')) return;
    if (e.target.closest('#ghostWpmWrapper')) return; // allow input area
    e.preventDefault();
    e.stopImmediatePropagation();
    const ae = document.activeElement;
    if (ae && ae.matches?.('#ghostWpmWrapper input[type="number"]')) ae.blur();
  };
  ['pointerdown','click','touchstart'].forEach(evt => {
    pill.addEventListener(evt, stopIfEditingGhost, { capture: true, passive: false });
  });

  // Keep events inside the number editor from bubbling
  ['pointerdown','click','mousedown','mouseup','touchstart','touchend'].forEach(evt =>
    wrap.addEventListener(evt, (e) => e.stopPropagation(), { passive: false })
  );
  ['keydown','keyup','keypress'].forEach(evt =>
    input?.addEventListener(evt, (e) => e.stopPropagation())
  );

  // Main pill click → toggle (unless editing / label / checkbox / input area)
  pill.addEventListener('click', (e) => {
    if (window.__suppressGhostToggleOnce) {
      window.__suppressGhostToggleOnce = false;
      e.preventDefault();
      e.stopImmediatePropagation();
      return; // exit-only
    }
    if (wrap.contains(e.target)) return; // clicks inside number box never toggle
    if (cb.disabled) return;

    const clickedLabel = e.target.closest('label');
    const labelTargetsCb =
      clickedLabel && (clickedLabel.htmlFor === 'ghostModeToggle' || clickedLabel.contains(cb));
    if (labelTargetsCb || e.target === cb) return;

    cb.checked = !cb.checked;
    cb.dispatchEvent(new Event('change'));
  });

  // Capture-phase guard: if user is editing, revert any checkbox change here.
  cb.addEventListener('change', (e) => {
    if (document.body.classList.contains('editing-threshold')) {
      e.stopImmediatePropagation();
      cb.checked = !cb.checked; // revert
    }
  }, true);

  // Single source of truth for visual state
  cb.addEventListener('change', sync);

  // Initial paint
  sync();
}



export function setupSubtoggleVisibility() {
  const numbers = document.getElementById('numbersToggle');
  const numbersExprWrap = document.getElementById('numbersExprWrapper');
  const punct = document.getElementById('punctuationToggle');
  const symbolsWrap = document.getElementById('symbolsWrapper');

  const apply = () => {
    if (numbers && numbersExprWrap) {
      numbersExprWrap.classList.toggle('hidden', !numbers.checked);
    }
    if (punct && symbolsWrap) {
      symbolsWrap.classList.toggle('hidden', !punct.checked);
    }
  };

  apply();
  numbers?.addEventListener('change', apply);
  punct?.addEventListener('change', apply);
}

export function setupThresholdToggle(groupId, radioName, wrapperId, defaultValue) {
  const group = document.getElementById(groupId);
  if (!group) return;

  const wrapper = document.getElementById(wrapperId);
  const radios = [...document.querySelectorAll(`input[name="${radioName}"]`)];
  if (!wrapper || radios.length === 0) return;

  const apply = () => {
    const on = toggle.checked;

    // For most toggles, keep old behavior
    if (wrapperId !== 'ghostWpmWrapper') {
      wrapper.classList.toggle('hidden', !on);
    }

    pill.classList.toggle('active', on); // ghost pill animation uses this

    if (on) {
      const input = wrapper.querySelector('input[type="number"]');
      if (input && (input.value === '' || input.value == null)) input.value = defaultValue;
    }
  };


  radios.forEach(r => r.addEventListener('change', apply));
  apply();
}

// dependency linkers for split pills (main + extra)
export function wireSplitDependency({
  mainBtnId, extraBtnId,
  mainToggleId, extraToggleId
}) {
  const mainBtn  = document.getElementById(mainBtnId);
  const extraBtn = document.getElementById(extraBtnId);
  const mainT    = document.getElementById(mainToggleId);
  const extraT   = document.getElementById(extraToggleId);
  if (!mainBtn || !extraBtn || !mainT || !extraT) return;

  const sync = () => {
    mainBtn.classList.toggle('is-on', !!mainT.checked);
    const enabled = !!mainT.checked;
    extraBtn.setAttribute('aria-disabled', enabled ? 'false' : 'true');
    extraBtn.classList.toggle('is-on', !!extraT.checked && enabled);
  };

  mainBtn.addEventListener('click', () => {
    mainT.checked = !mainT.checked;
    mainT.dispatchEvent(new Event('change'));
    if (!mainT.checked && extraT.checked) {
      extraT.checked = false;
      extraT.dispatchEvent(new Event('change'));
    }
    sync();
  });

  extraBtn.addEventListener('click', () => {
    if (!mainT.checked) return;
    extraT.checked = !extraT.checked;
    extraT.dispatchEvent(new Event('change'));
    sync();
  });

  mainT.addEventListener('change', sync);
  extraT.addEventListener('change', sync);
  sync();
}

// ---- Hide/Highlight UI helpers ----
function setChoiceText(pillId, labelId, text) {
  const pill = document.getElementById(pillId);
  if (!pill) return;
  let label = document.getElementById(labelId);
  if (!label) {
    label = document.createElement('div');
    label.id = labelId;
    label.className = 'pill-value';
    pill.appendChild(label);
  }
  label.textContent = text || '';
}

export function setHideModeUI(mode, textDisplay) {
  const sel = document.getElementById('hideWordsSelector');
  if (sel) sel.value = mode;

  const pill = document.getElementById('hidePill');
  const opts = document.getElementById('hideOptions');

  if (mode === 'off') {
    pill.classList.remove('active');
    setChoiceText('hidePill', 'hideChoiceLabel', '');
  } else {
    pill.classList.add('active');
    setChoiceText('hidePill', 'hideChoiceLabel', mode === 'current' ? 'current' : 'current & next');
  }

  pill.classList.remove('hidden');
  opts.classList.add('hidden');

  const widx = getCurrentWord(chars, currentIndex);
  updateHide(mode, widx, chars, textDisplay);
}

export function setHighlightModeUI(mode) {
  const sel = document.getElementById('highlightAheadSelector');
  if (sel) sel.value = mode;

  const pill = document.getElementById('highlightPill');
  const opts = document.getElementById('highlightOptions');

  if (mode === 'off') {
    pill.classList.remove('active');
    setChoiceText('highlightPill', 'highlightChoiceLabel', '');
  } else {
    pill.classList.add('active');
    setChoiceText('highlightPill', 'highlightChoiceLabel', mode === 'next' ? 'next' : '2nd');
  }

  pill.classList.remove('hidden');
  opts.classList.add('hidden');

  const widx = getCurrentWord(chars, currentIndex);
  updateHighlight(mode, widx, chars);
}

export const turnHideOff = (textDisplay) => setHideModeUI('off', textDisplay);
export const turnHighlightOff = () => setHighlightModeUI('off');

export function closeAllOptionRows() {
  document.getElementById('hideOptions')?.classList.add('hidden');
  document.getElementById('highlightOptions')?.classList.add('hidden');
  document.getElementById('hidePill')?.classList.remove('hidden');
  document.getElementById('highlightPill')?.classList.remove('hidden');
}

export function wireHideHighlightPills({ textDisplay }) {
  const hidePill = document.getElementById('hidePill');
  const hideOpts = document.getElementById('hideOptions');
  hidePill?.addEventListener('click', () => {
    const willOpen = hideOpts.classList.contains('hidden');
    closeAllOptionRows();
    if (willOpen) {
      hidePill.classList.add('hidden');
      hideOpts.classList.remove('hidden');
    }
  });
  document.getElementById('hideOff')?.addEventListener('click', () => {
    setHideModeUI('off', textDisplay);
  });
  document.getElementById('hideCurrent')?.addEventListener('click', () => {
    turnHighlightOff();
    setHideModeUI('current', textDisplay);
  });
  document.getElementById('hideCurrentNext')?.addEventListener('click', () => {
    turnHighlightOff();
    setHideModeUI('currentNext', textDisplay);
  });

  const hlPill = document.getElementById('highlightPill');
  const hlOpts = document.getElementById('highlightOptions');
  hlPill?.addEventListener('click', () => {
    const willOpen = hlOpts.classList.contains('hidden');
    closeAllOptionRows();
    if (willOpen) {
      hlPill.classList.add('hidden');
      hlOpts.classList.remove('hidden');
    }
  });
  document.getElementById('hlOff')?.addEventListener('click', () => {
    setHighlightModeUI('off');
  });
  document.getElementById('hlNext')?.addEventListener('click', () => {
    turnHideOff(textDisplay);
    setHighlightModeUI('next');
  });
  document.getElementById('hlNext2')?.addEventListener('click', () => {
    turnHideOff(textDisplay);
    setHighlightModeUI('next2');
  });

  // Initial defaults
  turnHideOff(textDisplay);
  turnHighlightOff();
}
