import { seededRng, type Rng } from '../generator/rng.ts';
import type { NpcAge, NpcGender, NpcRace, NpcWealth } from './prompt.ts';
import type { ClassId } from './sheet-data.ts';

/**
 * The little figure that stands for an NPC on a map: how it looks, and how it
 * moves. Nothing here draws; `render/sprite.ts` does, from these numbers.
 */

/** How many looks are offered for one NPC to choose from. */
export const SPRITE_OPTIONS = 5;

export const SPRITE_ANIMATIONS = ['idle', 'run', 'sword', 'bow'] as const;
export type SpriteAnimation = (typeof SPRITE_ANIMATIONS)[number];

/** The way the figure faces, in the order of the rows of a sprite sheet. */
export const SPRITE_FACINGS = ['down', 'left', 'right', 'up'] as const;
export type SpriteFacing = (typeof SPRITE_FACINGS)[number];

export const SPRITE_FRAMES: Record<SpriteAnimation, number> = { idle: 4, run: 6, sword: 6, bow: 7 };
/** Frames per second each animation is meant to be played at. */
export const SPRITE_FPS: Record<SpriteAnimation, number> = { idle: 4, run: 11, sword: 11, bow: 8 };

export type HairStyle = 'short' | 'long' | 'bald' | 'ponytail' | 'bun' | 'mohawk';
export type Headgear = 'none' | 'hood' | 'hat' | 'helm' | 'cap' | 'circlet';
/** What the figure wears: a robe hides the legs, armor shines, fur leaves the arms bare. */
export type Outfit = 'tunic' | 'robe' | 'armor' | 'leather' | 'fur';

export interface SpriteLook {
  /** Height and breadth against an adult human, which is 1 and 1. */
  height: number;
  width: number;
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  beard: boolean;
  ears: 'round' | 'pointed';
  horns: boolean;
  tusks: boolean;
  /** A dragonborn's head: a snout, no hair, no ears. */
  snout: boolean;
  outfit: Outfit;
  top: string;
  trim: string;
  legs: string;
  boots: string;
  /** The color of the cape, for those who wear one. */
  cape: string | null;
  headgear: Headgear;
  headgearColor: string;
}

/**
 * The stance of the figure in one frame. Angles are in radians from the limb
 * hanging straight down, growing as it swings forward and up: half of pi is
 * level in front, pi is straight overhead.
 */
export interface SpritePose {
  /** How far the body is lifted off its resting height, in units of the frame. */
  bob: number;
  /** The leg and the arm nearer the viewer, and those behind them. */
  legFront: number;
  legBack: number;
  armFront: number;
  armBack: number;
  /** Forward lean of the body. */
  lean: number;
  weapon: 'none' | 'sword' | 'bow';
  /** From 0 to 1, how far the bowstring is drawn. */
  draw: number;
  /** How far the arrow has flown from the bow; 0 is nocked, null is none. */
  arrow: number | null;
  /** From 0 to 1 through the cut of the sword, for the streak it leaves; null outside it. */
  slash: number | null;
}

const pick = <T>(list: readonly T[], rng: Rng): T => list[Math.floor(rng() * list.length)];

const BODY: Record<NpcRace, { height: number; width: number }> = {
  human: { height: 1, width: 1 },
  elf: { height: 1.04, width: 0.92 },
  'half-elf': { height: 1.02, width: 0.96 },
  dwarf: { height: 0.8, width: 1.22 },
  halfling: { height: 0.74, width: 0.96 },
  gnome: { height: 0.7, width: 0.94 },
  'half-orc': { height: 1.06, width: 1.14 },
  orc: { height: 1.08, width: 1.22 },
  tiefling: { height: 1, width: 0.98 },
  dragonborn: { height: 1.08, width: 1.14 },
};

const SKIN: Record<NpcRace, readonly string[]> = {
  human: ['#f2c9a0', '#d9a676', '#a8704a', '#70482e'],
  elf: ['#f5dcc0', '#e6c8a0', '#c9a27a'],
  'half-elf': ['#f2c9a0', '#e6c8a0', '#b98a62'],
  dwarf: ['#e8b58c', '#c98e62', '#a8704a'],
  halfling: ['#f2c9a0', '#d9a676', '#b98a62'],
  gnome: ['#f0c8a0', '#d8b08a', '#c79a78'],
  'half-orc': ['#9aa67a', '#8a9a80', '#7f8f6a'],
  orc: ['#6f9a52', '#587f44', '#7a8f4a'],
  tiefling: ['#c0504a', '#8a4a8a', '#5a6a9a', '#a03a3a'],
  dragonborn: ['#a8483a', '#3f7a9a', '#4f8a4a', '#b08a3a', '#cfcfc6'],
};

const HAIR = ['#2a1e16', '#5a3a1e', '#8a5a2a', '#c9a24a', '#a8402a', '#1a1a1e'] as const;
const GREY = ['#bdbdbd', '#e6e6e0', '#9a9a9a'] as const;

