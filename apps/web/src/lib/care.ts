import {
  addDays,
  feedingAdvice,
  nextFertilizeAt,
  nextWaterAt,
  type CareEventType,
  type Env,
  type FeedingAdvice,
  type Season,
  type Species,
  type Weather,
} from "@silvae/core";
import type { CareEventRow, MyFertilizer, PlantRow } from "./db";
import { currentSeason } from "./weather";

export const DAY = 86_400_000;

/** Weather → per-plant environment. Outdoor plants get live weather; indoor
 *  plants get it moderated to typical indoor conditions (heating/AC). */
export function envForPlant(w: Weather, locationType: PlantRow["locationType"], lat?: number): Env {
  const outdoor = locationType === "outdoor";
  return {
    tempC: outdoor ? w.tempC : Math.min(28, Math.max(15, w.tempC)),
    rh: outdoor ? w.rh : Math.min(70, Math.max(30, w.rh)),
    uvIndex: outdoor ? w.uvIndex : Math.min(3, w.uvIndex),
    season: currentSeason(lat),
    daylightH: w.daylightHours,
    cloudCover: w.cloudCover,
    precipitationMm: w.precipitationMm,
  };
}

/** When a care action of this type last happened (events may arrive in any order). */
export function lastDone(events: CareEventRow[], type: CareEventType): Date | undefined {
  let latest: string | undefined;
  for (const e of events) if (e.type === type && (!latest || e.at > latest)) latest = e.at;
  return latest ? new Date(latest) : undefined;
}

/** The watering the schedule counts from: the latest logged one, else when the plant was added. */
export function lastWateredAt(plant: PlantRow, events: CareEventRow[]): Date {
  return lastDone(events, "water") ?? (plant.plantedAt ? new Date(plant.plantedAt) : new Date());
}

export interface Schedule {
  nextAt: Date;
  intervalDays: number;
  modifiers: { name: string; delta: number }[];
}

/** Watering schedule for a plant in its real environment, counted from `lastWaterAt`. */
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
  return { nextAt: res.nextAt, intervalDays: res.intervalDays, modifiers: res.modifiers };
}

/**
 * The stored `nextWaterAt` is what Home and reminders use. Re-derive it from
 * the care history whenever waterings are logged, backdated or deleted, so it
 * always counts from the latest real watering.
 */
export function rescheduleWater(
  plant: PlantRow,
  species: Species | undefined,
  env: Env | undefined,
  events: CareEventRow[],
): PlantRow {
  const last = lastWateredAt(plant, events);
  const schedule = computeSchedule(plant, species, env, last);
  const nextAt = schedule?.nextAt ?? addDays(last, species?.ideal.waterIntervalDays ?? 7);
  return { ...plant, nextWaterAt: nextAt.toISOString() };
}

/** "Still moist": push the next watering back without logging a fake one. */
export function applyStillMoist(
  row: PlantRow,
  species: Species | undefined,
  env: Env | undefined,
  lastWaterAt: Date,
): PlantRow {
  const schedule = computeSchedule(row, species, env, lastWaterAt);
  const intervalDays = schedule?.intervalDays ?? species?.ideal.waterIntervalDays ?? 7;
  const from = Math.max(Date.now(), row.nextWaterAt ? new Date(row.nextWaterAt).getTime() : 0);
  return { ...row, nextWaterAt: addDays(new Date(from), Math.max(1, Math.round(intervalDays * 0.3))).toISOString() };
}

export type WaterTone = "neutral" | "due" | "soon" | "happy";

/** Calendar days from today until `date` (0 = today, negative = overdue). */
export function daysFromToday(date: Date): number {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - start.getTime()) / DAY);
}

export function potLabel(type: PlantRow["potType"]): string {
  return ({ plastic: "Plastic", terracotta: "Terracotta", ceramic: "Glazed ceramic", "self-watering": "Self-watering", glass: "Glass of water (no soil)" })[type];
}

