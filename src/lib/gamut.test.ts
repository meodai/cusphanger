import { describe, it, expect } from 'vitest';
import { inGamut } from 'culori';
import { maxChromaAt, cusp } from './gamut';

const inSrgb = inGamut('rgb');

describe('maxChromaAt', () => {
  it('is 0 at the extremes of lightness', () => {
    expect(maxChromaAt(120, 0, 'srgb')).toBe(0);
    expect(maxChromaAt(120, 1, 'srgb')).toBe(0);
  });

  it('returns a positive chroma in the mid range', () => {
    expect(maxChromaAt(260, 0.6, 'srgb')).toBeGreaterThan(0.05);
  });

  it('keeps the resulting color inside the sRGB gamut', () => {
    const c = maxChromaAt(30, 0.7, 'srgb');
    // a hair below the boundary must be in gamut
    expect(inSrgb({ mode: 'oklch', l: 0.7, c: c * 0.98, h: 30 })).toBe(true);
  });

  it('allows more chroma in P3 than in sRGB for a saturated hue', () => {
    const srgb = maxChromaAt(150, 0.7, 'srgb');
    const p3 = maxChromaAt(150, 0.7, 'display-p3');
    expect(p3).toBeGreaterThanOrEqual(srgb);
  });
});

describe('cusp', () => {
  it('chroma is >= maxChromaAt at any sampled lightness', () => {
    const peak = cusp(260, 'srgb');
    for (const l of [0.2, 0.4, 0.6, 0.8]) {
      expect(peak.c + 1e-9).toBeGreaterThanOrEqual(maxChromaAt(260, l, 'srgb'));
    }
    expect(peak.l).toBeGreaterThan(0);
    expect(peak.l).toBeLessThan(1);
  });
});
