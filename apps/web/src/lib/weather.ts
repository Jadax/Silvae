import type { Env, Weather } from "@silvae/core";

export const DEFAULT_ENV: Env = {
  tempC: 22,
  rh: 55,
  uvIndex: 4,
  season: "summer",
  daylightH: 14,
};

/** Reads the current season from month (northern hemisphere). */
export function seasonForMonth(month: number): Env["season"] {
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
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
  return {
    tempC: DEFAULT_ENV.tempC,
    rh: DEFAULT_ENV.rh,
    uvIndex: DEFAULT_ENV.uvIndex,
    cloudCover: 0,
    precipitationMm: 0,
    daylightHours: DEFAULT_ENV.daylightH,
    fetchedAt: new Date().toISOString(),
  };
}

export function toEnv(w: Weather): Env {
  return {
    tempC: w.tempC,
    rh: w.rh,
    uvIndex: w.uvIndex,
    season: seasonForMonth(new Date().getMonth()),
    daylightH: w.daylightHours,
  };
}
