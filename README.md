# CuspHanger

A faithful OKLCH implementation of Wijffelaars, Vliegen, van Wijk & van der Linden,
*"Generating Color Palettes using Intuitive Parameters"*
([Computer Graphics Forum 27:3, 2008](https://doi.org/10.1111/j.1467-8659.2008.01203.x)).

The paper generates **sequential** and **diverging** palettes from a few intuitive parameters by
walking a quadratic-Bézier path through the gamut triangle (black · cusp · white) of a hue. It was
written for CIELUV; this is that exact model re-expressed in **OKLCH**, so it can also target
Display-P3.

## How it works

For a fixed hue, the displayable colors approximate a triangle in the chroma–lightness plane with
corners at black, white, and the **cusp** — the most saturated color that hue can reach (the paper's
*MSC*). A palette is a quadratic-Bézier path through that triangle, sampled at perceptual lightness
steps. The cusp / triangle being an inner approximation of the gamut keeps the result displayable.

The knobs are the paper's:

- **`saturation` (s)** — the curve's tension. `0` is a gray ramp; `1` bends the path through the cusp.
- **`brightness` (b)** and **`contrast` (c)** — shape the lightness sampling (`L(t)`).
- **`coolWarm` (w)** — multi-hue shift that pulls the light end toward yellow (Table 2).

## Install

```bash
npm install cusphanger nutelch
```

Gamut math is delegated to [nutelch](https://github.com/meodai/nutLCh) (LUT-backed, runtime
dependency-free), so you pass the gamut **LUT** in (just like nutelch) — `oklchSrgb` or `oklchP3`.

## Usage

```ts
import { sequential, diverging } from 'cusphanger';
import { oklchSrgb, oklchP3, toCss } from 'nutelch';

// single-hue sequential (paper, Table 1)
sequential({ hStart: 260, total: 9, saturation: 0.6, brightness: 0.75, contrast: 0.88, lut: oklchSrgb });

// cool/warm multi-hue (Table 2)
sequential({ hStart: 260, total: 9, coolWarm: 0.15, lut: oklchSrgb });

// diverging — two sequentials joined through a shared neutral
diverging({ hStart: 250, hEnd: 30, total: 9, lut: oklchSrgb });

// Display-P3 target — just pass the P3 LUT
sequential({ hStart: 260, total: 9, lut: oklchP3 });

// lightness by endpoints instead of brightness/contrast (RampenSau-style lRange)
sequential({ hStart: 260, total: 9, lRange: [0.25, 0.95], lut: oklchSrgb });

// saturation as a (gamut-relative) range that varies across the ramp
sequential({ hStart: 260, total: 9, sRange: [0, 1], lut: oklchSrgb }); // gray dark → vivid light
```

Option names follow RampenSau's conventions where they correspond (`total`, `hStart`/`hEnd`); the
paper-specific knobs keep their own names. Defaults follow the paper: `saturation = 0.6`,
`brightness = 0.75`, `contrast = min(0.88, 0.34 + 0.06·total)`, `coolWarm = 0`.

**Lightness — two equivalent knobs.** `brightness`/`contrast` are the paper's `b`/`c`; `lRange:
[minLight, maxLight]` sets the two endpoints directly (RampenSau-style) and wins when given. They're
a bijection — the same lightness curve, with the paper's perceptual `0.2^x` spacing kept between the
endpoints either way.

Each color is the nutelch / culori-native OKLCH object:

```ts
{ mode: 'oklch', l, c, h }
```

It's in-gamut by construction (clamped to the LUT's shell). To render it, hand it to nutelch's
`toCss` — the browser renders `oklch()` natively and gamut-maps to the display:

```ts
el.style.background = toCss(palette[0]); // 'oklch(0.44 0.13 260)'
```

For a hex string or gamut flags (interchange, contrast math), use [culori](https://culorijs.org):
`formatHex(color)`, `inGamut('rgb')(color)`.

Also exported, both taking a nutelch LUT: `cusp(hue, lut)` (the MSC apex) and
`maxChromaAt(hue, l, lut)` (the gamut shell at a lightness).

## Develop

```bash
npm run dev        # demo
npm test           # unit tests
npm run build:lib  # build the library
```

## License

MIT
