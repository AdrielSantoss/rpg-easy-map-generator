import { normalizeDistribution, retarget, type TerrainDistribution } from './generator/distribution.ts';
import {
  BRUSH_KINDS,
  HINT_RADIUS,
  hintAt,
  hintCoreRadius,
  MAX_HINT_RADIUS,
  MIN_HINT_RADIUS,
  type BrushKind,
  type TerrainHint,
} from './generator/hints.ts';
import { generateMap, type MapData } from './generator/index.ts';
import { History } from './project/history.ts';
import { parseProject, serializeProject, type Project } from './project/project.ts';
import {
  applyRegionNames,
  dodge,
  findRegions,
  labelWidth,
  makeLabel,
  nameRegion,
  regionAt,
  regionKindAt,
  suggestRegionName,
  type Region,
  type RegionName,
} from './regions/regions.ts';
import { drawBrushTrail, TERRAIN_COLOR } from './render/hints.ts';
import { renderMap } from './render/parchment.ts';
import { drawRegions } from './render/regions.ts';
import { drawRoads } from './render/roads.ts';
import { drawSelection, drawStructures } from './render/structures.ts';
import {
  STRUCTURE_KINDS,
  structureAt,
  structureFootprint,
  type Structure,
  type StructureKind,
} from './structures/model.ts';
import { suggestName } from './structures/names.ts';
import { distanceToRoad, findRoad, markRoad, planNetwork, type RoadPath } from './structures/roads.ts';
import { DistributionPanel } from './ui/distribution.ts';
import { RegionMenu } from './ui/region-menu.ts';
import { SketchBoard, type Tool } from './ui/sketch.ts';
import { StructureMenu } from './ui/structure-menu.ts';
import { ZoomController } from './ui/zoom.ts';

/** Simulation grid; the sketch canvas (1200×800) is twice this. */
const GRID_W = 600;
const GRID_H = 400;
const VIEW_SCALE = 2;
const EXPORT_SCALE = 4;
/** Resolution the map is repainted at once the user zooms in past SHARPEN_ABOVE. */
const DETAIL_SCALE = 4;
const SHARPEN_ABOVE = 1.25;
/** Wait this long (ms) after the last zoom step before the slow sharp repaint. */
const SHARPEN_DELAY = 300;
/** While dragging a terrain brush, a new dab is laid down every this fraction of the brush's reach. */
const BRUSH_SPACING = 0.5;

type MapTool = StructureKind | BrushKind | 'label' | 'remove' | null;

/** A road between two structures; it lives and dies with them. */
interface Road {
  from: Structure;
  to: Structure;
  path: RoadPath;
}

/** With the remove tool, a click this close (in cells) to a road picks it. */
const ROAD_PICK_DISTANCE = 3;
/** Stands in for the route of a road loaded from a save, until the map is generated. */
const NO_ROUTE: RoadPath = { cells: new Int32Array(0), points: new Float32Array(0), bridges: [] };
/** Where the project is kept in this browser. */
const STORAGE_KEY = 'rpg-easy-map-generator:project';
/** How long (ms) after the last change the project is saved and becomes an undo step. */
const SAVE_DELAY = 200;

const isStructureKind = (tool: MapTool): tool is StructureKind =>
  (STRUCTURE_KINDS as readonly string[]).includes(tool ?? '');

const isTerrainKind = (tool: MapTool): tool is BrushKind =>
  (BRUSH_KINDS as readonly string[]).includes(tool ?? '');

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const sketch = new SketchBoard($<HTMLCanvasElement>('sketch'));
const mapCanvas = $<HTMLCanvasElement>('map');
const overlay = $<HTMLCanvasElement>('overlay');
const seedInput = $<HTMLInputElement>('seed');
const status = $('status');
const generateButton = $<HTMLButtonElement>('generate');
const toolButtons: Record<Tool, HTMLElement> = { pen: $('tool-pen'), eraser: $('tool-eraser') };
const distributionPanel = new DistributionPanel($('distribution'));
const distributionDialog = $<HTMLDialogElement>('distribution-dialog');
const paletteButtons = [...document.querySelectorAll<HTMLElement>('[data-tool]')];

let currentMap: MapData | null = null;
let structures: Structure[] = [];
let roads: Road[] = [];
/** The structure whose menu is open. */
let selected: Structure | null = null;
/** The structure a road is being built from; the next structure clicked ends it. */
let linkingFrom: Structure | null = null;
let hints: TerrainHint[] = [];
/**
 * Terrain shares and snow cover the user asked for; null lets the climate
 * decide. It describes the map before painting: painted areas come on top.
 */
