// js/engine.js
import { getCurrentWord } from './utils.js';
import { updateHide } from './hide.js';
import { generateText } from './promptGenerator.js';
import { getHideMode } from './settings.js';

export let chars = [];
export let currentIndex = 0;
export let startTime = 0;
export let originalLength = 0;

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

/* ---------- INITIALIZE ---------- */
export async function initializeTyping(textDisplay, hideControl) {
  // clear any old content
  textDisplay.innerHTML = '';
  chars = [];
  
  const { lang, wordSizeOrMode, punctOn, numbersOn, numbersExp, symbolsOn, wordLimit } = readGenerationControls();

  let mode = 'random';
  let wordSize = wordSizeOrMode;
  if (wordSizeOrMode === 'paragraphs') { mode = 'paragraphs'; wordSize = null; }

  const preferredParagraphKey =
    (mode === 'paragraphs' && lang === 'eng') ? pickEnglishParagraphKey() : null;

  const text = await generateText(
    mode, lang, wordSize, punctOn, numbersOn, numbersExp, symbolsOn, wordLimit, preferredParagraphKey
  );


  
  // Generate parts
  const parts = getParts(text);
  
  // Build the DOM structure
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
      textDisplay.appendChild(wordSpan);
      widx++;
    } else {
      if (part.text === '\n') {
        const span = document.createElement('span');
        span.textContent = part.text;
        span.className = 'char newline';
        span.dataset.word = -1;
        chars.push(span);
        textDisplay.appendChild(span);
        
        const br = document.createElement('br');
        textDisplay.appendChild(br);
      } else if (part.text === ' ') {
        const span = document.createElement('span');
        span.textContent = part.text;
        span.className = 'char space';
        span.dataset.word = -1;
        chars.push(span);
        textDisplay.appendChild(span);
      }
    }
  }
  
  originalLength = chars.length;
  
  // reset cursor & timer
  currentIndex = 0;
  startTime = 0;
  chars[0]?.classList.add('current');
  
  // perform initial hide-words pass
  const hideMode = getHideMode(hideControl);
  const w = getCurrentWord(chars, 0);
  updateHide(hideMode, w, chars, textDisplay);
}

/* ---------- APPEND MORE TEXT ---------- */
export async function appendTyping(textDisplay, hideControl) {
  const { lang, wordSizeOrMode, punctOn, numbersOn, numbersExp, symbolsOn } = readGenerationControls();

  let mode = 'random';
  let wordSize = wordSizeOrMode;
  if (wordSizeOrMode === 'paragraphs') { mode = 'paragraphs'; wordSize = null; }

  const appendWordCount = 50;
  const preferredParagraphKey =
    (mode === 'paragraphs' && lang === 'eng') ? pickEnglishParagraphKey() : null;

  const newText = await generateText(
    mode, lang, wordSize, punctOn, numbersOn, numbersExp, symbolsOn, appendWordCount, preferredParagraphKey
  );

  const newParts = getParts(newText);
  
  let widx = Math.max(...chars.map(c => Number(c.dataset.word) || 0)) + 1;
  
  // Append a typeable newline to separate paragraphs
  const newlineSpan = document.createElement('span');
  newlineSpan.textContent = '\n';
  newlineSpan.className = 'char newline';
  newlineSpan.dataset.word = -1;
  chars.push(newlineSpan);
  textDisplay.appendChild(newlineSpan);
  
  const br = document.createElement('br');
  textDisplay.appendChild(br);
  
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
      textDisplay.appendChild(wordSpan);
      widx++;
    } else {
      if (part.text === '\n') {
        const span = document.createElement('span');
        span.textContent = part.text;
        span.className = 'char newline';
        span.dataset.word = -1;
        chars.push(span);
        textDisplay.appendChild(span);
        
        const br2 = document.createElement('br');
        textDisplay.appendChild(br2);
      } else if (part.text === ' ') {
        const span = document.createElement('span');
        span.textContent = part.text;
        span.className = 'char space';
        span.dataset.word = -1;
        chars.push(span);
        textDisplay.appendChild(span);
      }
    }
  }
  
  originalLength = chars.length;
  
  // Update hide after append
  const hideMode = getHideMode(hideControl);
  const w = getCurrentWord(chars, currentIndex);
  updateHide(hideMode, w, chars, textDisplay);

  // highlight is updated in main.js after append
}
