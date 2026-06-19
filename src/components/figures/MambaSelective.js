/* =====================================================================
   MambaSelective — chapter 2 (selective state space).

   The liquid idea "in hardware-friendly clothes." A stream of tokens flows
   through ONE recurrent state cell. At every step the input itself sets a
   gate: salient tokens are written into the state and persist; filler tokens
   are let through and decay. The selection is per-token and input-dependent.

   The contrast is the whole point, so it is a toggle, not a claim:
     - SELECTIVE: gate = f(token salience) -> a sparse, input-chosen memory.
     - FIXED:     gate = constant for every token -> a muddy state that cannot
                  tell signal from filler.

   Honest framing: the gate here is computed from a per-token salience value;
   it is illustrative of the selection MECHANISM, not a trained Mamba model.

   Motion is purposeful, not perpetual: a read head sweeps the sequence ONCE
   (via fig.play()) and stops. Reduced motion shows the fully resolved frame.
   ===================================================================== */

import { createFigure, palette, clamp, lerp, drawText } from '../lib/canvas.js';

// A hand-authored salience sequence: a few genuinely salient tokens (the
// "keep" set) amid filler. Values in [0,1]; > KEEP_THRESH reads as salient.
const TOKENS = [0.18, 0.9, 0.22, 0.14, 0.78, 0.2, 0.16, 0.85, 0.24, 0.12, 0.7, 0.19];
const KEEP_THRESH = 0.5;
const SWEEP = 2.6; // seconds for one left->right pass

