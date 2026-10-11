import { Biome, canHoldSnow, SNOW_LINE } from './biome.ts';
import {
  conformClimate,
  distributeBiomes,
  measureDistribution,
  normalizeDistribution,
  type TerrainDistribution,
} from './distribution.ts';
import { boxBlur, chamferDistance, clamp, percentile, sstep } from './grid.ts';
import {
  applyClimateHints,
  applyElevationHints,
  BRUSH_KINDS,
  hintCoverage,
  type BrushKind,
  type TerrainHint,
} from './hints.ts';
import { buildLandField } from './landmask.ts';
import { createNoise2D, fbm, ridged } from './noise.ts';
import { carveRivers, type River } from './rivers.ts';
import { seededRng } from './rng.ts';

export { Biome };

export interface MapData {
  seed: string;
  w: number;
  h: number;
  /** Signed coast field: > 0 is land, magnitude is roughly cells from the coast. */
  field: Float32Array;
  /** 0..1 on land, 0 on water. */
  elevation: Float32Array;
  moisture: Float32Array;
  /** 0 (cold, top of the map) .. 1 (hot). */
  temperature: Float32Array;
  /** Base terrain of each cell (see Biome). */
  biome: Uint8Array;
  /** 1 where the land is under snow. Snow lies on top of the biome, never on swamp or desert. */
  snow: Uint8Array;
  coastDist: Float32Array;
  riverDist: Float32Array;
  rivers: River[];
  hillLevel: number;
  mountainLevel: number;
  /** Share of the land each terrain, and snow, ended up covering. */
  distribution: TerrainDistribution;
}

export interface GenerateOptions {
  /**
   * The user's "this area is forest / mountains / ..." markers. They reshape
   * the terrain around them but never move the coast.
   */
  hints?: readonly TerrainHint[];
  /**
   * How much of the land each terrain should cover (any scale; it is
   * normalized). Without it the shares fall out of the natural climate.
   */
  distribution?: TerrainDistribution | null;
}

/** Cells over which climate is smoothed after biomes are forced to match a distribution. */
const CLIMATE_BLUR = 2;

/**
 * Builds the whole map from the rasterized sketch (`wall[i]` = 1 where the
 * user drew). Same sketch, seed and options always give the same map.
 * Returns null when the sketch encloses no land.
 */
