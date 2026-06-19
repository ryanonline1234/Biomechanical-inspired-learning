/* =====================================================================
   NeuromodPlasticity — chapter 3 (adaptive learning rules,
   the still-losing BIOLOGICAL thread).

   A small network: 3 inputs -> 4 hidden -> 2 outputs, fully connected.
   The MAJORITY of edges stay graphite/fixed in BOTH contexts. A small,
   hand-authored, disjoint subset (~3 edges) is the only thing made
   PLASTIC at a time. A network-generated gating signal — drawn as an
   explicit "neuromod" source node — chooses WHICH edges those are by
   sending thin amber leader lines to exactly that subset.

   Switching context MOVES the small plastic set to a disjoint subset
   elsewhere (it does not invert the graph). The gate decides WHERE
   plasticity is allowed; it does not, by itself, change a weight.

   Growth needs correlation, not just the gate. On a shared "beat" both
   endpoints of a gated edge flash together and that edge steps thicker
   — fire together, wire together. One gated edge is wired to an
   ANTI-correlated pair: it never fires in sync, so it stays thin. That
   is the counter-example: gated but uncorrelated does not grow.

   The whole update is local and forward — there is NO backward pass.

   Color is meaning, never colour alone: amber = plastic/biological,
   graphite = fixed. Every state is also spelled out in words.
   ===================================================================== */

import { createFigure, palette, clamp, lerp, hexToRgb, rgba, drawText } from '../lib/canvas.js';

// Layer sizes: 3 inputs -> 4 hidden -> 2 outputs.
const LAYERS = [3, 4, 2];

