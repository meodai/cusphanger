import { relativeToOklch } from './space';
import { toPaletteColor } from './color';
import { lerp, clamp01, linear } from './easing';
import type { PaletteColor, PaletteOptions } from './types';

export function generatePalette(o: PaletteOptions): PaletteColor[] {
  const {
    total,
    hueStart,
    hueCycles = 0,
    hueEasing = linear,
    hueStartCenter = 0,
    lightnessRange = [0.95, 0.2],
    lightnessEasing = linear,
    saturationRange = [0.9, 0.9],
    saturationEasing = linear,
    gamut = 'srgb',
  } = o;

  const out: PaletteColor[] = [];
  for (let i = 0; i < total; i++) {
    const t = total <= 1 ? 0 : i / (total - 1);
    const rawHue = hueStart + 360 * hueCycles * (hueEasing(t) - hueStartCenter);
    const hue = ((rawHue % 360) + 360) % 360;
    const l = lerp(lightnessRange[0], lightnessRange[1], lightnessEasing(t));
    const s = clamp01(lerp(saturationRange[0], saturationRange[1], saturationEasing(t)));
    out.push(toPaletteColor(relativeToOklch(s, l, hue, gamut), gamut));
  }
  return out;
}
