import {
  SHEET_COLUMNS,
  SHEET_ROWS,
  sheetCell,
  SPRITE_ANIMATIONS,
  SPRITE_FACINGS,
  SPRITE_FRAMES,
  spritePose,
  type SpriteFacing,
  type SpriteLook,
  type SpritePose,
} from '../npc/sprite.ts';

/** The side of one frame, in the units everything here is measured in. */
export const FRAME = 64;

type Ctx = CanvasRenderingContext2D;

/** The same ink as the maps, so that a figure set down on one belongs there. */
const INK = '#2b2118';
const STEEL = '#d9dde2';
const WOOD = '#8f6236';
const BRASS = '#d2ad5c';
/** Where the feet stand, from the top of the frame. */
const GROUND = FRAME - 7;

function shade(color: string, amount: number): string {
  const value = parseInt(color.slice(1), 16);
  const channel = (shift: number) => {
    const c = (value >> shift) & 255;
    return Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount);
  };
  return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`;
}

const paint = (ctx: Ctx, fill: string, width = 1.2) => {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = width;
  ctx.strokeStyle = INK;
  ctx.stroke();
};

const disc = (ctx: Ctx, x: number, y: number, r: number, fill: string, width = 1.2) => {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (width > 0) paint(ctx, fill, width);
  else {
    ctx.fillStyle = fill;
    ctx.fill();
  }
};

const oval = (ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string, width = 1.2) => {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  if (width > 0) paint(ctx, fill, width);
  else {
    ctx.fillStyle = fill;
    ctx.fill();
  }
};

const block = (ctx: Ctx, x: number, y: number, w: number, h: number, radius: number, fill: string) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, Math.max(0.5, h), radius);
  paint(ctx, fill);
};

/** The point a limb of this length ends at. An angle of 0 hangs straight down; it grows toward +x. */
const reach = (x: number, y: number, angle: number, length: number): [number, number] => [
  x + Math.sin(angle) * length,
  y + Math.cos(angle) * length,
];

/** An arm or a leg: a rounded bar from a joint, with a hand or a boot at its end. */
function limb(
  ctx: Ctx,
  x: number,
  y: number,
  angle: number,
  length: number,
  width: number,
  fill: string,
  end: string,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-angle);
  ctx.beginPath();
  ctx.roundRect(-width / 2, -width / 3, width, length + width / 3, width / 2);
  paint(ctx, fill);
  ctx.beginPath();
  ctx.roundRect(-width / 2, length - width * 0.55, width, width * 0.9, width * 0.4);
  paint(ctx, end);
  ctx.restore();
}

/** A sword held at a point, its blade running off at an angle (measured as for a limb). */
function sword(ctx: Ctx, x: number, y: number, angle: number): void {
  const [tx, ty] = reach(x, y, angle, 13);
  ctx.lineCap = 'round';
  for (const [color, width] of [
    [INK, 3.4],
    [STEEL, 1.9],
  ] as const) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(tx, ty);
    ctx.stroke();
  }
  // The guard, across the blade.
  const [gx, gy] = reach(x, y, angle, 2);
  const [ax, ay] = reach(gx, gy, angle + Math.PI / 2, 2.6);
  const [bx, by] = reach(gx, gy, angle - Math.PI / 2, 2.6);
  for (const [color, width] of [
    [INK, 2.8],
    [BRASS, 1.5],
  ] as const) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
  }
}

/** The streak a cut leaves in the air: an arc about the shoulder, fading at its tail. */
function streak(ctx: Ctx, x: number, y: number, radius: number, progress: number, turn: number): void {
  const from = 2.7;
  const to = from - 1.3 - progress * 1.2;
  ctx.lineCap = 'round';
  for (let k = 0; k < 10; k++) {
    const a0 = from + ((to - from) * k) / 10;
    const a1 = from + ((to - from) * (k + 1)) / 10;
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.08 + (k / 10) * 0.7})`;
    ctx.lineWidth = 1 + (k / 10) * 2.6;
    ctx.beginPath();
    ctx.moveTo(...reach(x, y, a0 * turn, radius));
    ctx.lineTo(...reach(x, y, a1 * turn, radius));
    ctx.stroke();
  }
}

