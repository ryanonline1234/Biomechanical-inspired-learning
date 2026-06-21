/* =====================================================================
   StabilityPlasticity — chapter 5.1 (the stability–plasticity dilemma).

   One horizontal slider sweeps from "rigid (can't learn)" on the left to
   "chaotic (forgets everything)" on the right. Two competing abilities are
   plotted as CURVES across the whole slider range:
     - LEARNING  (plasticity): rises 0 → 1 left-to-right  (synapse / warm)
     - RETENTION (stability) : its mirror, 1 → 0          (phosphor / cool)
   VIABILITY = min(LEARNING, RETENTION). The region under that min is the
   "viable lens": the only slice where BOTH abilities stay high. The band
   edges are DERIVED from where min(L,R) crosses a threshold — never
   hardcoded — so the painted lens and the math can never disagree.

   Slider-driven: re-renders on input only. No autoplay, no shimmer.
   ===================================================================== */

import {
  createFigure,
  palette,
  clamp,
  hexToRgb,
  rgba,
  drawText,
  makeSpring,
  SPRING,
} from '../lib/canvas.js';

// Hermite smoothstep over an explicit window [e0, e1].
const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

// The transition window. Tuned (knee centred ~0.42, half-width ~0.26) so that
// at the centre both abilities sit ~72% AND the min-overlap lens is genuinely
// NARROW — the knife-edge the prose promises. See the band derivation below.
const KNEE_LO = 0.16;
const KNEE_HI = 0.68;

// Viability threshold. The "viable" band is exactly where min(L,R) >= this.
const VIABLE_TH = 0.6;

const learningAt = (p) => smoothstep(KNEE_LO, KNEE_HI, p);
const retentionAt = (p) => smoothstep(KNEE_LO, KNEE_HI, 1 - p);
const viabilityAt = (p) => Math.min(learningAt(p), retentionAt(p));

// Derive the viable band edges ONCE from the threshold crossing, so the band
// can never drift from the math. (Symmetric, but we scan rather than assume.)
function deriveBand() {
  let lo = null;
  let hi = null;
  const N = 2000;
  for (let i = 0; i <= N; i++) {
    const p = i / N;
    if (viabilityAt(p) >= VIABLE_TH) {
      if (lo === null) lo = p;
      hi = p;
    }
  }
  // Fallback (should not happen with the tuned window): collapse to centre.
  if (lo === null) return { lo: 0.5, hi: 0.5 };
  return { lo, hi };
}
const BAND = deriveBand();
const inBand = (p) => p >= BAND.lo && p <= BAND.hi;

