import type { NpcRace } from './prompt.ts';

/**
 * The rules the character sheet is built from: abilities, skills, classes,
 * races and backgrounds of D&D 5th edition, with their names in Portuguese.
 */

export const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
export type Ability = (typeof ABILITIES)[number];

export const ABILITY_LABEL: Record<Ability, string> = {
  str: 'Força',
  dex: 'Destreza',
  con: 'Constituição',
  int: 'Inteligência',
  wis: 'Sabedoria',
  cha: 'Carisma',
};
export const ABILITY_SHORT: Record<Ability, string> = {
  str: 'FOR',
  dex: 'DES',
  con: 'CON',
  int: 'INT',
  wis: 'SAB',
  cha: 'CAR',
};

/** In the order of the sheet, which is alphabetical in Portuguese. */
export const SKILLS = [
  { id: 'acrobatics', label: 'Acrobacia', ability: 'dex' },
  { id: 'animal', label: 'Adestrar Animais', ability: 'wis' },
  { id: 'arcana', label: 'Arcanismo', ability: 'int' },
  { id: 'athletics', label: 'Atletismo', ability: 'str' },
  { id: 'performance', label: 'Atuação', ability: 'cha' },
  { id: 'deception', label: 'Enganação', ability: 'cha' },
  { id: 'stealth', label: 'Furtividade', ability: 'dex' },
  { id: 'history', label: 'História', ability: 'int' },
  { id: 'intimidation', label: 'Intimidação', ability: 'cha' },
  { id: 'insight', label: 'Intuição', ability: 'wis' },
  { id: 'investigation', label: 'Investigação', ability: 'int' },
  { id: 'medicine', label: 'Medicina', ability: 'wis' },
  { id: 'nature', label: 'Natureza', ability: 'int' },
  { id: 'perception', label: 'Percepção', ability: 'wis' },
  { id: 'persuasion', label: 'Persuasão', ability: 'cha' },
  { id: 'sleight', label: 'Prestidigitação', ability: 'dex' },
  { id: 'religion', label: 'Religião', ability: 'int' },
  { id: 'survival', label: 'Sobrevivência', ability: 'wis' },
] as const satisfies readonly { id: string; label: string; ability: Ability }[];
export type Skill = (typeof SKILLS)[number]['id'];
const ALL_SKILLS: readonly Skill[] = SKILLS.map((skill) => skill.id);

export const CLASSES = [
  'commoner',
  'barbarian',
  'bard',
  'cleric',
  'druid',
  'fighter',
  'monk',
  'paladin',
  'ranger',
  'rogue',
  'sorcerer',
  'warlock',
  'wizard',
] as const;
export type ClassId = (typeof CLASSES)[number];

/** A weapon or attacking cantrip, as it goes on the attacks table. */
export interface AttackDef {
  name: string;
  /** What is rolled to hit; 'finesse' is the better of strength and dexterity, 'spell' the casting ability. */
  uses: 'str' | 'dex' | 'finesse' | 'spell';
  /** Sides of the damage die. */
  die: number;
  type: string;
  /** A cantrip the target saves against rather than one rolled to hit. */
  save?: boolean;
  /** A cantrip: it adds no modifier to damage and rolls more dice at levels 5, 11 and 17. */
  cantrip?: boolean;
  /** The monk's bare hands, whose die grows with level. */
  martialArts?: boolean;
}

export interface ClassDef {
  label: readonly [masculine: string, feminine: string];
  hitDie: number;
  /** The abilities that get the best scores, best first; the rest are shuffled. */
  priority: readonly Ability[];
  saves: readonly Ability[];
  skillCount: number;
  skills: readonly Skill[];
  armor: 'none' | 'leather' | 'scale' | 'chain';
  /** What is added to 10 + Dexterity when wearing no armor. */
  unarmored?: Ability;
  shield?: boolean;
  attacks: readonly AttackDef[];
  /** Armor, weapons and tools the class is trained in. */
  proficiencies: string;
  equipment: readonly string[];
  /** Levels with an ability score improvement. */
  improvements: readonly number[];
  casting?: { ability: Ability; from: number; cantrips: readonly string[]; spells: readonly string[] };
  features: readonly (readonly [level: number, name: string])[];
}

const USUAL_IMPROVEMENTS = [4, 8, 12, 16, 19];

const dagger: AttackDef = { name: 'Adaga', uses: 'finesse', die: 4, type: 'perfurante' };
const rapier: AttackDef = { name: 'Rapieira', uses: 'finesse', die: 8, type: 'perfurante' };
const longsword: AttackDef = { name: 'Espada longa', uses: 'str', die: 8, type: 'cortante' };
const javelin: AttackDef = { name: 'Azagaia', uses: 'str', die: 6, type: 'perfurante' };
const crossbow: AttackDef = { name: 'Besta leve', uses: 'dex', die: 8, type: 'perfurante' };
const fireBolt: AttackDef = { name: 'Raio de Fogo', uses: 'spell', die: 10, type: 'fogo', cantrip: true };

