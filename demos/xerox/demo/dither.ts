// Binary Bayer ordered-dither strip as an SVG data URI. Squares whose density
// loosens from solid to nothing across the `span` — no alpha, just on/off
// squares (real dithering). Optionally a solid `pad` band precedes the fade.
// Only one repeat tile is rendered (the 4x4 Bayer matrix repeats every 4 cells
// on the cross axis); tile it with the matching `background-repeat`
// (repeat-y for horizontal, repeat-x for vertical).
const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

export interface DitherOptions {
  span: number; // dither fade length in px (the gradient runs across this)
  square: number; // dither "pixel" size in px
  color?: string; // square color. default #fff
  vertical?: boolean; // false: solid at right (repeat-y); true: solid at top (repeat-x)
  pad?: number; // solid, un-dithered band in px at the solid end (before the fade). default 0
}

// Returns a `url("data:image/svg+xml,...")` value ready for `background`/`mask`.
export function ditherSvg({
  span,
  square,
  color = '#fff',
  vertical = false,
  pad = 0,
}: DitherOptions): string {
  const fadeCells = Math.max(1, Math.round(span / square));
  const padCells = Math.max(0, Math.round(pad / square));
  const total = padCells + fadeCells; // cells along the fade axis (incl. the solid pad)
  const PERIOD = BAYER4.length; // 4 — repeat period on the cross axis
  const cols = vertical ? PERIOD : total;
  const rows = vertical ? total : PERIOD;
  let rects = '';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // distance from the solid end (top for vertical, right for horizontal)
      const fromSolid = vertical ? r : cols - 1 - c;
      let coverage: number;
      if (fromSolid < padCells) {
        coverage = 1; // solid (no-dither) padding
      } else {
        const fadePos = fromSolid - padCells; // 0 (pad edge) → fadeCells-1 (far end)
        coverage = fadeCells > 1 ? 1 - fadePos / (fadeCells - 1) : 1;
      }
      const threshold = (BAYER4[r % 4]![c % 4]! + 0.5) / 16;
      if (coverage > threshold) {
        rects += `<rect x="${c * square}" y="${r * square}" width="${square}" height="${square}"/>`;
      }
    }
  }
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${cols * square}" height="${rows * square}" ` +
    `fill="${color}" shape-rendering="crispEdges">${rects}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
