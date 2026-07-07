// TEMP — live controls for the #xerox-blur SVG filter (index.html) plus the
// ghost misregistration shift/opacity. Built into the front rail, marked
// data-ghost="none" so its ghost copy is blanked (but keeps its space, so the
// layers stay aligned). Dial the look, click the readout to copy the values,
// then paste them back into index.html + tokens.css to make them the default.

interface Field {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  get: () => number;
  set: (v: number) => void;
  fmt?: (v: number) => string; // readout formatting
}

const el = <T extends Element>(sel: string): T => {
  const node = document.querySelector<Element>(sel);
  if (!node) throw new Error(`fx-panel: missing ${sel}`);
  return node as T;
};

// These don't map to single attributes, so keep them here and rebuild the
// relevant feColorMatrix on change. gain/threshold compose the noise→alpha row
// (shared by the ghost patches and the front mask); softFade/heavyFade are
// the per-blur opacities that make the two blurs blend instead of stack opaque.
let gain = 1.8;
let threshold = 0.63;
let softFade = 0.95;
let heavyFade = 0.8;
// front-mask cutoff: how sparse the dissolve holes are. The mask shares the
// noise FIELD with the ghost patches but needs its own (higher) cutoff — the
// ghost wants a mid-range haze, the mask wants mostly-opaque + sparse holes.
let dissolve = 0.3; // 0 = no holes (all sharp), 1 = lots of holes

// noise → alpha row for feColorMatrix: alpha = gain·luma − threshold
const alphaRow = (g: number, t: number) => {
  const k = (g / 3).toFixed(3);
  return `0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ${k} ${k} ${k} 0 ${(-t).toFixed(3)}`;
};
// identity RGB, alpha scaled by `a` — fades a blur layer without tinting it
const fadeMatrix = (a: number) => `1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${a} 0`;

function buildFields(): Field[] {
  const soft = el<SVGElement>('#fx-soft');
  const heavy = el<SVGElement>('#fx-heavy');
  const softFadeEl = el<SVGElement>('#fx-soft-fade');
  const heavyFadeEl = el<SVGElement>('#fx-heavy-fade');
  // the ghost's noise FIELD and the front mask's noise field are identical
  // (same turbulence); their alpha mappings differ, so the matrices are separate.
  const turbs = [el<SVGElement>('#fx-turb'), el<SVGElement>('#fx-mask-turb')];
  const matrix = el<SVGElement>('#fx-matrix'); // ghost patches (haze)
  const maskMatrix = el<SVGElement>('#fx-mask-matrix'); // front mask (sparse holes)
  const turb = turbs[0]!; // read defaults from the primary
  const rootStyle = document.documentElement.style;

  const num = (node: SVGElement, attr: string) => parseFloat(node.getAttribute(attr) ?? '0');
  const setAttr = (node: SVGElement, attr: string) => (v: number) =>
    node.setAttribute(attr, String(v));
  const setAll = (nodes: SVGElement[], attr: string) => (v: number) =>
    nodes.forEach((n) => n.setAttribute(attr, String(v)));

  const applyMatrix = () => matrix.setAttribute('values', alphaRow(gain, threshold));
  // mask cutoff rises as dissolve falls, so fewer holes = more of the sharp front
  const applyMaskMatrix = () => maskMatrix.setAttribute('values', alphaRow(gain, 1 - dissolve));
  const applySoftFade = () => softFadeEl.setAttribute('values', fadeMatrix(softFade));
  const applyHeavyFade = () => heavyFadeEl.setAttribute('values', fadeMatrix(heavyFade));

  const cssVar = (name: string, fallback: number) => ({
    get: () =>
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || fallback,
    set: (v: number) => rootStyle.setProperty(name, `${v}px`),
  });
  const sx = cssVar('--xerox-shift-x', -1);
  const sy = cssVar('--xerox-shift-y', -2);
  const opacity = {
    get: () =>
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--xerox-opacity')) ||
      1,
    set: (v: number) => rootStyle.setProperty('--xerox-opacity', String(v)),
  };

  return [
    { key: 'soft blur', label: 'soft blur', min: 0, max: 5, step: 0.1,
      get: () => num(soft, 'stdDeviation'), set: setAttr(soft, 'stdDeviation') },
    { key: 'heavy blur', label: 'heavy blur', min: 0, max: 30, step: 0.5,
      get: () => num(heavy, 'stdDeviation'), set: setAttr(heavy, 'stdDeviation') },
    { key: 'soft fade', label: 'soft fade', min: 0, max: 1, step: 0.05,
      get: () => softFade, set: (v) => { softFade = v; applySoftFade(); }, fmt: (v) => v.toFixed(2) },
    { key: 'heavy fade', label: 'heavy fade', min: 0, max: 1, step: 0.05,
      get: () => heavyFade, set: (v) => { heavyFade = v; applyHeavyFade(); }, fmt: (v) => v.toFixed(2) },
    { key: 'noise scale', label: 'noise scale', min: 0.001, max: 0.04, step: 0.0005,
      get: () => num(turb, 'baseFrequency'), set: setAll(turbs, 'baseFrequency'),
      fmt: (v) => v.toFixed(4) },
    { key: 'octaves', label: 'octaves', min: 1, max: 6, step: 1,
      get: () => num(turb, 'numOctaves'), set: setAll(turbs, 'numOctaves') },
    { key: 'seed', label: 'seed', min: 1, max: 99, step: 1,
      get: () => num(turb, 'seed'), set: setAll(turbs, 'seed') },
    { key: 'patch gain', label: 'patch gain', min: 0.1, max: 3, step: 0.05,
      get: () => gain, set: (v) => { gain = v; applyMatrix(); applyMaskMatrix(); } },
    { key: 'patch cutoff', label: 'patch cutoff', min: 0, max: 1, step: 0.01,
      get: () => threshold, set: (v) => { threshold = v; applyMatrix(); } },
    { key: 'dissolve', label: 'dissolve', min: 0, max: 1, step: 0.02,
      get: () => dissolve, set: (v) => { dissolve = v; applyMaskMatrix(); }, fmt: (v) => v.toFixed(2) },
    { key: 'opacity', label: 'opacity', min: 0, max: 1, step: 0.05, ...opacity,
      fmt: (v) => v.toFixed(2) },
    { key: 'shift x', label: 'shift x', min: -30, max: 30, step: 0.5, ...sx },
    { key: 'shift y', label: 'shift y', min: -30, max: 30, step: 0.5, ...sy },
  ];
}

