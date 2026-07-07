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
}

export function buildControls(
  host: HTMLElement,
  fields: FieldSpec[],
  choiceFields: ChoiceSpec[],
  onChange: (v: ControlValues) => void,
): void {
  host.innerHTML = '';
  const state: Record<string, number> = {};
  const choices: Record<string, string> = {};
  for (const f of fields) state[f.key] = f.value;
  for (const c of choiceFields) choices[c.key] = c.value;

  const emit = () => onChange({ values: { ...state }, choices: { ...choices } });

  // the shared `.control` wrapper with a `.row` holding the label; returns the
  // row so callers can append a value readout / select / etc.
  const makeControl = (labelText: string, controlType?: string) => {
    const wrap = document.createElement('label');
    const classes = ['control', 'control--' + (controlType ?? 'select')];
    wrap.classList.add(...classes);
    const row = document.createElement('span');
    row.classList.add('row');
    const labelEl = document.createElement('span');
    labelEl.textContent = labelText;
    row.appendChild(labelEl);
    wrap.appendChild(row);
    return { wrap, row };
  };

  // a labelled range slider with a live value readout
  const addRange = (fld: FieldSpec, onSet: (v: number) => void) => {
    const { wrap, row } = makeControl(fld.label, 'range');
    // a 0..360 slider is a hue slider — give its fill an OKLCH rainbow
    if (fld.min === 0 && fld.max === 360) wrap.classList.add('control--hue');
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(fld.min);
    input.max = String(fld.max);
    input.step = String(fld.step);
    input.value = String(fld.value);

    wrap.prepend(input); // before the row, regardless of makeControl's order

    const valueLabel = document.createElement('span');
    valueLabel.textContent = String(fld.value);
    valueLabel.classList.add('control__value');
    row.appendChild(valueLabel);

    const rel = (v: number) => String((v - fld.min) / (fld.max - fld.min));
    wrap.style.setProperty('--valueRel', rel(fld.value));

    input.addEventListener('input', () => {
      const v = Number(input.value);
      onSet(v);
      valueLabel.textContent = input.value;
      wrap.style.setProperty('--valueRel', rel(v));
      emit();
    });

    host.appendChild(wrap);
  };

  const addSelect = (
    label: string,
    options: readonly string[],
    current: string,
    onSet: (v: string) => void,
    describe?: Record<string, string>,
  ) => {
    const { wrap } = makeControl(label);
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
      hint.classList.add('control__hint');
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

  // numeric parameters
  for (const f of fields) addRange(f, (v) => (state[f.key] = v));

  // per-tab choice fields (e.g. easings)
  for (const c of choiceFields) {
    addSelect(c.label, c.options, c.value, (v) => (choices[c.key] = v));
  }

  emit();
}
