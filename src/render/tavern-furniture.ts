import type { Rng } from '../generator/rng.ts';
import type { Furniture } from '../tavern/generate.ts';

const INK = '#2e2218';
const WOOD = '#8f6236';
const WOOD_DARK = '#5a3a1e';
const WOOD_LIGHT = '#b98c56';
const IRON = '#4a4541';
const BRASS = '#d2ad5c';
const LINEN = '#ece3cc';

type Ctx = CanvasRenderingContext2D;
type Painter = (ctx: Ctx, piece: Furniture, rng: Rng) => void;

/**
 * What goes under what: dirt on the floor first, then things lying flat, then
 * seats (so they tuck under tables), then everything standing, then what sits
 * on top of furniture.
 */
const LAYER: Partial<Record<Furniture['kind'], number>> = {
  stain: 0,
  straw: 0,
  rug: 1,
  stage: 1,
  stairs: 1,
  cobweb: 1,
  bottle: 2,
  debris: 2,
  rat: 2,
  chair: 2,
  stool: 2,
  bench: 2,
  armchair: 2,
  bucket: 2,
  tap: 4,
};

/**
 * Paints the furniture of a tavern, each piece casting a soft shadow on the
 * floor. Coordinates are in squares; the context is expected to be scaled so.
 */
export function paintFurniture(ctx: Ctx, furniture: readonly Furniture[], rng: Rng): void {
  const pieces = [...furniture].sort((a, b) => (LAYER[a.kind] ?? 3) - (LAYER[b.kind] ?? 3));
  for (const piece of pieces) {
    ctx.save();
    if (piece.angle) {
      // Knocked out of line: turned about its own middle.
      const [cx, cy] = centerOf(piece);
      ctx.translate(cx, cy);
      ctx.rotate(piece.angle);
      ctx.translate(-cx, -cy);
    }
    const outline = SILHOUETTE[piece.kind];
    if (outline) castShadow(ctx, () => outline(ctx, piece));
    PAINTERS[piece.kind](ctx, piece, rng);
    ctx.restore();
  }
}

