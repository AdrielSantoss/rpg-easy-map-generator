import { Biome } from '../generator/biome.ts';
import { chamferDistance } from '../generator/grid.ts';
import type { MapData } from '../generator/index.ts';
import { seededRng, type Rng } from '../generator/rng.ts';
import { fantasyName } from '../structures/names.ts';

export const REGION_KINDS = [
  'continent',
  'island',
  'sea',
  'lake',
  'mountains',
  'forest',
  'desert',
  'swamp',
] as const;
export type RegionKind = (typeof REGION_KINDS)[number];

/** A named feature of the map: a landmass, a sea, a forest, a mountain range and so on. */
export interface Region {
  kind: RegionKind;
  /** Where its label is centered, in grid cells: the roomiest spot inside the region. */
  x: number;
  y: number;
  /** How many cells the region covers. */
  area: number;
  name: string;
  /** Label font size in cells. */
  size: number;
}

/** A name the user gave to the region labelled around this position. */
export interface RegionName {
  kind: RegionKind;
  x: number;
  y: number;
  name: string;
}

export type RegionTerrain = Pick<MapData, 'w' | 'h' | 'biome' | 'seed'>;

/**
 * Smallest region worth a name, as a fraction of the whole map, and the most
 * labels of that kind to show (the largest regions win).
 */
const WORTH_NAMING: Record<Exclude<RegionKind, 'sea'>, { minArea: number; most: number }> = {
  continent: { minArea: 0.025, most: 6 },
  island: { minArea: 0.001, most: 6 },
  lake: { minArea: 0.0006, most: 3 },
  mountains: { minArea: 0.005, most: 2 },
  forest: { minArea: 0.004, most: 3 },
  desert: { minArea: 0.003, most: 2 },
  swamp: { minArea: 0.003, most: 2 },
};
/** A sea is named only where there is this much open water around, as a fraction of the map width. */
const SEA_ROOM = 0.05;
/** A second sea label needs to be at least this far from the first, as a fraction of the map width. */
const SEA_SPREAD = 0.4;
/** Regions whose labels land within this fraction of the map width count as the same place. */
const SAME_PLACE = 0.12;

/** Labels compete for space in this order; one that would overlap an earlier one is dropped. */
const PRIORITY: RegionKind[] = [
  'continent',
  'sea',
  'mountains',
  'forest',
  'desert',
  'swamp',
  'lake',
  'island',
];

/** Kinds written in spaced capitals, which makes them wider. */
const SPACED: RegionKind[] = ['continent', 'sea'];

const WORDS: Record<Exclude<RegionKind, 'continent'>, string[]> = {
  island: ['Ilha de'],
  sea: ['Mar de', 'Mar de', 'Golfo de'],
  lake: ['Lago'],
  mountains: ['Montes', 'Serra de', 'Picos de'],
  forest: ['Floresta de', 'Bosque de', 'Mata de'],
  desert: ['Deserto de', 'Ermo de'],
  swamp: ['Pântano de', 'Charco de'],
};

/** Suggests a name fitting the kind of region. */
export function suggestRegionName(kind: RegionKind, rng: Rng = Math.random): string {
  const name = fantasyName(rng);
  if (kind === 'continent') return name;
  const words = WORDS[kind];
  return `${words[Math.floor(rng() * words.length)]} ${name}`;
}

/** Approximate width of a region's label, in cells. */
export function labelWidth(region: Pick<Region, 'kind' | 'name' | 'size'>): number {
  return region.name.length * region.size * (SPACED.includes(region.kind) ? 0.82 : 0.56);
}

function labelSize(kind: RegionKind, area: number, w: number): number {
  // Sizes are tuned for a 600-cell-wide map and scale with it.
  const unit = w / 600;
  if (kind === 'continent') return unit * Math.min(15, Math.max(9, Math.sqrt(area) / 22));
  if (kind === 'sea') return unit * 8.5;
  if (kind === 'lake') return unit * 5;
  return unit * 6.2;
}

interface Patch {
  id: number;
  area: number;
  /** The cell deepest inside the patch, and how far it is from the patch edge. */
  x: number;
  y: number;
  depth: number;
  touchesFrame: boolean;
}

