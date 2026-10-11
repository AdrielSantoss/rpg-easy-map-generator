import type { TerrainDistribution } from '../generator/distribution.ts';
import { BRUSH_KINDS, TERRAIN_KINDS, type TerrainHint } from '../generator/hints.ts';
import { REGION_KINDS, type RegionName } from '../regions/regions.ts';
import { STRUCTURE_KINDS, type Structure } from '../structures/model.ts';

/** One stroke of the sketch: a pen line, or an eraser pass over earlier lines. */
export interface SketchStroke {
  tool: 'pen' | 'eraser';
  /** x,y pairs in sketch canvas coordinates. */
  points: number[];
}

/**
 * Everything the user made, enough to rebuild the map exactly: the map itself
 * is not stored, since the same sketch, seed and choices always generate it.
 */
export interface Project {
  version: 1;
  seed: string;
  /** Whether the user was looking at a generated map (true) or still at the sketch. */
  generated: boolean;
  sketch: SketchStroke[];
  hints: TerrainHint[];
  distribution: TerrainDistribution | null;
  structures: Structure[];
  /** Roads as pairs of indices into `structures`. */
  roads: [number, number][];
  /** Names the user gave to regions, replacing the suggested ones. */
  regionNames: RegionName[];
  showRegions: boolean;
}

/** Largest text accepted as a name or seed, to keep a hand-edited file from breaking the layout. */
const MAX_TEXT = 80;

const round = (value: number) => Math.round(value * 10) / 10;

/** The project as text, for a file or browser storage. */
export function serializeProject(project: Project): string {
  return JSON.stringify({
    ...project,
    // Sub-pixel precision in the sketch is noise; dropping it halves the size.
    sketch: project.sketch.map((stroke) => ({ tool: stroke.tool, points: stroke.points.map(Math.round) })),
    hints: project.hints.map((hint) => ({ ...hint, x: round(hint.x), y: round(hint.y) })),
    structures: project.structures.map((s) => ({ ...s, x: round(s.x), y: round(s.y) })),
  });
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isText = (value: unknown): value is string => typeof value === 'string' && value.length <= MAX_TEXT;
const isOneOf = <T extends string>(list: readonly T[], value: unknown): value is T =>
  typeof value === 'string' && (list as readonly string[]).includes(value);
const isPlaced = (value: unknown): value is Record<string, unknown> & { x: number; y: number } =>
  isRecord(value) && isNumber(value.x) && isNumber(value.y);

function parseDistribution(value: unknown): TerrainDistribution | null | undefined {
  if (value === null) return null;
  if (!isRecord(value) || !isRecord(value.shares) || !isNumber(value.snow)) return undefined;
  const shares = {} as TerrainDistribution['shares'];
  for (const kind of TERRAIN_KINDS) {
    const share = value.shares[kind];
    if (!isNumber(share)) return undefined;
    shares[kind] = share;
  }
  return { shares, snow: value.snow };
}

/**
 * Reads a saved project. The text may come from a file someone edited or from
 * another version of the app, so everything is checked: anything that does not
 * look like a project gives null rather than a half-loaded map.
 */
export function parseProject(text: string): Project | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(data) || data.version !== 1 || !isText(data.seed)) return null;
  if (typeof data.generated !== 'boolean' || typeof data.showRegions !== 'boolean') return null;
  const { sketch, hints, structures, roads, regionNames } = data;
  if (![sketch, hints, structures, roads, regionNames].every(Array.isArray)) return null;

  const distribution = parseDistribution(data.distribution);
  if (distribution === undefined) return null;

  const project: Project = {
    version: 1,
    seed: data.seed,
    generated: data.generated,
    sketch: [],
    hints: [],
    distribution,
    structures: [],
    roads: [],
    regionNames: [],
    showRegions: data.showRegions,
  };

  for (const stroke of sketch as unknown[]) {
    if (!isRecord(stroke) || !isOneOf(['pen', 'eraser'], stroke.tool)) return null;
    const { points } = stroke;
    if (!Array.isArray(points) || points.length < 2 || points.length % 2 !== 0) return null;
    if (!points.every(isNumber)) return null;
    project.sketch.push({ tool: stroke.tool, points });
  }
  for (const hint of hints as unknown[]) {
    if (!isPlaced(hint) || !isOneOf(BRUSH_KINDS, hint.kind)) return null;
    project.hints.push({ kind: hint.kind, x: hint.x, y: hint.y });
  }
  for (const structure of structures as unknown[]) {
    if (!isPlaced(structure) || !isOneOf(STRUCTURE_KINDS, structure.kind) || !isText(structure.name)) {
      return null;
    }
    project.structures.push({ kind: structure.kind, x: structure.x, y: structure.y, name: structure.name });
  }
  for (const road of roads as unknown[]) {
    if (!Array.isArray(road) || road.length !== 2) return null;
    const [from, to] = road as unknown[];
    const valid = (index: unknown) =>
      Number.isInteger(index) && (index as number) >= 0 && (index as number) < project.structures.length;
    if (!valid(from) || !valid(to) || from === to) return null;
    project.roads.push([from as number, to as number]);
  }
  for (const entry of regionNames as unknown[]) {
    if (!isPlaced(entry) || !isOneOf(REGION_KINDS, entry.kind) || !isText(entry.name)) return null;
    project.regionNames.push({ kind: entry.kind, x: entry.x, y: entry.y, name: entry.name });
  }
  return project;
}
