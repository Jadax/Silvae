import type { Species } from "../dto/species.js";
import type { Season, ToleranceLevel } from "../constants.js";
import { clamp, lerp } from "../constants.js";
import { round2 } from "./schedule.js";

export type ClimateBand = "tropical" | "subtropical" | "temperate" | "cool";

export interface PlaceRef {
  lat?: number;
  lon?: number;
  label?: string;
}

export interface RegionFitInput {
  species: Species;
  place?: PlaceRef;
  season?: Season;
  locationType?: "indoor" | "outdoor";
}

export interface RegionFit {
  /** 0..100, how well the species suits this region right now. */
  fitScore: number;
  band: ClimateBand | null;
  /** Human-readable short summary. */
  summary: string;
  /** Named reasons, shown in the UI so people trust the number. */
  reasons: string[];
}

/** Broad climate band from absolute latitude (no zone maps needed). */
export function climateBand(lat: number | undefined): ClimateBand | null {
  if (lat === undefined) return null;
  const a = Math.abs(lat);
  if (a < 23.5) return "tropical";
  if (a < 35) return "subtropical";
  if (a < 50) return "temperate";
  return "cool";
}

const BAND_TEMP: Record<ClimateBand, { spring: number; summer: number; autumn: number; winter: number; spread: number; humidity: number }> = {
  tropical: { spring: 27, summer: 29, autumn: 27, winter: 26, spread: 4, humidity: 75 },
  subtropical: { spring: 22, summer: 30, autumn: 20, winter: 14, spread: 6, humidity: 62 },
  temperate: { spring: 13, summer: 24, autumn: 12, winter: 5, spread: 8, humidity: 55 },
  cool: { spring: 8, summer: 19, autumn: 7, winter: -1, spread: 9, humidity: 58 },
};

export function bandLabel(band: ClimateBand | null): string {
  if (!band) return "this area";
  return (
    { tropical: "tropical", subtropical: "subtropical", temperate: "temperate", cool: "cool/temperate" }[
      band
    ] ?? "this area"
  );
}

/** Rough local temperature range [lo, hi] for a band and season. */
export function estimateLocalTemps(
  band: ClimateBand,
  season: Season,
): { lo: number; hi: number; mean: number } {
  const m = BAND_TEMP[band];
  const mean = m[season];
  return { lo: round2(mean - m.spread), hi: round2(mean + m.spread), mean };
}

function overlap(a: number, b: number, lo: number, hi: number): number {
  const from = Math.max(a, lo);
  const to = Math.min(b, hi);
  return clamp((to - from) / Math.max(1, hi - lo), 0, 1);
}

const COLD_PENALTY: Record<ToleranceLevel, number> = { LOW: 30, MED: 15, HIGH: 0 };

/**
 * Estimates how well a species suits a region right now, from the place's
 * latitude band and the current season. This is an honest, labelled estimate —
 * real homes vary — so every number ships with named reasons.
 */
export function regionFit(input: RegionFitInput): RegionFit {
  const { species } = input;
  const season = input.season ?? "summer";
  const place = input.place;
  const band = climateBand(place?.lat);
  const locationType = input.locationType ?? "indoor";
  const reasons: string[] = [];

  // Indoor: assume a comfortable room; the climate band still shapes humidity.
  const indoorTemp: [number, number] = [18, 27];
  const loc = band
    ? { ...estimateLocalTemps(band, season), humidity: BAND_TEMP[band].humidity }
    : { lo: 18, hi: 27, mean: 22, humidity: 55 };
  const { lo, hi, mean, humidity: bandRh } = loc;

  // Temperature fit. Heat is rarely the killer; cold is. So we allow ~4°C of
  // headroom above the ideal ceiling, and give full credit when the local
  // range sits comfortably inside (or just above) the species' window.
  const heatHeadroom = 4;
  const temp =
    locationType === "outdoor"
      ? overlap(species.ideal.tempMinC, species.ideal.tempMaxC + heatHeadroom, lo, hi) * 0.8 +
        (species.ideal.tempMinC <= mean && mean <= species.ideal.tempMaxC + heatHeadroom ? 0.2 : 0)
      : overlap(species.ideal.tempMinC, species.ideal.tempMaxC, indoorTemp[0], indoorTemp[1]);
  reasons.push(
    locationType === "outdoor"
      ? `${species.commonNames[0]} likes ${species.ideal.tempMinC}–${species.ideal.tempMaxC}°C; ${bandLabel(band)} is ~${mean}°C now`
      : `${species.commonNames[0]} likes ${species.ideal.tempMinC}–${species.ideal.tempMaxC}°C; a typical room is fine`,
  );

  // Humidity fit (humidifier aside, local air sets the tone indoors).
  const hum =
    species.ideal.humidityMin <= bandRh && bandRh <= species.ideal.humidityMax
      ? 1
      : bandRh < species.ideal.humidityMin
        ? lerp(0.2, 0.8, bandRh, species.ideal.humidityMin * 0.55, species.ideal.humidityMin)
        : 0.5;
  reasons.push(`Local humidity ~${bandRh}% vs the ${species.ideal.humidityMin}–${species.ideal.humidityMax}% it likes`);

  // Cold risk outdoors.
  let coldPenalty = 0;
  if (locationType === "outdoor" && band && (season === "winter" || season === "autumn")) {
    const outdoorMean = estimateLocalTemps(band, season).mean;
    if (outdoorMean < species.ideal.tempMinC) {
      coldPenalty = COLD_PENALTY[species.tolerance.cold];
      reasons.push(
        coldPenalty > 0
          ? `⚠️ ${outdoorMean}°C outdoors is below its ${species.ideal.tempMinC}°C comfort line and cold tolerance is ${species.tolerance.cold.toLowerCase()}`
          : `Cold-tolerant enough to handle ${outdoorMean}°C outdoors`,
      );
    } else if (species.tolerance.cold === "HIGH") {
      reasons.push("Cold-tolerant: happy to stay out in the cool season");
    }
  }

  // Light outdoors is easy (mostly sunny); indoors is user-controlled.
  const light = locationType === "outdoor" ? 1 : 0.9;
  if (locationType === "outdoor") reasons.push("Outdoors gets plenty of light");

  const raw = temp * 0.5 + hum * 0.2 + light * 0.1;
  const fitScore = round2(clamp(raw * 100 - coldPenalty, 0, 100));
  const summary =
    fitScore >= 80
      ? "Great match for your area"
      : fitScore >= 55
        ? "Doable with a little care"
        : "Fights your climate — expect extra effort";
  return { fitScore, band, summary, reasons };
}

export interface RankedSpecies {
  species: Species;
  fit: RegionFit;
}

/** Rank a species list for a region; best fits first. */
export function recommendForRegion(
  list: readonly Species[],
  place?: PlaceRef,
  opts: { season?: Season; locationType?: "indoor" | "outdoor"; petSafe?: boolean; limit?: number } = {},
): RankedSpecies[] {
  const season = opts.season ?? "summer";
  const locationType = opts.locationType ?? "indoor";
  const limit = opts.limit ?? 12;
  return list
    .filter((s) => !opts.petSafe || !s.toxicity.pets)
    .map((species) => {
      const input: RegionFitInput = { species, season, locationType };
      if (place) input.place = place;
      return { species, fit: regionFit(input) };
    })
    .sort((a, b) => b.fit.fitScore - a.fit.fitScore)
    .slice(0, limit);
}
