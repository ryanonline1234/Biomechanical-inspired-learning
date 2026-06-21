/* =====================================================================
   Shared canvas lifecycle helpers.
   Every figure is a self-contained module that uses createFigure() so we
   get, for free and consistently:
     - DPR-capped, ResizeObserver-driven sizing
     - IntersectionObserver pause when off-screen (perf floor)
     - a single rAF loop with delta time
     - prefers-reduced-motion handling: no autoplay, one static frame,
       and an optional manual "step" affordance
   ===================================================================== */

/** Live check — re-evaluated each call so it responds to OS setting changes. */
export function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Cap devicePixelRatio so retina/4k displays don't melt the fill rate. */
export function dpr(max = 2) {
  if (typeof window === 'undefined') return 1;
  return Math.min(window.devicePixelRatio || 1, max);
}

/**
 * Create a managed canvas figure.
 *
 * @param {object} o
 * @param {HTMLCanvasElement} o.canvas
 * @param {(env: FigureEnv) => void} [o.setup]   one-time init once sized
 * @param {(dt: number, env: FigureEnv) => void} [o.update]  advance state
 * @param {(env: FigureEnv) => void} o.draw       render current state
 * @param {boolean} [o.autoplay=true]            loop when visible & motion ok
 * @param {number} [o.maxDpr=2]
 * @returns {FigureController}
 *
 * @typedef {object} FigureEnv
 * @property {CanvasRenderingContext2D} ctx
 * @property {number} w   CSS pixels (logical width)
 * @property {number} h   CSS pixels (logical height)
 * @property {number} t   elapsed seconds since first frame
 * @property {boolean} reduced  prefers-reduced-motion is on
 *
 * @typedef {object} FigureController
 * @property {() => void} start
 * @property {() => void} stop
 * @property {() => void} step    advance + draw exactly one frame (manual)
 * @property {() => void} render  redraw without advancing
 * @property {() => void} destroy
 * @property {FigureEnv} env
 */
export function createFigure(o) {
  const { canvas, setup, update, draw, autoplay = true, maxDpr = 2 } = o;
  const ctx = canvas.getContext('2d', { alpha: true });

  const env = /** @type {FigureEnv} */ ({
    ctx,
    w: 0,
    h: 0,
    t: 0,
    reduced: prefersReducedMotion(),
  });

  let raf = 0;
  let last = 0;
  let running = false;
  let visible = true;
  let didSetup = false;
  let destroyed = false;
  let ratio = dpr(maxDpr);

  function resize() {
    const rect = canvas.getBoundingClientRect();
    // Fall back to attribute/parent size when not yet laid out.
    const cssW = Math.max(1, Math.round(rect.width || canvas.clientWidth || 300));
    const cssH = Math.max(1, Math.round(rect.height || canvas.clientHeight || 200));
    ratio = dpr(maxDpr);
    env.w = cssW;
    env.h = cssH;
    canvas.width = Math.round(cssW * ratio);
    canvas.height = Math.round(cssH * ratio);
    // Draw in CSS-pixel coordinates; ratio handles the device scaling.
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    if (!didSetup && setup) {
      setup(env);
      didSetup = true;
    }
    // Always repaint after a resize, even when paused.
    if (draw) draw(env);
  }

  function frame(now) {
    if (!running) return;
    if (!last) last = now;
    // Clamp dt so a backgrounded tab doesn't produce a huge jump.
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    env.t += dt;
    if (update) update(dt, env);
    if (draw) draw(env);
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    if (env.reduced || !autoplay) {
      // No autoplay under reduced motion: render one honest static frame.
      if (draw) draw(env);
      return;
    }
    if (!visible) return;
    running = true;
    last = 0;
    raf = requestAnimationFrame(frame);
  }

  /**
   * Force the rAF loop to run regardless of `autoplay`. This is the affordance
   * for figures that are otherwise still but animate a transient on demand
   * (a click-driven morph, a slider release). `start()` deliberately refuses to
   * loop when autoplay is off; `play()` is the explicit "run it now" override.
   * Reduced motion still never loops — it paints one honest frame instead.
   * The figure is responsible for calling `stop()` when its transient settles.
   */
  function play() {
    if (running) return;
    if (env.reduced) {
      if (draw) draw(env);
      return;
    }
    running = true;
    last = 0;
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function step() {
    // Manual single advance — the reduced-motion / keyboard affordance.
    if (update) update(1 / 60, env);
    env.t += 1 / 60;
    if (draw) draw(env);
  }

  function render() {
    if (draw) draw(env);
  }

  // Pause when scrolled out of view; resume when back. The performance floor.
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        visible = e.isIntersecting;
        if (visible) start();
        else stop();
      }
    },
    { rootMargin: '120px' }
  );
  io.observe(canvas);

  const ro = new ResizeObserver(() => resize());
  ro.observe(canvas);

  // React to a live change of the motion preference.
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const onMq = () => {
    env.reduced = mq.matches;
    if (env.reduced) stop();
    else start();
    render();
  };
  if (mq.addEventListener) mq.addEventListener('change', onMq);

  // Initial size + paint on next frame so layout has settled.
  requestAnimationFrame(resize);

  // FOUT guard: canvas text measured before the web fonts load uses the system
  // fallback and never reflows. When the real fonts are ready, repaint once so
  // labels land in the right font/metrics (matters most for static frames that
  // never loop). Guard against a figure destroyed before the promise settles.
  if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      if (!destroyed && draw) draw(env);
    });
  }

  function destroy() {
    destroyed = true;
    stop();
    io.disconnect();
    ro.disconnect();
    if (mq.removeEventListener) mq.removeEventListener('change', onMq);
  }

  return { start, play, stop, step, render, destroy, env, resize };
}

