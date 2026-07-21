import { describe, expect, it } from 'vitest';

import { shouldUseCrossfade } from './use-view-transition-morph';

describe('shouldUseCrossfade', () => {
  it('is false when unset (hard-cut both directions)', () => {
    expect(shouldUseCrossfade(undefined, 'opening')).toBe(false);
    expect(shouldUseCrossfade(undefined, 'closing')).toBe(false);
  });

  it('crossfades both directions for "both"', () => {
    expect(shouldUseCrossfade('both', 'opening')).toBe(true);
    expect(shouldUseCrossfade('both', 'closing')).toBe(true);
  });

  it('crossfades only on open for "open"', () => {
    expect(shouldUseCrossfade('open', 'opening')).toBe(true);
    expect(shouldUseCrossfade('open', 'closing')).toBe(false);
  });

  it('crossfades only on close for "close"', () => {
    expect(shouldUseCrossfade('close', 'opening')).toBe(false);
    expect(shouldUseCrossfade('close', 'closing')).toBe(true);
  });
});
