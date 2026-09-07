'use client';

import type * as React from 'react';
import { flushSync } from 'react-dom';

import { isAndroidBlinkSnapshotRoot } from './is-android-blink';
import { isFirefox } from './is-firefox';
import { acquireVtTouchGuard } from './vt-touch-guard';
import { maybeUpgradeToCompositedMorph } from './vt-composited-morph';
import { isViewTransitionPreset } from './vt-timing';
import type { LightboxViewTransitionPreset } from './vt-timing';
import {
  findDestinationMorphTarget,
  findItemMorphTarget,
  findTriggerMorphTarget,
} from './morph-target';
import { DEFAULT_DECODE_MAX_WAIT, VIEW_TRANSITION_NAME } from './vt-constants';
import {
  LightboxDocumentDataAttributes,
  LightboxSlideDataAttributes,
} from './lightbox-data-attributes';
import { insertDynamicRules } from './lightbox-style-sheets';
import type { LibrarySheet } from './lightbox-style-sheets';
import { pageNeedsNameIsolation } from './vt-name-isolation';
import {
  resolveScrollTriggerOption,
  resolveTriggerIndex,
  scrollTriggerEl,
} from './scroll-trigger';
import type { InitializedRef } from '../react-compat';
import type { ScrollTriggerIntoView } from './scroll-trigger';

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
): { finished: Promise<void>; ready?: Promise<void> } {
  return (
    document as Document & {
      startViewTransition: (cb: () => void | Promise<void>) => {
        finished: Promise<void>;
        ready?: Promise<void>;
      };
    }
  ).startViewTransition(callback);
}

/**
 * Android Chrome aborts a view transition if the snapshot root size changes
 * between old and new capture (URL-bar show/hide). Wait until layout
 * `innerHeight` and `visualViewport.height` agree **and stay still**.
 *
 * A one-shot "heights differ → wait until they match" is not enough: the bar
 * animation can pass through a matching frame (or sit in a stable mismatch)
 * and then keep moving during capture. Do not treat a stable mismatch as
 * settled.
 *
 * Only invoked on mobile Blink (see `shouldWaitForSnapshotRootSettle`). jsdom
 * has no compositor; skip so a stray call cannot defer tests off the click tick.
 */
const SNAPSHOT_ROOT_STABLE_FRAMES = 8;
const SNAPSHOT_ROOT_SETTLE_MAX_MS = 1000;

function readSnapshotRoot(): {
  innerW: number;
  innerH: number;
  vvH: number | null;
  scrollX: number;
  scrollY: number;
} {
  const vv = typeof window !== 'undefined' ? window.visualViewport : null;
  return {
    innerW: window.innerWidth,
    innerH: window.innerHeight,
    vvH: vv?.height ?? null,
    scrollX: Math.round(window.scrollX),
    scrollY: Math.round(window.scrollY),
  };
}

function snapshotRootKey(snap: ReturnType<typeof readSnapshotRoot>): string {
  return `${snap.innerW}x${snap.innerH}|vv:${snap.vvH ?? 'n'}|s:${snap.scrollX},${snap.scrollY}`;
}

function layoutMatchesVisualViewport(snap: ReturnType<typeof readSnapshotRoot>): boolean {
  if (snap.vvH == null) return true;
  return Math.abs(snap.innerH - snap.vvH) <= 1;
}

function waitForStableSnapshotRoot(): Promise<void> {
  if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const t0 = performance.now();
    let lastKey = snapshotRootKey(readSnapshotRoot());
    let stable = 0;
    const tick = () => {
      const snap = readSnapshotRoot();
      const key = snapshotRootKey(snap);
      const aligned = layoutMatchesVisualViewport(snap);
      const elapsed = performance.now() - t0;
      if (key === lastKey && aligned) {
        stable += 1;
      } else {
        lastKey = key;
        stable = 0;
      }
      if (
        stable >= SNAPSHOT_ROOT_STABLE_FRAMES ||
        (elapsed >= SNAPSHOT_ROOT_SETTLE_MAX_MS && aligned) ||
        elapsed >= SNAPSHOT_ROOT_SETTLE_MAX_MS * 1.5
      ) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/**
 * Blink on Android includes URL-bar outsets in the view-transition snapshot
 * root. Desktop Chromium and WebKit (Safari, and every iOS browser) do not
 * have that abort, so they skip the settle wait.
 */
function shouldWaitForSnapshotRootSettle(): boolean {
  if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)) return false;
  return isAndroidBlinkSnapshotRoot();
}

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
 * Stand-in px value for non-finite radii (`calc(infinity * 1px)`, i.e.
 * Tailwind v4 `rounded-full`, or unparsable pill hacks). Large enough that the
 * corner-overlap scaling in {@link resolveMorphBorderRadius} drives every
 * other radius' share toward its true limit, small enough that
 * `radius * factor` stays numerically exact.
 */
