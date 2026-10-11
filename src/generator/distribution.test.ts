import { describe, expect, it } from 'vitest';
import { ringSketch } from '../testing/shapes.ts';
import { Biome } from './biome.ts';
import {
  measureDistribution,
  normalizeDistribution,
  PEAK_SHARE,
  type TerrainDistribution,
  type TerrainShares,
} from './distribution.ts';
import { TERRAIN_KINDS, type TerrainHint } from './hints.ts';
import { generateMap } from './index.ts';

const W = 150;
const H = 100;
const CENTER = (H / 2) * W + W / 2;
const NONE: TerrainShares = { mountains: 0, forest: 0, desert: 0, swamp: 0, plains: 0 };

/** A distribution from percentages, the way the UI builds it. */
const shares = (percent: Partial<TerrainShares>, snow = 0): TerrainDistribution => ({
  shares: { ...NONE, ...percent },
  snow: snow / 100,
});

const generate = (distribution: TerrainDistribution | null, hints: TerrainHint[] = [], seed = 'aldoria') =>
  generateMap(ringSketch(W, H, 38), W, H, seed, { distribution, hints })!;

const count = (biome: Uint8Array, wanted: number) => biome.reduce((n, b) => n + (b === wanted ? 1 : 0), 0);

describe('normalizeDistribution', () => {
  it('scales shares to add up to 1, keeping their proportions', () => {
    const normalized = normalizeDistribution(shares({ forest: 30, plains: 90 }))!;
    expect(normalized.shares.forest).toBeCloseTo(0.25);
    expect(normalized.shares.plains).toBeCloseTo(0.75);
    expect(normalized.shares.desert).toBe(0);
  });

  it('treats negative shares as zero', () => {
    expect(normalizeDistribution(shares({ forest: -5, plains: 10 }))!.shares.plains).toBe(1);
  });

  it('leaves snow out of the scaling and limits it to 0..1', () => {
    expect(normalizeDistribution({ shares: { ...NONE, plains: 7 }, snow: 0.4 })!.snow).toBe(0.4);
    expect(normalizeDistribution({ shares: { ...NONE, plains: 7 }, snow: 3 })!.snow).toBe(1);
    expect(normalizeDistribution({ shares: { ...NONE, plains: 7 }, snow: -1 })!.snow).toBe(0);
  });

  it('returns null when every share is zero', () => {
    expect(normalizeDistribution(shares({}, 50))).toBeNull();
  });
});

describe('measureDistribution', () => {
  it('reports the share of land per terrain and under snow, ignoring water', () => {
    const biome = Uint8Array.from([
      Biome.Water,
      Biome.Water,
      Biome.Mountains,
      Biome.Hills,
      Biome.Forest,
      Biome.Taiga,
      Biome.Desert,
      Biome.Swamp,
      Biome.Plains,
      Biome.Plains,
    ]);
    const snow = Uint8Array.from([0, 0, 1, 0, 0, 1, 0, 0, 0, 0]);
    expect(measureDistribution(biome, snow)).toEqual({
      shares: { mountains: 0.25, forest: 0.25, desert: 0.125, swamp: 0.125, plains: 0.25 },
      snow: 0.25,
    });
  });

  it('is all zeros for a map with no land', () => {
    expect(measureDistribution(new Uint8Array(8), new Uint8Array(8))).toEqual({ shares: NONE, snow: 0 });
  });
});

