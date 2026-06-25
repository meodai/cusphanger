# CuspHanger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `cusphanger`, an OKLCH palette generator (library + Vite demo) that produces sequential, diverging, and qualitative palettes from intuitive parameters via a unified trajectory engine with gamut-relative saturation.

**Architecture:** A unified `generatePalette()` engine samples per-channel trajectories (hue cycles + easings, lightness range + easing, gamut-relative saturation). Saturation `s ∈ [0,1]` is a fraction of the maximum in-gamut chroma at each (hue, lightness), so output is in-gamut by construction and the chroma peak at the cusp emerges automatically. `sequential`/`qualitative` are thin presets over the engine; `diverging` composes two engine ramps. A vanilla-TS Vite demo drives it with live controls, swatches, and WCAG/APCA contrast badges.

**Tech Stack:** TypeScript (strict), Vite 6, Vitest 2, Culori 4 (color conversion + gamut mapping). Vanilla TS demo (no UI framework).

## Global Constraints

- Package name: `cusphanger` (lowercase). Display name: **CuspHanger**.
- Color math via **Culori v4** only. No other color dependency.
- Saturation is **gamut-relative**: actual `C = s · maxChromaAt(hue, L, gamut)`, `s ∈ [0,1]`.
- Target gamut is `'srgb' | 'display-p3'`; everything is parameterized by it.
- Library core (`src/lib/`) must not import anything from `src/demo/`.
- TypeScript strict mode; ESM (`"type": "module"`).
- TDD: write the failing test first, watch it fail, implement, watch it pass, commit. Tests are co-located as `src/**/*.test.ts`.
- OKLCH numbers: `l ∈ [0,1]`, `c ≥ 0` (sRGB max ≈ 0.37), `h ∈ [0,360)`.

---

## File Structure

```
package.json
tsconfig.json
vite.config.ts            # demo dev/build + vitest config
vite.lib.config.ts        # library build (ESM/UMD + .d.ts)
index.html                # demo entry
src/
  types/culori.d.ts       # minimal ambient declaration for the culori fns we use
  lib/
    types.ts              # Gamut, Easing, PaletteColor, option interfaces
    easing.ts             # linear/power/sine/lame/hump + lerp/clamp01
    gamut.ts              # maxChromaAt, cusp (memoized)
    space.ts              # relativeToOklch, oklchToRelative
    color.ts              # toPaletteColor
    engine.ts             # generatePalette
    presets.ts            # sequential, diverging, qualitative
    index.ts              # public exports
  demo/
    main.ts               # bootstrap tabs, wire controls -> lib -> render
    controls.ts           # build inputs per tab, emit typed options
    swatches.ts           # render palette strip + readouts + badges
    contrast.ts           # wcag wrapper + APCA-W3 0.1.9
    style.css
```

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vite.lib.config.ts`, `index.html`, `src/types/culori.d.ts`, `src/lib/smoke.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a working `npm test` and `npm run dev`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "cusphanger",
  "version": "0.1.0",
  "description": "OKLCH palette generator with intuitive parameters (sequential, diverging, qualitative).",
  "type": "module",
  "license": "MIT",
  "files": ["dist"],
  "main": "./dist/cusphanger.umd.cjs",
  "module": "./dist/cusphanger.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/cusphanger.js",
      "require": "./dist/cusphanger.umd.cjs"
    }
  },
  "scripts": {
    "dev": "vite",
    "build:lib": "vite build --config vite.lib.config.ts",
    "build:demo": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "culori": "^4.0.1"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vite": "^6.0.0",
    "vite-plugin-dts": "^4.3.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["vitest/globals"],
    "outDir": "dist"
  },
  "include": ["src", "vite.config.ts", "vite.lib.config.ts"]
}
```

- [ ] **Step 3: Create `vite.config.ts` (demo + vitest)**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: { outDir: 'dist-demo' },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Create `vite.lib.config.ts` (library build)**

```ts
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [dts({ include: ['src/lib'], rollupTypes: true })],
  build: {
    outDir: 'dist',
    lib: {
      entry: resolve(__dirname, 'src/lib/index.ts'),
      name: 'CuspHanger',
      fileName: 'cusphanger',
    },
    rollupOptions: {
      external: ['culori'],
      output: { globals: { culori: 'culori' } },
    },
  },
});
```

- [ ] **Step 5: Create `src/types/culori.d.ts` (ambient declaration)**

This shields us from any upstream typing drift; we declare only what we use.

```ts
declare module 'culori' {
  export interface Oklch { mode: 'oklch'; l: number; c: number; h?: number; alpha?: number }
  export interface P3 { mode: 'p3'; r: number; g: number; b: number; alpha?: number }
  export interface Rgb { mode: 'rgb'; r: number; g: number; b: number; alpha?: number }
  export type Color = Oklch | P3 | Rgb | { mode: string; [k: string]: unknown };

  export function clampChroma(color: Color | string, mode?: string, rgbGamut?: string): Oklch;
  export function inGamut(mode?: string): (color: Color | string) => boolean;
  export function toGamut(dest?: string, mode?: string, delta?: unknown, jnd?: number): (color: Color | string) => Color;
  export function formatHex(color: Color | string): string;
  export function formatCss(color: Color | string): string;
  export function wcagContrast(a: Color | string, b: Color | string): number;
  export function converter(mode: string): (color: Color | string) => Color;
}
```

- [ ] **Step 6: Create `index.html` (demo entry)**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CuspHanger — OKLCH palette generator</title>
    <link rel="stylesheet" href="/src/demo/style.css" />
  </head>
  <body>
    <main id="app"></main>
    <script type="module" src="/src/demo/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 7: Create `src/lib/smoke.test.ts`**

```ts
import { describe, it, expect } from 'vitest';

