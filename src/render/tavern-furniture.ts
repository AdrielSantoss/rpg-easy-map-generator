import type { Rng } from '../generator/rng.ts';
import type { Furniture } from '../tavern/generate.ts';

const INK = '#2e2218';
const WOOD = '#8f6236';
const WOOD_DARK = '#5a3a1e';
const WOOD_LIGHT = '#b98c56';
const IRON = '#4a4541';
const BRASS = '#d2ad5c';

type Ctx = CanvasRenderingContext2D;
type Painter = (ctx: Ctx, piece: Furniture, rng: Rng) => void;

/** Pieces lying flat on the floor are painted first; seats next, so they tuck under tables. */
const LAYER: Partial<Record<Furniture['kind'], number>> = {
  rug: 0,
  stage: 0,
  stairs: 0,
  chair: 1,
  stool: 1,
  bench: 1,
};

/**
 * Paints the furniture of a tavern, each piece casting a soft shadow on the
 * floor. Coordinates are in squares; the context is expected to be scaled so.
 */
export function paintFurniture(ctx: Ctx, furniture: readonly Furniture[], rng: Rng): void {
  const pieces = [...furniture].sort((a, b) => (LAYER[a.kind] ?? 2) - (LAYER[b.kind] ?? 2));
  for (const piece of pieces) {
    const outline = SILHOUETTE[piece.kind];
    if (outline) castShadow(ctx, () => outline(ctx, piece));
    PAINTERS[piece.kind](ctx, piece, rng);
  }
}

/** Fills the path `trace` lays down as a shadow: dark, blurred and nudged down and to the right. */
function castShadow(ctx: Ctx, trace: () => void): void {
  // Canvas shadows are measured in pixels whatever the scale, so read the scale back.
  const px = ctx.getTransform().a;
  ctx.save();
  ctx.shadowColor = 'rgba(22, 12, 3, 0.55)';
  ctx.shadowBlur = 0.16 * px;
  ctx.shadowOffsetX = 0.05 * px;
  ctx.shadowOffsetY = 0.08 * px;
  ctx.fillStyle = '#3a2816';
  ctx.beginPath();
  trace();
  ctx.fill();
  ctx.restore();
}

const circle = (ctx: Ctx, x: number, y: number, r: number) => ctx.arc(x, y, r, 0, Math.PI * 2);
const box = (ctx: Ctx, x: number, y: number, w: number, h: number, radius = 0.06) =>
  ctx.roundRect(x, y, w, h, radius);
const centerOf = (p: Furniture): [number, number] => [p.x + p.w / 2, p.y + p.h / 2];

/** The outline each piece casts its shadow from. Flat pieces (rug, stairs) cast none. */
const SILHOUETTE: Partial<Record<Furniture['kind'], (ctx: Ctx, p: Furniture) => void>> = {
  chair: (ctx, p) => box(ctx, p.x, p.y, p.w, p.h, 0.1),
  bench: (ctx, p) => box(ctx, p.x, p.y, p.w, p.h, 0.1),
  stool: (ctx, p) => circle(ctx, ...centerOf(p), p.w / 2),
  'table-round': (ctx, p) => circle(ctx, ...centerOf(p), Math.min(p.w, p.h) / 2 - 0.06),
  'table-long': (ctx, p) => box(ctx, p.x, p.y, p.w, p.h, 0.08),
  bar: (ctx, p) => box(ctx, p.x + 0.04, p.y + 0.14, p.w - 0.08, p.h - 0.28, 0.08),
  shelf: (ctx, p) => box(ctx, p.x, p.y, p.w, p.h, 0.02),
  stage: (ctx, p) => box(ctx, p.x + 0.08, p.y + 0.08, p.w - 0.16, p.h - 0.16, 0.03),
  stove: (ctx, p) => box(ctx, p.x + 0.06, p.y + 0.08, p.w - 0.12, p.h - 0.16),
  counter: (ctx, p) => box(ctx, p.x + 0.06, p.y + 0.12, p.w - 0.12, p.h - 0.24),
  washtub: (ctx, p) => circle(ctx, ...centerOf(p), 0.4),
  barrel: (ctx, p) => circle(ctx, ...centerOf(p), 0.39),
  crate: (ctx, p) => box(ctx, p.x + 0.13, p.y + 0.13, p.w - 0.26, p.h - 0.26, 0.02),
  bed: (ctx, p) => box(ctx, p.x + 0.08, p.y + 0.06, p.w - 0.16, p.h - 0.12, 0.08),
  chest: (ctx, p) => box(ctx, p.x + 0.14, p.y + 0.24, p.w - 0.28, p.h - 0.48),
};

