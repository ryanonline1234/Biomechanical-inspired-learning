/* =====================================================================
   PhaseFlow — chapter 1 (Neural ODE vs discrete ResNet).

   A particle drifts through a 2D vector field (phase space).
   - discrete (ResNet): fixed equal steps, h -> h + f(h). Hollow SQUARE
     markers at a constant cadence — the same work everywhere.
   - continuous (ODE): a smooth integrated curve whose round step markers
     CLUSTER where the field is stiff. The adaptive solver spends steps where
     the dynamics are hard — adaptive computation, for free.

   A faint heat field shows WHERE the flow is stiff, so the clustering has a
   visible cause. A live readout reports how many steps each mode used. Drag
   the start point to launch a new trajectory.
   ===================================================================== */

import { createFigure, palette, clamp, hexToRgb, rgba } from '../lib/canvas.js';

// The vector field. A swirl plus a localized "stiff" band along y=0 where the
// flow turns sharply — that band is where the adaptive solver clusters steps.
function field(x, y) {
  const swirl = 1.1;
  let fx = swirl * -y + 0.6 * Math.sin(1.5 * y);
  let fy = swirl * x - 0.3 * x * x;
  const band = Math.exp(-(y * y) / 0.12); // sharp ridge at y=0
  fx += -1.8 * band * x;
  fy += 1.4 * band;
  return [fx, fy];
}

// Approximate local stiffness via a finite-difference Jacobian norm.
function fieldStiffness(x, y) {
  const e = 0.04;
  const [fx, fy] = field(x, y);
  const [fxx, fxy] = field(x + e, y);
  const [fyx, fyy] = field(x, y + e);
  const dfdx = Math.hypot(fxx - fx, fxy - fy) / e;
  const dfdy = Math.hypot(fyx - fx, fyy - fy) / e;
  return Math.hypot(dfdx, dfdy);
}

