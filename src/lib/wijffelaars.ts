import { cusp, maxChromaAt } from './gamut';
import { toPaletteColor, oklchOf } from './color';
import type { Gamut, PaletteColor, SequentialOptions, DivergingOptions } from './types';

// Faithful port of Wijffelaars, Vliegen, van Wijk & van der Linden (2008),
// "Generating Color Palettes using Intuitive Parameters" (Computer Graphics
// Forum 27:3), Tables 1 (single-hue sequential) and 2 (multi-hue), re-expressed
// in OKLCH. The paper works in CIELUV; MSC(h) — the Most Saturated Color of a
// hue — is exactly the OKLCH cusp. The triangle (black, MSC, white) is an inner
// approximation of the gamut, so the Bézier path through it stays in gamut.
//
// Deviations from the paper (all intentional, documented):
// - OKLCH instead of CIELUV (so it can target Display-P3); L is [0,1] not [0,100].
// - L(t) keeps the paper's exact form, divided by 100 for OKLCH's scale.

interface LCH {
  l: number;
  c: number;
  h: number; // degrees, may be unwrapped (kept near the base hue for interpolation)
}

// quadratic Bézier and its inverse (Table 1)
const bez = (b0: number, b1: number, b2: number, t: number) =>
  (1 - t) * (1 - t) * b0 + 2 * (1 - t) * t * b1 + t * t * b2;

const bezInv = (b0: number, b1: number, b2: number, v: number): number => {
  const d = b0 - 2 * b1 + b2;
  if (Math.abs(d) < 1e-12) return (v - b0) / (b2 - b0 || 1e-12); // degenerate -> linear
  return (b0 - b1 + Math.sqrt(Math.max(0, b1 * b1 - b0 * b2 + d * v))) / d;
};

const mixP = (a: LCH, b: LCH, s: number): LCH => ({
  l: (1 - s) * a.l + s * b.l,
  c: (1 - s) * a.c + s * b.c,
  h: (1 - s) * a.h + s * b.h,
});
const midP = (a: LCH, b: LCH): LCH => ({ l: (a.l + b.l) / 2, c: (a.c + b.c) / 2, h: (a.h + b.h) / 2 });

// L(t): the paper's lightness sampling (its '0.2^…' contrast curve), mapped to
// OKLCH's [0,1] lightness scale.
const lightnessAt = (t: number, b: number, c: number): number => {
  const luv = 125 - 125 * Math.pow(0.2, (1 - c) * b + t * c);
  return Math.min(1, Math.max(0, luv / 100));
};

// S_max: the triangle (linear) approximation of the max chroma at lightness l
// for hue h' — the chroma along the black→MSC or MSC→white edge (Table 2).
function triangleChromaAt(l: number, hue: number, gamut: Gamut): number {
  const peak = cusp(hue, gamut);
  if (l <= peak.l) return peak.l <= 0 ? 0 : (l / peak.l) * peak.c;
  return peak.l >= 1 ? 0 : ((1 - l) / (1 - peak.l)) * peak.c;
}

interface Tri {
  p0: LCH;
  q0: LCH;
  q1: LCH;
  q2: LCH;
  p2: LCH;
}

function buildTriangle(hue: number, s: number, w: number, gamut: Gamut): Tri {
  const peak = cusp(hue, gamut);
  const p0: LCH = { l: 0, c: 0, h: hue }; // black
  const p1: LCH = { l: peak.l, c: peak.c, h: hue }; // MSC(h)

  // top point p2 — white, or shifted toward the bright point (yellow) for w > 0
  let p2: LCH;
  if (w > 0) {
    const pb = oklchOf('#ffff00'); // bright point (yellow), Table 2 default
    const M = ((((180 + pb.h - hue) % 360) + 360) % 360) - 180; // shortest hue path
    const p2L = (1 - w) * 1 + w * pb.l;
    const p2H = hue + w * M;
    const p2C = Math.min(triangleChromaAt(p2L, ((p2H % 360) + 360) % 360, gamut), w * s * pb.c);
    p2 = { l: p2L, c: p2C, h: p2H };
  } else {
    p2 = { l: 1, c: 0, h: hue }; // white
  }

  const q0 = mixP(p0, p1, s); // (1-s)p0 + s·MSC
  const q2 = mixP(p2, p1, s); // (1-s)p2 + s·MSC
  const q1 = midP(q0, q2);
  return { p0, q0, q1, q2, p2 };
}

// A hue-agnostic triangle from a given cusp (L, C) — used by the shared
// triangleMode where every color rides the same (min/avg/max) triangle.
function buildTriangleFromCusp(cuspL: number, cuspC: number, s: number): Tri {
  const p0: LCH = { l: 0, c: 0, h: 0 };
  const p1: LCH = { l: cuspL, c: cuspC, h: 0 };
  const p2: LCH = { l: 1, c: 0, h: 0 };
  const q0 = mixP(p0, p1, s);
  const q2 = mixP(p2, p1, s);
  const q1 = midP(q0, q2);
  return { p0, q0, q1, q2, p2 };
}

// C_seq(t): two quadratic Béziers, black→…→MSC→…→white
function cSeq(t: number, tri: Tri): LCH {
  const { p0, q0, q1, q2, p2 } = tri;
  if (t <= 0.5) {
    const u = 2 * t;
    return {
      l: bez(p0.l, q0.l, q1.l, u),
      c: bez(p0.c, q0.c, q1.c, u),
      h: bez(p0.h, q0.h, q1.h, u),
    };
  }
  const u = 2 * (t - 0.5);
  return {
    l: bez(q1.l, q2.l, p2.l, u),
    c: bez(q1.c, q2.c, p2.c, u),
    h: bez(q1.h, q2.h, p2.h, u),
  };
}

