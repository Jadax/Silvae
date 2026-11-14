export const SEASONS = ["winter", "spring", "summer", "autumn"] as const;
export type Season = (typeof SEASONS)[number];

const NORTHERN_BY_MONTH: readonly Season[] = [
  "winter", "winter", "spring", "spring", "spring", "summer",
  "summer", "summer", "autumn", "autumn", "autumn", "winter",
];
const OPPOSITE: Record<Season, Season> = {
  winter: "summer",
  spring: "autumn",
  summer: "winter",
  autumn: "spring",
};

/**
 * Meteorological season for a date at a latitude. Southern-hemisphere
 * locations (lat < 0) get the opposite season, so a November in Cape Town
 * is spring, not autumn. Without a latitude, assumes the northern hemisphere.
 */
export function seasonAt(date: Date, lat?: number): Season {
  const northern = NORTHERN_BY_MONTH[date.getMonth()]!;
  return lat !== undefined && lat < 0 ? OPPOSITE[northern] : northern;
}

export const LIGHT_LEVELS = ["low", "medium", "high"] as const;
export type LightLevel = (typeof LIGHT_LEVELS)[number];

export const GROWTH_RATES = ["SLOW", "MEDIUM", "FAST"] as const;
export type GrowthRate = (typeof GROWTH_RATES)[number];

export const TOLERANCE_LEVELS = ["LOW", "MED", "HIGH"] as const;
export type ToleranceLevel = (typeof TOLERANCE_LEVELS)[number];

export const WINDOW_DIRECTIONS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
export type WindowDirection = (typeof WINDOW_DIRECTIONS)[number];

export const WINDOW_TYPES = ["none", "sheer", "curtains"] as const;
export type WindowType = (typeof WINDOW_TYPES)[number];

export const POT_TYPES = ["plastic", "terracotta", "ceramic", "self-watering", "glass"] as const;
export type PotType = (typeof POT_TYPES)[number];

export const SOIL_TYPES = ["well-draining", "standard", "retentive"] as const;
export type SoilType = (typeof SOIL_TYPES)[number];

export const CARE_EVENT_TYPES = [
  "water",
  "mist",
  "fertilize",
  "biostimulate",
  "repot",
  "prune",
  "rotate",
  "clean",
] as const;
export type CareEventType = (typeof CARE_EVENT_TYPES)[number];

export const ROLES = ["owner", "caregiver", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const clamp = (x: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, x));

export const lerp = (a: number, b: number, x: number, x0: number, x1: number): number =>
  a + ((b - a) * (x - x0)) / (x1 - x0);
