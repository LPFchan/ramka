import { morphTiming } from './vt-timing';

// ---------------------------------------------------------------------------
// FLIP morph engine — EXPERIMENTAL prototype, opt-in.
//
// Enable with `window.__RAMKA_VT_FLIP__ = true` (docs: `?vtflip`).
//
// Drives the hard-cut trigger <-> item morph WITHOUT the View Transitions
// API: a fixed-position "ghost" clone of the item media animates between the
// trigger box and the item box with compositor-only tracks — the same
// frozen-box + counter-transform + compensated-radius math as
// vt-composited-morph.ts, applied to a real element instead of VT pseudos.
// The page chrome (backdrop, content fades) keeps running on its normal CSS
// transitions; only the morphing pixels are ghosted.
//
// Why prototype this when the composited VT morph already animates
// transform-only?
//   1. TRUE INTERRUPTIBILITY. A superseding open/close reads the aborted
//      ghost's mid-flight pose (box + radius at its current eased progress)
//      and starts its own morph FROM that pose — Esc mid-open shrinks back
//      from wherever the picture currently is. A VT can only be skipped,
//      snapping to the settled state before the reverse morph starts.
//   2. No document snapshot: rendering is never suppressed, and Firefox's
//      capture bugs (full-bleed inset, zoomed-clip) can't apply — those
//      workarounds are simply not needed on this path.
//   3. No document snapshot also means the page stays interactive during the
//      morph in principle (pointer-events are only blocked by the normal
//      modal machinery, not by a UA overlay).
//
// Start policy: the tracks start SYNCHRONOUSLY, committing with the same
// frame that first paints the ghost — any deferred start (rAF chains, decode
// races) costs full frames, which under a throttled main thread measured as
// multi-hundred-ms lag behind the VT engine. Blank-frame protection is
// `decoding="sync"` on the ghost image instead of an async decode wait.
// WebKit's commit-skip is NOT defeated by any of this (accelerated
// animations fast-forward past their first-commit latency); the soft-launch
// preset curves mask it, exactly as on the VT engine.
//
// Delivery matches the VT engine per browser: WebKit gets the tracks as
// generated CSS animations (the path validated on the composited morph —
// WebKit's WAAPI anchoring on fresh layers behaved measurably worse), other
// engines get WAAPI.
//
// What it deliberately does NOT cover (falls back to the VT engine):
//   - crossfade triggers (the plus-lighter dissolve needs both snapshots),
//   - non-<img> morph media (cloning live video/custom nodes is wrong),
//   - zoomed-in items (the live ancestor-overflow crop isn't reproduced),
//   - reduced-motion / low-end devices (Root never calls the morph then).
//
// Ghost anatomy: a fixed wrapper frozen at the LARGER box (item side — crisp
// texture) that scales/translates between the endpoint boxes with
// `transform-origin: 0 0` and `overflow: hidden`; inside it a clone of the
// item's <img> laid out at 100%×100%, counter-transformed each frame so the
// picture keeps its true aspect ratio (`object-fit: cover` semantics against
// the animated box — zero distortion).
// ---------------------------------------------------------------------------

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

type Corners = [number, number, number, number];

/** A morph's visual state at some instant — the retarget handoff contract. */
interface FlipPose {
  rect: Rect;
  radius: Corners;
}

interface FlipMorphHandle {
  /** Resolves when the morph finishes naturally. Never settles if aborted. */
  finished: Promise<void>;
  /** Box + radius at the current eased progress (frame 0 until tracks start). */
  getPose: () => FlipPose;
  /** Cancel tracks and remove the ghost immediately (superseding action). */
  abort: () => void;
}

function isFlipMorphEnabled(): boolean {
  return (
    typeof window !== 'undefined' &&
    (window as unknown as Record<string, unknown>).__RAMKA_VT_FLIP__ === true
  );
}

function supportsFlipMorph(): boolean {
  return typeof Element !== 'undefined' && typeof Element.prototype.animate === 'function';
}

/** Safari/WebKit detection — same signal as vt-composited-morph.ts. */
function isWebKit(): boolean {
  return typeof window !== 'undefined' && 'GestureEvent' in window;
}

