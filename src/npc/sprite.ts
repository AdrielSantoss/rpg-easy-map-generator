import { seededRng, type Rng } from '../generator/rng.ts';
import type { NpcAge, NpcGender, NpcRace, NpcWealth } from './prompt.ts';
import type { ClassId } from './sheet-data.ts';
import { SPRITE_PALETTES, type SpriteMaterial } from './sprite-palettes.ts';

/**
 * The little figure that stands for an NPC on a map. It is put together from
 * the sheets of the Liberated Pixel Cup (see public/lpc/CREDITS.md): a body, a
 * head, hair, clothes and so on, each drawn by an artist for every frame of
 * every animation, laid one over the other and recolored. Nothing here draws;
 * this says which layers, in which colors. `render/sprite.ts` does the rest.
 */

/** How many looks are offered for one NPC to choose from. */
export const SPRITE_OPTIONS = 5;

export const SPRITE_ANIMATIONS = ['idle', 'walk', 'slash', 'shoot'] as const;
export type SpriteAnimation = (typeof SPRITE_ANIMATIONS)[number];

/** The way the figure faces, in the order of the rows of an LPC sheet. */
export const SPRITE_FACINGS = ['up', 'left', 'down', 'right'] as const;
export type SpriteFacing = (typeof SPRITE_FACINGS)[number];

export const SPRITE_FRAMES: Record<SpriteAnimation, number> = { idle: 2, walk: 9, slash: 6, shoot: 13 };
/** Frames per second each animation is meant to be played at. */
export const SPRITE_FPS: Record<SpriteAnimation, number> = { idle: 2, walk: 10, slash: 11, shoot: 13 };

/** The side of a frame of the figure, in pixels. */
export const FRAME = 64;
/**
 * The side of the cell a frame is kept in. It is larger than the figure
 * because some weapons swing well outside it; the figure stands in the middle.
 */
export const CELL = 128;

/** One sheet of the figure: which, where in the pile, and how it is recolored. */
export interface SpriteLayer {
  /** The folder of the sheets, under public/lpc. */
  id: string;
  /** Layers are painted from the lowest to the highest. */
  z: number;
  /** Left out, the sheet is used in the colors it was drawn in. */
  tint?: { material: SpriteMaterial; from: string; to: string };
  /** A weapon is shown only while it is being used. */
  only?: SpriteAnimation;
  /** A sheet whose frames are already as large as a cell. */
  large?: boolean;
}

/**
 * The two ways the figure can be seen: at the slant of the old console RPGs,
 * as the sheets were drawn, or from straight above, as the maps are.
 */
export const SPRITE_VIEWS = ['angled', 'top'] as const;
export type SpriteView = (typeof SPRITE_VIEWS)[number];

/**
 * What the figure seen from above is drawn from: the same person in the same
 * clothes as the layers show, said in words, since no sheet was drawn from
 * that side. Colors are names of ramps in SPRITE_PALETTES.
 */
export interface TopLook {
  /** How broad in the shoulders, against a grown man, who is 1. */
  width: number;
  skin: string;
  hair: string;
  /** The cut of the hair as it shows from above; 'none' under a hood or a helm, and on scales. */
  hairStyle: 'none' | 'short' | 'long' | 'ponytail' | 'balding' | 'mohawk';
  beard: boolean;
  ears: 'round' | 'pointed';
  horns: boolean;
  tusks: boolean;
  snout: boolean;
  outfit: 'tunic' | 'robe' | 'armor' | 'leather' | 'fur';
  /** The ramp of the clothes: of cloth, or of metal for armor. */
  color: string;
  boots: string;
  cape: string | null;
  headgear: 'none' | 'hood' | 'hat' | 'helm';
  /** The ramp of what is worn on the head: of cloth, or of metal for a helm. */
  headgearColor: string;
}

export interface SpriteLook {
  layers: SpriteLayer[];
  top: TopLook;
  /** How large the figure is drawn against an adult human, which is 1. */
  scale: number;
}

/** What is known of the NPC that shows on its figure. */
export interface SpriteSubject {
  race: NpcRace;
  gender: NpcGender;
  age: NpcAge;
  wealth: NpcWealth;
  classId: ClassId;
}

const pick = <T>(list: readonly T[], rng: Rng): T => list[Math.floor(rng() * list.length)];

