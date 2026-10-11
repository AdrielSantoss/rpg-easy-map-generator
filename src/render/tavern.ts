import { seededRng, type Rng } from '../generator/rng.ts';
import {
  roomMap,
  type Furniture,
  type Opening,
  type Room,
  type RoomKind,
  type Tavern,
} from '../tavern/generate.ts';

export interface TavernView {
  /** Canvas pixels per 5-foot square. Virtual tabletops commonly expect 70. */
  squarePx: number;
  /** Draw the battle grid. */
  grid: boolean;
  /** Write the name of each room. */
  labels: boolean;
}

const INK = '#33271c';
const PAPER = '#dccdaa';
const WOOD = '#8b5e34';
const WOOD_DARK = '#5e3d20';
const WOOD_LIGHT = '#b58a56';
const SEAT = '#7a5230';

const ROOM_LABEL: Record<RoomKind, string> = {
  common: 'Salão',
  kitchen: 'Cozinha',
  storage: 'Despensa',
  guest: 'Quarto',
};

/** Furniture is painted in this order, so seats tuck under tables and nothing hides under a rug. */
const LAYER: Partial<Record<Furniture['kind'], number>> = {
  rug: 0,
  stage: 0,
  stairs: 0,
  chair: 1,
  stool: 1,
  bench: 1,
};

/**
 * Paints a tavern as a top-down battle map on a 5-foot grid, in the same aged
 * paper style as the world map. Everything is drawn in squares; `view.squarePx`
 * sets how many pixels a square gets.
 */
export function renderTavern(canvas: HTMLCanvasElement, tavern: Tavern, view: TavernView): void {
  canvas.width = tavern.w * view.squarePx;
  canvas.height = tavern.h * view.squarePx;
  const ctx = canvas.getContext('2d')!;
  const rng = seededRng(`${tavern.seed}:paint`);
  ctx.save();
  ctx.scale(view.squarePx, view.squarePx);
  ctx.lineJoin = 'round';

  paintGround(ctx, tavern, rng);
  for (const room of tavern.rooms) paintFloor(ctx, room, rng);
  paintFireGlow(ctx, tavern);
  if (view.grid) paintGrid(ctx, tavern);

  const pieces = [...tavern.furniture].sort((a, b) => (LAYER[a.kind] ?? 2) - (LAYER[b.kind] ?? 2));
  for (const piece of pieces) PAINTERS[piece.kind](ctx, piece, rng);

  paintWalls(ctx, tavern);
  for (const window of tavern.windows) paintWindow(ctx, window);
  for (const door of tavern.doors) paintDoor(ctx, door);
  if (view.labels) paintLabels(ctx, tavern);
  paintTitle(ctx, tavern);
  ctx.restore();
}

