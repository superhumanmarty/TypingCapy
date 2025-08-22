// js/promptGenerator.js
// Paragraph mode is disabled. We always generate random text (or code snippets).
// `mode` and `preferredParagraphKey` are ignored intentionally.

const capitalizingLangs = ['eng', 'indo', 'rus'];
const noSpaceLangs = [];

const punctCategories = {
  end_sentence: {
    eng: ['.', '!', '?'],
    indo: ['.', '!', '?'],
    rus: ['.', '!', '?', '...']
  },
  end_clause: {
    eng: [',', ';', ':'],
    indo: [',', ';', ':'],
    rus: [',', ';', ':', '—']
  },
  hyphen: {
    eng: ['-'],
    indo: ['-'],
    rus: ['-']
  },
  open_quote: {
    eng: '"',
    indo: '"',
    rus: '«'
  },
  close_quote: {
    eng: '"',
    indo: '"',
    rus: '»'
  },
  open_single: {
    eng: "'",
    indo: "'",
    rus: '‘'
  },
  close_single: {
    eng: "'",
    indo: "'",
    rus: '’'
  }
};

// tiny in-memory fetch cache so we don't re-fetch the same JSON
const _jsonCache = new Map();
async function fetchJsonCached(url){
  if (_jsonCache.has(url)) return _jsonCache.get(url);
  const p = fetch(url).then(r => r.json());
  _jsonCache.set(url, p);
  return p;
}

// sample k items from an array WITHOUT shuffling the whole array (O(k))
function sampleWithoutReplacement(arr, k){
  const n = arr.length;
  if (k >= n) return arr.slice(0);
  // Floyd's algorithm
  const chosen = new Set();
  for (let i = n - k; i < n; i++){
    const t = Math.floor(Math.random() * (i + 1));
    chosen.add(chosen.has(t) ? i : t);
  }
  const out = new Array(k);
  let j = 0;
  for (const idx of chosen) out[j++] = arr[idx];
  return out;
}

// choose k unique gap positions (0..len) to insert evenly-ish
function chooseKPositions(gaps, k){
  k = Math.max(0, Math.min(k, gaps));
  const chosen = new Set();
  for (let i = gaps - k; i < gaps; i++){
    const t = Math.floor(Math.random() * (i + 1));
    chosen.add(chosen.has(t) ? i : t);
  }
  return Array.from(chosen).sort((a,b)=>a-b);
}

// inject k generated tokens into gaps uniformly
function injectUniform(baseTokens, makeToken, k){
  if (k <= 0) return baseTokens;
  const gaps = baseTokens.length + 1;
  const pos = chooseKPositions(gaps, k);
  const out = [];
  let last = 0;
  for (const p of pos){
    while (last < p) out.push(baseTokens[last++]);
    out.push(makeToken());
  }
  while (last < baseTokens.length) out.push(baseTokens[last++]);
  return out;
}

function resolvePunctLang(lang) {
  // Only rus/indo have custom punctuation; everyone else falls back to ENG
  return (lang === 'rus' || lang === 'indo' || lang === 'eng') ? lang : 'eng';
}

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function endsWithPunct(word, lang) {
  const L = resolvePunctLang(lang);
  const allEndPunct = [
    ...punctCategories.end_sentence[L],
    ...punctCategories.end_clause[L],
    punctCategories.close_quote[L],
    punctCategories.close_single[L]
  ];
  const regex = new RegExp(`[${allEndPunct.map(p => '\\' + p).join('')}]$`);
  return regex.test(word);
}

function startsWithPunct(word, lang) {
  const L = resolvePunctLang(lang);
  const allStartPunct = [
    punctCategories.open_quote[L],
    punctCategories.open_single[L]
  ];
  const regex = new RegExp(`^[${allStartPunct.map(p => '\\' + p).join('')}]`);
  return regex.test(word);
}

