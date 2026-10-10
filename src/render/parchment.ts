import { sstep } from '../generator/grid.ts';
import { Biome, type MapData } from '../generator/index.ts';
import { createNoise2D } from '../generator/noise.ts';
import { seededRng, type Rng } from '../generator/rng.ts';

type RGB = readonly [number, number, number];

const PAPER: RGB = [234, 217, 174];
const INK: RGB = [58, 44, 30];
const SHALLOW: RGB = [208, 208, 178];
const DEEP: RGB = [181, 191, 168];
const RIPPLE: RGB = [84, 104, 106];
const FOREST_WASH: RGB = [172, 186, 124];
const SAND_WASH: RGB = [240, 212, 142];
const ROCK_WASH: RGB = [198, 176, 142];
const SNOW_WASH: RGB = [242, 240, 230];
const SHORE_SHADE: RGB = [160, 126, 82];

/** Coastal ripple lines: [distance from coast in cells, half width, opacity]. */
const RIPPLES = [
  [2.6, 0.34, 0.36],
  [5.6, 0.3, 0.24],
  [9.4, 0.28, 0.13],
] as const;

const INK_CSS = 'rgb(58, 44, 30)';
const PAPER_CSS = 'rgb(232, 215, 174)';

/**
 * Paints the map in an aged-parchment style. `scale` is canvas pixels per
 * grid cell, so the same map can be drawn for the screen or for export.
 */
export function renderMap(canvas: HTMLCanvasElement, map: MapData, scale: number): void {
  canvas.width = Math.round(map.w * scale);
  canvas.height = Math.round(map.h * scale);
  const ctx = canvas.getContext('2d')!;

  paintBase(ctx, map, scale);

  // Everything below is drawn in cell units.
  ctx.save();
  ctx.scale(scale, scale);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  drawRivers(ctx, map);
  drawIcons(ctx, map);
  drawCompass(ctx, map);
  drawFrame(ctx, map);
  ctx.restore();
}

