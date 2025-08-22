// js/certificate.js
// CERTIFICATE button -> asks for name -> generates a polished PDF
// Requires: window.jspdf.jsPDF and window.html2canvas (loaded via CDN)

import { chars } from './engine.js';

let _certGenerating = false;

// ---------- small helpers ----------

function readFinalWpm() {
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

function readFinalAccuracy() {
  const rs = document.getElementById('resultsScreen');
  if (!rs) return null;
  const el =
    rs.querySelector('[data-final-accuracy]') ||
    rs.querySelector('#finalAccuracyValue, #finalAccuracy, .final-accuracy .value, .result-accuracy .value');
  if (el) {
    const n = parseFloat((el.textContent || '').replace(/[^\d.]/g, ''));
    if (Number.isFinite(n)) return n;
  }
  const m = (rs.textContent || '').match(/Final\s*Accuracy:\s*(\d+(?:\.\d+)?)\s*%/i);
  return m ? parseFloat(m[1]) : null;
}

function getActiveSettingsChips() {
  return [...document.querySelectorAll('#runSettings .badge')]
    .map(n => n.textContent.trim())
    .filter(Boolean);
}

async function captureElement(el, scale = 2) {
  if (!el) return null;
  const canvas = await window.html2canvas(el, {
    scale,
    backgroundColor: '#FFFFFF',
    useCORS: true,
    logging: false
  });
  return canvas;
}

function addCanvasMultiPage(doc, canvas, x, y, maxWidth, margin) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const scale = maxWidth / canvas.width;

  const totalH = canvas.height * scale;
  if (y + totalH <= pageH - margin) {
    const img = canvas.toDataURL('image/png');
    doc.addImage(img, 'PNG', x, y, canvas.width * scale, totalH);
    return y + totalH;
  }

  // slice across pages
  const temp = document.createElement('canvas');
  temp.width = canvas.width;
  const tctx = temp.getContext('2d');

  let srcY = 0;
  let remaining = canvas.height;
  let curY = y;
  const slicePx = Math.floor((pageH - y - margin) / scale) || canvas.height;

  while (remaining > 0) {
    const take = Math.min(remaining, slicePx);
    temp.height = take;
    tctx.clearRect(0, 0, temp.width, temp.height);
    tctx.drawImage(canvas, 0, srcY, canvas.width, take, 0, 0, temp.width, temp.height);

    const img = temp.toDataURL('image/png');
    const drawH = take * scale;

    if (curY + drawH > pageH - margin) { doc.addPage(); curY = margin; }
    doc.addImage(img, 'PNG', x, curY, canvas.width * scale, drawH);

    curY += drawH;
    srcY += take;
    remaining -= take;

    if (remaining > 0) { doc.addPage(); curY = margin; }
  }
  return curY;
}

