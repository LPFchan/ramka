import { VIEW_TRANSITION_NAME, VT_COMPOSITOR_HOLD_ATTR } from './vt-constants';
import { LightboxDocumentCssVars } from './lightbox-css-vars';
import { LightboxDocumentDataAttributes } from './lightbox-data-attributes';
import { isAndroidBlinkSnapshotRoot } from './is-android-blink';
import { compensatedMorphRadiusAt, parseMorphRadiusList } from './vt-morph-radius';
import { morphTiming } from './vt-timing';
import { insertLibrarySheet, type LibrarySheet } from './lightbox-style-sheets';
import { ensureLibrarySheet } from './vt-style-sheets';

// ---------------------------------------------------------------------------
// Composited (transform-only) morph — the morph ramka ships everywhere.
//
// The stock UA morph is not an alternative engine, it is the fallback: this
// upgrade replaces the browser's own group animation at runtime and bails back
// to it whenever a precondition below fails (see the validation block in
// `upgrade`). `window.__RAMKA_VT_COMPOSITED__ = false` (docs: `?vtstock`)
// forces that fallback, which is a debugging escape hatch rather than a
// supported configuration.
//
// Why: the UA-generated `::view-transition-group` animation interpolates
// `width`/`height` alongside `transform`. Layout properties can never run on
// the compositor, so on a busy main thread the morph janks — and on Firefox
// for Android it *wobbles*, because Gecko advances the transform on the
// compositor at full refresh rate while width/height lag behind on the main
// thread (Chrome instead demotes the whole effect to the main thread, which
// is choppy but coherent).
//
// The upgrade replaces the UA animation with a pixel-equivalent, fully
// compositable one:
//
//   1. Kill the CSS animations on the group (root attribute + injected
//      stylesheet), freezing the group box at its FINAL geometry.
//   2. Animate the group's `transform` only: translate(x,y) scale(sx,sy)
//      with `transform-origin: 0 0`. The crop window is `clip-path: inset(0)`
//      (optionally `round` the morph radii): a graphical clip guaranteed to
//      ride the transform on the same layer, unlike `overflow: hidden`,
//      which is a layout clip applied in a separate paint step that engines
//      may resolve in a different coordinate space than a compositor-driven
//      transform. A scaled rectangle is still a rectangle, so inset(0)
//      matches the UA's animated box exactly.
//   3. Size the old/new snapshots to their intrinsic (captured) size in
//      explicit px (not `width/height: auto`, which over-constrains inset
//      and overflows the frozen box) and counter-transform them each frame
//      so the content keeps its true aspect ratio — reproducing
//      `object-fit: cover` against the animated box with zero distortion.
//      Keyframes are sampled numerically (the counter track needs 1/s(t),
//      which no easing function expresses).
//   4. Re-express the border-radius animation as size-relative roundness
//      (r / min(w, h)), then per-axis compensated elliptical radii so
//      corners render round under the non-uniform group scale. Absolute-px
//      lerp would freeze a 28px stage radius into a 28px circle destination
//      as a rounded rect the whole way. This track still animates a paint
//      property; under jank the corners may lag, but geometry no longer
//      depends on the main thread.
//
// Crossfade morphs (Trigger `crossfade`) get steps 1, 2 and 4 only. Their
// snapshot contract is `width/height: 100%` + `object-fit: fill` against the
// group box (see vt-structural-styles.ts), and a snapshot filling the frozen
// box tracks the group's scale for free — the rendered stretch each frame is
// identical to the UA's animating box, so no counter-transforms are needed.
// The UA opacity dissolve on the snapshots (revived and re-timed by the
// structural sheet) is opacity-only, i.e. already compositor-friendly, and
// keeps running untouched.
//
// Endpoint transforms may include scale on top of translation (Gecko folds
// visual-viewport / ancestor scale into the group transform on Android, and
// triggers can carry press-state scales). Those are supported; rotation or
// skew is not (we bail to the stock morph). All tracks sample the same eased
// progress at the same offsets, so the group and the counter-transforms stay
// mutually consistent even where the numeric bezier differs from the
// browser's by rounding.
//
// Android Chrome (mobile Blink) needs one extra guard: the compositor hold.
// The upgrade swaps animations inside the `ready` microtask, but the pseudo
// tree's FIRST commit already ships the UA animations to the compositor —
// the swap only lands in the SECOND commit. Chrome runs the UA transform
// track and the opacity dissolves on the compositor while width/height and
// the group's `overflow: hidden` clip stay main-threaded, and close is
// exactly when the main thread stalls (overlay teardown, grid re-layout).
// For as long as the second commit is blocked, the composited tracks keep
// advancing against frame-0 main-thread state: the photo renders as a
// hard-cut slice of itself (stale clip), vanishes once content and clip
// stop overlapping, or — on crossfade morphs — the dissolve completes
// against frozen geometry, swapping the item for the trigger snapshot at
// full size. Measured frame-by-frame on a Pixel emulator: content at ~60%
// progress under a clip still at 0%, with the strip's edges matching the
// from-box to sub-pixel. getComputedStyle, WAAPI state and CDP screencast
// all report main-thread values, so the artifact is invisible to every
// in-page probe.
//
// The guard: `maybeUpgradeToCompositedMorph` sets VT_COMPOSITOR_HOLD_ATTR
// before that first commit, and the structural sheet pauses every
// view-transition animation under it. A paused animation never ticks on the
// compositor, so held frames show the exact from-state (visually the
// fully-open lightbox). The hold is released in the same commit that
// installs the replacement animations — everything starts together, and
// from then on every animated track (transform, radius clip, dissolves) is
// compositor-driven, so later main-thread stalls cannot tear the morph.
// Bails release the hold too, resuming the stock morph from frame 0.
//
// The upgrade validates everything it needs BEFORE touching any state and
// bails (leaving the stock UA morph) on: missing `transition.ready`/
// `getAnimations` support, unparsable endpoint geometry, or rotated/skewed
// endpoint transforms.
//
// Timing comes from the Root's `viewTransition` preset (see vt-timing.ts) —
// identical in every browser and independent of the page's CSS.
// ---------------------------------------------------------------------------

