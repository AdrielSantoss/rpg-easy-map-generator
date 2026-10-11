import { IDENTITY, panBy, zoomAt, type ViewTransform } from '../view/transform.ts';

/** Wheel sensitivity: zoom factor is e^(-deltaY * this). */
const WHEEL_SPEED = 0.0015;
/** Pixels per line, for mice that report wheel movement in lines. */
const LINE_HEIGHT = 33;

export interface ZoomOptions {
  /** Whether dragging with the left button should pan right now (it may be drawing instead). */
  canLeftDrag: () => boolean;
  onChange: (view: ViewTransform) => void;
}

/**
 * Mouse-wheel zoom and drag-to-pan for `content` inside `frame`. The middle
 * and right buttons always pan; the left one only when the caller allows it.
 */
export class ZoomController {
  private view = IDENTITY;
  private content: HTMLElement;
  private onChange: (view: ViewTransform) => void;

  constructor(frame: HTMLElement, content: HTMLElement, { canLeftDrag, onChange }: ZoomOptions) {
    this.content = content;
    this.onChange = onChange;

    frame.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const rect = frame.getBoundingClientRect();
        const delta = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? e.deltaY * LINE_HEIGHT : e.deltaY;
        this.set(
          zoomAt(
            this.view,
            (e.clientX - rect.left) / rect.width,
            (e.clientY - rect.top) / rect.height,
            Math.exp(-delta * WHEEL_SPEED),
          ),
        );
      },
      { passive: false },
    );

    let drag: { pointer: number; x: number; y: number } | null = null;
    // Capture phase, so a pan never also reaches the drawing or placing handlers.
    frame.addEventListener(
      'pointerdown',
      (e) => {
        const pans = e.button === 1 || e.button === 2 || (e.button === 0 && canLeftDrag());
        if (!pans || this.view.scale === 1) return;
        e.preventDefault();
        e.stopPropagation();
        frame.setPointerCapture(e.pointerId);
        frame.classList.add('panning');
        drag = { pointer: e.pointerId, x: e.clientX, y: e.clientY };
      },
      { capture: true },
    );
    frame.addEventListener('pointermove', (e) => {
      if (drag?.pointer !== e.pointerId) return;
      const rect = frame.getBoundingClientRect();
      this.set(panBy(this.view, (e.clientX - drag.x) / rect.width, (e.clientY - drag.y) / rect.height));
      drag.x = e.clientX;
      drag.y = e.clientY;
    });
    const release = (e: PointerEvent) => {
      if (drag?.pointer !== e.pointerId) return;
      drag = null;
      frame.classList.remove('panning');
    };
    frame.addEventListener('pointerup', release);
    frame.addEventListener('pointercancel', release);
    // The right button pans, so it must not open the browser menu.
    frame.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  get scale(): number {
    return this.view.scale;
  }

  reset(): void {
    this.set(IDENTITY);
  }

  private set(view: ViewTransform): void {
    this.view = view;
    this.content.style.transform = `translate(${view.x * 100}%, ${view.y * 100}%) scale(${view.scale})`;
    this.onChange(view);
  }
}
