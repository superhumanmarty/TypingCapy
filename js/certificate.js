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

// ---------- button wiring ----------

export function setupCertificate() {
  // Find an existing results container if present (but don't depend on it)
  const findResultsRoot = () =>
    document.querySelector('#resultsScreen, .results-screen, .results, [data-results]') ||
    document.querySelector('.results-stats')?.closest('.modal,.overlay,.results,.panel,.box');

  const tagTargetGlobally = () => {
    const el = document.querySelector(
      '[data-cert-capture="target"], ' + // already tagged?
      '[data-target-text], ' +
      '#resultsTargetText, #targetTextBlock, #targetText, #targetTextDisplay, ' +
      '.target-text, .targetText, .target-words, .results-target'
    );
    if (el && !el.hasAttribute('data-cert-capture')) {
      el.setAttribute('data-cert-capture', 'target');
    }
  };

  const ensureInlineButtonIfPossible = () => {
    const rs = findResultsRoot();
    if (!rs) return false;
    if (rs.querySelector('#downloadCertificateButton')) return true;

    const btn = document.createElement('button');
    btn.id = 'downloadCertificateButton';
    btn.type = 'button';
    btn.className = 'btn btn-primary certificate-btn';
    btn.textContent = 'CERTIFICATE';

    (rs.querySelector('.results-actions') ||
     rs.querySelector('.results-buttons') ||
     rs.querySelector('.results-stats')?.parentElement ||
     rs
    ).appendChild(btn);

    btn.addEventListener('click', async () => {
      const fullName = (window.prompt('Enter your first and last name for the certificate:', '') || '').trim();
      if (!fullName) return;
      await generateCertificate(fullName);
    });

    tagTargetGlobally();
    return true;
  };

  const ensureFloatingButton = () => {
    if (document.getElementById('downloadCertificateButton')) return;
    const btn = document.createElement('button');
    btn.id = 'downloadCertificateButton';
    btn.type = 'button';
    btn.textContent = 'CERTIFICATE';
    btn.setAttribute('style',
      'position:fixed;right:16px;bottom:16px;z-index:99999;padding:12px 16px;' +
      'border-radius:12px;border:none;font-weight:700;cursor:pointer;' +
      'box-shadow:0 6px 18px rgba(0,0,0,.25);background:#1f63ff;color:#fff;'
    );
    document.body.appendChild(btn);
    btn.addEventListener('click', async () => {
      const fullName = (window.prompt('Enter your first and last name for the certificate:', '') || '').trim();
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
