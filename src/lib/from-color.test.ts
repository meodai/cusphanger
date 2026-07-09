import { describe, it, expect } from 'vitest';
import { oklchSrgb, oklchP3 } from 'nutelch';
import type { Lut } from 'nutelch';
import { fromColor, sequential, buildTriangle, cSeq, tForLightness } from './wijffelaars';
import { cusp, maxChromaAt } from './gamut';
import type { OklchColor } from './types';

const lut = oklchSrgb;
const oklch = (l: number, c: number, h: number): OklchColor => ({ mode: 'oklch', l, c, h });

// the solver's reachable ceiling, recomputed independently: under the
// triangle edge AND the gamut shell
const reachAt = (l: number, h: number, target: Lut): number => {
  const peak = cusp(h, target);
  const edge = l <= peak.l ? (l / peak.l) * peak.c : ((1 - l) / (1 - peak.l)) * peak.c;
  return Math.min(edge, maxChromaAt(h, l, target));
};

const expectMeets = (got: OklchColor, want: OklchColor) => {
  expect(got.l).toBeCloseTo(want.l, 6);
  expect(got.c).toBeCloseTo(want.c, 6);
  expect(got.h).toBeCloseTo(((want.h % 360) + 360) % 360, 6);
};

describe('fromColor (inverse solve)', () => {
  it('the indexed sample IS the target (reachable case)', () => {
    const target = oklch(0.62, 0.11, 152);
    const res = fromColor(target, { total: 9, lut });
    expect(res.clamped).toBe(false);
    expectMeets(res.color, target);
    const p = sequential(res.options);
    expectMeets(p[res.index]!, target);
  });

  it('meets in-triangle targets exactly across hues and lightnesses', () => {
    for (const h of [30, 120, 210, 300]) {
      for (const l of [0.25, 0.5, 0.75]) {
        const target = oklch(l, 0.6 * reachAt(l, h, lut), h);
        const res = fromColor(target, { total: 7, lut });
        expect(res.clamped).toBe(false);
        expect(res.options.saturation!).toBeGreaterThanOrEqual(0);
        expect(res.options.saturation!).toBeLessThanOrEqual(1);
        expectMeets(sequential(res.options)[res.index]!, target);
      }
    }
  });

  it('a gray target solves to s ≈ 0 (the paper: s = 0 is the gray ramp)', () => {
    const res = fromColor(oklch(0.5, 0, 40), { total: 9, lut });
    expect(res.options.saturation!).toBeLessThan(1e-9);
    const p = sequential(res.options);
    expect(p[res.index]!.l).toBeCloseTo(0.5, 6);
    expect(p[res.index]!.c).toBeLessThan(1e-9);
  });

  it('unreachable chroma clamps to the boundary and says so — no throw', () => {
    const l = 0.45;
    const h = 200;
    const reach = reachAt(l, h, lut);
    const res = fromColor(oklch(l, reach * 2, h), { total: 9, lut });
    expect(res.clamped).toBe(true);
    expect(res.color.c).toBeLessThanOrEqual(reach + 1e-9);
    expect(res.color.l).toBe(l); // lightness and hue are preserved by the clamp
    expect(res.color.h).toBe(h);
    expectMeets(sequential(res.options)[res.index]!, res.color);
  });

  it('an explicit index pins which sample carries the target', () => {
    const target = oklch(0.4, 0.08, 20);
    for (const index of [0, 4, 8]) {
      const res = fromColor(target, { total: 9, lut, index });
      expect(res.index).toBe(index);
      expectMeets(sequential(res.options)[res.index]!, target);
    }
  });

  it('stays exact when the held endpoint has to yield (light target, dark index)', () => {
    // sample 1 of 9 forced onto a very light color: the default light end is
    // in the way, so both endpoints move — the meet must survive the fallback
    const target = oklch(0.9, 0.8 * reachAt(0.9, 260, lut), 260);
    const res = fromColor(target, { total: 9, lut, index: 1 });
    expectMeets(sequential(res.options)[1]!, target);
  });

  it('a held lRange is kept verbatim; the continuous curve still meets the target', () => {
    const target = oklch(0.55, 0.1, 152);
    const lRange: [number, number] = [0.2, 0.95];
    const res = fromColor(target, { total: 9, lut, lRange });
    expect(res.options.lRange).toEqual(lRange);
    const tri = buildTriangle(res.options.hStart, res.options.saturation!, 0, lut);
    const onCurve = cSeq(tForLightness(target.l, tri), tri);
    expect(onCurve.c).toBeCloseTo(target.c, 6);
  });

  it("'nearest' matches the default spacing's closest sample", () => {
    // paper defaults, N=9: the darkest sample sits at L ≈ 0.283 — a target
    // right there must pick index 0, a near-white one the last index
    expect(fromColor(oklch(0.283, 0.05, 260), { total: 9, lut }).index).toBe(0);
    expect(fromColor(oklch(0.98, 0.01, 260), { total: 9, lut }).index).toBe(8);
  });

  it('targets beyond sRGB resolve in P3 when the P3 LUT is passed', () => {
    const l = 0.6;
    const h = 145;
    const target = oklch(l, 0.9 * reachAt(l, h, oklchP3), h);
    const res = fromColor(target, { total: 9, lut: oklchP3 });
    expect(res.clamped).toBe(false);
    expectMeets(sequential(res.options)[res.index]!, target);
  });

  it('palette colors stay within the target shell (construction invariant)', () => {
    const res = fromColor(oklch(0.7, 0.12, 80), { total: 11, lut });
    for (const col of sequential(res.options)) {
      expect(col.c).toBeLessThanOrEqual(maxChromaAt(col.h, col.l, lut) + 1e-9);
    }
  });
});
