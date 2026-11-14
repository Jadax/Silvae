import { clamp } from "../constants.js";

/** Pot volume in litres from its top diameter (tapered-cylinder approximation). */
export function potVolumeL(potSizeCm: number): number {
  return clamp((Math.PI * potSizeCm ** 3) / 12000, 0.2, 30);
}

/**
 * How much water a thorough watering takes for a pot: roughly a fifth of the
 * pot's volume, which is what soaks the root ball until a little drains out.
 */
export function potWaterMl(potSizeCm: number): number {
  return Math.round(clamp(potVolumeL(potSizeCm) * 1000 * 0.2, 40, 5000) / 10) * 10;
}
