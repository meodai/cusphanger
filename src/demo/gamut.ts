// Demo-side gamut boundary, via culori — smoother than nutelch's LUT near the
// sharp cusps (the LUT bilinear-interpolates and wobbles there). Used only for
// the DIAGRAM outlines (wheel boundary, slice envelope); the palette itself
// comes from the library (nutelch). Same signatures as the lib's gamut helpers,
// so the views can swap import source without other changes.
import { clampChroma } from 'culori';
import { oklchP3, type Lut } from 'nutelch';

const culoriGamut = (lut: Lut) => (lut === oklchP3 ? 'p3' : 'rgb');

const chromaCache = new Map<string, number>();
export function maxChromaAt(hue: number, l: number, lut: Lut): number {
  if (l <= 0 || l >= 1) return 0;
  const h = ((hue % 360) + 360) % 360;
  const gamut = culoriGamut(lut);
  const key = `${gamut}:${h.toFixed(2)}:${l.toFixed(4)}`;
  const cached = chromaCache.get(key);
  if (cached !== undefined) return cached;
  const clamped = clampChroma({ mode: 'oklch', l, c: 0.5, h }, 'oklch', gamut);
  const value = clamped.c ?? 0;
  chromaCache.set(key, value);
  return value;
}

const cuspCache = new Map<string, { l: number; c: number }>();
export function cusp(hue: number, lut: Lut): { l: number; c: number } {
  const h = ((hue % 360) + 360) % 360;
  const key = `${culoriGamut(lut)}:${h.toFixed(2)}`;
  const cached = cuspCache.get(key);
  if (cached) return cached;
  let best = { l: 0.5, c: 0 };
  for (let i = 1; i < 100; i++) {
    const c = maxChromaAt(h, i / 100, lut);
    if (c > best.c) best = { l: i / 100, c };
  }
  for (let i = -9; i <= 9; i++) {
    const l = best.l + i / 1000;
    if (l <= 0 || l >= 1) continue;
    const c = maxChromaAt(h, l, lut);
    if (c > best.c) best = { l, c };
  }
  cuspCache.set(key, best);
  return best;
}
