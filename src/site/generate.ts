import { createNoise2D, fbm } from '../generator/noise.ts';
import { seededRng, type Rng } from '../generator/rng.ts';
import type { StructureKind } from '../structures/model.ts';
import { fantasyName, suggestName } from '../structures/names.ts';
import { tavernName } from '../tavern/names.ts';
import { SITE_SIDES, type SiteContext, type SiteSide, type SiteTerrain } from './context.ts';

/**
 * Maps of the places that are only an icon on the world map: a village, a
 * city, the capital of a kingdom, a port, a lone tower, ruins, a dungeon.
 * Each is laid out on a square grid, seen from above, with its streets and
 * its notable places named.
 */

export const TILE = {
  grass: 0,
  road: 1,
  water: 2,
  /** Paved open ground: a square, a quay. */
  plaza: 3,
  field: 4,
  bridge: 5,
  pier: 6,
  /** Beaten earth inside a castle or a tower's wall. */
  yard: 7,
  /** The inside of a dungeon, and the solid rock around it. */
  floor: 8,
  rock: 9,
} as const;

export type BuildingKind =
  | 'house'
  | 'tavern'
  | 'inn'
  | 'temple'
  | 'smithy'
  | 'hall'
  | 'guild'
  | 'barracks'
  | 'stable'
  | 'mill'
  | 'warehouse'
  | 'harbor'
  | 'shipyard'
  | 'lighthouse'
  | 'academy'
  | 'keep'
  | 'tower'
  | 'stall'
  | 'well'
  | 'stairs';

export interface Building {
  /** Top-left corner and size, in cells. */
  x: number;
  y: number;
  w: number;
  h: number;
  kind: BuildingKind;
  /** Roofless, with broken walls. */
  ruined: boolean;
  /** Which way the ridge of the roof runs. */
  vertical: boolean;
  /** From 0 to 1, picks the shade of the roof so that no two streets look alike. */
  tone: number;
}

/** A notable place. Its number on the map is its position in the list, from 1. */
export interface Place {
  name: string;
  /** Where the number goes, in cells. */
  x: number;
  y: number;
}

export type PropKind =
  | 'fountain'
  | 'statue'
  | 'monument'
  | 'bench'
  | 'lamp'
  | 'planter'
  | 'bigtree'
  | 'cart'
  | 'crates'
  | 'haystack'
  | 'tombstone'
  | 'bush'
  | 'flowers'
  | 'rubble';

/** Something small standing in the open: a fountain, a bench, a cart, a flower bed. */
export interface Prop {
  kind: PropKind;
  /** Its middle, in cells. */
  x: number;
  y: number;
  /** Turn, in radians, for the ones with a direction. */
  angle: number;
}

/** A wall around a rectangle of cells, running through the middle of the cells of its ring. */
export interface Wall {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Cells of the ring where a road passes. */
  gates: { x: number; y: number }[];
  towers: { x: number; y: number }[];
  /** Cells of the ring where the wall has fallen. */
  gaps: { x: number; y: number }[];
}

export interface Street {
  name: string;
  x: number;
  y: number;
  vertical: boolean;
}

