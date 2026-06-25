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
