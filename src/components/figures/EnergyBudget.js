/* =====================================================================
   EnergyBudget — chapter 6 (the energy walls).

   Two honest little charts in one canvas:
   (a) ENERGY BUDGET on a LOG scale. The brain runs on ~20 watts of
       continuous power; a single large training run burns on the order
       of thousands of MWh. These are *different units* (a steady power
       draw vs a total energy spend), so we frame the comparison as
       orders of magnitude of energy and label everything "≈" / "log
       scale" — never pretending the bars are a clean apples-to-apples
       ratio. The point is the chasm of decades between them.
   (b) WHERE THE ENERGY GOES for one operation: a split bar in which
       DATA MOVEMENT dwarfs the actual COMPUTE — the memory wall. Moving
       operands across the chip costs far more than the multiply itself.

   A small chip schematic with shaded "dark silicon" regions is drawn
   when there's vertical room: not all transistors can be powered at
   once inside the thermal budget.

   Bars ease in on first view (organic ease-out); reduced motion draws
   the final static bars immediately.
   ===================================================================== */

import { createFigure, palette, clamp, lerp } from '../lib/canvas.js';

// --- the honest numbers, all approximate -----------------------------
// We express each bar as an *energy* figure in watt-hours so a single
// log axis can hold both. The brain figure is its ~20 W continuous draw
// taken over one hour (= 20 Wh) purely to place it on an energy axis;
// the label keeps it as "≈ 20 W continuous" so we don't fake precision.
const BRAIN_WH = 20; //  ≈ 20 W * 1 h  -> 20 Wh
const TRAIN_WH = 2_000 * 1e6; // ≈ 2,000 MWh -> 2e9 Wh for a large run

// memory-wall split: relative energy of one fused multiply-add op.
// Moving operands from off-chip / across the die costs ~hundreds of x
// the arithmetic. We use an illustrative ~200:1 movement:compute ratio.
const MOVE_REL = 200;
const COMPUTE_REL = 1;

// organic ease-out (slight overshoot-free settle)
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