export default function mount(stage) {
  const canvas = stage.querySelector('canvas');
  const controls = stage.querySelector('[data-controls]');
  const pal = palette();

  let selective = true;   // selective vs fixed gate
  let head = 0;           // read-head position in token-index space (0..N)
  let sweeping = false;
  let didSweep = false;

  // The gate the model applies to token i. Selective: salience-driven.
  // Fixed: the same middling gate for every token (no selection at all).
  function gateOf(i) {
    return selective ? clamp((TOKENS[i] - 0.1) / 0.85, 0, 1) : 0.5;
  }
  function isKept(i) {
    return selective && TOKENS[i] >= KEEP_THRESH;
  }

  function geom(e) {
    const padX = 18;
    const left = padX;
    const right = e.w - padX;
    const n = TOKENS.length;
    const slot = (right - left) / n;
    return {
      left, right, n, slot,
      trackY: e.h * 0.46,     // baseline of the token bars
      barMax: e.h * 0.24,     // tallest token bar
      stateY: e.h * 0.82,     // the memory lane
    };
  }
  const tokenX = (g, i) => g.left + g.slot * (i + 0.5);

  function draw(e) {
    const { ctx, w, h } = e;
    ctx.clearRect(0, 0, w, h);
    const g = geom(e);

    // --- title + mode (the load-bearing text) ---
    drawText(ctx, 'title', 'selective state space', 2, 16, { color: pal.bone, baseline: 'middle' });
    drawText(
      ctx, 'label',
      selective ? 'input decides what to keep' : 'fixed gate · every token treated alike',
      w - 2, 16,
      { color: selective ? pal.phosphor : pal.boneDim, align: 'right', baseline: 'middle' }
    );

    // How far the head has travelled (under reduced motion everything is resolved).
    const reached = e.reduced ? g.n : head;

    // --- the memory lane (state) underneath: latched keeps accumulate here ---
    ctx.save();
    ctx.strokeStyle = pal.graphite;
    ctx.lineWidth = 1;
    ctx.strokeRect(g.left, g.stateY - 9, g.right - g.left, 18);
    ctx.restore();
    drawText(ctx, 'label', 'state', g.left, g.stateY - 18, { color: pal.boneDim, baseline: 'alphabetic' });

    // --- tokens ---
    for (let i = 0; i < g.n; i++) {
      const x = tokenX(g, i);
      const sal = TOKENS[i];
      const passed = reached >= i + 0.5;
      const kept = isKept(i);
      const barH = 6 + sal * g.barMax;

      // token bar (height = salience). Bone outline; fill tints once decided.
      const top = g.trackY - barH;
      ctx.save();
      ctx.globalAlpha = passed ? 1 : 0.5;
      ctx.fillStyle = passed
        ? (kept ? pal.phosphor : pal.graphite)
        : pal.boneDim;
      ctx.fillRect(x - g.slot * 0.3, top, g.slot * 0.6, barH);
      ctx.restore();

      // keep / forget verdict, drawn once the head has passed
      if (passed) {
        if (selective) {
          drawText(ctx, 'label', kept ? 'keep' : 'forget', x, g.trackY + 14,
            { color: kept ? pal.phosphor : pal.boneDim, align: 'center', baseline: 'middle', size: 9 });
        }
        // latch kept tokens into the state lane (selective only)
        if (selective && kept) {
          ctx.save();
          ctx.fillStyle = pal.phosphor;
          ctx.fillRect(x - g.slot * 0.26, g.stateY - 7, g.slot * 0.52, 14);
          ctx.restore();
        }
        // fixed mode: every token writes a faint, equal smear -> a muddy state
        if (!selective) {
          ctx.save();
          ctx.globalAlpha = 0.32;
          ctx.fillStyle = pal.bone;
          ctx.fillRect(x - g.slot * 0.4, g.stateY - 7, g.slot * 0.8, 14);
          ctx.restore();
        }
      }
    }

    // --- read head: a vertical sweep line + its live gate readout ---
    if (!e.reduced && sweeping) {
      const hx = lerp(g.left, g.right, clamp(head / g.n, 0, 1));
      ctx.save();
      ctx.strokeStyle = pal.bone;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hx, g.trackY - g.barMax - 10);
      ctx.lineTo(hx, g.stateY + 12);
      ctx.stroke();
      ctx.restore();
      const i = clamp(Math.floor(head), 0, g.n - 1);
      drawText(ctx, 'data', 'gate ' + gateOf(i).toFixed(2), hx + 4, g.trackY - g.barMax - 4,
        { color: pal.boneDim, baseline: 'alphabetic', size: 10 });
    }

    // --- one-line takeaway of the resolved state ---
    if (reached >= g.n) {
      const keptN = TOKENS.filter((_, i) => isKept(i)).length;
      drawText(
        ctx, 'data',
        selective ? `kept ${keptN} of ${g.n} — a sparse, input-chosen memory`
                  : 'no selection — the state cannot tell signal from filler',
        w / 2, g.stateY + 22,
        { color: selective ? pal.phosphor : pal.boneDim, align: 'center', baseline: 'alphabetic', size: 10 }
      );
    }
  }

  function update(dt) {
    if (!sweeping) return;
    head += (dt / SWEEP) * TOKENS.length;
    if (head >= TOKENS.length) {
      head = TOKENS.length;
      sweeping = false;
      didSweep = true;
      fig.stop(); // transient done — release the loop (the figure is still)
      fig.render();
    }
  }

  const fig = createFigure({ canvas, update, draw, autoplay: false });
  const env = fig.env;

  // Run one purposeful left->right pass. Reduced motion resolves instantly.
  function runSweep() {
    if (env.reduced) {
      head = TOKENS.length;
      sweeping = false;
      fig.render();
      return;
    }
    head = 0;
    sweeping = true;
    fig.play();
  }

  // --- control: selective vs fixed gate (a segmented toggle) ---
  const seg = document.createElement('div');
  seg.className = 'ctrl-seg';
  seg.setAttribute('role', 'group');
  seg.setAttribute('aria-label', 'Gate mode');
  const bSel = document.createElement('button');
  bSel.type = 'button';
  bSel.textContent = 'selective';
  const bFix = document.createElement('button');
  bFix.type = 'button';
  bFix.textContent = 'fixed gate';
  function syncMode() {
    bSel.setAttribute('aria-pressed', String(selective));
    bFix.setAttribute('aria-pressed', String(!selective));
  }
  bSel.addEventListener('click', () => { if (!selective) { selective = true; syncMode(); runSweep(); } });
  bFix.addEventListener('click', () => { if (selective) { selective = false; syncMode(); runSweep(); } });
  syncMode();
  seg.append(bSel, bFix);
  controls.append(seg);

  // Legend chips (colour always paired with a word).
  const chipKeep = document.createElement('span');
  chipKeep.className = 'ctrl-chip';
  chipKeep.style.setProperty('--c', pal.phosphor);
  chipKeep.textContent = 'kept (written to state)';
  const chipDrop = document.createElement('span');
  chipDrop.className = 'ctrl-chip';
  chipDrop.style.setProperty('--c', pal.graphite);
  chipDrop.textContent = 'forgotten (decays)';
  controls.append(chipKeep, chipDrop);

  // Trigger the first sweep the first time the figure is actually on screen,
  // so the demonstration plays when the reader arrives (not while off-screen).
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting && !didSweep && !sweeping) runSweep();
    }
  }, { rootMargin: '0px 0px -20% 0px' });
  io.observe(canvas);

  fig.render(); // paint the initial (unswept) frame
  return fig;
}
