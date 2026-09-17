import { describe, it, expect } from 'vitest';
import { cubicBezier } from './easing';

describe('cubicBezier', () => {
  it('(0,0,1,1) is identity', () => {
    const e = cubicBezier(0, 0, 1, 1);
    for (const t of [0, 0.1, 0.5, 0.9, 1]) expect(e(t)).toBeCloseTo(t, 9);
  });

  it('pins the endpoints', () => {
    const e = cubicBezier(0.42, 0, 0.58, 1);
    expect(e(0)).toBe(0);
    expect(e(1)).toBe(1);
  });

  it('is monotone even with overshooting y handles', () => {
    const e = cubicBezier(0.3, 1.8, 0.7, -0.6);
    let prev = 0;
    for (let i = 1; i <= 100; i++) {
      const v = e(i / 100);
      expect(v).toBeGreaterThanOrEqual(prev - 1e-12);
      expect(v).toBeLessThanOrEqual(1);
      prev = v;
    }
  });

  it('clamps x handles too, so the inversion stays well-defined', () => {
    const e = cubicBezier(-2, 0.2, 3, 0.8);
    let prev = 0;
    for (let i = 0; i <= 50; i++) {
      const v = e(i / 50);
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(prev - 1e-12);
      prev = v;
    }
  });

  it('matches the CSS ease curve at its midpoint', () => {
    // cubic-bezier(0.25, 0.1, 0.25, 1) at t = 0.5 ≈ 0.8024
    expect(cubicBezier(0.25, 0.1, 0.25, 1)(0.5)).toBeCloseTo(0.8024, 3);
  });
});