export const CLASS: Record<ClassId, ClassDef> = {
  commoner: {
    label: ['Plebeu', 'Plebeia'],
    hitDie: 8,
    priority: [],
    saves: [],
    skillCount: 1,
    skills: ALL_SKILLS,
    armor: 'none',
    attacks: [{ name: 'Clava', uses: 'str', die: 4, type: 'concussão' }],
    proficiencies: 'Armas simples',
    equipment: ['clava', 'roupas comuns'],
    improvements: USUAL_IMPROVEMENTS,
    features: [],
  },
  barbarian: {
    label: ['Bárbaro', 'Bárbara'],
    hitDie: 12,
    priority: ['str', 'con', 'dex'],
    saves: ['str', 'con'],
    skillCount: 2,
    skills: ['animal', 'athletics', 'intimidation', 'nature', 'perception', 'survival'],
    armor: 'none',
    unarmored: 'con',
    attacks: [{ name: 'Machado grande', uses: 'str', die: 12, type: 'cortante' }, javelin],
    proficiencies: 'Armaduras leves e médias, escudos, armas simples e marciais',
    equipment: ['machado grande', '4 azagaias', 'pacote de aventureiro'],
    improvements: USUAL_IMPROVEMENTS,
    features: [
      [1, 'Fúria'],
      [1, 'Defesa sem Armadura'],
      [2, 'Ataque Descuidado'],
      [2, 'Sentido de Perigo'],
      [3, 'Caminho Primitivo'],
      [5, 'Ataque Extra'],
      [5, 'Movimento Rápido'],
      [7, 'Instinto Selvagem'],
      [9, 'Crítico Brutal'],
      [11, 'Fúria Implacável'],
      [15, 'Fúria Persistente'],
      [18, 'Força Indomável'],
      [20, 'Campeão Primitivo'],
    ],
  },
  bard: {
    label: ['Bardo', 'Barda'],
    hitDie: 8,
    priority: ['cha', 'dex', 'con'],
    saves: ['dex', 'cha'],
    skillCount: 3,
    skills: ALL_SKILLS,
    armor: 'leather',
    attacks: [
      rapier,
      dagger,
      { name: 'Zombaria Viciosa', uses: 'spell', die: 4, type: 'psíquico', save: true, cantrip: true },
    ],
    proficiencies: 'Armaduras leves, armas simples, besta de mão, espada longa, rapieira, três instrumentos',
    equipment: ['rapieira', 'adaga', 'armadura de couro', 'alaúde', 'pacote de artista'],
    improvements: USUAL_IMPROVEMENTS,
    casting: {
      ability: 'cha',
      from: 1,
      cantrips: ['Zombaria Viciosa', 'Ilusão Menor'],
      spells: ['Palavra Curativa', 'Enfeitiçar Pessoa', 'Sono', 'Onda Trovejante'],
    },
    features: [
      [1, 'Inspiração de Bardo'],
      [2, 'Pau pra Toda Obra'],
      [2, 'Canção de Descanso'],
      [3, 'Colégio de Bardo'],
      [3, 'Aptidão'],
      [5, 'Fonte de Inspiração'],
      [6, 'Contraencanto'],
      [10, 'Segredos Mágicos'],
      [20, 'Inspiração Superior'],
    ],
  },
  cleric: {
    label: ['Clérigo', 'Clériga'],
    hitDie: 8,
    priority: ['wis', 'con', 'str'],
    saves: ['wis', 'cha'],
    skillCount: 2,
    skills: ['history', 'insight', 'medicine', 'persuasion', 'religion'],
    armor: 'scale',
    shield: true,
    attacks: [
      { name: 'Maça', uses: 'str', die: 6, type: 'concussão' },
      crossbow,
      { name: 'Chama Sagrada', uses: 'spell', die: 8, type: 'radiante', save: true, cantrip: true },
    ],
    proficiencies: 'Armaduras leves e médias, escudos, armas simples',
    equipment: ['maça', 'besta leve', 'brunea', 'escudo', 'símbolo sagrado', 'pacote de sacerdote'],
    improvements: USUAL_IMPROVEMENTS,
    casting: {
      ability: 'wis',
      from: 1,
      cantrips: ['Chama Sagrada', 'Orientação', 'Taumaturgia'],
      spells: ['Curar Ferimentos', 'Bênção', 'Escudo da Fé', 'Raio Guiador'],
    },
    features: [
      [1, 'Domínio Divino'],
      [2, 'Canalizar Divindade'],
      [2, 'Expulsar Mortos-Vivos'],
      [5, 'Destruir Mortos-Vivos'],
      [10, 'Intervenção Divina'],
    ],
  },
  druid: {
    label: ['Druida', 'Druida'],
    hitDie: 8,
    priority: ['wis', 'con', 'dex'],
    saves: ['int', 'wis'],
    skillCount: 2,
    skills: ['arcana', 'animal', 'insight', 'medicine', 'nature', 'perception', 'religion', 'survival'],
    armor: 'leather',
    shield: true,
    attacks: [
      { name: 'Cimitarra', uses: 'finesse', die: 6, type: 'cortante' },
      { name: 'Produzir Chama', uses: 'spell', die: 8, type: 'fogo', cantrip: true },
    ],
    proficiencies: 'Armaduras leves e médias e escudos (não metálicos), armas de druida, kit de herbalismo',
    equipment: [
      'cimitarra',
      'escudo de madeira',
      'armadura de couro',
      'foco druídico',
      'pacote de explorador',
    ],
    improvements: USUAL_IMPROVEMENTS,
    casting: {
      ability: 'wis',
      from: 1,
      cantrips: ['Produzir Chama', 'Druidismo'],
      spells: ['Curar Ferimentos', 'Constrição', 'Falar com Animais', 'Onda Trovejante'],
    },
    features: [
      [1, 'Druídico'],
      [2, 'Forma Selvagem'],
      [2, 'Círculo Druídico'],
      [18, 'Corpo Atemporal'],
      [18, 'Magias da Besta'],
      [20, 'Arquidruida'],
    ],
  },
  fighter: {
    label: ['Guerreiro', 'Guerreira'],
    hitDie: 10,
    priority: ['str', 'con', 'dex'],
    saves: ['str', 'con'],
    skillCount: 2,
    skills: [
      'acrobatics',
      'animal',
      'athletics',
      'history',
      'insight',
      'intimidation',
      'perception',
      'survival',
    ],
    armor: 'chain',
    shield: true,
    attacks: [longsword, crossbow],
    proficiencies: 'Todas as armaduras, escudos, armas simples e marciais',
    equipment: [
      'espada longa',
      'escudo',
      'cota de malha',
      'besta leve e 20 virotes',
      'pacote de aventureiro',
    ],
    improvements: [4, 6, 8, 12, 14, 16, 19],
    features: [
      [1, 'Estilo de Luta'],
      [1, 'Retomar o Fôlego'],
      [2, 'Surto de Ação'],
      [3, 'Arquétipo Marcial'],
      [5, 'Ataque Extra'],
      [9, 'Indomável'],
    ],
  },
  monk: {
    label: ['Monge', 'Monja'],
    hitDie: 8,
    priority: ['dex', 'wis', 'con'],
    saves: ['str', 'dex'],
    skillCount: 2,
    skills: ['acrobatics', 'athletics', 'history', 'insight', 'religion', 'stealth'],
    armor: 'none',
    unarmored: 'wis',
    attacks: [
      { name: 'Ataque desarmado', uses: 'finesse', die: 4, type: 'concussão', martialArts: true },
      { name: 'Bordão', uses: 'finesse', die: 6, type: 'concussão' },
      { name: 'Dardo', uses: 'dex', die: 4, type: 'perfurante' },
    ],
    proficiencies: 'Armas simples, espada curta, uma ferramenta de artesão',
    equipment: ['bordão', '10 dardos', 'pacote de explorador'],
    improvements: USUAL_IMPROVEMENTS,
    features: [
      [1, 'Defesa sem Armadura'],
      [1, 'Artes Marciais'],
      [2, 'Ki'],
      [2, 'Movimento sem Armadura'],
      [3, 'Tradição Monástica'],
      [3, 'Defletir Projéteis'],
      [4, 'Queda Lenta'],
      [5, 'Ataque Extra'],
      [5, 'Ataque Atordoante'],
      [6, 'Golpes de Ki'],
      [7, 'Evasão'],
      [7, 'Mente Tranquila'],
      [10, 'Pureza do Corpo'],
      [13, 'Idiomas do Sol e da Lua'],
      [14, 'Alma de Diamante'],
      [15, 'Corpo Atemporal'],
      [18, 'Corpo Vazio'],
      [20, 'Autoaperfeiçoamento'],
    ],
  },
  paladin: {
    label: ['Paladino', 'Paladina'],
    hitDie: 10,
    priority: ['str', 'cha', 'con'],
    saves: ['wis', 'cha'],
    skillCount: 2,
    skills: ['athletics', 'insight', 'intimidation', 'medicine', 'persuasion', 'religion'],
    armor: 'chain',
    shield: true,
    attacks: [longsword, javelin],
    proficiencies: 'Todas as armaduras, escudos, armas simples e marciais',
    equipment: [
      'espada longa',
      'escudo',
      'cota de malha',
      '5 azagaias',
      'símbolo sagrado',
      'pacote de sacerdote',
    ],
    improvements: USUAL_IMPROVEMENTS,
    casting: {
      ability: 'cha',
      from: 2,
      cantrips: [],
      spells: ['Bênção', 'Curar Ferimentos', 'Escudo da Fé'],
    },
    features: [
      [1, 'Sentido Divino'],
      [1, 'Cura pelas Mãos'],
      [2, 'Estilo de Luta'],
      [2, 'Destruição Divina'],
      [3, 'Saúde Divina'],
      [3, 'Juramento Sagrado'],
      [5, 'Ataque Extra'],
      [6, 'Aura de Proteção'],
      [10, 'Aura de Coragem'],
      [11, 'Destruição Divina Aprimorada'],
      [14, 'Toque Purificador'],
    ],
  },
  ranger: {
    label: ['Patrulheiro', 'Patrulheira'],
    hitDie: 10,
    priority: ['dex', 'wis', 'con'],
    saves: ['str', 'dex'],
    skillCount: 3,
    skills: [
      'animal',
      'athletics',
      'insight',
      'investigation',
      'nature',
      'perception',
      'stealth',
      'survival',
    ],
    armor: 'scale',
    attacks: [
      { name: 'Arco longo', uses: 'dex', die: 8, type: 'perfurante' },
      { name: 'Espada curta', uses: 'finesse', die: 6, type: 'perfurante' },
    ],
    proficiencies: 'Armaduras leves e médias, escudos, armas simples e marciais',
    equipment: ['arco longo e 20 flechas', 'duas espadas curtas', 'brunea', 'pacote de explorador'],
    improvements: USUAL_IMPROVEMENTS,
    casting: { ability: 'wis', from: 2, cantrips: [], spells: ['Marca do Caçador', 'Curar Ferimentos'] },
    features: [
      [1, 'Inimigo Favorito'],
      [1, 'Explorador Natural'],
      [2, 'Estilo de Luta'],
      [3, 'Arquétipo de Patrulheiro'],
      [3, 'Prontidão Primitiva'],
      [5, 'Ataque Extra'],
      [8, 'Caminho da Floresta'],
      [10, 'Camuflagem Natural'],
      [14, 'Desaparecer'],
      [18, 'Sentidos Selvagens'],
      [20, 'Matador de Inimigos'],
    ],
  },
  rogue: {
    label: ['Ladino', 'Ladina'],
    hitDie: 8,
    priority: ['dex', 'con', 'int'],
    saves: ['dex', 'int'],
    skillCount: 4,
    skills: [
      'acrobatics',
      'athletics',
      'deception',
      'insight',
      'intimidation',
      'investigation',
      'perception',
      'performance',
      'persuasion',
      'sleight',
      'stealth',
    ],
    armor: 'leather',
    attacks: [rapier, { name: 'Arco curto', uses: 'dex', die: 6, type: 'perfurante' }, dagger],
    proficiencies:
      'Armaduras leves, armas simples, besta de mão, espada curta, espada longa, rapieira, ferramentas de ladrão',
    equipment: [
      'rapieira',
      'arco curto e 20 flechas',
      'duas adagas',
      'armadura de couro',
      'ferramentas de ladrão',
      'pacote de assaltante',
    ],
    improvements: [4, 8, 10, 12, 16, 19],
    features: [
      [1, 'Especialização'],
      [1, 'Ataque Furtivo'],
      [1, 'Gíria de Ladrão'],
      [2, 'Ação Ardilosa'],
      [3, 'Arquétipo de Ladino'],
      [5, 'Esquiva Sobrenatural'],
      [7, 'Evasão'],
      [11, 'Talento Confiável'],
      [14, 'Sentido Cego'],
      [15, 'Mente Escorregadia'],
      [18, 'Elusivo'],
      [20, 'Golpe de Sorte'],
    ],
  },
  sorcerer: {
    label: ['Feiticeiro', 'Feiticeira'],
    hitDie: 6,
    priority: ['cha', 'con', 'dex'],
    saves: ['con', 'cha'],
    skillCount: 2,
    skills: ['arcana', 'deception', 'insight', 'intimidation', 'persuasion', 'religion'],
    armor: 'none',
    attacks: [fireBolt, dagger],
    proficiencies: 'Adagas, dardos, fundas, bordões, bestas leves',
    equipment: ['duas adagas', 'foco arcano', 'bolsa de componentes', 'pacote de explorador'],
    improvements: USUAL_IMPROVEMENTS,
    casting: {
      ability: 'cha',
      from: 1,
      cantrips: ['Raio de Fogo', 'Luz', 'Mãos Mágicas', 'Prestidigitação'],
      spells: ['Mísseis Mágicos', 'Escudo Arcano'],
    },
    features: [
      [1, 'Origem de Feitiçaria'],
      [2, 'Fonte de Magia'],
      [3, 'Metamagia'],
      [20, 'Restauração Mística'],
    ],
  },
  warlock: {
    label: ['Bruxo', 'Bruxa'],
    hitDie: 8,
    priority: ['cha', 'con', 'dex'],
    saves: ['wis', 'cha'],
    skillCount: 2,
    skills: ['arcana', 'deception', 'history', 'intimidation', 'investigation', 'nature', 'religion'],
    armor: 'leather',
    attacks: [{ name: 'Rajada Mística', uses: 'spell', die: 10, type: 'energia', cantrip: true }, dagger],
    proficiencies: 'Armaduras leves, armas simples',
    equipment: ['duas adagas', 'armadura de couro', 'foco arcano', 'pacote de estudioso'],
    improvements: USUAL_IMPROVEMENTS,
    casting: {
      ability: 'cha',
      from: 1,
      cantrips: ['Rajada Mística', 'Mãos Mágicas'],
      spells: ['Bruxaria', 'Repreensão Infernal'],
    },
    features: [
      [1, 'Patrono Transcendental'],
      [1, 'Magia de Pacto'],
      [2, 'Invocações Místicas'],
      [3, 'Dádiva do Pacto'],
      [11, 'Arcana Mística'],
      [20, 'Mestre Místico'],
    ],
  },
  wizard: {
    label: ['Mago', 'Maga'],
    hitDie: 6,
    priority: ['int', 'con', 'dex'],
    saves: ['int', 'wis'],
    skillCount: 2,
    skills: ['arcana', 'history', 'insight', 'investigation', 'medicine', 'religion'],
    armor: 'none',
    attacks: [fireBolt, { name: 'Bordão', uses: 'str', die: 6, type: 'concussão' }],
    proficiencies: 'Adagas, dardos, fundas, bordões, bestas leves',
    equipment: ['bordão', 'grimório', 'foco arcano', 'bolsa de componentes', 'pacote de estudioso'],
    improvements: USUAL_IMPROVEMENTS,
    casting: {
      ability: 'int',
      from: 1,
      cantrips: ['Raio de Fogo', 'Mãos Mágicas', 'Prestidigitação'],
      spells: ['Mísseis Mágicos', 'Escudo Arcano', 'Armadura Arcana', 'Detectar Magia', 'Sono'],
    },
    features: [
      [1, 'Recuperação Arcana'],
      [2, 'Tradição Arcana'],
      [18, 'Dominar Magia'],
      [20, 'Assinatura Mágica'],
    ],
  },
};