function paintGround(ctx: CanvasRenderingContext2D, tavern: Tavern, rng: Rng): void {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, tavern.w, tavern.h);
  // Uneven staining, as on old paper.
  for (let k = 0; k < 46; k++) {
    const x = rng() * tavern.w;
    const y = rng() * tavern.h;
    const radius = 1.5 + rng() * 4;
    const stain = ctx.createRadialGradient(x, y, 0, x, y, radius);
    stain.addColorStop(0, rng() < 0.5 ? 'rgba(120, 92, 52, 0.09)' : 'rgba(255, 246, 220, 0.1)');
    stain.addColorStop(1, 'rgba(120, 92, 52, 0)');
    ctx.fillStyle = stain;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  // A worn path leading up to the front door.
  const { entrance } = tavern;
  ctx.fillStyle = 'rgba(150, 120, 78, 0.45)';
  ctx.fillRect(entrance.x - 0.15, entrance.y, entrance.length + 0.3, tavern.h - entrance.y);
  ctx.fillStyle = 'rgba(96, 74, 46, 0.5)';
  for (let k = 0; k < 16; k++) {
    ctx.beginPath();
    ctx.arc(
      entrance.x + rng() * entrance.length,
      entrance.y + 0.15 + rng() * 0.8,
      0.03 + rng() * 0.04,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
}

/** A base color with each channel nudged by up to `spread`, for boards and tiles that are not all alike. */
function tint([r, g, b]: readonly [number, number, number], spread: number, rng: Rng): string {
  const d = (rng() - 0.5) * 2 * spread;
  return `rgb(${Math.round(r + d)}, ${Math.round(g + d)}, ${Math.round(b + d * 0.8)})`;
}

function paintFloor(ctx: CanvasRenderingContext2D, room: Room, rng: Rng): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(room.x, room.y, room.w, room.h);
  ctx.clip();

  if (room.kind === 'kitchen') {
    // Flagstones.
    const size = 0.5;
    for (let y = room.y; y < room.y + room.h; y += size) {
      for (let x = room.x; x < room.x + room.w; x += size) {
        ctx.fillStyle = tint([168, 164, 150], 9, rng);
        ctx.fillRect(x, y, size, size);
      }
    }
    ctx.strokeStyle = 'rgba(70, 64, 54, 0.45)';
    ctx.lineWidth = 0.025;
    ctx.beginPath();
    for (let x = room.x; x <= room.x + room.w; x += size) {
      ctx.moveTo(x, room.y);
      ctx.lineTo(x, room.y + room.h);
    }
    for (let y = room.y; y <= room.y + room.h; y += size) {
      ctx.moveTo(room.x, y);
      ctx.lineTo(room.x + room.w, y);
    }
    ctx.stroke();
  } else {
    // Floorboards, running across the room, each a slightly different shade and cut to length.
    const base: readonly [number, number, number] =
      room.kind === 'storage' ? [146, 112, 74] : room.kind === 'guest' ? [186, 148, 98] : [176, 138, 90];
    const upright = room.kind === 'guest';
    const board = 1 / 3;
    const across = upright ? room.w : room.h;
    const along = upright ? room.h : room.w;
    ctx.strokeStyle = 'rgba(64, 42, 20, 0.4)';
    ctx.lineWidth = 0.02;
    for (let k = 0; k * board < across; k++) {
      let from = 0;
      while (from < along) {
        const length = Math.min(along - from, 1.5 + rng() * 3.5);
        ctx.fillStyle = tint(base, 8, rng);
        if (upright) {
          ctx.fillRect(room.x + k * board, room.y + from, board, length);
          ctx.strokeRect(room.x + k * board, room.y + from, board, length);
        } else {
          ctx.fillRect(room.x + from, room.y + k * board, length, board);
          ctx.strokeRect(room.x + from, room.y + k * board, length, board);
        }
        from += length;
      }
    }
  }
  // Shade gathering along the walls.
  ctx.strokeStyle = 'rgba(40, 26, 12, 0.16)';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(room.x, room.y, room.w, room.h);
  ctx.restore();
}

function paintFireGlow(ctx: CanvasRenderingContext2D, tavern: Tavern): void {
  for (const piece of tavern.furniture) {
    if (piece.kind !== 'fireplace') continue;
    const x = piece.facing === 'w' ? piece.x : piece.x + piece.w;
    const y = piece.y + piece.h / 2;
    const glow = ctx.createRadialGradient(x, y, 0.2, x, y, 3.6);
    glow.addColorStop(0, 'rgba(255, 170, 60, 0.34)');
    glow.addColorStop(1, 'rgba(255, 170, 60, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 3.6, y - 3.6, 7.2, 7.2);
  }
}

function paintGrid(ctx: CanvasRenderingContext2D, tavern: Tavern): void {
  ctx.strokeStyle = 'rgba(46, 32, 18, 0.3)';
  ctx.lineWidth = 0.022;
  ctx.beginPath();
  for (let x = 0; x <= tavern.w; x++) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, tavern.h);
  }
  for (let y = 0; y <= tavern.h; y++) {
    ctx.moveTo(0, y);
    ctx.lineTo(tavern.w, y);
  }
  ctx.stroke();
}

