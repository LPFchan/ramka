import { afterEach, describe, expect, it } from 'vitest';

import {
  VIEW_TRANSITION_PRESETS,
  isViewTransitionPreset,
  morphTiming,
  resolveViewTransitionTiming,
} from './vt-timing';

describe('vt-timing', () => {
  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).__RAMKA_VT_TIMING__;
    document.documentElement.removeAttribute('data-ramka-vt-preset');
  });

  describe('resolveViewTransitionTiming', () => {
    it('maps true / undefined / unknown strings to the default preset', () => {
      expect(resolveViewTransitionTiming(true)).toBe(VIEW_TRANSITION_PRESETS.default);
      expect(resolveViewTransitionTiming(undefined)).toBe(VIEW_TRANSITION_PRESETS.default);
      expect(
        resolveViewTransitionTiming('bogus' as unknown as 'default'),
      ).toBe(VIEW_TRANSITION_PRESETS.default);
    });

    it('resolves each named preset', () => {
      for (const name of ['default', 'snappy', 'relaxed', 'spring'] as const) {
        expect(resolveViewTransitionTiming(name)).toBe(VIEW_TRANSITION_PRESETS[name]);
      }
    });
  });

  describe('preset table invariants', () => {
    it('every ease is a monotone-endpoint curve from 0 to 1', () => {
      for (const spec of Object.values(VIEW_TRANSITION_PRESETS)) {
        expect(spec.ease(0)).toBe(0);
        expect(spec.ease(1)).toBe(1);
        // Mid-progress stays within a sane range (no wild overshoot).
        const mid = spec.ease(0.5);
        expect(mid).toBeGreaterThan(0);
        expect(mid).toBeLessThan(1.2);
        expect(spec.duration).toBeGreaterThan(0);
        expect(spec.cssEasing).toMatch(/^cubic-bezier\(/);
        expect(spec.cssCrossfadeCloseEasing).toBe('cubic-bezier(0.5, 0, 1, 1)');
      }
    });
  });

  describe('isViewTransitionPreset', () => {
    it('accepts preset names and rejects everything else', () => {
      expect(isViewTransitionPreset('spring')).toBe(true);
      expect(isViewTransitionPreset('default')).toBe(true);
      expect(isViewTransitionPreset(true)).toBe(false);
      expect(isViewTransitionPreset('bounce')).toBe(false);
      expect(isViewTransitionPreset(null)).toBe(false);
    });
  });

  describe('morphTiming precedence', () => {
    it('falls back to the default preset', () => {
      const t = morphTiming();
      expect(t.duration).toBe(VIEW_TRANSITION_PRESETS.default.duration);
    });

    it('reads the promoted preset attribute', () => {
      document.documentElement.setAttribute('data-ramka-vt-preset', 'relaxed');
      const t = morphTiming();
      expect(t.duration).toBe(VIEW_TRANSITION_PRESETS.relaxed.duration);
    });

    it('prefers the __RAMKA_VT_TIMING__ debug override over the preset', () => {
      document.documentElement.setAttribute('data-ramka-vt-preset', 'relaxed');
      (window as unknown as Record<string, unknown>).__RAMKA_VT_TIMING__ = '500,.5,0,.15,1';
      const t = morphTiming();
      expect(t.duration).toBe(500);
      expect(t.label).toContain('cubic-bezier(.5,0,.15,1)');
    });

    it('ignores malformed debug overrides', () => {
      (window as unknown as Record<string, unknown>).__RAMKA_VT_TIMING__ = 'not-a-timing';
      const t = morphTiming();
      expect(t.duration).toBe(VIEW_TRANSITION_PRESETS.default.duration);
    });
  });
});
