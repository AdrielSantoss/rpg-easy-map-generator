import type { Rng } from './rng.ts';

export type Noise2D = (x: number, y: number) => number;

const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;
const GRAD = [1, 1, -1, 1, 1, -1, -1, -1, 1, 0, -1, 0, 0, 1, 0, -1];

/** 2D simplex noise, roughly in [-1, 1]. */
export function createNoise2D(rng: Rng): Noise2D {
  const perm = new Uint8Array(512);
  for (let i = 0; i < 256; i++) perm[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = perm[i];
    perm[i] = perm[j];
    perm[j] = t;
  }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];

  const corner = (gi: number, x: number, y: number): number => {
    let t = 0.5 - x * x - y * y;
    if (t <= 0) return 0;
    const g = (gi & 7) * 2;
    t *= t;
    return t * t * (GRAD[g] * x + GRAD[g + 1] * y);
  };

  return (x, y) => {
    const s = (x + y) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const t = (i + j) * G2;
    const x0 = x - (i - t);
    const y0 = y - (j - t);
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = 1 - i1;
    const ii = i & 255;
    const jj = j & 255;
    const n =
      corner(perm[ii + perm[jj]], x0, y0) +
      corner(perm[ii + i1 + perm[jj + j1]], x0 - i1 + G2, y0 - j1 + G2) +
      corner(perm[ii + 1 + perm[jj + 1]], x0 - 1 + 2 * G2, y0 - 1 + 2 * G2);
    return 70 * n;
  };
}

/** Fractal noise, roughly in [-1, 1]. */
export function fbm(noise: Noise2D, x: number, y: number, octaves: number, gain = 0.5): number {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise(x * freq, y * freq);
    norm += amp;
    amp *= gain;
    freq *= 2;
  }
  return sum / norm;
}

/** Ridged fractal noise in [0, 1]; values near 1 form thin connected crests. */
export function ridged(noise: Noise2D, x: number, y: number, octaves: number): number {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    const r = 1 - Math.abs(noise(x * freq, y * freq));
    sum += amp * r * r;
    norm += amp;
    amp *= 0.5;
    freq *= 2.1;
  }
  return sum / norm;
}
