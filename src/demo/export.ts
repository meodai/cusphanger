import type { OklchColor } from '../lib/index';
import { cssOf, hexOf } from './color';
import { copyText } from './clipboard';

type FormatId = 'usage' | 'css' | 'oklch' | 'js';

export function initExport(
  host: HTMLElement,
): (palette: OklchColor[], usage: string) => void {
  let active: FormatId = 'usage';
  let palette: OklchColor[] = [];
  let usage = '';

  const FORMATS: Array<{ id: FormatId; label: string; print: () => string }> = [
    { id: 'usage', label: 'usage', print: () => usage },
    {
      id: 'css',
      label: 'css',
      print: () =>
        [':root {', ...palette.map((c, i) => `  --pal-${i}: ${cssOf(c)};`), '}'].join('\n'),
    },
    { id: 'oklch', label: 'oklch', print: () => palette.map(cssOf).join('\n') },
    {
      id: 'js',
      label: 'js',
      print: () =>
        ['export const palette = [', ...palette.map((c) => `  '${hexOf(c)}',`), '];'].join('\n'),
    },
  ];

  host.innerHTML = `
    <div class="export__bar tabs" role="tablist" aria-label="Export format">
      ${FORMATS.map(
        (f) =>
          `<button type="button" class="tabs__tab" role="tab" data-format="${f.id}"
             aria-selected="${f.id === active}">${f.label}</button>`,
      ).join('')}
      <button type="button" class="tabs__tab export__copy">copy</button>
    </div>
    <pre class="export__code"><code></code></pre>
    <span class="marks" aria-hidden="true"></span>`;

  const code = host.querySelector('code') as HTMLElement;
  const tabs = Array.from(host.querySelectorAll<HTMLButtonElement>('[data-format]'));
  const copyBtn = host.querySelector('.export__copy') as HTMLButtonElement;

  const print = () => {
    code.textContent = FORMATS.find((f) => f.id === active)!.print();
  };
  for (const tab of tabs) {
    tab.addEventListener('click', () => {
      active = tab.dataset.format as FormatId;
      for (const t of tabs) t.setAttribute('aria-selected', String(t === tab));
      print();
    });
  }
  copyBtn.addEventListener('click', () => copyText(code.textContent ?? '', copyBtn));

  return (p, u) => {
    palette = p;
    usage = u;
    print();
  };
}
