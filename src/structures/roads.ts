import { Biome } from '../generator/biome.ts';
import type { MapData } from '../generator/index.ts';

export interface Bridge {
  x: number;
  y: number;
  /** Direction the road runs across the river, in radians. */
  angle: number;
}

/** The route of one road, in grid cells. */
export interface RoadPath {
  /** Indices of the cells the road passes through, from start to end. */
  cells: Int32Array;
  /** x,y pairs of the smoothed line to draw. */
  points: Float32Array;
  bridges: Bridge[];
}

/** What the routing needs to know about the map. */
export type RoadTerrain = Pick<MapData, 'w' | 'h' | 'biome' | 'snow' | 'elevation' | 'riverDist'>;

/** How hard each terrain is to cross, relative to open plains. Water is not crossable at all. */
const TERRAIN_COST: Record<number, number> = {
  [Biome.Plains]: 1,
  [Biome.Desert]: 1.6,
  [Biome.Forest]: 1.7,
  [Biome.Taiga]: 1.7,
  [Biome.Hills]: 2.6,
  [Biome.Swamp]: 4,
  [Biome.Mountains]: 9,
};
/** Extra cost of a cell under snow. */
const SNOW_COST = 0.6;
/** Extra cost of each cell of river band crossed: bridges are built only where they pay off. */
const RIVER_COST = 3;
/** Cost per unit of elevation climbed or descended in one step. */
const SLOPE_COST = 60;
/** Cost multiplier on cells that already carry a road, so a new road joins the old ones. */
const REUSE_DISCOUNT = 0.3;
/**
 * Cells within this distance of a river's centerline count as river. Wide
 * enough that a road cannot slip diagonally between two river cells unnoticed.
 */
const RIVER_HALF_WIDTH = 1.5;

const NX = [1, 1, 0, -1, -1, -1, 0, 1];
const NY = [0, 1, 1, 1, 0, -1, -1, -1];

/** Binary min-heap of (priority, cell) pairs. The same cell may be queued more than once. */
class Queue {
  private priorities: number[] = [];
  private cells: number[] = [];

  get size(): number {
    return this.cells.length;
  }

  push(cell: number, priority: number): void {
    const { priorities, cells } = this;
    let p = cells.length;
    while (p > 0) {
      const parent = (p - 1) >> 1;
      if (priorities[parent] <= priority) break;
      priorities[p] = priorities[parent];
      cells[p] = cells[parent];
      p = parent;
    }
    priorities[p] = priority;
    cells[p] = cell;
  }

  pop(): number {
    const { priorities, cells } = this;
    const top = cells[0];
    const lastPriority = priorities.pop()!;
    const lastCell = cells.pop()!;
    const size = cells.length;
    if (size > 0) {
      let p = 0;
      for (;;) {
        let child = 2 * p + 1;
        if (child >= size) break;
        if (child + 1 < size && priorities[child + 1] < priorities[child]) child++;
        if (priorities[child] >= lastPriority) break;
        priorities[p] = priorities[child];
        cells[p] = cells[child];
        p = child;
      }
      priorities[p] = lastPriority;
      cells[p] = lastCell;
    }
    return top;
  }
}

/**
 * Finds the easiest overland route between two points (A* over the grid). It
 * goes around mountains and swamps, crosses rivers as few times as it can and
 * never enters water. `used` marks cells that already carry a road; the route
 * prefers them, which is what makes roads merge into a network.
 * Returns null when the two points are not connected by land.
 */
