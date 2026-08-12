import { z } from "zod";
import { admin, requireUid, AuthError } from "../lib/firebase.js";

const Body = z.object({
  plantId: z.string(),
  inviteeEmail: z.string().email(),
  role: z.enum(["owner", "caregiver", "viewer"]),
});

const COLLECTION = "invites";

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  let inviterUid: string;
  try {
    inviterUid = await requireUid(req);
  } catch (err) {
    if (err instanceof AuthError) return Response.json({ error: "unauthorized" }, { status: 401 });
    throw err;
  }

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  const { db } = admin();

  // Only the plant's owner may invite someone to it — never trust a uid from
  // the request body for this.
  const plantSnap = await db.collection("plants").doc(parsed.data.plantId).get();
  if (!plantSnap.exists || plantSnap.data()?.uid !== inviterUid) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const ref = db.collection(COLLECTION).doc();
  await ref.set({ ...parsed.data, inviterUid, status: "pending", createdAt: new Date().toISOString() });

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
