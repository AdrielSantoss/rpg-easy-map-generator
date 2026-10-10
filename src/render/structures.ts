import { ICON_HEIGHT, type Structure, type StructureKind } from '../structures/model.ts';

const INK = 'rgb(58, 44, 30)';
const PAPER = 'rgb(236, 221, 182)';
const ROOF = 'rgb(164, 84, 58)';
const ROCK = 'rgb(192, 172, 142)';
const SEA_INK = 'rgb(52, 78, 96)';

/** Icons are designed on a small unit grid and enlarged by this when drawn. */
const ICON_SCALE = 1.7;

/** Label font size in cells. */
const LABEL_SIZE: Record<StructureKind, number> = {
  kingdom: 8.5,
  city: 7.5,
  village: 6.5,
  tower: 6,
  port: 6.5,
  ruins: 6,
  dungeon: 6,
};
/** Draws icons and labels on top of an already rendered map. `scale` is pixels per cell. */
export function drawStructures(ctx: CanvasRenderingContext2D, structures: Structure[], scale: number): void {
  ctx.save();
  ctx.scale(scale, scale);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  const ordered = [...structures].sort((a, b) => a.y - b.y);
  for (const s of ordered) {
    clearPatch(ctx, s.x, s.y - ICON_HEIGHT[s.kind] * 0.4, ICON_HEIGHT[s.kind] * 1.1);
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.scale(ICON_SCALE, ICON_SCALE);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.32;
    ICONS[s.kind](ctx, 0, 0);
    ctx.restore();
  }
  // Labels go last so no icon covers a name.
  for (const s of ordered) {
    const size = LABEL_SIZE[s.kind];
    const text = s.kind === 'kingdom' ? s.name.toUpperCase() : s.name;
    ctx.font = `${s.kind === 'kingdom' ? 'bold' : 'italic'} ${size}px Georgia, 'Times New Roman', serif`;
    ctx.strokeStyle = 'rgba(236, 221, 182, 0.85)';
    ctx.lineWidth = 1.8;
    ctx.strokeText(text, s.x, s.y + size + 1.5);
    ctx.fillStyle = INK;
    ctx.fillText(text, s.x, s.y + size + 1.5);
  }
  ctx.restore();
}

/** Fades the terrain icons out under a structure so it stays readable. */
function clearPatch(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
  const fade = ctx.createRadialGradient(x, y, radius * 0.35, x, y, radius);
  fade.addColorStop(0, 'rgba(236, 221, 182, 0.95)');
  fade.addColorStop(1, 'rgba(236, 221, 182, 0)');
  ctx.fillStyle = fade;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

type IconPainter = (ctx: CanvasRenderingContext2D, x: number, y: number) => void;

function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string): void {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);
}

