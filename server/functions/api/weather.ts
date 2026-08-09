import { z } from "zod";
import { admin } from "../lib/firebase.js";

const Query = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
});

// Cache docs: single `caches` collection with kind-prefixed ids (`weather:{key}`)
// so the path stays a valid one-segment collection reference for every SDK.
const CACHE_COLLECTION = "caches";
const CACHE_DOC_PREFIX = "weather:";
const TTL_MS = 3 * 60 * 60 * 1000; // 3 h per location

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "GET") return new Response("Method Not Allowed", { status: 405 });

  const url = new URL(req.url, "https://internal.silvae.invalid");
  const parsed = Query.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return Response.json({ error: "invalid_query", issues: parsed.error.issues }, { status: 400 });
  }
  const { lat, lon } = parsed.data;
  const key = `${CACHE_DOC_PREFIX}${lat.toFixed(2)},${lon.toFixed(2)}`;
  const { db } = admin();

  const doc = await db.collection(CACHE_COLLECTION).doc(key).get();
  if (doc.exists) {
    const cached = doc.data();
    if (cached && cached.expiresAt && new Date(cached.expiresAt).getTime() > Date.now()) {
      return Response.json({ cached: true, ...cached.payload });
    }
  }

  const upstream = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,relative_humidity_2m,precipitation,cloud_cover,uv_index` +
      `&daily=sunshine_duration&timezone=auto&forecast_days=1`,
  );
  if (!upstream.ok) {
    return Response.json({ error: "upstream", status: upstream.status }, { status: 502 });
  }
  const data = (await upstream.json()) as {
    current: { temperature_2m: number; relative_humidity_2m: number; precipitation: number; cloud_cover: number; uv_index: number };
    daily: { sunshine_duration: number[] };
  };

  const payload = {
    tempC: data.current.temperature_2m,
    rh: data.current.relative_humidity_2m,
    precipitationMm: data.current.precipitation,
    cloudCover: data.current.cloud_cover,
    uvIndex: data.current.uv_index,
    daylightHours: Math.round((data.daily.sunshine_duration[0] ?? 0) / 3600),
    fetchedAt: new Date().toISOString(),
  };

  await db
    .collection(CACHE_COLLECTION)
    .doc(key)
    .set({ payload, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + TTL_MS).toISOString() });

  return Response.json({ cached: false, ...payload });
}
