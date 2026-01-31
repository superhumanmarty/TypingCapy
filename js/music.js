// js/music.js
// Simple, efficient playlist player for your "music/<folder>/<folder><n>.mp3" structure.

const MUSIC_CATALOG = {
  holiday: 1,
  forest_sounds: 1,
  eastern: 2,
  african: 1,
  middle_eastern: 3,
  classical: 3,
  ocean_waves: 1,
  piano: 14,
  lofi: 13,
  guitar: 8,
  synthwave: 3,
  spooky: 5,
  jazz: 7,
  zen: 9,
  fantasy: 4,
  ukelele: 7
};

let player = null;            // single HTMLAudioElement
let currentKey = 'off';       // which folder is active
let order = [];               // shuffled list of track urls
let cursor = -1;              // index into "order"

// ---- helpers ----
function makeTrackList(key) {
  const count = MUSIC_CATALOG[key] || 0;
  const base = `music/${key}/${key}`;
  const out = [];
  for (let i = 1; i <= count; i++) {
    out.push(`${base}${i}.mp3`);
  }
  return out;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildOrder(key) {
  return shuffle(makeTrackList(key).slice());
}

function stopPlayback() {
  if (player) {
    player.pause();
    player.src = '';
  }
}

function setVolumeFromSlider() {
  const slider = document.getElementById('musicVolume');
  if (!slider || !player) return;
  const v = Math.max(0, Math.min(100, parseInt(slider.value || '50', 10))) / 100;
  player.volume = v;
}

function enableVolumeUI(on) {
  const row = document.getElementById('musicVolumeRow');
  const slider = document.getElementById('musicVolume');
  if (row) row.classList.toggle('disabled', !on);
  if (slider) slider.disabled = !on;
}

function nextTrack(auto = false) {
  if (currentKey === 'off') return;
  if (!order.length) order = buildOrder(currentKey);

  cursor++;
  if (cursor >= order.length) {
    order = buildOrder(currentKey); // reshuffle for the next cycle
    cursor = 0;
  }

  const url = order[cursor];
  if (!url) return;

  player.src = url;
  // play() is user-gesture friendly because it runs from the change/input handlers
  player.play().catch(() => {
    // if autoplay policy blocks, just wait for the user to toggle again
  });
}

function startPlaylist(key) {
  currentKey = key;
  order = buildOrder(key);
  cursor = -1;
  nextTrack();
}

// ---- public wiring ----
export function setupMusic() {
  const select = document.getElementById('musicSelector');
  const slider = document.getElementById('musicVolume');

  if (!select) return;

  // Create player once
  player = new Audio();
  player.preload = 'auto';
  setVolumeFromSlider();

  player.addEventListener('ended', () => nextTrack(true));

  // Change handler: Off pauses; other values start their playlist
  select.addEventListener('change', () => {
    const key = select.value;
    if (key === 'off') {
      stopPlayback();
      currentKey = 'off';
      order = [];
      cursor = -1;
      enableVolumeUI(false);
      return;
    }
    enableVolumeUI(true);
    stopPlayback();        // stop anything currently playing
    startPlaylist(key);    // start new playlist from that folder
  });

  // Volume slider
  slider?.addEventListener('input', setVolumeFromSlider);

  // initial state: Off
  enableVolumeUI(false);
}
