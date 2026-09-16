import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LightboxDocumentCssVars } from './lightbox-css-vars';
import { LightboxDocumentDataAttributes } from './lightbox-data-attributes';
import { stubConstructedSheets } from './lightbox-style-sheets-test-utils';

/**
 * The composited morph is the morph ramka ships, and every browser that cannot
 * run it has to land on the stock UA morph instead — so the validation ladder
 * and the two rollbacks are the code keeping Safari and Firefox users from a
 * broken transition. jsdom has no View Transition API, no `getAnimations` and
 * no pseudo-element WAAPI, so the whole surface is faked here: the point is to
 * pin the DECISIONS (upgrade, bail, roll back) rather than the pixels.
 */

const GROUP_PSEUDO = '::view-transition-group(lightbox-morph)';
const OLD_PSEUDO = '::view-transition-old(lightbox-morph)';
const NEW_PSEUDO = '::view-transition-new(lightbox-morph)';
const COMPOSITED_ATTR = 'data-ramka-vt-composited';
const COMPOSITED_CSS_ATTR = 'data-ramka-vt-composited-css';

/** Endpoints of a plausible thumbnail→full morph, in UA keyframe shape. */
const FROM = { computedOffset: 0, transform: 'matrix(1, 0, 0, 1, 100, 200)', width: '200px', height: '150px' };
const TO = { computedOffset: 1, transform: 'matrix(1, 0, 0, 1, 0, 0)', width: '800px', height: '600px' };

type Keyframes = Record<string, unknown>[];

/** The globals the upgrade sniffs for, cast the way the module itself does. */
const globals = () => window as unknown as Record<string, unknown>;

interface FakeAnimation {
  animationName: string;
  effect: {
    pseudoElement: string;
    getKeyframes: () => Keyframes;
    getComputedTiming: () => { duration: number | string };
  } | null;
  currentTime: number | null;
  cancel: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  play: ReturnType<typeof vi.fn>;
}

function uaGroupAnimation(
  overrides: {
    keyframes?: Keyframes;
    duration?: number | string;
    currentTime?: number;
    pseudoElement?: string;
    animationName?: string;
    noEffect?: boolean;
    throwOnKeyframes?: boolean;
  } = {},
): FakeAnimation {
  const {
    keyframes = [FROM, TO],
    duration = 360,
    currentTime = 0,
    pseudoElement = GROUP_PSEUDO,
    animationName = '-ua-view-transition-group-anim-lightbox-morph',
    noEffect = false,
    throwOnKeyframes = false,
  } = overrides;

  return {
    animationName,
    effect: noEffect
      ? null
      : {
          pseudoElement,
          getKeyframes: throwOnKeyframes
            ? () => {
                throw new Error('engine refuses getKeyframes');
              }
            : () => keyframes,
          getComputedTiming: () => ({ duration }),
        },
    currentTime,
    cancel: vi.fn(),
    pause: vi.fn(),
    play: vi.fn(),
  };
}

/** A view transition far enough along to be upgradeable. */
function fakeTransition() {
  let resolveFinished: () => void = () => {};
  const finished = new Promise<void>((resolve) => {
    resolveFinished = resolve;
  });
  return {
    transition: { ready: Promise.resolve(), finished },
    /** Ends the transition so the teardown handler runs. */
    finish: async () => {
      resolveFinished();
      await finished;
      await Promise.resolve();
    },
  };
}

/** Computed-style values the upgrade reads off the group pseudo. */
let pseudoStyle: Record<string, string>;
/** Border-radius custom properties on the root. */
let rootVars: Record<string, string>;
let animateSpy: ReturnType<typeof vi.fn>;
/** Every animation `docEl.animate` handed back, so teardown can be checked. */
let createdAnimations: { cancel: ReturnType<typeof vi.fn>; currentTime: number | null }[];

/** Hands back an animation and records it, so teardown can be asserted. */
function trackCreated() {
  const animation = { cancel: vi.fn(), currentTime: null as number | null };
  createdAnimations.push(animation);
  return animation;
}

