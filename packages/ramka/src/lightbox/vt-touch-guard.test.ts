import { describe, expect, it } from 'vitest';

import { acquireVtTouchGuard } from './vt-touch-guard';

// jsdom has no TouchEvent constructor — build plain events carrying the one
// TouchList-ish field the guard reads (`touches.length`).
function touchEvent(type: string, options: { cancelable?: boolean; touches?: number } = {}) {
  const event = new Event(type, {
    bubbles: true,
    cancelable: options.cancelable ?? true,
  });
  Object.defineProperty(event, 'touches', {
    value: { length: options.touches ?? 0 },
  });
  return event;
}

function dispatchTouchMove(cancelable = true): boolean {
  const event = touchEvent('touchmove', { cancelable, touches: 1 });
  document.dispatchEvent(event);
  return event.defaultPrevented;
}

describe('acquireVtTouchGuard', () => {
  it('does nothing before acquisition', () => {
    expect(dispatchTouchMove()).toBe(false);
  });

  it('prevents cancelable touchmove while held, stops after release', () => {
    const release = acquireVtTouchGuard();
    expect(dispatchTouchMove()).toBe(true);
    release();
    expect(dispatchTouchMove()).toBe(false);
  });

  it('leaves non-cancelable touchmove alone (already-committed scroll)', () => {
    const release = acquireVtTouchGuard();
    expect(dispatchTouchMove(false)).toBe(false);
    release();
  });

  it('is ref-counted across overlapping morphs', () => {
    const releaseA = acquireVtTouchGuard();
    const releaseB = acquireVtTouchGuard();
    releaseA();
    expect(dispatchTouchMove()).toBe(true);
    releaseB();
    expect(dispatchTouchMove()).toBe(false);
  });

  it('release is idempotent', () => {
    const releaseA = acquireVtTouchGuard();
    const releaseB = acquireVtTouchGuard();
    releaseA();
    releaseA();
    // A double release must not steal B's hold.
    expect(dispatchTouchMove()).toBe(true);
    releaseB();
    expect(dispatchTouchMove()).toBe(false);
  });

  it('defers teardown while a finger is still down, detaches on final touchend', () => {
    const release = acquireVtTouchGuard();
    document.dispatchEvent(touchEvent('touchstart', { touches: 1 }));
    release();
    // Gesture still in flight — its moves must stay swallowed.
    expect(dispatchTouchMove()).toBe(true);
    // One finger lifts but another remains — keep guarding.
    document.dispatchEvent(touchEvent('touchend', { touches: 1 }));
    expect(dispatchTouchMove()).toBe(true);
    // Last finger lifts — guard detaches.
    document.dispatchEvent(touchEvent('touchend', { touches: 0 }));
    expect(dispatchTouchMove()).toBe(false);
  });

  it('touchcancel also completes a deferred teardown', () => {
    const release = acquireVtTouchGuard();
    document.dispatchEvent(touchEvent('touchstart', { touches: 1 }));
    release();
    document.dispatchEvent(touchEvent('touchcancel', { touches: 0 }));
    expect(dispatchTouchMove()).toBe(false);
  });

  it('a touch ending while still held does not tear the guard down', () => {
    const release = acquireVtTouchGuard();
    document.dispatchEvent(touchEvent('touchstart', { touches: 1 }));
    document.dispatchEvent(touchEvent('touchend', { touches: 0 }));
    expect(dispatchTouchMove()).toBe(true);
    release();
    expect(dispatchTouchMove()).toBe(false);
  });
});