let distribution: TerrainDistribution | null = null;
/** What the distribution dialog showed when it was opened, to tell what the user changed. */
let shownDistribution: TerrainDistribution | null = null;
let mapTool: MapTool = null;
/** How far each dab of the terrain brush reaches, in cells: the brush size the user picked. */
let brushRadius = HINT_RADIUS;
/** Terrain dabs of the brush drag in progress; they reach the map when the button is released. */
let stroke: TerrainHint[] | null = null;
/** Pixels per cell the map and overlay canvases are currently painted at. */
let paintedScale = VIEW_SCALE;
let sharpenTimer = 0;
/** Regions found on the current map, with their suggested names. */
let foundRegions: Region[] = [];
/** Names the user gave to regions, replacing the suggestions. */
let regionNames: RegionName[] = [];
let showRegions = true;
/** The region labels actually on screen: user names applied, empty when switched off. */
let shownRegions: Region[] = [];
/** The region whose name is being edited. */
let editingRegion: Region | null = null;
/** For each label in `shownRegions`, the region as it was found on the map (same order). */
let shownSources: Region[] = [];
/** Names the user wrote on the map at spots of their own choosing. */
let writtenLabels: Region[] = [];
/**
 * A name just written whose box is still open for typing. Writing it and
 * typing over the suggestion are one change, so nothing is recorded meanwhile.
 */
let draftLabel: Region | null = null;
/** Off for the ?demo pages, so trying the demo does not overwrite the user's saved map. */
const autosave = !new URLSearchParams(location.search).has('demo');
/** True while a saved project is being loaded, when the half-loaded state must not be saved. */
let restoring = false;
let saveTimer = 0;
/** Undo and redo steps since the project was opened. */
const history = new History('');
/** The terrain key (see terrainKey) of the map on screen, or '' when there is none. */
let mapKey = '';

overlay.width = GRID_W * VIEW_SCALE;
overlay.height = GRID_H * VIEW_SCALE;

const brush = $('brush');
const ghost = $<HTMLCanvasElement>('ghost');
/** Side of the square the ghost is drawn in, in cells: room for the largest icon. */
const GHOST_CELLS = 60;
ghost.width = ghost.height = GHOST_CELLS * DETAIL_SCALE;
const zoomReset = $('zoom-reset');
const zoom = new ZoomController($('stage'), $('viewport'), {
  // With no tool the left button pans, unless it is about to click a structure, a region name or a menu.
  canLeftDrag: (e) =>
    document.body.dataset.mode === 'map' &&
    mapTool === null &&
    linkingFrom === null &&
    !(e.target as Element).closest('.map-menu') &&
    !structureAt(structures, ...cellAt(e)) &&
    !regionAt(shownRegions, ...cellAt(e)),
  onChange: (view) => {
    placeMenus();
    zoomReset.hidden = view.scale === 1;
    zoomReset.textContent = `Zoom ${Math.round(view.scale * 100)}% · ver tudo`;
    sharpenSoon();
  },
});
zoomReset.addEventListener('click', () => zoom.reset());

const structureMenu = new StructureMenu($('structure-menu'), {
  onRoad: () => {
    linkingFrom = selected;
    structureMenu.close();
    overlay.classList.add('linking');
    status.textContent = 'Clique na estrutura de destino da estrada (Esc cancela).';
  },
  onUnlink: () => {
    if (!selected) return;
    const removed = roadsOf(selected);
    roads = roads.filter((road) => !removed.includes(road));
    status.textContent = `${removed.length} estrada(s) removida(s). "${selected.name}" ficou sem ligações.`;
    select(selected);
  },
  onRename: (name) => {
    if (!selected) return;
    selected.name = name;
    select(selected);
  },
  onRetype: (kind) => {
    if (!selected) return;
    selected.kind = kind;
    select(selected);
  },
  onRemove: () => {
    if (!selected) return;
    status.textContent = `"${selected.name}" removido.`;
    removeStructure(selected);
  },
});

const regionMenu = new RegionMenu($('region-menu'), {
  onRename: (name) => {
    if (!editingRegion) return;
    // A name the user wrote is edited in place; a found region gets its name on file.
    if (writtenLabels.includes(editingRegion)) editingRegion.name = name;
    else regionNames = nameRegion(regionNames, editingRegion, name, GRID_W);
    closeRegionMenu();
    redrawOverlay();
  },
  suggest: () => (editingRegion ? suggestRegionName(editingRegion.kind) : ''),
  onRemove: () => {
    if (!editingRegion) return;
    const region = editingRegion;
    if (writtenLabels.includes(region)) {
      writtenLabels = writtenLabels.filter((label) => label !== region);
      status.textContent = 'Nome excluído.';
    } else {
      regionNames = nameRegion(regionNames, region, '', GRID_W);
      status.textContent = 'Nome excluído. "Restaurar nomes" traz de volta os que foram excluídos.';
    }
    closeRegionMenu();
    redrawOverlay();
  },
});

