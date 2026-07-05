import { describe, it, expect } from 'vitest';
import { oklchSrgb } from 'nutelch';
import { sequential, ramp, diverging } from './wijffelaars';
import { cusp, maxChromaAt } from './gamut';

const lut = oklchSrgb;
// construction invariant: a color never exceeds the gamut shell it targets.
// (We assert against the same nutelch LUT the lib clamps to — nutelch's accuracy
// vs culori is checked separately in gamut.test.)
const withinShell = (c: { l: number; c: number; h: number }) =>
  c.c <= maxChromaAt(c.h, c.l, lut) + 1e-9;

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
      expect(p.every(withinShell)).toBe(true);
    }
  });

  it('default contrast follows the paper: c = min(0.88, 0.34 + 0.06N)', () => {
    const first = (n: number) => sequential({ hStart: 260, total: n, lut })[0]!.l;
    expect(first(13)).toBeLessThan(first(3));
  });

  it("maps the paper's CIELUV lightness to OKLCH via Y, not /100", () => {
    // paper defaults, N=9 (b=0.75, c=0.88): L*(0)=16.86, L*(1)=98.76.
    // For neutrals OKLab L = Y^(1/3) and L* = 116·Y^(1/3) − 16, so the faithful
    // OKLab endpoints are (L*+16)/116 — computed independently of the lib.
    const p = sequential({ hStart: 260, total: 9, lut });
    expect(p[0]!.l).toBeCloseTo(0.28324, 4);
    expect(p[p.length - 1]!.l).toBeCloseTo(0.98934, 4);
  });

  it('lRange endpoints survive the round trip through the CIE toe (L* < 8)', () => {
    // OKLab L 0.03 → Y = 2.7e-5 → L* ≈ 0.024: exercises the linear CIE branch.
    const p = sequential({ hStart: 260, total: 9, lRange: [0.03, 0.9], lut });
    expect(p[0]!.l).toBeCloseTo(0.03, 3);
    expect(p[p.length - 1]!.l).toBeCloseTo(0.9, 3);
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

});

describe('ramp (RampenSau extensions)', () => {
  it('with no extensions set, collapses to sequential() exactly', () => {
    const base = sequential({ hStart: 260, total: 9, lut });
    const viaRamp = ramp({ hStart: 260, total: 9, hCycles: 0, lut });
    expect(base.every((c) => Math.abs(c.h - 260) < 1e-9 || c.c < 1e-9)).toBe(true);
    expect(viaRamp).toEqual(base);
  });

  it('sRange varies the tension across the ramp (and equals saturation when flat)', () => {
    const single = sequential({ hStart: 260, total: 9, saturation: 0.5, lut });
    const flat = ramp({ hStart: 260, total: 9, sRange: [0.5, 0.5], lut });
    expect(flat).toEqual(single);

    const rising = ramp({ hStart: 260, total: 9, sRange: [0, 1], lut });
    const falling = ramp({ hStart: 260, total: 9, sRange: [1, 0], lut });
    expect(rising[0]!.c).toBeLessThan(falling[0]!.c);
    expect(rising.at(-1)!.c).toBeGreaterThan(falling.at(-1)!.c);
  });

  it('hCycles rotates the hue across the ramp (each color in its own hue)', () => {
    const p = ramp({ hStart: 0, total: 9, hCycles: 1, saturation: 0.9, lut });
    const hues = p.filter((c) => c.c > 0.02).map((c) => c.h);
    const spread = Math.max(...hues) - Math.min(...hues);
    expect(spread).toBeGreaterThan(180);
  });

  it('cool/warm still warms the light end in a shared triangle mode', () => {
    const opts = { hStart: 264, total: 9, triangleMode: 'min', lut } as const;
    const cold = ramp({ ...opts, coolWarm: 0 });
    const warm = ramp({ ...opts, coolWarm: 0.6 });
    expect(cold.every((c) => Math.abs(c.h - 264) < 1 || c.c < 1e-6)).toBe(true);
    expect(warm[warm.length - 2]!.h).toBeLessThan(240);
  });

  it("triangleMode 'min' evens colorfulness (caps chroma below perHue)", () => {
    const opts = { hStart: 0, total: 12, hCycles: 1, saturation: 0.95, lut } as const;
    const perHue = ramp(opts);
    const min = ramp({ ...opts, triangleMode: 'min' });
    const maxC = (p: ReturnType<typeof ramp>) => Math.max(...p.map((x) => x.c));
    expect(maxC(min)).toBeLessThan(maxC(perHue));
    expect(min.every(withinShell)).toBe(true);
  });
});

