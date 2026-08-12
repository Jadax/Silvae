import { initializeApp, cert, getApps, getApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

let app: App;

function ensureApp(): App {
  if (getApps().length === 0) {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccount) throw new Error("FIREBASE_SERVICE_ACCOUNT env var is required");
    app = initializeApp({
      credential: cert(JSON.parse(serviceAccount)),
    });
  } else {
    app = getApp();
  }
  return app;
}

export function admin(): { db: Firestore } {
  return { db: getFirestore(ensureApp()) };
}

/**
 * Verify the caller's Firebase ID token from `Authorization: Bearer <token>`.
 * Any endpoint that writes data attributed to a uid, or acts on the caller's
 * behalf, must call this instead of trusting a uid supplied in the body —
 * request bodies are attacker-controlled.
 */
export async function requireUid(req: Request): Promise<string> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new AuthError("missing_token");
  try {
    const decoded = await getAuth(ensureApp()).verifyIdToken(token);
    return decoded.uid;
  } catch {
    throw new AuthError("invalid_token");
  }
}

export class AuthError extends Error {}
