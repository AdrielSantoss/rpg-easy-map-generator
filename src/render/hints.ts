import { hintCoreRadius, type BrushKind, type TerrainHint } from '../generator/hints.ts';

/** The color that stands for each terrain, and for snow, in the editing UI. */
export const TERRAIN_COLOR: Record<BrushKind, string> = {
  mountains: 'rgb(166, 130, 100)',
  forest: 'rgb(92, 144, 70)',
  desert: 'rgb(222, 178, 78)',
  swamp: 'rgb(88, 138, 126)',
  plains: 'rgb(176, 198, 104)',
  snow: 'rgb(178, 208, 228)',
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
    const radius = hintCoreRadius(dab);
    ctx.moveTo(dab.x + radius, dab.y);
    ctx.arc(dab.x, dab.y, radius, 0, Math.PI * 2);
  }
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = TERRAIN_COLOR[stroke[0].kind];
  ctx.fill();
  ctx.restore();
}
