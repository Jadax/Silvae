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
  recentCareEvents as localRecentCareEvents,
  removePlantDoc,
  savePlant as saveLocalPlant,
  type CareEventRow,
  type PendingWrite,
  type PlantRow,
} from "./db";
import localDb from "./db";
import { db as firestoreDb, isFirebaseConfigured } from "./firebase";

let uid: string | undefined;

/** Set by the auth layer whenever the signed-in user changes. */
export function setUid(u: string | undefined): void {
  uid = u;
}

const cloudReady = (): boolean => Boolean(firestoreDb && isFirebaseConfigured && uid);
const isOnline = (): boolean => (typeof navigator !== "undefined" ? navigator.onLine : true);

/**
 * Idempotently create the signed-in user's `users/{uid}` profile (schema 7.1)
 * with defaults. Only runs when Firebase is configured.
 */
export async function ensureUserDoc(): Promise<void> {
  if (!firestoreDb || !isFirebaseConfigured || !uid) return;
  const ref = doc(firestoreDb, "users", uid);
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
  if (!firestoreDb || !isFirebaseConfigured) return 0;
  const maxAgeMs = opts?.maxAgeMs ?? 7 * 24 * 60 * 60 * 1000; // 7 days default
  const batch = opts?.batch ?? 50;
  const cutoff = Timestamp.fromMillis(Date.now() - maxAgeMs);
  // Cache docs live in the sub-collections `caches/{kind}/{key}`; query each
  // kind so the read matches the rules (a bare `collection("caches")` query has
  // no matching rule and would be denied).
  const expired: Awaited<ReturnType<typeof getDocs>>["docs"] = [];
  for (const kind of ["id", "weather"] as const) {
    const snap = await getDocs(
      query(collection(firestoreDb, "caches", kind), orderBy("createdAt", "asc"), queryLimit(batch)),
    );
    expired.push(
      ...snap.docs.filter((d) => {
        const c = d.data().createdAt;
        return c instanceof Timestamp && c.seconds < cutoff.seconds;
      }),
    );
  }
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
  if (row.rev) base.rev = row.rev;
  if (row.potSizeCm !== undefined) base.potSizeCm = row.potSizeCm;
  if (row.locationType) base.locationType = row.locationType;
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
    locationType:
      data.locationType === "outdoor" || data.locationType === "indoor"
        ? data.locationType
        : undefined,
    roomId: typeof data.roomId === "string" ? data.roomId : undefined,
    spotName: typeof data.spotName === "string" ? data.spotName : undefined,
    notes: typeof data.notes === "string" ? data.notes : undefined,
    avatarPhotoUrl: typeof data.avatarPhotoUrl === "string" ? data.avatarPhotoUrl : undefined,
    plantedAt: typeof data.createdAt === "string" ? data.createdAt : undefined,
    nextWaterAt:
      data.schedule && typeof data.schedule.nextWaterAt === "string"
        ? data.schedule.nextWaterAt
        : undefined,
    rev: typeof data.rev === "string" ? data.rev : undefined,
    sharedWith: [],
  };
}

/** Queue a plant write for later upload. Upserts replace; deletes supersede. */
async function enqueuePlantWrite(write: PendingWrite): Promise<void> {
  await localDb.transaction("rw", localDb.pending, async () => {
    if (write.kind === "plant-delete") {
      await localDb.pending.where("id").equals(write.id).delete();
    }
    await localDb.pending.put(write);
  });
}

async function pendingWriteFor(id: string): Promise<PendingWrite | undefined> {
  return localDb.pending.get(id);
}

/** Mirror a plant to the cloud, queueing for retry when offline or on failure. */
async function mirrorPlant(row: PlantRow): Promise<void> {
  if (!cloudReady() || !isOnline()) {
    await enqueuePlantWrite({ id: row.id, kind: "plant-upsert", payload: row, at: Date.now() });
    return;
  }
  try {
    await setDoc(doc(firestoreDb!, "plants", row.id), toCloudPlant(row), { merge: true });
  } catch (err) {
    console.warn("Silvae sync: cloud write failed, queued for retry:", err);
    await enqueuePlantWrite({ id: row.id, kind: "plant-upsert", payload: row, at: Date.now() });
  }
}

