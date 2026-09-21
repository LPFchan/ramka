import { afterEach, describe, expect, it } from 'vitest';

import {
  CAPTURE_YIELD_MIN_ELEMENTS,
  afterNextRenderFrame,
  shouldYieldBeforeCapture,
} from './vt-capture-yield';

/**
 * The pre-capture rAF yield is heavy-documents-only — on small pages it would
 * only add latency (see vt-capture-yield.ts). Engine-agnostic: relocating the
 * capture out of the input task helps every engine's INP.
 */
describe('shouldYieldBeforeCapture', () => {
  let filler: HTMLDivElement | null = null;

  afterEach(() => {
    filler?.remove();
    filler = null;
  });

  /** Grow the document past (or keep it under) the element-count gate. */
  function addElements(count: number) {
    filler = document.createElement('div');
    for (let i = 0; i < count; i++) {
      filler.appendChild(document.createElement('span'));
    }
    document.body.appendChild(filler);
  }

  it('is false for a small document', () => {
    expect(shouldYieldBeforeCapture()).toBe(false);
  });

  it('is true once the document crosses the element-count gate', () => {
    addElements(CAPTURE_YIELD_MIN_ELEMENTS + 100);
    expect(shouldYieldBeforeCapture()).toBe(true);
  });

  it('is false without a document (SSR)', () => {
    expect(shouldYieldBeforeCapture(undefined)).toBe(false);
  });
});

describe('afterNextRenderFrame', () => {
  it('resolves after one rAF with frames: 1 and two with frames: 2', async () => {
    let frames = 0;
    const count = () => {
      frames += 1;
      requestAnimationFrame(count);
    };
    requestAnimationFrame(count);

    await afterNextRenderFrame(1);
    const afterOne = frames;
    expect(afterOne).toBeGreaterThanOrEqual(1);

    await afterNextRenderFrame(2);
    expect(frames).toBeGreaterThanOrEqual(afterOne + 2);
  });
});
