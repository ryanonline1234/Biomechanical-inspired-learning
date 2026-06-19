/* =====================================================================
   Figure registry + lazy loader.
   Each figure module exports a default mount(stage) that builds its own
   canvas drawing + controls inside the .figure__stage element. We only
   import a module when its figure nears the viewport, keeping JS lean.
   ===================================================================== */

const registry = {
  'living-organism': () => import('./LivingOrganism.js'),
  'phase-flow': () => import('./PhaseFlow.js'),
  'liquid-neuron': () => import('./LiquidNeuron.js'),
  'mamba-selective': () => import('./MambaSelective.js'),
  'neuromod-plasticity': () => import('./NeuromodPlasticity.js'),
  'stability-plasticity': () => import('./StabilityPlasticity.js'),
  'generate-verify': () => import('./GenerateVerify.js'),
  'dendritic-unfold': () => import('./DendriticUnfold.js'),
  'edge-to-function': () => import('./EdgeToFunction.js'),
  'energy-budget': () => import('./EnergyBudget.js'),
  'spiking-vs-clocked': () => import('./SpikingVsClocked.js'),
  'constraint-dial': () => import('./ConstraintDial.js'),
};

export function initFigures() {
  const stages = document.querySelectorAll('[data-figure]');
  if (!stages.length) return;

  const io = new IntersectionObserver(
    (entries, obs) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const stage = e.target;
        obs.unobserve(stage);
        const id = stage.dataset.figure;
        const load = registry[id];
        if (!load) continue;
        load()
          .then((mod) => {
            try {
              const controller = mod.default(stage);
              // Stash for potential debugging / teardown.
              stage._figure = controller;
            } catch (err) {
              console.error(`figure "${id}" failed to mount`, err);
            }
          })
          .catch((err) => console.error(`figure "${id}" failed to load`, err));
      }
    },
    { rootMargin: '300px 0px' }
  );

  stages.forEach((s) => io.observe(s));
}
