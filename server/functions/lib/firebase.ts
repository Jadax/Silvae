import { initializeApp, cert, getApps, getApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let app: App;

export function admin(): { db: Firestore } {
  if (getApps().length === 0) {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccount) throw new Error("FIREBASE_SERVICE_ACCOUNT env var is required");
    app = initializeApp({
      credential: cert(JSON.parse(serviceAccount)),
    });
  } else {
    app = getApp();
  }
  return { db: getFirestore(app) };
}
