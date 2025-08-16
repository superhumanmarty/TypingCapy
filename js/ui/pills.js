// js/ui/pills.js
import { getCurrentWord } from '../utils.js';
import { updateHide } from '../hide.js';
import { updateHighlight } from '../highlight.js';
import { chars, currentIndex } from '../engine.js';

// ------- shared helpers -------
export function setupToggleWithNumber(toggleId, wrapperId, defaultValue) {
  const toggle  = document.getElementById(toggleId);
  const wrapper = document.getElementById(wrapperId);
  const pill    = toggle ? toggle.closest('.pill') : null;
  if (!toggle || !wrapper || !pill) return;

  const apply = () => {
    const on = toggle.checked;
    wrapper.classList.toggle('hidden', !on);
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
    if (wrapper && wrapper.contains(e.target)) return;
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
    toggle.checked = !toggle.checked;
    toggle.dispatchEvent(new Event('change'));
  };

  pill.addEventListener('click', () => { activate(); });
  toggle.addEventListener('change', sync);
  sync();
}

export function wirePillToggle(pillId, checkboxId) {
  const pill = document.getElementById(pillId);
  const cb   = document.getElementById(checkboxId);
  if (!pill || !cb) return;

  const sync = () => pill.classList.toggle('active', cb.checked);
  pill.addEventListener('click', () => {
    cb.checked = !cb.checked;
    cb.dispatchEvent(new Event('change'));
  });
  cb.addEventListener('change', sync);
  sync();
}

export function wireGhostPill() {
  const pill  = document.getElementById('ghostCursorSettings');
  const cb    = document.getElementById('ghostModeToggle');
  const wrap  = document.getElementById('ghostWpmWrapper');
  const input = document.getElementById('customGhostWPM');
  if (!pill || !cb || !wrap) return;

  const sync = () => {
    pill.classList.toggle('active', cb.checked);
    wrap.classList.toggle('hidden', !cb.checked);
    if (cb.checked && input && (input.value === '' || input.value == null)) input.value = 60;
  };

  pill.addEventListener('click', (e) => {
    if (wrap.contains(e.target)) return;
    cb.checked = !cb.checked;
    cb.dispatchEvent(new Event('change'));
  });

  ['click','mousedown','mouseup'].forEach(evt =>
    wrap.addEventListener(evt, (e) => e.stopPropagation())
  );
  ['keydown','keyup','keypress'].forEach(evt =>
    input.addEventListener(evt, (e) => e.stopPropagation())
  );

  cb.addEventListener('change', sync);
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
    const mode = radios.find(r => r.checked)?.value || 'off';
    wrapper.style.display = (mode === 'on') ? 'inline' : 'none';
    if (mode === 'on') {
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
