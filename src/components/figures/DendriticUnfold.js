/* =====================================================================
   DendriticUnfold — chapter 5.3 (dendritic computation).

   A single biological neuron (one amber dot, "1 neuron") UNFOLDS into the
   multi-layer artificial network needed to imitate its input/output
   behaviour: a 5–8 layer deep net (Beniaguev, Segev & London, Neuron 2021).
   Here a 1 -> 4 -> 6 -> 6 -> 4 -> 2 stack stands in for that depth.

   - Click the dot (or the unfold/fold ctrl-btn) to toggle.
   - Nodes spawn and connections draw in with organic easing (progress 0->1).
   - Reduced motion: toggle snaps instantly between the dot state and the
     fully-unfolded network, via fig.render() (no animation).

   Colour pairs with text labels, never alone:
     amber  = neuron (biology)
     phosphor = network needed to imitate it (silicon)
   ===================================================================== */

import { createFigure, palette, clamp } from '../lib/canvas.js';

// Layer widths for the imitation network. The single neuron (left) blossoms
// into ~6 layers — a stand-in for the 5–8 deep net the 2021 paper reports.
const LAYERS = [1, 4, 6, 6, 4, 2];

// Organic ease — slow in, slow out — so spawning feels biological, not linear.
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export default function mount(stage) {
  const canvas = stage.querySelector('canvas');
  const controls = stage.querySelector('[data-controls]');
  const pal = palette();

  let unfolded = false; // target state
  let progress = 0;     // 0 = single dot, 1 = full network
  let animating = false;
  const DUR = 0.9;      // seconds for the unfold/fold

  // Cache node screen positions per draw so the click test matches the render.
  let nodePositions = []; // [{x,y,layer,row}]
  let dotPos = { x: 0, y: 0, r: 14 };

  // Compute node layout for a given env. The first layer's single node is the
  // "seed" that the original amber dot morphs into.
  function layout(e) {
    nodePositions = [];
    const padX = 64;
    const padY = 48;
    const usableW = e.w - padX * 2;
    const usableH = e.h - padY * 2;
    for (let li = 0; li < LAYERS.length; li++) {
      const count = LAYERS[li];
      const x = padX + (LAYERS.length === 1 ? 0 : (li / (LAYERS.length - 1)) * usableW);
      for (let r = 0; r < count; r++) {
        // Vertically centre each layer's column of nodes.
        const y =
          count === 1
            ? e.h / 2
            : padY + (r / (count - 1)) * usableH;
        nodePositions.push({ x, y, layer: li, row: r });
      }
    }
    // The seed node (layer 0) is where the single dot lives.
    const seed = nodePositions.find((n) => n.layer === 0);
    dotPos = { x: seed.x, y: seed.y, r: 14 };
  }

  function nodeAt(i) {
    return nodePositions[i];
  }

  // How "alive" a layer is at the current progress. Layers reveal left->right:
  // layer li becomes fully present once progress passes its slice of [0,1].
  function layerReveal(li, p) {
    if (li === 0) return 1; // seed always present
    const slices = LAYERS.length - 1;
    const startP = (li - 1) / slices * 0.85; // begin a touch before its slot
    const span = 0.4;
    return clamp((p - startP) / span, 0, 1);
  }

  function draw(e) {
    const { ctx, w, h } = e;
    ctx.clearRect(0, 0, w, h);
    layout(e);

    const p = easeInOutCubic(clamp(progress, 0, 1));

    // --- connections (phosphor) draw in as the network unfolds ---
    ctx.save();
    ctx.strokeStyle = pal.phosphor;
    for (let li = 0; li < LAYERS.length - 1; li++) {
      const rev = layerReveal(li + 1, p); // edges appear with their target layer
      if (rev <= 0) continue;
      const from = nodePositions.filter((n) => n.layer === li);
      const to = nodePositions.filter((n) => n.layer === li + 1);
      for (const a of from) {
        for (const b of to) {
          // Grow the line from a toward b, eased per target layer.
          const bx = a.x + (b.x - a.x) * rev;
          const by = a.y + (b.y - a.y) * rev;
          ctx.globalAlpha = 0.35 * rev;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(bx, by);
          ctx.stroke();
        }
      }
    }
    ctx.restore();

    // --- nodes ---
    for (const n of nodePositions) {
      if (n.layer === 0) {
        // Seed node morphs from the big amber dot to a small phosphor node.
        // Amber when folded (biology), cooling to phosphor as it unfolds.
        const r = 14 - 8 * p;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        // Cross-fade fill: amber dot underneath, phosphor node on top.
        ctx.fillStyle = pal.synapse;
        ctx.globalAlpha = 1 - p;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = pal.phosphor;
        ctx.globalAlpha = p;
        ctx.fill();
        ctx.globalAlpha = 1;
        continue;
      }
      const rev = layerReveal(n.layer, p);
      if (rev <= 0) continue;
      ctx.globalAlpha = rev;
      ctx.fillStyle = pal.phosphor;
      ctx.beginPath();
      ctx.arc(n.x, n.y, 6 * rev, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // --- labels (text always pairs the colour) ---
    ctx.save();
    ctx.font = '11px "Spline Sans Mono", monospace';
    ctx.textBaseline = 'middle';

    // Label near the seed dot.
    ctx.globalAlpha = 1 - p;
    ctx.fillStyle = pal.synapse;
    ctx.textAlign = 'left';
    ctx.fillText('1 neuron', dotPos.x + 22, dotPos.y);
    ctx.globalAlpha = 1;

    // Label for the unfolded network, fades in on the right.
    ctx.globalAlpha = p;
    ctx.fillStyle = pal.phosphor;
    ctx.textAlign = 'right';
    ctx.fillText('≈ 5–8 layer network to mimic it', w - 18, 24);
    ctx.globalAlpha = 1;

    // Legend (bottom-left), always visible — colour + meaning.
    ctx.textAlign = 'left';
    ctx.fillStyle = pal.synapse;
    ctx.fillText('● neuron (biology)', 16, h - 30);
    ctx.fillStyle = pal.phosphor;
    ctx.fillText('● network needed to imitate it (silicon)', 16, h - 14);
    ctx.restore();
  }

  function update(dt) {
    if (!animating) return;
    const dir = unfolded ? 1 : -1;
    progress = clamp(progress + (dir * dt) / DUR, 0, 1);
    if ((dir > 0 && progress >= 1) || (dir < 0 && progress <= 0)) {
      animating = false;
    }
  }

  const fig = createFigure({ canvas, update, draw, autoplay: false });
  const env = fig.env;

  // Toggle between dot and network. Reduced motion snaps; otherwise animates.
  function toggle() {
    unfolded = !unfolded;
    foldBtn.textContent = unfolded ? 'fold ◀' : 'unfold ▶';
    foldBtn.setAttribute('aria-pressed', String(unfolded));
    if (env.reduced) {
      progress = unfolded ? 1 : 0;
      animating = false;
      fig.render();
    } else {
      animating = true;
      fig.start(); // resume the loop to run the morph (autoplay off otherwise)
    }
  }

  // --- click the dot itself ---
  function pos(ev) {
    const rect = canvas.getBoundingClientRect();
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
  }
  canvas.addEventListener('pointerdown', (ev) => {
    const p = pos(ev);
    // Hit test against the seed dot's current radius (point-in-circle).
    const r = Math.max(dotPos.r, 16);
    if (Math.hypot(p.x - dotPos.x, p.y - dotPos.y) <= r) {
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
  chipBio.textContent = 'neuron (biology)';
  const chipSil = document.createElement('span');
  chipSil.className = 'ctrl-chip';
  chipSil.style.setProperty('--c', pal.phosphor);
  chipSil.textContent = 'network needed to imitate it (silicon)';
  controls.append(chipBio, chipSil);

  fig.start(); // paints the initial static dot (autoplay off until a toggle)
  return fig;
}
