import { describe, expect, it } from 'vitest';
import { Biome } from '../generator/biome.ts';
import { generateMap } from '../generator/index.ts';
import { drawRing } from '../testing/shapes.ts';
import { distanceToRoad, findRoad, markRoad, type RoadTerrain } from './roads.ts';

const W = 60;
const H = 40;

/** An all-plains map, with `edit` free to change cells of it. */
function plain(
  edit: (terrain: RoadTerrain, at: (x: number, y: number) => number) => void = () => {},
): RoadTerrain {
  const terrain: RoadTerrain = {
    w: W,
    h: H,
    biome: new Uint8Array(W * H).fill(Biome.Plains),
    snow: new Uint8Array(W * H),
    elevation: new Float32Array(W * H),
    riverDist: new Float32Array(W * H).fill(99),
  };
  edit(terrain, (x, y) => y * W + x);
  return terrain;
}

const WEST = { x: 5.5, y: 20.5 };
const EAST = { x: 55.5, y: 20.5 };
const biomesOn = (terrain: RoadTerrain, cells: Int32Array) =>
  new Set([...cells].map((c) => terrain.biome[c]));

describe('findRoad', () => {
  it('links two places with a continuous route that starts and ends on them', () => {
    const road = findRoad(plain(), WEST, EAST)!;
    expect([road.points[0], road.points[1]]).toEqual([WEST.x, WEST.y]);
    expect([road.points.at(-2), road.points.at(-1)]).toEqual([EAST.x, EAST.y]);
    expect(road.points.length).toBe(road.cells.length * 2);
    for (let p = 1; p < road.cells.length; p++) {
      const dx = Math.abs((road.cells[p] % W) - (road.cells[p - 1] % W));
      const dy = Math.abs(Math.floor(road.cells[p] / W) - Math.floor(road.cells[p - 1] / W));
      expect(Math.max(dx, dy)).toBe(1);
    }
  });

  it('goes straight across open plains', () => {
    const road = findRoad(plain(), WEST, EAST)!;
    expect(road.cells.length).toBe(51);
    expect(road.bridges).toHaveLength(0);
  });

  it('never enters water, and goes around it', () => {
    const terrain = plain((t, at) => {
      for (let y = 0; y < 34; y++) t.biome[at(30, y)] = Biome.Water;
    });
    const road = findRoad(terrain, WEST, EAST)!;
    expect(biomesOn(terrain, road.cells).has(Biome.Water)).toBe(false);
    // The only way across is the gap at the bottom of the water.
    const crossing = [...road.cells].filter((c) => c % W === 30);
    expect(crossing.length).toBeGreaterThan(0);
    for (const c of crossing) expect(Math.floor(c / W)).toBeGreaterThanOrEqual(34);
  });

  it('finds no road between places separated by water', () => {
    const terrain = plain((t, at) => {
      for (let y = 0; y < H; y++) t.biome[at(30, y)] = Biome.Water;
    });
    expect(findRoad(terrain, WEST, EAST)).toBeNull();
  });

  it('finds no road to a place in the water or off the map', () => {
    const terrain = plain((t, at) => {
      t.biome[at(55, 20)] = Biome.Water;
    });
    expect(findRoad(terrain, WEST, EAST)).toBeNull();
    expect(findRoad(plain(), WEST, { x: 200, y: 20 })).toBeNull();
  });

  for (const [name, obstacle] of [
    ['mountains', Biome.Mountains],
    ['swamp', Biome.Swamp],
  ] as const) {
    it(`goes around ${name} when there is a way through`, () => {
      const terrain = plain((t, at) => {
        for (let y = 0; y < 32; y++) for (let x = 28; x < 32; x++) t.biome[at(x, y)] = obstacle;
      });
      const road = findRoad(terrain, WEST, EAST)!;
      expect(biomesOn(terrain, road.cells).has(obstacle)).toBe(false);
    });

    it(`crosses ${name} when there is no way around`, () => {
      const terrain = plain((t, at) => {
        for (let y = 0; y < H; y++) for (let x = 28; x < 32; x++) t.biome[at(x, y)] = obstacle;
      });
      expect(biomesOn(terrain, findRoad(terrain, WEST, EAST)!.cells).has(obstacle)).toBe(true);
    });
  }

  it('avoids steep ground', () => {
    const terrain = plain((t, at) => {
      for (let y = 10; y < 30; y++) for (let x = 27; x < 33; x++) t.elevation[at(x, y)] = 0.5;
    });
    const road = findRoad(terrain, WEST, EAST)!;
    for (const c of road.cells) expect(terrain.elevation[c]).toBe(0);
  });

  it('builds one bridge where it has to cross a river', () => {
    const terrain = plain((t, at) => {
      for (let y = 0; y < H; y++) {
        t.riverDist[at(30, y)] = 0;
        t.riverDist[at(29, y)] = 1;
        t.riverDist[at(31, y)] = 1;
      }
    });
    const road = findRoad(terrain, WEST, EAST)!;
    expect(road.bridges).toHaveLength(1);
    expect(road.bridges[0].x).toBeCloseTo(30.5, 0);
    // The road runs west to east, so that is the way the bridge points.
    expect(Math.abs(Math.sin(road.bridges[0].angle))).toBeLessThan(0.2);
  });

  it('follows a river bank rather than crossing back and forth', () => {
    const terrain = plain((t, at) => {
      for (let x = 0; x < W; x++) t.riverDist[at(x, 22)] = 0;
    });
    expect(findRoad(terrain, WEST, EAST)!.bridges).toHaveLength(0);
  });

  it('joins a road that already exists instead of running beside it', () => {
    const terrain = plain();
    const first = findRoad(terrain, WEST, EAST)!;
    const used = new Uint8Array(W * H);
    markRoad(used, first);

    const south = { x: 5.5, y: 30.5 };
    const shared = (cells: Int32Array) => [...cells].filter((c) => used[c]).length;
    const alone = shared(findRoad(terrain, south, EAST)!.cells);
    const joined = shared(findRoad(terrain, south, EAST, used)!.cells);
    expect(joined).toBeGreaterThan(35);
    expect(joined).toBeGreaterThan(alone + 10);
  });

  it('routes across a generated map without touching the sea', () => {
    const wall = new Uint8Array(150 * 100);
    drawRing(wall, 150, 75, 50, 38);
    const map = generateMap(wall, 150, 100, 'aldoria')!;
    const road = findRoad(map, { x: 50, y: 50 }, { x: 100, y: 50 })!;
    expect(road).not.toBeNull();
    for (const c of road.cells) expect(map.biome[c]).not.toBe(Biome.Water);
  });
});

describe('distanceToRoad', () => {
  it('measures how far a position is from the road', () => {
    const road = findRoad(plain(), WEST, EAST)!;
    expect(distanceToRoad(road, 30.5, 20.5)).toBeCloseTo(0, 1);
    expect(distanceToRoad(road, 30.5, 26.5)).toBeCloseTo(6, 1);
    expect(distanceToRoad(road, 0.5, 20.5)).toBeCloseTo(5, 1);
  });
});
