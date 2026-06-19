/* =====================================================================
   LivingOrganism — the signature figure (hero + chapter 4).

   A self-organizing automaton grown from a single seed by ONE local rule.
   Drag to tear a hole; it heals back to its target form.

   This is a lightweight reaction-diffusion approximation, *illustrative of
   the principle* — not a trained Neural Cellular Automaton (too heavy to
   ship). But it embodies the same thesis: the form and its self-repair live
   in the interaction between cells, not inside any one cell. Every cell runs
   the identical update rule below.

   The rule (per cell, each tick):
     lap   = average(8 neighbours) - u           // discrete Laplacian
     grow  = RATE * u * (1 - u) * targetMask      // logistic growth, gated to
                                                  //   the organism's shape and
                                                  //   to where life already is
     leak  = LEAK * u * (1 - targetMask)          // anything outside the shape dies
     u    += DIFFUSE * lap + grow - leak
   A single seed at u=1 expands outward, fills the organic target shape, and
   stabilises. Erase a region and diffusion + logistic growth refill it.
   ===================================================================== */

import { createFigure, palette, clamp, lerp, hexToRgb } from '../lib/canvas.js';

// --- rule constants (tuned for a calm, organic growth) ---
const DIFFUSE = 0.16;
const RATE = 0.34;
const LEAK = 0.22;
const SUBSTEPS = 2; // sim ticks per animation frame