const arrowTo = (ctx: Ctx, x0: number, y0: number, x1: number, y1: number) => {
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.strokeStyle = '#c9ad7c';
  ctx.lineWidth = 0.9;
  ctx.stroke();
  // The head.
  const angle = Math.atan2(y1 - y0, x1 - x0);
  ctx.fillStyle = STEEL;
  ctx.beginPath();
  ctx.moveTo(x1 + Math.cos(angle) * 2.4, y1 + Math.sin(angle) * 2.4);
  ctx.lineTo(x1 + Math.cos(angle + 2.4) * 1.9, y1 + Math.sin(angle + 2.4) * 1.9);
  ctx.lineTo(x1 + Math.cos(angle - 2.4) * 1.9, y1 + Math.sin(angle - 2.4) * 1.9);
  ctx.closePath();
  paint(ctx, STEEL, 0.8);
};

/** The measures of a figure, worked out once per frame from its look and its stance. */
function frameOf(look: SpriteLook, pose: SpritePose) {
  const legLength = 9 * look.height;
  const torso = 10 * look.height;
  const head = 8.4 * (0.9 + 0.1 * look.height);
  const hip = -legLength - pose.bob * 0.7;
  const robed = look.outfit === 'robe';
  const sleeve = look.outfit === 'fur' ? look.skin : shade(look.top, -0.08);
  const trousers = look.outfit === 'armor' ? shade(look.top, -0.22) : look.legs;
  return { legLength, torso, head, hip, robed, sleeve, trousers, armLength: 8.6 * look.height };
}

/** What is worn on the head, over whatever hair shows; `back` is the view from behind. */
function headgearOn(
  ctx: Ctx,
  look: SpriteLook,
  cx: number,
  cy: number,
  r: number,
  view: 'front' | 'back' | 'side',
): void {
  const color = look.headgearColor;
  const capped = (bottom: number, front = r) => {
    // Everything of the head above a line, as a cap of this color.
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r + 0.9, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = color;
    ctx.fillRect(cx - r - 2, cy - r - 2, r + 2 + front, r + 2 + bottom);
    ctx.restore();
    ctx.beginPath();
    ctx.arc(cx, cy, r + 0.9, Math.PI, Math.PI * 2);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = INK;
    ctx.stroke();
  };
  switch (look.headgear) {
    case 'none':
      return;
    case 'hood':
      if (view === 'back') disc(ctx, cx, cy, r + 1, color);
      else capped(view === 'side' ? r * 0.2 : -r * 0.1, view === 'side' ? r * 0.55 : r + 2);
      return;
    case 'helm':
      if (view === 'back') disc(ctx, cx, cy, r + 0.6, color);
      else {
        capped(-r * 0.12, view === 'side' ? r * 0.8 : r + 2);
        if (view === 'front') block(ctx, cx - 0.9, cy - r * 0.15, 1.8, r * 0.55, 0.6, shade(color, -0.15));
      }
      return;
    case 'hat': {
      // A pointed hat: the cone first, then the brim across it.
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.85, cy - r * 0.5);
      ctx.quadraticCurveTo(cx - 1, cy - r - 9, cx + 2.5, cy - r - 12);
      ctx.quadraticCurveTo(cx + 2, cy - r - 4, cx + r * 0.85, cy - r * 0.5);
      ctx.closePath();
      paint(ctx, color);
      oval(ctx, cx, cy - r * 0.5, r * 1.42, 2.5, shade(color, -0.12));
      return;
    }
    case 'cap':
      oval(ctx, cx - (view === 'side' ? 1.5 : 0.8), cy - r * 0.8, r * 0.98, 3.5, color);
      // A feather.
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(cx + r * 0.2, cy - r * 0.9);
      ctx.quadraticCurveTo(cx + r * 0.5, cy - r - 5, cx + r * 1.05, cy - r - 5.5);
      ctx.stroke();
      ctx.strokeStyle = '#efe6d2';
      ctx.lineWidth = 1.1;
      ctx.stroke();
      return;
    case 'circlet':
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r + 0.3, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = color;
      ctx.fillRect(cx - r - 1, cy - r * 0.66, 2 * r + 2, r * 0.26);
      ctx.restore();
      return;
  }
}

