/* =====================================================================
   EnergyBudget — chapter 6 (the energy walls).

   Three honest stacked rows, each full-width, on one canvas:

   (a) ENERGY BUDGET as a LOG DECADE AXIS. The brain runs on ~20 watts of
       continuous power; a single large training run burns on the order of
       thousands of MWh. These are *different units* (a steady power draw vs
       a total energy spend), so we frame the comparison as orders of
       magnitude and label everything "≈" / "log scale" — never pretending
       it's a clean apples-to-apples ratio.

       The redesign makes the LOG SCALE itself the protagonist: a single
       full-width decade axis with every-decade gridlines, and the two values
       plotted as PINS at their decades rather than bars-from-origin. The
       literal distance across the axis between the brain pin and the
       training-run pin IS the message — a bracket spans the gap with the
       hero callout "≈ 8 decades · 10^8×". Two static reference pins
       (laptop-hour, US home / month) make the decades feel concrete. An
       on-canvas footnote ("brain plotted as 20 W × 1 h") surfaces the unit
       window instead of burying it in a comment.

   (b) THE MEMORY WALL — where the energy of one op goes. A full-width split
       bar: DATA MOVEMENT (graphite) dwarfs the actual COMPUTE (phosphor =
       silicon arithmetic, the one phosphor referent in this row), with
       leader lines pointing at each segment and a hero "≈ 200 : 1" callout.

   (c) DARK SILICON — a small chip grid where only ~38% of cells can be
       powered inside the thermal budget. Phosphor outline = powered;
       filled graphite = must stay dark. A 2-item legend + a readout name
       the Dennard-scaling point so the pattern isn't decorative noise.

   COLOUR DISCIPLINE: phosphor is reserved for ONE silicon referent per row
   and always paired with a text label — the training-run pin in (a), the
   compute sliver in (b), the "powered" outline in (c). The brain is synapse
   amber (biology). Structure / data movement / dark cells are graphite.

   MOTION: rows ease in once on first view (a single grow-in); the static
   final frame is information-complete and is exactly what reduced motion
   paints. No per-frame spectacle, no hover readout.
   ===================================================================== */

import { createFigure, palette, clamp, lerp, drawText } from '../lib/canvas.js';

// --- the honest numbers, all approximate -----------------------------
// Each value is an *energy* figure in watt-hours so one log axis holds both.
// The brain figure is its ~20 W continuous draw taken over one hour (= 20 Wh)
// purely to place it on an energy axis; the label keeps it as "≈ 20 W
// continuous" and an on-canvas footnote surfaces the 1-hour window.
const BRAIN_WH = 20;            // ≈ 20 W × 1 h  -> 20 Wh
const TRAIN_WH = 2_000 * 1e6;   // ≈ 2,000 MWh   -> 2e9 Wh for a large run

// Static reference anchors so the decades feel real.
const LAPTOP_WH = 50;           // ≈ a laptop-hour
const HOME_WH = 1e6;            // ≈ a US home for a month (~1 MWh)

// memory-wall split: relative energy of one fused multiply-add op. Moving
// operands from off-chip / across the die costs ~hundreds× the arithmetic.
// We use an illustrative ~200:1 movement:compute ratio.
const MOVE_REL = 200;
const COMPUTE_REL = 1;

// dark silicon: fraction of the grid that can be powered at once.
const DS_COLS = 8;
const DS_ROWS = 3;

// organic ease-out (slight overshoot-free settle)
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

