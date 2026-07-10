import type { Lut } from 'nutelch';
import type { OklchColor } from '../lib/index';
import {
  buildTriangle,
  cSeq,
  tForLightness,
  lightnessAt,
  bcFromLRange,
  type Tri,
  type LCH,
} from '../lib/wijffelaars';
import { css, cssOf } from './color';
import { maxChromaAt } from './gamut';
import { oklchP3 } from 'nutelch';

// The paper's fig. 5 as a rail control: the palette bar beside the gamut
// triangle (p0 black · p1 cusp · p2 white) with the Bézier path through it.
// Three kinds of handles — the sampled curve's dark/light endpoints move
// vertically and set the lightness range (→ brightness b + contrast c), and
// q1 rides the dotted median from midpoint(p0,p2) to the cusp; its fraction
// IS the paper's saturation s. Diverging mirrors two arms around the axis.

export interface CurveParams {
  hues: number[]; // one hue (sequential) or two (diverging arms)
  palette: OklchColor[];
  s: number;
  b: number;
  c: number;
  w: number;
  lut: Lut;
  matchIndex?: number | null; // the sample fromColor solved onto — gets a marker dot
}

interface ArmGeom {
  tri: Tri;
  xOf: (c: number) => number;
}

type HandleKind = 'dark' | 'light' | 'sat';

const f = (n: number) => n.toFixed(2);
const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// square, like the other viz panes
const W = 240;
const H = 240;
const PAD = 16; // room at the ends for the endpoint handles
const L_GAP = 0.04; // minimum lightness gap between the two endpoints
const SEG = 24; // polyline samples for the solid (used) curve segment

// paper orientation: white on top, black at the bottom
const yOf = (l: number) => PAD + (1 - l) * (H - 2 * PAD);
const lOf = (y: number) => 1 - (y - PAD) / (H - 2 * PAD);

const handle = (x: number, y: number, kind: HandleKind, arm: number): string =>
  `<g data-handle="${kind}" data-arm="${arm}">
     <circle class="cc-hit" cx="${f(x)}" cy="${f(y)}" r="13"/>
     <circle class="cc-handle" cx="${f(x)}" cy="${f(y)}" r="5"/>
   </g>`;

// the real gamut slice under the triangle, as in the slice view: one gradient
// row (neutral → max chroma) per lightness band
const fillCache = new Map<string, string>();
const gamutFill = (hue: number, xOf: (c: number) => number, lut: Lut, arm: number): string => {
  const key = `${lut === oklchP3 ? 'p3' : 'srgb'}|${hue.toFixed(1)}|${arm}|${xOf(0.1).toFixed(2)}`;
  const hit = fillCache.get(key);
  if (hit) return hit;
  const ROWS = 48;
  const x0 = xOf(0);
  const idBase = `cc-${lut === oklchP3 ? 'p' : 's'}-${Math.round(hue)}-${arm}`;
  let grads = '';
  let polys = '';
  for (let i = 0; i < ROWS; i++) {
    const L0 = i / ROWS;
    const L1 = (i + 1) / ROWS;
    const Lm = (L0 + L1) / 2;
    const maxC = maxChromaAt(hue, Lm, lut);
    if (maxC <= 0) continue;
    const xE0 = xOf(maxChromaAt(hue, L0, lut));
    const xE1 = xOf(maxChromaAt(hue, L1, lut));
    const gid = `${idBase}-${i}`;
    grads += `<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="${f(x0)}" y1="0" x2="${f((xE0 + xE1) / 2)}" y2="0"><stop offset="0%" stop-color="${css(Lm, 0, hue)}"/><stop offset="100%" stop-color="${css(Lm, maxC, hue)}"/></linearGradient>`;
    polys += `<polygon points="${f(x0)},${f(yOf(L0))} ${f(xE0)},${f(yOf(L0))} ${f(xE1)},${f(yOf(L1))} ${f(x0)},${f(yOf(L1))}" fill="url(#${gid})"/>`;
  }
  const str = grads + polys;
  fillCache.set(key, str);
  return str;
};

