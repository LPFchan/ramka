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
 * ⚠️ IMPORTANT — Safari placeholder-flash fix. Do not remove without reading
 * `waitForPlaceholderDecode` below and the linked regression tests
 * (`lightbox.test.tsx` → "placeholder decode priming (Safari flash fix)").
 *
 * Decodes an image URL so its pixels are paint-ready *before* the View
 * Transition captures the new snapshot. Mirrors {@link waitForImageDecode}, but
 * primes by URL (via a detached `Image`) rather than by element, because it must
 * force a *fresh, natural-size* decode even for a source the browser already
 * considers "complete".
 *
 * Why by URL and not the element: the trigger's `<img>` is already `complete`,
 * so `waitForImageDecode` would early-return without decoding — yet its only
 * decoded frame is at the trigger's *small* grid size. A detached `Image` with
 * the same url resolves to the browser's single `CachedImage` shared with every
 * on-page user of that resource, and `decode()` always runs, producing a
 * natural-size frame in that shared cache.
 *
 * Why this matters (the bug it fixes): Safari/WebKit decodes images
 * ASYNCHRONOUSLY and per painted box, keyed by the box's draw size. When the
 * lightbox item paints the trigger's thumbnail as its placeholder background at
 * a much larger size, WebKit finds no decode at that size and kicks off a fresh
 * async one — painting only the element's `background-color` (a blank/coloured
 * flash) for the first frame(s) of the morph until the decode lands. Priming a
 * natural-size decode up front (the source is never larger than its own pixels)
 * satisfies the item's paint from cache synchronously, so there's no flash. See
 * https://bugs.webkit.org/show_bug.cgi?id=270330.
 *
 * Always resolves, bounded by `maxWait`, and never rejects, so a slow/broken
 * decode can't stall the open morph.
 */
function decodeImageUrl(url: string, maxWait: number = DEFAULT_DECODE_MAX_WAIT): Promise<void> {
  return new Promise<void>((resolve) => {
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const img = new Image();
    img.src = url;
    img.decode().then(settle, settle);
    setTimeout(settle, maxWait);
  });
}

/**
 * ⚠️ IMPORTANT — this is the actual Safari placeholder-flash fix; keep it.
 * Covered by "placeholder decode priming (Safari flash fix)" in lightbox.test.tsx.
 *
 * Forces the browser to flush style + layout for the morph target *after*
 * `Lightbox.Item` has applied its placeholder `background-image`, so Safari
 * begins decoding that background at the element's real box size BEFORE the View
 * Transition captures the new snapshot. The subsequent decode `await` then gives
 * that decode time to land.
 *
 * Priming the shared decode cache with a detached `Image` (see decodeImageUrl)
 * turned out NOT to be sufficient on its own — Safari decodes per-element and
 * per-draw-size and asynchronously, so without touching the element WebKit still
 * paints only the element's `background-color` for the first frame(s) of the
 * morph. Reading resolved style (`backgroundImage`) plus a layout box on the
 * element is what kicks its own decode off in time. The reads are intentional
 * side effects; `void` marks them as such. See
 * https://bugs.webkit.org/show_bug.cgi?id=270330.
 */
