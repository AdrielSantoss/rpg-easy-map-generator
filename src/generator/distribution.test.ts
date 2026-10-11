import { describe, expect, it } from 'vitest';
import { ringSketch } from '../testing/shapes.ts';
import { Biome } from './biome.ts';
import {
  measureDistribution,
  normalizeDistribution,
  PEAK_SHARE,
  type TerrainDistribution,
} from './distribution.ts';
import { TERRAIN_KINDS, type TerrainHint } from './hints.ts';
import { generateMap } from './index.ts';

const W = 150;
const H = 100;
const NONE: TerrainDistribution = { mountains: 0, forest: 0, desert: 0, swamp: 0, tundra: 0, plains: 0 };

const generate = (distribution: TerrainDistribution | null, hints: TerrainHint[] = [], seed = 'aldoria') =>
  generateMap(ringSketch(W, H, 38), W, H, seed, { distribution, hints })!;

const count = (biome: Uint8Array, wanted: number) => biome.reduce((n, b) => n + (b === wanted ? 1 : 0), 0);

describe('normalizeDistribution', () => {
  it('scales shares to add up to 1, keeping their proportions', () => {
    const normalized = normalizeDistribution({ ...NONE, forest: 30, plains: 90 })!;
    expect(normalized.forest).toBeCloseTo(0.25);
    expect(normalized.plains).toBeCloseTo(0.75);
    expect(normalized.desert).toBe(0);
  });

  it('treats negative shares as zero', () => {
    expect(normalizeDistribution({ ...NONE, forest: -5, plains: 10 })!.plains).toBe(1);
  });

  it('returns null when every share is zero', () => {
    expect(normalizeDistribution(NONE)).toBeNull();
  });
});

describe('measureDistribution', () => {
  it('reports the share of land per terrain, ignoring water', () => {
    const biome = Uint8Array.from([
      Biome.Water,
      Biome.Water,
      Biome.Mountains,
      Biome.Hills,
      Biome.Forest,
      Biome.Taiga,
      Biome.Desert,
      Biome.Swamp,
      Biome.Tundra,
      Biome.Plains,
    ]);
    expect(measureDistribution(biome)).toEqual({
      mountains: 0.25,
      forest: 0.25,
      desert: 0.125,
      swamp: 0.125,
      tundra: 0.125,
      plains: 0.125,
    });
  });

  it('is all zeros for a map with no land', () => {
    expect(measureDistribution(new Uint8Array(8))).toEqual(NONE);
  });
});

describe('generateMap with a terrain distribution', () => {
  const targets: TerrainDistribution[] = [
    { mountains: 20, forest: 30, desert: 10, swamp: 5, tundra: 10, plains: 25 },
    { mountains: 5, forest: 5, desert: 60, swamp: 0, tundra: 0, plains: 30 },
    { mountains: 50, forest: 0, desert: 0, swamp: 10, tundra: 40, plains: 0 },
  ];

  for (const target of targets) {
    it(`covers the land in the requested shares (${Object.values(target).join('/')})`, () => {
      for (const seed of ['aldoria', 'another']) {
        const { distribution } = generate(target, [], seed);
        for (const kind of TERRAIN_KINDS) {
          expect(distribution[kind]).toBeCloseTo(target[kind] / 100, 1.7);
        }
      }
    });
  }

  it('reports shares that add up to 1, with or without a target', () => {
    for (const map of [generate(null), generate(targets[0])]) {
      const total = TERRAIN_KINDS.reduce((sum, kind) => sum + map.distribution[kind], 0);
      expect(total).toBeCloseTo(1);
    }
  });

  it('leaves out terrains set to zero', () => {
    const map = generate({ ...NONE, forest: 50, plains: 50 });
    for (const absent of [Biome.Mountains, Biome.Hills, Biome.Desert, Biome.Swamp, Biome.Tundra]) {
      expect(count(map.biome, absent)).toBe(0);
    }
  });

  it('can make the whole land a single terrain', () => {
    expect(generate({ ...NONE, desert: 1 }).distribution.desert).toBe(1);
    expect(generate({ ...NONE, mountains: 1 }).distribution.mountains).toBe(1);
  });

  it('splits the mountain share between peaks and foothills', () => {
    const map = generate({ ...NONE, mountains: 40, plains: 60 });
    const peaks = count(map.biome, Biome.Mountains);
    const foothills = count(map.biome, Biome.Hills);
    expect(peaks / (peaks + foothills)).toBeCloseTo(PEAK_SHARE, 1);
    expect(map.mountainLevel).toBeGreaterThan(map.hillLevel);
  });

  it('puts mountains on the highest ground and snow in the coldest places', () => {
    const natural = generate(null);
    const map = generate({ ...NONE, mountains: 20, tundra: 20, plains: 60 });
    let lowestPeak = 1;
    let highestPlain = 0;
    let warmestSnow = 0;
    let coldestPlain = 1;
    for (let i = 0; i < W * H; i++) {
      if (map.biome[i] === Biome.Mountains) lowestPeak = Math.min(lowestPeak, map.elevation[i]);
      if (map.biome[i] === Biome.Plains) highestPlain = Math.max(highestPlain, map.elevation[i]);
      if (map.biome[i] === Biome.Tundra) warmestSnow = Math.max(warmestSnow, natural.temperature[i]);
      if (map.biome[i] === Biome.Plains) coldestPlain = Math.min(coldestPlain, natural.temperature[i]);
    }
    expect(lowestPeak).toBeGreaterThan(highestPlain);
    expect(warmestSnow).toBeLessThanOrEqual(coldestPlain);
  });

  it('changes only the terrain, never the coast, relief or rivers', () => {
    const natural = generate(null);
    const map = generate(targets[0]);
    expect(map.field).toEqual(natural.field);
    expect(map.elevation).toEqual(natural.elevation);
    expect(map.rivers).toEqual(natural.rivers);
  });

  it('keeps moisture and temperature within 0..1', () => {
    const map = generate(targets[0]);
    for (const layer of [map.moisture, map.temperature]) {
      for (const v of layer) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('serves hinted areas first when that terrain has a share', () => {
    const center = (H / 2) * W + W / 2;
    const hint: TerrainHint = { kind: 'desert', x: W / 2, y: H / 2 };
    const target = { ...NONE, desert: 12, forest: 44, plains: 44 };
    for (const seed of ['aldoria', 'another', 'third']) {
      expect(generate(target, [hint], seed).biome[center]).toBe(Biome.Desert);
    }
  });

  it('falls back to the natural terrain when every share is zero', () => {
    expect(generate(NONE).biome).toEqual(generate(null).biome);
  });

  it('is deterministic', () => {
    expect(generate(targets[0]).biome).toEqual(generate(targets[0]).biome);
  });
});
