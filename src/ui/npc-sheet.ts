import { ABILITIES, ABILITY_LABEL, ABILITY_SHORT, SKILLS, type Ability } from '../npc/sheet-data.ts';
import {
  ATTACK_ROWS,
  modifier,
  passivePerception,
  saveBonus,
  signed,
  skillBonus,
  spellcasting,
  type CharacterSheet,
} from '../npc/sheet.ts';

export interface SheetView {
  /** Fills the form with a sheet. Edits are written straight back into it. */
  show(sheet: CharacterSheet, portrait: string): void;
  /** Sizes the text boxes to their content; needed once the form becomes visible. */
  fit(): void;
}

const text = (field: string, label: string, extra = '') =>
  `<label class="sheet-field ${extra}"><input data-field="${field}" /><span>${label}</span></label>`;
const number = (field: string, label: string, extra = '') =>
  `<label class="sheet-field ${extra}"><input type="number" data-field="${field}" /><span>${label}</span></label>`;
const area = (field: string, label: string, extra = '') =>
  `<label class="sheet-box ${extra}"><textarea data-field="${field}" rows="2"></textarea><span>${label}</span></label>`;

const check = (list: string, value: string, label: string, note = '') =>
  `<li><label><input type="checkbox" data-list="${list}" value="${value}" />` +
  `<output data-derived="${list}.${value}"></output>${label}${note && ` <small>(${note})</small>`}</label></li>`;

const COINS = [
  ['cp', 'PC'],
  ['sp', 'PP'],
  ['ep', 'PE'],
  ['gp', 'PO'],
  ['pp', 'PL'],
] as const;

/** The first page of the D&D 5th edition character sheet, as a form. */
const MARKUP = `
  <div class="sheet-head">
    <img class="sheet-portrait" alt="" />
    ${text('name', 'Nome do personagem', 'sheet-name')}
    <div class="sheet-id">
      <label class="sheet-field"><span class="sheet-pair"><input data-field="className" /><input type="number" min="1" max="20" data-field="level" /></span><span>Classe e nível</span></label>
      ${text('background', 'Antecedente')}
      ${text('playerName', 'Nome do jogador')}
      ${text('race', 'Raça')}
      ${text('alignment', 'Tendência')}
      ${number('xp', 'Pontos de experiência')}
    </div>
  </div>
  <div class="sheet-body">
    <div class="sheet-col">
      <div class="sheet-stats">
        <div class="sheet-abilities">
          ${ABILITIES.map(
            (ability) =>
              `<label class="sheet-ability"><span>${ABILITY_LABEL[ability]}</span>` +
              `<output data-derived="mod.${ability}"></output>` +
              `<input type="number" min="1" max="30" data-field="abilities.${ability}" /></label>`,
          ).join('')}
        </div>
        <div class="sheet-side">
          ${text('inspiration', 'Inspiração', 'sheet-inline')}
          ${number('proficiencyBonus', 'Bônus de proficiência', 'sheet-inline')}
          <div class="sheet-box"><ul class="sheet-checks">
            ${ABILITIES.map((ability) => check('saves', ability, ABILITY_LABEL[ability])).join('')}
          </ul><span>Testes de resistência</span></div>
          <div class="sheet-box"><ul class="sheet-checks">
            ${SKILLS.map((skill) => check('skills', skill.id, skill.label, ABILITY_SHORT[skill.ability].toLowerCase())).join('')}
          </ul><span>Perícias</span></div>
        </div>
      </div>
      <div class="sheet-field sheet-inline"><output data-derived="passive"></output><span>Sabedoria passiva (Percepção)</span></div>
      ${area('proficiencies', 'Idiomas e outras proficiências', 'sheet-grow')}
    </div>
    <div class="sheet-col">
      <div class="sheet-box sheet-combat">
        <div class="sheet-trio">
          ${number('armorClass', 'Classe de armadura', 'sheet-big')}
          ${number('initiative', 'Iniciativa', 'sheet-big')}
          ${text('speed', 'Deslocamento', 'sheet-big')}
        </div>
        <div class="sheet-box sheet-hp">
          <label class="sheet-hp-max">Pontos de vida máximos <input type="number" data-field="hpMax" /></label>
          <label class="sheet-field sheet-big"><input type="number" data-field="hpCurrent" /><span>Pontos de vida atuais</span></label>
        </div>
        ${number('hpTemp', 'Pontos de vida temporários', 'sheet-big sheet-box')}
        <div class="sheet-duo">
          ${text('hitDice', 'Dados de vida', 'sheet-big sheet-box')}
          <div class="sheet-box sheet-deaths">
            <p>Sucessos <input type="checkbox" /><input type="checkbox" /><input type="checkbox" /></p>
            <p>Fracassos <input type="checkbox" /><input type="checkbox" /><input type="checkbox" /></p>
            <span>Testes contra a morte</span>
          </div>
        </div>
      </div>
      <div class="sheet-box sheet-attacks">
        <div class="sheet-attack-row sheet-attack-head"><span>Nome</span><span>Bônus</span><span>Dano / tipo</span></div>
        ${Array.from(
          { length: ATTACK_ROWS },
          (_, row) =>
            `<div class="sheet-attack-row"><input data-field="attacks.${row}.name" aria-label="Nome do ataque" />` +
            `<input data-field="attacks.${row}.bonus" aria-label="Bônus de ataque" />` +
            `<input data-field="attacks.${row}.damage" aria-label="Dano e tipo" /></div>`,
        ).join('')}
        <output class="sheet-spell" data-derived="spell"></output>
        <textarea data-field="spells" rows="2" aria-label="Magias"></textarea>
        <span>Ataques e conjuração</span>
      </div>
      <div class="sheet-box sheet-gear sheet-grow">
        <div class="sheet-coins">
          ${COINS.map(([coin, label]) => `<label><span>${label}</span><input type="number" min="0" data-field="coins.${coin}" /></label>`).join('')}
        </div>
        <textarea data-field="equipment" rows="4" aria-label="Equipamento"></textarea>
        <span>Equipamento</span>
      </div>
    </div>
    <div class="sheet-col">
      <div class="sheet-box sheet-person">
        ${area('traits', 'Traços de personalidade')}
        ${area('ideals', 'Ideais')}
        ${area('bonds', 'Vínculos')}
        ${area('flaws', 'Defeitos')}
      </div>
      ${area('features', 'Características e talentos', 'sheet-grow')}
    </div>
  </div>`;

