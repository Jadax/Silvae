import { useCallback, useEffect, useMemo, useState } from "react";
import type { PlantPhoto } from "../lib/db";

function monthDay(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

interface Props {
  /** Photo entries only (notes are shown in the journal list). Any order. */
  photos: PlantPhoto[];
  plantName: string;
  onSetAvatar: (photo: PlantPhoto) => void;
  onDelete: (photoId: string) => void;
  busy?: boolean;
}

/** Timeline thumbnail grid with a keyboard-friendly full-size lightbox. */
export default function PhotoGallery({ photos, plantName, onSetAvatar, onDelete, busy = false }: Props) {
  const sorted = useMemo(() => [...photos].sort((a, b) => a.at.localeCompare(b.at)), [photos]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const index = sorted.findIndex((photo) => photo.id === openId);
  const open = index >= 0 ? sorted[index] : undefined;
  const hasNeighbours = sorted.length > 1;

  const step = useCallback(
    (dir: 1 | -1) => {
      if (!open || index < 0 || !hasNeighbours) return;
      const next = (index + dir + sorted.length) % sorted.length;
      setOpenId(sorted[next].id);
    },
    [open, index, sorted, hasNeighbours],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenId(null);
      else if (event.key === "ArrowRight") step(1);
      else if (event.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, step]);

  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), 1800);
    return () => window.clearTimeout(t);
  }, [flash]);

  if (sorted.length === 0) return null;

  const pickAvatar = (photo: PlantPhoto) => {
    onSetAvatar(photo);
    setFlash("Saved as avatar ✓");
  };

  return (
    <div className="photo-gallery">
      <div className="photo-thumbs" aria-label="Timeline thumbnails">
        {sorted.map((photo) => (
          <button
            key={photo.id}
            type="button"
            className="photo-thumb"
            aria-label={`View ${plantName} on ${monthDay(new Date(photo.at))}`}
            onClick={() => setOpenId(photo.id)}
          >
            <img src={photo.dataUrl} alt="" loading="lazy" />
            <span>{monthDay(new Date(photo.at))}</span>
          </button>
        ))}
      </div>

      {open && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label={`Photo from ${monthDay(new Date(open.at))}`}>
          <button className="lightbox-backdrop" aria-label="Close viewer" onClick={() => setOpenId(null)} />
          <div className="lightbox-card">
            <button className="lightbox-close" aria-label="Close viewer" onClick={() => setOpenId(null)}>✕</button>
            {hasNeighbours && (
              <button className="lightbox-nav prev" aria-label="Previous photo" onClick={() => step(-1)}>‹</button>
            )}
            <img className="lightbox-img" src={open.dataUrl} alt={`${plantName} on ${monthDay(new Date(open.at))}`} />
            {hasNeighbours && (
              <button className="lightbox-nav next" aria-label="Next photo" onClick={() => step(1)}>›</button>
            )}
            <div className="lightbox-caption">
              <strong>{plantName} · {monthDay(new Date(open.at))}</strong>
              {open.note && <span>{open.note}</span>}
            </div>
            <div className="lightbox-toolbar">
              {flash && <span className="lightbox-flash" role="status">{flash}</span>}
              <button className="btn" disabled={busy} onClick={() => pickAvatar(open)}>Use as avatar</button>
              <button className="btn secondary" disabled={busy} onClick={() => { onDelete(open.id); setOpenId(null); }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
