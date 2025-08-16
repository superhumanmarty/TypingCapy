// js/app/start.js
import { initController, handleKeyDown, handleKeyUp } from '../controller/game-controller.js';

/**
 * Wire the controller and global key listeners in one place.
 * Call this once, after the DOM exists.
 */
export function startApp({ textDisplay, hideControl, highlightControl }) {
  // 1) give the controller the DOM refs it needs
  initController({ textDisplay, hideControl, highlightControl });

  // 2) attach global key listeners owned by the controller
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('keyup', handleKeyUp);
}
