import { initializeApp, cert, getApps, getApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { createRemoteJWKSet, jwtVerify } from "jose";

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
    const { payload } = await jwtVerify(token, firebaseKeys, {
      issuer: `https://securetoken.google.com/${projectId()}`,
      audience: projectId(),
      algorithms: ["RS256"],
    });
    if (typeof payload.sub !== "string" || !payload.sub) throw new Error("no_subject");
    return payload.sub;
  } catch {
    throw new AuthError("invalid_token");
  }
}

/**
 * Firebase ID tokens are verified directly against Google's published keys,
 * as Firebase documents for third-party JWT libraries. (firebase-admin/auth
 * pulls in a CommonJS dependency that can't load on Vercel's runtime.)
 */
const firebaseKeys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

function projectId(): string {
  const fromEnv = process.env.FIREBASE_PROJECT_ID;
  if (fromEnv) return fromEnv;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  const id = raw ? (JSON.parse(raw) as { project_id?: string }).project_id : undefined;
  if (!id) throw new Error("FIREBASE_SERVICE_ACCOUNT env var is required");
  return id;
}

export class AuthError extends Error {}
