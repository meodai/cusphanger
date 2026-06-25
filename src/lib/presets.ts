import { generatePalette } from './engine';
import { relativeToOklch } from './space';
import { toPaletteColor } from './color';
import type {
  PaletteColor,
  SequentialOptions,
  DivergingOptions,
  QualitativeOptions,
} from './types';

export function sequential(o: SequentialOptions): PaletteColor[] {
  const {
    hue,
    count,
    saturation = 0.9,
    lightnessHigh = 0.95,
    lightnessLow = 0.2,
    hueShift = 0,
    chromaMode = 'envelope',
    gamut = 'srgb',
  } = o;
  return generatePalette({
    total: count,
    hueStart: hue,
    hueCycles: hueShift / 360,
    lightnessRange: [lightnessHigh, lightnessLow],
    saturationRange: [saturation, saturation],
    chromaMode,
    gamut,
  });
}

export function diverging(o: DivergingOptions): PaletteColor[] {
  const {
    hueLeft,
    hueRight,
    count,
    saturation = 0.9,
    centerLightness = 0.95,
    lightnessLow = 0.35,
    chromaMode = 'envelope',
    gamut = 'srgb',
  } = o;
  const isOdd = count % 2 === 1;
  const side = Math.floor(count / 2); // non-center colors per side

  // dark+saturated -> light+neutral ramp (saturation fades to 0 at the center)
  const ramp = (hue: number): PaletteColor[] =>
    generatePalette({
      total: side + 1,
      hueStart: hue,
      lightnessRange: [lightnessLow, centerLightness],
      saturationRange: [saturation, 0],
      chromaMode,
      gamut,
    });

  const leftSide = ramp(hueLeft).slice(0, side); // dark -> toward center (ascending L)
  const rightSide = ramp(hueRight).slice(0, side); // dark -> toward center (ascending L)
  const center = toPaletteColor(relativeToOklch(0, centerLightness, hueLeft, gamut, chromaMode), gamut);

  return [
    ...leftSide,
    ...(isOdd ? [center] : []),
    ...rightSide.slice().reverse(), // center -> dark (descending L)
  ];
}

export function qualitative(o: QualitativeOptions): PaletteColor[] {
  const {
    count,
    hueRange = [0, 360],
    lightness = 0.7,
    saturation = 0.7,
    chromaMode = 'envelope',
    gamut = 'srgb',
  } = o;
  const [h0, h1] = hueRange;
  const span = h1 - h0;
  const fullCircle = Math.abs(((span % 360) + 360) % 360) < 1e-9 && span !== 0;
  const out: PaletteColor[] = [];
  for (let i = 0; i < count; i++) {
    const frac = fullCircle ? i / count : count <= 1 ? 0 : i / (count - 1);
    const hue = (((h0 + span * frac) % 360) + 360) % 360;
    out.push(toPaletteColor(relativeToOklch(saturation, lightness, hue, gamut, chromaMode), gamut));
  }
  return out;
}
