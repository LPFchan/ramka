import { render, screen, fireEvent, act } from '@testing-library/react';
import * as React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { LightboxContent } from './lightbox-content';
import { LightboxFilmstrip } from './lightbox-filmstrip';
import { LightboxFilmstripIndicator } from './lightbox-filmstrip-indicator';
import { LightboxFilmstripTrack } from './lightbox-filmstrip-track';
import { LightboxItem } from './lightbox-item';
import { LightboxPortal } from './lightbox-portal';
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

const FILMSTRIP_WIDTH = 320;

function setupThumbGeometry(track: HTMLElement, count: number) {
  const tabs = track.querySelectorAll<HTMLElement>('[role="tab"]');
  tabs.forEach((tab, i) => {
    Object.defineProperty(tab, 'offsetLeft', {
      configurable: true,
      get: () => i * THUMB_STEP,
    });
    Object.defineProperty(tab, 'offsetWidth', { configurable: true, get: () => THUMB });
  });
  expect(tabs.length).toBe(count);
  flushResizeObservers();
}

function setupFilmstripRoot(root: HTMLElement, width = FILMSTRIP_WIDTH) {
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
        <LightboxContent aria-label="Filmstrip test">
          <LightboxSlides data-testid="slides" aria-label="Slides">
            {Array.from({ length: count }, (_, i) => (
              <LightboxSlide key={i}>
                <LightboxItem index={i}>item {i}</LightboxItem>
              </LightboxSlide>
            ))}
          </LightboxSlides>
          <LightboxFilmstrip data-testid="filmstrip" scrubOnSelect={scrubOnSelect}>
            <LightboxFilmstripTrack data-testid="filmstrip-track" aria-label="Thumbs">
              {Array.from({ length: count }, (_, i) => (
                <LightboxThumbnail key={i} index={i} data-testid={`thumb-${i}`}>
                  t{i}
                </LightboxThumbnail>
              ))}
            </LightboxFilmstripTrack>
            <LightboxFilmstripIndicator data-testid="filmstrip-indicator" />
          </LightboxFilmstrip>
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

describe('Lightbox.Filmstrip', () => {
  it('publishes identity data attrs and registers a tablist', () => {
    render(<Gallery />);
    const slides = screen.getByTestId('slides');
    setupSlidesGeometry(slides, 5);

    const track = screen.getByTestId('filmstrip-track');
    setupThumbGeometry(track, 5);

    expect(screen.getByTestId('filmstrip')).toHaveAttribute('data-ramka-filmstrip');
    expect(track).toHaveAttribute('data-ramka-filmstrip-track');
    expect(track).toHaveAttribute('role', 'tablist');
    expect(screen.getByTestId('filmstrip-indicator')).toHaveAttribute(
      'data-ramka-filmstrip-indicator',
    );
    expect(screen.getByText('item 0').closest('[role="tabpanel"]')).toBeTruthy();
  });

  it('JS fallback mirrors Slides scrollLeft onto the track transform', () => {
    expect(scrollTimelineEnabled).toBe(false);

    render(<Gallery count={5} />);
    const slides = screen.getByTestId('slides');
    setupSlidesGeometry(slides, 5);

    const root = screen.getByTestId('filmstrip');
    const track = screen.getByTestId('filmstrip-track');
    setupFilmstripRoot(root);
    setupThumbGeometry(track, 5);

    expect(readTranslateX(track)).toBe(0);

    swipeTo(slides, 2);
    expect(readTranslateX(track)).toBeCloseTo(-2 * THUMB_STEP, 5);

    swipeTo(slides, 4);
    expect(readTranslateX(track)).toBeCloseTo(-4 * THUMB_STEP, 5);
  });

  it('links the track to Slides via ScrollTimeline when available', () => {
    enableScrollTimeline();

    render(<Gallery count={5} />);
    const slides = screen.getByTestId('slides');
    setupSlidesGeometry(slides, 5);

    const root = screen.getByTestId('filmstrip');
    const track = screen.getByTestId('filmstrip-track');
    setupFilmstripRoot(root);
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
  });

  it('thumb click pauses the ScrollTimeline link during scrub', async () => {
    enableScrollTimeline();

    const scrubPause = vi.fn();
    const scrubPlay = vi.fn();
    const elementAnimate = vi.fn(() => {
      const anim = {
        pause: scrubPause,
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
    setupSlidesGeometry(slides, 5);
    const track = screen.getByTestId('filmstrip-track');
    setupThumbGeometry(track, 5);
    endScroll(slides);

    const link = linkCalls.at(-1);
    expect(link).toBeTruthy();

    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      transform: 'none',
    } as CSSStyleDeclaration);

    await act(async () => {
      fireEvent.click(screen.getByTestId('thumb-3'));
      await Promise.resolve();
    });

    expect(screen.getByTestId('thumb-3')).toHaveAttribute('data-active');
    expect(link!.anim.pause).toHaveBeenCalled();
    expect(elementAnimate).toHaveBeenCalled();
    expect(scrubPause).toHaveBeenCalled();
    expect(scrubPlay).toHaveBeenCalled();
    expect(link!.anim.play).toHaveBeenCalled();
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
            <LightboxFilmstrip data-testid="filmstrip" wrapSelectCommit={wrapSelectCommit}>
              <LightboxFilmstripTrack data-testid="filmstrip-track" aria-label="Thumbs">
                {Array.from({ length: 3 }, (_, i) => (
                  <LightboxThumbnail key={i} index={i} data-testid={`thumb-${i}`}>
                    t{i}
                  </LightboxThumbnail>
                ))}
              </LightboxFilmstripTrack>
            </LightboxFilmstrip>
          </LightboxContent>
        </LightboxPortal>
      </LightboxRoot>,
    );

    const slides = screen.getByTestId('slides');
    setupSlidesGeometry(slides, 3);
    const track = screen.getByTestId('filmstrip-track');
    setupThumbGeometry(track, 3);
    endScroll(slides);

    fireEvent.click(screen.getByTestId('thumb-2'));
    expect(wrapSelectCommit).toHaveBeenCalled();
    expect(screen.getByTestId('thumb-2')).toHaveAttribute('data-active');
  });

  it('drops thumb navigation while a user scroll/fling is locked', async () => {
    render(<Gallery count={5} />);
    const slides = screen.getByTestId('slides');
    setupSlidesGeometry(slides, 5);
    const track = screen.getByTestId('filmstrip-track');
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