function horns(ctx: Ctx, cx: number, cy: number, r: number, sides: readonly number[]): void {
  for (const s of sides) {
    ctx.beginPath();
    ctx.moveTo(cx + s * r * 0.3, cy - r * 0.86);
    ctx.quadraticCurveTo(cx + s * r * 0.75, cy - r - 4, cx + s * r * 1.12, cy - r - 5);
    ctx.quadraticCurveTo(cx + s * r * 0.95, cy - r - 0.5, cx + s * r * 0.82, cy - r * 0.5);
    ctx.closePath();
    paint(ctx, '#3a2a2a');
  }
}

/** The head seen from the front, or from behind. */
function headFacing(ctx: Ctx, look: SpriteLook, cy: number, r: number, back: boolean): void {
  const hairy = !look.snout && look.hairStyle !== 'bald';
  // What hangs behind the head goes down first.
  if (hairy && look.hairStyle === 'long' && !back)
    block(ctx, -r - 0.6, cy - 2, 2 * r + 1.2, r + 7.5, 4, look.hair);
  if (hairy && look.hairStyle === 'bun') disc(ctx, 0, cy - r - 0.6, 3.2, look.hair);
  if (look.horns) horns(ctx, 0, cy, r, [-1, 1]);
  if (!look.snout) {
    for (const s of [-1, 1]) {
      if (look.ears === 'pointed') {
        ctx.beginPath();
        ctx.moveTo(s * r * 0.8, cy - 1.5);
        ctx.lineTo(s * (r + 4.2), cy - 3.5);
        ctx.lineTo(s * r * 0.86, cy + 2.6);
        ctx.closePath();
        paint(ctx, look.skin);
      } else disc(ctx, s * r * 0.98, cy + 1, 1.9, look.skin);
    }
  }
  disc(ctx, 0, cy, r, back && hairy && look.hairStyle !== 'mohawk' ? look.hair : look.skin);

  if (back) {
    if (hairy && look.hairStyle === 'mohawk') block(ctx, -2, cy - r - 2.6, 4, r * 1.7, 2, look.hair);
    if (hairy && look.hairStyle === 'long') block(ctx, -r - 0.6, cy - 2, 2 * r + 1.2, r + 7.5, 4, look.hair);
    if (hairy && look.hairStyle === 'ponytail') block(ctx, -1.9, cy + r - 3, 3.8, 9, 1.9, look.hair);
    headgearOn(ctx, look, 0, cy, r, 'back');
    return;
  }

  // The fringe: the top of the head, down to a line above the eyes.
  if (hairy) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, cy, r + 0.6, 0, Math.PI * 2);
    ctx.clip();
    if (look.hairStyle === 'mohawk') {
      ctx.fillStyle = look.hair;
      ctx.fillRect(-2.2, cy - r - 1, 4.4, r * 0.75);
    } else oval(ctx, 0, cy - r * 0.62, r * 1.12, r * 0.6, look.hair, 1);
    ctx.restore();
    if (look.hairStyle === 'mohawk') block(ctx, -2, cy - r - 2.8, 4, 5.5, 2, look.hair);
  }
  const eyes = look.snout ? cy - 1.2 : cy + 1;
  if (look.snout) {
    oval(ctx, 0, cy + r * 0.42, r * 0.52, r * 0.38, shade(look.skin, 0.18), 1);
    for (const s of [-1, 1]) disc(ctx, s * 1.3, cy + r * 0.36, 0.5, INK, 0);
  } else {
    // A touch of color in the cheeks, and a mouth.
    for (const s of [-1, 1]) disc(ctx, s * r * 0.62, cy + 3.6, 1.6, 'rgba(210, 90, 80, 0.32)', 0);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(0, cy + 3.6, 1.5, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }
  for (const s of [-1, 1]) {
    oval(ctx, s * r * 0.38, eyes, 1.15, 1.8, INK, 0);
    disc(ctx, s * r * 0.38 + 0.35, eyes - 0.6, 0.42, '#fff', 0);
  }
  if (look.beard) {
    ctx.beginPath();
    ctx.moveTo(-r * 0.78, cy + r * 0.3);
    ctx.quadraticCurveTo(-r * 0.7, cy + r * 1.5, 0, cy + r * 1.62);
    ctx.quadraticCurveTo(r * 0.7, cy + r * 1.5, r * 0.78, cy + r * 0.3);
    ctx.quadraticCurveTo(0, cy + r * 0.78, -r * 0.78, cy + r * 0.3);
    paint(ctx, look.hair, 1);
  }
  if (look.tusks) {
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * 1.6, cy + r * 0.62);
      ctx.lineTo(s * 2.5, cy + r * 0.3);
      ctx.lineTo(s * 3.3, cy + r * 0.62);
      ctx.closePath();
      paint(ctx, '#f2ecd8', 0.8);
    }
  }
  headgearOn(ctx, look, 0, cy, r, 'front');
}

