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

// --- char-based targets for a monospace line of 44 chars ---
const CHARS_PER_LINE       = 44;
const INITIAL_MIN_CHARS    = CHARS_PER_LINE * 3;   // 3 lines visible at start (132)
const CHUNK_MIN_CHARS      = CHARS_PER_LINE * 1;   // ~1 line per append (44)

// Modest over-request so we can trim by chars without splitting words.
// (Keeps generation tiny while robust across short/long tokens)
const INITIAL_REQUEST_WORDS = 50;
const CHUNK_REQUEST_WORDS   = 30;

const LINE_CHARS = 44;          // you measured this
const TRIGGER_AHEAD_LINES = 2;  // append when 2 lines remain (off-screen)

// Take as many tokens as needed to satisfy minChars (don’t split tokens).
// Count spaces only when the language uses spaces.
function sliceToMinChars(tokens, sep, minChars){
  let chars = 0;
  let i = 0;
  while (i < tokens.length && chars < minChars) {
    chars += tokens[i].length;
    if (sep && i > 0) chars += 1;  // space between words
    i++;
  }
  return tokens.slice(0, i);
}


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

  const sep = (Array.isArray(window.noSpaceLangs) && window.noSpaceLangs.includes(lang)) ? '' : ' ';

  // Word-limit mode respects exact words; endless/timer uses minimal 3 lines by chars
  const isWordLimitMode = (Number.isFinite(wordLimit) && wordLimit !== 1000);
  const requestCount = isWordLimitMode ? wordLimit : INITIAL_REQUEST_WORDS;

  const rawText = await generateText(
    mode, lang, wordSize, punctOn, numbersOn, numbersExp, symbolsOn,
    requestCount, preferredParagraphKey
  );

  // Tokenize once (for spaced langs); for no-space langs we treat the whole string as one token.
  let tokens = sep ? rawText.split(sep).filter(Boolean) : [rawText];
  if (!isWordLimitMode) {
    tokens = sliceToMinChars(tokens, sep, INITIAL_MIN_CHARS); // ≥132 chars
  }

  // Build DOM as one continuous paragraph (no '\n' or <br>)
  const frag = document.createDocumentFragment();
  let widx = 0;

  const pushWord = (word) => {
    const wordSpan = document.createElement('span');
    wordSpan.className = 'word-wrapper';
    for (const ch of word) {
      const span = document.createElement('span');
      span.textContent = ch;
      span.className = 'char';
      span.dataset.word = widx;
      span.dataset.required = '1';
      wordSpan.appendChild(span);
      chars.push(span);
    }
    frag.appendChild(wordSpan);
  };

  for (let i = 0; i < tokens.length; i++) {
    pushWord(tokens[i]);
    widx++;
    if (sep && i < tokens.length - 1) {
      const sp = document.createElement('span');
      sp.textContent = ' ';
      sp.className = 'char space';
      sp.dataset.word = -1;
      chars.push(sp);
      frag.appendChild(sp);
    }
  }

  textDisplay.appendChild(frag);

  originalLength = chars.length;

  // reset cursor & timer
  currentIndex = 0;
  startTime = 0;
  chars[0]?.classList.add('current');

  // initial hide-words pass
  const hideMode = getHideMode(hideControl);
  const w = getCurrentWord(chars, 0);
  updateHide(hideMode, w, chars, textDisplay);

  window.dispatchEvent(new Event('capy:textReady'));
}


/* ---------- APPEND MORE TEXT ---------- */
export async function appendTyping(textDisplay, hideControl) {
  const { lang, wordSizeOrMode, punctOn, numbersOn, numbersExp, symbolsOn } = readGenerationControls();

  let mode = 'random';
  let wordSize = wordSizeOrMode;
  if (wordSizeOrMode === 'paragraphs') { mode = 'paragraphs'; wordSize = null; }

  const preferredParagraphKey =
    (mode === 'paragraphs' && lang === 'eng') ? pickEnglishParagraphKey() : null;

  const sep = (Array.isArray(window.noSpaceLangs) && window.noSpaceLangs.includes(lang)) ? '' : ' ';

  // Fetch small chunk, then trim to ≥44 chars (≈ one line)
  const rawText = await generateText(
    mode, lang, wordSize, punctOn, numbersOn, numbersExp, symbolsOn,
    CHUNK_REQUEST_WORDS, preferredParagraphKey
  );

  let tokens = sep ? rawText.split(sep).filter(Boolean) : [rawText];
  tokens = sliceToMinChars(tokens, sep, CHUNK_MIN_CHARS); // ≥44 chars

  // Compute next word index by scanning from tail (FAST)
  let tail = chars.length - 1;
  let lastWordId = -1;
  while (tail >= 0) {
    const v = Number(chars[tail].dataset.word);
    if (Number.isFinite(v) && v >= 0) { lastWordId = v; break; }
    tail--;
  }
  let widx = lastWordId + 1;

  const frag = document.createDocumentFragment();

  // Ensure exactly ONE space between old and new (for spaced langs)
  if (sep && chars.length) {
    const last = chars[chars.length - 1]?.textContent;
    if (last !== ' ' && last !== '\n') {
      const joiner = document.createElement('span');
      joiner.textContent = ' ';
      joiner.className = 'char space';
      joiner.dataset.word = -1;
      chars.push(joiner);
      frag.appendChild(joiner);
    }
  }

  const pushWord = (word) => {
    const wordSpan = document.createElement('span');
    wordSpan.className = 'word-wrapper';
    for (const ch of word) {
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
  };

  for (let i = 0; i < tokens.length; i++) {
    pushWord(tokens[i]);
    if (sep && i < tokens.length - 1) {
      const sp = document.createElement('span');
      sp.textContent = ' ';
      sp.className = 'char space';
      sp.dataset.word = -1;
      chars.push(sp);
      frag.appendChild(sp);
    }
  }

  textDisplay.appendChild(frag);
  originalLength = chars.length;

  // Update hide after append
  const hideMode = getHideMode(hideControl);
  const w = getCurrentWord(chars, currentIndex);
  updateHide(hideMode, w, chars, textDisplay);
}

