// js/ui/pills-init.js
import {
  setupToggleWithNumber,
  wireSplitPill,
  wireSinglePill,
  wirePillToggle,
  wireGhostPill,
  setupSubtoggleVisibility,
  wireSplitDependency,
  wireHideHighlightPills,
} from './pills.js';

export function initPills({ textDisplay } = {}) {
  // Show/hide dependent subtoggles
  setupSubtoggleVisibility();

  // “Min WPM” / “Min Accuracy” split pills with number inputs
  setupToggleWithNumber('endWpmToggle', 'endWpmWrapper', 50);
  setupToggleWithNumber('endAccToggle', 'endAccWrapper', 95);
  wireSplitPill('minWPMSettings', 'endWpmToggle', 'endWpmWrapper');
  wireSplitPill('minAccuracySettings', 'endAccToggle', 'endAccWrapper');

  // Single-toggle pills
  wireSinglePill('strictModeSettings', 'endOnMistakeCheckbox');
  wireSinglePill('keyboardDiagramSettings', 'keyboardDiagramToggle');

  // Typed errors pill mirrors the checkbox
  wirePillToggle('typedErrorsPill', 'showTypedErrorsToggle');

  // Ghost cursor pill + number
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
}
