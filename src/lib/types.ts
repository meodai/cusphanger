import type { Lut } from 'nutelch';

// Re-exported so callers can type the LUT they pass (import the VALUES —
// `oklchSrgb` / `oklchP3` — from 'nutelch' directly).
export type { Lut } from 'nutelch';

// For multi-hue ramps (hCycles): which gamut triangle each color rides toward.
// - 'perHue': each color uses its own hue's cusp (faithful; chroma peaks).
// - 'min'/'avg'/'max': all colors share one triangle (the min / mean / max cusp
//   of the ramp's hues), so colorfulness is even across hues. 'min' is the
//   paper's open "equal colorfulness" idea.
export type TriangleMode = 'perHue' | 'min' | 'avg' | 'max';

// A color is the culori / nutelch-native OKLCH object. Hand it to `toCss()` (or
// any culori formatter) for a string — the browser renders `oklch()` natively
// and gamut-maps to the display. Palette colors are in-gamut by construction
// (clamped to the target gamut's shell during generation).
export interface OklchColor {
  mode: 'oklch';
  l: number; // 0..1
  c: number; // >= 0
  h: number; // 0..360
}

// Wijffelaars, Vliegen, van Wijk & van der Linden (2008), single-hue sequential
// model (Table 1) plus the cool/warm multi-hue extension (Table 2).
// Option names follow RampenSau's conventions where they correspond (total,
// hStart); the paper-specific knobs (s/b/c/w) have no RampenSau equivalent.
export interface SequentialOptions {
  total: number; // N — number of colors
  hStart: number; // h — base hue
  saturation?: number; // s — Bézier tension (0 = gray ramp, 1 = through the cusp). default 0.6
  // Alternative to `saturation`: vary the (gamut-relative) tension across the
  // ramp (RampenSau-style sRange). Wins when given. [sMin, sMax], 0..1.
  sRange?: [number, number];
  sEasing?: (t: number) => number; // easing for sRange. default linear
  brightness?: number; // b — start of the lightness curve. default 0.75
  contrast?: number; // c — lightness span. default min(0.88, 0.34 + 0.06·total)
  // Alternative to brightness/contrast: set the lightness endpoints directly
  // (RampenSau-style lRange). Wins when given; the paper's perceptual 0.2^x
  // spacing is kept between the endpoints. [minLight, maxLight], 0..1.
  lRange?: [number, number];
  coolWarm?: number; // w — the paper's multi-hue shift of the light end toward yellow. default 0
  // RampenSau-style hue trajectory (an EXTENSION beyond the paper): each color is
  // the paper's single-hue ramp for its own rotated hue, so it stays faithful.
  // hCycles = 0 collapses to the single-hue model.
  hCycles?: number; // hue rotations across the ramp. default 0
  hStartCenter?: number; // where hStart sits in the ramp (0..1). default 0.5
  hEasing?: (t: number) => number; // hue easing. default linear
  triangleMode?: TriangleMode; // chroma envelope for multi-hue ramps. default 'perHue'
  lut: Lut; // a nutelch OKLCH LUT (oklchSrgb / oklchP3) — which gamut to target
}

// Diverging: two sequential palettes joined through a shared neutral point.
export interface DivergingOptions {
  total: number;
  hStart: number; // left-arm hue
  hEnd: number; // right-arm hue
  saturation?: number;
  sRange?: [number, number]; // alternative to saturation (see SequentialOptions)
  brightness?: number;
  contrast?: number;
  lRange?: [number, number]; // alternative to brightness/contrast (see SequentialOptions)
  coolWarm?: number;
  lut: Lut; // a nutelch OKLCH LUT (oklchSrgb / oklchP3) — which gamut to target
}

