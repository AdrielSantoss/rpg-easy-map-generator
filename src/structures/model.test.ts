import { describe, expect, it } from 'vitest';
import { ICON_HEIGHT, STRUCTURE_KINDS, structureAt, structureFootprint, type Structure } from './model.ts';

const village: Structure = { kind: 'village', x: 100, y: 100, name: 'Valdor' };
const kingdom: Structure = { kind: 'kingdom', x: 200, y: 100, name: 'Reino de Morheim' };

describe('ICON_HEIGHT', () => {
  it('has a size for every kind', () => {
    for (const kind of STRUCTURE_KINDS) expect(ICON_HEIGHT[kind]).toBeGreaterThan(0);
  });
});

describe('structureFootprint', () => {
  it('covers the icon above the base point and the name below it', () => {
    const box = structureFootprint(kingdom);
    expect(box.x).toBe(kingdom.x);
    expect(box.y - box.height / 2).toBeCloseTo(kingdom.y - ICON_HEIGHT.kingdom);
    expect(box.y + box.height / 2).toBeGreaterThan(kingdom.y + 5);
  });

  it('is as wide as the longer of the icon and the name', () => {
    expect(structureFootprint(village).width).toBeGreaterThanOrEqual(ICON_HEIGHT.village);
    expect(structureFootprint(kingdom).width).toBeGreaterThan(structureFootprint(village).width);
  });
});

describe('structureAt', () => {
  it('finds a structure clicked on its icon, which sits above the base point', () => {
    expect(structureAt([village, kingdom], 100, 97)).toBe(village);
    expect(structureAt([village, kingdom], 201, 93)).toBe(kingdom);
  });

  it('returns null when the click is far from every structure', () => {
    expect(structureAt([village, kingdom], 150, 100)).toBeNull();
    expect(structureAt([], 100, 100)).toBeNull();
  });

  it('picks the nearest when two structures are close together', () => {
    const near: Structure = { kind: 'village', x: 106, y: 100, name: 'Elilton' };
    expect(structureAt([village, near], 105, 97)).toBe(near);
    expect(structureAt([village, near], 101, 97)).toBe(village);
  });
});
