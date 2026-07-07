import { describe, it, expect } from 'vitest';
import { deriveTheme, applyTheme } from './theme';
import type { OklchColor } from '../lib/index';

const o = (l: number, c: number, h: number): OklchColor => ({ mode: 'oklch', l, c, h });

describe('deriveTheme', () => {
  it('uses the palette extremes directly when they carry enough contrast', () => {
    const palette = [o(0.95, 0.02, 80), o(0.6, 0.15, 80), o(0.2, 0.08, 80)];
    const t = deriveTheme(palette);
    expect(t.bg).toEqual(palette[0]);
    expect(t.ink).toEqual(palette[2]);
  });

  it('guards contrast on a narrow mid-lightness palette, keeping the hues', () => {
    const palette = [o(0.6, 0.1, 200), o(0.52, 0.12, 210), o(0.45, 0.11, 220)];
    const t = deriveTheme(palette);
    expect(t.bg.l).toBeGreaterThanOrEqual(0.94);
    expect(t.ink.l).toBeLessThanOrEqual(0.2);
    expect(t.bg.l - t.ink.l).toBeGreaterThanOrEqual(0.4);
    expect(t.bg.h).toBe(200); // hue of the lightest member survives
    expect(t.ink.h).toBe(220); // hue of the darkest member survives
    expect(t.bg.c).toBeLessThanOrEqual(0.03); // surfaces stay quiet
  });

  it('picks the max-chroma member as peak, clamping the accent lightness', () => {
    const palette = [o(0.93, 0.18, 100), o(0.55, 0.21, 30), o(0.2, 0.02, 100)];
    const t = deriveTheme(palette);
    expect(t.peak).toEqual(palette[1]);
    expect(t.accent).toEqual(palette[1]); // mid lightness: no clamp needed

    const light = deriveTheme([o(0.93, 0.18, 100), o(0.5, 0.05, 100)]);
    expect(light.accent.l).toBeLessThanOrEqual(0.68);
    expect(light.accent.h).toBe(100);
    expect(light.accent.c).toBe(0.18);
  });

  it('returns a usable neutral theme for an empty palette', () => {
    const t = deriveTheme([]);
    expect(t.bg.l - t.ink.l).toBeGreaterThanOrEqual(0.4);
    expect(t.accent.c).toBeGreaterThan(0);
  });
});

describe('applyTheme', () => {
  // minimal stand-in for an element's CSSStyleDeclaration surface
  const fakeEl = () => {
    const props = new Map<string, string>();
    return {
      props,
      style: {
        setProperty: (k: string, v: string) => void props.set(k, v),
        removeProperty: (k: string) => void props.delete(k),
        getPropertyValue: (k: string) => props.get(k) ?? '',
      },
    };
  };

  it('writes --pal-* channels, count, and semantic canvas tokens', () => {
    const el = fakeEl();
    const palette = [o(0.9, 0.02, 250), o(0.5, 0.18, 255), o(0.2, 0.07, 260)];
    applyTheme(el as unknown as HTMLElement, palette);
    expect(el.props.get('--pal-n')).toBe('3');
    expect(el.props.get('--pal-0')).toMatch(/^oklch\(/);
    expect(el.props.get('--pal-first')).toBe(el.props.get('--pal-0'));
    expect(el.props.get('--pal-last')).toBe(el.props.get('--pal-2'));
    expect(el.props.get('--pal-peak')).toBe(el.props.get('--pal-1'));
    for (const k of ['--canvas-bg', '--canvas-ink', '--canvas-accent'])
      expect(el.props.get(k)).toMatch(/^oklch\(/);
  });

  it('removes stale --pal-* entries when the palette shrinks', () => {
    const el = fakeEl();
    applyTheme(el as unknown as HTMLElement, [o(0.9, 0.02, 0), o(0.5, 0.1, 0), o(0.2, 0.05, 0)]);
    applyTheme(el as unknown as HTMLElement, [o(0.9, 0.02, 0), o(0.2, 0.05, 0)]);
    expect(el.props.get('--pal-n')).toBe('2');
    expect(el.props.has('--pal-2')).toBe(false);
  });
});
