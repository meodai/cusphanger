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

const chromaHints: Record<ChromaMode, string> = {
  envelope: 'fraction of the max chroma at each lightness — chroma fades toward the light and dark ends.',
  cusp: "fraction of this hue's peak (cusp) chroma, clamped to gamut — roughly constant chroma per hue.",
  shared: 'fraction of the highest chroma every hue can reach — uniform colorfulness across all hues.',
  absolute: 'raw chroma, same for every hue, NOT gamut-clamped (RampenSau-style) — clips out of gamut (⚠). For comparison.',
};

type TabId = 'sequential' | 'diverging' | 'qualitative' | 'engine';

interface Tab {
  id: TabId;
  label: string;
  fields: FieldSpec[];
  choices?: ChoiceSpec[];
  forceMirror?: boolean; // always show both slice flaps (e.g. diverging)
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
    forceMirror: true,
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
    <header class="header">
      <div class="header__intro">
        <h1>CuspHanger</h1>
        <p class="sub">Balanced color palettes from a few simple controls — consistent across every hue, and always true to what shows on screen.</p>
      </div>
      <div class="header-controls">
        <label class="control control--select">
          <span class="row"><span>chroma mode</span></span>
          <select class="js-chroma">
            <option value="envelope">envelope</option>
            <option value="cusp">cusp</option>
            <option value="shared">shared</option>
            <option value="absolute">absolute</option>
          </select>
          <small class="control__hint js-chroma-hint"></small>
        </label>
        <label class="control control--select">
          <span class="row"><span>gamut</span></span>
          <select class="js-gamut">
            <option value="srgb">srgb</option>
            <option value="display-p3">display-p3</option>
          </select>
        </label>
      </div>
    </header>
    <div class="stage">
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
    </div>
    <section class="about">
      <p>Choose a base color, how vivid you want it, and a light-to-dark range — CuspHanger turns
      those few choices into a complete palette. The colors stay evenly balanced from light to dark
      and from one hue to the next, never turn muddy, and always display correctly, so the palette
      you design is the one people actually see.</p>
      <p>It works for smooth gradients (<strong>sequential</strong>), scales that fan out from a
      neutral middle (<strong>diverging</strong>), and sets of distinct category colors
      (<strong>qualitative</strong>) — and it can target wide-gamut displays, not just standard ones.</p>

      <details class="about__nerd">
        <summary>the technical version, for color nerds</summary>
        <p>OKLCH palettes from intuitive parameters — gamut-relative saturation, in-gamut by
        construction. For any hue, the displayable colors form a triangle in the chroma–lightness
        plane that peaks at the <em>cusp</em> — the most saturated color that hue can reach.
        Saturation is <em>gamut-relative</em>: a value of 1 always rides the gamut boundary, so
        palettes stay in-gamut by construction and read evenly across hues.</p>
        <p>Four <strong>chroma modes</strong> change what saturation is measured against —
        <em>envelope</em> (the boundary at each lightness), <em>cusp</em> (each hue's single peak),
        <em>shared</em> (the highest chroma every hue can reach: the largest circle that fits inside
        the gamut, for uniform colorfulness across hues), and <em>absolute</em> (a raw,
        unclamped chroma à la RampenSau that clips out of gamut — a baseline for comparison).</p>
        <p>The two diagrams show the same gamut from different angles. The <strong>top view</strong>
        is a wheel — hue as angle, chroma or lightness as radius — and the <strong>side view</strong>
        is the chroma × lightness slice (real gamut vs. the paper's triangle model), mirroring into a
        butterfly when a palette spans two hues. The generated palette is plotted in both.</p>
      </details>

      <p class="cite">Method after Wijffelaars, Vliegen, van Wijk &amp; van der Linden,
      <a href="https://doi.org/10.1111/j.1467-8659.2008.01203.x" target="_blank" rel="noopener">“Generating
      Color Palettes using Intuitive Parameters”</a> (Computer Graphics Forum 27:3, 2008),
      re-expressed in OKLCH, with per-channel trajectory controls inspired by
      <a href="https://github.com/meodai/rampensau" target="_blank" rel="noopener">RampenSau</a>.
      Also inspired by <a href="https://x.com/mattdesl/status/1815445668002988493" target="_blank" rel="noopener">Matt
      DesLauriers's OKLCH take</a> on the same paper.</p>
    </section>`;

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

  // global state: active tab, the persistent header controls, latest per-tab
  // control values, wheel axis, and the latest palette (for the wheel toggle).
  let activeTab: Tab = TABS[0]!;
  let gamutState: Gamut = 'srgb';
  let chromaState: ChromaMode = 'envelope';
  let wheelAxis: WheelAxis = 'chroma';
  const wheelFlip: Record<WheelAxis, boolean> = { chroma: false, lightness: false };
  let lastValues: Record<string, number> = {};
  let lastChoices: Record<string, string> = {};
  let lastPalette: PaletteColor[] = [];

  const renderActive = () => {
    const palette = activeTab.build(lastValues, lastChoices, gamutState, chromaState);
    lastPalette = palette;
    renderStrip(stripHost, palette);
    renderSwatches(swatchHost, palette);
    renderWheel(wheelHost, palette, gamutState, wheelAxis, wheelFlip[wheelAxis]);
    renderSlice(sliceHost, palette, gamutState, chromaState, activeTab.forceMirror ?? false);
  };

  // header controls: chroma mode + gamut (global, persistent across tabs)
  const chromaSel = app.querySelector('.js-chroma') as HTMLSelectElement;
  const gamutSel = app.querySelector('.js-gamut') as HTMLSelectElement;
  const chromaHintEl = app.querySelector('.js-chroma-hint') as HTMLElement;
  chromaHintEl.textContent = chromaHints[chromaState];
  chromaSel.addEventListener('change', () => {
    chromaState = chromaSel.value as ChromaMode;
    chromaHintEl.textContent = chromaHints[chromaState];
    renderActive();
  });
  gamutSel.addEventListener('change', () => {
    gamutState = gamutSel.value as Gamut;
    renderActive();
  });

  // wheel radial-axis toggle
  const axisBtns = Array.from(app.querySelectorAll<HTMLButtonElement>('.axis-toggle button'));
  for (const btn of axisBtns) {
    btn.addEventListener('click', () => {
      const a = btn.dataset.axis as WheelAxis;
      // re-clicking the active axis flips its radial direction; otherwise switch
      if (a === wheelAxis) wheelFlip[a] = !wheelFlip[a];
      else wheelAxis = a;
      for (const b of axisBtns) {
        const ba = b.dataset.axis as WheelAxis;
        b.setAttribute('aria-selected', String(ba === wheelAxis));
        b.toggleAttribute('data-flipped', ba === wheelAxis && wheelFlip[ba]);
      }
      renderWheel(wheelHost, lastPalette, gamutState, wheelAxis, wheelFlip[wheelAxis]);
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
