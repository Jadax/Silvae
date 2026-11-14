import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit as queryLimit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";
import { CARE_EVENT_TYPES, type CareEventType } from "@silvae/core";
import localDb, {
  addPlant as addLocalPlant,
  addPlantPhoto as putLocalPhoto,
  careHistory as localCareHistory,
  clearLocalData,
  deleteCareEvent as deleteLocalCareEvent,
  deletePlant as deleteLocalPlant,
  deletePlantPhoto as deleteLocalPhoto,
  getPlant as getLocalPlant,
  getPlantPhoto as getLocalPhoto,
  getSettings,
  listPlants as listLocalPlants,
  logCareEvent as logLocalCareEvent,
  latestCareByPlant as latestLocalCare,
  removePlantDoc,
  savePlant as saveLocalPlant,
  saveSettings,
  type CareEventRow,
  type JournalComment,
  type MyFertilizer,
  type PendingWrite,
  type PlantPhoto,
  type PlantRow,
  type Settings,
} from "./db";
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
 * Client-side TTL sweep for the `caches` collection (D-4). Any signed-in
 * client may prune the oldest expired entries; no cron/function required
 * (zero-cost on Spark). Deletes apply to cache docs only.
 */
export async function pruneExpiredCaches(opts?: { batch?: number }): Promise<number> {
  if (!firestoreDb || !isFirebaseConfigured) return 0;
  const batch = opts?.batch ?? 50;
  const snap = await getDocs(query(collection(firestoreDb, "caches"), queryLimit(batch)));
  const expired = snap.docs.filter((d) => {
    const at = d.data().expiresAt;
    if (typeof at === "string") return Date.parse(at) < Date.now();
    if (at instanceof Timestamp) return at.toMillis() < Date.now();
    return false;
  });
  await Promise.all(expired.map((d) => deleteDoc(d.ref)));
  return expired.length;
}

// ---------------------------------------------------------------------------
// Cloud document shapes. Field names are shared with the Android app.
// ---------------------------------------------------------------------------

/** Inline avatar images must stay small: they ride along on every plant read. */
const MAX_INLINE_AVATAR_CHARS = 80_000;

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
  if (
    row.avatarPhotoUrl &&
    (row.avatarPhotoUrl.startsWith("http") || row.avatarPhotoUrl.length <= MAX_INLINE_AVATAR_CHARS)
  ) {
    base.avatarPhotoUrl = row.avatarPhotoUrl;
  }
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
      data.locationType === "outdoor" || data.locationType === "indoor" ? data.locationType : undefined,
    roomId: typeof data.roomId === "string" ? data.roomId : undefined,
    spotName: typeof data.spotName === "string" ? data.spotName : undefined,
    notes: typeof data.notes === "string" ? data.notes : undefined,
    avatarPhotoUrl: typeof data.avatarPhotoUrl === "string" ? data.avatarPhotoUrl : undefined,
    plantedAt: typeof data.createdAt === "string" ? data.createdAt : undefined,
    nextWaterAt:
      data.schedule && typeof data.schedule.nextWaterAt === "string" ? data.schedule.nextWaterAt : undefined,
    rev: typeof data.rev === "string" ? data.rev : undefined,
    sharedWith: [],
  };
}

function toCloudEvent(event: CareEventRow): Record<string, unknown> {
  return {
    uid,
    plantId: event.plantId,
    type: event.type,
    at: event.at,
    ...(event.note ? { note: event.note } : {}),
  };
}

/** Accepts current docs and the older shape (upper-case type, server-timestamp `at`, `notes`). */
function fromCloudEvent(id: string, data: DocumentData): CareEventRow | undefined {
  const type = String(data.type ?? "").toLowerCase();
  if (!(CARE_EVENT_TYPES as readonly string[]).includes(type)) return undefined;
  const at =
    typeof data.at === "string" ? data.at : data.at instanceof Timestamp ? data.at.toDate().toISOString() : undefined;
  if (!at || typeof data.plantId !== "string") return undefined;
  const note = typeof data.note === "string" ? data.note : typeof data.notes === "string" ? data.notes : undefined;
  return { id, plantId: data.plantId, type: type as CareEventType, at, ...(note ? { note } : {}) };
}

function toCloudPhoto(photo: PlantPhoto): Record<string, unknown> {
  return {
    uid,
    plantId: photo.plantId,
    at: photo.at,
    kind: photo.kind ?? (photo.dataUrl ? "photo" : "note"),
    hasImage: Boolean(photo.dataUrl || photo.hasImage),
    ...(photo.note ? { note: photo.note } : {}),
    ...(photo.comments?.length ? { comments: photo.comments } : {}),
  };
}

