// js/smooth-caret.js
// Smooth caret that tracks .char.current precisely, even under zoom/transform.
// Fixes "lag to the right" by unscaling client rects to host content coords.

let HOST = null;
let CARET = null;
let ANIM = null;
let OBS_HOST = null;
let OBS_BODY = null;
let RAF = 0;
let ARMED = false; // false => next update snaps (no fly-in)
let LAST = { x: 0, y: 0, h: 0 };



const STYLE_ID = 'smooth-caret-style-v8';

let SETTINGS = {
  color: null,  // null => inherit HOST color
  width: 2,
  blink: true
};

function injectStyleOnce() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `
    [data-smooth-caret-host]{ position:relative !important; }
    .smooth-caret{
      position:absolute; left:0; top:0;
      width:var(--caret-w,2px);
      height:1em;
      background:var(--caret-color,currentColor);
      border-radius:1px;
      opacity:1;
      transform:translate3d(0,0,0);
      will-change:transform,height,opacity;
      pointer-events:none;
      z-index:20;
    }
    .smooth-caret.blink{ animation:scBlink 1.1s steps(1,end) infinite; }
    @keyframes scBlink{ 0%,48%{opacity:1} 50%,100%{opacity:0} }
  `;
  document.head.appendChild(s);
}

function ensureHost(el){ if (el) el.setAttribute('data-smooth-caret-host','1'); }

function createCaret(){
  injectStyleOnce();
  HOST.querySelectorAll('.smooth-caret').forEach(n => n.remove());
  CARET = document.createElement('div');
  CARET.className = 'smooth-caret';
  CARET.style.setProperty('--caret-w', `${SETTINGS.width}px`);
  // If a custom color is passed, use it; otherwise inherit from the theme.
  if (SETTINGS.color != null && SETTINGS.color !== '') {
    CARET.style.setProperty('--caret-color', SETTINGS.color);
  } else {
    CARET.style.removeProperty('--caret-color'); // let CSS variables control it
  }

  if (SETTINGS.blink) CARET.classList.add('blink');
  HOST.appendChild(CARET);
  return CARET;
}

function ensureCaretInDOM(){
  if (!CARET || !CARET.isConnected || CARET.parentNode !== HOST) {
    if (ANIM) { ANIM.cancel(); ANIM = null; }
    CARET = null;
    createCaret();
    ARMED = false; // snap next paint (prevents fly-in)
  }
}

function show(){ if (CARET) CARET.style.opacity = '1'; }
function hide(){ if (CARET) CARET.style.opacity = '0'; }

function resultScreenVisible(){
  const rs = document.getElementById('resultsScreen');
  return !!(rs && !rs.classList.contains('hidden'));
}

function isChar(el){ return !!(el && el.nodeType === 1 && el.classList?.contains('char')); }
function firstCurrent(){ return HOST?.querySelector('.char.current') || null; }

function lastCharDescendant(node){
  if (!node || node.nodeType !== 1) return null;
  const all = node.querySelectorAll?.('.char');
  return all && all.length ? all[all.length - 1] : null;
}
function prevChar(node){
  let n = node;
  while (n) {
    if (n.previousSibling) {
      n = n.previousSibling;
      if (isChar(n)) return n;
      const deep = lastCharDescendant(n);
      if (deep) return deep;
      continue;
    }
    n = n.parentElement;
    if (!n || n === HOST) break;
  }
  return null;
}

/* ---------- scale-aware geometry ---------- */
// Returns the visual scale applied to HOST via zoom/transform
function hostScale(){
  const r = HOST.getBoundingClientRect();
  const cw = HOST.clientWidth  || r.width || 1;
  const ch = HOST.clientHeight || r.height || 1;
  return {
    sx: r.width  / cw || 1,
    sy: r.height / ch || 1
  };
}

// line-height in host's *unscaled* content units
function lineHeightUnscaled(el, sy){
  const cs = getComputedStyle(el);
  const lh = parseFloat(cs.lineHeight);
  if (Number.isFinite(lh)) return lh;
  // fallback to unscaled rect height
  const rh = el.getBoundingClientRect().height;
  return (rh && sy) ? (rh / sy) : 16;
}

