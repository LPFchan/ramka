'use client';

import { flushSync } from 'react-dom';

import { FLIP_ATTR, ensureFlipStructuralStyles } from './flip-structural-styles';
import { LightboxDocumentCssVars } from './lightbox-css-vars';
import {
  LightboxContentDataAttributes,
  LightboxDocumentDataAttributes,
  LightboxTriggerDataAttributes,
} from './lightbox-data-attributes';
import {
  findDestinationMorphTarget,
  findItemMorphTarget,
  findTriggerMorphTarget,
} from './morph-target';
import {
  getPendingDecodeImage,
  isMorphTargetSizeResolvable,
  resolveMorphBorderRadius,
  resolveScrollTriggerOption,
  resolveTriggerIndex,
  scrollTriggerEl,
  shouldUseCrossfade,
  waitForImageDecode,
  warnCollapsedMediaMorph,
  warnUnwiredItemMorph,
} from './use-view-transition-morph';
import type { ViewTransitionMorph, ViewTransitionMorphConfig } from './use-view-transition-morph';
import { compensatedMorphRadiusAt, parseMorphRadiusList } from './vt-morph-radius';
import { isViewTransitionPreset, resolveViewTransitionTiming } from './vt-timing';
import type { EasingFn, LightboxViewTransitionPreset } from './vt-timing';

// ---------------------------------------------------------------------------
// FLIP morph — the experimental engine (window.__RAMKA_FLIP__, docs: ?flip).
//
// Same trigger <-> item morph as use-view-transition-morph.ts, with no View
// Transition anywhere: instead of capturing the document and animating
// snapshots in the top layer, it animates the DESTINATION ELEMENT from the
// trigger's rect to its own.
//
// That inversion is what makes the engine possible at all. A shared-element
// animation normally has to lift the source out of its ancestors' overflow /
// transform / filter clipping, which only a snapshot in a separate layer can
// do — and is precisely what View Transitions are for. Here the destination is
// already a fixed, full-screen portal above the page, so there is nothing to
// escape: the trigger stays exactly where it is at `opacity: 0` (see
// flip-structural-styles.ts) and never moves.
//
// What that buys, versus the VT engine:
//
//   - Runs everywhere. No `startViewTransition`, so no capability gate and no
//     low-end opt-out — nothing is rasterized beyond the two elements taking
//     part, where a document transition rasterizes the whole page twice.
//   - No platform workarounds. The Android snapshot-root settle wait (which
//     can delay an open by up to a second), the iOS address-bar touch guard,
//     the Firefox full-bleed capture inset, the Safari 18 empty-computed-
//     transform dance, name isolation and the WebKit CSS-vs-WAAPI fork all
//     exist to serve a capture. None of them apply.
//   - Interruptible. Document transitions are exclusive and non-reversible;
//     here a close that lands mid-open simply measures the element where it
//     currently is and animates on from there (see `startMorph`).
//
// What it gives up: the source is live DOM, not a texture, so a `crossfade`
// dissolve has to reconstruct the trigger's pixels. It does that by cloning
// the trigger subtree into the destination (see `createGhost`), which covers
// overlays and badges but not `<canvas>` content, shadow DOM, or paint that
// depends on ancestors left behind on the page.
//
// The geometry is deliberately the same math the VT engine already runs in
// vt-composited-morph.ts — transform-only tracks sampled against the preset's
// easing, with the content counter-transformed to hold its aspect ratio. Only
// the endpoints are read differently: two `getBoundingClientRect` calls
// instead of parsing matrices out of UA-authored keyframes.
// ---------------------------------------------------------------------------

/** A viewport-space rect, in the shape the sampling math wants. */
interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Marks our cloned trigger so it is never mistaken for consumer content. */
const GHOST_ATTR = 'data-ramka-flip-ghost';

/** Set by lightbox-placeholder.ts on the trigger-thumbnail canvas underlay. */
const PLACEHOLDER_ATTR = 'data-ramka-placeholder';

/** Dissolve window as a fraction of the morph — matches the VT engine. */
const DISSOLVE_FRACTION = 0.48;

const fmt = (n: number) => Number(n.toFixed(4));

const lerp = (a: number, b: number, q: number) => a + (b - a) * q;

