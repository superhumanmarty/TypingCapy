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
    /* Make the typing panel a positioning context and allow overlays to be visible */
    .typing-panel {
        position: relative !important;
        overflow: visible !important;
    }

    /* Center the stats horizontally and keep them inside the panel (no negative Y) */
    .typing-panel #stats {
        position: absolute !important;
        left: 50%;
        top: clamp(120px, 18vh, 260px);     /* a lot lower */ 
        transform: translateX(-50%);      /* horizontal centering */
        display: flex !important;
        justify-content: center;
        align-items: flex-start;
        gap: clamp(40px, 6vw, 80px);        /* a bit farther apart */
        width: max-content;
        margin: 0;
        margin-left: 24px;
        z-index: 999;                      /* above other UI */
        pointer-events: none;
    }

    .typing-panel #stats > span { pointer-events: auto; }

    /* Remove leftover margin that can skew centering */
    #wpm { margin-right: 0 !important; }

    /* Bigger numbers, Inter font */
    #wpm, #accuracy {
        font-family: 'Inter', system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
        font-weight: 800;
        line-height: 1;
        font-size: clamp(28px, 4.2vw, 48px);
        display: inline-block;
        text-align: center;
    }

    /* Ensure 'Accuracy' label is centered above the number */
    #accuracy {
        display: inline-flex;
        flex-direction: column;
        align-items: center;
    }

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

    /* RESULTS: make final stats match the live look */
    #resultsScreen .results-stats{
    display: flex !important;
    justify-content: center;
    align-items: flex-start;
    gap: clamp(40px, 6vw, 80px);      /* same spacing you liked */
    }

    #resultsScreen .results-stats .result-item{
    display: flex;
    flex-direction: column;
    align-items: center;
    }

    /* Hide original labels (remove colon visually) */
    #resultsScreen .results-stats .result-label{
    display: none !important;
    }

    /* Big numbers + Inter + center, just like live */
    #finalWPM, #finalAccuracy{
    font-family: 'Inter', system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
    font-weight: 800;
    line-height: 1;
    font-size: clamp(28px, 4.2vw, 48px);
    text-align: center;
    display: inline-block;
    }

    /* Labels ABOVE the numbers (no colons), matching live */
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

    /* RESULTS: make the whole results screen use Inter */
    #resultsScreen {
    font-family: 'Inter', system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
    }

    /* WORD LIMIT: thick, clean, lifted — no slanted overlay */
    #wordProgress {
    position: relative;
    height: clamp(12px, 1.6vw, 18px);
    border-radius: 9999px;
    /* subtle glassy track */
    background:
        linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.03));
    border: 1px solid rgba(255,255,255,.14);
    box-shadow:
        0 10px 26px rgba(0,0,0,.28),
        inset 0 2px 4px rgba(255,255,255,.06),
        inset 0 0 0 1px rgba(255,255,255,.05);
    overflow: hidden;
    transform: translateY(-12px); /* lift it a bit higher */
    will-change: transform;
    }
    #wordProgress.hidden { display: none !important; }

    #wordProgressFill {
    height: 100%;
    border-radius: inherit;      /* rounded cap on the blue end */
    transition: width 140ms ease;
    /* rich but simple fill; no overlay on the right edge */
    background:
        linear-gradient(180deg, rgba(255,255,255,.24), rgba(255,255,255,0) 55%),
        linear-gradient(180deg, var(--accent, #1f63ff), #0b5cff);
    box-shadow:
        inset 0 0 0 1px rgba(255,255,255,.12),
        0 0 14px rgba(31,99,255,.45);   /* soft glow */
    }



    /* TIMER HUD: Inter + bold numerals */
    #timerDisplay, #timeRemaining {
      font-family: 'Inter', system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif !important;
      font-weight: 800;
      letter-spacing: .01em;
    }

    /* …but keep these two pills (and everything inside them) in monospace */
    #resultsScreen #typingHistory,
    #resultsScreen #typingHistory * ,
    #resultsScreen #supposedText,
    #resultsScreen #supposedText * {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;

    /* Keep monospace only for the code-like boxes */
    #resultsScreen #typingHistory .box,
    #resultsScreen #supposedText .box {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
    }

    /* Make the section titles use Inter (and win over any monospace rule) */
    #resultsScreen #typingHistory .title,
    #resultsScreen #supposedText .title {
    font-family: 'Inter', system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif !important;
    font-weight: 800;
    }

    }


    `;



    document.head.appendChild(style);
  }

  function desiredText(raw, type) {
    const txt = String(raw || '').trim();

    if (type === 'wpm') {
      // If the game is in warmup and shows an ellipsis, keep it.
      if (txt.includes('...')) return '...';
      // Otherwise show just the digits (e.g., "WPM: 72" -> "72").
      const m = txt.match(/\d+/);
      // If no digits are present, prefer "..." over forcing a 0.
      return m ? m[0] : '...';
    }

    // Accuracy stays numeric with a % suffix.
    const m = txt.match(/\d+(?:\.\d+)?/);
    const v = m ? m[0] : '100';
    return `${v}%`;
  }


  // IMPORTANT: only write when the value would change
  function sanitize(el, type, mo) {
    if (!el) return;
    const raw = (el.textContent || '').trim();
    const next = desiredText(raw, type);
    if (raw === next) return;                  // no-op: prevents mutation loop
    if (mo) mo.disconnect();                   // avoid feedback during our write
    el.textContent = next;
    el.setAttribute('aria-label', `${type === 'wpm' ? 'WPM' : 'Accuracy'} ${next}`);
    if (mo) mo.observe(el, { childList: true, characterData: true, subtree: true });
  }

  function watch(el, type) {
    if (!el) return;
    let mo;
    mo = new MutationObserver(() => sanitize(el, type, mo));
    mo.observe(el, { childList: true, characterData: true, subtree: true });
    sanitize(el, type, mo); // initial pass
  }

  function init() {
    const wpmEl = document.getElementById('wpm');
    const accEl = document.getElementById('accuracy');
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

// --- Force Inter on the two results titles, keep the pill bodies monospace ---
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
      // move to end so it overrides anything injected later
      s.textContent = CSS;
      document.head.appendChild(s);
    }
  }

  // run now and whenever results render
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensure);
  } else {
    ensure();
  }
  window.addEventListener('capy:resultsPainted', ensure);
})();