export interface RaceDef {
  /** Bonuses to ability scores. 'all' is +1 to every one; 'choice' is +1 to two the class values most. */
  bonus: Partial<Record<Ability, number>> | 'all';
  choice?: number;
  /** In metres, as the Portuguese books give it. */
  speed: string;
  languages: readonly string[];
  /** How many more languages the NPC knows. */
  extraLanguages?: number;
  skills?: readonly Skill[];
  /** Skills of the NPC's own choosing. */
  anySkills?: number;
  /** Extra hit points per level. */
  toughness?: number;
  traits: readonly string[];
  /** Whose names this race uses; two mean a name of either. */
  names: readonly NameGroup[];
}

export const RACE: Record<NpcRace, RaceDef> = {
  human: {
    bonus: 'all',
    speed: '9 m',
    languages: ['Comum'],
    extraLanguages: 1,
    traits: [],
    names: ['human'],
  },
  elf: {
    bonus: { dex: 2, int: 1 },
    speed: '9 m',
    languages: ['Comum', 'Élfico'],
    skills: ['perception'],
    traits: ['Visão no Escuro', 'Ancestral Feérico', 'Transe', 'Sentidos Aguçados'],
    names: ['elf'],
  },
  'half-elf': {
    bonus: { cha: 2 },
    choice: 2,
    speed: '9 m',
    languages: ['Comum', 'Élfico'],
    extraLanguages: 1,
    anySkills: 2,
    traits: ['Visão no Escuro', 'Ancestral Feérico', 'Versatilidade em Perícia'],
    names: ['human', 'elf'],
  },
  dwarf: {
    bonus: { con: 2, wis: 1 },
    speed: '7,5 m',
    languages: ['Comum', 'Anão'],
    toughness: 1,
    traits: ['Visão no Escuro', 'Resiliência Anã', 'Treinamento Anão em Combate', 'Tenacidade Anã'],
    names: ['dwarf'],
  },
  halfling: {
    bonus: { dex: 2, cha: 1 },
    speed: '7,5 m',
    languages: ['Comum', 'Halfling'],
    traits: ['Sortudo', 'Bravura', 'Agilidade Halfling', 'Furtividade Natural'],
    names: ['halfling'],
  },
  gnome: {
    bonus: { int: 2, con: 1 },
    speed: '7,5 m',
    languages: ['Comum', 'Gnômico'],
    traits: ['Visão no Escuro', 'Esperteza Gnômica', 'Engenhoqueiro'],
    names: ['gnome'],
  },
  'half-orc': {
    bonus: { str: 2, con: 1 },
    speed: '9 m',
    languages: ['Comum', 'Orc'],
    skills: ['intimidation'],
    traits: ['Visão no Escuro', 'Ameaçador', 'Resistência Implacável', 'Ataques Selvagens'],
    names: ['human', 'orc'],
  },
  orc: {
    bonus: { str: 2, con: 1 },
    speed: '9 m',
    languages: ['Comum', 'Orc'],
    traits: ['Visão no Escuro', 'Agressivo', 'Constituição Poderosa'],
    names: ['orc'],
  },
  tiefling: {
    bonus: { cha: 2, int: 1 },
    speed: '9 m',
    languages: ['Comum', 'Infernal'],
    traits: ['Visão no Escuro', 'Resistência Infernal', 'Legado Infernal'],
    names: ['tiefling'],
  },
  dragonborn: {
    bonus: { str: 2, cha: 1 },
    speed: '9 m',
    languages: ['Comum', 'Dracônico'],
    traits: ['Ancestral Dracônico', 'Arma de Sopro', 'Resistência a Dano'],
    names: ['dragonborn'],
  },
};

