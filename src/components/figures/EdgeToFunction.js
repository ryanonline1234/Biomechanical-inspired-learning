/* =====================================================================
   EdgeToFunction — chapter 5.4 (Kolmogorov–Arnold Networks).

   Two nodes joined by ONE edge. In a normal network the connection carries a
   single scalar weight (a number on the wire). In a KAN the connection IS a
   learnable function — the number becomes a curve.

   - Click the edge (or the ctrl-btn) to morph: the scalar fades/shrinks while
     a small wiggly function (sum of sines) grows into a plot box on the wire.
   - Reduced motion: toggle snaps instantly between the scalar and function
     states, via fig.render() (no animation).

   Colour: nodes in bone/graphite (neutral structure); the learned function in
   phosphor (the silicon mechanism). Both states carry a text label.
   ===================================================================== */

import { createFigure, palette, clamp } from '../lib/canvas.js';

// Organic ease for the morph.
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// The "learned" activation on the edge: a small wiggly spline-like function.
// Sum of a couple of sines so it reads as a non-trivial, learnable shape.
function learnedFn(u) {
  // u in [0,1] across the plot; output roughly in [-1,1].
  return (
    0.55 * Math.sin(u * Math.PI * 2.0 + 0.6) +
    0.35 * Math.sin(u * Math.PI * 4.0 + 1.4) +
    0.18 * Math.sin(u * Math.PI * 6.0)
  );
}

export default function mount(stage) {
  const canvas = stage.querySelector('canvas');
  const controls = stage.querySelector('[data-controls]');
  const pal = palette();

  let isFunction = false; // false = scalar weight, true = learned function
  let progress = 0;       // 0 = scalar, 1 = function
  let animating = false;
  const DUR = 0.8;

  const WEIGHT = 0.62; // the scalar weight on the wire

  // Geometry cached per draw so the edge hit-test matches the render.
  let geom = { ax: 0, ay: 0, bx: 0, by: 0, midx: 0, midy: 0 };

  function layout(e) {
    const cy = e.h / 2;
    const ax = e.w * 0.22;
    const bx = e.w * 0.78;
    geom = { ax, ay: cy, bx, by: cy, midx: (ax + bx) / 2, midy: cy };
  }

  function draw(e) {
    const { ctx, w, h } = e;
    ctx.clearRect(0, 0, w, h);
    layout(e);
    const { ax, ay, bx, by, midx, midy } = geom;
    const p = easeInOutCubic(clamp(progress, 0, 1));

    // --- the edge (always present) ---
    ctx.save();
    ctx.strokeStyle = pal.graphite;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
    ctx.restore();

    // --- scalar number on the wire (fades + shrinks out) ---
    if (p < 1) {
      ctx.save();
      const a = 1 - p;
      ctx.globalAlpha = a;
      ctx.translate(midx, midy - 14);
      ctx.scale(0.7 + 0.3 * a, 0.7 + 0.3 * a); // shrink as it leaves
      ctx.fillStyle = pal.bone;
      ctx.font = '14px "Spline Sans Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('w = ' + WEIGHT.toFixed(2), 0, 0);
      ctx.restore();
    }

    // --- learnable curve in a plot box on the edge (grows in) ---
    if (p > 0) {
      const boxW = 132;
      const boxH = 64 * p; // box grows vertically as it appears
      const bx0 = midx - boxW / 2;
      const by0 = midy - boxH / 2;
      ctx.save();
      ctx.globalAlpha = p;

      // plot frame
      ctx.strokeStyle = pal.graphite;
      ctx.lineWidth = 1;
      ctx.strokeRect(bx0, by0, boxW, boxH);
      // zero axis
      ctx.beginPath();
      ctx.moveTo(bx0, midy);
      ctx.lineTo(bx0 + boxW, midy);
      ctx.globalAlpha = p * 0.4;
      ctx.stroke();
      ctx.globalAlpha = p;

      // the learned function in phosphor; reveal left->right as it grows
      ctx.strokeStyle = pal.phosphor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      const N = 60;
      const reveal = Math.floor(N * p);
      for (let i = 0; i <= reveal; i++) {
        const u = i / N;
        const fy = learnedFn(u); // [-1,1]
        const px = bx0 + u * boxW;
        const py = midy - fy * (boxH / 2 - 4);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();
    }

    // --- the two nodes (bone fill, graphite ring) ---
    for (const [nx, ny] of [[ax, ay], [bx, by]]) {
      ctx.beginPath();
      ctx.arc(nx, ny, 16, 0, Math.PI * 2);
      ctx.fillStyle = pal.bone;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = pal.graphite;
      ctx.stroke();
    }

    // --- caption + state label (text always carries the meaning) ---
    ctx.save();
    ctx.font = '11px "Spline Sans Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // State label under the edge.
    ctx.fillStyle = p > 0.5 ? pal.phosphor : pal.bone;
    const stateLabel = p > 0.5
      ? 'edge = learnable function (KAN)'
      : 'edge = scalar weight';
    ctx.fillText(stateLabel, midx, h - 38);

    // The thesis caption, brightest at the function end.
    ctx.fillStyle = pal.phosphor;
    ctx.globalAlpha = 0.5 + 0.5 * p;
    ctx.fillText('a number becomes a function.', midx, h - 20);
    ctx.restore();
  }

  function update(dt) {
    if (!animating) return;
    const dir = isFunction ? 1 : -1;
    progress = clamp(progress + (dir * dt) / DUR, 0, 1);
    if ((dir > 0 && progress >= 1) || (dir < 0 && progress <= 0)) {
      animating = false;
    }
  }

  const fig = createFigure({ canvas, update, draw, autoplay: false });
  const env = fig.env;

  function toggle() {
    isFunction = !isFunction;
    morphBtn.textContent = isFunction ? 'show scalar ◀' : 'show function ▶';
    morphBtn.setAttribute('aria-pressed', String(isFunction));
    if (env.reduced) {
      progress = isFunction ? 1 : 0;
      animating = false;
      fig.render();
    } else {
      animating = true;
      fig.start(); // run the morph (loop is paused otherwise)
    }
  }

  // --- click the edge (point-near-segment test) ---
  function pos(ev) {
    const rect = canvas.getBoundingClientRect();
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
  }
  // Distance from point to the horizontal edge segment [a,b].
  function nearEdge(px, py) {
    const { ax, ay, bx } = geom;
    const within = px >= ax - 6 && px <= bx + 6; // along the wire
    const dist = Math.abs(py - ay);               // edge is horizontal
    // Also accept clicks inside the plot box once it's shown.
    const inBox = px >= geom.midx - 70 && px <= geom.midx + 70 &&
      Math.abs(py - geom.midy) <= 40;
    return (within && dist <= 18) || inBox;
  }
  canvas.addEventListener('pointerdown', (ev) => {
    const p = pos(ev);
    if (nearEdge(p.x, p.y)) toggle();
  });
  canvas.style.cursor = 'pointer';

  // --- morph ctrl-btn ---
  const morphBtn = document.createElement('button');
  morphBtn.className = 'ctrl-btn';
  morphBtn.type = 'button';
  morphBtn.textContent = 'show function ▶';
  morphBtn.setAttribute('aria-pressed', 'false');
  morphBtn.addEventListener('click', toggle);
  controls.append(morphBtn);

  // Legend chip — the learned function colour + meaning.
  const chip = document.createElement('span');
  chip.className = 'ctrl-chip';
  chip.style.setProperty('--c', pal.phosphor);
  chip.textContent = 'learnable function on the edge';
  controls.append(chip);

  fig.start(); // paint the initial scalar state (autoplay off until toggle)
  return fig;
}
