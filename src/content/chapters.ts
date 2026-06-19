/* =====================================================================
   Adaptive Machines — content.
   Copy lives here, separate from layout. Voice: plain, precise, a little
   dry. Sentence case. No hype vocabulary. Every exciting idea is paired
   with its real limitation — the honesty is the product.
   ===================================================================== */

export interface Figure {
  /** id of the figure module (matches the canvas data-figure attribute) */
  id: string;
  /** short caption shown under the figure */
  caption: string;
  /** text description / alt for screen readers and reduced-motion readers */
  description: string;
  /** optional spec-style label shown above the figure */
  spec?: string;
}

export interface SideNote {
  label: string;
  body: string;
}

export interface SubBlock {
  /** the intuition, in the reader's own words */
  intuition: string;
  /** the real research name(s) it maps to */
  realName: string;
  body: string;
  figure?: Figure;
}

export interface Chapter {
  /** anchor id + progress-rail key */
  id: string;
  /** "01".."08" — empty for hero */
  num: string;
  /** small overline */
  kicker: string;
  title: string;
  /** standfirst / deck */
  dek?: string;
  /** body paragraphs */
  body: string[];
  /** the world this chapter leans toward, for the accent seam */
  lean?: 'silicon' | 'bio' | 'oversight' | 'neutral';
  figure?: Figure;
  sideNote?: SideNote;
  subBlocks?: SubBlock[];
}

export const hero = {
  id: 'hero',
  eyebrow: 'A visual essay on brain-inspired machines',
  title: 'Adaptive Machines',
  thesis:
    'Every few years, someone builds a machine that learns a little more like a brain. Almost every time, a simpler machine that just scales beats it. This is the story of why the brain-like idea keeps coming back anyway — and the one thing that would finally make it win.',
  figure: {
    id: 'living-organism',
    caption:
      'A living automaton, grown from a single seed by one local rule. Drag across it to tear a hole; watch it heal back to form.',
    description:
      'An animated organism grows outward from a central seed into a soft, lobed shape. Every cell runs the identical update rule, looking only at its neighbours. When you erase a region, the surrounding cells regrow the missing part until the original form returns. The point: the form lives in the interaction between cells, not inside any one of them.',
    spec: 'signature // illustrative of the principle',
  } satisfies Figure,
  note: 'Every cell runs the identical rule. The form lives in the interaction, not in any cell.',
};

