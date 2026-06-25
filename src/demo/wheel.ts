import {
  cusp,
  sharedCuspChroma,
  toPaletteColor,
  type PaletteColor,
  type Gamut,
} from '../lib/index';

// Top view: hue = angle, and the radius is either chroma or lightness.
// - 'chroma' (down the L axis): boundary = per-hue cusp chroma (peaks & valleys);
//   the dashed inscribed circle is the 'shared' chroma (min of cusps).
// - 'lightness' (down the C axis): dark center -> light rim, fill is the most
//   saturated color at each (hue, L); the contour is each hue's cusp lightness.

export type WheelAxis = 'chroma' | 'lightness';

const SIZE = 400;
const CT = SIZE / 2;
const PAD = 26;
const R = CT - PAD;
const STEP = 2; // degrees per wedge

const pt = (hue: number, r: number): [number, number] => {
  const a = (hue * Math.PI) / 180;
  return [CT + r * Math.cos(a), CT - r * Math.sin(a)];
};
const f = (n: number) => n.toFixed(2);

interface WheelBg {
  svg: string;
  maxCusp: number;
  shared: number;
  legend: string;
}

const bgCache = new Map<string, WheelBg>();

function buildBg(gamut: Gamut, axis: WheelAxis): WheelBg {
  const key = `${gamut}:${axis}`;
  const cached = bgCache.get(key);
  if (cached) return cached;

  const shared = sharedCuspChroma(gamut);
  const peaks: Array<{ hue: number; c: number; l: number }> = [];
  let maxCusp = 0;
  for (let h = 0; h < 360; h += STEP) {
    const p = cusp(h, gamut);
    peaks.push({ hue: h, c: p.c, l: p.l });
    if (p.c > maxCusp) maxCusp = p.c;
  }

  let svg: string;
  let legend: string;

  if (axis === 'chroma') {
    const rad = (c: number) => (c / maxCusp) * R;
    let wedges = '';
    let boundary = '';
    for (let i = 0; i < peaks.length; i++) {
      const a = peaks[i]!;
      const b = peaks[(i + 1) % peaks.length]!;
      const [ax, ay] = pt(a.hue, rad(a.c));
      const [bx, by] = pt(b.hue === 0 ? 360 : b.hue, rad(b.c));
      const fill = toPaletteColor({ l: a.l, c: a.c, h: a.hue }, gamut).css;
      wedges += `<path d="M ${CT},${CT} L ${f(ax)},${f(ay)} L ${f(bx)},${f(by)} Z" fill="${fill}"/>`;
      boundary += `${i === 0 ? 'M' : 'L'} ${f(ax)},${f(ay)} `;
    }
    svg = `
      <rect width="${SIZE}" height="${SIZE}" fill="url(#wheelDots)"/>
      <g>${wedges}</g>
      <circle cx="${CT}" cy="${CT}" r="${R}" fill="url(#wheelFade)"/>
      <path d="${boundary}Z" class="wheel-boundary"/>
      <circle cx="${CT}" cy="${CT}" r="${f(rad(shared))}" class="wheel-shared"/>`;
    legend = `boundary = per-hue cusp chroma (peaks &amp; valleys) · <span class="k k-shared"></span> shared chroma C ${shared.toFixed(3)} · dots = palette`;
  } else {
    // radius = lightness (0 center -> 1 rim). Per-hue radial gradient black->cusp->white.
    const tag = gamut === 'display-p3' ? 'p3' : 'srgb';
    let defs = '';
    let wedges = '';
    let contour = '';
    for (let i = 0; i < peaks.length; i++) {
      const a = peaks[i]!;
      const b = peaks[(i + 1) % peaks.length]!;
      const id = `wl-${tag}-${a.hue}`;
      const cLo = toPaletteColor({ l: 0.04, c: 0, h: a.hue }, gamut).css;
      const cCusp = toPaletteColor({ l: a.l, c: a.c, h: a.hue }, gamut).css;
      const cHi = toPaletteColor({ l: 0.99, c: 0, h: a.hue }, gamut).css;
      defs += `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${CT}" cy="${CT}" r="${R}">
        <stop offset="0%" stop-color="${cLo}"/>
        <stop offset="${(a.l * 100).toFixed(1)}%" stop-color="${cCusp}"/>
        <stop offset="100%" stop-color="${cHi}"/></radialGradient>`;
      const [ax, ay] = pt(a.hue, R);
      const [bx, by] = pt(b.hue === 0 ? 360 : b.hue, R);
      wedges += `<path d="M ${CT},${CT} L ${f(ax)},${f(ay)} L ${f(bx)},${f(by)} Z" fill="url(#${id})"/>`;
      const [cx, cy] = pt(a.hue, a.l * R);
      contour += `${i === 0 ? 'M' : 'L'} ${f(cx)},${f(cy)} `;
    }
    const rings = [0.25, 0.5, 0.75]
      .map((g) => `<circle cx="${CT}" cy="${CT}" r="${f(g * R)}" class="wheel-ring"/>`)
      .join('');
    svg = `
      <defs>${defs}</defs>
      <g>${wedges}</g>
      ${rings}
      <path d="${contour}Z" class="wheel-boundary"/>`;
    legend = `radius = lightness (0 center → 1 rim) · boundary = per-hue cusp lightness · dots = palette`;
  }

  const bg: WheelBg = { svg, maxCusp, shared, legend };
  bgCache.set(key, bg);
  return bg;
}

export function renderWheel(
  host: HTMLElement,
  palette: PaletteColor[],
  gamut: Gamut,
  axis: WheelAxis = 'chroma',
): void {
  if (!palette.length) {
    host.innerHTML = '';
    return;
  }

  const bg = buildBg(gamut, axis);
  const radius =
    axis === 'chroma'
      ? (col: PaletteColor) => (col.oklch.c / bg.maxCusp) * R
      : (col: PaletteColor) => col.oklch.l * R;
  const pts: Array<[number, number]> = palette.map((col) => pt(col.oklch.h, radius(col)));

  let traj = '';
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i]!;
    const [x2, y2] = pts[i + 1]!;
    traj += `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${palette[i]!.css}" class="wheel-traj"/>`;
  }
  const dots = pts.map(([x, y]) => `<circle cx="${f(x)}" cy="${f(y)}" r="4" class="wheel-dot"/>`).join('');

  host.innerHTML = `
    <svg viewBox="0 0 ${SIZE} ${SIZE}" class="wheel-svg" role="img"
         aria-label="Top view of all hues, ${axis} as radius, ${gamut}">
      <defs>
        <pattern id="wheelDots" width="22" height="22" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" class="wheel-grid-dot"/>
        </pattern>
        <radialGradient id="wheelFade" cx="50%" cy="50%" r="50%">
          <stop offset="0%" class="wheel-fade-in"/>
          <stop offset="46%" class="wheel-fade-out"/>
        </radialGradient>
      </defs>
      ${bg.svg}
      ${traj}
      ${dots}
      <text x="14" y="20" class="wheel-tag">${gamut === 'display-p3' ? 'P3' : 'sRGB'}</text>
    </svg>
    <p class="slice-legend">${bg.legend}</p>`;
}
