import { z } from "zod";
import { admin, requireUid, AuthError } from "../lib/firebase.js";

const Body = z.object({
  imageFingerprint: z.string().min(8),
  base64: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

// Cache docs: single `caches` collection with kind-prefixed ids (`id:{fingerprint}`)
// so the path stays a valid one-segment collection reference for every SDK.
const CACHE_COLLECTION = "caches";
const cacheDocId = (fingerprint: string): string => `id:${fingerprint}`;
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

interface PlantNetPayload {
  results?: {
    score?: number;
    species?: { scientificNameWithoutAuthor?: string };
  }[];
}

/**
 * Normalize the raw PlantNet v2 identification payload into the public
 * `IdentifyResponse` shape. PlantNet has no health/disease fields, so only
 * the species suggestions are carried across. Kept pure for testability.
 */
export function normalizePlantNet(payload: unknown): Omit<IdentifyResponse, "cached"> {
  const p = payload as PlantNetPayload;
  return {
    species: (p?.results ?? [])
      .filter(
        (r) => typeof r?.species?.scientificNameWithoutAuthor === "string",
      )
      .map((r) => ({
        scientificName: r.species!.scientificNameWithoutAuthor!,
        ...(typeof r.score === "number" ? { confidence: r.score } : {}),
      })),
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

async function tryPlantId(
  base64: string,
  latitude?: number,
  longitude?: number,
): Promise<Response> {
  const key = process.env.PLANT_ID_API_KEY!;
  const upstream = await fetch("https://api.plant.id/v3/identifications", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Api-Key": key },
    body: JSON.stringify({ images: [base64], latitude, longitude, health: "auto" }),
  });
  if (upstream.status === 429) {
    return Response.json(
      { error: "budget_exhausted", hint: "fall back to PlantNet → manual search" },
      { status: 429 },
    );
  }
  if (!upstream.ok) {
    return Response.json({ error: "upstream", status: upstream.status }, { status: 502 });
  }
  const payload = await upstream.json();
  return Response.json({ cached: false, source: "plant-id", ...normalizePlantId(payload) });
}

async function tryPlantNet(base64: string, latitude?: number, longitude?: number): Promise<Response> {
  const key = process.env.PLANTNET_API_KEY!;
  const project = process.env.PLANTNET_PROJECT ?? "all";
  const base64Data = base64.includes(",") ? base64.slice(base64.indexOf(",") + 1) : base64;
  const form = new FormData();
  form.append("images", new Blob([Buffer.from(base64Data, "base64")]), "plant.webp");
  if (typeof latitude === "number") form.append("latitude", String(latitude));
  if (typeof longitude === "number") form.append("longitude", String(longitude));

  const upstream = await fetch(
    `https://my-api.plantnet.org/v2/identify/${encodeURIComponent(project)}?api-key=${encodeURIComponent(key)}`,
    { method: "POST", body: form },
  );
  if (upstream.status === 429) {
    return Response.json(
      { error: "budget_exhausted", hint: "fall back to TFLite → manual search" },
      { status: 429 },
    );
  }
  if (!upstream.ok) {
    return Response.json({ error: "upstream", status: upstream.status }, { status: 502 });
  }
  const payload = await upstream.json();
  return Response.json({ cached: false, source: "plantnet", ...normalizePlantNet(payload) });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  // Plant.id/PlantNet quota is a shared, cost-sensitive pool (blueprint D-4) —
  // require a real account so an anonymous script can't drain the daily budget.
  try {
    await requireUid(req);
  } catch (err) {
    if (err instanceof AuthError) return Response.json({ error: "unauthorized" }, { status: 401 });
    throw err;
  }

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
      const cached = await db.collection(CACHE_COLLECTION).doc(cacheDocId(imageFingerprint)).get();
      if (cached.exists) {
        return Response.json({ ...cached.data(), cached: true });
      }
    } catch {
      // cache read failed — fall through to upstream
    }
  }

  const plantIdKey = process.env.PLANT_ID_API_KEY;
  const plantNetKey = process.env.PLANTNET_API_KEY;
  if (!plantIdKey && !plantNetKey) {
    return Response.json(
      { error: "no_key", hint: "fall back to TFLite → PlantNet → manual search" },
      { status: 503 },
    );
  }
  if (!base64) {
    return Response.json({ error: "image_required" }, { status: 400 });
  }

  // Preferred provider is Plant.id (richer health/disease data). If it is not
  // configured, or it runs out of quota / is unavailable, fall back to the free
  // (non-commercial) PlantNet API before giving up.
  let res: Response;
  if (plantIdKey) {
    res = await tryPlantId(base64, latitude, longitude);
    if (plantNetKey && (res.status === 429 || res.status === 502)) {
      res = await tryPlantNet(base64, latitude, longitude);
    }
  } else {
    res = await tryPlantNet(base64, latitude, longitude);
  }
  if (!res.ok) return res;

  const result = (await res.json()) as Record<string, unknown>;
  if (db) {
    try {
      await db
        .collection(CACHE_COLLECTION)
        .doc(cacheDocId(imageFingerprint))
        .set({ ...result, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + TTL_MS).toISOString() });
    } catch {
      // cache write failed — the fresh result is still returned
    }
  }

  return Response.json(result);
}
