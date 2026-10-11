import { seededRng } from '../generator/rng.ts';
import { tavernName } from './names.ts';

export const TAVERN_SIZES = ['small', 'medium', 'large'] as const;
export type TavernSize = (typeof TAVERN_SIZES)[number];

export type RoomKind = 'common' | 'kitchen' | 'storage' | 'guest';

/** A rectangular room, in squares. One square is 5 feet, the D&D battle grid. */
export interface Room {
  kind: RoomKind;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * A door or window in a wall. Walls run along the lines of the grid: an 'h'
 * opening goes from (x, y) to (x + length, y), a 'v' one from (x, y) to
 * (x, y + length).
 */
export interface Opening {
  x: number;
  y: number;
  dir: 'h' | 'v';
  length: number;
}

export type FurnitureKind =
  | 'bar'
  | 'shelf'
  | 'stool'
  | 'table-round'
  | 'table-long'
  | 'chair'
  | 'bench'
  | 'fireplace'
  | 'stairs'
  | 'stage'
  | 'stove'
  | 'counter'
  | 'washtub'
  | 'barrel'
  | 'crate'
  | 'bed'
  | 'chest'
  | 'rug';

/** A piece of furniture, as the box it takes up, in squares (fractions allowed). */
export interface Furniture {
  kind: FurnitureKind;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Which way the piece faces, for the ones with a front (fireplace, stairs). */
  facing?: 'n' | 's' | 'e' | 'w';
}

export interface Tavern {
  seed: string;
  size: TavernSize;
  name: string;
  /** Size of the whole map in squares, including one square of ground around the building. */
  w: number;
  h: number;
  rooms: Room[];
  /** Every door, the entrance included. */
  doors: Opening[];
  /** The front door, on the outer wall of the common room. */
  entrance: Opening;
  windows: Opening[];
  furniture: Furniture[];
  /** 1 for each square a miniature cannot stand on: taken by a table, the bar, a barrel and so on. */
  blocked: Uint8Array;
}

/** Ground left around the building, in squares. */
const MARGIN = 1;

/** Interior size of the building and of its parts, in squares. */
const PLAN: Record<TavernSize, { w: number; h: number; back: number; guests: number }> = {
  small: { w: 14, h: 11, back: 3, guests: 0 },
  medium: { w: 20, h: 13, back: 4, guests: 4 },
  large: { w: 26, h: 17, back: 4, guests: 5 },
};

/** Depth of a guest room along the guest wing; the last one takes what is left over. */
const GUEST_DEPTH = 4;
/** A table with its seats takes a 3×3 block; blocks are laid out this far apart, leaving an aisle. */
const TABLE_PITCH = 4;

/**
 * Lays out a tavern interior on a 5-foot grid: a common room with a bar,
 * fireplace and tables, a kitchen and a storeroom behind the bar, and, in the
 * larger sizes, guest rooms, stairs and a stage. The same seed and size always
 * give the same tavern.
 */
export function generateTavern(seed: string, size: TavernSize): Tavern {
  const rng = seededRng(`${seed}:tavern:${size}`);
  const plan = PLAN[size];
  const w = plan.w + 2 * MARGIN;
  const h = plan.h + 2 * MARGIN;
  const blocked = new Uint8Array(w * h);
  /** Squares furniture must stay off: in front of doors, the hearth, the stairs. */
  const keepClear = new Uint8Array(w * h);
  const furniture: Furniture[] = [];
  const doors: Opening[] = [];
  const windows: Opening[] = [];

  const mark = (grid: Uint8Array, x: number, y: number, bw = 1, bh = 1) => {
    for (let cy = y; cy < y + bh; cy++) for (let cx = x; cx < x + bw; cx++) grid[cy * w + cx] = 1;
  };
  const isFree = (x: number, y: number, bw = 1, bh = 1) => {
    for (let cy = y; cy < y + bh; cy++) {
      for (let cx = x; cx < x + bw; cx++) if (blocked[cy * w + cx] || keepClear[cy * w + cx]) return false;
    }
    return true;
  };
  /** Adds a piece that fills whole squares and cannot be walked through. */
  const solid = (kind: FurnitureKind, x: number, y: number, bw = 1, bh = 1, facing?: Furniture['facing']) => {
    furniture.push({ kind, x, y, w: bw, h: bh, facing });
    mark(blocked, x, y, bw, bh);
  };
  const pick = <T>(list: readonly T[]): T => list[Math.floor(rng() * list.length)];

  // Rooms, laid out with the guest wing on the right; the whole plan may be mirrored at the end.
  const commonW = plan.w - plan.guests;
  const commonH = plan.h - plan.back;
  const left = MARGIN;
  const top = MARGIN;
  const commonY = top + plan.back;
  const kitchenW = Math.round(plan.w * 0.58);
  const kitchen: Room = { kind: 'kitchen', x: left, y: top, w: kitchenW, h: plan.back };
  const storage: Room = { kind: 'storage', x: left + kitchenW, y: top, w: plan.w - kitchenW, h: plan.back };
  const common: Room = { kind: 'common', x: left, y: commonY, w: commonW, h: commonH };
  const guests: Room[] = [];
  if (plan.guests > 0) {
    const count = Math.floor(commonH / GUEST_DEPTH);
    for (let k = 0; k < count; k++) {
      const depth = k === count - 1 ? commonH - GUEST_DEPTH * k : GUEST_DEPTH;
      guests.push({
        kind: 'guest',
        x: left + commonW,
        y: commonY + GUEST_DEPTH * k,
        w: plan.guests,
        h: depth,
      });
    }
  }
  const rooms = [common, kitchen, storage, ...guests];
  const bottom = commonY + commonH;
  const right = left + commonW;

  // The front door, two squares wide, near the middle of the front wall.
  const entranceX = left + Math.floor(commonW / 2) - 1 + Math.floor(rng() * 3) - 1;
  const entrance: Opening = { x: entranceX, y: bottom, dir: 'h', length: 2 };
  doors.push(entrance);
  mark(keepClear, entranceX, bottom - 1, 2, 1);
  furniture.push({ kind: 'rug', x: entranceX + 0.1, y: bottom - 1.35, w: 1.8, h: 1.1 });

  // The bar runs along the back of the common room, with a lane behind it for whoever is serving.
  const barLength = Math.min(9, Math.max(4, Math.round(commonW * 0.5)));
  const barX = left + 1;
  const barY = commonY + 1;
  solid('bar', barX, barY, barLength, 1);
  mark(keepClear, left, commonY, barLength + 2, 1);
  mark(keepClear, barX, barY + 1, barLength, 2);
  for (let k = 0; k < barLength; k++) {
    if (rng() < 0.85) furniture.push({ kind: 'stool', x: barX + k + 0.28, y: barY + 1.12, w: 0.44, h: 0.44 });
  }
  // Kitchen door, opening into the lane behind the bar.
  const kitchenDoorX = barX + 1 + Math.floor(rng() * Math.max(1, Math.min(barLength, kitchenW) - 3));
  doors.push({ x: kitchenDoorX, y: commonY, dir: 'h', length: 1 });
  for (let x = barX; x < barX + barLength; x++) {
    if (x !== kitchenDoorX) furniture.push({ kind: 'shelf', x: x + 0.05, y: commonY + 0.06, w: 0.9, h: 0.3 });
  }

  // Fireplace on the side wall away from the guest wing, with room in front of it.
  const hearthY = Math.min(bottom - 3, Math.max(barY + 3, commonY + Math.floor(commonH / 2)));
  solid('fireplace', left, hearthY, 1, 2, 'e');
  mark(keepClear, left + 1, hearthY, 1, 2);

  // Guest rooms: a door near the top of each, clear of the stairs below.
  for (const guest of guests) {
    doors.push({ x: guest.x, y: guest.y + 1, dir: 'v', length: 1 });
    mark(keepClear, guest.x - 1, guest.y + 1);
    mark(keepClear, guest.x, guest.y + 1);
    solid('bed', guest.x + guest.w - 1, guest.y, 1, 2);
    solid('chest', guest.x + guest.w - 1, guest.y + 2);
    solid('table-round', guest.x + 1, guest.y + guest.h - 1);
    furniture.push({ kind: 'chair', x: guest.x + 2.2, y: guest.y + guest.h - 0.78, w: 0.44, h: 0.44 });
    windows.push({ x: guest.x + guest.w, y: guest.y + Math.floor(guest.h / 2), dir: 'v', length: 1 });
  }
  if (guests.length > 0) {
    // Stairs to more rooms upstairs, in the front corner by the guest wing.
    furniture.push({ kind: 'stairs', x: right - 2, y: bottom - 3, w: 2, h: 3, facing: 'n' });
    mark(keepClear, right - 2, bottom - 4, 2, 4);
    const last = guests[guests.length - 1];
    windows.push({ x: last.x + Math.floor(last.w / 2), y: bottom, dir: 'h', length: 1 });
  }
  if (size === 'large') {
    // A low stage for a bard, in the front corner on the hearth side.
    furniture.push({ kind: 'stage', x: left, y: bottom - 2, w: 3, h: 2 });
    mark(keepClear, left, bottom - 3, 4, 3);
    furniture.push({ kind: 'stool', x: left + 1.28, y: bottom - 1.25, w: 0.44, h: 0.44 });
  }

  // Tables fill the rest of the floor in blocks of table plus seats, with aisles
  // between them, one along the front wall and one past the hearth.
  const tablesTop = barY + 3;
  const tablesLeft = left + 2;
  const depth = bottom - 1 - tablesTop;
  const width = right - 1 - tablesLeft;
  const rows = Math.floor((depth + 1) / TABLE_PITCH);
  const columns = Math.floor((width + 1) / TABLE_PITCH);
  const firstY = tablesTop + Math.floor((depth - (rows * TABLE_PITCH - 1)) / 2);
  const firstX = tablesLeft + Math.floor((width - (columns * TABLE_PITCH - 1)) / 2);
  let tables = 0;
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const x = firstX + column * TABLE_PITCH;
      const y = firstY + row * TABLE_PITCH;
      const roll = rng();
      // In a big room a spot is left empty now and then; a small one needs every table.
      const spare = rows * columns > 4 && tables > 0;
      if (!isFree(x, y, 3, 3) || (roll > 0.9 && spare)) continue;
      tables++;
      if (roll < 0.55) {
        // Round table, a chair on each side.
        furniture.push({ kind: 'table-round', x: x + 0.85, y: y + 0.85, w: 1.3, h: 1.3 });
        mark(blocked, x + 1, y + 1);
        for (const [dx, dy] of [
          [1.28, 0.3],
          [1.28, 2.26],
          [0.3, 1.28],
          [2.26, 1.28],
        ]) {
          furniture.push({ kind: 'chair', x: x + dx, y: y + dy, w: 0.44, h: 0.44 });
        }
      } else {
        // Long table with a bench down each side.
        furniture.push({ kind: 'table-long', x: x + 0.15, y: y + 1.05, w: 2.7, h: 0.9 });
        mark(blocked, x, y + 1, 3, 1);
        furniture.push({ kind: 'bench', x: x + 0.3, y: y + 0.5, w: 2.4, h: 0.36 });
        furniture.push({ kind: 'bench', x: x + 0.3, y: y + 2.14, w: 2.4, h: 0.36 });
      }
      mark(keepClear, x, y, 3, 3);
    }
  }

  // Windows along the outer walls of the common room.
  for (let y = commonY + 1; y < bottom; y += 3) {
    if (y < hearthY - 1 || y > hearthY + 2) windows.push({ x: left, y, dir: 'v', length: 1 });
    if (guests.length === 0) windows.push({ x: right, y, dir: 'v', length: 1 });
  }
  for (let x = left + 1; x < right - 1; x += 3) {
    if (x + 1 <= entranceX - 1 || x >= entranceX + 3) windows.push({ x, y: bottom, dir: 'h', length: 1 });
  }

  // Kitchen: stove on the back wall, a work counter, a washtub, a back door.
  const storageDoorY = top + Math.floor(plan.back / 2);
  doors.push({ x: storage.x, y: storageDoorY, dir: 'v', length: 1 });
  mark(keepClear, storage.x - 1, storageDoorY);
  mark(keepClear, storage.x, storageDoorY);
  mark(keepClear, kitchenDoorX, commonY - 1);
  const backDoorX = kitchen.x + kitchenW - 2;
  doors.push({ x: backDoorX, y: top, dir: 'h', length: 1 });
  mark(keepClear, backDoorX, top);
  solid('stove', kitchen.x + 1, top, 2, 1);
  solid('washtub', kitchen.x, top + plan.back - 1);
  for (let x = kitchen.x + 4; x + 1 < backDoorX - 1; x += 3) {
    if (isFree(x, top + 1, 2, 1)) solid('counter', x, top + 1, 2, 1);
  }
  if (isFree(kitchen.x, top)) solid('barrel', kitchen.x, top);

  // Storeroom: barrels and crates against the walls.
  for (let y = storage.y; y < storage.y + storage.h; y++) {
    for (let x = storage.x; x < storage.x + storage.w; x++) {
      const againstWall =
        y === storage.y ||
        y === storage.y + storage.h - 1 ||
        x === storage.x + storage.w - 1 ||
        x === storage.x;
      if (againstWall && isFree(x, y) && rng() < 0.62) solid(pick(['barrel', 'barrel', 'crate']), x, y);
    }
  }

  const tavern: Tavern = {
    seed,
    size,
    name: tavernName(rng),
    w,
    h,
    rooms,
    doors,
    entrance,
    windows,
    furniture,
    blocked,
  };
  return rng() < 0.5 ? mirrored(tavern) : tavern;
}

