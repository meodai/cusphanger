import { describe, it, expect } from 'vitest';
import { inGamut, converter } from 'culori';
import { lchuvSrgb, lchuvP3, lchSrgb, lchP3, oklchSrgb, toCss, type Lut } from 'nutelch';
import { hctSrgb, hctP3, hctToRgb, toCss as hctToCss } from 'nutelch/hct';
import { sequential, ramp, diverging, fromColor, spaceOf, type PaletteColor } from './index';
import { lightnessAt } from './wijffelaars';
import { cusp, maxChromaAt } from './gamut';

// The L*-based spaces — LCHuv (the paper's CIELUV), CIE LCH and HCT (tone = L*)
// — run the model natively: L on 0..100 and L(t) is the paper's formula verbatim.

// "is this color displayable in <gamut>?" per space, with a chroma margin for
// the LUT's own tolerance (nutelch measures each LUT against the true shell).
const displayable = (col: PaletteColor, p3: boolean): boolean => {
  const shrunk = { ...col, c: col.c * 0.97 };
  if (col.mode === 'hct') {
    const { r, g, b } = hctToRgb(shrunk, p3 ? 'display-p3' : 'srgb');
    return [r, g, b].every((v) => v >= -1e-3 && v <= 1 + 1e-3);
  }
  return inGamut(p3 ? 'p3' : 'rgb')(shrunk);
};

const CASES: Array<{ name: string; mode: PaletteColor['mode']; srgb: Lut; p3: Lut }> = [
  { name: 'LCHuv', mode: 'lchuv', srgb: lchuvSrgb, p3: lchuvP3 },
  { name: 'CIE LCH', mode: 'lch', srgb: lchSrgb, p3: lchP3 },
  { name: 'HCT', mode: 'hct', srgb: hctSrgb, p3: hctP3 },
];

describe.each(CASES)('$name', ({ mode, srgb: lut, p3 }) => {
  const withinShell = (c: PaletteColor, l = lut) => c.c <= maxChromaAt(c.h, c.l, l) + 1e-9;

  it(`returns ${mode} colors with L on 0..100, dark → light`, () => {
    const pal = sequential({ hStart: 260, total: 9, lut });
    expect(pal.every((c) => c.mode === mode)).toBe(true);
    for (let i = 1; i < pal.length; i++) expect(pal[i]!.l).toBeGreaterThan(pal[i - 1]!.l);
    expect(pal[pal.length - 1]!.l).toBeGreaterThan(50); // the 0..100 scale, not 0..1
    expect(pal[pal.length - 1]!.l).toBeLessThanOrEqual(100);
  });

  it('L(t) is the paper’s formula exactly: 125 − 125·0.2^((1−c)·b + t·c)', () => {
    const sp = spaceOf(lut);
    for (const [t, b, c] of [[0, 0.75, 0.88], [0.5, 0.75, 0.88], [1, 0.3, 0.6]] as const) {
      const x = (1 - c) * b + t * c;
      expect(lightnessAt(t, b, c, sp)).toBeCloseTo(125 - 125 * Math.pow(0.2, x), 12);
    }
  });

  it('stays within the LUT shell and displayable in sRGB', () => {
    for (const hStart of [30, 150, 210, 300]) {
      for (const col of sequential({ hStart, total: 9, saturation: 0.9, lut })) {
        expect(withinShell(col)).toBe(true);
        expect(displayable(col, false)).toBe(true);
      }
    }
  });

  it('s = 1 reaches the cusp; P3 reaches further than sRGB', () => {
    const peak = cusp(150, lut);
    const maxC = Math.max(...sequential({ hStart: 150, total: 13, saturation: 1, lut }).map((c) => c.c));
    expect(maxC).toBeGreaterThan(peak.c * 0.9);
    const wide = sequential({ hStart: 150, total: 13, saturation: 1, lut: p3 });
    expect(Math.max(...wide.map((c) => c.c))).toBeGreaterThan(maxC);
    for (const col of wide) expect(displayable(col, true)).toBe(true);
  });

  it('coolWarm, ramp and diverging stay in the space and the shell', () => {
    const cw = sequential({ hStart: 260, total: 9, coolWarm: 0.5, lut });
    const r = ramp({ hStart: 30, total: 11, hCycles: 0.5, triangleMode: 'min', coolWarm: 0.3, lut });
    const d = diverging({ hStart: 250, hEnd: 30, total: 11, lut });
    for (const col of [...cw, ...r, ...d]) {
      expect(col.mode).toBe(mode);
      expect(withinShell(col)).toBe(true);
    }
    expect(d[5]!.c).toBeLessThan(5); // near-neutral center, on a 0..100-ish chroma scale
  });

  it('lRange is in L* units and pins the endpoints', () => {
    const pal = sequential({ hStart: 200, total: 7, lRange: [20, 90], lut });
    expect(pal[0]!.l).toBeCloseTo(20, 6);
    expect(pal[6]!.l).toBeCloseTo(90, 6);
  });

  it('fromColor meets a target given in the same space', () => {
    const target = { mode, l: 55, c: 30, h: 150 };
    const res = fromColor(target, { total: 9, lut });
    expect(res.clamped).toBe(false);
    const hit = sequential(res.options)[res.index]!;
    expect(hit.mode).toBe(mode);
    expect(hit.l).toBeCloseTo(55, 6);
    expect(hit.c).toBeCloseTo(30, 4);
  });

  it('fromColor rejects a target in another space', () => {
    expect(() => fromColor({ mode: 'oklch', l: 0.6, c: 0.1, h: 150 }, { total: 9, lut })).toThrow(mode);
  });

  it('renders to CSS through nutelch (nutelch/hct’s toCss handles every mode)', () => {
    const col = sequential({ hStart: 260, total: 5, lut })[2]!;
    const css = hctToCss(col);
    expect(css).toMatch(mode === 'hct' ? /^oklch\(/ : /^lch\(/);
    if (mode !== 'hct') expect(toCss(col)).toBe(css); // the core toCss agrees on lch/lchuv
  });
});

describe('LCHuv specifics', () => {
  it('its lch() output is the same color (round-trips through culori)', () => {
    const col = sequential({ hStart: 260, total: 5, lut: lchuvSrgb })[2]!;
    const back = converter('lchuv')(toCss(col)) as { l: number; c: number };
    expect(back.l).toBeCloseTo(col.l, 1);
    expect(back.c).toBeCloseTo(col.c, 0);
  });
});

describe('space support', () => {
  it('OKLCH LUTs still produce oklch colors', () => {
    expect(sequential({ hStart: 260, total: 3, lut: oklchSrgb })[0]!.mode).toBe('oklch');
  });

  it('a LUT in an unsupported space is rejected clearly', () => {
    const alien = { ...oklchSrgb, mode: 'xyz' } as unknown as Lut;
    expect(() => sequential({ hStart: 260, total: 3, lut: alien })).toThrow(/unsupported LUT mode 'xyz'/);
  });
});
