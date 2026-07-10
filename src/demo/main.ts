import { sequential, ramp, diverging, fromColor, type OklchColor, type TriangleMode } from '../lib/index';
import { bcFromLRange } from '../lib/wijffelaars';
import { oklchSrgb, oklchP3, toCss, type Lut } from 'nutelch';
import { converter, type Oklch } from 'culori';
import { buildControls, type FieldSpec, type ChoiceSpec, type ControlsApi } from './controls';
import { initCurveControl } from './curve-control';
import { applyTheme } from './theme';
import { renderHanger } from './hanger';
import { renderSlice } from './slice';
import { renderWheel, type WheelAxis } from './wheel';
import { initExport } from './export';
import { initCompositions } from './compositions';

type TabId = 'sequential' | 'diverging' | 'ramp';

interface Tab {
  id: TabId;
  label: string;
  fields: FieldSpec[];
  choices?: ChoiceSpec[];
  forceMirror?: boolean;
  build: (v: Record<string, number>, c: Record<string, string>, lut: Lut) => OklchColor[];

  usage: (v: Record<string, number>, c: Record<string, string>, lutName: string) => string;
}

const TABS: Tab[] = [
  {
    id: 'sequential',
    label: 'seq',
    fields: [
      { key: 'hStart', label: 'hue h', min: 0, max: 360, step: 1, value: 260 },
      { key: 'total', label: 'colors N', min: 2, max: 15, step: 1, value: 9 },
      { key: 's', label: 'saturation s', min: 0, max: 1, step: 0.01, value: 0.6 },
      { key: 'b', label: 'brightness b', min: 0, max: 1, step: 0.01, value: 0.75 },
      { key: 'c', label: 'contrast c', min: 0, max: 1, step: 0.01, value: 0.88 },
      { key: 'w', label: 'cool/warm w', min: 0, max: 1, step: 0.01, value: 0 },
    ],
    build: (v, _c, lut) =>
      sequential({
        hStart: v.hStart!, total: v.total!, saturation: v.s!,
        brightness: v.b!, contrast: v.c!, coolWarm: v.w!, lut,
      }),
    usage: (v, _c, lutName) => `import {
  sequential
} from 'cusphanger';
import {
  ${lutName}
} from 'nutelch';

const palette = sequential({
  hStart: ${v.hStart},
  total: ${v.total},
  saturation: ${v.s},
  brightness: ${v.b},
  contrast: ${v.c},
  coolWarm: ${v.w},
  lut: ${lutName},
});`,
  },
  {
    id: 'diverging',
    label: 'div',
    forceMirror: true,
    fields: [
      { key: 'hStart', label: 'hue start', min: 0, max: 360, step: 1, value: 250 },
      { key: 'hEnd', label: 'hue end', min: 0, max: 360, step: 1, value: 30 },
      { key: 'total', label: 'colors N', min: 3, max: 15, step: 1, value: 9 },
      { key: 's', label: 'saturation s', min: 0, max: 1, step: 0.01, value: 0.6 },
      { key: 'b', label: 'brightness b', min: 0, max: 1, step: 0.01, value: 0.75 },
      { key: 'c', label: 'contrast c', min: 0, max: 1, step: 0.01, value: 0.88 },
      { key: 'w', label: 'cool/warm w', min: 0, max: 1, step: 0.01, value: 0 },
    ],
    build: (v, _c, lut) =>
      diverging({
        hStart: v.hStart!, hEnd: v.hEnd!, total: v.total!,
        saturation: v.s!, brightness: v.b!, contrast: v.c!, coolWarm: v.w!, lut,
      }),
    usage: (v, _c, lutName) => `import {
  diverging
} from 'cusphanger';
import {
  ${lutName}
} from 'nutelch';

const palette = diverging({
  hStart: ${v.hStart},
  hEnd: ${v.hEnd},
  total: ${v.total},
  saturation: ${v.s},
  brightness: ${v.b},
  contrast: ${v.c},
  coolWarm: ${v.w},
  lut: ${lutName},
});`,
  },
  {
    id: 'ramp',
    label: 'ramp',
    fields: [
      { key: 'hStart', label: 'hue h', min: 0, max: 360, step: 1, value: 260 },
      { key: 'total', label: 'colors N', min: 2, max: 24, step: 1, value: 9 },
      { key: 'hCycles', label: 'hue cycles', min: -2, max: 2, step: 0.05, value: 0.3 },
      { key: 'hStartCenter', label: 'hue center', min: 0, max: 1, step: 0.01, value: 0.5 },
      { key: 'sMin', label: 'sat min', min: 0, max: 1, step: 0.01, value: 0.5 },
      { key: 'sMax', label: 'sat max', min: 0, max: 1, step: 0.01, value: 0.9 },
      { key: 'minLight', label: 'light min', min: 0, max: 0.6, step: 0.01, value: 0.2 },
      { key: 'maxLight', label: 'light max', min: 0.5, max: 1, step: 0.01, value: 0.97 },
      { key: 'w', label: 'cool/warm w', min: 0, max: 1, step: 0.01, value: 0 },
    ],
    choices: [
      { key: 'triangleMode', label: 'triangle', options: ['perHue', 'min', 'avg', 'max'], value: 'perHue' },
    ],
    build: (v, c, lut) =>
      ramp({
        hStart: v.hStart!, total: v.total!,
        sRange: [v.sMin!, v.sMax!], lRange: [v.minLight!, v.maxLight!], coolWarm: v.w!,
        hCycles: v.hCycles!, hStartCenter: v.hStartCenter!,
        triangleMode: c.triangleMode as TriangleMode,
        lut,
      }),
    usage: (v, c, lutName) => `import {
  ramp
} from 'cusphanger';
import {
  ${lutName}
} from 'nutelch';

const palette = ramp({
  hStart: ${v.hStart},
  total: ${v.total},
  hCycles: ${v.hCycles},
  hStartCenter: ${v.hStartCenter},
  sRange: [${v.sMin}, ${v.sMax}],
  lRange: [${v.minLight}, ${v.maxLight}],
  coolWarm: ${v.w},
  triangleMode: '${c.triangleMode}',
  lut: ${lutName},
});`,
  },
];

