// ---------------------------------------------------------------------------
// Pre-capture frame yield for heavy documents.
//
// `startViewTransition`'s old-state capture runs a full "update the
// rendering" synchronously in the calling task. Initiated straight from an
// input task (click open, Escape close), that capture re-pays whatever the
// document has pending — the prepared viewer's first style/layout/compositing
// digestion on open, the old snapshot's paint + layerization on close — all
// inside the input task, which is a direct INP hit. The same capture
// initiated from a rAF callback runs inside that frame's rendering update:
// the pending work lands in a rendering task (where the browser would pay it
// anyway to produce the next frame) and the input task returns in
// milliseconds.
//
// WebKit benefits the most (its compositing digestion of a freshly-mounted
// full-viewport overlay measured ~50–80ms at 16k elements vs 1–3ms from rAF
// phase), but the input-task relocation helps every engine, so the gate is
// document size, not engine.
//
// The yield costs one or two frames (~16–32ms) of added latency before the
// morph starts, so on small pages the trade loses; profiling put the
// break-even around a few thousand elements.
// ---------------------------------------------------------------------------

const CAPTURE_YIELD_MIN_ELEMENTS = 2500;

/**
 * Whether the morph should hand `startViewTransition` off to a rAF callback
 * (instead of calling it straight from the input task) — and, on close
 * completion, defer the focus return the same way. True only past the
 * element-count gate above.
 */
function shouldYieldBeforeCapture(doc: Document | undefined = typeof document === 'undefined' ? undefined : document): boolean {
  if (!doc) return false;
  return doc.getElementsByTagName('*').length >= CAPTURE_YIELD_MIN_ELEMENTS;
}

/**
 * Resolves inside an upcoming rAF callback, so a `startViewTransition` call
 * that follows synchronously captures within that frame's rendering update.
 *
 * `frames: 2` (double rAF) additionally lets one full frame render first —
 * needed when the hidden viewer was mounted in the current task and the
 * engine hasn't digested it yet. `frames: 1` suffices when real time has
 * already passed since the mount (an image-decode or consumer wait produced
 * rendered frames): nothing is pending, the capture only needs to run from
 * rAF phase rather than from the input task.
 */
function afterNextRenderFrame(frames: 1 | 2): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      if (frames === 1) {
        resolve();
        return;
      }
      requestAnimationFrame(() => resolve());
    });
  });
}

export { CAPTURE_YIELD_MIN_ELEMENTS, shouldYieldBeforeCapture, afterNextRenderFrame };
