import {
  CELL,
  FRAME,
  layersFor,
  recolorTable,
  SHEET_COLUMNS,
  SHEET_ROWS,
  sheetCell,
  SPRITE_ANIMATIONS,
  SPRITE_FACINGS,
  SPRITE_FRAMES,
  type SpriteAnimation,
  type SpriteFacing,
  type SpriteLayer,
  type SpriteLook,
} from '../npc/sprite.ts';

/** Where the sheets are served from. */
const BASE = '/lpc/';
/** How far a color of a sheet may be from one of its ramp, per channel, and still be taken for it. */
const TOLERANCE = 10;

/** The sheets as they come, by path. A sheet that fails to load is remembered as missing. */
const sheets = new Map<string, Promise<HTMLImageElement | null>>();

function load(layer: SpriteLayer, animation: SpriteAnimation): Promise<HTMLImageElement | null> {
  const path = `${BASE}${layer.id}/${animation}.png`;
  let pending = sheets.get(path);
  if (!pending) {
    pending = new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = path;
    });
    sheets.set(path, pending);
  }
  return pending;
}

/** The sheets already recolored, by path and tint. */
const recolored = new Map<string, HTMLCanvasElement>();

/** A sheet with the colors of one ramp replaced by those of another. */
function recolor(
  image: HTMLImageElement,
  key: string,
  tint: NonNullable<SpriteLayer['tint']>,
): HTMLCanvasElement {
  const cached = recolored.get(key);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(image, 0, 0);
  const table = recolorTable(tint);
  const ramp = [...table.keys()];
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = pixels.data;
  /** What each color met so far turns into; null for a color that is not of the ramp. */
  const seen = new Map<number, number | null>();
  for (let at = 0; at < data.length; at += 4) {
    if (data[at + 3] === 0) continue;
    const color = (data[at] << 16) | (data[at + 1] << 8) | data[at + 2];
    let to = seen.get(color);
    if (to === undefined) {
      to = table.get(color) ?? null;
      if (to === null) {
        // Not exactly a color of the ramp: the nearest one, if it is near enough.
        const near = ramp.find(
          (from) =>
            Math.abs((from >> 16) - (color >> 16)) <= TOLERANCE &&
            Math.abs(((from >> 8) & 255) - ((color >> 8) & 255)) <= TOLERANCE &&
            Math.abs((from & 255) - (color & 255)) <= TOLERANCE,
        );
        if (near !== undefined) to = table.get(near)!;
      }
      seen.set(color, to);
    }
    if (to === null) continue;
    data[at] = to >> 16;
    data[at + 1] = (to >> 8) & 255;
    data[at + 2] = to & 255;
  }
  ctx.putImageData(pixels, 0, 0);
  recolored.set(key, canvas);
  return canvas;
}

/** The figures already put together, by look and animation. */
const composed = new Map<string, Promise<HTMLCanvasElement>>();

/**
 * Every frame of one animation of a look, its layers laid one over the other:
 * a row for each facing (in the order of `SPRITE_FACINGS`), a column for each
 * frame, each in a cell of `CELL` pixels with the figure in its middle.
 */
export function spriteStrip(look: SpriteLook, animation: SpriteAnimation): Promise<HTMLCanvasElement> {
  const layers = layersFor(look, animation);
  const key = `${animation}|${layers.map((l) => `${l.id}:${l.tint ? `${l.tint.from}>${l.tint.to}` : ''}`).join('|')}`;
  let pending = composed.get(key);
  if (!pending) {
    pending = (async () => {
      const images = await Promise.all(layers.map((layer) => load(layer, animation)));
      const frames = SPRITE_FRAMES[animation];
      const canvas = document.createElement('canvas');
      canvas.width = frames * CELL;
      canvas.height = SPRITE_FACINGS.length * CELL;
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      for (const [index, layer] of layers.entries()) {
        const image = images[index];
        // A sheet that could not be fetched is left out rather than failing the whole figure.
        if (!image) continue;
        const source = layer.tint
          ? recolor(
              image,
              `${layer.id}/${animation}/${layer.tint.material}/${layer.tint.from}/${layer.tint.to}`,
              layer.tint,
            )
          : image;
        const size = layer.large ? CELL : FRAME;
        const inset = (CELL - size) / 2;
        for (let row = 0; row < SPRITE_FACINGS.length; row++) {
          for (let frame = 0; frame < frames; frame++) {
            // Some sheets have fewer frames than the animation: their last one is held.
            const column = Math.min(frame, Math.floor(source.width / size) - 1);
            if (column < 0 || (row + 1) * size > source.height) continue;
            ctx.drawImage(
              source,
              column * size,
              row * size,
              size,
              size,
              frame * CELL + inset,
              row * CELL + inset,
              size,
              size,
            );
          }
        }
      }
      return canvas;
    })();
    composed.set(key, pending);
  }
  return pending;
}

/**
 * Draws one frame from a strip made by `spriteStrip`, enlarged `zoom` times
 * with its pixels kept square, with the feet of the figure at (x, y). `scale`
 * is the height of the figure against an adult human.
 */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  strip: HTMLCanvasElement,
  facing: SpriteFacing,
  frame: number,
  x: number,
  y: number,
  zoom: number,
  scale = 1,
): void {
  const size = CELL * zoom * scale;
  // Within a cell, the feet stand at the bottom of the figure's own frame.
  const feet = (CELL + FRAME) / 2 - 2;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    strip,
    frame * CELL,
    SPRITE_FACINGS.indexOf(facing) * CELL,
    CELL,
    CELL,
    Math.round(x - size / 2),
    Math.round(y - (feet / CELL) * size),
    size,
    size,
  );
}

/**
 * Lays every frame of every animation out on one sheet, on a transparent
 * ground: a row for each animation and facing (see `sheetCell`), a column for
 * each frame, each in a cell of `CELL` pixels.
 */
export async function drawSpriteSheet(canvas: HTMLCanvasElement, look: SpriteLook): Promise<void> {
  canvas.width = SHEET_COLUMNS * CELL;
  canvas.height = SHEET_ROWS * CELL;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const animation of SPRITE_ANIMATIONS) {
    const strip = await spriteStrip(look, animation);
    const [, row] = sheetCell(animation, SPRITE_FACINGS[0], 0);
    ctx.drawImage(strip, 0, row * CELL);
  }
}
