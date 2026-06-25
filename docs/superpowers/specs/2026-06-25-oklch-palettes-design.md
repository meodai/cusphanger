# OKLCH Palette Generator — Design Spec

**Date:** 2026-06-25
**Status:** Approved (design)

## Summary

A TypeScript library + interactive demo that generates color palettes in **OKLCH** from
**intuitive parameters**, combining two ideas:

- **Wijffelaars, Vliegen, van Wijk & van der Linden (2008)**, *"Generating Color Palettes using
  Intuitive Parameters"* (CGF 27:3) — the gamut-aware model where, for a fixed hue, usable colors
  form a triangle in (chroma, lightness) capped at the **cusp** (max-chroma point), and palettes
  are smooth paths through it. Ported from the paper's CIELUV to **OKLCH**.
- **RampenSau** (meodai) — the **per-channel trajectory** ergonomics: each of hue / lightness /
  saturation is `range + easing`, with hue additionally getting **cycles** (revolutions).

The synthesis: a **unified trajectory engine** (RampenSau-shaped) whose **saturation axis is
gamut-relative** (the paper's contribution — `s` = fraction of the cusp's chroma, so output is
in-gamut by construction and perceptually even across hues), with thin **intuitive presets**
(`sequential` / `diverging` / `qualitative`) layered on top.