export const chapters: Chapter[] = [
  {
    id: 'ch1-dynamical',
    num: '01',
    kicker: 'The reframing',
    title: 'From fixed functions to dynamical systems',
    lean: 'silicon',
    body: [
      'An ordinary deep network is a fixed pipeline. Input goes in, a set number of transforms run in order, an output comes out. The shape of the computation is decided before the data arrives and never changes. That rigidity is most of why these networks are easy to build and easy to run on hardware that likes doing the same thing a billion times.',
      'The adaptive lineage starts by refusing that frame. Instead of a fixed stack of layers, treat the hidden state as something that *flows* over time under a differential equation — and let the behaviour of that equation depend on the input. Neural ODEs (Chen et al., 2018) are the seed of the idea. Notice that a ResNet block, h → h + f(h), is exactly one Euler step of dh/dt = f(h). So stop discretising by hand: define the network *as* the differential equation and hand it to a real ODE solver.',
      'Two things fall out for free. Depth stops being an integer you choose and becomes continuous. And because the solver is adaptive, it spends more steps where the dynamics are stiff and fewer where they are gentle — the model does more computation exactly where the problem is hard. Elegant. Whether elegance is enough is the question the rest of this essay keeps asking.',
    ],
    figure: {
      id: 'phase-flow',
      caption:
        'A particle drifting through a 2D vector field. Toggle between the discrete ResNet (fixed stair-steps) and the continuous ODE (a smooth integrated curve whose step markers cluster where the field is stiff). Drag the start point.',
      description:
        'A phase-space plane showing a flow field of arrows. A particle is released and follows the flow. In discrete mode it advances in fixed, equal jumps like a staircase. In continuous mode it traces a smooth curve, and the integrator places more step markers in regions where the field changes quickly. Dragging the start point launches a new trajectory.',
      spec: 'fig.01 // phase space',
    },
  },
  {
    id: 'ch2-dynamics',
    num: '02',
    kicker: 'Thread one — the winning thread',
    title: 'Adaptive dynamics',
    dek: 'Make the system itself input-dependent, and brain-flavoured adaptivity can win — if it respects the hardware.',
    lean: 'silicon',
    body: [
      'The first thread keeps the weights fixed but makes the *dynamics* bend to the input. Liquid networks (Hasani et al.) make each neuron’s time constant — how fast it reacts and how fast it forgets — a function of what it is currently seeing. The same network behaves like a fast, twitchy system for one input and a slow, smooth one for another. The famous demo steers a car with about nineteen neurons.',
      'State-space models take the same continuous-system idea and engineer it for scale. S4, and then Mamba (Gu & Dao), make the system matrices themselves input-dependent — “selective,” in their words, deciding per token what to keep and what to let decay. That selectivity is the liquid idea wearing hardware-friendly clothes, and it is competitive with transformers at long sequences. This is the existence proof: brain-flavoured adaptivity *can* win, but only when it is redesigned to run on the machine we actually have.',
    ],
    sideNote: {
      label: 'Myth, corrected',
      body:
        'The trained weights do not rewrite themselves at inference. Nothing in a liquid network edits its own parameters as it runs. What is input-dependent is the *dynamics* — the time constants, the decay rates — not the weights. “The network rewires itself on the fly” is the single most common misstatement of this work, and it is wrong.',
    },
    figure: {
      id: 'liquid-neuron',
      caption:
        'One liquid neuron. Move the input slider and its response curve visibly speeds up or slows down as the time constant flexes. The weights never change — only the dynamics do.',
      description:
        'A single neuron’s step response is plotted as a curve that rises and settles. An input slider controls the neuron’s effective time constant: low input gives a slow, gradual curve; high input gives a fast, sharp one. A readout shows the current time constant. A small companion strip shows a token sequence where a selective gate marks, per token, what is kept versus forgotten.',
      spec: 'fig.02 // time constant',
    },
  },
  {
    id: 'ch3-learning',
    num: '03',
    kicker: 'Thread two — the still-losing thread',
    title: 'Adaptive learning rules',
    dek: 'The brain does not backpropagate. It uses local rules. That thread is intellectually rich and still not competitive at scale.',
    lean: 'bio',
    body: [
      'Backpropagation needs a global pass that carries error backwards through the whole network. Brains have no such machinery. They learn with *local* rules — a synapse changes based on signals it can actually see. Hebbian learning is the ancestor: cells that fire together wire together.',
      'Differentiable plasticity (Miconi et al.) makes this trainable. Each connection gets a fixed part plus a plastic part that updates *during the forward pass*, and gradient descent is used to learn how plastic each connection should be. The network learns how to learn. Neuromodulated plasticity — backpropamine — goes further, adding a network-generated, dopamine-like signal that gates *where* plasticity is allowed to happen, so the system can decide on the fly which connections should be writing memories right now.',
      'Around this sit other backprop alternatives: predictive coding (Friston; Rao & Ballard), where each layer tries to predict the one below and only passes its surprise upward, and Hinton’s Forward-Forward, which replaces the backward pass with a second forward pass on contrasting data. All of it is elegant, biologically grounded, and — at the scale where modern systems are judged — still losing. That is precisely why the thread stays open.',
    ],
    figure: {
      id: 'neuromod-plasticity',
      caption:
        'A small network under two input contexts. Toggle the neuromodulator and watch which connections become plastic — they light amber — change. The system is tuning its own learning, locally, with no global backward pass.',
      description:
        'A small graph of neurons and connections. A neuromodulator control switches between contexts. When it is on, a network-generated gating signal selects a subset of connections that become plastic; those highlight in amber and visibly strengthen with correlated activity. Switching context moves the plastic set elsewhere, showing local, gated, self-directed learning.',
      spec: 'fig.03 // local plasticity',
    },
  },
  {
    id: 'ch4-emergence',
    num: '04',
    kicker: 'The crux',
    title: 'Emergence: when the intelligence is in the interaction',
    dek: 'Some adaptive capability is irreducibly collective. You cannot move it into a single richer unit.',
    lean: 'bio',
    body: [
      'Neural Cellular Automata (Mordvintsev et al., Growing Neural Cellular Automata, Distill 2020) are the cleanest demonstration in the field. A grid of cells, each running one identical local rule that looks only at its neighbours, grows a target image from a single seed — and, remarkably, repairs that image after you damage it. Nobody told the cells what the whole was supposed to look like. The shape, and the healing, emerge from the rule plus the interaction.',
      'This is where the running test of this essay earns its keep: *is the magic in the unit, or in the interaction?* Here the answer is unambiguous. Self-repair is not a property any cell has. It exists only *because* there are many cells running the same rule at once. You could not relocate it into one richer, cleverer unit no matter how much you enlarged that unit, because the capability is not a thing a unit can hold. It is irreducibly collective.',
      'Keep that distinction. Much of what looks like intelligence in adaptive systems lives in the interaction, and the bitter lesson — Sutton’s 2019 observation that structured, hand-designed cleverness keeps losing to simple methods given more compute — bites hardest exactly when people try to engineer the magic into the unit instead of letting it emerge.',
    ],
    figure: {
      id: 'living-organism',
      caption:
        'The hero organism, now with its controls exposed: grow from seed, paint damage, and toggle a view that proves every cell is running the same rule.',
      description:
        'The same growing automaton as the hero, with explicit controls. One control regrows the organism from a single central seed. A damage brush lets you erase regions, which then heal. A “same rule everywhere” toggle tints all cells to show they share one identical update rule — the form and its self-repair come from their interaction, not from any individual cell.',
      spec: 'fig.04 // neural cellular automata',
    },
  },
  {
    id: 'ch5-mapping',
    num: '05',
    kicker: 'First principles, meet the literature',
    title: 'The intuitions, mapped to their real names',
    dek: 'Four intuitions a curious person reaches on their own — and the research each one turns out to be.',
    lean: 'neutral',
    body: [
      'If you reason about adaptive machines from scratch, you keep rediscovering real research. That is a good sign: the intuitions are reconstructing genuine structure. Here are four of them, named.',
    ],
    subBlocks: [
      {
        intuition:
          '“Pair a stable core with volatile adaptive parts that switch on and off.”',
        realName: 'Conditional computation / Mixture-of-Experts — and the stability–plasticity dilemma',
        body:
          'This is Mixture-of-Experts routing: a stable backbone plus many expert sub-networks, of which only a few fire per token. The honest caveat: the experts are not human-legible specialists. Routing is per-token and the experts specialise in alien ways that rarely map onto concepts you would name. Deeper still, all of this is one face of the central unsolved problem — the stability–plasticity dilemma. Adapt fast and you are unstable and forget; stay stable and you cannot adapt. Every adaptive system is negotiating that knife-edge.',
        figure: {
          id: 'stability-plasticity',
          caption:
            'One slider from rigid to chaotic. The narrow band in the middle is the only place a system both learns and remembers. Read the live learning-versus-retention meters as you move it.',
          description:
            'A horizontal slider runs from “rigid (cannot learn)” on one end to “chaotic (forgets everything)” on the other. Two meters track learning ability and retention. Toward rigid, retention is high but learning is near zero; toward chaotic, learning spikes but retention collapses. Only a narrow highlighted band near the middle keeps both reasonably high.',
          spec: 'fig.05a // stability–plasticity',
        },
      },
      {
        intuition: '“Use a simpler, reliable model to verify the smarter one.”',
        realName: 'Weak-to-strong generalization / scalable oversight',
        body:
          'This is one of the most important live ideas in the field, and it rests on a real asymmetry: verification is often far easier than generation. The research names are weak-to-strong generalization and scalable oversight — can a weaker model we *can* check supervise a stronger model we *cannot* fully check, and have the strong model end up reliable? If yes, oversight scales past the point where humans can grade the answer directly.',
        figure: {
          id: 'generate-verify',
          caption:
            'Generating a path through the maze animates slowly — search is hard. Checking a proposed path flashes valid or invalid at once — verification is cheap. The gap is the whole idea.',
          description:
            'A grid maze. Pressing generate runs a slow search that gradually explores cells before finding a route. Pressing verify takes an already-proposed route and instantly highlights it as valid or invalid in a single flash. The visual contrast dramatises that checking a solution is far cheaper than producing one. Rendered in violet to mark the oversight theme.',
          spec: 'fig.05b // generate vs verify',
        },
      },
      {
        intuition: '“What if a neuron had more nodes inside it?”',
        realName: 'Dendritic computation; capsule networks',
        body:
          'A single cortical neuron is not a simple summation unit. Its dendrites do their own nonlinear processing, and capturing the input–output behaviour of *one* such neuron takes a five-to-eight-layer artificial network (Beniaguev, Segev & London, Neuron 2021). So the intuition is right: the biological unit really does have a network inside it. Capsule networks were another attempt at units with rich internal structure. The catch, as ever, is that richer units are exactly what current hardware is worst at running efficiently.',
        figure: {
          id: 'dendritic-unfold',
          caption:
            'Click the dot labelled “neuron.” It unfolds into the multi-layer network you would need to imitate it, then folds back. One biological unit, a whole model inside.',
          description:
            'A single dot is labelled “neuron.” Activating it animates an unfold: the dot expands into a five-to-eight-layer artificial neural network with visible nodes and connections, illustrating that one cortical neuron’s behaviour requires a deep network to reproduce. It then collapses back to the single dot.',
          spec: 'fig.05c // dendritic computation',
        },
      },
      {
        intuition: '“Connections should have a spectrum of strengths.”',
        realName: 'Weights — and Kolmogorov–Arnold Networks',
        body:
          'That spectrum of strengths is exactly what a weight is: a continuous connection strength. Reconstructing it from scratch is another sign the intuition is tracking real structure. The richer version exists too. Kolmogorov–Arnold Networks (Liu et al.) put learnable *functions* on the edges instead of single numbers, and graph networks carry typed, structured features on their edges. The connection stops being a scalar and becomes a small adjustable shape.',
        figure: {
          id: 'edge-to-function',
          caption:
            'A single edge whose weight is one number. Watch the number morph into a small learnable curve — a KAN-style edge. A scalar becomes a function.',
          description:
            'Two nodes joined by one edge. The edge initially shows a single numeric weight. On activation, that number transforms into a small plotted curve sitting on the edge, representing a learnable function rather than a scalar — the Kolmogorov–Arnold idea that the connection itself can be a shape.',
          spec: 'fig.05d // a number becomes a function',
        },
      },
    ],
  },
  {
    id: 'ch6-wall',
    num: '06',
    kicker: 'The wall',
    title: 'Physics and the hardware lottery',
    dek: 'The elegant ideas keep losing partly because the hardware rewards uniformity — and partly because physics is closing the easy exits.',
    lean: 'silicon',
    body: [
      'Start with the uncomfortable part. Which research ideas win is shaped less by which are best and more by which fit the hardware we already built. Sara Hooker called this the hardware lottery (2020). GPUs love dense, regular, parallel matrix multiplies and punish anything irregular, conditional, or different per unit. Most of the brain-inspired ideas in this essay are exactly the irregular, conditional, per-unit-different kind. They are not losing only on merit. They are losing the lottery.',
      'Then there are the physics walls on conventional chips. Dennard scaling — the rule that let transistors get smaller *and* cooler together — ended around 2005, which is why clock speeds stopped climbing and we hit a power wall and “dark silicon,” parts of a chip that cannot all be powered at once. Moore’s law has slowed as features shrink toward the size of atoms, where gates are thin enough that electrons leak across them by quantum tunnelling.',
      'The quieter wall is the expensive one. Moving data costs far more energy than the arithmetic does — charging long wires to shuttle numbers between memory and compute dwarfs the cost of the multiply itself. That is the memory wall. And underneath everything sits Landauer’s limit: thermodynamics says erasing one bit must dump at least about kT·ln2 of heat — roughly 3×10⁻²¹ joules at room temperature — so any computer that throws information away has a hard floor on its energy use, no matter how clever the engineering.',
    ],
    figure: {
      id: 'energy-budget',
      caption:
        'Two honest figures. Left: the brain’s ~20 watts against the energy of a large training run, on a log scale. Right: where the energy of a single operation actually goes — data movement dwarfing the arithmetic. That second bar is the memory wall.',
      description:
        'Two linked charts. The first is a logarithmic bar comparison of energy: roughly twenty watts for the human brain against the megawatt-hour scale of a large model training run, with honest log-scale labelling. The second splits the energy of a typical operation into data movement versus compute, with data movement vastly larger, illustrating the memory wall. An optional chip schematic shades “dark silicon” regions that cannot all be powered simultaneously.',
      spec: 'fig.06 // the energy walls',
    },
  },
  {
    id: 'ch7-neuromorphic',
    num: '07',
    kicker: 'The alternative',
    title: 'Neuromorphic: stop hiding from physics',
    dek: 'Abandon the von Neumann split and the efficiency comes back — along with all the analog mess digital spent decades escaping.',
    lean: 'bio',
    body: [
      'Neuromorphic chips give up the clean separation between memory and compute and copy brain-like principles instead. Three pillars carry the idea. First, event-driven spiking: a unit computes only when a spike arrives, so on sparse input most of the chip sits idle and the energy bill collapses. Second, co-located memory and compute: the synapse both stores its weight and does its multiply in place, which kills the memory wall by never moving the data. Third, analog compute that uses physics directly — Ohm’s law *is* multiplication and Kirchhoff’s current law *is* summation, so a memristor crossbar performs an entire matrix-vector multiply in a single physical step, no clocked arithmetic at all.',
      'Real chips exist: Intel’s Loihi 2, IBM’s TrueNorth and NorthPole, Manchester’s SpiNNaker, Heidelberg’s BrainScaleS. They are not vapour.',
      'The honest catch is large. Reclaiming brain-like efficiency means re-embracing analog mess: device noise, temperature drift, device-to-device variability, components that wear out with use, and spikes that are not differentiable, which makes the gradient-based training that powers everything else awkward to apply. Digital won decades ago precisely by *hiding* from physics behind a clean, discrete abstraction. Neuromorphic’s promise and its curse are the same fact: it stops hiding.',
    ],
    figure: {
      id: 'spiking-vs-clocked',
      caption:
        'Left, a clocked digital chip: fully lit every tick. Right, a spiking chip: mostly dark, flaring only on sparse events, with an energy counter that runs far lower. Below, a memristor crossbar does a matrix-vector multiply in physics — and a noise slider degrades the result as you turn it up.',
      description:
        'Two chip grids side by side. The clocked digital chip lights every cell on every clock tick, accruing energy steadily. The spiking chip stays mostly dark and only flashes cells when events occur, so its live energy counter stays far below the digital one. Beneath them, a memristor crossbar computes a matrix-vector product through conductances; a noise slider visibly corrupts the output as it rises, making the efficiency-versus-reliability trade-off tangible.',
      spec: 'fig.07 // event-driven vs clocked',
    },
  },
  {
    id: 'ch8-synthesis',
    num: '08',
    kicker: 'The synthesis',
    title: 'When does any of this matter?',
    dek: 'While the binding constraint is capability, brute force wins. The brain-like thread becomes mandatory only when the constraint flips to energy.',
    lean: 'neutral',
    body: [
      'Here is the honest resolution. As long as the thing holding AI back is *capability* — can the system do the task at all — brute-force digital scaling keeps winning, and the bitter lesson holds. Pouring more data and compute into a simple, hardware-friendly architecture beats the elegant brain-inspired alternative almost every time, because the elegant alternative is fighting the hardware lottery the whole way.',
      'The brain-like thread stops being optional only when the binding constraint flips from capability to *energy*. At that point the twenty-watt brain stops being a nice benchmark to admire and becomes the spec sheet everyone has to hit. When you cannot get more power, the only way forward is to compute more per joule — and that is exactly the regime the neuromorphic, event-driven, analog ideas were built for.',
      'So the question to leave you with is not “which architecture is best.” It is shaped like the whole essay: what would adaptive architectures look like if they were co-designed *with* the hardware from the start, instead of forced onto hardware built for something else? Nobody has built that machine yet. When energy becomes the wall, somebody will have to.',
    ],
    figure: {
      id: 'constraint-dial',
      caption:
        'One dial: capability-bound or energy-bound. As you turn it toward energy, the page’s accent balance shifts from phosphor toward synapse — silicon’s advantage giving way to biology’s. The argument, made physical.',
      description:
        'A single large dial with two labelled positions: capability-bound and energy-bound. Turning it toward capability fills the scene with cool phosphor and a note that brute-force digital wins. Turning it toward energy shifts the accent balance toward warm synapse amber and a note that brain-like, energy-first designs become mandatory. The figure ends on text rather than spectacle.',
      spec: 'fig.08 // the constraint dial',
    },
  },
];

