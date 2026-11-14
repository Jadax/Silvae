import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { irrigation, POT_TYPES, SOIL_TYPES, type CareEventType } from "@silvae/core";
import { careHistory, deleteCareEvent, deletePlant, getPlant, logCareEvent, savePlant } from "../lib/repo";
import {
  addJournalComment,
  journalPhotos,
  prepareAvatar,
  removeJournalPhoto,
  saveJournalNote,
  saveJournalPhoto,
  setJournalNote,
} from "../lib/photos";
import BeforeAfter from "../components/BeforeAfter";
import PhotoGallery from "../components/PhotoGallery";
import { speciesBySlug } from "../lib/seed";
import {
  DAY,
  MODIFIER_LABELS,
  computeSchedule,
  envForPlant,
  feedingPlan,
  lastDone,
  lastWateredAt,
  potLabel,
  rescheduleWater,
  waterStatusLabel,
  waterVerb,
} from "../lib/care";
import { currentSeason } from "../lib/weather";
import { describeIdentifyError } from "../lib/api";
import { identifyFromFile, pestFromDisease } from "../lib/identify";
import { useWeather } from "../hooks/useWeather";
import { usePlace, useSettings } from "../lib/settings";
import type { PlantPhoto, PlantRow } from "../lib/db";

const LOGGABLE: CareEventType[] = ["water", "fertilize", "mist", "repot", "prune", "rotate", "clean"];

