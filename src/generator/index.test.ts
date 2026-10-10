import { describe, expect, it } from 'vitest';
import { ringSketch } from '../testing/shapes.ts';
import { Biome, generateMap } from './index.ts';

const W = 150;
const H = 100;
const sketch = () => ringSketch(W, H, 38);

describe('generateMap', () => {
  it('returns null when the sketch encloses no land', () => {
    expect(generateMap(new Uint8Array(W * H), W, H, 'seed')).toBeNull();
  });

  it('gives the same map for the same sketch and seed', () => {
    const a = generateMap(sketch(), W, H, 'aldoria')!;
    const b = generateMap(sketch(), W, H, 'aldoria')!;
    expect(a.field).toEqual(b.field);
    expect(a.elevation).toEqual(b.elevation);
    expect(a.biome).toEqual(b.biome);
    expect(a.rivers).toEqual(b.rivers);
  });

  it('gives a different map for a different seed', () => {
    const a = generateMap(sketch(), W, H, 'aldoria')!;
    const b = generateMap(sketch(), W, H, 'another')!;
    expect(a.elevation).not.toEqual(b.elevation);
  });

  it('keeps the drawn shape: land in the middle, sea at the edges', () => {
    const map = generateMap(sketch(), W, H, 'aldoria')!;
    expect(map.field[(H / 2) * W + W / 2]).toBeGreaterThan(0);
    for (let x = 0; x < W; x++) {
      expect(map.field[x]).toBeLessThan(0);
      expect(map.field[(H - 1) * W + x]).toBeLessThan(0);
    }
  });

  it('marks exactly the cells outside the coast as water', () => {
    const map = generateMap(sketch(), W, H, 'aldoria')!;
    for (let i = 0; i < W * H; i++) {
      expect(map.biome[i] === Biome.Water).toBe(map.field[i] <= 0);
    }
  });

  it('keeps elevation, moisture and temperature within 0..1', () => {
    const map = generateMap(sketch(), W, H, 'aldoria')!;
    for (const layer of [map.elevation, map.moisture, map.temperature]) {
      for (const v of layer) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('has no elevation at sea and reaches the top somewhere on land', () => {
    const map = generateMap(sketch(), W, H, 'aldoria')!;
    let max = 0;
    for (let i = 0; i < W * H; i++) {
      if (map.field[i] <= 0) expect(map.elevation[i]).toBe(0);
      max = Math.max(max, map.elevation[i]);
    }
    expect(max).toBe(1);
  });

  it('places mountains only at or above the mountain level', () => {
    const map = generateMap(sketch(), W, H, 'aldoria')!;
    expect(map.mountainLevel).toBeGreaterThan(map.hillLevel);
    let mountains = 0;
    for (let i = 0; i < W * H; i++) {
      if (map.biome[i] !== Biome.Mountains) continue;
      mountains++;
      expect(map.elevation[i]).toBeGreaterThanOrEqual(map.mountainLevel);
    }
    expect(mountains).toBeGreaterThan(0);
  });
});
