'use client';

import * as React from 'react';
import { flushSync } from 'react-dom';

import {
  resolveMorphBorderRadius,
  startViewTransition,
} from '../lightbox/use-view-transition-morph';

// ---------------------------------------------------------------------------
// Contract constants
// ---------------------------------------------------------------------------
// All names are distinct from the Lightbox morph contract (`lightbox-morph`,
// `data-ramka-view-transition`, `--lightbox-*`) so both can coexist on a page.

/** view-transition-name applied to the source/target for the morph. A single
 * fixed name is deliberate: only one dialog morph runs at a time, the name is
 * applied inline only for the duration of the transition, and a static name
 * lets the injected CSS target `::view-transition-group(...)` without
 * `view-transition-class` (not yet reliable cross-browser). */
const MORPH_NAME = 'ramka-dialog-morph';

/** view-transition-name for the LIVE trigger during the open morph. On
 * close the trigger is the morph pair's NEW image and therefore re-rendered
 * live every frame — which is what lets animateLiveRadiusCompensation keep
 * its corners glued to the group's animated clip. On open the trigger would
 * be the pair's OLD image: a static snapshot with its corners baked in,
 * stretched to the growing box, impossible to correct after capture. So on
 * open the pair's old snapshot is hidden entirely and the trigger is
 * renamed into this new-only group instead, which renders the trigger LIVE
 * on top of the panel group (same stacking as close, where the trigger is
 * the top image). The hook drives this group along the pair's exact
 * geometry trajectory and clip, and compensates the live trigger's radius —
 * so both layers share one shape at every frame, on both legs. */
const TRIGGER_NAME = 'ramka-dialog-morph-trigger';

/** view-transition-name for the dialog overlay/backdrop, when registered.
 * Safari and Firefox don't paint `backdrop-filter` into view-transition
 * snapshot layers (WebKit bug 293393, Gecko bug 1996597), so an overlay blur
 * would pop in only after the transition finishes. Per the CSSWG resolution
 * for csswg-drafts#9358, the fix is to move the backdrop-filter onto the
 * element's `::view-transition-group()` pseudo — group pseudos are painted
 * live every frame and blur whatever renders beneath them in the pseudo
 * tree. The hook copies the overlay's computed backdrop-filter into
 * `--ramka-dialog-morph-overlay-backdrop` and the injected CSS animates it
 * on the group. */
const OVERLAY_NAME = 'ramka-dialog-morph-overlay';

/** `<html>` attribute carrying the morph phase (`opening` | `closing`). */
const DOC_ATTR = 'data-ramka-dialog-morph';

/** Present on the source element while the dialog is open — the injected CSS
 * hides it so the trigger doesn't peek out from behind the dialog. */
const SOURCE_HIDDEN_ATTR = 'data-ramka-dialog-morph-source';

/** Set on the panel inside the close transition. Dialog libraries keep the
 * panel mounted after `open=false` to wait out their exit animation — but the
 * `::view-transition-new(root)` layer renders the LIVE page, so a lingering
 * panel would show next to the morphing snapshot like a clone. The injected
 * CSS `display: none`s it (attribute + `!important` so a library re-render
 * can't wipe it, unlike an inline style), which also cancels any exit
 * animation/transition so unmount-on-animation-end resolves immediately.
 * Sticky until the element unmounts. */
const TARGET_EXITING_ATTR = 'data-ramka-dialog-morph-exiting';

/** Full-duration radius keyframes on the morph group. Its `animationend`
 * (dispatched on the root with `pseudoElement` set) lands on the pseudo-tree
 * teardown frame in every engine, unlike the `finished` promise which can
 * resolve a paint later (notably in Safari) — so it doubles as the signal
 * for restoring the live element's suppressed border-radius. */
const RADIUS_ANIMATION = 'ramka-dialog-morph-radius';

/** Dissolve keyframes name. */
const FADE_OUT_ANIMATION = 'ramka-dialog-morph-fade-out';

/** Keyframes name for the live-trigger group's geometry on open. A new-only
 * group gets no UA morph, so the hook injects per-transition keyframes
 * (trigger rect → panel rect) under this name — see
 * setTriggerGeometryKeyframes. Driven as a CSS animation rather than WAAPI
 * so it starts on the exact frame the pseudo tree appears (in lockstep with
 * the pair's UA animation and the radius clip) and works in engines without
 * `pseudoElement` support in `element.animate()`. */
const TRIGGER_GEOMETRY_ANIMATION = 'ramka-dialog-morph-trigger-geom';

const GEOMETRY_STYLE_ELEMENT_ID = 'ramka-dialog-morph-trigger-geom-styles';

const VAR_RADIUS_FROM = '--ramka-dialog-morph-radius-from';
const VAR_RADIUS_TO = '--ramka-dialog-morph-radius-to';
const VAR_DURATION = '--ramka-dialog-morph-duration';
const VAR_OVERLAY_BACKDROP = '--ramka-dialog-morph-overlay-backdrop';

const STYLE_ELEMENT_ID = 'ramka-dialog-morph-styles';

// ---------------------------------------------------------------------------
// Injected stylesheet
// ---------------------------------------------------------------------------
// Self-contained so the primitive is a single import. Theme via CSS vars on
// :root — `--ramka-dialog-morph-duration` / `--ramka-dialog-morph-easing` /
// `--ramka-dialog-morph-root-easing`.

