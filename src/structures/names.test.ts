import { describe, expect, it } from 'vitest';
import { seededRng } from '../generator/rng.ts';
import { STRUCTURE_KINDS } from './model.ts';
import { suggestName } from './names.ts';

describe('suggestName', () => {
  it('is deterministic for a given random source', () => {
    for (const kind of STRUCTURE_KINDS) {
      expect(suggestName(kind, seededRng('names'))).toBe(suggestName(kind, seededRng('names')));
    }
  });

  it('prefixes the name according to the kind of place', () => {
    const rng = seededRng('prefixes');
    expect(suggestName('kingdom', rng)).toMatch(/^Reino de \p{Lu}\p{Ll}+$/u);
    expect(suggestName('tower', rng)).toMatch(/^Torre de \p{Lu}\p{Ll}+$/u);
    expect(suggestName('port', rng)).toMatch(/^Porto \p{Lu}\p{Ll}+$/u);
    expect(suggestName('ruins', rng)).toMatch(/^Ruínas de \p{Lu}\p{Ll}+$/u);
    expect(suggestName('dungeon', rng)).toMatch(/^(Covil|Cripta|Gruta|Abismo) de \p{Lu}\p{Ll}+$/u);
  });

  it('gives towns a bare name', () => {
    const rng = seededRng('towns');
    expect(suggestName('city', rng)).toMatch(/^\p{Lu}\p{Ll}+$/u);
    expect(suggestName('village', rng)).toMatch(/^\p{Lu}\p{Ll}+$/u);
  });

  it('varies between calls', () => {
    const rng = seededRng('variety');
    const names = new Set(Array.from({ length: 30 }, () => suggestName('village', rng)));
    expect(names.size).toBeGreaterThan(15);
  });
});
