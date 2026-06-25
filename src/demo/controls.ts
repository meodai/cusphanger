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
  gamut: 'srgb' | 'display-p3',
  onChange: (values: Record<string, number>, gamut: 'srgb' | 'display-p3') => void,
): void {
  host.innerHTML = '';
  const state: Record<string, number> = {};
  let gamutState = gamut;
  for (const f of fields) state[f.key] = f.value;

  const emit = () => onChange({ ...state }, gamutState);

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

  const gWrap = document.createElement('label');
  gWrap.className = 'control';
  gWrap.innerHTML = '<span class="row"><span>gamut</span></span>';
  const select = document.createElement('select');
  for (const g of ['srgb', 'display-p3'] as const) {
    const opt = document.createElement('option');
    opt.value = g;
    opt.textContent = g;
    if (g === gamut) opt.selected = true;
    select.appendChild(opt);
  }
  select.addEventListener('change', () => {
    gamutState = select.value as 'srgb' | 'display-p3';
    emit();
  });
  gWrap.appendChild(select);
  host.appendChild(gWrap);

  emit();
}
