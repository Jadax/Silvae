import { seasonAt, type Season, type Weather } from "@silvae/core";

/** Neutral indoor conditions used when there's no location or we're offline. */
const DEFAULT_WEATHER = { tempC: 22, rh: 55, uvIndex: 4, daylightHours: 12 };

/** Today's season where the plants are (southern hemisphere aware). */
export function currentSeason(lat?: number): Season {
  return seasonAt(new Date(), lat);
}

/** Fetch weather: server proxy (cached) → direct Open-Meteo → default env (offline). */
export async function fetchWeather(lat?: number, lon?: number): Promise<Weather> {
  if (lat !== undefined && lon !== undefined) {
    try {
      const res = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);
      if (res.ok) return (await res.json()) as Weather;
    } catch {
      // fall through to direct
    }
    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
          `&current=temperature_2m,relative_humidity_2m,precipitation,cloud_cover,uv_index` +
          `&daily=sunshine_duration&timezone=auto&forecast_days=1`,
      );
      if (res.ok) {
        const d = (await res.json()) as {
          current: { temperature_2m: number; relative_humidity_2m: number; precipitation: number; cloud_cover: number; uv_index: number };
          daily: { sunshine_duration: number[] };
        };
        return {
          tempC: d.current.temperature_2m,
          rh: d.current.relative_humidity_2m,
          uvIndex: d.current.uv_index,
          cloudCover: d.current.cloud_cover,
          precipitationMm: d.current.precipitation,
          daylightHours: Math.round((d.daily.sunshine_duration[0] ?? 0) / 3600),
          fetchedAt: new Date().toISOString(),
        };
      }
    } catch {
      // offline
    }
  }
  return { ...DEFAULT_WEATHER, cloudCover: 0, precipitationMm: 0, fetchedAt: new Date().toISOString() };
}
