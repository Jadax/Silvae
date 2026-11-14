import Dexie, { type EntityTable, type Table } from "dexie";
import type { CareEvent, Plant } from "@silvae/core";

export type PlantRow = Plant & { nextWaterAt?: string; careLevel?: number; rev?: string };
export type CareEventRow = CareEvent;

export type JournalComment = { id: string; at: string; text: string };

/** A journal entry for a plant: a dated photo, a text note, or both. */
export type PlantPhoto = {
  id: string;
  plantId: string;
  at: string;
  dataUrl?: string;
  kind?: "photo" | "note";
  note?: string;
  comments?: JournalComment[];
  /** True when the entry has an image, even if this device hasn't downloaded it yet. */
  hasImage?: boolean;
};

/** The fertiliser the person actually uses, so feeding advice can say "2 ml of X per litre". */
export type MyFertilizer = {
  name: string;
  /** Label dose per litre of water at full strength. */
  dosePerLiter: number;
  unit: "ml" | "g";
};

export type Settings = {
  pets: { cat: boolean; dog: boolean };
  location?: { lat: number; lon: number; label: string };
  onboarded?: boolean;
  fertilizer?: MyFertilizer;
};

export type SettingsRow = { id: "profile" } & Settings;

/**
 * A queued cloud write so offline edits reach Firestore once we're back
 * online. `id` is the queue key (`plant:<id>`, `event:<id>`, `photo:<id>`,
 * `blob:<id>`) so an entity's latest upsert or delete replaces older ones.
 * Rows written before keys were namespaced use the bare plant id.
 */
export type PendingWrite = { id: string; entityId?: string; at: number } & (
  | { kind: "plant-upsert"; payload: PlantRow }
  | { kind: "plant-delete" }
  | { kind: "event-upsert"; payload: CareEventRow }
  | { kind: "event-delete" }
  | { kind: "photo-upsert"; payload: PlantPhoto }
  | { kind: "photo-delete" }
  | { kind: "photo-blob"; payload: { plantId: string; dataUrl: string } }
);

const db = new Dexie("silvae") as Dexie & {
  plants: EntityTable<PlantRow, "id">;
  careEvents: EntityTable<CareEventRow, "id">;
  rooms: EntityTable<{ id: string; name: string }, "id">;
  plantPhotos: EntityTable<PlantPhoto, "id">;
  settings: EntityTable<SettingsRow, "id">;
  pending: Table<PendingWrite, string>;
};

db.version(1).stores({
  plants: "id, ownerUid, roomId, nextWaterAt, careLevel",
  careEvents: "id, plantId, type, at, [plantId+at]",
  rooms: "id",
});

db.version(2).stores({
  plants: "id, ownerUid, roomId, nextWaterAt, careLevel",
  careEvents: "id, plantId, type, at, [plantId+at]",
  rooms: "id",
  plantPhotos: "id, plantId, at, [plantId+at]",
  settings: "id",
});

db.version(3).stores({
  plants: "id, ownerUid, roomId, nextWaterAt, careLevel",
  careEvents: "id, plantId, type, at, [plantId+at]",
  rooms: "id",
  plantPhotos: "id, plantId, at, [plantId+at]",
  settings: "id",
  pending: "id",
});

export async function getSettings(): Promise<Settings | undefined> {
  return db.settings.get("profile");
}

export async function saveSettings(settings: Settings): Promise<void> {
  await db.settings.put({ id: "profile", ...settings });
}

export async function addPlant(plant: PlantRow): Promise<string> {
  return db.plants.put(plant).then(() => plant.id);
}

export async function listPlants(): Promise<PlantRow[]> {
  return db.plants.toArray();
}

export async function getPlant(id: string): Promise<PlantRow | undefined> {
  return db.plants.get(id);
}

export async function savePlant(plant: PlantRow): Promise<void> {
  await db.plants.put(plant);
}

/** Delete a plant with its care history and journal; returns the removed child ids. */
export async function deletePlant(id: string): Promise<{ eventIds: string[]; photoIds: string[] }> {
  return db.transaction("rw", db.plants, db.careEvents, db.plantPhotos, async () => {
    const eventIds = (await db.careEvents.where("plantId").equals(id).primaryKeys()) as string[];
    const photoIds = (await db.plantPhotos.where("plantId").equals(id).primaryKeys()) as string[];
    await db.plants.delete(id);
    await db.careEvents.bulkDelete(eventIds);
    await db.plantPhotos.bulkDelete(photoIds);
    return { eventIds, photoIds };
  });
}

/** Delete just the plant doc locally (used when a cloud doc is removed). */
export async function removePlantDoc(id: string): Promise<void> {
  await db.plants.delete(id);
}

/** Wipe everything stored for the signed-in person (sign-out on a shared device). */
export async function clearLocalData(): Promise<void> {
  await db.transaction("rw", [db.plants, db.careEvents, db.rooms, db.plantPhotos, db.settings, db.pending], async () => {
    await Promise.all([
      db.plants.clear(),
      db.careEvents.clear(),
      db.rooms.clear(),
      db.plantPhotos.clear(),
      db.settings.clear(),
      db.pending.clear(),
    ]);
  });
}

export async function logCareEvent(event: CareEventRow): Promise<void> {
  await db.careEvents.put(event);
}

export async function deleteCareEvent(id: string): Promise<void> {
  await db.careEvents.delete(id);
}

/** A plant's care events, newest first by when they happened (not when they were logged). */
export async function careHistory(plantId: string, limit = 50): Promise<CareEventRow[]> {
  return db.careEvents
    .where("[plantId+at]")
    .between([plantId, Dexie.minKey], [plantId, Dexie.maxKey])
    .reverse()
    .limit(limit)
    .toArray();
}

/** The latest event of a type for every plant (e.g. when each plant was last fed). */
export async function latestCareByPlant(type: CareEventRow["type"]): Promise<Record<string, CareEventRow>> {
  const out: Record<string, CareEventRow> = {};
  await db.careEvents.where("type").equals(type).each((event) => {
    const seen = out[event.plantId];
    if (!seen || event.at > seen.at) out[event.plantId] = event;
  });
  return out;
}

export async function addPlantPhoto(photo: PlantPhoto): Promise<void> {
  await db.plantPhotos.put(photo);
}

export async function getPlantPhoto(id: string): Promise<PlantPhoto | undefined> {
  return db.plantPhotos.get(id);
}

export async function listPlantPhotos(plantId: string, limit = 200): Promise<PlantPhoto[]> {
  return db.plantPhotos
    .where("[plantId+at]")
    .between([plantId, Dexie.minKey], [plantId, Dexie.maxKey])
    .reverse()
    .limit(limit)
    .toArray();
}

export async function deletePlantPhoto(id: string): Promise<void> {
  await db.plantPhotos.delete(id);
}

export default db;