/**
 * Splits the cells where `inside` is set into connected patches. `depth` is
 * each cell's distance to the nearest cell outside its patch or to the map
 * frame, and `owner` the id of the patch each cell belongs to.
 */
function findPatches(inside: Uint8Array, w: number, h: number) {
  const outside = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const onFrame = x === 0 || y === 0 || x === w - 1 || y === h - 1;
      outside[y * w + x] = onFrame || !inside[y * w + x] ? 1 : 0;
    }
  }
  const depth = chamferDistance(outside, w, h);
  const owner = new Int32Array(w * h).fill(-1);
  const patches: Patch[] = [];

  for (let start = 0; start < w * h; start++) {
    if (!inside[start] || owner[start] >= 0) continue;
    const patch: Patch = { id: patches.length, area: 0, x: 0, y: 0, depth: -1, touchesFrame: false };
    const pending = [start];
    owner[start] = patch.id;
    while (pending.length) {
      const c = pending.pop()!;
      const x = c % w;
      const y = (c / w) | 0;
      patch.area++;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) patch.touchesFrame = true;
      if (depth[c] > patch.depth) {
        patch.depth = depth[c];
        patch.x = x + 0.5;
        patch.y = y + 0.5;
      }
      const visit = (nb: number) => {
        if (inside[nb] && owner[nb] < 0) {
          owner[nb] = patch.id;
          pending.push(nb);
        }
      };
      if (x > 0) visit(c - 1);
      if (x < w - 1) visit(c + 1);
      if (y > 0) visit(c - w);
      if (y < h - 1) visit(c + w);
    }
    patches.push(patch);
  }
  return { patches, depth, owner };
}

/**
 * Finds the features of a map worth naming and suggests a name for each. The
 * suggestions depend only on the seed and on where the feature is, so the same
 * map always gets the same names.
 */
export function findRegions(map: RegionTerrain): Region[] {
  const { w, h, biome, seed } = map;
  const cells = w * h;
  const found: Omit<Region, 'name' | 'size'>[] = [];
  const maskOf = (...biomes: number[]) => Uint8Array.from(biome, (b) => (biomes.includes(b) ? 1 : 0));
  const largest = (patches: Patch[], kind: Exclude<RegionKind, 'sea'>) =>
    patches
      .filter((p) => p.area >= WORTH_NAMING[kind].minArea * cells)
      .sort((a, b) => b.area - a.area)
      .slice(0, WORTH_NAMING[kind].most);
  const add = (kind: RegionKind, patches: Patch[]) => {
    for (const { x, y, area } of patches) found.push({ kind, x, y, area });
  };

  const land = findPatches(
    Uint8Array.from(biome, (b) => (b === Biome.Water ? 0 : 1)),
    w,
    h,
  );
  const continents = largest(land.patches, 'continent');
  add('continent', continents);
  add(
    'island',
    largest(
      land.patches.filter((p) => !continents.includes(p)),
      'island',
    ),
  );

  const water = findPatches(maskOf(Biome.Water), w, h);
  add(
    'lake',
    largest(
      water.patches.filter((p) => !p.touchesFrame),
      'lake',
    ),
  );
  for (const sea of water.patches) {
    if (!sea.touchesFrame || sea.depth < SEA_ROOM * w) continue;
    found.push({ kind: 'sea', x: sea.x, y: sea.y, area: sea.area });
    // A wide sea gets a second name at its roomiest spot far from the first.
    let far = -1;
    for (let c = 0; c < cells; c++) {
      if (water.owner[c] !== sea.id || water.depth[c] < SEA_ROOM * w) continue;
      if (Math.hypot((c % w) + 0.5 - sea.x, ((c / w) | 0) + 0.5 - sea.y) < SEA_SPREAD * w) continue;
      if (far < 0 || water.depth[c] > water.depth[far]) far = c;
    }
    if (far >= 0) found.push({ kind: 'sea', x: (far % w) + 0.5, y: ((far / w) | 0) + 0.5, area: sea.area });
  }

  add('mountains', largest(findPatches(maskOf(Biome.Mountains, Biome.Hills), w, h).patches, 'mountains'));
  add('forest', largest(findPatches(maskOf(Biome.Forest, Biome.Taiga), w, h).patches, 'forest'));
  add('desert', largest(findPatches(maskOf(Biome.Desert), w, h).patches, 'desert'));
  add('swamp', largest(findPatches(maskOf(Biome.Swamp), w, h).patches, 'swamp'));

  // Name them, then keep the most important label wherever two would overlap.
  const regions: Region[] = [];
  const grid = SAME_PLACE * w;
  for (const kind of PRIORITY) {
    for (const spot of found.filter((r) => r.kind === kind)) {
      const rng = seededRng(`${seed}:${kind}:${Math.round(spot.x / grid)}:${Math.round(spot.y / grid)}`);
      const region: Region = {
        ...spot,
        name: suggestRegionName(kind, rng),
        size: labelSize(kind, spot.area, w),
      };
      if (!regions.some((other) => labelsOverlap(region, other))) regions.push(region);
    }
  }
  return regions;
}

