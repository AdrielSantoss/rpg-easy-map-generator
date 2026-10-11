import { Biome, canHoldSnow } from './biome.ts';
import { clamp, percentile } from './grid.ts';
import { TERRAIN_KINDS, type BrushKind, type TerrainKind } from './hints.ts';

/**
 * Share of the land each base terrain covers. "mountains" includes the
 * foothills around the peaks and "forest" includes pine forest.
 */
export type TerrainShares = Record<TerrainKind, number>;

export interface TerrainDistribution {
  shares: TerrainShares;
  /**
   * Fraction of the land (0..1) under snow. Snow lies on top of the base
   * terrains, so this is independent of the shares.
   */
  snow: number;
}

/** Part of the "mountains" share drawn as peaks; the rest becomes foothills. */
export const PEAK_SHARE = 0.6;

/** Elevation levels no cell can reach, used when the map should have no highlands. */
const NO_HILLS = 2;
const NO_MOUNTAINS = 3;

/**
 * Scales the terrain shares to add up to 1 and limits snow to 0..1.
 * Returns null when every share is zero.
 */
export function normalizeDistribution(distribution: TerrainDistribution): TerrainDistribution | null {
  let total = 0;
  for (const kind of TERRAIN_KINDS) total += Math.max(0, distribution.shares[kind]);
  if (total <= 0) return null;
  const shares = {} as TerrainShares;
  for (const kind of TERRAIN_KINDS) shares[kind] = Math.max(0, distribution.shares[kind]) / total;
  return { shares, snow: clamp(distribution.snow, 0, 1) };
}

/** The share of land each terrain, and snow, actually covers on a generated map. */
export function measureDistribution(biome: Uint8Array, snow: Uint8Array): TerrainDistribution {
  const shares: TerrainShares = { mountains: 0, forest: 0, desert: 0, swamp: 0, plains: 0 };
  let land = 0;
  let snowed = 0;
  for (let i = 0; i < biome.length; i++) {
    const b = biome[i];
    if (b === Biome.Water) continue;
    land++;
    if (snow[i]) snowed++;
    if (b === Biome.Mountains || b === Biome.Hills) shares.mountains++;
    else if (b === Biome.Forest || b === Biome.Taiga) shares.forest++;
    else if (b === Biome.Desert) shares.desert++;
    else if (b === Biome.Swamp) shares.swamp++;
    else shares.plains++;
  }
  if (land === 0) return { shares, snow: 0 };
  for (const kind of TERRAIN_KINDS) shares[kind] /= land;
  return { shares, snow: snowed / land };
}

/** Sorts `cells` so the ones ranking highest come first. */
function byRank(cells: number[], score: Float32Array, rank: (i: number) => number): void {
  for (const i of cells) score[i] = rank(i);
  cells.sort((a, b) => score[b] - score[a]);
}

/**
 * Assigns a biome to every land cell so that each terrain covers its target
 * share, then lays snow over the target fraction of the land. Each goes where
 * the natural climate suits it best: mountains on the highest ground, snow in
 * the coldest places, desert where it is hot and dry, and so on. Swamp and
 * desert are kept out of the snow, so snow can fall short of its target when
 * those two need the cold ground. `coverage` (0..1 per cell) marks areas the
 * user painted; those are served first, as far as the targets allow.
 * `target` must already be normalized.
 */
