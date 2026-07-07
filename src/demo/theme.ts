// Palette -> page, RampenSau-style: the whole page is tinted by the palette
// it just generated. The canvas takes the light end (bg) and dark end (ink);
// the sidebar chrome is the same pair inverted (wired in tokens.css). The
// accent is the most chromatic member (nearest the cusp). Contrast guards
// keep the page readable when the palette has no usable extremes — a guarded
// surface keeps the member's hue but moves its lightness out.
import { toCss } from 'nutelch';
import type { OklchColor } from '../lib/index';

export interface Theme {
  bg: OklchColor;
  ink: OklchColor;
  accent: OklchColor;
  peak: OklchColor; // the raw max-chroma member (accent before the clamp)
}

const oklch = (l: number, c: number, h: number): OklchColor => ({ mode: 'oklch', l, c, h });

// surfaces trust a member only beyond these; otherwise its lightness is
// pushed to the safe value. Guarantees bg.l - ink.l >= 0.45.
const BG_MIN_L = 0.8;
const BG_SAFE_L = 0.96;
const INK_MAX_L = 0.35;
const INK_SAFE_L = 0.18;
// the accent sits on both surfaces — keep it in the mid band
const ACCENT_MIN_L = 0.4;
const ACCENT_MAX_L = 0.68;

export function deriveTheme(palette: OklchColor[]): Theme {
  if (!palette.length) {
    const peak = oklch(0.55, 0.15, 260);
    return { bg: oklch(0.97, 0, 260), ink: oklch(0.17, 0, 260), accent: peak, peak };
  }
  let lightest = palette[0]!;
  let darkest = palette[0]!;
  let peak = palette[0]!;
  for (const c of palette) {
    if (c.l > lightest.l) lightest = c;
    if (c.l < darkest.l) darkest = c;
    if (c.c > peak.c) peak = c;
  }
  const bg =
    lightest.l >= BG_MIN_L
      ? lightest
      : oklch(BG_SAFE_L, Math.min(lightest.c * 0.35, 0.03), lightest.h);
  const ink =
    darkest.l <= INK_MAX_L
      ? darkest
      : oklch(INK_SAFE_L, Math.min(darkest.c * 0.5, 0.06), darkest.h);
  // out-of-shell chroma at the clamped lightness is fine: the browser gamut-maps.
  const l = Math.min(ACCENT_MAX_L, Math.max(ACCENT_MIN_L, peak.l));
  const accent = l === peak.l ? peak : oklch(l, peak.c, peak.h);
  return { bg, ink, accent, peak };
}

// Writes the tier-2 (--pal-*) and tier-3 (--canvas-*) tokens onto `root`.
// Everything downstream — hero bands, figures, the export block, the chrome
// (via inversion in tokens.css) — reads these instead of receiving colors.
export function applyTheme(root: HTMLElement, palette: OklchColor[]): void {
  const s = root.style;
  const prev = Number(s.getPropertyValue('--pal-n')) || 0;
  for (let i = palette.length; i < prev; i++) s.removeProperty(`--pal-${i}`);
  palette.forEach((c, i) => s.setProperty(`--pal-${i}`, toCss(c)));
  s.setProperty('--pal-n', String(palette.length));

  const t = deriveTheme(palette);
  if (palette.length) {
    s.setProperty('--pal-first', toCss(palette[0]!));
    s.setProperty('--pal-last', toCss(palette[palette.length - 1]!));
    s.setProperty('--pal-peak', toCss(t.peak));
  }
  s.setProperty('--canvas-bg', toCss(t.bg));
  s.setProperty('--canvas-ink', toCss(t.ink));
  s.setProperty('--canvas-accent', toCss(t.accent));
}