function randomSeed(): string {
  return Math.random().toString(36).slice(2, 8);
}

/** The region labels to show: the user's names applied, moved clear of structures, or none when switched off. */
function layoutRegions(): Region[] {
  $<HTMLButtonElement>('restore-regions').disabled = !regionNames.some((chosen) => chosen.name === '');
  shownSources = [];
  if (!showRegions) return [];
  // An empty name means the user took that region's name off the map.
  const named = applyRegionNames(foundRegions, regionNames, GRID_W);
  const kept = named.map((_, index) => index).filter((index) => named[index].name !== '');
  shownSources = [...writtenLabels, ...kept.map((index) => foundRegions[index])];
  // Names the user wrote stay exactly where they were put; the found ones move out of their way.
  const written = writtenLabels.map((l) => ({ x: l.x, y: l.y, width: labelWidth(l), height: l.size }));
  return [
    ...writtenLabels,
    ...dodge(
      kept.map((index) => named[index]),
      [...structures.map(structureFootprint), ...written],
    ),
  ];
}

function openRegionMenu(region: Region): void {
  // The user's names are filed under where the region was found, not where its
  // label was moved to.
  editingRegion = shownSources[shownRegions.indexOf(region)] ?? region;
  regionMenu.open(region.name);
  placeMenus();
}

function closeRegionMenu(): void {
  editingRegion = null;
  regionMenu.close();
  if (draftLabel) {
    draftLabel = null;
    saveSoon();
  }
}

/** Everything the user made, in the form it is saved in. */
function snapshot(): Project {
  return {
    version: 1,
    seed: seedInput.value.trim(),
    generated: document.body.dataset.mode === 'map' && currentMap !== null,
    sketch: [...sketch.strokesData],
    hints,
    distribution,
    structures,
    roads: roads.map((road) => [structures.indexOf(road.from), structures.indexOf(road.to)]),
    regionNames,
    labels: writtenLabels.map(({ kind, x, y, name }) => ({ kind, x, y, name })),
    showRegions,
  };
}

/**
 * The part of a saved project the terrain is generated from. Two states with
 * the same key have the same map, so going from one to the other needs no
 * regeneration.
 */
function terrainKey(saved: string): string {
  const { seed, sketch, hints, distribution } = JSON.parse(saved) as Project;
  return JSON.stringify([seed, sketch, hints, distribution]);
}

/** Notes that the project may have changed: shortly after, it is saved and becomes an undo step. */
function saveSoon(): void {
  if (restoring) return;
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(commitChange, SAVE_DELAY);
}

/** Records the project as it is now, as one undo step, and saves it in this browser. */
function commitChange(): void {
  clearTimeout(saveTimer);
  saveTimer = 0;
  if (restoring) return;
  // A stroke still being drawn, or a name still being typed, is half a change: wait for it to finish.
  if (sketch.isDrawing || stroke || draftLabel) {
    saveSoon();
    return;
  }
  const state = serializeProject(snapshot());
  history.record(state);
  refreshUndoButtons();
  persist(state);
}

function persist(state: string): void {
  if (!autosave) return;
  try {
    localStorage.setItem(STORAGE_KEY, state);
  } catch {
    // Storage full or blocked: the map still works, it just will not survive a reload.
  }
}

function refreshUndoButtons(): void {
  for (const id of ['undo', 'undo-map']) $<HTMLButtonElement>(id).disabled = !history.canUndo;
  $<HTMLButtonElement>('redo').disabled = !history.canRedo;
}

/** Goes one change back or forward. Every kind of change is one step. */
async function stepHistory(direction: 'undo' | 'redo'): Promise<void> {
  if (restoring || generateButton.disabled) return;
  // A change made a moment ago must become a step before stepping away from it.
  if (saveTimer) commitChange();
  const state = direction === 'undo' ? history.undo() : history.redo();
  const project = state === null ? null : parseProject(state);
  if (state === null || !project) {
    status.textContent = direction === 'undo' ? 'Nada para desfazer.' : 'Nada para refazer.';
    return;
  }
  await restore(project, false);
  persist(state);
  status.textContent = direction === 'undo' ? 'Desfeito.' : 'Refeito.';
}

/**
 * Replaces everything on screen with a saved project. `fresh` is for opening
 * a project (the view and the undo steps start over); without it the project
 * is a step of the undo history, shown with as little disturbance as possible.
 */