describe('toolchain', () => {
  it('runs vitest', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 8: Install and verify**

Run: `npm install && npm test`
Expected: install succeeds; 1 test passes.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold cusphanger (vite + ts + vitest + culori)"
```

---

## Task 2: Easing helpers

**Files:**
- Create: `src/lib/easing.ts`, `src/lib/easing.test.ts`

**Interfaces:**
- Consumes: `Easing` type (define inline here, re-exported from `types.ts` in Task 3 — to avoid a cycle, `easing.ts` defines its own local `Easing = (t: number) => number`).
- Produces:
  - `lerp(a: number, b: number, t: number): number`
  - `clamp01(x: number): number`
  - `linear: Easing`
  - `power(exp: number): Easing`
  - `sine: Easing`
  - `lame(n: number): Easing`
  - `hump(peak?: number): Easing` — 0 at t=0 and t=1, 1 at t=peak (default 0.5)

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { lerp, clamp01, linear, power, sine, lame, hump } from './easing';

describe('easing', () => {
  it('lerp interpolates', () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(2, 4, 0)).toBe(2);
    expect(lerp(2, 4, 1)).toBe(4);
  });

  it('clamp01 clamps', () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(0.5)).toBe(0.5);
  });

  it('linear is identity', () => {
    expect(linear(0.3)).toBeCloseTo(0.3);
  });

  it('power(2) squares', () => {
    expect(power(2)(0.5)).toBeCloseTo(0.25);
  });

  it('sine eases to 1 at t=1, 0 at t=0', () => {
    expect(sine(0)).toBeCloseTo(0);
    expect(sine(1)).toBeCloseTo(1);
  });

  it('lame stays within [0,1] and hits endpoints', () => {
    expect(lame(2)(0)).toBeCloseTo(0);
    expect(lame(2)(1)).toBeCloseTo(1);
    const mid = lame(2)(0.5);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });

  it('hump peaks in the middle and is 0 at the ends', () => {
    const h = hump(0.5);
    expect(h(0)).toBeCloseTo(0);
    expect(h(1)).toBeCloseTo(0);
    expect(h(0.5)).toBeCloseTo(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/easing.test.ts`
Expected: FAIL — cannot find module `./easing`.

- [ ] **Step 3: Write the implementation**

```ts
export type Easing = (t: number) => number;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

export const linear: Easing = (t) => t;

export const power =
  (exp: number): Easing =>
  (t) =>
    Math.pow(t, exp);

export const sine: Easing = (t) => Math.sin((t * Math.PI) / 2);

// superellipse-style easing; n=2 is a quarter circle, higher n is sharper
export const lame =
  (n: number): Easing =>
  (t) =>
    1 - Math.pow(1 - Math.pow(clamp01(t), n), 1 / n);

// symmetric peak: 0 at t=0 and t=1, 1 at t=peak (parabolic on each side)
export const hump =
  (peak = 0.5): Easing =>
  (t) => {
    const p = clamp01(peak);
    if (t <= p) {
      if (p === 0) return 1;
      const x = t / p;
      return 1 - (1 - x) * (1 - x);
    }
    if (p === 1) return 1;
    const x = (t - p) / (1 - p);
    return 1 - x * x;
  };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/easing.test.ts`
Expected: PASS (all assertions).

- [ ] **Step 5: Commit**

```bash
git add src/lib/easing.ts src/lib/easing.test.ts
git commit -m "feat: easing helpers (lerp, clamp01, linear, power, sine, lame, hump)"
```

---

## Task 3: Types

**Files:**
- Create: `src/lib/types.ts`

**Interfaces:**
- Consumes: `Easing` from `easing.ts`.
- Produces (exact shapes other tasks rely on):
  - `Gamut = 'srgb' | 'display-p3'`
  - `Oklch = { l: number; c: number; h: number }`
  - `PaletteColor = { oklch: Oklch; hex: string; css: string; inSrgb: boolean; inP3: boolean }`
  - `PaletteOptions`, `SequentialOptions`, `DivergingOptions`, `QualitativeOptions` (see code)

This task has no test of its own (types only); it is validated by `npm run typecheck` and by consumers in later tasks.

- [ ] **Step 1: Write `src/lib/types.ts`**

```ts
import type { Easing } from './easing';

export type { Easing };

export type Gamut = 'srgb' | 'display-p3';

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
  gamut?: Gamut;                       // default 'srgb'
}

export interface SequentialOptions {
  hue: number;
  count: number;
  saturation?: number;    // gamut-relative saturation. default 0.9
  lightnessHigh?: number; // lightest. default 0.95
  lightnessLow?: number;  // darkest. default 0.2
  hueShift?: number;      // degrees, light->dark hue rotation. default 0
  gamut?: Gamut;
}

export interface DivergingOptions {
  hueLeft: number;
  hueRight: number;
  count: number;            // odd -> shared neutral center
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
```

- [ ] **Step 2: Verify it typechecks**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: lib types (Gamut, Oklch, PaletteColor, option interfaces)"
```

---

## Task 4: Gamut — maxChromaAt + cusp

**Files:**
- Create: `src/lib/gamut.ts`, `src/lib/gamut.test.ts`

**Interfaces:**
- Consumes: `Gamut` from `types.ts`; `clampChroma` from `culori`.
- Produces:
  - `maxChromaAt(hue: number, l: number, gamut?: Gamut): number`
  - `cusp(hue: number, gamut?: Gamut): { l: number; c: number }`

**Design note:** `maxChromaAt` uses Culori's `clampChroma({mode:'oklch', l, c: 0.5, h}, 'oklch', rgbGamut)`, which bisects chroma in `[0, 0.5]` to the largest in-gamut value (0.5 exceeds the true OKLCH max for any sRGB/P3 hue, so it is a safe ceiling). Results are memoized.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { inGamut } from 'culori';
import { maxChromaAt, cusp } from './gamut';

const inSrgb = inGamut('rgb');

describe('maxChromaAt', () => {
  it('is 0 at the extremes of lightness', () => {
    expect(maxChromaAt(120, 0, 'srgb')).toBe(0);
    expect(maxChromaAt(120, 1, 'srgb')).toBe(0);
  });

  it('returns a positive chroma in the mid range', () => {
    expect(maxChromaAt(260, 0.6, 'srgb')).toBeGreaterThan(0.05);
  });

  it('keeps the resulting color inside the sRGB gamut', () => {
    const c = maxChromaAt(30, 0.7, 'srgb');
    // a hair below the boundary must be in gamut
    expect(inSrgb({ mode: 'oklch', l: 0.7, c: c * 0.98, h: 30 })).toBe(true);
  });

  it('allows more chroma in P3 than in sRGB for a saturated hue', () => {
    const srgb = maxChromaAt(150, 0.7, 'srgb');
    const p3 = maxChromaAt(150, 0.7, 'display-p3');
    expect(p3).toBeGreaterThanOrEqual(srgb);
  });
});

describe('cusp', () => {
  it('chroma is >= maxChromaAt at any sampled lightness', () => {
    const peak = cusp(260, 'srgb');
    for (const l of [0.2, 0.4, 0.6, 0.8]) {
      expect(peak.c + 1e-9).toBeGreaterThanOrEqual(maxChromaAt(260, l, 'srgb'));
    }
    expect(peak.l).toBeGreaterThan(0);
    expect(peak.l).toBeLessThan(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/gamut.test.ts`
Expected: FAIL — cannot find module `./gamut`.

- [ ] **Step 3: Write the implementation**

```ts
import { clampChroma } from 'culori';
import type { Gamut } from './types';

const RGB_GAMUT: Record<Gamut, string> = {
  srgb: 'rgb',
  'display-p3': 'p3',
};

const CHROMA_CEILING = 0.5; // above the true OKLCH max for any sRGB/P3 hue

const chromaCache = new Map<string, number>();

export function maxChromaAt(hue: number, l: number, gamut: Gamut = 'srgb'): number {
  if (l <= 0 || l >= 1) return 0;
  const h = ((hue % 360) + 360) % 360;
  const key = `${gamut}:${h.toFixed(2)}:${l.toFixed(4)}`;
  const cached = chromaCache.get(key);
  if (cached !== undefined) return cached;
  const clamped = clampChroma(
    { mode: 'oklch', l, c: CHROMA_CEILING, h },
    'oklch',
    RGB_GAMUT[gamut],
  );
  const value = clamped.c ?? 0;
  chromaCache.set(key, value);
  return value;
}

const cuspCache = new Map<string, { l: number; c: number }>();

export function cusp(hue: number, gamut: Gamut = 'srgb'): { l: number; c: number } {
  const h = ((hue % 360) + 360) % 360;
  const key = `${gamut}:${h.toFixed(2)}`;
  const cached = cuspCache.get(key);
  if (cached) return cached;

  // coarse scan, then refine around the best lightness
  let best = { l: 0.5, c: 0 };
  for (let i = 1; i < 100; i++) {
    const l = i / 100;
    const c = maxChromaAt(h, l, gamut);
    if (c > best.c) best = { l, c };
  }
  for (let i = -9; i <= 9; i++) {
    const l = best.l + i / 1000;
    if (l <= 0 || l >= 1) continue;
    const c = maxChromaAt(h, l, gamut);
    if (c > best.c) best = { l, c };
  }
  cuspCache.set(key, best);
  return best;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/gamut.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gamut.ts src/lib/gamut.test.ts
git commit -m "feat: gamut maxChromaAt + cusp (memoized, culori clampChroma)"
```

---

## Task 5: Space + color conversion

**Files:**
- Create: `src/lib/space.ts`, `src/lib/color.ts`, `src/lib/space.test.ts`, `src/lib/color.test.ts`

**Interfaces:**
- Consumes: `maxChromaAt` from `gamut.ts`; `Gamut`, `Oklch`, `PaletteColor` from `types.ts`; `inGamut`, `toGamut`, `formatHex`, `formatCss`, `clampChroma` from `culori`.
- Produces:
  - `relativeToOklch(s: number, l: number, hue: number, gamut?: Gamut): Oklch`
  - `oklchToRelative(color: Oklch, gamut?: Gamut): { s: number; l: number }`
  - `toPaletteColor(color: Oklch, gamut?: Gamut): PaletteColor`

- [ ] **Step 1: Write the failing test for `space.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { relativeToOklch, oklchToRelative } from './space';
import { maxChromaAt } from './gamut';

describe('relativeToOklch', () => {
  it('s=1 lands at the gamut max chroma', () => {
    const max = maxChromaAt(260, 0.6, 'srgb');
    expect(relativeToOklch(1, 0.6, 260, 'srgb').c).toBeCloseTo(max, 6);
  });

  it('s=0 is neutral', () => {
    expect(relativeToOklch(0, 0.6, 260, 'srgb').c).toBe(0);
  });

  it('round-trips through oklchToRelative', () => {
    const color = relativeToOklch(0.7, 0.55, 120, 'srgb');
    const rel = oklchToRelative(color, 'srgb');
    expect(rel.s).toBeCloseTo(0.7, 6);
    expect(rel.l).toBeCloseTo(0.55, 6);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/lib/space.test.ts`
Expected: FAIL — cannot find module `./space`.

- [ ] **Step 3: Implement `src/lib/space.ts`**

```ts
import { maxChromaAt } from './gamut';
import type { Gamut, Oklch } from './types';

export function relativeToOklch(s: number, l: number, hue: number, gamut: Gamut = 'srgb'): Oklch {
  const h = ((hue % 360) + 360) % 360;
  const maxC = maxChromaAt(h, l, gamut);
  return { l, c: s * maxC, h };
}

export function oklchToRelative(color: Oklch, gamut: Gamut = 'srgb'): { s: number; l: number } {
  const maxC = maxChromaAt(color.h, color.l, gamut);
  return { s: maxC === 0 ? 0 : color.c / maxC, l: color.l };
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run src/lib/space.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing test for `color.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { toPaletteColor } from './color';

describe('toPaletteColor', () => {
  it('produces a hex and an oklch css string for the srgb target', () => {
    const pc = toPaletteColor({ l: 0.7, c: 0.1, h: 120 }, 'srgb');
    expect(pc.hex).toMatch(/^#[0-9a-f]{6}$/i);
    expect(pc.css.startsWith('oklch(')).toBe(true);
    expect(pc.oklch).toEqual({ l: 0.7, c: 0.1, h: 120 });
  });

  it('produces a display-p3 css string for the p3 target', () => {
    const pc = toPaletteColor({ l: 0.7, c: 0.1, h: 120 }, 'display-p3');
    expect(pc.css.startsWith('color(display-p3')).toBe(true);
  });

  it('reports gamut membership flags', () => {
    const inside = toPaletteColor({ l: 0.7, c: 0.02, h: 120 }, 'srgb');
    expect(inside.inSrgb).toBe(true);
    const outside = toPaletteColor({ l: 0.7, c: 0.35, h: 150 }, 'srgb');
    expect(outside.inSrgb).toBe(false);
    expect(typeof outside.inP3).toBe('boolean');
  });
});
```

- [ ] **Step 6: Run it and watch it fail**

Run: `npx vitest run src/lib/color.test.ts`
Expected: FAIL — cannot find module `./color`.

- [ ] **Step 7: Implement `src/lib/color.ts`**

```ts
import { inGamut, toGamut, formatHex, formatCss, clampChroma } from 'culori';
import type { Gamut, Oklch, PaletteColor } from './types';

const inSrgb = inGamut('rgb');
const inP3 = inGamut('p3');
const toSrgb = toGamut('rgb');
const toP3 = toGamut('p3');

export function toPaletteColor(color: Oklch, gamut: Gamut = 'srgb'): PaletteColor {
  const oklch = { mode: 'oklch' as const, l: color.l, c: color.c, h: color.h };
  const hex = formatHex(toSrgb(oklch));
  const css =
    gamut === 'display-p3'
      ? formatCss(toP3(oklch))
      : formatCss(clampChroma(oklch, 'oklch', 'rgb'));
  return {
    oklch: { l: color.l, c: color.c, h: color.h },
    hex,
    css,
    inSrgb: inSrgb(oklch),
    inP3: inP3(oklch),
  };
}
```

- [ ] **Step 8: Run it and watch it pass**

Run: `npx vitest run src/lib/color.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/space.ts src/lib/color.ts src/lib/space.test.ts src/lib/color.test.ts
git commit -m "feat: relative<->oklch space mapping and PaletteColor conversion"
```

---

## Task 6: Engine — generatePalette

**Files:**
- Create: `src/lib/engine.ts`, `src/lib/engine.test.ts`

**Interfaces:**
- Consumes: `relativeToOklch` from `space.ts`; `toPaletteColor` from `color.ts`; `lerp`, `clamp01`, `linear` from `easing.ts`; `PaletteOptions`, `PaletteColor` from `types.ts`.
- Produces: `generatePalette(o: PaletteOptions): PaletteColor[]`

**Design note:** With constant gamut-relative saturation, absolute chroma `= s · maxChromaAt(h, L)` automatically peaks where the gamut allows the most chroma (the cusp). That reproduces the paper's "mid-tones pop" without any special saturation easing — so the presets in Task 7 use a constant saturation range, and `hump` remains available only for callers who want an explicit peak.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { generatePalette } from './engine';

describe('generatePalette', () => {
  it('returns the requested number of colors', () => {
    expect(generatePalette({ total: 5, hueStart: 120 })).toHaveLength(5);
  });

  it('total=1 yields a single color sampled at t=0', () => {
    const p = generatePalette({ total: 1, hueStart: 120, lightnessRange: [0.9, 0.2] });
    expect(p).toHaveLength(1);
    expect(p[0]!.oklch.l).toBeCloseTo(0.9, 6);
  });

  it('lightness decreases across the default range', () => {
    const p = generatePalette({ total: 6, hueStart: 120 });
    const ls = p.map((c) => c.oklch.l);
    for (let i = 1; i < ls.length; i++) {
      expect(ls[i]!).toBeLessThan(ls[i - 1]!);
    }
  });

  it('every color is inside the sRGB gamut by construction', () => {
    const p = generatePalette({ total: 9, hueStart: 30, saturationRange: [1, 1] });
    expect(p.every((c) => c.inSrgb)).toBe(true);
  });

  it('hueCycles rotates the hue by the expected total', () => {
    const p = generatePalette({ total: 2, hueStart: 0, hueCycles: 0.5 });
    expect(p[0]!.oklch.h).toBeCloseTo(0, 4);
    expect(p[1]!.oklch.h).toBeCloseTo(180, 4);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/lib/engine.test.ts`
Expected: FAIL — cannot find module `./engine`.

- [ ] **Step 3: Implement `src/lib/engine.ts`**

```ts
import { relativeToOklch } from './space';
import { toPaletteColor } from './color';
import { lerp, clamp01, linear } from './easing';
import type { PaletteColor, PaletteOptions } from './types';

export function generatePalette(o: PaletteOptions): PaletteColor[] {
  const {
    total,
    hueStart,
    hueCycles = 0,
    hueEasing = linear,
    hueStartCenter = 0,
    lightnessRange = [0.95, 0.2],
    lightnessEasing = linear,
    saturationRange = [0.9, 0.9],
    saturationEasing = linear,
    gamut = 'srgb',
  } = o;

  const out: PaletteColor[] = [];
  for (let i = 0; i < total; i++) {
    const t = total <= 1 ? 0 : i / (total - 1);
    const rawHue = hueStart + 360 * hueCycles * (hueEasing(t) - hueStartCenter);
    const hue = ((rawHue % 360) + 360) % 360;
    const l = lerp(lightnessRange[0], lightnessRange[1], lightnessEasing(t));
    const s = clamp01(lerp(saturationRange[0], saturationRange[1], saturationEasing(t)));
    out.push(toPaletteColor(relativeToOklch(s, l, hue, gamut), gamut));
  }
  return out;
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run src/lib/engine.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/engine.ts src/lib/engine.test.ts
git commit -m "feat: generatePalette trajectory engine"
```

---

## Task 7: Presets — sequential, diverging, qualitative

**Files:**
- Create: `src/lib/presets.ts`, `src/lib/presets.test.ts`

**Interfaces:**
- Consumes: `generatePalette` from `engine.ts`; `relativeToOklch` from `space.ts`; `toPaletteColor` from `color.ts`; option/`PaletteColor` types from `types.ts`.
- Produces:
  - `sequential(o: SequentialOptions): PaletteColor[]`
  - `diverging(o: DivergingOptions): PaletteColor[]`
  - `qualitative(o: QualitativeOptions): PaletteColor[]`

**Design notes:**
- `sequential` maps intuitive params onto the engine with constant relative saturation.
- `diverging` builds two dark→light ramps whose saturation fades to 0 at the light center, then mirrors them; for odd `count` an explicit neutral center is inserted.
- `qualitative` spreads hues evenly; on a full circle the endpoints are made exclusive (`i/count`) so the first and last hue don't collide.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { sequential, diverging, qualitative } from './presets';

describe('sequential', () => {
  it('produces count colors with strictly decreasing lightness', () => {
    const p = sequential({ hue: 260, count: 7 });
    expect(p).toHaveLength(7);
    const ls = p.map((c) => c.oklch.l);
    for (let i = 1; i < ls.length; i++) expect(ls[i]!).toBeLessThan(ls[i - 1]!);
  });

  it('peaks chroma in the mid-tones (cusp effect)', () => {
    const p = sequential({ hue: 260, count: 7 });
    const cs = p.map((c) => c.oklch.c);
    const mid = cs[3]!;
    expect(mid).toBeGreaterThan(cs[0]!);
    expect(mid).toBeGreaterThan(cs[cs.length - 1]!);
  });
});

describe('diverging', () => {
  it('has a neutral center for odd counts and mirrored lightness', () => {
    const p = diverging({ hueLeft: 250, hueRight: 30, count: 7 });
    expect(p).toHaveLength(7);
    expect(p[3]!.oklch.c).toBeLessThan(0.02); // center is ~neutral
    const ls = p.map((c) => c.oklch.l);
    expect(ls[0]!).toBeCloseTo(ls[6]!, 4);
    expect(ls[1]!).toBeCloseTo(ls[5]!, 4);
    expect(ls[3]!).toBeGreaterThan(ls[0]!); // center is lightest
  });
});

describe('qualitative', () => {
  it('spreads hues evenly with no first/last collision on a full circle', () => {
    const p = qualitative({ count: 6 });
    expect(p).toHaveLength(6);
    const hues = p.map((c) => c.oklch.h);
    expect(hues[0]!).toBeCloseTo(0, 4);
    expect(hues[1]!).toBeCloseTo(60, 4);
    expect(hues[5]!).toBeCloseTo(300, 4);
  });

  it('uses a shared lightness for all swatches', () => {
    const p = qualitative({ count: 5, lightness: 0.7 });
    expect(p.every((c) => Math.abs(c.oklch.l - 0.7) < 1e-9)).toBe(true);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/lib/presets.test.ts`
Expected: FAIL — cannot find module `./presets`.

- [ ] **Step 3: Implement `src/lib/presets.ts`**

```ts
import { generatePalette } from './engine';
import { relativeToOklch } from './space';
import { toPaletteColor } from './color';
import type {
  PaletteColor,
  SequentialOptions,
  DivergingOptions,
  QualitativeOptions,
} from './types';

export function sequential(o: SequentialOptions): PaletteColor[] {
  const {
    hue,
    count,
    saturation = 0.9,
    lightnessHigh = 0.95,
    lightnessLow = 0.2,
    hueShift = 0,
    gamut = 'srgb',
  } = o;
  return generatePalette({
    total: count,
    hueStart: hue,
    hueCycles: hueShift / 360,
    lightnessRange: [lightnessHigh, lightnessLow],
    saturationRange: [saturation, saturation],
    gamut,
  });
}

export function diverging(o: DivergingOptions): PaletteColor[] {
  const {
    hueLeft,
    hueRight,
    count,
    saturation = 0.9,
    centerLightness = 0.95,
    lightnessLow = 0.35,
    gamut = 'srgb',
  } = o;
  const isOdd = count % 2 === 1;
  const side = Math.floor(count / 2); // non-center colors per side

  // dark+saturated -> light+neutral ramp (saturation fades to 0 at the center)
  const ramp = (hue: number): PaletteColor[] =>
    generatePalette({
      total: side + 1,
      hueStart: hue,
      lightnessRange: [lightnessLow, centerLightness],
      saturationRange: [saturation, 0],
      gamut,
    });

  const leftSide = ramp(hueLeft).slice(0, side); // dark -> toward center (ascending L)
  const rightSide = ramp(hueRight).slice(0, side); // dark -> toward center (ascending L)
  const center = toPaletteColor(relativeToOklch(0, centerLightness, hueLeft, gamut), gamut);

  return [
    ...leftSide,
    ...(isOdd ? [center] : []),
    ...rightSide.slice().reverse(), // center -> dark (descending L)
  ];
}

export function qualitative(o: QualitativeOptions): PaletteColor[] {
  const { count, hueRange = [0, 360], lightness = 0.7, saturation = 0.7, gamut = 'srgb' } = o;
  const [h0, h1] = hueRange;
  const span = h1 - h0;
  const fullCircle = Math.abs(((span % 360) + 360) % 360) < 1e-9 && span !== 0;
  const out: PaletteColor[] = [];
  for (let i = 0; i < count; i++) {
    const frac = fullCircle ? i / count : count <= 1 ? 0 : i / (count - 1);
    const hue = (((h0 + span * frac) % 360) + 360) % 360;
    out.push(toPaletteColor(relativeToOklch(saturation, lightness, hue, gamut), gamut));
  }
  return out;
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run src/lib/presets.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/presets.ts src/lib/presets.test.ts
git commit -m "feat: sequential, diverging, qualitative presets"
```

---

## Task 8: Public API + library build

**Files:**
- Create: `src/lib/index.ts`, `src/lib/index.test.ts`

**Interfaces:**
- Consumes: everything in `src/lib/`.
- Produces: the package public surface (all functions/types) and a verified `npm run build:lib`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import * as api from './index';

describe('public api', () => {
  it('exports the engine and presets', () => {
    expect(typeof api.generatePalette).toBe('function');
    expect(typeof api.sequential).toBe('function');
    expect(typeof api.diverging).toBe('function');
    expect(typeof api.qualitative).toBe('function');
  });

  it('exports color helpers and easings', () => {
    expect(typeof api.relativeToOklch).toBe('function');
    expect(typeof api.toPaletteColor).toBe('function');
    expect(typeof api.maxChromaAt).toBe('function');
    expect(typeof api.cusp).toBe('function');
    expect(typeof api.linear).toBe('function');
    expect(typeof api.hump).toBe('function');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/lib/index.test.ts`
Expected: FAIL — cannot find module `./index`.

- [ ] **Step 3: Implement `src/lib/index.ts`**

```ts
export * from './types';
export { lerp, clamp01, linear, power, sine, lame, hump } from './easing';
export { maxChromaAt, cusp } from './gamut';
export { relativeToOklch, oklchToRelative } from './space';
export { toPaletteColor } from './color';
export { generatePalette } from './engine';
export { sequential, diverging, qualitative } from './presets';
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run src/lib/index.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify the full test suite and the library build**

Run: `npm test && npm run build:lib`
Expected: all tests pass; `dist/cusphanger.js` and `dist/index.d.ts` are produced.

- [ ] **Step 6: Commit**

```bash
git add src/lib/index.ts src/lib/index.test.ts
git commit -m "feat: public api surface + verified library build"
```

---

## Task 9: Contrast utilities (WCAG + APCA)

**Files:**
- Create: `src/demo/contrast.ts`, `src/demo/contrast.test.ts`

**Interfaces:**
- Consumes: `wcagContrast` from `culori`.
- Produces:
  - `wcag(a: string, b: string): number` (rounded to 2 decimals)
  - `apca(textHex: string, bgHex: string): number` (APCA Lc, signed)

**Design note:** APCA-W3 0.1.9 reference math, implemented locally (no dependency). Input hex strings like `#rrggbb`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { wcag, apca } from './contrast';

describe('wcag', () => {
  it('is ~21 for black on white', () => {
    expect(wcag('#000000', '#ffffff')).toBeCloseTo(21, 1);
  });
});

describe('apca', () => {
  it('black text on white bg is a large positive Lc', () => {
    expect(apca('#000000', '#ffffff')).toBeGreaterThan(100);
  });
  it('white text on black bg is a large negative Lc', () => {
    expect(apca('#ffffff', '#000000')).toBeLessThan(-100);
  });
  it('identical colors have ~0 contrast', () => {
    expect(Math.abs(apca('#777777', '#777777'))).toBeLessThan(1);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/demo/contrast.test.ts`
Expected: FAIL — cannot find module `./contrast`.

- [ ] **Step 3: Implement `src/demo/contrast.ts`**

```ts
import { wcagContrast } from 'culori';

export function wcag(a: string, b: string): number {
  return Math.round(wcagContrast(a, b) * 100) / 100;
}

function hexToRgb255(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

// APCA-W3 0.1.9
function sRGBtoY([r, g, b]: [number, number, number]): number {
  const lin = (v: number) => Math.pow(v / 255, 2.4);
  return 0.2126729 * lin(r) + 0.7151522 * lin(g) + 0.072175 * lin(b);
}

export function apca(textHex: string, bgHex: string): number {
  const blkThrs = 0.022;
  const blkClmp = 1.414;
  const deltaYmin = 0.0005;
  const scale = 1.14;
  const loBoWoffset = 0.027;
  const loWoBoffset = 0.027;

  let txtY = sRGBtoY(hexToRgb255(textHex));
  let bgY = sRGBtoY(hexToRgb255(bgHex));

  txtY = txtY > blkThrs ? txtY : txtY + Math.pow(blkThrs - txtY, blkClmp);
  bgY = bgY > blkThrs ? bgY : bgY + Math.pow(blkThrs - bgY, blkClmp);

  if (Math.abs(bgY - txtY) < deltaYmin) return 0;

  let outputContrast: number;
  if (bgY > txtY) {
    const sapc = (Math.pow(bgY, 0.56) - Math.pow(txtY, 0.57)) * scale;
    outputContrast = sapc < 0.001 ? 0 : sapc - loBoWoffset;
  } else {
    const sapc = (Math.pow(bgY, 0.65) - Math.pow(txtY, 0.62)) * scale;
    outputContrast = sapc > -0.001 ? 0 : sapc + loWoBoffset;
  }
  return Math.round(outputContrast * 100 * 10) / 10;
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run src/demo/contrast.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/demo/contrast.ts src/demo/contrast.test.ts
git commit -m "feat: WCAG + APCA contrast utilities"
```

---

## Task 10: Demo UI

**Files:**
- Create: `src/demo/style.css`, `src/demo/swatches.ts`, `src/demo/controls.ts`, `src/demo/main.ts`

**Interfaces:**
- Consumes: `sequential`, `diverging`, `qualitative`, `generatePalette`, types from `../lib/index`; `wcag`, `apca` from `./contrast`.
- Produces: a running demo (`npm run dev`).

This task is UI assembly; it is verified manually by running the demo and observing the four tabs render palettes with readouts and contrast badges. (Logic is already unit-tested in the lib and contrast tasks.)

- [ ] **Step 1: Create `src/demo/style.css`**

```css
:root {
  font-family: ui-sans-serif, system-ui, sans-serif;
  color-scheme: light dark;
  --bg: light-dark(#fafafa, #14161a);
  --fg: light-dark(#16181d, #f2f3f5);
  --panel: light-dark(#ffffff, #1d2026);
  --border: light-dark(#e3e5e9, #2a2e36);
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg); }
#app { max-width: 1000px; margin: 0 auto; padding: 2rem 1.25rem 4rem; }
h1 { font-size: 1.4rem; margin: 0 0 0.25rem; }
.sub { opacity: 0.7; margin: 0 0 1.5rem; font-size: 0.9rem; }
.tabs { display: flex; gap: 0.25rem; margin-bottom: 1rem; flex-wrap: wrap; }
.tabs button {
  border: 1px solid var(--border); background: var(--panel); color: inherit;
  padding: 0.4rem 0.8rem; border-radius: 999px; cursor: pointer; font-size: 0.85rem;
}
.tabs button[aria-selected="true"] { background: var(--fg); color: var(--bg); }
.panel {
  display: grid; grid-template-columns: 240px 1fr; gap: 1.5rem;
  background: var(--panel); border: 1px solid var(--border);
  border-radius: 12px; padding: 1.25rem;
}
.controls { display: flex; flex-direction: column; gap: 0.85rem; }
.control { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.8rem; }
.control .row { display: flex; justify-content: space-between; opacity: 0.8; }
.control input[type="range"] { width: 100%; }
.control select { padding: 0.25rem; background: var(--bg); color: inherit; border: 1px solid var(--border); border-radius: 6px; }
.swatches { display: flex; flex-direction: column; gap: 2px; min-height: 320px; }
.swatch {
  flex: 1; display: flex; align-items: center; justify-content: space-between;
  padding: 0 0.75rem; border-radius: 4px; cursor: pointer; min-height: 38px;
  font-variant-numeric: tabular-nums; font-size: 0.72rem;
}
.swatch .meta { display: flex; gap: 0.75rem; align-items: center; }
.swatch .badge { padding: 0.05rem 0.35rem; border-radius: 999px; font-size: 0.65rem; background: rgba(0,0,0,0.18); }
.swatch .warn { font-weight: 700; }
.hint { font-size: 0.72rem; opacity: 0.6; margin-top: 0.75rem; }
@media (max-width: 720px) { .panel { grid-template-columns: 1fr; } }
```

- [ ] **Step 2: Create `src/demo/swatches.ts`**

```ts
import type { PaletteColor } from '../lib/index';
import { wcag, apca } from './contrast';

// Pick black or white text for best WCAG contrast against the swatch.
function textOn(hex: string): string {
  return wcag('#000000', hex) >= wcag('#ffffff', hex) ? '#000000' : '#ffffff';
}

export function renderSwatches(host: HTMLElement, palette: PaletteColor[]): void {
  host.innerHTML = '';
  for (const c of palette) {
    const text = textOn(c.hex);
    const el = document.createElement('div');
    el.className = 'swatch';
    el.style.background = c.css;
    el.style.color = text;

    const { l, c: chroma, h } = c.oklch;
    const oklchStr = `oklch(${l.toFixed(3)} ${chroma.toFixed(3)} ${h.toFixed(1)})`;
    const wc = wcag(text, c.hex).toFixed(1);
    const ap = Math.abs(apca(text, c.hex)).toFixed(0);
    const warn = c.inSrgb ? '' : '<span class="warn" title="outside sRGB">⚠︎</span>';

    el.innerHTML = `
      <span>${c.hex}</span>
      <span class="meta">
        <span>${oklchStr}</span>
        <span class="badge">WCAG ${wc}</span>
        <span class="badge">APCA ${ap}</span>
        ${warn}
      </span>`;
    el.title = 'Click to copy CSS';
    el.addEventListener('click', () => {
      void navigator.clipboard.writeText(c.css);
    });
    host.appendChild(el);
  }
}
```

- [ ] **Step 3: Create `src/demo/controls.ts`**

```ts
export interface FieldSpec {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
}

export function buildControls(
  host: HTMLElement,
  fields: FieldSpec[],
  gamut: 'srgb' | 'display-p3',
  onChange: (values: Record<string, number>, gamut: 'srgb' | 'display-p3') => void,
): void {
  host.innerHTML = '';
  const state: Record<string, number> = {};
  let gamutState = gamut;
  for (const f of fields) state[f.key] = f.value;

  const emit = () => onChange({ ...state }, gamutState);

  for (const f of fields) {
    const wrap = document.createElement('label');
    wrap.className = 'control';
    const valueLabel = document.createElement('span');
    valueLabel.textContent = String(f.value);
    wrap.innerHTML = `<span class="row"><span>${f.label}</span></span>`;
    wrap.querySelector('.row')!.appendChild(valueLabel);

    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(f.min);
    input.max = String(f.max);
    input.step = String(f.step);
    input.value = String(f.value);
    input.addEventListener('input', () => {
      state[f.key] = Number(input.value);
      valueLabel.textContent = input.value;
      emit();
    });
    wrap.appendChild(input);
    host.appendChild(wrap);
  }

  const gWrap = document.createElement('label');
  gWrap.className = 'control';
  gWrap.innerHTML = '<span class="row"><span>gamut</span></span>';
  const select = document.createElement('select');
  for (const g of ['srgb', 'display-p3'] as const) {
    const opt = document.createElement('option');
    opt.value = g;
    opt.textContent = g;
    if (g === gamut) opt.selected = true;
    select.appendChild(opt);
  }
  select.addEventListener('change', () => {
    gamutState = select.value as 'srgb' | 'display-p3';
    emit();
  });
  gWrap.appendChild(select);
  host.appendChild(gWrap);

  emit();
}
```

- [ ] **Step 4: Create `src/demo/main.ts`**

```ts
import {
  sequential,
  diverging,
  qualitative,
  generatePalette,
  linear,
  type PaletteColor,
  type Gamut,
} from '../lib/index';
import { buildControls, type FieldSpec } from './controls';
import { renderSwatches } from './swatches';

type TabId = 'sequential' | 'diverging' | 'qualitative' | 'engine';

interface Tab {
  id: TabId;
  label: string;
  fields: FieldSpec[];
  build: (v: Record<string, number>, gamut: Gamut) => PaletteColor[];
}

const TABS: Tab[] = [
  {
    id: 'sequential',
    label: 'Sequential',
    fields: [
      { key: 'hue', label: 'hue', min: 0, max: 360, step: 1, value: 260 },
      { key: 'count', label: 'count', min: 2, max: 15, step: 1, value: 9 },
      { key: 'saturation', label: 'saturation', min: 0, max: 1, step: 0.01, value: 0.9 },
      { key: 'lightnessHigh', label: 'lightnessHigh', min: 0.5, max: 1, step: 0.01, value: 0.95 },
      { key: 'lightnessLow', label: 'lightnessLow', min: 0, max: 0.5, step: 0.01, value: 0.2 },
      { key: 'hueShift', label: 'hueShift', min: -180, max: 180, step: 1, value: 0 },
    ],
    build: (v, gamut) =>
      sequential({
        hue: v.hue!, count: v.count!, saturation: v.saturation!,
        lightnessHigh: v.lightnessHigh!, lightnessLow: v.lightnessLow!,
        hueShift: v.hueShift!, gamut,
      }),
  },
  {
    id: 'diverging',
    label: 'Diverging',
    fields: [
      { key: 'hueLeft', label: 'hueLeft', min: 0, max: 360, step: 1, value: 250 },
      { key: 'hueRight', label: 'hueRight', min: 0, max: 360, step: 1, value: 30 },
      { key: 'count', label: 'count', min: 3, max: 15, step: 1, value: 9 },
      { key: 'saturation', label: 'saturation', min: 0, max: 1, step: 0.01, value: 0.9 },
      { key: 'centerLightness', label: 'centerLightness', min: 0.6, max: 1, step: 0.01, value: 0.95 },
      { key: 'lightnessLow', label: 'lightnessLow', min: 0.1, max: 0.6, step: 0.01, value: 0.35 },
    ],
    build: (v, gamut) =>
      diverging({
        hueLeft: v.hueLeft!, hueRight: v.hueRight!, count: v.count!,
        saturation: v.saturation!, centerLightness: v.centerLightness!,
        lightnessLow: v.lightnessLow!, gamut,
      }),
  },
  {
    id: 'qualitative',
    label: 'Qualitative',
    fields: [
      { key: 'count', label: 'count', min: 2, max: 16, step: 1, value: 8 },
      { key: 'hueFrom', label: 'hueFrom', min: 0, max: 360, step: 1, value: 0 },
      { key: 'hueTo', label: 'hueTo', min: 0, max: 360, step: 1, value: 360 },
      { key: 'lightness', label: 'lightness', min: 0.3, max: 0.9, step: 0.01, value: 0.7 },
      { key: 'saturation', label: 'saturation', min: 0, max: 1, step: 0.01, value: 0.7 },
    ],
    build: (v, gamut) =>
      qualitative({
        count: v.count!, hueRange: [v.hueFrom!, v.hueTo!],
        lightness: v.lightness!, saturation: v.saturation!, gamut,
      }),
  },
  {
    id: 'engine',
    label: 'Engine',
    fields: [
      { key: 'total', label: 'total', min: 2, max: 16, step: 1, value: 9 },
      { key: 'hueStart', label: 'hueStart', min: 0, max: 360, step: 1, value: 200 },
      { key: 'hueCycles', label: 'hueCycles', min: -2, max: 2, step: 0.05, value: 0.3 },
      { key: 'lightHigh', label: 'lightnessStart', min: 0, max: 1, step: 0.01, value: 0.9 },
      { key: 'lightLow', label: 'lightnessEnd', min: 0, max: 1, step: 0.01, value: 0.25 },
      { key: 'satStart', label: 'saturationStart', min: 0, max: 1, step: 0.01, value: 0.85 },
      { key: 'satEnd', label: 'saturationEnd', min: 0, max: 1, step: 0.01, value: 0.85 },
    ],
    build: (v, gamut) =>
      generatePalette({
        total: v.total!, hueStart: v.hueStart!, hueCycles: v.hueCycles!,
        hueEasing: linear,
        lightnessRange: [v.lightHigh!, v.lightLow!],
        saturationRange: [v.satStart!, v.satEnd!],
        gamut,
      }),
  },
];

function render(app: HTMLElement): void {
  app.innerHTML = `
    <h1>CuspHanger</h1>
    <p class="sub">OKLCH palettes from intuitive parameters — gamut-relative saturation, in-gamut by construction.</p>
    <nav class="tabs"></nav>
    <section class="panel">
      <div class="controls"></div>
      <div>
        <div class="swatches"></div>
        <p class="hint">Click a swatch to copy its CSS. ⚠︎ marks colors outside the sRGB gamut.</p>
      </div>
    </section>`;

  const tabsNav = app.querySelector('.tabs') as HTMLElement;
  const controlsHost = app.querySelector('.controls') as HTMLElement;
  const swatchHost = app.querySelector('.swatches') as HTMLElement;
  let active: TabId = 'sequential';

  const mountTab = (tab: Tab) => {
    buildControls(controlsHost, tab.fields, 'srgb', (values, gamut) => {
      renderSwatches(swatchHost, tab.build(values, gamut));
    });
  };

  const renderTabs = () => {
    tabsNav.innerHTML = '';
    for (const tab of TABS) {
      const b = document.createElement('button');
      b.textContent = tab.label;
      b.setAttribute('aria-selected', String(tab.id === active));
      b.addEventListener('click', () => {
        active = tab.id;
        renderTabs();
        mountTab(tab);
      });
      tabsNav.appendChild(b);
    }
  };

  renderTabs();
  mountTab(TABS[0]!);
}

render(document.getElementById('app') as HTMLElement);
```

- [ ] **Step 5: Run the demo and verify manually**

Run: `npm run dev`
Expected: open the printed localhost URL. Verify:
- Four tabs (Sequential / Diverging / Qualitative / Engine) switch correctly.
- Moving any slider updates the swatch strip live.
- Each swatch shows hex, oklch readout, WCAG and APCA badges.
- Switching the gamut selector to `display-p3` updates swatches (and on a P3 display, more vivid colors).
- Diverging shows a light neutral center; qualitative shows evenly spaced hues.
- Clicking a swatch copies its CSS (paste to confirm).

- [ ] **Step 6: Typecheck and full test run**

Run: `npm run typecheck && npm test`
Expected: no type errors; all tests pass.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: vanilla TS demo (tabs, live controls, swatches, contrast, gamut toggle)"
```

---

## Task 11: README

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: the public API from Task 8.
- Produces: usage documentation.

- [ ] **Step 1: Write `README.md`**

````markdown
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
````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README"
```

---

## Self-Review

**Spec coverage:**
- Cusp + triangle model → Task 4 (`cusp`, `maxChromaAt`). ✓
- Gamut-relative saturation → Task 5 (`relativeToOklch`) + Task 6 engine. ✓
- Per-channel trajectories (hue cycles + easings) → Task 2 (easings) + Task 6 engine. ✓
- Engine `generatePalette` with exact `PaletteOptions` → Task 3 (types) + Task 6. ✓
- Presets `sequential`/`diverging`/`qualitative` → Task 7. ✓ (diverging is a composition, per spec.)
- `PaletteColor` with hex/css/inSrgb/inP3, P3 `color(display-p3 …)` → Task 5 (`toPaletteColor`). ✓
- Demo: tabs, live controls, swatches, OKLCH+hex readout, WCAG+APCA badges, gamut toggle, copy → Task 9 + Task 10. ✓ (Engine tab included per the approved spec.)
- Testing plan (gamut safety, monotonic lightness, mid-tone peak, diverging symmetry, qualitative distinctness, cusp sanity, hueCycles) → Tasks 4–8. ✓
- Tooling (Vite lib build + dts, Vitest, culori only) → Task 1, Task 8. ✓
- Naming `cusphanger` / CuspHanger → Task 1, Task 11. ✓

**Deviation from spec (intentional, simpler & more faithful):** the spec described a saturation
`hump` to create the mid-tone peak; in implementation the gamut-relative saturation already makes
absolute chroma peak at the cusp, so presets use a **constant** saturation range and `hump` stays
an optional engine-level easing. Noted in Task 6.

**Placeholder scan:** none — every step has full code or an exact command.

**Type consistency:** `Oklch {l,c,h}`, `PaletteColor {oklch,hex,css,inSrgb,inP3}`, `Gamut`,
`PaletteOptions`/preset option names are defined once in Task 3 and consumed unchanged in Tasks
4–10. `maxChromaAt`, `cusp`, `relativeToOklch`, `oklchToRelative`, `toPaletteColor`,
`generatePalette`, `sequential`, `diverging`, `qualitative` names match across producer/consumer
tasks. ✓
