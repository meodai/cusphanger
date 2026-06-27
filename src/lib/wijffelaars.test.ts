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

  it('hCycles = 0 collapses to a single hue (matches the paper exactly)', () => {
    const base = sequential({ hStart: 260, total: 9 });
    const withCycles0 = sequential({ hStart: 260, total: 9, hCycles: 0 });
    expect(base.every((c) => Math.abs(c.oklch.h - 260) < 1e-9 || c.oklch.c < 1e-9)).toBe(true);
    // identical output to omitting hCycles
    expect(withCycles0.map((c) => c.hex)).toEqual(base.map((c) => c.hex));
  });

  it('hCycles rotates the hue across the ramp (each color in its own hue)', () => {
    const p = sequential({ hStart: 0, total: 9, hCycles: 1, saturation: 0.9 });
    const hues = p.filter((c) => c.oklch.c > 0.02).map((c) => c.oklch.h);
    const spread = Math.max(...hues) - Math.min(...hues);
    expect(spread).toBeGreaterThan(180); // a full cycle visits a wide hue range
  });

  it('cool/warm still warms the light end in a shared triangle mode', () => {
    const opts = { hStart: 264, total: 9, triangleMode: 'min' } as const; // blue base
    const cold = sequential({ ...opts, coolWarm: 0 });
    const warm = sequential({ ...opts, coolWarm: 0.6 });
    // without warmth the hue stays at the base; with it, the light colors shift
    // toward yellow (a lower hue than blue 264)
    expect(cold.every((c) => Math.abs(c.oklch.h - 264) < 1 || c.oklch.c < 1e-6)).toBe(true);
    expect(warm[warm.length - 2]!.oklch.h).toBeLessThan(240);
  });

  it("triangleMode 'min' evens colorfulness (caps chroma below perHue)", () => {
    const opts = { hStart: 0, total: 12, hCycles: 1, saturation: 0.95 } as const;
    const perHue = sequential(opts);
    const min = sequential({ ...opts, triangleMode: 'min' });
    const maxC = (p: ReturnType<typeof sequential>) => Math.max(...p.map((x) => x.oklch.c));
    // a multi-hue ramp visits both low- and high-cusp hues; 'min' holds every
    // color to the least-colorful one, so its peak chroma is clearly lower.
    expect(maxC(min)).toBeLessThan(maxC(perHue));
    // and every color stays in gamut
    expect(
      min.every((x) => inSrgb({ mode: 'oklch', l: x.oklch.l, c: x.oklch.c, h: x.oklch.h })),
    ).toBe(true);
  });
});