export function findRoad(
  map: RoadTerrain,
  from: { x: number; y: number },
  to: { x: number; y: number },
  used: Uint8Array | null = null,
): RoadPath | null {
  const { w, h, biome, snow, elevation, riverDist } = map;
  const cellOf = (p: { x: number; y: number }) => {
    if (p.x < 0 || p.y < 0 || p.x >= w || p.y >= h) return -1;
    return Math.floor(p.y) * w + Math.floor(p.x);
  };
  const start = cellOf(from);
  const goal = cellOf(to);
  if (start < 0 || goal < 0 || biome[start] === Biome.Water || biome[goal] === Biome.Water) return null;

  const goalX = goal % w;
  const goalY = (goal / w) | 0;
  const best = new Float32Array(w * h).fill(Infinity);
  const cameFrom = new Int32Array(w * h).fill(-1);
  const done = new Uint8Array(w * h);
  const queue = new Queue();
  best[start] = 0;
  queue.push(start, 0);

  while (queue.size > 0) {
    const c = queue.pop();
    if (done[c]) continue;
    done[c] = 1;
    if (c === goal) break;
    const x = c % w;
    const y = (c / w) | 0;
    for (let k = 0; k < 8; k++) {
      const nx = x + NX[k];
      const ny = y + NY[k];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const nb = ny * w + nx;
      if (done[nb] || biome[nb] === Biome.Water) continue;

      let ground = TERRAIN_COST[biome[nb]] + (snow[nb] ? SNOW_COST : 0);
      if (riverDist[nb] < RIVER_HALF_WIDTH) ground += RIVER_COST;
      if (used?.[nb]) ground *= REUSE_DISCOUNT;
      const length = k % 2 ? Math.SQRT2 : 1;
      const cost = best[c] + length * ground + SLOPE_COST * Math.abs(elevation[nb] - elevation[c]);
      if (cost >= best[nb]) continue;
      best[nb] = cost;
      cameFrom[nb] = c;
      // The cheapest any remaining step can be, so the estimate never overshoots.
      queue.push(nb, cost + Math.hypot(nx - goalX, ny - goalY) * REUSE_DISCOUNT);
    }
  }
  if (!done[goal]) return null;

  const route: number[] = [];
  for (let c = goal; c >= 0; c = cameFrom[c]) route.push(c);
  route.reverse();
  const cells = Int32Array.from(route);

  const points = new Float32Array(cells.length * 2);
  for (let p = 0; p < cells.length; p++) {
    points[p * 2] = (cells[p] % w) + 0.5;
    points[p * 2 + 1] = ((cells[p] / w) | 0) + 0.5;
  }
  // The road ends exactly at the two places it links, not at their cell centers.
  points.set([from.x, from.y], 0);
  points.set([to.x, to.y], points.length - 2);
  smooth(points, 3);

  // One bridge per stretch of river crossed, in the middle of the stretch.
  const bridges: Bridge[] = [];
  for (let p = 0; p < cells.length; p++) {
    if (riverDist[cells[p]] >= RIVER_HALF_WIDTH) continue;
    let end = p;
    while (end + 1 < cells.length && riverDist[cells[end + 1]] < RIVER_HALF_WIDTH) end++;
    const mid = (p + end) >> 1;
    const before = Math.max(0, mid - 2);
    const after = Math.min(cells.length - 1, mid + 2);
    bridges.push({
      x: points[mid * 2],
      y: points[mid * 2 + 1],
      angle: Math.atan2(
        points[after * 2 + 1] - points[before * 2 + 1],
        points[after * 2] - points[before * 2],
      ),
    });
    p = end;
  }
  return { cells, points, bridges };
}

/** Marks the cells of a road as carrying one, for later routes to reuse. */
export function markRoad(used: Uint8Array, path: RoadPath): void {
  for (const c of path.cells) used[c] = 1;
}

/** Distance in cells from a position to the nearest point of a road. */
export function distanceToRoad(path: RoadPath, x: number, y: number): number {
  let nearest = Infinity;
  for (let p = 0; p < path.points.length; p += 2) {
    nearest = Math.min(nearest, Math.hypot(path.points[p] - x, path.points[p + 1] - y));
  }
  return nearest;
}

/** Rounds off the staircase of grid steps; endpoints stay where they are. */
function smooth(points: Float32Array, passes: number): void {
  const count = points.length / 2;
  for (let pass = 0; pass < passes; pass++) {
    const prev = points.slice();
    for (let p = 1; p < count - 1; p++) {
      points[p * 2] = (prev[p * 2 - 2] + 2 * prev[p * 2] + prev[p * 2 + 2]) / 4;
      points[p * 2 + 1] = (prev[p * 2 - 1] + 2 * prev[p * 2 + 1] + prev[p * 2 + 3]) / 4;
    }
  }
}