const MORPH_CSS = /* css */ `
[${SOURCE_HIDDEN_ATTR}] {
  opacity: 0 !important;
}

[${TARGET_EXITING_ATTR}] {
  display: none !important;
}

@media (prefers-reduced-motion: no-preference) {
  /* Isolation: while a dialog morph runs, no other element keeps a
     view-transition-name (the morph elements are named inline with
     !important, which outranks this rule). Prevents unrelated named elements
     from tearing out of the root crossfade mid-morph. */
  :root[${DOC_ATTR}] * {
    view-transition-name: none !important;
  }

  :root[${DOC_ATTR}]::view-transition-old(root),
  :root[${DOC_ATTR}]::view-transition-new(root) {
    animation-duration: var(${VAR_DURATION}, 450ms);
    animation-timing-function: var(--ramka-dialog-morph-root-easing, cubic-bezier(0.16, 1, 0.3, 1));
  }

  @keyframes ${RADIUS_ANIMATION} {
    to {
      border-radius: var(${VAR_RADIUS_TO}, 0px);
    }
  }

  :root[${DOC_ATTR}]::view-transition-group(${MORPH_NAME}) {
    overflow: hidden;
    border-radius: var(${VAR_RADIUS_FROM}, 0px);
    animation-duration: var(${VAR_DURATION}, 450ms);
    animation-timing-function: var(--ramka-dialog-morph-easing, cubic-bezier(0.32, 0.72, 0, 1));
    animation-fill-mode: both;
    z-index: 2;
  }
  /* On open the panel's group is new-only (the trigger keeps its own name
     through the capture — renaming an element inside the callback makes
     WebKit render its live image blank), so the UA gives it no geometry
     morph; it flies on the same injected keyframes as the trigger group. */
  :root[${DOC_ATTR}='opening']::view-transition-group(${MORPH_NAME}) {
    animation-name: ${TRIGGER_GEOMETRY_ANIMATION}, ${RADIUS_ANIMATION};
  }
  :root[${DOC_ATTR}='closing']::view-transition-group(${MORPH_NAME}) {
    animation-name: -ua-view-transition-group-anim-${MORPH_NAME}, ${RADIUS_ANIMATION};
  }

  /* Both snapshots stretch to the morphing box; the dissolve hides the
     stretch. Normal blending (not the UA's plus-lighter): a light trigger
     must never glow through a dark panel or vice versa. */
  :root[${DOC_ATTR}]::view-transition-old(${MORPH_NAME}),
  :root[${DOC_ATTR}]::view-transition-new(${MORPH_NAME}) {
    width: 100%;
    height: 100%;
    object-fit: fill;
    mix-blend-mode: normal;
  }

  @keyframes ${FADE_OUT_ANIMATION} {
    from { opacity: 1; }
    to { opacity: 0; }
  }
  @keyframes ramka-dialog-morph-fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  /* Opening: the trigger rides just the first frames of the morph
     (ease-in dissolve — so saturated triggers like a colored pill don't
     wash out on frame two), is gone by ~15%, and the panel is opaque by
     ~55% — the rest is a pure morph of the opaque panel. The trigger
     group's old (static, stretched) snapshot is hidden: the trigger
     renders LIVE via the group's new image instead. */
  :root[${DOC_ATTR}='opening']::view-transition-old(${TRIGGER_NAME}) {
    animation: none;
    opacity: 0;
  }
  :root[${DOC_ATTR}='opening']::view-transition-new(${MORPH_NAME}) {
    animation: ramka-dialog-morph-fade-in calc(var(${VAR_DURATION}, 450ms) * 0.55) ease-out both;
  }

  /* The live-trigger group (open only). Rides the same injected geometry
     keyframes and radius clip as the panel's group — identical CSS
     animations with one duration/easing, so the two groups' boxes and
     corners coincide on every frame (the UA's own group animation, a no-op
     trigger-to-trigger morph, is replaced by the animation-name here). */
  :root[${DOC_ATTR}='opening']::view-transition-group(${TRIGGER_NAME}) {
    overflow: hidden;
    border-radius: var(${VAR_RADIUS_FROM}, 0px);
    animation-name: ${TRIGGER_GEOMETRY_ANIMATION}, ${RADIUS_ANIMATION};
    animation-duration: var(${VAR_DURATION}, 450ms);
    animation-timing-function: var(--ramka-dialog-morph-easing, cubic-bezier(0.32, 0.72, 0, 1));
    animation-fill-mode: both;
    z-index: 3;
  }
  :root[${DOC_ATTR}='opening']::view-transition-new(${TRIGGER_NAME}) {
    width: 100%;
    height: 100%;
    object-fit: fill;
    mix-blend-mode: normal;
    animation: ${FADE_OUT_ANIMATION} calc(var(${VAR_DURATION}, 450ms) * 0.15)
      cubic-bezier(0.4, 0, 1, 1) both;
  }

  /* Closing: the panel dissolves over the first 30% of the morph while the
     trigger fades back in beneath it — the rest is a pure morph of the
     trigger flying home. */
  :root[${DOC_ATTR}='closing']::view-transition-old(${MORPH_NAME}) {
    animation: ${FADE_OUT_ANIMATION} calc(var(${VAR_DURATION}, 450ms) * 0.3)
      cubic-bezier(0.4, 0, 1, 1) both;
  }
  :root[${DOC_ATTR}='closing']::view-transition-new(${MORPH_NAME}) {
    animation: ramka-dialog-morph-fade-in var(${VAR_DURATION}, 450ms) ease-out both;
  }

  /* Overlay backdrop-filter — see OVERLAY_NAME. The filter lives on the
     group pseudo (live-rendered, so it blurs the root layer beneath it even
     in engines that drop backdrop-filter from snapshot captures) and is
     animated so the blur ramps with the morph instead of popping. The
     overlay's own snapshots (the tint) crossfade over the full duration. */
  :root[${DOC_ATTR}]::view-transition-group(${OVERLAY_NAME}) {
    z-index: 1;
  }
  :root[${DOC_ATTR}]::view-transition-old(${OVERLAY_NAME}),
  :root[${DOC_ATTR}]::view-transition-new(${OVERLAY_NAME}) {
    animation-duration: var(${VAR_DURATION}, 450ms);
  }

  @keyframes ramka-dialog-morph-backdrop-in {
    from {
      -webkit-backdrop-filter: none;
      backdrop-filter: none;
    }
    to {
      -webkit-backdrop-filter: var(${VAR_OVERLAY_BACKDROP}, none);
      backdrop-filter: var(${VAR_OVERLAY_BACKDROP}, none);
    }
  }
  @keyframes ramka-dialog-morph-backdrop-out {
    from {
      -webkit-backdrop-filter: var(${VAR_OVERLAY_BACKDROP}, none);
      backdrop-filter: var(${VAR_OVERLAY_BACKDROP}, none);
    }
    to {
      -webkit-backdrop-filter: none;
      backdrop-filter: none;
    }
  }

  :root[${DOC_ATTR}='opening']::view-transition-group(${OVERLAY_NAME}) {
    animation: ramka-dialog-morph-backdrop-in var(${VAR_DURATION}, 450ms) ease-out both;
  }
  :root[${DOC_ATTR}='closing']::view-transition-group(${OVERLAY_NAME}) {
    animation: ramka-dialog-morph-backdrop-out var(${VAR_DURATION}, 450ms) ease-out both;
  }
}
`;

