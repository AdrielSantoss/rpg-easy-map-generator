import { seededRng, type Rng } from '../generator/rng.ts';
import {
  roomMap,
  type Opening,
  type Room,
  type RoomKind,
  type Tavern,
  type TavernQuality,
} from '../tavern/generate.ts';
import { paintFurniture } from './tavern-furniture.ts';

export interface TavernView {
  /** Canvas pixels per 5-foot square. Virtual tabletops commonly expect 70. */
  squarePx: number;
  /** Draw the battle grid. */
  grid: boolean;
  /** Write the name of each room. */
  labels: boolean;
  /** Dim the rooms and let the fire, candles and windows light them. */
  lighting: boolean;
}

type Ctx = CanvasRenderingContext2D;

const INK = '#2e2218';
const PAPER = '#dccdaa';

const ROOM_LABEL: Record<RoomKind, string> = {
  common: 'Salão',
  kitchen: 'Cozinha',
  storage: 'Despensa',
  guest: 'Quarto',
  living: 'Sala',
  forge: 'Oficina',
  hall: 'Grande salão',
  armory: 'Arsenal',
  study: 'Gabinete',
  sanctuary: 'Nave',
};

/** Rooms paved with flagstones rather than floored with boards. */
const STONE_FLOOR: readonly RoomKind[] = ['kitchen', 'forge', 'hall', 'armory', 'sanctuary'];

/**
 * How dark an unlit corner gets with lighting on (0 = no dimming, 1 = black).
 * A poor house is gloomy; a rich one burns candles freely.
 */
const DARKNESS: Record<TavernQuality, number> = { poor: 0.54, medium: 0.42, rich: 0.3 };

/**
 * Floorboard color for the common room, and how much boards differ from one
 * another: grey and patchy where nobody looks after them, warm and even where
 * they are waxed.
 */
const BOARDS: Record<TavernQuality, { color: readonly [number, number, number]; spread: number }> = {
  poor: { color: [146, 120, 90], spread: 20 },
  medium: { color: [172, 132, 84], spread: 13 },
  rich: { color: [188, 136, 76], spread: 8 },
};

/**
 * Paints a tavern as a top-down battle map on a 5-foot grid, on the same aged
 * paper as the world map. Everything is drawn in squares; `view.squarePx` sets
 * how many pixels a square gets.
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
  for (const room of tavern.rooms) paintFloor(ctx, room, tavern.quality, rng);
  paintFurniture(ctx, tavern.furniture, rng);
  if (view.lighting) paintLighting(ctx, tavern, view.squarePx);
  // The grid goes over the furniture and the lighting, so squares can be counted anywhere.
  if (view.grid) paintGrid(ctx, tavern);
  paintWalls(ctx, tavern, rng);
  for (const window of tavern.windows) paintWindow(ctx, window);
  for (const door of tavern.doors) paintDoor(ctx, door);
  if (view.labels) paintLabels(ctx, tavern);
  paintTitle(ctx, tavern);
  ctx.restore();
}

/** The rectangle the building stands on. */
function footprint(tavern: Tavern): [number, number, number, number] {
  const x = Math.min(...tavern.rooms.map((r) => r.x));
  const y = Math.min(...tavern.rooms.map((r) => r.y));
  const right = Math.max(...tavern.rooms.map((r) => r.x + r.w));
  const bottom = Math.max(...tavern.rooms.map((r) => r.y + r.h));
  return [x, y, right - x, bottom - y];
}

