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
