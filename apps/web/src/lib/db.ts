import Dexie, { type EntityTable } from "dexie";
import type { CareEvent, Plant } from "@silvae/core";

export type PlantRow = Plant & { nextWaterAt?: string; careLevel?: number };
export type CareEventRow = CareEvent;

const db = new Dexie("silvae") as Dexie & {
  plants: EntityTable<PlantRow, "id">;
  careEvents: EntityTable<CareEventRow, "id">;
  rooms: EntityTable<{ id: string; name: string }, "id">;
};

db.version(1).stores({
  plants: "id, ownerUid, roomId, nextWaterAt, careLevel",
  careEvents: "id, plantId, type, at, [plantId+at]",
  rooms: "id",
});

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

export default db;
