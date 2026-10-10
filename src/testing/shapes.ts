/** Helpers that build sketch masks for tests, as if the user had drawn them. */

export interface RingOptions {
  /** Leaves an opening this many cells tall on the right side of the ring. */
  gap?: number;
}

/** Draws a circle outline about one cell thick onto `wall`. */
export function drawRing(
  wall: Uint8Array,
  w: number,
  cx: number,
  cy: number,
  radius: number,
  { gap = 0 }: RingOptions = {},
): void {
  const h = wall.length / w;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (Math.abs(Math.hypot(x - cx, y - cy) - radius) > 0.8) continue;
      if (gap > 0 && x > cx && Math.abs(y - cy) < gap / 2) continue;
      wall[y * w + x] = 1;
    }
  }
}

/** Mask with a single closed ring in the middle of a w×h grid. */
export function ringSketch(w: number, h: number, radius: number, options?: RingOptions): Uint8Array {
  const wall = new Uint8Array(w * h);
  drawRing(wall, w, w / 2, h / 2, radius, options);
  return wall;
}
