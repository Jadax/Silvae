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