export interface Site {
  kind: StructureKind;
  seed: string;
  name: string;
  w: number;
  h: number;
  /** How much ground one square covers. */
  cellMeters: number;
  /** One TILE per cell, row by row. */
  tiles: Uint8Array;
  buildings: Building[];
  walls: Wall[];
  places: Place[];
  streets: Street[];
  /** The ground the place stands on, which colors everything that is not built. */
  terrain: SiteTerrain;
  trees: { x: number; y: number; r: number }[];
  rocks: { x: number; y: number; r: number }[];
  props: Prop[];
  boats: { x: number; y: number; vertical: boolean }[];
  /** Doors of a dungeon: the cell, and whether the door stands across a north-south passage. */
  doors: { x: number; y: number; vertical: boolean }[];
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const pick = <T>(list: readonly T[], rng: Rng): T => list[Math.floor(rng() * list.length)];
const between = (low: number, high: number, rng: Rng) => low + Math.floor(rng() * (high - low + 1));

function shuffled<T>(list: readonly T[], rng: Rng): T[] {
  const result = [...list];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const DEITIES = ['Solara', 'Morwen', 'Aldur', 'Ithriel', 'Karveth', 'Nimue', 'Brannor'];
const STREETS = [
  'Rua do Mercado',
  'Rua dos Ferreiros',
  'Rua Alta',
  'Rua das Lanternas',
  'Via dos Peregrinos',
  'Rua do Sal',
  'Estrada Velha',
  'Rua dos Tecelões',
  'Rua do Corvo',
  'Caminho do Moinho',
];

/**
 * What a main square is built around. No two towns need have the same: the
 * square is named after what it has, so the name and the map agree.
 */
type SquareKind = 'fountain' | 'monument' | 'market' | 'garden' | 'tree' | 'well' | 'fair' | 'plain';

const SQUARE_NAMES: Record<SquareKind, readonly string[]> = {
  fountain: ['Praça da Fonte', 'Largo do Chafariz', 'Praça das Águas'],
  monument: ['Praça dos Heróis', 'Praça do Fundador', 'Largo da Estátua'],
  market: ['Praça do Mercado', 'Largo dos Mercadores', 'Grande Mercado'],
  garden: ['Praça das Flores', 'Largo das Tílias', 'Praça do Jardim'],
  tree: ['Praça do Carvalho', 'Largo da Figueira'],
  well: ['Praça do Poço', 'Largo da Cisterna'],
  fair: ['Largo da Feira', 'Praça da Feira'],
  plain: ['Largo da Vila', 'Praça Velha', 'Largo da Matriz'],
};

/** A notable building to find room for: how big, and what it is called. */
interface Landmark {
  kind: BuildingKind;
  w: number;
  h: number;
  name: (rng: Rng) => string;
  /** Kept away from the middle of town rather than close to it. */
  far?: boolean;
}

const tavern: Landmark = { kind: 'tavern', w: 4, h: 3, name: tavernName };
const inn: Landmark = {
  kind: 'inn',
  w: 4,
  h: 4,
  name: (rng) => `Estalagem ${pick(['do Viajante', 'da Lua', 'do Cervo', 'das Três Chaves'], rng)}`,
};
const smithy: Landmark = {
  kind: 'smithy',
  w: 3,
  h: 3,
  name: (rng) => `Ferraria ${pick(['do Martelo', 'Bigorna Rubra', 'Ferro e Fogo', 'do Velho Anão'], rng)}`,
};
const temple = (title: string, w: number, h: number): Landmark => ({
  kind: 'temple',
  w,
  h,
  name: (rng) => `${title} de ${pick(DEITIES, rng)}`,
});
const fixed = (kind: BuildingKind, w: number, h: number, name: string, far = false): Landmark => ({
  kind,
  w,
  h,
  name: () => name,
  far,
});
const stable = fixed('stable', 4, 2, 'Estábulos', true);
const barracks = fixed('barracks', 5, 3, 'Quartel da Guarda', true);
const guild = fixed('guild', 4, 4, 'Guilda dos Mercadores');

interface TownPlan {
  w: number;
  h: number;
  /** Open country left around the town, in cells. */
  margin: number;
  /** Width of the two main roads, in cells. */
  avenue: number;
  /** Half the size of the main square. */
  square: readonly [number, number];
  /** The largest a block of houses may be before a street splits it. */
  block: readonly [number, number];
  /** How much of the building land is left as yards. */
  empty: number;
  wall: boolean;
  /** How likely a river runs through. */
  river: number;
  coast?: boolean;
  castle?: boolean;
  fields?: boolean;
  /** Stalls on the main square. */
  stalls: number;
  /** A block kept as a public garden. */
  park?: boolean;
  squareName: readonly string[];
  landmarks: readonly Landmark[];
}

const TOWN: Record<'village' | 'city' | 'kingdom' | 'port' | 'ruins', TownPlan> = {
  village: {
    w: 52,
    h: 36,
    margin: 7,
    avenue: 1,
    square: [3, 2],
    block: [12, 9],
    empty: 0.45,
    wall: false,
    river: 0.5,
    fields: true,
    stalls: 0,
    squareName: ['Praça do Poço', 'Largo da Feira', 'Praça do Carvalho'],
    landmarks: [
      tavern,
      temple('Capela', 3, 4),
      smithy,
      fixed('hall', 4, 3, 'Casa do Ancião'),
      fixed('mill', 3, 3, 'Moinho', true),
      stable,
    ],
  },
  city: {
    w: 72,
    h: 48,
    margin: 4,
    avenue: 2,
    square: [5, 4],
    block: [11, 8],
    empty: 0.12,
    wall: true,
    river: 0.45,
    stalls: 7,
    park: true,
    squareName: ['Praça do Mercado', 'Praça da Fonte', 'Largo dos Mercadores'],
    landmarks: [
      fixed('hall', 5, 4, 'Prefeitura'),
      temple('Templo', 4, 6),
      tavern,
      inn,
      smithy,
      guild,
      { ...tavern, far: true },
      barracks,
      stable,
    ],
  },
  kingdom: {
    w: 96,
    h: 64,
    margin: 4,
    avenue: 2,
    square: [6, 5],
    block: [11, 8],
    empty: 0.08,
    wall: true,
    river: 0.5,
    castle: true,
    stalls: 10,
    park: true,
    squareName: ['Praça Real', 'Praça da Coroa', 'Grande Mercado'],
    landmarks: [
      temple('Catedral', 6, 8),
      fixed('hall', 5, 4, 'Tribunal'),
      guild,
      tavern,
      inn,
      fixed('academy', 4, 4, 'Torre dos Magos'),
      smithy,
      fixed('guild', 4, 4, 'Guilda dos Aventureiros'),
      { ...tavern, far: true },
      { ...inn, far: true },
      barracks,
      stable,
    ],
  },
  port: {
    w: 72,
    h: 50,
    margin: 4,
    avenue: 2,
    square: [4, 3],
    block: [11, 8],
    empty: 0.15,
    wall: false,
    river: 0,
    coast: true,
    stalls: 5,
    squareName: ['Praça do Peixe', 'Largo das Âncoras', 'Praça do Farol'],
    landmarks: [
      tavern,
      inn,
      temple('Templo', 4, 5),
      smithy,
      fixed('hall', 4, 4, 'Alfândega'),
      { ...tavern, far: true },
      stable,
    ],
  },
  ruins: {
    w: 48,
    h: 32,
    margin: 4,
    avenue: 1,
    square: [3, 3],
    block: [10, 8],
    empty: 0.4,
    wall: true,
    river: 0.35,
    stalls: 0,
    squareName: ['Praça Esquecida', 'Largo dos Ossos', 'Praça Silenciosa'],
    landmarks: [
      fixed('temple', 4, 6, 'Templo Caído'),
      fixed('hall', 5, 4, 'Salão Desabado'),
      fixed('tavern', 4, 3, 'Taverna Abandonada'),
      fixed('smithy', 3, 3, 'Forja Fria'),
      fixed('temple', 3, 3, 'Cripta'),
      fixed('barracks', 5, 3, 'Quartel em Ruínas', true),
    ],
  },
};

/** The name given from outside, or else the one invented (which is always drawn, to keep the map the same). */
const named = (invented: string, context: SiteContext) => context.name?.trim() || invented;

/** How wooded each terrain is, against ordinary countryside. */
const WOODS: Record<SiteTerrain, number> = {
  plains: 0.6,
  forest: 1.3,
  taiga: 1.1,
  desert: 0.07,
  swamp: 0.8,
  hills: 0.5,
  mountain: 0.3,
  snow: 0.5,
};
/** How likely a boulder lies on a square of open ground. */
const ROCKS: Record<SiteTerrain, number> = {
  plains: 0,
  forest: 0,
  taiga: 0.01,
  desert: 0.025,
  swamp: 0,
  hills: 0.05,
  mountain: 0.13,
  snow: 0.015,
};
/** Where nothing is farmed, and where no river runs. */
const BARREN: readonly SiteTerrain[] = ['desert', 'swamp', 'mountain', 'snow'];

/** Marks, among the cells in use, those a wall stands on. */
const WALLED = 2;

/** The grid a site is drawn on while it is being generated. */
class Ground {
  readonly tiles: Uint8Array;
  /** Cells that already hold something, or must stay clear. */
  readonly used: Uint8Array;
  readonly w: number;
  readonly h: number;

  constructor(w: number, h: number, tile: number) {
    this.w = w;
    this.h = h;
    this.tiles = new Uint8Array(w * h).fill(tile);
    this.used = new Uint8Array(w * h);
  }

  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  get(x: number, y: number): number {
    return this.inside(x, y) ? this.tiles[y * this.w + x] : -1;
  }

  /** Lays a tile and keeps buildings off it. */
  set(x: number, y: number, tile: number): void {
    if (!this.inside(x, y)) return;
    this.tiles[y * this.w + x] = tile;
    this.used[y * this.w + x] = 1;
  }

  /** A road over land, a bridge over water; with `ford` off, water is left as it is. */
  road(x: number, y: number, ford = true): void {
    const tile = this.get(x, y);
    if (tile === TILE.water && !ford) return;
    // A street that reaches the square ends there.
    if (tile === TILE.plaza) return;
    this.set(x, y, tile === TILE.water || tile === TILE.bridge ? TILE.bridge : TILE.road);
  }

  fill(rect: Rect, tile: number): void {
    for (let y = rect.y; y < rect.y + rect.h; y++) {
      for (let x = rect.x; x < rect.x + rect.w; x++) this.set(x, y, tile);
    }
  }

  free(rect: Rect): boolean {
    for (let y = rect.y; y < rect.y + rect.h; y++) {
      for (let x = rect.x; x < rect.x + rect.w; x++) {
        if (!this.inside(x, y) || this.used[y * this.w + x]) return false;
      }
    }
    return true;
  }

  claim(rect: Rect): void {
    for (let y = rect.y; y < rect.y + rect.h; y++) {
      for (let x = rect.x; x < rect.x + rect.w; x++) this.used[y * this.w + x] = 1;
    }
  }
}

const building = (rect: Rect, kind: BuildingKind, rng: Rng, ruined = false): Building => ({
  ...rect,
  kind,
  ruined,
  vertical: rect.h === rect.w ? rng() < 0.5 : rect.h > rect.w,
  tone: rng(),
});

const middle = (rect: Rect) => ({ x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 });

/** A wall around `rect`, one cell out, with gates wherever a road crosses it. */
function wallAround(ground: Ground, rect: Rect, rng: Rng, broken = 0): Wall {
  const ring: Rect = { x: rect.x - 1, y: rect.y - 1, w: rect.w + 2, h: rect.h + 2 };
  const wall: Wall = { ...ring, gates: [], towers: [], gaps: [] };
  const right = ring.x + ring.w - 1;
  const bottom = ring.y + ring.h - 1;
  const cells: { x: number; y: number }[] = [];
  for (let x = ring.x; x <= right; x++) cells.push({ x, y: ring.y }, { x, y: bottom });
  for (let y = ring.y + 1; y < bottom; y++) cells.push({ x: ring.x, y }, { x: right, y });
  for (const cell of cells) {
    const tile = ground.get(cell.x, cell.y);
    if (tile === TILE.road || tile === TILE.bridge) wall.gates.push(cell);
    ground.used[cell.y * ground.w + cell.x] = WALLED;
  }
  const nearGate = (x: number, y: number) =>
    wall.gates.some((gate) => Math.abs(gate.x - x) + Math.abs(gate.y - y) < 3);
  const corner = (x: number, y: number) => (x === ring.x || x === right) && (y === ring.y || y === bottom);
  for (const cell of cells) {
    if (nearGate(cell.x, cell.y)) continue;
    const along = cell.y === ring.y || cell.y === bottom ? cell.x - ring.x : cell.y - ring.y;
    if (corner(cell.x, cell.y) || along % 9 === 4) wall.towers.push(cell);
    else if (rng() < broken) wall.gaps.push(cell);
  }
  return wall;
}

/** Splits a rectangle with streets until every piece is a block small enough to build on. */
function blocksOf(ground: Ground, rect: Rect, max: readonly [number, number], rng: Rng, out: Rect[]): void {
  const wide = rect.w > max[0];
  const tall = rect.h > max[1];
  if (rect.w < 2 || rect.h < 2) return;
  if (!wide && !tall) {
    out.push(rect);
    return;
  }
  // The longer side is cut, somewhere around its middle.
  const vertical = wide && (!tall || rect.w / max[0] >= rect.h / max[1]);
  const length = vertical ? rect.w : rect.h;
  const at = between(Math.floor(length * 0.35), Math.ceil(length * 0.65) - 1, rng);
  if (vertical) {
    for (let y = rect.y; y < rect.y + rect.h; y++) ground.road(rect.x + at, y, false);
    blocksOf(ground, { ...rect, w: at }, max, rng, out);
    blocksOf(ground, { ...rect, x: rect.x + at + 1, w: rect.w - at - 1 }, max, rng, out);
  } else {
    for (let x = rect.x; x < rect.x + rect.w; x++) ground.road(x, rect.y + at);
    blocksOf(ground, { ...rect, h: at }, max, rng, out);
    blocksOf(ground, { ...rect, y: rect.y + at + 1, h: rect.h - at - 1 }, max, rng, out);
  }
}

function town(kind: keyof typeof TOWN, seed: string, rng: Rng, context: SiteContext): Site {
  const plan = TOWN[kind];
  const { w, h } = plan;
  const ground = new Ground(w, h, TILE.grass);
  const noise = createNoise2D(rng);
  const site: Site = {
    kind,
    seed,
    name: named(suggestName(kind, rng), context),
    w,
    h,
    cellMeters: 3,
    tiles: ground.tiles,
    buildings: [],
    walls: [],
    places: [],
    streets: [],
    terrain: context.terrain,
    trees: [],
    rocks: [],
    props: [],
    boats: [],
    doors: [],
  };
  const ruin = kind === 'ruins';

  // The town proper, with open country around it; a port has the sea to the south.
  const margin = plan.margin;
  const shore = (x: number) => h - 7 + Math.round(noise(x * 0.07, 3) * 1.5);
  const core: Rect = { x: margin, y: margin, w: w - 2 * margin, h: h - margin - (plan.coast ? 12 : margin) };
  const coreRight = core.x + core.w;
  const coreBottom = core.y + core.h;
  if (plan.coast) {
    for (let x = 0; x < w; x++) {
      for (let y = coreBottom; y < h; y++) {
        // Between the last houses and the water, a stone quay as wide as the town.
        const quay = x >= core.x - 1 && x <= coreRight;
        ground.set(x, y, y >= shore(x) ? TILE.water : quay ? TILE.plaza : TILE.grass);
        if (!quay && y < shore(x)) ground.used[y * w + x] = 0;
      }
    }
  }
  /** Which side of town the river runs down, if there is one. */
  let riverSide: 'left' | 'right' | null = null;
  if (rng() < plan.river && context.terrain !== 'desert') {
    // The river keeps to one side, so that the main square stays dry.
    const side = rng() < 0.5 ? 0.24 : 0.76;
    riverSide = side < 0.5 ? 'left' : 'right';
    const width = plan.avenue + 1;
    for (let y = 0; y < h; y++) {
      const x = Math.round(core.x + core.w * side + noise(5, y * 0.06) * 3);
      for (let dx = 0; dx < width; dx++) ground.set(x + dx, y, TILE.water);
    }
  }

  const cx = core.x + Math.floor(core.w / 2) + between(-3, 3, rng);
  const cy = core.y + Math.floor(core.h / 2) + between(-2, 2, rng);
  const avenue = plan.avenue;
  // The castle stands against the north wall: in the middle, at the head of the
  // main avenue, or toward either corner, with an avenue of its own down to the
  // main street. In the middle it would bar a road arriving from the north, so
  // with one it keeps to a side. (For a castle in the south, see generateSite.)
  const castleWidth = 18 + avenue;
  // Nor is it built across the river.
  const castleSpots = (['left', 'middle', 'right'] as const).filter(
    (spot) => spot !== riverSide && (spot !== 'middle' || !context.exits.includes('north')),
  );
  const castleSpot = pick(castleSpots, rng);
  const castle: Rect | null = plan.castle
    ? {
        x: castleSpot === 'left' ? core.x + 1 : castleSpot === 'right' ? coreRight - castleWidth - 1 : cx - 9,
        y: core.y + 1,
        w: castleWidth,
        h: 13,
      }
    : null;
  const centered = castle !== null && castleSpot === 'middle';
  /** The column of the castle's gate, and of the avenue that leads to it. */
  const gateX = castle ? castle.x + 9 : cx;
  const avenueTop = castle ? castle.y + castle.h + 1 : 0;
  for (let d = 0; d < avenue; d++) {
    const west = context.exits.includes('west') ? 0 : core.x;
    const east = context.exits.includes('east') ? w : coreRight;
    for (let x = west; x < east; x++) ground.road(x, cy + d);
    const north = centered ? avenueTop : context.exits.includes('north') ? 0 : core.y;
    const south = plan.coast || !context.exits.includes('south') ? coreBottom : h;
    for (let y = north; y < south; y++) ground.road(cx + d, y);
    if (castle && !centered) for (let y = avenueTop; y < cy; y++) ground.road(gateX + d, y);
  }
  const square: Rect = {
    x: cx - plan.square[0],
    y: cy - plan.square[1],
    w: plan.square[0] * 2 + avenue,
    h: plan.square[1] * 2 + avenue,
  };
  ground.fill(square, TILE.plaza);

  // Streets split the four quarters into blocks.
  const quarters: Rect[] = [];
  const quarter = (x0: number, y0: number, x1: number, y1: number) => {
    if (x1 - x0 >= 2 && y1 - y0 >= 2) quarters.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
  };
  if (castle) {
    // A street runs round the castle; the quarters are what is left beside and below it.
    const left = castle.x - 1;
    const right = castle.x + castle.w;
    const under = castle.y + castle.h;
    for (let y = core.y; y <= under; y++) {
      ground.road(left, y);
      ground.road(right, y);
    }
    for (let x = left; x <= right; x++) ground.road(x, under);
    quarter(left + 1, under + 1, gateX, cy);
    quarter(gateX + avenue, under + 1, right, cy);
    if (centered) {
      quarter(core.x, core.y, left, cy);
      quarter(right + 1, core.y, coreRight, cy);
    } else if (castleSpot === 'left') {
      quarter(core.x, core.y, left, cy);
      quarter(right + 1, core.y, cx, cy);
      quarter(cx + avenue, core.y, coreRight, cy);
    } else {
      quarter(core.x, core.y, cx, cy);
      quarter(cx + avenue, core.y, left, cy);
      quarter(right + 1, core.y, coreRight, cy);
    }
  } else {
    quarter(core.x, core.y, cx, cy);
    quarter(cx + avenue, core.y, coreRight, cy);
  }
  quarter(core.x, cy + avenue, cx, coreBottom);
  quarter(cx + avenue, cy + avenue, coreRight, coreBottom);
  const blocks: Rect[] = [];
  for (const rect of quarters) blocksOf(ground, rect, plan.block, rng, blocks);

  if (castle) {
    ground.fill(castle, TILE.yard);
    // The gate, in the middle of the south wall.
    for (let d = 0; d < avenue; d++) ground.road(gateX + d, castle.y + castle.h - 1);
    const inner: Rect = { x: castle.x + 1, y: castle.y + 1, w: castle.w - 2, h: castle.h - 2 };
    site.walls.push(wallAround(ground, inner, rng));
    const keep: Rect = { x: gateX - 5 + Math.floor(avenue / 2), y: castle.y + 2, w: 10, h: 6 };
    site.buildings.push(building(keep, 'keep', rng));
    site.places.push({ name: `Castelo ${fantasyName(rng)}`, ...middle(keep) });
    site.buildings.push(building({ x: inner.x + 1, y: keep.y + keep.h + 1, w: 4, h: 2 }, 'stable', rng));
    site.buildings.push(
      building({ x: inner.x + inner.w - 6, y: keep.y + keep.h + 1, w: 5, h: 2 }, 'barracks', rng),
    );
  }

  const paved = plan.stalls > 0;
  const squareKind: SquareKind = pick(
    paved
      ? (['fountain', 'monument', 'market', 'garden'] as const)
      : (['tree', 'well', 'fair', 'plain'] as const),
    rng,
  );
  // A ruin keeps the names of a place nobody remembers; a port may name its square after the sea.
  const squareNames =
    ruin || (plan.coast && squareKind === 'market') ? plan.squareName : SQUARE_NAMES[squareKind];
  site.places.push({ name: pick(squareNames, rng), x: square.x + 1.2, y: square.y + 1.2 });
  const center = middle(square);
  // A market square is crowded with stalls; the others keep a few, or none.
  const stalls = Math.round(
    plan.stalls *
      { fountain: 0.5, monument: 0.4, market: 1.5, garden: 0, tree: 0, well: 0, fair: 0, plain: 0 }[
        squareKind
      ],
  );
  for (let i = 0; i < stalls * 3; i++) {
    const x = between(square.x + 1, square.x + square.w - 2, rng);
    const y = between(square.y + 1, square.y + square.h - 2, rng);
    // The roads through the square stay open.
    if ((x >= cx - 1 && x <= cx + avenue) || (y >= cy - 1 && y <= cy + avenue)) continue;
    if (site.buildings.some((other) => other.x === x && other.y === y)) continue;
    site.buildings.push(building({ x, y, w: 1, h: 1 }, 'stall', rng));
  }
  if (!paved) {
    // Every village draws its water somewhere; a village with a fair sets up a few stalls.
    site.buildings.push(building({ x: square.x + 1, y: square.y + square.h - 2, w: 1, h: 1 }, 'well', rng));
    if (squareKind === 'fair' && !ruin) {
      for (const [dx, dy] of [
        [1, 0],
        [3, 0],
        [square.w - 2, square.h - 1],
      ]) {
        if (square.x + dx !== cx && square.y + dy !== cy) {
          site.buildings.push(building({ x: square.x + dx, y: square.y + dy, w: 1, h: 1 }, 'stall', rng));
        }
      }
    }
  }

  const distance = (rect: Rect) => Math.hypot(middle(rect).x - center.x, middle(rect).y - center.y);
  const onEdge = (rect: Rect) =>
    Number(rect.x <= core.x || rect.x + rect.w >= coreRight) +
    Number(rect.y <= core.y || rect.y + rect.h >= coreBottom);
  const reach = Math.max(...blocks.map(distance));

  // A public garden takes one block, a little way from the square.
  const parks: Rect[] = [];
  const gardened = rng() < 0.5;
  if (plan.park && gardened && !ruin) {
    const garden = blocks
      .filter((block) => block.w * block.h >= 24 && onEdge(block) === 0)
      .sort((a, b) => Math.abs(distance(a) - reach * 0.4) - Math.abs(distance(b) - reach * 0.4))[0];
    if (garden) {
      parks.push(garden);
      blocks.splice(blocks.indexOf(garden), 1);
      ground.claim(garden);
      const pond = middle(garden);
      for (let dy = -1; dy <= 0; dy++) {
        for (let dx = -1; dx <= 0; dx++)
          ground.tiles[(Math.floor(pond.y) + dy) * w + Math.floor(pond.x) + dx] = TILE.water;
      }
      site.places.push({
        name: pick(['Jardim das Rosas', 'Parque do Carvalho', 'Jardim do Lago', 'Bosque dos Namorados'], rng),
        x: garden.x + 1,
        y: garden.y + 1,
      });
    }
  }

  // The notable buildings take the best spots: by the square, or a few streets
  // away from it, but never out in a corner of the town, where nobody would look.
  const byDistance = [...blocks].sort((a, b) => distance(a) - distance(b));
  const perBlock = new Map<Rect, number>();
  const graveyards: Rect[] = [];
  for (const landmark of plan.landmarks) {
    // How far from the square this one wants to be, and how bad a block at the edge is.
    const wanted = landmark.far ? reach * 0.5 : 0;
    const order = [...byDistance].sort(
      (a, b) =>
        Math.abs(distance(a) - wanted) +
        onEdge(a) * reach -
        (Math.abs(distance(b) - wanted) + onEdge(b) * reach),
    );
    let best: Rect | null = null;
    for (const block of order) {
      if ((perBlock.get(block) ?? 0) >= 2) continue;
      for (const [lw, lh] of [
        [landmark.w, landmark.h],
        [landmark.h, landmark.w],
      ]) {
        for (let y = block.y; y + lh <= block.y + block.h; y++) {
          for (let x = block.x; x + lw <= block.x + block.w; x++) {
            const spot = { x, y, w: lw, h: lh };
            if (!ground.free(spot)) continue;
            // Within the block, the side that looks toward the square.
            if (!best || distance(spot) < distance(best)) best = spot;
          }
        }
      }
      if (best) {
        perBlock.set(block, (perBlock.get(block) ?? 0) + 1);
        break;
      }
    }
    // A town too small for everything goes without what did not fit.
    if (!best) continue;
    ground.claim(best);
    if (landmark.kind === 'temple') {
      const lot: Rect = best;
      const plot = [
        { x: lot.x + lot.w, y: lot.y, w: 2, h: 3 },
        { x: lot.x - 2, y: lot.y, w: 2, h: 3 },
        { x: lot.x, y: lot.y + lot.h, w: 3, h: 2 },
        { x: lot.x, y: lot.y - 2, w: 3, h: 2 },
      ].find((rect) => rect.x >= core.x && rect.y >= core.y && ground.free(rect));
      if (plot) {
        ground.claim(plot);
        graveyards.push(plot);
      }
    }
    site.buildings.push(building(best, landmark.kind, rng, ruin));
    site.places.push({ name: landmark.name(rng), ...middle(best) });
  }

  if (plan.coast) harbor(site, ground, core, shore, rng);

  // Houses fill what is left of every block, lot by lot.
  for (const block of blocks) {
    for (let y = block.y; y < block.y + block.h; y++) {
      for (let x = block.x; x < block.x + block.w; x++) {
        if (ground.used[y * w + x]) continue;
        let lot: Rect | null = null;
        for (const [lw, lh] of shuffled(
          [
            [3, 2],
            [2, 3],
            [3, 3],
            [2, 2],
            [4, 2],
            [2, 4],
          ],
          rng,
        )) {
          const candidate = { x, y, w: lw, h: lh };
          const fits = x + lw <= block.x + block.w && y + lh <= block.y + block.h;
          if (fits && ground.free(candidate)) {
            lot = candidate;
            break;
          }
        }
        if (!lot) continue;
        ground.claim(lot);
        // A yard, sometimes dug into a kitchen garden; or what is left of a house that is gone.
        if (rng() < plan.empty) {
          const dug = rng() < (plan.fields ? 0.4 : 0.2);
          if (dug && !ruin && !BARREN.includes(context.terrain)) {
            ground.fill({ ...lot, w: Math.min(lot.w, 2), h: Math.min(lot.h, 2) }, TILE.field);
          }
          continue;
        }
        site.buildings.push(building(lot, 'house', rng, ruin));
      }
    }
  }

  if (plan.wall) site.walls.push(wallAround(ground, core, rng, ruin ? 0.3 : 0));

  const farmed: Rect[] = [];
  if (plan.fields && !BARREN.includes(context.terrain)) {
    // Farmland around the village, with a farmhouse here and there.
    for (let i = 0; i < 40; i++) {
      const field: Rect = {
        x: between(0, w - 5, rng),
        y: between(0, h - 4, rng),
        w: between(4, 8, rng),
        h: between(3, 5, rng),
      };
      if (field.x + field.w > w || field.y + field.h > h) continue;
      // Clear of whatever is next to it, as far as the map goes.
      const ax = Math.max(0, field.x - 1);
      const ay = Math.max(0, field.y - 1);
      const apart = {
        x: ax,
        y: ay,
        w: Math.min(w, field.x + field.w + 1) - ax,
        h: Math.min(h, field.y + field.h + 1) - ay,
      };
      const outside =
        field.x + field.w < core.x ||
        field.x > coreRight ||
        field.y + field.h < core.y ||
        field.y > coreBottom;
      if (!outside || !ground.free(apart)) continue;
      ground.fill(field, TILE.field);
      farmed.push(field);
      const house: Rect = { x: field.x + field.w + 1, y: field.y, w: 2, h: 2 };
      if (rng() < 0.5 && ground.free({ x: house.x - 1, y: house.y - 1, w: 4, h: 4 })) {
        ground.claim(house);
        site.buildings.push(building(house, 'house', rng));
      }
    }
  }

  if (ruin) {
    // Time took part of everything: houses, and stretches of the streets.
    site.buildings = site.buildings.filter((b) => b.kind !== 'house' || rng() < 0.7);
    for (let i = 0; i < ground.tiles.length; i++) {
      // Where a road meets the edge of the map it stays, to show that it goes on.
      const x = i % w;
      const edge = x === 0 || x === w - 1 || i < w || i >= w * (h - 1);
      if (ground.tiles[i] === TILE.road && rng() < 0.22 && !edge) ground.tiles[i] = TILE.grass;
    }
  }

  const built = new Uint8Array(w * h);
  for (const b of site.buildings) {
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) built[y * w + x] = 1;
  }
  /** Squares that already hold something small. */
  const taken = new Uint8Array(w * h);
  const clear = (x: number, y: number) => ground.inside(x, y) && !built[y * w + x] && !taken[y * w + x];
  /** Stands a prop in the middle of a square, if nothing is there yet. */
  const put = (kind: PropKind, x: number, y: number, angle = 0): boolean => {
    if (!clear(x, y)) return false;
    taken[y * w + x] = 1;
    site.props.push({ kind, x: x + 0.5, y: y + 0.5, angle });
    return true;
  };
  // The main square: what its kind calls for, and what a square has around it.
  if (ruin) {
    for (let i = 0; i < 8; i++) {
      put(
        'rubble',
        between(square.x, square.x + square.w - 1, rng),
        between(square.y, square.y + square.h - 1, rng),
      );
    }
  } else if (paved) {
    const fx = cx + avenue / 2;
    const fy = cy + avenue / 2;
    if (squareKind === 'fountain' || squareKind === 'monument') {
      // Something stands where the roads cross, with benches to sit and look at it.
      site.props.push({ kind: squareKind, x: fx, y: fy, angle: 0 });
      for (let y = cy - 1; y <= cy + avenue; y++) {
        for (let x = cx - 1; x <= cx + avenue; x++) taken[y * w + x] = 1;
      }
      for (const [dx, dy, angle] of [
        [0, -2.3, 0],
        [0, 2.3, 0],
        [-2.3, 0, Math.PI / 2],
        [2.3, 0, Math.PI / 2],
      ]) {
        if (rng() < 0.75) site.props.push({ kind: 'bench', x: fx + dx, y: fy + dy, angle });
      }
    }
    if (squareKind !== 'monument' && rng() < 0.4) put('statue', square.x + square.w - 2, square.y + 1);
    for (const [x, y] of [
      [square.x, square.y],
      [square.x + square.w - 1, square.y],
      [square.x, square.y + square.h - 1],
      [square.x + square.w - 1, square.y + square.h - 1],
    ]) {
      put('lamp', x, y);
    }
    // Only a garden square is planted all round; some of the others have a tub or two.
    const planted = squareKind === 'garden' ? 1 : squareKind === 'market' ? 0 : rng() < 0.4 ? 0.35 : 0;
    for (let x = square.x + 2; x < square.x + square.w - 1; x += squareKind === 'garden' ? 2 : 3) {
      if (x >= cx - 1 && x <= cx + avenue) continue;
      for (const y of [square.y, square.y + square.h - 1]) if (rng() < planted) put('planter', x, y);
    }
    for (let y = square.y + 2; y < square.y + square.h - 1; y += squareKind === 'garden' ? 2 : 3) {
      if (y >= cy - 1 && y <= cy + avenue) continue;
      for (const x of [square.x, square.x + square.w - 1]) if (rng() < planted) put('planter', x, y);
    }
    if (squareKind === 'garden') {
      // Flower beds and benches in the four quarters of the square.
      for (let i = 0; i < 45; i++) {
        const x = between(square.x + 1, square.x + square.w - 2, rng);
        const y = between(square.y + 1, square.y + square.h - 2, rng);
        if ((x >= cx - 1 && x <= cx + avenue) || (y >= cy - 1 && y <= cy + avenue)) continue;
        // Where no flower grows, the beds are left out and the benches stay.
        const bench = rng() < 0.3;
        const dry = context.terrain === 'desert' || context.terrain === 'snow';
        if (bench || !dry) put(bench ? 'bench' : 'flowers', x, y, rng() < 0.5 ? 0 : Math.PI / 2);
      }
    }
    for (const stall of site.buildings.filter((b) => b.kind === 'stall')) {
      if (rng() < 0.6)
        put(rng() < 0.3 ? 'cart' : 'crates', stall.x + (rng() < 0.5 ? 1 : -1), stall.y, rng() * 3);
    }
  } else {
    // A village green, each with its own little.
    if (squareKind === 'tree') {
      site.props.push({ kind: 'bigtree', x: square.x + square.w - 1.6, y: square.y + 1.6, angle: 0 });
      taken[(square.y + 1) * w + square.x + square.w - 2] = 1;
      put('bench', square.x + square.w - 3, square.y + 2, Math.PI / 2);
    } else if (squareKind === 'well') {
      put('bench', square.x + 2, square.y + square.h - 2);
      put('bench', square.x + 1, square.y + square.h - 3, Math.PI / 2);
    } else if (squareKind === 'fair') {
      put('cart', square.x + square.w - 2, square.y + 1, 0.4);
      put('crates', square.x + 2, square.y + 1);
      put('crates', square.x + square.w - 3, square.y + square.h - 2, 1);
    }
    if (rng() < 0.5) put('cart', square.x + 2, square.y + square.h - 2, 0.4);
    if (rng() < 0.4) put('crates', square.x + 1, square.y + 1);
  }

  // Lamps along the two main streets of a paved town.
  if (paved) {
    for (let x = core.x + 2; x < coreRight - 1; x += 5) {
      if (x >= square.x - 1 && x <= square.x + square.w) continue;
      site.props.push({ kind: 'lamp', x: x + 0.5, y: x % 2 ? cy + 0.18 : cy + avenue - 0.18, angle: 0 });
    }
    for (let y = centered && castle ? castle.y + castle.h + 2 : core.y + 2; y < coreBottom - 1; y += 5) {
      if (y >= square.y - 1 && y <= square.y + square.h) continue;
      site.props.push({ kind: 'lamp', x: y % 2 ? cx + 0.18 : cx + avenue - 0.18, y: y + 0.5, angle: 0 });
    }
  }

  // Headstones in the graveyard beside each temple.
  for (const plot of graveyards) {
    for (let y = plot.y; y < plot.y + plot.h; y++) {
      for (let x = plot.x; x < plot.x + plot.w; x++) if (rng() < 0.8) put('tombstone', x, y);
    }
  }

  // What the countryside and the harbor leave lying about.
  for (const field of farmed) {
    if (rng() < 0.7) put('haystack', field.x, field.y);
    if (rng() < 0.4) put('haystack', field.x + 1, field.y);
  }
  if (plan.coast) {
    for (let i = 0; i < 26; i++) {
      const x = between(core.x, coreRight - 1, rng);
      const y = between(coreBottom + 3, coreBottom + 4, rng);
      if (ground.tiles[y * w + x] === TILE.plaza) put(rng() < 0.2 ? 'cart' : 'crates', x, y, rng() * 3);
    }
  }
  if (castle) {
    put('cart', castle.x + 3, castle.y + castle.h - 3, 0.3);
    put('crates', castle.x + castle.w - 4, castle.y + castle.h - 3);
    put('haystack', castle.x + 2, castle.y + castle.h - 5);
    for (const x of [gateX - 2, gateX + avenue + 1]) put('lamp', x, castle.y + castle.h - 2);
  }

  // Woods outside; in town, trees along the streets and in the yards, bushes and flower beds.
  const arid = context.terrain === 'desert' || context.terrain === 'snow';
  const beside = (x: number, y: number, tile: number) =>
    ground.get(x + 1, y) === tile ||
    ground.get(x - 1, y) === tile ||
    ground.get(x, y + 1) === tile ||
    ground.get(x, y - 1) === tile;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const index = y * w + x;
      if (ground.tiles[index] !== TILE.grass || built[index] || taken[index]) continue;
      const inCore = x >= core.x - 1 && x <= coreRight && y >= core.y - 1 && y <= coreBottom;
      if (ground.used[index] === WALLED) continue;
      if (!inCore && !ground.used[index] && wild(site, ground, noise, rng, x, y)) continue;
      const wooded = fbm(noise, x * 0.05 + 40, y * 0.05, 3) > 0.05;
      const inPark = parks.some(
        (park) => x >= park.x && x < park.x + park.w && y >= park.y && y < park.y + park.h,
      );
      const byStreet = inCore && beside(x, y, TILE.road);
      const inTown = ruin ? 0.3 : inPark ? 0.32 : byStreet ? 0.16 : 0.1;
      const chance = (inCore ? inTown : wooded ? 0.55 : 0.04) * WOODS[context.terrain];
      if (rng() < chance) {
        site.trees.push({ x: x + 0.2 + rng() * 0.6, y: y + 0.2 + rng() * 0.6, r: 0.45 + rng() * 0.4 });
      } else if (inCore) {
        // Lower growth where no tree stands: more of it in a garden, wilder in a ruin.
        const roll = rng();
        if (ruin) {
          if (roll < 0.12) put('rubble', x, y);
          else if (roll < 0.3) put('bush', x, y);
        } else if (inPark) {
          if (roll < 0.2 && !arid) put('flowers', x, y);
          else if (roll < 0.38) put('bush', x, y);
          else if (roll < 0.44) put('bench', x, y, rng() < 0.5 ? 0 : Math.PI / 2);
        } else if (!arid) {
          if (roll < 0.07) put('flowers', x, y);
          else if (roll < 0.2) put('bush', x, y);
          else if (roll < 0.22 && byStreet) put('crates', x, y, rng() * 3);
        }
      }
    }
  }

  // The two main roads are named where they leave the square.
  const names = shuffled(STREETS, rng);
  site.streets.push({
    name: names[0],
    x: (core.x + square.x) / 2,
    y: cy + avenue / 2,
    vertical: false,
  });
  site.streets.push({
    name: centered ? 'Avenida do Rei' : names[1],
    x: cx + avenue / 2,
    y: (square.y + square.h + coreBottom) / 2,
    vertical: true,
  });
  if (castle && !centered) {
    site.streets.push({
      name: 'Avenida do Rei',
      x: gateX + avenue / 2,
      y: (castle.y + castle.h + cy) / 2 + 1,
      vertical: true,
    });
  }
  return site;
}

