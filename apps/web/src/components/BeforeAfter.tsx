import { useMemo, useState } from "react";
import type { PlantPhoto } from "../lib/db";

function monthDay(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function BeforeAfter({ photos, plantName }: { photos: PlantPhoto[]; plantName: string }) {
  const sorted = useMemo(() => [...photos].sort((a, b) => a.at.localeCompare(b.at)), [photos]);
  const [beforeId, setBeforeId] = useState<string | undefined>(undefined);
  const [afterId, setAfterId] = useState<string | undefined>(undefined);
  const [position, setPosition] = useState(50);

  const before = sorted.find((photo) => photo.id === beforeId) ?? sorted[0];
  let after = sorted.find((photo) => photo.id === afterId) ?? sorted[sorted.length - 1];
  if (before.id === after.id) after = sorted[Math.min(sorted.length - 1, sorted.indexOf(after) + 1)] ?? before;

  const newer = (photo: PlantPhoto) => sorted.indexOf(photo) > sorted.indexOf(before);

  return (
    <div className="compare">
      <div className="compare-pickers">
        <label>
          Before
          <select value={before.id} onChange={(event) => { setBeforeId(event.target.value); setPosition(50); }}>
            {sorted.map((photo) => (
              <option key={photo.id} value={photo.id} disabled={photo.id === after.id}>
                {monthDay(new Date(photo.at))}
              </option>
            ))}
          </select>
        </label>
        <label>
          After
          <select value={after.id} onChange={(event) => { setAfterId(event.target.value); setPosition(50); }}>
            {sorted.map((photo) => (
              <option key={photo.id} value={photo.id} disabled={photo.id === before.id || !newer(photo)}>
                {monthDay(new Date(photo.at))}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="compare-box">
        <img className="compare-img" src={after.dataUrl} alt={`${plantName} on ${monthDay(new Date(after.at))}`} />
        <img
          className="compare-img compare-top"
          src={before.dataUrl}
          alt={`${plantName} on ${monthDay(new Date(before.at))}`}
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        />
        <div className="compare-divider" style={{ left: `${position}%` }}>
          <span aria-hidden>◂▸</span>
        </div>
        <input
          className="compare-range"
          type="range"
          min="0"
          max="100"
          value={position}
          onChange={(event) => setPosition(Number(event.target.value))}
          aria-label="Drag to compare the two photos"
        />
        <span className="compare-tag before">Before · {monthDay(new Date(before.at))}</span>
        <span className="compare-tag after">After · {monthDay(new Date(after.at))}</span>
      </div>
    </div>
  );
}
