# Adaptive Machines

A single-page, scroll-driven visual essay on brain-inspired machine architectures — and an honest account of why these elegant ideas keep losing to brute-force scale, and the one condition under which they finally win.

The piece walks from *"what does it even mean for a model to adapt?"* up to the research frontier (neural ODEs, liquid networks, plasticity, neural cellular automata, the hardware lottery, neuromorphic chips), pairing every exciting idea with its real limitation. Two motifs run throughout:

- **The bitter lesson** (Sutton, 2019) — structured, biologically-inspired architectures keep getting beaten by a simpler architecture given more data and compute.
- **The test** — for any "adaptive" idea, ask: *is the magic in the unit, or in the interaction?* If it lives in the interaction, no single component can hold it.

## Run it

```bash
npm install
npm run dev      # local dev server (default http://localhost:4321)
npm run build    # static bundle into dist/
npm run preview  # serve the built bundle
```

The output is a fully static site (`dist/`), deployable as-is to GitHub Pages, Netlify, or any free-tier static host. No backend, no API keys, no paid services.

## Stack

- **[Astro](https://astro.build)** (static output) — content-first, ships minimal JS, with islands only for the interactive figures.
- **Visualizations** — plain `<canvas>` + `requestAnimationFrame`. `d3-scale`/`d3-shape` are listed as dependencies but the figures are hand-written; dependencies are kept near-zero.
- **Fonts** — Google Fonts (Space Grotesk / Newsreader / Spline Sans Mono), loaded via `<link>` with strong system fallbacks so the page is readable before they load.

## Design

The identity is **"Wetware / Hardware"**: the friction between wet, continuous, noisy biology and dry, discrete, precise silicon. Two accents carry meaning, not decoration — `--phosphor` (cool teal) is the *silicon* signal and `--synapse` (warm amber) is the *biological* signal, and they argue with each other across the page. Palette tokens live in `src/styles/tokens.css`.

Layout is a scroll-driven long read with a slim left progress rail / table of contents. On desktop most chapters pin a sticky visualization while the text scrolls; on mobile this degrades to viz-then-text stacked blocks with no pinning.

### Accessibility & performance

- Every animation honors `prefers-reduced-motion`: no autoplay, a static frame, and a manual **step** affordance where there is a temporal story.
- Off-screen canvases are paused via `IntersectionObserver`; `devicePixelRatio` is capped at 2; figures are lazy-loaded as they approach the viewport.
- Semantic headings, visible keyboard focus, keyboard-operable controls, a text description for every figure, and AA contrast. Color is never the only signal — phosphor-vs-synapse meaning is always paired with a text label.
- Responsive from 360px to wide desktop.

## What each figure demonstrates

| Module (`src/components/figures/`) | Chapter | What it shows |
| --- | --- | --- |
| `LivingOrganism.js` | Hero + Ch. 4 | **Signature.** A self-organizing automaton grown from one seed by a single local rule (a masked reaction-diffusion approximation — *illustrative of the principle*, not a trained NCA). Drag to tear a hole; it heals. A toggle proves every cell runs the identical rule. The form lives in the interaction, not in any cell. |
| `PhaseFlow.js` | Ch. 1 | A particle drifting through a 2D vector field. Toggle discrete (ResNet, fixed stair-steps, `h → h + f(h)`) vs continuous (ODE, a smooth curve whose adaptive step markers cluster where the field is stiff). Drag the start point. |
| `LiquidNeuron.js` | Ch. 2 | One liquid neuron as a leaky integrator chasing a square wave. The input slider flexes its time constant — the response visibly speeds up or slows down. Labels the corrected myth: the *weights* never change, only the *dynamics*. A small strip nods to Mamba-style selectivity. |
| `NeuromodPlasticity.js` | Ch. 3 | A small network where a neuromodulator gate selects *which* connections become plastic (they light amber and strengthen) under different input contexts — local, self-directed learning with no global backward pass. |
| `StabilityPlasticity.js` | Ch. 5.1 | One slider from rigid (can't learn) to chaotic (forgets everything), with live learning-vs-retention meters and a narrow viable sweet spot in the middle — the stability–plasticity dilemma. |
| `GenerateVerify.js` | Ch. 5.2 | A maze. *Generating* a path animates slowly (search is hard); *verifying* a proposed path flashes valid/invalid in one frame (checking is cheap). The asymmetry behind scalable oversight. Uses the reserved `--oversight` violet. |
| `DendriticUnfold.js` | Ch. 5.3 | Click the dot labelled "neuron"; it unfolds into the 5–8-layer network you'd need to imitate one cortical neuron (Beniaguev, Segev & London, 2021), then folds back. |
| `EdgeToFunction.js` | Ch. 5.4 | A single edge whose scalar weight morphs into a small learnable curve — a KAN-style edge. A number becomes a function. |
| `EnergyBudget.js` | Ch. 6 | Two honest charts: the brain's ~20 W against a large training run on a log scale, and where the energy of one operation goes — data movement dwarfing compute (the memory wall), with a dark-silicon schematic. |
| `SpikingVsClocked.js` | Ch. 7 | A clocked digital chip (fully lit every tick) beside a spiking chip (mostly dark, flaring on sparse events) with a live energy counter favoring the spiking one — plus a memristor crossbar doing a matrix-vector multiply in physics, with a noise slider that degrades the result. |
| `ConstraintDial.js` | Ch. 8 | One dial between capability-bound and energy-bound; as you turn it toward energy the accent balance shifts from phosphor toward synapse — silicon's advantage giving way to biology's. |

Shared lifecycle helpers (DPR cap, `IntersectionObserver` pause, the rAF loop, reduced-motion handling, palette resolution) live in `src/components/figures/lib/canvas.js`. Copy is kept separate from layout in `src/content/chapters.ts`.

## Project structure

```
src/
  pages/index.astro            # the page
  layouts/BaseLayout.astro     # head, fonts, skip link
  components/
    Hero.astro                 # signature organism + thesis
    Chapter.astro              # sticky-viz scrollytelling + Ch.5 sub-blocks
    ProgressRail.astro         # left rail, active-chapter + scroll progress
    Figure.astro               # shared figure frame + text description
    figures/                   # one self-contained module per visualization
      lib/canvas.js            # IntersectionObserver / rAF / reduced-motion helpers
  content/chapters.ts          # all copy + references
  styles/
    tokens.css                 # palette + type scale
    controls.css               # shared figure-control styling
```

## A note on accuracy

The figures are *illustrative of the principles they name*, not trained models. The technical claims in the copy are intended to be accurate, and every exciting idea is shipped with its honest limitation — including an explicit correction of the common "liquid networks rewrite their own weights" myth. Sources are listed under *Further reading* at the foot of the page, linked only to canonical pages.
