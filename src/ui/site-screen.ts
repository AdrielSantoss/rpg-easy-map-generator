import { renderSite, SITE_LABEL } from '../render/site.ts';
import { generateSite } from '../site/generate.ts';
import { STRUCTURE_KINDS, type StructureKind } from '../structures/model.ts';

/** Where the settings of this screen are kept in this browser. */
const STORAGE_KEY = 'rpg-easy-map-generator:site';

interface Settings {
  kind: StructureKind;
  seed: string;
  grid: boolean;
  labels: boolean;
  names: boolean;
  legend: boolean;
}

/**
 * Pixels per square in the picture. A dungeon is on the combat grid and gets
 * squares large enough for tokens; the others show a whole town, in squares of
 * three metres.
 */
const cellPx = (kind: StructureKind) => (kind === 'dungeon' ? 60 : 28);

function randomSeed(): string {
  return Math.random().toString(36).slice(2, 8);
}

function loadSettings(): Settings {
  const fresh: Settings = {
    kind: 'city',
    seed: randomSeed(),
    grid: true,
    labels: true,
    names: true,
    legend: true,
  };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<Settings> | null;
    if (!saved || typeof saved !== 'object') return fresh;
    return {
      kind: STRUCTURE_KINDS.includes(saved.kind as StructureKind)
        ? (saved.kind as StructureKind)
        : fresh.kind,
      seed: typeof saved.seed === 'string' && saved.seed.length <= 80 ? saved.seed : fresh.seed,
      grid: typeof saved.grid === 'boolean' ? saved.grid : fresh.grid,
      labels: typeof saved.labels === 'boolean' ? saved.labels : fresh.labels,
      names: typeof saved.names === 'boolean' ? saved.names : fresh.names,
      legend: typeof saved.legend === 'boolean' ? saved.legend : fresh.legend,
    };
  } catch {
    // Storage blocked or holding something else: start with a new map.
    return fresh;
  }
}

/**
 * The screen that maps a single place: a village, a city, a port and so on,
 * the same kinds that are placed as icons on the world map. Picking a kind or
 * a seed makes the map at once, and every change redraws it.
 */
export function initSiteScreen(root: HTMLElement): void {
  const find = <T extends HTMLElement>(selector: string) => root.querySelector(selector) as T;
  const canvas = find<HTMLCanvasElement>('#site-canvas');
  const seedInput = find<HTMLInputElement>('#site-seed');
  const status = find('#site-status');
  const kindButtons = [...root.querySelectorAll<HTMLElement>('[data-site-kind]')];
  const toggles = ['grid', 'labels', 'names', 'legend'] as const;
  const settings = loadSettings();

  const refresh = () => {
    // An emptied seed field still has to give a map; it gets a new seed when left.
    const site = generateSite(settings.kind, settings.seed || 'mapa');
    renderSite(canvas, site, { cellPx: cellPx(settings.kind), ...settings });
    for (const button of kindButtons) {
      button.classList.toggle('active', button.dataset.siteKind === settings.kind);
    }
    for (const toggle of toggles) find(`#site-${toggle}`).classList.toggle('active', settings[toggle]);
    const size = `${site.w}×${site.h} quadrados de ${String(site.cellMeters).replace('.', ',')} m`;
    status.textContent = `${site.name} · ${SITE_LABEL[site.kind]} · ${size} · seed "${site.seed}"`;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Storage full or blocked: the map still works, it just will not be remembered.
    }
    return site;
  };

  for (const button of kindButtons) {
    button.addEventListener('click', () => {
      settings.kind = button.dataset.siteKind as StructureKind;
      refresh();
    });
  }
  for (const toggle of toggles) {
    find(`#site-${toggle}`).addEventListener('click', () => {
      settings[toggle] = !settings[toggle];
      refresh();
    });
  }
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
  find('#site-reroll').addEventListener('click', () => {
    settings.seed = randomSeed();
    seedInput.value = settings.seed;
    refresh();
  });
  find('#site-export').addEventListener('click', () => {
    const site = refresh();
    canvas.toBlob((blob) => {
      if (!blob) return;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${site.kind}-${site.seed}.png`;
      link.click();
      URL.revokeObjectURL(link.href);
    }, 'image/png');
  });

  seedInput.value = settings.seed;
  refresh();
}
