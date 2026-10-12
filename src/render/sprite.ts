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

/** The side of one frame, in pixels of the sprite and in the units everything here is measured in. */
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

const disc = (ctx: Ctx, x: number, y: number, r: number, fill: string) => {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
};

const oval = (ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string) => {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
};

const bar = (ctx: Ctx, x0: number, y0: number, x1: number, y1: number, width: number, color: string) => {
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
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
  if (look.beard) oval(ctx, cx, cy - r * 0.98, r * 0.62, r * 0.55, look.hair);
  if (look.snout) oval(ctx, cx, cy - r * 0.95, r * 0.5, r * 0.75, shade(look.skin, 0.14));
  if (!look.snout) {
    for (const s of [-1, 1]) {
      if (look.ears === 'pointed') {
        ctx.beginPath();
        ctx.moveTo(cx + s * r * 0.8, cy - 1.4);
        ctx.lineTo(cx + s * (r + 3.8), cy + 2.4);
        ctx.lineTo(cx + s * r * 0.78, cy + 2.4);
        ctx.closePath();
        ctx.fillStyle = look.skin;
        ctx.fill();
      } else disc(ctx, cx + s * r * 0.98, cy + 0.2, 1.7, look.skin);
    }
  }
  if (hairy && look.hairStyle === 'long') oval(ctx, cx, cy + r * 0.8, r * 1.02, r * 1.3, look.hair);
  if (hairy && look.hairStyle === 'ponytail') bar(ctx, cx, cy + r - 1, cx, cy + r + 6.5, 3.2, look.hair);

  disc(ctx, cx, cy, r, look.skin);
  // The face: a nose, and two eyes under the brow.
  disc(ctx, cx, cy - r + 0.3, 1.2, shade(look.skin, -0.14));
  for (const s of [-1, 1]) disc(ctx, cx + s * r * 0.42, cy - r * 0.56, 1, INK);
  if (look.tusks) for (const s of [-1, 1]) disc(ctx, cx + s * r * 0.34, cy - r * 0.96, 0.8, '#f2ecd8');

  if (hairy) {
    // Hair over all of the head but the brow.
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r + 0.5, 0, Math.PI * 2);
    ctx.clip();
    if (look.hairStyle === 'mohawk') {
      ctx.fillStyle = look.hair;
      ctx.fillRect(cx - 1.9, cy - r * 0.62, 3.8, r * 2);
    } else disc(ctx, cx, cy + r * 0.44, r * 1.06, look.hair);
    ctx.restore();
    if (look.hairStyle === 'bun') disc(ctx, cx, cy + r * 0.6, 2.9, shade(look.hair, 0.16));
  }
  if (look.horns) {
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + s * r * 0.25, cy - r * 0.2);
      ctx.quadraticCurveTo(cx + s * r * 1.15, cy - r * 0.3, cx + s * (r + 2.6), cy - r - 2.2);
      ctx.quadraticCurveTo(cx + s * r * 0.75, cy - r * 0.95, cx + s * r * 0.5, cy - r * 0.55);
      ctx.closePath();
      ctx.fillStyle = '#3a2a2a';
      ctx.fill();
    }
  }

  const color = look.headgearColor;
  switch (look.headgear) {
    case 'none':
      break;
    case 'hood':
      // Pulled over the head, open at the front.
      disc(ctx, cx, cy + r * 0.55, r + 0.8, color);
      break;
    case 'helm':
      disc(ctx, cx, cy + r * 0.3, r + 0.5, color);
      bar(ctx, cx, cy - r * 0.4, cx, cy + r * 0.9, 1.5, shade(color, -0.22));
      break;
    case 'hat':
      // A pointed hat: the brim, the cone, and its tip fallen back.
      disc(ctx, cx, cy + 0.4, r * 1.4, shade(color, -0.14));
      disc(ctx, cx, cy + 0.8, r * 0.88, color);
      disc(ctx, cx + 1.2, cy + 2.6, r * 0.42, shade(color, 0.18));
      break;
    case 'cap':
      disc(ctx, cx - 0.6, cy + 0.9, r * 1.04, color);
      // A feather.
      bar(ctx, cx + 2, cy + 0.2, cx + r + 3.4, cy + 4.6, 1.6, '#efe6d2');
      break;
    case 'circlet':
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(cx, cy + 0.2, r * 0.78, 0, Math.PI * 2);
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
  const sleeve = look.outfit === 'fur' ? look.skin : shade(look.top, -0.1);
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
    ctx.fillStyle = look.cape;
    ctx.fill();
  }

  // The feet: one ahead and one behind, in turn.
  for (const [s, swing] of [
    [-1, pose.legFront],
    [1, pose.legBack],
  ] as const) {
    oval(ctx, s * 3.5 * w, 1 - swing * 6.5, 2.7 * w, 3.7, look.boots);
  }
  // A robe hangs wide all round, and hides most of the stride.
  if (look.outfit === 'robe') oval(ctx, 0, 2.6, 8.3 * w, 7.4, shade(look.top, -0.14));

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
    left = [-9 * w, 0.8];
  } else if (pose.weapon === 'bow') {
    left = [-1, -5 - 5 * aim];
    if (pose.draw > 0 || pose.arrow === 0) right = [nock[0] + 1, nock[1] + 0.6];
  }
  bar(ctx, shoulder.left[0], shoulder.left[1], left[0], left[1], 4.2 * w, sleeve);
  bar(ctx, shoulder.right[0], shoulder.right[1], right[0], right[1], 4.2 * w, sleeve);

  // The shoulders, rising a little with each breath.
  oval(ctx, 0, 0.8, 10 * w, 5.6 + pose.bob * 0.3, look.top);
  if (look.outfit === 'armor') {
    for (const s of [-1, 1]) disc(ctx, s * 7.2 * w, 0.8, 3.2, shade(look.top, 0.28));
  } else if (look.outfit === 'fur') {
    for (const s of [-1, 0, 1]) disc(ctx, s * 5 * w, 3.2, 1.6, shade(look.top, -0.25));
  }
  // The collar, in the color the clothes are trimmed with.
  oval(ctx, 0, -0.4, 5.2, 4, look.trim);

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
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(-tipX, tipY);
    ctx.lineTo(nock[0], pose.draw > 0 ? nock[1] : tipY);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
    if (pose.arrow !== null) {
      // On the string, or already on its way.
      const tail = pose.arrow === 0 ? nock[1] : left[1] - pose.arrow;
      bar(ctx, nock[0], tail, nock[0], tail - 10, 3, INK);
      bar(ctx, nock[0], tail, nock[0], tail - 10, 1, '#c9ad7c');
      ctx.beginPath();
      ctx.moveTo(nock[0], tail - 13);
      ctx.lineTo(nock[0] - 1.9, tail - 9.4);
      ctx.lineTo(nock[0] + 1.9, tail - 9.4);
      ctx.closePath();
      ctx.fillStyle = STEEL;
      ctx.fill();
    }
  }
  disc(ctx, left[0], left[1], 2.1, look.skin);
  disc(ctx, right[0], right[1], 2.1, look.skin);

  if (pose.weapon === 'sword') {
    const tip = ahead(right[0], right[1], cut - 0.12, 11.5);
    bar(ctx, right[0], right[1], tip[0], tip[1], 3.4, INK);
    bar(ctx, right[0], right[1], tip[0], tip[1], 1.9, STEEL);
    // The guard, across the blade.
    const guard = ahead(right[0], right[1], cut - 0.12, 2.2);
    const a = ahead(guard[0], guard[1], cut - 0.12 + Math.PI / 2, 2.7);
    const b = ahead(guard[0], guard[1], cut - 0.12 - Math.PI / 2, 2.7);
    bar(ctx, a[0], a[1], b[0], b[1], 2.8, INK);
    bar(ctx, a[0], a[1], b[0], b[1], 1.5, BRASS);
    if (pose.slash !== null) {
      // The streak the blade leaves, fading toward where the cut began.
      const from = 1.9;
      for (let k = 0; k < 10; k++) {
        const a0 = from + ((cut - from) * k) / 10;
        const a1 = from + ((cut - from) * (k + 1)) / 10;
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.1 + (k / 10) * 0.75})`;
        ctx.lineWidth = 1 + (k / 10) * 2.8;
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
 * Lays down the flat shapes of one frame, seen from above, in the square of
 * side `FRAME * scale` whose top-left corner is at (x, y), the figure standing
 * at its middle. This is only the first step of a sprite: see `spriteFrame`.
 */
function drawShapes(
  ctx: Ctx,
  look: SpriteLook,
  pose: SpritePose,
  direction: SpriteFacing,
  x: number,
  y: number,
  scale: number,
): void {
  ctx.save();
  // Nothing leaves its own frame: an arrow in flight would otherwise show in the next one of a sheet.
  ctx.beginPath();
  ctx.rect(x, y, FRAME * scale, FRAME * scale);
  ctx.clip();
  ctx.translate(x + (FRAME / 2) * scale, y + (FRAME / 2) * scale);
  ctx.scale(scale, scale);
  ctx.lineJoin = 'round';
  // The shadow falls the same way whichever way the figure faces: with the maps' light, down and right.
  // The small are drawn smaller all round: from above, height shows as size.
  const size = (0.55 + 0.45 * look.height) * 1.2;
  ctx.scale(size, size);
  oval(ctx, 1.8, 2.2, 10.5 * look.width, 8, 'rgba(0, 0, 0, 0.24)');
  ctx.rotate(TURN[direction]);
  figure(ctx, look, pose);
  ctx.restore();
}

/** How many times finer than a pixel the shapes are laid down before being sampled. */
const FINE = 4;
/** Below this a pixel counts as empty; a streak in the air or the shadow on the ground lies between. */
const SOLID = 200;

/**
 * Turns the shapes of a frame into pixel art, FRAME pixels a side: every pixel
 * takes the one color at its middle, each patch of color is lit from the upper
 * left (a lighter rim there, a darker one opposite) and the whole figure gets
 * a dark outline one pixel wide.
 */
function pixelated(shapes: ImageData): ImageData {
  const size = FRAME;
  const out = new ImageData(size, size);
  const data = out.data;
  // One sample per pixel, from the middle of its block.
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const from = ((y * FINE + FINE / 2) * shapes.width + x * FINE + FINE / 2) * 4;
      data.set(shapes.data.subarray(from, from + 4), (y * size + x) * 4);
    }
  }
  const flatColors = data.slice();
  const solid = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < size && y < size && flatColors[(y * size + x) * 4 + 3] >= SOLID;
  /** Whether the neighbour is another patch: empty, or of another color. */
  const edge = (x: number, y: number, nx: number, ny: number) => {
    if (!solid(nx, ny)) return true;
    const a = (y * size + x) * 4;
    const b = (ny * size + nx) * 4;
    return (
      flatColors[a] !== flatColors[b] ||
      flatColors[a + 1] !== flatColors[b + 1] ||
      flatColors[a + 2] !== flatColors[b + 2]
    );
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const at = (y * size + x) * 4;
      if (solid(x, y)) {
        data[at + 3] = 255;
        // Ink stays ink: the eyes, the edge of a blade.
        if (flatColors[at] + flatColors[at + 1] + flatColors[at + 2] < 150) continue;
        const lit = edge(x, y, x, y - 1) || edge(x, y, x - 1, y);
        const shaded = edge(x, y, x, y + 1) || edge(x, y, x + 1, y);
        if (lit === shaded) continue;
        for (let c = 0; c < 3; c++) {
          const value = flatColors[at + c];
          data[at + c] = lit ? value + (255 - value) * 0.2 : value * 0.74;
        }
      } else if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) {
        // The outline, on the empty pixels that touch the figure.
        data.set([43, 33, 24, 255], at);
      }
    }
  }
  return out;
}

/**
 * One frame of a figure as pixel art seen from above, on a canvas of FRAME
 * pixels a side with a transparent ground. It is meant to be drawn enlarged by
 * whole numbers, with smoothing off.
 */
export function spriteFrame(look: SpriteLook, pose: SpritePose, direction: SpriteFacing): HTMLCanvasElement {
  const shapes = document.createElement('canvas');
  shapes.width = shapes.height = FRAME * FINE;
  const fine = shapes.getContext('2d', { willReadFrequently: true })!;
  drawShapes(fine, look, pose, direction, 0, 0, FINE);
  const frame = document.createElement('canvas');
  frame.width = frame.height = FRAME;
  frame.getContext('2d')!.putImageData(pixelated(fine.getImageData(0, 0, shapes.width, shapes.height)), 0, 0);
  return frame;
}

/**
 * Lays every frame of every animation out on one sheet, on a transparent
 * ground: a row for each animation and facing (see `sheetCell`), a column for
 * each frame. Each frame is a square of `FRAME * scale` pixels; `scale` should
 * be a whole number, so that the pixels stay square.
 */
export function drawSpriteSheet(canvas: HTMLCanvasElement, look: SpriteLook, scale: number): void {
  const size = FRAME * scale;
  canvas.width = SHEET_COLUMNS * size;
  canvas.height = SHEET_ROWS * size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  for (const animation of SPRITE_ANIMATIONS) {
    for (const direction of SPRITE_FACINGS) {
      for (let frame = 0; frame < SPRITE_FRAMES[animation]; frame++) {
        const [column, row] = sheetCell(animation, direction, frame);
        const pixels = spriteFrame(look, spritePose(animation, frame), direction);
        ctx.drawImage(pixels, column * size, row * size, size, size);
      }
    }
  }
}