/** Injects the morph stylesheet once per document (no-op on re-mounts). */
function ensureMorphStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ELEMENT_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ELEMENT_ID;
  style.textContent = MORPH_CSS;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function supportsViewTransitions(): boolean {
  return (
    typeof document !== 'undefined' &&
    'startViewTransition' in document &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Inline `!important` so the isolation rule can't neutralize the morph
 * elements — mirrors the Lightbox morph naming. */
function setMorphName(el: HTMLElement, name: string = MORPH_NAME) {
  el.style.setProperty('view-transition-name', name, 'important');
}

function clearMorphName(el: HTMLElement | null) {
  el?.style.removeProperty('view-transition-name');
}

/** The dialog's own open/close animations (e.g. shadcn's `zoom-in-95` /
 * `fade-in-0`) must not run inside the morphing snapshot — the new snapshot
 * renders the LIVE element, so a mount animation would play inside the
 * morphing group and fight the geometry animation. Suppressed for the
 * element's whole lifetime, NOT restored when the morph finishes: removing
 * the override would re-apply the library's `animation` declaration, and a
 * freshly applied CSS animation restarts from frame 0 — the settled dialog
 * would replay its mount animation as a visible flash. The dialog keeps its
 * normal animations whenever the morph can't run (reduced motion, no browser
 * support, no trigger), since this is never called on those paths. */
function suppressAnimations(el: HTMLElement) {
  el.style.setProperty('animation', 'none', 'important');
}

/** Squares the corners of the PANEL for the open morph — the only element
 * that is ever squared. The geometry, from first principles: snapshots
 * render WITH the element's border-radius baked in as transparent corners,
 * then stretch to the group box. A snapshot scaled DOWN has baked corners
 * smaller than the group's animated radius clip, so the clip owns the
 * visible shape; a snapshot scaled UP has baked corners that grow past the
 * clip and would define the silhouette themselves (the morph reads as a
 * plain scale). The trigger is the scaled-up image on both legs:
 *
 * - OPEN: the panel — the pair's new image, live-rendered every frame — is
 *   squared here so it always fills the box out to the clip (compressed
 *   early on, its baked corners would fall short of the clip and leave
 *   see-through corner gaps). The trigger renders LIVE in its own group on
 *   top with its radius compensation-animated — see TRIGGER_NAME and
 *   animateLiveRadiusCompensation.
 * - CLOSE: the trigger (the pair's new image, live) stretches early, and
 *   squaring it would be actively wrong: its border is painted along the
 *   squared perimeter and the group's rounded clip chops it off at every
 *   corner, which shows as a broken/discontinuous border on the trigger for
 *   the whole close. Its radius is compensation-animated instead — see
 *   animateLiveRadiusCompensation.
 *
 * Squaring happens only inside the update callback — strictly while the
 * pseudo tree covers the page — so the square state can never paint live. */
function suppressRadius(el: HTMLElement) {
  // Elements may carry CSS transitions with `transition-property: all` (the
  // shadcn popup's `duration-100` does) — without this, the radius change
  // would ANIMATE into the capture instead of being instantly square.
  el.style.setProperty('transition', 'none', 'important');
  el.style.setProperty('border-radius', '0px', 'important');
}

function restoreRadius(el: HTMLElement | null) {
  if (!el) return;
  el.style.removeProperty('border-radius');
  // Flush the restored radius while transitions are still disabled, then
  // re-enable them — otherwise the corners would visibly transition from
  // square to rounded right after the morph.
  void el.offsetWidth;
  el.style.removeProperty('transition');
}

/** Restores a suppressed radius on the pseudo-tree teardown frame. The
 * radius keyframes' `animationend` fires exactly there in Chromium, WebKit,
 * and Gecko, while the `finished` promise can resolve a paint LATER (notably
 * in Safari) — which would show one frame of square corners. Restoring at
 * `animationend` is safe even if it lands a frame before teardown: by then
 * the group clip has settled on the element's real radius and the
 * live-rendered image is at natural scale, so square vs rounded snapshots
 * are pixel-identical. `finished` stays as the fallback (skipped
 * transitions, reduced motion mid-flight). */
function scheduleRadiusRestore(getEl: () => HTMLElement | null, finished: Promise<unknown>) {
  const docEl = document.documentElement;
  const release = () => {
    docEl.removeEventListener('animationend', onAnimationDone);
    docEl.removeEventListener('animationcancel', onAnimationDone);
    restoreRadius(getEl());
  };
  function onAnimationDone(event: AnimationEvent) {
    if (event.animationName !== RADIUS_ANIMATION) return;
    release();
  }
  docEl.addEventListener('animationend', onAnimationDone);
  docEl.addEventListener('animationcancel', onAnimationDone);
  finished.finally(release);
}

// Defaults mirrored from the injected CSS (`var(..., 450ms)` / the group's
// easing fallback) — used when the consumer hasn't themed the root vars.
const DEFAULT_DURATION_MS = 450;
const DEFAULT_EASING: readonly [number, number, number, number] = [0.32, 0.72, 0, 1];

function parseDurationMs(raw: string): number {
  const value = raw.trim();
  const num = Number.parseFloat(value);
  if (!value || Number.isNaN(num)) return DEFAULT_DURATION_MS;
  return value.endsWith('ms') ? num : value.endsWith('s') ? num * 1000 : num;
}

const EASING_KEYWORDS: Record<string, readonly [number, number, number, number]> = {
  linear: [0, 0, 1, 1],
  ease: [0.25, 0.1, 0.25, 1],
  'ease-in': [0.42, 0, 1, 1],
  'ease-out': [0, 0, 0.58, 1],
  'ease-in-out': [0.42, 0, 0.58, 1],
};

function parseEasing(raw: string): readonly [number, number, number, number] {
  const value = raw.trim();
  if (!value) return DEFAULT_EASING;
  const keyword = EASING_KEYWORDS[value];
  if (keyword) return keyword;
  const match = /cubic-bezier\(([^)]+)\)/.exec(value);
  const nums = match?.[1]!.split(',').map((n) => Number.parseFloat(n));
  if (!nums || nums.length !== 4 || nums.some(Number.isNaN)) return DEFAULT_EASING;
  return nums as unknown as readonly [number, number, number, number];
}

/** y(x) for a CSS cubic-bezier timing function (bisection — robust and only
 * run once per morph over ~30 samples). */
function cubicBezierProgress(
  [x1, y1, x2, y2]: readonly [number, number, number, number],
  x: number,
): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const sample = (a1: number, a2: number, t: number) =>
    3 * a1 * t * (1 - t) * (1 - t) + 3 * a2 * t * t * (1 - t) + t * t * t;
  let lo = 0;
  let hi = 1;
  let t = x;
  for (let i = 0; i < 24; i++) {
    const cx = sample(x1, x2, t);
    if (Math.abs(cx - x) < 1e-4) break;
    if (cx < x) lo = t;
    else hi = t;
    t = (lo + hi) / 2;
  }
  return sample(y1, y2, t);
}