/** Per-pixel layer: paper, sea, terrain washes, coastline ink and vignette. */
function paintBase(ctx: CanvasRenderingContext2D, map: MapData, scale: number): void {
  const { w, h, field, elevation, moisture, temperature, hillLevel, mountainLevel } = map;
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const img = ctx.createImageData(W, H);
  const data = img.data;
  const rng = seededRng(map.seed + ':paper');
  const paper = createNoise2D(rng);

  for (let py = 0; py < H; py++) {
    const gy = (py + 0.5) / scale - 0.5;
    const y0 = Math.min(h - 2, Math.max(0, Math.floor(gy)));
    const fy = Math.min(1, Math.max(0, gy - y0));
    for (let px = 0; px < W; px++) {
      const gx = (px + 0.5) / scale - 0.5;
      const x0 = Math.min(w - 2, Math.max(0, Math.floor(gx)));
      const fx = Math.min(1, Math.max(0, gx - x0));
      const i = y0 * w + x0;
      const w00 = (1 - fx) * (1 - fy);
      const w10 = fx * (1 - fy);
      const w01 = (1 - fx) * fy;
      const w11 = fx * fy;
      const sample = (a: Float32Array) => a[i] * w00 + a[i + 1] * w10 + a[i + w] * w01 + a[i + w + 1] * w11;

      const f = sample(field);
      let r: number;
      let g: number;
      let b: number;
      const mix = (c: RGB, t: number) => {
        r += (c[0] - r) * t;
        g += (c[1] - g) * t;
        b += (c[2] - b) * t;
      };

      if (f > 0) {
        [r, g, b] = PAPER;
        const e = sample(elevation);
        const m = sample(moisture);
        const t = sample(temperature);
        const high = sstep(hillLevel, mountainLevel, e);
        mix(FOREST_WASH, 0.6 * sstep(0.46, 0.62, m) * (1 - high));
        mix(SAND_WASH, 0.6 * sstep(0.56, 0.68, t) * sstep(0.48, 0.36, m) * (1 - high));
        mix(ROCK_WASH, 0.55 * high);
        mix(SNOW_WASH, 0.75 * sstep(0.28, 0.16, t));
        mix(SHORE_SHADE, 0.24 * sstep(3.5, 0, f));
      } else {
        const d = -f;
        [r, g, b] = SHALLOW;
        mix(DEEP, sstep(0, 45, d));
        for (const [at, half, alpha] of RIPPLES) {
          mix(RIPPLE, alpha * sstep(half, 0, Math.abs(d - at)));
        }
      }
      mix(INK, 0.92 * sstep(0.75, 0.25, Math.abs(f)));

      // Paper mottling, grain and darkened edges.
      const mottle =
        0.5 * paper(gx / 55, gy / 55) + 0.3 * paper(gx / 14, gy / 14) + 0.2 * paper(gx / 3.1, gy / 3.1);
      const edge = Math.min(gx, w - gx, gy, h - gy) + 12 * paper(gx / 40 + 9, gy / 40);
      const k = (1 + 0.075 * mottle + 0.035 * (rng() - 0.5)) * (0.74 + 0.26 * sstep(0, 55, edge));

      const o = (py * W + px) * 4;
      data[o] = r * k;
      data[o + 1] = g * k;
      data[o + 2] = b * k * (0.94 + 0.06 * sstep(0, 55, edge));
      data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function drawRivers(ctx: CanvasRenderingContext2D, map: MapData): void {
  ctx.strokeStyle = 'rgb(66, 92, 108)';
  for (const { points, widths } of map.rivers) {
    for (let p = 1; p < widths.length; p++) {
      ctx.lineWidth = (widths[p - 1] + widths[p]) / 2;
      ctx.beginPath();
      ctx.moveTo(points[p * 2 - 2], points[p * 2 - 1]);
      ctx.lineTo(points[p * 2], points[p * 2 + 1]);
      ctx.stroke();
    }
  }
}

interface Icon {
  x: number;
  y: number;
  biome: number;
  size: number;
}

function drawIcons(ctx: CanvasRenderingContext2D, map: MapData): void {
  const { w, h, biome, elevation, coastDist, riverDist, mountainLevel } = map;
  const rng = seededRng(map.seed + ':icons');
  const icons: Icon[] = [];

  // Jittered grid: one candidate per `spacing` square, kept if it lands on the
  // right biome and clear of coast and rivers.
  const scatter = (
    kind: number,
    spacing: number,
    chance: number,
    coastGap: number,
    riverGap: number,
    size: (i: number) => number,
  ) => {
    for (let gy = 0; gy < h; gy += spacing) {
      for (let gx = 0; gx < w; gx += spacing) {
        const x = gx + rng() * spacing;
        const y = gy + rng() * spacing;
        const keep = rng() < chance;
        if (!keep || x >= w || y >= h) continue;
        const i = Math.floor(y) * w + Math.floor(x);
        if (biome[i] !== kind || coastDist[i] < coastGap || riverDist[i] < riverGap) continue;
        icons.push({ x, y, biome: kind, size: size(i) });
      }
    }
  };

  scatter(
    Biome.Mountains,
    7.5,
    1,
    3,
    2.5,
    (i) => 6 + 6.5 * sstep(mountainLevel, 1, elevation[i]) + rng() * 1.5,
  );
  scatter(Biome.Hills, 8, 0.85, 2.5, 2, () => 2.2 + rng() * 0.9);
  scatter(Biome.Forest, 3.4, 0.95, 1.5, 1.4, () => 3.1 + rng() * 1);
  scatter(Biome.Taiga, 3.2, 0.95, 1.5, 1.4, () => 3.6 + rng() * 1.1);
  scatter(Biome.Desert, 9, 0.8, 2, 2, () => 2 + rng());
  scatter(Biome.Swamp, 5.5, 0.9, 1.5, 1.5, () => 1.6 + rng() * 0.6);
  scatter(Biome.Plains, 11, 0.45, 2, 1.5, () => 1.2 + rng() * 0.5);
  scatter(Biome.Tundra, 9, 0.6, 2, 1.5, () => 1 + rng() * 0.6);

  // Painter's order: icons lower on the map overlap the ones behind them.
  icons.sort((a, b) => a.y - b.y);
  for (const icon of icons) {
    switch (icon.biome) {
      case Biome.Mountains:
        drawMountain(ctx, icon.x, icon.y, icon.size, rng);
        break;
      case Biome.Hills:
        drawHill(ctx, icon.x, icon.y, icon.size);
        break;
      case Biome.Forest:
        drawTree(ctx, icon.x, icon.y, icon.size);
        break;
      case Biome.Taiga:
        drawPine(ctx, icon.x, icon.y, icon.size);
        break;
      case Biome.Desert:
        drawDune(ctx, icon.x, icon.y, icon.size);
        break;
      case Biome.Swamp:
        drawReeds(ctx, icon.x, icon.y, icon.size, true);
        break;
      case Biome.Plains:
        drawReeds(ctx, icon.x, icon.y, icon.size, false);
        break;
      case Biome.Tundra:
        drawFrost(ctx, icon.x, icon.y, icon.size);
        break;
    }
  }
}

function drawMountain(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rng: Rng): void {
  const half = size * 0.65;
  const peakX = x + (rng() - 0.5) * half * 0.4;
  const peakY = y - size;
  const leftBulge = (rng() - 0.5) * size * 0.14;
  const rightBulge = (rng() - 0.5) * size * 0.14;
  const footX = x + half * 0.2;
  const kneeX = peakX + half * 0.12;
  const kneeY = peakY + size * 0.48;

  const slopes = () => {
    ctx.beginPath();
    ctx.moveTo(x - half, y);
    ctx.quadraticCurveTo((x - half + peakX) / 2 + leftBulge, (y + peakY) / 2 + leftBulge, peakX, peakY);
    ctx.quadraticCurveTo((x + half + peakX) / 2 + rightBulge, (y + peakY) / 2 - rightBulge, x + half, y);
  };

  slopes();
  ctx.fillStyle = PAPER_CSS;
  ctx.fill();

  // Shaded face on the right of the ridge line.
  ctx.beginPath();
  ctx.moveTo(peakX, peakY);
  ctx.quadraticCurveTo((x + half + peakX) / 2 + rightBulge, (y + peakY) / 2 - rightBulge, x + half, y);
  ctx.lineTo(footX, y);
  ctx.lineTo(kneeX, kneeY);
  ctx.closePath();
  ctx.fillStyle = 'rgba(72, 54, 36, 0.3)';
  ctx.fill();

  ctx.strokeStyle = INK_CSS;
  ctx.lineWidth = 0.45;
  slopes();
  ctx.stroke();

  ctx.lineWidth = 0.28;
  ctx.beginPath();
  ctx.moveTo(peakX, peakY);
  ctx.lineTo(kneeX, kneeY);
  ctx.lineTo(footX, y - size * 0.06);
  ctx.stroke();
}

function drawHill(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  const half = size * 1.25;
  ctx.beginPath();
  ctx.moveTo(x - half, y);
  ctx.bezierCurveTo(x - half * 0.5, y - size * 1.35, x + half * 0.5, y - size * 1.35, x + half, y);
  ctx.fillStyle = PAPER_CSS;
  ctx.fill();
  ctx.strokeStyle = INK_CSS;
  ctx.lineWidth = 0.38;
  ctx.stroke();

  ctx.lineWidth = 0.25;
  ctx.beginPath();
  ctx.moveTo(x + half * 0.2, y - size * 0.7);
  ctx.lineTo(x + half * 0.5, y - size * 0.2);
  ctx.moveTo(x + half * 0.45, y - size * 0.62);
  ctx.lineTo(x + half * 0.7, y - size * 0.2);
  ctx.stroke();
}

function drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  const radius = size * 0.38;
  const crownY = y - size * 0.66;
  ctx.strokeStyle = INK_CSS;
  ctx.lineWidth = 0.32;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, crownY);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x, crownY, radius, 0, Math.PI * 2);
  ctx.fillStyle = 'rgb(146, 164, 100)';
  ctx.fill();
  ctx.lineWidth = 0.28;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x, crownY, radius * 0.55, -0.3, 1.5);
  ctx.strokeStyle = 'rgba(58, 44, 30, 0.55)';
  ctx.stroke();
}