const TUNIC: Record<NpcWealth, readonly string[]> = {
  peasant: ['#8a6f4a', '#7a7a5a', '#6a5a4a', '#9a8a6a', '#7a6a58'],
  burgher: ['#3f6f8a', '#8a3f3f', '#4f7a4f', '#7a5a8a', '#b08a3a'],
  noble: ['#6a2f7a', '#8c2f2f', '#2f4f8a', '#1f5a4a', '#7a1f4a'],
};

/** What each class wears: the garment, the colors it may come in, and what may go on the head. */
const DRESS: Record<
  ClassId,
  { outfit: Outfit; tops: readonly string[] | null; headgear: readonly Headgear[]; cape: number }
> = {
  commoner: { outfit: 'tunic', tops: null, headgear: ['none', 'none', 'cap', 'hood'], cape: 0.1 },
  barbarian: {
    outfit: 'fur',
    tops: ['#7a5a3a', '#6a4a2e', '#8a6a48'],
    headgear: ['none', 'none', 'helm'],
    cape: 0.2,
  },
  bard: {
    outfit: 'tunic',
    tops: ['#b0408a', '#3f8a8a', '#c9963f', '#5a4fb0'],
    headgear: ['cap', 'cap', 'none'],
    cape: 0.5,
  },
  cleric: {
    outfit: 'robe',
    tops: ['#e6e0d0', '#d8d0b8', '#c9c2a8'],
    headgear: ['none', 'hood', 'circlet'],
    cape: 0.2,
  },
  druid: {
    outfit: 'robe',
    tops: ['#5a7a3f', '#6a5a3a', '#4a6a4a'],
    headgear: ['hood', 'none', 'none'],
    cape: 0.3,
  },
  fighter: {
    outfit: 'armor',
    tops: ['#9aa4b0', '#8a8f98', '#a8a090'],
    headgear: ['helm', 'none', 'none'],
    cape: 0.3,
  },
  monk: { outfit: 'robe', tops: ['#c9762f', '#a85a2a', '#8a6a3a'], headgear: ['none'], cape: 0 },
  paladin: {
    outfit: 'armor',
    tops: ['#c9c2a0', '#b9b6ae', '#d8cfa8'],
    headgear: ['helm', 'none', 'circlet'],
    cape: 0.8,
  },
  ranger: {
    outfit: 'leather',
    tops: ['#4a6a3a', '#5a5a34', '#3f5a44'],
    headgear: ['hood', 'hood', 'none'],
    cape: 0.7,
  },
  rogue: {
    outfit: 'leather',
    tops: ['#3a3a44', '#4a3a3a', '#2f3a3a'],
    headgear: ['hood', 'hood', 'none'],
    cape: 0.5,
  },
  sorcerer: {
    outfit: 'robe',
    tops: ['#a83a2f', '#c0562f', '#8a2f4a'],
    headgear: ['none', 'circlet', 'hood'],
    cape: 0.3,
  },
  warlock: {
    outfit: 'robe',
    tops: ['#3a2a4a', '#2a2a34', '#4a2f5a'],
    headgear: ['hood', 'none', 'hood'],
    cape: 0.4,
  },
  wizard: {
    outfit: 'robe',
    tops: ['#2f4f8a', '#4a3f8a', '#2f6a7a'],
    headgear: ['hat', 'hat', 'none'],
    cape: 0.2,
  },
};

const CAPES = ['#8c2f2f', '#2f4f8a', '#3f5a3a', '#4a3a5a', '#3a3530', '#7a5a2a'] as const;