function labelsOverlap(a: Region, b: Region): boolean {
  const gap = 2;
  return (
    Math.abs(a.x - b.x) < (labelWidth(a) + labelWidth(b)) / 2 + gap &&
    Math.abs(a.y - b.y) < (a.size + b.size) / 2 + gap
  );
}

/**
 * Replaces suggested names with the ones the user chose. A chosen name follows
 * its region as long as the label stays in roughly the same place, so painting
 * terrain or changing the seed a little does not lose it.
 */
export function applyRegionNames(
  regions: readonly Region[],
  names: readonly RegionName[],
  w: number,
): Region[] {
  const renamed = regions.map((region) => ({ ...region }));
  const taken = new Set<Region>();
  for (const chosen of names) {
    let best: Region | null = null;
    let bestDistance = SAME_PLACE * w;
    for (const region of renamed) {
      if (region.kind !== chosen.kind || taken.has(region)) continue;
      const distance = Math.hypot(region.x - chosen.x, region.y - chosen.y);
      if (distance < bestDistance) {
        best = region;
        bestDistance = distance;
      }
    }
    if (best) {
      best.name = chosen.name;
      taken.add(best);
    }
  }
  return renamed;
}

/** Records a name for a region, replacing any earlier name chosen for the same place. */
export function nameRegion(
  names: readonly RegionName[],
  region: Region,
  name: string,
  w: number,
): RegionName[] {
  const elsewhere = names.filter(
    (n) => n.kind !== region.kind || Math.hypot(n.x - region.x, n.y - region.y) >= SAME_PLACE * w,
  );
  return [...elsewhere, { kind: region.kind, x: region.x, y: region.y, name }];
}

/** The region whose label is under the given cell position, if any. */
export function regionAt(regions: readonly Region[], x: number, y: number): Region | null {
  for (const region of regions) {
    if (Math.abs(x - region.x) <= labelWidth(region) / 2 && Math.abs(y - region.y) <= region.size * 0.7) {
      return region;
    }
  }
  return null;
}

/** Something on the map a region label should not be written over: a box around a point. */
export interface Obstacle {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** How far a label may be moved, in steps of its own height, tried nearest first. */
const DODGE_STEPS = [0, -1.3, 1.3, -2.6, 2.6, -3.9, 3.9];

/**
 * Moves region labels up or down, by as little as it takes, so they are not
 * written over the obstacles (the user's structures) or over each other. A
 * label with no free spot nearby stays where it was.
 */
export function dodge(regions: readonly Region[], obstacles: readonly Obstacle[]): Region[] {
  const placed: Region[] = [];
  for (const region of regions) {
    const width = labelWidth(region);
    const fits = (y: number) =>
      !obstacles.some(
        (o) =>
          Math.abs(region.x - o.x) < (width + o.width) / 2 &&
          Math.abs(y - o.y) < (region.size + o.height) / 2,
      ) && !placed.some((other) => labelsOverlap({ ...region, y }, other));
    const step = DODGE_STEPS.find((s) => fits(region.y + s * region.size));
    placed.push(step === undefined ? { ...region } : { ...region, y: region.y + step * region.size });
  }
  return placed;
}
