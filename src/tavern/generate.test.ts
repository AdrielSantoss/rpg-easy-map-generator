import { describe, expect, it } from 'vitest';
import { seededRng } from '../generator/rng.ts';
import {
  generateTavern,
  LOOSE_KINDS,
  roomMap,
  SOLID_KINDS,
  TAVERN_QUALITIES,
  TAVERN_SIZES,
  walkable,
  type Furniture,
  type Room,
  type Tavern,
  type TavernQuality,
} from './generate.ts';
import { tavernName } from './names.ts';

const SEEDS = ['aldoria', 'javali', 'caneca', 'x', '42', 'outra', 'taverna', 'seed-8'];
/** Every size and quality with every seed: the layout has to hold for all of them. */
const all = (): Tavern[] =>
  TAVERN_SIZES.flatMap((size) =>
    TAVERN_QUALITIES.flatMap((quality) => SEEDS.map((seed) => generateTavern(seed, size, quality))),
  );
/** One quality, in the sizes that have guest rooms. */
const withGuests = (quality: TavernQuality): Tavern[] =>
  (['medium', 'large'] as const).flatMap((size) => SEEDS.map((seed) => generateTavern(seed, size, quality)));
const count = (tavern: Tavern, ...kinds: Furniture['kind'][]) =>
  tavern.furniture.filter((piece) => kinds.includes(piece.kind)).length;
const inside = (room: Room, piece: Furniture) =>
  piece.x >= room.x && piece.x < room.x + room.w && piece.y >= room.y && piece.y < room.y + room.h;

const roomsOf = (tavern: Tavern, kind: string) => tavern.rooms.filter((room) => room.kind === kind);

