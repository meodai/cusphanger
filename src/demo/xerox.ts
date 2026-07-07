// Xerox layering: the page exists twice. The front (#app) stays sharp; one
// ghost copy (.xerox-back, aria-hidden + inert) sits behind it, run through
// the #xerox-blur SVG filter (defined in index.html) and nudged by the
// --xerox-shift-* misregistration offset. The ghost is a live clone of the
// front, rebuilt (rAF-batched) on every mutation.
//
// What renders where is decided in CSS (demo.css): the rail's frames and
// fills paint only in the ghost, its type and markers only in the front —
// see the .rail layer-split custom properties.
//
// Caveats: opaque backgrounds in the front cover the ghost beneath them, and
// position:fixed inside the filtered ghost would pin to the ghost, not the
// viewport (CSS filter creates a containing block). Sticky is fine.

// Strip a clone for ghost duty: no duplicate ids/labels, svgs swapped for
// same-size placeholders holding only the subtrees marked data-ghost-keep
// (plus their <defs>, under namespaced ids — gradient/pattern ids must never
// shadow the front's paint servers).
const GHOST_ID_SUFFIX = '-xg';
const PAINT_REF_ATTRS = ['fill', 'stroke', 'clip-path', 'mask', 'filter'];

function sanitize(root: HTMLElement): HTMLElement {
  root.removeAttribute('id');
  root.classList.add('xerox-clone'); // carries #app's layout rules (demo.css)
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
  // after the svg swap, so the ghost svgs' namespaced ids survive
  for (const el of Array.from(root.querySelectorAll('[id]'))) {
    if (!el.closest('svg')) el.removeAttribute('id');
  }
  for (const el of Array.from(root.querySelectorAll('[for]'))) el.removeAttribute('for');
  return root;
}

// Build the ghost layer and keep it in sync with the front. Mutations are
// rAF-batched; we only ever write outside `front`, so the observer can't loop.
export function initXerox(front: HTMLElement): void {
  const back = document.createElement('div');
  back.className = 'xerox-back';
  back.setAttribute('aria-hidden', 'true');
  back.setAttribute('inert', '');
  front.before(back);

  // Scroll isn't a mutation: when a front element scrolls internally (the
  // rail overflows on control-heavy tabs), push its offsets into the inert
  // ghost — matched by child-index path, re-applied after every rebuild.
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

  // The misregistration drifts AGAINST the pointer, ±MOUSE_SHIFT px at the
  // viewport edges, on top of the base --xerox-shift-* (composed in demo.css)
  // — the print never quite sits still under the reader's hand. Transform-
  // only, so the filter never re-renders. Skipped for reduced-motion users.
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
