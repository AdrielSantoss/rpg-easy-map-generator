import { seededRng, type Rng } from '../generator/rng.ts';

export const NPC_RACES = [
  'human',
  'elf',
  'half-elf',
  'dwarf',
  'halfling',
  'gnome',
  'half-orc',
  'orc',
  'tiefling',
  'dragonborn',
] as const;
export type NpcRace = (typeof NPC_RACES)[number];

export const NPC_GENDERS = ['male', 'female'] as const;
export type NpcGender = (typeof NPC_GENDERS)[number];

/** What the picture should show, and a short line in Portuguese saying who this NPC is. */
export interface NpcDescription {
  /** The text given to the image model. Built only from the lists in this file, never from user text. */
  prompt: string;
  summary: string;
}

/** A trait: how to say it to the image model, and in Portuguese for a man and for a woman. */
type Trait = readonly [english: string, masculine: string, feminine: string];

const pick = <T>(list: readonly T[], rng: Rng): T => list[Math.floor(rng() * list.length)];

const RACE_NAME: Record<NpcRace, readonly [masculine: string, feminine: string]> = {
  human: ['Humano', 'Humana'],
  elf: ['Elfo', 'Elfa'],
  'half-elf': ['Meio-elfo', 'Meio-elfa'],
  dwarf: ['Anão', 'Anã'],
  halfling: ['Halfling', 'Halfling'],
  gnome: ['Gnomo', 'Gnoma'],
  'half-orc': ['Meio-orc', 'Meio-orc'],
  orc: ['Orc', 'Orc'],
  tiefling: ['Tiefling', 'Tiefling'],
  dragonborn: ['Draconato', 'Draconata'],
};

/** How each race looks, in the words given to the image model. */
function raceLook(race: NpcRace, gender: NpcGender, rng: Rng): string {
  switch (race) {
    case 'human':
      return 'human';
    case 'elf':
      return 'elf with long pointed ears, slender angular features and an ageless face';
    case 'half-elf':
      return 'half-elf with slightly pointed ears and soft human features';
    case 'dwarf':
      return gender === 'male'
        ? 'dwarf with a broad weathered face, a large nose and a long thick braided beard'
        : 'dwarf woman with a broad strong face, a large nose and thick braided hair';
    case 'halfling':
      return 'halfling with a small round friendly face, curly hair and rosy cheeks';
    case 'gnome':
      return 'gnome with a small face, a prominent nose, large bright eyes and wild hair';
    case 'half-orc':
      return 'half-orc with grey-green skin, a heavy jaw and small lower tusks';
    case 'orc':
      return 'orc with green skin, a heavy brow, a flat nose and large lower tusks';
    case 'tiefling': {
      const skin = pick(['deep red', 'purple', 'blue-grey', 'dusky crimson'], rng);
      const eyes = pick(['gold', 'silver', 'red', 'white'], rng);
      return `tiefling with curved horns, ${skin} skin and solid ${eyes} eyes without pupils`;
    }
    case 'dragonborn': {
      const scales = pick(['red', 'blue', 'green', 'bronze', 'white', 'black', 'copper'], rng);
      return `dragonborn with a draconic reptilian head covered in ${scales} scales, a long snout, small horns and no hair`;
    }
  }
}

const AGES: readonly Trait[] = [
  ['young adult', 'jovem', 'jovem'],
  ['adult', 'adulto', 'adulta'],
  ['middle-aged', 'de meia-idade', 'de meia-idade'],
  ['old, deeply wrinkled', 'idoso', 'idosa'],
];

const HAIR = [
  'short black hair',
  'long black hair',
  'cropped brown hair',
  'long wavy brown hair',
  'messy red hair',
  'braided blond hair',
  'shoulder-length auburn hair',
  'a shaved head',
  'grey hair tied back',
  'curly dark hair',
] as const;

/** Hair for the old. */
const GREY_HAIR = [
  'grey hair tied back',
  'thin white hair',
  'a balding head with wisps of white hair',
] as const;

