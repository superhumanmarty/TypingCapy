// js/ui/typed-errors.js
export function setupTypedErrorsToggle() {
  const showTypedErrorsToggle = document.getElementById('showTypedErrorsToggle');
  const typedErrorDisplay     = document.getElementById('typedErrorDisplay');
  const typedLetterBox        = document.getElementById('typedLetter');
  if (!showTypedErrorsToggle || !typedErrorDisplay || !typedLetterBox) return;

  const apply = () => {
    // ON or OFF: bubble stays hidden until the next incorrect key; clear the last letter
    typedErrorDisplay.classList.add('hidden');
    typedLetterBox.textContent = '';
  };

  showTypedErrorsToggle.addEventListener('change', apply);
  apply(); // initialize
}
