import {
  SPRITE_ANIMATIONS,
  spriteFrameAt,
  spriteLooks,
  type SpriteAnimation,
  type SpriteFacing,
  type SpriteLook,
  type SpriteSubject,
  type SpriteView as View,
} from '../npc/sprite.ts';
import { drawSprite, drawSpriteSheet, spriteStrip } from '../render/sprite.ts';

export interface SpriteView {
  /** Offers the looks of this NPC, with the one already chosen marked. */
  show(subject: SpriteSubject, seed: number, chosen: number): void;
}

const ANIMATION_LABEL: Record<SpriteAnimation, string> = {
  idle: 'Parado',
  walk: 'Andando',
  slash: 'Espada',
  shoot: 'Arco',
};
const FACING_LABEL: Record<SpriteFacing, string> = {
  down: '↓ Baixo',
  left: '← Esquerda',
  right: '→ Direita',
  up: '↑ Cima',
};
const VIEW_LABEL: Record<View, string> = { angled: 'Inclinada', top: 'De cima' };
const VIEW_ORDER: readonly View[] = ['angled', 'top'];
/** The order the facings are offered in, which is not that of the rows of a sheet. */
const FACING_ORDER: readonly SpriteFacing[] = ['down', 'left', 'right', 'up'];

/** How many times the pixels of the figure are enlarged: in the options, and in the large preview. */
const OPTION_ZOOM = 2;
const PREVIEW_ZOOM = 4;

/** The ground the figure is shown on: the grass of the maps, with their grid, so it is seen as it will be used. */
function ground(ctx: CanvasRenderingContext2D, width: number, height: number, square: number): void {
  ctx.fillStyle = '#8fa25c';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(30, 25, 15, 0.16)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let at = square / 2; at < width; at += square) {
    ctx.moveTo(at, 0);
    ctx.lineTo(at, height);
  }
  for (let at = square / 2; at < height; at += square) {
    ctx.moveTo(0, at);
    ctx.lineTo(width, at);
  }
  ctx.stroke();
}

/**
 * The sprite of an NPC: five looks to choose from, the chosen one shown large
 * and moving (standing, walking, cutting with a sword, shooting a bow) in any
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
  let animation: SpriteAnimation = 'walk';
  let facing: SpriteFacing = 'down';
  let view: View = 'angled';
  /** When the animation on screen was started, in ms. */
  let started = performance.now();
  /** The figures put together so far, by look, view and animation; the rest are still being fetched. */
  const strips = new Map<string, HTMLCanvasElement>();
  /** Counts the NPCs shown, so that a figure arriving late for an earlier one is dropped. */
  let showing = 0;
  let last = -1;

  /** Asks for the figures of the animation on screen, for every look. */
  const fetchStrips = () => {
    const mine = showing;
    for (const [option, look] of looks.entries()) {
      const key = `${option}:${view}:${animation}`;
      if (strips.has(key)) continue;
      void spriteStrip(look, animation, view).then((strip) => {
        if (mine !== showing) return;
        strips.set(key, strip);
        last = -1;
      });
    }
  };

  const thumbs = Array.from({ length: 5 }, (_, option) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.title = `Opção ${option + 1}`;
    const canvas = document.createElement('canvas');
    canvas.width = 96;
    canvas.height = 128;
    button.append(canvas);
    button.addEventListener('click', () => {
      chosen = option;
      last = -1;
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
        last = -1;
        fetchStrips();
        for (const [index, other] of buttons.entries()) {
          other.classList.toggle('active', values[index] === current());
        }
      });
      container.append(button);
      return button;
    });
    for (const [index, button] of buttons.entries()) {
      button.classList.toggle('active', values[index] === current());
    }
  };
  choices(
    find('#sprite-animations'),
    SPRITE_ANIMATIONS,
    ANIMATION_LABEL,
    () => animation,
    (value) => (animation = value),
  );
  choices(
    find('#sprite-views'),
    VIEW_ORDER,
    VIEW_LABEL,
    () => view,
    (value) => (view = value),
  );
  choices(
    find('#sprite-facings'),
    FACING_ORDER,
    FACING_LABEL,
    () => facing,
    (value) => (facing = value),
  );
  const mark = () => {
    for (const [option, thumb] of thumbs.entries())
      thumb.button.classList.toggle('active', option === chosen);
  };

  const draw = (frame: number) => {
    for (const [option, thumb] of thumbs.entries()) {
      const ctx = thumb.canvas.getContext('2d')!;
      ground(ctx, thumb.canvas.width, thumb.canvas.height, 64);
      const strip = strips.get(`${option}:${view}:${animation}`);
      const y = view === 'top' ? 64 : 118;
      if (strip) drawSprite(ctx, strip, facing, frame, 48, y, OPTION_ZOOM, looks[option].scale, view);
    }
    const ctx = preview.getContext('2d')!;
    ground(ctx, preview.width, preview.height, 96);
    const strip = strips.get(`${chosen}:${view}:${animation}`);
    const y = view === 'top' ? preview.height / 2 : 322;
    if (strip) {
      drawSprite(ctx, strip, facing, frame, preview.width / 2, y, PREVIEW_ZOOM, looks[chosen].scale, view);
    }
  };
  const tick = (now: number) => {
    requestAnimationFrame(tick);
    if (looks.length === 0 || !visible()) return;
    const frame = spriteFrameAt(animation, (now - started) / 1000);
    // Redrawn only when the frame changes, or something was chosen or arrived.
    if (frame === last) return;
    last = frame;
    draw(frame);
  };
  requestAnimationFrame(tick);

  find('#sprite-save').addEventListener('click', async () => {
    const look = looks[chosen];
    if (!look) return;
    const sheet = document.createElement('canvas');
    await drawSpriteSheet(sheet, look, view);
    sheet.toBlob((blob) => {
      if (!blob) return;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${fileName()}-sprite${view === 'top' ? '-de-cima' : ''}.png`;
      link.click();
      URL.revokeObjectURL(link.href);
    }, 'image/png');
  });

  return {
    show(subject, seed, option) {
      looks = spriteLooks(subject, seed);
      chosen = option;
      showing += 1;
      strips.clear();
      last = -1;
      mark();
      fetchStrips();
    },
  };
}
