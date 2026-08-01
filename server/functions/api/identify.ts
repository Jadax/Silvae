import { z } from "zod";
import { admin } from "../lib/firebase.js";

const Body = z.object({
  imageFingerprint: z.string().min(8),
  base64: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

const CACHE_COLLECTION = "caches/id";
const TTL_MS = 90 * 24 * 60 * 60 * 1000; // ~90 days: same photo never costs again

export interface IdentifySpecies {
  scientificName: string;
  confidence?: number;
}

export interface IdentifyResponse {
  cached: boolean;
  species: IdentifySpecies[];
  isPlant?: { probability?: number };
  isHealthy?: { probability?: number; binary?: boolean };
  disease?: { name?: string; probability?: number };
}

interface PlantIdPayload {
  result?: {
    is_plant?: { probability?: number };
    is_healthy?: { probability?: number; binary?: boolean };
    classification?: { suggestions?: { name?: string; probability?: number }[] };
    disease?: { suggestions?: { name?: string; probability?: number }[] };
  };
}

/**
 * Normalize the raw Plant.id v3 identification payload into the public
 * `IdentifyResponse` shape (openapi.yaml). Kept pure for testability.
 */
export function normalizePlantId(payload: unknown): Omit<IdentifyResponse, "cached"> {
  const p = payload as PlantIdPayload;
  const suggestions = p?.result?.classification?.suggestions ?? [];
  const disease = p?.result?.disease?.suggestions?.[0];
  const isHealthy = p?.result?.is_healthy;
  return {
    species: suggestions
      .filter((s): s is { name: string; probability?: number } => typeof s?.name === "string" && s.name.length > 0)
      .map((s) => ({ scientificName: s.name, confidence: s.probability })),
    ...(typeof p?.result?.is_plant?.probability === "number"
      ? { isPlant: { probability: p.result.is_plant.probability } }
      : {}),
    ...(isHealthy && typeof isHealthy.probability === "number"
      ? { isHealthy: { probability: isHealthy.probability, binary: isHealthy.binary } }
      : {}),
    ...(disease && typeof disease.name === "string" && disease.name.length > 0
      ? { disease: { name: disease.name, probability: disease.probability } }
      : {}),
  };
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  const { imageFingerprint, base64, latitude, longitude } = parsed.data;

  // Firestore cache is best-effort: a missing FIREBASE_SERVICE_ACCOUNT or quota
  // problem must never block identification (matches blueprint D-4 resilience).
  let db: ReturnType<typeof admin>["db"] | undefined;
  try {
    db = admin().db;
  } catch {
    db = undefined;
  }

  if (db) {
    try {
      const cached = await db.collection(CACHE_COLLECTION).doc(imageFingerprint).get();
      if (cached.exists) {
        return Response.json({ ...cached.data(), cached: true });
      }
    } catch {
      // cache read failed — fall through to upstream
    }
  }

  const key = process.env.PLANT_ID_API_KEY;
  if (!key) {
    return Response.json(
      { error: "no_key", hint: "fall back to TFLite → PlantNet → manual search" },
      { status: 503 },
    );
  }
  if (!base64) {
    return Response.json({ error: "image_required" }, { status: 400 });
  }

  const upstream = await fetch("https://api.plant.id/v3/identifications", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Api-Key": key },
    body: JSON.stringify({
      images: [base64],
      latitude,
      longitude,
      health: "auto",
    }),
  });

  if (upstream.status === 429) {
    return Response.json(
      { error: "budget_exhausted", hint: "fall back to TFLite → PlantNet → manual search" },
      { status: 429 },
    );
  }
  if (!upstream.ok) {
    return Response.json({ error: "upstream", status: upstream.status }, { status: 502 });
  }

  const payload = await upstream.json();
  const result: IdentifyResponse = { cached: false, ...normalizePlantId(payload) };

  if (db) {
    try {
      await db
        .collection(CACHE_COLLECTION)
        .doc(imageFingerprint)
        .set({ ...result, expiresAt: new Date(Date.now() + TTL_MS).toISOString() });
    } catch {
      // cache write failed — the fresh result is still returned
    }
  }

  return Response.json(result);
}