async function restore(project: Project, fresh = true): Promise<void> {
  restoring = true;
  select(null);
  closeRegionMenu();
  // Same sketch, seed and terrain choices as the map on screen: keep the map.
  const sameMap = !fresh && currentMap !== null && terrainKey(serializeProject(project)) === mapKey;
  sketch.load(project.sketch);
  seedInput.value = fresh ? project.seed || randomSeed() : project.seed;
  hints = project.hints;
  distribution = project.distribution;
  structures = project.structures;
  // The routes are found again once the map exists.
  roads = project.roads.map(([from, to]) => ({ from: structures[from], to: structures[to], path: NO_ROUTE }));
  regionNames = project.regionNames;
  writtenLabels = project.labels.map((l) => makeLabel(l.kind, l.x, l.y, l.name, GRID_W));
  showRegions = project.showRegions;
  $('toggle-regions').classList.toggle('active', showRegions);
  if (fresh) {
    currentMap = null;
    mapKey = '';
    foundRegions = [];
    shownRegions = [];
    setMapTool(null);
    zoom.reset();
    status.textContent = '';
  }
  if (!project.generated) {
    setMode('sketch');
  } else if (sameMap) {
    routeRoads();
    setMode('map');
    redrawOverlay();
  } else {
    setMode('sketch');
    await generate();
  }
  restoring = false;
  if (fresh) {
    const state = serializeProject(snapshot());
    history.reset(state);
    persist(state);
  }
  refreshUndoButtons();
}

function emptyProject(): Project {
  return {
    version: 1,
    seed: randomSeed(),
    generated: false,
    sketch: [],
    hints: [],
    distribution: null,
    structures: [],
    roads: [],
    regionNames: [],
    labels: [],
    showRegions: true,
  };
}

/** Writes a new name on the map at the given spot and opens it for the user to type over. */
function writeLabel(x: number, y: number): void {
  if (!currentMap) return;
  // Writing a name while names are hidden would look like nothing happened.
  showRegions = true;
  $('toggle-regions').classList.add('active');
  const kind = regionKindAt(currentMap.biome[Math.floor(y) * GRID_W + Math.floor(x)]);
  const label = makeLabel(kind, x, y, suggestRegionName(kind), GRID_W);
  writtenLabels.push(label);
  draftLabel = label;
  redrawOverlay();
  openRegionMenu(label);
}

function setMode(mode: 'sketch' | 'map'): void {
  document.body.dataset.mode = mode;
}

function setTool(tool: Tool): void {
  sketch.tool = tool;
  for (const [name, button] of Object.entries(toolButtons)) {
    button.classList.toggle('active', name === tool);
  }
}

function setMapTool(tool: MapTool): void {
  mapTool = tool;
  for (const button of paletteButtons) {
    button.classList.toggle('active', button.dataset.tool === tool);
  }
  // The ghost of the structure about to be placed appears once the cursor is over the map.
  ghost.hidden = true;
  if (isStructureKind(tool)) {
    const ctx = ghost.getContext('2d')!;
    ctx.clearRect(0, 0, ghost.width, ghost.height);
    drawStructures(
      ctx,
      [{ kind: tool, x: GHOST_CELLS / 2, y: (GHOST_CELLS * 2) / 3, name: '' }],
      DETAIL_SCALE,
    );
  }
  overlay.classList.toggle('painting', isTerrainKind(tool));
  overlay.classList.toggle('placing', tool !== null && tool !== 'remove' && !isTerrainKind(tool));
  brush.hidden = true;
  overlay.classList.toggle('removing', tool === 'remove');
  redrawOverlay();
}

function isLand(map: MapData, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.w || y >= map.h) return false;
  return map.field[Math.floor(y) * map.w + Math.floor(x)] > 0;
}

function redrawOverlay(): void {
  // Nearly every change to the project ends in a redraw, so this is where it gets saved.
  saveSoon();
  shownRegions = layoutRegions();
  const ctx = overlay.getContext('2d')!;
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  drawRegions(ctx, shownRegions, paintedScale);
  drawRoads(
    ctx,
    roads.map((road) => road.path),
    paintedScale,
  );
  drawStructures(ctx, structures, paintedScale);
  if (selected) drawSelection(ctx, selected, paintedScale);
  if (stroke) drawBrushTrail(ctx, stroke, paintedScale);
}

/** Paints the current map and everything on it at the given resolution. */
function paintMap(scale: number): void {
  if (!currentMap) return;
  renderMap(mapCanvas, currentMap, scale);
  overlay.width = GRID_W * scale;
  overlay.height = GRID_H * scale;
  paintedScale = scale;
  redrawOverlay();
}