function paintWalls(ctx: CanvasRenderingContext2D, tavern: Tavern): void {
  const { w, h } = tavern;
  const rooms = roomMap(tavern);
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : rooms[y * w + x]);
  const hasDoor = (x: number, y: number, dir: Opening['dir']) =>
    tavern.doors.some(
      (door) =>
        door.dir === dir &&
        (dir === 'h'
          ? door.y === y && x >= door.x && x < door.x + door.length
          : door.x === x && y >= door.y && y < door.y + door.length),
    );

  ctx.strokeStyle = INK;
  ctx.lineCap = 'square';
  // Outer walls are stone and thicker; the partitions inside are timber.
  for (const outer of [true, false]) {
    ctx.lineWidth = outer ? 0.3 : 0.18;
    ctx.beginPath();
    for (let y = 0; y <= h; y++) {
      for (let x = 0; x <= w; x++) {
        const here = at(x, y);
        const above = at(x, y - 1);
        const before = at(x - 1, y);
        if (here !== above && (here === -1 || above === -1) === outer && !hasDoor(x, y, 'h')) {
          ctx.moveTo(x, y);
          ctx.lineTo(x + 1, y);
        }
        if (here !== before && (here === -1 || before === -1) === outer && !hasDoor(x, y, 'v')) {
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + 1);
        }
      }
    }
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
}

/** Runs `draw` with the opening laid out along the x axis, starting at the origin. */
function alongOpening(ctx: CanvasRenderingContext2D, opening: Opening, draw: () => void): void {
  ctx.save();
  ctx.translate(opening.x, opening.y);
  if (opening.dir === 'v') ctx.rotate(Math.PI / 2);
  draw();
  ctx.restore();
}

