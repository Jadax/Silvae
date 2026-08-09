import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { addDays } from "@silvae/core";
import { addPlant } from "../lib/repo";
import { preparePlantPhoto } from "../lib/photos";
import { describeIdentifyError, identifyPlant } from "../lib/api";
import { fileToPayload, matchCatalog, sha256Hex, type MatchedSpecies } from "../lib/identify";
import { SPECIES } from "../lib/seed";
import { useSaveSettings } from "../lib/settings";

const POT_TYPES = ["plastic", "terracotta", "ceramic", "self-watering"] as const;
const SOIL_TYPES = ["standard", "well-draining", "retentive"] as const;

export default function AddPlant() {
  const navigate = useNavigate();
  const saveSettings = useSaveSettings();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [speciesSlug, setSpeciesSlug] = useState(
    () => new URLSearchParams(window.location.search).get("species") ?? "",
  );
  const [speciesSearch, setSpeciesSearch] = useState(() => {
    const slug = new URLSearchParams(window.location.search).get("species") ?? "";
    return SPECIES.find((entry) => entry.slug === slug)?.commonNames[0] ?? "";
  });
  const [spotName, setSpotName] = useState("");
  const [locationType, setLocationType] = useState<"indoor" | "outdoor">("indoor");
  const [potType, setPotType] = useState<(typeof POT_TYPES)[number]>("plastic");
  const [soilType, setSoilType] = useState<(typeof SOIL_TYPES)[number]>("standard");
  const [potSizeCm, setPotSizeCm] = useState("20");
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<string | undefined>();
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idState, setIdState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [idMatches, setIdMatches] = useState<MatchedSpecies[]>([]);
  const [idError, setIdError] = useState<string | null>(null);

  const species = SPECIES.find((entry) => entry.slug === speciesSlug);
  const matches = useMemo(() => {
    const query = speciesSearch.trim().toLowerCase();
    if (!query) return SPECIES.slice(0, 18);
    return SPECIES.filter((entry) =>
      entry.scientificName.toLowerCase().includes(query) ||
      entry.commonNames.some((common: string) => common.toLowerCase().includes(query)),
    ).slice(0, 18);
  }, [speciesSearch]);

  async function selectPhoto(file: File | undefined) {
    if (!file) return;
    setPhotoBusy(true);
    setError(null);
    try {
      setPhoto(await preparePlantPhoto(file));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We couldn't save that photo.");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function identifyFromPhoto(file: File) {
    setIdState("busy");
    setIdError(null);
    setIdMatches([]);
    try {
      const payload = await fileToPayload(file);
      if (!payload) throw new Error("encode_failed");
      const fingerprint = await sha256Hex(payload.bytes);
      const res = await identifyPlant({ imageFingerprint: fingerprint, base64: payload.base64 });
      const matches = matchCatalog(res.species ?? []);
      setIdMatches(matches);
      const top = matches.find((m) => m.inCatalog) ?? matches[0];
      if (top?.inCatalog && top.slug) {
        setSpeciesSlug(top.slug);
        setSpeciesSearch(top.commonNames[0] ?? top.scientificName);
      } else if (top) {
        setSpeciesSlug("");
        setSpeciesSearch(top.scientificName);
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
      setError("Give your plant a name first.");
      return;
    }
    if (step === 2 && !species) {
      setError("Choose a plant type so we can make its care plan.");
      return;
    }
    setStep((current) => Math.min(3, current + 1));
  }

  async function submit() {
    if (!species) {
      setError("Choose a plant type so we can make its care plan.");
      setStep(2);
      return;
    }
    const now = new Date();
    const id = crypto.randomUUID();
    await addPlant({
      id,
      ownerUid: "local",
      name: name.trim(),
      speciesSlug: species.slug,
      locationType,
      potType,
      soilType,
      potSizeCm: Number(potSizeCm) || undefined,
      spotName: spotName.trim() || undefined,
      notes: notes.trim() || undefined,
      avatarPhotoUrl: photo,
      plantedAt: now.toISOString(),
      sharedWith: [],
      nextWaterAt: addDays(now, species.ideal.waterIntervalDays).toISOString(),
    });
    await saveSettings.mutateAsync({ onboarded: true });
    navigate(`/plants/${id}`);
  }

  return (
    <div className="setup-page">
      <div className="page-intro">
        <span className="eyebrow">A tiny welcome ritual</span>
        <h1>Add a plant</h1>
        <p>Just a few friendly questions, then we’ll make a simple care plan.</p>
      </div>
      <ol className="stepper" aria-label={`Step ${step} of 3`}>
        {["Say hello", "Find its type", "Set its home"].map((label, index) => (
          <li key={label} className={index + 1 === step ? "active" : index + 1 < step ? "done" : ""}>
            <span>{index + 1 < step ? "✓" : index + 1}</span>{label}
          </li>
        ))}
      </ol>

      <section className="card setup-card">
        {step === 1 && <>
          <h2>Who’s joining your garden?</h2>
          <p className="muted">A photo is optional, but it makes your garden feel like yours.</p>
          <div className="photo-picker">
            {photo ? <img src={photo} alt="Your plant" /> : <span aria-hidden>🪴</span>}
            <label className="photo-button">
              {photo ? "Change photo" : photoBusy ? "Preparing photo…" : "Add a photo"}
              <input type="file" accept="image/*" capture="environment" onChange={(event) => void selectPhoto(event.target.files?.[0])} disabled={photoBusy} />
            </label>
          </div>
          <label>
            What do you call it?
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Momo" autoFocus />
          </label>
        </>}

        {step === 2 && <>
          <h2>What kind of plant is {name || "this"}?</h2>
          <p className="muted">Search by a common name or scientific name. You can change it later.</p>
          <div className="identify-card">
            <div className="identify-row">
              <span aria-hidden>📷</span>
              <div>
                <strong>Not sure what it is?</strong>
                <p className="muted">Take a photo and we'll guess the type. You get to confirm before it's set.</p>
              </div>
              <label className="btn secondary photo-button identify-button">
                {idState === "busy" ? "Looking…" : "Identify from photo"}
                <input type="file" accept="image/*" capture="environment" disabled={idState === "busy"} onChange={(event) => { const f = event.target.files?.[0]; if (f) void identifyFromPhoto(f); event.currentTarget.value = ""; }} />
              </label>
            </div>
            {idState === "done" && idMatches.length > 0 && (() => {
              const best = idMatches.find((m) => m.inCatalog) ?? idMatches[0];
              return (
                <p className={`identify-result ${best?.inCatalog ? "" : "warn"}`}>
                  {best?.inCatalog
                    ? <>Looks like <strong>{best.commonNames[0] ?? best.scientificName}</strong>{best.confidence !== undefined ? ` (${Math.round(best.confidence * 100)}%)` : ""}. Confirm it below or pick another.</>
                    : <>We matched <em>{best?.scientificName}</em>, but there's no care guide for it yet. Pick the closest match below.</>}
                </p>
              );
            })()}
            {idState === "error" && idError && <p className="form-error">{idError}</p>}
          </div>
          <label>
            Search the plant library
            <input type="search" value={speciesSearch} onChange={(event) => setSpeciesSearch(event.target.value)} placeholder="Pothos, monstera, snake plant…" autoFocus />
          </label>
          <div className="species-options" role="listbox" aria-label="Plant type results">
            {matches.map((entry) => <button key={entry.slug} type="button" className={entry.slug === speciesSlug ? "selected" : ""} onClick={() => setSpeciesSlug(entry.slug)} role="option" aria-selected={entry.slug === speciesSlug}>
              <span aria-hidden>🌱</span><span><strong>{entry.commonNames[0]}</strong><small><em>{entry.scientificName}</em></small></span>{entry.slug === speciesSlug && <b aria-label="Selected">✓</b>}
            </button>)}
          </div>
          {matches.length === 0 && <p className="muted">No close matches yet. Try a simpler name.</p>}
        </>}

        {step === 3 && <>
          <h2>Where will {name || "your plant"} live?</h2>
          <p className="muted">Outdoor plants use real weather: frost and heat warnings, plus rain-aware watering.</p>
          <div className="segmented" role="radiogroup" aria-label="Indoor or outdoor">
            <button type="button" className={locationType === "indoor" ? "selected" : ""} onClick={() => setLocationType("indoor")} role="radio" aria-checked={locationType === "indoor"}><span aria-hidden>🏠</span><div><strong>Indoor</strong><small>Living room, shelf, windowsill</small></div></button>
            <button type="button" className={locationType === "outdoor" ? "selected" : ""} onClick={() => setLocationType("outdoor")} role="radio" aria-checked={locationType === "outdoor"}><span aria-hidden>☀️</span><div><strong>Outdoor</strong><small>Garden, balcony, patio</small></div></button>
          </div>
          <div className="form-grid">
            <label>Favourite spot<input value={spotName} onChange={(event) => setSpotName(event.target.value)} placeholder="Living room window" /></label>
            <label>Pot type<select value={potType} onChange={(event) => setPotType(event.target.value as (typeof POT_TYPES)[number])}>{POT_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
            <label>Soil<select value={soilType} onChange={(event) => setSoilType(event.target.value as (typeof SOIL_TYPES)[number])}>{SOIL_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
            <label>Pot size (cm)<input type="number" min="1" value={potSizeCm} onChange={(event) => setPotSizeCm(event.target.value)} /></label>
          </div>
          <label>Anything to remember? <span className="optional">Optional</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="A gift from Grandma, by the sunny window…" rows={3} /></label>
        </>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="setup-actions">
          {step > 1 && <button className="btn secondary" type="button" onClick={() => setStep((current) => current - 1)}>Back</button>}
          {step < 3 ? <button className="btn" type="button" onClick={next}>Continue <span aria-hidden>→</span></button> : <button className="btn sun" type="button" onClick={() => void submit()}>Create care plan <span aria-hidden>🌱</span></button>}
        </div>
      </section>
    </div>
  );
}
