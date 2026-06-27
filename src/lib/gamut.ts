import { clampChroma } from 'culori';
import type { Gamut } from './types';

const RGB_GAMUT: Record<Gamut, string> = {
  srgb: 'rgb',
  'display-p3': 'p3',
};

const CHROMA_CEILING = 0.5; // above the true OKLCH max for any sRGB/P3 hue

const chromaCache = new Map<string, number>();

export function maxChromaAt(hue: number, l: number, gamut: Gamut = 'srgb'): number {
  if (l <= 0 || l >= 1) return 0;
  const h = ((hue % 360) + 360) % 360;
  const key = `${gamut}:${h.toFixed(2)}:${l.toFixed(4)}`;
  const cached = chromaCache.get(key);
  if (cached !== undefined) return cached;
  const clamped = clampChroma(
    { mode: 'oklch', l, c: CHROMA_CEILING, h },
    'oklch',
    RGB_GAMUT[gamut],
  );
  const value = clamped.c ?? 0;
  chromaCache.set(key, value);
  return value;
}

const cuspCache = new Map<string, { l: number; c: number }>();

export function cusp(hue: number, gamut: Gamut = 'srgb'): { l: number; c: number } {
  const h = ((hue % 360) + 360) % 360;
  const key = `${gamut}:${h.toFixed(2)}`;
  const cached = cuspCache.get(key);
  if (cached) return cached;

  // coarse scan, then refine around the best lightness
  let best = { l: 0.5, c: 0 };
  for (let i = 1; i < 100; i++) {
    const l = i / 100;
    const c = maxChromaAt(h, l, gamut);
    if (c > best.c) best = { l, c };
  }
  for (let i = -9; i <= 9; i++) {
    const l = best.l + i / 1000;
    if (l <= 0 || l >= 1) continue;
    const c = maxChromaAt(h, l, gamut);
    if (c > best.c) best = { l, c };
  }
  cuspCache.set(key, best);
  return best;
}
