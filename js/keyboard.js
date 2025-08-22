// js/keyboard.js - checkbox-based keyboard guide + key state

let shiftPressed = false;
let capsLockOn = false;

const keyboardDiagram = document.getElementById('keyboardDiagram');
const keyboardImage   = document.getElementById('keyboardImage');

/* ---------- NEW: read current visual scale (zoom or transform) ---------- */
function getLayoutScale(panel, elementForTransform = keyboardDiagram) {
  // 1) zoom path (Chrome/Edge/etc.)
  const z = parseFloat(getComputedStyle(panel).zoom);
  if (!Number.isNaN(z) && z > 0) return z;

  // 2) transform fallback path (.typing-panel > * { transform: scale(...) })
  const t = getComputedStyle(elementForTransform).transform;
  if (t && t !== 'none') {
    const m2 = t.match(/^matrix\(([^)]+)\)$/);
    if (m2) {
      const [a, b] = m2[1].split(',').map(parseFloat);
      const s = Math.hypot(a, b);
      return s || 1;
    }
    const m3 = t.match(/^matrix3d\(([^)]+)\)$/);
    if (m3) {
      const v = m3[1].split(',').map(parseFloat);
      const s = Math.hypot(v[0], v[1]);
      return s || 1;
    }
  }
  return 1;
}

/* ---------------- Keyboard diagram visibility ---------------- */
export function setupKeyboardDiagram() {
  const toggle = document.getElementById('keyboardDiagramToggle');
  if (!toggle || !keyboardDiagram) return;

  keyboardDiagram.classList.toggle('hidden', !toggle.checked);
  if (toggle.checked) positionKeyboardDiagram(); // ensure correct spot on load

  // keep it in sync when user clicks
  toggle.addEventListener('change', () => {
    keyboardDiagram.classList.toggle('hidden', !toggle.checked);
    if (toggle.checked) positionKeyboardDiagram();
  });
}

/* ---------------- Keyboard image (shift/caps) ---------------- */
function updateKeyboardImage() {
  if (!keyboardImage) return;
  let imagePath = 'keyboard_and_hand/';

  if (shiftPressed && capsLockOn) imagePath += 'shift_caps_lock.png';
  else if (shiftPressed)          imagePath += 'shift.png';
  else if (capsLockOn)            imagePath += 'caps_lock.png';
  else                            imagePath += 'default.png';

  keyboardImage.src = imagePath;
}

/* ---------------- Track shift/caps state ---------------- */
export function handleKeyboardState(e) {
  // Shift
  if (e.key === 'Shift') {
    if (e.type === 'keydown' && !shiftPressed) {
      shiftPressed = true;
      updateKeyboardImage();
    } else if (e.type === 'keyup') {
      shiftPressed = false;
      updateKeyboardImage();
    }
  }

  // Caps Lock
  if (e.key === 'CapsLock') {
    if (e.type === 'keydown') {
      capsLockOn = !capsLockOn;
      updateKeyboardImage();
    } else if (e.type === 'keyup' && e.getModifierState) {
      capsLockOn = e.getModifierState('CapsLock');
      updateKeyboardImage();
    }
  }

  // Also re-check caps lock on any keydown
  if (e.type === 'keydown' && e.getModifierState) {
    const newCaps = e.getModifierState('CapsLock');
    if (newCaps !== capsLockOn) {
      capsLockOn = newCaps;
      updateKeyboardImage();
    }
  }
}

// Reset shift if window loses focus
window.addEventListener('blur', () => {
  if (shiftPressed) {
    shiftPressed = false;
    updateKeyboardImage();
  }
});

/* ---------- CHANGED: keep constant visual gap under the words ---------- */
export function positionKeyboardDiagram() {
  const panel = document.querySelector('.typing-panel');
  const text  = document.getElementById('textDisplay');
  const kd    = document.getElementById('keyboardDiagram');
  if (!panel || !text || !kd || kd.classList.contains('hidden')) return;

  // target visual gap = 0.65em of the typing text
  const fontPx = parseFloat(getComputedStyle(text).fontSize) || 16;
  const GAP_EM = 0.65;

  // screen-space rects (already scaled)
  const panelRect = panel.getBoundingClientRect();
  const textRect  = text.getBoundingClientRect();

  // how much the panel’s children are visually scaled
  const scale = getLayoutScale(panel, kd) || 1;

  // convert screen px back to layout px before assigning to style.top
  const layoutTop = ((textRect.bottom - panelRect.top) / scale) + (fontPx * GAP_EM);
  kd.style.top = `${Math.round(layoutTop)}px`;
}
