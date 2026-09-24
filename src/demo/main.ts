import {
  sequential, ramp, diverging, fromColor, cubicBezier, spaceOf,
  type PaletteColor, type TriangleMode,
} from '../lib/index';
import { bcFromLRange } from '../lib/wijffelaars';
import type { Lut } from 'nutelch';
import { toCss, rgbToHct } from 'nutelch/hct'; // toCss formats every mode, hct included
import { converter } from 'culori';
import { lutFor, lutName, lutModule, MODELS, MODEL_LABEL, PAPER_MODEL, type Model } from './space';
import { buildControls, type FieldSpec, type ChoiceSpec, type ControlsApi } from './controls';
import { initCurveControl } from './curve-control';
import { initLEasingEditor, type BezierHandles } from './l-easing-editor';
import { applyTheme } from './theme';
import { renderHanger, renderHangerGray } from './hanger';
import { renderSlice } from './slice';
import { renderWheel, type WheelAxis } from './wheel';
import { initExport } from './export';
import { initCompositions } from './compositions';

type TabId = 'sequential' | 'diverging' | 'ramp';

let lHandles: BezierHandles = [0, 0, 1, 1];
const lEasingIsLinear = () => lHandles.every((v, i) => v === [0, 0, 1, 1][i]);
const lEasingOpt = () => (lEasingIsLinear() ? {} : { lEasing: cubicBezier(...lHandles) });
const usageImport = (fn: string) => `${fn}${lEasingIsLinear() ? '' : ',\n  cubicBezier'}`;
const usageLEasing = () =>
  lEasingIsLinear() ? '' : `\n  lEasing: cubicBezier(${lHandles.join(', ')}),`;

// what the usage snippet needs about the active LUT: its export name, the module
// it comes from, and its lightness scale (for options in lightness units, lRange)
interface LutRef {
  name: string;
  module: string;
  lMax: number;
}

interface Tab {
  id: TabId;
  label: string;
  fields: FieldSpec[];
  choices?: ChoiceSpec[];
  forceMirror?: boolean;
  build: (v: Record<string, number>, c: Record<string, string>, lut: Lut) => PaletteColor[];

  usage: (v: Record<string, number>, c: Record<string, string>, lut: LutRef) => string;
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
        brightness: v.b!, contrast: v.c!, coolWarm: v.w!, ...lEasingOpt(), lut,
      }),
    usage: (v, _c, lut) => `import {
  ${usageImport('sequential')}
} from 'cusphanger';
import {
  ${lut.name}
} from '${lut.module}';

const palette = sequential({
  hStart: ${v.hStart},
  total: ${v.total},
  saturation: ${v.s},
  brightness: ${v.b},
  contrast: ${v.c},
  coolWarm: ${v.w},${usageLEasing()}
  lut: ${lut.name},
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
        saturation: v.s!, brightness: v.b!, contrast: v.c!, coolWarm: v.w!, ...lEasingOpt(), lut,
      }),
    usage: (v, _c, lut) => `import {
  ${usageImport('diverging')}
} from 'cusphanger';
import {
  ${lut.name}
} from '${lut.module}';

const palette = diverging({
  hStart: ${v.hStart},
  hEnd: ${v.hEnd},
  total: ${v.total},
  saturation: ${v.s},
  brightness: ${v.b},
  contrast: ${v.c},
  coolWarm: ${v.w},${usageLEasing()}
  lut: ${lut.name},
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
    // the light min/max sliders are 0..1 of the way to white; lRange is in the
    // LUT's lightness units (0..1 for OKLCH, 0..100 for LCHuv)
    build: (v, c, lut) =>
      ramp({
        hStart: v.hStart!, total: v.total!,
        sRange: [v.sMin!, v.sMax!], lRange: [v.minLight! * lut.lMax, v.maxLight! * lut.lMax], coolWarm: v.w!,
        hCycles: v.hCycles!, hStartCenter: v.hStartCenter!,
        triangleMode: c.triangleMode as TriangleMode,
        ...lEasingOpt(),
        lut,
      }),
    usage: (v, c, lut) => `import {
  ${usageImport('ramp')}
} from 'cusphanger';
import {
  ${lut.name}
} from '${lut.module}';

const palette = ramp({
  hStart: ${v.hStart},
  total: ${v.total},
  hCycles: ${v.hCycles},
  hStartCenter: ${v.hStartCenter},
  sRange: [${v.sMin}, ${v.sMax}],
  lRange: [${+(v.minLight! * lut.lMax).toFixed(4)}, ${+(v.maxLight! * lut.lMax).toFixed(4)}],
  coolWarm: ${v.w},
  triangleMode: '${c.triangleMode}',${usageLEasing()}
  lut: ${lut.name},
});`,
  },
];

