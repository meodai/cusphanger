import { inGamut, toGamut, formatHex, formatCss, clampChroma } from 'culori';
import type { Gamut, Oklch, PaletteColor } from './types';

const inSrgb = inGamut('rgb');
const inP3 = inGamut('p3');
const toSrgb = toGamut('rgb');
const toP3 = toGamut('p3');

export function toPaletteColor(color: Oklch, gamut: Gamut = 'srgb'): PaletteColor {
  const oklch = { mode: 'oklch' as const, l: color.l, c: color.c, h: color.h };
  const hex = formatHex(toSrgb(oklch));
  const css =
    gamut === 'display-p3'
      ? formatCss(toP3(oklch))
      : formatCss(clampChroma(oklch, 'oklch', 'rgb'));
  return {
    oklch: { l: color.l, c: color.c, h: color.h },
    hex,
    css,
    inSrgb: inSrgb(oklch),
    inP3: inP3(oklch),
  };
}
