import { describe, expect, it } from 'vitest';
import { generateSite } from '../site/generate.ts';
import { SOLID_KINDS, TAVERN_QUALITIES, TAVERN_SIZES, walkable, type Tavern } from '../tavern/generate.ts';
import { buildingAt, interiorOf } from './from-site.ts';
import { generateInterior, INTERIOR_KINDS } from './generate.ts';

const SEEDS = ['a', 'b', 'c', 'd', 'e'];

/** Every interior of every kind, size and quality, for a handful of seeds. */
function* all(): Generator<Tavern> {
  for (const kind of INTERIOR_KINDS) {
    for (const size of TAVERN_SIZES) {
      for (const quality of TAVERN_QUALITIES) {
        for (const seed of SEEDS) yield generateInterior(kind, seed, size, quality);
      }
    }
  }
}

const kinds = (interior: Tavern) => new Set(interior.furniture.map((piece) => piece.kind));

describe('generateInterior', () => {
  it('gives the same interior for the same arguments', () => {
    for (const kind of INTERIOR_KINDS) {
      expect(generateInterior(kind, 'x', 'medium', 'rich')).toEqual(
        generateInterior(kind, 'x', 'medium', 'rich'),
      );
    }
  });

  it('gives different interiors for different seeds', () => {
    for (const kind of INTERIOR_KINDS) {
      expect(generateInterior(kind, 'x', 'large').furniture).not.toEqual(
        generateInterior(kind, 'y', 'large').furniture,
      );
    }
  });

  it('keeps the walls and doors whatever the quality', () => {
    for (const kind of INTERIOR_KINDS) {
      const poor = generateInterior(kind, 'x', 'large', 'poor');
      const rich = generateInterior(kind, 'x', 'large', 'rich');
      expect(rich.rooms).toEqual(poor.rooms);
      expect(rich.doors).toEqual(poor.doors);
      expect(rich.furniture).not.toEqual(poor.furniture);
    }
  });

  it('grows with the size', () => {
    for (const kind of INTERIOR_KINDS) {
      const area = (size: (typeof TAVERN_SIZES)[number]) => {
        const interior = generateInterior(kind, 'x', size);
        return interior.w * interior.h;
      };
      expect(area('medium')).toBeGreaterThan(area('small'));
      expect(area('large')).toBeGreaterThan(area('medium'));
    }
  });

  it('keeps the rooms inside the building, side by side and never overlapping', () => {
    for (const interior of all()) {
      const taken = new Uint8Array(interior.w * interior.h);
      for (const room of interior.rooms) {
        expect(room.w).toBeGreaterThanOrEqual(3);
        expect(room.h).toBeGreaterThanOrEqual(3);
        for (let y = room.y; y < room.y + room.h; y++) {
          for (let x = room.x; x < room.x + room.w; x++) {
            // One square of ground is left all around.
            expect(x >= 1 && y >= 1 && x < interior.w - 1 && y < interior.h - 1).toBe(true);
            expect(taken[y * interior.w + x]).toBe(0);
            taken[y * interior.w + x] = 1;
          }
        }
      }
    }
  });

  it('lets every free square of every room be walked to from the front door', () => {
    for (const interior of all()) {
      // The tavern has its own, older rule: its storeroom may be stacked full.
      if (interior.rooms[0].kind === 'common') continue;
      const reached = walkable(interior);
      for (const room of interior.rooms) {
        for (let y = room.y; y < room.y + room.h; y++) {
          for (let x = room.x; x < room.x + room.w; x++) {
            const index = y * interior.w + x;
            if (!interior.blocked[index]) expect(reached[index]).toBe(1);
          }
        }
      }
    }
  });

  it('stands no two solid pieces on the same square, and none outside a room', () => {
    const solid = new Set<string>(SOLID_KINDS);
    for (const interior of all()) {
      const taken = new Uint8Array(interior.w * interior.h);
      for (const piece of interior.furniture.filter((p) => solid.has(p.kind))) {
        // An upturned barrel serving as a table shares its block with the stools.
        expect(interior.rooms.some((room) => piece.x >= room.x && piece.x + piece.w <= room.x + room.w)).toBe(
          true,
        );
        for (let y = piece.y; y < piece.y + piece.h; y++) {
          for (let x = piece.x; x < piece.x + piece.w; x++) {
            expect(taken[y * interior.w + x]).toBe(0);
            taken[y * interior.w + x] = 1;
            expect(interior.blocked[y * interior.w + x]).toBe(1);
          }
        }
      }
    }
  });

  it('keeps the squares in front of every door free', () => {
    for (const interior of all()) {
      for (const door of interior.doors) {
        for (let k = 0; k < door.length; k++) {
          const [x, y] = door.dir === 'h' ? [door.x + k, door.y] : [door.x, door.y + k];
          const [bx, by] = door.dir === 'h' ? [x, y - 1] : [x - 1, y];
          expect(interior.blocked[by * interior.w + bx]).toBe(0);
          if (door !== interior.entrance) expect(interior.blocked[y * interior.w + x]).toBe(0);
        }
      }
    }
  });

  it('furnishes each kind with what makes it what it is', () => {
    for (const size of TAVERN_SIZES) {
      for (const quality of TAVERN_QUALITIES) {
        for (const seed of SEEDS) {
          const of = (kind: (typeof INTERIOR_KINDS)[number]) =>
            kinds(generateInterior(kind, seed, size, quality));
          expect(of('tavern')).toContain('bar');
          expect(of('smithy')).toContain('forge');
          expect(of('smithy')).toContain('anvil');
          expect(of('castle')).toContain('throne');
          expect(of('temple')).toContain('altar');
          expect(of('temple')).toContain('bench');
          expect(of('tower')).toContain('cauldron');
          expect(of('tower')).toContain('shelf');
          expect([...of('house')].some((kind) => kind === 'bed' || kind === 'bed-double')).toBe(true);
          expect(of('house')).toContain('fireplace');
        }
      }
    }
  });

  it('goes by the name it is given, or invents one', () => {
    for (const kind of INTERIOR_KINDS) {
      expect(generateInterior(kind, 'x', 'medium').name).not.toBe('');
      expect(generateInterior(kind, 'x', 'medium', 'medium', 'Casa do Ancião').name).toBe('Casa do Ancião');
      // The name changes nothing else.
      expect(generateInterior(kind, 'x', 'medium', 'medium', 'Outro').furniture).toEqual(
        generateInterior(kind, 'x', 'medium').furniture,
      );
    }
  });
});

