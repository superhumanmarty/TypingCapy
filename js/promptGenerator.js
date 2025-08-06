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

export async function generateText(mode, lang, size, punct, numbers, adv, wordCount) {
  const conf = window.configs[lang];
  if (!punct) adv = false; // Enforce adv only if punct on
  if (mode === 'paragraphs') {
    if (!conf.paragraphs) return 'No paragraphs available for this language.';
    let category = 'words_only';
    if (punct && numbers && adv) category = 'words_punct_numbers_symbols';
    else if (punct && numbers) category = 'words_punct_numbers';
    else if (punct && adv) category = 'words_punct_symbols';
    else if (punct) category = 'words_punct';
    else if (numbers) category = 'words_numbers';
    const file = conf.paragraphs[category];
    if (!file) return 'Selected category not available.';
    const paras = await fetch(`data/paragraphs/${file}`).then(res => res.json());
    return paras[Math.floor(Math.random() * paras.length)];
  } else { // random
    let text = '';
    const separator = noSpaceLangs.includes(lang) ? '' : ' ';
    if (conf.type === 'coding') {
      const snippets = await fetch(`data/words/words_${lang}.json`).then(res => res.json());
      for (let i = 0; i < wordCount; i++) {
        text += snippets[Math.floor(Math.random() * snippets.length)] + (Math.random() < 0.1 ? '\n' : ' ');
      }
      return text.trim();
    } else { // human
      let words = await fetch(`data/words/words_${lang}_${size}.json`).then(res => res.json());
      words = words.sort(() => Math.random() - 0.5).slice(0, wordCount);

      // Capitalize first word if punct on and lang capitalizes
      if (punct && capitalizingLangs.includes(lang) && words.length > 0) {
        words[0] = capitalize(words[0]);
      }

      // Hyphenate some words (language-specific hyphen)
      if (punct) {
        const hyphen = punctCategories.hyphen[lang][0]; // Assume first is main hyphen
        const hyphenProb = 0.05;
        for (let i = words.length - 1; i > 0; i--) {
          if (Math.random() < hyphenProb) {
            words[i-1] += hyphen + words[i];
            words.splice(i, 1);
          }
        }
      }

      // Quote some words or phrases
      if (punct) {
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
      }

      // Advanced symbols only if punct on (already enforced above)
      if (adv) {
        const symbols = await fetch(`data/punctuation/${conf.symbols_always}`).then(res => res.json());
        // Prefix @ #
        const prefixSym = symbols.filter(s => s === '@' || s === '#');
        const prefixProb = 0.05;
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
      }

      // Join words
      text = words.join(separator);

      // Add commas, clause/sentence end punct
      if (punct) {
        words = text.split(separator); // re-split after modifications
        const commaProb = 0.2;
        const commas = punctCategories.end_clause[lang].filter(s => s.includes(',') || s === ','); // Language-specific comma equivalents
        for (let i = 1; i < words.length - 1; i++) {
          if (Math.random() < commaProb && commas.length > 0 && !endsWithPunct(words[i], lang) && !isQuoted(words[i], lang) && !words[i].includes(' & ')) {
            words[i] += commas[Math.floor(Math.random() * commas.length)];
          }
        }

        const punctProb = 0.15; // Every ~6-7 words
        const endSentence = punctCategories.end_sentence[lang];
        const endClause = punctCategories.end_clause[lang].filter(s => !commas.includes(s)); // ; : etc.
        for (let i = 1; i < words.length; i++) {
          if (Math.random() < punctProb && !endsWithPunct(words[i-1], lang) && !isQuoted(words[i-1], lang) && !words[i-1].includes(' & ')) {
            const isSentenceEnd = Math.random() < 0.7;
            const punctList = isSentenceEnd ? endSentence : endClause;
            if (punctList.length > 0) {
              words[i-1] += punctList[Math.floor(Math.random() * punctList.length)];
              if (capitalizingLangs.includes(lang) && i < words.length) {
                words[i] = capitalize(words[i]);
              }
            }
          }
        }
        // Ensure final punctuation if missing and not already ending with punct
        if (!endsWithPunct(words[words.length-1], lang) && !isQuoted(words[words.length-1], lang) && !words[words.length-1].includes(' & ')) {
          words[words.length-1] += endSentence[Math.floor(Math.random() * endSentence.length)];
        }
        text = words.join(separator);
      }

      // Standalone numbers
      if (numbers) {
        const nums = await fetch(`data/numbers/${conf.numbers_standalone}`).then(res => res.json());
        let wordsList = text.split(separator);
        const insertCount = Math.floor(wordCount / 10);
        for (let i = 0; i < insertCount; i++) {
          const insertPos = Math.floor(Math.random() * wordsList.length);
          wordsList.splice(insertPos, 0, nums[Math.floor(Math.random() * nums.length)]);
        }
        text = wordsList.join(separator);
      }

      // Number expressions if numbers && adv
      if (numbers && adv) {
        const exprs = await fetch(`data/numbers/${conf.numbers_expressions}`).then(res => res.json());
        let wordsList = text.split(separator);
        const insertCount = Math.floor(wordCount / 15);
        for (let i = 0; i < insertCount; i++) {
          const insertPos = Math.floor(Math.random() * wordsList.length);
          wordsList.splice(insertPos, 0, exprs[Math.floor(Math.random() * exprs.length)]);
        }
        text = wordsList.join(separator);
      }

      return text;
    }
  }
}