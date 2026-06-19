/* =====================================================================
   LiquidNeuron — chapter 2 (adaptive dynamics, the winning SILICON thread).

   A single "liquid" neuron: a leaky integrator driven by a clean STEP.
       dV/dt = (drive - V) / tau
   The WEIGHTS are fixed (drawn, locked). What flexes is the effective
   time constant tau — and crucially, tau is *chosen by the input*, not
   dialed by hand: input strength -> tau (tauOf). High input -> small tau
   -> fast settle; low input -> large tau -> slow settle.

   The spine of the figure is the CONTRAST. Against the identical step we
   always draw TWO responses at once:
     - LIVE curve (solid phosphor, 2.4px): tau set by the slider.
     - GHOST curve (dashed phosphor, ~0.3 alpha, 1.5px): a FIXED
       opposite-extreme tau, labelled "same drive, other input."
   So one network is seen producing both fast and slow simultaneously.

   For a step 0 -> 1, V crosses 0.63 of target at exactly t = tau after the
   step (1 - e^-1 = 0.632). We drop a settle tick there on BOTH curves, so
   "fast vs slow" is two measured numbers that visibly differ.

   Color: phosphor — this is the hardware-respecting silicon thread.
   Mamba selectivity is the per-token cousin of this idea; it lives in its
   own figure (mamba-selective) and is referenced only in prose, not faked
   here.
   ===================================================================== */

import {
  createFigure,
  palette,
  clamp,
  lerp,
  mapRange,
  hexToRgb,
  rgba,
  drawText,
} from '../lib/canvas.js';

// Step drive in [0,1]: low for t < STEP_T, then high and held.
const STEP_T = 0.45; // seconds into the window the step rises
const WINDOW = 2.4; // seconds visible across the plot width
const GHOST_TAU = 0.9; // ghost holds at the SLOW extreme (fixed anchor)
const FAST_TAU = 0.08; // the fast extreme (used when live is itself slow)
const SETTLE_FRAC = 0.63; // 1 - e^-1; where we mark "settled"

// input in [0,1] -> tau (seconds). High input -> small tau (fast).
const tauOf = (inp) => mapRange(inp, 0, 1, 0.9, 0.08);

