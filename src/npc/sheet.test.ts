import { describe, expect, it } from 'vitest';
import { describeNpc, NPC_GENDERS, NPC_RACES, NPC_TRADES } from './prompt.ts';
import { ABILITIES, BACKGROUND, CLASS, CLASSES, SKILLS, TRADE } from './sheet-data.ts';
import {
  ATTACK_ROWS,
  generateSheet,
  modifier,
  passivePerception,
  proficiencyAt,
  saveBonus,
  signed,
  skillBonus,
  spellcasting,
} from './sheet.ts';

/** Many sheets of the same request. */
const many = (options: Parameters<typeof generateSheet>[3] = {}, count = 40) =>
  Array.from({ length: count }, (_, seed) => generateSheet('human', 'male', seed, options));

describe('the rules', () => {
  it('turns scores into modifiers', () => {
    expect([1, 8, 9, 10, 11, 15, 20].map(modifier)).toEqual([-5, -1, -1, 0, 0, 2, 5]);
  });

  it('writes bonuses with their sign', () => {
    expect([-1, 0, 3].map(signed)).toEqual(['−1', '+0', '+3']);
  });

  it('raises the proficiency bonus every four levels', () => {
    expect([1, 4, 5, 8, 9, 13, 17, 20].map(proficiencyAt)).toEqual([2, 2, 3, 3, 4, 5, 6, 6]);
  });

  it('knows a class and a background for every trade', () => {
    for (const trade of NPC_TRADES) {
      expect(CLASSES).toContain(TRADE[trade][0]);
      expect(BACKGROUND[TRADE[trade][1]]).toBeDefined();
    }
  });
});

