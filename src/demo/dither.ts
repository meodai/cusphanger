// Binary Bayer ordered-dither strip as an SVG data URI. White squares whose
// density loosens from solid (right edge) to nothing (left) — no alpha, just
// on/off squares (real dithering). Only one vertical repeat tile is rendered
// (the 4x4 Bayer matrix repeats every 4 rows); tile it down the strip with
// `background-repeat: repeat-y`.
const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

export interface DitherOptions {
  width: number; // strip width in px (the dither span; = the SVG width)
  square: number; // dither "pixel" size in px
  color?: string; // square color. default #fff
}

// Returns a `url("data:image/svg+xml,...")` value ready for `background`.
export function ditherSvg({ width, square, color = '#fff' }: DitherOptions): string {
  const cols = Math.max(1, Math.round(width / square));
  const rows = BAYER4.length; // vertical repeat period
  const h = rows * square;
  let rects = '';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const coverage = cols > 1 ? c / (cols - 1) : 1; // 0 (left) → 1 (right)
      const threshold = (BAYER4[r]![c % 4]! + 0.5) / 16;
      if (coverage > threshold) {
        rects += `<rect x="${c * square}" y="${r * square}" width="${square}" height="${square}"/>`;
      }
    }
  }
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${cols * square}" height="${h}" ` +
    `fill="${color}" shape-rendering="crispEdges">${rects}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
