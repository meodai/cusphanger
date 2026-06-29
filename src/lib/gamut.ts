import { cusp as shell, peak } from 'nutelch';
import type { Lut } from 'nutelch';

// Max in-gamut chroma at (hue, l) — the gamut shell, from the caller's nutelch LUT.
export function maxChromaAt(hue: number, l: number, lut: Lut): number {
  if (l <= 0 || l >= 1) return 0;
  const h = ((hue % 360) + 360) % 360;
  return shell({ lut, l, h }).c;
}

// The MSC / cusp: the most saturated (l, c) a hue can reach — nutelch's apex.
export function cusp(hue: number, lut: Lut): { l: number; c: number } {
  const p = peak({ lut, h: ((hue % 360) + 360) % 360 });
  return { l: p.l, c: p.c };
}
