declare module 'culori' {
  export interface Oklch { mode: 'oklch'; l: number; c: number; h?: number; alpha?: number }
  export interface P3 { mode: 'p3'; r: number; g: number; b: number; alpha?: number }
  export interface Rgb { mode: 'rgb'; r: number; g: number; b: number; alpha?: number }
  export type Color = Oklch | P3 | Rgb | { mode: string; [k: string]: unknown };

  export function clampChroma(color: Color | string, mode?: string, rgbGamut?: string): Oklch;
  export function inGamut(mode?: string): (color: Color | string) => boolean;
  export function toGamut(dest?: string, mode?: string, delta?: unknown, jnd?: number): (color: Color | string) => Color;
  export function formatHex(color: Color | string): string;
  export function formatCss(color: Color | string): string;
  export function wcagContrast(a: Color | string, b: Color | string): number;
  export function converter(mode: string): (color: Color | string) => Color;
}
