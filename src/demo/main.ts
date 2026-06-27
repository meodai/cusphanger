import { sequential, diverging, type PaletteColor, type Gamut } from '../lib/index';
import { buildControls, type FieldSpec } from './controls';
import { renderSwatches, renderStrip } from './swatches';
import { renderSlice } from './slice';
import { renderWheel, type WheelAxis } from './wheel';

type TabId = 'sequential' | 'diverging';

interface Tab {
  id: TabId;
  label: string;
  fields: FieldSpec[];
  forceMirror?: boolean; // always show both slice flaps (e.g. diverging)
  build: (v: Record<string, number>, gamut: Gamut) => PaletteColor[];
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
    build: (v, gamut) =>
      sequential({
        hStart: v.hStart!, total: v.total!, saturation: v.s!,
        brightness: v.b!, contrast: v.c!, coolWarm: v.w!, gamut,
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
    build: (v, gamut) =>
      diverging({
        hStart: v.hStart!, hEnd: v.hEnd!, total: v.total!,
        saturation: v.s!, brightness: v.b!, contrast: v.c!, coolWarm: v.w!, gamut,
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
            <button data-axis="chroma" aria-selected="true">C</button>
            <button data-axis="lightness" aria-selected="false">L</button>
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
      <p>It works for smooth gradients (<strong>sequential</strong>) and scales that fan out from a
      neutral middle (<strong>diverging</strong>) — and it can target wide-gamut displays, not just
      standard ones.</p>

      <details class="about__nerd">
        <summary>the technical version, for color nerds</summary>
        <p>A faithful OKLCH port of the paper. For any hue, the displayable colors form a triangle in
        the chroma–lightness plane with corners at black, white, and the <em>cusp</em> (the paper's
        MSC — the most saturated color that hue can reach). A palette is a quadratic-Bézier path
        through that triangle.</p>
        <p>The knobs are the paper's: <em>saturation</em> (s) is the curve's tension — 0 gives a gray
        ramp, 1 bends the path through the cusp; <em>brightness</em> (b) and <em>contrast</em> (c)
        shape the lightness sampling; <em>cool/warm</em> (w) pulls the light end toward yellow.
        Diverging joins two sequential palettes through a shared neutral.</p>
        <p>The two diagrams show the same gamut from different angles. The <strong>top view</strong>
        is a wheel — hue as angle, chroma or lightness as radius (click the active axis again to flip
        it). The <strong>side view</strong> is the chroma × lightness slice: the real OKLCH gamut on
        the left vs. the paper's straight-edged triangle model with its cusp tip on the right,
        mirroring into a butterfly when a palette spans two hues. The generated palette is plotted in
        both.</p>
      </details>

      <p class="cite">A faithful OKLCH implementation of Wijffelaars, Vliegen, van Wijk &amp; van der
      Linden, <a href="https://doi.org/10.1111/j.1467-8659.2008.01203.x" target="_blank" rel="noopener">“Generating
      Color Palettes using Intuitive Parameters”</a> (Computer Graphics Forum 27:3, 2008). Also
      inspired by <a href="https://x.com/mattdesl/status/1815445668002988493" target="_blank" rel="noopener">Matt
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

  // global state: active tab, the (persistent) gamut, the latest control values,
  // the wheel axis/flip, and the latest palette (so the wheel toggle can redraw).
  let activeTab: Tab = TABS[0]!;
  let gamutState: Gamut = 'srgb';
  let wheelAxis: WheelAxis = 'chroma';
  const wheelFlip: Record<WheelAxis, boolean> = { chroma: false, lightness: false };
  let lastValues: Record<string, number> = {};
  let lastPalette: PaletteColor[] = [];

  const renderActive = () => {
    const palette = activeTab.build(lastValues, gamutState);
    lastPalette = palette;
    renderStrip(stripHost, palette);
    renderSwatches(swatchHost, palette);
    renderWheel(wheelHost, palette, gamutState, wheelAxis, wheelFlip[wheelAxis]);
    renderSlice(sliceHost, palette, gamutState, activeTab.forceMirror ?? false);
  };

  // header control: gamut (global, persistent across tabs)
  const gamutSel = app.querySelector('.js-gamut') as HTMLSelectElement;
  gamutSel.addEventListener('change', () => {
    gamutState = gamutSel.value as Gamut;
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
      renderWheel(wheelHost, lastPalette, gamutState, wheelAxis, wheelFlip[wheelAxis]);
    });
  }

  const mountTab = (tab: Tab) => {
    activeTab = tab;
    buildControls(controlsHost, tab.fields, [], ({ values }) => {
      lastValues = values;
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
