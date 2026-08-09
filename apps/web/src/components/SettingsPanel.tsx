import { useState } from "react";
import { usePlace, useSaveSettings, useSettings } from "../lib/settings";
import { detectLocation, reverseGeocode, searchPlaces, type Place } from "../lib/location";

export default function SettingsPanel() {
  const { data: settings } = useSettings();
  const place = usePlace();
  const save = useSaveSettings();
  const [detecting, setDetecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [manualLat, setManualLat] = useState("");
  const [manualLon, setManualLon] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const pets = settings?.pets ?? { cat: false, dog: false };

  async function setPlace(p: Place) {
    setBusy(true);
    setMessage(null);
    try {
      await save.mutateAsync({ location: { lat: p.lat, lon: p.lon, label: p.label } });
    } finally {
      setBusy(false);
    }
  }

  async function useMyLocation() {
    setDetecting(true);
    setMessage(null);
    try {
      const pos = await detectLocation();
      const label = await reverseGeocode(pos.lat, pos.lon);
      await setPlace({ ...pos, label });
      setMessage(`Set to ${label}.`);
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
    const label = await reverseGeocode(lat, lon);
    await setPlace({ lat, lon, label });
    setMessage(`Set to ${label}.`);
  }

  return (
    <div className="card settings-panel">
      <h2>Your place &amp; pets</h2>
      <p className="muted">Your location powers precise, season-aware advice. Nothing leaves this device.</p>

      <section className="settings-group">
        <h3>Where are your plants?</h3>
        <p className="muted">
          {place ? `Using weather for ${place.label}.` : "Set your location to get real weather, seasons, and outdoor warnings."}
        </p>
        <div className="actions">
          <button className="btn" onClick={() => void useMyLocation()} disabled={detecting || busy}>
            {detecting ? "Finding you…" : "Use my current location"}
          </button>
        </div>
        <label>
          Or search for a city
          <div className="search-row">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="London, Austin, Pune…"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void runSearch(); } }}
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
                <button type="button" onClick={() => void setPlace(r)} disabled={busy}>{r.label}</button>
              </li>
            ))}
          </ul>
        )}
        <details className="manual-coords">
          <summary>Enter coordinates manually</summary>
          <div className="coord-row">
            <input type="number" placeholder="Latitude" value={manualLat} onChange={(e) => setManualLat(e.target.value)} aria-label="Latitude" />
            <input type="number" placeholder="Longitude" value={manualLon} onChange={(e) => setManualLon(e.target.value)} aria-label="Longitude" />
            <button className="btn secondary" onClick={() => void saveManual()} disabled={busy}>Set</button>
          </div>
        </details>
      </section>

      <section className="settings-group">
        <h3>Do pets live here?</h3>
        <p className="muted">We'll flag risky plants for your cat or dog and add a pet-safe filter to Discover.</p>
        <div className="checks">
          <label className="check">
            <input
              type="checkbox"
              checked={pets.cat}
              onChange={(e) => void save.mutateAsync({ pets: { ...pets, cat: e.target.checked } })}
            />{" "}
            🐱 Cat
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={pets.dog}
              onChange={(e) => void save.mutateAsync({ pets: { ...pets, dog: e.target.checked } })}
            />{" "}
            🐶 Dog
          </label>
        </div>
      </section>

      {message && <p className="form-error" role="status">{message}</p>}
    </div>
  );
}
