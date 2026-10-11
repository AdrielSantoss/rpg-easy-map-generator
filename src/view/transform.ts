/**
 * Zoom and pan of the map inside its frame. Positions are fractions of the
 * frame size (0..1), so a transform stays valid when the window is resized.
 * A content point `p` appears at `p * scale + offset`.
 */
export interface ViewTransform {
  scale: number;
  x: number;
  y: number;
}

export const IDENTITY: ViewTransform = { scale: 1, x: 0, y: 0 };
export const MAX_ZOOM = 8;

/** Keeps the zoom within limits and the content covering the whole frame. */
export function clampView(view: ViewTransform): ViewTransform {
  const scale = Math.min(MAX_ZOOM, Math.max(1, view.scale));
  const limit = (offset: number) => Math.min(0, Math.max(1 - scale, offset));
  return { scale, x: limit(view.x), y: limit(view.y) };
}

/** Zooms by `factor` keeping the content under the frame point (px, py) in place. */
export function zoomAt(view: ViewTransform, px: number, py: number, factor: number): ViewTransform {
  const scale = Math.min(MAX_ZOOM, Math.max(1, view.scale * factor));
  const k = scale / view.scale;
  return clampView({ scale, x: px - (px - view.x) * k, y: py - (py - view.y) * k });
}

/** Moves the content by (dx, dy), stopping at its edges. */
export function panBy(view: ViewTransform, dx: number, dy: number): ViewTransform {
  return clampView({ scale: view.scale, x: view.x + dx, y: view.y + dy });
}
