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

export const NPC_AGES = ['child', 'adult', 'elder'] as const;
export type NpcAge = (typeof NPC_AGES)[number];

export const NPC_EXPRESSIONS = ['neutral', 'happy', 'angry', 'sad', 'evil', 'focused'] as const;
export type NpcExpression = (typeof NPC_EXPRESSIONS)[number];

/**
 * Station in life, which decides clothes, ornaments and trade: a peasant in
 * patched homespun, a burgher (townsfolk with a trade) in good plain clothes,
 * a noble in velvet and gold.
 */
export const NPC_WEALTHS = ['peasant', 'burgher', 'noble'] as const;
export type NpcWealth = (typeof NPC_WEALTHS)[number];

/** The traits the user may fix. Any left out is chosen by the seed. */
export interface NpcOptions {
  age?: NpcAge;
  expression?: NpcExpression;
  wealth?: NpcWealth;
}

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
function raceLook(race: NpcRace, gender: NpcGender, age: NpcAge, rng: Rng): string {
  switch (race) {
    case 'human':
      return 'human';
    case 'elf':
      return age === 'elder'
        ? 'elf with long pointed ears and slender angular features'
        : 'elf with long pointed ears, slender angular features and an ageless face';
    case 'half-elf':
      return 'half-elf with slightly pointed ears and soft human features';
    case 'dwarf':
      // Dwarf children have no beards yet.
      if (age === 'child') return 'dwarf with a broad round face and a large nose';
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

/** The stages of adult life, when the user only asked for "an adult". */
const ADULT_AGES: readonly Trait[] = [
  ['young adult', 'jovem', 'jovem'],
  ['adult', 'adulto', 'adulta'],
  ['middle-aged', 'de meia-idade', 'de meia-idade'],
];
const ELDER: Trait = ['old, deeply wrinkled', 'idoso', 'idosa'];

const HAIR = [
  'short black hair',
  'long black hair',
  'cropped brown hair',
  'long wavy brown hair',
  'messy red hair',
  'braided blond hair',
  'shoulder-length auburn hair',
  'a shaved head',
  'curly dark hair',
] as const;
/** Hair for the old. */
const GREY_HAIR = [
  'grey hair tied back',
  'thin white hair',
  'a balding head with wisps of white hair',
] as const;
/** Hair for children: none shaved. */
const CHILD_HAIR = [
  'short messy brown hair',
  'tousled black hair',
  'braided blond hair',
  'curly red hair',
] as const;

const EXPRESSION: Record<NpcExpression, Trait> = {
  neutral: ['a calm, neutral', 'sereno', 'serena'],
  happy: ['a happy, warmly smiling', 'feliz', 'feliz'],
  angry: ['an angry, furious, scowling', 'bravo', 'brava'],
  sad: ['a sad, sorrowful, downcast', 'triste', 'triste'],
  evil: ['a sinister, cruel, malevolent', 'maligno', 'maligna'],
  focused: ['a focused, intent, concentrated', 'concentrado', 'concentrada'],
};

/** What each station in life wears, and the Portuguese for a child of it. */
const WEALTH: Record<NpcWealth, { clothes: string; child: string; childLook: string }> = {
  peasant: {
    clothes: 'wearing worn, patched, dirty rough-spun clothes, no jewelry',
    child: 'criança camponesa',
    childLook: 'a peasant child',
  },
  burgher: {
    clothes: 'wearing clean, well-made, practical clothes of good cloth',
    child: 'criança burguesa',
    childLook: 'a town child',
  },
  noble: {
    clothes: 'wearing luxurious clothes of velvet and silk with fine embroidery, fur trim and gold jewelry',
    child: 'criança nobre',
    childLook: 'a noble child',
  },
};

/** The trades of each station in life. */
const ROLES: Record<NpcWealth, readonly Trait[]> = {
  peasant: [
    ['a farmer', 'fazendeiro', 'fazendeira'],
    ['a beggar', 'mendigo', 'mendiga'],
    ['a hunter in a patched fur cloak', 'caçador', 'caçadora'],
    ['a fisher in a weathered coat', 'pescador', 'pescadora'],
    ['a woodcutter', 'lenhador', 'lenhadora'],
    ['a shepherd with a crook', 'pastor', 'pastora'],
    ['a stable hand', 'cavalariço', 'cavalariça'],
    ['a street thief in a ragged hood', 'gatuno', 'gatuna'],
  ],
  burgher: [
    ['an innkeeper wearing an apron', 'taverneiro', 'taverneira'],
    ['a city guard in a steel helmet and mail', 'guarda', 'guarda'],
    ['a travelling merchant', 'mercador', 'mercadora'],
    ['a blacksmith in a leather apron', 'ferreiro', 'ferreira'],
    ['a priest in simple robes with a holy symbol', 'sacerdote', 'sacerdotisa'],
    ['a scholar with small spectacles', 'estudioso', 'estudiosa'],
    ['a healer carrying a pouch of herbs', 'curandeiro', 'curandeira'],
    ['a bard in a feathered cap', 'bardo', 'barda'],
    ['a mercenary in leather armor', 'mercenário', 'mercenária'],
    ['a wizard in a robe with arcane embroidery', 'mago', 'maga'],
    ['a sailor', 'marinheiro', 'marinheira'],
  ],
  noble: [
    ['a noble', 'nobre', 'nobre'],
    ['a court advisor in a fur-trimmed robe', 'conselheiro', 'conselheira'],
    ['a knight in polished, engraved plate armor', 'cavaleiro', 'cavaleira'],
    ['a high priest in gilded vestments', 'sumo sacerdote', 'suma sacerdotisa'],
    ['a court wizard in a jeweled robe', 'mago da corte', 'maga da corte'],
    ['a wealthy guildmaster wearing a gold chain of office', 'mestre de guilda', 'mestra de guilda'],
  ],
};

const MARKS: readonly Trait[] = [
  ['a scar across the cheek', 'com uma cicatriz no rosto', 'com uma cicatriz no rosto'],
  ['an eyepatch', 'de tapa-olho', 'de tapa-olho'],
  ['freckles', 'com sardas', 'com sardas'],
  ['a tattoo on the face', 'com uma tatuagem no rosto', 'com uma tatuagem no rosto'],
  ['a crooked, broken nose', 'de nariz quebrado', 'de nariz quebrado'],
  ['a gold earring', 'de brinco de ouro', 'de brinco de ouro'],
];
/** The only mark a child gets. */
const FRECKLES = MARKS[2];

/**
 * Describes one NPC of the given race and gender. Age, expression and wealth
 * can be fixed in `options`; whatever is left out, and everything else (hair,
 * trade, a distinguishing mark), is picked by the seed. The same arguments
 * always describe the same person.
 */
export function describeNpc(
  race: NpcRace,
  gender: NpcGender,
  seed: number,
  options: NpcOptions = {},
): NpcDescription {
  const rng = seededRng(`npc:${race}:${gender}:${seed}`);
  const form = gender === 'male' ? 1 : 2;
  // Drawn in a fixed order whether or not they end up used, so fixing one trait
  // leaves the others the seed would have picked.
  const randomAge = pick(['adult', 'adult', 'adult', 'elder', 'child'] as const, rng);
  const randomExpression = pick(NPC_EXPRESSIONS, rng);
  const randomWealth = pick(['peasant', 'burgher', 'burgher', 'noble'] as const, rng);
  const age = options.age ?? randomAge;
  const expression = EXPRESSION[options.expression ?? randomExpression];
  const wealth = options.wealth ?? randomWealth;

  const look = raceLook(race, gender, age, rng);
  const adultAge = pick(ADULT_AGES, rng);
  const role = pick(ROLES[wealth], rng);
  const hair = pick(age === 'elder' ? GREY_HAIR : age === 'child' ? CHILD_HAIR : HAIR, rng);
  const marked = rng() < 0.4;
  const anyMark = pick(MARKS, rng);
  // Scars, eyepatches and tattoos are not for children.
  const mark = !marked ? null : age === 'child' ? (anyMark === FRECKLES ? FRECKLES : null) : anyMark;

  // Scales instead of hair; everyone else gets a hairstyle.
  const details = [race === 'dragonborn' ? null : hair, mark?.[0]].filter(Boolean).join(', ');
  const withDetails = details ? `, with ${details}` : '';
  const stage = age === 'elder' ? ELDER : adultAge;
  const who =
    age === 'child'
      ? `${WEALTH[wealth].childLook}: a ten-year-old ${gender} ${look}, a child with a small young face`
      : `${role[0]}: a ${stage[0]} ${gender} ${look}`;
  const prompt =
    `Portrait of ${who}${withDetails}, ${expression[0]} expression, ${WEALTH[wealth].clothes}. ` +
    'Head and shoulders, facing the viewer, centered in the frame. ' +
    'Realistic digital oil painting, fantasy RPG character art, detailed skin texture, ' +
    'soft dramatic lighting, dark plain background. No text, no frame, no border.';

  const name = RACE_NAME[race][gender === 'male' ? 0 : 1];
  const parts =
    age === 'child'
      ? [`${name}, ${WEALTH[wealth].child}`, expression[form], mark?.[form]]
      : [`${name}, ${role[form]}`, stage[form], expression[form], mark?.[form]];
  return { prompt, summary: parts.filter(Boolean).join(', ') };
}
