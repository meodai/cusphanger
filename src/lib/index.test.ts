import { describe, it, expect } from 'vitest';
import * as api from './index';

describe('public api', () => {
  it('exports the engine and presets', () => {
    expect(typeof api.generatePalette).toBe('function');
    expect(typeof api.sequential).toBe('function');
    expect(typeof api.diverging).toBe('function');
    expect(typeof api.qualitative).toBe('function');
  });

  it('exports color helpers and easings', () => {
    expect(typeof api.relativeToOklch).toBe('function');
    expect(typeof api.toPaletteColor).toBe('function');
    expect(typeof api.maxChromaAt).toBe('function');
    expect(typeof api.cusp).toBe('function');
    expect(typeof api.linear).toBe('function');
    expect(typeof api.hump).toBe('function');
  });
});
