import type { Easing } from './easing';

export type { Easing };

export type Gamut = 'srgb' | 'display-p3';

// How the saturation value `s` is interpreted:
// - 'envelope': fraction of the max in-gamut chroma at each lightness
//   (C = s * maxChromaAt(hue, L)). Chroma fades toward the light/dark ends.
// - 'cusp': fraction of the hue's single cusp chroma, clamped to stay in gamut
//   (C = min(s * cuspChroma(hue), maxChromaAt(hue, L))). Roughly constant chroma
//   per hue, but different hues reach different peaks.
// - 'shared': fraction of the highest chroma common to ALL hues (the minimum of
//   every hue's cusp chroma), clamped to stay in gamut. s=1 is the same absolute
//   chroma for every hue, so a multi-hue palette has uniform colorfulness.
// - 'absolute': fraction of the max cusp chroma, applied as a raw chroma for
//   every hue and lightness and NOT clamped to the gamut — like RampenSau. The
//   out-of-gamut result is left for the renderer/browser to gamut-map, so it can
//   look different across browsers and displays. Included as a baseline that
//   shows why the three gamut-aware modes are the better techniques.
export type ChromaMode = 'envelope' | 'cusp' | 'shared' | 'absolute';

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
  chromaMode?: ChromaMode;             // saturation reference. default 'envelope'
  gamut?: Gamut;                       // default 'srgb'
}

export interface SequentialOptions {
  hue: number;
  count: number;
  saturation?: number;    // gamut-relative saturation. default 0.9
  lightnessHigh?: number; // lightest. default 0.95
  lightnessLow?: number;  // darkest. default 0.2
  hueShift?: number;      // degrees, light->dark hue rotation. default 0
  chromaMode?: ChromaMode; // saturation reference. default 'envelope'
  gamut?: Gamut;
}

export interface DivergingOptions {
  hueLeft: number;
  hueRight: number;
  count: number;            // odd -> shared neutral center
  saturation?: number;      // default 0.9
  centerLightness?: number; // neutral midpoint lightness. default 0.95
  lightnessLow?: number;    // dark ends. default 0.35
  chromaMode?: ChromaMode;  // saturation reference. default 'envelope'
  gamut?: Gamut;
}

export interface QualitativeOptions {
  count: number;
  hueRange?: [number, number]; // colors spread evenly within. default [0, 360]
  lightness?: number;     // shared lightness. default 0.7
  saturation?: number;    // shared gamut-relative saturation. default 0.7
  chromaMode?: ChromaMode; // saturation reference. default 'envelope'
  gamut?: Gamut;
}
