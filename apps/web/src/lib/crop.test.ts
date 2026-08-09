import { describe, expect, it } from "vitest";
import { clampRect, fitDimensions, normalizeRect, pointInRect, translateRect } from "./crop";

describe("fitDimensions", () => {
  it("scales down to fit the box", () => {
    const d = fitDimensions(1290, 2796, 560, 440);
    expect(d.w).toBeLessThanOrEqual(560);
    expect(d.h).toBe(440);
    expect(d.w / d.h).toBeCloseTo(1290 / 2796, 1);
  });
  it("never upscales small images", () => {
    expect(fitDimensions(100, 100, 560, 440)).toEqual({ w: 100, h: 100 });
  });
});

describe("clampRect", () => {
  it("keeps a valid rect as-is", () => {
    expect(clampRect({ x: 10, y: 10, w: 100, h: 100 }, 400, 400)).toEqual({
      x: 10,
      y: 10,
      w: 100,
      h: 100,
    });
  });
  it("clamps out-of-bounds edges", () => {
    expect(clampRect({ x: -10, y: 350, w: 500, h: 100 }, 400, 400)).toEqual({
      x: 0,
      y: 300,
      w: 400,
      h: 100,
    });
  });
  it("enforces a minimum size", () => {
    expect(clampRect({ x: 5, y: 5, w: 10, h: 4 }, 400, 400)).toEqual({ x: 5, y: 5, w: 32, h: 32 });
  });
});

describe("normalizeRect", () => {
  it("is order-independent", () => {
    expect(normalizeRect({ x: 30, y: 20 }, { x: 10, y: 5 })).toEqual({
      x: 10,
      y: 5,
      w: 20,
      h: 15,
    });
    expect(normalizeRect({ x: 10, y: 5 }, { x: 30, y: 20 })).toEqual({
      x: 10,
      y: 5,
      w: 20,
      h: 15,
    });
  });
});

describe("translateRect / pointInRect", () => {
  it("moves a rect", () => {
    expect(translateRect({ x: 1, y: 2, w: 10, h: 10 }, 5, -2)).toEqual({
      x: 6,
      y: 0,
      w: 10,
      h: 10,
    });
  });
  it("tests points inside and outside", () => {
    const r = { x: 10, y: 10, w: 50, h: 50 };
    expect(pointInRect({ x: 30, y: 30 }, r)).toBe(true);
    expect(pointInRect({ x: 10, y: 10 }, r)).toBe(true);
    expect(pointInRect({ x: 9, y: 30 }, r)).toBe(false);
    expect(pointInRect({ x: 60, y: 60 }, r)).toBe(true);
    expect(pointInRect({ x: 61, y: 30 }, r)).toBe(false);
  });
});