const NON_FINITE_RADIUS_PX = 1e9;

/**
 * Convert one border-radius corner token to a computed px length (pre
 * overlap-scaling). `percentBasis` is the box width — the basis for the
 * horizontal radius component per spec, which is the component the morph
 * animates.
 */
function borderRadiusTokenToPx(token: string, el: HTMLElement, percentBasis: number): number {
  const t = token.trim().toLowerCase();
  if (!t) return 0;

  // Tailwind v4 `rounded-full` / any non-finite calc.
  if (/infinity/i.test(t)) return NON_FINITE_RADIUS_PX;

  if (t.endsWith('%')) {
    const pct = Number.parseFloat(t);
    if (!Number.isFinite(pct)) return NON_FINITE_RADIUS_PX;
    return Math.max(0, (percentBasis * pct) / 100);
  }

  const n = Number.parseFloat(t);
  // Unparsable token — treat like a pill hack, same as non-finite.
  if (!Number.isFinite(n)) return NON_FINITE_RADIUS_PX;

  if (t.endsWith('rem')) {
    const rootFs = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    return Math.max(0, n * rootFs);
  }
  if (t.endsWith('em')) {
    const fs = Number.parseFloat(getComputedStyle(el).fontSize) || 16;
    return Math.max(0, n * fs);
  }

  // px, or other absolute units already serialized as px by getComputedStyle.
  return Math.max(0, n);
}