/** Dev/debug visibility — same sink contract as vt-composited-morph.ts. */
function debugLog(...args: unknown[]) {
  if (typeof window === 'undefined') return;
  const flag = (window as unknown as Record<string, unknown>).__RAMKA_VT_DEBUG__;
  if (!flag) return;
  // eslint-disable-next-line no-console -- opt-in debug tracing
  console.log('[ramka-vt-flip]', ...args);
  const endpoint = typeof flag === 'string' ? flag : '/api/vt-log';
  const safe = args.map((a) => {
    if (typeof a === 'string') return a;
    try {
      return JSON.parse(JSON.stringify(a));
    } catch {
      return String(a);
    }
  });
  try {
    void fetch(endpoint, {
      method: 'POST',
      keepalive: true,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ flipLog: safe, t: Date.now() }),
    });
  } catch {
    // Best-effort delivery.
  }
}

const fmt = (n: number) => Number(n.toFixed(4));

const lerp = (a: number, b: number, q: number) => a + (b - a) * q;

/** Parse a resolved radius list (`resolveMorphBorderRadius` output) into
 * per-corner px values [tl, tr, br, bl]. */
function parseRadiusList(value: string | null): Corners {
  const tokens = (value ?? '')
    .trim()
    .split(/\s+/)
    .map((t) => Number.parseFloat(t))
    .filter((n) => Number.isFinite(n) && n >= 0);
  const [a = 0, b = a, c = a, d = b] = tokens;
  return [a, b, c, d];
}

