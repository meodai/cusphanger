import { sequential, diverging, type OklchColor, type TriangleMode } from '../lib/index';
import { oklchSrgb, oklchP3, type Lut } from 'nutelch';
import { buildControls, type FieldSpec, type ChoiceSpec } from './controls';
import { renderSwatches, renderStrip } from './swatches';
import { renderSlice } from './slice';
import { renderWheel, type WheelAxis } from './wheel';
import { ditherSvg } from './dither';

// the loosening dither strip at the palette edge (configurable: svg width + square size)
const DITHER = { width: 160, square: 2, color: '#000' };

// hue-trajectory easings for the Ramp tab (RampenSau-style hue cycling).
const HUE_EASINGS: Record<string, (t: number) => number> = {
  linear: (t) => t,
  'ease-in': (t) => t * t,
  'ease-out': (t) => 1 - (1 - t) * (1 - t),
  sine: (t) => 0.5 - 0.5 * Math.cos(Math.PI * t),
};
const HUE_EASING_NAMES = Object.keys(HUE_EASINGS);

type TabId = 'sequential' | 'diverging' | 'ramp';

interface Tab {
  id: TabId;
  label: string;
  fields: FieldSpec[];
  choices?: ChoiceSpec[];
  forceMirror?: boolean; // always show both slice flaps (e.g. diverging)
  build: (v: Record<string, number>, c: Record<string, string>, lut: Lut) => OklchColor[];
}

const TABS: Tab[] = [
  {
    id: 'sequential',
    label: 'Sequential',
    fields: [
      { key: 'hStart', label: 'hStart (h)', min: 0, max: 360, step: 1, value: 260 },
      { key: 'total', label: 'total (N)', min: 2, max: 15, step: 1, value: 9 },
      { key: 's', label: 'saturation (s)', min: 0, max: 1, step: 0.01, value: 0.6 },
      { key: 'b', label: 'brightness (b)', min: 0, max: 1, step: 0.01, value: 0.75 },
      { key: 'c', label: 'contrast (c)', min: 0, max: 1, step: 0.01, value: 0.88 },
      { key: 'w', label: 'cool/warm (w)', min: 0, max: 1, step: 0.01, value: 0 },
    ],
    build: (v, _c, lut) =>
      sequential({
        hStart: v.hStart!, total: v.total!, saturation: v.s!,
        brightness: v.b!, contrast: v.c!, coolWarm: v.w!, lut,
      }),
  },
  {
    id: 'diverging',
    label: 'Diverging',
    forceMirror: true,
    fields: [
      { key: 'hStart', label: 'hStart (left)', min: 0, max: 360, step: 1, value: 250 },
      { key: 'hEnd', label: 'hEnd (right)', min: 0, max: 360, step: 1, value: 30 },
      { key: 'total', label: 'total (N)', min: 3, max: 15, step: 1, value: 9 },
      { key: 's', label: 'saturation (s)', min: 0, max: 1, step: 0.01, value: 0.6 },
      { key: 'b', label: 'brightness (b)', min: 0, max: 1, step: 0.01, value: 0.75 },
      { key: 'c', label: 'contrast (c)', min: 0, max: 1, step: 0.01, value: 0.88 },
      { key: 'w', label: 'cool/warm (w)', min: 0, max: 1, step: 0.01, value: 0 },
    ],
    build: (v, _c, lut) =>
      diverging({
        hStart: v.hStart!, hEnd: v.hEnd!, total: v.total!,
        saturation: v.s!, brightness: v.b!, contrast: v.c!, coolWarm: v.w!, lut,
      }),
  },
  {
    id: 'ramp',
    label: 'Ramp',
    fields: [
      { key: 'hStart', label: 'hStart (h)', min: 0, max: 360, step: 1, value: 260 },
      { key: 'total', label: 'total (N)', min: 2, max: 24, step: 1, value: 9 },
      { key: 'hCycles', label: 'hCycles', min: -2, max: 2, step: 0.05, value: 0.3 },
      { key: 'hStartCenter', label: 'hStartCenter', min: 0, max: 1, step: 0.01, value: 0.5 },
      { key: 'sMin', label: 'sMin', min: 0, max: 1, step: 0.01, value: 0.5 },
      { key: 'sMax', label: 'sMax', min: 0, max: 1, step: 0.01, value: 0.9 },
      { key: 'minLight', label: 'minLight', min: 0, max: 0.6, step: 0.01, value: 0.2 },
      { key: 'maxLight', label: 'maxLight', min: 0.5, max: 1, step: 0.01, value: 0.97 },
      { key: 'w', label: 'cool/warm (w)', min: 0, max: 1, step: 0.01, value: 0 },
    ],
    choices: [
      { key: 'hEasing', label: 'hue easing', options: HUE_EASING_NAMES, value: 'linear' },
      { key: 'triangleMode', label: 'triangle', options: ['perHue', 'min', 'avg', 'max'], value: 'perHue' },
    ],
    // the paper's sequential + a RampenSau-style hue trajectory (each color is
    // the paper's ramp for its own rotated hue). triangleMode evens colorfulness;
    // saturation (sRange) and lightness (lRange) are RampenSau-style ranges here.
    build: (v, c, lut) =>
      sequential({
        hStart: v.hStart!, total: v.total!,
        sRange: [v.sMin!, v.sMax!], lRange: [v.minLight!, v.maxLight!], coolWarm: v.w!,
        hCycles: v.hCycles!, hStartCenter: v.hStartCenter!, hEasing: HUE_EASINGS[c.hEasing!],
        triangleMode: c.triangleMode as TriangleMode,
        lut,
      }),
  },
];