/** A zoomed-in map is repainted in more detail, once the zooming settles. */
function sharpenSoon(): void {
  clearTimeout(sharpenTimer);
  sharpenTimer = window.setTimeout(() => {
    const zoomedIn = zoom.scale > SHARPEN_ABOVE && document.body.dataset.mode === 'map';
    if (zoomedIn && paintedScale < DETAIL_SCALE) paintMap(DETAIL_SCALE);
  }, SHARPEN_DELAY);
}

function generate(): Promise<void> {
  if (sketch.isEmpty) {
    status.textContent = 'Desenhe o contorno de pelo menos um continente antes de gerar.';
    return Promise.resolve();
  }
  const seed = seedInput.value.trim() || randomSeed();
  seedInput.value = seed;
  status.textContent = 'Gerando mapa…';
  generateButton.disabled = true;

  // Let the browser paint the status before the heavy work blocks the thread.
  return new Promise((resolve) => {
    setTimeout(() => {
      try {
        const started = performance.now();
        const map = generateMap(sketch.toWallMask(GRID_W, GRID_H), GRID_W, GRID_H, seed, {
          hints,
          distribution,
        });
        if (!map) {
          status.textContent =
            'Não encontrei nenhuma área fechada. Feche o contorno do continente e tente de novo.';
          return;
        }
        currentMap = map;
        mapKey = terrainKey(serializeProject(snapshot()));
        foundRegions = findRegions(map);

        // The coast may have moved; structures left in the sea are dropped.
        const before = structures.length;
        structures = structures.filter((s) => isLand(map, s.x, s.y));
        const lost = before - structures.length;
        roads = roads.filter((road) => structures.includes(road.from) && structures.includes(road.to));
        if (selected && !structures.includes(selected)) select(null);
        // The terrain changed under the roads, so they find their way again.
        const lostRoads = routeRoads();
        // Fast repaint first; the sharp one follows if the user is zoomed in.
        paintMap(VIEW_SCALE);
        distributionPanel.show(map.distribution);
        setMode('map');
        sharpenSoon();

        const seconds = ((performance.now() - started) / 1000).toFixed(1);
        status.textContent =
          `Mapa gerado em ${seconds}s (seed "${seed}", ${map.rivers.length} rios).` +
          (lost ? ` ${lost} estrutura(s) ficaram no mar e foram removidas.` : '') +
          (lostRoads ? ` ${lostRoads} estrada(s) ficaram sem caminho e foram removidas.` : '');
      } finally {
        generateButton.disabled = false;
        resolve();
      }
    }, 30);
  });
}

/** Grid cell under the pointer. */
function cellAt(e: PointerEvent): [number, number] {
  const rect = overlay.getBoundingClientRect();
  return [((e.clientX - rect.left) / rect.width) * GRID_W, ((e.clientY - rect.top) / rect.height) * GRID_H];
}

/** Puts an open menu beside the map position it belongs to, wherever zoom and pan have taken it. */
function placeMenus(): void {
  const frame = $('stage').getBoundingClientRect();
  const rect = overlay.getBoundingClientRect();
  const place = (menu: HTMLElement, x: number, y: number, dx: number, dy: number) => {
    const left = rect.left - frame.left + (x / GRID_W) * rect.width + dx;
    const top = rect.top - frame.top + (y / GRID_H) * rect.height + dy;
    menu.style.left = `${Math.min(Math.max(8, left), frame.width - menu.offsetWidth - 8)}px`;
    menu.style.top = `${Math.min(Math.max(8, top), frame.height - menu.offsetHeight - 8)}px`;
  };
  if (selected && structureMenu.isOpen) place($('structure-menu'), selected.x, selected.y, 16, -30);
  if (editingRegion && regionMenu.isOpen) place($('region-menu'), editingRegion.x, editingRegion.y, -75, 14);
}

/** Selects a structure and opens its menu, or clears the selection with null. */
function select(structure: Structure | null): void {
  selected = structure;
  linkingFrom = null;
  overlay.classList.remove('linking');
  closeRegionMenu();
  if (structure) structureMenu.open(structure.name, structure.kind, roadsOf(structure).length);
  else structureMenu.close();
  placeMenus();
  redrawOverlay();
}

function roadsOf(structure: Structure): Road[] {
  return roads.filter((road) => road.from === structure || road.to === structure);
}

function removeStructure(structure: Structure): void {
  structures = structures.filter((s) => s !== structure);
  roads = roads.filter((road) => road.from !== structure && road.to !== structure);
  if (selected === structure) select(null);
}