function forcePlaceholderPaint(target: HTMLElement | null): void {
  if (!target) return;
  void getComputedStyle(target).backgroundImage;
  void target.getBoundingClientRect();
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

/**
 * Dev-only: items already warned about, so we nudge each offending item exactly
 * once instead of on every open. Keyed by element via a WeakSet so it never
 * leaks and resets naturally when the item unmounts.
 */
const warnedUnwiredItems =
  process.env.NODE_ENV !== 'production' ? new WeakSet<HTMLElement>() : null;

/**
 * Dev-only guardrail. Fires when an item is about to morph but resolved its own
 * element as the morph target — i.e. the consumer never wired `imageRef` or
 * `morphElementRef` via the `Lightbox.Item` render function. The trigger will
 * then animate into the *entire* `<Lightbox.Item>` box (usually the full,
 * flex-centered viewport slide) instead of the letterboxed media, which reads
 * as a broken, non-native morph.
 */
function warnUnwiredItemMorph(itemEl: HTMLElement, target: HTMLElement) {
  if (!warnedUnwiredItems || target !== itemEl || warnedUnwiredItems.has(itemEl)) {
    return;
  }
  warnedUnwiredItems.add(itemEl);
  // eslint-disable-next-line no-console
  console.warn(
    '[ramka] Lightbox.Item is morphing into its own element (the full ' +
      '<Lightbox.Item> box, not its parent) because no morph target was ' +
      'designated. Pass a render function to Lightbox.Item and attach ' +
      '`imageRef` to the destination <img> (or `morphElementRef` to a custom ' +
      'element) so the trigger morphs into the media instead.',
    itemEl,
  );
}

// ---------------------------------------------------------------------------
// scrollTriggerIntoView config
// ---------------------------------------------------------------------------

/**
 * The moments at which the active trigger can be scrolled into view:
 * - `onChange` — the active index changes while open (navigation)
 * - `onOpenComplete` — the open transition finishes (page is covered + locked,
 *   so this reposition is invisible; recommended with `instant`)
 * - `onClose` — just before the close morph runs
 */
type ScrollTriggerMoment = 'onChange' | 'onOpenComplete' | 'onClose';

interface ScrollTriggerOption {
  type: ScrollTriggerMoment;
  behavior?: 'smooth' | 'instant';
}

/** Single option, an array of options, or `null` to disable. */
type ScrollTriggerIntoView = null | ScrollTriggerOption | ScrollTriggerOption[];

/**
 * Resolve the scroll behavior configured for a given moment, or `null` when
 * that moment isn't enabled. Accepts both the single-object and array config
 * forms so `scrollTriggerIntoView={{ type: 'onChange' }}` and
 * `scrollTriggerIntoView={[{ type: 'onChange' }, { type: 'onOpenComplete' }]}`
 * both work.
 */
function resolveScrollBehavior(
  config: ScrollTriggerIntoView | undefined,
  moment: ScrollTriggerMoment,
): ScrollBehavior | null {
  if (!config) return null;
  const options = Array.isArray(config) ? config : [config];
  const match = options.find((option) => option.type === moment);
  return match ? (match.behavior ?? 'smooth') : null;
}

// ---------------------------------------------------------------------------
// Trigger resolution (shared with Root's non-VT close paths)
// ---------------------------------------------------------------------------

function scrollTriggerEl(el: HTMLElement | undefined, behavior: ScrollBehavior = 'smooth') {
  if (!el) return;
  // Defer the "is it already visible?" decision to the browser via
  // `block: 'nearest'`: it's a no-op when the trigger is already within the
  // scrollport and otherwise scrolls the minimum amount to reveal it. Crucially
  // it honors CSS `scroll-margin`/`scroll-padding`, so a sticky header's safe
  // area is respected — a trigger tucked *under* a sticky nav is treated as
  // not-visible and scrolled clear of it. (Consumers set `scroll-padding-top`
  // on the scroll container, or `scroll-margin-top` on the trigger, to the
  // header height.)
  //
  // We deliberately do NOT gate this on a manual getBoundingClientRect check:
  // that check measures against the raw viewport (top >= 0), so it considers a
  // trigger occluded by a sticky header "fully visible" and skips the scroll.
  // IntersectionObserver can't fix this either — v1 is purely geometric (same
  // blind spot) and v2's occlusion-aware `isVisible` is Chromium-only, async,
  // and expensive, so unusable for a synchronous cross-browser decision here.
  el.scrollIntoView({ block: 'nearest', behavior });
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
    // No-crossfade shows ONLY the item snapshot for the whole morph and hard-
    // cuts the trigger. The item is the single visible, animated layer in BOTH
    // directions; the trigger snapshot is never shown:
    //
    // - Opening: `new` is the destination item; keep it opaque and hard-cut
    //   `old` (the trigger) to 0 so only the item image animates from the
    //   trigger's box into place — the trigger itself is not animated at all.
    //   Trade-off: `old` is no longer a paint fallback, so if the freshly
    //   revealed item layer isn't rasterized in time (a compositing race, or
    //   `awaitImageDecode={false}` / an item with no image) the new snapshot
    //   can be blank for one frame with nothing behind it. The bounded
    //   image-decode wait on the open path mitigates this in the common case.
    // - Closing: `old` is the item (already on-screen and painted), `new` is
    //   the trigger, hard-cut to 0 so a scrolled-away/again-unpainted trigger
    //   can't ghost over the item as it shrinks back.
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
  scrollTriggerIntoView: ScrollTriggerIntoView;
  /** Upper bound (ms) to await the destination image decode; 0 disables. */
  decodeMaxWait: number;
  triggerElementsRef: React.RefObject<Map<number, HTMLElement>>;
  /** Trigger element → its designated morph descendant (see findTriggerMorphTarget). */
  triggerMorphElementsRef: React.RefObject<WeakMap<HTMLElement, HTMLElement>>;
  /**
   * Opening trigger's `<img>` (the clicked one). Its `currentSrc` is exactly the
   * source `Lightbox.Item` paints as the destination image's placeholder
   * background, so priming its decode is what bridges the open morph in Safari
   * (see `decodeImageUrl`). Mirrors the placeholder resolution in lightbox-item.
   */
  openingTriggerImageRef: React.RefObject<HTMLImageElement | null>;
  /** Index → trigger `<img>`; the placeholder source when the opening image ref is unset. */
  triggerImageElementsRef: React.RefObject<Map<number, HTMLImageElement>>;
  activeItemElementRef: React.RefObject<HTMLElement | null>;
  /** Item element → its designated morph descendant (see findItemMorphTarget). */
  itemMorphElementsRef: React.RefObject<WeakMap<HTMLElement, HTMLElement>>;
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
      openingTriggerImageRef,
      triggerImageElementsRef,
      activeItemElementRef,
      itemMorphElementsRef,
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
    const pendingItemEl = activeItemElementRef.current;
    const pendingItemTarget = pendingItemEl
      ? findItemMorphTarget(pendingItemEl, itemMorphElementsRef.current)
      : null;

    // Everything that must be paint-ready BEFORE the new snapshot is captured.
    // Awaiting here (rather than inside the VT callback) keeps the callback
    // synchronous — see the note above waitForImageDecode.
    const decodes: Promise<void>[] = [];

    // Is the destination image still loading? When it is, `Lightbox.Item` paints
    // the trigger's thumbnail as a placeholder background to bridge the morph —
    // which is exactly the case that needs the Safari decode-priming below. When
    // it's already loaded (or absent), there's no placeholder and nothing to
    // prime, so the open path can stay fully synchronous.
    const destinationPending = !!getPendingDecodeImage(pendingItemTarget);

    // (1) The destination <img>'s own decode — the potentially heavy full-size
    // image. Governed by `awaitImageDecode`: only await when the consumer opted
    // in (`decodeMaxWait > 0`) AND the image is still loading.
    if (decodeMaxWait > 0 && destinationPending) {
      decodes.push(waitForImageDecode(pendingItemTarget, decodeMaxWait));
    }

    // (2) ⚠️ IMPORTANT — Safari placeholder-flash fix (do not remove; covered by
    // "placeholder decode priming (Safari flash fix)" in lightbox.test.tsx).
    //
    // While the destination image is still loading, `Lightbox.Item` paints the
    // trigger's thumbnail as the <img>'s placeholder background. On Safari that
    // placeholder flashes the element's background-color for the first frame(s)
    // of the morph, because WebKit decodes background images asynchronously,
    // per-element and per-draw-size. Two steps fix it, and BOTH are required:
    //
    //   a) forcePlaceholderPaint — flush the target's style + layout so WebKit
    //      begins decoding ITS OWN background at the real box size. This is the
    //      step that actually prevents the flash; cache-priming alone did not.
    //   b) decodeImageUrl — prime/await a decode of the same source (the opening
    //      trigger image's `currentSrc`, which is BY CONSTRUCTION the placeholder
    //      url — see the placeholder effect in lightbox-item, so we read it from
    //      refs, not getComputedStyle). Awaiting it holds the open until the
    //      shared decode has landed, right before the new snapshot is captured.
    //
    // Runs independent of `awaitImageDecode` (which governs only the heavy image
    // in (1)): the placeholder is small and typically already fetched, so the
    // wait is negligible and bounded — a slow/broken source can't stall the
    // open. Gated on `destinationPending`, matching exactly when the item paints
    // the placeholder.
    if (destinationPending) {
      const placeholderImg =
        openingTriggerImageRef.current ?? triggerImageElementsRef.current?.get(triggerIdx) ?? null;
      const placeholderSrc = placeholderImg?.currentSrc || null;
      if (placeholderSrc) {
        forcePlaceholderPaint(pendingItemTarget);
        decodes.push(
          decodeImageUrl(placeholderSrc, decodeMaxWait > 0 ? decodeMaxWait : DEFAULT_DECODE_MAX_WAIT),
        );
      }
    }

    if (decodes.length > 0) {
      await Promise.all(decodes);
      // A newer open/close superseded this one during the await — bail before
      // touching any document-level morph state so we don't corrupt it.
      if (configRef.current.closeGenRef.current !== gen) return;
    }

    // Read the destination item's border-radius here, after the mount. The
    // slides' layout effect (measureGeometry) has already forced layout during
    // commitPrepare above, so style/layout are clean and this read is cheap —
    // and it lets the transition callback below stay pure-writes (no reads),
    // which avoids a forced reflow *inside* the render-suppressed VT callback.
    // Radius is unaffected by the `visibility: hidden` prepare state.
    const itemElPrep = activeItemElementRef.current;
    const itemTargetPrep = itemElPrep
      ? findItemMorphTarget(itemElPrep, itemMorphElementsRef.current)
      : null;

    // Decide whether to morph. A morph needs both a trigger (the "old" group)
    // and a destination whose size we can resolve (the "new" group). If the
    // destination image never loaded/decoded within the timeout its box is 0×0,
    // and morphing the trigger into it just shrinks it into the corner/center.
    // In that case, skip the morph and fall back to a plain root crossfade.
    const canMorph = !!triggerTarget && isMorphTargetSizeResolvable(itemTargetPrep);

    // Dev nudge: a morph into the bare item container means the consumer forgot
    // to designate a morph target (imageRef / morphElementRef).
    if (canMorph && itemElPrep && itemTargetPrep === itemElPrep) {
      warnUnwiredItemMorph(itemElPrep, itemTargetPrep);
    }

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
        const itemTarget = itemEl ? findItemMorphTarget(itemEl, itemMorphElementsRef.current) : null;
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
      const cfg = configRef.current;
      const itemEl = cfg.activeItemElementRef.current;
      const itemTarget = itemEl
        ? findItemMorphTarget(itemEl, cfg.itemMorphElementsRef.current)
        : null;
      if (itemTarget) {
        clearMorphName(itemTarget);
      }
      clearMorphState(docEl);

      // Reposition the active trigger while the viewer still covers the page
      // (and scroll is locked), so a later close morph lands on-screen with no
      // visible jump at close start. Invisible now; only pays off on close.
      const openCompleteBehavior = resolveScrollBehavior(cfg.scrollTriggerIntoView, 'onOpenComplete');
      if (openCompleteBehavior) {
        const idx = resolveTriggerIndex(
          cfg.activeIndexRef.current,
          cfg.morphTo,
          cfg.openingTriggerIndexRef.current,
          cfg.triggerElementsRef.current,
        );
        scrollTriggerEl(cfg.triggerElementsRef.current.get(idx), openCompleteBehavior);
      }

      cfg.onOpenComplete();
    });
  }, []);

  const close = React.useCallback(() => {
    const {
      morphTo,
      scrollTriggerIntoView,
      triggerElementsRef,
      triggerMorphElementsRef,
      activeItemElementRef,
      itemMorphElementsRef,
      openingTriggerIndexRef,
      activeIndexRef,
      closeGenRef,
      commitClose,
    } = configRef.current;

    const docEl = document.documentElement;
    const gen = closeGenRef.current;

    const itemEl = activeItemElementRef.current;
    const itemTarget = itemEl ? findItemMorphTarget(itemEl, itemMorphElementsRef.current) : null;
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
      const closeBehavior = resolveScrollBehavior(scrollTriggerIntoView, 'onClose');
      if (closeBehavior) {
        scrollTriggerEl(triggerEl, closeBehavior);
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
  resolveScrollBehavior,
  DEFAULT_DECODE_MAX_WAIT,
};
export type {
  ViewTransitionMorphConfig,
  ViewTransitionMorph,
  ScrollTriggerIntoView,
  ScrollTriggerOption,
  ScrollTriggerMoment,
};