/** Small helper: clamp a number to [a, b]. */
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/** Linear interpolate. */
export const lerp = (a, b, t) => a + (b - a) * t;

/** Map x from [a,b] to [c,d]. */
export const mapRange = (x, a, b, c, d) => c + ((x - a) * (d - c)) / (b - a);

/* =====================================================================
   Motion tokens + a spring.
   Shared so figures stop inventing magic numbers and so interactive
   responses SETTLE instead of snapping. These are the canvas analogue of
   the project's CSS easing tokens. update(dt) runs in SECONDS.
   ===================================================================== */

/** Durations in seconds, matched to the project's UI-motion scale. */
export const DUR = {
  micro: 0.15, // a toggle blip
  ui: 0.25,    // a small reveal
  base: 0.45,  // a morph / unfold
  sweep: 0.9,  // a one-shot traversal of the whole figure
};

/** Spring response times (seconds-to-arrive); pass to makeSpring(). */
export const SPRING = { snappy: 0.34, gentle: 0.5, lazy: 0.7 };

// Easing curves, t in [0,1]. Names mirror the CSS intents:
//   easeOut   = decelerate — for things ARRIVING / revealing
//   easeIn    = accelerate — for things LEAVING / folding away
//   easeInOut = standard   — symmetric A<->B moves and one-shot sweeps
export const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
export const easeIn = (t) => { const u = clamp(t, 0, 1); return u * u * u; };
export const easeInOut = (t) => {
  const u = clamp(t, 0, 1);
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
};
/** Direction-aware easing: ease-out while opening (dir>=0), ease-in while closing. */
export const easeDir = (t, opening) => (opening ? easeOut(t) : easeIn(t));

/**
 * A critically-damped spring. Settles toward a target with NO overshoot, so an
 * animated data value (a needle, a meter, a curve parameter) never momentarily
 * shows a wrong reading. Uses the exact analytic solution of the critically-
 * damped ODE, so it is unconditionally stable and re-aims smoothly mid-flight
 * (the difference between "alive" and "snapping").
 *
 *   const s = makeSpring(SPRING.snappy, start);
 *   s.to(target);          // re-aim, keeps momentum
 *   s.step(dt) -> value;   // advance one frame
 *   s.snap(v);             // jump instantly (reduced motion)
 *   s.settled();           // true once it has effectively arrived
 */
