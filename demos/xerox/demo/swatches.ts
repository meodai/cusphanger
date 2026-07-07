import { maxChromaAt, type OklchColor } from '../lib/index';
import { oklchSrgb } from 'nutelch';
import { wcag, apca } from './contrast';
import { cssOf, hexOf } from './color';

// Pick black or white text for best WCAG contrast against the swatch.
function textOn(hex: string): string {
  return wcag('#000000', hex) >= wcag('#ffffff', hex) ? '#000000' : '#ffffff';
}

// true when the color sits beyond the sRGB shell (i.e. a wide-gamut / P3 color).
const outsideSrgb = (c: OklchColor): boolean => c.c > maxChromaAt(c.h, c.l, oklchSrgb) + 1e-6;

// Compact full-width color band (no labels) — click expands the detail view.
export function renderStrip(host: HTMLElement, palette: OklchColor[]): void {
  host.innerHTML = palette
    .map((c) => `<span class="palette-strip__cell" style="background:${cssOf(c)}"></span>`)
    .join('');
}

export function renderSwatches(host: HTMLElement, palette: OklchColor[]): void {
  host.innerHTML = '';
  for (const c of palette) {
    const hex = hexOf(c);
    const text = textOn(hex);
    const el = document.createElement('div');
    el.className = 'swatch';
    el.style.background = cssOf(c);
    el.style.color = text;

    const oklchStr = `oklch(${c.l.toFixed(3)} ${c.c.toFixed(3)} ${c.h.toFixed(1)})`;
    const wc = wcag(text, hex).toFixed(1);
    const ap = Math.abs(apca(text, hex)).toFixed(0);
    const warn = outsideSrgb(c) ? '<span class="warn" title="outside sRGB">⚠︎</span>' : '';

    el.innerHTML = `
      <span>${hex}</span>
      <span class="meta">
        <span>${oklchStr}</span>
        <span class="badge">WCAG ${wc}</span>
        <span class="badge">APCA ${ap}</span>
        ${warn}
      </span>`;
    el.title = 'Click to copy CSS';
    el.addEventListener('click', () => {
      void navigator.clipboard.writeText(cssOf(c));
    });
    host.appendChild(el);
  }
}
