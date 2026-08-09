import { loadImage } from "./identify";
import type { Rect } from "./crop";

/**
 * Screenshot chrome stripping (the same trick Pl@ntNet/PictureThis rely on
 * users doing by hand): phone screenshots carry uniform bars — status bar,
 * letterboxing, captions, watermark margins — that confuse identification
 * models. Detect near-flat strips along each edge and drop them so the model
 * only sees the plant.
 */

/** RGBA pixel grid; structural so the core stays testable in node. */
export interface PixelGrid {
  width: number;
  height: number;
  data: Uint8ClampedArray; // length === width * height * 4
}

export interface Trim {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

const MAX_TRIM_FRAC = 0.15; // never eat more than 15% of a side
const FLAT_TOLERANCE = 8; // mean per-channel abs diff at/below this counts as flat
const PROBE_MIN = 3;
const PROBE_MAX = 8;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function at(grid: PixelGrid, x: number, y: number): number {
  return (y * grid.width + x) * 4;
}

type Color = [number, number, number];

function rowMean(grid: PixelGrid, y: number): Color {
  let r = 0;
  let g = 0;
  let b = 0;
  for (let x = 0; x < grid.width; x++) {
    const i = at(grid, x, y);
    r += grid.data[i];
    g += grid.data[i + 1];
    b += grid.data[i + 2];
  }
  const n = grid.width;
  return [r / n, g / n, b / n];
}

function colMean(grid: PixelGrid, x: number): Color {
  let r = 0;
  let g = 0;
  let b = 0;
  for (let y = 0; y < grid.height; y++) {
    const i = at(grid, x, y);
    r += grid.data[i];
    g += grid.data[i + 1];
    b += grid.data[i + 2];
  }
  const n = grid.height;
  return [r / n, g / n, b / n];
}

/** Mean per-channel absolute difference between a row and a reference color. */
function rowDiff(grid: PixelGrid, y: number, ref: Color): number {
  let sum = 0;
  for (let x = 0; x < grid.width; x++) {
    const i = at(grid, x, y);
    sum +=
      Math.abs(grid.data[i] - ref[0]) +
      Math.abs(grid.data[i + 1] - ref[1]) +
      Math.abs(grid.data[i + 2] - ref[2]);
  }
  return sum / (grid.width * 3);
}

function colDiff(grid: PixelGrid, x: number, ref: Color): number {
  let sum = 0;
  for (let y = 0; y < grid.height; y++) {
    const i = at(grid, x, y);
    sum +=
      Math.abs(grid.data[i] - ref[0]) +
      Math.abs(grid.data[i + 1] - ref[1]) +
      Math.abs(grid.data[i + 2] - ref[2]);
  }
  return sum / (grid.height * 3);
}

function meanRows(grid: PixelGrid, y0: number, count: number): Color {
  const r: Color = [0, 0, 0];
  for (let y = y0; y < y0 + count; y++) {
    const m = rowMean(grid, y);
    r[0] += m[0];
    r[1] += m[1];
    r[2] += m[2];
  }
  return [r[0] / count, r[1] / count, r[2] / count];
}

function meanCols(grid: PixelGrid, x0: number, count: number): Color {
  const r: Color = [0, 0, 0];
  for (let x = x0; x < x0 + count; x++) {
    const m = colMean(grid, x);
    r[0] += m[0];
    r[1] += m[1];
    r[2] += m[2];
  }
  return [r[0] / count, r[1] / count, r[2] / count];
}

function detectTop(grid: PixelGrid): number {
  const probe = clamp(Math.round(grid.height * 0.05), PROBE_MIN, PROBE_MAX);
  const ref = meanRows(grid, 0, probe);
  let variance = 0;
  for (let y = 0; y < probe; y++) variance += rowDiff(grid, y, ref);
  if (variance / probe > FLAT_TOLERANCE) return 0;
  const cap = Math.floor(grid.height * MAX_TRIM_FRAC);
  let t = 0;
  while (t < cap && rowDiff(grid, t, ref) <= FLAT_TOLERANCE) t++;
  return t;
}

function detectBottom(grid: PixelGrid): number {
  const probe = clamp(Math.round(grid.height * 0.05), PROBE_MIN, PROBE_MAX);
  const ref = meanRows(grid, grid.height - probe, probe);
  let variance = 0;
  for (let y = grid.height - probe; y < grid.height; y++) variance += rowDiff(grid, y, ref);
  if (variance / probe > FLAT_TOLERANCE) return 0;
  const cap = Math.floor(grid.height * MAX_TRIM_FRAC);
  let t = 0;
  while (t < cap && rowDiff(grid, grid.height - 1 - t, ref) <= FLAT_TOLERANCE) t++;
  return t;
}

function detectLeft(grid: PixelGrid): number {
  const probe = clamp(Math.round(grid.width * 0.05), PROBE_MIN, PROBE_MAX);
  const ref = meanCols(grid, 0, probe);
  let variance = 0;
  for (let x = 0; x < probe; x++) variance += colDiff(grid, x, ref);
  if (variance / probe > FLAT_TOLERANCE) return 0;
  const cap = Math.floor(grid.width * MAX_TRIM_FRAC);
  let t = 0;
  while (t < cap && colDiff(grid, t, ref) <= FLAT_TOLERANCE) t++;
  return t;
}

function detectRight(grid: PixelGrid): number {
  const probe = clamp(Math.round(grid.width * 0.05), PROBE_MIN, PROBE_MAX);
  const ref = meanCols(grid, grid.width - probe, probe);
  let variance = 0;
  for (let x = grid.width - probe; x < grid.width; x++) variance += colDiff(grid, x, ref);
  if (variance / probe > FLAT_TOLERANCE) return 0;
  const cap = Math.floor(grid.width * MAX_TRIM_FRAC);
  let t = 0;
  while (t < cap && colDiff(grid, grid.width - 1 - t, ref) <= FLAT_TOLERANCE) t++;
  return t;
}

export function detectTrim(grid: PixelGrid): Trim {
  // Real plant photos/screenshots are always well above this size.
  if (grid.width < 32 || grid.height < 32) {
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }
  return {
    top: detectTop(grid),
    bottom: detectBottom(grid),
    left: detectLeft(grid),
    right: detectRight(grid),
  };
}

/** Natural-coords rect after stripping uniform borders, or null if none. */
export function trimRect(grid: PixelGrid): Rect | null {
  const t = detectTrim(grid);
  if (t.top + t.bottom + t.left + t.right === 0) return null;
  const w = grid.width - t.left - t.right;
  const h = grid.height - t.top - t.bottom;
  if (w <= 0 || h <= 0) return null;
  return { x: t.left, y: t.top, w, h };
}

/**
 * Detect uniform screenshot borders of a real image file, returning the crop
 * bounds in the file's own pixel coordinates (or null when there is nothing
 * to trim). Detection runs on a small downscale; bounds map back to natural px.
 */
export async function detectTrimBounds(file: File | Blob): Promise<Rect | null> {
  const img = await loadImage(file);
  const maxSide = 512;
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);
  const grid = ctx.getImageData(0, 0, w, h);
  const rect = trimRect(grid);
  if (!rect) return null;
  return {
    x: Math.round(rect.x / scale),
    y: Math.round(rect.y / scale),
    w: Math.round(rect.w / scale),
    h: Math.round(rect.h / scale),
  };
}