function drawPine(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  const half = size * 0.3;
  ctx.strokeStyle = INK_CSS;
  ctx.lineWidth = 0.3;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - size * 0.3);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x - half, y - size * 0.22);
  ctx.lineTo(x, y - size);
  ctx.lineTo(x + half, y - size * 0.22);
  ctx.closePath();
  ctx.fillStyle = 'rgb(112, 136, 102)';
  ctx.fill();
  ctx.lineWidth = 0.26;
  ctx.stroke();
}

function drawDune(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.strokeStyle = 'rgba(112, 82, 44, 0.8)';
  ctx.lineWidth = 0.3;
  ctx.beginPath();
  ctx.moveTo(x - size, y);
  ctx.quadraticCurveTo(x - size * 0.2, y - size * 0.8, x + size, y);
  ctx.stroke();
  ctx.fillStyle = 'rgba(112, 82, 44, 0.7)';
  ctx.fillRect(x + size * 0.5, y + size * 0.5, 0.35, 0.35);
  ctx.fillRect(x - size * 0.4, y + size * 0.8, 0.35, 0.35);
}

function drawReeds(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, wet: boolean): void {
  ctx.strokeStyle = wet ? 'rgba(62, 78, 52, 0.9)' : 'rgba(92, 96, 56, 0.75)';
  ctx.lineWidth = 0.28;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - size * 0.6, y - size * 0.8);
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - size);
  ctx.moveTo(x, y);
  ctx.lineTo(x + size * 0.6, y - size * 0.8);
  ctx.stroke();
  if (wet) {
    ctx.strokeStyle = 'rgba(66, 92, 108, 0.75)';
    ctx.beginPath();
    ctx.moveTo(x - size * 1.1, y + 0.5);
    ctx.lineTo(x + size * 1.1, y + 0.5);
    ctx.stroke();
  }
}

