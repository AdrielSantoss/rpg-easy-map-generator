import { describe, expect, it } from 'vitest';
import { parseNpc, readNpc, rememberNpc, serializeNpc, type SavedNpc } from './saved.ts';
import { ATTACK_ROWS, generateSheet } from './sheet.ts';

const npc = (id = 'a', seed = 7): SavedNpc => ({
  id,
  created: 1000 + seed,
  image: 'data:image/jpeg;base64,AAAA',
  summary: 'Elfa, maga, jovem',
  file: `npc-elf-female-${seed}`,
  race: 'elf',
  gender: 'female',
  seed,
  options: { age: 'adult', wealth: 'noble' },
  roll: 2,
  sheet: generateSheet('elf', 'female', seed, { age: 'adult', wealth: 'noble', roll: 2 }),
});

describe('saving an NPC', () => {
  it('comes back from its file exactly as it was', () => {
    const original = npc();
    original.sheet.name = 'Sariel, a Sábia';
    original.sheet.abilities.int = 19;
    expect(parseNpc(serializeNpc(original))).toEqual(original);
  });

  it('refuses what is not an NPC file', () => {
    expect(parseNpc('not json')).toBeNull();
    expect(parseNpc('null')).toBeNull();
    expect(parseNpc('{"app":"other","kind":"npc"}')).toBeNull();
    expect(parseNpc(JSON.stringify({ ...npc(), app: 'rpg-easy-map-generator', kind: 'map' }))).toBeNull();
  });

  it('refuses a portrait that is not a picture', () => {
    for (const image of [
      'javascript:alert(1)',
      'https://example.com/a.jpg',
      'data:text/html;base64,AAAA',
      'data:image/svg+xml;base64,AAAA',
      'data:image/jpeg;base64,AA"onerror="x',
      42,
    ]) {
      expect(readNpc({ ...npc(), image })).toBeNull();
    }
  });

  it('refuses an unknown race or gender', () => {
    expect(readNpc({ ...npc(), race: 'robot' })).toBeNull();
    expect(readNpc({ ...npc(), gender: 3 })).toBeNull();
  });

  it('brings a damaged sheet back to a complete one', () => {
    const read = readNpc({
      ...npc(),
      options: { age: 'baby', expression: 'evil' },
      file: '../../etc/passwd',
      sheet: {
        name: 12,
        classId: 'pirate',
        level: 99,
        abilities: { str: 'strong', dex: 400 },
        saves: ['str', 'luck'],
        skills: 'all',
        attacks: [{ name: 'Faca' }, 'nonsense'],
        coins: { gp: -5 },
      },
    })!;
    expect(read.options).toEqual({ age: undefined, expression: 'evil', wealth: undefined });
    expect(read.file).toBe('etcpasswd');
    expect(read.sheet.name).toBe('');
    expect(read.sheet.classId).toBe('commoner');
    expect(read.sheet.level).toBe(20);
    expect(read.sheet.abilities).toEqual({ str: 10, dex: 30, con: 10, int: 10, wis: 10, cha: 10 });
    expect(read.sheet.saves).toEqual(['str']);
    expect(read.sheet.skills).toEqual([]);
    expect(read.sheet.attacks).toHaveLength(ATTACK_ROWS);
    expect(read.sheet.attacks[0]).toEqual({ name: 'Faca', bonus: '', damage: '' });
    expect(read.sheet.coins.gp).toBe(0);
    expect(read.sheet.features).toBe('');
  });
});

describe('the list of recent NPCs', () => {
  it('puts the newest first and drops the oldest past the limit', () => {
    const { list, dropped } = rememberNpc([npc('b'), npc('c')], npc('a'), 2);
    expect(list.map((entry) => entry.id)).toEqual(['a', 'b']);
    expect(dropped.map((entry) => entry.id)).toEqual(['c']);
  });

  it('replaces an NPC opened again instead of listing it twice', () => {
    const { list, dropped } = rememberNpc([npc('b'), npc('a'), npc('c')], npc('a'), 5);
    expect(list.map((entry) => entry.id)).toEqual(['a', 'b', 'c']);
    expect(dropped).toEqual([]);
  });
});
