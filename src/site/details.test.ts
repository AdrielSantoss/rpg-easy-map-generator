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

  const MANY = Array.from({ length: 24 }, (_, index) => `s${index}`);
  /** How many of the towns of a kind, over many seeds, pass a test. */
  const share = (kind: 'village' | 'city' | 'kingdom' | 'port', test: (site: Site) => boolean) =>
    MANY.filter((seed) => test(generateSite(kind, seed))).length / MANY.length;

  it('builds the main square of a paved town around different things', () => {
    for (const kind of ['city', 'kingdom', 'port'] as const) {
      // Some have a fountain, some a monument, some neither; none has both.
      for (const centre of ['fountain', 'monument']) {
        const having = share(kind, (site) => count(site, centre) === 1);
        expect(having, `${kind}: ${centre}`).toBeGreaterThan(0.08);
        expect(having, `${kind}: ${centre}`).toBeLessThan(0.55);
      }
      expect(share(kind, (site) => count(site, 'fountain') + count(site, 'monument') > 1)).toBe(0);
      // Trees in tubs are the mark of some squares, not of all.
      const planted = share(kind, (site) => count(site, 'planter') > 0);
      expect(planted).toBeGreaterThan(0.15);
      expect(planted).toBeLessThan(0.85);
      // A market square is crowded, another may have no stall at all.
      const stalls = MANY.map(
        (seed) => generateSite(kind, seed).buildings.filter((b) => b.kind === 'stall').length,
      );
      expect(Math.max(...stalls)).toBeGreaterThan(3);
      expect(Math.min(...stalls)).toBe(0);
      // Whatever the square, a paved town lights its main streets.
      expect(share(kind, (site) => count(site, 'lamp') > 10)).toBe(1);
    }
  });

  it('names the square after what is on it', () => {
    for (const seed of MANY) {
      for (const kind of ['city', 'kingdom', 'village'] as const) {
        const site = generateSite(kind, seed);
        const name = site.places[kind === 'kingdom' ? 1 : 0].name;
        expect(/Fonte|Chafariz|Águas/.test(name), name).toBe(count(site, 'fountain') === 1);
        expect(/Heróis|Fundador|Estátua/.test(name), name).toBe(count(site, 'monument') === 1);
        expect(/Carvalho|Figueira/.test(name), name).toBe(count(site, 'bigtree') === 1);
      }
    }
  });

  it('gives only some villages an old tree on the green, and none a street lamp', () => {
    const treed = share('village', (site) => count(site, 'bigtree') === 1);
    expect(treed).toBeGreaterThan(0.08);
    expect(treed).toBeLessThan(0.55);
    expect(share('village', (site) => count(site, 'fountain') + count(site, 'lamp') === 0)).toBe(1);
    // Every village has its well; only one holding a fair has stalls.
    expect(share('village', (site) => site.buildings.some((b) => b.kind === 'well'))).toBe(1);
    const fairs = share('village', (site) => site.buildings.some((b) => b.kind === 'stall'));
    expect(fairs).toBeGreaterThan(0.08);
    expect(fairs).toBeLessThan(0.55);
  });

  it('keeps a public garden in some of the larger towns, not in all', () => {
    for (const kind of ['city', 'kingdom'] as const) {
      const parks = share(kind, (site) =>
        site.places.some((place) => /^(Jardim|Parque|Bosque)/.test(place.name)),
      );
      expect(parks).toBeGreaterThan(0.2);
      expect(parks).toBeLessThan(0.8);
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

  it('lays a graveyard beside the temple where there is ground for one', () => {
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
