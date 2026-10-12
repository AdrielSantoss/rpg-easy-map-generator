import { describe, expect, it } from 'vitest';
import { Biome } from '../generator/biome.ts';
import { exitsOf, roadSide, SITE_SIDES, SITE_TERRAINS, terrainAt } from './context.ts';
import { generateSite, TILE, type Site } from './generate.ts';

const W = 60;
const H = 40;

/** A world of one biome, with a patch of another and, optionally, snow over part of it. */
function world(base: number, patch?: { biome: number; x: number; y: number; r: number }, snowBelowY = -1) {
  const biome = new Uint8Array(W * H).fill(base);
  const snow = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (patch && Math.hypot(x - patch.x, y - patch.y) <= patch.r) biome[y * W + x] = patch.biome;
      if (y < snowBelowY) snow[y * W + x] = 1;
    }
  }
  return { w: W, h: H, biome, snow };
}

/** The cells of a straight road between two points. */
function road(x0: number, y0: number, x1: number, y1: number): number[] {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  return Array.from({ length: steps + 1 }, (_, i) => {
    const x = Math.round(x0 + ((x1 - x0) * i) / steps);
    const y = Math.round(y0 + ((y1 - y0) * i) / steps);
    return y * W + x;
  });
}

describe('terrainAt', () => {
  it('names the biome the structure stands on', () => {
    expect(terrainAt(world(Biome.Desert), 30, 20)).toBe('desert');
    expect(terrainAt(world(Biome.Swamp), 30, 20)).toBe('swamp');
    expect(terrainAt(world(Biome.Mountains), 30, 20)).toBe('mountain');
    expect(terrainAt(world(Biome.Hills), 30, 20)).toBe('hills');
    expect(terrainAt(world(Biome.Taiga), 30, 20)).toBe('taiga');
    expect(terrainAt(world(Biome.Forest), 30, 20)).toBe('forest');
  });

  it('goes by most of the land around, not by the one cell underneath', () => {
    const map = world(Biome.Forest, { biome: Biome.Desert, x: 30, y: 20, r: 1 });
    expect(terrainAt(map, 30, 20)).toBe('forest');
  });

  it('sees snow where snow lies', () => {
    expect(terrainAt(world(Biome.Mountains, undefined, H), 30, 20)).toBe('snow');
  });

  it('ignores the sea beside a port', () => {
    const map = world(Biome.Water, { biome: Biome.Plains, x: 30, y: 20, r: 2 });
    expect(terrainAt(map, 30, 20)).toBe('plains');
  });

  it('works at the edge of the map', () => {
    expect(terrainAt(world(Biome.Desert), 0, 0)).toBe('desert');
  });
});

describe('the sides the roads leave by', () => {
  it('follows where the road goes, whichever end the structure is at', () => {
    expect(roadSide(road(30, 20, 55, 22), W, 30, 20)).toBe('east');
    expect(roadSide(road(55, 22, 30, 20), W, 30, 20)).toBe('east');
    expect(roadSide(road(30, 20, 4, 18), W, 30, 20)).toBe('west');
    expect(roadSide(road(30, 20, 33, 2), W, 30, 20)).toBe('north');
    expect(roadSide(road(30, 20, 27, 38), W, 30, 20)).toBe('south');
  });

  it('copes with a road shorter than the distance it looks ahead', () => {
    expect(roadSide(road(30, 20, 34, 20), W, 30, 20)).toBe('east');
  });

  it('lists each side once, in compass order, and none without roads', () => {
    const roads = [road(30, 20, 4, 20), road(30, 20, 56, 20), road(58, 24, 30, 20)];
    expect(exitsOf(roads, W, 30, 20)).toEqual(['east', 'west']);
    expect(exitsOf([], W, 30, 20)).toEqual([]);
  });
});