function render(app: HTMLElement): void {
  // static chrome (header, intro, about) lives in index.html — build only the
  // interactive app window into the .stage placeholder.
  const stage = app.querySelector('.stage') as HTMLElement;
  stage.innerHTML = `
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
            <button data-axis="chroma" aria-selected="true">C</button>
            <button data-axis="lightness" aria-selected="false">L</button>
          </div>
        </div>
        <div class="slice"></div>
      </div>
    </section>`;

  // generate the dither strip SVG and hand it to the .palette::after via vars
  const paletteEl = app.querySelector('.palette') as HTMLElement;
  paletteEl.style.setProperty('--dither-bg', ditherSvg(DITHER));
  paletteEl.style.setProperty('--dither-w', `${DITHER.width}px`);

  const tabsNav = app.querySelector('.tabs') as HTMLElement;
  const controlsHost = app.querySelector('.controls') as HTMLElement;
  const swatchHost = app.querySelector('.swatches') as HTMLElement;
  const sliceHost = app.querySelector('.slice') as HTMLElement;
  const wheelHost = app.querySelector('.wheel') as HTMLElement;
  const stripHost = app.querySelector('.palette-strip') as HTMLButtonElement;
  const detailHost = app.querySelector('.palette-detail') as HTMLElement;
  stripHost.addEventListener('click', () => {
    const open = detailHost.hasAttribute('hidden');
    detailHost.toggleAttribute('hidden', !open);
    stripHost.setAttribute('aria-expanded', String(open));
  });

  // global state: active tab, the (persistent) gamut, the latest control values,
  // the wheel axis/flip, and the latest palette (so the wheel toggle can redraw).
  let activeTab: Tab = TABS[0]!;
  let lutState: Lut = oklchSrgb;
  let wheelAxis: WheelAxis = 'chroma';
  const wheelFlip: Record<WheelAxis, boolean> = { chroma: false, lightness: false };
  let lastValues: Record<string, number> = {};
  let lastChoices: Record<string, string> = {};
  let lastPalette: OklchColor[] = [];

  const renderActive = () => {
    const palette = activeTab.build(lastValues, lastChoices, lutState);
    lastPalette = palette;
    renderStrip(stripHost, palette);
    renderSwatches(swatchHost, palette);
    renderWheel(wheelHost, palette, lutState, wheelAxis, wheelFlip[wheelAxis]);
    renderSlice(sliceHost, palette, lutState, activeTab.forceMirror ?? false);
  };

  // header control: gamut (global, persistent across tabs)
  const gamutSel = app.querySelector('.js-gamut') as HTMLSelectElement;
  gamutSel.addEventListener('change', () => {
    lutState = gamutSel.value === "display-p3" ? oklchP3 : oklchSrgb;
    renderActive();
  });

  // wheel radial-axis toggle (re-click the active axis to flip its direction)
  const axisBtns = Array.from(app.querySelectorAll<HTMLButtonElement>('.axis-toggle button'));
  for (const btn of axisBtns) {
    btn.addEventListener('click', () => {
      const a = btn.dataset.axis as WheelAxis;
      if (a === wheelAxis) wheelFlip[a] = !wheelFlip[a];
      else wheelAxis = a;
      for (const b of axisBtns) {
        const ba = b.dataset.axis as WheelAxis;
        b.setAttribute('aria-selected', String(ba === wheelAxis));
        b.toggleAttribute('data-flipped', ba === wheelAxis && wheelFlip[ba]);
      }
      renderWheel(wheelHost, lastPalette, lutState, wheelAxis, wheelFlip[wheelAxis]);
    });
  }

  const mountTab = (tab: Tab) => {
    activeTab = tab;
    buildControls(controlsHost, tab.fields, tab.choices ?? [], ({ values, choices }) => {
      lastValues = values;
      lastChoices = choices;
      renderActive();
    });
  };

  const renderTabs = () => {
    tabsNav.innerHTML = '';
    for (const tab of TABS) {
      const b = document.createElement('button');
      b.textContent = tab.label;
      b.setAttribute('aria-selected', String(tab.id === activeTab.id));
      b.addEventListener('click', () => {
        mountTab(tab);
        renderTabs();
      });
      tabsNav.appendChild(b);
    }
  };

  renderTabs();
  mountTab(TABS[0]!);
}

render(document.getElementById('app') as HTMLElement);