/** Languages an NPC may have picked up besides those of the race. */
export const OTHER_LANGUAGES = ['Anão', 'Élfico', 'Gigante', 'Gnômico', 'Goblin', 'Halfling', 'Orc'] as const;

export type NameGroup = 'human' | 'elf' | 'dwarf' | 'halfling' | 'gnome' | 'orc' | 'tiefling' | 'dragonborn';

export const NAMES: Record<
  NameGroup,
  { male: readonly string[]; female: readonly string[]; family: readonly string[] }
> = {
  human: {
    male: ['Aldric', 'Bram', 'Cedric', 'Doran', 'Edmund', 'Gareth', 'Hugo', 'Lucan', 'Rolf', 'Tomas'],
    female: ['Alia', 'Brenna', 'Celia', 'Elara', 'Greta', 'Helga', 'Isolde', 'Mara', 'Rosalind', 'Thea'],
    family: [
      'Corvo-Negro',
      'da Colina',
      'Mão-de-Ferro',
      'Rio-Fundo',
      'Vento-Leste',
      'do Vale',
      'Campo-Verde',
    ],
  },
  elf: {
    male: ['Aelar', 'Erevan', 'Galinndan', 'Ivellios', 'Riardon', 'Soveliss', 'Thamior', 'Varis'],
    female: ['Adrie', 'Birel', 'Caelynn', 'Enna', 'Keyleth', 'Naivara', 'Sariel', 'Shava'],
    family: ['Amakiir', 'Galanodel', 'Liadon', 'Nailo', 'Siannodel', 'Folha-de-Prata'],
  },
  dwarf: {
    male: ['Adrik', 'Baern', 'Dain', 'Harbek', 'Rurik', 'Thorin', 'Tordek', 'Vondal'],
    female: ['Amber', 'Bardryn', 'Eldeth', 'Gunnloda', 'Hlin', 'Riswynn', 'Torgga', 'Vistra'],
    family: ['Balderk', 'Gorunn', 'Holderhek', 'Rumnaheim', 'Ungart', 'Martelo-de-Fogo'],
  },
  halfling: {
    male: ['Alton', 'Cade', 'Eldon', 'Garret', 'Milo', 'Perrin', 'Roscoe', 'Wellby'],
    female: ['Andry', 'Bree', 'Callie', 'Kithri', 'Lavinia', 'Merla', 'Portia', 'Verna'],
    family: ['Bom-Barril', 'Folha-Verde', 'Colina-Alta', 'Pé-Ligeiro', 'Cata-Espinho', 'Sob-o-Galho'],
  },
  gnome: {
    male: ['Alston', 'Boddynock', 'Dimble', 'Fonkin', 'Gimble', 'Orryn', 'Wrenn', 'Zook'],
    female: ['Bimpnottin', 'Carlin', 'Ellyjobell', 'Loopmottin', 'Nissa', 'Roywyn', 'Shamil', 'Waywocket'],
    family: ['Beren', 'Daergel', 'Garrick', 'Nackle', 'Raulnor', 'Timbers'],
  },
  orc: {
    male: ['Dench', 'Feng', 'Gell', 'Holg', 'Krusk', 'Mhurren', 'Shump', 'Thokk'],
    female: ['Baggi', 'Emen', 'Kansif', 'Myev', 'Ovak', 'Sutha', 'Vola', 'Volen'],
    family: ['Quebra-Ossos', 'Presa-Rubra', 'Punho-de-Pedra', 'Olho-Torto', 'Dente-de-Ferro'],
  },
  tiefling: {
    male: ['Akmenos', 'Damakos', 'Ekemon', 'Kairon', 'Leucis', 'Morthos', 'Pelaios', 'Skamos'],
    female: ['Akta', 'Bryseis', 'Damaia', 'Kallista', 'Nemeia', 'Orianna', 'Phelaia', 'Rieta'],
    // Tieflings go by a single name.
    family: [],
  },
  dragonborn: {
    male: ['Arjhan', 'Balasar', 'Donaar', 'Ghesh', 'Kriv', 'Medrash', 'Rhogar', 'Torinn'],
    female: ['Akra', 'Biri', 'Daar', 'Harann', 'Kava', 'Mishann', 'Sora', 'Thava'],
    family: ['Clethtinthiallor', 'Daardendrian', 'Kepeshkmolik', 'Myastan', 'Nemmonis', 'Yarjerit'],
  },
};

