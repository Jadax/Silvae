import type { Room, Spot, SpotAssessment } from "../dto/room.js";
import type { Species } from "../dto/species.js";
import type { Env } from "../dto/weather.js";
import type { Season } from "../constants.js";
import { clamp, lerp } from "../constants.js";
import { round2 } from "../care/schedule.js";

export interface PlacementInput {
  room: Room;
  spot: Spot;
  species: Species;
  env: Env;
}

/** 0..1 solar index by direction, season and latitude band. */
export function sunHeightFactor(direction: string, season: Season, lat = 40): number {
  const isNorth = lat >= 0;
  const winterSun = isNorth ? "S" : "N";
  const summerSun = isNorth ? "N" : "S";
  const base: Record<string, number> = { E: 0.6, W: 0.6 };
  base[summerSun] = 0.4;
  base[winterSun] = 1;
  base["NE"] = base["NW"] = 0.45;
  base["SE"] = base["SW"] = 0.8;
  const seasonal =
    season === "summer" ? 0.85 : season === "winter" ? 0.5 : season === "spring" ? 0.7 : 0.65;
  return base[direction] ?? 0.5 * seasonal;
}

export function estimateLux(input: PlacementInput): number {
  const { room, spot, env } = input;
  const solarIndex = sunHeightFactor(room.windowDirection, env.season);
  const cloud = clamp(1 - (env.cloudCover ?? 0) / 100, 0.25, 1);
  const windowLoss = room.windowType === "curtains" ? 0.5 : room.windowType === "sheer" ? 0.7 : 1;
  const obstacle = 1 / (1 + (room.obstacleMeters ?? 0) / 4);
  const falloff = 1 / (1 + spot.distanceFromWindowM / 1.8);
  const grow = (room.growLightLux ?? 0) / 1000;
  const base = solarIndex * cloud * windowLoss * obstacle * falloff;
  return Math.round(base * 12000 + grow * 400);
}

export function suitability(species: Species, lux: number): number {
  const { luxMin, luxIdeal, luxMax } = species.ideal;
  if (lux < luxMin * 0.5) return 15;
  if (lux < luxMin) return lerp(15, 50, lux, luxMin * 0.5, luxMin);
  if (lux <= luxIdeal) return lerp(50, 95, lux, luxMin, luxIdeal);
  if (lux <= luxMax) return lerp(95, 70, lux, luxIdeal, luxMax);
  return 40;
}

export function assessSpot(input: PlacementInput): SpotAssessment {
  const lux = input.room.measuredLux ?? estimateLux(input);
  const score = suitability(input.species, lux);
  const reason = `~${lux.toLocaleString()} lux ${input.env.season} — ${
    score >= 80 ? "great fit" : score >= 50 ? "workable" : "not ideal"
  } for ${input.species.commonNames[0]}`;
  return {
    roomId: input.room.id,
    spotName: input.spot.spotName,
    estimatedLux: lux,
    suitability: round2(score),
    reason,
  };
}

export function rankSpots(inputs: PlacementInput[]): SpotAssessment[] {
  return inputs.map(assessSpot).sort((a, b) => b.suitability - a.suitability);
}
