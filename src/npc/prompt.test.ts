import { describe, expect, it } from 'vitest';
import { passwordMatches } from './auth.ts';
import {
  describeNpc,
  NPC_AGES,
  NPC_EXPRESSIONS,
  NPC_GENDERS,
  NPC_RACES,
  NPC_WEALTHS,
  type NpcOptions,
} from './prompt.ts';

/** Many seeds of the same request, to check what always or sometimes holds. */
const many = (options: NpcOptions = {}, count = 60) =>
  Array.from({ length: count }, (_, seed) => describeNpc('human', 'male', seed, options));

describe('describeNpc', () => {
  it('describes the same person for the same arguments', () => {
    expect(describeNpc('dwarf', 'female', 7)).toEqual(describeNpc('dwarf', 'female', 7));
    expect(describeNpc('dwarf', 'female', 7, { age: 'elder' })).toEqual(
      describeNpc('dwarf', 'female', 7, { age: 'elder' }),
    );
  });

  it('describes different people for different seeds', () => {
    expect(new Set(many({}, 20).map((npc) => npc.prompt)).size).toBeGreaterThan(15);
  });

  it('asks for the chosen race and gender, for every combination', () => {
    for (const race of NPC_RACES) {
      for (const gender of NPC_GENDERS) {
        for (const age of NPC_AGES) {
          const { prompt } = describeNpc(race, gender, 3, { age });
          expect(prompt).toContain(race);
          expect(prompt).toMatch(new RegExp(`\\b${gender}\\b`));
        }
      }
    }
  });

  it('gives each race the features that set it apart', () => {
    const adult = { age: 'adult' } as const;
    expect(describeNpc('elf', 'male', 1, adult).prompt).toContain('pointed ears');
    expect(describeNpc('dwarf', 'male', 1, adult).prompt).toContain('beard');
    expect(describeNpc('dwarf', 'female', 1, adult).prompt).not.toContain('beard');
    expect(describeNpc('orc', 'female', 1, adult).prompt).toContain('tusks');
    expect(describeNpc('tiefling', 'male', 1, adult).prompt).toContain('horns');
    expect(describeNpc('dragonborn', 'male', 1, adult).prompt).toContain('scales');
  });

  it('gives a dragonborn no hair, at any age', () => {
    for (const age of NPC_AGES) {
      for (let seed = 0; seed < 20; seed++) {
        expect(describeNpc('dragonborn', 'female', seed, { age }).prompt).not.toMatch(
          /\b\w+ hair\b(?<!no hair)/,
        );
      }
    }
  });

  it('asks for a painted portrait framed for a token, not a cartoon', () => {
    const { prompt } = describeNpc('human', 'female', 5);
    expect(prompt).toContain('Head and shoulders');
    expect(prompt).toContain('Realistic digital oil painting');
    expect(prompt).toContain('No text');
    expect(prompt).not.toMatch(/cartoon|anime/i);
  });

  it('sums the NPC up in Portuguese, agreeing with the gender', () => {
    expect(describeNpc('dwarf', 'male', 2).summary).toMatch(/^Anão, /);
    expect(describeNpc('dwarf', 'female', 2).summary).toMatch(/^Anã, /);
    expect(describeNpc('elf', 'female', 2).summary).toMatch(/^Elfa, /);
    const feminine = /\b(taverneira|ferreira|fazendeira|idosa|adulta|serena|brava|maligna|concentrada)\b/;
    const masculine = /\b(taverneiro|ferreiro|fazendeiro|idoso|adulto|sereno|bravo|maligno|concentrado)\b/;
    for (let seed = 0; seed < 60; seed++) {
      // No feminine form may end up describing a man, or the other way round.
      expect(describeNpc('human', 'male', seed).summary).not.toMatch(feminine);
      expect(describeNpc('human', 'female', seed).summary).not.toMatch(masculine);
    }
  });

  it('gives only some NPCs a distinguishing mark', () => {
    const marked = many({ age: 'adult' }).filter((npc) =>
      /scar|eyepatch|freckles|tattoo|broken nose|earring/.test(npc.prompt),
    );
    expect(marked.length).toBeGreaterThan(8);
    expect(marked.length).toBeLessThan(45);
  });
});

