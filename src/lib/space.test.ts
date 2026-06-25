import { describe, it, expect } from 'vitest';
import { relativeToOklch, oklchToRelative } from './space';
import { maxChromaAt } from './gamut';

describe('relativeToOklch', () => {
  it('s=1 lands at the gamut max chroma', () => {
    const max = maxChromaAt(260, 0.6, 'srgb');
    expect(relativeToOklch(1, 0.6, 260, 'srgb').c).toBeCloseTo(max, 6);
  });

  it('s=0 is neutral', () => {
    expect(relativeToOklch(0, 0.6, 260, 'srgb').c).toBe(0);
  });

  it('round-trips through oklchToRelative', () => {
    const color = relativeToOklch(0.7, 0.55, 120, 'srgb');
    const rel = oklchToRelative(color, 'srgb');
    expect(rel.s).toBeCloseTo(0.7, 6);
    expect(rel.l).toBeCloseTo(0.55, 6);
  });
});
