import type { Building, BuildingKind, Site } from '../site/generate.ts';
import type { TavernQuality, TavernSize } from '../tavern/generate.ts';
import type { InteriorKind } from './generate.ts';

/** An interior to show: everything the generator needs to make it. */
export interface InteriorRequest {
  kind: InteriorKind;
  seed: string;
  size: TavernSize;
  quality: TavernQuality;
  name: string;
}

/** What kind of interior each building of a town has. Those left out have none. */
const INSIDE: Partial<Record<BuildingKind, InteriorKind>> = {
  house: 'house',
  tavern: 'tavern',
  inn: 'tavern',
  smithy: 'smithy',
  temple: 'temple',
  keep: 'castle',
  barracks: 'castle',
  tower: 'tower',
  academy: 'tower',
  lighthouse: 'tower',
  // Large houses of the town's business: a hall to receive in, rooms behind.
  hall: 'house',
  guild: 'house',
  harbor: 'house',
};

/** Buildings kept better than their neighbors. */
const FINE: readonly BuildingKind[] = ['keep', 'hall', 'guild', 'academy', 'temple'];

/** The building standing on a square of the map, if any. */
export function buildingAt(site: Site, x: number, y: number): Building | null {
  return site.buildings.find((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) ?? null;
}

/**
 * The interior of a building of a town, or null for what has none (a market
 * stall, a well, a warehouse). Kind, size and state follow the building: a
 * larger house has more rooms, a ruin is poor inside, the keep is rich. The
 * same building of the same town always opens on the same interior.
 */
export function interiorOf(site: Site, building: Building): InteriorRequest | null {
  const kind = INSIDE[building.kind];
  if (!kind) return null;
  const area = building.w * building.h;
  const size: TavernSize =
    building.kind === 'keep' || building.kind === 'tower' || building.kind === 'inn'
      ? 'large'
      : building.kind === 'lighthouse' || building.kind === 'barracks'
        ? 'small'
        : area <= 6
          ? 'small'
          : area <= 15
            ? 'medium'
            : 'large';
  const quality: TavernQuality = building.ruined
    ? 'poor'
    : FINE.includes(building.kind)
      ? 'rich'
      : site.kind === 'kingdom' && building.tone > 0.75
        ? 'rich'
        : site.kind === 'village' && building.tone < 0.4
          ? 'poor'
          : 'medium';
  // A notable building goes by the name it has on the map.
  const place = site.places.find(
    (p) =>
      p.x >= building.x &&
      p.x <= building.x + building.w &&
      p.y >= building.y &&
      p.y <= building.y + building.h,
  );
  return {
    kind,
    size,
    quality,
    seed: `${site.seed}-${building.x}-${building.y}`,
    name: place?.name ?? (building.ruined ? 'Casa em ruínas' : 'Casa'),
  };
}
