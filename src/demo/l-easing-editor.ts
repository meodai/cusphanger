import type { OklchColor } from '../lib/index';
import { cubicBezier } from '../lib/index';
import { cssOf } from './color';

export type BezierHandles = [number, number, number, number];

export interface LEasingParams {
  handles: BezierHandles;
  palette: OklchColor[];
  mirror?: boolean;
}

const f = (n: number) => n.toFixed(2);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round2 = (n: number) => Math.round(n * 100) / 100;

const W = 240;
const H = 240;
const PAD = 16;

const xOf = (t: number) => PAD + t * (W - 2 * PAD);
const yOf = (v: number) => PAD + (1 - v) * (H - 2 * PAD);
const tOf = (x: number) => (x - PAD) / (W - 2 * PAD);
const vOf = (y: number) => 1 - (y - PAD) / (H - 2 * PAD);

const handle = (x: number, y: number, kind: 'a' | 'b'): string =>
  `<g data-handle="${kind}">
     <circle class="cc-hit" cx="${f(x)}" cy="${f(y)}" r="13"/>
     <circle class="cc-handle" cx="${f(x)}" cy="${f(y)}" r="5"/>
   </g>`;

const diamond = (x: number, y: number, r: number, fill: string): string =>
  `<polygon points="${f(x)},${f(y - r)} ${f(x + r)},${f(y)} ${f(x)},${f(y + r)} ${f(x - r)},${f(y)}" fill="${fill}" class="cc-dot"/>`;

export function initLEasingEditor(
  host: HTMLElement,
  onInput: (handles: BezierHandles) => void,
): (params: LEasingParams | null) => void {
  let params: LEasingParams | null = null;

  function render(): void {
    if (!params) return;
    const [x1, y1, x2, y2] = params.handles;
    const ease = cubicBezier(x1, y1, x2, y2);
    const N = params.palette.length;

    let out = '';
    out += `<rect x="${PAD}" y="${PAD}" width="${W - 2 * PAD}" height="${H - 2 * PAD}" class="cc-tri"/>`;
    out += `<line x1="${xOf(0)}" y1="${yOf(0)}" x2="${xOf(1)}" y2="${yOf(1)}" class="cc-ghost"/>`;
    out += `<line x1="${xOf(0)}" y1="${yOf(0)}" x2="${f(xOf(x1))}" y2="${f(yOf(y1))}" class="cc-median"/>`;
    out += `<line x1="${xOf(1)}" y1="${yOf(1)}" x2="${f(xOf(x2))}" y2="${f(yOf(y2))}" class="cc-median"/>`;
    out += `<path d="M ${xOf(0)} ${yOf(0)} C ${f(xOf(x1))} ${f(yOf(y1))} ${f(xOf(x2))} ${f(yOf(y2))} ${xOf(1)} ${yOf(1)}" class="cc-curve"/>`;

    for (const [i, col] of params.palette.entries()) {
      const u = N <= 1 ? 0 : i / (N - 1);
      const t = params.mirror ? 1 - Math.abs(1 - 2 * u) : u;
      const folded = params.mirror === true && u > 0.5;
      const v = ease(t);
      const fill = cssOf(col);
      if (!folded) out += diamond(xOf(t), yOf(v), 4, fill);
      out += diamond(folded ? W - PAD + 7 : PAD - 7, yOf(v), 3.5, fill);
    }

    out += handle(xOf(x1), yOf(y1), 'a');
    out += handle(xOf(x2), yOf(y2), 'b');

    host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true">${out}</svg>
      <span class="marks" aria-hidden="true"></span>`;
  }

  let drag: 'a' | 'b' | null = null;

  host.addEventListener('pointerdown', (e) => {
    const target = (e.target as Element).closest('[data-handle]') as SVGElement | null;
    if (!target || !params) return;
    drag = target.dataset.handle as 'a' | 'b';
    host.dataset.dragging = drag;
    e.preventDefault();
  });

  window.addEventListener('pointermove', (e) => {
    if (!drag || !params) return;
    const svg = host.querySelector('svg');
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) * W) / rect.width;
    const y = ((e.clientY - rect.top) * H) / rect.height;
    const t = round2(clamp(tOf(x), 0, 1));
    const v = round2(clamp(vOf(y), 0, 1));
    const [x1, y1, x2, y2] = params.handles;
    onInput(drag === 'a' ? [t, v, x2, y2] : [x1, y1, t, v]);
  });

  const endDrag = () => {
    drag = null;
    delete host.dataset.dragging;
  };
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);

  return (p) => {
    params = p;
    host.hidden = !p;
    if (p) render();
    else host.innerHTML = '';
  };
}
