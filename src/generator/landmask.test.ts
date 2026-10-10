import { describe, expect, it } from 'vitest';
import { drawRing, ringSketch } from '../testing/shapes.ts';
import { buildLandField } from './landmask.ts';

const W = 100;
const H = 80;
const CENTER = (H / 2) * W + W / 2;
const CORNER = 2 * W + 2;
const at = (x: number, y: number) => y * W + x;

/** No coast roughening, so the result depends only on the drawn shape. */
const flat = () => 0;

describe('buildLandField', () => {
  it('returns null for an empty sketch', () => {
    expect(buildLandField(new Uint8Array(W * H), W, H, flat)).toBeNull();
  });

  it('turns the inside of a closed outline into land and the outside into water', () => {
    const field = buildLandField(ringSketch(W, H, 25), W, H, flat)!;
    expect(field[CENTER]).toBeGreaterThan(0);
    expect(field[CORNER]).toBeLessThan(0);
  });

  it('puts the coast on the drawn line', () => {
    const field = buildLandField(ringSketch(W, H, 25), W, H, flat)!;
    expect(field[at(W / 2 + 21, H / 2)]).toBeGreaterThan(0);
    expect(field[at(W / 2 + 29, H / 2)]).toBeLessThan(0);
  });

  it('grows more positive inland and more negative out at sea', () => {
    const field = buildLandField(ringSketch(W, H, 25), W, H, flat)!;
    expect(field[CENTER]).toBeGreaterThan(field[at(W / 2 + 20, H / 2)]);
    expect(field[CORNER]).toBeLessThan(field[at(W / 2 + 30, H / 2)]);
  });

  it('closes a small gap in the outline', () => {
    const field = buildLandField(ringSketch(W, H, 25, { gap: 3 }), W, H, flat)!;
    expect(field[CENTER]).toBeGreaterThan(0);
  });

  it('treats an outline with a wide opening as enclosing nothing', () => {
    expect(buildLandField(ringSketch(W, H, 25, { gap: 20 }), W, H, flat)).toBeNull();
  });

  it('ignores a stray line that encloses nothing', () => {
    const wall = new Uint8Array(W * H);
    for (let x = 20; x < 80; x++) wall[at(x, 40)] = 1;
    expect(buildLandField(wall, W, H, flat)).toBeNull();
  });

  it('makes an outline inside a continent into a lake', () => {
    const wall = ringSketch(W, H, 32);
    drawRing(wall, W, W / 2, H / 2, 13);
    const field = buildLandField(wall, W, H, flat)!;
    expect(field[CENTER]).toBeLessThan(0);
    expect(field[at(W / 2 + 22, H / 2)]).toBeGreaterThan(0);
  });

  it('fills in enclosed pockets too small to be a lake', () => {
    const wall = ringSketch(W, H, 32);
    drawRing(wall, W, W / 2, H / 2, 5);
    const field = buildLandField(wall, W, H, flat)!;
    expect(field[CENTER]).toBeGreaterThan(0);
  });

  it('roughens the coast with the given noise without moving it far', () => {
    const smooth = buildLandField(ringSketch(W, H, 25), W, H, flat)!;
    const rough = buildLandField(ringSketch(W, H, 25), W, H, (x, y) => Math.sin(x * 9) * Math.cos(y * 7))!;
    expect(rough).not.toEqual(smooth);
    expect(rough[CENTER]).toBeGreaterThan(0);
    expect(rough[CORNER]).toBeLessThan(0);
  });
});
