import {
  NPC_AGES,
  NPC_EXPRESSIONS,
  NPC_GENDERS,
  NPC_RACES,
  NPC_WEALTHS,
  type NpcAge,
  type NpcExpression,
  type NpcGender,
  type NpcOptions,
  type NpcRace,
  type NpcWealth,
} from '../npc/prompt.ts';
import { CLASS, CLASSES, type ClassId } from '../npc/sheet-data.ts';
import { generateSheet, MAX_LEVEL, type CharacterSheet } from '../npc/sheet.ts';
import { drawSheetCard } from '../render/sheet-card.ts';
import { drawToken } from '../render/token.ts';
import { initSheetView } from './npc-sheet.ts';

/** Where the password is kept in this browser once it has been accepted. */
const KEY_STORAGE = 'rpg-easy-map-generator:npc-key';
const ENDPOINT = '/api/npc';
/** How many past tokens stay on screen to go back to. */
const HISTORY = 8;

const RACE_LABEL: Record<NpcRace, string> = {
  human: 'Humano',
  elf: 'Elfo',
  'half-elf': 'Meio-elfo',
  dwarf: 'Anão',
  halfling: 'Halfling',
  gnome: 'Gnomo',
  'half-orc': 'Meio-orc',
  orc: 'Orc',
  tiefling: 'Tiefling',
  dragonborn: 'Draconato',
};
const GENDER_LABEL: Record<NpcGender, string> = { male: 'Masculino', female: 'Feminino' };

/** Stands for "not chosen": the generator picks. */
const ANY = 'any';
type Any = typeof ANY;
const AGE_LABEL: Record<NpcAge | Any, string> = {
  any: 'Aleatória',
  child: 'Criança',
  adult: 'Adulto',
  elder: 'Idoso',
};
const EXPRESSION_LABEL: Record<NpcExpression | Any, string> = {
  any: 'Aleatória',
  neutral: 'Normal',
  happy: 'Feliz',
  angry: 'Bravo',
  sad: 'Triste',
  evil: 'Maligno',
  focused: 'Concentrado',
};
const WEALTH_LABEL: Record<NpcWealth | Any, string> = {
  any: 'Aleatória',
  peasant: 'Camponês',
  burgher: 'Burguês',
  noble: 'Nobre',
};

/** What is shown in the middle: the round token, or the character sheet short or complete. */
type View = 'token' | 'card' | 'sheet';

interface Token {
  image: string;
  summary: string;
  file: string;
  /** What the portrait was asked for, which the sheet is written from too. */
  race: NpcRace;
  gender: NpcGender;
  seed: number;
  options: NpcOptions;
  /** How many times the sheet was rolled again. */
  roll: number;
  sheet: CharacterSheet;
}

function download(canvas: HTMLCanvasElement, file: string): void {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = file;
    link.click();
    URL.revokeObjectURL(link.href);
  }, 'image/png');
}

/**
 * The NPC screen. The portraits come from an image model with a limited daily
 * allowance, so the screen is locked behind a password that the server checks,
 * and each press of the button makes exactly one token. The character sheet
 * that goes with each portrait is written here in the browser, by rule.
 */
