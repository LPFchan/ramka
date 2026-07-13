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
    // Opening reveals the destination (old 0 -> new 1); closing hides it.
    docEl.style.setProperty('--lightbox-morph-old-opacity', phase === 'opening' ? '0' : '1');
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
 * Establishes a paint + layout containment boundary on an element about to be
 * captured. Before snapshotting each state the browser must rasterize the
 * element's layout tree; `contain: layout paint` scopes style, layout, and
 * paint to that element's box so the snapshot generation can't thrash the rest
 * of the page's layout — the single cheapest win on low-end GPUs per the VT
 * performance guidance. Applied to every element we lift into its own group
 * (morph target, backdrop, content), always *before* the relevant capture.
 */
function containForCapture(el: HTMLElement) {
  el.style.setProperty('contain', 'layout paint', 'important');
}

/** Reverts a {@link containForCapture} call. */
function releaseContain(el: HTMLElement) {
  el.style.removeProperty('contain');
}

/**
 * Assigns the morph `view-transition-name` to an element with inline
 * `!important`. The document-level isolation rule sets
 * `view-transition-name: none !important` on every element while the morph is
 * running (so unrelated consumer-named elements aren't captured); an inline
 * `!important` declaration outranks that author-`!important` rule on
 * specificity, keeping the morph target the sole captured group.
 */
function setMorphName(el: HTMLElement) {
  el.style.setProperty('view-transition-name', VIEW_TRANSITION_NAME, 'important');
  containForCapture(el);
}

/** Clears a name set by {@link setMorphName}. */
function clearMorphName(el: HTMLElement) {
  el.style.removeProperty('view-transition-name');
  releaseContain(el);
}

// Group names for the backdrop and content. Lifting these into their own VT
// groups (instead of leaving them in the whole-page root snapshot) lets the
// root crossfade go instant — only these cheap per-element layers animate.
const BACKDROP_VT_NAME = 'lightbox-backdrop';
const CONTENT_VT_NAME = 'lightbox-content';

/**
 * Lifts an element (the backdrop or content) into its own transition group by
 * assigning a `view-transition-name` with inline `!important` so it survives
 * the isolation rule.
 */
function nameGroup(el: HTMLElement, name: string) {
  el.style.setProperty('view-transition-name', name, 'important');
  containForCapture(el);
}

/**
 * Like {@link nameGroup}, but also pins `opacity: 1` (inline `!important`) so
 * the captured snapshot is fully opaque even if the element's enter transition
 * (`@starting-style` opacity 0 → 1) hasn't finished by capture time — the group
 * fade then animates the pseudo cleanly from transparent to opaque.
 *
 * Only used on OPEN. On CLOSE we must NOT pin opacity: the backdrop may be
 * mid-pull (dimmed via `--lightbox-pull-progress`), and forcing it to 1 right
 * before the snapshot makes it flash bright for a frame before fading out.
 * Capturing it at its current opacity fades out smoothly from wherever the
 * gesture left it.
 */
function captureAsGroup(el: HTMLElement, name: string) {
  nameGroup(el, name);
  el.style.setProperty('opacity', '1', 'important');
}

