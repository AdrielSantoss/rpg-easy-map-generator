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

function shade(color: string, amount: number): string {
  const value = parseInt(color.slice(1), 16);
  const channel = (shift: number) => {
    const c = (value >> shift) & 255;
    return Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount);
  };
  return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`;
}

/**
 * Where the light comes from, as seen by the figure being drawn. On the page it
 * is always the upper left, as on the maps; the figure is turned to face its
 * way, so the direction is turned back by as much (see `drawSprite`).
 */
let lightX = -0.7;
let lightY = -0.7;

/** A color as it looks on something round: lighter toward the light, darker away from it. */
function lit(ctx: Ctx, x: number, y: number, r: number, color: string): CanvasGradient {
  const paint = ctx.createLinearGradient(x + lightX * r, y + lightY * r, x - lightX * r, y - lightY * r);
  paint.addColorStop(0, shade(color, 0.3));
  paint.addColorStop(0.45, color);
  paint.addColorStop(1, shade(color, -0.3));
  return paint;
}

/** Fills the current path as a lit surface and draws the inked line round it. */
function finish(ctx: Ctx, x: number, y: number, r: number, color: string, line = 1.1): void {
  ctx.fillStyle = lit(ctx, x, y, r, color);
  ctx.fill();
  if (line > 0) {
    ctx.lineWidth = line;
    ctx.strokeStyle = INK;
    ctx.stroke();
  }
}

const disc = (ctx: Ctx, x: number, y: number, r: number, color: string, line = 1.1) => {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  finish(ctx, x, y, r, color, line);
};

const oval = (ctx: Ctx, x: number, y: number, rx: number, ry: number, color: string, line = 1.1) => {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  finish(ctx, x, y, Math.max(rx, ry), color, line);
};

/** A limb, a blade, a tail of hair: a rounded bar with the inked line round it. */
const bar = (ctx: Ctx, x0: number, y0: number, x1: number, y1: number, width: number, color: string) => {
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.strokeStyle = INK;
  ctx.lineWidth = width + 1.9;
  ctx.stroke();
  const reach = Math.hypot(x1 - x0, y1 - y0) / 2 + width;
  ctx.strokeStyle = lit(ctx, (x0 + x1) / 2, (y0 + y1) / 2, reach, color);
  ctx.lineWidth = width;
  ctx.stroke();
};

/** The spot where the light catches something round and smooth. */
const gleam = (ctx: Ctx, x: number, y: number, r: number, strength = 0.28) => {
  ctx.beginPath();
  ctx.ellipse(
    x + lightX * r * 0.42,
    y + lightY * r * 0.42,
    r * 0.36,
    r * 0.26,
    Math.atan2(lightY, lightX),
    0,
    Math.PI * 2,
  );
  ctx.fillStyle = `rgba(255, 255, 255, ${strength})`;
  ctx.fill();
};

/**
 * A point at a distance from another, in the direction of an angle on the
 * ground: 0 is straight ahead of the figure (up the picture), growing toward
 * its right hand.
 */
const ahead = (x: number, y: number, angle: number, distance: number): [number, number] => [
  x + Math.sin(angle) * distance,
  y - Math.cos(angle) * distance,
];

/**
 * The head seen from above, facing up the picture: mostly hair or whatever is
 * worn over it, with the brow, the eyes and the nose showing at the front so
 * that one can tell which way the figure looks.
 */
function head(ctx: Ctx, look: SpriteLook, cx: number, cy: number, r: number): void {
  const hairy = !look.snout && look.hairStyle !== 'bald';
  // What reaches past the face in front, and past the head behind, goes down first.
  if (look.beard) oval(ctx, cx, cy - r * 0.98, r * 0.62, r * 0.58, look.hair);
  if (look.snout) oval(ctx, cx, cy - r * 0.95, r * 0.5, r * 0.78, shade(look.skin, 0.14));
  if (!look.snout) {
    for (const s of [-1, 1]) {
      if (look.ears === 'pointed') {
        ctx.beginPath();
        ctx.moveTo(cx + s * r * 0.8, cy - 1.4);
        ctx.lineTo(cx + s * (r + 3.8), cy + 2.4);
        ctx.lineTo(cx + s * r * 0.78, cy + 2.4);
        ctx.closePath();
        finish(ctx, cx + s * r, cy, 3, look.skin, 1);
      } else disc(ctx, cx + s * r * 0.98, cy + 0.2, 1.7, look.skin, 1);
    }
  }
  if (hairy && look.hairStyle === 'long') oval(ctx, cx, cy + r * 0.8, r * 1.02, r * 1.3, look.hair);
  if (hairy && look.hairStyle === 'ponytail') bar(ctx, cx, cy + r - 1, cx, cy + r + 6.5, 2.6, look.hair);

  disc(ctx, cx, cy, r, look.skin);
  // The face: a nose, and two eyes under the brow.
  disc(ctx, cx, cy - r + 0.2, 1.1, shade(look.skin, -0.1), 0.8);
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(cx + s * r * 0.42, cy - r * 0.58, 0.85, 0, Math.PI * 2);
    ctx.fillStyle = INK;
    ctx.fill();
  }
  if (look.tusks) for (const s of [-1, 1]) disc(ctx, cx + s * r * 0.36, cy - r * 0.98, 0.8, '#f2ecd8', 0.6);

  if (hairy) {
    // Hair over all of the head but the brow, combed back from it.
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    if (look.hairStyle === 'mohawk') {
      ctx.beginPath();
      ctx.rect(cx - 1.9, cy - r * 0.62, 3.8, r * 2);
      finish(ctx, cx, cy, r, look.hair, 1);
    } else {
      ctx.beginPath();
      ctx.arc(cx, cy + r * 0.44, r * 1.06, 0, Math.PI * 2);
      finish(ctx, cx, cy, r, look.hair, 1);
      ctx.strokeStyle = shade(look.hair, -0.35);
      ctx.lineWidth = 0.5;
      for (const s of [-0.55, 0, 0.55]) {
        ctx.beginPath();
        ctx.moveTo(cx + s * r * 0.5, cy - r * 0.45);
        ctx.quadraticCurveTo(cx + s * r * 1.1, cy + r * 0.2, cx + s * r * 0.8, cy + r);
        ctx.stroke();
      }
    }
    ctx.restore();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = INK;
    ctx.stroke();
    if (look.hairStyle === 'bun') disc(ctx, cx, cy + r * 0.6, 2.8, shade(look.hair, 0.12));
  }
  if (look.headgear === 'none' || look.headgear === 'circlet') gleam(ctx, cx, cy, r, hairy ? 0.2 : 0.3);
  if (look.horns) {
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + s * r * 0.25, cy - r * 0.2);
      ctx.quadraticCurveTo(cx + s * r * 1.15, cy - r * 0.3, cx + s * (r + 2.6), cy - r - 2.2);
      ctx.quadraticCurveTo(cx + s * r * 0.75, cy - r * 0.95, cx + s * r * 0.5, cy - r * 0.55);
      ctx.closePath();
      finish(ctx, cx + s * r * 0.8, cy - r * 0.6, 4, '#4a3434', 1);
    }
  }

  const color = look.headgearColor;
  switch (look.headgear) {
    case 'none':
      break;
    case 'hood':
      // Pulled over the head, open at the front, with its fold down the middle.
      disc(ctx, cx, cy + r * 0.55, r + 0.8, color);
      ctx.strokeStyle = shade(color, -0.35);
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.2);
      ctx.lineTo(cx, cy + r * 1.3);
      ctx.stroke();
      break;
    case 'helm':
      disc(ctx, cx, cy + r * 0.3, r + 0.5, color);
      gleam(ctx, cx, cy + r * 0.3, r + 0.5, 0.45);
      bar(ctx, cx, cy - r * 0.35, cx, cy + r * 0.85, 0.9, shade(color, -0.25));
      break;
    case 'hat':
      // A pointed hat: the brim, the cone, and its tip fallen back.
      disc(ctx, cx, cy + 0.4, r * 1.4, shade(color, -0.12));
      disc(ctx, cx, cy + 0.8, r * 0.86, color);
      disc(ctx, cx + 1.2, cy + 2.6, r * 0.4, shade(color, 0.12), 0.9);
      break;
    case 'cap':
      disc(ctx, cx - 0.6, cy + 0.9, r * 1.04, color);
      // A feather.
      bar(ctx, cx + 2, cy + 0.2, cx + r + 3.4, cy + 4.6, 0.9, '#efe6d2');
      break;
    case 'circlet':
      ctx.beginPath();
      ctx.arc(cx, cy + 0.2, r * 0.78, 0, Math.PI * 2);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.1;
      ctx.stroke();
      break;
  }
}

/**
 * The figure seen from straight above, as everything on the maps is, facing up
 * the picture: the head over the shoulders, the arms and whatever they hold,
 * the feet stepping out from under the body.
 */
function figure(ctx: Ctx, look: SpriteLook, pose: SpritePose): void {
  const w = look.width;
  const sleeve = look.outfit === 'fur' ? look.skin : shade(look.top, -0.08);
  const stride = pose.legFront;

  if (look.cape) {
    // Trailing behind, and swaying with the step.
    const sway = stride * 1.6;
    const length = 14 + Math.abs(stride) * 2.5;
    ctx.beginPath();
    ctx.moveTo(-7 * w, 1);
    ctx.quadraticCurveTo(-8.5 * w + sway, length * 0.6, -5 * w + sway, length);
    ctx.lineTo(5 * w + sway, length);
    ctx.quadraticCurveTo(8.5 * w + sway, length * 0.6, 7 * w, 1);
    ctx.closePath();
    finish(ctx, 0, length / 2, length * 0.7, look.cape);
    // Its folds.
    ctx.strokeStyle = shade(look.cape, -0.35);
    ctx.lineWidth = 0.6;
    for (const s of [-0.4, 0.4]) {
      ctx.beginPath();
      ctx.moveTo(s * 7 * w, 4);
      ctx.lineTo(s * 6 * w + sway, length - 1.5);
      ctx.stroke();
    }
  }

  // The feet: one ahead and one behind, in turn.
  for (const [s, swing] of [
    [-1, pose.legFront],
    [1, pose.legBack],
  ] as const) {
    oval(ctx, s * 3.5 * w, 1 - swing * 6.5, 2.6 * w, 3.6, look.boots);
  }
  // A robe hangs wide all round, and hides most of the stride.
  if (look.outfit === 'robe') oval(ctx, 0, 2.6, 8.3 * w, 7.4, shade(look.top, -0.12));

  // Where the hands are. Running, each arm swings against the leg on its side.
  const shoulder = { left: [-8.8 * w, 0.8], right: [8.8 * w, 0.8] } as const;
  let left: [number, number] = [-9.8 * w, -1.5 - Math.sin(pose.armFront) * 5.2];
  let right: [number, number] = [9.8 * w, -1.5 - Math.sin(pose.armBack) * 5.2];
  // The sword arm sweeps round from behind the shoulder to across the front.
  const cut = (pose.armFront - 1) * 0.95;
  // The bow is held out ahead, and the string drawn back along the same line.
  const aim = Math.min(1, pose.armFront / 1.57);
  const nock: [number, number] = [0.4, -3.5 - 5 * aim + pose.draw * 6.5];
  if (pose.weapon === 'sword') {
    right = ahead(shoulder.right[0], shoulder.right[1], cut, 6);
    left = [-9.8 * w, 0.8];
  } else if (pose.weapon === 'bow') {
    left = [-1, -5 - 5 * aim];
    if (pose.draw > 0 || pose.arrow === 0) right = [nock[0] + 1, nock[1] + 0.6];
  }
  bar(ctx, shoulder.left[0], shoulder.left[1], left[0], left[1], 3.3 * w, sleeve);
  bar(ctx, shoulder.right[0], shoulder.right[1], right[0], right[1], 3.3 * w, sleeve);

  // The shoulders, rising a little with each breath.
  oval(ctx, 0, 0.8, 10 * w, 5.6 + pose.bob * 0.3, look.top);
  if (look.outfit === 'armor') {
    for (const s of [-1, 1]) {
      disc(ctx, s * 7.2 * w, 0.8, 3.1, shade(look.top, 0.2), 0.9);
      gleam(ctx, s * 7.2 * w, 0.8, 3.1, 0.5);
    }
  } else if (look.outfit === 'fur') {
    for (const s of [-1, 0, 1]) disc(ctx, s * 5 * w, 3.4, 1.5, shade(look.top, -0.22), 0.7);
  } else if (look.outfit === 'leather') {
    // A strap across the back.
    ctx.strokeStyle = shade(look.top, -0.4);
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(-7 * w, 3.4);
    ctx.lineTo(6 * w, -2.6);
    ctx.stroke();
  }
  // The collar, in the color the clothes are trimmed with.
  oval(ctx, 0, -0.4, 5.2, 4, look.trim, 0.9);

  if (pose.weapon === 'bow') {
    const centerY = left[1] + 8.5;
    for (const [color, width] of [
      [INK, 2.8],
      [WOOD, 1.5],
    ] as const) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, centerY, 10.5, 1.22 * Math.PI, 1.78 * Math.PI);
      ctx.stroke();
    }
    const tipX = Math.cos(0.22 * Math.PI) * 10.5;
    const tipY = centerY - Math.sin(0.22 * Math.PI) * 10.5;
    ctx.strokeStyle = '#efe6d2';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(-tipX, tipY);
    ctx.lineTo(nock[0], pose.draw > 0 ? nock[1] : tipY);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
    if (pose.arrow !== null) {
      // On the string, or already on its way.
      const tail = pose.arrow === 0 ? nock[1] : left[1] - pose.arrow;
      bar(ctx, nock[0], tail, nock[0], tail - 10, 0.8, '#c9ad7c');
      ctx.beginPath();
      ctx.moveTo(nock[0], tail - 13.2);
      ctx.lineTo(nock[0] - 1.8, tail - 9.6);
      ctx.lineTo(nock[0] + 1.8, tail - 9.6);
      ctx.closePath();
      finish(ctx, nock[0], tail - 11, 2, STEEL, 0.8);
    }
  }
  disc(ctx, left[0], left[1], 1.9, look.skin, 1);
  disc(ctx, right[0], right[1], 1.9, look.skin, 1);

  if (pose.weapon === 'sword') {
    const tip = ahead(right[0], right[1], cut - 0.12, 11.5);
    bar(ctx, right[0], right[1], tip[0], tip[1], 1.6, STEEL);
    // The guard, across the blade.
    const guard = ahead(right[0], right[1], cut - 0.12, 2.2);
    const a = ahead(guard[0], guard[1], cut - 0.12 + Math.PI / 2, 2.6);
    const b = ahead(guard[0], guard[1], cut - 0.12 - Math.PI / 2, 2.6);
    bar(ctx, a[0], a[1], b[0], b[1], 1.2, BRASS);
    if (pose.slash !== null) {
      // The streak the blade leaves, fading toward where the cut began.
      const from = 1.9;
      ctx.lineCap = 'round';
      for (let k = 0; k < 12; k++) {
        const a0 = from + ((cut - from) * k) / 12;
        const a1 = from + ((cut - from) * (k + 1)) / 12;
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.06 + (k / 12) * 0.7})`;
        ctx.lineWidth = 0.8 + (k / 12) * 2.6;
        ctx.beginPath();
        ctx.moveTo(...ahead(shoulder.right[0], shoulder.right[1], a0, 16));
        ctx.lineTo(...ahead(shoulder.right[0], shoulder.right[1], a1, 16));
        ctx.stroke();
      }
    }
  }
  head(ctx, look, 0, -1.6, 5.7);
}

