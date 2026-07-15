'use client';

import * as React from 'react';
import { flushSync } from 'react-dom';

import { VIEW_TRANSITION_NAME, findItemMorphTarget, findTriggerMorphTarget } from './lightbox-context';

// ---------------------------------------------------------------------------
// View Transition helpers
// ---------------------------------------------------------------------------

/**
 * Thin wrapper around `document.startViewTransition`. Reads the method off
 * `document` at call time (rather than capturing it) so environments — and
 * tests — that define/replace it after module load still work.
 */
function startViewTransition(
  callback: () => void | Promise<void>,
): { finished: Promise<void> } {
  return (
    document as Document & {
      startViewTransition: (cb: () => void | Promise<void>) => { finished: Promise<void> };
    }
  ).startViewTransition(callback);
}

/**
 * Default upper bound (ms) for how long the open morph waits on the
 * destination image to decode. Used when `awaitImageDecode` is `true`.
 */
const DEFAULT_DECODE_MAX_WAIT = 200;

/**
 * Wait for an image element to decode (pixels composited and ready to paint).
 * If the image is already complete (e.g. served from cache on a re-open),
 * resolves immediately with zero delay. Otherwise waits for `decode()` to
 * finish, bounded by `maxWait` ms so the transition is never blocked
 * for too long on slow connections. Resolves immediately for non-image
 * elements (video, custom HTML).
 *
 * Works with plain `<img>` as well as framework image components (e.g.
 * Next.js `<Image>`) that render a native `<img>` with `srcset`. The
 * browser's `decode()` resolves for whichever source was selected from
 * the srcset. For best results, images inside Lightbox.Item should use
 * `loading="eager"` so the browser starts fetching immediately on mount
 * rather than waiting for a lazy-load intersection.
 */
function waitForImageDecode(
  target: HTMLElement | null,
  maxWait: number = DEFAULT_DECODE_MAX_WAIT,
): Promise<void> {
  if (!target) return Promise.resolve();
  const img =
    target.tagName === 'IMG'
      ? (target as HTMLImageElement)
      : target.querySelector<HTMLImageElement>('img');
  if (!img || !('decode' in img)) return Promise.resolve();
  // Image already loaded (e.g. cached from a previous open) — no wait needed.
  // The VT API captures the snapshot after this callback resolves, so the
  // browser will have composited the cached image by then.
  if (img.complete && img.naturalWidth > 0) return Promise.resolve();
  return new Promise<void>((resolve) => {
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    img.decode().then(settle, settle);
    setTimeout(settle, maxWait);
  });
}

/**
 * Returns the `<img>` the open morph should wait on, or `null` when there's
 * nothing to wait for (no image, no `decode()` support, or already decoded).
 *
 * This lets the caller decide *synchronously* whether an `await` is needed at
 * all. Awaiting an already-resolved promise still yields a microtask, which
 * would turn the open path async even when the destination is ready — deferring
 * `startViewTransition` past the click tick. Checking readiness up front keeps
 * the common (cached / no-image) case fully synchronous.
 */
function getPendingDecodeImage(target: HTMLElement | null): HTMLImageElement | null {
  if (!target) return null;
  const img =
    target.tagName === 'IMG'
      ? (target as HTMLImageElement)
      : target.querySelector<HTMLImageElement>('img');
  if (!img || !('decode' in img)) return null;
  if (img.complete && img.naturalWidth > 0) return null;
  return img;
}

/**
 * Whether the destination morph target has a resolvable size to morph *into*.
 *
 * Uses the target's **rendered box** (`getBoundingClientRect`) rather than the
 * image's `naturalWidth`, because the box is the ground truth for what the View
 * Transition captures — and it's already correct *before* the pixels load
 * whenever the layout is reserved by explicit `width`/`height` attributes or CSS
 * dimensions (e.g. a Next.js `<Image>`). So a sized-but-not-yet-loaded image
 * still morphs correctly.
 *
 * The one case we skip is a genuinely collapsed 0×0 box — an unsized `<img>`
 * whose intrinsic size is its only sizing and which hasn't loaded (decode wait
 * timed out on a slow connection). Morphing into a 0×0 box shrinks the trigger
 * into the corner (Firefox) / center (Chrome), so we fall back to a plain root
 * crossfade instead.
 *
 * Called after the `commitPrepare` mount, so layout is already flushed and this
 * read is cheap. Note the tree is `visibility: hidden` during prepare, which
 * still lays out (unlike `display: none`), so the box is accurate.
 */