/** Mirror a plant deletion to the cloud, queueing for retry when offline. */
async function mirrorDelete(id: string): Promise<void> {
  if (!cloudReady() || !isOnline()) {
    await enqueuePlantWrite({ id, kind: "plant-delete", at: Date.now() });
    return;
  }
  try {
    await deleteDoc(doc(firestoreDb!, "plants", id));
  } catch (err) {
    console.warn("Silvae sync: cloud delete failed, queued for retry:", err);
    await enqueuePlantWrite({ id, kind: "plant-delete", at: Date.now() });
  }
}

/**
 * Upload every queued write. Called when the app comes back online, after
 * sign-in, and opportunistically after successful writes.
 */
export async function flushPendingWrites(): Promise<void> {
  if (!cloudReady() || !isOnline()) return;
  const pending = await localDb.pending.toArray();
  for (const write of pending) {
    try {
      if (write.kind === "plant-upsert") {
        await setDoc(doc(firestoreDb!, "plants", write.id), toCloudPlant(write.payload), {
          merge: true,
        });
      } else {
        await deleteDoc(doc(firestoreDb!, "plants", write.id));
      }
      await localDb.pending.delete(write.id);
    } catch (err) {
      console.warn("Silvae sync: retry failed, keeping queued write:", err);
    }
  }
}

export async function addPlant(row: PlantRow): Promise<string> {
  const withRev: PlantRow = { ...row, rev: String(Date.now()) };
  const id = await addLocalPlant(withRev);
  await mirrorPlant(withRev);
  return id;
}

export async function savePlant(row: PlantRow): Promise<void> {
  const withRev: PlantRow = { ...row, rev: String(Date.now()) };
  await saveLocalPlant(withRev);
  await mirrorPlant(withRev);
}

export async function deletePlant(id: string): Promise<void> {
  await deleteLocalPlant(id);
  await mirrorDelete(id);
}

export async function logCareEvent(event: CareEventRow): Promise<void> {
  await logLocalCareEvent(event);
  if (cloudReady()) {
    const type = event.type.toUpperCase() as string;
    void setDoc(doc(firestoreDb!, "care_events", event.id), {
      uid,
      plantId: event.plantId,
      type,
      at: serverTimestamp(),
      notes: event.note ?? undefined,
    }).catch((err) => {
      console.warn("Silvae sync: care event not uploaded:", err);
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

export async function recentCareEvents(limit = 400): Promise<CareEventRow[]> {
  return localRecentCareEvents(limit);
}

/**
 * Two-way mirror: pulls the signed-in user's cloud plants into Dexie and keeps
 * the local copy in sync. Conflict rule: local wins while a write is still
 * queued; otherwise the row with the newer `rev` wins.
 */
export function subscribeToCloud(u: string): Unsubscribe | undefined {
  if (!firestoreDb || !isFirebaseConfigured) return undefined;
  const q = query(collection(firestoreDb, "plants"), where("uid", "==", u));
  return onSnapshot(
    q,
    (snap) => {
      void (async () => {
        for (const change of snap.docChanges()) {
          const id = change.doc.id;
          if (change.type === "removed") {
            const pending = await pendingWriteFor(id);
            if (pending?.kind === "plant-delete") await localDb.pending.delete(id);
            await removePlantDoc(id);
            continue;
          }
          // Local edits stay authoritative until their queued write flushes.
          if (await pendingWriteFor(id)) continue;
          const cloud = fromCloudPlant(id, change.doc.data());
          const local = await getLocalPlant(id);
          if (local?.rev && cloud.rev && Number(cloud.rev) <= Number(local.rev)) continue;
          await saveLocalPlant(cloud);
        }
      })();
    },
    (err) => {
      console.warn("Silvae sync:", err);
    },
  );
}
