import { z } from "zod";
import { SEASONS } from "../constants.js";

export const WeatherSchema = z.object({
  tempC: z.number(),
  rh: z.number().min(0).max(100),
  uvIndex: z.number().nonnegative(),
  cloudCover: z.number().min(0).max(100),
  daylightHours: z.number().min(0).max(24),
  precipitationMm: z.number().nonnegative().default(0),
  fetchedAt: z.string().datetime(),
});
export type Weather = z.infer<typeof WeatherSchema>;

export const EnvSchema = z.object({
  tempC: z.number(),
  rh: z.number().min(0).max(100),
  uvIndex: z.number().nonnegative(),
  season: z.enum(SEASONS),
  daylightH: z.number().min(0).max(24),
  cloudCover: z.number().min(0).max(100).optional(),
  precipitationMm: z.number().nonnegative().optional(),
});
export type Env = z.infer<typeof EnvSchema>;

/** Compressed cache payload stored in Firestore `weatherCache` (3 h TTL). */
export const WeatherCacheSchema = z.object({
  lat: z.number(),
  lon: z.number(),
  payload: WeatherSchema,
  expiresAt: z.string().datetime(),
});
export type WeatherCache = z.infer<typeof WeatherCacheSchema>;

export const IrrigationSchema = z.object({
  amountMl: z.number().nonnegative(),
  evapotranspirationMm: z.number().nonnegative(),
  rainfallMm: z.number().nonnegative(),
  factor: z.number(),
  explanation: z.array(z.string()),
});
export type Irrigation = z.infer<typeof IrrigationSchema>;
