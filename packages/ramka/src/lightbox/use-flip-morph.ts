'use client';

import * as React from 'react';
import { flushSync } from 'react-dom';

import { findItemMorphTarget, findTriggerMorphTarget } from './lightbox-context';
import { resolveTriggerIndex, scrollTriggerEl } from './use-view-transition-morph';

// ---------------------------------------------------------------------------
// FLIP morph
//
// A transform-only alternative to the View Transitions morph. Instead of
// snapshotting the whole document (the expensive part of the VT API on slow
// hardware), it flies a single fixed-position <img> clone from the trigger to
// the destination item (and back), animating:
//
//   • transform: translate + *uniform* scale  → the image never distorts
//   • clip-path: inset(...)                    → the crop "reveals" from the
//                                                 square thumbnail to the full
//                                                 letterboxed image
//   • border-radius (via clip-path `round`)    → corners interpolate
//
// Because it's all compositor-friendly and touches exactly one element, the
// morph starts on the very next frame with no per-open document raster — the
// thing that makes PhotoSwipe feel instant even under CPU throttling.
// ---------------------------------------------------------------------------

// Apple-Photos-like defaults: a longer, softly-decelerating morph. The curve
// is the iOS sheet-presentation easing (fast pickup, gentle landing); ~500ms
// reads as "smooth" rather than "snappy". Override per-instance via
// `morphDuration` / `morphEasing` on Lightbox.Root.
const DEFAULT_DURATION = 333;
const DEFAULT_EASING = 'cubic-bezier(0.4, 0, 0.22, 1)';

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Returns the `<img>` to fly for a morph target (the target itself if it is one). */
function getMorphImage(target: HTMLElement | null): HTMLImageElement | null {
  if (!target) return null;
  if (target.tagName === 'IMG') return target as HTMLImageElement;
  return target.querySelector<HTMLImageElement>('img');
}

interface CornerRadii {
  tl: number;
  tr: number;
  br: number;
  bl: number;
}

/** Parses one corner's computed radius (first token) into pixels. */
function parseCorner(value: string, box: Box): number {
  const first = value.split(' ')[0] ?? '0';
  if (first.endsWith('%')) {
    return (Math.min(box.width, box.height) * parseFloat(first)) / 100;
  }
  return parseFloat(first) || 0;
}

/**
 * Reads the four *individual* corner radii off an element. Triggers frequently
 * round only some corners (e.g. a grid cell with `rounded-tl-xl`), so reading
 * the `border-radius` shorthand's first token and applying it to all corners
 * would fill in corners that should stay square. The four longhands preserve
 * the exact per-corner shape.
 */
function parseRadii(el: HTMLElement, box: Box): CornerRadii {
  const cs = getComputedStyle(el);
  return {
    tl: parseCorner(cs.borderTopLeftRadius, box),
    tr: parseCorner(cs.borderTopRightRadius, box),
    br: parseCorner(cs.borderBottomRightRadius, box),
    bl: parseCorner(cs.borderBottomLeftRadius, box),
  };
}

/**
 * Computes the flying clone's `transform` + `clip-path` for one end of the
 * morph. The clone is laid out at natural size (`nw`×`nh`); a uniform scale
 * sizes it to the object-fit result inside `box`, and the inset clips it to the
 * visible window (the full box for `cover`, the drawn image for `contain`).
 */
