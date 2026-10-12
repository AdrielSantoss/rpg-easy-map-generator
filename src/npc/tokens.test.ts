import { describe, expect, it } from 'vitest';
import { matchTokens, readCatalog, suits, type TokenArt, type TokenCatalog } from './tokens.ts';

const token = (over: Partial<TokenArt> = {}): TokenArt => ({
  file: 'a.png',
  name: 'A',
  gender: 'any',
  classes: [],
  races: [],
  ...over,
});
const catalog = (tokens: TokenArt[]): TokenCatalog => ({
  author: 'Someone',
  source: 'https://example.com/someone',
  tokens,
});

describe('suits', () => {
  it('never offers a figure of another gender', () => {
    expect(suits(token({ gender: 'female' }), 'human', 'male', 'fighter')).toBe(0);
    expect(suits(token({ gender: 'female' }), 'human', 'female', 'fighter')).toBeGreaterThan(0);
    expect(suits(token({ gender: 'any' }), 'human', 'male', 'fighter')).toBeGreaterThan(0);
  });

  it('takes a figure with no race named for any race that looks human, and no other', () => {
    const plain = token();
    for (const race of ['human', 'elf', 'half-elf', 'dwarf', 'halfling', 'gnome'] as const) {
      expect(suits(plain, race, 'male', 'fighter')).toBeGreaterThan(0);
    }
    for (const race of ['orc', 'half-orc', 'dragonborn', 'tiefling'] as const) {
      expect(suits(plain, race, 'male', 'fighter')).toBe(0);
    }
    expect(suits(token({ races: ['tiefling'] }), 'tiefling', 'male', 'fighter')).toBeGreaterThan(0);
    expect(suits(token({ races: ['tiefling'] }), 'human', 'male', 'fighter')).toBe(0);
  });

  it('prefers the class the figure was most clearly drawn as', () => {
    const knight = token({ classes: ['paladin', 'fighter', 'cleric'] });
    const asPaladin = suits(knight, 'human', 'male', 'paladin');
    const asFighter = suits(knight, 'human', 'male', 'fighter');
    const asWizard = suits(knight, 'human', 'male', 'wizard');
    expect(asPaladin).toBeGreaterThan(asFighter);
    expect(asFighter).toBeGreaterThan(asWizard);
    // Still better than nothing for a class it was not drawn as.
    expect(asWizard).toBeGreaterThan(0);
  });

  it('prefers a figure that names the race and the gender', () => {
    expect(suits(token({ races: ['elf'] }), 'elf', 'female', 'ranger')).toBeGreaterThan(
      suits(token(), 'elf', 'female', 'ranger'),
    );
    expect(suits(token({ gender: 'female' }), 'elf', 'female', 'ranger')).toBeGreaterThan(
      suits(token(), 'elf', 'female', 'ranger'),
    );
  });
});

describe('matchTokens', () => {
  const tokens = [
    token({ file: 'wizard.png', classes: ['wizard'] }),
    token({ file: 'knight.png', classes: ['paladin', 'fighter'] }),
    token({ file: 'lady.png', gender: 'female', classes: ['fighter'] }),
    token({ file: 'orc.png', races: ['orc'], classes: ['barbarian'] }),
    token({ file: 'anyone-1.png' }),
    token({ file: 'anyone-2.png' }),
    token({ file: 'anyone-3.png' }),
  ];
  const subject = { race: 'human', gender: 'male', classId: 'fighter' } as const;

  it('offers the best suited first, and never one that does not suit', () => {
    const offered = matchTokens(catalog(tokens), subject, 1, 5).map((t) => t.file);
    expect(offered[0]).toBe('knight.png');
    expect(offered).not.toContain('lady.png');
    expect(offered).not.toContain('orc.png');
    expect(offered).toHaveLength(5);
  });

  it('offers the same ones every time for the same NPC, and others for another', () => {
    expect(matchTokens(catalog(tokens), subject, 3, 5)).toEqual(matchTokens(catalog(tokens), subject, 3, 5));
    const orders = new Set(
      Array.from({ length: 12 }, (_, seed) =>
        matchTokens(catalog(tokens), subject, seed, 5)
          .map((t) => t.file)
          .join(),
      ),
    );
    expect(orders.size).toBeGreaterThan(1);
  });

  it('offers fewer, or none, when the collection has nothing suitable', () => {
    expect(
      matchTokens(catalog(tokens), { race: 'orc', gender: 'female', classId: 'wizard' }, 1, 5),
    ).toHaveLength(1);
    expect(
      matchTokens(catalog(tokens), { race: 'dragonborn', gender: 'male', classId: 'wizard' }, 1, 5),
    ).toEqual([]);
    expect(matchTokens(catalog([]), subject, 1, 5)).toEqual([]);
  });
});

describe('readCatalog', () => {
  it('reads a well formed catalog', () => {
    const read = readCatalog({
      author: 'Someone',
      source: 'https://example.com/someone',
      tokens: [
        { file: 'a-01.png', name: 'Aeron', gender: 'male', classes: ['ranger', 'rogue'], races: ['elf'] },
      ],
    });
    expect(read).toEqual({
      author: 'Someone',
      source: 'https://example.com/someone',
      tokens: [
        { file: 'a-01.png', name: 'Aeron', gender: 'male', classes: ['ranger', 'rogue'], races: ['elf'] },
      ],
    });
  });

  it('refuses what is not a catalog', () => {
    expect(readCatalog(null)).toBeNull();
    expect(readCatalog('tokens')).toBeNull();
    expect(readCatalog({ author: 'x' })).toBeNull();
  });

  it('drops pictures whose path could lead anywhere else', () => {
    const read = readCatalog({
      tokens: [
        { file: '../secret.png' },
        { file: 'https://evil.example/a.png' },
        { file: 'folder/a.png' },
        { file: 'a.svg' },
        { file: 'javascript:alert(1)' },
        { file: 12 },
        'nonsense',
        { file: 'fine.png' },
      ],
    });
    expect(read?.tokens.map((t) => t.file)).toEqual(['fine.png']);
  });

  it('keeps only classes, races and genders the generator knows, and only a web link as the source', () => {
    const read = readCatalog({
      source: 'javascript:alert(1)',
      tokens: [
        { file: 'a.png', gender: 'robot', classes: ['pirate', 'wizard'], races: ['elf', 'martian'], name: 7 },
      ],
    });
    expect(read?.source).toBe('');
    expect(read?.tokens[0]).toEqual({
      file: 'a.png',
      name: '',
      gender: 'any',
      classes: ['wizard'],
      races: ['elf'],
    });
  });
});