function rectOf(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

function isRenderableRect(r: Rect): boolean {
  return r.width > 0.5 && r.height > 0.5;
}

/**
 * The <img> whose pixels the ghost shows. Ghost fidelity is limited to plain
 * images on purpose — cloning live video or arbitrary morph content would
 * silently render wrong, so those targets keep the VT engine.
 */
function findGhostImage(target: HTMLElement): HTMLImageElement | null {
  const img =
    target.tagName === 'IMG'
      ? (target as HTMLImageElement)
      : target.querySelector<HTMLImageElement>('img');
  if (!img) return null;
  if (!(img.currentSrc || img.src)) return null;
  return img;
}

/** Hide a live element (layout preserved) and return the restore. */
function hideLive(el: HTMLElement): () => void {
  const prev = el.style.visibility;
  el.style.visibility = 'hidden';
  return () => {
    el.style.visibility = prev;
  };
}

// ---------------------------------------------------------------------------
// Track sampling
// ---------------------------------------------------------------------------

interface SampledTracks {
  wrapper: Keyframe[];
  child: Keyframe[];
  radius: Keyframe[];
  hasRadius: boolean;
}

/**
 * Sample all tracks at eased progress, baked into linear-offset keyframes
 * (the counter track needs 1/s(t), which no easing function expresses — same
 * technique as the composited VT morph).
 *
 * Coordinate model: the wrapper is laid out at `frozen`. At progress q the
 * morph box is the lerped rect r(q) between `from` and `to`; the wrapper
 * renders it as translate(r.left − frozen.left, r.top − frozen.top)
 * scale(r.w/frozen.w, r.h/frozen.h) about origin 0 0 — its overflow clip
 * scales along, so the crop window IS the animated box. The child (image at
 * 100%×100% of frozen) is counter-transformed to cover the box at uniform
 * scale, and radii are compensated per-axis so corners render round under
 * the non-uniform wrapper scale.
 */
function sampleTracks(opts: {
  from: Rect;
  to: Rect;
  frozen: Rect;
  rFrom: Corners;
  rTo: Corners;
  ease: (t: number) => number;
  duration: number;
}): SampledTracks {
  const { from, to, frozen, rFrom, rTo, ease, duration } = opts;
  const steps = Math.min(120, Math.max(24, Math.round(duration / 8)));
  const w1 = frozen.width;
  const h1 = frozen.height;
  const hasRadius = [...rFrom, ...rTo].some((r) => r > 0);

  const wrapper: Keyframe[] = [];
  const child: Keyframe[] = [];
  const radius: Keyframe[] = [];

  for (let i = 0; i <= steps; i++) {
    const offset = i / steps;
    const q = ease(offset);

    // Clamp: a degenerate endpoint box (trigger hidden mid-flight) would
    // otherwise divide the counter track by ~0 into NaN keyframes.
    const w = Math.max(0.5, lerp(from.width, to.width, q));
    const h = Math.max(0.5, lerp(from.height, to.height, q));
    const left = lerp(from.left, to.left, q);
    const top = lerp(from.top, to.top, q);

    wrapper.push({
      offset,
      transform: `translate(${fmt(left - frozen.left)}px, ${fmt(top - frozen.top)}px) scale(${fmt(w / w1)}, ${fmt(h / h1)})`,
    });

    // Cover-fit the (w1, h1) picture into the (w, h) box, expressed in
    // wrapper-local (pre-scale) coordinates: factor w1/w on X, h1/h on Y.
    const k = Math.max(w / w1, h / h1);
    const dx = (((w - k * w1) / 2) * w1) / w;
    const dy = (((h - k * h1) / 2) * h1) / h;
    child.push({
      offset,
      transform: `translate(${fmt(dx)}px, ${fmt(dy)}px) scale(${fmt((k * w1) / w)}, ${fmt((k * h1) / h)})`,
    });

    if (hasRadius) {
      const rH = rFrom.map((r, c) => fmt((lerp(r, rTo[c]!, q) * w1) / w));
      const rV = rFrom.map((r, c) => fmt((lerp(r, rTo[c]!, q) * h1) / h));
      radius.push({
        offset,
        borderRadius: `${rH.map((r) => `${r}px`).join(' ')} / ${rV.map((r) => `${r}px`).join(' ')}`,
      });
    }
  }

  return { wrapper, child, radius, hasRadius };
}

/** Serialize sampled keyframes into a CSS @keyframes rule (WebKit path). */
function keyframesCss(
  name: string,
  frames: Keyframe[],
  prop: 'transform' | 'borderRadius',
): string {
  const cssProp = prop === 'borderRadius' ? 'border-radius' : 'transform';
  const body = frames
    .map((f) => `${((f.offset as number) * 100).toFixed(3)}% { ${cssProp}: ${String(f[prop])}; }`)
    .join('\n');
  return `@keyframes ${name} {\n${body}\n}`;
}

// ---------------------------------------------------------------------------
// Ghost
// ---------------------------------------------------------------------------

/** Unique per-ghost id: scopes the WebKit keyframes and forces fresh starts. */
let flipSeq = 0;

function buildGhost(
  sourceImg: HTMLImageElement,
  frozen: Rect,
  id: string,
): { root: HTMLDivElement; media: HTMLImageElement } {
  const root = document.createElement('div');
  root.setAttribute('data-ramka-flip-ghost', id);
  Object.assign(root.style, {
    position: 'fixed',
    left: `${fmt(frozen.left)}px`,
    top: `${fmt(frozen.top)}px`,
    width: `${fmt(frozen.width)}px`,
    height: `${fmt(frozen.height)}px`,
    margin: '0',
    padding: '0',
    border: '0',
    boxSizing: 'border-box',
    overflow: 'hidden',
    transformOrigin: '0 0',
    pointerEvents: 'none',
    // Above every portal/backdrop — the ghost owns the morphing pixels the
    // way the VT pseudo layer would.
    zIndex: '2147483647',
    willChange: 'transform',
  } satisfies Partial<CSSStyleDeclaration>);

  // Clone (not new Image()) so srcset/sizes/crossorigin resolve the exact
  // same candidate the live element already decoded — the pixels come
  // straight from cache.
  const media = sourceImg.cloneNode(false) as HTMLImageElement;
  media.removeAttribute('class');
  media.removeAttribute('style');
  media.removeAttribute('id');
  media.alt = '';
  media.setAttribute('aria-hidden', 'true');
  media.draggable = false;
  media.loading = 'eager';
  // Decode during the paint that first shows the ghost (the source is
  // already in the decoded-image cache — the live item displays it), so the
  // ghost can never present blank without ever waiting on an async decode.
  media.decoding = 'sync';
  Object.assign(media.style, {
    display: 'block',
    width: '100%',
    height: '100%',
    // Fit-box media equals the image's inscribed rect, so cover == contain
    // at rest; cover keeps the crop coherent mid-flight.
    objectFit: 'cover',
    margin: '0',
    padding: '0',
    border: '0',
    transformOrigin: '0 0',
  } satisfies Partial<CSSStyleDeclaration>);

  root.appendChild(media);
  return { root, media };
}

// ---------------------------------------------------------------------------
// Morph runner
// ---------------------------------------------------------------------------

function runFlipMorph(opts: {
  from: Rect;
  to: Rect;
  frozen: Rect;
  rFrom: Corners;
  rTo: Corners;
  sourceImg: HTMLImageElement;
  phase: 'opening' | 'closing';
  /** Allow the WebKit post-flush start deferral (off for retargets). */
  deferStart: boolean;
}): FlipMorphHandle {
  const { duration, ease, label } = morphTiming();
  const { from, to, frozen, rFrom, rTo } = opts;
  const tracks = sampleTracks({ from, to, frozen, rFrom, rTo, ease, duration });

  const id = String(++flipSeq);
  const { root, media } = buildGhost(opts.sourceImg, frozen, id);

  // Hold frame 0 inline until the tracks start (and as the underlying value
  // beneath fill-mode both).
  root.style.transform = String(tracks.wrapper[0]!.transform);
  media.style.transform = String(tracks.child[0]!.transform);
  if (tracks.hasRadius) {
    root.style.borderRadius = String(tracks.radius[0]!.borderRadius);
  }
  document.body.appendChild(root);

  let settled = false;
  let animations: Animation[] = [];
  let styleEl: HTMLStyleElement | null = null;
  let resolveFinished!: () => void;
  const finished = new Promise<void>((resolve) => {
    resolveFinished = resolve;
  });

  const teardown = () => {
    for (const a of animations) {
      try {
        a.cancel();
      } catch {
        // Detached/finished animations may refuse — nothing to clean.
      }
    }
    animations = [];
    styleEl?.remove();
    styleEl = null;
    root.remove();
  };

  /** Current eased progress of the morph (0 while holding frame 0). */
  const currentProgress = (): number => {
    const ct = animations[0]?.currentTime;
    const t = typeof ct === 'number' && Number.isFinite(ct) ? ct : 0;
    if (!(duration > 0)) return 1;
    return ease(Math.min(1, Math.max(0, t / duration)));
  };

  const getPose = (): FlipPose => {
    const q = currentProgress();
    return {
      rect: {
        left: lerp(from.left, to.left, q),
        top: lerp(from.top, to.top, q),
        width: lerp(from.width, to.width, q),
        height: lerp(from.height, to.height, q),
      },
      radius: rFrom.map((r, c) => lerp(r, rTo[c]!, q)) as Corners,
    };
  };

  const abort = () => {
    if (settled) return;
    settled = true;
    teardown();
    // `finished` intentionally never settles on abort — the superseding
    // action owns the lifecycle from here.
  };

  const finish = () => {
    if (settled) return;
    settled = true;
    teardown();
    resolveFinished();
  };

  const watchFinished = () => {
    void Promise.all(animations.map((a) => a.finished)).then(finish, () => {
      // Rejection = cancelled via abort(); teardown already ran.
    });
  };

  const startWaapi = (): boolean => {
    const options: KeyframeAnimationOptions = { duration, easing: 'linear', fill: 'both' };
    try {
      animations.push(root.animate(tracks.wrapper, options));
      if (tracks.hasRadius) {
        // Separate animation: mixing a paint property into the transform
        // effect would demote the whole effect off the compositor.
        animations.push(root.animate(tracks.radius, options));
      }
      animations.push(media.animate(tracks.child, options));
    } catch (error) {
      debugLog('flip WAAPI failed', String(error));
      return false;
    }
    return true;
  };

  /**
   * WebKit delivery: generated CSS animations instead of WAAPI — the path
   * validated on the composited VT morph (WebKit's accelerated-WAAPI
   * anchoring on fresh layers measured worse than CSS animations there;
   * keep the engines comparable).
   */
  const startWebkitCss = (): boolean => {
    const gName = `ramka-flipg-${id}`;
    const rName = `ramka-flipr-${id}`;
    const cName = `ramka-flipc-${id}`;
    const track = (name: string) => `${name} ${duration}ms linear both`;
    const wrapperTracks = tracks.hasRadius ? `${track(gName)}, ${track(rName)}` : track(gName);

    const el = document.createElement('style');
    el.setAttribute('data-ramka-flip-style', id);
    el.textContent = `
${keyframesCss(gName, tracks.wrapper, 'transform')}
${tracks.hasRadius ? keyframesCss(rName, tracks.radius, 'borderRadius') : ''}
${keyframesCss(cName, tracks.child, 'transform')}
[data-ramka-flip-ghost="${id}"] { animation: ${wrapperTracks}; }
[data-ramka-flip-ghost="${id}"] > img { animation: ${track(cName)}; }
`;
    document.head.appendChild(el);
    styleEl = el;

    // getAnimations() forces the style flush that starts the CSS animations,
    // and hands us the Animation objects for pose reads + finish tracking.
    const started = [...root.getAnimations(), ...media.getAnimations()];
    if (started.length === 0) {
      el.remove();
      styleEl = null;
      debugLog('flip CSS animations did not start, falling back to WAAPI');
      return false;
    }
    animations = started;
    return true;
  };

  const start = () => {
    if (settled) return;
    const ok = isWebKit() ? startWebkitCss() || startWaapi() : startWaapi();
    if (!ok) {
      // Land on the end state (ghost removed, page shows the real end
      // geometry) rather than leaving a stuck ghost.
      debugLog('flip tracks failed, hard-landing');
      finish();
      return;
    }
    watchFinished();
  };

  debugLog(`flip ${opts.phase} engaged`, {
    from,
    to,
    timing: label,
    hasRadius: tracks.hasRadius,
    webkit: isWebKit(),
  });

  // Start policy is PER-ENGINE — each browser's animation-start anchoring
  // demands the opposite trade:
  //
  // - Chromium/Firefox: start SYNCHRONOUSLY. They anchor compositor
  //   animations at frame activation, so the tracks can ride the reveal's
  //   own (storm-priced) frame with zero truncation — verified on presented
  //   screencast pixels at 6x CPU throttle. Any deferred start (rAF chains,
  //   decode races) costs additional full frames, which measured as
  //   multi-hundred-ms start lag behind the VT engine.
  //
  // - WebKit: defer past the reveal flush (double rAF). Accelerated
  //   animations fast-forward past their own transaction's commit->display
  //   latency, and a transaction that carries the ENTIRE reveal (viewer
  //   tree, blur, image layers) has a huge one — the morph would skip far
  //   beyond the soft-launch window the preset curves can mask. Committing
  //   the tracks in a separate, tiny transaction afterwards reproduces the
  //   VT engine's anchor (its replacements commit at `transition.ready`,
  //   also post-flush), whose residual ~2-3 frame skip the curves absorb.
  //
  // Retargets (fromPose) always start synchronously either way — the layer
  // tree is warm mid-interaction and the handoff must read as one motion;
  // callers pass `deferStart` accordingly.
  if (opts.deferStart && isWebKit()) {
    requestAnimationFrame(() => {
      requestAnimationFrame(start);
    });
  } else {
    start();
  }

  return { finished, getPose, abort };
}

// ---------------------------------------------------------------------------
// Active-morph registry (interrupts)
// ---------------------------------------------------------------------------

/**
 * At most one flip morph animates at a time (document morphs are exclusive,
 * matching the VT engine). A superseding open/close aborts the active one —
 * and receives its mid-flight pose, so the new morph can start FROM the
 * pixels currently on screen instead of snapping to a settled state.
 */
let activeFlip: { abort: () => FlipPose } | null = null;

function abortActiveFlipMorph(): FlipPose | null {
  const active = activeFlip;
  activeFlip = null;
  return active ? active.abort() : null;
}

function registerActiveFlip(handle: FlipMorphHandle, restore: () => void): void {
  const entry = {
    abort: (): FlipPose => {
      const pose = handle.getPose();
      handle.abort();
      restore();
      return pose;
    },
  };
  activeFlip = entry;
  void handle.finished.then(() => {
    if (activeFlip === entry) activeFlip = null;
  });
}

// ---------------------------------------------------------------------------
// Open / close entry points (called from use-view-transition-morph)
// ---------------------------------------------------------------------------

/**
 * FLIP open. Returns `false` — without touching any state — when a
 * precondition fails, so the caller falls through to the VT engine. Once it
 * returns `true` it owns reveal and completion (`onDone`).
 */
function tryFlipOpen(opts: {
  triggerTarget: HTMLElement;
  itemTarget: HTMLElement;
  itemEl: HTMLElement | null;
  /** Resolved trigger radius (from) / item radius (to), px lists. */
  fromRadius: string | null;
  toRadius: string | null;
  /** Mid-flight pose of an interrupted close — retarget start (see registry). */
  fromPose: FlipPose | null;
  /** flushSync(commitReveal) — reveals the prepared tree. */
  reveal: () => void;
  /** Completion: clear doc morph state + onOpenComplete (gen-guarded by caller). */
  onDone: () => void;
}): boolean {
  if (!supportsFlipMorph()) return false;
  const sourceImg = findGhostImage(opts.itemTarget);
  if (!sourceImg) {
    debugLog('open bail: no <img> media for ghost');
    return false;
  }
  const fromRect = opts.fromPose?.rect ?? rectOf(opts.triggerTarget);
  if (!isRenderableRect(fromRect)) {
    debugLog('open bail: from rect not renderable', fromRect);
    return false;
  }

  // From here on this engine owns the open. Reveal + measure + ghost insert
  // + item hide all happen in this synchronous block, so the first painted
  // frame is: chrome fading in, real item hidden, ghost sitting exactly on
  // the (already hidden) trigger — or on the interrupted close's pose.
  opts.reveal();

  const toRect = rectOf(opts.itemTarget);
  if (!isRenderableRect(toRect)) {
    // Already revealed — can't hand back to the VT engine (its old snapshot
    // would capture the revealed state). Finish without a morph; the chrome
    // fades still play.
    debugLog('open bail post-reveal: item rect not renderable', toRect);
    opts.onDone();
    return true;
  }

  // Same contract as the VT open: the item must not double-animate its own
  // entrance fade while the morph owns its pixels.
  opts.itemEl?.setAttribute('data-skip-fade', '');

  const restoreItem = hideLive(opts.itemTarget);
  const handle = runFlipMorph({
    from: fromRect,
    to: toRect,
    frozen: toRect,
    rFrom: opts.fromPose?.radius ?? parseRadiusList(opts.fromRadius),
    rTo: parseRadiusList(opts.toRadius),
    sourceImg,
    phase: 'opening',
    deferStart: !opts.fromPose,
  });
  registerActiveFlip(handle, restoreItem);
  void handle.finished.then(() => {
    restoreItem();
    opts.onDone();
  });
  return true;
}

/**
 * FLIP close. Returns `false` — without touching any state — when a
 * precondition fails (caller falls through to the VT engine). Once `true`,
 * it owns the soft close, the onClose scroll, and completion.
 */
function tryFlipClose(opts: {
  itemTarget: HTMLElement;
  triggerTarget: HTMLElement;
  /** Resolved item radius (from) / trigger radius (to), px lists. */
  fromRadius: string | null;
  toRadius: string | null;
  /** Mid-flight pose of an interrupted open — retarget start (see registry). */
  fromPose: FlipPose | null;
  /**
   * flushSync(commitSoftClose) — flips open to false so chrome/backdrop run
   * their exit fades, but KEEPS the tree mounted under the ghost (unmount
   * happens in `onDone`, hook side).
   */
  softClose: () => void;
  /** The `onClose` scrollTriggerIntoView moment (may be a no-op). */
  scrollTrigger: () => void;
  /** Completion: clear doc morph state + unmount + onCloseComplete (hook side). */
  onDone: () => void;
}): boolean {
  if (!supportsFlipMorph()) return false;
  const sourceImg = findGhostImage(opts.itemTarget);
  if (!sourceImg) {
    debugLog('close bail: no <img> media for ghost');
    return false;
  }
  const fromRect = opts.fromPose?.rect ?? rectOf(opts.itemTarget);
  if (!isRenderableRect(fromRect)) {
    debugLog('close bail: from rect not renderable', fromRect);
    return false;
  }
  if (!isRenderableRect(rectOf(opts.triggerTarget))) {
    debugLog('close bail: trigger rect not renderable');
    return false;
  }

  const restoreItem = hideLive(opts.itemTarget);
  opts.softClose();
  // Scroll the trigger home BEFORE measuring the destination (mirrors the VT
  // close, which scrolls inside the transition callback).
  opts.scrollTrigger();
  const toRect = rectOf(opts.triggerTarget);

  const handle = runFlipMorph({
    from: fromRect,
    to: toRect,
    // Freeze at the larger box (crisp texture) whichever direction we run.
    frozen: fromRect,
    rFrom: opts.fromPose?.radius ?? parseRadiusList(opts.fromRadius),
    rTo: parseRadiusList(opts.toRadius),
    sourceImg,
    phase: 'closing',
    deferStart: !opts.fromPose,
  });
  registerActiveFlip(handle, restoreItem);
  void handle.finished.then(() => {
    restoreItem();
    opts.onDone();
  });
  return true;
}

export { isFlipMorphEnabled, abortActiveFlipMorph, tryFlipOpen, tryFlipClose };
export type { FlipPose };
