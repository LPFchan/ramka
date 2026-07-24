'use client';

import * as React from 'react';
import { flushSync } from 'react-dom';

import { VIEW_TRANSITION_NAME, findItemMorphTarget, findTriggerMorphTarget } from './lightbox-context';
import { LightboxDocumentCssVars } from './lightbox-css-vars';
import { LightboxDocumentDataAttributes } from './lightbox-data-attributes';

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

/**
 * Dev-only: items already warned about, so we nudge each offending item exactly
 * once instead of on every open. Keyed by element via a WeakSet so it never
 * leaks and resets naturally when the item unmounts.
 */
const warnedUnwiredItems =
  process.env.NODE_ENV !== 'production' ? new WeakSet<HTMLElement>() : null;
const warnedCollapsedMedia =
  process.env.NODE_ENV !== 'production' ? new WeakSet<HTMLElement>() : null;

/**
 * Dev-only guardrail. Fires when an item is about to morph but resolved its own
 * element as the morph target — i.e. the consumer never wired `imageRef` or
 * `morphRef` via the `Lightbox.Item` render function. The trigger will
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
      '<Lightbox.Item> box) because no morph target was designated. Wrap ' +
      'the destination media in <Lightbox.Media> (recommended), or attach ' +
      '`imageRef` / `morphRef` on Lightbox.Item so the trigger morphs into ' +
      'the media instead.',
    itemEl,
  );
}

/**
 * Dev-only: Media (or a morph target under Media) collapsed to 0×0 — usually
 * missing `width`/`height` / img dims, or Media not under a sized Zoom (or
 * other size container) so the cqw/cqh fit-box cannot resolve.
 */
