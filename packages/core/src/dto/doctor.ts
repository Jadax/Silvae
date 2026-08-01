import { z } from "zod";
import { LIGHT_LEVELS } from "../constants.js";

export const SymptomsSchema = z.object({
  leafColor: z.enum(["green", "yellow", "pale", "brown"]).optional(),
  leafCrisp: z.enum(["none", "dry-brown", "brown-tips"]).optional(),
  leafBurn: z.enum(["none", "brown-spots", "pale-patches"]).optional(),
  soil: z.enum(["dry", "moist", "soaked"]).optional(),
  light: z.enum(LIGHT_LEVELS).optional(),
  droop: z.boolean().optional(),
  stretched: z.boolean().optional(),
  lowerLeaves: z.boolean().optional(),
  potHasDrainage: z.boolean().optional(),
  spotsOnExposed: z.boolean().optional(),
  directSun: z.boolean().optional(),
  envHumidity: z.enum(["low", "ok", "high"]).optional(),
  webbing: z.boolean().optional(),
  stippling: z.boolean().optional(),
  whiteFluff: z.boolean().optional(),
  stickyResidue: z.boolean().optional(),
  curledLeaves: z.boolean().optional(),
  insects: z.boolean().optional(),
});
export type Symptoms = z.infer<typeof SymptomsSchema>;

export const DiagnosisSchema = z.object({
  id: z.string(),
  score: z.number(),
  likelyCause: z.string(),
  treatment: z.array(z.string()),
  confidence: z.enum(["low", "medium", "high"]),
});
export type Diagnosis = z.infer<typeof DiagnosisSchema>;
