import type { Species } from "../dto/species.js";
import type { Env, Irrigation } from "../dto/weather.js";
import { clamp } from "../constants.js";
import { round2 } from "./schedule.js";
import { potVolumeL, potWaterMl } from "./pot.js";

/**
 * Reference evapotranspiration proxy built from current weather (simplified
 * Hargreaves-style): ~3.5 mm/day scaled by daylight, heat and sun strength.
 */
export function evapotranspirationMm(env: Env): number {
  const solar = clamp(env.daylightH / 12, 0.2, 1);
  const heat = clamp((env.tempC - 10) / 15, 0, 1.3);
  const uv = clamp(env.uvIndex / 8, 0, 1.2);
  return round2(3.5 * solar * heat * (1 + 0.25 * uv));
}

export interface IrrigationOptions {
  /** Pot diameter in cm. When known, the amount is sized to the pot. */
  potSizeCm?: number;
  /** Outdoor plants have the amount scaled by today's evaporation and rain. */
  outdoor?: boolean;
}

/**
 * How much to give at the next watering. The pot sets the baseline (a
 * fifth of its volume); without a pot size the species' typical amount is
 * used. Outdoor plants are then scaled by evaporation and rainfall, since
 * sun, heat and rain change what they need far more than indoor plants.
 */
export function irrigation(species: Species, env: Env, opts: IrrigationOptions = {}): Irrigation {
  const et = evapotranspirationMm(env);
  const rainfall = env.precipitationMm ?? 0;
  const base = opts.potSizeCm ? potWaterMl(opts.potSizeCm) : species.ideal.waterAmountMl;
  const explanation: string[] = opts.potSizeCm
    ? [`About a fifth of a ${round2(potVolumeL(opts.potSizeCm))} L pot, enough to soak the roots until a little drains out`]
    : [`The typical amount for ${species.commonNames[0] ?? species.scientificName}`];

  let factor = 1;
  if (opts.outdoor) {
    const net = Math.max(0, et - rainfall);
    factor = clamp(net / 3.5, 0.5, 1.5);
    explanation.push(`About ${et} mm evaporates today (${env.tempC}°C, ${env.daylightH}h daylight)`);
    if (rainfall > 0) explanation.push(`Minus ${rainfall} mm of rain`);
  }

  return {
    amountMl: Math.round((base * factor) / 10) * 10,
    evapotranspirationMm: et,
    rainfallMm: rainfall,
    factor: round2(factor),
    explanation,
  };
}
