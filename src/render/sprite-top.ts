import { SPRITE_PALETTES } from '../npc/sprite-palettes.ts';
import {
  CELL,
  SPRITE_FACINGS,
  SPRITE_FRAMES,
  topPose,
  type SpriteAnimation,
  type SpriteFacing,
  type SpriteLook,
  type TopLook,
  type TopPose,
} from '../npc/sprite.ts';

/**
 * The figure seen from straight above. No artist drew it that way, so it is
 * drawn here, but to the standard of the sheets it stands beside: the same
 * six-tone ramps for skin, hair, cloth and metal, lit from the upper left in
 * flat bands with no blending, each part edged in the darkest tone of its own
 * ramp, and every pixel one of those colors and nothing in between.
 */

type Ctx = CanvasRenderingContext2D;
/** A ramp of six tones, darkest first. */
type Ramp = readonly string[];

const ramp = (material: keyof typeof SPRITE_PALETTES, name: string): Ramp => {
  const ramps = SPRITE_PALETTES[material] as Record<string, Ramp>;
  return ramps[name] ?? ramps[Object.keys(ramps)[0]];
};
const WOOD = ramp('cloth', 'leather');
const STEEL = ramp('metal', 'steel');
const BRASS = ramp('metal', 'brass');
const BONE = ramp('cloth', 'white');
const HORN = ramp('body', 'black');

/** Where the light comes from, as seen by the figure being drawn (see `turned`). */
let lightX = -0.7;
let lightY = -0.7;

/** The tones of a ramp across something round, in bands: the lightest toward the light. */
function banded(ctx: Ctx, x: number, y: number, r: number, tones: Ramp): CanvasGradient {
  const paint = ctx.createLinearGradient(x + lightX * r, y + lightY * r, x - lightX * r, y - lightY * r);
  // Hard steps from tone to tone: pixel art shades in flats, never in blends.
  const steps: [number, string][] = [
    [0.16, tones[5]],
    [0.4, tones[4]],
    [0.72, tones[3]],
    [0.9, tones[2]],
    [1, tones[1]],
  ];
  let from = 0;
  for (const [to, tone] of steps) {
    paint.addColorStop(from, tone);
    paint.addColorStop(to, tone);
    from = to;
  }
  return paint;
}

/** Fills the current path in the bands of a ramp, and edges it in the ramp's darkest tone. */
function finish(ctx: Ctx, x: number, y: number, r: number, tones: Ramp, edged = true): void {
  ctx.fillStyle = banded(ctx, x, y, r, tones);
  ctx.fill();
  if (edged) {
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = tones[0];
    ctx.stroke();
  }
}

const disc = (ctx: Ctx, x: number, y: number, r: number, tones: Ramp, edged = true) => {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  finish(ctx, x, y, r, tones, edged);
};

const oval = (ctx: Ctx, x: number, y: number, rx: number, ry: number, tones: Ramp, edged = true) => {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  finish(ctx, x, y, Math.max(rx, ry), tones, edged);
};

/** A limb, a blade, a tail of hair: a rounded bar edged in the darkest tone. */
const bar = (ctx: Ctx, x0: number, y0: number, x1: number, y1: number, width: number, tones: Ramp) => {
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.strokeStyle = tones[0];
  ctx.lineWidth = width + 2.2;
  ctx.stroke();
  const reach = Math.hypot(x1 - x0, y1 - y0) / 2 + width;
  ctx.strokeStyle = banded(ctx, (x0 + x1) / 2, (y0 + y1) / 2, reach, tones);
  ctx.lineWidth = width;
  ctx.stroke();
};

