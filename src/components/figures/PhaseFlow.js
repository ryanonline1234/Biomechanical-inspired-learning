/* =====================================================================
   PhaseFlow — chapter 1 (Neural ODE vs discrete ResNet).

   A particle drifts through a 2D vector field (phase space).
   - discrete (ResNet): fixed equal stair-step jumps, h -> h + f(h)
   - continuous (ODE): a smooth integrated curve whose step markers CLUSTER
     where the field is stiff (the adaptive solver spends steps where needed)
   Drag the start point to launch a new trajectory.
   ===================================================================== */

import { createFigure, palette, clamp, hexToRgb } from '../lib/canvas.js';

// The vector field. A swirl plus a localized "stiff" band where the flow
// turns sharply — that band is where the adaptive solver clusters its steps.
function field(x, y) {
  // x,y in domain coords roughly [-2.4, 2.4]
  const swirl = 1.1;
  let fx = swirl * (-y) + 0.6 * Math.sin(1.5 * y);
  let fy = swirl * x - 0.6 * x * x * 0.5;
  // a stiff region near the origin band: sharpen the turn
  const band = Math.exp(-((y) * (y)) / 0.12);
  fx += -1.8 * band * x;
  fy += 1.4 * band;
  return [fx, fy];
}

function fieldStiffness(x, y) {
  // approximate local stiffness via finite-difference Jacobian norm
  const e = 0.04;
  const [fx, fy] = field(x, y);
  const [fxx] = field(x + e, y);
  const [, fyy] = field(x, y + e);
  const [fx2] = field(x, y + e);
  const [, fy2] = field(x + e, y);
  const dfx = Math.abs(fxx - fx) / e + Math.abs(fx2 - fx) / e;
  const dfy = Math.abs(fyy - fy) / e + Math.abs(fy2 - fy) / e;
  return Math.hypot(dfx, dfy);
}

export default function mount(stage) {
  const canvas = stage.querySelector('canvas');
  const controls = stage.querySelector('[data-controls]');
  const pal = palette();
  const phoRGB = hexToRgb(pal.phosphor);

  let mode = 'continuous'; // 'discrete' | 'continuous'
  let start = { x: -1.7, y: -1.2 };
  let path = []; // array of {x,y, marker}
  let domain = { minX: -2.4, maxX: 2.4, minY: -2.4, maxY: 2.4 };

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
      // fixed Euler step — the ResNet: h -> h + f(h), constant h
      const h = 0.16;
      for (let i = 0; i < 60; i++) {
        const [fx, fy] = field(x, y);
        const nx = x + h * fx;
        const ny = y + h * fy;
        path.push({ x, y, marker: true, nx, ny });
        x = nx;
        y = ny;
        if (Math.abs(x) > 2.6 || Math.abs(y) > 2.6) break;
      }
    } else {
      // adaptive ODE: step size shrinks where stiffness is high; midpoint
      // integration for a smooth curve. Markers placed at each accepted step.
      let arc = 0;
      for (let i = 0; i < 600; i++) {
        const stiff = fieldStiffness(x, y);
        const h = clamp(0.13 / (0.4 + stiff * 0.9), 0.012, 0.18);
        const [fx, fy] = field(x, y);
        const mx = x + 0.5 * h * fx;
        const my = y + 0.5 * h * fy;
        const [fmx, fmy] = field(mx, my);
        const nx = x + h * fmx;
        const ny = y + h * fmy;
        path.push({ x, y, marker: true });
        x = nx;
        y = ny;
        arc += h;
        if (Math.abs(x) > 2.6 || Math.abs(y) > 2.6 || arc > 9) break;
      }
    }
  }

  function drawField(e) {
    const { ctx } = e;
    ctx.save();
    ctx.strokeStyle = pal.graphite;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1;
    const step = 0.42;
    for (let gx = domain.minX; gx <= domain.maxX; gx += step) {
      for (let gy = domain.minY; gy <= domain.maxY; gy += step) {
        const [fx, fy] = field(gx, gy);
        const mag = Math.hypot(fx, fy) || 1;
        const len = 0.18;
        const ux = (fx / mag) * len;
        const uy = (fy / mag) * len;
        const [ax, ay] = toScreen(e, gx, gy);
        const [bx, by] = toScreen(e, gx + ux, gy + uy);
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
        // small arrowhead dot at the tip
        ctx.fillStyle = pal.graphite;
        ctx.beginPath();
        ctx.arc(bx, by, 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // traveling highlight position along the path
  let travel = 0;

  function draw(e) {
    const { ctx, w, h } = e;
    ctx.clearRect(0, 0, w, h);
    drawField(e);

    if (!path.length) return;

    // the trajectory
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = pal.phosphor;

    if (mode === 'discrete') {
      // stair-steps: straight segment per fixed Euler step
      ctx.beginPath();
      for (let i = 0; i < path.length; i++) {
        const p = path[i];
        const [sx, sy] = toScreen(e, p.x, p.y);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
      // step markers (equal spacing in "depth")
      for (let i = 0; i < path.length; i++) {
        const [sx, sy] = toScreen(e, path[i].x, path[i].y);
        ctx.fillStyle = pal.phosphor;
        ctx.beginPath();
        ctx.arc(sx, sy, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // smooth curve through the adaptive samples
      ctx.beginPath();
      for (let i = 0; i < path.length; i++) {
        const [sx, sy] = toScreen(e, path[i].x, path[i].y);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
      // markers cluster where steps are small (stiff regions)
      for (let i = 0; i < path.length; i += 1) {
        const [sx, sy] = toScreen(e, path[i].x, path[i].y);
        ctx.fillStyle = pal.phosphor;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(sx, sy, 1.7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // traveling particle
    const idx = Math.floor(travel) % path.length;
    const p = path[idx];
    const [sx, sy] = toScreen(e, p.x, p.y);
    ctx.fillStyle = pal.bone;
    ctx.beginPath();
    ctx.arc(sx, sy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = pal.synapse;
    ctx.lineWidth = 2;
    ctx.stroke();

    // start handle
    const [hx, hy] = toScreen(e, start.x, start.y);
    ctx.strokeStyle = pal.synapse;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(hx, hy, 7, 0, Math.PI * 2);
    ctx.stroke();
  }

  function update(dt, e) {
    travel += dt * 18; // steps per second along the path
    if (travel >= path.length) travel = 0;
  }

  computePath();
  const fig = createFigure({ canvas, update, draw });
  const env = fig.env;

  // --- drag the start point ---
  let dragging = false;
  function pos(ev) {
    const rect = canvas.getBoundingClientRect();
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
  }
  canvas.addEventListener('pointerdown', (ev) => {
    dragging = true;
    const p = pos(ev);
    start = toDomain(env, p.x, p.y);
    computePath();
    travel = 0;
    if (env.reduced) fig.render();
    canvas.setPointerCapture?.(ev.pointerId);
  });
  canvas.addEventListener('pointermove', (ev) => {
    if (!dragging) return;
    const p = pos(ev);
    start = toDomain(env, p.x, p.y);
    computePath();
    if (env.reduced) fig.render();
  });
  window.addEventListener('pointerup', () => (dragging = false));
  canvas.style.cursor = 'grab';

  // --- mode toggle (segmented) ---
  const seg = document.createElement('div');
  seg.className = 'ctrl-seg';
  seg.setAttribute('role', 'group');
  seg.setAttribute('aria-label', 'Integration mode');
  const modes = [
    ['discrete', 'discrete (ResNet)'],
    ['continuous', 'continuous (ODE)'],
  ];
  const btns = modes.map(([m, label]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
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

  // reduced motion: step button to advance the traveler
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