/** Round a px value for CSS serialization (avoids 63.99999997px noise). */
function roundRadiusPx(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * Resolve an element's border-radius into the **used** px values the VT group
 * can interpolate — matching what the browser actually renders.
 *
 * Tailwind v4 `rounded-full` is `border-radius: calc(infinity * 1px)`. CSS
 * cannot interpolate `infinity` → `8px`, so the morph group's radius animation
 * would stick or jump. Percentages, `rem`/`em`, and the old `9999px` full-pill
 * trick have the same problem relative to a fixed px destination.
 *
 * Corner radii are resolved per the CSS corner-overlap rule
 * (css-backgrounds-3 §5.5): when the sum of adjacent radii overflows an edge,
 * ALL radii are multiplied by the same factor
 * `f = min(1, edge / sum-of-adjacent-radii)` taken over all four edges.
 * Capping each corner independently at half the shorter side (the used pill
 * radius) is only equivalent for uniform radii — for asymmetric radii like
 * `16px 16px 160px 160px` on a wide box it undershoots the large corners, so
 * the close morph would animate toward a flatter shape than the live trigger
 * and visibly snap on the last frame.
 *
 * Note: `getComputedStyle` usually already returns px for `rem`/`em`; we still
 * resolve those units for engines that leave them as specified.
 */
export function resolveMorphBorderRadius(el: HTMLElement): string {
  const raw = getComputedStyle(el).borderRadius.trim();
  if (!raw) return '0px';

  const { width, height } = el.getBoundingClientRect();
  if (!(width > 0 && height > 0)) return '0px';

  // Drop elliptical `/` second list — the morph clip animates a single list
  // (the horizontal component).
  const horizontal = raw.split('/')[0]!.trim();
  const tokens = splitCssList(horizontal);
  if (tokens.length === 0) return '0px';

  // Expand the 1–4 token shorthand to per-corner values [tl, tr, br, bl].
  const [a, b = a, c = a, d = b] = tokens;
  const [tl, tr, br, bl] = [a, b, c, d].map((token) =>
    borderRadiusTokenToPx(token!, el, width),
  ) as [number, number, number, number];

  // CSS corner-overlap rule: one uniform scale factor across all corners,
  // constrained by every edge. Zero sums divide to Infinity, which min()
  // ignores in favor of 1.
  const f = Math.min(
    1,
    width / (tl + tr),
    width / (bl + br),
    height / (tr + br),
    height / (tl + bl),
  );

  const used = [tl, tr, br, bl].map((r) => roundRadiusPx(r * f)) as [
    number,
    number,
    number,
    number,
  ];

  // Serialize back to the minimal shorthand.
  const [utl, utr, ubr, ubl] = used;
  let list: number[];
  if (ubl === utr) {
    if (ubr === utl) {
      list = utr === utl ? [utl] : [utl, utr];
    } else {
      list = [utl, utr, ubr];
    }
  } else {
    list = [utl, utr, ubr, ubl];
  }
  return list.map((v) => `${v}px`).join(' ');
}

/** Marker for the per-morph radius keyframes (used by the jsdom <style> fallback). */
const MORPH_RADIUS_MARKER = 'data-ramka-vt-morph-radius';

/**
 * Build the per-morph `@keyframes ramka-morph-border-radius` rule carrying
 * this morph's CONCRETE from/to border-radius. The structural sheet's group
 * rule references the name statically; this rule — inserted into the dynamic
 * channel sheet, which sorts after the structural sheet — shadows the inert
 * 0px→0px fallback the structural sheet ships (last duplicate @keyframes name
 * in cascade order wins).
 *
 * A @keyframes insert is the ONLY per-morph CSS delivery WebKit's style
 * invalidator scopes cheaply (measured on a 16k-element page, WebKit 26):
 * adopting/removing a sheet, `deleteRule`, AND inserting any *style* rule —
 * even one whose selector matches nothing — all trigger a full-document
 * restyle (~100ms there), while @keyframes inserts are free. So every
 * continuous per-morph value travels inside @keyframes, and everything
 * discrete (preset timing, hard-cut opacities) lives in static rules keyed on
 * the `data-ramka-vt-preset` / phase attributes — see vt-structural-styles.ts.
 *
 * Always inserted (0px endpoints when the morph has no radii): the name is
 * fixed and stale rules only leave the sheet at the idle deletion batch, so a
 * radius-free morph must still shadow a previous morph's radii.
 */
function buildMorphRadiusKeyframes(opts: {
  fromRadius: string | null;
  toRadius: string | null;
}): string {
  const from = opts.fromRadius ?? '0px';
  const to = opts.toRadius ?? '0px';
  return `@keyframes ramka-morph-border-radius {\n  from { border-radius: ${from}; }\n  to { border-radius: ${to}; }\n}`;
}

/** Flush threshold (CSS px) for treating a box edge as viewport-flush. */
const FULL_BLEED_EPS_PX = 0.5;
/**
 * Temporary padding added on the Slide for Firefox full-bleed VT capture.
 * Matches the consumer workaround (slide padding fixes the bug); 1px is enough
 * to break viewport-edge equality without a visible jump.
 */
const FIREFOX_FULL_BLEED_CAPTURE_INSET_PX = 1;

interface FullBleedAxes {
  horizontal: boolean;
  vertical: boolean;
}

/**
 * Which axes of the element's **layout** box fill the layout viewport.
 *
 * Uses `offsetWidth` / `offsetHeight` (pre-transform), not
 * `getBoundingClientRect()`. Pull-to-dismiss leaves `scale()` on the Item;
 * the transformed rect looks inset so a visual check would skip this
 * workaround — but layout is still full-bleed, and that is what Firefox's VT
 * capture mishandles (same as a 1px Slide border/padding fixing pull-dismiss).
 * Letterboxed axes (layout smaller than the viewport) do not hit this path.
 */
function getFullBleedAxes(el: HTMLElement): FullBleedAxes {
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  if (!(w > 0 && h > 0)) {
    return { horizontal: false, vertical: false };
  }
  const viewportW = document.documentElement.clientWidth;
  const viewportH = document.documentElement.clientHeight;
  return {
    horizontal: w >= viewportW - FULL_BLEED_EPS_PX,
    vertical: h >= viewportH - FULL_BLEED_EPS_PX,
  };
}

function isHorizontallyFullBleed(el: HTMLElement): boolean {
  return getFullBleedAxes(el).horizontal;
}

function isVerticallyFullBleed(el: HTMLElement): boolean {
  return getFullBleedAxes(el).vertical;
}

type CaptureInsetRestore = () => void;

/**
 * Firefox-only capture workaround when the morph target is full-bleed on X
 * and/or Y (both edges of that axis flush with the viewport).
 *
 * Why pad the Slide (not the morph target): Media sizes with `cqw`/`cqh`
 * against Zoom, and Zoom fills the Slide content box. Shrinking Media alone
 * leaves that size container viewport-flush — the same geometry Firefox
 * mishandles. Padding the Slide (what manually fixes the bug) shrinks the
 * content box → Zoom → fit-box Media as one coherent layout, so the named
 * snapshot is no longer edge-to-edge on the affected axis.
 *
 * Close: call before `startViewTransition` (old snapshot).  
 * Open: call inside the VT callback after reveal + naming (new snapshot).
 */
function applyFirefoxFullBleedCaptureInset(morphTarget: HTMLElement): CaptureInsetRestore | null {
  if (!isFirefox()) return null;
  const axes = getFullBleedAxes(morphTarget);
  if (!axes.horizontal && !axes.vertical) return null;

  const slide =
    morphTarget.closest<HTMLElement>(`[${LightboxSlideDataAttributes.slide}]`) ?? morphTarget;

  const prevPaddingLeft = slide.style.paddingLeft;
  const prevPaddingRight = slide.style.paddingRight;
  const prevPaddingTop = slide.style.paddingTop;
  const prevPaddingBottom = slide.style.paddingBottom;
  const cs = getComputedStyle(slide);
  const inset = FIREFOX_FULL_BLEED_CAPTURE_INSET_PX;

  if (axes.horizontal) {
    slide.style.paddingLeft = `${(parseFloat(cs.paddingLeft) || 0) + inset}px`;
    slide.style.paddingRight = `${(parseFloat(cs.paddingRight) || 0) + inset}px`;
  }
  if (axes.vertical) {
    slide.style.paddingTop = `${(parseFloat(cs.paddingTop) || 0) + inset}px`;
    slide.style.paddingBottom = `${(parseFloat(cs.paddingBottom) || 0) + inset}px`;
  }
  // Ensure cqw/cqh / Media layout flush before VT capture reads geometry.
  void morphTarget.offsetWidth;

  return () => {
    slide.style.paddingLeft = prevPaddingLeft;
    slide.style.paddingRight = prevPaddingRight;
    slide.style.paddingTop = prevPaddingTop;
    slide.style.paddingBottom = prevPaddingBottom;
  };
}

/**
 * Identity of the morph that currently owns the document-level state.
 *
 * Document view transitions are exclusive, but their FINALIZERS are not:
 * starting a new transition skips the active one, and the skipped
 * transition's `finished.finally` runs a microtask later — after the new
 * morph has already promoted its own state. That happens whenever two
 * transitions interleave: open lightbox B while lightbox A's close morph is
 * in flight (different Roots, possibly different `viewTransition` presets),
 * or rapidly reopen the same lightbox mid-close. Without ownership tracking
 * the stale finalizer wipes the live morph's attributes and vars — timing
 * silently falls back to the default preset, name isolation turns off, and a
 * hard-cut open loses `--lightbox-morph-new-opacity: 1` (CSS fallback 0), so
 * the morphing image simply disappears.
 *
 * Module-level on purpose: the state lives on `documentElement`, which is
 * shared by every Root on the page, so per-hook generation counters cannot
 * see cross-Root interleaves.
 */
let morphStateOwner = 0;

/**
 * State handle returned by {@link applyMorphState}: the ownership token plus
 * this morph's private radius-keyframes rule (released unconditionally on
 * teardown — each morph owns its own insertion, so releasing a stale one can
 * never affect a newer morph's values).
 */
interface MorphDocState {
  owner: number;
  radiusSheet: LibrarySheet;
}

/**
 * Applies the document-level state that drives the morph CSS: the phase
 * attribute, optional `data-ramka-crossfade`, `data-ramka-vt-preset` (which
 * arms the preset's static timing rules), `data-ramka-vt-isolate` when the
 * page needs name isolation — and the per-morph border-radius @keyframes
 * (see {@link buildMorphRadiusKeyframes} for why radii travel as keyframes
 * rather than custom properties).
 *
 * Hard-cut opacity rationale (the `useCrossfade: false` branch of the vars):
 * the item is the single visible, animated layer in both directions and never
 * crossfades the trigger. But on OPEN we ALWAYS keep the `old` (trigger)
 * snapshot opaque underneath as a paint fallback — never 0. (In the CSS both
 * pseudos have `animation: none` and stretch to the group box, with `new`
 * painted on top of `old`.)
 *
 * - Opening: `new` is the destination item, which is `visibility: hidden`
 *   during prepare and only flips visible inside the (synchronous) VT
 *   callback, right before the new snapshot is captured. If that freshly
 *   revealed layer isn't rasterized in time the new snapshot is blank for a
 *   frame — a compositing race independent of image caching (worst on mobile
 *   Safari). With `old` hidden there'd be nothing behind it, so you'd see a
 *   one-frame flash of empty space between the trigger vanishing and the
 *   item painting. Keeping `old` (the trigger, captured from a fully-painted
 *   live element) opaque underneath makes a blank `new` fall back to the
 *   trigger instead of to nothing. When `new` IS painted it's opaque and
 *   fully OCCLUDES `old`, so the trigger is never *seen* animating — visually
 *   identical to hard-cutting it, except on the frame it would be blank.
 * - Closing: `old` is the item (already on-screen and painted) and stays
 *   opaque; `new` is the trigger, hard-cut to 0 so a scrolled-away/unpainted
 *   trigger can't ghost over the item as it shrinks back.
 *
 * Returns a state handle; pass it to {@link clearMorphState} so a stale
 * finalizer can never wipe a newer morph's state (see {@link morphStateOwner}).
 */
function applyMorphState(
  docEl: HTMLElement,
  phase: 'opening' | 'closing',
  opts: {
    useCrossfade: boolean;
    fromRadius: string | null;
    toRadius: string | null;
    preset: boolean | LightboxViewTransitionPreset | undefined;
  },
): MorphDocState {
  // Detect BEFORE this morph names its own targets (setMorphName runs after),
  // so the inline-style probe can't match the morph's own names.
  const needsIsolation = pageNeedsNameIsolation();

  // Keyframes first, attributes second: the attribute flips arm static rules
  // that reference the keyframes by name, so the rule must already be in the
  // sheet when the first armed style resolves.
  const radiusSheet = insertDynamicRules(
    'morph-keyframes',
    [buildMorphRadiusKeyframes(opts)],
    MORPH_RADIUS_MARKER,
  );

  docEl.setAttribute(LightboxDocumentDataAttributes.viewTransition, phase);
  docEl.setAttribute(
    LightboxDocumentDataAttributes.viewTransitionPreset,
    isViewTransitionPreset(opts.preset) ? opts.preset : 'default',
  );
  if (opts.useCrossfade) {
    docEl.setAttribute(LightboxDocumentDataAttributes.crossfade, '');
  }
  if (needsIsolation) {
    docEl.setAttribute(LightboxDocumentDataAttributes.viewTransitionIsolate, '');
  }
  return { owner: ++morphStateOwner, radiusSheet };
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

/**
 * Tears down the state set by {@link applyMorphState}. The radius keyframes
 * are released unconditionally — each morph owns its own insertion, and a
 * newer morph's same-name rule sorts later so the stale one is already
 * shadowed. The shared `<html>` attributes are only removed if `state` still
 * owns them, so a stale finalizer can't wipe a newer morph's attributes (see
 * {@link morphStateOwner}).
 */
function clearMorphState(docEl: HTMLElement, state: MorphDocState) {
  state.radiusSheet.release();
  if (state.owner !== morphStateOwner) return;
  docEl.removeAttribute(LightboxDocumentDataAttributes.viewTransition);
  docEl.removeAttribute(LightboxDocumentDataAttributes.crossfade);
  docEl.removeAttribute(LightboxDocumentDataAttributes.viewTransitionPreset);
  docEl.removeAttribute(LightboxDocumentDataAttributes.viewTransitionIsolate);
}

// ---------------------------------------------------------------------------
// Morph runtime (lazy-loaded from Root)
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
  onBeforeOpenRef: InitializedRef<
    | ((ctx: { destination: Element | null; signal: AbortSignal }) => void | Promise<void>)
    | undefined
  >;
  /** Holds the AbortController for the in-flight `onBeforeOpen` (if any). */
  beforeOpenAbortRef: React.MutableRefObject<AbortController | null>;
  triggerElementsRef: InitializedRef<Map<number, HTMLElement>>;
  /** Trigger element → its designated morph descendant (see findTriggerMorphTarget). */
  triggerMorphElementsRef: InitializedRef<WeakMap<HTMLElement, HTMLElement>>;
  activeItemElementRef: React.RefObject<HTMLElement | null>;
  /** Item element → its designated morph descendant (see findItemMorphTarget). */
  itemMorphElementsRef: InitializedRef<WeakMap<HTMLElement, HTMLElement>>;
  /**
   * Shared capture destination from Stage `morphRef`. When set, the VT
   * names this node instead of the active item.
   */
  destinationMorphElementRef: React.RefObject<HTMLElement | null>;
  openingTriggerIndexRef: InitializedRef<number>;
  /**
   * Exact opening trigger (click or handle + triggerId). Preferred over the
   * index map so morph is correct when several triggers share one index.
   */
  openingTriggerElementRef: React.RefObject<HTMLElement | null>;
  activeIndexRef: InitializedRef<number>;
  /**
   * The Root's `viewTransition` prop value. Named presets select the morph
   * timing (see vt-timing.ts); `true`/unknown values run the default preset.
   */
  transitionPreset: boolean | LightboxViewTransitionPreset | undefined;
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
  /** flushSync body that hides the viewer; unmount waits for onCloseComplete. */
  commitClose: () => void;
  /** Fired once the open morph settles (and its generation is still current). */
  onOpenComplete: () => void;
  /**
   * Fired once the close morph settles (and its generation is still current).
   * Receives the resolved trigger element so the caller can restore focus.
   */
  onCloseComplete: (triggerEl: HTMLElement | undefined) => void;
  /**
   * Active slide zoom controls. On Firefox close morph, calls `reset(true)`
   * when zoomed so the old VT snapshot captures resting (unclipped) Media.
   */
  activeZoomRef: React.RefObject<{
    reset: (rapid?: boolean) => void;
    getZoom: () => number;
  } | null>;
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
 *
 * Not a hook — Root lazy-loads this module and constructs one instance.
 */
function createViewTransitionMorph(getConfig: () => ViewTransitionMorphConfig): ViewTransitionMorph {
  const open = async () => {
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
    } = getConfig();

    const docEl = document.documentElement;
    const gen = closeGenRef.current;

    // Swallow touch panning for the whole open morph — from prepare (viewer
    // hidden, page not yet locked) through the transition itself, when hit
    // testing resolves to <html> and an upward pan would expand iOS Safari's
    // address bar, resizing the viewport mid-morph. Idempotent; released on
    // every bail path below and in the finished finalizer.
    const releaseTouchGuard = acquireVtTouchGuard();

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
      // Decode waits on the item (Media / image), not a shared Stage surface.
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
        if (getConfig().closeGenRef.current !== gen) {
          if (beforeOpenAbortRef.current === beforeOpenAbort) {
            beforeOpenAbortRef.current = null;
          }
          releaseTouchGuard();
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
      const destination = findDestinationMorphTarget(
        pendingItemEl,
        itemMorphElementsRef.current,
        getConfig().destinationMorphElementRef.current,
      );
      try {
        await onBeforeOpen({ destination, signal: beforeOpenAbort.signal });
      } catch {
        // Ignore abort / consumer errors — tear down prepare if this open is
        // still current; a superseding open/close already owns the tree.
        if (beforeOpenAbortRef.current === beforeOpenAbort) {
          beforeOpenAbortRef.current = null;
        }
        if (getConfig().closeGenRef.current === gen) {
          flushSync(commitAbortPrepare);
        }
        releaseTouchGuard();
        return;
      }
      if (beforeOpenAbortRef.current === beforeOpenAbort) {
        beforeOpenAbortRef.current = null;
      }
      if (getConfig().closeGenRef.current !== gen) {
        releaseTouchGuard();
        return;
      }
      // Aborted without throw (signal only) — same cleanup as supersede.
      if (beforeOpenAbort.signal.aborted) {
        flushSync(commitAbortPrepare);
        releaseTouchGuard();
        return;
      }
    } else if (beforeOpenAbortRef.current === beforeOpenAbort) {
      beforeOpenAbortRef.current = null;
    }

    // Don't capture while Android Chrome's URL bar is still moving. Desktop
    // and WebKit skip this — they don't share that snapshot-root abort.
    if (shouldWaitForSnapshotRootSettle()) {
      await waitForStableSnapshotRoot();
      if (getConfig().closeGenRef.current !== gen) {
        flushSync(commitAbortPrepare);
        releaseTouchGuard();
        return;
      }
    }

    // Read the destination item's border-radius here, after the mount. The
    // slides' layout effect (measureGeometry) has already forced layout during
    // commitPrepare above, so style/layout are clean and this read is cheap —
    // and it lets the transition callback below stay pure-writes (no reads),
    // which avoids a forced reflow *inside* the render-suppressed VT callback.
    // Radius is unaffected by the `visibility: hidden` prepare state.
    const itemElPrep = activeItemElementRef.current;
    const itemTargetPrep = findDestinationMorphTarget(
      itemElPrep,
      itemMorphElementsRef.current,
      getConfig().destinationMorphElementRef.current,
    );

    // Decide whether to morph. A morph needs both a trigger (the "old" group)
    // and a destination whose size we can resolve (the "new" group). If the
    // destination image never loaded/decoded within the timeout its box is 0×0,
    // and morphing the trigger into it just shrinks it into the corner/center.
    // In that case, skip the morph and fall back to a plain root crossfade.
    const canMorph = !!triggerTarget && isMorphTargetSizeResolvable(itemTargetPrep);

    // Dev nudge: a morph into the bare item container means the consumer forgot
    // to designate a morph target (imageRef / morphRef). Skip when Stage
    // `morphRef` owns the capture destination.
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

    // In the fallback we force the root crossfade on (`data-ramka-crossfade`)
    // and set no morph name/radius, so the transition is a clean fade.
    const morphState = applyMorphState(docEl, 'opening', {
      useCrossfade: canMorph ? useCrossfade : true,
      fromRadius: canMorph ? fromRadius : null,
      toRadius,
      preset: getConfig().transitionPreset,
    });

    if (canMorph) {
      // Inline `!important` so the document-level isolation rule (which sets
      // `view-transition-name: none !important` on every element during the
      // morph) can't neutralize the one element we actually want captured.
      // Shape (border-radius) is owned entirely by the VT group CSS + the
      // from/to vars written above — we never mutate live element radii.
      setMorphName(triggerTarget!);
    }

    // Restored after the open morph; applied inside the VT callback so only the
    // "new" (destination) snapshot sees the Firefox full-bleed inset.
    let restoreFirefoxCaptureInset: CaptureInsetRestore | null = null;

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
      // Exception: Firefox full-bleed capture inset (below) must measure + write
      // before the new snapshot is taken.
      const itemEl = activeItemElementRef.current;
      if (canMorph) {
        const itemTarget = findDestinationMorphTarget(
          itemEl,
          itemMorphElementsRef.current,
          getConfig().destinationMorphElementRef.current,
        );
        if (itemTarget) {
          setMorphName(itemTarget);
          restoreFirefoxCaptureInset = applyFirefoxFullBleedCaptureInset(itemTarget);
        }
      }
      if (itemEl) {
        itemEl.setAttribute('data-skip-fade', '');
      }
    });
    if (canMorph) {
      maybeUpgradeToCompositedMorph(transition, { from: fromRadius, to: toRadius });
    }

    transition.finished.finally(() => {
      releaseTouchGuard();
      restoreFirefoxCaptureInset?.();
      restoreFirefoxCaptureInset = null;
      clearMorphState(docEl, morphState);
      if (getConfig().closeGenRef.current !== gen) return;
      const cfg = getConfig();
      const itemEl = cfg.activeItemElementRef.current;
      const itemTarget = findDestinationMorphTarget(
        itemEl,
        cfg.itemMorphElementsRef.current,
        cfg.destinationMorphElementRef.current,
      );
      if (itemTarget) {
        clearMorphName(itemTarget);
      }

      // Reposition the active trigger while the viewer still covers the page
      // (and scroll is locked), so a later close morph lands on-screen with no
      // visible jump at close start. Invisible now; only pays off on close.
      const openCompleteScroll = resolveScrollTriggerOption(
        cfg.scrollTriggerIntoView,
        'onOpenComplete',
      );
      if (openCompleteScroll) {
        const idx = resolveTriggerIndex(
          cfg.activeIndexRef.current,
          cfg.morphTo,
          cfg.openingTriggerIndexRef.current,
          cfg.triggerElementsRef.current,
        );
        scrollTriggerEl(cfg.triggerElementsRef.current.get(idx), openCompleteScroll);
      }

      cfg.onOpenComplete();
    });
  };

  const close = () => {
    const {
      morphTo,
      scrollTriggerIntoView,
      triggerElementsRef,
      triggerMorphElementsRef,
      activeItemElementRef,
      itemMorphElementsRef,
      destinationMorphElementRef,
      openingTriggerIndexRef,
      activeIndexRef,
      closeGenRef,
      commitClose,
    } = getConfig();

    const docEl = document.documentElement;
    const gen = closeGenRef.current;

    // Same guard as the open morph: the portal is hidden until close
    // `finished`, so a touch pan can resolve to <html> and expand Safari's
    // address bar mid-morph.
    const releaseTouchGuard = acquireVtTouchGuard();

    const itemEl = activeItemElementRef.current;
    const itemTarget = findDestinationMorphTarget(
      itemEl,
      itemMorphElementsRef.current,
      destinationMorphElementRef.current,
    );
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
    const morphState = applyMorphState(docEl, 'closing', {
      useCrossfade,
      fromRadius,
      toRadius,
      preset: getConfig().transitionPreset,
    });

    // Firefox: zoomed Media is painted under scale/pan and clipped by ancestor
    // overflow into the named VT snapshot. Instant reset (replacePose) so the
    // old snapshot is the resting, unclipped box. Chrome/Safari capture correctly
    // while zoomed — leave their live pose alone. Animated reset() would leave
    // capture mid-zoom.
    if (isFirefox()) {
      const activeZoom = getConfig().activeZoomRef.current;
      if (activeZoom && activeZoom.getZoom() > 1) {
        activeZoom.reset(true);
      }
    }

    // Inset before startViewTransition so the "old" (item) snapshot is not
    // captured edge-to-edge — Firefox full-bleed VT bug. Order: zoom reset →
    // inset → morph name → capture.
    let restoreFirefoxCaptureInset: CaptureInsetRestore | null = null;
    if (canMorph) {
      restoreFirefoxCaptureInset = applyFirefoxFullBleedCaptureInset(itemTarget!);
      setMorphName(itemTarget!);
    }

    const transition = startViewTransition(() => {
      restoreFirefoxCaptureInset?.();
      restoreFirefoxCaptureInset = null;
      if (canMorph) {
        clearMorphName(itemTarget!);
      }
      flushSync(commitClose);
      const closeScroll = resolveScrollTriggerOption(scrollTriggerIntoView, 'onClose');
      if (closeScroll) {
        scrollTriggerEl(triggerEl, closeScroll);
      }
      if (canMorph) {
        setMorphName(triggerTarget!);
      }
    });
    if (canMorph) {
      maybeUpgradeToCompositedMorph(transition, { from: fromRadius, to: toRadius });
    }

    transition.finished.finally(() => {
      releaseTouchGuard();
      restoreFirefoxCaptureInset?.();
      restoreFirefoxCaptureInset = null;
      if (canMorph) {
        clearMorphName(triggerTarget!);
      }
      clearMorphState(docEl, morphState);
      if (getConfig().closeGenRef.current === gen) {
        getConfig().onCloseComplete(triggerEl);
      }
    });
  };

  return { open, close };
}

export {
  createViewTransitionMorph,
  startViewTransition,
  waitForImageDecode,
  scrollTriggerEl,
  resolveTriggerIndex,
  resolveScrollTriggerOption,
  getFullBleedAxes,
  isHorizontallyFullBleed,
  isVerticallyFullBleed,
  applyFirefoxFullBleedCaptureInset,
  DEFAULT_DECODE_MAX_WAIT,
};
export type { ViewTransitionMorphConfig, ViewTransitionMorph };
export type {
  ScrollTriggerIntoView,
  ScrollTriggerOption,
  ScrollTriggerMoment,
  ScrollTriggerAlign,
  ResolvedScrollTrigger,
} from './scroll-trigger';