function keyframeFor(
  nw: number,
  nh: number,
  box: Box,
  fit: 'cover' | 'contain',
  radii: CornerRadii,
): Keyframe {
  const scale =
    fit === 'cover'
      ? Math.max(box.width / nw, box.height / nh)
      : Math.min(box.width / nw, box.height / nh);
  const drawnW = nw * scale;
  const drawnH = nh * scale;
  const drawnX = box.left + (box.width - drawnW) / 2;
  const drawnY = box.top + (box.height - drawnH) / 2;

  // Insets are expressed in the clone's *local* (unscaled) coordinate space,
  // clamped to ≥0 (contain has no crop; cover clips the overflow).
  const left = Math.max(0, (box.left - drawnX) / scale);
  const top = Math.max(0, (box.top - drawnY) / scale);
  const right = Math.max(0, drawnX + drawnW - (box.left + box.width)) / scale;
  const bottom = Math.max(0, drawnY + drawnH - (box.top + box.height)) / scale;

  // Per-corner radii, in local space. Because the clone is uniformly scaled,
  // dividing by `scale` yields the intended on-screen radius after transform,
  // and preserves asymmetric rounding (e.g. a single rounded trigger corner).
  const s = scale > 0 ? scale : 1;
  const round = `${radii.tl / s}px ${radii.tr / s}px ${radii.br / s}px ${radii.bl / s}px`;

  return {
    transform: `translate(${drawnX}px, ${drawnY}px) scale(${scale})`,
    clipPath: `inset(${top}px ${right}px ${bottom}px ${left}px round ${round})`,
  };
}

/** Creates the fixed-position flying clone, appended to `<body>`. */
function createFlyingImage(src: string, nw: number, nh: number): HTMLImageElement {
  const img = new Image();
  img.src = src;
  img.decoding = 'sync';
  img.setAttribute('aria-hidden', 'true');
  Object.assign(img.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    width: `${nw}px`,
    height: `${nh}px`,
    margin: '0',
    maxWidth: 'none',
    maxHeight: 'none',
    transformOrigin: '0 0',
    pointerEvents: 'none',
    userSelect: 'none',
    zIndex: '2147483647',
    willChange: 'transform, clip-path',
    display: 'block',
  } satisfies Partial<CSSStyleDeclaration>);
  document.body.appendChild(img);
  return img;
}

/**
 * Flies a freshly-created clone from `fromKf` to `toKf`.
 *
 * Critically, it does NOT start the WAAPI clock until the clone is actually
 * ready to paint: the start pose is pinned inline, then we `await decode()`
 * (cheap — the source is already on-screen/cached) and wait one animation
 * frame so any just-committed mount/paint work has flushed. Because WAAPI
 * animations advance on the document timeline (not per-frame), starting the
 * clock while the main thread is still busy would let the first ~100ms elapse
 * unpainted — the "skipped frames / abrupt start" the VT path never shows,
 * since the browser only starts a view-transition after its snapshots are ready.
 *
 * Returns the clone plus a promise that settles when the flight finishes.
 */
function flyClone(
  src: string,
  nw: number,
  nh: number,
  fromKf: Keyframe,
  toKf: Keyframe,
  duration: number,
  easing: string,
): { clone: HTMLImageElement; finished: Promise<void> } {
  const clone = createFlyingImage(src, nw, nh);
  // Pin the start pose immediately so there's no unpositioned flash while we
  // wait for the clone to become paint-ready.
  clone.style.transform = fromKf.transform as string;
  clone.style.clipPath = fromKf.clipPath as string;

  const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  const finished = (async () => {
    try {
      await clone.decode();
    } catch {
      /* decode can reject if removed early; ignore and proceed */
    }
    // Two frames, not one: on open we've just synchronously mounted the whole
    // viewer, and a single rAF can fire *before* the browser paints that heavy
    // tree — leaving the (time-based) WAAPI clock to start mid-paint and skip
    // the first frames. Waiting a second frame guarantees a full paint boundary
    // has elapsed, so the clone starts animating on an idle main thread.
    await nextFrame();
    await nextFrame();
    const anim = clone.animate([fromKf, toKf], { duration, easing, fill: 'both' });
    try {
      await anim.finished;
    } catch {
      /* animation cancelled (e.g. clone removed); ignore */
    }
  })();

  return { clone, finished };
}

/** Temporarily forces a style property, returning a restore function. */
function forceStyle(el: HTMLElement, prop: string, value: string): () => void {
  const prev = el.style.getPropertyValue(prop);
  const prevPriority = el.style.getPropertyPriority(prop);
  el.style.setProperty(prop, value, 'important');
  return () => {
    if (prev) el.style.setProperty(prop, prev, prevPriority);
    else el.style.removeProperty(prop);
  };
}

