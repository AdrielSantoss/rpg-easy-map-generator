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
import { drawSprite, drawSpriteSheet, FRAME } from '../render/sprite.ts';

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
  down: '↓ Frente',
  left: '← Esquerda',
  right: '→ Direita',
  up: '↑ Costas',
};

/** Pixels per unit of the frame: in the options, in the large preview, and in the saved sheet. */
const OPTION_SCALE = 1.5;
const PREVIEW_SCALE = 5;
const SHEET_SCALE = 2;

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
    canvas.width = canvas.height = FRAME * OPTION_SCALE;
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

  const draw = (frame: number) => {
    const pose = spritePose(animation, frame);
    for (const [option, thumb] of thumbs.entries()) {
      const ctx = thumb.canvas.getContext('2d')!;
      ground(ctx, thumb.canvas.width, thumb.canvas.width / 2);
      if (looks[option]) drawSprite(ctx, looks[option], pose, facing, 0, 0, OPTION_SCALE);
    }
    const ctx = preview.getContext('2d')!;
    ground(ctx, preview.width, preview.width / 4);
    if (looks[chosen]) {
      const offset = (preview.width - FRAME * PREVIEW_SCALE) / 2;
      drawSprite(ctx, looks[chosen], pose, facing, offset, offset - 16, PREVIEW_SCALE);
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
      chosen = option;
      last = -1;
      mark();
    },
  };
}
