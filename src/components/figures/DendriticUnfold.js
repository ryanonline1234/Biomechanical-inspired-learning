/* =====================================================================
   DendriticUnfold — chapter 5.3 (dendritic computation).

   A persistent SIDE-BY-SIDE scale comparison. On the LEFT, pinned at full
   opacity the whole time, a single cortical neuron (amber): soma + a few
   dendrite stubs + one axon. On the RIGHT, the deep artificial network you
   need to imitate that one neuron's input/output behaviour — a vertical
   stack of layers (depth is the dominant axis), drawn as a faint phosphor
   GHOST at idle so the scene is always legible, never blank.

   Unfold/fold brings the ghost net up to full opacity. The depth is made
   countable: layers stack vertically and carry the annotation
   "6 layers deep — needs 5–8 to match one neuron (Beniaguev 2021)".

   - Click the neuron (or the unfold/fold ctrl-btn) to toggle.
   - The morph runs via fig.play(); fig.stop() once it settles (motion only).
   - Reduced motion: the FULL co-present comparison in one static frame
     (neuron + fully-lit, labelled net) — not a bare dot.

   Colour pairs with text labels, never alone:
     amber    = one cortical neuron (biology)
     phosphor = deep net needed to imitate it (silicon)
   ===================================================================== */

import { createFigure, palette, clamp, lerp, drawText } from '../lib/canvas.js';

// Depth-ordered layer widths for the imitation network. Six layers — a
// concrete stand-in for the 5–8 deep net the 2021 paper reports. Stacked
// vertically (top = input, bottom = output) so DEPTH reads as the main axis.
const LAYERS = [1, 4, 6, 6, 4, 2];
const DEPTH = LAYERS.length; // 6

// Idle ghost opacity for the imitation net (legible, not blank, not loud).
const GHOST = 0.22;