function formatDateTimeUS() {
  const d = new Date();
  const date = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${date} at ${time}`;
}

function sanitizeFilePart(s) {
  return (s || 'typist').replace(/[^\w\-]+/g, '_').slice(0, 40);
}

// --- styles for the CERTIFICATE button ---
function ensureCertificateButtonStyles() {
  if (document.getElementById('certificate-btn-style')) return;
  const s = document.createElement('style');
  s.id = 'certificate-btn-style';
  s.textContent = `
  /* Make the CERTIFICATE button a big pill and match theme */
  #downloadCertificateButton.certificate-btn {
    display: inline-flex;
    align-items: center;
    gap: .55rem;
    padding: 12px 18px;
    border-radius: 9999px;
    font-weight: 700;
    letter-spacing: .02em;
    line-height: 1;
    /* derive from theme; slightly darkened so white text always pops */
    background:
      linear-gradient(rgba(0,0,0,.32), rgba(0,0,0,.32)),
      var(--action-accent, #1f63ff);
    color: var(--action-contrast, #fff);
    border: 1px solid color-mix(in srgb, var(--action-accent, #1f63ff) 70%, transparent);
    box-shadow: 0 6px 18px rgba(0,0,0,.25), inset 0 0 0 1px rgba(255,255,255,.06);
    transition: transform .06s ease, box-shadow .12s ease, filter .12s ease;
  }
  #downloadCertificateButton.certificate-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 22px rgba(0,0,0,.28), inset 0 0 0 1px rgba(255,255,255,.08);
    filter: brightness(1.02);
  }
  #downloadCertificateButton.certificate-btn:active {
    transform: translateY(0);
    box-shadow: 0 4px 14px rgba(0,0,0,.22), inset 0 0 0 1px rgba(255,255,255,.04);
  }
  #downloadCertificateButton.certificate-btn:focus {
    outline: none;
    box-shadow:
      0 0 0 3px var(--action-ring, rgba(31,99,255,.35)),
      0 6px 18px rgba(0,0,0,.25),
      inset 0 0 0 1px rgba(255,255,255,.06);
  }

  /* Keep spacing consistent in the results actions row */
  .results-actions #downloadCertificateButton.certificate-btn { margin-left: .5rem; }
  #downloadCertificateButton.certificate-btn .icon { font-size: 1.05rem; opacity: .95; }

  @media (max-width: 520px) {
    /* Allow it to stretch and look good on narrow screens */
    #downloadCertificateButton.certificate-btn { width: 100%; justify-content: center; }
    .results-actions #downloadCertificateButton.certificate-btn { margin-left: 0; margin-top: .5rem; }
  }

  /* Floating fallback positioning (same accent) */
  #downloadCertificateButton.certificate-fab {
    position: fixed;
    right: 16px;
    bottom: 16px;
    z-index: 99999;
  }
  `;
  document.head.appendChild(s);
}



// Tries the explicit tag first, then common ids/classes, then a heading fallback.
function findTargetSection(rs) {
  if (!rs) return null;

  // 0) Preferred: the tag set in main.js (tagTargetTextBoxForCertificate)
  const tagged = rs.querySelector('[data-cert-capture="target"]');
  if (tagged) return tagged;

  // 1) Direct IDs/classes (in case the tag isn’t present for some reason)
  const selectors = [
    '#supposedText',
    '[data-target-text]',
    '#resultsTargetText',
    '#targetTextBlock',
    '#targetText',
    '#targetTextBox',
    '#targetTextDisplay',
    '.target-text',
    '.targetText',
    '.target-words',
    '.results-target'
  ];
  for (const sel of selectors) {
    const el = rs.querySelector(sel);
    if (el) return el;
  }

  // 2) Heading “Target Text” → use the next visible block / container
  const heading = [...rs.querySelectorAll('h1,h2,h3,h4,h5,h6,.section-title,.title')]
    .find(el => /target\s*text/i.test(el.textContent || ''));
  if (!heading) return null;

  let sib = heading.nextElementSibling;
  while (sib && (sib.offsetHeight < 20 || getComputedStyle(sib).display === 'none')) {
    sib = sib.nextElementSibling;
  }
  if (sib) return sib.closest('.section, .card, .panel, .block, .group, .box') || sib;

  return heading.closest('.section, .card, .panel, .block, .group, .box') || heading.parentElement;
}



// ---------- generator ----------

export async function generateCertificate(fullName) {
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF || !window.html2canvas) {
    alert('PDF tools failed to load. Make sure jsPDF and html2canvas are included.');
    return;
  }

  // Fonts for the HTML->canvas render
  ensureInterFontLinked();
  ensureSignatureFontLinked();
  try {
    if (document.fonts && document.fonts.load) {
      await Promise.allSettled([
        document.fonts.load('400 16px Inter'),
        document.fonts.load('800 16px Inter'),
        document.fonts.load('400 32px "Great Vibes"')
      ]);
      await document.fonts.ready;
    }
  } catch (_) {}

  // Landscape A4
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const finalWpm = readFinalWpm();
  const finalAcc = readFinalAccuracy();
  const issued   = formatDateTimeUS();
  const chips    = getActiveSettingsChips();

  // Safe text for HTML
  const esc = s => (s || '').replace(/[&<>"']/g, m => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[m]));

  // Hidden, pixel-perfect frame that matches the PDF size
  const frame = document.createElement('div');
  frame.id = 'capy-cert-frame';
  frame.style.cssText = `
    position: fixed;
    left: -100000px; top: 0;
    width: ${pageW}px; height: ${pageH}px;
    background: #ffffff;
    display: flex; align-items: center; justify-content: center;
  `;

  // Inline CSS just for this frame
  const style = document.createElement('style');
  style.textContent = `
    #capy-cert-frame, #capy-cert-frame * { box-sizing: border-box; }

    .capy-cert-wrap {
      position: relative;
      width: calc(100% - 96px);
      height: calc(100% - 96px);
      /* ⬇⬇ extra bottom padding to make room for the settings row */
      padding: 28px 36px 88px;
      margin: 0 auto;
      border: 2px solid #e2e2e2;
      border-radius: 18px;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      text-align: center;
      background:
        radial-gradient(1200px 600px at 50% -200px, #f7fafc 0%, transparent 60%),
        #fff;
      font-family: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
      color: #111;
      gap: 8pt;
    }

    .capy-logo {
      position: absolute;
      top: 16pt;
      left: 16pt;
      width: 72pt;
      height: auto;
      opacity: .95;
    }

    .capy-title {
      font-weight: 800;
      font-size: 30pt;
      letter-spacing: .5px;
      margin-bottom: 4pt;
    }

    .capy-sub {
      font-size: 14pt;
      opacity: .85;
      margin-bottom: 6pt;
    }

    .capy-name {
      font-family: "Great Vibes", "Inter", cursive;
      font-size: 62pt;
      line-height: 1;
      color: #000;            /* black as requested */
      font-weight: 800;       /* some script fonts ignore weight, but we keep it */
      margin: 6pt 0 2pt 0;
      text-shadow: 0 0 0.01px #000;
    }

    .capy-metrics {
      font-size: 16pt;
      font-weight: 700;
      opacity: .95;
      margin-top: 2pt;
    }

    .capy-issued {
      font-size: 12pt;
      opacity: .75;
      margin-top: 10pt;
    }

    .capy-rule {
      width: min(55%, 640px);
      height: 0;
      border-top: 2px solid #cfcfcf;
      margin: 10pt auto 12pt;
    }

    .capy-frame-rule {
      position: absolute;
      inset: 14px;
      border: 1px solid #efefef;
      border-radius: 14px;
      pointer-events: none;
    }

    /* centered bottom settings, small & subtle */
    .capy-settings {
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      bottom: 12pt;
      max-width: 80%;
      text-align: center;
      font-size: 9pt;
      line-height: 1.3;
      color: #6b7280; /* slate-500 */
      padding: 0 6pt;
      word-break: break-word;
    }
  `;
  frame.appendChild(style);

  // Content HTML
  const nameText = esc(fullName || 'Typist');
  const wpmText  = Number.isFinite(finalWpm) ? finalWpm : '—';
  const accText  = Number.isFinite(finalAcc) ? `${finalAcc}%` : '—';

  // settings line (no title, centered)
  const settingsBlock = chips.length
    ? `<div class="capy-settings">${esc(chips.join(' · '))}</div>`
    : '';

  frame.insertAdjacentHTML('beforeend', `
    <div class="capy-cert-wrap">
      <img class="capy-logo" src="logo.png" alt="Logo">
      <div class="capy-frame-rule"></div>

      <div class="capy-title">Certificate of Typing Performance</div>
      <div class="capy-sub">This certifies that</div>

      <div class="capy-name">${nameText}</div>

      <div class="capy-sub">has achieved</div>
      <div class="capy-rule"></div>

      <div class="capy-metrics">Final WPM: ${wpmText} &nbsp; • &nbsp; Accuracy: ${accText}</div>
      <div class="capy-issued">Issued on ${esc(issued)}</div>

      ${settingsBlock}
    </div>
  `);

  document.body.appendChild(frame);

  // Snapshot the HTML cert so web fonts show up correctly
  const canvas = await window.html2canvas(frame, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#FFFFFF',
    logging: false
  });

  // Clean up the DOM copy
  frame.remove();

  // Drop the image into the PDF full-bleed
  const img = canvas.toDataURL('image/png');
  doc.addImage(img, 'PNG', 0, 0, pageW, pageH);

  const fn = `typing-certificate-${sanitizeFilePart(fullName)}.pdf`;
  doc.save(fn);
}



// Also put it on window as a safety rope for inline callers
window.capyGenerateCertificate = generateCertificate;

function ensureInterFontLinked() {
  if (document.getElementById('capy-inter-font')) return;
  const link = document.createElement('link');
  link.id = 'capy-inter-font';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap';
  document.head.appendChild(link);
}

function ensureSignatureFontLinked() {
  if (document.getElementById('capy-signature-font')) return;
  const link = document.createElement('link');
  link.id = 'capy-signature-font';
  link.rel = 'stylesheet';
  // Great Vibes = elegant signature vibe; falls back to cursive if blocked
  link.href = 'https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap';
  document.head.appendChild(link);
}


// --- nice in-game name dialog ----------------------------------------------
function ensureCertificateNameDialogStyles() {
  ensureInterFontLinked();
  if (document.getElementById('cert-name-style')) return;
  const s = document.createElement('style');
  s.id = 'cert-name-style';
  s.textContent = `
  /* overlay */
  .capy-cert-overlay {
    position: fixed; inset: 0; z-index: 100000;
    display: flex; align-items: center; justify-content: center;
    background: rgba(0,0,0,.55);
    backdrop-filter: blur(3px);
    animation: capyFadeIn .12s ease-out;
  }
  @keyframes capyFadeIn { from { opacity: 0 } to { opacity: 1 } }

  /* use Inter for the modal message text only */
  .capy-cert-title,
  .capy-cert-help {
    font-family: "Inter", system-ui, -apple-system, "Segoe UI", Roboto,
                 "Helvetica Neue", Arial, "Noto Sans", sans-serif !important;
  }

  /* card */
  .capy-cert-card {
    width: min(520px, 92vw);
    background: var(--panel-bg, #0d1117);
    color: #fff;
    border: 1px solid rgba(255,255,255,.12);
    border-radius: 16px;
    padding: 20px 22px;
    box-shadow: 0 18px 40px rgba(0,0,0,.35), inset 0 0 0 1px rgba(255,255,255,.05);
  }
  .capy-cert-title {
    font-weight: 800; font-size: 1.05rem; margin-bottom: .5rem;
  }
  .capy-cert-help {
    opacity: .8; font-size: .9rem; margin-bottom: .9rem;
  }

  .capy-cert-input {
    display: block;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    padding: 14px 16px;
    border-radius: 12px;
    background: #0b1220;
    color: #fff;
    border: 1px solid rgba(255,255,255,.18);
    outline: none;
    font-size: 1rem;
    -webkit-appearance: none;
    box-shadow: inset 0 0 0 1px rgba(255,255,255,.04);
  }
  .capy-cert-input:focus {
    border-color: var(--action-accent, #1f63ff);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--action-accent, #1f63ff) 35%, transparent);
  }
  .capy-cert-input.invalid {
    border-color: #f75f5f;
    box-shadow: 0 0 0 3px rgba(247,95,95,.25);
  }

  .capy-cert-actions {
    display: flex; gap: .5rem; justify-content: flex-end; margin-top: 14px;
  }

  .capy-btn {
    display: inline-flex; align-items: center; justify-content: center;
    padding: 10px 14px; border-radius: 9999px; border: 1px solid rgba(255,255,255,.16);
    background: rgba(255,255,255,.06); color: #fff; font-weight: 700; cursor: pointer;
  }
  .capy-btn:focus { outline: none; box-shadow: 0 0 0 3px rgba(255,255,255,.15); }

  /* on-theme primary button */
  .capy-btn.primary {
  background:
    linear-gradient(rgba(0,0,0,.32), rgba(0,0,0,.32)),
    var(--action-accent, #1f63ff);
    border-color: color-mix(in srgb, var(--action-accent, #1f63ff) 70%, transparent);
    box-shadow: 0 6px 18px rgba(0,0,0,.25), inset 0 0 0 1px rgba(255,255,255,.06);
    color: var(--action-contrast, #fff);
  }
  .capy-btn.primary:focus {
    box-shadow:
      0 0 0 3px color-mix(in srgb, var(--action-accent, #1f63ff) 35%, transparent),
      0 6px 18px rgba(0,0,0,.25),
      inset 0 0 0 1px rgba(255,255,255,.06);
  }
  `;
  document.head.appendChild(s);
}


/** Opens a pretty modal asking for the name. Resolves string or null. */
function askNameForCertificate() {
  ensureCertificateNameDialogStyles();

  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'capy-cert-overlay';
    overlay.innerHTML = `
      <div class="capy-cert-card" role="dialog" aria-modal="true" aria-labelledby="certTitle">
        <div id="certTitle" class="capy-cert-title">Enter your first and last name</div>
        <div class="capy-cert-help">This will be printed on your certificate.</div>
        <input id="certNameInput" class="capy-cert-input" type="text" placeholder="ex: Michael Jordan" maxlength="80" />
        <div class="capy-cert-actions">
          <button class="capy-btn" id="certCancelBtn" type="button">Cancel</button>
          <button class="capy-btn primary" id="certOkBtn" type="button">Continue</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const input = overlay.querySelector('#certNameInput');
    const btnOk = overlay.querySelector('#certOkBtn');
    const btnCancel = overlay.querySelector('#certCancelBtn');

    const close = (val) => {
      overlay.remove();
      resolve(val);
    };

    const submit = () => {
      const v = (input.value || '').trim();
      if (!v) {
        input.classList.add('invalid');
        input.focus();
        return;
      }
      close(v);
    };

    btnOk.addEventListener('click', submit);
    btnCancel.addEventListener('click', () => close(null));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(null); // click outside to cancel
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
      if (e.key === 'Escape') close(null);
      if (input.classList.contains('invalid')) input.classList.remove('invalid');
    });

    // focus after paint
    setTimeout(() => { input.focus(); input.select(); }, 0);
  });
}

// ---------- button wiring ----------

export function setupCertificate() {
  if (document.getElementById('downloadCertificateButton')) return; // controller owns the button
  // load styles once
  ensureCertificateButtonStyles();

  // Find an existing results container if present (but don't depend on it)
  const findResultsRoot = () =>
    document.querySelector('#resultsScreen, .results-screen, .results, [data-results]') ||
    document.querySelector('.results-stats')?.closest('.modal,.overlay,.results,.panel,.box');

  const tagTargetGlobally = () => {
    const el = document.querySelector(
      '[data-cert-capture="target"], ' +
      '[data-target-text], ' +
      '#resultsTargetText, #targetTextBlock, #targetText, #targetTextDisplay, ' +
      '.target-text, .targetText, .target-words, .results-target'
    );
    if (el && !el.hasAttribute('data-cert-capture')) {
      el.setAttribute('data-cert-capture', 'target');
    }
  };

  // Try to inject the button inside the results panel
  const ensureInlineButtonIfPossible = () => {
    const rs = findResultsRoot();
    if (!rs) return false;
    if (rs.querySelector('#downloadCertificateButton')) return true;

    const btn = document.createElement('button');
    btn.id = 'downloadCertificateButton';
    btn.type = 'button';
    btn.className = 'btn btn-primary certificate-btn';
    btn.innerHTML = '<span class="icon" aria-hidden="true">🏅</span><span>CERTIFICATE</span>';
    btn.setAttribute('aria-label', 'Download certificate as PDF');

    (rs.querySelector('.results-actions') ||
     rs.querySelector('.results-buttons') ||
     rs.querySelector('.results-stats')?.parentElement ||
     rs
    ).appendChild(btn);

    btn.addEventListener('click', async () => {
      if (_certGenerating) return;           // prevent double-fires
      _certGenerating = true;
      try {
        const fullName = await askNameForCertificate();
        if (!fullName) return;
        await generateCertificate(fullName); // called once
      } finally {
        _certGenerating = false;
      }
    });


    tagTargetGlobally();
    return true;
  };

  // Floating fallback button if we can't place inline
  const ensureFloatingButton = () => {
    if (document.getElementById('downloadCertificateButton')) return;

    const btn = document.createElement('button');
    btn.id = 'downloadCertificateButton';
    btn.type = 'button';
    btn.className = 'btn btn-primary certificate-btn certificate-fab';
    btn.innerHTML = '<span class="icon" aria-hidden="true">🏅</span><span>CERTIFICATE</span>';
    btn.setAttribute('aria-label', 'Download certificate as PDF');

    document.body.appendChild(btn);

    btn.addEventListener('click', async () => {
      if (_certGenerating) return;           // prevent double-fires
      _certGenerating = true;
      try {
        const fullName = await askNameForCertificate();
        if (!fullName) return;
        await generateCertificate(fullName); // called once
      } finally {
        _certGenerating = false;
      }
    });


    tagTargetGlobally();
  };

  // Try to place inline; otherwise show a floating FAB when the run ends
  const tryWire = () => {
    if (!ensureInlineButtonIfPossible()) {
      if (document.body.classList.contains('game-ended')) {
        ensureFloatingButton();
      }
    }
  };

  // Run now…
  tryWire();

  // …when results paint / time’s up…
  window.addEventListener('capy:resultsPainted', tryWire);
  window.addEventListener('capy:timeup', tryWire);

  // …and whenever body’s class changes (to catch game-ended)
  const bodyMo = new MutationObserver(tryWire);
  bodyMo.observe(document.body, { attributes: true, attributeFilter: ['class'] });

  // …and as a last resort, poll briefly.
  const iv = setInterval(tryWire, 400);
  setTimeout(() => clearInterval(iv), 10000);
}

