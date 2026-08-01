import { useState } from "react";
import { SPECIES } from "../lib/seed";

export default function Discover() {
  const [q, setQ] = useState(
    () => new URLSearchParams(window.location.search).get("q") ?? "",
  );
  const list = SPECIES.filter(
    (s) =>
      s.scientificName.toLowerCase().includes(q.toLowerCase()) ||
      s.commonNames.some((n: string) => n.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <>
      <h1>Discover</h1>
      <p className="muted">Public species library — no sign-in needed (C-7).</p>
      <label>
        Search
        <input
          type="search"
          placeholder="Monstera, pothos, snake plant…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </label>
      <table style={{ marginTop: "1rem" }}>
        <thead>
          <tr>
            <th>Species</th>
            <th>Water</th>
            <th>Light</th>
            <th>Temp</th>
          </tr>
        </thead>
        <tbody>
          {list.map((s) => (
            <tr key={s.slug}>
              <td>
                {s.commonNames[0]}
                <div className="muted">
                  <em>{s.scientificName}</em> · {s.family}
                </div>
              </td>
              <td>every {s.ideal.waterIntervalDays}d · {s.ideal.waterAmountMl} ml</td>
              <td>
                {s.ideal.luxMin}–{s.ideal.luxMax} lux
              </td>
              <td>
                {s.ideal.tempMinC}–{s.ideal.tempMaxC}°C
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {list.length === 0 && <p className="muted">No matches.</p>}
    </>
  );
}
