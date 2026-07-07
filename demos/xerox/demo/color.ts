// Demo-side color I/O. The library is OKLCH-native (returns { mode, l, c, h });
// the demo uses nutelch's toCss for rendering and culori for hex (swatches /
// contrast math) — exactly the "keep culori in the demo" split.
import { formatHex } from 'culori';
import { toCss } from 'nutelch';
import type { OklchColor } from '../lib/index';

// CSS for an ad-hoc (l, c, h) — used for SVG fills built on the fly.
export const css = (l: number, c: number, h: number): string => toCss({ mode: 'oklch', l, c, h });

export const cssOf = (o: OklchColor): string => toCss(o);
export const hexOf = (o: OklchColor): string => formatHex(o) ?? '#000000';
