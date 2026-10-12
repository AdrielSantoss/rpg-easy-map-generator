import { TILE, type Building, type BuildingKind, type Prop, type Site, type Wall } from '../site/generate.ts';
import type { SiteTerrain } from '../site/context.ts';
import type { StructureKind } from '../structures/model.ts';

export interface SiteView {
  /** Pixels per square. */
  cellPx: number;
  grid: boolean;
  /** Numbers on the notable places and names along the main streets. */
  labels: boolean;
  /** Writes the name of each place on the map itself, where otherwise its number goes. */
  names: boolean;
  /** The list of places by number, on a strip of parchment beside the map. */
  legend: boolean;
}

export const SITE_LABEL: Record<StructureKind, string> = {
  kingdom: 'Capital do reino',
  city: 'Cidade',
  village: 'Vila',
  tower: 'Torre',
  port: 'Porto',
  ruins: 'Ruínas',
  dungeon: 'Masmorra',
};

const INK = '#2b2118';
const PAPER = '#ecdfbd';
const SERIF = "Georgia, 'Times New Roman', serif";
/** Width of the legend, in squares. */
const LEGEND_CELLS = 15;

/** A number from 0 to 1 that is always the same for the same cell, to vary what is drawn there. */
const hash = (x: number, y: number, salt = 0): number => {
  const value = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453;
  return value - Math.floor(value);
};

/** How each terrain looks: its open ground, what is scattered on it, its water, its dirt roads and its trees. */
const LAND: Record<
  SiteTerrain,
  { ground: string; speck: string; water: string; road: string; tree: string; crown: string }
> = {
  plains: {
    ground: '#8fa25c',
    speck: 'rgba(60, 90, 40, 0.35)',
    water: '#5d8fb0',
    road: '#c8b184',
    tree: '#44703a',
    crown: 'rgba(150, 190, 100, 0.45)',
  },
  forest: {
    ground: '#7a9652',
    speck: 'rgba(45, 75, 35, 0.4)',
    water: '#5d8fb0',
    road: '#bfa87c',
    tree: '#3c6a35',
    crown: 'rgba(140, 185, 95, 0.45)',
  },
  taiga: {
    ground: '#7f9274',
    speck: 'rgba(45, 70, 55, 0.4)',
    water: '#5b88a8',
    road: '#b9a887',
    tree: '#2c5a45',
    crown: 'rgba(120, 165, 140, 0.4)',
  },
  desert: {
    ground: '#dcc88d',
    speck: 'rgba(150, 120, 60, 0.4)',
    water: '#5fa3b5',
    road: '#b99866',
    tree: '#7f8c46',
    crown: 'rgba(190, 200, 120, 0.45)',
  },
  swamp: {
    ground: '#6f7d50',
    speck: 'rgba(40, 55, 30, 0.45)',
    water: '#55705f',
    road: '#a8946c',
    tree: '#4a6238',
    crown: 'rgba(130, 150, 90, 0.4)',
  },
  hills: {
    ground: '#9aa166',
    speck: 'rgba(85, 90, 50, 0.4)',
    water: '#5d8fb0',
    road: '#c2ab80',
    tree: '#4a7040',
    crown: 'rgba(150, 190, 100, 0.45)',
  },
  mountain: {
    ground: '#a39c8e',
    speck: 'rgba(70, 66, 60, 0.4)',
    water: '#5a86a6',
    road: '#bba88a',
    tree: '#3d6048',
    crown: 'rgba(130, 170, 130, 0.4)',
  },
  snow: {
    ground: '#e6ecef',
    speck: 'rgba(150, 175, 195, 0.5)',
    water: '#9cc2d6',
    road: '#b9ab94',
    tree: '#35604c',
    crown: 'rgba(255, 255, 255, 0.85)',
  },
};

/** Roof colors by kind; houses pick among theirs by tone. */
const ROOF: Partial<Record<BuildingKind, readonly string[]>> = {
  house: ['#a8553a', '#9c6b3f', '#8a5a44', '#b06a45', '#7c6f66'],
  tavern: ['#c08a2e'],
  inn: ['#b5722f'],
  temple: ['#5b6f95'],
  smithy: ['#55504c'],
  hall: ['#8c2f2f'],
  guild: ['#6b4a8a'],
  barracks: ['#5f6b55'],
  stable: ['#a8925a'],
  mill: ['#c2a868'],
  warehouse: ['#7a6a58'],
  harbor: ['#3f6f7a'],
  shipyard: ['#6a5a48'],
  academy: ['#3d5a9a'],
};

const STALLS = ['#b8443a', '#3f6fa8', '#c79a2e', '#4f8a56'];

