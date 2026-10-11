import { describe, expect, it } from 'vitest';
import { ringSketch } from '../testing/shapes.ts';
import { Biome } from './biome.ts';
import {
  measureDistribution,
  normalizeDistribution,
  PEAK_SHARE,
  retarget,
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

describe('painting on a map with a distribution', () => {
  const at = (kind: TerrainHint['kind']): TerrainHint => ({ kind, x: W / 2, y: H / 2 });
  const SEEDS = ['aldoria', 'another', 'third'];
  /** Cells well outside the reach of a dab painted at the center. */
  const farFromPaint = (i: number) => Math.hypot((i % W) - W / 2, Math.floor(i / W) - H / 2) > 40;

  it('keeps a painted terrain even when its share is zero', () => {
    for (const seed of SEEDS) {
      const map = generate(shares({ forest: 50, plains: 50 }), [at('desert')], seed);
      expect(map.biome[CENTER]).toBe(Biome.Desert);
      expect(map.distribution.shares.desert).toBeGreaterThan(0);
    }
  });

  it('adds painted snow on top of the snow target instead of taking it from elsewhere', () => {
    for (const seed of SEEDS) {
      const target = shares({ forest: 50, plains: 50 }, 20);
      const before = generate(target, [], seed);
      const after = generate(target, [{ kind: 'snow', x: W / 2, y: H / 2 + 20 }], seed);
      expect(after.distribution.snow).toBeGreaterThan(before.distribution.snow + 0.03);
      for (let i = 0; i < W * H; i++) if (before.snow[i]) expect(after.snow[i]).toBe(1);
    }
  });

  it('keeps painted snow when the target has no snow at all', () => {
    const map = generate(shares({ plains: 1 }), [at('snow')]);
    expect(map.snow[CENTER]).toBe(1);
    expect(map.distribution.snow).toBeGreaterThan(0);
  });

  it('changes nothing outside the painted area', () => {
    const target = shares({ mountains: 20, forest: 30, desert: 10, swamp: 10, plains: 30 }, 20);
    for (const kind of ['snow', 'desert', 'swamp', 'forest', 'plains'] as const) {
      const before = generate(target);
      const after = generate(target, [at(kind)]);
      for (let i = 0; i < W * H; i++) {
        if (!farFromPaint(i)) continue;
        expect(after.biome[i]).toBe(before.biome[i]);
        expect(after.snow[i]).toBe(before.snow[i]);
      }
    }
  });

  it('keeps painted mountains when the mountain share is zero', () => {
    for (const seed of SEEDS) {
      const map = generate(shares({ plains: 1 }), [at('mountains')], seed);
      expect(map.biome[CENTER]).toBe(Biome.Mountains);
      expect(map.mountainLevel).toBeLessThanOrEqual(1);
    }
  });

  it('keeps painted lowland where the shares would put mountains', () => {
    for (const seed of SEEDS) {
      expect(generate(shares({ mountains: 1 }), [at('plains')], seed).biome[CENTER]).toBe(Biome.Plains);
      expect(generate(shares({ mountains: 1 }), [at('swamp')], seed).biome[CENTER]).toBe(Biome.Swamp);
    }
  });

  it('keeps painted snow clear of swamp and desert even when they are the only terrains', () => {
    for (const seed of SEEDS) {
      const map = generate(shares({ swamp: 50, desert: 50 }), [at('snow')], seed);
      expect(map.snow[CENTER]).toBe(1);
      expect([Biome.Swamp, Biome.Desert]).not.toContain(map.biome[CENTER]);
    }
  });

  it('lets the last of snow and swamp painted on a spot take it', () => {
    const target = shares({ forest: 50, plains: 50 }, 30);
    const snowLast = generate(target, [at('swamp'), at('snow')]);
    expect(snowLast.snow[CENTER]).toBe(1);
    expect(snowLast.biome[CENTER]).not.toBe(Biome.Swamp);
    const swampLast = generate(target, [at('snow'), at('swamp')]);
    expect(swampLast.snow[CENTER]).toBe(0);
    expect(swampLast.biome[CENTER]).toBe(Biome.Swamp);
  });

  it('lets painted snow share a spot with painted forest and mountains', () => {
    const target = shares({ plains: 1 });
    const forest = generate(target, [at('forest'), at('snow')]);
    expect(forest.biome[CENTER]).toBe(Biome.Taiga);
    expect(forest.snow[CENTER]).toBe(1);
    const peak = generate(target, [at('snow'), at('mountains')]);
    expect(peak.biome[CENTER]).toBe(Biome.Mountains);
    expect(peak.snow[CENTER]).toBe(1);
  });

  it('leaves no land without a terrain', () => {
    const map = generate(shares({ swamp: 50, desert: 50 }, 100), [
      at('snow'),
      { kind: 'mountains', x: 60, y: 40 },
    ]);
    for (let i = 0; i < W * H; i++) expect(map.biome[i] === Biome.Water).toBe(map.field[i] <= 0);
  });
});

describe('retarget', () => {
  const fractions = (percent: Partial<TerrainShares>, snow = 0): TerrainDistribution => {
    const d = shares(percent, snow);
    for (const kind of TERRAIN_KINDS) d.shares[kind] /= 100;
    return d;
  };
  const target = fractions({ forest: 50, plains: 50 }, 20);
  // What the panel showed after the user painted a lot of snow and some desert.
  const shown = fractions({ forest: 46, plains: 44, desert: 10 }, 35);

  const expectSame = (actual: TerrainDistribution, wanted: TerrainDistribution) => {
    for (const kind of TERRAIN_KINDS) expect(actual.shares[kind]).toBeCloseTo(wanted.shares[kind]);
    expect(actual.snow).toBeCloseTo(wanted.snow);
  };

  it('leaves the target alone when the user edits nothing', () => {
    expectSame(retarget(target, shown, shown), target);
  });

  it('moves the target by exactly what the user changed', () => {
    const edited = fractions({ forest: 46, plains: 44, desert: 10 }, 50);
    const next = retarget(target, shown, edited);
    expectSame(next, { shares: target.shares, snow: 0.35 });
  });

  it('applies changes to terrain shares the same way', () => {
    const edited = fractions({ forest: 26, plains: 44, desert: 10, swamp: 20 }, 35);
    const next = retarget(target, shown, edited);
    expect(next.shares.forest).toBeCloseTo(0.3);
    expect(next.shares.swamp).toBeCloseTo(0.2);
    expect(next.shares.plains).toBeCloseTo(0.5);
    expect(next.snow).toBeCloseTo(0.2);
  });

  it('never goes below zero or above full snow', () => {
    const next = retarget(target, shown, fractions({ plains: 100 }, 100));
    expect(next.shares.forest).toBeCloseTo(0.04);
    expect(next.shares.desert).toBe(0);
    expect(next.snow).toBeCloseTo(0.85);
    expect(retarget(target, shown, fractions({ plains: 100 }, 0)).snow).toBe(0);
  });

  it('takes the edited values as they are when there was no target yet', () => {
    const edited = fractions({ desert: 70, plains: 30 }, 10);
    expect(retarget(null, shown, edited)).toEqual(edited);
  });
});