/** "Water" for potted plants, "Refresh water" for plants growing in a glass of water. */
export function waterVerb(plant: Pick<PlantRow, "potType">): string {
  return plant.potType === "glass" ? "Refresh water" : "Water";
}

/** Friendly "water today / tomorrow / in N days" label shared by Home and PlantDetail. */
export function waterStatusLabel(
  nextWaterAt: string | Date | undefined,
  verb = "Water",
): { label: string; tone: WaterTone; days?: number } {
  if (!nextWaterAt) return { label: "Schedule pending", tone: "neutral" };
  const days = daysFromToday(new Date(nextWaterAt));
  if (days < 0) return { label: `${verb} today (${-days} day${days === -1 ? "" : "s"} late)`, tone: "due", days };
  if (days === 0) return { label: `${verb} today`, tone: "due", days };
  if (days === 1) return { label: `${verb} tomorrow`, tone: "soon", days };
  return { label: `${verb} in ${days} days`, tone: "happy", days };
}

/** Plain-language reasons behind the watering interval (keys come from the core engine). */
export const MODIFIER_LABELS: Record<string, string> = {
  highLight: "Bright light dries it faster",
  lowLight: "Low light slows drying",
  terracottaPot: "Terracotta wicks water away",
  selfWateringPot: "Self-watering pot holds a reserve",
  wellDrainingSoil: "Well-draining soil dries faster",
  retentiveSoil: "Moisture-holding soil stays wet longer",
  smallPot: "Small pot dries out quickly",
  smallishPot: "Smaller pot dries a bit faster",
  largePot: "Large pot holds more water",
  veryLargePot: "Very large pot stays moist for longer",
  heat: "Hot weather",
  warm: "Warm weather",
  cold: "Cool weather slows drying",
  lowHumidity: "Dry air",
  highHumidity: "Humid air",
  strongSun: "Strong sun",
  fastGrowth: "Growing fast this season",
  outdoorDormant: "Outdoors and resting for winter",
  outdoorCool: "Outdoors in cool weather",
};

export interface FeedingPlan {
  advice: FeedingAdvice;
  /** When feeding is next due; null if it has never been fed. */
  nextAt: Date | null;
  lastFedAt: Date | null;
  /** True when it's the growing season and a feed is due (or has never happened). */
  due: boolean;
  /** "Mix 1 ml of Seagro into 500 ml of water" when the person has told us their fertiliser. */
  mix?: string;
}

/** How much of the person's own fertiliser to use for one feed of this plant. */
export function fertilizerMix(fertilizer: MyFertilizer, advice: FeedingAdvice): string {
  // Houseplants are easy to over-feed: light feeders and the resting season get half strength.
  const strength = advice.strength === "gentle" || !advice.growingSeason ? 0.5 : 1;
  const amount = (fertilizer.dosePerLiter * strength * advice.doseMl) / 1000;
  const rounded = amount >= 2 ? Math.round(amount * 2) / 2 : Math.round(amount * 10) / 10;
  const strengthNote = strength < 1 ? " (half the label strength)" : "";
  return `Mix ${Math.max(rounded, 0.1)} ${fertilizer.unit} of ${fertilizer.name} into ${advice.doseMl} ml of water${strengthNote}.`;
}

/** Fertiliser plan for a plant: interval, dose, next due date and whether it's due now. */
export function feedingPlan(
  plant: PlantRow,
  species: Species | undefined,
  events: CareEventRow[],
  season: Season,
  fertilizer?: MyFertilizer,
): FeedingPlan | undefined {
  if (!species || plant.potType === "glass") return undefined;
  const advice = feedingAdvice({ species, season, potSizeCm: plant.potSizeCm });
  const lastFedAt = lastDone(events, "fertilize") ?? null;
  const nextAt = lastFedAt ? nextFertilizeAt(species, lastFedAt, season) : null;
  const due = advice.growingSeason && (!nextAt || daysFromToday(nextAt) <= 0);
  return { advice, lastFedAt, nextAt, due, ...(fertilizer ? { mix: fertilizerMix(fertilizer, advice) } : {}) };
}
