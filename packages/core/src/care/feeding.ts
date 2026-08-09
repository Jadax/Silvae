import type { Species } from "../dto/species.js";
import { clamp, type Season } from "../constants.js";
import { addDays, round2 } from "./schedule.js";

/** Seasons when most houseplants actually want food. */
export const GROWING_SEASONS: readonly Season[] = ["spring", "summer"];

export type FeedStrength = "gentle" | "standard" | "hungry";

export interface FeedingAdvice {
  /** Days between feeds for this species (from its care profile). */
  intervalDays: number;
  /** Whether the current season is a growing season for feeding. */
  growingSeason: boolean;
  /** How strongly the species wants food, from its NPK profile. */
  strength: FeedStrength;
  /** Grams of balanced fertiliser per litre of water. */
  gramsPerLiter: number;
  /** Rough millilitres of diluted feed for this pot size. */
  doseMl: number;
  /** The species' preferred NPK ratio, for choosing a feed. */
  npk: { n: number; p: number; k: number };
  /** Human-readable guidance sentence. */
  guidance: string;
}

export interface FeedingInput {
  species: Species;
  season?: Season;
  /** Pot size in cm — bigger pots get a bigger dose. */
  potSizeCm?: number;
}

const STRENGTH_G_PER_L: Record<FeedStrength, number> = {
  gentle: 0.5,
  standard: 0.85,
  hungry: 1.2,
};

/** Pot volume in litres (tapered-cylinder approximation). */
export function potVolumeL(potSizeCm: number): number {
  return Math.max(0.2, clamp((Math.PI * potSizeCm ** 3) / 12000, 0.2, 30));
}

export function feedingStrength(npk: { n: number; p: number; k: number }): FeedStrength {
  const total = npk.n + npk.p + npk.k;
  if (total >= 20) return "hungry";
  if (total >= 8) return "standard";
  return "gentle";
}

/**
 * Fertiliser plan for a species: how often, how strong, and roughly how much
 * for the plant's pot. Honest guidance only — it is a starting point, not a
 * laboratory analysis. Most houseplants only want feeding in the growing
 * season; the off-season guidance says to skip or go half-strength.
 */
export function feedingAdvice(input: FeedingInput): FeedingAdvice {
  const { species } = input;
  const season = input.season ?? "summer";
  const growingSeason = GROWING_SEASONS.includes(season);
  const strength = feedingStrength(species.ideal.npk);
  const intervalDays = species.ideal.fertIntervalDays;
  const gramsPerLiter = STRENGTH_G_PER_L[strength];
  const doseMl = Math.round(clamp(potVolumeL(input.potSizeCm ?? 20) * 250, 150, 1200));

  const npk = species.ideal.npk;
  const ratio = `${npk.n}-${npk.p}-${npk.k}`;
  const guidance = growingSeason
    ? `Feed every ${intervalDays} days with ${gramsPerLiter} g/L of a balanced ${ratio} mix — about ${doseMl} ml per watering.`
    : `It's the resting season for most houseplants. Skip feeding, or go half-strength (${round2(gramsPerLiter / 2)} g/L) only if growth is clearly active.`;

  return { intervalDays, growingSeason, strength, gramsPerLiter, doseMl, npk, guidance };
}

/** Next fertiliser date, measured from the last feed. */
export function nextFertilizeAt(species: Species, lastFedAt: Date, season?: Season): Date {
  const { intervalDays } = feedingAdvice(season ? { species, season } : { species });
  return addDays(lastFedAt, intervalDays);
}

export const roundFeed = round2;
