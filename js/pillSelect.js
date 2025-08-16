// js/pillSelect.js
// Enhanced animated dropdown for .select-pill, immune to settings-panel scroll.

const initPillSelects = () => {
  const portalTarget = document.body; // render popup into <body>

  document.querySelectorAll('.select-pill').forEach((pill) => {
    const native = pill.querySelector('select.ui-select');
    if (!native || pill.classList.contains('enhanced')) return;

    pill.classList.add('enhanced');

    // Button that mirrors the current value
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pill-select-btn';
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');

    const labelFromNative = () =>
      native.options[native.selectedIndex]?.text?.trim() || 'Select';
    btn.textContent = labelFromNative();

    // Popup menu (now fixed to the viewport, appended to <body>)
    const menu = document.createElement('div');
    menu.className = 'pill-select-menu';
    menu.setAttribute('role', 'listbox');
    menu.tabIndex = -1;

    const buildMenu = () => {
      menu.innerHTML = '';
      [...native.options].forEach((opt, idx) => {
        const item = document.createElement('div');
        item.className = 'pill-option';
        item.setAttribute('role', 'option');
        item.dataset.value = opt.value;
        item.textContent = opt.text;
        if (opt.disabled) item.setAttribute('aria-disabled', 'true');
        if (opt.selected) {
          item.classList.add('is-selected');
          item.setAttribute('aria-selected', 'true');
          item.dataset.index = idx;
        }
        item.addEventListener('click', () => selectValue(opt.value));
        menu.appendChild(item);
      });
    };

    // Choose above/below and set fixed coordinates
    const positionMenu = () => {
      const btnRect = btn.getBoundingClientRect();
      // ensure the menu has content to measure
      const maxH = parseInt(getComputedStyle(menu).maxHeight) || 320;
      const menuH = Math.min(menu.scrollHeight || 0, maxH);
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const spaceBelow = vh - btnRect.bottom;
      const spaceAbove = btnRect.top;
      const openAbove = spaceBelow < (menuH + 12) && spaceAbove > spaceBelow;

      // clamp horizontally inside viewport with 8px gutters
      const menuW = menu.offsetWidth || 280;
      const left = Math.min(Math.max(8, btnRect.left), vw - menuW - 8);

      const top = openAbove
        ? Math.max(8, btnRect.top - menuH - 6)
        : Math.min(vh - 8, btnRect.bottom + 6);

      menu.style.left = `${left}px`;
      menu.style.top = `${top}px`;
      menu.dataset.placement = openAbove ? 'top' : 'bottom';
    };

    const openMenu = () => {
      if (pill.classList.contains('open')) return;
      buildMenu();
      // add to body BEFORE measuring/positioning
      if (!menu.isConnected) portalTarget.appendChild(menu);

      positionMenu();

      pill.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
      menu.classList.add('is-open');

      // highlight current selection
      const selected = menu.querySelector('.pill-option.is-selected') || menu.firstElementChild;
      if (selected) {
        menu.querySelectorAll('.pill-option').forEach(n => n.classList.remove('is-active'));
        selected.classList.add('is-active');
        // only scroll the MENU, never ancestors
        selected.scrollIntoView({ block: 'nearest' });
      }

      document.addEventListener('click', onDocClick, true);
      window.addEventListener('resize', onResize, { passive: true });
      window.addEventListener('scroll', onScroll, true);
      document.addEventListener('keydown', onMenuKey, true); // keyboard without shifting focus
      // IMPORTANT: do NOT focus the menu (prevents settings panel auto-scroll)
    };

    const closeMenu = () => {
      if (!pill.classList.contains('open')) return;
      pill.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
      menu.classList.remove('is-open');

      document.removeEventListener('click', onDocClick, true);
      window.removeEventListener('resize', onResize, { passive: true });
      window.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('keydown', onMenuKey, true);
      btn.focus({ preventScroll: true });
    };

    const selectValue = (value) => {
      if (native.value !== value) {
        native.value = value;
        native.dispatchEvent(new Event('change', { bubbles: true }));
      }
      btn.textContent = labelFromNative();
      // update visual selection
      menu.querySelectorAll('.pill-option').forEach((n) => {
        const isSel = n.dataset.value === value;
        n.classList.toggle('is-selected', isSel);
        n.toggleAttribute('aria-selected', isSel);
      });
      closeMenu();
    };

    const onDocClick = (e) => {
      if (pill.contains(e.target) || menu.contains(e.target)) return;
      closeMenu();
    };

    const onResize = () => { if (pill.classList.contains('open')) positionMenu(); };
    const onScroll = () => { if (pill.classList.contains('open')) positionMenu(); };

    const moveActive = (dir) => {
      const items = [...menu.querySelectorAll('.pill-option:not([aria-disabled="true"])')];
      if (!items.length) return;
      let idx = items.findIndex((el) => el.classList.contains('is-active'));
      if (idx === -1) idx = items.findIndex((el) => el.classList.contains('is-selected'));
      idx = Math.max(0, idx);
      const next = items[Math.min(items.length - 1, Math.max(0, idx + dir))];
      items.forEach((el) => el.classList.remove('is-active'));
      if (next) {
        next.classList.add('is-active');
        next.scrollIntoView({ block: 'nearest' });
      }
    };

    const onMenuKey = (e) => {
      if (!pill.classList.contains('open')) return; // only when open
      switch (e.key) {
        case 'Escape': e.preventDefault(); closeMenu(); break;
        case 'ArrowDown': e.preventDefault(); moveActive(1); break;
        case 'ArrowUp': e.preventDefault(); moveActive(-1); break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          const active = menu.querySelector('.pill-option.is-active');
          if (active && !active.hasAttribute('aria-disabled'))
            selectValue(active.dataset.value);
          break;
        case 'Home':
          e.preventDefault();
          menu.querySelectorAll('.pill-option').forEach(n => n.classList.remove('is-active'));
          menu.querySelector('.pill-option')?.classList.add('is-active');
          break;
        case 'End':
          e.preventDefault();
          const all = menu.querySelectorAll('.pill-option');
          if (all.length) {
            all.forEach(n => n.classList.remove('is-active'));
            all[all.length - 1].classList.add('is-active');
          }
          break;
      }
    };

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      pill.classList.contains('open') ? closeMenu() : openMenu();
    });

    // Keep label in sync if something else changes the select
    native.addEventListener('change', () => {
      btn.textContent = labelFromNative();
    });

    // Mount button into the pill; menu is appended to <body> on first open
    pill.appendChild(btn);
  });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPillSelects);
} else {
  initPillSelects();
}