function isMorphTargetSizeResolvable(target: HTMLElement | null): boolean {
  if (!target) return false;
  const rect = target.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

// ---------------------------------------------------------------------------
// Trigger resolution (shared with Root's non-VT close paths)
// ---------------------------------------------------------------------------

function scrollTriggerEl(el: HTMLElement | undefined, behavior: ScrollBehavior = 'smooth') {
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const fullyVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;
  if (!fullyVisible) {
    el.scrollIntoView({ block: 'center', behavior });
  }
}

function resolveTriggerIndex(
  activeIndex: number,
  morphTo: 'active' | 'origin' | 'closest',
  openingIndex: number,
  triggerElements: Map<number, HTMLElement>,
): number {
  if (morphTo === 'origin') return openingIndex;
  if (morphTo === 'active' || triggerElements.has(activeIndex)) return activeIndex;
  let best = -1;
  let bestDist = Infinity;
  for (const idx of triggerElements.keys()) {
    const dist = Math.abs(idx - activeIndex);
    if (dist < bestDist) {
      bestDist = dist;
      best = idx;
    }
  }
  return best >= 0 ? best : activeIndex;
}

// ---------------------------------------------------------------------------
// Morph document-state helpers
// ---------------------------------------------------------------------------

/**
 * Applies the document-level state that drives the morph CSS: the phase
 * attribute, the optional no-crossfade opt-out (with its old/new opacity
 * vars), and the from/to border-radius vars. Only defined values are written,
 * matching the original conditional writes.
 */
function applyMorphState(
  docEl: HTMLElement,
  phase: 'opening' | 'closing',
  opts: { useCrossfade: boolean; fromRadius: string | null; toRadius: string | null },
) {
  docEl.setAttribute('data-lightbox-view-transition', phase);
  if (!opts.useCrossfade) {
    docEl.setAttribute('data-lightbox-no-crossfade', '');
    // No-crossfade keeps whichever snapshot is the "source of truth" fully
    // opaque and hard-cuts the other — but we ALWAYS keep the *old* snapshot
    // opaque underneath as a paint fallback, never 0:
    //
    // - Opening: `new` is the destination item, which was `visibility: hidden`
    //   during prepare and only flips visible inside the (synchronous) VT
    //   callback, right before the new snapshot is captured. If that freshly
    //   revealed layer isn't rasterized in time the new snapshot is blank —
    //   and with `old` hidden there's nothing behind it, so you get a one-frame
    //   flash of empty space (independent of image caching; it's a compositing
    //   race). Keeping `old` (the trigger, captured from a fully-painted live
    //   element) at opacity 1 underneath means a blank `new` falls back to the
    //   trigger instead of to nothing. When `new` IS painted it's opaque and
    //   fully covers `old`, so the result is visually identical — this only
    //   ever shows through on the (bad) frame it would otherwise be blank.
    //   `crossfade={false}` is documented for the "same image at different
    //   crops/sizes" case, so the trigger underneath is always a safe fallback.
    // - Closing: `old` is the item (already on-screen and painted), `new` is
    //   the trigger, hard-cut to 0 so a scrolled-away/again-unpainted trigger
    //   can't ghost over the item as it shrinks back.
    docEl.style.setProperty('--lightbox-morph-old-opacity', '1');
    docEl.style.setProperty('--lightbox-morph-new-opacity', phase === 'opening' ? '1' : '0');
  }
  if (opts.fromRadius) {
    docEl.style.setProperty('--lightbox-morph-border-radius-from', opts.fromRadius);
  }
  if (opts.toRadius) {
    docEl.style.setProperty('--lightbox-morph-border-radius-to', opts.toRadius);
  }
}

/**
 * Assigns the morph `view-transition-name` to an element with inline
 * `!important`, plus a `contain: layout paint` boundary. The name: the
 * document-level isolation rule sets `view-transition-name: none !important`
 * on every element while the morph is running (so unrelated consumer-named
 * elements aren't captured); an inline `!important` declaration outranks that
 * author-`!important` rule on specificity, keeping the morph target the sole
 * captured group. The containment: before snapshotting the browser must
 * rasterize the element's layout tree, so scoping style/layout/paint to this
 * element's box keeps snapshot generation from thrashing the rest of the page —
 * the cheap per-element win on low-end GPUs. (Unlike the reverted backdrop/
 * content grouping, this stays inside the single root snapshot — it just adds
 * containment to the one element that already had its own group.)
 */
function setMorphName(el: HTMLElement) {
  el.style.setProperty('view-transition-name', VIEW_TRANSITION_NAME, 'important');
  el.style.setProperty('contain', 'layout paint', 'important');
}

/** Clears the name + containment set by {@link setMorphName}. */
function clearMorphName(el: HTMLElement) {
  el.style.removeProperty('view-transition-name');
  el.style.removeProperty('contain');
}

/** Removes every document-level attribute/var set by {@link applyMorphState}. */
function clearMorphState(docEl: HTMLElement) {
  docEl.removeAttribute('data-lightbox-view-transition');
  docEl.removeAttribute('data-lightbox-no-crossfade');
  docEl.style.removeProperty('--lightbox-morph-old-opacity');
  docEl.style.removeProperty('--lightbox-morph-new-opacity');
  docEl.style.removeProperty('--lightbox-morph-border-radius-from');
  docEl.style.removeProperty('--lightbox-morph-border-radius-to');
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface ViewTransitionMorphConfig {
  morphTo: 'active' | 'origin' | 'closest';
  scrollTriggerIntoView: null | {
    type: 'onChange' | 'onClose';
    behavior?: 'smooth' | 'instant';
  };
  /** Upper bound (ms) to await the destination image decode; 0 disables. */
  decodeMaxWait: number;
  triggerElementsRef: React.RefObject<Map<number, HTMLElement>>;
  /** Trigger element → its designated morph descendant (see findTriggerMorphTarget). */
  triggerMorphElementsRef: React.RefObject<WeakMap<HTMLElement, HTMLElement>>;
  activeItemElementRef: React.RefObject<HTMLElement | null>;
  openingTriggerIndexRef: React.RefObject<number>;
  activeIndexRef: React.RefObject<number>;
  closeGenRef: React.MutableRefObject<number>;
  /**
   * flushSync body that MOUNTS the viewer in a hidden ("preparing") state.
   * Runs before `startViewTransition` so the expensive reconciliation and image
   * decode happen off the transition's render-suppressed path; the hidden tree
   * is absent from the old snapshot.
   */
  commitPrepare: () => void;
  /**
   * flushSync body that reveals the prepared tree and marks the lightbox open.
   * Runs inside the transition callback; a cheap paint-only flip (no mount).
   */
  commitReveal: () => void;
  /** flushSync body that flips React state to the closed/unmounted state. */
  commitClose: () => void;
  /** Fired once the open morph settles (and its generation is still current). */
  onOpenComplete: () => void;
  /**
   * Fired once the close morph settles (and its generation is still current).
   * Receives the resolved trigger element so the caller can restore focus.
   */
  onCloseComplete: (triggerEl: HTMLElement | undefined) => void;
}

interface ViewTransitionMorph {
  open: () => void;
  close: () => void;
}

/**
 * Encapsulates the trigger <-> item View Transition morph mechanics for the
 * lightbox. It owns the `startViewTransition` call, the document-level morph
 * state, the `flushSync` timing, and the generation-guarded completion — but
 * leaves ownership of React state and lifecycle callbacks to the caller via
 * `commitOpen`/`commitClose`/`onOpenComplete`/`onCloseComplete`.
 *
 * The caller is expected to bump `closeGenRef.current` immediately before
 * invoking `open()`/`close()` so each morph captures a fresh generation.
 */
function useViewTransitionMorph(config: ViewTransitionMorphConfig): ViewTransitionMorph {
  // Keep the latest config in a ref so the returned callbacks are stable while
  // always reading fresh values (mirrors the onOpenChangeRef pattern in Root).
  const configRef = React.useRef(config);
  configRef.current = config;

  const open = React.useCallback(async () => {
    const {
      decodeMaxWait,
      triggerElementsRef,
      triggerMorphElementsRef,
      activeItemElementRef,
      openingTriggerIndexRef,
      closeGenRef,
      commitPrepare,
      commitReveal,
    } = configRef.current;

    const docEl = document.documentElement;
    const gen = closeGenRef.current;

    const triggerIdx = openingTriggerIndexRef.current;
    const triggerEl = triggerElementsRef.current.get(triggerIdx);
    const triggerTarget = triggerEl
      ? findTriggerMorphTarget(triggerEl, triggerMorphElementsRef.current)
      : null;
    const useCrossfade = triggerEl?.dataset.crossfade === 'true';

    // Read the trigger's border-radius NOW, before any writes. At this point the
    // page is idle (the click's React state updates are still batched and
    // uncommitted), so this read is served from clean style — no forced reflow.
    // Reading it later (after commitPrepare) would force a full style+layout
    // flush. See LIGHTBOX_PERF.md.
    const fromRadius = triggerTarget ? getComputedStyle(triggerTarget).borderRadius : null;

    // PRE-MOUNT (Guideline #3): build the viewer + gallery NOW, while the page
    // is still live and interactive, so the heavy React reconciliation and the
    // destination image's fetch/decode happen OFF the transition's
    // render-suppressed critical path. The tree mounts `visibility: hidden`
    // (see LightboxContent/Backdrop `preparing`), so it doesn't paint into the
    // old snapshot captured below. The transition callback then only has to
    // flip it visible — no mount — so the morph starts promptly instead of the
    // screen freezing on the old snapshot for the duration of the mount.
    flushSync(commitPrepare);

    // Wait for the destination image to decode HERE — before starting the
    // transition — rather than inside the update callback. Awaiting inside the
    // callback makes it an *async* callback: the browser reveals the new DOM
    // (via `commitReveal`) but hasn't captured the "new" snapshot yet, so it
    // paints that half-updated state for a frame before the transition's
    // pseudo-elements take over — the one-frame flash of empty space on open.
    //
    // Doing the wait now keeps the trigger fully painted and interactive on
    // screen for the (bounded) duration, and — crucially — lets the update
    // callback stay SYNCHRONOUS, so the browser captures old -> runs the
    // callback -> captures new in a single uninterrupted rendering update with
    // no intermediate paint. Bounded by `decodeMaxWait`; skipped entirely when
    // the consumer opts out (awaitImageDecode={false}).
    if (decodeMaxWait > 0) {
      const pendingItemEl = activeItemElementRef.current;
      const pendingItemTarget = pendingItemEl ? findItemMorphTarget(pendingItemEl) : null;
      // Only actually await when the destination image is still loading. When
      // it's cached (or there's no image), skip the await so the open path
      // stays synchronous and the transition starts on the same tick as the
      // click — no microtask deferral, no perceptible lag.
      if (getPendingDecodeImage(pendingItemTarget)) {
        await waitForImageDecode(pendingItemTarget, decodeMaxWait);
        // A newer open/close superseded this one during the await — bail before
        // touching any document-level morph state so we don't corrupt it.
        if (configRef.current.closeGenRef.current !== gen) return;
      }
    }

    // Read the destination item's border-radius here, after the mount. The
    // slides' layout effect (measureGeometry) has already forced layout during
    // commitPrepare above, so style/layout are clean and this read is cheap —
    // and it lets the transition callback below stay pure-writes (no reads),
    // which avoids a forced reflow *inside* the render-suppressed VT callback.
    // Radius is unaffected by the `visibility: hidden` prepare state.
    const itemElPrep = activeItemElementRef.current;
    const itemTargetPrep = itemElPrep ? findItemMorphTarget(itemElPrep) : null;

    // Decide whether to morph. A morph needs both a trigger (the "old" group)
    // and a destination whose size we can resolve (the "new" group). If the
    // destination image never loaded/decoded within the timeout its box is 0×0,
    // and morphing the trigger into it just shrinks it into the corner/center.
    // In that case, skip the morph and fall back to a plain root crossfade.
    const canMorph = !!triggerTarget && isMorphTargetSizeResolvable(itemTargetPrep);

    // Read the destination radius only when morphing (style/layout are already
    // flushed by the mount, so it's cheap and keeps the VT callback read-free).
    // Radius is unaffected by the `visibility: hidden` prepare state.
    const toRadius = canMorph ? getComputedStyle(itemTargetPrep!).borderRadius : null;

    // In the fallback we force the root crossfade on (no `data-no-crossfade`)
    // and set no morph name/radius, so the transition is a clean fade.
    applyMorphState(docEl, 'opening', {
      useCrossfade: canMorph ? useCrossfade : true,
      fromRadius: canMorph ? fromRadius : null,
      toRadius,
    });
    if (canMorph) {
      // Inline `!important` so the document-level isolation rule (which sets
      // `view-transition-name: none !important` on every element during the
      // morph) can't neutralize the one element we actually want captured.
      setMorphName(triggerTarget!);
    }

    const transition = startViewTransition(() => {
      if (canMorph) {
        clearMorphName(triggerTarget!);
      }
      // Reveal the already-mounted tree (paint-only flip; no reconciliation).
      // The backdrop + content are part of the root snapshot, which crossfades
      // between the old and new states (see the VT CSS contract).
      flushSync(commitReveal);

      // Pure writes only — no layout reads — so the browser can capture the new
      // snapshot without a forced reflow interrupting the transition.
      const itemEl = activeItemElementRef.current;
      if (canMorph) {
        const itemTarget = itemEl ? findItemMorphTarget(itemEl) : null;
        if (itemTarget) {
          setMorphName(itemTarget);
        }
      }
      if (itemEl) {
        itemEl.setAttribute('data-skip-fade', '');
      }
    });

    transition.finished.finally(() => {
      if (configRef.current.closeGenRef.current !== gen) return;
      const itemEl = configRef.current.activeItemElementRef.current;
      const itemTarget = itemEl ? findItemMorphTarget(itemEl) : null;
      if (itemTarget) {
        clearMorphName(itemTarget);
      }
      clearMorphState(docEl);
      configRef.current.onOpenComplete();
    });
  }, []);

  const close = React.useCallback(() => {
    const {
      morphTo,
      scrollTriggerIntoView,
      triggerElementsRef,
      triggerMorphElementsRef,
      activeItemElementRef,
      openingTriggerIndexRef,
      activeIndexRef,
      closeGenRef,
      commitClose,
    } = configRef.current;

    const docEl = document.documentElement;
    const gen = closeGenRef.current;

    const itemEl = activeItemElementRef.current;
    const itemTarget = itemEl ? findItemMorphTarget(itemEl) : null;
    const triggerIdx = resolveTriggerIndex(
      activeIndexRef.current,
      morphTo,
      openingTriggerIndexRef.current,
      triggerElementsRef.current,
    );
    const triggerEl = triggerElementsRef.current.get(triggerIdx);
    const triggerTarget = triggerEl
      ? findTriggerMorphTarget(triggerEl, triggerMorphElementsRef.current)
      : null;
    const useCrossfade = triggerEl?.dataset.crossfade === 'true';

    // Batch all reads before any writes to avoid forced reflow
    const fromRadius = itemTarget ? getComputedStyle(itemTarget).borderRadius : null;
    const toRadius = triggerTarget ? getComputedStyle(triggerTarget).borderRadius : null;

    // Writes
    applyMorphState(docEl, 'closing', { useCrossfade, fromRadius, toRadius });
    if (itemTarget) {
      setMorphName(itemTarget);
    }

    const transition = startViewTransition(() => {
      if (itemTarget) {
        clearMorphName(itemTarget);
      }
      flushSync(commitClose);
      if (scrollTriggerIntoView) {
        scrollTriggerEl(triggerEl, 'instant');
      }
      if (triggerTarget) {
        setMorphName(triggerTarget);
      }
    });

    transition.finished.finally(() => {
      if (triggerTarget) {
        clearMorphName(triggerTarget);
      }
      clearMorphState(docEl);
      if (configRef.current.closeGenRef.current === gen) {
        configRef.current.onCloseComplete(triggerEl);
      }
    });
  }, []);

  return React.useMemo(() => ({ open, close }), [open, close]);
}

export {
  useViewTransitionMorph,
  startViewTransition,
  waitForImageDecode,
  scrollTriggerEl,
  resolveTriggerIndex,
  DEFAULT_DECODE_MAX_WAIT,
};
export type { ViewTransitionMorphConfig, ViewTransitionMorph };
