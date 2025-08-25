// js/ui/immerse.js
// "Immerse" pill under Theme. Toggles fullscreen and locks ESC on Chrome.

export function wireImmersePillUI({ target = document.documentElement } = {}) {
  if (document.getElementById('immersePill')) return;

  injectStyles();

  // --- create pill ---------------------------------------------------------
  const btn = document.createElement('button');
  btn.id = 'immersePill';
  btn.type = 'button';
  btn.className = 'pill option';
  btn.textContent = 'Immerse';
  btn.setAttribute('aria-pressed', 'false');

  // Place directly under THEME dropdown pill
  const themeSel  = document.getElementById('themeSelector') || document.getElementById('themeSelect');
  const themePill = themeSel?.closest('.select-pill');
  if (themePill?.parentNode) {
    themePill.parentNode.insertBefore(btn, themePill.nextSibling);
  } else {
    const after = document.getElementById('highlightPill') || document.getElementById('hidePill');
    (after?.parentNode)?.insertBefore(btn, after?.nextSibling ?? null);
  }

  // Match height to Hide pill and add a small gap below Theme
  requestAnimationFrame(() => {
    const hide = document.getElementById('hidePill');
    if (hide && hide.offsetHeight) btn.style.minHeight = hide.offsetHeight + 'px';
    btn.style.marginTop = '10px';
  });

  // --- state ---------------------------------------------------------------
  let escLocked = false;

  async function enterImmerse() {
    try {
      if (target?.requestFullscreen) {
        await target.requestFullscreen({ navigationUI: 'hide' });
      }
    } catch {}
    escLocked = await lockEscapeIfPossible();
    applyOnState(true);
  }

  async function exitImmerse() {
    if (escLocked) { try { navigator.keyboard.unlock(); } catch {} }
    escLocked = false;
    if (document.fullscreenElement) {
      try { await document.exitFullscreen(); } catch {}
    }
    applyOnState(false);
  }

  function applyOnState(on) {
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-pressed', String(on));
    document.body.classList.toggle('immersed', on);
  }

  async function lockEscapeIfPossible() {
    try {
      if (document.fullscreenElement && navigator.keyboard?.lock) {
        await navigator.keyboard.lock(['Escape']); // single-press ESC doesn’t exit FS
        return true;
      }
    } catch {}
    return false;
  }

  btn.addEventListener('click', () => {
    if (document.fullscreenElement || document.body.classList.contains('immersed')) {
      exitImmerse();
    } else {
      enterImmerse();
    }
  });

  // IMPORTANT: If fullscreen is lost for ANY reason (e.g., holding ESC),
  // immediately reflect OFF state in the pill.
  document.addEventListener('fullscreenchange', async () => {
    if (document.fullscreenElement) {
      if (!escLocked) escLocked = await lockEscapeIfPossible();
      applyOnState(true);
    } else {
      if (escLocked) { try { navigator.keyboard.unlock(); } catch {} }
      escLocked = false;
      applyOnState(false); // visually OFF so it never lies
    }
  });

  // Let your app's ESC logic run while staying fullscreen (when lock works)
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!document.body.classList.contains('immersed')) return;
    // No preventDefault here: we WANT your app’s ESC to still work.
    // Chrome will still exit FS on long-press ESC; we handle it above.
  }, { capture: true });
}

function injectStyles() {
  if (document.getElementById('immersePillCSS')) return;
  const s = document.createElement('style');
  s.id = 'immersePillCSS';
  s.textContent = `
    /* Base pill look; rely on your .pill styles + soften the edge explicitly */
    #immersePill.pill.option{
      width:100%;
      display:inline-flex;
      align-items:center;
      justify-content:center;
      font-weight:800;
      letter-spacing:.02em;

      /* Make label bigger */
      font-size: clamp(1.1rem, 1.9vw, 1.3rem);
      line-height: 1.2;

      /* spacing under Theme select */
      margin-top: 10px;

      /* ensure the softened edge from edge-soft.css is applied even if other rules win */
      border: 1px solid var(--ui-border) !important;
      box-shadow: 0 0 0 1px color-mix(in srgb, var(--ui-border) 60%, transparent) inset !important;
    }
    #immersePill.pill.option.active{
      /* loud active state like other “on” pills */
      border-color: var(--on-ring) !important;
      box-shadow: 0 0 0 2.5px var(--on-ring), 0 10px 26px var(--on-glow) !important;
    }

    /* Non-FS fallback: keep page steady */
    body.immersed:not(:fullscreen){ overflow:hidden !important; }
  `;
  document.head.appendChild(s);
}
