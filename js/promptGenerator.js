// js/promptGenerator.js
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

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function endsWithPunct(word, lang) {
  const allEndPunct = [
    ...punctCategories.end_sentence[lang],
    ...punctCategories.end_clause[lang],
    punctCategories.close_quote[lang],
    punctCategories.close_single[lang]
  ];
  const regex = new RegExp(`[${allEndPunct.map(p => '\\' + p).join('')}]$`);
  return regex.test(word);
}

function startsWithPunct(word, lang) {
  const allStartPunct = [
    punctCategories.open_quote[lang],
    punctCategories.open_single[lang]
  ];
  const regex = new RegExp(`^[${allStartPunct.map(p => '\\' + p).join('')}]`);
  return regex.test(word);
}

function isQuoted(word, lang) {
  return word.startsWith(punctCategories.open_quote[lang] || punctCategories.open_single[lang]) ||
         word.endsWith(punctCategories.close_quote[lang] || punctCategories.close_single[lang]);
}

function isPlainWord(word, lang) {
  return !startsWithPunct(word, lang) && !endsWithPunct(word, lang) && !isQuoted(word, lang);
}

export async function generateText(
  mode, lang, size, punct, numbers, numbersExpr, advSymbols, wordCount, preferredParagraphKey = null
) {
  const conf = window.configs[lang];

  if (mode === 'paragraphs') {
    if (!conf.paragraphs) return 'No paragraphs available for this language.';

    // If engine asked for a specific English paragraph dataset, use it
    if (lang === 'eng' && preferredParagraphKey) {
      const file = conf.paragraphs[preferredParagraphKey];
      if (file) {
        const paras = await fetch(`data/paragraphs/${file}`).then(res => res.json());
        return paras[Math.floor(Math.random() * paras.length)];
      }
    }

    // Pick the paragraph category based on toggles.
    // Special case: English + 123 + += (numbers + numbersExpr) with NO punctuation
    let category;
    if (lang === 'eng' && numbers && numbersExpr && !punct) {
      category = 'words_numbers_symbols';
    } else {
      category = 'words_only';
      if (punct && numbers && advSymbols) category = 'words_punct_numbers_symbols';
      else if (punct && numbers)          category = 'words_punct_numbers';
      else if (punct && advSymbols)       category = 'words_punct_symbols';
      else if (punct)                     category = 'words_punct';
      else if (numbers)                   category = 'words_numbers';
    }

    const file = conf.paragraphs[category] || conf.paragraphs['words_only'];
    if (!file) return 'Selected category not available.';
    const paras = await fetch(`data/paragraphs/${file}`).then(res => res.json());
    return paras[Math.floor(Math.random() * paras.length)];

  } else {
    // RANDOM MODE
    const separator = [];
    const noSpaceLangs = []; // keeping your original placeholder
    const sep = noSpaceLangs.includes(lang) ? '' : ' ';

    if (conf.type === 'coding') {
      const snippets = await fetch(`data/words/words_${lang}.json`).then(res => res.json());
      let text = '';
      for (let i = 0; i < wordCount; i++) {
        text += snippets[Math.floor(Math.random() * snippets.length)] + (Math.random() < 0.1 ? '\n' : ' ');
      }
      return text.trim();
    }

    // Human language
    let words = await fetch(`data/words/words_${lang}_${size}.json`).then(res => res.json());
    words = words.sort(() => Math.random() - 0.5).slice(0, wordCount);

    // Capitalize first word if punctuation on
    const capitalizingLangs = ['eng', 'indo', 'rus'];
    function capitalize(s){ return s.charAt(0).toUpperCase() + s.slice(1); }
    if (punct && capitalizingLangs.includes(lang) && words.length > 0) {
      words[0] = capitalize(words[0]);
    }

    // Hyphenate some words — only if punctuation is on
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
      open_quote: { eng: '"', indo: '"', rus: '«' },
      close_quote: { eng: '"', indo: '"', rus: '»' },
      open_single: { eng: "'", indo: "'", rus: '‘' },
      close_single:{ eng: "'", indo: "'", rus: '’' }
    };
    const endsWithPunct = (w, lang) => {
      const allEnd = [
        ...punctCategories.end_sentence[lang],
        ...punctCategories.end_clause[lang],
        punctCategories.close_quote[lang],
        punctCategories.close_single[lang]
      ];
      const rx = new RegExp(`[${allEnd.map(p => '\\' + p).join('')}]$`);
      return rx.test(w);
    };
    const startsWithPunct = (w, lang) => {
      const allStart = [punctCategories.open_quote[lang], punctCategories.open_single[lang]];
      const rx = new RegExp(`^[${allStart.map(p => '\\' + p).join('')}]`);
      return rx.test(w);
    };
    const isQuoted = (w, lang) => {
      return w.startsWith(punctCategories.open_quote[lang] || punctCategories.open_single[lang]) ||
             w.endsWith(punctCategories.close_quote[lang] || punctCategories.close_single[lang]);
    };
    const isPlainWord = (w, lang) => !startsWithPunct(w, lang) && !endsWithPunct(w, lang) && !isQuoted(w, lang);

    if (punct) {
      // hyphenation
      const hyphen = punctCategories.hyphen[lang][0];
      const hyphenProb = 0.05;
      for (let i = words.length - 1; i > 0; i--) {
        if (Math.random() < hyphenProb) {
          words[i-1] += hyphen + words[i];
          words.splice(i, 1);
        }
      }

      // quotes
      const quoteProb = 0.1;
      for (let i = 0; i < words.length; i++) {
        if (Math.random() < quoteProb) {
          const isSingle = Math.random() < 0.5;
          const open = isSingle ? punctCategories.open_single[lang] : punctCategories.open_quote[lang];
          const close = isSingle ? punctCategories.close_single[lang] : punctCategories.close_quote[lang];
          const length = Math.random() < 0.7 ? 1 : Math.floor(Math.random() * 2) + 2;
          if (i + length - 1 < words.length) {
            words[i] = open + words[i];
            words[i + length - 1] += close;
            i += length - 1;
          }
        }
      }

      // commas / clause endings
      const commas = punctCategories.end_clause[lang].filter(s => s.includes(',') || s === ',');
      const commaProb = 0.2;
      for (let i = 1; i < words.length - 1; i++) {
        if (Math.random() < commaProb && commas.length > 0 && !endsWithPunct(words[i], lang) && !isQuoted(words[i], lang)) {
          words[i] += commas[Math.floor(Math.random() * commas.length)];
        }
      }

      // end-of-word punctuation (; : or sentence-ending)
      const punctProb = 0.15;
      const endSentence = punctCategories.end_sentence[lang];
      const endClause  = punctCategories.end_clause[lang].filter(s => !commas.includes(s));
      for (let i = 1; i < words.length; i++) {
        if (Math.random() < punctProb && !endsWithPunct(words[i-1], lang) && !isQuoted(words[i-1], lang)) {
          const isSentenceEnd = Math.random() < 0.7;
          const list = isSentenceEnd ? endSentence : endClause;
          if (list.length > 0) {
            words[i-1] += list[Math.floor(Math.random() * list.length)];
            if (capitalizingLangs.includes(lang) && i < words.length) {
              words[i] = capitalize(words[i]);
            }
          }
        }
      }

      // ensure final punctuation
      const endSentenceList = punctCategories.end_sentence[lang];
      if (!endsWithPunct(words[words.length-1], lang) && !isQuoted(words[words.length-1], lang)) {
        words[words.length-1] += endSentenceList[Math.floor(Math.random() * endSentenceList.length)];
      }
    }

    let text = words.join(sep);

    // Advanced symbols (@ # &) — only if punctuation is on AND advSymbols requested
    if (punct && advSymbols) {
      const symbols = await fetch(`data/punctuation/${conf.symbols_always}`).then(res => res.json());
      // Prefix @ #
      const prefixSym = symbols.filter(s => s === '@' || s === '#');
      const prefixProb = 0.05;
      words = text.split(sep);
      for (let i = 0; i < words.length; i++) {
        if (Math.random() < prefixProb && prefixSym.length > 0 && isPlainWord(words[i], lang)) {
          words[i] = prefixSym[Math.floor(Math.random() * prefixSym.length)] + words[i];
        }
      }
      // Between &
      const betweenSym = symbols.filter(s => s === '&');
      const betweenProb = 0.03;
      for (let i = words.length - 1; i > 0; i--) {
        if (Math.random() < betweenProb && betweenSym.length > 0 && isPlainWord(words[i-1], lang) && isPlainWord(words[i], lang)) {
          words[i-1] += ` ${betweenSym[0]} ` + words[i];
          words.splice(i, 1);
        }
      }
      text = words.join(sep);
    }

    // Numbers: standalone OR expressions (mutually exclusive, driven by numbersExpr)
    if (numbers) {
      if (numbersExpr) {
        const exprs = await fetch(`data/numbers/${conf.numbers_expressions}`).then(res => res.json());
        let wordsList = text.split(sep);
        const insertCount = Math.max(1, Math.floor(wordCount / 15));
        for (let i = 0; i < insertCount; i++) {
          const insertPos = Math.floor(Math.random() * (wordsList.length + 1));
          wordsList.splice(insertPos, 0, exprs[Math.floor(Math.random() * exprs.length)]);
        }
        text = wordsList.join(sep);
      } else {
        const nums = await fetch(`data/numbers/${conf.numbers_standalone}`).then(res => res.json());
        let wordsList = text.split(sep);
        const insertCount = Math.max(1, Math.floor(wordCount / 10));
        for (let i = 0; i < insertCount; i++) {
          const insertPos = Math.floor(Math.random() * (wordsList.length + 1));
          wordsList.splice(insertPos, 0, nums[Math.floor(Math.random() * nums.length)]);
        }
        text = wordsList.join(sep);
      }
    }

    return text;
  }
}
