import { renderSite, SITE_LABEL } from '../render/site.ts';
import { SITE_SIDES, SITE_TERRAINS, type SiteSide, type SiteTerrain } from '../site/context.ts';
import { generateSite } from '../site/generate.ts';
import { STRUCTURE_KINDS, type StructureKind } from '../structures/model.ts';

/** Where the settings of this screen are kept in this browser. */
const STORAGE_KEY = 'rpg-easy-map-generator:site';

interface Settings {
  kind: StructureKind;
  seed: string;
  /** The name of the place; empty, one is invented. */
  name: string;
  terrain: SiteTerrain;
  exits: SiteSide[];
  grid: boolean;
  labels: boolean;
  names: boolean;
  legend: boolean;
}

/** A place to show, as asked for from the world map. */
export interface SiteRequest {
  kind: StructureKind;
  seed: string;
  name: string;
  terrain: SiteTerrain;
  exits: SiteSide[];
}

export interface SiteScreen {
  /** Shows the map of this place, in place of whatever was on the screen. */
  open(request: SiteRequest): void;
}

const TERRAIN_LABEL: Record<SiteTerrain, string> = {
  plains: 'Planície',
  forest: 'Floresta',
  taiga: 'Taiga',
  desert: 'Deserto',
  swamp: 'Pântano',
  hills: 'Colinas',
  mountain: 'Montanha',
  snow: 'Neve',
};

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
    name: '',
    terrain: 'plains',
    exits: [...SITE_SIDES],
    grid: true,
    labels: true,
    names: true,
    legend: true,
  };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<Settings> | null;
    if (!saved || typeof saved !== 'object') return fresh;
    const exits = saved.exits;
    return {
      kind: STRUCTURE_KINDS.includes(saved.kind as StructureKind)
        ? (saved.kind as StructureKind)
        : fresh.kind,
      seed: typeof saved.seed === 'string' && saved.seed.length <= 80 ? saved.seed : fresh.seed,
      name: typeof saved.name === 'string' && saved.name.length <= 80 ? saved.name : fresh.name,
      terrain: SITE_TERRAINS.includes(saved.terrain as SiteTerrain)
        ? (saved.terrain as SiteTerrain)
        : fresh.terrain,
      exits: Array.isArray(exits) ? SITE_SIDES.filter((side) => exits.includes(side)) : fresh.exits,
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
 * the same kinds that are placed as icons on the world map. Picking a kind, a
 * terrain or a seed makes the map at once, and every change redraws it. A
 * structure of the world map can be opened here, and then its terrain, its
 * roads and its name come with it.
 */
export function initSiteScreen(root: HTMLElement): SiteScreen {
  const find = <T extends HTMLElement>(selector: string) => root.querySelector(selector) as T;
  const canvas = find<HTMLCanvasElement>('#site-canvas');
  const seedInput = find<HTMLInputElement>('#site-seed');
  const nameInput = find<HTMLInputElement>('#site-name');
  const status = find('#site-status');
  const kindButtons = [...root.querySelectorAll<HTMLElement>('[data-site-kind]')];
  const exitButtons = [...root.querySelectorAll<HTMLElement>('[data-site-exit]')];
  const toggles = ['grid', 'labels', 'names', 'legend'] as const;
  const settings = loadSettings();

  const terrainButtons = SITE_TERRAINS.map((terrain) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = TERRAIN_LABEL[terrain];
    button.addEventListener('click', () => {
      settings.terrain = terrain;
      refresh();
    });
    find('#site-terrains').append(button);
    return button;
  });

  const refresh = () => {
    // An emptied seed field still has to give a map; it gets a new seed when left.
    const site = generateSite(settings.kind, settings.seed || 'mapa', {
      terrain: settings.terrain,
      exits: settings.exits,
      name: settings.name,
    });
    renderSite(canvas, site, { cellPx: cellPx(settings.kind), ...settings });
    for (const button of kindButtons) {
      button.classList.toggle('active', button.dataset.siteKind === settings.kind);
    }
    for (const [index, button] of terrainButtons.entries()) {
      button.classList.toggle('active', SITE_TERRAINS[index] === settings.terrain);
    }
    for (const button of exitButtons) {
      button.classList.toggle('active', settings.exits.includes(button.dataset.siteExit as SiteSide));
    }
    for (const toggle of toggles) find(`#site-${toggle}`).classList.toggle('active', settings[toggle]);
    // The invented name shows greyed in the empty field, so that it can be seen and replaced.
    nameInput.placeholder = site.name;
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
  for (const button of exitButtons) {
    button.addEventListener('click', () => {
      const side = button.dataset.siteExit as SiteSide;
      const open = settings.exits.includes(side);
      settings.exits = SITE_SIDES.filter((other) =>
        other === side ? !open : settings.exits.includes(other),
      );
      refresh();
    });
  }
  for (const toggle of toggles) {
    find(`#site-${toggle}`).addEventListener('click', () => {
      settings[toggle] = !settings[toggle];
      refresh();
    });
  }
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
  nameInput.value = settings.name;
  refresh();

  return {
    open(request) {
      Object.assign(settings, request);
      seedInput.value = settings.seed;
      nameInput.value = settings.name;
      refresh();
    },
  };
}