/**
 * What the wild ground of some terrains has instead of a tree: a pool in the
 * swamp, a boulder among the hills. Returns whether the square was taken.
 */
function wild(
  site: Site,
  ground: Ground,
  noise: (x: number, y: number) => number,
  rng: Rng,
  x: number,
  y: number,
): boolean {
  if (site.terrain === 'swamp' && fbm(noise, x * 0.13 + 90, y * 0.13, 2) > 0.28) {
    ground.tiles[y * ground.w + x] = TILE.water;
    return true;
  }
  if (rng() < ROCKS[site.terrain]) {
    site.rocks.push({ x: x + 0.3 + rng() * 0.4, y: y + 0.3 + rng() * 0.4, r: 0.3 + rng() * 0.35 });
    return true;
  }
  return false;
}

/** What makes a town a port: warehouses on the quay, piers with boats, a lighthouse. */
function harbor(site: Site, ground: Ground, core: Rect, shore: (x: number) => number, rng: Rng): void {
  const quayTop = core.y + core.h;
  const right = core.x + core.w;
  // Warehouses stand in a row along the back of the quay.
  let named = false;
  for (let x = core.x + 1; x + 5 < right; x += between(7, 10, rng)) {
    const rect: Rect = { x, y: quayTop + 1, w: between(4, 5, rng), h: 2 };
    if (ground.get(rect.x, rect.y) !== TILE.plaza || ground.get(rect.x + rect.w, rect.y) !== TILE.plaza)
      continue;
    // The avenue, two cells wide, reaches the water between them.
    let avenue = false;
    for (let dx = -1; dx < rect.w; dx++) {
      avenue ||=
        ground.get(rect.x + dx, quayTop - 1) === TILE.road &&
        ground.get(rect.x + dx + 1, quayTop - 1) === TILE.road;
    }
    if (avenue) continue;
    site.buildings.push(building(rect, 'warehouse', rng));
    if (!named) site.places.push({ name: 'Armazéns do Porto', ...middle(rect) });
    named = true;
  }
  // Piers run out into the water, a boat moored at most of them.
  let pierNamed = false;
  for (let x = core.x + 4; x < right - 3; x += between(6, 9, rng)) {
    const from = shore(x);
    const length = between(4, 6, rng);
    for (let y = from; y < Math.min(site.h - 1, from + length); y++) ground.set(x, y, TILE.pier);
    if (rng() < 0.75) site.boats.push({ x: x + 1.6, y: from + length / 2 + 0.5, vertical: true });
    if (!pierNamed) site.places.push({ name: 'Cais', x: x + 0.5, y: from - 1 });
    pierNamed = true;
  }
  for (let i = 0; i < 3; i++) {
    site.boats.push({ x: between(3, site.w - 4, rng), y: site.h - 2 - rng() * 2, vertical: false });
  }
  const harborMaster: Rect = { x: right - 5, y: quayTop + 1, w: 4, h: 2 };
  if (
    !site.buildings.some((b) => b.x < harborMaster.x + 5 && b.x + b.w > harborMaster.x - 1 && b.y >= quayTop)
  ) {
    site.buildings.push(building(harborMaster, 'harbor', rng));
    site.places.push({ name: 'Capitania do Porto', ...middle(harborMaster) });
  }
  // The lighthouse stands apart, on the point west of the quay.
  const light: Rect = { x: 0, y: shore(1) - 4, w: 3, h: 3 };
  site.buildings.push(building(light, 'lighthouse', rng));
  ground.claim({ x: light.x - 1, y: light.y - 1, w: 5, h: 5 });
  site.places.push({ name: 'Farol', ...middle(light) });
}