export default function mount(stage) {
  const canvas = stage.querySelector('canvas');
  const controls = stage.querySelector('[data-controls]');
  const pal = palette();
  const phoRGB = hexToRgb(pal.phosphor);
  const synRGB = hexToRgb(pal.synapse);
  const boneRGB = hexToRgb(pal.bone);

  const F_MONO = '11px "Spline Sans Mono", monospace';
  const F_MONO_SM = '10px "Spline Sans Mono", monospace';

  let mode = 'continuous'; // 'discrete' | 'continuous'
  let start = { x: -1.7, y: -1.2 };
  let path = [];
  const domain = { minX: -2.4, maxX: 2.4, minY: -2.4, maxY: 2.4 };

  function toScreen(e, x, y) {
    const px = ((x - domain.minX) / (domain.maxX - domain.minX)) * e.w;
    const py = e.h - ((y - domain.minY) / (domain.maxY - domain.minY)) * e.h;
    return [px, py];
  }
  function toDomain(e, px, py) {
    const x = domain.minX + (px / e.w) * (domain.maxX - domain.minX);
    const y = domain.minY + (1 - py / e.h) * (domain.maxY - domain.minY);
    return { x, y };
  }

  function computePath() {
    path = [];
    let x = start.x;
    let y = start.y;
    if (mode === 'discrete') {
      // fixed Euler step — the ResNet: h -> h + f(h), constant h everywhere
      const h = 0.16;
      for (let i = 0; i < 64; i++) {
        const [fx, fy] = field(x, y);
        path.push({ x, y });
        x += h * fx;
        y += h * fy;
        if (Math.abs(x) > 2.7 || Math.abs(y) > 2.7) break;
      }
    } else {
      // adaptive ODE: step size shrinks where stiffness is high; midpoint
      // integration for a smooth curve. A marker is placed at each accepted
      // step, so markers pile up in the stiff band.
      let arc = 0;
      for (let i = 0; i < 800; i++) {
        const stiff = fieldStiffness(x, y);
        const h = clamp(0.13 / (0.4 + stiff * 0.9), 0.012, 0.18);
        const [fx, fy] = field(x, y);
        const [fmx, fmy] = field(x + 0.5 * h * fx, y + 0.5 * h * fy);
        path.push({ x, y });
        x += h * fmx;
        y += h * fmy;
        arc += h;
        if (Math.abs(x) > 2.7 || Math.abs(y) > 2.7 || arc > 9) break;
      }
    }
  }

  // --- the stiffness heat field: faint phosphor where the flow is stiff ----
  function drawStiffness(e) {
    const { ctx } = e;
    const step = 0.16;
    const SMAX = 7; // normalisation ceiling for the heat alpha
    ctx.save();
    const cw = (step / (domain.maxX - domain.minX)) * e.w + 1;
    const ch = (step / (domain.maxY - domain.minY)) * e.h + 1;
    for (let gx = domain.minX; gx <= domain.maxX; gx += step) {
      for (let gy = domain.minY; gy <= domain.maxY; gy += step) {
        const s = fieldStiffness(gx, gy);
        const a = clamp(s / SMAX, 0, 1);
        if (a < 0.04) continue;
        const [sx, sy] = toScreen(e, gx, gy);
        ctx.fillStyle = rgba(phoRGB, a * 0.16);
        ctx.fillRect(sx - cw / 2, sy - ch / 2, cw, ch);
      }
    }
    ctx.restore();
  }

  // --- the flow field: arrow length + opacity encode local speed -----------
  function drawField(e) {
    const { ctx } = e;
    ctx.save();
    ctx.lineWidth = 1;
    const step = 0.4;
    for (let gx = domain.minX + step / 2; gx < domain.maxX; gx += step) {
      for (let gy = domain.minY + step / 2; gy < domain.maxY; gy += step) {
        const [fx, fy] = field(gx, gy);
        const mag = Math.hypot(fx, fy) || 1e-6;
        const ux = fx / mag;
        const uy = fy / mag;
        const len = clamp(mag * 0.06, 0.04, 0.18); // longer where flow is fast
        const a = clamp(0.25 + mag * 0.06, 0.25, 0.7);
        const [ax, ay] = toScreen(e, gx, gy);
        const [bx, by] = toScreen(e, gx + ux * len, gy + uy * len);
        ctx.strokeStyle = rgba(boneRGB, a * 0.5);
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
        ctx.fillStyle = rgba(boneRGB, a * 0.55);
        ctx.beginPath();
        ctx.arc(bx, by, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  let travel = 0;

  function draw(e) {
    const { ctx, w, h } = e;
    ctx.clearRect(0, 0, w, h);
    drawStiffness(e);
    drawField(e);
    if (!path.length) return;

    // --- the trajectory line ---
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = pal.phosphor;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < path.length; i++) {
      const [sx, sy] = toScreen(e, path[i].x, path[i].y);
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();
    ctx.restore();

    // --- step markers: SQUARE (fixed) for discrete, DOT (adaptive) for ODE,
    //     so the cadence reads without relying on color. -------------------
    ctx.save();
    if (mode === 'discrete') {
      ctx.strokeStyle = pal.phosphor;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < path.length; i++) {
        const [sx, sy] = toScreen(e, path[i].x, path[i].y);
        ctx.strokeRect(sx - 3, sy - 3, 6, 6);
      }
    } else {
      ctx.fillStyle = pal.phosphor;
      for (let i = 0; i < path.length; i++) {
        const [sx, sy] = toScreen(e, path[i].x, path[i].y);
        ctx.beginPath();
        ctx.arc(sx, sy, 1.9, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // --- the traveling particle (slows naturally through stiff zones) ------
    const idx = Math.floor(travel) % path.length;
    const p = path[idx];
    const [px, py] = toScreen(e, p.x, p.y);
    ctx.save();
    ctx.shadowColor = pal.phosphor;
    ctx.shadowBlur = 10;
    ctx.fillStyle = pal.bone;
    ctx.beginPath();
    ctx.arc(px, py, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // --- the draggable start handle ---
    const [hx, hy] = toScreen(e, start.x, start.y);
    ctx.save();
    ctx.strokeStyle = pal.synapse;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(hx, hy, 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = rgba(synRGB, 0.9);
    ctx.font = F_MONO_SM;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('drag', hx + 11, hy);
    ctx.restore();

    // --- HUD: mode, step count, and the legend that names each marker ------
    ctx.save();
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.font = F_MONO;
    ctx.fillStyle = rgba(boneRGB, 0.85);
    const cadence = mode === 'discrete' ? 'fixed cadence' : 'adaptive cadence';
    ctx.fillText(`steps: ${path.length}  ·  ${cadence}`, 12, 12);

    ctx.font = F_MONO_SM;
    ctx.fillStyle = rgba(boneRGB, 0.6);
    if (mode === 'discrete') {
      ctx.fillText('□ same work everywhere', 12, 30);
    } else {
      ctx.fillText('● steps cluster in the stiff band', 12, 30);
    }

    // stiff-region legend, bottom-left, clear of the controls bar on the right
    ctx.textAlign = 'right';
    ctx.fillStyle = rgba(phoRGB, 0.7);
    ctx.fillText('teal = stiff region', w - 12, 12);
    ctx.restore();
  }

  function update(dt) {
    travel += dt * 16; // steps/sec along the path
    if (travel >= path.length) travel = 0;
  }

  computePath();
  const fig = createFigure({ canvas, update, draw });
  const env = fig.env;

  // --- drag the start point ------------------------------------------------
  let dragging = false;
  function pos(ev) {
    const rect = canvas.getBoundingClientRect();
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
  }
  function setStart(ev) {
    const p = pos(ev);
    start = toDomain(env, p.x, p.y);
    computePath();
    if (env.reduced) fig.render();
  }
  canvas.addEventListener('pointerdown', (ev) => {
    dragging = true;
    travel = 0;
    setStart(ev);
    canvas.setPointerCapture?.(ev.pointerId);
  });
  canvas.addEventListener('pointermove', (ev) => {
    if (dragging) setStart(ev);
  });
  window.addEventListener('pointerup', () => (dragging = false));
  canvas.style.cursor = 'grab';

  // --- mode toggle (segmented) ---------------------------------------------
  const seg = document.createElement('div');
  seg.className = 'ctrl-seg';
  seg.setAttribute('role', 'group');
  seg.setAttribute('aria-label', 'Integration mode');
  const modes = [
    ['discrete', 'discrete (ResNet)'],
    ['continuous', 'continuous (ODE)'],
  ];
  const btns = modes.map(([m, lbl]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = lbl;
    b.setAttribute('aria-pressed', String(m === mode));
    b.addEventListener('click', () => {
      mode = m;
      btns.forEach((bb, k) => bb.setAttribute('aria-pressed', String(modes[k][0] === mode)));
      computePath();
      travel = 0;
      fig.render();
    });
    seg.append(b);
    return b;
  });
  controls.append(seg);

  // reduced motion: step the traveler manually
  if (env.reduced) {
    const stepBtn = document.createElement('button');
    stepBtn.className = 'ctrl-btn';
    stepBtn.type = 'button';
    stepBtn.textContent = 'step ⏵';
    stepBtn.addEventListener('click', () => {
      travel = (travel + 4) % path.length;
      fig.render();
    });
    controls.append(stepBtn);
  }

  fig.start();
  return fig;
}
