// The rail's parameter controls: labelled range sliders (with the paper's
// symbols) and named-choice selects. The slider fill tracks --valueRel; a
// 0..360 slider is a hue slider and gets the OKLCH rainbow track.
export interface FieldSpec {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
}

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
  const values: Record<string, number> = {};
  const choices: Record<string, string> = {};
  for (const f of fields) values[f.key] = f.value;
  for (const c of choiceFields) choices[c.key] = c.value;

  const emit = () => onChange({ values: { ...values }, choices: { ...choices } });

  for (const f of fields) {
    const wrap = document.createElement('label');
    wrap.className = 'control control--range';
    if (f.min === 0 && f.max === 360) wrap.classList.add('control--hue');
    wrap.innerHTML = `
      <span class="control__row">
        <span class="control__label">${f.label}</span>
        <span class="control__value">${f.value}</span>
      </span>
      <span class="marks" aria-hidden="true"></span>`;
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(f.min);
    input.max = String(f.max);
    input.step = String(f.step);
    input.value = String(f.value);
    wrap.appendChild(input);

    const readout = wrap.querySelector('.control__value') as HTMLElement;
    const rel = (v: number) => String((v - f.min) / (f.max - f.min));
    wrap.style.setProperty('--valueRel', rel(f.value));

    input.addEventListener('input', () => {
      const v = Number(input.value);
      values[f.key] = v;
      readout.textContent = input.value;
      wrap.style.setProperty('--valueRel', rel(v));
      emit();
    });
    host.appendChild(wrap);
  }

  for (const c of choiceFields) {
    const wrap = document.createElement('label');
    wrap.className = 'control control--select';
    wrap.innerHTML = `<span class="control__row"><span class="control__label">${c.label}</span></span>`;
    const select = document.createElement('select');
    for (const o of c.options) {
      const opt = document.createElement('option');
      opt.value = o;
      opt.textContent = o;
      opt.selected = o === c.value;
      select.appendChild(opt);
    }
    select.addEventListener('change', () => {
      choices[c.key] = select.value;
      emit();
    });
    // the select sits in a relative box so its corner .marks can frame it
    const box = document.createElement('span');
    box.className = 'control__selectbox';
    box.appendChild(select);
    box.insertAdjacentHTML('beforeend', '<span class="marks" aria-hidden="true"></span>');
    wrap.appendChild(box);
    host.appendChild(wrap);
  }

  emit();
}
