// js/lineSpaces.js
// This file is now simplified - we handle spacing with CSS instead
export function updateLineStartSpaces() {
  // Do nothing - spacing is handled by CSS margins on word-wrapper
  return;
}

// Keep these for compatibility if other files expect them
let resizeTimeout;
window.addEventListener('resize', () => {
  // Do nothing on resize
});

if ('fonts' in document) {
  document.fonts.ready.then(() => {
    // Do nothing on font load
  });
}