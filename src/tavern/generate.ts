import { seededRng } from '../generator/rng.ts';
import { tavernName } from './names.ts';

export const TAVERN_SIZES = ['small', 'medium', 'large'] as const;
export type TavernSize = (typeof TAVERN_SIZES)[number];

/**
 * How well kept the place is. A poor tavern is dirty and makeshift, with
 * broken and mismatched furniture; a rich one is tidy, matched and well
 * stocked. The floor plan is the same: only what fills it changes.
 */
export const TAVERN_QUALITIES = ['poor', 'medium', 'rich'] as const;
export type TavernQuality = (typeof TAVERN_QUALITIES)[number];

/** The rooms of a tavern, and those of the other interiors (see `interior/generate.ts`). */
export type RoomKind =
  'common' | 'kitchen' | 'storage' | 'guest' | 'living' | 'forge' | 'hall' | 'armory' | 'study' | 'sanctuary';

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

/** Pieces that fill whole squares: nothing else shares those squares and nobody walks through. */
export const SOLID_KINDS = [
  'bar',
  'fireplace',
  'stove',
  'oven',
  'cauldron',
  'counter',
  'washtub',
  'barrel',
  'crate',
  'sacks',
  'keg',
  'logs',
  'bed',
  'bed-double',
  'chest',
  'wardrobe',
  'nightstand',
  'desk',
  'plant',
  'anvil',
  'forge',
  'workbench',
  'throne',
  'altar',
  'statue',
  'pillar',
] as const;

/** Pieces that stand on the floor or on other furniture without closing off a square. */
export const LOOSE_KINDS = [
  'shelf',
  'pantry',
  'tap',
  'stool',
  'table-round',
  'table-long',
  'chair',
  'armchair',
  'bench',
  'stairs',
  'stage',
  'rug',
  'bucket',
  'stain',
  'straw',
  'bottle',
  'debris',
  'cobweb',
  'rat',
  'weapon-rack',
] as const;

export type FurnitureKind = (typeof SOLID_KINDS)[number] | (typeof LOOSE_KINDS)[number];

/** A piece of furniture, as the box it takes up, in squares (fractions allowed). */
export interface Furniture {
  kind: FurnitureKind;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Which way the piece faces, for the ones with a front (fireplace, stairs, armchair). */
  facing?: 'n' | 's' | 'e' | 'w';
  /** Which version of the piece this is: what is on a shelf, how fine a bed is, and so on. */
  variant?: string;
  /** Turn about its own middle, in radians: furniture knocked out of line. */
  angle?: number;
}

