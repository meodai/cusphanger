// Xerox layering: the page exists twice behind itself. The front (#app) stays
// sharp; two ghost copies (.xerox-back, aria-hidden + inert) bleed behind it —
// copy A carries a slight all-over blur, copy B a heavy blur that only shows
// through patches of turbulence noise, so the "toner" is uneven.
//
// Content contract (per element, anywhere in the front):
// - default            -> lives on both layers (sharp + ghost)
// - data-ghost="only"  -> invisible in the front (opacity 0): ghost only
// - data-ghost="none"  -> invisible in the ghosts: sharp only
// - <svg> elements are never duplicated: ghosts get an empty same-size svg.
//   Children marked data-ghost-keep are copied into it (a shape or two).
//
// Caveats: opaque backgrounds in the front cover the ghosts beneath them, and
// position:fixed inside a filtered ghost pins to the ghost copy, not the
// viewport (CSS filter creates a containing block) — so fixed chrome drifts
// from its ghost on scroll.

export interface NoiseMaskOptions {
  size?: number; // tile size in px (the CSS mask-size should match)
  baseFrequency?: number; // turbulence scale — lower = larger blobs
  octaves?: number; // detail
  seed?: number;
  gain?: number; // luminance -> alpha slope (higher = harder patches)
  threshold?: number; // luminance cutoff (higher = fewer patches)
}

// A patchy alpha mask from SVG turbulence, as a data-URI ready for CSS `mask`.
export function noiseMaskSvg({
  size = 420,
  baseFrequency = 0.006,
  octaves = 3,
  seed = 11,
  gain = 0.9,
  threshold = 0.32,
}: NoiseMaskOptions = {}): string {
  const k = gain;
  // alpha = gain·luma − threshold, clamped by the rasterizer
  const alphaRow = `${k / 3} ${k / 3} ${k / 3} 0 ${-threshold}`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
    `<filter id="n" x="0" y="0" width="100%" height="100%">` +
    `<feTurbulence type="fractalNoise" baseFrequency="${baseFrequency}" numOctaves="${octaves}" seed="${seed}" stitchTiles="stitch"/>` +
    `<feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ${alphaRow}"/>` +
    `</filter>` +
    `<rect width="${size}" height="${size}" filter="url(#n)"/>` +
    `</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

// Strip a clone for ghost duty: no duplicate ids/labels, complex svgs swapped
// for same-size placeholders (keeping only data-ghost-keep subtrees).
function sanitize(root: HTMLElement): HTMLElement {
  root.removeAttribute('id');
  root.classList.add('xerox-clone'); // carries #app's layout rules (see style.css)
  for (const el of Array.from(root.querySelectorAll('[id]'))) el.removeAttribute('id');
  for (const el of Array.from(root.querySelectorAll('[for]'))) el.removeAttribute('for');
  for (const svg of Array.from(root.querySelectorAll('svg'))) {
    const ghost = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    for (const a of ['class', 'width', 'height', 'viewBox', 'style', 'preserveAspectRatio']) {
      const v = svg.getAttribute(a);
      if (v !== null) ghost.setAttribute(a, v);
    }
    for (const keep of Array.from(svg.querySelectorAll('[data-ghost-keep]'))) {
      ghost.appendChild(keep.cloneNode(true));
    }
    svg.replaceWith(ghost);
  }
  return root;
}

// Build the back layer and keep it in sync with the front. Mutations are
// rAF-batched; we only ever write outside `front`, so the observer can't loop.
export function initXerox(front: HTMLElement, noise: NoiseMaskOptions = {}): void {
  const back = document.createElement('div');
  back.className = 'xerox-back';
  back.setAttribute('aria-hidden', 'true');
  back.setAttribute('inert', '');

  const soft = document.createElement('div');
  soft.className = 'xerox-back__copy xerox-back__copy--soft';
  const heavy = document.createElement('div');
  heavy.className = 'xerox-back__copy xerox-back__copy--heavy';
  back.append(soft, heavy);
  front.before(back);

  document.body.style.setProperty('--xerox-noise', noiseMaskSvg(noise));

  const sync = () => {
    const clone = sanitize(front.cloneNode(true) as HTMLElement);
    soft.replaceChildren(clone);
    heavy.replaceChildren(clone.cloneNode(true));
  };

  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      sync();
    });
  };
  new MutationObserver(schedule).observe(front, {
    subtree: true,
    childList: true,
    attributes: true,
    characterData: true,
  });
  sync();
}
