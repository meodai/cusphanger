import { describe, it, expect } from 'vitest';
import { inGamut } from 'culori';
import { sequential } from './wijffelaars';
import { cusp } from './gamut';

const inSrgb = inGamut('rgb');

describe('sequential (paper, Table 1)', () => {
  it('returns the requested number of colors', () => {
    expect(sequential({ hStart: 260, total: 9 })).toHaveLength(9);
  });

  it('goes dark -> light (strictly increasing lightness)', () => {
    const p = sequential({ hStart: 260, total: 9 });
    const ls = p.map((c) => c.oklch.l);
    for (let i = 1; i < ls.length; i++) expect(ls[i]!).toBeGreaterThan(ls[i - 1]!);
  });

  it('s = 0 is a neutral gray ramp (no chroma)', () => {
    const p = sequential({ hStart: 260, total: 9, saturation: 0 });
    expect(p.every((c) => c.oklch.c < 1e-6)).toBe(true);
  });

  it('s = 1 bends the path through the MSC (reaches ~cusp chroma)', () => {
    const hStart = 260;
    const peak = cusp(hStart, 'srgb');
    const p = sequential({ hStart, total: 13, saturation: 1 });
    const maxC = Math.max(...p.map((c) => c.oklch.c));
    expect(maxC).toBeGreaterThan(peak.c * 0.9);
    expect(maxC).toBeLessThan(peak.c + 1e-6);
  });

  it('stays in gamut by construction (the triangle is inside the gamut)', () => {
    for (const hStart of [30, 120, 210, 300]) {
      const p = sequential({ hStart, total: 9, saturation: 0.8 });
      expect(
        p.every((c) => inSrgb({ mode: 'oklch', l: c.oklch.l, c: c.oklch.c, h: c.oklch.h })),
      ).toBe(true);
    }
  });

  it('default contrast follows the paper: c = min(0.88, 0.34 + 0.06N)', () => {
    // larger N -> more contrast -> darker first color, until the 0.88 cap
    const first = (n: number) => sequential({ hStart: 260, total: n })[0]!.oklch.l;
    expect(first(13)).toBeLessThan(first(3));
  });
});