function drawFrost(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.strokeStyle = 'rgba(104, 116, 128, 0.7)';
  ctx.lineWidth = 0.28;
  ctx.beginPath();
  ctx.moveTo(x - size, y);
  ctx.lineTo(x + size, y);
  ctx.moveTo(x - size * 0.2, y + 1);
  ctx.lineTo(x + size * 0.6, y + 1);
  ctx.stroke();
}

/** Compass rose in whichever corner has the least land under it. */
function drawCompass(ctx: CanvasRenderingContext2D, map: MapData): void {
  const { w, h, field } = map;
  const R = 20;
  const margin = 36;
  let best = { x: 0, y: 0, land: Infinity };
  for (const cx of [w - margin, margin]) {
    for (const cy of [h - margin, margin]) {
      let land = 0;
      for (let y = cy - R - 6; y < cy + R + 6; y += 2) {
        for (let x = cx - R - 6; x < cx + R + 6; x += 2) {
          if (field[y * w + x] > 0) land++;
        }
      }
      if (land < best.land) best = { x: cx, y: cy, land };
    }
  }

  ctx.save();
  ctx.translate(best.x, best.y);
  ctx.strokeStyle = INK_CSS;
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.62, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 0.2;
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.54, 0, Math.PI * 2);
  ctx.stroke();

  // Short diagonal points first, so the cardinal points sit on top.
  for (const k of [1, 3, 5, 7, 0, 2, 4, 6]) {
    const angle = (k * Math.PI) / 4;
    const length = k % 2 ? R * 0.56 : R;
    const side = length * 0.2;
    const tipX = Math.sin(angle) * length;
    const tipY = -Math.cos(angle) * length;
    for (const turn of [-1, 1]) {
      const a = angle + (turn * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.sin(a) * side, -Math.cos(a) * side);
      ctx.lineTo(tipX, tipY);
      ctx.closePath();
      ctx.fillStyle = turn < 0 ? INK_CSS : PAPER_CSS;
      ctx.fill();
      ctx.lineWidth = 0.22;
      ctx.stroke();
    }
  }

  ctx.fillStyle = INK_CSS;
  ctx.font = `bold ${R * 0.34}px Georgia, 'Times New Roman', serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('N', 0, -R * 1.1);
  ctx.restore();
}

function drawFrame(ctx: CanvasRenderingContext2D, map: MapData): void {
  ctx.strokeStyle = 'rgba(58, 44, 30, 0.85)';
  ctx.lineWidth = 1;
  ctx.strokeRect(4, 4, map.w - 8, map.h - 8);
  ctx.lineWidth = 0.3;
  ctx.strokeRect(6, 6, map.w - 12, map.h - 12);
}
