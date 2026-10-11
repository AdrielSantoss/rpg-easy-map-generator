import { describe, expect, it } from 'vitest';
import { boxBlur, chamferDistance, clamp, percentile, sstep } from './grid.ts';

describe('clamp', () => {
  it('limits values to the range', () => {
    expect(clamp(-1, 0, 1)).toBe(0);
    expect(clamp(0.4, 0, 1)).toBe(0.4);
    expect(clamp(3, 0, 1)).toBe(1);
  });
});

describe('sstep', () => {
  it('rises from 0 to 1 between the edges', () => {
    expect(sstep(2, 4, 1)).toBe(0);
    expect(sstep(2, 4, 3)).toBe(0.5);
    expect(sstep(2, 4, 5)).toBe(1);
  });

  it('falls when the edges are reversed', () => {
    expect(sstep(4, 2, 1)).toBe(1);
    expect(sstep(4, 2, 3)).toBe(0.5);
    expect(sstep(4, 2, 5)).toBe(0);
  });
});

describe('chamferDistance', () => {
  const w = 21;
  const h = 21;
  const at = (x: number, y: number) => y * w + x;

  it('measures straight and diagonal distance from a single source', () => {
    const source = new Uint8Array(w * h);
    source[at(10, 10)] = 1;
    const dist = chamferDistance(source, w, h);
    expect(dist[at(10, 10)]).toBe(0);
    expect(dist[at(13, 10)]).toBeCloseTo(3);
    expect(dist[at(10, 4)]).toBeCloseTo(6);
    expect(dist[at(12, 12)]).toBeCloseTo(2 * Math.SQRT2);
    expect(dist[at(0, 0)]).toBeCloseTo(10 * Math.SQRT2);
  });

  it('uses the nearest of several sources', () => {
    const source = new Uint8Array(w * h);
    source[at(0, 5)] = 1;
    source[at(20, 5)] = 1;
    const dist = chamferDistance(source, w, h);
    expect(dist[at(3, 5)]).toBeCloseTo(3);
    expect(dist[at(18, 5)]).toBeCloseTo(2);
  });

  it('stays huge everywhere when there is no source', () => {
    const dist = chamferDistance(new Uint8Array(w * h), w, h);
    expect(Math.min(...dist)).toBeGreaterThan(1e8);
  });
});

describe('boxBlur', () => {
  const w = 9;
  const h = 7;

  it('leaves a uniform grid unchanged', () => {
    const blurred = boxBlur(new Float32Array(w * h).fill(0.4), w, h, 2);
    for (const v of blurred) expect(v).toBeCloseTo(0.4);
  });

  it('spreads a single value evenly over its neighborhood', () => {
    const values = new Float32Array(w * h);
    values[3 * w + 4] = 9;
    const blurred = boxBlur(values, w, h, 1);
    expect(blurred[3 * w + 4]).toBeCloseTo(1);
    expect(blurred[2 * w + 3]).toBeCloseTo(1);
    expect(blurred[4 * w + 5]).toBeCloseTo(1);
    expect(blurred[3 * w + 6]).toBe(0);
    expect(blurred[5 * w + 4]).toBe(0);
  });

  it('does not modify its input', () => {
    const values = Float32Array.from({ length: w * h }, (_, i) => i % 5);
    const copy = values.slice();
    boxBlur(values, w, h, 2);
    expect(values).toEqual(copy);
  });
});

describe('percentile', () => {
  const sorted = Float32Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

  it('picks the value at the given fraction', () => {
    expect(percentile(sorted, 0)).toBe(1);
    expect(percentile(sorted, 0.5)).toBe(6);
    expect(percentile(sorted, 1)).toBe(10);
  });

  it('returns 0 for an empty list', () => {
    expect(percentile(new Float32Array(0), 0.5)).toBe(0);
  });
});