/** The same tavern flipped left to right, so the guest wing is not always on the same side. */
function mirrored(tavern: Tavern): Tavern {
  const { w, h } = tavern;
  const flipBox = <T extends { x: number; w: number }>(box: T): T => ({ ...box, x: w - box.x - box.w });
  const flipOpening = (o: Opening): Opening => ({ ...o, x: o.dir === 'h' ? w - o.x - o.length : w - o.x });
  const blocked = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) blocked[y * w + x] = tavern.blocked[y * w + (w - 1 - x)];
  const entrance = flipOpening(tavern.entrance);
  return {
    ...tavern,
    rooms: tavern.rooms.map(flipBox),
    doors: tavern.doors.map((door) => (door === tavern.entrance ? entrance : flipOpening(door))),
    entrance,
    windows: tavern.windows.map(flipOpening),
    furniture: tavern.furniture.map((piece) => {
      const facing = piece.facing === 'e' ? 'w' : piece.facing === 'w' ? 'e' : piece.facing;
      return { ...flipBox(piece), facing };
    }),
    blocked,
  };
}

/** Index of the room each square belongs to, or -1 for the ground outside. */
export function roomMap(tavern: Tavern): Int8Array {
  const map = new Int8Array(tavern.w * tavern.h).fill(-1);
  tavern.rooms.forEach((room, index) => {
    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) map[y * tavern.w + x] = index;
    }
  });
  return map;
}

