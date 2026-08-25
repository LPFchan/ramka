import * as React from 'react';
import { fireEvent, render, screen, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildMorphFrames, type Box } from './flip-morph';
import { LightboxRoot } from './lightbox-root';
import { LightboxTrigger } from './lightbox-trigger';
import { LightboxPortal } from './lightbox-portal';
import { LightboxContent } from './lightbox-content';
import { LightboxItem } from './lightbox-item';
import { LightboxMedia } from './lightbox-media';
import { LightboxClose } from './lightbox-close';
import { VIEW_TRANSITION_PRESETS } from './vt-timing';

// ---------------------------------------------------------------------------
// Sampling — pure, no DOM. This is the part the view-transition engine can only
// test through mocked UA keyframes; here it is two rects in, keyframes out.
// ---------------------------------------------------------------------------

function parseTransform(value: unknown): {
  tx: number;
  ty: number;
  sx: number;
  sy: number;
} {
  const m = /^translate\((-?[\d.]+)px, (-?[\d.]+)px\) scale\((-?[\d.]+), (-?[\d.]+)\)$/.exec(
    String(value),
  );
  if (!m) throw new Error(`unparsable transform: ${String(value)}`);
  return {
    tx: Number(m[1]),
    ty: Number(m[2]),
    sx: Number(m[3]),
    sy: Number(m[4]),
  };
}

const lastFrame = (frames: Keyframe[]) => frames[frames.length - 1]!;

const TRIGGER: Box = { x: 20, y: 40, w: 100, h: 100 };
const MEDIA: Box = { x: 0, y: 0, w: 800, h: 600 };

const linear = (t: number) => t;