export function makeSpring(response = SPRING.snappy, initial = 0) {
  // omega chosen so `response` ≈ time to settle to within ~2%.
  let omega = 6 / Math.max(0.01, response);
  let pos = initial;
  let vel = 0;
  let target = initial;
  return {
    get value() { return pos; },
    to(t) { target = t; },
    snap(v) { pos = v; target = v; vel = 0; },
    setResponse(r) { omega = 6 / Math.max(0.01, r); },
    step(dt) {
      const d = Math.min(Math.max(dt, 0), 0.05);
      const a = pos - target;
      const b = vel + omega * a;
      const e = Math.exp(-omega * d);
      pos = target + (a + b * d) * e;
      vel = (b - omega * (a + b * d)) * e;
      return pos;
    },
    settled(eps = 0.0015) {
      return Math.abs(target - pos) < eps && Math.abs(vel) < eps;
    },
  };
}

/** Parse a #rrggbb (or token-resolved) color to {r,g,b}. */
export function hexToRgb(hex) {
  const h = hex.trim().replace('#', '');
  const n = parseInt(
    h.length === 3
      ? h.split('').map((c) => c + c).join('')
      : h,
    16
  );
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** rgba() string from an {r,g,b} and alpha. */
export const rgba = ({ r, g, b }, a = 1) => `rgba(${r},${g},${b},${a})`;

/** Resolve a CSS custom property to its computed value (for canvas use). */
export function token(name, fallback = '#000') {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v || fallback;
}

/** The shared palette, resolved once for canvas drawing. */
export function palette() {
  return {
    ink: token('--ink', '#0b1418'),
    bone: token('--bone', '#ece4d6'),
    boneDim: token('--bone-dim', '#b9b09f'),
    phosphor: token('--phosphor', '#5bd6c0'),
    synapse: token('--synapse', '#e2864b'),
    graphite: token('--graphite', '#38474c'),
    oversight: token('--oversight', '#8e83d6'),
  };
}

/* =====================================================================
   Shared canvas type system.
   Three tiers so every figure converges on one treatment instead of
   ad-hoc font strings. Only the weights actually loaded by the layout are
   used (Space Grotesk 400-700, Spline Sans Mono 400/500 — mono 600 is NOT
   loaded, so we never ask for it: that "bold mono" only renders as a
   browser-synthesised faux-bold).

     title : the figure's voice / thesis line   — display grotesque, 600
     label : section + axis labels (the chrome)  — mono 500, UPPERCASE, tracked
     data  : live readouts / values next to marks — mono 500, as-is
   ===================================================================== */
export const TYPE = {
  title: { family: "'Space Grotesk', system-ui, sans-serif", size: 13, weight: 600, tracking: 0, upper: false },
  label: { family: "'Spline Sans Mono', ui-monospace, monospace", size: 10.5, weight: 500, tracking: 0.08, upper: true },
  data:  { family: "'Spline Sans Mono', ui-monospace, monospace", size: 11, weight: 500, tracking: 0, upper: false },
};

/** Build a canvas `font` string for a tier (for ctx.font / measureText). */
export function fontFor(tier, size) {
  const t = TYPE[tier] || TYPE.data;
  return `${t.weight} ${size || t.size}px ${t.family}`;
}

/**
 * Draw a label in one of the three tiers, handling font, tracking, casing,
 * colour, alignment and alpha — and always restoring canvas state (so the
 * letterSpacing never leaks into the next draw call).
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {'title'|'label'|'data'} tier
 * @param {string} text
 * @param {number} x @param {number} y
 * @param {object} [o]  {color, align, baseline, alpha, size, weight, tracking, upper}
 */
export function drawText(ctx, tier, text, x, y, o = {}) {
  const t = TYPE[tier] || TYPE.data;
  const size = o.size != null ? o.size : t.size;
  const weight = o.weight != null ? o.weight : t.weight;
  const trackEm = o.tracking != null ? o.tracking : t.tracking;
  const upper = o.upper != null ? o.upper : t.upper;
  ctx.save();
  ctx.font = `${weight} ${size}px ${t.family}`;
  // letterSpacing is a modern canvas property; restore() resets it.
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${(trackEm * size).toFixed(2)}px`;
  if (o.align) ctx.textAlign = o.align;
  if (o.baseline) ctx.textBaseline = o.baseline;
  if (o.alpha != null) ctx.globalAlpha = o.alpha;
  ctx.fillStyle = o.color || '#ece4d6';
  ctx.fillText(upper ? String(text).toUpperCase() : String(text), x, y);
  ctx.restore();
}
