import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SPECIES } from "../lib/seed";
import { useSettings } from "../lib/settings";
import { settingsPlace } from "../lib/location";
import { recommendationsForPlace, fitForPlace } from "../lib/recommend";

export default function Discover() {
  const [q, setQ] = useState(
    () => new URLSearchParams(window.location.search).get("q") ?? "",
  );
  const [petSafe, setPetSafe] = useState(false);
  const [outdoor, setOutdoor] = useState(false);
  const { data: settings } = useSettings();
  const petsOn = Boolean(settings?.pets.cat || settings?.pets.dog);
  const place = settingsPlace(settings);
  const locationType = outdoor ? "outdoor" : "indoor";

  useEffect(() => {
    if (petsOn) setPetSafe(true);
  }, [petsOn]);

  const bestForArea = useMemo(
    () => (place ? recommendationsForPlace(place, { locationType, petSafe, limit: 6 }) : null),
    [place, locationType, petSafe],
  );

  const list = SPECIES.filter(
    (s) =>
      s.scientificName.toLowerCase().includes(q.toLowerCase()) ||
      s.commonNames.some((n: string) => n.toLowerCase().includes(q.toLowerCase())),
  ).filter((s) => !petSafe || !s.toxicity.pets);

  const rows = place
    ? list.map((s) => ({ s, fit: fitForPlace(s, place, locationType) }))
        .sort((a, b) => b.fit.fitScore - a.fit.fitScore)
    : list.map((s) => ({ s, fit: null }));

  return (
    <>
      <h1>Discover</h1>
      <p className="muted">Browse the full species library.</p>

      {place && (
        <section className="card area-panel">
          <div className="section-head">
            <div>
              <span className="eyebrow">{"\uD83C\uDF0D"} For your area</span>
              <h2>Plants that love {place.label}</h2>
            </div>
            <div className="segmented-sm" role="group" aria-label="Where the plants will live">
              <button className={!outdoor ? "selected" : ""} onClick={() => setOutdoor(false)}>{"\uD83C\uDFE0"} Indoor</button>
              <button className={outdoor ? "selected" : ""} onClick={() => setOutdoor(true)}>{"\u2600\uFE0F"} Outdoor</button>
            </div>
          </div>
          {bestForArea && bestForArea.length > 0 ? (
            <ol className="fit-list">
              {bestForArea.map(({ species, fit }) => (
                <li key={species.slug}>
                  <Link to={`/species/${species.slug}`}>{species.commonNames[0]}</Link>
                  <span className="muted"><em>{species.scientificName}</em></span>
                  <span className={`fit-badge ${fit.fitScore >= 80 ? "great" : fit.fitScore >= 55 ? "ok" : "tough"}`}>
                    {fit.summary}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted">No matches with the current filters.</p>
          )}
          <p className="muted area-note">
            This is a rough seasonal estimate from your saved location. Your actual light, pot, and habits matter more.
          </p>
        </section>
      )}

      <div className="discover-controls">
        <label className="discover-search">
          Search
          <input
            type="search"
            placeholder="Monstera, pothos, snake plant..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <label className="check pet-safe-toggle">
          <input
            type="checkbox"
            checked={petSafe}
            onChange={(e) => setPetSafe(e.target.checked)}
          />{" "}
          {"\uD83D\uDC3E"} Pet-safe only
        </label>
        {!place && (
          <label className="check pet-safe-toggle">
            <input
              type="checkbox"
              checked={outdoor}
              onChange={(e) => setOutdoor(e.target.checked)}
            />{" "}
            {"\u2600\uFE0F"} Planning outdoors
          </label>
        )}
      </div>
      {petsOn && petSafe && <p className="muted">We've hidden plants that are risky for your pets. You can turn the filter off anytime.</p>}
      {!place && <p className="muted">Tip: <Link to="/account">set your location</Link> to see which species fit your area.</p>}
      <table style={{ marginTop: "1rem" }}>
        <thead>
          <tr>
            <th>Species</th>
            <th>Pets</th>
            <th>Water</th>
            <th>Light</th>
            <th>Temp</th>
            {place && <th>Area fit</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ s, fit }) => (
            <tr key={s.slug}>
              <td>
                <Link to={`/species/${s.slug}`}>{s.commonNames[0]}</Link>
                <div className="muted">
                  <em>{s.scientificName}</em> \u00B7 {s.family}
                </div>
              </td>
              <td>
                <span className={`pet-flag ${s.toxicity.pets ? "toxic" : "safe"}`}>
                  {s.toxicity.pets ? "\u26A0 Toxic to pets" : "\uD83D\uDC3E Pet friendly"}
                </span>
              </td>
              <td>every {s.ideal.waterIntervalDays}d \u00B7 {s.ideal.waterAmountMl} ml</td>
              <td>
                {s.ideal.luxMin}\u2013{s.ideal.luxMax} lux
              </td>
              <td>
                {s.ideal.tempMinC}\u2013{s.ideal.tempMaxC}{'\u00B0'}C
              </td>
              {place && fit && (
                <td>
                  <span className={`fit-badge ${fit.fitScore >= 80 ? "great" : fit.fitScore >= 55 ? "ok" : "tough"}`}>
                    {Math.round(fit.fitScore)} \u00B7 {fit.summary}
                  </span>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="muted">No matches{petsOn && petSafe ? " among pet-safe plants" : ""}.</p>}
    </>
  );
}
