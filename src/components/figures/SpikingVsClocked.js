/* =====================================================================
   SpikingVsClocked — chapter 7 (neuromorphic).

   Three honest elements in one canvas:
   (1) LEFT  — a "clocked digital" chip: a grid of cells that ALL light
       up on every clock tick (phosphor). Energy per tick is paid for
       the *whole* array whether or not it does useful work.
   (2) RIGHT — an "event-driven spiking" chip: the same grid but mostly
       dark, only a few sparse cells fire on sparse events (synapse
       amber). Energy is paid only for the cells that actually spiked.
       Live energy counters under each make the gap concrete: digital
       climbs fast (∝ all cells), spiking climbs slowly (∝ few cells).
   (3) BELOW — a MEMRISTOR CROSSBAR computing a matrix-vector multiply
       "in physics": rows are input lines carrying voltages in[i],
       junctions hold conductances G[i][j], columns sum currents.
       Ohm's law (I = V·G) is the multiply; Kirchhoff's current law
       (currents sum on the column wire) is the accumulate, so
         out[j] = Σ_i  in[i] · G[i][j].
       A NOISE slider perturbs each conductance; the noisy output bars
       (solid) drift away from the clean target (faint) — the
       efficiency-vs-reliability tradeoff made tangible.

   Reduced motion: static frame (digital all-lit, spiking few-lit,
   representative counters); a "step ⏵" button advances one tick
   (increments counters, rerolls spikes); the noise slider works live.
   ===================================================================== */

import { createFigure, palette, clamp } from '../lib/canvas.js';

const GRID = 6; // cells per side on each chip
const CELLS = GRID * GRID;

// crossbar dimensions
const ROWS = 4; // input lines
const COLS = 4; // output lines

