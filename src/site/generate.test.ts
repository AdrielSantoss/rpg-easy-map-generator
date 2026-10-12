import { describe, expect, it } from 'vitest';
import { STRUCTURE_KINDS } from '../structures/model.ts';
import { generateSite, TILE, type Site } from './generate.ts';

const SEEDS = ['a', 'b', 'c', 'd', 'e', 'f'];
const tile = (site: Site, x: number, y: number) => site.tiles[y * site.w + x];

/** Every site of every kind for a handful of seeds. */
const all = () => STRUCTURE_KINDS.flatMap((kind) => SEEDS.map((seed) => generateSite(kind, seed)));

describe('generateSite', () => {
  it('gives the same map for the same kind and seed', () => {
    for (const kind of STRUCTURE_KINDS) expect(generateSite(kind, 'x')).toEqual(generateSite(kind, 'x'));
  });

  it('gives different maps for different seeds', () => {
    for (const kind of STRUCTURE_KINDS) {
      expect(generateSite(kind, 'x').tiles).not.toEqual(generateSite(kind, 'y').tiles);
    }
  });

  it('names the place and its notable spots', () => {
    for (const site of all()) {
      expect(site.name).not.toBe('');
      expect(site.places.length).toBeGreaterThanOrEqual(5);
      for (const place of site.places) {
        expect(place.name).not.toBe('');
        expect(place.x).toBeGreaterThanOrEqual(0);
        expect(place.x).toBeLessThanOrEqual(site.w);
        expect(place.y).toBeGreaterThanOrEqual(0);
        expect(place.y).toBeLessThanOrEqual(site.h);
      }
    }
  });

  it('keeps every building on the map, off water and roads, and apart from the others', () => {
    for (const site of all()) {
      const taken = new Set<number>();
      for (const b of site.buildings) {
        for (let y = b.y; y < b.y + b.h; y++) {
          for (let x = b.x; x < b.x + b.w; x++) {
            expect(x >= 0 && y >= 0 && x < site.w && y < site.h).toBe(true);
            expect(taken.has(y * site.w + x)).toBe(false);
            taken.add(y * site.w + x);
            const under = tile(site, x, y);
            expect(under).not.toBe(TILE.water);
            expect(under).not.toBe(TILE.road);
            expect(under).not.toBe(TILE.rock);
          }
        }
      }
    }
  });

  it('keeps trees on grass', () => {
    for (const site of all()) {
      for (const tree of site.trees) {
        expect(tile(site, Math.floor(tree.x), Math.floor(tree.y))).toBe(TILE.grass);
      }
    }
  });
});

describe('towns', () => {
  it('have streets, a square and many houses', () => {
    for (const kind of ['village', 'city', 'kingdom', 'port'] as const) {
      for (const seed of SEEDS) {
        const site = generateSite(kind, seed);
        expect(site.tiles.filter((t) => t === TILE.road).length).toBeGreaterThan(100);
        expect(site.tiles.filter((t) => t === TILE.plaza).length).toBeGreaterThan(20);
        expect(site.buildings.filter((b) => b.kind === 'house').length).toBeGreaterThan(25);
        expect(site.streets).toHaveLength(2);
      }
    }
  });

  it('grow from village to city to capital', () => {
    const houses = (kind: 'village' | 'city' | 'kingdom') =>
      generateSite(kind, 'a').buildings.filter((b) => b.kind === 'house').length;
    expect(houses('city')).toBeGreaterThan(houses('village') * 2);
    expect(houses('kingdom')).toBeGreaterThan(houses('city'));
  });

  it('wall the city, with a gate on every road out', () => {
    for (const seed of SEEDS) {
      expect(generateSite('village', seed).walls).toHaveLength(0);
      const [wall] = generateSite('city', seed).walls;
      expect(wall.gates.length).toBeGreaterThanOrEqual(4);
      expect(wall.towers.length).toBeGreaterThan(8);
      expect(wall.gaps).toHaveLength(0);
    }
  });

  it('give the capital a castle inside its own wall', () => {
    for (const seed of SEEDS) {
      const site = generateSite('kingdom', seed);
      expect(site.walls).toHaveLength(2);
      expect(site.buildings.filter((b) => b.kind === 'keep')).toHaveLength(1);
      expect(site.places[0].name).toMatch(/^Castelo /);
      // The castle can be entered.
      expect(site.walls[0].gates.length).toBeGreaterThan(0);
    }
  });

  it('give the village a well and fields instead of a market', () => {
    const site = generateSite('village', 'a');
    expect(site.buildings.some((b) => b.kind === 'well')).toBe(true);
    expect(site.buildings.some((b) => b.kind === 'stall')).toBe(false);
    for (const seed of SEEDS) expect(generateSite('village', seed).tiles.includes(TILE.field)).toBe(true);
  });

  it('bridge the river only where there is water to cross', () => {
    for (const site of all()) {
      for (let y = 0; y < site.h; y++) {
        for (let x = 0; x < site.w; x++) {
          if (tile(site, x, y) !== TILE.bridge) continue;
          const beside = [
            tile(site, x - 1, y),
            tile(site, x + 1, y),
            tile(site, x, y - 1),
            tile(site, x, y + 1),
          ];
          expect(beside.some((t) => t === TILE.water || t === TILE.bridge)).toBe(true);
        }
      }
    }
  });
});