const diamond = (x: number, y: number, r: number, fill: string): string =>
  `<polygon points="${f(x)},${f(y - r)} ${f(x + r)},${f(y)} ${f(x)},${f(y + r)} ${f(x - r)},${f(y)}" fill="${fill}" class="cc-dot"/>`;

export function initCurveControl(
  host: HTMLElement,
  onInput: (patch: Record<string, number>) => void,
): (params: CurveParams | null) => void {
  let params: CurveParams | null = null;
  let arms: ArmGeom[] = [];

  // the sampled curve's endpoint lightnesses, clamped into the triangle
  const lEnds = (tri: Tri): [number, number] => [
    clamp(lightnessAt(0, params!.b, params!.c), tri.p0.l, tri.p2.l),
    clamp(lightnessAt(1, params!.b, params!.c), tri.p0.l, tri.p2.l),
  ];

  const curvePoint = (arm: ArmGeom, l: number): [number, number] => {
    const pt = cSeq(tForLightness(l, arm.tri), arm.tri);
    return [arm.xOf(pt.c), yOf(pt.l)];
  };

  function render(): void {
    if (!params) return;
    const { hues, palette, s, w, lut } = params;
    const mirror = hues.length > 1;
    const tris = hues.map((h) => buildTriangle(h, s, w, lut));
    const maxCusp = Math.max(...tris.map((t) => t.p1.c), 0.01);

    // sequential: one triangle pointing right.
    // diverging: shared axis in the middle, arms pointing outward.
    if (!mirror) {
      const x0 = 38;
      const xScale = (W - 18 - x0) / maxCusp;
      arms = [{ tri: tris[0]!, xOf: (c) => x0 + c * xScale }];
    } else {
      const x0 = W / 2;
      const xScale = (x0 - 20) / maxCusp;
      arms = [
        { tri: tris[0]!, xOf: (c) => x0 - c * xScale },
        { tri: tris[1]!, xOf: (c) => x0 + c * xScale },
      ];
    }

    let out = '';
    let handles = ''; // drawn after both arms, so no curve paints over a bullet
    arms.forEach((arm, i) => {
      const { tri } = arm;
      const pt = (p: LCH) => `${f(arm.xOf(p.c))},${f(yOf(p.l))}`;
      const midC = (tri.p0.c + tri.p2.c) / 2;
      const midL = (tri.p0.l + tri.p2.l) / 2;

      out += `<polygon points="${pt(tri.p0)} ${pt(tri.p1)} ${pt(tri.p2)}" class="cc-tri"/>`;
      out += `<line x1="${f(arm.xOf(midC))}" y1="${f(yOf(midL))}" x2="${f(arm.xOf(tri.p1.c))}" y2="${f(yOf(tri.p1.l))}" class="cc-median"/>`;
      // the control polygon's chord: q0 on the p0–p1 edge to q2 on the p2–p1 edge, through q1
      out += `<line x1="${f(arm.xOf(tri.q0.c))}" y1="${f(yOf(tri.q0.l))}" x2="${f(arm.xOf(tri.q2.c))}" y2="${f(yOf(tri.q2.l))}" class="cc-chord"/>`;
      out += `<path d="M ${pt(tri.p0)} Q ${pt(tri.q0)} ${pt(tri.q1)} Q ${pt(tri.q2)} ${pt(tri.p2)}" class="cc-ghost"/>`;

      const [l0, l1] = lEnds(tri);
      const seg: string[] = [];
      for (let k = 0; k <= SEG; k++) {
        const [x, y] = curvePoint(arm, l0 + ((l1 - l0) * k) / SEG);
        seg.push(`${f(x)},${f(y)}`);
      }
      out += `<polyline points="${seg.join(' ')}" class="cc-curve"/>`;

      for (const q of [tri.q0, tri.q2]) {
        out += `<circle cx="${f(arm.xOf(q.c))}" cy="${f(yOf(q.l))}" r="2.5" class="cc-q"/>`;
      }

      const sign = mirror && i === 0 ? -1 : 1;
      if (!mirror) {
        const lbl = (p: LCH, text: string, dx: number, anchor: string) =>
          `<text x="${f(arm.xOf(p.c) + dx)}" y="${f(yOf(p.l) + 3.5)}" class="cc-label" text-anchor="${anchor}">${text}</text>`;
        out += lbl(tri.p0, 'p0', -9, 'end');
        out += lbl(tri.p1, 'p1', 9, 'start');
        out += lbl(tri.p2, 'p2', -9, 'end');
      }
      if (i === 0) {
        const qx = arm.xOf(tri.q1.c);
        const qy = yOf(tri.q1.l);
        out += `<text x="${f(qx + sign * 10)}" y="${f(qy - 9)}" class="cc-label" text-anchor="${sign < 0 ? 'end' : 'start'}">s ${f(s)}</text>`;
      }

      // palette samples on the curve, like the slice view's diamonds — the
      // fromColor match gets a ring so the met sample is findable at a glance
      for (const [pi, col] of palette.entries()) {
        const side = mirror ? (pi < palette.length / 2 ? 0 : 1) : 0;
        if (side !== i) continue;
        const x = arm.xOf(col.c);
        out += diamond(x, yOf(col.l), 3.5, cssOf(col));
        if (pi === params!.matchIndex) {
          out += `<circle cx="${f(x)}" cy="${f(yOf(col.l))}" r="7" class="cc-match"/>`;
        }
      }

      const [xd, yd] = curvePoint(arm, l0);
      handles += handle(xd, yd, 'dark', i);
      if (i === 0) {
        const [xl, yl] = curvePoint(arm, l1);
        handles += handle(xl, yl, 'light', i);
      }
      handles += handle(arm.xOf(tri.q1.c), yOf(tri.q1.l), 'sat', i);
    });
    out += handles;

    const fills = arms.map((arm, i) => gamutFill(hues[i]!, arm.xOf, lut, i)).join('');

    host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true">
      <g data-ghost-keep>${fills}</g>${out}</svg>
      <span class="marks" aria-hidden="true"></span>`;
  }

  let drag: { kind: HandleKind; arm: number } | null = null;

  host.addEventListener('pointerdown', (e) => {
    const target = (e.target as Element).closest('[data-handle]') as SVGElement | null;
    if (!target || !params) return;
    drag = {
      kind: target.dataset.handle as HandleKind,
      arm: Number(target.dataset.arm),
    };
    host.dataset.dragging = drag.kind;
    e.preventDefault();
  });

  window.addEventListener('pointermove', (e) => {
    if (!drag || !params) return;
    const arm = arms[drag.arm];
    const svg = host.querySelector('svg');
    if (!arm || !svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) * W) / rect.width;
    const y = ((e.clientY - rect.top) * H) / rect.height;

    if (drag.kind === 'sat') {
      // project the pointer onto the median: its fraction is s exactly
      const { tri } = arm;
      const mx = arm.xOf((tri.p0.c + tri.p2.c) / 2);
      const my = yOf((tri.p0.l + tri.p2.l) / 2);
      const cx = arm.xOf(tri.p1.c);
      const cy = yOf(tri.p1.l);
      const len2 = (cx - mx) ** 2 + (cy - my) ** 2 || 1;
      const t = ((x - mx) * (cx - mx) + (y - my) * (cy - my)) / len2;
      onInput({ s: round2(clamp(t, 0, 1)) });
      return;
    }

    const [l0, l1] = lEnds(arm.tri);
    const l = lOf(y);
    const range: [number, number] =
      drag.kind === 'dark'
        ? [clamp(l, 0.005, l1 - L_GAP), l1]
        : [l0, clamp(l, l0 + L_GAP, 0.995)];
    const { b, c } = bcFromLRange(range);
    onInput({ b: round2(b), c: round2(c) });
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