/** Fills and outlines the current path. */
function finish(ctx: Ctx, fill: string | CanvasGradient, width = 0.045): void {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = width;
  ctx.stroke();
}

/** Wood lit from the upper left: lighter there, darker toward the lower right. */
function wood(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  light: string,
  dark: string,
): CanvasGradient {
  const shade = ctx.createLinearGradient(x, y, x + w, y + h);
  shade.addColorStop(0, light);
  shade.addColorStop(1, dark);
  return shade;
}

/** Faint lines along a wooden top, as joins between its boards. */
function boards(ctx: Ctx, x: number, y: number, w: number, h: number, count: number): void {
  ctx.strokeStyle = 'rgba(52, 32, 14, 0.38)';
  ctx.lineWidth = 0.022;
  ctx.beginPath();
  for (let k = 1; k <= count; k++) {
    const at = y + (h * k) / (count + 1);
    ctx.moveTo(x, at);
    ctx.lineTo(x + w, at);
  }
  ctx.stroke();
}

function mug(ctx: Ctx, x: number, y: number, rng: Rng): void {
  const angle = rng() * Math.PI * 2;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.028;
  ctx.beginPath();
  ctx.arc(x + Math.cos(angle) * 0.085, y + Math.sin(angle) * 0.085, 0.04, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  circle(ctx, x, y, 0.075);
  finish(ctx, '#a9793a', 0.025);
  ctx.beginPath();
  circle(ctx, x, y, 0.048);
  ctx.fillStyle = '#f1e7cc';
  ctx.fill();
}

function plate(ctx: Ctx, x: number, y: number, rng: Rng): void {
  ctx.beginPath();
  circle(ctx, x, y, 0.12);
  finish(ctx, '#ddd2b8', 0.022);
  ctx.beginPath();
  circle(ctx, x, y, 0.085);
  ctx.strokeStyle = 'rgba(46, 34, 24, 0.3)';
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x + (rng() - 0.5) * 0.04, y + (rng() - 0.5) * 0.04, 0.06, 0.045, rng() * 3, 0, Math.PI * 2);
  ctx.fillStyle = ['#9a5a34', '#c7964e', '#7d8c4a', '#b2553a'][Math.floor(rng() * 4)];
  ctx.fill();
}

