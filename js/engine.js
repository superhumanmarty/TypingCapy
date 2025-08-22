// js/engine.js
import { getCurrentWord } from './utils.js';
import { updateHide } from './hide.js';
import { generateText } from './promptGenerator.js';
import { getHideMode } from './settings.js';


export let chars = [];
export let currentIndex = 0;
export let startTime = 0;
export let originalLength = 0;

// --- add just below your exports ---
const DEFAULT_ROLLING_BUFFER = 120;   // how many words to pre-render when NO word limit
const APPEND_CHUNK_WORDS     = 80;    // words per append in endless/timer
const MAX_CHARS_IN_DOM       = 4500;  // prune when DOM exceeds this many .char nodes
const KEEP_WORDS_BEFORE      = 80;    // keep this many words before the caret

export function pruneLeadingText(textDisplay, keepWordsBefore = KEEP_WORDS_BEFORE) {
  // figure out the current word id
  const curWord = getCurrentWord(chars, currentIndex);
  const cutoffWord = Math.max(0, curWord - keepWordsBefore);
  if (cutoffWord <= 0) return;

  // find the first index we want to keep
  let firstKeep = 0;
  while (firstKeep < chars.length) {
    if (firstKeep === currentIndex) break;
    const w = Number(chars[firstKeep].dataset.word);
    if (Number.isFinite(w) && w >= cutoffWord) break;
    firstKeep++;
  }
  if (firstKeep <= 0) return;

  // remove [0..firstKeep-1] from DOM and from chars
  let removedBeforeCursor = 0;
  for (let i = 0; i < firstKeep; i++) {
    const n = chars[i];
    if (i < currentIndex) removedBeforeCursor++;

    const parent = n.parentNode;

    // ✅ also remove the paired <br> we append after a newline span
    if (n.classList && n.classList.contains('newline')) {
      const br = n.nextSibling;
      if (br && br.nodeName === 'BR') br.remove();
    }

    if (parent) parent.removeChild(n);

    // clean up empty word wrappers
    if (parent &&
        parent.classList &&
        parent.classList.contains('word-wrapper') &&
        parent.childNodes.length === 0 &&
        parent.parentNode) {
      parent.parentNode.removeChild(parent);
    }
  }
  chars.splice(0, firstKeep);

  // fix cursor index & .current
  currentIndex = Math.max(0, currentIndex - removedBeforeCursor);
  document.querySelectorAll('.char.current').forEach(el => el.classList.remove('current'));
  if (chars[currentIndex]) chars[currentIndex].classList.add('current');

  originalLength = chars.length;
}


export function maybePrune(textDisplay, keepWordsBefore = KEEP_WORDS_BEFORE) {
  if (chars.length > MAX_CHARS_IN_DOM) {
    pruneLeadingText(textDisplay, keepWordsBefore);
  }
}

export function setCurrentIndex(value) {
  currentIndex = value;
}

export function setStartTime(value) {
  startTime = value;
}

export function getParts(text) {
  let parts = [];
  let currentWord = '';
  
  for (const ch of text) {
    if (ch === ' ' || ch === '\n') {
      if (currentWord) {
        parts.push({ type: 'word', text: currentWord });
        currentWord = '';
      }
      parts.push({ type: 'separator', text: ch });
    } else {
      currentWord += ch;
    }
  }
  
  if (currentWord) {
    parts.push({ type: 'word', text: currentWord });
  }
  
  return parts;
}


