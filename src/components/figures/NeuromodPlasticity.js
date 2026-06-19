/* =====================================================================
   NeuromodPlasticity — chapter 3 (adaptive learning rules,
   the still-losing BIOLOGICAL thread).

   A small network: 3 inputs -> 4 hidden -> 2 outputs.
   Two controls:
     - neuromodulator toggle (on/off)
     - input-context segmented toggle (context A / context B)

   When the neuromodulator is ON, a network-generated gating signal selects
   WHICH subset of connections become plastic. Those plastic edges light up in
   synapse AMBER and visibly thicken as correlated endpoint activity flows
   (a local, gated, self-directed update — NO global backward pass).
   When OFF, nothing is plastic; every edge stays graphite/fixed.
   Switching context deterministically moves the plastic subset elsewhere.

   Color: synapse amber — this is the biological thread.
   ===================================================================== */

import { createFigure, palette, clamp, lerp, hexToRgb, rgba } from '../lib/canvas.js';

// Layer sizes.
const LAYERS = [3, 4, 2];

export default function mount(stage) {
  const canvas = stage.querySelector('canvas');
  const controls = stage.querySelector('[data-controls]');
  const pal = palette();
  const synRGB = hexToRgb(pal.synapse);

  let neuromod = true; // gating on/off
  let context = 'A'; // 'A' | 'B'

  // Build node list with layer/index, positions assigned per draw.
  const nodes = [];
  LAYERS.forEach((count, layer) => {
    for (let i = 0; i < count; i++) nodes.push({ layer, i, count });
  });
  const nodeIndex = (layer, i) =>
    nodes.findIndex((n) => n.layer === layer && n.i === i);

  // Build edges between consecutive layers (fully connected).
  const edges = [];
  for (let L = 0; L < LAYERS.length - 1; L++) {
    for (let a = 0; a < LAYERS[L]; a++) {
      for (let b = 0; b < LAYERS[L + 1]; b++) {
        edges.push({
          from: nodeIndex(L, a),
          to: nodeIndex(L + 1, b),
          layer: L,
          a,
          b,
          width: 1, // current rendered thickness (grows when plastic)
        });
      }
    }
  }
  const BASE_W = 1;
  const MAX_W = 6; // cap the growth

  // Deterministically choose the plastic subset for a given context.
  // Different contexts route plasticity to a DIFFERENT set of edges.
  function isPlastic(edge) {
    if (!neuromod) return false;
    // gating signal: a deterministic function of edge identity + context.
    // context A keeps even-parity routes, B keeps odd-parity — disjoint-ish.
    const key = edge.layer * 7 + edge.a * 3 + edge.b;
    const parity = key % 2;
    return context === 'A' ? parity === 0 : parity === 1;
  }

  // Per-node activity phase, so pulses travel coherently.
  // Endpoint "correlation" is high when both endpoints are active together.
  let clock = 0;
  function nodeActivity(n) {
    // a slow oscillation per node, seeded by layer+index for variety
    const seed = n.layer * 1.7 + n.i * 0.9;
    return 0.5 + 0.5 * Math.sin(clock * 1.6 + seed);
  }

  // Layout: spread layers horizontally, nodes vertically centered.
  function layout(e) {
    const padX = 64;
    const padY = 30;
    const cols = LAYERS.length;
    const colGap = (e.w - padX * 2) / (cols - 1);
    nodes.forEach((n) => {
      n.x = padX + n.layer * colGap;
      const rowGap = (e.h - padY * 2) / Math.max(1, n.count - 1);
      n.y = n.count === 1 ? e.h / 2 : padY + n.i * rowGap;
    });
  }

  // One plasticity update: thicken plastic edges with correlated endpoints.
  // Local rule only — no global backward pass.
  function plasticityStep(amount) {
    for (const ed of edges) {
      if (!isPlastic(ed)) {
        // fixed edges relax back to base thickness
        ed.width = lerp(ed.width, BASE_W, 0.08);
        continue;
      }
      const corr = nodeActivity(nodes[ed.from]) * nodeActivity(nodes[ed.to]);
      // Hebbian-ish: grow with correlated co-activity, capped at MAX_W.
      ed.width = clamp(ed.width + corr * amount, BASE_W, MAX_W);
    }
  }

  function draw(e) {
    const { ctx, w, h } = e;
    ctx.clearRect(0, 0, w, h);
    layout(e);

    // --- edges ---
    for (const ed of edges) {
      const A = nodes[ed.from];
      const B = nodes[ed.to];
      const plastic = isPlastic(ed);
      ctx.beginPath();
      ctx.moveTo(A.x, A.y);
      ctx.lineTo(B.x, B.y);
      if (plastic) {
        ctx.strokeStyle = pal.synapse;
        ctx.lineWidth = ed.width;
        ctx.globalAlpha = 0.95;
      } else {
        ctx.strokeStyle = pal.graphite;
        ctx.lineWidth = BASE_W;
        ctx.globalAlpha = 0.7;
      }
      ctx.stroke();
      ctx.globalAlpha = 1;

      // traveling activity pulse along plastic edges (skip when reduced)
      if (plastic && !e.reduced) {
        // pulse position cycles; correlated endpoints make it brighter
        const corr = nodeActivity(A) * nodeActivity(B);
        const tp = (clock * 0.6 + ed.a * 0.2 + ed.b * 0.13) % 1;
        const px = lerp(A.x, B.x, tp);
        const py = lerp(A.y, B.y, tp);
        ctx.fillStyle = rgba(synRGB, 0.4 + 0.5 * corr);
        ctx.beginPath();
        ctx.arc(px, py, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // --- nodes ---
    ctx.font = '11px "Spline Sans Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const n of nodes) {
      const act = e.reduced ? 0.6 : nodeActivity(n);
      const r = 11;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = pal.ink;
      ctx.fill();
      // ring brightness tracks activity (bone, warmer when active)
      ctx.lineWidth = 2;
      ctx.strokeStyle = rgba(hexToRgb(pal.bone), 0.4 + 0.6 * act);
      ctx.stroke();
      // inner activity dot
      ctx.beginPath();
      ctx.arc(n.x, n.y, r * 0.45 * act, 0, Math.PI * 2);
      ctx.fillStyle = rgba(hexToRgb(pal.bone), 0.8);
      ctx.fill();
    }

    // --- layer captions ---
    ctx.textAlign = 'center';
    ctx.fillStyle = pal.bone;
    ctx.globalAlpha = 0.55;
    const caps = ['input', 'hidden', 'output'];
    LAYERS.forEach((c, L) => {
      const n = nodes.find((nn) => nn.layer === L);
      if (n) ctx.fillText(caps[L], n.x, 14);
    });
    ctx.globalAlpha = 1;

    // --- state caption: the "no backward pass" point ---
    ctx.textAlign = 'left';
    ctx.fillStyle = neuromod ? pal.synapse : pal.graphite;
    const msg = neuromod
      ? `neuromod ON — local gated plasticity, context ${context} (no backward pass)`
      : 'neuromod OFF — all weights fixed';
    ctx.fillText(msg, 12, e.h - 10);
    ctx.textAlign = 'left';
  }

  function update(dt, e) {
    clock += dt;
    // continuous slow plasticity while animating
    plasticityStep(dt * 1.2);
  }

  const fig = createFigure({ canvas, update, draw });
  const env = fig.env;

  // --- neuromodulator toggle (segmented, biological amber press) ---
  const segMod = document.createElement('div');
  segMod.className = 'ctrl-seg is-bio';
  segMod.setAttribute('role', 'group');
  segMod.setAttribute('aria-label', 'Neuromodulator');
  const modOptions = [
    ['on', true],
    ['off', false],
  ];
  const modBtns = modOptions.map(([label, val]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = `neuromod ${label}`;
    b.setAttribute('aria-pressed', String(val === neuromod));
    b.addEventListener('click', () => {
      neuromod = val;
      modBtns.forEach((bb, k) =>
        bb.setAttribute('aria-pressed', String(modOptions[k][1] === neuromod))
      );
      if (env.reduced) fig.render();
    });
    segMod.append(b);
    return b;
  });
  controls.append(segMod);

  // --- context toggle (segmented) ---
  const segCtx = document.createElement('div');
  segCtx.className = 'ctrl-seg';
  segCtx.setAttribute('role', 'group');
  segCtx.setAttribute('aria-label', 'Input context');
  const ctxOptions = ['A', 'B'];
  const ctxBtns = ctxOptions.map((c) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = `context ${c}`;
    b.setAttribute('aria-pressed', String(c === context));
    b.addEventListener('click', () => {
      context = c;
      ctxBtns.forEach((bb, k) =>
        bb.setAttribute('aria-pressed', String(ctxOptions[k] === context))
      );
      // moving context resets thickened edges so the new subset grows fresh
      for (const ed of edges) ed.width = BASE_W;
      if (env.reduced) fig.render();
    });
    segCtx.append(b);
    return b;
  });
  controls.append(segCtx);

  // --- legend chips: meaning never by color alone ---
  const chipFixed = document.createElement('span');
  chipFixed.className = 'ctrl-chip';
  chipFixed.style.setProperty('--c', pal.graphite);
  chipFixed.textContent = 'fixed';
  const chipPlastic = document.createElement('span');
  chipPlastic.className = 'ctrl-chip';
  chipPlastic.style.setProperty('--c', pal.synapse);
  chipPlastic.textContent = 'plastic now';
  controls.append(chipFixed, chipPlastic);

  // --- reduced motion: step applies one plasticity update + re-renders ---
  if (env.reduced) {
    const stepBtn = document.createElement('button');
    stepBtn.className = 'ctrl-btn';
    stepBtn.type = 'button';
    stepBtn.textContent = 'step ⏵';
    stepBtn.addEventListener('click', () => {
      // advance the activity clock a notch and apply one update
      clock += 0.5;
      plasticityStep(0.8);
      fig.render();
    });
    controls.append(stepBtn);
  }

  fig.start();
  return fig;
}