// shortest signed hue difference, for wrap-safe comparisons
const hueDiff = (a: number, b: number) => ((((a - b) % 360) + 540) % 360) - 180;

describe('diverging (paper §4.6, two arms through a combined neutral)', () => {
  it('returns N colors, dark at the ends, lightest in the middle', () => {
    const p = diverging({ hStart: 250, hEnd: 30, total: 9, lut });
    expect(p).toHaveLength(9);
    const ls = p.map((c) => c.l);
    expect(Math.max(...ls)).toBe(ls[4]);
    expect(ls[0]).toBe(Math.min(...ls));
  });

  it("odd N: one shared center at the arm curve's end, L(1)", () => {
    // arm total 5 → b = 0.75, c = 0.64; L*(1) → OKLab 0.96641 (computed
    // independently from the CIE formulas).
    const p = diverging({ hStart: 250, hEnd: 30, total: 9, lut });
    expect(p[4]!.l).toBeCloseTo(0.96641, 4);
  });

  it('even N: middles sit half a step from the neutral (joined-curve sampling)', () => {
    // The joined diverging curve sampled at i/(N−1) puts each arm at u = 2i/(N−1).
    // For N=8 the middle colors sit at u = 6/7 → OKLab L 0.92692 (independent CIE
    // math) — NOT at the discrete arm step u = 0.75 → 0.89324, which leaves a
    // double-width gap across the join.
    const p = diverging({ hStart: 250, hEnd: 30, total: 8, lut });
    expect(p[3]!.l).toBeCloseTo(0.92692, 4);
    expect(p[4]!.l).toBeCloseTo(0.92692, 4);
  });

  it('is mirror-symmetric: swapping hStart/hEnd reverses the palette (incl. coolWarm)', () => {
    for (const total of [8, 9]) {
      const ab = diverging({ hStart: 250, hEnd: 30, total, coolWarm: 0.4, lut });
      const ba = diverging({ hStart: 30, hEnd: 250, total, coolWarm: 0.4, lut }).reverse();
      ab.forEach((c, i) => {
        expect(c.l).toBeCloseTo(ba[i]!.l, 6);
        expect(c.c).toBeCloseTo(ba[i]!.c, 6);
        if (c.c > 1e-6) expect(hueDiff(c.h, ba[i]!.h)).toBeCloseTo(0, 4);
      });
    }
  });

  it('stays in gamut for both parities, with and without coolWarm', () => {
    for (const total of [8, 9]) {
      for (const w of [0, 0.5]) {
        const p = diverging({ hStart: 250, hEnd: 30, total, coolWarm: w, lut });
        expect(p.every(withinShell)).toBe(true);
      }
    }
  });
});

describe('hueList (RampenSau parity)', () => {
  it('gives each color its own hue, in order', () => {
    const p = ramp({ hStart: 0, total: 3, hueList: [10, 120, 240], lut });
    expect(p.map((c) => c.h)).toEqual([10, 120, 240]);
  });

  it('overrides total, hStart and hCycles (like RampenSau)', () => {
    const p = ramp({ hStart: 99, total: 9, hCycles: 2, hueList: [10, 120, 240], lut });
    expect(p).toHaveLength(3);
    expect(p.map((c) => c.h)).toEqual([10, 120, 240]);
  });

  it('keeps the paper lightness sampling and stays in gamut', () => {
    const p = ramp({ hStart: 0, total: 4, hueList: [30, 100, 200, 320], lut });
    for (let i = 1; i < p.length; i++) expect(p[i]!.l).toBeGreaterThan(p[i - 1]!.l);
    expect(p.every(withinShell)).toBe(true);
  });
});

describe('diverging option passthrough', () => {
  it('honors sEasing alongside sRange (was silently dropped)', () => {
    const base = { hStart: 250, hEnd: 30, total: 9, sRange: [0, 1] as [number, number], lut };
    const linear = diverging(base);
    const eased = diverging({ ...base, sEasing: (t: number) => t * t });
    expect(eased[1]!.c).not.toBeCloseTo(linear[1]!.c, 6);
  });
});