function paintDoor(ctx: CanvasRenderingContext2D, door: Opening): void {
  alongOpening(ctx, door, () => {
    // The threshold, then one leaf per square of width.
    ctx.fillStyle = '#a58556';
    ctx.fillRect(0, -0.15, door.length, 0.3);
    ctx.lineWidth = 0.04;
    ctx.strokeStyle = INK;
    for (let leaf = 0; leaf < door.length; leaf++) {
      ctx.fillStyle = '#8a5a2e';
      ctx.fillRect(leaf + 0.08, -0.09, 0.84, 0.18);
      ctx.strokeRect(leaf + 0.08, -0.09, 0.84, 0.18);
      // Handle, toward the middle of a double door.
      ctx.fillStyle = '#d6b76a';
      ctx.beginPath();
      ctx.arc(door.length === 2 ? (leaf === 0 ? 0.82 : 1.18) : 0.78, 0, 0.045, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function paintWindow(ctx: CanvasRenderingContext2D, window: Opening): void {
  alongOpening(ctx, window, () => {
    ctx.fillStyle = '#cfe2e4';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.035;
    ctx.fillRect(0.18, -0.09, 0.64, 0.18);
    ctx.strokeRect(0.18, -0.09, 0.64, 0.18);
    ctx.beginPath();
    ctx.moveTo(0.5, -0.09);
    ctx.lineTo(0.5, 0.09);
    ctx.stroke();
  });
}

function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  font: string,
  color = INK,
): void {
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 0.12;
  ctx.strokeStyle = 'rgba(232, 218, 184, 0.85)';
  ctx.strokeText(value, x, y);
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
}

/**
 * Where to write a room's name: the middle of a stretch of at least three
 * squares with no furniture standing on them, looking along the front wall
 * first, then the back wall, then the middle of the room.
 */
function labelSpot(tavern: Tavern, room: Room): [number, number] {
  const center = room.x + room.w / 2;
  for (const y of [room.y + room.h - 1, room.y, room.y + Math.floor(room.h / 2)]) {
    let best: [number, number] | null = null;
    let start = room.x;
    for (let x = room.x; x <= room.x + room.w; x++) {
      if (x < room.x + room.w && !tavern.blocked[y * tavern.w + x]) continue;
      // A run of free squares ends here; keep the one closest to the middle of the room.
      const middle = (start + x) / 2;
      if (x - start >= 3 && (!best || Math.abs(middle - center) < Math.abs(best[0] - center))) {
        best = [middle, y + 0.5];
      }
      start = x + 1;
    }
    if (best) return best;
  }
  return [center, room.y + room.h / 2];
}

function paintLabels(ctx: CanvasRenderingContext2D, tavern: Tavern): void {
  const font = "italic bold 0.36px Georgia, 'Times New Roman', serif";
  for (const room of tavern.rooms) {
    if (room.kind === 'common') {
      // Beside the front door, in the aisle along the front wall, which tables stay out of.
      text(ctx, ROOM_LABEL.common, tavern.entrance.x - 1.3, room.y + room.h - 0.5, font);
    } else {
      text(ctx, ROOM_LABEL[room.kind], ...labelSpot(tavern, room), font);
    }
  }
}

function paintTitle(ctx: CanvasRenderingContext2D, tavern: Tavern): void {
  text(ctx, tavern.name, tavern.w / 2, 0.5, "bold 0.5px Georgia, 'Times New Roman', serif");
  ctx.font = "italic 0.26px Georgia, 'Times New Roman', serif";
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(51, 39, 28, 0.8)';
  ctx.fillText('1 quadrado = 1,5 m (5 pés)', tavern.w - 0.25, tavern.h - 0.5);
}

type Painter = (ctx: CanvasRenderingContext2D, piece: Furniture, rng: Rng) => void;

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
}

function outline(ctx: CanvasRenderingContext2D, fill: string, width = 0.045): void {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = width;
  ctx.stroke();
}

/** Mugs and plates left on a tabletop, somewhere inside the given box. */
function tableware(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  count: number,
  rng: Rng,
): void {
  for (let k = 0; k < count; k++) {
    const plate = rng() < 0.4;
    ctx.beginPath();
    ctx.arc(x + rng() * w, y + rng() * h, plate ? 0.11 : 0.065, 0, Math.PI * 2);
    ctx.fillStyle = plate ? '#d8cdb0' : '#c9a25a';
    ctx.fill();
    ctx.strokeStyle = 'rgba(51, 39, 28, 0.8)';
    ctx.lineWidth = 0.025;
    ctx.stroke();
  }
}

const seat: Painter = (ctx, p) => {
  roundedRect(ctx, p.x, p.y, p.w, p.h, 0.1);
  outline(ctx, SEAT, 0.035);
};

const PAINTERS: Record<Furniture['kind'], Painter> = {
  chair: seat,
  bench: seat,

  stool(ctx, p) {
    ctx.beginPath();
    ctx.arc(p.x + p.w / 2, p.y + p.h / 2, p.w / 2, 0, Math.PI * 2);
    outline(ctx, SEAT, 0.035);
  },

  'table-round'(ctx, p, rng) {
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2;
    const r = Math.min(p.w, p.h) / 2 - 0.06;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    outline(ctx, WOOD);
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.78, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(60, 38, 18, 0.35)';
    ctx.lineWidth = 0.025;
    ctx.stroke();
    tableware(ctx, cx - r * 0.5, cy - r * 0.5, r, r, r > 0.5 ? 3 : 1, rng);
  },

  'table-long'(ctx, p, rng) {
    roundedRect(ctx, p.x, p.y, p.w, p.h, 0.08);
    outline(ctx, WOOD);
    ctx.strokeStyle = 'rgba(60, 38, 18, 0.35)';
    ctx.lineWidth = 0.025;
    ctx.beginPath();
    for (const share of [1 / 3, 2 / 3]) {
      ctx.moveTo(p.x + 0.06, p.y + p.h * share);
      ctx.lineTo(p.x + p.w - 0.06, p.y + p.h * share);
    }
    ctx.stroke();
    tableware(ctx, p.x + 0.25, p.y + 0.2, p.w - 0.5, p.h - 0.4, 5, rng);
  },

  bar(ctx, p, rng) {
    roundedRect(ctx, p.x + 0.04, p.y + 0.14, p.w - 0.08, p.h - 0.28, 0.08);
    outline(ctx, '#6e4626', 0.05);
    // The polished edge on the customers' side.
    ctx.fillStyle = 'rgba(214, 170, 110, 0.5)';
    ctx.fillRect(p.x + 0.1, p.y + p.h - 0.3, p.w - 0.2, 0.1);
    tableware(ctx, p.x + 0.3, p.y + 0.3, p.w - 0.6, p.h - 0.62, Math.round(p.w * 0.8), rng);
  },

  shelf(ctx, p, rng) {
    ctx.fillStyle = WOOD_DARK;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.arc(p.x + 0.13 + k * 0.21, p.y + p.h / 2, 0.075, 0, Math.PI * 2);
      ctx.fillStyle = ['#5f7f4f', '#b07a2a', '#7a3b2e', '#4f6a7a'][Math.floor(rng() * 4)];
      ctx.fill();
    }
  },

  fireplace(ctx, p) {
    ctx.beginPath();
    ctx.rect(p.x, p.y, p.w, p.h);
    outline(ctx, '#8d897e', 0.06);
    // The firebox opens toward the room.
    const boxX = p.facing === 'w' ? p.x : p.x + 0.3;
    ctx.fillStyle = '#261a12';
    ctx.fillRect(boxX, p.y + 0.3, p.w - 0.3, p.h - 0.6);
    const cx = boxX + (p.w - 0.3) / 2;
    const cy = p.y + p.h / 2;
    ctx.strokeStyle = '#5a3a1e';
    ctx.lineWidth = 0.1;
    ctx.beginPath();
    ctx.moveTo(cx - 0.08, cy - 0.42);
    ctx.lineTo(cx + 0.06, cy + 0.4);
    ctx.moveTo(cx + 0.12, cy - 0.36);
    ctx.lineTo(cx - 0.1, cy + 0.34);
    ctx.stroke();
    const fire = ctx.createRadialGradient(cx, cy, 0, cx, cy, 0.5);
    fire.addColorStop(0, 'rgba(255, 236, 150, 0.95)');
    fire.addColorStop(0.5, 'rgba(250, 150, 40, 0.8)');
    fire.addColorStop(1, 'rgba(220, 80, 20, 0)');
    ctx.fillStyle = fire;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 0.3, 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  },

  stairs(ctx, p) {
    ctx.beginPath();
    ctx.rect(p.x + 0.06, p.y + 0.06, p.w - 0.12, p.h - 0.12);
    outline(ctx, WOOD_LIGHT, 0.05);
    // Steps, darker toward the top where they climb out of sight.
    const steps = Math.round(p.h / 0.3);
    for (let k = 0; k < steps; k++) {
      const y = p.y + 0.06 + ((p.h - 0.12) * k) / steps;
      ctx.fillStyle = `rgba(50, 32, 16, ${0.34 * (1 - k / steps)})`;
      ctx.fillRect(p.x + 0.06, y, p.w - 0.12, (p.h - 0.12) / steps);
      ctx.strokeStyle = 'rgba(51, 39, 28, 0.7)';
      ctx.lineWidth = 0.025;
      ctx.beginPath();
      ctx.moveTo(p.x + 0.06, y);
      ctx.lineTo(p.x + p.w - 0.06, y);
      ctx.stroke();
    }
    // An arrow pointing up the flight.
    const cx = p.x + p.w / 2;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.05;
    ctx.beginPath();
    ctx.moveTo(cx, p.y + p.h - 0.4);
    ctx.lineTo(cx, p.y + 0.4);
    ctx.moveTo(cx - 0.2, p.y + 0.65);
    ctx.lineTo(cx, p.y + 0.4);
    ctx.lineTo(cx + 0.2, p.y + 0.65);
    ctx.stroke();
  },

  stage(ctx, p) {
    ctx.beginPath();
    ctx.rect(p.x + 0.08, p.y + 0.08, p.w - 0.16, p.h - 0.16);
    outline(ctx, '#a67c4b', 0.07);
    ctx.strokeStyle = 'rgba(60, 38, 18, 0.35)';
    ctx.lineWidth = 0.025;
    ctx.beginPath();
    for (let y = p.y + 0.4; y < p.y + p.h - 0.2; y += 0.3) {
      ctx.moveTo(p.x + 0.12, y);
      ctx.lineTo(p.x + p.w - 0.12, y);
    }
    ctx.stroke();
  },

  stove(ctx, p) {
    roundedRect(ctx, p.x + 0.06, p.y + 0.08, p.w - 0.12, p.h - 0.16, 0.06);
    outline(ctx, '#3f3a36', 0.05);
    for (const share of [0.28, 0.72]) {
      const cx = p.x + p.w * share;
      const cy = p.y + p.h / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 0.24, 0, Math.PI * 2);
      ctx.fillStyle = '#1f1b19';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, 0.14, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(240, 120, 40, 0.75)';
      ctx.fill();
    }
  },

  counter(ctx, p, rng) {
    roundedRect(ctx, p.x + 0.06, p.y + 0.12, p.w - 0.12, p.h - 0.24, 0.06);
    outline(ctx, WOOD_LIGHT);
    tableware(ctx, p.x + 0.3, p.y + 0.32, p.w - 0.6, p.h - 0.64, 3, rng);
    // A loaf of bread.
    ctx.beginPath();
    ctx.ellipse(p.x + p.w * 0.3, p.y + p.h * 0.5, 0.2, 0.11, 0.4, 0, Math.PI * 2);
    ctx.fillStyle = '#c7964e';
    ctx.fill();
  },

  washtub(ctx, p) {
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 0.4, 0, Math.PI * 2);
    outline(ctx, WOOD);
    ctx.beginPath();
    ctx.arc(cx, cy, 0.29, 0, Math.PI * 2);
    ctx.fillStyle = '#8fb2bd';
    ctx.fill();
  },

  barrel(ctx, p) {
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 0.39, 0, Math.PI * 2);
    outline(ctx, WOOD);
    ctx.strokeStyle = 'rgba(51, 39, 28, 0.55)';
    ctx.lineWidth = 0.03;
    ctx.beginPath();
    ctx.arc(cx, cy, 0.29, 0, Math.PI * 2);
    for (const offset of [-0.13, 0, 0.13]) {
      const half = Math.sqrt(0.29 * 0.29 - offset * offset);
      ctx.moveTo(cx + offset, cy - half);
      ctx.lineTo(cx + offset, cy + half);
    }
    ctx.stroke();
  },

  crate(ctx, p) {
    ctx.beginPath();
    ctx.rect(p.x + 0.13, p.y + 0.13, p.w - 0.26, p.h - 0.26);
    outline(ctx, '#9c764a');
    ctx.strokeStyle = 'rgba(51, 39, 28, 0.6)';
    ctx.lineWidth = 0.03;
    ctx.beginPath();
    ctx.moveTo(p.x + 0.13, p.y + 0.13);
    ctx.lineTo(p.x + p.w - 0.13, p.y + p.h - 0.13);
    ctx.moveTo(p.x + p.w - 0.13, p.y + 0.13);
    ctx.lineTo(p.x + 0.13, p.y + p.h - 0.13);
    ctx.stroke();
  },

  bed(ctx, p, rng) {
    roundedRect(ctx, p.x + 0.08, p.y + 0.06, p.w - 0.16, p.h - 0.12, 0.08);
    outline(ctx, WOOD_DARK);
    // Blanket over most of it, a pillow at the head.
    roundedRect(ctx, p.x + 0.14, p.y + 0.62, p.w - 0.28, p.h - 0.74, 0.06);
    ctx.fillStyle = ['#8c3b34', '#3f5f7a', '#54733f', '#7a5a8c'][Math.floor(rng() * 4)];
    ctx.fill();
    roundedRect(ctx, p.x + 0.2, p.y + 0.16, p.w - 0.4, 0.36, 0.08);
    outline(ctx, '#e6dcc4', 0.03);
  },

  chest(ctx, p) {
    roundedRect(ctx, p.x + 0.14, p.y + 0.24, p.w - 0.28, p.h - 0.48, 0.06);
    outline(ctx, '#6e4626');
    ctx.fillStyle = '#c9a25a';
    ctx.fillRect(p.x + p.w / 2 - 0.05, p.y + 0.24, 0.1, p.h - 0.48);
  },

  rug(ctx, p) {
    roundedRect(ctx, p.x, p.y, p.w, p.h, 0.1);
    ctx.fillStyle = 'rgba(140, 59, 52, 0.72)';
    ctx.fill();
    roundedRect(ctx, p.x + 0.12, p.y + 0.12, p.w - 0.24, p.h - 0.24, 0.06);
    ctx.strokeStyle = 'rgba(222, 184, 110, 0.85)';
    ctx.lineWidth = 0.04;
    ctx.stroke();
  },
};
