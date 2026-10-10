import { describe, expect, it } from 'vitest';
import { hashSeed, mulberry32, seededRng } from './rng.ts';

describe('hashSeed', () => {
  it('is stable for the same text and differs for different text', () => {
    expect(hashSeed('aldoria')).toBe(hashSeed('aldoria'));
    expect(hashSeed('aldoria')).not.toBe(hashSeed('aldorib'));
  });

  it('returns an unsigned 32-bit integer', () => {
    for (const seed of ['', 'a', 'a much longer seed with spaces']) {
      const hash = hashSeed(seed);
      expect(Number.isInteger(hash)).toBe(true);
      expect(hash).toBeGreaterThanOrEqual(0);
      expect(hash).toBeLessThan(2 ** 32);
    }
  });
});

describe('mulberry32', () => {
  it('produces the same sequence for the same seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 20; i++) expect(a()).toBe(b());
  });

  it('stays within [0, 1)', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('seededRng', () => {
  it('gives different sequences for different seeds', () => {
    expect(seededRng('one')()).not.toBe(seededRng('two')());
  });
});
