import { describe, expect, it } from 'vitest';
import { seededRng } from '../generator/rng.ts';
import { generateTavern, roomMap, TAVERN_SIZES, walkable, type Tavern } from './generate.ts';
import { tavernName } from './names.ts';

const SEEDS = ['aldoria', 'javali', 'caneca', 'x', '42', 'outra', 'taverna', 'seed-8'];
/** Every size with every seed: the layout has to hold for all of them. */
const all = (): Tavern[] => TAVERN_SIZES.flatMap((size) => SEEDS.map((seed) => generateTavern(seed, size)));

const roomsOf = (tavern: Tavern, kind: string) => tavern.rooms.filter((room) => room.kind === kind);
/** Pieces that fill their squares: nothing else may share those, and nobody walks through. */
const SOLID = ['bar', 'fireplace', 'stove', 'counter', 'washtub', 'barrel', 'crate', 'bed', 'chest'];

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
      const stairs = tavern.furniture.filter((piece) => piece.kind === 'stairs').length;
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
      expect(inCommon('table-round').length + inCommon('table-long').length).toBeGreaterThan(0);
    }
  });

  it('gives every guest room a bed', () => {
    for (const tavern of all()) {
      for (const guest of roomsOf(tavern, 'guest')) {
        const beds = tavern.furniture.filter(
          (p) =>
            p.kind === 'bed' &&
            p.x >= guest.x &&
            p.x < guest.x + guest.w &&
            p.y >= guest.y &&
            p.y < guest.y + guest.h,
        );
        expect(beds).toHaveLength(1);
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
        if (!SOLID.includes(piece.kind)) continue;
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
