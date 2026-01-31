const overlay = document.getElementById('deviceWarning');
const continueBtn = document.getElementById('deviceWarningContinue');
const STORAGE_KEY = 'kw_mobile_warning_ack';

function isTouchOnlyDevice() {
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  const fine = window.matchMedia?.('(pointer: fine)').matches;
  const touchCapable = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  return (coarse && !fine) || (touchCapable && window.innerWidth < 1024);
}

function showWarning() {
  if (!overlay) return;
  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.setAttribute('aria-busy', 'true');
  document.body.style.overflow = 'hidden';
  continueBtn?.focus();
}

function hideWarning() {
  if (!overlay) return;
  overlay.classList.add('hidden');
  overlay.setAttribute('aria-hidden', 'true');
  document.body.removeAttribute('aria-busy');
  document.body.style.overflow = '';
}

function initWarning() {
  if (!overlay || !continueBtn) return;
  if (!isTouchOnlyDevice()) return;
  if (localStorage.getItem(STORAGE_KEY) === 'ack') return;

  showWarning();

  continueBtn.addEventListener('click', () => {
    localStorage.setItem(STORAGE_KEY, 'ack');
    hideWarning();
  });
}

window.addEventListener('DOMContentLoaded', initWarning);

