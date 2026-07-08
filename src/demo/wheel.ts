import { type OklchColor } from '../lib/index';
import { cusp } from './gamut';
import { oklchP3, type Lut } from 'nutelch';
import { css, cssOf } from './color';

const gamutTag = (lut: Lut) => (lut === oklchP3 ? 'p3' : 'srgb');

export type WheelAxis = 'chroma' | 'lightness';

const SIZE = 400;
const CT = SIZE / 2;
const PAD = 26;
const R = CT - PAD;
const STEP = 2;
const INNER = 0.2; // hollow center so near-neutral / near-white hues don't pile onto one point
const R_INNER = INNER * R - 8; // guide circle + hue-span arc, tucked inside the hole

const radial = (flip: boolean) => {
  const pad = INNER * R;
  return (t: number) => pad + (flip ? 1 - t : t) * (R - pad);
};

const pt = (hue: number, r: number): [number, number] => {
  const a = (hue * Math.PI) / 180;
  return [CT + r * Math.cos(a), CT - r * Math.sin(a)];
};
const f = (n: number) => n.toFixed(2);

const diamond = (x: number, y: number, r: number, cls: string) =>
  `<polygon points="${f(x)},${f(y - r)} ${f(x + r)},${f(y)} ${f(x)},${f(y + r)} ${f(x - r)},${f(y)}" class="${cls}"/>`;

interface WheelBg {
  svg: string;
  maxCusp: number;
  legend: string;
}

const bgCache = new Map<string, WheelBg>();

function buildBg(lut: Lut, axis: WheelAxis, flip: boolean): WheelBg {
  const key = `${gamutTag(lut)}:${axis}:${flip}`;
  const cached = bgCache.get(key);
  if (cached) return cached;

  const rad = radial(flip);

  const peaks: Array<{ hue: number; c: number; l: number }> = [];
  let maxCusp = 0;
  for (let h = 0; h < 360; h += STEP) {
    const p = cusp(h, lut);
    peaks.push({ hue: h, c: p.c, l: p.l });
    if (p.c > maxCusp) maxCusp = p.c;
  }
  const bHue = (i: number) => {
    const b = peaks[(i + 1) % peaks.length]!;
    return b.hue === 0 ? 360 : b.hue;
  };

  let svg: string;
  let legend: string;

  if (axis === 'chroma') {
    const r0 = rad(0);
    let wedges = '';
    let boundary = '';
    for (let i = 0; i < peaks.length; i++) {
      const a = peaks[i]!;
      const b = peaks[(i + 1) % peaks.length]!;
      const [a0x, a0y] = pt(a.hue, r0);
      const [a1x, a1y] = pt(a.hue, rad(a.c / maxCusp));
      const [b1x, b1y] = pt(bHue(i), rad(b.c / maxCusp));
      const [b0x, b0y] = pt(bHue(i), r0);
      const fill = css(a.l, a.c, a.hue);
      wedges += `<path d="M ${f(a0x)},${f(a0y)} L ${f(a1x)},${f(a1y)} L ${f(b1x)},${f(b1y)} L ${f(b0x)},${f(b0y)} Z" fill="${fill}"/>`;
      boundary += `${i === 0 ? 'M' : 'L'} ${f(a1x)},${f(a1y)} `;
    }

    // fade offsets live inside the [INNER, 1] ring; the hard step at the inner
    // edge keeps the hole transparent so the dot grid shows through like outside the rim
    const edge = INNER * 100;
    const scale = (t: number) => f(edge + t * (100 - edge));
    const fadeStops = flip
      ? `<stop offset="${scale(0.54)}%" class="wheel-fade-out"/><stop offset="100%" class="wheel-fade-in"/>`
      : `<stop offset="${scale(0)}%" class="wheel-fade-out"/><stop offset="${scale(0)}%" class="wheel-fade-in"/><stop offset="${scale(0.46)}%" class="wheel-fade-out"/>`;
    svg = `
      <rect width="${SIZE}" height="${SIZE}" fill="url(#wheelDots)"/>
      <g data-ghost-keep>${wedges}</g>
      <radialGradient id="wheelFadeBg" cx="50%" cy="50%" r="50%">${fadeStops}</radialGradient>
      <circle cx="${CT}" cy="${CT}" r="${R}" fill="url(#wheelFadeBg)"/>
      <circle cx="${CT}" cy="${CT}" r="${f(R_INNER)}" class="wheel-inner-edge"/>
      <path d="${boundary}Z" class="wheel-boundary"/>`;
    legend = `boundary = per-hue cusp chroma (peaks &amp; valleys) · ${flip ? 'colorful center → neutral rim' : 'neutral center → colorful rim'} · dots = palette`;
  } else {
    const tag = gamutTag(lut);
    let defs = '';
    let wedges = '';
    let contour = '';
    for (let i = 0; i < peaks.length; i++) {
      const a = peaks[i]!;
      const id = `wl-${tag}-${flip ? 'f' : 'n'}-${a.hue}`;
      const cLo = css(0.04, 0, a.hue);
      const cCusp = css(a.l, a.c, a.hue);
      const cHi = css(0.99, 0, a.hue);
      const tCusp = 1 - a.l;
      const cuspOff = ((rad(tCusp) / R) * 100).toFixed(1);
      defs += `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${CT}" cy="${CT}" r="${R}">
        <stop offset="${f(INNER * 100)}%" stop-color="${flip ? cLo : cHi}"/>
        <stop offset="${cuspOff}%" stop-color="${cCusp}"/>
        <stop offset="100%" stop-color="${flip ? cHi : cLo}"/></radialGradient>`;
      const [a0x, a0y] = pt(a.hue, INNER * R);
      const [ax, ay] = pt(a.hue, R);
      const [bx, by] = pt(bHue(i), R);
      const [b0x, b0y] = pt(bHue(i), INNER * R);
      wedges += `<path d="M ${f(a0x)},${f(a0y)} L ${f(ax)},${f(ay)} L ${f(bx)},${f(by)} L ${f(b0x)},${f(b0y)} Z" fill="url(#${id})"/>`;
      const [cx, cy] = pt(a.hue, rad(tCusp));
      contour += `${i === 0 ? 'M' : 'L'} ${f(cx)},${f(cy)} `;
    }
    const rings = [0.25, 0.5, 0.75]
      .map((g) => `<circle cx="${CT}" cy="${CT}" r="${f(rad(g))}" class="wheel-ring"/>`)
      .join('');
    svg = `
      <rect width="${SIZE}" height="${SIZE}" fill="url(#wheelDots)"/>
      <defs>${defs}</defs>
      <g data-ghost-keep>${wedges}</g>
      ${rings}
      <circle cx="${CT}" cy="${CT}" r="${f(R_INNER)}" class="wheel-inner-edge"/>
      <path d="${contour}Z" class="wheel-boundary"/>`;
    legend = `radius = lightness (${flip ? 'dark center → white rim' : 'white center → dark rim'}) · boundary = per-hue cusp lightness · dots = palette`;
  }

  const bg: WheelBg = { svg, maxCusp, legend };
  bgCache.set(key, bg);
  return bg;
}

