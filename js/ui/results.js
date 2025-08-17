// js/ui/results.js
import { renderRunGraph, setAvgOverrideForRun } from '../metrics.js';
import { renderTypingHistory } from '../history.js';

// read the explicit Final WPM if present, else parse it from text
export function readFinalWpm() {
  const rs = document.getElementById('resultsScreen');
  if (!rs) return null;

  const el =
    rs.querySelector('[data-final-wpm]') ||
    rs.querySelector('#finalWpmValue, #finalWpm, .final-wpm .value, .result-wpm .value');

  if (el) {
    const n = parseInt((el.textContent || '').replace(/[^\d]/g, ''), 10);
    if (Number.isFinite(n)) return n;
  }
  const m = (rs.textContent || '').match(/Final\s*WPM:\s*(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}

export function buildResultsSettingsSummary() {
  const rs = document.getElementById('resultsScreen');
  if (!rs) return;

  const langKey  = document.getElementById('languageSelector')?.value;
  const langConf = window.configs?.[langKey];
  const isHuman  = langConf?.type === 'human';

  let wrap = rs.querySelector('#runSettings');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'runSettings';
    wrap.className = 'run-settings';
    const after = rs.querySelector('.results-stats');
    (after?.parentNode)?.insertBefore(wrap, after.nextSibling);
  }
  wrap.innerHTML = '';

  const add = (label) => {
    const chip = document.createElement('span');
    chip.className = 'badge';
    chip.textContent = label;
    wrap.appendChild(chip);
  };

  const langLabel = document.querySelector('#languageSelector option:checked')?.textContent?.trim();
  if (langLabel) add(`Language: ${langLabel}`);

  const wls = document.getElementById('wordListSizeSelector');
  if (isHuman && wls && wls.options?.length > 0) {
    if (wls.value && !isNaN(parseInt(wls.value, 10))) add(`${wls.value} words`);
  }

  const togglesVisible = isHuman && !document.getElementById('togglesSettings')?.classList.contains('hidden');
  if (togglesVisible) {
    if (document.getElementById('numbersToggle')?.checked)      add('123');
    if (document.getElementById('numbersExprToggle')?.checked)  add('+=');
    if (document.getElementById('punctuationToggle')?.checked)  add('!?');
    if (document.getElementById('symbolsToggle')?.checked)      add('@#&');
  }

  const tSel = document.getElementById('timerSelector');
  if (tSel && tSel.value !== 'off') {
    const sec = parseInt(tSel.value, 10);
    const label = Number.isFinite(sec) ? (sec % 60 ? `${sec}s` : `${sec/60} min`) : tSel.value;
    add(`Timer: ${label}`);
  }
  const wlSel = document.getElementById('wordLimitSelector');
  if (wlSel && wlSel.value !== 'off') add(`Word limit: ${wlSel.value}`);

  if (document.getElementById('keyboardDiagramToggle')?.checked) add('Keyboard guide');

  const hideVal = document.getElementById('hideWordsSelector')?.value;
  if (hideVal === 'current')     add('Hide: current');
  if (hideVal === 'currentNext') add('Hide: current & next');

  const hlVal = document.getElementById('highlightAheadSelector')?.value;
  if (hlVal === 'next')  add('Highlight: next');
  if (hlVal === 'next2') add('Highlight: 2nd');

  if (document.getElementById('endWpmToggle')?.checked) {
    const v = document.getElementById('endWpmValue')?.value;
    if (v) add(`End if WPM < ${v}`);
  }
  if (document.getElementById('endErrToggle')?.checked) {
    const v = document.getElementById('endErrValue')?.value;
    if (v) add(`End at ${v} errors`);
  }

  const host = document.getElementById('runGraph');
  if (host) {
    host.innerHTML = '';
    const finalWpm = readFinalWpm();
    setAvgOverrideForRun(Number.isFinite(finalWpm) ? finalWpm : null);
    renderRunGraph(host, null);
  }
}

export function removeLegacyResultsHints() {
  const rs = document.getElementById('resultsScreen');
  if (!rs) return;

  rs.querySelectorAll(
    '#resultsEscTip, #resultsTabTip, .results-esc-hint, .results-tab-hint, .legacy-results-hint, .esc-tip, .tab-tip'
  ).forEach(n => n.remove());

  const patterns = [
    /ESC\s+to\s+go\s+back\s+to\s+settings\s+and\s+change\s+stuff/i,
    /TAB\s+to\s+play\s+the\s+same\s+game/i
  ];
  const walker = document.createTreeWalker(rs, NodeFilter.SHOW_TEXT);
  const toRemove = [];
  while (walker.nextNode()) {
    const txt = walker.currentNode.nodeValue || '';
    if (patterns.some(re => re.test(txt))) toRemove.push(walker.currentNode);
  }
  toRemove.forEach(node => {
    const p = node.parentNode;
    if (!p) return;
    p.removeChild(node);
    if (!p.textContent.trim() && !p.children.length) p.remove();
  });
}

export function tagTargetTextBoxForCertificate() {
  const el = document.querySelector(
    '[data-cert-capture="target"], ' +
    '#supposedText, ' +
    '[data-target-text], ' +
    '#resultsTargetText, #targetTextBlock, #targetText, #targetTextDisplay, ' +
    '.target-text, .targetText, .target-words, .results-target'
  );
  if (el && !el.hasAttribute('data-cert-capture')) {
    el.setAttribute('data-cert-capture', 'target');
  }
}

// Watch results visibility and render summary/history when shown
export function watchResultsScreenForSettings() {
  const rs = document.getElementById('resultsScreen');
  if (!rs) return;

  const renderIfShown = () => {
    requestAnimationFrame(() => {
      buildResultsSettingsSummary();
      renderTypingHistory();
      tagTargetTextBoxForCertificate();
      removeLegacyResultsHints();
    });
  };

  const mo = new MutationObserver(() => {
    if (!rs.classList.contains('hidden')) renderIfShown();
  });
  mo.observe(rs, { attributes: true, attributeFilter: ['class', 'style'] });

  window.addEventListener('capy:timeup', renderIfShown);
}

