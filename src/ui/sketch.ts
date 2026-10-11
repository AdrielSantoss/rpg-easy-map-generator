import type { SketchStroke } from '../project/project.ts';

export type Tool = SketchStroke['tool'];
type Stroke = SketchStroke;

const PEN_WIDTH = 4;
const ERASER_WIDTH = 28;
const INK = '#3a2c1e';

/** The drawing board where the user sketches the continent outlines. */
export class SketchBoard {
  tool: Tool = 'pen';
  /** Called whenever the drawing changes. */
  onChange: () => void = () => {};
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private strokes: Stroke[] = [];
  private current: Stroke | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;

    canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      canvas.setPointerCapture(e.pointerId);
      this.current = { tool: this.tool, points: this.locate(e) };
      this.strokes.push(this.current);
      this.redraw();
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!this.current) return;
      this.current.points.push(...this.locate(e));
      this.redraw();
    });
    const finish = () => {
      this.current = null;
    };
    canvas.addEventListener('pointerup', finish);
    canvas.addEventListener('pointercancel', finish);
  }

  /** The strokes drawn so far, for saving. */
  get strokesData(): readonly SketchStroke[] {
    return this.strokes;
  }

  /** Replaces the drawing with saved strokes. */
  load(strokes: readonly SketchStroke[]): void {
    this.strokes = strokes.map((stroke) => ({ tool: stroke.tool, points: [...stroke.points] }));
    this.redraw();
  }

  get isEmpty(): boolean {
    return !this.strokes.some((s) => s.tool === 'pen');
  }

  undo(): void {
    this.strokes.pop();
    this.redraw();
  }

  clear(): void {
    this.strokes = [];
    this.redraw();
  }

  /** Replaces the sketch with a sample: a continent with a lake and two islands. */
  loadExample(): void {
    const blob = (cx: number, cy: number, radius: (a: number) => number, stretch = 1): Stroke => {
      const points: number[] = [];
      for (let step = 0; step <= 90; step++) {
        const a = (step / 90) * Math.PI * 2;
        const r = radius(a);
        points.push(cx + r * stretch * Math.cos(a), cy + r * Math.sin(a));
      }
      return { tool: 'pen', points };
    };
    this.strokes = [
      blob(
        540,
        410,
        (a) => 200 + 55 * Math.sin(3 * a + 0.5) + 32 * Math.sin(5 * a + 2) + 24 * Math.sin(2 * a),
        1.4,
      ),
      blob(500, 400, (a) => 34 + 8 * Math.sin(2 * a + 1), 1.3),
      blob(1085, 170, (a) => 46 + 10 * Math.sin(3 * a)),
      blob(1075, 655, (a) => 36 + 7 * Math.sin(2 * a + 2)),
    ];
    this.redraw();
  }

  /** Rasterizes the sketch onto a w×h grid: 1 where there is ink. */
  toWallMask(w: number, h: number): Uint8Array {
    const raster = document.createElement('canvas');
    raster.width = w;
    raster.height = h;
    const ctx = raster.getContext('2d', { willReadFrequently: true })!;
    ctx.scale(w / this.canvas.width, h / this.canvas.height);
    this.paint(ctx);
    const alpha = ctx.getImageData(0, 0, w, h).data;
    const mask = new Uint8Array(w * h);
    for (let i = 0; i < mask.length; i++) mask[i] = alpha[i * 4 + 3] > 60 ? 1 : 0;
    return mask;
  }

  private locate(e: PointerEvent): number[] {
    const rect = this.canvas.getBoundingClientRect();
    return [
      ((e.clientX - rect.left) * this.canvas.width) / rect.width,
      ((e.clientY - rect.top) * this.canvas.height) / rect.height,
    ];
  }

  private redraw(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.paint(this.ctx);
    this.onChange();
  }

  private paint(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = INK;
    for (const { tool, points } of this.strokes) {
      ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
      ctx.lineWidth = tool === 'eraser' ? ERASER_WIDTH : PEN_WIDTH;
      ctx.beginPath();
      ctx.moveTo(points[0], points[1]);
      // A single click has no second point; repeating the first one draws a dot.
      for (let p = 0; p < Math.max(points.length, 4); p += 2) {
        ctx.lineTo(points[p % points.length], points[(p + 1) % points.length]);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
}