function readout(fields: Field[]): string {
  const v = (k: string) => {
    const f = fields.find((x) => x.key === k)!;
    return f.fmt ? f.fmt(f.get()) : String(f.get());
  };
  return (
    `soft ${v('soft blur')} @${v('soft fade')}  heavy ${v('heavy blur')} @${v('heavy fade')}\n` +
    `baseFrequency ${v('noise scale')}  octaves ${v('octaves')}  seed ${v('seed')}\n` +
    `gain ${v('patch gain')}  threshold ${v('patch cutoff')}  dissolve ${v('dissolve')}\n` +
    `shift ${v('shift x')} ${v('shift y')}  opacity ${v('opacity')}`
  );
}

export function initFxPanel(): void {
  const host = document.querySelector('#app .rail');
  if (!host) return;

  const fields = buildFields();

  const panel = document.createElement('div');
  panel.className = 'fx-panel';
  panel.dataset.ghost = 'none';
  const heading = document.createElement('h2');
  heading.className = 'fx-panel__title';
  heading.textContent = 'xerox';
  panel.appendChild(heading);

  const out = document.createElement('pre');
  out.className = 'fx-panel__out';
  out.title = 'click to copy';
  out.addEventListener('click', () => void navigator.clipboard.writeText(out.textContent ?? ''));

  const refresh = () => (out.textContent = readout(fields));

  for (const f of fields) {
    const row = document.createElement('label');
    row.className = 'fx-row';

    const name = document.createElement('span');
    name.className = 'fx-row__label';
    name.textContent = f.label;

    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(f.min);
    input.max = String(f.max);
    input.step = String(f.step);
    input.value = String(f.get());

    const val = document.createElement('output');
    val.className = 'fx-row__val';
    val.textContent = f.fmt ? f.fmt(f.get()) : input.value;

    input.addEventListener('input', () => {
      const v = Number(input.value);
      f.set(v);
      val.textContent = f.fmt ? f.fmt(v) : input.value;
      refresh();
    });

    row.append(name, input, val);
    panel.appendChild(row);
  }

  panel.appendChild(out);
  host.appendChild(panel);
  refresh();
}
