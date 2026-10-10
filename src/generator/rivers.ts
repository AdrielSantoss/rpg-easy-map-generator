import { clamp } from './grid.ts';

export interface River {
  /** x,y pairs in cell coordinates, from source to mouth. */
  points: Float32Array;
  /** Line width in cells at each point. */
  widths: Float32Array;
}

const NX = [1, 1, 0, -1, -1, -1, 0, 1];
const NY = [0, 1, 1, 1, 0, -1, -1, -1];

/** Binary min-heap of cell indices ordered by an external key array. */
class MinHeap {
  private items: Int32Array;
  private key: Float32Array;
  size = 0;

  constructor(capacity: number, key: Float32Array) {
    this.items = new Int32Array(capacity);
    this.key = key;
  }

  push(cell: number): void {
    const { items, key } = this;
    let p = this.size++;
    while (p > 0) {
      const parent = (p - 1) >> 1;
      if (key[items[parent]] <= key[cell]) break;
      items[p] = items[parent];
      p = parent;
    }
    items[p] = cell;
  }

  pop(): number {
    const { items, key } = this;
    const top = items[0];
    const last = items[--this.size];
    let p = 0;
    for (;;) {
      let child = 2 * p + 1;
      if (child >= this.size) break;
      if (child + 1 < this.size && key[items[child + 1]] < key[items[child]]) child++;
      if (key[items[child]] >= key[last]) break;
      items[p] = items[child];
      p = child;
    }
    items[p] = last;
    return top;
  }
}

/**
 * Routes rainfall downhill to the sea and keeps the channels that collect
 * enough water. Uses priority-flood from the coast, so every land cell drains
 * to water and rivers never get stuck in a pit.
 */
export function carveRivers(
  land: Uint8Array,
  elevation: Float32Array,
  rain: Float32Array,
  w: number,
  h: number,
): { rivers: River[]; riverMask: Uint8Array } {
  const n = w * h;
  const down = new Int32Array(n).fill(-1);
  const level = new Float32Array(n);
  const visited = new Uint8Array(n);
  const order: number[] = [];
  const heap = new MinHeap(n, level);

  let landCount = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!land[i]) continue;
      landCount++;
      if (waterNeighbor(land, x, y, w, h) >= 0) {
        level[i] = elevation[i];
        visited[i] = 1;
        heap.push(i);
      }
    }
  }

  while (heap.size > 0) {
    const c = heap.pop();
    order.push(c);
    const x = c % w;
    const y = (c / w) | 0;
    for (let k = 0; k < 8; k++) {
      const nx = x + NX[k];
      const ny = y + NY[k];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const nb = ny * w + nx;
      if (!land[nb] || visited[nb]) continue;
      visited[nb] = 1;
      down[nb] = c;
      level[nb] = Math.max(elevation[nb], level[c] + 1e-5);
      heap.push(nb);
    }
  }

  const flow = new Float32Array(n);
  for (let p = order.length - 1; p >= 0; p--) {
    const c = order[p];
    flow[c] += rain[c];
    if (down[c] >= 0) flow[down[c]] += flow[c];
  }

  // Bigger landmasses need a bigger catchment before a channel counts as a river.
  const threshold = clamp(Math.sqrt(landCount) * 2.4, 90, 1500);
  const isRiver = (c: number) => flow[c] > threshold;

  const hasUpstream = new Uint8Array(n);
  for (const c of order) {
    if (isRiver(c) && down[c] >= 0) hasUpstream[down[c]] = 1;
  }
  const sources = order.filter((c) => isRiver(c) && !hasUpstream[c]);
  sources.sort((a, b) => elevation[b] - elevation[a]);

  const riverMask = new Uint8Array(n);
  const rivers: River[] = [];
  for (const source of sources) {
    const cells: number[] = [];
    let c = source;
    let joined = false;
    while (c >= 0) {
      cells.push(c);
      if (riverMask[c]) {
        joined = true;
        break;
      }
      riverMask[c] = 1;
      c = down[c];
    }
    if (cells.length < 4) continue;

    const count = cells.length + (joined ? 0 : 1);
    const points = new Float32Array(count * 2);
    const widths = new Float32Array(count);
    for (let p = 0; p < cells.length; p++) {
      const cell = cells[p];
      points[p * 2] = (cell % w) + 0.5;
      points[p * 2 + 1] = ((cell / w) | 0) + 0.5;
      widths[p] = clamp(0.3 + 0.28 * Math.sqrt(flow[cell] / threshold), 0.5, 1.7);
    }
    if (!joined) {
      // Run the mouth out into the water so it meets the coastline.
      const last = cells[cells.length - 1];
      const sea = waterNeighbor(land, last % w, (last / w) | 0, w, h);
      const p = cells.length;
      points[p * 2] = (sea % w) + 0.5;
      points[p * 2 + 1] = ((sea / w) | 0) + 0.5;
      widths[p] = widths[p - 1];
    }
    smooth(points, 3);
    rivers.push({ points, widths });
  }

  return { rivers, riverMask };
}

function waterNeighbor(land: Uint8Array, x: number, y: number, w: number, h: number): number {
  for (let k = 0; k < 8; k++) {
    const nx = x + NX[k];
    const ny = y + NY[k];
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
    if (!land[ny * w + nx]) return ny * w + nx;
  }
  return -1;
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