type Skin = keyof typeof SPRITE_PALETTES.body;
type Hair = keyof typeof SPRITE_PALETTES.hair;
type Cloth = keyof typeof SPRITE_PALETTES.cloth;

const SKIN: Record<NpcRace, readonly Skin[]> = {
  human: ['light', 'amber', 'olive', 'taupe', 'bronze', 'brown', 'black'],
  elf: ['light', 'amber', 'olive'],
  'half-elf': ['light', 'amber', 'olive', 'taupe'],
  dwarf: ['light', 'amber', 'olive', 'taupe'],
  halfling: ['light', 'amber', 'olive', 'bronze'],
  gnome: ['light', 'amber', 'taupe'],
  'half-orc': ['pale_green', 'green'],
  orc: ['green', 'dark_green', 'bright_green'],
  tiefling: ['lavender', 'blue'],
  dragonborn: ['green', 'dark_green', 'blue', 'fur_copper', 'fur_gold', 'bright_green'],
};

/** How tall each race stands against a human. */
const HEIGHT: Record<NpcRace, number> = {
  human: 1,
  elf: 1,
  'half-elf': 1,
  dwarf: 0.84,
  halfling: 0.78,
  gnome: 0.75,
  'half-orc': 1.04,
  orc: 1.08,
  tiefling: 1,
  dragonborn: 1.06,
};

const HAIR: readonly Hair[] = [
  'black',
  'raven',
  'dark_brown',
  'chestnut',
  'light_brown',
  'blonde',
  'sandy',
  'ginger',
  'redhead',
];
const GREY: readonly Hair[] = ['gray', 'white', 'platinum', 'ash'];
const HAIR_STYLES: Record<NpcGender, readonly string[]> = {
  male: ['plain', 'buzzcut', 'messy', 'balding', 'shorthawk', 'ponytail', 'long', 'bangs'],
  female: ['long', 'bob', 'ponytail', 'bangs', 'plain', 'messy'],
};

const CLOTH: Record<NpcWealth, readonly Cloth[]> = {
  peasant: ['brown', 'tan', 'walnut', 'gray', 'forest', 'leather'],
  burgher: ['blue', 'green', 'maroon', 'teal', 'orange', 'bluegray', 'sky'],
  noble: ['purple', 'red', 'navy', 'lavender', 'white', 'rose'],
};

type Outfit = 'tunic' | 'robe' | 'armor' | 'leather' | 'fur';
type Headgear = 'none' | 'hood' | 'hat' | 'helm';

/** What each class wears, the colors it may come in, and what may go on the head. */
const DRESS: Record<
  ClassId,
  { outfit: Outfit; colors: readonly string[] | null; headgear: readonly Headgear[]; cape: number }
> = {
  commoner: { outfit: 'tunic', colors: null, headgear: ['none', 'none', 'none', 'hood'], cape: 0.1 },
  barbarian: {
    outfit: 'fur',
    colors: ['leather', 'brown', 'walnut'],
    headgear: ['none', 'none', 'helm'],
    cape: 0.2,
  },
  bard: {
    outfit: 'tunic',
    colors: ['purple', 'teal', 'orange', 'rose', 'yellow'],
    headgear: ['none'],
    cape: 0.6,
  },
  cleric: { outfit: 'robe', colors: ['white', 'tan', 'sky'], headgear: ['none', 'hood'], cape: 0.2 },
  druid: { outfit: 'robe', colors: ['forest', 'green', 'brown'], headgear: ['hood', 'none'], cape: 0.3 },
  fighter: {
    outfit: 'armor',
    colors: ['steel', 'iron', 'bronze'],
    headgear: ['helm', 'none', 'none'],
    cape: 0.3,
  },
  monk: { outfit: 'robe', colors: ['orange', 'tan', 'brown'], headgear: ['none'], cape: 0 },
  paladin: { outfit: 'armor', colors: ['silver', 'gold', 'steel'], headgear: ['helm', 'none'], cape: 0.8 },
  ranger: {
    outfit: 'leather',
    colors: ['forest', 'leather', 'brown'],
    headgear: ['hood', 'hood', 'none'],
    cape: 0.7,
  },
  rogue: {
    outfit: 'leather',
    colors: ['black', 'charcoal', 'leather'],
    headgear: ['hood', 'hood', 'none'],
    cape: 0.5,
  },
  sorcerer: { outfit: 'robe', colors: ['red', 'maroon', 'orange'], headgear: ['none', 'hood'], cape: 0.3 },
  warlock: { outfit: 'robe', colors: ['black', 'purple', 'charcoal'], headgear: ['hood', 'none'], cape: 0.4 },
  wizard: {
    outfit: 'robe',
    colors: ['blue', 'navy', 'purple', 'teal'],
    headgear: ['hat', 'hat', 'none'],
    cape: 0.2,
  },
};