Ships as:
- A library (`src/lib/`) using [Culori](https://culorijs.org) for conversion + gamut mapping.
- A **vanilla TS + Vite demo** (`src/demo/`) with live controls, swatches, contrast badges, sRGB/P3 toggle.

## The model

### Cusp + triangle (from the paper)

For a fixed hue, displayable colors projected onto (chroma, lightness) approximate a triangle:
corners at black `(L=0,C=0)`, white `(L=1,C=0)`, and the **cusp** = max-chroma color for that hue.
Ported to OKLCH, the cusp and gamut boundary are found per target gamut (sRGB / Display-P3) via
Culori, giving the real boundary rather than only the triangle approximation.

### Gamut-relative saturation (the key decision)

A color is internally **(s, L, hue)** where:
- `L ∈ [0,1]` — OKLCH lightness.
- `s ∈ [0,1]` — **saturation = fraction of the maximum in-gamut chroma** at that hue + lightness.
  Actual `C = s · maxChroma(hue, L, gamut)`.

`s = 1` always rides the gamut boundary; `s = 0` is neutral. This is deliberately **not**
RampenSau's raw `sRange`: a raw chroma range means a different thing at every lightness and
reintroduces clipping. Gamut-relative `s` keeps a single "saturation" knob meaningful across all
hues and lightnesses, and guarantees in-gamut output.

### Per-channel trajectories (from RampenSau)

The palette is sampled across `total` points `t ∈ [0,1]`. Each channel is an independent
trajectory:
- **hue:** `hueStart + 360 · hueCycles · hueEasing(t)`, optionally offset by `hueStartCenter`.
- **lightness:** `lerp(lightnessRange, lightnessEasing(t))`.
- **saturation (relative):** `lerp(saturationRange, saturationEasing(t))` — `saturationEasing`
  may be **non-monotonic**; a mid-ramp hump reproduces the paper's "mid-tones pop" behavior
  (max colorfulness near the cusp lightness) without a special-case Bézier.

## Architecture

### Library (`src/lib/`)

| Module | Responsibility |
| --- | --- |
| `gamut.ts` | `cusp(hue, gamut)` → `{ L, C }`; `maxChromaAt(hue, L, gamut)` → number (binary search against Culori `inGamut`). Memoized per (hue, gamut). |
| `space.ts` | `relativeToOklch(s, L, hue, gamut)` and `oklchToRelative(...)`. Wraps `maxChromaAt`. |
| `easing.ts` | Easing functions (linear, power, sine, lamé) + a `hump(peak)` helper for mid-ramp saturation peaks; `lerp`. |
| `engine.ts` | `generatePalette(PaletteOptions)` — the unified trajectory sampler. |
| `presets.ts` | `sequential`, `diverging`, `qualitative` — translate intuitive params → engine calls. |
| `color.ts` | `toPaletteColor(oklch, gamut)` → `PaletteColor` (oklch + hex + css + gamut flags). |
| `index.ts` | Public exports + types. |

### Demo (`src/demo/`)

| Module | Responsibility |
| --- | --- |
| `main.ts` | Bootstraps tabs (Sequential / Diverging / Qualitative + a raw "Engine" tab), wires controls → lib → render. |
| `controls.ts` | Builds slider/number/select inputs per tab; emits a typed options object on change. |
| `swatches.ts` | Renders the palette strip: each swatch shows OKLCH + hex, WCAG + APCA badge, gamut warning, copy-on-click. |
| `contrast.ts` | WCAG via Culori `wcagContrast`; APCA Lc via a small local APCA-W3 0.1.9 implementation (no dep). |
| `style.css` | Layout + theming. |

## Public API

```ts
export type Gamut = 'srgb' | 'display-p3';
export type Easing = (t: number) => number; // [0,1] → [0,1]

export interface PaletteColor {
  oklch: { l: number; c: number; h: number };
  hex: string;       // sRGB hex, gamut-clamped (always renderable)
  css: string;       // 'oklch(...)' for srgb target; 'color(display-p3 ...)' for p3 target
  inSrgb: boolean;
  inP3: boolean;
}

// ---- Engine (power-user / generative surface) ----
export interface PaletteOptions {
  total: number;                 // number of colors (>= 1)
  hueStart: number;              // 0..360
  hueCycles?: number;            // revolutions; fractional & negative allowed. default 0
  hueEasing?: Easing;            // default linear
  hueStartCenter?: number;       // 0..1, where the start hue sits in the ramp. default 0
  lightnessRange?: [number, number];  // [start, end]. default [0.95, 0.2]
  lightnessEasing?: Easing;      // default linear
  saturationRange?: [number, number]; // gamut-relative s. default [0.9, 0.9]
  saturationEasing?: Easing;     // non-monotonic allowed. default linear
  gamut?: Gamut;                 // default 'srgb'
}
export function generatePalette(o: PaletteOptions): PaletteColor[];

// ---- Presets (intuitive surface, per the paper) ----
export interface SequentialOptions {
  hue: number;
  count: number;
  saturation?: number;    // peak gamut-relative saturation. default 0.9
  lightnessHigh?: number; // lightest. default 0.95
  lightnessLow?: number;  // darkest. default 0.2
  hueShift?: number;      // degrees, light→dark hue rotation (multi-hue). default 0
  gamut?: Gamut;
}
export interface DivergingOptions {
  hueLeft: number;
  hueRight: number;
  count: number;            // odd → shared neutral center
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
export function sequential(o: SequentialOptions): PaletteColor[];
export function diverging(o: DivergingOptions): PaletteColor[];
export function qualitative(o: QualitativeOptions): PaletteColor[];
```

## Algorithm detail

### Engine `generatePalette`

For `i` in `0..total-1`, `t = total === 1 ? 0 : i/(total-1)`:
1. `hue = hueStart + 360 · hueCycles · hueEasing(t)`, shifted by `hueStartCenter` (mod 360).
2. `L = lerp(lightnessRange, lightnessEasing(t))`.
3. `s = clamp01(lerp(saturationRange, saturationEasing(t)))`.
4. `C = s · maxChromaAt(hue, L, gamut)` → OKLCH → `toPaletteColor`.

### Presets → engine

- **sequential** → `generatePalette({ total: count, hueStart: hue, hueCycles: hueShift/360,
  lightnessRange: [lightnessHigh, lightnessLow], saturationRange: [saturation, saturation],
  saturationEasing: hump(peak) })`, where `peak` is the `t` at which `L` crosses the cusp
  lightness (so mid-tones are most colorful, per the paper). gamut passed through.
- **diverging** → two sequential half-ramps (`hueLeft`, `hueRight`) each from `centerLightness`
  (light, low s) down to `lightnessLow`, mirrored around a shared center. Odd `count` shares the
  exact center color; even `count` has no exact center. A single hue trajectory cannot express
  two anchors + a pivot, so diverging is intentionally a **composition**, not one engine call.
- **qualitative** → `generatePalette({ total: count, hueStart: hueRange[0],
  hueCycles: span/360, lightnessRange: [lightness, lightness],
  saturationRange: [saturation, saturation] })`, where `span = hueRange[1] - hueRange[0]`. For a
  full-circle default, endpoints are made exclusive (`span · (count-1)/count` equivalent) so the
  first and last hue don't collide.

### Gamut handling

`cusp` / `maxChromaAt` are computed against the **target gamut**. Output `css` uses
`color(display-p3 ...)` when `gamut = 'display-p3'`, else `oklch(...)`. `hex` is always an
sRGB-clamped fallback (Culori `toGamut('rgb')`). `inSrgb` / `inP3` report true membership of the
unclamped OKLCH color.

## Testing (Vitest)

- **Gamut safety:** every generated color is in its target gamut (within tolerance).
- **Relative saturation invariant:** `s=1` lands within tolerance of `maxChromaAt` at its (hue,L);
  `s=0` is neutral.
- **Sequential monotonic lightness:** L strictly decreases first→last; mid-tone chroma fraction
  ≥ endpoints (hump / cusp effect).
- **Diverging symmetry:** symmetric inputs → mirrored lightness profiles; odd count shares an
  exact center.
- **Qualitative distinctness:** adjacent-hue OKLab ΔE exceeds a floor; hues evenly spaced within
  `hueRange` with no first/last collision on a full circle.
- **Engine:** `hueCycles` produces the expected total hue rotation; non-monotonic
  `saturationEasing` is respected.
- **Cusp sanity:** `cusp(hue).C ≥ maxChromaAt(hue, L)` for all sampled L.

## Tooling

- **Vite** — library build (`lib` config, ESM + types via `vite-plugin-dts`); demo builds as an app.
- **TypeScript** strict mode. **Vitest** for unit tests.
- Deps: `culori`. Dev: `vite`, `typescript`, `vitest`, `vite-plugin-dts`.

## Out of scope (YAGNI for v1)

- Data-viz / heatmap preview (swatches + contrast only).
- Palette persistence, share URLs, design-tool export formats.
- CVD simulation in the demo (Culori supports it; can add later).
- Frameworks (React/Svelte) — vanilla TS only.
- Harmony helpers / random-hue utilities (RampenSau already covers that ground).

## Naming

Package name: `oklch-palettes` (working title; confirm before publish).
