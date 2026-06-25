import {
  maxChromaAt,
  cusp,
  sharedCuspChroma,
  toPaletteColor,
  type PaletteColor,
  type Gamut,
  type ChromaMode,
} from '../lib/index';

// Side view of the OKLCH gamut slice (chroma x lightness). With a single hue it
// shows one (chroma vs lightness) cross-section; when the palette's start and
// end hue differ it mirrors into a butterfly: start hue on the left, end hue on
// the right, sharing the central lightness axis.

const W = 400;
const H = 400;
const PAD = { l: 48, r: 16, t: 26, b: 32 };
const PLOT_W = W - PAD.l - PAD.r;
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

function representativeHue(palette: PaletteColor[]): number {
  let best = palette[0]!;
  for (const c of palette) if (c.oklch.c > best.oklch.c) best = c;
  return best.oklch.h;
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
  palette: PaletteColor[],
  gamut: Gamut,
  chromaMode: ChromaMode = 'envelope',
  forceMirror = false,
): void {
  if (!palette.length) {
    host.innerHTML = '';
    return;
  }

  const startHue = palette[0]!.oklch.h;
  const endHue = palette[palette.length - 1]!.oklch.h;
  const mirror = forceMirror || angDiff(startHue, endHue) > 1;

  let sides: Side[];
  let pointSide: number[];
  let xMax: number;

  if (!mirror) {
    const hue = representativeHue(palette);
    xMax = Math.max(cusp(hue, gamut).c * 1.18, 0.05);
    sides = [{ hue, x0: PAD.l, sign: 1, X: (c) => PAD.l + (c / xMax) * PLOT_W }];
    pointSide = palette.map(() => 0);
  } else {
    const peakS = cusp(startHue, gamut);
    const peakE = cusp(endHue, gamut);
    xMax = Math.max(peakS.c, peakE.c, 0.04) * 1.18;
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
  const background = (s: Side): string => {
    // key MUST encode the geometry (single vs mirror, anchor) — single-mode and
    // mirror-flap backgrounds can share gamut/mode/xMax/hue/sign yet differ in
    // layout, so omitting this collides them and stacks the flaps.
    const key = `${gamut}|${chromaMode}|${mirror}|${s.x0}|${s.sign}|${xMax.toFixed(4)}|${s.hue.toFixed(1)}`;
    const hit = sliceBgCache.get(key);
    if (hit) return hit;

    const peak = cusp(s.hue, gamut);

    const env: Array<[number, number]> = [];
    for (let i = 0; i <= 96; i++) env.push([s.X(maxChromaAt(s.hue, i / 96, gamut)), Y(i / 96)]);
    const envLine = `M ${fmtPts(env)}`;

    // colored fill: per-lightness trapezoids from the center axis (neutral) out
    // to the gamut envelope (cusp-edge color). Each trapezoid follows the curve
    // (no stepped edges) and pins its inner edge to the center axis, so the two
    // sides always meet cleanly at the center.
    const ROWS = 64;
    const idBase = `sl-${gamut === 'display-p3' ? 'p' : 's'}-${Math.round(s.hue)}-${s.sign > 0 ? 'r' : 'l'}`;
    const x0 = s.X(0);
    let grads = '';
    let polys = '';
    for (let i = 0; i < ROWS; i++) {
      const L0 = i / ROWS;
      const L1 = (i + 1) / ROWS;
      const Lm = (L0 + L1) / 2;
      const maxC = maxChromaAt(s.hue, Lm, gamut);
      if (maxC <= 0) continue;
      const xE0 = s.X(maxChromaAt(s.hue, L0, gamut));
      const xE1 = s.X(maxChromaAt(s.hue, L1, gamut));
      const cNeut = toPaletteColor({ l: Lm, c: 0, h: s.hue }, gamut).css;
      const cEdge = toPaletteColor({ l: Lm, c: maxC, h: s.hue }, gamut).css;
      const gid = `${idBase}-${i}`;
      grads += `<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="${f(x0)}" y1="0" x2="${f((xE0 + xE1) / 2)}" y2="0"><stop offset="0%" stop-color="${cNeut}"/><stop offset="100%" stop-color="${cEdge}"/></linearGradient>`;
      polys += `<polygon points="${f(x0)},${f(Y(L0))} ${f(xE0)},${f(Y(L0))} ${f(xE1)},${f(Y(L1))} ${f(x0)},${f(Y(L1))}" fill="url(#${gid})"/>`;
    }
    const fill = `${grads}${polys}`;
    const tri = `M ${f(s.X(0))},${f(Y(0))} L ${f(s.X(peak.c))},${f(Y(peak.l))} L ${f(s.X(0))},${f(Y(1))}`;

    const anchor = s.sign > 0 ? 'end' : 'start';
    const cuspMark = `<circle cx="${f(s.X(peak.c))}" cy="${f(Y(peak.l))}" r="4" class="cusp"/>
      <text x="${f(s.X(peak.c) - s.sign * 8)}" y="${f(Y(peak.l) - 7)}" class="label" text-anchor="${anchor}">cusp ${peak.c.toFixed(3)}</text>`;

    let refLine = '';
    if (chromaMode !== 'envelope') {
      const refC = chromaMode === 'shared' ? sharedCuspChroma(gamut) : peak.c;
      const x = s.X(refC);
      refLine = `<line x1="${f(x)}" y1="${PAD.t}" x2="${f(x)}" y2="${f(H - PAD.b)}" class="ref"/>`;
    }

    const cStep = niceStep(xMax);
    let cTicks = '';
    for (let c = cStep; c <= xMax + 1e-9; c += cStep) {
      cTicks += `<text x="${f(s.X(c))}" y="${f(H - PAD.b + 13)}" class="tick" text-anchor="middle">${c.toFixed(2)}</text>`;
    }

    const str = `${fill}<path d="${tri}" class="tri"/><path d="${envLine}" class="env-line"/>${refLine}${cuspMark}${cTicks}`;
    sliceBgCache.set(key, str);
    return str;
  };

  const bg = sides.map(background).join('');

  // foreground: per-point guide + dot, and a trajectory across all points
  let guides = '';
  let dots = '';
  const path: Array<[number, number]> = [];
  palette.forEach((col, i) => {
    const s = sides[pointSide[i]!]!;
    const { l, c } = col.oklch;
    const maxC = maxChromaAt(s.hue, l, gamut);
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
  const axisLine = mirror
    ? `<line x1="${f(W / 2)}" y1="${PAD.t}" x2="${f(W / 2)}" y2="${f(H - PAD.b)}" class="axis-center"/>`
    : '';

  const titleEls = mirror
    ? `<text x="${PAD.l}" y="16" class="title" text-anchor="start">◂ start ${startHue.toFixed(0)}°</text>
       <text x="${W - PAD.r}" y="16" class="title" text-anchor="end">end ${endHue.toFixed(0)}° ▸</text>`
    : `<text x="${PAD.l}" y="16" class="title">OKLCH slice · hue ${sides[0]!.hue.toFixed(0)}° · ${gamut}</text>`;

  const legend = mirror
    ? `<span class="k k-env"></span> gamut envelope · <span class="k k-tri"></span> triangle · left = start hue, right = end hue`
    : `<span class="k k-env"></span> real gamut envelope <span class="k k-tri"></span> triangle model <span class="k k-guide"></span> max chroma at L · dots = palette (C = s · maxChroma)`;

  host.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" class="slice-svg" role="img"
         aria-label="OKLCH chroma-lightness slice">
      ${titleEls}
      ${lTicks}
      ${axisLine}
      ${bg}
      ${guides}
      ${trajectory}
      ${dots}
      <text x="${PAD.l - 38}" y="${f(PAD.t + PLOT_H / 2)}" class="axis" text-anchor="middle" transform="rotate(-90 ${PAD.l - 38} ${f(PAD.t + PLOT_H / 2)})">lightness</text>
      <text x="${f(W / 2)}" y="${H - 2}" class="axis" text-anchor="middle">chroma</text>
    </svg>
    <p class="slice-legend">${legend}</p>`;
}
