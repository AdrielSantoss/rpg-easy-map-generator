import { seededRng, type Rng } from '../generator/rng.ts';
import {
  describeNpc,
  RACE_NAME,
  type NpcAge,
  type NpcExpression,
  type NpcGender,
  type NpcOptions,
  type NpcRace,
  type NpcWealth,
} from './prompt.ts';
import {
  ABILITIES,
  BACKGROUND,
  CLASS,
  EVIL_ALIGNMENTS,
  EXPERIENCE,
  GOOD_ALIGNMENTS,
  NAMES,
  OTHER_LANGUAGES,
  PERSONALITY,
  RACE,
  SKILLS,
  TRADE,
  type Ability,
  type AttackDef,
  type BackgroundId,
  type ClassId,
  type Skill,
} from './sheet-data.ts';

export const MAX_LEVEL = 20;

export interface Attack {
  name: string;
  /** To hit, as "+5", or the save the target makes, as "CD 13". */
  bonus: string;
  damage: string;
}

/**
 * A D&D 5th edition character sheet. Everything here can be edited by hand
 * afterwards; what follows from it by rule (modifiers, saving throws, skill
 * bonuses, passive perception) is not stored but worked out by the functions below.
 */
export interface CharacterSheet {
  name: string;
  /** Decides the look of the summary card. */
  classId: ClassId;
  className: string;
  level: number;
  background: string;
  playerName: string;
  race: string;
  alignment: string;
  xp: number;
  abilities: Record<Ability, number>;
  inspiration: string;
  proficiencyBonus: number;
  /** Saving throws and skills the character is proficient in. */
  saves: Ability[];
  skills: Skill[];
  armorClass: number;
  initiative: number;
  speed: string;
  hpMax: number;
  hpCurrent: number;
  hpTemp: number;
  hitDice: string;
  attacks: Attack[];
  spells: string;
  equipment: string;
  coins: { cp: number; sp: number; ep: number; gp: number; pp: number };
  /** Languages, and what the character is trained to wear and use. */
  proficiencies: string;
  traits: string;
  ideals: string;
  bonds: string;
  flaws: string;
  features: string;
}

/** What the user may fix about the sheet, besides what was fixed about the portrait. */
export interface SheetOptions extends NpcOptions {
  /** Left out, the class follows the NPC's trade. */
  classId?: ClassId;
  /** Left out, the level follows the NPC's age. */
  level?: number;
  /** Rolls another sheet for the same NPC. */
  roll?: number;
}

/** Lines on the attacks table of the sheet. */
export const ATTACK_ROWS = 3;

const pick = <T>(list: readonly T[], rng: Rng): T => list[Math.floor(rng() * list.length)];
const between = (low: number, high: number, rng: Rng) => low + Math.floor(rng() * (high - low + 1));

