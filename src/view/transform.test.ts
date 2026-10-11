import { describe, expect, it } from 'vitest';
import { clampView, IDENTITY, MAX_ZOOM, panBy, zoomAt, type ViewTransform } from './transform.ts';

/** The content point shown at a frame position. */
const contentAt = (view: ViewTransform, px: number, py: number) => [
  (px - view.x) / view.scale,
  (py - view.y) / view.scale,
];

describe('zoomAt', () => {
  it('keeps the content under the cursor in place', () => {
    const before = contentAt(IDENTITY, 0.3, 0.6);
    const zoomed = zoomAt(IDENTITY, 0.3, 0.6, 2);
    const after = contentAt(zoomed, 0.3, 0.6);
    expect(zoomed.scale).toBe(2);
    expect(after[0]).toBeCloseTo(before[0]);
    expect(after[1]).toBeCloseTo(before[1]);
  });

  it('still does so when already zoomed and panned', () => {
    const view = panBy(zoomAt(IDENTITY, 0.5, 0.5, 3), -0.4, 0.2);
    const before = contentAt(view, 0.7, 0.2);
    const after = contentAt(zoomAt(view, 0.7, 0.2, 1.5), 0.7, 0.2);
    expect(after[0]).toBeCloseTo(before[0]);
    expect(after[1]).toBeCloseTo(before[1]);
  });

  it('never zooms out past the whole map', () => {
    expect(zoomAt(IDENTITY, 0.2, 0.9, 0.5)).toEqual(IDENTITY);
    expect(zoomAt(zoomAt(IDENTITY, 0.9, 0.1, 4), 0.1, 0.9, 0.01)).toEqual(IDENTITY);
  });

  it('stops at the maximum zoom', () => {
    expect(zoomAt(IDENTITY, 0.5, 0.5, 1000).scale).toBe(MAX_ZOOM);
  });

  it('never shows anything beyond the edges of the map', () => {
    for (const [px, py] of [
      [0, 0],
      [1, 1],
      [0, 1],
      [1, 0],
    ]) {
      const view = zoomAt(zoomAt(IDENTITY, px, py, 4), 1 - px, 1 - py, 0.6);
      expect(view.x).toBeLessThanOrEqual(0);
      expect(view.y).toBeLessThanOrEqual(0);
      expect(view.x + view.scale).toBeGreaterThanOrEqual(1 - 1e-9);
      expect(view.y + view.scale).toBeGreaterThanOrEqual(1 - 1e-9);
    }
  });
});

describe('panBy', () => {
  it('moves the content while zoomed in', () => {
    const view = zoomAt(IDENTITY, 0.5, 0.5, 2);
    const moved = panBy(view, 0.1, -0.2);
    expect(moved.x).toBeCloseTo(view.x + 0.1);
    expect(moved.y).toBeCloseTo(view.y - 0.2);
    expect(moved.scale).toBe(2);
  });

  it('stops at the edges of the map', () => {
    const view = zoomAt(IDENTITY, 0.5, 0.5, 2);
    expect(panBy(view, 5, 5)).toEqual({ scale: 2, x: 0, y: 0 });
    expect(panBy(view, -5, -5)).toEqual({ scale: 2, x: -1, y: -1 });
  });

  it('does nothing when the whole map is visible', () => {
    expect(panBy(IDENTITY, 0.3, -0.3)).toEqual(IDENTITY);
  });
});

describe('clampView', () => {
  it('brings an out-of-range view back within limits', () => {
    expect(clampView({ scale: 0.2, x: 3, y: -3 })).toEqual(IDENTITY);
    expect(clampView({ scale: 100, x: 1, y: -100 })).toEqual({ scale: MAX_ZOOM, x: 0, y: 1 - MAX_ZOOM });
  });
});
