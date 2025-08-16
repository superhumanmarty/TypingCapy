// js/keyboard.js - checkbox-based keyboard guide + key state

let shiftPressed = false;
let capsLockOn = false;

const keyboardDiagram = document.getElementById('keyboardDiagram');
const keyboardImage   = document.getElementById('keyboardImage');

// Initialize keyboard diagram visibility based on the checkbox
export function setupKeyboardDiagram() {
  const toggle = document.getElementById('keyboardDiagramToggle');
  if (!toggle || !keyboardDiagram) return;

  keyboardDiagram.classList.toggle('hidden', !toggle.checked);

  // keep it in sync when user clicks
  toggle.addEventListener('change', () => {
    keyboardDiagram.classList.toggle('hidden', !toggle.checked);
  });
}

// Update keyboard image based on shift/caps state
function updateKeyboardImage() {
  if (!keyboardImage) return;
  let imagePath = 'keyboard_and_hand/';

  if (shiftPressed && capsLockOn) imagePath += 'shift_caps_lock.png';
  else if (shiftPressed)          imagePath += 'shift.png';
  else if (capsLockOn)            imagePath += 'caps_lock.png';
  else                            imagePath += 'default.png';

  keyboardImage.src = imagePath;
}

// Track shift/caps states
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

export function positionKeyboardDiagram() {
  const panel = document.querySelector('.typing-panel');
  const text  = document.getElementById('textDisplay');
  const kd    = document.getElementById('keyboardDiagram');
  if (!panel || !text || !kd || kd.classList.contains('hidden')) return;

  const panelRect = panel.getBoundingClientRect();
  const textRect  = text.getBoundingClientRect();
  const top = (textRect.bottom - panelRect.top) + 12; // 12px gap
  kd.style.top = `${top}px`;
}