export interface Tavern {
  seed: string;
  size: TavernSize;
  quality: TavernQuality;
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

/** What the shelves behind the bar may hold, by quality. Repeats make a choice more likely. */
const SHELF_STOCK: Record<TavernQuality, readonly string[]> = {
  poor: ['empty', 'broken', 'few', 'mugs', 'few'],
  medium: ['bottles', 'mugs', 'bottles', 'jugs', 'kegs'],
  rich: ['fine', 'fine', 'glasses', 'kegs', 'plates', 'bottles'],
};
/** What is being prepared on a kitchen counter. */
const COUNTER_WORK = ['bread', 'meat', 'vegetables', 'fish', 'pie'] as const;

/**
 * Lays out a tavern interior on a 5-foot grid: a common room with a bar,
 * fireplace and tables, a kitchen and a storeroom behind the bar, and, in the
 * larger sizes, guest rooms, stairs and a stage. The same seed, size and
 * quality always give the same tavern, and quality never changes the walls and
 * doors: a seed is the same building, poorer or richer.
 */
export function generateTavern(seed: string, size: TavernSize, quality: TavernQuality = 'medium'): Tavern {
  // One stream for the building, another for what is in it, so quality leaves the plan alone.
  const build = seededRng(`${seed}:tavern:${size}`);
  const rng = seededRng(`${seed}:furnish:${size}:${quality}`);
  const plan = PLAN[size];
  const w = plan.w + 2 * MARGIN;
  const h = plan.h + 2 * MARGIN;
  const blocked = new Uint8Array(w * h);
  /** Squares furniture must stay off: in front of doors, the hearth, the stairs. */
  const keepClear = new Uint8Array(w * h);
  const furniture: Furniture[] = [];
  const doors: Opening[] = [];
  const windows: Opening[] = [];
  const poor = quality === 'poor';
  const rich = quality === 'rich';

  const mark = (grid: Uint8Array, x: number, y: number, bw = 1, bh = 1) => {
    for (let cy = y; cy < y + bh; cy++) for (let cx = x; cx < x + bw; cx++) grid[cy * w + cx] = 1;
  };
  const isFree = (x: number, y: number, bw = 1, bh = 1) => {
    for (let cy = y; cy < y + bh; cy++) {
      for (let cx = x; cx < x + bw; cx++) if (blocked[cy * w + cx] || keepClear[cy * w + cx]) return false;
    }
    return true;
  };
  type Extra = Pick<Furniture, 'facing' | 'variant' | 'angle'>;
  /** Adds a piece that fills whole squares and cannot be walked through. */
  const solid = (
    kind: (typeof SOLID_KINDS)[number],
    x: number,
    y: number,
    bw = 1,
    bh = 1,
    extra: Extra = {},
  ) => {
    furniture.push({ kind, x, y, w: bw, h: bh, ...extra });
    mark(blocked, x, y, bw, bh);
  };
  /** Adds a piece that closes off no square. */
  const loose = (
    kind: (typeof LOOSE_KINDS)[number],
    x: number,
    y: number,
    bw: number,
    bh: number,
    extra: Extra = {},
  ) => {
    furniture.push({ kind, x, y, w: bw, h: bh, ...extra });
  };
  const chance = (p: number) => rng() < p;
  const pick = <T>(list: readonly T[]): T => list[Math.floor(rng() * list.length)];
  /** How far out of line a piece stands: nothing in a rich tavern, a lot in a poor one. */
  const askew = (most: number) => (poor ? (rng() - 0.5) * 2 * most : 0);

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
  const entranceX = left + Math.floor(commonW / 2) - 1 + Math.floor(build() * 3) - 1;
  const entrance: Opening = { x: entranceX, y: bottom, dir: 'h', length: 2 };
  doors.push(entrance);
  mark(keepClear, entranceX, bottom - 1, 2, 1);
  if (!poor) loose('rug', entranceX + 0.1, bottom - 1.35, 1.8, 1.1, { variant: rich ? 'fine' : 'plain' });

  // The bar runs along the back of the common room, with a lane behind it for whoever is serving.
  const barLength = Math.min(9, Math.max(4, Math.round(commonW * 0.5)));
  const barX = left + 1;
  const barY = commonY + 1;
  solid('bar', barX, barY, barLength, 1, { variant: quality });
  mark(keepClear, left, commonY, barLength + 2, 1);
  mark(keepClear, barX, barY + 1, barLength, 2);
  for (let k = 0; k < barLength; k++) {
    if (!chance(poor ? 0.55 : rich ? 1 : 0.85)) continue;
    loose('stool', barX + k + 0.28 + askew(0.12), barY + 1.12 + askew(0.12), 0.44, 0.44, {
      variant: rich ? 'cushion' : 'plain',
    });
  }
  // Beer pumps on the bar: none in a poor place, which pours straight from the keg.
  const taps = poor ? 0 : rich ? Math.min(4, Math.floor(barLength / 2)) : 2;
  for (let k = 0; k < taps; k++) {
    const along = 1.3 + (k * (barLength - 2.3)) / Math.max(1, taps - 1);
    loose('tap', barX + along - 0.2, barY + 0.2, 0.4, 0.4);
  }
  // Kitchen door, opening into the lane behind the bar, and shelves along that wall.
  const kitchenDoorX = barX + 1 + Math.floor(build() * Math.max(1, Math.min(barLength, kitchenW) - 3));
  doors.push({ x: kitchenDoorX, y: commonY, dir: 'h', length: 1 });
  for (let x = barX; x < barX + barLength; x++) {
    if (x !== kitchenDoorX)
      loose('shelf', x + 0.05, commonY + 0.06, 0.9, 0.3, { variant: pick(SHELF_STOCK[quality]) });
  }
  // Big kegs on a rack past the end of the bar.
  const racks = poor ? (chance(0.4) ? 1 : 0) : rich ? 2 : 1;
  for (let k = 0; k < racks; k++) {
    if (isFree(barX + barLength + 1 + k, commonY)) solid('keg', barX + barLength + 1 + k, commonY);
  }

  // Fireplace on the side wall away from the guest wing, with room in front of it.
  const hearthY = Math.min(bottom - 3, Math.max(barY + 3, commonY + Math.floor(commonH / 2)));
  solid('fireplace', left, hearthY, 1, 2, { facing: 'e' });
  mark(keepClear, left + 1, hearthY, 1, 2);
  if (hearthY + 2 < bottom - 1 && isFree(left, hearthY + 2)) solid('logs', left, hearthY + 2);
  if (rich) {
    // Two armchairs on a rug by the fire.
    loose('rug', left + 1.05, hearthY - 0.4, 2.5, 2.8, { variant: 'hearth' });
    loose('armchair', left + 2.3, hearthY - 0.1, 0.9, 0.9, { facing: 'w' });
    loose('armchair', left + 2.3, hearthY + 1.2, 0.9, 0.9, { facing: 'w' });
    mark(keepClear, left + 2, hearthY, 2, 2);
  }

  // Guest rooms: a door near the top of each, clear of the stairs below.
  const standard = pick(['double', 'double-desk'] as const);
  for (const guest of guests) {
    doors.push({ x: guest.x, y: guest.y + 1, dir: 'v', length: 1 });
    mark(keepClear, guest.x - 1, guest.y + 1);
    mark(keepClear, guest.x, guest.y + 1);
    windows.push({ x: guest.x + guest.w, y: guest.y + Math.floor(guest.h / 2), dir: 'v', length: 1 });
    const far = guest.x + guest.w - 1;
    const foot = guest.y + guest.h - 1;

    if (poor) {
      // A straw mattress or two, and whatever was to hand for furniture.
      solid('bed', far, guest.y, 1, 2, { variant: 'straw' });
      if (chance(0.5)) {
        // A shared room: a second mattress along the front wall.
        solid('bed', guest.x + 1, foot, 2, 1, { variant: 'straw' });
      } else {
        if (chance(0.6))
          solid('crate', far, guest.y + 2, 1, 1, { variant: chance(0.4) ? 'broken' : 'plain' });
        loose('stool', guest.x + 1.3, foot + 0.3, 0.44, 0.44, { angle: askew(0.5) });
      }
      loose('bucket', guest.x + 0.25, foot + 0.3, 0.45, 0.45);
      loose('cobweb', guest.x, guest.y, 1, 1, { variant: 'nw' });
      if (chance(0.7))
        loose('stain', guest.x + 1 + rng(), guest.y + 1.6 + rng() * 0.8, 0.9, 0.7, { variant: 'dark' });
      if (chance(0.5)) loose('bottle', guest.x + 1.2 + rng(), guest.y + 2.3, 0.4, 0.16, { angle: rng() * 3 });
      continue;
    }

    // A rich house furnishes every room alike; an ordinary one, each as it came.
    const layout = rich ? standard : pick(['single', 'double', 'wardrobe'] as const);
    const fine = rich ? 'fine' : 'plain';
    if (layout === 'single' || layout === 'wardrobe') {
      solid('bed', far, guest.y, 1, 2, { variant: fine });
      solid('chest', far, guest.y + 2, 1, 1, { variant: fine });
    } else {
      solid('bed-double', far - 1, guest.y, 2, 2, { variant: fine });
      solid('nightstand', far - 2, guest.y, 1, 1, { variant: fine });
      if (rich || chance(0.5))
        loose('rug', guest.x + 0.55, guest.y + 2.08, guest.w - 1.3, 0.84, { variant: 'room' });
    }
    if (layout === 'single') {
      solid('nightstand', guest.x + 1, foot, 1, 1, { variant: fine });
      loose('chair', guest.x + 2.2, foot + 0.28, 0.44, 0.44);
    } else if (layout === 'wardrobe' || layout === 'double') {
      solid('wardrobe', far - 1, foot, 2, 1, { variant: fine });
    } else {
      solid('wardrobe', far - 1, foot, 2, 1, { variant: fine });
      solid('desk', guest.x, foot, 1, 1, { variant: fine });
      loose('chair', guest.x + 1.2, foot + 0.28, 0.44, 0.44, { variant: 'cushion' });
    }
  }
  if (guests.length > 0) {
    // Stairs to more rooms upstairs, in the front corner by the guest wing.
    loose('stairs', right - 2, bottom - 3, 2, 3, { facing: 'n' });
    mark(keepClear, right - 2, bottom - 4, 2, 4);
    const last = guests[guests.length - 1];
    windows.push({ x: last.x + Math.floor(last.w / 2), y: bottom, dir: 'h', length: 1 });
  }
  if (size === 'large') {
    // A low stage for a bard, in the front corner on the hearth side.
    loose('stage', left, bottom - 2, 3, 2, { variant: quality });
    mark(keepClear, left, bottom - 3, 4, 3);
    loose('stool', left + 1.28, bottom - 1.25, 0.44, 0.44);
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
  const seatStyle = rich ? 'cushion' : 'plain';
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
      mark(keepClear, x, y, 3, 3);

      if (poor && roll < 0.3) {
        // No table at all: an upturned barrel with stools round it.
        solid('barrel', x + 1, y + 1, 1, 1, { variant: 'table' });
        for (const [dx, dy] of [
          [1.28, 0.25],
          [0.25, 1.5],
          [2.3, 1.6],
        ]) {
          if (chance(0.8)) loose('stool', x + dx + askew(0.15), y + dy + askew(0.15), 0.44, 0.44);
        }
      } else if (roll < 0.55) {
        // Round table, a chair on each side.
        const lit = poor ? (chance(0.5) ? 'poor-lit' : 'poor') : quality;
        loose('table-round', x + 0.85, y + 0.85, 1.3, 1.3, { variant: lit });
        mark(blocked, x + 1, y + 1);
        for (const [dx, dy] of [
          [1.28, 0.3],
          [1.28, 2.26],
          [0.3, 1.28],
          [2.26, 1.28],
        ]) {
          if (poor && chance(0.25)) {
            // A chair is missing; sometimes it is lying broken nearby.
            if (chance(0.5))
              loose('debris', x + dx - 0.1 + askew(0.3), y + dy - 0.1 + askew(0.3), 0.6, 0.6, {
                angle: rng() * 6,
              });
            continue;
          }
          loose('chair', x + dx + askew(0.13), y + dy + askew(0.13), 0.44, 0.44, {
            variant: seatStyle,
            angle: askew(0.5),
          });
        }
      } else {
        // Long table: benches down each side, or proper chairs in a rich house.
        const lit = poor ? (chance(0.5) ? 'poor-lit' : 'poor') : quality;
        loose('table-long', x + 0.15, y + 1.05, 2.7, 0.9, { variant: lit, angle: askew(0.05) });
        mark(blocked, x, y + 1, 3, 1);
        for (const benchY of [y + 0.5, y + 2.14]) {
          if (rich) {
            for (const dx of [0.4, 1.28, 2.16])
              loose('chair', x + dx, benchY - 0.04, 0.44, 0.44, { variant: seatStyle });
          } else {
            const broken = poor && chance(0.25);
            loose('bench', x + 0.3, benchY, broken ? 1.5 : 2.4, 0.36, {
              variant: broken ? 'broken' : 'plain',
              angle: askew(0.08),
            });
          }
        }
      }
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

  // Kitchen doors: to the storeroom, and out the back.
  const storageDoorY = top + Math.floor(plan.back / 2);
  doors.push({ x: storage.x, y: storageDoorY, dir: 'v', length: 1 });
  mark(keepClear, storage.x - 1, storageDoorY);
  mark(keepClear, storage.x, storageDoorY);
  mark(keepClear, kitchenDoorX, commonY - 1);
  const backDoorX = kitchen.x + kitchenW - 2;
  doors.push({ x: backDoorX, y: top, dir: 'h', length: 1 });
  mark(keepClear, backDoorX, top);

  // Kitchen: where the cooking is done, work counters, water, and stores along the back wall.
  const kitchenFoot = top + plan.back - 1;
  let countersFrom = kitchen.x + 4;
  if (poor) {
    // A cauldron over an open fire, a pile of wood, and a bucket for a sink.
    solid('cauldron', kitchen.x + 1, top);
    solid('logs', kitchen.x + 2, top);
    loose('bucket', kitchen.x + 0.3, kitchenFoot + 0.28, 0.45, 0.45);
    if (isFree(kitchen.x, top)) solid('sacks', kitchen.x, top);
  } else if (rich) {
    // A brick oven as well as the stove, and a proper washtub.
    const ovenDepth = plan.back >= 4 ? 2 : 1;
    solid('oven', kitchen.x, top, 2, ovenDepth);
    solid('stove', kitchen.x + 2, top, 2, 1);
    solid('washtub', kitchen.x, kitchenFoot);
    countersFrom = kitchen.x + 5;
  } else {
    solid('stove', kitchen.x + 1, top, 2, 1);
    solid('washtub', kitchen.x, kitchenFoot);
    if (isFree(kitchen.x, top)) solid('barrel', kitchen.x, top);
  }
  let counters = 0;
  for (let x = countersFrom; x + 1 < backDoorX - 1; x += 3) {
    if (poor && counters >= 1) break;
    if (!isFree(x, top + 1, 2, 1)) continue;
    solid('counter', x, top + 1, 2, 1, { variant: poor ? 'rough' : pick(COUNTER_WORK) });
    counters++;
  }
  // Shelves of jars and crocks on the back wall, wherever it is bare.
  for (let x = countersFrom; x < kitchen.x + kitchenW; x++) {
    if (x === backDoorX || blocked[top * w + x]) continue;
    if (chance(poor ? 0.15 : rich ? 0.9 : 0.5))
      loose('pantry', x + 0.05, top + 0.06, 0.9, 0.3, { variant: quality });
  }
  // Sacks of flour and a spare barrel in the corners left over.
  for (const [x, y] of [
    [kitchen.x + kitchenW - 1, kitchenFoot],
    [kitchen.x + kitchenW - 1, top],
    [kitchen.x + 2, kitchenFoot],
  ]) {
    if (isFree(x, y) && chance(poor ? 0.35 : 0.6)) solid(pick(['sacks', 'sacks', 'barrel']), x, y);
  }

  // Storeroom: barrels, crates and sacks against the walls. Sparse and picked over
  // in a poor place, packed tight in a rich one.
  const stocked = poor ? 0.38 : rich ? 0.8 : 0.62;
  for (let y = storage.y; y < storage.y + storage.h; y++) {
    for (let x = storage.x; x < storage.x + storage.w; x++) {
      const againstWall =
        y === storage.y ||
        y === storage.y + storage.h - 1 ||
        x === storage.x + storage.w - 1 ||
        x === storage.x;
      if (!againstWall || !isFree(x, y) || !chance(stocked)) continue;
      const kind = pick(
        rich
          ? (['barrel', 'barrel', 'crate', 'keg', 'sacks'] as const)
          : (['barrel', 'crate', 'crate', 'sacks'] as const),
      );
      const variant =
        kind !== 'crate'
          ? undefined
          : poor && chance(0.4)
            ? 'broken'
            : rich && chance(0.5)
              ? 'stack'
              : 'plain';
      solid(kind, x, y, 1, 1, { variant });
    }
  }

  // The state of the floor: what was spilled, dropped and never swept up.
  const anywhere = (room: Room, bw: number, bh: number): [number, number] => [
    room.x + 0.2 + rng() * (room.w - bw - 0.4),
    room.y + 0.2 + rng() * (room.h - bh - 0.4),
  ];
  const spills = poor ? 7 + Math.floor(rng() * 6) : rich ? 0 : 1 + Math.floor(rng() * 3);
  for (let k = 0; k < spills; k++) {
    const size = 0.7 + rng() * 0.9;
    loose('stain', ...anywhere(common, size, size * 0.8), size, size * 0.8, {
      variant: pick(['beer', 'beer', 'dark', 'mud']),
    });
  }
  if (poor) {
    for (let k = 0; k < 4 + Math.floor(rng() * 4); k++) {
      const size = 1 + rng() * 1.2;
      loose('straw', ...anywhere(common, size, size), size, size, { angle: rng() * 3 });
    }
    for (let k = 0; k < 2 + Math.floor(rng() * 3); k++)
      loose('bottle', ...anywhere(common, 0.4, 0.4), 0.4, 0.16, { angle: rng() * 6 });
    for (const room of [common, kitchen, storage]) {
      for (const corner of ['nw', 'ne', 'sw', 'se']) {
        if (!chance(0.5)) continue;
        loose(
          'cobweb',
          corner[1] === 'w' ? room.x : room.x + room.w - 1,
          corner[0] === 'n' ? room.y : room.y + room.h - 1,
          1,
          1,
          {
            variant: corner,
          },
        );
      }
    }
    loose('stain', ...anywhere(kitchen, 1.2, 0.9), 1.2, 0.9, { variant: 'dark' });
    for (let k = 0; k < 1 + Math.floor(rng() * 2); k++)
      loose('rat', ...anywhere(storage, 0.5, 0.3), 0.5, 0.25, { angle: rng() * 6 });
  }
  if (rich) {
    // Potted plants in the corners that are free.
    for (const [x, y] of [
      [right - 1, commonY],
      [left, bottom - 1],
      [right - 1, bottom - 1],
    ]) {
      if (isFree(x, y)) solid('plant', x, y);
    }
  }

  const tavern: Tavern = {
    seed,
    size,
    quality,
    name: tavernName(build),
    w,
    h,
    rooms,
    doors,
    entrance,
    windows,
    furniture,
    blocked,
  };
  return build() < 0.5 ? mirrored(tavern) : tavern;
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
  /** East and west swap; so do the corners a cobweb can sit in. */
  const flipSide = (side: string | undefined) =>
    side?.replace(/[ew]/, (letter) => (letter === 'e' ? 'w' : 'e')) as Furniture['facing'];
  return {
    ...tavern,
    rooms: tavern.rooms.map(flipBox),
    doors: tavern.doors.map((door) => (door === tavern.entrance ? entrance : flipOpening(door))),
    entrance,
    windows: tavern.windows.map(flipOpening),
    furniture: tavern.furniture.map((piece) => ({
      ...flipBox(piece),
      facing: flipSide(piece.facing),
      variant: piece.kind === 'cobweb' ? flipSide(piece.variant) : piece.variant,
      angle: piece.angle === undefined ? undefined : -piece.angle,
    })),
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
