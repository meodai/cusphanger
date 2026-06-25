import {
  sequential,
  diverging,
  qualitative,
  generatePalette,
  linear,
  power,
  sine,
  lame,
  hump,
  type Easing,
  type PaletteColor,
  type Gamut,
  type ChromaMode,
} from '../lib/index';
import { buildControls, type FieldSpec, type ChoiceSpec } from './controls';
import { renderSwatches, renderStrip } from './swatches';
import { renderSlice } from './slice';
import { renderWheel, type WheelAxis } from './wheel';

// Named easings exposed in the Engine tab. power/lame/hump are parameterized;
// we surface sensible presets.
const EASINGS: Record<string, Easing> = {
  linear,
  'ease-in': power(2),
  'ease-out': power(0.5),
  sine,
  lamé: lame(2),
  hump: hump(),
};
const EASING_NAMES = Object.keys(EASINGS);

type TabId = 'sequential' | 'diverging' | 'qualitative' | 'engine';

interface Tab {
  id: TabId;
  label: string;
  fields: FieldSpec[];
  choices?: ChoiceSpec[];
  build: (
    v: Record<string, number>,
    c: Record<string, string>,
    gamut: Gamut,
    chromaMode: ChromaMode,
  ) => PaletteColor[];
}

const TABS: Tab[] = [
  {
    id: 'sequential',
    label: 'Sequential',
    fields: [
      { key: 'hue', label: 'hue', min: 0, max: 360, step: 1, value: 260 },
      { key: 'count', label: 'count', min: 2, max: 15, step: 1, value: 9 },
      { key: 'saturation', label: 'saturation', min: 0, max: 1, step: 0.01, value: 0.9 },
      { key: 'lightnessHigh', label: 'lightnessHigh', min: 0.5, max: 1, step: 0.01, value: 0.95 },
      { key: 'lightnessLow', label: 'lightnessLow', min: 0, max: 0.5, step: 0.01, value: 0.2 },
      { key: 'hueShift', label: 'hueShift', min: -180, max: 180, step: 1, value: 0 },
    ],
    build: (v, _c, gamut, chromaMode) =>
      sequential({
        hue: v.hue!, count: v.count!, saturation: v.saturation!,
        lightnessHigh: v.lightnessHigh!, lightnessLow: v.lightnessLow!,
        hueShift: v.hueShift!, chromaMode, gamut,
      }),
  },
  {
    id: 'diverging',
    label: 'Diverging',
    fields: [
      { key: 'hueLeft', label: 'hueLeft', min: 0, max: 360, step: 1, value: 250 },
      { key: 'hueRight', label: 'hueRight', min: 0, max: 360, step: 1, value: 30 },
      { key: 'count', label: 'count', min: 3, max: 15, step: 1, value: 9 },
      { key: 'saturation', label: 'saturation', min: 0, max: 1, step: 0.01, value: 0.9 },
      { key: 'centerLightness', label: 'centerLightness', min: 0.6, max: 1, step: 0.01, value: 0.95 },
      { key: 'lightnessLow', label: 'lightnessLow', min: 0.1, max: 0.6, step: 0.01, value: 0.35 },
    ],
    build: (v, _c, gamut, chromaMode) =>
      diverging({
        hueLeft: v.hueLeft!, hueRight: v.hueRight!, count: v.count!,
        saturation: v.saturation!, centerLightness: v.centerLightness!,
        lightnessLow: v.lightnessLow!, chromaMode, gamut,
      }),
  },
  {
    id: 'qualitative',
    label: 'Qualitative',
    fields: [
      { key: 'count', label: 'count', min: 2, max: 16, step: 1, value: 8 },
      { key: 'hueFrom', label: 'hueFrom', min: 0, max: 360, step: 1, value: 0 },
      { key: 'hueTo', label: 'hueTo', min: 0, max: 360, step: 1, value: 360 },
      { key: 'lightness', label: 'lightness', min: 0.3, max: 0.9, step: 0.01, value: 0.7 },
      { key: 'saturation', label: 'saturation', min: 0, max: 1, step: 0.01, value: 0.7 },
    ],
    build: (v, _c, gamut, chromaMode) =>
      qualitative({
        count: v.count!, hueRange: [v.hueFrom!, v.hueTo!],
        lightness: v.lightness!, saturation: v.saturation!, chromaMode, gamut,
      }),
  },
  {
    id: 'engine',
    label: 'Engine',
    fields: [
      { key: 'total', label: 'total', min: 2, max: 16, step: 1, value: 9 },
      { key: 'hueStart', label: 'hueStart', min: 0, max: 360, step: 1, value: 200 },
      { key: 'hueCycles', label: 'hueCycles', min: -2, max: 2, step: 0.05, value: 0.3 },
      { key: 'lightHigh', label: 'lightnessStart', min: 0, max: 1, step: 0.01, value: 0.9 },
      { key: 'lightLow', label: 'lightnessEnd', min: 0, max: 1, step: 0.01, value: 0.25 },
      { key: 'satStart', label: 'saturationStart', min: 0, max: 1, step: 0.01, value: 0.85 },
      { key: 'satEnd', label: 'saturationEnd', min: 0, max: 1, step: 0.01, value: 0.85 },
    ],
    choices: [
      { key: 'hueEasing', label: 'hue easing', options: EASING_NAMES, value: 'linear' },
      { key: 'lightnessEasing', label: 'lightness easing', options: EASING_NAMES, value: 'linear' },
      { key: 'saturationEasing', label: 'saturation easing', options: EASING_NAMES, value: 'linear' },
    ],
    build: (v, c, gamut, chromaMode) =>
      generatePalette({
        total: v.total!, hueStart: v.hueStart!, hueCycles: v.hueCycles!,
        hueEasing: EASINGS[c.hueEasing!],
        lightnessRange: [v.lightHigh!, v.lightLow!],
        lightnessEasing: EASINGS[c.lightnessEasing!],
        saturationRange: [v.satStart!, v.satEnd!],
        saturationEasing: EASINGS[c.saturationEasing!],
        chromaMode,
        gamut,
      }),
  },
];

