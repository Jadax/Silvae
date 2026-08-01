/**
 * Typed runtime client for the Silvae serverless API.
 * Mirrors `packages/api/src/client.d.ts` (generated from openapi.yaml) without
 * pulling a types-only workspace package into the web bundle.
 */

export interface IdentifyRequest {
  /** sha256 of the downscaled image bytes — dedupes repeats via the server cache. */
  imageFingerprint: string;
  /** Downscaled WebP ≤150KB, base64 data URI. Omit only when re-checking a cached fingerprint. */
  base64?: string;
  latitude?: number;
  longitude?: number;
}

export interface IdentifySpecies {
  scientificName?: string;
  confidence?: number;
}

export interface IdentifyResponse {
  /** true when served from the Firestore fingerprint cache */
  cached?: boolean;
  /** Top Plant.id classification suggestions, highest confidence first */
  species?: IdentifySpecies[];
  isPlant?: { probability?: number };
  isHealthy?: { probability?: number; binary?: boolean };
  disease?: { name?: string; probability?: number };
}

interface ErrorBody {
  error?: string;
  hint?: string;
  status?: number;
}

export class IdentifyError extends Error {
  readonly code: string;
  readonly hint?: string;
  readonly status: number;

  constructor(code: string, status: number, hint?: string) {
    super(code);
    this.name = "IdentifyError";
    this.code = code;
    this.hint = hint;
    this.status = status;
  }
}

export async function identifyPlant(
  body: IdentifyRequest,
  base = "/api",
): Promise<IdentifyResponse> {
  const res = await fetch(`${base}/identify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let data: ErrorBody = {};
    try {
      data = (await res.json()) as ErrorBody;
    } catch {
      // non-JSON error body — fall back to status code
    }
    throw new IdentifyError(data.error ?? `http_${res.status}`, res.status, data.hint);
  }

  return (await res.json()) as IdentifyResponse;
}

/** Human-readable fallback messaging for the most common failure modes. */
export function describeIdentifyError(err: unknown): string {
  if (err instanceof IdentifyError) {
    switch (err.code) {
      case "no_key":
        return "Species ID isn't configured on the server yet — try searching the catalog below.";
      case "budget_exhausted":
        return "Today's identification budget is used up. Try again tomorrow, or search the catalog below.";
      case "upstream":
        return "The identification service is temporarily unavailable. Try again in a moment.";
      case "image_required":
        return "No usable image was sent. Pick a photo and try again.";
      case "invalid_body":
        return "The request was malformed. Try again.";
      default:
        return err.status === 429
          ? "Too many requests — try again in a minute."
          : "Identification failed. Check your connection and try again.";
    }
  }
  return "Could not reach the identification service (offline?). Try again when connected.";
}
