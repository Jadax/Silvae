import { z } from "zod";
import { CARE_EVENT_TYPES, ROLES } from "../constants.js";

export const CareEventSchema = z.object({
  id: z.string(),
  plantId: z.string(),
  type: z.enum(CARE_EVENT_TYPES),
  at: z.string().datetime(),
  note: z.string().optional(),
  byUid: z.string().optional(),
});
export type CareEvent = z.infer<typeof CareEventSchema>;

export const CareBatchSchema = z.object({
  plantId: z.string(),
  bucket: z.string(), // `care_batches/{uid}_{bucket}` — 15 min bucket, one doc per bucket
  events: z.array(CareEventSchema),
});
export type CareBatch = z.infer<typeof CareBatchSchema>;

export const ShareRoleSchema = z.enum(ROLES);

export const InviteSchema = z.object({
  plantId: z.string(),
  inviterUid: z.string(),
  inviteeEmail: z.string(),
  role: ShareRoleSchema,
});
export type Invite = z.infer<typeof InviteSchema>;

export const ReminderSchema = z.object({
  id: z.string(),
  plantId: z.string(),
  eventType: z.enum(CARE_EVENT_TYPES),
  lastDoneAt: z.string().datetime(),
  intervalDays: z.number().positive(),
  // S-8 "time since last action" — fire only when now > lastDoneAt + intervalDays
});
export type Reminder = z.infer<typeof ReminderSchema>;
