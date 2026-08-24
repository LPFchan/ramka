import { render, screen, fireEvent, act } from '@testing-library/react';
import * as React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { LightboxContent } from './lightbox-content';
import { LightboxThumbnailStrip } from './lightbox-thumbnail-strip';
import { LightboxThumbnailStripTrack } from './lightbox-thumbnail-strip-track';
import { LightboxItem } from './lightbox-item';
import { LightboxNext } from './lightbox-next';
import { LightboxPortal } from './lightbox-portal';
import { LightboxPrevious } from './lightbox-previous';
import { LightboxRoot } from './lightbox-root';
import { LightboxSlide } from './lightbox-slide';
import { LightboxSlides } from './lightbox-slides';
import { LightboxThumbnail } from './lightbox-thumbnail';
import { LightboxTrigger } from './lightbox-trigger';

const WIDTH = 100;
const THUMB = 40;
const THUMB_GAP = 8;
const THUMB_STEP = THUMB + THUMB_GAP;

const roInstances = new Set<{ cb: ResizeObserverCallback }>();

let rafSeq = 0;
const rafCallbacks = new Map<number, FrameRequestCallback>();
let scrollTimelineEnabled = false;

type LinkCall = {
  target: Element;
  keyframes: Keyframe[];
  timeline: { source: Element; axis?: string };
  anim: {
    play: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
    cancel: ReturnType<typeof vi.fn>;
    playState: string;
    effect: MockKeyframeEffect | null;
  };
};

const linkCalls: LinkCall[] = [];

function flushRaf() {
  const callbacks = [...rafCallbacks.entries()];
  rafCallbacks.clear();
  callbacks.forEach(([, cb]) => cb(0));
}

function flushResizeObservers() {
  act(() => {
    roInstances.forEach((o) => o.cb([], o as unknown as ResizeObserver));
  });
  act(() => flushRaf());
}

function setupSlidesGeometry(viewport: HTMLElement, count: number) {
  let scrollLeft = 0;
  Object.defineProperty(viewport, 'clientWidth', { configurable: true, get: () => WIDTH });
  Object.defineProperty(viewport, 'scrollWidth', { configurable: true, get: () => WIDTH * count });
  Object.defineProperty(viewport, 'scrollLeft', {
    configurable: true,
    get: () => scrollLeft,
    set: (v: number) => {
      scrollLeft = v;
    },
  });
  const slides = viewport.querySelectorAll<HTMLElement>('[data-ramka-slide]');
  slides.forEach((slide, i) => {
    Object.defineProperty(slide, 'offsetLeft', { configurable: true, get: () => i * WIDTH });
    Object.defineProperty(slide, 'offsetWidth', { configurable: true, get: () => WIDTH });
  });
  flushResizeObservers();
}

const THUMBNAIL_STRIP_WIDTH = 320;

function setupThumbGeometry(track: HTMLElement, count: number, widths?: number[]) {
  const tabs = track.querySelectorAll<HTMLElement>('[role="tab"]');
  const resolved =
    widths ??
    Array.from({ length: count }, () => THUMB);
  expect(tabs.length).toBe(count);
  expect(resolved.length).toBe(count);

  let left = 0;
  const lefts: number[] = [];
  for (let i = 0; i < count; i++) {
    lefts.push(left);
    left += resolved[i]! + THUMB_GAP;
  }

  tabs.forEach((tab, i) => {
    const w = resolved[i]!;
    const x = lefts[i]!;
    Object.defineProperty(tab, 'offsetLeft', {
      configurable: true,
      get: () => x,
    });
    Object.defineProperty(tab, 'offsetWidth', { configurable: true, get: () => w });
    // Prefer getBoundingClientRect in ThumbnailStrip — include flex gap in the stride.
    tab.getBoundingClientRect = () =>
      ({
        x,
        y: 0,
        top: 0,
        left: x,
        right: x + w,
        bottom: THUMB,
        width: w,
        height: THUMB,
        toJSON: () => ({}),
      }) as DOMRect;
  });
  flushResizeObservers();
}