export function distributeBiomes(
  target: TerrainDistribution,
  land: Uint8Array,
  elevation: Float32Array,
  moisture: Float32Array,
  temperature: Float32Array,
  coverage: Partial<Record<BrushKind, Float32Array>>,
  biome: Uint8Array,
  snow: Uint8Array,
): { hillLevel: number; mountainLevel: number } {
  const { shares } = target;
  const cells: number[] = [];
  for (let i = 0; i < land.length; i++) if (land[i]) cells.push(i);
  const score = new Float32Array(land.length);
  const painted = (kind: BrushKind, i: number) => 2 * (coverage[kind]?.[i] ?? 0);

  // Snow first, on the coldest ground, so the terrains that cannot take it can avoid it.
  const coldest = cells.slice();
  byRank(coldest, score, (i) => -temperature[i] + painted('snow', i));
  const snowQuota = Math.round(target.snow * cells.length);
  for (let p = 0; p < snowQuota; p++) snow[coldest[p]] = 1;

  const sorted = Float32Array.from(cells, (i) => elevation[i]).sort();
  let hillLevel = NO_HILLS;
  let mountainLevel = NO_MOUNTAINS;
  if (shares.mountains > 0) {
    hillLevel = percentile(sorted, 1 - shares.mountains);
    // Kept strictly above the hill level so renderers can blend between the two.
    mountainLevel = Math.max(percentile(sorted, 1 - shares.mountains * PEAK_SHARE), hillLevel + 1e-4);
  }

  let rest: number[] = [];
  for (const i of cells) {
    if (elevation[i] >= mountainLevel) biome[i] = Biome.Mountains;
    else if (elevation[i] >= hillLevel) biome[i] = Biome.Hills;
    else rest.push(i);
  }

  // Lowland terrains claim cells in this order, each taking the cells that rank
  // highest for it. Desert and swamp rank snowy ground last.
  const avoidSnow = (i: number) => -10 * snow[i];
  const lowland: { kind: TerrainKind; rank: (i: number) => number; paint: (i: number) => number }[] = [
    {
      kind: 'desert',
      rank: (i) => temperature[i] - moisture[i] + avoidSnow(i),
      paint: () => Biome.Desert,
    },
    {
      kind: 'swamp',
      rank: (i) => moisture[i] - 2 * elevation[i] + avoidSnow(i),
      paint: () => Biome.Swamp,
    },
    {
      kind: 'forest',
      rank: (i) => moisture[i],
      // Broadleaf trees do not grow in the cold or under snow; pines do.
      paint: (i) => (snow[i] || temperature[i] < 0.4 ? Biome.Taiga : Biome.Forest),
    },
    { kind: 'plains', rank: () => 0, paint: () => Biome.Plains },
  ];
  let last = lowland.length - 1;
  while (last >= 0 && shares[lowland[last].kind] <= 0) last--;
  if (last < 0) {
    for (const i of rest) biome[i] = Biome.Hills;
    return { hillLevel, mountainLevel };
  }

  for (let k = 0; k <= last; k++) {
    const { kind, rank, paint } = lowland[k];
    // The last wanted terrain takes whatever is left, absorbing rounding.
    const quota = k === last ? rest.length : Math.min(rest.length, Math.round(shares[kind] * cells.length));
    if (quota === 0) continue;
    if (quota < rest.length) byRank(rest, score, (i) => rank(i) + painted(kind, i));
    for (let p = 0; p < quota; p++) {
      const i = rest[p];
      biome[i] = paint(i);
      // Where swamp or desert had to take snowy ground, the snow gives way.
      if (!canHoldSnow(biome[i])) snow[i] = 0;
    }
    rest = rest.slice(quota);
  }
  return { hillLevel, mountainLevel };
}

/**
 * Nudges moisture and temperature into the range that matches each cell's
 * assigned biome and snow cover, so the painted colors agree with the icons.
 */
export function conformClimate(
  biome: Uint8Array,
  snow: Uint8Array,
  moisture: Float32Array,
  temperature: Float32Array,
): void {
  for (let i = 0; i < biome.length; i++) {
    const m = moisture[i];
    switch (biome[i]) {
      case Biome.Water:
        continue;
      case Biome.Desert:
        moisture[i] = Math.min(m, 0.34);
        temperature[i] = Math.max(temperature[i], 0.7);
        continue;
      case Biome.Swamp:
        moisture[i] = Math.max(m, 0.74);
        break;
      case Biome.Forest:
      case Biome.Taiga:
        moisture[i] = Math.max(m, 0.64);
        break;
      case Biome.Plains:
        moisture[i] = Math.min(m, 0.44);
        temperature[i] = Math.min(temperature[i], 0.55);
        break;
    }
    temperature[i] = snow[i] ? Math.min(temperature[i], 0.14) : Math.max(temperature[i], 0.3);
  }
}