export interface Reference {
  authors: string;
  title: string;
  year?: string;
  href?: string;
}

/* Real sources only. Links point to canonical/official pages; where unsure,
   the entry is plain text. No invented citations. */
export const references: Reference[] = [
  { authors: 'Rich Sutton', title: 'The Bitter Lesson', year: '2019', href: 'http://www.incompleteideas.net/IncIdeas/BitterLesson.html' },
  { authors: 'Chen, Rubanova, Bettencourt & Duvenaud', title: 'Neural Ordinary Differential Equations', year: '2018', href: 'https://arxiv.org/abs/1806.07366' },
  { authors: 'Hasani, Lechner, Amini, Rus & Grosu', title: 'Liquid Time-constant Networks', year: '2020', href: 'https://arxiv.org/abs/2006.04439' },
  { authors: 'Gu & Dao', title: 'Mamba: Linear-Time Sequence Modeling with Selective State Spaces', year: '2023', href: 'https://arxiv.org/abs/2312.00752' },
  { authors: 'Mordvintsev, Randazzo, Niklasson & Levin', title: 'Growing Neural Cellular Automata (Distill)', year: '2020', href: 'https://distill.pub/2020/growing-ca/' },
  { authors: 'Miconi, Stanley & Clune', title: 'Differentiable plasticity / Backpropamine', year: '2018–2019', href: 'https://arxiv.org/abs/1804.02464' },
  { authors: 'Beniaguev, Segev & London', title: 'Single Cortical Neurons as Deep Artificial Neural Networks (Neuron)', year: '2021', href: 'https://www.cell.com/neuron/fulltext/S0896-6273(21)00501-8' },
  { authors: 'Liu et al.', title: 'KAN: Kolmogorov–Arnold Networks', year: '2024', href: 'https://arxiv.org/abs/2404.19756' },
  { authors: 'Sara Hooker', title: 'The Hardware Lottery', year: '2020', href: 'https://arxiv.org/abs/2009.06489' },
];
