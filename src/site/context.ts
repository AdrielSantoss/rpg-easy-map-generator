import { Biome } from '../generator/biome.ts';
import type { MapData } from '../generator/index.ts';

/**
 * What the surroundings of a place decide about its map: the ground it stands
 * on, and from which sides a road arrives. On the world map both are read off
 * the structure the place is; on its own, the user picks them.
 */

export const SITE_TERRAINS = [
  'plains',
  'forest',
  'taiga',
  'desert',
  'swamp',
  'hills',
  'mountain',
  'snow',
] as const;
export type SiteTerrain = (typeof SITE_TERRAINS)[number];

export const SITE_SIDES = ['north', 'east', 'south', 'west'] as const;
export type SiteSide = (typeof SITE_SIDES)[number];

export interface SiteContext {
  terrain: SiteTerrain;
  /** The sides a road leaves by. None means the place has no way in. */
  exits: readonly SiteSide[];
  /** The name the place goes by; without one, a name is invented. */
  name?: string;
}

const BIOME_TERRAIN: Record<number, SiteTerrain> = {
  [Biome.Plains]: 'plains',
  [Biome.Forest]: 'forest',
  [Biome.Taiga]: 'taiga',
  [Biome.Desert]: 'desert',
  [Biome.Swamp]: 'swamp',
  [Biome.Hills]: 'hills',
  [Biome.Mountains]: 'mountain',
};

/** How far around a structure the land is looked at, in cells. */
const SURROUNDINGS = 5;

/**
 * The terrain a structure of the world map stands on: whatever most of the
 * land around it is, so that one odd cell under the icon does not decide.
 * Snow counts as a terrain of its own, since it is what one sees.
 */
export function terrainAt(
  map: Pick<MapData, 'w' | 'h' | 'biome' | 'snow'>,
  x: number,
  y: number,
): SiteTerrain {
  const count = new Map<SiteTerrain, number>();
  for (let dy = -SURROUNDINGS; dy <= SURROUNDINGS; dy++) {
    for (let dx = -SURROUNDINGS; dx <= SURROUNDINGS; dx++) {
      const cx = Math.round(x) + dx;
      const cy = Math.round(y) + dy;
      if (cx < 0 || cy < 0 || cx >= map.w || cy >= map.h || dx * dx + dy * dy > SURROUNDINGS ** 2) continue;
      const index = cy * map.w + cx;
      const terrain = map.snow[index] ? 'snow' : BIOME_TERRAIN[map.biome[index]];
      // Water around a port says nothing about the land it is built on.
      if (terrain) count.set(terrain, (count.get(terrain) ?? 0) + 1);
    }
  }
  let best: SiteTerrain = 'plains';
  let most = 0;
  for (const [terrain, cells] of count) {
    if (cells > most) {
      best = terrain;
      most = cells;
    }
  }
  return best;
}

/** How far along a road its direction is taken, in cells: past the bends right at the gate. */
const REACH = 30;

/**
 * The side of a structure a road leaves it by. `cells` are the cells of the
 * road from one end to the other, either of which may be the structure's.
 */
export function roadSide(cells: ArrayLike<number>, mapWidth: number, x: number, y: number): SiteSide {
  const at = (index: number) => ({ x: cells[index] % mapWidth, y: Math.floor(cells[index] / mapWidth) });
  const last = cells.length - 1;
  const first = at(0);
  const end = at(last);
  const startsHere = Math.hypot(first.x - x, first.y - y) <= Math.hypot(end.x - x, end.y - y);
  const away = at(startsHere ? Math.min(REACH, last) : Math.max(0, last - REACH));
  const dx = away.x - x;
  const dy = away.y - y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'east' : 'west';
  return dy >= 0 ? 'south' : 'north';
}

/** The sides the roads of a structure leave it by, each side once, in compass order. */
export function exitsOf(
  roads: readonly ArrayLike<number>[],
  mapWidth: number,
  x: number,
  y: number,
): SiteSide[] {
  const sides = new Set(roads.map((cells) => roadSide(cells, mapWidth, x, y)));
  return SITE_SIDES.filter((side) => sides.has(side));
}
