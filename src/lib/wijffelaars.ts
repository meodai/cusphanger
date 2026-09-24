import { cusp, maxChromaAt } from './gamut';
import { spaceOf, type Space } from './space';
import type {
  Lut,
  PaletteColor,
  SequentialOptions,
  RampOptions,
  DivergingOptions,
  FromColorOptions,
  FromColorResult,
} from './types';

// Faithful port of Wijffelaars, Vliegen, van Wijk & van der Linden (2008),
// "Generating Color Palettes using Intuitive Parameters" (Computer Graphics
// Forum 27:3, EuroVis 2008, doi:10.1111/j.1467-8659.2008.01203.x),
// Tables 1 (single-hue sequential) and 2 (multi-hue), run in the space of the
// caller's nutelch LUT (see ./space). MSC(h) — the Most Saturated Color of a
// hue — is exactly that space's cusp. The triangle (black, MSC, white) is an
// inner approximation of the gamut, so the Bézier path through it stays in gamut.
//
// - LCHuv LUTs: the paper's own space (CIELUV), so the model is the paper's.
// - OKLCH LUTs (a deliberate deviation): L is [0,1] not [0,100], and L(t) keeps
//   the paper's exact form in CIE L* units, converted to OKLab L through Y (for
//   neutrals OKLab L = Y^(1/3) exactly), so the palette hits the same physical
//   lightnesses the paper calibrated on Brewer.
// Either space targets sRGB or Display-P3, whichever the LUT is for.

export interface LCH {
  l: number;
  c: number;
  h: number; // degrees, may be unwrapped (kept near the base hue for interpolation)
}

// quadratic Bézier and its inverse (Table 1)
const bez = (b0: number, b1: number, b2: number, t: number) =>
  (1 - t) * (1 - t) * b0 + 2 * (1 - t) * t * b1 + t * t * b2;

const bezInv = (b0: number, b1: number, b2: number, v: number): number => {
  const d = b0 - 2 * b1 + b2;
  if (Math.abs(d) < 1e-12) return (v - b0) / (b2 - b0 || 1e-12);
  return (b0 - b1 + Math.sqrt(Math.max(0, b1 * b1 - b0 * b2 + d * v))) / d;
};

const mixP = (a: LCH, b: LCH, s: number): LCH => ({
  l: (1 - s) * a.l + s * b.l,
  c: (1 - s) * a.c + s * b.c,
  h: (1 - s) * a.h + s * b.h,
});
const midP = (a: LCH, b: LCH): LCH => ({ l: (a.l + b.l) / 2, c: (a.c + b.c) / 2, h: (a.h + b.h) / 2 });

// L(x): the lightness the paper's curve yields for exponent x. L(t) below is
// L(x) on the affine exponent x(t) = (1−c)·b + t·c; x lives in [0, 1] (x = 0
// is black, x = 1 is white), which is what fromColor's endpoint solve rides on.
const lightnessFromX = (x: number, sp: Space): number => {
  const lStar = 125 - 125 * Math.pow(0.2, x);
  return Math.min(sp.lMax, Math.max(0, sp.fromLstar(lStar)));
};

// L(t): the paper's lightness sampling (its '0.2^…' contrast curve, in CIE L*
// units), in the space's native lightness.
export const lightnessAt = (t: number, b: number, c: number, sp: Space): number =>
  lightnessFromX((1 - c) * b + t * c, sp);

// Inverse of L(t)'s curve: the exponent x that yields a given native lightness.
const lightnessToX = (L: number, sp: Space): number => {
  const lStar = sp.toLstar(Math.min(sp.lMax, Math.max(0, L)));
  return Math.log(1 - lStar / 125) / Math.log(0.2);
};

// Convert an [minLight, maxLight] range into the paper's (b, c), so lRange and
// brightness/contrast are two views of the same lightness curve (the 0.2^x
// perceptual spacing between the endpoints is identical either way).
export function bcFromLRange([a, z]: [number, number], sp: Space): { b: number; c: number } {
  const xMin = lightnessToX(Math.min(a, z), sp);
  const xMax = lightnessToX(Math.max(a, z), sp);
  const c = Math.max(0, Math.min(1, xMax - xMin));
  const b = c >= 1 ? 0 : xMin / (1 - c);
  return { b, c };
}

