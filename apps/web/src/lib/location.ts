import type { Settings } from "./db";

export type Place = { lat: number; lon: number; label: string };

/** Prompt for device location (permission + fix). Rejects if denied/unavailable. */
export function detectLocation(timeoutMs = 10_000): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("This browser doesn't support location."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => {
        const message =
          err.code === err.PERMISSION_DENIED
            ? "Location access is turned off. You can type your city instead."
            : "We couldn't find your location. Try typing your city.";
        reject(new Error(message));
      },
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 60_000 },
    );
  });
}

/** Cheap free reverse geocoding (BigDataCloud, no key) for a friendly place label. */
export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
    );
    if (res.ok) {
      const d = (await res.json()) as {
        city?: string;
        locality?: string;
        principalSubdivision?: string;
        countryName?: string;
      };
      const parts = [d.city ?? d.locality, d.principalSubdivision, d.countryName].filter(
        Boolean,
      );
      if (parts.length) return parts.slice(0, 2).join(", ");
    }
  } catch {
    // fall back to coordinates
  }
  return `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
}

/** Search for a place by name via Open-Meteo Geocoding (free, no key). */
export async function searchPlaces(query: string): Promise<Place[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}` +
        `&count=6&language=en&format=json`,
    );
    if (!res.ok) return [];
    const d = (await res.json()) as {
      results?: { name: string; latitude: number; longitude: number; country_code?: string; admin1?: string }[];
    };
    return (d.results ?? [])
      .filter((r) => typeof r.latitude === "number" && typeof r.longitude === "number")
      .map((r) => ({
        lat: r.latitude,
        lon: r.longitude,
        label: [r.name, r.admin1, r.country_code].filter(Boolean).join(", "),
      }));
  } catch {
    return [];
  }
}

/** Resolve a saved settings location into a Place (or undefined). */
export function settingsPlace(s: Settings | undefined): Place | undefined {
  return s?.location ? { lat: s.location.lat, lon: s.location.lon, label: s.location.label } : undefined;
}
