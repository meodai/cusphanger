const GHOST_ID_SUFFIX = '-xg';
const PAINT_REF_ATTRS = ['fill', 'stroke', 'clip-path', 'mask', 'filter'];

function sanitize(root: HTMLElement): HTMLElement {
  root.removeAttribute('id');
  root.classList.add('xerox-clone');
  for (const svg of Array.from(root.querySelectorAll('svg'))) {
    const ghost = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    for (const a of ['class', 'width', 'height', 'viewBox', 'style', 'preserveAspectRatio']) {
      const v = svg.getAttribute(a);
      if (v !== null) ghost.setAttribute(a, v);
    }
    const keeps = Array.from(svg.querySelectorAll('[data-ghost-keep]'));
    if (keeps.length) {
      for (const defs of Array.from(svg.querySelectorAll('defs'))) {
        ghost.appendChild(defs.cloneNode(true));
      }
      for (const keep of keeps) ghost.appendChild(keep.cloneNode(true));
      for (const el of Array.from(ghost.querySelectorAll('[id]'))) el.id += GHOST_ID_SUFFIX;
      for (const el of Array.from(ghost.querySelectorAll('*'))) {
        for (const attr of PAINT_REF_ATTRS) {
          const v = el.getAttribute(attr);
          if (v && v.includes('url(#')) {
            el.setAttribute(attr, v.replace(/url\(["']?#([^)"']+)["']?\)/g, `url(#$1${GHOST_ID_SUFFIX})`));
          }
        }
      }
    }
    svg.replaceWith(ghost);
  }

  for (const el of Array.from(root.querySelectorAll('[id]'))) {
    if (!el.closest('svg')) el.removeAttribute('id');
  }
  for (const el of Array.from(root.querySelectorAll('[for]'))) el.removeAttribute('for');
  return root;
}

// WebKit rasterizes url(#…) filters on HTML content in software, per-primitive,
// at device resolution — the page-sized ghost + turbulence mask can eat >1GB and
// near-hang Safari. Vendor is 'Apple Computer, Inc.' on every WebKit engine
// (Safari and all iOS browsers), unlike UA strings, which they spoof.
export const isWebKitEngine = (vendor: string): boolean => vendor === 'Apple Computer, Inc.';

export function initXerox(front: HTMLElement): void {
  // The ghost layer stays (the rail's fills/frames live on it) — .no-xerox
  // only strips the filter + mask, leaving a sharp clean print.
  if (isWebKitEngine(navigator.vendor)) document.documentElement.classList.add('no-xerox');
  const back = document.createElement('div');
  back.className = 'xerox-back';
  back.setAttribute('aria-hidden', 'true');
  back.setAttribute('inert', '');
  front.before(back);

  const scrolledEls = new Set<Element>();
  const mirror = (el: Element): Element | null => {
    const path: number[] = [];
    for (let n: Element | null = el; n !== front; ) {
      const p: Element | null = n.parentElement;
      if (!p) return null;
      path.push(Array.prototype.indexOf.call(p.children, n));
      n = p;
    }
    let m: Element | null = back.firstElementChild;
    for (let i = path.length - 1; i >= 0 && m; i--) m = m.children[path[i]!] ?? null;
    return m;
  };
  const applyScroll = (el: Element) => {
    const m = mirror(el);
    if (m) {
      m.scrollTop = el.scrollTop;
      m.scrollLeft = el.scrollLeft;
    }
  };
  front.addEventListener(
    'scroll',
    (e) => {
      if (e.target instanceof Element) {
        scrolledEls.add(e.target);
        applyScroll(e.target);
      }
    },
    { capture: true, passive: true },
  );

  const sync = () => {
    back.replaceChildren(sanitize(front.cloneNode(true) as HTMLElement));
    for (const el of scrolledEls) applyScroll(el);
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

  const MOUSE_SHIFT = 2;
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const rootStyle = document.documentElement.style;
    window.addEventListener(
      'pointermove',
      (e) => {
        const nx = (e.clientX / window.innerWidth) * 2 - 1;
        const ny = (e.clientY / window.innerHeight) * 2 - 1;
        rootStyle.setProperty('--xerox-mouse-x', `${(-nx * MOUSE_SHIFT).toFixed(3)}px`);
        rootStyle.setProperty('--xerox-mouse-y', `${(-ny * MOUSE_SHIFT).toFixed(3)}px`);
      },
      { passive: true },
    );
  }
}