const ROLES: readonly Trait[] = [
  ['an innkeeper wearing a stained apron', 'taverneiro', 'taverneira'],
  ['a city guard in a steel helmet and mail', 'guarda', 'guarda'],
  ['a travelling merchant in fine clothes', 'mercador', 'mercadora'],
  ['a blacksmith in a soot-stained leather apron', 'ferreiro', 'ferreira'],
  ['a noble in embroidered velvet', 'nobre', 'nobre'],
  ['a priest in simple robes with a holy symbol', 'sacerdote', 'sacerdotisa'],
  ['a farmer in rough linen', 'fazendeiro', 'fazendeira'],
  ['a rogue in a dark hood', 'ladino', 'ladina'],
  ['a sailor in a weathered coat', 'marinheiro', 'marinheira'],
  ['a hunter in a fur-lined cloak', 'caçador', 'caçadora'],
  ['a scholar with small spectacles', 'estudioso', 'estudiosa'],
  ['a wizard in a robe with arcane embroidery', 'mago', 'maga'],
  ['a bard in a feathered cap', 'bardo', 'barda'],
  ['a mercenary in scarred leather armor', 'mercenário', 'mercenária'],
  ['a beggar in ragged clothes', 'mendigo', 'mendiga'],
  ['a healer carrying a pouch of herbs', 'curandeiro', 'curandeira'],
];

const EXPRESSIONS: readonly Trait[] = [
  ['a stern', 'severo', 'severa'],
  ['a warm, friendly', 'simpático', 'simpática'],
  ['a suspicious', 'desconfiado', 'desconfiada'],
  ['a weary', 'cansado', 'cansada'],
  ['a proud', 'orgulhoso', 'orgulhosa'],
  ['an amused, smirking', 'debochado', 'debochada'],
  ['a calm', 'sereno', 'serena'],
  ['a scowling', 'carrancudo', 'carrancuda'],
];

const MARKS: readonly Trait[] = [
  ['a scar across the cheek', 'com uma cicatriz no rosto', 'com uma cicatriz no rosto'],
  ['an eyepatch', 'de tapa-olho', 'de tapa-olho'],
  ['freckles', 'com sardas', 'com sardas'],
  ['a tattoo on the face', 'com uma tatuagem no rosto', 'com uma tatuagem no rosto'],
  ['a crooked, broken nose', 'de nariz quebrado', 'de nariz quebrado'],
  ['a gold earring', 'de brinco de ouro', 'de brinco de ouro'],
];

/**
 * Describes one NPC of the given race and gender. The seed picks everything
 * else (age, hair, trade, mood, a distinguishing mark), so the same three
 * values always describe the same person.
 */
export function describeNpc(race: NpcRace, gender: NpcGender, seed: number): NpcDescription {
  const rng = seededRng(`npc:${race}:${gender}:${seed}`);
  const form = gender === 'male' ? 1 : 2;
  const look = raceLook(race, gender, rng);
  const age = pick(AGES, rng);
  const hair = pick(age[1] === 'idoso' ? GREY_HAIR : HAIR, rng);
  const role = pick(ROLES, rng);
  const expression = pick(EXPRESSIONS, rng);
  const mark = rng() < 0.4 ? pick(MARKS, rng) : null;

  const person = `${age[0]} ${gender} ${look}`;
  // Scales instead of hair; everyone else gets a hairstyle.
  const details = [race === 'dragonborn' ? null : hair, mark?.[0]].filter(Boolean).join(', ');
  const prompt =
    `Portrait of ${role[0]}: a ${person}${details ? `, with ${details}` : ''}, ${expression[0]} expression. ` +
    'Head and shoulders, facing the viewer, centered in the frame. ' +
    'Realistic digital oil painting, fantasy RPG character art, detailed skin texture, ' +
    'soft dramatic lighting, dark plain background. No text, no frame, no border.';

  const name = RACE_NAME[race][gender === 'male' ? 0 : 1];
  const summary = [`${name}, ${role[form]}`, age[form], expression[form], mark?.[form]]
    .filter(Boolean)
    .join(', ');
  return { prompt, summary };
}
