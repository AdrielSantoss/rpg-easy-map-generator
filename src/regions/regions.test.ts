import { describe, expect, it } from 'vitest';
import { Biome } from '../generator/biome.ts';
import { generateMap } from '../generator/index.ts';
import { seededRng } from '../generator/rng.ts';
import { ringSketch } from '../testing/shapes.ts';
import {
  applyRegionNames,
  dodge,
  findRegions,
  labelWidth,
  nameRegion,
  REGION_KINDS,
  regionAt,
  suggestRegionName,
  type Region,
  type RegionKind,
  type RegionTerrain,
} from './regions.ts';

const W = 300;
const H = 200;

/**
 * A sea with one continent (holding a lake, a forest, a mountain range, a
 * desert and a swamp), one island worth naming and one islet too small for it.
 */
function world(seed = 'aldoria'): RegionTerrain {
  const biome = new Uint8Array(W * H).fill(Biome.Water);
  const fill = (x0: number, y0: number, x1: number, y1: number, b: number) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) biome[y * W + x] = b;
  };
  fill(30, 30, 190, 170, Biome.Plains);
  fill(40, 40, 90, 80, Biome.Forest);
  fill(110, 40, 170, 70, Biome.Mountains);
  fill(105, 35, 175, 40, Biome.Hills);
  fill(40, 110, 90, 150, Biome.Desert);
  fill(130, 120, 170, 150, Biome.Swamp);
  fill(100, 90, 125, 110, Biome.Water);
  fill(240, 40, 262, 62, Biome.Plains);
  fill(250, 150, 254, 154, Biome.Plains);
  return { w: W, h: H, biome, seed };
}

const only = (regions: Region[], kind: RegionKind) => regions.filter((r) => r.kind === kind);
const one = (regions: Region[], kind: RegionKind) => {
  const matches = only(regions, kind);
  expect(matches).toHaveLength(1);
  return matches[0];
};
const within = (r: Region, x0: number, y0: number, x1: number, y1: number) =>
  r.x > x0 && r.x < x1 && r.y > y0 && r.y < y1;

describe('findRegions', () => {
  const regions = findRegions(world());

  it('names the continent, placing the label inside it', () => {
    expect(within(one(regions, 'continent'), 30, 30, 190, 170)).toBe(true);
  });

  it('names an island but not an islet too small to matter', () => {
    expect(within(one(regions, 'island'), 240, 40, 262, 62)).toBe(true);
  });

  it('tells a lake from the sea', () => {
    expect(within(one(regions, 'lake'), 100, 90, 125, 110)).toBe(true);
    for (const sea of only(regions, 'sea')) expect(within(sea, 30, 30, 190, 170)).toBe(false);
    expect(only(regions, 'sea').length).toBeGreaterThan(0);
  });

  it('names each terrain feature where it is', () => {
    expect(within(one(regions, 'forest'), 40, 40, 90, 80)).toBe(true);
    expect(within(one(regions, 'mountains'), 105, 35, 175, 70)).toBe(true);
    expect(within(one(regions, 'desert'), 40, 110, 90, 150)).toBe(true);
    expect(within(one(regions, 'swamp'), 130, 120, 170, 150)).toBe(true);
  });

  it('keeps sea labels clear of the map frame', () => {
    for (const sea of only(regions, 'sea')) expect(within(sea, 12, 12, W - 12, H - 12)).toBe(true);
  });

  it('never lets two labels overlap', () => {
    for (const a of regions) {
      for (const b of regions) {
        if (a === b) continue;
        const apartX = Math.abs(a.x - b.x) >= (labelWidth(a) + labelWidth(b)) / 2;
        const apartY = Math.abs(a.y - b.y) >= (a.size + b.size) / 2;
        expect(apartX || apartY).toBe(true);
      }
    }
  });

  it('gives the same names for the same seed and different ones for another', () => {
    const names = (seed: string) => findRegions(world(seed)).map((r) => r.name);
    expect(names('aldoria')).toEqual(names('aldoria'));
    expect(names('aldoria')).not.toEqual(names('another'));
  });

  it('finds nothing to name on a map that is all water', () => {
    const empty = { w: W, h: H, biome: new Uint8Array(W * H), seed: 's' };
    expect(findRegions(empty).filter((r) => r.kind !== 'sea')).toEqual([]);
  });

  it('names the land and sea of a generated map', () => {
    const map = generateMap(ringSketch(W, H, 70), W, H, 'aldoria')!;
    const found = findRegions(map);
    const continent = one(found, 'continent');
    expect(map.biome[Math.floor(continent.y) * W + Math.floor(continent.x)]).not.toBe(Biome.Water);
    for (const sea of only(found, 'sea')) {
      expect(map.biome[Math.floor(sea.y) * W + Math.floor(sea.x)]).toBe(Biome.Water);
    }
  });
});