// Convert a child rect (viewport coords) to HOST content coords (unscaled)
function toHostContentXY(childRect, hostRect, sx, sy){
  const x = HOST.scrollLeft + (childRect.left - hostRect.left) / sx;
  const y = HOST.scrollTop  + (childRect.top  - hostRect.top ) / sy;
  return { x, y };
}

function isCollapsedSpace(node){
  if (!node || !node.classList || !node.classList.contains('space')) return false;
  // collapsed spaces have no rects or effectively zero width
  const rects = node.getClientRects();
  if (!rects || rects.length === 0) return true;
  const w = rects[0].width || node.getBoundingClientRect().width;
  return w < 0.5;
}

function anchorRect(){
  const cur = firstCurrent();
  if (!cur) return null;

  const hostR = HOST.getBoundingClientRect();
  const { sx, sy } = hostScale();

  const prev = prevChar(cur);
  let x, y, h;

  const cr  = cur.getBoundingClientRect();
  const cxy = toHostContentXY(cr, hostR, sx, sy);

  if (prev && !prev.classList.contains('newline')) {
    if (prev.classList.contains('space')) {
      // After a space: align to the CURRENT glyph’s line to avoid the tiny dip
      x = cxy.x;                                   // left edge of current
      y = cxy.y;
      h = Math.max(cr.height / sy, lineHeightUnscaled(cur, sy));
    } else {
      const pr  = prev.getBoundingClientRect();
      const pxy = toHostContentXY(pr, hostR, sx, sy);
      x = pxy.x + (pr.width / sx);                 // right edge of prev
      y = pxy.y;
      h = Math.max(pr.height / sy, lineHeightUnscaled(prev, sy));
    }
  } else {
    // Start of line, or current is a newline placeholder
    x = cxy.x;
    y = cxy.y;
    h = Math.max(cr.height / sy, lineHeightUnscaled(cur, sy));

    if (cur.classList.contains('newline') && prev) {
      const pr  = prev.getBoundingClientRect();
      const pxy = toHostContentXY(pr, hostR, sx, sy);
      y = pxy.y;
      h = Math.max(pr.height / sy, lineHeightUnscaled(prev, sy));
    }
  }

  // center the caret on the boundary
  x -= SETTINGS.width * 0.5;

  return { x, y, h };
}



/* ---------- animation ---------- */
function readCurrentPos(){
  const cs = getComputedStyle(CARET);
  const t = cs.transform;
  if (t && t !== 'none') {
    if (t.startsWith('matrix3d(')) {
      const m = t.slice(9, -1).split(',').map(parseFloat);
      return { x: m[12], y: m[13], h: CARET.offsetHeight || LAST.h || 16 };
    } else {
      const m = t.slice(7, -1).split(',').map(parseFloat);
      return { x: m[4], y: m[5], h: CARET.offsetHeight || LAST.h || 16 };
    }
  }
  // fallback: compute from boxes (already in host space since CARET is inside HOST)
  const cr = CARET.getBoundingClientRect();
  const hr = HOST.getBoundingClientRect();
  const { sx, sy } = hostScale();
  const rel = toHostContentXY(cr, hr, sx, sy);
  return { x: rel.x, y: rel.y, h: CARET.offsetHeight || LAST.h || 16 };
}

function placeImmediate(pos){
  if (ANIM) { ANIM.cancel(); ANIM = null; }
  CARET.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
  CARET.style.height = `${pos.h}px`;
  show();
  LAST = pos;
  ARMED = true;
}

// Very short, distance-based linear hop (keeps up at high WPM).
function hopDurationMs(from, to){
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  const dist = Math.hypot(dx, dy);
  return Math.max(24, Math.min(90, dist * 2.6)) | 0;
}

function animateTo(pos){
  const from = readCurrentPos();

  // Base duration from distance (your existing feel)
  const base = hopDurationMs(from, pos); // already clamped 24–90ms

  // Cross-line jump (down OR up) = big vertical delta vs line height
  const lineH = Math.max(from.h, pos.h, LAST.h || 0);
  const dy = pos.y - from.y;
  const isLineJump = Math.abs(dy) > lineH * 0.6;

  // Same-line uses your old multiplier, cross-line is much snappier
  const multiplier = isLineJump ? 2.1 : 7;
  let duration = Math.round(base * multiplier);

  // Keep wraps tight (works for both down and up)
  if (isLineJump) {
    duration = Math.max(22, Math.min(140, duration));
  }

  if (ANIM) { ANIM.cancel(); ANIM = null; }

  ANIM = CARET.animate(
    [
      { transform: `translate3d(${from.x}px, ${from.y}px, 0)`, height: `${from.h}px` },
      { transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,   height: `${pos.h}px` }
    ],
    { duration, easing: 'cubic-bezier(.2,.9,.1,1)', fill: 'forwards' }
  );
  ANIM.onfinish = () => {
    CARET.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
    CARET.style.height = `${pos.h}px`;
    LAST = pos;
    show();
  };
}


