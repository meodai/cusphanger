import type { Lut } from 'nutelch';

// The color spaces the model can run in — whichever the caller's nutelch LUT is
// in. Everything space-specific lives here; the model itself works in the LUT's
// native units (L on [0, lMax], chroma as the space measures it).
//
// - 'oklch' — OKLab lightness (0..1). The paper's L(t) is in CIE L*, so it is
//   converted through luminance Y (for neutrals OKLab L = Y^(1/3) exactly).
// - 'lchuv' — polar CIELUV (L* on 0..100, D50 like nutelch/culori): the paper's
//   own space, so L(t) applies with no conversion at all.
// - 'lch'   — CIE LCH (CIELAB, D50): same L*, so L(t) also applies as-is.
// - 'hct'   — Material's HCT (CAM16 hue/chroma; tone = L*, D65), from
//   'nutelch/hct': tone is L*, so L(t) applies as-is here too.
export type PaletteMode = 'oklch' | 'lchuv' | 'lch' | 'hct';

export interface Space {
  mode: PaletteMode;
  lMax: number; // white's lightness
  fromLstar: (lStar: number) => number; // CIE L* → native L
  toLstar: (l: number) => number; // native L → CIE L*
  // the paper's 'bright point' (sRGB yellow #ffff00) — Table 2 default
  brightPoint: { l: number; c: number; h: number };
}

const KAPPA = 24389 / 27;
const EPS = 216 / 24389;

const OKLCH: Space = {
  mode: 'oklch',
  lMax: 1,
  fromLstar: (lStar) => Math.cbrt(lStar > 8 ? Math.pow((lStar + 16) / 116, 3) : lStar / KAPPA),
  toLstar: (L) => {
    const y = L * L * L;
    return y > EPS ? 116 * Math.cbrt(y) - 16 : KAPPA * y;
  },
  brightPoint: { l: 0.968, c: 0.211, h: 109.77 },
};

// the L*-based spaces: lightness is L* itself (0..100)
const lstarSpace = (mode: PaletteMode, brightPoint: Space['brightPoint']): Space => ({
  mode,
  lMax: 100,
  fromLstar: (lStar) => lStar,
  toLstar: (l) => l,
  brightPoint,
});

const SPACES: Record<PaletteMode, Space> = {
  oklch: OKLCH,
  lchuv: lstarSpace('lchuv', { l: 97.607, c: 84.749, h: 84.593 }),
  lch: lstarSpace('lch', { l: 97.607, c: 94.712, h: 99.572 }),
  hct: lstarSpace('hct', { l: 97.138, c: 75.509, h: 111.051 }),
};

export function spaceOf(lut: Lut): Space {
  const sp = SPACES[lut.mode as PaletteMode];
  if (!sp) {
    throw new Error(
      `cusphanger: unsupported LUT mode '${lut.mode}' — use an oklch, lchuv, lch or ` +
        `hct LUT from nutelch`,
    );
  }
  return sp;
}
