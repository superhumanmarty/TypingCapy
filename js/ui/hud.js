// js/ui/hud.js
// Batches WPM/Accuracy HUD paints to one per animation frame.
import { Tally } from '../app/state.js';
import { calculateAccuracy } from '../utils.js';

let _wpmEl = null;
let _accEl = null;
let _getLiveWPM = null;
let _warmupMs = 2000;
let _rafScheduled = false;

export function setupHUD({ wpmSpan, accSpan, getLiveWPM, warmupMs = 2000 }) {
  _wpmEl = wpmSpan || document.getElementById('wpm');
  _accEl = accSpan || document.getElementById('accuracy');
  _getLiveWPM = getLiveWPM;
  _warmupMs = warmupMs;
}

export function scheduleHUD(startTime) {
  if (_rafScheduled) return;
  _rafScheduled = true;
  requestAnimationFrame(() => {
    _rafScheduled = false;

    const attempted = Tally.correct + Tally.incorrect + Tally.skipped + Tally.extra;
    const acc = calculateAccuracy(attempted, Tally.correct);
    if (_accEl) _accEl.textContent = `Accuracy: ${acc}%`;

    if (_wpmEl) {
      const elapsed = startTime ? (Date.now() - startTime) : 0;
      if (elapsed < _warmupMs) {
        _wpmEl.textContent = 'WPM: ...';
      } else {
        const live = _getLiveWPM ? _getLiveWPM(2000) : 0;
        _wpmEl.textContent = `WPM: ${live}`;
      }
    }
  });
}
