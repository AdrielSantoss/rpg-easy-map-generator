import type { TerrainDistribution } from './generator/distribution.ts';
import { hintAt, TERRAIN_KINDS, type TerrainHint, type TerrainKind } from './generator/hints.ts';
import { generateMap, type MapData } from './generator/index.ts';
import { drawHintMarkers } from './render/hints.ts';
import { renderMap } from './render/parchment.ts';
import { drawStructures } from './render/structures.ts';
import { structureAt, type Structure, type StructureKind } from './structures/model.ts';
import { suggestName } from './structures/names.ts';
import { DistributionPanel } from './ui/distribution.ts';
import { SketchBoard, type Tool } from './ui/sketch.ts';

/** Simulation grid; the sketch canvas (1200×800) is twice this. */
const GRID_W = 600;
const GRID_H = 400;
const VIEW_SCALE = 2;
const EXPORT_SCALE = 4;

type MapTool = StructureKind | TerrainKind | 'remove' | null;

const isTerrainKind = (tool: MapTool): tool is TerrainKind =>
  (TERRAIN_KINDS as readonly string[]).includes(tool ?? '');

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
let hints: TerrainHint[] = [];
/** Terrain shares the user asked for, in percent; null lets the climate decide. */
let distribution: TerrainDistribution | null = null;
let mapTool: MapTool = null;
/** Undo steps for things placed on the map, most recent last. */
const undoStack: (() => void)[] = [];

overlay.width = GRID_W * VIEW_SCALE;
overlay.height = GRID_H * VIEW_SCALE;

function randomSeed(): string {
  return Math.random().toString(36).slice(2, 8);
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
  overlay.classList.toggle('placing', tool !== null && tool !== 'remove');
  overlay.classList.toggle('removing', tool === 'remove');
  redrawOverlay();
}

function isLand(map: MapData, x: number, y: number): boolean {
  return map.field[Math.floor(y) * map.w + Math.floor(x)] > 0;
}

function redrawOverlay(): void {
  const ctx = overlay.getContext('2d')!;
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  drawStructures(ctx, structures, VIEW_SCALE);
  // Terrain markers are an editing aid: shown only while they can be placed or removed.
  if (isTerrainKind(mapTool) || mapTool === 'remove') drawHintMarkers(ctx, hints, VIEW_SCALE);
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
        renderMap(mapCanvas, map, VIEW_SCALE);

        // The coast may have moved; structures left in the sea are dropped.
        const before = structures.length;
        structures = structures.filter((s) => isLand(map, s.x, s.y));
        const lost = before - structures.length;
        redrawOverlay();
        distributionPanel.show(map.distribution);
        setMode('map');

        const seconds = ((performance.now() - started) / 1000).toFixed(1);
        status.textContent =
          `Mapa gerado em ${seconds}s (seed "${seed}", ${map.rivers.length} rios).` +
          (lost ? ` ${lost} estrutura(s) ficaram no mar e foram removidas.` : '');
      } finally {
        generateButton.disabled = false;
        resolve();
      }
    }, 30);
  });
}

function onMapClick(e: PointerEvent): void {
  if (!currentMap || !mapTool || e.button !== 0 || generateButton.disabled) return;
  const rect = overlay.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * GRID_W;
  const y = ((e.clientY - rect.top) / rect.height) * GRID_H;
  const structure = structureAt(structures, x, y);

  if (mapTool === 'remove') {
    const hint = structure ? null : hintAt(hints, x, y);
    if (structure) {
      structures = structures.filter((s) => s !== structure);
      status.textContent = `"${structure.name}" removido.`;
    } else if (hint) {
      hints = hints.filter((other) => other !== hint);
      generate();
    }
  } else if (!isLand(currentMap, x, y)) {
    status.textContent = 'Clique em terra firme.';
  } else if (isTerrainKind(mapTool)) {
    // The terrain changes, so the map is rebuilt with the same seed.
    const hint: TerrainHint = { kind: mapTool, x, y };
    hints.push(hint);
    undoStack.push(() => {
      hints = hints.filter((other) => other !== hint);
      generate();
    });
    generate();
  } else if (structure) {
    // Clicking an existing structure renames it instead of stacking another on top.
    const name = prompt('Nome da estrutura:', structure.name)?.trim();
    if (name) structure.name = name;
  } else {
    const placed: Structure = { kind: mapTool, x, y, name: suggestName(mapTool) };
    structures.push(placed);
    undoStack.push(() => {
      structures = structures.filter((s) => s !== placed);
    });
    status.textContent = `"${placed.name}" adicionado. Clique nele para renomear.`;
  }
  redrawOverlay();
}
function exportPng(): void {
  if (!currentMap) return;
  const canvas = document.createElement('canvas');
  renderMap(canvas, currentMap, EXPORT_SCALE);
  drawStructures(canvas.getContext('2d')!, structures, EXPORT_SCALE);
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
$('undo').addEventListener('click', () => sketch.undo());
$('clear').addEventListener('click', () => sketch.clear());
$('example').addEventListener('click', () => sketch.loadExample());
$('back').addEventListener('click', () => {
  setMode('sketch');
  status.textContent = '';
});
$('export').addEventListener('click', exportPng);
$('open-distribution').addEventListener('click', () => {
  // Start from what the map has now, discarding slider changes that were cancelled.
  if (currentMap) distributionPanel.show(currentMap.distribution);
  distributionDialog.showModal();
});
$('cancel-distribution').addEventListener('click', () => distributionDialog.close());
$('apply-distribution').addEventListener('click', () => {
  distribution = distributionPanel.values;
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
overlay.addEventListener('pointerdown', onMapClick);
document.addEventListener('keydown', (e) => {
  if (!(e.ctrlKey || e.metaKey) || e.key !== 'z' || e.target === seedInput) return;
  e.preventDefault();
  if (document.body.dataset.mode === 'sketch') {
    sketch.undo();
  } else {
    undoStack.pop()?.();
    redrawOverlay();
  }
});

seedInput.value = randomSeed();

// ?demo opens straight on a generated example map with a few structures on it;
// ?demo&hints also drops some terrain hints and shows their markers, and
// ?demo&shares applies a custom terrain distribution.
const params = new URLSearchParams(location.search);
if (params.has('demo')) {
  seedInput.value = params.get('demo') || 'demo';
  sketch.loadExample();
  if (params.has('shares')) {
    distribution = { mountains: 10, forest: 15, desert: 35, swamp: 5, tundra: 20, plains: 15 };
  }
  if (params.has('hints')) {
    hints = [
      { kind: 'desert', x: 190, y: 262 },
      { kind: 'forest', x: 185, y: 150 },
      { kind: 'mountains', x: 410, y: 235 },
      { kind: 'tundra', x: 270, y: 110 },
      { kind: 'swamp', x: 340, y: 285 },
    ];
    setMapTool('remove');
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
    if (params.has('dialog')) $('open-distribution').click();
  });
}
