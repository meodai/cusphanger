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
// xerox tuning panel — uncomment (with the call below) to dial the filter.
// import { initFxPanel } from './fx-panel';

// hue-trajectory easings for the Ramp tab (RampenSau-style hue cycling)
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
  forceMirror?: boolean; // always show both slice flaps (diverging)
  build: (v: Record<string, number>, c: Record<string, string>, lut: Lut) => OklchColor[];
  // the library call that reproduces the current palette (the 'usage' export)
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
const wheelHost = $('#wheel');
const tabsNav = $('.tabs');
const controlsHost = $('.controls');
const updateExport = initExport($('.export'));

// the sidebar viz box shows the wheel (either radial axis) or the mini slice
type VizView = WheelAxis | 'slice';
let activeTab: Tab = TABS[0]!;
let lut: Lut = oklchSrgb;
let vizView: VizView = 'chroma';
let wheelAxis: WheelAxis = 'chroma';
const wheelFlip: Record<WheelAxis, boolean> = { chroma: false, lightness: false };
let lastValues: Record<string, number> = {};
let lastChoices: Record<string, string> = {};
let palette: OklchColor[] = [];

// the composition tiles' hue-randomized variant: the active tab's current
// settings verbatim, with ONLY hStart set to a random hue (hEnd and everything
// else are left exactly as the live palette). Returns the palette as CSS.
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
  renderWheel(wheelHost, palette, lut, wheelAxis, wheelFlip[wheelAxis]);
  updateCompositions(palette.length);
  updateExport(palette, activeTab.usage(lastValues, lastChoices, lut === oklchP3 ? 'oklchP3' : 'oklchSrgb'));
}

// tabs — built once; switching only re-targets the controls
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
  b.textContent = tab.label;
  b.setAttribute('role', 'tab');
  b.addEventListener('click', () => selectTab(tab));
  tabButtons.push(b);
  tabsNav.appendChild(b);
}

// gamut toggle: sRGB <-> Display P3
const gamutInput = document.querySelector('.gamut input') as HTMLInputElement;
const gamutVal = $('.gamut__value');
gamutInput.addEventListener('change', () => {
  lut = gamutInput.checked ? oklchP3 : oklchSrgb;
  gamutVal.textContent = gamutInput.checked ? 'Display P3' : 'sRGB';
  renderAll();
});

// sidebar viz switch: chroma / lightness show the wheel (re-click the active
// axis to flip its radial direction); slice shows the mini gamut slice
const axisBtns = Array.from(document.querySelectorAll<HTMLButtonElement>('.axis-toggle button'));
for (const btn of axisBtns) {
  btn.addEventListener('click', () => {
    const a = btn.dataset.axis as VizView;
    if (a !== 'slice') {
      if (a === vizView) wheelFlip[a] = !wheelFlip[a];
      wheelAxis = a;
      renderWheel(wheelHost, palette, lut, wheelAxis, wheelFlip[wheelAxis]);
    }
    vizView = a;
    wheelHost.hidden = vizView === 'slice';
    sliceMiniHost.hidden = vizView !== 'slice';
    for (const b of axisBtns) {
      const ba = b.dataset.axis as VizView;
      b.setAttribute('aria-selected', String(ba === vizView));
      b.toggleAttribute(
        'data-flipped',
        ba !== 'slice' && ba === vizView && wheelFlip[ba as WheelAxis],
      );
    }
  });
}

selectTab(TABS.find((t) => t.id === 'diverging') ?? TABS[0]!);

// xerox layering: a blurred ghost of the whole app behind the sharp front,
// kept in sync by a MutationObserver. Which parts print on which layer is
// decided in demo.css (the .rail layer-split custom properties).
initXerox(document.getElementById('app') as HTMLElement);
// initFxPanel(); // xerox tuning panel — re-enable to dial the filter values
