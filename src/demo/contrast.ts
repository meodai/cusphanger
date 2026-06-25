import { wcagContrast } from 'culori';

export function wcag(a: string, b: string): number {
  return Math.round(wcagContrast(a, b) * 100) / 100;
}

function hexToRgb255(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

// APCA-W3 0.1.9
function sRGBtoY([r, g, b]: [number, number, number]): number {
  const lin = (v: number) => Math.pow(v / 255, 2.4);
  return 0.2126729 * lin(r) + 0.7151522 * lin(g) + 0.072175 * lin(b);
}

export function apca(textHex: string, bgHex: string): number {
  const blkThrs = 0.022;
  const blkClmp = 1.414;
  const deltaYmin = 0.0005;
  const scale = 1.14;
  const loBoWoffset = 0.027;
  const loWoBoffset = 0.027;

  let txtY = sRGBtoY(hexToRgb255(textHex));
  let bgY = sRGBtoY(hexToRgb255(bgHex));

  txtY = txtY > blkThrs ? txtY : txtY + Math.pow(blkThrs - txtY, blkClmp);
  bgY = bgY > blkThrs ? bgY : bgY + Math.pow(blkThrs - bgY, blkClmp);

  if (Math.abs(bgY - txtY) < deltaYmin) return 0;

  let outputContrast: number;
  if (bgY > txtY) {
    const sapc = (Math.pow(bgY, 0.56) - Math.pow(txtY, 0.57)) * scale;
    outputContrast = sapc < 0.001 ? 0 : sapc - loBoWoffset;
  } else {
    const sapc = (Math.pow(bgY, 0.65) - Math.pow(txtY, 0.62)) * scale;
    outputContrast = sapc > -0.001 ? 0 : sapc + loWoBoffset;
  }
  return Math.round(outputContrast * 100 * 10) / 10;
}
