// js/app/state.js
// Shared app state + lightweight perf counters.

export const AppState = {
  gameLocked: false,
  firstKeySeen: false,
  firstKeyMistake: false,

  // word-limit bookkeeping (filled per run)
  requiredNodes: [],
  totalRequired: 0,
  attemptedRequired: 0,
};

// Tiny helpers (non-breaking if unused)
export function setGameLocked(v) { AppState.gameLocked = !!v; }
export function resetFirstKeyFlags() {
  AppState.firstKeySeen = false;
  AppState.firstKeyMistake = false;
}

// --- Perf tally (avoids querySelectorAll on every key) ---
export const Tally = { correct: 0, incorrect: 0, skipped: 0, extra: 0 };
export function resetTally() {
  Tally.correct = 0;
  Tally.incorrect = 0;
  Tally.skipped = 0;
  Tally.extra = 0;
}

/**
 * Attach a logical "state" to a char node and keep counters in sync.
 * Allowed states: null | 'correct' | 'incorrect' | 'skipped' | 'extra'
 */
export function setState(node, next /* string|null */) {
  const prev = node._capyState || null;
  if (prev === next) return;
  if (prev && Tally[prev] > 0) Tally[prev]--;
  if (next) Tally[next]++;
  node._capyState = next;
}

// --- Word-limit progress helpers ---
export function initWordProgress(allChars) {
  AppState.requiredNodes = [];
  AppState.totalRequired = 0;
  AppState.attemptedRequired = 0;

  for (const n of allChars) {
    n._req = n?.dataset?.required === '1' ? 1 : 0; // hot-path flag
    n._capyState = null; // clear any stale per-node state
    n._capyAttempted = 0;
    if (n._req) {
      AppState.requiredNodes.push(n);
      AppState.totalRequired++;
    }
  }

  // reset bar
  const fill = document.getElementById('wordProgressFill');
  if (fill) fill.style.width = '0%';
}

export function markAttemptedOnce(node) {
  if (!node || !node._req || node._capyAttempted) return;
  node._capyAttempted = 1;
  AppState.attemptedRequired++;
  // progress bar paint (cheap, width only)
  const fill = document.getElementById('wordProgressFill');
  if (fill && AppState.totalRequired) {
    const pct = Math.min(100, (AppState.attemptedRequired / AppState.totalRequired) * 100);
    fill.style.width = pct + '%';
  }
}