export interface BackgroundDef {
  label: string;
  skills: readonly [Skill, Skill];
  feature: string;
  /** Tools the background trains in. */
  tools: string;
  languages: number;
  equipment: readonly string[];
}

export const BACKGROUND = {
  acolyte: {
    label: 'Acólito',
    skills: ['insight', 'religion'],
    feature: 'Abrigo dos Fiéis',
    tools: '',
    languages: 2,
    equipment: ['livro de preces', '5 varetas de incenso', 'vestes'],
  },
  criminal: {
    label: 'Criminoso',
    skills: ['deception', 'stealth'],
    feature: 'Contato Criminal',
    tools: 'um jogo, ferramentas de ladrão',
    languages: 0,
    equipment: ['pé de cabra', 'roupas escuras com capuz'],
  },
  entertainer: {
    label: 'Artista',
    skills: ['acrobatics', 'performance'],
    feature: 'Pela Vontade do Povo',
    tools: 'kit de disfarce, um instrumento musical',
    languages: 0,
    equipment: ['fantasia', 'lembrança de um admirador'],
  },
  folkhero: {
    label: 'Herói do Povo',
    skills: ['animal', 'survival'],
    feature: 'Hospitalidade Rústica',
    tools: 'ferramentas de artesão, veículos terrestres',
    languages: 0,
    equipment: ['pá', 'panela de ferro', 'roupas comuns'],
  },
  guildartisan: {
    label: 'Artesão de Guilda',
    skills: ['insight', 'persuasion'],
    feature: 'Associado à Guilda',
    tools: 'ferramentas de artesão',
    languages: 1,
    equipment: ['ferramentas de artesão', 'carta de apresentação da guilda', 'roupas de viajante'],
  },
  hermit: {
    label: 'Eremita',
    skills: ['medicine', 'religion'],
    feature: 'Descoberta',
    tools: 'kit de herbalismo',
    languages: 1,
    equipment: ['kit de herbalismo', 'estojo de pergaminhos', 'cobertor de inverno'],
  },
  noble: {
    label: 'Nobre',
    skills: ['history', 'persuasion'],
    feature: 'Posição Privilegiada',
    tools: 'um jogo',
    languages: 1,
    equipment: ['roupas finas', 'anel de sinete', 'pergaminho de linhagem'],
  },
  outlander: {
    label: 'Forasteiro',
    skills: ['athletics', 'survival'],
    feature: 'Andarilho',
    tools: 'um instrumento musical',
    languages: 1,
    equipment: ['bordão', 'armadilha de caça', 'troféu de um animal'],
  },
  sage: {
    label: 'Sábio',
    skills: ['arcana', 'history'],
    feature: 'Pesquisador',
    tools: '',
    languages: 2,
    equipment: ['tinta e pena', 'faca pequena', 'carta de um colega'],
  },
  sailor: {
    label: 'Marinheiro',
    skills: ['athletics', 'perception'],
    feature: 'Passagem de Navio',
    tools: 'ferramentas de navegador, veículos aquáticos',
    languages: 0,
    equipment: ['malagueta', '15 m de corda de seda', 'amuleto da sorte'],
  },
  soldier: {
    label: 'Soldado',
    skills: ['athletics', 'intimidation'],
    feature: 'Patente Militar',
    tools: 'um jogo, veículos terrestres',
    languages: 0,
    equipment: ['insígnia de patente', 'troféu de um inimigo', 'dados de osso'],
  },
  urchin: {
    label: 'Órfão',
    skills: ['sleight', 'stealth'],
    feature: 'Segredos da Cidade',
    tools: 'kit de disfarce, ferramentas de ladrão',
    languages: 0,
    equipment: ['faca pequena', 'mapa da cidade natal', 'rato de estimação'],
  },
} as const satisfies Record<string, BackgroundDef>;
export type BackgroundId = keyof typeof BACKGROUND;

