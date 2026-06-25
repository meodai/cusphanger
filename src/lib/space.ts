import { maxChromaAt, cusp, sharedCuspChroma, maxCuspChroma } from './gamut';
import type { Gamut, Oklch, ChromaMode } from './types';

// The chroma `s=1` targets, before clamping to the per-lightness gamut boundary.
function referenceChroma(hue: number, l: number, gamut: Gamut, chromaMode: ChromaMode): number {
  switch (chromaMode) {
    case 'cusp':
      return cusp(hue, gamut).c;
    case 'shared':
      return sharedCuspChroma(gamut);
    case 'absolute':
      return maxCuspChroma(gamut);
    default:
      return maxChromaAt(hue, l, gamut);
  }
}

export function relativeToOklch(
  s: number,
  l: number,
  hue: number,
  gamut: Gamut = 'srgb',
  chromaMode: ChromaMode = 'envelope',
): Oklch {
  const h = ((hue % 360) + 360) % 360;
  const ref = referenceChroma(h, l, gamut, chromaMode);
  // 'cusp'/'shared' aim at a hue-global target and are clamped to the boundary
  // to stay in gamut. 'envelope' already rides the boundary. 'absolute' is the
  // raw, unclamped RampenSau-style chroma and may clip out of gamut.
  const c =
    chromaMode === 'cusp' || chromaMode === 'shared'
      ? Math.min(s * ref, maxChromaAt(h, l, gamut))
      : s * ref;
  return { l, c, h };
}

export function oklchToRelative(
  color: Oklch,
  gamut: Gamut = 'srgb',
  chromaMode: ChromaMode = 'envelope',
): { s: number; l: number } {
  const ref = referenceChroma(color.h, color.l, gamut, chromaMode);
  return { s: ref === 0 ? 0 : color.c / ref, l: color.l };
}
