import { addPlantPhoto, deletePlantPhoto, getPlantPhoto, listPlantPhotos, updatePlantPhoto, type JournalComment, type PlantPhoto } from "./db";
import { fileToPayload } from "./identify";

const MAX_PLANT_PHOTO_BYTES = 360 * 1024;

/**
 * Produce a compact local photo that stays available while the app is offline.
 * Cloud sync deliberately skips data URLs; R2 will own remote image storage.
 */
export async function preparePlantPhoto(file: File): Promise<string> {
  const payload = await fileToPayload(file, {
    maxDim: 960,
    maxBytes: MAX_PLANT_PHOTO_BYTES,
  });
  if (!payload) throw new Error("We couldn't prepare that photo. Try another image.");
  return payload.base64;
}

/** Add a dated photo to a plant's journal (camera capture or upload). */
export async function saveJournalPhoto(plantId: string, file: File | Blob): Promise<PlantPhoto> {
  const dataUrl = await preparePlantPhoto(
    new File([file], file instanceof File ? file.name || "photo.jpg" : "photo.jpg", { type: file.type || "image/jpeg" }),
  );
  const photo: PlantPhoto = {
    id: crypto.randomUUID(),
    plantId,
    at: new Date().toISOString(),
    kind: "photo",
    dataUrl,
  };
  await addPlantPhoto(photo);
  return photo;
}

export async function journalPhotos(plantId: string): Promise<PlantPhoto[]> {
  return listPlantPhotos(plantId);
}

export async function removeJournalPhoto(id: string): Promise<void> {
  await deletePlantPhoto(id);
}

/** Log a dated text note (no photo) into the plant's journal. */
export async function saveJournalNote(plantId: string, text: string): Promise<PlantPhoto> {
  const entry: PlantPhoto = {
    id: crypto.randomUUID(),
    plantId,
    at: new Date().toISOString(),
    kind: "note",
    note: text.trim(),
  };
  await addPlantPhoto(entry);
  return entry;
}

/** Set (or clear) the note/caption on a journal entry. */
export async function setJournalNote(entryId: string, note: string): Promise<void> {
  const existing = (await getPlantPhoto(entryId)) ?? { id: entryId };
  await updatePlantPhoto({ ...existing, id: entryId, note: note.trim() } as PlantPhoto);
}

/** Add a comment to a journal entry. */
export async function addJournalComment(entryId: string, text: string): Promise<PlantPhoto> {
  const trimmed = text.trim();
  const existing = await getPlantPhoto(entryId);
  const comment: JournalComment = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    text: trimmed,
  };
  const entry = { ...existing, id: entryId, comments: [...(existing?.comments ?? []), comment] } as PlantPhoto;
  await updatePlantPhoto(entry);
  return entry;
}