/** The colors the wizard's hat was drawn in. */
const WIZARD_HATS: readonly string[] = ['blue', 'navy', 'purple', 'teal'];
const CAPES: readonly Cloth[] = ['red', 'maroon', 'navy', 'forest', 'purple', 'black', 'brown'];
const BOOTS: readonly Cloth[] = ['brown', 'leather', 'black', 'walnut'];
const TROUSERS: readonly Cloth[] = ['brown', 'charcoal', 'gray', 'walnut', 'navy', 'leather'];

const cloth = (to: string) => ({ material: 'cloth', from: 'white', to }) as const;
const metal = (to: string) => ({ material: 'metal', from: 'steel', to }) as const;

/**
 * The looks offered for an NPC. Who it is stays the same in all of them: body,
 * skin and the color of the hair. What changes from one to the next is what
 * could be changed in life: the cut of the hair, the clothes, what is worn on
 * the head and over the shoulders. The same subject and seed always give the
 * same looks.
 */
export function spriteLooks(subject: SpriteSubject, seed: number): SpriteLook[] {
  const { race, gender, age, wealth, classId } = subject;
  const who = seededRng(`sprite:${race}:${gender}:${seed}`);
  const child = age === 'child';
  const skinColor = pick(SKIN[race], who);
  const hairColor = age === 'elder' ? pick(GREY, who) : pick(HAIR, who);
  const whiskers = who() < 0.3;
  // Scales grow no beard; every grown dwarf has one.
  const bearded = !child && gender === 'male' && race !== 'dragonborn' && (race === 'dwarf' || whiskers);
  const beard = pick(
    race === 'dwarf' ? ['beard-winter', 'beard-winter', 'beard-medium'] : ['beard-medium'],
    who,
  );
  const dress = DRESS[classId];
  const skin = { material: 'body', from: 'light', to: skinColor } as const;
  const hair = { material: 'hair', from: 'orange', to: hairColor } as const;
  /** The sheets drawn for a man's build and for a woman's. */
  const built = (name: string) => `${name}-${gender}`;

  // The head of an orc or of a lizard is drawn green, and recolored from that.
  const headKind = race === 'orc' || race === 'half-orc' ? 'orc' : race === 'dragonborn' ? 'lizard' : 'human';
  const head: SpriteLayer =
    headKind === 'human'
      ? { id: `head-human-${gender}${age === 'elder' ? '-elder' : ''}`, z: 100, tint: skin }
      : {
          id: `head-${headKind}-${gender}`,
          z: 100,
          tint: { material: 'body', from: 'green', to: skinColor },
        };
  const pointed = race === 'elf' || race === 'half-elf' || race === 'gnome' || race === 'tiefling';

  return Array.from({ length: SPRITE_OPTIONS }, (_, option) => {
    const rng = seededRng(`sprite:${race}:${gender}:${seed}:${option}`);
    // Children are not dressed for war or for magic, whatever their sheet says.
    const outfit: Outfit = child && dress.outfit !== 'robe' ? 'tunic' : dress.outfit;
    const color = pick(child || !dress.colors ? CLOTH[wealth] : dress.colors, rng);
    const headgear: Headgear = child ? 'none' : pick(dress.headgear, rng);
    const style = pick(HAIR_STYLES[gender], rng);
    const trousers = pick(TROUSERS, rng);
    const boots = pick(BOOTS, rng);
    const caped = !child && rng() < dress.cape + (wealth === 'noble' ? 0.2 : 0);
    const cape = pick(CAPES, rng);

    const layers: SpriteLayer[] = [{ id: built('body'), z: 10, tint: skin }, head];
    if (pointed) layers.push({ id: 'ears-elven', z: 126, tint: skin });
    if (race === 'tiefling') {
      layers.push({ id: 'horns', z: 127, tint: { material: 'body', from: 'light', to: 'black' } });
    }
    if (bearded) layers.push({ id: beard, z: 110, tint: hair });
    // A hood or a helm covers the hair; a hat sits on it.
    if (race !== 'dragonborn' && headgear !== 'hood' && headgear !== 'helm') {
      if (style === 'ponytail') {
        layers.push(
          { id: 'hair-ponytail-bg', z: 9, tint: hair },
          { id: 'hair-ponytail-fg', z: 120, tint: hair },
        );
      } else layers.push({ id: `hair-${style}`, z: 120, tint: hair });
    }

    if (outfit === 'armor') {
      layers.push(
        { id: built('torso-plate'), z: 60, tint: metal(color) },
        { id: built('legs-plate'), z: 20, tint: metal(color) },
        { id: built('feet-plate'), z: 15, tint: metal(color) },
      );
    } else {
      layers.push({ id: built('feet-boots'), z: 25, tint: cloth(boots) });
      const hide = { material: 'cloth', from: 'leather', to: color } as const;
      if (outfit === 'robe') {
        layers.push(
          { id: built('torso-shirt'), z: 35, tint: cloth(color) },
          { id: built('legs-skirt'), z: 20, tint: cloth(color) },
        );
      } else {
        layers.push({ id: built('legs-pants'), z: 20, tint: cloth(outfit === 'fur' ? color : trousers) });
        if (outfit === 'tunic') layers.push({ id: built('torso-shirt'), z: 35, tint: cloth(color) });
        // Furs leave a man's chest bare; a woman wears a jerkin of the same hide.
        if (outfit === 'leather' || (outfit === 'fur' && gender === 'female')) {
          layers.push({ id: built('torso-leather'), z: 60, tint: hide });
        }
      }
    }
    if (caped)
      layers.push({ id: 'cape-bg', z: 5, tint: cloth(cape) }, { id: 'cape-fg', z: 85, tint: cloth(cape) });
    if (headgear === 'hood')
      layers.push({ id: 'hat-hood', z: 130, tint: cloth(outfit === 'armor' ? cape : color) });
    if (headgear === 'helm')
      layers.push({ id: 'hat-helm', z: 130, tint: metal(outfit === 'armor' ? color : 'iron') });
    // The pointed hat is not recolored: it comes ready in the colors a wizard's robe may have.
    if (headgear === 'hat') {
      layers.push({ id: `hat-wizard-${WIZARD_HATS.includes(color) ? color : 'blue'}`, z: 130 });
    }

    // What it fights with shows only while it does.
    layers.push(
      { id: 'sword-bg', z: 8, only: 'slash', large: true },
      { id: 'sword-fg', z: 150, only: 'slash', large: true },
      { id: 'bow-bg', z: -1, only: 'shoot' },
      { id: 'bow-fg', z: 140, only: 'shoot' },
      { id: 'arrow', z: 141, only: 'shoot' },
    );
    const covered = headgear === 'hood' || headgear === 'helm';
    const top: TopLook = {
      width:
        (gender === 'female' ? 0.92 : 1) *
        (race === 'orc' || race === 'dwarf' ? 1.16 : race === 'half-orc' ? 1.08 : 1),
      skin: skinColor,
      hair: hairColor,
      hairStyle:
        race === 'dragonborn' || covered
          ? 'none'
          : style === 'long' || style === 'bob'
            ? 'long'
            : style === 'ponytail'
              ? 'ponytail'
              : style === 'balding'
                ? 'balding'
                : style === 'shorthawk'
                  ? 'mohawk'
                  : 'short',
      beard: bearded,
      ears: pointed ? 'pointed' : 'round',
      horns: race === 'tiefling',
      tusks: headKind === 'orc',
      snout: race === 'dragonborn',
      outfit,
      color,
      boots: outfit === 'armor' ? color : boots,
      cape: caped ? cape : null,
      headgear,
      headgearColor:
        headgear === 'helm' ? (outfit === 'armor' ? color : 'iron') : outfit === 'armor' ? cape : color,
    };
    return {
      layers: layers.sort((a, b) => a.z - b.z),
      top,
      // A child is drawn as a small grown-up, though never smaller than can be made out.
      scale: Math.max(0.64, HEIGHT[race] * (child ? 0.8 : 1)),
    };
  });
}

