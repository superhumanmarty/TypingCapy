// js/metrics.js
// Collects "instant" WPM (rolling window) + error times, and renders a small chart.

const WINDOW_MS = 5000;           // rolling window for instant WPM (5s)
const SAMPLE_EVERY_MS = 120; 
const WARMUP_MS = 2000; // first 2s shown as dotted line in the results graph
     // throttle samples so we don't spam
let runStart = 0;
let correctTimes = [];            // absolute timestamps (ms) when a char was typed correctly
let errorTimes = [];              // relative to start (ms)
let samples = [];                 // { t: ms since start, wpm }
let lastSampleAt = 0;

let _avgOverride = null;
export function setAvgOverrideForRun(v) {
  _avgOverride = (typeof v === 'number' ? v : null);
}

export function resetMetrics() {
  runStart = 0;
  correctTimes = [];
  errorTimes = [];
  samples = [];
  lastSampleAt = 0;
}

export function startMetrics(startMs) {
  runStart = startMs;
  correctTimes = [];
  errorTimes = [];
  samples = [];
  lastSampleAt = 0;
}

export function noteMetrics(nowMs, addedCorrect = 0, addedError = false) {
  if (!runStart) return;

  // record the last 'addedCorrect' keystrokes at 'nowMs'
  for (let i = 0; i < addedCorrect; i++) correctTimes.push(nowMs);

  // prune old corrects outside the 5s retention window
  const retentionCutoff = nowMs - WINDOW_MS;
  while (correctTimes.length && correctTimes[0] < retentionCutoff) correctTimes.shift();

  // compute WPM over a 2s window for the *graph* (keeps early ramp down)
  const wpm2s = computeWpm(nowMs, 2000);

  // sample throttled; if too soon, overwrite the last point so the line "slides"
  if (nowMs - lastSampleAt >= SAMPLE_EVERY_MS || samples.length === 0) {
    samples.push({ t: nowMs - runStart, wpm: wpm2s });
    lastSampleAt = nowMs;
  } else {
    samples[samples.length - 1] = { t: nowMs - runStart, wpm: wpm2s };
  }

  if (addedError) errorTimes.push(nowMs - runStart);
}

function computeWpm(nowMs, windowMs) {
  const cutoff = nowMs - windowMs;
  let count = 0;
  for (let i = correctTimes.length - 1; i >= 0; i--) {
    const t = correctTimes[i];
    if (t < cutoff) break;
    count++;
  }
  const minutes = windowMs / 60000;
  return minutes > 0 ? (count / 5) / minutes : 0;
}


