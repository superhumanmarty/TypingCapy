// js/history.js
import { chars } from './engine.js';

let _events = [];
let _lastWasSpace = false;   // was the last key a Space?
let _needVisualSep = false;  // do we owe a ⎵ before the next typed char?
let _targetWords = [];
export function setTargetWordsForRun(words) {
  _targetWords = Array.isArray(words) ? words.slice() : [];
}

export function resetHistory() {
  _events.length = 0;
  _lastWasSpace = false;
  _needVisualSep = false;
}

// ---- loggers ---------------------------------------------------------------

function flushPendingSepIfNeeded() {
  if (_needVisualSep) {
    _events.push({ k: 'visspace' });   // emit ⎵ right before the *next* typed char
    _needVisualSep = false;
  }
}

export function logCorrect(ch)   { flushPendingSepIfNeeded(); _events.push({ k: 'char', t: 'correct',   ch }); }
export function logIncorrect(ch) { flushPendingSepIfNeeded(); _events.push({ k: 'char', t: 'incorrect', ch }); }
export function logExtra(ch)     { flushPendingSepIfNeeded(); _events.push({ k: 'char', t: 'extra',     ch }); }

export function logSkipped(arr)  {
  // Add the transparent red skipped chars
  for (const ch of arr) _events.push({ k: 'char', t: 'skipped', ch });

  // If the skip was caused by *Space*, mark that we owe a visible separator.
  // (Do NOT emit it yet; wait to see what the next key is.)
  if (_lastWasSpace && arr.length) {
    _needVisualSep = true;
  }

  // After logging the skip, we no longer treat it as "the last key was space"
  _lastWasSpace = false;
}

export function logSpace() {
  // If we were about to show ⎵ from a previous space-skip, a new Space cancels it.
  _needVisualSep = false;
  _events.push({ k: 'space' });
  _lastWasSpace = true;
}

export function logEnter() {
  // Enter after a skip should NOT produce ⎵
  _needVisualSep = false;
  _events.push({ k: 'enter' });
  _lastWasSpace = false;
}

export function logBackspace() {
  // cancel any pending visible-separator
  _needVisualSep = false;
  _events.push({ k: 'backspace' });
  _lastWasSpace = false;
}






// ---- render ---------------------------------------------------------------

function ensureStyles() {
  const id = 'typing-history-style';
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = `
#typingHistory, #supposedText { margin-top: 1rem; }
#typingHistory .title, #supposedText .title { font-weight: 800; margin-bottom: .5rem; }
#typingHistory .box, #supposedText .box {
  max-height: 220px; overflow: auto;
  border-radius: 12px; padding: 12px;
  background: rgba(0,0,0,.35);
  border: 1px solid rgba(255,255,255,.12);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: .95rem; line-height: 1.4;

  /* wrap only at spaces/newlines; never split a word */
  white-space: pre-wrap;
  word-break: normal;
  overflow-wrap: normal;
  hyphens: manual;
}
#typingHistory .t-corr  { color: #fff; }
#typingHistory .t-err,
#typingHistory .t-extra { color: #ff4d4d; }
#typingHistory .t-skip  { color: #ff4d4d; opacity: .45; } /* transparent red */
#typingHistory .t-bsp   { color: rgba(255,255,255,.7); margin: 0 .05rem; }
#typingHistory .t-enter { color: rgba(255,255,255,.9); }
#typingHistory .t-sep   { color: rgba(255,255,255,.7); } /* visible space ⎵ */


/* all-green success mode */
#supposedText .sup-word { 
  display: inline-block;          /* keep each whole word together */
  margin-right: .6ch;             /* visually one space */
  } 
/* untyped tail of the last word */
#supposedText .sup-remaining { opacity: .45; }
#typingHistory .box.all-green,
#supposedText .box.all-green,
#typingHistory .box.all-green .t-corr,
#supposedText .box.all-green * {
  color: #39ff14 !important;
}

/* --- contrast overrides for better readability in-game and in the PDF --- */
#supposedText .box{
  background: #0d1117;                      /* darker pill */
  border-color: rgba(255,255,255,.18);
  color: #f7faff;                           /* brighter text */
  text-shadow: 0 1px 0 rgba(0,0,0,.35);     /* subtle lift (html2canvas-friendly) */
}
#supposedText .sup-word{
  color: #f7faff !important;                /* ensure bright text overrides theme blues */
  font-weight: 600;
}
#supposedText .sup-remaining{ opacity: .72; }  /* was .45; keep faded but readable */
/* --- match keystroke history pill to 'supposed' pill --- */
#typingHistory .box{
  background: #0d1117;                      /* same darker pill */
  border-color: rgba(255,255,255,.18);
  color: #f7faff;                           /* brighter default text */
  text-shadow: 0 1px 0 rgba(0,0,0,.35);
}
#typingHistory .t-corr  { color: #f7faff; } /* ensure correct chars stay bright */
`;
  document.head.appendChild(style);
}


