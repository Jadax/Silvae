import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { irrigation, nextWaterAt, type CareEventType } from "@silvae/core";
import { careHistory, deletePlant, getPlant, logCareEvent, savePlant } from "../lib/repo";
import { preparePlantPhoto } from "../lib/photos";
import { addJournalComment, journalPhotos, removeJournalPhoto, saveJournalNote, saveJournalPhoto, setJournalNote } from "../lib/photos";
import BeforeAfter from "../components/BeforeAfter";
import PhotoGallery from "../components/PhotoGallery";
import { speciesBySlug } from "../lib/seed";
import { envForPlant, feedingPlan } from "../lib/care";
import { toEnv } from "../lib/weather";
import { useWeather } from "../hooks/useWeather";
import type { PlantPhoto, PlantRow } from "../lib/db";

const DAY = 86400000;
const POT_TYPES = ["plastic", "terracotta", "ceramic", "self-watering"] as const;
const SOIL_TYPES = ["standard", "well-draining", "retentive"] as const;

export default function PlantDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [comparing, setComparing] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const { data: plant } = useQuery({ queryKey: ["plant", id], queryFn: () => getPlant(id) });
  const { data: events = [] } = useQuery({ queryKey: ["events", id], queryFn: () => careHistory(id, 30) });
  const { data: photos = [] } = useQuery({ queryKey: ["photos", id], queryFn: () => journalPhotos(id) });
  const { data: weather } = useWeather();

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["events", id] });
    void queryClient.invalidateQueries({ queryKey: ["plant", id] });
    void queryClient.invalidateQueries({ queryKey: ["plants"] });
  };
  const logEvent = useMutation({
    mutationFn: async (type: CareEventType) => {
      if (!plant) return;
      await logCareEvent({ id: crypto.randomUUID(), plantId: plant.id, type, at: new Date().toISOString() });
      const species = speciesBySlug(plant.speciesSlug);
      if (species && weather) {
        const schedule = nextWaterAt({ species, plant, env: toEnv(weather), last: new Date() });
        await savePlant({ ...plant, nextWaterAt: schedule.nextAt.toISOString() });
      }
    },
    onSuccess: refresh,
  });
  const remove = useMutation({ mutationFn: () => deletePlant(id), onSuccess: () => navigate("/") });
  const update = useMutation({ mutationFn: savePlant, onSuccess: () => { refresh(); setEditing(false); } });
  const addPhoto = useMutation({
    mutationFn: (file: File) => saveJournalPhoto(id, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["photos", id] }),
  });
  const dropPhoto = useMutation({
    mutationFn: (photoId: string) => removeJournalPhoto(photoId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["photos", id] }),
  });
  const setAvatar = useMutation({
    mutationFn: (photo: PlantPhoto) => savePlant({ ...plant!, avatarPhotoUrl: photo.dataUrl }),
    onSuccess: refresh,
  });
  const addNote = useMutation({
    mutationFn: (text: string) => saveJournalNote(id, text),
    onSuccess: () => {
      setNoteDraft("");
      void queryClient.invalidateQueries({ queryKey: ["photos", id] });
    },
  });
  const editNote = useMutation({
    mutationFn: ({ entryId, text }: { entryId: string; text: string }) => setJournalNote(entryId, text),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["photos", id] }),
  });
  const comment = useMutation({
    mutationFn: ({ entryId, text }: { entryId: string; text: string }) => addJournalComment(entryId, text),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["photos", id] }),
  });

  if (!plant) return <p className="muted">Loading…</p>;
  const species = speciesBySlug(plant.speciesSlug);
  const env = weather ? envForPlant(weather, plant.locationType) : undefined;
  const lastWater = events.find((event) => event.type === "water");
  const schedule = species && env ? nextWaterAt({ species, plant, env, last: lastWater ? new Date(lastWater.at) : new Date(plant.plantedAt ?? Date.now()) }) : undefined;
  const waterAmount = species && env ? irrigation(species, env, ageDays(plant.plantedAt)) : undefined;
  const feed = species ? feedingPlan(plant, species, events, env) : undefined;
  const overdue = lastWater ? Date.now() - new Date(lastWater.at).getTime() > (schedule?.intervalDays ?? 7) * DAY : false;
  const isOutdoor = plant.locationType === "outdoor";
  const frostRisk = isOutdoor && env && env.tempC < 3;
  const heatRisk = isOutdoor && env && env.tempC > 35;
  const rainLikely = env && (env.precipitationMm ?? 0) > 5;
  const photoEntries = photos.filter((p) => p.kind !== "note");
  const newestPhoto = photoEntries.length ? [...photoEntries].sort((a, b) => b.at.localeCompare(a.at))[0] : undefined;
  const photoNudge = newestPhoto && Date.now() - new Date(newestPhoto.at).getTime() > DAY * 30
    ? `It's been over a month since ${plant.name}'s last photo. A new one will make the next before-and-after more fun.`
    : null;

  async function saveProfile(currentPlant: PlantRow, patch: Partial<PlantRow>, photoFile?: File) {
    setEditError(null);
    try {
      const avatarPhotoUrl = photoFile ? await preparePlantPhoto(photoFile) : currentPlant.avatarPhotoUrl;
      await update.mutateAsync({ ...currentPlant, ...patch, avatarPhotoUrl });
    } catch (reason) {
      setEditError(reason instanceof Error ? reason.message : "We couldn't save those changes.");
    }
  }

  return (
    <div className="plant-page">
      <button className="back-link" onClick={() => navigate("/")}>← My garden</button>
      <header className="plant-hero">
        <div className="plant-avatar">{plant.avatarPhotoUrl ? <img src={plant.avatarPhotoUrl} alt={plant.name} /> : <span aria-hidden>🪴</span>}</div>
        <div className="plant-title">
          <span className="eyebrow">{plant.spotName || "Part of your garden"}</span>
          <h1>{plant.name}</h1>
          <p><em>{species?.scientificName ?? plant.speciesSlug}</em>{species?.family ? ` · ${species.family}` : ""}</p>
          <p>{species && <span className={`pet-flag ${species.toxicity.pets ? "toxic" : "safe"}`}>{species.toxicity.pets ? "⚠ Likely toxic to pets" : "🐾 Pet friendly"}</span>}</p>
          <span className={`loc-badge ${isOutdoor ? "out" : "in"}`}>{isOutdoor ? "☀️ Outdoor" : "🏠 Indoor"}</span>
        </div>
        <button className="btn secondary" onClick={() => setEditing((current) => !current)}>{editing ? "Cancel" : "Edit plant"}</button>
      </header>

      {editing && <EditPlantCard plant={plant} saving={update.isPending} error={editError} onSave={(patch, photo) => saveProfile(plant, patch, photo)} />}

      <section className="care-overview" aria-label="Care plan">
        <div className="care-highlight">
          <span className="eyebrow">Next little task</span>
          <h2>{schedule ? formatRelative(schedule.nextAt) : "Care plan loading"}</h2>
          <p>{schedule ? `Water ${plant.name} around ${formatDate(schedule.nextAt)}.` : "We’re calculating the best next step."}</p>
          <span className={`care-pill ${overdue ? "due" : "happy"}`}><i />{overdue ? "Needs attention" : "Looking good"}</span>
        </div>
        <div className="care-fact"><span aria-hidden>💧</span><div><small>Water amount</small><strong>{waterAmount ? `≈ ${waterAmount.amountMl} ml` : "Checking weather…"}</strong></div></div>
        <div className="care-fact"><span aria-hidden>☀️</span><div><small>Ideal light</small><strong>{species ? `${species.ideal.luxMin}–${species.ideal.luxMax} lux` : "n/a"}</strong></div></div>
        {feed && (
          <div className="care-fact">
            <span aria-hidden>🌱</span>
            <div>
              <small>Next feeding</small>
              <strong>{feed.advice.growingSeason ? (feed.nextAt ? `Around ${formatDate(feed.nextAt)}` : "Feeding time!") : "Resting season"}</strong>
            </div>
          </div>
        )}
      </section>

      {schedule && <details className="care-details"><summary>Why this schedule?</summary><ul className="modifier-list">{schedule.modifiers.map((modifier) => <li key={modifier.name}>{modifier.name.replace(/([A-Z])/g, " $1").toLowerCase()}: {modifier.delta > 0 ? "+" : ""}{Math.round(modifier.delta * 100)}%</li>)}</ul></details>}

      {feed && (
        <details className="care-details">
          <summary>Feeding plan</summary>
          <ul className="modifier-list">
            <li>Every {feed.advice.intervalDays} days · NPK {feed.advice.npk.n}–{feed.advice.npk.p}–{feed.advice.npk.k} · {feed.advice.strength} appetite</li>
            <li>{feed.advice.gramsPerLiter} g/L of feed, about {feed.advice.doseMl} ml per watering</li>
            <li>{feed.advice.guidance}</li>
            {feed.lastFedAt && <li>Last fed {formatDate(new Date(feed.lastFedAt))}{feed.dueInDays <= 0 ? " — due" : ` — in ${feed.dueInDays} day${feed.dueInDays === 1 ? "" : "s"}`}</li>}
          </ul>
        </details>
      )}

      {isOutdoor && env && (frostRisk || heatRisk || rainLikely) && (
        <div className="weather-alerts">
          {frostRisk && <p className="alert peach"><span aria-hidden>❄️</span><strong>Frost risk. </strong>{plant.name} is outdoors and it's under 3°C. Bring it in overnight or cover it.</p>}
          {heatRisk && <p className="alert peach"><span aria-hidden>🔥</span><strong>Heat warning. </strong>It's above 35°C today. Shade {plant.name} and water in the early morning.</p>}
          {rainLikely && <p className="alert sage"><span aria-hidden>🌧️</span><strong>Rain is likely. </strong>You can probably skip today's watering.</p>}
        </div>
      )}

      <section className="action-section">
        <div><span className="eyebrow">Care actions</span><h2>A little love goes a long way</h2></div>
        <div className="care-actions">{(["water", "mist", "fertilize", "prune", "rotate", "clean"] as CareEventType[]).map((type) => <button key={type} className={type === "water" ? "btn" : "btn secondary"} disabled={logEvent.isPending} onClick={() => void logEvent.mutate(type)}>{careIcon(type)} {type}</button>)}</div>
      </section>

      <section className="history-section">
        <div><span className="eyebrow">Plant diary</span><h2>Care history</h2></div>
        {events.length === 0 ? <div className="timeline-empty"><span aria-hidden>✨</span><p>No care events yet. Your first small action will appear here.</p></div> : <ol className="timeline">{events.map((event) => <li key={event.id}><span aria-hidden>{careIcon(event.type)}</span><div><strong>{capitalize(event.type)}</strong>{event.note && <small>{event.note}</small>}</div><time dateTime={event.at}>{formatDateTime(new Date(event.at))}</time></li>)}</ol>}
      </section>

      <section className="history-section">
        <div className="section-head">
          <div><span className="eyebrow">Growth journal</span><h2>Photos & notes</h2></div>
          <div className="journal-actions">
            {photoEntries.length >= 2 && (
              <button className="btn secondary" onClick={() => setComparing((current) => !current)}>
                {comparing ? "Close compare" : "Before & after"}
              </button>
            )}
            <label className="btn secondary journal-add">
              {addPhoto.isPending ? "Saving…" : "＋ Add photo"}
              <input type="file" accept="image/*" capture="environment" disabled={addPhoto.isPending} onChange={(event) => { const f = event.target.files?.[0]; if (f) void addPhoto.mutate(f); event.currentTarget.value = ""; }} />
            </label>
          </div>
        </div>
        <p className="muted">Snap a photo or jot a note every so often. It's nice to look back.</p>
        <form className="journal-composer" onSubmit={(event) => { event.preventDefault(); if (noteDraft.trim()) void addNote.mutate(noteDraft); }}>
          <span aria-hidden>✍️</span>
          <input type="text" placeholder={`How's ${plant.name} doing today?`} value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} disabled={addNote.isPending} />
          <button className="btn" disabled={addNote.isPending || !noteDraft.trim()}>{addNote.isPending ? "Saving…" : "Log note"}</button>
        </form>
        {photos.length === 0 ? (
          <div className="timeline-empty"><span aria-hidden>📷</span><p>No journal entries yet. Add the first one to start the diary.</p></div>
        ) : (
          <>
            {comparing && <BeforeAfter photos={photoEntries} plantName={plant.name} />}
            <PhotoGallery photos={photoEntries} plantName={plant.name} onSetAvatar={(photo) => void setAvatar.mutate(photo)} onDelete={(id) => void dropPhoto.mutate(id)} busy={dropPhoto.isPending || setAvatar.isPending} />
            <ol className="journal-list">{photos.map((photo) => (
              <JournalEntry key={photo.id} entry={photo} plantName={plant.name} onDelete={(id) => void dropPhoto.mutate(id)} onSaveNote={(text) => void editNote.mutate({ entryId: photo.id, text })} onComment={(text) => void comment.mutate({ entryId: photo.id, text })} deleting={dropPhoto.isPending} commenting={comment.isPending} />
            ))}</ol>
            {photoNudge && <p className="muted">{photoNudge}</p>}
          </>
        )}
      </section>

      {plant.notes && <section className="notes-card"><span aria-hidden>💛</span><div><strong>Plant notes</strong><p>{plant.notes}</p></div></section>}
      <button className="delete-link" onClick={() => void remove.mutate()} disabled={remove.isPending}>Remove {plant.name} from my garden</button>
    </div>
  );
}

function EditPlantCard({ plant, saving, error, onSave }: { plant: PlantRow; saving: boolean; error: string | null; onSave: (patch: Partial<PlantRow>, photo?: File) => Promise<void> }) {
  const [name, setName] = useState(plant.name);
  const [spotName, setSpotName] = useState(plant.spotName ?? "");
  const [locationType, setLocationType] = useState<PlantRow["locationType"]>(plant.locationType ?? "indoor");
  const [potType, setPotType] = useState(plant.potType);
  const [soilType, setSoilType] = useState(plant.soilType);
  const [potSizeCm, setPotSizeCm] = useState(String(plant.potSizeCm ?? ""));
  const [notes, setNotes] = useState(plant.notes ?? "");
  const [photo, setPhoto] = useState<File>();
  return <section className="card edit-card"><h2>Make it yours</h2><div className="form-grid"><label>Name<input value={name} onChange={(event) => setName(event.target.value)} /></label><label>Favourite spot<input value={spotName} onChange={(event) => setSpotName(event.target.value)} placeholder="Living room window" /></label><label>Where it lives<select value={locationType ?? "indoor"} onChange={(event) => setLocationType(event.target.value as PlantRow["locationType"])}><option value="indoor">🏠 Indoor</option><option value="outdoor">☀️ Outdoor</option></select></label><label>Pot type<select value={potType} onChange={(event) => setPotType(event.target.value as PlantRow["potType"])}>{POT_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label><label>Soil<select value={soilType} onChange={(event) => setSoilType(event.target.value as PlantRow["soilType"])}>{SOIL_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label><label>Pot size (cm)<input type="number" min="1" value={potSizeCm} onChange={(event) => setPotSizeCm(event.target.value)} /></label><label>Plant photo<input type="file" accept="image/*" onChange={(event) => setPhoto(event.target.files?.[0])} /></label></div><label>Notes<textarea value={notes} rows={3} onChange={(event) => setNotes(event.target.value)} /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="btn" disabled={saving || !name.trim()} onClick={() => void onSave({ name: name.trim(), spotName: spotName.trim() || undefined, locationType, potType, soilType, potSizeCm: Number(potSizeCm) || undefined, notes: notes.trim() || undefined }, photo)}>Save changes</button></section>;
}

function careIcon(type: CareEventType): string { return ({ water: "💧", mist: "💦", fertilize: "🌱", prune: "✂", rotate: "↻", clean: "✨", repot: "🪴", biostimulate: "🌿" })[type]; }

function JournalEntry({ entry, plantName, onDelete, onSaveNote, onComment, deleting, commenting }: {
  entry: PlantPhoto;
  plantName: string;
  onDelete: (id: string) => void;
  onSaveNote: (text: string) => void;
  onComment: (text: string) => void;
  deleting: boolean;
  commenting: boolean;
}) {
  const isNote = entry.kind === "note" || !entry.dataUrl;
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState(entry.note ?? "");
  const [commentDraft, setCommentDraft] = useState("");
  return (
    <li className="journal-list-item">
      <div className="journal-entry-head">
        <span aria-hidden>{isNote ? "💬" : "📷"}</span>
        <time dateTime={entry.at}>{formatDateTime(new Date(entry.at))}</time>
        <button className="journal-delete" aria-label={`Delete journal entry`} disabled={deleting} onClick={() => onDelete(entry.id)}>✕</button>
      </div>
      {entry.dataUrl && (
        <figure className="journal-entry">
          <img src={entry.dataUrl} alt={`${plantName} on ${formatDate(new Date(entry.at))}`} loading="lazy" />
        </figure>
      )}
      {editingNote ? (
        <form className="journal-note-edit" onSubmit={(event) => { event.preventDefault(); onSaveNote(noteDraft); setEditingNote(false); }}>
          <input type="text" value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} autoFocus />
          <button className="btn" disabled={!noteDraft.trim()}>Save</button>
          <button type="button" className="btn secondary" onClick={() => { setNoteDraft(entry.note ?? ""); setEditingNote(false); }}>Cancel</button>
        </form>
      ) : entry.note ? (
        <p className="journal-note">{entry.note} <button className="journal-edit" aria-label="Edit note" onClick={() => { setNoteDraft(entry.note ?? ""); setEditingNote(true); }}>✎</button></p>
      ) : (
        <button className="journal-note-add" onClick={() => setEditingNote(true)}>＋ Add a caption…</button>
      )}
      {(entry.comments?.length ?? 0) > 0 && (
        <ul className="journal-comments">
          {entry.comments!.map((c) => <li key={c.id}><strong>🌿</strong><span>{c.text}</span><time dateTime={c.at}>{formatDateTime(new Date(c.at))}</time></li>)}
        </ul>
      )}
      <form className="journal-comment-form" onSubmit={(event) => { event.preventDefault(); if (commentDraft.trim()) { onComment(commentDraft); setCommentDraft(""); } }}>
        <input type="text" placeholder="Comment…" value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} disabled={commenting} />
        <button className="btn secondary" disabled={commenting || !commentDraft.trim()}>Reply</button>
      </form>
    </li>
  );
}
function ageDays(plantedAt?: string): number { return plantedAt ? Math.max(0, Math.floor((Date.now() - new Date(plantedAt).getTime()) / DAY)) : 0; }
function formatDate(date: Date): string { return date.toLocaleDateString(undefined, { month: "long", day: "numeric" }); }
function formatDateTime(date: Date): string { return date.toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
function capitalize(value: string): string { return value.slice(0, 1).toUpperCase() + value.slice(1); }
function formatRelative(date: Date): string { const days = Math.ceil((date.getTime() - Date.now()) / DAY); return days <= 0 ? "Water today" : days === 1 ? "Water tomorrow" : `Water in ${days} days`; }
