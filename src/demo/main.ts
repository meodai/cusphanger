import {
  sequential,
  diverging,
  qualitative,
  generatePalette,
  linear,
  type PaletteColor,
  type Gamut,
} from '../lib/index';
import { buildControls, type FieldSpec } from './controls';
import { renderSwatches } from './swatches';
import { renderSlice } from './slice';

type TabId = 'sequential' | 'diverging' | 'qualitative' | 'engine';

interface Tab {
  id: TabId;
  label: string;
  fields: FieldSpec[];
  build: (v: Record<string, number>, gamut: Gamut) => PaletteColor[];
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
    build: (v, gamut) =>
      sequential({
        hue: v.hue!, count: v.count!, saturation: v.saturation!,
        lightnessHigh: v.lightnessHigh!, lightnessLow: v.lightnessLow!,
        hueShift: v.hueShift!, gamut,
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
    build: (v, gamut) =>
      diverging({
        hueLeft: v.hueLeft!, hueRight: v.hueRight!, count: v.count!,
        saturation: v.saturation!, centerLightness: v.centerLightness!,
        lightnessLow: v.lightnessLow!, gamut,
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
    build: (v, gamut) =>
      qualitative({
        count: v.count!, hueRange: [v.hueFrom!, v.hueTo!],
        lightness: v.lightness!, saturation: v.saturation!, gamut,
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
    build: (v, gamut) =>
      generatePalette({
        total: v.total!, hueStart: v.hueStart!, hueCycles: v.hueCycles!,
        hueEasing: linear,
        lightnessRange: [v.lightHigh!, v.lightLow!],
        saturationRange: [v.satStart!, v.satEnd!],
        gamut,
      }),
  },
];

function render(app: HTMLElement): void {
  app.innerHTML = `
    <h1>CuspHanger</h1>
    <p class="sub">OKLCH palettes from intuitive parameters — gamut-relative saturation, in-gamut by construction.</p>
    <nav class="tabs"></nav>
    <section class="panel">
      <div class="controls"></div>
      <div class="output">
        <div class="swatches"></div>
        <div class="slice"></div>
      </div>
    </section>
    <p class="hint">Click a swatch to copy its CSS. ⚠︎ marks colors outside the sRGB gamut. The slice shows the (chroma × lightness) cross-section at the palette's most-saturated hue.</p>`;

  const tabsNav = app.querySelector('.tabs') as HTMLElement;
  const controlsHost = app.querySelector('.controls') as HTMLElement;
  const swatchHost = app.querySelector('.swatches') as HTMLElement;
  const sliceHost = app.querySelector('.slice') as HTMLElement;
  let active: TabId = 'sequential';

  const mountTab = (tab: Tab) => {
    buildControls(controlsHost, tab.fields, 'srgb', (values, gamut) => {
      const palette = tab.build(values, gamut);
      renderSwatches(swatchHost, palette);
      renderSlice(sliceHost, palette, gamut);
    });
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
