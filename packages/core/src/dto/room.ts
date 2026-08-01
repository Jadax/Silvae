import { z } from "zod";
import { WINDOW_DIRECTIONS, WINDOW_TYPES } from "../constants.js";

export const RoomSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  windowDirection: z.enum(WINDOW_DIRECTIONS),
  windowType: z.enum(WINDOW_TYPES),
  obstacleMeters: z.number().nonnegative().optional(),
  growLightLux: z.number().nonnegative().optional(),
  measuredLux: z.number().nonnegative().optional(),
});
export type Room = z.infer<typeof RoomSchema>;

export const SpotSchema = z.object({
  roomId: z.string(),
  spotName: z.string(),
  distanceFromWindowM: z.number().positive(),
});
export type Spot = z.infer<typeof SpotSchema>;

export const SpotAssessmentSchema = z.object({
  roomId: z.string(),
  spotName: z.string(),
  estimatedLux: z.number(),
  suitability: z.number().min(0).max(100),
  reason: z.string(),
});
export type SpotAssessment = z.infer<typeof SpotAssessmentSchema>;
