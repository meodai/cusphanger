export type Easing = (t: number) => number;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

export const linear: Easing = (t) => t;

export const power =
  (exp: number): Easing =>
  (t) =>
    Math.pow(t, exp);

export const sine: Easing = (t) => Math.sin((t * Math.PI) / 2);

// superellipse-style easing; n=2 is a quarter circle, higher n is sharper
export const lame =
  (n: number): Easing =>
  (t) =>
    1 - Math.pow(1 - Math.pow(clamp01(t), n), 1 / n);

// symmetric peak: 0 at t=0 and t=1, 1 at t=peak (parabolic on each side)
export const hump =
  (peak = 0.5): Easing =>
  (t) => {
    const p = clamp01(peak);
    if (t <= p) {
      if (p === 0) return 1;
      const x = t / p;
      return 1 - (1 - x) * (1 - x);
    }
    const x = (t - p) / (1 - p);
    return 1 - x * x;
  };
