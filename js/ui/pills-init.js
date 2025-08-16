// js/ui/pills-init.js
import {
  setupToggleWithNumber,
  wireSplitPill,
  wireSinglePill,
  wirePillToggle,
  setupSubtoggleVisibility,
  wireSplitDependency,
  wireHideHighlightPills,
  wireGhostPill,
} from './pills.js';

export function initPills({ textDisplay } = {}) {
  // Show/hide dependent subtoggles
  setupSubtoggleVisibility();

  // “Min WPM” / “Min Accuracy” split pills with number inputs
  setupToggleWithNumber('endWpmToggle', 'endWpmWrapper', 50);
  setupToggleWithNumber('endErrToggle', 'endErrWrapper', 3); // default 3 errors
  wireSplitPill('minWPMSettings', 'endWpmToggle', 'endWpmWrapper');
  wireSplitPill('maxErrorsSettings', 'endErrToggle', 'endErrWrapper');

  // Modal-ish editing for numeric inputs (prevents accidental game start)
  wireThresholdInputFocusMask();

  // Single-toggle pills
  wireSinglePill('keyboardDiagramSettings', 'keyboardDiagramToggle');

  // Typed errors pill mirrors the checkbox
  wirePillToggle('typedErrorsPill', 'showTypedErrorsToggle');

  // Show a “#” until user types a number
  document
    .querySelector('#endErrWrapper input[type="number"]')
    ?.setAttribute('placeholder', '#');

  // --- Ghost cursor pill (animated open/close) ---
  wireGhostPill();


  // Dependencies: 123 -> enables +=, and !? -> enables @#&
  wireSplitDependency({
    mainBtnId:    'numMain',
    extraBtnId:   'numExtra',
    mainToggleId: 'numbersToggle',
    extraToggleId:'numbersExprToggle',
  });
  wireSplitDependency({
    mainBtnId:    'punctMain',
    extraBtnId:   'punctExtra',
    mainToggleId: 'punctuationToggle',
    extraToggleId:'symbolsToggle',
  });

  // Hide / Highlight big pill row (expand/collapse + choice text)
  wireHideHighlightPills({ textDisplay });

  // Kill the old accuracy pill if it still exists in the DOM
  document.getElementById('minAccuracySettings')?.remove();
  document.getElementById('endAccWrapper')?.remove();
  document.getElementById('endAccToggle')?.closest('.pill')?.remove();

}


