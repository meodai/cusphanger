import { describe, it, expect } from 'vitest';
import { inGamut } from 'culori';
import { oklchSrgb } from 'nutelch';
import { sequential } from './wijffelaars';
import { cusp } from './gamut';

const lut = oklchSrgb;
const inSrgb = inGamut('rgb');

describe('sequential (paper, Table 1)', () => {
  it('returns the requested number of colors', () => {
    expect(sequential({ hStart: 260, total: 9, lut })).toHaveLength(9);
  });

  it('goes dark -> light (strictly increasing lightness)', () => {
    const p = sequential({ hStart: 260, total: 9, lut });
    const ls = p.map((c) => c.l);
    for (let i = 1; i < ls.length; i++) expect(ls[i]!).toBeGreaterThan(ls[i - 1]!);
  });

  it('s = 0 is a neutral gray ramp (no chroma)', () => {
    const p = sequential({ hStart: 260, total: 9, saturation: 0, lut });
    expect(p.every((c) => c.c < 1e-6)).toBe(true);
  });

  it('s = 1 bends the path through the MSC (reaches ~cusp chroma)', () => {
    const hStart = 260;
    const peak = cusp(hStart, lut);
    const p = sequential({ hStart, total: 13, saturation: 1, lut });
    const maxC = Math.max(...p.map((c) => c.c));
    expect(maxC).toBeGreaterThan(peak.c * 0.9);
    expect(maxC).toBeLessThan(peak.c + 1e-6);
  });

  it('stays in gamut by construction (the triangle is inside the gamut)', () => {
    for (const hStart of [30, 120, 210, 300]) {
      const p = sequential({ hStart, total: 9, saturation: 0.8, lut });
      expect(p.every((c) => inSrgb(c))).toBe(true);
    }
  });

  it('default contrast follows the paper: c = min(0.88, 0.34 + 0.06N)', () => {
    const first = (n: number) => sequential({ hStart: 260, total: n, lut })[0]!.l;
    expect(first(13)).toBeLessThan(first(3));
  });

  it('sRange varies the tension across the ramp (and equals saturation when flat)', () => {
    const single = sequential({ hStart: 260, total: 9, saturation: 0.5, lut });
    const flat = sequential({ hStart: 260, total: 9, sRange: [0.5, 0.5], lut });
    expect(flat).toEqual(single);

    const rising = sequential({ hStart: 260, total: 9, sRange: [0, 1], lut });
    const falling = sequential({ hStart: 260, total: 9, sRange: [1, 0], lut });
    expect(rising[0]!.c).toBeLessThan(falling[0]!.c);
    expect(rising.at(-1)!.c).toBeGreaterThan(falling.at(-1)!.c);
  });

  it('lRange sets the lightness endpoints directly', () => {
    const p = sequential({ hStart: 260, total: 9, lRange: [0.25, 0.95], lut });
    expect(p[0]!.l).toBeCloseTo(0.25, 2);
    expect(p[p.length - 1]!.l).toBeCloseTo(0.95, 2);
  });

  it('lRange and brightness/contrast are the same parameterization', () => {
    const bc = sequential({ hStart: 260, total: 9, brightness: 0.7, contrast: 0.8, lut });
    const lo = bc[0]!.l;
    const hi = bc[bc.length - 1]!.l;
    const viaRange = sequential({ hStart: 260, total: 9, lRange: [lo, hi], lut });
    viaRange.forEach((col, i) => expect(col.l).toBeCloseTo(bc[i]!.l, 4));
  });

  it('hCycles = 0 collapses to a single hue (matches the paper exactly)', () => {
    const base = sequential({ hStart: 260, total: 9, lut });
    const withCycles0 = sequential({ hStart: 260, total: 9, hCycles: 0, lut });
    expect(base.every((c) => Math.abs(c.h - 260) < 1e-9 || c.c < 1e-9)).toBe(true);
    expect(withCycles0).toEqual(base);
  });

  it('hCycles rotates the hue across the ramp (each color in its own hue)', () => {
    const p = sequential({ hStart: 0, total: 9, hCycles: 1, saturation: 0.9, lut });
    const hues = p.filter((c) => c.c > 0.02).map((c) => c.h);
    const spread = Math.max(...hues) - Math.min(...hues);
    expect(spread).toBeGreaterThan(180);
  });

  it('cool/warm still warms the light end in a shared triangle mode', () => {
    const opts = { hStart: 264, total: 9, triangleMode: 'min', lut } as const;
    const cold = sequential({ ...opts, coolWarm: 0 });
    const warm = sequential({ ...opts, coolWarm: 0.6 });
    expect(cold.every((c) => Math.abs(c.h - 264) < 1 || c.c < 1e-6)).toBe(true);
    expect(warm[warm.length - 2]!.h).toBeLessThan(240);
  });

  it("triangleMode 'min' evens colorfulness (caps chroma below perHue)", () => {
    const opts = { hStart: 0, total: 12, hCycles: 1, saturation: 0.95, lut } as const;
    const perHue = sequential(opts);
    const min = sequential({ ...opts, triangleMode: 'min' });
    const maxC = (p: ReturnType<typeof sequential>) => Math.max(...p.map((x) => x.c));
    expect(maxC(min)).toBeLessThan(maxC(perHue));
    expect(min.every((x) => inSrgb(x))).toBe(true);
  });
});
