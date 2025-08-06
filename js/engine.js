// engine.js

import { getCurrentWord } from './utils.js';
import { updateHide } from './hide.js';
import { generateText } from './promptGenerator.js';

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

export async function initializeTyping(textDisplay, hideRadios) {
  // clear any old content
  textDisplay.innerHTML = '';
  chars = [];

  // Get settings
  const lang = document.getElementById('languageSelector').value;
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const wordSize = document.querySelector('input[name="wordListSize"]:checked')?.value || null;
  const punctOn = document.getElementById('punctuationToggle').checked;
  const numbersOn = document.getElementById('numbersToggle').checked;
  const advOn = document.getElementById('advancedSymbolsToggle').checked;

  // Get word limit
  const wordLimitStr = document.querySelector('input[name="wordLimit"]:checked').value;
  const wordLimit = wordLimitStr === 'off' ? 200 : parseInt(wordLimitStr); // Default to 200 if off

  // Generate text
  const text = await generateText(mode, lang, wordSize, punctOn, numbersOn, advOn, wordLimit);

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

  // perform initial hide‑words pass
  const hideMode = [...hideRadios].find(r => r.checked).value;
  const w = getCurrentWord(chars, 0);
  updateHide(hideMode, w, chars, textDisplay);
}

export async function appendTyping(textDisplay, hideRadios) {
  const lang = document.getElementById('languageSelector').value;
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const wordSize = document.querySelector('input[name="wordListSize"]:checked')?.value || null;
  const punctOn = document.getElementById('punctuationToggle').checked;
  const numbersOn = document.getElementById('numbersToggle').checked;
  const advOn = document.getElementById('advancedSymbolsToggle').checked;
  // Use a fixed additional word count for appending, e.g., another paragraph's worth (~50 words)
  const appendWordCount = 50; // Adjust based on typical paragraph size

  const newText = await generateText(mode, lang, wordSize, punctOn, numbersOn, advOn, appendWordCount);
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

  // Update hide and highlight after append
  const hideMode = [...hideRadios].find(r => r.checked).value;
  const w = getCurrentWord(chars, currentIndex);
  updateHide(hideMode, w, chars, textDisplay);

  const highlightRadios = document.querySelectorAll('input[name="highlightAhead"]');
  const hmode = [...highlightRadios].find(r => r.checked).value;
  updateHighlight(hmode, w, chars);
}