/** Fills the path `trace` lays down as a shadow: dark, blurred and nudged down and to the right. */
function castShadow(ctx: Ctx, trace: () => void): void {
  // Canvas shadows are measured in pixels whatever the scale, so read the scale back.
  const { a, b } = ctx.getTransform();
  const px = Math.hypot(a, b);
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
const inset = (p: Furniture, by: number): [number, number, number, number] => [
  p.x + by,
  p.y + by,
  p.w - 2 * by,
  p.h - 2 * by,
];

/** The outline each piece casts its shadow from. Flat things (rugs, stains, stairs) cast none. */
const SILHOUETTE: Partial<Record<Furniture['kind'], (ctx: Ctx, p: Furniture) => void>> = {
  chair: (ctx, p) => box(ctx, p.x, p.y, p.w, p.h, 0.1),
  bench: (ctx, p) => box(ctx, p.x, p.y, p.w, p.h, 0.1),
  armchair: (ctx, p) => box(ctx, p.x, p.y, p.w, p.h, 0.16),
  stool: (ctx, p) => circle(ctx, ...centerOf(p), p.w / 2),
  bucket: (ctx, p) => circle(ctx, ...centerOf(p), p.w / 2),
  'table-round': (ctx, p) => circle(ctx, ...centerOf(p), Math.min(p.w, p.h) / 2 - 0.06),
  'table-long': (ctx, p) => box(ctx, p.x, p.y, p.w, p.h, 0.08),
  bar: (ctx, p) => box(ctx, p.x + 0.04, p.y + 0.14, p.w - 0.08, p.h - 0.28, 0.08),
  shelf: (ctx, p) => box(ctx, p.x, p.y, p.w, p.h, 0.02),
  pantry: (ctx, p) => box(ctx, p.x, p.y, p.w, p.h, 0.02),
  stage: (ctx, p) => box(ctx, ...inset(p, 0.08), 0.03),
  stove: (ctx, p) => box(ctx, p.x + 0.06, p.y + 0.08, p.w - 0.12, p.h - 0.16),
  oven: (ctx, p) => box(ctx, ...inset(p, 0.05), 0.1),
  cauldron: (ctx, p) => circle(ctx, ...centerOf(p), 0.36),
  counter: (ctx, p) => box(ctx, p.x + 0.06, p.y + 0.12, p.w - 0.12, p.h - 0.24),
  washtub: (ctx, p) => circle(ctx, ...centerOf(p), 0.4),
  barrel: (ctx, p) => circle(ctx, ...centerOf(p), 0.39),
  keg: (ctx, p) => box(ctx, p.x + 0.1, p.y + 0.16, p.w - 0.2, p.h - 0.26, 0.16),
  crate: (ctx, p) => box(ctx, ...inset(p, 0.13), 0.02),
  sacks: (ctx, p) => circle(ctx, ...centerOf(p), 0.36),
  logs: (ctx, p) => box(ctx, p.x + 0.12, p.y + 0.2, p.w - 0.24, p.h - 0.36, 0.1),
  bed: (ctx, p) => box(ctx, ...inset(p, 0.07), 0.08),
  'bed-double': (ctx, p) => box(ctx, ...inset(p, 0.07), 0.08),
  chest: (ctx, p) => box(ctx, p.x + 0.14, p.y + 0.24, p.w - 0.28, p.h - 0.48),
  wardrobe: (ctx, p) => box(ctx, p.x + 0.06, p.y + 0.16, p.w - 0.12, p.h - 0.22),
  nightstand: (ctx, p) => box(ctx, ...inset(p, 0.2), 0.04),
  desk: (ctx, p) => box(ctx, p.x + 0.08, p.y + 0.16, p.w - 0.16, p.h - 0.3),
  plant: (ctx, p) => circle(ctx, ...centerOf(p), 0.3),
  anvil: (ctx, p) => circle(ctx, ...centerOf(p), 0.32),
  forge: (ctx, p) => box(ctx, ...inset(p, 0.06), 0.08),
  workbench: (ctx, p) => box(ctx, p.x + 0.06, p.y + 0.14, p.w - 0.12, p.h - 0.28),
  throne: (ctx, p) => box(ctx, ...inset(p, 0.1), 0.1),
  altar: (ctx, p) => box(ctx, p.x + 0.08, p.y + 0.14, p.w - 0.16, p.h - 0.28, 0.04),
  statue: (ctx, p) => box(ctx, ...inset(p, 0.14), 0.04),
  pillar: (ctx, p) => circle(ctx, ...centerOf(p), 0.36),
  'weapon-rack': (ctx, p) => box(ctx, p.x, p.y, p.w, p.h, 0.02),
};

/** Fills and outlines the current path. */
function finish(ctx: Ctx, fill: string | CanvasGradient, width = 0.045): void {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = width;
  ctx.stroke();
}

/** A surface lit from the upper left: lighter there, darker toward the lower right. */
function lit(
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

/** Faint lines across a wooden top, as joins between its boards. */
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

function dot(ctx: Ctx, x: number, y: number, r: number, color: string): void {
  ctx.beginPath();
  circle(ctx, x, y, r);
  ctx.fillStyle = color;
  ctx.fill();
}

function mug(ctx: Ctx, x: number, y: number, rng: Rng): void {
  const angle = rng() * Math.PI * 2;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.028;
  ctx.beginPath();
  circle(ctx, x + Math.cos(angle) * 0.085, y + Math.sin(angle) * 0.085, 0.04);
  ctx.stroke();
  ctx.beginPath();
  circle(ctx, x, y, 0.075);
  finish(ctx, '#a9793a', 0.025);
  dot(ctx, x, y, 0.048, '#f1e7cc');
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
  dot(ctx, x, y, 0.028, '#ffb53a');
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

/** A row of small round things on a wall shelf, colored by what they are. */
function shelfRow(
  ctx: Ctx,
  p: Furniture,
  colors: readonly string[],
  count: number,
  radius: number,
  rng: Rng,
): void {
  for (let k = 0; k < count; k++) {
    const x = p.x + p.w * ((k + 0.5) / count) + (rng() - 0.5) * 0.03;
    const y = p.y + p.h / 2;
    dot(ctx, x, y, radius, colors[Math.floor(rng() * colors.length)]);
    ctx.strokeStyle = 'rgba(30, 20, 10, 0.55)';
    ctx.lineWidth = 0.015;
    ctx.stroke();
    dot(ctx, x - radius * 0.3, y - radius * 0.3, radius * 0.3, 'rgba(255, 255, 255, 0.45)');
  }
}

/** A wooden seat; cushioned in the houses that can afford it. */
function seatTop(ctx: Ctx, p: Furniture, round: boolean): void {
  const [cx, cy] = centerOf(p);
  ctx.beginPath();
  if (round) circle(ctx, cx, cy, p.w / 2);
  else box(ctx, p.x, p.y, p.w, p.h, 0.1);
  finish(ctx, lit(ctx, p.x, p.y, p.w, p.h, '#93663c', '#6a4526'), 0.035);
  ctx.beginPath();
  if (round) circle(ctx, cx, cy, p.w / 2 - 0.08);
  else box(ctx, p.x + 0.07, p.y + 0.07, p.w - 0.14, p.h - 0.14, 0.06);
  if (p.variant === 'cushion') {
    finish(ctx, lit(ctx, p.x, p.y, p.w, p.h, '#a83c36', '#74201f'), 0.022);
    dot(ctx, cx, cy, 0.03, BRASS);
  } else {
    // The worn middle of a bare seat.
    ctx.fillStyle = 'rgba(214, 170, 110, 0.22)';
    ctx.fill();
  }
}

/** A bed of any size, drawn head up: frame, sheet, pillows and a blanket folded back. */
function bedding(ctx: Ctx, p: Furniture, pillows: number, rng: Rng): void {
  const fine = p.variant === 'fine';
  ctx.beginPath();
  box(ctx, ...inset(p, 0.07), 0.08);
  finish(ctx, fine ? lit(ctx, p.x, p.y, p.w, p.h, '#7a4a26', '#4a2a12') : WOOD_DARK);
  if (fine) {
    // A carved headboard.
    ctx.fillStyle = '#3a2010';
    ctx.fillRect(p.x + 0.07, p.y + 0.07, p.w - 0.14, 0.1);
  }
  ctx.beginPath();
  box(ctx, p.x + 0.14, p.y + 0.16, p.w - 0.28, p.h - 0.28, 0.05);
  ctx.fillStyle = LINEN;
  ctx.fill();
  const [r, g, b] = fine
    ? [112, 34, 44]
    : [
        [140, 59, 52],
        [63, 95, 122],
        [84, 115, 63],
        [122, 90, 140],
      ][Math.floor(rng() * 4)];
  const blanket = ctx.createLinearGradient(p.x, p.y, p.x + p.w, p.y);
  blanket.addColorStop(0, `rgb(${r + 26}, ${g + 26}, ${b + 26})`);
  blanket.addColorStop(1, `rgb(${r - 18}, ${g - 18}, ${b - 18})`);
  ctx.beginPath();
  box(ctx, p.x + 0.14, p.y + 0.7, p.w - 0.28, p.h - 0.82, 0.05);
  finish(ctx, blanket, 0.025);
  ctx.fillStyle = 'rgba(255, 250, 235, 0.6)';
  ctx.fillRect(p.x + 0.14, p.y + 0.7, p.w - 0.28, 0.12);
  if (fine) {
    // An embroidered band across the foot.
    ctx.fillStyle = 'rgba(210, 173, 92, 0.85)';
    ctx.fillRect(p.x + 0.14, p.y + p.h - 0.42, p.w - 0.28, 0.07);
  }
  ctx.strokeStyle = 'rgba(20, 12, 6, 0.25)';
  ctx.lineWidth = 0.02;
  ctx.beginPath();
  for (const share of [0.5, 0.72]) {
    ctx.moveTo(p.x + 0.16, p.y + p.h * share);
    ctx.quadraticCurveTo(p.x + p.w / 2, p.y + p.h * share + 0.08, p.x + p.w - 0.16, p.y + p.h * share);
  }
  ctx.stroke();
  const each = (p.w - 0.36) / pillows;
  for (let k = 0; k < pillows; k++) {
    ctx.beginPath();
    box(ctx, p.x + 0.2 + k * each, p.y + 0.2, each - 0.04, 0.38, 0.1);
    finish(ctx, '#f4ecd8', 0.025);
  }
}

/** A straw mattress on the floor, lumpy and stained, with a rough blanket thrown over it. */
function strawBed(ctx: Ctx, p: Furniture, rng: Rng): void {
  ctx.beginPath();
  box(ctx, ...inset(p, 0.1), 0.14);
  finish(ctx, lit(ctx, p.x, p.y, p.w, p.h, '#c9b07a', '#a08a58'), 0.035);
  ctx.strokeStyle = 'rgba(96, 74, 36, 0.5)';
  ctx.lineWidth = 0.018;
  ctx.beginPath();
  for (let k = 0; k < 14; k++) {
    const x = p.x + 0.16 + rng() * (p.w - 0.32);
    const y = p.y + 0.16 + rng() * (p.h - 0.32);
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rng() - 0.5) * 0.3, y + (rng() - 0.5) * 0.3);
  }
  ctx.stroke();
  ctx.beginPath();
  box(ctx, p.x + 0.16, p.y + p.h * 0.45, p.w - 0.3, p.h * 0.45, 0.1);
  ctx.fillStyle = 'rgba(110, 98, 78, 0.85)';
  ctx.fill();
  dot(ctx, p.x + p.w * 0.6, p.y + p.h * 0.3, 0.11, 'rgba(84, 62, 30, 0.3)');
}

const PAINTERS: Record<Furniture['kind'], Painter> = {
  chair: (ctx, p) => seatTop(ctx, p, false),
  stool: (ctx, p) => seatTop(ctx, p, true),

  bench(ctx, p) {
    seatTop(ctx, p, false);
    if (p.variant !== 'broken') return;
    // Snapped off short: a splintered end.
    ctx.fillStyle = '#d2b07a';
    ctx.beginPath();
    ctx.moveTo(p.x + p.w, p.y);
    ctx.lineTo(p.x + p.w + 0.14, p.y + p.h * 0.3);
    ctx.lineTo(p.x + p.w + 0.03, p.y + p.h * 0.55);
    ctx.lineTo(p.x + p.w + 0.18, p.y + p.h);
    ctx.lineTo(p.x + p.w, p.y + p.h);
    ctx.closePath();
    finish(ctx, '#b98c56', 0.025);
  },

  armchair(ctx, p) {
    // Padded back and arms round a deep seat, facing the fire.
    ctx.beginPath();
    box(ctx, p.x, p.y, p.w, p.h, 0.16);
    finish(ctx, lit(ctx, p.x, p.y, p.w, p.h, '#8a3a34', '#5a1f1e'), 0.04);
    const back = p.facing === 'w' ? p.x + p.w - 0.3 : p.x + 0.04;
    ctx.beginPath();
    box(ctx, p.facing === 'w' ? p.x + 0.08 : p.x + 0.26, p.y + 0.16, p.w - 0.34, p.h - 0.32, 0.1);
    finish(ctx, lit(ctx, p.x, p.y, p.w, p.h, '#b24a42', '#822c2a'), 0.025);
    ctx.fillStyle = 'rgba(40, 10, 8, 0.35)';
    ctx.fillRect(back, p.y + 0.12, 0.26, p.h - 0.24);
    dot(ctx, back + 0.13, p.y + p.h * 0.33, 0.028, BRASS);
    dot(ctx, back + 0.13, p.y + p.h * 0.67, 0.028, BRASS);
  },

  'table-round'(ctx, p, rng) {
    const [cx, cy] = centerOf(p);
    const r = Math.min(p.w, p.h) / 2 - 0.06;
    const top = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
    top.addColorStop(0, '#a87644');
    top.addColorStop(1, '#7c5330');
    ctx.beginPath();
    circle(ctx, cx, cy, r);
    finish(ctx, top);
    if (p.variant === 'rich') {
      // A linen cloth, with the table's edge showing round it.
      ctx.beginPath();
      circle(ctx, cx, cy, r - 0.07);
      finish(ctx, lit(ctx, p.x, p.y, p.w, p.h, '#f6efdc', '#d8cdb0'), 0.022);
      ctx.beginPath();
      circle(ctx, cx, cy, r - 0.16);
      ctx.strokeStyle = 'rgba(142, 47, 44, 0.55)';
      ctx.lineWidth = 0.025;
      ctx.stroke();
    } else {
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
    }
    // A poor house does not waste a candle on every table.
    if (p.variant !== 'poor') candle(ctx, cx, cy);
    if (r > 0.5) tableware(ctx, cx - r * 0.55, cy - r * 0.55, r * 1.1, r * 1.1, 3, rng, [cx, cy]);
  },

  'table-long'(ctx, p, rng) {
    ctx.beginPath();
    box(ctx, p.x, p.y, p.w, p.h, 0.08);
    finish(ctx, lit(ctx, p.x, p.y, p.w, p.h, '#a87644', '#7c5330'));
    boards(ctx, p.x + 0.05, p.y, p.w - 0.1, p.h, 2);
    const [cx, cy] = centerOf(p);
    if (p.variant === 'rich') {
      // A runner down the middle.
      ctx.beginPath();
      box(ctx, p.x + 0.12, p.y + p.h * 0.3, p.w - 0.24, p.h * 0.4, 0.03);
      finish(ctx, lit(ctx, p.x, p.y, p.w, p.h, '#a83c36', '#74201f'), 0.02);
      candle(ctx, cx - 0.7, cy);
      candle(ctx, cx + 0.7, cy);
    }
    if (p.variant !== 'poor') candle(ctx, cx, cy);
    tableware(ctx, p.x + 0.25, p.y + 0.14, p.w - 0.5, p.h - 0.28, 5, rng, [cx, cy]);
  },

  bar(ctx, p, rng) {
    const x = p.x + 0.04;
    const y = p.y + 0.14;
    const w = p.w - 0.08;
    const h = p.h - 0.28;
    const [light, dark] =
      p.variant === 'poor'
        ? ['#8a6a46', '#665036']
        : p.variant === 'rich'
          ? ['#8a4a26', '#4f2712']
          : ['#86562e', '#5c391c'];
    ctx.beginPath();
    box(ctx, x, y, w, h, p.variant === 'poor' ? 0.02 : 0.08);
    finish(ctx, lit(ctx, x, y, w, h, light, dark), 0.05);
    boards(ctx, x + 0.06, y, w - 0.12, h, p.variant === 'poor' ? 3 : 1);
    if (p.variant === 'poor') {
      // Rough planks on trestles, with a keg sitting on the end to pour from.
      ctx.beginPath();
      circle(ctx, x + 0.42, y + h / 2, 0.24);
      finish(ctx, WOOD, 0.035);
      ctx.beginPath();
      circle(ctx, x + 0.42, y + h / 2, 0.16);
      ctx.strokeStyle = 'rgba(46, 34, 24, 0.5)';
      ctx.lineWidth = 0.025;
      ctx.stroke();
    } else {
      // The polished rail on the customers' side; brass in a rich house.
      ctx.fillStyle = p.variant === 'rich' ? 'rgba(222, 184, 98, 0.9)' : 'rgba(226, 184, 122, 0.55)';
      ctx.fillRect(x + 0.08, y + h - 0.13, w - 0.16, 0.07);
      for (let at = p.x + 2; at < p.x + p.w - 0.5; at += 3) candle(ctx, at + 0.5, y + h / 2 - 0.05);
    }
    tableware(ctx, x + 0.9, y + 0.12, w - 1.2, h - 0.38, Math.round(p.w * 0.7), rng);
  },

  tap(ctx, p) {
    // A beer pump: a brass base on the bar, a spout, and a tall handle with a dark grip.
    const [cx, cy] = centerOf(p);
    ctx.beginPath();
    box(ctx, cx - 0.13, cy - 0.1, 0.26, 0.2, 0.04);
    finish(ctx, lit(ctx, p.x, p.y, p.w, p.h, '#f0d389', '#a9843a'), 0.025);
    ctx.strokeStyle = '#8a6a2a';
    ctx.lineWidth = 0.05;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy + 0.08);
    ctx.lineTo(cx, cy + 0.2);
    ctx.stroke();
    ctx.strokeStyle = '#2a1c12';
    ctx.lineWidth = 0.075;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 0.06);
    ctx.lineTo(cx, cy - 0.2);
    ctx.stroke();
    ctx.lineCap = 'butt';
    dot(ctx, cx, cy, 0.035, '#fff3c4');
  },

  anvil(ctx, p) {
    const [cx, cy] = centerOf(p);
    // A block of wood, and the anvil on it with its horn to the right.
    ctx.beginPath();
    circle(ctx, cx, cy, 0.32);
    finish(ctx, lit(ctx, p.x, p.y, p.w, p.h, WOOD_LIGHT, WOOD_DARK));
    ctx.beginPath();
    ctx.moveTo(cx - 0.3, cy - 0.12);
    ctx.lineTo(cx + 0.14, cy - 0.14);
    ctx.lineTo(cx + 0.38, cy);
    ctx.lineTo(cx + 0.14, cy + 0.14);
    ctx.lineTo(cx - 0.3, cy + 0.12);
    ctx.closePath();
    finish(ctx, lit(ctx, cx - 0.3, cy - 0.15, 0.7, 0.3, '#9a9792', IRON), 0.035);
  },

  forge(ctx, p) {
    // A brick hearth with a bed of burning coal.
    ctx.beginPath();
    box(ctx, ...inset(p, 0.06), 0.08);
    finish(ctx, lit(ctx, p.x, p.y, p.w, p.h, '#93604c', '#5a352a'), 0.05);
    ctx.strokeStyle = 'rgba(40, 20, 14, 0.45)';
    ctx.lineWidth = 0.02;
    ctx.beginPath();
    for (let k = 1; k < p.h * 3; k++) {
      ctx.moveTo(p.x + 0.1, p.y + k / 3);
      ctx.lineTo(p.x + p.w - 0.1, p.y + k / 3);
    }
    ctx.stroke();
    const [cx, cy] = centerOf(p);
    const radius = Math.min(p.w, p.h) * 0.3;
    ctx.beginPath();
    circle(ctx, cx, cy, radius);
    finish(ctx, '#1f1a17', 0.04);
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    glow.addColorStop(0, '#ffe08a');
    glow.addColorStop(0.5, '#f0782a');
    glow.addColorStop(1, 'rgba(120, 30, 10, 0.25)');
    ctx.beginPath();
    circle(ctx, cx, cy, radius * 0.86);
    ctx.fillStyle = glow;
    ctx.fill();
  },

  workbench(ctx, p, rng) {
    ctx.beginPath();
    box(ctx, p.x + 0.06, p.y + 0.14, p.w - 0.12, p.h - 0.28);
    finish(ctx, lit(ctx, p.x, p.y, p.w, p.h, WOOD_LIGHT, WOOD));
    boards(ctx, p.x + 0.06, p.y + 0.14, p.w - 0.12, p.h - 0.28, 2);
    // Tools left where they were last used.
    for (let k = 0; k < Math.floor(p.w * 1.5); k++) {
      ctx.save();
      ctx.translate(p.x + 0.3 + rng() * (p.w - 0.6), p.y + 0.34 + rng() * (p.h - 0.68));
      ctx.rotate(rng() * Math.PI);
      ctx.fillStyle = WOOD_DARK;
      ctx.fillRect(-0.15, -0.02, 0.24, 0.04);
      ctx.fillStyle = rng() < 0.5 ? IRON : '#a9a6a0';
      ctx.fillRect(0.06, -0.055, 0.1, 0.11);
      ctx.restore();
    }
  },

  'weapon-rack'(ctx, p, rng) {
    ctx.fillStyle = lit(ctx, p.x, p.y, p.w, p.h, '#6e4826', WOOD_DARK);
    ctx.fillRect(p.x, p.y, p.w, p.h);
    // Blades and hafts side by side, across the board.
    const along = p.w >= p.h;
    const count = Math.round((along ? p.w : p.h) * 4);
    for (let k = 0; k < count; k++) {
      const at = (k + 0.5) / count;
      const steel = rng() < 0.6;
      ctx.strokeStyle = steel ? '#c2bfb7' : WOOD_LIGHT;
      ctx.lineWidth = steel ? 0.04 : 0.03;
      ctx.beginPath();
      if (along) {
        ctx.moveTo(p.x + p.w * at, p.y + p.h * 0.08);
        ctx.lineTo(p.x + p.w * at, p.y + p.h * 0.92);
      } else {
        ctx.moveTo(p.x + p.w * 0.08, p.y + p.h * at);
        ctx.lineTo(p.x + p.w * 0.92, p.y + p.h * at);
      }
      ctx.stroke();
      if (along) dot(ctx, p.x + p.w * at, p.y + p.h * 0.2, 0.03, steel ? BRASS : IRON);
      else dot(ctx, p.x + p.w * 0.2, p.y + p.h * at, 0.03, steel ? BRASS : IRON);
    }
  },

  throne(ctx, p) {
    ctx.beginPath();
    box(ctx, ...inset(p, 0.1), 0.1);
    finish(ctx, lit(ctx, p.x, p.y, p.w, p.h, BRASS, '#8a6a2a'));
    ctx.beginPath();
    box(ctx, ...inset(p, 0.25), 0.08);
    finish(ctx, '#8c2f2f', 0.03);
    // The high back, on the side away from where it faces.
    const back: Record<string, [number, number, number, number]> = {
      s: [p.x + 0.1, p.y + 0.05, p.w - 0.2, 0.2],
      n: [p.x + 0.1, p.y + p.h - 0.25, p.w - 0.2, 0.2],
      e: [p.x + 0.05, p.y + 0.1, 0.2, p.h - 0.2],
      w: [p.x + p.w - 0.25, p.y + 0.1, 0.2, p.h - 0.2],
    };
    ctx.beginPath();
    box(ctx, ...back[p.facing ?? 's'], 0.06);
    finish(ctx, lit(ctx, p.x, p.y, p.w, p.h, '#e6c878', BRASS), 0.03);
  },

  altar(ctx, p) {
    const top: [number, number, number, number] = [p.x + 0.08, p.y + 0.14, p.w - 0.16, p.h - 0.28];
    ctx.beginPath();
    box(ctx, ...top, 0.04);
    finish(ctx, lit(ctx, p.x, p.y, p.w, p.h, '#d9d4c7', '#9c978a'));
    // A cloth down the middle, with a gold edge either side.
    ctx.fillStyle = '#8c2f2f';
    ctx.fillRect(p.x + p.w / 2 - 0.32, top[1], 0.64, top[3]);
    ctx.fillStyle = BRASS;
    ctx.fillRect(p.x + p.w / 2 - 0.32, top[1], 0.05, top[3]);
    ctx.fillRect(p.x + p.w / 2 + 0.27, top[1], 0.05, top[3]);
    const [cx, cy] = centerOf(p);
    dot(ctx, cx, cy, 0.1, BRASS);
    candle(ctx, p.x + 0.3, cy);
    candle(ctx, p.x + p.w - 0.3, cy);
  },

  statue(ctx, p) {
    ctx.beginPath();
    box(ctx, ...inset(p, 0.14), 0.04);
    finish(ctx, lit(ctx, p.x, p.y, p.w, p.h, '#c9c4b6', '#8f8a7d'));
    const [cx, cy] = centerOf(p);
    ctx.beginPath();
    circle(ctx, cx, cy, 0.23);
    finish(ctx, lit(ctx, cx - 0.2, cy - 0.2, 0.4, 0.4, '#e6e1d4', '#a09b8e'), 0.035);
    ctx.beginPath();
    circle(ctx, cx, cy - 0.02, 0.1);
    finish(ctx, '#d2cdc0', 0.025);
  },

  pillar(ctx, p) {
    const [cx, cy] = centerOf(p);
    ctx.beginPath();
    circle(ctx, cx, cy, 0.36);
    finish(ctx, lit(ctx, p.x, p.y, p.w, p.h, '#d2cdc0', '#8f8a7d'));
    ctx.beginPath();
    circle(ctx, cx, cy, 0.25);
    ctx.strokeStyle = 'rgba(60, 54, 46, 0.5)';
    ctx.lineWidth = 0.03;
    ctx.stroke();
  },

  shelf(ctx, p, rng) {
    ctx.fillStyle = lit(ctx, p.x, p.y, p.w, p.h, '#6e4826', WOOD_DARK);
    ctx.fillRect(p.x, p.y, p.w, p.h);
    switch (p.variant) {
      case 'books': {
        // Spines of every color, shoulder to shoulder.
        const count = Math.round(p.w * 9);
        const spines = ['#7a2e2a', '#2f4f7a', '#3f6a46', '#8a6a2a', '#5a3a6a', '#3a3530', '#9a8a6a'];
        for (let k = 0; k < count; k++) {
          ctx.fillStyle = spines[Math.floor(rng() * spines.length)];
          ctx.fillRect(p.x + (p.w * k) / count + 0.008, p.y + p.h * 0.12, p.w / count - 0.016, p.h * 0.76);
        }
        break;
      }
      case 'empty':
        break;
      case 'broken':
        // Hanging by one bracket, with one bottle left on it.
        ctx.fillStyle = 'rgba(20, 12, 6, 0.5)';
        ctx.beginPath();
        ctx.moveTo(p.x + p.w * 0.45, p.y);
        ctx.lineTo(p.x + p.w, p.y);
        ctx.lineTo(p.x + p.w, p.y + p.h);
        ctx.lineTo(p.x + p.w * 0.6, p.y + p.h);
        ctx.closePath();
        ctx.fill();
        shelfRow(ctx, { ...p, w: p.w * 0.4 }, ['#5f7f4f'], 1, 0.07, rng);
        break;
      case 'few':
        shelfRow(ctx, { ...p, w: p.w * 0.55 }, ['#5f7f4f', '#7a3b2e'], 2, 0.07, rng);
        break;
      case 'mugs':
        shelfRow(ctx, p, ['#a9793a', '#8f6236', '#b8905a'], 4, 0.08, rng);
        break;
      case 'jugs':
        shelfRow(ctx, p, ['#b08a5e', '#9a6a44', '#c9b08a'], 3, 0.11, rng);
        break;
      case 'kegs':
        shelfRow(ctx, p, ['#8f6236', '#7a5230'], 2, 0.13, rng);
        break;
      case 'plates':
        shelfRow(ctx, p, ['#e6dcc4', '#d8cdb0'], 3, 0.11, rng);
        break;
      case 'glasses':
        shelfRow(ctx, p, ['rgba(214, 236, 240, 0.9)', 'rgba(190, 220, 228, 0.9)'], 5, 0.06, rng);
        break;
      case 'fine':
        // Good bottles, in rows by color.
        shelfRow(ctx, p, ['#2f5a3a', '#6a1f2a', '#c08a2a', '#2f4a6a'], 5, 0.07, rng);
        break;
      default:
        shelfRow(ctx, p, ['#5f7f4f', '#b07a2a', '#7a3b2e', '#4f6a7a'], 4, 0.075, rng);
    }
  },

  pantry(ctx, p, rng) {
    ctx.fillStyle = lit(ctx, p.x, p.y, p.w, p.h, '#7a5632', WOOD_DARK);
    ctx.fillRect(p.x, p.y, p.w, p.h);
    // Jars and crocks: mismatched and few in a poor kitchen, rows of them in a rich one.
    const jars = ['#c9b08a', '#a0522d', '#d8c070', '#7d8c4a', '#b2553a', '#e6dcc4'];
    shelfRow(ctx, p, jars, p.variant === 'poor' ? 2 : p.variant === 'rich' ? 5 : 3, 0.085, rng);
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

  logs(ctx, p, rng) {
    // A stack of split firewood, cut ends showing.
    for (const [dx, dy] of [
      [0.2, 0.26],
      [0.2, 0.5],
      [0.2, 0.74],
    ]) {
      ctx.beginPath();
      box(ctx, p.x + dx - 0.06, p.y + dy - 0.1, 0.72, 0.2, 0.08);
      finish(ctx, lit(ctx, p.x, p.y + dy - 0.1, 1, 0.2, '#8a5c34', '#5c3a1e'), 0.025);
      const end = p.x + dx + 0.6 + (rng() - 0.5) * 0.04;
      ctx.beginPath();
      circle(ctx, end, p.y + dy, 0.09);
      finish(ctx, '#d2b07a', 0.02);
      dot(ctx, end, p.y + dy, 0.03, 'rgba(96, 64, 30, 0.6)');
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
    const [x, y, w, h] = inset(p, 0.08);
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    finish(ctx, lit(ctx, x, y, w, h, '#b88a54', '#94693c'), 0.07);
    boards(ctx, x + 0.04, y, w - 0.08, h, 5);
    // A raised lip all round, catching the light.
    ctx.strokeStyle = 'rgba(240, 206, 150, 0.4)';
    ctx.lineWidth = 0.04;
    ctx.strokeRect(x + 0.08, y + 0.08, w - 0.16, h - 0.16);
    if (p.variant === 'rich') {
      // A velvet curtain gathered along the back.
      ctx.fillStyle = lit(ctx, x, y + h - 0.3, w, 0.3, '#9a2f38', '#5e1620');
      ctx.fillRect(x + 0.1, y + h - 0.32, w - 0.2, 0.22);
      ctx.strokeStyle = 'rgba(40, 8, 12, 0.5)';
      ctx.lineWidth = 0.02;
      ctx.beginPath();
      for (let fold = x + 0.25; fold < x + w - 0.15; fold += 0.2) {
        ctx.moveTo(fold, y + h - 0.32);
        ctx.lineTo(fold, y + h - 0.1);
      }
      ctx.stroke();
    } else if (p.variant === 'poor') {
      // A board has gone, and nobody has mended it.
      ctx.fillStyle = 'rgba(20, 12, 6, 0.75)';
      ctx.fillRect(x + w * 0.55, y + h * 0.3, w * 0.3, 0.14);
    }
  },

  stove(ctx, p) {
    ctx.beginPath();
    box(ctx, p.x + 0.06, p.y + 0.08, p.w - 0.12, p.h - 0.16);
    finish(ctx, lit(ctx, p.x, p.y, p.w, p.h, '#5a5450', '#2f2b28'), 0.05);
    const cy = p.y + p.h / 2;
    // One burner glowing, the other with a pot of stew on it.
    const fireX = p.x + p.w * 0.28;
    dot(ctx, fireX, cy, 0.24, '#191513');
    const coals = ctx.createRadialGradient(fireX, cy, 0, fireX, cy, 0.2);
    coals.addColorStop(0, 'rgba(255, 196, 90, 0.95)');
    coals.addColorStop(1, 'rgba(210, 70, 20, 0.5)');
    ctx.beginPath();
    circle(ctx, fireX, cy, 0.17);
    ctx.fillStyle = coals;
    ctx.fill();
    stewPot(ctx, p.x + p.w * 0.72, cy, 0.26);
  },

  oven(ctx, p) {
    // A domed brick oven, its mouth glowing.
    const [x, y, w, h] = inset(p, 0.05);
    ctx.beginPath();
    box(ctx, x, y, w, h, 0.12);
    finish(ctx, lit(ctx, x, y, w, h, '#b06a48', '#7c4530'), 0.05);
    ctx.strokeStyle = 'rgba(60, 28, 18, 0.45)';
    ctx.lineWidth = 0.02;
    ctx.beginPath();
    for (let row = 1; row * 0.22 < h; row++) {
      ctx.moveTo(x + 0.04, y + row * 0.22);
      ctx.lineTo(x + w - 0.04, y + row * 0.22);
      for (let col = row % 2 ? 0.25 : 0.5; col < w; col += 0.5) {
        ctx.moveTo(x + col, y + (row - 1) * 0.22);
        ctx.lineTo(x + col, y + row * 0.22);
      }
    }
    ctx.stroke();
    const cx = x + w / 2;
    const mouthY = y + h - 0.3;
    ctx.beginPath();
    ctx.ellipse(cx, mouthY, Math.min(0.5, w * 0.3), 0.2, 0, 0, Math.PI * 2);
    finish(ctx, '#1a100a', 0.04);
    const embers = ctx.createRadialGradient(cx, mouthY, 0, cx, mouthY, 0.36);
    embers.addColorStop(0, 'rgba(255, 210, 110, 0.95)');
    embers.addColorStop(1, 'rgba(214, 78, 22, 0)');
    ctx.fillStyle = embers;
    ctx.beginPath();
    ctx.ellipse(cx, mouthY, Math.min(0.42, w * 0.25), 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
    // The chimney.
    dot(ctx, cx, y + 0.3, 0.14, '#2a1c14');
  },

  cauldron(ctx, p) {
    // A pot hung over an open fire on the floor, ringed with stones.
    const [cx, cy] = centerOf(p);
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2;
      ctx.beginPath();
      circle(ctx, cx + Math.cos(a) * 0.4, cy + Math.sin(a) * 0.4, 0.08);
      finish(ctx, '#8f8b80', 0.02);
    }
    const fire = ctx.createRadialGradient(cx, cy, 0, cx, cy, 0.4);
    fire.addColorStop(0, 'rgba(255, 190, 80, 0.9)');
    fire.addColorStop(1, 'rgba(214, 78, 22, 0)');
    ctx.fillStyle = fire;
    ctx.fillRect(cx - 0.4, cy - 0.4, 0.8, 0.8);
    stewPot(ctx, cx, cy, 0.3);
  },

  counter(ctx, p, rng) {
    const x = p.x + 0.06;
    const y = p.y + 0.12;
    const w = p.w - 0.12;
    const h = p.h - 0.24;
    const rough = p.variant === 'rough';
    ctx.beginPath();
    box(ctx, x, y, w, h, rough ? 0.02 : 0.06);
    finish(
      ctx,
      rough ? lit(ctx, x, y, w, h, '#a08460', '#7a6244') : lit(ctx, x, y, w, h, '#c59a62', '#9d7646'),
    );
    boards(ctx, x + 0.04, y, w - 0.08, h, rough ? 3 : 2);
    // A cutting board with whatever is being prepared, and a knife beside it.
    ctx.beginPath();
    box(ctx, x + 0.14, y + 0.1, 0.66, h - 0.2, 0.04);
    finish(ctx, '#d8b47c', 0.025);
    const bx = x + 0.47;
    const by = y + h / 2;
    switch (p.variant) {
      case 'meat':
        ctx.beginPath();
        ctx.ellipse(bx, by, 0.2, 0.13, 0.3, 0, Math.PI * 2);
        finish(ctx, '#b2453c', 0.022);
        dot(ctx, bx + 0.05, by, 0.05, '#f0dcc8');
        break;
      case 'fish':
        ctx.beginPath();
        ctx.ellipse(bx - 0.03, by, 0.2, 0.08, 0, 0, Math.PI * 2);
        ctx.moveTo(bx + 0.15, by);
        ctx.lineTo(bx + 0.27, by - 0.09);
        ctx.lineTo(bx + 0.27, by + 0.09);
        ctx.closePath();
        finish(ctx, '#9fb4bd', 0.02);
        break;
      case 'vegetables':
        for (const [dx, dy, color] of [
          [-0.12, -0.05, '#d08a2e'],
          [0.02, 0.06, '#6f8f3e'],
          [0.13, -0.04, '#b6452c'],
          [-0.03, -0.09, '#e2d3a0'],
        ] as const) {
          ctx.beginPath();
          circle(ctx, bx + dx, by + dy, 0.07);
          finish(ctx, color, 0.018);
        }
        break;
      case 'pie':
        ctx.beginPath();
        circle(ctx, bx, by, 0.17);
        finish(ctx, '#d6a45a', 0.022);
        ctx.strokeStyle = 'rgba(110, 66, 24, 0.7)';
        ctx.lineWidth = 0.02;
        ctx.beginPath();
        for (let k = 0; k < 3; k++) {
          const a = (k / 3) * Math.PI;
          ctx.moveTo(bx - Math.cos(a) * 0.15, by - Math.sin(a) * 0.15);
          ctx.lineTo(bx + Math.cos(a) * 0.15, by + Math.sin(a) * 0.15);
        }
        ctx.stroke();
        break;
      default:
        // A loaf of bread.
        ctx.beginPath();
        ctx.ellipse(bx - 0.06, by, 0.19, 0.11, 0.35, 0, Math.PI * 2);
        finish(ctx, '#c08a44', 0.022);
    }
    ctx.strokeStyle = '#d9dadb';
    ctx.lineWidth = 0.035;
    ctx.beginPath();
    ctx.moveTo(x + 0.9, y + 0.18);
    ctx.lineTo(x + 0.98, y + h - 0.2);
    ctx.stroke();
    if (rough) return;
    // Bowls and a few loose ingredients on the rest of the top.
    for (let k = 0; k < 2; k++) {
      const cx = x + 1.2 + rng() * (w - 1.45);
      const cy = y + 0.2 + rng() * (h - 0.4);
      ctx.beginPath();
      circle(ctx, cx, cy, 0.1);
      finish(ctx, '#ddd2b8', 0.02);
      dot(ctx, cx, cy, 0.065, ['#b6452c', '#d08a2e', '#6f8f3e', '#f1e7cc'][Math.floor(rng() * 4)]);
    }
  },

  washtub(ctx, p) {
    const [cx, cy] = centerOf(p);
    ctx.beginPath();
    circle(ctx, cx, cy, 0.4);
    finish(ctx, lit(ctx, p.x, p.y, p.w, p.h, '#a0723f', '#70492a'));
    waterIn(ctx, cx, cy, 0.3);
  },

  bucket(ctx, p) {
    const [cx, cy] = centerOf(p);
    ctx.beginPath();
    circle(ctx, cx, cy, p.w / 2);
    finish(ctx, lit(ctx, p.x, p.y, p.w, p.h, '#9a7244', '#6a4a2a'), 0.03);
    waterIn(ctx, cx, cy, p.w / 2 - 0.06);
    // The handle, lying across the rim.
    ctx.strokeStyle = IRON;
    ctx.lineWidth = 0.025;
    ctx.beginPath();
    ctx.arc(cx, cy, p.w / 2 + 0.02, 3.5, 6);
    ctx.stroke();
  },

  barrel(ctx, p, rng) {
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
    if (p.variant === 'table') {
      // Doing duty as a table: mugs on the lid.
      mug(ctx, cx - 0.12, cy - 0.06, rng);
      mug(ctx, cx + 0.13, cy + 0.1, rng);
    } else {
      dot(ctx, cx, cy, 0.035, INK);
    }
  },

  keg(ctx, p) {
    // A big cask lying on its side in a cradle, tap toward the room.
    ctx.fillStyle = WOOD_DARK;
    ctx.fillRect(p.x + 0.12, p.y + 0.2, 0.1, p.h - 0.34);
    ctx.fillRect(p.x + p.w - 0.22, p.y + 0.2, 0.1, p.h - 0.34);
    ctx.beginPath();
    box(ctx, p.x + 0.1, p.y + 0.16, p.w - 0.2, p.h - 0.26, 0.16);
    const side = ctx.createLinearGradient(p.x, p.y, p.x + p.w, p.y);
    side.addColorStop(0, '#7a5230');
    side.addColorStop(0.45, '#b98c56');
    side.addColorStop(1, '#6a4526');
    finish(ctx, side);
    ctx.strokeStyle = 'rgba(46, 34, 24, 0.4)';
    ctx.lineWidth = 0.02;
    ctx.beginPath();
    for (const share of [0.3, 0.5, 0.7]) {
      ctx.moveTo(p.x + p.w * share, p.y + 0.18);
      ctx.lineTo(p.x + p.w * share, p.y + p.h - 0.12);
    }
    ctx.stroke();
    ctx.fillStyle = '#4f4a46';
    ctx.fillRect(p.x + 0.1, p.y + 0.28, p.w - 0.2, 0.06);
    ctx.fillRect(p.x + 0.1, p.y + p.h - 0.26, p.w - 0.2, 0.06);
    dot(ctx, p.x + p.w / 2, p.y + p.h - 0.1, 0.05, BRASS);
  },

  crate(ctx, p, rng) {
    const [x, y, w, h] = inset(p, 0.13);
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    finish(ctx, lit(ctx, x, y, w, h, '#b58a56', '#8a6238'));
    boards(ctx, x, y, w, h, 3);
    if (p.variant === 'broken') {
      // Staved in: a dark hole and splinters, straw spilling out.
      ctx.beginPath();
      ctx.moveTo(x + w * 0.35, y + h * 0.2);
      ctx.lineTo(x + w * 0.8, y + h * 0.35);
      ctx.lineTo(x + w * 0.62, y + h * 0.8);
      ctx.lineTo(x + w * 0.25, y + h * 0.6);
      ctx.closePath();
      ctx.fillStyle = '#20150c';
      ctx.fill();
      ctx.strokeStyle = '#d8c080';
      ctx.lineWidth = 0.02;
      ctx.beginPath();
      for (let k = 0; k < 7; k++) {
        ctx.moveTo(x + w * 0.5, y + h * 0.5);
        ctx.lineTo(x + w * (0.2 + rng() * 0.7), y + h * (0.15 + rng() * 0.75));
      }
      ctx.stroke();
      return;
    }
    // Frame and brace nailed over the boards.
    ctx.strokeStyle = '#6e4a28';
    ctx.lineWidth = 0.07;
    ctx.strokeRect(x + 0.045, y + 0.045, w - 0.09, h - 0.09);
    ctx.beginPath();
    ctx.moveTo(x + 0.08, y + 0.08);
    ctx.lineTo(x + w - 0.08, y + h - 0.08);
    ctx.stroke();
    if (p.variant === 'stack') {
      // A smaller crate stacked squarely on top.
      ctx.beginPath();
      ctx.rect(x + 0.12, y + 0.12, w - 0.3, h - 0.3);
      ctx.save();
      ctx.shadowColor = 'rgba(22, 12, 3, 0.5)';
      ctx.shadowBlur = 6;
      finish(ctx, lit(ctx, x, y, w, h, '#c59a62', '#9d7646'), 0.035);
      ctx.restore();
      ctx.strokeStyle = '#6e4a28';
      ctx.lineWidth = 0.05;
      ctx.strokeRect(x + 0.17, y + 0.17, w - 0.4, h - 0.4);
    }
  },

  sacks(ctx, p, rng) {
    // Two or three stuffed sacks slumped together, tied at the neck.
    for (const [dx, dy, r] of [
      [0.36, 0.4, 0.26],
      [0.64, 0.5, 0.24],
      [0.46, 0.68, 0.22],
    ] as const) {
      const cx = p.x + dx + (rng() - 0.5) * 0.04;
      const cy = p.y + dy;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r, r * 0.86, rng(), 0, Math.PI * 2);
      finish(ctx, lit(ctx, cx - r, cy - r, r * 2, r * 2, '#d8c8a0', '#a8946a'), 0.03);
      dot(ctx, cx, cy - r * 0.2, 0.045, '#8a744a');
    }
  },

  bed(ctx, p, rng) {
    // Beds are drawn head up; one lying along a wall is the same picture turned.
    const lying = p.w > p.h;
    ctx.save();
    let frame = p;
    if (lying) {
      const [cx, cy] = centerOf(p);
      ctx.translate(cx, cy);
      ctx.rotate(-Math.PI / 2);
      ctx.translate(-cx, -cy);
      frame = { ...p, x: cx - p.h / 2, y: cy - p.w / 2, w: p.h, h: p.w };
    }
    if (p.variant === 'straw') strawBed(ctx, frame, rng);
    else bedding(ctx, frame, 1, rng);
    ctx.restore();
  },

  'bed-double': (ctx, p, rng) => bedding(ctx, p, 2, rng),

  chest(ctx, p) {
    const x = p.x + 0.14;
    const y = p.y + 0.24;
    const w = p.w - 0.28;
    const h = p.h - 0.48;
    ctx.beginPath();
    box(ctx, x, y, w, h);
    finish(ctx, lit(ctx, x, y, w, h, '#86562e', '#5c391c'));
    // Iron bands, or brass on a fine one, and a lock.
    ctx.fillStyle = p.variant === 'fine' ? BRASS : IRON;
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

  wardrobe(ctx, p) {
    // Seen from above: a deep cabinet against the wall, two doors with knobs on the front edge.
    const x = p.x + 0.06;
    const y = p.y + 0.16;
    const w = p.w - 0.12;
    const h = p.h - 0.22;
    const fine = p.variant === 'fine';
    ctx.beginPath();
    box(ctx, x, y, w, h, 0.04);
    finish(
      ctx,
      fine ? lit(ctx, x, y, w, h, '#7a4a26', '#4a2a12') : lit(ctx, x, y, w, h, '#93663c', '#6a4526'),
    );
    ctx.strokeStyle = 'rgba(20, 12, 6, 0.55)';
    ctx.lineWidth = 0.025;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y);
    ctx.lineTo(x + w / 2, y + h);
    ctx.stroke();
    ctx.strokeStyle = fine ? 'rgba(210, 173, 92, 0.6)' : 'rgba(226, 190, 140, 0.3)';
    ctx.strokeRect(x + 0.1, y + 0.1, w / 2 - 0.2, h - 0.2);
    ctx.strokeRect(x + w / 2 + 0.1, y + 0.1, w / 2 - 0.2, h - 0.2);
    dot(ctx, x + w / 2 - 0.09, y + h / 2, 0.035, BRASS);
    dot(ctx, x + w / 2 + 0.09, y + h / 2, 0.035, BRASS);
  },

  nightstand(ctx, p) {
    // A small table by the bed, with a candle on it.
    ctx.beginPath();
    box(ctx, ...inset(p, 0.2), 0.04);
    finish(ctx, lit(ctx, p.x, p.y, p.w, p.h, p.variant === 'fine' ? '#8a5a2e' : '#a87644', '#6a4526'));
    const [cx, cy] = centerOf(p);
    if (p.variant === 'fine') {
      ctx.beginPath();
      box(ctx, p.x + 0.27, p.y + 0.27, p.w - 0.54, p.h - 0.54, 0.03);
      ctx.fillStyle = LINEN;
      ctx.fill();
    }
    candle(ctx, cx, cy);
  },

  desk(ctx, p) {
    // A writing desk: paper, an inkwell and a quill.
    const x = p.x + 0.08;
    const y = p.y + 0.16;
    const w = p.w - 0.16;
    const h = p.h - 0.3;
    ctx.beginPath();
    box(ctx, x, y, w, h, 0.04);
    finish(ctx, lit(ctx, x, y, w, h, '#8a5a2e', '#5a3418'));
    ctx.save();
    ctx.translate(x + w * 0.42, y + h * 0.5);
    ctx.rotate(-0.2);
    ctx.fillStyle = '#f2ead6';
    ctx.fillRect(-0.17, -0.2, 0.34, 0.4);
    ctx.strokeStyle = 'rgba(46, 34, 24, 0.4)';
    ctx.lineWidth = 0.012;
    ctx.beginPath();
    for (const line of [-0.1, -0.03, 0.04]) {
      ctx.moveTo(-0.12, line);
      ctx.lineTo(0.12, line);
    }
    ctx.stroke();
    ctx.restore();
    dot(ctx, x + w * 0.8, y + h * 0.3, 0.06, '#1c1410');
    ctx.strokeStyle = '#e8e0cc';
    ctx.lineWidth = 0.025;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.78, y + h * 0.36);
    ctx.lineTo(x + w * 0.62, y + h * 0.82);
    ctx.stroke();
  },

  plant(ctx, p, rng) {
    // A potted plant, leaves fanning out over the rim.
    const [cx, cy] = centerOf(p);
    ctx.beginPath();
    circle(ctx, cx, cy, 0.24);
    finish(ctx, lit(ctx, p.x, p.y, p.w, p.h, '#b06a48', '#7c4530'), 0.035);
    dot(ctx, cx, cy, 0.17, '#3a2a1a');
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2 + rng() * 0.3;
      ctx.beginPath();
      ctx.ellipse(cx + Math.cos(a) * 0.2, cy + Math.sin(a) * 0.2, 0.2, 0.08, a, 0, Math.PI * 2);
      finish(ctx, k % 2 ? '#4f7a3a' : '#6a9448', 0.018);
    }
  },

  rug(ctx, p) {
    const fine = p.variant !== 'plain';
    // Fringe at both ends, then the woven field with a border and a medallion.
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
    const [light, dark] = p.variant === 'room' ? ['#3f5f7a', '#2a4258'] : ['#9a4138', '#7c2f2a'];
    ctx.beginPath();
    box(ctx, p.x, p.y, p.w, p.h, 0.05);
    const weave = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.h);
    weave.addColorStop(0, light);
    weave.addColorStop(1, dark);
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
    if (fine) {
      ctx.lineWidth = 0.02;
      ctx.beginPath();
      box(ctx, p.x + 0.2, p.y + 0.2, p.w - 0.4, p.h - 0.4, 0.02);
      ctx.stroke();
    }
    const [cx, cy] = centerOf(p);
    const reach = Math.min(p.w, p.h * 1.6) * 0.3;
    ctx.beginPath();
    ctx.moveTo(cx - reach, cy);
    ctx.lineTo(cx, cy - Math.min(p.h * 0.26, reach));
    ctx.lineTo(cx + reach, cy);
    ctx.lineTo(cx, cy + Math.min(p.h * 0.26, reach));
    ctx.closePath();
    ctx.fillStyle = p.variant === 'room' ? 'rgba(210, 173, 92, 0.8)' : 'rgba(52, 78, 96, 0.75)';
    ctx.fill();
    ctx.lineWidth = 0.03;
    ctx.stroke();
  },

  stain(ctx, p, rng) {
    // Something spilled and left: a blotch with a few splashes round it.
    const [cx, cy] = centerOf(p);
    const color = p.variant === 'beer' ? '120, 84, 28' : p.variant === 'mud' ? '70, 56, 36' : '34, 22, 12';
    const blot = (x: number, y: number, rx: number, ry: number, alpha: number) => {
      const fade = ctx.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
      fade.addColorStop(0, `rgba(${color}, ${alpha})`);
      fade.addColorStop(0.7, `rgba(${color}, ${alpha * 0.7})`);
      fade.addColorStop(1, `rgba(${color}, 0)`);
      ctx.fillStyle = fade;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, rng() * 3, 0, Math.PI * 2);
      ctx.fill();
    };
    blot(cx, cy, p.w / 2, p.h / 2, 0.42);
    for (let k = 0; k < 4; k++) {
      blot(cx + (rng() - 0.5) * p.w, cy + (rng() - 0.5) * p.h, 0.1 + rng() * 0.14, 0.08 + rng() * 0.1, 0.36);
    }
  },

  straw(ctx, p, rng) {
    // Loose straw strewn on the floor.
    const [cx, cy] = centerOf(p);
    ctx.lineWidth = 0.018;
    for (let k = 0; k < 38; k++) {
      const a = rng() * Math.PI * 2;
      const d = Math.sqrt(rng()) * (p.w / 2);
      const x = cx + Math.cos(a) * d;
      const y = cy + Math.sin(a) * d * (p.h / p.w);
      const turn = rng() * Math.PI;
      const half = 0.07 + rng() * 0.1;
      ctx.strokeStyle = rng() < 0.5 ? 'rgba(216, 190, 120, 0.75)' : 'rgba(170, 142, 78, 0.7)';
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(turn) * half, y - Math.sin(turn) * half);
      ctx.lineTo(x + Math.cos(turn) * half, y + Math.sin(turn) * half);
      ctx.stroke();
    }
  },

  bottle(ctx, p) {
    // An empty bottle rolled against something.
    ctx.beginPath();
    box(ctx, p.x, p.y, p.w * 0.66, p.h, 0.05);
    finish(ctx, '#4f7350', 0.02);
    ctx.fillStyle = '#4f7350';
    ctx.fillRect(p.x + p.w * 0.64, p.y + p.h * 0.3, p.w * 0.34, p.h * 0.4);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillRect(p.x + 0.04, p.y + 0.03, p.w * 0.4, 0.03);
  },

  debris(ctx, p) {
    // What is left of a chair: the seat, a leg or two, splinters.
    ctx.beginPath();
    box(ctx, p.x + 0.05, p.y + 0.12, 0.38, 0.34, 0.06);
    finish(ctx, lit(ctx, p.x, p.y, p.w, p.h, '#93663c', '#6a4526'), 0.03);
    ctx.strokeStyle = '#7c5330';
    ctx.lineWidth = 0.06;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(p.x + 0.4, p.y + 0.06);
    ctx.lineTo(p.x + 0.58, p.y + 0.3);
    ctx.moveTo(p.x + 0.12, p.y + 0.52);
    ctx.lineTo(p.x + 0.44, p.y + 0.58);
    ctx.stroke();
    ctx.strokeStyle = '#d2b07a';
    ctx.lineWidth = 0.02;
    ctx.beginPath();
    ctx.moveTo(p.x + 0.46, p.y + 0.4);
    ctx.lineTo(p.x + 0.56, p.y + 0.46);
    ctx.moveTo(p.x + 0.02, p.y + 0.02);
    ctx.lineTo(p.x + 0.1, p.y + 0.08);
    ctx.stroke();
    ctx.lineCap = 'butt';
  },

  cobweb(ctx, p) {
    // Strands fanning out of a corner, with threads strung between them.
    const east = p.variant?.[1] === 'e';
    const south = p.variant?.[0] === 's';
    const cx = east ? p.x + p.w : p.x;
    const cy = south ? p.y + p.h : p.y;
    const dx = east ? -1 : 1;
    const dy = south ? -1 : 1;
    ctx.strokeStyle = 'rgba(240, 236, 224, 0.6)';
    ctx.lineWidth = 0.014;
    ctx.beginPath();
    const spokes = [0.06, 0.4, 0.8, 1.2, 1.5];
    for (const a of spokes) {
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + dx * Math.cos(a) * 0.8, cy + dy * Math.sin(a) * 0.8);
    }
    for (const ring of [0.28, 0.5, 0.7]) {
      for (let k = 0; k < spokes.length - 1; k++) {
        const [a, b] = [spokes[k], spokes[k + 1]];
        const mid = (a + b) / 2;
        ctx.moveTo(cx + dx * Math.cos(a) * ring, cy + dy * Math.sin(a) * ring);
        ctx.quadraticCurveTo(
          cx + dx * Math.cos(mid) * ring * 0.86,
          cy + dy * Math.sin(mid) * ring * 0.86,
          cx + dx * Math.cos(b) * ring,
          cy + dy * Math.sin(b) * ring,
        );
      }
    }
    ctx.stroke();
  },

  rat(ctx, p) {
    // A rat: body, head, ears and a long tail.
    const [cx, cy] = centerOf(p);
    ctx.strokeStyle = '#8a7468';
    ctx.lineWidth = 0.02;
    ctx.beginPath();
    ctx.moveTo(cx - 0.12, cy);
    ctx.quadraticCurveTo(cx - 0.26, cy + 0.1, cx - 0.36, cy - 0.04);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, cy, 0.14, 0.075, 0, 0, Math.PI * 2);
    finish(ctx, '#6a5a50', 0.018);
    ctx.beginPath();
    ctx.ellipse(cx + 0.15, cy, 0.07, 0.05, 0, 0, Math.PI * 2);
    finish(ctx, '#6a5a50', 0.018);
    dot(ctx, cx + 0.12, cy - 0.05, 0.022, '#a08a80');
    dot(ctx, cx + 0.12, cy + 0.05, 0.022, '#a08a80');
  },
};

/** A pot of stew seen from above, with its handles. */
function stewPot(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.05;
  ctx.beginPath();
  ctx.moveTo(x - r - 0.08, y);
  ctx.lineTo(x + r + 0.08, y);
  ctx.stroke();
  ctx.beginPath();
  circle(ctx, x, y, r);
  finish(ctx, IRON, 0.035);
  dot(ctx, x, y, r * 0.74, '#8a5a2c');
  for (const [dx, dy, color] of [
    [-0.27, -0.15, '#c96f3a'],
    [0.23, 0.19, '#d9c06a'],
    [0.15, -0.3, '#7d8c4a'],
  ] as const) {
    dot(ctx, x + dx * r, y + dy * r, r * 0.14, color);
  }
}

/** Water standing in a tub or bucket. */
function waterIn(ctx: Ctx, x: number, y: number, r: number): void {
  const water = ctx.createRadialGradient(x - r * 0.27, y - r * 0.27, r * 0.07, x, y, r);
  water.addColorStop(0, '#c2dbe0');
  water.addColorStop(1, '#6f97a6');
  ctx.beginPath();
  circle(ctx, x, y, r);
  finish(ctx, water, 0.025);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 0.02;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.56, 3.6, 5.2);
  ctx.stroke();
}
