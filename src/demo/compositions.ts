// Random compositions painted by the current palette — RampenSau's example
// tiles. Every shape fills with var(--pal-i), so palette changes repaint the
// tiles through the tokens with no re-render; a tile only re-randomizes when
// the palette size changes (indices must stay in range) or when clicked.

type Rng = () => number;

// mulberry32 — tiny seedable rng so a tile's layout is stable until reseeded
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

// Sol LeWitt-style isometric cube: a ground color carrying a 2:1 iso cube whose
// three visible faces (top, left, right) are three distinct palette members —
// ground + faces are all unique within a tile (wrapping only if N < 4). The
// cube is centered at a fixed size; the only randomness is the color pick.
// Oblique (cabinet) projection, like the Sol LeWitt blocks: the FRONT face is
// a true axis-aligned square; the DEPTH shears back at 45° up-and-right, so the
// top and right faces are parallelograms. Not isometric — the front reads flat.
const FRONT = 80; // side of the square front face
const DEPTH = 100; // receding length along the 45° axis (long side walls)
const A = DEPTH * Math.SQRT1_2; // its x/y component (equal, at 45°)
const VB = FRONT + A; // tight square viewBox — the block fills it edge to edge;
// the ground/padding is the tile's own background + CSS padding, so the border
// around the block is a constant width regardless of 1x1 vs 2x2 tile size.

// stroke each face in its own fill so the shared edges don't show an
// anti-aliasing seam between adjacent polygons
const poly = (pts: Array<[number, number]>, fill: string) =>
  `<polygon points="${pts.map(([px, py]) => `${f(px)},${f(py)}`).join(' ')}" fill="${fill}" stroke="${fill}" stroke-width="1" stroke-linejoin="round"/>`;

// the block's wireframe as ONE path, each shared edge drawn exactly once —
// stroking the face polygons instead would double-stroke shared edges and
// the compounded anti-aliasing reads as darker, fatter lines
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

// The block for a given depth direction (sx, sy ∈ {-1, +1}: which corner the
// square sits in and which way it recedes). Returns the three visible faces —
// front square, a horizontal face (top if it recedes up, else bottom) and a
// vertical face (right if it recedes right, else left) — centered in the tile.
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

  // horizontal face = the front edge that faces the recede direction, extruded
  const horiz: Array<[number, number]> =
    sy < 0 ? [FLt, FRt, bk(FRt), bk(FLt)] : [FLb, FRb, bk(FRb), bk(FLb)];
  const vert: Array<[number, number]> =
    sx > 0 ? [FRt, FRb, bk(FRb), bk(FRt)] : [FLt, FLb, bk(FLb), bk(FLt)];
  const front: Array<[number, number]> = [FLt, FRt, FRb, FLb];

  // center the whole block (front corners plus their extruded counterparts)
  const all = [FLt, FRt, FRb, FLb, bk(FLt), bk(FRt), bk(FRb), bk(FLb)];
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  const ox = (VB - (Math.max(...xs) + Math.min(...xs))) / 2;
  const oy = (VB - (Math.max(...ys) + Math.min(...ys))) / 2;
  const shift = (face: Array<[number, number]>): Array<[number, number]> =>
    face.map(([x, y]) => [x + ox, y + oy]);
  return { front: shift(front), horiz: shift(horiz), vert: shift(vert) };
}

// `colorAt(i)` resolves palette slot i to a fill: either the shared --pal-i
// token (repaints live with the palette) or a baked CSS string (hue mode).
// Returns the ground fill (goes on the tile's background) and the block SVG
// (fills the tile's content box; the CSS padding is the constant ground border).
function tileSvg(
  rng: Rng,
  n: number,
  colorAt: (i: number) => string,
): { ground: string; svg: string } {
  // shuffled unique indices — ground first, then the three faces
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  const ground = order[0]!;
  const face = (k: number) => colorAt(order[1 + (k % (n - 1 || 1))] ?? ground);

  // random recede direction — the square lands in a random corner
  const sx = rng() < 0.5 ? -1 : 1;
  const sy = rng() < 0.5 ? -1 : 1;
  const { front, horiz, vert } = blockFaces(sx, sy);

  const block =
    poly(horiz, face(1)) + poly(vert, face(2)) + poly(front, face(0)); // front square on top
  const lines = outlinePath([front, horiz, vert]);

  return {
    ground: colorAt(ground),
    // data-ghost-keep: the color block prints only in the xerox ghost; the
    // wireframe path stays outside the group, so it exists only in the sharp
    // front (the ghost copies keeps only). See demo.css.
    svg: `<svg viewBox="0 0 ${f(VB)} ${f(VB)}" role="img" aria-label="composition"><g data-ghost-keep>${block}</g><path class="tile-lines" d="${lines}" vector-effect="non-scaling-stroke"/></svg>`,
  };
}

export interface CompositionControls {
  regen: HTMLElement; // "regenerate all" button
  hueToggle: HTMLInputElement; // "randomize hue" checkbox
  // builds a hue-randomized palette variant as CSS strings, seeded by `rng`
  // (same settings as the live palette, rotated to a random starting hue)
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
    // one rng per tile drives shuffle, direction and (in hue mode) the hue
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
    // the 2nd and 7th tiles span a 2x2 area in the grid
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

  // auto-cycle: twice a second reshuffle a random tile (same as clicking it)
  setInterval(() => {
    const i = Math.floor(Math.random() * count);
    reseed(i);
    draw(i);
  }, 500);

  return (n: number) => {
    const sizeChanged = n !== lastN;
    lastN = n;
    // token mode repaints via CSS on same-size changes; hue mode bakes colors
    // from the live settings, so it must redraw whenever anything changes.
    if (hueToggle.checked || sizeChanged) drawAll();
  };
}
