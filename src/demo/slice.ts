import {
  maxChromaAt,
  cusp,
  sharedCuspChroma,
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
): void {
  if (!palette.length) {
    host.innerHTML = '';
    return;
  }

  const startHue = palette[0]!.oklch.h;
  const endHue = palette[palette.length - 1]!.oklch.h;
  const mirror = angDiff(startHue, endHue) > 1;

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
    pointSide = palette.map((col) =>
      angDiff(col.oklch.h, startHue) <= angDiff(col.oklch.h, endHue) ? 0 : 1,
    );
  }

  // background per side: envelope + triangle + cusp + reference line + chroma ticks
  const background = (s: Side): string => {
    const peak = cusp(s.hue, gamut);
    const env: Array<[number, number]> = [];
    for (let i = 0; i <= 96; i++) {
      const L = i / 96;
      env.push([s.X(maxChromaAt(s.hue, L, gamut)), Y(L)]);
    }
    const envFill = `M ${f(s.X(0))},${f(Y(0))} L ${fmtPts(env)} L ${f(s.X(0))},${f(Y(1))} Z`;
    const envLine = `M ${fmtPts(env)}`;
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
    return `${cTicks}<path d="${envFill}" class="env-fill"/><path d="${tri}" class="tri"/><path d="${envLine}" class="env-line"/>${refLine}${cuspMark}`;
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
    dots += `<circle cx="${f(x)}" cy="${f(Y(l))}" r="5.5" fill="${col.css}" class="dot"/>`;
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
    ? `<line x1="${f(W / 2)}" y1="${PAD.t}" x2="${f(W / 2)}" y2="${f(H - PAD.b)}" class="grid"/>`
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
