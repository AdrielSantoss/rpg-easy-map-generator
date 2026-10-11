import { describe, expect, it } from 'vitest';
import { ringSketch } from '../testing/shapes.ts';
import {
  BRUSH_KINDS,
  HINT_RADIUS,
  hintAt,
  hintCoreRadius,
  hintRadius,
  hintWeight,
  TERRAIN_KINDS,
  type BrushKind,
  type TerrainHint,
  type TerrainKind,
} from './hints.ts';
import { Biome, generateMap } from './index.ts';

const W = 150;
const H = 100;
const CX = W / 2;
const CY = H / 2;
const CENTER = CY * W + CX;
const flat = () => 0;

const generate = (hints: TerrainHint[], seed = 'aldoria') =>
  generateMap(ringSketch(W, H, 38), W, H, seed, { hints })!;
const hintAtCenter = (kind: BrushKind): TerrainHint => ({ kind, x: CX, y: CY });
const SEEDS = ['aldoria', 'another', 'third'];

describe('hintWeight', () => {
  const hint = hintAtCenter('forest');

  it('is full strength at the center and gone past the radius', () => {
    expect(hintWeight(hint, CX, CY, flat)).toBe(1);
    expect(hintWeight(hint, CX + HINT_RADIUS + 1, CY, flat)).toBe(0);
  });

  it('fades with distance', () => {
    const near = hintWeight(hint, CX + 16, CY, flat);
    const far = hintWeight(hint, CX + 24, CY, flat);
    expect(near).toBeLessThan(1);
    expect(far).toBeGreaterThan(0);
    expect(far).toBeLessThan(near);
  });
});

describe('brush size', () => {
  const small = { ...hintAtCenter('forest'), radius: 10 };
  const large = { ...hintAtCenter('forest'), radius: 60 };
  const deserts = (hints: TerrainHint[]) =>
    generate(hints).biome.reduce((n, b) => n + (b === Biome.Desert ? 1 : 0), 0);

  it('sets how far a dab reaches', () => {
    expect(hintWeight(small, CX + 12, CY, flat)).toBe(0);
    expect(hintWeight(large, CX + 12, CY, flat)).toBe(1);
    expect(hintWeight(large, CX + 61, CY, flat)).toBe(0);
    expect(hintRadius(hintAtCenter('forest'))).toBe(HINT_RADIUS);
  });

  it('paints more ground with a larger brush', () => {
    const painted = (radius: number) => deserts([{ kind: 'desert', x: CX, y: CY, radius }]);
    expect(painted(10)).toBeGreaterThan(deserts([]));
    expect(painted(30)).toBeGreaterThan(painted(10) * 3);
  });

  it('keeps a small dab small: ground beyond its reach is untouched', () => {
    const map = generate([{ kind: 'desert', x: CX, y: CY, radius: 10 }]);
    const natural = generate([]);
    expect(map.biome[CENTER]).toBe(Biome.Desert);
    expect(map.biome[CENTER + 20]).toBe(natural.biome[CENTER + 20]);
  });

  it('decides how close a click must be to pick the dab', () => {
    expect(hintAt([small], CX + 12, CY)).toBeNull();
    expect(hintAt([large], CX + 40, CY)).toBe(large);
    expect(hintCoreRadius(large)).toBeGreaterThan(hintCoreRadius(small));
  });
});

describe('hintAt', () => {
  const forest: TerrainHint = { kind: 'forest', x: 40, y: 40 };
  const desert: TerrainHint = { kind: 'desert', x: 48, y: 40 };

  it('picks the hint under the click, preferring the nearest', () => {
    expect(hintAt([forest, desert], 41, 41)).toBe(forest);
    expect(hintAt([forest, desert], 45, 40)).toBe(desert);
  });

  it('picks a hint clicked anywhere on the area it covers', () => {
    expect(hintAt([forest], 28, 52)).toBe(forest);
  });

  it('returns null away from every hint', () => {
    expect(hintAt([forest, desert], 80, 40)).toBeNull();
    expect(hintAt([], 40, 40)).toBeNull();
  });
});

