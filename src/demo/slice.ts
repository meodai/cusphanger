import {
  maxChromaAt,
  cusp,
  sharedCuspChroma,
  type PaletteColor,
  type Gamut,
  type ChromaMode,
} from '../lib/index';

// Side view of the OKLCH gamut slice (chroma x lightness) for one hue:
// the real maxChroma envelope, the triangle model, the cusp, and where each
// palette color lands -- with a guide line per point showing the full
// available chroma at that lightness (so the gamut-relative saturation
// fraction `s = c / maxChroma` is visible).

const W = 400;
const H = 360;
const PAD = { l: 48, r: 16, t: 26, b: 32 };
const PLOT_W = W - PAD.l - PAD.r;
const PLOT_H = H - PAD.t - PAD.b;

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

const fmtPts = (pts: Array<[number, number]>) =>
  pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');

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

  const hue = representativeHue(palette);
  const peak = cusp(hue, gamut);
  const xMax = Math.max(peak.c * 1.18, 0.05);

  const X = (c: number) => PAD.l + (c / xMax) * PLOT_W;
  const Y = (L: number) => PAD.t + (1 - L) * PLOT_H;

  // --- real gamut envelope (sampled maxChroma at each lightness) ---
  const N = 96;
  const env: Array<[number, number]> = [];
  for (let i = 0; i <= N; i++) {
    const L = i / N;
    env.push([X(maxChromaAt(hue, L, gamut)), Y(L)]);
  }
  const envFill = `M ${X(0).toFixed(2)},${Y(0).toFixed(2)} L ${fmtPts(env)} L ${X(0).toFixed(2)},${Y(1).toFixed(2)} Z`;
  const envLine = `M ${fmtPts(env)}`;

  // --- triangle model: black -> cusp -> white ---
  const tri = `M ${X(0).toFixed(2)},${Y(0).toFixed(2)} L ${X(peak.c).toFixed(2)},${Y(peak.l).toFixed(2)} L ${X(0).toFixed(2)},${Y(1).toFixed(2)}`;

  // --- axes ---
  const lTicks = [0, 0.25, 0.5, 0.75, 1]
    .map((L) => {
      const y = Y(L).toFixed(2);
      return `<line x1="${PAD.l}" y1="${y}" x2="${(W - PAD.r).toFixed(2)}" y2="${y}" class="grid"/>
        <text x="${PAD.l - 8}" y="${(Y(L) + 3).toFixed(2)}" class="tick" text-anchor="end">${L}</text>`;
    })
    .join('');

  const cStep = niceStep(xMax);
  let cTicks = '';
  for (let c = 0; c <= xMax + 1e-9; c += cStep) {
    const x = X(c).toFixed(2);
    cTicks += `<line x1="${x}" y1="${PAD.t}" x2="${x}" y2="${(H - PAD.b).toFixed(2)}" class="grid"/>
      <text x="${x}" y="${(H - PAD.b + 14).toFixed(2)}" class="tick" text-anchor="middle">${c.toFixed(2)}</text>`;
  }

  // --- per-point guide lines (full available chroma at that L) + trajectory + dots ---
  let guides = '';
  const path: Array<[number, number]> = [];
  let dots = '';
  for (const col of palette) {
    const { l, c } = col.oklch;
    const maxC = maxChromaAt(hue, l, gamut);
    guides += `<line x1="${X(0).toFixed(2)}" y1="${Y(l).toFixed(2)}" x2="${X(maxC).toFixed(2)}" y2="${Y(l).toFixed(2)}" class="guide"/>`;
    path.push([X(c), Y(l)]);
    dots += `<circle cx="${X(c).toFixed(2)}" cy="${Y(l).toFixed(2)}" r="5.5" fill="${col.css}" class="dot"/>`;
  }
  const trajectory =
    path.length > 1 ? `<polyline points="${fmtPts(path)}" class="traj"/>` : '';

  const cuspMark = `
    <circle cx="${X(peak.c).toFixed(2)}" cy="${Y(peak.l).toFixed(2)}" r="4" class="cusp"/>
    <text x="${(X(peak.c) - 8).toFixed(2)}" y="${(Y(peak.l) - 7).toFixed(2)}" class="label" text-anchor="end">cusp · L ${peak.l.toFixed(2)} C ${peak.c.toFixed(3)}</text>`;

  // For cusp/shared modes, s targets a hue-global chroma — draw it as a vertical
  // reference line so the dots' position relative to it shows the s fraction.
  let refLine = '';
  if (chromaMode !== 'envelope') {
    const refC = chromaMode === 'shared' ? sharedCuspChroma(gamut) : peak.c;
    const x = X(refC).toFixed(2);
    const label = chromaMode === 'shared' ? `shared C ${refC.toFixed(3)}` : 'cusp C (target)';
    refLine = `
      <line x1="${x}" y1="${PAD.t}" x2="${x}" y2="${(H - PAD.b).toFixed(2)}" class="ref"/>
      <text x="${(Number(x) + 4).toFixed(2)}" y="${(PAD.t + 10).toFixed(2)}" class="label">${label}</text>`;
  }

  host.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" class="slice-svg" role="img"
         aria-label="OKLCH chroma-lightness slice at hue ${hue.toFixed(0)} degrees">
      <text x="${PAD.l}" y="16" class="title">OKLCH slice · hue ${hue.toFixed(0)}° · ${gamut}</text>
      ${lTicks}${cTicks}
      <path d="${envFill}" class="env-fill"/>
      <path d="${tri}" class="tri"/>
      <path d="${envLine}" class="env-line"/>
      ${refLine}
      ${guides}
      ${trajectory}
      ${dots}
      ${cuspMark}
      <text x="${(PAD.l - 38).toFixed(2)}" y="${(PAD.t + PLOT_H / 2).toFixed(2)}" class="axis" text-anchor="middle" transform="rotate(-90 ${(PAD.l - 38).toFixed(2)} ${(PAD.t + PLOT_H / 2).toFixed(2)})">lightness</text>
      <text x="${(PAD.l + PLOT_W / 2).toFixed(2)}" y="${(H - 2).toFixed(2)}" class="axis" text-anchor="middle">chroma</text>
    </svg>
    <p class="slice-legend">
      <span class="k k-env"></span> real gamut envelope
      <span class="k k-tri"></span> triangle model
      <span class="k k-guide"></span> max chroma at L
      &nbsp;· dots = palette colors (C = s · maxChroma)
    </p>`;
}
