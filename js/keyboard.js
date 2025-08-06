// js/keyboard.js - Handles keyboard diagram display and state tracking

let shiftPressed = false;
let capsLockOn = false;

const keyboardDiagram = document.getElementById('keyboardDiagram');
const keyboardImage = document.getElementById('keyboardImage');

// Initialize keyboard diagram visibility based on radio setting
export function setupKeyboardDiagram() {
  const keyboardRadios = document.querySelectorAll('input[name="keyboardDiagram"]');
  const mode = [...keyboardRadios].find(r => r.checked).value;

  if (mode === 'on') {
    keyboardDiagram.classList.remove('hidden');
  } else {
    keyboardDiagram.classList.add('hidden');
  }
}

// Watch for keyboard diagram radio changes
export function watchKeyboardRadios() {
  const keyboardRadios = document.querySelectorAll('input[name="keyboardDiagram"]');
  keyboardRadios.forEach(r => {
    r.addEventListener('change', () => {
      setupKeyboardDiagram();
    });
  });
}

// Update keyboard image based on shift/caps lock state
function updateKeyboardImage() {
  let imagePath = 'keyboard_and_hand/';

  if (shiftPressed && capsLockOn) {
    imagePath += 'shift_caps_lock.png';
  } else if (shiftPressed) {
    imagePath += 'shift.png';
  } else if (capsLockOn) {
    imagePath += 'caps_lock.png';
  } else {
    imagePath += 'default.png';
  }

  keyboardImage.src = imagePath;
}

// Track shift key state
export function handleKeyboardState(e) {
  // Track shift press/release
  if (e.key === 'Shift') {
    if (e.type === 'keydown' && !shiftPressed) {
      shiftPressed = true;
      updateKeyboardImage();
    } else if (e.type === 'keyup') {
      shiftPressed = false;
      updateKeyboardImage();
    }
  }

  // Track caps lock toggle
  if (e.key === 'CapsLock') {
    if (e.type === 'keydown') {
      // Toggle our internal state immediately
      capsLockOn = !capsLockOn;
      updateKeyboardImage();
    } else if (e.type === 'keyup' && e.getModifierState) {
      // Double-check the actual state on key up
      capsLockOn = e.getModifierState('CapsLock');
      updateKeyboardImage();
    }
  }

  // Also check caps lock state on any keydown (in case it changed outside our app)
  if (e.type === 'keydown' && e.getModifierState) {
    const newCapsLockState = e.getModifierState('CapsLock');
    if (newCapsLockState !== capsLockOn) {
      capsLockOn = newCapsLockState;
      updateKeyboardImage();
    }
  }
}

// Reset shift state if window loses focus (user might release shift outside)
window.addEventListener('blur', () => {
  if (shiftPressed) {
    shiftPressed = false;
    updateKeyboardImage();
  }
});

// Export for use in main.js
export { shiftPressed, capsLockOn };