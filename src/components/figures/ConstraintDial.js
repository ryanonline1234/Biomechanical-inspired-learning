/* =====================================================================
   ConstraintDial — chapter 8 (synthesis, the closing note).

   A single semicircular gauge the reader turns between two poles:
   - LEFT  (t=0): "capability-bound" — while capability is the binding
                  constraint, brute-force digital scaling wins  (phosphor, cool)
   - RIGHT (t=1): "energy-bound"     — once the constraint flips to energy,
                  the 20-watt brain becomes the spec sheet and brain-like,
                  energy-first designs become mandatory          (synapse, warm)

   Turn the dial with the slider (or drag on the gauge). As t: 0 -> 1 the
   needle sweeps left->right and the whole scene's accent + background wash
   lerps from phosphor toward synapse. A readout always names the regime in
   TEXT, so color is never the only signal.

   This is the essay's closing figure: calm, restrained, not flashy.
   ===================================================================== */

import { createFigure, palette, clamp, lerp, mapRange, hexToRgb, rgba } from '../lib/canvas.js';

export default function mount(stage) {
  const canvas = stage.querySelector('canvas');
  const controls = stage.querySelector('[data-controls]');
  const pal = palette();
  const phoRGB = hexToRgb(pal.phosphor); // silicon / cool pole
  const synRGB = hexToRgb(pal.synapse);  // biological / warm pole
  const inkRGB = hexToRgb(pal.ink);

  // Gauge sweep: a semicircle drawn above its centre. In canvas, angle 0
  // points right (+x) and PI points left (-x), measured clockwise because
  // canvas y grows downward. The needle lives in the UPPER half, so we sweep
  // from the LEFT pole (PI, capability) to the RIGHT pole (0, energy).
  const A_LEFT = Math.PI;   // capability pole, at the gauge's left end
  const A_RIGHT = 0;        // energy pole, at the gauge's right end

  // The dial value. Default near 0.15 so the opening state reads "today,
  // brute force wins" — capability is still the binding constraint.
  let t = 0.15;

  // Blend two {r,g,b} colors; returns an rgba() string.
  function mix(a, b, k, alpha = 1) {
    return rgba(
      {
        r: Math.round(lerp(a.r, b.r, k)),
        g: Math.round(lerp(a.g, b.g, k)),
        b: Math.round(lerp(a.b, b.b, k)),
      },
      alpha
    );
  }

  // Map the dial value to the needle angle. t=0 -> A_LEFT, t=1 -> A_RIGHT.
  function needleAngle(v) {
    return lerp(A_LEFT, A_RIGHT, clamp(v, 0, 1));
  }

  // Gauge geometry, derived from the current canvas size each draw.
  function geom(e) {
    const cx = e.w / 2;
    // Sit the pivot low so the upper semicircle uses the canvas height well.
    const cy = e.h * 0.78;
    const r = Math.min(e.w * 0.40, e.h * 0.62);
    return { cx, cy, r };
  }

  // Regime readout text + emphasis side, by dial value.
  function regime(v) {
    if (v < 0.40) return { label: 'capability-bound — brute-force digital wins', side: 'left' };
    if (v > 0.60) return { label: 'energy-bound — brain-like, energy-first wins', side: 'right' };
    return { label: 'the pivot — the binding constraint is flipping', side: 'mid' };
  }

  // Idle pulse phase, advanced only when motion is allowed.
  let pulse = 0;

  function draw(e) {
    const { ctx, w, h } = e;
    ctx.clearRect(0, 0, w, h);

    const { cx, cy, r } = geom(e);
    const reg = regime(t);

    // --- background wash: a soft vertical gradient that lerps phosphor->synapse,
    //     kept low-alpha over ink so the scene stays calm. -------------------
    const wash = ctx.createLinearGradient(0, 0, 0, h);
    wash.addColorStop(0, mix(phoRGB, synRGB, t, 0.16));
    wash.addColorStop(1, rgba(inkRGB, 0)); // fade to nothing at the base
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, w, h);

    // --- the gauge arc, drawn as a thick band from left pole to right pole.
    //     Its color lerps with the dial so the accent balance shifts visibly.
    ctx.save();
    ctx.lineCap = 'round';

    // Base track (graphite) under everything for structure.
    ctx.beginPath();
    ctx.arc(cx, cy, r, A_LEFT, A_RIGHT, false); // false = clockwise over the top
    ctx.strokeStyle = pal.graphite;
    ctx.lineWidth = 14;
    ctx.stroke();

    // Active arc tint: the left portion (already swept) carries the blended
    // accent; this is the "how far we've turned" fill.
    ctx.beginPath();
    ctx.arc(cx, cy, r, A_LEFT, needleAngle(t), false);
    ctx.strokeStyle = mix(phoRGB, synRGB, t, 0.9);
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.restore();

    // --- tick marks along the arc (purely structural reference) ------------
    ctx.save();
    ctx.strokeStyle = rgba(hexToRgb(pal.bone), 0.35);
    ctx.lineWidth = 1.5;
    const TICKS = 11;
    for (let i = 0; i < TICKS; i++) {
      const a = lerp(A_LEFT, A_RIGHT, i / (TICKS - 1));
      const inner = r - 12;
      const outer = r + (i === 0 || i === TICKS - 1 ? 14 : 8);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
      ctx.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
      ctx.stroke();
    }
    ctx.restore();

    // --- pole labels (always present, always in TEXT, never color alone) ---
    ctx.save();
    ctx.font = '12px "Spline Sans Mono", monospace';
    ctx.textBaseline = 'middle';

    // Active pole gets a faint pulse in brightness; reduced-motion holds it flat.
    const leftActive = t < 0.5;
    const glow = (0.5 + 0.5 * Math.sin(pulse)) * 0.35; // 0..0.35

    // LEFT pole — capability / silicon (phosphor).
    ctx.textAlign = 'left';
    ctx.fillStyle = rgba(phoRGB, leftActive ? 0.85 + glow * 0.4 : 0.55);
    ctx.fillText('capability-bound', cx - r - 6, cy + 22);
    ctx.fillStyle = rgba(hexToRgb(pal.bone), 0.6);
    ctx.fillText('silicon · brute force', cx - r - 6, cy + 40);

    // RIGHT pole — energy / biological (synapse).
    ctx.textAlign = 'right';
    ctx.fillStyle = rgba(synRGB, !leftActive ? 0.85 + glow * 0.4 : 0.55);
    ctx.fillText('energy-bound', cx + r + 6, cy + 22);
    ctx.fillStyle = rgba(hexToRgb(pal.bone), 0.6);
    ctx.fillText('20-watt brain · energy-first', cx + r + 6, cy + 40);
    ctx.restore();

    // --- the needle --------------------------------------------------------
    const a = needleAngle(t);
    const tipX = cx + Math.cos(a) * (r - 4);
    const tipY = cy + Math.sin(a) * (r - 4);
    // A short counterweight tail behind the pivot for balance.
    const tailX = cx - Math.cos(a) * (r * 0.16);
    const tailY = cy - Math.sin(a) * (r * 0.16);

    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = mix(phoRGB, synRGB, t, 1);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();

    // pivot hub
    ctx.fillStyle = pal.bone;
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = mix(phoRGB, synRGB, t, 1);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // --- centre readout: regime name (the load-bearing TEXT) ---------------
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '13px "Spline Sans Mono", monospace';
    ctx.fillStyle = mix(phoRGB, synRGB, t, 1);
    ctx.fillText(reg.label, cx, cy + 70);

    // small numeric position, de-emphasised
    ctx.font = '11px "Spline Sans Mono", monospace';
    ctx.fillStyle = rgba(hexToRgb(pal.bone), 0.5);
    const pct = Math.round(t * 100);
    ctx.fillText(`constraint dial — ${pct}% toward energy`, cx, cy + 90);
    ctx.restore();
  }

  // Idle motion only advances the pulse phase; the dial itself never moves
  // on its own. Reduced motion never enters this path (no autoplay).
  function update(dt) {
    pulse += dt * 1.6; // gentle ~0.25 Hz breathing on the active pole
  }

  const fig = createFigure({ canvas, update, draw });
  const env = fig.env;

  // --- the required control: a range slider that sets the dial value -------
  const wrap = document.createElement('div');
  wrap.className = 'ctrl-label';

  const label = document.createElement('span');
  label.textContent = 'binding constraint';
  wrap.append(label);

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'ctrl-slider';
  slider.min = '0';
  slider.max = '1';
  slider.step = '0.001';
  slider.value = String(t);
  slider.setAttribute('aria-label', 'Dial from capability-bound to energy-bound');
  slider.addEventListener('input', () => {
    t = clamp(parseFloat(slider.value), 0, 1);
    // Slider is direct interaction: repaint immediately (works whether the
    // rAF loop is running or — under reduced motion — paused).
    fig.render();
  });

  const readout = document.createElement('span');
  readout.className = 'ctrl-readout';
  const syncReadout = () => {
    readout.textContent = regime(t).label;
  };
  syncReadout();
  // keep the DOM readout in step with the dial on every input
  slider.addEventListener('input', syncReadout);

  wrap.append(slider, readout);
  controls.append(wrap);

  // --- optional: drag / click on the gauge also turns the needle ----------
  function pos(ev) {
    const rect = canvas.getBoundingClientRect();
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
  }
  function setFromPoint(px, py) {
    const { cx, cy } = geom(env);
    // Angle of the click relative to the pivot. We only honour the upper
    // half (the gauge band); below the pivot, clamp to the nearest pole.
    const dx = px - cx;
    const dy = py - cy;
    // atan2 in canvas coords: upper half has dy<0, giving angles in (-PI,0).
    // Map that to t by measuring how far around from A_LEFT (PI) we are.
    let ang = Math.atan2(dy, dx); // (-PI, PI]
    if (ang > 0) ang -= 0; // points below pivot -> clamp handled below
    // Convert to a 0..1 sweep: A_LEFT(±PI) -> 0, A_RIGHT(0) -> 1.
    // Use the absolute angle so both -PI and PI read as the left pole.
    const abs = Math.abs(ang); // 0 at right pole, PI at left pole
    const v = mapRange(abs, Math.PI, 0, 0, 1); // PI->0, 0->1
    t = clamp(v, 0, 1);
    slider.value = String(t);
    syncReadout();
    fig.render();
  }
  let dragging = false;
  canvas.addEventListener('pointerdown', (ev) => {
    dragging = true;
    const p = pos(ev);
    setFromPoint(p.x, p.y);
    canvas.setPointerCapture?.(ev.pointerId);
  });
  canvas.addEventListener('pointermove', (ev) => {
    if (!dragging) return;
    const p = pos(ev);
    setFromPoint(p.x, p.y);
  });
  window.addEventListener('pointerup', () => (dragging = false));
  canvas.style.cursor = 'pointer';

  fig.start();
  return fig;
}
