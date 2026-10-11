import type { Region, RegionKind } from '../regions/regions.ts';

interface LabelStyle {
  font: string;
  color: string;
  /** Space added between letters, as a fraction of the font size. */
  spacing: number;
  uppercase: boolean;
  /** Pale outline that keeps the text readable over terrain icons. */
  halo: boolean;
}

const LAND_INK = 'rgba(58, 44, 30, 0.82)';
const WATER_INK = 'rgba(46, 74, 92, 0.78)';
const SERIF = "Georgia, 'Times New Roman', serif";

const STYLE: Record<RegionKind, LabelStyle> = {
  continent: { font: 'bold', color: 'rgba(58, 44, 30, 0.5)', spacing: 0.3, uppercase: true, halo: false },
  island: { font: 'italic', color: LAND_INK, spacing: 0, uppercase: false, halo: true },
  sea: { font: 'italic', color: WATER_INK, spacing: 0.3, uppercase: true, halo: false },
  lake: { font: 'italic', color: WATER_INK, spacing: 0, uppercase: false, halo: false },
  mountains: { font: 'italic bold', color: LAND_INK, spacing: 0.04, uppercase: false, halo: true },
  forest: {
    font: 'italic bold',
    color: 'rgba(50, 70, 36, 0.88)',
    spacing: 0.04,
    uppercase: false,
    halo: true,
  },
  desert: {
    font: 'italic bold',
    color: 'rgba(110, 78, 34, 0.88)',
    spacing: 0.04,
    uppercase: false,
    halo: true,
  },
  swamp: {
    font: 'italic bold',
    color: 'rgba(48, 72, 64, 0.88)',
    spacing: 0.04,
    uppercase: false,
    halo: true,
  },
};

/** Writes the names of the map's regions over it. `scale` is pixels per cell. */
export function drawRegions(ctx: CanvasRenderingContext2D, regions: readonly Region[], scale: number): void {
  ctx.save();
  ctx.scale(scale, scale);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  for (const region of regions) {
    const style = STYLE[region.kind];
    const text = style.uppercase ? region.name.toUpperCase() : region.name;
    ctx.font = `${style.font} ${region.size}px ${SERIF}`;
    // Older browsers lack letter spacing on canvas; the label is just tighter there.
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${region.size * style.spacing}px`;
    if (style.halo) {
      ctx.strokeStyle = 'rgba(236, 221, 182, 0.8)';
      ctx.lineWidth = region.size * 0.28;
      ctx.strokeText(text, region.x, region.y);
    }
    ctx.fillStyle = style.color;
    ctx.fillText(text, region.x, region.y);
  }
  ctx.restore();
}