// S_max: the triangle (linear) approximation of the max chroma at lightness l
// for hue h' — the chroma along the black→MSC or MSC→white edge (Table 2).
function triangleChromaAt(l: number, hue: number, lut: Lut): number {
  const peak = cusp(hue, lut);
  const top = lut.lMax;
  if (l <= peak.l) return peak.l <= 0 ? 0 : (l / peak.l) * peak.c;
  return peak.l >= top ? 0 : ((top - l) / (top - peak.l)) * peak.c;
}

export interface Tri {
  p0: LCH;
  p1: LCH; // the cusp / MSC corner (not a curve control point)
  q0: LCH;
  q1: LCH;
  q2: LCH;
  p2: LCH;
}

export function buildTriangle(hue: number, s: number, w: number, lut: Lut): Tri {
  const { lMax, brightPoint: pb } = spaceOf(lut);
  const peak = cusp(hue, lut);
  const p0: LCH = { l: 0, c: 0, h: hue };
  const p1: LCH = { l: peak.l, c: peak.c, h: hue };

  // top point p2 — white, or shifted toward the bright point (yellow) for w > 0
  let p2: LCH;
  if (w > 0) {
    const M = ((((180 + pb.h - hue) % 360) + 360) % 360) - 180; // shortest hue path
    const p2L = (1 - w) * lMax + w * pb.l;
    const p2H = hue + w * M;
    const p2C = Math.min(triangleChromaAt(p2L, ((p2H % 360) + 360) % 360, lut), w * s * pb.c);
    p2 = { l: p2L, c: p2C, h: p2H };
  } else {
    p2 = { l: lMax, c: 0, h: hue };
  }

  const q0 = mixP(p0, p1, s);
  const q2 = mixP(p2, p1, s);
  const q1 = midP(q0, q2);
  return { p0, p1, q0, q1, q2, p2 };
}

// A hue-agnostic triangle from a given cusp (L, C) — used by the shared
// triangleMode where every color rides the same (min/avg/max) triangle.
function buildTriangleFromCusp(cuspL: number, cuspC: number, s: number, lMax: number): Tri {
  const p0: LCH = { l: 0, c: 0, h: 0 };
  const p1: LCH = { l: cuspL, c: cuspC, h: 0 };
  const p2: LCH = { l: lMax, c: 0, h: 0 };
  const q0 = mixP(p0, p1, s);
  const q2 = mixP(p2, p1, s);
  const q1 = midP(q0, q2);
  return { p0, p1, q0, q1, q2, p2 };
}

