import { chamferDistance } from './grid.ts';
import { fbm, type Noise2D } from './noise.ts';

/** Strokes are thickened by this many cells so small gaps in the outline still close. */
const CLOSE_R = 2;
/** Land thinner than about twice this is dropped (stray lines that enclose nothing). */
const OPEN_R = 2;
/**
 * Enclosed pockets smaller than this, measured after the strokes around them
 * were thickened, are specks left by overlapping strokes rather than lakes. A
 * lake drawn about 14 sketch pixels wide is the smallest that passes.
 */
const MIN_LAKE_CELLS = 3;
/** How far (in cells) the noise can push the coast away from the drawn line. */
const COAST_ROUGHNESS = 8;
/**
 * Around a lake the roughening is held to this fraction of the lake's own
 * radius, so a small lake keeps its size instead of being erased or flooding
 * the land around it.
 */
const LAKE_ROUGHNESS = 0.5;
/**
 * How much roughness comes back per cell of distance from a lake. Below 1, so
 * the land around a lake stays land however hard the noise pushes.
 */
const LAKE_EASE = 0.5;

/**
 * Turns the drawn strokes into a signed "land field": positive on land,
 * negative on water, roughly the distance to the coast in cells.
 * Returns null when the sketch encloses no area.
 */
export function buildLandField(
  wall: Uint8Array,
  w: number,
  h: number,
  coastNoise: Noise2D,
): Float32Array | null {
  const n = w * h;
  if (!wall.includes(1)) return null;

  const wallDist = chamferDistance(wall, w, h);
  const solid = new Uint8Array(n);
  for (let i = 0; i < n; i++) solid[i] = wallDist[i] <= CLOSE_R ? 1 : 0;

  // depth = how many outlines must be crossed to get here from the map border.
  // Even depth is water (ocean, lakes), odd depth is land (continents, islands in lakes).
  const depth = new Int16Array(n).fill(-1);
  const frontier: number[] = [];
  const seed = (i: number) => {
    if (depth[i] < 0) {
      depth[i] = 0;
      frontier.push(i);
    }
  };
  for (let x = 0; x < w; x++) {
    seed(x);
    seed((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    seed(y * w);
    seed(y * w + w - 1);
  }
  let level = 0;
  while (frontier.length) {
    const crossed: number[] = [];
    while (frontier.length) {
      const c = frontier.pop()!;
      const x = c % w;
      const y = (c / w) | 0;
      for (let k = 0; k < 4; k++) {
        const nx = x + (k === 0 ? 1 : k === 1 ? -1 : 0);
        const ny = y + (k === 2 ? 1 : k === 3 ? -1 : 0);
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const nb = ny * w + nx;
        if (depth[nb] >= 0) continue;
        if (solid[c] && !solid[nb]) {
          crossed.push(nb);
        } else {
          depth[nb] = level;
          frontier.push(nb);
        }
      }
    }
    level++;
    for (const c of crossed) {
      if (depth[c] < 0) {
        depth[c] = level;
        frontier.push(c);
      }
    }
  }

  const land = new Uint8Array(n);
  for (let i = 0; i < n; i++) land[i] = solid[i] || depth[i] & 1 ? 1 : 0;
  fillSmallLakes(land, depth, w, h);

  // Erode to undo the thickening and drop thin slivers, then grow back.
  const water = invert(land);
  const waterDist = chamferDistance(water, w, h);
  const core = new Uint8Array(n);
  let hasCore = false;
  for (let i = 0; i < n; i++) {
    if (land[i] && waterDist[i] > CLOSE_R + OPEN_R) {
      core[i] = 1;
      hasCore = true;
    }
  }
  if (!hasCore) return null;
  const coreDist = chamferDistance(core, w, h);
  for (let i = 0; i < n; i++) land[i] = coreDist[i] <= OPEN_R ? 1 : 0;

  // Signed distance to the cleaned-up coast, roughened with fractal noise so a
  // simple sketch still gets bays, capes and islets.
  const toWater = chamferDistance(invert(land), w, h);
  const toLand = chamferDistance(land, w, h);
  const roughness = roughnessAroundLakes(land, toLand, w, h);
  const field = new Float32Array(n);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const signed = land[i] ? toWater[i] - 0.5 : 0.5 - toLand[i];
      field[i] = signed + roughness[i] * fbm(coastNoise, x / 45, y / 45, 5, 0.6);
    }
  }
  return field;
}