export function generateMap(
  wall: Uint8Array,
  w: number,
  h: number,
  seed: string,
  { hints = [], distribution = null }: GenerateOptions = {},
): MapData | null {
  const rng = seededRng(seed);
  const coastNoise = createNoise2D(rng);
  const elevNoise = createNoise2D(rng);
  const ridgeNoise = createNoise2D(rng);
  const moistNoise = createNoise2D(rng);
  const tempNoise = createNoise2D(rng);
  const hintNoise = createNoise2D(rng);

  const field = buildLandField(wall, w, h, coastNoise);
  if (!field) return null;

  const n = w * h;
  const land = new Uint8Array(n);
  const water = new Uint8Array(n);
  let landCount = 0;
  for (let i = 0; i < n; i++) {
    if (field[i] > 0) {
      land[i] = 1;
      landCount++;
    } else {
      water[i] = 1;
    }
  }
  if (landCount === 0) return null;

  const coastDist = chamferDistance(water, w, h);

  // Elevation: low at the coast, rising inland, with ridged noise laying
  // mountain ranges across the interior.
  const elevation = new Float32Array(n);
  let maxElev = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!land[i]) continue;
      const d = coastDist[i];
      const interior = sstep(0, 45, d);
      const rolling = fbm(elevNoise, x / 85, y / 85, 5) * 0.5 + 0.5;
      const ridge = sstep(0.6, 0.95, ridged(ridgeNoise, x / 140, y / 140, 4));
      const e =
        0.05 +
        0.28 * interior +
        0.25 * rolling * (0.35 + 0.65 * interior) +
        0.5 * sstep(2, 20, d) * ridge * (0.5 + 0.5 * rolling);
      elevation[i] = e;
      if (e > maxElev) maxElev = e;
    }
  }
  for (let i = 0; i < n; i++) elevation[i] /= maxElev;

  const sortedElev = new Float32Array(landCount);
  for (let i = 0, p = 0; i < n; i++) if (land[i]) sortedElev[p++] = elevation[i];
  sortedElev.sort();
  const lowLevel = percentile(sortedElev, 0.35);
  let hillLevel = percentile(sortedElev, 0.72);
  let mountainLevel = percentile(sortedElev, 0.87);

  // Levels come from the natural terrain, so asking for mountains in one place
  // does not take them away somewhere else.
  const levels = { low: lowLevel, hill: hillLevel, mountain: mountainLevel };
  applyElevationHints(hints, elevation, land, coastDist, levels, w, h, hintNoise);

  const baseMoisture = new Float32Array(n);
  const rain = new Float32Array(n);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      baseMoisture[i] = fbm(moistNoise, x / 120, y / 120, 4) * 0.5 + 0.5;
      rain[i] = 0.4 + baseMoisture[i] + 1.2 * elevation[i];
    }
  }

  const { rivers, riverMask } = carveRivers(land, elevation, rain, w, h);
  const riverDist = chamferDistance(riverMask, w, h);

  const moisture = new Float32Array(n);
  const temperature = new Float32Array(n);
  const biome = new Uint8Array(n);
  const snow = new Uint8Array(n);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const e = elevation[i];
      moisture[i] = clamp(
        baseMoisture[i] + 0.25 * Math.exp(-riverDist[i] / 6) + 0.1 * Math.exp(-coastDist[i] / 8),
        0,
        1,
      );
      temperature[i] = clamp(
        0.22 + 0.55 * (y / h) + 0.22 * fbm(tempNoise, x / 200, y / 200, 3) - 0.35 * Math.max(0, e - 0.45),
        0,
        1,
      );
    }
  }
  applyClimateHints(hints, moisture, temperature, w, h, hintNoise);

  const target = distribution && normalizeDistribution(distribution);
  if (target) {
    const coverage: Partial<Record<BrushKind, Float32Array>> = {};
    for (const kind of BRUSH_KINDS) {
      const hinted = hintCoverage(hints, kind, w, h, hintNoise);
      if (hinted) coverage[kind] = hinted;
    }
    ({ hillLevel, mountainLevel } = distributeBiomes(
      target,
      land,
      elevation,
      moisture,
      temperature,
      coverage,
      biome,
      snow,
    ));
    // Biomes no longer follow the climate thresholds, so bring the climate to
    // them and soften the seams that leaves between neighboring biomes.
    conformClimate(biome, snow, moisture, temperature);
    moisture.set(boxBlur(moisture, w, h, CLIMATE_BLUR));
    temperature.set(boxBlur(temperature, w, h, CLIMATE_BLUR));
  } else {
    for (let i = 0; i < n; i++) {
      const e = elevation[i];
      const m = moisture[i];
      const t = temperature[i];
      if (!land[i]) biome[i] = Biome.Water;
      else if (e >= mountainLevel) biome[i] = Biome.Mountains;
      else if (e >= hillLevel) biome[i] = Biome.Hills;
      else if (t > 0.62 && m < 0.42) biome[i] = Biome.Desert;
      else if (m > 0.7 && e < lowLevel && t > 0.35) biome[i] = Biome.Swamp;
      else if (m > 0.54) biome[i] = t < 0.4 ? Biome.Taiga : Biome.Forest;
      else biome[i] = Biome.Plains;
      // Swamp and desert only form where it is warm, so they never meet the snow.
      if (t < SNOW_LINE && canHoldSnow(biome[i])) snow[i] = 1;
    }
  }

  return {
    seed,
    w,
    h,
    field,
    elevation,
    moisture,
    temperature,
    biome,
    snow,
    coastDist,
    riverDist,
    rivers,
    hillLevel,
    mountainLevel,
    distribution: measureDistribution(biome, snow),
  };
}