interface UpgradeableTransition {
  ready?: Promise<void>;
  finished: Promise<void>;
}

/** Root attribute that activates the injected pseudo-element overrides. */
const COMPOSITED_ATTR = 'data-ramka-vt-composited';

/**
 * Root attribute for the WebKit CSS-animation path. Separate from
 * {@link COMPOSITED_ATTR} because the static injected sheet forces
 * `animation: none` under that attribute — the CSS path instead carries its
 * geometry overrides AND its generated animations in one per-transition
 * stylesheet.
 */
const COMPOSITED_CSS_ATTR = 'data-ramka-vt-composited-css';

/** Unique suffix for per-transition @keyframes names (forces fresh starts). */
let cssAnimationSeq = 0;

/**
 * Physical top-left anchor for the old/new snapshots, `top`/`left` only.
 *
 * The UA stylesheet pins the snapshots with `inset: 0`. That is harmless under
 * the structural `width/height: 100%` contract (the box fills the group either
 * way), but this module replaces it with the intrinsic captured size — and a
 * definite width against `left: 0` *and* `right: 0` is over-constrained, so
 * one inset has to be dropped. CSS resolves that by direction: `right` loses
 * under `ltr`, `left` loses under `rtl` (and it is the *containing block's*
 * direction that decides, i.e. the group's — Firefox reports `direction: ltr`
 * on the snapshot itself while still flipping it).
 *
 * Under `dir="rtl"` that anchored the snapshot to the group's right edge,
 * displacing it by `groupWidth - snapshotWidth` — while the counter transforms
 * below are all computed from the physical top-left, with `transform-origin:
 * 0 0`. The `new` snapshot escaped it (the group is frozen at final geometry,
 * which *is* the new element's box, so the widths match and there is nothing to
 * over-constrain), but `old` was displaced by the full trigger↔destination size
 * difference: a first-frame flicker on open, where `old` is only the paint
 * fallback under an opaque `new`, and a grossly misplaced photo on close, where
 * `old` is the visible layer.
 *
 * Dropping `right`/`bottom` to `auto` removes the over-constraint entirely, so
 * `top`/`left` win in both reading directions.
 */
const SNAPSHOT_ANCHOR = 'inset: 0 auto auto 0 !important;';

/** Explicit captured snapshot sizes — written for the duration of an upgrade. */
const SNAP_OLD_W = '--ramka-vt-snap-old-w';
const SNAP_OLD_H = '--ramka-vt-snap-old-h';
const SNAP_NEW_W = '--ramka-vt-snap-new-w';
const SNAP_NEW_H = '--ramka-vt-snap-new-h';

const GROUP_PSEUDO = `::view-transition-group(${VIEW_TRANSITION_NAME})`;
const OLD_PSEUDO = `::view-transition-old(${VIEW_TRANSITION_NAME})`;
const NEW_PSEUDO = `::view-transition-new(${VIEW_TRANSITION_NAME})`;

/** TEMP: Android Chrome "cut in half" morph investigation. Flip to false to silence. */
const VT_DEBUG = true;

function vtDebugEnabled(): boolean {
  if (!VT_DEBUG) return false;
  if (typeof window === 'undefined') return false;
  if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)) return false;
  // Tests may mock the UA to a real browser string; stay silent there too.
  if (typeof process !== 'undefined' && process.env?.VITEST) return false;
  return true;
}

function vtRound(n: number): number {
  return Number(n.toFixed(2));
}

function viewportDump(): Record<string, unknown> {
  const vv = window.visualViewport;
  const de = document.documentElement;
  return {
    inner: [window.innerWidth, window.innerHeight],
    client: [de.clientWidth, de.clientHeight],
    scroll: [vtRound(window.scrollX), vtRound(window.scrollY)],
    screen: [window.screen.width, window.screen.height],
    avail: [window.screen.availWidth, window.screen.availHeight],
    dpr: window.devicePixelRatio,
    vv: vv
      ? {
          size: [vtRound(vv.width), vtRound(vv.height)],
          offset: [vtRound(vv.offsetLeft), vtRound(vv.offsetTop)],
          page: [vtRound(vv.pageLeft), vtRound(vv.pageTop)],
          scale: vtRound(vv.scale),
        }
      : null,
    aligned: vv ? Math.abs(window.innerHeight - vv.height) <= 1 : null,
  };
}

