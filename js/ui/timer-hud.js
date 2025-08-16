// js/ui/timer-hud.js
import { startTime } from '../engine.js';

export function enforceTimerVisibility() {
  const td  = document.getElementById('timerDisplay');
  const tSel = document.getElementById('timerSelector');
  if (!td || !tSel) return;
  if (tSel.value !== 'off') {
    td.classList.remove('hidden');
    if (!startTime) setTimerLabelToFull();
  } else {
    td.classList.add('hidden');
  }
}

export function setTimerLabelToFull() {
  const tSel = document.getElementById('timerSelector');
  const td   = document.getElementById('timerDisplay');
  const tr   = document.getElementById('timeRemaining');
  if (!tSel || !td || !tr) return;

  const sec = parseInt(tSel.value, 10);
  if (!sec || Number.isNaN(sec) || tSel.value === 'off') {
    tr.textContent = '';
    return;
  }
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  tr.textContent = `Time: ${m}:${String(s).padStart(2, '0')}`;
}
