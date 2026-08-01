import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { irrigation, nextWaterAt, type CareEventType } from "@silvae/core";
import { careHistory, deletePlant, getPlant, logCareEvent, savePlant } from "../lib/repo";
import { preparePlantPhoto } from "../lib/photos";
import { speciesBySlug } from "../lib/seed";
import { toEnv } from "../lib/weather";
import { useWeather } from "../hooks/useWeather";
import type { PlantRow } from "../lib/db";

const DAY = 86400000;
const POT_TYPES = ["plastic", "terracotta", "ceramic", "self-watering"] as const;
const SOIL_TYPES = ["standard", "well-draining", "retentive"] as const;

export default function PlantDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const { data: plant } = useQuery({ queryKey: ["plant", id], queryFn: () => getPlant(id) });
  const { data: events = [] } = useQuery({ queryKey: ["events", id], queryFn: () => careHistory(id, 30) });
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

  if (!plant) return <p className="muted">Loading…</p>;
  const species = speciesBySlug(plant.speciesSlug);
  const env = weather ? toEnv(weather) : undefined;
  const lastWater = events.find((event) => event.type === "water");
  const schedule = species && env ? nextWaterAt({ species, plant, env, last: lastWater ? new Date(lastWater.at) : new Date(plant.plantedAt ?? Date.now()) }) : undefined;
  const waterAmount = species && env ? irrigation(species, env, ageDays(plant.plantedAt)) : undefined;
  const overdue = lastWater ? Date.now() - new Date(lastWater.at).getTime() > (schedule?.intervalDays ?? 7) * DAY : false;

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
          <p><em>{species?.scientificName ?? plant.speciesSlug}</em>{species?.family ? ` · ${species.family}` : ""}{species?.toxicity.pets ? " · ⚠ Toxic to pets" : ""}</p>
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
        <div className="care-fact"><span aria-hidden>☀️</span><div><small>Ideal light</small><strong>{species ? `${species.ideal.luxMin}–${species.ideal.luxMax} lux` : "—"}</strong></div></div>
      </section>

      {schedule && <details className="care-details"><summary>Why this schedule?</summary><ul className="modifier-list">{schedule.modifiers.map((modifier) => <li key={modifier.name}>{modifier.name.replace(/([A-Z])/g, " $1").toLowerCase()}: {modifier.delta > 0 ? "+" : ""}{Math.round(modifier.delta * 100)}%</li>)}</ul></details>}

      <section className="action-section">
        <div><span className="eyebrow">Care actions</span><h2>A little love goes a long way</h2></div>
        <div className="care-actions">{(["water", "mist", "fertilize", "prune", "rotate", "clean"] as CareEventType[]).map((type) => <button key={type} className={type === "water" ? "btn" : "btn secondary"} disabled={logEvent.isPending} onClick={() => void logEvent.mutate(type)}>{careIcon(type)} {type}</button>)}</div>
      </section>

      <section className="history-section">
        <div><span className="eyebrow">Plant diary</span><h2>Care history</h2></div>
        {events.length === 0 ? <div className="timeline-empty"><span aria-hidden>✨</span><p>No care events yet. Your first small action will appear here.</p></div> : <ol className="timeline">{events.map((event) => <li key={event.id}><span aria-hidden>{careIcon(event.type)}</span><div><strong>{capitalize(event.type)}</strong>{event.note && <small>{event.note}</small>}</div><time dateTime={event.at}>{formatDateTime(new Date(event.at))}</time></li>)}</ol>}
      </section>

      {plant.notes && <section className="notes-card"><span aria-hidden>💛</span><div><strong>Plant notes</strong><p>{plant.notes}</p></div></section>}
      <button className="delete-link" onClick={() => void remove.mutate()} disabled={remove.isPending}>Remove {plant.name} from my garden</button>
    </div>
  );
}

function EditPlantCard({ plant, saving, error, onSave }: { plant: PlantRow; saving: boolean; error: string | null; onSave: (patch: Partial<PlantRow>, photo?: File) => Promise<void> }) {
  const [name, setName] = useState(plant.name);
  const [spotName, setSpotName] = useState(plant.spotName ?? "");
  const [potType, setPotType] = useState(plant.potType);
  const [soilType, setSoilType] = useState(plant.soilType);
  const [potSizeCm, setPotSizeCm] = useState(String(plant.potSizeCm ?? ""));
  const [notes, setNotes] = useState(plant.notes ?? "");
  const [photo, setPhoto] = useState<File>();
  return <section className="card edit-card"><h2>Make it yours</h2><div className="form-grid"><label>Name<input value={name} onChange={(event) => setName(event.target.value)} /></label><label>Favourite spot<input value={spotName} onChange={(event) => setSpotName(event.target.value)} placeholder="Living room window" /></label><label>Pot type<select value={potType} onChange={(event) => setPotType(event.target.value as PlantRow["potType"])}>{POT_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label><label>Soil<select value={soilType} onChange={(event) => setSoilType(event.target.value as PlantRow["soilType"])}>{SOIL_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label><label>Pot size (cm)<input type="number" min="1" value={potSizeCm} onChange={(event) => setPotSizeCm(event.target.value)} /></label><label>Plant photo<input type="file" accept="image/*" onChange={(event) => setPhoto(event.target.files?.[0])} /></label></div><label>Notes<textarea value={notes} rows={3} onChange={(event) => setNotes(event.target.value)} /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="btn" disabled={saving || !name.trim()} onClick={() => void onSave({ name: name.trim(), spotName: spotName.trim() || undefined, potType, soilType, potSizeCm: Number(potSizeCm) || undefined, notes: notes.trim() || undefined }, photo)}>Save changes</button></section>;
}

function careIcon(type: CareEventType): string { return ({ water: "💧", mist: "💦", fertilize: "🌱", prune: "✂", rotate: "↻", clean: "✨", repot: "🪴", biostimulate: "🌿" })[type]; }
function ageDays(plantedAt?: string): number { return plantedAt ? Math.max(0, Math.floor((Date.now() - new Date(plantedAt).getTime()) / DAY)) : 0; }
function formatDate(date: Date): string { return date.toLocaleDateString(undefined, { month: "long", day: "numeric" }); }
function formatDateTime(date: Date): string { return date.toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
function capitalize(value: string): string { return value.slice(0, 1).toUpperCase() + value.slice(1); }
function formatRelative(date: Date): string { const days = Math.ceil((date.getTime() - Date.now()) / DAY); return days <= 0 ? "Water today" : days === 1 ? "Water tomorrow" : `Water in ${days} days`; }