describe('flip morph sampling', () => {
  it('places the target on the source box at offset 0 and at rest by offset 1 (open)', () => {
    const { outer } = buildMorphFrames({
      from: TRIGGER,
      to: MEDIA,
      rest: MEDIA,
      ease: linear,
      steps: 24,
      radiusFrom: null,
      radiusTo: null,
      counterInner: false,
    });

    const first = parseTransform(outer[0]!.transform);
    expect(first.tx).toBeCloseTo(TRIGGER.x - MEDIA.x, 3);
    expect(first.ty).toBeCloseTo(TRIGGER.y - MEDIA.y, 3);
    expect(first.sx).toBeCloseTo(TRIGGER.w / MEDIA.w, 3);
    expect(first.sy).toBeCloseTo(TRIGGER.h / MEDIA.h, 3);

    const last = parseTransform(lastFrame(outer).transform);
    expect(last).toEqual({ tx: 0, ty: 0, sx: 1, sy: 1 });
  });

  it('is identity at offset 0 on close, where the element rests at the source box', () => {
    // The distinction the view-transition engine never has to make: its group
    // freezes at the destination, so rest and `to` are the same box. A FLIP
    // close animates the item, which rests where it starts.
    const { outer } = buildMorphFrames({
      from: MEDIA,
      to: TRIGGER,
      rest: MEDIA,
      ease: linear,
      steps: 24,
      radiusFrom: null,
      radiusTo: null,
      counterInner: false,
    });

    expect(parseTransform(outer[0]!.transform)).toEqual({ tx: 0, ty: 0, sx: 1, sy: 1 });

    const last = parseTransform(lastFrame(outer).transform);
    expect(last.tx).toBeCloseTo(TRIGGER.x - MEDIA.x, 3);
    expect(last.ty).toBeCloseTo(TRIGGER.y - MEDIA.y, 3);
    expect(last.sx).toBeCloseTo(TRIGGER.w / MEDIA.w, 3);
    expect(last.sy).toBeCloseTo(TRIGGER.h / MEDIA.h, 3);
  });

  it('keeps the net on-screen scale uniform on every frame (no distortion)', () => {
    // The reason the content is counter-transformed at all: a square trigger
    // morphing into a 4:3 box scales the outer non-uniformly, and the photo
    // must not stretch. Outer scale x inner scale has to be equal on both axes
    // for every sample, not just the endpoints.
    const { outer, inner } = buildMorphFrames({
      from: TRIGGER,
      to: MEDIA,
      rest: MEDIA,
      ease: linear,
      steps: 48,
      radiusFrom: null,
      radiusTo: null,
      counterInner: true,
    });

    expect(inner).toHaveLength(outer.length);

    for (let i = 0; i < outer.length; i++) {
      const o = parseTransform(outer[i]!.transform);
      const c = parseTransform(inner[i]!.transform);
      expect(o.sx * c.sx).toBeCloseTo(o.sy * c.sy, 3);
    }
  });

  it('covers the interpolated box — content is never smaller than the crop window', () => {
    const { outer, inner } = buildMorphFrames({
      from: TRIGGER,
      to: MEDIA,
      rest: MEDIA,
      ease: linear,
      steps: 48,
      radiusFrom: null,
      radiusTo: null,
      counterInner: true,
    });

    for (let i = 0; i < outer.length; i++) {
      const o = parseTransform(outer[i]!.transform);
      const c = parseTransform(inner[i]!.transform);
      // Box and content, both in screen px.
      const boxW = MEDIA.w * o.sx;
      const boxH = MEDIA.h * o.sy;
      const contentW = MEDIA.w * c.sx * o.sx;
      const contentH = MEDIA.h * c.sy * o.sy;
      expect(contentW).toBeGreaterThanOrEqual(boxW - 0.01);
      expect(contentH).toBeGreaterThanOrEqual(boxH - 0.01);
    }
  });

  it('emits no radius track when both endpoints are square', () => {
    const square = buildMorphFrames({
      from: TRIGGER,
      to: MEDIA,
      rest: MEDIA,
      ease: linear,
      steps: 8,
      radiusFrom: [0, 0, 0, 0],
      radiusTo: [0, 0, 0, 0],
      counterInner: false,
    });
    expect(square.radius).toHaveLength(0);

    const rounded = buildMorphFrames({
      from: TRIGGER,
      to: MEDIA,
      rest: MEDIA,
      ease: linear,
      steps: 8,
      radiusFrom: [50, 50, 50, 50],
      radiusTo: [0, 0, 0, 0],
      counterInner: false,
    });
    expect(rounded.radius).toHaveLength(9);
    // Elliptical, so corners stay circular under the non-uniform outer scale.
    expect(String(rounded.radius[0]!.borderRadius)).toContain('/');
  });
});

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

interface FakeAnimation {
  finished: Promise<void>;
  cancel: () => void;
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
  target: Element;
}

function domRect(box: Box): DOMRect {
  return {
    x: box.x,
    y: box.y,
    left: box.x,
    top: box.y,
    right: box.x + box.w,
    bottom: box.y + box.h,
    width: box.w,
    height: box.h,
    toJSON: () => ({}),
  } as DOMRect;
}