export default function PlantDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [comparing, setComparing] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [careDate, setCareDate] = useState(todayLocal);
  const [repotting, setRepotting] = useState(false);
  const { data: plant, isLoading } = useQuery({ queryKey: ["plant", id], queryFn: () => getPlant(id) });
  const { data: events = [] } = useQuery({ queryKey: ["events", id], queryFn: () => careHistory(id, 60) });
  const { data: photos = [] } = useQuery({ queryKey: ["photos", id], queryFn: () => journalPhotos(id) });
  const { data: weather } = useWeather();
  const { data: settings } = useSettings();
  const place = usePlace();

  const species = plant ? speciesBySlug(plant.speciesSlug) : undefined;
  const env = weather && plant ? envForPlant(weather, plant.locationType, place?.lat) : undefined;

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["events"] });
    void queryClient.invalidateQueries({ queryKey: ["plant", id] });
    void queryClient.invalidateQueries({ queryKey: ["plants"] });
    void queryClient.invalidateQueries({ queryKey: ["latest-care"] });
  };
  const refreshJournal = () => void queryClient.invalidateQueries({ queryKey: ["photos", id] });

  /** Re-count the watering schedule from the (just changed) care history. */
  async function reschedule(current: PlantRow) {
    const history = await careHistory(current.id, 60);
    await savePlant(rescheduleWater(current, species, env, history));
  }

  const logEvent = useMutation({
    mutationFn: async ({ type, potSizeCm }: { type: CareEventType; potSizeCm?: number }) => {
      if (!plant) return;
      await logCareEvent({ id: crypto.randomUUID(), plantId: plant.id, type, at: careMoment(careDate).toISOString() });
      const updated = type === "repot" && potSizeCm ? { ...plant, potSizeCm } : plant;
      if (type === "water" || type === "repot") await reschedule(updated);
    },
    onSuccess: () => {
      setRepotting(false);
      setCareDate(todayLocal());
      refresh();
    },
  });
  const removeEvent = useMutation({
    mutationFn: async (eventId: string) => {
      const removed = events.find((e) => e.id === eventId);
      await deleteCareEvent(eventId);
      if (plant && removed?.type === "water") await reschedule(plant);
    },
    onSuccess: refresh,
  });
  const remove = useMutation({ mutationFn: () => deletePlant(id), onSuccess: () => navigate("/") });
  const update = useMutation({
    mutationFn: async (next: PlantRow) => {
      await savePlant(next);
      await reschedule(next);
    },
    onSuccess: () => {
      refresh();
      setEditing(false);
    },
  });
  const addPhoto = useMutation({ mutationFn: (file: File) => saveJournalPhoto(id, file), onSuccess: refreshJournal });
  const dropPhoto = useMutation({ mutationFn: removeJournalPhoto, onSuccess: refreshJournal });
  const setAvatar = useMutation({
    mutationFn: async (photo: PlantPhoto) => {
      if (!plant || !photo.dataUrl) return;
      await savePlant({ ...plant, avatarPhotoUrl: await prepareAvatar(photo.dataUrl) });
    },
    onSuccess: refresh,
  });
  const addNote = useMutation({
    mutationFn: (text: string) => saveJournalNote(id, text),
    onSuccess: () => {
      setNoteDraft("");
      refreshJournal();
    },
  });
  const editNote = useMutation({
    mutationFn: ({ entryId, text }: { entryId: string; text: string }) => setJournalNote(entryId, text),
    onSuccess: refreshJournal,
  });
  const comment = useMutation({
    mutationFn: ({ entryId, text }: { entryId: string; text: string }) => addJournalComment(entryId, text),
    onSuccess: refreshJournal,
  });

  if (isLoading) return <p className="muted">Loading...</p>;
  if (!plant) {
    return (
      <div className="empty-garden">
        <h2>This plant isn't here anymore</h2>
        <p>It may have been removed on another device.</p>
        <button className="btn" onClick={() => navigate("/")}>Back to my garden</button>
      </div>
    );
  }

  const inWater = plant.potType === "glass";
  const verb = waterVerb(plant);
  const lastWater = lastDone(events, "water");
  const schedule = computeSchedule(plant, species, env, lastWateredAt(plant, events));
  const nextWater = plant.nextWaterAt ? new Date(plant.nextWaterAt) : schedule?.nextAt;
  const status = waterStatusLabel(nextWater, verb);
  const waterAmount = species && env && !inWater
    ? irrigation(species, env, { potSizeCm: plant.potSizeCm, outdoor: plant.locationType === "outdoor" })
    : undefined;
  const season = env?.season ?? currentSeason(place?.lat);
  const feed = feedingPlan(plant, species, events, season, settings?.fertilizer);
  const isOutdoor = plant.locationType === "outdoor";
  const frostRisk = isOutdoor && env && env.tempC < 3;
  const heatRisk = isOutdoor && env && env.tempC > 35;
  const rainLikely = isOutdoor && env && (env.precipitationMm ?? 0) > 5;
  const photoEntries = photos.filter((p) => p.kind !== "note" && p.dataUrl);
  const newestPhoto = photoEntries[0];
  const photoNudge = newestPhoto && Date.now() - new Date(newestPhoto.at).getTime() > DAY * 30
    ? `It's been a month since ${plant.name}'s last photo. A new one makes the before-and-after more fun.`
    : null;

  async function saveProfile(currentPlant: PlantRow, patch: Partial<PlantRow>, photoFile?: File) {
    setEditError(null);
    try {
      const avatarPhotoUrl = photoFile ? await prepareAvatar(photoFile) : currentPlant.avatarPhotoUrl;
      await update.mutateAsync({ ...currentPlant, ...patch, avatarPhotoUrl });
    } catch (reason) {
      setEditError(reason instanceof Error ? reason.message : "Couldn't save those changes.");
    }
  }

  function confirmRemove() {
    if (window.confirm(`Remove ${plant!.name} with its care history and journal? This can't be undone.`)) {
      void remove.mutate();
    }
  }

  return (
    <div className="plant-page">
      <button className="back-link" onClick={() => navigate("/")}>← My garden</button>
      <header className="plant-hero">
        <div className="plant-avatar">{plant.avatarPhotoUrl ? <img src={plant.avatarPhotoUrl} alt={plant.name} /> : <span aria-hidden>🌿</span>}</div>
        <div className="plant-title">
          <span className="eyebrow">{plant.spotName || "Your garden"}</span>
          <h1>{plant.name}</h1>
          <p><em>{species?.scientificName ?? plant.speciesSlug}</em>{species?.family ? ` · ${species.family}` : ""}</p>
          <p>{species && <span className={`pet-flag ${species.toxicity.pets ? "toxic" : "safe"}`}>{species.toxicity.pets ? "⚠ Likely toxic to pets" : "🐾 Pet friendly"}</span>}</p>
          <span className={`loc-badge ${isOutdoor ? "out" : "in"}`}>{isOutdoor ? "☀️ Outdoor" : "🏠 Indoor"}</span>
          {plant.potSizeCm && <span className="loc-badge in">🪴 {plant.potSizeCm} cm {plant.potType} pot</span>}
        </div>
        <button className="btn secondary" onClick={() => setEditing((current) => !current)}>{editing ? "Cancel" : "Edit plant"}</button>
      </header>

      {editing && <EditPlantCard plant={plant} saving={update.isPending} error={editError} onSave={(patch, photo) => saveProfile(plant, patch, photo)} />}

      <section className="care-overview" aria-label="Care plan">
        <div className="care-highlight">
          <span className="eyebrow">Next up</span>
          <h2>{status.label}</h2>
          <p>
            {nextWater ? `${verb} ${plant.name} around ${formatDate(nextWater)}.` : "Working out the best schedule."}
            {lastWater ? ` Last done ${formatDate(lastWater)}.` : ""}
          </p>
          <span className={`care-pill ${status.tone === "due" ? "due" : "happy"}`}><i />{status.tone === "due" ? "Needs attention" : "Looking good"}</span>
        </div>
        <div className="care-fact">
          <span aria-hidden>💧</span>
          <div>
            <small>{inWater ? "Water" : "How much"}</small>
            <strong>{inWater ? "Top up, refresh weekly" : waterAmount ? `≈ ${waterAmount.amountMl} ml` : "Checking weather..."}</strong>
          </div>
        </div>
        <div className="care-fact"><span aria-hidden>☀️</span><div><small>Ideal light</small><strong>{species ? `${species.ideal.luxMin}–${species.ideal.luxMax} lux` : "n/a"}</strong></div></div>
        {feed && (
          <div className="care-fact">
            <span aria-hidden>🌱</span>
            <div>
              <small>Next feeding</small>
              <strong>{!feed.advice.growingSeason ? "Resting season" : feed.due ? "Feed now" : `Around ${formatDate(feed.nextAt!)}`}</strong>
            </div>
          </div>
        )}
      </section>

      {inWater ? (
        <details className="care-details" open>
          <summary>Growing in water</summary>
          <ul className="modifier-list">
            <li>Top the water up whenever the level drops, and replace all of it once a week so it stays clean.</li>
            <li>Keep the roots covered but the leaves and stem above the waterline.</li>
            <li>A few drops of liquid feed at quarter strength once a month is plenty while it's growing.</li>
            <li>Green slime on the glass means it's getting direct sun: move it a little back from the window.</li>
          </ul>
        </details>
      ) : (
        <>
          {(schedule || waterAmount) && (
            <details className="care-details">
              <summary>Why this schedule?</summary>
              <ul className="modifier-list">
                {schedule && <li>Every {Math.round(schedule.intervalDays)} days for this plant (typical for the species: {species?.ideal.waterIntervalDays} days)</li>}
                {schedule?.modifiers.map((m) => (
                  <li key={m.name}>{MODIFIER_LABELS[m.name] ?? m.name}: {m.delta > 0 ? "+" : ""}{Math.round(m.delta * 100)}%</li>
                ))}
                {waterAmount?.explanation.map((line) => <li key={line}>{line}</li>)}
                {!plant.potSizeCm && <li>Add the pot size (Edit plant) for a more accurate amount.</li>}
                <li>Check with a finger first: if the top 2–3 cm is still damp, tap "Still moist" on the home screen.</li>
              </ul>
            </details>
          )}
          {feed && (
            <details className="care-details">
              <summary>Feeding plan</summary>
              <ul className="modifier-list">
                <li>Every {feed.advice.intervalDays} days in spring and summer · NPK {feed.advice.npk.n}–{feed.advice.npk.p}–{feed.advice.npk.k} · {feed.advice.strength} appetite</li>
                <li>{feed.advice.growingSeason ? (feed.mix ?? feed.advice.guidance) : feed.advice.guidance}</li>
                {!feed.advice.growingSeason && feed.mix && <li>If it's clearly growing and you do feed: {feed.mix}</li>}
                {!settings?.fertilizer && <li>Tell us which fertiliser you use (You → Your fertiliser) and we'll give you the exact amount to mix.</li>}
                <li>Water first if the soil is bone dry: feeding dry roots can burn them.</li>
                {feed.lastFedAt && <li>Last fed {formatDate(feed.lastFedAt)}</li>}
              </ul>
            </details>
          )}
        </>
      )}

      {isOutdoor && env && (frostRisk || heatRisk || rainLikely) && (
        <div className="weather-alerts">
          {frostRisk && <p className="alert peach"><span aria-hidden>❄️</span><strong>Frost risk. </strong>{plant.name} is outdoors and it's under 3°C. Bring it in or cover it.</p>}
          {heatRisk && <p className="alert peach"><span aria-hidden>🔥</span><strong>Heat warning. </strong>It's above 35°C. Shade {plant.name} and water in the morning.</p>}
          {rainLikely && <p className="alert sage"><span aria-hidden>🌧️</span><strong>Rain is likely. </strong>You can probably skip today's watering.</p>}
        </div>
      )}

      <section className="action-section">
        <div><span className="eyebrow">Care actions</span><h2>Log what you did</h2></div>
        <div className="care-date-row">
          <label className="care-date-label">
            When
            <input type="date" value={careDate} onChange={(e) => setCareDate(e.target.value || todayLocal())} max={todayLocal()} />
          </label>
        </div>
        <div className="care-actions">
          {LOGGABLE.map((type) => (
            <button
              key={type}
              className={type === "water" ? "btn" : "btn secondary"}
              disabled={logEvent.isPending}
              onClick={() => (type === "repot" ? setRepotting(true) : void logEvent.mutate({ type }))}
            >
              {careIcon(type)} {type === "water" ? verb.toLowerCase() : type}
            </button>
          ))}
        </div>
        {repotting && (
          <RepotForm
            current={plant.potSizeCm}
            saving={logEvent.isPending}
            onCancel={() => setRepotting(false)}
            onSave={(potSizeCm) => void logEvent.mutate({ type: "repot", potSizeCm })}
          />
        )}
      </section>

      <section className="history-section">
        <div><span className="eyebrow">Plant diary</span><h2>Care history</h2></div>
        {events.length === 0 ? (
          <div className="timeline-empty"><span aria-hidden>✨</span><p>No care logged yet. Log your first action above.</p></div>
        ) : (
          <ol className="timeline">
            {events.map((event) => (
              <li key={event.id}>
                <span aria-hidden>{careIcon(event.type)}</span>
                <div><strong>{capitalize(event.type)}</strong>{event.note && <small>{event.note}</small>}</div>
                <time dateTime={event.at}>{formatShortDate(new Date(event.at))}</time>
                <button className="timeline-delete" aria-label={`Delete ${event.type} on ${formatShortDate(new Date(event.at))}`} disabled={removeEvent.isPending} onClick={() => void removeEvent.mutate(event.id)}>✕</button>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="history-section">
        <div className="section-head">
          <div><span className="eyebrow">Growth journal</span><h2>Photos and notes</h2></div>
          <div className="journal-actions">
            {photoEntries.length >= 2 && (
              <button className="btn secondary" onClick={() => setComparing((current) => !current)}>
                {comparing ? "Close compare" : "Before & after"}
              </button>
            )}
            <label className="btn secondary journal-add">
              {addPhoto.isPending ? "Saving..." : "📷 Take photo"}
              <input type="file" accept="image/*" capture="environment" disabled={addPhoto.isPending} onChange={(event) => { const f = event.target.files?.[0]; if (f) void addPhoto.mutate(f); event.currentTarget.value = ""; }} />
            </label>
            <label className="btn secondary journal-add">
              📁 From album
              <input type="file" accept="image/*" disabled={addPhoto.isPending} onChange={(event) => { const f = event.target.files?.[0]; if (f) void addPhoto.mutate(f); event.currentTarget.value = ""; }} />
            </label>
          </div>
        </div>
        <p className="muted">A photo every few weeks shows how it's growing. Tap "Check health" on any photo for a second opinion.</p>
        {addPhoto.isError && <p className="form-error" role="alert">{addPhoto.error instanceof Error ? addPhoto.error.message : "Couldn't save that photo."}</p>}
        <form className="journal-composer" onSubmit={(event) => { event.preventDefault(); if (noteDraft.trim()) void addNote.mutate(noteDraft); }}>
          <span aria-hidden>✍️</span>
          <input type="text" placeholder={`How's ${plant.name} doing?`} value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} disabled={addNote.isPending} />
          <button className="btn" disabled={addNote.isPending || !noteDraft.trim()}>{addNote.isPending ? "Saving..." : "Log note"}</button>
        </form>
        {photos.length === 0 ? (
          <div className="timeline-empty"><span aria-hidden>📷</span><p>No journal entries yet. Add the first one to start the diary.</p></div>
        ) : (
          <>
            {comparing && photoEntries.length >= 2 && <BeforeAfter photos={photoEntries} plantName={plant.name} />}
            {photoEntries.length > 0 && (
              <PhotoGallery
                photos={photoEntries}
                plantName={plant.name}
                onSetAvatar={(photo) => void setAvatar.mutate(photo)}
                onDelete={(photoId) => { if (window.confirm("Delete this photo?")) void dropPhoto.mutate(photoId); }}
                busy={dropPhoto.isPending || setAvatar.isPending}
              />
            )}
            <ol className="journal-list">{photos.map((photo) => (
              <JournalEntry
                key={photo.id}
                entry={photo}
                plantName={plant.name}
                onDelete={(entryId) => { if (window.confirm("Delete this journal entry?")) void dropPhoto.mutate(entryId); }}
                onSaveNote={(text) => void editNote.mutate({ entryId: photo.id, text })}
                onComment={(text) => comment.mutateAsync({ entryId: photo.id, text })}
                deleting={dropPhoto.isPending}
                commenting={comment.isPending}
              />
            ))}</ol>
            {photoNudge && <p className="muted">{photoNudge}</p>}
          </>
        )}
      </section>

      {plant.notes && <section className="notes-card"><span aria-hidden>💛</span><div><strong>Plant notes</strong><p>{plant.notes}</p></div></section>}
      <button className="delete-link" onClick={confirmRemove} disabled={remove.isPending}>Remove {plant.name} from my garden</button>
    </div>
  );
}

function RepotForm({ current, saving, onSave, onCancel }: { current?: number; saving: boolean; onSave: (potSizeCm: number) => void; onCancel: () => void }) {
  const [size, setSize] = useState(String(current ? current + 4 : 20));
  const value = Number(size);
  return (
    <form className="journal-note-edit" onSubmit={(event) => { event.preventDefault(); if (value > 0) onSave(value); }}>
      <label>
        New pot size (cm across the top)
        <input type="number" min="4" max="150" value={size} onChange={(event) => setSize(event.target.value)} autoFocus />
      </label>
      <button className="btn" disabled={saving || !(value > 0)}>Save repot</button>
      <button type="button" className="btn secondary" onClick={onCancel}>Cancel</button>
    </form>
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
  const isGlassPot = potType === "glass";
  return (
    <section className="card edit-card">
      <h2>Edit plant</h2>
      <div className="form-grid">
        <label>Name<input value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label>Favourite spot<input value={spotName} onChange={(event) => setSpotName(event.target.value)} placeholder="Living room window" /></label>
        <label>Where it lives<select value={locationType ?? "indoor"} onChange={(event) => setLocationType(event.target.value as PlantRow["locationType"])}><option value="indoor">🏠 Indoor</option><option value="outdoor">☀️ Outdoor</option></select></label>
        <label>Pot type<select value={potType} onChange={(event) => setPotType(event.target.value as PlantRow["potType"])}>{POT_TYPES.map((type) => <option key={type} value={type}>{potLabel(type)}</option>)}</select></label>
        {!isGlassPot && <label>Soil<select value={soilType} onChange={(event) => setSoilType(event.target.value as PlantRow["soilType"])}>{SOIL_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>}
        {isGlassPot && <p className="muted" style={{ alignSelf: "center" }}>Growing in water, no soil.</p>}
        <label>Pot size (cm across the top)<input type="number" min="1" value={potSizeCm} onChange={(event) => setPotSizeCm(event.target.value)} /></label>
        <label>Plant photo<input type="file" accept="image/*" onChange={(event) => setPhoto(event.target.files?.[0])} /></label>
      </div>
      <label>Notes<textarea value={notes} rows={3} onChange={(event) => setNotes(event.target.value)} /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn" disabled={saving || !name.trim()} onClick={() => void onSave({ name: name.trim(), spotName: spotName.trim() || undefined, locationType, potType, soilType: isGlassPot ? "well-draining" : soilType, potSizeCm: Number(potSizeCm) || undefined, notes: notes.trim() || undefined }, photo)}>Save changes</button>
    </section>
  );
}

function careIcon(type: CareEventType): string {
  return ({ water: "💧", mist: "💦", fertilize: "🌱", prune: "✂", rotate: "↻", clean: "✨", repot: "🪴", biostimulate: "🌿" })[type];
}

type Health = { state: "busy" } | { state: "error"; message: string };

function JournalEntry({ entry, plantName, onDelete, onSaveNote, onComment, deleting, commenting }: {
  entry: PlantPhoto;
  plantName: string;
  onDelete: (id: string) => void;
  onSaveNote: (text: string) => void;
  onComment: (text: string) => Promise<void>;
  deleting: boolean;
  commenting: boolean;
}) {
  const isNote = entry.kind === "note";
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState(entry.note ?? "");
  const [commentDraft, setCommentDraft] = useState("");
  const [health, setHealth] = useState<Health | null>(null);

  /** Run the photo past the plant-health service and keep the verdict as a comment on the entry. */
  async function checkHealth() {
    if (!entry.dataUrl) return;
    setHealth({ state: "busy" });
    try {
      const blob = await (await fetch(entry.dataUrl)).blob();
      const { result } = await identifyFromFile(blob);
      const healthy = result.isHealthy?.binary;
      const pct = Math.round((result.isHealthy?.probability ?? 0) * 100);
      const pest = pestFromDisease(result);
      const verdict = healthy === undefined
        ? "Health check: couldn't tell from this photo. Try a closer, well-lit shot of the leaves."
        : healthy
          ? `Health check: looks healthy (${pct}% sure).`
          : `Health check: possible problem${result.disease?.name ? `, ${result.disease.name}` : ""} (${pct}% sure it's healthy).` +
            (pest ? ` ${pest.pest}: ${pest.treatments[0]}.` : " Open the Plant Doctor to go through the symptoms.");
      await onComment(verdict);
      setHealth(null);
    } catch (err) {
      setHealth({ state: "error", message: describeIdentifyError(err) });
    }
  }

  return (
    <li className="journal-list-item">
      <div className="journal-entry-head">
        <span aria-hidden>{isNote ? "💬" : "📷"}</span>
        <time dateTime={entry.at}>{formatShortDate(new Date(entry.at))}</time>
        <button className="journal-delete" aria-label="Delete journal entry" disabled={deleting} onClick={() => onDelete(entry.id)}>✕</button>
      </div>
      {!isNote && (entry.dataUrl ? (
        <figure className="journal-entry">
          <img src={entry.dataUrl} alt={`${plantName} on ${formatDate(new Date(entry.at))}`} loading="lazy" />
        </figure>
      ) : (
        <p className="muted">📥 Photo is still downloading from your other device...</p>
      ))}
      {editingNote ? (
        <form className="journal-note-edit" onSubmit={(event) => { event.preventDefault(); onSaveNote(noteDraft); setEditingNote(false); }}>
          <input type="text" value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} autoFocus />
          <button className="btn" disabled={!noteDraft.trim()}>Save</button>
          <button type="button" className="btn secondary" onClick={() => { setNoteDraft(entry.note ?? ""); setEditingNote(false); }}>Cancel</button>
        </form>
      ) : entry.note ? (
        <p className="journal-note">{entry.note} <button className="journal-edit" aria-label="Edit note" onClick={() => { setNoteDraft(entry.note ?? ""); setEditingNote(true); }}>✎</button></p>
      ) : (
        <button className="journal-note-add" onClick={() => setEditingNote(true)}>＋ Add a caption...</button>
      )}
      {!isNote && entry.dataUrl && (
        <div className="journal-health">
          <button className="btn secondary" disabled={health?.state === "busy"} onClick={() => void checkHealth()}>
            {health?.state === "busy" ? "Checking..." : "🩺 Check health"}
          </button>
          {health?.state === "error" && <span className="form-error">{health.message}</span>}
        </div>
      )}
      {(entry.comments?.length ?? 0) > 0 && (
        <ul className="journal-comments">
          {entry.comments!.map((c) => <li key={c.id}><strong>🌿</strong><span>{c.text}</span><time dateTime={c.at}>{formatShortDate(new Date(c.at))}</time></li>)}
        </ul>
      )}
      <form className="journal-comment-form" onSubmit={(event) => { event.preventDefault(); if (commentDraft.trim()) { void onComment(commentDraft); setCommentDraft(""); } }}>
        <input type="text" placeholder="Comment..." value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} disabled={commenting} />
        <button className="btn secondary" disabled={commenting || !commentDraft.trim()}>Reply</button>
      </form>
    </li>
  );
}

/** Today's date in the person's own timezone, as YYYY-MM-DD for the date input. */
function todayLocal(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** "Today" means right now; an earlier date means midday that day. */
function careMoment(date: string): Date {
  return date === todayLocal() ? new Date() : new Date(`${date}T12:00:00`);
}

function formatDate(date: Date): string { return date.toLocaleDateString(undefined, { month: "long", day: "numeric" }); }
function formatShortDate(date: Date): string { return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric" }); }
function capitalize(value: string): string { return value.slice(0, 1).toUpperCase() + value.slice(1); }
