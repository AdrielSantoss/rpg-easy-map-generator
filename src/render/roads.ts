import type { RoadPath } from '../structures/roads.ts';

const ROAD = 'rgb(118, 76, 42)';
const PAPER = 'rgba(236, 221, 182, 0.8)';
const INK = 'rgb(58, 44, 30)';

/** Draws roads as dashed tracks, with a small bridge wherever one crosses a river. */
export function drawRoads(ctx: CanvasRenderingContext2D, roads: readonly RoadPath[], scale: number): void {
  ctx.save();
  ctx.scale(scale, scale);
  ctx.lineJoin = 'round';

  const trace = ({ points }: RoadPath) => {
    ctx.beginPath();
    ctx.moveTo(points[0], points[1]);
    for (let p = 2; p < points.length; p += 2) ctx.lineTo(points[p], points[p + 1]);
  };

  // A pale band under every road first, so tracks stay readable over forest and
  // do not get cut where two roads meet.
  ctx.lineCap = 'round';
  ctx.strokeStyle = PAPER;
  ctx.lineWidth = 2;
  for (const road of roads) {
    trace(road);
    ctx.stroke();
  }

  ctx.lineCap = 'butt';
  ctx.strokeStyle = ROAD;
  ctx.lineWidth = 0.75;
  ctx.setLineDash([2.4, 1.4]);
  for (const road of roads) {
    trace(road);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  for (const road of roads) {
    for (const bridge of road.bridges) {
      ctx.save();
      ctx.translate(bridge.x, bridge.y);
      ctx.rotate(bridge.angle);
      ctx.fillStyle = 'rgb(236, 221, 182)';
      ctx.fillRect(-2, -0.9, 4, 1.8);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 0.4;
      ctx.beginPath();
      // Two rails, splayed at the ends like a drawn bridge.
      for (const side of [-1, 1]) {
        ctx.moveTo(-2.6, side * 1.5);
        ctx.lineTo(-2, side * 0.9);
        ctx.lineTo(2, side * 0.9);
        ctx.lineTo(2.6, side * 1.5);
      }
      ctx.stroke();
      ctx.restore();
    }
  }
  ctx.restore();
}
