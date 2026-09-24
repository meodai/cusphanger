import type { OklchColor } from '../lib/index';
import { cssOf, hexOf } from './color';
import { copyText } from './clipboard';

type FormatId = 'usage' | 'oklch' | 'hex' | 'svg';

export function initExport(
  host: HTMLElement,
  toolsHost: HTMLElement,
): (palette: OklchColor[], usage: string) => void {
  let active: FormatId = 'usage';
  let palette: OklchColor[] = [];
  let usage = '';

  const FORMATS: Array<{ id: FormatId; label: string; print: () => string }> = [
    { id: 'usage', label: 'usage', print: () => usage },
    { id: 'oklch', label: 'oklch', print: () => palette.map(cssOf).join('\n') },
    { id: 'hex', label: 'hex', print: () => palette.map(hexOf).join('\n') },
    { id: 'svg', label: 'svg', print: () => svgOf(palette) },
  ];

  toolsHost.innerHTML = `
    <div class="export__bar tabs" role="tablist" aria-label="Export format">
      ${FORMATS.map(
        (f) =>
          `<button type="button" class="tabs__tab" role="tab" data-format="${f.id}"
             aria-selected="${f.id === active}">${f.label}</button>`,
      ).join('')}
    </div>
    <button type="button" class="tabs__tab export__copy">copy</button>`;
  host.innerHTML = `
    <pre class="export__code"><code></code></pre>
    <button type="button" class="export__svg" title="download palette.svg" hidden></button>`;

  const pre = host.querySelector('.export__code') as HTMLElement;
  const code = host.querySelector('code') as HTMLElement;
  const svgBtn = host.querySelector('.export__svg') as HTMLButtonElement;
  const tabs = Array.from(toolsHost.querySelectorAll<HTMLButtonElement>('[data-format]'));
  const copyBtn = toolsHost.querySelector('.export__copy') as HTMLButtonElement;

  const print = () => {
    const text = FORMATS.find((f) => f.id === active)?.print() ?? '';
    code.textContent = text;
    const isSvg = active === 'svg';
    pre.hidden = isSvg;
    svgBtn.hidden = !isSvg;
    if (isSvg) svgBtn.innerHTML = text;
  };
  const sync = () => {
    for (const t of tabs) t.setAttribute('aria-selected', String(t.dataset.format === active));
    print();
  };
  for (const tab of tabs) {
    tab.addEventListener('click', () => {
      active = tab.dataset.format as FormatId;
      sync();
    });
  }
  copyBtn.addEventListener('click', () => copyText(code.textContent ?? '', copyBtn));
  svgBtn.addEventListener('click', () => download('palette.svg', svgOf(palette), 'image/svg+xml'));
  sync();

  return (p, u) => {
    palette = p;
    usage = u;
    print();
  };
}

function svgOf(palette: OklchColor[]): string {
  const w = 64;
  const h = 64;
  const rects = palette
    .map((c, i) => `  <rect x="${i * w}" y="0" width="${w}" height="${h}" fill="${hexOf(c)}"/>`)
    .join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${palette.length * w} ${h}" width="${palette.length * w}" height="${h}">\n${rects}\n</svg>`;
}

function download(name: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
