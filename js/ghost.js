// js/ghost.js — smooth, clipped ghost caret with fast line hops
import { chars } from './engine.js';

let raf = null;
let startMs = 0;
let wpm = 60;

function injectCSS() {
  if (document.getElementById('ghostCaretCSS_v3')) return;
  const s = document.createElement('style');
  s.id = 'ghostCaretCSS_v3';
  s.textContent = `
    /* make #textDisplay a clipping context for the caret */
    #textDisplay { position: relative; }

    /* the ghost caret lives as a pseudo-element on the panel */
    #textDisplay::after{
      content:'';
      position:absolute;
      left:0; top:0;
      width:2px;
      height:var(--gh,18px);
      transform: translate(var(--gx,-9999px), var(--gy,-9999px));
      background:#8fd8ff;           /* brighter */
      border-radius:1px;
      opacity:var(--gop,0);          /* 0/1 */
      transition:
        transform var(--gdur,120ms) cubic-bezier(.22,.61,.36,1),
        height    80ms linear,
        opacity   80ms linear;
      pointer-events:none;
    }
    body.game-ended #textDisplay::after { opacity:0 !important; }
  `;
  document.head.appendChild(s);
}

function panel() {
  return document.getElementById('textDisplay');
}

/** Filter to the baseline path: no .extra, no .skipped */
function trackChars() {
  return chars.filter(c => !c.classList.contains('extra') && !c.classList.contains('skipped'));
}

/** rect relative to panel */
function relRect(el, panelRect, p) {
  // Use first client rect for multi-line glyphs; fallback to bounding box
  const r = el.getClientRects()[0] || el.getBoundingClientRect();
  return {
    x: (r.left - panelRect.left) + p.scrollLeft,
    y: (r.top  - panelRect.top)  + p.scrollTop,
    h: Math.max(1, Math.round(r.height || 18)),
  };
}

/** move the pseudo caret by CSS vars */
function setCaret(x, y, h, durMs, visible) {
  const p = panel();
  if (!p) return;
  p.style.setProperty('--gx',  Math.round(x) + 'px');
  p.style.setProperty('--gy',  Math.round(y) + 'px');
  p.style.setProperty('--gh',  Math.round(h) + 'px');
  p.style.setProperty('--gdur', Math.max(10, Math.round(durMs)) + 'ms');
  p.style.setProperty('--gop',  visible ? '1' : '0');
}

/** main loop: constant speed on a line, quick hop between lines */
function tick() {
  raf = requestAnimationFrame(tick);

  const p = panel();
  if (!p) { stopGhost(); return; }
  if (!document.getElementById('ghostModeToggle')?.checked || document.body.classList.contains('game-ended')) {
    stopGhost(); return;
  }

  // build current track & timing
  const T = trackChars();
  if (T.length === 0) { setCaret(-9999, -9999, 18, 60, false); return; }

  const minutes = (performance.now() - startMs) / 60000;
  const charFloat = Math.max(0, wpm * 5 * minutes);
  const i = Math.min(T.length - 1, Math.floor(charFloat));
  const frac = Math.min(1, charFloat - i);

  const panelRect = p.getBoundingClientRect();
  const a = T[i];
  const b = T[Math.min(T.length - 1, i + 1)] || a;

  const ar = relRect(a, panelRect, p);
  const br = relRect(b, panelRect, p);

  // Detect line change (vertical jump larger than ~half a line height)
  const lineJump = Math.abs(br.y - ar.y) > ((ar.h + br.h) * 0.5) * 0.5;

  let x, y, h, dur;
  if (!lineJump) {
    // Same line: slide horizontally at steady pace
    x = ar.x + (br.x - ar.x) * frac;
    y = ar.y;
    h = ar.h * (1 - frac) + br.h * frac;
    dur = 110;                           // gentle slide
  } else {
    // New line: snap X to next line start, quick Y hop
    const fast = Math.min(1, frac * 4);  // 4x faster than on-line motion
    x = br.x;                            // snap horizontally
    y = ar.y + (br.y - ar.y) * fast;     // quick vertical ease
    h = ar.h * (1 - fast) + br.h * fast;
    dur = 150;                            // short transition feels “instant”
  }

  // Hide when outside the visible panel (clipped area)
  const visY = y - p.scrollTop; // y is in content coords
  const visible = !(visY + h < 0 || visY > p.clientHeight);
  setCaret(x, y, h, dur, visible);
}

// ---------- public API ----------
export function setupGhost() {
  // show/hide the WPM input as before
  const toggle  = document.getElementById('ghostModeToggle');
  const wrapper = document.getElementById('ghostWpmWrapper');
  const apply = () => wrapper?.classList.toggle('hidden', !toggle?.checked);
  apply();
  toggle?.addEventListener('change', apply);
}

export function startGhost() {
  if (!document.getElementById('ghostModeToggle')?.checked) return;

  // Kill the old jumpy ghost completely (remove any leftover classes)
  chars.forEach(c => c.classList.remove('ghost'));

  injectCSS();
  const raw = parseInt(document.getElementById('customGhostWPM')?.value || '60', 10);
  wpm = Number.isFinite(raw) ? Math.max(10, Math.min(300, raw)) : 60;
  startMs = performance.now();

  if (raf) cancelAnimationFrame(raf);
  tick();
}

export function stopGhost() {
  if (raf) cancelAnimationFrame(raf);
  raf = null;
  // hide the pseudo caret
  const p = panel();
  if (p) p.style.setProperty('--gop', '0');
}

// Keep saveSpeed (used by timer/results)
export function saveSpeed(val) {
  localStorage.setItem('lastWPM', val);
  const highest = parseInt(localStorage.getItem('highestWPM') || '0', 10);
  if (val > highest) localStorage.setItem('highestWPM', val);
}

/* Keep caret aligned if layout changes */
window.addEventListener('capy:textReady', () => { /* no-op; caret follows via new rects on next frame */ });
window.addEventListener('capy:runReset', () => { const p = panel(); if (p) p.style.setProperty('--gop','0'); });
window.addEventListener('resize',  () => { /* rects re-read every frame */ }, true);
window.addEventListener('scroll',  () => { /* rects re-read every frame */ }, true);
