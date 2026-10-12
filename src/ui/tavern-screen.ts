import type { InteriorRequest } from '../interior/from-site.ts';
import { generateInterior, INTERIOR_KINDS, type InteriorKind } from '../interior/generate.ts';
import { renderTavern } from '../render/tavern.ts';
import { TAVERN_QUALITIES, TAVERN_SIZES, type TavernQuality, type TavernSize } from '../tavern/generate.ts';

/** Pixels per 5-foot square in the picture: the size virtual tabletops commonly expect. */
const SQUARE_PX = 70;
/** Where the interior's settings are kept in this browser. */
const STORAGE_KEY = 'rpg-easy-map-generator:tavern';

interface Settings {
  kind: InteriorKind;
  seed: string;
  /** The name of the building; empty, one is invented. */
  name: string;
  size: TavernSize;
  quality: TavernQuality;
  grid: boolean;
  labels: boolean;
  lighting: boolean;
}

export interface InteriorScreen {
  /** Shows this interior, in place of whatever was on the screen. */
  open(request: InteriorRequest): void;
}

/** The name each kind goes by in the files it saves. */
const FILE_NAME: Record<InteriorKind, string> = {
  tavern: 'taverna',
  smithy: 'ferraria',
  house: 'casa',
  castle: 'castelo',
  tower: 'torre',
  temple: 'templo',
};

function randomSeed(): string {
  return Math.random().toString(36).slice(2, 8);
}

function loadSettings(): Settings {
  const fresh: Settings = {
    kind: 'tavern',
    seed: randomSeed(),
    name: '',
    size: 'medium',
    quality: 'medium',
    grid: true,
    labels: true,
    lighting: true,
  };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<Settings> | null;
    if (!saved || typeof saved !== 'object') return fresh;
    return {
      kind: INTERIOR_KINDS.includes(saved.kind as InteriorKind) ? (saved.kind as InteriorKind) : fresh.kind,
      seed: typeof saved.seed === 'string' && saved.seed.length <= 80 ? saved.seed : fresh.seed,
      name: typeof saved.name === 'string' && saved.name.length <= 80 ? saved.name : fresh.name,
      size: TAVERN_SIZES.includes(saved.size as TavernSize) ? (saved.size as TavernSize) : fresh.size,
      quality: TAVERN_QUALITIES.includes(saved.quality as TavernQuality)
        ? (saved.quality as TavernQuality)
        : fresh.quality,
      grid: typeof saved.grid === 'boolean' ? saved.grid : fresh.grid,
      labels: typeof saved.labels === 'boolean' ? saved.labels : fresh.labels,
      lighting: typeof saved.lighting === 'boolean' ? saved.lighting : fresh.lighting,
    };
  } catch {
    // Storage blocked or holding something else: start with a new interior.
    return fresh;
  }
}

/**
 * The interiors screen: the inside of a tavern, a smithy, a house and so on, on
 * the battle grid. There is nothing to draw here: picking a kind, a size or a
 * seed makes the interior at once, and every change redraws it. A building of
 * a town's map can be opened here, and then it comes as that building is, with
 * a way back to that map.
 */
export function initTavernScreen(root: HTMLElement, onBack: () => void): InteriorScreen {
  const find = <T extends HTMLElement>(selector: string) => root.querySelector(selector) as T;
  const canvas = find<HTMLCanvasElement>('#tavern-canvas');
  const seedInput = find<HTMLInputElement>('#tavern-seed');
  const nameInput = find<HTMLInputElement>('#tavern-name');
  const status = find('#tavern-status');
  const kindButtons = [...root.querySelectorAll<HTMLElement>('[data-interior-kind]')];
  const sizeButtons = [...root.querySelectorAll<HTMLElement>('[data-tavern-size]')];
  const qualityButtons = [...root.querySelectorAll<HTMLElement>('[data-tavern-quality]')];
  const settings = loadSettings();

  const refresh = () => {
    // An emptied seed field still has to give an interior; it gets a new seed when left.
    const interior = generateInterior(
      settings.kind,
      settings.seed || 'interior',
      settings.size,
      settings.quality,
      settings.name,
    );
    renderTavern(canvas, interior, {
      squarePx: SQUARE_PX,
      grid: settings.grid,
      labels: settings.labels,
      lighting: settings.lighting,
    });
    for (const button of kindButtons) {
      button.classList.toggle('active', button.dataset.interiorKind === settings.kind);
    }
    for (const button of sizeButtons) {
      button.classList.toggle('active', button.dataset.tavernSize === settings.size);
    }
    for (const button of qualityButtons) {
      button.classList.toggle('active', button.dataset.tavernQuality === settings.quality);
    }
    find('#tavern-grid').classList.toggle('active', settings.grid);
    find('#tavern-labels').classList.toggle('active', settings.labels);
    find('#tavern-lighting').classList.toggle('active', settings.lighting);
    // The invented name shows greyed in the empty field, so that it can be seen and replaced.
    nameInput.placeholder = interior.name;
    // Interior size, without the ground around the building.
    const squares = `${interior.w - 2}×${interior.h - 2}`;
    status.textContent = `${interior.name} · ${squares} quadrados · seed "${interior.seed}"`;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Storage full or blocked: the interior still works, it just will not be remembered.
    }
    return interior;
  };

  for (const button of kindButtons) {
    button.addEventListener('click', () => {
      settings.kind = button.dataset.interiorKind as InteriorKind;
      // A name belongs to one building: a tavern's would not suit a temple.
      settings.name = '';
      nameInput.value = '';
      refresh();
    });
  }
  for (const button of sizeButtons) {
    button.addEventListener('click', () => {
      settings.size = button.dataset.tavernSize as TavernSize;
      refresh();
    });
  }
  for (const button of qualityButtons) {
    button.addEventListener('click', () => {
      settings.quality = button.dataset.tavernQuality as TavernQuality;
      refresh();
    });
  }
  find('#tavern-grid').addEventListener('click', () => {
    settings.grid = !settings.grid;
    refresh();
  });
  find('#tavern-labels').addEventListener('click', () => {
    settings.labels = !settings.labels;
    refresh();
  });
  find('#tavern-lighting').addEventListener('click', () => {
    settings.lighting = !settings.lighting;
    refresh();
  });
  nameInput.addEventListener('input', () => {
    settings.name = nameInput.value.trim();
    refresh();
  });
  seedInput.addEventListener('input', () => {
    settings.seed = seedInput.value.trim();
    refresh();
  });
  seedInput.addEventListener('blur', () => {
    if (settings.seed) return;
    settings.seed = randomSeed();
    seedInput.value = settings.seed;
    refresh();
  });
  find('#tavern-reroll').addEventListener('click', () => {
    settings.seed = randomSeed();
    seedInput.value = settings.seed;
    refresh();
  });
  find('#tavern-export').addEventListener('click', () => {
    const interior = refresh();
    canvas.toBlob((blob) => {
      if (!blob) return;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${FILE_NAME[settings.kind]}-${interior.seed}-${interior.quality}.png`;
      link.click();
      URL.revokeObjectURL(link.href);
    }, 'image/png');
  });

  find('#tavern-back').addEventListener('click', onBack);

  seedInput.value = settings.seed;
  nameInput.value = settings.name;
  refresh();

  return {
    open(request) {
      // Opened from the map of a place, so there is somewhere to go back to.
      find('#tavern-back-section').hidden = false;
      Object.assign(settings, request);
      seedInput.value = settings.seed;
      nameInput.value = settings.name;
      refresh();
    },
  };
}