function shade(color: string, amount: number): string {
  const value = parseInt(color.slice(1), 16);
  const channel = (shift: number) => {
    const c = (value >> shift) & 255;
    return Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount);
  };
  return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`;
}

function ground(ctx: CanvasRenderingContext2D, site: Site, px: number): void {
  const { w, h, tiles } = site;
  const paved = site.kind === 'city' || site.kind === 'kingdom' || site.kind === 'port';
  const land = LAND[site.terrain];
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : tiles[y * w + x]);
  const base: Record<number, string> = {
    [TILE.grass]: land.ground,
    [TILE.road]: paved ? '#bdb4a2' : land.road,
    [TILE.water]: site.kind === 'dungeon' ? '#5d8fb0' : land.water,
    [TILE.plaza]: '#cbc2b0',
    [TILE.field]: '#b9a653',
    [TILE.bridge]: '#8f6f48',
    [TILE.pier]: '#8f6f48',
    [TILE.yard]: '#bda982',
    [TILE.floor]: '#cdc2aa',
    [TILE.rock]: '#3a332d',
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tile = at(x, y);
      // Every square a touch lighter or darker than the next, so that no surface is flat.
      ctx.fillStyle = shade(base[tile], (hash(x, y) - 0.5) * (tile === TILE.rock ? 0.08 : 0.12));
      ctx.fillRect(x * px, y * px, px, px);
      const left = x * px;
      const top = y * px;
      if (tile === TILE.grass) {
        ctx.fillStyle = land.speck;
        for (let i = 0; i < 3; i++) {
          ctx.fillRect(left + hash(x, y, i + 1) * px, top + hash(x, y, i + 5) * px, px * 0.06, px * 0.14);
        }
      } else if (tile === TILE.field) {
        // Furrows.
        ctx.strokeStyle = 'rgba(95, 80, 30, 0.45)';
        ctx.lineWidth = px * 0.07;
        for (let i = 0; i < 3; i++) {
          const offset = top + ((i + 0.5) * px) / 3;
          ctx.beginPath();
          ctx.moveTo(left, offset);
          ctx.lineTo(left + px, offset);
          ctx.stroke();
        }
      } else if (tile === TILE.water) {
        if (hash(x, y, 2) < 0.3) {
          ctx.strokeStyle = 'rgba(230, 245, 255, 0.4)';
          ctx.lineWidth = px * 0.05;
          const rx = left + hash(x, y, 3) * px * 0.5;
          const ry = top + px * (0.3 + hash(x, y, 4) * 0.4);
          ctx.beginPath();
          ctx.moveTo(rx, ry);
          ctx.quadraticCurveTo(rx + px * 0.2, ry - px * 0.1, rx + px * 0.45, ry);
          ctx.stroke();
        }
      } else if (tile === TILE.plaza || (tile === TILE.road && paved) || tile === TILE.floor) {
        // Paving stones.
        ctx.fillStyle = 'rgba(70, 60, 45, 0.22)';
        for (let i = 0; i < 4; i++) {
          ctx.fillRect(
            left + hash(x, y, i + 1) * px * 0.9,
            top + hash(x, y, i + 6) * px * 0.9,
            px * 0.1,
            px * 0.07,
          );
        }
      } else if (tile === TILE.bridge || tile === TILE.pier) {
        // Planks, across the way one walks.
        const across = at(x - 1, y) === TILE.water || at(x + 1, y) === TILE.water;
        ctx.strokeStyle = 'rgba(50, 34, 18, 0.55)';
        ctx.lineWidth = px * 0.05;
        for (let i = 1; i < 4; i++) {
          ctx.beginPath();
          if (across) {
            ctx.moveTo(left, top + (i * px) / 4);
            ctx.lineTo(left + px, top + (i * px) / 4);
          } else {
            ctx.moveTo(left + (i * px) / 4, top);
            ctx.lineTo(left + (i * px) / 4, top + px);
          }
          ctx.stroke();
        }
      } else if (tile === TILE.rock) {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)';
        ctx.lineWidth = px * 0.05;
        ctx.beginPath();
        ctx.moveTo(left + px * 0.15, top + px * 0.85);
        ctx.lineTo(left + px * 0.85, top + px * 0.15);
        ctx.stroke();
      }
    }
  }

  // Where one kind of ground meets another, an edge: a bank, a kerb, a wall of rock.
  const edge = (tile: number, other: number): [string, number] | null => {
    if (tile === other || other === -1) return null;
    if (tile === TILE.floor || tile === TILE.water) {
      if (other === TILE.rock) return [INK, 0.22];
    }
    if (tile === TILE.water && other !== TILE.bridge && other !== TILE.pier)
      return ['rgba(40, 70, 95, 0.8)', 0.1];
    if ((tile === TILE.bridge || tile === TILE.pier) && other === TILE.water)
      return ['rgba(50, 34, 18, 0.9)', 0.12];
    if (tile === TILE.road && (other === TILE.grass || other === TILE.field))
      return ['rgba(90, 72, 45, 0.5)', 0.07];
    if (tile === TILE.plaza && other === TILE.grass) return ['rgba(90, 80, 65, 0.6)', 0.08];
    if (tile === TILE.field && other === TILE.grass) return ['rgba(80, 70, 30, 0.5)', 0.06];
    if (tile === TILE.yard && other !== TILE.road) return ['rgba(80, 65, 40, 0.4)', 0.06];
    return null;
  };
  ctx.lineCap = 'round';
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tile = at(x, y);
      for (const [dx, dy] of [
        [1, 0],
        [0, 1],
        [-1, 0],
        [0, -1],
      ]) {
        const found = edge(tile, at(x + dx, y + dy));
        if (!found) continue;
        ctx.strokeStyle = found[0];
        ctx.lineWidth = px * found[1];
        ctx.beginPath();
        const x0 = (x + (dx === 1 ? 1 : 0)) * px;
        const y0 = (y + (dy === 1 ? 1 : 0)) * px;
        ctx.moveTo(x0, y0);
        ctx.lineTo(x0 + (dx === 0 ? px : 0), y0 + (dy === 0 ? px : 0));
        ctx.stroke();
      }
    }
  }
}

function grid(ctx: CanvasRenderingContext2D, site: Site, px: number): void {
  ctx.strokeStyle = site.kind === 'dungeon' ? 'rgba(40, 30, 20, 0.28)' : 'rgba(30, 25, 15, 0.16)';
  ctx.lineWidth = Math.max(1, px * 0.03);
  ctx.beginPath();
  for (let x = 0; x <= site.w; x++) {
    ctx.moveTo(x * px, 0);
    ctx.lineTo(x * px, site.h * px);
  }
  for (let y = 0; y <= site.h; y++) {
    ctx.moveTo(0, y * px);
    ctx.lineTo(site.w * px, y * px);
  }
  ctx.stroke();
}

const ROUND: readonly BuildingKind[] = ['tower', 'lighthouse', 'well'];

function drawBuilding(ctx: CanvasRenderingContext2D, b: Building, px: number, shadow: boolean): void {
  const inset = px * (b.kind === 'stall' ? 0.14 : 0.12);
  const x = b.x * px + inset;
  const y = b.y * px + inset;
  const w = b.w * px - inset * 2;
  const h = b.h * px - inset * 2;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const round = ROUND.includes(b.kind);
  if (shadow) {
    if (b.kind === 'stairs' || b.ruined) return;
    const reach = px * (b.kind === 'tower' || b.kind === 'keep' || b.kind === 'lighthouse' ? 0.5 : 0.28);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    if (round) ctx.arc(cx + reach, cy + reach, w / 2, 0, Math.PI * 2);
    else ctx.rect(x + reach, y + reach, w, h);
    ctx.fill();
    return;
  }
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = px * 0.09;

  if (b.kind === 'stairs') {
    ctx.strokeStyle = 'rgba(40, 30, 20, 0.8)';
    ctx.lineWidth = px * 0.06;
    for (let i = 0; i <= 6; i++) {
      const sx = b.x * px + (i * b.w * px) / 6;
      ctx.beginPath();
      ctx.moveTo(sx, b.y * px + px * (0.1 + i * 0.05));
      ctx.lineTo(sx, (b.y + 1) * px - px * (0.1 + i * 0.05));
      ctx.stroke();
    }
    return;
  }
  if (b.ruined) {
    // No roof left: a floor of earth and rubble inside what remains of the walls.
    ctx.fillStyle = 'rgba(96, 84, 62, 0.75)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(60, 54, 46, 0.9)';
    for (let i = 0; i < b.w * b.h * 2; i++) {
      ctx.fillRect(x + hash(b.x, b.y, i) * w * 0.9, y + hash(b.y, b.x, i + 9) * h * 0.9, px * 0.13, px * 0.1);
    }
    ctx.strokeStyle = '#5f5a52';
    ctx.lineWidth = px * 0.16;
    ctx.lineCap = 'butt';
    ctx.setLineDash([px * (0.5 + b.tone * 0.6), px * (0.25 + b.tone * 0.3)]);
    ctx.lineDashOffset = b.tone * px * 2;
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
    return;
  }
  if (b.kind === 'well') {
    ctx.fillStyle = '#8d8983';
    ctx.beginPath();
    ctx.arc(cx, cy, w * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#35566d';
    ctx.beginPath();
    ctx.arc(cx, cy, w * 0.22, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (b.kind === 'tower' || b.kind === 'lighthouse') {
    const radius = w / 2;
    const stone = ctx.createRadialGradient(
      cx - radius * 0.3,
      cy - radius * 0.3,
      radius * 0.1,
      cx,
      cy,
      radius,
    );
    stone.addColorStop(0, b.kind === 'tower' ? '#b9b5ad' : '#f1ece0');
    stone.addColorStop(1, b.kind === 'tower' ? '#7d7972' : '#b9b2a2');
    ctx.fillStyle = stone;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Battlements around the top, and the roof inside them.
    ctx.setLineDash([px * 0.22, px * 0.16]);
    ctx.lineWidth = px * 0.12;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.86, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = px * 0.07;
    ctx.fillStyle = b.kind === 'tower' ? '#4d5f8f' : '#b8443a';
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.62, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = b.kind === 'tower' ? '#2f3a5c' : '#ffe9a0';
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.16, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (b.kind === 'stall') {
    // A striped awning.
    const color = STALLS[Math.floor(b.tone * STALLS.length)];
    ctx.fillStyle = '#efe6d2';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    for (let i = 0; i < 4; i += 2) ctx.fillRect(x + (i * w) / 4, y, w / 4, h);
    ctx.lineWidth = px * 0.06;
    ctx.strokeRect(x, y, w, h);
    return;
  }
  if (b.kind === 'keep') {
    ctx.fillStyle = '#9a968f';
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = '#7f7b74';
    ctx.fillRect(x + px * 0.5, y + px * 0.5, w - px, h - px);
    ctx.lineWidth = px * 0.05;
    ctx.strokeRect(x + px * 0.5, y + px * 0.5, w - px, h - px);
    ctx.setLineDash([px * 0.25, px * 0.2]);
    ctx.lineWidth = px * 0.12;
    ctx.strokeRect(x + px * 0.22, y + px * 0.22, w - px * 0.44, h - px * 0.44);
    ctx.setLineDash([]);
    for (const [tx, ty] of [
      [x, y],
      [x + w, y],
      [x, y + h],
      [x + w, y + h],
    ]) {
      ctx.fillStyle = '#aaa69e';
      ctx.lineWidth = px * 0.09;
      ctx.beginPath();
      ctx.arc(tx, ty, px * 0.85, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#4d5f8f';
      ctx.beginPath();
      ctx.arc(tx, ty, px * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  // A pitched roof: one slope in the light, the other in shade, the ridge between.
  const colors = ROOF[b.kind] ?? ROOF.house!;
  const color = colors[Math.floor(b.tone * colors.length) % colors.length];
  ctx.fillStyle = shade(color, 0.14);
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = shade(color, -0.16);
  if (b.vertical) ctx.fillRect(cx, y, w / 2, h);
  else ctx.fillRect(x, cy, w, h / 2);
  // Rows of tiles, faintly.
  ctx.strokeStyle = 'rgba(30, 18, 10, 0.2)';
  ctx.lineWidth = px * 0.04;
  ctx.beginPath();
  const rows = Math.max(2, Math.round((b.vertical ? h : w) / (px * 0.5)));
  for (let i = 1; i < rows; i++) {
    if (b.vertical) {
      ctx.moveTo(x, y + (i * h) / rows);
      ctx.lineTo(x + w, y + (i * h) / rows);
    } else {
      ctx.moveTo(x + (i * w) / rows, y);
      ctx.lineTo(x + (i * w) / rows, y + h);
    }
  }
  ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.lineWidth = px * 0.09;
  ctx.strokeRect(x, y, w, h);
  ctx.lineWidth = px * 0.06;
  ctx.beginPath();
  if (b.vertical) {
    ctx.moveTo(cx, y);
    ctx.lineTo(cx, y + h);
  } else {
    ctx.moveTo(x, cy);
    ctx.lineTo(x + w, cy);
  }
  ctx.stroke();
  // A chimney: always where there is a trade with a fire, and on about half the houses.
  if (
    b.kind === 'smithy' ||
    b.kind === 'tavern' ||
    b.kind === 'inn' ||
    (b.kind === 'house' && (b.tone * 13) % 1 < 0.5)
  ) {
    // A chimney.
    ctx.fillStyle = '#5a534c';
    ctx.fillRect(x + w * 0.7, y + h * 0.15, px * 0.32, px * 0.32);
    ctx.strokeRect(x + w * 0.7, y + h * 0.15, px * 0.32, px * 0.32);
  }
}

function drawWall(ctx: CanvasRenderingContext2D, wall: Wall, px: number): void {
  const right = wall.x + wall.w - 1;
  const bottom = wall.y + wall.h - 1;
  const open = new Set([...wall.gates, ...wall.gaps].map((cell) => `${cell.x},${cell.y}`));
  // The ring, in order, as a closed path of cells.
  const ring: { x: number; y: number }[] = [];
  for (let x = wall.x; x < right; x++) ring.push({ x, y: wall.y });
  for (let y = wall.y; y < bottom; y++) ring.push({ x: right, y });
  for (let x = right; x > wall.x; x--) ring.push({ x, y: bottom });
  for (let y = bottom; y > wall.y; y--) ring.push({ x: wall.x, y });
  const center = (cell: { x: number; y: number }) => [(cell.x + 0.5) * px, (cell.y + 0.5) * px] as const;
  const stroke = (color: string, width: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'square';
    ctx.beginPath();
    for (const [index, cell] of ring.entries()) {
      const next = ring[(index + 1) % ring.length];
      if (open.has(`${cell.x},${cell.y}`) || open.has(`${next.x},${next.y}`)) continue;
      ctx.moveTo(...center(cell));
      ctx.lineTo(...center(next));
    }
    ctx.stroke();
  };
  ctx.save();
  ctx.translate(px * 0.2, px * 0.2);
  stroke('rgba(0, 0, 0, 0.25)', px * 0.5);
  ctx.restore();
  stroke(INK, px * 0.56);
  stroke('#97938b', px * 0.4);
  ctx.setLineDash([px * 0.22, px * 0.2]);
  stroke('rgba(60, 56, 50, 0.7)', px * 0.14);
  ctx.setLineDash([]);

  // Fallen stretches leave rubble.
  ctx.fillStyle = '#6e6a63';
  for (const gap of wall.gaps) {
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(
        (gap.x + hash(gap.x, gap.y, i) * 0.8) * px,
        (gap.y + hash(gap.y, gap.x, i + 4) * 0.8) * px,
        px * 0.16,
        px * 0.13,
      );
    }
  }
  const turret = (cell: { x: number; y: number }, radius: number) => {
    const [tx, ty] = center(cell);
    ctx.fillStyle = '#a9a59d';
    ctx.strokeStyle = INK;
    ctx.lineWidth = px * 0.09;
    ctx.beginPath();
    ctx.arc(tx, ty, radius * px, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#7f7b74';
    ctx.beginPath();
    ctx.arc(tx, ty, radius * px * 0.55, 0, Math.PI * 2);
    ctx.fill();
  };
  for (const tower of wall.towers) turret(tower, 0.62);
  // A gatehouse: a small tower either side of the opening.
  for (const [index, cell] of ring.entries()) {
    if (open.has(`${cell.x},${cell.y}`)) continue;
    const before = ring[(index + ring.length - 1) % ring.length];
    const after = ring[(index + 1) % ring.length];
    const gate = (other: { x: number; y: number }) =>
      wall.gates.some((g) => g.x === other.x && g.y === other.y);
    if (gate(before) || gate(after)) turret(cell, 0.5);
  }
}

function drawTrees(ctx: CanvasRenderingContext2D, site: Site, px: number): void {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  for (const tree of site.trees) {
    ctx.beginPath();
    ctx.arc((tree.x + 0.18) * px, (tree.y + 0.18) * px, tree.r * px, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const tree of site.trees) {
    const tone = hash(Math.floor(tree.x), Math.floor(tree.y), 7);
    ctx.fillStyle = shade(LAND[site.terrain].tree, (tone - 0.5) * 0.3);
    ctx.strokeStyle = 'rgba(25, 45, 20, 0.9)';
    ctx.lineWidth = px * 0.06;
    ctx.beginPath();
    ctx.arc(tree.x * px, tree.y * px, tree.r * px, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = LAND[site.terrain].crown;
    ctx.beginPath();
    ctx.arc((tree.x - tree.r * 0.25) * px, (tree.y - tree.r * 0.25) * px, tree.r * px * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** The small things standing in the open, each drawn about its own middle. */
function drawProp(ctx: CanvasRenderingContext2D, prop: Prop, px: number, site: Site): void {
  const tone = hash(Math.floor(prop.x * 3), Math.floor(prop.y * 3), 11);
  const land = LAND[site.terrain];
  ctx.save();
  ctx.translate(prop.x * px, prop.y * px);
  ctx.rotate(prop.angle);
  ctx.strokeStyle = INK;
  ctx.lineWidth = px * 0.06;
  ctx.lineJoin = 'round';
  const disc = (x: number, y: number, r: number, fill: string, stroke = true) => {
    ctx.beginPath();
    ctx.arc(x * px, y * px, r * px, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) ctx.stroke();
  };
  const slab = (x: number, y: number, w: number, h: number, fill: string) => {
    ctx.fillStyle = fill;
    ctx.fillRect(x * px, y * px, w * px, h * px);
    ctx.strokeRect(x * px, y * px, w * px, h * px);
  };
  const shadow = (r: number) => disc(0.12, 0.12, r, 'rgba(0, 0, 0, 0.25)', false);
  switch (prop.kind) {
    case 'fountain': {
      shadow(1.3);
      disc(0, 0, 1.3, '#a9a59d');
      disc(0, 0, 1.05, '#6ea2c2');
      // Ripples spreading from the jet in the middle.
      ctx.strokeStyle = 'rgba(235, 248, 255, 0.6)';
      ctx.lineWidth = px * 0.05;
      for (const r of [0.45, 0.75]) {
        ctx.beginPath();
        ctx.arc(0, 0, r * px, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.strokeStyle = INK;
      ctx.lineWidth = px * 0.06;
      disc(0, 0, 0.28, '#c2beb5');
      disc(0, 0, 0.1, '#e8f4fb', false);
      break;
    }
    case 'monument':
      // A figure on a round base of steps, larger than life.
      shadow(1.15);
      disc(0, 0, 1.15, '#a9a59d');
      disc(0, 0, 0.82, '#bdb9b0');
      slab(-0.4, -0.4, 0.8, 0.8, '#9a968f');
      disc(0, 0, 0.27, '#d2cdc0');
      disc(0, -0.03, 0.11, '#e6e1d4', false);
      break;
    case 'statue':
      shadow(0.4);
      slab(-0.34, -0.34, 0.68, 0.68, '#a9a59d');
      disc(0, 0, 0.22, '#d2cdc0');
      disc(0, -0.02, 0.09, '#e6e1d4', false);
      break;
    case 'bench':
      slab(-0.42, -0.14, 0.84, 0.28, '#8f6236');
      ctx.beginPath();
      ctx.moveTo(-0.42 * px, 0);
      ctx.lineTo(0.42 * px, 0);
      ctx.lineWidth = px * 0.03;
      ctx.stroke();
      break;
    case 'lamp': {
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, px * 0.7);
      glow.addColorStop(0, 'rgba(255, 226, 130, 0.55)');
      glow.addColorStop(1, 'rgba(255, 210, 100, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(-px * 0.7, -px * 0.7, px * 1.4, px * 1.4);
      disc(0, 0, 0.13, '#3a332d');
      disc(0, 0, 0.06, '#ffe9a0', false);
      break;
    }
    case 'planter':
      shadow(0.4);
      disc(0, 0, 0.4, '#9a958b');
      disc(0, 0, 0.3, shade(land.tree, (tone - 0.5) * 0.3));
      disc(-0.08, -0.08, 0.13, land.crown, false);
      break;
    case 'bigtree':
      shadow(1.5);
      disc(0, 0, 1.5, shade(land.tree, -0.08));
      disc(-0.3, -0.35, 1, shade(land.tree, 0.08), false);
      disc(-0.5, -0.55, 0.5, land.crown, false);
      disc(0.5, 0.45, 0.35, 'rgba(20, 40, 20, 0.25)', false);
      break;
    case 'cart':
      slab(-0.45, -0.26, 0.9, 0.52, '#96693a');
      ctx.fillStyle = INK;
      for (const [x, y] of [
        [-0.32, -0.36],
        [-0.32, 0.26],
        [0.14, -0.36],
        [0.14, 0.26],
      ]) {
        ctx.fillRect(x * px, y * px, 0.2 * px, 0.1 * px);
      }
      ctx.beginPath();
      ctx.moveTo(0.45 * px, 0);
      ctx.lineTo(0.8 * px, 0);
      ctx.stroke();
      break;
    case 'crates':
      slab(-0.36, -0.3, 0.38, 0.38, '#a57a48');
      slab(0.02, -0.1, 0.34, 0.34, '#8f6236');
      if (tone > 0.4) disc(-0.14, 0.24, 0.17, '#7a5a38');
      break;
    case 'haystack':
      shadow(0.42);
      disc(0, 0, 0.42, '#d6b85a');
      ctx.strokeStyle = 'rgba(120, 90, 30, 0.6)';
      ctx.lineWidth = px * 0.035;
      for (let k = 0; k < 5; k++) {
        const angle = (k * Math.PI * 2) / 5 + tone * 3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(angle) * px * 0.36, Math.sin(angle) * px * 0.36);
        ctx.stroke();
      }
      break;
    case 'tombstone':
      ctx.fillStyle = 'rgba(70, 60, 45, 0.35)';
      ctx.fillRect(-0.16 * px, 0, 0.32 * px, 0.36 * px);
      ctx.beginPath();
      ctx.roundRect(-0.17 * px, -0.3 * px, 0.34 * px, 0.3 * px, [px * 0.14, px * 0.14, 0, 0]);
      ctx.fillStyle = shade('#a9a59d', (tone - 0.5) * 0.3);
      ctx.fill();
      ctx.stroke();
      break;
    case 'bush':
      disc(0.06, 0.06, 0.28, 'rgba(0, 0, 0, 0.2)', false);
      disc(-0.1, 0.04, 0.2, shade(land.tree, 0.12));
      disc(0.12, -0.04, 0.22, shade(land.tree, 0.2));
      disc(0.08, -0.1, 0.08, land.crown, false);
      break;
    case 'flowers': {
      const colors = ['#d8556a', '#e8c545', '#f2f0e6', '#9a6ad0', '#e88a3a'];
      for (let k = 0; k < 6; k++) {
        const x = (hash(prop.x, prop.y, k) - 0.5) * 0.7;
        const y = (hash(prop.y, prop.x, k + 9) - 0.5) * 0.7;
        disc(x, y, 0.09, colors[Math.floor(hash(prop.x + k, prop.y, 5) * colors.length)], false);
        disc(x, y, 0.03, '#5a4a20', false);
      }
      break;
    }
    case 'rubble':
      ctx.fillStyle = '#6e6a63';
      for (let k = 0; k < 5; k++) {
        ctx.fillRect(
          (hash(prop.x, prop.y, k) - 0.5) * 0.8 * px,
          (hash(prop.y, prop.x, k + 4) - 0.5) * 0.8 * px,
          px * (0.12 + hash(prop.x, k, 2) * 0.12),
          px * 0.13,
        );
      }
      break;
  }
  ctx.restore();
}

function drawRocks(ctx: CanvasRenderingContext2D, site: Site, px: number): void {
  for (const rock of site.rocks) {
    const x = rock.x * px;
    const y = rock.y * px;
    const r = rock.r * px;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.ellipse(x + r * 0.3, y + r * 0.3, r, r * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shade('#8f8b84', (hash(Math.floor(rock.x), Math.floor(rock.y), 3) - 0.5) * 0.3);
    ctx.strokeStyle = 'rgba(40, 36, 32, 0.9)';
    ctx.lineWidth = px * 0.06;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.ellipse(x - r * 0.25, y - r * 0.25, r * 0.45, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBoats(ctx: CanvasRenderingContext2D, site: Site, px: number): void {
  for (const boat of site.boats) {
    ctx.save();
    ctx.translate(boat.x * px, boat.y * px);
    if (boat.vertical) ctx.rotate(Math.PI / 2);
    ctx.fillStyle = '#7a5a38';
    ctx.strokeStyle = INK;
    ctx.lineWidth = px * 0.07;
    ctx.beginPath();
    ctx.moveTo(-px * 1.2, 0);
    ctx.quadraticCurveTo(-px * 0.6, -px * 0.5, px * 0.9, -px * 0.4);
    ctx.lineTo(px * 0.9, px * 0.4);
    ctx.quadraticCurveTo(-px * 0.6, px * 0.5, -px * 1.2, 0);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#c9ad7c';
    ctx.fillRect(-px * 0.5, -px * 0.2, px * 1.1, px * 0.4);
    ctx.restore();
  }
}

function drawDoors(ctx: CanvasRenderingContext2D, site: Site, px: number): void {
  ctx.fillStyle = '#8a5a30';
  ctx.strokeStyle = INK;
  ctx.lineWidth = px * 0.06;
  for (const door of site.doors) {
    const long = px * 0.8;
    const short = px * 0.26;
    const w = door.vertical ? long : short;
    const h = door.vertical ? short : long;
    const x = (door.x + 0.5) * px - w / 2;
    const y = (door.y + 0.5) * px - h / 2;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
  }
}

function drawLabels(ctx: CanvasRenderingContext2D, site: Site, px: number, names: boolean): void {
  // Street names, written along the street.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `italic ${Math.round(px * 0.72)}px ${SERIF}`;
  ctx.lineJoin = 'round';
  for (const street of site.streets) {
    ctx.save();
    ctx.translate(street.x * px, street.y * px);
    if (street.vertical) ctx.rotate(-Math.PI / 2);
    ctx.strokeStyle = 'rgba(236, 223, 189, 0.85)';
    ctx.lineWidth = px * 0.22;
    ctx.strokeText(street.name, 0, 0);
    ctx.fillStyle = '#4a3a26';
    ctx.fillText(street.name, 0, 0);
    ctx.restore();
  }
  if (names) {
    drawNames(ctx, site, px);
    return;
  }
  // The number of each notable place, on a disc of parchment.
  const radius = px * 0.68;
  ctx.font = `bold ${Math.round(px * 0.78)}px ${SERIF}`;
  for (const [index, place] of site.places.entries()) {
    ctx.fillStyle = PAPER;
    ctx.strokeStyle = INK;
    ctx.lineWidth = px * 0.1;
    ctx.beginPath();
    ctx.arc(place.x * px, place.y * px, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.fillText(String(index + 1), place.x * px, place.y * px + px * 0.04);
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

/** Splits a long name in two lines of about the same length. */
function twoLines(name: string): string[] {
  if (name.length <= 13 || !name.includes(' ')) return [name];
  const words = name.split(' ');
  let best = [name];
  let bestLength = name.length;
  for (let i = 1; i < words.length; i++) {
    const lines = [words.slice(0, i).join(' '), words.slice(i).join(' ')];
    const length = Math.max(lines[0].length, lines[1].length);
    if (length < bestLength) {
      best = lines;
      bestLength = length;
    }
  }
  return best;
}

/**
 * The name of each notable place on a small banner over it. A banner that
 * would cover another is moved up or down until it is clear.
 */
function drawNames(ctx: CanvasRenderingContext2D, site: Site, px: number): void {
  const size = Math.round(site.kind === 'dungeon' ? px * 0.36 : px * 0.6);
  const lineHeight = size * 1.12;
  const pad = size * 0.4;
  const placed: { x: number; y: number; w: number; h: number }[] = [];
  ctx.font = `bold ${size}px ${SERIF}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const place of site.places) {
    const lines = twoLines(place.name);
    const w = Math.max(...lines.map((line) => ctx.measureText(line).width)) + pad * 2;
    const h = lines.length * lineHeight + pad;
    const x = Math.min(site.w * px - w - 2, Math.max(2, place.x * px - w / 2));
    const home = place.y * px - h / 2;
    let y = home;
    for (const step of [0, -1, 1, -2, 2, -3, 3]) {
      y = Math.min(site.h * px - h - 2, Math.max(2, home + step * (h + 3)));
      const clear = placed.every(
        (other) => x + w < other.x || other.x + other.w < x || y + h < other.y || other.y + other.h < y,
      );
      if (clear) break;
    }
    placed.push({ x, y, w, h });
    ctx.fillStyle = 'rgba(240, 229, 198, 0.92)';
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1, size * 0.09);
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, size * 0.3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = INK;
    for (const [index, line] of lines.entries()) {
      ctx.fillText(line, x + w / 2, y + pad / 2 + lineHeight * (index + 0.5) + size * 0.04);
    }
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