/** Whether a door lies on the grid line between a square and its neighbor to the right or below. */
function doorBetween(tavern: Tavern, x: number, y: number, dx: number, dy: number): boolean {
  return tavern.doors.some((door) =>
    dx !== 0
      ? door.dir === 'v' && door.x === x + 1 && y >= door.y && y < door.y + door.length
      : dy !== 0 && door.dir === 'h' && door.y === y + 1 && x >= door.x && x < door.x + door.length,
  );
}

/**
 * The squares a miniature can walk to from outside the front door, going
 * through doors and around furniture: 1 where reachable.
 */
export function walkable(tavern: Tavern): Uint8Array {
  const { w, h, blocked, entrance } = tavern;
  const rooms = roomMap(tavern);
  const reached = new Uint8Array(w * h);
  // Walls stand wherever two squares belong to different rooms, unless a door is there.
  const open = (x: number, y: number, nx: number, ny: number) => {
    if (rooms[y * w + x] === rooms[ny * w + nx]) return true;
    const [ax, ay] = nx < x || ny < y ? [nx, ny] : [x, y];
    return doorBetween(tavern, ax, ay, Math.abs(nx - x), Math.abs(ny - y));
  };
  const start = entrance.y * w + entrance.x;
  reached[start] = 1;
  const pending = [start];
  while (pending.length) {
    const c = pending.pop()!;
    const x = c % w;
    const y = (c / w) | 0;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const nb = ny * w + nx;
      if (reached[nb] || blocked[nb] || !open(x, y, nx, ny)) continue;
      reached[nb] = 1;
      pending.push(nb);
    }
  }
  return reached;
}