/** The head seen from the side, looking toward +x. */
function headSide(ctx: Ctx, look: SpriteLook, cx: number, cy: number, r: number): void {
  const hairy = !look.snout && look.hairStyle !== 'bald';
  if (hairy && look.hairStyle === 'long') block(ctx, cx - r - 0.8, cy - 2, 5.5, r + 7, 2.7, look.hair);
  if (hairy && look.hairStyle === 'ponytail') {
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.8, cy - 2);
    ctx.quadraticCurveTo(cx - r - 7, cy, cx - r - 3.5, cy + 8);
    ctx.quadraticCurveTo(cx - r - 1.5, cy + 3, cx - r * 0.7, cy + 2);
    ctx.closePath();
    paint(ctx, look.hair);
  }
  if (hairy && look.hairStyle === 'bun') disc(ctx, cx - r * 0.7, cy - r * 0.8, 3.1, look.hair);
  if (look.horns) horns(ctx, cx - 1, cy, r, [1]);
  disc(ctx, cx, cy, r, look.skin);
  if (look.snout) {
    oval(ctx, cx + r * 0.82, cy + 2, 4.6, 3.2, shade(look.skin, 0.12));
    disc(ctx, cx + r * 0.82 + 3, cy + 1.2, 0.5, INK, 0);
  }
  if (hairy) {
    // The back of the head, and a fringe over the brow.
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r + 0.6, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = look.hair;
    if (look.hairStyle === 'mohawk') ctx.fillRect(cx - r * 0.6, cy - r - 1, r * 1.3, r * 0.5);
    else {
      ctx.fillRect(cx - r - 1, cy - r - 1, r - 1, 2 * r + 2);
      ctx.fillRect(cx - r - 1, cy - r - 1, r * 1.6, r * 0.72);
    }
    ctx.restore();
    ctx.beginPath();
    ctx.arc(cx, cy, r + 0.6, Math.PI * 0.55, Math.PI * 1.75);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = INK;
    ctx.stroke();
    if (look.hairStyle === 'mohawk') block(ctx, cx - r * 0.6, cy - r - 2.8, r * 1.3, 4.6, 2, look.hair);
  }
  if (!look.snout) {
    if (look.ears === 'pointed') {
      ctx.beginPath();
      ctx.moveTo(cx + 0.8, cy - 0.6);
      ctx.lineTo(cx - 5.2, cy - 3.6);
      ctx.lineTo(cx - 0.4, cy + 2.6);
      ctx.closePath();
      paint(ctx, look.skin);
    } else disc(ctx, cx - r * 0.3, cy + 1.2, 1.5, shade(look.skin, -0.12), 1);
    disc(ctx, cx + r * 0.55, cy + 3.6, 1.5, 'rgba(210, 90, 80, 0.3)', 0);
  }
  oval(ctx, cx + r * 0.5, look.snout ? cy - 1.4 : cy + 0.8, 1.1, 1.8, INK, 0);
  if (look.beard) {
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.1, cy + r * 0.5);
    ctx.quadraticCurveTo(cx + r * 0.2, cy + r * 1.6, cx + r * 0.75, cy + r * 1.4);
    ctx.quadraticCurveTo(cx + r * 1.02, cy + r * 0.9, cx + r * 0.92, cy + r * 0.3);
    ctx.quadraticCurveTo(cx + r * 0.4, cy + r * 0.8, cx - r * 0.1, cy + r * 0.5);
    paint(ctx, look.hair, 1);
  }
  if (look.tusks) {
    ctx.beginPath();
    ctx.moveTo(cx + r * 0.5, cy + r * 0.62);
    ctx.lineTo(cx + r * 0.7, cy + r * 0.26);
    ctx.lineTo(cx + r * 0.88, cy + r * 0.62);
    ctx.closePath();
    paint(ctx, '#f2ecd8', 0.8);
  }
  headgearOn(ctx, look, cx, cy, r, 'side');
}

