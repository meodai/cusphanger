# CuspHanger

A faithful OKLCH implementation of Wijffelaars, Vliegen, van Wijk & van der Linden,
*"Generating Color Palettes using Intuitive Parameters"*
([Computer Graphics Forum 28:3, EuroVis 2009](https://web.archive.org/web/20240628033734/https://citeseerx.ist.psu.edu/document?repid=rep1&type=pdf&doi=097749c130c1cf35b8b9c236916de3b0455ffce0)),
meant to cover more or less the same API as
[RampenSau](https://github.com/meodai/rampensau).

The paper generates **sequential** and **diverging** palettes from a few intuitive parameters by
walking a quadratic-Bézier path through the gamut triangle (black · cusp · white) of a hue. It was
written for CIELUV; this is that exact model re-expressed in **OKLCH**, so it can also target
Display-P3.

## How it works

For a fixed hue, the displayable colors approximate a triangle in the chroma–lightness plane with
corners at black, white, and the **cusp** — the most saturated color that hue can reach (the paper's
*MSC*). A palette is a quadratic-Bézier path through that triangle, sampled at perceptual lightness
steps. The cusp / triangle being an inner approximation of the gamut keeps the result displayable.

The paper's lightness curve is evaluated in its native CIE L\* units and converted to OKLab
lightness through luminance Y (for neutrals OKLab L = Y^⅓ exactly), so the palettes hit the same
physical lightnesses the paper calibrated against the Brewer palettes.

Diverging palettes sample the *joined* two-arm curve uniformly: odd N lands on the combined
neutral exactly once; even N straddles it at half-step spacing, so the step across the join reads
like every other step (under the default spacing — a non-linear `lEasing` eases each arm from its
dark end to the neutral, and trades that uniform join step for its own). The neutral is symmetric in the two arms (swapping `hStart`/`hEnd` mirrors
the palette, including with `coolWarm`).

The knobs are the paper's:

- **`saturation` (s)** — the curve's tension. `0` is a gray ramp; `1` bends the path through the cusp.
- **`brightness` (b)** and **`contrast` (c)** — shape the lightness sampling (`L(t)`).
- **`coolWarm` (w)** — multi-hue shift that pulls the light end toward yellow (Table 2).

## Install

```bash
npm install cusphanger nutelch
```

Gamut math is delegated to [nutelch](https://github.com/meodai/nutelch) (LUT-backed, runtime
dependency-free), so you pass the gamut **LUT** in (just like nutelch) — `oklchSrgb` or `oklchP3`.

## Usage

```ts
import { sequential, ramp, diverging, fromColor } from 'cusphanger';
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

// ramp() — the RampenSau hybrid: a hue trajectory through the paper's model
// (each color rides the paper's ramp for its own rotated hue)
ramp({ hStart: 260, total: 9, hCycles: 0.3, lut: oklchSrgb });

// saturation as a (gamut-relative) range that varies across the ramp
ramp({ hStart: 260, total: 9, sRange: [0, 1], lut: oklchSrgb }); // gray dark → vivid light

// an explicit hue per color (RampenSau-style hueList) — pairs with RampenSau's
// uniqueRandomHues / colorHarmonies. Overrides total and the hue trajectory.
ramp({ hStart: 0, total: 9, hueList: [10, 120, 240], lut: oklchSrgb });

// fromColor() — the inverse: solve the model so the palette meets a color you
// already have (see "fromColor" below)
fromColor({ mode: 'oklch', l: 0.58, c: 0.09, h: 155 }, { total: 9, lut: oklchSrgb });
```

`sequential()` and `diverging()` are the paper's surface plus a few opt-ins: `lEasing` on both
(see [Lightness spread](#lightness-spread--leasing)) and `sRange`/`sEasing` per diverging arm.
Leave them unset and you get the paper's model, exactly. `ramp()` is the RampenSau-shaped entry
point: `RampOptions` extends `SequentialOptions` with the hue trajectory (`hCycles`,
`hStartCenter`, `hEasing`, `hueList`), ramped tension (`sRange`/`sEasing`) and `triangleMode`;
with none of them set it equals `sequential()` exactly. Option names follow
RampenSau's conventions where they correspond (`total`, `hStart`/`hEnd`); the paper-specific knobs
keep their own names. Defaults follow the paper: `saturation = 0.6`, `brightness = 0.75`,
`contrast = min(0.88, 0.34 + 0.06·total)`, `coolWarm = 0`.

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

## fromColor — meet a color you already have

The inverse problem: you have a color (a brand green, a chart accent) and want the ramp that
passes through it. `fromColor` solves the sequential model for it and returns **options, not
colors**, so the solve stays inspectable and tweakable:

```ts
import { fromColor, sequential } from 'cusphanger';
import { oklchSrgb } from 'nutelch';

const target = { mode: 'oklch', l: 0.58, c: 0.09, h: 155 };

const { options, index, color, clamped } = fromColor(target, { total: 9, lut: oklchSrgb });
const palette = sequential(options);
palette[index]; // === target (exactly, when reachable)
```

Nothing is fitted — the constraints decouple. The hue is taken exactly (`hStart = target.h`, the
whole curve lives in the target's hue plane), `saturation` is bisected until the curve's chroma at
the target's lightness matches (as `s` goes 0 → 1 the curve sweeps from the gray axis out to the
triangle edges, so that chroma only grows), and the lightness endpoints shift minimally so sample
`index` lands on the target's lightness exactly.

- **`index`** — which palette entry carries the target. Defaults to `'nearest'` (the sample whose
  default-spacing lightness is closest, so the endpoints move least); pass a number to pin it.
- **`lRange`** — hold the lightness endpoints, and only hue + tension are solved. The continuous
  curve still passes through the target; `index` then reports the nearest sample.
- **`lEasing`** — hold a lightness easing. `index` and the endpoint solve are judged against the
  eased spacing and the easing is handed back in `options`, so the target still lands on a sample.
  Adding an `lEasing` to already-solved options instead moves the samples off the target (it stays
  on the continuous curve) — pass it to `fromColor`, not after it.
- **`clamped`** — reachability is the triangle (∩ the shell), not the full gamut. An unreachable
  target never throws: it is met at the same-lightness boundary point instead, returned as
  `color`, with `clamped: true`.
- **`coolWarm`** is deliberately absent — `w > 0` drifts hue along the curve, which breaks the hue
  decoupling. It is held at 0.

The target is the same OKLCH object the generators emit — no color parsing or conversion ships in
the library. A hex or CSS string is one [culori](https://culorijs.org) call away:
`converter('oklch')('#4a8a62')`. The demo's *from color* field is this solve, live: it snaps the
sliders to the returned options and rings the sample that carries the color.

## Lightness spread — lEasing

`lEasing` (on `sequential()`, `diverging()` and `ramp()`) is deliberately *not* a free lightness
curve. It eases `t` before the paper's `0.2^x` spacing, so the lightness curve and its endpoints
(`lRange` / `brightness` / `contrast`) stay exactly as the model built them — only where the
samples fall along that curve moves. A linear easing is the paper's spacing, exactly.

```ts
import { sequential, cubicBezier } from 'cusphanger';
import { oklchSrgb } from 'nutelch';

sequential({ hStart: 260, total: 9, lEasing: cubicBezier(0.4, 0, 0.8, 0.6), lut: oklchSrgb });
```

`cubicBezier(x1, y1, x2, y2)` is a CSS-style easing with the y handles clamped to `[0, 1]`, i.e.
monotone by construction; it is what the demo's *spread* editor drives. Any `(t) => number` works,
including RampenSau's easing helpers. What to know:

- **It spends the paper's calibration.** The `0.2^x` spacing is the part fitted against Brewer so
  neighboring classes stay distinguishable. Bunching steps is fine for a UI scale, less so for a
  choropleth — leave `lEasing` unset for data classes.
- **Ordered and in gamut, whatever you pass.** The output is clamped to `[0, 1]` and kept
  non-decreasing, so a bad easing can never reorder the ramp or leave the gamut. It *can* bunch
  steps, and a flat stretch repeats a color.
- **Same path only while the hue holds still.** Hue and tension follow the un-eased `t`. In
  `sequential()` and on each `diverging()` arm every eased color is a point on the paper's own
  curve. Under a moving hue (`ramp()`'s `hCycles` / `hueList`) the axes ease independently, as in
  RampenSau: the hue sequence is unchanged, but a given lightness now pairs with a different hue.
- **Diverging eases per arm**, `t = 0` at each dark end and `1` at the neutral, mirrored. Even-`N`
  palettes lose the uniform step across the join — it becomes whatever the easing leaves between
  the two innermost samples.
- **`fromColor`** takes the easing as a held knob (see above) so the target keeps its sample.

Use `lRange` (or `brightness`/`contrast`) to shape the range itself.

## RampenSau interop, and what's left out on purpose

The API is deliberately kept as close to [RampenSau](https://github.com/meodai/rampensau) as the
paper allows: if you know one, you know the other. `ramp()` is the counterpart to RampenSau's
`generateColorRamp` — everywhere the concepts correspond the options share RampenSau's names and
semantics (`total`, `hStart`, `hCycles`, `hStartCenter`, `hEasing`, `sRange`/`sEasing`, `lRange`,
`lEasing`, `hueList`), and RampenSau's easing/curve helpers plug straight into `hEasing`/`sEasing`. Only the
paper-specific knobs (`saturation`, `brightness`, `contrast`, `coolWarm`) have no RampenSau
counterpart. One of them changes meaning inside `ramp()`: under a shared `triangleMode` there is no
per-hue triangle to shift, so `coolWarm` instead nudges the light colors' hues toward the bright
point — same visual intent, different mechanism. `lEasing` differs too: RampenSau's eases lightness
itself, this one eases the position along the paper's lightness curve (see above). A few RampenSau
options are omitted deliberately:

- **`transformFn`** — colors are plain objects; `.map()` the result.
- **Random defaults** — `total` and `hStart` are required. The point of the model is an exact,
  reproducible specification, so nothing is randomized for you.

The paper's bright point `p_b` (the yellow that `coolWarm` pulls toward) is canonically sRGB
yellow in every gamut, so sRGB and Display-P3 palettes stay comparable.

## Develop

```bash
npm run dev        # demo
npm test           # unit tests
npm run build:lib  # build the library
```

## License

MIT
