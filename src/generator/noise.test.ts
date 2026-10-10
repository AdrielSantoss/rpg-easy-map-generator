import { describe, expect, it } from 'vitest';
import { createNoise2D, fbm, ridged } from './noise.ts';
import { seededRng } from './rng.ts';

/** Sample points spread over a wide area, off the lattice. */
const SAMPLES = Array.from({ length: 2000 }, (_, i) => [i * 0.173 - 90, i * 0.291 + 13] as const);

describe('createNoise2D', () => {
  it('is deterministic for a given seed', () => {
    const a = createNoise2D(seededRng('seed'));
    const b = createNoise2D(seededRng('seed'));
    for (const [x, y] of SAMPLES.slice(0, 50)) expect(a(x, y)).toBe(b(x, y));
  });

  it('changes with the seed', () => {
    const a = createNoise2D(seededRng('seed'));
    const b = createNoise2D(seededRng('other'));
    expect(SAMPLES.some(([x, y]) => a(x, y) !== b(x, y))).toBe(true);
  });

  it('stays roughly within [-1, 1] and actually varies', () => {
    const noise = createNoise2D(seededRng('range'));
    const values = SAMPLES.map(([x, y]) => noise(x, y));
    expect(Math.max(...values)).toBeLessThanOrEqual(1.05);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(-1.05);
    expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(1);
  });
});

describe('fbm', () => {
  it('stays roughly within [-1, 1]', () => {
    const noise = createNoise2D(seededRng('fbm'));
    for (const [x, y] of SAMPLES) expect(Math.abs(fbm(noise, x, y, 5))).toBeLessThanOrEqual(1.05);
  });
});

describe('ridged', () => {
  it('stays within [0, 1]', () => {
    const noise = createNoise2D(seededRng('ridged'));
    for (const [x, y] of SAMPLES) {
      const v = ridged(noise, x, y, 4);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});
