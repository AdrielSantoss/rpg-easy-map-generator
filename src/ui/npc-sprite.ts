import {
  SPRITE_ANIMATIONS,
  SPRITE_FACINGS,
  spriteFrameAt,
  spriteLooks,
  spritePose,
  type SpriteAnimation,
  type SpriteFacing,
  type SpriteLook,
  type SpriteSubject,
} from '../npc/sprite.ts';
import { drawSpriteSheet, FRAME, spriteFrame } from '../render/sprite.ts';

export interface SpriteView {
  /** Offers the looks of this NPC, with the one already chosen marked. */
  show(subject: SpriteSubject, seed: number, chosen: number): void;
}

const ANIMATION_LABEL: Record<SpriteAnimation, string> = {
  idle: 'Parado',
  run: 'Correndo',
  sword: 'Espada',
  bow: 'Arco',
};
const FACING_LABEL: Record<SpriteFacing, string> = {
  down: '↓ Para baixo',
  left: '← Esquerda',
  right: '→ Direita',
  up: '↑ Para cima',
};

/**
 * How many times each pixel of a frame is enlarged: in the options, in the large
 * preview and in the saved sheet. Whole numbers, so that the pixels stay square.
 */
const OPTION_SCALE = 2;
const PREVIEW_SCALE = 6;
const SHEET_SCALE = 2;
/** The part of the frame an option shows: the figure, without the room left around it for its weapons. */
const CROP = { x: 8, y: 8, size: 48 };

/** The ground the figure is shown on: the grass of the maps, with their grid, so it is seen as it will be used. */
function ground(ctx: CanvasRenderingContext2D, size: number, square: number): void {
  ctx.fillStyle = '#8fa25c';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(30, 25, 15, 0.16)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let at = square / 2; at < size; at += square) {
    ctx.moveTo(at, 0);
    ctx.lineTo(at, size);
    ctx.moveTo(0, at);
    ctx.lineTo(size, at);
  }
  ctx.stroke();
}

/**
 * The sprite of an NPC: five looks to choose from, the chosen one shown large
 * and moving (standing, running, cutting with a sword, shooting a bow) in any
 * of the four directions, and the whole of it saved as a sprite sheet.
 * `visible` tells whether anyone is looking, so that nothing is drawn unseen.
 */
export function initSpriteView(
  root: HTMLElement,
  visible: () => boolean,
  onChoose: (option: number) => void,
  fileName: () => string,
): SpriteView {
  const find = <T extends HTMLElement>(selector: string) => root.querySelector(selector) as T;
  const preview = find<HTMLCanvasElement>('#sprite-preview');
  const options = find('#sprite-options');
  let looks: SpriteLook[] = [];
  let chosen = 0;
  let animation: SpriteAnimation = 'run';
  let facing: SpriteFacing = 'down';
  /** When the animation on screen was started, in ms. */
  let started = performance.now();

  const thumbs = Array.from({ length: 5 }, (_, option) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.title = `Opção ${option + 1}`;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = CROP.size * OPTION_SCALE;
    button.append(canvas);
    button.addEventListener('click', () => {
      chosen = option;
      mark();
      onChoose(option);
    });
    options.append(button);
    return { button, canvas };
  });
  const choices = <T extends string>(
    container: HTMLElement,
    values: readonly T[],
    labels: Record<T, string>,
    current: () => T,
    choose: (value: T) => void,
  ) => {
    const buttons = values.map((value) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = labels[value];
      button.addEventListener('click', () => {
        choose(value);
        started = performance.now();
        for (const [index, other] of buttons.entries())
          other.classList.toggle('active', values[index] === current());
      });
      container.append(button);
      return button;
    });
    for (const [index, button] of buttons.entries())
      button.classList.toggle('active', values[index] === current());
  };
  choices(
    find('#sprite-animations'),
    SPRITE_ANIMATIONS,
    ANIMATION_LABEL,
    () => animation,
    (value) => (animation = value),
  );
  choices(
    find('#sprite-facings'),
    SPRITE_FACINGS,
    FACING_LABEL,
    () => facing,
    (value) => (facing = value),
  );
  const mark = () => {
    for (const [option, thumb] of thumbs.entries())
      thumb.button.classList.toggle('active', option === chosen);
  };

  /** Frames already turned into pixels, by look, animation, facing and frame. */
  const frames = new Map<string, HTMLCanvasElement>();
  const pixels = (option: number, frame: number) => {
    const key = `${option}:${animation}:${facing}:${frame}`;
    let made = frames.get(key);
    if (!made) {
      made = spriteFrame(looks[option], spritePose(animation, frame), facing);
      frames.set(key, made);
    }
    return made;
  };
  const draw = (frame: number) => {
    for (const [option, thumb] of thumbs.entries()) {
      const ctx = thumb.canvas.getContext('2d')!;
      ground(ctx, thumb.canvas.width, thumb.canvas.width / 2);
      if (!looks[option]) continue;
      ctx.imageSmoothingEnabled = false;
      const side = thumb.canvas.width;
      ctx.drawImage(pixels(option, frame), CROP.x, CROP.y, CROP.size, CROP.size, 0, 0, side, side);
    }
    const ctx = preview.getContext('2d')!;
    ground(ctx, preview.width, preview.width / 4);
    if (looks[chosen]) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(pixels(chosen, frame), 0, 0, FRAME * PREVIEW_SCALE, FRAME * PREVIEW_SCALE);
    }
  };
  let last = -1;
  const tick = (now: number) => {
    requestAnimationFrame(tick);
    if (looks.length === 0 || !visible()) return;
    const frame = spriteFrameAt(animation, (now - started) / 1000);
    // Redrawn only when the frame changes, or something was chosen.
    const stamp =
      frame +
      chosen * 100 +
      SPRITE_ANIMATIONS.indexOf(animation) * 1000 +
      SPRITE_FACINGS.indexOf(facing) * 10000;
    if (stamp === last) return;
    last = stamp;
    draw(frame);
  };
  requestAnimationFrame(tick);

  find('#sprite-save').addEventListener('click', () => {
    const look = looks[chosen];
    if (!look) return;
    const sheet = document.createElement('canvas');
    drawSpriteSheet(sheet, look, SHEET_SCALE);
    sheet.toBlob((blob) => {
      if (!blob) return;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${fileName()}-sprite.png`;
      link.click();
      URL.revokeObjectURL(link.href);
    }, 'image/png');
  });

  return {
    show(subject, seed, option) {
      looks = spriteLooks(subject, seed);
      frames.clear();
      chosen = option;
      last = -1;
      mark();
    },
  };
}
