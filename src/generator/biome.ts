/** The base terrain of a cell. Snow is not a biome: it lies on top of one (see `MapData.snow`). */
export const Biome = {
  Water: 0,
  Plains: 1,
  Forest: 2,
  Taiga: 3,
  Desert: 4,
  Swamp: 5,
  Hills: 7,
  Mountains: 8,
} as const;

/** Land colder than this is under snow. */
export const SNOW_LINE = 0.22;

/** Snow settles on plains, forests, hills and mountains, never on swamp or desert. */
export function canHoldSnow(biome: number): boolean {
  return biome !== Biome.Water && biome !== Biome.Swamp && biome !== Biome.Desert;
}
