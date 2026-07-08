import { sequential, ramp, diverging, type OklchColor, type TriangleMode } from '../lib/index';
import { oklchSrgb, oklchP3, toCss, type Lut } from 'nutelch';
import { buildControls, type FieldSpec, type ChoiceSpec } from './controls';
import { applyTheme } from './theme';
import { renderHanger } from './hanger';
import { renderSlice } from './slice';
import { renderWheel, type WheelAxis } from './wheel';
import { initExport } from './export';
import { initCompositions } from './compositions';
import { initXerox } from './xerox';
import { initFxPanel } from './fx-panel';

const HUE_EASINGS: Record<string, (t: number) => number> = {
  linear: (t) => t,
  'ease-in': (t) => t * t,
  'ease-out': (t) => 1 - (1 - t) * (1 - t),
  sine: (t) => 0.5 - 0.5 * Math.cos(Math.PI * t),
};

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
    usage: (v, _c, lutName) => `import { sequential } from 'cusphanger';
import { ${lutName} } from 'nutelch';

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
    usage: (v, _c, lutName) => `import { diverging } from 'cusphanger';
import { ${lutName} } from 'nutelch';

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
      { key: 'hEasing', label: 'hue easing', options: Object.keys(HUE_EASINGS), value: 'linear' },
      { key: 'triangleMode', label: 'triangle', options: ['perHue', 'min', 'avg', 'max'], value: 'perHue' },
    ],
    build: (v, c, lut) =>
      ramp({
        hStart: v.hStart!, total: v.total!,
        sRange: [v.sMin!, v.sMax!], lRange: [v.minLight!, v.maxLight!], coolWarm: v.w!,
        hCycles: v.hCycles!, hStartCenter: v.hStartCenter!, hEasing: HUE_EASINGS[c.hEasing!],
        triangleMode: c.triangleMode as TriangleMode,
        lut,
      }),
    usage: (v, c, lutName) => `import { ramp } from 'cusphanger';
import { ${lutName} } from 'nutelch';

const palette = ramp({
  hStart: ${v.hStart},
  total: ${v.total},
  hCycles: ${v.hCycles},
  hStartCenter: ${v.hStartCenter},
  hEasing: ${HUE_EASINGS[c.hEasing!]}, // ${c.hEasing}
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
const wheelFlip: Record<WheelAxis, boolean> = { chroma: false, lightness: false };
let lastValues: Record<string, number> = {};
let lastChoices: Record<string, string> = {};
let palette: OklchColor[] = [];

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
  renderSlice(sliceMiniHost, palette, lut, activeTab.forceMirror ?? false);
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
  buildControls(controlsHost, tab.fields, tab.choices ?? [], ({ values, choices }) => {
    lastValues = values;
    lastChoices = choices;
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

const vizGamut = $('.control--gamut') as HTMLButtonElement;
const vizGamutValue = vizGamut.querySelector('.control__value') as HTMLElement;
let p3 = false;
vizGamut.addEventListener('click', () => {
  p3 = !p3;
  lut = p3 ? oklchP3 : oklchSrgb;
  vizGamutValue.textContent = p3 ? 'P3' : 'sRGB';
  vizGamut.toggleAttribute('data-active', p3);
  renderAll();
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

initXerox(document.getElementById('app') as HTMLElement);

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
let konamiAt = 0;
window.addEventListener('keydown', (e) => {
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  konamiAt = key === KONAMI[konamiAt] ? konamiAt + 1 : key === KONAMI[0] ? 1 : 0;
  if (konamiAt < KONAMI.length) return;
  konamiAt = 0;
  const panel = document.querySelector('#app .fx-panel') as HTMLElement | null;
  if (panel) panel.hidden = !panel.hidden;
  else initFxPanel();
});

