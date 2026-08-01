import { z } from "zod";
import { admin } from "../lib/firebase.js";

const Body = z.object({
  plantId: z.string(),
  inviterUid: z.string(),
  inviteeEmail: z.string().email(),
  role: z.enum(["owner", "caregiver", "viewer"]),
});

const COLLECTION = "invites";

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  const { db } = admin();
  const ref = db.collection(COLLECTION).doc();
  await ref.set({ ...parsed.data, status: "pending", createdAt: new Date().toISOString() });

  // FCM notify: resolve invitee token via /users/{uid}/fcmToken — best-effort.
  const users = await db
    .collection("users")
    .where("email", "==", parsed.data.inviteeEmail)
    .limit(1)
    .get();
  if (!users.empty) {
    const token = users.docs[0]?.data().fcmToken as string | undefined;
    if (token) {
      // firebase-admin/messaging import is lazy; noop if unavailable
      try {
        const { getMessaging } = await import("firebase-admin/messaging");
        await getMessaging().send({
          token,
          notification: {
            title: "New plant shared with you",
            body: `Someone wants you to help care for their plant.`,
          },
        });
      } catch {
        // invite still persisted; app surfaces it in-app
      }
    }
  }

  return Response.json({ id: ref.id, status: "pending" }, { status: 201 });
}