export default function mount(stage) {
  const canvas = stage.querySelector('canvas');
  const controls = stage.querySelector('[data-controls]');
  const pal = palette();

  let fig; // assigned after createFigure so update() can call fig.stop()

  // grow-in animation progress 0..1 (drives all rows)
  let grow = 0;

  function update(dt) {
    if (grow < 1) {
      grow = clamp(grow + dt * 0.9, 0, 1);
      if (grow >= 1 && fig) fig.stop(); // settle still once resolved
    }
  }

  // ---- log decade axis: map a watt-hour value to an x fraction ----------
  const LOG_LO = -1; // 10^-1 Wh (0.1 Wh) — left edge
  const LOG_HI = 10; // 10^10 Wh        — right edge (above the training run)
  const logFrac = (wh) =>
    clamp((Math.log10(wh) - LOG_LO) / (LOG_HI - LOG_LO), 0, 1);

  // pretty decade exponent for a value, e.g. 2e9 -> 9
  const decadeOf = (wh) => Math.round(Math.log10(wh));

  // ===================================================================
  // (a) LOG ENERGY-BUDGET DECADE AXIS
  // ===================================================================
  function drawBudget(e, x0, y0, bw, bh) {
    const { ctx } = e;
    const g = easeOut(grow);
    ctx.save();
    ctx.translate(x0, y0);

    // heading: title (thesis voice) + label (chrome)
    drawText(ctx, 'title', 'The energy gap is measured in decades, not multiples', 0, 0, {
      baseline: 'top',
    });
    drawText(ctx, 'label', 'energy · log scale · ≈ not a literal ratio', 0, 18, {
      color: pal.boneDim,
      baseline: 'top',
    });

    const left = 6;
    const right = bw - 6;
    const axisW = right - left;
    const axisY = bh - 26; // baseline of the decade axis sits near the bottom
    const gridTop = 40;     // gridlines start below the heading

    const fxOf = (wh) => left + logFrac(wh) * axisW;
    const xAt = (decade) =>
      left + ((decade - LOG_LO) / (LOG_HI - LOG_LO)) * axisW;

    // --- decade gridlines + tick labels ---
    for (let d = LOG_LO; d <= LOG_HI; d++) {
      const px = xAt(d);
      ctx.strokeStyle = pal.graphite;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, gridTop);
      ctx.lineTo(px, axisY);
      ctx.stroke();
      ctx.globalAlpha = 1;
      if ((d - LOG_LO) % 2 === 0) {
        drawText(ctx, 'label', '10' + supExp(d), px, axisY + 6, {
          color: pal.boneDim,
          align: 'center',
          baseline: 'top',
          size: 9.5,
          tracking: 0.04,
        });
      }
    }

    // axis line
    ctx.strokeStyle = pal.graphite;
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(left, axisY);
    ctx.lineTo(right, axisY);
    ctx.stroke();
    ctx.globalAlpha = 1;
    drawText(ctx, 'label', 'watt-hours (≈)', right, axisY + 6, {
      color: pal.boneDim,
      align: 'right',
      baseline: 'top',
      size: 9.5,
    });

    // --- static reference pins (graphite, low key) ---
    // The laptop-hour sits at nearly the same decade as the brain pin, so its
    // label is dropped BELOW the axis (below: true) to clear the brain pin's
    // stacked value/name which live above the axis. US-home stays above.
    const refY = axisY;
    drawRefPin(ctx, fxOf(LAPTOP_WH), refY, axisY + 34, 'laptop-hour ≈ 50 Wh', pal, { below: true });
    drawRefPin(ctx, fxOf(HOME_WH), refY, gridTop + 26, 'US home / month ≈ 1 MWh', pal);

    // --- the two hero pins ---
    // Pin heads sit on a band above the axis; stems drop to the axis.
    const pinHeadY = gridTop + 30;
    const brainX = fxOf(BRAIN_WH);
    const trainX = fxOf(TRAIN_WH);

    // brain — biology — synapse amber (the one warm referent)
    drawValuePin(ctx, brainX, axisY, pinHeadY, pal.synapse, g, {
      value: '≈ 20 W',
      name: 'brain · biology',
      align: brainX < axisW * 0.5 ? 'left' : 'right',
    });

    // training run — silicon — phosphor (the one silicon referent here)
    drawValuePin(ctx, trainX, axisY, pinHeadY, pal.phosphor, g, {
      value: '≈ 2,000 MWh',
      name: 'one training run · silicon',
      align: 'right',
    });

    // --- the gap bracket + hero callout (the punch) ---
    // A double-headed arrow between the two pins along a bracket line, with
    // the decade span as the headline. Reveal width tracks grow.
    const brTop = pinHeadY - 16;
    const bx0 = brainX;
    const bx1 = lerp(brainX, trainX, g);
    ctx.strokeStyle = pal.bone;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(bx0, brTop);
    ctx.lineTo(bx1, brTop);
    ctx.stroke();
    // arrow ticks at both ends (drawn at full extent only once settled enough)
    drawArrowTick(ctx, bx0, brTop, +1);
    if (g > 0.5) drawArrowTick(ctx, bx1, brTop, -1);
    ctx.globalAlpha = 1;

    const gapDecades = decadeOf(TRAIN_WH) - decadeOf(BRAIN_WH); // ~8
    const midX = (brainX + trainX) / 2;
    drawText(ctx, 'title', '≈ ' + gapDecades + ' decades · 10' + supExp(gapDecades) + '×', midX, brTop - 8, {
      align: 'center',
      baseline: 'bottom',
      size: 16,
    });

    // footnote: surface the unit window so the 1-hour fudge is visible
    drawText(ctx, 'label', 'brain plotted as 20 W × 1 h', left, axisY + 20, {
      color: pal.boneDim,
      baseline: 'top',
      size: 9,
      tracking: 0.03,
    });

    ctx.restore();
  }

  // small caret-style reference pin: thin graphite stem + dim mono label.
  // o.below=true drops the label beneath the axis (headY is then below axisY)
  // so a reference that crowds a hero pin above the axis can step out of its way.
  function drawRefPin(ctx, x, axisY, headY, label, pal, o = {}) {
    const below = !!o.below;
    ctx.save();
    ctx.strokeStyle = pal.graphite;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(x, headY);
    ctx.lineTo(x, axisY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    // diamond head
    ctx.fillStyle = pal.graphite;
    ctx.beginPath();
    ctx.moveTo(x, headY - 4);
    ctx.lineTo(x + 3, headY);
    ctx.lineTo(x, headY + 4);
    ctx.lineTo(x - 3, headY);
    ctx.closePath();
    ctx.fill();
    drawText(ctx, 'data', label, x, below ? headY + 6 : headY - 6, {
      color: pal.boneDim,
      align: 'center',
      baseline: below ? 'top' : 'bottom',
      size: 9,
      alpha: 0.85,
    });
    ctx.restore();
  }

  // a value pin: filled colour head, stem to axis, value + name stacked
  function drawValuePin(ctx, x, axisY, headY, color, g, o) {
    ctx.save();
    // stem
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.9 * g + 0.1;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, headY);
    ctx.lineTo(x, axisY);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // filled circle head
    const r = 5;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, headY, r, 0, Math.PI * 2);
    ctx.fill();
    // dot at the axis foot
    ctx.beginPath();
    ctx.arc(x, axisY, 2.5, 0, Math.PI * 2);
    ctx.fill();
    // value (data tier, in the referent colour) + name (label tier, dim)
    const align = o.align || 'left';
    const tx = align === 'right' ? x - 9 : x + 9;
    drawText(ctx, 'data', o.value, tx, headY - 6, {
      color,
      align,
      baseline: 'middle',
      size: 12,
    });
    drawText(ctx, 'label', o.name, tx, headY + 8, {
      color: pal.bone,
      align,
      baseline: 'middle',
      size: 9,
      tracking: 0.03,
    });
    ctx.restore();
  }

  function drawArrowTick(ctx, x, y, dir) {
    ctx.save();
    ctx.strokeStyle = pal.bone;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + dir * 6, y - 4);
    ctx.moveTo(x, y);
    ctx.lineTo(x + dir * 6, y + 4);
    ctx.stroke();
    ctx.restore();
  }

  // ===================================================================
  // (b) THE MEMORY WALL — full-width split bar
  // ===================================================================
  function drawMemoryWall(e, x0, y0, bw, bh) {
    const { ctx } = e;
    const g = easeOut(grow);
    ctx.save();
    ctx.translate(x0, y0);

    drawText(ctx, 'title', 'Moving the data costs far more than computing on it', 0, 0, {
      baseline: 'top',
    });
    drawText(ctx, 'label', 'the memory wall · energy of one op', 0, 18, {
      color: pal.boneDim,
      baseline: 'top',
    });

    const left = 6;
    const right = bw - 6;
    const fullW = right - left;
    const total = MOVE_REL + COMPUTE_REL;
    const barTop = 44;
    const barH = 46; // tall enough to read as a solid mass, not a strip

    // The compute sliver is the silicon referent. To scale it is ~1/201 of the
    // bar (≈ 1–2 px) and would vanish — so we floor it at a small but legible
    // nub (NUB_MIN) and give it a bold phosphor fill. The bar carries an "≈"
    // and a "200 : 1" callout, so this is an honest marker, not a to-scale claim.
    const NUB_MIN = 9;
    const compFracW = Math.max(NUB_MIN, fullW * (COMPUTE_REL / total));
    const moveFracW = fullW - compFracW; // movement fills the rest, full-width
    const moveW = moveFracW * g;
    const compW = compFracW * g;

    // data movement — BOLD solid graphite mass (the one that dominates)
    ctx.fillStyle = pal.graphite;
    ctx.fillRect(left, barTop, moveW, barH);
    // compute — phosphor nub at the far end (silicon arithmetic — the one
    // referent here): a clearly filled rectangle, not a hairline.
    ctx.fillStyle = pal.phosphor;
    ctx.fillRect(left + moveW, barTop, compW, barH);

    // hard ink seam between the mass and the nub so the boundary is crisp
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(left + moveW, barTop);
    ctx.lineTo(left + moveW, barTop + barH);
    ctx.stroke();

    // hero ratio callout above the bar
    drawText(ctx, 'title', '≈ 200 : 1', right, barTop - 8, {
      align: 'right',
      baseline: 'bottom',
      size: 16,
    });

    // --- leader lines + segment labels ---
    const moveMidX = left + moveFracW * 0.5;
    const compFootX = left + moveFracW + compFracW * 0.5;
    const labelY = barTop + barH + 18;

    // data-movement leader (down from inside the big segment)
    leader(ctx, moveMidX, barTop + barH, moveMidX, labelY - 6, pal.boneDim);
    drawText(ctx, 'label', 'data movement', moveMidX, labelY, {
      color: pal.bone,
      align: 'center',
      baseline: 'top',
      size: 10,
    });
    drawText(ctx, 'data', '≈ 200×', moveMidX, labelY + 13, {
      color: pal.boneDim,
      align: 'center',
      baseline: 'top',
      size: 10,
    });

    // compute leader (angled out to the right so it doesn't crowd the sliver)
    const compLblX = right;
    leader(ctx, left + moveW + compW / 2, barTop + barH, compLblX, labelY - 6, pal.phosphor);
    drawText(ctx, 'label', 'compute (the multiply)', compLblX, labelY, {
      color: pal.phosphor,
      align: 'right',
      baseline: 'top',
      size: 10,
    });
    drawText(ctx, 'data', '≈ 1×', compLblX, labelY + 13, {
      color: pal.phosphor,
      align: 'right',
      baseline: 'top',
      size: 10,
    });

    ctx.restore();
  }

  function leader(ctx, x1, y1, x2, y2, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ===================================================================
  // (c) DARK SILICON — chip grid with legend + honest readout
  // ===================================================================
  function drawDarkSilicon(e, x0, y0, bw, bh) {
    const { ctx } = e;
    ctx.save();
    ctx.translate(x0, y0);

    drawText(ctx, 'title', 'Not all of the chip can run at once', 0, 0, {
      baseline: 'top',
    });
    drawText(ctx, 'label', 'dark silicon · thermal budget', 0, 18, {
      color: pal.boneDim,
      baseline: 'top',
    });

    // grid sits in the left ~58%; legend + readout on the right
    const gridTop = 36;
    const gridW = Math.min(bw * 0.56, 280);
    const gridH = Math.max(0, bh - gridTop - 4);
    const pad = 4;
    const cw = (gridW - pad * (DS_COLS - 1)) / DS_COLS;
    const chh = (gridH - pad * (DS_ROWS - 1)) / DS_ROWS;

    let idx = 0;
    let litCount = 0;
    for (let r = 0; r < DS_ROWS; r++) {
      for (let c = 0; c < DS_COLS; c++) {
        const cx = c * (cw + pad);
        const cy = gridTop + r * (chh + pad);
        // deterministic pattern: only ~38% can be powered at once
        const lit = (idx * 7 + 3) % 5 < 2;
        idx++;
        if (lit) litCount++;
        if (lit) {
          // powered: phosphor OUTLINE (not fill) so phosphor stays the
          // silicon referent without out-shouting the (b) compute sliver
          ctx.fillStyle = pal.phosphor;
          ctx.globalAlpha = 0.16;
          ctx.fillRect(cx, cy, cw, chh);
          ctx.globalAlpha = 1;
          ctx.strokeStyle = pal.phosphor;
          ctx.lineWidth = 1.25;
          ctx.strokeRect(cx + 0.5, cy + 0.5, cw - 1, chh - 1);
        } else {
          // must stay dark: filled graphite
          ctx.fillStyle = pal.graphite;
          ctx.globalAlpha = 0.45;
          ctx.fillRect(cx, cy, cw, chh);
          ctx.globalAlpha = 1;
        }
      }
    }

    const total = DS_COLS * DS_ROWS;
    const pct = Math.round((litCount / total) * 100);

    // legend + readout on the right
    const lx = gridW + 28;
    let ly = gridTop + 2;
    // powered chip
    ctx.strokeStyle = pal.phosphor;
    ctx.lineWidth = 1.25;
    ctx.strokeRect(lx + 0.5, ly + 0.5, 13, 13);
    drawText(ctx, 'label', 'powered', lx + 20, ly + 7, {
      color: pal.phosphor,
      baseline: 'middle',
      size: 9.5,
    });
    ly += 22;
    // dark chip
    ctx.fillStyle = pal.graphite;
    ctx.globalAlpha = 0.45;
    ctx.fillRect(lx, ly, 14, 14);
    ctx.globalAlpha = 1;
    drawText(ctx, 'label', 'must stay dark', lx + 20, ly + 7, {
      color: pal.boneDim,
      baseline: 'middle',
      size: 9.5,
    });
    ly += 30;
    drawText(ctx, 'data', '≈ ' + pct + '% can be powered at once', lx, ly, {
      color: pal.bone,
      baseline: 'top',
      size: 11,
    });

    ctx.restore();
  }

  // ===================================================================
  // layout — three full-width rows distributed over the real height
  // ===================================================================
  function draw(e) {
    const { ctx, w, h } = e;
    ctx.clearRect(0, 0, w, h);
    ctx.textBaseline = 'alphabetic';

    const padX = 18;
    const padY = 14;
    const innerW = w - padX * 2;
    const innerH = h - padY * 2;

    // weight the three rows: budget axis is the protagonist, then the wall,
    // then a shorter dark-silicon row. Gaps between rows.
    const gap = 26;
    const usable = innerH - gap * 2;
    const hA = Math.round(usable * 0.40);
    const hB = Math.round(usable * 0.33);
    const hC = usable - hA - hB;

    let y = padY;
    drawBudget(e, padX, y, innerW, hA);
    y += hA + gap;
    drawMemoryWall(e, padX, y, innerW, hB);
    y += hB + gap;
    drawDarkSilicon(e, padX, y, innerW, hC);
  }

  const fig0 = createFigure({ canvas, update, draw });
  fig = fig0;
  const env = fig.env;

  // Under reduced motion, snap everything to the final static frame.
  if (env.reduced) grow = 1;

  // ---- legend chips (colour always paired with a text label) ----
  const legend = document.createElement('div');
  legend.style.display = 'flex';
  legend.style.flexWrap = 'wrap';
  legend.style.gap = '10px';
  const chips = [
    [pal.synapse, 'brain / biology'],
    [pal.phosphor, 'silicon / compute'],
    [pal.graphite, 'data movement / dark'],
  ];
  for (const [c, label] of chips) {
    const span = document.createElement('span');
    span.className = 'ctrl-chip';
    span.style.setProperty('--c', c);
    span.textContent = label;
    legend.append(span);
  }
  controls.append(legend);

  // replay button — re-run the one grow-in. Under reduced motion this is a
  // manual "step" affordance that nudges the grow forward without looping.
  const replay = document.createElement('button');
  replay.className = 'ctrl-btn';
  replay.type = 'button';
  replay.textContent = env.reduced ? 'step ⏵' : 'replay ↻';
  replay.addEventListener('click', () => {
    if (env.reduced) {
      grow = grow >= 1 ? 0 : clamp(grow + 0.25, 0, 1);
      fig.render();
    } else {
      grow = 0;
      fig.play(); // force the loop even though it's currently still
    }
  });
  controls.append(replay);

  fig.start();
  return fig;
}

// superscript exponent rendering for "10^n" using unicode superscripts.
function supExp(n) {
  const map = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
  return String(n)
    .split('')
    .map((ch) => map[ch] || ch)
    .join('');
}