/** A wizard's or a lord's tower: a walled yard in the woods, at the end of a track. */
function tower(seed: string, rng: Rng, context: SiteContext): Site {
  const w = 28;
  const h = 24;
  const ground = new Ground(w, h, TILE.grass);
  const noise = createNoise2D(rng);
  const site: Site = {
    kind: 'tower',
    seed,
    name: named(suggestName('tower', rng), context),
    w,
    h,
    cellMeters: 3,
    tiles: ground.tiles,
    buildings: [],
    walls: [],
    places: [],
    streets: [],
    terrain: context.terrain,
    trees: [],
    rocks: [],
    props: [],
    boats: [],
    doors: [],
  };
  const yard: Rect = { x: 7 + between(-1, 1, rng), y: 6 + between(-1, 1, rng), w: 14, h: 12 };
  ground.fill(yard, TILE.yard);
  // A track leaves by the middle of every side a road arrives by, wandering a little.
  const midX = yard.x + Math.floor(yard.w / 2);
  const midY = yard.y + Math.floor(yard.h / 2);
  const gates: Record<SiteSide, readonly [number, number, number, number]> = {
    north: [midX, yard.y, 0, -1],
    east: [yard.x + yard.w - 1, midY, 1, 0],
    south: [midX, yard.y + yard.h - 1, 0, 1],
    west: [yard.x, midY, -1, 0],
  };
  for (const side of SITE_SIDES.filter((s) => context.exits.includes(s))) {
    let [x, y] = gates[side];
    const [, , dx, dy] = gates[side];
    for (let step = 0; ground.inside(x, y); step++) {
      ground.road(x, y);
      if (step > 2 && rng() < 0.3) {
        const turn = rng() < 0.5 ? 1 : -1;
        if (dx === 0) x += turn;
        else y += turn;
        ground.road(x, y);
      }
      x += dx;
      y += dy;
    }
  }
  if (rng() < 0.6) {
    // A pond in the woods.
    const px = rng() < 0.5 ? 2 : w - 3;
    const py = between(4, h - 5, rng);
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        if ((dx * dx) / 12 + (dy * dy) / 6 + noise(dx * 0.4, dy * 0.4) * 0.4 < 1) {
          ground.set(px + dx, py + dy, TILE.water);
        }
      }
    }
  }
  site.walls.push(wallAround(ground, { x: yard.x + 1, y: yard.y + 1, w: yard.w - 2, h: yard.h - 2 }, rng));

  // The woods are kept cut back a little from the wall.
  ground.claim({ x: yard.x - 1, y: yard.y - 1, w: yard.w + 2, h: yard.h + 2 });
  const keep: Rect = { x: yard.x + 4, y: yard.y + 2, w: 5, h: 5 };
  const put = (rect: Rect, kind: BuildingKind, name: string) => {
    site.buildings.push(building(rect, kind, rng));
    site.places.push({ name, ...middle(rect) });
  };
  put(keep, 'tower', site.name);
  put({ x: yard.x + yard.w - 5, y: yard.y + 2, w: 3, h: 3 }, 'house', 'Alojamento');
  put({ x: yard.x + 2, y: yard.y + yard.h - 4, w: 4, h: 2 }, 'stable', 'Estábulo');
  put({ x: yard.x + 2, y: yard.y + 4, w: 1, h: 1 }, 'well', 'Poço');
  const garden: Rect = { x: yard.x + yard.w - 5, y: yard.y + 6, w: 3, h: 3 };
  ground.fill(garden, TILE.field);
  site.places.push({ name: 'Horta', ...middle(garden) });
  site.props.push(
    { kind: 'cart', x: yard.x + 7.5, y: yard.y + yard.h - 2.5, angle: 0.5 },
    { kind: 'crates', x: yard.x + 6.5, y: yard.y + yard.h - 3.4, angle: 1 },
    { kind: 'haystack', x: yard.x + 2.5, y: yard.y + yard.h - 4.6, angle: 0 },
    { kind: 'bench', x: yard.x + yard.w - 5.6, y: yard.y + 4.5, angle: Math.PI / 2 },
    { kind: 'flowers', x: yard.x + yard.w - 3.5, y: yard.y + 9.6, angle: 0 },
    { kind: 'bush', x: yard.x + 2.5, y: yard.y + 2.5, angle: 0 },
  );

  for (let y = 0; y < h; y++) {
    for (let cellX = 0; cellX < w; cellX++) {
      if (ground.used[y * w + cellX]) continue;
      if (wild(site, ground, noise, rng, cellX, y)) continue;
      // Woods as thick as the terrain allows, with clearings.
      const open = fbm(noise, cellX * 0.08, y * 0.08, 3) > 0.35;
      if (rng() < (open ? 0.1 : 0.5) * WOODS[context.terrain]) {
        site.trees.push({ x: cellX + 0.2 + rng() * 0.6, y: y + 0.2 + rng() * 0.6, r: 0.5 + rng() * 0.45 });
      }
    }
  }
  return site;
}

