import type { Species } from "../dto/species.js";
import type { Env, Irrigation } from "../dto/weather.js";
import { clamp } from "../constants.js";
import { round2 } from "./schedule.js";

/**
 * Quantitative irrigation recommendation (S-10, harvested from yingxin-jia's
 * evapotranspiration approach). Returns an actionable "≈ X ml today".
 *
 * Simplified Hargreaves-style proxy built from current weather:
 *   reference ET ~ 3.5 mm/day scaled by daylight, heat and solar intensity,
 *   minus today's rainfall, then mapped onto the species baseline watering.
 */
export function evapotranspirationMm(env: Env): number {
  const solar = clamp(env.daylightH / 12, 0.2, 1);
  const heat = clamp((env.tempC - 10) / 15, 0, 1.3);
  const uv = clamp(env.uvIndex / 8, 0, 1.2);
  return round2(3.5 * solar * heat * (1 + 0.25 * uv));
}

export function irrigation(species: Species, env: Env, cropAgeDays?: number): Irrigation {
  const et = evapotranspirationMm(env);
  const rainfall = env.precipitationMm ?? 0;
  const net = Math.max(0, et - rainfall);

  const growthFactor = clamp(1 + (cropAgeDays ?? 0) / 365, 0.8, 1.2);
  const amountMl = Math.round(
    clamp((species.ideal.waterAmountMl * net) / 3.5, species.ideal.waterAmountMl * 0.5, species.ideal.waterAmountMl * 1.5),
  );

  const explanation: string[] = [
    `≈ ${et} mm evaporates today (temp ${env.tempC}°C, ${env.daylightH}h daylight)`,
  ];
  if (rainfall > 0) explanation.push(`− ${rainfall} mm from rain`);
  if (growthFactor !== 1)
    explanation.push(`× ${growthFactor.toFixed(2)} growth/crop-age factor`);

  return { amountMl, evapotranspirationMm: et, rainfallMm: rainfall, factor: growthFactor, explanation };
}
