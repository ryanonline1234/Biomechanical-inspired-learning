/* =====================================================================
   EdgeToFunction — chapter 5.4 (Kolmogorov–Arnold Networks).

   Two nodes joined by ONE edge. In a normal network the connection carries a
   single scalar weight (a number on the wire). In a KAN the connection IS a
   learnable function — the number becomes a curve.

   The figure is built around an ALWAYS-VISIBLE plot box on the wire. On load it
   already paints a real plot: the straight line y = 0.62·x with "w = 0.62" as a
   focal headline. The point lands before any click — a weight already is a
   function, just a straight line of slope 0.62.

   - Toggle (click the box / the ctrl-btn) BENDS that line, in the same box, into
     the learned phosphor curve over ~0.8s; the readout morphs "w = 0.62" -> "f(x)".
     The straight line generalises into a curve; it is not swapped out.
   - Reduced motion: both curves are drawn overlaid (faint bone line + phosphor
     curve); the toggle swaps which one is full-alpha. One honest static frame.

   Colour: nodes + the scalar line in bone (neutral structure / the weight); the
   learned function in phosphor (the silicon mechanism). Both carry a text label.
   ===================================================================== */

import { createFigure, palette, clamp, lerp, drawText } from '../lib/canvas.js';

// Organic ease for the bend.
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

const WEIGHT = 0.62; // the scalar weight on the wire

// The "learned" activation on the edge: a small wiggly spline-like function.
// u in [-1,1] across the plot; output roughly in [-1,1]. Anchored at the origin
// so the bend starts cleanly from the straight line through (0,0).
function learnedFn(u) {
  return (
    0.62 * Math.sin(u * 1.9) +
    0.22 * Math.sin(u * 4.3 + 0.6) +
    0.10 * Math.sin(u * 7.1)
  );
}

// The scalar weight read as a function: the straight line y = w·x.
function scalarFn(u) {
  return WEIGHT * u;
}

