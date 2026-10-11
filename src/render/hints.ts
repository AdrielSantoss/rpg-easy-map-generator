import { HINT_CORE_RADIUS, type TerrainHint, type TerrainKind } from '../generator/hints.ts';

/** The color that stands for each terrain in the editing UI. */
export const TERRAIN_COLOR: Record<TerrainKind, string> = {
  mountains: 'rgb(166, 130, 100)',
  forest: 'rgb(92, 144, 70)',
  desert: 'rgb(222, 178, 78)',
  swamp: 'rgb(88, 138, 126)',
  tundra: 'rgb(178, 208, 228)',
  plains: 'rgb(176, 198, 104)',
};

/**
 * Tints the ground a brush stroke has passed over while it is still being
 * dragged, before the map is rebuilt. `scale` is pixels per cell.
 */
export function drawBrushTrail(
  ctx: CanvasRenderingContext2D,
  stroke: readonly TerrainHint[],
  scale: number,
): void {
  ctx.save();
  ctx.scale(scale, scale);
  // One path for the whole stroke, so overlapping dabs do not add up to a darker tint.
  ctx.beginPath();
  for (const dab of stroke) {
    ctx.moveTo(dab.x + HINT_CORE_RADIUS, dab.y);
    ctx.arc(dab.x, dab.y, HINT_CORE_RADIUS, 0, Math.PI * 2);
  }
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = TERRAIN_COLOR[stroke[0].kind];
  ctx.fill();
  ctx.restore();
}