// Organic ease — slow in, slow out.
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export default function mount(stage) {
  const canvas = stage.querySelector('canvas');
  const controls = stage.querySelector('[data-controls]');
  const pal = palette();

  let fig;              // assigned after createFigure so update() can stop it
  let unfolded = false; // target state
  let progress = 0;     // 0 = ghost net (idle), 1 = full-opacity net
  let animating = false;
  const DUR = 0.85;     // seconds for the unfold/fold morph

  // Neuron hit region, recomputed each draw so the click test matches render.
  let neuron = { x: 0, y: 0, r: 16 };

  // --- geometry ------------------------------------------------------------
  // Left third: the cortical neuron. Right two-thirds: the layer stack.
  function geom(e) {
    const { w, h } = e;
    const padTop = 30;
    const padBot = 64; // headroom for the citation line anchored to the stack
    const colX = w * 0.30;            // boundary between neuron col and net col
    const neuronCx = w * 0.155;
    const neuronCy = h * 0.52;

    // Net stack occupies the right region.
    const netLeft = colX + 40;
    const netRight = w - 72; // leave room on the right for the depth scale + numbers
    const stackTop = padTop + 12;
    const stackBot = h - padBot;
    const rowGap = (stackBot - stackTop) / (DEPTH - 1);

    // Node positions, layer by layer (vertical stack).
    const layers = LAYERS.map((count, li) => {
      const y = stackTop + li * rowGap;
      const spanW = netRight - netLeft;
      const nodes = [];
      for (let r = 0; r < count; r++) {
        const x =
          count === 1
            ? (netLeft + netRight) / 2
            : netLeft + (r / (count - 1)) * spanW;
        nodes.push({ x, y });
      }
      return { y, nodes };
    });

    return {
      neuronCx, neuronCy,
      netLeft, netRight, stackTop, stackBot, rowGap,
      layers,
      colX,
      w,
    };
  }

  // --- the cortical neuron (amber), always full opacity --------------------
  function drawNeuron(ctx, g) {
    const cx = g.neuronCx;
    const cy = g.neuronCy;
    const r = 16;
    neuron = { x: cx, y: cy, r };

    ctx.save();
    ctx.lineCap = 'round';

    // Dendrite stubs radiating up/left (the input arbor that does the compute).
    ctx.strokeStyle = pal.synapse;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 2;
    const dendrites = [
      [-2.55, 30], [-2.05, 26], [-1.62, 30], [-1.18, 24], [-0.72, 27],
    ];
    for (const [ang, len] of dendrites) {
      const ex = cx + Math.cos(ang) * len;
      const ey = cy + Math.sin(ang) * len;
      // slight fork at each dendrite tip
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex + Math.cos(ang - 0.5) * 8, ey + Math.sin(ang - 0.5) * 8);
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex + Math.cos(ang + 0.5) * 8, ey + Math.sin(ang + 0.5) * 8);
      ctx.stroke();
      ctx.lineWidth = 2;
    }

    // Axon: one line exiting right, toward the net it must be imitated by.
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + r * 0.7, cy + 4);
    ctx.lineTo(cx + r + 26, cy + 12);
    ctx.stroke();

    // Soma.
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = pal.synapse;
    ctx.fill();
    // inner core for a little depth (still one colour family)
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = pal.ink;
    ctx.globalAlpha = 0.28;
    ctx.fill();

    ctx.restore();

    // Label, anchored under the soma, ALWAYS full opacity (never fades).
    drawText(ctx, 'title', 'one cortical neuron', cx, cy + r + 22, {
      color: pal.synapse, align: 'center', baseline: 'middle',
    });
  }

  // --- the imitation net (phosphor), ghost -> full ------------------------
  function drawNet(ctx, g, alpha) {
    // edges
    ctx.save();
    ctx.strokeStyle = pal.phosphor;
    ctx.lineWidth = 1;
    for (let li = 0; li < g.layers.length - 1; li++) {
      const from = g.layers[li].nodes;
      const to = g.layers[li + 1].nodes;
      for (const a of from) {
        for (const b of to) {
          ctx.globalAlpha = alpha * 0.4;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }
    ctx.restore();

    // nodes
    ctx.save();
    ctx.fillStyle = pal.phosphor;
    for (const layer of g.layers) {
      for (const n of layer.nodes) {
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(n.x, n.y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // --- depth annotation: makes "6 layers" countable, bound to the stack ----
  function drawDepthScale(ctx, g, alpha) {
    const x = g.netRight + 18;
    ctx.save();
    // A thin vertical spine spanning the stack, with a tick per layer.
    ctx.strokeStyle = pal.boneDim;
    ctx.globalAlpha = 0.35 + 0.4 * alpha;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, g.stackTop);
    ctx.lineTo(x, g.stackBot);
    ctx.stroke();
    for (let li = 0; li < g.layers.length; li++) {
      const y = g.layers[li].y;
      ctx.beginPath();
      ctx.moveTo(x - 3, y);
      ctx.lineTo(x + 3, y);
      ctx.stroke();
    }
    ctx.restore();

    // Per-tick layer count, faint mono. "depth" reads down the column.
    for (let li = 0; li < g.layers.length; li++) {
      const y = g.layers[li].y;
      drawText(ctx, 'data', String(li + 1), x + 9, y, {
        color: pal.boneDim, align: 'left', baseline: 'middle',
        size: 9.5, alpha: 0.5 + 0.45 * alpha,
      });
    }
    drawText(ctx, 'label', 'layers deep', g.w - 8, g.stackBot + 16, {
      color: pal.boneDim, align: 'right', baseline: 'middle',
      size: 9, alpha: 0.45 + 0.4 * alpha,
    });
  }

  function draw(e) {
    const { ctx, w, h } = e;
    ctx.clearRect(0, 0, w, h);
    const g = geom(e);

    // Under reduced motion we always present the full comparison.
    const p = e.reduced ? 1 : easeInOutCubic(clamp(progress, 0, 1));
    const netAlpha = lerp(GHOST, 1, p);

    // Connector from neuron to net: "to imitate this →" (graphite, framing).
    const cyConn = g.neuronCy;
    const x0 = g.neuronCx + 16 + 30; // just past the axon
    const x1 = g.netLeft - 12;
    ctx.save();
    ctx.strokeStyle = pal.graphite;
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(x0, cyConn + 12);
    ctx.lineTo(x1, cyConn);
    ctx.stroke();
    // arrowhead
    ctx.beginPath();
    ctx.moveTo(x1, cyConn);
    ctx.lineTo(x1 - 7, cyConn - 4);
    ctx.moveTo(x1, cyConn);
    ctx.lineTo(x1 - 7, cyConn + 4);
    ctx.stroke();
    ctx.restore();
    drawText(ctx, 'label', 'to imitate this', (x0 + x1) / 2, cyConn - 12, {
      color: pal.boneDim, align: 'center', baseline: 'middle', size: 9,
    });

    // Right side: the imitation net (ghost at idle, full when unfolded).
    drawNet(ctx, g, netAlpha);
    drawDepthScale(ctx, g, p);

    // Left side: the neuron, drawn last so it always reads clean on top.
    drawNeuron(ctx, g);

    // Net thesis label — display tier, anchored above the stack.
    const netCx = (g.netLeft + g.netRight) / 2;
    drawText(ctx, 'title', 'deep net to imitate it', netCx, g.stackTop - 18, {
      color: pal.phosphor, align: 'center', baseline: 'middle',
      alpha: 0.55 + 0.45 * p,
    });

    // Countable-depth citation, bound to the bottom of the stack (not floating
    // in a corner). "6 layers deep" is literally what's drawn above it.
    drawText(
      ctx, 'data',
      `${DEPTH} layers deep · needs 5–8 to match one neuron`,
      netCx, h - 30,
      { color: pal.boneDim, align: 'center', baseline: 'middle', size: 10 }
    );
    drawText(ctx, 'label', 'Beniaguev 2021', netCx, h - 15, {
      color: pal.boneDim, align: 'center', baseline: 'middle', size: 8.5,
      alpha: 0.7,
    });
  }

  function update(dt) {
    if (!animating) return;
    const dir = unfolded ? 1 : -1;
    progress = clamp(progress + (dir * dt) / DUR, 0, 1);
    if ((dir > 0 && progress >= 1) || (dir < 0 && progress <= 0)) {
      animating = false;
      if (fig) fig.stop(); // settle: go still once the morph completes
    }
  }

  fig = createFigure({ canvas, update, draw, autoplay: false });
  const env = fig.env;

  // Toggle ghost <-> full. Reduced motion already shows the full frame, so the
  // toggle is a no-op visual there (the static frame is the resolved state).
  function toggle() {
    unfolded = !unfolded;
    foldBtn.textContent = unfolded ? 'fold ◀' : 'unfold ▶';
    foldBtn.setAttribute('aria-pressed', String(unfolded));
    if (env.reduced) {
      progress = 1; // full comparison is always the static truth
      animating = false;
      fig.render();
    } else {
      animating = true;
      fig.play(); // run the transient morph; update() calls stop() when settled
    }
  }

  // --- click the neuron itself ---
  function pos(ev) {
    const rect = canvas.getBoundingClientRect();
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
  }
  canvas.addEventListener('pointerdown', (ev) => {
    const p = pos(ev);
    const r = Math.max(neuron.r + 8, 22); // generous hit target around the soma
    if (Math.hypot(p.x - neuron.x, p.y - neuron.y) <= r) {
      toggle();
    }
  });
  canvas.style.cursor = 'pointer';

  // --- unfold / fold ctrl-btn ---
  const foldBtn = document.createElement('button');
  foldBtn.className = 'ctrl-btn';
  foldBtn.type = 'button';
  foldBtn.textContent = 'unfold ▶';
  foldBtn.setAttribute('aria-pressed', 'false');
  foldBtn.addEventListener('click', toggle);
  controls.append(foldBtn);

  // Legend chips (text + colour).
  const chipBio = document.createElement('span');
  chipBio.className = 'ctrl-chip';
  chipBio.style.setProperty('--c', pal.synapse);
  chipBio.textContent = 'one cortical neuron (biology)';
  const chipSil = document.createElement('span');
  chipSil.className = 'ctrl-chip';
  chipSil.style.setProperty('--c', pal.phosphor);
  chipSil.textContent = 'deep net to imitate it (silicon)';
  controls.append(chipBio, chipSil);

  // Paint the initial scene: neuron + ghost net (or, under reduced motion, the
  // full co-present comparison). With autoplay off, start() paints one static
  // frame and does not loop; createFigure's own resize rAF is the authoritative
  // first paint once the canvas has been sized.
  fig.start();
  return fig;
}
