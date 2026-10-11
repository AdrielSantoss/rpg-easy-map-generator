import type { Rng } from '../generator/rng.ts';

/** [noun, 'm' or 'f'] — Portuguese adjectives agree with the noun's gender. */
const NOUNS: readonly (readonly [string, 'm' | 'f'])[] = [
  ['Javali', 'm'],
  ['Dragão', 'm'],
  ['Grifo', 'm'],
  ['Corvo', 'm'],
  ['Barril', 'm'],
  ['Cervo', 'm'],
  ['Lobo', 'm'],
  ['Anão', 'm'],
  ['Machado', 'm'],
  ['Urso', 'm'],
  ['Galo', 'm'],
  ['Caneca', 'f'],
  ['Raposa', 'f'],
  ['Sereia', 'f'],
  ['Coruja', 'f'],
  ['Espada', 'f'],
  ['Harpia', 'f'],
  ['Lanterna', 'f'],
  ['Âncora', 'f'],
  ['Bruxa', 'f'],
];

/** [masculine, feminine] */
const ADJECTIVES: readonly (readonly [string, string])[] = [
  ['Dourado', 'Dourada'],
  ['Bêbado', 'Bêbada'],
  ['Manco', 'Manca'],
  ['Risonho', 'Risonha'],
  ['Furado', 'Furada'],
  ['Sonolento', 'Sonolenta'],
  ['Vermelho', 'Vermelha'],
  ['Caolho', 'Caolha'],
  ['Dançarino', 'Dançarina'],
  ['Esfomeado', 'Esfomeada'],
  ['Prateado', 'Prateada'],
  ['Saltitante', 'Saltitante'],
  ['Valente', 'Valente'],
];

/** A tavern sign name, such as "O Javali Dourado" or "Taverna da Raposa". */
export function tavernName(rng: Rng): string {
  const [noun, gender] = NOUNS[Math.floor(rng() * NOUNS.length)];
  const adjective = ADJECTIVES[Math.floor(rng() * ADJECTIVES.length)][gender === 'm' ? 0 : 1];
  if (rng() < 0.25) return `Taverna ${gender === 'm' ? 'do' : 'da'} ${noun}`;
  return `${gender === 'm' ? 'O' : 'A'} ${noun} ${adjective}`;
}
