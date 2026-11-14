import { initializeApp, type FirebaseOptions, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { initializeFirestore, type Firestore } from "firebase/firestore";

/**
 * Firebase is OPTIONAL. When VITE_FIREBASE_CONFIG is set at build time the app
 * gets auth + Firestore sync; without it everything runs fully offline.
 */
function parseConfig(): FirebaseOptions | null {
  const raw = import.meta.env.VITE_FIREBASE_CONFIG as string | undefined;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as FirebaseOptions;
  } catch {
    console.warn("VITE_FIREBASE_CONFIG is set but is not valid JSON, running offline.");
    return null;
  }
}

const options = parseConfig();
export const app: FirebaseApp | null = options ? initializeApp(options) : null;
export const auth: Auth | null = app ? getAuth(app) : null;
// Optional fields are left out rather than rejected, so a missing note never fails a sync.
export const db: Firestore | null = app ? initializeFirestore(app, { ignoreUndefinedProperties: true }) : null;
export const isFirebaseConfigured = Boolean(app);