/** A flat mark in one tone: an eye, a seam, a fold. */
const mark = (ctx: Ctx, x: number, y: number, r: number, tone: string) => {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = tone;
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

/** The head seen from above, facing up the picture. */
function head(ctx: Ctx, look: TopLook, cx: number, cy: number, r: number): void {
  const skin = ramp('body', look.skin);
  const hair = ramp('hair', look.hair);
  const hairy = look.hairStyle !== 'none';
  // What reaches past the face in front, and past the head behind, goes down first.
  if (look.beard) oval(ctx, cx, cy - r * 0.95, r * 0.62, r * 0.6, hair);
  if (look.snout) oval(ctx, cx, cy - r * 0.95, r * 0.5, r * 0.8, skin);
  if (!look.snout) {
    for (const s of [-1, 1]) {
      if (look.ears === 'pointed') {
        ctx.beginPath();
        ctx.moveTo(cx + s * r * 0.8, cy - 1.4);
        ctx.lineTo(cx + s * (r + 3.8), cy + 2.4);
        ctx.lineTo(cx + s * r * 0.78, cy + 2.4);
        ctx.closePath();
        finish(ctx, cx + s * r, cy, 3, skin);
      } else disc(ctx, cx + s * r * 0.98, cy + 0.2, 1.7, skin);
    }
  }
  if (hairy && look.hairStyle === 'long') oval(ctx, cx, cy + r * 0.8, r * 1.02, r * 1.3, hair);
  if (hairy && look.hairStyle === 'ponytail') bar(ctx, cx, cy + r - 1, cx, cy + r + 4.2, 1.8, hair);

  disc(ctx, cx, cy, r, skin);
  // The face: a nose, and two eyes under the brow.
  mark(ctx, cx, cy - r + 0.5, 1.1, skin[2]);
  for (const s of [-1, 1]) mark(ctx, cx + s * r * 0.42, cy - r * 0.55, 0.95, skin[0]);
  if (look.tusks) for (const s of [-1, 1]) mark(ctx, cx + s * r * 0.36, cy - r * 0.98, 0.85, BONE[5]);

  if (hairy) {
    // Hair over all of the head but the brow.
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.beginPath();
    if (look.hairStyle === 'mohawk') ctx.rect(cx - 1.9, cy - r * 0.62, 3.8, r * 2);
    else if (look.hairStyle === 'balding') {
      // A fringe round the back and the sides, the crown bare.
      ctx.arc(cx, cy + r * 0.3, r * 1.2, 0, Math.PI * 2);
      ctx.arc(cx, cy - r * 0.05, r * 0.62, 0, Math.PI * 2, true);
    } else ctx.arc(cx, cy + r * 0.44, r * 1.06, 0, Math.PI * 2);
    finish(ctx, cx, cy, r, hair);
    ctx.restore();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = hair[0];
    ctx.stroke();
  }
  if (look.horns) {
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + s * r * 0.25, cy - r * 0.2);
      ctx.quadraticCurveTo(cx + s * r * 1.15, cy - r * 0.3, cx + s * (r + 2.6), cy - r - 2.2);
      ctx.quadraticCurveTo(cx + s * r * 0.75, cy - r * 0.95, cx + s * r * 0.5, cy - r * 0.55);
      ctx.closePath();
      finish(ctx, cx + s * r * 0.8, cy - r * 0.6, 4, HORN);
    }
  }

  if (look.headgear === 'hood') {
    // Pulled over the head, open at the front, with its fold down the middle.
    const cloth = ramp('cloth', look.headgearColor);
    disc(ctx, cx, cy + r * 0.55, r + 0.9, cloth);
    ctx.strokeStyle = cloth[1];
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy + r * 1.35);
    ctx.stroke();
  } else if (look.headgear === 'helm') {
    const metal = ramp('metal', look.headgearColor);
    disc(ctx, cx, cy + r * 0.3, r + 0.6, metal);
    bar(ctx, cx, cy - r * 0.3, cx, cy + r * 0.8, 0.6, metal);
  } else if (look.headgear === 'hat') {
    // A pointed hat: the brim, the cone, and its tip fallen back.
    const cloth = ramp('cloth', look.headgearColor);
    disc(ctx, cx, cy + 0.4, r * 1.42, cloth);
    disc(ctx, cx, cy + 0.9, r * 0.84, cloth);
    disc(ctx, cx + 1.2, cy + 2.8, r * 0.36, cloth);
  }
}

