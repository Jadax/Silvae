import { useState } from "react";
import { Link } from "react-router-dom";
import { diagnose, type Diagnosis, type Symptoms } from "@silvae/core";
import { describeIdentifyError, type IdentifyResponse } from "../lib/api";
import { identifyFromFile, photoSymptoms, pestFromDisease, type MatchedSpecies } from "../lib/identify";
import { detectTrimBounds } from "../lib/trim";
import type { Rect } from "../lib/crop";
import CropTool from "../components/CropTool";

type Form = {
  leafColor?: string;
  leafCrisp?: string;
  leafBurn?: string;
  soil?: string;
  light?: string;
  envHumidity?: string;
  droop?: boolean;
  lowerLeaves?: boolean;
  stretched?: boolean;
  curledLeaves?: boolean;
  spotsOnExposed?: boolean;
  directSun?: boolean;
  webbing?: boolean;
  stippling?: boolean;
  whiteFluff?: boolean;
  stickyResidue?: boolean;
  insects?: boolean;
  lacksDrainage?: boolean;
};

const SELECT_FIELDS: { key: keyof Form; label: string; options: { value: string; label: string }[] }[] = [
  {
    key: "leafColor",
    label: "Leaf colour",
    options: [
      { value: "", label: "Normal / green" },
      { value: "yellow", label: "Yellowing" },
      { value: "pale", label: "Pale / washed out" },
      { value: "brown", label: "Browning" },
    ],
  },
  {
    key: "leafCrisp",
    label: "Leaf edges & texture",
    options: [
      { value: "", label: "Normal" },
      { value: "dry-brown", label: "Crispy, dry, brown" },
      { value: "brown-tips", label: "Brown tips only" },
    ],
  },
  {
    key: "leafBurn",
    label: "Leaf spots / scorch",
    options: [
      { value: "", label: "None" },
      { value: "brown-spots", label: "Brown patches" },
      { value: "pale-patches", label: "Pale / bleached patches" },
    ],
  },
  {
    key: "soil",
    label: "Soil moisture",
    options: [
      { value: "", label: "Just right" },
      { value: "dry", label: "Dry" },
      { value: "moist", label: "Moist / damp" },
      { value: "soaked", label: "Soaked / waterlogged" },
    ],
  },
  {
    key: "light",
    label: "Where it sits",
    options: [
      { value: "", label: "Bright, indirect" },
      { value: "low", label: "Low light corner" },
      { value: "medium", label: "Medium light" },
      { value: "high", label: "Bright light" },
    ],
  },
  {
    key: "envHumidity",
    label: "Room humidity",
    options: [
      { value: "", label: "Normal" },
      { value: "low", label: "Dry (heating/AC)" },
      { value: "high", label: "Humid (bathroom)" },
    ],
  },
];

const CHECK_FIELDS: { key: keyof Form; label: string }[] = [
  { key: "droop", label: "Leaves are drooping" },
  { key: "lowerLeaves", label: "Lower leaves yellowing or falling" },
  { key: "stretched", label: "Stems stretched and leggy" },
  { key: "curledLeaves", label: "Leaves curling or cupping" },
  { key: "spotsOnExposed", label: "Spots mainly on the sun-facing side" },
  { key: "directSun", label: "Plant sits in direct sun" },
  { key: "webbing", label: "Fine webbing between leaves" },
  { key: "stippling", label: "Tiny pale dots / stippling on leaves" },
  { key: "whiteFluff", label: "White fluffy patches" },
  { key: "stickyResidue", label: "Sticky residue on leaves" },
  { key: "insects", label: "Tiny insects visible" },
];

function toSymptoms(form: Form): Symptoms {
  return {
    ...(form.leafColor ? { leafColor: form.leafColor as Symptoms["leafColor"] } : {}),
    ...(form.leafCrisp ? { leafCrisp: form.leafCrisp as Symptoms["leafCrisp"] } : {}),
    ...(form.leafBurn ? { leafBurn: form.leafBurn as Symptoms["leafBurn"] } : {}),
    ...(form.soil ? { soil: form.soil as Symptoms["soil"] } : {}),
    ...(form.light ? { light: form.light as Symptoms["light"] } : {}),
    ...(form.envHumidity ? { envHumidity: form.envHumidity as Symptoms["envHumidity"] } : {}),
    ...(form.droop ? { droop: true } : {}),
    ...(form.lowerLeaves ? { lowerLeaves: true } : {}),
    ...(form.stretched ? { stretched: true } : {}),
    ...(form.curledLeaves ? { curledLeaves: true } : {}),
    ...(form.spotsOnExposed ? { spotsOnExposed: true } : {}),
    ...(form.directSun ? { directSun: true } : {}),
    ...(form.webbing ? { webbing: true } : {}),
    ...(form.stippling ? { stippling: true } : {}),
    ...(form.whiteFluff ? { whiteFluff: true } : {}),
    ...(form.stickyResidue ? { stickyResidue: true } : {}),
    ...(form.insects ? { insects: true } : {}),
    ...(form.lacksDrainage ? { potHasDrainage: false } : {}),
  };
}

