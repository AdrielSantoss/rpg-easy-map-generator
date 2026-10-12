import { buildingAt, interiorOf, type InteriorRequest } from '../interior/from-site.ts';
import { renderSite, SITE_LABEL } from '../render/site.ts';
import { SITE_SIDES, SITE_TERRAINS, type SiteSide, type SiteTerrain } from '../site/context.ts';
import { generateSite, type Site } from '../site/generate.ts';
import { STRUCTURE_KINDS, type StructureKind } from '../structures/model.ts';
import { ZoomController } from './zoom.ts';

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

/** Zoomed in past this, the map is drawn again with more pixels per square, to stay sharp. */
const SHARPEN_ABOVE = 1.6;
/** How many times finer the zoomed-in drawing is. */
const SHARP = 2;
/** How long the zoom must rest before the finer drawing is made, in ms. */
const SHARPEN_DELAY = 180;

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
 * roads and its name come with it. The mouse wheel zooms in and dragging pans;
 * zoomed in, the map is redrawn finer so that it stays sharp. Clicking a
 * building goes to its interior.
 */
export function initSiteScreen(root: HTMLElement, onEnter: (request: InteriorRequest) => void): SiteScreen {
  const find = <T extends HTMLElement>(selector: string) => root.querySelector(selector) as T;
  const canvas = find<HTMLCanvasElement>('#site-canvas');
  const seedInput = find<HTMLInputElement>('#site-seed');
  const nameInput = find<HTMLInputElement>('#site-name');
  const status = find('#site-status');
  const kindButtons = [...root.querySelectorAll<HTMLElement>('[data-site-kind]')];
  const exitButtons = [...root.querySelectorAll<HTMLElement>('[data-site-exit]')];
  const toggles = ['grid', 'labels', 'names', 'legend'] as const;
  const settings = loadSettings();
  const stage = find('#site-stage');
  const zoomReset = find<HTMLButtonElement>('#site-zoom-reset');
  /** 1 for the whole map, SHARP while zoomed in: multiplies the pixels per square. */
  let detail = 1;
  let sharpening = 0;
  /** The map on screen. */
  let shown: Site | null = null;

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
    shown = site;
    renderSite(canvas, site, { ...settings, cellPx: cellPx(settings.kind) * detail });
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

  const zoom = new ZoomController(stage, canvas, {
    // Dragging pans, except when it is the button over the map that is pressed.
    canLeftDrag: (e) => e.target !== zoomReset,
    onChange: (view) => {
      stage.classList.toggle('zoomed', view.scale > 1);
      zoomReset.hidden = view.scale === 1;
      clearTimeout(sharpening);
      sharpening = window.setTimeout(() => {
        const wanted = view.scale > SHARPEN_ABOVE ? SHARP : 1;
        if (wanted === detail) return;
        detail = wanted;
        refresh();
      }, SHARPEN_DELAY);
    },
  });
  zoomReset.addEventListener('click', () => zoom.reset());

  /** The interior of the building under the pointer, whatever the zoom; null where there is none. */
  const insideAt = (e: MouseEvent): InteriorRequest | null => {
    if (!shown || e.target === zoomReset) return null;
    const rect = canvas.getBoundingClientRect();
    const px = cellPx(settings.kind) * detail;
    const x = Math.floor((((e.clientX - rect.left) / rect.width) * canvas.width) / px);
    const y = Math.floor((((e.clientY - rect.top) / rect.height) * canvas.height) / px);
    const building = buildingAt(shown, x, y);
    return building && interiorOf(shown, building);
  };
  // A press that moves is a pan; one that stays put on a building goes inside it.
  let pressed = { x: 0, y: 0 };
  stage.addEventListener('pointerdown', (e) => (pressed = { x: e.clientX, y: e.clientY }), { capture: true });
  stage.addEventListener('pointermove', (e) => stage.classList.toggle('enterable', insideAt(e) !== null));
  stage.addEventListener('click', (e) => {
    if (Math.hypot(e.clientX - pressed.x, e.clientY - pressed.y) > 5) return;
    const request = insideAt(e);
    if (request) onEnter(request);
  });
  /** Another map has other proportions, so the view goes back to the whole of it. */
  const fresh = () => {
    detail = 1;
    zoom.reset();
    refresh();
  };

  for (const button of kindButtons) {
    button.addEventListener('click', () => {
      settings.kind = button.dataset.siteKind as StructureKind;
      fresh();
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
    // The picture saved is always the whole map at its ordinary size, however the screen is zoomed.
    const zoomedDetail = detail;
    detail = 1;
    const site = refresh();
    canvas.toBlob((blob) => {
      if (!blob) return;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${site.kind}-${site.seed}.png`;
      link.click();
      URL.revokeObjectURL(link.href);
      if (zoomedDetail !== detail) {
        detail = zoomedDetail;
        refresh();
      }
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
      fresh();
    },
  };
}
