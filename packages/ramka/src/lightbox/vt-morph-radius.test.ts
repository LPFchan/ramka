import { describe, expect, it } from 'vitest';

import {
  compensatedMorphRadiusAt,
  parseMorphRadiusList,
  type MorphRadiusCorners,
} from './vt-morph-radius';

function parseLocal(css: string): { h: number; v: number } {
  const [hList, vList] = css.split('/').map((s) => s.trim());
  return {
    h: Number.parseFloat(hList!),
    v: Number.parseFloat((vList ?? hList)!),
  };
}

/** On-screen corner radius implied by the frozen-box local value. */
function visualAt(
  css: string,
  box: { w: number; h: number; w1: number; h1: number },
): { h: number; v: number } {
  const local = parseLocal(css);
  return { h: (local.h * box.w) / box.w1, v: (local.v * box.h) / box.h1 };
}

const uniform = (r: number): MorphRadiusCorners => [r, r, r, r];

describe('parseMorphRadiusList', () => {
  it('expands a single px token to four corners', () => {
    expect(parseMorphRadiusList('28px')).toEqual([28, 28, 28, 28]);
  });

  it('keeps a four-corner list', () => {
    expect(parseMorphRadiusList('16px 16px 160px 160px')).toEqual([16, 16, 160, 160]);
  });
});

describe('compensatedMorphRadiusAt', () => {
  // Stories close: 1.75rem stage (28px on ~400×711) → 56px rounded-full (28px).
  const close = {
    w0: 400,
    h0: 711,
    w1: 56,
    h1: 56,
  };

  it('preserves the from radius at q=0', () => {
    const box = { ...close, w: close.w0, h: close.h0 };
    const visual = visualAt(
      compensatedMorphRadiusAt(uniform(28), uniform(28), 0, box),
      box,
    );
    expect(visual.h).toBeCloseTo(28, 2);
    expect(visual.v).toBeCloseTo(28, 2);
  });

  it('preserves the to radius at q=1', () => {
    const box = { ...close, w: close.w1, h: close.h1 };
    const visual = visualAt(
      compensatedMorphRadiusAt(uniform(28), uniform(28), 1, box),
      box,
    );
    expect(visual.h).toBeCloseTo(28, 2);
    expect(visual.v).toBeCloseTo(28, 2);
  });

  it('morphs roundness toward a circle mid-close instead of holding 28px', () => {
    const w = (close.w0 + close.w1) / 2;
    const h = (close.h0 + close.h1) / 2;
    const box = { ...close, w, h };
    const visual = visualAt(
      compensatedMorphRadiusAt(uniform(28), uniform(28), 0.5, box),
      box,
    );

    // Absolute-px lerp would stay ~28px on this still-large box (a rectangle).
    expect(visual.h).toBeGreaterThan(50);
    // Size-relative: lerp(28/400, 28/56, 0.5) * min(w,h).
    const expected = (28 / 400 + 28 / 56) / 2 * Math.min(w, h);
    expect(visual.h).toBeCloseTo(expected, 3);
    expect(visual.v).toBeCloseTo(expected, 3);
  });

  it('stays a circle when both ends are pills', () => {
    const box = { w0: 64, h0: 64, w: 64, h: 64, w1: 64, h1: 64 };
    const visual = visualAt(
      compensatedMorphRadiusAt(uniform(32), uniform(32), 0.5, box),
      box,
    );
    expect(visual.h).toBeCloseTo(32, 3);
  });
});
