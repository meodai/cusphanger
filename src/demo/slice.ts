import { type OklchColor } from '../lib/index';
import { maxChromaAt, cusp } from './gamut';
import { oklchP3, type Lut } from 'nutelch';
import { css } from './color';

const gamutTag = (lut: Lut) => (lut === oklchP3 ? 'p3' : 'srgb');

// Side view of the OKLCH gamut slice (chroma x lightness). With a single hue it
// shows one (chroma vs lightness) cross-section; when the palette's start and
// end hue differ it mirrors into a butterfly: start hue on the left, end hue on
// the right, sharing the central lightness axis.

const W = 400;
const H = 400;
const PAD = { l: 48, r: 16, t: 26, b: 32 };
const PLOT_H = H - PAD.t - PAD.b;

const f = (n: number) => n.toFixed(2);
const Y = (L: number) => PAD.t + (1 - L) * PLOT_H;
const fmtPts = (pts: Array<[number, number]>) => pts.map(([x, y]) => `${f(x)},${f(y)}`).join(' ');

// per-(gamut, mode, scale, hue, side) colored background, so non-hue slider
// changes don't recompute the gamut fill.
const sliceBgCache = new Map<string, string>();

const angDiff = (a: number, b: number): number => {
  const d = Math.abs((((a - b) % 360) + 360) % 360);
  return d > 180 ? 360 - d : d;
};

function representativeHue(palette: OklchColor[]): number {
  let best = palette[0]!;
  for (const c of palette) if (c.c > best.c) best = c;
  return best.h;
}

function niceStep(max: number): number {
  const raw = max / 4;
  for (const s of [0.02, 0.05, 0.1, 0.15, 0.2]) if (raw <= s) return s;
  return 0.25;
}

interface Side {
  hue: number;
  x0: number; // chroma = 0 anchor
  sign: -1 | 1; // direction of increasing chroma
  X: (c: number) => number;
}

