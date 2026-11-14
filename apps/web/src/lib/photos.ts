import type { JournalComment, PlantPhoto } from "./db";
import { fileToPayload } from "./identify";
import { deleteJournalEntry, getJournalEntry, saveJournalEntry } from "./repo";
import { listPlantPhotos } from "./db";

const MAX_PLANT_PHOTO_BYTES = 360 * 1024;
const MAX_AVATAR_BYTES = 40 * 1024;

/** A journal-quality photo (≤960px, ≤360 KB) that stays usable offline and syncs between devices. */
export async function preparePlantPhoto(file: File | Blob): Promise<string> {
  const payload = await fileToPayload(file, { maxDim: 960, maxBytes: MAX_PLANT_PHOTO_BYTES });
  if (!payload) throw new Error("We couldn't prepare that photo. Try another image.");
  return payload.base64;
}

/** A small square-ish thumbnail for the plant's avatar, light enough to sync on the plant itself. */
export async function prepareAvatar(source: File | Blob | string): Promise<string> {
  const blob = typeof source === "string" ? await (await fetch(source)).blob() : source;
  const payload = await fileToPayload(blob, { maxDim: 320, maxBytes: MAX_AVATAR_BYTES });
  if (!payload) throw new Error("We couldn't prepare that photo. Try another image.");
  return payload.base64;
}

/** Add a dated photo to a plant's journal (camera capture or upload). */
export async function saveJournalPhoto(
  plantId: string,
  file: File | Blob,
  opts?: { note?: string; at?: Date },
): Promise<PlantPhoto> {
  const photo: PlantPhoto = {
    id: crypto.randomUUID(),
    plantId,
    at: (opts?.at ?? new Date()).toISOString(),
    kind: "photo",
    dataUrl: await preparePlantPhoto(file),
    hasImage: true,
    ...(opts?.note?.trim() ? { note: opts.note.trim() } : {}),
  };
  await saveJournalEntry(photo, { uploadImage: true });
  return photo;
}

export async function journalPhotos(plantId: string): Promise<PlantPhoto[]> {
  return listPlantPhotos(plantId);
}

export async function removeJournalPhoto(id: string): Promise<void> {
  await deleteJournalEntry(id);
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
  await saveJournalEntry(entry);
  return entry;
}

/** Set (or clear) the note/caption on a journal entry. */
export async function setJournalNote(entryId: string, note: string): Promise<void> {
  const existing = await getJournalEntry(entryId);
  if (!existing) return;
  const trimmed = note.trim();
  const { note: _old, ...rest } = existing;
  await saveJournalEntry(trimmed ? { ...rest, note: trimmed } : rest);
}

/** Add a comment to a journal entry. */
export async function addJournalComment(entryId: string, text: string): Promise<void> {
  const existing = await getJournalEntry(entryId);
  if (!existing) return;
  const comment: JournalComment = { id: crypto.randomUUID(), at: new Date().toISOString(), text: text.trim() };
  await saveJournalEntry({ ...existing, comments: [...(existing.comments ?? []), comment] });
}
