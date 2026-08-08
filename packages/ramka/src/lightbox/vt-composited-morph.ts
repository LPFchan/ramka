import { VIEW_TRANSITION_NAME } from './lightbox-context';
import { LightboxDocumentCssVars } from './lightbox-css-vars';
import { morphTiming } from './vt-timing';

// ---------------------------------------------------------------------------
// Composited (transform-only) morph upgrade — EXPERIMENTAL, on by default.
//
// Opt out with `window.__RAMKA_VT_COMPOSITED__ = false` (docs: `?vtstock`).
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
//      with `transform-origin: 0 0`. The group's `overflow: hidden` clip
//      scales with it, so the rendered crop window matches the UA's
//      animated box exactly (a scaled rectangle is still a rectangle).
//   3. Size the old/new snapshots to their intrinsic (captured) size and
//      counter-transform them each frame so the content keeps its true
//      aspect ratio — reproducing `object-fit: cover` against the animated
//      box with zero distortion. Keyframes are sampled numerically (the
//      counter track needs 1/s(t), which no easing function expresses).
//   4. Re-express the border-radius animation with per-axis compensated
//      elliptical radii so corners render round under the non-uniform group
//      scale. This track still animates a paint property; under jank the
//      corners may lag, but geometry no longer depends on the main thread.
//
// Endpoint transforms may include scale on top of translation (Gecko folds
// visual-viewport / ancestor scale into the group transform on Android, and
// triggers can carry press-state scales). Those are supported; rotation or
// skew is not (we bail to the stock morph). All tracks sample the same eased
// progress at the same offsets, so the group and the counter-transforms stay
// mutually consistent even where the numeric bezier differs from the
// browser's by rounding.
//
// The upgrade validates everything it needs BEFORE touching any state and
// bails (leaving the stock UA morph) on: crossfade mode, missing
// `transition.ready`/`getAnimations` support, or rotated/skewed endpoint
// transforms.
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

const GROUP_PSEUDO = `::view-transition-group(${VIEW_TRANSITION_NAME})`;
const OLD_PSEUDO = `::view-transition-old(${VIEW_TRANSITION_NAME})`;
const NEW_PSEUDO = `::view-transition-new(${VIEW_TRANSITION_NAME})`;

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

/** Serialize sampled keyframes into a CSS @keyframes rule. */
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

/**
 * Dev/debug visibility: when VT debug tracing is on, log upgrade decisions to
 * the console AND to the trace sink endpoint, so bail reasons are visible
 * from remote devices (phones) without a console attached.
 */
function debugLog(...args: unknown[]) {
  if (typeof window === 'undefined') return;
  const flag = (window as unknown as Record<string, unknown>).__RAMKA_VT_DEBUG__;
  if (!flag) return;
  // eslint-disable-next-line no-console -- opt-in debug tracing
  console.log('[ramka-vt-composited]', ...args);
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
      body: JSON.stringify({ compositedLog: safe, t: Date.now() }),
    });
  } catch {
    // Best-effort delivery.
  }
}

let styleInjected = false;

/**
 * Pseudo-element overrides for the composited path. Injected lazily (only
 * when the flag is on and an upgrade commits) and gated on the root
 * attribute so the stock morph is untouched otherwise.
 *
 * - Group: CSS animations off (kills the UA group anim + the border-radius
 *   keyframes), `transform-origin: 0 0` so our scale math composes with the
 *   UA translate.
 * - Old/new: intrinsic (captured) size instead of the stretched
 *   `width/height: 100%` + `object-fit: cover` contract — the counter
 *   transform owns cover placement per frame, and pre-cropping to the final
 *   box would discard edge pixels the morph must reveal mid-flight.
 */
function ensureStyleInjected() {
  if (styleInjected || typeof document === 'undefined') return;
  styleInjected = true;
  const style = document.createElement('style');
  style.setAttribute('data-ramka-vt-composited-style', '');
  style.textContent = `
:root[${COMPOSITED_ATTR}]${GROUP_PSEUDO} {
  animation: none !important;
  transform-origin: 0 0 !important;
}
:root[${COMPOSITED_ATTR}]${OLD_PSEUDO},
:root[${COMPOSITED_ATTR}]${NEW_PSEUDO} {
  width: auto !important;
  height: auto !important;
  transform-origin: 0 0 !important;
  animation: none !important;
}
`;
  document.head.appendChild(style);
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
 * Handles `none`, `matrix(...)`, and 2D-compatible `matrix3d(...)` (Gecko
 * serializes group transforms as matrix3d). Returns `null` when the matrix
 * rotates/skews or scales non-positively — the compose math below assumes an
 * axis-aligned mapping.
 */
function parseScaleTranslate(value: unknown): ScaleTranslate | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (v === 'none' || v === '') return { sx: 1, sy: 1, tx: 0, ty: 0 };

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

// Easing math and timing presets live in vt-timing.ts (shared with the Root,
// which promotes the active preset's timing to documentElement).

/**
 * Parse a morph radius var (`12px`, `16px 16px 160px 160px`, or empty) into
 * four per-corner px values [tl, tr, br, bl]. The vars are written by
 * `resolveMorphBorderRadius`, which already serializes plain px lists.
 */
function parseRadiusList(value: string): [number, number, number, number] {
  const tokens = value
    .trim()
    .split(/\s+/)
    .map((t) => Number.parseFloat(t))
    .filter((n) => Number.isFinite(n) && n >= 0);
  const [a = 0, b = a, c = a, d = b] = tokens;
  return [a, b, c, d];
}

const fmt = (n: number) => Number(n.toFixed(4));

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
  if (!transition.ready) {
    debugLog('bail: transition.ready unavailable');
    return;
  }

  transition.ready
    .then(() => upgrade(transition))
    .catch(() => {
      // ready rejects when the transition is skipped — nothing to upgrade.
    });
}