describe('generateMap with a terrain distribution', () => {
  const targets: [TerrainShares, number][] = [
    [{ mountains: 20, forest: 35, desert: 10, swamp: 5, plains: 30 }, 15],
    [{ mountains: 5, forest: 5, desert: 60, swamp: 0, plains: 30 }, 0],
    [{ mountains: 50, forest: 20, desert: 0, swamp: 10, plains: 20 }, 60],
  ];

  for (const [target, snow] of targets) {
    it(`covers the land in the requested shares (${Object.values(target).join('/')}, snow ${snow})`, () => {
      for (const seed of ['aldoria', 'another']) {
        const { distribution } = generate({ shares: target, snow: snow / 100 }, [], seed);
        for (const kind of TERRAIN_KINDS) {
          expect(distribution.shares[kind]).toBeCloseTo(target[kind] / 100, 1.7);
        }
        expect(distribution.snow).toBeCloseTo(snow / 100, 1.7);
      }
    });
  }

  it('reports terrain shares that add up to 1, with or without a target', () => {
    for (const map of [generate(null), generate(shares(targets[0][0], 15))]) {
      const total = TERRAIN_KINDS.reduce((sum, kind) => sum + map.distribution.shares[kind], 0);
      expect(total).toBeCloseTo(1);
    }
  });

  it('leaves out terrains set to zero', () => {
    const map = generate(shares({ forest: 50, plains: 50 }));
    for (const absent of [Biome.Mountains, Biome.Hills, Biome.Desert, Biome.Swamp]) {
      expect(count(map.biome, absent)).toBe(0);
    }
    expect(map.distribution.snow).toBe(0);
  });

  it('can make the whole land a single terrain', () => {
    expect(generate(shares({ desert: 1 })).distribution.shares.desert).toBe(1);
    expect(generate(shares({ mountains: 1 })).distribution.shares.mountains).toBe(1);
  });

  it('splits the mountain share between peaks and foothills', () => {
    const map = generate(shares({ mountains: 40, plains: 60 }));
    const peaks = count(map.biome, Biome.Mountains);
    const foothills = count(map.biome, Biome.Hills);
    expect(peaks / (peaks + foothills)).toBeCloseTo(PEAK_SHARE, 1);
    expect(map.mountainLevel).toBeGreaterThan(map.hillLevel);
  });

  it('puts mountains on the highest ground and snow in the coldest places', () => {
    const natural = generate(null);
    const map = generate(shares({ mountains: 20, plains: 80 }, 25));
    let lowestPeak = 1;
    let highestPlain = 0;
    let warmestSnow = 0;
    let coldestBare = 1;
    for (let i = 0; i < W * H; i++) {
      if (map.biome[i] === Biome.Water) continue;
      if (map.biome[i] === Biome.Mountains) lowestPeak = Math.min(lowestPeak, map.elevation[i]);
      if (map.biome[i] === Biome.Plains) highestPlain = Math.max(highestPlain, map.elevation[i]);
      if (map.snow[i]) warmestSnow = Math.max(warmestSnow, natural.temperature[i]);
      else coldestBare = Math.min(coldestBare, natural.temperature[i]);
    }
    expect(lowestPeak).toBeGreaterThan(highestPlain);
    expect(warmestSnow).toBeLessThanOrEqual(coldestBare);
  });

  it('changes only the terrain, never the coast, relief or rivers', () => {
    const natural = generate(null);
    const map = generate(shares(targets[0][0], 15));
    expect(map.field).toEqual(natural.field);
    expect(map.elevation).toEqual(natural.elevation);
    expect(map.rivers).toEqual(natural.rivers);
  });

  it('keeps moisture and temperature within 0..1', () => {
    const map = generate(shares(targets[0][0], 15));
    for (const layer of [map.moisture, map.temperature]) {
      for (const v of layer) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('serves painted areas first when that terrain has a share', () => {
    const hint: TerrainHint = { kind: 'desert', x: W / 2, y: H / 2 };
    const target = shares({ desert: 12, forest: 44, plains: 44 });
    for (const seed of ['aldoria', 'another', 'third']) {
      expect(generate(target, [hint], seed).biome[CENTER]).toBe(Biome.Desert);
    }
  });

  it('falls back to the natural terrain when every share is zero', () => {
    expect(generate(shares({}, 40)).biome).toEqual(generate(null).biome);
  });

  it('is deterministic', () => {
    const target = shares(targets[0][0], 15);
    expect(generate(target).biome).toEqual(generate(target).biome);
    expect(generate(target).snow).toEqual(generate(target).snow);
  });
});

describe('snow as a cover over the terrain', () => {
  const snowed = (map: { biome: Uint8Array; snow: Uint8Array }, wanted: number[]) =>
    map.biome.reduce((n, b, i) => n + (map.snow[i] && wanted.includes(b) ? 1 : 0), 0);

  it('lies on mountains, forest and plains without replacing them', () => {
    const bare = generate(shares({ mountains: 30, forest: 35, plains: 35 }));
    const white = generate(shares({ mountains: 30, forest: 35, plains: 35 }, 100));
    expect(white.distribution.snow).toBe(1);
    expect(white.distribution.shares).toEqual(bare.distribution.shares);
    expect(snowed(white, [Biome.Mountains, Biome.Hills])).toBeGreaterThan(0);
    expect(snowed(white, [Biome.Plains])).toBeGreaterThan(0);
  });

  it('turns forest under snow into pine forest', () => {
    const map = generate(shares({ forest: 50, plains: 50 }, 100));
    expect(count(map.biome, Biome.Forest)).toBe(0);
    expect(count(map.biome, Biome.Taiga)).toBeGreaterThan(0);
  });

  it('never lies on swamp or desert, in any mode', () => {
    const maps = [
      generate(null),
      generate(null, [{ kind: 'snow', x: W / 2, y: H / 2 }]),
      generate(shares({ swamp: 30, desert: 30, plains: 40 }, 50)),
      generate(shares({ swamp: 50, desert: 50 }, 100)),
    ];
    for (const map of maps) expect(snowed(map, [Biome.Swamp, Biome.Desert])).toBe(0);
  });

  it('gives way when swamp and desert need the cold ground', () => {
    const map = generate(shares({ swamp: 50, desert: 50 }, 100));
    expect(map.distribution.snow).toBe(0);
    expect(map.distribution.shares.swamp).toBeCloseTo(0.5, 1.7);
  });

  it('keeps swamp and desert on the warm ground when there is room for both', () => {
    const map = generate(shares({ swamp: 15, desert: 15, forest: 30, plains: 40 }, 40));
    expect(map.distribution.snow).toBeCloseTo(0.4, 1.7);
    expect(map.distribution.shares.swamp).toBeCloseTo(0.15, 1.7);
    expect(map.distribution.shares.desert).toBeCloseTo(0.15, 1.7);
  });
});