/** Reverts a {@link captureAsGroup} / {@link nameGroup} call. */
function releaseGroup(el: HTMLElement) {
  el.style.removeProperty('view-transition-name');
  el.style.removeProperty('opacity');
  releaseContain(el);
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
  activeItemElementRef: React.RefObject<HTMLElement | null>;
  /** Backdrop element (if `Lightbox.Backdrop` is rendered) — lifted into its
   *  own VT group so the root crossfade can stay instant. */
  backdropElementRef: React.RefObject<HTMLElement | null>;
  /** Content/dialog element — lifted into its own VT group. */
  dialogElementRef: React.RefObject<HTMLElement | null>;
  openingTriggerIndexRef: React.RefObject<number>;
  activeIndexRef: React.RefObject<number>;
  closeGenRef: React.MutableRefObject<number>;
  /** flushSync body that flips React state to the open/mounted state. */
  commitOpen: () => void;
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

  const open = React.useCallback(() => {
    const {
      decodeMaxWait,
      triggerElementsRef,
      activeItemElementRef,
      openingTriggerIndexRef,
      closeGenRef,
      commitOpen,
    } = configRef.current;

    const docEl = document.documentElement;
    const gen = closeGenRef.current;

    const triggerIdx = openingTriggerIndexRef.current;
    const triggerEl = triggerElementsRef.current.get(triggerIdx);
    const triggerTarget = triggerEl ? findTriggerMorphTarget(triggerEl) : null;
    const useCrossfade = triggerEl?.dataset.crossfade === 'true';

    // Batch all reads before any writes to avoid forced reflow
    const fromRadius = triggerTarget ? getComputedStyle(triggerTarget).borderRadius : null;

    // Writes
    applyMorphState(docEl, 'opening', { useCrossfade, fromRadius, toRadius: null });
    if (triggerTarget) {
      // Inline `!important` so the document-level isolation rule (which sets
      // `view-transition-name: none !important` on every element during the
      // morph) can't neutralize the one element we actually want captured.
      setMorphName(triggerTarget);
    }

    const transition = startViewTransition(async () => {
      if (triggerTarget) {
        clearMorphName(triggerTarget);
      }
      flushSync(commitOpen);

      // Backdrop + content are now mounted (flushSync ran their ref callbacks
      // synchronously). Lift them into their own groups so they fade on cheap
      // per-element layers while the root snapshot (the unchanged page) stays
      // static — see the `animation: none` root rule in the VT CSS contract.
      const backdropEl = configRef.current.backdropElementRef.current;
      const contentEl = configRef.current.dialogElementRef.current;
      if (backdropEl) captureAsGroup(backdropEl, BACKDROP_VT_NAME);
      if (contentEl) captureAsGroup(contentEl, CONTENT_VT_NAME);

      const itemEl = activeItemElementRef.current;
      const itemTarget = itemEl ? findItemMorphTarget(itemEl) : null;

      // Wait for the destination image to decode before the browser
      // captures the "new" snapshot, preventing a flash of empty space
      // during the morph animation. Bounded by `decodeMaxWait`; skipped
      // entirely when the consumer opts out (awaitImageDecode={false}).
      if (decodeMaxWait > 0) {
        await waitForImageDecode(itemTarget, decodeMaxWait);
      }

      // Read before write to avoid forced reflow
      const toRadius = itemTarget ? getComputedStyle(itemTarget).borderRadius : null;
      if (itemTarget) {
        setMorphName(itemTarget);
      }
      if (toRadius) {
        docEl.style.setProperty('--lightbox-morph-border-radius-to', toRadius);
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
      const backdropEl = configRef.current.backdropElementRef.current;
      const contentEl = configRef.current.dialogElementRef.current;
      if (backdropEl) releaseGroup(backdropEl);
      if (contentEl) releaseGroup(contentEl);
      clearMorphState(docEl);
      configRef.current.onOpenComplete();
    });
  }, []);

  const close = React.useCallback(() => {
    const {
      morphTo,
      scrollTriggerIntoView,
      triggerElementsRef,
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
    const triggerTarget = triggerEl ? findTriggerMorphTarget(triggerEl) : null;
    const useCrossfade = triggerEl?.dataset.crossfade === 'true';

    // Batch all reads before any writes to avoid forced reflow
    const fromRadius = itemTarget ? getComputedStyle(itemTarget).borderRadius : null;
    const toRadius = triggerTarget ? getComputedStyle(triggerTarget).borderRadius : null;

    // Writes
    applyMorphState(docEl, 'closing', { useCrossfade, fromRadius, toRadius });
    if (itemTarget) {
      setMorphName(itemTarget);
    }
    // Lift backdrop + content into their own groups now, while still mounted,
    // so the OLD snapshot captures them as separate fading layers. Name only —
    // no opacity pin — so a pull-dimmed backdrop fades out from its current
    // opacity instead of flashing to full first. They unmount in `commitClose`
    // below, so there's nothing to release afterwards.
    const backdropEl = configRef.current.backdropElementRef.current;
    const contentEl = configRef.current.dialogElementRef.current;
    if (backdropEl) nameGroup(backdropEl, BACKDROP_VT_NAME);
    if (contentEl) nameGroup(contentEl, CONTENT_VT_NAME);

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