function upgrade(transition: UpgradeableTransition): void {
  const docEl = document.documentElement;

  // The crossfade path relies on the UA dissolve + `object-fit: fill`
  // against the animating box; not supported by this prototype.
  if (docEl.hasAttribute('data-ramka-crossfade')) {
    debugLog('bail: crossfade morph');
    return;
  }
  if (typeof document.getAnimations !== 'function') {
    debugLog('bail: getAnimations unsupported');
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
    debugLog('bail: UA group animation not found');
    return;
  }

  // --- Validate everything BEFORE mutating any state -----------------------

  const effect = uaAnim.effect as KeyframeEffect;
  let fromFrame: Record<string, unknown> | undefined;
  try {
    fromFrame = effect.getKeyframes().find((kf) => (kf.computedOffset ?? kf.offset ?? 0) === 0);
  } catch {
    fromFrame = undefined;
  }
  if (!fromFrame) {
    debugLog('bail: no from keyframe');
    return;
  }

  const fromT = parseScaleTranslate(fromFrame.transform);
  const w0 = parsePx(fromFrame.width);
  const h0 = parsePx(fromFrame.height);
  if (!fromT || w0 == null || h0 == null) {
    debugLog('bail: unparsable from geometry', {
      transform: fromFrame.transform,
      width: fromFrame.width,
      height: fromFrame.height,
    });
    return;
  }

  const uaTiming = effect.getComputedTiming();
  const uaDuration = typeof uaTiming.duration === 'number' ? uaTiming.duration : NaN;
  if (!Number.isFinite(uaDuration) || uaDuration <= 0) {
    debugLog('bail: no finite duration', String(uaTiming.duration));
    return;
  }

  // The morph's own motion design — same duration and easing in every
  // browser, independent of the page's view-transition CSS.
  const { duration, ease, label: timingLabel } = morphTiming();

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

  // End geometry = the group's base style (UA sets it to the new element's
  // box). Read it by jumping the paused UA animation to its end — fill mode
  // is `both`, so computed style then reports the underlying base values.
  // Everything here happens inside the `ready` microtask, before the first
  // frame is presented, so no intermediate state can paint.
  uaAnim.pause();
  uaAnim.currentTime = uaDuration;
  const endStyle = getComputedStyle(docEl, GROUP_PSEUDO);
  const toT = parseScaleTranslate(endStyle.transform);
  const w1 = parsePx(endStyle.width);
  const h1 = parsePx(endStyle.height);
  // Origin fractions for reconstructing rendered rects from scaled endpoint
  // matrices (the UA animation runs under the group's own transform-origin;
  // our replacement forces 0 0, so the intended rect must be computed here).
  const originParts = endStyle.transformOrigin.split(' ').map((p) => Number.parseFloat(p));
  if (!toT || w1 == null || h1 == null) {
    // Restore the stock animation and bail.
    uaAnim.currentTime = 0;
    uaAnim.play();
    debugLog('bail: unparsable end geometry', {
      transform: endStyle.transform,
      width: endStyle.width,
      height: endStyle.height,
    });
    return;
  }
  const fx = Number.isFinite(originParts[0]) ? originParts[0]! / w1 : 0.5;
  const fy = Number.isFinite(originParts[1]) ? originParts[1]! / h1 : 0.5;

  // Neutralize the UA group animation explicitly. Style-based cancellation
  // (`animation: none` from the injected sheet) is not reliable cross-engine:
  // Gecko keeps an API-paused CSS animation alive despite it, and a forever-
  // paused animation holds the transition's `finished` promise hostage — the
  // pseudo tree never tears down. Cancelling drops the animation entirely;
  // the group's base style IS the end geometry (that's where endStyle was
  // read from), so the frozen box the replacement tracks assume stays put.
  uaAnim.cancel();

  // --- Commit: kill CSS animations, add compositor-friendly replacements ---

  // WebKit gets CSS animations instead of WAAPI (see COMPOSITED_CSS_ATTR);
  // its geometry overrides ship inside the per-transition stylesheet.
  const useCssAnimations = isWebKit();
  if (!useCssAnimations) {
    ensureStyleInjected();
    docEl.setAttribute(COMPOSITED_ATTR, '');
  }

  const rootStyle = getComputedStyle(docEl);
  const rFrom = parseRadiusList(
    rootStyle.getPropertyValue(LightboxDocumentCssVars.morphBorderRadiusFrom),
  );
  const rTo = parseRadiusList(
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

    // Radius r(q) lives in the UA box's coordinate space; our frozen box is
    // (w1, h1) scaled by (renderedW/w1, renderedH/h1), so the local radius
    // that renders identically is r·w1/w (H) and r·h1/h (V).
    let radius: string | null = null;
    if (hasRadius) {
      const rH = rFrom.map((r, c) => fmt((lerp(r, rTo[c]!, q) * w1) / w));
      const rV = rFrom.map((r, c) => fmt((lerp(r, rTo[c]!, q) * h1) / h));
      radius = `${rH.map((r) => `${r}px`).join(' ')} / ${rV.map((r) => `${r}px`).join(' ')}`;
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
    if (hasRadius) radiusFrames.push({ offset, borderRadius: s.radius! });
    oldFrames.push({ offset, transform: s.old });
    newFrames.push({ offset, transform: s.new });
  }

  const options = (pseudoElement: string): KeyframeAnimationOptions => ({
    duration,
    easing: 'linear',
    fill: 'both',
    pseudoElement,
  });

  let created: Animation[] = [];
  let styleEl: HTMLStyleElement | null = null;
  let handover = 'natural';

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

    styleEl = document.createElement('style');
    styleEl.setAttribute('data-ramka-vt-composited-css', '');
    styleEl.textContent = `
${keyframesCss(gName, groupFrames, 'transform')}
${hasRadius ? keyframesCss(rName, radiusFrames, 'borderRadius') : ''}
${keyframesCss(oName, oldFrames, 'transform')}
${keyframesCss(nName, newFrames, 'transform')}
:root[${COMPOSITED_CSS_ATTR}]${GROUP_PSEUDO} {
  transform-origin: 0 0 !important;
  animation: ${groupTracks} !important;
}
:root[${COMPOSITED_CSS_ATTR}]${OLD_PSEUDO} {
  width: ${fmt(w0)}px;
  height: ${fmt(h0)}px;
  transform-origin: 0 0 !important;
  animation: ${track(oName)} !important;
}
:root[${COMPOSITED_CSS_ATTR}]${NEW_PSEUDO} {
  width: ${fmt(w1)}px;
  height: ${fmt(h1)}px;
  transform-origin: 0 0 !important;
  animation: ${track(nName)} !important;
}
`;
    document.head.appendChild(styleEl);
    docEl.setAttribute(COMPOSITED_CSS_ATTR, '');
    handover = 'webkit-css';
  } else {
    try {
      created.push(docEl.animate(groupFrames, options(GROUP_PSEUDO)));
      if (hasRadius) {
        // Separate animation: mixing a paint property into the transform
        // effect would demote the whole effect off the compositor (Blink rule).
        created.push(docEl.animate(radiusFrames, options(GROUP_PSEUDO)));
      }
      created.push(docEl.animate(oldFrames, options(OLD_PSEUDO)));
      created.push(docEl.animate(newFrames, options(NEW_PSEUDO)));
    } catch (error) {
      // Pseudo missing or engine refuses pseudo-element WAAPI — roll back to
      // the stock morph.
      for (const a of created) a.cancel();
      docEl.removeAttribute(COMPOSITED_ATTR);
      uaAnim.currentTime = 0;
      uaAnim.play();
      debugLog('bail: animate() failed, rolled back', String(error));
      return;
    }

    // Seamless handover: resume from the UA animation's painted progress (~0
    // on healthy devices). See the `uaElapsed` capture above for why this is
    // progress-based rather than startTime-based.
    if (uaElapsed > 0) {
      handover = `resume(${uaElapsed})`;
      for (const a of created) {
        a.currentTime = uaElapsed;
      }
    }
  }

  debugLog('upgraded to composited morph', {
    from: { ...fromT, w: w0, h: h0 },
    to: { ...toT, w: w1, h: h1 },
    origin: { fx: fmt(fx), fy: fmt(fy) },
    timing: timingLabel,
    uaDuration,
    steps,
    hasRadius,
    handover,
  });

  transition.finished.finally(() => {
    for (const a of created) a.cancel();
    docEl.removeAttribute(COMPOSITED_ATTR);
    docEl.removeAttribute(COMPOSITED_CSS_ATTR);
    styleEl?.remove();
  });
}

export { maybeUpgradeToCompositedMorph, isCompositedMorphEnabled };