function shuffled<T>(list: readonly T[], rng: Rng): T[] {
  const result = [...list];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export const modifier = (score: number): number => Math.floor((score - 10) / 2);
/** A bonus the way it is written on a sheet: "+2", "+0", "−1". */
export const signed = (value: number): string => (value < 0 ? `−${-value}` : `+${value}`);
export const proficiencyAt = (level: number): number => 2 + Math.floor((level - 1) / 4);

export function saveBonus(sheet: CharacterSheet, ability: Ability): number {
  return modifier(sheet.abilities[ability]) + (sheet.saves.includes(ability) ? sheet.proficiencyBonus : 0);
}

export function skillBonus(sheet: CharacterSheet, skill: Skill): number {
  const { ability } = SKILLS.find((entry) => entry.id === skill)!;
  return modifier(sheet.abilities[ability]) + (sheet.skills.includes(skill) ? sheet.proficiencyBonus : 0);
}

export const passivePerception = (sheet: CharacterSheet): number => 10 + skillBonus(sheet, 'perception');

/** The numbers a spellcaster rolls with, or null for a class (or level) without spells. */
export function spellcasting(sheet: CharacterSheet): { ability: Ability; dc: number; attack: number } | null {
  const casting = CLASS[sheet.classId].casting;
  if (!casting || sheet.level < casting.from) return null;
  const bonus = sheet.proficiencyBonus + modifier(sheet.abilities[casting.ability]);
  return { ability: casting.ability, dc: 8 + bonus, attack: bonus };
}

/** Children are not yet anything: their background follows the house they grow up in. */
const CHILD_BACKGROUND: Record<NpcWealth, BackgroundId> = {
  peasant: 'urchin',
  burgher: 'guildartisan',
  noble: 'noble',
};

/** The levels an NPC of each age may have when the user does not choose. */
const AUTO_LEVELS: Record<NpcAge, readonly number[]> = {
  child: [1],
  adult: [1, 1, 2, 2, 3, 3, 4, 5],
  elder: [3, 4, 5, 6, 7, 8],
};

/** The personality trait that goes with the face in the portrait. */
const EXPRESSION_TRAIT: Record<NpcExpression, string> = {
  neutral: 'Mantenho a calma mesmo quando tudo desmorona.',
  happy: 'Estou sempre de bom humor e rio com facilidade.',
  angry: 'Tenho o pavio curto e não levo desaforo para casa.',
  sad: 'Carrego uma tristeza antiga que raramente menciono.',
  evil: 'Sorrio enquanto calculo como tirar proveito de cada um.',
  focused: 'Quando começo uma tarefa, nada me distrai até terminar.',
};

const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function attackLine(
  def: AttackDef,
  level: number,
  proficiency: number,
  abilities: Record<Ability, number>,
  castingAbility: Ability | undefined,
): Attack {
  const mod =
    def.uses === 'spell'
      ? modifier(abilities[castingAbility ?? 'int'])
      : def.uses === 'finesse'
        ? Math.max(modifier(abilities.str), modifier(abilities.dex))
        : modifier(abilities[def.uses]);
  const tier = (level >= 5 ? 1 : 0) + (level >= 11 ? 1 : 0) + (level >= 17 ? 1 : 0);
  const die = def.martialArts ? [4, 6, 8, 10][tier] : def.die;
  const dice = `${def.cantrip ? 1 + tier : 1}d${die}`;
  const extra = def.cantrip || mod === 0 ? '' : signed(mod);
  return {
    name: def.name,
    bonus: def.save ? `CD ${8 + proficiency + mod}` : signed(mod + proficiency),
    damage: `${dice}${extra} ${def.type}`,
  };
}

/**
 * Writes the sheet of the NPC that `describeNpc` paints for the same race,
 * gender, seed and options: the trade decides class and background, the age the
 * level, the wealth the purse, the expression a personality trait and whether
 * the alignment is evil. The same arguments always give the same sheet.
 */
export function generateSheet(
  race: NpcRace,
  gender: NpcGender,
  seed: number,
  options: SheetOptions = {},
): CharacterSheet {
  const { traits } = describeNpc(race, gender, seed, options);
  const rng = seededRng(`sheet:${race}:${gender}:${seed}:${options.roll ?? 0}`);
  const form = gender === 'male' ? 0 : 1;
  const raceDef = RACE[race];
  const [tradeClass, backgroundId] = traits.trade
    ? TRADE[traits.trade]
    : (['commoner', CHILD_BACKGROUND[traits.wealth]] as const);
  const background = BACKGROUND[backgroundId];

  // Who the NPC is comes first and never looks at the class, so that choosing
  // another class or level keeps the name, the personality and the purse.
  const names = NAMES[pick(raceDef.names, rng)];
  const family = NAMES[pick(raceDef.names, rng)].family;
  const firstName = pick(names[gender], rng);
  const familyName = pick(family.length > 0 ? family : [''], rng);
  const autoLevel = pick(AUTO_LEVELS[traits.age], rng);
  const goodAlignment = pick(GOOD_ALIGNMENTS, rng);
  const evilAlignment = pick(EVIL_ALIGNMENTS, rng);
  const trait = pick(PERSONALITY.traits, rng);
  const goodIdeal = pick(PERSONALITY.ideals, rng);
  const evilIdeal = pick(PERSONALITY.evilIdeals, rng);
  const bond = pick(PERSONALITY.bonds, rng);
  const flaw = pick(PERSONALITY.flaws, rng);
  const coins = {
    peasant: { cp: between(5, 30, rng), sp: between(2, 12, rng), ep: 0, gp: between(0, 2, rng), pp: 0 },
    burgher: { cp: 0, sp: between(5, 20, rng), ep: 0, gp: between(10, 25, rng), pp: 0 },
    noble: { cp: 0, sp: 0, ep: 0, gp: between(50, 150, rng), pp: between(2, 10, rng) },
  }[traits.wealth];
  const languages = [
    ...raceDef.languages,
    ...shuffled(
      OTHER_LANGUAGES.filter((language) => !raceDef.languages.includes(language)),
      rng,
    ).slice(0, (raceDef.extraLanguages ?? 0) + background.languages),
  ];
  const evil = traits.expression === 'evil';

  const classId = options.classId ?? tradeClass;
  const klass = CLASS[classId];
  const level = Math.min(MAX_LEVEL, Math.max(1, Math.round(options.level ?? autoLevel)));
  const proficiency = proficiencyAt(level);

  // Ability scores: the standard array on what the class needs most, then the
  // race, then the improvements earned by level.
  const order = [
    ...klass.priority,
    ...shuffled(
      ABILITIES.filter((a) => !klass.priority.includes(a)),
      rng,
    ),
  ];
  const scores = klass.priority.length > 0 ? [15, 14, 13, 12, 10, 8] : [13, 12, 11, 10, 10, 8];
  const abilities = {} as Record<Ability, number>;
  for (const [index, ability] of order.entries()) abilities[ability] = scores[index];
  if (raceDef.bonus === 'all') {
    for (const ability of ABILITIES) abilities[ability] += 1;
  } else {
    const bonus = raceDef.bonus;
    for (const ability of ABILITIES) abilities[ability] += bonus[ability] ?? 0;
    for (const ability of order.filter((a) => !(a in bonus)).slice(0, raceDef.choice ?? 0)) {
      abilities[ability] += 1;
    }
  }
  for (const at of klass.improvements) {
    if (at > level) continue;
    let points = 2;
    for (const ability of order) {
      while (points > 0 && abilities[ability] < 20) {
        abilities[ability] += 1;
        points -= 1;
      }
    }
  }

  const known = new Set<Skill>([...background.skills, ...(raceDef.skills ?? [])]);
  const learn = (from: readonly Skill[], count: number) => {
    for (const skill of shuffled(
      from.filter((s) => !known.has(s)),
      rng,
    ).slice(0, count))
      known.add(skill);
  };
  learn(klass.skills, klass.skillCount);
  learn(
    SKILLS.map((skill) => skill.id),
    raceDef.anySkills ?? 0,
  );

  const dex = modifier(abilities.dex);
  const con = modifier(abilities.con);
  const armorClass =
    {
      none: 10 + dex + (klass.unarmored ? modifier(abilities[klass.unarmored]) : 0),
      leather: 11 + dex,
      scale: 14 + Math.min(dex, 2),
      chain: 16,
    }[klass.armor] + (klass.shield ? 2 : 0);
  const perLevel = Math.max(1, klass.hitDie / 2 + 1 + con);
  const hpMax = Math.max(1, klass.hitDie + con) + (level - 1) * perLevel + (raceDef.toughness ?? 0) * level;

  const casts = klass.casting && level >= klass.casting.from ? klass.casting : undefined;
  const classFeatures = klass.features
    .filter(([from]) => from <= level)
    .map(([, name]) => (name === 'Ataque Furtivo' ? `${name} (${Math.ceil(level / 2)}d6)` : name));
  const tools = [klass.proficiencies, background.tools].filter(Boolean).join('; ');

  return {
    name: [firstName, familyName].filter(Boolean).join(' '),
    classId,
    className: klass.label[form],
    level,
    background: background.label,
    playerName: '',
    race: RACE_NAME[race][form],
    alignment: evil ? evilAlignment : goodAlignment,
    xp: EXPERIENCE[level - 1],
    abilities,
    inspiration: '',
    proficiencyBonus: proficiency,
    saves: [...klass.saves],
    skills: SKILLS.map((skill) => skill.id).filter((skill) => known.has(skill)),
    armorClass,
    initiative: dex,
    speed: raceDef.speed,
    hpMax,
    hpCurrent: hpMax,
    hpTemp: 0,
    hitDice: `${level}d${klass.hitDie}`,
    // One entry per line of the table, the unused ones blank and ready to be filled in.
    attacks: Array.from({ length: ATTACK_ROWS }, (_, row) =>
      klass.attacks[row]
        ? attackLine(klass.attacks[row], level, proficiency, abilities, klass.casting?.ability)
        : { name: '', bonus: '', damage: '' },
    ),
    spells: casts
      ? [
          casts.cantrips.length > 0 ? `Truques: ${casts.cantrips.join(', ')}.` : '',
          `Magias de 1º círculo: ${casts.spells.join(', ')}.`,
        ]
          .filter(Boolean)
          .join('\n')
      : '',
    equipment: capitalized([...new Set([...klass.equipment, ...background.equipment])].join(', ')) + '.',
    coins,
    proficiencies: [`Idiomas: ${languages.join(', ')}.`, `Proficiências: ${tools}.`].join('\n'),
    traits: `${EXPRESSION_TRAIT[traits.expression]} ${trait}`,
    ideals: evil ? evilIdeal : goodIdeal,
    bonds: bond,
    flaws: flaw,
    features: [
      raceDef.traits.length > 0 ? `Raça: ${raceDef.traits.join(', ')}.` : '',
      `Antecedente: ${background.feature}.`,
      classFeatures.length > 0 ? `Classe: ${classFeatures.join(', ')}.` : '',
    ]
      .filter(Boolean)
      .join('\n'),
  };
}
