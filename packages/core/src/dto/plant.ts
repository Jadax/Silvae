import { z } from "zod";
import { POT_TYPES, SOIL_TYPES } from "../constants.js";

export const PLANT_LOCATIONS = ["indoor", "outdoor"] as const;
export type PlantLocation = (typeof PLANT_LOCATIONS)[number];

export const PlantSchema = z.object({
  id: z.string(),
  ownerUid: z.string(),
  name: z.string().min(1),
  speciesSlug: z.string(),
  avatarPhotoUrl: z.string().optional(),
  locationType: z.enum(PLANT_LOCATIONS).optional(),
  roomId: z.string().optional(),
  spotName: z.string().optional(),
  potType: z.enum(POT_TYPES).default("plastic"),
  potSizeCm: z.number().positive().optional(),
  soilType: z.enum(SOIL_TYPES).default("standard"),
  plantedAt: z.string().datetime().optional(),
  notes: z.string().optional(),
  sharedWith: z
    .array(z.object({ uid: z.string(), role: z.enum(["owner", "caregiver", "viewer"]) }))
    .default([]),
});
export type Plant = z.infer<typeof PlantSchema>;
