import {
  nextWaterAt,
  feedingAdvice,
  nextFertilizeAt,
  type Env,
  type FeedingAdvice,
  type Species,
} from "@silvae/core";
import type { Weather } from "@silvae/core";
import type { CareEventRow, PlantRow } from "./db";
import { seasonForMonth } from "./weather";

export const DAY = 86_400_000;

/** Weather → per-plant environment. Outdoor plants get live weather; indoor
 *  plants get it moderated to typical indoor conditions (heating/AC). */
export function envForPlant(w: Weather, locationType: PlantRow["locationType"]): Env {
  const outdoor = locationType === "outdoor";
  return {
    tempC: outdoor ? w.tempC : Math.min(28, Math.max(15, w.tempC)),
    rh: outdoor ? w.rh : Math.min(70, Math.max(30, w.rh)),
    uvIndex: outdoor ? w.uvIndex : Math.min(3, w.uvIndex),
    season: seasonForMonth(new Date().getMonth()),
    daylightH: w.daylightHours,
    cloudCover: w.cloudCover,
    precipitationMm: w.precipitationMm,
  };
}

export interface Schedule {
  nextAt: Date;
  intervalDays: number;
  modifiers: { name: string; delta: number }[];
  amountMl?: number;
}

/** Recompute the watering schedule for a plant using its real environment. */
export function computeSchedule(
  plant: PlantRow,
  species: Species | undefined,
  env: Env | undefined,
  lastWaterAt: Date,
): Schedule | undefined {
  if (!species || !env) return undefined;
  const res = nextWaterAt({
    species,
    plant: {
      potType: plant.potType,
      potSizeCm: plant.potSizeCm,
      soilType: plant.soilType,
      locationType: plant.locationType,
    },
    env,
    last: lastWaterAt,
    isOutdoor: plant.locationType === "outdoor",
  });
  return {
    nextAt: res.nextAt,
    intervalDays: res.intervalDays,
    modifiers: res.modifiers,
  };
}

/** Water now: schedule recomputes from this real event, adapting to season/weather. */
export function applyWater(
  row: PlantRow,
  species: Species | undefined,
  env: Env | undefined,
  lastWaterAt: Date,
): PlantRow {
  const schedule = computeSchedule(row, species, env, lastWaterAt);
  return { ...row, nextWaterAt: (schedule?.nextAt ?? new Date()).toISOString() };
}

/** "Still moist" — postpone without faking a watering. The loop learns your drying pace. */
export function applyStillMoist(
  row: PlantRow,
  species: Species | undefined,
  env: Env | undefined,
  lastWaterAt: Date,
): PlantRow {
  const schedule = computeSchedule(row, species, env, lastWaterAt);
  const intervalDays = schedule?.intervalDays ?? species?.ideal.waterIntervalDays ?? 7;
  const from = row.nextWaterAt ? new Date(row.nextWaterAt) : new Date();
  const extendDays = Math.round(intervalDays * 0.3);
  return { ...row, nextWaterAt: addDays(from, extendDays).toISOString() };
}

const addDays = (date: Date, days: number): Date => {
  const out = new Date(date);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
};

export type CareKind = "water" | "fertilize" | "mist";

/** How many days until the next task of a kind, based on its last event. */
export function daysUntil(
  kind: CareKind,
  events: CareEventRow[],
  species: Species | undefined,
  env: Env | undefined,
  plant: PlantRow,
  lastWaterAt: Date,
): number {
  if (kind === "water") {
    const schedule = computeSchedule(plant, species, env, lastWaterAt);
    if (!schedule) return Infinity;
    return Math.ceil((schedule.nextAt.getTime() - Date.now()) / DAY);
  }
  if (!species) return Infinity;
  const intervalDays =
    kind === "fertilize"
      ? species.ideal.fertIntervalDays
      : kind === "mist"
        ? species.ideal.mistIntervalDays
        : Infinity;
  const last = events.find((e) => e.type === kind)?.at;
  if (!last) return 0; // never done it — prompt soon
  const dueAt = new Date(last).getTime() + intervalDays * DAY;
  return Math.ceil((dueAt - Date.now()) / DAY);
}

export interface DueItem {
  plantId: string;
  kind: CareKind;
  days: number;
}

/** Short list of care that is due today or tomorrow (for the Home "Today" strip). */
export function dueItems(
  plants: PlantRow[],
  eventsByPlant: Record<string, CareEventRow[]>,
  speciesBySlugMap: Record<string, Species>,
  env: Env | undefined,
): DueItem[] {
  const items: DueItem[] = [];
  for (const plant of plants) {
    const species = plant.speciesSlug ? speciesBySlugMap[plant.speciesSlug] : undefined;
    const events = eventsByPlant[plant.id] ?? [];
    const lastWaterAt = events.find((e) => e.type === "water")?.at
      ? new Date(events.find((e) => e.type === "water")!.at)
      : plant.plantedAt
        ? new Date(plant.plantedAt)
        : new Date();
    for (const kind of ["water", "fertilize", "mist"] as CareKind[]) {
      if (kind === "mist" && species && species.ideal.mistIntervalDays === 0) continue;
      const days = daysUntil(kind, events, species, env, plant, lastWaterAt);
      if (Number.isFinite(days) && days <= 1) items.push({ plantId: plant.id, kind, days });
    }
  }
  return items.sort((a, b) => a.days - b.days);
}

export function kindLabel(kind: CareKind): string {
  return ({ water: "Water", fertilize: "Fertilize", mist: "Mist" })[kind];
}

export interface FeedingPlan {
  advice: FeedingAdvice;
  /** When feeding is next due; null if never fed (prompt soon). */
  nextAt: Date | null;
  dueInDays: number;
  lastFedAt: Date | null;
}

/** Fertiliser plan for a plant: interval, dose and next due date. */
export function feedingPlan(
  plant: PlantRow,
  species: Species | undefined,
  events: CareEventRow[],
  env: Env | undefined,
): FeedingPlan | undefined {
  if (!species) return undefined;
  const season = env?.season ?? seasonForMonth(new Date().getMonth());
  const advice = feedingAdvice({ species, season, potSizeCm: plant.potSizeCm });
  const lastFed = events.find((e) => e.type === "fertilize")?.at;
  const lastFedAt = lastFed ? new Date(lastFed) : null;
  const nextAt = lastFedAt ? nextFertilizeAt(species, lastFedAt, season) : null;
  return {
    advice,
    lastFedAt,
    nextAt,
    dueInDays: nextAt ? Math.ceil((nextAt.getTime() - Date.now()) / DAY) : 0,
  };
}
