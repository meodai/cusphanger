// The hero: the palette as horizontal bands anchored to the right edge, each
// reaching left by its darkness (1 − L, eased into a [min, max] span) — the
// hanger rotated to RampenSau's stepped-band layout. A sequential ramp reads
// as a staircase, a diverging palette as a wedge. Every band carries its own
// oklch numbers as a big label; clicking a band copies the full oklch().
import type { OklchColor } from '../lib/index';
import { cssOf } from './color';
import { copyText } from './clipboard';

const REACH_MIN = 0.34;
const REACH_MAX = 1;
// bands lighter than this get dark ink; darker ones get light ink
const LABEL_FLIP_L = 0.62;

const label = (c: OklchColor) =>
  `${c.l.toFixed(2)} ${c.c.toFixed(3)} ${(((c.h % 360) + 360) % 360).toFixed(0)}°`;

export function renderHanger(host: HTMLElement, palette: OklchColor[]): void {
  // reuse bands across renders so width changes transition instead of remount
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
    const reach = REACH_MIN + (1 - col.l) * (REACH_MAX - REACH_MIN);
    band.style.setProperty('--swatch', `var(--pal-${i}, ${css})`);
    band.style.setProperty('--reach', reach.toFixed(4));
    band.classList.toggle('hanger__band--light', col.l > LABEL_FLIP_L);
    band.dataset.css = css;
    band.title = `${css} — click to copy`;
    band.setAttribute('aria-label', `color ${i + 1} of ${palette.length}, ${css}, copy`);
    (band.querySelector('.hanger__label') as HTMLElement).textContent = label(col);
  });
}