/** A bar five squares long saying how far that is, and an arrow to the north. */
function drawScale(ctx: CanvasRenderingContext2D, site: Site, px: number): void {
  const squares = 5;
  const x = px * 1.2;
  const y = (site.h - 1.3) * px;
  ctx.fillStyle = 'rgba(236, 223, 189, 0.9)';
  ctx.strokeStyle = INK;
  ctx.lineWidth = px * 0.07;
  ctx.beginPath();
  ctx.roundRect(x - px * 0.5, y - px * 1.3, (squares + 3.2) * px, px * 2.1, px * 0.25);
  ctx.fill();
  ctx.stroke();
  for (let i = 0; i < squares; i++) {
    ctx.fillStyle = i % 2 === 0 ? INK : PAPER;
    ctx.fillRect(x + i * px, y, px, px * 0.3);
  }
  ctx.strokeRect(x, y, squares * px, px * 0.3);
  ctx.fillStyle = INK;
  ctx.font = `${Math.round(px * 0.62)}px ${SERIF}`;
  const metres = squares * site.cellMeters;
  ctx.fillText(`${String(metres).replace('.', ',')} m · ${squares} quadrados`, x, y - px * 0.35);
  // North.
  const nx = x + (squares + 1.6) * px;
  ctx.beginPath();
  ctx.moveTo(nx, y - px * 0.95);
  ctx.lineTo(nx + px * 0.38, y + px * 0.3);
  ctx.lineTo(nx, y);
  ctx.lineTo(nx - px * 0.38, y + px * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.font = `bold ${Math.round(px * 0.55)}px ${SERIF}`;
  ctx.textAlign = 'center';
  ctx.fillText('N', nx + px * 0.75, y - px * 0.35);
  ctx.textAlign = 'left';
}

function drawLegend(
  ctx: CanvasRenderingContext2D,
  site: Site,
  px: number,
  x: number,
  width: number,
  numbered: boolean,
): void {
  const height = site.h * px;
  const paper = ctx.createLinearGradient(x, 0, x + width, 0);
  paper.addColorStop(0, '#e3d3aa');
  paper.addColorStop(0.08, PAPER);
  paper.addColorStop(1, '#e6d8b2');
  ctx.fillStyle = paper;
  ctx.fillRect(x, 0, width, height);
  ctx.strokeStyle = INK;
  ctx.lineWidth = px * 0.1;
  ctx.strokeRect(x + px * 0.5, px * 0.5, width - px, height - px);

  const left = x + px * 1.2;
  const room = width - px * 2.4;
  ctx.fillStyle = INK;
  ctx.textBaseline = 'alphabetic';
  // The name, as large as fits on up to two lines.
  let size = px * 1.5;
  let lines: string[] = [];
  for (; size > px * 0.7; size -= px * 0.1) {
    ctx.font = `bold ${Math.round(size)}px ${SERIF}`;
    lines = [];
    let current = '';
    for (const word of site.name.split(' ')) {
      const longer = current ? `${current} ${word}` : word;
      if (current && ctx.measureText(longer).width > room) {
        lines.push(current);
        current = word;
      } else current = longer;
    }
    lines.push(current);
    if (lines.length <= 2 && lines.every((line) => ctx.measureText(line).width <= room)) break;
  }
  let y = px * 2.6;
  for (const line of lines) {
    ctx.fillText(line, left, y);
    y += size * 1.15;
  }
  ctx.font = `italic ${Math.round(px * 0.72)}px ${SERIF}`;
  ctx.fillStyle = '#5a4a38';
  ctx.fillText(SITE_LABEL[site.kind], left, y);
  y += px * 0.95;
  ctx.fillText(`1 quadrado = ${String(site.cellMeters).replace('.', ',')} m`, left, y);
  y += px * 0.6;
  ctx.fillRect(left, y, room, px * 0.06);
  y += px * 1.4;

  // The places, as tall as the strip allows.
  const step = Math.min(px * 1.5, (height - y - px * 1.2) / Math.max(1, site.places.length));
  const text = Math.min(px * 0.82, step * 0.62);
  for (const [index, place] of site.places.entries()) {
    // Without numbers on the map, the legend is a plain list of what there is to find.
    const radius = numbered ? Math.min(px * 0.55, step * 0.42) : -px * 0.25;
    if (numbered) {
      ctx.fillStyle = '#f6eed8';
      ctx.strokeStyle = INK;
      ctx.lineWidth = px * 0.07;
      ctx.beginPath();
      ctx.arc(left + radius, y - text * 0.32, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = INK;
      ctx.textAlign = 'center';
      ctx.font = `bold ${Math.round(radius * 1.15)}px ${SERIF}`;
      ctx.fillText(String(index + 1), left + radius, y - text * 0.32 + radius * 0.4);
      ctx.textAlign = 'left';
    }
    ctx.fillStyle = INK;
    let nameSize = text;
    do {
      ctx.font = `${Math.round(nameSize)}px ${SERIF}`;
      nameSize -= 1;
    } while (ctx.measureText(place.name).width > room - radius * 2 - px * 0.5 && nameSize > 8);
    ctx.fillText(place.name, left + radius * 2 + px * 0.5, y);
    y += step;
  }
}

/**
 * Draws the map of a place seen from above: ground, streets and water first,
 * then shadows, buildings, walls and trees, and last what is written on it.
 */
export function renderSite(canvas: HTMLCanvasElement, site: Site, view: SiteView): void {
  const px = view.cellPx;
  const mapWidth = site.w * px;
  const legendWidth = view.legend ? LEGEND_CELLS * px : 0;
  canvas.width = mapWidth + legendWidth;
  canvas.height = site.h * px;
  const ctx = canvas.getContext('2d')!;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, mapWidth, canvas.height);
  ctx.clip();
  ground(ctx, site, px);
  if (view.grid) grid(ctx, site, px);
  for (const b of site.buildings) drawBuilding(ctx, b, px, true);
  drawBoats(ctx, site, px);
  for (const b of site.buildings) drawBuilding(ctx, b, px, false);
  for (const wall of site.walls) drawWall(ctx, wall, px);
  for (const prop of site.props) drawProp(ctx, prop, px, site);
  drawRocks(ctx, site, px);
  drawTrees(ctx, site, px);
  drawDoors(ctx, site, px);
  if (view.labels) drawLabels(ctx, site, px, view.names);
  drawScale(ctx, site, px);
  ctx.restore();
  if (view.legend) drawLegend(ctx, site, px, mapWidth, legendWidth, view.labels && !view.names);
}
