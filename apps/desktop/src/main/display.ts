/**
 * Pure display-selection logic for the capture pipeline (unit-testable).
 *
 * Preference order:
 *   1. the display containing (most of) the ArNega overlay,
 *   2. the display containing the pointer,
 *   3. the primary display.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DisplayLike {
  id: number;
  bounds: Rect;
  scaleFactor: number;
}

export interface Point {
  x: number;
  y: number;
}

function overlapArea(a: Rect, b: Rect): number {
  const x = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return x * y;
}

function contains(r: Rect, p: Point): boolean {
  return p.x >= r.x && p.x < r.x + r.width && p.y >= r.y && p.y < r.y + r.height;
}

export function pickTargetDisplay<T extends DisplayLike>(
  displays: T[],
  overlayBounds: Rect | null,
  cursor: Point | null,
): T {
  if (displays.length === 0) {
    throw new Error('No displays available');
  }
  const first = displays[0] as T;
  if (displays.length === 1) return first;

  if (overlayBounds) {
    let best: T | null = null;
    let bestArea = 0;
    for (const d of displays) {
      const area = overlapArea(d.bounds, overlayBounds);
      if (area > bestArea) {
        best = d;
        bestArea = area;
      }
    }
    if (best) return best;
  }

  if (cursor) {
    const withCursor = displays.find((d) => contains(d.bounds, cursor));
    if (withCursor) return withCursor;
  }

  return first;
}

/** Clamp a window rect so at least a usable strip remains on some display. */
export function isRectVisibleOnAnyDisplay(rect: Rect, displays: DisplayLike[]): boolean {
  return displays.some((d) => overlapArea(d.bounds, rect) >= Math.min(120 * 80, rect.width * rect.height));
}
