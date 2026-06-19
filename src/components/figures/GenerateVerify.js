/* =====================================================================
   GenerateVerify — chapter 5.2 (weak-to-strong / scalable oversight).

   The asymmetry between generation and verification:
     - GENERATE: a SLOW visible BFS from start to goal. Explored cells
       accumulate frame by frame — generation is HARD, takes real work —
       until a path is found and highlighted.
     - VERIFY: takes an already-proposed path and resolves in a SINGLE frame
       to VALID or INVALID — verification is CHEAP.
   This is the one figure that owns the --oversight VIOLET accent.
   Reduced motion: generate reveals the path immediately / steps on demand;
   verify stays instant. Everything is text-labeled, never color alone.
   ===================================================================== */

import { createFigure, palette, hexToRgb, rgba } from '../lib/canvas.js';

const COLS = 13;
const ROWS = 9;

export default function mount(stage) {
  const canvas = stage.querySelector('canvas');
  const controls = stage.querySelector('[data-controls]');
  const pal = palette();
  const ovRGB = hexToRgb(pal.oversight); // violet — oversight / verifier

  // grid[r][c] = true means wall. start top-left, goal bottom-right.
  let grid = [];
  const start = { r: 0, c: 0 };
  const goal = { r: ROWS - 1, c: COLS - 1 };

  // BFS animation state
  let frontier = [];       // queue of cells to expand
  let visited = new Set(); // "r,c" keys explored so far
  let cameFrom = new Map();// for path reconstruction
  let path = [];           // found path (array of {r,c})
  let searching = false;   // generation in progress
  let status = 'idle';     // 'idle' | 'generating' | 'found' | 'verify' | 'badverify'
  let verdict = null;      // 'VALID' | 'INVALID'
  let verdictT = 0;        // seconds remaining on the flash

  const key = (r, c) => `${r},${c}`;

  // Randomized-DFS maze carve over a cell grid, then ensure start/goal open.
  function carveMaze() {
    // start fully walled, carve passages on even coords
    const g = Array.from({ length: ROWS }, () => Array(COLS).fill(true));
    const stack = [{ r: 0, c: 0 }];
    g[0][0] = false;
    const dirs = [
      { dr: -2, dc: 0 },
      { dr: 2, dc: 0 },
      { dr: 0, dc: -2 },
      { dr: 0, dc: 2 },
    ];
    while (stack.length) {
      const cur = stack[stack.length - 1];
      const opts = [];
      for (const d of dirs) {
        const nr = cur.r + d.dr;
        const nc = cur.c + d.dc;
        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && g[nr][nc]) {
          opts.push({ nr, nc, mr: cur.r + d.dr / 2, mc: cur.c + d.dc / 2 });
        }
      }
      if (opts.length) {
        const o = opts[(Math.random() * opts.length) | 0];
        g[o.mr][o.mc] = false; // knock down wall between
        g[o.nr][o.nc] = false;
        stack.push({ r: o.nr, c: o.nc });
      } else {
        stack.pop();
      }
    }
    // open a few extra passages so multiple routes exist (less corridor-y)
    for (let i = 0; i < 8; i++) {
      const r = 1 + ((Math.random() * (ROWS - 2)) | 0);
      const c = 1 + ((Math.random() * (COLS - 2)) | 0);
      g[r][c] = false;
    }
    g[start.r][start.c] = false;
    g[goal.r][goal.c] = false;
    return g;
  }

  function resetSearch() {
    frontier = [{ r: start.r, c: start.c }];
    visited = new Set([key(start.r, start.c)]);
    cameFrom = new Map();
    path = [];
    verdict = null;
    verdictT = 0;
  }

  function newMaze() {
    grid = carveMaze();
    searching = false;
    status = 'idle';
    resetSearch();
  }

  // Expand `n` BFS steps. Returns true when the goal is reached.
  function stepSearch(n) {
    for (let i = 0; i < n; i++) {
      if (!frontier.length) {
        searching = false;
        return false;
      }
      const cur = frontier.shift();
      if (cur.r === goal.r && cur.c === goal.c) {
        reconstruct(cur);
        searching = false;
        status = 'found';
        return true;
      }
      const neigh = [
        { r: cur.r - 1, c: cur.c },
        { r: cur.r + 1, c: cur.c },
        { r: cur.r, c: cur.c - 1 },
        { r: cur.r, c: cur.c + 1 },
      ];
      for (const nb of neigh) {
        if (nb.r < 0 || nb.r >= ROWS || nb.c < 0 || nb.c >= COLS) continue;
        if (grid[nb.r][nb.c]) continue; // wall
        const k = key(nb.r, nb.c);
        if (visited.has(k)) continue;
        visited.add(k);
        cameFrom.set(k, key(cur.r, cur.c));
        frontier.push(nb);
      }
    }
    return false;
  }

  function reconstruct(end) {
    const out = [];
    let k = key(end.r, end.c);
    while (k) {
      const [r, c] = k.split(',').map(Number);
      out.push({ r, c });
      k = cameFrom.get(k);
    }
    out.reverse();
    path = out;
  }

  // Verify a proposed path: contiguous, wall-free, connects start to goal.
  // This is the CHEAP operation — a single linear pass, one frame.
  function verifyPath(proposed) {
    if (!proposed || proposed.length === 0) return false;
    const first = proposed[0];
    const last = proposed[proposed.length - 1];
    if (first.r !== start.r || first.c !== start.c) return false;
    if (last.r !== goal.r || last.c !== goal.c) return false;
    for (let i = 0; i < proposed.length; i++) {
      const p = proposed[i];
      if (grid[p.r][p.c]) return false; // steps through a wall
      if (i > 0) {
        const q = proposed[i - 1];
        const md = Math.abs(p.r - q.r) + Math.abs(p.c - q.c);
        if (md !== 1) return false; // not adjacent
      }
    }
    return true;
  }

  // --- layout / drawing ---
  function cellGeom(e) {
    const pad = 14;
    const topReserve = 26; // room for the status line
    const gw = e.w - pad * 2;
    const gh = e.h - pad * 2 - topReserve;
    const cs = Math.min(gw / COLS, gh / ROWS);
    const ox = pad + (gw - cs * COLS) / 2;
    const oy = pad + topReserve + (gh - cs * ROWS) / 2;
    return { cs, ox, oy };
  }

  function draw(e) {
    const { ctx, w, h } = e;
    ctx.clearRect(0, 0, w, h);
    const { cs, ox, oy } = cellGeom(e);

    // cells
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = ox + c * cs;
        const y = oy + r * cs;
        if (grid[r][c]) {
          ctx.fillStyle = pal.graphite; // wall
        } else if (visited.has(key(r, c))) {
          ctx.fillStyle = rgba(ovRGB, 0.22); // explored — generation cost
        } else {
          ctx.fillStyle = rgba(hexToRgb(pal.bone), 0.05); // open
        }
        ctx.fillRect(x + 1, y + 1, cs - 2, cs - 2);
      }
    }

    // frontier outline — the active edge of the slow search
    if (searching) {
      ctx.strokeStyle = rgba(ovRGB, 0.6);
      ctx.lineWidth = 1.5;
      for (const f of frontier) {
        ctx.strokeRect(ox + f.c * cs + 1, oy + f.r * cs + 1, cs - 2, cs - 2);
      }
    }

    // found / proposed path
    if (path.length) {
      const valid = verdict === 'VALID';
      const invalid = verdict === 'INVALID';
      let pathColor = pal.oversight;
      if (invalid) pathColor = pal.synapse; // warm = the bad guess
      ctx.strokeStyle = pathColor;
      ctx.lineWidth = Math.max(2, cs * 0.22);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let i = 0; i < path.length; i++) {
        const cx = ox + path[i].c * cs + cs / 2;
        const cy = oy + path[i].r * cs + cs / 2;
        if (i === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    }

    // start / goal markers
    markCell(ctx, ox, oy, cs, start, pal.phosphor, 'S');
    markCell(ctx, ox, oy, cs, goal, pal.oversight, 'G');

    // --- status line (monospace, top) ---
    ctx.font = '12px "Spline Sans Mono", monospace';
    ctx.textAlign = 'left';
    let txt = '';
    if (status === 'generating') {
      ctx.fillStyle = pal.oversight;
      const dots = '.'.repeat(1 + (Math.floor(e.t * 3) % 3));
      txt = `generating${dots} (hard · ${visited.size} cells explored)`;
    } else if (status === 'found') {
      ctx.fillStyle = pal.oversight;
      txt = `path generated — ${path.length} steps (hard work done)`;
    } else if (status === 'verify' || status === 'badverify') {
      ctx.fillStyle = verdict === 'VALID' ? pal.phosphor : pal.synapse;
      txt = `verified (cheap · one pass) → ${verdict}`;
    } else {
      ctx.fillStyle = pal.bone;
      txt = 'oversight: generation is hard · verification is cheap';
    }
    ctx.fillText(txt, 14, 18);

    // verdict flash badge
    if (verdict && verdictT > 0) {
      const big = verdict === 'VALID';
      ctx.font = 'bold 20px "Spline Sans Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillStyle = big ? pal.phosphor : pal.synapse;
      ctx.globalAlpha = Math.min(1, verdictT / 0.4);
      ctx.fillText(big ? '✓ VALID' : '✕ INVALID', w - 14, 20);
      ctx.globalAlpha = 1;
    }
  }

  function markCell(ctx, ox, oy, cs, cell, color, ch) {
    const cx = ox + cell.c * cs + cs / 2;
    const cy = oy + cell.r * cs + cs / 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, cs * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal.ink;
    ctx.font = `bold ${Math.round(cs * 0.4)}px "Spline Sans Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ch, cx, cy + 1);
    ctx.textBaseline = 'alphabetic';
  }

  // generation animates over many frames; verdict flash decays.
  function update(dt) {
    if (searching) {
      // slow: only a couple of expansions per frame so the cost is visible
      stepSearch(2);
    }
    if (verdictT > 0) {
      verdictT -= dt;
      if (verdictT <= 0) verdictT = 0;
    }
  }

  newMaze();
  // autoplay default: the rAF loop is available so generate() can animate the
  // slow BFS and the verdict flash can fade. update() is a no-op while idle, so
  // the running loop is cheap; it auto-pauses offscreen and under reduced motion
  // start() paints a single static frame (we drive the search manually there).
  const fig = createFigure({ canvas, update, draw });
  const env = fig.env;

  // Build a deliberately broken path for the INVALID demo: take the found path
  // (or start→goal stub) and splice a jump so it's no longer contiguous.
  function badGuess() {
    const base = path.length ? path.slice() : [{ r: start.r, c: start.c }, { r: goal.r, c: goal.c }];
    const broken = base.slice(0, Math.max(1, Math.floor(base.length / 2)));
    broken.push({ r: goal.r, c: goal.c }); // teleport to goal — not adjacent
    return broken;
  }

  // --- controls ---
  // generate: start the slow visible search (or reveal/step under reduced motion)
  const genBtn = document.createElement('button');
  genBtn.className = 'ctrl-btn';
  genBtn.type = 'button';
  genBtn.textContent = 'generate ⏵';
  genBtn.addEventListener('click', () => {
    resetSearch();
    status = 'generating';
    verdict = null;
    if (env.reduced) {
      // reduced motion: do the whole search at once, reveal path immediately
      let done = false;
      for (let i = 0; i < COLS * ROWS * 4 && !done; i++) done = stepSearch(8);
      searching = false;
      fig.render();
    } else {
      searching = true;
      fig.start();
    }
  });
  controls.append(genBtn);

  // reduced-motion step affordance: advance the search ~8 cells per press
  if (env.reduced) {
    const stepBtn = document.createElement('button');
    stepBtn.className = 'ctrl-btn';
    stepBtn.type = 'button';
    stepBtn.textContent = 'step ⏵';
    stepBtn.addEventListener('click', () => {
      if (status !== 'found') {
        status = 'generating';
        stepSearch(8);
      }
      fig.render();
    });
    controls.append(stepBtn);
  }

  // verify: instant single-frame check of the generated path → VALID
  const verBtn = document.createElement('button');
  verBtn.className = 'ctrl-btn';
  verBtn.type = 'button';
  verBtn.textContent = 'verify';
  verBtn.addEventListener('click', () => {
    if (!path.length) {
      // nothing generated yet — verifying an empty proposal is trivially false
      verdict = 'INVALID';
    } else {
      verdict = verifyPath(path) ? 'VALID' : 'INVALID';
    }
    status = 'verify';
    verdictT = 1.0;
    fig.render();
    if (!env.reduced) fig.start(); // let the flash fade
  });
  controls.append(verBtn);

  // verify a bad guess: instantly flash INVALID on a deliberately broken path
  const badBtn = document.createElement('button');
  badBtn.className = 'ctrl-btn';
  badBtn.type = 'button';
  badBtn.textContent = 'verify a bad guess';
  badBtn.addEventListener('click', () => {
    const guess = badGuess();
    path = guess; // show the broken proposal
    verdict = verifyPath(guess) ? 'VALID' : 'INVALID';
    status = 'badverify';
    verdictT = 1.0;
    fig.render();
    if (!env.reduced) fig.start();
  });
  controls.append(badBtn);

  // new maze: regenerate walls
  const mazeBtn = document.createElement('button');
  mazeBtn.className = 'ctrl-btn';
  mazeBtn.type = 'button';
  mazeBtn.textContent = 'new maze';
  mazeBtn.addEventListener('click', () => {
    newMaze();
    fig.render();
  });
  controls.append(mazeBtn);

  // legend chips — text paired with the violet oversight accent
  const legend = document.createElement('div');
  const chipG = document.createElement('span');
  chipG.className = 'ctrl-chip';
  chipG.style.setProperty('--c', pal.oversight);
  chipG.textContent = 'explored / oversight (violet)';
  const chipV = document.createElement('span');
  chipV.className = 'ctrl-chip';
  chipV.style.setProperty('--c', pal.phosphor);
  chipV.textContent = 'valid';
  const chipB = document.createElement('span');
  chipB.className = 'ctrl-chip';
  chipB.style.setProperty('--c', pal.synapse);
  chipB.textContent = 'invalid';
  legend.append(chipG, chipV, chipB);
  controls.append(legend);

  fig.render();
  return fig;
}