function paintGround(ctx: Ctx, tavern: Tavern, rng: Rng): void {
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
  // A worn path leading up to the front door, with pebbles.
  const { entrance } = tavern;
  const path = ctx.createLinearGradient(entrance.x - 0.4, 0, entrance.x + entrance.length + 0.4, 0);
  path.addColorStop(0, 'rgba(150, 120, 78, 0)');
  path.addColorStop(0.2, 'rgba(150, 120, 78, 0.5)');
  path.addColorStop(0.8, 'rgba(150, 120, 78, 0.5)');
  path.addColorStop(1, 'rgba(150, 120, 78, 0)');
  ctx.fillStyle = path;
  ctx.fillRect(entrance.x - 0.4, entrance.y, entrance.length + 0.8, tavern.h - entrance.y);
  for (let k = 0; k < 22; k++) {
    ctx.beginPath();
    ctx.ellipse(
      entrance.x - 0.1 + rng() * (entrance.length + 0.2),
      entrance.y + 0.2 + rng() * 0.75,
      0.03 + rng() * 0.05,
      0.025 + rng() * 0.03,
      rng() * 3,
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = rng() < 0.5 ? 'rgba(96, 74, 46, 0.55)' : 'rgba(176, 160, 130, 0.8)';
    ctx.fill();
  }
  // The building's shadow on the ground around it.
  const px = ctx.getTransform().a;
  ctx.save();
  ctx.shadowColor = 'rgba(30, 18, 6, 0.55)';
  ctx.shadowBlur = 0.5 * px;
  ctx.shadowOffsetX = 0.1 * px;
  ctx.shadowOffsetY = 0.14 * px;
  ctx.fillStyle = '#6a4a28';
  ctx.fillRect(...footprint(tavern));
  ctx.restore();
}

/** A base color with each channel nudged by up to `spread`, for boards and stones that are not all alike. */
function tint([r, g, b]: readonly [number, number, number], spread: number, rng: Rng): string {
  const d = (rng() - 0.5) * 2 * spread;
  return `rgb(${Math.round(r + d)}, ${Math.round(g + d)}, ${Math.round(b + d * 0.8)})`;
}

function paintFloor(ctx: Ctx, room: Room, quality: TavernQuality, rng: Rng): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(room.x, room.y, room.w, room.h);
  ctx.clip();

  if (STONE_FLOOR.includes(room.kind)) {
    // Flagstones of uneven widths, in staggered courses.
    ctx.fillStyle = '#5c574d';
    ctx.fillRect(room.x, room.y, room.w, room.h);
    const course = 0.5;
    for (let row = 0; row * course < room.h; row++) {
      let x = room.x - (row % 2 ? 0.35 : 0);
      while (x < room.x + room.w) {
        const width = 0.55 + rng() * 0.6;
        ctx.beginPath();
        ctx.roundRect(x + 0.02, room.y + row * course + 0.02, width - 0.04, course - 0.04, 0.05);
        ctx.fillStyle = tint([172, 167, 152], 14, rng);
        ctx.fill();
        // A lighter upper edge, as if the stone had some height.
        ctx.fillStyle = 'rgba(255, 252, 240, 0.18)';
        ctx.fillRect(x + 0.06, room.y + row * course + 0.04, width - 0.12, 0.04);
        x += width;
      }
    }
  } else {
    // Floorboards, each a slightly different shade and cut to length, with grain and nails.
    const base: readonly [number, number, number] =
      room.kind === 'storage'
        ? [140, 105, 68]
        : room.kind === 'guest' && quality !== 'poor'
          ? [184, 144, 94]
          : BOARDS[quality].color;
    const upright = room.kind === 'guest';
    const board = 1 / 3;
    const across = upright ? room.w : room.h;
    const along = upright ? room.h : room.w;
    // Draws in "board space": x runs along the board, y across the floor.
    if (upright) ctx.transform(0, 1, 1, 0, room.x, room.y);
    else ctx.translate(room.x, room.y);
    for (let k = 0; k * board < across; k++) {
      let from = -rng() * 1.5;
      while (from < along) {
        const length = 1.8 + rng() * 3.4;
        ctx.fillStyle = tint(base, BOARDS[quality].spread, rng);
        ctx.fillRect(from, k * board, length, board);
        // Grain: a couple of faint streaks along the board.
        ctx.strokeStyle = 'rgba(70, 44, 18, 0.13)';
        ctx.lineWidth = 0.012;
        ctx.beginPath();
        for (let g = 0; g < 2; g++) {
          const at = k * board + board * (0.25 + rng() * 0.5);
          ctx.moveTo(from + 0.1, at);
          ctx.lineTo(from + length - 0.1, at + (rng() - 0.5) * 0.05);
        }
        ctx.stroke();
        // The gaps between boards, and a nail at each end.
        ctx.strokeStyle = 'rgba(46, 28, 10, 0.5)';
        ctx.lineWidth = 0.02;
        ctx.strokeRect(from, k * board, length, board);
        ctx.fillStyle = 'rgba(36, 22, 8, 0.55)';
        for (const nail of [from + 0.07, from + length - 0.07]) {
          ctx.beginPath();
          ctx.arc(nail, k * board + board / 2, 0.014, 0, Math.PI * 2);
          ctx.fill();
        }
        from += length;
      }
    }
  }
  ctx.restore();

  // Shade gathering along the walls.
  ctx.save();
  ctx.beginPath();
  ctx.rect(room.x, room.y, room.w, room.h);
  ctx.clip();
  ctx.strokeStyle = 'rgba(34, 20, 8, 0.2)';
  ctx.lineWidth = 0.7;
  ctx.strokeRect(room.x, room.y, room.w, room.h);
  ctx.restore();
}

