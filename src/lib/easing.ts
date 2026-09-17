// cubicBezier(x1, y1, x2, y2): a CSS-style easing, meant for lEasing. The
// y handles are clamped to [0, 1], which makes the curve monotone by
// construction (the Bézier's y is then non-decreasing in t, and x is
// non-decreasing whenever x1, x2 ∈ [0, 1]) — so a value straight out of a
// curve editor can never reorder the ramp.
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const cx1 = Math.min(1, Math.max(0, x1));
  const cx2 = Math.min(1, Math.max(0, x2));
  const cy1 = Math.min(1, Math.max(0, y1));
  const cy2 = Math.min(1, Math.max(0, y2));
  const bz = (a: number, b: number, u: number) => 3 * (1 - u) * (1 - u) * u * a + 3 * (1 - u) * u * u * b + u * u * u;
  return (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    // invert x(u) = t by bisection (x is monotone on [0, 1])
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (bz(cx1, cx2, mid) < t) lo = mid;
      else hi = mid;
    }
    return bz(cy1, cy2, (lo + hi) / 2);
  };
}
