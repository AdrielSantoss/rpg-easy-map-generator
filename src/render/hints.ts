import { HINT_RADIUS, type TerrainHint, type TerrainKind } from '../generator/hints.ts';

const COLOR: Record<TerrainKind, string> = {
  mountains: 'rgb(134, 104, 78)',
  forest: 'rgb(84, 128, 62)',
  desert: 'rgb(214, 170, 72)',
  swamp: 'rgb(84, 112, 104)',
  tundra: 'rgb(170, 200, 222)',
  plains: 'rgb(168, 190, 96)',
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
    ctx.strokeStyle = COLOR[hint.kind];
    ctx.lineWidth = 0.6;
    ctx.setLineDash([2.5, 2.5]);
    ctx.beginPath();
    ctx.arc(hint.x, hint.y, HINT_RADIUS * 0.75, 0, Math.PI * 2);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(hint.x, hint.y, HINT_MARKER_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = COLOR[hint.kind];
    ctx.fill();
    ctx.strokeStyle = 'rgb(255, 250, 235)';
    ctx.lineWidth = 0.9;
    ctx.stroke();
  }
  ctx.restore();
}