/** Routes every road again on the current map. Returns how many no longer have a way through. */
function routeRoads(): number {
  if (!currentMap) return 0;
  const used = new Uint8Array(GRID_W * GRID_H);
  const kept: Road[] = [];
  for (const road of roads) {
    const path = findRoad(currentMap, road.from, road.to, used);
    if (!path) continue;
    markRoad(used, path);
    kept.push({ ...road, path });
  }
  const lost = roads.length - kept.length;
  roads = kept;
  return lost;
}

/** Routes a road between two structures and adds it to the map. Returns null when there is no way by land. */
function buildRoad(from: Structure, to: Structure): Road | null {
  if (!currentMap) return null;
  const used = new Uint8Array(GRID_W * GRID_H);
  for (const road of roads) markRoad(used, road.path);
  const path = findRoad(currentMap, from, to, used);
  if (!path) return null;
  const road: Road = { from, to, path };
  roads.push(road);
  return road;
}

function addRoad(from: Structure, to: Structure): void {
  if (roads.some((r) => (r.from === from && r.to === to) || (r.from === to && r.to === from))) {
    status.textContent = `"${from.name}" e "${to.name}" já estão ligados por estrada.`;
    return;
  }
  const road = buildRoad(from, to);
  if (!road) {
    status.textContent = `Não há caminho por terra entre "${from.name}" e "${to.name}".`;
    return;
  }
  status.textContent = `Estrada criada entre "${from.name}" e "${to.name}".`;
}

/** Links every structure to the others on its landmass, keeping the roads that already exist. */
function connectAll(): void {
  if (!currentMap) return;
  if (structures.length < 2) {
    status.textContent = 'Coloque pelo menos duas estruturas para ligar.';
    return;
  }
  const existing = roads.map((r) => [structures.indexOf(r.from), structures.indexOf(r.to)] as const);
  const built: Road[] = [];
  for (const [a, b] of planNetwork(currentMap, structures, existing)) {
    const road = buildRoad(structures[a], structures[b]);
    if (road) built.push(road);
  }
  if (built.length === 0) {
    status.textContent = 'Tudo o que dá para ligar por terra já está ligado.';
    return;
  }
  status.textContent = `${built.length} estrada(s) criada(s).`;
  redrawOverlay();
}

function onMapPointerDown(e: PointerEvent): void {
  if (!currentMap || e.button !== 0 || generateButton.disabled) return;
  const [x, y] = cellAt(e);
  const structure = structureAt(structures, x, y);

  if (linkingFrom) {
    // Second click of "road to…": another structure ends the road, anything else cancels.
    const from = linkingFrom;
    select(null);
    if (structure && structure !== from) addRoad(from, structure);
    else status.textContent = 'Estrada cancelada.';
  } else if (mapTool === 'remove') {
    const road = structure ? undefined : roads.find((r) => distanceToRoad(r.path, x, y) < ROAD_PICK_DISTANCE);
    const hint = structure || road ? null : hintAt(hints, x, y);
    if (structure) {
      removeStructure(structure);
      status.textContent = `"${structure.name}" removido.`;
    } else if (road) {
      roads = roads.filter((other) => other !== road);
      status.textContent = 'Estrada removida.';
    } else if (hint) {
      hints = hints.filter((other) => other !== hint);
      generate();
    }
  } else if (isTerrainKind(mapTool)) {
    select(null);
    if (!isLand(currentMap, x, y)) {
      status.textContent = 'Clique em terra firme.';
    } else {
      // Start a brush stroke; it is applied when the button is released.
      overlay.setPointerCapture(e.pointerId);
      stroke = [{ kind: mapTool, x, y, radius: brushRadius }];
    }
  } else if (structure) {
    // Clicking a structure selects it; its menu holds what can be done with it.
    select(structure);
  } else {
    select(null);
    if (!mapTool || mapTool === 'label') {
      // With no tool, or with the name tool, clicking a name edits it; the name
      // tool also writes a new one wherever there is none.
      const region = regionAt(shownRegions, x, y);
      if (region) openRegionMenu(region);
      else if (mapTool === 'label') writeLabel(x, y);
      return;
    }
    if (!isLand(currentMap, x, y)) {
      status.textContent = 'Clique em terra firme.';
      return;
    }
    const placed: Structure = { kind: mapTool, x, y, name: suggestName(mapTool) };
    structures.push(placed);
    status.textContent = `"${placed.name}" adicionado. Clique nele para ver as opções.`;
  }
  redrawOverlay();
}
function onMapPointerMove(e: PointerEvent): void {
  const [x, y] = cellAt(e);
  if (isTerrainKind(mapTool)) {
    brush.hidden = false;
    brush.style.left = `${(x / GRID_W) * 100}%`;
    brush.style.top = `${(y / GRID_H) * 100}%`;
    brush.style.borderColor = TERRAIN_COLOR[mapTool];
    // The ring shows the part of the dab where the terrain clearly takes hold.
    brush.style.width = `${((2 * hintCoreRadius({ radius: brushRadius })) / GRID_W) * 100}%`;
  }
  // With a structure in hand its ghost follows the cursor, greyed out over
  // water, and steps aside over a structure that the click would select instead.
  ghost.hidden = !isStructureKind(mapTool) || linkingFrom !== null || structureAt(structures, x, y) !== null;
  ghost.style.left = `${(x / GRID_W) * 100}%`;
  ghost.style.top = `${(y / GRID_H) * 100}%`;
  ghost.classList.toggle('invalid', currentMap !== null && !isLand(currentMap, x, y));
  // Show a hand over what a click would open: a structure's menu or a region's name.
  const opensMenu =
    !isTerrainKind(mapTool) &&
    mapTool !== 'remove' &&
    (structureAt(structures, x, y) !== null ||
      ((mapTool === null || mapTool === 'label') && regionAt(shownRegions, x, y) !== null));
  overlay.classList.toggle('clickable', opensMenu);
  if (!stroke || !currentMap) return;
  const last = stroke[stroke.length - 1];
  if (Math.hypot(x - last.x, y - last.y) < BRUSH_SPACING * brushRadius || !isLand(currentMap, x, y)) return;
  stroke.push({ kind: last.kind, x, y, radius: brushRadius });
  redrawOverlay();
}