/** The sheets of a look that are part of an animation, lowest first. */
export function layersFor(look: SpriteLook, animation: SpriteAnimation): SpriteLayer[] {
  return look.layers.filter((layer) => !layer.only || layer.only === animation);
}

/** Which frame of an animation is showing this many seconds into it. */
export function spriteFrameAt(animation: SpriteAnimation, seconds: number): number {
  return Math.floor(seconds * SPRITE_FPS[animation]) % SPRITE_FRAMES[animation];
}

/** Where a frame lies on the sheet that is saved: column and row, both counted from 0. */
export function sheetCell(animation: SpriteAnimation, facing: SpriteFacing, frame: number): [number, number] {
  return [
    frame,
    SPRITE_ANIMATIONS.indexOf(animation) * SPRITE_FACINGS.length + SPRITE_FACINGS.indexOf(facing),
  ];
}

/** The size of the sheet that is saved, in cells across and down. */
export const SHEET_COLUMNS = Math.max(...Object.values(SPRITE_FRAMES));
export const SHEET_ROWS = SPRITE_ANIMATIONS.length * SPRITE_FACINGS.length;

/**
 * The table a sheet is recolored by: every color of one ramp, as a number
 * 0xRRGGBB, against the color at the same place in another.
 */
export function recolorTable(tint: NonNullable<SpriteLayer['tint']>): Map<number, number> {
  const ramps = SPRITE_PALETTES[tint.material] as Record<string, readonly string[]>;
  const from = ramps[tint.from];
  const to = ramps[tint.to];
  if (!from || !to) throw new Error(`No ${tint.material} ramp "${!from ? tint.from : tint.to}"`);
  const number = (color: string) => parseInt(color.slice(1), 16);
  return new Map(from.map((color, index) => [number(color), number(to[index])]));
}

