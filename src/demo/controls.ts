import type { Gamut, ChromaMode } from '../lib/index';

export interface FieldSpec {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
}

// A per-tab dropdown of named choices (e.g. easing functions). The selected
// string is passed back to the tab so it can map it to a value/function.
export interface ChoiceSpec {
  key: string;
  label: string;
  options: string[];
  value: string;
}

export interface ControlValues {
  values: Record<string, number>;
  choices: Record<string, string>;
  gamut: Gamut;
  chromaMode: ChromaMode;
}

export function buildControls(
  host: HTMLElement,
  fields: FieldSpec[],
  choiceFields: ChoiceSpec[],
  gamut: Gamut,
  chromaMode: ChromaMode,
  onChange: (v: ControlValues) => void,
): void {
  host.innerHTML = '';
  const state: Record<string, number> = {};
  const choices: Record<string, string> = {};
  let gamutState = gamut;
  let chromaState = chromaMode;
  for (const f of fields) state[f.key] = f.value;
  for (const c of choiceFields) choices[c.key] = c.value;

  const emit = () => onChange({ values: { ...state }, choices: { ...choices }, gamut: gamutState, chromaMode: chromaState });

  const addSelect = (
    label: string,
    options: readonly string[],
    current: string,
    onSet: (v: string) => void,
    describe?: Record<string, string>,
  ) => {
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
    wrap.appendChild(select);

    let hint: HTMLElement | undefined;
    if (describe) {
      hint = document.createElement('small');
      hint.className = 'control__hint';
      hint.textContent = describe[current] ?? '';
      wrap.appendChild(hint);
    }

    select.addEventListener('change', () => {
      const v = select.value;
      onSet(v);
      if (hint && describe) hint.textContent = describe[v] ?? '';
      emit();
    });
    host.appendChild(wrap);
  };

  const chromaHints: Record<ChromaMode, string> = {
    envelope: 'fraction of the max chroma at each lightness — chroma fades toward the light and dark ends.',
    cusp: "fraction of this hue's peak (cusp) chroma, clamped to gamut — roughly constant chroma per hue.",
    shared: 'fraction of the highest chroma every hue can reach — uniform colorfulness across all hues.',
    absolute: 'raw chroma, same for every hue, NOT gamut-clamped (RampenSau-style) — clips out of gamut (⚠). For comparison.',
  };

  // chroma mode + gamut first
  addSelect('chroma mode', ['envelope', 'cusp', 'shared', 'absolute'], chromaState, (v) => (chromaState = v as ChromaMode), chromaHints);
  addSelect('gamut', ['srgb', 'display-p3'], gamutState, (v) => (gamutState = v as Gamut));

  // numeric parameters
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

  // per-tab choice fields (e.g. easings)
  for (const c of choiceFields) {
    addSelect(c.label, c.options, c.value, (v) => (choices[c.key] = v));
  }

  emit();
}
