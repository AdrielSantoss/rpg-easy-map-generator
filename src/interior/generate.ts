import { seededRng } from '../generator/rng.ts';
import { fantasyName } from '../structures/names.ts';
import {
  generateTavern,
  walkable,
  type Furniture,
  type LOOSE_KINDS,
  type Opening,
  type Room,
  type RoomKind,
  SOLID_KINDS,
  type Tavern,
  type TavernQuality,
  type TavernSize,
} from '../tavern/generate.ts';

/**
 * Interiors of buildings on the 5-foot battle grid. The tavern has a generator
 * of its own; the others share the one here, which lays out a main room at the
 * front, a row of rooms behind it and, in the larger sizes, a wing to one side,
 * and then furnishes every room for what it is. They all come out in the shape
 * of a `Tavern`, so one renderer paints them all.
 */

export const INTERIOR_KINDS = ['tavern', 'smithy', 'house', 'castle', 'tower', 'temple'] as const;
export type InteriorKind = (typeof INTERIOR_KINDS)[number];

/** Ground left around the building, in squares. */
const MARGIN = 1;

interface Spec {
  /** Interior size of the building, in squares. */
  w: number;
  h: number;
  main: RoomKind;
  /** Depth of the row of rooms behind the main one, and what they are, left to right. */
  back: number;
  backRooms: readonly RoomKind[];
  /** Width of the wing beside the main room, and its rooms, top to bottom. */
  wing: number;
  wingRooms: readonly RoomKind[];
  /** Width of the front door. */
  door: 1 | 2;
}

const spec = (
  w: number,
  h: number,
  main: RoomKind,
  door: 1 | 2,
  back = 0,
  backRooms: readonly RoomKind[] = [],
  wing = 0,
  wingRooms: readonly RoomKind[] = [],
): Spec => ({ w, h, main, door, back, backRooms, wing, wingRooms });

const SPECS: Record<Exclude<InteriorKind, 'tavern'>, Record<TavernSize, Spec>> = {
  house: {
    small: spec(8, 7, 'living', 1, 3, ['guest', 'kitchen']),
    medium: spec(12, 9, 'living', 1, 4, ['kitchen', 'guest'], 4, ['guest', 'storage']),
    large: spec(17, 11, 'living', 2, 4, ['kitchen', 'study', 'storage'], 5, ['guest', 'guest', 'guest']),
  },
  smithy: {
    small: spec(10, 8, 'forge', 2, 3, ['storage', 'guest']),
    medium: spec(14, 10, 'forge', 2, 4, ['storage', 'guest']),
    large: spec(19, 12, 'forge', 2, 4, ['storage', 'kitchen'], 5, ['armory', 'guest']),
  },
  castle: {
    small: spec(16, 13, 'hall', 2, 4, ['armory', 'guest']),
    medium: spec(22, 15, 'hall', 2, 4, ['armory', 'kitchen', 'storage'], 6, ['guest', 'study']),
    large: spec(28, 18, 'hall', 2, 5, ['armory', 'kitchen', 'storage'], 7, ['guest', 'guest', 'study']),
  },
  tower: {
    small: spec(8, 8, 'study', 1),
    medium: spec(10, 10, 'study', 1, 3, ['guest', 'storage']),
    large: spec(13, 12, 'study', 1, 4, ['guest', 'storage']),
  },
  temple: {
    small: spec(9, 11, 'sanctuary', 2, 3, ['study']),
    medium: spec(13, 15, 'sanctuary', 2, 4, ['study', 'storage']),
    large: spec(17, 19, 'sanctuary', 2, 4, ['study', 'guest', 'storage']),
  },
};

const DEITIES = ['Solara', 'Morwen', 'Aldur', 'Ithriel', 'Karveth', 'Nimue', 'Brannor'];
const SMITHS = ['do Martelo', 'Bigorna Rubra', 'Ferro e Fogo', 'do Velho Anão', 'da Fornalha'];

type Side = 'n' | 's' | 'e' | 'w';
type Box = { x: number; y: number; w: number; h: number };