function fromCloudPhoto(id: string, data: DocumentData): PlantPhoto | undefined {
  if (typeof data.plantId !== "string" || typeof data.at !== "string") return undefined;
  const comments = Array.isArray(data.comments)
    ? (data.comments as JournalComment[]).filter((c) => c && typeof c.text === "string")
    : undefined;
  return {
    id,
    plantId: data.plantId,
    at: data.at,
    kind: data.kind === "note" ? "note" : "photo",
    hasImage: Boolean(data.hasImage),
    ...(typeof data.note === "string" ? { note: data.note } : {}),
    ...(comments?.length ? { comments } : {}),
  };
}

// ---------------------------------------------------------------------------
// Write queue: every cloud write goes through here so offline edits survive.
// ---------------------------------------------------------------------------

type QueuedWrite = PendingWrite;
type NewWrite = { entityId: string } & (
  | { kind: "plant-upsert"; payload: PlantRow }
  | { kind: "plant-delete" }
  | { kind: "event-upsert"; payload: CareEventRow }
  | { kind: "event-delete" }
  | { kind: "photo-upsert"; payload: PlantPhoto }
  | { kind: "photo-delete" }
  | { kind: "photo-blob"; payload: { plantId: string; dataUrl: string } }
);

function queueKey(kind: QueuedWrite["kind"], entityId: string): string {
  const group = kind === "photo-blob" ? "blob" : kind.split("-")[0];
  return `${group}:${entityId}`;
}

async function pushToCloud(write: NewWrite): Promise<void> {
  const fs = firestoreDb!;
  const id = write.entityId;
  switch (write.kind) {
    case "plant-upsert":
      return setDoc(doc(fs, "plants", id), toCloudPlant(write.payload), { merge: true });
    case "plant-delete":
      return deleteDoc(doc(fs, "plants", id));
    case "event-upsert":
      return setDoc(doc(fs, "care_events", id), toCloudEvent(write.payload));
    case "event-delete":
      return deleteDoc(doc(fs, "care_events", id));
    case "photo-upsert":
      return setDoc(doc(fs, "photos", id), toCloudPhoto(write.payload));
    case "photo-delete":
      await deleteDoc(doc(fs, "photo_blobs", id));
      return deleteDoc(doc(fs, "photos", id));
    case "photo-blob":
      return setDoc(doc(fs, "photo_blobs", id), { uid, plantId: write.payload.plantId, dataUrl: write.payload.dataUrl });
  }
}

async function enqueue(write: NewWrite): Promise<void> {
  await localDb.pending.put({ ...write, id: queueKey(write.kind, write.entityId), at: Date.now() } as QueuedWrite);
}

/** Send a write now if we can, otherwise queue it for the next flush. */
async function mirror(write: NewWrite): Promise<void> {
  if (!cloudReady() || !isOnline()) return enqueue(write);
  try {
    await pushToCloud(write);
  } catch (err) {
    console.warn("Silvae sync: cloud write failed, queued for retry:", err);
    await enqueue(write);
  }
}

async function isQueued(group: "plant" | "event" | "photo", id: string): Promise<boolean> {
  if (await localDb.pending.get(`${group}:${id}`)) return true;
  // Legacy rows keyed by the bare plant id.
  return group === "plant" && Boolean(await localDb.pending.get(id));
}

/**
 * Upload every queued write. Called when the app comes back online, after
 * sign-in, and opportunistically after successful writes.
 */
export async function flushPendingWrites(): Promise<void> {
  if (!cloudReady() || !isOnline()) return;
  const pending = await localDb.pending.orderBy("id").toArray();
  pending.sort((a, b) => a.at - b.at);
  for (const row of pending) {
    try {
      const entityId = row.entityId ?? row.id;
      await pushToCloud({ ...row, entityId } as NewWrite);
      await localDb.pending.delete(row.id);
    } catch (err) {
      console.warn("Silvae sync: retry failed, keeping queued write:", err);
    }
  }
}

/** Number of edits on this device that haven't reached the cloud yet. */
export async function pendingWriteCount(): Promise<number> {
  return localDb.pending.count();
}

// ---------------------------------------------------------------------------
// Public data API used by the pages.
// ---------------------------------------------------------------------------

export async function addPlant(row: PlantRow): Promise<string> {
  const withRev: PlantRow = { ...row, rev: String(Date.now()) };
  const id = await addLocalPlant(withRev);
  await mirror({ kind: "plant-upsert", entityId: id, payload: withRev });
  return id;
}