type Bag = Record<string, unknown>;

/** Reads `a.b.0.c` out of an object. */
const read = (target: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((value, key) => (value as Bag | undefined)?.[key], target);

/** Writes `a.b.0.c` into an object, making the last-but-one step if a list is too short. */
function write(target: unknown, path: string, value: unknown): void {
  const keys = path.split('.');
  const last = keys.pop()!;
  let at = target as Bag;
  for (const key of keys) {
    at[key] ??= {};
    at = at[key] as Bag;
  }
  at[last] = value;
}

/**
 * The complete character sheet as a form laid out like the official one. Every
 * field can be typed over; the numbers that follow by rule from others
 * (modifiers, saving throws, skills, passive perception, spell DC) are kept up
 * to date and cannot be typed.
 */
export function initSheetView(root: HTMLElement, onChange: () => void): SheetView {
  root.innerHTML = MARKUP;
  const portrait = root.querySelector('img')!;
  const fields = [...root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-field]')];
  const checks = [...root.querySelectorAll<HTMLInputElement>('[data-list]')];
  const derived = [...root.querySelectorAll<HTMLOutputElement>('[data-derived]')];
  const areas = [...root.querySelectorAll('textarea')];
  let sheet: CharacterSheet | null = null;

  const derive = (current: CharacterSheet) => {
    const magic = spellcasting(current);
    for (const output of derived) {
      const [kind, key] = output.dataset.derived!.split('.');
      output.value =
        kind === 'mod'
          ? signed(modifier(current.abilities[key as Ability]))
          : kind === 'saves'
            ? signed(saveBonus(current, key as Ability))
            : kind === 'skills'
              ? signed(skillBonus(current, key as CharacterSheet['skills'][number]))
              : kind === 'passive'
                ? String(passivePerception(current))
                : magic
                  ? `Conjuração (${ABILITY_LABEL[magic.ability]}): CD ${magic.dc} · ataque ${signed(magic.attack)}`
                  : '';
    }
  };

  const fit = () => {
    for (const box of areas) {
      box.style.height = 'auto';
      box.style.height = `${box.scrollHeight}px`;
    }
  };

  root.addEventListener('input', (e) => {
    if (!sheet) return;
    const input = e.target as HTMLInputElement | HTMLTextAreaElement;
    if (input.dataset.field) {
      // An emptied number box counts as zero rather than as "not a number".
      write(sheet, input.dataset.field, input.type === 'number' ? Number(input.value) || 0 : input.value);
    } else if (input.dataset.list) {
      const list = sheet[input.dataset.list as 'saves' | 'skills'] as string[];
      const index = list.indexOf(input.value);
      if ((input as HTMLInputElement).checked && index < 0) list.push(input.value);
      if (!(input as HTMLInputElement).checked && index >= 0) list.splice(index, 1);
    } else {
      // Death saves are scratch marks, not part of the character.
      return;
    }
    derive(sheet);
    if (input instanceof HTMLTextAreaElement) fit();
    onChange();
  });

  return {
    show(next, picture) {
      sheet = next;
      portrait.src = picture;
      for (const field of fields) field.value = String(read(next, field.dataset.field!) ?? '');
      for (const box of checks) {
        box.checked = (next[box.dataset.list as 'saves' | 'skills'] as string[]).includes(box.value);
      }
      derive(next);
      fit();
    },
    fit,
  };
}
