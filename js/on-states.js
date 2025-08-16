// js/on-states.js

// Safety: if a threshold edit class somehow stuck around, clear it on boot
document.addEventListener('DOMContentLoaded', () => {
  document.body.classList.remove(
    'editing-threshold',
    'editing-wpm',
    'editing-err',
    'editing-ghost'
  );
});

(function(){
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  /* --- Limits hero — light the chosen card (after classes flip) --- */
  $$('#limitsHero .limit-cell').forEach(cell => {
    const btn = cell.querySelector('.limit-btn');
    if (!btn) return;

    const paint = () => {
      cell.classList.toggle('is-on',
        btn.classList.contains('active') || btn.classList.contains('show-dropdown')
      );
    };

    // Paint after any click in the limits hero (post class toggles)
    cell.addEventListener('click', () => setTimeout(paint, 0));

    // Also react to programmatic class changes
    new MutationObserver(paint).observe(btn, { attributes: true, attributeFilter: ['class'] });

    paint();
  });

  /* --- Split pills — mirror half state on the container (after toggles) --- */
  $$('.split-pill').forEach(sp => {
    const paint = () => sp.classList.toggle('is-on', !!sp.querySelector('.split-half.is-on'));

    sp.addEventListener('click', () => setTimeout(paint, 0));

    // Watch both halves for class flips
    sp.querySelectorAll('.split-half').forEach(half => {
      new MutationObserver(paint).observe(half, { attributes: true, attributeFilter: ['class'] });
    });

    paint();
  });


  /* --- Checkbox-driven pills (ghost/typed-errors/thresholds/keyboard) --- */
  [
    ['#typedErrorsPill','input[type="checkbox"]'],
    ['#ghostCursorSettings','input[type="checkbox"]'],
    ['#minWPMSettings','input[type="checkbox"]'],
    ['#maxErrorsSettings','input[type="checkbox"]'],
    ['.keyboard-pill','input[type="checkbox"]'],
  ].forEach(([rootSel, inputSel])=>{
    document.querySelectorAll(rootSel).forEach(root=>{
      const inp = root.querySelector(inputSel);
      if (!inp) return;
      const paint = () => root.classList.toggle('is-on', inp.checked);
      inp.addEventListener('change', paint);
      paint();
    });
  });

  /* --- Hide / Highlight big pills — on when not “Off” ------------------ */
  function updateModePill(pillSel, labelSel){
    document.querySelectorAll(pillSel).forEach(pill=>{
      const label = pill.querySelector(labelSel);
      const text  = (label?.textContent || "").trim().toLowerCase();
      const isOn  = !!text && text !== 'off'; // must be non-empty AND not "off"
      pill.classList.toggle('is-on', isOn);
    });
  }

  const hideLbl = document.querySelector('#hideChoiceLabel');
  const highLbl = document.querySelector('#highlightChoiceLabel');
  if (hideLbl) new MutationObserver(()=>paintHide())
    .observe(hideLbl, {childList:true, characterData:true, subtree:true});
  if (highLbl) new MutationObserver(()=>paintHigh())
    .observe(highLbl, {childList:true, characterData:true, subtree:true});


  const paintHide = ()=> updateModePill('#hidePill', '#hideChoiceLabel');
  const paintHigh = ()=> updateModePill('#highlightPill', '#highlightChoiceLabel');
  paintHide(); paintHigh();
  /* refresh after any interaction with those controls */
  document.addEventListener('click', e=>{
    if (e.target.closest('#hideOptions, #highlightOptions, #hidePill, #highlightPill')) {
      setTimeout(()=>{ paintHide(); paintHigh(); }, 0);
    }
  });
})();