describe('suggestRegionName', () => {
  it('fits the name to the kind of region', () => {
    const rng = seededRng('names');
    expect(suggestRegionName('continent', rng)).toMatch(/^\p{Lu}\p{Ll}+$/u);
    expect(suggestRegionName('island', rng)).toMatch(/^Ilha de \p{Lu}/u);
    expect(suggestRegionName('sea', rng)).toMatch(/^(Mar|Golfo) de \p{Lu}/u);
    expect(suggestRegionName('lake', rng)).toMatch(/^Lago \p{Lu}/u);
    expect(suggestRegionName('mountains', rng)).toMatch(/^(Montes|Serra de|Picos de) \p{Lu}/u);
    expect(suggestRegionName('forest', rng)).toMatch(/^(Floresta|Bosque|Mata) de \p{Lu}/u);
    expect(suggestRegionName('desert', rng)).toMatch(/^(Deserto|Ermo) de \p{Lu}/u);
    expect(suggestRegionName('swamp', rng)).toMatch(/^(Pântano|Charco) de \p{Lu}/u);
  });

  it('has a suggestion for every kind', () => {
    for (const kind of REGION_KINDS)
      expect(suggestRegionName(kind, seededRng(kind)).length).toBeGreaterThan(2);
  });
});

describe('names chosen by the user', () => {
  const regions = findRegions(world());
  const forest = regions.find((r) => r.kind === 'forest')!;

  it('replace the suggestion for that region only', () => {
    const chosen = nameRegion([], forest, 'Bosque dos Sussurros', W);
    const renamed = applyRegionNames(regions, chosen, W);
    expect(renamed.find((r) => r.kind === 'forest')!.name).toBe('Bosque dos Sussurros');
    for (const region of renamed) {
      if (region.kind !== 'forest')
        expect(region.name).toBe(regions.find((r) => r.kind === region.kind && r.x === region.x)!.name);
    }
    expect(regions.find((r) => r.kind === 'forest')!.name).toBe(forest.name);
  });

  it('follow the region when its label moves a little', () => {
    const chosen = nameRegion([], forest, 'Bosque dos Sussurros', W);
    const shifted = regions.map((r) => (r === forest ? { ...r, x: r.x + 12, y: r.y - 8 } : r));
    expect(applyRegionNames(shifted, chosen, W).find((r) => r.kind === 'forest')!.name).toBe(
      'Bosque dos Sussurros',
    );
  });

  it('do not jump to a region of another kind or one far away', () => {
    const chosen = [
      { kind: 'forest' as const, x: forest.x + 150, y: forest.y, name: 'Longe' },
      { kind: 'desert' as const, x: forest.x, y: forest.y, name: 'Outro tipo' },
    ];
    const renamed = applyRegionNames(regions, chosen, W);
    expect(renamed.find((r) => r.kind === 'forest')!.name).toBe(forest.name);
  });

  it('keep only the latest name for a region', () => {
    const first = nameRegion([], forest, 'Primeiro', W);
    const second = nameRegion(first, { ...forest, x: forest.x + 3 }, 'Segundo', W);
    expect(second).toHaveLength(1);
    expect(applyRegionNames(regions, second, W).find((r) => r.kind === 'forest')!.name).toBe('Segundo');
  });
});

describe('dodge', () => {
  const label: Region = { kind: 'forest', x: 100, y: 100, area: 900, name: 'Bosque de Valdor', size: 6 };
  const castle = { x: 100, y: 101, width: 20, height: 26 };
  const overlaps = (r: Region, o: typeof castle) =>
    Math.abs(r.x - o.x) < (labelWidth(r) + o.width) / 2 && Math.abs(r.y - o.y) < (r.size + o.height) / 2;

  it('leaves a label alone when nothing is in its way', () => {
    expect(dodge([label], [{ ...castle, x: 300 }])).toEqual([label]);
    expect(dodge([label], [])).toEqual([label]);
  });

  it('moves a label straight up or down, off what is in its way', () => {
    const [moved] = dodge([label], [castle]);
    expect(overlaps(label, castle)).toBe(true);
    expect(overlaps(moved, castle)).toBe(false);
    expect(moved.x).toBe(label.x);
    expect(Math.abs(moved.y - label.y)).toBeLessThan(label.size * 4);
    expect(moved.name).toBe(label.name);
  });

  it('does not move a label onto another label', () => {
    const above: Region = { ...label, y: label.y - 2.6 * label.size, name: 'Bosque de Cima' };
    const [first, second] = dodge([above, label], [castle]);
    expect(first).toEqual(above);
    expect(overlaps(second, castle)).toBe(false);
    expect(Math.abs(second.y - first.y)).toBeGreaterThanOrEqual(label.size);
  });

  it('leaves a label where it was when there is no free spot nearby', () => {
    const wall = { x: 100, y: 100, width: 40, height: 200 };
    expect(dodge([label], [wall])).toEqual([label]);
  });
});

describe('regionAt', () => {
  const regions = findRegions(world());
  const forest = regions.find((r) => r.kind === 'forest')!;

  it('finds the region whose label is under the position', () => {
    expect(regionAt(regions, forest.x, forest.y)).toBe(forest);
    expect(regionAt(regions, forest.x + labelWidth(forest) / 2 - 1, forest.y)).toBe(forest);
  });

  it('finds nothing beside a label', () => {
    expect(regionAt([forest], forest.x + labelWidth(forest) / 2 + 2, forest.y)).toBeNull();
    expect(regionAt([forest], forest.x, forest.y + forest.size * 2)).toBeNull();
  });
});