describe('age', () => {
  it('makes the NPC a child, an adult or an elder, as asked', () => {
    for (const npc of many({ age: 'child' })) {
      expect(npc.prompt).toContain('ten-year-old');
      expect(npc.prompt).toContain('child');
      expect(npc.summary).toContain('criança');
    }
    for (const npc of many({ age: 'elder' })) {
      expect(npc.prompt).toContain('old, deeply wrinkled');
      expect(npc.summary).toMatch(/\bidoso\b/);
    }
    for (const npc of many({ age: 'adult' })) {
      expect(npc.prompt).not.toMatch(/ten-year-old|deeply wrinkled/);
      expect(npc.summary).toMatch(/jovem|adulto|de meia-idade/);
    }
  });

  it('gives a child no trade, beard, scar, eyepatch or tattoo', () => {
    for (const race of NPC_RACES) {
      for (let seed = 0; seed < 25; seed++) {
        const { prompt, summary } = describeNpc(race, 'male', seed, { age: 'child' });
        expect(prompt).not.toMatch(/beard|scar|eyepatch|tattoo|broken nose|earring|shaved head/);
        expect(prompt).not.toMatch(/innkeeper|mercenary|blacksmith|knight|beggar|thief|wizard/);
        expect(summary).not.toMatch(/ferreiro|mercenário|cavaleiro|mendigo|gatuno/);
      }
    }
  });

  it('gives the old grey or white hair', () => {
    for (const npc of many({ age: 'elder' })) expect(npc.prompt).toMatch(/grey hair|white hair/);
  });

  it('picks all three ages when left open, adults most often', () => {
    const ages = many({}, 200).map((npc) =>
      npc.prompt.includes('ten-year-old')
        ? 'child'
        : npc.prompt.includes('deeply wrinkled')
          ? 'elder'
          : 'adult',
    );
    const count = (age: string) => ages.filter((a) => a === age).length;
    expect(count('child')).toBeGreaterThan(10);
    expect(count('elder')).toBeGreaterThan(10);
    expect(count('adult')).toBeGreaterThan(count('child') + count('elder'));
  });
});

describe('expression', () => {
  const words: Record<string, [RegExp, RegExp]> = {
    neutral: [/calm, neutral expression/, /sereno/],
    happy: [/happy, warmly smiling expression/, /feliz/],
    angry: [/angry, furious, scowling expression/, /bravo/],
    sad: [/sad, sorrowful, downcast expression/, /triste/],
    evil: [/sinister, cruel, malevolent expression/, /maligno/],
    focused: [/focused, intent, concentrated expression/, /concentrado/],
  };

  it('shows the expression asked for, in the picture and in the summary', () => {
    for (const expression of NPC_EXPRESSIONS) {
      for (const npc of many({ expression }, 20)) {
        expect(npc.prompt).toMatch(words[expression][0]);
        expect(npc.summary).toMatch(words[expression][1]);
      }
    }
  });

  it('uses every expression when left open', () => {
    const people = many({}, 120);
    for (const expression of NPC_EXPRESSIONS) {
      expect(people.some((npc) => words[expression][0].test(npc.prompt))).toBe(true);
    }
  });
});

describe('wealth', () => {
  it('dresses the NPC for their station', () => {
    for (const npc of many({ wealth: 'peasant' }, 20))
      expect(npc.prompt).toMatch(/patched, dirty rough-spun/);
    for (const npc of many({ wealth: 'burgher' }, 20))
      expect(npc.prompt).toMatch(/clean, well-made, practical/);
    for (const npc of many({ wealth: 'noble' }, 20))
      expect(npc.prompt).toMatch(/velvet and silk.*gold jewelry/);
  });

  it('gives each station its own trades', () => {
    const trades = (wealth: (typeof NPC_WEALTHS)[number]) =>
      new Set(many({ wealth, age: 'adult' }, 80).map((npc) => npc.summary.split(', ')[1]));
    const [peasant, burgher, noble] = NPC_WEALTHS.map(trades);
    for (const trade of peasant) expect(burgher.has(trade) || noble.has(trade)).toBe(false);
    for (const trade of noble) expect(burgher.has(trade)).toBe(false);
    expect(peasant).toContain('fazendeiro');
    expect(burgher).toContain('ferreiro');
    expect(noble).toContain('cavaleiro');
    expect(peasant.size).toBeGreaterThan(4);
  });

  it('says what station a child is from', () => {
    expect(describeNpc('human', 'female', 1, { age: 'child', wealth: 'peasant' }).summary).toContain(
      'criança camponesa',
    );
    expect(describeNpc('human', 'female', 1, { age: 'child', wealth: 'burgher' }).summary).toContain(
      'criança burguesa',
    );
    expect(describeNpc('human', 'female', 1, { age: 'child', wealth: 'noble' }).summary).toContain(
      'criança nobre',
    );
  });
});

describe('fixing one trait', () => {
  it('leaves the others as the seed would have had them', () => {
    for (let seed = 0; seed < 30; seed++) {
      const open = describeNpc('elf', 'female', seed, { age: 'adult' });
      const angry = describeNpc('elf', 'female', seed, { age: 'adult', expression: 'angry' });
      // Same trade and same hair: only the expression words differ.
      expect(angry.summary.split(', ').slice(0, 3)).toEqual(open.summary.split(', ').slice(0, 3));
      expect(/with ([^,]+)/.exec(angry.prompt)?.[1]).toBe(/with ([^,]+)/.exec(open.prompt)?.[1]);
    }
  });
});

describe('passwordMatches', () => {
  it('accepts the configured password', async () => {
    expect(await passwordMatches('correct horse', 'correct horse')).toBe(true);
  });

  it('rejects anything else', async () => {
    for (const guess of [
      '',
      'correct',
      'correct horse ',
      'Correct horse',
      'correct horsf',
      'x'.repeat(500),
    ]) {
      expect(await passwordMatches(guess, 'correct horse')).toBe(false);
    }
  });

  it('lets nobody in when no password is configured', async () => {
    expect(await passwordMatches('', undefined)).toBe(false);
    expect(await passwordMatches('', '')).toBe(false);
    expect(await passwordMatches('anything', undefined)).toBe(false);
  });
});