function setupThumbnailStripRoot(root: HTMLElement, width = THUMBNAIL_STRIP_WIDTH) {
  Object.defineProperty(root, 'clientWidth', { configurable: true, get: () => width });
  flushResizeObservers();
}

function swipeTo(viewport: HTMLElement, index: number) {
  act(() => {
    viewport.scrollLeft = index * WIDTH;
    fireEvent.scroll(viewport);
    flushRaf();
  });
}

function endScroll(viewport: HTMLElement) {
  act(() => {
    fireEvent(viewport, new Event('scrollend'));
  });
}

function readTranslateX(el: HTMLElement): number {
  const t = el.style.transform;
  const m = /translate3d\(([-\d.]+)px/.exec(t);
  return m ? Number(m[1]) : 0;
}

class MockScrollTimeline {
  source: Element;
  axis?: string;
  constructor(options: { source: Element; axis?: string }) {
    this.source = options.source;
    this.axis = options.axis;
  }
}

class MockKeyframeEffect {
  target: Element;
  keyframes: Keyframe[];
  options: KeyframeEffectOptions;
  constructor(
    target: Element,
    keyframes: Keyframe[] | PropertyIndexedKeyframes | null,
    options?: number | KeyframeEffectOptions,
  ) {
    this.target = target;
    this.keyframes = Array.isArray(keyframes) ? keyframes : [];
    this.options = typeof options === 'number' ? { duration: options } : (options ?? {});
  }
}

class MockAnimation {
  effect: MockKeyframeEffect | null;
  timeline: MockScrollTimeline | null;
  playState = 'idle';
  play = vi.fn(() => {
    this.playState = 'running';
  });
  pause = vi.fn(() => {
    this.playState = 'paused';
  });
  cancel = vi.fn(() => {
    this.playState = 'idle';
  });
  commitStyles = vi.fn();
  finished = Promise.resolve(this as unknown as Animation);
  ready = Promise.resolve(this as unknown as Animation);
  constructor(effect: MockKeyframeEffect | null, timeline: MockScrollTimeline | null = null) {
    this.effect = effect;
    this.timeline = timeline;
    if (effect && timeline) {
      linkCalls.push({
        target: effect.target,
        keyframes: effect.keyframes,
        timeline,
        anim: this,
      });
    }
  }
}

function Gallery({
  count = 5,
  scrubOnSelect,
}: {
  count?: number;
  scrubOnSelect?: boolean;
}) {
  return (
    <LightboxRoot defaultOpen>
      <LightboxTrigger index={0}>open</LightboxTrigger>
      <LightboxPortal>
        <LightboxContent aria-label="ThumbnailStrip test">
          <LightboxSlides data-testid="slides" aria-label="Slides">
            {Array.from({ length: count }, (_, i) => (
              <LightboxSlide key={i}>
                <LightboxItem index={i}>item {i}</LightboxItem>
              </LightboxSlide>
            ))}
          </LightboxSlides>
          <LightboxThumbnailStrip data-testid="thumbnail-strip" scrubOnSelect={scrubOnSelect}>
            <LightboxThumbnailStripTrack data-testid="thumbnail-strip-track" aria-label="Thumbs">
              {Array.from({ length: count }, (_, i) => (
                <LightboxThumbnail key={i} index={i} data-testid={`thumb-${i}`}>
                  t{i}
                </LightboxThumbnail>
              ))}
            </LightboxThumbnailStripTrack>
          </LightboxThumbnailStrip>
        </LightboxContent>
      </LightboxPortal>
    </LightboxRoot>
  );
}

beforeEach(() => {
  roInstances.clear();
  rafCallbacks.clear();
  rafSeq = 0;
  linkCalls.length = 0;
  scrollTimelineEnabled = false;

  vi.stubGlobal(
    'ResizeObserver',
    class {
      cb: ResizeObserverCallback;
      constructor(cb: ResizeObserverCallback) {
        this.cb = cb;
        roInstances.add(this);
      }
      observe() {}
      unobserve() {}
      disconnect() {
        roInstances.delete(this);
      }
    },
  );

  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    const id = ++rafSeq;
    rafCallbacks.set(id, cb);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    rafCallbacks.delete(id);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(HTMLElement.prototype, 'animate');
});

function enableScrollTimeline() {
  scrollTimelineEnabled = true;
  vi.stubGlobal('ScrollTimeline', MockScrollTimeline);
  vi.stubGlobal('KeyframeEffect', MockKeyframeEffect);
  vi.stubGlobal('Animation', MockAnimation);
}

describe('Lightbox.ThumbnailStrip', () => {
  it('publishes identity data attrs and registers a tablist', () => {
    render(<Gallery />);
    const slides = screen.getByTestId('slides');
    setupSlidesGeometry(slides, 5);

    const track = screen.getByTestId('thumbnail-strip-track');
    setupThumbGeometry(track, 5);

    expect(screen.getByTestId('thumbnail-strip')).toHaveAttribute('data-ramka-thumbnail-strip');
    expect(track).toHaveAttribute('data-ramka-thumbnail-strip-track');
    expect(track).toHaveAttribute('role', 'tablist');
    expect(screen.getByText('item 0').closest('[role="tabpanel"]')).toBeTruthy();
  });

  it('JS fallback mirrors Slides scrollLeft onto the track transform', () => {
    expect(scrollTimelineEnabled).toBe(false);

    render(<Gallery count={5} />);
    const slides = screen.getByTestId('slides');
    setupSlidesGeometry(slides, 5);

    const root = screen.getByTestId('thumbnail-strip');
    const track = screen.getByTestId('thumbnail-strip-track');
    setupThumbnailStripRoot(root);
    setupThumbGeometry(track, 5);

    expect(readTranslateX(track)).toBe(0);

    swipeTo(slides, 2);
    expect(readTranslateX(track)).toBeCloseTo(-2 * THUMB_STEP, 5);

    swipeTo(slides, 4);
    expect(readTranslateX(track)).toBeCloseTo(-4 * THUMB_STEP, 5);
  });

  it('JS fallback centers variable-width thumbs by midpoint travel', () => {
    render(<Gallery count={3} />);
    const slides = screen.getByTestId('slides');
    setupSlidesGeometry(slides, 3);

    const root = screen.getByTestId('thumbnail-strip');
    const track = screen.getByTestId('thumbnail-strip-track');
    setupThumbnailStripRoot(root);
    // Landscape / portrait / landscape — unequal strides between centers.
    setupThumbGeometry(track, 3, [80, 40, 80]);

    // Centers at 40, 108, 176 → travels 0, 68, 136.
    expect(readTranslateX(track)).toBe(0);

    swipeTo(slides, 1);
    expect(readTranslateX(track)).toBeCloseTo(-68, 5);

    swipeTo(slides, 2);
    expect(readTranslateX(track)).toBeCloseTo(-136, 5);

    expect(track.style.paddingLeft).toBe('120px'); // (320 - 80) / 2
    expect(track.style.paddingRight).toBe('120px');
  });

  it('links the track to Slides via ScrollTimeline when available', () => {
    enableScrollTimeline();

    render(<Gallery count={5} />);
    const slides = screen.getByTestId('slides');
    setupSlidesGeometry(slides, 5);

    const root = screen.getByTestId('thumbnail-strip');
    const track = screen.getByTestId('thumbnail-strip-track');
    setupThumbnailStripRoot(root);
    setupThumbGeometry(track, 5);

    const link = linkCalls.at(-1);
    expect(link).toBeTruthy();
    expect(link!.target).toBe(track);
    expect(link!.timeline.source).toBe(slides);
    expect(link!.timeline.axis).toBe('x');
    expect(link!.anim.play).toHaveBeenCalled();

    const travel = 4 * THUMB_STEP;
    expect(link!.keyframes[0]).toMatchObject({ transform: 'translate3d(0px, 0, 0)' });
    expect(link!.keyframes[1]).toMatchObject({
      transform: `translate3d(${-travel}px, 0, 0)`,
    });
    // Firefox requires a non-zero duration for ScrollTimeline effects to apply.
    expect(link!.anim.effect?.options).toMatchObject({ duration: 1, fill: 'both' });
  });

  it('thumb click cancels the ScrollTimeline link, scrubs via WAAPI, then re-arms ScrollTimeline', async () => {
    enableScrollTimeline();

    const scrubPause = vi.fn();
    const scrubPlay = vi.fn();
    const scrubCancel = vi.fn();
    const elementAnimate = vi.fn(() => {
      const anim = {
        pause: scrubPause,
        play: scrubPlay,
        cancel: scrubCancel,
        commitStyles: vi.fn(),
        finished: Promise.resolve(),
        currentTime: 0,
      };
      return anim as unknown as Animation;
    });
    Object.defineProperty(HTMLElement.prototype, 'animate', {
      configurable: true,
      writable: true,
      value: elementAnimate,
    });

    render(<Gallery count={5} />);
    const slides = screen.getByTestId('slides');
    setupSlidesGeometry(slides, 5);
    const root = screen.getByTestId('thumbnail-strip');
    const track = screen.getByTestId('thumbnail-strip-track');
    setupThumbnailStripRoot(root);
    setupThumbGeometry(track, 5);
    endScroll(slides);

    const link = linkCalls.at(-1);
    expect(link).toBeTruthy();
    const linksBefore = linkCalls.length;

    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      transform: 'none',
    } as CSSStyleDeclaration);

    await act(async () => {
      fireEvent.click(screen.getByTestId('thumb-3'));
      await Promise.resolve();
      await Promise.resolve();
      flushRaf();
      flushRaf();
    });

    expect(screen.getByTestId('thumb-3')).toHaveAttribute('data-active');
    // Pausing still retargets on the Slides jump (Safari) — cancel instead.
    expect(link!.anim.cancel).toHaveBeenCalled();
    expect(elementAnimate).toHaveBeenCalled();
    expect(scrubPause).toHaveBeenCalled();
    expect(scrubPlay).toHaveBeenCalled();
    // Scrub fill stays until a fresh ScrollTimeline is ready, then drops —
    // not a permanent JS scroll mirror.
    expect(linkCalls.length).toBeGreaterThan(linksBefore);
    expect(scrubCancel).toHaveBeenCalled();
    expect(track.style.transform).toBe('');
  });

  it('keyboard arrow nav scrubs the thumbnail strip like a thumb click', async () => {
    enableScrollTimeline();

    const scrubPlay = vi.fn();
    const elementAnimate = vi.fn(() => {
      const anim = {
        pause: vi.fn(),
        play: scrubPlay,
        cancel: vi.fn(),
        commitStyles: vi.fn(),
        finished: Promise.resolve(),
        currentTime: 0,
      };
      return anim as unknown as Animation;
    });
    Object.defineProperty(HTMLElement.prototype, 'animate', {
      configurable: true,
      writable: true,
      value: elementAnimate,
    });

    render(<Gallery count={5} />);
    const slides = screen.getByTestId('slides');
    // Stage VT stays pointer-only: keyboard nav must not start it.
    const startViewTransition = vi.fn((cb: () => void) => {
      cb();
      return { finished: Promise.resolve() };
    });
    Object.defineProperty(slides, 'startViewTransition', {
      configurable: true,
      value: startViewTransition,
    });
    setupSlidesGeometry(slides, 5);
    const root = screen.getByTestId('thumbnail-strip');
    const track = screen.getByTestId('thumbnail-strip-track');
    setupThumbnailStripRoot(root);
    setupThumbGeometry(track, 5);
    endScroll(slides);

    const link = linkCalls.at(-1);
    expect(link).toBeTruthy();

    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      transform: 'none',
    } as CSSStyleDeclaration);

    await act(async () => {
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowRight' });
      await Promise.resolve();
      await Promise.resolve();
      flushRaf();
      flushRaf();
    });

    expect(screen.getByTestId('thumb-1')).toHaveAttribute('data-active');
    expect(link!.anim.cancel).toHaveBeenCalled();
    expect(elementAnimate).toHaveBeenCalled();
    expect(scrubPlay).toHaveBeenCalled();
    expect(startViewTransition).not.toHaveBeenCalled();
  });

  it('tablist arrow keys scrub the strip without the Slides view transition', async () => {
    enableScrollTimeline();

    const scrubPlay = vi.fn();
    const elementAnimate = vi.fn(() => {
      const anim = {
        pause: vi.fn(),
        play: scrubPlay,
        cancel: vi.fn(),
        commitStyles: vi.fn(),
        finished: Promise.resolve(),
        currentTime: 0,
      };
      return anim as unknown as Animation;
    });
    Object.defineProperty(HTMLElement.prototype, 'animate', {
      configurable: true,
      writable: true,
      value: elementAnimate,
    });

    render(<Gallery count={5} />);
    const slides = screen.getByTestId('slides');
    const startViewTransition = vi.fn((cb: () => void) => {
      cb();
      return { finished: Promise.resolve() };
    });
    Object.defineProperty(slides, 'startViewTransition', {
      configurable: true,
      value: startViewTransition,
    });
    setupSlidesGeometry(slides, 5);
    const root = screen.getByTestId('thumbnail-strip');
    const track = screen.getByTestId('thumbnail-strip-track');
    setupThumbnailStripRoot(root);
    setupThumbGeometry(track, 5);
    endScroll(slides);

    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      transform: 'none',
    } as CSSStyleDeclaration);

    await act(async () => {
      fireEvent.keyDown(track, { key: 'ArrowRight' });
      await Promise.resolve();
      await Promise.resolve();
      flushRaf();
      flushRaf();
    });

    expect(screen.getByTestId('thumb-1')).toHaveAttribute('data-active');
    expect(elementAnimate).toHaveBeenCalled();
    expect(scrubPlay).toHaveBeenCalled();
    expect(startViewTransition).not.toHaveBeenCalled();
  });

  it('Next button scrubs the thumbnail strip', async () => {
    enableScrollTimeline();

    const scrubPlay = vi.fn();
    const elementAnimate = vi.fn(() => {
      const anim = {
        pause: vi.fn(),
        play: scrubPlay,
        cancel: vi.fn(),
        commitStyles: vi.fn(),
        finished: Promise.resolve(),
        currentTime: 0,
      };
      return anim as unknown as Animation;
    });
    Object.defineProperty(HTMLElement.prototype, 'animate', {
      configurable: true,
      writable: true,
      value: elementAnimate,
    });

    render(
      <LightboxRoot defaultOpen>
        <LightboxTrigger index={0}>open</LightboxTrigger>
        <LightboxPortal>
          <LightboxContent aria-label="nav scrub test">
            <LightboxSlides data-testid="slides" aria-label="Slides">
              {Array.from({ length: 4 }, (_, i) => (
                <LightboxSlide key={i}>
                  <LightboxItem index={i}>item {i}</LightboxItem>
                </LightboxSlide>
              ))}
            </LightboxSlides>
            <LightboxPrevious data-testid="prev" aria-label="Previous" />
            <LightboxNext data-testid="next" aria-label="Next" />
            <LightboxThumbnailStrip data-testid="thumbnail-strip">
              <LightboxThumbnailStripTrack data-testid="thumbnail-strip-track" aria-label="Thumbs">
                {Array.from({ length: 4 }, (_, i) => (
                  <LightboxThumbnail key={i} index={i} data-testid={`thumb-${i}`}>
                    t{i}
                  </LightboxThumbnail>
                ))}
              </LightboxThumbnailStripTrack>
            </LightboxThumbnailStrip>
          </LightboxContent>
        </LightboxPortal>
      </LightboxRoot>,
    );

    const slides = screen.getByTestId('slides');
    setupSlidesGeometry(slides, 4);
    const root = screen.getByTestId('thumbnail-strip');
    const track = screen.getByTestId('thumbnail-strip-track');
    setupThumbnailStripRoot(root);
    setupThumbGeometry(track, 4);
    endScroll(slides);

    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      transform: 'none',
    } as CSSStyleDeclaration);

    await act(async () => {
      fireEvent.click(screen.getByTestId('next'));
      await Promise.resolve();
      await Promise.resolve();
      flushRaf();
      flushRaf();
    });

    expect(screen.getByTestId('thumb-1')).toHaveAttribute('data-active');
    expect(elementAnimate).toHaveBeenCalled();
    expect(scrubPlay).toHaveBeenCalled();
  });

  it('wrapSelectCommit can wrap the active-index commit', async () => {
    const wrapSelectCommit = vi.fn((commit: () => void) => {
      commit();
    });

    render(
      <LightboxRoot defaultOpen>
        <LightboxTrigger index={0}>open</LightboxTrigger>
        <LightboxPortal>
          <LightboxContent aria-label="wrap test">
            <LightboxSlides data-testid="slides" aria-label="Slides">
              {Array.from({ length: 3 }, (_, i) => (
                <LightboxSlide key={i}>
                  <LightboxItem index={i}>item {i}</LightboxItem>
                </LightboxSlide>
              ))}
            </LightboxSlides>
            <LightboxThumbnailStrip
              data-testid="thumbnail-strip"
              selectViewTransition={false}
              wrapSelectCommit={wrapSelectCommit}
            >
              <LightboxThumbnailStripTrack data-testid="thumbnail-strip-track" aria-label="Thumbs">
                {Array.from({ length: 3 }, (_, i) => (
                  <LightboxThumbnail key={i} index={i} data-testid={`thumb-${i}`}>
                    t{i}
                  </LightboxThumbnail>
                ))}
              </LightboxThumbnailStripTrack>
            </LightboxThumbnailStrip>
          </LightboxContent>
        </LightboxPortal>
      </LightboxRoot>,
    );

    const slides = screen.getByTestId('slides');
    setupSlidesGeometry(slides, 3);
    const track = screen.getByTestId('thumbnail-strip-track');
    setupThumbGeometry(track, 3);
    endScroll(slides);

    fireEvent.click(screen.getByTestId('thumb-2'));
    expect(wrapSelectCommit).toHaveBeenCalledWith(expect.any(Function), expect.any(HTMLElement), 2);
    expect(screen.getByTestId('thumb-2')).toHaveAttribute('data-active');
  });

  it('selectViewTransition starts an element-scoped transition on Slides', async () => {
    const startViewTransition = vi.fn((cb: () => void) => {
      cb();
      return { finished: Promise.resolve() };
    });

    render(
      <LightboxRoot defaultOpen>
        <LightboxTrigger index={0}>open</LightboxTrigger>
        <LightboxPortal>
          <LightboxContent aria-label="vt select test">
            <LightboxSlides data-testid="slides" aria-label="Slides">
              {Array.from({ length: 3 }, (_, i) => (
                <LightboxSlide key={i}>
                  <LightboxItem index={i}>item {i}</LightboxItem>
                </LightboxSlide>
              ))}
            </LightboxSlides>
            <LightboxThumbnailStrip data-testid="thumbnail-strip">
              <LightboxThumbnailStripTrack data-testid="thumbnail-strip-track" aria-label="Thumbs">
                {Array.from({ length: 3 }, (_, i) => (
                  <LightboxThumbnail key={i} index={i} data-testid={`thumb-${i}`}>
                    t{i}
                  </LightboxThumbnail>
                ))}
              </LightboxThumbnailStripTrack>
            </LightboxThumbnailStrip>
          </LightboxContent>
        </LightboxPortal>
      </LightboxRoot>,
    );

    const slides = screen.getByTestId('slides');
    Object.defineProperty(slides, 'startViewTransition', {
      configurable: true,
      value: startViewTransition,
    });
    setupSlidesGeometry(slides, 3);
    const track = screen.getByTestId('thumbnail-strip-track');
    setupThumbGeometry(track, 3);
    endScroll(slides);

    fireEvent.click(screen.getByTestId('thumb-2'));
    expect(startViewTransition).toHaveBeenCalledOnce();
    expect(screen.getByTestId('thumb-2')).toHaveAttribute('data-active');
  });

  it('selectViewTransition={false} skips the Slides view transition', async () => {
    const startViewTransition = vi.fn((cb: () => void) => {
      cb();
      return { finished: Promise.resolve() };
    });

    render(
      <LightboxRoot defaultOpen>
        <LightboxTrigger index={0}>open</LightboxTrigger>
        <LightboxPortal>
          <LightboxContent aria-label="no vt select test">
            <LightboxSlides data-testid="slides" aria-label="Slides">
              {Array.from({ length: 3 }, (_, i) => (
                <LightboxSlide key={i}>
                  <LightboxItem index={i}>item {i}</LightboxItem>
                </LightboxSlide>
              ))}
            </LightboxSlides>
            <LightboxThumbnailStrip data-testid="thumbnail-strip" selectViewTransition={false}>
              <LightboxThumbnailStripTrack data-testid="thumbnail-strip-track" aria-label="Thumbs">
                {Array.from({ length: 3 }, (_, i) => (
                  <LightboxThumbnail key={i} index={i} data-testid={`thumb-${i}`}>
                    t{i}
                  </LightboxThumbnail>
                ))}
              </LightboxThumbnailStripTrack>
            </LightboxThumbnailStrip>
          </LightboxContent>
        </LightboxPortal>
      </LightboxRoot>,
    );

    const slides = screen.getByTestId('slides');
    Object.defineProperty(slides, 'startViewTransition', {
      configurable: true,
      value: startViewTransition,
    });
    setupSlidesGeometry(slides, 3);
    const track = screen.getByTestId('thumbnail-strip-track');
    setupThumbGeometry(track, 3);
    endScroll(slides);

    fireEvent.click(screen.getByTestId('thumb-2'));
    expect(startViewTransition).not.toHaveBeenCalled();
    expect(screen.getByTestId('thumb-2')).toHaveAttribute('data-active');
  });

  it('drops thumb navigation while a user scroll/fling is locked', async () => {
    render(<Gallery count={5} />);
    const slides = screen.getByTestId('slides');
    setupSlidesGeometry(slides, 5);
    const track = screen.getByTestId('thumbnail-strip-track');
    setupThumbGeometry(track, 5);

    swipeTo(slides, 1);
    expect(screen.getByTestId('thumb-1')).toHaveAttribute('data-active');

    fireEvent.click(screen.getByTestId('thumb-4'));
    expect(screen.getByTestId('thumb-1')).toHaveAttribute('data-active');
    expect(screen.getByTestId('thumb-4')).not.toHaveAttribute('data-active');

    endScroll(slides);
    await act(async () => {
      fireEvent.click(screen.getByTestId('thumb-4'));
      await Promise.resolve();
    });
    expect(screen.getByTestId('thumb-4')).toHaveAttribute('data-active');
  });
});