describe('the port', () => {
  it('lies by the sea, with piers, boats, warehouses and a lighthouse', () => {
    for (const seed of SEEDS) {
      const site = generateSite('port', seed);
      // The whole south edge is water.
      for (let x = 0; x < site.w; x++) expect(tile(site, x, site.h - 1)).toBe(TILE.water);
      expect(site.tiles.includes(TILE.pier)).toBe(true);
      expect(site.boats.length).toBeGreaterThan(2);
      expect(site.buildings.filter((b) => b.kind === 'warehouse').length).toBeGreaterThan(1);
      expect(site.buildings.filter((b) => b.kind === 'lighthouse')).toHaveLength(1);
      expect(site.places.map((place) => place.name)).toContain('Farol');
    }
  });
});

describe('ruins', () => {
  it('are a town with every building roofless and the wall breached', () => {
    for (const seed of SEEDS) {
      const site = generateSite('ruins', seed);
      expect(site.buildings.filter((b) => b.kind !== 'well').every((b) => b.ruined)).toBe(true);
      expect(site.walls[0].gaps.length).toBeGreaterThan(5);
    }
  });
});

describe('the tower', () => {
  it('stands in a walled yard in the woods, reached by a track', () => {
    for (const seed of SEEDS) {
      const site = generateSite('tower', seed);
      expect(site.buildings.filter((b) => b.kind === 'tower')).toHaveLength(1);
      expect(site.walls).toHaveLength(1);
      expect(site.walls[0].gates).toHaveLength(1);
      expect(site.trees.length).toBeGreaterThan(200);
      // The track leaves by the south edge.
      expect(Array.from({ length: site.w }, (_, x) => tile(site, x, site.h - 1))).toContain(TILE.road);
    }
  });
});

describe('the dungeon', () => {
  it('is rooms in the rock, on the combat grid, all reachable from the entrance', () => {
    for (const seed of SEEDS) {
      const site = generateSite('dungeon', seed);
      expect(site.cellMeters).toBe(1.5);
      expect(site.places.length).toBeGreaterThanOrEqual(6);
      expect(site.places[0].name).toBe('Entrada');
      expect(site.places.map((place) => place.name)).toContain('Sala do Tesouro');
      expect(site.doors.length).toBeGreaterThan(3);

      const open = (x: number, y: number) =>
        x >= 0 && y >= 0 && x < site.w && y < site.h && tile(site, x, y) !== TILE.rock;
      const start = site.places[0];
      const seen = new Set<number>();
      const queue = [[Math.floor(start.x), Math.floor(start.y)]];
      while (queue.length > 0) {
        const [x, y] = queue.pop()!;
        if (!open(x, y) || seen.has(y * site.w + x)) continue;
        seen.add(y * site.w + x);
        queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      }
      for (const place of site.places) {
        expect(seen.has(Math.floor(place.y) * site.w + Math.floor(place.x))).toBe(true);
      }
      // The border is solid rock.
      for (let x = 0; x < site.w; x++) expect(tile(site, x, 0)).toBe(TILE.rock);
    }
  });
});