export function renderWheel(
  host: HTMLElement,
  palette: OklchColor[],
  lut: Lut,
  axis: WheelAxis = 'chroma',
  flip = false,
): void {
  if (!palette.length) {
    host.innerHTML = '';
    return;
  }

  const bg = buildBg(lut, axis, flip);
  const rad = radial(flip);
  const radius =
    axis === 'chroma'
      ? (col: OklchColor) => rad(col.c / bg.maxCusp)
      : (col: OklchColor) => rad(1 - col.l);
  const pts: Array<[number, number]> = palette.map((col) => pt(col.h, radius(col)));

  let traj = '';
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i]!;
    const [x2, y2] = pts[i + 1]!;
    traj += `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${cssOf(palette[i]!)}" class="wheel-traj"/>`;
  }
  const dots = pts.map(([x, y]) => diamond(x, y, 5, 'wheel-dot')).join('');

  // hue-span arc on the inner edge: smallest arc enclosing all palette hues
  let hueSpan = '';
  {
    const hs = [...new Set(palette.map((c) => Math.round((((c.h % 360) + 360) % 360) * 2) / 2))]
      .sort((a, b) => a - b);
    const hueDot = (h: number) => {
      const [x, y] = pt(h, R_INNER);
      return `<circle cx="${f(x)}" cy="${f(y)}" r="2.5" class="wheel-hue-dot"/>`;
    };
    if (hs.length === 1) {
      hueSpan = hueDot(hs[0]!);
    } else {
      let gapI = 0;
      let gapMax = -1;
      for (let i = 0; i < hs.length; i++) {
        const gap = (hs[(i + 1) % hs.length]! - hs[i]! + 360) % 360;
        if (gap > gapMax) {
          gapMax = gap;
          gapI = i;
        }
      }
      const h0 = hs[(gapI + 1) % hs.length]!;
      const h1 = hs[gapI]!;
      const sweep = (h1 - h0 + 360) % 360;
      const [sx, sy] = pt(h0, R_INNER);
      const [ex, ey] = pt(h1, R_INNER);
      hueSpan =
        `<path d="M ${f(sx)},${f(sy)} A ${f(R_INNER)} ${f(R_INNER)} 0 ${sweep > 180 ? 1 : 0} 0 ${f(ex)},${f(ey)}" class="wheel-hue-arc"/>` +
        hueDot(h0) +
        hueDot(h1);
    }
  }

  let cuspRings = '';
  let ringNote = '';
  if (axis === 'chroma') {
    const cusps = palette.map((col) => cusp(col.h, lut).c);
    const minC = Math.min(...cusps);
    const maxC = Math.max(...cusps);
    const avgC = cusps.reduce((a, b) => a + b, 0) / cusps.length;
    const rings: Array<[string, number]> =
      maxC - minC < 1e-3 ? [['cusp', minC]] : [
        ['min', minC],
        ['avg', avgC],
        ['max', maxC],
      ];
    cuspRings = rings
      .map(([name, c]) => {
        const r = rad(c / bg.maxCusp);
        const [lx, ly] = pt(90, r);
        return (
          `<circle cx="${CT}" cy="${CT}" r="${f(r)}" class="wheel-cusp-ring wheel-cusp-${name}"/>` +
          `<text x="${f(lx)}" y="${f(ly - 3)}" class="wheel-cusp-label" text-anchor="middle">${name}</text>`
        );
      })
      .join('');
    ringNote =
      rings.length > 1 ? " · rings = min/avg/max reachable chroma of the palette's hues" : '';
  }

  host.innerHTML = `
    <svg viewBox="0 0 ${SIZE} ${SIZE}" class="wheel-svg" role="img"
         aria-label="Top view of all hues, ${axis} as radius, ${gamutTag(lut)}">
      <defs>
        <pattern id="wheelDots" width="22" height="22" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" class="wheel-grid-dot"/>
        </pattern>
      </defs>
      ${bg.svg}
      ${cuspRings}
      ${hueSpan}
      ${traj}
      ${dots}
    </svg>
    <p class="slice-legend">${bg.legend}${ringNote}</p>`;
}