describe('the interior of a building of a town', () => {
  const town = generateSite('kingdom', 'a');
  const of = (kind: string) => town.buildings.find((b) => b.kind === kind)!;

  it('finds the building standing on a square', () => {
    const house = of('house');
    expect(buildingAt(town, house.x, house.y)).toBe(house);
    expect(buildingAt(town, house.x + house.w - 1, house.y + house.h - 1)).toBe(house);
    // The middle of the main square is open ground.
    expect(buildingAt(town, 0, 0)).toBeNull();
  });

  it('is of the kind the building is', () => {
    expect(interiorOf(town, of('house'))?.kind).toBe('house');
    expect(interiorOf(town, of('tavern'))?.kind).toBe('tavern');
    expect(interiorOf(town, of('inn'))?.kind).toBe('tavern');
    expect(interiorOf(town, of('smithy'))?.kind).toBe('smithy');
    expect(interiorOf(town, of('temple'))?.kind).toBe('temple');
    expect(interiorOf(town, of('keep'))?.kind).toBe('castle');
    expect(interiorOf(town, of('academy'))?.kind).toBe('tower');
  });

  it('is none for what cannot be entered', () => {
    expect(interiorOf(town, of('stall'))).toBeNull();
    expect(interiorOf(town, of('stable'))).toBeNull();
  });

  it('carries the name the place has on the map', () => {
    expect(interiorOf(town, of('keep'))?.name).toMatch(/^Castelo /);
    expect(interiorOf(town, of('temple'))?.name).toMatch(/^Catedral de /);
    expect(interiorOf(town, of('house'))?.name).toBe('Casa');
  });

  it('is rich in the keep, poor in a ruin, and larger in a larger house', () => {
    expect(interiorOf(town, of('keep'))).toMatchObject({ quality: 'rich', size: 'large' });
    const ruins = generateSite('ruins', 'a');
    for (const building of ruins.buildings) {
      const inside = interiorOf(ruins, building);
      if (inside) expect(inside.quality).toBe('poor');
    }
    const houses = town.buildings.filter((b) => b.kind === 'house');
    const small = houses.find((b) => b.w * b.h <= 6)!;
    const large = houses.find((b) => b.w * b.h >= 8)!;
    expect(interiorOf(town, small)?.size).toBe('small');
    expect(interiorOf(town, large)?.size).toBe('medium');
  });

  it('opens the same building on the same interior, and each building on its own', () => {
    const [first, second] = town.buildings.filter((b) => b.kind === 'house');
    expect(interiorOf(town, first)).toEqual(interiorOf(town, first));
    expect(interiorOf(town, first)?.seed).not.toBe(interiorOf(town, second)?.seed);
  });

  it('gives a complete interior for every building of every kind of place', () => {
    for (const kind of ['village', 'city', 'kingdom', 'port', 'ruins', 'tower'] as const) {
      const site = generateSite(kind, 'b');
      for (const building of site.buildings) {
        const inside = interiorOf(site, building);
        if (!inside) continue;
        const interior = generateInterior(inside.kind, inside.seed, inside.size, inside.quality, inside.name);
        expect(interior.rooms.length).toBeGreaterThan(0);
        expect(interior.name).toBe(inside.name);
      }
    }
  });
});