export function renderSlice(
  host: HTMLElement,
  palette: OklchColor[],
  lut: Lut,
  forceMirror = false,
): void {
  if (!palette.length) {
    host.innerHTML = '';
    return;
  }

  const startHue = palette[0]!.h;
  const endHue = palette[palette.length - 1]!.h;
  const mirror = forceMirror || angDiff(startHue, endHue) > 1;

  // include the palette's own max chroma so out-of-gamut points ('absolute'
  // mode) still fit inside the plot instead of falling off the edge.
  const maxPC = palette.reduce((m, c) => Math.max(m, c.c), 0);

  let sides: Side[];
  let pointSide: number[];
  let xMax: number;
  let triModel = ''; // single-hue: the paper's triangle model, mirrored right

  if (!mirror) {
    const hue = representativeHue(palette);
    xMax = Math.max(cusp(hue, lut).c, maxPC, 0.04) * 1.18;
    const cx = W / 2;
    const halfW = (W - 2 * 26) / 2;
    // real gamut on the left; the paper's straight-line triangle model mirrored
    // on the right, with its cusp tip — the approximation next to reality.
    sides = [{ hue, x0: cx, sign: -1, X: (c) => cx - (c / xMax) * halfW }];
    pointSide = palette.map(() => 0);
    const peak = cusp(hue, lut);
    const tx = cx + (peak.c / xMax) * halfW;
    const ty = Y(peak.l);
    triModel = `<path d="M ${f(cx)},${f(Y(0))} L ${f(tx)},${f(ty)} L ${f(cx)},${f(Y(1))} Z" class="tri-model"/>
      <circle cx="${f(tx)}" cy="${f(ty)}" r="4" class="cusp"/>
      <text x="${f(tx + 7)}" y="${f(ty - 6)}" class="label" text-anchor="start">cusp ${peak.c.toFixed(3)}</text>`;
  } else {
    const peakS = cusp(startHue, lut);
    const peakE = cusp(endHue, lut);
    xMax = Math.max(peakS.c, peakE.c, maxPC, 0.04) * 1.18;
    const sp = 26;
    const cx = W / 2;
    const halfW = (W - 2 * sp) / 2;
    sides = [
      { hue: startHue, x0: cx, sign: -1, X: (c) => cx - (c / xMax) * halfW },
      { hue: endHue, x0: cx, sign: 1, X: (c) => cx + (c / xMax) * halfW },
    ];
    // first half -> left flap (start hue arm), second half -> right flap.
    // robust when both hues are equal (e.g. a symmetric diverging palette).
    pointSide = palette.map((_, i) => (i < palette.length / 2 ? 0 : 1));
  }

  // background per side: colored gamut fill + envelope + triangle + cusp + ref + ticks
  const background = (s: Side, drawTri: boolean): string => {
    // key MUST encode the geometry (single vs mirror, anchor) — single-mode and
    // mirror-flap backgrounds can share gamut/mode/xMax/hue/sign yet differ in
    // layout, so omitting this collides them and stacks the flaps.
    const key = `${gamutTag(lut)}|${mirror}|${drawTri}|${s.x0}|${s.sign}|${xMax.toFixed(4)}|${s.hue.toFixed(1)}`;
    const hit = sliceBgCache.get(key);
    if (hit) return hit;

    const peak = cusp(s.hue, lut);

    const env: Array<[number, number]> = [];
    for (let i = 0; i <= 96; i++) env.push([s.X(maxChromaAt(s.hue, i / 96, lut)), Y(i / 96)]);
    const envLine = `M ${fmtPts(env)}`;

    // colored fill: per-lightness trapezoids from the center axis (neutral) out
    // to the gamut envelope (cusp-edge color). Each trapezoid follows the curve
    // (no stepped edges) and pins its inner edge to the center axis, so the two
    // sides always meet cleanly at the center.
    const ROWS = 64;
    const idBase = `sl-${lut === oklchP3 ? "p" : "s"}-${Math.round(s.hue)}-${s.sign > 0 ? 'r' : 'l'}`;
    const x0 = s.X(0);
    let grads = '';
    let polys = '';
    for (let i = 0; i < ROWS; i++) {
      const L0 = i / ROWS;
      const L1 = (i + 1) / ROWS;
      const Lm = (L0 + L1) / 2;
      const maxC = maxChromaAt(s.hue, Lm, lut);
      if (maxC <= 0) continue;
      const xE0 = s.X(maxChromaAt(s.hue, L0, lut));
      const xE1 = s.X(maxChromaAt(s.hue, L1, lut));
      const cNeut = css(Lm, 0, s.hue);
      const cEdge = css(Lm, maxC, s.hue);
      const gid = `${idBase}-${i}`;
      grads += `<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="${f(x0)}" y1="0" x2="${f((xE0 + xE1) / 2)}" y2="0"><stop offset="0%" stop-color="${cNeut}"/><stop offset="100%" stop-color="${cEdge}"/></linearGradient>`;
      polys += `<polygon points="${f(x0)},${f(Y(L0))} ${f(xE0)},${f(Y(L0))} ${f(xE1)},${f(Y(L1))} ${f(x0)},${f(Y(L1))}" fill="url(#${gid})"/>`;
    }
    const fill = `${grads}${polys}`;
    const tri = `M ${f(s.X(0))},${f(Y(0))} L ${f(s.X(peak.c))},${f(Y(peak.l))} L ${f(s.X(0))},${f(Y(1))}`;

    const anchor = s.sign > 0 ? 'end' : 'start';
    const cuspMark = `<circle cx="${f(s.X(peak.c))}" cy="${f(Y(peak.l))}" r="4" class="cusp"/>
      <text x="${f(s.X(peak.c) - s.sign * 8)}" y="${f(Y(peak.l) - 7)}" class="label" text-anchor="${anchor}">cusp ${peak.c.toFixed(3)}</text>`;

    const cStep = niceStep(xMax);
    let cTicks = '';
    for (let c = cStep; c <= xMax + 1e-9; c += cStep) {
      cTicks += `<text x="${f(s.X(c))}" y="${f(H - PAD.b + 13)}" class="tick" text-anchor="middle">${c.toFixed(2)}</text>`;
    }

    const triEl = drawTri ? `<path d="${tri}" class="tri"/>` : '';
    const str = `${fill}${triEl}<path d="${envLine}" class="env-line"/>${cuspMark}${cTicks}`;
    sliceBgCache.set(key, str);
    return str;
  };

  // single-hue shows the triangle separately (right), so skip the left overlay
  const bg = sides.map((s) => background(s, mirror)).join('');

  // foreground: per-point guide + dot, and a trajectory across all points
  let guides = '';
  let dots = '';
  const path: Array<[number, number]> = [];
  palette.forEach((col, i) => {
    const s = sides[pointSide[i]!]!;
    const { l, c } = col;
    const maxC = maxChromaAt(s.hue, l, lut);
    guides += `<line x1="${f(s.x0)}" y1="${f(Y(l))}" x2="${f(s.X(maxC))}" y2="${f(Y(l))}" class="guide"/>`;
    const x = s.X(c);
    path.push([x, Y(l)]);
    dots += `<circle cx="${f(x)}" cy="${f(Y(l))}" r="4" class="dot"/>`;
  });
  const trajectory = path.length > 1 ? `<polyline points="${fmtPts(path)}" class="traj"/>` : '';

  const lTicks = [0, 0.25, 0.5, 0.75, 1]
    .map((L) => {
      const y = Y(L);
      return `<line x1="${PAD.l}" y1="${f(y)}" x2="${f(W - PAD.r)}" y2="${f(y)}" class="grid"/>
        <text x="${PAD.l - 8}" y="${f(y + 3)}" class="tick" text-anchor="end">${L}</text>`;
    })
    .join('');
  const axisLine = `<line x1="${f(W / 2)}" y1="${PAD.t}" x2="${f(W / 2)}" y2="${f(H - PAD.b)}" class="axis-center"/>`;

  const titleEls = mirror
    ? `<text x="${PAD.l}" y="16" class="title" text-anchor="start">◂ start ${startHue.toFixed(0)}°</text>
       <text x="${W - PAD.r}" y="16" class="title" text-anchor="end">end ${endHue.toFixed(0)}° ▸</text>`
    : `<text x="${PAD.l}" y="16" class="title" text-anchor="start">◂ actual · hue ${sides[0]!.hue.toFixed(0)}°</text>
       <text x="${W - PAD.r}" y="16" class="title" text-anchor="end">triangle model ▸</text>`;

  const legend = mirror
    ? `<span class="k k-env"></span> gamut envelope · <span class="k k-tri"></span> triangle · left = start hue, right = end hue`
    : `<span class="k k-env"></span> real gamut (left) · <span class="k k-tri"></span> paper triangle model with cusp tip (right) · dots = palette`;

  host.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" class="slice-svg" role="img"
         aria-label="OKLCH chroma-lightness slice">
      ${titleEls}
      ${lTicks}
      ${axisLine}
      ${bg}
      ${triModel}
      ${guides}
      ${trajectory}
      ${dots}
      <text x="${PAD.l - 38}" y="${f(PAD.t + PLOT_H / 2)}" class="axis" text-anchor="middle" transform="rotate(-90 ${PAD.l - 38} ${f(PAD.t + PLOT_H / 2)})">lightness</text>
      <text x="${f(W / 2)}" y="${H - 2}" class="axis" text-anchor="middle">chroma</text>
    </svg>
    <p class="slice-legend">${legend}</p>`;
}
