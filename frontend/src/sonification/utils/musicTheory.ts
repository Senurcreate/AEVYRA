export const SCALES = {
  D_LYDIAN: ['D3','E3','F#3','G#3','A3','B3','C#4','D4','E4','F#4','G#4','A4','B4','D5'],
  C_DORIAN: ['C3','D3','Eb3','F3','G3','A3','Bb3','C4','D4','Eb4','F4','G4','A4','C5'],
} as const;
export function clamp(value: number, min = 0, max = 1): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}
export function lerp(a: number, b: number, t: number): number { return a + (b-a)*clamp(t); }
export function expScale(t: number, low: number, high: number): number {
  if (!(low > 0 && high > low)) throw new Error('Invalid exponential scale bounds');
  return low * Math.pow(high / low, clamp(t));
}
export function quantizeToScale(t: number, notes: readonly string[]): string {
  if (!notes.length) throw new Error('Musical scale must not be empty');
  return notes[Math.min(notes.length-1, Math.floor(clamp(t)*notes.length))];
}
export function smoothstep(t: number): number { const x=clamp(t); return x*x*(3-2*x); }
/** Deterministic pseudo-random number in [0,1), with a 32-bit seed. */
export function seededUnit(seed: number): number {
  let x = seed | 0;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  return (x >>> 0) / 4294967296;
} 