const $ = (sel: string) => document.querySelector(sel) as HTMLElement;

const hangerHost = $('.hanger');
const hangerGrayHost = $('.hanger-gray');
const stripHost = $('.topbar__strip');
const sliceMiniHost = $('#slice-mini');
const wheelHosts: Record<WheelAxis, HTMLElement> = {
  chroma: $('#wheel'),
  lightness: $('#wheel-lightness'),
};
const tabsNav = $('.tabs');
const controlsHost = $('.controls');
const updateExport = initExport($('.export'), $('.export-tools'));

let activeTab: Tab = TABS[0]!;
let model: Model = 'oklch';
let p3 = false;
let lut: Lut = lutFor(model, 'srgb');
let controlsApi: ControlsApi = { set: () => {} };
const renderCurveControl = initCurveControl($('.curve-pane'), (patch) =>
  controlsApi.set(patch),
);
const renderLEasing = initLEasingEditor($('.l-easing-pane'), (h) => {
  lHandles = h;
  if (match === null || !solveFrom()) renderAll();
});
type FigureView = 'path' | 'spread';
let figureView: FigureView = 'path';
const viewButtons = [...document.querySelectorAll<HTMLButtonElement>('.curve-view__btn')];
const viewReset = $('.curve-view__reset') as HTMLButtonElement;
for (const b of viewButtons) {
  b.addEventListener('click', () => {
    figureView = b.dataset.view as FigureView;
    renderAll();
  });
}
viewReset.addEventListener('click', () => {
  lHandles = [0, 0, 1, 1];
  if (match === null || !solveFrom()) renderAll();
});
const wheelFlip: Record<WheelAxis, boolean> = { chroma: false, lightness: false };
let lastValues: Record<string, number> = {};
let lastChoices: Record<string, string> = {};
let palette: PaletteColor[] = [];
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
  renderHangerGray(hangerGrayHost, palette);
  stripHost.innerHTML = palette
    .map((c, i) => `<span style="--swatch: var(--pal-${i}, ${toCss(c)})"></span>`)
    .join('');
  renderSlice(sliceMiniHost, palette, lut, activeTab.forceMirror ?? false);
  const hasPath = activeTab.id !== 'ramp';
  const view: FigureView = hasPath ? figureView : 'spread';
  for (const b of viewButtons) {
    b.setAttribute('aria-pressed', String(b.dataset.view === view));
    b.hidden = !hasPath;
    if (b.dataset.view === 'spread') b.toggleAttribute('data-modified', !lEasingIsLinear());
  }
  viewReset.hidden = view !== 'spread' || lEasingIsLinear();
  renderLEasing(
    view === 'spread' ? { handles: lHandles, palette, mirror: activeTab.id === 'diverging' } : null,
  );
  renderCurveControl(
    view === 'spread'
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
  updateExport(
    palette,
    activeTab.usage(lastValues, lastChoices, {
      name: lutName(model, p3 ? 'p3' : 'srgb'),
      module: lutModule(model),
      lMax: lut.lMax,
    }),
  );
}

