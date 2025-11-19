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

    /* Unified HUD cluster */
    .typing-panel #typingHud,
    .typing-panel .typing-hud{
      position: absolute;
      top: clamp(70px, 13vh, 240px);
      left: 50%;
      transform: translateX(-50%);
      transform-origin: top center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: clamp(6px, 0.9vh, 20px);
      width: clamp(200px, min(30vw, 52vh), 520px);
      max-width: 100%;
      padding: 0 0.5rem;
      z-index: 990;
      pointer-events: none;
    }
    .typing-panel #typingHud > *,
    .typing-panel .typing-hud > *{
      pointer-events: auto;
      width: 100%;
    }

    #timerDisplay{
      position: static !important;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      margin: clamp(6px, 1vh, 16px) 0 0;
      text-align: center;
      align-self: center;
      transform: translateX(-14px);
      color: var(--timer-hud-color, var(--timer-color, var(--highlight-color, #ffd45c)));
      text-shadow:
        0 10px 30px rgba(0,0,0,.35),
        0 0 20px currentColor;
    }
    #timerDisplay #timeRemaining{
      font-size: clamp(26px, min(6vw, 6vh), 96px);
      font-weight: 800;
      letter-spacing: .045em;
    }

    /* Center live stats */
    .typing-panel #stats {
      position: static !important;
      display: flex !important;
      justify-content: center;
      align-items: flex-start;
      gap: clamp(20px, min(5vw, 4.6vh), 68px);
      width: 100%;
      margin: 0;
      pointer-events: none;
    }
    .typing-panel #stats > span { pointer-events: auto; }

    #wpm { margin-right: 0 !important; }

    /* Big numbers, Inter font */
    #wpm, #accuracy {
      font-family: 'Inter', system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
      font-weight: 800;
      line-height: 1;
      font-size: clamp(22px, min(5.4vw, 5.4vh), 80px);
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
      font-size: clamp(13px, 1.9vw, 17px);
      line-height: 1.15;
      letter-spacing: .02em;
      opacity: .92;
      margin-bottom: clamp(6px, 0.9vh, 12px);
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
      font-size: clamp(32px, 5vw, 60px);
      text-align: center;
      display: inline-block;
    }
    #finalWPM::before, #finalAccuracy::before{
      display: block;
      content: '';
      font-weight: 700;
      font-size: clamp(13px, 1.8vw, 16px);
      line-height: 1.15;
      letter-spacing: .02em;
      opacity: .9;
      margin-bottom: clamp(6px, 0.8vh, 10px);
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
      width: 100%;
      height: clamp(12px, min(2.2vw, 2.4vh), 30px);
      border-radius: 9999px;
      background: linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.03));
      border: 1px solid rgba(255,255,255,.14);
      box-shadow:
        0 10px 26px rgba(0,0,0,.28),
        inset 0 2px 4px rgba(255,255,255,.06),
        inset 0 0 0 1px rgba(255,255,255,.05);
      overflow: hidden;
      transform: none;
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

    @media (min-width: 1400px){
      .typing-panel #typingHud,
      .typing-panel .typing-hud{
        width: clamp(260px, min(26vw, 48vh), 580px);
        gap: clamp(8px, 1vh, 24px);
      }
      .typing-panel #stats{
        gap: clamp(24px, min(4.4vw, 4.2vh), 80px);
      }
      #wpm, #accuracy{
        font-size: clamp(24px, min(3.8vw, 3.8vh), 64px);
      }
      #wpm::before, #accuracy::before{
        font-size: clamp(13px, min(1.4vw, 1.4vh), 16px);
      }
      #timerDisplay{
        font-size: clamp(1.1rem, min(0.95rem + 1.8vw, 4vh), 2.8rem);
      }
      #wordProgress{
        height: clamp(14px, min(1.6vw, 2.8vh), 36px);
      }
    }
    @media (max-width: 768px), (max-height: 620px){
      .typing-panel #typingHud,
      .typing-panel .typing-hud{
        top: clamp(62px, 12.5vh, 210px);
        width: clamp(180px, min(48vw, 48vh), 360px);
        gap: clamp(5px, 0.8vh, 16px);
      }
      .typing-panel #stats{
        gap: clamp(16px, min(4.2vw, 3.6vh), 54px);
      }
      #wpm, #accuracy{
        font-size: clamp(20px, min(3.6vw, 3.6vh), 44px);
      }
      #timerDisplay{
        padding-left: clamp(10px, 3vw, 24px);
      }
    }

    @media (max-width: 640px), (max-height: 580px){
      .typing-panel #typingHud,
      .typing-panel .typing-hud{
        top: clamp(56px, 12vh, 190px);
        width: clamp(180px, min(64vw, 44vh), 320px);
        gap: clamp(4px, 0.7vh, 12px);
      }
      .typing-panel #stats{
        gap: clamp(14px, min(3.6vw, 3.2vh), 44px);
      }
      #wpm, #accuracy{
        font-size: clamp(18px, min(3.2vw, 3.2vh), 36px);
      }
      #wpm::before, #accuracy::before{
        font-size: clamp(11px, min(2vw, 1.9vh), 13px);
      }
      #wordProgress{
        height: clamp(9px, min(1.8vw, 1.8vh), 20px);
      }
      #timerDisplay{
        padding-left: clamp(8px, 3vw, 22px);
      }
    }

    @media (max-width: 480px), (max-height: 460px){
      .typing-panel #typingHud,
      .typing-panel .typing-hud{
        top: clamp(46px, 11vh, 150px);
        width: clamp(170px, min(78vw, 40vh), 300px);
      }
      .typing-panel #stats{
        gap: clamp(12px, min(3.2vw, 2.8vh), 34px);
      }
      #wpm, #accuracy{
        font-size: clamp(16px, min(2.8vw, 2.8vh), 32px);
      }
      #wpm::before, #accuracy::before{
        font-size: clamp(10px, min(1.8vw, 1.6vh), 12px);
      }
      #wordProgress{
        height: clamp(8px, min(1.6vw, 1.4vh), 16px);
      }
      #timerDisplay{
        padding-left: clamp(7px, 3.5vw, 18px);
      }
    }

    @media (max-width: 360px), (max-height: 400px){
      .typing-panel #typingHud,
      .typing-panel .typing-hud{
        top: clamp(40px, 10vh, 138px);
        width: clamp(160px, min(84vw, 36vh), 280px);
      }
      .typing-panel #stats{
        gap: clamp(10px, min(2.8vw, 2.4vh), 28px);
      }
      #wpm, #accuracy{
        font-size: clamp(15px, min(2.4vw, 2.4vh), 28px);
      }
      #wpm::before, #accuracy::before{
        font-size: clamp(9px, min(1.6vw, 1.4vh), 11px);
      }
      #wordProgress{
        height: clamp(7px, min(1.4vw, 1.2vh), 14px);
      }
      #timerDisplay{
        padding-left: clamp(6px, 4vw, 14px);
      }
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
