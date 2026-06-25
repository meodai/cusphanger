# OKLCH Palette Generator — Design Spec

**Date:** 2026-06-25
**Status:** Approved (design)

## Summary

A TypeScript library + interactive demo that generates **sequential**, **diverging**, and
**qualitative** color palettes from a small set of **intuitive parameters**, implementing the
method of Wijffelaars, Vliegen, van Wijk & van der Linden, *"Generating Color Palettes using
Intuitive Parameters"* (Computer Graphics Forum 27:3, 2008) — re-expressed in **OKLCH** instead
of the paper's CIELUV.

The project ships as:
- A dependency-light **library** (`src/lib/`) using [Culori](https://culorijs.org) for color
  conversion and gamut mapping.
- A **vanilla TS + Vite demo** (`src/demo/`) with live controls, swatches, contrast badges, and
  an sRGB/P3 toggle.

## Background — the model

The paper's central observation: for a **fixed hue**, the set of displayable colors, projected
onto the (chroma, lightness) plane, is approximately a **triangle** with corners at:

- black `(L = 0, C = 0)`
- white `(L = 1, C = 0)`
- the **cusp** — the maximum-chroma color for that hue (the paper's "most saturated corner";
  Ottosson's term in the OKLab literature).

Palettes are **smooth paths** through this region, controlled by intuitive knobs. Porting to
OKLCH is a natural fit: the cusp and the gamut boundary are well-defined in OKLab, and Culori's
`toGamut` / chroma clamping gives us the real boundary per target gamut (sRGB or Display-P3)
rather than a triangle approximation.

### Normalized (s, L) space

Internally a color is represented as **(s, L)** where:
- `L ∈ [0, 1]` — OKLCH lightness.
- `s ∈ [0, 1]` — **saturation**, the fraction of the maximum in-gamut chroma at that lightness
  and hue. So actual `C = s · maxChroma(hue, L, gamut)`.

This makes `s` behave intuitively: `s = 1` always rides the gamut boundary (most colorful
possible), `s = 0` is neutral gray, independent of how much chroma the hue/lightness physically
allows. This is the key trick that makes a single "saturation" slider meaningful across hues.

## Architecture

### Library (`src/lib/`)

| Module | Responsibility |
| --- | --- |
| `gamut.ts` | `cusp(hue, gamut)` → `{ L, C }`; `maxChromaAt(hue, L, gamut)` → number. Uses Culori (`oklch`, `toGamut`/`clampChroma`, `inGamut`) plus a binary search for max chroma. Results memoized per (hue, gamut). |
| `space.ts` | `(s, L, hue) → oklch` and `oklch → (s, L)`. Wraps `maxChromaAt`. |
| `path.ts` | `quadBezier(p0, p1, p2, t)` in (s, L) space; helpers for sampling `n` points across `t ∈ [0,1]`. |
| `palettes.ts` | `generateSequential`, `generateDiverging`, `generateQualitative`. |
| `color.ts` | `toPaletteColor(oklch, gamut)` → `PaletteColor` (oklch + hex + css + gamut flags). |
| `index.ts` | Public exports and types. |

### Demo (`src/demo/`)

| Module | Responsibility |
| --- | --- |
| `main.ts` | Bootstraps tabs, wires controls → lib → render. |
| `controls.ts` | Builds slider/number/select inputs per palette type; emits a typed options object on change. |
| `swatches.ts` | Renders the palette strip: each swatch shows OKLCH + hex, WCAG + APCA badge, gamut warning, copy-on-click. |
| `contrast.ts` | WCAG ratio via Culori `wcagContrast`; APCA Lc via a small local implementation of the APCA-W3 0.1.9 formula (no extra dependency). |
| `style.css` | Layout + theming. |

## Public API

```ts
export type Gamut = 'srgb' | 'display-p3';

export interface PaletteColor {
  oklch: { l: number; c: number; h: number }; // l,c in [0..~], h in [0,360)
  hex: string;       // sRGB hex, gamut-clamped (always renderable)
  css: string;       // 'oklch(...)' for srgb target, 'color(display-p3 ...)' for p3 target
  inSrgb: boolean;
  inP3: boolean;
}

export interface SequentialOptions {
  hue: number;            // 0..360 base hue
  count: number;          // number of colors (>= 2)
  saturation?: number;    // 0..1, colorfulness of the most-saturated color. default 0.9
  lightnessHigh?: number; // 0..1, lightness of the lightest color. default 0.95
  lightnessLow?: number;  // 0..1, lightness of the darkest color. default 0.2
  hueShift?: number;      // degrees, hue rotation light→dark (multi-hue ramp). default 0
  gamut?: Gamut;          // default 'srgb'
}

export interface DivergingOptions {
  hueLeft: number;
  hueRight: number;
  count: number;          // odd → shared neutral center
  saturation?: number;    // default 0.9
  centerLightness?: number; // 0..1 lightness of the neutral midpoint. default 0.95
  lightnessLow?: number;  // dark ends. default 0.35
  gamut?: Gamut;
}

export interface QualitativeOptions {
  count: number;
  hueRange?: [number, number]; // default [0, 360); colors spread evenly within
  lightness?: number;     // 0..1 shared lightness. default 0.7
  saturation?: number;    // 0..1 shared saturation. default 0.7
  gamut?: Gamut;
}

export function generateSequential(o: SequentialOptions): PaletteColor[];
export function generateDiverging(o: DivergingOptions): PaletteColor[];
export function generateQualitative(o: QualitativeOptions): PaletteColor[];
```

## Algorithm detail

### Sequential

Sample a **quadratic Bézier** `B(t)` in (s, L) space for `t ∈ [0, 1]`, `t = 0` = lightest,
`t = 1` = darkest, across `count` evenly spaced `t`:

- `P0 = (s = saturation · 0.15, L = lightnessHigh)` — light, near-neutral end.
- `P1 = (s = saturation,        L = L_cusp)` — control point at the cusp lightness; pulls
  mid-tones toward maximum colorfulness (this is what makes the ramp "pop" in the middle, per
  the paper).
- `P2 = (s = saturation,        L = lightnessLow)` — dark, saturated end.

`L_cusp` is the lightness of `cusp(hue, gamut)`. Hue is constant for single-hue; for a multi-hue
ramp, `hue(t) = baseHue + hueShift · t` (shortest-arc rotation). Each sampled `(s, L, hue)` is
converted to OKLCH via `space.ts`, then to `PaletteColor`.

### Diverging

Two sequential half-ramps that **share a light neutral center**:
- Left half: sequential from `centerLightness` (light, low s) at `hueLeft` down to `lightnessLow`.
- Right half: same at `hueRight`.
- For odd `count`, the center color is shared; for even `count`, no exact center.
Concatenate: `[...leftReversed, (center), ...right]`.

### Qualitative

Distribute `count` hues evenly across `hueRange`. For each hue, set `L = lightness` and
`C = saturation · maxChroma(hue, L, gamut)`. Because chroma is scaled per-hue, all swatches sit
at a comparable visual saturation and are gamut-safe, giving even, distinct categoricals.

### Gamut handling

`maxChromaAt` and `cusp` are computed against the **target gamut**. Output `css` uses
`color(display-p3 ...)` when `gamut = 'display-p3'`, else `oklch(...)`. `hex` is always an
sRGB-clamped fallback (via Culori `toGamut('rgb')`) so every swatch renders somewhere. `inSrgb`
/ `inP3` flags report true gamut membership of the unclamped OKLCH color.

## Testing (Vitest)

- **Gamut safety:** every generated color is in its target gamut (within tolerance).
- **Sequential monotonic lightness:** L strictly decreases from first to last.
- **Sequential saturation peak:** mid-tone chroma fraction ≥ endpoints (control-point effect).
- **Diverging symmetry:** for symmetric inputs, left/right lightness profiles mirror; odd count
  shares an exact center.
- **Qualitative distinctness:** pairwise OKLab ΔE between adjacent hues exceeds a floor; hues are
  evenly spaced within `hueRange`.
- **Cusp sanity:** `cusp(hue)` chroma ≥ `maxChromaAt(hue, L)` for all sampled L.

## Tooling

- **Vite** (library + demo). `vite build` with `lib` config to emit ESM (+ types via
  `vite-plugin-dts`) for the library; the demo builds as a normal app.
- **TypeScript** strict mode.
- **Vitest** for unit tests.
- Dependencies: `culori`. Dev: `vite`, `typescript`, `vitest`, `vite-plugin-dts`.

## Out of scope (YAGNI for v1)

- Data-viz / heatmap preview surface (swatches + contrast only).
- Palette persistence, sharing URLs, export to design-tool formats.
- CVD simulation in the demo (Culori supports it; can add later).
- Frameworks (React/Svelte) — vanilla TS only.

## Naming

Package name: `oklch-palettes` (working title; confirm before publish).
