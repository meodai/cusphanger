# CuspHanger

OKLCH color-palette generator with intuitive parameters — sequential, diverging, and qualitative
palettes built on a unified trajectory engine with **gamut-relative saturation**.

Inspired by Wijffelaars et al., *"Generating Color Palettes using Intuitive Parameters"* (2008),
re-expressed in OKLCH, with per-channel trajectory ergonomics à la
[RampenSau](https://github.com/meodai/rampensau).

## Why "gamut-relative saturation"?

`saturation` is a fraction (0–1) of the **maximum in-gamut chroma** at each hue and lightness, so a
single saturation knob stays meaningful across every hue and lightness, output is in-gamut by
construction, and chroma automatically peaks at the gamut **cusp**.

## Install

```bash
npm install cusphanger
```

## Usage

```ts
import { sequential, diverging, qualitative, generatePalette } from 'cusphanger';

sequential({ hue: 260, count: 9 });
diverging({ hueLeft: 250, hueRight: 30, count: 9 });
qualitative({ count: 8 });

// Power-user trajectory engine:
generatePalette({
  total: 9,
  hueStart: 200,
  hueCycles: 0.3,
  lightnessRange: [0.9, 0.25],
  saturationRange: [0.85, 0.85],
  gamut: 'display-p3',
});
```

Each color is returned as:

```ts
{ oklch: { l, c, h }, hex, css, inSrgb, inP3 }
```

`css` is `oklch(...)` for the sRGB target and `color(display-p3 ...)` for the P3 target.

## Develop

```bash
npm run dev        # demo
npm test           # unit tests
npm run build:lib  # build the library
```

## License

MIT
