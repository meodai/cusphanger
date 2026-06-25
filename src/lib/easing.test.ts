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
    expect(lame(2)(0.5)).toBeCloseTo(0.134, 2);
  });

  it('hump peaks in the middle and is 0 at the ends', () => {
    const h = hump(0.5);
    expect(h(0)).toBeCloseTo(0);
    expect(h(1)).toBeCloseTo(0);
    expect(h(0.5)).toBeCloseTo(1);
  });

  it('hump with default argument behaves like hump(0.5)', () => {
    expect(hump()(0)).toBeCloseTo(0);
    expect(hump()(1)).toBeCloseTo(0);
    expect(hump()(0.5)).toBeCloseTo(1);
  });

  it('hump with peak=1 reaches 1 at t=1', () => {
    expect(hump(1)(0)).toBeCloseTo(0);
    expect(hump(1)(1)).toBeCloseTo(1);
  });

  it('hump with peak=0 reaches 1 at t=0', () => {
    expect(hump(0)(0)).toBeCloseTo(1);
    expect(hump(0)(1)).toBeCloseTo(0);
  });
});