function pseudoDump(pseudo: string): Record<string, unknown> {
  const s = getComputedStyle(document.documentElement, pseudo);
  return {
    size: [s.width, s.height],
    transform: s.transform,
    origin: s.transformOrigin,
    overflow: s.overflow,
    inset: [s.top, s.right, s.bottom, s.left],
    clip: s.clipPath,
    opacity: s.opacity,
    objectFit: s.objectFit,
    mixBlend: s.mixBlendMode,
    animation: s.animationName,
    animationDuration: s.animationDuration,
  };
}

function elDump(el: Element | null | undefined): Record<string, unknown> | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const s = getComputedStyle(el);
  return {
    tag: el.tagName,
    vtName: s.viewTransitionName,
    rect: [vtRound(r.x), vtRound(r.y), vtRound(r.width), vtRound(r.height)],
    size: [s.width, s.height],
    transform: s.transform,
    overflow: s.overflow,
    objectFit: s.objectFit,
  };
}

function vtDebug(event: string, data?: Record<string, unknown>): void {
  if (!vtDebugEnabled()) return;
  const payload = { t: vtRound(performance.now()), event, vp: viewportDump(), ...data };
  console.info(`[ramka-vt] ${JSON.stringify(payload)}`);
}

function vtPseudos(): Record<string, unknown> {
  return {
    group: pseudoDump(GROUP_PSEUDO),
    old: pseudoDump(OLD_PSEUDO),
    new: pseudoDump(NEW_PSEUDO),
    rootOld: pseudoDump('::view-transition-old(root)'),
    rootNew: pseudoDump('::view-transition-new(root)'),
    attrs: {
      vt: document.documentElement.getAttribute('data-ramka-view-transition'),
      composited: document.documentElement.hasAttribute('data-ramka-vt-composited'),
      compositedCss: document.documentElement.hasAttribute('data-ramka-vt-composited-css'),
      crossfade: document.documentElement.hasAttribute('data-ramka-crossfade'),
      hold: document.documentElement.hasAttribute(VT_COMPOSITOR_HOLD_ATTR),
    },
  };
}

