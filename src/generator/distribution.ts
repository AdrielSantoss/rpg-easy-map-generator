import { Biome } from './biome.ts';
import { clamp, percentile } from './grid.ts';
import { TERRAIN_KINDS, type TerrainKind } from './hints.ts';

/**
 * Share of the land each terrain covers. "mountains" includes the foothills
 * around the peaks and "forest" includes cold pine forest.
 */
export type TerrainDistribution = Record<TerrainKind, number>;

/** Part of the "mountains" share drawn as peaks; the rest becomes foothills. */
export const PEAK_SHARE = 0.6;

/** Elevation levels no cell can reach, used when the map should have no highlands. */
const NO_HILLS = 2;
const NO_MOUNTAINS = 3;

/** Scales the shares to add up to 1. Returns null when they are all zero. */
export function normalizeDistribution(shares: TerrainDistribution): TerrainDistribution | null {
  let total = 0;
  for (const kind of TERRAIN_KINDS) total += Math.max(0, shares[kind]);
  if (total <= 0) return null;
  const normalized = {} as TerrainDistribution;
  for (const kind of TERRAIN_KINDS) normalized[kind] = Math.max(0, shares[kind]) / total;
  return normalized;
}

/** The share of land each terrain actually covers on a generated map. */
export function measureDistribution(biome: Uint8Array): TerrainDistribution {
  const count: TerrainDistribution = { mountains: 0, forest: 0, desert: 0, swamp: 0, tundra: 0, plains: 0 };
  let land = 0;
  for (const b of biome) {
    if (b === Biome.Water) continue;
    land++;
    if (b === Biome.Mountains || b === Biome.Hills) count.mountains++;
    else if (b === Biome.Forest || b === Biome.Taiga) count.forest++;
    else if (b === Biome.Desert) count.desert++;
    else if (b === Biome.Swamp) count.swamp++;
    else if (b === Biome.Tundra) count.tundra++;
    else count.plains++;
  }
  if (land > 0) for (const kind of TERRAIN_KINDS) count[kind] /= land;
  return count;
}

/**
 * Assigns a biome to every land cell so that each terrain covers its target
 * share. Each terrain goes where the natural climate suits it best: mountains
 * on the highest ground, snow in the coldest places, desert where it is hot
 * and dry, and so on. `coverage` (0..1 per cell) marks areas the user hinted
 * for a terrain; those are served first, as far as that terrain's share allows.
 * `target` must already be normalized.
 */
export function distributeBiomes(
  target: TerrainDistribution,
  land: Uint8Array,
  elevation: Float32Array,
  moisture: Float32Array,
  temperature: Float32Array,
  coverage: Partial<Record<TerrainKind, Float32Array>>,
  biome: Uint8Array,
): { hillLevel: number; mountainLevel: number } {
  const cells: number[] = [];
  for (let i = 0; i < land.length; i++) if (land[i]) cells.push(i);

  const sorted = Float32Array.from(cells, (i) => elevation[i]).sort();
  let hillLevel = NO_HILLS;
  let mountainLevel = NO_MOUNTAINS;
  if (target.mountains > 0) {
    hillLevel = percentile(sorted, 1 - target.mountains);
    // Kept strictly above the hill level so renderers can blend between the two.
    mountainLevel = Math.max(percentile(sorted, 1 - target.mountains * PEAK_SHARE), hillLevel + 1e-4);
  }

  let rest: number[] = [];
  for (const i of cells) {
    if (elevation[i] >= mountainLevel) biome[i] = Biome.Mountains;
    else if (elevation[i] >= hillLevel) biome[i] = Biome.Hills;
    else rest.push(i);
  }

  // Lowland terrains claim cells in this order, each taking the cells that rank highest for it.
  const lowland: { kind: TerrainKind; rank: (i: number) => number; paint: (i: number) => number }[] = [
    { kind: 'tundra', rank: (i) => -temperature[i], paint: () => Biome.Tundra },
    { kind: 'desert', rank: (i) => temperature[i] - moisture[i], paint: () => Biome.Desert },
    { kind: 'swamp', rank: (i) => moisture[i] - 2 * elevation[i], paint: () => Biome.Swamp },
    {
      kind: 'forest',
      rank: (i) => moisture[i],
      paint: (i) => (temperature[i] < 0.4 ? Biome.Taiga : Biome.Forest),
    },
    { kind: 'plains', rank: () => 0, paint: () => Biome.Plains },
  ];
  let last = lowland.length - 1;
  while (last >= 0 && target[lowland[last].kind] <= 0) last--;
  if (last < 0) {
    for (const i of rest) biome[i] = Biome.Hills;
    return { hillLevel, mountainLevel };
  }

  const score = new Float32Array(land.length);
  for (let k = 0; k <= last; k++) {
    const { kind, rank, paint } = lowland[k];
    // The last wanted terrain takes whatever is left, absorbing rounding.
    const quota = k === last ? rest.length : Math.min(rest.length, Math.round(target[kind] * cells.length));
    if (quota === 0) continue;
    if (quota < rest.length) {
      const hinted = coverage[kind];
      for (const i of rest) score[i] = rank(i) + (hinted ? 2 * hinted[i] : 0);
      rest.sort((a, b) => score[b] - score[a]);
    }
    for (let p = 0; p < quota; p++) biome[rest[p]] = paint(rest[p]);
    rest = rest.slice(quota);
  }
  return { hillLevel, mountainLevel };
}

/**
 * Nudges moisture and temperature into the range that matches each cell's
 * assigned biome, so the painted colors agree with the terrain icons.
 */
export function conformClimate(biome: Uint8Array, moisture: Float32Array, temperature: Float32Array): void {
  for (let i = 0; i < biome.length; i++) {
    const m = moisture[i];
    const t = temperature[i];
    switch (biome[i]) {
      case Biome.Tundra:
        temperature[i] = Math.min(t, 0.14);
        break;
      case Biome.Desert:
        moisture[i] = Math.min(m, 0.34);
        temperature[i] = Math.max(t, 0.7);
        break;
      case Biome.Swamp:
        moisture[i] = Math.max(m, 0.74);
        temperature[i] = Math.max(t, 0.3);
        break;
      case Biome.Forest:
      case Biome.Taiga:
        moisture[i] = Math.max(m, 0.64);
        temperature[i] = Math.max(t, 0.3);
        break;
      case Biome.Plains:
        moisture[i] = Math.min(m, 0.44);
        temperature[i] = clamp(t, 0.3, 0.55);
        break;
    }
  }
}
