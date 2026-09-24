import { oklchSrgb, oklchP3, lchuvSrgb, lchuvP3, lchSrgb, lchP3, type Lut } from 'nutelch';
import { hctSrgb, hctP3 } from 'nutelch/hct';
import type { PaletteMode } from '../lib/index';

// The demo's two knobs — model (OKLCH / LCHuv / LCH / HCT) and gamut (sRGB /
// P3) — pick one of eight nutelch LUTs. The figures draw each space's own
// geometry, so they work in normalized lightness (L / lMax) and label values on
// the space's own scale.
export type Model = PaletteMode;
export type GamutId = 'srgb' | 'p3';

const LUTS: Record<Model, Record<GamutId, { lut: Lut; name: string }>> = {
  oklch: { srgb: { lut: oklchSrgb, name: 'oklchSrgb' }, p3: { lut: oklchP3, name: 'oklchP3' } },
  lchuv: { srgb: { lut: lchuvSrgb, name: 'lchuvSrgb' }, p3: { lut: lchuvP3, name: 'lchuvP3' } },
  lch: { srgb: { lut: lchSrgb, name: 'lchSrgb' }, p3: { lut: lchP3, name: 'lchP3' } },
  hct: { srgb: { lut: hctSrgb, name: 'hctSrgb' }, p3: { lut: hctP3, name: 'hctP3' } },
};

// the picker lists these, in this order
export const MODELS: Model[] = ['oklch', 'lchuv', 'lch', 'hct'];
// the space Wijffelaars et al. work in (CIELUV)
export const PAPER_MODEL: Model = 'lchuv';
// where the usage snippet imports each model's LUTs from
export const lutModule = (model: Model): string => (model === 'hct' ? 'nutelch/hct' : 'nutelch');

export const lutFor = (model: Model, gamut: GamutId): Lut => LUTS[model][gamut].lut;
export const lutName = (model: Model, gamut: GamutId): string => LUTS[model][gamut].name;

const P3_LUTS = new Set<Lut>([oklchP3, lchuvP3, lchP3, hctP3]);
export const isP3 = (lut: Lut): boolean => P3_LUTS.has(lut);
// cache key / SVG id fragment: distinct per LUT, so figures never mix spaces
export const lutTag = (lut: Lut): string => `${lut.mode}-${isP3(lut) ? 'p3' : 'srgb'}`;
export const culoriGamut = (lut: Lut): 'p3' | 'rgb' => (isP3(lut) ? 'p3' : 'rgb');

export const MODEL_LABEL: Record<Model, string> = { oklch: 'okLch', lchuv: 'LCHuv', lch: 'LCH', hct: 'HCT' };

// digits for chroma / lightness readouts on each space's scale
export const cDigits = (lut: Lut): number => (lut.lMax === 1 ? 3 : 1);
export const lDigits = (lut: Lut): number => (lut.lMax === 1 ? 2 : 0);

// a 1 / 2 / 2.5 / 5 × 10^k step giving ~4 ticks up to `max`, on any scale
export function niceStep(max: number): number {
  const raw = max / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  for (const m of [1, 2, 2.5, 5, 10]) if (raw <= m * pow) return m * pow;
  return 10 * pow;
}
