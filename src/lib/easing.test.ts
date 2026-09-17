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
});
