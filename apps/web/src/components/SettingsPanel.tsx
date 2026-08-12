import { useState } from "react";
import { usePlace, useSaveSettings, useSettings } from "../lib/settings";
import LocationPicker from "./LocationPicker";

export default function SettingsPanel() {
  const { data: settings } = useSettings();
  const place = usePlace();
  const save = useSaveSettings();
  const [locationMessage, setLocationMessage] = useState<string | null>(null);

  const pets = settings?.pets ?? { cat: false, dog: false };

  return (
    <div className="card settings-panel">
      <h2>Your place &amp; pets</h2>
      <p className="muted">Your location powers precise, season-aware advice. Nothing leaves this device.</p>

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

      {locationMessage && <p className="form-error" role="status">{locationMessage}</p>}
    </div>
  );
}
