import { formatHex, converter } from 'culori';
// nutelch/hct's toCss formats every mode: oklch() / lch() natively, lchuv as the
// equivalent lch(), hct as the equivalent oklch() (CSS has neither syntax)
import { toCss, hctToRgb } from 'nutelch/hct';
import type { OklchColor, PaletteColor, PaletteMode } from '../lib/index';

// CSS for a color given in `mode`'s native coordinates.
export const css = (l: number, c: number, h: number, mode: PaletteMode = 'oklch'): string =>
  toCss({ mode, l, c, h });

export const cssOf = (o: PaletteColor): string => toCss(o);
// culori knows oklch / lchuv / lch but not hct: hct goes through sRGB first.
// (culori takes a plain object literal; spreading drops the interface type)
const culoriColor = (o: PaletteColor) =>
  o.mode === 'hct' ? { mode: 'rgb' as const, ...hctToRgb(o) } : { ...o };
export const hexOf = (o: PaletteColor): string => formatHex(culoriColor(o)) ?? '#000000';

// OKLCH view of any palette color — for the demo's perceptual thresholds
// (theme, label contrast), which are tuned in OKLab lightness.
const toOklch = converter('oklch');
export const okOf = (o: PaletteColor): OklchColor => {
  if (o.mode === 'oklch') return o as OklchColor;
  const k = toOklch(culoriColor(o)) as { l: number; c?: number; h?: number };
  return { mode: 'oklch', l: k.l, c: k.c ?? 0, h: k.h ?? o.h };
};
