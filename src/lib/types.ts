export type Gamut = 'srgb' | 'display-p3';

// For multi-hue ramps (hCycles): which gamut triangle each color rides toward.
// - 'perHue': each color uses its own hue's cusp (faithful; chroma peaks).
// - 'min'/'avg'/'max': all colors share one triangle (the min / mean / max cusp
//   of the ramp's hues), so colorfulness is even across hues. 'min' is the
//   paper's open "equal colorfulness" idea.
export type TriangleMode = 'perHue' | 'min' | 'avg' | 'max';

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
  coolWarm?: number; // w — the paper's multi-hue shift of the light end toward yellow. default 0
  // RampenSau-style hue trajectory (an EXTENSION beyond the paper): each color is
  // the paper's single-hue ramp for its own rotated hue, so it stays faithful.
  // hCycles = 0 collapses to the single-hue model.
  hCycles?: number; // hue rotations across the ramp. default 0
  hStartCenter?: number; // where hStart sits in the ramp (0..1). default 0.5
  hEasing?: (t: number) => number; // hue easing. default linear
  triangleMode?: TriangleMode; // chroma envelope for multi-hue ramps. default 'perHue'
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