/**
 * The stance of the figure seen from above, in one frame. It keeps step with
 * the sheets: the same animations, with as many frames each.
 */
export interface TopPose {
  /** From -1 to 1: how far the left foot is ahead of the right. The arms swing against it. */
  stride: number;
  /** From 0 to 1, the lift of a breath. */
  breath: number;
  weapon: 'none' | 'sword' | 'bow';
  /** Where the sword arm points, in radians from straight ahead toward the right hand. */
  cut: number;
  /** Whether the blade is leaving its streak in the air. */
  streak: boolean;
  /** From 0 to 1: how far the bow arm is raised, and how far the string is drawn. */
  aim: number;
  draw: number;
  /** How far the arrow has flown from the bow; 0 is on the string, null is none. */
  arrow: number | null;
}

/** The sword arm through a cut: back over the shoulder, then round and across the front. */
const CUT = [0.2, 1.3, 1.95, 0.5, -0.5, -0.75] as const;

/** The stance of the figure seen from above in a frame of an animation. Frames past the last wrap round. */
export function topPose(animation: SpriteAnimation, frame: number): TopPose {
  const count = SPRITE_FRAMES[animation];
  const f = ((Math.floor(frame) % count) + count) % count;
  const rest: TopPose = {
    stride: 0,
    breath: 0,
    weapon: 'none',
    cut: 0,
    streak: false,
    aim: 0,
    draw: 0,
    arrow: null,
  };
  switch (animation) {
    case 'idle':
      return { ...rest, breath: f };
    case 'walk':
      return { ...rest, stride: Math.sin((f / count) * Math.PI * 2) };
    case 'slash':
      return {
        ...rest,
        stride: f >= 2 ? 0.35 : 0.1,
        weapon: 'sword',
        cut: CUT[f],
        streak: f === 3 || f === 4,
      };
    case 'shoot': {
      // Up with the bow, back with the string, a moment's hold, loose, and down again.
      const aim = Math.min(1, f / 3);
      const drawn = f < 3 ? 0 : f <= 7 ? Math.min(1, (f - 3) / 3) : 0;
      const loosed = f >= 8 && f <= 10;
      return {
        ...rest,
        stride: 0.25,
        weapon: 'bow',
        aim: f >= 11 ? (count - f) / 3 : aim,
        draw: drawn,
        arrow: f >= 3 && f <= 7 ? 0 : loosed ? (f - 7) * 9 : null,
      };
    }
  }
}
