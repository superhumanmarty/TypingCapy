// js/certificate.js
// CERTIFICATE button -> asks for name -> generates a polished PDF
// Requires: window.jspdf.jsPDF and window.html2canvas (loaded via CDN)

import { chars } from './engine.js';

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
    border: 1px solid rgba(255,255,255,.16);
    background: var(--accent, var(--primary, #1f63ff));
    color: #fff;
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
  /* Keep spacing consistent in the results actions row */
  .results-actions #downloadCertificateButton.certificate-btn { margin-left: .5rem; }
  #downloadCertificateButton.certificate-btn .icon { font-size: 1.05rem; opacity: .95; }
  @media (max-width: 520px) {
    /* Allow it to stretch and look good on narrow screens */
    #downloadCertificateButton.certificate-btn { width: 100%; justify-content: center; }
    .results-actions #downloadCertificateButton.certificate-btn { margin-left: 0; margin-top: .5rem; }
  }
  /* Floating fallback positioning */
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

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const M = 56;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const maxW = pageW - 2 * M;
  let y = M;

  // Title with name (colored)
  doc.setFont('times', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(0, 0, 0);
  doc.text('Certificate of Typing Performance for', pageW / 2, y, { align: 'center' });
  y += 26;

  doc.setFontSize(26);
  doc.setTextColor(31, 99, 255);
  doc.text(fullName || 'Typist', pageW / 2, y, { align: 'center' });
  y += 12;
  doc.setDrawColor(180);
  doc.line(M, y, pageW - M, y);
  y += 24;

  // Issued on (US 12-hour time)
  doc.setFont('times', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text(`Issued on ${formatDateTimeUS()}`, pageW / 2, y, { align: 'center' });
  y += 28;

  // Final WPM / Accuracy row
  const finalWpm = readFinalWpm();
  const finalAcc = readFinalAccuracy();
  doc.setFont('times', 'bold');
  doc.setFontSize(16);
  const resText = [
    `Final WPM: ${Number.isFinite(finalWpm) ? finalWpm : '—'}`,
    `Accuracy: ${Number.isFinite(finalAcc) ? `${finalAcc}%` : '—'}`
  ].join('    |    ');
  doc.text(resText, pageW / 2, y, { align: 'center' });
  y += 24;

  // Active Settings (chips already filtered to only “on” things)
  const chips = getActiveSettingsChips();
  if (chips.length) {
    doc.setFont('times', 'bold'); doc.setFontSize(14); doc.text('Active Settings', M, y); y += 14;
    doc.setFont('times', 'normal'); doc.setFontSize(11);
    const colW = maxW >= 500 ? maxW / 2 : maxW;
    let colX = M, colY = y;
    const perCol = Math.ceil(chips.length / (colW === maxW ? 1 : 2));
    chips.forEach((label, i) => {
      const idx = i % perCol;
      if (i && idx === 0) { colX = M + colW + 18; colY = y; }
      if (colY + 16 > pageH - M) { doc.addPage(); colY = M; }
      doc.text(`• ${label}`, colX, colY);
      colY += 16;
    });
    y = Math.max(colY, y) + 8;
  }

  // Footer rule
  doc.setDrawColor(180);
  doc.line(M, pageH - M, pageW - M, pageH - M);

  // Save
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
    box-sizing: border-box;          /* <— fixes the overflow */
    padding: 14px 16px;
    border-radius: 12px;
    background: #0b1220;
    color: #fff;
    border: 1px solid rgba(255,255,255,.18);
    outline: none;
    font-size: 1rem;
    -webkit-appearance: none;        /* Safari: consistent sizing */
    box-shadow: inset 0 0 0 1px rgba(255,255,255,.04);
  }

  .capy-cert-input:focus {
    border-color: var(--accent, var(--primary, #1f63ff));
    box-shadow: 0 0 0 3px rgba(31,99,255,.25);
  }
  .capy-cert-input.invalid {
    border-color: #f75f5f;
    box-shadow: 0 0 0 3px rgba(247,95,95,.25);
  }

  .capy-cert-actions {
    display: flex; gap: .5rem; justify-content: flex-end; margin-top: 14px;
  }

  /* buttons (fallback styles in case your global .btn styles aren’t present) */
  .capy-btn {
    display: inline-flex; align-items: center; justify-content: center;
    padding: 10px 14px; border-radius: 9999px; border: 1px solid rgba(255,255,255,.16);
    background: rgba(255,255,255,.06); color: #fff; font-weight: 700; cursor: pointer;
  }
  .capy-btn:focus { outline: none; box-shadow: 0 0 0 3px rgba(255,255,255,.15); }
  .capy-btn.primary {
    background: var(--accent, var(--primary, #1f63ff));
    box-shadow: 0 6px 18px rgba(0,0,0,.25), inset 0 0 0 1px rgba(255,255,255,.06);
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
      const fullName = await askNameForCertificate();
      if (!fullName) return;
      await generateCertificate(fullName);
      if (!fullName) return;
      await generateCertificate(fullName);
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
      const fullName = await askNameForCertificate();
      if (!fullName) return;
      await generateCertificate(fullName);
      if (!fullName) return;
      await generateCertificate(fullName);
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