export function initNpcScreen(root: HTMLElement): void {
  const find = <T extends HTMLElement>(selector: string) => root.querySelector(selector) as T;
  const canvas = find<HTMLCanvasElement>('#npc-token');
  const card = find<HTMLCanvasElement>('#npc-card');
  const status = find('#npc-status');
  const summary = find('#npc-summary');
  const history = find('#npc-history');
  const generate = find<HTMLButtonElement>('#npc-generate');
  const save = find<HTMLButtonElement>('#npc-save');
  const saveCard = find<HTMLButtonElement>('#npc-save-card');
  const saveSheet = find<HTMLButtonElement>('#npc-save-sheet');
  const reroll = find<HTMLButtonElement>('#npc-reroll');
  const classSelect = find<HTMLSelectElement>('#npc-class');
  const levelSelect = find<HTMLSelectElement>('#npc-level');
  const passwordInput = find<HTMLInputElement>('#npc-password');
  const viewButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-view]')];
  const panes = [...root.querySelectorAll<HTMLElement>('[data-pane]')];

  let password = '';
  let race: NpcRace = 'human';
  let gender: NpcGender = 'male';
  let age: NpcAge | Any = ANY;
  let expression: NpcExpression | Any = ANY;
  let wealth: NpcWealth | Any = ANY;
  let shown: Token | null = null;
  /** The portrait of the token on screen, once loaded. */
  let picture: HTMLImageElement | null = null;
  const tokens: Token[] = [];

  const request = (init: RequestInit = {}) =>
    fetch(ENDPOINT, { ...init, headers: { ...init.headers, Authorization: `Bearer ${password}` } });

  const setLocked = (locked: boolean) => {
    root.dataset.locked = String(locked);
    if (locked) passwordInput.focus();
  };

  const drawCard = () => {
    if (shown && picture?.complete) drawSheetCard(card, shown.sheet, picture);
  };
  // Whatever is typed on the complete sheet shows on the short one too.
  const sheetView = initSheetView(find('#npc-sheet'), drawCard);

  const setView = (view: View) => {
    root.dataset.view = view;
    for (const button of viewButtons) button.classList.toggle('active', button.dataset.view === view);
    for (const pane of panes) pane.hidden = pane.dataset.pane !== view;
    if (view === 'sheet') sheetView.fit();
  };
  for (const button of viewButtons) {
    button.addEventListener('click', () => setView(button.dataset.view as View));
  }

  const choice = <T extends string>(
    container: HTMLElement,
    values: readonly T[],
    labels: Record<T, string>,
    current: () => T,
    choose: (value: T) => void,
  ) => {
    const buttons = values.map((value) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = labels[value];
      button.addEventListener('click', () => {
        choose(value);
        for (const [index, other] of buttons.entries())
          other.classList.toggle('active', values[index] === current());
      });
      container.append(button);
      return button;
    });
    for (const [index, button] of buttons.entries())
      button.classList.toggle('active', values[index] === current());
  };
  choice(
    find('#npc-races'),
    NPC_RACES,
    RACE_LABEL,
    () => race,
    (value) => (race = value),
  );
  choice(
    find('#npc-genders'),
    NPC_GENDERS,
    GENDER_LABEL,
    () => gender,
    (value) => (gender = value),
  );
  choice(
    find('#npc-ages'),
    [ANY, ...NPC_AGES],
    AGE_LABEL,
    () => age,
    (value) => (age = value),
  );
  choice(
    find('#npc-expressions'),
    [ANY, ...NPC_EXPRESSIONS],
    EXPRESSION_LABEL,
    () => expression,
    (value) => (expression = value),
  );
  choice(
    find('#npc-wealths'),
    [ANY, ...NPC_WEALTHS],
    WEALTH_LABEL,
    () => wealth,
    (value) => (wealth = value),
  );

  classSelect.append(
    new Option('Pelo ofício', ANY),
    ...CLASSES.map((id) => new Option(CLASS[id].label[0], id)),
  );
  levelSelect.append(
    new Option('Pela idade', ANY),
    ...Array.from({ length: MAX_LEVEL }, (_, index) => new Option(String(index + 1))),
  );

  /** Writes the sheet of an NPC with the class and level chosen on the panel. */
  const writeSheet = (token: Omit<Token, 'sheet'>) =>
    generateSheet(token.race, token.gender, token.seed, {
      ...token.options,
      classId: classSelect.value === ANY ? undefined : (classSelect.value as ClassId),
      level: levelSelect.value === ANY ? undefined : Number(levelSelect.value),
      roll: token.roll,
    });

  const show = (token: Token) => {
    shown = token;
    const loading = new Image();
    picture = loading;
    loading.onload = () => {
      // A slow picture may arrive after another token was chosen.
      if (picture !== loading) return;
      drawToken(canvas, loading);
      drawCard();
    };
    loading.src = token.image;
    summary.textContent = token.summary;
    sheetView.show(token.sheet, token.image);
    for (const button of [save, saveCard, saveSheet, reroll, ...viewButtons]) button.disabled = false;
    for (const [index, thumb] of [...history.children].entries()) {
      thumb.classList.toggle('active', tokens[index] === token);
    }
  };

  const remember = (token: Token) => {
    tokens.unshift(token);
    tokens.length = Math.min(tokens.length, HISTORY);
    history.replaceChildren(
      ...tokens.map((past) => {
        const thumb = document.createElement('img');
        thumb.src = past.image;
        thumb.alt = past.summary;
        thumb.title = past.summary;
        thumb.addEventListener('click', () => show(past));
        return thumb;
      }),
    );
    show(token);
  };

  /** Replaces the sheet on screen by a newly written one; what was typed on it is lost. */
  const rewrite = () => {
    if (!shown) return;
    shown.sheet = writeSheet(shown);
    sheetView.show(shown.sheet, shown.image);
    drawCard();
  };
  classSelect.addEventListener('change', rewrite);
  levelSelect.addEventListener('change', rewrite);
  reroll.addEventListener('click', () => {
    if (!shown) return;
    shown.roll += 1;
    rewrite();
  });

  find<HTMLFormElement>('#npc-lock').addEventListener('submit', async (e) => {
    e.preventDefault();
    password = passwordInput.value;
    status.textContent = 'Conferindo a senha…';
    try {
      const response = await request();
      if (response.status === 204) {
        try {
          localStorage.setItem(KEY_STORAGE, password);
        } catch {
          // Storage blocked: the password just has to be typed again next visit.
        }
        passwordInput.value = '';
        status.textContent = '';
        setLocked(false);
      } else if (response.status === 401) {
        status.textContent = 'Senha incorreta.';
      } else {
        // Typically the local dev server, which serves the site but not the function.
        status.textContent = 'O gerador de NPC não está disponível neste endereço.';
      }
    } catch {
      status.textContent = 'Não consegui falar com o servidor. Confira a conexão.';
    }
  });

  generate.addEventListener('click', async () => {
    generate.disabled = true;
    status.textContent = 'Pintando o retrato… leva alguns segundos.';
    const seed = Math.floor(Math.random() * 0xffffffff);
    // A trait left on "any" is not sent, and the generator picks it.
    const asked = {
      race,
      gender,
      seed,
      options: {
        age: age === ANY ? undefined : age,
        expression: expression === ANY ? undefined : expression,
        wealth: wealth === ANY ? undefined : wealth,
      },
    };
    try {
      const response = await request({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ race, gender, seed, ...asked.options }),
      });
      if (response.status === 401) {
        // The password was changed since it was saved here.
        localStorage.removeItem(KEY_STORAGE);
        setLocked(true);
        status.textContent = 'A senha mudou. Digite a nova.';
        return;
      }
      const result = (await response.json()) as { image?: string; summary?: string; error?: string };
      if (!response.ok || !result.image) {
        status.textContent = result.error ?? 'Não foi possível gerar o token.';
        return;
      }
      const token = {
        ...asked,
        image: result.image,
        summary: result.summary ?? '',
        file: `npc-${race}-${gender}-${seed}`,
        roll: 0,
      };
      remember({ ...token, sheet: writeSheet(token) });
      status.textContent = '';
    } catch {
      status.textContent = 'Não consegui falar com o servidor. Confira a conexão.';
    } finally {
      generate.disabled = false;
    }
  });

  save.addEventListener('click', () => {
    if (shown) download(canvas, `${shown.file}.png`);
  });
  saveCard.addEventListener('click', () => {
    if (shown) download(card, `${shown.file}-ficha.png`);
  });
  saveSheet.addEventListener('click', () => {
    if (!shown) return;
    // The browser prints the complete sheet alone on an A4 page (see the print
    // rules in the stylesheet), and "save as PDF" there makes the file, which
    // takes its name from the page title.
    setView('sheet');
    const title = document.title;
    document.title = `Ficha - ${shown.sheet.name || shown.file}`;
    window.print();
    document.title = title;
  });

  find('#npc-logout').addEventListener('click', () => {
    localStorage.removeItem(KEY_STORAGE);
    password = '';
    setLocked(true);
    status.textContent = 'Senha esquecida neste navegador.';
  });

  // A password accepted before is trusted until the server says otherwise.
  try {
    password = localStorage.getItem(KEY_STORAGE) ?? '';
  } catch {
    // Storage blocked: the password just has to be typed each visit.
  }
  root.dataset.locked = String(password === '');
  setView('token');
}
