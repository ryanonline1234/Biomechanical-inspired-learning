/* =====================================================================
   LivingOrganism — the signature figure (hero + chapter 4 "crux").

   A self-organizing automaton grown from a single seed by ONE local rule.
   It grows live on load, and (in the ch4 "crux" instance) tears open and
   heals back to its target form on demand.

   This is a lightweight reaction-diffusion approximation, *illustrative of
   the principle* — not a trained Neural Cellular Automaton (too heavy to
   ship). Be honest about the mechanism: each cell is NOT purely neighbour-
   local. The update reads the 8-neighbour average AND a precomputed target
   mask (the organism's shape) plus a leak. The figcaption / prose carries
   the meaning; the canvas does not claim neighbour-only locality and does
   NOT editorialise ("no cell knew the target" would be literally false of
   this sim).

   The rule (per cell, each tick) — identical at every location:
     lap   = average(8 neighbours) - u           // discrete Laplacian
     grow  = RATE * u * (1 - u) * targetMask      // logistic growth, gated to
                                                  //   the organism's shape and
                                                  //   to where life already is
     leak  = LEAK * u * (1 - targetMask)          // anything outside the shape dies
     u    += DIFFUSE * lap + grow - leak
   A single seed at u=1 expands outward, fills the organic target shape, and
   stabilises. Erase a region and diffusion + logistic growth refill it.

   Two instances, distinguished by stage.dataset.variant:
     - undefined / "hero" : calm grow-from-seed signature, no tear chrome
     - "crux"             : self-repair is the centrepiece — a signposted
                            "tear a hole" button + neutral recovery readout
   ===================================================================== */

import { createFigure, palette, clamp, lerp, hexToRgb, rgba, drawText } from '../lib/canvas.js';

// --- rule constants (tuned for a calm, organic growth) ---
const DIFFUSE = 0.16;
const RATE = 0.34;
const LEAK = 0.22;
const SUBSTEPS = 2; // sim ticks per animation frame

// Square cells read as an automaton, not an airbrushed blob. A coarse grid
// upscaled with imageSmoothingEnabled=false gives chunky, deliberate cells.
const N = 64;

