export type Gamut = 'srgb' | 'display-p3';

export interface Oklch {
  l: number; // 0..1
  c: number; // >= 0
  h: number; // 0..360
}

export interface PaletteColor {
  oklch: Oklch;
  hex: string; // sRGB hex, gamut-clamped (always renderable)
  css: string; // 'oklch(...)' for srgb target; 'color(display-p3 ...)' for p3 target
  inSrgb: boolean;
  inP3: boolean;
}

// Wijffelaars, Vliegen, van Wijk & van der Linden (2008), single-hue sequential
// model (Table 1) plus the cool/warm multi-hue extension (Table 2).
// Option names follow RampenSau's conventions where they correspond (total,
// hStart); the paper-specific knobs (s/b/c/w) have no RampenSau equivalent.
export interface SequentialOptions {
  total: number; // N — number of colors
  hStart: number; // h — base hue
  saturation?: number; // s — Bézier tension (0 = gray ramp, 1 = through the cusp). default 0.6
  brightness?: number; // b — start of the lightness curve. default 0.75
  contrast?: number; // c — lightness span. default min(0.88, 0.34 + 0.06·total)
  coolWarm?: number; // w — multi-hue shift toward yellow. default 0
  gamut?: Gamut;
}

// Diverging: two sequential palettes joined through a shared neutral point.
export interface DivergingOptions {
  total: number;
  hStart: number; // left-arm hue
  hEnd: number; // right-arm hue
  saturation?: number;
  brightness?: number;
  contrast?: number;
  coolWarm?: number;
  gamut?: Gamut;
}

