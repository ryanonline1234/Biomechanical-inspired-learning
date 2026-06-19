/* =====================================================================
   StabilityPlasticity — chapter 5.1 (the stability–plasticity dilemma).

   One horizontal slider sweeps from "rigid (can't learn)" on the left to
   "chaotic (forgets everything)" on the right. Two derived meters trade off:
     - LEARNING  (plasticity): ~0 when rigid, rises toward chaos
     - RETENTION (stability) : high when rigid, collapses toward chaos
   A narrow "sweet spot" band near the middle is the only place where BOTH
   stay reasonably high. Slider-driven, so no autoplay is needed; a faint
   shimmer plays only when motion is allowed.
   ===================================================================== */

import { createFigure, palette, clamp, lerp, hexToRgb, rgba } from '../lib/canvas.js';

// The viable band, in normalized slider position [0,1].
const SWEET_LO = 0.42;
const SWEET_HI = 0.58;

// Smooth easing so the meters feel organic rather than linear.
const smooth = (t) => t * t * (3 - 2 * t);

export default function mount(stage) {
  const canvas = stage.querySelector('canvas');
  const controls = stage.querySelector('[data-controls]');
  const pal = palette();
  const phoRGB = hexToRgb(pal.phosphor); // silicon / retention-ish cool
  const synRGB = hexToRgb(pal.synapse);  // biological / learning warm

  let pos = 0.5; // normalized slider position [0,1]

  // Derive the two competing abilities from the slider position.
  // learning rises with position (smoothed); retention falls with a sharper
  // knee so it collapses quickly once we pass the middle.
  function meters(p) {
    const learning = smooth(clamp(p, 0, 1));
    // retention: high at left, sharp falloff past centre (cubic-ish knee)
    const r = clamp(1 - p, 0, 1);
    const retention = smooth(r) * (0.35 + 0.65 * r * r);
    return { learning, retention };
  }

  function inSweet(p) {
    return p >= SWEET_LO && p <= SWEET_HI;
  }

  function draw(e) {
    const { ctx, w, h } = e;
    ctx.clearRect(0, 0, w, h);

    const padX = 36;
    const trackY = Math.round(h * 0.30);
    const trackW = w - padX * 2;
    const x0 = padX;

    // faint shimmer only when motion allowed — a subtle traveling glint on
    // the sweet-spot band; purely decorative and skipped under reduced motion.
    const shimmer = e.reduced ? 0 : 0.5 + 0.5 * Math.sin(e.t * 2.2);

    // --- the track ---
    ctx.save();
    ctx.strokeStyle = pal.graphite;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x0, trackY);
    ctx.lineTo(x0 + trackW, trackY);
    ctx.stroke();

    // sweet-spot band highlight
    const sx = x0 + SWEET_LO * trackW;
    const sw = (SWEET_HI - SWEET_LO) * trackW;
    ctx.fillStyle = rgba(phoRGB, 0.14 + shimmer * 0.06);
    ctx.fillRect(sx, trackY - 16, sw, 32);
    ctx.strokeStyle = rgba(phoRGB, 0.7);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(sx, trackY - 16, sw, 32);
    ctx.restore();

    // band label
    ctx.font = '11px "Spline Sans Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = pal.phosphor;
    ctx.fillText('sweet spot · viable', sx + sw / 2, trackY - 24);

    // end labels
    ctx.fillStyle = pal.bone;
    ctx.textAlign = 'left';
    ctx.fillText('rigid', x0, trackY + 34);
    ctx.font = '10px "Spline Sans Mono", monospace';
    ctx.fillStyle = pal.graphite;
    ctx.fillText("can't learn", x0, trackY + 48);
    ctx.font = '11px "Spline Sans Mono", monospace';
    ctx.fillStyle = pal.bone;
    ctx.textAlign = 'right';
    ctx.fillText('chaotic', x0 + trackW, trackY + 34);
    ctx.font = '10px "Spline Sans Mono", monospace';
    ctx.fillStyle = pal.graphite;
    ctx.fillText('forgets everything', x0 + trackW, trackY + 48);

    // --- moving indicator ---
    const ix = x0 + pos * trackW;
    ctx.save();
    ctx.strokeStyle = pal.bone;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ix, trackY - 18);
    ctx.lineTo(ix, trackY + 18);
    ctx.stroke();
    ctx.fillStyle = pal.bone;
    ctx.beginPath();
    ctx.arc(ix, trackY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // --- the two bar meters ---
    const { learning, retention } = meters(pos);
    const barX = padX;
    const barW = w - padX * 2;
    const barH = 18;
    const gap = 52;
    const baseY = Math.round(h * 0.56);

    drawMeter(ctx, barX, baseY, barW, barH, 'LEARNING', learning, synRGB, pal);
    drawMeter(ctx, barX, baseY + gap, barW, barH, 'RETENTION', retention, phoRGB, pal);

    // --- both-viable note ---
    ctx.font = '12px "Spline Sans Mono", monospace';
    ctx.textAlign = 'center';
    const noteY = baseY + gap * 2 + 6;
    if (inSweet(pos)) {
      ctx.fillStyle = pal.phosphor;
      ctx.fillText('● both viable — learns without forgetting', w / 2, noteY);
    } else if (pos < SWEET_LO) {
      ctx.fillStyle = pal.graphite;
      ctx.fillText('too rigid — retains but cannot adapt', w / 2, noteY);
    } else {
      ctx.fillStyle = pal.graphite;
      ctx.fillText('too plastic — adapts but forgets', w / 2, noteY);
    }
  }

  // A labeled horizontal bar meter with a numeric percentage. Text label is
  // always present so the figure never relies on color alone.
  function drawMeter(ctx, x, y, w, h, label, value, rgb, pal) {
    ctx.save();
    ctx.font = '11px "Spline Sans Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = pal.bone;
    ctx.fillText(label, x, y - 6);

    // track
    ctx.fillStyle = rgba(hexToRgbLocal(pal.graphite), 0.35);
    ctx.fillRect(x, y, w, h);
    // fill
    ctx.fillStyle = rgba(rgb, 0.85);
    ctx.fillRect(x, y, w * clamp(value, 0, 1), h);
    // outline
    ctx.strokeStyle = pal.graphite;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);

    // percentage readout
    ctx.textAlign = 'right';
    ctx.fillStyle = pal.bone;
    ctx.fillText(`${Math.round(value * 100)}%`, x + w, y - 6);
    ctx.restore();
  }

  // local helper: graphite token is a hex string; reuse hexToRgb for rgba().
  function hexToRgbLocal(hex) {
    return hexToRgb(hex);
  }

  // slider-driven: a gentle shimmer is the only animated content. update is a
  // no-op for state (env.t still advances), so the draw shimmer animates.
  function update() {}

  const fig = createFigure({ canvas, update, draw });
  const env = fig.env;

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
  slider.value = String(Math.round(pos * 1000));
  slider.setAttribute('aria-label', 'stability–plasticity balance');
  slider.addEventListener('input', () => {
    pos = clamp(Number(slider.value) / 1000, 0, 1);
    readout.textContent = readoutText();
    fig.render();
  });
  controls.append(slider);

  function readoutText() {
    const { learning, retention } = meters(pos);
    const tag = inSweet(pos) ? 'viable' : pos < SWEET_LO ? 'rigid' : 'chaotic';
    return `L ${Math.round(learning * 100)}% · R ${Math.round(retention * 100)}% · ${tag}`;
  }

  const readout = document.createElement('span');
  readout.className = 'ctrl-readout';
  readout.textContent = readoutText();
  controls.append(readout);

  // legend chips — text labels paired with the meaningful colors
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

  fig.start();
  return fig;
}
