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
};

export type Settings = {
  pets: { cat: boolean; dog: boolean };
  location?: { lat: number; lon: number; label: string };
  onboarded?: boolean;
};

export type SettingsRow = { id: "profile" } & Settings;

/** A queued cloud write so offline edits reach Firestore once we're back online. */
export type PendingWrite =
  | { id: string; kind: "plant-upsert"; payload: PlantRow; at: number }
  | { id: string; kind: "plant-delete"; at: number };

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

export async function deletePlant(id: string): Promise<void> {
  await db.transaction("rw", db.plants, db.careEvents, async () => {
    await db.plants.delete(id);
    await db.careEvents.where("plantId").equals(id).delete();
  });
}

/** Delete just the plant doc locally (used when a cloud doc is removed). */
export async function removePlantDoc(id: string): Promise<void> {
  await db.plants.delete(id);
}

export async function logCareEvent(event: CareEventRow): Promise<void> {
  await db.careEvents.put(event);
}

export async function careHistory(plantId: string, limit = 50): Promise<CareEventRow[]> {
  return db.careEvents
    .where("plantId")
    .equals(plantId)
    .reverse()
    .limit(limit)
    .toArray();
}

export async function recentCareEvents(limit = 400): Promise<CareEventRow[]> {
  return db.careEvents.orderBy("at").reverse().limit(limit).toArray();
}

export async function addPlantPhoto(photo: PlantPhoto): Promise<void> {
  await db.plantPhotos.put(photo);
}

export async function getPlantPhoto(id: string): Promise<PlantPhoto | undefined> {
  return db.plantPhotos.get(id);
}

export async function updatePlantPhoto(photo: PlantPhoto): Promise<void> {
  await db.plantPhotos.put(photo);
}

export async function listPlantPhotos(plantId: string, limit = 200): Promise<PlantPhoto[]> {
  return db.plantPhotos
    .where("plantId")
    .equals(plantId)
    .reverse()
    .limit(limit)
    .toArray();
}

export async function deletePlantPhoto(id: string): Promise<void> {
  await db.plantPhotos.delete(id);
}

export default db;