describe('generateTavern', () => {
  it('gives the same tavern for the same seed and size', () => {
    expect(generateTavern('aldoria', 'medium')).toEqual(generateTavern('aldoria', 'medium'));
  });

  it('gives different taverns for different seeds', () => {
    const layouts = new Set(SEEDS.map((seed) => JSON.stringify(generateTavern(seed, 'large').furniture)));
    expect(layouts.size).toBeGreaterThan(SEEDS.length / 2);
  });

  it('gets bigger with the size chosen', () => {
    const area = (size: (typeof TAVERN_SIZES)[number]) => {
      const tavern = generateTavern('aldoria', size);
      return tavern.w * tavern.h;
    };
    expect(area('medium')).toBeGreaterThan(area('small'));
    expect(area('large')).toBeGreaterThan(area('medium'));
  });

  it('always has a common room, a kitchen and a storeroom', () => {
    for (const tavern of all()) {
      expect(roomsOf(tavern, 'common')).toHaveLength(1);
      expect(roomsOf(tavern, 'kitchen')).toHaveLength(1);
      expect(roomsOf(tavern, 'storage')).toHaveLength(1);
    }
  });

  it('has guest rooms and stairs only in the larger sizes', () => {
    for (const tavern of all()) {
      const guests = roomsOf(tavern, 'guest').length;
      const stairs = count(tavern, 'stairs');
      if (tavern.size === 'small') expect([guests, stairs]).toEqual([0, 0]);
      else {
        expect(guests).toBeGreaterThanOrEqual(2);
        expect(stairs).toBe(1);
      }
      expect(tavern.furniture.some((piece) => piece.kind === 'stage')).toBe(tavern.size === 'large');
    }
  });

  it('fills the building with rooms that do not overlap, leaving ground all around', () => {
    for (const tavern of all()) {
      const { w, h } = tavern;
      const covered = new Uint8Array(w * h);
      for (const room of tavern.rooms) {
        for (let y = room.y; y < room.y + room.h; y++) {
          for (let x = room.x; x < room.x + room.w; x++) covered[y * w + x]++;
        }
      }
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const onEdge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
          expect(covered[y * w + x]).toBe(onEdge ? 0 : 1);
        }
      }
    }
  });

  it('puts the front door on the outer wall of the common room', () => {
    for (const tavern of all()) {
      const { entrance } = tavern;
      const common = roomsOf(tavern, 'common')[0];
      expect(tavern.doors).toContain(entrance);
      expect(entrance.dir).toBe('h');
      expect(entrance.y).toBe(common.y + common.h);
      expect(entrance.x).toBeGreaterThanOrEqual(common.x);
      expect(entrance.x + entrance.length).toBeLessThanOrEqual(common.x + common.w);
    }
  });

  it('puts every door on a wall between two rooms or between a room and the outside', () => {
    for (const tavern of all()) {
      const rooms = roomMap(tavern);
      for (const door of tavern.doors) {
        for (let k = 0; k < door.length; k++) {
          const x = door.dir === 'h' ? door.x + k : door.x;
          const y = door.dir === 'h' ? door.y : door.y + k;
          const before = door.dir === 'h' ? rooms[(y - 1) * tavern.w + x] : rooms[y * tavern.w + x - 1];
          expect(before).not.toBe(rooms[y * tavern.w + x]);
        }
      }
    }
  });

  it('lets a miniature walk from the front door into every room', () => {
    for (const tavern of all()) {
      const reached = walkable(tavern);
      const rooms = roomMap(tavern);
      const entered = new Set<number>();
      reached.forEach((yes, i) => {
        if (yes && rooms[i] >= 0) entered.add(rooms[i]);
      });
      expect(entered.size).toBe(tavern.rooms.length);
    }
  });

  it('keeps both sides of every door clear to walk through', () => {
    for (const tavern of all()) {
      const reached = walkable(tavern);
      for (const door of tavern.doors) {
        for (let k = 0; k < door.length; k++) {
          const x = door.dir === 'h' ? door.x + k : door.x;
          const y = door.dir === 'h' ? door.y : door.y + k;
          const other = door.dir === 'h' ? (y - 1) * tavern.w + x : y * tavern.w + x - 1;
          expect(reached[y * tavern.w + x]).toBe(1);
          expect(reached[other]).toBe(1);
        }
      }
    }
  });

  it('leaves most of the common room floor free to move on', () => {
    for (const tavern of all()) {
      const reached = walkable(tavern);
      const common = roomsOf(tavern, 'common')[0];
      let free = 0;
      for (let y = common.y; y < common.y + common.h; y++) {
        for (let x = common.x; x < common.x + common.w; x++) free += reached[y * tavern.w + x];
      }
      expect(free / (common.w * common.h)).toBeGreaterThan(0.6);
    }
  });

  it('has a bar with stools, a fireplace and tables in the common room', () => {
    for (const tavern of all()) {
      const common = roomsOf(tavern, 'common')[0];
      const inCommon = (kind: string) =>
        tavern.furniture.filter(
          (p) =>
            p.kind === kind &&
            p.x >= common.x &&
            p.y >= common.y &&
            p.x + p.w <= common.x + common.w &&
            p.y + p.h <= common.y + common.h,
        );
      expect(inCommon('bar')).toHaveLength(1);
      expect(inCommon('fireplace')).toHaveLength(1);
      expect(inCommon('stool').length).toBeGreaterThan(1);
      // A poor house may seat everyone round upturned barrels instead of tables.
      const barrelTables = inCommon('barrel').filter((piece) => piece.variant === 'table');
      const tables = inCommon('table-round').length + inCommon('table-long').length + barrelTables.length;
      expect(tables).toBeGreaterThan(0);
    }
  });

  it('gives every guest room somewhere to sleep', () => {
    for (const tavern of all()) {
      for (const guest of roomsOf(tavern, 'guest')) {
        const beds = tavern.furniture.filter(
          (p) => (p.kind === 'bed' || p.kind === 'bed-double') && inside(guest, p),
        );
        expect(beds.length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('keeps every piece of furniture inside the building', () => {
    for (const tavern of all()) {
      for (const piece of tavern.furniture) {
        expect(piece.x).toBeGreaterThanOrEqual(1);
        expect(piece.y).toBeGreaterThanOrEqual(1);
        expect(piece.x + piece.w).toBeLessThanOrEqual(tavern.w - 1);
        expect(piece.y + piece.h).toBeLessThanOrEqual(tavern.h - 1);
      }
    }
  });

  it('never puts two solid pieces on the same square, and marks their squares as blocked', () => {
    for (const tavern of all()) {
      const taken = new Uint8Array(tavern.w * tavern.h);
      for (const piece of tavern.furniture) {
        if (!(SOLID_KINDS as readonly string[]).includes(piece.kind)) continue;
        for (let y = piece.y; y < piece.y + piece.h; y++) {
          for (let x = piece.x; x < piece.x + piece.w; x++) {
            expect(taken[y * tavern.w + x]).toBe(0);
            taken[y * tavern.w + x] = 1;
            expect(tavern.blocked[y * tavern.w + x]).toBe(1);
          }
        }
      }
    }
  });

  it('puts windows only on outer walls, never where a door is', () => {
    for (const tavern of all()) {
      const rooms = roomMap(tavern);
      expect(tavern.windows.length).toBeGreaterThan(2);
      for (const window of tavern.windows) {
        const here = rooms[window.y * tavern.w + window.x];
        const other =
          window.dir === 'h'
            ? rooms[(window.y - 1) * tavern.w + window.x]
            : rooms[window.y * tavern.w + window.x - 1];
        expect(here === -1 || other === -1).toBe(true);
        expect(here === -1 && other === -1).toBe(false);
        const onDoor = tavern.doors.some(
          (door) =>
            door.dir === window.dir &&
            (door.dir === 'h'
              ? door.y === window.y && window.x >= door.x && window.x < door.x + door.length
              : door.x === window.x && window.y >= door.y && window.y < door.y + door.length),
        );
        expect(onDoor).toBe(false);
      }
    }
  });

  it('is mirrored for some seeds, so the guest wing is not always on the same side', () => {
    const sides = new Set(
      SEEDS.map((seed) => {
        const tavern = generateTavern(seed, 'medium');
        return roomsOf(tavern, 'guest')[0].x > roomsOf(tavern, 'common')[0].x ? 'right' : 'left';
      }),
    );
    expect(sides.size).toBe(2);
  });
});

describe('tavern quality', () => {
  it('never changes the building: same rooms, doors and windows, poorer or richer', () => {
    for (const size of TAVERN_SIZES) {
      for (const seed of SEEDS) {
        const [poor, medium, rich] = TAVERN_QUALITIES.map((quality) => generateTavern(seed, size, quality));
        for (const other of [poor, rich]) {
          expect(other.rooms).toEqual(medium.rooms);
          expect(other.doors).toEqual(medium.doors);
          expect(other.windows).toEqual(medium.windows);
          expect(other.name).toBe(medium.name);
        }
      }
    }
  });

  it('is medium when not said', () => {
    expect(generateTavern('aldoria', 'large')).toEqual(generateTavern('aldoria', 'large', 'medium'));
  });

  it('furnishes each quality differently', () => {
    const kinds = (quality: TavernQuality) =>
      JSON.stringify(generateTavern('aldoria', 'large', quality).furniture);
    expect(new Set(TAVERN_QUALITIES.map(kinds)).size).toBe(3);
  });

  it('knows every kind of piece it places as either solid or loose', () => {
    const known: readonly string[] = [...SOLID_KINDS, ...LOOSE_KINDS];
    for (const tavern of all()) for (const piece of tavern.furniture) expect(known).toContain(piece.kind);
  });

  it('puts beer pumps on the bar, more of them in a rich house and none in a poor one', () => {
    for (const seed of SEEDS) {
      const taps = (quality: TavernQuality) => {
        const tavern = generateTavern(seed, 'large', quality);
        const bar = tavern.furniture.find((piece) => piece.kind === 'bar')!;
        const pumps = tavern.furniture.filter((piece) => piece.kind === 'tap');
        // Every pump stands on the bar.
        for (const pump of pumps) {
          expect(pump.x).toBeGreaterThanOrEqual(bar.x);
          expect(pump.x + pump.w).toBeLessThanOrEqual(bar.x + bar.w);
          expect(pump.y).toBeGreaterThanOrEqual(bar.y);
          expect(pump.y + pump.h).toBeLessThanOrEqual(bar.y + bar.h);
        }
        return pumps.length;
      };
      expect(taps('poor')).toBe(0);
      expect(taps('medium')).toBe(2);
      expect(taps('rich')).toBeGreaterThan(2);
    }
  });

  it('stocks the shelves behind the bar in more than one way', () => {
    for (const quality of TAVERN_QUALITIES) {
      const stock = new Set(
        SEEDS.flatMap((seed) =>
          generateTavern(seed, 'large', quality)
            .furniture.filter((piece) => piece.kind === 'shelf')
            .map((piece) => piece.variant),
        ),
      );
      expect(stock.size).toBeGreaterThanOrEqual(3);
    }
  });

  it('leaves a poor tavern dirty, broken and out of line', () => {
    for (const tavern of SEEDS.map((seed) => generateTavern(seed, 'large', 'poor'))) {
      expect(count(tavern, 'stain')).toBeGreaterThan(4);
      expect(count(tavern, 'straw')).toBeGreaterThan(2);
      expect(count(tavern, 'cobweb', 'bottle', 'debris', 'rat')).toBeGreaterThan(3);
      expect(tavern.furniture.some((piece) => piece.angle)).toBe(true);
      expect(count(tavern, 'plant', 'armchair', 'tap', 'rug')).toBe(0);
    }
  });

  it('keeps a rich tavern clean, tidy and well furnished', () => {
    for (const tavern of SEEDS.map((seed) => generateTavern(seed, 'large', 'rich'))) {
      expect(count(tavern, 'stain', 'straw', 'cobweb', 'bottle', 'debris', 'rat')).toBe(0);
      expect(tavern.furniture.some((piece) => piece.angle)).toBe(false);
      expect(count(tavern, 'armchair')).toBe(2);
      expect(count(tavern, 'plant')).toBeGreaterThan(0);
      expect(count(tavern, 'oven')).toBe(1);
      expect(count(tavern, 'bench')).toBe(0);
    }
  });

  it('gives a rich house double beds, with every guest room furnished the same', () => {
    for (const tavern of withGuests('rich')) {
      const layouts = roomsOf(tavern, 'guest').map((guest) =>
        tavern.furniture
          .filter((piece) => inside(guest, piece))
          // Positions measured from the room's own corner, on whichever side it was mirrored to.
          .map((piece) =>
            [
              piece.kind,
              Math.min(piece.x - guest.x, guest.x + guest.w - piece.x - piece.w).toFixed(1),
              (piece.y - guest.y).toFixed(1),
            ].join(':'),
          )
          .filter(
            (entry) =>
              !entry.startsWith('wardrobe') && !entry.startsWith('desk') && !entry.startsWith('chair'),
          )
          .sort(),
      );
      for (const layout of layouts) {
        expect(layout).toEqual(layouts[0]);
        expect(layout.some((entry) => entry.startsWith('bed-double'))).toBe(true);
      }
    }
  });

  it('gives an ordinary house a mix of single and double beds', () => {
    const beds = new Set(
      withGuests('medium').flatMap((tavern) => tavern.furniture.map((piece) => piece.kind)),
    );
    expect(beds.has('bed')).toBe(true);
    expect(beds.has('bed-double')).toBe(true);
    expect(beds.has('wardrobe')).toBe(true);
  });

  it('gives a poor house straw mattresses, sometimes two to a room', () => {
    const rooms = withGuests('poor').flatMap((tavern) =>
      roomsOf(tavern, 'guest').map((guest) =>
        tavern.furniture.filter((piece) => piece.kind === 'bed' && inside(guest, piece)),
      ),
    );
    for (const beds of rooms) for (const bed of beds) expect(bed.variant).toBe('straw');
    expect(rooms.some((beds) => beds.length === 2)).toBe(true);
    expect(rooms.some((beds) => beds.length === 1)).toBe(true);
  });

  it('cooks differently by quality: a cauldron, a stove, or a stove and an oven', () => {
    for (const seed of SEEDS) {
      const cooking = (quality: TavernQuality) => {
        const tavern = generateTavern(seed, 'medium', quality);
        return [count(tavern, 'cauldron'), count(tavern, 'stove'), count(tavern, 'oven')];
      };
      expect(cooking('poor')).toEqual([1, 0, 0]);
      expect(cooking('medium')).toEqual([0, 1, 0]);
      expect(cooking('rich')).toEqual([0, 1, 1]);
    }
  });

  it('varies what the kitchen counters are used for', () => {
    const work = new Set(
      SEEDS.flatMap((seed) =>
        generateTavern(seed, 'large', 'medium')
          .furniture.filter((piece) => piece.kind === 'counter')
          .map((piece) => piece.variant),
      ),
    );
    expect(work.size).toBeGreaterThanOrEqual(3);
  });
});

describe('tavernName', () => {
  it('makes a sign name with the article agreeing with the noun', () => {
    const rng = seededRng('names');
    for (let i = 0; i < 60; i++) {
      expect(tavernName(rng)).toMatch(
        /^(O \p{Lu}\p{L}+ \p{Lu}\p{L}+o|A \p{Lu}\p{L}+ \p{Lu}\p{L}+a|[OA] \p{Lu}\p{L}+ (Saltitante|Valente)|Taverna d[oa] \p{Lu}\p{L}+)$/u,
      );
    }
  });

  it('names each generated tavern', () => {
    expect(generateTavern('aldoria', 'small').name.length).toBeGreaterThan(5);
  });
});
