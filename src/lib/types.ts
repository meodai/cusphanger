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

// Wijffelaars, Vliegen, van Wijk & van der Linden (2009), single-hue sequential
// model (Table 1) plus the cool/warm multi-hue extension (Table 2). This is
// the paper's surface, nothing else — the RampenSau-style extensions live on
// RampOptions / ramp(). Option names follow RampenSau's conventions where they
// correspond (total, hStart); the paper knobs (s/b/c/w) have no counterpart.
export interface SequentialOptions {
  total: number; // N — number of colors
  hStart: number; // h — base hue
  saturation?: number; // s — Bézier tension (0 = gray ramp, 1 = through the cusp). default 0.6
  brightness?: number; // b — start of the lightness curve. default 0.75
  contrast?: number; // c — lightness span. default min(0.88, 0.34 + 0.06·total)
  // Alternative to brightness/contrast: set the lightness endpoints directly
  // (RampenSau-style lRange). Wins when given; the paper's perceptual 0.2^x
  // spacing is kept between the endpoints — a pure re-parameterization, which
  // is why it stays on the paper surface. [minLight, maxLight], 0..1.
  lRange?: [number, number];
  coolWarm?: number; // w — the paper's multi-hue shift of the light end toward yellow. default 0
  lut: Lut; // a nutelch OKLCH LUT (oklchSrgb / oklchP3) — which gamut to target
}

// ramp(): the RampenSau hybrid — each color rides the paper's ramp for its own
// hue along a RampenSau-style hue trajectory. Extends the paper surface; every
// extension is opt-in and hCycles = 0 with none of them set collapses to
// sequential() exactly. coolWarm crosses the boundary with changed semantics:
// under a shared triangleMode it nudges the light colors' hues toward the
// bright point instead of shifting the triangle (the paper's construction
// can't apply — there is no per-hue triangle to shift).
export interface RampOptions extends SequentialOptions {
  // vary the (gamut-relative) tension across the ramp instead of a single
  // `saturation`. Wins when given. [sMin, sMax], 0..1.
  sRange?: [number, number];
  sEasing?: (t: number) => number; // easing for sRange. default linear
  hCycles?: number; // hue rotations across the ramp. default 0
  hStartCenter?: number; // where hStart sits in the ramp (0..1). default 0.5
  hEasing?: (t: number) => number; // hue easing. default linear
  // RampenSau-style hueList: an explicit hue per color. Overrides total (the
  // palette gets hueList.length colors) and the whole hue trajectory (hStart /
  // hCycles / hStartCenter / hEasing). Pairs with RampenSau's uniqueRandomHues
  // and colorHarmonies; each color still rides the paper's ramp for its hue.
  hueList?: number[];
  triangleMode?: TriangleMode; // chroma envelope for multi-hue ramps. default 'perHue'
}

// Diverging: two sequential palettes joined through a shared neutral point.
// The arms are plain single-hue sequentials (the paper's construction), so no
// hue-trajectory options — but the arm tension may ramp (sRange/sEasing, a
// deliberate RampenSau-parity passthrough applied to each arm symmetrically).
export interface DivergingOptions extends SequentialOptions {
  hEnd: number; // right-arm hue (hStart is the left arm)
  sRange?: [number, number]; // alternative to saturation, per arm (see RampOptions)
  sEasing?: (t: number) => number; // easing for sRange, per arm. default linear
}