describe('flip morph engine', () => {
  let animations: FakeAnimation[];
  let resolvers: Array<() => void>;
  let startViewTransition: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    (window as unknown as Record<string, unknown>).__RAMKA_FLIP__ = true;
    const { loadMorphRuntime } = await import('./lightbox-morph-loader');
    await loadMorphRuntime();

    animations = [];
    resolvers = [];

    // jsdom implements neither the Web Animations API nor layout, so the engine
    // needs both stubbed — but each is an ordinary object/number, which is the
    // point: none of this is reachable for a document view transition.
    Object.defineProperty(Element.prototype, 'animate', {
      configurable: true,
      writable: true,
      value: function stubAnimate(
        this: Element,
        keyframes: Keyframe[],
        options: KeyframeAnimationOptions,
      ) {
        let resolve!: () => void;
        const finished = new Promise<void>((r) => {
          resolve = r;
        });
        resolvers.push(resolve);
        const animation: FakeAnimation = {
          finished,
          cancel: () => resolve(),
          keyframes,
          options,
          target: this,
        };
        animations.push(animation);
        return animation as unknown as Animation;
      },
    });

    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      if (this instanceof HTMLElement) {
        if (this.dataset.testid === 'trigger-0') return domRect(TRIGGER);
        if (this.hasAttribute('data-ramka-media')) return domRect(MEDIA);
      }
      return domRect({ x: 0, y: 0, w: 0, h: 0 });
    });

    // Present but must go unused — the FLIP engine never captures.
    startViewTransition = vi.fn(() => ({ finished: Promise.resolve() }));
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      writable: true,
      value: startViewTransition,
    });
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).__RAMKA_FLIP__;
    delete (document as unknown as Record<string, unknown>).startViewTransition;
    delete (Element.prototype as unknown as Record<string, unknown>).animate;
    document.documentElement.removeAttribute('data-ramka-flip');
    document.documentElement.removeAttribute('data-ramka-crossfade');
    document.documentElement.removeAttribute('data-ramka-vt-preset');
    for (const name of [
      '--lightbox-vt-duration',
      '--lightbox-vt-easing',
      '--lightbox-vt-crossfade-close-easing',
      '--lightbox-vt-root-easing',
    ]) {
      document.documentElement.style.removeProperty(name);
    }
    vi.restoreAllMocks();
  });

  function Fixture(props: React.ComponentProps<typeof LightboxRoot>) {
    return (
      <LightboxRoot awaitImageDecode={false} {...props}>
        <LightboxTrigger index={0} data-testid="trigger-0">
          Open
        </LightboxTrigger>
        <LightboxPortal>
          <LightboxContent data-testid="content" aria-label="flip morph">
            <LightboxClose data-testid="close">Close</LightboxClose>
            <LightboxItem index={0} data-testid="item-0">
              <LightboxMedia data-testid="media">
                <img src="full.jpg" alt="full" />
              </LightboxMedia>
            </LightboxItem>
          </LightboxContent>
        </LightboxPortal>
      </LightboxRoot>
    );
  }

  const finishAll = async () => {
    await act(async () => {
      for (const resolve of resolvers) resolve();
    });
  };

  it('morphs without touching the View Transition API', () => {
    render(<Fixture />);
    fireEvent.click(screen.getByTestId('trigger-0'));

    expect(startViewTransition).not.toHaveBeenCalled();
    expect(screen.getByTestId('content')).toBeInTheDocument();
    expect(animations.length).toBeGreaterThan(0);
  });

  it('publishes the phase marker and the preset clock, then clears both', async () => {
    render(<Fixture viewTransition="spring" />);
    fireEvent.click(screen.getByTestId('trigger-0'));

    const docEl = document.documentElement;
    expect(docEl).toHaveAttribute('data-ramka-flip', 'opening');
    expect(docEl).toHaveAttribute('data-ramka-vt-preset', 'spring');
    // Same var every skin already fades its scrim and chrome on, so both
    // engines drive identical page-behind motion.
    expect(docEl.style.getPropertyValue('--lightbox-vt-duration')).toBe(
      `${VIEW_TRANSITION_PRESETS.spring.duration}ms`,
    );

    await finishAll();

    expect(docEl).not.toHaveAttribute('data-ramka-flip');
    expect(docEl).not.toHaveAttribute('data-ramka-vt-preset');
    expect(docEl.style.getPropertyValue('--lightbox-vt-duration')).toBe('');
  });

  it('animates the destination from the trigger box to its own, on the preset clock', () => {
    render(<Fixture />);
    fireEvent.click(screen.getByTestId('trigger-0'));

    const media = screen.getByTestId('media');
    const outer = animations.find((a) => a.target === media);
    expect(outer).toBeDefined();

    const first = parseTransform(outer!.keyframes[0]!.transform);
    expect(first.sx).toBeCloseTo(TRIGGER.w / MEDIA.w, 3);
    expect(first.sy).toBeCloseTo(TRIGGER.h / MEDIA.h, 3);
    expect(parseTransform(lastFrame(outer!.keyframes).transform)).toEqual({
      tx: 0,
      ty: 0,
      sx: 1,
      sy: 1,
    });

    expect(outer!.options.duration).toBe(VIEW_TRANSITION_PRESETS.default.duration);
    // Easing is baked into the sampled keyframes, so the track runs linear.
    expect(outer!.options.easing).toBe('linear');
  });

  it('seeds the start pose inline so no frame paints the destination at full size', () => {
    render(<Fixture />);
    fireEvent.click(screen.getByTestId('trigger-0'));

    // The atomicity a view transition gets from render suppression, earned here
    // by posing inside the same task as the reveal.
    const media = screen.getByTestId('media');
    const posed = parseTransform(media.style.transform);
    expect(posed.sx).toBeCloseTo(TRIGGER.w / MEDIA.w, 3);
    expect(media.style.transformOrigin).toBe('0 0');
    expect(media.style.overflow).toBe('hidden');
  });

  it('counter-transforms the media child so the photo holds its aspect ratio', () => {
    render(<Fixture />);
    fireEvent.click(screen.getByTestId('trigger-0'));

    const media = screen.getByTestId('media');
    const img = screen.getByAltText('full');
    const outer = animations.find((a) => a.target === media)!;
    const inner = animations.find((a) => a.target === img);
    expect(inner).toBeDefined();

    const o = parseTransform(outer.keyframes[0]!.transform);
    const c = parseTransform(inner!.keyframes[0]!.transform);
    expect(o.sx * c.sx).toBeCloseTo(o.sy * c.sy, 3);
  });

  it('restores the destination to resting style once the morph settles', async () => {
    render(<Fixture />);
    fireEvent.click(screen.getByTestId('trigger-0'));

    const media = screen.getByTestId('media');
    expect(media.style.transform).not.toBe('');

    await finishAll();

    expect(media.style.transform).toBe('');
    expect(media.style.overflow).toBe('');
    expect(media.style.willChange).toBe('');
  });

  it('keeps the viewer mounted through the close morph, then unmounts', async () => {
    const onComplete = vi.fn();
    render(<Fixture defaultOpen onOpenChangeComplete={onComplete} />);
    animations.length = 0;
    resolvers.length = 0;

    fireEvent.click(screen.getByTestId('close'));

    // No snapshot to animate in a top layer, so the closing morph IS the live
    // element — it cannot be unmounted until the animation is done.
    expect(screen.getByTestId('item-0')).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute('data-ramka-flip', 'closing');
    expect(onComplete).not.toHaveBeenCalled();

    await finishAll();

    expect(screen.queryByTestId('item-0')).not.toBeInTheDocument();
    expect(onComplete).toHaveBeenCalledWith(false);
  });

  it('keeps the trigger hidden for the whole close, then releases it', async () => {
    // Regression: `Lightbox.Trigger` derives the hide attribute from the open
    // state, so marking the viewer closed revealed the trigger at close *start*
    // — doubled under a morph still flying towards it. A view transition animates
    // a snapshot captured while the attribute was still on and never sees this.
    render(<Fixture defaultOpen />);
    animations.length = 0;
    resolvers.length = 0;

    const trigger = screen.getByTestId('trigger-0');
    expect(trigger).toHaveAttribute('data-morph-target');

    fireEvent.click(screen.getByTestId('close'));
    expect(trigger).toHaveAttribute('data-morph-target');

    await finishAll();

    expect(trigger).not.toHaveAttribute('data-morph-target');
  });

  it('exempts the morph path from the skin fade and moves it onto the chrome', async () => {
    // Regression: skins fade Content's opacity on close, and the morph target is
    // a descendant — so the morph went invisible a fifth of the way in. A view
    // transition excludes the named group from the root snapshot; this has to
    // reproduce that partition by hand.
    render(<Fixture defaultOpen />);
    animations.length = 0;
    resolvers.length = 0;

    fireEvent.click(screen.getByTestId('close'));

    const content = screen.getByTestId('content');
    const media = screen.getByTestId('media');
    const img = screen.getByAltText('full');

    // Every ancestor between Content and the morph target is pinned opaque, so
    // no ancestor alpha can multiply into the morph.
    for (const el of [content, screen.getByTestId('item-0'), media]) {
      expect(el.style.opacity).toBe('1');
      expect(el.style.transition).toBe('none');
    }
    // The morph's own content is not chrome — it must not be faded.
    expect(img.style.opacity).toBe('');

    // Chrome off that path carries the fade instead, on the root-snapshot clock.
    const close = screen.getByTestId('close');
    expect(close.style.opacity).toBe('0');
    expect(close.style.transition).toContain('opacity');
    expect(close.style.transition).toContain(`${VIEW_TRANSITION_PRESETS.default.duration}ms`);

    await finishAll();

    expect(content.style.opacity).toBe('');
    expect(content.style.transition).toBe('');
  });

  it('fades chrome in from zero on open without fading the morph', () => {
    render(<Fixture />);
    fireEvent.click(screen.getByTestId('trigger-0'));

    const media = screen.getByTestId('media');
    expect(media.style.opacity).toBe('1');

    // Seeded at 0, then handed to the skin's own resting opacity as the target.
    const close = screen.getByTestId('close');
    expect(close.style.opacity).toBe('');
    expect(close.style.transition).toContain('opacity');
  });

  it('hides the viewer before unwinding the morph, so no frame shows it reopened', async () => {
    // Regression: `cancel()` restores the resting pose — full-screen, opaque —
    // and the React update that unmounts is async, so unwinding first flashed a
    // frame of the lightbox as if it had never closed. The morph styles must
    // still be in place when the close completes.
    const observed: { overflow: string; contentOpacity: string }[] = [];
    render(
      <Fixture
        defaultOpen
        onOpenChangeComplete={(open) => {
          if (open) return;
          const media = document.querySelector('[data-ramka-media]') as HTMLElement | null;
          const content = document.querySelector('[data-ramka-content]') as HTMLElement | null;
          observed.push({
            overflow: media?.style.overflow ?? '',
            contentOpacity: content?.style.opacity ?? '',
          });
        }}
      />,
    );
    animations.length = 0;
    resolvers.length = 0;

    fireEvent.click(screen.getByTestId('close'));
    await finishAll();

    expect(observed).toHaveLength(1);
    expect(observed[0]).toEqual({ overflow: 'hidden', contentOpacity: '1' });
    expect(screen.queryByTestId('item-0')).not.toBeInTheDocument();
  });

  it('closes from the pulled pose without composing the pull transform', async () => {
    // Regression: pull-to-dismiss drags the active item with an inline
    // translate/scale and deliberately leaves it applied when the pull commits
    // to closing, because the view-transition engine wants it in the capture.
    // Animating live DOM instead, that transform nested outside ours *and*
    // scaled every rect the morph measured itself against, so a pulled close
    // flew to the wrong place on screen.
    const PULLED: Box = { x: 40, y: 180, w: 680, h: 510 };

    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      if (this instanceof HTMLElement) {
        if (this.dataset.testid === 'trigger-0') return domRect(TRIGGER);
        if (this.hasAttribute('data-ramka-media')) {
          // Stand in for layout: a transform on the item moves and shrinks its
          // whole subtree, the media's measured rect included.
          const item = this.closest('[data-testid="item-0"]') as HTMLElement | null;
          const transform = item?.style.transform ?? '';
          return domRect(transform && transform !== 'none' ? PULLED : MEDIA);
        }
      }
      return domRect({ x: 0, y: 0, w: 0, h: 0 });
    });

    render(<Fixture defaultOpen />);
    animations.length = 0;
    resolvers.length = 0;

    const item = screen.getByTestId('item-0');
    item.style.transform = 'translate(40px, 180px) scale(0.85)';

    fireEvent.click(screen.getByTestId('close'));

    // Flattened for the duration, so the sampled track is the only thing moving
    // the subtree.
    expect(item.style.transform).toBe('none');

    const media = screen.getByTestId('media');
    const outer = animations.find((a) => a.target === media)!;

    // Frame 0 is the pose the finger left behind — the pull is preserved as the
    // morph's starting point rather than dropped or double-applied.
    const first = parseTransform(outer.keyframes[0]!.transform);
    expect(first.tx).toBeCloseTo(PULLED.x - MEDIA.x, 3);
    expect(first.ty).toBeCloseTo(PULLED.y - MEDIA.y, 3);
    expect(first.sx).toBeCloseTo(PULLED.w / MEDIA.w, 3);

    // The last frame is the trigger expressed against the item's *resting* box.
    // Measuring `rest` off the pulled rect is what put the landing elsewhere.
    const last = parseTransform(lastFrame(outer.keyframes).transform);
    expect(last.tx).toBeCloseTo(TRIGGER.x - MEDIA.x, 3);
    expect(last.ty).toBeCloseTo(TRIGGER.y - MEDIA.y, 3);
    expect(last.sx).toBeCloseTo(TRIGGER.w / MEDIA.w, 3);
    expect(last.sy).toBeCloseTo(TRIGGER.h / MEDIA.h, 3);

    await finishAll();
  });

  it('anchors the closing morph out of the scrollport instead of freezing it', async () => {
    // Regression: a FLIP close animates the live element, and that element sits
    // inside the Slides scrollport. Closing while a swipe was still settling let
    // momentum, the snap settle and Slides' own rAF tails keep carrying it under
    // a transform sampled against one fixed position, so the morph drifted. The
    // scroller can't be frozen from here — Slides owns `scroll-snap-type` and
    // `scrollLeft` and rewrites both a frame later — so the element steps out of
    // it instead. The view-transition engine gets this for free: its capture
    // lives in the top layer.
    render(<Fixture defaultOpen />);
    animations.length = 0;
    resolvers.length = 0;

    fireEvent.click(screen.getByTestId('close'));

    const media = screen.getByTestId('media');
    expect(media.style.position).toBe('fixed');
    // Sized to the resting box rather than left to out-of-flow shrink-to-fit, so
    // the media keeps the layout size its `object-fit` crop was computed for.
    expect(media.style.width).toBe(`${MEDIA.w}px`);
    expect(media.style.height).toBe(`${MEDIA.h}px`);
    expect(media.style.boxSizing).toBe('border-box');

    // The scroller is left completely alone — no snap or offset writes to fight.
    const item = screen.getByTestId('item-0');
    expect(item.style.scrollSnapType).toBe('');
    expect(item.style.overflow).toBe('');

    await finishAll();

    // Handed back to the value Media itself declares, not stripped to nothing.
    expect(media.style.position).toBe('relative');
    expect(media.style.width).toBe('');
    expect(media.style.boxSizing).toBe('');
  });

  it('escapes containing blocks that scroll, so the anchor is not pinned inside the carousel', async () => {
    // Regression: `Lightbox.Zoom` sets `container-type: size` from inside the
    // slide, and layout containment makes it the containing block for fixed
    // descendants — so anchoring pinned the morph to a box that scrolls with the
    // carousel. Same drift, one step removed, and only visible while a swipe was
    // still settling: once the next item was active there was no scroll left to
    // expose it.
    render(
      <LightboxRoot awaitImageDecode={false} defaultOpen>
        <LightboxTrigger index={0} data-testid="trigger-0">
          Open
        </LightboxTrigger>
        <LightboxPortal>
          <LightboxContent data-testid="content" aria-label="scrolling containing block">
            <LightboxClose data-testid="close">Close</LightboxClose>
            <div data-testid="scroller" style={{ overflowX: 'auto' }}>
              <LightboxItem index={0} data-testid="item-0">
                <div data-testid="zoom" style={{ containerType: 'size' }}>
                  <LightboxMedia data-testid="media">
                    <img src="full.jpg" alt="full" />
                  </LightboxMedia>
                </div>
              </LightboxItem>
            </div>
          </LightboxContent>
        </LightboxPortal>
      </LightboxRoot>,
    );

    animations.length = 0;
    resolvers.length = 0;

    // Held across the close: the viewer unmounts once the morph settles, and the
    // point of the last assertions is that these nodes were handed back clean.
    const zoom = screen.getByTestId('zoom');
    const scroller = screen.getByTestId('scroller');
    const content = screen.getByTestId('content');

    fireEvent.click(screen.getByTestId('close'));

    expect(zoom.style.getPropertyValue('container-type')).toBe('normal');
    expect(zoom.style.getPropertyValue('contain')).toBe('none');
    expect(screen.getByTestId('media').style.position).toBe('fixed');

    // Cleared the whole way up, not just past the scrollport: only once the
    // initial containing block wins does the anchored box also stop being clipped
    // by ancestor `overflow` — otherwise it is cropped against a moving rect.
    for (const el of [scroller, content]) {
      expect(el.style.getPropertyValue('filter')).toBe('none');
      expect(el.style.getPropertyValue('contain')).toBe('none');
    }

    await finishAll();

    expect(zoom.style.getPropertyValue('container-type')).toBe('size');
    expect(zoom.style.getPropertyValue('contain')).toBe('');
    expect(content.style.getPropertyValue('filter')).toBe('');
  });

  it('clones the trigger into the destination for a crossfade dissolve', () => {
    render(
      <LightboxRoot awaitImageDecode={false}>
        <LightboxTrigger index={0} data-testid="trigger-0" crossfade="both">
          <span data-testid="badge">+3</span>
        </LightboxTrigger>
        <LightboxPortal>
          <LightboxContent data-testid="content" aria-label="crossfade morph">
            <LightboxItem index={0} data-testid="item-0">
              <LightboxMedia data-testid="media">
                <img src="full.jpg" alt="full" />
              </LightboxMedia>
            </LightboxItem>
          </LightboxContent>
        </LightboxPortal>
      </LightboxRoot>,
    );

    fireEvent.click(screen.getByTestId('trigger-0'));

    expect(document.documentElement).toHaveAttribute('data-ramka-crossfade');

    const media = screen.getByTestId('media');
    const ghost = media.querySelector('[data-ramka-flip-ghost]') as HTMLElement | null;
    expect(ghost).not.toBeNull();
    // Overlays come along, which is the whole reason a clone beats redrawing
    // just the thumbnail's pixels.
    expect(ghost!.textContent).toContain('+3');
    expect(ghost!.getAttribute('aria-hidden')).toBe('true');
    expect(ghost!.style.mixBlendMode).toBe('plus-lighter');

    // Complementary pair on a shorter window than the morph.
    const dissolve = animations.filter((a) => a.keyframes[0]?.opacity !== undefined);
    expect(dissolve.length).toBeGreaterThanOrEqual(2);
    expect(Number(dissolve[0]!.options.duration)).toBeLessThan(
      VIEW_TRANSITION_PRESETS.default.duration,
    );
  });

  it('hard-cut morphs leave no ghost behind', () => {
    render(<Fixture />);
    fireEvent.click(screen.getByTestId('trigger-0'));

    expect(document.documentElement).not.toHaveAttribute('data-ramka-crossfade');
    expect(screen.getByTestId('media').querySelector('[data-ramka-flip-ghost]')).toBeNull();
  });

  it('falls back to the plain path when the destination has no resolvable size', () => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      if (this instanceof HTMLElement && this.dataset.testid === 'trigger-0') {
        return domRect(TRIGGER);
      }
      return domRect({ x: 0, y: 0, w: 0, h: 0 });
    });

    render(<Fixture />);
    fireEvent.click(screen.getByTestId('trigger-0'));

    expect(screen.getByTestId('content')).toBeInTheDocument();
    expect(screen.getByTestId('media').style.transform).toBe('');
  });
});
