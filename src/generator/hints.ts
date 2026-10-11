import { clamp, sstep } from './grid.ts';
import { fbm, type Noise2D } from './noise.ts';

/** The base terrains: every piece of land is exactly one of these. */
export const TERRAIN_KINDS = ['mountains', 'forest', 'desert', 'swamp', 'plains'] as const;
export type TerrainKind = (typeof TERRAIN_KINDS)[number];

/** What the brush can paint: a base terrain, or snow, which lies on top of one. */
export const BRUSH_KINDS = [...TERRAIN_KINDS, 'snow'] as const;
export type BrushKind = (typeof BRUSH_KINDS)[number];

/** A dab of the terrain brush: "this area is <kind>". */
export interface TerrainHint {
  kind: BrushKind;
  /** Position in grid cells. */
  x: number;
  y: number;
}

/** How far a hint reaches, in cells. It is at full strength over the inner ~45%. */
export const HINT_RADIUS = 30;
/** How much (in cells) noise bends the edge of a hint, so areas don't come out as circles. */
const EDGE_WOBBLE = 7;

/** Part of a hint's reach where its terrain clearly shows; a click there picks that hint. */
export const HINT_CORE_RADIUS = HINT_RADIUS * 0.75;

/** The hint whose terrain covers the given cell position, if any (the nearest when several do). */
export function hintAt(hints: readonly TerrainHint[], x: number, y: number): TerrainHint | null {
  let best: TerrainHint | null = null;
  let bestDist = HINT_CORE_RADIUS;
  for (const hint of hints) {
    const d = Math.hypot(hint.x - x, hint.y - y);
    if (d < bestDist) {
      best = hint;
      bestDist = d;
    }
  }
  return best;
}

export interface ElevationLevels {
  /** Swamps only form below this. */
  low: number;
  hill: number;
  mountain: number;
}

/** Strength of a hint at a cell: 1 near its center, fading to 0 at its edge. */
export function hintWeight(hint: TerrainHint, x: number, y: number, noise: Noise2D): number {
  const distance = Math.hypot(x + 0.5 - hint.x, y + 0.5 - hint.y);
  return sstep(HINT_RADIUS, HINT_RADIUS * 0.45, distance + EDGE_WOBBLE * fbm(noise, x / 25, y / 25, 3));
}

function forEachCell(
  hint: TerrainHint,
  w: number,
  h: number,
  noise: Noise2D,
  visit: (i: number, weight: number, x: number, y: number) => void,
): void {
  const reach = HINT_RADIUS + EDGE_WOBBLE;
  const x0 = Math.max(0, Math.floor(hint.x - reach));
  const x1 = Math.min(w - 1, Math.ceil(hint.x + reach));
  const y0 = Math.max(0, Math.floor(hint.y - reach));
  const y1 = Math.min(h - 1, Math.ceil(hint.y + reach));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const weight = hintWeight(hint, x, y, noise);
      if (weight > 0) visit(y * w + x, weight, x, y);
    }
  }
}

/** How strongly each cell is hinted for `kind` (0..1), or null when no hint asks for it. */
export function hintCoverage(
  hints: readonly TerrainHint[],
  kind: BrushKind,
  w: number,
  h: number,
  noise: Noise2D,
): Float32Array | null {
  let coverage: Float32Array | null = null;
  for (const hint of hints) {
    if (hint.kind !== kind) continue;
    const out = (coverage ??= new Float32Array(w * h));
    forEachCell(hint, w, h, noise, (i, weight) => {
      if (weight > out[i]) out[i] = weight;
    });
  }
  return coverage;
}

/**
 * Raises mountains where asked and levels the ground under the other terrain
 * kinds, so a forest hint placed on a mountain range actually gets a forest.
 * Hints apply in order: where two overlap, the one placed later wins.
 */
export function applyElevationHints(
  hints: readonly TerrainHint[],
  elevation: Float32Array,
  land: Uint8Array,
  coastDist: Float32Array,
  levels: ElevationLevels,
  w: number,
  h: number,
  noise: Noise2D,
): void {
  for (const hint of hints) {
    // Snow lies on top of whatever is there, so it leaves the relief alone.
    if (hint.kind === 'snow') continue;
    forEachCell(hint, w, h, noise, (i, weight, x, y) => {
      if (!land[i]) return;
      const e = elevation[i];
      if (hint.kind === 'mountains') {
        const relief = clamp(fbm(noise, x / 18 + 40, y / 18, 3) * 0.5 + 0.5, 0, 1);
        const peak = levels.mountain + (1 - levels.mountain) * (0.15 + 0.7 * relief);
        // Keep the shore itself low so the coastline stays readable.
        elevation[i] = e + (Math.max(e, peak) - e) * weight * sstep(0, 5, coastDist[i]);
      } else {
        const ceiling = hint.kind === 'swamp' ? levels.low * 0.7 : levels.hill * 0.92;
        elevation[i] = e + (Math.min(e, ceiling) - e) * weight;
      }
    });
  }
}

/**
 * Pulls moisture and temperature toward what each hinted terrain needs. Later
 * hints win. Forest, plains and mountains keep whatever cold is there, so they
 * can sit under snow; swamp and desert warm the ground and melt it.
 */
export function applyClimateHints(
  hints: readonly TerrainHint[],
  moisture: Float32Array,
  temperature: Float32Array,
  w: number,
  h: number,
  noise: Noise2D,
): void {
  for (const hint of hints) {
    forEachCell(hint, w, h, noise, (i, weight) => {
      const m = moisture[i];
      const t = temperature[i];
      let wantM = m;
      let wantT = t;
      switch (hint.kind) {
        case 'forest':
          wantM = 0.64;
          break;
        case 'desert':
          wantM = 0.2;
          wantT = 0.8;
          break;
        case 'swamp':
          wantM = 0.85;
          wantT = Math.max(t, 0.45);
          break;
        case 'snow':
          wantT = 0.1;
          break;
        case 'plains':
          wantM = 0.4;
          // Capped only so that a dry plain does not turn into desert.
          wantT = Math.min(t, 0.58);
          break;
        case 'mountains':
          return;
      }
      moisture[i] = m + (wantM - m) * weight;
      temperature[i] = t + (wantT - t) * weight;
    });
  }
}