/** How far the picture is turned for each facing; the figure is drawn facing up. */
const TURN: Record<SpriteFacing, number> = {
  up: 0,
  right: Math.PI / 2,
  down: Math.PI,
  left: -Math.PI / 2,
};

/**
 * Draws one frame of a figure, seen from above, in the square of side
 * `FRAME * scale` whose top-left corner is at (x, y), standing at its middle.
 * It is painted the way the maps are: an inked line, colors lit from the upper
 * left, and a soft shadow on the ground.
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
  // Nothing leaves its own frame: an arrow in flight would otherwise show in the next one of a sheet.
  ctx.beginPath();
  ctx.rect(x, y, FRAME * scale, FRAME * scale);
  ctx.clip();
  ctx.translate(x + (FRAME / 2) * scale, y + (FRAME / 2) * scale);
  ctx.scale(scale, scale);
  ctx.lineJoin = 'round';
  // The small are drawn smaller all round: from above, height shows as size.
  const size = (0.55 + 0.45 * look.height) * 1.2;
  ctx.scale(size, size);
  // The shadow falls the same way whichever way the figure faces: with the maps' light, down and right.
  const shadow = ctx.createRadialGradient(2.4, 2.8, 2, 2.4, 2.8, 12.5 * look.width);
  shadow.addColorStop(0, 'rgba(0, 0, 0, 0.42)');
  shadow.addColorStop(0.7, 'rgba(0, 0, 0, 0.2)');
  shadow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = shadow;
  ctx.fillRect(-20, -20, 44, 44);
  const turn = TURN[direction];
  ctx.rotate(turn);
  // The light stays where it is on the page while the figure turns under it.
  lightX = -0.7 * Math.cos(turn) - 0.7 * Math.sin(turn);
  lightY = 0.7 * Math.sin(turn) - 0.7 * Math.cos(turn);
  figure(ctx, look, pose);
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
