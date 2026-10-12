import { describe, expect, it } from 'vitest';
import { generateSite, TILE, type Site } from './generate.ts';

const SEEDS = ['a', 'b', 'c', 'd', 'e', 'f'];
const tile = (site: Site, x: number, y: number) => site.tiles[y * site.w + x];
const count = (site: Site, kind: string) => site.props.filter((prop) => prop.kind === kind).length;

describe('where the notable buildings stand', () => {
  it('is never out in a corner of the town', () => {
    for (const kind of ['city', 'kingdom'] as const) {
      for (const seed of SEEDS) {
        const site = generateSite(kind, seed);
        // The town is what the outer wall encloses.
        const wall = site.walls[site.walls.length - 1];
        const nearSide = (at: number, from: number, size: number) =>
          Math.min(at - from, from + size - at) < size * 0.14;
        // The castle has its own place; every other named building is checked.
        for (const place of site.places.slice(1)) {
          const cornered = nearSide(place.x, wall.x, wall.w) && nearSide(place.y, wall.y, wall.h);
          expect(cornered, `${site.name}: ${place.name}`).toBe(false);
        }
      }
    }
  });

  it('is still spread through the town, not all on the square', () => {
    const site = generateSite('kingdom', 'a');
    const square = site.places[1];
    const far = site.places
      .slice(2)
      .filter((place) => Math.hypot(place.x - square.x, place.y - square.y) > 14);
    expect(far.length).toBeGreaterThanOrEqual(3);
  });
});

describe('what stands in the open', () => {
  it('stays on the map, off the buildings and out of the water', () => {
    for (const kind of ['village', 'city', 'kingdom', 'port', 'ruins', 'tower'] as const) {
      for (const seed of SEEDS) {
        const site = generateSite(kind, seed);
        const built = new Set<number>();
        for (const b of site.buildings) {
          for (let y = b.y; y < b.y + b.h; y++)
            for (let x = b.x; x < b.x + b.w; x++) built.add(y * site.w + x);
        }
        for (const prop of site.props) {
          const x = Math.floor(prop.x);
          const y = Math.floor(prop.y);
          expect(x >= 0 && y >= 0 && x < site.w && y < site.h).toBe(true);
          expect(tile(site, x, y)).not.toBe(TILE.water);
          // Lamps and benches stand at the edge of a square; everything else has one to itself.
          if (
            prop.kind !== 'lamp' &&
            prop.kind !== 'bench' &&
            prop.kind !== 'fountain' &&
            prop.kind !== 'bigtree'
          ) {
            expect(built.has(y * site.w + x), `${kind}/${seed}: ${prop.kind}`).toBe(false);
          }
        }
      }
    }
  });

  it('gives a paved town a fountain, benches, lamps and trees in tubs on its square', () => {
    for (const kind of ['city', 'kingdom', 'port'] as const) {
      for (const seed of SEEDS) {
        const site = generateSite(kind, seed);
        expect(count(site, 'fountain')).toBe(1);
        expect(count(site, 'bench')).toBeGreaterThanOrEqual(4);
        expect(count(site, 'lamp')).toBeGreaterThan(10);
        expect(count(site, 'planter')).toBeGreaterThan(2);
      }
    }
  });

  it('gives a village its old tree instead, and no street lamps', () => {
    for (const seed of SEEDS) {
      const site = generateSite('village', seed);
      expect(count(site, 'bigtree')).toBe(1);
      expect(count(site, 'fountain')).toBe(0);
      expect(count(site, 'lamp')).toBe(0);
    }
  });

  it('plants the town: trees, bushes and flower beds among the houses', () => {
    for (const kind of ['village', 'city', 'kingdom'] as const) {
      const site = generateSite(kind, 'a');
      expect(count(site, 'bush')).toBeGreaterThan(15);
      expect(count(site, 'flowers')).toBeGreaterThan(5);
      expect(site.tiles.includes(TILE.field)).toBe(true);
    }
    // A garden of flowers needs water: there are none in the desert.
    expect(count(generateSite('city', 'a', { terrain: 'desert' }), 'flowers')).toBe(0);
  });

  it('keeps a public garden in the larger towns, and a graveyard by the temple', () => {
    const parks = SEEDS.filter((seed) =>
      generateSite('kingdom', seed).places.some((place) => /^(Jardim|Parque|Bosque)/.test(place.name)),
    );
    expect(parks.length).toBeGreaterThanOrEqual(4);
    const graves = SEEDS.filter((seed) => count(generateSite('kingdom', seed), 'tombstone') > 0);
    expect(graves.length).toBeGreaterThanOrEqual(3);
  });

  it('leaves rubble instead in a ruin', () => {
    const site = generateSite('ruins', 'a');
    expect(count(site, 'rubble')).toBeGreaterThan(5);
    expect(count(site, 'fountain') + count(site, 'lamp') + count(site, 'flowers')).toBe(0);
  });

  it('stacks crates on the quay of a port', () => {
    for (const seed of SEEDS) expect(count(generateSite('port', seed), 'crates')).toBeGreaterThan(5);
  });
});

describe('how much of the surroundings is shown', () => {
  it('is a narrow band: the town takes most of the map', () => {
    for (const kind of ['city', 'kingdom', 'ruins'] as const) {
      const site = generateSite(kind, 'a');
      const wall = site.walls[site.walls.length - 1];
      expect((wall.w * wall.h) / (site.w * site.h)).toBeGreaterThan(0.7);
    }
    const tower = generateSite('tower', 'a');
    expect((tower.walls[0].w * tower.walls[0].h) / (tower.w * tower.h)).toBeGreaterThan(0.24);
  });
});