/** Applies the finished brush stroke: the map is rebuilt with the same seed. */
function onMapPointerUp(): void {
  if (!stroke) return;
  const painted = stroke;
  stroke = null;
  hints.push(...painted);
  generate();
}

function exportPng(): void {
  if (!currentMap) return;
  const canvas = document.createElement('canvas');
  renderMap(canvas, currentMap, EXPORT_SCALE);
  const ctx = canvas.getContext('2d')!;
  drawRegions(ctx, shownRegions, EXPORT_SCALE);
  drawRoads(
    ctx,
    roads.map((road) => road.path),
    EXPORT_SCALE,
  );
  drawStructures(ctx, structures, EXPORT_SCALE);
  const seed = currentMap.seed;
  canvas.toBlob((blob) => {
    if (!blob) return;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `mapa-${seed}.png`;
    link.click();
    URL.revokeObjectURL(link.href);
  }, 'image/png');
}

toolButtons.pen.addEventListener('click', () => setTool('pen'));
toolButtons.eraser.addEventListener('click', () => setTool('eraser'));
for (const id of ['undo', 'undo-map']) $(id).addEventListener('click', () => stepHistory('undo'));
$('redo').addEventListener('click', () => stepHistory('redo'));
$('clear').addEventListener('click', () => sketch.clear());
$('example').addEventListener('click', () => sketch.loadExample());
$('back').addEventListener('click', () => {
  select(null);
  setMode('sketch');
  status.textContent = '';
});
$('export').addEventListener('click', exportPng);
$('open-distribution').addEventListener('click', () => {
  // Start from what the map has now, discarding slider changes that were cancelled.
  if (currentMap) distributionPanel.show(currentMap.distribution);
  shownDistribution = distributionPanel.values;
  distributionDialog.showModal();
});
$('cancel-distribution').addEventListener('click', () => distributionDialog.close());
$('apply-distribution').addEventListener('click', () => {
  // The sliders show the map as it is, painting included, so only what the user
  // moved is applied: painted areas stay and are not counted twice.
  const edited = distributionPanel.values;
  const next = retarget(distribution, shownDistribution ?? edited, edited);
  distribution = normalizeDistribution(next) && next;
  distributionDialog.close();
  generate();
});
$('reset-distribution').addEventListener('click', () => {
  distribution = null;
  distributionDialog.close();
  generate();
});
$('reroll').addEventListener('click', () => {
  seedInput.value = randomSeed();
  if (document.body.dataset.mode === 'map') generate();
});
generateButton.addEventListener('click', generate);
seedInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') generate();
});
for (const button of paletteButtons) {
  button.addEventListener('click', () => {
    const tool = button.dataset.tool as Exclude<MapTool, null>;
    setMapTool(mapTool === tool ? null : tool);
  });
}
overlay.addEventListener('pointerdown', onMapPointerDown);
overlay.addEventListener('pointermove', onMapPointerMove);
overlay.addEventListener('pointerup', onMapPointerUp);
overlay.addEventListener('pointercancel', onMapPointerUp);
overlay.addEventListener('pointerleave', () => {
  brush.hidden = true;
  ghost.hidden = true;
});
$('connect-all').addEventListener('click', connectAll);
$('clear-hints').addEventListener('click', () => {
  if (hints.length === 0) return;
  hints = [];
  generate();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && (selected || linkingFrom || editingRegion)) {
    if (linkingFrom) status.textContent = 'Estrada cancelada.';
    select(null);
    return;
  }
  // In a text field Ctrl+Z belongs to the typing, not to the map.
  if (!(e.ctrlKey || e.metaKey) || e.target instanceof HTMLInputElement) return;
  const key = e.key.toLowerCase();
  const redo = key === 'y' || (key === 'z' && e.shiftKey);
  if (key !== 'z' && !redo) return;
  e.preventDefault();
  stepHistory(redo ? 'redo' : 'undo');
});

