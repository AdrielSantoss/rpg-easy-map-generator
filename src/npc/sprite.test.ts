import { describe, expect, it } from 'vitest';
import { NPC_AGES, NPC_GENDERS, NPC_RACES, NPC_WEALTHS } from './prompt.ts';
import { CLASSES } from './sheet-data.ts';
import { SPRITE_PALETTES } from './sprite-palettes.ts';
import { SPRITE_SHEETS } from './sprite-sheets.ts';
import {
  layersFor,
  recolorTable,
  SHEET_COLUMNS,
  SHEET_ROWS,
  sheetCell,
  SPRITE_ANIMATIONS,
  SPRITE_FACINGS,
  SPRITE_FRAMES,
  SPRITE_OPTIONS,
  spriteFrameAt,
  spriteLooks,
  topPose,
  type SpriteLook,
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
const ids = (look: SpriteLook) => look.layers.map((layer) => layer.id);
const has = (look: SpriteLook, start: string) => ids(look).some((id) => id.startsWith(start));
const tintOf = (look: SpriteLook, start: string) =>
  look.layers.find((layer) => layer.id.startsWith(start))?.tint;

/** Every look of every kind of NPC, for one seed. */
function* everyLook(): Generator<SpriteLook> {
  for (const race of NPC_RACES) {
    for (const gender of NPC_GENDERS) {
      for (const age of NPC_AGES) {
        for (const classId of CLASSES) {
          for (const wealth of NPC_WEALTHS) yield* spriteLooks({ race, gender, age, wealth, classId }, 5);
        }
      }
    }
  }
}

describe('spriteLooks', () => {
  it('offers five looks, the same every time for the same NPC', () => {
    expect(spriteLooks(subject(), 7)).toHaveLength(SPRITE_OPTIONS);
    expect(spriteLooks(subject(), 7)).toEqual(spriteLooks(subject(), 7));
    expect(spriteLooks(subject(), 7)).not.toEqual(spriteLooks(subject(), 8));
  });

  it('keeps who the NPC is in all of them, and changes what could be changed', () => {
    for (let seed = 0; seed < 20; seed++) {
      const looks = spriteLooks(subject({ classId: 'bard' }), seed);
      expect(new Set(looks.map((look) => JSON.stringify(tintOf(look, 'body')))).size).toBe(1);
      expect(new Set(looks.map((look) => look.scale)).size).toBe(1);
      expect(new Set(looks.map((look) => has(look, 'beard'))).size).toBe(1);
      // Clothes, hair cut or cape: something tells most of them apart.
      expect(new Set(looks.map((look) => JSON.stringify(look.layers))).size).toBeGreaterThanOrEqual(4);
    }
  });

  it('uses only sheets that were brought into the project, for every animation they are part of', () => {
    const checked = new Set<string>();
    for (const look of everyLook()) {
      for (const animation of SPRITE_ANIMATIONS) {
        for (const layer of layersFor(look, animation)) {
          const path = `${layer.id}/${animation}`;
          if (checked.has(path)) continue;
          checked.add(path);
          expect(SPRITE_SHEETS[layer.id], path).toContain(animation);
        }
      }
    }
    expect(checked.size).toBeGreaterThan(100);
  });

  it('recolors only between ramps that exist', () => {
    for (const look of everyLook()) {
      for (const layer of look.layers) {
        if (!layer.tint) continue;
        const ramps = SPRITE_PALETTES[layer.tint.material] as Record<string, readonly string[]>;
        expect(ramps[layer.tint.from], `${layer.id}: ${layer.tint.from}`).toBeDefined();
        expect(ramps[layer.tint.to], `${layer.id}: ${layer.tint.to}`).toBeDefined();
      }
    }
  });

  it('piles the layers from the lowest to the highest', () => {
    for (const look of spriteLooks(subject({ classId: 'ranger' }), 3)) {
      const order = look.layers.map((layer) => layer.z);
      expect([...order].sort((a, b) => a - b)).toEqual(order);
      // The body under its clothes, the clothes under the head, the head under what is worn on it.
      const at = (start: string) => ids(look).findIndex((id) => id.startsWith(start));
      expect(at('body')).toBeLessThan(at('torso'));
      expect(at('torso')).toBeLessThan(at('head'));
    }
  });

  it('gives every race its body and its marks', () => {
    const of = (race: (typeof NPC_RACES)[number], gender: (typeof NPC_GENDERS)[number] = 'male') =>
      spriteLooks(subject({ race, gender }), 3)[0];
    expect(of('dwarf').scale).toBeLessThan(of('human').scale);
    expect(of('halfling').scale).toBeLessThan(of('dwarf').scale);
    expect(of('orc').scale).toBeGreaterThan(of('human').scale);
    expect(has(of('elf'), 'ears-elven')).toBe(true);
    expect(has(of('human'), 'ears-elven')).toBe(false);
    expect(has(of('tiefling'), 'horns')).toBe(true);
    expect(has(of('orc'), 'head-orc-male')).toBe(true);
    expect(has(of('half-orc', 'female'), 'head-orc-female')).toBe(true);
    expect(has(of('dragonborn'), 'head-lizard')).toBe(true);
    expect(has(of('dragonborn'), 'hair')).toBe(false);
    expect(has(of('dragonborn'), 'beard')).toBe(false);
    expect(has(of('dwarf'), 'beard')).toBe(true);
    expect(has(of('dwarf', 'female'), 'beard')).toBe(false);
    // An orc is green, and its head is recolored from the green it was drawn in.
    expect(tintOf(of('orc'), 'body')?.to).toMatch(/green/);
    expect(tintOf(of('orc'), 'head')).toMatchObject({ from: 'green', to: tintOf(of('orc'), 'body')?.to });
  });

  it('dresses each class for what it does', () => {
    const of = (classId: (typeof CLASSES)[number], gender: 'male' | 'female' = 'male') =>
      spriteLooks(subject({ classId, gender }), 3)[0];
    for (const classId of ['fighter', 'paladin'] as const) {
      expect(has(of(classId), 'torso-plate')).toBe(true);
      expect(has(of(classId), 'legs-plate')).toBe(true);
      expect(tintOf(of(classId), 'torso-plate')?.material).toBe('metal');
    }
    for (const classId of ['wizard', 'cleric', 'druid', 'monk'] as const) {
      expect(has(of(classId), 'legs-skirt')).toBe(true);
      // The robe is of one color, top to hem.
      expect(tintOf(of(classId), 'legs-skirt')).toEqual(tintOf(of(classId), 'torso-shirt'));
    }
    expect(has(of('rogue'), 'torso-leather')).toBe(true);
    expect(has(of('commoner'), 'torso-shirt')).toBe(true);
    // A barbarian man goes bare-chested; a woman does not.
    expect(has(of('barbarian'), 'torso')).toBe(false);
    expect(has(of('barbarian', 'female'), 'torso-leather')).toBe(true);
    // A pointed hat is the wizard's, and nobody else's.
    for (let seed = 0; seed < 20; seed++) {
      for (const classId of CLASSES) {
        const hats = spriteLooks(subject({ classId }), seed).filter((look) => has(look, 'hat-wizard'));
        if (classId !== 'wizard') expect(hats).toHaveLength(0);
      }
    }
    expect(
      Array.from({ length: 10 }, (_, seed) => spriteLooks(subject({ classId: 'wizard' }), seed))
        .flat()
        .some((look) => has(look, 'hat-wizard')),
    ).toBe(true);
  });

  it('uses the sheets drawn for the build of the NPC', () => {
    const man = spriteLooks(subject({ gender: 'male', classId: 'commoner' }), 3)[0];
    const woman = spriteLooks(subject({ gender: 'female', classId: 'commoner' }), 3)[0];
    for (const part of ['body', 'torso', 'legs', 'feet']) {
      expect(ids(man).find((id) => id.startsWith(part))).toMatch(/-male$/);
      expect(ids(woman).find((id) => id.startsWith(part))).toMatch(/-female$/);
    }
  });

  it('hides the hair under a hood or a helm, and the weapons until they are used', () => {
    for (const look of everyLook()) {
      if (has(look, 'hat-hood') || has(look, 'hat-helm')) expect(has(look, 'hair')).toBe(false);
      for (const animation of ['idle', 'walk'] as const) {
        expect(layersFor(look, animation).some((layer) => /sword|bow|arrow/.test(layer.id))).toBe(false);
      }
      expect(layersFor(look, 'slash').some((layer) => layer.id === 'sword-fg')).toBe(true);
      expect(layersFor(look, 'slash').some((layer) => layer.id.startsWith('bow'))).toBe(false);
      expect(layersFor(look, 'shoot').some((layer) => layer.id === 'arrow')).toBe(true);
    }
  });

  it('makes a child small, beardless and never dressed for war', () => {
    for (let seed = 0; seed < 20; seed++) {
      const grown = spriteLooks(subject({ race: 'dwarf', classId: 'fighter' }), seed)[0];
      for (const look of spriteLooks(subject({ age: 'child', race: 'dwarf', classId: 'fighter' }), seed)) {
        expect(look.scale).toBeLessThan(grown.scale);
        expect(has(look, 'beard')).toBe(false);
        expect(has(look, 'torso-plate')).toBe(false);
        expect(has(look, 'hat')).toBe(false);
        expect(has(look, 'cape')).toBe(false);
      }
    }
  });

  it('greys the hair of the old, and gives them an older face', () => {
    for (let seed = 0; seed < 10; seed++) {
      const look = spriteLooks(subject({ age: 'elder', classId: 'commoner' }), seed)[0];
      expect(has(look, 'head-human-male-elder')).toBe(true);
      const hair = tintOf(look, 'hair') ?? tintOf(look, 'beard');
      if (hair) expect(['gray', 'white', 'platinum', 'ash']).toContain(hair.to);
    }
  });
});

describe('recolorTable', () => {
  it('maps every color of one ramp to the one at the same place in another', () => {
    const table = recolorTable({ material: 'body', from: 'light', to: 'green' });
    expect(table.size).toBe(SPRITE_PALETTES.body.light.length);
    const number = (color: string) => parseInt(color.slice(1), 16);
    for (const [index, color] of SPRITE_PALETTES.body.light.entries()) {
      expect(table.get(number(color))).toBe(number(SPRITE_PALETTES.body.green[index]));
    }
  });

  it('leaves a sheet as it is when the ramp is its own', () => {
    for (const [from, to] of recolorTable({ material: 'cloth', from: 'white', to: 'white' }))
      expect(to).toBe(from);
  });

  it('refuses a ramp that does not exist', () => {
    expect(() => recolorTable({ material: 'cloth', from: 'white', to: 'plaid' })).toThrow();
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
    expect(SHEET_COLUMNS).toBe(13);
  });

  it('plays each animation through at its own speed, and round again', () => {
    expect(spriteFrameAt('walk', 0)).toBe(0);
    expect(spriteFrameAt('walk', 0.1)).toBe(1);
    const second = Array.from({ length: 60 }, (_, k) => spriteFrameAt('shoot', k / 30));
    expect(new Set(second).size).toBe(SPRITE_FRAMES.shoot);
    expect(Math.max(...second)).toBe(SPRITE_FRAMES.shoot - 1);
  });
});

describe('the figure seen from above', () => {
  it('is the same person in the same clothes as the layers show', () => {
    for (const look of everyLook()) {
      const { top } = look;
      // The same ramps, so the two views match color for color.
      expect(top.skin).toBe(tintOf(look, 'body')?.to);
      const clothes =
        tintOf(look, 'torso-plate') ?? tintOf(look, 'torso-shirt') ?? tintOf(look, 'torso-leather');
      if (clothes) expect(top.color).toBe(clothes.to);
      expect(top.outfit === 'armor').toBe(has(look, 'torso-plate'));
      expect(top.outfit === 'robe').toBe(has(look, 'legs-skirt'));
      expect(top.cape !== null).toBe(has(look, 'cape'));
      if (top.cape) expect(top.cape).toBe(tintOf(look, 'cape')?.to);
      expect(top.beard).toBe(has(look, 'beard'));
      expect(top.horns).toBe(has(look, 'horns'));
      expect(top.snout).toBe(has(look, 'head-lizard'));
      expect(top.tusks).toBe(has(look, 'head-orc'));
      expect(top.ears === 'pointed').toBe(has(look, 'ears-elven'));
      expect(top.headgear === 'hood').toBe(has(look, 'hat-hood'));
      expect(top.headgear === 'helm').toBe(has(look, 'hat-helm'));
      expect(top.headgear === 'hat').toBe(has(look, 'hat-wizard'));
      // No hair where the layers show none.
      expect(top.hairStyle === 'none').toBe(!has(look, 'hair'));
      if (has(look, 'hair')) expect(top.hair).toBe(tintOf(look, 'hair')?.to);
    }
  });

  it('uses only ramps that exist', () => {
    for (const look of everyLook()) {
      const { top } = look;
      const metal = top.outfit === 'armor';
      expect(SPRITE_PALETTES.body).toHaveProperty(top.skin);
      expect(SPRITE_PALETTES.hair).toHaveProperty(top.hair);
      expect(metal ? SPRITE_PALETTES.metal : SPRITE_PALETTES.cloth).toHaveProperty(top.color);
      expect(metal ? SPRITE_PALETTES.metal : SPRITE_PALETTES.cloth).toHaveProperty(top.boots);
      if (top.cape) expect(SPRITE_PALETTES.cloth).toHaveProperty(top.cape);
      if (top.headgear === 'helm') expect(SPRITE_PALETTES.metal).toHaveProperty(top.headgearColor);
      if (top.headgear === 'hood' || top.headgear === 'hat')
        expect(SPRITE_PALETTES.cloth).toHaveProperty(top.headgearColor);
    }
  });

  it('moves in step with the sheets: the same animations, frame for frame', () => {
    for (const animation of SPRITE_ANIMATIONS) {
      const count = SPRITE_FRAMES[animation];
      expect(topPose(animation, count)).toEqual(topPose(animation, 0));
      expect(topPose(animation, -1)).toEqual(topPose(animation, count - 1));
    }
    const walk = Array.from({ length: SPRITE_FRAMES.walk }, (_, frame) => topPose('walk', frame).stride);
    expect(Math.max(...walk)).toBeGreaterThan(0.8);
    expect(Math.min(...walk)).toBeLessThan(-0.8);
    expect(walk.every((_, frame) => topPose('walk', frame).weapon === 'none')).toBe(true);
  });

  it('raises the sword behind the shoulder and brings it across, streaking only in the cut', () => {
    const cut = Array.from({ length: SPRITE_FRAMES.slash }, (_, frame) => topPose('slash', frame));
    const back = cut.findIndex((pose) => pose.cut === Math.max(...cut.map((p) => p.cut)));
    expect(cut[back].cut).toBeGreaterThan(1.5);
    expect(cut[cut.length - 1].cut).toBeLessThan(0);
    for (const [frame, pose] of cut.entries()) {
      expect(pose.weapon).toBe('sword');
      if (frame <= back) expect(pose.streak).toBe(false);
    }
    expect(cut.filter((pose) => pose.streak).length).toBeGreaterThanOrEqual(2);
  });

  it('draws the bow, holds, and lets the arrow fly on', () => {
    const shot = Array.from({ length: SPRITE_FRAMES.shoot }, (_, frame) => topPose('shoot', frame));
    expect(shot.some((pose) => pose.draw === 1 && pose.aim === 1)).toBe(true);
    // While the string is back the arrow is on it; once loosed it only gets further away.
    for (const pose of shot) if (pose.draw > 0) expect(pose.arrow).toBe(0);
    const flight = shot
      .map((pose) => pose.arrow)
      .filter((arrow): arrow is number => arrow !== null && arrow > 0);
    expect(flight.length).toBeGreaterThanOrEqual(2);
    expect([...flight].sort((a, b) => a - b)).toEqual(flight);
    expect(shot[0].aim).toBe(0);
  });
});
