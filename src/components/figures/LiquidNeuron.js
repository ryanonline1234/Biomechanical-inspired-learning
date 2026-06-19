/* =====================================================================
   LiquidNeuron — chapter 2 (adaptive dynamics, the winning SILICON thread).

   A single "liquid" neuron: a leaky integrator driven by a square wave.
       dV/dt = (drive - V) / tau
   An input slider sets the neuron's *effective time constant* tau:
   higher input -> smaller tau -> faster, sharper response;
   lower input  -> larger tau  -> slow, smooth response.
   The membrane voltage V(t) scrolls across the canvas chasing the drive.

   The point made in-canvas: the WEIGHTS NEVER CHANGE — only the dynamics
   (the time constant) flex. A small companion strip nods to Mamba-style
   selectivity: per-token keep (filled) vs forget (hollow).

   Color: phosphor — this is the hardware-respecting silicon thread.
   ===================================================================== */

import { createFigure, palette, clamp, mapRange, hexToRgb, rgba } from '../lib/canvas.js';

// Square-wave drive in [0,1], period in seconds.
const PERIOD = 2.0;
function drive(t) {
  // 0..1 square wave; phase < half -> high, else low
  const phase = ((t % PERIOD) + PERIOD) % PERIOD;
  return phase < PERIOD / 2 ? 1 : 0;
}

