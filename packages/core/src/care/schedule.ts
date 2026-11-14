import type { Species } from "../dto/species.js";
import type { Plant } from "../dto/plant.js";
import type { Env } from "../dto/weather.js";
import { POT_TYPES, SOIL_TYPES, clamp } from "../constants.js";

export interface Modifier {
  name: string;
  delta: number;
}

export interface ScheduleResult {
  nextAt: Date;
  intervalDays: number;
  modifiers: Modifier[];
}

export interface ScheduleInput {
  species: Species;
  plant: Pick<Plant, "potType" | "potSizeCm" | "soilType" | "locationType">;
  env: Env;
  last: Date;
  luxEstimate?: number;
  isGrowingSeason?: boolean;
  isOutdoor?: boolean;
}

const GROWING_SEASONS = new Set(["spring", "summer"]);

/** Plants living in water (glass pots) get their water refreshed this often. */
export const WATER_CULTURE_REFRESH_DAYS = 7;

/**
 * Dynamic per-plant watering interval (§10.2).
 * Every modifier is named and exposed in the UI so users trust the number.
 */
export function nextWaterAt(input: ScheduleInput): ScheduleResult {
  // A plant growing in water (a glass vase) isn't watered; its water is
  // refreshed weekly so it stays oxygenated and clean, whatever the weather.
  if (input.plant.potType === "glass") {
    return { intervalDays: WATER_CULTURE_REFRESH_DAYS, nextAt: addDays(input.last, WATER_CULTURE_REFRESH_DAYS), modifiers: [] };
  }

  let d = input.species.ideal.waterIntervalDays;
  const modifiers: Modifier[] = [];
  const push = (name: string, delta: number): void => {
    d *= 1 + delta;
    modifiers.push({ name, delta });
  };

  const lux = input.luxEstimate ?? 1000;
  if (lux > 5000) push("highLight", -0.25);
  else if (lux < 500) push("lowLight", +0.35);

  switch (input.plant.potType) {
    case "terracotta":
      push("terracottaPot", -0.15);
      break;
    case "self-watering":
      push("selfWateringPot", +0.5);
      break;
    default:
      break;
  }
  if (input.plant.soilType === "well-draining") push("wellDrainingSoil", -0.1);
  else if (input.plant.soilType === "retentive") push("retentiveSoil", +0.1);

  // Small pots hold little water and dry out fast; big ones stay damp longer.
  const pot = input.plant.potSizeCm;
  if (pot !== undefined && pot > 0) {
    if (pot < 10) push("smallPot", -0.2);
    else if (pot < 14) push("smallishPot", -0.1);
    else if (pot > 35) push("veryLargePot", +0.25);
    else if (pot > 25) push("largePot", +0.15);
  }

  const { tempC, rh, uvIndex } = input.env;
  if (tempC >= 30) push("heat", -0.25);
  else if (tempC >= 25) push("warm", -0.1);
  else if (tempC < 12) push("cold", +0.2);
  if (rh < 40) push("lowHumidity", -0.15);
  else if (rh > 70) push("highHumidity", +0.15);
  if (uvIndex >= 7) push("strongSun", -0.1);

  const growing = input.isGrowingSeason ?? GROWING_SEASONS.has(input.env.season);
  if (input.species.growth.rate === "FAST" && growing) push("fastGrowth", -0.1);

  const outdoor = input.isOutdoor ?? input.plant.locationType === "outdoor";
  if (outdoor) {
    if (input.env.season === "winter" || input.env.tempC < 5) push("outdoorDormant", +0.25);
    else if (input.env.tempC < 10) push("outdoorCool", +0.1);
  }

  const base = input.species.ideal.waterIntervalDays;
  d = clamp(d, base * 0.5, base * 1.8);
  const intervalDays = round2(d);
  return {
    intervalDays,
    nextAt: addDays(input.last, intervalDays),
    modifiers,
  };
}

export function addDays(date: Date, days: number): Date {
  const out = new Date(date);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

export const round2 = (x: number): number => Math.round(x * 100) / 100;

export { POT_TYPES, SOIL_TYPES };