// C_seq(t): two quadratic Béziers, black→…→MSC→…→white
export function cSeq(t: number, tri: Tri): LCH {
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
export function tForLightness(l: number, tri: Tri): number {
  const { p0, q0, q1, q2, p2 } = tri;
  const u = l <= q1.l ? 0.5 * bezInv(p0.l, q0.l, q1.l, l) : 0.5 * bezInv(q1.l, q2.l, p2.l, l) + 0.5;
  return Math.min(1, Math.max(0, u));
}

// Single-hue (or cool/warm multi-hue) sequential palette, dark → light —
// the paper's model, exactly (lEasing, the one opt-in, only moves the samples
// along its lightness curve). For hue trajectories / hueList / triangleMode
// (the RampenSau-style extensions) use ramp().
export function sequential(o: SequentialOptions): PaletteColor[] {
  const N = o.total;
  const ts = Array.from({ length: N }, (_, i) => (N <= 1 ? 0 : i / (N - 1)));
  return sample(o, ts);
}

// The RampenSau hybrid: each color is the paper's sequential ramp evaluated at
// its own hue along a RampenSau-style trajectory (hCycles/hEasing or an
// explicit hueList), optionally with ramped tension (sRange) and a shared
// chroma envelope (triangleMode). With none of the extensions set this is
// sequential() exactly.
export function ramp(o: RampOptions): PaletteColor[] {
  // hueList overrides total (RampenSau semantics); defaults derive from the
  // effective palette size.
  const N = o.hueList && o.hueList.length > 0 ? o.hueList.length : o.total;
  const ts = Array.from({ length: N }, (_, i) => (N <= 1 ? 0 : i / (N - 1)));
  return sample(N === o.total ? o : { ...o, total: N }, ts);
}

// lEasing applied to ascending curve-fractions: clamped to [0, 1] and kept
// non-decreasing, so ordering survives a bad easing.
function easeTs(ts: number[], lEasing: (t: number) => number): number[] {
  let prev = 0;
  return ts.map((t) => (prev = Math.max(prev, Math.min(1, Math.max(0, lEasing(t))))));
}

// The paper's P_seq sampled at arbitrary curve-fractions `ts` (each t ∈ [0,1]).
// sequential()/ramp() use the uniform grid i/(N−1); diverging() samples each
// arm at the joined-curve positions. Defaults still derive from o.total.
function sample(o: RampOptions, ts: number[]): PaletteColor[] {
  const {
    hStart,
    total: N,
    coolWarm: w = 0,
    hCycles = 0,
    hStartCenter = 0.5,
    hEasing = (t) => t,
    hueList,
    sEasing = (t) => t,
    lEasing = (t) => t,
    triangleMode = 'perHue',
    lut,
  } = o;
  const sp = spaceOf(lut);
  let b: number;
  let c: number;
  if (o.lRange) {
    ({ b, c } = bcFromLRange(o.lRange, sp));
  } else {
    b = o.brightness ?? 0.75;
    c = o.contrast ?? Math.min(0.88, 0.34 + 0.06 * N);
  }
  const sBase = o.saturation ?? 0.6;
  const sConst = !o.sRange;
  const sAt = (t: number): number =>
    sConst ? sBase : o.sRange![0] + (o.sRange![1] - o.sRange![0]) * sEasing(t);

  const hasHueList = !!hueList && hueList.length > 0;
  const hueAt = (t: number, i: number) =>
    hasHueList
      ? hueList![Math.min(i, hueList!.length - 1)]!
      : hStart + 360 * hCycles * (hEasing(t) - hStartCenter);

  // 'min'/'avg'/'max' share one triangle across the ramp's hues, so colorfulness
  // is even (no chroma peaks). The shared cusp is the min/avg/max cusp of those
  // hues; each color keeps its own hue. cool/warm (w) only applies in 'perHue'.
  let sharedCusp: { l: number; c: number } | null = null;
  let sharedCuspL = 0;
  if (triangleMode !== 'perHue') {
    const cusps: Array<{ l: number; c: number }> = [];
    ts.forEach((t, i) => {
      cusps.push(cusp(((hueAt(t, i) % 360) + 360) % 360, lut));
    });
    if (triangleMode === 'min') sharedCusp = cusps.reduce((a, p) => (p.c < a.c ? p : a));
    else if (triangleMode === 'max') sharedCusp = cusps.reduce((a, p) => (p.c > a.c ? p : a));
    else {
      const n = cusps.length || 1;
      sharedCusp = {
        l: cusps.reduce((sum, p) => sum + p.l, 0) / n,
        c: cusps.reduce((sum, p) => sum + p.c, 0) / n,
      };
    }
    sharedCuspL = sharedCusp.l;
  }
  const isShared = sharedCusp !== null;

  // shared modes overlay each color's own hue, so cool/warm can't shift the
  // triangle toward yellow. Instead it nudges the light colors' hues toward the
  // bright point — the same "only the light end warms" behaviour as the paper.
  const warmHue = isShared && w > 0 ? sp.brightPoint.h : null;

  // build the triangle once when nothing varies it (constant s + single hue);
  // otherwise it is rebuilt per color (sRange and/or hCycles).
  const sharedTri =
    isShared && sConst ? buildTriangleFromCusp(sharedCusp!.l, sharedCusp!.c, sBase, sp.lMax) : null;
  const baseTri =
    !isShared && hCycles === 0 && !hasHueList && sConst
      ? buildTriangle(hStart, sBase, w, lut)
      : null;

  const tLs = easeTs(ts, lEasing);
  const out: PaletteColor[] = [];
  for (const [i, t] of ts.entries()) {
    const sI = sAt(t);
    const tri =
      sharedTri ??
      baseTri ??
      (isShared
        ? buildTriangleFromCusp(sharedCusp!.l, sharedCusp!.c, sI, sp.lMax)
        : buildTriangle(hueAt(t, i), sI, w, lut));
    const targetL = Math.min(tri.p2.l, Math.max(tri.p0.l, lightnessAt(tLs[i]!, b, c, sp)));
    const col = cSeq(tForLightness(targetL, tri), tri);

    let h: number;
    if (isShared) {
      h = ((hueAt(t, i) % 360) + 360) % 360;
      if (warmHue !== null) {
        // weight 0 below the shared cusp, ramping to 1 at white (the top point)
        const warmW = Math.max(0, Math.min(1, (col.l - sharedCuspL) / (sp.lMax - sharedCuspL || 1)));
        const M = ((((warmHue - h) % 360) + 540) % 360) - 180; // shortest signed delta to yellow
        h = (((h + w * warmW * M) % 360) + 360) % 360;
      }
    } else {
      h = ((col.h % 360) + 360) % 360; // perHue: the curve already carries the warm shift
    }

    // the straight triangle edges can poke just outside the real gamut; clamp
    // chroma to the boundary (the paper's "little clamping").
    const c2 = Math.min(Math.max(0, col.c), maxChromaAt(h, col.l, lut));
    out.push({ mode: sp.mode, l: col.l, c: c2, h });
  }
  return out;
}

const DEG = Math.PI / 180;

// Diverging: two sequential arms joined through a combined neutral point (the
// paper's construction). The joined curve is sampled at i/(N−1), i.e. each arm
// at u = 2i/(N−1): odd N hits the neutral exactly once, even N straddles it at
// half-step spacing (uniform steps across the join, per the thesis). lEasing
// eases each arm's u (0 = dark end, 1 = neutral), mirrored — so a non-linear
// one trades that uniform step across the join for its own spacing.
export function diverging(o: DivergingOptions): PaletteColor[] {
  const { hStart, hEnd, total: N, lut } = o;
  const { mode } = spaceOf(lut);
  const isOdd = N % 2 === 1;
  const side = Math.floor(N / 2); // saturated colors per arm (excluding the center)
  const common = {
    total: side + 1,
    saturation: o.saturation,
    sRange: o.sRange,
    sEasing: o.sEasing,
    lEasing: o.lEasing,
    brightness: o.brightness,
    contrast: o.contrast,
    lRange: o.lRange,
    coolWarm: o.coolWarm,
    lut,
  };

  const armTs = Array.from({ length: side }, (_, i) => (2 * i) / (N - 1));
  const ts = isOdd ? [...armTs, 1] : armTs; // odd N: sample the neutral too
  const left = sample({ hStart, ...common }, ts);
  const right = sample({ hStart: hEnd, ...common }, ts);

  // Combined neutral (odd N): the Cartesian mean of the two arms' endpoints, so
  // it is symmetric in the arms — near-achromatic at w = 0 (the arms' residual
  // opposite-hue tints cancel), converging on the bright point as w → 1.
  let center: PaletteColor[] = [];
  if (isOdd) {
    const a = left[side]!;
    const b = right[side]!;
    const x = (a.c * Math.cos(a.h * DEG) + b.c * Math.cos(b.h * DEG)) / 2;
    const y = (a.c * Math.sin(a.h * DEG) + b.c * Math.sin(b.h * DEG)) / 2;
    const h = ((Math.atan2(y, x) / DEG) % 360 + 360) % 360;
    const l = (a.l + b.l) / 2;
    const c = Math.min(Math.hypot(x, y), maxChromaAt(h, l, lut));
    center = [{ mode, l, c, h }];
  }

  return [...left.slice(0, side), ...center, ...right.slice(0, side).reverse()];
}

// fromColor(): the inverse problem — find the sequential model that meets a
// given color. The constraints decouple: hue is exact (at w = 0 the whole
// curve lives in the target's hue plane, so hStart = target.h), tension is a
// monotone 1D root-find (as s goes 0 → 1 the curve sweeps from the gray axis
// out to the triangle edges, so its chroma at the target's lightness only
// grows — bisect), and the lightness endpoints then shift so that sample
// `index` lands on the target's lightness exactly. Returns options for
// sequential(), not colors, so the solve stays inspectable and tweakable.
// coolWarm is deliberately absent: w > 0 drifts hue along the curve, which
// breaks the hue decoupling (meeting a color under w would be a 2D solve).

// Shift the lightness exponents [x0, x1] (endpoints of x(t), see lightnessAt)
// as little as possible so the sample at fraction t lands on xT: move the
// endpoint on the target's side, hold the other — and when the held one is in
// the way (target outside the current span) it yields too, pinned at black
// (x = 0) or white (x = 1). Every branch satisfies (1−t)·x0 + t·x1 = xT
// exactly; x and xT living in [0, 1] keeps a solution reachable always.
function solveXEnds(x0: number, x1: number, t: number, xT: number): [number, number] {
  if (t <= 0) return [xT, Math.max(xT, x1)];
  if (t >= 1) return [Math.min(x0, xT), xT];
  if (t <= 0.5) {
    const a = (xT - t * x1) / (1 - t);
    if (a < 0) return [0, xT / t]; // a < 0 ⇒ xT < t·x1 ⇒ xT/t < x1 ≤ 1
    if (a <= x1) return [a, x1];
    const z = (xT - (1 - t) * x0) / t; // a > x1 ⇒ target above the held light end
    return z <= 1 ? [x0, z] : [(xT - t) / (1 - t), 1];
  }
  const z = (xT - (1 - t) * x0) / t;
  if (z > 1) return [(xT - t) / (1 - t), 1]; // z > 1 ⇒ xT > t ⇒ x0 stays in [0, 1]
  if (z >= x0) return [x0, z];
  const a = (xT - t * x1) / (1 - t); // z < x0 ⇒ target below the held dark end
  return a >= 0 ? [a, x1] : [0, xT / t];
}

export function fromColor(target: PaletteColor, opts: FromColorOptions): FromColorResult {
  const { total: N, lut } = opts;
  const sp = spaceOf(lut);
  if (target.mode !== sp.mode) {
    throw new Error(
      `cusphanger: fromColor target is '${target.mode}' but the LUT is '${sp.mode}' — ` +
        `convert the color to the LUT's space first (e.g. culori's converter('${sp.mode}'))`,
    );
  }
  const h = ((target.h % 360) + 360) % 360;
  const l = Math.min(sp.lMax, Math.max(0, target.l));
  // reachable chroma at (l, h): under the triangle edge (the curve's own
  // ceiling) AND the real shell (sample()'s "little clamping" would take back
  // anything past it) — the sliver between edge and shell is out of reach.
  const reach = Math.min(triangleChromaAt(l, h, lut), maxChromaAt(h, l, lut));
  const c = Math.min(Math.max(0, target.c), reach);
  const clamped = target.c - c > 1e-9 || l !== target.l;

  const chromaAt = (s: number): number => {
    const tri = buildTriangle(h, s, 0, lut);
    return cSeq(tForLightness(l, tri), tri).c;
  };
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2;
    if (chromaAt(mid) < c) lo = mid;
    else hi = mid;
  }
  const saturation = (lo + hi) / 2;

  let b: number;
  let con: number;
  if (opts.lRange) {
    ({ b, c: con } = bcFromLRange(opts.lRange, sp));
  } else {
    b = 0.75;
    con = Math.min(0.88, 0.34 + 0.06 * N);
  }
  const tLs = easeTs(
    Array.from({ length: N }, (_, i) => (N <= 1 ? 0 : i / (N - 1))),
    opts.lEasing ?? ((t) => t),
  );
  const tOf = (i: number) => tLs[i]!;
  let index: number;
  if (typeof opts.index === 'number') {
    index = Math.min(N - 1, Math.max(0, Math.round(opts.index)));
  } else {
    index = 0;
    let best = Infinity;
    for (let i = 0; i < N; i++) {
      const d = Math.abs(lightnessAt(tOf(i), b, con, sp) - l);
      if (d < best) {
        best = d;
        index = i;
      }
    }
  }

  // a held lRange is kept verbatim (the continuous curve still meets the
  // target; the sample only lands near it) — otherwise nudge the endpoints so
  // sample `index` hits the target's lightness exactly.
  let lRange: [number, number];
  if (opts.lRange) {
    lRange = opts.lRange;
  } else {
    const x0 = (1 - con) * b;
    const [a, z] = solveXEnds(x0, x0 + con, tOf(index), lightnessToX(l, sp));
    lRange = [lightnessFromX(a, sp), lightnessFromX(z, sp)];
  }

  return {
    options: {
      total: N, hStart: h, saturation, lRange,
      ...(opts.lEasing ? { lEasing: opts.lEasing } : {}),
      lut,
    },
    index,
    color: { mode: sp.mode, l, c, h },
    clamped,
  };
}
