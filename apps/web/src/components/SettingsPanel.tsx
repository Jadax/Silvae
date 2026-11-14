import { useEffect, useState } from "react";
import { usePlace, useSaveSettings, useSettings } from "../lib/settings";
import type { MyFertilizer } from "../lib/db";
import LocationPicker from "./LocationPicker";

export default function SettingsPanel() {
  const { data: settings } = useSettings();
  const place = usePlace();
  const save = useSaveSettings();
  const [locationMessage, setLocationMessage] = useState<string | null>(null);

  const pets = settings?.pets ?? { cat: false, dog: false };

  return (
    <div className="card settings-panel">
      <h2>Your place, pets &amp; fertiliser</h2>
      <p className="muted">Your location powers weather and season-aware advice and stays on this device. Pets and fertiliser sync to your other devices.</p>

      <section className="settings-group">
        <h3>Where are your plants?</h3>
        <p className="muted">
          {place ? `Using weather for ${place.label}.` : "Set your location to get real weather, seasons, and outdoor warnings."}
        </p>
        <LocationPicker showManualEntry onLocationSet={(p) => setLocationMessage(`Set to ${p.label}.`)} />
      </section>

      <section className="settings-group">
        <h3>Do pets live here?</h3>
        <p className="muted">We'll flag risky plants for your cat or dog and add a pet-safe filter to Discover.</p>
        <div className="checks">
          <label className="check">
            <input
              type="checkbox"
              checked={pets.cat}
              onChange={(e) => void save.mutateAsync({ pets: { ...pets, cat: e.target.checked } })}
            />{" "}
            🐱 Cat
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={pets.dog}
              onChange={(e) => void save.mutateAsync({ pets: { ...pets, dog: e.target.checked } })}
            />{" "}
            🐶 Dog
          </label>
        </div>
      </section>

      <FertilizerSettings
        current={settings?.fertilizer}
        onSave={(fertilizer) => save.mutateAsync({ fertilizer })}
      />

      {locationMessage && <p className="form-error" role="status">{locationMessage}</p>}
    </div>
  );
}

/** The fertiliser on your shelf, so feeding advice reads "mix 2 ml of X into 500 ml". */
function FertilizerSettings({ current, onSave }: { current?: MyFertilizer; onSave: (f: MyFertilizer | undefined) => Promise<unknown> }) {
  const [name, setName] = useState(current?.name ?? "");
  const [dose, setDose] = useState(current ? String(current.dosePerLiter) : "");
  const [unit, setUnit] = useState<MyFertilizer["unit"]>(current?.unit ?? "ml");
  const [saved, setSaved] = useState(false);

  // Settings can arrive from another device after this renders.
  useEffect(() => {
    setName(current?.name ?? "");
    setDose(current ? String(current.dosePerLiter) : "");
    setUnit(current?.unit ?? "ml");
  }, [current?.name, current?.dosePerLiter, current?.unit]);

  const value = Number(dose.replace(",", "."));
  const valid = name.trim().length > 0 && value > 0 && value < 100;

  return (
    <section className="settings-group">
      <h3>Your fertiliser</h3>
      <p className="muted">
        Copy the dose from the label (the amount per litre of water). Each plant's feeding plan will then tell you exactly how much to mix,
        at half strength for light feeders.
      </p>
      <div className="form-grid">
        <label>Product name<input value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} placeholder="e.g. Seagro, Nitrosol, Multifeed" /></label>
        <label>Label dose per litre<input inputMode="decimal" value={dose} onChange={(e) => { setDose(e.target.value); setSaved(false); }} placeholder="e.g. 2" /></label>
        <label>Unit<select value={unit} onChange={(e) => { setUnit(e.target.value as MyFertilizer["unit"]); setSaved(false); }}><option value="ml">ml (liquid)</option><option value="g">g (powder/granules)</option></select></label>
      </div>
      <div className="actions">
        <button className="btn" disabled={!valid} onClick={() => void onSave({ name: name.trim(), dosePerLiter: value, unit }).then(() => setSaved(true))}>Save fertiliser</button>
        {current && <button className="btn secondary" onClick={() => void onSave(undefined).then(() => setSaved(false))}>Clear</button>}
        {saved && <span className="muted">Saved ✓</span>}
      </div>
    </section>
  );
}