/** What is known of the NPC that shows on its figure. */
export interface SpriteSubject {
  race: NpcRace;
  gender: NpcGender;
  age: NpcAge;
  wealth: NpcWealth;
  classId: ClassId;
}

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
  const body = BODY[race];
  const child = age === 'child';
  const skin = pick(SKIN[race], who);
  const hair = age === 'elder' ? pick(GREY, who) : pick(HAIR, who);
  const dress = DRESS[classId];
  const rich = wealth === 'noble';
  const whiskers = who() < 0.3;
  // Scales grow no beard; every grown dwarf has one.
  const bearded = !child && gender === 'male' && race !== 'dragonborn' && (race === 'dwarf' || whiskers);

  return Array.from({ length: SPRITE_OPTIONS }, (_, option) => {
    const rng = seededRng(`sprite:${race}:${gender}:${seed}:${option}`);
    const styles: readonly HairStyle[] =
      gender === 'male'
        ? ['short', 'short', 'ponytail', 'bald', 'mohawk', 'long']
        : ['long', 'long', 'ponytail', 'bun', 'short'];
    const top = pick(dress.tops ?? TUNIC[wealth], rng);
    // Children are not dressed for war or for magic, whatever their sheet says.
    const outfit: Outfit = child && dress.outfit !== 'robe' ? 'tunic' : dress.outfit;
    const headgear = child ? pick(['none', 'none', 'cap'] as const, rng) : pick(dress.headgear, rng);
    return {
      height: body.height * (child ? 0.74 : 1),
      width: body.width * (child ? 0.9 : gender === 'female' ? 0.94 : 1),
      skin,
      hair,
      hairStyle: race === 'dragonborn' ? 'bald' : pick(styles, rng),
      beard: bearded,
      ears:
        race === 'elf' || race === 'half-elf' || race === 'gnome' || race === 'tiefling'
          ? 'pointed'
          : 'round',
      horns: race === 'tiefling',
      tusks: race === 'orc' || race === 'half-orc',
      snout: race === 'dragonborn',
      outfit,
      top: child && dress.tops ? pick(TUNIC[wealth], rng) : top,
      trim: rich ? '#d2ad5c' : pick(['#e6dcc0', '#3a3028', '#c9b88a', '#5a4a3a'], rng),
      legs: pick(['#4a3f34', '#5a5248', '#3a3a44', '#6a5a44'], rng),
      boots: pick(['#3a2a1c', '#4a3a2a', '#2a2420'], rng),
      cape: !child && rng() < dress.cape + (rich ? 0.2 : 0) ? pick(CAPES, rng) : null,
      headgear,
      headgearColor:
        headgear === 'helm'
          ? '#a9b0ba'
          : headgear === 'circlet'
            ? '#d2ad5c'
            : headgear === 'hat'
              ? top
              : pick(CAPES, rng),
    };
  });
}

const REST: SpritePose = {
  bob: 0,
  legFront: 0,
  legBack: 0,
  armFront: 0.06,
  armBack: -0.06,
  lean: 0,
  weapon: 'none',
  draw: 0,
  arrow: null,
  slash: null,
};

/** The arm coming over and down through a cut, frame by frame. */
const CUT = [0.9, 2.3, 3.0, 1.5, 0.5, 0.25] as const;
const CUT_LEAN = [0, -0.1, -0.16, 0.2, 0.16, 0.04] as const;
/** The bow arm coming up, and the string being drawn and let go. */
const AIM = [0.4, 1.15, 1.57, 1.57, 1.57, 1.57, 0.9] as const;
const DRAWN = [0, 0, 0.45, 1, 1, 0, 0] as const;
const FLIGHT = [null, null, 0, 0, 0, 9, 24] as const;

/** The stance of the figure in a frame of an animation. Frames past the last wrap round. */
export function spritePose(animation: SpriteAnimation, frame: number): SpritePose {
  const count = SPRITE_FRAMES[animation];
  const f = ((Math.floor(frame) % count) + count) % count;
  switch (animation) {
    case 'idle':
      // Breathing.
      return { ...REST, bob: [0, 0.5, 1, 0.5][f] };
    case 'run': {
      const phase = (f / count) * Math.PI * 2;
      const swing = Math.sin(phase);
      return {
        ...REST,
        // Highest between two steps.
        bob: 1.6 * Math.abs(Math.cos(phase)),
        legFront: 0.85 * swing,
        legBack: -0.85 * swing,
        armFront: -0.95 * swing,
        armBack: 0.95 * swing,
        lean: 0.12,
      };
    }
    case 'sword':
      return {
        ...REST,
        legFront: f >= 2 ? 0.35 : 0.1,
        legBack: f >= 2 ? -0.35 : -0.1,
        armFront: CUT[f],
        armBack: -0.4,
        lean: CUT_LEAN[f],
        weapon: 'sword',
        slash: f === 3 ? 0.5 : f === 4 ? 1 : null,
      };
    case 'bow':
      return {
        ...REST,
        legFront: 0.25,
        legBack: -0.25,
        armFront: AIM[f],
        armBack: 0.3,
        weapon: 'bow',
        draw: DRAWN[f],
        arrow: FLIGHT[f],
      };
  }
}

/** Which frame of an animation is showing this many seconds into it. */
export function spriteFrameAt(animation: SpriteAnimation, seconds: number): number {
  return Math.floor(seconds * SPRITE_FPS[animation]) % SPRITE_FRAMES[animation];
}

/** Where a frame lies on a sprite sheet: column and row, both counted from 0. */
export function sheetCell(animation: SpriteAnimation, facing: SpriteFacing, frame: number): [number, number] {
  return [
    frame,
    SPRITE_ANIMATIONS.indexOf(animation) * SPRITE_FACINGS.length + SPRITE_FACINGS.indexOf(facing),
  ];
}

/** The size of a sprite sheet, in frames across and down. */
export const SHEET_COLUMNS = Math.max(...Object.values(SPRITE_FRAMES));
export const SHEET_ROWS = SPRITE_ANIMATIONS.length * SPRITE_FACINGS.length;