function render(app: HTMLElement): void {
  app.innerHTML = `
    <h1>CuspHanger</h1>
    <div class="stage">
    <p class="sub">OKLCH palettes from intuitive parameters — gamut-relative saturation, in-gamut by construction.</p>
    <div class="palette">
      <button class="palette-strip" type="button" aria-expanded="false" title="Show color details"></button>
      <div class="palette-detail" hidden>
        <div class="swatches"></div>
        <p class="hint">Click a swatch to copy its CSS. ⚠︎ marks colors outside the sRGB gamut.</p>
      </div>
    </div>  
    <nav class="tabs"></nav>
    <section class="panel">
    <div class="controls"></div>
      <div class="views">
        <div class="view-block">
          <div class="wheel"></div>
          <div class="axis-toggle">
            <button data-axis="chroma" aria-selected="true">C radius</button>
            <button data-axis="lightness" aria-selected="false">L radius</button>
          </div>
        </div>
        <div class="slice"></div>
      </div>
    </section>
    </div>`;

  const tabsNav = app.querySelector('.tabs') as HTMLElement;
  const controlsHost = app.querySelector('.controls') as HTMLElement;
  const swatchHost = app.querySelector('.swatches') as HTMLElement;
  const sliceHost = app.querySelector('.slice') as HTMLElement;
  const wheelHost = app.querySelector('.wheel') as HTMLElement;
  const stripHost = app.querySelector('.palette-strip') as HTMLButtonElement;
  const detailHost = app.querySelector('.palette-detail') as HTMLElement;
  let active: TabId = 'sequential';

  stripHost.addEventListener('click', () => {
    const open = detailHost.hasAttribute('hidden');
    detailHost.toggleAttribute('hidden', !open);
    stripHost.setAttribute('aria-expanded', String(open));
  });

  // wheel radial axis + the latest palette, so the toggle can redraw without recomputing
  let wheelAxis: WheelAxis = 'chroma';
  let lastPalette: PaletteColor[] = [];
  let lastGamut: Gamut = 'srgb';

  const axisBtns = Array.from(app.querySelectorAll<HTMLButtonElement>('.axis-toggle button'));
  for (const btn of axisBtns) {
    btn.addEventListener('click', () => {
      wheelAxis = btn.dataset.axis as WheelAxis;
      for (const b of axisBtns) b.setAttribute('aria-selected', String(b === btn));
      renderWheel(wheelHost, lastPalette, lastGamut, wheelAxis);
    });
  }

  const mountTab = (tab: Tab) => {
    buildControls(
      controlsHost,
      tab.fields,
      tab.choices ?? [],
      'srgb',
      'envelope',
      ({ values, choices, gamut, chromaMode }) => {
        const palette = tab.build(values, choices, gamut, chromaMode);
        lastPalette = palette;
        lastGamut = gamut;
        renderStrip(stripHost, palette);
        renderSwatches(swatchHost, palette);
        renderWheel(wheelHost, palette, gamut, wheelAxis);
        renderSlice(sliceHost, palette, gamut, chromaMode);
      },
    );
  };

  const renderTabs = () => {
    tabsNav.innerHTML = '';
    for (const tab of TABS) {
      const b = document.createElement('button');
      b.textContent = tab.label;
      b.setAttribute('aria-selected', String(tab.id === active));
      b.addEventListener('click', () => {
        active = tab.id;
        renderTabs();
        mountTab(tab);
      });
      tabsNav.appendChild(b);
    }
  };

  renderTabs();
  mountTab(TABS[0]!);
}

render(document.getElementById('app') as HTMLElement);
