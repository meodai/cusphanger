import { describe, it, expect } from 'vitest';
import * as api from './index';

describe('public api', () => {
  it('exports the palette generators', () => {
    expect(typeof api.sequential).toBe('function');
    expect(typeof api.diverging).toBe('function');
  });

  it('exports the gamut + color helpers', () => {
    expect(typeof api.maxChromaAt).toBe('function');
    expect(typeof api.cusp).toBe('function');
    expect(typeof api.toPaletteColor).toBe('function');
    expect(typeof api.oklchOf).toBe('function');
  });
});
