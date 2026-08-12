import { useState } from "react";
import { useSaveSettings } from "../lib/settings";
import { detectLocation, reverseGeocode, searchPlaces, type Place } from "../lib/location";

/** Shared "use my location / search a city" widget used by onboarding and account settings. */
export default function LocationPicker({
  showManualEntry = false,
  onLocationSet,
}: {
  showManualEntry?: boolean;
  onLocationSet?: (place: Place) => void;
}) {
  const save = useSaveSettings();
  const [detecting, setDetecting] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [manualLat, setManualLat] = useState("");
  const [manualLon, setManualLon] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function setPlace(place: Place) {
    await save.mutateAsync({ location: { lat: place.lat, lon: place.lon, label: place.label } });
    onLocationSet?.(place);
  }

  async function useMyLocation() {
    setDetecting(true);
    setMessage(null);
    try {
      const pos = await detectLocation();
      const label = await reverseGeocode(pos.lat, pos.lon);
      await setPlace({ ...pos, label });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Couldn't find your location.");
    } finally {
      setDetecting(false);
    }
  }

  async function runSearch() {
    setSearching(true);
    setMessage(null);
    try {
      setResults(await searchPlaces(query));
    } finally {
      setSearching(false);
    }
  }

  async function saveManual() {
    const lat = Number(manualLat);
    const lon = Number(manualLon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      setMessage("Enter valid latitude (−90…90) and longitude (−180…180).");
      return;
    }
    await setPlace({ lat, lon, label: await reverseGeocode(lat, lon) });
  }

  return (
    <>
      <div className="actions">
        <button className="btn" onClick={() => void useMyLocation()} disabled={detecting || save.isPending}>
          {detecting ? "Finding you…" : "📍 Use my current location"}
        </button>
      </div>
      <label>
        Or search for a city
        <div className="search-row">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="London, Austin, Pune…"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void runSearch();
              }
            }}
          />
          <button className="btn secondary" onClick={() => void runSearch()} disabled={searching || !query.trim()}>
            {searching ? "…" : "Search"}
          </button>
        </div>
      </label>
      {results.length > 0 && (
        <ul className="place-results" aria-label="Search results">
          {results.map((r) => (
            <li key={`${r.lat},${r.lon}`}>
              <button type="button" onClick={() => void setPlace(r)} disabled={save.isPending}>
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      {showManualEntry && (
        <details className="manual-coords">
          <summary>Enter coordinates manually</summary>
          <div className="coord-row">
            <input type="number" placeholder="Latitude" value={manualLat} onChange={(e) => setManualLat(e.target.value)} aria-label="Latitude" />
            <input type="number" placeholder="Longitude" value={manualLon} onChange={(e) => setManualLon(e.target.value)} aria-label="Longitude" />
            <button className="btn secondary" onClick={() => void saveManual()} disabled={save.isPending}>Set</button>
          </div>
        </details>
      )}
      {message && <p className="form-error" role="status">{message}</p>}
    </>
  );
}
