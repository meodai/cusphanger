import type { Easing } from './easing';

export type { Easing };

export type Gamut = 'srgb' | 'display-p3';

export interface Oklch {
  l: number; // 0..1
  c: number; // >= 0
  h: number; // 0..360
}

export interface PaletteColor {
  oklch: Oklch;
  hex: string;       // sRGB hex, gamut-clamped (always renderable)
  css: string;       // 'oklch(...)' for srgb target; 'color(display-p3 ...)' for p3 target
  inSrgb: boolean;
  inP3: boolean;
}

export interface PaletteOptions {
  total: number;                       // number of colors (>= 1)
  hueStart: number;                    // 0..360
  hueCycles?: number;                  // revolutions; fractional & negative allowed. default 0
  hueEasing?: Easing;                  // default linear
  hueStartCenter?: number;             // 0..1, where start hue sits in ramp. default 0
  lightnessRange?: [number, number];   // [start, end]. default [0.95, 0.2]
  lightnessEasing?: Easing;            // default linear
  saturationRange?: [number, number];  // gamut-relative s. default [0.9, 0.9]
  saturationEasing?: Easing;           // non-monotonic allowed. default linear
  gamut?: Gamut;                       // default 'srgb'
}

export interface SequentialOptions {
  hue: number;
  count: number;
  saturation?: number;    // gamut-relative saturation. default 0.9
  lightnessHigh?: number; // lightest. default 0.95
  lightnessLow?: number;  // darkest. default 0.2
  hueShift?: number;      // degrees, light->dark hue rotation. default 0
  gamut?: Gamut;
}

export interface DivergingOptions {
  hueLeft: number;
  hueRight: number;
  count: number;            // odd -> shared neutral center
  saturation?: number;      // default 0.9
  centerLightness?: number; // neutral midpoint lightness. default 0.95
  lightnessLow?: number;    // dark ends. default 0.35
  gamut?: Gamut;
}

export interface QualitativeOptions {
  count: number;
  hueRange?: [number, number]; // colors spread evenly within. default [0, 360]
  lightness?: number;     // shared lightness. default 0.7
  saturation?: number;    // shared gamut-relative saturation. default 0.7
  gamut?: Gamut;
}