export async function savePlant(row: PlantRow): Promise<void> {
  const withRev: PlantRow = { ...row, rev: String(Date.now()) };
  await saveLocalPlant(withRev);
  await mirror({ kind: "plant-upsert", entityId: row.id, payload: withRev });
}

/** Removes the plant everywhere, including its care history and journal. */
export async function deletePlant(id: string): Promise<void> {
  const { eventIds, photoIds } = await deleteLocalPlant(id);
  for (const eventId of eventIds) await mirror({ kind: "event-delete", entityId: eventId });
  for (const photoId of photoIds) await mirror({ kind: "photo-delete", entityId: photoId });
  await mirror({ kind: "plant-delete", entityId: id });
}

export async function logCareEvent(event: CareEventRow): Promise<void> {
  await logLocalCareEvent(event);
  await mirror({ kind: "event-upsert", entityId: event.id, payload: event });
}

export async function deleteCareEvent(id: string): Promise<void> {
  await deleteLocalCareEvent(id);
  await mirror({ kind: "event-delete", entityId: id });
}

/** Save a journal entry; pass `uploadImage` when its photo is new or changed. */
export async function saveJournalEntry(photo: PlantPhoto, opts?: { uploadImage?: boolean }): Promise<void> {
  await putLocalPhoto(photo);
  await mirror({ kind: "photo-upsert", entityId: photo.id, payload: photo });
  if (opts?.uploadImage && photo.dataUrl) {
    await mirror({ kind: "photo-blob", entityId: photo.id, payload: { plantId: photo.plantId, dataUrl: photo.dataUrl } });
  }
}

export async function deleteJournalEntry(id: string): Promise<void> {
  await deleteLocalPhoto(id);
  await mirror({ kind: "photo-delete", entityId: id });
}

export async function getJournalEntry(id: string): Promise<PlantPhoto | undefined> {
  return getLocalPhoto(id);
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

/** Latest water and fertilize event per plant, for the Home "today" lists. */
export async function latestCare(): Promise<{ water: Record<string, CareEventRow>; fertilize: Record<string, CareEventRow> }> {
  const [water, fertilize] = await Promise.all([latestLocalCare("water"), latestLocalCare("fertilize")]);
  return { water, fertilize };
}

/** Preferences that follow the person between devices (location stays on-device). */
export type SyncedPrefs = { pets: Settings["pets"]; fertilizer?: MyFertilizer };

export async function pushPrefs(prefs: SyncedPrefs): Promise<void> {
  if (!cloudReady() || !isOnline()) return;
  try {
    await setDoc(
      doc(firestoreDb!, "users", uid!),
      { prefs: { pets: prefs.pets, fertilizer: prefs.fertilizer ?? null } },
      { merge: true },
    );
  } catch (err) {
    console.warn("Silvae sync: preferences not uploaded:", err);
  }
}

// ---------------------------------------------------------------------------
// Pull: live listeners that mirror the cloud into Dexie.
// ---------------------------------------------------------------------------

async function downloadImage(id: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(firestoreDb!, "photo_blobs", id));
    const dataUrl = snap.data()?.dataUrl;
    const local = await getLocalPhoto(id);
    if (typeof dataUrl !== "string" || !local) return false;
    await putLocalPhoto({ ...local, dataUrl });
    return true;
  } catch (err) {
    console.warn("Silvae sync: photo download failed:", err);
    return false;
  }
}

/**
 * Data created on this device before care history and photos synced only
 * lived here. Queue it all once per account so other devices receive it.
 */
async function backfillOnce(u: string): Promise<void> {
  const key = `silvae-backfill-v2:${u}`;
  try {
    if (localStorage.getItem(key)) return;
  } catch {
    return;
  }
  const [plants, events, photos] = await Promise.all([
    localDb.plants.toArray(),
    localDb.careEvents.toArray(),
    localDb.plantPhotos.toArray(),
  ]);
  for (const p of plants) await enqueue({ kind: "plant-upsert", entityId: p.id, payload: p });
  for (const e of events) await enqueue({ kind: "event-upsert", entityId: e.id, payload: e });
  for (const ph of photos) {
    await enqueue({ kind: "photo-upsert", entityId: ph.id, payload: ph });
    if (ph.dataUrl) await enqueue({ kind: "photo-blob", entityId: ph.id, payload: { plantId: ph.plantId, dataUrl: ph.dataUrl } });
  }
  try {
    localStorage.setItem(key, new Date().toISOString());
  } catch {
    // storage blocked: harmless, setDoc is idempotent
  }
}

