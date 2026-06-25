import type { PaletteColor } from '../lib/index';
import { wcag, apca } from './contrast';

// Pick black or white text for best WCAG contrast against the swatch.
function textOn(hex: string): string {
  return wcag('#000000', hex) >= wcag('#ffffff', hex) ? '#000000' : '#ffffff';
}

// Compact full-width color band (no labels) — click expands the detail view.
export function renderStrip(host: HTMLElement, palette: PaletteColor[]): void {
  host.innerHTML = palette
    .map((c) => `<span class="palette-strip__cell" style="background:${c.css}"></span>`)
    .join('');
}

export function renderSwatches(host: HTMLElement, palette: PaletteColor[]): void {
  host.innerHTML = '';
  for (const c of palette) {
    const text = textOn(c.hex);
    const el = document.createElement('div');
    el.className = 'swatch';
    el.style.background = c.css;
    el.style.color = text;

    const { l, c: chroma, h } = c.oklch;
    const oklchStr = `oklch(${l.toFixed(3)} ${chroma.toFixed(3)} ${h.toFixed(1)})`;
    const wc = wcag(text, c.hex).toFixed(1);
    const ap = Math.abs(apca(text, c.hex)).toFixed(0);
    const warn = c.inSrgb ? '' : '<span class="warn" title="outside sRGB">⚠︎</span>';

    el.innerHTML = `
      <span>${c.hex}</span>
      <span class="meta">
        <span>${oklchStr}</span>
        <span class="badge">WCAG ${wc}</span>
        <span class="badge">APCA ${ap}</span>
        ${warn}
      </span>`;
    el.title = 'Click to copy CSS';
    el.addEventListener('click', () => {
      void navigator.clipboard.writeText(c.css);
    });
    host.appendChild(el);
  }
}