function startVtFrameSampler(finished: Promise<unknown>): void {
  if (!vtDebugEnabled()) return;
  let n = 0;
  let stopped = false;
  finished.finally(() => {
    stopped = true;
  });
  const tick = () => {
    if (stopped) return;
    n += 1;
    vtDebug('frame', { n, ...vtPseudos() });
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function watchViewTransition(
  phase: 'open' | 'close',
  transition: { ready?: Promise<void>; finished: Promise<void> },
): void {
  if (!vtDebugEnabled()) return;
  const vv = window.visualViewport;
  const dump = (why: string) => vtDebug('viewport', { phase, why, ...vtPseudos() });
  dump('watch-start');
  const onResize = () => dump('vv-resize');
  const onScroll = () => dump('vv-scroll');
  vv?.addEventListener('resize', onResize);
  vv?.addEventListener('scroll', onScroll);
  transition.ready
    ?.then(() => vtDebug('ready', { phase, ...vtPseudos() }))
    .catch((err: unknown) => vtDebug('ready-reject', { phase, err: String(err) }));
  transition.finished
    .then(() => vtDebug('finished', { phase, ...vtPseudos() }))
    .catch((err: unknown) => vtDebug('finished-reject', { phase, err: String(err) }))
    .finally(() => {
      dump('watch-end');
      vv?.removeEventListener('resize', onResize);
      vv?.removeEventListener('scroll', onScroll);
    });
}

function isCompositedMorphEnabled(): boolean {
  return (
    typeof window !== 'undefined' &&
    (window as unknown as Record<string, unknown>).__RAMKA_VT_COMPOSITED__ !== false
  );
}

/**
 * Safari/WebKit detection (GestureEvent has only ever shipped in WebKit).
 *
 * WebKit gets the replacement animations as generated CSS instead of WAAPI,
 * and with its own timing: accelerated animations on a fresh view-transition
 * layer tree fast-forward by Core Animation's multi-frame commit latency
 * (iPhone screen recordings showed the first *displayed* frame ~100ms into
 * the curve), and no anchoring trick moves that — the WebKit branch in
 * `upgrade` documents everything that was tried. The chosen fix is a longer,
 * softer curve that hides the skip (see the preset table in vt-timing.ts).
 */
function isWebKit(): boolean {
  return typeof window !== 'undefined' && 'GestureEvent' in window;
}

type KeyframeCssProp = 'transform' | 'borderRadius' | 'clipPath';

const KEYFRAME_CSS_PROP: Record<KeyframeCssProp, string> = {
  transform: 'transform',
  borderRadius: 'border-radius',
  clipPath: 'clip-path',
};

/** Serialize sampled keyframes into a CSS @keyframes rule. */
function keyframesCss(name: string, frames: Keyframe[], props: KeyframeCssProp[]): string {
  const body = frames
    .map((f) => {
      const decls = props.map((p) => `${KEYFRAME_CSS_PROP[p]}: ${String(f[p])};`).join(' ');
      return `${((f.offset as number) * 100).toFixed(3)}% { ${decls} }`;
    })
    .join('\n');
  return `@keyframes ${name} {\n${body}\n}`;
}

/**
 * Pseudo-element overrides for the composited path. Added lazily (only
 * when the flag is on and an upgrade commits) and gated on the root
 * attribute so the stock morph is untouched otherwise.
 *
 * - Group: CSS animations off (kills the UA group anim + the border-radius
 *   keyframes), `transform-origin: 0 0` so our scale math composes with the
 *   UA translate. Crop is `clip-path: inset(0)` with `overflow: visible` —
 *   Blink view-transition groups apply `overflow: hidden` as a layout clip
 *   that does not travel with the frozen dest box (see module docblock).
 * - Old/new (hard-cut morphs only): intrinsic (captured) size in explicit
 *   px via CSS vars (not `width/height: auto`, which over-constrains inset
 *   and overflows the frozen box) instead of the stretched `100%` +
 *   `object-fit: cover` contract — the counter transform owns cover
 *   placement per frame, and pre-cropping to the final box would discard
 *   edge pixels the morph must reveal mid-flight. Crossfade morphs are
 *   excluded: their snapshots must keep the structural sheet's `100%` +
 *   `object-fit: fill` contract (which tracks the frozen box) and their UA
 *   opacity dissolve.
 *   Anchoring is pinned to the physical top-left (`inset: 0 auto auto 0`)
 *   because the counter transforms are computed from that corner — see
 *   {@link SNAPSHOT_ANCHOR}.
 */
function ensureStyleInjected() {
  ensureLibrarySheet(
    'data-ramka-vt-composited-style',
    () => `
:root[${COMPOSITED_ATTR}]${GROUP_PSEUDO} {
  animation: none !important;
  transform-origin: 0 0 !important;
  overflow: visible !important;
  clip-path: inset(0);
}
:root[${COMPOSITED_ATTR}]:not([${LightboxDocumentDataAttributes.crossfade}])${OLD_PSEUDO} {
  width: var(${SNAP_OLD_W}) !important;
  height: var(${SNAP_OLD_H}) !important;
  ${SNAPSHOT_ANCHOR}
  transform-origin: 0 0 !important;
  animation: none !important;
}
:root[${COMPOSITED_ATTR}]:not([${LightboxDocumentDataAttributes.crossfade}])${NEW_PSEUDO} {
  width: var(${SNAP_NEW_W}) !important;
  height: var(${SNAP_NEW_H}) !important;
  ${SNAPSHOT_ANCHOR}
  transform-origin: 0 0 !important;
  animation: none !important;
}
`,
  );
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

interface ScaleTranslate {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
}

const AXIS_EPS = 1e-3;

/**
 * Parse a computed/serialized transform into axis-aligned scale + translate.
 * Handles `matrix(...)` and 2D-compatible `matrix3d(...)` (Gecko serializes
 * group transforms as matrix3d). Returns `null` when the matrix rotates/skews
 * or scales non-positively — the compose math below assumes an axis-aligned
 * mapping.
 *
 * STRICT about `none`/empty: both callers read UA-authored group endpoints,
 * which always carry an explicit matrix (the group is positioned via
 * `transform`). A missing value therefore means the READ failed, not that the
 * endpoint is at the origin — Safari 18.x returns an empty string from
 * `getComputedStyle` on view-transition pseudos while animations run on
 * them, and mapping that to identity sent the morph into the viewport's
 * top-left corner (the destination degenerated to `translate(0, 0)`).
 */
function parseScaleTranslate(value: unknown): ScaleTranslate | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();

  let m = /^matrix\(([^)]+)\)$/.exec(v);
  if (m) {
    const p = m[1]!.split(',').map((n) => Number.parseFloat(n));
    if (p.length !== 6 || p.some((n) => !Number.isFinite(n))) return null;
    const [a, b, c, d, e, f] = p as [number, number, number, number, number, number];
    if (Math.abs(b) > AXIS_EPS || Math.abs(c) > AXIS_EPS || a <= 0 || d <= 0) return null;
    return { sx: a, sy: d, tx: e, ty: f };
  }

  m = /^matrix3d\(([^)]+)\)$/.exec(v);
  if (m) {
    const p = m[1]!.split(',').map((n) => Number.parseFloat(n));
    if (p.length !== 16 || p.some((n) => !Number.isFinite(n))) return null;
    // Row-major m11..m44; require a 2D axis-aligned affine matrix.
    const offAxis = [p[1], p[2], p[3], p[4], p[6], p[7], p[8], p[9], p[11], p[14]] as number[];
    if (offAxis.some((n) => Math.abs(n) > AXIS_EPS)) return null;
    if (Math.abs(p[10]! - 1) > AXIS_EPS || Math.abs(p[15]! - 1) > AXIS_EPS) return null;
    if (p[0]! <= 0 || p[5]! <= 0) return null;
    return { sx: p[0]!, sy: p[5]!, tx: p[12]!, ty: p[13]! };
  }

  return null;
}

