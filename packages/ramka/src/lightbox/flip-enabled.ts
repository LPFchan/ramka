/**
 * Engine selector for the experimental FLIP morph (see flip-morph.ts).
 *
 * Kept in its own module — and out of the lazily loaded morph chunk — because
 * `Lightbox.Root` has to read it synchronously inside the click handler to
 * decide whether the View Transition capability gate applies at all. The FLIP
 * engine needs no `startViewTransition`, so it must not be gated behind it.
 *
 * `window.__RAMKA_FLIP__ = true` (docs: `?flip`) opts in. Off by default:
 * the View Transition morph is still what ships.
 */
function isFlipMorphEnabled(): boolean {
  return (
    typeof window !== 'undefined' &&
    (window as unknown as Record<string, unknown>).__RAMKA_FLIP__ === true
  );
}

/**
 * Whether the FLIP engine should run this morph.
 *
 * Reduced motion is the only capability check it has: no `startViewTransition`
 * requirement (it animates real elements) and no low-end-device opt-out (the
 * VT engine needs one because a document capture rasterizes the entire page
 * twice; two elements do not).
 */
function shouldUseFlipMorph(): boolean {
  if (!isFlipMorphEnabled()) return false;
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export { isFlipMorphEnabled, shouldUseFlipMorph };