describe('generateSheet', () => {
  it('writes the same sheet for the same arguments', () => {
    expect(generateSheet('elf', 'female', 9, { age: 'adult' })).toEqual(
      generateSheet('elf', 'female', 9, { age: 'adult' }),
    );
  });

  it('writes another sheet for the same NPC when rolled again', () => {
    const first = generateSheet('elf', 'female', 9, { classId: 'fighter', level: 3 });
    const names = new Set([1, 2, 3, 4, 5].map((roll) => generateSheet('elf', 'female', 9, { roll }).name));
    expect(names.size).toBeGreaterThan(1);
    expect(generateSheet('elf', 'female', 9, { classId: 'fighter', level: 3, roll: 1 })).not.toEqual(first);
  });

  it('is complete and within the rules for every race, gender and class', () => {
    for (const race of NPC_RACES) {
      for (const gender of NPC_GENDERS) {
        for (const classId of CLASSES) {
          for (const level of [1, 5, 20]) {
            const sheet = generateSheet(race, gender, 4, { classId, level });
            expect(sheet.name).not.toBe('');
            expect(sheet.level).toBe(level);
            expect(sheet.proficiencyBonus).toBe(proficiencyAt(level));
            for (const ability of ABILITIES) {
              expect(sheet.abilities[ability]).toBeGreaterThanOrEqual(8);
              expect(sheet.abilities[ability]).toBeLessThanOrEqual(20);
            }
            expect(sheet.hpMax).toBeGreaterThanOrEqual(level);
            expect(sheet.hpCurrent).toBe(sheet.hpMax);
            expect(sheet.armorClass).toBeGreaterThanOrEqual(9);
            expect(sheet.hitDice).toBe(`${level}d${CLASS[classId].hitDie}`);
            expect(sheet.attacks.length).toBe(ATTACK_ROWS);
            expect(sheet.attacks[0].name).not.toBe('');
            expect(new Set(sheet.skills).size).toBe(sheet.skills.length);
            expect(sheet.proficiencies).toContain('Comum');
          }
        }
      }
    }
  });

  it('agrees with the portrait: trade, wealth and expression', () => {
    for (let seed = 0; seed < 60; seed++) {
      const { traits } = describeNpc('human', 'female', seed);
      const sheet = generateSheet('human', 'female', seed);
      if (traits.trade) {
        const [classId, background] = TRADE[traits.trade];
        expect(sheet.classId).toBe(classId);
        expect(sheet.className).toBe(CLASS[classId].label[1]);
        expect(sheet.background).toBe(BACKGROUND[background].label);
      } else {
        expect(sheet.classId).toBe('commoner');
        expect(sheet.level).toBe(1);
      }
      expect(sheet.alignment.endsWith('Mau')).toBe(traits.expression === 'evil');
      expect(sheet.coins.pp > 0).toBe(traits.wealth === 'noble');
    }
  });

  it('gives the old more levels than the young', () => {
    const average = (age: 'adult' | 'elder') =>
      many({ age }).reduce((sum, sheet) => sum + sheet.level, 0) / 40;
    expect(average('elder')).toBeGreaterThan(average('adult'));
  });

  it('keeps who the NPC is when only the class or the level changes', () => {
    for (let seed = 0; seed < 20; seed++) {
      const base = generateSheet('dwarf', 'male', seed, { age: 'adult' });
      const other = generateSheet('dwarf', 'male', seed, { age: 'adult', classId: 'wizard', level: 12 });
      for (const key of ['name', 'alignment', 'traits', 'ideals', 'bonds', 'flaws', 'coins'] as const) {
        expect(other[key]).toEqual(base[key]);
      }
    }
  });

  it('puts the best scores where the class needs them', () => {
    for (const sheet of many({ classId: 'wizard', level: 1 })) {
      expect(sheet.abilities.int).toBe(Math.max(...Object.values(sheet.abilities)));
    }
    // Humans add one to everything: 15 + 1, then two improvements by level 8.
    expect(generateSheet('human', 'male', 1, { classId: 'fighter', level: 8 }).abilities.str).toBe(20);
  });

  it('applies what the race gives', () => {
    const dwarf = generateSheet('dwarf', 'male', 3, { classId: 'fighter', level: 1 });
    const human = generateSheet('human', 'male', 3, { classId: 'fighter', level: 1 });
    expect(dwarf.speed).toBe('7,5 m');
    expect(human.speed).toBe('9 m');
    expect(dwarf.features).toContain('Visão no Escuro');
    expect(generateSheet('elf', 'male', 3).skills).toContain('perception');
    expect(generateSheet('half-orc', 'male', 3).skills).toContain('intimidation');
    expect(generateSheet('tiefling', 'female', 3).name).not.toContain(' ');
  });

  it('gives each class its hit points, armor and saving throws', () => {
    const fighter = generateSheet('human', 'male', 2, { classId: 'fighter', level: 1 });
    expect(fighter.armorClass).toBe(18);
    expect(fighter.hpMax).toBe(10 + modifier(fighter.abilities.con));
    expect(fighter.saves).toEqual(['str', 'con']);
    const wizard = generateSheet('human', 'male', 2, { classId: 'wizard', level: 1 });
    expect(wizard.armorClass).toBe(10 + modifier(wizard.abilities.dex));
    expect(wizard.hpMax).toBe(6 + modifier(wizard.abilities.con));
    const monk = generateSheet('human', 'male', 2, { classId: 'monk', level: 1 });
    expect(monk.armorClass).toBe(10 + modifier(monk.abilities.dex) + modifier(monk.abilities.wis));
  });

  it('learns the skills of the background and as many of the class as it allows', () => {
    const rogue = generateSheet('human', 'male', 6, { classId: 'rogue', age: 'adult' });
    expect(rogue.skills.length).toBe(2 + 4);
    const halfElf = generateSheet('half-elf', 'male', 6, { classId: 'fighter', age: 'adult' });
    expect(halfElf.skills.length).toBe(2 + 2 + 2);
    // In the order of the sheet.
    const order = SKILLS.map((skill) => skill.id);
    expect([...rogue.skills].sort((a, b) => order.indexOf(a) - order.indexOf(b))).toEqual(rogue.skills);
  });

  it('writes attacks with the right numbers', () => {
    const fighter = generateSheet('human', 'male', 2, { classId: 'fighter', level: 1 });
    const str = modifier(fighter.abilities.str);
    expect(fighter.attacks[0]).toEqual({
      name: 'Espada longa',
      bonus: signed(str + 2),
      damage: `1d8${signed(str)} cortante`,
    });
    const wizard = generateSheet('human', 'male', 2, { classId: 'wizard', level: 11 });
    expect(wizard.attacks[0].damage).toBe('3d10 fogo');
    const cleric = generateSheet('human', 'male', 2, { classId: 'cleric', level: 1 });
    expect(cleric.attacks[2].bonus).toBe(`CD ${10 + modifier(cleric.abilities.wis)}`);
    const monk = generateSheet('human', 'male', 2, { classId: 'monk', level: 17 });
    expect(monk.attacks[0].damage).toMatch(/^1d10/);
  });

  it('lists only the class features already earned', () => {
    const young = generateSheet('human', 'male', 2, { classId: 'fighter', level: 1 });
    expect(young.features).toContain('Retomar o Fôlego');
    expect(young.features).not.toContain('Surto de Ação');
    expect(generateSheet('human', 'male', 2, { classId: 'fighter', level: 5 }).features).toContain(
      'Ataque Extra',
    );
    expect(generateSheet('human', 'male', 2, { classId: 'rogue', level: 5 }).features).toContain(
      'Ataque Furtivo (3d6)',
    );
  });

  it('gives spells to those who cast, from the level they start', () => {
    expect(generateSheet('human', 'male', 2, { classId: 'wizard', level: 1 }).spells).toContain('Truques');
    expect(generateSheet('human', 'male', 2, { classId: 'fighter', level: 9 }).spells).toBe('');
    const squire = generateSheet('human', 'male', 2, { classId: 'paladin', level: 1 });
    const paladin = generateSheet('human', 'male', 2, { classId: 'paladin', level: 2 });
    expect(squire.spells).toBe('');
    expect(spellcasting(squire)).toBeNull();
    expect(paladin.spells).toContain('Bênção');
    expect(spellcasting(paladin)).toEqual({
      ability: 'cha',
      dc: 10 + modifier(paladin.abilities.cha),
      attack: 2 + modifier(paladin.abilities.cha),
    });
  });
});

describe('what follows from an edited sheet', () => {
  it('recomputes saves, skills and passive perception', () => {
    const sheet = generateSheet('human', 'male', 2, { classId: 'fighter', level: 1 });
    sheet.abilities.wis = 16;
    sheet.proficiencyBonus = 3;
    sheet.saves = ['wis'];
    sheet.skills = ['perception'];
    expect(saveBonus(sheet, 'wis')).toBe(6);
    expect(saveBonus(sheet, 'str')).toBe(modifier(sheet.abilities.str));
    expect(skillBonus(sheet, 'perception')).toBe(6);
    expect(skillBonus(sheet, 'insight')).toBe(3);
    expect(passivePerception(sheet)).toBe(16);
  });
});
