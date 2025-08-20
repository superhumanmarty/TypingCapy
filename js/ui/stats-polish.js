// js/ui/stats-polish.js
(() => {
  function ensureInter() {
    if (document.getElementById('inter-font-link')) return;
    const link = document.createElement('link');
    link.id = 'inter-font-link';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@600;700;800&display=swap';
    document.head.appendChild(link);
  }

  function injectCSS() {
    if (document.getElementById('stats-polish-style')) return;
    const style = document.createElement('style');
    style.id = 'stats-polish-style';
    style.textContent = `
    /* Panel is a positioning context; overlays visible */
    .typing-panel { position: relative !important; overflow: visible !important; }

    /* Center live stats */
    .typing-panel #stats {
      position: absolute !important;
      left: 50%;
      top: clamp(120px, 18vh, 260px);
      transform: translateX(-50%);
      display: flex !important;
      justify-content: center;
      align-items: flex-start;
      gap: clamp(40px, 6vw, 80px);
      width: max-content;
      margin: 0;
      margin-left: 24px;
      z-index: 999;
      pointer-events: none;
    }
    .typing-panel #stats > span { pointer-events: auto; }

    #wpm { margin-right: 0 !important; }

    /* Big numbers, Inter font */
    #wpm, #accuracy {
      font-family: 'Inter', system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
      font-weight: 800;
      line-height: 1;
      font-size: clamp(28px, 4.2vw, 48px);
      display: inline-block;
      text-align: center;
    }

    /* Stack accuracy label above number */
    #accuracy { display: inline-flex; flex-direction: column; align-items: center; }

    /* Labels ABOVE the numbers (no colons) */
    #wpm::before, #accuracy::before {
      display: block;
      content: '';
      font-weight: 700;
      font-size: clamp(12px, 1.6vw, 14px);
      line-height: 1.15;
      letter-spacing: .02em;
      opacity: .9;
      margin-bottom: 6px;
    }
    #wpm::before { content: 'WPM'; }
    #accuracy::before { content: 'Accuracy'; }

    /* RESULTS: make final stats match live look */
    #resultsScreen .results-stats{
      display: flex !important;
      justify-content: center;
      align-items: flex-start;
      gap: clamp(40px, 6vw, 80px);
    }
    #resultsScreen .results-stats .result-item{
      display: flex; flex-direction: column; align-items: center;
    }
    #resultsScreen .results-stats .result-label{ display: none !important; }

    #finalWPM, #finalAccuracy{
      font-family: 'Inter', system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
      font-weight: 800;
      line-height: 1;
      font-size: clamp(28px, 4.2vw, 48px);
      text-align: center;
      display: inline-block;
    }
    #finalWPM::before, #finalAccuracy::before{
      display: block;
      content: '';
      font-weight: 700;
      font-size: clamp(12px, 1.6vw, 14px);
      line-height: 1.15;
      letter-spacing: .02em;
      opacity: .9;
      margin-bottom: 6px;
    }
    #finalWPM::before{ content: 'WPM'; }
    #finalAccuracy::before{ content: 'Accuracy'; }

    /* RESULTS container uses Inter by default */
    #resultsScreen {
      font-family: 'Inter', system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
    }

    /* WORD LIMIT bar polish */
    #wordProgress {
      position: relative;
      height: clamp(12px, 1.6vw, 18px);
      border-radius: 9999px;
      background: linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.03));
      border: 1px solid rgba(255,255,255,.14);
      box-shadow:
        0 10px 26px rgba(0,0,0,.28),
        inset 0 2px 4px rgba(255,255,255,.06),
        inset 0 0 0 1px rgba(255,255,255,.05);
      overflow: hidden;
      transform: translateY(-12px);
      will-change: transform;
    }
    #wordProgress.hidden { display: none !important; }
    #wordProgressFill {
      height: 100%;
      border-radius: inherit;
      transition: width 140ms ease;
      background:
        linear-gradient(180deg, rgba(255,255,255,.24), rgba(255,255,255,0) 55%),
        linear-gradient(180deg, var(--accent, #1f63ff), #0b5cff);
      box-shadow:
        inset 0 0 0 1px rgba(255,255,255,.12),
        0 0 14px rgba(31,99,255,.45);
    }

    /* TIMER HUD numerals */
    #timerDisplay, #timeRemaining {
      font-family: 'Inter', system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif !important;
      font-weight: 800;
      letter-spacing: .01em;
    }

    /* Keep the two “code-like” result sections monospace by default */
    #resultsScreen #typingHistory,
    #resultsScreen #typingHistory *,
    #resultsScreen #supposedText,
    #resultsScreen #supposedText * {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
    }

    /* …but force Inter for their titles */
    #resultsScreen #typingHistory .title,
    #resultsScreen #supposedText .title {
      font-family: 'Inter', system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif !important;
      font-weight: 800 !important;
      letter-spacing: .01em;
    }
    `;
    document.head.appendChild(style);
  }

  function desiredText(raw, type) {
    if (type === 'wpm') {
      const txt = String(raw || '').replace(/^WPM:\s*/i, '').trim();
      if (txt === '…' || txt === '...' || /^\.\.\.$/.test(txt)) return '...';
      const m = txt.match(/\d+/);
      return m ? m[0] : '...';
    }
    if (type === 'time') {
      return String(raw || '').replace(/^Time:\s*/i, '').trim();
    }
    // accuracy
    const m = String(raw || '').match(/\d+(?:\.\d+)?/);
    const v = m ? m[0] : '100';
    return `${v}%`;
  }

  function sanitize(el, type, mo) {
    if (!el) return;
    const raw = (el.textContent || '').trim();
    const next = desiredText(raw, type);
    if (raw === next) return;
    if (mo) mo.disconnect();
    el.textContent = next;
    el.setAttribute('aria-label', `${type === 'wpm' ? 'WPM' : 'Accuracy'} ${next}`);
    if (mo) mo.observe(el, { childList: true, characterData: true, subtree: true });
  }

  function watch(el, type) {
    if (!el) return;
    let mo;
    mo = new MutationObserver(() => sanitize(el, type, mo));
    mo.observe(el, { childList: true, characterData: true, subtree: true });
    sanitize(el, type, mo);
  }

  function init() {
    const wpmEl  = document.getElementById('wpm');
    const accEl  = document.getElementById('accuracy');
    const timeEl = document.getElementById('timeRemaining');
    if (!wpmEl && !accEl) return;
    ensureInter();
    injectCSS();

    // live
    watch(wpmEl, 'wpm');
    watch(accEl, 'accuracy');
    if (timeEl) watch(timeEl, 'time');

    // results
    const finalWpmEl = document.getElementById('finalWPM');
    const finalAccEl = document.getElementById('finalAccuracy');
    if (finalWpmEl) watch(finalWpmEl, 'wpm');
    if (finalAccEl) watch(finalAccEl, 'accuracy');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/* Keep titles Inter even if something else injects later */
(() => {
  const ID = 'results-title-inter-fix';
  const CSS = `
#resultsScreen #typingHistory .title,
#resultsScreen #supposedText .title{
  font-family: 'Inter', system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif !important;
  font-weight: 800 !important;
  letter-spacing: .01em;
}
#resultsScreen #typingHistory .box,
#resultsScreen #supposedText .box{
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
}
`;
  function ensure() {
    let s = document.getElementById(ID);
    if (!s) {
      s = document.createElement('style');
      s.id = ID;
      s.textContent = CSS;
      document.head.appendChild(s);
    } else {
      s.textContent = CSS;
      document.head.appendChild(s);
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensure);
  } else {
    ensure();
  }
  window.addEventListener('capy:resultsPainted', ensure);
})();