function build(
  kind: Exclude<InteriorKind, 'tavern'>,
  seed: string,
  size: TavernSize,
  quality: TavernQuality,
  givenName: string | undefined,
): Tavern {
  // One stream for the building, another for what is in it, so quality leaves the plan alone.
  const plan = seededRng(`${seed}:${kind}:${size}`);
  const rng = seededRng(`${seed}:${kind}:furnish:${size}:${quality}`);
  const s = SPECS[kind][size];
  const w = s.w + 2 * MARGIN;
  const h = s.h + 2 * MARGIN;
  const blocked = new Uint8Array(w * h);
  /** Squares furniture must stay off: in front of doors, along the aisles. */
  const keepClear = new Uint8Array(w * h);
  /** Squares whose wall already has a shelf or a rack on it. */
  const hung = new Uint8Array(w * h);
  const furniture: Furniture[] = [];
  const doors: Opening[] = [];
  const windows: Opening[] = [];
  const poor = quality === 'poor';
  const rich = quality === 'rich';
  const fine = poor ? 'plain' : rich ? 'fine' : 'plain';

  const invented = {
    house: () => 'Casa',
    smithy: () => `Ferraria ${SMITHS[Math.floor(plan() * SMITHS.length)]}`,
    castle: () => `Castelo ${fantasyName(plan)}`,
    tower: () => `Torre de ${fantasyName(plan)}`,
    temple: () => `Templo de ${DEITIES[Math.floor(plan() * DEITIES.length)]}`,
  }[kind]();

  const chance = (p: number) => rng() < p;
  const pick = <T>(list: readonly T[]): T => list[Math.floor(rng() * list.length)];
  const mark = (grid: Uint8Array, x: number, y: number, bw = 1, bh = 1) => {
    for (let cy = y; cy < y + bh; cy++) {
      for (let cx = x; cx < x + bw; cx++) if (cx >= 0 && cy >= 0 && cx < w && cy < h) grid[cy * w + cx] = 1;
    }
  };
  const within = (room: Room, x: number, y: number, bw = 1, bh = 1) =>
    x >= room.x && y >= room.y && x + bw <= room.x + room.w && y + bh <= room.y + room.h;
  const isFree = (x: number, y: number, bw = 1, bh = 1) => {
    for (let cy = y; cy < y + bh; cy++) {
      for (let cx = x; cx < x + bw; cx++) if (blocked[cy * w + cx] || keepClear[cy * w + cx]) return false;
    }
    return true;
  };
  type Extra = Pick<Furniture, 'facing' | 'variant' | 'angle'>;
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

  /** Stands a piece against a wall of the room, wherever along it there is room. */
  const against = (
    room: Room,
    side: Side,
    kind: (typeof SOLID_KINDS)[number],
    bw = 1,
    bh = 1,
    extra: Extra = {},
  ): Box | null => {
    const along = side === 'n' || side === 's' ? room.w - bw : room.h - bh;
    if (along < 0) return null;
    const start = Math.floor(rng() * (along + 1));
    for (let k = 0; k <= along; k++) {
      const at = (start + k) % (along + 1);
      const x = side === 'w' ? room.x : side === 'e' ? room.x + room.w - bw : room.x + at;
      const y = side === 'n' ? room.y : side === 's' ? room.y + room.h - bh : room.y + at;
      if (!within(room, x, y, bw, bh) || !isFree(x, y, bw, bh)) continue;
      solid(kind, x, y, bw, bh, extra);
      return { x, y, w: bw, h: bh };
    }
    return null;
  };
  /** Stands a piece against whichever wall has room, trying them in a random order. */
  const somewhere = (
    room: Room,
    kind: (typeof SOLID_KINDS)[number],
    bw = 1,
    bh = 1,
    extra: Extra = {},
    sides: readonly Side[] = ['n', 'e', 'w'],
  ): Box | null => {
    const order = [...sides].sort(() => rng() - 0.5);
    for (const side of order) {
      const placed = against(room, side, kind, bw, bh, extra);
      if (placed) return placed;
    }
    return null;
  };
  /** Hangs shelves or racks along a wall, on every square of it that is clear. */
  const hang = (
    room: Room,
    side: Side,
    kind: 'shelf' | 'pantry' | 'weapon-rack',
    variant: () => string | undefined,
    share = 1,
  ) => {
    const across = side === 'n' || side === 's';
    const length = across ? room.w : room.h;
    for (let k = 0; k < length; k++) {
      const x = side === 'w' ? room.x : side === 'e' ? room.x + room.w - 1 : room.x + k;
      const y = side === 'n' ? room.y : side === 's' ? room.y + room.h - 1 : room.y + k;
      const index = y * w + x;
      if (blocked[index] || keepClear[index] || hung[index] || !chance(share)) continue;
      hung[index] = 1;
      const depth = 0.3;
      if (across) {
        loose(kind, x + 0.05, side === 'n' ? y + 0.06 : y + 1 - depth - 0.06, 0.9, depth, {
          variant: variant(),
        });
      } else {
        loose(kind, side === 'w' ? x + 0.06 : x + 1 - depth - 0.06, y + 0.05, depth, 0.9, {
          variant: variant(),
        });
      }
    }
  };
  /** A table with seats, on a clear block of three squares by three. */
  const tableAt = (x: number, y: number, long: boolean) => {
    mark(keepClear, x, y, 3, 3);
    const seat = rich ? 'cushion' : 'plain';
    if (long) {
      loose('table-long', x + 0.15, y + 1.05, 2.7, 0.9, { variant: quality });
      mark(blocked, x, y + 1, 3, 1);
      for (const benchY of [y + 0.5, y + 2.14]) {
        if (rich)
          for (const dx of [0.4, 1.28, 2.16])
            loose('chair', x + dx, benchY - 0.04, 0.44, 0.44, { variant: seat });
        else loose('bench', x + 0.3, benchY, 2.4, 0.36, { variant: 'plain' });
      }
    } else {
      loose('table-round', x + 0.85, y + 0.85, 1.3, 1.3, { variant: quality });
      mark(blocked, x + 1, y + 1);
      for (const [dx, dy] of [
        [1.28, 0.3],
        [1.28, 2.26],
        [0.3, 1.28],
        [2.26, 1.28],
      ]) {
        if (!poor || chance(0.7)) loose('chair', x + dx, y + dy, 0.44, 0.44, { variant: seat });
      }
    }
  };
  /** A table with seats wherever in the room a block is clear, nearest the middle first. */
  const table = (room: Room, long: boolean): boolean => {
    const spots: [number, number][] = [];
    for (let y = room.y; y + 3 <= room.y + room.h; y++) {
      for (let x = room.x; x + 3 <= room.x + room.w; x++) if (isFree(x, y, 3, 3)) spots.push([x, y]);
    }
    if (spots.length === 0) return false;
    const cx = room.x + room.w / 2 - 1.5;
    const cy = room.y + room.h / 2 - 1.5;
    spots.sort((a, b) => Math.hypot(a[0] - cx, a[1] - cy) - Math.hypot(b[0] - cx, b[1] - cy));
    tableAt(...spots[0], long);
    return true;
  };
  /** What tells a poor house from a rich one, whatever the room. */
  const finish = (room: Room) => {
    if (poor) {
      loose('cobweb', room.x, room.y, 1, 1, { variant: 'nw' });
      if (chance(0.6)) {
        loose('stain', room.x + 1 + rng() * (room.w - 2.5), room.y + 1 + rng() * (room.h - 2.5), 0.9, 0.7, {
          variant: 'dark',
        });
      }
    } else if (rich) {
      for (const [x, y] of [
        [room.x, room.y + room.h - 1],
        [room.x + room.w - 1, room.y],
      ]) {
        if (isFree(x, y) && chance(0.6)) solid('plant', x, y);
      }
    }
  };

  // Rooms: the main one in front, a row behind it, a wing down the right side.
  const left = MARGIN;
  const top = MARGIN;
  const mainW = s.w - s.wing;
  const mainY = top + s.back;
  const mainH = s.h - s.back;
  const bottom = mainY + mainH;
  const right = left + mainW;
  const main: Room = { kind: s.main, x: left, y: mainY, w: mainW, h: mainH };
  const share = (total: number, parts: number) =>
    Array.from({ length: parts }, (_, k) => Math.floor(total / parts) + (k < total % parts ? 1 : 0));
  const backRooms: Room[] = [];
  let at = left;
  for (const [k, width] of share(mainW, s.backRooms.length).entries()) {
    backRooms.push({ kind: s.backRooms[k], x: at, y: top, w: width, h: s.back });
    at += width;
  }
  const wingRooms: Room[] = [];
  at = top;
  for (const [k, depth] of share(s.h, s.wingRooms.length).entries()) {
    wingRooms.push({ kind: s.wingRooms[k], x: right, y: at, w: s.wing, h: depth });
    at += depth;
  }
  const rooms = [main, ...backRooms, ...wingRooms];

  // The front door, near the middle of the front wall; nothing stands in the aisle along that wall.
  const entranceX = left + Math.floor((mainW - s.door) / 2) + (mainW > 6 ? Math.floor(plan() * 3) - 1 : 0);
  const entrance: Opening = { x: entranceX, y: bottom, dir: 'h', length: s.door };
  doors.push(entrance);
  mark(keepClear, left, bottom - 1, mainW, 1);
  for (const room of backRooms) {
    const x = room.x + 1 + Math.floor(plan() * Math.max(1, room.w - 2));
    doors.push({ x, y: mainY, dir: 'h', length: 1 });
    mark(keepClear, x, mainY - 1, 1, 2);
  }
  for (const room of wingRooms) {
    const y = room.y + Math.min(room.h - 1, Math.max(1, Math.floor(room.h / 2)));
    doors.push({ x: right, y, dir: 'v', length: 1 });
    mark(keepClear, right - 1, y, 2, 1);
  }

  // Windows on the outer walls.
  for (let y = mainY + 1; y < bottom - 1; y += 4) windows.push({ x: left, y, dir: 'v', length: 1 });
  if (s.wing === 0)
    for (let y = mainY + 2; y < bottom - 1; y += 4) windows.push({ x: right, y, dir: 'v', length: 1 });
  for (const x of [left + 1, right - 2]) {
    if (x + 1 < entranceX - 1 || x > entranceX + s.door) windows.push({ x, y: bottom, dir: 'h', length: 1 });
  }
  for (const room of backRooms) {
    windows.push({ x: room.x + Math.floor(room.w / 2), y: top, dir: 'h', length: 1 });
  }
  for (const room of wingRooms) {
    windows.push({ x: right + s.wing, y: room.y + Math.floor(room.h / 2), dir: 'v', length: 1 });
  }

  /** A carpet from the front door up the middle of the main room, kept clear as an aisle. */
  const aisle = (upTo: number) => {
    mark(keepClear, entranceX, upTo, s.door, bottom - upTo);
    if (!poor) {
      loose('rug', entranceX + 0.1, upTo + 0.1, s.door - 0.2, bottom - upTo - 0.5, {
        variant: rich ? 'fine' : 'plain',
      });
    }
  };

  const furnish: Record<RoomKind, (room: Room) => void> = {
    // The tavern's own room; nothing else has one.
    common: () => {},

    living: (room) => {
      const hearthY = room.y + Math.max(1, Math.floor(room.h / 2) - 1);
      if (isFree(room.x, hearthY, 1, 2)) {
        solid('fireplace', room.x, hearthY, 1, 2, { facing: 'e' });
        mark(keepClear, room.x + 1, hearthY, 1, 2);
        if (!poor && room.w >= 7) {
          loose('rug', room.x + 1.05, hearthY - 0.4, 2.5, 2.8, { variant: 'hearth' });
          loose('armchair', room.x + 2.3, hearthY + 0.55, 0.9, 0.9, { facing: 'w' });
          mark(keepClear, room.x + 2, hearthY, 2, 2);
        }
        if (isFree(room.x, hearthY + 2)) solid('logs', room.x, hearthY + 2);
      }
      table(room, room.w >= 9 && chance(0.6));
      somewhere(room, 'chest', 1, 1, { variant: fine });
      if (!poor) somewhere(room, 'wardrobe', 2, 1, { variant: fine }, ['n']);
      hang(
        room,
        'n',
        'shelf',
        () =>
          rich
            ? pick(['books', 'fine', 'plates'])
            : poor
              ? pick(['few', 'empty'])
              : pick(['mugs', 'jugs', 'books']),
        0.5,
      );
    },

    kitchen: (room) => {
      against(room, 'n', 'stove', 2, 1);
      somewhere(
        room,
        'counter',
        2,
        1,
        { variant: poor ? 'rough' : pick(['bread', 'meat', 'vegetables', 'pie']) },
        ['n'],
      );
      somewhere(room, 'washtub');
      somewhere(room, pick(['barrel', 'sacks']));
      if (!poor) somewhere(room, 'cauldron');
      hang(room, 'n', 'pantry', () => quality);
    },

    storage: (room) => {
      for (const side of ['n', 'e', 'w'] as const) {
        const tries = Math.ceil((side === 'n' ? room.w : room.h) * (poor ? 0.35 : 0.6));
        for (let k = 0; k < tries; k++) against(room, side, pick(['barrel', 'crate', 'crate', 'sacks']));
      }
    },

    guest: (room) => {
      if (poor) {
        somewhere(room, 'bed', 1, 2, { variant: 'straw' }, ['e', 'w']);
        if (chance(0.5)) somewhere(room, 'crate');
        loose('bucket', room.x + 0.25, room.y + room.h - 0.75, 0.45, 0.45);
        return;
      }
      const double = room.w >= 4 && room.h >= 4 && (rich || chance(0.5));
      const bed = double
        ? somewhere(room, 'bed-double', 2, 2, { variant: fine }, ['n'])
        : somewhere(room, 'bed', 1, 2, { variant: fine }, ['e', 'w']);
      if (bed && isFree(bed.x - 1, bed.y) && within(room, bed.x - 1, bed.y)) {
        solid('nightstand', bed.x - 1, bed.y, 1, 1, { variant: fine });
      }
      somewhere(room, 'chest', 1, 1, { variant: fine });
      if (room.w >= 4) somewhere(room, 'wardrobe', 2, 1, { variant: fine }, ['n']);
      if (rich && room.w >= 4 && room.h >= 4) {
        loose('rug', room.x + 0.6, room.y + room.h - 1.9, room.w - 1.2, 0.84, { variant: 'room' });
      }
    },

    forge: (room) => {
      // The hearth in a back corner, and around it what the smith reaches for.
      const corner = { x: room.x + room.w - 2, y: room.y, w: 2, h: 2 };
      const hearth = isFree(corner.x, corner.y, 2, 2)
        ? (solid('forge', corner.x, corner.y, 2, 2), corner)
        : against(room, 'n', 'forge', 2, 2);
      if (hearth) {
        mark(keepClear, hearth.x, hearth.y + 2, 2, 1);
        // The anvil a step from the fire, the quenching tub beside it.
        for (const [dx, dy] of [
          [-2, 2],
          [0, 3],
          [3, 2],
        ]) {
          if (within(room, hearth.x + dx, hearth.y + dy) && isFree(hearth.x + dx, hearth.y + dy)) {
            solid('anvil', hearth.x + dx, hearth.y + dy);
            break;
          }
        }
        for (const dx of [-1, 2]) {
          if (within(room, hearth.x + dx, hearth.y) && isFree(hearth.x + dx, hearth.y)) {
            solid('washtub', hearth.x + dx, hearth.y);
            break;
          }
        }
      }
      against(room, 'n', 'workbench', Math.min(3, room.w - 4), 1);
      // The counter the customers are served at, across the room from the door.
      const counter = Math.min(4, room.w - 5);
      if (counter >= 2 && room.h >= 6 && isFree(room.x + 1, room.y + room.h - 3, counter, 1)) {
        solid('workbench', room.x + 1, room.y + room.h - 3, counter, 1);
      }
      somewhere(room, 'barrel', 1, 1, {}, ['w']);
      somewhere(room, 'crate', 1, 1, {}, ['w']);
      if (!poor) somewhere(room, 'chest', 1, 1, { variant: fine }, ['w']);
      hang(room, 'w', 'weapon-rack', () => undefined, poor ? 0.4 : 0.8);
      hang(room, 'n', 'weapon-rack', () => undefined, poor ? 0.3 : 0.6);
    },

    hall: (room) => {
      // The throne on its dais at the head of the hall, the carpet leading up to it.
      const throneX = entranceX;
      aisle(room.y + 2);
      mark(keepClear, throneX - 1, room.y, s.door + 2, 3);
      loose('stage', throneX - 1, room.y + 0.2, s.door + 2, 1.8);
      solid('throne', throneX, room.y + 1, 1, 1, { facing: 's' });
      if (s.door === 2 && rich) solid('throne', throneX + 1, room.y + 1, 1, 1, { facing: 's' });
      for (const x of [room.x, room.x + room.w - 1]) if (isFree(x, room.y)) solid('statue', x, room.y);
      // Two rows of pillars down the hall.
      for (const x of [throneX - 3, throneX + s.door + 2]) {
        for (let y = room.y + 3; y < bottom - 2; y += 3) {
          if (within(room, x, y) && isFree(x, y)) solid('pillar', x, y);
        }
      }
      const hearthY = room.y + Math.floor(room.h / 2);
      if (isFree(room.x, hearthY, 1, 2)) {
        solid('fireplace', room.x, hearthY, 1, 2, { facing: 'e' });
        mark(keepClear, room.x + 1, hearthY, 1, 2);
      }
      // Feasting tables either side, as many as fit.
      for (let k = 0; k < (size === 'small' ? 2 : 4); k++) table(room, true);
      hang(room, 'n', 'weapon-rack', () => undefined, 0.35);
    },

    armory: (room) => {
      against(room, 'n', 'workbench', Math.min(2, room.w - 2), 1);
      for (let k = 0; k < Math.ceil(room.w / 3); k++)
        somewhere(room, pick(['chest', 'crate', 'barrel']), 1, 1, { variant: fine });
      for (const side of ['n', 'w', 'e'] as const)
        hang(room, side, 'weapon-rack', () => undefined, poor ? 0.5 : 0.9);
    },

    study: (room) => {
      const large = room === main;
      const desk = against(room, large ? 'w' : 'n', 'desk', 1, 1, { variant: fine });
      if (desk) {
        const [dx, dy] = large ? [1.28, 0.28] : [0.28, 1.1];
        loose('chair', desk.x + dx, desk.y + dy, 0.44, 0.44, { variant: rich ? 'cushion' : 'plain' });
        mark(keepClear, desk.x + (large ? 1 : 0), desk.y + (large ? 0 : 1));
      }
      if (large) {
        // A wizard's workroom: the brew in the middle, the stairs up in a corner.
        if (room.w >= 8 && room.h >= 6) {
          loose('stairs', room.x + room.w - 2, room.y + (s.back ? 0 : 1), 2, 3, { facing: 'n' });
          mark(keepClear, room.x + room.w - 2, room.y, 2, 5);
        }
        const cx = room.x + Math.floor(room.w / 2) - 1;
        const cy = room.y + Math.floor(room.h / 2) - 1;
        if (isFree(cx, cy)) {
          if (!poor) loose('rug', cx - 0.9, cy - 0.9, 2.8, 2.8, { variant: 'hearth' });
          solid('cauldron', cx, cy);
          mark(keepClear, cx - 1, cy - 1, 3, 3);
        }
        table(room, false);
        somewhere(room, 'chest', 1, 1, { variant: fine }, ['w', 'e']);
        somewhere(room, 'barrel', 1, 1, {}, ['w', 'e']);
        if (!poor) loose('armchair', room.x + 1.1, room.y + room.h - 2.4, 0.9, 0.9, { facing: 'e' });
      } else {
        somewhere(room, 'chest', 1, 1, { variant: fine });
        if (!poor && room.w >= 4)
          loose('armchair', room.x + room.w - 1.95, room.y + room.h - 1.95, 0.9, 0.9, { facing: 'w' });
      }
      hang(room, 'n', 'shelf', () => (poor && chance(0.4) ? 'few' : 'books'), poor ? 0.6 : 1);
    },

    sanctuary: (room) => {
      // The altar at the head of the nave, pews either side of the aisle.
      aisle(room.y + 3);
      const altarX = entranceX + (s.door === 2 ? 0 : -1);
      mark(keepClear, altarX - 1, room.y, 4, 3);
      if (!poor) loose('stage', altarX - 1, room.y + 0.2, 4, 1.9);
      solid('altar', altarX, room.y + 1, 2, 1);
      for (const x of [altarX - 2, altarX + 3])
        if (within(room, x, room.y) && isFree(x, room.y)) solid('statue', x, room.y);
      for (let y = room.y + 4; y < bottom - 2; y += 2) {
        for (const [from, to] of [
          [room.x + 1, entranceX - 1],
          [entranceX + s.door + 1, room.x + room.w - 1],
        ]) {
          const length = to - from;
          if (length >= 2) loose('bench', from + 0.1, y + 0.32, length - 0.2, 0.36, { variant: 'plain' });
        }
      }
      if (room.w >= 12) {
        for (const x of [room.x, room.x + room.w - 1]) {
          for (let y = room.y + 3; y < bottom - 2; y += 3) if (isFree(x, y)) solid('pillar', x, y);
        }
      }
    },
  };
  for (const room of rooms) {
    furnish[room.kind](room);
    finish(room);
  }

  const interior: Tavern = {
    seed,
    size,
    quality,
    name: givenName?.trim() || invented,
    w,
    h,
    rooms,
    doors,
    entrance,
    windows,
    furniture,
    blocked,
  };

  // Nothing may wall a room in: while some room cannot be walked into, the
  // piece that was stood in it last is taken out again.
  for (let guard = 0; guard < 200; guard++) {
    const reached = walkable(interior);
    const shut = rooms.find((room) => {
      let open = 0;
      let walked = 0;
      for (let y = room.y; y < room.y + room.h; y++) {
        for (let x = room.x; x < room.x + room.w; x++) {
          if (blocked[y * w + x]) continue;
          open += 1;
          walked += reached[y * w + x];
        }
      }
      return walked < open;
    });
    if (!shut) break;
    let removed = false;
    for (let k = furniture.length - 1; k >= 0 && !removed; k--) {
      const piece = furniture[k];
      // Only what stands on whole squares closes a way; a rug or a cobweb never does.
      const stands = (SOLID_KINDS as readonly string[]).includes(piece.kind);
      if (!stands || !within(shut, piece.x, piece.y, piece.w, piece.h)) continue;
      for (let y = piece.y; y < piece.y + piece.h; y++)
        for (let x = piece.x; x < piece.x + piece.w; x++) blocked[y * w + x] = 0;
      furniture.splice(k, 1);
      removed = true;
    }
    if (!removed) break;
  }
  return interior;
}

/**
 * The interior of a building of the given kind. The same kind, seed, size and
 * quality always give the same interior, and quality never moves a wall: a seed
 * is the same building, poorer or richer. A name may be given, as when the
 * building is one of a town's; otherwise one is invented.
 */
export function generateInterior(
  kind: InteriorKind,
  seed: string,
  size: TavernSize,
  quality: TavernQuality = 'medium',
  name?: string,
): Tavern {
  if (kind !== 'tavern') return build(kind, seed, size, quality, name);
  const tavern = generateTavern(seed, size, quality);
  return name?.trim() ? { ...tavern, name: name.trim() } : tavern;
}
