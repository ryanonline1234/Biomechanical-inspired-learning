/* =====================================================================
   ConstraintDial — chapter 8 (synthesis, the closing note).

   A single semicircular gauge the reader turns between two poles:
   - LEFT  (t=0): "capability-bound" — while capability is the binding
                  constraint, brute-force digital scaling wins  (phosphor, cool)
   - RIGHT (t=1): "energy-bound"     — once the constraint flips to energy,
                  the 20-watt brain becomes the spec sheet and brain-like,
                  energy-first designs become mandatory          (synapse, warm)

   The gauge face is itself the seam: a cool-left / warm-right gradient where
   the two worlds meet at the midpoint pivot. Turn the dial (slider or drag)
   and the needle sweeps left->right while the scene's accent + wash lerp from
   phosphor toward synapse. A readout always names the regime in TEXT, so
   color is never the only signal.

   This is the essay's closing figure: calm, restrained, not flashy.
   ===================================================================== */

import { createFigure, palette, clamp, lerp, mapRange, hexToRgb, rgba, makeSpring, SPRING } from '../lib/canvas.js';

export default function mount(stage) {
  const canvas = stage.querySelector('canvas');
  const controls = stage.querySelector('[data-controls]');
  const pal = palette();
  const phoRGB = hexToRgb(pal.phosphor); // silicon / cool pole
  const synRGB = hexToRgb(pal.synapse);  // biological / warm pole
  const boneRGB = hexToRgb(pal.bone);

  // Gauge sweep: a semicircle over the pivot. Canvas angle 0 points right,
  // PI points left, and angle grows clockwise (y is down). The needle, fill and
  // ticks must ride the UPPER dome, so the right pole is 2*PI — sweeping PI->2PI
  // passes through 3*PI/2 (straight up). Ending at 0 instead would sweep the
  // lower half and leave the needle hanging below the pivot.
  const A_LEFT = Math.PI;
  const A_RIGHT = 2 * Math.PI;

  // The dial value is spring-driven so it SETTLES toward where the reader sets
  // it (slider or drag) instead of snapping. Critically damped, so the live
  // "% toward energy" readout never overshoots into a wrong number. Default
  // near 0.15 so the opening state reads "today, brute force wins".
  const dial = makeSpring(SPRING.snappy, 0.15);

  const F_LABEL = '600 13px "Space Grotesk", system-ui, sans-serif';
  const F_MONO = '11px "Spline Sans Mono", monospace';
  const F_MONO_SM = '10px "Spline Sans Mono", monospace';

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

  const needleAngle = (v) => lerp(A_LEFT, A_RIGHT, clamp(v, 0, 1));

  // The controls bar is overlaid on the canvas bottom, so reserve a band for
  // it and lay the whole gauge out within the remaining drawing area. This
  // keeps the in-canvas readout clear of the controls at every size.
  const BOTTOM = 52;

  // Gauge geometry, derived from the drawing area (height minus the reserve).
  function geom(e) {
    const drawH = Math.max(120, e.h - BOTTOM);
    const cx = e.w / 2;
    const cy = drawH * 0.8; // pivot low within the drawing area
    const r = Math.min(e.w * 0.42, drawH * 0.66);
    return { cx, cy, r, drawH };
  }

  // Full regime sentence (the load-bearing TEXT — shown in the DOM readout).
  function regime(v) {
    if (v < 0.4) return 'capability-bound — brute-force digital wins';
    if (v > 0.6) return 'energy-bound — brain-like, energy-first wins';
    return 'the pivot — the binding constraint is flipping';
  }

  // Short in-canvas tag that fits on one line near the pivot.
  function regimeShort(v) {
    if (v < 0.4) return 'digital wins';
    if (v > 0.6) return 'biology wins';
    return 'the pivot';
  }

  // A small two-line corner caption, with the active side brightened.
  function cornerLabel(ctx, x, y, align, lines, accent, active, glow) {
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.font = F_LABEL;
    ctx.fillStyle = rgba(accent, active ? 0.92 + glow : 0.5);
    ctx.fillText(lines[0], x, y);
    ctx.font = F_MONO_SM;
    ctx.fillStyle = rgba(boneRGB, active ? 0.62 : 0.42);
    ctx.fillText(lines[1], x, y + 15);
  }

  function draw(e) {
    const { ctx, w, h } = e;
    ctx.clearRect(0, 0, w, h);

    const { cx, cy, r } = geom(e);
    const t = clamp(dial.value, 0, 1);
    const accent = mix(phoRGB, synRGB, t, 1);
    const knobX = cx + Math.cos(needleAngle(t)) * r;
    const knobY = cy + Math.sin(needleAngle(t)) * r;
    const glow = 0; // breathing removed — motion now happens only on interaction

    // --- background: a soft radial glow trailing the knob, in the blended
    //     accent, so the whole scene's warmth shifts as the dial turns. ------
    const halo = ctx.createRadialGradient(knobX, knobY, 0, knobX, knobY, r * 1.5);
    halo.addColorStop(0, mix(phoRGB, synRGB, t, 0.18));
    halo.addColorStop(1, mix(phoRGB, synRGB, t, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);

    // --- corner pole captions (always present, TEXT-first) -----------------
    cornerLabel(ctx, 16, 26, 'left', ['capability-bound', 'silicon · brute force'], phoRGB, t < 0.5, glow);
    cornerLabel(ctx, w - 16, 26, 'right', ['energy-bound', '20-watt brain · energy-first'], synRGB, t >= 0.5, glow);

    // --- gauge track: a recessed graphite base under a cool->warm gradient.
    //     The gradient IS the seam: silicon on the left, biology on the right. -
    ctx.save();
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.arc(cx, cy, r, A_LEFT, A_RIGHT, false);
    ctx.strokeStyle = rgba(hexToRgb(pal.graphite), 0.9);
    ctx.lineWidth = 18;
    ctx.stroke();

    const grad = ctx.createLinearGradient(cx - r, 0, cx + r, 0);
    grad.addColorStop(0.0, rgba(phoRGB, 0.95));
    grad.addColorStop(0.5, mix(phoRGB, synRGB, 0.5, 0.85));
    grad.addColorStop(1.0, rgba(synRGB, 0.95));
    ctx.beginPath();
    ctx.arc(cx, cy, r, A_LEFT, A_RIGHT, false);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 10;
    ctx.stroke();
    ctx.restore();

    // --- pivot seam marker at the apex: where the two worlds meet ----------
    ctx.save();
    ctx.strokeStyle = rgba(boneRGB, 0.5);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r - 9);
    ctx.lineTo(cx, cy - r + 9);
    ctx.stroke();
    ctx.restore();

    // --- tick marks along the arc (structural reference) -------------------
    ctx.save();
    ctx.strokeStyle = rgba(boneRGB, 0.28);
    ctx.lineWidth = 1.25;
    const TICKS = 11;
    for (let i = 0; i < TICKS; i++) {
      const a = lerp(A_LEFT, A_RIGHT, i / (TICKS - 1));
      const end = i === 0 || i === TICKS - 1 ? 11 : 6;
      const inner = r - 9;
      const outer = r + end;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
      ctx.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
      ctx.stroke();
    }
    ctx.restore();

    // --- needle + knob -----------------------------------------------------
    ctx.save();
    ctx.lineCap = 'round';
    // soft shadow under the needle for depth
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - Math.cos(needleAngle(t)) * r * 0.12, cy - Math.sin(needleAngle(t)) * r * 0.12);
    ctx.lineTo(knobX - Math.cos(needleAngle(t)) * 11, knobY - Math.sin(needleAngle(t)) * 11);
    ctx.stroke();

    // knob riding the arc, with a glowing halo
    ctx.shadowColor = accent;
    ctx.shadowBlur = 12 + glow * 40;
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(knobX, knobY, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = rgba(boneRGB, 0.9);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(knobX, knobY, 7, 0, Math.PI * 2);
    ctx.stroke();

    // pivot hub
    ctx.fillStyle = pal.bone;
    ctx.beginPath();
    ctx.arc(cx, cy, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 5.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // --- live in-canvas tag: one safe line between the pivot and controls --
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = F_LABEL;
    ctx.fillStyle = accent;
    ctx.fillText(`${regimeShort(t)} · ${Math.round(t * 100)}% toward energy`, cx, cy + 26);
    ctx.restore();
  }

  function update(dt) {
    dial.step(dt);
    if (dial.settled()) fig.stop(); // motion ends when the needle arrives
  }

  const fig = createFigure({ canvas, update, draw, autoplay: false });
  const env = fig.env;

  // Re-aim the needle: spring toward the target under motion, snap under reduced.
  function aim(target) {
    if (env.reduced) {
      dial.snap(target);
      fig.render();
    } else {
      dial.to(target);
      fig.play();
    }
  }

  // --- required control: a range slider that sets the dial value -----------
  const wrap = document.createElement('div');
  wrap.className = 'ctrl';

  const label = document.createElement('span');
  label.className = 'ctrl-label';
  label.textContent = 'binding constraint';

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'ctrl-slider';
  slider.min = '0';
  slider.max = '1';
  slider.step = '0.001';
  slider.value = String(dial.value);
  slider.setAttribute('aria-label', 'Dial from capability-bound to energy-bound');

  const readout = document.createElement('span');
  readout.className = 'ctrl-readout';
  // The DOM readout names the regime being selected — snap it to the target
  // immediately (text should not lerp); the in-canvas % springs up to it.
  const sync = (v) => {
    readout.textContent = regime(v);
    readout.classList.toggle('is-bio', v >= 0.5);
  };
  slider.addEventListener('input', () => {
    const target = clamp(parseFloat(slider.value), 0, 1);
    sync(target);
    aim(target);
  });
  sync(0.15);

  wrap.append(label, slider, readout);
  controls.append(wrap);

  // --- drag / click on the gauge also turns the needle ---------------------
  function setFromPoint(px, py) {
    const { cx, cy } = geom(env);
    // Absolute angle from the pivot; |ang| = PI at the left pole, 0 at the
    // right pole. Map that to t in [0,1].
    const ang = Math.atan2(py - cy, px - cx);
    const target = clamp(mapRange(Math.abs(ang), Math.PI, 0, 0, 1), 0, 1);
    slider.value = String(target);
    sync(target);
    aim(target);
  }
  let dragging = false;
  function pos(ev) {
    const rect = canvas.getBoundingClientRect();
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
  }
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