/** Expands a resolved radius list ("8px" | "8px 12px" | …) to 4 corner
 * values, following the CSS shorthand expansion. */
function expandRadiusList(list: string): [number, number, number, number] {
  const [a = 0, b = a, c = a, d = b] = list.split(' ').map((v) => Number.parseFloat(v) || 0);
  return [a, b, c, d];
}

/** Keeps a LIVE-rendered trigger's corners glued to the group's animated
 * radius clip, on both legs. The trigger's live render is captured at its
 * natural size and stretched — anisotropically — to the group box, so its
 * baked corners would otherwise render as big ellipses (e.g. a card
 * stretched to panel height is scaled ~5× vertically but barely
 * horizontally) that ignore the clip. Squaring it instead would chop its
 * border against the rounded clip (see suppressRadius).
 *
 * Because the image re-renders the live element every frame, the trigger's
 * border-radius can be animated so that AFTER the stretch it equals the
 * clip at every moment: per axis, radius(t) = clip(t) / scale(t), where
 * scale is measured against `natural` (the trigger's own rect — the box's
 * end on close, its start on open). The group's size, the clip, and this
 * compensation all follow the same duration + easing (baked into sampled
 * keyframes, played linearly), so they stay in lockstep. On close the last
 * keyframe IS the trigger's natural radius, so teardown needs no restore
 * step — nothing to race, nothing to flash; on open the trigger is hidden
 * long before the end. Driven by WAAPI, which also outranks any CSS
 * `transition: all` on the element. */