export default function mount(stage) {
  const canvas = stage.querySelector('canvas');
  const controls = stage.querySelector('[data-controls]');

  // Grid resolution is capped for performance; it tracks the stage aspect.
  const N = 120;
  let cols = N;
  let rows = N;

  let u = new Float32Array(cols * rows);
  let v = new Float32Array(cols * rows);
  let mask = new Float32Array(cols * rows); // target organism shape, 1 inside
  let offscreen = null;
  let img = null;

  let sameRule = false; // ch.4 "every cell runs the same rule" view
  const pal = palette();
  const inkRGB = hexToRgb(pal.ink);
  const synRGB = hexToRgb(pal.synapse);
  const phoRGB = hexToRgb(pal.phosphor);

  // --- build the organic target shape: a lobed radial blob ---
  function buildMask() {
    mask = new Float32Array(cols * rows);
    const cx = cols / 2;
    const cy = rows / 2;
    const base = Math.min(cols, rows) * 0.36;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const ang = Math.atan2(dy, dx);
        const dist = Math.hypot(dx, dy);
        // organic, lobed radius — a few harmonics so it reads as a creature
        const r =
          base *
          (1 +
            0.16 * Math.sin(3 * ang + 0.6) +
            0.09 * Math.sin(5 * ang - 1.2) +
            0.05 * Math.sin(8 * ang));
        // soft edge for an antialiased membrane
        mask[y * cols + x] = clamp((r - dist) / 2.4 + 0.5, 0, 1);
      }
    }
  }

  function seed() {
    u = new Float32Array(cols * rows);
    v = new Float32Array(cols * rows);
    const cx = (cols / 2) | 0;
    const cy = (rows / 2) | 0;
    // a tiny seed of life at the centre
    for (let y = cy - 1; y <= cy + 1; y++) {
      for (let x = cx - 1; x <= cx + 1; x++) {
        u[y * cols + x] = 1;
      }
    }
  }

  // one sim tick — every cell runs this identical rule
  function tick() {
    for (let y = 0; y < rows; y++) {
      const ym = y > 0 ? y - 1 : 0;
      const yp = y < rows - 1 ? y + 1 : rows - 1;
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        const xm = x > 0 ? x - 1 : 0;
        const xp = x < cols - 1 ? x + 1 : cols - 1;
        const c = u[i];
        // 8-neighbour average (weighted like a discrete Laplacian kernel)
        const orth =
          u[y * cols + xm] + u[y * cols + xp] + u[ym * cols + x] + u[yp * cols + x];
        const diag =
          u[ym * cols + xm] +
          u[ym * cols + xp] +
          u[yp * cols + xm] +
          u[yp * cols + xp];
        const avg = (orth * 0.2 + diag * 0.05) / 1.0; // ~ neighbourhood mean
        const lap = avg - c;
        const m = mask[i];
        const grow = RATE * c * (1 - c) * m;
        const leak = LEAK * c * (1 - m);
        let n = c + DIFFUSE * lap + grow - leak;
        v[i] = n < 0 ? 0 : n > 1 ? 1 : n;
      }
    }
    const tmp = u;
    u = v;
    v = tmp;
  }

  function settle(steps) {
    for (let s = 0; s < steps; s++) tick();
  }

  function damageAt(px, py, radius) {
    // px,py in CSS pixels -> grid coords
    const gx = (px / env.w) * cols;
    const gy = (py / env.h) * rows;
    const r = radius;
    const r2 = r * r;
    const x0 = Math.max(0, (gx - r) | 0);
    const x1 = Math.min(cols - 1, (gx + r) | 0);
    const y0 = Math.max(0, (gy - r) | 0);
    const y1 = Math.min(rows - 1, (gy + r) | 0);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - gx;
        const dy = y - gy;
        if (dx * dx + dy * dy <= r2) u[y * cols + x] = 0;
      }
    }
  }

  // --- rendering ---
  function ensureBuffer() {
    if (!offscreen || offscreen.width !== cols || offscreen.height !== rows) {
      offscreen = document.createElement('canvas');
      offscreen.width = cols;
      offscreen.height = rows;
      img = offscreen.getContext('2d').createImageData(cols, rows);
    }
  }

  function draw(e) {
    const { ctx, w, h, t } = e;
    ensureBuffer();
    const data = img.data;
    // a slow breathing pulse for the membrane (skipped under reduced motion)
    const pulse = e.reduced ? 0.5 : 0.5 + 0.5 * Math.sin(t * 1.4);
    for (let i = 0; i < u.length; i++) {
      const val = u[i];
      const j = i * 4;
      if (val < 0.02) {
        data[j] = inkRGB.r;
        data[j + 1] = inkRGB.g;
        data[j + 2] = inkRGB.b;
        data[j + 3] = 255;
        continue;
      }
      // interior = warm synapse; membrane (mid values) = cool phosphor rim
      const membrane = val > 0.12 && val < 0.6 ? (0.6 - val) / 0.48 : 0;
      let rr, gg, bb;
      if (sameRule) {
        // "same rule everywhere" view: one uniform hue, brightness = life
        const k = 0.25 + 0.75 * val;
        rr = lerp(inkRGB.r, phoRGB.r, k);
        gg = lerp(inkRGB.g, phoRGB.g, k);
        bb = lerp(inkRGB.b, phoRGB.b, k);
      } else {
        const body = 0.3 + 0.7 * val;
        rr = lerp(inkRGB.r, synRGB.r, body);
        gg = lerp(inkRGB.g, synRGB.g, body);
        bb = lerp(inkRGB.b, synRGB.b, body);
        // phosphor membrane glow
        const glow = membrane * (0.5 + 0.5 * pulse);
        rr = lerp(rr, phoRGB.r, glow * 0.8);
        gg = lerp(gg, phoRGB.g, glow * 0.8);
        bb = lerp(bb, phoRGB.b, glow * 0.8);
      }
      data[j] = rr;
      data[j + 1] = gg;
      data[j + 2] = bb;
      data[j + 3] = 255;
    }
    offscreen.getContext('2d').putImageData(img, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(offscreen, 0, 0, w, h);

    if (sameRule) {
      // overlay a faint grid to underline "discrete cells, one shared rule"
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.strokeStyle = pal.bone;
      ctx.lineWidth = 0.5;
      const step = w / 24;
      for (let gx = 0; gx <= w; gx += step) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, h);
        ctx.stroke();
      }
      for (let gy = 0; gy <= h; gy += step) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(w, gy);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function update(dt, e) {
    for (let s = 0; s < SUBSTEPS; s++) tick();
  }

  // --- figure controller ---
  // Size the grid to the stage aspect so the organism isn't stretched, then
  // grow it before the first paint so the reader lands on a live creature.
  function sizeGrid(w, h) {
    const aspect = w / h || 1;
    cols = Math.max(24, aspect >= 1 ? N : Math.round(N * aspect));
    rows = Math.max(24, aspect >= 1 ? Math.round(N / aspect) : N);
    buildMask();
    seed();
    settle(180);
  }

  // initial build (square fallback) so we have state even before layout settles
  sizeGrid(1, 1);

  // setup() runs once after createFigure knows the real size — re-derive the
  // grid from the true aspect there.
  const fig = createFigure({
    canvas,
    setup: (e) => sizeGrid(e.w, e.h),
    update,
    draw,
  });
  const env = fig.env;

  // --- pointer interaction: drag to tear ---
  let drawing = false;
  function pointerPos(ev) {
    const rect = canvas.getBoundingClientRect();
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
  }
  function onDown(ev) {
    drawing = true;
    const p = pointerPos(ev);
    damageAt(p.x, p.y, Math.max(4, cols * 0.07));
    if (env.reduced) {
      settle(30);
      fig.render();
    }
    canvas.setPointerCapture?.(ev.pointerId);
  }
  function onMove(ev) {
    if (!drawing) return;
    const p = pointerPos(ev);
    damageAt(p.x, p.y, Math.max(4, cols * 0.07));
    if (env.reduced) fig.render();
  }
  function onUp() {
    drawing = false;
  }
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  canvas.style.cursor = 'crosshair';

  // --- controls ---
  const regrow = document.createElement('button');
  regrow.className = 'ctrl-btn';
  regrow.type = 'button';
  regrow.textContent = '↻ regrow from seed';
  regrow.addEventListener('click', () => {
    seed();
    if (env.reduced) {
      settle(180);
      fig.render();
    }
  });

  const ruleToggle = document.createElement('button');
  ruleToggle.className = 'ctrl-btn';
  ruleToggle.type = 'button';
  ruleToggle.setAttribute('aria-pressed', 'false');
  ruleToggle.textContent = 'show: same rule everywhere';
  ruleToggle.addEventListener('click', () => {
    sameRule = !sameRule;
    ruleToggle.setAttribute('aria-pressed', String(sameRule));
    ruleToggle.textContent = sameRule
      ? 'showing: same rule everywhere'
      : 'show: same rule everywhere';
    fig.render();
  });

  controls.append(regrow, ruleToggle);

  // reduced-motion: offer a manual heal step
  if (env.reduced) {
    const stepBtn = document.createElement('button');
    stepBtn.className = 'ctrl-btn';
    stepBtn.type = 'button';
    stepBtn.textContent = 'step ⏵ (heal)';
    stepBtn.addEventListener('click', () => {
      settle(20);
      fig.render();
    });
    controls.append(stepBtn);
  }

  fig.start();
  return fig;
}