export default function mount(stage) {
  const canvas = stage.querySelector('canvas');
  const controls = stage.querySelector('[data-controls]');
  const pal = palette();

  const font = '11px "Spline Sans Mono", monospace';
  const head = '600 13px "Spline Sans Mono", monospace';

  // --- clock / energy state ---
  let tick = 0;
  let tickPhase = 0; // 0..1 within the current tick (for the digital flash)
  let digitalEnergy = 0; // arbitrary energy units
  let spikingEnergy = 0;
  let spikes = []; // indices of currently-firing cells on the spiking chip

  // energy cost model (per tick):
  //   digital pays for every cell;  spiking pays only for fired cells.
  const COST_PER_CELL = 1;

  function rerollSpikes() {
    // a few sparse events — ~3 cells out of 36 light up this tick
    const n = 2 + Math.floor(Math.random() * 3);
    spikes = [];
    for (let k = 0; k < n; k++) {
      spikes.push(Math.floor(Math.random() * CELLS));
    }
  }

  function advanceTick() {
    tick++;
    digitalEnergy += CELLS * COST_PER_CELL; // all cells, every tick
    rerollSpikes();
    spikingEnergy += spikes.length * COST_PER_CELL; // only fired cells
  }

  // --- crossbar matrix-vector multiply ---
  // input vector (fixed illustrative values, normalized 0..1)
  const inVec = [0.9, 0.4, 0.7, 0.2];
  // conductance matrix G[i][j], fixed "weights" (normalized 0..1)
  const G = [
    [0.8, 0.2, 0.5, 0.1],
    [0.3, 0.9, 0.2, 0.6],
    [0.1, 0.4, 0.7, 0.3],
    [0.6, 0.1, 0.2, 0.8],
  ];
  let noise = 0; // 0..1 slider

  // clean output: out[j] = Σ_i in[i] * G[i][j]
  function cleanOut() {
    const out = new Array(COLS).fill(0);
    for (let j = 0; j < COLS; j++) {
      let s = 0;
      for (let i = 0; i < ROWS; i++) s += inVec[i] * G[i][j];
      out[j] = s;
    }
    return out;
  }
  // noisy output: perturb each conductance by ± up to `noise` before summing
  function noisyOut() {
    const out = new Array(COLS).fill(0);
    for (let j = 0; j < COLS; j++) {
      let s = 0;
      for (let i = 0; i < ROWS; i++) {
        // multiplicative + additive jitter scaled by the slider
        const jitter = (Math.random() * 2 - 1) * noise;
        const g = clamp(G[i][j] * (1 + jitter) + jitter * 0.15, 0, 1.4);
        s += inVec[i] * g;
      }
      out[j] = s;
    }
    return out;
  }
  // max possible column sum, for scaling bars (in·G all = 1)
  const OUT_MAX = inVec.reduce((a, b) => a + b, 0) * 1.0;
  let noisyCache = cleanOut(); // resampled each tick so noise shimmers

  function update(dt) {
    tickPhase += dt * 2.2; // ~2 ticks/sec
    if (tickPhase >= 1) {
      tickPhase -= 1;
      advanceTick();
      noisyCache = noisyOut();
    }
  }

  // ===================================================================
  // chip grid renderer
  // ===================================================================
  function drawChip(e, x0, y0, size, opts) {
    const { ctx } = e;
    const { title, color, allLit, litSet, sub } = opts;
    ctx.save();
    ctx.translate(x0, y0);

    ctx.font = head;
    ctx.fillStyle = pal.bone;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(title, 0, -10);

    const pad = 4;
    const cw = (size - pad * (GRID - 1)) / GRID;
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const idx = r * GRID + c;
        const cx = c * (cw + pad);
        const cy = r * (cw + pad);
        const on = allLit ? true : litSet.includes(idx);
        if (on) {
          // digital flashes in sync with the tick; spiking holds bright
          const a = allLit ? 0.45 + 0.45 * (1 - tickPhase) : 0.95;
          ctx.fillStyle = color;
          ctx.globalAlpha = a;
        } else {
          ctx.fillStyle = pal.graphite;
          ctx.globalAlpha = 0.35;
        }
        ctx.fillRect(cx, cy, cw, cw);
      }
    }
    ctx.globalAlpha = 1;

    // subtitle / energy readout under the grid
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.fillText(sub, 0, size + 16);

    ctx.restore();
    return size; // grid pixel height == size
  }

  // ===================================================================
  // memristor crossbar
  // ===================================================================
  function drawCrossbar(e, x0, y0, bw, bh) {
    const { ctx } = e;
    ctx.save();
    ctx.translate(x0, y0);

    ctx.font = head;
    ctx.fillStyle = pal.bone;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('memristor crossbar — multiply in physics', 0, -10);
    ctx.font = font;
    ctx.fillStyle = pal.graphite;
    ctx.fillText('Ohm: I=V·G (multiply)   Kirchhoff: Σ currents (sum)', 0, 6);

    const gridLeft = 70;
    const gridTop = 22;
    const gridW = Math.min(220, bw - gridLeft - 150);
    const gridH = Math.min(110, bh - gridTop - 30);
    const colSpace = gridW / COLS;
    const rowSpace = gridH / ROWS;

    // row (input) wires + input vector labels on the left
    ctx.strokeStyle = pal.graphite;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < ROWS; i++) {
      const ry = gridTop + i * rowSpace + rowSpace / 2;
      ctx.beginPath();
      ctx.moveTo(gridLeft, ry);
      ctx.lineTo(gridLeft + gridW, ry);
      ctx.stroke();
      // input value entering this row (synapse = incoming signal)
      ctx.fillStyle = pal.synapse;
      ctx.textBaseline = 'middle';
      ctx.font = font;
      ctx.fillText('in ' + inVec[i].toFixed(1), 8, ry);
    }
    // column (output) wires
    for (let j = 0; j < COLS; j++) {
      const cx = gridLeft + j * colSpace + colSpace / 2;
      ctx.strokeStyle = pal.graphite;
      ctx.beginPath();
      ctx.moveTo(cx, gridTop);
      ctx.lineTo(cx, gridTop + gridH);
      ctx.stroke();
    }
    // junction conductances (filled dots sized by G)
    for (let i = 0; i < ROWS; i++) {
      for (let j = 0; j < COLS; j++) {
        const ry = gridTop + i * rowSpace + rowSpace / 2;
        const cx = gridLeft + j * colSpace + colSpace / 2;
        const rad = 2 + G[i][j] * 5;
        ctx.fillStyle = pal.phosphor;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(cx, ry, rad, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // output bars at the far right: clean target (faint) vs noisy (solid)
    const clean = cleanOut();
    const noisy = noisyCache;
    const barsX = gridLeft + gridW + 18;
    const barMaxW = bw - barsX - 8;
    const barH = rowSpace * 0.55;
    ctx.font = font;
    for (let j = 0; j < COLS; j++) {
      const cy = gridTop + j * rowSpace + rowSpace / 2 - barH / 2;
      // clean target — faint outline
      const cleanW = (clean[j] / OUT_MAX) * barMaxW;
      ctx.strokeStyle = pal.bone;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 1;
      ctx.strokeRect(barsX, cy, Math.max(1, cleanW), barH);
      ctx.globalAlpha = 1;
      // noisy actual — solid synapse fill
      const noisyW = (noisy[j] / OUT_MAX) * barMaxW;
      ctx.fillStyle = pal.synapse;
      ctx.fillRect(barsX, cy, Math.max(1, clamp(noisyW, 0, barMaxW)), barH);
      // label out[j]
      ctx.fillStyle = pal.graphite;
      ctx.textBaseline = 'middle';
      ctx.fillText('out' + j, barsX, cy + barH + 7);
    }

    // legend line for the bars
    ctx.fillStyle = pal.bone;
    ctx.textBaseline = 'top';
    ctx.fillText('faint = clean target   solid = noisy actual', gridLeft, gridTop + gridH + 12);

    ctx.restore();
  }

  function draw(e) {
    const { ctx, w, h } = e;
    ctx.clearRect(0, 0, w, h);
    ctx.textBaseline = 'alphabetic';

    const padX = 16;
    const innerW = w - padX * 2;

    // top row: two chips side by side
    const chipSize = Math.min(150, (innerW - 40) / 2);
    const topY = 30;
    const leftX = padX + ((innerW / 2) - chipSize) / 2;
    const rightX = padX + innerW / 2 + ((innerW / 2) - chipSize) / 2;

    drawChip(e, leftX, topY, chipSize, {
      title: 'clocked digital',
      color: pal.phosphor,
      allLit: true,
      litSet: [],
      sub: 'energy ≈ ' + digitalEnergy + '  (all cells / tick)',
    });
    drawChip(e, rightX, topY, chipSize, {
      title: 'event-driven spiking',
      color: pal.synapse,
      allLit: false,
      litSet: spikes,
      sub: 'energy ≈ ' + spikingEnergy + '  (few cells / event)',
    });

    // tick counter centered between the chips
    ctx.font = font;
    ctx.fillStyle = pal.graphite;
    ctx.textAlign = 'center';
    ctx.fillText('tick ' + tick, w / 2, topY + chipSize + 32);
    ctx.textAlign = 'left';

    // crossbar below
    const cbY = topY + chipSize + 64;
    drawCrossbar(e, padX, cbY, innerW, h - cbY - 8);
  }

  // seed an initial sparse pattern so the first frame is meaningful
  rerollSpikes();
  noisyCache = noisyOut();

  const fig = createFigure({ canvas, update, draw });
  const env = fig.env;

  // Under reduced motion, prime representative counter values so the
  // static frame already shows the gap rather than starting at zero.
  if (env.reduced) {
    for (let k = 0; k < 8; k++) advanceTick();
    noisyCache = noisyOut();
  }

  // ---- legend chips ----
  const legend = document.createElement('div');
  legend.style.display = 'flex';
  legend.style.flexWrap = 'wrap';
  legend.style.gap = '10px';
  const chips = [
    [pal.phosphor, 'clocked digital'],
    [pal.synapse, 'spiking / input'],
  ];
  for (const [c, label] of chips) {
    const span = document.createElement('span');
    span.className = 'ctrl-chip';
    span.style.setProperty('--c', c);
    span.textContent = label;
    legend.append(span);
  }
  controls.append(legend);

  // ---- noise slider ----
  const wrap = document.createElement('label');
  wrap.className = 'ctrl-label';
  wrap.textContent = 'crossbar noise ';
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'ctrl-slider';
  slider.min = '0';
  slider.max = '1';
  slider.step = '0.01';
  slider.value = '0';
  const readout = document.createElement('span');
  readout.className = 'ctrl-readout';
  readout.textContent = '0.00';
  slider.addEventListener('input', () => {
    noise = parseFloat(slider.value);
    readout.textContent = noise.toFixed(2);
    noisyCache = noisyOut();
    // works whether animating or reduced — repaint immediately
    fig.render();
  });
  wrap.append(slider, readout);
  controls.append(wrap);

  // ---- reduced-motion step button (advance one tick) ----
  if (env.reduced) {
    const stepBtn = document.createElement('button');
    stepBtn.className = 'ctrl-btn';
    stepBtn.type = 'button';
    stepBtn.textContent = 'step ⏵';
    stepBtn.addEventListener('click', () => {
      advanceTick();
      noisyCache = noisyOut();
      fig.render();
    });
    controls.append(stepBtn);
  }

  fig.start();
  return fig;
}