/* ---------- SAFE CONTROL READER ---------- */
function readGenerationControls() {
  const lang = document.getElementById('languageSelector')?.value ?? 'eng';

  const wlsEl = document.getElementById('wordListSizeSelector');
  const wordSizeOrMode = (wlsEl && typeof wlsEl.value === 'string') ? wlsEl.value : null;

  // Toggles
  const numbersOn  = !!document.getElementById('numbersToggle')?.checked;       // "123"
  const numbersExp = !!document.getElementById('numbersExprToggle')?.checked;   // "+="
  const punctOn    = !!document.getElementById('punctuationToggle')?.checked;   // "!?"
  const symbolsOn  = !!document.getElementById('symbolsToggle')?.checked;       // "@#&" (only if punctOn)

  // Word limit (select or radios)
  let wordLimit = 1000;
  const wlSel = document.getElementById('wordLimitSelector');
  if (wlSel) wordLimit = (wlSel.value === 'off') ? 1000 : parseInt(wlSel.value, 10);
  else {
    const wlVal = [...document.querySelectorAll('input[name="wordLimit"]')].find(r => r.checked)?.value;
    wordLimit = (wlVal === undefined || wlVal === 'off') ? 1000 : parseInt(wlVal, 10);
  }

  return { lang, wordSizeOrMode, punctOn, numbersOn, numbersExp, symbolsOn, wordLimit };
}

// Decide which English paragraph dataset to use based on toggles
function pickEnglishParagraphKey() {
  const numbersOn     = document.getElementById('numbersToggle')?.checked === true;       // 123
  const numbersExprOn = document.getElementById('numbersExprToggle')?.checked === true;   // +=
  const punctOn       = document.getElementById('punctuationToggle')?.checked === true;   // !?
  const symbolsOn     = document.getElementById('symbolsToggle')?.checked === true;       // @#&

  // Special cases you asked for:
  // 1) 123 + += + !?
  if (numbersOn && numbersExprOn && punctOn) {
    return 'paragraphs_eng_words_punct_numbers_math';
  }
  // 2) 123 + !? + @#&
  if (numbersOn && punctOn && symbolsOn) {
    return 'paragraphs_eng_words_punct_numbers_symbols_no_math';
  }

  // Otherwise no forced override
  return null;
}

export function sanitizeExistingText(textDisplay) {
  if (!textDisplay) return;

  // Remove any extra chars added during the last run
  textDisplay.querySelectorAll('.char.extra').forEach(n => n.remove());

  // Rebuild the chars array from DOM (fresh order)
  chars = Array.from(textDisplay.querySelectorAll('.char'));
  originalLength = chars.length;

  // Clear correctness/state classes
  for (const n of chars) {
    n.classList.remove('correct', 'incorrect', 'skipped', 'extra', 'current');
  }

  // Reset indices/timer and set fresh cursor
  currentIndex = 0;
  startTime = 0;
  chars[0]?.classList.add('current');
}

/* ---------- INITIALIZE ---------- */
export async function initializeTyping(textDisplay, hideControl) {
  // clear any old content
  textDisplay.innerHTML = '';
  chars = [];
  
  // NEW: tell metrics a fresh run is starting
  window.dispatchEvent(new Event('capy:runReset'));

  const { lang, wordSizeOrMode, punctOn, numbersOn, numbersExp, symbolsOn, wordLimit } = readGenerationControls();

  let mode = 'random';
  let wordSize = wordSizeOrMode;
  if (wordSizeOrMode === 'paragraphs') { mode = 'paragraphs'; wordSize = null; }

  const preferredParagraphKey =
    (mode === 'paragraphs' && lang === 'eng') ? pickEnglishParagraphKey() : null;

  // For word-limit mode, use the selected limit.
  // For timer/endless (“off”), render a small rolling buffer to keep DOM tiny.
  const effectiveWordCount =
    (Number.isFinite(wordLimit) && wordLimit !== 1000) ? wordLimit : DEFAULT_ROLLING_BUFFER;

  const text = await generateText(
    mode, lang, wordSize, punctOn, numbersOn, numbersExp, symbolsOn, effectiveWordCount, preferredParagraphKey
  );



  
  // Generate parts
  const parts = getParts(text);
  
  // Build the DOM structure (FAST: fragment + single append)
  const frag = document.createDocumentFragment();
  let widx = 0;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.type === 'word') {
      const wordSpan = document.createElement('span');
      wordSpan.className = 'word-wrapper';
      for (const ch of part.text) {
        const span = document.createElement('span');
        span.textContent = ch;
        span.className = 'char';
        span.dataset.word = widx;
        span.dataset.required = '1';
        wordSpan.appendChild(span);
        chars.push(span);
      }
      frag.appendChild(wordSpan);
      widx++;
    } else {
      if (part.text === '\n') {
        const span = document.createElement('span');
        span.textContent = '\n';
        span.className = 'char newline';
        span.dataset.word = -1;
        chars.push(span);
        frag.appendChild(span);
        frag.appendChild(document.createElement('br'));
      } else if (part.text === ' ') {
        const span = document.createElement('span');
        span.textContent = ' ';
        span.className = 'char space';
        span.dataset.word = -1;
        chars.push(span);
        frag.appendChild(span);
      }
    }
  }
  textDisplay.appendChild(frag);

  
  originalLength = chars.length;
  
  // reset cursor & timer
  currentIndex = 0;
  startTime = 0;
  chars[0]?.classList.add('current');
  
  // perform initial hide-words pass
  const hideMode = getHideMode(hideControl);
  const w = getCurrentWord(chars, 0);
  updateHide(hideMode, w, chars, textDisplay);


  // notify listeners (e.g., main.js) that fresh text is ready
  window.dispatchEvent(new Event('capy:textReady'));
}

