import { describe, expect, it } from 'vitest';
import { passwordMatches } from './auth.ts';
import { describeNpc, NPC_GENDERS, NPC_RACES } from './prompt.ts';

describe('describeNpc', () => {
  it('describes the same person for the same race, gender and seed', () => {
    expect(describeNpc('dwarf', 'female', 7)).toEqual(describeNpc('dwarf', 'female', 7));
  });

  it('describes different people for different seeds', () => {
    const people = new Set(
      Array.from({ length: 20 }, (_, seed) => describeNpc('human', 'male', seed).prompt),
    );
    expect(people.size).toBeGreaterThan(15);
  });

  it('asks for the chosen race and gender, for every combination', () => {
    const word: Record<string, string> = { 'half-elf': 'half-elf', 'half-orc': 'half-orc' };
    for (const race of NPC_RACES) {
      for (const gender of NPC_GENDERS) {
        const { prompt } = describeNpc(race, gender, 3);
        expect(prompt).toContain(word[race] ?? race);
        expect(prompt).toMatch(new RegExp(`\\b${gender}\\b`));
      }
    }
  });

  it('gives each race the features that set it apart', () => {
    expect(describeNpc('elf', 'male', 1).prompt).toContain('pointed ears');
    expect(describeNpc('dwarf', 'male', 1).prompt).toContain('beard');
    expect(describeNpc('dwarf', 'female', 1).prompt).not.toContain('beard');
    expect(describeNpc('orc', 'female', 1).prompt).toContain('tusks');
    expect(describeNpc('tiefling', 'male', 1).prompt).toContain('horns');
    expect(describeNpc('dragonborn', 'male', 1).prompt).toContain('scales');
  });

  it('gives a dragonborn no hair', () => {
    for (let seed = 0; seed < 30; seed++) {
      expect(describeNpc('dragonborn', 'female', seed).prompt).not.toMatch(
        /\b(black|brown|red|blond|auburn|grey|curly dark) hair\b/,
      );
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
    for (let seed = 0; seed < 40; seed++) {
      // No feminine form may end up describing a man, or the other way round.
      expect(describeNpc('human', 'male', seed).summary).not.toMatch(
        /\b(taverneira|ferreira|idosa|adulta|severa|cansada)\b/,
      );
      expect(describeNpc('human', 'female', seed).summary).not.toMatch(
        /\b(taverneiro|ferreiro|idoso|adulto|severo|cansado)\b/,
      );
    }
  });

  it('gives only some NPCs a distinguishing mark', () => {
    const marked = Array.from({ length: 60 }, (_, seed) => describeNpc('human', 'male', seed).prompt).filter(
      (p) => /scar|eyepatch|freckles|tattoo|broken nose|earring/.test(p),
    );
    expect(marked.length).toBeGreaterThan(8);
    expect(marked.length).toBeLessThan(45);
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