export default function mount(stage) {
  const canvas = stage.querySelector('canvas');
  const controls = stage.querySelector('[data-controls]');
  const pal = palette();
  const phoRGB = hexToRgb(pal.phosphor);

  // input in [0,1]; mapped to tau. High input -> small tau (fast).
  let input = 0.45;
  const tauOf = (inp) => mapRange(inp, 0, 1, 0.9, 0.08); // seconds

  // Rolling history of {t, drive, V} samples for the scrolling plot.
  const WINDOW = 5.0; // seconds visible across the canvas width
  let history = [];
  let V = 0; // membrane voltage
  let driveTime = 0; // the running drive clock (advances even when paused via step)

  // Companion selectivity strip: a short fixed token sequence with a
  // deterministic per-token keep/forget gate (a nod to Mamba selectivity).
  const TOKENS = [1, 0, 1, 1, 0, 1, 0]; // 1 = keep (filled), 0 = forget (hollow)

  // Plot geometry (recomputed per draw from env so it follows resize).
  function plotRect(e) {
    const pad = 14;
    const stripH = 34; // bottom companion strip
    return {
      x: pad,
      y: pad + 18, // leave room for the top label line
      w: e.w - pad * 2,
      h: e.h - pad * 2 - 18 - stripH,
      stripH,
    };
  }

  // Advance the simulation by dt seconds, appending samples and trimming.
  function advance(dt) {
    const tau = tauOf(input);
    // Integrate with small sub-steps for stability when tau is small.
    const sub = Math.max(1, Math.ceil((dt / tau) * 4));
    const h = dt / sub;
    for (let i = 0; i < sub; i++) {
      driveTime += h;
      const d = drive(driveTime);
      // leaky integrator: dV/dt = (drive - V)/tau
      V += (h / tau) * (d - V);
    }
    history.push({ t: driveTime, d: drive(driveTime), v: clamp(V, 0, 1) });
    // Trim history older than the visible window.
    const cutoff = driveTime - WINDOW;
    while (history.length && history[0].t < cutoff) history.shift();
  }

  // Map a sample time to an x within the plot (newest at the right edge).
  function timeToX(p, t) {
    const t0 = driveTime - WINDOW;
    return p.x + clamp((t - t0) / WINDOW, 0, 1) * p.w;
  }
  const valToY = (p, v) => p.y + (1 - v) * p.h;

  // Build a couple of static response curves for reduced motion: one
  // rising edge and one falling edge at the current tau, no scrolling.
  function staticCurves() {
    const tau = tauOf(input);
    const rise = [];
    const fall = [];
    const SPAN = WINDOW; // seconds of simulated edge response
    let vr = 0;
    let vf = 1;
    const steps = 240;
    const h = SPAN / steps;
    for (let i = 0; i <= steps; i++) {
      const tt = i * h;
      vr += (h / tau) * (1 - vr); // chasing drive = 1
      vf += (h / tau) * (0 - vf); // chasing drive = 0
      rise.push({ t: tt, v: clamp(vr, 0, 1) });
      fall.push({ t: tt, v: clamp(vf, 0, 1) });
    }
    return { rise, fall, SPAN };
  }

  function draw(e) {
    const { ctx, w, h } = e;
    ctx.clearRect(0, 0, w, h);
    const p = plotRect(e);
    const tau = tauOf(input);

    // --- frame & baseline grid ---
    ctx.save();
    ctx.strokeStyle = pal.graphite;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1;
    ctx.strokeRect(p.x, p.y, p.w, p.h);
    // mid gridline (V = 0.5)
    ctx.beginPath();
    ctx.moveTo(p.x, p.y + p.h * 0.5);
    ctx.lineTo(p.x + p.w, p.y + p.h * 0.5);
    ctx.stroke();
    ctx.restore();

    ctx.font = '11px "Spline Sans Mono", monospace';
    ctx.textBaseline = 'alphabetic';

    if (e.reduced) {
      // Static meaningful frame: one rising + one falling response.
      const { rise, fall, SPAN } = staticCurves();
      // faint drive reference: high then low (a single edge of context)
      ctx.save();
      ctx.strokeStyle = rgba(hexToRgb(pal.bone), 0.28);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(p.x, valToY(p, 1));
      ctx.lineTo(p.x + p.w * 0.5, valToY(p, 1));
      ctx.moveTo(p.x + p.w * 0.5, valToY(p, 0));
      ctx.lineTo(p.x + p.w, valToY(p, 0));
      ctx.stroke();
      ctx.restore();
      // the two phosphor curves
      ctx.save();
      ctx.strokeStyle = pal.phosphor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      rise.forEach((s, i) => {
        // squeeze the rising-edge response into the left half of the plot
        const xx = p.x + (s.t / SPAN) * (p.w * 0.5);
        if (i === 0) ctx.moveTo(xx, valToY(p, s.v));
        else ctx.lineTo(xx, valToY(p, s.v));
      });
      ctx.stroke();
      ctx.beginPath();
      fall.forEach((s, i) => {
        const xx = p.x + p.w * 0.5 + (s.t / SPAN) * (p.w * 0.5);
        if (i === 0) ctx.moveTo(xx, valToY(p, s.v));
        else ctx.lineTo(xx, valToY(p, s.v));
      });
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = pal.bone;
      ctx.globalAlpha = 0.7;
      ctx.fillText('rise edge', p.x + 4, p.y + p.h - 6);
      ctx.fillText('fall edge', p.x + p.w * 0.5 + 4, p.y + p.h - 6);
      ctx.globalAlpha = 1;
    } else {
      // --- faint square-wave drive reference ---
      ctx.save();
      ctx.strokeStyle = rgba(hexToRgb(pal.bone), 0.28);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      let started = false;
      for (const s of history) {
        const X = timeToX(p, s.t);
        const Y = valToY(p, s.d);
        if (!started) {
          ctx.moveTo(X, Y);
          started = true;
        } else {
          ctx.lineTo(X, Y);
        }
      }
      ctx.stroke();
      ctx.restore();

      // --- V(t) as a phosphor curve ---
      ctx.save();
      ctx.strokeStyle = pal.phosphor;
      ctx.lineWidth = 2.4;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      let s2 = false;
      for (const s of history) {
        const X = timeToX(p, s.t);
        const Y = valToY(p, s.v);
        if (!s2) {
          ctx.moveTo(X, Y);
          s2 = true;
        } else {
          ctx.lineTo(X, Y);
        }
      }
      ctx.stroke();
      ctx.restore();

      // leading dot at the newest sample
      if (history.length) {
        const last = history[history.length - 1];
        const X = timeToX(p, last.t);
        const Y = valToY(p, last.v);
        ctx.fillStyle = pal.bone;
        ctx.beginPath();
        ctx.arc(X, Y, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = pal.phosphor;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // --- top label: weights never change, only dynamics flex ---
    ctx.fillStyle = pal.phosphor;
    ctx.textAlign = 'left';
    ctx.fillText('weights FIXED — only the dynamics flex', p.x, p.y - 6);

    // --- companion selectivity strip along the bottom ---
    const sy = p.y + p.h + 12;
    const cellN = TOKENS.length;
    const cellGap = 6;
    const cellW = Math.min(26, (p.w - cellGap * (cellN - 1)) / cellN);
    const totalW = cellW * cellN + cellGap * (cellN - 1);
    const sx0 = p.x;
    ctx.fillStyle = pal.bone;
    ctx.globalAlpha = 0.65;
    ctx.textAlign = 'left';
    ctx.fillText('selective gate:', sx0, sy - 4);
    // compact glyph legend, right-aligned to the strip so it never overflows
    ctx.textAlign = 'right';
    ctx.fillText('■ keep   □ forget', p.x + p.w, sy - 4);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
    for (let i = 0; i < cellN; i++) {
      const cx = sx0 + i * (cellW + cellGap);
      const cy = sy + 6;
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = pal.phosphor;
      if (TOKENS[i]) {
        // keep -> filled
        ctx.fillStyle = rgba(phoRGB, 0.85);
        ctx.fillRect(cx, cy, cellW, 14);
      } else {
        // forget -> hollow
        ctx.strokeRect(cx, cy, cellW, 14);
      }
    }
  }

  function update(dt, e) {
    advance(dt);
  }

  // Seed a little history so the first frame isn't empty.
  for (let i = 0; i < 60; i++) advance(WINDOW / 120);

  const fig = createFigure({ canvas, update, draw });
  const env = fig.env;

  // --- input slider -> time constant tau ---
  const label = document.createElement('label');
  label.className = 'ctrl-label';
  label.textContent = 'input (drives tau)';
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'ctrl-slider'; // silicon thread -> cool phosphor thumb
  slider.min = '0';
  slider.max = '1';
  slider.step = '0.01';
  slider.value = String(input);
  slider.setAttribute('aria-label', 'input strength (sets time constant)');

  const readout = document.createElement('span');
  readout.className = 'ctrl-readout';
  const updateReadout = () => {
    readout.textContent = `tau = ${tauOf(input).toFixed(2)} s`;
  };
  updateReadout();

  slider.addEventListener('input', () => {
    input = clamp(parseFloat(slider.value), 0, 1);
    updateReadout();
    // slider still works under reduced motion via render()
    if (env.reduced) fig.render();
  });

  controls.append(label, slider, readout);

  // Legend chip for the silicon meaning.
  const chip = document.createElement('span');
  chip.className = 'ctrl-chip';
  chip.style.setProperty('--c', pal.phosphor);
  chip.textContent = 'silicon: membrane V(t)';
  controls.append(chip);

  // --- reduced motion: step advances the drive by a chunk and re-renders ---
  if (env.reduced) {
    const stepBtn = document.createElement('button');
    stepBtn.className = 'ctrl-btn';
    stepBtn.type = 'button';
    stepBtn.textContent = 'step ⏵';
    stepBtn.addEventListener('click', () => {
      // advance the square-wave drive by a chunk (~one half period)
      advance(PERIOD / 2);
      fig.render();
    });
    controls.append(stepBtn);
  }

  fig.start();
  return fig;
}