export default function mount(stage) {
  const canvas = stage.querySelector('canvas');
  const controls = stage.querySelector('[data-controls]');
  const pal = palette();

  let fig; // assigned after createFigure; update() closes over it to call stop()

  let isFunction = false; // false = scalar weight, true = learned function
  let progress = 0;       // 0 = scalar (straight line), 1 = function (curve)
  let animating = false;
  let hovering = false;   // pointer over the plot box (focus/hover ring)
  const DUR = 0.8;

  // Plot box geometry, cached per draw so the hit-test matches the render.
  let box = { x: 0, y: 0, w: 0, h: 0, cx: 0, cy: 0 };

  function layout(e) {
    const boxW = Math.min(240, e.w * 0.6);
    const boxH = Math.min(150, e.h * 0.52);
    const cx = e.w / 2;
    const cy = e.h * 0.52; // nudged down slightly to leave room for the headline
    box = {
      x: cx - boxW / 2,
      y: cy - boxH / 2,
      w: boxW,
      h: boxH,
      cx,
      cy,
    };
  }

  // Map plot coords (u,v in [-1,1]) to canvas pixels inside the box.
  const PAD = 8; // inset so the curve doesn't touch the frame
  function px(u) {
    return box.x + PAD + ((u + 1) / 2) * (box.w - 2 * PAD);
  }
  function py(v) {
    return box.y + PAD + ((1 - v) / 2) * (box.h - 2 * PAD);
  }

  // Sample a curve fn(u) across the box and stroke it.
  function strokeCurve(ctx, fn, color, width, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const N = 96;
    for (let i = 0; i <= N; i++) {
      const u = -1 + (2 * i) / N;
      const v = clamp(fn(u), -1, 1);
      const X = px(u);
      const Y = py(v);
      if (i === 0) ctx.moveTo(X, Y);
      else ctx.lineTo(X, Y);
    }
    ctx.stroke();
    ctx.restore();
  }

  // The bent curve at morph fraction p: linear interpolation between the
  // straight line and the learned curve, per sample (a true bend, not a swap).
  function bentFn(p) {
    return (u) => lerp(scalarFn(u), learnedFn(u), p);
  }

  // Blend bone -> phosphor over the bend.
  function bendColor(p) {
    // Resolve once per draw; cheap enough and keeps token() out of the loop.
    const b = pal._boneRGB || (pal._boneRGB = hexToRgbLocal(pal.bone));
    const ph = pal._phosRGB || (pal._phosRGB = hexToRgbLocal(pal.phosphor));
    const r = Math.round(lerp(b.r, ph.r, p));
    const g = Math.round(lerp(b.g, ph.g, p));
    const bl = Math.round(lerp(b.b, ph.b, p));
    return `rgb(${r},${g},${bl})`;
  }

  function hexToRgbLocal(hex) {
    const h = hex.trim().replace('#', '');
    const s = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    const n = parseInt(s, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  // Draw the plot frame: box outline + faint center axes + tick labels.
  function drawFrame(ctx, e) {
    ctx.save();
    // Optional hover/focus ring (phosphor-tinted, subtle) — affordance only.
    if (hovering && !e.reduced) {
      ctx.save();
      ctx.strokeStyle = pal.phosphor;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(box.x - 3, box.y - 3, box.w + 6, box.h + 6);
      ctx.restore();
    }

    // Box frame.
    ctx.strokeStyle = pal.graphite;
    ctx.lineWidth = 1;
    ctx.strokeRect(box.x, box.y, box.w, box.h);

    // Center axes (x and y through the origin), faint.
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(box.x, py(0));
    ctx.lineTo(box.x + box.w, py(0)); // x-axis (out = 0)
    ctx.moveTo(px(0), box.y);
    ctx.lineTo(px(0), box.y + box.h); // y-axis (in x = 0)
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();

    // Tick labels on the x-axis: -1, 0, 1 (so the slope of y=0.62x is readable).
    const tickY = py(0) + 12;
    drawText(ctx, 'label', '-1', px(-1), tickY, {
      color: pal.boneDim, align: 'left', baseline: 'middle', size: 9, alpha: 0.7,
    });
    drawText(ctx, 'label', '0', px(0) + 4, tickY, {
      color: pal.boneDim, align: 'left', baseline: 'middle', size: 9, alpha: 0.7,
    });
    drawText(ctx, 'label', '1', px(1), tickY, {
      color: pal.boneDim, align: 'right', baseline: 'middle', size: 9, alpha: 0.7,
    });
  }

  // Nodes + wire passing through the box: input A (in x) -> output B (out).
  function drawWire(ctx, e) {
    const ay = box.cy;
    const ax = Math.max(22, box.x - e.w * 0.12);
    const bx = Math.min(e.w - 22, box.x + box.w + e.w * 0.12);

    ctx.save();
    ctx.strokeStyle = pal.graphite;
    ctx.lineWidth = 2;
    // wire stub on the left (A -> box) and right (box -> B)
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(box.x, ay);
    ctx.moveTo(box.x + box.w, ay);
    ctx.lineTo(bx, ay);
    ctx.stroke();

    for (const [nx] of [[ax], [bx]]) {
      ctx.beginPath();
      ctx.arc(nx, ay, 13, 0, Math.PI * 2);
      ctx.fillStyle = pal.bone;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = pal.graphite;
      ctx.stroke();
    }
    ctx.restore();

    // Node labels below each node.
    drawText(ctx, 'label', 'in x', ax, ay + 26, {
      color: pal.boneDim, align: 'center', baseline: 'middle',
    });
    drawText(ctx, 'label', 'out', bx, ay + 26, {
      color: pal.boneDim, align: 'center', baseline: 'middle',
    });
  }

  function draw(e) {
    const { ctx, w, h } = e;
    ctx.clearRect(0, 0, w, h);
    layout(e);

    drawWire(ctx, e);
    drawFrame(ctx, e);

    if (e.reduced) {
      drawReduced(ctx, e);
      return;
    }

    drawAnimated(ctx, e);
  }

  // --- animated / interactive path -----------------------------------------
  function drawAnimated(ctx, e) {
    const p = easeInOutCubic(clamp(progress, 0, 1));

    // The single line that bends from straight (bone) to curve (phosphor).
    const color = bendColor(p);
    const width = lerp(2, 2.4, p);
    strokeCurve(ctx, bentFn(p), color, width, 1);

    // Focal headline ABOVE the box: morphs "w = 0.62" -> "f(x)".
    const headY = box.y - 18;
    if (p < 0.5) {
      // Scalar headline, fading as we cross.
      const a = 1 - p / 0.5;
      drawText(ctx, 'data', 'w = ' + WEIGHT.toFixed(2), box.cx, headY, {
        color: pal.bone, align: 'center', baseline: 'middle', size: 22, alpha: a,
      });
    }
    if (p >= 0.5) {
      const a = (p - 0.5) / 0.5;
      drawText(ctx, 'data', 'f(x)', box.cx, headY, {
        color: pal.phosphor, align: 'center', baseline: 'middle', size: 22, alpha: a,
      });
    }

    // State label below the box (text always carries the meaning).
    const stateLabel = p > 0.5 ? 'learnable function' : 'scalar weight';
    drawText(ctx, 'title', stateLabel, box.cx, box.y + box.h + 34, {
      color: p > 0.5 ? pal.phosphor : pal.bone, align: 'center', baseline: 'middle',
    });

    // Affordance hint inside the box on load (scalar, idle, not yet bent).
    if (!animating && progress === 0 && !isFunction) {
      drawText(ctx, 'label', 'tap to bend the line', box.cx, box.y + box.h - 14, {
        color: pal.phosphor, align: 'center', baseline: 'middle', size: 9.5, alpha: hovering ? 0.85 : 0.5,
      });
    }
  }

  // --- reduced-motion static frame ------------------------------------------
  // Both curves overlaid; the toggle decides which is full-alpha.
  function drawReduced(ctx, e) {
    const fnEmph = isFunction;

    // Bone straight line (the weight).
    strokeCurve(ctx, scalarFn, pal.bone, 2, fnEmph ? 0.3 : 1);
    // Phosphor learned curve (the KAN edge).
    strokeCurve(ctx, learnedFn, pal.phosphor, 2.4, fnEmph ? 1 : 0.3);

    // Headline shows the emphasised state.
    const headY = box.y - 18;
    drawText(ctx, 'data', fnEmph ? 'f(x)' : 'w = ' + WEIGHT.toFixed(2), box.cx, headY, {
      color: fnEmph ? pal.phosphor : pal.bone, align: 'center', baseline: 'middle', size: 22,
    });

    // Two labelled keys under the box, each adjacent to its curve's colour.
    const keyY = box.y + box.h + 30;
    drawText(ctx, 'label', 'weight: y=0.62x', box.cx, keyY, {
      color: pal.bone, align: 'center', baseline: 'middle', alpha: fnEmph ? 0.5 : 1,
    });
    drawText(ctx, 'label', 'KAN edge: y=f(x)', box.cx, keyY + 16, {
      color: pal.phosphor, align: 'center', baseline: 'middle', alpha: fnEmph ? 1 : 0.5,
    });
  }

  function update(dt) {
    if (!animating) return;
    const dir = isFunction ? 1 : -1;
    progress = clamp(progress + (dir * dt) / DUR, 0, 1);
    if ((dir > 0 && progress >= 1) || (dir < 0 && progress <= 0)) {
      animating = false;
      if (fig) fig.stop(); // transient settled — go still
    }
  }

  fig = createFigure({ canvas, update, draw, autoplay: false });
  const env = fig.env;

  function toggle() {
    isFunction = !isFunction;
    morphBtn.textContent = isFunction ? 'show scalar ◀' : 'bend the line ▶';
    morphBtn.setAttribute('aria-pressed', String(isFunction));
    if (env.reduced) {
      progress = isFunction ? 1 : 0;
      animating = false;
      fig.render(); // snap, no animation
    } else {
      animating = true;
      fig.play(); // run the transient bend; update() calls fig.stop() when settled
    }
  }

  // --- pointer: click inside the box (or near the wire) toggles -------------
  function pos(ev) {
    const rect = canvas.getBoundingClientRect();
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
  }
  function inBox(x, y) {
    return (
      x >= box.x - 6 && x <= box.x + box.w + 6 &&
      y >= box.y - 6 && y <= box.y + box.h + 6
    );
  }
  canvas.addEventListener('pointerdown', (ev) => {
    const p = pos(ev);
    if (inBox(p.x, p.y)) toggle();
  });
  canvas.addEventListener('pointermove', (ev) => {
    const p = pos(ev);
    const over = inBox(p.x, p.y);
    if (over !== hovering) {
      hovering = over;
      canvas.style.cursor = over ? 'pointer' : 'default';
      // Repaint the static hover ring/hint when the loop isn't running.
      if (!animating) fig.render();
    }
  });
  canvas.addEventListener('pointerleave', () => {
    if (hovering) {
      hovering = false;
      canvas.style.cursor = 'default';
      if (!animating) fig.render();
    }
  });
  canvas.style.cursor = 'pointer';

  // --- morph ctrl-btn -------------------------------------------------------
  const morphBtn = document.createElement('button');
  morphBtn.className = 'ctrl-btn';
  morphBtn.type = 'button';
  morphBtn.textContent = 'bend the line ▶';
  morphBtn.setAttribute('aria-pressed', 'false');
  morphBtn.addEventListener('click', toggle);
  controls.append(morphBtn);

  // Legend chip — the learned function colour + meaning.
  const chip = document.createElement('span');
  chip.className = 'ctrl-chip';
  chip.style.setProperty('--c', pal.phosphor);
  chip.textContent = 'learnable function on the edge';
  controls.append(chip);

  fig.start(); // paint the initial scalar plot (autoplay off; play() runs the bend)
  return fig;
}
