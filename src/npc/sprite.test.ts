import { describe, expect, it } from 'vitest';
import { NPC_GENDERS, NPC_RACES } from './prompt.ts';
import { CLASSES } from './sheet-data.ts';
import {
  SHEET_COLUMNS,
  SHEET_ROWS,
  sheetCell,
  SPRITE_ANIMATIONS,
  SPRITE_FACINGS,
  SPRITE_FRAMES,
  SPRITE_OPTIONS,
  spriteFrameAt,
  spriteLooks,
  spritePose,
  type SpriteSubject,
} from './sprite.ts';

const subject = (over: Partial<SpriteSubject> = {}): SpriteSubject => ({
  race: 'human',
  gender: 'male',
  age: 'adult',
  wealth: 'burgher',
  classId: 'fighter',
  ...over,
});

describe('spriteLooks', () => {
  it('offers five looks, the same every time for the same NPC', () => {
    expect(spriteLooks(subject(), 7)).toHaveLength(SPRITE_OPTIONS);
    expect(spriteLooks(subject(), 7)).toEqual(spriteLooks(subject(), 7));
    expect(spriteLooks(subject(), 7)).not.toEqual(spriteLooks(subject(), 8));
  });

  it('keeps who the NPC is in all of them, and changes what could be changed', () => {
    for (let seed = 0; seed < 20; seed++) {
      const looks = spriteLooks(subject({ classId: 'bard' }), seed);
      for (const key of ['skin', 'hair', 'height', 'width', 'beard'] as const) {
        expect(new Set(looks.map((look) => look[key])).size).toBe(1);
      }
      // Clothes, hair cut, headgear or cape: something tells every two apart.
      expect(new Set(looks.map((look) => JSON.stringify(look))).size).toBeGreaterThanOrEqual(4);
    }
  });

  it('gives every race its body and its marks', () => {
    const of = (race: (typeof NPC_RACES)[number], gender: (typeof NPC_GENDERS)[number] = 'male') =>
      spriteLooks(subject({ race, gender }), 3)[0];
    expect(of('dwarf').height).toBeLessThan(of('human').height);
    expect(of('dwarf').width).toBeGreaterThan(of('human').width);
    expect(of('halfling').height).toBeLessThan(of('dwarf').height);
    expect(of('orc').width).toBeGreaterThan(of('elf').width);
    expect(of('elf').ears).toBe('pointed');
    expect(of('human').ears).toBe('round');
    expect(of('tiefling').horns).toBe(true);
    expect(of('orc').tusks).toBe(true);
    expect(of('half-orc').tusks).toBe(true);
    expect(of('dragonborn')).toMatchObject({ snout: true, hairStyle: 'bald', beard: false });
    expect(of('dwarf').beard).toBe(true);
    expect(of('dwarf', 'female').beard).toBe(false);
    expect(of('human').horns || of('human').tusks || of('human').snout).toBe(false);
  });

  it('dresses each class for what it does', () => {
    const outfit = (classId: (typeof CLASSES)[number]) => spriteLooks(subject({ classId }), 3)[0].outfit;
    expect(outfit('fighter')).toBe('armor');
    expect(outfit('paladin')).toBe('armor');
    expect(outfit('wizard')).toBe('robe');
    expect(outfit('cleric')).toBe('robe');
    expect(outfit('rogue')).toBe('leather');
    expect(outfit('barbarian')).toBe('fur');
    expect(outfit('commoner')).toBe('tunic');
    // A pointed hat is the wizard's, and nobody else's.
    for (let seed = 0; seed < 20; seed++) {
      for (const classId of CLASSES) {
        const hats = spriteLooks(subject({ classId }), seed).filter((look) => look.headgear === 'hat');
        if (classId !== 'wizard') expect(hats).toHaveLength(0);
      }
    }
    expect(
      Array.from({ length: 10 }, (_, seed) => spriteLooks(subject({ classId: 'wizard' }), seed))
        .flat()
        .some((look) => look.headgear === 'hat'),
    ).toBe(true);
  });

  it('makes a child small, beardless and never dressed for war', () => {
    for (let seed = 0; seed < 20; seed++) {
      for (const look of spriteLooks(subject({ age: 'child', race: 'dwarf', classId: 'fighter' }), seed)) {
        expect(look.height).toBeLessThan(0.7);
        expect(look.beard).toBe(false);
        expect(look.outfit).toBe('tunic');
        expect(look.headgear).not.toBe('helm');
        expect(look.cape).toBeNull();
      }
    }
  });

  it('greys the hair of the old, and trims the rich in gold', () => {
    for (let seed = 0; seed < 10; seed++) {
      expect(['#bdbdbd', '#e6e6e0', '#9a9a9a']).toContain(
        spriteLooks(subject({ age: 'elder' }), seed)[0].hair,
      );
      expect(spriteLooks(subject({ wealth: 'noble' }), seed)[0].trim).toBe('#d2ad5c');
    }
  });

  it('gives a look for every race, gender and class', () => {
    for (const race of NPC_RACES) {
      for (const gender of NPC_GENDERS) {
        for (const classId of CLASSES) {
          for (const look of spriteLooks(subject({ race, gender, classId }), 1)) {
            for (const color of [look.skin, look.hair, look.top, look.trim, look.legs, look.boots]) {
              expect(color).toMatch(/^#[0-9a-f]{6}$/);
            }
          }
        }
      }
    }
  });
});

describe('spritePose', () => {
  it('wraps round past the last frame, and before the first', () => {
    for (const animation of SPRITE_ANIMATIONS) {
      const count = SPRITE_FRAMES[animation];
      expect(spritePose(animation, count)).toEqual(spritePose(animation, 0));
      expect(spritePose(animation, -1)).toEqual(spritePose(animation, count - 1));
    }
  });

  it('stands still but for breathing when idle', () => {
    for (let frame = 0; frame < SPRITE_FRAMES.idle; frame++) {
      const pose = spritePose('idle', frame);
      expect(pose).toMatchObject({ legFront: 0, legBack: 0, weapon: 'none', arrow: null, slash: null });
    }
    expect(new Set([0, 1, 2, 3].map((frame) => spritePose('idle', frame).bob)).size).toBeGreaterThan(1);
  });

  it('runs with legs opposed, and each arm against its leg', () => {
    for (let frame = 0; frame < SPRITE_FRAMES.run; frame++) {
      const pose = spritePose('run', frame);
      expect(pose.legFront).toBeCloseTo(-pose.legBack);
      expect(pose.armFront).toBeCloseTo(-pose.armBack);
      expect(Math.sign(pose.armFront) * Math.sign(pose.legFront)).toBeLessThanOrEqual(0);
      expect(pose.lean).toBeGreaterThan(0);
    }
    const strides = Array.from(
      { length: SPRITE_FRAMES.run },
      (_, frame) => spritePose('run', frame).legFront,
    );
    expect(Math.max(...strides)).toBeGreaterThan(0.6);
    expect(Math.min(...strides)).toBeLessThan(-0.6);
  });

  it('raises the sword, brings it down, and leaves a streak only in the cut', () => {
    const arm = Array.from({ length: SPRITE_FRAMES.sword }, (_, frame) => spritePose('sword', frame));
    const top = arm.findIndex((pose) => pose.armFront === Math.max(...arm.map((p) => p.armFront)));
    expect(arm[top].armFront).toBeGreaterThan(Math.PI * 0.8);
    expect(arm[arm.length - 1].armFront).toBeLessThan(0.5);
    for (const [frame, pose] of arm.entries()) {
      expect(pose.weapon).toBe('sword');
      // Nothing streaks the air before the arm has come over.
      if (frame <= top) expect(pose.slash).toBeNull();
    }
    expect(arm.filter((pose) => pose.slash !== null).length).toBeGreaterThanOrEqual(2);
  });

  it('draws the bow, holds, and lets the arrow fly on', () => {
    const shot = Array.from({ length: SPRITE_FRAMES.bow }, (_, frame) => spritePose('bow', frame));
    const full = shot.findIndex((pose) => pose.draw === 1);
    expect(full).toBeGreaterThan(0);
    // While the string is back the arrow is on it; once loosed it only gets further away.
    for (const pose of shot) if (pose.draw > 0) expect(pose.arrow).toBe(0);
    const flight = shot
      .map((pose) => pose.arrow)
      .filter((arrow): arrow is number => arrow !== null && arrow > 0);
    expect(flight.length).toBeGreaterThanOrEqual(2);
    expect([...flight].sort((a, b) => a - b)).toEqual(flight);
    expect(shot[full].armFront).toBeCloseTo(Math.PI / 2, 1);
  });
});

describe('the sprite sheet', () => {
  it('has a cell of its own for every frame', () => {
    const cells = new Set<string>();
    let frames = 0;
    for (const animation of SPRITE_ANIMATIONS) {
      for (const facing of SPRITE_FACINGS) {
        for (let frame = 0; frame < SPRITE_FRAMES[animation]; frame++) {
          const [column, row] = sheetCell(animation, facing, frame);
          expect(column).toBeLessThan(SHEET_COLUMNS);
          expect(row).toBeLessThan(SHEET_ROWS);
          cells.add(`${column},${row}`);
          frames += 1;
        }
      }
    }
    expect(cells.size).toBe(frames);
    expect(SHEET_ROWS).toBe(16);
  });

  it('plays each animation through at its own speed, and round again', () => {
    expect(spriteFrameAt('run', 0)).toBe(0);
    expect(spriteFrameAt('run', 0.1)).toBe(1);
    const second = Array.from({ length: 40 }, (_, k) => spriteFrameAt('bow', k / 20));
    expect(new Set(second).size).toBe(SPRITE_FRAMES.bow);
    expect(Math.max(...second)).toBe(SPRITE_FRAMES.bow - 1);
  });
});