function animateLiveRadiusCompensation(
  el: HTMLElement,
  boxFrom: DOMRect,
  boxTo: DOMRect,
  radiusFrom: string,
  radiusTo: string,
  natural: DOMRect,
): Animation | null {
  if (!(natural.width > 0) || !(natural.height > 0)) return null;
  const docStyles = getComputedStyle(document.documentElement);
  const duration = parseDurationMs(docStyles.getPropertyValue(VAR_DURATION));
  const curve = parseEasing(docStyles.getPropertyValue('--ramka-dialog-morph-easing'));
  const from = expandRadiusList(radiusFrom);
  const to = expandRadiusList(radiusTo);

  const STEPS = 30;
  const keyframes: Keyframe[] = [];
  for (let i = 0; i <= STEPS; i++) {
    const p = cubicBezierProgress(curve, i / STEPS);
    const sx = (boxFrom.width + (boxTo.width - boxFrom.width) * p) / natural.width;
    const sy = (boxFrom.height + (boxTo.height - boxFrom.height) * p) / natural.height;
    const corners = from.map((f, corner) => f + (to[corner]! - f) * p);
    const rx = corners.map((r) => `${(r / sx).toFixed(2)}px`).join(' ');
    const ry = corners.map((r) => `${(r / sy).toFixed(2)}px`).join(' ');
    keyframes.push({ borderRadius: `${rx} / ${ry}`, offset: i / STEPS });
  }
  return el.animate(keyframes, { duration, easing: 'linear', fill: 'both' });
}

/** Open only: (re)writes the live-trigger group's geometry keyframes —
 * trigger rect → panel rect, the exact trajectory the UA morphs the pair's
 * group. Injected as CSS `@keyframes` (a dedicated style element, rewritten
 * per transition) and referenced statically from the injected stylesheet,
 * so the animation starts on the same frame as every other pseudo
 * animation. Only one dialog morph runs at a time, so a single keyframes
 * name is safe. */
function setTriggerGeometryKeyframes(fromRect: DOMRect, toRect: DOMRect) {
  let style = document.getElementById(GEOMETRY_STYLE_ELEMENT_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = GEOMETRY_STYLE_ELEMENT_ID;
    document.head.appendChild(style);
  }
  style.textContent = `
@keyframes ${TRIGGER_GEOMETRY_ANIMATION} {
  from {
    width: ${fromRect.width}px;
    height: ${fromRect.height}px;
    transform: translate(${fromRect.left}px, ${fromRect.top}px);
  }
  to {
    width: ${toRect.width}px;
    height: ${toRect.height}px;
    transform: translate(${toRect.left}px, ${toRect.top}px);
  }
}
`;
}

/** Best-effort alignment of a hook-driven WAAPI animation with the
 * transition's CSS pseudo animations. Animations created inside
 * `ready.then` get their start time resolved one rendering opportunity
 * AFTER the CSS animations (which start the frame the pseudo tree
 * appears), leaving the compensation a frame behind the geometry —
 * measurable as the live layer trailing the box. Copying the injected
 * radius animation's start time snaps them onto the same timeline
 * position. */
function syncWithGroupAnimations(anims: (Animation | null)[]) {
  let startTime: number | CSSNumberish | null = null;
  try {
    for (const anim of document.documentElement.getAnimations({ subtree: true })) {
      if (
        (anim as CSSAnimation).animationName === RADIUS_ANIMATION &&
        anim.startTime !== null
      ) {
        startTime = anim.startTime;
        break;
      }
    }
  } catch {
    // getAnimations may not surface pseudo animations everywhere.
  }
  if (startTime === null) startTime = document.timeline.currentTime;
  if (startTime === null) return;
  for (const anim of anims) {
    if (anim) anim.startTime = startTime;
  }
}

/** Copies the overlay's computed backdrop-filter to a root var (consumed by
 * the injected group-pseudo keyframes) and lifts the overlay into its own
 * view-transition group — see OVERLAY_NAME for why. Reading the computed
 * value keeps the primitive agnostic to how the consumer styles the blur. */
function captureOverlayBackdrop(docEl: HTMLElement, overlay: HTMLElement) {
  const style = getComputedStyle(overlay) as CSSStyleDeclaration & {
    webkitBackdropFilter?: string;
  };
  const backdrop = style.backdropFilter || style.webkitBackdropFilter || 'none';
  if (backdrop !== 'none') {
    docEl.style.setProperty(VAR_OVERLAY_BACKDROP, backdrop);
  }
  setMorphName(overlay, OVERLAY_NAME);
}

