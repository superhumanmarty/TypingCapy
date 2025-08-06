// js/sound.js — play random pentatonic, blip, or click on keypress
const AudioCtx = window.AudioContext || window.webkitAudioContext;
const ctx = new AudioCtx();

// — Pentatonic (A-minor) —
const pentatonic = [220, 247, 294, 330, 392];
export function playPentatonic() {
  const freq = pentatonic[Math.floor(Math.random() * pentatonic.length)];
  const osc = ctx.createOscillator();
  const g   = ctx.createGain();
  osc.type = 'sine'; osc.frequency.value = freq;
  osc.connect(g).connect(ctx.destination);
  g.gain.setValueAtTime(0, ctx.currentTime);
  g.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.01);
  g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);
  osc.start(); osc.stop(ctx.currentTime + 0.15);
}

// — Bloop (lower-pitched blip) —
export function playBlip() {
  const osc = ctx.createOscillator();
  const g   = ctx.createGain();
  osc.type = 'square';
  osc.frequency.value = 200;      // lower pitch for bloop
  osc.connect(g).connect(ctx.destination);
  g.gain.setValueAtTime(0.15, ctx.currentTime);  // slight lower volume
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
  osc.start(); osc.stop(ctx.currentTime + 0.1);
}

// — Soft click (quieter typewriter click) —
export function playClick() {
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.01, ctx.sampleRate);
  const d   = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f   = ctx.createBiquadFilter();
  f.type = 'highpass'; f.frequency.value = 1200;
  const g   = ctx.createGain();
  g.gain.setValueAtTime(0.1, ctx.currentTime); // lower volume
  src.connect(f).connect(g).connect(ctx.destination);
  src.start(); src.stop(ctx.currentTime + 0.01);
}

// add at bottom of js/sound.js
export function playErrorBuzz() {
  const osc = ctx.createOscillator();
  const g   = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(300, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.1);
  osc.connect(g).connect(ctx.destination);

  g.gain.setValueAtTime(0.2, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

  osc.start();
  osc.stop(ctx.currentTime + 0.15);
}

export function getSoundMode() {
  return [...document.querySelectorAll('input[name="soundMode"]')]
    .find(r => r.checked).value;
}