export const STRUCTURE_KINDS = ['kingdom', 'city', 'village', 'tower', 'port', 'ruins', 'dungeon'] as const;
export type StructureKind = (typeof STRUCTURE_KINDS)[number];

export interface Structure {
  kind: StructureKind;
  /** Position of the icon's base, in grid cells. */
  x: number;
  y: number;
  name: string;
}

/** Drawn icon height in cells; sizes the cleared patch and the click target. */
export const ICON_HEIGHT: Record<StructureKind, number> = {
  kingdom: 19,
  city: 14,
  village: 9,
  tower: 15,
  port: 14,
  ruins: 9,
  dungeon: 9,
};

/** How close (in cells) a click must be to an icon's middle to hit it. */
const HIT_RADIUS = 10;

/** The structure whose icon is under the given cell position, if any. */
export function structureAt(structures: readonly Structure[], x: number, y: number): Structure | null {
  let best: Structure | null = null;
  let bestDist = HIT_RADIUS;
  for (const s of structures) {
    const d = Math.hypot(s.x - x, s.y - ICON_HEIGHT[s.kind] * 0.4 - y);
    if (d < bestDist) {
      best = s;
      bestDist = d;
    }
  }
  return best;
}

/** The box a structure's icon and name take up on the map, for keeping other labels off it. */
export function structureFootprint(structure: Structure): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const icon = ICON_HEIGHT[structure.kind];
  // The name is written under the icon, about 4 cells per letter and 9 cells tall.
  const nameHeight = 9;
  return {
    x: structure.x,
    y: structure.y + (nameHeight - icon) / 2,
    width: Math.max(icon, structure.name.length * 4),
    height: icon + nameHeight,
  };
}