// T(ℓ): curve parameter for a target lightness (invert the L-component)
function tForLightness(l: number, tri: Tri): number {
  const { p0, q0, q1, q2, p2 } = tri;
  const u = l <= q1.l ? 0.5 * bezInv(p0.l, q0.l, q1.l, l) : 0.5 * bezInv(q1.l, q2.l, p2.l, l) + 0.5;
  return Math.min(1, Math.max(0, u));
}

// Single-hue (or cool/warm multi-hue) sequential palette, dark → light.
// With hCycles ≠ 0, each color is the paper's ramp for its own rotated hue.
export function sequential(o: SequentialOptions): PaletteColor[] {
  const {
    hStart,
    total: N,
    saturation: s = 0.6,
    brightness: b = 0.75,
    coolWarm: w = 0,
    hCycles = 0,
    hStartCenter = 0.5,
    hEasing = (t) => t,
    triangleMode = 'perHue',
    gamut = 'srgb',
  } = o;
  const c = o.contrast ?? Math.min(0.88, 0.34 + 0.06 * N);
  const hueAt = (t: number) => hStart + 360 * hCycles * (hEasing(t) - hStartCenter);

  // 'min'/'avg'/'max' share one triangle across the ramp's hues, so colorfulness
  // is even (no chroma peaks). It's built from the min/avg/max cusp of those
  // hues; each color keeps its own hue. cool/warm (w) only applies in 'perHue'.
  let sharedTri: Tri | null = null;
  let sharedCuspL = 0;
  if (triangleMode !== 'perHue') {
    const cusps: Array<{ l: number; c: number }> = [];
    for (let i = 0; i < N; i++) {
      const t = N <= 1 ? 0 : i / (N - 1);
      cusps.push(cusp(((hueAt(t) % 360) + 360) % 360, gamut));
    }
    let sc: { l: number; c: number };
    if (triangleMode === 'min') sc = cusps.reduce((a, p) => (p.c < a.c ? p : a));
    else if (triangleMode === 'max') sc = cusps.reduce((a, p) => (p.c > a.c ? p : a));
    else {
      const n = cusps.length || 1;
      sc = {
        l: cusps.reduce((sum, p) => sum + p.l, 0) / n,
        c: cusps.reduce((sum, p) => sum + p.c, 0) / n,
      };
    }
    sharedCuspL = sc.l;
    sharedTri = buildTriangleFromCusp(sc.l, sc.c, s);
  }

  // shared modes overlay each color's own hue, so cool/warm can't shift the
  // triangle toward yellow. Instead it nudges the light colors' hues toward the
  // bright point — the same "only the light end warms" behaviour as the paper.
  const warmHue = sharedTri && w > 0 ? oklchOf('#ffff00').h : null;

  // single hue (perHue + hCycles 0) -> build the triangle once
  const baseTri = !sharedTri && hCycles === 0 ? buildTriangle(hStart, s, w, gamut) : null;

  const out: PaletteColor[] = [];
  for (let i = 0; i < N; i++) {
    const t = N <= 1 ? 0 : i / (N - 1);
    const tri = sharedTri ?? baseTri ?? buildTriangle(hueAt(t), s, w, gamut);
    const targetL = Math.min(tri.p2.l, Math.max(tri.p0.l, lightnessAt(t, b, c)));
    const col = cSeq(tForLightness(targetL, tri), tri);

    let h: number;
    if (sharedTri) {
      h = ((hueAt(t) % 360) + 360) % 360;
      if (warmHue !== null) {
        // weight 0 below the shared cusp, ramping to 1 at white (the top point)
        const warmW = Math.max(0, Math.min(1, (col.l - sharedCuspL) / (1 - sharedCuspL || 1)));
        const M = ((((warmHue - h) % 360) + 540) % 360) - 180; // shortest signed delta to yellow
        h = (((h + w * warmW * M) % 360) + 360) % 360;
      }
    } else {
      h = ((col.h % 360) + 360) % 360; // perHue: the curve already carries the warm shift
    }

    // the straight triangle edges can poke just outside the real OKLCH gamut;
    // clamp chroma to the boundary (the paper's "little clamping").
    const c2 = Math.min(Math.max(0, col.c), maxChromaAt(h, col.l, gamut));
    out.push(toPaletteColor({ l: col.l, c: c2, h }, gamut));
  }
  return out;
}

// Diverging: two sequential palettes concatenated through a shared neutral point
// (the paper's construction).
export function diverging(o: DivergingOptions): PaletteColor[] {
  const { hStart, hEnd, total: N, gamut = 'srgb' } = o;
  const isOdd = N % 2 === 1;
  const side = Math.floor(N / 2); // saturated colors per arm (excluding the center)
  const common = {
    total: side + 1,
    saturation: o.saturation,
    brightness: o.brightness,
    contrast: o.contrast,
    coolWarm: o.coolWarm,
    gamut,
  };
  // each arm is dark(saturated) -> light(neutral); the last entry is the neutral center
  const left = sequential({ hStart, ...common });
  const right = sequential({ hStart: hEnd, ...common });
  const center = left[side]!; // the shared light/neutral point

  return [
    ...left.slice(0, side), // dark left -> toward center
    ...(isOdd ? [center] : []),
    ...right.slice(0, side).reverse(), // center -> dark right
  ];
}
