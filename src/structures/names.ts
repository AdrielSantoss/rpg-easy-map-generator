import type { Rng } from '../generator/rng.ts';
import type { StructureKind } from './model.ts';

// prettier-ignore
const NAME_START = [
  'Val', 'Dor', 'Kar', 'El', 'Mor', 'Thal', 'Bran', 'Ald', 'Gar', 'Lun',
  'Syl', 'Tor', 'Ven', 'Hal', 'Is', 'Ner', 'Fal', 'Rav', 'Cor', 'Ar',
];
const NAME_MIDDLE = ['a', 'e', 'i', 'o', 'an', 'en', 'or', 'ar', 'il', 'un', '', ''];
// prettier-ignore
const NAME_END = [
  'dor', 'ria', 'mar', 'heim', 'gard', 'wyn', 'thas', 'ron', 'lia', 'vale',
  'burgo', 'mir', 'nor', 'dil', 'ton',
];
const DUNGEON_WORDS = ['Covil', 'Cripta', 'Gruta', 'Abismo'];

const pick = <T>(list: readonly T[], rng: Rng): T => list[Math.floor(rng() * list.length)];

/** An invented proper name, such as "Valdoria" or "Morheim". */
export function fantasyName(rng: Rng = Math.random): string {
  return pick(NAME_START, rng) + pick(NAME_MIDDLE, rng) + pick(NAME_END, rng);
}

/** Suggests a fantasy name fitting the kind of place. */
export function suggestName(kind: StructureKind, rng: Rng = Math.random): string {
  const name = fantasyName(rng);
  switch (kind) {
    case 'kingdom':
      return `Reino de ${name}`;
    case 'tower':
      return `Torre de ${name}`;
    case 'port':
      return `Porto ${name}`;
    case 'ruins':
      return `Ruínas de ${name}`;
    case 'dungeon':
      return `${pick(DUNGEON_WORDS, rng)} de ${name}`;
    default:
      return name;
  }
}
