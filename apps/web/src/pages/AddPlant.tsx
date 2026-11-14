import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { POT_TYPES, SOIL_TYPES } from "@silvae/core";
import { addPlant, logCareEvent, savePlant } from "../lib/repo";
import { prepareAvatar, saveJournalPhoto } from "../lib/photos";
import { describeIdentifyError, type IdentifyResponse } from "../lib/api";
import { identifyFromFile, pestFromDisease, type MatchedSpecies } from "../lib/identify";
import { SPECIES } from "../lib/seed";
import { usePlace, useSaveSettings } from "../lib/settings";
import { useWeather } from "../hooks/useWeather";
import { DAY, envForPlant, potLabel, rescheduleWater } from "../lib/care";
import type { CareEventRow, PlantRow } from "../lib/db";

/** How long ago something happened, as offered in the "last care" step. */
const AGO_OPTIONS: { label: string; days: number | null }[] = [
  { label: "Today", days: 0 },
  { label: "Yesterday", days: 1 },
  { label: "A few days ago", days: 3 },
  { label: "About a week ago", days: 7 },
  { label: "Two weeks ago", days: 14 },
  { label: "A month or more", days: 30 },
  { label: "Not sure", days: null },
];

const STEPS = ["Photo & name", "What it is", "Its home", "Last care"];

