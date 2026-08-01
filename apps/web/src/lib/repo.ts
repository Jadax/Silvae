import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit as queryLimit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";
import {
  addPlant as addLocalPlant,
  careHistory as localCareHistory,
  deletePlant as deleteLocalPlant,
  getPlant as getLocalPlant,
  listPlants as listLocalPlants,
  logCareEvent as logLocalCareEvent,
  removePlantDoc,
  savePlant as saveLocalPlant,
  type CareEventRow,
  type PlantRow,
} from "./db";
import { db, isFirebaseConfigured } from "./firebase";

let uid: string | undefined;

/** Set by the auth layer whenever the signed-in user changes. */
export function setUid(u: string | undefined): void {
  uid = u;
}

const cloudReady = (): boolean => Boolean(db && isFirebaseConfigured && uid);

/**
 * Idempotently create the signed-in user's `users/{uid}` profile (schema 7.1)
 * with defaults. Only runs when Firebase is configured.
 */
export async function ensureUserDoc(): Promise<void> {
  if (!db || !isFirebaseConfigured || !uid) return;
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  await setDoc(ref, {
    createdAt: serverTimestamp(),
    settings: { darkMode: false, notifyWatering: true, notifyShare: true, locale: "en" },
    profile: { skillLevel: "beginner" },
  });
}

/**
 * Client-side TTL sweep for the `caches/{kind}/{key}` collection (D-4). Any
 * signed-in client may prune the oldest expired entries; no cron/function
 * required (zero-cost on Spark). Deletes apply to cache docs only.
 */
export async function pruneExpiredCaches(opts?: {
  maxAgeMs?: number;
  batch?: number;
}): Promise<number> {
  if (!db || !isFirebaseConfigured) return 0;
  const maxAgeMs = opts?.maxAgeMs ?? 7 * 24 * 60 * 60 * 1000; // 7 days default
  const batch = opts?.batch ?? 50;
  const cutoff = Timestamp.fromMillis(Date.now() - maxAgeMs);
  const snap = await getDocs(
    query(collection(db, "caches"), orderBy("createdAt", "asc"), queryLimit(batch)),
  );
  const expired = snap.docs.filter((d) => {
    const c = d.data().createdAt;
    return c instanceof Timestamp && c.seconds < cutoff.seconds;
  });
  await Promise.all(expired.map((d) => deleteDoc(d.ref)));
  return expired.length;
}

function toCloudPlant(row: PlantRow): Record<string, unknown> {
  const base: Record<string, unknown> = {
    uid,
    speciesSlug: row.speciesSlug,
    name: row.name,
    potType: row.potType,
    soilType: row.soilType,
    updatedAt: serverTimestamp(),
  };
  if (row.potSizeCm !== undefined) base.potSizeCm = row.potSizeCm;
  if (row.roomId) base.roomId = row.roomId;
  if (row.spotName) base.spotName = row.spotName;
  if (row.notes) base.notes = row.notes;
  // Local data URLs are for offline use only. R2 uploads will provide a durable remote URL.
  if (row.avatarPhotoUrl?.startsWith("http")) base.avatarPhotoUrl = row.avatarPhotoUrl;
  if (row.nextWaterAt) base.schedule = { nextWaterAt: row.nextWaterAt };
  if (row.plantedAt) base.createdAt = row.plantedAt;
  return base;
}

function fromCloudPlant(id: string, data: DocumentData): PlantRow {
  return {
    id,
    ownerUid: String(data.uid ?? "unknown"),
    name: String(data.name ?? "Plant"),
    speciesSlug: String(data.speciesSlug ?? ""),
    potType: (data.potType as PlantRow["potType"]) ?? "plastic",
    soilType: (data.soilType as PlantRow["soilType"]) ?? "standard",
    potSizeCm: typeof data.potSizeCm === "number" ? data.potSizeCm : undefined,
    roomId: typeof data.roomId === "string" ? data.roomId : undefined,
    spotName: typeof data.spotName === "string" ? data.spotName : undefined,
    notes: typeof data.notes === "string" ? data.notes : undefined,
    avatarPhotoUrl: typeof data.avatarPhotoUrl === "string" ? data.avatarPhotoUrl : undefined,
    plantedAt: typeof data.createdAt === "string" ? data.createdAt : undefined,
    nextWaterAt:
      data.schedule && typeof data.schedule.nextWaterAt === "string"
        ? data.schedule.nextWaterAt
        : undefined,
    sharedWith: [],
  };
}

export async function addPlant(row: PlantRow): Promise<string> {
  const id = await addLocalPlant(row);
  if (cloudReady()) {
    void setDoc(doc(db!, "plants", id), toCloudPlant(row), { merge: true });
  }
  return id;
}

export async function savePlant(row: PlantRow): Promise<void> {
  await saveLocalPlant(row);
  if (cloudReady()) {
    void setDoc(doc(db!, "plants", row.id), toCloudPlant(row), { merge: true });
  }
}

export async function deletePlant(id: string): Promise<void> {
  await deleteLocalPlant(id);
  if (cloudReady()) {
    void deleteDoc(doc(db!, "plants", id));
  }
}

export async function logCareEvent(event: CareEventRow): Promise<void> {
  await logLocalCareEvent(event);
  if (cloudReady()) {
    const type = event.type.toUpperCase() as string;
    void setDoc(doc(db!, "care_events", event.id), {
      uid,
      plantId: event.plantId,
      type,
      at: serverTimestamp(),
      notes: event.note ?? undefined,
    });
  }
}

export async function listPlants(): Promise<PlantRow[]> {
  return listLocalPlants();
}

export async function getPlant(id: string): Promise<PlantRow | undefined> {
  return getLocalPlant(id);
}

export async function careHistory(plantId: string, limit = 50): Promise<CareEventRow[]> {
  return localCareHistory(plantId, limit);
}

/**
 * Two-way mirror: pulls the signed-in user's cloud plants into Dexie and keeps
 * the local copy in sync. Care events stay local-first (single device for now).
 */
export function subscribeToCloud(u: string): Unsubscribe | undefined {
  if (!db || !isFirebaseConfigured) return undefined;
  const q = query(collection(db, "plants"), where("uid", "==", u));
  return onSnapshot(
    q,
    (snap) => {
      void (async () => {
        for (const change of snap.docChanges()) {
          if (change.type === "removed") {
            await removePlantDoc(change.doc.id);
          } else {
            await saveLocalPlant(fromCloudPlant(change.doc.id, change.doc.data()));
          }
        }
      })();
    },
    (err) => {
      console.warn("Silvae sync:", err);
    },
  );
}
