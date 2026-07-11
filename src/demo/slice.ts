import { type OklchColor } from '../lib/index';
import { maxChromaAt, cusp } from './gamut';
import { oklchP3, type Lut } from 'nutelch';
import { css } from './color';

const gamutTag = (lut: Lut) => (lut === oklchP3 ? 'p3' : 'srgb');

const W = 400;
const H = 400;
const PAD = { l: 48, r: 16, t: 26, b: 32 };
const PLOT_H = H - PAD.t - PAD.b;

const f = (n: number) => n.toFixed(2);
const Y = (L: number) => PAD.t + (1 - L) * PLOT_H;
const fmtPts = (pts: Array<[number, number]>) => pts.map(([x, y]) => `${f(x)},${f(y)}`).join(' ');

const diamond = (x: number, y: number, r: number, cls: string) =>
  `<polygon points="${f(x)},${f(y - r)} ${f(x + r)},${f(y)} ${f(x)},${f(y + r)} ${f(x - r)},${f(y)}" class="${cls}"/>`;

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
  x0: number;
  sign: -1 | 1;
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

  const maxPC = palette.reduce((m, c) => Math.max(m, c.c), 0);

  let sides: Side[];
  let pointSide: number[];
  let xMax: number;
  let triModel = '';

  if (!mirror) {
    const hue = representativeHue(palette);
    xMax = Math.max(cusp(hue, lut).c, maxPC, 0.04) * 1.18;
    const cx = W / 2;
    const halfW = (W - 2 * 26) / 2;

    sides = [{ hue, x0: cx, sign: -1, X: (c) => cx - (c / xMax) * halfW }];
    pointSide = palette.map(() => 0);
    const peak = cusp(hue, lut);
    const tx = cx + (peak.c / xMax) * halfW;
    const ty = Y(peak.l);
    triModel = `<path d="M ${f(cx)},${f(Y(0))} L ${f(tx)},${f(ty)} L ${f(cx)},${f(Y(1))} Z" class="tri-model"/>
      ${diamond(tx, ty, 5, 'cusp')}
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

    pointSide = palette.map((_, i) => (i < palette.length / 2 ? 0 : 1));
  }

  const background = (s: Side, drawTri: boolean): string => {

    const key = `${gamutTag(lut)}|${mirror}|${drawTri}|${s.x0}|${s.sign}|${xMax.toFixed(4)}|${s.hue.toFixed(1)}`;
    const hit = sliceBgCache.get(key);
    if (hit) return hit;

    const peak = cusp(s.hue, lut);

    const env: Array<[number, number]> = [];
    for (let i = 0; i <= 96; i++) env.push([s.X(maxChromaAt(s.hue, i / 96, lut)), Y(i / 96)]);
    const envLine = `M ${fmtPts(env)}`;

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
    const cuspMark = `${diamond(s.X(peak.c), Y(peak.l), 5, 'cusp')}
      <text x="${f(s.X(peak.c) - s.sign * 8)}" y="${f(Y(peak.l) - 7)}" class="label" text-anchor="${anchor}">cusp ${peak.c.toFixed(3)}</text>`;

    const cStep = niceStep(xMax);
    let cTicks = '';
    for (let c = cStep; c <= xMax + 1e-9; c += cStep) {
      cTicks += `<text x="${f(s.X(c))}" y="${f(H - PAD.b + 13)}" class="tick" text-anchor="middle">${c.toFixed(2)}</text>`;
    }

    const triEl = drawTri ? `<path d="${tri}" class="tri"/>` : '';

    const str = `<g data-ghost-keep>${fill}</g>${triEl}<path d="${envLine}" class="env-line"/>${cuspMark}${cTicks}`;
    sliceBgCache.set(key, str);
    return str;
  };

  const bg = sides.map((s) => background(s, mirror)).join('');

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
    dots += diamond(x, Y(l), 5, 'dot');
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
      <defs>
        <pattern id="sliceDots" width="22" height="22" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" class="wheel-grid-dot"/>
        </pattern>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#sliceDots)"/>
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
