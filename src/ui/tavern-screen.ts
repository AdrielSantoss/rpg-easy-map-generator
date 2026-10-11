import { renderTavern } from '../render/tavern.ts';
import {
  generateTavern,
  TAVERN_QUALITIES,
  TAVERN_SIZES,
  type TavernQuality,
  type TavernSize,
} from '../tavern/generate.ts';

/** Pixels per 5-foot square in the picture: the size virtual tabletops commonly expect. */
const SQUARE_PX = 70;
/** Where the tavern's settings are kept in this browser. */
const STORAGE_KEY = 'rpg-easy-map-generator:tavern';

interface Settings {
  seed: string;
  size: TavernSize;
  quality: TavernQuality;
  grid: boolean;
  labels: boolean;
  lighting: boolean;
}

function randomSeed(): string {
  return Math.random().toString(36).slice(2, 8);
}

function loadSettings(): Settings {
  const fresh: Settings = {
    seed: randomSeed(),
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
      seed: typeof saved.seed === 'string' && saved.seed.length <= 80 ? saved.seed : fresh.seed,
      size: TAVERN_SIZES.includes(saved.size as TavernSize) ? (saved.size as TavernSize) : fresh.size,
      quality: TAVERN_QUALITIES.includes(saved.quality as TavernQuality)
        ? (saved.quality as TavernQuality)
        : fresh.quality,
      grid: typeof saved.grid === 'boolean' ? saved.grid : fresh.grid,
      labels: typeof saved.labels === 'boolean' ? saved.labels : fresh.labels,
      lighting: typeof saved.lighting === 'boolean' ? saved.lighting : fresh.lighting,
    };
  } catch {
    // Storage blocked or holding something else: start with a new tavern.
    return fresh;
  }
}

/**
 * The tavern generator screen. There is nothing to draw here: picking a size or
 * a seed makes a tavern at once, and every change redraws it.
 */
export function initTavernScreen(root: HTMLElement): void {
  const find = <T extends HTMLElement>(selector: string) => root.querySelector(selector) as T;
  const canvas = find<HTMLCanvasElement>('#tavern-canvas');
  const seedInput = find<HTMLInputElement>('#tavern-seed');
  const status = find('#tavern-status');
  const sizeButtons = [...root.querySelectorAll<HTMLElement>('[data-tavern-size]')];
  const qualityButtons = [...root.querySelectorAll<HTMLElement>('[data-tavern-quality]')];
  const settings = loadSettings();

  const refresh = () => {
    // An emptied seed field still has to give a tavern; it gets a new seed when left.
    const tavern = generateTavern(settings.seed || 'taverna', settings.size, settings.quality);
    renderTavern(canvas, tavern, {
      squarePx: SQUARE_PX,
      grid: settings.grid,
      labels: settings.labels,
      lighting: settings.lighting,
    });
    for (const button of sizeButtons) {
      button.classList.toggle('active', button.dataset.tavernSize === settings.size);
    }
    for (const button of qualityButtons) {
      button.classList.toggle('active', button.dataset.tavernQuality === settings.quality);
    }
    find('#tavern-grid').classList.toggle('active', settings.grid);
    find('#tavern-labels').classList.toggle('active', settings.labels);
    find('#tavern-lighting').classList.toggle('active', settings.lighting);
    // Interior size, without the ground around the building.
    const squares = `${tavern.w - 2}×${tavern.h - 2}`;
    status.textContent = `${tavern.name} · ${squares} quadrados · seed "${tavern.seed}"`;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Storage full or blocked: the tavern still works, it just will not be remembered.
    }
    return tavern;
  };

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
    const tavern = refresh();
    canvas.toBlob((blob) => {
      if (!blob) return;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `taverna-${tavern.seed}-${tavern.quality}.png`;
      link.click();
      URL.revokeObjectURL(link.href);
    }, 'image/png');
  });

  seedInput.value = settings.seed;
  refresh();
}