export default function mount(stage) {
  const canvas = stage.querySelector('canvas');
  const controls = stage.querySelector('[data-controls]');
  const pal = palette();
  const phoRGB = hexToRgb(pal.phosphor);
  const boneRGB = hexToRgb(pal.bone);

  // input strength in [0,1]; the input *selects* the dynamics.
  let input = 0.72;

  // Reveal transient: 0 -> 1 sweeps the curves in from the step time.
  // Driven on demand via fig.play(); update() calls fig.stop() when done.
  let reveal = 1; // start fully revealed (seeded below for first paint)
  const REVEAL_SECS = 0.9;
  let fig; // assigned after createFigure so update() can close over it.

  // The ghost is the FIXED opposite-extreme tau. If the live tau is on the
  // fast side, the ghost holds slow; if live is slow, ghost holds fast — so
  // the two always bracket the contrast. The crossover is the window middle.
  function ghostTau(liveTau) {
    return liveTau <= (FAST_TAU + GHOST_TAU) / 2 ? GHOST_TAU : FAST_TAU;
  }

  // Plot geometry — recomputed per draw so it follows resize.
  // Top band holds the locked-weight schematic + causal readout.
  function plotRect(e) {
    const pad = 16;
    const topBand = 92; // schematic + readout live up here
    return {
      x: pad,
      y: topBand,
      w: e.w - pad * 2,
      h: e.h - topBand - pad - 14, // bottom margin for endpoint labels
    };
  }

  // Step value at simulated time t (0 before step, 1 after).
  const stepAt = (t) => (t < STEP_T ? 0 : 1);

  // Closed-ish form via fine integration: build the response of a leaky
  // integrator to the step, for a given tau, across the window. Cheap
  // (~N points), exact enough, and lets us read the 0.63 crossing.
  function buildResponse(tau, N = 220) {
    const pts = new Array(N + 1);
    const h = WINDOW / N;
    let v = 0;
    let crossT = -1;
    // sub-step the integration for small tau stability.
    const subFor = (dt) => Math.max(1, Math.ceil((dt / tau) * 4));
    for (let i = 0; i <= N; i++) {
      const t = i * h;
      pts[i] = { t, v: clamp(v, 0, 1) };
      // detect the 0.63 crossing (after the step, rising)
      if (crossT < 0 && t >= STEP_T && v >= SETTLE_FRAC) crossT = t;
      // advance to next sample
      const sub = subFor(h);
      const hh = h / sub;
      for (let s = 0; s < sub; s++) {
        const d = stepAt(t + s * hh);
        v += (hh / tau) * (d - v);
      }
    }
    // For a clean 0 -> 1 step the analytic crossing is STEP_T + tau.
    const settleT = STEP_T + tau;
    return { pts, settleT };
  }

  // map sample time / value to plot coordinates.
  const timeToX = (p, t) => p.x + clamp(t / WINDOW, 0, 1) * p.w;
  const valToY = (p, v) => p.y + (1 - v) * p.h;

  // ---- drawing helpers -------------------------------------------------

  function drawGrid(ctx, p) {
    ctx.save();
    ctx.strokeStyle = pal.graphite;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1;
    ctx.strokeRect(p.x, p.y, p.w, p.h);
    ctx.globalAlpha = 0.32;
    // 0.63 target gridline — the level we measure settle against.
    const yT = valToY(p, SETTLE_FRAC);
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(p.x, yT);
    ctx.lineTo(p.x + p.w, yT);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    drawText(ctx, 'label', '0.63 of target', p.x + 6, yT - 4, {
      color: pal.boneDim,
      alpha: 0.7,
      size: 9,
      baseline: 'bottom',
    });
  }

  // The faint step-drive reference (the identical drive both curves chase).
  function drawDrive(ctx, p) {
    ctx.save();
    ctx.strokeStyle = rgba(boneRGB, 0.26);
    ctx.lineWidth = 1.5;
    const xStep = timeToX(p, STEP_T);
    ctx.beginPath();
    ctx.moveTo(p.x, valToY(p, 0));
    ctx.lineTo(xStep, valToY(p, 0));
    ctx.lineTo(xStep, valToY(p, 1));
    ctx.lineTo(p.x + p.w, valToY(p, 1));
    ctx.stroke();
    ctx.restore();
    // Anchor at the LEFT end of the drive's high plateau so the label rides
    // the step line, clear of the top-right readout column.
    drawText(ctx, 'label', 'drive (step)', xStep + 6, valToY(p, 1) - 5, {
      color: pal.boneDim,
      alpha: 0.8,
      size: 9,
      align: 'left',
      baseline: 'bottom',
    });
  }

  // Draw one response curve, clipped to the reveal fraction. Returns the
  // pixel point at the current reveal head (for the leading dot / labels).
  function drawCurve(ctx, p, pts, { solid, alpha, width }) {
    // reveal sweeps x from the step time to the right edge.
    const headX = solid
      ? lerp(timeToX(p, STEP_T), p.x + p.w, reveal)
      : p.x + p.w; // ghost is steady context — fully drawn always
    ctx.save();
    ctx.strokeStyle = solid ? pal.phosphor : rgba(phoRGB, alpha);
    ctx.lineWidth = width;
    ctx.lineJoin = 'round';
    if (!solid) ctx.setLineDash([5, 5]);
    ctx.beginPath();
    let started = false;
    let lastIn = null;
    for (const s of pts) {
      const X = timeToX(p, s.t);
      const Y = valToY(p, s.v);
      if (X > headX) break;
      if (!started) {
        ctx.moveTo(X, Y);
        started = true;
      } else {
        ctx.lineTo(X, Y);
      }
      lastIn = { x: X, y: Y, v: s.v };
    }
    ctx.stroke();
    ctx.restore();
    return lastIn;
  }

  // A vertical settle tick at the 0.63 crossing, with the measured time.
  function drawSettleTick(ctx, p, settleT, { color, alpha, label }) {
    if (settleT > WINDOW) return; // off-window: don't pretend
    const x = timeToX(p, settleT);
    const yTop = valToY(p, SETTLE_FRAC);
    ctx.save();
    ctx.strokeStyle = rgba(color === pal.phosphor ? phoRGB : boneRGB, alpha);
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(x, p.y + p.h);
    ctx.lineTo(x, yTop);
    ctx.stroke();
    // small node at the crossing
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(x, yTop, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (label) {
      drawText(ctx, 'data', label, x, p.y + p.h + 2, {
        color,
        alpha,
        align: 'center',
        baseline: 'top',
        size: 10,
      });
    }
  }

  // ---- the LOCKED-WEIGHT schematic (frozen the whole time) -------------
  // input node -> edge labelled "w" + lock glyph -> neuron, with a tau badge
  // that recolors/relabels by value (NO pulse, NO glow).
  function drawSchematic(ctx, e, liveTau) {
    const cy = 40; // vertical center of the schematic band
    const nodeR = 7;
    const inX = 26;
    const neuX = 150;
    const phaseFast = mapRange(liveTau, GHOST_TAU, FAST_TAU, 0, 1); // 0 slow .. 1 fast
    const tauTint = rgba(phoRGB, lerp(0.45, 1, clamp(phaseFast, 0, 1)));

    ctx.save();
    // input node (bone outline — the drive entering)
    ctx.strokeStyle = pal.bone;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(inX, cy, nodeR, 0, Math.PI * 2);
    ctx.stroke();

    // the FIXED weighted edge (graphite — frozen, never changes)
    ctx.strokeStyle = pal.graphite;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(inX + nodeR, cy);
    ctx.lineTo(neuX - nodeR - 2, cy);
    ctx.stroke();

    // the neuron (phosphor disk, tinted to tau)
    ctx.fillStyle = tauTint;
    ctx.beginPath();
    ctx.arc(neuX, cy, nodeR + 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // edge label "w" + lock glyph (drawn frozen)
    const midX = (inX + neuX) / 2;
    drawText(ctx, 'data', 'w', midX - 5, cy - 9, {
      color: pal.boneDim,
      align: 'center',
      baseline: 'bottom',
      size: 11,
    });
    drawLock(ctx, midX + 7, cy - 11, pal.boneDim);

    // node labels
    drawText(ctx, 'label', 'input', inX, cy + nodeR + 5, {
      color: pal.boneDim,
      align: 'center',
      baseline: 'top',
      size: 9,
    });

    // tau badge on the neuron — value + tint, no motion.
    const badgeX = neuX + nodeR + 12;
    drawText(ctx, 'label', 'tau', badgeX, cy - 2, {
      color: pal.boneDim,
      baseline: 'bottom',
      size: 9,
    });
    drawText(ctx, 'data', `${liveTau.toFixed(2)} s`, badgeX, cy + 1, {
      color: tauTint,
      baseline: 'top',
      size: 13,
      weight: 500,
    });

    // The thesis line: weights FIXED — only the dynamics flex.
    // "FIXED" carried by phosphor would clash (phosphor = the live signal),
    // so the load-bearing word stays bone and the tier does the lifting.
    drawText(ctx, 'title', 'Weights are fixed. Only the time constant flexes.', inX, 78, {
      color: pal.bone,
      baseline: 'alphabetic',
      size: 13,
    });
  }

  // small padlock glyph
  function drawLock(ctx, x, y, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.2;
    // shackle
    ctx.beginPath();
    ctx.arc(x, y, 3, Math.PI, 0);
    ctx.stroke();
    // body
    ctx.fillRect(x - 4.5, y, 9, 6.5);
    ctx.restore();
  }

  // The causal readout: input -> tau (the input SELECTS the dynamics).
  function drawCausalReadout(ctx, e, liveTau) {
    const x = e.w - 16;
    drawText(ctx, 'data', `input ${input.toFixed(2)}`, x, 30, {
      color: pal.bone,
      align: 'right',
      baseline: 'middle',
      size: 13,
    });
    drawText(ctx, 'label', '→ selects tau', x, 47, {
      color: pal.boneDim,
      align: 'right',
      baseline: 'middle',
      size: 9,
    });
    drawText(ctx, 'data', `tau ${liveTau.toFixed(2)} s`, x, 64, {
      color: pal.phosphor,
      align: 'right',
      baseline: 'middle',
      size: 13,
    });
  }

  // ---- main draw -------------------------------------------------------

  function draw(e) {
    const { ctx, w, h } = e;
    ctx.clearRect(0, 0, w, h);
    const p = plotRect(e);
    const liveTau = tauOf(input);

    // top band: frozen locked-weight schematic + causal readout
    drawSchematic(ctx, e, liveTau);
    drawCausalReadout(ctx, e, liveTau);

    // plot frame + 0.63 target line + the identical drive
    drawGrid(ctx, p);
    drawDrive(ctx, p);

    if (e.reduced) {
      // Static, information-complete frame: overlay the SLOW and FAST
      // extreme responses to the same step, with both settle ticks. This
      // is the contrast, fully resolved, in one frame.
      const slow = buildResponse(GHOST_TAU);
      const fast = buildResponse(FAST_TAU);

      // slow as the dashed anchor, fast as the solid live-equivalent.
      drawCurve(ctx, p, slow.pts, { solid: false, alpha: 0.34, width: 1.5 });
      drawCurve(ctx, p, fast.pts, { solid: true, alpha: 1, width: 2.4 });

      drawSettleTick(ctx, p, slow.settleT, {
        color: pal.phosphor,
        alpha: 0.45,
        label: `${slow.settleT.toFixed(2)} s`,
      });
      drawSettleTick(ctx, p, fast.settleT, {
        color: pal.phosphor,
        alpha: 1,
        label: `${fast.settleT.toFixed(2)} s`,
      });

      // endpoint tau labels
      const fEnd = fast.pts[fast.pts.length - 1];
      const sEnd = slow.pts[slow.pts.length - 1];
      drawText(ctx, 'data', `tau=${FAST_TAU.toFixed(2)}s`, p.x + p.w - 4, valToY(p, fEnd.v) - 6, {
        color: pal.phosphor,
        align: 'right',
        baseline: 'bottom',
        size: 11,
      });
      drawText(ctx, 'data', `tau=${GHOST_TAU.toFixed(2)}s`, p.x + p.w - 4, valToY(p, sEnd.v) + 14, {
        color: rgba(phoRGB, 0.55),
        align: 'right',
        baseline: 'bottom',
        size: 11,
      });
      drawText(ctx, 'label', 'fast input', p.x + 6, valToY(p, fEnd.v) - 4, {
        color: pal.phosphor,
        baseline: 'bottom',
        size: 9,
      });
      drawText(ctx, 'label', 'same drive, other input', p.x + 6, p.y + p.h - 6, {
        color: pal.boneDim,
        alpha: 0.8,
        baseline: 'bottom',
        size: 9,
      });
      return;
    }

    // --- live render: ghost (fixed extreme) + live (slider) ---
    const live = buildResponse(liveTau);
    const gTau = ghostTau(liveTau);
    const ghost = buildResponse(gTau);

    // ghost: dashed, faint, fully drawn — the steady contrast anchor.
    const gHead = drawCurve(ctx, p, ghost.pts, { solid: false, alpha: 0.3, width: 1.5 });
    drawSettleTick(ctx, p, ghost.settleT, {
      color: pal.phosphor,
      alpha: 0.4,
      label: `${ghost.settleT.toFixed(2)} s`,
    });

    // live: solid, bright, swept in by the reveal transient.
    const lHead = drawCurve(ctx, p, live.pts, { solid: true, alpha: 1, width: 2.4 });
    // settle tick only once the reveal sweep has passed the crossing.
    // reveal sweeps the head time across [STEP_T, WINDOW]; show the tick
    // once that head reaches the crossing time.
    const revealHeadT = lerp(STEP_T, WINDOW, reveal);
    if (live.settleT <= WINDOW && revealHeadT >= live.settleT) {
      drawSettleTick(ctx, p, live.settleT, {
        color: pal.phosphor,
        alpha: 1,
        label: `settles in ${live.settleT.toFixed(2)} s`,
      });
    }

    // leading dot on the live curve while it sweeps in.
    if (lHead && reveal < 1) {
      ctx.save();
      ctx.fillStyle = pal.bone;
      ctx.beginPath();
      ctx.arc(lHead.x, lHead.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = pal.phosphor;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    // endpoint labels: live tau at live end, ghost label/tau at ghost end.
    const lEnd = live.pts[live.pts.length - 1];
    if (reveal >= 0.98) {
      drawText(ctx, 'data', `tau=${liveTau.toFixed(2)}s`, p.x + p.w - 4, valToY(p, lEnd.v) - 6, {
        color: pal.phosphor,
        align: 'right',
        baseline: 'bottom',
        size: 11,
      });
    }
    if (gHead) {
      // Pin to the ghost's OWN right endpoint, reading leftward along the
      // curve (not stacked in the top-right corner with the readout).
      drawText(ctx, 'data', `tau=${gTau.toFixed(2)}s`, gHead.x - 64, gHead.y + (gTau > liveTau ? 14 : -6), {
        color: rgba(phoRGB, 0.55),
        align: 'left',
        baseline: 'bottom',
        size: 11,
      });
    }
    // ghost identity label, anchored at left where it diverges.
    drawText(ctx, 'label', 'same drive, other input', p.x + 6, p.y + p.h - 6, {
      color: pal.boneDim,
      alpha: 0.75,
      baseline: 'bottom',
      size: 9,
    });
  }

  function update(dt, e) {
    // Advance the reveal sweep; settle (stop the loop) when complete.
    if (reveal < 1) {
      reveal = clamp(reveal + dt / REVEAL_SECS, 0, 1);
      if (reveal >= 1 && fig) fig.stop();
    }
  }

  fig = createFigure({ canvas, update, draw, autoplay: false });
  const env = fig.env;

  // Trigger a fresh reveal sweep of the live curve.
  function replay() {
    if (env.reduced) {
      fig.render();
      return;
    }
    reveal = 0;
    fig.play();
  }

  // --- input slider: the input STRENGTH (it selects the dynamics) ---
  const label = document.createElement('label');
  label.className = 'ctrl-label';
  label.textContent = 'input strength';
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'ctrl-slider'; // silicon thread -> cool phosphor thumb
  slider.min = '0';
  slider.max = '1';
  slider.step = '0.01';
  slider.value = String(input);
  slider.setAttribute('aria-label', 'input strength (selects the time constant)');

  const readout = document.createElement('span');
  readout.className = 'ctrl-readout';
  const updateReadout = () => {
    readout.textContent = `input ${input.toFixed(2)} → tau ${tauOf(input).toFixed(2)} s`;
  };
  updateReadout();

  slider.addEventListener('input', () => {
    input = clamp(parseFloat(slider.value), 0, 1);
    updateReadout();
    replay(); // re-sweep the live curve at the new tau (ghost holds)
  });

  controls.append(label, slider, readout);

  // Legend chips — color is meaning, always paired with text.
  const chipLive = document.createElement('span');
  chipLive.className = 'ctrl-chip';
  chipLive.style.setProperty('--c', pal.phosphor);
  chipLive.textContent = 'live: membrane V(t)';
  controls.append(chipLive);

  // --- reduced motion: a step button sweeps input across a few values ---
  if (env.reduced) {
    const sweep = [0.85, 0.5, 0.18];
    let si = 0;
    const stepBtn = document.createElement('button');
    stepBtn.className = 'ctrl-btn';
    stepBtn.type = 'button';
    stepBtn.textContent = 'sweep input ⎭';
    stepBtn.addEventListener('click', () => {
      input = sweep[si % sweep.length];
      si++;
      slider.value = String(input);
      updateReadout();
      fig.render();
    });
    controls.append(stepBtn);
  }

  fig.start(); // paints one frame (autoplay:false); reveal kicks via play()
  // First entry: sweep the live curve in once so motion users see it form.
  if (!env.reduced) replay();
  return fig;
}
