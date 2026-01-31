// js/sound.js — DROP-IN REPLACEMENT

const AudioCtx = window.AudioContext || window.webkitAudioContext;
export const ctx = new AudioCtx();

// --- Master SFX volume (typing sounds) -----------------------------------
const fxGain = ctx.createGain();
fxGain.gain.value = 0.5;            // default 50% to match slider
fxGain.connect(ctx.destination);

// helper: connect all SFX here
function fxOut() { return fxGain; }

// public setter 0..1
export function setFXVolume01(v) {
  fxGain.gain.value = Math.max(0, Math.min(1, v));
}

// UI wiring for the Typing volume slider; disables when Typing = Off
export function setupSoundVolumeUI() {
  const row    = document.getElementById('soundVolumeRow');
  const slider = document.getElementById('soundVolume');
  const select = document.getElementById('soundSelector');

  const enable = (on) => {
    row?.classList.toggle('disabled', !on);
    if (slider) slider.disabled = !on;
  };

  const apply = () => {
    if (!slider) return;
    const v = Math.max(0, Math.min(100, parseInt(slider.value || '50', 10))) / 100;
    setFXVolume01(v);
  };

  slider?.addEventListener('input', apply);
  select?.addEventListener('change', () => enable(select.value !== 'off'));

  // initial
  enable(select ? select.value !== 'off' : true);
  apply();
}

// --- SOUND GENERATORS -----------------------------------------------------

// Pentatonic (A-minor)
const pentatonic = [220, 247, 294, 330, 392];
export function playPentatonic() {
  const freq = pentatonic[(Math.random() * pentatonic.length) | 0];
  const osc = ctx.createOscillator();
  const g   = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  osc.connect(g).connect(fxOut());
  g.gain.setValueAtTime(0, ctx.currentTime);
  g.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.01);
  g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);
  osc.start();
  osc.stop(ctx.currentTime + 0.15);
}

// Bloop (lower-pitched blip)
export function playBlip() {
  const osc = ctx.createOscillator();
  const g   = ctx.createGain();
  osc.type = 'square';
  osc.frequency.value = 200;
  osc.connect(g).connect(fxOut());
  g.gain.setValueAtTime(0.15, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
  osc.start();
  osc.stop(ctx.currentTime + 0.1);
}

// Soft click (short filtered noise burst)
export function playClick() {
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.01, ctx.sampleRate);
  const d   = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

  const src = ctx.createBufferSource();
  src.buffer = buf;

  const f = ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 1200;

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.1, ctx.currentTime);

  src.connect(f).connect(g).connect(fxOut());
  src.start();
  src.stop(ctx.currentTime + 0.01);
}

// Error buzz
export function playErrorBuzz() {
  const osc = ctx.createOscillator();
  const g   = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(300, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.1);
  osc.connect(g).connect(fxOut());
  g.gain.setValueAtTime(0.2, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
  osc.start();
  osc.stop(ctx.currentTime + 0.15);
}

// Helper used elsewhere
export function getSoundMode() {
  const sel = document.getElementById('soundSelector');
  if (sel && typeof sel.value === 'string') return sel.value;

  const radios = document.querySelectorAll('input[name="soundMode"]');
  const checked = [...radios].find(r => r.checked);
  return checked ? checked.value : 'off';
}