function installHarness() {
  pseudoStyle = {
    transform: 'matrix(1, 0, 0, 1, 0, 0)',
    width: '800px',
    height: '600px',
    transformOrigin: '400px 300px',
  };
  rootVars = {};
  createdAnimations = [];

  animateSpy = vi.fn(trackCreated);
  Object.defineProperty(document.documentElement, 'animate', {
    configurable: true,
    writable: true,
    value: animateSpy,
  });

  vi.spyOn(window, 'getComputedStyle').mockImplementation(
    (_el: Element, pseudo?: string | null) =>
      (pseudo
        ? pseudoStyle
        : {
            getPropertyValue: (prop: string) => rootVars[prop] ?? '',
          }) as unknown as CSSStyleDeclaration,
  );
}

function installAnimations(animations: FakeAnimation[]) {
  Object.defineProperty(document, 'getAnimations', {
    configurable: true,
    writable: true,
    value: () => animations,
  });
}

/**
 * Fresh module per test: `ensureStyleInjected` and the CSS animation-name
 * sequence are module-level state, so a shared instance would leak between
 * cases.
 */
async function loadUpgrade() {
  vi.resetModules();
  const mod = await import('./vt-composited-morph');
  return mod.maybeUpgradeToCompositedMorph;
}

/** Runs the upgrade and lets its `ready.then` microtask chain settle. */
async function runUpgrade(
  transition: { ready?: Promise<void>; finished: Promise<void> },
  triggerTarget?: HTMLElement | null,
) {
  const upgrade = await loadUpgrade();
  upgrade(transition, triggerTarget);
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

const compositedStyleEl = () => document.head.querySelector('[data-ramka-vt-composited-style]');
const cssPathStyleEl = () => document.head.querySelector(`style[${COMPOSITED_CSS_ATTR}]`);

/** Nothing was touched: no replacements, no attributes, UA animation intact. */
function expectStockMorphLeftAlone(ua: FakeAnimation) {
  expect(animateSpy).not.toHaveBeenCalled();
  expect(document.documentElement.hasAttribute(COMPOSITED_ATTR)).toBe(false);
  expect(document.documentElement.hasAttribute(COMPOSITED_CSS_ATTR)).toBe(false);
  expect(ua.cancel).not.toHaveBeenCalled();
}

beforeEach(() => {
  installHarness();
  installAnimations([uaGroupAnimation()]);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete globals().__RAMKA_VT_COMPOSITED__;
  delete globals().GestureEvent;
  document.documentElement.removeAttribute(COMPOSITED_ATTR);
  document.documentElement.removeAttribute(COMPOSITED_CSS_ATTR);
  document.documentElement.removeAttribute(LightboxDocumentDataAttributes.crossfade);
  document.head.querySelectorAll('style').forEach((el) => el.remove());
});

describe('composited morph — bails that leave the stock UA morph running', () => {
  it('respects the ?vtstock opt-out', async () => {
    globals().__RAMKA_VT_COMPOSITED__ = false;
    const ua = uaGroupAnimation();
    installAnimations([ua]);

    await runUpgrade(fakeTransition().transition);

    expectStockMorphLeftAlone(ua);
  });

  it('bails when the transition has no `ready` (unsupported / older API shape)', async () => {
    const ua = uaGroupAnimation();
    installAnimations([ua]);

    await runUpgrade({ finished: Promise.resolve() });

    expectStockMorphLeftAlone(ua);
  });

  it('swallows a rejected `ready` — the transition was skipped, nothing to upgrade', async () => {
    const ua = uaGroupAnimation();
    installAnimations([ua]);
    const upgrade = await loadUpgrade();

    // A skipped transition rejects `ready`; an unhandled rejection here would
    // surface as a test failure.
    expect(() => upgrade({ ready: Promise.reject(new Error('skipped')), finished: Promise.resolve() })).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();

    expectStockMorphLeftAlone(ua);
  });

  it('bails without `document.getAnimations`', async () => {
    const ua = uaGroupAnimation();
    installAnimations([ua]);
    Object.defineProperty(document, 'getAnimations', {
      configurable: true,
      writable: true,
      value: undefined,
    });

    await runUpgrade(fakeTransition().transition);

    expectStockMorphLeftAlone(ua);
  });

  it('bails when no UA group animation is present', async () => {
    const ua = uaGroupAnimation({ animationName: 'author-supplied-animation' });
    installAnimations([ua]);

    await runUpgrade(fakeTransition().transition);

    expectStockMorphLeftAlone(ua);
  });

  it('ignores animations on other pseudo-elements', async () => {
    const ua = uaGroupAnimation({ pseudoElement: OLD_PSEUDO });
    installAnimations([ua]);

    await runUpgrade(fakeTransition().transition);

    expectStockMorphLeftAlone(ua);
  });

  it('bails when the UA animation has no effect', async () => {
    const ua = uaGroupAnimation({ noEffect: true });
    installAnimations([ua]);

    await runUpgrade(fakeTransition().transition);

    expectStockMorphLeftAlone(ua);
  });

  it('bails when the engine throws from getKeyframes', async () => {
    const ua = uaGroupAnimation({ throwOnKeyframes: true });
    installAnimations([ua]);

    await runUpgrade(fakeTransition().transition);

    expectStockMorphLeftAlone(ua);
  });

  it('bails when there is no `from` keyframe', async () => {
    const ua = uaGroupAnimation({ keyframes: [TO] });
    installAnimations([ua]);

    await runUpgrade(fakeTransition().transition);

    expectStockMorphLeftAlone(ua);
  });

  it('bails on a rotated endpoint — the compose math assumes axis alignment', async () => {
    const ua = uaGroupAnimation({
      keyframes: [{ ...FROM, transform: 'matrix(0.87, 0.5, -0.5, 0.87, 100, 200)' }, TO],
    });
    installAnimations([ua]);

    await runUpgrade(fakeTransition().transition);

    expectStockMorphLeftAlone(ua);
  });

  it('bails when the `from` box cannot be parsed', async () => {
    const ua = uaGroupAnimation({ keyframes: [{ ...FROM, width: 'auto' }, TO] });
    installAnimations([ua]);

    await runUpgrade(fakeTransition().transition);

    expectStockMorphLeftAlone(ua);
  });

  it('bails on a non-numeric UA duration', async () => {
    const ua = uaGroupAnimation({ duration: 'auto' });
    installAnimations([ua]);

    await runUpgrade(fakeTransition().transition);

    expectStockMorphLeftAlone(ua);
  });

  it('bails on a zero-length UA animation', async () => {
    const ua = uaGroupAnimation({ duration: 0 });
    installAnimations([ua]);

    await runUpgrade(fakeTransition().transition);

    expectStockMorphLeftAlone(ua);
  });
});

describe('composited morph — end-geometry fallback', () => {
  it('reads the endpoint off computed style when the `to` frame is missing', async () => {
    // Older Blink shipped `transform: none` in the `to` frame; the group's base
    // style is the new element's box, reachable by jumping the paused animation.
    const ua = uaGroupAnimation({ keyframes: [FROM] });
    installAnimations([ua]);

    await runUpgrade(fakeTransition().transition);

    expect(ua.pause).toHaveBeenCalled();
    expect(animateSpy).toHaveBeenCalled();
    expect(document.documentElement.hasAttribute(COMPOSITED_ATTR)).toBe(true);
  });

  it('rolls the UA animation back to the start when that fallback also fails', async () => {
    // Safari 18.x returns an empty transform from getComputedStyle on
    // view-transition pseudos while animations run on them. Mapping that to
    // identity used to fling the morph into the viewport's top-left corner, so
    // the parse is strict and this must land on the stock morph instead.
    const ua = uaGroupAnimation({ keyframes: [FROM] });
    installAnimations([ua]);
    pseudoStyle.transform = '';

    await runUpgrade(fakeTransition().transition);

    expect(ua.pause).toHaveBeenCalled();
    // Rewound and resumed, so the stock morph plays from the top.
    expect(ua.currentTime).toBe(0);
    expect(ua.play).toHaveBeenCalled();
    // Rollback happens before the commit, so the UA animation is never dropped.
    expect(ua.cancel).not.toHaveBeenCalled();
    expect(animateSpy).not.toHaveBeenCalled();
    expect(document.documentElement.hasAttribute(COMPOSITED_ATTR)).toBe(false);
  });
});

describe('composited morph — WAAPI path (Blink / Gecko)', () => {
  it('replaces the UA animation with transform-only compositor animations', async () => {
    const ua = uaGroupAnimation();
    installAnimations([ua]);

    await runUpgrade(fakeTransition().transition);

    // Cancelled rather than merely styled `animation: none`: Gecko keeps an
    // API-paused CSS animation alive, which holds `finished` hostage.
    expect(ua.cancel).toHaveBeenCalled();
    expect(document.documentElement.hasAttribute(COMPOSITED_ATTR)).toBe(true);
    expect(compositedStyleEl()).not.toBeNull();

    // No radius vars set, so: group + old snapshot + new snapshot.
    expect(animateSpy).toHaveBeenCalledTimes(3);
    const pseudos = animateSpy.mock.calls.map(([, options]) => options.pseudoElement);
    expect(pseudos).toEqual([GROUP_PSEUDO, OLD_PSEUDO, NEW_PSEUDO]);
  });

  it('animates every track linearly, with the easing baked into the samples', async () => {
    await runUpgrade(fakeTransition().transition);

    for (const [frames, options] of animateSpy.mock.calls) {
      expect(options.easing).toBe('linear');
      expect(options.fill).toBe('both');
      expect(options.duration).toBeGreaterThan(0);
      // Sampled numerically because the counter track needs 1/s(t), which no
      // easing function can express.
      expect(frames.length).toBeGreaterThan(20);
      expect(frames[0].offset).toBe(0);
      expect(frames[frames.length - 1].offset).toBe(1);
      expect(String(frames[0].transform)).toMatch(/^translate\(.+\) scale\(.+\)$/);
    }
  });

  it('adds a separate border-radius track when the morph has radius', async () => {
    installAnimations([uaGroupAnimation()]);
    rootVars[LightboxDocumentCssVars.morphBorderRadiusFrom] = '16px';
    rootVars[LightboxDocumentCssVars.morphBorderRadiusTo] = '0px';

    await runUpgrade(fakeTransition().transition);

    // Separate from the transform track: mixing a paint property into the same
    // effect demotes the whole effect off the compositor.
    expect(animateSpy).toHaveBeenCalledTimes(4);
    const radiusCall = animateSpy.mock.calls[1];
    expect(radiusCall[1].pseudoElement).toBe(GROUP_PSEUDO);
    expect(radiusCall[0][0]).toHaveProperty('borderRadius');
  });

  it('leaves the snapshots alone for a crossfade morph', async () => {
    document.documentElement.setAttribute(LightboxDocumentDataAttributes.crossfade, 'both');

    await runUpgrade(fakeTransition().transition);

    // Crossfade snapshots keep the structural `100%` + `object-fit: fill`
    // contract and their UA opacity dissolve, so only the group is replaced.
    expect(animateSpy).toHaveBeenCalledTimes(1);
    expect(animateSpy.mock.calls[0][1].pseudoElement).toBe(GROUP_PSEUDO);
  });

  it('resumes from the UA animation’s painted progress, not its start time', async () => {
    // On a throttled main thread the upgrade lands several frames late;
    // back-dating to startTime would skip the leading edge of the curve.
    const ua = uaGroupAnimation({ currentTime: 60 });
    installAnimations([ua]);

    await runUpgrade(fakeTransition().transition);

    expect(createdAnimations).toHaveLength(3);
    for (const animation of createdAnimations) {
      expect(animation.currentTime).toBe(60);
    }
  });

  it('does not seek the replacements when the UA animation has not advanced', async () => {
    await runUpgrade(fakeTransition().transition);

    for (const animation of createdAnimations) {
      expect(animation.currentTime).toBeNull();
    }
  });

  it('rolls back to the stock morph when the engine refuses pseudo-element WAAPI', async () => {
    const ua = uaGroupAnimation();
    installAnimations([ua]);
    animateSpy.mockImplementation(() => {
      throw new Error('pseudo-element WAAPI unsupported');
    });

    await runUpgrade(fakeTransition().transition);

    expect(document.documentElement.hasAttribute(COMPOSITED_ATTR)).toBe(false);
    // The UA animation was already dropped by this point, so the rollback has
    // to rewind and replay it.
    expect(ua.cancel).toHaveBeenCalled();
    expect(ua.currentTime).toBe(0);
    expect(ua.play).toHaveBeenCalled();
  });

  it('cancels a partially created set before rolling back', async () => {
    const ua = uaGroupAnimation();
    installAnimations([ua]);
    // Group track succeeds, the first snapshot track throws.
    let calls = 0;
    animateSpy.mockImplementation(() => {
      calls += 1;
      if (calls > 1) throw new Error('pseudo-element WAAPI unsupported');
      return trackCreated();
    });

    await runUpgrade(fakeTransition().transition);

    expect(createdAnimations).toHaveLength(1);
    expect(createdAnimations[0]!.cancel).toHaveBeenCalled();
    expect(ua.play).toHaveBeenCalled();
  });

  it('tears everything down when the transition finishes', async () => {
    const { transition, finish } = fakeTransition();

    const upgrade = await loadUpgrade();
    upgrade(transition);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(document.documentElement.hasAttribute(COMPOSITED_ATTR)).toBe(true);
    expect(createdAnimations).toHaveLength(3);

    await finish();

    for (const animation of createdAnimations) {
      expect(animation.cancel).toHaveBeenCalled();
    }
    expect(document.documentElement.hasAttribute(COMPOSITED_ATTR)).toBe(false);
    expect(document.documentElement.hasAttribute(COMPOSITED_CSS_ATTR)).toBe(false);
  });
});

describe('composited morph — WebKit CSS path', () => {
  beforeEach(() => {
    // GestureEvent has only ever shipped in WebKit.
    globals().GestureEvent = class {};
  });

  it('delivers the replacement as generated CSS instead of WAAPI', async () => {
    const ua = uaGroupAnimation();
    installAnimations([ua]);

    await runUpgrade(fakeTransition().transition);

    // WAAPI on pseudos ignores every anchoring trick in WebKit.
    expect(animateSpy).not.toHaveBeenCalled();
    expect(ua.cancel).toHaveBeenCalled();
    expect(document.documentElement.hasAttribute(COMPOSITED_CSS_ATTR)).toBe(true);
    // The static sheet forces `animation: none` under the WAAPI attribute, so
    // the CSS path must not claim it.
    expect(document.documentElement.hasAttribute(COMPOSITED_ATTR)).toBe(false);
    expect(compositedStyleEl()).toBeNull();

    const css = cssPathStyleEl()?.textContent ?? '';
    expect(css).toContain('@keyframes ramka-vtg-');
    expect(css).toContain(GROUP_PSEUDO);
    expect(css).toContain(OLD_PSEUDO);
    expect(css).toContain(NEW_PSEUDO);
  });

  it('carries the elapsed UA progress as a negative animation delay', async () => {
    installAnimations([uaGroupAnimation({ currentTime: 45 })]);

    await runUpgrade(fakeTransition().transition);

    expect(cssPathStyleEl()?.textContent ?? '').toContain('-45ms both');
  });

  it('emits group rules only for a crossfade morph', async () => {
    document.documentElement.setAttribute(LightboxDocumentDataAttributes.crossfade, 'open');

    await runUpgrade(fakeTransition().transition);

    const css = cssPathStyleEl()?.textContent ?? '';
    expect(css).toContain(GROUP_PSEUDO);
    expect(css).not.toContain(OLD_PSEUDO);
    expect(css).not.toContain(NEW_PSEUDO);
  });

  it('uses a fresh @keyframes name per transition so animations restart', async () => {
    const upgrade = await loadUpgrade();

    upgrade(fakeTransition().transition);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    const first = cssPathStyleEl()?.textContent ?? '';

    installAnimations([uaGroupAnimation()]);
    upgrade(fakeTransition().transition);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    const sheets = [...document.head.querySelectorAll(`style[${COMPOSITED_CSS_ATTR}]`)];
    const second = sheets[sheets.length - 1]?.textContent ?? '';

    const nameOf = (css: string) => /@keyframes (ramka-vtg-\d+)/.exec(css)?.[1];
    expect(nameOf(first)).toBeDefined();
    expect(nameOf(second)).toBeDefined();
    expect(nameOf(first)).not.toBe(nameOf(second));
  });

  it('adopts the per-transition keyframes in a browser, and releases them on teardown', async () => {
    // The generated keyframes are computed per open, so no CSP hash allowlist
    // could ever cover them — they have to stay out of the document entirely.
    const stub = stubConstructedSheets();
    try {
      const { transition, finish } = fakeTransition();

      const upgrade = await loadUpgrade();
      upgrade(transition);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(document.querySelectorAll('style')).toHaveLength(0);
      expect(stub.adoptedCss().join('')).toContain('@keyframes ramka-vtg-');

      await finish();

      expect(stub.adoptedCss()).toHaveLength(0);
      expect(document.documentElement.hasAttribute(COMPOSITED_CSS_ATTR)).toBe(false);
    } finally {
      stub.restore();
    }
  });

  it('removes its per-transition stylesheet on teardown', async () => {
    const { transition, finish } = fakeTransition();

    const upgrade = await loadUpgrade();
    upgrade(transition);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(cssPathStyleEl()).not.toBeNull();

    await finish();

    expect(cssPathStyleEl()).toBeNull();
    expect(document.documentElement.hasAttribute(COMPOSITED_CSS_ATTR)).toBe(false);
  });
});

describe('composited morph — fragmented trigger endpoint correction (WebKit multicol)', () => {
  // WebKit ≤18.4 captures triggers inside CSS multicol at their
  // pre-fragmentation position (first column's x, pushed down by the columns
  // before it). The upgrade re-anchors the trigger-side endpoint to the live
  // element's box — but only when the UA geometry is verifiably wrong.

  const PHASE_ATTR = LightboxDocumentDataAttributes.viewTransition;
  let trigger: HTMLElement;

  /** A connected element whose measured box the correction can read. */
  function connectTrigger(rect: { x: number; y: number; width: number; height: number }) {
    trigger = document.createElement('div');
    trigger.getBoundingClientRect = () =>
      ({ ...rect, left: rect.x, top: rect.y, right: rect.x + rect.width, bottom: rect.y + rect.height }) as DOMRect;
    document.body.appendChild(trigger);
    return trigger;
  }

  const groupFrames = () => animateSpy.mock.calls[0]![0] as { transform: string }[];

  afterEach(() => {
    document.documentElement.removeAttribute(PHASE_ATTR);
    trigger?.remove();
  });

  it('re-anchors the `from` endpoint to the live trigger box on open', async () => {
    document.documentElement.setAttribute(PHASE_ATTR, 'opening');
    // UA captured (100, 200); the tile actually sits at (300, 40) — same size.
    const el = connectTrigger({ x: 300, y: 40, width: 200, height: 150 });

    await runUpgrade(fakeTransition().transition, el);

    expect(groupFrames()[0]!.transform).toBe('translate(300px, 40px) scale(0.25, 0.25)');
  });

  it('re-anchors the `to` endpoint to the live trigger box on close', async () => {
    document.documentElement.setAttribute(PHASE_ATTR, 'closing');
    // UA's end state is (0, 0); the trigger really sits at (50, 60).
    const el = connectTrigger({ x: 50, y: 60, width: 800, height: 600 });

    await runUpgrade(fakeTransition().transition, el);

    const frames = groupFrames();
    expect(frames[frames.length - 1]!.transform).toBe('translate(50px, 60px) scale(1, 1)');
  });

  it('leaves a correct capture untouched (measurement agrees with the UA)', async () => {
    document.documentElement.setAttribute(PHASE_ATTR, 'opening');
    const el = connectTrigger({ x: 100.4, y: 199.8, width: 200, height: 150 });

    await runUpgrade(fakeTransition().transition, el);

    expect(groupFrames()[0]!.transform).toBe('translate(100px, 200px) scale(0.25, 0.25)');
  });

  it('does not trust the measurement when the boxes disagree in size', async () => {
    // A size mismatch means a transform/zoom separates client coords from
    // group coords, so the measured origin cannot be trusted either.
    document.documentElement.setAttribute(PHASE_ATTR, 'opening');
    const el = connectTrigger({ x: 300, y: 40, width: 150, height: 150 });

    await runUpgrade(fakeTransition().transition, el);

    expect(groupFrames()[0]!.transform).toBe('translate(100px, 200px) scale(0.25, 0.25)');
  });

  it('skips scaled endpoints — client and group coords legitimately diverge', async () => {
    document.documentElement.setAttribute(PHASE_ATTR, 'opening');
    const ua = uaGroupAnimation({
      keyframes: [{ ...FROM, transform: 'matrix(1.1, 0, 0, 1.1, 100, 200)' }, TO],
    });
    installAnimations([ua]);
    const el = connectTrigger({ x: 300, y: 40, width: 200, height: 150 });

    await runUpgrade(fakeTransition().transition, el);

    expect(groupFrames()[0]!.transform).not.toContain('translate(300px, 40px)');
  });

  it('skips a disconnected trigger', async () => {
    document.documentElement.setAttribute(PHASE_ATTR, 'opening');
    const el = connectTrigger({ x: 300, y: 40, width: 200, height: 150 });
    el.remove();

    await runUpgrade(fakeTransition().transition, el);

    expect(groupFrames()[0]!.transform).toBe('translate(100px, 200px) scale(0.25, 0.25)');
  });

  it('does nothing without a phase attribute on the root', async () => {
    const el = connectTrigger({ x: 300, y: 40, width: 200, height: 150 });

    await runUpgrade(fakeTransition().transition, el);

    expect(groupFrames()[0]!.transform).toBe('translate(100px, 200px) scale(0.25, 0.25)');
  });

  it('corrects the CSS-path keyframes on WebKit too', async () => {
    globals().GestureEvent = class {};
    document.documentElement.setAttribute(PHASE_ATTR, 'opening');
    const el = connectTrigger({ x: 300, y: 40, width: 200, height: 150 });

    await runUpgrade(fakeTransition().transition, el);

    const css = cssPathStyleEl()?.textContent ?? '';
    expect(css).toContain('translate(300px, 40px)');
  });
});

describe('parseScaleTranslate', () => {
  let parse: typeof import('./vt-composited-morph').parseScaleTranslate;

  beforeEach(async () => {
    vi.resetModules();
    parse = (await import('./vt-composited-morph')).parseScaleTranslate;
  });

  it('reads scale and translate out of a 2D matrix', () => {
    expect(parse('matrix(2, 0, 0, 3, 10, 20)')).toEqual({ sx: 2, sy: 3, tx: 10, ty: 20 });
  });

  it('reads Gecko’s matrix3d serialization of a 2D transform', () => {
    expect(parse('matrix3d(2, 0, 0, 0, 0, 3, 0, 0, 0, 0, 1, 0, 10, 20, 0, 1)')).toEqual({
      sx: 2,
      sy: 3,
      tx: 10,
      ty: 20,
    });
  });

  it('rejects rotation and skew', () => {
    expect(parse('matrix(0.87, 0.5, -0.5, 0.87, 0, 0)')).toBeNull();
    expect(parse('matrix(1, 0, 0.4, 1, 0, 0)')).toBeNull();
  });

  it('rejects a matrix3d with a Z component', () => {
    expect(parse('matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 40, 1)')).toBeNull();
  });

  it('rejects non-positive scale', () => {
    expect(parse('matrix(0, 0, 0, 1, 0, 0)')).toBeNull();
    expect(parse('matrix(1, 0, 0, -1, 0, 0)')).toBeNull();
  });

  it('rejects `none` and empty strings rather than treating them as identity', () => {
    // Safari 18.x returns an empty transform from getComputedStyle on
    // view-transition pseudos; identity would send the morph to 0,0.
    expect(parse('none')).toBeNull();
    expect(parse('')).toBeNull();
    expect(parse(undefined)).toBeNull();
  });

  it('rejects a malformed matrix', () => {
    expect(parse('matrix(1, 0, 0, 1)')).toBeNull();
    expect(parse('matrix(1, 0, 0, 1, NaN, 0)')).toBeNull();
  });
});
