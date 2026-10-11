import { describe, expect, it } from 'vitest';
import { ringSketch } from '../testing/shapes.ts';
import {
  HINT_RADIUS,
  hintAt,
  hintWeight,
  TERRAIN_KINDS,
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
const hintAtCenter = (kind: TerrainKind): TerrainHint => ({ kind, x: CX, y: CY });

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

describe('hintAt', () => {
  const forest: TerrainHint = { kind: 'forest', x: 40, y: 40 };
  const desert: TerrainHint = { kind: 'desert', x: 48, y: 40 };

  it('picks the hint under the click, preferring the nearest', () => {
    expect(hintAt([forest, desert], 41, 41)).toBe(forest);
    expect(hintAt([forest, desert], 45, 40)).toBe(desert);
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
    // Snow keeps whatever relief is underneath, so it is checked by temperature below.
    tundra: [Biome.Tundra, Biome.Hills, Biome.Mountains],
  };

  for (const kind of TERRAIN_KINDS) {
    it(`turns the hinted spot into ${kind}, whatever the seed put there`, () => {
      for (const seed of ['aldoria', 'another', 'third']) {
        const map = generate([hintAtCenter(kind)], seed);
        expect(expected[kind]).toContain(map.biome[CENTER]);
      }
    });
  }

  it('makes the hinted spot freezing for tundra', () => {
    expect(generate([hintAtCenter('tundra')]).temperature[CENTER]).toBeLessThan(0.22);
  });

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
    const hinted = generate(TERRAIN_KINDS.map((kind, k) => ({ kind, x: 45 + k * 12, y: CY })));
    expect(hinted.field).toEqual(plain.field);
  });

  it('changes nothing when dropped far out at sea', () => {
    const plain = generate([]);
    const hinted = generate([{ kind: 'mountains', x: -80, y: -80 }]);
    expect(hinted.biome).toEqual(plain.biome);
    expect(hinted.elevation).toEqual(plain.elevation);
  });

  it('keeps layers within 0..1 and elevation at zero in the sea', () => {
    const map = generate(TERRAIN_KINDS.map((kind, k) => ({ kind, x: 45 + k * 12, y: CY })));
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