export default function mount(stage) {
  const canvas = stage.querySelector('canvas');
  const controls = stage.querySelector('[data-controls]');
  const pal = palette();

  // grow-in animation progress 0..1 (drives both charts)
  let grow = 0;

  function update(dt) {
    if (grow < 1) grow = clamp(grow + dt * 0.9, 0, 1);
  }

  // ---- helpers ----
  const font = '11px "Spline Sans Mono", monospace';
  const head = '600 13px "Spline Sans Mono", monospace';

  // log10 axis: map a watt-hour value to an x fraction across [lo,hi] decades
  const LOG_LO = -1; // 10^-1 Wh  (0.1 Wh) bottom of axis
  const LOG_HI = 10; // 10^10 Wh  top of axis (above the training run)
  function logFrac(wh) {
    const l = Math.log10(wh);
    return clamp((l - LOG_LO) / (LOG_HI - LOG_LO), 0, 1);
  }

  // ===================================================================
  // (a) LOG ENERGY BUDGET
  // ===================================================================
  function drawBudget(e, x0, y0, bw, bh) {
    const { ctx } = e;
    ctx.save();
    ctx.translate(x0, y0);

    ctx.fillStyle = pal.bone;
    ctx.font = head;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('energy, log scale', 0, -10);
    ctx.font = font;
    ctx.fillStyle = pal.graphite;
    ctx.fillText('orders of magnitude — not a literal ratio', 0, 6);

    const axisY = bh - 22; // baseline of the log axis
    const left = 4;
    const right = bw - 4;
    const axisW = right - left;

    // log gridlines + ticks at each decade
    ctx.textBaseline = 'top';
    for (let d = LOG_LO; d <= LOG_HI; d++) {
      const fx = (d - LOG_LO) / (LOG_HI - LOG_LO);
      const px = left + fx * axisW;
      ctx.strokeStyle = pal.graphite;
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, 18);
      ctx.lineTo(px, axisY);
      ctx.stroke();
      ctx.globalAlpha = 1;
      // tick label: 10^d Wh, only every other decade to avoid clutter
      if ((d - LOG_LO) % 2 === 0) {
        ctx.fillStyle = pal.graphite;
        ctx.fillText('1e' + d, px - 7, axisY + 4);
      }
    }
    // axis line
    ctx.strokeStyle = pal.graphite;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(left, axisY);
    ctx.lineTo(right, axisY);
    ctx.stroke();
    ctx.fillStyle = pal.graphite;
    ctx.fillText('watt-hours (≈)', right - 78, axisY + 4);

    // two bars, drawn as horizontal log bars from the axis left edge
    const barH = 16;
    const gap = 12;
    const topBrain = 26;
    const topTrain = topBrain + barH + gap;

    // brain — biology — synapse amber
    const brainW = axisW * logFrac(BRAIN_WH) * easeOut(grow);
    ctx.fillStyle = pal.synapse;
    ctx.fillRect(left, topBrain, Math.max(2, brainW), barH);
    ctx.fillStyle = pal.bone;
    ctx.textBaseline = 'middle';
    ctx.fillText('brain (biology)  ≈ 20 W continuous', left + 6, topBrain + barH / 2);

    // training run — silicon — phosphor; dwarfs the brain across decades
    const trainW = axisW * logFrac(TRAIN_WH) * easeOut(grow);
    ctx.fillStyle = pal.phosphor;
    ctx.fillRect(left, topTrain, Math.max(2, trainW), barH);
    ctx.fillStyle = pal.ink;
    ctx.fillText('training run (silicon)  ≈ thousands of MWh', left + 6, topTrain + barH / 2);

    ctx.restore();
  }

  // ===================================================================
  // (b) WHERE THE ENERGY GOES — the memory wall
  // ===================================================================
  function drawMemoryWall(e, x0, y0, bw, bh) {
    const { ctx } = e;
    ctx.save();
    ctx.translate(x0, y0);

    ctx.fillStyle = pal.bone;
    ctx.font = head;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('where the energy goes (one op)', 0, -10);
    ctx.font = font;
    ctx.fillStyle = pal.graphite;
    ctx.fillText('the memory wall — moving data ≫ computing on it', 0, 6);

    const left = 4;
    const right = bw - 4;
    const fullW = right - left;
    const total = MOVE_REL + COMPUTE_REL;
    const barTop = 26;
    const barH = 26;

    const g = easeOut(grow);
    const moveW = fullW * (MOVE_REL / total) * g;
    const compW = fullW * (COMPUTE_REL / total) * g;

    // data movement — the big one (graphite-grey structure, neutral)
    ctx.fillStyle = pal.graphite;
    ctx.fillRect(left, barTop, moveW, barH);
    // compute — the tiny sliver, in phosphor (silicon arithmetic)
    ctx.fillStyle = pal.phosphor;
    ctx.fillRect(left + moveW, barTop, Math.max(2, compW), barH);

    // labels
    ctx.textBaseline = 'middle';
    ctx.fillStyle = pal.bone;
    ctx.fillText('data movement  ≈ ' + MOVE_REL + '×', left + 8, barTop + barH / 2);
    ctx.fillStyle = pal.bone;
    ctx.textBaseline = 'top';
    ctx.fillText('compute (the multiply) ≈ 1×', left, barTop + barH + 6);

    ctx.restore();
  }

  // ===================================================================
  // dark silicon chip schematic (only when there is vertical room)
  // ===================================================================
  function drawDarkSilicon(e, x0, y0, bw, bh) {
    const { ctx } = e;
    ctx.save();
    ctx.translate(x0, y0);
    ctx.font = font;
    ctx.fillStyle = pal.bone;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('dark silicon', 0, -6);

    const cols = 6;
    const rows = 4;
    const pad = 3;
    const cw = (bw - pad * (cols - 1)) / cols;
    const ch = (bh - pad * (rows - 1)) / rows;
    let idx = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = c * (cw + pad);
        const cy = r * (ch + pad);
        // deterministic checker-ish pattern: only ~40% can be powered
        const lit = (idx * 7 + 3) % 5 < 2;
        idx++;
        if (lit) {
          ctx.fillStyle = pal.phosphor;
          ctx.globalAlpha = 0.85;
        } else {
          ctx.fillStyle = pal.graphite;
          ctx.globalAlpha = 0.5;
        }
        ctx.fillRect(cx, cy, cw, ch);
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function draw(e) {
    const { ctx, w, h } = e;
    ctx.clearRect(0, 0, w, h);
    ctx.textBaseline = 'alphabetic';

    const padX = 16;
    const innerW = w - padX * 2;

    // Responsive layout: side-by-side when wide enough, else stacked.
    const sideBySide = w > 680;

    if (sideBySide) {
      const colW = (innerW - 24) / 2;
      const topY = 34;
      const chartH = Math.min(150, h - topY - 16);
      drawBudget(e, padX, topY, colW, chartH);
      drawMemoryWall(e, padX + colW + 24, topY, colW, chartH);
      // dark silicon strip along the bottom if room remains
      const dsY = topY + chartH + 30;
      if (h - dsY > 70) {
        drawDarkSilicon(e, padX, dsY, innerW, Math.min(64, h - dsY - 8));
      }
    } else {
      const topA = 34;
      const hA = 132;
      drawBudget(e, padX, topA, innerW, hA);
      const topB = topA + hA + 36;
      const hB = 90;
      drawMemoryWall(e, padX, topB, innerW, hB);
      const dsY = topB + hB + 30;
      if (h - dsY > 70) {
        drawDarkSilicon(e, padX, dsY, innerW, Math.min(56, h - dsY - 8));
      }
    }
  }

  const fig = createFigure({ canvas, update, draw });
  const env = fig.env;

  // Under reduced motion, snap bars to final state (no grow animation).
  if (env.reduced) grow = 1;

  // ---- legend chips (color always paired with a text label) ----
  const legend = document.createElement('div');
  legend.style.display = 'flex';
  legend.style.flexWrap = 'wrap';
  legend.style.gap = '10px';
  const chips = [
    [pal.synapse, 'brain / biology'],
    [pal.phosphor, 'silicon / compute'],
    [pal.graphite, 'data movement / structure'],
  ];
  for (const [c, label] of chips) {
    const span = document.createElement('span');
    span.className = 'ctrl-chip';
    span.style.setProperty('--c', c);
    span.textContent = label;
    legend.append(span);
  }
  controls.append(legend);

  // replay button — re-run the grow-in (and the manual affordance under
  // reduced motion where there's no autoplay).
  const replay = document.createElement('button');
  replay.className = 'ctrl-btn';
  replay.type = 'button';
  replay.textContent = env.reduced ? 'step ⏵' : 'replay ↻';
  replay.addEventListener('click', () => {
    if (env.reduced) {
      // step: nudge the grow-in forward and repaint
      grow = grow >= 1 ? 0 : clamp(grow + 0.25, 0, 1);
      fig.render();
    } else {
      grow = 0;
      fig.start();
    }
  });
  controls.append(replay);

  fig.start();
  return fig;
}