function buildSupposedModel() {
  if (!_targetWords.length) return null;

  const typedCounts  = new Array(_targetWords.length).fill(0);
  const spaceSkipped = new Array(_targetWords.length).fill(false);

  let widx = 0;                // index of current target word
  let pos  = 0;                // cursor within that word
  let pendingBoundary = null;  // 'space' or 'enter' seen; waiting to resolve
  let maxTouched = -1;         // highest word index that was actually typed/skipped

  const lenAt = (i) => (_targetWords[i] ? _targetWords[i].length : 0);

  for (const e of _events) {
    if (e.k === 'space' || e.k === 'enter') {
      // Do not advance word yet — we might see skipped chars for the *current* word.
      pendingBoundary = e.k;
      continue;
    }
    if (e.k !== 'char') continue;

    if (e.t === 'skipped') {
      // Skips always apply to the current word (the one before the boundary).
      if (widx < _targetWords.length) {
        if (pendingBoundary === 'space') spaceSkipped[widx] = true; // mark as space-skipped
        pos++;
        maxTouched = Math.max(maxTouched, widx);

        // finished this word via skipping → move to next word
        if (pos >= lenAt(widx)) {
          widx++;
          pos = 0;
          pendingBoundary = null; // boundary resolved
        }
      }
      continue;
    }

    if (e.t === 'correct' || e.t === 'incorrect') {
      // A real typed char after a boundary means we've committed to the next word.
      if (pendingBoundary) {
        widx++;
        pos = 0;
        pendingBoundary = null;
      }
      if (widx < _targetWords.length) {
        typedCounts[widx]++;
        pos++;
        maxTouched = Math.max(maxTouched, widx);

        if (pos >= lenAt(widx)) {
          widx++;
          pos = 0;
        }
      }
      continue;
    }

    // extras don't affect target progression
  }

  if (maxTouched < 0) {
    // nothing typed or skipped → show nothing
    return { fullWords: [], currentWord: null, typedCount: 0 };
  }

  const fullWords = [];
  for (let i = 0; i < maxTouched; i++) {
    fullWords.push(_targetWords[i]); // everything before last touched is full
  }

  // Last touched word:
  if (spaceSkipped[maxTouched]) {
    // Space-skipped words are shown fully (opaque), by your spec
    fullWords.push(_targetWords[maxTouched]);
    return { fullWords, currentWord: null, typedCount: 0 };
  } else {
    // Partially typed word gets a faded tail
    return {
      fullWords,
      currentWord: _targetWords[maxTouched],
      typedCount : typedCounts[maxTouched]
    };
  }
}




function isPerfectHistory() {
  // perfect = no incorrect, no extras, no skips
  return !_events.some(e => e.k === 'char' && (e.t === 'incorrect' || e.t === 'extra' || e.t === 'skipped'));
}

/**
 * Returns the last word index the player actually attempted:
 * - any required char in that word is correct/incorrect/skipped
 * - extras don’t count
 * If none attempted, returns -1.
 */

function getLastAttemptedWordIndex() {
  let last = -1;
  for (const n of chars) {
    // only consider original required characters that belong to a word
    if (n?.dataset?.required !== '1') continue;
    const w = Number(n?.dataset?.word);
    if (!Number.isFinite(w) || w < 0) continue;
    const c = n.classList;
    if (c.contains('correct') || c.contains('incorrect') || c.contains('skipped')) {
      if (w > last) last = w;
    }
  }
  return last;
}