/**
 * Two-way mirror: pulls the signed-in user's plants, care history, journal
 * and preferences into Dexie and keeps them current. Conflict rule: local
 * wins while a write is still queued; for plants the newer `rev` wins.
 * `onChange` fires after each batch so the UI can refresh.
 */
export function subscribeToCloud(u: string, onChange: () => void): Unsubscribe | undefined {
  if (!firestoreDb || !isFirebaseConfigured) return undefined;
  const fs = firestoreDb;
  const mine = (name: string) => query(collection(fs, name), where("uid", "==", u));
  const warn = (err: unknown) => console.warn("Silvae sync:", err);

  void backfillOnce(u).then(() => flushPendingWrites());

  const unsubs: Unsubscribe[] = [
    onSnapshot(
      mine("plants"),
      (snap) => {
        void (async () => {
          for (const change of snap.docChanges()) {
            const id = change.doc.id;
            if (change.type === "removed") {
              await localDb.pending.delete(`plant:${id}`);
              await removePlantDoc(id);
              continue;
            }
            if (await isQueued("plant", id)) continue;
            const cloud = fromCloudPlant(id, change.doc.data());
            const local = await getLocalPlant(id);
            if (local?.rev && cloud.rev && Number(cloud.rev) <= Number(local.rev)) continue;
            // Keep a full-size local avatar if the cloud only had room for none.
            await saveLocalPlant(cloud.avatarPhotoUrl || !local?.avatarPhotoUrl ? cloud : { ...cloud, avatarPhotoUrl: local.avatarPhotoUrl });
          }
          onChange();
        })();
      },
      warn,
    ),
    onSnapshot(
      mine("care_events"),
      (snap) => {
        void (async () => {
          for (const change of snap.docChanges()) {
            const id = change.doc.id;
            if (await isQueued("event", id)) continue;
            if (change.type === "removed") {
              await deleteLocalCareEvent(id);
              continue;
            }
            const event = fromCloudEvent(id, change.doc.data());
            if (event) await logLocalCareEvent(event);
          }
          onChange();
        })();
      },
      warn,
    ),
    onSnapshot(
      mine("photos"),
      (snap) => {
        void (async () => {
          const toDownload: string[] = [];
          for (const change of snap.docChanges()) {
            const id = change.doc.id;
            if (await isQueued("photo", id)) continue;
            if (change.type === "removed") {
              await deleteLocalPhoto(id);
              continue;
            }
            const cloud = fromCloudPhoto(id, change.doc.data());
            if (!cloud) continue;
            const local = await getLocalPhoto(id);
            await putLocalPhoto({ ...cloud, ...(local?.dataUrl ? { dataUrl: local.dataUrl } : {}) });
            if (cloud.hasImage && !local?.dataUrl) toDownload.push(id);
          }
          onChange();
          for (const id of toDownload) {
            if (await downloadImage(id)) onChange();
          }
        })();
      },
      warn,
    ),
    onSnapshot(
      doc(fs, "users", u),
      (snap) => {
        const prefs = snap.data()?.prefs as { pets?: Settings["pets"]; fertilizer?: MyFertilizer | null } | undefined;
        if (!prefs) return;
        void (async () => {
          const current = (await getSettings()) ?? { pets: { cat: false, dog: false } };
          await saveSettings({
            ...current,
            ...(prefs.pets ? { pets: { cat: Boolean(prefs.pets.cat), dog: Boolean(prefs.pets.dog) } } : {}),
            fertilizer: prefs.fertilizer ?? undefined,
          });
          onChange();
        })();
      },
      warn,
    ),
  ];
  return () => unsubs.forEach((stop) => stop());
}

/**
 * Account deletion: remove every document this account owns in the cloud,
 * straight from Firestore so nothing is missed, then forget it locally.
 */
export async function deleteAllCloudData(): Promise<void> {
  if (!firestoreDb || !uid) return;
  const fs = firestoreDb;
  const me = uid;
  for (const name of ["photo_blobs", "photos", "care_events", "plants"]) {
    const snap = await getDocs(query(collection(fs, name), where("uid", "==", me)));
    for (let i = 0; i < snap.docs.length; i += 400) {
      const batch = writeBatch(fs);
      snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }
  await deleteDoc(doc(fs, "users", me));
  await clearLocalData();
}

/** Forget everything on this device for the signed-in person (used on sign-out). */
export async function wipeLocalData(): Promise<void> {
  await clearLocalData();
}
