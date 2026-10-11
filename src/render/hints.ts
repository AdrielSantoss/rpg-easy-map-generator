import { HINT_RADIUS, type TerrainHint, type TerrainKind } from '../generator/hints.ts';

/** The color that stands for each terrain in the editing UI. */
export const TERRAIN_COLOR: Record<TerrainKind, string> = {
  mountains: 'rgb(166, 130, 100)',
  forest: 'rgb(92, 144, 70)',
  desert: 'rgb(222, 178, 78)',
  swamp: 'rgb(88, 138, 126)',
  tundra: 'rgb(178, 208, 228)',
  plains: 'rgb(176, 198, 104)',
};

/** Marker radius in cells. */
const HINT_MARKER_RADIUS = 5;

/**
 * Editing aid, not part of the map: shows where each terrain hint sits and
 * roughly how far it reaches. `scale` is pixels per cell.
 */
export function drawHintMarkers(
  ctx: CanvasRenderingContext2D,
  hints: readonly TerrainHint[],
  scale: number,
): void {
  ctx.save();
  ctx.scale(scale, scale);
  for (const hint of hints) {
    ctx.strokeStyle = TERRAIN_COLOR[hint.kind];
    ctx.lineWidth = 0.6;
    ctx.setLineDash([2.5, 2.5]);
    ctx.beginPath();
    ctx.arc(hint.x, hint.y, HINT_RADIUS * 0.75, 0, Math.PI * 2);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(hint.x, hint.y, HINT_MARKER_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = TERRAIN_COLOR[hint.kind];
    ctx.fill();
    ctx.strokeStyle = 'rgb(255, 250, 235)';
    ctx.lineWidth = 0.9;
    ctx.stroke();
  }
  ctx.restore();
}