export default function mount(stage) {
  const canvas = stage.querySelector('canvas');
  const controls = stage.querySelector('[data-controls]');
  const pal = palette();
  const synRGB = hexToRgb(pal.synapse);
  const boneRGB = hexToRgb(pal.bone);

  let neuromod = true; // gating signal on/off
  let context = 'A'; // 'A' | 'B'

  // ---- nodes -------------------------------------------------------------
  // Node ids are stable: layer L, index i. Positions assigned per-draw.
  const nodes = [];
  LAYERS.forEach((count, layer) => {
    for (let i = 0; i < count; i++) nodes.push({ layer, i, count });
  });
  const nid = (layer, i) => nodes.findIndex((n) => n.layer === layer && n.i === i);

  // ---- edges (fully connected between consecutive layers) ----------------
  const edges = [];
  for (let L = 0; L < LAYERS.length - 1; L++) {
    for (let a = 0; a < LAYERS[L]; a++) {
      for (let b = 0; b < LAYERS[L + 1]; b++) {
        edges.push({
          id: `${L}:${a}-${b}`,
          from: nid(L, a),
          to: nid(L + 1, b),
          width: 1, // rendered thickness; steps up on a correlated beat
        });
      }
    }
  }
  const edgeById = (id) => edges.find((e) => e.id === id);
  const BASE_W = 1;
  const MAX_W = 5.5;
  const STEP_W = 1.1; // thickness gained per correlated beat

  // ---- hand-authored sparse, disjoint plastic subsets --------------------
  // The gate selects ~3 edges per context. They are DISJOINT across A and B,
  // and a small minority of the 18 total edges — the rest stay fixed in both.
  //   - context A gates an upper cluster (input 0 fan into hidden 0/1).
  //   - context B gates a lower cluster (input 2 fan into hidden 2/3).
  // In each context, one gated edge is the ANTI-CORRELATED counter-example:
  // gated but its endpoints never co-fire, so it never thickens.
  const GATED = {
    A: [
      { id: '0:0-0', corr: true },
      { id: '0:0-1', corr: true },
      { id: '1:0-0', corr: false }, // gated but uncorrelated -> stays thin
    ],
    B: [
      { id: '0:2-2', corr: true },
      { id: '0:2-3', corr: true },
      { id: '1:3-1', corr: false }, // gated but uncorrelated -> stays thin
    ],
  };
  // Fast lookup: edge id -> { corr } for the active context (empty when off).
  function gatedMap() {
    const m = new Map();
    if (!neuromod) return m;
    for (const g of GATED[context]) m.set(g.id, g);
    return m;
  }

  // ---- the shared "beat" -------------------------------------------------
  // beatClock counts seconds; beatPhase = fractional part in [0,1). Endpoints
  // of a correlated gated edge flash together at the top of each beat (phase
  // near 0); on that instant the edge steps one notch thicker.
  let beatClock = 0;
  let beatPhase = 0; // derived: beatClock % BEAT_PERIOD / BEAT_PERIOD
  let lastBeatIndex = 0;
  const BEAT_PERIOD = 1.4; // seconds per co-firing beat

  // ---- context slide transient ------------------------------------------
  // 0 = fully on the previous context's subset, 1 = fully on the new one.
  // The leader lines lerp from old targets to new targets over the slide.
  let prevContext = 'A';
  let slide = 1; // resolved
  const SLIDE = 0.5; // seconds

  let fig; // assigned after createFigure so update() can call fig.stop()

  // ---- layout ------------------------------------------------------------
  // Reserve the top strip for the title row; the neuromod source sits at
  // top-center as a diamond just below it.
  const TOP = 38; // title row height
  let SRC = { x: 0, y: 0 }; // neuromod source position (set in layout)

  function layout(e) {
    const padX = 70;
    const padBottom = 26;
    const top = TOP + 30; // leave room for source + layer captions
    const cols = LAYERS.length;
    const colGap = (e.w - padX * 2) / (cols - 1);
    nodes.forEach((n) => {
      n.x = padX + n.layer * colGap;
      const usableH = e.h - top - padBottom;
      const rowGap = usableH / Math.max(1, n.count - 1);
      n.y = n.count === 1 ? top + usableH / 2 : top + n.i * rowGap;
    });
    // source node: above the hidden layer, in the top strip.
    const hidden = nodes.find((n) => n.layer === 1);
    SRC = { x: hidden ? hidden.x : e.w / 2, y: TOP + 16 };
  }

  // Midpoint of an edge (where the source leader points, and the co-fire flare).
  function edgeMid(ed) {
    const A = nodes[ed.from];
    const B = nodes[ed.to];
    return { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
  }

  // Correlation envelope of an edge's endpoints over the beat.
  // Correlated edges peak together at the start of a beat; the uncorrelated
  // counter-example is driven exactly out of phase so the product never peaks.
  function coFire(corr) {
    // sharp pulse near beatPhase 0
    const pulse = Math.max(0, 1 - beatPhase * 5); // 1 at phase 0, ->0 by 0.2
    return corr ? pulse : 0; // anti-correlated pair simply never co-fires
  }

  // ---- one local update: step correlated, gated edges thicker ------------
  // No global signal, no backward pass — each edge reads only its own two
  // endpoints and the gate covering it.
  function applyBeatStep() {
    const gm = gatedMap();
    for (const g of GATED[context]) {
      if (!g.corr) continue; // uncorrelated counter-example does not grow
      const ed = edgeById(g.id);
      if (ed && gm.has(ed.id)) ed.width = clamp(ed.width + STEP_W, BASE_W, MAX_W);
    }
  }

  // Reset all thicknesses (used when context moves: the new subset grows fresh).
  function resetWidths() {
    for (const ed of edges) ed.width = BASE_W;
  }

  // =======================================================================
  // DRAW
  // =======================================================================
  function draw(e) {
    const { ctx, w, h } = e;
    ctx.clearRect(0, 0, w, h);
    layout(e);

    const gm = gatedMap();

    // current leader endpoints interpolate from prevContext to context
    const slideEased = slide * slide * (3 - 2 * slide); // smoothstep

    // ---------- title row (top-left): the figure's voice + explicit WORD ---
    drawText(ctx, 'title', 'A signal gates where learning is allowed.', 2, 14, {
      color: pal.bone,
      baseline: 'middle',
    });
    // explicit state, spelled out — never colour alone
    const stateWord = neuromod ? `PLASTIC: context ${context}` : 'FIXED: no plastic edges';
    drawText(ctx, 'label', stateWord, 2, 30, {
      color: neuromod ? pal.synapse : pal.boneDim,
      baseline: 'middle',
    });
    // the canonical contrast with backprop, stated once, top-right
    drawText(ctx, 'label', 'no backward pass', w - 2, 30, {
      color: pal.boneDim,
      align: 'right',
      baseline: 'middle',
      alpha: 0.8,
    });

    // ---------- leader lines from the neuromod source to gated edges -------
    // Drawn BEFORE the network so edges/nodes sit on top. Thin amber lines —
    // restrained, not a glowing wash. They visibly choose the plastic subset.
    if (neuromod) {
      // targets: blend old subset midpoints -> new subset midpoints during slide
      const oldList = GATED[prevContext];
      const newList = GATED[context];
      const nLeaders = Math.max(oldList.length, newList.length);
      for (let k = 0; k < nLeaders; k++) {
        const oEd = oldList[k] && edgeById(oldList[k].id);
        const nEd = newList[k] && edgeById(newList[k].id);
        if (!oEd && !nEd) continue;
        const oM = oEd ? edgeMid(oEd) : SRC;
        const nM = nEd ? edgeMid(nEd) : SRC;
        const tx = lerp(oM.x, nM.x, slideEased);
        const ty = lerp(oM.y, nM.y, slideEased);
        ctx.beginPath();
        ctx.moveTo(SRC.x, SRC.y);
        // gentle curve so leaders read as routed signal, not structural wire
        const cx = (SRC.x + tx) / 2;
        const cy = SRC.y - 6;
        ctx.quadraticCurveTo(cx, cy, tx, ty);
        ctx.strokeStyle = rgba(synRGB, 0.42);
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // ---------- edges ------------------------------------------------------
    for (const ed of edges) {
      const A = nodes[ed.from];
      const B = nodes[ed.to];
      const g = gm.get(ed.id);
      const plastic = !!g;
      ctx.beginPath();
      ctx.moveTo(A.x, A.y);
      ctx.lineTo(B.x, B.y);
      if (plastic) {
        ctx.strokeStyle = rgba(synRGB, 0.95);
        ctx.lineWidth = ed.width;
      } else {
        ctx.strokeStyle = rgba(hexToRgb(pal.graphite), 0.75);
        ctx.lineWidth = BASE_W;
      }
      ctx.stroke();
    }
    ctx.lineWidth = 1;

    // ---------- co-firing flare at the midpoint of correlated gated edges --
    // A brief amber flare on the shared beat — the visible "wire-together"
    // instant. Skipped under reduced motion (the static frame shows result).
    if (neuromod && !e.reduced) {
      for (const g of GATED[context]) {
        const ed = edgeById(g.id);
        if (!ed) continue;
        const f = coFire(g.corr);
        if (f <= 0.01) continue;
        const m = edgeMid(ed);
        ctx.beginPath();
        ctx.arc(m.x, m.y, 2 + 4 * f, 0, Math.PI * 2);
        ctx.fillStyle = rgba(synRGB, 0.5 * f);
        ctx.fill();
      }
    }

    // ---------- nodes ------------------------------------------------------
    // Precompute which node indices belong to a firing correlated gated edge.
    let firingNodes = null;
    if (neuromod && !e.reduced) {
      const f = coFire(true);
      if (f > 0.01) {
        firingNodes = new Set();
        for (const g of GATED[context]) {
          if (!g.corr) continue;
          const ed = edgeById(g.id);
          if (!ed) continue;
          firingNodes.add(ed.from);
          firingNodes.add(ed.to);
        }
      }
    }
    for (let ni = 0; ni < nodes.length; ni++) {
      const n = nodes[ni];
      const r = 10;
      // endpoint flash: bone -> amber when this node co-fires on the beat
      // (no perpetual glow — only on the shared correlated beat instant).
      const flash = firingNodes && firingNodes.has(ni) ? coFire(true) : 0;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = pal.ink;
      ctx.fill();
      // ring: bone, warming to amber on a co-fire flash (no perpetual glow)
      ctx.lineWidth = 1.5;
      const rr = lerp(boneRGB.r, synRGB.r, flash);
      const rg = lerp(boneRGB.g, synRGB.g, flash);
      const rb = lerp(boneRGB.b, synRGB.b, flash);
      ctx.strokeStyle = `rgba(${rr | 0},${rg | 0},${rb | 0},${0.55 + 0.4 * flash})`;
      ctx.stroke();
    }
    ctx.lineWidth = 1;

    // ---------- neuromod source node (explicit object) ---------------------
    // A small diamond. ON -> amber + label; OFF -> graphite, leaders gone.
    const s = 8;
    ctx.beginPath();
    ctx.moveTo(SRC.x, SRC.y - s);
    ctx.lineTo(SRC.x + s, SRC.y);
    ctx.lineTo(SRC.x, SRC.y + s);
    ctx.lineTo(SRC.x - s, SRC.y);
    ctx.closePath();
    if (neuromod) {
      ctx.fillStyle = rgba(synRGB, 0.9);
      ctx.fill();
      ctx.strokeStyle = rgba(synRGB, 1);
    } else {
      ctx.fillStyle = pal.ink;
      ctx.fill();
      ctx.strokeStyle = rgba(hexToRgb(pal.graphite), 0.9);
    }
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.lineWidth = 1;
    drawText(ctx, 'label', 'neuromod', SRC.x + s + 6, SRC.y, {
      color: neuromod ? pal.synapse : pal.boneDim,
      align: 'left',
      baseline: 'middle',
      size: 9.5,
    });

    // ---------- layer captions --------------------------------------------
    const caps = ['INPUT', 'HIDDEN', 'OUTPUT'];
    LAYERS.forEach((c, L) => {
      const n = nodes.find((nn) => nn.layer === L);
      if (n) {
        drawText(ctx, 'label', caps[L], n.x, h - 8, {
          color: pal.boneDim,
          align: 'center',
          baseline: 'alphabetic',
          size: 9,
          alpha: 0.7,
        });
      }
    });

    // ---------- counter-example callout -----------------------------------
    // Name the thin gated edge so the "needs correlation" point is legible
    // and not left to colour/thickness alone.
    if (neuromod) {
      const cg = GATED[context].find((g) => !g.corr);
      const ed = cg && edgeById(cg.id);
      if (ed) {
        const m = edgeMid(ed);
        drawText(ctx, 'data', 'gated, not correlated — stays thin', m.x, m.y + 16, {
          color: pal.boneDim,
          align: 'center',
          baseline: 'middle',
          size: 9,
          alpha: 0.85,
        });
      }
    }
  }

  // =======================================================================
  // UPDATE — runs only while a transient is live (autoplay: false).
  // =======================================================================
  function update(dt) {
    let busy = false;

    // context slide
    if (slide < 1) {
      slide = clamp(slide + dt / SLIDE, 0, 1);
      busy = true;
    }

    // co-firing beat: advance the clock; on each beat boundary, step
    // correlated gated edges one notch thicker, until they reach MAX_W.
    if (neuromod) {
      beatClock += dt;
      const beatIndex = Math.floor(beatClock / BEAT_PERIOD);
      if (beatIndex > lastBeatIndex) {
        lastBeatIndex = beatIndex;
        applyBeatStep();
      }
      beatPhase = (beatClock % BEAT_PERIOD) / BEAT_PERIOD; // [0,1) for the pulse
      // keep beating until the correlated edges are saturated
      const saturated = GATED[context]
        .filter((g) => g.corr)
        .every((g) => {
          const ed = edgeById(g.id);
          return ed && ed.width >= MAX_W - 0.001;
        });
      if (!saturated) busy = true;
    }

    if (!busy) {
      // Settle on a clean, non-firing resting frame (no flare frozen on).
      beatPhase = 0.5;
      fig.stop(); // transient settled — figure goes still
      fig.render();
    }
  }

  fig = createFigure({ canvas, update, draw, autoplay: false });
  const env = fig.env;

  // Start (or restart) the co-firing animation toward saturation.
  function runBeats() {
    if (env.reduced) {
      // resolve instantly: bring correlated edges to a thicker resting state
      applyBeatStep();
      applyBeatStep();
      fig.render();
      return;
    }
    beatClock = 0;
    beatPhase = 0;
    lastBeatIndex = 0;
    fig.play();
  }

  // Switch context: slide the gated set to the disjoint subset, grow fresh.
  function setContext(c) {
    if (c === context) return;
    prevContext = context;
    context = c;
    resetWidths();
    if (env.reduced) {
      slide = 1;
      applyBeatStep();
      fig.render();
      return;
    }
    slide = 0;
    beatClock = 0;
    beatPhase = 0;
    lastBeatIndex = 0;
    fig.play();
  }

  // =======================================================================
  // CONTROLS
  // =======================================================================

  // --- neuromodulator toggle (segmented, biological amber press) ---------
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
      if (neuromod) {
        resetWidths();
        runBeats();
      } else {
        fig.stop();
        fig.render();
      }
    });
    segMod.append(b);
    return b;
  });
  controls.append(segMod);

  // --- context toggle (segmented) ----------------------------------------
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
      ctxBtns.forEach((bb, k) =>
        bb.setAttribute('aria-pressed', String(ctxOptions[k] === c))
      );
      setContext(c);
    });
    segCtx.append(b);
    return b;
  });
  controls.append(segCtx);

  // --- legend chips: meaning never by colour alone -----------------------
  const chipFixed = document.createElement('span');
  chipFixed.className = 'ctrl-chip';
  chipFixed.style.setProperty('--c', pal.graphite);
  chipFixed.textContent = 'fixed';
  const chipPlastic = document.createElement('span');
  chipPlastic.className = 'ctrl-chip';
  chipPlastic.style.setProperty('--c', pal.synapse);
  chipPlastic.textContent = 'plastic now';
  const chipSignal = document.createElement('span');
  chipSignal.className = 'ctrl-chip';
  chipSignal.style.setProperty('--c', pal.synapse);
  chipSignal.textContent = 'neuromod signal';
  controls.append(chipFixed, chipPlastic, chipSignal);

  // --- reduced motion: a step button advances one local update -----------
  if (env.reduced) {
    const stepBtn = document.createElement('button');
    stepBtn.className = 'ctrl-btn';
    stepBtn.type = 'button';
    stepBtn.textContent = '1 local update (no backward pass)';
    stepBtn.addEventListener('click', () => {
      if (!neuromod) return;
      applyBeatStep();
      fig.render();
    });
    controls.append(stepBtn);
  }

  // ---- initial resolved frame -------------------------------------------
  // Pre-grow the correlated edges of context A so the FIRST paint already
  // shows the resolved story: source + leaders + a couple of thick
  // (correlated) edges and one thin (uncorrelated) edge.
  applyBeatStep();
  applyBeatStep();
  fig.start(); // autoplay:false -> paints one still frame
  if (!env.reduced) runBeats(); // then animate toward saturation once
  return fig;
}