/** The belt, and what tells one garment from another, over a body already painted. */
function garment(ctx: Ctx, look: SpriteLook, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = look.trim;
  ctx.fillRect(x + 0.6, y + h - 3.4, w - 1.2, 1.7);
  if (look.outfit === 'armor') {
    // A gleam across the breastplate.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillRect(x + 1.2, y + 1.6, w * 0.42, 1.5);
  } else if (look.outfit === 'fur') {
    ctx.strokeStyle = shade(look.top, -0.3);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let k = 1; k < 4; k++) {
      ctx.moveTo(x + (w * k) / 4, y + 1.5);
      ctx.lineTo(x + (w * k) / 4 - 1, y + 4);
    }
    ctx.stroke();
  }
}

/** The figure seen from the side, facing +x. */
function side(ctx: Ctx, look: SpriteLook, pose: SpritePose): void {
  const m = frameOf(look, pose);
  const w = look.width;
  const shoulderY = -m.torso + 2.4;
  const far = shade(m.trousers, -0.18);

  // The far leg, then, with the body, whatever is behind it.
  if (!m.robed) limb(ctx, -0.7, m.hip, pose.legBack, m.legLength, 4.2 * w, far, shade(look.boots, -0.15));
  ctx.save();
  ctx.translate(0, m.hip);
  ctx.rotate(pose.lean);
  if (look.cape) {
    const sway = pose.legFront * 2.2;
    ctx.beginPath();
    ctx.moveTo(-1, -m.torso + 1.2);
    ctx.lineTo(-4.4 * w, -m.torso + 1.6);
    ctx.quadraticCurveTo(-7.5 * w - sway, -m.torso * 0.4, -6.5 * w - sway * 1.6, m.legLength * 0.5);
    ctx.lineTo(-1.5, m.legLength * 0.35);
    ctx.closePath();
    paint(ctx, look.cape);
  }
  const hand = reach(0, shoulderY, pose.armFront, m.armLength);
  // Where the string is held, when a bow is drawn.
  const nock: [number, number] = [hand[0] - 1 - pose.draw * 6.5, shoulderY + 1];
  const drawing = pose.weapon === 'bow' && (pose.draw > 0 || pose.arrow === 0);
  if (!drawing)
    limb(ctx, -0.5, shoulderY, pose.armBack, m.armLength, 3.3 * w, shade(m.sleeve, -0.18), look.skin);
  ctx.restore();

  if (m.robed) {
    // Under a robe only the feet show, stepping out in turn.
    for (const [swing, tone] of [
      [pose.legBack, -0.15],
      [pose.legFront, 0],
    ] as const) {
      oval(ctx, swing * 3.2 + 0.8, -1.4 - Math.max(0, swing) * 1.2, 2.9 * w, 1.6, shade(look.boots, tone));
    }
  } else limb(ctx, 0.7, m.hip, pose.legFront, m.legLength, 4.2 * w, m.trousers, look.boots);

  ctx.save();
  ctx.translate(0, m.hip);
  ctx.rotate(pose.lean);
  const bodyHeight = m.robed ? m.torso + m.legLength - 2.6 : m.torso + 1.6;
  block(ctx, -4.6 * w, -m.torso, 9.2 * w, bodyHeight, 3.4, look.top);
  garment(ctx, look, -4.6 * w, -m.torso, 9.2 * w, m.torso + 1.6);
  headSide(ctx, look, 1.2, -m.torso - m.head + 2.6, m.head);

  if (pose.weapon === 'bow') {
    // The bow at arm's length, turning with the arm as it comes up.
    ctx.save();
    ctx.translate(hand[0], hand[1]);
    ctx.rotate(Math.PI / 2 - pose.armFront);
    for (const [color, width] of [
      [INK, 2.8],
      [WOOD, 1.5],
    ] as const) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.arc(-6, 0, 10, -1.05, 1.05);
      ctx.stroke();
    }
    const tipX = -6 + Math.cos(1.05) * 10;
    const tipY = Math.sin(1.05) * 10;
    ctx.strokeStyle = '#efe6d2';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(tipX, -tipY);
    ctx.lineTo(-1 - pose.draw * 6.5, 0);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
    ctx.restore();
    if (pose.arrow !== null) {
      const from = pose.arrow === 0 ? nock[0] : hand[0] + pose.arrow;
      arrowTo(ctx, from, nock[1], from + 11, nock[1]);
    }
  }
  if (drawing) {
    const dx = nock[0] + 0.5;
    const dy = nock[1] - shoulderY;
    limb(ctx, -0.5, shoulderY, Math.atan2(dx, dy), Math.hypot(dx, dy), 3.3 * w, m.sleeve, look.skin);
  }
  limb(ctx, 0.5, shoulderY, pose.armFront, m.armLength, 3.4 * w, m.sleeve, look.skin);
  if (pose.weapon === 'sword') {
    sword(ctx, hand[0], hand[1], pose.armFront + 0.5);
    if (pose.slash !== null) streak(ctx, 0.5, shoulderY, m.armLength + 12, pose.slash, 1);
  }
  ctx.restore();
}

