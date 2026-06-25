import { maxChromaAt } from './gamut';
import type { Gamut, Oklch } from './types';

export function relativeToOklch(s: number, l: number, hue: number, gamut: Gamut = 'srgb'): Oklch {
  const h = ((hue % 360) + 360) % 360;
  const maxC = maxChromaAt(h, l, gamut);
  return { l, c: s * maxC, h };
}

export function oklchToRelative(color: Oklch, gamut: Gamut = 'srgb'): { s: number; l: number } {
  const maxC = maxChromaAt(color.h, color.l, gamut);
  return { s: maxC === 0 ? 0 : color.c / maxC, l: color.l };
}
