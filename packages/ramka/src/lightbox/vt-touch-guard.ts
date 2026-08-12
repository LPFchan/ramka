// ---------------------------------------------------------------------------
// Document-level touch-pan guard, held while a lightbox View Transition runs.
//
// Why it exists: on iOS Safari, when the page has been scrolled down (address
// bar collapsed) and the user pans upward DURING the open/close morph, Safari
// expands its address bar — resizing the viewport mid-transition, which
// glitches or skips the morph.
//
// Why nothing lighter works: while a document view transition is running, the
// ::view-transition pseudo tree covers the viewport, and because the morph
// keeps :root captured (the page-behind cross-fade is the root group), hit
// testing for the whole captured page resolves to the <html> element itself
// (see w3c/csswg-drafts#8278). Content's pull-to-dismiss handlers and its
// `overscroll-behavior: contain` boundary never see the touch, and Safari
// treats the pan as a scroll gesture on the root scroller — browser-chrome
// expansion is NOT stopped by the `overflow: hidden` scroll lock, and a
// Silk-style inner "scroll trap" element can't catch a gesture that never
// hit-tests into the DOM.
//
// The one reliable veto is to cancel the touchmove stream itself: when the
// first touchmove of a gesture is preventDefault-ed, the browser never starts
// a scroll and never moves its chrome (the same technique Content already
// uses to block native pinch-zoom while mounted). The guard is capture-phase
// and non-passive, and held only for the morph's duration — including the
// open morph's pre-transition prepare/decode wait, when the viewer is still
// `visibility: hidden` (non-hit-testable) and the page is not yet locked.
//
// Ref-counted because morphs from different Roots can overlap (opening
// lightbox B while A's close morph is in flight). If a finger is still down
// when the last hold is released, teardown is deferred to the gesture's final
// touchend/touchcancel: releasing mid-gesture would let the remaining moves
// start a scroll the instant the transition ends, expanding the bar after
// all. Nothing is lost by holding on — that touch's target was frozen at
// touchstart (the stale <html> / VT overlay), so it could never become a
// meaningful gesture for the live DOM anyway.
// ---------------------------------------------------------------------------

let holdCount = 0;
let attached = false;
/** A touch that began while the guard was attached is still on screen. */
let touchInFlight = false;

function onTouchStart(): void {
  touchInFlight = true;
}

function onTouchMove(event: TouchEvent): void {
  // Non-cancelable moves belong to a scroll the browser already committed to
  // (a gesture predating the guard) — preventDefault would only warn.
  if (event.cancelable) {
    event.preventDefault();
  }
}

function onTouchSettled(event: TouchEvent): void {
  if (event.touches.length > 0) return;
  touchInFlight = false;
  if (holdCount === 0) {
    detach();
  }
}

function attach(): void {
  if (attached) return;
  attached = true;
  touchInFlight = false;
  document.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
  document.addEventListener('touchmove', onTouchMove, { capture: true, passive: false });
  document.addEventListener('touchend', onTouchSettled, { capture: true, passive: true });
  document.addEventListener('touchcancel', onTouchSettled, { capture: true, passive: true });
}

function detach(): void {
  if (!attached) return;
  attached = false;
  document.removeEventListener('touchstart', onTouchStart, { capture: true });
  document.removeEventListener('touchmove', onTouchMove, { capture: true });
  document.removeEventListener('touchend', onTouchSettled, { capture: true });
  document.removeEventListener('touchcancel', onTouchSettled, { capture: true });
}

/**
 * Hold the touch-pan guard for the duration of a View Transition morph.
 * Returns an idempotent release function — safe to call from both a morph's
 * early-bail paths and its `finished` finalizer.
 */
function acquireVtTouchGuard(): () => void {
  if (typeof document === 'undefined') {
    return () => {};
  }
  holdCount += 1;
  attach();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holdCount -= 1;
    // Defer teardown while a finger is still down (see module comment).
    if (holdCount === 0 && !touchInFlight) {
      detach();
    }
  };
}

/**
 * Test-only: drop all holds and detach. Unit tests mock `startViewTransition`
 * with a `finished` promise they never resolve, which would leak a hold into
 * subsequent tests (in a real browser `finished` always settles, even for
 * skipped transitions).
 */
function resetVtTouchGuardForTesting(): void {
  holdCount = 0;
  detach();
}

export { acquireVtTouchGuard, resetVtTouchGuardForTesting };
