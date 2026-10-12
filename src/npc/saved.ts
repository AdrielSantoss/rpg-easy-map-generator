import {
  NPC_AGES,
  NPC_EXPRESSIONS,
  NPC_GENDERS,
  NPC_RACES,
  NPC_WEALTHS,
  type NpcGender,
  type NpcOptions,
  type NpcRace,
} from './prompt.ts';
import { ABILITIES, CLASSES, SKILLS, type Ability, type ClassId, type Skill } from './sheet-data.ts';
import { ATTACK_ROWS, MAX_LEVEL, type CharacterSheet } from './sheet.ts';

/**
 * An NPC as it is kept: the portrait, what it was asked for, and the sheet with
 * whatever was typed on it. This is what goes into the browser's storage and
 * into the file the user saves and opens again.
 */
export interface SavedNpc {
  id: string;
  /** When it was generated, in ms since 1970; the list shows the newest first. */
  created: number;
  /** The portrait, as a data URL. */
  image: string;
  summary: string;
  /** The name its downloads go by, without extension. */
  file: string;
  race: NpcRace;
  gender: NpcGender;
  seed: number;
  options: NpcOptions;
  /** How many times the sheet was rolled again. */
  roll: number;
  sheet: CharacterSheet;
}

const APP = 'rpg-easy-map-generator';
const VERSION = 1;
/** Longest portrait accepted, in characters of data URL: far more than the model ever paints. */
const MAX_IMAGE = 6_000_000;
const MAX_TEXT = 4000;

export function serializeNpc(npc: SavedNpc): string {
  return JSON.stringify({ app: APP, kind: 'npc', version: VERSION, ...npc });
}

type Bag = Record<string, unknown>;
const isBag = (value: unknown): value is Bag => typeof value === 'object' && value !== null;

const text = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value.slice(0, MAX_TEXT) : fallback;

const whole = (value: unknown, low: number, high: number, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(high, Math.max(low, Math.round(value)))
    : fallback;

const listed = <T extends string>(list: readonly T[], value: unknown): T | undefined =>
  list.find((entry) => entry === value);

const subset = <T extends string>(list: readonly T[], value: unknown): T[] =>
  Array.isArray(value) ? list.filter((entry) => value.includes(entry)) : [];

/** A sheet with every field present and of the right kind, whatever came in. */
function readSheet(raw: unknown): CharacterSheet {
  const sheet = isBag(raw) ? raw : {};
  const abilities = isBag(sheet.abilities) ? sheet.abilities : {};
  const coins = isBag(sheet.coins) ? sheet.coins : {};
  const attacks = Array.isArray(sheet.attacks) ? sheet.attacks : [];
  const coin = (value: unknown) => whole(value, 0, 9_999_999, 0);
  const level = whole(sheet.level, 1, MAX_LEVEL, 1);
  return {
    name: text(sheet.name),
    classId: listed<ClassId>(CLASSES, sheet.classId) ?? 'commoner',
    className: text(sheet.className),
    level,
    background: text(sheet.background),
    playerName: text(sheet.playerName),
    race: text(sheet.race),
    alignment: text(sheet.alignment),
    xp: whole(sheet.xp, 0, 9_999_999, 0),
    abilities: Object.fromEntries(
      ABILITIES.map((ability) => [ability, whole(abilities[ability], 1, 30, 10)]),
    ) as Record<Ability, number>,
    inspiration: text(sheet.inspiration),
    proficiencyBonus: whole(sheet.proficiencyBonus, 0, 20, 2),
    saves: subset<Ability>(ABILITIES, sheet.saves),
    skills: subset<Skill>(
      SKILLS.map((skill) => skill.id),
      sheet.skills,
    ),
    armorClass: whole(sheet.armorClass, 0, 99, 10),
    initiative: whole(sheet.initiative, -20, 99, 0),
    speed: text(sheet.speed),
    hpMax: whole(sheet.hpMax, 0, 9999, 1),
    hpCurrent: whole(sheet.hpCurrent, -9999, 9999, 1),
    hpTemp: whole(sheet.hpTemp, 0, 9999, 0),
    hitDice: text(sheet.hitDice),
    attacks: Array.from({ length: ATTACK_ROWS }, (_, row) => {
      const attack = isBag(attacks[row]) ? (attacks[row] as Bag) : {};
      return { name: text(attack.name), bonus: text(attack.bonus), damage: text(attack.damage) };
    }),
    spells: text(sheet.spells),
    equipment: text(sheet.equipment),
    coins: {
      cp: coin(coins.cp),
      sp: coin(coins.sp),
      ep: coin(coins.ep),
      gp: coin(coins.gp),
      pp: coin(coins.pp),
    },
    proficiencies: text(sheet.proficiencies),
    traits: text(sheet.traits),
    ideals: text(sheet.ideals),
    bonds: text(sheet.bonds),
    flaws: text(sheet.flaws),
    features: text(sheet.features),
  };
}

/**
 * Checks something read from storage or from a file and returns the NPC in it,
 * or null when it is not one. A file can come from anywhere, so nothing in it
 * is trusted: the portrait must be a picture and nothing else, and every field
 * of the sheet is brought back to its kind and range.
 */
export function readNpc(raw: unknown): SavedNpc | null {
  if (!isBag(raw)) return null;
  const race = listed(NPC_RACES, raw.race);
  const gender = listed(NPC_GENDERS, raw.gender);
  const image = raw.image;
  if (!race || !gender) return null;
  if (typeof image !== 'string' || image.length > MAX_IMAGE) return null;
  if (!/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/]+=*$/.test(image)) return null;
  const options = isBag(raw.options) ? raw.options : {};
  const seed = whole(raw.seed, 0, 0xffffffff, 0);
  return {
    id: text(raw.id).slice(0, 80) || `${seed}`,
    created: whole(raw.created, 0, Number.MAX_SAFE_INTEGER, 0),
    image,
    summary: text(raw.summary),
    // Only what is safe in a file name.
    file:
      text(raw.file)
        .replace(/[^\w-]/g, '')
        .slice(0, 80) || `npc-${race}-${gender}-${seed}`,
    race,
    gender,
    seed,
    options: {
      age: listed(NPC_AGES, options.age),
      expression: listed(NPC_EXPRESSIONS, options.expression),
      wealth: listed(NPC_WEALTHS, options.wealth),
    },
    roll: whole(raw.roll, 0, 1_000_000, 0),
    sheet: readSheet(raw.sheet),
  };
}

/** Reads the text of a saved NPC file. Null when it is not one. */
export function parseNpc(content: string): SavedNpc | null {
  try {
    const raw: unknown = JSON.parse(content);
    if (!isBag(raw) || raw.app !== APP || raw.kind !== 'npc') return null;
    return readNpc(raw);
  } catch {
    return null;
  }
}

/**
 * Puts an NPC at the head of the list, replacing one of the same id, and keeps
 * the list to `limit`. Returns the new list and those that fell off its end.
 */
export function rememberNpc(
  list: readonly SavedNpc[],
  npc: SavedNpc,
  limit: number,
): { list: SavedNpc[]; dropped: SavedNpc[] } {
  const next = [npc, ...list.filter((other) => other.id !== npc.id)];
  return { list: next.slice(0, limit), dropped: next.slice(limit) };
}
