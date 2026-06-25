import { describe, it, expect } from 'vitest';
import { wcag, apca } from './contrast';

describe('wcag', () => {
  it('is ~21 for black on white', () => {
    expect(wcag('#000000', '#ffffff')).toBeCloseTo(21, 1);
  });
});

describe('apca', () => {
  it('black text on white bg is a large positive Lc', () => {
    expect(apca('#000000', '#ffffff')).toBeGreaterThan(100);
  });
  it('white text on black bg is a large negative Lc', () => {
    expect(apca('#ffffff', '#000000')).toBeLessThan(-100);
  });
  it('identical colors have ~0 contrast', () => {
    expect(Math.abs(apca('#777777', '#777777'))).toBeLessThan(1);
  });
});