const ROOMS = [
  'Sala da Guarda',
  'Arsenal',
  'Cripta',
  'Prisão',
  'Santuário Profano',
  'Covil',
  'Depósito',
  'Refeitório',
  'Biblioteca Esquecida',
  'Câmara de Rituais',
  'Dormitório',
  'Sala das Estátuas',
  'Ossário',
  'Sala do Poço',
];

/** Rooms dug into the rock and the passages between them, on the combat grid. */
function dungeon(seed: string, rng: Rng, context: SiteContext): Site {
  const w = 48;
  const h = 36;
  const ground = new Ground(w, h, TILE.rock);
  const site: Site = {
    kind: 'dungeon',
    seed,
    name: named(suggestName('dungeon', rng), context),
    w,
    h,
    cellMeters: 1.5,
    tiles: ground.tiles,
    buildings: [],
    walls: [],
    places: [],
    streets: [],
    terrain: context.terrain,
    trees: [],
    rocks: [],
    props: [],
    boats: [],
    doors: [],
  };
  const rooms: Rect[] = [];
  for (let attempt = 0; attempt < 400 && rooms.length < 12; attempt++) {
    const room: Rect = { x: 0, y: 0, w: between(4, 9, rng), h: between(4, 7, rng) };
    room.x = between(2, w - room.w - 2, rng);
    room.y = between(2, h - room.h - 2, rng);
    // Two cells of rock at least between any two rooms.
    if (ground.free({ x: room.x - 2, y: room.y - 2, w: room.w + 4, h: room.h + 4 })) {
      ground.fill(room, TILE.floor);
      rooms.push(room);
    }
  }
  const centerOf = (room: Rect) => ({
    x: room.x + Math.floor(room.w / 2),
    y: room.y + Math.floor(room.h / 2),
  });
  const dig = (from: Rect, to: Rect) => {
    const a = centerOf(from);
    const b = centerOf(to);
    const cornerFirst = rng() < 0.5;
    // An L: along one axis, then the other.
    const turn = cornerFirst ? { x: b.x, y: a.y } : { x: a.x, y: b.y };
    for (const [p, q] of [
      [a, turn],
      [turn, b],
    ]) {
      const steps = Math.max(Math.abs(q.x - p.x), Math.abs(q.y - p.y));
      for (let i = 0; i <= steps; i++) {
        ground.set(p.x + Math.sign(q.x - p.x) * i, p.y + Math.sign(q.y - p.y) * i, TILE.floor);
      }
    }
  };
  // Every room is joined to the nearest one already reachable, then a few loops are added.
  const reach = (a: Rect, b: Rect) =>
    Math.hypot(centerOf(a).x - centerOf(b).x, centerOf(a).y - centerOf(b).y);
  for (let i = 1; i < rooms.length; i++) {
    const nearest = rooms
      .slice(0, i)
      .reduce((best, room) => (reach(room, rooms[i]) < reach(best, rooms[i]) ? room : best));
    dig(nearest, rooms[i]);
  }
  for (let i = 0; i < Math.floor(rooms.length / 4); i++) {
    const a = pick(rooms, rng);
    const b = rooms
      .filter((room) => room !== a)
      .reduce((best, room) => (reach(room, a) < reach(best, a) ? room : best));
    dig(a, b);
  }

  // A door wherever a passage one cell wide opens into a room.
  const rock = (x: number, y: number) => ground.get(x, y) === TILE.rock || ground.get(x, y) === -1;
  for (const room of rooms) {
    for (let x = room.x; x < room.x + room.w; x++) {
      for (const y of [room.y - 1, room.y + room.h]) {
        if (!rock(x, y) && rock(x - 1, y) && rock(x + 1, y)) site.doors.push({ x, y, vertical: true });
      }
    }
    for (let y = room.y; y < room.y + room.h; y++) {
      for (const x of [room.x - 1, room.x + room.w]) {
        if (!rock(x, y) && rock(x, y - 1) && rock(x, y + 1)) site.doors.push({ x, y, vertical: false });
      }
    }
  }

  // The way in is the first room; the treasure lies as far from it as the dungeon goes.
  const entrance = rooms[0];
  const treasure = rooms
    .slice(1)
    .reduce((best, room) => (reach(room, entrance) > reach(best, entrance) ? room : best));
  const names = shuffled(ROOMS, rng);
  for (const room of rooms) {
    const name = room === entrance ? 'Entrada' : room === treasure ? 'Sala do Tesouro' : names.pop()!;
    site.places.push({ name, x: room.x + 0.9, y: room.y + 0.9 });
    if (name === 'Sala do Poço') {
      const pool = centerOf(room);
      for (const [dx, dy] of [
        [0, 0],
        [-1, 0],
        [0, -1],
        [-1, -1],
      ]) {
        ground.tiles[(pool.y + dy) * w + pool.x + dx] = TILE.water;
      }
    }
  }
  site.buildings.push(
    building({ x: entrance.x + entrance.w - 2, y: entrance.y + entrance.h - 1, w: 2, h: 1 }, 'stairs', rng),
  );
  return site;
}