/** The whole figure seen from straight above, facing up the picture, standing at the origin. */
function figure(ctx: Ctx, look: TopLook, pose: TopPose): void {
  const w = look.width;
  const metalled = look.outfit === 'armor';
  const clothes = ramp(metalled ? 'metal' : 'cloth', look.color);
  const skin = ramp('body', look.skin);
  const sleeve = look.outfit === 'fur' ? skin : clothes;
  const boots = ramp(metalled ? 'metal' : 'cloth', look.boots);
  const stride = pose.stride;

  if (look.cape) {
    // Trailing behind, and swaying with the step.
    const cape = ramp('cloth', look.cape);
    const sway = stride * 1.6;
    const length = 14 + Math.abs(stride) * 2.5;
    ctx.beginPath();
    ctx.moveTo(-7 * w, 1);
    ctx.quadraticCurveTo(-8.5 * w + sway, length * 0.6, -5 * w + sway, length);
    ctx.lineTo(5 * w + sway, length);
    ctx.quadraticCurveTo(8.5 * w + sway, length * 0.6, 7 * w, 1);
    ctx.closePath();
    finish(ctx, 0, length / 2, length * 0.7, cape);
    ctx.strokeStyle = cape[1];
    ctx.lineWidth = 1;
    for (const s of [-0.4, 0.4]) {
      ctx.beginPath();
      ctx.moveTo(s * 7 * w, 4);
      ctx.lineTo(s * 6 * w + sway, length - 1.5);
      ctx.stroke();
    }
  }

  // The feet: one ahead and one behind, in turn.
  for (const s of [-1, 1]) oval(ctx, s * 3.5 * w, 1 + s * stride * 6.5, 2.6 * w, 3.6, boots);
  // A robe hangs wide all round, and hides most of the stride.
  if (look.outfit === 'robe') oval(ctx, 0, 2.6, 8.3 * w, 7.4, clothes);

  // Where the hands are. Walking, each arm swings against the leg on its side.
  const shoulder = { left: [-8.8 * w, 0.8], right: [8.8 * w, 0.8] } as const;
  let left: [number, number] = [-9.8 * w, -1.5 - stride * 5];
  let right: [number, number] = [9.8 * w, -1.5 + stride * 5];
  // The bow is held out ahead, and the string drawn back along the same line.
  const nock: [number, number] = [0.4, -3.5 - 5 * pose.aim + pose.draw * 6.5];
  if (pose.weapon === 'sword') {
    right = ahead(shoulder.right[0], shoulder.right[1], pose.cut, 6);
    left = [-9.8 * w, 0.8];
  } else if (pose.weapon === 'bow') {
    left = [-1, -5 - 5 * pose.aim];
    if (pose.draw > 0 || pose.arrow === 0) right = [nock[0] + 1, nock[1] + 0.6];
  }
  bar(ctx, shoulder.left[0], shoulder.left[1], left[0], left[1], 3.2 * w, sleeve);
  bar(ctx, shoulder.right[0], shoulder.right[1], right[0], right[1], 3.2 * w, sleeve);

  // The shoulders, rising a little with each breath.
  oval(ctx, 0, 0.8, 10 * w, 5.6 + pose.breath * 0.5, clothes);
  if (metalled) {
    for (const s of [-1, 1]) disc(ctx, s * 7.2 * w, 0.8, 3, clothes);
  } else if (look.outfit === 'fur' || look.outfit === 'leather') {
    // A strap across the back.
    ctx.strokeStyle = clothes[1];
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-7 * w, 3.4);
    ctx.lineTo(6 * w, -2.6);
    ctx.stroke();
  }

  if (pose.weapon === 'bow') {
    const centerY = left[1] + 8.5;
    ctx.lineCap = 'round';
    for (const [tone, width] of [
      [WOOD[0], 3],
      [WOOD[4], 1.4],
    ] as const) {
      ctx.strokeStyle = tone;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.arc(0, centerY, 10.5, 1.22 * Math.PI, 1.78 * Math.PI);
      ctx.stroke();
    }
    const tipX = Math.cos(0.22 * Math.PI) * 10.5;
    const tipY = centerY - Math.sin(0.22 * Math.PI) * 10.5;
    ctx.strokeStyle = BONE[4];
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-tipX, tipY);
    ctx.lineTo(nock[0], pose.draw > 0 ? nock[1] : tipY);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
    if (pose.arrow !== null) {
      // On the string, or already on its way.
      const tail = pose.arrow === 0 ? nock[1] : left[1] - pose.arrow;
      bar(ctx, nock[0], tail, nock[0], tail - 10, 0.9, WOOD);
      ctx.beginPath();
      ctx.moveTo(nock[0], tail - 13.2);
      ctx.lineTo(nock[0] - 2, tail - 9.4);
      ctx.lineTo(nock[0] + 2, tail - 9.4);
      ctx.closePath();
      finish(ctx, nock[0], tail - 11, 2, STEEL);
    }
  }
  disc(ctx, left[0], left[1], 1.9, skin);
  disc(ctx, right[0], right[1], 1.9, skin);

  if (pose.weapon === 'sword') {
    const along = pose.cut - 0.12;
    const tip = ahead(right[0], right[1], along, 11.5);
    bar(ctx, right[0], right[1], tip[0], tip[1], 1.5, STEEL);
    // The guard, across the blade.
    const guard = ahead(right[0], right[1], along, 2.2);
    const a = ahead(guard[0], guard[1], along + Math.PI / 2, 2.6);
    const b = ahead(guard[0], guard[1], along - Math.PI / 2, 2.6);
    bar(ctx, a[0], a[1], b[0], b[1], 1, BRASS);
    if (pose.streak) {
      // The streak the blade leaves, as on the sheets: a pale arc, widest at the blade.
      ctx.lineCap = 'round';
      for (let k = 0; k < 8; k++) {
        const a0 = 1.9 + ((pose.cut - 1.9) * k) / 8;
        const a1 = 1.9 + ((pose.cut - 1.9) * (k + 1)) / 8;
        ctx.strokeStyle = k < 4 ? BONE[3] : BONE[4];
        ctx.lineWidth = 0.8 + (k / 8) * 2.4;
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

/** How many times finer than a pixel the shapes are laid down before being sampled. */
const FINE = 4;

/** Every color a figure may be made of, as numbers 0xRRGGBB: its ramps, and those of what it may carry. */
function colorsOf(look: TopLook): number[] {
  const ramps = [
    ramp('body', look.skin),
    ramp('hair', look.hair),
    ramp(look.outfit === 'armor' ? 'metal' : 'cloth', look.color),
    ramp(look.outfit === 'armor' ? 'metal' : 'cloth', look.boots),
    ramp(look.headgear === 'helm' ? 'metal' : 'cloth', look.headgearColor),
    look.cape ? ramp('cloth', look.cape) : [],
    WOOD,
    STEEL,
    BRASS,
    BONE,
    HORN,
  ];
  return [...new Set(ramps.flat().map((color) => parseInt(color.slice(1), 16)))];
}

/**
 * Samples the shapes down to pixels: one color per pixel, taken at its middle,
 * moved to the nearest color of the figure's ramps so that nothing is blended,
 * and either wholly there or not at all.
 */
function pixelated(shapes: ImageData, columns: number, rows: number, colors: number[]): ImageData {
  const out = new ImageData(columns, rows);
  const nearest = new Map<number, number>();
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      const from = ((y * FINE + FINE / 2) * shapes.width + x * FINE + FINE / 2) * 4;
      if (shapes.data[from + 3] < 128) continue;
      const color = (shapes.data[from] << 16) | (shapes.data[from + 1] << 8) | shapes.data[from + 2];
      let snapped = nearest.get(color);
      if (snapped === undefined) {
        let best = Infinity;
        snapped = color;
        for (const candidate of colors) {
          const distance =
            ((candidate >> 16) - (color >> 16)) ** 2 +
            (((candidate >> 8) & 255) - ((color >> 8) & 255)) ** 2 +
            ((candidate & 255) - (color & 255)) ** 2;
          if (distance < best) {
            best = distance;
            snapped = candidate;
          }
        }
        nearest.set(color, snapped);
      }
      out.data.set([snapped >> 16, (snapped >> 8) & 255, snapped & 255, 255], (y * columns + x) * 4);
    }
  }
  return out;
}

/**
 * Every frame of one animation of a look, seen from above: laid out exactly as
 * the sheets are (a row for each facing, in the order of `SPRITE_FACINGS`, a
 * column for each frame, each in a cell of `CELL` pixels with the figure at its
 * middle), so that one piece of code plays both.
 */
export function topStrip(look: SpriteLook, animation: SpriteAnimation): HTMLCanvasElement {
  const frames = SPRITE_FRAMES[animation];
  const strip = document.createElement('canvas');
  strip.width = frames * CELL;
  strip.height = SPRITE_FACINGS.length * CELL;
  const out = strip.getContext('2d')!;
  const colors = colorsOf(look.top);
  // One cell at a time, on a canvas FINE times finer than the cell.
  const shapes = document.createElement('canvas');
  shapes.width = shapes.height = CELL * FINE;
  const ctx = shapes.getContext('2d', { willReadFrequently: true })!;
  ctx.lineJoin = 'round';
  for (const [row, facing] of SPRITE_FACINGS.entries()) {
    for (let frame = 0; frame < frames; frame++) {
      ctx.clearRect(0, 0, shapes.width, shapes.height);
      ctx.save();
      ctx.translate(shapes.width / 2, shapes.height / 2);
      // A little larger than life, to stand beside the sheets, whose figures fill their frame.
      ctx.scale(FINE * 1.45, FINE * 1.45);
      const turn = TURN[facing];
      ctx.rotate(turn);
      // The light stays where it is on the page while the figure turns under it.
      lightX = -0.7 * Math.cos(turn) - 0.7 * Math.sin(turn);
      lightY = 0.7 * Math.sin(turn) - 0.7 * Math.cos(turn);
      figure(ctx, look.top, topPose(animation, frame));
      ctx.restore();
      const cell = pixelated(ctx.getImageData(0, 0, shapes.width, shapes.height), CELL, CELL, colors);
      out.putImageData(cell, frame * CELL, row * CELL);
    }
  }
  return strip;
}