$('toggle-regions').addEventListener('click', () => {
  showRegions = !showRegions;
  $('toggle-regions').classList.toggle('active', showRegions);
  closeRegionMenu();
  redrawOverlay();
});
$('restore-regions').addEventListener('click', () => {
  regionNames = regionNames.filter((chosen) => chosen.name !== '');
  status.textContent = 'Nomes excluídos restaurados.';
  redrawOverlay();
});
const brushSize = $<HTMLInputElement>('brush-size');
brushSize.min = String(MIN_HINT_RADIUS);
brushSize.max = String(MAX_HINT_RADIUS);
brushSize.value = String(brushRadius);
const showBrushSize = () => {
  brushRadius = Number(brushSize.value);
  const share = (brushRadius - MIN_HINT_RADIUS) / (MAX_HINT_RADIUS - MIN_HINT_RADIUS);
  // Drives the filled part of the track in CSS.
  brushSize.style.setProperty('--value', String(share));
  $('brush-size-value').textContent = `${Math.round(share * 100)}%`;
};
brushSize.addEventListener('input', showBrushSize);
showBrushSize();
sketch.onChange = saveSoon;
seedInput.addEventListener('input', saveSoon);

$('save-file').addEventListener('click', () => {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([serializeProject(snapshot())], { type: 'application/json' }));
  link.download = `mapa-${seedInput.value.trim() || 'projeto'}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
});
const fileInput = $<HTMLInputElement>('file-input');
$('open-file').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  // Cleared so that choosing the same file again still counts as a change.
  fileInput.value = '';
  if (!file) return;
  const project = parseProject(await file.text());
  if (!project) {
    status.textContent = `"${file.name}" não é um projeto deste gerador.`;
    return;
  }
  await restore(project);
});
$('new-project').addEventListener('click', () => {
  if (confirm('Apagar o mapa atual e começar um novo?')) restore(emptyProject());
});

seedInput.value = randomSeed();

// ?demo opens straight on a generated example map with a few structures on it;
// ?demo&hints also paints some terrain, and
// ?demo&shares applies a custom terrain distribution.
const params = new URLSearchParams(location.search);
if (!params.has('demo')) {
  // Pick up where the user left off in this browser.
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage blocked: start fresh.
  }
  const project = saved ? parseProject(saved) : null;
  if (project) restore(project);
  else history.reset(serializeProject(snapshot()));
}
if (params.has('demo')) {
  // Setting the demo up is not something to undo: the history starts once it is on screen.
  restoring = true;
  seedInput.value = params.get('demo') || 'demo';
  sketch.loadExample();
  if (params.has('shares')) {
    distribution = {
      shares: { mountains: 25, forest: 35, desert: 10, swamp: 5, plains: 25 },
      snow: 0.45,
    };
  }
  if (params.has('hints')) {
    hints = [
      { kind: 'desert', x: 190, y: 262 },
      { kind: 'forest', x: 185, y: 150 },
      { kind: 'mountains', x: 410, y: 235 },
      { kind: 'snow', x: 270, y: 110 },
      { kind: 'swamp', x: 340, y: 285 },
    ];
  }
  generate().then(() => {
    const samples: [StructureKind, number, number][] = [
      ['kingdom', 292, 228],
      ['city', 178, 135],
      ['village', 350, 278],
      ['tower', 262, 108],
      ['port', 152, 252],
      ['ruins', 405, 212],
      ['dungeon', 318, 168],
      ['village', 545, 92],
    ];
    for (const [kind, x, y] of samples) {
      if (currentMap && isLand(currentMap, x, y)) structures.push({ kind, x, y, name: suggestName(kind) });
    }
    redrawOverlay();
    restoring = false;
    history.reset(serializeProject(snapshot()));
  });
}
