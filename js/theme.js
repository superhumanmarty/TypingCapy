// js/theme.js: select + color‑picker listener that sets CSS custom‑properties / themes
export function bindThemeSelectors(themeSelector, colorPickers) {
  themeSelector.addEventListener('change', e => {
    const t = e.target.value;
    document.body.className = `theme-${t}`;
    if (t !== 'choosecolors') document.body.style.backgroundImage = '';
    const st = getComputedStyle(document.body);
    colorPickers.forEach(p => {
      p.value = st.getPropertyValue(p.dataset.var).trim();
    });
  });

  colorPickers.forEach(p => {
    p.addEventListener('input', e => {
      document.documentElement.style.setProperty(p.dataset.var, e.target.value);
      document.body.style.backgroundImage = 'none';
    });
  });
}