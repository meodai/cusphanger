import { clampChroma } from 'culori';
import { cusp as shell, type Lut } from 'nutelch';
import { culoriGamut, lutTag } from './space';

// Ground truth for the figures ("actual" gamut), straight from culori, in the
// LUT's own space. Lightness is native (0..lut.lMax). culori has no HCT, so for
// HCT the figures show nutelch's LUT boundary instead (~0.2% mean error).
const CEILING: Record<string, number> = { oklch: 0.5, lchuv: 260, lch: 160 };

const chromaCache = new Map<string, number>();
export function maxChromaAt(hue: number, l: number, lut: Lut): number {
  if (l <= 0 || l >= lut.lMax) return 0;
  const h = ((hue % 360) + 360) % 360;
  const key = `${lutTag(lut)}:${h.toFixed(2)}:${(l / lut.lMax).toFixed(4)}`;
  const cached = chromaCache.get(key);
  if (cached !== undefined) return cached;
  const mode = lut.mode;
  const value =
    mode === 'hct'
      ? shell({ lut, l, h }).c
      : (clampChroma({ mode, l, c: CEILING[mode]!, h }, mode, culoriGamut(lut)).c ?? 0);
  chromaCache.set(key, value);
  return value;
}

const cuspCache = new Map<string, { l: number; c: number }>();
export function cusp(hue: number, lut: Lut): { l: number; c: number } {
  const h = ((hue % 360) + 360) % 360;
  const key = `${lutTag(lut)}:${h.toFixed(2)}`;
  const cached = cuspCache.get(key);
  if (cached) return cached;
  const M = lut.lMax;
  let best = { l: 0.5 * M, c: 0 };
  for (let i = 1; i < 100; i++) {
    const c = maxChromaAt(h, (i / 100) * M, lut);
    if (c > best.c) best = { l: (i / 100) * M, c };
  }
  for (let i = -9; i <= 9; i++) {
    const l = best.l + (i / 1000) * M;
    if (l <= 0 || l >= M) continue;
    const c = maxChromaAt(h, l, lut);
    if (c > best.c) best = { l, c };
  }
  cuspCache.set(key, best);
  return best;
}
