import { NPC_GENDERS, NPC_RACES, type NpcGender, type NpcRace } from '../npc/prompt.ts';
import { drawToken } from '../render/token.ts';

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

interface Token {
  image: string;
  summary: string;
  file: string;
}

/**
 * The NPC token screen. The portraits come from an image model with a limited
 * daily allowance, so the screen is locked behind a password that the server
 * checks, and each press of the button makes exactly one token.
 */
export function initNpcScreen(root: HTMLElement): void {
  const find = <T extends HTMLElement>(selector: string) => root.querySelector(selector) as T;
  const canvas = find<HTMLCanvasElement>('#npc-token');
  const status = find('#npc-status');
  const summary = find('#npc-summary');
  const history = find('#npc-history');
  const generate = find<HTMLButtonElement>('#npc-generate');
  const save = find<HTMLButtonElement>('#npc-save');
  const passwordInput = find<HTMLInputElement>('#npc-password');

  let password = '';
  let race: NpcRace = 'human';
  let gender: NpcGender = 'male';
  let shown: Token | null = null;
  const tokens: Token[] = [];

  const request = (init: RequestInit = {}) =>
    fetch(ENDPOINT, { ...init, headers: { ...init.headers, Authorization: `Bearer ${password}` } });

  const setLocked = (locked: boolean) => {
    root.dataset.locked = String(locked);
    if (locked) passwordInput.focus();
  };

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

  const show = (token: Token) => {
    shown = token;
    const picture = new Image();
    picture.onload = () => drawToken(canvas, picture);
    picture.src = token.image;
    summary.textContent = token.summary;
    save.disabled = false;
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
    try {
      const response = await request({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ race, gender, seed }),
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
      remember({
        image: result.image,
        summary: result.summary ?? '',
        file: `npc-${race}-${gender}-${seed}.png`,
      });
      status.textContent = '';
    } catch {
      status.textContent = 'Não consegui falar com o servidor. Confira a conexão.';
    } finally {
      generate.disabled = false;
    }
  });

  save.addEventListener('click', () => {
    if (!shown) return;
    const file = shown.file;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = file;
      link.click();
      URL.revokeObjectURL(link.href);
    }, 'image/png');
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
}