export function renderRunGraph(hostEl, durationMs) {
  if (!hostEl) return;

  // wipe & build UI
  hostEl.innerHTML = '';
  const title = document.createElement('div');
  title.className = 'title';
  title.textContent = 'WPM over time';
  const canvas = document.createElement('canvas');
  hostEl.appendChild(title);
  hostEl.appendChild(canvas);

  // size canvas with devicePixelRatio for crisp lines
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const cs   = getComputedStyle(hostEl);
  const padL = parseFloat(cs.paddingLeft)  || 0;
  const padR = parseFloat(cs.paddingRight) || 0;
  const cssWidth = hostEl.clientWidth - padL - padR; // exact inner content width
  const cssHeight = 160;
  canvas.style.width = cssWidth + 'px';
  canvas.style.height = cssHeight + 'px';
  canvas.width = Math.floor(cssWidth * dpr);
  canvas.height = Math.floor(cssHeight * dpr);

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  // theme-aware palette with graceful fallbacks
  const { grid, line, text, error } = getThemeColors();


  // pad inside canvas (extra left so labels don't clip)
  const P = { l: 52, r: 18, t: 14, b: 24 };

  // compute domain
  const T = Math.max(1000, durationMs || (samples.at(-1)?.t ?? 0)); // >= 1s
  const tooShort = T < 4000; // < 4s → force flat-top at final/avg WPM



  // Top of the plot is the actual peak speed (fallback to 1 to avoid /0)
  const maxReached = samples.reduce((m, s) => Math.max(m, s.wpm), 0);
  let maxWpm = Math.max(1, maxReached);   // make it mutable



  // helpers
  const W = cssWidth, H = cssHeight;
  const innerW = W - P.l - P.r, innerH = H - P.t - P.b;
  const x = t => P.l + (t / T) * innerW;
  const y = w => P.t + innerH - (w / maxWpm) * innerH;

  // vertical grid lines ONLY where the time labels are
  ctx.lineWidth = 1;
  ctx.strokeStyle = withAlpha(grid, 0.45);
  // If total time <= 5s → labels at start & end; else 0%,25%,50%,75%,100%.
  // Skip 0 to avoid drawing over the y-axis.
  const vFractions = (T <= 5000) ? [1] : [0.25, 0.5, 0.75, 1];
  for (const f of vFractions) {
    const gx = Math.round(x(T * f)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(gx, P.t);
    ctx.lineTo(gx, H - P.b);
    ctx.stroke();
  }




  // ---- Numeric y label: average WPM (white), positioned at its Y ----
  ctx.fillStyle = withAlpha(text, 0.9);
  ctx.font = '14px monospace';
  ctx.textAlign = 'right';

  // time-weighted average WPM across the run (handles uneven sample spacing)
  let avgWpm = 0;
  if (samples.length >= 2) {
    let area = 0;
    for (let i = 1; i < samples.length; i++) {
      const dt = samples[i].t - samples[i - 1].t;               // ms between samples
      area += (samples[i - 1].wpm + samples[i].wpm) * 0.5 * dt; // trapezoid
    }
    const totalDt = samples[samples.length - 1].t - samples[0].t;
    if (totalDt > 0) avgWpm = area / totalDt;
  } else if (samples.length === 1) {
    avgWpm = samples[0].wpm;
  }

  // <-- override takes precedence
  if (_avgOverride != null) {
    avgWpm = _avgOverride;
  }

  maxWpm = Math.max(maxWpm, avgWpm || 0);


  const finalBeatsPeak = (_avgOverride != null) && (_avgOverride > maxReached);

  const CLOSE_DIFF = 3;
  const closeToAvg =
    (avgWpm || 0) > 0 &&
    maxReached >= (avgWpm || 0) &&
    (maxReached - (avgWpm || 0)) <= CLOSE_DIFF;

  // If the run was < 3s, always show a flat line at the top using final/avg WPM,
  // and don’t show a separate MAX label.
  const forceFlatTopLine = finalBeatsPeak || tooShort;
  const suppressMaxLabel = finalBeatsPeak || closeToAvg || tooShort;


  // Lock the scale so y(avgWpm) sits exactly at the top
  if (forceFlatTopLine) {
    maxWpm = Math.max(1, avgWpm);
  }
  
  // Add headroom unless we’re intentionally drawing a flat-top at the very top
  const HEADROOM_FRAC = 0.06;   // 6% extra space
  const HEADROOM_MIN_PX = 8;    // or at least 8px visually

  if (!forceFlatTopLine) {
    const domainBase = Math.max(maxWpm, avgWpm || 0);
    const pxToWpm = domainBase / (H - P.t - P.b); // innerH
    const extraWpm = Math.max(domainBase * HEADROOM_FRAC, pxToWpm * HEADROOM_MIN_PX);
    maxWpm = domainBase + extraWpm;
  }


  // Precompute the avg label Y (text baseline)
  let yAvgPx = null;
  if (avgWpm > 0) {
    yAvgPx = Math.round(y(avgWpm)) + 4;
  }

  if (avgWpm > 0) {
    // label on the left at the average WPM
    ctx.fillStyle = withAlpha(text, 0.9);
    ctx.font = '14px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(avgWpm)}`, P.l - 12, yAvgPx);

    // single horizontal grid line at the average (at the true avg line)
    ctx.strokeStyle = withAlpha(grid, 0.45);
    ctx.lineWidth = 1;
    const gyAvg = Math.round(y(avgWpm)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(P.l, gyAvg);
    ctx.lineTo(W - P.r, gyAvg);
    ctx.stroke();
  }




  // x-axis labels: if total <= 5s → just start & end; else 5 evenly spaced labels
  ctx.fillStyle = withAlpha(text, 0.9);
  ctx.textAlign = 'center';

  if (T <= 5000) {
    // Two labels (start and end)
    for (const f of [0, 1]) {
      const tx = x(T * f);
      const secs = (T * f) / 1000;
      ctx.fillText(formatTime(secs), tx, H - 6);
    }
  } else {
    // Five labels total (0%, 25%, 50%, 75%, 100%)
    for (let i = 0; i <= 4; i++) {
      const f = i / 4;              // 0, .25, .5, .75, 1
      const tx = x(T * f);
      const secs = (T * f) / 1000;  // ms -> s
      ctx.fillText(formatTime(secs), tx, H - 6);
    }
  }




  // ----- Error ticks at the bottom (no red horizontal rail) -----
  const railY = H - P.b - 2.5; // near bottom of plot area
  ctx.strokeStyle = withAlpha(error, 0.95);
  ctx.lineWidth = 2; // a touch bolder
  for (const et of errorTimes) {
    const ex = Math.max(P.l, Math.min(W - P.r, x(et)));
    // tick
    ctx.beginPath();
    ctx.moveTo(ex, railY - 9);
    ctx.lineTo(ex, railY);
    ctx.stroke();
    // dot cap
    ctx.beginPath();
    ctx.arc(ex, railY - 9, 2, 0, Math.PI * 2);
    ctx.fillStyle = withAlpha(error, 0.85);
    ctx.fill();
  }


  if (forceFlatTopLine) {
    const yTop = Math.round(y(avgWpm)) + 0.5;

    // glow underlay
    ctx.lineWidth = 6;
    ctx.strokeStyle = withAlpha(line, 0.25);
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(P.l, yTop);
    ctx.lineTo(W - P.r, yTop);
    ctx.stroke();

    // crisp main line
    ctx.lineWidth = 2;
    ctx.strokeStyle = line;
    ctx.beginPath();
    ctx.moveTo(P.l, yTop);
    ctx.lineTo(W - P.r, yTop);
    ctx.stroke();
  } else {

    // ----- Warm-up dotted line (connect into solid line) -----
    const warmupMs = (typeof WARMUP_MS === 'number' && WARMUP_MS >= 0) ? WARMUP_MS : 2000;
    const idxAfterOrAt = samples.findIndex(s => s.t >= warmupMs);

    let warmIdx = idxAfterOrAt;
    if (warmIdx === -1 && samples.length) warmIdx = samples.length - 1;
    const warmWpm = warmIdx >= 0 ? samples[warmIdx].wpm : 0;

    const x0     = x(0);
    const joinX  = (idxAfterOrAt !== -1) ? x(samples[idxAfterOrAt].t)
                                        : x(Math.min(warmupMs, T));
    const yWarm  = y(warmWpm);

    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = withAlpha(line, 0.9);
    ctx.beginPath();
    ctx.moveTo(x0, yWarm);
    ctx.lineTo(joinX, yWarm);
    ctx.stroke();
    ctx.restore();

    // ----- Main speed line (solid), only from >= warmup -----
    if (samples.length > 0) {
      const startIdx = samples.findIndex(s => s.t >= warmupMs);
      if (startIdx !== -1) {
        // glow underlay
        ctx.lineWidth = 6;
        ctx.strokeStyle = withAlpha(line, 0.25);
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(x(samples[startIdx].t), y(samples[startIdx].wpm));
        for (let i = startIdx + 1; i < samples.length; i++) {
          ctx.lineTo(x(samples[i].t), y(samples[i].wpm));
        }
        ctx.stroke();

        // crisp main line
        ctx.lineWidth = 2;
        ctx.strokeStyle = line;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(x(samples[startIdx].t), y(samples[startIdx].wpm));
        for (let i = startIdx + 1; i < samples.length; i++) {
          ctx.lineTo(x(samples[i].t), y(samples[i].wpm));
        }
        ctx.stroke();
      }
    }
  }


  // ----- Label the highest reached speed (only if not beaten by Final) ---
  if (maxReached > 0 && !suppressMaxLabel) {
    let yMaxPx = Math.round(y(maxReached)) + 4;

    // prevent overlap with the avg label
    const MIN_GAP = 12; // px
    if (yAvgPx != null && Math.abs(yMaxPx - yAvgPx) < MIN_GAP) {
      yMaxPx = (yMaxPx >= yAvgPx) ? (yAvgPx + MIN_GAP) : (yAvgPx - MIN_GAP);
      // clamp inside plot area
      const minY = P.t + 10;
      const maxY = H - P.b - 6;
      yMaxPx = Math.max(minY, Math.min(maxY, yMaxPx));
    }

    ctx.fillStyle = withAlpha(text, 0.95);
    ctx.font = '14px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(maxReached)}`, P.l - 10, yMaxPx);
  }




  // ---- Axes rectangle (top/right/bottom/left) ----
  ctx.strokeStyle = withAlpha(grid, 0.6);
  ctx.lineWidth = 1;

  const left   = Math.round(P.l) + 0.5;
  const right  = Math.round(W - P.r) + 0.5;
  const topLn  = Math.round(P.t) + 0.5;
  const bottom = Math.round(H - P.b) + 0.5;

  ctx.beginPath();
  // top
  ctx.moveTo(left, topLn);
  ctx.lineTo(right, topLn);
  // bottom (y = 0 line)
  ctx.moveTo(left, bottom);
  ctx.lineTo(right, bottom);
  // left
  ctx.moveTo(left, topLn);
  ctx.lineTo(left, bottom);
  // right
  ctx.moveTo(right, topLn);
  ctx.lineTo(right, bottom);
  ctx.stroke();

  function getThemeColors() {
    // Prefer explicit chart tokens if your CSS defines them,
    // else fall back to theme tokens, else to neutral palette.
    const grid  = getCss('--chart-grid-color',
                  getCss('--box-border',  '#596174'));   // neutral grey
    const line  = getCss('--chart-line-color',
                  getCss('--highlight-color',
                  getCss('--stats-color', '#7fd1ff')));  // accent > stats > cyan
    const text  = getCss('--chart-text-color',
                  getCss('--correct-color','#eaf0f7'));  // soft white
    const error = getCss('--chart-error-color',
                  getCss('--incorrect-color', '#ff6b6b')); // friendly red
    return { grid, line, text, error };
  }


  // helpers
  function getCss(varName, fallback) {
    // Read vars from the element that actually inherits the theme (body/host),
    // not from <html>.
    const refEl = hostEl || document.body || document.documentElement;
    const v = getComputedStyle(refEl).getPropertyValue(varName).trim();
    return v || fallback;
  }

  function withAlpha(rgbOrHex, a) {
    if (/^#([0-9a-f]{6}|[0-9a-f]{3})$/i.test(rgbOrHex)) {
      const c = rgbToRgb(rgbOrHex);
      return `rgba(${c.r},${c.g},${c.b},${a})`;
    }
    return rgbOrHex;
  }
  function rgbToRgb(hex) {
    let h = hex.replace('#','');
    if (h.length === 3) h = h.split('').map(ch => ch + ch).join('');
    const n = parseInt(h, 16);
    return { r: (n>>16)&255, g: (n>>8)&255, b: n&255 };
  }
  function formatTime(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const m = Math.floor(s / 60);
    const ss = String(s % 60).padStart(2, '0');
    return `${m}:${ss}`;
  }
}




// Let main query data if needed
export function getMetricsSnapshot() {
  return {
    start: runStart,
    samples: samples.slice(),
    errors: errorTimes.slice(),
    windowMs: WINDOW_MS
  };
}

// Replace your current getLiveWPM with this
export function getLiveWPM(windowMs = 2000) {
  if (!runStart) return 0;
  const now = Date.now();
  const effectiveMs = Math.min(windowMs, WINDOW_MS); // we only retain last WINDOW_MS
  const cutoff = now - effectiveMs;

  // Count correct keystrokes inside the effective window
  let count = 0;
  for (let i = correctTimes.length - 1; i >= 0; i--) {
    const t = correctTimes[i];
    if (t < cutoff) break;
    count++;
  }

  if (count === 0) return 0;
  const minutes = effectiveMs / 60000;
  return Math.round((count / 5) / minutes);
}