function triangle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  half: number,
  rise: number,
  fill: string,
): void {
  ctx.beginPath();
  ctx.moveTo(x - half, y);
  ctx.lineTo(x, y - rise);
  ctx.lineTo(x + half, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.stroke();
}

/** House with a pitched roof; (x, y) is the middle of its base. */
function house(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  box(ctx, x - w / 2, y - h, w, h, PAPER);
  triangle(ctx, x, y - h, w / 2 + 0.4, w * 0.55, ROOF);
}

/** Row of battlements sitting on the line y, spanning `w` around x. */
function battlements(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, count: number): void {
  const step = w / (count * 2 - 1);
  for (let k = 0; k < count; k++) {
    box(ctx, x - w / 2 + k * 2 * step, y - 0.9, step, 0.9, PAPER);
  }
}

function keepTower(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  box(ctx, x - w / 2, y - h, w, h, PAPER);
  box(ctx, x - w / 2 - 0.4, y - h - 1, w + 0.8, 1, PAPER);
  battlements(ctx, x, y - h - 1, w + 0.8, 3);
}

function doorway(ctx: CanvasRenderingContext2D, x: number, y: number, half: number, h: number): void {
  ctx.beginPath();
  ctx.moveTo(x - half, y);
  ctx.lineTo(x - half, y - h);
  ctx.arc(x, y - h, half, Math.PI, 0);
  ctx.lineTo(x + half, y);
  ctx.closePath();
  ctx.fillStyle = INK;
  ctx.fill();
}

const ICONS: Record<StructureKind, IconPainter> = {
  kingdom(ctx, x, y) {
    // Central keep with a flag, behind the curtain wall and corner towers.
    box(ctx, x - 1.7, y - 8, 3.4, 8, PAPER);
    triangle(ctx, x, y - 8, 2.2, 2.6, ROOF);
    ctx.beginPath();
    ctx.moveTo(x, y - 10.6);
    ctx.lineTo(x, y - 12.8);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y - 12.8);
    ctx.lineTo(x + 2, y - 12.2);
    ctx.lineTo(x, y - 11.6);
    ctx.closePath();
    ctx.fillStyle = ROOF;
    ctx.fill();
    ctx.stroke();

    box(ctx, x - 4.4, y - 3.6, 8.8, 3.6, PAPER);
    battlements(ctx, x, y - 3.6, 8.8, 6);
    keepTower(ctx, x - 5.2, y, 2.6, 5.6);
    keepTower(ctx, x + 5.2, y, 2.6, 5.6);
    doorway(ctx, x, y, 0.9, 1.4);
  },

  city(ctx, x, y) {
    house(ctx, x - 3.4, y - 0.6, 3, 2.4);
    box(ctx, x - 1.1, y - 6, 2.2, 5.4, PAPER);
    triangle(ctx, x, y - 6, 1.5, 2.4, ROOF);
    house(ctx, x + 3.3, y - 0.4, 3.2, 2.6);
    house(ctx, x - 1, y + 0.8, 3, 2.2);
  },

  village(ctx, x, y) {
    house(ctx, x - 1.6, y - 0.4, 2.8, 2.1);
    house(ctx, x + 1.7, y + 0.3, 2.6, 2);
  },

  tower(ctx, x, y) {
    keepTower(ctx, x, y, 3, 7);
    doorway(ctx, x, y, 0.6, 1.1);
    box(ctx, x - 0.3, y - 5, 0.6, 1.1, INK);
  },

  port(ctx, x, y) {
    const cy = y - 4;
    ctx.beginPath();
    ctx.arc(x, cy, 4, 0, Math.PI * 2);
    ctx.fillStyle = PAPER;
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = SEA_INK;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.arc(x, cy - 2.3, 0.6, 0, Math.PI * 2);
    ctx.moveTo(x, cy - 1.7);
    ctx.lineTo(x, cy + 2.6);
    ctx.moveTo(x - 1.3, cy - 0.9);
    ctx.lineTo(x + 1.3, cy - 0.9);
    ctx.moveTo(x + 2.1, cy + 0.6);
    ctx.arc(x, cy + 0.6, 2.1, 0, Math.PI);
    ctx.stroke();
  },

  ruins(ctx, x, y) {
    box(ctx, x - 3.4, y - 4.2, 1.1, 4.2, PAPER);
    box(ctx, x - 3.7, y - 4.9, 1.7, 0.7, PAPER);
    // Broken column: slanted top.
    ctx.beginPath();
    ctx.moveTo(x - 0.6, y);
    ctx.lineTo(x - 0.6, y - 2.6);
    ctx.lineTo(x + 0.5, y - 1.7);
    ctx.lineTo(x + 0.5, y);
    ctx.closePath();
    ctx.fillStyle = PAPER;
    ctx.fill();
    ctx.stroke();
    box(ctx, x + 2.2, y - 3.2, 1.1, 3.2, PAPER);
    ctx.beginPath();
    ctx.moveTo(x - 4.6, y);
    ctx.lineTo(x + 4.4, y);
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.fillRect(x + 1, y - 0.7, 0.6, 0.5);
    ctx.fillRect(x - 2, y - 0.6, 0.5, 0.4);
  },

  dungeon(ctx, x, y) {
    ctx.beginPath();
    ctx.moveTo(x - 4.6, y);
    ctx.bezierCurveTo(x - 3.4, y - 6.6, x + 3.4, y - 6.6, x + 4.6, y);
    ctx.closePath();
    ctx.fillStyle = ROCK;
    ctx.fill();
    ctx.stroke();
    doorway(ctx, x, y, 1.5, 1.6);
  },
};