const tabButtons: HTMLButtonElement[] = [];
const selectTab = (tab: Tab) => {
  activeTab = tab;
  tabButtons.forEach((b, i) => b.setAttribute('aria-selected', String(TABS[i]!.id === tab.id)));
  controlsApi = buildControls(controlsHost, tab.fields, tab.choices ?? [], ({ values, choices }) => {
    lastValues = values;
    lastChoices = choices;
    if (!applyingMatch) match = null;
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

// parse any CSS color into the active model's space (fromColor meets it there).
// culori has no HCT: parse to (unclamped) sRGB and convert with nutelch's rgbToHct,
// which also takes the out-of-range channels of wider-gamut colors.
const toRgb = converter('rgb') as unknown as (raw: string) => { r: number; g: number; b: number } | undefined;
const parseIn = (raw: string, mode: Model): { l: number; c?: number; h?: number } | undefined => {
  if (mode !== 'hct') {
    return converter(mode)(raw) as unknown as { l: number; c?: number; h?: number } | undefined;
  }
  const rgb = toRgb(raw);
  return rgb ? rgbToHct(rgb) : undefined;
};
const fromWrap = $('.control--from');
const fromInput = fromWrap.querySelector('input') as HTMLInputElement;

const solveFrom = (): boolean => {
  const raw = fromInput.value.trim();
  fromWrap.removeAttribute('data-invalid');
  fromWrap.removeAttribute('data-clamped');
  match = null;
  if (!raw) return false;
  const parsed = parseIn(raw, model);
  if (!parsed || !Number.isFinite(parsed.l)) {
    fromWrap.setAttribute('data-invalid', '');
    return false;
  }
  if (activeTab.id !== 'sequential') selectTab(TABS[0]!);
  const res = fromColor(
    { mode: model, l: parsed.l, c: parsed.c ?? 0, h: parsed.h ?? 0 },
    { total: lastValues.total ?? 9, ...lEasingOpt(), lut },
  );
  if (res.clamped) fromWrap.setAttribute('data-clamped', '');
  const { b, c } = bcFromLRange(res.options.lRange!, spaceOf(lut));
  match = res.index;
  applyingMatch = true;
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
  if (!solveFrom()) renderAll();
});
fromInput.addEventListener('input', () => fromWrap.removeAttribute('data-invalid'));

// model × gamut in one picker: a native <select> laid invisibly over its label
// (see .control--space); on change the label shows e.g. "okLch | P3".
const spacePicker = $('.control--space');
const spaceSelect = spacePicker.querySelector('select') as HTMLSelectElement;
const spaceValue = spacePicker.querySelector('.control__value') as HTMLElement;
const spaceLabel = (m: Model, isP3: boolean) => `${MODEL_LABEL[m]} | ${isP3 ? 'P3' : 'sRGB'}`;
// the open list marks the paper's own space (CIELUV); the closed label stays short
const optionLabel = (m: Model, isP3: boolean) =>
  `${MODEL_LABEL[m]}${m === PAPER_MODEL ? ' (paper)' : ''} | ${isP3 ? 'P3' : 'sRGB'}`;
spaceSelect.innerHTML = MODELS.flatMap((m) =>
  [false, true].map((g) => `<option value="${m}:${g ? 'p3' : 'srgb'}">${optionLabel(m, g)}</option>`),
).join('');
spaceSelect.addEventListener('change', () => {
  const [m, g] = spaceSelect.value.split(':') as [Model, 'srgb' | 'p3'];
  model = m;
  p3 = g === 'p3';
  lut = lutFor(model, g);
  spaceValue.textContent = spaceLabel(model, p3);
  if (match === null || !solveFrom()) renderAll();
});

const flipBtn = document.querySelector<HTMLButtonElement>('.viz-flip');
flipBtn?.addEventListener('click', () => {
  const flipped = !wheelFlip.chroma;
  wheelFlip.chroma = flipped;
  wheelFlip.lightness = flipped;
  flipBtn.toggleAttribute('data-flipped', flipped);
  for (const axis of ['chroma', 'lightness'] as const) {
    renderWheel(wheelHosts[axis], palette, lut, axis, wheelFlip[axis]);
  }
});

selectTab(TABS.find((t) => t.id === 'diverging') ?? TABS[0]!);