function isQuoted(word, lang) {
  const L = resolvePunctLang(lang);
  return word.startsWith(punctCategories.open_quote[L] || punctCategories.open_single[L]) ||
         word.endsWith(punctCategories.close_quote[L] || punctCategories.close_single[L]);
}


function isPlainWord(word, lang) {
  return !startsWithPunct(word, lang) && !endsWithPunct(word, lang) && !isQuoted(word, lang);
}

export async function generateText(
  mode, // ignored
  lang,
  size,           // value from the second dropdown (may be numeric or "subset:<file>")
  punct,
  numbers,
  numbersExpr,
  advSymbols,
  wordCount,
  preferredParagraphKey = null // ignored
) {
  const conf = window.configs[lang];
  const sep = (Array.isArray(window.noSpaceLangs) && window.noSpaceLangs.includes(lang)) ? '' : ' ';

  // ----- Coding languages: pull tokens from a single file (no newlines) -----
  if (conf.type === 'coding') {
    const fileLang = encodeURIComponent(lang);
    const snippets = await fetchJsonCached(`data/words/words_${fileLang}.json`);
    // build array then join once (faster than += in a loop)
    const out = new Array(wordCount);
    for (let i = 0; i < wordCount; i++) {
      out[i] = snippets[Math.floor(Math.random() * snippets.length)];
    }
    return out.join(' ').replace(/[\r\n]+/g, ' ').trim();
  }

  // ----- Numbers-only language: use numbers_standalone.json -----
  if (conf.type === 'numbers' || lang === 'numbers') {
    // Load from data/numbers/ (not data/words/)
    const file = conf.numbers_standalone || 'numbers_standalone.json';
    const nums = await fetchJsonCached(`data/numbers/${file}`);

    // Build output quickly
    const out = new Array(wordCount);
    for (let i = 0; i < wordCount; i++) {
      out[i] = nums[Math.floor(Math.random() * nums.length)];
    }
    return out.join(sep).replace(/[\r\n]+/g, ' ').trim();
  }



  // ----- Human languages -----
  // Decide which list to load:
  //  • ENG with numeric size -> words_eng_<size>.json
  //  • ENG subset option     -> value is "subset:<filename.json>"
  //  • Others (single file)  -> words_<lang>.json
  const fileLang = encodeURIComponent(lang);
  let srcWords;
  const sizeVal = (size == null) ? '' : String(size).trim();

  if (/^\d+$/.test(sizeVal)) {
    srcWords = await fetchJsonCached(`data/words/words_${fileLang}_${sizeVal}.json`);
  } else if (sizeVal.startsWith('subset:')) {
    const file = sizeVal.slice('subset:'.length);
    srcWords = await fetchJsonCached(`data/words/${file}`);
  } else {
    srcWords = await fetchJsonCached(`data/words/words_${fileLang}.json`);
  }

  // NEW: O(k) sampling — independent of dataset size
  let words = sampleWithoutReplacement(srcWords, wordCount);

  // Capitalize first word if punctuation on for ENG/INDO/RUS
  if (punct && ['eng','indo','rus'].includes(lang) && words.length > 0) {
    words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
  }

  if (punct) {
    const L = resolvePunctLang(lang);

    // hyphenation
    const hyphen = punctCategories.hyphen[L][0];
    const hyphenProb = 0.05;
    for (let i = words.length - 1; i > 0; i--) {
      if (Math.random() < hyphenProb) {
        words[i - 1] += hyphen + words[i];
        words.splice(i, 1);
      }
    }

    // quotes
    const quoteProb = 0.1;
    for (let i = 0; i < words.length; i++) {
      if (Math.random() < quoteProb) {
        const isSingle = Math.random() < 0.5;
        const open = isSingle ? punctCategories.open_single[L] : punctCategories.open_quote[L];
        const close = isSingle ? punctCategories.close_single[L] : punctCategories.close_quote[L];
        const length = Math.random() < 0.7 ? 1 : Math.floor(Math.random() * 2) + 2;
        if (i + length - 1 < words.length) {
          words[i] = open + words[i];
          words[i + length - 1] += close;
          i += length - 1;
        }
      }
    }

    // commas / clause endings
    const commas = punctCategories.end_clause[L].filter(s => s.includes(',') || s === ',');
    const commaProb = 0.2;
    for (let i = 1; i < words.length - 1; i++) {
      if (Math.random() < commaProb && commas.length > 0 && !endsWithPunct(words[i], L) && !isQuoted(words[i], L)) {
        words[i] += commas[Math.floor(Math.random() * commas.length)];
      }
    }

    // end-of-word punctuation
    const punctProb = 0.15;
    const endSentence = punctCategories.end_sentence[L];
    const endClause  = punctCategories.end_clause[L].filter(s => !commas.includes(s));
    for (let i = 1; i < words.length; i++) {
      if (Math.random() < punctProb && !endsWithPunct(words[i - 1], L) && !isQuoted(words[i - 1], L)) {
        const isSentenceEnd = Math.random() < 0.7;
        const list = isSentenceEnd ? endSentence : endClause;
        if (list.length > 0) {
          words[i - 1] += list[Math.floor(Math.random() * list.length)];
          if (['eng','indo','rus'].includes(lang) && i < words.length) {
            words[i] = words[i].charAt(0).toUpperCase() + words[i].slice(1);
          }
        }
      }
    }

    // ensure final punctuation
    if (!endsWithPunct(words[words.length - 1], L) && !isQuoted(words[words.length - 1], L)) {
      const endSentenceList = punctCategories.end_sentence[L];
      words[words.length - 1] += endSentenceList[Math.floor(Math.random() * endSentenceList.length)];
    }
  }

  let text = words.join(sep);

  // Advanced symbols (@ # &) — only if punctuation is on AND advSymbols requested
  if (punct && advSymbols && conf.symbols_always) {
    const symbols = await fetchJsonCached(`data/punctuation/${conf.symbols_always}`);
    const prefixSym = symbols.filter(s => s === '@' || s === '#');
    const prefixProb = 0.05;
    let arr = text.split(sep);
    for (let i = 0; i < arr.length; i++) {
      if (Math.random() < prefixProb && prefixSym.length > 0 && isPlainWord(arr[i], lang)) {
        arr[i] = prefixSym[Math.floor(Math.random() * prefixSym.length)] + arr[i];
      }
    }
    const betweenSym = symbols.filter(s => s === '&');
    const betweenProb = 0.03;
    for (let i = arr.length - 1; i > 0; i--) {
      if (Math.random() < betweenProb && betweenSym.length > 0 && isPlainWord(arr[i - 1], lang) && isPlainWord(arr[i], lang)) {
        arr[i - 1] += ` ${betweenSym[0]} ` + arr[i];
        arr.splice(i, 1);
      }
    }
    text = arr.join(sep);
  }

  // ---------- Numbers: proportional & uniform ----------
  if (numbers && conf.numbers_standalone) {
    // split AFTER punctuation/quotes so we base ratios on what the player will see
    let tokens = text.split(sep);

    // tune these:
    const RATIO_STANDALONE = 0.10;  // ~10% plain numbers when only 123 is on
    const RATIO_EXPR       = 0.065; // ~6.5% inserts when += is on (expressions are often multi-word)

    if (numbersExpr && conf.numbers_expressions) {
      const exprs = await fetchJsonCached(`data/numbers/${conf.numbers_expressions}`);
      const target = Math.max(1, Math.round(tokens.length * RATIO_EXPR));
      tokens = injectUniform(tokens, () => exprs[Math.floor(Math.random() * exprs.length)], target);
    } else {
      const nums = await fetchJsonCached(`data/numbers/${conf.numbers_standalone}`);
      const target = Math.max(1, Math.round(tokens.length * RATIO_STANDALONE));
      tokens = injectUniform(tokens, () => nums[Math.floor(Math.random() * nums.length)], target);
    }

    text = tokens.join(sep);
  }


  return text;
}