/** The figure seen from the front (walking toward the viewer) or from behind. */
function facing(ctx: Ctx, look: SpriteLook, pose: SpritePose, back: boolean): void {
  const m = frameOf(look, pose);
  const w = look.width;
  const shoulderY = m.hip - m.torso;
  const headY = shoulderY - m.head + 2.6;
  // The sword arm is the right one: on the left of the picture when the figure faces us.
  const swordSide = back ? 1 : -1;
  const chest = shoulderY + m.torso * 0.5;
  // The bow is held out ahead, low until the arm is up.
  const bowY = chest + (1.57 - Math.min(1.57, pose.armFront)) * 5;
  const bow = (away: boolean) => {
    for (const [color, width] of [
      [INK, 2.8],
      [WOOD, 1.5],
    ] as const) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      if (away) ctx.arc(0, bowY + 7, 11, 1.25 * Math.PI, 1.75 * Math.PI);
      else ctx.arc(0, bowY - 7, 11, 0.25 * Math.PI, 0.75 * Math.PI);
      ctx.stroke();
    }
    const tipX = Math.cos(0.25 * Math.PI) * 11;
    const tipY = away ? bowY + 7 - Math.sin(0.25 * Math.PI) * 11 : bowY - 7 + Math.sin(0.25 * Math.PI) * 11;
    ctx.strokeStyle = '#efe6d2';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(-tipX, tipY);
    ctx.lineTo(0, tipY + (away ? 1 : -1) * pose.draw * 3.5);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
  };

  if (pose.weapon === 'bow' && back) bow(true);
  if (look.cape && !back)
    block(ctx, -6.4 * w, shoulderY + 1, 12.8 * w, m.torso + m.legLength * 0.5, 3, look.cape);

  // Legs: the one stepping forward is lifted, and so drawn shorter.
  for (const s of [-1, 1]) {
    const swing = s < 0 ? pose.legFront : pose.legBack;
    const lift = Math.max(0, swing) * 3.4;
    if (m.robed) oval(ctx, s * 2.8 * w, -1.5 - lift * 0.5, 2.6 * w, 1.7, look.boots);
    else {
      block(ctx, s * 2.7 * w - 2.1 * w, m.hip, 4.2 * w, -m.hip - lift, 2, m.trousers);
      block(ctx, s * 2.7 * w - 2.2 * w, -lift - 3.4, 4.4 * w, 3.4, 1.5, look.boots);
    }
  }
  const bodyHeight = m.robed ? -shoulderY - 2.6 : m.torso + 1.6;
  block(ctx, -5.2 * w, shoulderY, 10.4 * w, bodyHeight, 3.6, look.top);
  garment(ctx, look, -5.2 * w, shoulderY, 10.4 * w, m.torso + 1.6);
  if (look.cape && back)
    block(ctx, -5.6 * w, shoulderY + 0.6, 11.2 * w, m.torso + m.legLength * 0.55, 3, look.cape);

  // Arms: swinging toward or away from the viewer shows as shorter and higher.
  for (const s of [-1, 1]) {
    const armed = s === swordSide;
    const angle = armed ? pose.armFront : pose.armBack;
    const x = s * 6.3 * w;
    const y = shoulderY + 1.6;
    if (pose.weapon === 'bow') {
      // Both hands come together on the bow.
      limb(ctx, x, y, -s * 0.62, m.armLength * 0.78, 3.4 * w, m.sleeve, look.skin);
    } else if (pose.weapon === 'sword' && armed) {
      const turned = s * angle * 0.78;
      limb(ctx, x, y, turned, m.armLength, 3.4 * w, m.sleeve, look.skin);
      sword(ctx, ...reach(x, y, turned, m.armLength), turned + s * 0.4);
      if (pose.slash !== null) streak(ctx, x, y, m.armLength + 12, pose.slash, s * 0.78);
    } else {
      const forward = Math.sin(angle);
      limb(
        ctx,
        x,
        y - Math.max(0, forward) * 1.5,
        s * 0.1,
        m.armLength * (1 - 0.22 * Math.abs(forward)),
        3.4 * w,
        m.sleeve,
        look.skin,
      );
    }
  }
  headFacing(ctx, look, headY, m.head, back);
  if (pose.weapon === 'bow') {
    if (!back) {
      bow(false);
      if (pose.arrow !== null) {
        const from = bowY + 1 + pose.arrow;
        arrowTo(ctx, 0, from, 0, from + 7);
      }
    } else if (pose.arrow !== null && pose.arrow > 0) {
      const from = headY - m.head - pose.arrow * 0.6;
      arrowTo(ctx, 0, from, 0, from - 7);
    }
  }
}

