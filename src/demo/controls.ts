import type { Gamut, ChromaMode } from '../lib/index';

export interface FieldSpec {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
}

export function buildControls(
  host: HTMLElement,
  fields: FieldSpec[],
  gamut: Gamut,
  chromaMode: ChromaMode,
  onChange: (values: Record<string, number>, gamut: Gamut, chromaMode: ChromaMode) => void,
): void {
  host.innerHTML = '';
  const state: Record<string, number> = {};
  let gamutState = gamut;
  let chromaState = chromaMode;
  for (const f of fields) state[f.key] = f.value;

  const emit = () => onChange({ ...state }, gamutState, chromaState);

  for (const f of fields) {
    const wrap = document.createElement('label');
    wrap.className = 'control';
    const valueLabel = document.createElement('span');
    valueLabel.textContent = String(f.value);
    wrap.innerHTML = `<span class="row"><span>${f.label}</span></span>`;
    wrap.querySelector('.row')!.appendChild(valueLabel);

    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(f.min);
    input.max = String(f.max);
    input.step = String(f.step);
    input.value = String(f.value);
    input.addEventListener('input', () => {
      state[f.key] = Number(input.value);
      valueLabel.textContent = input.value;
      emit();
    });
    wrap.appendChild(input);
    host.appendChild(wrap);
  }

  const addSelect = <T extends string>(label: string, options: readonly T[], current: T, onSet: (v: T) => void) => {
    const wrap = document.createElement('label');
    wrap.className = 'control';
    wrap.innerHTML = `<span class="row"><span>${label}</span></span>`;
    const select = document.createElement('select');
    for (const o of options) {
      const opt = document.createElement('option');
      opt.value = o;
      opt.textContent = o;
      if (o === current) opt.selected = true;
      select.appendChild(opt);
    }
    select.addEventListener('change', () => {
      onSet(select.value as T);
      emit();
    });
    wrap.appendChild(select);
    host.appendChild(wrap);
  };

  addSelect('chroma mode', ['envelope', 'cusp', 'shared'] as const, chromaState, (v) => (chromaState = v));
  addSelect('gamut', ['srgb', 'display-p3'] as const, gamutState, (v) => (gamutState = v));

  emit();
}