/** The class and background that fit each trade of the portrait generator. */
export const TRADE: Record<string, readonly [ClassId, BackgroundId]> = {
  farmer: ['commoner', 'folkhero'],
  beggar: ['commoner', 'urchin'],
  hunter: ['ranger', 'outlander'],
  fisher: ['commoner', 'folkhero'],
  woodcutter: ['barbarian', 'outlander'],
  shepherd: ['druid', 'folkhero'],
  stablehand: ['commoner', 'folkhero'],
  thief: ['rogue', 'criminal'],
  innkeeper: ['commoner', 'guildartisan'],
  guard: ['fighter', 'soldier'],
  merchant: ['commoner', 'guildartisan'],
  blacksmith: ['fighter', 'guildartisan'],
  priest: ['cleric', 'acolyte'],
  scholar: ['wizard', 'sage'],
  healer: ['cleric', 'hermit'],
  bard: ['bard', 'entertainer'],
  mercenary: ['fighter', 'soldier'],
  wizard: ['wizard', 'sage'],
  sailor: ['rogue', 'sailor'],
  noble: ['fighter', 'noble'],
  advisor: ['bard', 'noble'],
  knight: ['paladin', 'noble'],
  highpriest: ['cleric', 'acolyte'],
  courtwizard: ['wizard', 'sage'],
  guildmaster: ['rogue', 'guildartisan'],
};

