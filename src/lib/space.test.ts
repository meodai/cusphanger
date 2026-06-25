import { describe, it, expect } from 'vitest';
import { inGamut } from 'culori';
import { relativeToOklch, oklchToRelative } from './space';
import { maxChromaAt, cusp, sharedCuspChroma } from './gamut';

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

describe("relativeToOklch chromaMode 'cusp'", () => {
  const hue = 260;
  const peak = cusp(hue, 'srgb');

  it('s=1 at the cusp lightness equals the cusp chroma', () => {
    expect(relativeToOklch(1, peak.l, hue, 'srgb', 'cusp').c).toBeCloseTo(peak.c, 6);
  });

  it('gives constant absolute chroma across lightness for a low s (unlike envelope)', () => {
    // a small fraction of the cusp chroma fits in gamut at both lightnesses,
    // so cusp mode yields the SAME chroma at each — a vertical line in the slice.
    const cuspA = relativeToOklch(0.25, 0.4, hue, 'srgb', 'cusp').c;
    const cuspB = relativeToOklch(0.25, 0.7, hue, 'srgb', 'cusp').c;
    expect(cuspA).toBeCloseTo(0.25 * peak.c, 6);
    expect(cuspB).toBeCloseTo(cuspA, 6);
    // envelope mode, by contrast, differs because maxChroma differs per L
    const envA = relativeToOklch(0.25, 0.4, hue, 'srgb', 'envelope').c;
    const envB = relativeToOklch(0.25, 0.7, hue, 'srgb', 'envelope').c;
    expect(Math.abs(envA - envB)).toBeGreaterThan(1e-3);
  });

  it('clamps to the per-lightness boundary so it stays in gamut at the extremes', () => {
    const l = 0.92; // far from the cusp; cusp chroma exceeds the local boundary here
    const c = relativeToOklch(1, l, hue, 'srgb', 'cusp').c;
    expect(c).toBeCloseTo(maxChromaAt(hue, l, 'srgb'), 6); // clamped to boundary
    expect(inGamut('rgb')({ mode: 'oklch', l, c: c * 0.98, h: hue })).toBe(true);
  });
});

describe("relativeToOklch chromaMode 'shared'", () => {
  it('targets the same absolute chroma for every hue', () => {
    const shared = sharedCuspChroma('srgb');
    const l = 0.6;
    // every hue gets min(s*shared, maxChromaAt) -- at a mid lightness where the
    // boundary exceeds the shared value, all hues land on exactly s*shared.
    for (const hue of [30, 120, 210, 300]) {
      expect(maxChromaAt(hue, l, 'srgb')).toBeGreaterThanOrEqual(0.5 * shared);
      expect(relativeToOklch(0.5, l, hue, 'srgb', 'shared').c).toBeCloseTo(0.5 * shared, 6);
    }
  });

  it('shared chroma is the minimum of the per-hue cusp chromas', () => {
    const shared = sharedCuspChroma('srgb');
    for (const hue of [0, 60, 120, 180, 240, 300]) {
      expect(cusp(hue, 'srgb').c + 1e-9).toBeGreaterThanOrEqual(shared);
    }
  });
});