export default function mount(stage) {
  const canvas = stage.querySelector('canvas');
  const controls = stage.querySelector('[data-controls]');
  const pal = palette();
  const synRGB = hexToRgb(pal.synapse); // biological / learning  (warm)
  const phoRGB = hexToRgb(pal.phosphor); // silicon / retention   (cool)

  // Slider position [0,1] is spring-driven so the readout line, the meter dots
  // and the live learn/retain percentages SETTLE toward the new value instead of
  // snapping. Critically damped, so the % readouts never overshoot into a wrong
  // number. The static curves / lens / grid don't read this — only the position.
  const posS = makeSpring(SPRING.snappy, 0.5);

  function draw(e) {
    const { ctx, w, h } = e;
    const pos = clamp(posS.value, 0, 1);
    ctx.clearRect(0, 0, w, h);

    // ---- plot geometry: curves live in the upper region of the stage ----
    const padX = 40;
    const plotX = padX;
    const plotW = w - padX * 2;
    const plotTop = 30;
    const plotBottom = Math.round(h * 0.62);
    const plotH = plotBottom - plotTop;

    // value (0..1) -> y. 1 at top, 0 at baseline.
    const vy = (v) => plotBottom - clamp(v, 0, 1) * plotH;
    // position (0..1) -> x.
    const px = (p) => plotX + clamp(p, 0, 1) * plotW;

    // ---- thesis line (title tier) ----
    drawText(
      ctx,
      'title',
      'Only a narrow band keeps both high',
      plotX,
      18,
      { baseline: 'alphabetic' }
    );

    // ---- baseline grid: 0 / 50 / 100% ----
    ctx.save();
    ctx.strokeStyle = rgba(hexToRgb(pal.graphite), 0.55);
    ctx.lineWidth = 1;
    for (const gv of [0, 0.5, 1]) {
      const gy = vy(gv);
      ctx.beginPath();
      ctx.moveTo(plotX, gy);
      ctx.lineTo(plotX + plotW, gy);
      ctx.stroke();
      drawText(ctx, 'label', `${Math.round(gv * 100)}`, plotX - 8, gy, {
        color: pal.boneDim,
        align: 'right',
        baseline: 'middle',
        size: 9.5,
      });
    }
    ctx.restore();

    // ---- shaded viable lens: the area under min(L,R) ----
    // This shaded region IS the viable zone; its narrowness is self-evident.
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(plotX, plotBottom);
    const STEPS = 160;
    for (let i = 0; i <= STEPS; i++) {
      const p = i / STEPS;
      ctx.lineTo(px(p), vy(viabilityAt(p)));
    }
    ctx.lineTo(plotX + plotW, plotBottom);
    ctx.closePath();
    ctx.fillStyle = rgba(phoRGB, 0.16);
    ctx.fill();
    ctx.restore();

    // ---- the two ability curves ----
    const plotCurve = (fn, rgb, lw) => {
      ctx.save();
      ctx.strokeStyle = rgba(rgb, 0.95);
      ctx.lineWidth = lw;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let i = 0; i <= STEPS; i++) {
        const p = i / STEPS;
        const x = px(p);
        const y = vy(fn(p));
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    };
    plotCurve(retentionAt, phoRGB, 2.2); // retention (cool) under
    plotCurve(learningAt, synRGB, 2.2); // learning (warm) over

    // ---- viable-band edge ticks ("edge of viability") ----
    ctx.save();
    ctx.strokeStyle = rgba(phoRGB, 0.55);
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    for (const edge of [BAND.lo, BAND.hi]) {
      const ex = px(edge);
      ctx.beginPath();
      ctx.moveTo(ex, plotTop);
      ctx.lineTo(ex, plotBottom);
      ctx.stroke();
    }
    ctx.restore();
    // One small centred tag under the band's midline — the dashed ticks and the
    // shaded lens already carry the meaning, so no per-edge "edge of viability".
    drawText(
      ctx,
      'label',
      'viable band',
      px((BAND.lo + BAND.hi) / 2),
      vy(0) - 6,
      { color: pal.boneDim, align: 'center', baseline: 'alphabetic', size: 9 }
    );

    // ---- vertical readout line at the slider position ----
    const learning = learningAt(pos);
    const retention = retentionAt(pos);
    const rx = px(pos);

    ctx.save();
    ctx.strokeStyle = rgba(hexToRgb(pal.bone), 0.7);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(rx, plotTop);
    ctx.lineTo(rx, plotBottom);
    ctx.stroke();
    ctx.restore();

    // labelled dot on each curve where the readout line crosses it.
    const drawDot = (val, rgb, labelColor, side) => {
      const dy = vy(val);
      ctx.save();
      ctx.fillStyle = rgba(rgb, 1);
      ctx.beginPath();
      ctx.arc(rx, dy, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = rgba(hexToRgb(pal.ink), 0.9);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
      // value label, offset to the side that keeps it on-canvas.
      const near = pos > 0.78;
      const align = near ? 'right' : 'left';
      const ox = near ? -10 : 10;
      drawText(ctx, 'data', `${Math.round(val * 100)}%`, rx + ox, dy + side, {
        color: labelColor,
        align,
        baseline: 'middle',
        size: 11.5,
      });
    };
    // place the two value labels so they don't collide when curves are close.
    const learnAbove = learning >= retention;
    drawDot(learning, synRGB, pal.synapse, learnAbove ? -10 : 12);
    drawDot(retention, phoRGB, pal.phosphor, learnAbove ? 12 : -10);

    // axis end labels under the plot.
    drawText(ctx, 'label', 'rigid', plotX, plotBottom + 16, {
      color: pal.bone,
      align: 'left',
      baseline: 'alphabetic',
    });
    drawText(ctx, 'label', "can't learn", plotX, plotBottom + 30, {
      color: pal.boneDim,
      align: 'left',
      baseline: 'alphabetic',
      size: 9,
    });
    drawText(ctx, 'label', 'chaotic', plotX + plotW, plotBottom + 16, {
      color: pal.bone,
      align: 'right',
      baseline: 'alphabetic',
    });
    drawText(ctx, 'label', 'forgets everything', plotX + plotW, plotBottom + 30, {
      color: pal.boneDim,
      align: 'right',
      baseline: 'alphabetic',
      size: 9,
    });

    // Curve-identity labels, set INSIDE the plot near each curve's high end but
    // dropped well below the 100% line so they clear the title row and ticks.
    // LEARNING peaks on the right; RETENTION peaks on the left.
    drawText(ctx, 'label', 'LEARNING', plotX + plotW, vy(0.78), {
      color: pal.synapse,
      align: 'right',
      baseline: 'middle',
      size: 9.5,
    });
    drawText(ctx, 'label', 'RETENTION', plotX, vy(0.78), {
      color: pal.phosphor,
      align: 'left',
      baseline: 'middle',
      size: 9.5,
    });

    // ---- MoE motif + verdict, in the lower region ----
    const viable = inBand(pos);
    const regime = viable ? 'viable' : pos < BAND.lo ? 'rigid' : 'chaotic';
    const motifY = plotBottom + 56;
    drawMoE(ctx, w, motifY, regime, pal, synRGB);

    // verdict note: phosphor + bullet when viable, dim graphite otherwise.
    const noteY = h - 12;
    if (viable) {
      drawText(
        ctx,
        'title',
        '● viable — learns without forgetting',
        w / 2,
        noteY,
        { color: pal.phosphor, align: 'center', baseline: 'alphabetic' }
      );
    } else if (regime === 'rigid') {
      drawText(
        ctx,
        'title',
        'too rigid — retains but cannot adapt',
        w / 2,
        noteY,
        { color: pal.boneDim, align: 'center', baseline: 'alphabetic' }
      );
    } else {
      drawText(
        ctx,
        'title',
        'too plastic — adapts but forgets',
        w / 2,
        noteY,
        { color: pal.boneDim, align: 'center', baseline: 'alphabetic' }
      );
    }
  }

  // The chapter's MoE intuition, as a small STATIC motif: a fixed dark "stable
  // core" block plus a row of expert dots. Which experts are lit encodes the
  // regime — viable lights a few, rigid lights none, chaotic lights all (the
  // "everything churns" failure). Lit/dim is the payload; no animation.
  function drawMoE(ctx, w, cy, regime, pal, synRGB) {
    const coreW = 26;
    const coreH = 16;
    const gap = 14;
    const dotR = 4;
    const nExperts = 6;
    const dotGap = 16;
    const totalW = coreW + gap + (nExperts - 1) * dotGap;
    const startX = (w - totalW) / 2;

    // stable core (fixed dark block) — always present, never changes.
    ctx.save();
    ctx.fillStyle = rgba(hexToRgb(pal.graphite), 0.9);
    ctx.fillRect(startX, cy - coreH / 2, coreW, coreH);
    ctx.strokeStyle = rgba(hexToRgb(pal.bone), 0.4);
    ctx.lineWidth = 1;
    ctx.strokeRect(startX, cy - coreH / 2, coreW, coreH);
    ctx.restore();

    // which experts are lit, per regime.
    // viable: a sparse few (2). rigid: none. chaotic: all (churn).
    let lit;
    if (regime === 'viable') lit = [1, 3];
    else if (regime === 'rigid') lit = [];
    else lit = [0, 1, 2, 3, 4, 5];

    const dotX0 = startX + coreW + gap;
    for (let i = 0; i < nExperts; i++) {
      const dx = dotX0 + i * dotGap;
      const on = lit.includes(i);
      ctx.save();
      ctx.beginPath();
      ctx.arc(dx, cy, dotR, 0, Math.PI * 2);
      ctx.fillStyle = on
        ? rgba(synRGB, 0.95)
        : rgba(hexToRgb(pal.graphite), 0.6);
      ctx.fill();
      ctx.restore();
    }

    const expLabel =
      regime === 'rigid'
        ? 'experts frozen'
        : regime === 'chaotic'
        ? 'all experts churn'
        : 'few experts adapt';
    // One combined caption centred under the whole motif (stable core + experts),
    // so the two halves can never run together at the motif's narrow width.
    drawText(ctx, 'label', 'stable core · ' + expLabel, w / 2, cy + coreH / 2 + 13, {
      color: regime === 'viable' ? pal.synapse : pal.boneDim,
      align: 'center',
      baseline: 'alphabetic',
      size: 8.5,
    });
  }

  // Advance the spring while it's still settling; stop the loop once it arrives
  // so the figure isn't in perpetual motion.
  function update(dt) {
    posS.step(dt);
    if (posS.settled()) fig.stop();
  }

  const fig = createFigure({ canvas, update, draw, autoplay: false });
  const env = fig.env;

  // Re-aim the slider position: spring toward the target under motion, snap
  // instantly under reduced motion (one honest static frame).
  function aim(target) {
    if (env.reduced) {
      posS.snap(target);
      fig.render();
    } else {
      posS.to(target);
      fig.play();
    }
  }

  // --- the dilemma slider ---
  const label = document.createElement('span');
  label.className = 'ctrl-label';
  label.textContent = 'rigid ←→ chaotic';
  controls.append(label);

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'ctrl-slider';
  slider.min = '0';
  slider.max = '1000';
  slider.value = String(Math.round(posS.value * 1000));
  slider.setAttribute('aria-label', 'stability–plasticity balance');
  slider.addEventListener('input', () => {
    const target = clamp(Number(slider.value) / 1000, 0, 1);
    // Text snaps to the TARGET immediately (it shouldn't lerp); the readout line
    // and dots spring toward it.
    readout.textContent = readoutText(target);
    aim(target);
  });
  controls.append(slider);

  // Text readout for a given position. Takes an explicit value so it can name
  // the TARGET the slider just selected rather than the still-easing spring.
  function readoutText(p) {
    const learning = learningAt(p);
    const retention = retentionAt(p);
    const tag = inBand(p) ? 'viable' : p < BAND.lo ? 'rigid' : 'chaotic';
    return `learn ${Math.round(learning * 100)}% · retain ${Math.round(
      retention * 100
    )}% · ${tag}`;
  }

  const readout = document.createElement('span');
  readout.className = 'ctrl-readout';
  readout.textContent = readoutText(0.5);
  controls.append(readout);

  // legend chips — text labels paired with the meaningful colours.
  const legend = document.createElement('div');
  const chipL = document.createElement('span');
  chipL.className = 'ctrl-chip';
  chipL.style.setProperty('--c', pal.synapse);
  chipL.textContent = 'learning (plasticity)';
  const chipR = document.createElement('span');
  chipR.className = 'ctrl-chip';
  chipR.style.setProperty('--c', pal.phosphor);
  chipR.textContent = 'retention (stability)';
  legend.append(chipL, chipR);
  controls.append(legend);

  fig.start(); // autoplay:false -> paints one static frame (the p=0.5 lens).
  return fig;
}