/** Experience needed to reach each level, from the first. */
export const EXPERIENCE = [
  0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000,
  225000, 265000, 305000, 355000,
] as const;

export const GOOD_ALIGNMENTS = [
  'Leal e Bom',
  'Neutro e Bom',
  'Caótico e Bom',
  'Leal e Neutro',
  'Neutro',
  'Caótico e Neutro',
] as const;
export const EVIL_ALIGNMENTS = ['Leal e Mau', 'Neutro e Mau', 'Caótico e Mau'] as const;

export const PERSONALITY = {
  traits: [
    'Falo pouco, mas observo tudo ao meu redor.',
    'Tenho uma piada pronta para qualquer situação.',
    'Confio mais em animais do que em pessoas.',
    'Nunca recuso um desafio.',
    'Sou gentil com estranhos e desconfio de quem tem poder.',
    'Coleciono histórias de todos que encontro.',
    'Tenho o hábito de resmungar enquanto trabalho.',
    'Enfrento os problemas de frente, sem rodeios.',
    'Tenho mania de manter tudo em ordem.',
    'Demoro a confiar, mas minha lealdade é para a vida toda.',
  ],
  ideals: [
    'Comunidade. Todos devem cuidar uns dos outros.',
    'Liberdade. Ninguém deve viver acorrentado.',
    'Honra. Minha palavra vale mais que ouro.',
    'Conhecimento. Compreender o mundo é o caminho para melhorá-lo.',
    'Tradição. Os costumes antigos nos mantêm unidos.',
    'Justiça. Quem faz o mal deve responder por isso.',
    'Independência. Sigo meu caminho sem dever nada a ninguém.',
    'Generosidade. O que tenho, compartilho.',
  ],
  evilIdeals: [
    'Poder. Só os fortes decidem o próprio destino.',
    'Ambição. Vou subir na vida, custe o que custar.',
    'Domínio. Os outros existem para me servir.',
  ],
  bonds: [
    'Faria qualquer coisa pela minha família.',
    'Devo a vida a alguém que nunca pude agradecer.',
    'Minha terra natal é o lugar mais importante do mundo para mim.',
    'Guardo um objeto que pertenceu a quem me criou.',
    'Procuro uma pessoa que desapareceu há anos.',
    'Meu ofício e meu bom nome são tudo o que tenho.',
    'Jurei proteger quem não pode se defender.',
    'Tenho uma dívida antiga que ainda preciso pagar.',
  ],
  flaws: [
    'Não resisto a uma boa bebida.',
    'Falo demais quando deveria ficar em silêncio.',
    'Guardo rancor por muito tempo.',
    'Tenho medo do escuro e escondo isso.',
    'Minha teimosia já me custou caro.',
    'Minto com facilidade para evitar problemas.',
    'Não consigo recusar uma aposta.',
    'Desconfio de qualquer pessoa de fora.',
    'A ganância fala mais alto do que o bom senso.',
  ],
} as const;