const $ = (sel: string) => document.querySelector(sel) as HTMLElement;

const hangerHost = $('.hanger');
const stripHost = $('.topbar__strip');
const sliceMiniHost = $('#slice-mini');
const wheelHosts: Record<WheelAxis, HTMLElement> = {
  chroma: $('#wheel'),
  lightness: $('#wheel-lightness'),
};
const tabsNav = $('.tabs');
const controlsHost = $('.controls');
const updateExport = initExport($('.export'));

let activeTab: Tab = TABS[0]!;
let lut: Lut = oklchSrgb;
let controlsApi: ControlsApi = { set: () => {} };
const curveFigure = $('.params__curve');
const renderCurveControl = initCurveControl($('.curve-pane'), (patch) =>
  controlsApi.set(patch),
);
const wheelFlip: Record<WheelAxis, boolean> = { chroma: false, lightness: false };
let lastValues: Record<string, number> = {};
let lastChoices: Record<string, string> = {};
let palette: OklchColor[] = [];
// fromColor: the sample the solve landed the target on (marked in the
// curve pane); any hand-driven parameter change voids the guarantee and clears it
let match: number | null = null;
let applyingMatch = false;

const updateCompositions = initCompositions($('.compositions'), {
  regen: $('.compo-regen'),
  hueToggle: document.querySelector('.compo-hue input') as HTMLInputElement,
  variantColors: (rng) => {
    const v = { ...lastValues, hStart: rng() * 360 };
    return activeTab.build(v, lastChoices, lut).map(toCss);
  },
});

function renderAll(): void {
  palette = activeTab.build(lastValues, lastChoices, lut);
  applyTheme(document.documentElement, palette);
  renderHanger(hangerHost, palette);
  stripHost.innerHTML = palette
    .map((c, i) => `<span style="--swatch: var(--pal-${i}, ${toCss(c)})"></span>`)
    .join('');
  renderSlice(sliceMiniHost, palette, lut, activeTab.forceMirror ?? false);
  curveFigure.hidden = activeTab.id === 'ramp';
  renderCurveControl(
    activeTab.id === 'ramp'
      ? null
      : {
          hues:
            activeTab.id === 'diverging'
              ? [lastValues.hStart!, lastValues.hEnd!]
              : [lastValues.hStart!],
          palette,
          s: lastValues.s!,
          b: lastValues.b!,
          c: lastValues.c!,
          w: lastValues.w!,
          lut,
          matchIndex: activeTab.id === 'sequential' ? match : null,
        },
  );
  for (const axis of ['chroma', 'lightness'] as const) {
    renderWheel(wheelHosts[axis], palette, lut, axis, wheelFlip[axis]);
  }
  updateCompositions(palette.length);
  updateExport(palette, activeTab.usage(lastValues, lastChoices, lut === oklchP3 ? 'oklchP3' : 'oklchSrgb'));
}

