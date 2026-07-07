type Rng = () => number;

const mulberry32 = (seed: number): Rng => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const pal = (i: number) => `var(--pal-${i})`;
const f = (v: number) => v.toFixed(1);

const FRONT = 80;
const DEPTH = 100;
const A = DEPTH * Math.SQRT1_2;
const VB = FRONT + A;

const poly = (pts: Array<[number, number]>, fill: string) =>
  `<polygon points="${pts.map(([px, py]) => `${f(px)},${f(py)}`).join(' ')}" fill="${fill}" stroke="${fill}" stroke-width="1" stroke-linejoin="round"/>`;

function outlinePath(faces: Array<Array<[number, number]>>): string {
  const seen = new Set<string>();
  let d = '';
  for (const face of faces) {
    for (let i = 0; i < face.length; i++) {
      const a = face[i]!;
      const b = face[(i + 1) % face.length]!;
      const key = [a, b]
        .map(([x, y]) => `${f(x)},${f(y)}`)
        .sort()
        .join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      d += `M ${f(a[0])},${f(a[1])} L ${f(b[0])},${f(b[1])} `;
    }
  }
  return d.trim();
}

function blockFaces(sx: number, sy: number): {
  front: Array<[number, number]>;
  horiz: Array<[number, number]>;
  vert: Array<[number, number]>;
} {
  const FLt: [number, number] = [0, 0];
  const FRt: [number, number] = [FRONT, 0];
  const FRb: [number, number] = [FRONT, FRONT];
  const FLb: [number, number] = [0, FRONT];
  const bk = ([x, y]: [number, number]): [number, number] => [x + sx * A, y + sy * A];

  const horiz: Array<[number, number]> =
    sy < 0 ? [FLt, FRt, bk(FRt), bk(FLt)] : [FLb, FRb, bk(FRb), bk(FLb)];
  const vert: Array<[number, number]> =
    sx > 0 ? [FRt, FRb, bk(FRb), bk(FRt)] : [FLt, FLb, bk(FLb), bk(FLt)];
  const front: Array<[number, number]> = [FLt, FRt, FRb, FLb];

  const all = [FLt, FRt, FRb, FLb, bk(FLt), bk(FRt), bk(FRb), bk(FLb)];
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  const ox = (VB - (Math.max(...xs) + Math.min(...xs))) / 2;
  const oy = (VB - (Math.max(...ys) + Math.min(...ys))) / 2;
  const shift = (face: Array<[number, number]>): Array<[number, number]> =>
    face.map(([x, y]) => [x + ox, y + oy]);
  return { front: shift(front), horiz: shift(horiz), vert: shift(vert) };
}

function tileSvg(
  rng: Rng,
  n: number,
  colorAt: (i: number) => string,
): { ground: string; svg: string } {

  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  const ground = order[0]!;
  const face = (k: number) => colorAt(order[1 + (k % (n - 1 || 1))] ?? ground);

  const sx = rng() < 0.5 ? -1 : 1;
  const sy = rng() < 0.5 ? -1 : 1;
  const { front, horiz, vert } = blockFaces(sx, sy);

  const block =
    poly(horiz, face(1)) + poly(vert, face(2)) + poly(front, face(0));
  const lines = outlinePath([front, horiz, vert]);

  return {
    ground: colorAt(ground),

    svg: `<svg viewBox="0 0 ${f(VB)} ${f(VB)}" role="img" aria-label="composition"><g data-ghost-keep>${block}</g><path class="tile-lines" d="${lines}" vector-effect="non-scaling-stroke"/></svg>`,
  };
}

export interface CompositionControls {
  regen: HTMLElement;
  hueToggle: HTMLInputElement;

  variantColors: (rng: Rng) => string[];
}

export function initCompositions(
  host: HTMLElement,
  controls: CompositionControls,
  count = 12,
): (n: number) => void {
  const { regen, hueToggle, variantColors } = controls;
  const seeds = Array.from({ length: count }, () => (Math.random() * 2 ** 31) | 0);
  let lastN = 0;

  const draw = (i: number) => {
    const n = Math.max(lastN, 1);

    const rng = mulberry32(seeds[i]!);
    let colorAt: (k: number) => string;
    if (hueToggle.checked) {
      const colors = variantColors(rng);
      colorAt = (k) => colors[k % colors.length] ?? pal(k);
    } else {
      colorAt = pal;
    }
    const { ground, svg } = tileSvg(rng, n, colorAt);
    tiles[i]!.style.setProperty('--tile-ground', ground);
    tiles[i]!.innerHTML = svg;
  };
  const drawAll = () => tiles.forEach((_, i) => draw(i));
  const reseed = (i: number) => (seeds[i] = (Math.random() * 2 ** 31) | 0);

  const tiles = Array.from({ length: count }, (_, i) => {
    const b = document.createElement('button');
    b.type = 'button';

    b.className = i === 1 || i === 6 ? 'tile tile--big' : 'tile';
    b.title = 'click to reshuffle';
    b.addEventListener('click', () => {
      reseed(i);
      draw(i);
    });
    host.appendChild(b);
    return b;
  });

  regen.addEventListener('click', () => {
    seeds.forEach((_, i) => reseed(i));
    drawAll();
  });
  hueToggle.addEventListener('change', drawAll);

  setInterval(() => {
    const i = Math.floor(Math.random() * count);
    reseed(i);
    draw(i);
  }, 500);

  return (n: number) => {
    const sizeChanged = n !== lastN;
    lastN = n;

    if (hueToggle.checked || sizeChanged) drawAll();
  };
}
