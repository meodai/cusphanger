import { describe, it, expect } from 'vitest';
import { sequential, diverging, qualitative } from './presets';

describe('sequential', () => {
  it('produces count colors with strictly decreasing lightness', () => {
    const p = sequential({ hue: 260, count: 7 });
    expect(p).toHaveLength(7);
    const ls = p.map((c) => c.oklch.l);
    for (let i = 1; i < ls.length; i++) expect(ls[i]!).toBeLessThan(ls[i - 1]!);
  });

  it('peaks chroma in the mid-tones (cusp effect)', () => {
    const p = sequential({ hue: 260, count: 7 });
    const cs = p.map((c) => c.oklch.c);
    const mid = cs[3]!;
    expect(mid).toBeGreaterThan(cs[0]!);
    expect(mid).toBeGreaterThan(cs[cs.length - 1]!);
  });
});

describe('diverging', () => {
  it('has a neutral center for odd counts and mirrored lightness', () => {
    const p = diverging({ hueLeft: 250, hueRight: 30, count: 7 });
    expect(p).toHaveLength(7);
    expect(p[3]!.oklch.c).toBeLessThan(0.02); // center is ~neutral
    const ls = p.map((c) => c.oklch.l);
    expect(ls[0]!).toBeCloseTo(ls[6]!, 4);
    expect(ls[1]!).toBeCloseTo(ls[5]!, 4);
    expect(ls[3]!).toBeGreaterThan(ls[0]!); // center is lightest
  });
});

describe('qualitative', () => {
  it('spreads hues evenly with no first/last collision on a full circle', () => {
    const p = qualitative({ count: 6 });
    expect(p).toHaveLength(6);
    const hues = p.map((c) => c.oklch.h);
    expect(hues[0]!).toBeCloseTo(0, 4);
    expect(hues[1]!).toBeCloseTo(60, 4);
    expect(hues[5]!).toBeCloseTo(300, 4);
  });

  it('uses a shared lightness for all swatches', () => {
    const p = qualitative({ count: 5, lightness: 0.7 });
    expect(p.every((c) => Math.abs(c.oklch.l - 0.7) < 1e-9)).toBe(true);
  });
});