export default function mount(stage) {
  const canvas = stage.querySelector('canvas');
  const controls = stage.querySelector('[data-controls]');

  const variant = stage.dataset.variant || 'hero';
  const isCrux = variant === 'crux';

  let cols = N;
  let rows = N;

  let u = new Float32Array(cols * rows);
  let v = new Float32Array(cols * rows);
  let mask = new Float32Array(cols * rows); // target organism shape, 1 inside
  let maskSum = 0; // total target "mass" — denominator for recovery %
  let offscreen = null;
  let img = null;

  let sameRule = false; // ch.4 "every cell runs the same rule" view
  const pal = palette();
  const inkRGB = hexToRgb(pal.ink);
  const synRGB = hexToRgb(pal.synapse);
  const phoRGB = hexToRgb(pal.phosphor);

  // --- growth / heal narration state ---
  let growFrames = 0;       // frames since last seed (drives the seed ring)
  const SEED_RING_FRAMES = 70;
  let healing = false;      // a tear is currently recovering
  let healBaseline = 0;     // live mass right before the tear (for the % readout)
  let woundFreeze = 0;      // frames the wound stays black before healing begins
  let woundCx = 0, woundCy = 0, woundR = 0; // wound geometry (grid coords) for the outline
  let recovery = 0;         // 0..1 fraction recovered
  let triHealSteps = 16;    // heal depth for the reduced-motion triptych's 3rd panel

  // fig is referenced inside update() (to stop the loop when a transient
  // settles), so declare it before createFigure and assign after.
  let fig;

  // --- build the organic target shape: a lobed radial blob ---
  function buildMask() {
    mask = new Float32Array(cols * rows);
    maskSum = 0;
    const cx = cols / 2;
    const cy = rows / 2;
    const base = Math.min(cols, rows) * 0.32; // tighter -> clear dark margin (figure-ground)
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
        // soft edge for an antialiased membrane (in grid units, kept tight)
        const m = clamp((r - dist) / 1.6 + 0.5, 0, 1);
        mask[y * cols + x] = m;
        maskSum += m;
      }
    }
  }

  function seed(target = u) {
    target.fill(0);
    const cx = (cols / 2) | 0;
    const cy = (rows / 2) | 0;
    // a tiny seed of life at the centre
    for (let y = cy - 1; y <= cy + 1; y++) {
      for (let x = cx - 1; x <= cx + 1; x++) {
        target[y * cols + x] = 1;
      }
    }
  }

  // start a fresh live grow-from-seed
  function reseed() {
    seed(u);
    v.fill(0);
    growFrames = 0;
    healing = false;
    recovery = 0;
    woundFreeze = 0;
  }

  // one sim tick — every cell runs this identical rule.
  // Accumulates total absolute change into `lastChange` so the loop can stop
  // when the organism has settled (no perpetual motion).
  let lastChange = 1;
  function tick() {
    let change = 0;
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
        const avg = orth * 0.2 + diag * 0.05; // ~ neighbourhood mean
        const lap = avg - c;
        const m = mask[i];
        const grow = RATE * c * (1 - c) * m;
        const leak = LEAK * c * (1 - m);
        let n = c + DIFFUSE * lap + grow - leak;
        n = n < 0 ? 0 : n > 1 ? 1 : n;
        change += n > c ? n - c : c - n;
        v[i] = n;
      }
    }
    lastChange = change;
    const tmp = u;
    u = v;
    v = tmp;
  }

  function settle(steps) {
    for (let s = 0; s < steps; s++) tick();
  }

  // grown live mass (for the recovery readout) — only counts cells inside the
  // shape so a stray spark outside doesn't skew the %.
  function liveMass() {
    let s = 0;
    for (let i = 0; i < u.length; i++) {
      if (mask[i] > 0.4) s += u[i];
    }
    return s;
  }

  // zero a disc of cells (grid coords)
  function zeroDisc(gx, gy, r, buf = u) {
    const r2 = r * r;
    const x0 = Math.max(0, (gx - r) | 0);
    const x1 = Math.min(cols - 1, (gx + r) | 0);
    const y0 = Math.max(0, (gy - r) | 0);
    const y1 = Math.min(rows - 1, (gy + r) | 0);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - gx;
        const dy = y - gy;
        if (dx * dx + dy * dy <= r2) buf[y * cols + x] = 0;
      }
    }
  }

  function damageAt(px, py, radius) {
    // px,py in CSS pixels -> grid coords
    const gx = (px / env.w) * cols;
    const gy = (py / env.h) * rows;
    zeroDisc(gx, gy, radius);
  }

  // the signposted tear: a fixed off-centre wound, frozen briefly, then healed
  function tearHole() {
    // measure baseline BEFORE tearing, from the grown organism
    healBaseline = Math.max(1, liveMass());
    woundCx = cols * 0.62;
    woundCy = rows * 0.42;
    woundR = cols * 0.16;
    zeroDisc(woundCx, woundCy, woundR);
    healing = true;
    recovery = 0;
    woundFreeze = env.reduced ? 0 : 18; // ~0.3s black wound before refill
    if (env.reduced) {
      // reduced motion: advance the right panel of the triptych a few steps
      settle(14);
      recovery = clamp(liveMass() / healBaseline, 0, 1);
      fig.render();
    } else {
      fig.play();
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

  // paint the current `u` field into the offscreen ImageData. `opts.uniform`
  // forces the "same rule" ink->phosphor ramp (used by the triptych panels).
  // Returns nothing; caller blits offscreen with imageSmoothingEnabled=false.
  function paintField(opts = {}) {
    ensureBuffer();
    const data = img.data;
    const uniform = opts.uniform != null ? opts.uniform : sameRule;
    for (let i = 0; i < u.length; i++) {
      const val = u[i];
      const j = i * 4;
      // raise the dead threshold so faint cells read as background ink
      if (val < 0.06) {
        data[j] = inkRGB.r;
        data[j + 1] = inkRGB.g;
        data[j + 2] = inkRGB.b;
        data[j + 3] = 255;
        continue;
      }
      let rr, gg, bb;
      if (uniform) {
        // "same rule everywhere" view: one uniform ink->phosphor ramp so
        // identity-of-rule reads as identity-of-colour
        const k = 0.28 + 0.72 * val;
        rr = lerp(inkRGB.r, phoRGB.r, k);
        gg = lerp(inkRGB.g, phoRGB.g, k);
        bb = lerp(inkRGB.b, phoRGB.b, k);
      } else {
        // interior = warm synapse; membrane (mid values) = cool phosphor rim
        const membrane = val > 0.14 && val < 0.62 ? (0.62 - val) / 0.48 : 0;
        const body = 0.3 + 0.7 * val;
        rr = lerp(inkRGB.r, synRGB.r, body);
        gg = lerp(inkRGB.g, synRGB.g, body);
        bb = lerp(inkRGB.b, synRGB.b, body);
        const glow = membrane * 0.85;
        rr = lerp(rr, phoRGB.r, glow);
        gg = lerp(gg, phoRGB.g, glow);
        bb = lerp(bb, phoRGB.b, glow);
      }
      data[j] = rr;
      data[j + 1] = gg;
      data[j + 2] = bb;
      data[j + 3] = 255;
    }
    offscreen.getContext('2d').putImageData(img, 0, 0);
  }

  // blit the offscreen field into a destination rect, crisp (no smoothing).
  function blit(ctx, dx, dy, dw, dh) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(offscreen, dx, dy, dw, dh);
  }

  // a small text label with a dark halo so it survives over the bright organism.
  // Draw the ink copy at four 1px offsets, then the real glyph on top.
  function haloText(ctx, tier, text, x, y, o = {}) {
    const a = o.alpha != null ? o.alpha : 1;
    const haloOpts = { ...o, color: rgba(inkRGB, 0.9), alpha: a };
    const offs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [ox, oy] of offs) {
      drawText(ctx, tier, text, x + ox, y + oy, haloOpts);
    }
    drawText(ctx, tier, text, x, y, o);
  }

  // --- the "same rule everywhere" honest overlay ---
  // cell-accurate sample points aligned to the real sim grid. Connectors lead
  // from a few representative cells (centre, lobe, edge) to one rule card.
  function drawRuleOverlay(ctx, w, h, stepX, stepY) {
    // pick representative cells in grid coords
    const samples = [
      [cols * 0.5, rows * 0.5],   // centre
      [cols * 0.30, rows * 0.40], // a lobe
      [cols * 0.68, rows * 0.62], // edge / rim
    ];
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(phoRGB, 0.5);
    // card position (top-left, inside the canvas)
    const cardX = 12;
    const cardY = 14;
    for (const [gx, gy] of samples) {
      const px = gx * stepX + stepX / 2;
      const py = gy * stepY + stepY / 2;
      // ring the sampled cell
      ctx.beginPath();
      ctx.arc(px, py, Math.max(stepX, stepY) * 0.7, 0, Math.PI * 2);
      ctx.stroke();
      // thin connector toward the rule card
      ctx.beginPath();
      ctx.globalAlpha = 0.35;
      ctx.moveTo(px, py);
      ctx.lineTo(cardX + 8, cardY + 30);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // rule card — HONEST about the mask: neighbour average + growth toward the
    // target shape + leak. NOT "neighbour-only".
    drawText(ctx, 'label', 'one rule, every cell', cardX, cardY, {
      color: pal.phosphor, align: 'left', baseline: 'top',
    });
    const lines = [
      'avg 8 neighbours',
      '+ grow toward shape',
      '- leak outside it',
    ];
    lines.forEach((ln, i) => {
      drawText(ctx, 'data', ln, cardX, cardY + 18 + i * 15, {
        color: pal.bone, align: 'left', baseline: 'top', size: 10.5,
      });
    });
  }

  // --- the live (animated) frame ---
  function drawLive(e) {
    const { ctx, w, h } = e;
    paintField();
    ctx.clearRect(0, 0, w, h);
    blit(ctx, 0, 0, w, h);

    const stepX = w / cols;
    const stepY = h / rows;

    // 1) SEED RING — show "grows from a single seed" on load
    if (growFrames < SEED_RING_FRAMES && !healing) {
      const cxp = w / 2;
      const cyp = h / 2;
      const fade = 1 - growFrames / SEED_RING_FRAMES;
      ctx.save();
      ctx.strokeStyle = rgba(phoRGB, 0.9 * fade);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cxp, cyp, 7 + (1 - fade) * 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      haloText(ctx, 'label', 'seed', cxp + 12, cyp, {
        color: pal.phosphor, align: 'left', baseline: 'middle', alpha: fade,
      });
    }

    // 2) WOUND OUTLINE + recovery readout (crux self-repair narration)
    if (healing) {
      const wcx = woundCx * stepX;
      const wcy = woundCy * stepY;
      // outline shrinks as cells refill: scale by remaining gap
      const remaining = clamp(1 - recovery, 0, 1);
      const wr = woundR * stepX * (0.35 + 0.65 * remaining);
      ctx.save();
      ctx.strokeStyle = rgba(phoRGB, 0.75);
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.arc(wcx, wcy, wr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      const pct = Math.round(recovery * 100);
      const done = recovery > 0.98;
      drawText(ctx, 'label', 'self-repair', 12, h - 30, {
        color: pal.phosphor, align: 'left', baseline: 'bottom',
      });
      drawText(ctx, 'data', done ? 'recovered' : `healing ${pct}%`, 12, h - 14, {
        color: done ? pal.phosphor : pal.bone, align: 'left', baseline: 'bottom',
      });
    }

    // 3) "same rule" honest overlay
    if (sameRule) {
      drawRuleOverlay(ctx, w, h, stepX, stepY);
    }
  }

  // --- reduced-motion triptych: seed / grown / half-healed in ONE frame ---
  function drawTriptych(e) {
    const { ctx, w, h } = e;
    ctx.clearRect(0, 0, w, h);

    const gap = 8;
    const panelW = (w - gap * 2) / 3;
    const panelH = h;

    // We re-run the sim three times into the same `u`, painting between stages.
    // panel 1: seed + early growth
    reseed();
    settle(22);
    paintField({ uniform: sameRule });
    blit(ctx, 0, 0, panelW, panelH);

    // panel 2: grown form
    reseed();
    settle(150);
    paintField({ uniform: sameRule });
    blit(ctx, panelW + gap, 0, panelW, panelH);

    // panel 3: damaged + half-healed
    reseed();
    settle(150);
    const base = Math.max(1, liveMass());
    zeroDisc(cols * 0.62, rows * 0.42, cols * 0.16);
    settle(triHealSteps);
    const rec = clamp(liveMass() / base, 0, 1);
    paintField({ uniform: sameRule });
    blit(ctx, (panelW + gap) * 2, 0, panelW, panelH);

    // labels with halos, anchored to each panel
    const labels = ['seed', 'grown', `healing ${Math.round(rec * 100)}%`];
    const colors = [pal.phosphor, pal.bone, pal.phosphor];
    for (let p = 0; p < 3; p++) {
      const px = (panelW + gap) * p + 8;
      haloText(ctx, 'label', labels[p], px, h - 12, {
        color: colors[p], align: 'left', baseline: 'bottom',
      });
    }

    // thesis-tier title across the top-left, with halo
    haloText(ctx, 'title', 'One rule. Grows, then repairs.', 8, 16, {
      color: pal.bone, align: 'left', baseline: 'top',
    });

    // honest rule note (no neighbour-only claim, no "it emerged")
    if (sameRule) {
      haloText(ctx, 'data', 'avg neighbours + grow toward shape - leak', 8, h - 30, {
        color: pal.boneDim, align: 'left', baseline: 'bottom', size: 10,
      });
    }
  }

  function draw(e) {
    if (e.reduced) {
      drawTriptych(e);
    } else {
      drawLive(e);
    }
  }

  function update(dt, e) {
    if (e.reduced) return;

    growFrames++;

    // hold the wound black for a beat before healing begins
    if (healing && woundFreeze > 0) {
      woundFreeze--;
      return; // no ticks while frozen — the tear stays visible
    }

    for (let s = 0; s < SUBSTEPS; s++) tick();

    if (healing) {
      recovery = clamp(liveMass() / healBaseline, 0, 1);
      if (recovery > 0.985) {
        healing = false;
        recovery = 1;
        // show "recovered", then let the quiescence check below stop the loop
      }
      return; // keep looping while a tear recovers
    }

    // No perpetual motion: once the organism has grown and the field is quiet
    // (and we're past the seed-ring window), stop the loop. It restarts on any
    // interaction (regrow / tear / drag), which call fig.play().
    if (growFrames > SEED_RING_FRAMES && lastChange < 0.04 && fig) {
      fig.render();
      fig.stop();
    }
  }

  // --- figure controller ---
  // Size the grid to the stage aspect so the organism isn't stretched. Crucially
  // we do NOT settle() on the visible path — the reader lands on a SEED and
  // watches it grow. (The reduced-motion triptych settles internally per panel.)
  function sizeGrid(w, h) {
    const aspect = w / h || 1;
    cols = Math.max(40, aspect >= 1 ? N : Math.round(N * aspect));
    rows = Math.max(40, aspect >= 1 ? Math.round(N / aspect) : N);
    buildMask();
    reseed();
  }

  // initial build (square fallback) so we have state before layout settles
  sizeGrid(1, 1);

  // Hero is a calm ambient signature -> autoplay. Crux also autoplays so the
  // grow-from-seed lands; its tear/heal transient uses play()/stop().
  fig = createFigure({
    canvas,
    setup: (e) => sizeGrid(e.w, e.h),
    update,
    draw,
  });
  const env = fig.env;

  // --- pointer interaction: drag to tear (bonus path, both variants) ---
  let drawing = false;
  function pointerPos(ev) {
    const rect = canvas.getBoundingClientRect();
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
  }
  function onDown(ev) {
    if (env.reduced) return; // triptych is static; no drag-to-damage
    drawing = true;
    const p = pointerPos(ev);
    damageAt(p.x, p.y, Math.max(3, cols * 0.08));
    // the crux loop may have stopped after a heal settled — restart so the
    // bonus drag-to-tear visibly heals again
    fig.play();
    canvas.setPointerCapture?.(ev.pointerId);
  }
  function onMove(ev) {
    if (!drawing) return;
    const p = pointerPos(ev);
    damageAt(p.x, p.y, Math.max(3, cols * 0.08));
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
    reseed();
    if (env.reduced) {
      fig.render();
    } else {
      // re-show the live grow (loop is already running for both variants;
      // if the crux loop was stopped after a heal, restart it)
      fig.play();
    }
  });
  controls.append(regrow);

  // Crux variant: self-repair is the centrepiece -> a signposted tear button.
  // Hero variant: calm signature, NO tear chrome.
  if (isCrux) {
    // The live tear/heal demo only makes sense with animation. Under reduced
    // motion the triptych already shows the half-healed panel, advanced by the
    // dedicated "step (heal)" button below — so skip the tear button there.
    if (!env.reduced) {
      const tearBtn = document.createElement('button');
      tearBtn.className = 'ctrl-btn';
      tearBtn.type = 'button';
      tearBtn.textContent = '✂ tear a hole';
      tearBtn.addEventListener('click', tearHole);
      controls.append(tearBtn);
    }

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
    controls.append(ruleToggle);
  }

  // reduced-motion: a manual heal step that advances the right triptych panel
  if (env.reduced && isCrux) {
    const stepBtn = document.createElement('button');
    stepBtn.className = 'ctrl-btn';
    stepBtn.type = 'button';
    stepBtn.textContent = 'step ⏵ (heal)';
    stepBtn.addEventListener('click', () => {
      // advance the healed panel by re-rendering with a few more settle steps.
      // drawTriptych rebuilds from scratch each render, so to make "step" feel
      // like progress we nudge the heal depth used by the triptych.
      triHealSteps += 6;
      fig.render();
    });
    controls.append(stepBtn);
  }

  fig.start();
  return fig;
}