/** Awaits every running animation on `el` (or resolves immediately if none). */
function afterAnimations(el: HTMLElement | null): Promise<void> {
  if (!el) return Promise.resolve();
  return Promise.allSettled(el.getAnimations().map((a) => a.finished)).then(() => undefined);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface FlipMorphConfig {
  morphTo: 'active' | 'origin' | 'closest';
  scrollTriggerIntoView: null | { type: 'onChange' | 'onClose'; behavior?: 'smooth' | 'instant' };
  duration?: number;
  easing?: string;
  triggerElementsRef: React.RefObject<Map<number, HTMLElement>>;
  activeItemElementRef: React.RefObject<HTMLElement | null>;
  openingTriggerIndexRef: React.RefObject<number>;
  dialogElementRef: React.RefObject<HTMLElement | null>;
  activeIndexRef: React.RefObject<number>;
  closeGenRef: React.MutableRefObject<number>;
  /** flushSync body that mounts + flips open state true (fires onOpenChange). */
  commitOpen: () => void;
  /** Flip open state false + fire onOpenChange(false) WITHOUT unmounting, so
   *  the consumer's backdrop/content fade-out CSS can play during the morph. */
  beginClose: () => void;
  /** Unmount the portal (setMounted(false)) once the close morph settles. */
  finishClose: () => void;
  onOpenComplete: () => void;
  onCloseComplete: (triggerEl: HTMLElement | undefined) => void;
}

interface FlipMorph {
  open: () => void;
  close: () => void;
}

function useFlipMorph(config: FlipMorphConfig): FlipMorph {
  const configRef = React.useRef(config);
  configRef.current = config;

  const open = React.useCallback(() => {
    const cfg = configRef.current;
    const duration = cfg.duration ?? DEFAULT_DURATION;
    const easing = cfg.easing ?? DEFAULT_EASING;
    const gen = cfg.closeGenRef.current;

    const triggerEl = cfg.triggerElementsRef.current.get(cfg.openingTriggerIndexRef.current);
    const triggerTarget = triggerEl ? findTriggerMorphTarget(triggerEl) : null;

    // No trigger to morph from — just mount and finish.
    if (!triggerTarget) {
      cfg.commitOpen();
      requestAnimationFrame(() => {
        if (cfg.closeGenRef.current === gen) cfg.onOpenComplete();
      });
      return;
    }

    const triggerImg = getMorphImage(triggerTarget);
    const triggerBox = triggerTarget.getBoundingClientRect();
    const triggerRadii = parseRadii(triggerTarget, triggerBox);

    // Hide the trigger *before* mounting so it doesn't sit under the fading-in
    // backdrop next to the flying clone for a frame.
    const restoreTrigger = forceStyle(triggerTarget, 'visibility', 'hidden');

    // Mount synchronously so the destination item is laid out and measurable.
    flushSync(cfg.commitOpen);

    const itemEl = cfg.activeItemElementRef.current;
    const itemTarget = itemEl ? findItemMorphTarget(itemEl) : null;
    const itemImg = itemTarget ? getMorphImage(itemTarget) : null;

    // Prefer the crisp full-res image if it's already decoded; otherwise fly
    // the (decoded, on-screen) trigger thumbnail and swap to the real item on
    // completion.
    let src: string | undefined;
    let nw = 0;
    let nh = 0;
    if (itemImg && itemImg.complete && itemImg.naturalWidth > 0) {
      src = itemImg.currentSrc || itemImg.src;
      nw = itemImg.naturalWidth;
      nh = itemImg.naturalHeight;
    } else if (triggerImg && triggerImg.naturalWidth > 0) {
      src = triggerImg.currentSrc || triggerImg.src;
      nw = triggerImg.naturalWidth;
      nh = triggerImg.naturalHeight;
    }

    if (!itemTarget || !src || !nw || !nh) {
      restoreTrigger();
      requestAnimationFrame(() => {
        if (cfg.closeGenRef.current === gen) cfg.onOpenComplete();
      });
      return;
    }

    const itemBox = (itemImg ?? itemTarget).getBoundingClientRect();
    const itemRadii = parseRadii(itemTarget, itemBox);

    const restoreItem = forceStyle(itemImg ?? itemTarget, 'opacity', '0');

    const fromKf = keyframeFor(nw, nh, triggerBox, 'cover', triggerRadii);
    const toKf = keyframeFor(nw, nh, itemBox, 'contain', itemRadii);
    const { clone, finished } = flyClone(src, nw, nh, fromKf, toKf, duration, easing);

    finished.then(() => {
      clone.remove();
      restoreItem();
      restoreTrigger();
      if (cfg.closeGenRef.current === gen) cfg.onOpenComplete();
    });
  }, []);

  const close = React.useCallback(() => {
    const cfg = configRef.current;
    const duration = cfg.duration ?? DEFAULT_DURATION;
    const easing = cfg.easing ?? DEFAULT_EASING;
    const gen = cfg.closeGenRef.current;

    const itemEl = cfg.activeItemElementRef.current;
    const itemTarget = itemEl ? findItemMorphTarget(itemEl) : null;
    const itemImg = itemTarget ? getMorphImage(itemTarget) : null;

    const triggerIdx = resolveTriggerIndex(
      cfg.activeIndexRef.current,
      cfg.morphTo,
      cfg.openingTriggerIndexRef.current,
      cfg.triggerElementsRef.current,
    );
    const triggerEl = cfg.triggerElementsRef.current.get(triggerIdx);
    if (cfg.scrollTriggerIntoView && triggerEl) {
      scrollTriggerEl(triggerEl, 'instant');
    }
    const triggerTarget = triggerEl ? findTriggerMorphTarget(triggerEl) : null;

    const finalize = () => {
      if (cfg.closeGenRef.current === gen) {
        cfg.finishClose();
        cfg.onCloseComplete(triggerEl);
      }
    };

    // Nothing to morph — fall back to a plain fade-then-unmount.
    if (!itemTarget || !triggerTarget) {
      cfg.beginClose();
      afterAnimations(cfg.dialogElementRef.current).then(finalize);
      return;
    }

    const itemBox = (itemImg ?? itemTarget).getBoundingClientRect();
    const itemRadii = parseRadii(itemTarget, itemBox);
    const triggerBox = triggerTarget.getBoundingClientRect();
    const triggerRadii = parseRadii(triggerTarget, triggerBox);

    let src: string | undefined;
    let nw = 0;
    let nh = 0;
    if (itemImg && itemImg.naturalWidth > 0) {
      src = itemImg.currentSrc || itemImg.src;
      nw = itemImg.naturalWidth;
      nh = itemImg.naturalHeight;
    } else {
      const triggerImg = getMorphImage(triggerTarget);
      if (triggerImg && triggerImg.naturalWidth > 0) {
        src = triggerImg.currentSrc || triggerImg.src;
        nw = triggerImg.naturalWidth;
        nh = triggerImg.naturalHeight;
      }
    }

    if (!src || !nw || !nh) {
      cfg.beginClose();
      afterAnimations(cfg.dialogElementRef.current).then(finalize);
      return;
    }

    // Hide the real item image, start the chrome/backdrop fade (open → false,
    // still mounted), and hide the trigger so the clone is the only image that
    // lands on it.
    forceStyle(itemImg ?? itemTarget, 'opacity', '0');
    cfg.beginClose();
    const restoreTrigger = forceStyle(triggerTarget, 'visibility', 'hidden');

    const fromKf = keyframeFor(nw, nh, itemBox, 'contain', itemRadii);
    const toKf = keyframeFor(nw, nh, triggerBox, 'cover', triggerRadii);
    const { clone, finished } = flyClone(src, nw, nh, fromKf, toKf, duration, easing);

    finished.then(() => {
      clone.remove();
      restoreTrigger();
      finalize();
    });
  }, []);

  return React.useMemo(() => ({ open, close }), [open, close]);
}

export { useFlipMorph };
export type { FlipMorphConfig, FlipMorph };