/** The same place with north and south changed over. */
function upsideDown(site: Site): Site {
  const { w, h } = site;
  const tiles = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) tiles.set(site.tiles.subarray(y * w, (y + 1) * w), (h - 1 - y) * w);
  const point = <T extends { y: number }>(p: T): T => ({ ...p, y: h - p.y });
  const cell = <T extends { y: number }>(c: T): T => ({ ...c, y: h - 1 - c.y });
  return {
    ...site,
    tiles,
    buildings: site.buildings.map((b) => ({ ...b, y: h - b.y - b.h })),
    walls: site.walls.map((wall) => ({
      ...wall,
      y: h - wall.y - wall.h,
      gates: wall.gates.map(cell),
      towers: wall.towers.map(cell),
      gaps: wall.gaps.map(cell),
    })),
    places: site.places.map(point),
    streets: site.streets.map(point),
    trees: site.trees.map(point),
    rocks: site.rocks.map(point),
    props: site.props.map((prop) => ({ ...point(prop), angle: -prop.angle })),
    boats: site.boats.map(point),
    doors: site.doors.map(cell),
  };
}

/**
 * The map of a place of the given kind. The same kind, seed and surroundings
 * always give the same map. Left to itself, a place stands on open plains with
 * a road out on every side; a dungeon, being underground, ignores both.
 */
export function generateSite(
  kind: StructureKind,
  seed: string,
  surroundings: Partial<SiteContext> = {},
): Site {
  const context: SiteContext = { terrain: 'plains', exits: SITE_SIDES, ...surroundings };
  const rng = seededRng(`site:${kind}:${seed}`);
  if (kind === 'tower') return tower(seed, rng, context);
  if (kind === 'dungeon') return dungeon(seed, rng, context);
  if (kind === 'kingdom' && seededRng(`site:castle:${seed}`)() < 0.5) {
    // Half the capitals have the castle in the south: the town is laid out
    // with north and south changed over, and then turned.
    const turn = (side: SiteSide): SiteSide =>
      side === 'north' ? 'south' : side === 'south' ? 'north' : side;
    return upsideDown(town(kind, seed, rng, { ...context, exits: context.exits.map(turn) }));
  }
  return town(kind, seed, rng, context);
}