/**
 * How far the noise may move the coast at each cell: the full roughness along
 * the sea, less inside and around each lake in proportion to the lake's size,
 * easing back to full with distance from it.
 */
function roughnessAroundLakes(land: Uint8Array, toLand: Float32Array, w: number, h: number): Float32Array {
  const n = w * h;
  const roughness = new Float32Array(n).fill(COAST_ROUGHNESS);
  const neighbors = (c: number, visit: (nb: number) => void) => {
    const x = c % w;
    const y = (c / w) | 0;
    if (x > 0) visit(c - 1);
    if (x < w - 1) visit(c + 1);
    if (y > 0) visit(c - w);
    if (y < h - 1) visit(c + w);
  };

  // Water reachable from the map border is sea; the rest is lakes.
  const seen = new Uint8Array(n);
  const sea: number[] = [];
  const enter = (c: number) => {
    if (!land[c] && !seen[c]) {
      seen[c] = 1;
      sea.push(c);
    }
  };
  for (let x = 0; x < w; x++) {
    enter(x);
    enter((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    enter(y * w);
    enter(y * w + w - 1);
  }
  while (sea.length) neighbors(sea.pop()!, enter);

  // Each lake calms the noise over itself, then less and less over the cells
  // around it, one ring at a time.
  let ring: number[] = [];
  for (let start = 0; start < n; start++) {
    if (land[start] || seen[start]) continue;
    const lake = [start];
    seen[start] = 1;
    let radius = 0;
    for (let p = 0; p < lake.length; p++) {
      radius = Math.max(radius, toLand[lake[p]]);
      neighbors(lake[p], (nb) => {
        if (!land[nb] && !seen[nb]) {
          seen[nb] = 1;
          lake.push(nb);
        }
      });
    }
    const calm = LAKE_ROUGHNESS * radius;
    if (calm >= COAST_ROUGHNESS) continue;
    for (const c of lake) roughness[c] = calm;
    ring.push(...lake);
  }
  while (ring.length) {
    const next: number[] = [];
    for (const c of ring) {
      neighbors(c, (nb) => {
        if (roughness[c] + LAKE_EASE < roughness[nb]) {
          roughness[nb] = roughness[c] + LAKE_EASE;
          next.push(nb);
        }
      });
    }
    ring = next;
  }
  return roughness;
}

function invert(mask: Uint8Array): Uint8Array {
  const out = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) out[i] = mask[i] ? 0 : 1;
  return out;
}

function fillSmallLakes(land: Uint8Array, depth: Int16Array, w: number, h: number): void {
  const seen = new Uint8Array(land.length);
  for (let start = 0; start < land.length; start++) {
    if (land[start] || seen[start] || depth[start] < 2) continue;
    const cells = [start];
    seen[start] = 1;
    for (let p = 0; p < cells.length; p++) {
      const c = cells[p];
      const x = c % w;
      const y = (c / w) | 0;
      const visit = (nb: number) => {
        if (!land[nb] && !seen[nb]) {
          seen[nb] = 1;
          cells.push(nb);
        }
      };
      if (x > 0) visit(c - 1);
      if (x < w - 1) visit(c + 1);
      if (y > 0) visit(c - w);
      if (y < h - 1) visit(c + w);
    }
    if (cells.length < MIN_LAKE_CELLS) for (const c of cells) land[c] = 1;
  }
}