function update({ immediate = false } = {}){
  if (!HOST) return;

  ensureCaretInDOM();

  if (resultScreenVisible()) { hide(); ARMED = false; return; }

  const rect = anchorRect();
  if (!rect || !CARET) { hide(); ARMED = false; return; }

  if (!ARMED || immediate) { placeImmediate(rect); return; }
  animateTo(rect);
}

function schedule(opts){
  cancelAnimationFrame(RAF);
  // run after the game updated .char.current
  RAF = requestAnimationFrame(() => {
    RAF = requestAnimationFrame(() => update(opts));
  });
}

/* ---------- listeners ---------- */
function onKey(){ schedule(); }
function onResize(){ ARMED = false; schedule({ immediate:true }); }
function onHostScroll(){ schedule(); }
function onCapyTextReady(){ ARMED = false; schedule({ immediate:true }); }
function onCapyRunReset(){ ARMED = false; schedule({ immediate:true }); }
function onCapyTimeup(){ hide(); ARMED = false; }

function watchHost(){
  if (OBS_HOST) OBS_HOST.disconnect();
  OBS_HOST = new MutationObserver((list) => {
    ensureCaretInDOM();
    for (const m of list) {
      if (m.type === 'attributes' && m.attributeName === 'class' && isChar(m.target)) { schedule(); return; }
      if (m.type === 'childList') { schedule(); return; }
    }
  });
  OBS_HOST.observe(HOST, {
    attributes: true,
    attributeFilter: ['class'],
    childList: true,
    subtree: true
  });
}

function watchBody(){
  if (OBS_BODY) OBS_BODY.disconnect();
  OBS_BODY = new MutationObserver(() => {
    // focus-mode / class flips may change scale
    ARMED = false;
    schedule({ immediate:true });
  });
  OBS_BODY.observe(document.body, { attributes:true, attributeFilter:['class'] });
}

function wire(){
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('keyup', onKey, true);
  window.addEventListener('resize', onResize);
  HOST.addEventListener('scroll', onHostScroll, { passive:true });
  window.addEventListener('capy:textReady', onCapyTextReady);
  window.addEventListener('capy:runReset', onCapyRunReset);
  window.addEventListener('capy:timeup', onCapyTimeup);
  watchHost();
  watchBody();
}

function unwire(){
  document.removeEventListener('keydown', onKey, true);
  document.removeEventListener('keyup', onKey, true);
  window.removeEventListener('resize', onResize);
  HOST.removeEventListener('scroll', onHostScroll);
  window.removeEventListener('capy:textReady', onCapyTextReady);
  window.removeEventListener('capy:runReset', onCapyRunReset);
  window.removeEventListener('capy:timeup', onCapyTimeup);
  if (OBS_HOST) { OBS_HOST.disconnect(); OBS_HOST = null; }
  if (OBS_BODY) { OBS_BODY.disconnect(); OBS_BODY = null; }
}

/* ---------- Public API ---------- */
export function initSmoothCaret({
  textDisplay = document.getElementById('textDisplay'),
  color = null,
  width = 2,
  blink = true
} = {}) {
  HOST = textDisplay;
  if (!HOST) return null;
  SETTINGS = { color, width, blink };
  ensureHost(HOST);
  createCaret();
  ARMED = false; // first placement snaps
  wire();
  schedule({ immediate:true });
  return CARET;
}

export function refreshSmoothCaret(immediate=false){
  schedule({ immediate });
}

export function destroySmoothCaret(){
  unwire();
  cancelAnimationFrame(RAF);
  if (ANIM) { ANIM.cancel(); ANIM = null; }
  if (CARET && CARET.parentNode) CARET.parentNode.removeChild(CARET);
  CARET = null;
  HOST = null;
  ARMED = false;
  LAST = { x: 0, y: 0, h: 0 };
}
