import type { OklchColor } from './types';

// Construct a mode-tagged OKLCH color (culori / nutelch compatible).
export const oklch = (l: number, c: number, h: number): OklchColor => ({ mode: 'oklch', l, c, h });

// num formatted compactly for CSS (drops trailing zeros)
const f = (n: number) => +n.toFixed(4);

// CSS string for an OKLCH color. The browser renders `oklch()` natively and
// gamut-maps to the display, so the same string is correct on sRGB and
// wide-gamut screens — no per-gamut output format needed.
export const toCss = (o: OklchColor): string => `oklch(${f(o.l)} ${f(o.c)} ${f(o.h)})`;