/** Parse a `123.45px` keyframe/computed value into a positive number. */
function parsePx(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const fmt = (n: number) => Number(n.toFixed(4));

/** Graphical crop matching the frozen dest box; `round` when the morph has radius. */
function insetClip(radius: string | null): string {
  return radius ? `inset(0 round ${radius})` : 'inset(0)';
}

function writeSnapSizes(w0: number, h0: number, w1: number, h1: number): void {
  const s = document.documentElement.style;
  s.setProperty(SNAP_OLD_W, `${fmt(w0)}px`);
  s.setProperty(SNAP_OLD_H, `${fmt(h0)}px`);
  s.setProperty(SNAP_NEW_W, `${fmt(w1)}px`);
  s.setProperty(SNAP_NEW_H, `${fmt(h1)}px`);
}

function clearSnapSizes(): void {
  const s = document.documentElement.style;
  s.removeProperty(SNAP_OLD_W);
  s.removeProperty(SNAP_OLD_H);
  s.removeProperty(SNAP_NEW_W);
  s.removeProperty(SNAP_NEW_H);
}

// Easing math and timing presets live in vt-timing.ts (shared with the Root,
// which promotes the active preset's timing to documentElement).

// ---------------------------------------------------------------------------
// Upgrade
// ---------------------------------------------------------------------------

/**
 * If the composited-morph flag is on, upgrade the just-started morph to
 * transform-only compositor animations once its pseudo-element tree is live.
 * No-op (stock UA morph) when the flag is off or any precondition fails.
 */
function maybeUpgradeToCompositedMorph(transition: UpgradeableTransition): void {
  if (!isCompositedMorphEnabled()) return;
  if (!transition.ready) return;

  // Android Blink: pause every VT animation from before the pseudo tree's
  // first commit so nothing ticks on the compositor during the swap window
  // (see the Android section of the module docblock). Released by `upgrade`
  // in the commit that installs the replacements, by every bail, and — belt
  // and braces — when the transition ends.
  if (isAndroidBlinkSnapshotRoot()) {
    document.documentElement.setAttribute(VT_COMPOSITOR_HOLD_ATTR, '');
    transition.finished.finally(releaseCompositorHold);
  }

  transition.ready
    .then(() => upgrade(transition))
    .catch(() => {
      // ready rejects when the transition is skipped — nothing to upgrade.
      releaseCompositorHold();
    });
}

function releaseCompositorHold(): void {
  document.documentElement.removeAttribute(VT_COMPOSITOR_HOLD_ATTR);
}

function upgrade(transition: UpgradeableTransition): void {
  const docEl = document.documentElement;
  const bail = (reason: string, extra?: Record<string, unknown>) => {
    // Unpause whatever the compositor hold froze — the stock morph resumes
    // from frame 0 (a paused animation left behind would never finish and
    // hold the pseudo tree hostage).
    releaseCompositorHold();
    vtDebug('upgrade-bail', { reason, ...extra, ...vtPseudos() });
  };

  // Crossfade morphs replace the group animation only: snapshots keep their
  // `100%` + `object-fit: fill` contract (tracks the frozen box for free)
  // and their compositor-friendly UA opacity dissolve. See module docblock.
  const isCrossfade = docEl.hasAttribute(LightboxDocumentDataAttributes.crossfade);
  if (typeof document.getAnimations !== 'function') {
    bail('no-getAnimations');
    return;
  }

  const groupAnimations = document.getAnimations().filter((a) => {
    const effect = a.effect as KeyframeEffect | null;
    return effect?.pseudoElement === GROUP_PSEUDO;
  });
  const uaAnim = groupAnimations.find((a) =>
    ((a as CSSAnimation).animationName ?? '').startsWith('-ua-view-transition-group-anim'),
  );
  if (!uaAnim || !uaAnim.effect) {
    bail('no-ua-group-anim', {
      groupAnimCount: groupAnimations.length,
      names: groupAnimations.map((a) => (a as CSSAnimation).animationName ?? ''),
    });
    return;
  }

  // --- Validate everything BEFORE mutating any state -----------------------

  const effect = uaAnim.effect as KeyframeEffect;
  let uaKeyframes: Record<string, unknown>[] = [];
  try {
    uaKeyframes = effect.getKeyframes();
  } catch {
    uaKeyframes = [];
  }
  const fromFrame = uaKeyframes.find((kf) => (kf.computedOffset ?? kf.offset ?? 0) === 0);
  if (!fromFrame) {
    bail('no-from-frame', { kfCount: uaKeyframes.length });
    return;
  }

  const fromT = parseScaleTranslate(fromFrame.transform);
  const w0 = parsePx(fromFrame.width);
  const h0 = parsePx(fromFrame.height);
  if (!fromT || w0 == null || h0 == null) {
    bail('unparsable-from', { transform: fromFrame.transform, width: fromFrame.width, height: fromFrame.height });
    return;
  }

  const uaTiming = effect.getComputedTiming();
  const uaDuration = typeof uaTiming.duration === 'number' ? uaTiming.duration : NaN;
  if (!Number.isFinite(uaDuration) || uaDuration <= 0) {
    bail('bad-ua-duration', { uaDuration });
    return;
  }

  // The morph's own motion design — same duration and easing in every
  // browser, independent of the page's view-transition CSS.
  const { duration, ease } = morphTiming();

  // Capture how far the UA animation has ACTUALLY progressed before touching
  // it. The replacements resume from this elapsed time below, so the swap is
  // seamless against what the stock morph has painted so far. Deliberately
  // NOT aligned to `startTime`: on a throttled main thread (e.g. iPhone Low
  // Power Mode, 30Hz rAF) this code runs several frames after the animation's
  // nominal start, and back-dating to startTime would skip the first 30–70ms
  // of the curve — a visible "fast/aggressive" kick at morph start.
  const uaElapsedRaw = uaAnim.currentTime;
  const uaElapsed =
    typeof uaElapsedRaw === 'number' && Number.isFinite(uaElapsedRaw)
      ? Math.max(0, Math.min(uaElapsedRaw, uaDuration))
      : 0;

  // End geometry, in order of preference:
  //
  // 1. The UA keyframes' `to` frame. WebKit ships it with correct values,
  //    and on Safari 18.x it is the ONLY reliable source: getComputedStyle
  //    on a view-transition pseudo returns an empty transform while
  //    animations run on it (the group carries our co-declared border-radius
  //    animation throughout), which the old identity-mapping parse turned
  //    into a `translate(0, 0)` destination — the morph flew to the
  //    viewport's top-left corner and snapped into place at finish.
  // 2. Fallback: the group's base style (UA sets it to the new element's
  //    box), read by jumping the paused UA animation to its end — fill mode
  //    is `both`, so computed style then reports the underlying base values.
  //    Current Chromium/Gecko/WebKit all ship usable `to` frames, so this
  //    only runs where the `to` frame is absent or carries `transform: none`
  //    (older Blink did, see
  //    https://github.com/WICG/view-transitions/issues/235).
  //
  // Everything here happens inside the `ready` microtask, before the first
  // frame is presented, so no intermediate state can paint.
  const toFrame = uaKeyframes.find((kf) => (kf.computedOffset ?? kf.offset) === 1);
  let toT = toFrame ? parseScaleTranslate(toFrame.transform) : null;
  let w1 = toFrame ? parsePx(toFrame.width) : null;
  let h1 = toFrame ? parsePx(toFrame.height) : null;
  if (!toT || w1 == null || h1 == null) {
    uaAnim.pause();
    uaAnim.currentTime = uaDuration;
    const endStyle = getComputedStyle(docEl, GROUP_PSEUDO);
    toT = parseScaleTranslate(endStyle.transform);
    w1 = parsePx(endStyle.width);
    h1 = parsePx(endStyle.height);
    if (!toT || w1 == null || h1 == null) {
      // Restore the stock animation and bail.
      uaAnim.currentTime = 0;
      uaAnim.play();
      bail('unparsable-to', {
        toTransform: toFrame?.transform,
        toWidth: toFrame?.width,
        toHeight: toFrame?.height,
      });
      return;
    }
  }
  // Origin fractions for reconstructing rendered rects from scaled endpoint
  // matrices (the UA animation runs under the group's own transform-origin;
  // our replacement forces 0 0, so the intended rect must be computed here).
  // Normalized against the SAME snapshot's own box: transform-origin
  // percentages resolve against whatever box the group currently has (from
  // state on the keyframe path, end state on the jump path), so dividing by
  // a fixed endpoint box would skew the fraction. May come back empty on
  // Safari 18.x; the 0.5 fallbacks cover it (origin only matters for scaled
  // endpoints, where sx/sy differ from 1).
  const originStyle = getComputedStyle(docEl, GROUP_PSEUDO);
  const originParts = originStyle.transformOrigin.split(' ').map((p) => Number.parseFloat(p));
  const originBoxW = Number.parseFloat(originStyle.width);
  const originBoxH = Number.parseFloat(originStyle.height);
  const fx =
    Number.isFinite(originParts[0]) && Number.isFinite(originBoxW) && originBoxW > 0
      ? originParts[0]! / originBoxW
      : 0.5;
  const fy =
    Number.isFinite(originParts[1]) && Number.isFinite(originBoxH) && originBoxH > 0
      ? originParts[1]! / originBoxH
      : 0.5;

  // Neutralize the UA group animation explicitly. Style-based cancellation
  // (`animation: none` from the injected sheet) is not reliable cross-engine:
  // Gecko keeps an API-paused CSS animation alive despite it, and a forever-
  // paused animation holds the transition's `finished` promise hostage — the
  // pseudo tree never tears down. Cancelling drops the animation entirely;
  // the group's base style IS the end geometry (the UA sets it to the new
  // element's box), so the frozen box the replacement tracks assume stays put.
  uaAnim.cancel();

  // --- Commit: kill CSS animations, add compositor-friendly replacements ---

  // WebKit gets CSS animations instead of WAAPI (see COMPOSITED_CSS_ATTR);
  // its geometry overrides ship inside the per-transition stylesheet.
  const useCssAnimations = isWebKit();
  if (!useCssAnimations) {
    ensureStyleInjected();
    if (!isCrossfade) writeSnapSizes(w0, h0, w1, h1);
    docEl.setAttribute(COMPOSITED_ATTR, '');
  }

  const rootStyle = getComputedStyle(docEl);
  const rFrom = parseMorphRadiusList(
    rootStyle.getPropertyValue(LightboxDocumentCssVars.morphBorderRadiusFrom),
  );
  const rTo = parseMorphRadiusList(
    rootStyle.getPropertyValue(LightboxDocumentCssVars.morphBorderRadiusTo),
  );
  const hasRadius = [...rFrom, ...rTo].some((r) => r > 0);

  const steps = Math.min(120, Math.max(24, Math.round(duration / 8)));
  const groupFrames: Keyframe[] = [];
  const radiusFrames: Keyframe[] = [];
  const oldFrames: Keyframe[] = [];
  const newFrames: Keyframe[] = [];

  const lerp = (a: number, b: number, q: number) => a + (b - a) * q;

  /**
   * Track values at eased progress q: box (w, h) under an axis-aligned matrix
   * (sxm, sym, tx, ty) applied at origin (fx·w, fy·h) — the UA-interpolated
   * state — re-expressed against the frozen (w1, h1) group box.
   */
  const sampleAt = (q: number) => {
    const w = lerp(w0, w1, q);
    const h = lerp(h0, h1, q);
    const sxm = lerp(fromT.sx, toT.sx, q);
    const sym = lerp(fromT.sy, toT.sy, q);
    const tx = lerp(fromT.tx, toT.tx, q);
    const ty = lerp(fromT.ty, toT.ty, q);

    // Rendered rect of that state (what the user actually sees).
    const renderedW = w * sxm;
    const renderedH = h * sym;
    const left = tx + fx * w * (1 - sxm);
    const top = ty + fy * h * (1 - sym);

    // Roundness in UA-box space, then elliptical rx/ry on the frozen
    // destination box so non-uniform scale still renders circular arcs.
    let radius: string | null = null;
    if (hasRadius) {
      radius = compensatedMorphRadiusAt(rFrom, rTo, q, { w0, h0, w, h, w1, h1 });
    }

    // Counter-transform per snapshot: `object-fit: cover` fits the intrinsic
    // (wi, hi) capture into the UA box (w, h); expressed in our group-local
    // coordinates that is a factor w1/w (X) and h1/h (Y).
    const counter = (wi: number, hi: number) => {
      const k = Math.max(w / wi, h / hi);
      const dx = (((w - k * wi) / 2) * w1) / w;
      const dy = (((h - k * hi) / 2) * h1) / h;
      return `translate(${fmt(dx)}px, ${fmt(dy)}px) scale(${fmt((k * w1) / w)}, ${fmt((k * h1) / h)})`;
    };

    return {
      group: `translate(${fmt(left)}px, ${fmt(top)}px) scale(${fmt(renderedW / w1)}, ${fmt(renderedH / h1)})`,
      radius,
      old: counter(w0, h0),
      new: counter(w1, h1),
    };
  };

  for (let i = 0; i <= steps; i++) {
    const offset = i / steps;
    const s = sampleAt(ease(offset));
    groupFrames.push({ offset, transform: s.group });
    if (hasRadius) {
      radiusFrames.push({
        offset,
        borderRadius: s.radius!,
        clipPath: insetClip(s.radius),
      });
    }
    // Crossfade snapshots fill the frozen box (structural `100%` + `fill`)
    // and stretch with the group's scale — no counter-transforms.
    if (!isCrossfade) {
      oldFrames.push({ offset, transform: s.old });
      newFrames.push({ offset, transform: s.new });
    }
  }

  const first = groupFrames[0];
  const mid = groupFrames[Math.floor(groupFrames.length / 2)];
  const last = groupFrames[groupFrames.length - 1];
  vtDebug('upgrade', {
    isCrossfade,
    useCss: isWebKit(),
    duration,
    uaDuration,
    uaElapsed,
    from: { ...fromT, w: w0, h: h0 },
    to: { ...toT, w: w1, h: h1 },
    origin: { fx, fy, box: [originBoxW, originBoxH], raw: originStyle.transformOrigin },
    fromAspect: w0 / h0,
    toAspect: w1 / h1,
    scaleTo: { sx: w0 / w1, sy: h0 / h1 },
    groupFrames: { first: first?.transform, mid: mid?.transform, last: last?.transform, steps },
    old0: oldFrames[0]?.transform,
    new0: newFrames[0]?.transform,
    ...vtPseudos(),
  });

  const options = (pseudoElement: string): KeyframeAnimationOptions => ({
    duration,
    easing: 'linear',
    fill: 'both',
    pseudoElement,
  });

  let created: Animation[] = [];
  let styleEl: LibrarySheet | null = null;

  if (useCssAnimations) {
    // WebKit path: deliver the replacement as real CSS animations (WAAPI on
    // pseudos ignores every anchoring trick) and keep them transform-only so
    // they run fully accelerated — 60fps even in Low Power Mode, where the
    // main thread ticks at 30Hz.
    //
    // Accelerated animations on a fresh view-transition layer tree START LATE
    // by Core Animation's multi-frame first commit and fast-forward past it;
    // nothing moves that anchor (tried: startTime leads, pause/replay,
    // recreation on a warm tree, main-thread sync-forcing via width/height
    // co-animation, and a sync-launch/async-cruise split — each either kept
    // the skip or gave up compositor smoothness). The morph's soft slow-start
    // timing (see the preset table in vt-timing.ts) accommodates the skip:
    // near-zero travel sits in the swallowed leading edge. The replacement
    // animations keep the transition (and its pseudo tree) alive until they
    // finish.
    const id = ++cssAnimationSeq;
    const gName = `ramka-vtg-${id}`;
    const rName = `ramka-vtr-${id}`;
    const oName = `ramka-vto-${id}`;
    const nName = `ramka-vtn-${id}`;
    const track = (name: string) => `${name} ${duration}ms linear ${-uaElapsed}ms both`;
    const groupTracks = hasRadius ? `${track(gName)}, ${track(rName)}` : track(gName);

    // Crossfade: group rules only — the snapshots keep their structural
    // sizing and UA dissolve (see the sampling loop above).
    const snapshotCss = isCrossfade
      ? ''
      : `
${keyframesCss(oName, oldFrames, ['transform'])}
${keyframesCss(nName, newFrames, ['transform'])}
:root[${COMPOSITED_CSS_ATTR}]${OLD_PSEUDO} {
  width: ${fmt(w0)}px;
  height: ${fmt(h0)}px;
  ${SNAPSHOT_ANCHOR}
  transform-origin: 0 0 !important;
  animation: ${track(oName)} !important;
}
:root[${COMPOSITED_CSS_ATTR}]${NEW_PSEUDO} {
  width: ${fmt(w1)}px;
  height: ${fmt(h1)}px;
  ${SNAPSHOT_ANCHOR}
  transform-origin: 0 0 !important;
  animation: ${track(nName)} !important;
}
`;

    styleEl = insertLibrarySheet(
      `
${keyframesCss(gName, groupFrames, ['transform'])}
${hasRadius ? keyframesCss(rName, radiusFrames, ['borderRadius', 'clipPath']) : ''}
:root[${COMPOSITED_CSS_ATTR}]${GROUP_PSEUDO} {
  transform-origin: 0 0 !important;
  overflow: visible !important;
  clip-path: inset(0);
  animation: ${groupTracks} !important;
}
${snapshotCss}`,
      'data-ramka-vt-composited-css',
    );
    docEl.setAttribute(COMPOSITED_CSS_ATTR, '');
  } else {
    try {
      created.push(docEl.animate(groupFrames, options(GROUP_PSEUDO)));
      if (hasRadius) {
        // Separate animation: mixing a paint property into the transform
        // effect would demote the whole effect off the compositor (Blink rule).
        // `clip-path` rides this same paint track (both are graphical, not
        // layout) so rounded crops stay on the compositor too.
        created.push(docEl.animate(radiusFrames, options(GROUP_PSEUDO)));
      }
      if (!isCrossfade) {
        created.push(docEl.animate(oldFrames, options(OLD_PSEUDO)));
        created.push(docEl.animate(newFrames, options(NEW_PSEUDO)));
      }
    } catch {
      // Pseudo missing or engine refuses pseudo-element WAAPI — roll back to
      // the stock morph.
      for (const a of created) a.cancel();
      docEl.removeAttribute(COMPOSITED_ATTR);
      clearSnapSizes();
      uaAnim.currentTime = 0;
      uaAnim.play();
      bail('waapi-throw');
      return;
    }

    // Seamless handover: resume from the UA animation's painted progress (~0
    // on healthy devices). See the `uaElapsed` capture above for why this is
    // progress-based rather than startTime-based.
    if (uaElapsed > 0) {
      for (const a of created) {
        a.currentTime = uaElapsed;
      }
    }
  }

  // Same task as the animation creation above, so the unpause (crossfade
  // dissolves, root fades) and the replacements all start in one commit.
  releaseCompositorHold();

  startVtFrameSampler(transition.finished);

  transition.finished.finally(() => {
    for (const a of created) a.cancel();
    docEl.removeAttribute(COMPOSITED_ATTR);
    docEl.removeAttribute(COMPOSITED_CSS_ATTR);
    clearSnapSizes();
    styleEl?.release();
  });
}

export {
  maybeUpgradeToCompositedMorph,
  isCompositedMorphEnabled,
  parseScaleTranslate,
  elDump,
  vtDebug,
  watchViewTransition,
};
