import { toCss } from 'nutelch';
import type { OklchColor } from '../lib/index';

export interface Theme {
  bg: OklchColor;
  ink: OklchColor;
  accent: OklchColor;
  peak: OklchColor;
}

const oklch = (l: number, c: number, h: number): OklchColor => ({ mode: 'oklch', l, c, h });

const BG_MIN_L = 0.8;
const BG_SAFE_L = 0.96;
const INK_MAX_L = 0.35;
const INK_SAFE_L = 0.18;

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

  const l = Math.min(ACCENT_MAX_L, Math.max(ACCENT_MIN_L, peak.l));
  const accent = l === peak.l ? peak : oklch(l, peak.c, peak.h);
  return { bg, ink, accent, peak };
}

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