/**
 * Draws one frame of a figure into the square of side `FRAME * scale` whose
 * top-left corner is at (x, y), standing on the ground line near its foot.
 */
export function drawSprite(
  ctx: Ctx,
  look: SpriteLook,
  pose: SpritePose,
  direction: SpriteFacing,
  x = 0,
  y = 0,
  scale = 1,
): void {
  ctx.save();
  ctx.translate(x + (FRAME / 2) * scale, y + GROUND * scale);
  ctx.scale(scale, scale);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // The shadow it stands on.
  oval(ctx, 0, 0.6, 9.5 * look.width, 2.8, 'rgba(0, 0, 0, 0.24)', 0);
  if (direction === 'left') ctx.scale(-1, 1);
  if (direction === 'left' || direction === 'right') side(ctx, look, pose);
  else facing(ctx, look, pose, direction === 'up');
  ctx.restore();
}

/**
 * Lays every frame of every animation out on one sheet, on a transparent
 * ground: a row for each animation and facing (see `sheetCell`), a column for
 * each frame. Each frame is a square of `FRAME * scale` pixels.
 */
export function drawSpriteSheet(canvas: HTMLCanvasElement, look: SpriteLook, scale: number): void {
  const size = FRAME * scale;
  canvas.width = SHEET_COLUMNS * size;
  canvas.height = SHEET_ROWS * size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const animation of SPRITE_ANIMATIONS) {
    for (const direction of SPRITE_FACINGS) {
      for (let frame = 0; frame < SPRITE_FRAMES[animation]; frame++) {
        const [column, row] = sheetCell(animation, direction, frame);
        drawSprite(ctx, look, spritePose(animation, frame), direction, column * size, row * size, scale);
      }
    }
  }
}
