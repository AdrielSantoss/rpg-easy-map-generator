import { describe, expect, it } from 'vitest';
import { carveRivers } from './rivers.ts';

const W = 80;
const H = 60;
const SEA_WIDTH = 5;
const VALLEY_Y = 30;

/** Land east of a strip of sea, shaped as one valley that drains west along y = VALLEY_Y. */
function valley() {
  const land = new Uint8Array(W * H);
  const elevation = new Float32Array(W * H);
  const rain = new Float32Array(W * H).fill(1);
  for (let y = 0; y < H; y++) {
    for (let x = SEA_WIDTH; x < W; x++) {
      land[y * W + x] = 1;
      elevation[y * W + x] = 0.01 * Math.abs(y - VALLEY_Y) + 0.002 * x;
    }
  }
  return { land, elevation, rain };
}

describe('carveRivers', () => {
  it('collects a valley into a river that reaches the sea', () => {
    const { land, elevation, rain } = valley();
    const { rivers } = carveRivers(land, elevation, rain, W, H);
    expect(rivers.length).toBeGreaterThan(0);

    const longest = rivers.reduce((a, b) => (b.widths.length > a.widths.length ? b : a));
    const mouthX = longest.points[longest.points.length - 2];
    const mouthY = longest.points[longest.points.length - 1];
    expect(mouthX).toBeLessThan(SEA_WIDTH);
    expect(Math.abs(mouthY - VALLEY_Y)).toBeLessThan(3);
  });

  it('keeps every river inside the grid with one width per point', () => {
    const { land, elevation, rain } = valley();
    const { rivers } = carveRivers(land, elevation, rain, W, H);
    for (const { points, widths } of rivers) {
      expect(points.length).toBe(widths.length * 2);
      for (let p = 0; p < widths.length; p++) {
        expect(points[p * 2]).toBeGreaterThanOrEqual(0);
        expect(points[p * 2]).toBeLessThanOrEqual(W);
        expect(points[p * 2 + 1]).toBeGreaterThanOrEqual(0);
        expect(points[p * 2 + 1]).toBeLessThanOrEqual(H);
        expect(widths[p]).toBeGreaterThanOrEqual(0.5);
        expect(widths[p]).toBeLessThanOrEqual(1.7 + 1e-6);
      }
    }
  });

  it('gets wider downstream', () => {
    const { land, elevation, rain } = valley();
    const { rivers } = carveRivers(land, elevation, rain, W, H);
    const longest = rivers.reduce((a, b) => (b.widths.length > a.widths.length ? b : a));
    expect(longest.widths[longest.widths.length - 1]).toBeGreaterThan(longest.widths[0]);
  });

  it('marks river cells only on land', () => {
    const { land, elevation, rain } = valley();
    const { riverMask } = carveRivers(land, elevation, rain, W, H);
    expect(riverMask.includes(1)).toBe(true);
    for (let i = 0; i < riverMask.length; i++) {
      if (riverMask[i]) expect(land[i]).toBe(1);
    }
  });

  it('finds no rivers when there is too little rain', () => {
    const { land, elevation } = valley();
    const { rivers } = carveRivers(land, elevation, new Float32Array(W * H), W, H);
    expect(rivers).toHaveLength(0);
  });
});