function paintGrid(ctx: Ctx, tavern: Tavern): void {
  ctx.strokeStyle = 'rgba(24, 14, 6, 0.4)';
  ctx.lineWidth = 0.024;
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

interface Light {
  x: number;
  y: number;
  radius: number;
  /** 0..1: how completely it lifts the dimness at its center. */
  strength: number;
  /** Firelight tints what it falls on orange; daylight through a window does not. */
  warm: boolean;
}

/** Everything in the tavern that gives off light. */
function lightSources(tavern: Tavern): Light[] {
  const lights: Light[] = [];
  const rooms = roomMap(tavern);
  for (const piece of tavern.furniture) {
    const x = piece.x + piece.w / 2;
    const y = piece.y + piece.h / 2;
    if (piece.kind === 'fireplace') {
      lights.push({
        x: piece.facing === 'w' ? piece.x : piece.x + piece.w,
        y,
        radius: 7.5,
        strength: 1,
        warm: true,
      });
    } else if (piece.kind === 'table-round' || piece.kind === 'table-long') {
      // A table is lit by the candle on it; a poor house leaves some without.
      if (piece.variant !== 'poor') lights.push({ x, y, radius: 2.9, strength: 0.9, warm: true });
    } else if (piece.kind === 'nightstand') {
      lights.push({ x, y, radius: 2.4, strength: 0.8, warm: true });
    } else if (piece.kind === 'oven' || piece.kind === 'cauldron') {
      lights.push({ x, y, radius: 3.6, strength: 0.9, warm: true });
    } else if (piece.kind === 'bar') {
      // Lanterns along the bar; a poor one makes do with a single dim one.
      const dim = piece.variant === 'poor';
      for (let at = piece.x + 2; at < piece.x + piece.w - 0.5; at += dim ? 99 : 3) {
        lights.push({ x: at + 0.5, y, radius: 3.2, strength: dim ? 0.6 : 0.9, warm: true });
      }
    } else if (piece.kind === 'forge') {
      lights.push({ x, y, radius: 6.5, strength: 1, warm: true });
    } else if (piece.kind === 'altar') {
      lights.push({ x, y, radius: 3.4, strength: 0.9, warm: true });
    } else if (piece.kind === 'desk' || piece.kind === 'workbench') {
      lights.push({ x, y, radius: 2.4, strength: 0.7, warm: true });
    } else if (piece.kind === 'stove') {
      lights.push({ x, y, radius: 3.4, strength: 0.85, warm: true });
    } else if (piece.kind === 'counter') {
      lights.push({ x, y, radius: 2.6, strength: 0.6, warm: true });
    } else if (piece.kind === 'stage') {
      lights.push({ x, y, radius: 2.8, strength: 0.75, warm: true });
    } else if (piece.kind === 'stairs') {
      lights.push({ x, y, radius: 2.4, strength: 0.55, warm: true });
    }
  }
  // Daylight falls in through each window and the open front door, onto the room side.
  const inside = (o: Opening): [number, number] => {
    const mid = o.length / 2;
    if (o.dir === 'h') {
      const below = rooms[o.y * tavern.w + o.x] >= 0;
      return [o.x + mid, o.y + (below ? 0.9 : -0.9)];
    }
    const after = rooms[o.y * tavern.w + o.x] >= 0;
    return [o.x + (after ? 0.9 : -0.9), o.y + mid];
  };
  for (const window of tavern.windows) {
    const [x, y] = inside(window);
    lights.push({ x, y, radius: 2.7, strength: 0.7, warm: false });
  }
  const [doorX, doorY] = inside(tavern.entrance);
  lights.push({ x: doorX, y: doorY, radius: 3, strength: 0.7, warm: false });
  // A lamp hanging in the storeroom, so it is not a black box.
  for (const room of tavern.rooms) {
    if (room.kind === 'storage') {
      lights.push({
        x: room.x + room.w / 2,
        y: room.y + room.h / 2,
        radius: 3.2,
        strength: 0.55,
        warm: true,
      });
    }
  }
  return lights;
}

/**
 * Dims the inside of the building and lets each light source lift the dimness
 * around it, then adds the orange cast of firelight.
 */
function paintLighting(ctx: Ctx, tavern: Tavern, squarePx: number): void {
  const lights = lightSources(tavern);
  const [x, y, w, h] = footprint(tavern);

  // The dimness is built on its own layer, where lights can cut holes in it.
  const layer = document.createElement('canvas');
  layer.width = tavern.w * squarePx;
  layer.height = tavern.h * squarePx;
  const shade = layer.getContext('2d')!;
  shade.scale(squarePx, squarePx);
  shade.fillStyle = `rgba(14, 8, 3, ${DARKNESS[tavern.quality]})`;
  shade.fillRect(x, y, w, h);
  shade.globalCompositeOperation = 'destination-out';
  for (const light of lights) {
    const hole = shade.createRadialGradient(light.x, light.y, 0, light.x, light.y, light.radius);
    hole.addColorStop(0, `rgba(0, 0, 0, ${light.strength})`);
    hole.addColorStop(0.45, `rgba(0, 0, 0, ${light.strength * 0.62})`);
    hole.addColorStop(1, 'rgba(0, 0, 0, 0)');
    shade.fillStyle = hole;
    shade.fillRect(light.x - light.radius, light.y - light.radius, light.radius * 2, light.radius * 2);
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(layer, 0, 0);
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.globalCompositeOperation = 'soft-light';
  for (const light of lights) {
    if (!light.warm) continue;
    const reach = light.radius * 0.85;
    const cast = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, reach);
    cast.addColorStop(0, `rgba(255, 150, 40, ${0.55 * light.strength})`);
    cast.addColorStop(1, 'rgba(255, 150, 40, 0)');
    ctx.fillStyle = cast;
    ctx.fillRect(light.x - reach, light.y - reach, reach * 2, reach * 2);
  }
  ctx.restore();
}

function paintWalls(ctx: Ctx, tavern: Tavern, rng: Rng): void {
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

  // Every unit of wall, as [x, y, direction], outer walls apart from partitions.
  const segments: { outer: [number, number, Opening['dir']][]; inner: [number, number, Opening['dir']][] } = {
    outer: [],
    inner: [],
  };
  for (let y = 0; y <= h; y++) {
    for (let x = 0; x <= w; x++) {
      const here = at(x, y);
      const above = at(x, y - 1);
      const before = at(x - 1, y);
      if (here !== above && !hasDoor(x, y, 'h')) {
        segments[here === -1 || above === -1 ? 'outer' : 'inner'].push([x, y, 'h']);
      }
      if (here !== before && !hasDoor(x, y, 'v')) {
        segments[here === -1 || before === -1 ? 'outer' : 'inner'].push([x, y, 'v']);
      }
    }
  }
  const trace = (list: [number, number, Opening['dir']][]) => {
    ctx.beginPath();
    for (const [x, y, dir] of list) {
      ctx.moveTo(x, y);
      ctx.lineTo(dir === 'h' ? x + 1 : x, dir === 'h' ? y : y + 1);
    }
  };

  const px = ctx.getTransform().a;
  ctx.lineCap = 'square';
  // Outer walls are stone and thick, the partitions inside are timber. Each is
  // a dark outline that casts a shadow, with the material laid over it.
  for (const [list, outline, body, color] of [
    // Partitions first: their ends then disappear under the outer walls they meet.
    [segments.inner, 0.2, 0.11, '#7a5632'],
    [segments.outer, 0.36, 0.24, '#8a8275'],
  ] as const) {
    ctx.save();
    ctx.shadowColor = 'rgba(16, 9, 3, 0.6)';
    ctx.shadowBlur = 0.22 * px;
    ctx.shadowOffsetX = 0.06 * px;
    ctx.shadowOffsetY = 0.09 * px;
    ctx.strokeStyle = INK;
    ctx.lineWidth = outline;
    trace(list);
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = color;
    ctx.lineWidth = body;
    trace(list);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';

  // Joints between the stones of the outer walls.
  ctx.strokeStyle = 'rgba(46, 38, 30, 0.6)';
  ctx.lineWidth = 0.025;
  ctx.beginPath();
  for (const [x, y, dir] of segments.outer) {
    for (const share of [0.12 + rng() * 0.2, 0.55 + rng() * 0.25]) {
      if (dir === 'h') {
        ctx.moveTo(x + share, y - 0.12);
        ctx.lineTo(x + share, y + 0.12);
      } else {
        ctx.moveTo(x - 0.12, y + share);
        ctx.lineTo(x + 0.12, y + share);
      }
    }
  }
  ctx.stroke();
  // A highlight along the upper-left edge of the stone, where the light catches it.
  ctx.strokeStyle = 'rgba(255, 250, 235, 0.22)';
  ctx.lineWidth = 0.04;
  ctx.beginPath();
  for (const [x, y, dir] of segments.outer) {
    if (dir === 'h') {
      ctx.moveTo(x, y - 0.08);
      ctx.lineTo(x + 1, y - 0.08);
    } else {
      ctx.moveTo(x - 0.08, y);
      ctx.lineTo(x - 0.08, y + 1);
    }
  }
  ctx.stroke();
}

/** Runs `draw` with the opening laid out along the x axis, starting at the origin. */
function alongOpening(ctx: Ctx, opening: Opening, draw: () => void): void {
  ctx.save();
  ctx.translate(opening.x, opening.y);
  if (opening.dir === 'v') ctx.rotate(Math.PI / 2);
  draw();
  ctx.restore();
}

function paintDoor(ctx: Ctx, door: Opening): void {
  alongOpening(ctx, door, () => {
    // A stone threshold, then one plank door leaf per square of width.
    ctx.fillStyle = '#9a9184';
    ctx.fillRect(0, -0.17, door.length, 0.34);
    ctx.strokeStyle = 'rgba(46, 34, 24, 0.5)';
    ctx.lineWidth = 0.02;
    ctx.strokeRect(0, -0.17, door.length, 0.34);
    for (let leaf = 0; leaf < door.length; leaf++) {
      const x = leaf + 0.07;
      const leafFill = ctx.createLinearGradient(0, -0.1, 0, 0.1);
      leafFill.addColorStop(0, '#a26a36');
      leafFill.addColorStop(1, '#75491f');
      ctx.fillStyle = leafFill;
      ctx.fillRect(x, -0.1, 0.86, 0.2);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 0.035;
      ctx.strokeRect(x, -0.1, 0.86, 0.2);
      // Planks, and the iron straps of the hinges.
      ctx.strokeStyle = 'rgba(46, 28, 10, 0.5)';
      ctx.lineWidth = 0.018;
      ctx.beginPath();
      for (const share of [0.25, 0.5, 0.75]) {
        ctx.moveTo(x + 0.86 * share, -0.1);
        ctx.lineTo(x + 0.86 * share, 0.1);
      }
      ctx.stroke();
      const hinged = door.length === 2 && leaf === 1 ? x + 0.72 : x + 0.04;
      ctx.fillStyle = '#3f3a36';
      ctx.fillRect(hinged, -0.085, 0.1, 0.045);
      ctx.fillRect(hinged, 0.04, 0.1, 0.045);
      // Handle, toward the middle of a double door.
      ctx.fillStyle = '#d6b76a';
      ctx.beginPath();
      ctx.arc(door.length === 2 ? (leaf === 0 ? 0.84 : 1.16) : 0.8, 0, 0.042, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function paintWindow(ctx: Ctx, window: Opening): void {
  alongOpening(ctx, window, () => {
    const glass = ctx.createLinearGradient(0.16, 0, 0.84, 0);
    glass.addColorStop(0, '#e6f3f2');
    glass.addColorStop(1, '#a9c9cf');
    ctx.fillStyle = glass;
    ctx.fillRect(0.16, -0.1, 0.68, 0.2);
    // A timber frame, with a mullion down the middle.
    ctx.strokeStyle = '#5a3a1e';
    ctx.lineWidth = 0.045;
    ctx.strokeRect(0.16, -0.1, 0.68, 0.2);
    ctx.beginPath();
    ctx.moveTo(0.5, -0.1);
    ctx.lineTo(0.5, 0.1);
    ctx.stroke();
  });
}

function text(ctx: Ctx, value: string, x: number, y: number, font: string, color = INK): void {
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 0.13;
  ctx.strokeStyle = 'rgba(236, 222, 188, 0.9)';
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

function paintLabels(ctx: Ctx, tavern: Tavern): void {
  const font = "italic bold 0.36px Georgia, 'Times New Roman', serif";
  for (const room of tavern.rooms) {
    if (room === tavern.rooms[0]) {
      // Beside the front door, in the aisle along the front wall, which furniture stays out of.
      text(ctx, ROOM_LABEL[room.kind], tavern.entrance.x - 1.3, room.y + room.h - 0.5, font);
    } else {
      text(ctx, ROOM_LABEL[room.kind], ...labelSpot(tavern, room), font);
    }
  }
}

function paintTitle(ctx: Ctx, tavern: Tavern): void {
  text(ctx, tavern.name, tavern.w / 2, 0.47, "bold 0.5px Georgia, 'Times New Roman', serif");
  ctx.font = "italic 0.26px Georgia, 'Times New Roman', serif";
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(46, 34, 24, 0.8)';
  ctx.fillText('1 quadrado = 1,5 m (5 pés)', tavern.w - 0.25, tavern.h - 0.45);
}