describe('a place and its surroundings', () => {
  const tile = (site: Site, x: number, y: number) => site.tiles[y * site.w + x];
  /** Which edges of the map a road reaches. */
  const reached = (site: Site) => {
    const row = (y: number) => Array.from({ length: site.w }, (_, x) => tile(site, x, y));
    const column = (x: number) => Array.from({ length: site.h }, (_, y) => tile(site, x, y));
    const has = (cells: number[]) => cells.includes(TILE.road) || cells.includes(TILE.bridge);
    return {
      north: has(row(0)),
      south: has(row(site.h - 1)),
      west: has(column(0)),
      east: has(column(site.w - 1)),
    };
  };

  it('has a road out on exactly the sides asked for', () => {
    for (const kind of ['village', 'city', 'kingdom', 'ruins', 'tower'] as const) {
      for (const seed of ['a', 'b', 'c']) {
        expect(reached(generateSite(kind, seed, { exits: ['east', 'west'] }))).toEqual({
          north: false,
          south: false,
          east: true,
          west: true,
        });
        expect(reached(generateSite(kind, seed, { exits: ['north'] })).north).toBe(true);
        expect(Object.values(reached(generateSite(kind, seed, { exits: [] })))).not.toContain(true);
      }
    }
  });

  it('opens a gate in the wall only where a road passes', () => {
    for (const seed of ['a', 'b', 'c']) {
      const closed = generateSite('city', seed, { exits: [] });
      expect(closed.walls[0].gates).toHaveLength(0);
      const two = generateSite('city', seed, { exits: ['east', 'west'] });
      const [wall] = two.walls;
      // Every gate is on the east or the west side of the wall.
      expect(wall.gates.length).toBeGreaterThan(0);
      for (const gate of wall.gates) expect([wall.x, wall.x + wall.w - 1]).toContain(gate.x);
      expect(generateSite('tower', seed, { exits: ['north', 'east'] }).walls[0].gates).toHaveLength(2);
    }
  });

  it('never sends a road from a port into the sea', () => {
    const site = generateSite('port', 'a', { exits: [...SITE_SIDES] });
    for (let x = 0; x < site.w; x++) expect(tile(site, x, site.h - 1)).toBe(TILE.water);
  });

  it('keeps the streets and houses the same whatever the surroundings', () => {
    const base = generateSite('city', 'a');
    const other = generateSite('city', 'a', { terrain: 'desert', exits: [], name: 'Outro Nome' });
    expect(other.name).toBe('Outro Nome');
    expect(other.places).toEqual(base.places);
    expect(other.buildings).toEqual(base.buildings);
    expect(other.terrain).toBe('desert');
  });

  it('dresses the land for the terrain', () => {
    const trees = (terrain: (typeof SITE_TERRAINS)[number]) =>
      generateSite('village', 'a', { terrain }).trees.length;
    expect(trees('forest')).toBeGreaterThan(trees('plains'));
    expect(trees('plains')).toBeGreaterThan(trees('desert') * 3);

    expect(generateSite('village', 'a', { terrain: 'mountain' }).rocks.length).toBeGreaterThan(30);
    expect(generateSite('village', 'a', { terrain: 'plains' }).rocks).toHaveLength(0);

    const water = (site: Site) => site.tiles.filter((t) => t === TILE.water).length;
    expect(water(generateSite('tower', 'a', { terrain: 'swamp' }))).toBeGreaterThan(
      water(generateSite('tower', 'a', { terrain: 'plains' })) + 20,
    );

    for (const seed of ['a', 'b', 'c', 'd']) {
      const desert = generateSite('village', seed, { terrain: 'desert' });
      // No river, and nothing farmed.
      expect(desert.tiles.includes(TILE.field)).toBe(false);
      expect(desert.tiles.includes(TILE.bridge)).toBe(false);
    }
  });

  it('gives a complete map on every terrain', () => {
    for (const terrain of SITE_TERRAINS) {
      for (const kind of ['village', 'city', 'kingdom', 'port', 'ruins', 'tower', 'dungeon'] as const) {
        const site = generateSite(kind, 'a', { terrain });
        expect(site.places.length).toBeGreaterThanOrEqual(5);
        for (const tree of site.trees)
          expect(tile(site, Math.floor(tree.x), Math.floor(tree.y))).toBe(TILE.grass);
      }
    }
  });
});