const tabButtons: HTMLButtonElement[] = [];
const selectTab = (tab: Tab) => {
  activeTab = tab;
  tabButtons.forEach((b, i) => b.setAttribute('aria-selected', String(TABS[i]!.id === tab.id)));
  controlsApi = buildControls(controlsHost, tab.fields, tab.choices ?? [], ({ values, choices }) => {
    lastValues = values;
    lastChoices = choices;
    if (!applyingMatch) match = null; // hand-tuned params: the meet is off
    renderAll();
  });
};
for (const tab of TABS) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'tabs__tab';
  b.textContent = tab.label;
  b.setAttribute('role', 'tab');
  b.addEventListener('click', () => selectTab(tab));
  tabButtons.push(b);
  tabsNav.appendChild(b);
}

// fromColor: parse anything CSS calls a color, re-solve the sequential model
// through it (the solve lives on the paper's surface, so it lands on the seq
// tab), and remember which sample carries it for the curve pane's marker.
const parseAsOklch = converter('oklch') as unknown as (raw: string) => Oklch | undefined;
const fromWrap = $('.control--from');
const fromInput = fromWrap.querySelector('input') as HTMLInputElement;

const solveFrom = (): boolean => {
  const raw = fromInput.value.trim();
  fromWrap.removeAttribute('data-invalid');
  fromWrap.removeAttribute('data-clamped');
  match = null;
  if (!raw) return false;
  const parsed = parseAsOklch(raw);
  if (!parsed || !Number.isFinite(parsed.l)) {
    fromWrap.setAttribute('data-invalid', '');
    return false;
  }
  if (activeTab.id !== 'sequential') selectTab(TABS[0]!);
  const res = fromColor(
    { mode: 'oklch', l: parsed.l, c: parsed.c ?? 0, h: parsed.h ?? 0 },
    { total: lastValues.total ?? 9, lut },
  );
  if (res.clamped) fromWrap.setAttribute('data-clamped', '');
  const { b, c } = bcFromLRange(res.options.lRange!);
  match = res.index;
  applyingMatch = true;
  // rounded for the readouts; the residual miss is ~1e-4 — far below visible
  const r4 = (v: number) => Math.round(v * 1e4) / 1e4;
  controlsApi.set({
    hStart: Math.round(res.options.hStart * 100) / 100,
    s: r4(res.options.saturation!),
    b: r4(b),
    c: r4(c),
    w: 0,
  });
  applyingMatch = false;
  return true;
};

fromInput.addEventListener('change', () => {
  if (!solveFrom()) renderAll(); // solve renders via the controls; a miss still clears the mark
});
fromInput.addEventListener('input', () => fromWrap.removeAttribute('data-invalid'));

const vizGamut = $('.control--gamut') as HTMLButtonElement;
const vizGamutValue = vizGamut.querySelector('.control__value') as HTMLElement;
let p3 = false;
vizGamut.addEventListener('click', () => {
  p3 = !p3;
  lut = p3 ? oklchP3 : oklchSrgb;
  vizGamutValue.textContent = p3 ? 'P3' : 'sRGB';
  vizGamut.toggleAttribute('data-active', p3);
  // an active fromColor meet is per-gamut — re-solve it against the new LUT
  if (match === null || !solveFrom()) renderAll();
});

for (const btn of document.querySelectorAll<HTMLButtonElement>('.viz-flip')) {
  const axis = btn.dataset.axis as WheelAxis;
  btn.addEventListener('click', () => {
    wheelFlip[axis] = !wheelFlip[axis];
    btn.toggleAttribute('data-flipped', wheelFlip[axis]);
    renderWheel(wheelHosts[axis], palette, lut, axis, wheelFlip[axis]);
  });
}

selectTab(TABS.find((t) => t.id === 'diverging') ?? TABS[0]!);