// === Keep typing inside the number boxes "modal" and obvious ===
function wireThresholdInputFocusMask() {
  const WPM_INPUT   = '#endWpmWrapper input[type="number"]';
  const ERR_INPUT   = '#endErrWrapper input[type="number"]';
  const GHOST_INPUT = '#ghostWpmWrapper input[type="number"]';

  const WRAPPERS = ['#endWpmWrapper', '#endErrWrapper', '#ghostWpmWrapper'];
  const PILL_CONTAINERS = ['#minWPMSettings', '#maxErrorsSettings', '#ghostCursorSettings']; // <-- NEW

  const setEditMode = (mode /* 'wpm' | 'err' | 'ghost' */) => {
    document.body.classList.add('editing-threshold');
    document.body.classList.toggle('editing-wpm',   mode === 'wpm');
    document.body.classList.toggle('editing-err',   mode === 'err');
    document.body.classList.toggle('editing-ghost', mode === 'ghost');
    lockActiveToggle(mode);
    setTogglesDisabled(true);
  };
  const clearEditMode = () => {
    unlockAllToggles();
    document.body.classList.remove('editing-threshold','editing-wpm','editing-err','editing-ghost');
    setTogglesDisabled(false);
  };
  const refocusGameSoon = () => {
    requestAnimationFrame(() => {
      const ae = document.activeElement;
      if (ae && ae !== document.body && typeof ae.blur === 'function') ae.blur();
      document.body.focus?.({ preventScroll: true });
    });
  };

  const TOGGLE_BY_MODE = {
    wpm:   'endWpmToggle',
    err:   'endErrToggle',
    ghost: 'ghostModeToggle',
  };

  const EDIT_TOGGLES = ['endWpmToggle','endErrToggle','ghostModeToggle'];
  const setTogglesDisabled = (on) => {
    EDIT_TOGGLES.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = !!on;
    });
  };

  function lockActiveToggle(mode) {
    const id = TOGGLE_BY_MODE[mode];
    const el = document.getElementById(id);
    if (!el) return;
    // remember prior state so we can restore precisely
    if (el.dataset.wasDisabled == null) el.dataset.wasDisabled = el.disabled ? '1' : '0';
    el.disabled = true; // native toggle can’t flip now
  }

  function unlockAllToggles() {
    ['endWpmToggle','endErrToggle','ghostModeToggle'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      // only re-enable if we disabled it
      if (el.dataset.wasDisabled === '0') el.disabled = false;
      delete el.dataset.wasDisabled;
    });
  }

  function wireOne(selector, mode) {
    document.querySelectorAll(selector).forEach(inp => {
      inp.addEventListener('focus', () => setEditMode(mode));
      inp.addEventListener('blur',  clearEditMode);
      ['keydown','keypress','keyup'].forEach(evt => {
        inp.addEventListener(evt, (e) => {
          e.stopPropagation(); // keep keys from reaching the game
          if (e.type === 'keydown' && (e.key === 'Enter' || e.key === 'Escape')) {
            e.preventDefault(); // commit value
            inp.blur();         // exit overlay
            refocusGameSoon();  // next key can start the game
          }
        });
      });
    });
  }

  wireOne(WPM_INPUT,   'wpm');
  wireOne(ERR_INPUT,   'err');
  wireOne(GHOST_INPUT, 'ghost');

  document.addEventListener('mousedown', (e) => {
    if (!document.body.classList.contains('editing-threshold')) return;
    if (e.target.closest(WRAPPERS.join(','))) return; // inside any number box
    // Let pill-level "exit only" guards run first; don't clear here.
    if (e.target.closest('#ghostCursorSettings, #minWPMSettings, #maxErrorsSettings')) return;
    clearEditMode();
  });

  // Prevent wrapper clicks from being treated as "settings click → refocus game"
  WRAPPERS.forEach(sel => {
    const el = document.querySelector(sel);
    el?.addEventListener('mousedown', (e) => e.stopPropagation());
    el?.addEventListener('click',      (e) => e.stopPropagation());
  });

  // --- HARD STOP: while editing, clicks on a pill (but not the number box)
  // should ONLY exit edit mode, never toggle. Works for pointer/click/touch.
  const PILL_CONTAINERS_SEL = '#minWPMSettings, #maxErrorsSettings, #ghostCursorSettings';
  const INPUT_WRAPPERS_SEL  = '#endWpmWrapper, #endErrWrapper, #ghostWpmWrapper';

  function hardExitOnly(e) {
    if (!document.body.classList.contains('editing-threshold')) return;

    const insideEditor = e.target.closest(INPUT_WRAPPERS_SEL);
    const insidePill   = e.target.closest(PILL_CONTAINERS_SEL);

    // If you clicked a pill *outside* the number box: consume the event
    if (insidePill && !insideEditor) {
      e.preventDefault();
      e.stopImmediatePropagation(); // kill delegated handlers (toggle)
    // If we were editing the GHOST pill, suppress the *current* click's toggle
    if (document.body.classList.contains('editing-ghost')) {
      window.__suppressGhostToggleOnce = true;
    }
      // exit edit mode
      const ae = document.activeElement;
      if (ae && ae.matches?.(`${INPUT_WRAPPERS_SEL} input[type="number"]`)) {
        ae.blur();        // triggers clearEditMode via your 'blur' listener
      } else {
        // safety: if no focused input, clear the class directly
        document.body.classList.remove('editing-threshold','editing-wpm','editing-err','editing-ghost');
      }
      // optional: don't immediately refocus game; let the next click be intentional
    }
  }

  ['pointerdown','click','touchstart'].forEach(evt => {
    document.addEventListener(evt, hardExitOnly, { capture: true, passive: false });
  });

  // --- NEW: While editing, clicks on the pill container (outside the number box)
  // SHOULD NOT TOGGLE the pill. They ONLY exit edit mode.
  const exitOnlyFromEditing = (e) => {
    if (!document.body.classList.contains('editing-threshold')) return;
    // If the click is inside any number wrapper, let normal input behavior happen
    if (e.target.closest(WRAPPERS.join(','))) return;

    // Otherwise, consume the click so no toggle happens…
    e.preventDefault();
    e.stopImmediatePropagation();

    // NEW: if we're closing the *ghost* editor via pill click, suppress the toggle on this click
    if (document.body.classList.contains('editing-ghost')) {
      window.__suppressGhostToggleOnce = true;
    }

    // …and just exit edit mode.
    const ae = document.activeElement;
    if (
      ae &&
      (ae.matches?.(WPM_INPUT) || ae.matches?.(ERR_INPUT) || ae.matches?.(GHOST_INPUT))
    ) {
      ae.blur();
    } else {
      clearEditMode();
    }

    // Don’t immediately toggle on this click; user can click again if they really want to.
    refocusGameSoon();
  };

  PILL_CONTAINERS.forEach(sel => {
    const pill = document.querySelector(sel);
    // Capture phase ensures we catch the event before any pill toggle handlers
    pill?.addEventListener('mousedown', exitOnlyFromEditing, true);
    pill?.addEventListener('click',      exitOnlyFromEditing, true);
  });

  // Final guard: kill ghost checkbox/label toggles while editing the number
  const ghostRoot = document.getElementById('ghostCursorSettings');
  const stopGhostToggle = (e) => {
    if (
      !document.body.classList.contains('editing-threshold') ||
      !document.body.classList.contains('editing-ghost')
    ) return;

    // allow clicks inside the number editor to work normally
    if (e.target.closest('#ghostWpmWrapper')) return;

    // block clicks on the checkbox itself and its label
    const isGhostCheckbox = e.target.id === 'ghostModeToggle';
    const isGhostLabel =
      !!e.target.closest('label[for="ghostModeToggle"], #ghostCursorSettings > label');

    if (isGhostCheckbox || isGhostLabel) {
      e.preventDefault();
      e.stopImmediatePropagation();
      // if focus is still in the input, blur to exit edit mode
      const ae = document.activeElement;
      if (ae && ae.matches?.('#ghostWpmWrapper input[type="number"]')) ae.blur();
    }
  };

  // Capture phase so we beat the native label→checkbox default toggle
  ['pointerdown','click','touchstart'].forEach(evt => {
    ghostRoot?.addEventListener(evt, stopGhostToggle, { capture: true, passive: false });
  });

  // Belt & suspenders: if a change sneaks through, immediately revert it
  document.getElementById('ghostModeToggle')?.addEventListener('change', (e) => {
    if (document.body.classList.contains('editing-threshold')) {
      e.stopImmediatePropagation();
      e.target.checked = !e.target.checked; // revert
    }
  }, true);


  // --- GHOST safeguard: block label/checkbox toggles while editing ghost WPM
  const blockGhostToggleWhileEditing = (e) => {
    // Only care while the overlay is up and we're editing the ghost pill
    if (
      !document.body.classList.contains('editing-threshold') ||
      !document.body.classList.contains('editing-ghost')
    ) return;

    const t = e.target;

    // Is the click on the ghost checkbox itself?
    const isGhostCheckbox =
      t.id === 'ghostModeToggle' || !!t.closest?.('#ghostModeToggle');

    // …or on a <label> that toggles it (either via for= or wrapping)?
    const lbl = t.closest?.('label');
    const labelTargetsGhost =
      !!lbl && (lbl.htmlFor === 'ghostModeToggle' || !!lbl.querySelector?.('#ghostModeToggle'));

    if (isGhostCheckbox || labelTargetsGhost) {
      // Allow clicks that are actually inside the number editor
      if (t.closest('#ghostWpmWrapper')) return;

      // Otherwise: swallow the click so nothing toggles; just exit edit mode
      e.preventDefault();
      e.stopImmediatePropagation();

      const ae = document.activeElement;
      if (ae && ae.matches?.('#ghostWpmWrapper input[type="number"]')) {
        ae.blur(); // your blur handler clears the editing classes
      } else {
        document.body.classList.remove('editing-threshold','editing-ghost');
      }
    }
  };

  // Capture phase so we beat the native label→checkbox toggle
  ['pointerdown','click','touchstart'].forEach(evt => {
    document.addEventListener(evt, blockGhostToggleWhileEditing, { capture: true, passive: false });
  });

}






