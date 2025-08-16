// js/ui/keyboard-visibility.js
export function wireKeyboardVisibility(positionKeyboardDiagram) {
  const keyboardToggle = document.getElementById('keyboardDiagramToggle');
  const keyboardPanel  = document.getElementById('keyboardDiagram');
  if (!keyboardToggle || !keyboardPanel) return;

  const apply = () => {
    const show = keyboardToggle.checked;
    keyboardPanel.classList.toggle('hidden', !show);
    if (show) positionKeyboardDiagram();
  };

  keyboardToggle.addEventListener('change', apply);
  apply();
  window.addEventListener('resize', positionKeyboardDiagram);
}
