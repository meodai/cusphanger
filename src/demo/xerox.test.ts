import { describe, it, expect } from 'vitest';
import { isWebKitEngine } from './xerox';

describe('isWebKitEngine', () => {
  it('flags Safari and every iOS browser (all WebKit) by vendor', () => {
    expect(isWebKitEngine('Apple Computer, Inc.')).toBe(true);
  });

  it('lets Chromium and Firefox through', () => {
    expect(isWebKitEngine('Google Inc.')).toBe(false);
    expect(isWebKitEngine('')).toBe(false);
  });
});
