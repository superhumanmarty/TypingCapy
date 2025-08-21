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
    const snippets = await fetch(`data/words/words_${fileLang}.json`).then(res => res.json());
    let text = '';
    for (let i = 0; i < wordCount; i++) {
      const tok = snippets[Math.floor(Math.random() * snippets.length)];
      text += tok + ' ';
    }
    return text.replace(/[\r\n]+/g, ' ').trim();
  }

  // ----- Human languages -----
  // Decide which list to load:
  //  • ENG with numeric size -> words_eng_<size>.json
  //  • ENG subset option     -> value is "subset:<filename.json>"
  //  • Others (single file)  -> words_<lang>.json
  const fileLang = encodeURIComponent(lang);
  let words;

  const sizeVal = (size == null) ? '' : String(size).trim();

  if (/^\d+$/.test(sizeVal)) {
    words = await fetch(`data/words/words_${fileLang}_${sizeVal}.json`).then(r => r.json());
  } else if (sizeVal.startsWith('subset:')) {
    // named subset for any language
    const file = sizeVal.slice('subset:'.length);
    words = await fetch(`data/words/${file}`).then(r => r.json());
  } else if (lang === 'eng' && sizeVal.startsWith('subset:')) {
    const file = sizeVal.slice('subset:'.length);
    words = await fetch(`data/words/${file}`).then(r => r.json());
  } else if (/^\d+$/.test(sizeVal)) {
    // RUS / INDO numeric lists
    words = await fetch(`data/words/words_${fileLang}_${sizeVal}.json`).then(r => r.json());
  } else {
    // Single-lexicon human languages
    words = await fetch(`data/words/words_${fileLang}.json`).then(r => r.json());
  }

  // Shuffle and trim to requested count
  words = words.sort(() => Math.random() - 0.5).slice(0, wordCount);

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
    const symbols = await fetch(`data/punctuation/${conf.symbols_always}`).then(res => res.json());
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

  // Numbers: standalone OR expressions (mutually exclusive)
  if (numbers && conf.numbers_standalone) {
    if (numbersExpr && conf.numbers_expressions) {
      const exprs = await fetch(`data/numbers/${conf.numbers_expressions}`).then(res => res.json());
      let list = text.split(sep);
      const insertCount = Math.max(1, Math.floor(wordCount / 15));
      for (let i = 0; i < insertCount; i++) {
        const insertPos = Math.floor(Math.random() * (list.length + 1));
        list.splice(insertPos, 0, exprs[Math.floor(Math.random() * exprs.length)]);
      }
      text = list.join(sep);
    } else {
      const nums = await fetch(`data/numbers/${conf.numbers_standalone}`).then(res => res.json());
      let list = text.split(sep);
      const insertCount = Math.max(1, Math.floor(wordCount / 10));
      for (let i = 0; i < insertCount; i++) {
        const insertPos = Math.floor(Math.random() * (list.length + 1));
        list.splice(insertPos, 0, nums[Math.floor(Math.random() * nums.length)]);
      }
      text = list.join(sep);
    }
  }

  return text;
}
