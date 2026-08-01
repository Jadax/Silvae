import { z } from "zod";
import { GROWTH_RATES, TOLERANCE_LEVELS } from "../constants.js";

export const NpkSchema = z.object({
  n: z.number().min(0),
  p: z.number().min(0),
  k: z.number().min(0),
});
export type Npk = z.infer<typeof NpkSchema>;

export const SpeciesIdealSchema = z.object({
  luxMin: z.number().min(0),
  luxIdeal: z.number().min(0),
  luxMax: z.number().min(0),
  tempMinC: z.number(),
  tempMaxC: z.number(),
  humidityMin: z.number().min(0).max(100),
  humidityMax: z.number().min(0).max(100),
  phMin: z.number(),
  phMax: z.number(),
  npk: NpkSchema,
  waterIntervalDays: z.number().positive(),
  waterAmountMl: z.number().positive(),
  fertIntervalDays: z.number().positive(),
  mistIntervalDays: z.number().nonnegative(),
  repotIntervalMonths: z.number().positive(),
  rotateIntervalDays: z.number().positive(),
});
export type SpeciesIdeal = z.infer<typeof SpeciesIdealSchema>;

export const SpeciesToleranceSchema = z.object({
  drought: z.enum(TOLERANCE_LEVELS),
  shade: z.enum(TOLERANCE_LEVELS),
  cold: z.enum(TOLERANCE_LEVELS),
});
export type SpeciesTolerance = z.infer<typeof SpeciesToleranceSchema>;

export const SpeciesGrowthSchema = z.object({
  rate: z.enum(GROWTH_RATES),
  maxHeightCm: z.number().positive(),
});
export type SpeciesGrowth = z.infer<typeof SpeciesGrowthSchema>;

export const SpeciesSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  commonNames: z.array(z.string()).min(1),
  scientificName: z.string(),
  family: z.string(),
  toxicity: z.object({
    pets: z.boolean(),
    note: z.string().optional(),
  }),
  ideal: SpeciesIdealSchema,
  tolerance: SpeciesToleranceSchema,
  growth: SpeciesGrowthSchema,
});
export type Species = z.infer<typeof SpeciesSchema>;
