import { describe, expect, it } from "vitest";
import { detectTrim, trimRect, type PixelGrid } from "./trim";

/** Deterministic PRNG so the noise region is stable across runs. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeGrid(
  w: number,
  h: number,
  paint: (x: number, y: number) => [number, number, number],
): PixelGrid {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = paint(x, y);
      const i = (y * w + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  return { width: w, height: h, data };
}

describe("detectTrim", () => {
  it("strips uniform screenshot bars (status bar + side margin)", () => {
    const rng = mulberry32(7);
    // 40x40 "screenshot": white bar across the top 3 rows and down the left 3 columns,
    // everything else is busy photo noise.
    const grid = makeGrid(40, 40, (x, y) => {
      if (y < 3 || x < 3) return [255, 255, 255];
      return [Math.floor(rng() * 256), Math.floor(rng() * 256), Math.floor(rng() * 256)];
    });
    expect(detectTrim(grid)).toEqual({ top: 3, bottom: 0, left: 3, right: 0 });
    expect(trimRect(grid)).toEqual({ x: 3, y: 3, w: 37, h: 37 });
  });

  it("leaves a full-bleed photo untouched", () => {
    const rng = mulberry32(99);
    const grid = makeGrid(64, 64, () => [
      Math.floor(rng() * 256),
      Math.floor(rng() * 256),
      Math.floor(rng() * 256),
    ]);
    expect(trimRect(grid)).toBeNull();
  });

  it("never trims more than 15% of a side", () => {
    // 100x100, top 40 rows a flat white margin → capped at 15 rows.
    const rng = mulberry32(3);
    const grid = makeGrid(100, 100, (_x, y) => {
      if (y < 40) return [255, 255, 255];
      return [Math.floor(rng() * 256), Math.floor(rng() * 256), Math.floor(rng() * 256)];
    });
    const t = detectTrim(grid);
    expect(t.top).toBe(15);
    expect(t.bottom).toBe(0);
  });

  it("returns all zeros for a tiny image", () => {
    const grid = makeGrid(8, 8, () => [255, 255, 255]);
    expect(detectTrim(grid)).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
  });
});