/* ---------- APPEND MORE TEXT ---------- */
export async function appendTyping(textDisplay, hideControl) {
  const { lang, wordSizeOrMode, punctOn, numbersOn, numbersExp, symbolsOn } = readGenerationControls();

  let mode = 'random';
  let wordSize = wordSizeOrMode;
  if (wordSizeOrMode === 'paragraphs') { mode = 'paragraphs'; wordSize = null; }

  const appendWordCount = APPEND_CHUNK_WORDS;
  const preferredParagraphKey =
    (mode === 'paragraphs' && lang === 'eng') ? pickEnglishParagraphKey() : null;

  const newText = await generateText(
    mode, lang, wordSize, punctOn, numbersOn, numbersExp, symbolsOn, appendWordCount, preferredParagraphKey
  );

  const newParts = getParts(newText);
  
  // Compute next word index by scanning from tail (FAST)
  let tail = chars.length - 1;
  let lastWordId = -1;
  while (tail >= 0) {
    const v = Number(chars[tail].dataset.word);
    if (Number.isFinite(v) && v >= 0) { lastWordId = v; break; }
    tail--;
  }
  let widx = lastWordId + 1;

  // Append using a fragment (single DOM write)
  const frag = document.createDocumentFragment();

  // Append a typeable newline to separate paragraphs
  const newlineSpan = document.createElement('span');
  newlineSpan.textContent = '\n';
  newlineSpan.className = 'char newline';
  newlineSpan.dataset.word = -1;
  chars.push(newlineSpan);
  frag.appendChild(newlineSpan);
  frag.appendChild(document.createElement('br'));

  // Now append the new paragraph's parts
  for (let part of newParts) {
    if (part.type === 'word') {
      const wordSpan = document.createElement('span');
      wordSpan.className = 'word-wrapper';
      for (const ch of part.text) {
        const span = document.createElement('span');
        span.textContent = ch;
        span.className = 'char';
        span.dataset.word = widx;
        span.dataset.required = '1';
        wordSpan.appendChild(span);
        chars.push(span);
      }
      frag.appendChild(wordSpan);
      widx++;
    } else {
      if (part.text === '\n') {
        const span = document.createElement('span');
        span.textContent = '\n';
        span.className = 'char newline';
        span.dataset.word = -1;
        chars.push(span);
        frag.appendChild(span);
        frag.appendChild(document.createElement('br'));
      } else if (part.text === ' ') {
        const span = document.createElement('span');
        span.textContent = ' ';
        span.className = 'char space';
        span.dataset.word = -1;
        chars.push(span);
        frag.appendChild(span);
      }
    }
  }

  textDisplay.appendChild(frag);

  
  originalLength = chars.length;
  
  // Update hide after append
  const hideMode = getHideMode(hideControl);
  const w = getCurrentWord(chars, currentIndex);
  updateHide(hideMode, w, chars, textDisplay);

  // highlight is updated in main.js after append
}