function warnCollapsedMediaMorph(target: HTMLElement | null) {
  if (!warnedCollapsedMedia || !target) return;
  const media =
    target.hasAttribute('data-ramka-media')
      ? target
      : (target.closest('[data-ramka-media]') as HTMLElement | null);
  if (!media || warnedCollapsedMedia.has(media)) return;
  if (isMorphTargetSizeResolvable(target)) return;
  warnedCollapsedMedia.add(media);
  // eslint-disable-next-line no-console
  console.warn(
    '[ramka] Lightbox.Media morph target has no resolvable size (0×0). ' +
      'Pass `width`/`height` on Media (or HTML width/height on the child <img>) ' +
      'and nest Media under Lightbox.Zoom (a size container) so the fit-box can resolve. ' +
      'Falling back to a root crossfade.',
    media,
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
 * Whether the trigger's `crossfade` mode applies to the given morph phase.
 * `data-crossfade` is `'open' | 'close' | 'both'` (or absent = neither).
 */
export function shouldUseCrossfade(
  mode: string | undefined,
  phase: 'opening' | 'closing',
): boolean {
  if (mode === 'both') return true;
  if (phase === 'opening') return mode === 'open';
  return mode === 'close';
}

/**
 * Split a CSS value list on top-level whitespace, keeping `calc(...)` intact.
 * `"calc(infinity * 1px) 4px"` → `["calc(infinity * 1px)", "4px"]`.
 */
function splitCssList(value: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let depth = 0;
  for (const ch of value) {
    if (ch === '(') depth += 1;
    else if (ch === ')') depth = Math.max(0, depth - 1);

    if (/\s/.test(ch) && depth === 0) {
      if (current) tokens.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (current) tokens.push(current);
  return tokens;
}

/**
 * Convert one border-radius corner token to a used px length, capped at half
 * the shorter side (the CSS used value for a full pill on that box).
 */
function borderRadiusTokenToPx(
  token: string,
  el: HTMLElement,
  width: number,
  height: number,
  cap: number,
): number {
  const t = token.trim().toLowerCase();
  if (!t) return 0;

  // Tailwind v4 `rounded-full` / any non-finite calc.
  if (/infinity/i.test(t)) return cap;

  if (t.endsWith('%')) {
    const pct = Number.parseFloat(t);
    if (!Number.isFinite(pct)) return cap;
    // Approx: % radii resolve against the box; a 50% corner is a full pill.
    return Math.min((Math.min(width, height) * pct) / 100, cap);
  }

  const n = Number.parseFloat(t);
  if (!Number.isFinite(n)) return cap;

  if (t.endsWith('rem')) {
    const rootFs = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    return Math.min(n * rootFs, cap);
  }
  if (t.endsWith('em')) {
    const fs = Number.parseFloat(getComputedStyle(el).fontSize) || 16;
    return Math.min(n * fs, cap);
  }

  // px, or other absolute units already serialized as px by getComputedStyle.
  // Radii larger than half the short side render as a full pill — same as cap.
  return Math.min(n, cap);
}

/**
 * Resolve an element's border-radius into px values the VT group can
 * interpolate.
 *
 * Tailwind v4 `rounded-full` is `border-radius: calc(infinity * 1px)`. CSS
 * cannot interpolate `infinity` → `8px`, so the morph group's radius animation
 * would stick or jump. Percentages, `rem`/`em`, and the old `9999px` full-pill
 * trick have the same problem relative to a fixed px destination.
 *
 * Each corner is resolved independently (so
 * `calc(infinity * 1px) 4px 4px 4px` becomes `32px 4px 4px 4px` on a 64×64
 * box) and capped at half the shorter side — the used pill radius.
 *
 * Note: `getComputedStyle` usually already returns px for `rem`/`em`; we still
 * resolve those units for engines that leave them as specified.
 */
export function resolveMorphBorderRadius(el: HTMLElement): string {
  const raw = getComputedStyle(el).borderRadius.trim();
  if (!raw) return '0px';

  const { width, height } = el.getBoundingClientRect();
  if (!(width > 0 && height > 0)) return '0px';
  const cap = Math.min(width, height) / 2;

  // Drop elliptical `/` second list — the morph clip animates a single list.
  const horizontal = raw.split('/')[0]!.trim();
  const tokens = splitCssList(horizontal);
  if (tokens.length === 0) return '0px';

  const px = tokens.map((token) => borderRadiusTokenToPx(token, el, width, height, cap));
  if (px.every((v) => v === px[0])) return `${px[0]}px`;
  return px.map((v) => `${v}px`).join(' ');
}

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
  docEl.setAttribute(LightboxDocumentDataAttributes.viewTransition, phase);
  if (!opts.useCrossfade) {
    docEl.setAttribute(LightboxDocumentDataAttributes.noCrossfade, '');
    // No-crossfade makes the item the single visible, animated layer in both
    // directions and never crossfades the trigger. But on OPEN we ALWAYS keep
    // the `old` (trigger) snapshot opaque underneath as a paint fallback —
    // never 0. (In the CSS both pseudos have `animation: none` and stretch to
    // the group box, with `new` painted on top of `old`.)
    //
    // - Opening: `new` is the destination item, which is `visibility: hidden`
    //   during prepare and only flips visible inside the (synchronous) VT
    //   callback, right before the new snapshot is captured. If that freshly
    //   revealed layer isn't rasterized in time the new snapshot is blank for a
    //   frame — a compositing race independent of image caching (worst on mobile
    //   Safari). With `old` hidden there'd be nothing behind it, so you'd see a
    //   one-frame flash of empty space between the trigger vanishing and the
    //   item painting. Keeping `old` (the trigger, captured from a fully-painted
    //   live element) opaque underneath makes a blank `new` fall back to the
    //   trigger instead of to nothing. When `new` IS painted it's opaque and
    //   fully OCCLUDES `old`, so the trigger is never *seen* animating — visually
    //   identical to hard-cutting it, except on the frame it would be blank.
    // - Closing: `old` is the item (already on-screen and painted) and stays
    //   opaque; `new` is the trigger, hard-cut to 0 so a scrolled-away/unpainted
    //   trigger can't ghost over the item as it shrinks back.
    docEl.style.setProperty(LightboxDocumentCssVars.morphOldOpacity, '1');
    docEl.style.setProperty(
      LightboxDocumentCssVars.morphNewOpacity,
      phase === 'opening' ? '1' : '0',
    );
  }
  if (opts.fromRadius) {
    docEl.style.setProperty(LightboxDocumentCssVars.morphBorderRadiusFrom, opts.fromRadius);
  }
  if (opts.toRadius) {
    docEl.style.setProperty(LightboxDocumentCssVars.morphBorderRadiusTo, opts.toRadius);
  }
}

/**
 * Assigns the morph `view-transition-name` to an element with inline
 * `!important`: the document-level isolation rule sets `view-transition-name:
 * none !important` on every element while the morph is running (so unrelated
 * consumer-named elements aren't captured), and an inline `!important`
 * declaration outranks that author-`!important` rule on specificity, keeping the
 * morph target the sole captured group.
 *
 * NOTE: we deliberately do NOT also set `contain: layout paint` here. It was a
 * snapshot-raster perf hint, but establishing a fresh paint/containment context
 * on the morph target forces its backing store to be rasterized from scratch at
 * capture time — which races the placeholder image's decode/upload and can leave
 * the captured "new" snapshot blank or unsized for the first frame(s).
 */
function setMorphName(el: HTMLElement) {
  el.style.setProperty('view-transition-name', VIEW_TRANSITION_NAME, 'important');
}

/** Clears the name set by {@link setMorphName}. */
function clearMorphName(el: HTMLElement) {
  el.style.removeProperty('view-transition-name');
}

/** Removes every document-level attribute/var set by {@link applyMorphState}. */
function clearMorphState(docEl: HTMLElement) {
  docEl.removeAttribute(LightboxDocumentDataAttributes.viewTransition);
  docEl.removeAttribute(LightboxDocumentDataAttributes.noCrossfade);
  docEl.style.removeProperty(LightboxDocumentCssVars.morphOldOpacity);
  docEl.style.removeProperty(LightboxDocumentCssVars.morphNewOpacity);
  docEl.style.removeProperty(LightboxDocumentCssVars.morphBorderRadiusFrom);
  docEl.style.removeProperty(LightboxDocumentCssVars.morphBorderRadiusTo);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface ViewTransitionMorphConfig {
  morphTo: 'active' | 'origin' | 'closest';
  scrollTriggerIntoView: ScrollTriggerIntoView;
  /** Upper bound (ms) to await the destination image decode; 0 disables. */
  decodeMaxWait: number;
  /**
   * Optional consumer wait after prepare + decode, before the View Transition.
   * See `Lightbox.Root` `onBeforeOpen`.
   */
  onBeforeOpenRef: React.RefObject<
    | ((ctx: { destination: Element | null; signal: AbortSignal }) => void | Promise<void>)
    | undefined
  >;
  /** Holds the AbortController for the in-flight `onBeforeOpen` (if any). */
  beforeOpenAbortRef: React.MutableRefObject<AbortController | null>;
  triggerElementsRef: React.RefObject<Map<number, HTMLElement>>;
  /** Trigger element → its designated morph descendant (see findTriggerMorphTarget). */
  triggerMorphElementsRef: React.RefObject<WeakMap<HTMLElement, HTMLElement>>;
  activeItemElementRef: React.RefObject<HTMLElement | null>;
  /** Item element → its designated morph descendant (see findItemMorphTarget). */
  itemMorphElementsRef: React.RefObject<WeakMap<HTMLElement, HTMLElement>>;
  openingTriggerIndexRef: React.RefObject<number>;
  /**
   * Exact opening trigger (click or handle + triggerId). Preferred over the
   * index map so morph is correct when several triggers share one index.
   */
  openingTriggerElementRef: React.RefObject<HTMLElement | null>;
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
  /**
   * flushSync body that tears down a prepare that never revealed (superseded
   * open or `onBeforeOpen` failure).
   */
  commitAbortPrepare: () => void;
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
      onBeforeOpenRef,
      beforeOpenAbortRef,
      triggerElementsRef,
      triggerMorphElementsRef,
      activeItemElementRef,
      itemMorphElementsRef,
      openingTriggerIndexRef,
      openingTriggerElementRef,
      closeGenRef,
      commitPrepare,
      commitReveal,
      commitAbortPrepare,
    } = configRef.current;

    const docEl = document.documentElement;
    const gen = closeGenRef.current;

    // Fresh controller for this open attempt; Root aborts it when gen bumps.
    const beforeOpenAbort = new AbortController();
    beforeOpenAbortRef.current = beforeOpenAbort;

    const triggerIdx = openingTriggerIndexRef.current;
    // Prefer the exact origin element (click / handle.triggerId) over the
    // index map — last-registered wins in the map when indexes collide.
    const triggerEl =
      openingTriggerElementRef.current ?? triggerElementsRef.current.get(triggerIdx) ?? undefined;
    const triggerTarget = triggerEl
      ? findTriggerMorphTarget(triggerEl, triggerMorphElementsRef.current)
      : null;
    const useCrossfade = shouldUseCrossfade(triggerEl?.dataset.crossfade, 'opening');

    // Read the trigger's border-radius NOW, before any writes. At this point the
    // page is idle (the click's React state updates are still batched and
    // uncommitted), so this read is served from clean style — no forced reflow.
    // Reading it later (after commitPrepare) would force a full style+layout
    // flush. See LIGHTBOX_PERF.md. Resolved to interpolatable px (handles
    // `rounded-full` / infinity / %).
    const fromRadius = triggerTarget ? resolveMorphBorderRadius(triggerTarget) : null;

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
      const pendingItemTarget = pendingItemEl
        ? findItemMorphTarget(pendingItemEl, itemMorphElementsRef.current)
        : null;
      // Only actually await when the destination image is still loading. When
      // it's cached (or there's no image), skip the await so the open path stays
      // synchronous and the transition starts on the same tick as the click — no
      // microtask deferral, no perceptible lag. (The trigger-thumbnail bridge no
      // longer needs its own decode priming here: `Lightbox.Item` now paints it
      // into a <canvas>, a pre-rasterized bitmap with no async decode — see the
      // placeholder effect in lightbox-item.)
      if (getPendingDecodeImage(pendingItemTarget)) {
        await waitForImageDecode(pendingItemTarget, decodeMaxWait);
        // A newer open/close superseded this one during the await — bail before
        // touching any document-level morph state so we don't corrupt it.
        if (configRef.current.closeGenRef.current !== gen) {
          if (beforeOpenAbortRef.current === beforeOpenAbort) {
            beforeOpenAbortRef.current = null;
          }
          return;
        }
      }
    }

    // Consumer escape hatch: await custom readiness (iframe / video / GLTF)
    // after prepare + optional decode, still BEFORE startViewTransition so the
    // VT update callback stays synchronous (same flash-avoidance as decode).
    const onBeforeOpen = onBeforeOpenRef.current;
    if (onBeforeOpen) {
      const pendingItemEl = activeItemElementRef.current;
      const destination = pendingItemEl
        ? findItemMorphTarget(pendingItemEl, itemMorphElementsRef.current)
        : null;
      try {
        await onBeforeOpen({ destination, signal: beforeOpenAbort.signal });
      } catch {
        // Ignore abort / consumer errors — tear down prepare if this open is
        // still current; a superseding open/close already owns the tree.
        if (beforeOpenAbortRef.current === beforeOpenAbort) {
          beforeOpenAbortRef.current = null;
        }
        if (configRef.current.closeGenRef.current === gen) {
          flushSync(commitAbortPrepare);
        }
        return;
      }
      if (beforeOpenAbortRef.current === beforeOpenAbort) {
        beforeOpenAbortRef.current = null;
      }
      if (configRef.current.closeGenRef.current !== gen) return;
      // Aborted without throw (signal only) — same cleanup as supersede.
      if (beforeOpenAbort.signal.aborted) {
        flushSync(commitAbortPrepare);
        return;
      }
    } else if (beforeOpenAbortRef.current === beforeOpenAbort) {
      beforeOpenAbortRef.current = null;
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
    // to designate a morph target (imageRef / morphRef).
    if (canMorph && itemElPrep && itemTargetPrep === itemElPrep) {
      warnUnwiredItemMorph(itemElPrep, itemTargetPrep);
    }
    if (!canMorph) {
      warnCollapsedMediaMorph(itemTargetPrep);
    }

    // Read the destination radius only when morphing (style/layout are already
    // flushed by the mount, so it's cheap and keeps the VT callback read-free).
    // Radius is unaffected by the `visibility: hidden` prepare state.
    const toRadius = canMorph ? resolveMorphBorderRadius(itemTargetPrep!) : null;

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
      // Shape (border-radius) is owned entirely by the VT group CSS + the
      // from/to vars written above — we never mutate live element radii.
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
    // Mirror open: a morph needs both ends. Naming only the item (no trigger)
    // lifts it out of the root snapshot so chrome fades while the photo sticks,
    // then pops — e.g. controlled open with no Trigger. Fall back to a plain
    // root crossfade instead.
    const canMorph = !!triggerTarget && !!itemTarget;
    const useCrossfade = canMorph
      ? shouldUseCrossfade(triggerEl?.dataset.crossfade, 'closing')
      : true;

    // Batch all reads before any writes to avoid forced reflow. Resolve to
    // interpolatable px so `rounded-full` / % don't break the group animation.
    const fromRadius = canMorph ? resolveMorphBorderRadius(itemTarget!) : null;
    const toRadius = canMorph ? resolveMorphBorderRadius(triggerTarget!) : null;

    // Writes — radii go to CSS vars; the VT group interpolates them (no live
    // border-radius mutation).
    applyMorphState(docEl, 'closing', { useCrossfade, fromRadius, toRadius });
    if (canMorph) {
      setMorphName(itemTarget!);
    }

    const transition = startViewTransition(() => {
      if (canMorph) {
        clearMorphName(itemTarget!);
      }
      flushSync(commitClose);
      const closeBehavior = resolveScrollBehavior(scrollTriggerIntoView, 'onClose');
      if (closeBehavior) {
        scrollTriggerEl(triggerEl, closeBehavior);
      }
      if (canMorph) {
        setMorphName(triggerTarget!);
      }
    });

    transition.finished.finally(() => {
      if (canMorph) {
        clearMorphName(triggerTarget!);
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
