// js/app/state.js
// Minimal shared state object. Add to this as you migrate logic out of main/controller.
export const AppState = {
  gameLocked: false,
  firstKeySeen: false,
  firstKeyMistake: false,
};

// Tiny helpers (non-breaking if unused)
export function setGameLocked(v) { AppState.gameLocked = !!v; }
export function resetFirstKeyFlags() {
  AppState.firstKeySeen = false;
  AppState.firstKeyMistake = false;
}
