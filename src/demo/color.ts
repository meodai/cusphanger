import { formatHex } from 'culori';
import { toCss } from 'nutelch';
import type { OklchColor } from '../lib/index';

export const css = (l: number, c: number, h: number): string => toCss({ mode: 'oklch', l, c, h });

export const cssOf = (o: OklchColor): string => toCss(o);
export const hexOf = (o: OklchColor): string => formatHex(o) ?? '#000000';
