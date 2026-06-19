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

  function destroy() {
    stop();
    io.disconnect();
    ro.disconnect();
    if (mq.removeEventListener) mq.removeEventListener('change', onMq);
  }

  return { start, stop, step, render, destroy, env, resize };
}

/** Small helper: clamp a number to [a, b]. */
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/** Linear interpolate. */
export const lerp = (a, b, t) => a + (b - a) * t;

/** Map x from [a,b] to [c,d]. */
export const mapRange = (x, a, b, c, d) => c + ((x - a) * (d - c)) / (b - a);

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
    phosphor: token('--phosphor', '#5bd6c0'),
    synapse: token('--synapse', '#e2864b'),
    graphite: token('--graphite', '#38474c'),
    oversight: token('--oversight', '#8e83d6'),
  };
}