/** A lit candle: a stub of wax, a flame, and its glow on the tabletop. */
function candle(ctx: Ctx, x: number, y: number): void {
  const glow = ctx.createRadialGradient(x, y, 0, x, y, 0.34);
  glow.addColorStop(0, 'rgba(255, 226, 130, 0.6)');
  glow.addColorStop(1, 'rgba(255, 200, 90, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - 0.34, y - 0.34, 0.68, 0.68);
  ctx.beginPath();
  circle(ctx, x, y, 0.055);
  finish(ctx, '#efe4c6', 0.02);
  ctx.beginPath();
  circle(ctx, x, y, 0.028);
  ctx.fillStyle = '#ffb53a';
  ctx.fill();
}

/** Mugs and plates scattered inside a box, keeping clear of `avoid`, where a candle stands. */
function tableware(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  count: number,
  rng: Rng,
  avoid?: [number, number],
): void {
  for (let k = 0; k < count; k++) {
    let px = x + rng() * w;
    let py = y + rng() * h;
    if (avoid && Math.hypot(px - avoid[0], py - avoid[1]) < 0.22) {
      px += 0.26;
      py += 0.12;
    }
    if (rng() < 0.45) plate(ctx, px, py, rng);
    else mug(ctx, px, py, rng);
  }
}

const seat: Painter = (ctx, p) => {
  ctx.beginPath();
  box(ctx, p.x, p.y, p.w, p.h, 0.1);
  finish(ctx, wood(ctx, p.x, p.y, p.w, p.h, '#93663c', '#6a4526'), 0.035);
  // The worn middle of the seat.
  ctx.beginPath();
  box(ctx, p.x + 0.07, p.y + 0.07, p.w - 0.14, p.h - 0.14, 0.06);
  ctx.fillStyle = 'rgba(214, 170, 110, 0.22)';
  ctx.fill();
};

const PAINTERS: Record<Furniture['kind'], Painter> = {
  chair: seat,
  bench: seat,

  stool(ctx, p) {
    const [cx, cy] = centerOf(p);
    ctx.beginPath();
    circle(ctx, cx, cy, p.w / 2);
    finish(ctx, wood(ctx, p.x, p.y, p.w, p.h, '#93663c', '#6a4526'), 0.035);
    ctx.beginPath();
    circle(ctx, cx, cy, p.w / 2 - 0.08);
    ctx.fillStyle = 'rgba(214, 170, 110, 0.22)';
    ctx.fill();
  },

  'table-round'(ctx, p, rng) {
    const [cx, cy] = centerOf(p);
    const r = Math.min(p.w, p.h) / 2 - 0.06;
    ctx.beginPath();
    circle(ctx, cx, cy, r);
    const top = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
    top.addColorStop(0, '#a87644');
    top.addColorStop(1, '#7c5330');
    finish(ctx, top);
    // Board joins, cut off by the round edge.
    ctx.save();
    ctx.beginPath();
    circle(ctx, cx, cy, r - 0.03);
    ctx.clip();
    boards(ctx, cx - r, cy - r, r * 2, r * 2, 3);
    ctx.restore();
    ctx.beginPath();
    circle(ctx, cx, cy, r - 0.06);
    ctx.strokeStyle = 'rgba(214, 170, 110, 0.3)';
    ctx.lineWidth = 0.025;
    ctx.stroke();
    if (r > 0.5) {
      candle(ctx, cx, cy);
      tableware(ctx, cx - r * 0.55, cy - r * 0.55, r * 1.1, r * 1.1, 3, rng, [cx, cy]);
    } else {
      candle(ctx, cx, cy);
    }
  },

  'table-long'(ctx, p, rng) {
    ctx.beginPath();
    box(ctx, p.x, p.y, p.w, p.h, 0.08);
    finish(ctx, wood(ctx, p.x, p.y, p.w, p.h, '#a87644', '#7c5330'));
    boards(ctx, p.x + 0.05, p.y, p.w - 0.1, p.h, 2);
    const [cx, cy] = centerOf(p);
    candle(ctx, cx, cy);
    tableware(ctx, p.x + 0.25, p.y + 0.2, p.w - 0.5, p.h - 0.4, 5, rng, [cx, cy]);
  },

  bar(ctx, p, rng) {
    const x = p.x + 0.04;
    const y = p.y + 0.14;
    const w = p.w - 0.08;
    const h = p.h - 0.28;
    ctx.beginPath();
    box(ctx, x, y, w, h, 0.08);
    finish(ctx, wood(ctx, x, y, w, h, '#86562e', '#5c391c'), 0.05);
    boards(ctx, x + 0.06, y, w - 0.12, h, 1);
    // The polished rail on the customers' side.
    ctx.fillStyle = 'rgba(226, 184, 122, 0.55)';
    ctx.fillRect(x + 0.08, y + h - 0.13, w - 0.16, 0.07);
    // A keg on its stand at one end, and lanterns along the top.
    ctx.beginPath();
    circle(ctx, x + 0.42, y + h / 2 - 0.03, 0.24);
    finish(ctx, WOOD, 0.035);
    ctx.beginPath();
    circle(ctx, x + 0.42, y + h / 2 - 0.03, 0.16);
    ctx.strokeStyle = 'rgba(46, 34, 24, 0.5)';
    ctx.lineWidth = 0.025;
    ctx.stroke();
    for (let at = p.x + 2; at < p.x + p.w - 0.5; at += 3) candle(ctx, at, y + h / 2 - 0.05);
    tableware(ctx, x + 0.9, y + 0.12, w - 1.2, h - 0.34, Math.round(p.w * 0.8), rng);
  },

  shelf(ctx, p, rng) {
    ctx.fillStyle = wood(ctx, p.x, p.y, p.w, p.h, '#6e4826', WOOD_DARK);
    ctx.fillRect(p.x, p.y, p.w, p.h);
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      circle(ctx, p.x + 0.13 + k * 0.21, p.y + p.h / 2, 0.075);
      ctx.fillStyle = ['#5f7f4f', '#b07a2a', '#7a3b2e', '#4f6a7a'][Math.floor(rng() * 4)];
      ctx.fill();
      ctx.beginPath();
      circle(ctx, p.x + 0.11 + k * 0.21, p.y + p.h / 2 - 0.02, 0.025);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.fill();
    }
  },

  fireplace(ctx, p, rng) {
    // Stone surround, built of blocks.
    ctx.beginPath();
    ctx.rect(p.x, p.y, p.w, p.h);
    finish(ctx, '#8f8b80', 0.06);
    ctx.strokeStyle = 'rgba(46, 40, 34, 0.5)';
    ctx.lineWidth = 0.025;
    ctx.beginPath();
    for (let k = 1; k < 6; k++) {
      const y = p.y + (p.h * k) / 6;
      ctx.moveTo(p.x, y);
      ctx.lineTo(p.x + p.w, y);
      const x = p.x + p.w * (k % 2 ? 0.4 : 0.66);
      ctx.moveTo(x, y - p.h / 6);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    // The firebox opens toward the room.
    const boxX = p.facing === 'w' ? p.x - 0.02 : p.x + 0.3;
    const boxW = p.w - 0.28;
    ctx.fillStyle = '#1e140d';
    ctx.fillRect(boxX, p.y + 0.3, boxW, p.h - 0.6);
    const cx = boxX + boxW / 2;
    const cy = p.y + p.h / 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#4a2f18';
    ctx.lineWidth = 0.11;
    ctx.beginPath();
    ctx.moveTo(cx - 0.1, cy - 0.44);
    ctx.lineTo(cx + 0.08, cy + 0.42);
    ctx.moveTo(cx + 0.14, cy - 0.38);
    ctx.lineTo(cx - 0.12, cy + 0.36);
    ctx.stroke();
    ctx.lineCap = 'butt';
    for (const [rx, ry, color] of [
      [0.34, 0.56, 'rgba(232, 92, 24, 0.75)'],
      [0.24, 0.42, 'rgba(250, 158, 40, 0.9)'],
      [0.13, 0.26, 'rgba(255, 238, 160, 0.95)'],
    ] as const) {
      ctx.beginPath();
      ctx.ellipse(cx, cy + (rng() - 0.5) * 0.06, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
  },

  stairs(ctx, p) {
    ctx.beginPath();
    ctx.rect(p.x + 0.06, p.y + 0.06, p.w - 0.12, p.h - 0.12);
    finish(ctx, WOOD_LIGHT, 0.05);
    // Steps, darker toward the top where they climb out of sight.
    const steps = Math.round(p.h / 0.3);
    const tread = (p.h - 0.12) / steps;
    for (let k = 0; k < steps; k++) {
      const y = p.y + 0.06 + tread * k;
      ctx.fillStyle = `rgba(38, 24, 10, ${0.46 * (1 - k / steps)})`;
      ctx.fillRect(p.x + 0.06, y, p.w - 0.12, tread);
      // The lit edge of each tread.
      ctx.fillStyle = 'rgba(236, 200, 140, 0.35)';
      ctx.fillRect(p.x + 0.06, y + tread - 0.05, p.w - 0.12, 0.03);
      ctx.strokeStyle = 'rgba(46, 34, 24, 0.75)';
      ctx.lineWidth = 0.025;
      ctx.beginPath();
      ctx.moveTo(p.x + 0.06, y);
      ctx.lineTo(p.x + p.w - 0.06, y);
      ctx.stroke();
    }
    // Handrails down both sides, and an arrow pointing up the flight.
    ctx.fillStyle = WOOD_DARK;
    ctx.fillRect(p.x + 0.06, p.y + 0.06, 0.08, p.h - 0.12);
    ctx.fillRect(p.x + p.w - 0.14, p.y + 0.06, 0.08, p.h - 0.12);
    const cx = p.x + p.w / 2;
    ctx.strokeStyle = 'rgba(250, 236, 200, 0.9)';
    ctx.lineWidth = 0.06;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, p.y + p.h - 0.45);
    ctx.lineTo(cx, p.y + 0.45);
    ctx.moveTo(cx - 0.2, p.y + 0.7);
    ctx.lineTo(cx, p.y + 0.45);
    ctx.lineTo(cx + 0.2, p.y + 0.7);
    ctx.stroke();
    ctx.lineCap = 'butt';
  },

  stage(ctx, p) {
    const x = p.x + 0.08;
    const y = p.y + 0.08;
    const w = p.w - 0.16;
    const h = p.h - 0.16;
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    finish(ctx, wood(ctx, x, y, w, h, '#b88a54', '#94693c'), 0.07);
    boards(ctx, x + 0.04, y, w - 0.08, h, 5);
    // A raised lip all round, catching the light.
    ctx.strokeStyle = 'rgba(240, 206, 150, 0.4)';
    ctx.lineWidth = 0.04;
    ctx.strokeRect(x + 0.08, y + 0.08, w - 0.16, h - 0.16);
  },

  stove(ctx, p) {
    ctx.beginPath();
    box(ctx, p.x + 0.06, p.y + 0.08, p.w - 0.12, p.h - 0.16);
    const iron = ctx.createLinearGradient(p.x, p.y, p.x + p.w, p.y + p.h);
    iron.addColorStop(0, '#5a5450');
    iron.addColorStop(1, '#2f2b28');
    finish(ctx, iron, 0.05);
    const cy = p.y + p.h / 2;
    // One burner glowing, the other with a pot of stew on it.
    const fireX = p.x + p.w * 0.28;
    ctx.beginPath();
    circle(ctx, fireX, cy, 0.24);
    ctx.fillStyle = '#191513';
    ctx.fill();
    const coals = ctx.createRadialGradient(fireX, cy, 0, fireX, cy, 0.2);
    coals.addColorStop(0, 'rgba(255, 196, 90, 0.95)');
    coals.addColorStop(1, 'rgba(210, 70, 20, 0.5)');
    ctx.beginPath();
    circle(ctx, fireX, cy, 0.17);
    ctx.fillStyle = coals;
    ctx.fill();
    const potX = p.x + p.w * 0.72;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.05;
    ctx.beginPath();
    ctx.moveTo(potX - 0.34, cy);
    ctx.lineTo(potX + 0.34, cy);
    ctx.stroke();
    ctx.beginPath();
    circle(ctx, potX, cy, 0.26);
    finish(ctx, IRON, 0.035);
    ctx.beginPath();
    circle(ctx, potX, cy, 0.19);
    ctx.fillStyle = '#8a5a2c';
    ctx.fill();
    for (const [dx, dy, color] of [
      [-0.07, -0.04, '#c96f3a'],
      [0.06, 0.05, '#d9c06a'],
      [0.04, -0.08, '#7d8c4a'],
    ] as const) {
      ctx.beginPath();
      circle(ctx, potX + dx, cy + dy, 0.035);
      ctx.fillStyle = color;
      ctx.fill();
    }
  },

  counter(ctx, p, rng) {
    const x = p.x + 0.06;
    const y = p.y + 0.12;
    const w = p.w - 0.12;
    const h = p.h - 0.24;
    ctx.beginPath();
    box(ctx, x, y, w, h);
    finish(ctx, wood(ctx, x, y, w, h, '#c59a62', '#9d7646'));
    boards(ctx, x + 0.04, y, w - 0.08, h, 2);
    // A cutting board with a loaf and a knife, and a few vegetables.
    ctx.beginPath();
    box(ctx, x + 0.14, y + 0.12, 0.62, h - 0.24, 0.04);
    finish(ctx, '#d8b47c', 0.025);
    ctx.beginPath();
    ctx.ellipse(x + 0.4, y + h / 2, 0.19, 0.11, 0.35, 0, Math.PI * 2);
    finish(ctx, '#c08a44', 0.022);
    ctx.strokeStyle = '#d9dadb';
    ctx.lineWidth = 0.035;
    ctx.beginPath();
    ctx.moveTo(x + 0.6, y + 0.18);
    ctx.lineTo(x + 0.7, y + h - 0.2);
    ctx.stroke();
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      circle(ctx, x + 1 + rng() * (w - 1.25), y + 0.16 + rng() * (h - 0.32), 0.06);
      ctx.fillStyle = ['#b6452c', '#d08a2e', '#6f8f3e', '#e2d3a0'][Math.floor(rng() * 4)];
      ctx.fill();
      ctx.strokeStyle = 'rgba(46, 34, 24, 0.6)';
      ctx.lineWidth = 0.018;
      ctx.stroke();
    }
  },

  washtub(ctx, p) {
    const [cx, cy] = centerOf(p);
    ctx.beginPath();
    circle(ctx, cx, cy, 0.4);
    finish(ctx, wood(ctx, p.x, p.y, p.w, p.h, '#a0723f', '#70492a'));
    const water = ctx.createRadialGradient(cx - 0.08, cy - 0.08, 0.02, cx, cy, 0.3);
    water.addColorStop(0, '#c2dbe0');
    water.addColorStop(1, '#6f97a6');
    ctx.beginPath();
    circle(ctx, cx, cy, 0.3);
    finish(ctx, water, 0.025);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 0.02;
    ctx.beginPath();
    ctx.arc(cx, cy, 0.17, 3.6, 5.2);
    ctx.stroke();
  },

  barrel(ctx, p) {
    const [cx, cy] = centerOf(p);
    const top = ctx.createRadialGradient(cx - 0.12, cy - 0.12, 0.03, cx, cy, 0.39);
    top.addColorStop(0, '#b07e48');
    top.addColorStop(1, '#75502c');
    ctx.beginPath();
    circle(ctx, cx, cy, 0.39);
    finish(ctx, top);
    // The iron hoop, then the staves of the lid.
    ctx.beginPath();
    circle(ctx, cx, cy, 0.33);
    ctx.strokeStyle = '#4f4a46';
    ctx.lineWidth = 0.045;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(46, 34, 24, 0.5)';
    ctx.lineWidth = 0.025;
    ctx.beginPath();
    for (const offset of [-0.14, 0, 0.14]) {
      const half = Math.sqrt(0.3 * 0.3 - offset * offset);
      ctx.moveTo(cx + offset, cy - half);
      ctx.lineTo(cx + offset, cy + half);
    }
    ctx.stroke();
    ctx.beginPath();
    circle(ctx, cx, cy, 0.035);
    ctx.fillStyle = INK;
    ctx.fill();
  },

  crate(ctx, p) {
    const x = p.x + 0.13;
    const y = p.y + 0.13;
    const w = p.w - 0.26;
    const h = p.h - 0.26;
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    finish(ctx, wood(ctx, x, y, w, h, '#b58a56', '#8a6238'));
    boards(ctx, x, y, w, h, 3);
    // Frame and brace nailed over the boards.
    ctx.strokeStyle = '#6e4a28';
    ctx.lineWidth = 0.07;
    ctx.strokeRect(x + 0.045, y + 0.045, w - 0.09, h - 0.09);
    ctx.beginPath();
    ctx.moveTo(x + 0.08, y + 0.08);
    ctx.lineTo(x + w - 0.08, y + h - 0.08);
    ctx.stroke();
    ctx.fillStyle = INK;
    for (const [nx, ny] of [
      [x + 0.06, y + 0.06],
      [x + w - 0.06, y + 0.06],
      [x + 0.06, y + h - 0.06],
      [x + w - 0.06, y + h - 0.06],
    ]) {
      ctx.beginPath();
      circle(ctx, nx, ny, 0.016);
      ctx.fill();
    }
  },

  bed(ctx, p, rng) {
    ctx.beginPath();
    box(ctx, p.x + 0.08, p.y + 0.06, p.w - 0.16, p.h - 0.12, 0.08);
    finish(ctx, WOOD_DARK);
    // Sheet, then a blanket folded back below the pillow.
    ctx.beginPath();
    box(ctx, p.x + 0.14, p.y + 0.14, p.w - 0.28, p.h - 0.26, 0.05);
    ctx.fillStyle = '#e4dac0';
    ctx.fill();
    const [r, g, b] = [
      [140, 59, 52],
      [63, 95, 122],
      [84, 115, 63],
      [122, 90, 140],
    ][Math.floor(rng() * 4)];
    const blanket = ctx.createLinearGradient(p.x, p.y, p.x + p.w, p.y);
    blanket.addColorStop(0, `rgb(${r + 26}, ${g + 26}, ${b + 26})`);
    blanket.addColorStop(1, `rgb(${r - 18}, ${g - 18}, ${b - 18})`);
    ctx.beginPath();
    box(ctx, p.x + 0.14, p.y + 0.66, p.w - 0.28, p.h - 0.78, 0.05);
    finish(ctx, blanket, 0.025);
    ctx.fillStyle = 'rgba(255, 250, 235, 0.6)';
    ctx.fillRect(p.x + 0.14, p.y + 0.66, p.w - 0.28, 0.12);
    ctx.strokeStyle = 'rgba(20, 12, 6, 0.25)';
    ctx.lineWidth = 0.02;
    ctx.beginPath();
    for (const share of [0.45, 0.7]) {
      ctx.moveTo(p.x + 0.16, p.y + p.h * share);
      ctx.quadraticCurveTo(p.x + p.w / 2, p.y + p.h * share + 0.08, p.x + p.w - 0.16, p.y + p.h * share);
    }
    ctx.stroke();
    ctx.beginPath();
    box(ctx, p.x + 0.2, p.y + 0.17, p.w - 0.4, 0.38, 0.1);
    finish(ctx, '#f2ead6', 0.025);
  },

  chest(ctx, p) {
    const x = p.x + 0.14;
    const y = p.y + 0.24;
    const w = p.w - 0.28;
    const h = p.h - 0.48;
    ctx.beginPath();
    box(ctx, x, y, w, h);
    finish(ctx, wood(ctx, x, y, w, h, '#86562e', '#5c391c'));
    // Iron bands and a brass lock.
    ctx.fillStyle = IRON;
    ctx.fillRect(x + w * 0.2, y, 0.06, h);
    ctx.fillRect(x + w * 0.8 - 0.06, y, 0.06, h);
    ctx.strokeStyle = 'rgba(20, 12, 6, 0.45)';
    ctx.lineWidth = 0.02;
    ctx.beginPath();
    ctx.moveTo(x, y + h * 0.42);
    ctx.lineTo(x + w, y + h * 0.42);
    ctx.stroke();
    ctx.beginPath();
    box(ctx, x + w / 2 - 0.05, y + h * 0.42 - 0.02, 0.1, 0.11, 0.02);
    finish(ctx, BRASS, 0.02);
  },

  rug(ctx, p) {
    // Fringe at both ends, then the woven field with a border and a diamond.
    ctx.strokeStyle = 'rgba(226, 206, 160, 0.9)';
    ctx.lineWidth = 0.025;
    ctx.beginPath();
    for (let y = p.y + 0.08; y < p.y + p.h - 0.04; y += 0.09) {
      ctx.moveTo(p.x - 0.07, y);
      ctx.lineTo(p.x + 0.02, y);
      ctx.moveTo(p.x + p.w - 0.02, y);
      ctx.lineTo(p.x + p.w + 0.07, y);
    }
    ctx.stroke();
    ctx.beginPath();
    box(ctx, p.x, p.y, p.w, p.h, 0.05);
    const weave = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.h);
    weave.addColorStop(0, '#9a4138');
    weave.addColorStop(1, '#7c2f2a');
    ctx.fillStyle = weave;
    ctx.fill();
    ctx.strokeStyle = 'rgba(40, 14, 10, 0.5)';
    ctx.lineWidth = 0.03;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(226, 188, 112, 0.9)';
    ctx.lineWidth = 0.04;
    ctx.beginPath();
    box(ctx, p.x + 0.12, p.y + 0.12, p.w - 0.24, p.h - 0.24, 0.03);
    ctx.stroke();
    const [cx, cy] = centerOf(p);
    ctx.beginPath();
    ctx.moveTo(cx - p.w * 0.3, cy);
    ctx.lineTo(cx, cy - p.h * 0.26);
    ctx.lineTo(cx + p.w * 0.3, cy);
    ctx.lineTo(cx, cy + p.h * 0.26);
    ctx.closePath();
    ctx.fillStyle = 'rgba(52, 78, 96, 0.75)';
    ctx.fill();
    ctx.stroke();
  },
};
