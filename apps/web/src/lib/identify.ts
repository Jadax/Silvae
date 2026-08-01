import { SPECIES } from "./seed";
import type { IdentifySpecies } from "./api";

export const MAX_ID_IMAGE_BYTES = 150 * 1024;
export const MAX_ID_IMAGE_DIM = 1024;
const B64_CHUNK = 0x8000;

export interface MatchedSpecies {
  scientificName: string;
  confidence?: number;
  /** present only when the suggestion matches the offline catalog */
  slug?: string;
  commonNames: string[];
  inCatalog: boolean;
  /** genus hint for suggestions the catalog doesn't cover */
  genusName?: string;
}

/**
 * Normalize a scientific name for fuzzy matching: lower-case, treat ×/x as
 * the same hybrid mark, drop apostrophes, collapse whitespace.
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[×x]/g, "x")
    .replace(/['`\u2019]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Map Plant.id suggestions onto the offline catalog (`SPECIES`, bundled from
 * `data/species/*.json`). Exact scientific-name matches get care-guide links;
 * anything else is kept with a genus hint so the UI can offer a manual search.
 */
export function matchCatalog(
  suggestions: IdentifySpecies[],
  catalog: { slug: string; scientificName: string; commonNames: string[] }[] = SPECIES,
): MatchedSpecies[] {
  return suggestions
    .filter((s) => typeof s?.scientificName === "string" && s.scientificName.length > 0)
    .map((s) => {
      const name = s.scientificName as string;
      const norm = normalizeName(name);
      const hit = catalog.find((c) => normalizeName(c.scientificName) === norm);
      const genusName = norm.split(" ")[0];
      return {
        scientificName: name,
        confidence: s.confidence,
        slug: hit?.slug,
        commonNames: hit?.commonNames ?? [],
        inCatalog: Boolean(hit),
        genusName: hit ? undefined : genusName,
      };
    });
}

/** Decode an image file/Blob into an HTMLImageElement for canvas scaling. */
export function loadImage(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image_decode_failed"));
    };
    img.src = url;
  });
}

async function encodeWebP(
  img: HTMLImageElement,
  maxDim: number,
  quality: number,
): Promise<Blob | null> {
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));
}

/**
 * Downscale a phone photo (camera shot or screenshot) to a Plant.id-friendly
 * WebP ≤150KB. Shrinks quality first, then dimension, to stay under budget.
 */
export async function fileToPayload(
  file: File | Blob,
  opts?: { maxDim?: number; maxBytes?: number },
): Promise<{ base64: string; bytes: Uint8Array } | null> {
  const maxDim = opts?.maxDim ?? MAX_ID_IMAGE_DIM;
  const maxBytes = opts?.maxBytes ?? MAX_ID_IMAGE_BYTES;

  const img = await loadImage(file);
  let quality = 0.82;
  let blob = await encodeWebP(img, maxDim, quality);
  while (blob && blob.size > maxBytes && quality > 0.4) {
    quality -= 0.12;
    blob = await encodeWebP(img, maxDim, quality);
  }
  if (blob && blob.size > maxBytes) {
    blob = await encodeWebP(img, Math.max(256, Math.floor(maxDim / 2)), 0.7);
  }
  if (!blob) return null;

  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (bytes.length === 0 || bytes.length > maxBytes * 2) return null;

  let bin = "";
  for (let i = 0; i < bytes.length; i += B64_CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + B64_CHUNK));
  }
  return { base64: `data:image/webp;base64,${btoa(bin)}`, bytes };
}

/** sha256 hex digest of the image bytes — the server-side cache key (D-4). */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as unknown as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