function clearDocumentState(docEl: HTMLElement) {
  docEl.removeAttribute(DOC_ATTR);
  docEl.style.removeProperty(VAR_RADIUS_FROM);
  docEl.style.removeProperty(VAR_RADIUS_TO);
  docEl.style.removeProperty(VAR_OVERLAY_BACKDROP);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface UseDialogMorphOptions {
  /**
   * Master switch — `false` returns an inert passthrough (plain state, no
   * view transitions, refs do nothing). Lets component libraries call the
   * hook unconditionally and expose morphing as an opt-in prop.
   * @default true
   */
  enabled?: boolean;
  /** Controlled open state. */
  open?: boolean;
  /** Uncontrolled initial open state. @default false */
  defaultOpen?: boolean;
  /** Called when the open state changes. Extra arguments from the dialog
   * library's own `onOpenChange` (e.g. Base UI event details) are forwarded.
   * Typed `any[]` so callbacks with library-specific detail params (like Base
   * UI's `DialogRootChangeEventDetails`) stay assignable. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onOpenChange?: (open: boolean, ...meta: any[]) => void;
}

interface DialogMorph {
  /** Resolved open state — pass to the dialog root's `open`. */
  open: boolean;
  /**
   * Routed setter — pass to the dialog root's `onOpenChange`. Flips the state
   * inside `document.startViewTransition` so the source morphs into the panel
   * (and back). Falls back to a plain flip without browser support, with
   * reduced motion, or when no source element is registered.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onOpenChange: (open: boolean, ...meta: any[]) => void;
  /** Callback ref for the morph source (the trigger element). */
  sourceRef: (el: HTMLElement | null) => void;
  /** Callback ref for the morph target (the dialog panel element). */
  targetRef: (el: HTMLElement | null) => void;
  /**
   * Optional callback ref for the dialog overlay/backdrop. Only needed when
   * the overlay uses `backdrop-filter`: Safari and Firefox don't paint
   * backdrop filters into view-transition snapshots, so an unregistered
   * blurred overlay pops in only after the morph finishes. Registering it
   * lets the hook re-create the blur on a live `::view-transition-group()`
   * pseudo and ramp it with the morph.
   */
  overlayRef: (el: HTMLElement | null) => void;
  /** Echo of `options.enabled` — handy for conditional context values. */
  enabled: boolean;
}

/**
 * Standalone trigger → dialog morph for any dialog with a controlled
 * `open`/`onOpenChange` (Base UI, Radix, shadcn wrappers, react-aria…).
 *
 * Extracted from the Lightbox's View Transition morph, minus everything
 * gallery-shaped: no index tracking, image decode waits, zoom, or gestures —
 * just the naming dance, radius interpolation, and crossfade contract.
 *
 * Wire three points, typically inside a component-library dialog definition:
 *
 * ```tsx
 * const morph = useDialogMorph({ enabled: props.morph, open, defaultOpen, onOpenChange });
 *
 * <DialogPrimitive.Root open={morph.open} onOpenChange={morph.onOpenChange}>
 *   <DialogPrimitive.Trigger ref={morph.sourceRef} />
 *   <DialogPrimitive.Backdrop ref={morph.overlayRef} />
 *   <DialogPrimitive.Popup ref={morph.targetRef} />
 * ```
 *
 * Styling is self-contained (a stylesheet is injected once per document);
 * theme with `--ramka-dialog-morph-duration` / `--ramka-dialog-morph-easing`
 * on `:root`. While the dialog is open the source carries
 * `data-ramka-dialog-morph-source` and is hidden.
 */
function useDialogMorph(options: UseDialogMorphOptions = {}): DialogMorph {
  const { enabled = true, open: openProp, defaultOpen = false, onOpenChange } = options;

  const isControlled = openProp !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const open = isControlled ? openProp : uncontrolledOpen;

  const openRef = React.useRef(open);
  openRef.current = open;
  const enabledRef = React.useRef(enabled);
  enabledRef.current = enabled;
  const isControlledRef = React.useRef(isControlled);
  isControlledRef.current = isControlled;
  const onOpenChangeRef = React.useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  const sourceElRef = React.useRef<HTMLElement | null>(null);
  const targetElRef = React.useRef<HTMLElement | null>(null);
  const overlayElRef = React.useRef<HTMLElement | null>(null);
  /** Generation guard: a superseding transition owns cleanup from then on. */
  const genRef = React.useRef(0);
  /** True while a morph is in flight — gates the sync effect below so it
   * can't hide the live trigger mid-open (it must stay visible in its
   * pseudo group until its dissolve completes). */
  const morphingRef = React.useRef(false);
  /** The in-flight radius compensation on the live trigger. Tracked so a
   * superseding transition can cancel it BEFORE reading geometry — a
   * mid-morph interrupt would otherwise resolve the trigger's compensated
   * (elliptical) radius as its real one and morph toward garbage. */
  const liveRadiusAnimRef = React.useRef<Animation | null>(null);

  React.useEffect(() => {
    if (enabled) ensureMorphStyles();
  }, [enabled]);

  const sourceRef = React.useCallback((el: HTMLElement | null) => {
    sourceElRef.current = el;
    // A source (re)mounted while open must be hidden immediately (e.g. a
    // list re-render swapping the trigger element behind the open dialog).
    // NOT during a morph though: the open transition re-attaches this ref
    // (the trigger re-renders with its expanded state inside the
    // transition's flushSync, and consumers pass merged refs with fresh
    // identities), and hiding here would blank the live trigger image for
    // the whole morph — the transition hides it itself once its dissolve
    // completes.
    if (el && enabledRef.current && openRef.current && !morphingRef.current) {
      el.setAttribute(SOURCE_HIDDEN_ATTR, '');
    }
  }, []);

  const targetRef = React.useCallback((el: HTMLElement | null) => {
    targetElRef.current = el;
    // Defensive: if a dialog library ever reuses the panel element across
    // close/open cycles, it must not inherit the sticky exit state.
    el?.removeAttribute(TARGET_EXITING_ATTR);
  }, []);

  const overlayRef = React.useCallback((el: HTMLElement | null) => {
    overlayElRef.current = el;
    el?.removeAttribute(TARGET_EXITING_ATTR);
  }, []);

  const commit = React.useCallback((value: boolean, meta: unknown[]) => {
    if (!isControlledRef.current) {
      setUncontrolledOpen(value);
    }
    onOpenChangeRef.current?.(value, ...meta);
  }, []);

  const handleOpenChange = React.useCallback(
    (next: boolean, ...meta: unknown[]) => {
      if (next === openRef.current) return;

      const source = sourceElRef.current;

      // Fallbacks: passthrough (disabled), unsupported browser, reduced
      // motion, or opening with no registered source (nothing to morph from —
      // let the dialog's own animations run instead).
      if (!enabledRef.current || !supportsViewTransitions() || (next && !source)) {
        commit(next, meta);
        if (enabledRef.current && source) {
          if (next) source.setAttribute(SOURCE_HIDDEN_ATTR, '');
          else source.removeAttribute(SOURCE_HIDDEN_ATTR);
        }
        return;
      }

      genRef.current += 1;
      const gen = genRef.current;
      morphingRef.current = true;
      const docEl = document.documentElement;

      // Interrupt hygiene: a superseding transition can arrive mid-morph.
      // Undo the previous leg's live radius override BEFORE any reads below,
      // or they'd see the compensated value instead of the element's own.
      liveRadiusAnimRef.current?.cancel();
      liveRadiusAnimRef.current = null;

      if (next) {
        // OPEN: the source is named into its own group BEFORE the capture
        // and keeps that name throughout — its group owns both the old
        // snapshot (hidden) and the live new image. Never rename across the
        // capture: WebKit renders the live image of a renamed element
        // blank. The callback flips state (mounting the dialog) and names
        // the panel, whose group is then new-only. Reads (radius, rect)
        // happen before writes to avoid forced reflows mid-capture.
        const fromRadius = resolveMorphBorderRadius(source!);
        const fromRect = source!.getBoundingClientRect();
        docEl.setAttribute(DOC_ATTR, 'opening');
        docEl.style.setProperty(VAR_RADIUS_FROM, fromRadius);
        setMorphName(source!, TRIGGER_NAME);

        // Measured inside the callback (the panel exists only then),
        // consumed on `ready` by the trigger-group animations below.
        let openTarget: { rect: DOMRect; radius: string } | null = null;

        const transition = startViewTransition(() => {
          flushSync(() => commit(true, meta));
          const target = targetElRef.current;
          const overlay = overlayElRef.current;
          if (overlay) {
            captureOverlayBackdrop(docEl, overlay);
            suppressAnimations(overlay);
          }
          if (target) {
            // The trigger stays LIVE in its group for the whole open morph,
            // so it is NOT hidden here: while named, an element renders
            // exclusively in the pseudo tree and can't peek out at its page
            // position. It gets hidden mid-transition, after its dissolve
            // completes — see the timer below.
            //
            // Suppress BEFORE measuring: the library's own entrance
            // animation is on its first frame here (e.g. a 0.95 zoom-in),
            // and a rect read taken through it would send the trigger group
            // toward a scaled-down endpoint while the UA morphs the pair to
            // the real one — the two boxes would drift apart mid-flight.
            suppressAnimations(target);
            // Radius read must precede the squaring below.
            const toRadius = resolveMorphBorderRadius(target);
            docEl.style.setProperty(VAR_RADIUS_TO, toRadius);
            // The pair's new image live-renders the panel every frame —
            // square, so the group clip owns the corners until it lands on
            // the panel's real radius (VAR_RADIUS_TO) at the end.
            suppressRadius(target);
            openTarget = { rect: target.getBoundingClientRect(), radius: toRadius };
            setTriggerGeometryKeyframes(fromRect, openTarget.rect);
            setMorphName(target);
          } else {
            clearMorphName(source);
            source!.setAttribute(SOURCE_HIDDEN_ATTR, '');
            if (process.env.NODE_ENV !== 'production') {
              // eslint-disable-next-line no-console
              console.warn(
                '[ramka] useDialogMorph: no target element was registered when the ' +
                  'dialog opened. Attach `targetRef` to the dialog panel element.',
              );
            }
          }
        });

        // Hide the trigger once its live image has finished dissolving (the
        // fade ends at 15%; the timer at 35% leaves margin on both sides).
        // Mid-transition, nowhere near teardown — so no finished-lag race
        // can flash it at its page position when the pseudo tree collapses.
        const duration = parseDurationMs(
          getComputedStyle(docEl).getPropertyValue(VAR_DURATION),
        );
        const hideTimer = setTimeout(() => {
          if (genRef.current !== gen) return;
          sourceElRef.current?.setAttribute(SOURCE_HIDDEN_ATTR, '');
        }, duration * 0.35);

        // Start the live trigger's radius compensation on `ready` (the frame
        // the pseudo animations start), then snap it onto their exact start
        // time — see syncWithGroupAnimations.
        let radiusAnim: Animation | null = null;
        const startTriggerAnims = () => {
          if (!openTarget) return;
          radiusAnim = animateLiveRadiusCompensation(
            source!,
            fromRect,
            openTarget.rect,
            fromRadius,
            openTarget.radius,
            fromRect,
          );
          liveRadiusAnimRef.current = radiusAnim;
          syncWithGroupAnimations([radiusAnim]);
        };
        const ready = (transition as { ready?: Promise<void> }).ready;
        if (ready) ready.then(startTriggerAnims, () => {});
        else startTriggerAnims();

        // Panel radius comes back on the teardown frame, not on `finished`
        // (which can lag a paint behind) — see scheduleRadiusRestore.
        scheduleRadiusRestore(() => targetElRef.current, transition.finished);

        transition.finished.finally(() => {
          clearTimeout(hideTimer);
          // Safe at any time: the trigger is opacity-0 hidden by now, so
          // its radius returning to natural is invisible.
          radiusAnim?.cancel();
          if (genRef.current !== gen) return;
          morphingRef.current = false;
          if (liveRadiusAnimRef.current === radiusAnim) liveRadiusAnimRef.current = null;
          // Fallback for skipped transitions (the timer may not have fired);
          // a no-op on the normal path.
          if (openRef.current) sourceElRef.current?.setAttribute(SOURCE_HIDDEN_ATTR, '');
          clearMorphName(sourceElRef.current);
          clearMorphName(targetElRef.current);
          // The overlay persists while open — its name must go so it can't
          // leak into unrelated view transitions started elsewhere.
          clearMorphName(overlayElRef.current);
          // Deliberately NOT restoring the panel's `animation` here — see
          // suppressAnimations. The suppression dies with the element.
          clearDocumentState(docEl);
        });
      } else {
        // CLOSE: old snapshot captures the named panel; the callback flips
        // state, un-hides + names the source for the new snapshot. Dialog
        // libraries that keep the panel mounted through an exit animation
        // would leave a live ghost showing through the (live-rendered)
        // ::view-transition-new(root) layer — the sticky exiting attribute
        // display:nones it until it unmounts.
        const target = targetElRef.current;
        const overlay = overlayElRef.current;
        const canMorph = !!target && !!source;
        let startCompensation: (() => Animation | null) | null = null;

        // A close that interrupts a running open inherits its live state:
        // the trigger still carries the live-trigger name (it must stay in
        // the root's OLD capture here, not spawn a stale one-sided group)
        // and the panel is still radius-squared (it must be read and
        // captured with its real corners).
        if (source) clearMorphName(source);
        if (target) restoreRadius(target);

        if (canMorph) {
          const fromRadius = resolveMorphBorderRadius(target!);
          const toRadius = resolveMorphBorderRadius(source!);
          const fromRect = target!.getBoundingClientRect();
          const toRect = source!.getBoundingClientRect();
          docEl.setAttribute(DOC_ATTR, 'closing');
          docEl.style.setProperty(VAR_RADIUS_FROM, fromRadius);
          docEl.style.setProperty(VAR_RADIUS_TO, toRadius);
          setMorphName(target!);
          startCompensation = () =>
            animateLiveRadiusCompensation(source!, fromRect, toRect, fromRadius, toRadius, toRect);
        } else {
          // No morph ends — still a view transition, so the close is a clean
          // root crossfade instead of an instant blink.
          docEl.setAttribute(DOC_ATTR, 'closing');
        }
        // The overlay only exists in the OLD state on close — name it before
        // capture so its blur animates out on the live group pseudo.
        if (overlay) captureOverlayBackdrop(docEl, overlay);

        const transition = startViewTransition(() => {
          clearMorphName(target);
          clearMorphName(overlay);
          flushSync(() => commit(false, meta));
          source?.removeAttribute(SOURCE_HIDDEN_ATTR);
          if (canMorph) {
            // Deliberately NOT squared (unlike the panel on open); its radius
            // is compensation-animated instead — see suppressRadius and
            // animateLiveRadiusCompensation for the geometry.
            setMorphName(source!);
          }
          // Same lingering-ghost treatment as the panel: the overlay also
          // stays mounted through the library's exit animation.
          if (target?.isConnected) {
            target.setAttribute(TARGET_EXITING_ATTR, '');
          }
          if (overlay?.isConnected) {
            overlay.setAttribute(TARGET_EXITING_ATTR, '');
          }
        });

        // Kick the radius compensation off on `ready` (the frame the pseudo
        // animations start), then snap it onto their exact start time so it
        // stays in lockstep with the group's geometry/clip for the whole
        // morph — see syncWithGroupAnimations.
        let radiusAnim: Animation | null = null;
        if (startCompensation) {
          const start = startCompensation;
          const kickOff = () => {
            radiusAnim = start();
            liveRadiusAnimRef.current = radiusAnim;
            syncWithGroupAnimations([radiusAnim]);
          };
          const ready = (transition as { ready?: Promise<void> }).ready;
          if (ready) ready.then(kickOff, () => {});
          else kickOff();
        }

        transition.finished.finally(() => {
          // Safe at any time: the animation's last keyframe IS the trigger's
          // natural radius, so cancelling is a pixel-identical no-op.
          radiusAnim?.cancel();
          if (genRef.current !== gen) return;
          morphingRef.current = false;
          if (liveRadiusAnimRef.current === radiusAnim) liveRadiusAnimRef.current = null;
          clearMorphName(sourceElRef.current);
          clearMorphName(overlayElRef.current);
          clearDocumentState(docEl);
        });
      }
    },
    [commit],
  );

  // Safety net: keep the source-hidden attribute in sync with state for paths
  // that bypass handleOpenChange (e.g. a controlled `open` prop flipped by
  // something other than the dialog). The imperative writes above already
  // handled the capture-critical timing; this is a no-op then.
  React.useEffect(() => {
    const source = sourceElRef.current;
    // While a morph runs, the transition owns the attribute timing (on open
    // the live trigger must stay visible until its dissolve ends at 15%).
    if (!source || morphingRef.current) return;
    if (enabled && open) source.setAttribute(SOURCE_HIDDEN_ATTR, '');
    else source.removeAttribute(SOURCE_HIDDEN_ATTR);
  }, [enabled, open]);

  return React.useMemo(
    () => ({ open, onOpenChange: handleOpenChange, sourceRef, targetRef, overlayRef, enabled }),
    [open, handleOpenChange, sourceRef, targetRef, overlayRef, enabled],
  );
}

export { useDialogMorph };
export type { UseDialogMorphOptions, DialogMorph };
