// TEMP — live tuning panel for the xerox heavy-noise layer; remove when the
// values are settled. Sits outside #app so it never gets ghosted. Every change
// regenerates the mask + CSS vars, shows the paste-ready settings, and logs
// them to the console (click the readout to copy).
import { noiseMaskSvg, type NoiseMaskOptions } from './xerox';

interface TunerState extends Required<NoiseMaskOptions> {
  blur: number; // heavy copy blur px
  opacity: number; // heavy copy opacity
  shiftX: number; // ghost misregistration offset px
  shiftY: number;
}

const DEFAULTS: TunerState = {
  size: 480,
  baseFrequency: 0.006,
  octaves: 4,
  seed: 99,
  gain: 1.65,
  threshold: 0.49,
  blur: 4,
  opacity: 1,
  shiftX: -3,
  shiftY: -4,
};

const FIELDS: Array<{ key: keyof TunerState; min: number; max: number; step: number }> = [
  { key: 'baseFrequency', min: 0.001, max: 0.04, step: 0.0005 },
  { key: 'octaves', min: 1, max: 6, step: 1 },
  { key: 'seed', min: 1, max: 99, step: 1 },
  { key: 'gain', min: 0.1, max: 3, step: 0.05 },
  { key: 'threshold', min: 0, max: 1, step: 0.01 },
  { key: 'size', min: 120, max: 900, step: 20 },
  { key: 'blur', min: 0, max: 100, step: 0.5 },
  { key: 'opacity', min: 0, max: 1, step: 0.05 },
  { key: 'shiftX', min: -30, max: 30, step: 0.5 },
  { key: 'shiftY', min: -30, max: 30, step: 0.5 },
];

function apply(s: TunerState): void {
  const { blur, opacity, shiftX, shiftY, ...noise } = s;
  const b = document.body.style;
  b.setProperty('--xerox-noise', noiseMaskSvg(noise));
  b.setProperty('--xerox-mask-size', `${s.size}px`);
  b.setProperty('--xerox-heavy-blur', `${blur}px`);
  b.setProperty('--xerox-heavy-opacity', `${opacity}`);
  b.setProperty('--xerox-shift-x', `${shiftX}px`);
  b.setProperty('--xerox-shift-y', `${shiftY}px`);
}

function settingsText(s: TunerState): string {
  const { blur, opacity, shiftX, shiftY, size, baseFrequency, octaves, seed, gain, threshold } = s;
  return (
    `initXerox(appEl, { size: ${size}, baseFrequency: ${baseFrequency}, ` +
    `octaves: ${octaves}, seed: ${seed}, gain: ${gain}, threshold: ${threshold} })\n` +
    `css: blur(${blur}px) opacity(${opacity}) shift(${shiftX}px, ${shiftY}px)`
  );
}

export function initXeroxTuner(): void {
  const state: TunerState = { ...DEFAULTS };
  const panel = document.createElement('div');
  panel.className = 'xerox-tuner';
  panel.innerHTML = `<strong>heavy noise (temp)</strong>`;

  const out = document.createElement('pre');
  out.className = 'xerox-tuner__out';
  out.title = 'click to copy';
  out.addEventListener('click', () => void navigator.clipboard.writeText(out.textContent ?? ''));

  const update = () => {
    apply(state);
    out.textContent = settingsText(state);
    console.log('[xerox-tuner]', settingsText(state));
  };

  for (const f of FIELDS) {
    const row = document.createElement('label');
    const val = document.createElement('output');
    val.textContent = String(state[f.key]);
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(f.min);
    input.max = String(f.max);
    input.step = String(f.step);
    input.value = String(state[f.key]);
    input.addEventListener('input', () => {
      state[f.key] = Number(input.value);
      val.textContent = input.value;
      update();
    });
    const name = document.createElement('span');
    name.textContent = f.key;
    row.append(name, input, val);
    panel.appendChild(row);
  }
  panel.appendChild(out);
  document.body.appendChild(panel);
  update();
}