describe('terrain hints', () => {
  const expected: Record<TerrainKind, number[]> = {
    mountains: [Biome.Mountains],
    forest: [Biome.Forest, Biome.Taiga],
    desert: [Biome.Desert],
    swamp: [Biome.Swamp],
    plains: [Biome.Plains],
  };

  for (const kind of TERRAIN_KINDS) {
    it(`turns the hinted spot into ${kind}, whatever the seed put there`, () => {
      for (const seed of SEEDS) {
        const map = generate([hintAtCenter(kind)], seed);
        expect(expected[kind]).toContain(map.biome[CENTER]);
      }
    });
  }

  it('covers the hinted spot with snow, whatever the seed put there', () => {
    for (const seed of SEEDS) expect(generate([hintAtCenter('snow')], seed).snow[CENTER]).toBe(1);
  });

  for (const [kind, biomes] of [
    ['mountains', [Biome.Mountains]],
    ['forest', [Biome.Taiga]],
    ['plains', [Biome.Plains]],
  ] as const) {
    it(`lets snow and ${kind} share a spot, whichever was painted first`, () => {
      for (const seed of SEEDS) {
        for (const hints of [
          [hintAtCenter(kind), hintAtCenter('snow')],
          [hintAtCenter('snow'), hintAtCenter(kind)],
        ]) {
          const map = generate(hints, seed);
          expect(biomes).toContain(map.biome[CENTER]);
          expect(map.snow[CENTER]).toBe(1);
        }
      }
    });
  }

  for (const [kind, biome] of [
    ['swamp', Biome.Swamp],
    ['desert', Biome.Desert],
  ] as const) {
    it(`never mixes snow with ${kind}: whichever is painted last takes the spot`, () => {
      for (const seed of SEEDS) {
        const snowLast = generate([hintAtCenter(kind), hintAtCenter('snow')], seed);
        expect(snowLast.snow[CENTER]).toBe(1);
        expect(snowLast.biome[CENTER]).not.toBe(biome);

        const snowFirst = generate([hintAtCenter('snow'), hintAtCenter(kind)], seed);
        expect(snowFirst.snow[CENTER]).toBe(0);
        expect(snowFirst.biome[CENTER]).toBe(biome);
      }
    });
  }
  it('covers an area around the hint, not just one cell', () => {
    const map = generate([hintAtCenter('desert')]);
    for (const [dx, dy] of [
      [8, 0],
      [-8, 0],
      [0, 8],
      [0, -8],
    ]) {
      expect(map.biome[(CY + dy) * W + CX + dx]).toBe(Biome.Desert);
    }
  });

  it('lets the hint placed last win where two overlap', () => {
    expect(generate([hintAtCenter('forest'), hintAtCenter('desert')]).biome[CENTER]).toBe(Biome.Desert);
    expect(generate([hintAtCenter('desert'), hintAtCenter('mountains')]).biome[CENTER]).toBe(Biome.Mountains);
    expect(generate([hintAtCenter('mountains'), hintAtCenter('plains')]).biome[CENTER]).toBe(Biome.Plains);
  });

  it('never moves the coast', () => {
    const plain = generate([]);
    const hinted = generate(BRUSH_KINDS.map((kind, k) => ({ kind, x: 45 + k * 12, y: CY })));
    expect(hinted.field).toEqual(plain.field);
  });

  it('changes nothing when dropped far out at sea', () => {
    const plain = generate([]);
    const hinted = generate([{ kind: 'mountains', x: -80, y: -80 }]);
    expect(hinted.biome).toEqual(plain.biome);
    expect(hinted.elevation).toEqual(plain.elevation);
  });

  it('keeps layers within 0..1 and elevation at zero in the sea', () => {
    const map = generate(BRUSH_KINDS.map((kind, k) => ({ kind, x: 45 + k * 12, y: CY })));
    for (let i = 0; i < W * H; i++) {
      for (const layer of [map.elevation, map.moisture, map.temperature]) {
        expect(layer[i]).toBeGreaterThanOrEqual(0);
        expect(layer[i]).toBeLessThanOrEqual(1);
      }
      if (map.field[i] <= 0) expect(map.elevation[i]).toBe(0);
    }
  });

  it('is deterministic', () => {
    const hints = [hintAtCenter('swamp'), { kind: 'mountains', x: 60, y: 40 } as const];
    expect(generate(hints).biome).toEqual(generate(hints).biome);
  });
});