export default function AddPlant() {
  const navigate = useNavigate();
  const saveSettings = useSaveSettings();
  const place = usePlace();
  const { data: weather } = useWeather();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [speciesSlug, setSpeciesSlug] = useState(() => new URLSearchParams(window.location.search).get("species") ?? "");
  const [speciesSearch, setSpeciesSearch] = useState(() => {
    const slug = new URLSearchParams(window.location.search).get("species") ?? "";
    return SPECIES.find((entry) => entry.slug === slug)?.commonNames[0] ?? "";
  });
  const [spotName, setSpotName] = useState("");
  const [locationType, setLocationType] = useState<"indoor" | "outdoor">("indoor");
  const [potType, setPotType] = useState<(typeof POT_TYPES)[number]>("plastic");
  const [soilType, setSoilType] = useState<(typeof SOIL_TYPES)[number]>("standard");
  const [potSizeCm, setPotSizeCm] = useState("15");
  const [notes, setNotes] = useState("");
  const [wateredAgo, setWateredAgo] = useState<number | null>(0);
  const [fedAgo, setFedAgo] = useState<number | null>(null);
  const [photoFile, setPhotoFile] = useState<File | undefined>();
  const [photoPreview, setPhotoPreview] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [idState, setIdState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [idMatches, setIdMatches] = useState<MatchedSpecies[]>([]);
  const [idResult, setIdResult] = useState<IdentifyResponse | null>(null);
  const [idError, setIdError] = useState<string | null>(null);

  const species = SPECIES.find((entry) => entry.slug === speciesSlug);
  const isGlassPot = potType === "glass";
  const matches = useMemo(() => {
    const query = speciesSearch.trim().toLowerCase();
    if (!query) return SPECIES.slice(0, 18);
    return SPECIES.filter((entry) =>
      entry.scientificName.toLowerCase().includes(query) ||
      entry.commonNames.some((common: string) => common.toLowerCase().includes(query)),
    ).slice(0, 18);
  }, [speciesSearch]);

  function selectPhoto(file: File | undefined) {
    if (!file) return;
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setIdState("idle");
    setIdMatches([]);
    setIdResult(null);
  }

  async function identify(file: File) {
    setIdState("busy");
    setIdError(null);
    setIdMatches([]);
    setIdResult(null);
    try {
      const { result, matches: found } = await identifyFromFile(file);
      setIdMatches(found);
      setIdResult(result);
      const top = found.find((m) => m.inCatalog) ?? found[0];
      if (top?.inCatalog && top.slug) {
        setSpeciesSlug(top.slug);
        setSpeciesSearch(top.commonNames[0] ?? top.scientificName);
      } else if (top) {
        setSpeciesSlug("");
        setSpeciesSearch(top.genusName ?? top.scientificName);
      }
      setIdState("done");
    } catch (err) {
      setIdState("error");
      setIdError(describeIdentifyError(err));
    }
  }

  function next() {
    setError(null);
    if (step === 1 && !name.trim()) {
      setError("Give your plant a name.");
      return;
    }
    if (step === 2 && !species) {
      setError("Pick a plant type so we can build its care plan.");
      return;
    }
    if (step === 3 && !isGlassPot && !(Number(potSizeCm) > 0)) {
      setError("Roughly how wide is the pot? It decides how much and how often to water.");
      return;
    }
    // Arriving at "What it is" with a photo but no type yet: identify straight away.
    if (step === 1 && photoFile && !species && idState === "idle") void identify(photoFile);
    setStep((current) => Math.min(STEPS.length, current + 1));
  }

  async function submit() {
    if (!species) {
      setError("Pick a plant type so we can build its care plan.");
      setStep(2);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const now = new Date();
      const id = crypto.randomUUID();
      const ago = (days: number) => (days === 0 ? now : new Date(now.getTime() - days * DAY));
      const plant: PlantRow = {
        id,
        ownerUid: "local",
        name: name.trim(),
        speciesSlug: species.slug,
        locationType,
        potType,
        soilType: isGlassPot ? "well-draining" : soilType,
        potSizeCm: Number(potSizeCm) || undefined,
        spotName: spotName.trim() || undefined,
        notes: notes.trim() || undefined,
        avatarPhotoUrl: photoFile ? await prepareAvatar(photoFile) : undefined,
        plantedAt: now.toISOString(),
        sharedWith: [],
      };
      const events: CareEventRow[] = [];
      // "Not sure" counts as due now, so the first reminder doesn't wait a full cycle.
      const wateredAt = wateredAgo === null ? new Date(now.getTime() - species.ideal.waterIntervalDays * DAY) : ago(wateredAgo);
      events.push({ id: crypto.randomUUID(), plantId: id, type: "water", at: wateredAt.toISOString(), ...(wateredAgo === null ? { note: "Estimated when added" } : {}) });
      if (fedAgo !== null) events.push({ id: crypto.randomUUID(), plantId: id, type: "fertilize", at: ago(fedAgo).toISOString() });

      const env = weather ? envForPlant(weather, locationType, place?.lat) : undefined;
      await addPlant(plant);
      for (const event of events) await logCareEvent(event);
      await savePlant(rescheduleWater(plant, species, env, events));
      if (photoFile) {
        const health = idResult?.isHealthy;
        const note = health ? (health.binary ? "Day one. Looking healthy." : "Day one. The photo check flagged a possible problem.") : "Day one.";
        await saveJournalPhoto(id, photoFile, { note });
      }
      await saveSettings.mutateAsync({ onboarded: true });
      navigate(`/plants/${id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Couldn't save this plant. Please try again.");
      setSaving(false);
    }
  }

  const best = idMatches.find((m) => m.inCatalog) ?? idMatches[0];
  const pest = idResult ? pestFromDisease(idResult) : undefined;

  return (
    <div className="setup-page">
      <div className="page-intro">
        <span className="eyebrow">Add a plant</span>
        <h1>New plant</h1>
        <p>A few quick questions and we'll set up its watering and feeding plan.</p>
      </div>
      <ol className="stepper" aria-label={`Step ${step} of ${STEPS.length}`}>
        {STEPS.map((label, index) => (
          <li key={label} className={index + 1 === step ? "active" : index + 1 < step ? "done" : ""}>
            <span>{index + 1 < step ? "✓" : index + 1}</span>{label}
          </li>
        ))}
      </ol>

      <section className="card setup-card">
        {step === 1 && <>
          <h2>Snap it and name it</h2>
          <p className="muted">A clear photo of the leaves lets us work out what it is and how it's doing. You can skip it.</p>
          <div className="photo-picker">
            {photoPreview ? <img src={photoPreview} alt="Your plant" /> : <span aria-hidden>🌿</span>}
            <div className="photo-actions">
              <label className="photo-button">
                {photoPreview ? "📷 Retake" : "📷 Take photo"}
                <input type="file" accept="image/*" capture="environment" onChange={(event) => selectPhoto(event.target.files?.[0])} />
              </label>
              <label className="photo-button photo-button-secondary">
                📁 Choose from album
                <input type="file" accept="image/*" onChange={(event) => selectPhoto(event.target.files?.[0])} />
              </label>
            </div>
          </div>
          <label>
            What do you call it?
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Momo, Green giant" autoFocus />
          </label>
        </>}

        {step === 2 && <>
          <h2>What kind of plant is {name || "this"}?</h2>
          <div className="identify-card">
            {photoFile ? (
              <div className="identify-row">
                {photoPreview && <img className="identify-thumb" src={photoPreview} alt="" />}
                <div>
                  <strong>{idState === "busy" ? "Looking at your photo..." : "From your photo"}</strong>
                  {idState === "done" && best && (
                    <p className={`identify-result ${best.inCatalog ? "" : "warn"}`}>
                      {best.inCatalog
                        ? <>Looks like <strong>{best.commonNames[0] ?? best.scientificName}</strong>{best.confidence !== undefined ? ` (${Math.round(best.confidence * 100)}% sure)` : ""}. Confirm below or pick another.</>
                        : <>Closest match is <em>{best.scientificName}</em>, which has no care guide yet. Pick the nearest relative below.</>}
                    </p>
                  )}
                  {idState === "done" && !best && <p className="muted">We couldn't tell from this photo. Search below instead.</p>}
                  {idState === "done" && idResult?.isHealthy && (
                    <p className={idResult.isHealthy.binary ? "muted" : "identify-result warn"}>
                      {idResult.isHealthy.binary
                        ? "🌿 It looks healthy."
                        : `🩺 It may have a problem${idResult.disease?.name ? `: ${idResult.disease.name}` : ""}. ${pest ? `${pest.pest}: ${pest.treatments[0]}.` : "Check it in the Plant Doctor once it's added."}`}
                    </p>
                  )}
                  {idState === "error" && idError && <p className="form-error">{idError}</p>}
                  {idState !== "busy" && (
                    <button type="button" className="btn secondary identify-button" onClick={() => void identify(photoFile)}>
                      {idState === "idle" ? "🔍 Identify from my photo" : "Try again"}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="identify-row">
                <span aria-hidden>📷</span>
                <div>
                  <strong>Not sure what it is?</strong>
                  <p className="muted">Go back and add a photo, or search by name below.</p>
                  <button type="button" className="btn secondary" onClick={() => setStep(1)}>Add a photo</button>
                </div>
              </div>
            )}
          </div>
          <label>
            Search the plant library
            <input type="search" value={speciesSearch} onChange={(event) => setSpeciesSearch(event.target.value)} placeholder="Pothos, monstera, snake plant..." />
          </label>
          <div className="species-options" role="listbox" aria-label="Plant type results">
            {matches.map((entry) => <button key={entry.slug} type="button" className={entry.slug === speciesSlug ? "selected" : ""} onClick={() => setSpeciesSlug(entry.slug)} role="option" aria-selected={entry.slug === speciesSlug}>
              <span aria-hidden>🌱</span><span><strong>{entry.commonNames[0]}</strong><small><em>{entry.scientificName}</em></small></span>{entry.slug === speciesSlug && <b aria-label="Selected">✓</b>}
            </button>)}
          </div>
          {matches.length === 0 && <p className="muted">No matches yet. Try a simpler name.</p>}
        </>}

        {step === 3 && <>
          <h2>Where will {name || "your plant"} live?</h2>
          <p className="muted">The pot matters most: small pots dry out fast, big ones stay damp for days.</p>
          <div className="segmented" role="radiogroup" aria-label="Indoor or outdoor">
            <button type="button" className={locationType === "indoor" ? "selected" : ""} onClick={() => setLocationType("indoor")} role="radio" aria-checked={locationType === "indoor"}><span aria-hidden>🏠</span><div><strong>Indoor</strong><small>Living room, shelf, windowsill</small></div></button>
            <button type="button" className={locationType === "outdoor" ? "selected" : ""} onClick={() => setLocationType("outdoor")} role="radio" aria-checked={locationType === "outdoor"}><span aria-hidden>☀️</span><div><strong>Outdoor</strong><small>Garden, balcony, patio</small></div></button>
          </div>
          <div className="form-grid">
            <label>Pot type<select value={potType} onChange={(event) => setPotType(event.target.value as (typeof POT_TYPES)[number])}>{POT_TYPES.map((type) => <option key={type} value={type}>{potLabel(type)}</option>)}</select></label>
            <label>{isGlassPot ? "Glass width (cm)" : "Pot width across the top (cm)"}<input type="number" min="1" inputMode="numeric" value={potSizeCm} onChange={(event) => setPotSizeCm(event.target.value)} /></label>
            {!isGlassPot ? (
              <label>Soil<select value={soilType} onChange={(event) => setSoilType(event.target.value as (typeof SOIL_TYPES)[number])}>{SOIL_TYPES.map((type) => <option key={type} value={type}>{soilLabel(type)}</option>)}</select></label>
            ) : (
              <p className="muted" style={{ alignSelf: "center" }}>Growing in water: we'll remind you to refresh it weekly.</p>
            )}
            <label>Favourite spot <span className="optional">Optional</span><input value={spotName} onChange={(event) => setSpotName(event.target.value)} placeholder="Living room window" /></label>
          </div>
          <p className="muted">Pot sizes: a mug is about 8 cm, a standard nursery pot 12–15 cm, a big floor pot 30 cm or more.</p>
          <label>Notes <span className="optional">Optional</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="A gift from Grandma, by the sunny window..." rows={3} /></label>
        </>}

        {step === 4 && <>
          <h2>When was {name || "it"} last {isGlassPot ? "given fresh water" : "watered"}?</h2>
          <p className="muted">This sets the starting point, so the first reminder lands on the right day.</p>
          <AgoPicker value={wateredAgo} onChange={setWateredAgo} name="watered" />
          {!isGlassPot && <>
            <h2 style={{ marginTop: "1.25rem" }}>And last fertilised?</h2>
            <p className="muted">Skip it if you've never fed it or don't remember.</p>
            <AgoPicker value={fedAgo} onChange={setFedAgo} name="fed" neverLabel="Never / not sure" />
          </>}
        </>}

        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="setup-actions">
          {step > 1 && <button className="btn secondary" type="button" disabled={saving} onClick={() => setStep((current) => current - 1)}>Back</button>}
          {step < STEPS.length
            ? <button className="btn" type="button" onClick={next}>Continue <span aria-hidden>→</span></button>
            : <button className="btn sun" type="button" disabled={saving} onClick={() => void submit()}>{saving ? "Saving..." : <>Create care plan <span aria-hidden>🌱</span></>}</button>}
        </div>
      </section>
    </div>
  );
}

function AgoPicker({ value, onChange, name, neverLabel }: { value: number | null; onChange: (days: number | null) => void; name: string; neverLabel?: string }) {
  return (
    <div className="chip-row" role="radiogroup" aria-label={`When it was last ${name}`}>
      {AGO_OPTIONS.map((option) => {
        const label = option.days === null && neverLabel ? neverLabel : option.label;
        return (
          <button key={label} type="button" role="radio" aria-checked={value === option.days} className={`chip ${value === option.days ? "selected" : ""}`} onClick={() => onChange(option.days)}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

function soilLabel(type: (typeof SOIL_TYPES)[number]): string {
  return ({ "well-draining": "Well-draining (cactus/orchid mix)", standard: "Standard potting mix", retentive: "Holds moisture (peaty/coir)" })[type];
}
