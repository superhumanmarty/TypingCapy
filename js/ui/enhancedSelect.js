// js/ui/enhancedSelect.js


export function enhancePillSelects(selectors = []) {
  const els = selectors.length
    ? selectors.map(id => document.getElementById(id)).filter(Boolean)
    : Array.from(document.querySelectorAll('.select-pill > select.ui-select'));

  els.forEach(enhanceOne);
}

function ensureSelection(select){
  if (select.selectedIndex >= 0 && select.options[select.selectedIndex]) return;

  const id = select.id || '';
  const lc = s => String(s||'').toLowerCase();

  // per-ID defaults
  const preferVals =
    id === 'languageSelector'     ? ['eng', 'en', 'en-us', 'english'] :
    id === 'wordListSizeSelector' ? ['500'] :
    [];

  const opts = Array.from(select.options);
  const byVal  = opts.find(o => preferVals.includes(lc(o.value)));
  const byText = opts.find(o => preferVals.some(p => lc(o.textContent).includes(p)));

  const choice = byVal || byText || opts[0];
  if (choice) {
    choice.selected = true;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

function enhanceOne(select){
  const wrap = select.closest('.select-pill');
  if (!wrap || wrap.classList.contains('enhanced')) return;

  const portalRoot = wrap.closest('.settings-panel') || document.body;

  wrap.classList.add('enhanced');

  // Button (shows current label)
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'pill-select-btn';
  btn.setAttribute('aria-haspopup', 'listbox');
  btn.setAttribute('aria-expanded', 'false');
  btn.textContent = currentLabel(select);
  wrap.appendChild(btn);

  // Menu
  const menu = document.createElement('div');
  menu.className = 'pill-select-menu';
  menu.setAttribute('role', 'listbox');
  wrap.appendChild(menu);

  // Build options
  let options = [];
  function rebuild(){
    menu.innerHTML = '';
    options = Array.from(select.options).map((opt, i) => {
      const div = document.createElement('div');
      div.className = 'pill-option';
      div.setAttribute('role', 'option');
      div.dataset.value = opt.value;
      div.textContent = opt.textContent;
      if (opt.disabled) div.setAttribute('aria-disabled','true');
      if (opt.selected) div.classList.add('is-selected');
      div.addEventListener('click', () => choose(i));
      menu.appendChild(div);
      return div;
    });
  }
  rebuild();

  // pick a sensible default if nothing is selected yet
  ensureSelection(select);

  const mo = new MutationObserver(() => {
    rebuild();
    ensureSelection(select);
    btn.textContent = currentLabel(select);
  });
  mo.observe(select, { childList: true, subtree: true });

  // hover should also move the active highlight
  menu.addEventListener('mousemove', (e) => {
    const el = e.target.closest('.pill-option');
    if (!el) return;
    const i = options.indexOf(el);
    if (i >= 0) {
      activeIndex = i;
      setActiveVisual(i);
    }
  });


  // --- positioning helper + listener holder (ADD THIS) ---
  function placeMenu(forceUp = false){
    const panel    = portalRoot;                         // .settings-panel
    const rootRect = panel.getBoundingClientRect();
    const rect     = wrap.getBoundingClientRect();
    const gutter   = 8;

    // Position within the panel’s own coordinate space (account for scroll)
    const itemLeft   = panel.scrollLeft + (rect.left - rootRect.left);
    const itemTop    = panel.scrollTop  + (rect.top  - rootRect.top);
    const itemBottom = itemTop + rect.height;

    // Visible region of the panel
    const visibleTop    = panel.scrollTop;
    const visibleBottom = panel.scrollTop + panel.clientHeight;

    // Space that’s actually visible above/below the button
    const spaceAbove = (itemTop    - visibleTop)    - gutter;
    const spaceBelow = (visibleBottom - itemBottom) - gutter;

    // Width clamped to panel
    const maxW = Math.min(rect.width, rootRect.width - 16);
    const left = Math.min(itemLeft, panel.scrollLeft + rootRect.width - maxW - 8);

    // Decide direction
    const openUp = forceUp || (spaceBelow < 220 && spaceAbove > spaceBelow);

    // Apply base geometry
    menu.style.position  = 'absolute';
    menu.style.left      = Math.round(left) + 'px';
    menu.style.width     = Math.round(maxW) + 'px';
    menu.style.bottom    = '';
    // Constrain height to available visible space (with a floor)
    const maxH = Math.max(140, Math.min(360, openUp ? spaceAbove : spaceBelow));
    menu.style.maxHeight = Math.round(maxH) + 'px';

    // Measure actual height (after maxHeight applied)
    const menuH = Math.min(menu.scrollHeight, maxH);

    // Final top position
    const top = openUp
      ? Math.round(itemTop - menuH - gutter)
      : Math.round(itemBottom + gutter);

    menu.style.top = top + 'px';
    menu.dataset.side = openUp ? 'up' : 'down';
  }


  let onWinMove = null;


  function open(){
    // Render menu inside the scrolling settings panel
    portalRoot.appendChild(menu);
    menu.style.position = 'absolute';

    wrap.classList.add('open');
    btn.setAttribute('aria-expanded','true');

    // 1) position first (so the menu has a real size AND side hint)
    placeMenu();

    // 1.5) commit the closed CSS state before we flip to open
    // (forces a style/layout flush so the transition will play)
    void menu.offsetWidth; // <— keep this exact line

    // 2) now set/center the active item WITHOUT scrolling the panel
    activeIndex = Math.max(0, select.selectedIndex);
    setActiveVisual(activeIndex, /*center=*/true);

    // finally open (CSS will animate opacity/transform)
    menu.classList.add('is-open');

    // keep position updated while user scrolls/resizes
    onWinMove = () => placeMenu(menu.dataset.side === 'up');
    window.addEventListener('scroll', onWinMove, true);
    portalRoot.addEventListener('scroll', onWinMove, true);
    window.addEventListener('resize', onWinMove, true);

    document.addEventListener('pointerdown', onDocDown, true);
    document.addEventListener('keydown', onKeyDown, true);
  }



  function close({ refocus = false } = {}) {
    wrap.classList.remove('open');
    btn.setAttribute('aria-expanded','false');

    // start reverse animation
    menu.classList.remove('is-open');

    // after the transition, put the menu back inside its wrapper
    const onDone = (ev) => {
      if (ev && ev.target !== menu) return;  // ignore bubbled transitions
      menu.removeEventListener('transitionend', onDone);
      if (menu.parentNode !== wrap) wrap.appendChild(menu);
    };

    // If there's no transition (e.g., reduced motion), re-parent immediately
    const dur = getComputedStyle(menu).transitionDuration;
    if (!dur || dur === '0s' || dur === '0ms') {
      if (menu.parentNode !== wrap) wrap.appendChild(menu);
    } else {
      menu.addEventListener('transitionend', onDone);
    }

    document.removeEventListener('pointerdown', onDocDown, true);
    document.removeEventListener('keydown', onKeyDown, true);
    if (onWinMove){
      window.removeEventListener('scroll', onWinMove, true);
      window.removeEventListener('resize', onWinMove, true);
      portalRoot.removeEventListener('scroll', onWinMove, true);
      onWinMove = null;
    }

    // return focus to the game if we closed via pill/ESC
    if (refocus) {
      setTimeout(() => {
        if (!document.body.classList.contains('editing-threshold')) {
          btn.blur?.();
          document.body.focus({ preventScroll: true });
        }
      }, 0);
    }
  }



  function toggle(){
    wrap.classList.contains('open') ? close({ refocus: true }) : open();
  }


  function choose(i){
    if (i < 0 || i >= select.options.length) return;
    select.selectedIndex = i;
    btn.textContent = currentLabel(select);
    // update selected styles
    options.forEach(o => o.classList.remove('is-selected'));
    options[i]?.classList.add('is-selected');
    // bubble a normal change event so your code keeps working
    select.dispatchEvent(new Event('change', { bubbles: true }));
    close();
    btn.focus();
  }

  let activeIndex = Math.max(0, select.selectedIndex);
  function setActiveVisual(i, center = false){
    options.forEach(o => o.classList.remove('is-active'));
    const el = options[i];
    if (!el) return;

    el.classList.add('is-active');

    // Ensure the option is visible INSIDE the menu only (no panel scrolling)
    const m = menu;
    const top = el.offsetTop;
    const bottom = top + el.offsetHeight;
    const viewTop = m.scrollTop;
    const viewBottom = viewTop + m.clientHeight;
    const pad = 6;

    if (center) {
      // center on first open
      m.scrollTop = Math.max(0, top - Math.max(0, (m.clientHeight - el.offsetHeight)/2));
    } else if (top < viewTop + pad) {
      m.scrollTop = Math.max(0, top - pad);
    } else if (bottom > viewBottom - pad) {
      m.scrollTop = Math.min(
        m.scrollHeight - m.clientHeight,
        bottom - m.clientHeight + pad
      );
    }
  }


  function onDocDown(e){
    // Don’t close when clicking inside the (portaled) menu 
    if (!wrap.contains(e.target) && !menu.contains(e.target)) close();
  }

  function onKeyDown(e){
    if (!wrap.classList.contains('open')) return;

    // Any real typing key (single char) or Backspace should start the game
    const isTypingKey =
      (e.key.length === 1 && !e.altKey && !e.ctrlKey && !e.metaKey) ||
      e.key === 'Backspace';

    if (isTypingKey){
      // Capture original info BEFORE we close/focus
      const forwarded = {
        key:     e.key,
        code:    e.code,
        keyCode: e.keyCode || e.which || 0,
        which:   e.which || e.keyCode || 0
      };

      // Stop the original event from dying on the button/select
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      // Close the menu and hand focus back to the game
      close();
      // Re-focus without scrolling the panel
      document.body.focus({ preventScroll: true });

      // Re-emit the SAME key so the game treats it as the first input
      setTimeout(() => {
        const ev = new KeyboardEvent('keydown', {
          key: forwarded.key,
          code: forwarded.code,
          bubbles: true,
          cancelable: true
        });
        // Ensure legacy properties are available for handlers that read them
        try {
          Object.defineProperty(ev, 'keyCode', { get: () => forwarded.keyCode });
          Object.defineProperty(ev, 'which',   { get: () => forwarded.which });
        } catch(_) {}
        document.dispatchEvent(ev);
      }, 0);

      return;
    }

    // Keep nav/selection keys controlling the menu
    if (['ArrowDown','ArrowUp','Home','End','Enter','Escape',' '].includes(e.key)){
      e.preventDefault();
      if (e.key === 'ArrowDown') activeIndex = Math.min(options.length - 1, activeIndex + 1);
      if (e.key === 'ArrowUp')   activeIndex = Math.max(0, activeIndex - 1);
      if (e.key === 'Home')      activeIndex = 0;
      if (e.key === 'End')       activeIndex = options.length - 1;
      if (e.key === 'Enter' || e.key === ' ') choose(activeIndex);
      if (e.key === 'Escape') close({ refocus: true });
      setActiveVisual(activeIndex);
    }
  }



  btn.addEventListener('click', toggle);
  btn.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === ' ' || e.key === 'Enter'){
      e.preventDefault(); open();
    }
  });

  // Keep button label in sync if the native select changes programmatically
  select.addEventListener('change', () => {
    btn.textContent = currentLabel(select);
    // refresh selected style
    options.forEach(o => o.classList.remove('is-selected'));
    const idx = Math.max(0, select.selectedIndex);
    options[idx]?.classList.add('is-selected');
  });

  // If options are ever mutated dynamically, call rebuild()
  // (You can expose wrap.rebuild = rebuild if you need it.)
}

function currentLabel(select){
  const opt = select.options[select.selectedIndex];
  if (opt) return opt.textContent.trim();
  if (select.options.length) return select.options[0].textContent.trim();
  return 'Select';
}
