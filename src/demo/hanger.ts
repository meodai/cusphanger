import type { PaletteColor } from '../lib/index';
import { css, cssOf, okOf } from './color';
import { copyText } from './clipboard';

const REACH_MIN = 0.34;
const REACH_MAX = 1;

const LABEL_FLIP_L = 0.62;

// native values, on each space's own scale (OKLCH 0..1 L, LCHuv 0..100 L*)
const label = (c: PaletteColor) =>
  c.mode === 'oklch'
    ? `${c.l.toFixed(2)} ${c.c.toFixed(3)} ${(((c.h % 360) + 360) % 360).toFixed(0)}°`
    : `${c.l.toFixed(0)} ${c.c.toFixed(1)} ${(((c.h % 360) + 360) % 360).toFixed(0)}°`;

export function renderHanger(host: HTMLElement, palette: PaletteColor[]): void {

  const bands = Array.from(host.children) as HTMLButtonElement[];
  while (bands.length > palette.length) bands.pop()!.remove();
  while (bands.length < palette.length) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'hanger__band';
    b.innerHTML =
      '<span class="hanger__fill"><span class="hanger__label"></span></span>' +
      '<span class="marks" aria-hidden="true"></span>';
    b.addEventListener('click', () => copyText(b.dataset.css ?? '', b));
    host.appendChild(b);
    bands.push(b);
  }
  palette.forEach((col, i) => {
    const band = bands[i]!;
    const css = cssOf(col);
    // reach + label contrast are tuned in OKLab lightness, whatever the model
    const okL = okOf(col).l;
    const reach = REACH_MIN + (1 - okL) * (REACH_MAX - REACH_MIN);
    band.style.setProperty('--swatch', `var(--pal-${i}, ${css})`);
    band.style.setProperty('--reach', reach.toFixed(4));
    band.classList.toggle('hanger__band--light', okL > LABEL_FLIP_L);
    band.dataset.css = css;
    band.title = `${css} — click to copy`;
    band.setAttribute('aria-label', `color ${i + 1} of ${palette.length}, ${css}, copy`);
    (band.querySelector('.hanger__label') as HTMLElement).textContent = label(col);
  });
}

export function renderHangerGray(host: HTMLElement, palette: PaletteColor[]): void {
  while (host.children.length > palette.length) host.lastElementChild!.remove();
  while (host.children.length < palette.length) host.appendChild(document.createElement('span'));
  palette.forEach((col, i) => {
    (host.children[i] as HTMLElement).style.setProperty('--swatch', css(col.l, 0, 0, col.mode));
  });
}
