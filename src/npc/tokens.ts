import { seededRng } from '../generator/rng.ts';
import { NPC_GENDERS, NPC_RACES, type NpcGender, type NpcRace } from './prompt.ts';
import { CLASSES, type ClassId } from './sheet-data.ts';

/**
 * A collection of illustrated figures, drawn by an artist one by one, that can
 * stand for an NPC where a sprite put together from parts cannot match the
 * art. They are still pictures: each is offered to the NPCs it suits.
 */

/** One figure of the collection, and whom it suits. */
export interface TokenArt {
  /** The picture, relative to the folder of the collection. */
  file: string;
  /** What the artist called it. */
  name: string;
  /** 'any' for a figure whose face or build does not say. */
  gender: NpcGender | 'any';
  /** The classes it could be, the likeliest first. */
  classes: ClassId[];
  /** The races it could be; none listed means it could be any of the human-looking ones. */
  races: NpcRace[];
}

export interface TokenCatalog {
  /** Who made the pictures, and where their work is shown. */
  author: string;
  source: string;
  tokens: TokenArt[];
}

/** Races no figure can stand for unless it says so: they do not look human. */
const DISTINCT: readonly NpcRace[] = ['orc', 'half-orc', 'dragonborn', 'tiefling'];

/**
 * Reads a catalog that came from a file, keeping only what is well formed: a
 * picture's path may not leave the folder, and classes and races must be ones
 * the generator knows. Null when it is not a catalog at all.
 */
export function readCatalog(raw: unknown): TokenCatalog | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { author, source, tokens } = raw as Record<string, unknown>;
  if (!Array.isArray(tokens)) return null;
  const text = (value: unknown) => (typeof value === 'string' ? value.slice(0, 200) : '');
  const kept: TokenArt[] = [];
  for (const entry of tokens) {
    if (typeof entry !== 'object' || entry === null) continue;
    const token = entry as Record<string, unknown>;
    const file = text(token.file);
    // A plain file name of a picture, with nothing that could point elsewhere.
    if (!/^[\w-]+\.(png|webp|jpg)$/i.test(file)) continue;
    const list = <T extends string>(known: readonly T[], value: unknown): T[] =>
      Array.isArray(value) ? known.filter((item) => value.includes(item)) : [];
    kept.push({
      file,
      name: text(token.name),
      gender: NPC_GENDERS.find((gender) => gender === token.gender) ?? 'any',
      classes: Array.isArray(token.classes)
        ? (token.classes.filter((c) => CLASSES.includes(c as ClassId)) as ClassId[])
        : [],
      races: list(NPC_RACES, token.races),
    });
  }
  // Only a link to a web page is kept as the source.
  const link = text(source);
  return { author: text(author), source: /^https:\/\/[^\s"'<>]+$/.test(link) ? link : '', tokens: kept };
}

/** How well a figure suits an NPC: the higher the better, 0 for one that does not suit at all. */
export function suits(token: TokenArt, race: NpcRace, gender: NpcGender, classId: ClassId): number {
  // A figure of another gender, or one that cannot pass for the race, is not offered.
  if (token.gender !== 'any' && token.gender !== gender) return 0;
  const raceFits = token.races.length === 0 ? !DISTINCT.includes(race) : token.races.includes(race);
  if (!raceFits) return 0;
  const rank = token.classes.indexOf(classId);
  // The class it was most clearly drawn as counts most; a race it names, more than one it merely allows.
  const byClass = rank < 0 ? 0 : 6 - Math.min(rank, 3);
  return 1 + byClass + (token.races.includes(race) ? 2 : 0) + (token.gender === gender ? 1 : 0);
}

/**
 * The figures offered for an NPC, best suited first, at most `count`. Among
 * equals the seed decides, so that the same NPC is always offered the same
 * ones. Fewer come back, or none, when the collection has nothing suitable.
 */
export function matchTokens(
  catalog: TokenCatalog,
  subject: { race: NpcRace; gender: NpcGender; classId: ClassId },
  seed: number,
  count: number,
): TokenArt[] {
  const rng = seededRng(`tokens:${subject.race}:${subject.gender}:${subject.classId}:${seed}`);
  return catalog.tokens
    .map((token) => ({
      token,
      score: suits(token, subject.race, subject.gender, subject.classId),
      tie: rng(),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.tie - b.tie)
    .slice(0, count)
    .map((entry) => entry.token);
}