export function renderTypingHistory() {
  ensureStyles();
  const rs =
    document.getElementById('resultsScreen') ||
    document.querySelector('.results-screen, .results, [data-results]') ||
    document.querySelector('.results-stats')?.closest('.modal,.overlay,.results,.panel,.box') ||
    document.body; // worst-case fallback so the pill still renders


  let wrap = rs.querySelector('#typingHistory');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'typingHistory';
    const after = rs.querySelector('.results-stats') || rs.lastElementChild;
    (after?.parentNode)?.insertBefore(wrap, after?.nextSibling ?? null);
  }

  wrap.innerHTML = '';
  const title = document.createElement('div');
  title.className = 'title';
  title.textContent = 'Typed';

  const box = document.createElement('div');
  box.className = 'box';

    for (let i = 0; i < _events.length; i++) {
    const ev = _events[i];

    if (ev.k === 'char') {
        const span = document.createElement('span');
        span.className =
        ev.t === 'correct'   ? 't-corr' :
        ev.t === 'incorrect' ? 't-err'  :
        ev.t === 'extra'     ? 't-extra': 't-skip';
        span.textContent = ev.ch;
        box.appendChild(span);
        continue;
    }

    if (ev.k === 'visspace') {
      // render a literal space instead of the ⎵ glyph
      box.appendChild(document.createTextNode(' '));
      continue;
    }




    if (ev.k === 'space') {
      const next = _events[i + 1];
      const prev = _events[i - 1];
      const isSkipped = (e) => e && e.k === 'char' && e.t === 'skipped';

      // If the space sits between two skipped chunks (…skipped][space][skipped…),
      // we *do* want a normal word separator so the skipped words don't stick together.
      if (isSkipped(prev) && isSkipped(next)) {
        box.appendChild(document.createTextNode(' '));
        continue;
      }

      // If the space is immediately before a skipped block (typical “space-skip this word”),
      // suppress it (the ⎵ logic for typed-after-skip is handled elsewhere).
      if (isSkipped(next)) {
        continue;
      }

      // Otherwise render a literal space.
      box.appendChild(document.createTextNode(' '));
      continue;
    }



    if (ev.k === 'enter') {
        const span = document.createElement('span');
        span.className = 't-enter';
        span.textContent = '⏎';
        box.appendChild(span);
        box.appendChild(document.createElement('br'));
        continue;
    }

    if (ev.k === 'backspace') {
        const span = document.createElement('span');
        span.className = 't-bsp';
        span.textContent = '⬅';
        box.appendChild(span);
        continue;
    }
    }


  wrap.appendChild(title);
  wrap.appendChild(box);

  // Start scrolled to the bottom so the latest keystrokes are visible.
  box.scrollTop = box.scrollHeight;

  // --- “What the player was supposed to type” pill ---
  // Build or find the wrapper just below history
  let sup = rs.querySelector('#supposedText');
  if (!sup) {
    sup = document.createElement('div');
    sup.id = 'supposedText';
    (wrap?.parentNode)?.insertBefore(sup, wrap.nextSibling);
  }

  sup.innerHTML = '';
  const supTitle = document.createElement('div');
  supTitle.className = 'title';
  supTitle.textContent = 'Target';
  const supBox = document.createElement('div');
  supBox.className = 'box';

  // Fill using DOM-truth: crop to the last attempted word
  supBox.textContent = ''; // clear first

  const lastIdxRaw = getLastAttemptedWordIndex();
  if (lastIdxRaw >= 0 && _targetWords.length > 0) {
    // cap in case indices ever drift
    const lastIdx = Math.min(lastIdxRaw, _targetWords.length - 1);

    // helper to append a full opaque word
    const appendWord = (w) => {
      const span = document.createElement('span');
      span.className = 'sup-word';
      span.textContent = w;
      supBox.appendChild(span);
    };

    // 1) fully render all words BEFORE the last attempted word
    for (let i = 0; i < lastIdx; i++) {
      appendWord(_targetWords[i]);
    }

    // 2) render the LAST attempted word intelligently
    const lastWord = _targetWords[lastIdx] ?? '';

    // gather required nodes for this word straight from the live DOM
    const nodes = chars.filter(n =>
      n?.dataset?.required === '1' && Number(n?.dataset?.word) === lastIdx
    );
    const totalReq     = nodes.length;
    const typedReq     = nodes.filter(n => n.classList.contains('correct') || n.classList.contains('incorrect')).length;
    const attemptedReq = nodes.filter(n => n.classList.contains('correct') || n.classList.contains('incorrect') || n.classList.contains('skipped')).length;

    if (attemptedReq >= totalReq) {
      // finished (fully typed or fully skipped) → render full opaque word
      appendWord(lastWord);
    } else if (typedReq > 0) {
      // partially typed → show typed portion, fade the remainder
      const wordWrap = document.createElement('span');
      wordWrap.className = 'sup-word';

      const typedPart = lastWord.slice(0, Math.min(typedReq, lastWord.length));
      const remainPart = lastWord.slice(typedPart.length);

      if (typedPart) wordWrap.appendChild(document.createTextNode(typedPart));
      if (remainPart) {
        const rest = document.createElement('span');
        rest.className = 'sup-remaining';
        rest.textContent = remainPart;
        wordWrap.appendChild(rest);
      }
      supBox.appendChild(wordWrap);
    } else {
      // edge: only extras before touching any required char → just show prior words
      // (or if you want a visual anchor, uncomment next line to show the whole last word)
      // appendWord(lastWord);
    }
  }




  // If history is perfect, make BOTH boxes neon green
  if (isPerfectHistory()) {
    supBox.classList.add('all-green');
    box.classList.add('all-green');
  } else {
    supBox.classList.remove('all-green');
    box.classList.remove('all-green');
  }

  sup.appendChild(supTitle);
  sup.appendChild(supBox);

}