function applyInferred(form: Form, inferred: Symptoms): Form {
  const next = { ...form };
  (Object.keys(inferred) as (keyof Symptoms)[]).forEach((key) => {
    const value = inferred[key];
    if (value === true) {
      if (key === "potHasDrainage") next.lacksDrainage = false;
      else (next as Record<string, boolean | string | undefined>)[key] = true;
    } else if (typeof value === "string") {
      (next as Record<string, boolean | string | undefined>)[key] = value;
    }
  });
  return next;
}

function confidenceClass(c: Diagnosis["confidence"]): string {
  if (c === "high") return "badge";
  if (c === "medium") return "badge badge-warn";
  return "badge badge-low";
}

export default function Doctor() {
  const [form, setForm] = useState<Form>({});
  const [results, setResults] = useState<Diagnosis[] | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [photoDriven, setPhotoDriven] = useState(false);

  const [photo, setPhoto] = useState<File | null>(null);
  const [preset, setPreset] = useState<Rect | null>(null);
  const [idState, setIdState] = useState<"idle" | "processing" | "done" | "error">("idle");
  const [idResult, setIdResult] = useState<IdentifyResponse | null>(null);
  const [idMatches, setIdMatches] = useState<MatchedSpecies[]>([]);
  const [idError, setIdError] = useState<string | null>(null);

  const set = (key: keyof Form, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  const pickPhoto = (file: File | null) => {
    setPhoto(file);
    setPreset(null);
    setIdState("idle");
    setIdResult(null);
    setIdMatches([]);
    setIdError(null);
    if (!file) return;
    void detectTrimBounds(file).then(setPreset);
  };

  const runIdentify = async (source: File | Blob) => {
    setIdState("processing");
    setIdError(null);
    setIdResult(null);
    setIdMatches([]);
    try {
      const { result, matches } = await identifyFromFile(source);
      setIdResult(result);
      setIdMatches(matches);
      setIdState("done");
    } catch (err) {
      setIdState("error");
      setIdError(describeIdentifyError(err));
    }
  };

  const submit = () => {
    setPhotoDriven(false);
    setResults(diagnose(toSymptoms(form)));
    setSubmitted(true);
  };

  const photoInferred = idResult ? photoSymptoms(idResult) : null;
  const hasInferred = Boolean(photoInferred && Object.keys(photoInferred).length > 0);
  const healthSuspicion = idResult?.isHealthy ? !idResult.isHealthy.binary : false;
  const showHealthBridge = hasInferred || healthSuspicion;
  const pest = idResult ? pestFromDisease(idResult) : undefined;

  const prefillFromPhoto = () => {
    if (!idResult || !photoInferred) return;
    const inferred = photoSymptoms(idResult);
    const next = applyInferred(form, inferred);
    setForm(next);
    setPhotoDriven(true);
    setResults(diagnose({ ...toSymptoms(next), ...inferred }));
    setSubmitted(true);
    requestAnimationFrame(() => {
      document.getElementById("diagnosis")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const reset = () => {
    setForm({});
    setResults(null);
    setSubmitted(false);
  };

  return (
    <>
      <h1>Plant Doctor</h1>
      <p className="muted">
        Identify a plant from a photo, or describe what looks wrong. Photo ID sends the image to
        our plant service. The symptom check runs on your device.
      </p>

      <section className="card" aria-label="Identify by photo">
        <h2>What plant is this?</h2>
        <p className="muted">
          Take a photo or upload one, crop it to the plant, and we'll try to match it to
          the Silvae catalog.
        </p>
        {!photo ? (
          <div className="photo-actions">
            <label className="photo-button">
              {"\uD83D\uDCF7 Take photo"}
              <input type="file" accept="image/*" capture="environment" onChange={(e) => pickPhoto(e.target.files?.[0] ?? null)} />
            </label>
            <label className="photo-button photo-button-secondary">
              {"\uD83D\uDCC1 Choose from album"}
              <input type="file" accept="image/*" onChange={(e) => pickPhoto(e.target.files?.[0] ?? null)} />
            </label>
          </div>
        ) : (
          <>
            <CropTool
              file={photo}
              preset={preset}
              busy={idState === "processing"}
              onSubmit={(crop) => void runIdentify(crop ?? photo)}
              onCancel={() => pickPhoto(null)}
            />
            <div className="photo-actions" style={{ marginTop: "0.5rem" }}>
              <label className="photo-button photo-button-secondary">
                {"\uD83D\uDCF7 Retake photo"}
                <input type="file" accept="image/*" capture="environment" onChange={(e) => pickPhoto(e.target.files?.[0] ?? null)} />
              </label>
              <label className="photo-button photo-button-secondary">
                {"\uD83D\uDCC1 Choose different"}
                <input type="file" accept="image/*" onChange={(e) => pickPhoto(e.target.files?.[0] ?? null)} />
              </label>
            </div>
          </>
        )}

        {idState === "error" && idError && (
          <p className="muted">
            <strong>{idError}</strong>{" "}
            <Link to="/discover">Browse the 400-species catalog instead.</Link>
          </p>
        )}

        {idState === "done" && idResult && (
          <div className="results">
            {typeof idResult.isPlant?.probability === "number" &&
              idResult.isPlant.probability < 0.4 && (
                <p className="muted">
                  That doesn't look like a plant to us (confidence{" "}
                  {Math.round(idResult.isPlant.probability * 100)}%). Crop tighter around the
                  leaves and try again, or{" "}
                  <Link to="/discover">browse the catalog.</Link>
                </p>
              )}

            {idMatches.length === 0 ? (
              <p className="muted">
                No species recognized.{" "}
                <Link to="/discover">Browse the 400-species catalog.</Link>
              </p>
            ) : (
              <ol className="diagnoses">
                {idMatches.map((m, i) => (
                  <li key={`${m.scientificName}-${i}`} className="diagnosis">
                    <div className="diagnosis-head">
                      {m.inCatalog && m.slug ? (
                        <strong>
                          <Link to={`/species/${m.slug}`}>{m.commonNames[0] ?? m.scientificName}</Link>
                        </strong>
                      ) : (
                        <strong>{m.commonNames[0] ?? m.scientificName}</strong>
                      )}
                      <span className="badge">
                        {m.confidence !== undefined
                          ? `${Math.round(m.confidence * 100)}%`
                          : "match"}
                      </span>
                    </div>
                    <p className="muted">
                      <em>{m.scientificName}</em>
                      {m.inCatalog ? (
                        <>
                          {" "}
                          \u00B7 has a care guide \u00B7{" "}
                          <Link to={`/species/${m.slug}`}>open it</Link>
                        </>
                      ) : (
                        <>
                          {" "}
                          \u00B7 not in the catalog yet \u00B7{" "}
                          <Link to={`/discover?q=${encodeURIComponent(m.scientificName)}`}>
                            search the catalog
                          </Link>
                        </>
                      )}
                    </p>
                  </li>
                ))}
              </ol>
            )}

            {idResult.isHealthy && (
              <p className="muted">
                Health:{" "}
                {idResult.isHealthy.binary
                  ? `looks healthy (${Math.round((idResult.isHealthy.probability ?? 0) * 100)}%)`
                  : `possible issue detected (${Math.round((idResult.isHealthy.probability ?? 0) * 100)}%)`}
              </p>
            )}
            {idResult.disease?.name && (
              <p className="muted">
                Suggested problem: <strong>{idResult.disease.name}</strong>
                {idResult.disease.probability !== undefined
                  ? ` (${Math.round(idResult.disease.probability * 100)}%)`
                  : ""}
              </p>
            )}
            {pest && (
              <div className="pest-card" role="status">
                <span className="pest-icon" aria-hidden>{pest.icon}</span>
                <div>
                  <div className="pest-head">
                    <strong>Detected: {pest.pest}</strong>
                    <span className={`badge ${pest.severity === "stubborn" ? "badge-low" : pest.severity === "moderate" ? "badge-warn" : "badge"}`}>{pest.severity}</span>
                  </div>
                  <p className="muted">Photos can mislead. Confirm what you see on the plant first.</p>
                  <ol className="treatment">
                    {pest.treatments.map((step, i) => <li key={i}>{step}</li>)}
                  </ol>
                </div>
              </div>
            )}
            {showHealthBridge && (
              <div className="alert peach health-bridge" role="status">
                <span aria-hidden>{'\uD83E\uDE7A'}</span>
                <div>
                  <strong>This photo may show a problem.</strong>
                  <p className="muted">
                    {idResult.disease?.name
                      ? <>The service flagged <strong>{idResult.disease.name}</strong>. Photos can mislead, so check what you see before acting.</>
                      : "Something may be off, but the photo alone isn't clear enough. Check the symptoms below."}
                  </p>
                  {hasInferred && (
                    <button className="btn secondary" type="button" onClick={prefillFromPhoto}>
                      Check these symptoms for me
                    </button>
                  )}
                </div>
              </div>
            )}
            {idResult.cached && <p className="muted">Reused a cached result for this photo.</p>}
          </div>
        )}
      </section>

      <section className="card" aria-label="Symptom checklist">
        <h2>What does the plant look like?</h2>
        <p className="muted">Tick everything you can see. Leave the rest as "normal".</p>
        <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <fieldset>
            <legend>Leaves</legend>
            {SELECT_FIELDS.slice(0, 3).map((f) => (
              <label key={f.key}>
                {f.label}
                <select value={(form[f.key] as string) ?? ""} onChange={(e) => set(f.key, e.target.value)}>
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <div className="checks">
              {CHECK_FIELDS.slice(0, 5).map((f) => (
                <label key={f.key} className="check">
                  <input
                    type="checkbox"
                    checked={Boolean(form[f.key])}
                    onChange={(e) => set(f.key, e.target.checked)}
                  />
                  {f.label}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Soil &amp; pot</legend>
            {SELECT_FIELDS.slice(3, 4).map((f) => (
              <label key={f.key}>
                {f.label}
                <select value={(form[f.key] as string) ?? ""} onChange={(e) => set(f.key, e.target.value)}>
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <label className="check">
              <input
                type="checkbox"
                checked={Boolean(form.lacksDrainage)}
                onChange={(e) => set("lacksDrainage", e.target.checked)}
              />
              Pot has no drainage holes
            </label>
          </fieldset>

          <fieldset>
            <legend>Environment</legend>
            {SELECT_FIELDS.slice(4).map((f) => (
              <label key={f.key}>
                {f.label}
                <select value={(form[f.key] as string) ?? ""} onChange={(e) => set(f.key, e.target.value)}>
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </fieldset>

          <fieldset>
            <legend>Pests</legend>
            <div className="checks">
              {CHECK_FIELDS.slice(5).map((f) => (
                <label key={f.key} className="check">
                  <input
                    type="checkbox"
                    checked={Boolean(form[f.key])}
                    onChange={(e) => set(f.key, e.target.checked)}
                  />
                  {f.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="actions">
            <button type="submit" className="btn">
              Check symptoms
            </button>
            <button type="button" className="btn secondary" onClick={reset}>
              Reset
            </button>
          </div>
        </form>
      </section>

      {submitted && results !== null && (
        <section className="card results" aria-label="Diagnosis" id="diagnosis">
          <h2>Diagnosis</h2>
          {results.length === 0 ? (
            photoDriven ? (
              <p>Nothing in the checklist lined up with a known issue. If the photo still worries you, try a sharper photo or re-check the symptoms.</p>
            ) : (
              <p>Nothing stands out from what you described. Good news. Keep doing what you're doing.</p>
            )
          ) : (
            <ol className="diagnoses">
              {results.map((d) => (
                <li key={d.id} className="diagnosis">
                  <div className="diagnosis-head">
                    <strong>{d.likelyCause}</strong>
                    <span className={confidenceClass(d.confidence)}>{d.confidence}</span>
                    <span className="muted">score {d.score}</span>
                  </div>
                  <ol className="treatment">
                    {d.treatment.map((step: string, i: number) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </li>
              ))}
            </ol>
          )}
          <p className="muted">
            These are suggestions to help you decide, not a diagnosis from a professional agronomist
            or vet.
          </p>
        </section>
      )}
    </>
  );
}