function readBox(el: HTMLElement): Box {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

function isReplaced(el: HTMLElement): boolean {
  const tag = el.tagName;
  return tag === 'IMG' || tag === 'VIDEO' || tag === 'CANVAS' || tag === 'SVG';
}

type StyleRestore = () => void;

/**
 * Write inline styles and hand back an exact undo. Values are read/written
 * through `style.setProperty` so custom properties and hyphenated names behave
 * the same as declared ones.
 */
function patchStyle(el: HTMLElement, props: Record<string, string>): StyleRestore {
  const saved = Object.keys(props).map(
    (name) => [name, el.style.getPropertyValue(name)] as const,
  );
  for (const [name, value] of Object.entries(props)) {
    el.style.setProperty(name, value);
  }
  return () => {
    for (const [name, value] of saved) {
      if (value) el.style.setProperty(name, value);
      else el.style.removeProperty(name);
    }
  };
}

/**
 * The morph target's own paint layers: its element children, minus the
 * trigger-thumbnail canvas underlay (which is already positioned to match the
 * destination's letterbox) and minus our ghost.
 *
 * `Lightbox.Media` is a grid with a single in-flow media child, so this is
 * normally just the `<img>` / `<video>`.
 */
function contentLayers(host: HTMLElement): HTMLElement[] {
  return Array.from(host.children).filter(
    (el): el is HTMLElement =>
      el instanceof HTMLElement &&
      !el.hasAttribute(GHOST_ATTR) &&
      !el.hasAttribute(PLACEHOLDER_ATTR),
  );
}

/**
 * The chain from the morph target up to and including its `Lightbox.Content`,
 * or `null` when the target is not inside one.
 */
function morphPathToContent(morphTarget: HTMLElement): HTMLElement[] | null {
  const contentEl = findContentEl(morphTarget);
  if (!contentEl) return null;

  const path: HTMLElement[] = [];
  for (let el: HTMLElement | null = morphTarget; el; el = el.parentElement) {
    path.push(el);
    if (el === contentEl) break;
  }
  return path[path.length - 1] === contentEl ? path : null;
}

/**
 * Flatten transforms on the chain from Content down to the morph target, and
 * hand back the undo.
 *
 * Callers read the item's visual box *before* calling this and its resting box
 * *after*, which is the whole point: a transform already on the chain becomes
 * the morph's starting pose instead of composing with the one we animate.
 *
 * Pull-to-dismiss is the case that needs it. It drags the active item (or the
 * Stage `morphRef` host) with an inline `translate/scale` and deliberately
 * leaves it applied when the pull commits to closing, so the VT engine captures
 * the pulled pose. Live DOM has no capture, so that transform stays in the tree
 * and does two things at once: it nests *outside* the transform we animate, and
 * — being on an ancestor — it also scales every `getBoundingClientRect` the
 * morph is measured with. Zoom is reset separately; this covers the pull and any
 * transform a consumer leaves on the path.
 */
function flattenMorphPathTransforms(morphTarget: HTMLElement): StyleRestore | null {
  const path = morphPathToContent(morphTarget);
  if (!path) return null;

  // An animation's value outranks inline style, so a transform track still
  // playing on the path would ignore the flatten below and keep skewing our
  // reads — the pull's snap-back, caught by a close mid-flight. Our own tracks
  // don't exist yet (the caller cancels any previous morph first), so there is
  // nothing here we still want.
  for (const el of path) {
    for (const animation of el.getAnimations?.() ?? []) {
      // Duck-typed: `KeyframeEffect` is not a global everywhere this runs.
      const effect = animation.effect as KeyframeEffect | null;
      if (typeof effect?.getKeyframes !== 'function') continue;
      if (effect.getKeyframes().some((frame) => 'transform' in frame)) animation.cancel();
    }
  }

  const restores = path.map((el) =>
    // `transition: none` too, or a chain element with a transform transition
    // animates its way to `none` instead of dropping straight to it.
    patchStyle(el, { transform: 'none', transition: 'none' }),
  );
  return () => {
    for (const restore of restores.reverse()) restore();
  };
}

/**
 * Give the whole morph path up to the initial containing block, so anchoring the
 * morph target with `fixed` resolves against the viewport, and hand back the undo.
 *
 * `fixed` is viewport-anchored only when no ancestor established a containing
 * block — and `Lightbox.Zoom` establishes one via `container-type: size`, from
 * *inside* the slide. So anchoring on its own pinned the morph to a box that
 * scrolls with the carousel: the same drift, one step removed, visible only while
 * a swipe was still settling. Layout containment, `filter`, `backdrop-filter`,
 * `perspective` and `will-change` all establish a containing block the same way,
 * so all of them come off.
 *
 * The whole way up to Content, not just as far as the scrollport, because of what
 * else the initial containing block buys: a `fixed` box anchored to the viewport
 * is not clipped by ancestor `overflow` at all. Stop short and the morph is
 * anchored correctly but still cropped — by `Media`'s own `overflow: hidden`, by
 * the scrollport's — against a clip rect that is itself moving with the scroll.
 * That is the last route the scroller has to the morph, and it closes here.
 *
 * The cost is that a filter on the path (a skin blurring inside Content) stops
 * applying for the exit. The VT engine has the same gap from the other side: its
 * close animates a snapshot, so a live filter isn't reapplied there either.
 */
function escapeContainingBlocks(morphTarget: HTMLElement): StyleRestore | null {
  const path = morphPathToContent(morphTarget);
  if (!path) return null;

  // `transform` is already off the whole path (see the flatten above).
  const restores = path.map((el) =>
    patchStyle(el, {
      translate: 'none',
      rotate: 'none',
      scale: 'none',
      perspective: 'none',
      filter: 'none',
      'backdrop-filter': 'none',
      contain: 'none',
      'container-type': 'normal',
      'will-change': 'auto',
    }),
  );
  return () => {
    for (const restore of restores.reverse()) restore();
  };
}

/**
 * Take the morph target out of flow and anchor it outside the scrollport for the
 * duration of the close, reporting the resting box it now lays out at.
 *
 * The morph target lives inside the `Lightbox.Slides` scrollport, and a FLIP
 * close animates that live element. The VT engine unmounts the whole viewer at
 * close and animates a capture pinned in the top layer, so for it the scroller
 * is simply gone. Keeping the viewer mounted means the scroller is live for the
 * entire exit — touch momentum, the settle to a snap point, and `LightboxSlides`
 * own rAF tails that rewrite `scroll-snap-type` and re-assert `scrollLeft` — and
 * all of it moves the element out from under a transform sampled against one
 * fixed position, so the morph drifts as it plays.
 *
 * Freezing the scroller instead is unwinnable: Slides owns those writes and
 * clobbers any of ours a frame later, and correcting the offset by hand just
 * fights momentum into a visible bounce. So leave the scroller alone and step
 * out of it — `fixed` takes the element off the scrollport's scrolling contents,
 * where no scroll, snap or fling can reach it.
 *
 * Width and height are pinned to the resting box (as a border box, so the
 * numbers mean the same thing going in as coming out) rather than left to
 * out-of-flow shrink-to-fit. The media then keeps the layout size its
 * `object-fit` crop was computed for, and only the transform moves it.
 *
 * The resting box is read back rather than assumed. Containing blocks that
 * scroll are cleared first, but one can still sit above the scroller (Content's
 * own, most likely), so the origin is not necessarily the viewport. Positioning
 * at `0,0` and measuring reports whatever it turns out to be.
 */
function anchorOutsideScrollport(
  el: HTMLElement,
  resting: Box,
): { rest: Box; restore: StyleRestore } {
  const restore = patchStyle(el, {
    position: 'fixed',
    'box-sizing': 'border-box',
    left: '0',
    top: '0',
    // A skin's `inset` would otherwise over-constrain the box we just sized.
    right: 'auto',
    bottom: 'auto',
    margin: '0',
    width: `${resting.w}px`,
    height: `${resting.h}px`,
  });
  return { rest: readBox(el), restore };
}

/**
 * Rebuild the paint partition a view transition hands out for free: morph
 * target fully opaque, everything else fading.
 *
 * The VT engine gets this from the capture. Its named group is *excluded* from
 * `::view-transition-old(root)`, so the page-behind crossfade — chrome included
 * — can never multiply into the morph, and the live Content that would fade is
 * unmounted before it paints a frame.
 *
 * Keeping Content mounted loses that. Skins put their open/close fade on
 * Content (the docs presets use `opacity` with an ease-out-expo curve, which is
 * ~80% done a fifth of the way in), and the morph target is a descendant, so
 * the morph vanishes long before it lands. Ancestor opacity cannot be undone
 * from a descendant — a child cannot exceed its parent's alpha — so the only
 * CSS-legal fix is to invert the partition: pin the path from Content down to
 * the morph target at full opacity, and re-apply the fade to the siblings
 * hanging off that path (chrome, inactive slides).
 *
 * The replacement fade runs on the root-snapshot clock rather than a copy of
 * Content's own transition, because that is the clock the VT engine fades these
 * exact pixels on.
 *
 * Returns `null` when the morph target is not inside Content, in which case
 * nothing was fading it in the first place.
 */
function partitionAncestorFade(args: {
  morphTarget: HTMLElement;
  phase: 'opening' | 'closing';
  duration: number;
  easing: string;
}): StyleRestore | null {
  const { morphTarget, phase, duration, easing } = args;

  const path = morphPathToContent(morphTarget);
  if (!path) return null;
  const contentEl = path[path.length - 1]!;

  const onPath = new Set(path);
  const restores: StyleRestore[] = [];

  // `transition: none` as well as `opacity: 1`: on open the skin's fade is
  // already queued 0 -> 1, and an inline target of 1 would still animate to it.
  // The library owns the motion of the morph path for the duration, which is
  // also what `data-skip-fade` asks skins to do under the VT engine.
  for (const el of path) {
    restores.push(patchStyle(el, { opacity: '1', transition: 'none' }));
  }

  const offPath: HTMLElement[] = [];
  for (const el of path) {
    // Everything inside the morph target IS the morph — its media child (and
    // the crossfade ghost appended later) must never be caught by the fade.
    if (el === morphTarget) continue;
    for (const child of Array.from(el.children)) {
      if (child instanceof HTMLElement && !onPath.has(child)) offPath.push(child);
    }
  }

  const fade = `opacity ${duration}ms ${easing}`;

  if (phase === 'closing') {
    // Transition from whatever each element currently computes, so a control
    // resting below full opacity (a disabled arrow) doesn't pop to 1 first.
    for (const el of offPath) {
      restores.push(patchStyle(el, { transition: fade, opacity: '0' }));
    }
  } else {
    for (const el of offPath) {
      restores.push(patchStyle(el, { opacity: '0', transition: 'none' }));
    }
    // One flush so the seeded zero is the transition's before-change style.
    void contentEl.offsetWidth;
    for (const el of offPath) {
      el.style.setProperty('transition', fade);
      // Back to the skin's own resting opacity as the fade target.
      el.style.removeProperty('opacity');
    }
  }

  return () => {
    for (const restore of restores.reverse()) restore();
  };
}

// ---------------------------------------------------------------------------
// Sampling
// ---------------------------------------------------------------------------

interface MorphFrames {
  /** Transform track for the morph target itself. */
  outer: Keyframe[];
  /** Counter-transform track holding the content's aspect ratio. */
  inner: Keyframe[];
  /** Compensated elliptical `border-radius` track (may be empty). */
  radius: Keyframe[];
}

/**
 * Sample the morph into transform-only keyframes.
 *
 * `rest` is the morph target's untransformed layout box — the destination box
 * on open, the item box on close. Every track is expressed against it, since
 * that is the box the browser lays the element out at and the box our scale
 * divides out of.
 *
 * The counter-transform reproduces `object-fit: cover` of the resting content
 * into the interpolated box: the outer scales by `(w/rest.w, h/rest.h)` and the
 * inner by `k` over that, so the net on-screen scale is a uniform `k` on both
 * axes and the photo never distorts under a non-uniform box scale. Sampled
 * numerically because the counter track is `1/s(t)`, which no easing function
 * expresses.
 */
function buildMorphFrames(opts: {
  from: Box;
  to: Box;
  rest: Box;
  ease: EasingFn;
  steps: number;
  radiusFrom: [number, number, number, number] | null;
  radiusTo: [number, number, number, number] | null;
  counterInner: boolean;
}): MorphFrames {
  const { from, to, rest, ease, steps, radiusFrom, radiusTo, counterInner } = opts;
  const hasRadius =
    !!radiusFrom && !!radiusTo && [...radiusFrom, ...radiusTo].some((r) => r > 0);

  const outer: Keyframe[] = [];
  const inner: Keyframe[] = [];
  const radius: Keyframe[] = [];

  for (let i = 0; i <= steps; i++) {
    const offset = i / steps;
    const q = ease(offset);
    // The spring preset overshoots (and can dip below 0), which is the point —
    // but the counter-transform and radius tracks divide by the sampled box, so
    // floor it rather than emitting Infinity on a degenerate frame.
    const w = Math.max(lerp(from.w, to.w, q), 0.01);
    const h = Math.max(lerp(from.h, to.h, q), 0.01);
    const x = lerp(from.x, to.x, q);
    const y = lerp(from.y, to.y, q);

    outer.push({
      offset,
      transform:
        `translate(${fmt(x - rest.x)}px, ${fmt(y - rest.y)}px) ` +
        `scale(${fmt(w / rest.w)}, ${fmt(h / rest.h)})`,
    });

    if (hasRadius) {
      radius.push({
        offset,
        borderRadius: compensatedMorphRadiusAt(radiusFrom!, radiusTo!, q, {
          w0: from.w,
          h0: from.h,
          w,
          h,
          w1: to.w,
          h1: to.h,
          restW: rest.w,
          restH: rest.h,
        }),
      });
    }

    if (counterInner) {
      const k = Math.max(w / rest.w, h / rest.h);
      const dx = ((w - k * rest.w) / 2) * (rest.w / w);
      const dy = ((h - k * rest.h) / 2) * (rest.h / h);
      inner.push({
        offset,
        transform:
          `translate(${fmt(dx)}px, ${fmt(dy)}px) ` +
          `scale(${fmt((k * rest.w) / w)}, ${fmt((k * rest.h) / h)})`,
      });
    }
  }

  return { outer, inner, radius };
}

// ---------------------------------------------------------------------------
// Crossfade ghost
// ---------------------------------------------------------------------------

/**
 * Clone the trigger subtree into the morph target as the dissolve's outgoing
 * (open) / incoming (close) layer.
 *
 * The VT engine gets this for free: its `old` snapshot is the whole rendered
 * trigger, sized `100%` with `object-fit: fill` against the group box. A clone
 * reproduces that by laying out at the trigger's own size and scaling to fill
 * the target's resting box, so the outer's animated scale stretches it exactly
 * the way `fill` stretches a texture.
 *
 * Returns `null` when there is nothing to clone into — a replaced morph target
 * can't host children, in which case the caller falls back to a hard cut.
 */
function createGhost(
  source: HTMLElement,
  host: HTMLElement,
  sourceBox: Box,
  rest: Box,
): HTMLElement | null {
  if (isReplaced(host)) return null;
  if (!(sourceBox.w > 0 && sourceBox.h > 0)) return null;

  let clone: HTMLElement;
  try {
    clone = source.cloneNode(true) as HTMLElement;
  } catch {
    return null;
  }

  // Pin every cloned image to the exact resource the live one resolved, so the
  // ghost can't re-run srcset selection (or skip loading entirely, for a lazy
  // image) and paint something different from what the user is looking at.
  const sourceImages = [
    ...(source instanceof HTMLImageElement ? [source] : []),
    ...Array.from(source.querySelectorAll('img')),
  ];
  const cloneImages = [
    ...(clone instanceof HTMLImageElement ? [clone] : []),
    ...Array.from(clone.querySelectorAll('img')),
  ];
  sourceImages.forEach((live, i) => {
    const copy = cloneImages[i];
    if (!copy) return;
    const resolved = live.currentSrc || live.src;
    copy.removeAttribute('srcset');
    copy.removeAttribute('sizes');
    copy.removeAttribute('loading');
    if (resolved) copy.src = resolved;
  });

  // A clone is decoration: keep it out of the a11y tree, out of hit testing,
  // and out of any id-based reference (duplicate ids would silently retarget
  // consumer `aria-*` / label relationships).
  clone.removeAttribute('id');
  for (const el of clone.querySelectorAll('[id]')) el.removeAttribute('id');
  // Never inherit the hide rule we put on the live trigger.
  clone.removeAttribute('data-morph-target');
  for (const el of clone.querySelectorAll('[data-morph-target]')) {
    el.removeAttribute('data-morph-target');
  }
  clone.setAttribute(GHOST_ATTR, '');
  clone.setAttribute('aria-hidden', 'true');

  const s = clone.style;
  s.setProperty('position', 'absolute');
  s.setProperty('left', '0');
  s.setProperty('top', '0');
  s.setProperty('margin', '0');
  s.setProperty('width', `${fmt(sourceBox.w)}px`);
  s.setProperty('height', `${fmt(sourceBox.h)}px`);
  s.setProperty('max-width', 'none');
  s.setProperty('max-height', 'none');
  s.setProperty('transform-origin', '0 0');
  s.setProperty('transform', `scale(${fmt(rest.w / sourceBox.w)}, ${fmt(rest.h / sourceBox.h)})`);
  s.setProperty('pointer-events', 'none');

  host.appendChild(clone);
  return clone;
}

// ---------------------------------------------------------------------------
// Morph runner
// ---------------------------------------------------------------------------

interface MorphHandle {
  /** Resolves when the morph has played out (or was cancelled). */
  finished: Promise<void>;
  /** Idempotent: stops every track and restores the DOM it touched. */
  cancel: () => void;
}

interface RunMorphArgs {
  /** The morph target — the element that animates. */
  outerEl: HTMLElement;
  from: Box;
  to: Box;
  /** The morph target's untransformed layout box. */
  rest: Box;
  fromRadius: string | null;
  toRadius: string | null;
  phase: 'opening' | 'closing';
  crossfade: boolean;
  /** Trigger subtree to clone for the dissolve, and its own box. */
  ghostSource: HTMLElement | null;
  ghostSourceBox: Box | null;
  preset: boolean | LightboxViewTransitionPreset | undefined;
  /**
   * Undos for the coordinate space the caller isolates before measuring `rest` —
   * flattened path transforms, frozen scroll ancestors. Owned by the morph from
   * here on, so `cancel()` unwinds them.
   */
  isolation?: (StyleRestore | null)[];
}

function runMorph(args: RunMorphArgs): MorphHandle {
  const spec = resolveViewTransitionTiming(args.preset);
  const { duration, ease } = spec;
  const steps = Math.min(120, Math.max(24, Math.round(duration / 8)));

  const restores: StyleRestore[] = [];
  const animations: Animation[] = [];
  let ghost: HTMLElement | null = null;

  // First in, so these unwind last: the start pose below patches `transform` on
  // an element the flatten also touched, and the outer patch has to come back
  // off before the pre-flatten value underneath it can be restored.
  for (const restore of args.isolation ?? []) {
    if (restore) restores.push(restore);
  }

  // Crossfade dissolves stretch both layers — parity with the VT contract,
  // where a crossfading snapshot is `object-fit: fill` against the group box
  // (a circular trigger must not balloon under `cover`). So only the hard-cut
  // path counter-transforms the content.
  const layers = contentLayers(args.outerEl);
  const counterInner = !args.crossfade && layers.length > 0;

  const frames = buildMorphFrames({
    from: args.from,
    to: args.to,
    rest: args.rest,
    ease,
    steps,
    radiusFrom: args.fromRadius ? parseMorphRadiusList(args.fromRadius) : null,
    radiusTo: args.toRadius ? parseMorphRadiusList(args.toRadius) : null,
    counterInner,
  });

  const track = (el: HTMLElement, keyframes: Keyframe[], options?: KeyframeAnimationOptions) => {
    if (keyframes.length === 0) return;
    try {
      animations.push(
        el.animate(keyframes, {
          duration,
          easing: 'linear',
          fill: 'both',
          ...options,
        }),
      );
    } catch {
      // Engine refused this track — the others still run, and the inline
      // start pose below means nothing paints at the wrong size regardless.
    }
  };

  // Set the start pose inline BEFORE animating. A freshly created animation has
  // no current time until the timeline ticks, so the computed value falls
  // through to inline style for that gap; seeding it with frame 0 is what makes
  // the handover from "just revealed at full size" to "animating" invisible.
  const outerStart: Record<string, string> = {
    'transform-origin': '0 0',
    // The morph target is the crop window: the counter-transformed content
    // overflows it by design (that is how edge pixels get revealed mid-flight).
    overflow: 'hidden',
    'will-change': 'transform',
    transform: String(frames.outer[0]!.transform),
  };
  if (frames.radius.length > 0) {
    outerStart['border-radius'] = String(frames.radius[0]!.borderRadius);
  }
  if (args.crossfade) {
    // Contain `plus-lighter` to this subtree so the blend can't reach the
    // backdrop. Media already isolates; a bare `morphRef` host may not.
    outerStart.isolation = 'isolate';
  }
  restores.push(patchStyle(args.outerEl, outerStart));

  // Before any track starts: the morph target has to be exempt from its
  // ancestors' open/close fade, or the skin's Content transition fades the
  // morph out from under us (see partitionAncestorFade).
  const restoreFade = partitionAncestorFade({
    morphTarget: args.outerEl,
    phase: args.phase,
    duration,
    easing: spec.cssRootEasing,
  });
  if (restoreFade) restores.push(restoreFade);

  track(args.outerEl, frames.outer);
  if (frames.radius.length > 0) {
    // Separate animation: mixing a paint property into the transform effect
    // demotes the whole effect off the compositor (Blink rule).
    track(args.outerEl, frames.radius);
  }

  if (counterInner) {
    for (const layer of layers) {
      restores.push(
        patchStyle(layer, {
          'transform-origin': '0 0',
          'will-change': 'transform',
          transform: String(frames.inner[0]!.transform),
        }),
      );
      track(layer, frames.inner);
    }
  }

  if (args.crossfade && args.ghostSource && args.ghostSourceBox) {
    ghost = createGhost(args.ghostSource, args.outerEl, args.ghostSourceBox, args.rest);
  }

  if (ghost) {
    // Complementary 1 -> 0 / 0 -> 1 pair on one shorter window, under
    // `plus-lighter` so the mix stays opaque and the outgoing layer is gone
    // before the size settles (a face or +N overlay must not ghost to t=1).
    const dissolve = duration * DISSOLVE_FRACTION;
    const easing = args.phase === 'opening' ? spec.cssEasing : spec.cssCrossfadeCloseEasing;
    const ghostFrom = args.phase === 'opening' ? 1 : 0;
    const dissolveOptions: KeyframeAnimationOptions = {
      duration: dissolve,
      easing,
      fill: 'both',
    };

    restores.push(
      patchStyle(ghost, { 'mix-blend-mode': 'plus-lighter', opacity: String(ghostFrom) }),
    );
    track(ghost, [{ opacity: ghostFrom }, { opacity: 1 - ghostFrom }], dissolveOptions);

    for (const layer of layers) {
      restores.push(
        patchStyle(layer, { 'mix-blend-mode': 'plus-lighter', opacity: String(1 - ghostFrom) }),
      );
      track(layer, [{ opacity: 1 - ghostFrom }, { opacity: ghostFrom }], dissolveOptions);
    }
  }

  const ghostEl = ghost;
  let cancelled = false;
  const cancel = () => {
    if (cancelled) return;
    cancelled = true;
    for (const animation of animations) animation.cancel();
    ghostEl?.remove();
    // Reverse order so nested/repeated patches unwind to their original values.
    for (const restore of restores.reverse()) restore();
  };

  // A morph with no surviving tracks still has to hold the close open for the
  // skin's own fade, so fall back to the preset's clock rather than settling
  // on the spot.
  const finished =
    animations.length > 0
      ? Promise.allSettled(animations.map((a) => a.finished)).then(() => undefined)
      : new Promise<void>((resolve) => setTimeout(resolve, duration));

  return { finished, cancel };
}

/**
 * The morph currently owning the destination element's inline styles.
 *
 * Document view transitions are exclusive, so the VT engine never has two
 * morphs touching the same DOM. WAAPI has no such rule: an open interrupted by
 * a close would leave two sets of tracks and two pending style restores on one
 * element, and whichever unwound last would win. Cancelling the incumbent
 * first keeps that single-owner invariant.
 *
 * Callers measure their start box *before* calling, which is what makes an
 * interruption continuous: the reversal picks the element up wherever the
 * cancelled morph had it.
 */
let activeMorph: { handle: MorphHandle; el: HTMLElement } | null = null;

/**
 * Whether `el` is the element the in-flight morph is animating.
 *
 * Tracked by element, not just by handle: the registry is module-level (several
 * Roots share a page) so a morph left running on one lightbox must not make
 * another lightbox's opener believe *its* destination is mid-flight — it would
 * read the interrupted-start box off an element nothing is animating and morph
 * from its resting position, i.e. not at all.
 */
function isMorphing(el: HTMLElement | null): boolean {
  return !!el && activeMorph?.el === el;
}

/**
 * Unwind the incumbent morph, synchronously restoring every inline style it
 * wrote. Callers must do this *before* measuring a resting box — while a morph
 * is in flight, `getBoundingClientRect` reports the animated rect, not layout.
 */
function cancelActiveMorph(): void {
  activeMorph?.handle.cancel();
  activeMorph = null;
}

function startMorph(args: RunMorphArgs): MorphHandle {
  cancelActiveMorph();
  const handle = runMorph(args);
  activeMorph = { handle, el: args.outerEl };
  const release = () => {
    if (activeMorph?.handle === handle) activeMorph = null;
  };
  handle.finished.then(release, release);
  return handle;
}

// ---------------------------------------------------------------------------
// Document state
// ---------------------------------------------------------------------------

/** See the VT engine's `morphStateOwner` — same stale-finalizer hazard. */
let flipStateOwner = 0;

/**
 * Publish the document-level hooks a morph exposes to skin CSS: the phase
 * marker, the crossfade flag, and the active preset's timing.
 *
 * The `--lightbox-vt-*` vars are the same ones the VT engine writes, on
 * purpose — every skin already runs its backdrop/chrome fades off that clock,
 * so both engines drive identical page-behind motion and an A/B compares only
 * the morph.
 */
function applyFlipState(
  docEl: HTMLElement,
  phase: 'opening' | 'closing',
  opts: { useCrossfade: boolean; preset: boolean | LightboxViewTransitionPreset | undefined },
): number {
  const spec = resolveViewTransitionTiming(opts.preset);
  docEl.setAttribute(FLIP_ATTR, phase);
  docEl.setAttribute(
    LightboxDocumentDataAttributes.viewTransitionPreset,
    isViewTransitionPreset(opts.preset) ? opts.preset : 'default',
  );
  docEl.style.setProperty(LightboxDocumentCssVars.vtDuration, `${spec.duration}ms`);
  docEl.style.setProperty(LightboxDocumentCssVars.vtEasing, spec.cssEasing);
  docEl.style.setProperty(
    LightboxDocumentCssVars.vtCrossfadeCloseEasing,
    spec.cssCrossfadeCloseEasing,
  );
  docEl.style.setProperty(LightboxDocumentCssVars.vtRootEasing, spec.cssRootEasing);
  if (opts.useCrossfade) {
    docEl.setAttribute(LightboxDocumentDataAttributes.crossfade, '');
  } else {
    docEl.removeAttribute(LightboxDocumentDataAttributes.crossfade);
  }
  return ++flipStateOwner;
}

function clearFlipState(docEl: HTMLElement, owner: number): void {
  if (owner !== flipStateOwner) return;
  docEl.removeAttribute(FLIP_ATTR);
  docEl.removeAttribute(LightboxDocumentDataAttributes.crossfade);
  docEl.removeAttribute(LightboxDocumentDataAttributes.viewTransitionPreset);
  docEl.style.removeProperty(LightboxDocumentCssVars.vtDuration);
  docEl.style.removeProperty(LightboxDocumentCssVars.vtEasing);
  docEl.style.removeProperty(LightboxDocumentCssVars.vtCrossfadeCloseEasing);
  docEl.style.removeProperty(LightboxDocumentCssVars.vtRootEasing);
}

/**
 * Take an element out of hit testing for the duration of an exit.
 *
 * Restores by *removal* rather than by saving the previous value: this engine is
 * the only writer, and a superseding close would otherwise save the outgoing
 * close's `none` as the value to put back and strand it there.
 */
function suppressPointerEvents(el: HTMLElement | null): StyleRestore | null {
  if (!el) return null;
  el.style.setProperty('pointer-events', 'none');
  return () => el.style.removeProperty('pointer-events');
}

/** Wait out whatever the skin is animating on the dialog, for morph-less runs. */
function waitForExitAnimations(el: HTMLElement | null, fallbackMs: number): Promise<void> {
  if (!el || typeof el.getAnimations !== 'function') {
    return new Promise((resolve) => setTimeout(resolve, fallbackMs));
  }
  const running = el.getAnimations().map((a) => a.finished);
  if (running.length === 0) {
    return new Promise((resolve) => setTimeout(resolve, fallbackMs));
  }
  return Promise.allSettled(running).then(() => undefined);
}

function findContentEl(from: HTMLElement | null): HTMLElement | null {
  return from?.closest<HTMLElement>(`[${LightboxContentDataAttributes.content}]`) ?? null;
}

/**
 * Hold the trigger hidden for the whole exit, and hand back the release.
 *
 * `Lightbox.Trigger` derives `data-morph-target` — the attribute the hide rule
 * keys on — from the open state, so marking the viewer closed strips it at close
 * *start*, revealing the trigger with the morph still flying towards it. The VT
 * engine cannot see this: its live tree is hidden for the transition, and the
 * trigger it animates is a snapshot captured while the attribute was still on.
 * Animating the live element means owning the attribute for the exit instead.
 *
 * Release it *before* the document's FLIP marker comes off, so the rule pinning
 * `transition: none` is still in force and the trigger snaps back rather than
 * fading in over the sheet's 200ms — by then the morph has landed exactly on top
 * of it, so the handover is occluded either way, but a fade would outlast it.
 */
function pinTriggerHidden(triggerTarget: HTMLElement | null): StyleRestore | null {
  if (!triggerTarget) return null;
  const attr = LightboxTriggerDataAttributes.morphTarget;
  triggerTarget.setAttribute(attr, '');
  return () => triggerTarget.removeAttribute(attr);
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * FLIP counterpart to `createViewTransitionMorph`, with the same
 * `{ open, close }` surface and the same config — so `Lightbox.Root` swaps
 * engines by swapping the factory and nothing else.
 */
function createFlipMorph(getConfig: () => ViewTransitionMorphConfig): ViewTransitionMorph {
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

    ensureFlipStructuralStyles();

    const docEl = document.documentElement;
    const gen = closeGenRef.current;

    const beforeOpenAbort = new AbortController();
    beforeOpenAbortRef.current = beforeOpenAbort;

    const triggerIdx = openingTriggerIndexRef.current;
    const triggerEl =
      openingTriggerElementRef.current ?? triggerElementsRef.current.get(triggerIdx) ?? undefined;
    const triggerTarget = triggerEl
      ? findTriggerMorphTarget(triggerEl, triggerMorphElementsRef.current)
      : null;
    const useCrossfade = shouldUseCrossfade(triggerEl?.dataset.crossfade, 'opening');

    // Read the trigger's geometry and radius NOW, before any writes: the click's
    // state updates are still batched, so this is served from clean style. It is
    // also the only chance to see the trigger at its pre-lock position — the
    // same instant the VT engine's old snapshot captures, since `commitReveal`
    // hides the scrollbar and can reflow the page. See LIGHTBOX_PERF.md.
    const from = triggerTarget ? readBox(triggerTarget) : null;
    const fromRadius = triggerTarget ? resolveMorphBorderRadius(triggerTarget) : null;

    // PRE-MOUNT: build the viewer while the page is still live, so React
    // reconciliation and the destination image's fetch/decode stay off the
    // morph's critical path. The tree mounts `visibility: hidden`, which still
    // lays out, so geometry below is real.
    flushSync(commitPrepare);

    if (decodeMaxWait > 0) {
      const pendingItemEl = activeItemElementRef.current;
      const pendingItemTarget = pendingItemEl
        ? findItemMorphTarget(pendingItemEl, itemMorphElementsRef.current)
        : null;
      // Only actually await when the destination is still loading; awaiting an
      // already-resolved promise still costs a microtask, which would push the
      // morph off the click tick.
      if (getPendingDecodeImage(pendingItemTarget)) {
        await waitForImageDecode(pendingItemTarget, decodeMaxWait);
        if (getConfig().closeGenRef.current !== gen) {
          if (beforeOpenAbortRef.current === beforeOpenAbort) {
            beforeOpenAbortRef.current = null;
          }
          return;
        }
      }
    }

    const onBeforeOpen = onBeforeOpenRef.current;
    if (onBeforeOpen) {
      const destination = findDestinationMorphTarget(
        activeItemElementRef.current,
        itemMorphElementsRef.current,
        getConfig().destinationMorphElementRef.current,
      );
      try {
        await onBeforeOpen({ destination, signal: beforeOpenAbort.signal });
      } catch {
        if (beforeOpenAbortRef.current === beforeOpenAbort) {
          beforeOpenAbortRef.current = null;
        }
        if (getConfig().closeGenRef.current === gen) {
          flushSync(commitAbortPrepare);
        }
        return;
      }
      if (beforeOpenAbortRef.current === beforeOpenAbort) {
        beforeOpenAbortRef.current = null;
      }
      if (getConfig().closeGenRef.current !== gen) return;
      if (beforeOpenAbort.signal.aborted) {
        flushSync(commitAbortPrepare);
        return;
      }
    } else if (beforeOpenAbortRef.current === beforeOpenAbort) {
      beforeOpenAbortRef.current = null;
    }

    // No snapshot-root settle wait here (the VT engine's `waitForStableSnapshotRoot`):
    // nothing is captured, so a moving Android URL bar has nothing to abort.

    const itemTargetPrep = findDestinationMorphTarget(
      activeItemElementRef.current,
      itemMorphElementsRef.current,
      getConfig().destinationMorphElementRef.current,
    );

    const canMorph =
      !!triggerTarget &&
      !!from &&
      from.w > 0 &&
      from.h > 0 &&
      isMorphTargetSizeResolvable(itemTargetPrep);

    const itemElPrep = activeItemElementRef.current;
    if (canMorph && itemElPrep && itemTargetPrep === itemElPrep) {
      warnUnwiredItemMorph(itemElPrep, itemTargetPrep);
    }
    if (!canMorph) {
      warnCollapsedMediaMorph(itemTargetPrep);
    }

    const stateToken = applyFlipState(docEl, 'opening', {
      useCrossfade: canMorph && useCrossfade,
      preset: getConfig().transitionPreset,
    });

    // Reveal and pose in ONE task. `flushSync` runs React's commit and layout
    // effects synchronously and the browser only paints once this task yields,
    // so seeding the start transform right after it means no frame ever shows
    // the destination at full size. This is the atomicity the VT engine gets
    // from render suppression, and the one thing a FLIP engine has to earn.
    flushSync(commitReveal);

    let morph: MorphHandle | null = null;
    if (canMorph) {
      const itemTarget = findDestinationMorphTarget(
        activeItemElementRef.current,
        getConfig().itemMorphElementsRef.current,
        getConfig().destinationMorphElementRef.current,
      );
      if (itemTarget) {
        // Reopening mid-close: the item is somewhere between its own box and
        // the trigger's, so start from where it actually is instead of snapping
        // back to the trigger first. Read before unwinding, since cancelling
        // restores the resting pose.
        const interrupted = isMorphing(itemTarget) ? readBox(itemTarget) : null;
        cancelActiveMorph();
        const restorePathTransforms = flattenMorphPathTransforms(itemTarget);
        // Measured after reveal on purpose: `commitReveal` locks scroll, which
        // hides the scrollbar and can change the viewport the fixed portal
        // sizes against. One forced reflow, in exchange for landing on the
        // real box.
        const rest = readBox(itemTarget);
        const start = interrupted ?? from!;
        if (rest.w > 0 && rest.h > 0 && start.w > 0 && start.h > 0) {
          morph = startMorph({
            outerEl: itemTarget,
            from: start,
            to: rest,
            rest,
            fromRadius,
            toRadius: resolveMorphBorderRadius(itemTarget),
            phase: 'opening',
            crossfade: useCrossfade,
            ghostSource: triggerTarget,
            ghostSourceBox: from,
            preset: getConfig().transitionPreset,
            isolation: [restorePathTransforms],
          });
        } else {
          restorePathTransforms?.();
        }
      }
    }

    const itemEl = activeItemElementRef.current;
    if (itemEl) itemEl.setAttribute('data-skip-fade', '');

    const settle = () => {
      morph?.cancel();
      clearFlipState(docEl, stateToken);
      if (getConfig().closeGenRef.current !== gen) return;
      const cfg = getConfig();

      // Reposition the active trigger while the viewer still covers the page,
      // so a later close morph lands on-screen with no jump at close start.
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
    };

    const spec = resolveViewTransitionTiming(getConfig().transitionPreset);
    const done = morph
      ? morph.finished
      : waitForExitAnimations(findContentEl(activeItemElementRef.current), spec.duration);
    done.then(settle, settle);
  };

  const close = () => {
    const cfg = getConfig();
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
    } = cfg;

    ensureFlipStructuralStyles();

    const docEl = document.documentElement;
    const gen = closeGenRef.current;

    // Zoom composes its transform on an ancestor of the morph target, so it
    // would sit outside our own translate/scale and skew the whole track.
    // Reset instantly (the VT engine does this on Firefox only, where it was
    // the capture that broke). `replacePose` so nothing is left mid-zoom.
    const activeZoom = cfg.activeZoomRef.current;
    if (activeZoom && activeZoom.getZoom() > 1) activeZoom.reset(true);

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

    const canMorph =
      !!itemTarget &&
      !!triggerTarget &&
      isMorphTargetSizeResolvable(itemTarget) &&
      isMorphTargetSizeResolvable(triggerTarget);
    const useCrossfade = canMorph
      ? shouldUseCrossfade(triggerEl?.dataset.crossfade, 'closing')
      : true;

    // `from` is the item's box as it stands right now — including a transform
    // left by an in-flight open morph, which is what lets a reversal continue
    // from where it was interrupted instead of jumping to the resting box.
    const from = canMorph ? readBox(itemTarget!) : null;

    // Now clear everything that made `from` a transformed rect — an in-flight
    // open morph, and any transform left on the path by a committed
    // pull-to-dismiss. Both have to go before the next geometry read, because
    // `rest` has to be the item's LAYOUT box and either one makes every rect
    // report the transformed one instead.
    if (canMorph && isMorphing(itemTarget)) cancelActiveMorph();
    const restorePathTransforms = canMorph ? flattenMorphPathTransforms(itemTarget!) : null;

    // Read while containment is still intact, so the size pinned below is the one
    // the media was actually laid out and cropped at — clearing a `container-type`
    // can resize anything on the path that sized itself in container units.
    const resting = canMorph ? readBox(itemTarget!) : null;

    // Then step the item out of the scrollport entirely, so nothing the scroller
    // does for the rest of the exit can move it. `rest` is the box every track is
    // expressed against, so it has to be the anchored one.
    const restoreContainingBlocks = canMorph ? escapeContainingBlocks(itemTarget!) : null;
    const anchored =
      resting && resting.w > 0 && resting.h > 0
        ? anchorOutsideScrollport(itemTarget!, resting)
        : null;
    const rest = anchored?.rest ?? resting;
    const to = canMorph ? readBox(triggerTarget!) : null;

    // Radii come from resting style. Mid-morph the target carries a compensated
    // elliptical value sampled against a scaled box, which is not usable as an
    // endpoint — so an interrupted reversal keeps geometry continuous and lets
    // the corner shape restart from rest.
    const fromRadius = canMorph ? resolveMorphBorderRadius(itemTarget!) : null;
    const toRadius = canMorph ? resolveMorphBorderRadius(triggerTarget!) : null;

    const stateToken = applyFlipState(docEl, 'closing', {
      useCrossfade: canMorph && useCrossfade,
      preset: cfg.transitionPreset,
    });

    // Mark the lightbox closed — firing `onOpenChange` so the skin starts its
    // scrim/chrome fade — but keep the viewer mounted and painting: the closing
    // morph IS this element, so it can only go away once the animation settles.
    flushSync(cfg.commitCloseKeepMounted);

    // After the commit, not before: that update is what drops the attribute, so
    // pinning ahead of it would just be overwritten.
    const releaseTrigger = canMorph ? pinTriggerHidden(triggerTarget) : null;

    const closeScroll = resolveScrollTriggerOption(scrollTriggerIntoView, 'onClose');
    if (closeScroll) scrollTriggerEl(triggerEl, closeScroll);

    let morph: MorphHandle | null = null;
    if (canMorph && rest && rest.w > 0 && rest.h > 0) {
      morph = startMorph({
        outerEl: itemTarget!,
        from: from!,
        to: to!,
        // Where the item now lays out, anchored outside the scrollport — what the
        // animated transform is expressed against. Not `to`, which is where the
        // morph is going.
        rest,
        fromRadius,
        toRadius,
        phase: 'closing',
        crossfade: useCrossfade,
        ghostSource: triggerTarget,
        ghostSourceBox: to,
        preset: cfg.transitionPreset,
        isolation: [anchored?.restore ?? null, restoreContainingBlocks, restorePathTransforms],
      });
    } else {
      restorePathTransforms?.();
      restoreContainingBlocks?.();
      anchored?.restore();
    }

    // The viewer is live DOM for the whole exit, so take it out of hit testing
    // rather than letting a stray click land on a closing dialog.
    const contentEl = findContentEl(itemTarget ?? itemEl);
    const restorePointerEvents = suppressPointerEvents(contentEl);

    const settle = () => {
      restorePointerEvents?.();

      const cfg2 = getConfig();
      const current = cfg2.closeGenRef.current === gen;

      // Superseded by a reopen: that open has re-pinned the trigger for its own
      // morph, so releasing here would reveal it underneath. Leave it — the
      // trigger's own effect owns the attribute again from that point.
      if (current) releaseTrigger?.();
      clearFlipState(docEl, stateToken);

      // Hide the viewer BEFORE unwinding the morph, in one task.
      //
      // `cancel()` restores the inline styles it wrote, which puts the element
      // back at its resting pose — full-screen, opaque, chrome un-faded. That is
      // correct for an open, and exactly wrong here: the React update that
      // unmounts is asynchronous, so unwinding first hands the browser a frame
      // to paint the lightbox as if it had never closed. `flushSync` commits the
      // unmount before that frame; the restores then land on detached nodes and
      // are invisible.
      //
      // The VT engine cannot hit this — its DOM is already gone by the time
      // `finished` resolves, which is the whole reason it can restore freely.
      if (current) flushSync(() => cfg2.onCloseComplete(triggerEl));
      morph?.cancel();
    };

    const spec = resolveViewTransitionTiming(cfg.transitionPreset);
    const done = morph ? morph.finished : waitForExitAnimations(contentEl, spec.duration);
    done.then(settle, settle);
  };

  return { open, close };
}

export { createFlipMorph };
// Exported for tests: the sampling is the whole correctness story, and unlike
// the view-transition engine's equivalent it is a pure function of two rects.
export { buildMorphFrames };
export type { Box };
