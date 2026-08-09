/** Integer rectangle in natural image coordinates. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Fit an image into a box, never upscaling past its natural size. */
export function fitDimensions(
  naturalW: number,
  naturalH: number,
  maxW: number,
  maxH: number,
): { w: number; h: number } {
  const scale = Math.min(1, maxW / naturalW, maxH / naturalH);
  return {
    w: Math.max(1, Math.round(naturalW * scale)),
    h: Math.max(1, Math.round(naturalH * scale)),
  };
}

/** Clamp a rect into bounds, enforcing a minimum size. */
export function clampRect(r: Rect, maxW: number, maxH: number, min = 32): Rect {
  const w = Math.max(min, Math.min(r.w, maxW));
  const h = Math.max(min, Math.min(r.h, maxH));
  const x = Math.min(Math.max(0, r.x), maxW - w);
  const y = Math.min(Math.max(0, r.y), maxH - h);
  return { x, y, w, h };
}

/** Build a rect from two opposite corners (order independent). */
export function normalizeRect(a: { x: number; y: number }, b: { x: number; y: number }): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
}

export function translateRect(r: Rect, dx: number, dy: number): Rect {
  return { x: r.x + dx, y: r.y + dy, w: r.w, h: r.h };
}

export function pointInRect(p: { x: number; y: number }, r: Rect): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}
